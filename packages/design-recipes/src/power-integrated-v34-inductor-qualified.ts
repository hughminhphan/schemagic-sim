import {
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V34,
  FACTS_SCHEMA_VERSION_V35,
} from "@opencircuit/design-library/v2-runtime";
import { createPowerIntegratedSynchronousBuckStructuralRecipe } from "./power-integrated-v33";
import { createPowerIntegratedSynchronousBuckBehavioralRecipe } from "./power-integrated-v34";
import type { NativeRecipeV2 } from "./types";

export const POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH =
  "sha256:6eb4c18bb984319a5fa56d615f571c03e4fa7670e2782ff4754dbba13dbc89b6" as const;

export const POWER_INTEGRATED_V345_REFERENCE_INDUCTOR_PROFILE_CONTENT_HASH =
  "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b" as const;

export const POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_PROFILE_CONTENT_HASH =
  "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da" as const;

export const POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY = 2 as const;

const RELEASE_V342 = {
  id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
  version: "3.4.2",
  equations: [
    "power.connected-structural-bom-binding.v1",
    "power.feedback-divider-corners.v3-3",
    "power.fixed-oscillator-selection.v3-3",
    "power.ideal-pwm-output-stage-transient.v1",
    "power.mounted-geometry-ranking-proxy.v2",
    "power.inductor.raw-output-current-lower-bound-fail.v1",
  ],
  profileBindings: [{
    role: "power-inductor",
    partClass: "power.power-inductor",
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    profileContentHash: POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH,
  }],
} as const;

const structuralRecipeV342 = createPowerIntegratedSynchronousBuckStructuralRecipe({
  release: RELEASE_V342,
  optionKeyPrefix: "power-v3-4-inductor-qualified-structural",
  inductorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    exactProfileContentHash: POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH,
  },
});

export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE_V342,
    optionKeyPrefix: "power-v3-4-inductor-qualified",
    structuralRecipe: structuralRecipeV342,
  });

const RELEASE_V343 = {
  ...RELEASE_V342,
  version: "3.4.3",
  equations: [
    ...RELEASE_V342.equations,
    "power.request-conditional-load-transient.v1",
  ],
} as const;

const structuralRecipeV343 = createPowerIntegratedSynchronousBuckStructuralRecipe({
  release: RELEASE_V343,
  optionKeyPrefix: "power-v3-4-inductor-qualified-request-conditional-structural",
  inductorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    exactProfileContentHash: POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH,
  },
  omitLoadTransientConstraintWhenUnrequested: true,
});

/**
 * Immutable successor that emits the load-transient requirement only when the
 * request supplies a numeric transient target. It does not claim transient
 * performance or change any other constraint disposition.
 */
export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE_V343,
    optionKeyPrefix: "power-v3-4-inductor-qualified-request-conditional",
    structuralRecipe: structuralRecipeV343,
  });

const RELEASE_V344 = {
  ...RELEASE_V343,
  version: "3.4.4",
  equations: [
    ...RELEASE_V343.equations,
    "power.request-dc-output-voltage-regulation-envelope.v1",
  ],
} as const;

const structuralRecipeV344 = createPowerIntegratedSynchronousBuckStructuralRecipe({
  release: RELEASE_V344,
  optionKeyPrefix: "power-v3-4-inductor-qualified-dc-regulation-structural",
  inductorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    exactProfileContentHash: POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH,
  },
  omitLoadTransientConstraintWhenUnrequested: true,
  evaluateDcOutputVoltageRegulationEnvelope: true,
});

/**
 * Immutable successor that may close only the divider DC-regulation rule, and
 * only against an explicit absolute request envelope. Every other engineering
 * boundary retains the V3.4.3 disposition.
 */
export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE_V344,
    optionKeyPrefix: "power-v3-4-inductor-qualified-dc-regulation",
    structuralRecipe: structuralRecipeV344,
  });

const RELEASE_V345 = {
  ...RELEASE_V344,
  version: "3.4.5",
  equations: [
    ...RELEASE_V344.equations,
    "power.passive-selection.maximum-load-observation-envelope.v1",
    "power.output-capacitor.parallel-bank-quantity.v1",
  ],
  profileBindings: [
    {
      role: "output-capacitor",
      partClass: "shared.mlcc-capacitor",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
      profileContentHash: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_PROFILE_CONTENT_HASH,
      quantityPerAssembly: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY,
    },
    {
      role: "power-inductor",
      partClass: "power.power-inductor",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
      profileContentHash: POWER_INTEGRATED_V345_REFERENCE_INDUCTOR_PROFILE_CONTENT_HASH,
    },
  ],
} as const;

const structuralRecipeV345 = createPowerIntegratedSynchronousBuckStructuralRecipe({
  release: RELEASE_V345,
  optionKeyPrefix: "power-v3-4-reference-passives-structural",
  inductorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    exactProfileContentHash: POWER_INTEGRATED_V345_REFERENCE_INDUCTOR_PROFILE_CONTENT_HASH,
  },
  outputCapacitorContract: {
    exactProfileContentHash: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_PROFILE_CONTENT_HASH,
    quantityPerAssembly: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY,
  },
  evaluatePassiveSelectionV1: true,
  omitLoadTransientConstraintWhenUnrequested: true,
  evaluateDcOutputVoltageRegulationEnvelope: true,
});

/**
 * Immutable exact-reference-passive successor. It binds one 10 uH inductor
 * and two separate 22 uF output-capacitor instances, evaluates the pure
 * passive kernel only over the explicit maximum-load observation envelope,
 * and retains every unsupported production boundary as unknown.
 */
export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE_V345,
    optionKeyPrefix: "power-v3-4-reference-passives",
    structuralRecipe: structuralRecipeV345,
  });

const RELEASE_V346 = {
  ...RELEASE_V345,
  version: "3.4.6",
  equations: [
    ...RELEASE_V345.equations,
    "power.passive-operating-observation-metrics.v1",
  ],
} as const;

const structuralRecipeV346 = createPowerIntegratedSynchronousBuckStructuralRecipe({
  release: RELEASE_V346,
  optionKeyPrefix: "power-v3-4-reference-passive-observations-structural",
  inductorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    exactProfileContentHash: POWER_INTEGRATED_V345_REFERENCE_INDUCTOR_PROFILE_CONTENT_HASH,
  },
  outputCapacitorContract: {
    exactProfileContentHash: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_PROFILE_CONTENT_HASH,
    quantityPerAssembly: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY,
  },
  evaluatePassiveSelectionV1: true,
  surfacePassiveOperatingObservationsV1: true,
  omitLoadTransientConstraintWhenUnrequested: true,
  evaluateDcOutputVoltageRegulationEnvelope: true,
});

/**
 * Immutable exact-reference-passive successor that exposes the existing pure
 * passive kernel's maximum-load operating-current projections as estimated
 * candidate metrics. It does not change any V3.4.5 constraint disposition,
 * eligibility boundary, selected BOM, or simulation/model authority.
 */
export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE_V346,
    optionKeyPrefix: "power-v3-4-reference-passive-observations",
    structuralRecipe: structuralRecipeV346,
  });

export const POWER_INTEGRATED_V35_REFERENCE_INDUCTOR_PROFILE_ID =
  "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json" as const;
export const POWER_INTEGRATED_V35_REFERENCE_OUTPUT_CAPACITOR_PROFILE_ID =
  "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json" as const;
export const POWER_INTEGRATED_V35_CURRENT_LIMIT_MARGIN_RATIO = 0.2 as const;

const RELEASE_V350 = {
  ...RELEASE_V346,
  id: "power.native.integrated-synchronous-buck.facts-v3-5-bound-calculators",
  version: "3.5.0",
  equations: [
    ...RELEASE_V346.equations,
    "power.integrated-loss-and-junction-temperature.v1",
    "power.current-limit-minimum-to-peak-margin.v1",
  ],
  profileBindings: [
    {
      role: "output-capacitor",
      partClass: "shared.mlcc-capacitor",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V35,
      profileId: POWER_INTEGRATED_V35_REFERENCE_OUTPUT_CAPACITOR_PROFILE_ID,
      quantityPerAssembly: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY,
    },
    {
      role: "power-inductor",
      partClass: "power.power-inductor",
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V35,
      profileId: POWER_INTEGRATED_V35_REFERENCE_INDUCTOR_PROFILE_ID,
    },
  ],
  currentLimitRequiredMarginRatio: POWER_INTEGRATED_V35_CURRENT_LIMIT_MARGIN_RATIO,
  thermalResistanceBoardQualifier: "declared",
} as const;

const structuralRecipeV350 = createPowerIntegratedSynchronousBuckStructuralRecipe({
  release: RELEASE_V350,
  optionKeyPrefix: "power-v3-5-bound-calculators-structural",
  primaryFactsSchemaVersion: FACTS_SCHEMA_VERSION_V35,
  inductorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V35,
    profileId: POWER_INTEGRATED_V35_REFERENCE_INDUCTOR_PROFILE_ID,
  },
  outputCapacitorContract: {
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V35,
    profileId: POWER_INTEGRATED_V35_REFERENCE_OUTPUT_CAPACITOR_PROFILE_ID,
    quantityPerAssembly: POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY,
  },
  evaluatePassiveSelectionV1: true,
  surfacePassiveOperatingObservationsV1: true,
  omitLoadTransientConstraintWhenUnrequested: true,
  evaluateDcOutputVoltageRegulationEnvelope: true,
  currentLimitRequiredMarginRatio: POWER_INTEGRATED_V35_CURRENT_LIMIT_MARGIN_RATIO,
  thermalResistanceBoardQualifier: "declared",
});

/**
 * Additive facts-V3.5 successor. It emits no candidate while the installed
 * catalog lacks the exact bound-typed profiles. Once those profiles are
 * admitted, every calculator remains fail-closed on missing or condition-
 * mismatched inputs.
 */
export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V35_BOUND_CALCULATORS: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE_V350,
    optionKeyPrefix: "power-v3-5-bound-calculators",
    structuralRecipe: structuralRecipeV350,
  });
