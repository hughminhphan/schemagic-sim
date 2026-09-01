import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deserializeDesignRequest,
  designRequestHash,
  migrateDesignRequest,
  serializeDesignRequest,
  validateDesignRequest,
  type DesignRequest,
} from "../src";

const FIXTURES = ["m1-compact", "m2-power", "p1-compact", "p2-high-voltage"] as const;

function loadFixture(name: typeof FIXTURES[number]): DesignRequest {
  const source = readFileSync(new URL(`./fixtures/requests/${name}.design-request.json`, import.meta.url), "utf8");
  return migrateDesignRequest(JSON.parse(source));
}

describe("scheMAGIC Designer request contract", () => {
  for (const name of FIXTURES) {
    it(`validates and losslessly round-trips ${name}`, () => {
      const fixture = loadFixture(name);
      expect(validateDesignRequest(fixture)).toEqual([]);
      expect(deserializeDesignRequest(serializeDesignRequest(fixture))).toEqual(fixture);
      expect(designRequestHash(deserializeDesignRequest(serializeDesignRequest(fixture)))).toBe(designRequestHash(fixture));
      expect(fixture.assumptions.length).toBeGreaterThan(0);
    });
  }

  it("pins the four handoff reference operating points", () => {
    const m1 = loadFixture("m1-compact");
    const m2 = loadFixture("m2-power");
    const p1 = loadFixture("p1-compact");
    const p2 = loadFixture("p2-high-voltage");

    expect(m1.application).toBe("motor.brushed-dc");
    if (m1.application === "motor.brushed-dc") {
      expect(m1.requirements.supplyVoltage).toMatchObject({ minimum: { value: 9 }, nominal: { value: 12 }, maximum: { value: 16 } });
      expect(m1.requirements.continuousCurrent.value).toBe(1.5);
      expect(m1.requirements.stallCurrent.value).toBe(5);
      expect(m1.requirements.operatingPoint).toMatchObject({
        dutyCycle: { value: 0.8, unit: "1" },
        loadCurrent: { value: 1.5, unit: "A" },
        loadCurrentBasis: "continuous_rating",
        loadProfile: "steady_state",
      });
    }
    expect(m2.application).toBe("motor.brushed-dc");
    if (m2.application === "motor.brushed-dc") {
      expect(m2.requirements.supplyVoltage).toMatchObject({ minimum: { value: 18 }, nominal: { value: 24 }, maximum: { value: 30 } });
      expect(m2.requirements.continuousCurrent.value).toBe(5);
      expect(m2.requirements.stallCurrent.value).toBe(20);
      expect(m2.requirements.operatingPoint).toMatchObject({
        dutyCycle: { value: 0.8, unit: "1" },
        loadCurrent: { value: 5, unit: "A" },
        loadCurrentBasis: "continuous_rating",
        loadProfile: "steady_state",
      });
    }
    expect(p1.application).toBe("power.buck");
    if (p1.application === "power.buck") {
      expect(p1.requirements.inputVoltage).toMatchObject({ minimum: { value: 9 }, nominal: { value: 12 }, maximum: { value: 16 } });
      expect(p1.requirements.outputVoltage.value).toBe(5);
      expect(p1.requirements.maximumOutputCurrent.value).toBe(3);
      expect(p1.requirements.maximumOutputRipple.value).toBe(0.03);
      expect(p1.requirements.dcOutputVoltageRegulation).toBeUndefined();
    }
    expect(p2.application).toBe("power.buck");
    if (p2.application === "power.buck") {
      expect(p2.requirements.inputVoltage).toMatchObject({ minimum: { value: 36 }, nominal: { value: 48 }, maximum: { value: 52 } });
      expect(p2.requirements.outputVoltage.value).toBe(12);
      expect(p2.requirements.maximumOutputCurrent.value).toBe(5);
      expect(p2.requirements.maximumOutputRipple.value).toBe(0.1);
    }
  });

  it("rejects a quantity stored in the wrong canonical unit", () => {
    const invalid = structuredClone(loadFixture("m1-compact"));
    if (invalid.application !== "motor.brushed-dc") throw new Error("Expected motor fixture");
    (invalid.requirements.supplyVoltage.minimum as { unit: string }).unit = "A";
    expect(validateDesignRequest(invalid)).toContainEqual(expect.objectContaining({
      path: "requirements.supplyVoltage.minimum.unit",
      code: "invalid_unit",
    }));
  });

  it("rejects values outside each V1 application envelope", () => {
    const motor = structuredClone(loadFixture("m2-power"));
    if (motor.application !== "motor.brushed-dc") throw new Error("Expected motor fixture");
    motor.requirements.stallCurrent.value = 31;
    expect(validateDesignRequest(motor)).toContainEqual(expect.objectContaining({
      path: "requirements.stallCurrent.value",
      code: "invalid_range",
    }));

    const buck = structuredClone(loadFixture("p1-compact"));
    if (buck.application !== "power.buck") throw new Error("Expected buck fixture");
    buck.requirements.outputVoltage.value = 9;
    expect(validateDesignRequest(buck)).toContainEqual(expect.objectContaining({
      path: "requirements.outputVoltage.value",
      code: "invalid_range",
    }));
  });

  it("rejects topology families owned by the other application", () => {
    const invalid = structuredClone(loadFixture("p1-compact"));
    invalid.constraints.allowedTopologyFamilies = ["motor.hbridge.integrated"];
    expect(validateDesignRequest(invalid)).toContainEqual(expect.objectContaining({
      path: "constraints.allowedTopologyFamilies.0",
      code: "unsupported_value",
    }));
  });

  it("accepts an additive Power DC regulation envelope and rejects invalid bounds", () => {
    const valid = structuredClone(loadFixture("p1-compact"));
    if (valid.application !== "power.buck") throw new Error("Expected buck fixture");
    valid.requirements.dcOutputVoltageRegulation = {
      minimum: { value: 4.7, unit: "V", displayUnit: "V" },
      maximum: { value: 5.3, unit: "V", displayUnit: "V" },
    };
    expect(validateDesignRequest(valid)).toEqual([]);
    expect(deserializeDesignRequest(serializeDesignRequest(valid))).toEqual(valid);

    const reversed = structuredClone(valid);
    reversed.requirements.dcOutputVoltageRegulation = {
      minimum: { value: 5.3, unit: "V", displayUnit: "V" },
      maximum: { value: 5.4, unit: "V", displayUnit: "V" },
    };
    expect(validateDesignRequest(reversed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "requirements.dcOutputVoltageRegulation.minimum.value", code: "invalid_range" }),
    ]));

    const wrongUnit = structuredClone(valid);
    wrongUnit.requirements.dcOutputVoltageRegulation!.minimum.unit = "A" as "V";
    expect(validateDesignRequest(wrongUnit)).toContainEqual(expect.objectContaining({
      path: "requirements.dcOutputVoltageRegulation.minimum.unit",
      code: "invalid_unit",
    }));
  });

  it("delegates an embedded sourcing policy to the sourcing schema", () => {
    const invalid = structuredClone(loadFixture("m1-compact"));
    (invalid as unknown as { sourcing: unknown }).sourcing = {};
    expect(validateDesignRequest(invalid)).toContainEqual(expect.objectContaining({
      path: expect.stringMatching(/^sourcing\./),
    }));
  });

  it("rejects undeclared persisted fields instead of round-tripping them", () => {
    const invalidRequests: Array<{ value: unknown; expectedPath: string }> = [];

    const rootSecret = structuredClone(loadFixture("m1-compact")) as unknown as Record<string, unknown>;
    rootSecret.apiKey = "must-not-persist";
    invalidRequests.push({ value: rootSecret, expectedPath: "apiKey" });

    const rootSnapshot = structuredClone(loadFixture("p1-compact")) as unknown as Record<string, unknown>;
    rootSnapshot.offerSnapshot = { offers: [] };
    invalidRequests.push({ value: rootSnapshot, expectedPath: "offerSnapshot" });

    const nestedProviderData = structuredClone(loadFixture("m1-compact")) as unknown as {
      sourcing: Record<string, unknown>;
    };
    nestedProviderData.sourcing = {
      schemaVersion: 1,
      distributors: ["digikey"],
      mode: "any_selected",
      buildQuantity: 1,
      region: "US",
      currency: "USD",
      allowedLifecycle: ["active"],
      allowBackorder: false,
      allowMarketplace: false,
      maximumSnapshotAgeSeconds: 300,
      rawProviderResponse: { stock: 100 },
    };
    invalidRequests.push({ value: nestedProviderData, expectedPath: "sourcing.rawProviderResponse" });

    const constraintExtra = structuredClone(loadFixture("p1-compact")) as unknown as { constraints: Record<string, unknown> };
    constraintExtra.constraints.extra = true;
    invalidRequests.push({ value: constraintExtra, expectedPath: "constraints.extra" });

    const assumptionExtra = structuredClone(loadFixture("p1-compact")) as unknown as { assumptions: Array<Record<string, unknown>> };
    assumptionExtra.assumptions[0]!.extra = true;
    invalidRequests.push({ value: assumptionExtra, expectedPath: "assumptions.0.extra" });

    const requirementExtra = structuredClone(loadFixture("m1-compact")) as unknown as { requirements: Record<string, unknown> };
    requirementExtra.requirements.extra = true;
    invalidRequests.push({ value: requirementExtra, expectedPath: "requirements.extra" });

    const rangeExtra = structuredClone(loadFixture("m1-compact")) as unknown as {
      requirements: { supplyVoltage: Record<string, unknown> };
    };
    rangeExtra.requirements.supplyVoltage.extra = true;
    invalidRequests.push({ value: rangeExtra, expectedPath: "requirements.supplyVoltage.extra" });

    const quantityExtra = structuredClone(loadFixture("m1-compact")) as unknown as {
      requirements: { supplyVoltage: { minimum: Record<string, unknown> } };
    };
    quantityExtra.requirements.supplyVoltage.minimum.extra = true;
    invalidRequests.push({ value: quantityExtra, expectedPath: "requirements.supplyVoltage.minimum.extra" });

    const operatingPointExtra = structuredClone(loadFixture("m1-compact")) as unknown as {
      requirements: { operatingPoint: Record<string, unknown> };
    };
    operatingPointExtra.requirements.operatingPoint.extra = true;
    invalidRequests.push({ value: operatingPointExtra, expectedPath: "requirements.operatingPoint.extra" });

    const motorModelExtra = structuredClone(loadFixture("m1-compact")) as unknown as {
      requirements: { motorModel: Record<string, unknown> };
    };
    motorModelExtra.requirements.motorModel.extra = true;
    invalidRequests.push({ value: motorModelExtra, expectedPath: "requirements.motorModel.extra" });

    const switchingExtra = structuredClone(loadFixture("p1-compact")) as unknown as {
      requirements: { switchingFrequency: Record<string, unknown> };
    };
    switchingExtra.requirements.switchingFrequency.extra = true;
    invalidRequests.push({ value: switchingExtra, expectedPath: "requirements.switchingFrequency.extra" });

    const transientExtra = structuredClone(loadFixture("p1-compact")) as unknown as {
      requirements: { loadTransientTarget: Record<string, unknown> };
    };
    transientExtra.requirements.loadTransientTarget = {
      currentStep: { value: 1, unit: "A", displayUnit: "A" },
      maximumOutputDeviation: { value: 0.1, unit: "V", displayUnit: "mV" },
      maximumSettlingTime: { value: 0.001, unit: "s", displayUnit: "ms" },
      extra: true,
    };
    invalidRequests.push({ value: transientExtra, expectedPath: "requirements.loadTransientTarget.extra" });

    for (const invalid of invalidRequests) {
      expect(validateDesignRequest(invalid.value)).toContainEqual(expect.objectContaining({
        path: invalid.expectedPath,
        code: expect.stringMatching(/unknown_field|invalid_type/),
      }));
      expect(() => migrateDesignRequest(invalid.value)).toThrow();
    }
  });

  it("rejects a motor loss operating point without a valid declared basis", () => {
    const invalid = structuredClone(loadFixture("m1-compact"));
    if (invalid.application !== "motor.brushed-dc") throw new Error("Expected motor fixture");
    invalid.requirements.operatingPoint.dutyCycle.value = 1.1;
    invalid.requirements.operatingPoint.loadCurrentBasis = "continuous_rating";
    invalid.requirements.operatingPoint.loadCurrent.value = 1;
    expect(validateDesignRequest(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "requirements.operatingPoint.dutyCycle.value", code: "invalid_range" }),
      expect.objectContaining({ path: "requirements.operatingPoint.loadCurrent.value", code: "invalid_range" }),
    ]));
  });

  it("does not invent defaults while migrating", () => {
    const incomplete = structuredClone(loadFixture("p2-high-voltage")) as unknown as Record<string, unknown>;
    delete incomplete.assumptions;
    expect(() => migrateDesignRequest(incomplete)).toThrow(/assumptions/i);
    expect(() => migrateDesignRequest({ ...incomplete, format: "other-format" })).toThrow(/scheMAGIC Designer request/i);
    expect(() => migrateDesignRequest({ ...incomplete, format: "schemagic-design-request", schemaVersion: 0 })).toThrow(/version 0/i);
  });
});
