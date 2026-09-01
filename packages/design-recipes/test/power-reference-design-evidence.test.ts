import { describe, expect, it } from "vitest";
import { TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1 } from "@opencircuit/design-library/v2-runtime";
import { parseElectricalDesignRequestV2, type BuckDesignRequestV2 } from "@opencircuit/design-schema";
import {
  POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1,
  POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1,
  POWER_TPS54302EVM_716_LAYOUT_REFERENCE_CONTENT_HASH,
  POWER_TPS54302EVM_716_REFERENCE_BOM_CONTENT_HASH,
  POWER_TPS54302EVM_716_STRICT_RULE_IDS,
  type PowerReferenceDesignIdentityAssertionV1,
  assessTps54302Evm716ReferenceEvidenceV1,
} from "../src/power-reference-design-evidence";

function request(inputVoltage: number, maximumOutputCurrent: number): BuckDesignRequestV2 {
  const parsed = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: inputVoltage, unit: "V", displayUnit: "V" },
        nominal: { value: inputVoltage, unit: "V", displayUnit: "V" },
        maximum: { value: inputVoltage, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
      dcOutputVoltageRegulation: {
        minimum: { value: 4.7, unit: "V", displayUnit: "V" },
        maximum: { value: 5.3, unit: "V", displayUnit: "V" },
      },
      maximumOutputCurrent: { value: maximumOutputCurrent, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: 298.15, unit: "K", displayUnit: "°C" },
      switchingFrequency: {
        selection: "automatic",
        minimum: { value: 250_000, unit: "Hz", displayUnit: "kHz" },
        preferred: null,
        maximum: { value: 600_000, unit: "Hz", displayUnit: "kHz" },
      },
      maximumOutputRipple: { value: 0.03, unit: "V", displayUnit: "mV" },
      loadTransientTarget: null,
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
      maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: false,
    },
    assumptions: [{
      id: "test.reference-evidence-boundary",
      description: "The test exercises an observation-only evaluation-module evidence binding without granting production constraint authority.",
      source: "fixture",
      affects: ["referenceDesignEvidence"],
    }],
    libraryVersion: "reference-evidence-unit-test",
  });
  if (parsed.application !== "power.buck") throw new Error("Expected a Power request");
  return parsed;
}

const identityAssertion = POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1;

describe("TPS54302EVM-716 reference evidence recipe", () => {
  it("keeps all thirteen production rules blocked for an asserted, unattested reference identity", () => {
    const assessment = assessTps54302Evm716ReferenceEvidenceV1(request(12, 0.2), identityAssertion);

    expect(POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1).toMatchObject({
      id: "power.reference-evidence.tps54302evm-716",
      version: "1.0.0",
      contentHash: "sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2",
      installationState: "not_installed_observation_only",
      identityAssertionAttestation: "none",
      strictConstraintAuthority: false,
    });
    expect(POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1.ruleMappings.map((mapping) => mapping.ruleId)).toEqual(
      POWER_TPS54302EVM_716_STRICT_RULE_IDS,
    );
    expect(POWER_TPS54302EVM_716_REFERENCE_BOM_CONTENT_HASH).toBe("sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22");
    expect(POWER_TPS54302EVM_716_LAYOUT_REFERENCE_CONTENT_HASH).toBe("sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a");
    expect(assessment).toMatchObject({
      identityState: "asserted_reference_identity_unattested",
      strictClosedRuleIds: [],
      blockedRuleIds: POWER_TPS54302EVM_716_STRICT_RULE_IDS,
      identityAssertionAttestation: "none",
      physicalAssemblyQualificationAuthority: false,
      applicationAuthority: false,
      candidateEligibilityAuthority: false,
    });
    expect(assessment.referenceObservationIdsAtRequestedConditions).toEqual([
      "power.reference.tps54302evm716.tested-operating-envelope",
      "power.reference.tps54302evm716.load-regulation",
    ]);
  });

  it("withholds every EVM observation from the installed Bel structural candidate", () => {
    const assessment = assessTps54302Evm716ReferenceEvidenceV1(request(12, 0.2), null);
    expect(assessment.identityState).toBe("reference_identity_not_asserted");
    expect(assessment.referenceObservationIdsAtRequestedConditions).toEqual([]);
    expect(assessment.strictClosedRuleIds).toEqual([]);
    expect(assessment.blockedRuleIds).toEqual(POWER_TPS54302EVM_716_STRICT_RULE_IDS);
  });

  it("exposes the full-load ripple observation only at its exact 24 V, 3 A point", () => {
    const fullLoad = assessTps54302Evm716ReferenceEvidenceV1(request(24, 3), identityAssertion);
    const browserPoint = assessTps54302Evm716ReferenceEvidenceV1(request(12, 0.2), identityAssertion);

    expect(fullLoad.referenceObservationIdsAtRequestedConditions).toContain("power.reference.tps54302evm716.output-ripple-full-load");
    expect(browserPoint.referenceObservationIdsAtRequestedConditions).not.toContain("power.reference.tps54302evm716.output-ripple-full-load");
    expect(fullLoad.strictClosedRuleIds).toEqual([]);
  });

  it("withholds the Table 1-2 center-frequency observation at 12 V and exposes it at 24 V", () => {
    const twelveVolt = assessTps54302Evm716ReferenceEvidenceV1(request(12, 0.2), identityAssertion);
    const twentyFourVolt = assessTps54302Evm716ReferenceEvidenceV1(request(24, 0.2), identityAssertion);

    expect(twelveVolt.referenceObservationIdsAtRequestedConditions).not.toContain("power.reference.tps54302evm716.center-switching-frequency");
    expect(twentyFourVolt.referenceObservationIdsAtRequestedConditions).toContain("power.reference.tps54302evm716.center-switching-frequency");
  });

  it.each([
    ["reference-design ID", { referenceDesignId: "TPS54302EVM-716-DRIFT" }],
    ["assembly ID", { assemblyId: "PWR716-003-DRIFT" }],
    ["evidence identity", { evidenceContentHash: `sha256:${"0".repeat(64)}` }],
    ["BOM identity", { bomContentHash: `sha256:${"1".repeat(64)}` }],
    ["layout-reference identity", { layoutReferenceContentHash: `sha256:${"2".repeat(64)}` }],
  ] as const)("fails the unattested identity assertion closed on %s drift", (_label, drift) => {
    const drifted = assessTps54302Evm716ReferenceEvidenceV1(request(12, 0.2), {
      ...identityAssertion,
      ...drift,
    } as PowerReferenceDesignIdentityAssertionV1);
    expect(drifted.identityState).toBe("reference_identity_not_asserted");
    expect(drifted.referenceObservationIdsAtRequestedConditions).toEqual([]);
    expect(drifted.strictClosedRuleIds).toEqual([]);
  });

  it("guards the unique thirteen-rule mapping and observation references", () => {
    const mappings = POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1.ruleMappings;
    const observationIds = new Set(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.observations.map((entry) => entry.id));

    expect(POWER_TPS54302EVM_716_STRICT_RULE_IDS).toHaveLength(13);
    expect(new Set(POWER_TPS54302EVM_716_STRICT_RULE_IDS).size).toBe(13);
    expect(mappings).toHaveLength(13);
    expect(new Set(mappings.map((mapping) => mapping.ruleId)).size).toBe(13);
    expect(mappings.map((mapping) => mapping.ruleId)).toEqual(POWER_TPS54302EVM_716_STRICT_RULE_IDS);
    expect(mappings.every((mapping) => mapping.disposition === "blocked_unknown")).toBe(true);
    expect(mappings.flatMap((mapping) => mapping.relevantObservationIds).every((id) => observationIds.has(id))).toBe(true);
  });
});
