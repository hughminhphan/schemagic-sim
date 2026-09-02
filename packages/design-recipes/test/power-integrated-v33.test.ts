import { describe, expect, it } from "vitest";
import {
  calculateDesignBlockContentHash,
  componentPinPointsV4,
  generateScenarioNetlist,
  validateCircuitV4,
  type CircuitDocumentV4,
  type Point,
} from "@opencircuit/circuit-schema";
import { parseElectricalDesignRequestV2, type BuckDesignRequestV2 } from "@opencircuit/design-schema";
import {
  designProfileContentHashV34,
  designProfileEnvelopeContentHash,
  parseDesignProfileV34,
} from "@opencircuit/design-library/v2-runtime";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33 } from "../src/power-integrated-v33";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34 } from "../src/power-integrated-v34";
import {
  POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH,
  POWER_INTEGRATED_V345_REFERENCE_INDUCTOR_PROFILE_CONTENT_HASH,
  POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_PROFILE_CONTENT_HASH,
  POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V35_BOUND_CALCULATORS,
} from "../src/power-integrated-v34-inductor-qualified";
import type { NativeCandidateV2, NativeEnvironmentV2, NativeRecipeV2 } from "../src/types";
import tps54302 from "../../design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json";
import lqm18 from "../../design-library/parts/power.power-inductor/murata-manufacturing/LQM18PN2R2MGHD.json";
import belF1F2 from "../../design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json";
import belF1F2Reference from "../../design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json";
import grm31 from "../../design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json";
import grm32Reference from "../../design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json";
import tdk100nf from "../../design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json";
import crcw100k from "../../design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json";
import crcw732k from "../../design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json";
import bourns100k from "../../design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json";

function request(
  inputMinimum = 12,
  inputMaximum = 12,
  maximumOutputCurrent = 0.2,
  ambientTemperature = 298.15,
  outputVoltage = 5,
): BuckDesignRequestV2 {
  const parsed = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: inputMinimum, unit: "V", displayUnit: "V" },
        nominal: { value: 12, unit: "V", displayUnit: "V" },
        maximum: { value: inputMaximum, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: outputVoltage, unit: "V", displayUnit: "V" },
      maximumOutputCurrent: { value: maximumOutputCurrent, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: ambientTemperature, unit: "K", displayUnit: "°C" },
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
      allowUnknownHardConstraints: true,
    },
    assumptions: [{
      id: "test.reviewed-boundaries",
      description: "The unit test exercises exact reviewed facts while retaining unproved design claims as unknown.",
      source: "fixture",
      affects: ["constraints.allowUnknownHardConstraints"],
    }],
    libraryVersion: "power-v3-3-unit-test",
  });
  if (parsed.application !== "power.buck") throw new Error("Expected a Power request");
  return parsed;
}

function environment(designRequest = request()): NativeEnvironmentV2 {
  return {
    request: designRequest,
    catalog: {
      profiles: [tps54302, lqm18, grm31, tdk100nf, crcw100k, crcw732k] as NativeEnvironmentV2["catalog"]["profiles"],
    },
    manifest: {},
  };
}

function qualifiedInductorEnvironment(designRequest = request()): NativeEnvironmentV2 {
  const base = environment(designRequest);
  return {
    ...base,
    catalog: {
      profiles: [...base.catalog.profiles, belF1F2] as NativeEnvironmentV2["catalog"]["profiles"],
    },
  };
}

function qualifiedReviewedDividerEnvironment(designRequest = request()): NativeEnvironmentV2 {
  const base = qualifiedInductorEnvironment(designRequest);
  return {
    ...base,
    catalog: {
      profiles: [
        ...base.catalog.profiles.filter((profile) => (
          profile.part.manufacturerPartNumber !== "CRCW0603100KFKEA"
        )),
        bourns100k,
      ] as NativeEnvironmentV2["catalog"]["profiles"],
    },
  };
}

function referencePassiveEnvironment(designRequest = request()): NativeEnvironmentV2 {
  const base = qualifiedReviewedDividerEnvironment(designRequest);
  return {
    ...base,
    catalog: {
      profiles: [
        ...base.catalog.profiles,
        belF1F2Reference,
        grm32Reference,
      ] as NativeEnvironmentV2["catalog"]["profiles"],
    },
  };
}

function conditionCoveringInductor(): any {
  const profile = structuredClone(lqm18) as any;
  for (const condition of profile.facts.inductance.validFor) {
    if (condition.parameterId === "switchingFrequency") {
      condition.minimum.value = 290_000;
      condition.maximum.value = 290_000;
    } else if (condition.parameterId === "testCurrent") {
      condition.minimum.value = 0;
      condition.maximum.value = 10;
    }
  }
  return profile;
}

function withCatalogProfile(
  environmentValue: NativeEnvironmentV2,
  replacement: NativeEnvironmentV2["catalog"]["profiles"][number],
): NativeEnvironmentV2 {
  return {
    ...environmentValue,
    catalog: {
      ...environmentValue.catalog,
      profiles: environmentValue.catalog.profiles.map((profile) => (
        profile.partClass === replacement.partClass
          && profile.part.manufacturerId === replacement.part.manufacturerId
          && profile.part.manufacturerPartNumber === replacement.part.manufacturerPartNumber
          ? replacement
          : profile
      )),
    },
  };
}

function matched(
  environmentValue: NativeEnvironmentV2,
  recipe: Readonly<NativeRecipeV2> = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33,
) {
  const enumerated = recipe.enumerate(environmentValue);
  expect(enumerated).toHaveLength(1);
  const solved = recipe.solve(enumerated[0]!, environmentValue);
  expect(solved.status).toBe("ok");
  if (solved.status !== "ok") throw new Error(solved.reason);
  const matches = recipe.match(solved.value, environmentValue);
  return { solved: solved.value, matches };
}

function candidate(
  environmentValue: NativeEnvironmentV2,
  recipe: Readonly<NativeRecipeV2> = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33,
): NativeCandidateV2 {
  const { matches } = matched(environmentValue, recipe);
  expect(matches).toHaveLength(1);
  if (matches[0]?.status !== "ok") throw new Error(matches[0]?.reason ?? "Expected an exact match");
  const value = matches[0].value;
  const constraints = recipe.check(value, environmentValue);
  const estimate = recipe.estimate(value, constraints, environmentValue);
  return {
    id: `candidate:v2:sha256:${"0".repeat(64)}`,
    recipeId: recipe.id,
    libraryVersion: environmentValue.request.libraryVersion,
    data: value.data,
    components: value.components,
    derivedValues: value.derivedValues,
    constraints,
    metrics: {
      values: estimate.metrics,
      warningCount: constraints.filter((entry) => entry.status === "warning").length,
      estimateCount: estimate.metrics.filter((entry) => entry.state === "estimated").length,
      unknownCount: constraints.filter((entry) => entry.status === "unknown").length
        + estimate.metrics.filter((entry) => entry.state === "unknown").length,
    },
    simulationCoverage: value.simulationCoverage,
    warnings: [...value.warnings, ...estimate.warnings].sort(),
  };
}

function circuitConnectivity(document: CircuitDocumentV4) {
  const graph = document.circuits[0]!;
  const parent = new Map<string, string>();
  const key = ([x, y]: Point): string => `${x},${y}`;
  const find = (point: Point): string => {
    const value = key(point);
    if (!parent.has(value)) parent.set(value, value);
    let root = value;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let current = value;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const join = (left: Point, right: Point): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  for (const wire of graph.wires) {
    for (let index = 1; index < wire.points.length; index += 1) join(wire.points[index - 1]!, wire.points[index]!);
  }
  const pin = (componentId: string, index: number): Point => {
    const component = graph.components.find((entry) => entry.id === componentId);
    if (!component) throw new Error(`Missing component ${componentId}`);
    const point = componentPinPointsV4(component, document.designBlocks)[index];
    if (!point) throw new Error(`Missing pin ${componentId}:${index}`);
    return point;
  };
  return {
    pin,
    same: (left: Point, right: Point): boolean => find(left) === find(right),
    wiredPoints: new Set(graph.wires.flatMap((wire) => wire.points.map(key))),
  };
}

describe("facts V3.3 integrated synchronous-buck native recipe", () => {
  it("publishes a deterministic integrated-only identity without claiming selected-part simulation fidelity", () => {
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-3",
      version: "3.3.1",
      applications: ["power.buck"],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.contentHash).toBe("sha256:17c209ff53ac786a0e1399abf3b959ab8b2a735e7272366bc18bb116f2d29e36");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.supports(request())).toBe(true);
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.supports({
      ...request(),
      constraints: { ...request().constraints, allowedTopologyFamilies: ["power.buck.controller-external-nmos"] },
    })).toBe(false);
  });

  it("builds a low-current candidate while preserving every unproved engineering boundary as unknown", () => {
    const env = environment();
    const { matches } = matched(env);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.status).toBe("ok");
    if (matches[0]?.status !== "ok") throw new Error(matches[0]?.reason);
    expect(matches[0].value.components.map((component) => component.id)).toEqual([
      "bootstrap-capacitor",
      "feedback-lower",
      "feedback-upper",
      "input-capacitor",
      "output-capacitor",
      "power-inductor",
      "primary",
    ]);
    expect(matches[0].value.simulationCoverage).toEqual([expect.objectContaining({ modelTier: "unavailable" })]);

    const constraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(matches[0].value, env);
    expect(constraints.find((entry) => entry.ruleId === "power.regulator.input-maximum")?.status).toBe("pass");
    expect(constraints.find((entry) => entry.ruleId === "power.regulator.switching-spread-minimum")?.status).toBe("pass");
    expect(constraints.find((entry) => entry.ruleId === "power.inductor.saturation-current")?.status).toBe("unknown");
    expect(constraints.find((entry) => entry.ruleId === "power.inductor.rms-current")?.status).toBe("unknown");
    expect(constraints.find((entry) => entry.ruleId === "power.regulator.output-current")?.status).toBe("unknown");
    expect(constraints.find((entry) => entry.ruleId === "power.feedback.output-voltage")?.status).toBe("unknown");
    expect(constraints.find((entry) => entry.ruleId === "power.inductor.selected-value")).toMatchObject({
      status: "unknown",
      explanation: expect.stringMatching(/4\.57157784743 A peak-to-peak ripple.*-2\.08578892372 A valley/u),
    });
    expect(constraints.find((entry) => entry.ruleId === "power.passive.resistor-power-voltage")).toMatchObject({
      status: "unknown",
      actual: { value: 4.5628739394, unit: "V" },
      limit: { value: 75, unit: "V" },
      explanation: expect.stringContaining("does not cover the request"),
    });
    expect(constraints.find((entry) => entry.ruleId === "power.regulator.current-limit")).toMatchObject({
      status: "fail",
      actual: { value: 6, unit: "A" },
      limit: { value: 0.25, unit: "A" },
      explanation: expect.stringContaining("protection can act too late"),
    });
    expect(constraints.find((entry) => entry.ruleId === "power.control.loop-stability")?.status).toBe("unknown");
    expect(constraints.find((entry) => entry.ruleId === "power.thermal.maximum-junction")?.status).toBe("unknown");
    expect(constraints.some((entry) => entry.ruleId === "power.regulator.minimum-off-time" && entry.status === "pass")).toBe(false);

    const estimate = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.estimate(matches[0].value, constraints, env);
    expect(estimate.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "power.native.board-area", state: "calculated" }),
      expect.objectContaining({ id: "power.native.component-count", state: "calculated", value: expect.objectContaining({ value: 7 }) }),
    ]));
  });

  it("uses raw output current only as a one-way lower bound for inductor rating failures", () => {
    for (const testCase of [
      { current: 0.2, saturation: "unknown", rms: "unknown" },
      { current: 0.3, saturation: "fail", rms: "unknown" },
      { current: 1.1, saturation: "fail", rms: "fail" },
    ] as const) {
      const env = environment(request(12, 12, testCase.current));
      const { matches } = matched(env);
      expect(matches[0]?.status).toBe("ok");
      if (matches[0]?.status !== "ok") throw new Error(matches[0]?.reason ?? "Expected an exact match");
      const constraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(matches[0].value, env);
      const saturation = constraints.find((entry) => entry.ruleId === "power.inductor.saturation-current");
      const rms = constraints.find((entry) => entry.ruleId === "power.inductor.rms-current");
      expect(saturation?.status).toBe(testCase.saturation);
      expect(rms?.status).toBe(testCase.rms);
      if (testCase.saturation === "fail") {
        expect(saturation).toMatchObject({
          actual: { value: testCase.current, unit: "A" },
          limit: { value: 0.25, unit: "A" },
          explanation: expect.stringMatching(/output current alone already exceeds/),
        });
      }
      if (testCase.rms === "fail") {
        expect(rms).toMatchObject({
          actual: { value: testCase.current, unit: "A" },
          limit: { value: 1.05, unit: "A" },
          explanation: expect.stringMatching(/output current alone already exceeds/),
        });
      }
    }
  });

  it("uses the CCM ripple equation only as a nominal point observation when its exact measurement conditions cover", () => {
    const reviewedInductor = conditionCoveringInductor();

    const dcmEnvironment = withCatalogProfile(environment(), reviewedInductor);
    const dcm = matched(dcmEnvironment).matches[0];
    expect(dcm?.status).toBe("ok");
    if (dcm?.status !== "ok") throw new Error(dcm?.reason ?? "Expected an exact match");
    const dcmConstraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(dcm.value, dcmEnvironment);
    expect(dcmConstraints.find((entry) => entry.ruleId === "power.inductor.saturation-current")).toMatchObject({
      status: "unknown",
      explanation: expect.stringContaining("cannot bound discontinuous or pulse-skipping behavior"),
    });
    expect(dcmConstraints.find((entry) => entry.ruleId === "power.inductor.rms-current")?.status).toBe("unknown");
    expect(dcmConstraints.find((entry) => entry.ruleId === "power.regulator.current-limit")?.status).toBe("fail");

    const ccmEnvironment = withCatalogProfile(environment(request(12, 12, 3)), reviewedInductor);
    const ccm = matched(ccmEnvironment).matches[0];
    expect(ccm?.status).toBe("ok");
    if (ccm?.status !== "ok") throw new Error(ccm?.reason ?? "Expected an exact match");
    const ccmConstraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(ccm.value, ccmEnvironment);
    expect(ccmConstraints.find((entry) => entry.ruleId === "power.inductor.saturation-current")).toMatchObject({
      status: "fail",
      actual: { value: 3, unit: "A" },
      limit: { value: 0.25, unit: "A" },
      explanation: expect.stringContaining("output current alone already exceeds"),
    });
    expect(ccmConstraints.find((entry) => entry.ruleId === "power.inductor.rms-current")).toMatchObject({
      status: "fail",
      actual: { value: 3, unit: "A" },
      limit: { value: 1.05, unit: "A" },
      explanation: expect.stringContaining("output current alone already exceeds"),
    });
    expect(ccmConstraints.find((entry) => entry.ruleId === "power.regulator.current-limit")).toMatchObject({
      status: "fail",
      actual: { value: 6, unit: "A" },
      limit: { value: 0.25, unit: "A" },
      explanation: expect.stringContaining("protection can act too late"),
    });
  });

  it("never promotes nominal inductance, feedback-corner, or maximum-load boundaries into real passes", () => {
    for (const inductance of [2.2e-6, 2.3e-6]) {
      const profile = conditionCoveringInductor();
      profile.facts.inductance.value.value = inductance;
      profile.facts.saturationCurrent.value.value = 1.7;
      profile.facts.rmsCurrent.value.value = 1.08;
      const designRequest = request(12, 12, 1, 298.15, 1);
      const env = withCatalogProfile(environment(designRequest), profile);
      const match = matched(env).matches[0];
      expect(match?.status).toBe("ok");
      if (match?.status !== "ok") throw new Error(match?.reason ?? "Expected an exact match");
      const constraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(match.value, env);
      for (const ruleId of ["power.inductor.saturation-current", "power.inductor.rms-current"]) {
        expect(constraints.find((entry) => entry.ruleId === ruleId)).toMatchObject({
          status: "unknown",
          actual: expect.objectContaining({ unit: "A" }),
          explanation: expect.stringContaining("not a production bound"),
        });
      }
      expect(match.value.data.feedbackHighCornerOutputVoltage).not.toBe(designRequest.requirements.outputVoltage.value);
      expect(constraints.find((entry) => entry.ruleId === "power.inductor.selected-value")).toMatchObject({
        status: "unknown",
        actual: expect.objectContaining({ unit: "A" }),
        explanation: expect.stringMatching(/feedback-voltage corners.*lower-load modes/u),
      });
    }

    const highSaturationProfile = conditionCoveringInductor();
    highSaturationProfile.facts.saturationCurrent.value.value = 10;
    const env = withCatalogProfile(environment(request(12, 12, 1, 298.15, 1)), highSaturationProfile);
    const match = matched(env).matches[0];
    expect(match?.status).toBe("ok");
    if (match?.status !== "ok") throw new Error(match?.reason ?? "Expected an exact match");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(match.value, env)
      .find((entry) => entry.ruleId === "power.regulator.current-limit")).toMatchObject({
      status: "unknown",
      actual: expect.objectContaining({ unit: "A" }),
      limit: { value: 4, unit: "A" },
      explanation: expect.stringMatching(/threshold is not a peak-current clamp.*comparator delay/u),
    });
  });

  it("requires both sides of current-limit coordination and fails closed on a late protection threshold", () => {
    const reviewedInductor = conditionCoveringInductor();
    const env = withCatalogProfile(environment(request(12, 12, 1, 298.15, 1)), reviewedInductor);
    const match = matched(env).matches[0];
    expect(match?.status).toBe("ok");
    if (match?.status !== "ok") throw new Error(match?.reason ?? "Expected an exact match");
    const currentLimit = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(match.value, env)
      .find((entry) => entry.ruleId === "power.regulator.current-limit");
    expect(currentLimit).toMatchObject({
      status: "fail",
      actual: { value: 6, unit: "A" },
      limit: { value: 0.25, unit: "A" },
      explanation: expect.stringContaining("protection can act too late"),
    });
  });

  it("proves divider DC stress only when every power and working-voltage condition covers", () => {
    const ambientEnvironment = {
      ...environment(),
      catalog: {
        profiles: [
          ...environment().catalog.profiles.filter((profile) => (
            profile.part.manufacturerPartNumber !== "CRCW0603100KFKEA"
          )),
          bourns100k,
        ] as NativeEnvironmentV2["catalog"]["profiles"],
      },
    };
    const ambient = matched(ambientEnvironment).matches[0];
    expect(ambient?.status).toBe("ok");
    if (ambient?.status !== "ok") throw new Error(ambient?.reason ?? "Expected an exact match");
    expect(ambient.value.components.find((entry) => entry.id === "feedback-lower")).toMatchObject({
      part: { manufacturerId: "bourns", manufacturerPartNumber: "CR0603-FX-1003ELF" },
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(ambient.value, ambientEnvironment)
      .find((entry) => entry.ruleId === "power.passive.resistor-power-voltage")).toMatchObject({
      status: "pass",
      actual: { value: 4.5628739394, unit: "V" },
      limit: { value: 75, unit: "V" },
      explanation: expect.stringContaining("All four DC power and working-voltage comparisons"),
    });

    const coveredEnvironment = environment(request(12, 12, 0.2, 343.15));
    const covered = matched(coveredEnvironment).matches[0];
    expect(covered?.status).toBe("ok");
    if (covered?.status !== "ok") throw new Error(covered?.reason ?? "Expected an exact match");
    const coveredConstraint = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(covered.value, coveredEnvironment)
      .find((entry) => entry.ruleId === "power.passive.resistor-power-voltage");
    expect(coveredConstraint).toMatchObject({
      status: "pass",
      actual: { value: 4.5628739394, unit: "V" },
      limit: { value: 75, unit: "V" },
      explanation: expect.stringContaining("All four DC power and working-voltage comparisons"),
    });

    const lowWorkingVoltage = structuredClone(crcw732k) as any;
    lowWorkingVoltage.facts.workingVoltage.value.value = 1;
    const blockedEnvironment = withCatalogProfile(environment(), lowWorkingVoltage);
    const blocked = matched(blockedEnvironment).matches[0];
    expect(blocked?.status).toBe("ok");
    if (blocked?.status !== "ok") throw new Error(blocked?.reason ?? "Expected an exact match");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(blocked.value, blockedEnvironment)
      .find((entry) => entry.ruleId === "power.passive.resistor-power-voltage")).toMatchObject({
      status: "fail",
      actual: { value: 4.5628739394, unit: "V" },
      limit: { value: 1, unit: "V" },
    });
  });

  it("does not calculate resistor stress from a tampered selected value", () => {
    const env = environment(request(12, 12, 0.2, 343.15));
    const match = matched(env).matches[0];
    expect(match?.status).toBe("ok");
    if (match?.status !== "ok") throw new Error(match?.reason ?? "Expected an exact match");
    const tampered = structuredClone(match.value) as any;
    tampered.components.find((component: { id: string }) => component.id === "feedback-upper").value.value = 100_000;
    const constraint = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(tampered, env)
      .find((entry) => entry.ruleId === "power.passive.resistor-power-voltage");
    expect(constraint).toMatchObject({
      status: "unknown",
      explanation: expect.stringContaining("exact feedback roles, selected values"),
    });
    expect(constraint).not.toHaveProperty("actual");

    const tamperedRole = structuredClone(match.value) as any;
    tamperedRole.components.find((component: { id: string }) => component.id === "feedback-upper").role = "feedback-lower-resistor";
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(tamperedRole, env)
      .find((entry) => entry.ruleId === "power.passive.resistor-power-voltage")).toMatchObject({
      status: "unknown",
      explanation: expect.stringContaining("exact feedback roles, selected values"),
    });
  });

  it("fails closed before engineering calculations when the solved frequency or primary BOM binding is tampered", () => {
    const env = environment();
    const match = matched(env).matches[0];
    expect(match?.status).toBe("ok");
    if (match?.status !== "ok") throw new Error(match?.reason ?? "Expected an exact match");

    const wrongFrequency = structuredClone(match.value) as any;
    wrongFrequency.data.selectedSwitchingFrequency = 399_999;
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongFrequency, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.primary", status: "unknown" }),
    ]);

    const wrongPrimary = structuredClone(match.value) as any;
    wrongPrimary.components.find((component: { id: string }) => component.id === "primary").profileId = wrongPrimary.components
      .find((component: { id: string }) => component.id === "power-inductor").profileId;
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongPrimary, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.primary", status: "unknown" }),
    ]);

    const wrongPrimaryMpn = structuredClone(match.value) as any;
    wrongPrimaryMpn.components.find((component: { id: string }) => component.id === "primary").part.manufacturerPartNumber = "TPS54302DDCR-NOT-SELECTED";
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongPrimaryMpn, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.primary", status: "unknown" }),
    ]);

    const wrongPrimaryRole = structuredClone(match.value) as any;
    wrongPrimaryRole.components.find((component: { id: string }) => component.id === "primary").role = "not-the-primary-role";
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongPrimaryRole, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.primary", status: "unknown" }),
    ]);

    const wrongInductorMpn = structuredClone(match.value) as any;
    wrongInductorMpn.components.find((component: { id: string }) => component.id === "power-inductor").part.manufacturerPartNumber = "LQM18PN2R2MGHD-NOT-SELECTED";
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongInductorMpn, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.passive-set", status: "unknown" }),
    ]);

    const wrongInductorRole = structuredClone(match.value) as any;
    wrongInductorRole.components.find((component: { id: string }) => component.id === "power-inductor").role = "not-the-inductor-role";
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongInductorRole, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.passive-set", status: "unknown" }),
    ]);

    const wrongInductorValue = structuredClone(match.value) as any;
    wrongInductorValue.components.find((component: { id: string }) => component.id === "power-inductor").value.value = 2.3e-6;
    const wrongInductorValueConstraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.check(wrongInductorValue, env);
    expect(wrongInductorValueConstraints).toEqual([
      expect.objectContaining({
        ruleId: "power.profile.passive-set",
        status: "unknown",
        explanation: expect.stringContaining("selected inductor value"),
      }),
    ]);
    expect(wrongInductorValueConstraints.some((constraint) => constraint.ruleId === "power.regulator.current-limit")).toBe(false);
  });

  it("rejects feedback selection when the VFB production-spread conditions do not cover the full input range", () => {
    const env = environment(request(9, 16));
    const { matches } = matched(env);
    expect(matches).toEqual([expect.objectContaining({
      status: "rejected",
      reason: expect.stringContaining("Feedback-divider selection is unknown"),
      constraints: [expect.objectContaining({ ruleId: "power.feedback.output-voltage", status: "unknown" })],
    })]);
  });

  it("materializes the exact BOM as a deterministic connected structural schematic with no executable scenario", () => {
    const env = environment();
    const selectedCandidate = candidate(env);
    const materialized = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.materialize(selectedCandidate, env);
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.materialize(selectedCandidate, env)).toEqual(materialized);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuit.scenarios).toEqual([]);
    expect(materialized.circuit.defaultScenarioId).toBeNull();
    expect(materialized.circuit.circuits[0]!.wires.length).toBeGreaterThan(0);

    const block = materialized.circuit.designBlocks[0]!;
    expect(block).toMatchObject({
      id: "power.integrated-synchronous-buck-regulator.texas-instruments.TPS54302DDCR",
      version: "structural-v1",
      netlist: {
        kind: "schematic_only",
        reason: expect.stringContaining("No reviewed executable model"),
      },
      pins: [
        { id: "ground", name: "GROUND" },
        { id: "switch-node", name: "SWITCH NODE" },
        { id: "input-supply", name: "INPUT SUPPLY" },
        { id: "feedback", name: "FEEDBACK" },
        { id: "bootstrap", name: "BOOTSTRAP" },
      ],
    });
    expect(block.contentHash).toBe(calculateDesignBlockContentHash(block));
    const primary = materialized.circuit.circuits[0]!.components.find((component) => component.id === "primary");
    expect(primary).toMatchObject({
      type: "design_block",
      mpn: "TPS54302DDCR",
      block: { id: block.id, version: block.version, contentHash: block.contentHash },
    });

    expect(materialized.circuitBomNonRepresentations).toEqual([]);
    expect(materialized.circuitInstanceClassifications.filter((entry) => entry.kind === "physical")).toEqual(
      selectedCandidate.components.map((component) => ({
        circuitId: "assembly",
        componentId: component.id,
        kind: "physical",
        selectedComponentId: component.id,
        representedQuantityPerAssembly: 1,
      })),
    );
    const graph = materialized.circuit.circuits[0]!;
    for (const component of selectedCandidate.components) {
      expect(graph.components.find((entry) => entry.id === component.id)?.mpn).toBe(component.part.manufacturerPartNumber);
    }

    const connectivity = circuitConnectivity(materialized.circuit);
    for (const component of graph.components) {
      for (const point of componentPinPointsV4(component, materialized.circuit.designBlocks)) {
        expect(connectivity.wiredPoints.has(`${point[0]},${point[1]}`), `${component.id} pin ${point.join(",")} is unwired`).toBe(true);
      }
    }
    expect(connectivity.same(connectivity.pin("primary", 2), connectivity.pin("input-capacitor", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 2), [-32, -8])).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 1), connectivity.pin("bootstrap-capacitor", 1))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 1), connectivity.pin("power-inductor", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 4), connectivity.pin("bootstrap-capacitor", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 3), connectivity.pin("feedback-upper", 1))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 3), connectivity.pin("feedback-lower", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("power-inductor", 1), connectivity.pin("output-capacitor", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("power-inductor", 1), connectivity.pin("feedback-upper", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("power-inductor", 1), [60, 0])).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 0), connectivity.pin("ground", 0))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 0), connectivity.pin("input-capacitor", 1))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 0), connectivity.pin("output-capacitor", 1))).toBe(true);
    expect(connectivity.same(connectivity.pin("primary", 0), connectivity.pin("feedback-lower", 1))).toBe(true);
  });
});

describe("facts V3.4 integrated synchronous-buck behavioral scenario release", () => {
  it("adds a new immutable production identity without drifting the V3.3 release", () => {
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4",
      version: "3.4.1",
      contentHash: "sha256:905cb64fa631ff59c87689043dfe76ee314bd36dcd8ee53297a29053f982e9a7",
      applications: ["power.buck"],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-3",
      version: "3.3.1",
      contentHash: "sha256:17c209ff53ac786a0e1399abf3b959ab8b2a735e7272366bc18bb116f2d29e36",
    });
    const env = environment();
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34.enumerate(env)[0]?.optionKey).toMatch(/^power-v3-4:sha256:/u);
  });

  it("retains selected-part-model unavailability and adds one explicit behavioral projection", () => {
    const { matches } = matched(environment(), POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34);
    expect(matches).toHaveLength(1);
    if (matches[0]?.status !== "ok") throw new Error(matches[0]?.reason ?? "Expected an exact match");
    expect(matches[0].value.simulationCoverage).toEqual([
      {
        scenarioId: "catalog-native-model",
        modelTier: "unavailable",
        limitations: ["No reviewed executable model is bundled for the exact TPS54302DDCR regulator or selected passive stage."],
      },
      {
        scenarioId: "ideal_pwm_output_stage_transient",
        modelTier: "behavioral",
        limitations: [
          "Behavior is an ideal fixed-duty PWM stimulus, not a TPS54302DDCR control, timing, current-limit, protection, package, or selected-part model.",
          "Feedback-loop response, regulation, stability, losses, efficiency, and thermal behavior are not modeled.",
          "The selected inductor and output capacitor use nominal catalog values only; tolerance, bias, ESR, DCR, parasitics, and temperature effects are not modeled.",
          "Transient waveforms are behavioral inspection artifacts only and must not be used as constraint, eligibility, ranking, or selected-part-fidelity evidence.",
        ],
      },
    ]);
  });

  it("preserves the exact structural default and materializes a zero-omission ideal-PWM LC transient", () => {
    const env = environment();
    const selectedCandidate = candidate(env, POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34);
    const materialized = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34.materialize(selectedCandidate, env);
    const v33Candidate = candidate(env, POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33);
    const v33Materialized = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.materialize(v33Candidate, env);

    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34.materialize(selectedCandidate, env)).toEqual(materialized);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuit.defaultCircuitId).toBe("assembly");
    expect(materialized.circuit.defaultScenarioId).toBe("ideal_pwm_output_stage_transient");
    expect(materialized.circuit.circuits.find((entry) => entry.id === "assembly")).toEqual(v33Materialized.circuit.circuits[0]);
    expect(materialized.circuit.designBlocks).toEqual(v33Materialized.circuit.designBlocks);
    expect(materialized.circuit.scenarios).toEqual([{
      id: "ideal_pwm_output_stage_transient",
      title: "Ideal PWM nominal LC output-stage transient",
      circuitId: "ideal_pwm_output_stage",
      config: {
        mode: "tran",
        tran: { tstop: 0.00005, tstep: 2.5e-8, maxstep: 1.25e-8 },
      },
    }]);

    const graph = materialized.circuit.circuits.find((entry) => entry.id === "ideal_pwm_output_stage");
    expect(graph).toBeDefined();
    const behavioralPrimary = graph!.components.find((entry) => entry.id === "ideal-pwm-primary");
    expect(behavioralPrimary).toMatchObject({
      type: "vsource_pulse",
      params: { v1: 0, v2: 12, delay: 0.0000025, rise: 2.5e-9, fall: 2.5e-9, width: 0.00000104166666667, period: 0.0000025 },
    });
    expect(behavioralPrimary).not.toHaveProperty("mpn");

    for (const id of ["output-capacitor", "power-inductor"] as const) {
      const selectedComponent = selectedCandidate.components.find((entry) => entry.id === id)!;
      expect(graph!.components.find((entry) => entry.id === id)).toMatchObject({
        value: selectedComponent.value!.value,
        mpn: selectedComponent.part.manufacturerPartNumber,
      });
      expect(materialized.circuitInstanceClassifications).toContainEqual({
        circuitId: "ideal_pwm_output_stage",
        componentId: id,
        kind: "physical",
        selectedComponentId: id,
        representedQuantityPerAssembly: 1,
      });
    }
    expect(materialized.circuitInstanceClassifications).toContainEqual({
      circuitId: "ideal_pwm_output_stage",
      componentId: "ideal-pwm-primary",
      kind: "behavioral",
      selectedComponentId: "primary",
      reason: expect.stringContaining("not a TPS54302DDCR model"),
    });
    expect(materialized.circuitBomNonRepresentations.map((entry) => entry.selectedComponentId)).toEqual([
      "bootstrap-capacitor",
      "feedback-lower",
      "feedback-upper",
      "input-capacitor",
    ]);

    const generated = generateScenarioNetlist(materialized.circuit, "ideal_pwm_output_stage_transient");
    expect(generated.omissions).toEqual([]);
    expect(generated.netlist).toContain("PULSE(0 12");
    expect(generated.netlist).toContain(".tran 2.5e-8 0.00005 0 1.25e-8");
    expect(generated.netlist).not.toContain("TPS54302DDCR");
  });

  it("does not promote behavioral inspection into engineering truth", () => {
    const env = environment();
    const { matches } = matched(env, POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34);
    if (matches[0]?.status !== "ok") throw new Error(matches[0]?.reason ?? "Expected an exact match");
    const constraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34.check(matches[0].value, env);
    for (const ruleId of [
      "power.feedback.output-voltage",
      "power.control.loop-stability",
      "power.passive.capacitor-effective-capacitance",
      "power.request.load-transient",
      "power.request.output-ripple",
      "power.thermal.loss-model",
      "power.thermal.maximum-junction",
    ]) {
      expect(constraints.find((entry) => entry.ruleId === ruleId)?.status, ruleId).toBe("unknown");
    }
    expect(constraints.find((entry) => entry.ruleId === "power.regulator.current-limit")?.status).toBe("fail");
  });
});

describe("facts V3.4 exact-inductor-qualified integrated synchronous-buck successor", () => {
  it("binds only the exact admitted Bel profile without drifting either prior release", () => {
    expect(designProfileContentHashV34(parseDesignProfileV34(belF1F2))).toBe(
      POWER_INTEGRATED_V34_QUALIFIED_INDUCTOR_PROFILE_CONTENT_HASH,
    );
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.2",
      contentHash: "sha256:86d679c665cd46d355eddfdaa3bda2f80e8f6c7d97b31f7f6e6ce88dc619968a",
      applications: ["power.buck"],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.3",
      contentHash: "sha256:b39032f3fe4ab1b40a12ac7128bf09db18c31e369a96ead925dd3e1b06710a84",
      applications: ["power.buck"],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.4",
      contentHash: "sha256:e39f5e67c0fd52d44170f0222455eade876385ba0771d6e78c420d02aa60999c",
      applications: ["power.buck"],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4",
      version: "3.4.1",
      contentHash: "sha256:905cb64fa631ff59c87689043dfe76ee314bd36dcd8ee53297a29053f982e9a7",
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.contentHash).toBe(
      "sha256:17c209ff53ac786a0e1399abf3b959ab8b2a735e7272366bc18bb116f2d29e36",
    );

    const env = qualifiedInductorEnvironment();
    const { matches } = matched(env, POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED);
    expect(matches).toHaveLength(1);
    if (matches[0]?.status !== "ok") throw new Error(matches[0]?.reason ?? "Expected exact profile match");
    expect(matches[0].value.components.find((entry) => entry.id === "power-inductor")).toMatchObject({
      profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json",
      part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-2R2M" },
      value: { value: 0.0000022, unit: "H" },
    });

    const wrongProfile = structuredClone(belF1F2) as typeof belF1F2;
    wrongProfile.facts.inductance.explanation += " changed";
    const wrongEnvironment = {
      ...environment(),
      catalog: { profiles: [...environment().catalog.profiles, wrongProfile] },
    } as NativeEnvironmentV2;
    const enumerated = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED.enumerate(wrongEnvironment);
    const solved = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED.solve(enumerated[0]!, wrongEnvironment);
    if (solved.status !== "ok") throw new Error(solved.reason);
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED.match(solved.value, wrongEnvironment)).toEqual([
      expect.objectContaining({ status: "rejected", reason: expect.stringContaining("inductor set") }),
    ]);
  });

  it("keeps 3.4.2 immutable while 3.4.3 emits load-transient only for an actual target", () => {
    const noTargetEnvironment = qualifiedReviewedDividerEnvironment();
    const oldMatch = matched(
      noTargetEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED,
    ).matches[0];
    const newMatch = matched(
      noTargetEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL,
    ).matches[0];
    if (oldMatch?.status !== "ok" || newMatch?.status !== "ok") throw new Error("Expected exact qualified matches");

    const oldConstraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED.check(
      oldMatch.value,
      noTargetEnvironment,
    );
    const noTargetConstraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL.check(
      newMatch.value,
      noTargetEnvironment,
    );
    expect(oldConstraints.find((entry) => entry.ruleId === "power.request.load-transient")).toMatchObject({
      status: "unknown",
      explanation: "No numeric load-transient target is requested; no transient-response pass is claimed.",
    });
    expect(noTargetConstraints.some((entry) => entry.ruleId === "power.request.load-transient")).toBe(false);
    expect(Object.fromEntries(["pass", "unknown", "fail"].map((status) => [
      status,
      noTargetConstraints.filter((entry) => entry.status === status).length,
    ]))).toEqual({ pass: 8, unknown: 14, fail: 0 });

    const absentRequest = structuredClone(noTargetEnvironment.request) as unknown as {
      requirements: Record<string, unknown>;
    };
    delete absentRequest.requirements.loadTransientTarget;
    const absentEnvironment = { ...noTargetEnvironment, request: absentRequest } as unknown as NativeEnvironmentV2;
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL
      .check(newMatch.value, absentEnvironment)
      .some((entry) => entry.ruleId === "power.request.load-transient")).toBe(false);

    const numericTargetRequest = parseElectricalDesignRequestV2({
      ...structuredClone(noTargetEnvironment.request),
      requirements: {
        ...structuredClone(noTargetEnvironment.request.requirements),
        loadTransientTarget: {
          currentStep: { value: 0.1, unit: "A", displayUnit: "A" },
          maximumOutputDeviation: { value: 0.1, unit: "V", displayUnit: "V" },
          maximumSettlingTime: { value: 0.001, unit: "s", displayUnit: "ms" },
        },
      },
    });
    if (numericTargetRequest.application !== "power.buck") throw new Error("Expected a Power request");
    const targetEnvironment = qualifiedReviewedDividerEnvironment(numericTargetRequest);
    const targetMatch = matched(
      targetEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL,
    ).matches[0];
    if (targetMatch?.status !== "ok") throw new Error(targetMatch?.reason ?? "Expected exact qualified match");
    const targetConstraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL.check(
      targetMatch.value,
      targetEnvironment,
    );
    expect(targetConstraints.find((entry) => entry.ruleId === "power.request.load-transient")).toEqual({
      ruleId: "power.request.load-transient",
      status: "unknown",
      explanation: "The requested load transient has not been proved by a reviewed transient model.",
      evidence: [],
    });
    expect(Object.fromEntries(["pass", "unknown", "fail"].map((status) => [
      status,
      targetConstraints.filter((entry) => entry.status === status).length,
    ]))).toEqual({ pass: 8, unknown: 15, fail: 0 });
  });

  it("keeps older requests unknown and closes only explicit DC regulation envelopes in 3.4.4", () => {
    const absentEnvironment = qualifiedReviewedDividerEnvironment();
    const absentMatch = matched(
      absentEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION,
    ).matches[0];
    if (absentMatch?.status !== "ok") throw new Error(absentMatch?.reason ?? "Expected exact qualified match");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION
      .check(absentMatch.value, absentEnvironment)
      .find((entry) => entry.ruleId === "power.feedback.output-voltage")).toMatchObject({
      status: "unknown",
      explanation: expect.stringContaining("no explicit DC regulation envelope"),
    });

    const envelopeRequest = parseElectricalDesignRequestV2({
      ...structuredClone(absentEnvironment.request),
      requirements: {
        ...structuredClone(absentEnvironment.request.requirements),
        dcOutputVoltageRegulation: {
          minimum: { value: 4.7, unit: "V", displayUnit: "V" },
          maximum: { value: 5.3, unit: "V", displayUnit: "V" },
        },
      },
    });
    if (envelopeRequest.application !== "power.buck") throw new Error("Expected a Power request");
    const envelopeEnvironment = qualifiedReviewedDividerEnvironment(envelopeRequest);
    const envelopeMatch = matched(
      envelopeEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION,
    ).matches[0];
    if (envelopeMatch?.status !== "ok") throw new Error(envelopeMatch?.reason ?? "Expected exact qualified match");
    const constraints = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION.check(
      envelopeMatch.value,
      envelopeEnvironment,
    );
    expect(constraints.find((entry) => entry.ruleId === "power.feedback.output-voltage")).toMatchObject({
      status: "pass",
      explanation: expect.stringMatching(/4\.74970376238 V to 5\.17387393939 V.*inside.*4\.7 V to 5\.3 V/u),
    });
    expect(Object.fromEntries(["pass", "unknown", "fail"].map((status) => [
      status,
      constraints.filter((entry) => entry.status === status).length,
    ]))).toEqual({ pass: 9, unknown: 13, fail: 0 });

    const predecessorMatch = matched(
      envelopeEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL,
    ).matches[0];
    if (predecessorMatch?.status !== "ok") throw new Error(predecessorMatch?.reason ?? "Expected exact predecessor match");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL
      .check(predecessorMatch.value, envelopeEnvironment)
      .find((entry) => entry.ruleId === "power.feedback.output-voltage")?.status).toBe("unknown");

    const narrowRequest = parseElectricalDesignRequestV2({
      ...structuredClone(envelopeRequest),
      requirements: {
        ...structuredClone(envelopeRequest.requirements),
        dcOutputVoltageRegulation: {
          minimum: { value: 4.75, unit: "V", displayUnit: "V" },
          maximum: { value: 5.17, unit: "V", displayUnit: "V" },
        },
      },
    });
    if (narrowRequest.application !== "power.buck") throw new Error("Expected a Power request");
    const narrowEnvironment = qualifiedReviewedDividerEnvironment(narrowRequest);
    const narrowMatch = matched(
      narrowEnvironment,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION,
    ).matches[0];
    if (narrowMatch?.status !== "ok") throw new Error(narrowMatch?.reason ?? "Expected exact qualified match");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION
      .check(narrowMatch.value, narrowEnvironment)
      .find((entry) => entry.ruleId === "power.feedback.output-voltage")).toMatchObject({
      status: "fail",
      explanation: expect.stringContaining("do not remain inside"),
    });
  });

  it("materializes the inherited behavioral scenario but leaves all unresolved safety boundaries unknown", () => {
    const env = qualifiedInductorEnvironment();
    const recipe = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED;
    const selectedCandidate = candidate(env, recipe);
    expect(selectedCandidate.constraints.some((entry) => entry.status === "fail")).toBe(false);
    for (const ruleId of [
      "power.inductor.saturation-current",
      "power.inductor.rms-current",
      "power.inductor.selected-value",
      "power.regulator.current-limit",
      "power.control.loop-stability",
      "power.thermal.maximum-junction",
    ]) {
      expect(selectedCandidate.constraints.find((entry) => entry.ruleId === ruleId)?.status, ruleId).toBe("unknown");
    }
    const materialized = recipe.materialize(selectedCandidate, env);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuit.defaultScenarioId).toBe("ideal_pwm_output_stage_transient");
    expect(materialized.circuit.circuits.find((entry) => entry.id === "ideal_pwm_output_stage")?.components.find((entry) => entry.id === "power-inductor")).toMatchObject({
      mpn: "F1F2-0804-2R2M",
      value: 0.0000022,
    });
  });
});

describe("facts V3.4.5 exact reference-passive integrated synchronous-buck successor", () => {
  it("pins the exact 10 uH / two-by-22 uF release without drifting predecessor identities", () => {
    expect(designProfileContentHashV34(parseDesignProfileV34(belF1F2Reference))).toBe(
      POWER_INTEGRATED_V345_REFERENCE_INDUCTOR_PROFILE_CONTENT_HASH,
    );
    expect(designProfileEnvelopeContentHash(
      grm32Reference as unknown as NativeEnvironmentV2["catalog"]["profiles"][number],
    )).toBe(
      POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_PROFILE_CONTENT_HASH,
    );
    expect(POWER_INTEGRATED_V345_REFERENCE_OUTPUT_CAPACITOR_QUANTITY).toBe(2);
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.5",
      contentHash: "sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee",
      applications: ["power.buck"],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION.contentHash)
      .toBe("sha256:e39f5e67c0fd52d44170f0222455eade876385ba0771d6e78c420d02aa60999c");
  });

  it("selects one quantity-two BOM line while retaining kernel-derived safety unknowns", () => {
    const env = referencePassiveEnvironment();
    const recipe = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES;
    const selectedCandidate = candidate(env, recipe);
    expect(selectedCandidate.components.find((entry) => entry.id === "power-inductor")).toMatchObject({
      profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
      part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" },
      quantityPerAssembly: 1,
      value: { value: 0.00001, unit: "H" },
    });
    expect(selectedCandidate.components.find((entry) => entry.id === "output-capacitor")).toMatchObject({
      profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
      part: { manufacturerId: "murata-manufacturing", manufacturerPartNumber: "GRM32ER71E226KE15L" },
      quantityPerAssembly: 2,
      value: { value: 0.000022, unit: "F" },
    });
    expect(selectedCandidate.metrics.values.find((entry) => entry.id === "power.native.component-count")).toMatchObject({
      state: "calculated",
      value: { value: 8, unit: "count" },
      explanation: "Selected physical BOM quantity across all lines.",
    });
    const quantityOne = structuredClone(selectedCandidate);
    quantityOne.components.find((entry) => entry.id === "output-capacitor")!.quantityPerAssembly = 1;
    const quantityOneAreaMetric = recipe.estimate(quantityOne, quantityOne.constraints, env).metrics
      .find((entry) => entry.id === "power.native.board-area")!;
    const exactAreaMetric = selectedCandidate.metrics.values
      .find((entry) => entry.id === "power.native.board-area")!;
    if (quantityOneAreaMetric.value === null || exactAreaMetric.value === null) throw new Error("Expected calculated areas");
    const quantityOneArea = quantityOneAreaMetric.value.value;
    const exactArea = exactAreaMetric.value.value;
    expect(exactArea - quantityOneArea).toBeCloseTo(0.00001104, 15);
    for (const [ruleId, diagnosticId] of [
      ["power.inductor.selected-value", "power.passive.inductor.minimum-inductance"],
      ["power.inductor.saturation-current", "power.passive.inductor.saturation-current"],
      ["power.inductor.rms-current", "power.passive.inductor.rms-current"],
      ["power.passive.capacitor-effective-capacitance", "power.passive.capacitor.effective-capacitance"],
      ["power.request.output-ripple", "power.passive.output-ripple"],
      ["power.thermal.loss-model", "power.passive.inductor.loss-bound"],
    ] as const) {
      expect(selectedCandidate.constraints.find((entry) => entry.ruleId === ruleId)).toMatchObject({
        status: "unknown",
        explanation: expect.stringContaining(diagnosticId),
      });
    }
    expect(selectedCandidate.constraints.find((entry) => entry.ruleId === "power.passive.capacitor-effective-capacitance")?.explanation)
      .toContain("2 exact parallel BOM part(s)");
    expect(selectedCandidate.constraints.some((entry) => entry.status === "fail")).toBe(false);
  });

  it("materializes two separate 22 uF parts in each graph and classifies both to the quantity-two line", () => {
    const env = referencePassiveEnvironment();
    const recipe = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES;
    const selectedCandidate = candidate(env, recipe);
    const materialized = recipe.materialize(selectedCandidate, env);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    for (const circuitId of ["assembly", "ideal_pwm_output_stage"] as const) {
      const graph = materialized.circuit.circuits.find((entry) => entry.id === circuitId)!;
      expect(graph.components.filter((entry) => entry.id.startsWith("output-capacitor-"))).toEqual([
        expect.objectContaining({ id: "output-capacitor-1", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
        expect.objectContaining({ id: "output-capacitor-2", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
      ]);
      const classifications = materialized.circuitInstanceClassifications.filter((entry) => (
        entry.circuitId === circuitId
        && entry.kind === "physical"
        && entry.selectedComponentId === "output-capacitor"
      ));
      expect(classifications.map((entry) => entry.componentId)).toEqual([
        "output-capacitor-1",
        "output-capacitor-2",
      ]);
      expect(classifications.reduce((total, entry) => total + (entry.representedQuantityPerAssembly ?? 0), 0)).toBe(2);
    }
    const generated = generateScenarioNetlist(materialized.circuit, "ideal_pwm_output_stage_transient");
    expect(generated.omissions).toEqual([]);
    expect(generated.netlist).toContain("Coc_6f75747075742d636170616369746f722d31");
    expect(generated.netlist).toContain("Coc_6f75747075742d636170616369746f722d32");
  });

  it("uses the passive kernel in match to reject a bounded raw-current safety failure", () => {
    const env = referencePassiveEnvironment(request(12, 12, 6.1));
    const recipe = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES;
    const enumerated = recipe.enumerate(env);
    expect(enumerated).toHaveLength(1);
    const solved = recipe.solve(enumerated[0]!, env);
    if (solved.status !== "ok") throw new Error(solved.reason);
    const matches = recipe.match(solved.value, env);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("deterministic safety failure"),
      constraints: expect.arrayContaining([
        expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "fail" }),
        expect.objectContaining({ ruleId: "power.inductor.rms-current", status: "fail" }),
      ]),
    });
  });

  it("fails closed when the exact quantity-two line or bound output profile is mutated", () => {
    const env = referencePassiveEnvironment();
    const recipe = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES;
    const exactMatch = matched(env, recipe).matches[0];
    if (exactMatch?.status !== "ok") throw new Error(exactMatch?.reason ?? "Expected exact reference-passive match");

    const wrongQuantity = structuredClone(exactMatch.value);
    wrongQuantity.components.find((entry) => entry.id === "output-capacitor")!.quantityPerAssembly = 1;
    expect(recipe.check(wrongQuantity, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.passive-set", status: "unknown" }),
    ]);

    const wrongProfile = structuredClone(exactMatch.value);
    const output = wrongProfile.components.find((entry) => entry.id === "output-capacitor")!;
    output.profileId = "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json";
    output.part = { ...grm31.part };
    output.value = { value: 0.00001, unit: "F", displayUnit: "10 µF" };
    expect(recipe.check(wrongProfile, env)).toEqual([
      expect.objectContaining({ ruleId: "power.profile.passive-set", status: "unknown" }),
    ]);
  });
});

describe("facts V3.4.6 immutable passive operating-observation successor", () => {
  it("keeps V3.4.5 immutable while declaring four A-valued observation metrics", () => {
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES).toMatchObject({
      version: "3.4.5",
      contentHash: "sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee",
      metricDeclarations: [
        { id: "power.native.board-area", unit: "m2" },
        { id: "power.native.component-count", unit: "count" },
      ],
    });
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.6",
      contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
      metricDeclarations: [
        { id: "power.native.board-area", unit: "m2" },
        { id: "power.native.component-count", unit: "count" },
        { id: "power.passive.inductor-peak-current-observation", unit: "A" },
        { id: "power.passive.inductor-ripple-current-observation", unit: "A" },
        { id: "power.passive.inductor-rms-current-observation", unit: "A" },
        { id: "power.passive.output-capacitor-bank-rms-current-observation", unit: "A" },
      ],
    });
  });

  it("surfaces exact worst-point DCM current observations without changing the selected BOM or constraints", () => {
    const observationRequest = structuredClone(request());
    observationRequest.requirements.dcOutputVoltageRegulation = {
      minimum: { value: 4.7, unit: "V", displayUnit: "V" },
      maximum: { value: 5.3, unit: "V", displayUnit: "V" },
    };
    const env = referencePassiveEnvironment(observationRequest);
    const predecessor = candidate(env, POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES);
    const observed = candidate(env, POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS);
    expect(observed.components).toEqual(predecessor.components);
    expect(observed.constraints).toEqual(predecessor.constraints);
    expect(observed.simulationCoverage).toEqual(predecessor.simulationCoverage);
    expect(observed.constraints.some((entry) => entry.status === "fail")).toBe(false);
    for (const ruleId of [
      "power.passive.capacitor-effective-capacitance",
      "power.request.output-ripple",
      "power.thermal.loss-model",
    ]) expect(observed.constraints.find((entry) => entry.ruleId === ruleId)?.status, ruleId).toBe("unknown");

    const passiveMetrics = observed.metrics.values.filter((entry) => entry.id.startsWith("power.passive."));
    expect(passiveMetrics).toHaveLength(4);
    expect(passiveMetrics.every((entry) => entry.state === "estimated" && entry.value?.unit === "A")).toBe(true);
    expect(observed.metrics.estimateCount).toBe(4);
    expect(passiveMetrics.every((entry) => entry.evidence.length > 0)).toBe(true);
    const passiveEvidenceHashes = new Set(passiveMetrics.flatMap((entry) => (
      entry.evidence.map((reference) => reference.contentHash)
    )));
    expect(passiveEvidenceHashes).toEqual(new Set([
      "sha256:1632b388d1ba3a46c8e8f090ddfec2114c0f538cfb8364ddcda583fee3fdbdc5",
      "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873",
      "sha256:c3523b58c262a6d39716711a5a05a5b6e5a60081eb15818bf35ba4b93e7a828f",
    ]));
    expect(passiveMetrics.every((entry) => (
      entry.explanation.includes("Evaluated conduction modes: dcm")
      && entry.explanation.includes("Worst point: vin=12|vout=5.3|iout=0.2|fsw=290000")
      && entry.explanation.includes("not a production bound")
      && entry.explanation.includes("cannot change any constraint status, candidate eligibility")
    ))).toBe(true);
    expect(passiveMetrics.find((entry) => entry.id === "power.passive.inductor-ripple-current-observation")?.value?.value)
      .toBe(0.638874729145);
    expect(passiveMetrics.find((entry) => entry.id === "power.passive.inductor-ripple-current-observation")?.explanation)
      .toContain("peak-to-peak ripple current");
    expect(passiveMetrics.find((entry) => entry.id === "power.passive.inductor-peak-current-observation")?.value?.value)
      .toBe(0.638874729145);
    expect(passiveMetrics.find((entry) => entry.id === "power.passive.inductor-rms-current-observation")?.value?.value)
      .toBe(0.291861777592);
    const bank = passiveMetrics.find((entry) => entry.id === "power.passive.output-capacitor-bank-rms-current-observation");
    expect(bank?.value?.value).toBe(0.212563630989);
    expect(bank?.explanation).toContain("total current for the exact quantity-2 bank");
    expect(bank?.explanation).toContain("no per-part current-sharing multiplier or balance is claimed");

    const predecessorMaterialization = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES
      .materialize(predecessor, env);
    const observedMaterialization = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS
      .materialize(observed, env);
    expect(observedMaterialization).toEqual(predecessorMaterialization);
  });

  it("fails all four observations closed to unknown when the exact bank cannot be reproduced", () => {
    const env = referencePassiveEnvironment();
    const recipe = POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS;
    const exactMatch = matched(env, recipe).matches[0];
    if (exactMatch?.status !== "ok") throw new Error(exactMatch?.reason ?? "Expected exact passive observation match");
    const wrongQuantity = structuredClone(exactMatch.value);
    wrongQuantity.components.find((entry) => entry.id === "output-capacitor")!.quantityPerAssembly = 1;
    const estimate = recipe.estimate(wrongQuantity, recipe.check(wrongQuantity, env), env);
    const passiveMetrics = estimate.metrics.filter((entry) => entry.id.startsWith("power.passive."));
    expect(passiveMetrics).toHaveLength(4);
    expect(passiveMetrics.every((entry) => (
      entry.state === "unknown"
      && entry.value === null
      && entry.explanation.includes("cannot be reproduced")
    ))).toBe(true);
  });
});

function v35BoundFact(value: number, unit: string, validFor: any[], source: any): any {
  return {
    value: { value, unit, displayUnit: unit },
    state: "reviewed",
    evidence: structuredClone(source.evidence),
    validFor,
    explanation: "Synthetic condition-covering bound for calculator wiring tests only.",
  };
}

function v35Condition(parameterId: string, minimum: number, maximum: number, unit: string, source: any): any {
  return {
    parameterId,
    minimum: { value: minimum, unit, displayUnit: unit },
    maximum: { value: maximum, unit, displayUnit: unit },
    evidence: structuredClone(source.evidence),
  };
}

function calculatorV35Environment(currentLimitMinimumA = 4): NativeEnvironmentV2 {
  const primary = structuredClone(tps54302) as any;
  primary.factsSchemaVersion = "3.5.0";
  primary.facts.currentLimitMinimum.value.value = currentLimitMinimumA;
  primary.facts.minimumOnTimeMaximum = v35BoundFact(120e-9, "s", [], primary.facts.minimumOnTime);
  primary.facts.minimumOffTimeMaximum = v35BoundFact(100e-9, "s", [], primary.facts.minimumOnTime);
  primary.facts.thermalResistanceJunctionAmbient = v35BoundFact(120, "K/W", [], primary.facts.junctionToAmbientThermalResistance);
  primary.facts.thermalResistanceJunctionAmbientBoard = {
    value: "declared",
    state: "reviewed",
    evidence: structuredClone(primary.facts.junctionToAmbientThermalResistance.evidence),
    validFor: [],
    explanation: "Synthetic declared board qualifier for calculator wiring tests only.",
  };

  const inductor = structuredClone(belF1F2Reference) as any;
  inductor.factsSchemaVersion = "3.5.0";
  inductor.facts.inductanceMinimum = v35BoundFact(8e-6, "H", [
    v35Condition("ambientTemperature", 273.15, 373.15, "K", inductor.facts.inductance),
    v35Condition("switchingFrequency", 250_000, 600_000, "Hz", inductor.facts.inductance),
    v35Condition("testCurrent", 0, 3, "A", inductor.facts.inductance),
  ], inductor.facts.inductance);
  inductor.facts.coreLossMaximum = v35BoundFact(0.1, "W", [
    v35Condition("switchingFrequency", 250_000, 600_000, "Hz", inductor.facts.inductance),
    v35Condition("testCurrent", 0, 3, "A", inductor.facts.inductance),
  ], inductor.facts.inductance);

  const outputCapacitor = structuredClone(grm32Reference) as any;
  outputCapacitor.factsSchemaVersion = "3.5.0";
  outputCapacitor.facts.effectiveCapacitanceMinimum = v35BoundFact(10e-6, "F", [
    v35Condition("ambientTemperature", 273.15, 373.15, "K", outputCapacitor.facts.nominalCapacitance),
    v35Condition("dcBias", 0, 5.5, "V", outputCapacitor.facts.nominalCapacitance),
  ], outputCapacitor.facts.nominalCapacitance);
  outputCapacitor.facts.esrMaximum = v35BoundFact(0.01, "ohm", [
    v35Condition("switchingFrequency", 250_000, 600_000, "Hz", outputCapacitor.facts.nominalCapacitance),
  ], outputCapacitor.facts.nominalCapacitance);

  const base = qualifiedReviewedDividerEnvironment(request());
  return {
    ...base,
    catalog: {
      profiles: [
        ...base.catalog.profiles.filter((profile) => ![
          "TPS54302DDCR",
          "F1F2-0804-100M",
          "GRM32ER71E226KE15L",
        ].includes(profile.part.manufacturerPartNumber)),
        primary,
        inductor,
        outputCapacitor,
      ] as NativeEnvironmentV2["catalog"]["profiles"],
    },
  };
}

describe("facts V3.5 calculator-backed integrated buck rules", () => {
  it("turns current-limit coordination into PASS with all condition-covering facts", () => {
    const result = candidate(
      calculatorV35Environment(),
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V35_BOUND_CALCULATORS,
    );
    expect(result.constraints).toContainEqual(expect.objectContaining({
      ruleId: "power.regulator.current-limit",
      status: "pass",
    }));
  });

  it("turns current-limit coordination into FAIL when the guaranteed minimum misses margin", () => {
    const result = candidate(
      calculatorV35Environment(0.3),
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V35_BOUND_CALCULATORS,
    );
    expect(result.constraints).toContainEqual(expect.objectContaining({
      ruleId: "power.regulator.current-limit",
      status: "fail",
    }));
  });

  it("keeps a condition-mismatched inductance bound as a named current-limit UNKNOWN", () => {
    const environmentValue = structuredClone(calculatorV35Environment()) as any;
    const inductor = environmentValue.catalog.profiles.find((profile: any) => (
      profile.part.manufacturerPartNumber === "F1F2-0804-100M"
    ));
    inductor.facts.inductanceMinimum.validFor.find((condition: any) => (
      condition.parameterId === "ambientTemperature"
    )).maximum.value = 290;
    const result = candidate(
      environmentValue,
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V35_BOUND_CALCULATORS,
    );
    expect(result.constraints).toContainEqual(expect.objectContaining({
      ruleId: "power.regulator.current-limit",
      status: "unknown",
      explanation: expect.stringContaining("inductanceMinimumH"),
    }));
  });

  it("names the frozen facts 3.5 transition-bound schema gap in both thermal UNKNOWNs", () => {
    const result = candidate(
      calculatorV35Environment(),
      POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V35_BOUND_CALCULATORS,
    );
    expect(result.constraints).toContainEqual(expect.objectContaining({
      ruleId: "power.thermal.loss-model",
      status: "unknown",
      explanation: expect.stringContaining("facts 3.5 has no switching-transition bound field"),
    }));
    expect(result.constraints).toContainEqual(expect.objectContaining({
      ruleId: "power.thermal.maximum-junction",
      status: "unknown",
      explanation: expect.stringContaining("facts 3.5 has no switching-transition bound field"),
    }));
  });
});
