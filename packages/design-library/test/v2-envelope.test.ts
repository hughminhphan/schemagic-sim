import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION_V2,
  designProfileEnvelopeContentHash,
  parseDesignProfileEnvelope,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type FactsV2For,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedProfile } from "../src/fixtures";

function switchingDiodeV2(): DesignProfileWithFactsV2<"shared.switching-diode", FactsV2For<"shared.switching-diode">> {
  const v1 = createSyntheticReviewedProfile("shared.switching-diode");
  const geometryEvidence = structuredClone(v1.commonFacts.packageName.evidence);
  const sourceDimensions = [
    {
      axis: "x" as const,
      dimensionId: "land-length",
      multiplier: 1,
      maximum: { value: 0.001, unit: "m" as const, displayUnit: "mm" },
      evidence: structuredClone(geometryEvidence),
    },
    {
      axis: "y" as const,
      dimensionId: "land-width",
      multiplier: 1,
      maximum: { value: 0.002, unit: "m" as const, displayUnit: "mm" },
      evidence: structuredClone(geometryEvidence),
    },
  ];
  const unknownGeometry = (label: string) => ({
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation: `${label} is represented only by facts.mountedGeometry in facts schema 2.0.0.`,
  });
  return {
    ...structuredClone(v1),
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      ...structuredClone(v1.commonFacts),
      boardArea: unknownGeometry("Board area"),
      maximumHeight: unknownGeometry("Maximum height"),
    },
    facts: {
      ...structuredClone(v1.facts),
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 0.000002, unit: "m2", displayUnit: "mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions,
          },
          state: "calculated",
          evidence: structuredClone(geometryEvidence),
          validFor: [],
          explanation: "Canonical reviewed land-pattern bounding rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 0.0005, unit: "m", displayUnit: "mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence: structuredClone(geometryEvidence),
          validFor: [],
          explanation: "Reviewed maximum mounted package height.",
        },
      },
    },
  };
}

describe("facts-V2 profile envelope dispatch", () => {
  it("strictly parses, freezes, hashes, and admits a complete non-Power envelope", () => {
    const profile = switchingDiodeV2();
    expect(validateDesignProfileEnvelope(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    const parsed = parseDesignProfileEnvelope(profile, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed.factsSchemaVersion).toBe("2.0.0");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileEnvelopeContentHash(parsed)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(validateProfileAdmissionRulesV2(parsed as typeof profile)).toEqual([]);
  });

  it("rejects unknown tuple versions, unknown keys, accessors, and tampered geometry", () => {
    const profile = switchingDiodeV2();
    expect(validateDesignProfileEnvelope({ ...profile, factsSchemaVersion: "2.0.1" }, SYNTHETIC_MANUFACTURER_REGISTRY)[0]).toMatchObject({ path: "factsSchemaVersion", code: "invalid_facts_version" });
    expect(validateDesignProfileEnvelope({ ...profile, apiKey: "SECRET" }, SYNTHETIC_MANUFACTURER_REGISTRY).some((entry) => entry.code === "unknown_key")).toBe(true);
    const accessor = { ...profile } as Record<string, unknown>;
    Object.defineProperty(accessor, "facts", { enumerable: true, get: () => profile.facts });
    expect(validateDesignProfileEnvelope(accessor, SYNTHETIC_MANUFACTURER_REGISTRY)[0]).toMatchObject({ code: "invalid_data_boundary" });
    const tampered = structuredClone(profile);
    tampered.facts.mountedGeometry.boardArea.value!.area.value = 1e-6;
    expect(validateDesignProfileEnvelope(tampered, SYNTHETIC_MANUFACTURER_REGISTRY).some((entry) => entry.code === "invalid_mounted_geometry")).toBe(true);
  });

  it("keeps exact manufacturer-part-number bytes at the profile join", () => {
    const profile = switchingDiodeV2();
    profile.part.manufacturerPartNumber = "EXACT\u0000/\u202eMPN";
    const parsed = parseDesignProfileEnvelope(profile, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed.part.manufacturerPartNumber).toBe("EXACT\u0000/\u202eMPN");
  });
});
