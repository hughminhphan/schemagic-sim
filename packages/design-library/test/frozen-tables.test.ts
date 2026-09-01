import { describe, expect, it } from "vitest";
import {
  COMMON_ADMISSION_CHECK_IDS,
  COMMERCIAL_BOUNDARY_VOCABULARY,
  DESIGN_PROFILE_CODECS,
  EVIDENCE_TRUST_RULES,
  PART_CLASS_IDS,
  PART_CLASS_SPECS,
  TRUSTED_INDEPENDENT_EVIDENCE_HOSTS,
  requiredAdmissionCheckIds,
  validateDesignProfile,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedProfile } from "../src/fixtures";

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectRecursivelyFrozen(nested);
}

describe("immutable code-owned contract tables", () => {
  it("deep-freezes IDs, specs, checks, codecs, and trust rules", () => {
    for (const table of [PART_CLASS_IDS, PART_CLASS_SPECS, COMMON_ADMISSION_CHECK_IDS, DESIGN_PROFILE_CODECS, EVIDENCE_TRUST_RULES, TRUSTED_INDEPENDENT_EVIDENCE_HOSTS, COMMERCIAL_BOUNDARY_VOCABULARY]) expectRecursivelyFrozen(table);
    const checks = requiredAdmissionCheckIds("shared.general-purpose-resistor");
    expectRecursivelyFrozen(checks);

    expect(() => (PART_CLASS_IDS as unknown as string[]).push("shared.attacker-device")).toThrow(TypeError);
    expect(() => ((PART_CLASS_SPECS["shared.general-purpose-resistor"].facts.resistance as any).unit = "A")).toThrow(TypeError);
    expect(() => (checks as string[]).splice(0, 1)).toThrow(TypeError);
    expect(() => ((EVIDENCE_TRUST_RULES.independent_measurement.publicationBases as unknown as string[]).push("public_facts"))).toThrow(TypeError);
    expect(() => (COMMERCIAL_BOUNDARY_VOCABULARY as unknown as unknown[]).pop()).toThrow(TypeError);

    expect(validateDesignProfile(createSyntheticReviewedProfile("shared.general-purpose-resistor"), SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
  });
});
