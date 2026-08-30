import { describe, expect, it } from "vitest";
import profileJson from "../parts/power.power-inductor/murata-manufacturing/LQM18PN2R2MGHD.json";
import manufacturers from "../manufacturers.json";
import {
  calculateBoardAreaV2,
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const profile = profileJson as DesignProfileWithFactsV2<PartClassId, object>;
const registry = manufacturers as ManufacturerRegistryV1;

describe("exact Murata LQM18PN2R2MGHD facts-V2 authored profile", () => {
  it("passes the closed runtime and admission boundaries", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:28e212b3ba3490cf79cf48d3f1a4dd188c6dafdb495051cc9f84a932704a298b");
  });

  it("keeps guaranteed maxima distinct from the manufacturer's typical currents", () => {
    const facts = profile.facts as Record<string, any>;
    expect(facts.inductance.value).toEqual({ value: 0.0000022, unit: "H", displayUnit: "2.2 µH" });
    expect(facts.inductance.validFor.map((range: any) => range.parameterId)).toEqual([
      "switchingFrequency",
      "testCurrent",
    ]);
    expect(facts.inductance.validFor[0]).toMatchObject({
      minimum: { value: 1_000_000, unit: "Hz" },
      maximum: { value: 1_000_000, unit: "Hz" },
    });
    expect(facts.inductance.validFor[1]).toMatchObject({
      minimum: { value: 0.001, unit: "A" },
      maximum: { value: 0.001, unit: "A" },
    });

    expect(facts.saturationCurrent.value).toEqual({ value: 0.25, unit: "A", displayUnit: "0.25 A max" });
    expect(facts.rmsCurrent.value).toEqual({ value: 1.05, unit: "A", displayUnit: "1.05 A max" });
    expect(facts.dcResistance.value).toEqual({ value: 0.25, unit: "ohm", displayUnit: "250 mΩ max" });
    expect(facts.maximumOperatingTemperature.value).toEqual({ value: 398.15, unit: "K", displayUnit: "125 °C" });
    expect(facts.maximumOperatingTemperature.explanation).toContain("remain below 125 °C");
    expect(JSON.stringify(profile)).not.toContain('"value":0.35');
    expect(JSON.stringify(profile)).not.toContain('"value":1.15');
  });

  it("keeps optional core-loss claims explicitly unknown", () => {
    const facts = profile.facts as Record<string, any>;
    for (const key of ["coreLoss", "coreLossTestFrequency"] as const) {
      expect(facts[key]).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    }
  });

  it("uses canonical manufacturer land-pattern and package-height arithmetic", () => {
    const facts = profile.facts as Record<string, any>;
    const boardArea = facts.mountedGeometry.boardArea.value;
    expect(boardArea.sourceDimensions).toMatchObject([
      {
        axis: "x",
        dimensionId: "recommended-pattern-total-width-b",
        multiplier: 1,
        maximum: { value: 0.002, unit: "m" },
      },
      {
        axis: "y",
        dimensionId: "recommended-pattern-height-d",
        multiplier: 1,
        maximum: { value: 0.0012, unit: "m" },
      },
    ]);
    expect(calculateBoardAreaV2(boardArea.sourceDimensions)).toBe(0.0000024);
    expect(boardArea.area).toEqual({ value: 0.0000024, unit: "m2", displayUnit: "2.40 mm²" });
    expect(facts.mountedGeometry.maximumHeight.value.height).toEqual({
      value: 0.001,
      unit: "m",
      displayUnit: "1.00 mm",
    });
  });
});
