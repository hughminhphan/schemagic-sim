import { describe, expect, it } from "vitest";
import { componentPinPointsV2, validateCircuitV2 } from "@opencircuit/circuit-schema";
import {
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V3,
  POWER_CONDITION_PARAMETER_SPECS_V2,
  POWER_EXTERNAL_CLAIM_SPECS_V2,
  POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2,
  POWER_EXTERNAL_REQUIRED_CONDITIONS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  POWER_INTEGRATED_REQUIRED_CONDITIONS_V2,
  admissionContentHash,
  canonicalDesignProfileEnvelope,
  compareAscii,
  contentHash,
  designProfileEnvelopeContentHash,
  designProfileId,
  designProfilePath,
  getDesignProfileCodecForVersion,
  loadReviewedDesignLibraryEnvelope,
  parseDesignProfileForV2,
  parseDesignProfileForV3,
  reviewedAdmissionProjection,
  validateDesignLibraryEnvelope,
  validateDesignProfileEnvelope,
  type ConfiguredProductionSpreadV2,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileEnvelope,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type MountedGeometryFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
  type ProfileConditionV2,
  type ProfileEvidenceRef,
  type ProfileQuantity,
} from "@opencircuit/design-library";
import {
  SYNTHETIC_MANUFACTURER_REGISTRY,
  createSyntheticReviewedLibraryFixture,
  createSyntheticReviewedProfile,
} from "@opencircuit/design-library/fixtures";
import {
  DESIGN_V2_MAX_OPTIONS_PER_RECIPE,
  type BuckDesignRequestV2,
} from "@opencircuit/design-schema";
import { createInstalledNativeRecipeSets } from "../src";
import { POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3 } from "../src/power-external-v3";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED } from "../src/power-integrated-v34-inductor-qualified";
import { POWER_NATIVE_RECIPE_FACTS_V2 } from "../src/power-v2";
import type { NativeCandidateV2, NativeEnvironmentV2, NativeRecipeV2 } from "../src/types";
import manufacturerRegistryJson from "../../design-library/manufacturers.json";
import csd18540q5bJson from "../../design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";

type IntegratedProfileV2 = DesignProfileWithFactsV2<
  "power.integrated-synchronous-buck-regulator",
  FactsV2For<"power.integrated-synchronous-buck-regulator">
>;
type ExternalProfileV2 = DesignProfileWithFactsV2<
  "power.external-fet-synchronous-buck-controller",
  FactsV2For<"power.external-fet-synchronous-buck-controller">
>;

function evidence(): ProfileEvidenceRef[] {
  return structuredClone(createSyntheticReviewedProfile("shared.general-purpose-resistor").commonFacts.packageName.evidence);
}

function unknownLegacyGeometry(label: string) {
  return {
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation: `${label} is carried only by mountedGeometry in facts schema V2.`,
  };
}

function mountedGeometry(area = 2e-6, height = 1e-3): MountedGeometryFactsV2["mountedGeometry"] {
  const sourceEvidence = evidence();
  return {
    boardArea: {
      value: {
        area: { value: area, unit: "m2", displayUnit: "mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "land-x", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(sourceEvidence) },
          { axis: "y", dimensionId: "land-y", multiplier: 1, maximum: { value: area / 1e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(sourceEvidence) },
        ],
      },
      state: "calculated",
      evidence: structuredClone(sourceEvidence),
      validFor: [],
      explanation: "Synthetic reviewed manufacturer land-pattern rectangle.",
    },
    maximumHeight: {
      value: {
        height: { value: height, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      state: "reviewed",
      evidence: structuredClone(sourceEvidence),
      validFor: [],
      explanation: "Synthetic reviewed maximum mounted package height.",
    },
  };
}

function condition(parameterId: string, narrowJunction = false): ProfileConditionV2 {
  const spec = POWER_CONDITION_PARAMETER_SPECS_V2[parameterId as keyof typeof POWER_CONDITION_PARAMETER_SPECS_V2];
  if (spec.kind === "token_equals") return { parameterId, kind: "token_equals", value: "synthetic-condition", evidence: evidence() };
  const minimum = parameterId === "junction-temperature" && narrowJunction ? 300 : spec.domain === "positive" ? 1 : 0;
  const maximum = parameterId === "junction-temperature" && narrowJunction ? 350 : spec.unit === "Hz" ? 2e6 : spec.unit === "K" ? 500 : 100;
  return {
    parameterId,
    kind: "quantity_range",
    minimum: { value: minimum, unit: spec.unit, displayUnit: spec.unit },
    maximum: { value: maximum, unit: spec.unit, displayUnit: spec.unit },
    evidence: evidence(),
  };
}

function integratedValue(field: keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2): number {
  return ({
    inputVoltageMinimum: 3,
    inputVoltageMaximum: 20,
    outputVoltageMinimum: 0.5,
    outputVoltageMaximum: 12,
    outputCurrentCapabilityMinimum: 5,
    currentLimitMinimum: 5,
    currentLimitTypical: 6,
    currentLimitMaximum: 7,
    switchingFrequencyMinimum: 100_000,
    switchingFrequencyRecommended: 500_000,
    switchingFrequencyMaximum: 1_000_000,
    minimumOnTimeMaximum: 1e-7,
    minimumOffTimeMaximum: 1e-7,
    feedbackReferenceMinimum: 1,
    feedbackReferenceTypical: 1,
    feedbackReferenceMaximum: 1,
    quiescentCurrentMaximum: 1e-3,
    junctionToAmbientThermalResistanceMaximum: 40,
    maximumJunctionTemperature: 450,
    highSideOnResistanceMaximum: 0.1,
    lowSideOnResistanceMaximum: 0.1,
    riseTimeMaximum: 1e-8,
    fallTimeMaximum: 1e-8,
  } satisfies Record<keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2, number>)[field];
}

function integratedProfile(narrowFeedbackContext = false): IntegratedProfileV2 {
  const base = createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator");
  const claims = Object.fromEntries(Object.entries(POWER_INTEGRATED_CLAIM_SPECS_V2).map(([rawField, spec]) => {
    const field = rawField as keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2;
    return [field, {
      claimKind: spec.claimKind,
      basis: spec.basis,
      value: { value: integratedValue(field), unit: spec.unit, displayUnit: spec.unit },
      state: "reviewed",
      evidence: evidence(),
      validFor: POWER_INTEGRATED_REQUIRED_CONDITIONS_V2[field].map((parameterId) => condition(parameterId, narrowFeedbackContext && field.startsWith("feedbackReference"))),
      explanation: `Synthetic reviewed ${field} claim.`,
    }];
  }));
  return {
    ...structuredClone(base),
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: structuredClone(base.commonFacts.packageName),
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: {
      ...claims,
      controlEvidenceBasis: { value: "synthetic-control-table", state: "reviewed", evidence: evidence(), validFor: [], explanation: "Synthetic reviewed control evidence basis." },
      mountedGeometry: mountedGeometry(3e-6),
    },
  } as unknown as IntegratedProfileV2;
}

function externalValue(field: keyof typeof POWER_EXTERNAL_CLAIM_SPECS_V2): number {
  return ({
    inputVoltageMinimum: 3,
    inputVoltageMaximum: 60,
    outputVoltageMinimum: 0.5,
    outputVoltageMaximum: 30,
    switchingFrequencyMinimum: 100_000,
    switchingFrequencyRecommended: 500_000,
    switchingFrequencyMaximum: 1_000_000,
    minimumOnTimeMaximum: 1e-7,
    minimumOffTimeMaximum: 1e-7,
    feedbackReferenceMinimum: 1,
    feedbackReferenceTypical: 1,
    feedbackReferenceMaximum: 1,
    quiescentCurrentMaximum: 2e-3,
    junctionToAmbientThermalResistanceMaximum: 50,
    maximumJunctionTemperature: 450,
    gateSourceCurrentMinimum: 1,
    gateSinkCurrentMinimum: 1,
    gatePullupResistanceMaximum: 2,
    gatePulldownResistanceMaximum: 2,
    deadTimeMaximum: 1e-7,
    controllerLossMaximum: 1,
  } satisfies Record<keyof typeof POWER_EXTERNAL_CLAIM_SPECS_V2, number>)[field];
}

function configuredOption(
  settingId: string,
  settingValue: string,
  values: readonly [number, number, number],
  requiredConditions: readonly string[],
): ConfiguredProductionSpreadV2<"V"> {
  const settingEvidence = evidence();
  const claim = <Kind extends "guaranteed_minimum" | "typical" | "guaranteed_maximum">(claimKind: Kind, value: number) => ({
    claimKind,
    basis: "production_spread" as const,
    value: { value, unit: "V" as const, displayUnit: "V" },
    state: "reviewed" as const,
    evidence: structuredClone(settingEvidence),
    validFor: requiredConditions.map((parameterId) => condition(parameterId)),
    explanation: `Synthetic reviewed ${settingId} ${claimKind} claim.`,
  });
  return {
    settingId,
    setting: { value: settingValue, state: "reviewed", evidence: structuredClone(settingEvidence), validFor: [], explanation: `Synthetic reviewed ${settingId} setting.` },
    minimum: claim("guaranteed_minimum", values[0]),
    typical: claim("typical", values[1]),
    maximum: claim("guaranteed_maximum", values[2]),
  };
}

function externalProfile(): ExternalProfileV2 {
  const base = createSyntheticReviewedProfile("power.external-fet-synchronous-buck-controller");
  const claims = Object.fromEntries(Object.entries(POWER_EXTERNAL_CLAIM_SPECS_V2).map(([rawField, spec]) => {
    const field = rawField as keyof typeof POWER_EXTERNAL_CLAIM_SPECS_V2;
    return [field, {
      claimKind: spec.claimKind,
      basis: spec.basis,
      value: { value: externalValue(field), unit: spec.unit, displayUnit: spec.unit },
      state: "reviewed",
      evidence: evidence(),
      validFor: POWER_EXTERNAL_REQUIRED_CONDITIONS_V2[field].map((parameterId) => condition(parameterId)),
      explanation: `Synthetic reviewed ${field} claim.`,
    }];
  }));
  return {
    ...structuredClone(base),
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: structuredClone(base.commonFacts.packageName),
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: {
      ...claims,
      currentSenseThresholdOptions: [
        configuredOption("sense-high", "sense-high", [0.09, 0.1, 0.11], POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.currentSenseThresholdOptions),
        configuredOption("sense-low", "sense-low", [0.045, 0.05, 0.055], POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.currentSenseThresholdOptions),
      ],
      gateDriveVoltageOptions: [
        configuredOption("gate-5v", "gate-5v", [4.5, 5, 5.5], POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.gateDriveVoltageOptions),
        configuredOption("gate-8v", "gate-8v", [7.5, 8, 8.5], POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.gateDriveVoltageOptions),
      ],
      controlEvidenceBasis: { value: "synthetic-control-table", state: "reviewed", evidence: evidence(), validFor: [], explanation: "Synthetic reviewed control evidence basis." },
      mountedGeometry: mountedGeometry(4e-6),
    },
  } as unknown as ExternalProfileV2;
}

function externalProfileWithOptionCounts(
  manufacturerPartNumber: string,
  currentSenseCount: number,
  gateDriveCount: number,
): ExternalProfileV2 {
  const profile = structuredClone(externalProfile());
  profile.part.manufacturerPartNumber = manufacturerPartNumber;
  profile.facts.currentSenseThresholdOptions = Array.from({ length: currentSenseCount }, (_, index) => {
    const settingId = `sense-${String(index).padStart(3, "0")}`;
    return configuredOption(settingId, settingId, [0.09, 0.1, 0.11], POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.currentSenseThresholdOptions);
  });
  profile.facts.gateDriveVoltageOptions = Array.from({ length: gateDriveCount }, (_, index) => {
    const settingId = `gate-${String(index).padStart(3, "0")}`;
    return configuredOption(settingId, settingId, [4.5, 5, 5.5], POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.gateDriveVoltageOptions);
  });
  return profile;
}

function passiveProfile<ClassId extends Exclude<PartClassId, "power.integrated-synchronous-buck-regulator" | "power.external-fet-synchronous-buck-controller">>(
  partClass: ClassId,
  manufacturerPartNumber: string,
  facts: Record<string, number> = {},
  area = 2e-6,
): DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>> {
  const base = createSyntheticReviewedProfile(partClass);
  base.part.manufacturerPartNumber = manufacturerPartNumber;
  for (const [factId, value] of Object.entries(facts)) {
    const fact = (base.facts as Record<string, { value: ProfileQuantity | null }>)[factId];
    if (!fact?.value) throw new Error(`Missing synthetic fact ${factId}`);
    fact.value.value = value;
  }
  return {
    ...structuredClone(base),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: structuredClone(base.commonFacts.packageName),
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: { ...structuredClone(base.facts), mountedGeometry: mountedGeometry(area) },
  } as unknown as DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>;
}

function request(topology: "power.buck.integrated-synchronous" | "power.buck.controller-external-nmos"): BuckDesignRequestV2 {
  return {
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    objective: "area",
    requirements: {
      inputVoltage: { minimum: { value: 6, unit: "V", displayUnit: "V" }, nominal: { value: 9, unit: "V", displayUnit: "V" }, maximum: { value: 12, unit: "V", displayUnit: "V" } },
      outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
      maximumOutputCurrent: { value: 2, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: 300, unit: "K", displayUnit: "K" },
      switchingFrequency: { selection: "fixed", minimum: { value: 100_000, unit: "Hz", displayUnit: "Hz" }, preferred: { value: 500_000, unit: "Hz", displayUnit: "Hz" }, maximum: { value: 1_000_000, unit: "Hz", displayUnit: "Hz" } },
      maximumOutputRipple: { value: 0.05, unit: "V", displayUnit: "V" },
      loadTransientTarget: null,
    },
    constraints: {
      allowedTopologyFamilies: [topology],
      maximumJunctionTemperature: { value: 400, unit: "K", displayUnit: "K" },
      allowedPackages: [],
      maximumComponentHeight: { value: 2e-3, unit: "m", displayUnit: "mm" },
      maximumBoardArea: { value: 100e-6, unit: "m2", displayUnit: "mm²" },
      allowEstimatedValues: false,
      allowUnknownWarnings: false,
      allowUnknownHardConstraints: true,
    },
    assumptions: [{
      id: "synthetic.reviewed-facts-v2",
      description: "This test exercises only reviewed synthetic facts-V2 documents and claims no production admission.",
      source: "fixture",
      affects: ["requirements", "constraints"],
    }],
    libraryVersion: "synthetic-facts-v2.1",
  };
}

function passives(): DesignProfileEnvelope[] {
  return [
    passiveProfile("shared.mlcc-capacitor", "C-25V", { nominalCapacitance: 10e-6, ratedVoltage: 25 }, 2e-6),
    passiveProfile("power.power-inductor", "L-4U7", { inductance: 4.7e-6, saturationCurrent: 5, rmsCurrent: 4 }, 5e-6),
    passiveProfile("shared.general-purpose-resistor", "R-LOWER", { resistance: 1_000, tolerance: 0 }, 1e-6),
    passiveProfile("shared.general-purpose-resistor", "R-UPPER", { resistance: 4_000, tolerance: 0 }, 1e-6),
  ];
}

function reviewedDocuments(profiles: readonly DesignProfileEnvelope[]): DesignLibraryDocuments {
  const documents = structuredClone(createSyntheticReviewedLibraryFixture(profiles.map((profile) => profile.partClass))) as DesignLibraryDocuments;
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  const oldPaths = Object.keys(documents.profiles);
  const rewrittenProfiles: Record<string, DesignProfileEnvelope> = {};
  profiles.forEach((profile, index) => {
    const oldPath = oldPaths[index]!;
    const path = designProfilePath(profile.partClass, profile.part);
    const hash = designProfileEnvelopeContentHash(profile);
    rewrittenProfiles[path] = structuredClone(profile);
    const entry = admission.entries.find((candidate) => candidate.profilePath === oldPath)!;
    entry.partClass = profile.partClass;
    entry.part = { ...profile.part };
    entry.profilePath = path;
    entry.profileContentHash = hash;
    const ref = release.profiles.find((candidate) => candidate.profilePath === oldPath)!;
    ref.profileId = designProfileId(profile.partClass, profile.part);
    ref.profilePath = path;
    ref.partClass = profile.partClass;
    ref.part = { ...profile.part };
    ref.profileContentHash = hash;
  });
  documents.profiles = rewrittenProfiles;
  admission.entries.sort((left, right) => compareAscii(left.profilePath, right.profilePath));
  release.profiles.sort((left, right) => compareAscii(left.profileId, right.profileId));
  release.admissionContentHash = admissionContentHash(admission);
  release.contentHash = contentHash({
    manufacturerRegistry: documents.manufacturerRegistry,
    admission: reviewedAdmissionProjection(admission),
    profiles: [...profiles]
      .sort((left, right) => compareAscii(designProfilePath(left.partClass, left.part), designProfilePath(right.partClass, right.part)))
      .map(canonicalDesignProfileEnvelope),
  });
  return documents;
}

function environment(primary: DesignProfileEnvelope, topology: Parameters<typeof request>[0], extras: DesignProfileEnvelope[] = []): NativeEnvironmentV2 {
  const profiles = [primary, ...passives(), ...extras]
    .sort((left, right) => compareAscii(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
  const documents = reviewedDocuments(profiles);
  expect(validateDesignLibraryEnvelope(documents)).toEqual([]);
  const reviewed = loadReviewedDesignLibraryEnvelope(documents);
  return { request: request(topology), catalog: { profiles: reviewed.profiles }, manifest: { version: reviewed.version } };
}

function bothPowerTopologies(environment: NativeEnvironmentV2): NativeEnvironmentV2 {
  if (environment.request.application !== "power.buck") throw new TypeError("Expected a Power request");
  return {
    ...environment,
    request: {
      ...environment.request,
      constraints: {
        ...environment.request.constraints,
        allowedTopologyFamilies: [
          "power.buck.controller-external-nmos",
          "power.buck.integrated-synchronous",
        ],
      },
    },
  };
}

function run(environment: NativeEnvironmentV2, optionIndex = 0, recipe: NativeRecipeV2 = POWER_NATIVE_RECIPE_FACTS_V2) {
  const enumerated = recipe.enumerate(environment);
  const solved = recipe.solve(enumerated[optionIndex]!, environment);
  if (solved.status !== "ok") throw new Error(`Expected solved option: ${solved.reason}`);
  const matched = recipe.match(solved.value, environment)[0]!;
  if (matched.status !== "ok") throw new Error(`Expected matched option: ${matched.reason}`);
  const constraints = recipe.check(matched.value, environment);
  const estimate = recipe.estimate(matched.value, constraints, environment);
  return { enumerated, solved: solved.value, matched: matched.value, constraints, estimate };
}

describe("additive facts-V2 native Power recipe", () => {
  it("preserves the installed Power ranking declaration seam", () => {
    expect(POWER_NATIVE_RECIPE_FACTS_V2.contentHash).toBe("sha256:639380e8e9bd232d69d3038f3f263a8e5f708fa7f7a6f2262bd32944e7916eb5");
    expect(POWER_NATIVE_RECIPE_FACTS_V2.metricDeclarations).toEqual([
      { id: "power.native.board-area", unit: "m2" },
      { id: "power.native.component-count", unit: "count" },
    ]);
  });

  it("runs an integrated reviewed facts-V2 BOM while keeping unproved requirements hard unknown", () => {
    const v1Lookalike = createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator");
    v1Lookalike.part.manufacturerPartNumber = "V1-MUST-NOT-ENUMERATE";
    const env = environment(integratedProfile(), "power.buck.integrated-synchronous", [v1Lookalike]);
    const result = run(env);
    expect(result.enumerated).toHaveLength(1);
    expect(result.matched.components.map((component) => component.id)).toEqual([
      "feedback-lower", "feedback-upper", "input-capacitor", "output-capacitor", "power-inductor", "primary",
    ]);
    expect(result.constraints.filter((constraint) => constraint.status === "pass").map((constraint) => constraint.ruleId)).toEqual(expect.arrayContaining([
      "power.feedback.output-voltage",
      "power.regulator.absolute-maximum-junction",
      "power.regulator.input-maximum",
      "power.regulator.input-minimum",
      "power.regulator.output-current",
      "power.regulator.output-maximum",
      "power.regulator.output-minimum",
      "power.regulator.switching-maximum",
      "power.regulator.switching-minimum",
      "power.assembly.component-height",
    ]));
    expect(result.constraints.filter((constraint) => constraint.status === "unknown").map((constraint) => constraint.ruleId)).toEqual(expect.arrayContaining([
      "power.assembly.board-area",
      "power.control.loop-stability",
      "power.inductor.ripple-current",
      "power.passive.capacitor-voltage",
      "power.request.output-ripple",
      "power.thermal.maximum-junction",
    ]));
    expect(result.estimate.metrics.find((metric) => metric.id === "power.native.board-area")).toMatchObject({ state: "calculated" });
    expect(result.estimate.metrics.find((metric) => metric.id === "power.native.board-area")!.explanation).toContain("Ranking-only");
  });

  it("enumerates and resolves exact external configured options before leaving feasibility unknown", () => {
    const env = environment(externalProfile(), "power.buck.controller-external-nmos", [
      passiveProfile("shared.n-channel-power-mosfet", "Q-NMOS", {}, 3e-6),
      passiveProfile("shared.current-sense-resistor", "R-SENSE", { resistance: 0.01 }, 1e-6),
    ]);
    const reversed = { ...env, catalog: { profiles: [...env.catalog.profiles].reverse() } };
    const options = POWER_NATIVE_RECIPE_FACTS_V2.enumerate(env);
    expect(options).toHaveLength(4);
    expect(POWER_NATIVE_RECIPE_FACTS_V2.enumerate(reversed)).toEqual(options);
    expect(new Set(options.map((option) => option.optionKey))).toHaveLength(4);
    const result = run(env, 0);
    expect(result.solved.data.currentSenseSettingId).toMatch(/^sense-/);
    expect(result.solved.data.gateDriveSettingId).toMatch(/^gate-/);
    expect(result.solved.data.currentSenseThresholdMinimum).not.toBeNull();
    expect(result.solved.data.gateDriveVoltageMaximum).not.toBeNull();
    expect(result.constraints.some((constraint) => constraint.ruleId.startsWith("power.controller.current-sense-setting.") && constraint.status === "pass")).toBe(true);
    expect(result.constraints.some((constraint) => constraint.ruleId.startsWith("power.controller.gate-drive-setting.") && constraint.status === "pass")).toBe(true);
    expect(result.constraints).toContainEqual(expect.objectContaining({ ruleId: "power.controller.current-sense-feasibility", status: "unknown" }));
    expect(result.constraints).toContainEqual(expect.objectContaining({ ruleId: "power.controller.gate-drive-compatibility", status: "unknown" }));
    expect(result.matched.components.map((component) => component.id)).toEqual(expect.arrayContaining(["current-sense-resistor", "high-side-mosfet", "low-side-mosfet"]));
  });

  it("binds the exact reviewed facts-V3 CSD18540Q5B in a dedicated external-FET contract without an integrated-primary dependency", () => {
    const codec = getDesignProfileCodecForVersion("shared.n-channel-power-mosfet", FACTS_SCHEMA_VERSION_V3);
    const reviewedMosfet = parseDesignProfileForV3(
      codec,
      csd18540q5bJson,
      manufacturerRegistryJson as unknown as ManufacturerRegistryV1,
    );
    expect(codec.validateAdmission(reviewedMosfet)).toEqual([]);
    expect(canonicalDesignProfileEnvelope(reviewedMosfet)).toBe(
      canonicalDesignProfileEnvelope(csd18540q5bJson as unknown as DesignProfileEnvelope),
    );

    const v2Environment = environment(externalProfile(), "power.buck.controller-external-nmos", [
      passiveProfile("shared.n-channel-power-mosfet", "Q-V2-MUST-NOT-BIND", {}, 3e-6),
      passiveProfile("shared.current-sense-resistor", "R-SENSE", { resistance: 0.01 }, 1e-6),
    ]);
    const exactV3Bytes = canonicalDesignProfileEnvelope(reviewedMosfet);
    const mixedEnvironment: NativeEnvironmentV2 = {
      ...v2Environment,
      catalog: { profiles: [...v2Environment.catalog.profiles, reviewedMosfet] },
    };

    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3).toMatchObject({
      id: "power.native.external-fet-synchronous-buck.facts-v3",
      version: "3.0.0",
      contentHash: "sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538",
    });
    const result = run(mixedEnvironment, 0, POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3);
    const mosfetProfileId = designProfileId(reviewedMosfet.partClass, reviewedMosfet.part);
    expect(result.matched.components.filter((component) => component.id.endsWith("-mosfet"))).toEqual([
      expect.objectContaining({ id: "high-side-mosfet", profileId: mosfetProfileId }),
      expect.objectContaining({ id: "low-side-mosfet", profileId: mosfetProfileId }),
    ]);
    expect(result.matched.components.some((component) => component.part.manufacturerPartNumber === "Q-V2-MUST-NOT-BIND")).toBe(false);
    for (const component of result.matched.components.filter((candidate) => !candidate.id.endsWith("-mosfet"))) {
      expect(mixedEnvironment.catalog.profiles.find((profile) => designProfileId(profile.partClass, profile.part) === component.profileId)?.factsSchemaVersion)
        .toBe(FACTS_SCHEMA_VERSION_V2);
    }
    expect(result.matched.simulationCoverage).toEqual([{
      scenarioId: "catalog-native-model",
      modelTier: "unavailable",
      limitations: ["No reviewed executable model is bundled for the exact facts-V2 primary and selected facts-V3 MOSFET stage."],
    }]);
    expect(result.constraints).toContainEqual(expect.objectContaining({ ruleId: "power.controller.gate-drive-compatibility", status: "unknown" }));
    expect(result.constraints).toContainEqual(expect.objectContaining({ ruleId: "power.external.mosfet-safe-operating-area", status: "unknown" }));
    expect(canonicalDesignProfileEnvelope(reviewedMosfet)).toBe(exactV3Bytes);

    const irrelevantIntegratedPrimary = integratedProfile();
    const withIrrelevantIntegratedPrimary = bothPowerTopologies({
      ...mixedEnvironment,
      catalog: { profiles: [...mixedEnvironment.catalog.profiles, irrelevantIntegratedPrimary] },
    });
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.enumerate(withIrrelevantIntegratedPrimary)).toHaveLength(4);
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.enumerate(withIrrelevantIntegratedPrimary)
      .every((option) => option.data.primaryPartClass === "power.external-fet-synchronous-buck-controller")).toBe(true);
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.enumerate({
      ...withIrrelevantIntegratedPrimary,
      catalog: {
        profiles: withIrrelevantIntegratedPrimary.catalog.profiles.filter((profile) => (
          profile.partClass !== "power.external-fet-synchronous-buck-controller"
        )),
      },
    })).toEqual([]);

    const withTooManyIntegratedPrimaries: NativeEnvironmentV2 = {
      ...withIrrelevantIntegratedPrimary,
      catalog: {
        profiles: [
          ...mixedEnvironment.catalog.profiles,
          ...Array.from({ length: DESIGN_V2_MAX_OPTIONS_PER_RECIPE + 1 }, (_, index) => ({
            ...irrelevantIntegratedPrimary,
            part: {
              ...irrelevantIntegratedPrimary.part,
              manufacturerPartNumber: `INTEGRATED-IRRELEVANT-${String(index).padStart(4, "0")}`,
            },
          })),
        ],
      },
    };
    expect(run(withTooManyIntegratedPrimaries, 0, POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3)).toEqual(result);

    const invalidIntegratedPrimary = structuredClone(irrelevantIntegratedPrimary) as unknown as DesignProfileEnvelope;
    delete (invalidIntegratedPrimary as unknown as { facts: Record<string, unknown> }).facts.inputVoltageMinimum;
    const withInvalidIntegratedPrimary: NativeEnvironmentV2 = {
      ...withIrrelevantIntegratedPrimary,
      catalog: { profiles: [...mixedEnvironment.catalog.profiles, invalidIntegratedPrimary] },
    };
    expect(run(withInvalidIntegratedPrimary, 0, POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3)).toEqual(result);

    const forgedData = {
      ...result.matched.data,
      primaryPartClass: "power.integrated-synchronous-buck-regulator",
      primaryProfileId: designProfileId(irrelevantIntegratedPrimary.partClass, irrelevantIntegratedPrimary.part),
    };
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.solve(
      { data: forgedData },
      withInvalidIntegratedPrimary,
    )).toEqual(expect.objectContaining({ status: "rejected" }));
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.match(
      { ...result.solved, data: forgedData },
      withInvalidIntegratedPrimary,
    )).toEqual([expect.objectContaining({ status: "rejected" })]);
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.check(
      { ...result.matched, data: forgedData },
      withInvalidIntegratedPrimary,
    )).toEqual([expect.objectContaining({ ruleId: "power.profile.primary", status: "unknown" })]);
    expect(() => POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.estimate(
      { ...result.matched, data: forgedData },
      [],
      withInvalidIntegratedPrimary,
    )).toThrow(/cannot estimate a non-controller primary option/);

    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.id,
      libraryVersion: String((mixedEnvironment.manifest as { version: string }).version),
      data: result.matched.data,
      components: result.matched.components,
      derivedValues: result.matched.derivedValues,
      constraints: result.constraints,
      metrics: {
        values: result.estimate.metrics,
        warningCount: result.constraints.filter((entry) => entry.status === "warning").length,
        estimateCount: result.estimate.metrics.filter((entry) => entry.state === "estimated").length,
        unknownCount: result.constraints.filter((entry) => entry.status === "unknown").length
          + result.estimate.metrics.filter((entry) => entry.state === "unknown").length,
      },
      simulationCoverage: result.matched.simulationCoverage,
      warnings: result.matched.warnings,
    };
    const materialized = POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.materialize(candidate, mixedEnvironment);
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.materialize(candidate, mixedEnvironment)).toEqual(materialized);
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.materialize(candidate, withInvalidIntegratedPrimary)).toEqual(materialized);
    expect(validateCircuitV2(materialized.circuit)).toEqual([]);
    expect(materialized.circuit.defaultCircuitId).toBe("assembly");
    expect(materialized.circuit.defaultScenarioId).toBeNull();
    expect(materialized.circuit.scenarios).toEqual([]);
    expect(materialized.circuit.circuits).toHaveLength(1);
    expect(materialized.circuit.circuits[0]!.wires.length).toBeGreaterThan(0);
    expect(materialized.circuitBomNonRepresentations).toEqual([]);
    expect(materialized.circuitInstanceClassifications.filter((entry) => entry.kind === "physical")
      .map((entry) => entry.selectedComponentId)).toEqual(result.matched.components.map((component) => component.id));
    expect(materialized.circuit.designBlocks).toHaveLength(2);
    expect(materialized.circuit.designBlocks.every((block) => block.netlist.kind === "schematic_only")).toBe(true);
    const assembly = materialized.circuit.circuits[0]!;
    const pinIsWired = (point: readonly [number, number]) => assembly.wires.some((wire) => wire.points.slice(1).some((end, index) => {
      const start = wire.points[index]!;
      return (start[0] === end[0] && point[0] === start[0] && point[1] >= Math.min(start[1], end[1]) && point[1] <= Math.max(start[1], end[1]))
        || (start[1] === end[1] && point[1] === start[1] && point[0] >= Math.min(start[0], end[0]) && point[0] <= Math.max(start[0], end[0]));
    }));
    for (const component of assembly.components) {
      for (const point of componentPinPointsV2(component, materialized.circuit.designBlocks)) {
        expect(pinIsWired(point), `${component.id} pin ${point.join(",")} is unwired`).toBe(true);
      }
    }
  });

  it("preflights exact aggregate configured-option work at the engine boundary before Cartesian allocation", () => {
    const externalA = externalProfileWithOptionCounts("CTRL-WORK-A", 31, 65);
    const externalB = externalProfileWithOptionCounts("CTRL-WORK-B", 32, 65);
    const boundary = bothPowerTopologies(environment(
      integratedProfile(),
      "power.buck.integrated-synchronous",
      [externalA, externalB],
    ));
    expect(POWER_NATIVE_RECIPE_FACTS_V2.enumerate(boundary)).toHaveLength(DESIGN_V2_MAX_OPTIONS_PER_RECIPE);

    const overBoundary = bothPowerTopologies(environment(
      integratedProfile(),
      "power.buck.integrated-synchronous",
      [externalA, externalB, externalProfileWithOptionCounts("CTRL-WORK-C", 1, 1)],
    ));
    const expected = `${POWER_NATIVE_RECIPE_FACTS_V2.id}:enumerate:resource_limit:${DESIGN_V2_MAX_OPTIONS_PER_RECIPE + 1}>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`;
    expect(() => POWER_NATIVE_RECIPE_FACTS_V2.enumerate(overBoundary)).toThrowError(new RangeError(expected));
    expect(() => POWER_NATIVE_RECIPE_FACTS_V2.enumerate({
      ...overBoundary,
      catalog: { profiles: [...overBoundary.catalog.profiles].reverse() },
    })).toThrowError(new RangeError(expected));
  }, 30_000);

  it("fails closed when reviewed feedback conditions do not cover the exact request", () => {
    const env = environment(integratedProfile(true), "power.buck.integrated-synchronous");
    const enumerated = POWER_NATIVE_RECIPE_FACTS_V2.enumerate(env);
    const solved = POWER_NATIVE_RECIPE_FACTS_V2.solve(enumerated[0]!, env);
    if (solved.status !== "ok") throw new Error("Expected frequency solve to remain available");
    expect(POWER_NATIVE_RECIPE_FACTS_V2.match(solved.value, env)[0]).toMatchObject({
      status: "rejected",
      constraints: [{ ruleId: "power.feedback.output-voltage", status: "unknown" }],
    });
  });

  it("rejects a Power endpoint pair with non-identical reviewed conditions", () => {
    const profile = structuredClone(integratedProfile());
    profile.facts.outputVoltageMaximum.validFor.push(condition("operating-mode"));
    expect(validateDesignProfileEnvelope(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.outputVoltage",
      code: "condition_group_mismatch",
    }));
    const codec = getDesignProfileCodecForVersion(profile.partClass, FACTS_SCHEMA_VERSION_V2);
    expect(() => parseDesignProfileForV2(codec, profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/condition_group_mismatch/);
  });

  it("is installed beside the compatibility recipe while preserving zero-profile behavior", () => {
    const installed = createInstalledNativeRecipeSets()["power.buck"];
    expect(installed.map((recipe) => recipe.id)).toEqual([
      POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.id,
      POWER_NATIVE_RECIPE_FACTS_V2.id,
      "power.native.integrated-synchronous-buck",
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED.id,
    ]);
    const emptyDocuments = createSyntheticReviewedLibraryFixture([]);
    expect(validateDesignLibraryEnvelope(emptyDocuments)).toEqual([]);
    const emptyReviewed = loadReviewedDesignLibraryEnvelope(emptyDocuments);
    const emptyEnvironment: NativeEnvironmentV2 = {
      request: request("power.buck.integrated-synchronous"),
      catalog: { profiles: emptyReviewed.profiles },
      manifest: { version: emptyReviewed.version },
    };
    expect(POWER_NATIVE_RECIPE_FACTS_V2.enumerate(emptyEnvironment)).toEqual([]);
    expect(POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3.enumerate(emptyEnvironment)).toEqual([]);
  });
});
