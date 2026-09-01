import { describe, expect, it } from "vitest";
import { contentHash } from "../src/canonical";
import { createSyntheticReviewedProfile, SYNTHETIC_MANUFACTURER_REGISTRY } from "../src/fixtures";
import type {
  OperatingRange,
  PartClassId,
  ProfileEvidenceRef,
  ProfileFact,
  ProfileQuantity,
  ProfileUnit,
} from "../src/types";
import type { MountedGeometryFactsV2 } from "../src/v2-types";
import { V3_PART_CLASS_SPECS } from "../src/v3-specs";
import {
  FACTS_SCHEMA_VERSION_V3,
  type DesignProfileV3,
} from "../src/v3-types";
import {
  designProfileContentHashV3,
  parseDesignProfileV3,
  validateDesignProfileV3,
  validateProfileAdmissionRulesV3,
  validateProfileSemanticsV3,
} from "../src/v3-validation";

type MutableFact = ProfileFact<unknown>;

function quantity<Unit extends ProfileUnit>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function range(
  parameterId: string,
  unit: ProfileUnit,
  evidence: ProfileEvidenceRef[],
  value = unit === "K" ? 298.15 : 1,
): OperatingRange {
  return {
    parameterId,
    minimum: quantity(value, unit),
    maximum: quantity(value, unit),
    evidence: structuredClone(evidence),
  };
}

function primaryEvidence(sourceId = "schemagic.synthetic.v3-shared-source"): ProfileEvidenceRef[] {
  return [{
    kind: "manufacturer_datasheet",
    sourceId,
    locator: "Synthetic V3 semantic fixture, table 1",
    licenseNote: "Synthetic fixture carrying no real component claim.",
    retrievedAt: "2026-08-24T00:00:00Z",
    contentHash: contentHash({ sourceId }),
    url: "https://synthetic-components.example.invalid/v3-fixture.pdf",
    revision: "fixture-v3",
    publicationBasis: "public_facts",
  }];
}

function unknownGeometry(label: string): ProfileFact<ProfileQuantity<"m2"> | ProfileQuantity<"m">> {
  return {
    value: null,
    state: "unknown",
    evidence: [],
    validFor: [],
    explanation: `${label} is represented by facts.mountedGeometry in facts schema 3.0.0.`,
  };
}

function mountedGeometry(evidence: ProfileEvidenceRef[]): MountedGeometryFactsV2["mountedGeometry"] {
  const sourceDimensions = [
    {
      axis: "x" as const,
      dimensionId: "land-length",
      multiplier: 1,
      maximum: quantity(1e-3, "m"),
      evidence: structuredClone(evidence),
    },
    {
      axis: "y" as const,
      dimensionId: "land-width",
      multiplier: 1,
      maximum: quantity(2e-3, "m"),
      evidence: structuredClone(evidence),
    },
  ];
  return {
    boardArea: {
      value: {
        area: quantity(2e-6, "m2"),
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions,
      },
      state: "calculated",
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Canonical maximum land-pattern bounding rectangle.",
    },
    maximumHeight: {
      value: {
        height: quantity(1e-3, "m"),
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      state: "reviewed",
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Reviewed maximum mounted height.",
    },
  };
}

function conditionUnit(partClass: PartClassId, parameterId: string): ProfileUnit {
  const spec = V3_PART_CLASS_SPECS[partClass as keyof typeof V3_PART_CLASS_SPECS];
  return spec.operatingRanges[parameterId as keyof typeof spec.operatingRanges]!.unit;
}

function normalizeConditionOrder(partClass: PartClassId, facts: Record<string, MutableFact>): void {
  for (const fact of Object.values(facts)) {
    fact.validFor.sort((left, right) => left.parameterId < right.parameterId ? -1 : left.parameterId > right.parameterId ? 1 : 0);
    for (const condition of fact.validFor) {
      const unit = conditionUnit(partClass, condition.parameterId);
      condition.minimum = quantity(unit === "K" ? 298.15 : 1, unit);
      condition.maximum = quantity(unit === "K" ? 298.15 : 1, unit);
    }
  }
}

function mosfetProfile(temperature: "ambientTemperature" | "caseTemperature" | "junctionTemperature" = "ambientTemperature"): DesignProfileV3<"shared.n-channel-power-mosfet"> {
  const v1 = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
  const geometryEvidence = structuredClone(v1.commonFacts.packageName.evidence);
  const facts = structuredClone(v1.facts) as Record<string, MutableFact>;
  normalizeConditionOrder(v1.partClass, facts);
  facts.onResistance!.validFor = [
    range(temperature, "K", facts.onResistance!.evidence),
    range("drainCurrent", "A", facts.onResistance!.evidence),
    range("gateVoltage", "V", facts.onResistance!.evidence),
  ].sort((left, right) => left.parameterId < right.parameterId ? -1 : 1);
  facts.pulsedDrainCurrent!.validFor = [
    range("dutyCycle", "1", facts.pulsedDrainCurrent!.evidence, 0.1),
    range("pulseDuration", "s", facts.pulsedDrainCurrent!.evidence, 1e-3),
  ];
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknownGeometry("Board area") as typeof v1.commonFacts.boardArea,
      maximumHeight: unknownGeometry("Maximum height") as typeof v1.commonFacts.maximumHeight,
    },
    facts: {
      ...facts,
      mountedGeometry: mountedGeometry(geometryEvidence),
    },
  } as unknown as DesignProfileV3<"shared.n-channel-power-mosfet">;
}

function tvsProfile(behavior: "avalanche" | "snapback" = "avalanche"): DesignProfileV3<"motor.supply-tvs-diode"> {
  const v1 = createSyntheticReviewedProfile("motor.supply-tvs-diode");
  const geometryEvidence = structuredClone(v1.commonFacts.packageName.evidence);
  const facts = structuredClone(v1.facts) as Record<string, MutableFact>;
  normalizeConditionOrder(v1.partClass, facts);
  const shared = primaryEvidence();
  const matched = [
    range("ambientTemperature", "K", shared),
    range("pulseDuration", "s", shared, 1e-3),
    range("testCurrent", "A", shared, 10),
  ];
  facts.clampingVoltage!.evidence = structuredClone(shared);
  facts.clampingVoltage!.validFor = structuredClone(matched);
  facts.pulseCurrent!.evidence = structuredClone(shared);
  facts.pulseCurrent!.validFor = structuredClone(matched);
  facts.pulseWaveform!.evidence = structuredClone(shared);
  facts.pulseWaveform!.validFor = [];
  facts.pulseEnergy!.validFor = [range("pulseDuration", "s", facts.pulseEnergy!.evidence, 1e-3)];
  const clampingBehavior: ProfileFact<"avalanche" | "snapback"> = {
    value: behavior,
    state: "reviewed",
    evidence: structuredClone(shared),
    validFor: [],
    explanation: "Reviewed clamping topology behavior.",
  };
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknownGeometry("Board area") as typeof v1.commonFacts.boardArea,
      maximumHeight: unknownGeometry("Maximum height") as typeof v1.commonFacts.maximumHeight,
    },
    facts: {
      standOffVoltage: facts.standOffVoltage,
      breakdownVoltageMinimum: facts.breakdownVoltageMinimum,
      breakdownVoltageMaximum: facts.breakdownVoltageMaximum,
      clampingBehavior,
      clampingVoltage: facts.clampingVoltage,
      pulseCurrent: facts.pulseCurrent,
      pulseWaveform: facts.pulseWaveform,
      pulseEnergy: facts.pulseEnergy,
      mountedGeometry: mountedGeometry(geometryEvidence),
    },
  } as DesignProfileV3<"motor.supply-tvs-diode">;
}

function issueCodes(profile: DesignProfileV3): string[] {
  return validateDesignProfileV3(profile, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code);
}

describe("facts-V3 selected-class contract", () => {
  it("accepts every single MOSFET temperature qualifier and preserves the 1.0.0 outer envelope", () => {
    for (const temperature of ["ambientTemperature", "caseTemperature", "junctionTemperature"] as const) {
      const profile = mosfetProfile(temperature);
      expect(validateDesignProfileV3(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
      expect(validateProfileAdmissionRulesV3(profile)).toEqual([]);
      const parsed = parseDesignProfileV3(profile, SYNTHETIC_MANUFACTURER_REGISTRY);
      expect(parsed.schemaVersion).toBe("1.0.0");
      expect(parsed.factsSchemaVersion).toBe("3.0.0");
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(designProfileContentHashV3(parsed)).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("rejects multiple/missing MOSFET temperature qualifiers and noncanonical pulse conditions", () => {
    const multiple = mosfetProfile();
    multiple.facts.onResistance.validFor.push(range("junctionTemperature", "K", multiple.facts.onResistance.evidence));
    multiple.facts.onResistance.validFor.sort((left, right) => left.parameterId < right.parameterId ? -1 : 1);
    expect(issueCodes(multiple)).toContain("invalid_on_resistance_conditions");

    const missing = mosfetProfile();
    missing.facts.onResistance.validFor = missing.facts.onResistance.validFor.filter((entry) => entry.parameterId !== "drainCurrent");
    expect(issueCodes(missing)).toContain("invalid_on_resistance_conditions");

    const reordered = mosfetProfile();
    reordered.facts.pulsedDrainCurrent.validFor.reverse();
    expect(issueCodes(reordered)).toEqual(expect.arrayContaining(["unstable_condition_order", "condition_set_mismatch"]));
  });

  it("admits source-backed avalanche and snapback TVS profiles, including explicit unknown energy", () => {
    const avalanche = tvsProfile("avalanche");
    expect(validateDesignProfileV3(avalanche, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV3(avalanche)).toEqual([]);

    const snapback = tvsProfile("snapback");
    snapback.facts.clampingVoltage.value!.value = 3.5;
    expect(validateDesignProfileV3(snapback, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);

    const unknownEnergy = tvsProfile();
    Object.assign(unknownEnergy.facts.pulseEnergy, {
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
      explanation: "The primary source does not publish pulse energy.",
    });
    expect(validateDesignProfileV3(unknownEnergy, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV3(unknownEnergy)).toEqual([]);
  });

  it("matches TVS clamp and pulse conditions byte-for-byte and in canonical order", () => {
    const mismatch = tvsProfile();
    mismatch.facts.pulseCurrent.validFor[0]!.maximum!.value += 1;
    expect(issueCodes(mismatch)).toContain("condition_group_mismatch");

    const reordered = tvsProfile();
    reordered.facts.clampingVoltage.validFor.reverse();
    const first = validateDesignProfileV3(reordered, SYNTHETIC_MANUFACTURER_REGISTRY);
    const second = validateDesignProfileV3(reordered, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(first).toEqual(second);
    expect(first.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "unstable_condition_order",
      "condition_set_mismatch",
      "condition_group_mismatch",
    ]));
  });

  it("requires one shared primary source hash across TVS clamp, pulse, and waveform", () => {
    const profile = tvsProfile();
    profile.facts.pulseWaveform.evidence = primaryEvidence("schemagic.synthetic.other-source");
    expect(issueCodes(profile)).toContain("missing_shared_primary_source");
  });

  it("applies breakdown-to-clamp ordering only to avalanche behavior", () => {
    const avalanche = tvsProfile("avalanche");
    avalanche.facts.clampingVoltage.value!.value = 3.5;
    expect(issueCodes(avalanche)).toContain("inconsistent_fact_order");

    const snapback = tvsProfile("snapback");
    snapback.facts.clampingVoltage.value!.value = 3.5;
    expect(issueCodes(snapback)).not.toContain("inconsistent_fact_order");
  });

  it("never derives TVS pulse energy and admits only reviewed or explicit unknown energy", () => {
    const calculated = tvsProfile();
    calculated.facts.pulseEnergy.state = "calculated";
    expect(validateProfileSemanticsV3(calculated)).toContainEqual(expect.objectContaining({ code: "derived_pulse_energy_forbidden" }));
    expect(validateProfileAdmissionRulesV3(calculated)).toContainEqual(expect.objectContaining({ code: "invalid_pulse_energy_state" }));

    const estimated = tvsProfile();
    estimated.facts.pulseEnergy.state = "estimated";
    expect(validateProfileAdmissionRulesV3(estimated)).toContainEqual(expect.objectContaining({ code: "invalid_pulse_energy_state" }));

    const behavior = tvsProfile();
    behavior.facts.clampingBehavior.state = "estimated";
    expect(validateProfileAdmissionRulesV3(behavior)).toContainEqual(expect.objectContaining({ path: "facts.clampingBehavior.state", code: "not_reviewed" }));
  });

  it("rejects unsupported class/version tuples, accessors, and tampered V2 geometry", () => {
    const profile = tvsProfile();
    expect(validateDesignProfileV3({ ...profile, factsSchemaVersion: "3.0.1" }, SYNTHETIC_MANUFACTURER_REGISTRY)[0]).toMatchObject({ path: "factsSchemaVersion", code: "invalid_facts_version" });
    expect(validateDesignProfileV3({ ...profile, partClass: "shared.switching-diode" }, SYNTHETIC_MANUFACTURER_REGISTRY).some((entry) => entry.code === "invalid_part_class")).toBe(true);

    const accessor = { ...profile } as Record<string, unknown>;
    Object.defineProperty(accessor, "facts", { enumerable: true, get: () => profile.facts });
    expect(validateDesignProfileV3(accessor, SYNTHETIC_MANUFACTURER_REGISTRY)[0]).toMatchObject({ code: "invalid_data_boundary" });

    const tampered = tvsProfile();
    tampered.facts.mountedGeometry.boardArea.value!.area.value = 1e-6;
    expect(issueCodes(tampered)).toContain("invalid_mounted_geometry");
  });
});
