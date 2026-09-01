import { describe, expect, it } from "vitest";
import {
  FACTS_SCHEMA_VERSION_V34,
  admissionContentHash,
  canonicalDesignProfileEnvelope,
  contentHash,
  designProfileEnvelopeContentHash,
  getDesignProfileCodecForVersion,
  reviewedAdmissionProjection,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV34,
  type ManufacturerRegistryV1,
} from "@opencircuit/design-library";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "@opencircuit/design-library/fixtures";
import {
  buildReviewedProfileCatalogV2,
  calculateReviewedProfileCatalogV2ContentHash,
  getReviewedProfilesForV2,
  parseReviewedProfileCatalogV2,
} from "../src";

function unknown(explanation: string) {
  return { value: null, state: "unknown" as const, evidence: [], validFor: [], explanation };
}

function voltageOnlyProfile(): DesignProfileV34 {
  const v1 = structuredClone(createSyntheticReviewedProfile("power.power-inductor"));
  const evidence = structuredClone(v1.commonFacts.packageName.evidence);
  const current = v1.facts.inductance.validFor.find((range) => range.parameterId === "testCurrent")!;
  v1.facts.inductance.validFor = v1.facts.inductance.validFor
    .filter((range) => range.parameterId !== "testCurrent")
    .concat({
      ...current,
      parameterId: "testVoltage",
      minimum: { value: 0.5, unit: "V", displayUnit: "0.5 V" },
      maximum: { value: 0.5, unit: "V", displayUnit: "0.5 V" },
    } as never);
  return {
    ...v1,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    commonFacts: {
      packageName: v1.commonFacts.packageName,
      boardArea: unknown("Facts 3.4.0 carries mounted board area inside class facts."),
      maximumHeight: unknown("Facts 3.4.0 carries mounted maximum height inside class facts."),
    },
    facts: {
      ...v1.facts,
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 2e-6, unit: "m2", displayUnit: "2 mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions: [
              { axis: "x", dimensionId: "land-x", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "1 mm" }, evidence: structuredClone(evidence) },
              { axis: "y", dimensionId: "land-y", multiplier: 1, maximum: { value: 2e-3, unit: "m", displayUnit: "2 mm" }, evidence: structuredClone(evidence) },
            ],
          },
          state: "calculated",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Synthetic manufacturer land-pattern rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 1e-3, unit: "m", displayUnit: "1 mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Synthetic reviewed maximum mounted height.",
        },
      },
    },
  } as unknown as DesignProfileV34;
}

function documents(): DesignLibraryDocuments {
  const result = structuredClone(createSyntheticReviewedLibraryFixture(["power.power-inductor"])) as DesignLibraryDocuments;
  const profile = voltageOnlyProfile();
  const registry = result.manufacturerRegistry as ManufacturerRegistryV1;
  const admission = result.admission as DesignProfileAdmissionLedgerV1;
  const release = result.catalogRelease as DesignCatalogReleaseV1;
  const path = admission.entries[0]!.profilePath;
  const hash = designProfileEnvelopeContentHash(profile);
  (result.profiles as Record<string, unknown>)[path] = profile;
  admission.entries[0]!.profileContentHash = hash;
  release.admissionContentHash = admissionContentHash(admission);
  release.profiles[0]!.profileContentHash = hash;
  release.contentHash = contentHash({
    manufacturerRegistry: registry,
    admission: reviewedAdmissionProjection(admission),
    profiles: [canonicalDesignProfileEnvelope(profile)],
  });
  return result;
}

describe("facts 3.4.0 reviewed-profile catalog dispatch", () => {
  it("parses and selects only the exact power-inductor 3.4.0 tuple", () => {
    const catalog = buildReviewedProfileCatalogV2(documents());
    expect(parseReviewedProfileCatalogV2(catalog)).toEqual(catalog);
    const codec = getDesignProfileCodecForVersion("power.power-inductor", FACTS_SCHEMA_VERSION_V34);
    const profiles: readonly DesignProfileV34<"power.power-inductor">[] = getReviewedProfilesForV2(catalog, codec);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.facts.inductance.validFor.map((range) => range.parameterId)).toContain("testVoltage");
    expect(Object.isFrozen(profiles)).toBe(true);
    expect(Object.isFrozen(profiles[0]!.facts)).toBe(true);
    expect(() => getReviewedProfilesForV2(catalog, { ...codec, partClass: "shared.general-purpose-resistor" } as never)).toThrow(/unknown_codec_version/);
  });

  it("rejects a self-rehashed wrong-class 3.4.0 tuple", () => {
    const catalog = buildReviewedProfileCatalogV2(documents());
    const { contentHash: _contentHash, ...payload } = structuredClone(catalog);
    (payload.profiles[0] as { partClass: string }).partClass = "shared.general-purpose-resistor";
    expect(() => parseReviewedProfileCatalogV2({
      ...payload,
      contentHash: calculateReviewedProfileCatalogV2ContentHash(payload),
    })).toThrow();
    expect(SYNTHETIC_MANUFACTURER_REGISTRY.manufacturers).toHaveLength(1);
  });
});
