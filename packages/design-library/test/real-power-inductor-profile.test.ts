import { describe, expect, it } from "vitest";
import profileJson from "../parts/power.power-inductor/coilcraft/XAL7030-472MEC.json";
import manufacturers from "../manufacturers.json";
import {
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const profile = profileJson as DesignProfileWithFactsV2<PartClassId, object>;
const registry = manufacturers as ManufacturerRegistryV1;

describe("real XAL7030 facts-V2 authored profile", () => {
  it("preserves primary facts and geometry without promoting typical/reference currents into limits", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([
      expect.objectContaining({ path: "facts.saturationCurrent.state", code: "not_reviewed" }),
      expect.objectContaining({ path: "facts.rmsCurrent.state", code: "not_reviewed" }),
    ]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:930d1c5530b358eb0ff206b15c9e3999db75d582f9d989fa76d2a1cb8e939cf8");
    const facts = profile.facts as Record<string, any>;
    expect(facts.inductance.value).toEqual({ value: 0.0000047, unit: "H", displayUnit: "4.7 µH" });
    expect(facts.dcResistance.value).toEqual({ value: 0.03, unit: "ohm", displayUnit: "30 mΩ max" });
    expect(facts.saturationCurrent).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.rmsCurrent).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.mountedGeometry.boardArea.value.area.value).toBe(0.00003965);
    expect(facts.mountedGeometry.maximumHeight.value.height.value).toBe(0.0031);
  });
});
