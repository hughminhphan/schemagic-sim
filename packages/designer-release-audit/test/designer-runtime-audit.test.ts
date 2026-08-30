import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateDesignerRuntimeContractContentHashV1,
  calculateDesignerRuntimeReportContentHashV1,
  createDesignerRuntimeReportV1,
  parseDesignerRuntimeContractV1,
  parseDesignerRuntimeReportV1,
  type DesignerRuntimeReportV1,
} from "../src/designer-runtime-audit";
import {
  assessDesignerRuntimeTimingOrderV1,
  buildDesignerReleaseReadinessReportV1,
} from "../src/index";

const contract = parseDesignerRuntimeContractV1(JSON.parse(readFileSync(
  new URL("../../../apps/web/designer-runtime-contract.json", import.meta.url),
  "utf8",
)));
const runtimeSpecText = readFileSync(
  new URL("../../../apps/web/e2e/designer-runtime.spec.ts", import.meta.url),
  "utf8",
);

const COMPLETION_PUSH = "generationAndPreviewUs.push(Math.round(((await browserNow(page)) - started) * 1000));";

function nthIndex(source: string, token: string, occurrence: number): number {
  let index = -1;
  for (let current = 0; current <= occurrence; current += 1) {
    index = source.indexOf(token, index + 1);
    if (index < 0) throw new Error(`Runtime mutation fixture omitted occurrence ${occurrence} of ${token}`);
  }
  return index;
}

function moveCompletionPushBefore(
  source: string,
  pushOccurrence: number,
  anchor: string,
  anchorOccurrence: number,
): string {
  const pushIndex = nthIndex(source, COMPLETION_PUSH, pushOccurrence);
  const anchorIndex = nthIndex(source, anchor, anchorOccurrence);
  if (pushIndex <= anchorIndex) throw new Error("Runtime mutation fixture no longer places completion after its anchor");
  const pushLineStart = source.lastIndexOf("\n", pushIndex) + 1;
  const pushLineBreak = source.indexOf("\n", pushIndex);
  const pushLineEnd = pushLineBreak < 0 ? source.length : pushLineBreak + 1;
  const pushLine = source.slice(pushLineStart, pushLineEnd);
  const anchorLineStart = source.lastIndexOf("\n", anchorIndex) + 1;
  const withoutPush = source.slice(0, pushLineStart) + source.slice(pushLineEnd);
  return withoutPush.slice(0, anchorLineStart) + pushLine + withoutPush.slice(anchorLineStart);
}

function payload(browserVersion = "fixture-chromium-1"): Omit<DesignerRuntimeReportV1, "contentHash"> {
  const commonMeasurement = (presetId: string, token: string) => ({
    presetId,
    requestHash: `sha256:${token.repeat(64)}` as const,
    resultContentHash: `sha256:${token.toUpperCase().toLowerCase().repeat(64)}` as const,
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

describe("Designer runtime audit V1", () => {
  it("parses the content-addressed workload contract and round-trips a bounded report", () => {
    expect(contract).toMatchObject({
      version: "2026-08-26.3",
      workloads: [
        {
          application: "motor.brushed-dc",
          completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
        },
        {
          application: "power.buck",
          completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
        },
      ],
      boundaries: {
        memory: expect.stringContaining("customization target discovery"),
      },
      contentHash: "sha256:0b9602bf26211a38e301e830a95dc9e7f7ee7e0c2778beb8c6e8834a8f257928",
    });
    const report = createDesignerRuntimeReportV1(payload(), contract);
    expect(parseDesignerRuntimeReportV1(structuredClone(report), contract)).toEqual(report);
    expect(report.contentHash).toBe(calculateDesignerRuntimeReportContentHashV1(report));
    expect(Object.isFrozen(report)).toBe(true);
    expect(report.boundaries).toMatchObject({ attestation: "none" });
  });

  it("binds customization target settlement into the static runtime release gate", () => {
    const gate = buildDesignerReleaseReadinessReportV1().gates.find(
      (entry) => entry.id === "web.runtime-performance-memory-contract",
    );
    expect(gate).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        contractVersion: "2026-08-26.3",
        contractContentHash: "sha256:0b9602bf26211a38e301e830a95dc9e7f7ee7e0c2778beb8c6e8834a8f257928",
        implemented: {
          exactMotorPowerWorkloads: true,
          exactProductionIdentities: true,
          browserSideTimingAndRetainedHeap: true,
          boundedClaims: true,
        },
      },
    });
  });

  it("rejects every early Motor and Power completion-sample mutation", () => {
    expect(assessDesignerRuntimeTimingOrderV1(runtimeSpecText)).toMatchObject({
      parseValid: true,
      branchStructureValid: true,
      motor: {
        completionPushCount: 1,
        matchedRequiredSettlementAwaits: 4,
        requiredSettlementAwaitCount: 4,
        completionAfterRequiredSettlement: true,
      },
      power: {
        completionPushCount: 1,
        matchedRequiredSettlementAwaits: 6,
        requiredSettlementAwaitCount: 6,
        completionAfterRequiredSettlement: true,
      },
      pass: true,
    });

    const mutations: Array<{
      branch: "motor" | "power";
      pushOccurrence: number;
      anchor: string;
      anchorOccurrence: number;
    }> = [
      { branch: "motor", pushOccurrence: 0, anchor: "await waitForDecodedPreview(page);", anchorOccurrence: 0 },
      { branch: "motor", pushOccurrence: 0, anchor: 'await expect(customization).toHaveAttribute("aria-busy", "false");', anchorOccurrence: 0 },
      { branch: "motor", pushOccurrence: 0, anchor: "await expect(customizationTargets).toBeEnabled();", anchorOccurrence: 0 },
      { branch: "motor", pushOccurrence: 0, anchor: 'await expect(customizationTargets.locator("option")).toHaveCount(2);', anchorOccurrence: 0 },
      { branch: "power", pushOccurrence: 1, anchor: "await waitForDecodedPreview(page);", anchorOccurrence: 1 },
      { branch: "power", pushOccurrence: 1, anchor: 'await expect(customization).toHaveAttribute("aria-busy", "false");', anchorOccurrence: 1 },
      { branch: "power", pushOccurrence: 1, anchor: 'await expect(customization).toContainText("0 compatible");', anchorOccurrence: 0 },
      { branch: "power", pushOccurrence: 1, anchor: 'await expect(customization).toContainText("No exact same-recipe primary alternate");', anchorOccurrence: 0 },
      { branch: "power", pushOccurrence: 1, anchor: "await expect(customizationTargets).toBeDisabled();", anchorOccurrence: 0 },
      { branch: "power", pushOccurrence: 1, anchor: 'await expect(customizationTargets.locator("option")).toHaveCount(1);', anchorOccurrence: 0 },
    ];
    for (const mutation of mutations) {
      const assessed = assessDesignerRuntimeTimingOrderV1(moveCompletionPushBefore(
        runtimeSpecText,
        mutation.pushOccurrence,
        mutation.anchor,
        mutation.anchorOccurrence,
      ));
      expect(assessed.parseValid, `${mutation.branch}: ${mutation.anchor}`).toBe(true);
      expect(assessed.branchStructureValid, `${mutation.branch}: ${mutation.anchor}`).toBe(true);
      expect(
        assessed[mutation.branch].completionAfterRequiredSettlement,
        `${mutation.branch}: ${mutation.anchor}`,
      ).toBe(false);
      expect(assessed[mutation.branch === "motor" ? "power" : "motor"].completionAfterRequiredSettlement)
        .toBe(true);
      expect(assessed.pass, `${mutation.branch}: ${mutation.anchor}`).toBe(false);
    }
  });

  it("rejects extra keys, forged scope, identity drift, summary drift, and exceeded budgets", () => {
    const report = createDesignerRuntimeReportV1(payload(), contract);
    expect(() => parseDesignerRuntimeReportV1({ ...structuredClone(report), unexpected: true }, contract))
      .toThrowError("report:invalid_keys");

    const forged = structuredClone(report) as any;
    forged.boundaries.attestation = "independent";
    forged.contentHash = calculateDesignerRuntimeReportContentHashV1(forged);
    expect(() => parseDesignerRuntimeReportV1(forged, contract)).toThrowError("report/boundaries/attestation:invalid_value");

    const wrongWorkload = structuredClone(report) as any;
    wrongWorkload.measurements.applications[0].presetId = "motor.other";
    wrongWorkload.contentHash = calculateDesignerRuntimeReportContentHashV1(wrongWorkload);
    expect(() => parseDesignerRuntimeReportV1(wrongWorkload, contract)).toThrowError("workload_mismatch");

    const forgedEligibility = structuredClone(report) as any;
    forgedEligibility.measurements.applications[1].candidateEligible = true;
    forgedEligibility.contentHash = calculateDesignerRuntimeReportContentHashV1(forgedEligibility);
    expect(() => parseDesignerRuntimeReportV1(forgedEligibility, contract))
      .toThrowError("candidateEligible:invalid_value");

    const forgedRejectedFields = structuredClone(report) as any;
    forgedRejectedFields.measurements.applications[1].rejectedCandidateId = `candidate:v2:sha256:${"b".repeat(64)}`;
    forgedRejectedFields.measurements.applications[1].rejectionReasonCode = "hard_constraint_failed";
    forgedRejectedFields.measurements.applications[1].rejectionRuleId = "power.regulator.current-limit";
    forgedRejectedFields.contentHash = calculateDesignerRuntimeReportContentHashV1(forgedRejectedFields);
    expect(() => parseDesignerRuntimeReportV1(forgedRejectedFields, contract)).toThrowError("invalid_keys");

    const summaryDrift = structuredClone(report) as any;
    summaryDrift.measurements.applications[0].p95Us = 119_999;
    summaryDrift.contentHash = calculateDesignerRuntimeReportContentHashV1(summaryDrift);
    expect(() => parseDesignerRuntimeReportV1(summaryDrift, contract)).toThrowError("p95_mismatch");

    const overBudget = payload() as any;
    overBudget.measurements.applications[0].generationAndPreviewUs = [
      contract.budgets.generationAndPreviewP95Us + 1,
      contract.budgets.generationAndPreviewP95Us + 1,
      contract.budgets.generationAndPreviewP95Us + 1,
    ];
    overBudget.measurements.applications[0].p95Us = contract.budgets.generationAndPreviewP95Us + 1;
    expect(() => createDesignerRuntimeReportV1(overBudget, contract)).toThrowError("budget_exceeded");
  });

  it("keeps measurements environment-bound while the deterministic contract identity stays fixed", () => {
    const first = createDesignerRuntimeReportV1(payload("fixture-chromium-1"), contract);
    const second = createDesignerRuntimeReportV1(payload("fixture-chromium-2"), contract);
    expect(first.contract).toEqual(second.contract);
    expect(first.contentHash).not.toBe(second.contentHash);
  });

  it("accepts the current retained-but-ineligible Power observation without accepting eligibility", () => {
    const report = createDesignerRuntimeReportV1(payload(), contract);
    expect(report.measurements.applications[1]).toMatchObject({
      application: "power.buck",
      candidateEligible: false,
      constraintDecisionContentHash: `sha256:${"d".repeat(64)}`,
    });

    const forged = structuredClone(report) as any;
    forged.measurements.applications[1].candidateEligible = true;
    forged.contentHash = calculateDesignerRuntimeReportContentHashV1(forged);
    expect(() => parseDesignerRuntimeReportV1(forged, contract))
      .toThrowError("candidateEligible:invalid_value");
  });

  it("keeps the legacy rejected Power workload shape strictly validated when a legacy contract requests it", () => {
    const legacyContractInput = structuredClone(contract);
    legacyContractInput.version = "2026-08-25.2";
    legacyContractInput.workloads[1]!.completionPoint = "exact_rejected_result_and_execution_ledger_ready";
    legacyContractInput.contentHash = calculateDesignerRuntimeContractContentHashV1(legacyContractInput);
    const legacyContract = parseDesignerRuntimeContractV1(legacyContractInput);
    const legacyPayload = payload() as any;
    legacyPayload.contract = { version: legacyContract.version, contentHash: legacyContract.contentHash };
    legacyPayload.measurements.applications[1] = {
      ...legacyPayload.measurements.applications[1],
      completionPoint: "exact_rejected_result_and_execution_ledger_ready",
      rejectedCandidateId: `candidate:v2:sha256:${"b".repeat(64)}`,
      rejectionReasonCode: "hard_constraint_failed",
      rejectionRuleId: "power.regulator.current-limit",
    };
    delete legacyPayload.measurements.applications[1].candidateId;
    delete legacyPayload.measurements.applications[1].constraintDecisionContentHash;
    delete legacyPayload.measurements.applications[1].candidateEligible;
    delete legacyPayload.measurements.applications[1].previewContentHash;
    const report = createDesignerRuntimeReportV1(legacyPayload, legacyContract);
    const forged = structuredClone(report) as any;
    forged.measurements.applications[1].rejectionRuleId = "power.inductor.saturation-current";
    forged.contentHash = calculateDesignerRuntimeReportContentHashV1(forged);
    expect(() => parseDesignerRuntimeReportV1(forged, legacyContract))
      .toThrowError("rejectionRuleId:invalid_value");
  });
});
