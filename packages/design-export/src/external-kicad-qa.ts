import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join } from "node:path";
import { canonicalDesignV2Payload } from "@opencircuit/design-schema";

export const EXTERNAL_KICAD_QA_FORMAT = "schemagic-external-kicad-qa-report" as const;
export const EXTERNAL_KICAD_QA_SCHEMA_VERSION = 1 as const;

export type ExternalKicadQaFixtureIdV1 = "motor-integrated-v2" | "power-integrated-v2";
export type ExternalKicadQaApplicationV1 = "motor.brushed-dc" | "power.buck";
export type ExternalKicadQaHashV1 = `sha256:${string}`;

export interface ExternalKicadQaArtifactV1 {
  fixtureId: ExternalKicadQaFixtureIdV1;
  application: ExternalKicadQaApplicationV1;
  candidateId: string;
  circuitId: string;
  designResultContentHash: ExternalKicadQaHashV1;
  engineeringContextContentHash: ExternalKicadQaHashV1;
  schematic: string;
}

export interface ExternalKicadQaCommandV1 {
  executable: string;
  args: string[];
  contentHash: ExternalKicadQaHashV1;
}

export interface ExternalKicadQaPlanFixtureV1 {
  fixtureId: ExternalKicadQaFixtureIdV1;
  application: ExternalKicadQaApplicationV1;
  inputPath: string;
  outputPath: string;
  command: ExternalKicadQaCommandV1;
}

export interface ExternalKicadQaPlanV1 {
  executable: string;
  outputDirectory: string;
  versionCommand: ExternalKicadQaCommandV1;
  fixtures: ExternalKicadQaPlanFixtureV1[];
}

export interface ExternalKicadQaProcessResultV1 {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
}

export type ExternalKicadQaCommandRunnerV1 = (
  command: Readonly<ExternalKicadQaCommandV1>,
) => ExternalKicadQaProcessResultV1;

export interface ExternalKicadQaIoV1 {
  writeInput: (path: string, bytes: Uint8Array) => void;
  readInput: (path: string) => Uint8Array;
  readOutput: (path: string) => Uint8Array;
}

export interface ExternalKicadQaReportV1 {
  format: typeof EXTERNAL_KICAD_QA_FORMAT;
  schemaVersion: typeof EXTERNAL_KICAD_QA_SCHEMA_VERSION;
  status: "passed";
  scope: {
    proof: "external_kicad_cli_parse_and_pdf_export";
    attestation: "none";
    cliParseAndPdfExportSucceeded: true;
    interactiveOpenSaveWithoutRepairClaim: "unverified";
    internalParserUsedAsExternalProof: false;
    productionProfileClaim: "none";
    simulationFidelityClaim: "none";
    footprintVerificationClaim: "none";
  };
  kicad: {
    executable: string;
    version: {
      raw: string;
      major: number;
      minor: number;
      patch: number | null;
      contentHash: ExternalKicadQaHashV1;
    };
    command: ExternalKicadQaCommandV1 & {
      exitCode: 0;
      stdoutContentHash: ExternalKicadQaHashV1;
      stderrContentHash: ExternalKicadQaHashV1;
    };
  };
  fixtures: Array<{
    fixtureId: ExternalKicadQaFixtureIdV1;
    application: ExternalKicadQaApplicationV1;
    candidateId: string;
    circuitId: string;
    designResultContentHash: ExternalKicadQaHashV1;
    engineeringContextContentHash: ExternalKicadQaHashV1;
    input: {
      path: string;
      byteLength: number;
      contentHash: ExternalKicadQaHashV1;
    };
    output: {
      path: string;
      byteLength: number;
      contentHash: ExternalKicadQaHashV1;
      mediaType: "application/pdf";
    };
    command: ExternalKicadQaCommandV1 & {
      exitCode: 0;
      stdoutContentHash: ExternalKicadQaHashV1;
      stderrContentHash: ExternalKicadQaHashV1;
    };
  }>;
  contentHash: ExternalKicadQaHashV1;
}

export type ExternalKicadQaErrorCodeV1 =
  | "invalid_plan"
  | "invalid_artifact_set"
  | "kicad_cli_unavailable"
  | "unsupported_kicad_version"
  | "kicad_input_unverified"
  | "kicad_export_failed"
  | "kicad_output_missing"
  | "invalid_report";

export class ExternalKicadQaErrorV1 extends Error {
  readonly code: ExternalKicadQaErrorCodeV1;

  constructor(code: ExternalKicadQaErrorCodeV1, message: string) {
    super(message);
    this.name = "ExternalKicadQaErrorV1";
    this.code = code;
  }
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const SUPPORTED_KICAD_MAJORS = new Set([8, 9, 10]);
const FIXTURES = Object.freeze([
  { fixtureId: "motor-integrated-v2", application: "motor.brushed-dc" },
  { fixtureId: "power-integrated-v2", application: "power.buck" },
] as const);

function sha256(bytes: string | Uint8Array): ExternalKicadQaHashV1 {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function command(executable: string, args: string[]): ExternalKicadQaCommandV1 {
  const payload = { executable, args };
  return { ...payload, contentHash: sha256(canonicalDesignV2Payload(payload)) };
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function validHash(value: unknown): value is ExternalKicadQaHashV1 {
  return typeof value === "string" && HASH.test(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

export function parseExternalKicadCliVersionV1(rawInput: string): Readonly<{
  raw: string;
  major: number;
  minor: number;
  patch: number | null;
  contentHash: ExternalKicadQaHashV1;
}> {
  const raw = rawInput.trim();
  const match = raw.match(/(?:^|\s)([0-9]+)\.([0-9]+)(?:\.([0-9]+))?(?:[-+\s]|$)/u);
  if (!validText(raw) || match === null) {
    throw new ExternalKicadQaErrorV1("unsupported_kicad_version", "kicad-cli returned an unrecognized version");
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = match[3] === undefined ? null : Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)
    || (patch !== null && !Number.isSafeInteger(patch))
    || !SUPPORTED_KICAD_MAJORS.has(major)) {
    throw new ExternalKicadQaErrorV1(
      "unsupported_kicad_version",
      "external KiCad verification supports kicad-cli major versions 8, 9, and 10",
    );
  }
  return freezeDeep({ raw, major, minor, patch, contentHash: sha256(raw) });
}

export function planExternalKicadQaV1(options: Readonly<{
  executable: string;
  outputDirectory: string;
}>): Readonly<ExternalKicadQaPlanV1> {
  if (!validText(options.executable) || !isAbsolute(options.outputDirectory)) {
    throw new ExternalKicadQaErrorV1("invalid_plan", "executable must be non-empty and outputDirectory must be absolute");
  }
  const versionCommand = command(options.executable, ["version"]);
  const fixtures = FIXTURES.map(({ fixtureId, application }) => {
    const inputPath = join(options.outputDirectory, `${fixtureId}.kicad_sch`);
    const outputPath = join(options.outputDirectory, `${fixtureId}.pdf`);
    return {
      fixtureId,
      application,
      inputPath,
      outputPath,
      command: command(options.executable, ["sch", "export", "pdf", "--output", outputPath, inputPath]),
    };
  });
  return freezeDeep({
    executable: options.executable,
    outputDirectory: options.outputDirectory,
    versionCommand,
    fixtures,
  });
}

function execution(commandPlan: Readonly<ExternalKicadQaCommandV1>, result: Readonly<ExternalKicadQaProcessResultV1>) {
  return {
    ...commandPlan,
    exitCode: 0 as const,
    stdoutContentHash: sha256(result.stdout),
    stderrContentHash: sha256(result.stderr),
  };
}

export function runExternalKicadQaV1(
  plan: Readonly<ExternalKicadQaPlanV1>,
  artifactsInput: readonly Readonly<ExternalKicadQaArtifactV1>[],
  runCommand: ExternalKicadQaCommandRunnerV1,
  io: Readonly<ExternalKicadQaIoV1>,
): Readonly<ExternalKicadQaReportV1> {
  const expectedPlan = planExternalKicadQaV1({ executable: plan.executable, outputDirectory: plan.outputDirectory });
  if (canonicalDesignV2Payload(plan) !== canonicalDesignV2Payload(expectedPlan)) {
    throw new ExternalKicadQaErrorV1("invalid_plan", "external KiCad command plan is not canonical");
  }
  if (artifactsInput.length !== FIXTURES.length) {
    throw new ExternalKicadQaErrorV1("invalid_artifact_set", "exactly one Motor and one Power fixture are required");
  }
  const artifacts = new Map(artifactsInput.map((artifact) => [artifact.fixtureId, artifact]));
  for (const expected of FIXTURES) {
    const artifact = artifacts.get(expected.fixtureId);
    if (artifact === undefined || artifact.application !== expected.application
      || !validText(artifact.candidateId) || !validText(artifact.circuitId)
      || !validHash(artifact.designResultContentHash)
      || !validHash(artifact.engineeringContextContentHash)
      || typeof artifact.schematic !== "string" || artifact.schematic.length === 0) {
      throw new ExternalKicadQaErrorV1("invalid_artifact_set", `${expected.fixtureId} artifact is missing or invalid`);
    }
  }

  const versionResult = runCommand(plan.versionCommand);
  if (versionResult.exitCode !== 0) {
    const detail = versionResult.errorCode === undefined ? "" : ` (${versionResult.errorCode})`;
    throw new ExternalKicadQaErrorV1("kicad_cli_unavailable", `kicad-cli version command failed${detail}`);
  }
  const version = parseExternalKicadCliVersionV1(`${versionResult.stdout}\n${versionResult.stderr}`);

  const fixtures = plan.fixtures.map((fixturePlan) => {
    const artifact = artifacts.get(fixturePlan.fixtureId)!;
    const inputBytes = new TextEncoder().encode(artifact.schematic);
    let writtenInput: Uint8Array;
    try {
      io.writeInput(fixturePlan.inputPath, inputBytes);
      writtenInput = io.readInput(fixturePlan.inputPath);
    } catch {
      throw new ExternalKicadQaErrorV1(
        "kicad_input_unverified",
        `${fixturePlan.fixtureId}: exact schematic bytes could not be written and read back`,
      );
    }
    const expectedInputHash = sha256(inputBytes);
    if (writtenInput.byteLength !== inputBytes.byteLength || sha256(writtenInput) !== expectedInputHash) {
      throw new ExternalKicadQaErrorV1(
        "kicad_input_unverified",
        `${fixturePlan.fixtureId}: written schematic bytes differ from the exact regenerated artifact`,
      );
    }
    const result = runCommand(fixturePlan.command);
    if (result.exitCode !== 0) {
      throw new ExternalKicadQaErrorV1(
        "kicad_export_failed",
        `${fixturePlan.fixtureId}: kicad-cli schematic PDF export failed`,
      );
    }
    let output: Uint8Array;
    try {
      const afterExecutionInput = io.readInput(fixturePlan.inputPath);
      if (afterExecutionInput.byteLength !== inputBytes.byteLength || sha256(afterExecutionInput) !== expectedInputHash) {
        throw new ExternalKicadQaErrorV1(
          "kicad_input_unverified",
          `${fixturePlan.fixtureId}: kicad-cli changed the input schematic`,
        );
      }
      output = io.readOutput(fixturePlan.outputPath);
    } catch (error) {
      if (error instanceof ExternalKicadQaErrorV1) throw error;
      throw new ExternalKicadQaErrorV1(
        "kicad_output_missing",
        `${fixturePlan.fixtureId}: kicad-cli did not create the requested PDF`,
      );
    }
    if (output.byteLength < 8 || new TextDecoder().decode(output.slice(0, 5)) !== "%PDF-") {
      throw new ExternalKicadQaErrorV1(
        "kicad_output_missing",
        `${fixturePlan.fixtureId}: kicad-cli output is not a non-empty PDF`,
      );
    }
    return {
      fixtureId: artifact.fixtureId,
      application: artifact.application,
      candidateId: artifact.candidateId,
      circuitId: artifact.circuitId,
      designResultContentHash: artifact.designResultContentHash,
      engineeringContextContentHash: artifact.engineeringContextContentHash,
      input: {
        path: fixturePlan.inputPath,
        byteLength: inputBytes.byteLength,
        contentHash: expectedInputHash,
      },
      output: {
        path: fixturePlan.outputPath,
        byteLength: output.byteLength,
        contentHash: sha256(output),
        mediaType: "application/pdf" as const,
      },
      command: execution(fixturePlan.command, result),
    };
  });
  const payload = {
    format: EXTERNAL_KICAD_QA_FORMAT,
    schemaVersion: EXTERNAL_KICAD_QA_SCHEMA_VERSION,
    status: "passed" as const,
    scope: {
      proof: "external_kicad_cli_parse_and_pdf_export" as const,
      attestation: "none" as const,
      cliParseAndPdfExportSucceeded: true as const,
      interactiveOpenSaveWithoutRepairClaim: "unverified" as const,
      internalParserUsedAsExternalProof: false as const,
      productionProfileClaim: "none" as const,
      simulationFidelityClaim: "none" as const,
      footprintVerificationClaim: "none" as const,
    },
    kicad: {
      executable: plan.executable,
      version,
      command: execution(plan.versionCommand, versionResult),
    },
    fixtures,
  };
  return freezeDeep({ ...payload, contentHash: sha256(canonicalDesignV2Payload(payload)) });
}

function parseCommand(value: unknown): ExternalKicadQaReportV1["kicad"]["command"] | undefined {
  const item = record(value);
  if (item === undefined || !exactKeys(item, [
    "executable", "args", "contentHash", "exitCode", "stdoutContentHash", "stderrContentHash",
  ]) || !validText(item.executable) || !Array.isArray(item.args)
    || item.args.some((arg) => !validText(arg)) || !validHash(item.contentHash)
    || item.exitCode !== 0 || !validHash(item.stdoutContentHash) || !validHash(item.stderrContentHash)) return undefined;
  const expected = command(item.executable, item.args as string[]);
  if (item.contentHash !== expected.contentHash) return undefined;
  return item as unknown as ExternalKicadQaReportV1["kicad"]["command"];
}

export function parseExternalKicadQaReportV1(input: unknown): Readonly<ExternalKicadQaReportV1> {
  try {
    const decoded = typeof input === "string" ? JSON.parse(input) as unknown : structuredClone(input);
    const report = record(decoded);
    if (report === undefined || !exactKeys(report, [
      "format", "schemaVersion", "status", "scope", "kicad", "fixtures", "contentHash",
    ]) || report.format !== EXTERNAL_KICAD_QA_FORMAT || report.schemaVersion !== EXTERNAL_KICAD_QA_SCHEMA_VERSION
      || report.status !== "passed" || !validHash(report.contentHash)) throw new TypeError("report envelope");
    const scope = record(report.scope);
    if (scope === undefined || !exactKeys(scope, [
      "proof", "attestation", "cliParseAndPdfExportSucceeded", "interactiveOpenSaveWithoutRepairClaim",
      "internalParserUsedAsExternalProof", "productionProfileClaim", "simulationFidelityClaim",
      "footprintVerificationClaim",
    ]) || scope.proof !== "external_kicad_cli_parse_and_pdf_export" || scope.attestation !== "none"
      || scope.cliParseAndPdfExportSucceeded !== true
      || scope.interactiveOpenSaveWithoutRepairClaim !== "unverified"
      || scope.internalParserUsedAsExternalProof !== false || scope.productionProfileClaim !== "none"
      || scope.simulationFidelityClaim !== "none" || scope.footprintVerificationClaim !== "none") {
      throw new TypeError("scope");
    }
    const kicad = record(report.kicad);
    const version = record(kicad?.version);
    const versionCommand = parseCommand(kicad?.command);
    if (kicad === undefined || !exactKeys(kicad, ["executable", "version", "command"])
      || !validText(kicad.executable) || version === undefined || !exactKeys(version, [
        "raw", "major", "minor", "patch", "contentHash",
      ]) || !validText(version.raw) || !validHash(version.contentHash) || version.contentHash !== sha256(version.raw)
      || versionCommand === undefined || versionCommand.executable !== kicad.executable
      || canonicalDesignV2Payload(versionCommand.args) !== canonicalDesignV2Payload(["version"])
      || canonicalDesignV2Payload(parseExternalKicadCliVersionV1(version.raw)) !== canonicalDesignV2Payload(version)) {
      throw new TypeError("kicad");
    }
    if (!Array.isArray(report.fixtures) || report.fixtures.length !== FIXTURES.length) throw new TypeError("fixtures");
    const seen = new Set<string>();
    for (const fixtureInput of report.fixtures) {
      const fixture = record(fixtureInput);
      const inputArtifact = record(fixture?.input);
      const outputArtifact = record(fixture?.output);
      const fixtureCommand = parseCommand(fixture?.command);
      const expected = FIXTURES.find((entry) => entry.fixtureId === fixture?.fixtureId);
      if (fixture === undefined || !exactKeys(fixture, [
        "fixtureId", "application", "candidateId", "circuitId", "designResultContentHash",
        "engineeringContextContentHash", "input", "output", "command",
      ]) || expected === undefined || fixture.application !== expected.application || seen.has(expected.fixtureId)
        || !validText(fixture.candidateId) || !validText(fixture.circuitId)
        || !validHash(fixture.designResultContentHash) || !validHash(fixture.engineeringContextContentHash)
        || inputArtifact === undefined || !exactKeys(inputArtifact, ["path", "byteLength", "contentHash"])
        || !isAbsolute(String(inputArtifact.path)) || !Number.isSafeInteger(inputArtifact.byteLength)
        || Number(inputArtifact.byteLength) <= 0 || !validHash(inputArtifact.contentHash)
        || outputArtifact === undefined || !exactKeys(outputArtifact, ["path", "byteLength", "contentHash", "mediaType"])
        || !isAbsolute(String(outputArtifact.path)) || !Number.isSafeInteger(outputArtifact.byteLength)
        || Number(outputArtifact.byteLength) <= 0 || !validHash(outputArtifact.contentHash)
        || outputArtifact.mediaType !== "application/pdf" || fixtureCommand === undefined
        || fixtureCommand.executable !== kicad.executable
        || dirname(String(inputArtifact.path)) !== dirname(String(outputArtifact.path))
        || basename(String(inputArtifact.path)) !== `${expected.fixtureId}.kicad_sch`
        || basename(String(outputArtifact.path)) !== `${expected.fixtureId}.pdf`
        || canonicalDesignV2Payload(fixtureCommand.args) !== canonicalDesignV2Payload([
          "sch", "export", "pdf", "--output", outputArtifact.path, inputArtifact.path,
        ])) throw new TypeError("fixture");
      seen.add(expected.fixtureId);
    }
    const { contentHash: _contentHash, ...payload } = report;
    if (report.contentHash !== sha256(canonicalDesignV2Payload(payload))) throw new TypeError("content hash");
    return freezeDeep(report as unknown as ExternalKicadQaReportV1);
  } catch (error) {
    if (error instanceof ExternalKicadQaErrorV1 && error.code === "invalid_report") throw error;
    throw new ExternalKicadQaErrorV1("invalid_report", "external KiCad QA report is invalid");
  }
}

export function serializeExternalKicadQaReportV1(report: Readonly<ExternalKicadQaReportV1>): string {
  const parsed = parseExternalKicadQaReportV1(report);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}
