import { readFileSync } from "node:fs";
import { assertValidCircuit } from "@opencircuit/circuit-schema";
import { canonicalStringify } from "@opencircuit/design-engine";
import { migrateDesignRequest, type BrushedDcMotorDesignRequest, type DesignCandidate } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  MOTOR_EQUATION_IDS,
  SYNTHETIC_MOTOR_CATALOG,
  deriveBehavioralMotorLoad,
  generateMotorDesign,
  validateMotorFixtureCatalog,
} from "../src";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "../src/fixtures";

function fixture(name: "m1-compact" | "m2-power"): BrushedDcMotorDesignRequest {
  const source = readFileSync(
    new URL(`../../design-schema/test/fixtures/requests/${name}.design-request.json`, import.meta.url),
    "utf8",
  );
  const request = migrateDesignRequest(JSON.parse(source));
  if (request.application !== "motor.brushed-dc") throw new Error(`${name} is not a motor request`);
  return request;
}

function metric(candidate: DesignCandidate, id: string): number {
  const value = candidate.metrics.values.find((entry) => entry.id === id)?.value?.value;
  if (value === undefined) throw new Error(`Missing metric ${id}`);
  return value;
}

function candidateWith(candidateProfiles: readonly string[], result: ReturnType<typeof generateMotorDesign>): DesignCandidate {
  const candidate = result.candidates.find((entry) =>
    candidateProfiles.every((profileId) => entry.components.some((component) => component.profileId === profileId)));
  if (!candidate) throw new Error(`Missing candidate with ${candidateProfiles.join(", ")}`);
  return candidate;
}

function expectLossSum(candidate: DesignCandidate): void {
  const parts = [
    "motor.loss.conduction",
    "motor.loss.switching",
    "motor.loss.driver",
    "motor.loss.gate-drive",
    "motor.loss.shunt",
    "motor.loss.passive",
  ].reduce((sum, id) => sum + metric(candidate, id), 0);
  expect(metric(candidate, "motor.loss.total")).toBeCloseTo(parts, 12);
}

describe("synthetic Motor A1 fixture catalog", () => {
  it("is explicit, internally consistent, and contains no real-part review claim", () => {
    expect(() => validateMotorFixtureCatalog(SYNTHETIC_MOTOR_CATALOG)).not.toThrow();
    const profiles = [
      ...SYNTHETIC_MOTOR_CATALOG.integratedBridges,
      ...SYNTHETIC_MOTOR_CATALOG.gateDrivers,
      ...SYNTHETIC_MOTOR_CATALOG.mosfets,
      ...SYNTHETIC_MOTOR_CATALOG.capacitors,
      ...SYNTHETIC_MOTOR_CATALOG.resistors,
      ...SYNTHETIC_MOTOR_CATALOG.shunts,
    ];
    expect(profiles).not.toHaveLength(0);
    for (const profile of profiles) {
      expect(profile.state).toBe("synthetic_test_fixture");
      expect(profile.part.manufacturerId).toMatch(/^schemagic-synthetic-/);
      expect(profile.part.manufacturerPartNumber).toMatch(/^SYNTHETIC-/);
      expect(profile.evidence).not.toHaveLength(0);
      expect(profile.evidence.every((entry) => entry.sourceId.startsWith("synthetic:"))).toBe(true);
      expect(profile.evidence.every((entry) => /synthetic/i.test(entry.locator))).toBe(true);
    }
  });

  it("exports typed demo fixtures equal to the frozen design-schema fixtures", () => {
    expect(M1_COMPACT_REQUEST).toEqual(fixture("m1-compact"));
    expect(M2_POWER_REQUEST).toEqual(fixture("m2-power"));
    expect(Object.isFrozen(M1_COMPACT_REQUEST.requirements.operatingPoint)).toBe(true);
    expect(Object.isFrozen(M2_POWER_REQUEST.constraints)).toBe(true);
  });

  it("keeps missing R/L/back-EMF load facts explicit instead of inventing dynamics", () => {
    const load = deriveBehavioralMotorLoad(M1_COMPACT_REQUEST);
    expect(load.modelId).toBe("motor.brushed-dc.r-l-back-emf.v1");
    expect(load.windingResistance).toEqual(expect.objectContaining({ state: "estimated", value: { value: 2.4, unit: "ohm", displayUnit: "Ω" } }));
    expect(load.windingInductance).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    expect(load.backEmfConstant).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    expect(load.targetBackEmf).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    expect(load.scenarioEligibility).toEqual({
      pwmLoadedSteadyState: true,
      startup: false,
      stallOrCurrentLimit: false,
      fastDecayBrake: false,
    });
  });
});

describe("M1 compact integrated H-bridge recipe", () => {
  it("returns two valid synthetic manufacturers with complete evidence and inspectable rejection", () => {
    const result = generateMotorDesign(structuredClone(M1_COMPACT_REQUEST));
    const manufacturers = new Set(result.candidates.map((candidate) =>
      candidate.components.find((component) => component.role === "h-bridge-driver")?.part.manufacturerId));

    expect(result.candidates).toHaveLength(2);
    expect(result.rejections).toHaveLength(1);
    expect(manufacturers.size).toBeGreaterThanOrEqual(2);
    expect(result.candidates.every((candidate) => candidate.recipeId === "motor.brushed-dc.integrated-h-bridge.v1")).toBe(true);
    for (const candidate of result.candidates) {
      expect(candidate.constraints.some((entry) => entry.status === "fail" || entry.status === "unknown")).toBe(false);
      expect(candidate.constraints.every((entry) => entry.evidence.length > 0)).toBe(true);
      expect(candidate.derivedValues.every((entry) => entry.equationId.length > 0 && entry.evidence.length > 0)).toBe(true);
      expect(candidate.metrics.unknownCount).toBeGreaterThan(0);
      expect(candidate.simulationCoverage).toEqual(expect.arrayContaining([
        expect.objectContaining({ scenarioId: "pwm_loaded_steady_state", modelTier: "behavioral" }),
        expect.objectContaining({ scenarioId: "startup", modelTier: "unavailable" }),
        expect.objectContaining({ scenarioId: "stall_or_current_limit", modelTier: "unavailable" }),
        expect.objectContaining({ scenarioId: "fast_decay_brake", modelTier: "unavailable" }),
      ]));
      expect(candidate.warnings.join(" ")).toMatch(/synthetic fixture/i);
      expect(() => assertValidCircuit(candidate.circuit)).not.toThrow();
      expect(candidate.circuit.meta.description).toMatch(/editable averaged operating-point model/i);
      expectLossSum(candidate);
    }

    const rejected = result.rejections.find((entry) =>
      entry.componentProfileIds.includes("motor.fixture.integrated.rejected-low-voltage"));
    expect(rejected).toEqual(expect.objectContaining({ stage: "check", reason: "Hard electrical constraint failed" }));
    expect(rejected?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.integrated.supply-maximum", status: "fail" }),
      expect.objectContaining({ ruleId: "motor.integrated.continuous-current", status: "fail" }),
    ]));
  });

  it("agrees with an independent M1 hand calculation", () => {
    const result = generateMotorDesign(structuredClone(M1_COMPACT_REQUEST));
    const candidate = candidateWith(["motor.fixture.integrated.alpha"], result);
    const conductionW = 1.5 ** 2 * 0.16;
    const switchingW = 12 * 1.5 * 100e-9 * 20_000 * 2;
    const driverW = 12 * 0.003;
    const totalW = conductionW + switchingW + driverW;
    const outputPowerW = 12 * 0.8 * 1.5;

    expect(metric(candidate, "motor.loss.conduction")).toBeCloseTo(conductionW, 12);
    expect(metric(candidate, "motor.loss.switching")).toBeCloseTo(switchingW, 12);
    expect(metric(candidate, "motor.loss.total")).toBeCloseTo(totalW, 12);
    expect(metric(candidate, "motor.efficiency")).toBeCloseTo(outputPowerW / (outputPowerW + totalW), 12);
    expect(metric(candidate, "motor.temperature.hottest-junction")).toBeCloseTo(313.15 + totalW * 42, 12);
  });
});

describe("M2 power external-NMOS H-bridge recipe", () => {
  it("returns a multi-driver Pareto set with bootstrap/shunt/thermal evidence", () => {
    const result = generateMotorDesign(structuredClone(M2_POWER_REQUEST));
    const driverManufacturers = new Set(result.candidates.map((candidate) =>
      candidate.components.find((component) => component.role === "h-bridge-driver")?.part.manufacturerId));

    expect(result.candidates).toHaveLength(4);
    expect(result.rejections).toHaveLength(5);
    expect(driverManufacturers.size).toBeGreaterThanOrEqual(2);
    expect(result.candidates.every((candidate) => candidate.recipeId === "motor.brushed-dc.external-nmos-h-bridge.v1")).toBe(true);
    for (const candidate of result.candidates) {
      const rules = new Map(candidate.constraints.map((entry) => [entry.ruleId, entry]));
      for (const ruleId of [
        "motor.external.mosfet-vds-margin",
        "motor.external.gate-transition-time",
        "motor.external.bootstrap-capacitance",
        "motor.external.shunt-continuous-power",
        "motor.external.shunt-pulse-power",
        "motor.external.sense-range",
        "motor.external.fet-junction-temperature",
        "motor.external.driver-junction-temperature",
      ]) expect(rules.get(ruleId)?.status).toBe("pass");
      expect(candidate.constraints.some((entry) => entry.status === "fail" || entry.status === "unknown")).toBe(false);
      expect(candidate.derivedValues).toEqual(expect.arrayContaining([
        expect.objectContaining({ equationId: MOTOR_EQUATION_IDS.bootstrapCapacitance, state: "calculated" }),
      ]));
      expect(candidate.components).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: "bridge-nmos", quantityPerAssembly: 4 }),
        expect.objectContaining({ role: "current-sense-shunt", quantityPerAssembly: 1 }),
        expect.objectContaining({ role: "bootstrap-capacitor", quantityPerAssembly: 2 }),
      ]));
      expectLossSum(candidate);
    }

    const lowVoltageMosfet = result.rejections.find((entry) =>
      entry.componentProfileIds.includes("motor.fixture.mosfet.rejected-low-voltage"));
    expect(lowVoltageMosfet?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.mosfet-vds-margin", status: "fail" }),
      expect.objectContaining({ ruleId: "motor.external.mosfet-pulsed-current", status: "fail" }),
    ]));

    const unknownDriver = result.rejections.find((entry) =>
      entry.componentProfileIds.includes("motor.fixture.gate-driver.rejected-unknown-bootstrap"));
    expect(unknownDriver?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.logic-high", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
    ]));
  });

  it("agrees with an independent M2 hand calculation and matches passives deterministically", () => {
    const result = generateMotorDesign(structuredClone(M2_POWER_REQUEST));
    const candidate = candidateWith(["motor.fixture.gate-driver.delta", "motor.fixture.mosfet.eta"], result);
    const transitionS = 55e-9 / 1.5 + 55e-9 / 2;
    const conductionW = 2 * 5 ** 2 * 0.01;
    const switchingW = 24 * 5 * transitionS * 20_000;
    const gateDriveW = 4 * 55e-9 * 10 * 20_000;
    const driverW = 24 * 0.004;
    const shuntW = 5 ** 2 * 0.01;
    const totalW = conductionW + switchingW + gateDriveW + driverW + shuntW;

    expect(metric(candidate, "motor.loss.conduction")).toBeCloseTo(conductionW, 12);
    expect(metric(candidate, "motor.loss.switching")).toBeCloseTo(switchingW, 12);
    expect(metric(candidate, "motor.loss.gate-drive")).toBeCloseTo(gateDriveW, 12);
    expect(metric(candidate, "motor.loss.total")).toBeCloseTo(totalW, 12);
    expect(candidate.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ profileId: "motor.fixture.capacitor.bootstrap-330nf" }),
      expect.objectContaining({ profileId: "motor.fixture.capacitor.decoupling-1uf-50v" }),
      expect.objectContaining({ profileId: "motor.fixture.capacitor.bulk-1000uf-50v" }),
      expect.objectContaining({ profileId: "motor.fixture.shunt.10mohm" }),
    ]));
  });

  it("preserves monotonic current loss and voltage-margin behavior", () => {
    const base = generateMotorDesign(structuredClone(M2_POWER_REQUEST));
    const higherCurrentRequest = structuredClone(M2_POWER_REQUEST);
    higherCurrentRequest.requirements.continuousCurrent.value = 6;
    higherCurrentRequest.requirements.operatingPoint.loadCurrent.value = 6;
    const higherCurrent = generateMotorDesign(higherCurrentRequest);
    const higherVoltageRequest = structuredClone(M2_POWER_REQUEST);
    higherVoltageRequest.requirements.supplyVoltage.maximum.value = 32;
    const higherVoltage = generateMotorDesign(higherVoltageRequest);

    const profiles = ["motor.fixture.gate-driver.delta", "motor.fixture.mosfet.eta"];
    expect(metric(candidateWith(profiles, higherCurrent), "motor.loss.total"))
      .toBeGreaterThan(metric(candidateWith(profiles, base), "motor.loss.total"));
    expect(metric(candidateWith(profiles, higherVoltage), "motor.margin.voltage"))
      .toBeLessThan(metric(candidateWith(profiles, base), "motor.margin.voltage"));
  });
});

describe("deterministic engine integration and range gates", () => {
  it("is byte-stable across repeated M1 and M2 runs", () => {
    for (const request of [M1_COMPACT_REQUEST, M2_POWER_REQUEST]) {
      const first = generateMotorDesign(structuredClone(request));
      const second = generateMotorDesign(structuredClone(request));
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(canonicalStringify(first)).toBe(canonicalStringify(second));
      expect(first.trace.counts.materialized).toBe(first.candidates.length);
      expect(first.trace.counts.rejected).toBe(first.rejections.length);
    }
  });

  it("stops unsupported Motor V1 inputs at the frozen request validator", () => {
    const outsideEnvelope = structuredClone(M2_POWER_REQUEST);
    outsideEnvelope.requirements.supplyVoltage.maximum.value = 61;
    expect(() => generateMotorDesign(outsideEnvelope)).toThrow(/60 V|maximum|range/i);
  });
});
