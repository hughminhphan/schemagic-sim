import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";
import { calculateBoardAreaV2 } from "../src/v2-geometry";
import type { DesignProfileV3 } from "../src/v3-types";
import { designProfileContentHashV3 } from "../src/v3-validation";

const profile = profileJson as unknown as DesignProfileV3<"shared.n-channel-power-mosfet">;
const profilePath = new URL("../parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json", import.meta.url);
const schemaRoot = new URL("../schema/", import.meta.url);

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

describe("independent TI CSD18540Q5B facts-V3 evidence review", () => {
  it("satisfies the checked-in facts-V3 JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(fileURLToPath(schemaRoot))) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validate = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3.schema.json");
    expect(validate).toBeTypeOf("function");
    expect(validate?.(profile), JSON.stringify(validate?.errors)).toBe(true);
  });

  it("identifies the exact hashed TI source revision", () => {
    expect(profile).toMatchObject({
      format: "schemagic-design-profile",
      schemaVersion: "1.0.0",
      factsSchemaVersion: "3.0.0",
      partClass: "shared.n-channel-power-mosfet",
      part: {
        manufacturerId: "texas-instruments",
        manufacturerPartNumber: "CSD18540Q5B",
      },
    });
    expect(createHash("sha256").update(readFileSync(profilePath)).digest("hex"))
      .toBe("6bf881153548a22c079069174e83598f161e7ec566a70dca313367a72f4fe5a8");
    expect(designProfileContentHashV3(profile))
      .toBe("sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8");
    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0");
    expect(evidence).toContain("https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf");
    expect(evidence).toContain("10-Nov-2025");
    expect(evidence).not.toContain("addendum revised May 2025");
  });

  it("keeps the reviewed electrical values conservative and fully conditioned", () => {
    expect(profile.facts.drainSourceVoltage.value).toEqual({ value: 60, unit: "V", displayUnit: "60 V" });
    expect(profile.facts.continuousDrainCurrent).toMatchObject({
      value: { value: 29, unit: "A" },
      state: "reviewed",
      validFor: [{
        parameterId: "ambientTemperature",
        minimum: { value: 298.15, unit: "K" },
        maximum: { value: 298.15, unit: "K" },
      }],
    });
    expect(profile.facts.pulsedDrainCurrent).toMatchObject({
      value: { value: 400, unit: "A" },
      state: "reviewed",
      validFor: [
        { parameterId: "dutyCycle", minimum: null, maximum: { value: 0.01, unit: "1" } },
        { parameterId: "pulseDuration", minimum: null, maximum: { value: 0.0001, unit: "s" } },
      ],
    });
    expect(profile.facts.onResistance).toMatchObject({
      value: { value: 0.0022, unit: "ohm" },
      state: "reviewed",
      validFor: [
        { parameterId: "ambientTemperature", minimum: { value: 298.15, unit: "K" }, maximum: { value: 298.15, unit: "K" } },
        { parameterId: "drainCurrent", minimum: { value: 28, unit: "A" }, maximum: { value: 28, unit: "A" } },
        { parameterId: "gateVoltage", minimum: { value: 10, unit: "V" }, maximum: { value: 10, unit: "V" } },
      ],
    });
    expect(profile.facts.totalGateCharge).toMatchObject({
      value: { value: 5.3e-8, unit: "C" },
      state: "reviewed",
      validFor: [
        { parameterId: "gateVoltage", minimum: { value: 10, unit: "V" }, maximum: { value: 10, unit: "V" } },
        { parameterId: "testCurrent", minimum: { value: 28, unit: "A" }, maximum: { value: 28, unit: "A" } },
        { parameterId: "testVoltage", minimum: { value: 30, unit: "V" }, maximum: { value: 30, unit: "V" } },
      ],
    });
    expect(profile.facts.maximumJunctionTemperature.value).toEqual({
      value: 448.15,
      unit: "K",
      displayUnit: "175 deg C",
    });
    expect(profile.facts.junctionToAmbientThermalResistance.value).toEqual({
      value: 50,
      unit: "K/W",
      displayUnit: "50 deg C/W maximum",
    });
    expect(profile.facts.thermalBoardAssumption.value).toContain("1-in2 (6.45-cm2), 2-oz (0.071-mm) copper pad");
    for (const key of ["riseTime", "fallTime", "reverseRecoveryCharge"] as const) {
      expect(profile.facts[key]).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    }
  });

  it("uses the complete manufacturer-recommended land-pattern bounding box", () => {
    const boardArea = profile.facts.mountedGeometry.boardArea.value;
    expect(boardArea).not.toBeNull();
    if (boardArea === null) throw new Error("Reviewed mounted board area is missing");
    const xDimensions = boardArea.sourceDimensions
      .filter((dimension) => dimension.axis === "x")
      .map((dimension) => dimension.maximum.value);
    const xEvidence = boardArea.sourceDimensions
      .filter((dimension) => dimension.axis === "x")
      .flatMap((dimension) => dimension.evidence.map((evidence) => evidence.locator));
    const yDimensions = boardArea.sourceDimensions
      .filter((dimension) => dimension.axis === "y")
      .map((dimension) => dimension.maximum.value);

    // Datasheet page 9 gives 4.440 mm center-pad span, a 1.100 mm
    // horizontal gap, and 1.372 mm right-pad width: 6.912 mm overall.
    // The separate 0.710 mm callout is the vertical height of each pad.
    expect(xDimensions).toEqual([0.00444, 0.0011, 0.001372]);
    expect(xDimensions).not.toContain(0.00071);
    expect(xEvidence.some((locator) => locator.includes("1.100 mm"))).toBe(true);
    expect(xEvidence.some((locator) => locator.includes("0.710-mm callout is the vertical pad height"))).toBe(true);
    expect(xDimensions.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0.006912, 12);
    expect(yDimensions).toEqual([0.00452]);
    expect(boardArea.area.value).toBe(0.00003124224);
    expect(calculateBoardAreaV2(boardArea.sourceDimensions)).toBe(boardArea.area.value);
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.00105, unit: "m", displayUnit: "1.05 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });
  });
});
