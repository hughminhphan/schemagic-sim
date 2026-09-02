import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { createSyntheticReviewedProfile } from "../src/fixtures";

const schemaRoot = new URL("../schema/", import.meta.url);
const v3ProfileId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3.schema.json";

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function json(relative: string): any {
  return JSON.parse(readFileSync(new URL(`../schema/${relative}`, import.meta.url), "utf8"));
}

function validator(): { ajv: Ajv2020; validate: ValidateFunction } {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const path of schemaFiles(schemaRoot.pathname)) {
    ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
  }
  const validate = ajv.getSchema(v3ProfileId);
  if (validate === undefined) throw new Error(`Missing AJV schema ${v3ProfileId}`);
  return { ajv, validate };
}

function unknownGeometry(label: string): any {
  return {
    value: null,
    state: "unknown",
    evidence: [],
    validFor: [],
    explanation: `${label} is represented only by facts.mountedGeometry in facts schema 3.0.0.`,
  };
}

function condition(parameterId: string, unit: string, value: number, evidence: readonly unknown[]): any {
  const exact = { value, unit, displayUnit: unit };
  return {
    parameterId,
    minimum: structuredClone(exact),
    maximum: structuredClone(exact),
    evidence: structuredClone(evidence),
  };
}

function mountedGeometry(evidence: readonly unknown[]): any {
  return {
    boardArea: {
      value: {
        area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          {
            axis: "x",
            dimensionId: "land-length",
            multiplier: 1,
            maximum: { value: 1e-3, unit: "m", displayUnit: "mm" },
            evidence: structuredClone(evidence),
          },
          {
            axis: "y",
            dimensionId: "land-width",
            multiplier: 1,
            maximum: { value: 2e-3, unit: "m", displayUnit: "mm" },
            evidence: structuredClone(evidence),
          },
        ],
      },
      state: "calculated",
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Canonical reviewed land-pattern bounding rectangle.",
    },
    maximumHeight: {
      value: {
        height: { value: 5e-4, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      state: "reviewed",
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Reviewed maximum package height in its mounting orientation.",
    },
  };
}

function v3Mosfet(): any {
  const profile: any = structuredClone(createSyntheticReviewedProfile("shared.n-channel-power-mosfet"));
  const evidence = profile.commonFacts.packageName.evidence;
  profile.factsSchemaVersion = "3.0.0";
  profile.commonFacts.boardArea = unknownGeometry("Board area");
  profile.commonFacts.maximumHeight = unknownGeometry("Maximum height");
  profile.facts.mountedGeometry = mountedGeometry(evidence);
  return profile;
}

function v3Tvs(): any {
  const profile: any = structuredClone(createSyntheticReviewedProfile("motor.supply-tvs-diode"));
  const evidence = profile.commonFacts.packageName.evidence;
  profile.factsSchemaVersion = "3.0.0";
  profile.commonFacts.boardArea = unknownGeometry("Board area");
  profile.commonFacts.maximumHeight = unknownGeometry("Maximum height");
  profile.facts.clampingBehavior = {
    value: "avalanche",
    state: "reviewed",
    evidence: structuredClone(evidence),
    validFor: [],
    explanation: "Synthetic avalanche behavior used only to exercise the V3 contract.",
  };
  profile.facts.clampingVoltage.validFor.push(condition("ambientTemperature", "K", 298.15, evidence));
  profile.facts.pulseCurrent.validFor.push(condition("testCurrent", "A", 10, evidence));
  profile.facts.pulseCurrent.validFor.push(condition("ambientTemperature", "K", 298.15, evidence));
  profile.facts.mountedGeometry = mountedGeometry(evidence);
  return profile;
}

function expectValid(validate: ValidateFunction, profile: unknown): void {
  expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
}

function expectInvalid(validate: ValidateFunction, profile: unknown): void {
  expect(validate(profile), "adversarial profile unexpectedly passed").toBe(false);
}

describe("selected facts-V3 JSON schemas", () => {
  it("loads every checked-in schema and exposes only the two selected V3 class schemas", () => {
    const { ajv, validate } = validator();
    const schemas = schemaFiles(schemaRoot.pathname).map((path) => JSON.parse(readFileSync(path, "utf8")));
    for (const schema of schemas) expect(ajv.getSchema(schema.$id), schema.$id).toBeTypeOf("function");
    expect(validate).toBeTypeOf("function");

    const v3ClassSchemas = readdirSync(new URL("../schema/facts/", import.meta.url))
      .filter((name) => name.endsWith(".v3.schema.json"))
      .sort();
    expect(v3ClassSchemas).toEqual([
      "motor.supply-tvs-diode.v3.schema.json",
      "shared.n-channel-power-mosfet.v3.schema.json",
    ]);

    const root = json("profile.facts-v3.schema.json");
    expect(root.allOf[1].oneOf.map((branch: any) => branch.properties.partClass.const)).toEqual([
      "shared.n-channel-power-mosfet",
      "motor.supply-tvs-diode",
    ]);

    const unsupported: any = structuredClone(createSyntheticReviewedProfile("shared.switching-diode"));
    unsupported.factsSchemaVersion = "3.0.0";
    expectInvalid(validate, unsupported);
  });

  it("preserves both frozen facts-V2 root byte hashes and its mounted-geometry shape", () => {
    const expected = {
      "profile-envelope.facts-v2.schema.json": "d5d577bc81da5fe9904a7454845889a6dbc6902dcb2df0d51f8f8d26e058eaa4",
      "profile.facts-v2.schema.json": "374f075a13dc5ad4f3fef0a8191706779fb11d6b01c06a4c720151612c3d604e",
    } as const;
    for (const [relative, hash] of Object.entries(expected)) {
      const bytes = readFileSync(new URL(`../schema/${relative}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), relative).toBe(hash);
    }
    expect(json("profile-envelope.facts-v3.schema.json").$defs.mountedGeometry)
      .toEqual(json("profile-envelope.facts-v2.schema.json").$defs.mountedGeometry);
  });

  it("requires the MOSFET V3 condition contract without inventing a temperature basis", () => {
    const { validate } = validator();
    const valid = v3Mosfet();
    expectValid(validate, valid);

    for (const temperatureId of ["ambientTemperature", "caseTemperature", "junctionTemperature"]) {
      const alternative = structuredClone(valid);
      const fact = alternative.facts.onResistance;
      fact.validFor = fact.validFor.filter((entry: any) => !["ambientTemperature", "caseTemperature", "junctionTemperature"].includes(entry.parameterId));
      fact.validFor.push(condition(temperatureId, "K", 298.15, fact.evidence));
      expectValid(validate, alternative);
    }

    const noTemperature = structuredClone(valid);
    noTemperature.facts.onResistance.validFor = noTemperature.facts.onResistance.validFor
      .filter((entry: any) => entry.parameterId !== "junctionTemperature");
    expectInvalid(validate, noTemperature);

    const twoTemperatures = structuredClone(valid);
    twoTemperatures.facts.onResistance.validFor.push(condition(
      "caseTemperature",
      "K",
      298.15,
      twoTemperatures.facts.onResistance.evidence,
    ));
    expectInvalid(validate, twoTemperatures);

    const missingDrainCurrent = structuredClone(valid);
    missingDrainCurrent.facts.onResistance.validFor = missingDrainCurrent.facts.onResistance.validFor
      .filter((entry: any) => entry.parameterId !== "drainCurrent");
    expectInvalid(validate, missingDrainCurrent);

    const duplicateGateVoltage = structuredClone(valid);
    const gate = duplicateGateVoltage.facts.onResistance.validFor
      .find((entry: any) => entry.parameterId === "gateVoltage");
    duplicateGateVoltage.facts.onResistance.validFor.push(structuredClone(gate));
    expectInvalid(validate, duplicateGateVoltage);

    const missingDutyCycle = structuredClone(valid);
    missingDutyCycle.facts.pulsedDrainCurrent.validFor = missingDutyCycle.facts.pulsedDrainCurrent.validFor
      .filter((entry: any) => entry.parameterId !== "dutyCycle");
    expectInvalid(validate, missingDutyCycle);
  });

  it("closes TVS behavior, conditioned pulse claims, and explicit unknown energy", () => {
    const { validate } = validator();
    const avalanche = v3Tvs();
    expectValid(validate, avalanche);

    const snapback = structuredClone(avalanche);
    snapback.facts.clampingBehavior.value = "snapback";
    snapback.facts.breakdownVoltageMaximum.value.value = 8;
    snapback.facts.clampingVoltage.value.value = 6;
    expectValid(validate, snapback);

    const unknownEnergy = structuredClone(avalanche);
    unknownEnergy.facts.pulseEnergy = {
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
      explanation: "The manufacturer publishes no pulse-energy rating; no value is inferred.",
    };
    expectValid(validate, unknownEnergy);

    const invalidBehavior = structuredClone(avalanche);
    invalidBehavior.facts.clampingBehavior.value = "foldback";
    expectInvalid(validate, invalidBehavior);

    for (const parameterId of ["testCurrent", "pulseDuration", "ambientTemperature"]) {
      const missing = structuredClone(avalanche);
      missing.facts.clampingVoltage.validFor = missing.facts.clampingVoltage.validFor
        .filter((entry: any) => entry.parameterId !== parameterId);
      expectInvalid(validate, missing);
    }

    const duplicateCurrent = structuredClone(avalanche);
    const testCurrent = duplicateCurrent.facts.clampingVoltage.validFor
      .find((entry: any) => entry.parameterId === "testCurrent");
    duplicateCurrent.facts.clampingVoltage.validFor.push(structuredClone(testCurrent));
    expectInvalid(validate, duplicateCurrent);

    for (const parameterId of ["testCurrent", "pulseDuration", "ambientTemperature"]) {
      const missing = structuredClone(avalanche);
      missing.facts.pulseCurrent.validFor = missing.facts.pulseCurrent.validFor
        .filter((entry: any) => entry.parameterId !== parameterId);
      expectInvalid(validate, missing);
    }

    const estimatedEnergy = structuredClone(avalanche);
    estimatedEnergy.facts.pulseEnergy.state = "estimated";
    expectInvalid(validate, estimatedEnergy);

    const unknownWithValue = structuredClone(unknownEnergy);
    unknownWithValue.facts.pulseEnergy.value = { value: 1, unit: "J", displayUnit: "J" };
    expectInvalid(validate, unknownWithValue);
  });
});
