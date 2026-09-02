import { describe, expect, it } from "vitest";
import {
  FACTS_SCHEMA_VERSION_V35,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  parseDesignProfileV34,
  parseDesignProfileV35,
  validateDesignProfileV35,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library/v2-runtime";
import belF1F2Json from "../../design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json";
import grm31Json from "../../design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json";
import {
  powerPassiveCapacitorCandidateFromReviewedProfileV1,
  powerPassiveInductorCandidateFromReviewedProfileV1,
  type PowerIntegratedBuckOperatingEnvelopeV1,
} from "../src/power-passive-selection-v1";

const OPERATING_ENVELOPE: PowerIntegratedBuckOperatingEnvelopeV1 = {
  inputVoltageV: { minimum: 12, maximum: 12 },
  outputVoltageV: { minimum: 5, maximum: 5 },
  outputCurrentA: { minimum: 0.2, maximum: 0.2 },
  switchingFrequencyHz: { minimum: 290_000, maximum: 510_000 },
  ambientTemperatureK: { minimum: 298.15, maximum: 298.15 },
  maximumOutputRippleV: 0.03,
};

const inductorEvidence = structuredClone(belF1F2Json.facts.inductance.evidence[0]) as ProfileEvidenceRef;
const capacitorEvidence = structuredClone(grm31Json.facts.nominalCapacitance.evidence[0]) as ProfileEvidenceRef;

function quantity(value: number, unit: string, displayUnit: string) {
  return { value, unit, displayUnit };
}

/** A condition wide enough to cover the whole operating envelope. */
function condition(parameterId: string, minimum: any, maximum: any, evidence: ProfileEvidenceRef) {
  return { parameterId, minimum, maximum, evidence: [structuredClone(evidence)] };
}

function unknownFact(explanation: string) {
  return { value: null, state: "unknown" as const, evidence: [], validFor: [], explanation };
}

/**
 * Re-authors the reviewed Bel Fuse inductor at facts 3.5.0. `withBounds: false`
 * is the honest "no published guaranteed limit" case: the profile is at 3.5.0
 * but every bound-typed field is explicit unknown.
 */
function belAtV35(withBounds: boolean) {
  const base = structuredClone(belF1F2Json) as any;
  base.factsSchemaVersion = FACTS_SCHEMA_VERSION_V35;
  base.facts.inductanceMinimum = withBounds
    ? {
        value: quantity(1.87e-6, "H", "1.87 µH"),
        state: "reviewed" as const,
        evidence: [structuredClone(inductorEvidence)],
        validFor: [
          condition("ambientTemperature", quantity(233.15, "K", "-40 °C"), quantity(398.15, "K", "125 °C"), inductorEvidence),
          condition("switchingFrequency", quantity(100_000, "Hz", "100 kHz"), quantity(2_000_000, "Hz", "2 MHz"), inductorEvidence),
          condition("testCurrent", quantity(0, "A", "0 A"), quantity(12, "A", "12 A"), inductorEvidence),
        ],
        explanation: "Guaranteed minimum inductance over tolerance, DC bias, temperature, and switching frequency.",
      }
    : unknownFact("No guaranteed minimum inductance is published for this exact part.");
  base.facts.coreLossMaximum = withBounds
    ? {
        value: quantity(0.05, "W", "50 mW"),
        state: "reviewed" as const,
        evidence: [structuredClone(inductorEvidence)],
        validFor: [
          condition("switchingFrequency", quantity(100_000, "Hz", "100 kHz"), quantity(2_000_000, "Hz", "2 MHz"), inductorEvidence),
          condition("testCurrent", quantity(0, "A", "0 A"), quantity(12, "A", "12 A"), inductorEvidence),
        ],
        explanation: "Guaranteed maximum core loss over the declared excitation.",
      }
    : unknownFact("No guaranteed maximum core loss is published for this exact part.");
  return base;
}

/** Re-authors the reviewed Murata MLCC at facts 3.5.0. */
function grm31AtV35(withBounds: boolean) {
  const base = structuredClone(grm31Json) as any;
  base.factsSchemaVersion = FACTS_SCHEMA_VERSION_V35;
  base.facts.effectiveCapacitanceMinimum = withBounds
    ? {
        value: quantity(3.2e-6, "F", "3.2 µF"),
        state: "reviewed" as const,
        evidence: [structuredClone(capacitorEvidence)],
        validFor: [
          condition("ambientTemperature", quantity(233.15, "K", "-40 °C"), quantity(398.15, "K", "125 °C"), capacitorEvidence),
          condition("dcBias", quantity(0, "V", "0 V"), quantity(25, "V", "25 V"), capacitorEvidence),
        ],
        explanation: "Guaranteed minimum effective capacitance at the declared DC bias and temperature.",
      }
    : unknownFact("No guaranteed minimum effective capacitance is published for this exact part.");
  base.facts.esrMaximum = withBounds
    ? {
        value: quantity(0.012, "ohm", "12 mΩ"),
        state: "reviewed" as const,
        evidence: [structuredClone(capacitorEvidence)],
        validFor: [
          condition("switchingFrequency", quantity(100_000, "Hz", "100 kHz"), quantity(2_000_000, "Hz", "2 MHz"), capacitorEvidence),
        ],
        explanation: "Guaranteed maximum equivalent series resistance at the declared frequency.",
      }
    : unknownFact("No guaranteed maximum ESR is published for this exact part.");
  return base;
}

describe("facts 3.5.0 bound-typed facts in the passive candidate builders", () => {
  it("re-authors the reviewed profiles at 3.5.0 without loosening the closed contract", () => {
    for (const profile of [belAtV35(true), belAtV35(false), grm31AtV35(true), grm31AtV35(false)]) {
      expect(
        validateDesignProfileV35(profile).filter((entry) => entry.code !== "unknown_manufacturer"),
        `${profile.partClass} ${profile.part.manufacturerPartNumber}`,
      ).toEqual([]);
      expect(parseDesignProfileV35(profile).factsSchemaVersion).toBe(FACTS_SCHEMA_VERSION_V35);
    }
  });

  it("consumes a present inductor bound as a condition-covering bound", () => {
    const candidate = powerPassiveInductorCandidateFromReviewedProfileV1(
      parseDesignProfileV35(belAtV35(true)) as any,
      OPERATING_ENVELOPE,
    );
    expect(candidate.inductanceH.authority).toBe("condition_covering_bound");
    expect(candidate.inductanceH.value).toBe(1.87e-6);
    expect(candidate.inductanceH.explanation).toContain("Guaranteed minimum inductance");
    expect(candidate.coreLossMaximumW.authority).toBe("condition_covering_bound");
    expect(candidate.coreLossMaximumW.value).toBe(0.05);
    expect(candidate.coreLossMaximumW.explanation)
      .not.toContain("does not identify this point value as a production maximum");
  });

  it("consumes a present capacitor bound as a condition-covering bound", () => {
    const candidate = powerPassiveCapacitorCandidateFromReviewedProfileV1(
      parseDesignProfileV35(grm31AtV35(true)) as any,
      OPERATING_ENVELOPE,
      2,
    );
    expect(candidate.capacitanceF.authority).toBe("condition_covering_bound");
    expect(candidate.capacitanceF.value).toBe(3.2e-6);
    expect(candidate.capacitanceF.explanation).not.toContain("nameplate capacitance is observation-only");
    expect(candidate.equivalentSeriesResistanceMaximumOhm.authority).toBe("condition_covering_bound");
    expect(candidate.equivalentSeriesResistanceMaximumOhm.value).toBe(0.012);
    expect(candidate.quantity).toBe(2);
  });

  it("leaves the absent-bound projection byte-for-byte identical to the predecessor contract", () => {
    const predecessorInductor = powerPassiveInductorCandidateFromReviewedProfileV1(
      parseDesignProfileV34(belF1F2Json),
      OPERATING_ENVELOPE,
    );
    const v35Inductor = powerPassiveInductorCandidateFromReviewedProfileV1(
      parseDesignProfileV35(belAtV35(false)) as any,
      OPERATING_ENVELOPE,
    );
    expect(v35Inductor).toEqual(predecessorInductor);
    // The reviewed nominal keeps whatever authority it had before 3.5.0; the
    // Bel excitation conditions do not cover this envelope, so it stays a
    // condition-mismatched observation, exactly as at 3.4.0.
    expect(v35Inductor.inductanceH.authority).toBe("condition_mismatched_observation");

    const capacitorCodec = getDesignProfileCodecForVersion("shared.mlcc-capacitor", "2.0.0");
    const predecessorCapacitor = powerPassiveCapacitorCandidateFromReviewedProfileV1(
      parseDesignProfileForV2(capacitorCodec, grm31Json),
      OPERATING_ENVELOPE,
      2,
    );
    const v35Capacitor = powerPassiveCapacitorCandidateFromReviewedProfileV1(
      parseDesignProfileV35(grm31AtV35(false)) as any,
      OPERATING_ENVELOPE,
      2,
    );
    expect(v35Capacitor).toEqual(predecessorCapacitor);
    expect(v35Capacitor.capacitanceF.explanation).toContain("nameplate capacitance is observation-only");
  });

  it("keeps a bound outside the operating envelope a condition-mismatched observation", () => {
    const narrow = belAtV35(true);
    // The published bound only covers up to 1 MHz; the request runs to 510 kHz
    // inside a 2 MHz envelope, so widen the envelope past the reviewed range.
    const candidate = powerPassiveInductorCandidateFromReviewedProfileV1(
      parseDesignProfileV35(narrow) as any,
      { ...OPERATING_ENVELOPE, switchingFrequencyHz: { minimum: 290_000, maximum: 4_000_000 } },
    );
    expect(candidate.inductanceH.authority).toBe("condition_mismatched_observation");
    expect(candidate.inductanceH.explanation).toContain("switchingFrequency:outside_reviewed_range");
  });
});
