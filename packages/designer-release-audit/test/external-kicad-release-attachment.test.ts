import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildExternalKicadQaArtifactsV1 } from "@opencircuit/design-export/external-kicad-fixtures";
import {
  planExternalKicadQaV1,
  parseExternalKicadQaReportV1,
  runExternalKicadQaV1,
  serializeExternalKicadQaReportV1,
  type ExternalKicadQaArtifactV1,
  type ExternalKicadQaCommandRunnerV1,
} from "@opencircuit/design-export/external-kicad-qa";
import { buildDesignerReleaseReadinessReportV1 } from "../src";
import {
  createDesignerRuntimeReportV1,
  parseDesignerRuntimeContractV1,
  type DesignerRuntimeReportV1,
} from "../src/designer-runtime-audit";
import {
  createDesignerRuntimeReleaseReceiptV1,
  type DesignerRuntimeReleaseContextV1,
} from "../src/designer-runtime-release-receipt";

const encoder = new TextEncoder();
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const releaseAuditCli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const viteNodeCli = fileURLToPath(new URL("../../../node_modules/vite-node/vite-node.mjs", import.meta.url));
const runtimeContract = parseDesignerRuntimeContractV1(JSON.parse(readFileSync(
  new URL("../../../apps/web/designer-runtime-contract.json", import.meta.url),
  "utf8",
)));
const runtimeGithubActions: DesignerRuntimeReleaseContextV1 = {
  repository: "OpenCircuit/opencircuit",
  sourceRevision: "a".repeat(40),
  workflowRevision: "b".repeat(40),
  workflowRef: "OpenCircuit/opencircuit/.github/workflows/designer-runtime-release.yml@refs/heads/main",
  event: "workflow_dispatch",
  job: "designer-runtime-release-audit",
  runId: "123456789012345",
  runAttempt: 2,
  artifactName: "designer-runtime-release-evidence",
};

type ArtifactMutation = (
  artifact: Readonly<ExternalKicadQaArtifactV1>,
) => ExternalKicadQaArtifactV1;

function currentSelfHashedReportBytes(mutateMotor?: ArtifactMutation): Uint8Array {
  const sourceArtifacts = buildExternalKicadQaArtifactsV1();
  const artifacts = sourceArtifacts.map((artifact) => (
    artifact.fixtureId === "motor-integrated-v2" && mutateMotor !== undefined
      ? mutateMotor(artifact)
      : artifact
  ));
  const outputDirectory = join(tmpdir(), "schemagic-external-kicad-release-attachment-test");
  const plan = planExternalKicadQaV1({ executable: "kicad-cli", outputDirectory });
  const files = new Map<string, Uint8Array>();
  const runCommand: ExternalKicadQaCommandRunnerV1 = (command) => {
    if (command.args.length === 1 && command.args[0] === "version") {
      return { exitCode: 0, stdout: "KiCad 9.0.2\n", stderr: "" };
    }
    const outputPath = command.args[4];
    if (outputPath === undefined) throw new Error("Expected an external KiCad PDF output path");
    files.set(outputPath, encoder.encode("%PDF-1.7\n% deterministic test-only bytes\n"));
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const read = (path: string): Uint8Array => {
    const bytes = files.get(path);
    if (bytes === undefined) throw new Error(`Missing in-memory file: ${path}`);
    return new Uint8Array(bytes);
  };
  const report = runExternalKicadQaV1(plan, artifacts, runCommand, {
    writeInput: (path, bytes) => files.set(path, new Uint8Array(bytes)),
    readInput: read,
    readOutput: read,
  });
  return encoder.encode(serializeExternalKicadQaReportV1(report));
}

function currentRuntimeReportBytes(): Uint8Array {
  const commonMeasurement = (presetId: string, token: string) => ({
    presetId,
    requestHash: `sha256:${token.repeat(64)}` as const,
    resultContentHash: `sha256:${token.repeat(64)}` as const,
    generationAndPreviewUs: [100_000, 110_000, 120_000],
    p95Us: 120_000,
    baselineJsHeapBytes: 10_000_000,
    finalJsHeapBytes: 10_500_000,
    maximumJsHeapBytes: 11_000_000,
    retainedJsHeapGrowthBytes: 500_000,
    longTasks: 2,
  });
  const payload: Omit<DesignerRuntimeReportV1, "contentHash"> = {
    format: "schemagic-designer-runtime-report",
    schemaVersion: 1,
    contract: { version: runtimeContract.version, contentHash: runtimeContract.contentHash },
    productionArtifactSetHash: `sha256:${"c".repeat(64)}`,
    environment: {
      scope: runtimeContract.scope,
      browser: "chromium",
      browserVersion: "fixture-chromium-cli",
      platform: "fixture-platform",
      architecture: "fixture-architecture",
    },
    measurements: {
      routeInteractiveUs: 50_000,
      applications: [
        {
          ...commonMeasurement("motor.integrated-12v", "a"),
          application: "motor.brushed-dc",
          completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
          candidateId: `candidate:v2:sha256:${"a".repeat(64)}`,
          previewContentHash: `sha256:${"a".repeat(64)}`,
        },
        {
          ...commonMeasurement("power.integrated-12v-low-current", "b"),
          application: "power.buck",
          completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
          candidateId: `candidate:v2:sha256:${"b".repeat(64)}`,
          constraintDecisionContentHash: `sha256:${"d".repeat(64)}`,
          candidateEligible: false,
          previewContentHash: `sha256:${"e".repeat(64)}`,
        },
      ],
    },
    boundaries: structuredClone(runtimeContract.boundaries),
  };
  const report = createDesignerRuntimeReportV1(payload, runtimeContract);
  return encoder.encode(`${JSON.stringify(report, null, 2)}\n`);
}

function runtimeCliEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GITHUB_REPOSITORY: runtimeGithubActions.repository,
    GITHUB_SHA: runtimeGithubActions.sourceRevision,
    GITHUB_WORKFLOW_SHA: runtimeGithubActions.workflowRevision,
    GITHUB_WORKFLOW_REF: runtimeGithubActions.workflowRef,
    GITHUB_EVENT_NAME: runtimeGithubActions.event,
    GITHUB_JOB: runtimeGithubActions.job,
    GITHUB_RUN_ID: runtimeGithubActions.runId,
    GITHUB_RUN_ATTEMPT: String(runtimeGithubActions.runAttempt),
    DESIGNER_RUNTIME_ARTIFACT_NAME: runtimeGithubActions.artifactName,
  };
}

function runReleaseAuditCli(args: readonly string[], environment: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(process.execPath, [viteNodeCli, releaseAuditCli, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
    timeout: 60_000,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error([
      `Release-audit CLI failed: ${result.error?.message ?? `exit ${String(result.status)}`}`,
      result.stdout,
      result.stderr,
    ].join("\n"));
  }
}

function parsedReleaseReport(path: string): ReturnType<typeof buildDesignerReleaseReadinessReportV1> {
  return JSON.parse(readFileSync(path, "utf8")) as ReturnType<typeof buildDesignerReleaseReadinessReportV1>;
}

function releaseVerificationGate(report: ReturnType<typeof buildDesignerReleaseReadinessReportV1>) {
  const result = report.gates.find((gate) => gate.id === "release.reproducible-verification");
  if (result === undefined) throw new Error("Release verification gate is unavailable");
  return result;
}

function externalContractGate(report: ReturnType<typeof buildDesignerReleaseReadinessReportV1>) {
  const result = report.gates.find((gate) => gate.id === "exports.external-kicad-cli-qa-contract");
  if (result === undefined) throw new Error("External KiCad contract gate is unavailable");
  return result;
}

describe("external KiCad release attachment", () => {
  it("fails closed when no release report is attached", () => {
    const report = buildDesignerReleaseReadinessReportV1();
    const releaseGate = releaseVerificationGate(report);
    expect(report.status).toBe("blocked");
    expect(releaseGate.status).toBe("unverified");
    expect(releaseGate.blockers).toContain("external_kicad_cli_qa_release_report_unattached");
    expect(releaseGate.blockers).toContain("kicad_open_without_repair_unverified");
    expect(releaseGate.evidence).toMatchObject({
      externalKicadCliQaReleaseReportAssociated: false,
      externalKicadCliQaReleaseArtifactAttested: false,
      externalKicadCliQaReleaseAttachment: null,
    });
    expect(externalContractGate(report).evidence).toMatchObject({
      externalReportedExecutionResultAssociated: false,
      externalReleaseArtifactAttested: false,
      externalReleaseAttachment: null,
    });
  });

  it("deterministically associates exact current fixture inputs without promoting attestation", () => {
    const reportBytes = currentSelfHashedReportBytes();
    const parsedExternalReport = parseExternalKicadQaReportV1(
      new TextDecoder("utf-8", { fatal: true }).decode(reportBytes),
    );
    const options = { externalKicadQaReleaseAttachment: { reportBytes } } as const;
    const first = buildDesignerReleaseReadinessReportV1(options);
    const second = buildDesignerReleaseReadinessReportV1(options);
    const releaseGate = releaseVerificationGate(first);
    const contractGate = externalContractGate(first);
    expect(first).toEqual(second);
    expect(first.status).toBe("blocked");
    expect(releaseGate.status).toBe("unverified");
    expect(releaseGate.blockers).toContain("external_kicad_cli_qa_release_artifact_attestation_unverified");
    expect(releaseGate.blockers).toContain("kicad_open_without_repair_unverified");
    expect(releaseGate.blockers).not.toContain("external_kicad_cli_qa_release_report_unattached");
    expect(releaseGate.blockers).not.toContain("external_kicad_cli_qa_release_attachment_invalid");
    expect(releaseGate.evidence).toMatchObject({
      externalKicadCliQaReleaseReportAssociated: true,
      externalKicadCliQaReleaseArtifactAttested: false,
      externalKicadCliQaReleaseAttachment: {
        validation: "current_fixture_input_identity_associated_unattested",
        reportByteLength: reportBytes.byteLength,
        reportedProofScope: "external_kicad_cli_parse_and_pdf_export",
        reportedAttestation: "none",
        boundaries: {
          exactCurrentFixtureInputsRegeneratedAndMatched: true,
          reportSchemaAndSelfHashVerified: true,
          reportedOutputOrPdfBytesVerified: false,
          externalCommandRerunByReleaseAudit: false,
          executionHostAuthenticated: false,
          executionContextAuthenticated: false,
          artifactAttested: false,
          visualQualityVerified: false,
          interactiveOpenSaveWithoutRepairVerified: false,
          footprintVerificationClaim: "none",
          productionProfileClaim: "none",
          simulationFidelityClaim: "none",
        },
      },
    });
    const attachment = releaseGate.evidence.externalKicadCliQaReleaseAttachment as {
      fixtures: Array<Record<string, unknown>>;
      reportContentHash: string;
      reportFileContentHash: string;
    };
    expect(attachment.reportFileContentHash).toBe(
      `sha256:${createHash("sha256").update(reportBytes).digest("hex")}`,
    );
    expect(attachment.reportContentHash).toBe(parsedExternalReport.contentHash);
    expect(attachment.fixtures.map((fixture) => fixture.fixtureId)).toEqual([
      "motor-integrated-v2",
      "power-integrated-v2",
    ]);
    expect(attachment.fixtures.every((fixture) => !("output" in fixture))).toBe(true);
    expect(contractGate).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        externalReportedExecutionResultAssociated: true,
        externalReleaseArtifactAttested: false,
      },
    });
  });

  it("composes the external-only CLI attachment without synthesizing a runtime attachment", () => {
    const directory = mkdtempSync(join(tmpdir(), "schemagic-external-kicad-cli-only-"));
    const externalReportPath = join(directory, "external-kicad-report.json");
    const outputPath = join(directory, "release-readiness.json");
    writeFileSync(externalReportPath, currentSelfHashedReportBytes());
    runReleaseAuditCli([
      "--external-kicad-report", externalReportPath,
      "--output", outputPath,
    ]);
    const report = parsedReleaseReport(outputPath);
    const releaseGate = releaseVerificationGate(report);
    expect(releaseGate.blockers).toContain("external_kicad_cli_qa_release_artifact_attestation_unverified");
    expect(releaseGate.blockers).toContain("runtime_performance_and_memory_release_report_unattached");
    expect(releaseGate.blockers).not.toContain("external_kicad_cli_qa_release_report_unattached");
    expect(releaseGate.evidence).toMatchObject({
      externalKicadCliQaReleaseReportAssociated: true,
      runtimePerformanceMemoryReleaseReportAssociated: false,
    });
    expect(externalContractGate(report).evidence).toMatchObject({
      externalReportedExecutionResultAssociated: true,
      externalReleaseArtifactAttested: false,
    });
  }, 20_000);

  it("composes the complete runtime trio with the external CLI attachment without suppressing either", () => {
    const directory = mkdtempSync(join(tmpdir(), "schemagic-runtime-external-kicad-cli-"));
    const externalReportPath = join(directory, "external-kicad-report.json");
    const runtimeReportPath = join(directory, "runtime-report.json");
    const runtimeReceiptPath = join(directory, "runtime-receipt.json");
    const outputPath = join(directory, "release-readiness.json");
    const runtimeReportBytes = currentRuntimeReportBytes();
    const runtimeReceipt = createDesignerRuntimeReleaseReceiptV1(
      runtimeReportBytes,
      runtimeContract,
      runtimeGithubActions,
    );
    writeFileSync(externalReportPath, currentSelfHashedReportBytes());
    writeFileSync(runtimeReportPath, runtimeReportBytes);
    writeFileSync(runtimeReceiptPath, `${JSON.stringify(runtimeReceipt, null, 2)}\n`, "utf8");
    runReleaseAuditCli([
      "--runtime-report", runtimeReportPath,
      "--runtime-receipt", runtimeReceiptPath,
      "--github-context-from-env",
      "--external-kicad-report", externalReportPath,
      "--output", outputPath,
    ], runtimeCliEnvironment());
    const report = parsedReleaseReport(outputPath);
    const releaseGate = releaseVerificationGate(report);
    expect(releaseGate.blockers).toContain("external_kicad_cli_qa_release_artifact_attestation_unverified");
    expect(releaseGate.blockers).toContain("runtime_performance_and_memory_release_artifact_attestation_unverified");
    expect(releaseGate.blockers).not.toContain("external_kicad_cli_qa_release_report_unattached");
    expect(releaseGate.blockers).not.toContain("runtime_performance_and_memory_release_report_unattached");
    expect(releaseGate.evidence).toMatchObject({
      externalKicadCliQaReleaseReportAssociated: true,
      externalKicadCliQaReleaseArtifactAttested: false,
      runtimePerformanceMemoryReleaseReportAssociated: true,
      runtimePerformanceMemoryReleaseArtifactAttested: false,
    });
    expect(externalContractGate(report).evidence).toMatchObject({
      externalReportedExecutionResultAssociated: true,
      externalReleaseArtifactAttested: false,
    });
  }, 20_000);

  it.each([
    ["invalid UTF-8", Uint8Array.of(0xff)],
    ["invalid closed schema", encoder.encode('{"format":"schemagic-external-kicad-qa-report"}')],
  ])("rejects %s as an invalid release attachment", (_case, reportBytes) => {
    const report = buildDesignerReleaseReadinessReportV1({
      externalKicadQaReleaseAttachment: { reportBytes },
    });
    const releaseGate = releaseVerificationGate(report);
    expect(report.status).toBe("blocked");
    expect(releaseGate.status).toBe("unverified");
    expect(releaseGate.blockers).toContain("external_kicad_cli_qa_release_attachment_invalid");
    expect(releaseGate.blockers).toContain("kicad_open_without_repair_unverified");
    expect(releaseGate.blockers).not.toContain("external_kicad_cli_qa_release_report_unattached");
    expect(releaseGate.evidence).toMatchObject({
      externalKicadCliQaReleaseReportAssociated: false,
      externalKicadCliQaReleaseArtifactAttested: false,
      externalKicadCliQaReleaseAttachment: {
        validation: "invalid",
        reportByteLength: reportBytes.byteLength,
      },
    });
  });

  it.each<readonly [string, ArtifactMutation, string]>([
    [
      "candidate identity",
      (artifact) => ({ ...artifact, candidateId: `${artifact.candidateId}:stale` }),
      "current_fixture_identity_mismatch",
    ],
    [
      "circuit identity",
      (artifact) => ({ ...artifact, circuitId: `${artifact.circuitId}:stale` }),
      "current_fixture_identity_mismatch",
    ],
    [
      "result identity",
      (artifact) => ({ ...artifact, designResultContentHash: `sha256:${"0".repeat(64)}` }),
      "current_fixture_identity_mismatch",
    ],
    [
      "engineering-context identity",
      (artifact) => ({ ...artifact, engineeringContextContentHash: `sha256:${"1".repeat(64)}` }),
      "current_fixture_identity_mismatch",
    ],
    [
      "input schematic bytes",
      (artifact) => ({ ...artifact, schematic: `${artifact.schematic}\n` }),
      "current_fixture_input_bytes_mismatch",
    ],
  ])("rejects self-hashed reports for stale current fixtures: %s", (_case, mutate, expectedReason) => {
    const reportBytes = currentSelfHashedReportBytes(mutate);
    const report = buildDesignerReleaseReadinessReportV1({
      externalKicadQaReleaseAttachment: { reportBytes },
    });
    const releaseGate = releaseVerificationGate(report);
    expect(report.status).toBe("blocked");
    expect(releaseGate.status).toBe("unverified");
    expect(releaseGate.blockers).toContain("external_kicad_cli_qa_release_attachment_invalid");
    expect(releaseGate.blockers).toContain("kicad_open_without_repair_unverified");
    expect(releaseGate.evidence).toMatchObject({
      externalKicadCliQaReleaseReportAssociated: false,
      externalKicadCliQaReleaseArtifactAttested: false,
      externalKicadCliQaReleaseAttachment: {
        validation: "invalid",
        reason: expect.stringContaining(expectedReason),
      },
    });
  });
});
