import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createDesignerRuntimeReportV1,
  parseDesignerRuntimeContractV1,
  type DesignerRuntimeReportV1,
} from "../src/designer-runtime-audit";
import {
  calculateDesignerRuntimeReleaseReceiptContentHashV1,
  createDesignerRuntimeReleaseReceiptV1,
  parseDesignerRuntimeReleaseReceiptV1,
  type DesignerRuntimeReleaseContextV1,
  type DesignerRuntimeReleaseReceiptV1,
} from "../src/designer-runtime-release-receipt";
import { buildDesignerReleaseReadinessReportV1 } from "../src/index";

const contract = parseDesignerRuntimeContractV1(JSON.parse(readFileSync(
  new URL("../../../apps/web/designer-runtime-contract.json", import.meta.url),
  "utf8",
)));

const githubActions: DesignerRuntimeReleaseContextV1 = {
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

function reportPayload(browserVersion = "fixture-chromium-A"): Omit<DesignerRuntimeReportV1, "contentHash"> {
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
  const motor = {
    ...commonMeasurement("motor.integrated-12v", "a"),
    application: "motor.brushed-dc" as const,
    completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled" as const,
    candidateId: `candidate:v2:sha256:${"a".repeat(64)}` as const,
    previewContentHash: `sha256:${"a".repeat(64)}` as const,
  };
  const power = {
    ...commonMeasurement("power.integrated-12v-low-current", "b"),
    application: "power.buck" as const,
    completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled" as const,
    candidateId: `candidate:v2:sha256:${"b".repeat(64)}` as const,
    constraintDecisionContentHash: `sha256:${"d".repeat(64)}` as const,
    candidateEligible: false as const,
    previewContentHash: `sha256:${"e".repeat(64)}` as const,
  };
  return {
    format: "schemagic-designer-runtime-report",
    schemaVersion: 1,
    contract: { version: contract.version, contentHash: contract.contentHash },
    productionArtifactSetHash: `sha256:${"c".repeat(64)}`,
    environment: {
      scope: contract.scope,
      browser: "chromium",
      browserVersion,
      platform: "fixture-platform",
      architecture: "fixture-architecture",
    },
    measurements: {
      routeInteractiveUs: 50_000,
      applications: [motor, power],
    },
    boundaries: structuredClone(contract.boundaries),
  };
}

function exactReportBytes(browserVersion?: string): Uint8Array {
  const report = createDesignerRuntimeReportV1(reportPayload(browserVersion), contract);
  return new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`);
}

function rehash(receipt: DesignerRuntimeReleaseReceiptV1): DesignerRuntimeReleaseReceiptV1 {
  const mutable = receipt as unknown as Record<string, unknown>;
  mutable.contentHash = calculateDesignerRuntimeReleaseReceiptContentHashV1(receipt);
  return receipt;
}

describe("Designer runtime release attachment receipt V1", () => {
  it("round-trips a deeply frozen receipt bound to the exact report bytes and CI context", () => {
    const reportBytes = exactReportBytes();
    const receipt = createDesignerRuntimeReleaseReceiptV1(reportBytes, contract, githubActions);
    const parsed = parseDesignerRuntimeReleaseReceiptV1(
      structuredClone(receipt),
      reportBytes,
      contract,
      structuredClone(githubActions),
    );

    expect(parsed).toEqual(receipt);
    expect(receipt.report.byteLength).toBe(reportBytes.byteLength);
    expect(receipt.report.fileContentHash).toBe(
      `sha256:${createHash("sha256").update(reportBytes).digest("hex")}`,
    );
    expect(receipt.proofScope).toBe("environment_bound_budget_pass_byte_association");
    expect(receipt.ciAssociation).toBe("self_reported_github_actions_context");
    expect(receipt.attestation).toBe("none");
    expect(receipt.claims).toEqual({
      deployed: "not_claimed",
      crossBrowser: "not_claimed",
      wholeProcessMemory: "not_claimed",
      provider: "not_claimed",
      simulationFidelity: "not_claimed",
    });
    expect(receipt.contentHash).toBe(calculateDesignerRuntimeReleaseReceiptContentHashV1(receipt));
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.report)).toBe(true);
    expect(Object.isFrozen(receipt.githubActions)).toBe(true);
    expect(Object.isFrozen(receipt.claims)).toBe(true);
  });

  it("rejects extra keys, exact-byte tampering, embedded identity drift, and expected-context drift", () => {
    const reportBytes = exactReportBytes();
    const receipt = createDesignerRuntimeReleaseReceiptV1(reportBytes, contract, githubActions);

    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      { ...structuredClone(receipt), unexpected: true },
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt:invalid_keys");

    const sameReportDifferentBytes = Uint8Array.from(reportBytes);
    sameReportDifferentBytes[sameReportDifferentBytes.byteLength - 1] = 0x20;
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      receipt,
      sameReportDifferentBytes,
      contract,
      githubActions,
    )).toThrowError("file_content_hash_mismatch");

    const reportContentDrift = structuredClone(receipt);
    reportContentDrift.report.contentHash = `sha256:${"d".repeat(64)}`;
    rehash(reportContentDrift);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      reportContentDrift,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt/report:content_hash_mismatch");

    const artifactSetDrift = structuredClone(receipt);
    artifactSetDrift.report.productionArtifactSetHash = `sha256:${"d".repeat(64)}`;
    rehash(artifactSetDrift);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      artifactSetDrift,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("production_artifact_set_hash_mismatch");

    const contractDrift = structuredClone(receipt);
    contractDrift.contract.version = `${contract.version}-forged`;
    rehash(contractDrift);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      contractDrift,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt/contract:contract_mismatch");

    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      receipt,
      reportBytes,
      contract,
      { ...githubActions, artifactName: "different-artifact" },
    )).toThrowError("receipt/githubActions:context_mismatch");

    const receiptContextDrift = structuredClone(receipt);
    receiptContextDrift.githubActions.sourceRevision = "b".repeat(40);
    rehash(receiptContextDrift);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      receiptContextDrift,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt/githubActions:context_mismatch");
  });

  it("rejects non-dispatch or malformed CI context and invalid report bytes", () => {
    const reportBytes = exactReportBytes();
    for (const invalidContext of [
      { ...githubActions, event: "push" },
      { ...githubActions, sourceRevision: "a".repeat(39) },
      { ...githubActions, workflowRevision: "b".repeat(39) },
      { ...githubActions, runId: "01" },
      { ...githubActions, runAttempt: 0 },
      { ...githubActions, artifactName: "x".repeat(129) },
      { ...githubActions, unexpected: true },
    ]) {
      expect(() => createDesignerRuntimeReleaseReceiptV1(reportBytes, contract, invalidContext)).toThrowError();
    }
    expect(() => createDesignerRuntimeReleaseReceiptV1(new Uint8Array(), contract, githubActions))
      .toThrowError("reportBytes:invalid_bytes");
    expect(() => createDesignerRuntimeReleaseReceiptV1(new Uint8Array([0xff]), contract, githubActions))
      .toThrowError("reportBytes:invalid_utf8");
    expect(() => createDesignerRuntimeReleaseReceiptV1(new TextEncoder().encode("{}"), contract, githubActions))
      .toThrowError("report:invalid_keys");
  });

  it("rejects forged claim scope, attestation, and canonical receipt hash", () => {
    const reportBytes = exactReportBytes();
    const receipt = createDesignerRuntimeReleaseReceiptV1(reportBytes, contract, githubActions);

    const forgedAttestation = structuredClone(receipt) as any;
    forgedAttestation.attestation = "independent";
    rehash(forgedAttestation);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      forgedAttestation,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt/attestation:invalid_value");

    for (const claim of ["deployed", "crossBrowser", "wholeProcessMemory", "provider", "simulationFidelity"]) {
      const forgedClaim = structuredClone(receipt) as any;
      forgedClaim.claims[claim] = "verified";
      rehash(forgedClaim);
      expect(() => parseDesignerRuntimeReleaseReceiptV1(
        forgedClaim,
        reportBytes,
        contract,
        githubActions,
      )).toThrowError(`receipt/claims/${claim}:invalid_value`);
    }

    const forgedScope = structuredClone(receipt) as any;
    forgedScope.proofScope = "deployed_release";
    rehash(forgedScope);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      forgedScope,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt/proofScope:invalid_value");

    const forgedAssociation = structuredClone(receipt) as any;
    forgedAssociation.ciAssociation = "independently_attested";
    rehash(forgedAssociation);
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      forgedAssociation,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt/ciAssociation:invalid_value");

    const hashDrift = structuredClone(receipt);
    hashDrift.contentHash = `sha256:${"f".repeat(64)}`;
    expect(() => parseDesignerRuntimeReleaseReceiptV1(
      hashDrift,
      reportBytes,
      contract,
      githubActions,
    )).toThrowError("receipt:content_hash_mismatch");
  });

  it("keeps runtime release blocked when bytes are associated to caller-supplied context without attestation", () => {
    const reportBytes = exactReportBytes();
    const receipt = createDesignerRuntimeReleaseReceiptV1(reportBytes, contract, githubActions);
    const baseline = buildDesignerReleaseReadinessReportV1();
    const attached = buildDesignerReleaseReadinessReportV1({
      runtimeReleaseAttachment: {
        reportBytes,
        receipt,
        expectedGithubActionsContext: githubActions,
      },
    });
    const baselineGate = baseline.gates.find((gate) => gate.id === "release.reproducible-verification")!;
    const attachedGate = attached.gates.find((gate) => gate.id === "release.reproducible-verification")!;
    expect(baselineGate.blockers).toContain("runtime_performance_and_memory_release_report_unattached");
    expect(attachedGate.blockers).not.toContain("runtime_performance_and_memory_release_report_unattached");
    expect(attachedGate.blockers).toContain(
      "runtime_performance_and_memory_release_artifact_attestation_unverified",
    );
    expect(attachedGate.blockers).toEqual(baselineGate.blockers.map((blocker) => (
      blocker === "runtime_performance_and_memory_release_report_unattached"
        ? "runtime_performance_and_memory_release_artifact_attestation_unverified"
        : blocker
    )));
    expect(attachedGate.evidence).toMatchObject({
      runtimePerformanceMemoryReleaseReportAssociated: true,
      runtimePerformanceMemoryReleaseArtifactAttested: false,
      runtimePerformanceMemoryReleaseAttachment: {
        validation: "associated_unattested",
        receiptContentHash: receipt.contentHash,
        reportContentHash: receipt.report.contentHash,
        reportFileContentHash: receipt.report.fileContentHash,
        productionArtifactSetHash: receipt.report.productionArtifactSetHash,
        githubActions,
        attestation: "none",
        claims: {
          deployed: "not_claimed",
          crossBrowser: "not_claimed",
          wholeProcessMemory: "not_claimed",
          provider: "not_claimed",
          simulationFidelity: "not_claimed",
        },
      },
    });
    expect(attached.status).toBe("blocked");

    const invalid = buildDesignerReleaseReadinessReportV1({
      runtimeReleaseAttachment: {
        reportBytes,
        receipt,
        expectedGithubActionsContext: { ...githubActions, runAttempt: 3 },
      },
    });
    const invalidGate = invalid.gates.find((gate) => gate.id === "release.reproducible-verification")!;
    expect(invalidGate.blockers).toContain("runtime_performance_and_memory_release_attachment_invalid");
    expect(invalidGate.evidence).toMatchObject({
      runtimePerformanceMemoryReleaseReportAssociated: false,
      runtimePerformanceMemoryReleaseArtifactAttested: false,
      runtimePerformanceMemoryReleaseAttachment: {
        validation: "invalid",
        reason: "receipt/githubActions:context_mismatch",
      },
    });
  }, 15_000);
});
