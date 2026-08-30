import { describe, expect, it } from "vitest";
import { canonicalStringify, type DesignGeneration } from "@opencircuit/design-engine";
import { validateDesignRequest, type DesignCandidate } from "@opencircuit/design-schema";
import {
  BUCK_EQUATION_IDS,
  SYNTHETIC_BUCK_TEST_CATALOG,
  generateBuckDesign,
} from "../src";
import {
  createP1CompactRequest,
  createP2HighVoltageRequest,
  generateP1CompactFixture,
  generateP2HighVoltageFixture,
} from "../src/fixtures";

function metricValue(candidate: DesignCandidate, id: string): number {
  const value = candidate.metrics.values.find((entry) => entry.id === id)?.value;
  if (!value) throw new Error(`Candidate ${candidate.id} is missing numeric metric ${id}`);
  return value.value;
}

function derivedValue(candidate: DesignCandidate, id: string): number {
  const value = candidate.derivedValues.find((entry) => entry.id === id)?.value;
  if (!value) throw new Error(`Candidate ${candidate.id} is missing derived value ${id}`);
  return value.value;
}

function primaryComponent(candidate: DesignCandidate): DesignCandidate["components"][number] {
  const primary = candidate.components.find((component) => component.role === "power.regulator" || component.role === "power.controller");
  if (!primary) throw new Error(`Candidate ${candidate.id} has no primary component`);
  return primary;
}

function candidateForPart(generation: DesignGeneration, partNumber: string): DesignCandidate {
  const candidate = generation.candidates.find((entry) => primaryComponent(entry).part.manufacturerPartNumber === partNumber);
  if (!candidate) throw new Error(`No surviving candidate uses ${partNumber}`);
  return candidate;
}

function expectLossTotalCloses(candidate: DesignCandidate): void {
  const componentLossIds = [
    "power.conduction-loss",
    "power.switching-loss",
    "power.gate-drive-loss",
    "power.controller-or-quiescent-loss",
    "power.inductor-copper-loss",
    "power.inductor-core-loss",
    "power.capacitor-loss",
    "power.feedback-loss",
  ];
  const sum = componentLossIds.reduce((total, id) => total + metricValue(candidate, id), 0);
  expect(sum).toBeCloseTo(metricValue(candidate, "power.total-loss"), 12);
}

describe("scheMAGIC Power Designer Track B1", () => {
  it("publishes schema-valid fresh P1/P2 fixture factories", () => {
    const p1 = createP1CompactRequest();
    const p2 = createP2HighVoltageRequest();

    expect(validateDesignRequest(p1)).toEqual([]);
    expect(validateDesignRequest(p2)).toEqual([]);
    expect(createP1CompactRequest()).not.toBe(p1);
    expect(createP2HighVoltageRequest()).not.toBe(p2);
    p1.requirements.outputVoltage.value = 4;
    expect(createP1CompactRequest().requirements.outputVoltage.value).toBe(5);
  });

  it("generates byte-stable P1 integrated candidates from three synthetic manufacturers", () => {
    const first = generateP1CompactFixture();
    const second = generateBuckDesign(createP1CompactRequest());

    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(first.candidates.length).toBeGreaterThanOrEqual(3);
    expect(new Set(first.candidates.map((candidate) => primaryComponent(candidate).part.manufacturerId)).size).toBeGreaterThanOrEqual(3);
    expect(first.candidates.every((candidate) => candidate.recipeId === "schemagic.power.buck.integrated-synchronous.v1")).toBe(true);
    expect(first.candidates.every((candidate) => candidate.constraints.every((constraint) => constraint.status !== "fail" && constraint.status !== "unknown"))).toBe(true);
    expect(first.candidates.every((candidate) => metricValue(candidate, "power.output-ripple") <= 0.03)).toBe(true);
    expect(first.candidates.every((candidate) => metricValue(candidate, "power.hottest-junction-temperature") <= 398.15)).toBe(true);
    first.candidates.forEach(expectLossTotalCloses);
  });

  it("generates byte-stable P2 external-FET candidates across two synthetic controller manufacturers", () => {
    const first = generateP2HighVoltageFixture();
    const second = generateBuckDesign(createP2HighVoltageRequest());

    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(first.candidates.length).toBeGreaterThanOrEqual(2);
    expect(new Set(first.candidates.map((candidate) => primaryComponent(candidate).part.manufacturerId)).size).toBeGreaterThanOrEqual(2);
    expect(first.candidates.every((candidate) => candidate.recipeId === "schemagic.power.buck.controller-external-nmos.v1")).toBe(true);
    expect(first.candidates.every((candidate) => candidate.components.some((component) => component.role === "power.high-side-mosfet"))).toBe(true);
    expect(first.candidates.every((candidate) => candidate.components.some((component) => component.role === "power.low-side-mosfet"))).toBe(true);
    expect(first.candidates.every((candidate) => metricValue(candidate, "power.output-ripple") <= 0.1)).toBe(true);
    first.candidates.forEach(expectLossTotalCloses);
  });

  it("retains named equations and agrees with independent P1/P2 sizing calculations", () => {
    const p1 = candidateForPart(generateP1CompactFixture(), "SYN-P1-ALPHA");
    const p2 = candidateForPart(generateP2HighVoltageFixture(), "SYN-P2-DELTA");
    const expectedP1Inductance = 5 * (1 - 5 / 16) / (500_000 * (0.3 * 3));
    const expectedP2Inductance = 12 * (1 - 12 / 52) / (200_000 * (0.3 * 5));

    expect(derivedValue(p1, "buck.inductor.target")).toBeCloseTo(expectedP1Inductance, 14);
    expect(derivedValue(p2, "buck.inductor.target")).toBeCloseTo(expectedP2Inductance, 14);
    expect(p1.derivedValues.find((entry) => entry.id === "buck.inductor.target")?.equationId).toBe(BUCK_EQUATION_IDS.inductorTarget);
    expect(p2.derivedValues.find((entry) => entry.id === "buck.output-ripple")?.equationId).toBe(BUCK_EQUATION_IDS.outputRipple);
    expect(p1.derivedValues.every((entry) => entry.equationId.length > 0 && entry.evidence.length > 0)).toBe(true);
    expect(p2.derivedValues.every((entry) => entry.equationId.length > 0 && entry.evidence.length > 0)).toBe(true);
  });

  it("checks voltage, current, frequency, timing, ripple, loss, thermal, and control confidence", () => {
    const generations = [generateP1CompactFixture(), generateP2HighVoltageFixture()];
    const requiredRules = [
      "buck.device.input-maximum",
      "buck.device.output-current",
      "buck.device.switching-frequency-maximum",
      "buck.minimum-on-time",
      "buck.minimum-off-time",
      "buck.current-limit",
      "buck.output-ripple",
      "buck.loss.less-than-output-power",
      "buck.loss-model-confidence",
      "buck.thermal.maximum-junction",
      "buck.control-model-confidence",
    ];
    for (const generation of generations) {
      for (const candidate of generation.candidates) {
        const rules = new Set(candidate.constraints.map((constraint) => constraint.ruleId));
        requiredRules.forEach((rule) => expect(rules.has(rule), `${candidate.id} missing ${rule}`).toBe(true));
        expect(candidate.constraints.find((constraint) => constraint.ruleId === "buck.control-model-confidence")?.status).toBe("warning");
        expect(candidate.metrics.values.find((entry) => entry.id === "power.loop-phase-margin")).toEqual(expect.objectContaining({
          value: null,
          state: "unknown",
        }));
      }
    }
  });

  it("visibly warns when only nominal capacitor evidence is available", () => {
    const generation = generateP1CompactFixture();
    const nominalOnly = generation.candidates.find((candidate) => candidate.components.some(
      (component) => component.profileId === "synthetic.capacitor.output-nominal-only-16v",
    ));

    expect(nominalOnly).toBeDefined();
    expect(nominalOnly?.constraints).toContainEqual(expect.objectContaining({
      ruleId: "buck.output-capacitor.effective-capacitance-confidence",
      status: "warning",
    }));
    expect(nominalOnly?.warnings.some((warning) => warning.includes("nominal capacitance only"))).toBe(true);
  });

  it("exposes deterministic engine rejection details for primary, timing, control, and FET failures", () => {
    const p1 = generateP1CompactFixture();
    const p2 = generateP2HighVoltageFixture();

    expect(p1.rejections).toContainEqual(expect.objectContaining({
      stage: "match",
      componentProfileIds: ["synthetic.integrated.reject-vin-15v"],
      reason: expect.stringContaining("voltage, current, or frequency"),
    }));
    expect(p1.rejections).toContainEqual(expect.objectContaining({
      stage: "check",
      componentProfileIds: expect.arrayContaining([expect.stringContaining("reject-off-time")]),
      constraints: expect.arrayContaining([expect.objectContaining({ ruleId: "buck.minimum-off-time", status: "fail" })]),
    }));
    expect(p1.rejections).toContainEqual(expect.objectContaining({
      stage: "check",
      componentProfileIds: expect.arrayContaining([expect.stringContaining("reject-control-unknown")]),
      constraints: expect.arrayContaining([expect.objectContaining({ ruleId: "buck.control-model-confidence", status: "unknown" })]),
    }));
    expect(p2.rejections).toContainEqual(expect.objectContaining({
      stage: "match",
      componentProfileIds: expect.arrayContaining(["synthetic.mosfet.reject-60v"]),
      constraints: expect.arrayContaining([expect.objectContaining({ ruleId: "buck.mosfet.voltage-headroom", status: "fail" })]),
    }));
    expect([...p1.rejections, ...p2.rejections].every((rejection) => rejection.reason.length > 0)).toBe(true);
  });

  it("labels every profile and surviving selection as synthetic test-only evidence", () => {
    const allProfiles = [
      ...SYNTHETIC_BUCK_TEST_CATALOG.integratedRegulators,
      ...SYNTHETIC_BUCK_TEST_CATALOG.externalControllers,
      ...SYNTHETIC_BUCK_TEST_CATALOG.mosfets,
      ...SYNTHETIC_BUCK_TEST_CATALOG.inductors,
      ...SYNTHETIC_BUCK_TEST_CATALOG.capacitors,
      ...SYNTHETIC_BUCK_TEST_CATALOG.resistors,
    ];
    expect(allProfiles.every((profile) => profile.profileKind === "synthetic_test_fixture")).toBe(true);
    expect(allProfiles.every((profile) => profile.part.manufacturerId.startsWith("synthetic-"))).toBe(true);
    expect(allProfiles.every((profile) => profile.evidence.every((entry) => entry.licenseNote.includes("not a real manufacturer datasheet")))).toBe(true);
    expect(Object.isFrozen(SYNTHETIC_BUCK_TEST_CATALOG)).toBe(true);
    expect(allProfiles.every(Object.isFrozen)).toBe(true);
    expect(allProfiles.every((profile) => Object.isFrozen(profile.part) && Object.isFrozen(profile.evidence))).toBe(true);
  });

  it("reports honest B2 behavioral and unavailable simulation tiers", () => {
    for (const generation of [generateP1CompactFixture(), generateP2HighVoltageFixture()]) {
      for (const candidate of generation.candidates) {
        expect(candidate.circuit.meta.description).toContain("behavioral power stage");
        expect(candidate.simulationCoverage.map((entry) => entry.scenarioId)).toEqual([
          "line_step",
          "load_step",
          "startup",
          "steady_state",
        ]);
        expect(candidate.simulationCoverage.find((entry) => entry.scenarioId === "steady_state")?.modelTier).toBe("behavioral");
        expect(candidate.simulationCoverage.find((entry) => entry.scenarioId === "startup")?.modelTier).toBe("behavioral");
        expect(candidate.simulationCoverage.find((entry) => entry.scenarioId === "load_step")?.modelTier).toBe("unavailable");
        expect(candidate.simulationCoverage.find((entry) => entry.scenarioId === "line_step")?.modelTier).toBe("unavailable");
      }
    }
  });
});
