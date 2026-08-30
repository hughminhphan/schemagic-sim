import { describe, expect, it } from "vitest";
import { parseElectricalDesignRequestV2, type BuckDesignRequestV2 } from "@opencircuit/design-schema";
import {
  POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1,
  POWER_TPS54302EVM_716_STRICT_RULE_IDS,
  assessTps54302Evm716ReferenceEvidenceV1,
} from "@opencircuit/design-recipes/power-reference-design-evidence";
import { assessPowerTps54302Evm716ReferenceEvidenceV1 } from "../src/reference-evidence";

function request(allowUnknownHardConstraints: boolean): BuckDesignRequestV2 {
  const parsed = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: 12, unit: "V", displayUnit: "V" },
        nominal: { value: 12, unit: "V", displayUnit: "V" },
        maximum: { value: 12, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
      dcOutputVoltageRegulation: {
        minimum: { value: 4.7, unit: "V", displayUnit: "V" },
        maximum: { value: 5.3, unit: "V", displayUnit: "V" },
      },
      maximumOutputCurrent: { value: 0.2, unit: "A", displayUnit: "A" },
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
      allowUnknownHardConstraints,
    },
    assumptions: [{
      id: "reference-evidence-test.conditions",
      description: "The fixture fixes the exact browser electrical conditions used to test the observation-only EVM evidence sidecar.",
      source: "fixture",
      affects: ["referenceDesignEvidence"],
    }],
    libraryVersion: "reference-evidence-test",
  });
  if (parsed.application !== "power.buck") throw new Error("Expected a Power request");
  return parsed;
}

describe("Power TPS54302EVM-716 auxiliary reference evidence", () => {
  it("reports exact reference identity, conditions, authority boundaries, and BOM mismatch", () => {
    const sourceRequest = request(false);
    const evidence = assessPowerTps54302Evm716ReferenceEvidenceV1(sourceRequest);

    expect(evidence).toMatchObject({
      kind: "power_reference_design_evidence",
      schemaVersion: 1,
      application: "power.buck",
      reference: {
        referenceDesignId: "TPS54302EVM-716",
        assemblyId: "PWR716-003",
        documentId: "SLVUAP9B",
        documentRevision: "Rev. B",
        sourceContentHash: "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e",
        evidenceContentHash: "sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb",
        bomContentHash: "sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22",
        layoutReferenceContentHash: "sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a",
        recipeContentHash: "sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2",
      },
      requestAssessment: {
        identityState: "asserted_reference_identity_unattested",
        identityAssertionAttestation: "none",
        strictClosedRuleIds: [],
        physicalAssemblyQualificationAuthority: false,
        applicationAuthority: false,
        candidateEligibilityAuthority: false,
      },
      candidateAssessment: {
        identityState: "reference_identity_not_asserted",
        referenceObservationIdsAtRequestedConditions: [],
        strictClosedRuleIds: [],
        physicalAssemblyQualificationAuthority: false,
        applicationAuthority: false,
        candidateEligibilityAuthority: false,
      },
      bomComparison: {
        matchesInstalledCandidate: false,
        referenceDesign: {
          regulator: { manufacturerPartNumber: "TPS54302DDC" },
          inductor: { manufacturerPartNumber: "7447714100", nominalValue: "10uH" },
        },
        installedCandidate: {
          regulator: { manufacturerPartNumber: "TPS54302DDCR" },
          inductor: { manufacturerPartNumber: "F1F2-0804-100M", nominalValue: "10uH" },
        },
        consequence: "reference_observations_do_not_apply_to_installed_candidate",
      },
      boundaries: {
        identityAssertionAttestation: "none",
        strictConstraintAuthority: false,
        physicalAssemblyQualificationAuthority: false,
        applicationAuthority: false,
        candidateEligibilityAuthority: false,
        selectedPartModelCoverage: "not_claimed",
        externalNetworkLinkIncluded: false,
      },
    });
    expect(evidence.requestAssessment.referenceObservationIdsAtRequestedConditions).toEqual([
      "power.reference.tps54302evm716.tested-operating-envelope",
      "power.reference.tps54302evm716.load-regulation",
    ]);
    expect(evidence.requestAssessment.blockedRuleIds).toEqual(POWER_TPS54302EVM_716_STRICT_RULE_IDS);
    expect(evidence.candidateAssessment.blockedRuleIds).toEqual(POWER_TPS54302EVM_716_STRICT_RULE_IDS);
    expect(evidence.requestAssessment).toEqual(assessTps54302Evm716ReferenceEvidenceV1(
      sourceRequest,
      POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1,
    ));
    expect(evidence.candidateAssessment).toEqual(
      assessTps54302Evm716ReferenceEvidenceV1(sourceRequest, null),
    );
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(JSON.stringify(evidence)).not.toMatch(/https?:\/\//u);
  });

  it("is identical for strict and permissive requests when electrical conditions are identical", () => {
    const strict = assessPowerTps54302Evm716ReferenceEvidenceV1(request(false));
    const permissive = assessPowerTps54302Evm716ReferenceEvidenceV1(request(true));
    expect(permissive).toEqual(strict);
  });
});
