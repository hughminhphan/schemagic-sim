import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILE_CODECS,
  getDesignProfileCodec,
  parseDesignProfileFor,
  type DesignProfileCodec,
} from "../src/codec";
import {
  DESIGN_PROFILE_FACTS_CODECS_V2,
  DESIGN_PROFILE_FACTS_CODECS_V3,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  parseDesignProfileForV3,
  type DesignProfileFactsCodecV2,
  type DesignProfileForCodec,
  validateProfileAdmissionRulesV2,
} from "../src";
import { PART_CLASS_IDS, type DesignProfileV1 } from "../src/types";
import { FACTS_SCHEMA_VERSION_V2, type DesignProfileWithFactsV2, type FactsV2For } from "../src/v2-types";
import { validateDesignProfileEnvelope } from "../src/v2-validation";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedProfile } from "../src/fixtures";

function unknownCommonFact(explanation: string) {
  return { value: null, state: "unknown" as const, evidence: [], validFor: [], explanation };
}

function generalPurposeResistorV2(): DesignProfileWithFactsV2<
  "shared.general-purpose-resistor",
  FactsV2For<"shared.general-purpose-resistor">
> {
  const v1 = createSyntheticReviewedProfile("shared.general-purpose-resistor");
  const evidence = v1.facts.resistance.evidence;
  return {
    ...v1,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: v1.commonFacts.packageName,
      boardArea: unknownCommonFact("Facts-V2 mounted geometry replaces the ambiguous V1 scalar."),
      maximumHeight: unknownCommonFact("Facts-V2 mounted geometry replaces the ambiguous V1 scalar."),
    },
    facts: {
      ...v1.facts,
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions: [
              { axis: "x", dimensionId: "land-x", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "mm" }, evidence },
              { axis: "y", dimensionId: "land-y", multiplier: 1, maximum: { value: 2e-3, unit: "m", displayUnit: "mm" }, evidence },
            ],
          },
          state: "calculated",
          evidence,
          validFor: [],
          explanation: "Maximum manufacturer land-pattern rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 1e-3, unit: "m", displayUnit: "mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence,
          validFor: [],
          explanation: "Maximum package height in the documented mounting orientation.",
        },
      },
    },
  };
}

function nChannelMosfetV3() {
  const v1 = structuredClone(createSyntheticReviewedProfile("shared.n-channel-power-mosfet"));
  for (const fact of Object.values(v1.facts)) {
    fact.validFor.sort((left, right) => left.parameterId.localeCompare(right.parameterId));
  }
  return {
    ...v1,
    factsSchemaVersion: "3.0.0" as const,
    commonFacts: {
      packageName: v1.commonFacts.packageName,
      boardArea: unknownCommonFact("Facts-V3 mounted geometry replaces the ambiguous V1 scalar."),
      maximumHeight: unknownCommonFact("Facts-V3 mounted geometry replaces the ambiguous V1 scalar."),
    },
    facts: {
      ...v1.facts,
      mountedGeometry: generalPurposeResistorV2().facts.mountedGeometry,
    },
  };
}

const compileV1Codec: DesignProfileCodec<"shared.general-purpose-resistor"> =
  getDesignProfileCodecForVersion("shared.general-purpose-resistor", "1.0.0");
const compileV2Codec: DesignProfileFactsCodecV2<"shared.general-purpose-resistor"> =
  getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0");
type V1ProfileFromCodec = DesignProfileForCodec<typeof compileV1Codec>;
type V2ProfileFromCodec = DesignProfileForCodec<typeof compileV2Codec>;
const compileV1Profile: V1ProfileFromCodec = createSyntheticReviewedProfile("shared.general-purpose-resistor");
const compileV2Profile: V2ProfileFromCodec = generalPurposeResistorV2();
void compileV1Codec;
void compileV1Profile;
void compileV2Profile;

if (false) {
  // @ts-expect-error The frozen V1 parser must not accept a facts-V2 codec.
  parseDesignProfileFor(compileV2Codec, {});
  // @ts-expect-error The additive V2 parser must not accept a facts-V1 codec.
  parseDesignProfileForV2(compileV1Codec, {});
  // @ts-expect-error Version dispatch is closed to the two supported facts versions.
  getDesignProfileCodecForVersion("shared.general-purpose-resistor", "3.0.0");
}

describe("facts-V2 codec registry", () => {
  it("is a recursively frozen exact twelve-class code-owned registry", () => {
    expect(Object.keys(DESIGN_PROFILE_FACTS_CODECS_V2)).toEqual([...PART_CLASS_IDS]);
    expect(Object.keys(DESIGN_PROFILE_FACTS_CODECS_V2)).toHaveLength(12);
    expect(Object.isFrozen(DESIGN_PROFILE_FACTS_CODECS_V2)).toBe(true);
    for (const partClass of PART_CLASS_IDS) {
      const codec = DESIGN_PROFILE_FACTS_CODECS_V2[partClass];
      expect(codec.partClass).toBe(partClass);
      expect(codec.factsSchemaVersion).toBe("2.0.0");
      expect(Object.isFrozen(codec)).toBe(true);
    }
  });

  it("dispatches exact V1 and V2 codecs without changing the V1 registry", () => {
    expect(getDesignProfileCodecForVersion("shared.general-purpose-resistor", "1.0.0"))
      .toBe(getDesignProfileCodec("shared.general-purpose-resistor"));
    expect(getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0"))
      .toBe(DESIGN_PROFILE_FACTS_CODECS_V2["shared.general-purpose-resistor"]);
    expect(Object.keys(DESIGN_PROFILE_CODECS)).toEqual([...PART_CLASS_IDS]);
    expect(() => (getDesignProfileCodecForVersion as (partClass: string, version: string) => unknown)(
      "shared.general-purpose-resistor",
      "3.0.0",
    )).toThrow(/unknown_codec_version/);
  });

  it("rejects prototype-inherited names at every versioned codec boundary", () => {
    const getUncheckedV1 = getDesignProfileCodec as (partClass: string) => unknown;
    const getUncheckedVersion = getDesignProfileCodecForVersion as (partClass: string, version: string) => unknown;
    for (const inheritedName of ["__proto__", "constructor", "toString"]) {
      expect(() => getUncheckedV1(inheritedName)).toThrow(/unknown_part_class/);
      for (const version of ["1.0.0", "2.0.0", "3.0.0", "3.1.0", "3.2.0", "3.3.0", "3.4.0"]) {
        expect(() => getUncheckedVersion(inheritedName, version)).toThrow(/unknown_(?:part_class|codec_version)/);
      }
    }
  });

  it("dispatches V3 only for its two selected classes and parses exact V3 bytes", () => {
    expect(Object.keys(DESIGN_PROFILE_FACTS_CODECS_V3)).toEqual([
      "shared.n-channel-power-mosfet",
      "motor.supply-tvs-diode",
    ]);
    const codec = getDesignProfileCodecForVersion("shared.n-channel-power-mosfet", "3.0.0");
    expect(codec).toBe(DESIGN_PROFILE_FACTS_CODECS_V3["shared.n-channel-power-mosfet"]);
    const source = nChannelMosfetV3();
    const parsed = parseDesignProfileForV3(codec, source, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(() => parseDesignProfileForV3(
      getDesignProfileCodecForVersion("motor.supply-tvs-diode", "3.0.0"),
      source,
      SYNTHETIC_MANUFACTURER_REGISTRY,
    )).toThrow(/partClass.*codec_mismatch/);
  });

  it("parses detached frozen V2 profiles and rejects version or class mismatch", () => {
    const source = generalPurposeResistorV2();
    expect(validateDesignProfileEnvelope(source, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    const codec = getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0");
    const parsed = parseDesignProfileForV2(codec, source, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.facts)).toBe(true);

    const v1 = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    expect(() => parseDesignProfileForV2(codec, v1, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/codec_mismatch/);
    expect(() => parseDesignProfileForV2(
      getDesignProfileCodecForVersion("shared.switching-diode", "2.0.0"),
      source,
      SYNTHETIC_MANUFACTURER_REGISTRY,
    )).toThrow(/partClass.*codec_mismatch/);
  });

  it("validates and parses class facts through the exact V2 codec", () => {
    const source = generalPurposeResistorV2();
    const codec = getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0");
    const manufacturer = SYNTHETIC_MANUFACTURER_REGISTRY.manufacturers[0];
    expect(codec.validateFacts(source.facts, manufacturer)).toEqual([]);
    const facts = codec.parseFacts(source.facts, manufacturer);
    expect(facts).toEqual(source.facts);
    expect(facts).not.toBe(source.facts);
    expect(Object.isFrozen(facts)).toBe(true);

    const malformed = structuredClone(source.facts) as unknown as Record<string, unknown>;
    delete malformed.mountedGeometry;
    expect(codec.validateFacts(malformed, manufacturer)).toContainEqual(expect.objectContaining({
      path: "facts.mountedGeometry",
      code: "missing_key",
    }));
    expect(() => codec.parseFacts(malformed, manufacturer)).toThrow(/mountedGeometry.*missing_key/);
  });

  it("delegates admission checks to the facts-V2 admission rules", () => {
    const source = generalPurposeResistorV2();
    const codec = getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0");
    expect(codec.validateAdmission(source)).toEqual(validateProfileAdmissionRulesV2(source));
  });

  it("keeps the V1 parser's input codec and return type unchanged", () => {
    const v1: DesignProfileV1 = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    const parsed = parseDesignProfileFor(
      getDesignProfileCodec("shared.general-purpose-resistor"),
      v1,
      SYNTHETIC_MANUFACTURER_REGISTRY,
    );
    expect(parsed.factsSchemaVersion).toBe("1.0.0");
    expect(() => parseDesignProfileFor(
      getDesignProfileCodec("shared.general-purpose-resistor"),
      generalPurposeResistorV2(),
      SYNTHETIC_MANUFACTURER_REGISTRY,
    )).toThrow(/invalid_facts_version/);
  });
});
