import {
  FACTS_SCHEMA_VERSION_V32,
  designProfileEnvelopeContentHash,
  designProfileId,
  type DesignProfileV32,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
  type ConstraintResult,
  type EvidenceRef,
} from "@opencircuit/design-schema";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED } from "./motor-integrated-v32-local-capacitance-recommendation-qualified";
import type { NativeEnvironmentV2, NativeOutcomeV2, NativeRecipeV2, NativeSolvedOptionV2 } from "./types";

export const MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID =
  "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json" as const;

export const MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_CONTENT_HASH =
  "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a" as const;

export const MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_SOURCE_CONTENT_HASH =
  "sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7" as const;

export const MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID =
  "motor.integrated.companion-network-representability" as const;

const SOURCE = {
  sourceId: "ti-drv8262-slvsfv5c",
  contentHash: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_SOURCE_CONTENT_HASH,
  url: "https://www.ti.com/lit/ds/symlink/drv8262.pdf",
  revision: "SLVSFV5C, July 2023 - revised July 2025",
  retrievedAt: "2026-08-25T20:30:52Z",
  locator: "physical PDF page 18, Table 6-1 External Components: CVM1 and CVM2 are each recommended as X7R 0.01 uF VM-rated ceramic capacitors from VM to PGND12 and PGND34",
} as const;

const RELEASE_V326 = {
  id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.id,
  version: "3.2.6",
  predecessor: {
    id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.id,
    version: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.version,
    contentHash: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.contentHash,
  },
  equations: [
    "motor.integrated.facts-v3-2.exact-companion-network-representability-gate.v1",
  ],
  companionNetworkRejectionBindings: [{
    ruleId: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID,
    stage: "match_before_component_materialization",
    primary: {
      dataKey: "primaryProfileId",
      profileId: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID,
      partClass: "motor.integrated-h-bridge",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "DRV8262DDVR",
      profileContentHash: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_CONTENT_HASH,
    },
    sourceFacts: [{
      factPath: "facts.localSupplyDecouplingCapacitance",
      state: "reviewed",
      value: { value: 1e-8, unit: "F" },
      validFor: [],
      source: SOURCE,
    }, {
      factPath: "facts.localSupplyDecouplingRequirement",
      state: "reviewed",
      value: "recommended_value",
      validFor: [],
      source: SOURCE,
    }],
    sourceBoundCompanionNetwork: {
      distinctVmBypassPositions: [
        { componentId: "CVM1", from: "VM", to: "PGND12", nominalCapacitanceF: 1e-8 },
        { componentId: "CVM2", from: "VM", to: "PGND34", nominalCapacitanceF: 1e-8 },
      ],
      additionalTable6_1NetworksNotRepresentedByTheScalarFacts: [
        { componentId: "CPH-CPL", role: "charge-pump-flying-capacitor", nominalCapacitanceF: 0.1e-6 },
        { componentId: "VCP-VM", role: "charge-pump-storage-capacitor", nominalCapacitanceF: 1e-6 },
        { componentId: "DVDD-GND", role: "internal-regulator-capacitor", nominalCapacitanceF: 1e-6 },
        { componentId: "VCC-GND", role: "conditional-regulator-capacitor", nominalCapacitanceF: 0.1e-6 },
      ],
    },
    installedRecipeRepresentation: {
      localDecouplingComponentId: "local-decoupling",
      localDecouplingComponentCount: 1,
      distinctPlacementRolesRepresented: false,
      chargePumpOrRegulatorComponentsRepresented: false,
    },
    disposition: "reject_before_candidate_component_materialization_and_customization_witness",
    nonclaims: [
      "companion_component_selection",
      "effective_capacitance_under_bias_or_temperature",
      "placement_or_interconnect",
      "bulk_capacitance_adequacy",
      "switching_safety",
      "overall_part_unsuitability",
    ],
  }],
} as const;

type IntegratedProfile = DesignProfileV32<"motor.integrated-h-bridge">;

function selectedExactPrimary(
  option: Readonly<NativeSolvedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
): IntegratedProfile | undefined {
  return environment.catalog.profiles.find((profile) => (
    profile.partClass === "motor.integrated-h-bridge"
    && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32
    && designProfileId(profile.partClass, profile.part) === MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID
    && option.data.primaryProfileId === MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID
  )) as IntegratedProfile | undefined;
}

function exactSource(evidence: readonly ProfileEvidenceRef[]): boolean {
  return evidence.length === 1
    && evidence[0]!.sourceId === SOURCE.sourceId
    && evidence[0]!.contentHash === SOURCE.contentHash
    && evidence[0]!.url === SOURCE.url
    && evidence[0]!.revision === SOURCE.revision
    && evidence[0]!.retrievedAt === SOURCE.retrievedAt
    && evidence[0]!.locator === SOURCE.locator;
}

function exactReviewedBinding(profile: Readonly<IntegratedProfile>): boolean {
  const capacitance = profile.facts.localSupplyDecouplingCapacitance;
  const requirement = profile.facts.localSupplyDecouplingRequirement;
  return profile.part.manufacturerId === "texas-instruments"
    && profile.part.manufacturerPartNumber === "DRV8262DDVR"
    && designProfileEnvelopeContentHash(profile) === MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_CONTENT_HASH
    && capacitance.state === "reviewed"
    && capacitance.value?.value === 1e-8
    && capacitance.value.unit === "F"
    && capacitance.validFor.length === 0
    && exactSource(capacitance.evidence)
    && requirement.state === "reviewed"
    && requirement.value === "recommended_value"
    && requirement.validFor.length === 0
    && exactSource(requirement.evidence);
}

function projectedEvidence(input: readonly ProfileEvidenceRef[]): EvidenceRef[] {
  return input.map((entry) => ({
    sourceId: entry.sourceId,
    locator: entry.locator,
    ...(entry.retrievedAt === null ? {} : { retrievedAt: entry.retrievedAt }),
    ...(entry.contentHash === null ? {} : { contentHash: entry.contentHash }),
    licenseNote: entry.licenseNote,
  }));
}

function selectedProfileIds(option: Readonly<NativeSolvedOptionV2>): string[] {
  return [...new Set(["bulkProfileId", "localProfileId", "primaryProfileId"]
    .map((key) => option.data[key])
    .filter((value): value is string => typeof value === "string"))]
    .sort(compareDesignV2Tokens);
}

function rejectionConstraint(profile: Readonly<IntegratedProfile> | undefined): ConstraintResult {
  if (profile !== undefined && exactReviewedBinding(profile)) {
    return {
      ruleId: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID,
      status: "fail",
      explanation: "The exact hash-bound DRV8262DDVR profile requires two distinct VM bypass positions (CVM1 from VM to PGND12 and CVM2 from VM to PGND34) plus separate charge-pump and regulator capacitor networks. This recipe can represent only one undifferentiated local-decoupling capacitor and no charge-pump or regulator companion roles, so this option is rejected at match before component materialization or customization-witness creation.",
      evidence: projectedEvidence(profile.facts.localSupplyDecouplingCapacitance.evidence),
    };
  }
  return {
    ruleId: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID,
    status: "fail",
    explanation: "The exact DRV8262DDVR profile identity is reserved for a hash-bound companion-network safety rejection, but its reviewed profile hash or structured evidence binding is absent or changed. The one-local-capacitor recipe remains prohibited from materializing this identity.",
    evidence: [],
  };
}

function companionNetworkRejection(
  option: Readonly<NativeSolvedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
): NativeOutcomeV2<never> {
  const profile = selectedExactPrimary(option, environment);
  const exact = profile !== undefined && exactReviewedBinding(profile);
  return {
    status: "rejected",
    reason: exact
      ? "companion_network_unrepresentable: exact DRV8262DDVR requires two distinct VM bypass positions plus separate charge-pump and regulator capacitor networks, which this one-local-capacitor recipe cannot represent"
      : "companion_network_binding_unverified: exact DRV8262DDVR identity cannot enter one-local-capacitor materialization without its immutable reviewed companion-network binding",
    constraints: [rejectionConstraint(profile)],
    componentProfileIds: selectedProfileIds(option),
  };
}

/**
 * Immutable facts-V3.2 successor. It delegates every non-DRV8262 option byte-for-byte
 * to 3.2.5 and rejects the exact DRV8262 identity in match before components exist.
 */
export const MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED: NativeRecipeV2 = Object.freeze({
  ...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED,
  version: RELEASE_V326.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE_V326)),
  applications: Object.freeze([...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.applications]) as NativeRecipeV2["applications"],
  metricDeclarations: Object.freeze(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.metricDeclarations.map((entry) => Object.freeze({ ...entry }))) as NativeRecipeV2["metricDeclarations"],
  match(option: Readonly<NativeSolvedOptionV2>, environment: NativeEnvironmentV2) {
    if (option.data.primaryProfileId === MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID) {
      return [companionNetworkRejection(option, environment)];
    }
    return MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.match(option, environment);
  },
});
