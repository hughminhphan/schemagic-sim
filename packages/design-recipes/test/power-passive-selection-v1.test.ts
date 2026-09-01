import { describe, expect, it } from "vitest";
import {
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  parseDesignProfileV34,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library/v2-runtime";
import belF1F2Json from "../../design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json";
import grm31Json from "../../design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json";
import tdkC1608Json from "../../design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json";
import {
  powerPassiveCapacitorCandidateFromReviewedProfileV1,
  powerPassiveInductorCandidateFromReviewedProfileV1,
  selectPowerIntegratedBuckPassivesV1,
  type PowerIntegratedBuckOperatingEnvelopeV1,
  type PowerPassiveCapacitorCandidateV1,
  type PowerPassiveEvidenceAuthorityV1,
  type PowerPassiveEvidenceNumberV1,
  type PowerPassiveInductorCandidateV1,
  type PowerPassiveSelectionInputV1,
} from "../src/power-passive-selection-v1";

const sourceEvidence = structuredClone(
  belF1F2Json.facts.inductance.evidence[0],
) as ProfileEvidenceRef;

function fact(
  value: number | null,
  authority: PowerPassiveEvidenceAuthorityV1,
  explanation = "Synthetic independently reviewed fact.",
): PowerPassiveEvidenceNumberV1 {
  return {
    value,
    authority,
    explanation,
    evidence: authority === "unavailable" ? [] : [structuredClone(sourceEvidence)],
  };
}

function envelope(overrides: Partial<PowerIntegratedBuckOperatingEnvelopeV1> = {}): PowerIntegratedBuckOperatingEnvelopeV1 {
  return {
    inputVoltageV: { minimum: 12, maximum: 12 },
    outputVoltageV: { minimum: 5, maximum: 5 },
    outputCurrentA: { minimum: 0.2, maximum: 0.2 },
    switchingFrequencyHz: { minimum: 290_000, maximum: 510_000 },
    ambientTemperatureK: { minimum: 298.15, maximum: 298.15 },
    maximumOutputRippleV: 0.03,
    ...overrides,
  };
}

function inductor(
  profileId: string,
  options: Readonly<{
    inductanceH?: number;
    inductanceAuthority?: PowerPassiveEvidenceAuthorityV1;
    areaM2?: number | null;
  }> = {},
): PowerPassiveInductorCandidateV1 {
  return {
    profileId,
    inductanceH: fact(
      options.inductanceH ?? 100e-6,
      options.inductanceAuthority ?? "condition_covering_bound",
    ),
    saturationCurrentMinimumA: fact(20, "condition_covering_bound"),
    rmsCurrentMinimumA: fact(20, "condition_covering_bound"),
    dcResistanceMaximumOhm: fact(0.01, "condition_covering_bound"),
    coreLossMaximumW: fact(0.05, "condition_covering_bound"),
    mountedAreaM2: options.areaM2 === undefined ? 2e-6 : options.areaM2,
  };
}

function capacitor(
  profileId: string,
  options: Readonly<{
    quantity?: number;
    capacitanceF?: number;
    capacitanceAuthority?: PowerPassiveEvidenceAuthorityV1;
    esrOhm?: number;
    esrAuthority?: PowerPassiveEvidenceAuthorityV1;
    rippleCurrentA?: number;
    areaM2?: number | null;
  }> = {},
): PowerPassiveCapacitorCandidateV1 {
  return {
    profileId,
    quantity: options.quantity ?? 1,
    capacitanceF: fact(
      options.capacitanceF ?? 100e-6,
      options.capacitanceAuthority ?? "condition_covering_bound",
    ),
    ratedVoltageMinimumV: fact(25, "condition_covering_bound"),
    equivalentSeriesResistanceMaximumOhm: fact(
      options.esrOhm ?? 0.01,
      options.esrAuthority ?? "condition_covering_bound",
    ),
    rippleCurrentMinimumA: fact(options.rippleCurrentA ?? 10, "condition_covering_bound"),
    mountedAreaM2: options.areaM2 === undefined ? 3e-6 : options.areaM2,
  };
}

function select(
  inductors: readonly PowerPassiveInductorCandidateV1[],
  outputCapacitors: readonly PowerPassiveCapacitorCandidateV1[],
  operatingEnvelope = envelope(),
  objective: PowerPassiveSelectionInputV1["objective"] = "area",
) {
  return selectPowerIntegratedBuckPassivesV1({
    envelope: operatingEnvelope,
    objective,
    inductors,
    outputCapacitors,
  });
}

function diagnostic(
  combination: ReturnType<typeof select>["rankedAdmissibleCombinations"][number],
  id: typeof combination.diagnostics[number]["id"],
) {
  const found = combination.diagnostics.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing diagnostic ${id}`);
  return found;
}

describe("integrated-buck passive selection and CCM/DCM kernel", () => {
  it("keeps the reviewed Bel/nameplate-capacitor hero observation-only and explicitly DCM", () => {
    const bel = parseDesignProfileV34(belF1F2Json);
    const capacitorCodec = getDesignProfileCodecForVersion("shared.mlcc-capacitor", "2.0.0");
    const grm31 = parseDesignProfileForV2(capacitorCodec, grm31Json);
    const operatingEnvelope = envelope();
    const result = select(
      [powerPassiveInductorCandidateFromReviewedProfileV1(bel, operatingEnvelope)],
      [powerPassiveCapacitorCandidateFromReviewedProfileV1(grm31, operatingEnvelope, 1)],
      operatingEnvelope,
    );

    expect(result.status).toBe("ranked");
    expect(result.rejectedCombinations).toEqual([]);
    expect(result.rankedAdmissibleCombinations).toHaveLength(1);
    const candidate = result.rankedAdmissibleCombinations[0]!;
    expect(candidate.eligibility).toBe("unknown");
    expect(candidate.conductionModesAtEvaluatedInductance).toEqual(["dcm"]);
    expect(candidate.evaluatedPoints).toHaveLength(2);
    expect(candidate.evaluatedPoints.every((point) => point.currentAuthority === "observation")).toBe(true);
    const lowFrequencyPoint = candidate.evaluatedPoints.find((point) => point.switchingFrequencyHz === 290_000);
    expect(lowFrequencyPoint).toMatchObject({
      conductionMode: "dcm",
      inductorValleyCurrentA: 0,
    });
    expect(lowFrequencyPoint?.ccmReferenceRippleCurrentPeakToPeakA).toBeCloseTo(4.57158, 5);
    expect(lowFrequencyPoint?.inductorRippleCurrentPeakToPeakA).toBeCloseTo(1.35227, 5);
    expect(diagnostic(candidate, "power.passive.inductor.minimum-inductance")).toMatchObject({
      status: "unknown",
      authority: "observation",
      actual: 2.2e-6,
    });
    expect(diagnostic(candidate, "power.passive.capacitor.effective-capacitance")).toMatchObject({
      status: "unknown",
      authority: "observation",
      actual: 10e-6,
    });
    expect(diagnostic(candidate, "power.passive.inductor.loss-bound").status).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.capacitor.loss-bound").status).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.output-ripple").status).toBe("unknown");
  });

  it("separates condition-covering table bounds from mismatched and reference-only observations", () => {
    const operatingEnvelope = envelope();
    const bel = powerPassiveInductorCandidateFromReviewedProfileV1(
      parseDesignProfileV34(belF1F2Json),
      operatingEnvelope,
    );
    const capacitorCodec = getDesignProfileCodecForVersion("shared.mlcc-capacitor", "2.0.0");
    const tdk = powerPassiveCapacitorCandidateFromReviewedProfileV1(
      parseDesignProfileForV2(capacitorCodec, tdkC1608Json),
      operatingEnvelope,
      1,
    );

    expect(bel.inductanceH.authority).toBe("condition_mismatched_observation");
    expect(bel.inductanceH.explanation).toContain("switchingFrequency:outside_reviewed_range");
    expect(bel.inductanceH.explanation).toContain("testVoltage:unresolved_operating_condition");
    expect(bel.saturationCurrentMinimumA.authority).toBe("condition_covering_bound");
    expect(bel.rmsCurrentMinimumA.authority).toBe("condition_covering_bound");
    expect(bel.dcResistanceMaximumOhm.authority).toBe("condition_covering_bound");
    expect(bel.coreLossMaximumW.authority).toBe("unavailable");
    expect(tdk.capacitanceF.authority).toBe("source_backed_observation");
    expect(tdk.capacitanceF.explanation).toContain("No reviewed minimum effective capacitance");
    expect(tdk.equivalentSeriesResistanceMaximumOhm.authority).toBe("unavailable");
    expect(tdk.rippleCurrentMinimumA.authority).toBe("unavailable");
  });

  it("calculates a condition-bounded CCM point and admits it only when every required passive diagnostic closes", () => {
    const result = select(
      [inductor("L-100U")],
      [capacitor("C-100U")],
      envelope({
        outputCurrentA: { minimum: 1, maximum: 1 },
        switchingFrequencyHz: { minimum: 400_000, maximum: 400_000 },
        maximumOutputRippleV: 0.1,
      }),
    );
    const candidate = result.rankedAdmissibleCombinations[0]!;
    expect(candidate.eligibility).toBe("pass");
    expect(candidate.conductionModesAtEvaluatedInductance).toEqual(["ccm"]);
    expect(candidate.evaluatedPoints).toHaveLength(1);
    const point = candidate.evaluatedPoints[0]!;
    expect(point).toMatchObject({
      conductionMode: "ccm",
      currentAuthority: "bound",
      totalOutputRippleAuthority: "bound",
    });
    expect(point.ccmReferenceRippleCurrentPeakToPeakA).toBeCloseTo(0.0729167, 6);
    expect(point.inductorRippleCurrentPeakToPeakA).toBeCloseTo(0.0729167, 6);
    expect(point.inductorValleyCurrentA).toBeCloseTo(0.963542, 6);
    expect(point.inductorPeakCurrentA).toBeCloseTo(1.036458, 6);
    expect(candidate.diagnostics.every((entry) => entry.status === "pass")).toBe(true);
  });

  it("evaluates voltage, frequency, load, and conduction-boundary points before selecting independent worst cases", () => {
    const result = select(
      [inductor("L-10U", { inductanceH: 10e-6 })],
      [capacitor("C-100U")],
      envelope({
        inputVoltageV: { minimum: 9, maximum: 15 },
        outputVoltageV: { minimum: 4, maximum: 6 },
        outputCurrentA: { minimum: 0.2, maximum: 2 },
        switchingFrequencyHz: { minimum: 300_000, maximum: 600_000 },
        maximumOutputRippleV: 1,
      }),
    );
    const candidate = result.rankedAdmissibleCombinations[0]!;
    expect(candidate.conductionModesAtEvaluatedInductance).toEqual(["boundary", "ccm", "dcm"]);
    expect(candidate.worstCase.maximumInductorRippleCurrentPeakToPeakA).toBe(1.2);
    expect(candidate.worstCase.maximumInductorRipplePointId).toContain("vin=15|vout=6");
    expect(candidate.worstCase.maximumInductorRipplePointId).toContain("fsw=300000");
    expect(candidate.worstCase.maximumInductorPeakCurrentA).toBe(2.6);
    expect(candidate.worstCase.maximumInductorPeakPointId).toBe("vin=15|vout=6|iout=2|fsw=300000");
    const boundary = candidate.evaluatedPoints.find((point) => (
      point.id === "vin=15|vout=6|iout=0.6|fsw=300000"
    ));
    expect(boundary).toMatchObject({
      conductionMode: "boundary",
      ccmBoundaryCurrentA: 0.6,
      inductorValleyCurrentA: 0,
    });
  });

  it("returns explicit unknown and inapplicable diagnostics when evidence or a ripple target is absent", () => {
    const missingInductor: PowerPassiveInductorCandidateV1 = {
      ...inductor("L-MISSING"),
      inductanceH: fact(null, "unavailable"),
      dcResistanceMaximumOhm: fact(null, "unavailable"),
      coreLossMaximumW: fact(null, "unavailable"),
    };
    const missingCapacitor: PowerPassiveCapacitorCandidateV1 = {
      ...capacitor("C-MISSING"),
      capacitanceF: fact(null, "unavailable"),
      equivalentSeriesResistanceMaximumOhm: fact(null, "unavailable"),
      rippleCurrentMinimumA: fact(null, "unavailable"),
    };
    const result = select(
      [missingInductor],
      [missingCapacitor],
      envelope({ maximumOutputRippleV: null }),
    );
    const candidate = result.rankedAdmissibleCombinations[0]!;
    expect(candidate.eligibility).toBe("unknown");
    expect(candidate.evaluatedPoints).toEqual([]);
    expect(diagnostic(candidate, "power.passive.inductor.minimum-inductance").status).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.inductor.loss-bound").status).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.capacitor.effective-capacitance").status).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.capacitor.loss-bound").status).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.output-ripple").status).toBe("inapplicable");
  });

  it("is independent of catalog order and ranks the full Cartesian set by evidence, objective, then exact IDs", () => {
    const inductors = [
      inductor("L-Z", { areaM2: 5e-6 }),
      inductor("L-A", { areaM2: 1e-6 }),
    ];
    const capacitors = [
      capacitor("C-Z", { areaM2: 4e-6 }),
      capacitor("C-A", { areaM2: 2e-6 }),
    ];
    const forward = select(inductors, capacitors);
    const reverse = select([...inductors].reverse(), [...capacitors].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.rankedAdmissibleCombinations.map((entry) => entry.id)).toEqual([
      "L-A\u0000C-A\u0000quantity=1",
      "L-A\u0000C-Z\u0000quantity=1",
      "L-Z\u0000C-A\u0000quantity=1",
      "L-Z\u0000C-Z\u0000quantity=1",
    ]);
    expect(Object.isFrozen(forward)).toBe(true);
    expect(Object.isFrozen(forward.rankedAdmissibleCombinations[0]?.evaluatedPoints)).toBe(true);
  });

  it("keeps observation-only nominal calculations unknown and removes known electrical failures from admissible ranking", () => {
    const observed = inductor("L-OBSERVED", {
      inductanceAuthority: "source_backed_observation",
    });
    const lowVoltageCapacitor: PowerPassiveCapacitorCandidateV1 = {
      ...capacitor("C-LOW-V"),
      ratedVoltageMinimumV: fact(4, "condition_covering_bound"),
    };
    const result = select(
      [observed, inductor("L-BOUND")],
      [capacitor("C-OK"), lowVoltageCapacitor],
    );
    expect(result.rankedAdmissibleCombinations.map((entry) => [entry.inductorProfileId, entry.eligibility])).toEqual([
      ["L-BOUND", "pass"],
      ["L-OBSERVED", "unknown"],
    ]);
    expect(result.rejectedCombinations).toHaveLength(2);
    expect(result.rejectedCombinations.every((entry) => (
      diagnostic(entry, "power.passive.capacitor.voltage-rating").status === "fail"
    ))).toBe(true);
  });

  it("never promotes a typical/reference saturation-current value into a rating pass", () => {
    const typicalSaturation: PowerPassiveInductorCandidateV1 = {
      ...inductor("L-TYPICAL-ISAT"),
      saturationCurrentMinimumA: fact(5, "typical_or_reference_observation"),
    };
    const result = select([typicalSaturation], [capacitor("C-BOUND")]);
    const candidate = result.rankedAdmissibleCombinations[0]!;
    expect(candidate.eligibility).toBe("unknown");
    expect(diagnostic(candidate, "power.passive.inductor.saturation-current")).toMatchObject({
      status: "unknown",
      authority: "observation",
      limit: 5,
    });
  });

  it("represents a two-part output bank explicitly and aggregates only same-authority electrical projections", () => {
    const operatingEnvelope = envelope({
      outputCurrentA: { minimum: 1, maximum: 1 },
      switchingFrequencyHz: { minimum: 400_000, maximum: 400_000 },
      maximumOutputRippleV: 1,
    });
    const capacitors = [
      capacitor("C-22U", {
        quantity: 2,
        capacitanceF: 22e-6,
        capacitanceAuthority: "source_backed_observation",
        esrOhm: 0.02,
        esrAuthority: "source_backed_observation",
        areaM2: 3e-6,
      }),
      capacitor("C-22U", {
        quantity: 1,
        capacitanceF: 22e-6,
        capacitanceAuthority: "source_backed_observation",
        esrOhm: 0.02,
        esrAuthority: "source_backed_observation",
        areaM2: 3e-6,
      }),
    ];
    const result = select([inductor("L-100U", { areaM2: 2e-6 })], capacitors, operatingEnvelope);

    expect(result.rankedAdmissibleCombinations.map((entry) => entry.id)).toEqual([
      "L-100U\u0000C-22U\u0000quantity=1",
      "L-100U\u0000C-22U\u0000quantity=2",
    ]);
    expect(result.rankedAdmissibleCombinations.map((entry) => entry.outputCapacitorQuantity)).toEqual([1, 2]);
    const one = result.rankedAdmissibleCombinations[0]!;
    const two = result.rankedAdmissibleCombinations[1]!;
    expect(diagnostic(one, "power.passive.capacitor.effective-capacitance")).toMatchObject({
      status: "unknown",
      authority: "observation",
      actual: 22e-6,
    });
    expect(diagnostic(two, "power.passive.capacitor.effective-capacitance")).toMatchObject({
      status: "unknown",
      authority: "observation",
      actual: 44e-6,
    });
    expect(diagnostic(two, "power.passive.capacitor.effective-capacitance").explanation).toContain(
      "2 exact parallel BOM part(s)",
    );
    expect(one.rank).toMatchObject({ primaryMetric: "mounted-area", primaryMetricValue: 5e-6 });
    expect(two.rank).toMatchObject({ primaryMetric: "mounted-area", primaryMetricValue: 8e-6 });

    const onePoint = one.evaluatedPoints[0]!;
    const twoPoint = two.evaluatedPoints[0]!;
    expect(twoPoint.capacitorRmsCurrentA).toBe(onePoint.capacitorRmsCurrentA);
    expect(twoPoint.esrRipplePeakToPeakV).toBeCloseTo(onePoint.esrRipplePeakToPeakV! / 2, 12);
    expect(twoPoint.capacitorEsrLossW).toBeCloseTo(onePoint.capacitorEsrLossW! / 2, 12);
    expect(twoPoint.capacitorEsrLossAuthority).toBe(onePoint.capacitorEsrLossAuthority);
    expect(twoPoint.totalOutputRippleAuthority).toBe(onePoint.totalOutputRippleAuthority);
    expect(twoPoint.capacitiveRipplePeakToPeakV).toBeCloseTo(
      onePoint.capacitiveRipplePeakToPeakV! / 2,
      12,
    );
    expect(diagnostic(two, "power.passive.capacitor.voltage-rating")).toEqual(
      diagnostic(one, "power.passive.capacitor.voltage-rating"),
    );
  });

  it("compares total bank RMS current against one per-part rating without claiming reviewed sharing", () => {
    const operatingEnvelope = envelope({
      outputCurrentA: { minimum: 1, maximum: 1 },
      switchingFrequencyHz: { minimum: 400_000, maximum: 400_000 },
      maximumOutputRippleV: 1,
    });
    const result = select(
      [inductor("L-100U")],
      [capacitor("C-LOW-IRIPPLE", { quantity: 2, rippleCurrentA: 0.015 })],
      operatingEnvelope,
    );
    expect(result.rankedAdmissibleCombinations).toEqual([]);
    const rejected = result.rejectedCombinations[0]!;
    const rippleCurrent = diagnostic(rejected, "power.passive.capacitor.ripple-current");
    expect(rejected.outputCapacitorQuantity).toBe(2);
    expect(rippleCurrent).toMatchObject({ status: "fail", authority: "bound", limit: 0.015 });
    expect(rippleCurrent.actual).toBeGreaterThan(0.015);
    expect(rippleCurrent.actual).toBeLessThan(0.03);
    expect(rippleCurrent.explanation).toContain("total bank RMS current");
    expect(rippleCurrent.explanation).toContain("no parallel current-sharing multiplier");
  });

  it("rejects every non-positive or non-safe-integer bank quantity", () => {
    for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => select([inductor("L-VALID")], [capacitor("C-INVALID", { quantity })]))
        .toThrow(/quantity must be a positive safe integer/);
    }
  });

  it("is permutation-deterministic when one exact capacitor profile has several bank quantities", () => {
    const inductors = [
      inductor("L-Z", { areaM2: 2e-6 }),
      inductor("L-A", { areaM2: 2e-6 }),
    ];
    const capacitors = [
      capacitor("C-SAME", { quantity: 2, areaM2: 3e-6 }),
      capacitor("C-A", { quantity: 1, areaM2: 3e-6 }),
      capacitor("C-SAME", { quantity: 1, areaM2: 3e-6 }),
    ];
    const forward = select(inductors, capacitors);
    const reverse = select([...inductors].reverse(), [...capacitors].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.rankedAdmissibleCombinations.map((entry) => entry.id)).toEqual([
      "L-A\u0000C-A\u0000quantity=1",
      "L-A\u0000C-SAME\u0000quantity=1",
      "L-Z\u0000C-A\u0000quantity=1",
      "L-Z\u0000C-SAME\u0000quantity=1",
      "L-A\u0000C-SAME\u0000quantity=2",
      "L-Z\u0000C-SAME\u0000quantity=2",
    ]);
  });
});
