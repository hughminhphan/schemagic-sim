import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateScenarioNetlist, validateCircuitV4 } from "@opencircuit/circuit-schema";
import {
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V32,
  type DesignProfileEnvelope,
  type DesignProfileV1,
  type MountedGeometryFactsV2,
  type OperatingRange,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
} from "@opencircuit/design-library";
import {
  createSyntheticReviewedProfile,
} from "@opencircuit/design-library/fixtures";
import {
  DESIGN_V2_MAX_OPTIONS_PER_RECIPE,
  migrateDesignRequestV1ToV2,
  type BrushedDcMotorDesignRequestV2,
  type ConstraintResult,
} from "@opencircuit/design-schema";
import { createInstalledNativeRecipeSets } from "../src";
import { MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2, MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3, MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31 } from "../src/motor-external-v2";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32 } from "../src/motor-integrated-v32";
import {
  MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_PROFILE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_SOURCE_CONTENT_HASH,
  MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED,
} from "../src/motor-integrated-v32-mode-qualified";
import {
  MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_PROFILE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_SOURCE_CONTENT_HASH,
  MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED,
} from "../src/motor-integrated-v32-mode-qualified-binding-refreshed";
import {
  MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_PROFILE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_PROFILE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH,
  MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED,
} from "../src/motor-integrated-v32-local-capacitance-recommendation-qualified";
import { MOTOR_NATIVE_RECIPE } from "../src/motor";
import { MOTOR_NATIVE_RECIPE_FACTS_V2 } from "../src/motor-v2";
import type { NativeCandidateV2, NativeEnvironmentV2, NativeMatchedOptionV2 } from "../src/types";

function evidence(): ProfileEvidenceRef[] {
  return structuredClone(createSyntheticReviewedProfile("motor.integrated-h-bridge").commonFacts.packageName.evidence);
}

function unknown<Value>(explanation: string): ProfileFact<Value> {
  return { value: null, state: "unknown", evidence: [], validFor: [], explanation };
}

function reviewed<Value>(value: Value, explanation: string, validFor: OperatingRange[] = []): ProfileFact<Value> {
  return { value, state: "reviewed", evidence: evidence(), validFor: structuredClone(validFor), explanation };
}

function q<Unit extends ProfileQuantity["unit"]>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function ambientRange(minimum: number, maximum: number): OperatingRange<"K"> {
  return {
    parameterId: "ambientTemperature",
    minimum: q(minimum, "K"),
    maximum: q(maximum, "K"),
    evidence: evidence(),
  };
}

function unknownLegacyGeometry(label: string) {
  return unknown<ProfileQuantity>(`${label} is carried only by mountedGeometry in facts schema V2 or V3.2.`);
}

function mountedGeometry(area = 3e-6, height = 1e-3): MountedGeometryFactsV2["mountedGeometry"] {
  const sourceEvidence = evidence();
  return {
    boardArea: {
      value: {
        area: q(area, "m2"),
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "land-x", multiplier: 1, maximum: q(1e-3, "m"), evidence: structuredClone(sourceEvidence) },
          { axis: "y", dimensionId: "land-y", multiplier: 1, maximum: q(area / 1e-3, "m"), evidence: structuredClone(sourceEvidence) },
        ],
      },
      state: "calculated",
      evidence: structuredClone(sourceEvidence),
      validFor: [],
      explanation: "Synthetic reviewed mounted land-pattern rectangle.",
    },
    maximumHeight: {
      value: { height: q(height, "m"), basis: "manufacturer_package_maximum_in_surface_mount_orientation" },
      state: "reviewed",
      evidence: structuredClone(sourceEvidence),
      validFor: [],
      explanation: "Synthetic reviewed mounted package height.",
    },
  };
}

function v2Passive(partClass: "shared.bulk-capacitor" | "shared.mlcc-capacitor", capacitance: number): DesignProfileEnvelope {
  const base = structuredClone(createSyntheticReviewedProfile(partClass)) as DesignProfileV1;
  const facts = structuredClone(base.facts) as Record<string, ProfileFact<ProfileQuantity>>;
  facts.nominalCapacitance = reviewed(q(capacitance, "F"), "Synthetic reviewed nominal capacitance.");
  facts.ratedVoltage = reviewed(q(50, "V"), "Synthetic reviewed rated voltage.");
  return {
    ...base,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: base.commonFacts.packageName,
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: { ...facts, mountedGeometry: mountedGeometry(partClass === "shared.bulk-capacitor" ? 2e-6 : 1e-6) },
  } as unknown as DesignProfileEnvelope;
}

function v32Primary(): DesignProfileEnvelope {
  const base = structuredClone(createSyntheticReviewedProfile("motor.integrated-h-bridge"));
  return {
    ...base,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
    commonFacts: {
      packageName: base.commonFacts.packageName,
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: {
      bridgeTopology: reviewed("full_bridge", "Synthetic reviewed full-bridge architecture."),
      powerStage: reviewed("integrated_fet", "Synthetic reviewed integrated power stage."),
      bridgeOutputArchitecture: reviewed("single_full_bridge", "Synthetic reviewed single full bridge."),
      highSideDriveArchitecture: reviewed("n_channel_charge_pump", "Synthetic reviewed high-side architecture."),
      continuousHighSideOnSupported: reviewed(true, "Synthetic reviewed continuous high-side-on support."),
      supplyVoltageOperatingMinimum: reviewed(q(3, "V"), "Synthetic reviewed operating minimum."),
      supplyVoltageOperatingMaximum: reviewed(q(20, "V"), "Synthetic reviewed operating maximum."),
      supplyVoltageAbsoluteMaximum: reviewed(q(40, "V"), "Synthetic reviewed absolute maximum."),
      logicHighThresholdMaximum: reviewed(q(2, "V"), "Synthetic reviewed worst-case logic-high threshold."),
      continuousOutputCurrent: reviewed(q(6, "A"), "Synthetic reviewed continuous current."),
      continuousOutputCurrentRole: reviewed("guaranteed_operating_limit", "Synthetic reviewed current role."),
      peakOutputCurrent: reviewed(q(3.5, "A"), "Synthetic reviewed peak current."),
      peakOutputCurrentRole: reviewed("guaranteed_operating_limit", "Synthetic reviewed peak-current role."),
      currentRegulationInterface: reviewed("external_reference_and_sense", "Synthetic reviewed current-regulation architecture."),
      pwmMaximum: reviewed(q(100_000, "Hz"), "Synthetic reviewed PWM maximum."),
      pwmMaximumRole: reviewed("guaranteed_bound", "Synthetic reviewed PWM evidence role."),
      minimumInputPulseWidth: reviewed(q(1e-6, "s"), "Synthetic reviewed minimum pulse width."),
      minimumInputPulseWidthRole: reviewed("guaranteed_bound", "Synthetic reviewed minimum-pulse evidence role."),
      pathResistance: reviewed(q(0.5, "ohm"), "Synthetic reviewed typical path resistance."),
      pathResistanceRole: reviewed("typical_observation", "Synthetic reviewed path-resistance evidence role."),
      switchingTransitionTime: reviewed(q(1e-7, "s"), "Synthetic reviewed typical transition time."),
      switchingTransitionTimeRole: reviewed("typical_observation", "Synthetic reviewed transition-time evidence role."),
      activeSupplyCurrent: reviewed(q(0.01, "A"), "Synthetic reviewed typical active supply current."),
      activeSupplyCurrentRole: reviewed("typical_observation", "Synthetic reviewed active-current evidence role."),
      junctionToAmbientThermalResistance: reviewed(q(50, "K/W"), "Synthetic reviewed theta-JA."),
      maximumJunctionTemperature: reviewed(q(450, "K"), "Synthetic reviewed maximum junction temperature."),
      localSupplyDecouplingCapacitance: reviewed(q(1e-6, "F"), "Synthetic reviewed local capacitance minimum."),
      localSupplyDecouplingRequirement: reviewed("required_minimum", "Synthetic reviewed local capacitance requirement."),
      bulkCapacitance: reviewed(q(100e-6, "F"), "Synthetic reviewed bulk capacitance minimum."),
      bulkCapacitanceRequirement: reviewed("required_minimum", "Synthetic reviewed bulk capacitance requirement."),
      mountedGeometry: mountedGeometry(),
    },
  } as unknown as DesignProfileEnvelope;
}

function reviewedPrimaryProfile(fileName: "DRV8876PWPR.json" | "STSPIN840.json"): DesignProfileEnvelope {
  const manufacturer = fileName === "DRV8876PWPR.json" ? "texas-instruments" : "stmicroelectronics";
  return JSON.parse(readFileSync(
    new URL(`../../design-library/parts/motor.integrated-h-bridge/${manufacturer}/${fileName}`, import.meta.url),
    "utf8",
  )) as DesignProfileEnvelope;
}

function reviewedC1608Profile(): DesignProfileEnvelope {
  return JSON.parse(readFileSync(
    new URL("../../design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json", import.meta.url),
    "utf8",
  )) as DesignProfileEnvelope;
}

function request(): BrushedDcMotorDesignRequestV2 {
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migrated = migrateDesignRequestV1ToV2(source, "test-v3.2");
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") throw new Error("Expected a migrated Motor request");
  return {
    ...structuredClone(migrated.request),
    constraints: {
      ...structuredClone(migrated.request.constraints),
      allowedTopologyFamilies: ["motor.hbridge.integrated"],
      allowedPackages: [],
      maximumBoardArea: q(1e-4, "m2"),
      maximumComponentHeight: q(2e-3, "m"),
      allowUnknownHardConstraints: true,
    },
  };
}

function environment(profiles: DesignProfileEnvelope[] = [v32Primary(), v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]): NativeEnvironmentV2 {
  return { request: request(), catalog: { profiles }, manifest: { version: "test-v3.2" } };
}

function runMatched(input: NativeEnvironmentV2): { matched: NativeMatchedOptionV2; constraints: ReturnType<typeof MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.check> } {
  const options = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate(input);
  expect(options).toHaveLength(1);
  const solved = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.solve(options[0]!, input);
  if (solved.status !== "ok") throw new Error(`Expected facts-V3.2 solve: ${solved.reason}`);
  const matched = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.match(solved.value, input)[0]!;
  if (matched.status !== "ok") throw new Error(`Expected facts-V3.2 match: ${matched.reason}`);
  return { matched: matched.value, constraints: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.check(matched.value, input) };
}

function runModeQualified(input: NativeEnvironmentV2): { matched: NativeMatchedOptionV2; constraints: ReturnType<typeof MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED.check> } {
  const options = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED.enumerate(input);
  expect(options).toHaveLength(1);
  const solved = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED.solve(options[0]!, input);
  if (solved.status !== "ok") throw new Error(`Expected mode-qualified solve: ${solved.reason}`);
  const matched = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED.match(solved.value, input)[0]!;
  if (matched.status !== "ok") throw new Error(`Expected mode-qualified match: ${matched.reason}`);
  return {
    matched: matched.value,
    constraints: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED.check(matched.value, input),
  };
}

function runModeQualifiedBindingRefreshed(input: NativeEnvironmentV2): { matched: NativeMatchedOptionV2; constraints: ReturnType<typeof MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.check> } {
  const recipe = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED;
  const options = recipe.enumerate(input);
  expect(options).toHaveLength(1);
  const solved = recipe.solve(options[0]!, input);
  if (solved.status !== "ok") throw new Error(`Expected binding-refreshed mode-qualified solve: ${solved.reason}`);
  const matched = recipe.match(solved.value, input)[0]!;
  if (matched.status !== "ok") throw new Error(`Expected binding-refreshed mode-qualified match: ${matched.reason}`);
  return { matched: matched.value, constraints: recipe.check(matched.value, input) };
}

function runLocalRecommendationQualified(input: NativeEnvironmentV2): { matched: NativeMatchedOptionV2; constraints: ReturnType<typeof MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.check> } {
  const recipe = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED;
  const options = recipe.enumerate(input);
  expect(options).toHaveLength(1);
  const solved = recipe.solve(options[0]!, input);
  if (solved.status !== "ok") throw new Error(`Expected local-recommendation-qualified solve: ${solved.reason}`);
  const matched = recipe.match(solved.value, input)[0]!;
  if (matched.status !== "ok") throw new Error(`Expected local-recommendation-qualified match: ${matched.reason}`);
  return { matched: matched.value, constraints: recipe.check(matched.value, input) };
}

function constraint(input: NativeEnvironmentV2, ruleId: string) {
  const found = runMatched(input).constraints.find((entry) => entry.ruleId === ruleId);
  if (!found) throw new Error(`Missing constraint ${ruleId}`);
  return found;
}

describe("installed facts-V3.2 integrated H-bridge recipe", () => {
  it("consumes only the exact V3.2/V2 tuple, is installed, and closes empty catalogs", () => {
    const exact = environment();
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32).toMatchObject({
      id: "motor.native.integrated-h-bridge.facts-v3-2",
      version: "3.2.2",
    });
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate(exact)).toHaveLength(1);
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate({ ...exact, catalog: { profiles: [] } })).toEqual([]);
    expect(createInstalledNativeRecipeSets()["motor.brushed-dc"].map((recipe) => recipe.id)).toContain(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id);

    const v2Lookalike = structuredClone(v32Primary()) as DesignProfileEnvelope;
    v2Lookalike.factsSchemaVersion = FACTS_SCHEMA_VERSION_V2;
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate(environment([
      v2Lookalike,
      v2Passive("shared.mlcc-capacitor", 10e-6),
      v2Passive("shared.bulk-capacitor", 220e-6),
    ]))).toEqual([]);

    const v1Local = createSyntheticReviewedProfile("shared.mlcc-capacitor") as DesignProfileEnvelope;
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate(environment([
      v32Primary(),
      v1Local,
      v2Passive("shared.bulk-capacitor", 220e-6),
    ]))).toEqual([]);
  });

  it("enumerates the exact Cartesian product deterministically and preflights its BigInt resource bound", () => {
    const base = environment();
    const expanded = base.catalog.profiles.flatMap((profile) => Array.from({ length: 2 }, (_, index) => ({
      ...structuredClone(profile),
      part: { ...profile.part, manufacturerPartNumber: `${profile.part.manufacturerPartNumber}-${index}` },
    })));
    const forward = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate({ ...base, catalog: { profiles: expanded } });
    const reversed = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate({ ...base, catalog: { profiles: [...expanded].reverse() } });
    expect(forward).toHaveLength(8);
    expect(reversed).toEqual(forward);
    expect(new Set(forward.map((option) => option.optionKey)).size).toBe(8);
    expect(forward.every((option) => Object.keys(option.data).sort().join(",") === "bulkProfileId,localProfileId,primaryProfileId")).toBe(true);

    const repeated = (profile: DesignProfileEnvelope, count: number) => Array.from({ length: count }, (_, index) => ({
      ...structuredClone(profile),
      part: { ...profile.part, manufacturerPartNumber: `${profile.part.manufacturerPartNumber}-resource-${index}` },
    }));
    const overProfiles = [
      ...repeated(v32Primary(), 17),
      ...repeated(v2Passive("shared.mlcc-capacitor", 10e-6), 16),
      ...repeated(v2Passive("shared.bulk-capacitor", 220e-6), 16),
    ];
    const expected = `${MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id}:enumerate:resource_limit:4352>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`;
    expect(() => MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate(environment(overProfiles))).toThrowError(new RangeError(expected));
    expect(() => MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.enumerate(environment([...overProfiles].reverse()))).toThrowError(new RangeError(expected));
  });

  it("applies guaranteed limits and architectural duty support only when their reviewed facts cover the request", () => {
    const exact = environment();
    expect(constraint(exact, "motor.integrated.continuous-current")).toMatchObject({ status: "pass" });
    expect(constraint(exact, "motor.integrated.peak-current")).toMatchObject({
      status: "fail",
      actual: q(5, "A"),
      limit: q(3.5, "A"),
      explanation: expect.stringMatching(/stall current exceeds/),
    });
    expect(constraint(exact, "motor.integrated.high-side-duty")).toMatchObject({
      status: "pass",
      actual: q(0.8, "1"),
      limit: q(1, "1"),
    });
    const fullDuty = environment();
    (fullDuty.request as any).requirements.operatingPoint.dutyCycle = q(1, "1");
    expect(constraint(fullDuty, "motor.integrated.high-side-duty")).toMatchObject({
      status: "pass",
      actual: q(1, "1"),
      limit: q(1, "1"),
    });
    expect(constraint(exact, "motor.integrated.pwm-frequency")).toMatchObject({ status: "pass" });
    expect(constraint(exact, "motor.integrated.pulse-on-time")).toMatchObject({ status: "pass" });
    expect(constraint(exact, "motor.integrated.pulse-off-time")).toMatchObject({ status: "pass" });
    expect(constraint(exact, "motor.integrated.supply-minimum")).toMatchObject({ status: "pass" });
    expect(constraint(exact, "motor.integrated.supply-maximum")).toMatchObject({ status: "pass" });
    expect(constraint(exact, "motor.integrated.supply-absolute-maximum")).toMatchObject({ status: "pass" });

    const supplyFailure = structuredClone(v32Primary()) as any;
    supplyFailure.facts.supplyVoltageOperatingMaximum.value.value = 4;
    expect(constraint(environment([supplyFailure, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.supply-maximum")).toMatchObject({ status: "fail" });

    const typical = structuredClone(v32Primary()) as any;
    typical.facts.continuousOutputCurrentRole.value = "typical_observation";
    expect(constraint(environment([typical, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.continuous-current")).toMatchObject({ status: "unknown" });

    const belowPeak = environment();
    (belowPeak.request as any).requirements.stallCurrent = q(3, "A");
    expect(constraint(belowPeak, "motor.integrated.peak-current")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/stall duration/),
    });

    const typicalPeak = structuredClone(v32Primary()) as any;
    typicalPeak.facts.peakOutputCurrentRole.value = "typical_observation";
    expect(constraint(environment([typicalPeak, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.peak-current")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/not classified as a guaranteed operating limit/),
    });

    const unsupportedDuty = structuredClone(v32Primary()) as any;
    unsupportedDuty.facts.continuousHighSideOnSupported.value = false;
    expect(constraint(environment([unsupportedDuty, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.high-side-duty")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/No reviewed affirmative/),
    });

    const missingDuty = structuredClone(v32Primary()) as any;
    missingDuty.facts.continuousHighSideOnSupported = unknown<boolean>("Synthetic missing continuous high-side-on support.");
    expect(constraint(environment([missingDuty, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.high-side-duty")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/No reviewed affirmative/),
    });

    const outside = structuredClone(v32Primary()) as any;
    const outsideCondition = [{
      parameterId: "ambientTemperature",
      minimum: q(500, "K"),
      maximum: q(600, "K"),
      evidence: evidence(),
    }];
    outside.facts.minimumInputPulseWidth.validFor = structuredClone(outsideCondition);
    outside.facts.minimumInputPulseWidthRole.validFor = structuredClone(outsideCondition);
    expect(constraint(environment([outside, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.pulse-on-time")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/do not both cover/),
    });

    const peakOutside = structuredClone(v32Primary()) as any;
    peakOutside.facts.peakOutputCurrent.validFor = structuredClone(outsideCondition);
    peakOutside.facts.peakOutputCurrentRole.validFor = structuredClone(outsideCondition);
    expect(constraint(environment([peakOutside, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.peak-current")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/do not both cover/),
    });

    const dutyOutside = structuredClone(v32Primary()) as any;
    dutyOutside.facts.continuousHighSideOnSupported.validFor = structuredClone(outsideCondition);
    expect(constraint(environment([dutyOutside, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.high-side-duty")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/does not cover/),
    });

    const supplyConditioned = structuredClone(v32Primary()) as any;
    supplyConditioned.facts.supplyVoltageOperatingMaximum.value.value = 30;
    const supplyCondition = [{
      parameterId: "supplyVoltage",
      minimum: q(4.5, "V"),
      maximum: q(37, "V"),
      evidence: evidence(),
    }];
    supplyConditioned.facts.continuousOutputCurrent.validFor = structuredClone(supplyCondition);
    supplyConditioned.facts.continuousOutputCurrentRole.validFor = structuredClone(supplyCondition);
    const lowEndpoint = environment([supplyConditioned, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]);
    (lowEndpoint.request as any).requirements.supplyVoltage = { minimum: q(3, "V"), nominal: q(12, "V"), maximum: q(24, "V") };
    expect(constraint(lowEndpoint, "motor.integrated.continuous-current")).toMatchObject({ status: "unknown" });
    const coveredEndpoints = structuredClone(lowEndpoint) as NativeEnvironmentV2;
    (coveredEndpoints.request as any).requirements.supplyVoltage.minimum = q(5, "V");
    expect(constraint(coveredEndpoints, "motor.integrated.continuous-current")).toMatchObject({ status: "pass" });
  });

  it("uses only required-minimum capacitance as a hard check and preserves recommendations as unknown", () => {
    expect(constraint(environment(), "motor.integrated.local-capacitance-nominal")).toMatchObject({ status: "pass" });
    expect(constraint(environment(), "motor.integrated.bulk-capacitance-nominal")).toMatchObject({ status: "pass" });

    const tooLarge = structuredClone(v32Primary()) as any;
    tooLarge.facts.localSupplyDecouplingCapacitance.value.value = 20e-6;
    expect(constraint(environment([tooLarge, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.local-capacitance-nominal")).toMatchObject({ status: "fail" });

    const recommended = structuredClone(v32Primary()) as any;
    recommended.facts.bulkCapacitanceRequirement.value = "recommended_value";
    expect(constraint(environment([recommended, v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.bulk-capacitance-nominal")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/not published as a required minimum/),
    });

    const localNominalOutside = v2Passive("shared.mlcc-capacitor", 10e-6) as any;
    localNominalOutside.facts.nominalCapacitance.validFor = [ambientRange(500, 600)];
    expect(constraint(environment([v32Primary(), localNominalOutside, v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.local-capacitance-nominal")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/selected nominal local decoupling capacitance/),
    });

    const bulkNominalOutside = v2Passive("shared.bulk-capacitor", 220e-6) as any;
    bulkNominalOutside.facts.nominalCapacitance.validFor = [ambientRange(500, 600)];
    expect(constraint(environment([v32Primary(), v2Passive("shared.mlcc-capacitor", 10e-6), bulkNominalOutside]), "motor.integrated.bulk-capacitance-nominal")).toMatchObject({ status: "unknown" });

    const localRatedOutside = v2Passive("shared.mlcc-capacitor", 10e-6) as any;
    localRatedOutside.facts.ratedVoltage.validFor = [ambientRange(500, 600)];
    expect(constraint(environment([v32Primary(), localRatedOutside, v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.local-voltage-rating")).toMatchObject({ status: "unknown" });

    const bulkRatedOutside = v2Passive("shared.bulk-capacitor", 220e-6) as any;
    bulkRatedOutside.facts.ratedVoltage.validFor = [ambientRange(500, 600)];
    expect(constraint(environment([v32Primary(), v2Passive("shared.mlcc-capacitor", 10e-6), bulkRatedOutside]), "motor.integrated.bulk-voltage-rating")).toMatchObject({ status: "unknown" });

    const coveringLocal = v2Passive("shared.mlcc-capacitor", 10e-6) as any;
    coveringLocal.facts.nominalCapacitance.validFor = [ambientRange(300, 350)];
    coveringLocal.facts.ratedVoltage.validFor = [ambientRange(300, 350)];
    expect(constraint(environment([v32Primary(), coveringLocal, v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.local-capacitance-nominal")).toMatchObject({ status: "pass" });
    expect(constraint(environment([v32Primary(), coveringLocal, v2Passive("shared.bulk-capacitor", 220e-6)]), "motor.integrated.local-voltage-rating")).toMatchObject({ status: "pass" });

    const coveringButUnderratedBulk = v2Passive("shared.bulk-capacitor", 220e-6) as any;
    coveringButUnderratedBulk.facts.ratedVoltage.value.value = 15;
    coveringButUnderratedBulk.facts.ratedVoltage.validFor = [ambientRange(300, 350)];
    expect(constraint(environment([v32Primary(), v2Passive("shared.mlcc-capacitor", 10e-6), coveringButUnderratedBulk]), "motor.integrated.bulk-voltage-rating")).toMatchObject({ status: "fail" });
  });

  it("keeps configured current limit, loss, thermal, transients, and board fit unknown", () => {
    const result = runMatched(environment());
    for (const ruleId of [
      "motor.integrated.assembly.board-area",
      "motor.integrated.current-limit",
      "motor.integrated.operating-load",
      "motor.integrated.thermal",
      "motor.integrated.transient-margin",
    ]) {
      expect(result.constraints).toContainEqual(expect.objectContaining({ ruleId, status: "unknown" }));
    }
    expect(result.constraints).toContainEqual(expect.objectContaining({ ruleId: "motor.integrated.peak-current", status: "fail" }));
    expect(result.matched.simulationCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenarioId: "pwm_loaded_steady_state", modelTier: "behavioral" }),
      expect.objectContaining({ scenarioId: "selected_part_model", modelTier: "unavailable" }),
    ]));
  });

  it("refreshes only the exact DRV8876PWPR profile binding while preserving the 3.2.3 predecessor", () => {
    const exact = environment([
      reviewedPrimaryProfile("DRV8876PWPR.json"),
      v2Passive("shared.mlcc-capacitor", 10e-6),
      v2Passive("shared.bulk-capacitor", 220e-6),
    ]);
    const predecessor = runMatched(exact).constraints;
    const frozenPredecessor = runModeQualified(exact).constraints;
    const successor = runModeQualifiedBindingRefreshed(exact).constraints;
    const predecessorMode = predecessor.find((entry) => entry.ruleId === "motor.integrated.operating-modes")!;
    const frozenPredecessorMode = frozenPredecessor.find((entry) => entry.ruleId === "motor.integrated.operating-modes")!;
    const successorMode = successor.find((entry) => entry.ruleId === "motor.integrated.operating-modes")!;

    expect(predecessorMode).toMatchObject({ status: "unknown", evidence: [] });
    expect(frozenPredecessorMode).toMatchObject({ status: "unknown", evidence: [] });
    expect(successorMode).toMatchObject({
      status: "pass",
      explanation: expect.stringMatching(/PMODE is sampled logic high at device power-up.*does not prove PMODE or nSLEEP wiring/),
      evidence: [{
        sourceId: "ti-drv8876-slvsds7b",
        contentHash: MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_SOURCE_CONTENT_HASH,
        retrievedAt: "2026-08-24T10:44:40Z",
        locator: expect.stringMatching(/pages 10-11.*Table 2.*Table 4.*PMODE sampled logic high at device power-up.*00 is coast.*01 is reverse.*10 is forward.*11 is brake/),
      }],
    });
    expect(successor.filter((entry) => entry.ruleId !== "motor.integrated.operating-modes"))
      .toEqual(predecessor.filter((entry) => entry.ruleId !== "motor.integrated.operating-modes"));

    for (const operatingModes of [
      ["brake"],
      ["coast"],
      ["forward"],
      ["reverse"],
      ["brake", "coast", "forward", "reverse"],
    ] as const) {
      const subset = structuredClone(exact);
      if (subset.request.application !== "motor.brushed-dc") throw new Error("Expected a Motor request");
      subset.request.requirements.operatingModes = [...operatingModes];
      expect(runModeQualifiedBindingRefreshed(subset).constraints).toContainEqual(expect.objectContaining({
        ruleId: "motor.integrated.operating-modes",
        status: "pass",
      }));
    }
  });

  it("keeps operating modes unknown for STSPIN840 and byte-changed DRV8876 profiles", () => {
    const passives = [
      v2Passive("shared.mlcc-capacitor", 10e-6),
      v2Passive("shared.bulk-capacitor", 220e-6),
    ];
    const st = environment([reviewedPrimaryProfile("STSPIN840.json"), ...passives]);
    expect(runModeQualifiedBindingRefreshed(st).constraints).toContainEqual(expect.objectContaining({
      ruleId: "motor.integrated.operating-modes",
      status: "unknown",
    }));

    const changedDrv = reviewedPrimaryProfile("DRV8876PWPR.json") as any;
    changedDrv.facts.bridgeTopology.explanation += " Byte-changed after review.";
    const changed = environment([changedDrv, ...passives]);
    expect(runModeQualifiedBindingRefreshed(changed).constraints).toContainEqual(expect.objectContaining({
      ruleId: "motor.integrated.operating-modes",
      status: "unknown",
    }));
  });

  it("passes only the exact DRV8876/C1608 nominal recommendation match without inventing a minimum or adequacy claim", () => {
    const exact = environment([
      reviewedPrimaryProfile("DRV8876PWPR.json"),
      reviewedC1608Profile(),
      v2Passive("shared.bulk-capacitor", 220e-6),
    ]);
    const predecessor = runModeQualifiedBindingRefreshed(exact);
    const successor = runLocalRecommendationQualified(exact);
    const predecessorLocal = predecessor.constraints.find((entry) => entry.ruleId === "motor.integrated.local-capacitance-nominal")!;
    const successorLocal = successor.constraints.find((entry) => entry.ruleId === "motor.integrated.local-capacitance-nominal")!;

    expect(predecessorLocal).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/not published as a required minimum/),
    });
    expect(successorLocal).toEqual({
      ruleId: "motor.integrated.local-capacitance-nominal",
      status: "pass",
      explanation: expect.stringMatching(/exactly matching.*TI recommends.*does not publish it as a required minimum.*does not prove.*effective capacitance.*overall candidate eligibility/i),
      evidence: [
        expect.objectContaining({
          sourceId: "tdk-c1608x7r1h104k080aa-product-pdf",
          contentHash: MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH,
          locator: expect.stringMatching(/100 nF.*10 %/),
        }),
        expect.objectContaining({
          sourceId: "ti-drv8876-slvsds7b",
          contentHash: MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH,
          locator: expect.stringMatching(/Recommended External Components.*CVM1.*recommended 0.1-uF/),
        }),
      ],
    });
    expect(successorLocal).not.toHaveProperty("actual");
    expect(successorLocal).not.toHaveProperty("limit");
    expect(successorLocal).not.toHaveProperty("margin");
    expect(successor.constraints.filter((entry) => entry.ruleId !== "motor.integrated.local-capacitance-nominal"))
      .toEqual(predecessor.constraints.filter((entry) => entry.ruleId !== "motor.integrated.local-capacitance-nominal"));
    expect(successor.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.integrated.operating-modes", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.integrated.capacitor-derating", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.integrated.current-limit", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.integrated.operating-load", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.integrated.thermal", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.integrated.transient-margin", status: "unknown" }),
    ]));
    expect(successor.constraints.some((entry) => entry.status === "unknown")).toBe(true);

    expect(successor.matched.components).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "primary",
        role: "integrated-h-bridge",
        profileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json",
        part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8876PWPR" },
        quantityPerAssembly: 1,
      }),
      expect.objectContaining({
        id: "local-decoupling",
        role: "local-decoupling-capacitor",
        profileId: "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json",
        part: { manufacturerId: "tdk-corporation", manufacturerPartNumber: "C1608X7R1H104K080AA" },
        quantityPerAssembly: 1,
        value: { value: 0.1e-6, unit: "F", displayUnit: "F" },
      }),
    ]));

    const recipe = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED;
    const estimate = recipe.estimate(successor.matched, successor.constraints, exact);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"1".repeat(64)}`,
      recipeId: recipe.id,
      libraryVersion: "test-v3.2",
      data: successor.matched.data,
      components: successor.matched.components,
      derivedValues: successor.matched.derivedValues,
      constraints: successor.constraints,
      metrics: { values: estimate.metrics, warningCount: 0, estimateCount: 0, unknownCount: successor.constraints.filter((entry) => entry.status === "unknown").length },
      simulationCoverage: successor.matched.simulationCoverage,
      warnings: [],
    };
    const materialized = recipe.materialize(candidate, exact);
    expect(materialized.circuit.circuits.find((circuit) => circuit.id === "assembly")?.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "local-decoupling", type: "capacitor", value: 0.1e-6, mpn: "C1608X7R1H104K080AA" }),
      expect.objectContaining({ id: "primary", type: "design_block", mpn: "DRV8876PWPR" }),
    ]));
    expect(materialized.circuitInstanceClassifications).toContainEqual(expect.objectContaining({
      circuitId: "assembly",
      componentId: "local-decoupling",
      kind: "physical",
      selectedComponentId: "local-decoupling",
      representedQuantityPerAssembly: 1,
    }));
  });

  it("fails the exact recommendation closure closed under profile, selection, and physical-BOM mutations", () => {
    const exact = environment([
      reviewedPrimaryProfile("DRV8876PWPR.json"),
      reviewedC1608Profile(),
      v2Passive("shared.bulk-capacitor", 220e-6),
    ]);
    const exactRun = runLocalRecommendationQualified(exact);
    const target = (constraints: ConstraintResult[]) => constraints.find((entry) => entry.ruleId === "motor.integrated.local-capacitance-nominal");

    const profileMutations: Array<{ label: string; environment: NativeEnvironmentV2 }> = [];
    const changedDrv = reviewedPrimaryProfile("DRV8876PWPR.json") as any;
    changedDrv.facts.localSupplyDecouplingCapacitance.explanation += " Byte-changed after review.";
    profileMutations.push({ label: "byte-changed primary", environment: environment([changedDrv, reviewedC1608Profile(), v2Passive("shared.bulk-capacitor", 220e-6)]) });
    const changedLocal = reviewedC1608Profile() as any;
    changedLocal.facts.nominalCapacitance.explanation += " Byte-changed after review.";
    profileMutations.push({ label: "byte-changed local", environment: environment([reviewedPrimaryProfile("DRV8876PWPR.json"), changedLocal, v2Passive("shared.bulk-capacitor", 220e-6)]) });
    profileMutations.push({ label: "other primary", environment: environment([reviewedPrimaryProfile("STSPIN840.json"), reviewedC1608Profile(), v2Passive("shared.bulk-capacitor", 220e-6)]) });
    profileMutations.push({ label: "other equal-value MLCC", environment: environment([reviewedPrimaryProfile("DRV8876PWPR.json"), v2Passive("shared.mlcc-capacitor", 0.1e-6), v2Passive("shared.bulk-capacitor", 220e-6)]) });
    profileMutations.push({ label: "larger MLCC", environment: environment([reviewedPrimaryProfile("DRV8876PWPR.json"), v2Passive("shared.mlcc-capacitor", 10e-6), v2Passive("shared.bulk-capacitor", 220e-6)]) });

    for (const mutation of profileMutations) {
      const predecessor = runModeQualifiedBindingRefreshed(mutation.environment).constraints;
      const successor = runLocalRecommendationQualified(mutation.environment).constraints;
      expect(target(successor), mutation.label).toEqual(target(predecessor));
    }

    const matchedMutations: Array<{ label: string; mutate: (matched: NativeMatchedOptionV2) => void }> = [
      { label: "extra data key", mutate: (matched) => { matched.data.extraBinding = "not-reviewed"; } },
      { label: "primary role", mutate: (matched) => { matched.components.find((entry) => entry.id === "primary")!.role = "other"; } },
      { label: "local role", mutate: (matched) => { matched.components.find((entry) => entry.id === "local-decoupling")!.role = "bulk-capacitor"; } },
      { label: "local profile", mutate: (matched) => { matched.components.find((entry) => entry.id === "local-decoupling")!.profileId = matched.data.bulkProfileId as string; } },
      { label: "local MPN", mutate: (matched) => { matched.components.find((entry) => entry.id === "local-decoupling")!.part.manufacturerPartNumber = "C1608-TAMPERED"; } },
      { label: "local quantity", mutate: (matched) => { matched.components.find((entry) => entry.id === "local-decoupling")!.quantityPerAssembly = 2; } },
      { label: "local value", mutate: (matched) => { matched.components.find((entry) => entry.id === "local-decoupling")!.value!.value = 0.2e-6; } },
      { label: "local evidence", mutate: (matched) => { matched.components.find((entry) => entry.id === "local-decoupling")!.evidence[0]!.contentHash = `sha256:${"0".repeat(64)}`; } },
      { label: "extra component", mutate: (matched) => { matched.components.push(structuredClone(matched.components[0]!) as any); matched.components[3]!.id = "unexpected"; } },
    ];
    for (const mutation of matchedMutations) {
      const changed = structuredClone(exactRun.matched);
      mutation.mutate(changed);
      expect(target(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.check(changed, exact)), mutation.label)
        .toEqual(expect.objectContaining({ status: "unknown" }));
    }
  });

  it("materializes a deterministic connected structural graph with the exact primary and passive BOM", () => {
    const exact = environment();
    const { matched, constraints } = runMatched(exact);
    const estimate = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.estimate(matched, constraints, exact);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
      libraryVersion: "test-v3.2",
      data: matched.data,
      components: matched.components,
      derivedValues: matched.derivedValues,
      constraints,
      metrics: { values: estimate.metrics, warningCount: 0, estimateCount: 0, unknownCount: constraints.filter((entry) => entry.status === "unknown").length },
      simulationCoverage: matched.simulationCoverage,
      warnings: [],
    };
    const materialized = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.materialize(candidate, exact);
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.materialize(candidate, exact)).toEqual(materialized);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuit.circuits.map((circuit) => circuit.id)).toEqual(["assembly", "behavioral-operating-point"]);
    expect(materialized.circuit.defaultCircuitId).toBe("assembly");
    expect(materialized.circuit.scenarios).toEqual([
      expect.objectContaining({ id: "pwm_loaded_steady_state", circuitId: "behavioral-operating-point", config: { mode: "op" } }),
    ]);
    expect(materialized.circuit.defaultScenarioId).toBe("pwm_loaded_steady_state");
    expect(materialized.circuit.circuits[0]!.wires.map((wire) => wire.id)).toEqual(expect.arrayContaining([
      "control-a",
      "ground-primary",
      "motor-output-a",
      "supply-primary",
    ]));
    expect(materialized.circuit.circuits[0]!.wires.length).toBeGreaterThan(0);
    expect(materialized.circuit.circuits[0]!.components
      .filter((component) => component.type === "capacitor")
      .map((component) => {
        if (!("value" in component)) throw new Error("Expected an exact passive value");
        return component.value;
      })).toEqual([220e-6, 10e-6]);
    const primary = matched.components.find((component) => component.id === "primary")!;
    const primaryInstance = materialized.circuit.circuits[0]!.components.find((component) => component.id === "primary")!;
    expect(primaryInstance).toMatchObject({ type: "design_block", mpn: primary.part.manufacturerPartNumber });
    if (primaryInstance.type !== "design_block") throw new Error("Expected the exact primary design block");
    expect(materialized.circuit.designBlocks).toEqual([expect.objectContaining({
      id: primaryInstance.block.id,
      version: primaryInstance.block.version,
      contentHash: primaryInstance.block.contentHash,
      netlist: { kind: "schematic_only", reason: expect.stringMatching(/No reviewed executable model/) },
    })]);
    const behavioralGraph = materialized.circuit.circuits[1]!;
    expect(behavioralGraph.components.every((component) => component.type !== "design_block" && !("mpn" in component))).toBe(true);
    expect(materialized.circuitInstanceClassifications.filter((entry) => entry.circuitId === behavioralGraph.id)).toHaveLength(behavioralGraph.components.length);
    expect(materialized.circuitInstanceClassifications
      .filter((entry) => entry.circuitId === behavioralGraph.id)
      .every((entry) => entry.kind === "non_bom")).toBe(true);
    expect(materialized.circuitBomNonRepresentations.map((entry) => entry.selectedComponentId)).toEqual(
      matched.components.map((component) => component.id).sort(),
    );
    expect(materialized.circuitBomNonRepresentations.every((entry) => entry.circuitId === behavioralGraph.id)).toBe(true);
    const generated = generateScenarioNetlist(materialized.circuit, "pwm_loaded_steady_state");
    expect(generated.omissions).toEqual([]);
    expect(generated.netlist).toContain(".op\n.end\n");
    const value = (id: string) => {
      const component = behavioralGraph.components.find((entry) => entry.id === id);
      return component && "value" in component ? Number(component.value) : Number.NaN;
    };
    const requestCurrent = exact.request.application === "motor.brushed-dc"
      ? exact.request.requirements.operatingPoint.loadCurrent.value
      : Number.NaN;
    expect((value("v-bridge-average") - value("v-motor-back-emf")) / value("r-motor-winding")).toBeCloseTo(requestCurrent, 12);
    expect(materialized.circuitInstanceClassifications.filter((entry) => entry.kind === "physical")).toHaveLength(3);
    for (const component of matched.components) {
      const represented = materialized.circuitInstanceClassifications
        .reduce((total, entry) => entry.kind === "physical" && entry.selectedComponentId === component.id
          ? total + entry.representedQuantityPerAssembly
          : total, 0);
      expect(represented).toBe(component.quantityPerAssembly);
    }
  });

  it("locks the new immutable release payload and all prior Motor recipe hashes", () => {
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.contentHash).toBe("sha256:26eb9e820053a9fb4924962fccde309076f7d29cec0e334b5f09f2bd34b9c328");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED).toMatchObject({
      id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
      version: "3.2.3",
      contentHash: "sha256:86d3e6fed563d7e663d74f692286a2287b2932afea198fe76dc86eab07c50ece",
    });
    expect(MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_PROFILE_CONTENT_HASH).toBe("sha256:1786e77a459d8efbc83693b2c79770a3673d6b28e093b3f4f655468156850ef5");
    expect(Object.isFrozen(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED)).toBe(true);
    expect(MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_SOURCE_CONTENT_HASH)
      .toBe(MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_SOURCE_CONTENT_HASH);
    expect(MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_PROFILE_CONTENT_HASH)
      .toBe("sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED).toMatchObject({
      id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
      version: "3.2.4",
      contentHash: "sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84",
    });
    expect(Object.isFrozen(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED)).toBe(true);
    expect(MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_PROFILE_CONTENT_HASH)
      .toBe(MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_PROFILE_CONTENT_HASH);
    expect(MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_DRV8876_SOURCE_CONTENT_HASH)
      .toBe(MOTOR_INTEGRATED_V32_MODE_QUALIFIED_REFRESHED_DRV8876_SOURCE_CONTENT_HASH);
    expect(MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_PROFILE_CONTENT_HASH)
      .toBe("sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6");
    expect(MOTOR_INTEGRATED_V32_LOCAL_NOMINAL_C1608_SOURCE_CONTENT_HASH)
      .toBe("sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED).toMatchObject({
      id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
      version: "3.2.5",
      contentHash: "sha256:75e1ea8fa6c3c4fadd44187b9134a2e61840d2ad5b0123d0bbaff17a910dce1a",
    });
    expect(Object.isFrozen(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED)).toBe(true);
    expect(createInstalledNativeRecipeSets()["motor.brushed-dc"].find((recipe) => recipe.id === MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id)).toMatchObject({
      version: "3.2.6",
      contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07",
    });
    expect(MOTOR_NATIVE_RECIPE.contentHash).toBe("sha256:3e441b3002d1cf83fe083c46cd5aae88425f39886617e66ec2253a60d53fed2c");
    expect(MOTOR_NATIVE_RECIPE_FACTS_V2.contentHash).toBe("sha256:3fa1058e67d5906423153d1dc1150d78951f696fc5a747b8bfcc135ba7275d0b");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.contentHash).toBe("sha256:3bc0f393cab9ac039bc4b564131dcb1e95c2369bd4855ee330454f64d65847d8");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3.contentHash).toBe("sha256:cffc48e4bee012d0013243a84cfd74ae1790f49d9f4fa88ec6a066de52fb2854");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.contentHash).toBe("sha256:3832200e9181d616299bb7cec73f3ca8fe6c2021d6efd033c3913a0b3894c9df");
  });
});
