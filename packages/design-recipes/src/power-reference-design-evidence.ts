import {
  TPS54302EVM_716_REFERENCE_DESIGN_IDENTITY_ASSERTION_V1,
  TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1,
  contentHash,
  deepFreeze,
  type DeepReadonly,
  type PowerReferenceDesignRuntimeConditionV1,
  type PowerReferenceDesignRuntimeObservationV1,
} from "@opencircuit/design-library/v2-runtime";
import type { BuckDesignRequestV2 } from "@opencircuit/design-schema";

export const POWER_TPS54302EVM_716_STRICT_RULE_IDS = [
  "power.regulator.output-current",
  "power.inductor.selected-value",
  "power.inductor.saturation-current",
  "power.inductor.rms-current",
  "power.regulator.current-limit",
  "power.control.loop-stability",
  "power.passive.capacitor-effective-capacitance",
  "power.passive.bootstrap-effective-capacitance",
  "power.regulator.minimum-on-time",
  "power.regulator.minimum-off-time",
  "power.request.output-ripple",
  "power.thermal.loss-model",
  "power.thermal.maximum-junction",
] as const;

export type PowerTps54302Evm716StrictRuleId = typeof POWER_TPS54302EVM_716_STRICT_RULE_IDS[number];

export const POWER_TPS54302EVM_716_REFERENCE_BOM_CONTENT_HASH =
  TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.bomContentHash;
export const POWER_TPS54302EVM_716_LAYOUT_REFERENCE_CONTENT_HASH =
  TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.layoutReferenceContentHash;

export interface PowerReferenceDesignIdentityAssertionV1 {
  referenceDesignId: string;
  assemblyId: string;
  evidenceContentHash: `sha256:${string}`;
  bomContentHash: `sha256:${string}`;
  layoutReferenceContentHash: `sha256:${string}`;
}

/** Exact URL-free identity tokens for the published, unattested EVM record. */
export const POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1 =
  TPS54302EVM_716_REFERENCE_DESIGN_IDENTITY_ASSERTION_V1;

export interface PowerReferenceDesignRuleMappingV1 {
  ruleId: PowerTps54302Evm716StrictRuleId;
  relevantObservationIds: string[];
  disposition: "blocked_unknown";
  reason: string;
}

interface PowerReferenceDesignEvidenceRecipePayloadV1 {
  id: "power.reference-evidence.tps54302evm-716";
  version: "1.0.0";
  referenceDesignEvidenceContentHash: `sha256:${string}`;
  referenceBomContentHash: `sha256:${string}`;
  referenceLayoutContentHash: `sha256:${string}`;
  installationState: "not_installed_observation_only";
  identityAssertionAttestation: "none";
  strictConstraintAuthority: false;
  ruleMappings: PowerReferenceDesignRuleMappingV1[];
}

export type PowerReferenceDesignEvidenceRecipeV1 = PowerReferenceDesignEvidenceRecipePayloadV1 & {
  contentHash: `sha256:${string}`;
};

export interface PowerReferenceDesignEvidenceAssessmentV1 {
  recipeId: PowerReferenceDesignEvidenceRecipeV1["id"];
  recipeContentHash: `sha256:${string}`;
  referenceDesignEvidenceContentHash: `sha256:${string}`;
  referenceBomContentHash: `sha256:${string}`;
  referenceLayoutContentHash: `sha256:${string}`;
  identityState: "asserted_reference_identity_unattested" | "reference_identity_not_asserted";
  referenceObservationIdsAtRequestedConditions: string[];
  strictClosedRuleIds: [];
  blockedRuleIds: PowerTps54302Evm716StrictRuleId[];
  identityAssertionAttestation: "none";
  physicalAssemblyQualificationAuthority: false;
  applicationAuthority: false;
  candidateEligibilityAuthority: false;
}

const RULE_MAPPINGS: PowerReferenceDesignRuleMappingV1[] = [
  {
    ruleId: "power.regulator.output-current",
    relevantObservationIds: ["power.reference.tps54302evm716.tested-operating-envelope"],
    disposition: "blocked_unknown",
    reason: "The EVM tested range is board-specific observation evidence, not a condition-covering guaranteed operating limit for the TPS54302DDCR production population.",
  },
  {
    ruleId: "power.inductor.selected-value",
    relevantObservationIds: ["power.reference.tps54302evm716.tested-operating-envelope"],
    disposition: "blocked_unknown",
    reason: "The published EVM BOM uses a different 10 uH Wurth inductor and supplies no worst-case inductance-versus-bias, temperature, frequency, or light-load-mode envelope.",
  },
  {
    ruleId: "power.inductor.saturation-current",
    relevantObservationIds: ["power.reference.tps54302evm716.tested-operating-envelope"],
    disposition: "blocked_unknown",
    reason: "A tested EVM range does not provide a condition-covering worst-case peak-current envelope or qualify the installed Bel inductor.",
  },
  {
    ruleId: "power.inductor.rms-current",
    relevantObservationIds: ["power.reference.tps54302evm716.tested-operating-envelope"],
    disposition: "blocked_unknown",
    reason: "The guide does not publish a worst-case RMS current waveform across continuous, discontinuous, and pulse-skipping operation.",
  },
  {
    ruleId: "power.regulator.current-limit",
    relevantObservationIds: ["power.reference.tps54302evm716.tested-operating-envelope"],
    disposition: "blocked_unknown",
    reason: "The guide does not bound protection delay, overshoot, peak current, minimum inductance, or production current-limit coordination.",
  },
  {
    ruleId: "power.control.loop-stability",
    relevantObservationIds: [
      "power.reference.tps54302evm716.load-regulation",
      "power.reference.tps54302evm716.load-transient-rising",
      "power.reference.tps54302evm716.load-transient-falling",
    ],
    disposition: "blocked_unknown",
    reason: "Regulation and transient plots do not provide gain or phase margin across component and control corners.",
  },
  {
    ruleId: "power.passive.capacitor-effective-capacitance",
    relevantObservationIds: ["power.reference.tps54302evm716.output-ripple-full-load"],
    disposition: "blocked_unknown",
    reason: "The BOM and one ripple point do not bound effective capacitance, DC bias, temperature, aging, ESR, or ripple-current capability.",
  },
  {
    ruleId: "power.passive.bootstrap-effective-capacitance",
    relevantObservationIds: [],
    disposition: "blocked_unknown",
    reason: "The BOM gives nominal bootstrap capacitance only; charge, leakage, bias, temperature, aging, and refresh adequacy remain unbounded.",
  },
  {
    ruleId: "power.regulator.minimum-on-time",
    relevantObservationIds: ["power.reference.tps54302evm716.center-switching-frequency"],
    disposition: "blocked_unknown",
    reason: "A nominal EVM switching point is not a guaranteed maximum minimum-on-time across production, voltage, temperature, and load.",
  },
  {
    ruleId: "power.regulator.minimum-off-time",
    relevantObservationIds: ["power.reference.tps54302evm716.center-switching-frequency"],
    disposition: "blocked_unknown",
    reason: "The guide publishes no guaranteed minimum controllable off-time bound.",
  },
  {
    ruleId: "power.request.output-ripple",
    relevantObservationIds: ["power.reference.tps54302evm716.output-ripple-full-load"],
    disposition: "blocked_unknown",
    reason: "The less-than-30 mV EVM observation is at 24 V, 3 A, and 25 degC; it does not cover the installed browser request or production spread.",
  },
  {
    ruleId: "power.thermal.loss-model",
    relevantObservationIds: ["power.reference.tps54302evm716.maximum-efficiency"],
    disposition: "blocked_unknown",
    reason: "One typical efficiency point is not a bounded component loss model across operating and production corners.",
  },
  {
    ruleId: "power.thermal.maximum-junction",
    relevantObservationIds: ["power.reference.tps54302evm716.maximum-efficiency"],
    disposition: "blocked_unknown",
    reason: "The guide supplies no junction-temperature observation or bounded board/layout thermal model for the requested maximum junction temperature.",
  },
];

const recipePayload = {
  id: "power.reference-evidence.tps54302evm-716",
  version: "1.0.0",
  referenceDesignEvidenceContentHash: TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.evidenceContentHash,
  referenceBomContentHash: POWER_TPS54302EVM_716_REFERENCE_BOM_CONTENT_HASH,
  referenceLayoutContentHash: POWER_TPS54302EVM_716_LAYOUT_REFERENCE_CONTENT_HASH,
  installationState: "not_installed_observation_only",
  identityAssertionAttestation: "none",
  strictConstraintAuthority: false,
  ruleMappings: RULE_MAPPINGS,
} satisfies PowerReferenceDesignEvidenceRecipePayloadV1;

export const POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1: DeepReadonly<PowerReferenceDesignEvidenceRecipeV1> =
  deepFreeze({
    ...recipePayload,
    contentHash: contentHash(recipePayload),
  });

function requestedRange(
  parameterId: string,
  request: Readonly<BuckDesignRequestV2>,
): Readonly<{ minimum: number; maximum: number; unit: string }> | undefined {
  switch (parameterId) {
    case "inputVoltage":
      return {
        minimum: request.requirements.inputVoltage.minimum.value,
        maximum: request.requirements.inputVoltage.maximum.value,
        unit: "V",
      };
    case "outputVoltage":
      return {
        minimum: request.requirements.outputVoltage.value,
        maximum: request.requirements.outputVoltage.value,
        unit: "V",
      };
    case "outputCurrent":
      return {
        minimum: request.requirements.maximumOutputCurrent.value,
        maximum: request.requirements.maximumOutputCurrent.value,
        unit: "A",
      };
    case "ambientTemperature":
      return {
        minimum: request.requirements.ambientTemperature.value,
        maximum: request.requirements.ambientTemperature.value,
        unit: "K",
      };
    case "switchingFrequency":
      return {
        minimum: request.requirements.switchingFrequency.minimum.value,
        maximum: request.requirements.switchingFrequency.maximum.value,
        unit: "Hz",
      };
    default:
      return undefined;
  }
}

function conditionCoversRequest(
  condition: Readonly<PowerReferenceDesignRuntimeConditionV1>,
  request: Readonly<BuckDesignRequestV2>,
): boolean {
  const requested = requestedRange(condition.parameterId, request);
  if (requested === undefined) return false;
  return requested.unit === condition.range.minimum.unit
    && condition.range.minimum.unit === condition.range.maximum.unit
    && requested.minimum >= condition.range.minimum.value
    && requested.maximum <= condition.range.maximum.value;
}

function observationCoversRequest(
  observation: Readonly<PowerReferenceDesignRuntimeObservationV1>,
  request: Readonly<BuckDesignRequestV2>,
): boolean {
  if (!observation.conditions.every((entry) => conditionCoversRequest(entry, request))) return false;
  const measuredRequest = requestedRange(observation.measurand, request);
  if (measuredRequest === undefined) return true;
  if (observation.range !== null) {
    return measuredRequest.unit === observation.range.minimum.unit
      && observation.range.minimum.unit === observation.range.maximum.unit
      && measuredRequest.minimum >= observation.range.minimum.value
      && measuredRequest.maximum <= observation.range.maximum.value;
  }
  if (observation.value === null) return false;
  if (observation.measurand === "switchingFrequency") {
    return measuredRequest.unit === observation.value.unit
      && observation.value.value >= measuredRequest.minimum
      && observation.value.value <= measuredRequest.maximum;
  }
  return true;
}

function assertedIdentityMatches(assertion: Readonly<PowerReferenceDesignIdentityAssertionV1> | null): boolean {
  const evidence = TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1;
  return assertion !== null
    && assertion.referenceDesignId === evidence.identity.referenceDesignId
    && assertion.assemblyId === evidence.identity.assemblyId
    && assertion.evidenceContentHash === evidence.evidenceContentHash
    && assertion.bomContentHash === POWER_TPS54302EVM_716_REFERENCE_BOM_CONTENT_HASH
    && assertion.layoutReferenceContentHash === POWER_TPS54302EVM_716_LAYOUT_REFERENCE_CONTENT_HASH;
}

/**
 * Exposes source-bounded reference observations without changing any V2/V3
 * candidate constraint. Matching public identity tokens are a caller assertion,
 * not physical-assembly or measurement attestation, and grant no application or
 * strict-rule authority.
 */
export function assessTps54302Evm716ReferenceEvidenceV1(
  request: Readonly<BuckDesignRequestV2>,
  assertion: Readonly<PowerReferenceDesignIdentityAssertionV1> | null,
): DeepReadonly<PowerReferenceDesignEvidenceAssessmentV1> {
  const asserted = assertedIdentityMatches(assertion);
  const referenceObservationIdsAtRequestedConditions = asserted
    ? TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.observations
        .filter((observation) => observationCoversRequest(observation, request))
        .map((observation) => observation.id)
    : [];
  return deepFreeze({
    recipeId: POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1.id,
    recipeContentHash: POWER_TPS54302EVM_716_REFERENCE_EVIDENCE_RECIPE_V1.contentHash,
    referenceDesignEvidenceContentHash: TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.evidenceContentHash,
    referenceBomContentHash: POWER_TPS54302EVM_716_REFERENCE_BOM_CONTENT_HASH,
    referenceLayoutContentHash: POWER_TPS54302EVM_716_LAYOUT_REFERENCE_CONTENT_HASH,
    identityState: asserted ? "asserted_reference_identity_unattested" : "reference_identity_not_asserted",
    referenceObservationIdsAtRequestedConditions,
    strictClosedRuleIds: [],
    blockedRuleIds: [...POWER_TPS54302EVM_716_STRICT_RULE_IDS],
    identityAssertionAttestation: "none",
    physicalAssemblyQualificationAuthority: false,
    applicationAuthority: false,
    candidateEligibilityAuthority: false,
  });
}
