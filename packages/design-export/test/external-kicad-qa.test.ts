import { describe, expect, it } from "vitest";
import { buildExternalKicadQaArtifactsV1 } from "../src/external-kicad-fixtures";
import {
  ExternalKicadQaErrorV1,
  parseExternalKicadCliVersionV1,
  parseExternalKicadQaReportV1,
  planExternalKicadQaV1,
  runExternalKicadQaV1,
  serializeExternalKicadQaReportV1,
  type ExternalKicadQaArtifactV1,
  type ExternalKicadQaCommandRunnerV1,
} from "../src/external-kicad-qa";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const artifacts: readonly ExternalKicadQaArtifactV1[] = [
  {
    fixtureId: "motor-integrated-v2",
    application: "motor.brushed-dc",
    candidateId: "candidate:v2:sha256:motor",
    circuitId: "motor-main",
    designResultContentHash: HASH_A,
    engineeringContextContentHash: HASH_B,
    schematic: "(kicad_sch motor)\n",
  },
  {
    fixtureId: "power-integrated-v2",
    application: "power.buck",
    candidateId: "candidate:v2:sha256:power",
    circuitId: "power-main",
    designResultContentHash: HASH_B,
    engineeringContextContentHash: HASH_A,
    schematic: "(kicad_sch power)\n",
  },
];

function fakeExecution() {
  const files = new Map<string, Uint8Array>();
  const calls: string[][] = [];
  const run: ExternalKicadQaCommandRunnerV1 = (command) => {
    calls.push([...command.args]);
    if (command.args[0] === "version") {
      return { exitCode: 0, stdout: "8.0.6\n", stderr: "" };
    }
    const output = command.args[command.args.indexOf("--output") + 1];
    if (output === undefined) return { exitCode: 2, stdout: "", stderr: "missing output" };
    files.set(output, new TextEncoder().encode(`%PDF-1.7\n${command.args.at(-1)}\n`));
    return { exitCode: 0, stdout: `Plotted to ${output}.\n`, stderr: "" };
  };
  return {
    files,
    calls,
    run,
    io: {
      writeInput: (path: string, bytes: Uint8Array) => files.set(path, Uint8Array.from(bytes)),
      readInput: (path: string) => {
        const value = files.get(path);
        if (value === undefined) throw new Error("missing input");
        return Uint8Array.from(value);
      },
      readOutput: (path: string) => {
        const value = files.get(path);
        if (value === undefined) throw new Error("missing output");
        return Uint8Array.from(value);
      },
    },
  };
}

describe("external KiCad QA contract", () => {
  it("plans exact version and schematic-PDF commands for Motor and Power", () => {
    const plan = planExternalKicadQaV1({
      executable: "/opt/kicad/bin/kicad-cli",
      outputDirectory: "/tmp/schemagic-external-kicad-qa",
    });

    expect(plan.versionCommand.args).toEqual(["version"]);
    expect(plan.fixtures.map((fixture) => [fixture.fixtureId, fixture.application])).toEqual([
      ["motor-integrated-v2", "motor.brushed-dc"],
      ["power-integrated-v2", "power.buck"],
    ]);
    for (const fixture of plan.fixtures) {
      expect(fixture.command.args).toEqual([
        "sch",
        "export",
        "pdf",
        "--output",
        fixture.outputPath,
        fixture.inputPath,
      ]);
      expect(fixture.command.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    expect(() => planExternalKicadQaV1({ executable: "kicad-cli", outputDirectory: "relative" }))
      .toThrowError(expect.objectContaining({ code: "invalid_plan" }));
  });

  it("binds written input bytes, fake executable receipts, and PDF outputs in a strict report", () => {
    const plan = planExternalKicadQaV1({
      executable: "/opt/kicad/bin/kicad-cli",
      outputDirectory: "/tmp/schemagic-external-kicad-qa",
    });
    const fake = fakeExecution();
    const report = runExternalKicadQaV1(plan, artifacts, fake.run, fake.io);
    const serialized = serializeExternalKicadQaReportV1(report);
    const parsed = parseExternalKicadQaReportV1(serialized);

    expect(fake.calls).toHaveLength(3);
    expect(parsed.status).toBe("passed");
    expect(parsed.kicad.version).toMatchObject({ raw: "8.0.6", major: 8, minor: 0, patch: 6 });
    expect(parsed.fixtures.map((fixture) => fixture.output.mediaType)).toEqual([
      "application/pdf",
      "application/pdf",
    ]);
    expect(parsed.fixtures.every((fixture) => fixture.input.contentHash.startsWith("sha256:"))).toBe(true);
    expect(parsed.scope).toEqual({
      proof: "external_kicad_cli_parse_and_pdf_export",
      attestation: "none",
      cliParseAndPdfExportSucceeded: true,
      interactiveOpenSaveWithoutRepairClaim: "unverified",
      internalParserUsedAsExternalProof: false,
      productionProfileClaim: "none",
      simulationFidelityClaim: "none",
      footprintVerificationClaim: "none",
    });
    expect(Object.isFrozen(parsed.fixtures)).toBe(true);

    const tampered = JSON.parse(serialized) as { fixtures: Array<{ output: { contentHash: string } }> };
    tampered.fixtures[0]!.output.contentHash = HASH_A;
    expect(() => parseExternalKicadQaReportV1(tampered))
      .toThrowError(expect.objectContaining({ code: "invalid_report" }));

    const forgedAttestation = JSON.parse(serialized) as { scope: { attestation: string } };
    forgedAttestation.scope.attestation = "independent";
    expect(() => parseExternalKicadQaReportV1(forgedAttestation))
      .toThrowError(expect.objectContaining({ code: "invalid_report" }));
  });

  it("fails before export when exact written schematic bytes cannot be read back", () => {
    const plan = planExternalKicadQaV1({
      executable: "kicad-cli",
      outputDirectory: "/tmp/schemagic-external-kicad-qa",
    });
    const fake = fakeExecution();
    expect(() => runExternalKicadQaV1(plan, artifacts, fake.run, {
      ...fake.io,
      readInput: () => new TextEncoder().encode("tampered"),
    })).toThrowError(expect.objectContaining({ code: "kicad_input_unverified" }));
    expect(fake.calls).toHaveLength(1);

    const changedDuringExecution = fakeExecution();
    const mutatingRunner: ExternalKicadQaCommandRunnerV1 = (command) => {
      const result = changedDuringExecution.run(command);
      if (command.args[0] === "sch") {
        const inputPath = command.args.at(-1)!;
        changedDuringExecution.files.set(inputPath, new TextEncoder().encode("changed by executable"));
      }
      return result;
    };
    expect(() => runExternalKicadQaV1(plan, artifacts, mutatingRunner, changedDuringExecution.io))
      .toThrowError(expect.objectContaining({ code: "kicad_input_unverified" }));
    expect(changedDuringExecution.calls).toHaveLength(2);
  });

  it("keeps missing and unsupported external executables as hard failures", () => {
    const plan = planExternalKicadQaV1({
      executable: "kicad-cli",
      outputDirectory: "/tmp/schemagic-external-kicad-qa",
    });
    const fake = fakeExecution();
    expect(() => runExternalKicadQaV1(plan, artifacts, () => ({
      exitCode: null,
      stdout: "",
      stderr: "",
      errorCode: "ENOENT",
    }), fake.io)).toThrowError(expect.objectContaining({ code: "kicad_cli_unavailable" }));
    expect(() => parseExternalKicadCliVersionV1("7.0.11"))
      .toThrowError(expect.objectContaining({ code: "unsupported_kicad_version" }));
    expect(new ExternalKicadQaErrorV1("kicad_cli_unavailable", "missing").code)
      .toBe("kicad_cli_unavailable");
  });

  it("regenerates deterministic exact-context synthetic V2 Motor and Power inputs without invoking KiCad", () => {
    const first = buildExternalKicadQaArtifactsV1();
    const second = buildExternalKicadQaArtifactsV1();
    expect(second).toEqual(first);
    expect(first.map((fixture) => [fixture.fixtureId, fixture.application])).toEqual([
      ["motor-integrated-v2", "motor.brushed-dc"],
      ["power-integrated-v2", "power.buck"],
    ]);
    expect(first.every((fixture) => fixture.schematic.startsWith("(kicad_sch\n"))).toBe(true);
    expect(first.every((fixture) => fixture.schematic.includes('(paper "User" '))).toBe(true);
    expect(first.every((fixture) => !/\(paper [0-9]/u.test(fixture.schematic))).toBe(true);
    expect(first.every((fixture) => fixture.schematic.includes("External KiCad open verification: UNVERIFIED"))).toBe(true);
    expect(first.every((fixture) => /^sha256:[0-9a-f]{64}$/u.test(fixture.designResultContentHash))).toBe(true);
    expect(first.every((fixture) => /^sha256:[0-9a-f]{64}$/u.test(fixture.engineeringContextContentHash))).toBe(true);
  }, 15_000);
});
