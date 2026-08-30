import {
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V32,
  designProfileEnvelopeContentHash,
  designProfileId,
  type DesignProfileV32,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  type ConstraintResult,
  type EvidenceRef,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED } from "./motor-integrated-v32-mode-qualified-binding-refreshed";
import type { NativeEnvironmentV2, NativeMatchedOptionV2, NativeRecipeV2 } from "./types";

export const MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_PROFILE_CONTENT_HASH =
  "sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b" as const;

export const MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH =
  "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032" as const;

export const MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_PROFILE_CONTENT_HASH =
  "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6" as const;

export const MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH =
  "sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12" as const;

const LOCAL_CAPACITANCE_NOMINAL_RULE_ID = "motor.integrated.local-capacitance-nominal" as const;
const RECOMMENDED_NOMINAL_CAPACITANCE_F = 0.1e-6 as const;
const PRIMARY_PROFILE_ID = "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json" as const;
const LOCAL_PROFILE_ID = "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json" as const;

const RELEASE_V325 = {
  id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.id,
  version: "3.2.5",
  predecessor: {
    id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.id,
    version: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.version,
    contentHash: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.contentHash,
  },
  equations: [
    "motor.integrated.facts-v3-2.exact-local-nominal-recommendation-match.v1",
  ],
  localNominalRecommendationBindings: [{
    ruleId: LOCAL_CAPACITANCE_NOMINAL_RULE_ID,
    comparison: "exact_nominal_equality",
    primary: {
      role: "primary",
      componentId: "primary",
      dataKey: "primaryProfileId",
      partClass: "motor.integrated-h-bridge",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "DRV8876PWPR",
      profileContentHash: MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_PROFILE_CONTENT_HASH,
      recommendation: {
        evidenceRole: "recommended_value",
        nominalCapacitanceF: RECOMMENDED_NOMINAL_CAPACITANCE_F,
        source: {
          sourceId: "ti-drv8876-slvsds7b",
          contentHash: MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH,
          url: "https://www.ti.com/lit/ds/symlink/drv8876.pdf",
          revision: "SLVSDS7B, August 2019 – revised November 2019",
          retrievedAt: "2026-08-24T10:44:40Z",
          locator: "physical PDF page 10, section 7.3.1 Table 1 Recommended External Components: CVM1 from VM to GND is a recommended 0.1-uF low-ESR ceramic capacitor rated for VM",
        },
      },
    },
    local: {
      role: "local-decoupling-capacitor",
      componentId: "local-decoupling",
      dataKey: "localProfileId",
      partClass: "shared.mlcc-capacitor",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
      manufacturerId: "tdk-corporation",
      manufacturerPartNumber: "C1608X7R1H104K080AA",
      profileContentHash: MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_PROFILE_CONTENT_HASH,
      nominalCapacitanceF: RECOMMENDED_NOMINAL_CAPACITANCE_F,
      source: {
        sourceId: "tdk-c1608x7r1h104k080aa-product-pdf",
        contentHash: MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH,
        url: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info/print_pdf",
        revision: "Generated 2026-08-24 (GMT)",
        retrievedAt: "2026-08-24T05:31:57Z",
        locator: "page 1, Electrical Characteristics, Capacitance = 100 nF ±10 %",
      },
    },
    nonclaims: [
      "manufacturer_required_minimum",
      "capacitance_tolerance_floor",
      "effective_capacitance_under_bias_or_temperature",
      "low_esr",
      "vm_voltage_suitability",
      "placement_or_interconnect",
      "ripple_or_transient_support",
      "switching_safety",
      "overall_candidate_eligibility",
      "selected_part_scenario_or_simulation_fidelity",
    ],
  }],
} as const;

type PrimaryProfile = DesignProfileV32<"motor.integrated-h-bridge">;
type LocalProfile = DesignProfileWithFactsV2<"shared.mlcc-capacitor", FactsV2For<"shared.mlcc-capacitor">>;

function selectedPrimaryProfile(
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
): PrimaryProfile | undefined {
  if (option.data.primaryProfileId !== PRIMARY_PROFILE_ID) return undefined;
  return environment.catalog.profiles.find((profile) => (
    profile.partClass === "motor.integrated-h-bridge"
    && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32
    && designProfileId(profile.partClass, profile.part) === PRIMARY_PROFILE_ID
  )) as PrimaryProfile | undefined;
}

function selectedLocalProfile(
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
): LocalProfile | undefined {
  if (option.data.localProfileId !== LOCAL_PROFILE_ID) return undefined;
  return environment.catalog.profiles.find((profile) => (
    profile.partClass === "shared.mlcc-capacitor"
    && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2
    && designProfileId(profile.partClass, profile.part) === LOCAL_PROFILE_ID
  )) as LocalProfile | undefined;
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

function exactSource(
  evidence: readonly ProfileEvidenceRef[],
  sourceId: string,
  contentHash: string,
): boolean {
  return evidence.length === 1
    && evidence[0]!.sourceId === sourceId
    && evidence[0]!.contentHash === contentHash;
}

function exactPrimaryComponent(component: SelectedComponent | undefined): boolean {
  return component !== undefined
    && component.id === "primary"
    && component.role === "integrated-h-bridge"
    && component.profileId === PRIMARY_PROFILE_ID
    && component.part.manufacturerId === "texas-instruments"
    && component.part.manufacturerPartNumber === "DRV8876PWPR"
    && component.quantityPerAssembly === 1
    && component.value === undefined;
}

function exactLocalComponent(component: SelectedComponent | undefined): boolean {
  return component !== undefined
    && component.id === "local-decoupling"
    && component.role === "local-decoupling-capacitor"
    && component.profileId === LOCAL_PROFILE_ID
    && component.part.manufacturerId === "tdk-corporation"
    && component.part.manufacturerPartNumber === "C1608X7R1H104K080AA"
    && component.quantityPerAssembly === 1
    && component.value?.value === RECOMMENDED_NOMINAL_CAPACITANCE_F
    && component.value.unit === "F"
    && component.value.displayUnit === "F"
    && component.evidence.length === 1
    && component.evidence[0]!.sourceId === "tdk-c1608x7r1h104k080aa-product-pdf"
    && component.evidence[0]!.contentHash === MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH;
}

function nominalRecommendationConstraint(
  predecessor: ConstraintResult,
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
): ConstraintResult {
  const primary = selectedPrimaryProfile(option, environment);
  const local = selectedLocalProfile(option, environment);
  const primaryComponent = option.components.find((component) => component.id === "primary");
  const localComponent = option.components.find((component) => component.id === "local-decoupling");
  const dataKeys = Object.keys(option.data).sort();
  if (
    primary === undefined
    || local === undefined
    || dataKeys.length !== 3
    || dataKeys[0] !== "bulkProfileId"
    || dataKeys[1] !== "localProfileId"
    || dataKeys[2] !== "primaryProfileId"
    || option.components.length !== 3
    || !exactPrimaryComponent(primaryComponent)
    || !exactLocalComponent(localComponent)
    || primary.part.manufacturerId !== "texas-instruments"
    || primary.part.manufacturerPartNumber !== "DRV8876PWPR"
    || designProfileEnvelopeContentHash(primary) !== MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_PROFILE_CONTENT_HASH
    || local.part.manufacturerId !== "tdk-corporation"
    || local.part.manufacturerPartNumber !== "C1608X7R1H104K080AA"
    || designProfileEnvelopeContentHash(local) !== MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_PROFILE_CONTENT_HASH
  ) {
    return predecessor;
  }

  const recommendation = primary.facts.localSupplyDecouplingCapacitance;
  const recommendationRole = primary.facts.localSupplyDecouplingRequirement;
  const selectedNominal = local.facts.nominalCapacitance;
  if (
    recommendation.state !== "reviewed"
    || recommendation.value?.unit !== "F"
    || recommendation.value.value !== RECOMMENDED_NOMINAL_CAPACITANCE_F
    || recommendation.validFor.length !== 0
    || recommendationRole.state !== "reviewed"
    || recommendationRole.value !== "recommended_value"
    || recommendationRole.validFor.length !== 0
    || selectedNominal.state !== "reviewed"
    || selectedNominal.value?.unit !== "F"
    || selectedNominal.value.value !== RECOMMENDED_NOMINAL_CAPACITANCE_F
    || selectedNominal.validFor.length !== 0
    || !exactSource(recommendation.evidence, "ti-drv8876-slvsds7b", MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH)
    || !exactSource(recommendationRole.evidence, "ti-drv8876-slvsds7b", MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH)
    || !exactSource(selectedNominal.evidence, "tdk-c1608x7r1h104k080aa-product-pdf", MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH)
  ) {
    return predecessor;
  }

  return {
    ruleId: LOCAL_CAPACITANCE_NOMINAL_RULE_ID,
    status: "pass",
    explanation: "The exact selected C1608X7R1H104K080AA has a reviewed 100 nF nameplate capacitance, exactly matching the 0.1 uF nominal value TI recommends for DRV8876PWPR CVM1. This pass proves only the nominal-value element of that recommendation. TI does not publish it as a required minimum, and this result does not prove a tolerance floor, effective capacitance under bias or temperature, low ESR, VM-voltage suitability, placement or interconnect, ripple or transient support, switching safety, or overall candidate eligibility.",
    evidence: [
      ...projectedEvidence(selectedNominal.evidence),
      ...projectedEvidence(recommendationRole.evidence),
    ],
  };
}

/**
 * Immutable facts-V3.2 successor. It preserves 3.2.4 behavior and changes only
 * the local nominal-capacitance result for the exact hash-bound DRV8876/C1608
 * physical BOM pairing.
 */
export const MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED: NativeRecipeV2 = Object.freeze({
  ...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED,
  version: RELEASE_V325.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE_V325)),
  applications: Object.freeze([...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.applications]) as NativeRecipeV2["applications"],
  metricDeclarations: Object.freeze(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.metricDeclarations.map((entry) => Object.freeze({ ...entry }))) as NativeRecipeV2["metricDeclarations"],
  check(option: Readonly<NativeMatchedOptionV2>, environment: NativeEnvironmentV2) {
    return MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.check(option, environment).map((constraint) => (
      constraint.ruleId === LOCAL_CAPACITANCE_NOMINAL_RULE_ID
        ? nominalRecommendationConstraint(constraint, option, environment)
        : constraint
    ));
  },
});
