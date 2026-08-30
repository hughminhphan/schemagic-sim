import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANONICAL_EVIDENCE_URL_PATTERN_SOURCE, PART_CLASS_IDS, PART_CLASS_SPECS, validateCodecRegistryBoundary } from "../src";

function json(path: string): any {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

describe("language-neutral schemas", () => {
  it("has one closed facts schema whose keys and units mirror each codec", () => {
    const directory = new URL("../schema/facts/", import.meta.url);
    const names = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
    expect(names.filter((name) => name.endsWith(".v1.schema.json")))
      .toEqual(PART_CLASS_IDS.map((id) => `${id}.v1.schema.json`).sort());
    expect(names.filter((name) => name.endsWith(".v2.schema.json")))
      .toEqual(PART_CLASS_IDS.map((id) => `${id}.v2.schema.json`).sort());
    for (const partClass of PART_CLASS_IDS) {
      const schema = json(`../schema/facts/${partClass}.v1.schema.json`);
      const specs = PART_CLASS_SPECS[partClass].facts;
      expect(schema.additionalProperties, partClass).toBe(false);
      expect(schema.required.sort(), partClass).toEqual(Object.keys(specs).sort());
      expect(Object.keys(schema.properties).sort(), partClass).toEqual(Object.keys(specs).sort());
      for (const [factId, spec] of Object.entries(specs)) {
        const value = schema.properties[factId].allOf[1].properties.value.anyOf[0];
        if (spec.kind === "quantity") {
          expect(value.properties.unit.const, `${partClass}.${factId}`).toBe(spec.unit);
          expect(value.properties.value, `${partClass}.${factId}`).toMatchObject(spec.domain);
        } else if (spec.kind === "text" && spec.values !== undefined) expect(value.enum, `${partClass}.${factId}`).toEqual(spec.values);
        expect(schema.properties[factId].allOf[1].properties.validFor.items.$ref, `${partClass}.${factId}`).toBe("#/$defs/operatingRange");
        const ranges = schema.$defs.operatingRange.oneOf;
        expect(ranges.map((branch: any) => branch.allOf[1].properties.parameterId.const).sort(), `${partClass}.${factId}`)
          .toEqual(Object.keys(PART_CLASS_SPECS[partClass].operatingRanges).sort());
      }
    }
    expect(validateCodecRegistryBoundary()).toEqual([]);
    for (const partClass of PART_CLASS_IDS) {
      const schema = json(`../schema/facts/${partClass}.v2.schema.json`);
      expect(schema.additionalProperties, `${partClass}.v2`).toBe(false);
      expect(schema.required, `${partClass}.v2`).toContain("mountedGeometry");
      expect(schema.properties.mountedGeometry.$ref, `${partClass}.v2`)
        .toBe("https://schemas.schemagic.design/design-library/v1/profile-envelope.facts-v2.schema.json#/$defs/mountedGeometry");
    }
  });

  it("closes every persisted root and declares only the approved profile units", () => {
    for (const name of ["profile-envelope.v1.schema.json", "manufacturer-registry.v1.schema.json", "admission.v1.schema.json", "catalog-release.v1.schema.json"]) {
      expect(json(`../schema/${name}`).additionalProperties, name).toBe(false);
    }
    const profile = json("../schema/profile-envelope.v1.schema.json");
    expect(profile.$defs.profileUnit.enum.sort()).toEqual(["1", "1/K", "A", "C", "F", "H", "Hz", "J", "K", "K/W", "V", "V_s_per_rad", "W", "count", "m", "m2", "ohm", "rad_per_s", "s"].sort());
    expect(profile.$defs.evidence.oneOf[0].properties.url).toEqual({
      type: "string",
      pattern: CANONICAL_EVIDENCE_URL_PATTERN_SOURCE,
    });
    const closedProfile = json("../schema/profile.v1.schema.json");
    expect(closedProfile.allOf[1].oneOf.map((branch: any) => branch.properties.partClass.const))
      .toEqual(PART_CLASS_IDS);
    expect(closedProfile.allOf[1].oneOf.every((branch: any) => branch.properties.facts.$ref.endsWith(".v1.schema.json"))).toBe(true);
    const factsV2Envelope = json("../schema/profile-envelope.facts-v2.schema.json");
    expect(factsV2Envelope.additionalProperties).toBe(false);
    expect(factsV2Envelope.properties.schemaVersion).toEqual({ const: "1.0.0" });
    expect(factsV2Envelope.properties.factsSchemaVersion).toEqual({ const: "2.0.0" });
    const factsV2Profile = json("../schema/profile.facts-v2.schema.json");
    expect(factsV2Profile.allOf[1].oneOf.map((branch: any) => branch.properties.partClass.const)).toEqual(PART_CLASS_IDS);
    expect(factsV2Profile.allOf[1].oneOf.every((branch: any) => branch.properties.facts.$ref.endsWith(".v2.schema.json"))).toBe(true);
  });
});
