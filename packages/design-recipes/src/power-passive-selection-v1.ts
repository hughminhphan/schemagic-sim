import {
  canonicalProfileNumberV2,
  designProfileId,
  type DesignProfileV34,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type OperatingRange,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Number,
  compareDesignV2Tokens,
  detachedFrozenDesignV2Value,
  type ElectricalDesignObjectiveV2,
} from "@opencircuit/design-schema";

export type PowerPassiveEvidenceAuthorityV1 =
  | "condition_covering_bound"
  | "source_backed_observation"
  | "typical_or_reference_observation"
  | "condition_mismatched_observation"
  | "unavailable";

export interface PowerPassiveEvidenceNumberV1 {
  readonly value: number | null;
  readonly authority: PowerPassiveEvidenceAuthorityV1;
  readonly explanation: string;
  readonly evidence: readonly ProfileEvidenceRef[];
}

export interface PowerIntegratedBuckOperatingEnvelopeV1 {
  readonly inputVoltageV: Readonly<{ minimum: number; maximum: number }>;
  readonly outputVoltageV: Readonly<{ minimum: number; maximum: number }>;
  readonly outputCurrentA: Readonly<{ minimum: number; maximum: number }>;
  readonly switchingFrequencyHz: Readonly<{ minimum: number; maximum: number }>;
  readonly ambientTemperatureK: Readonly<{ minimum: number; maximum: number }>;
  readonly maximumOutputRippleV: number | null;
}

export interface PowerPassiveInductorCandidateV1 {
  readonly profileId: string;
  /** A production minimum only when authority is condition_covering_bound. */
  readonly inductanceH: PowerPassiveEvidenceNumberV1;
  readonly saturationCurrentMinimumA: PowerPassiveEvidenceNumberV1;
  readonly rmsCurrentMinimumA: PowerPassiveEvidenceNumberV1;
  readonly dcResistanceMaximumOhm: PowerPassiveEvidenceNumberV1;
  readonly coreLossMaximumW: PowerPassiveEvidenceNumberV1;
  readonly mountedAreaM2: number | null;
}

export interface PowerPassiveCapacitorCandidateV1 {
  readonly profileId: string;
  /** Exact BOM count of identical parts connected in parallel. */
  readonly quantity: number;
  /** Per-part value; a production minimum only when authority is condition_covering_bound. */
  readonly capacitanceF: PowerPassiveEvidenceNumberV1;
  /** Per-part voltage rating; parallel connection does not increase it. */
  readonly ratedVoltageMinimumV: PowerPassiveEvidenceNumberV1;
  /** Per-part ESR. The parallel bank projection uses R / quantity at the same authority. */
  readonly equivalentSeriesResistanceMaximumOhm: PowerPassiveEvidenceNumberV1;
  /** Per-part rating. The kernel does not claim a current-sharing multiplier. */
  readonly rippleCurrentMinimumA: PowerPassiveEvidenceNumberV1;
  /** Per-part mounted area. */
  readonly mountedAreaM2: number | null;
}

export interface PowerPassiveSelectionInputV1 {
  readonly envelope: PowerIntegratedBuckOperatingEnvelopeV1;
  readonly objective: ElectricalDesignObjectiveV2;
  readonly inductors: readonly PowerPassiveInductorCandidateV1[];
  readonly outputCapacitors: readonly PowerPassiveCapacitorCandidateV1[];
}

export type PowerPassiveCalculationAuthorityV1 = "bound" | "observation" | "unavailable";
export type PowerBuckConductionModeV1 = "ccm" | "boundary" | "dcm";

export interface PowerPassiveOperatingPointV1 {
  readonly id: string;
  readonly inputVoltageV: number;
  readonly outputVoltageV: number;
  readonly outputCurrentA: number;
  readonly switchingFrequencyHz: number;
  readonly evaluatedInductanceH: number;
  readonly currentAuthority: Exclude<PowerPassiveCalculationAuthorityV1, "unavailable">;
  readonly conductionMode: PowerBuckConductionModeV1;
  readonly dutyCycle: number;
  readonly ccmBoundaryCurrentA: number;
  readonly ccmReferenceRippleCurrentPeakToPeakA: number;
  readonly inductorRippleCurrentPeakToPeakA: number;
  readonly inductorPeakCurrentA: number;
  readonly inductorValleyCurrentA: number;
  readonly inductorRmsCurrentA: number;
  readonly capacitorRmsCurrentA: number;
  readonly capacitiveRipplePeakToPeakV: number | null;
  readonly capacitiveRippleAuthority: PowerPassiveCalculationAuthorityV1;
  readonly esrRipplePeakToPeakV: number | null;
  readonly totalOutputRipplePeakToPeakV: number | null;
  readonly totalOutputRippleAuthority: PowerPassiveCalculationAuthorityV1;
  readonly inductorCopperLossW: number | null;
  readonly inductorTotalLossW: number | null;
  readonly inductorTotalLossAuthority: PowerPassiveCalculationAuthorityV1;
  readonly capacitorEsrLossW: number | null;
  readonly capacitorEsrLossAuthority: PowerPassiveCalculationAuthorityV1;
  readonly totalPassiveLossW: number | null;
  readonly totalPassiveLossAuthority: PowerPassiveCalculationAuthorityV1;
}

export interface PowerPassiveWorstCaseV1 {
  readonly maximumInductorRippleCurrentPeakToPeakA: number | null;
  readonly maximumInductorRipplePointId: string | null;
  readonly maximumInductorPeakCurrentA: number | null;
  readonly maximumInductorPeakPointId: string | null;
  readonly maximumInductorRmsCurrentA: number | null;
  readonly maximumInductorRmsPointId: string | null;
  readonly maximumCapacitorRmsCurrentA: number | null;
  readonly maximumCapacitorRmsPointId: string | null;
  readonly maximumCapacitiveRipplePeakToPeakV: number | null;
  readonly maximumCapacitiveRipplePointId: string | null;
  readonly maximumOutputRipplePeakToPeakV: number | null;
  readonly maximumOutputRipplePointId: string | null;
  readonly maximumInductorTotalLossW: number | null;
  readonly maximumInductorTotalLossPointId: string | null;
  readonly maximumCapacitorEsrLossW: number | null;
  readonly maximumCapacitorEsrLossPointId: string | null;
  readonly maximumTotalPassiveLossW: number | null;
  readonly maximumTotalPassiveLossPointId: string | null;
}

export type PowerPassiveDiagnosticStatusV1 = "pass" | "fail" | "unknown" | "inapplicable";

export interface PowerPassiveDiagnosticV1 {
  readonly id:
    | "power.passive.inductor.minimum-inductance"
    | "power.passive.inductor.saturation-current"
    | "power.passive.inductor.rms-current"
    | "power.passive.inductor.loss-bound"
    | "power.passive.capacitor.effective-capacitance"
    | "power.passive.capacitor.voltage-rating"
    | "power.passive.capacitor.ripple-current"
    | "power.passive.capacitor.loss-bound"
    | "power.passive.output-ripple";
  readonly status: PowerPassiveDiagnosticStatusV1;
  readonly authority: PowerPassiveCalculationAuthorityV1;
  readonly actual: number | null;
  readonly limit: number | null;
  readonly unit: "A" | "F" | "H" | "V" | "W" | null;
  readonly explanation: string;
  readonly evidence: readonly ProfileEvidenceRef[];
}

export interface PowerPassiveRankV1 {
  readonly objective: ElectricalDesignObjectiveV2;
  readonly unknownDiagnosticCount: number;
  readonly primaryMetric: "mounted-area" | "output-ripple" | "passive-loss";
  readonly primaryMetricValue: number | null;
  readonly primaryMetricAuthority: "bound" | "observation" | "calculated_proxy" | "unavailable";
}

export interface PowerPassiveCombinationV1 {
  readonly id: string;
  readonly inductorProfileId: string;
  readonly outputCapacitorProfileId: string;
  readonly outputCapacitorQuantity: number;
  readonly eligibility: "pass" | "unknown" | "fail";
  readonly evaluatedPoints: readonly PowerPassiveOperatingPointV1[];
  readonly conductionModesAtEvaluatedInductance: readonly PowerBuckConductionModeV1[];
  readonly worstCase: PowerPassiveWorstCaseV1;
  readonly diagnostics: readonly PowerPassiveDiagnosticV1[];
  readonly rank: PowerPassiveRankV1;
}

export interface PowerPassiveSelectionResultV1 {
  readonly status: "ranked" | "no_admissible_combinations";
  readonly rankedAdmissibleCombinations: readonly PowerPassiveCombinationV1[];
  readonly rejectedCombinations: readonly PowerPassiveCombinationV1[];
}

type InductorProfile =
  | DesignProfileWithFactsV2<"power.power-inductor", FactsV2For<"power.power-inductor">>
  | DesignProfileV34<"power.power-inductor">;
type CapacitorProfile = DesignProfileWithFactsV2<
  "shared.mlcc-capacitor",
  FactsV2For<"shared.mlcc-capacitor">
>;

type BoundFactSemantic = "bound" | "observation";

function canon(value: number): number {
  const designValue = canonicalDesignV2Number(value);
  const profileValue = canonicalProfileNumberV2(value);
  if (designValue !== profileValue) throw new Error("Design and profile canonical arithmetic diverged");
  return designValue;
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function evidenceKey(reference: Readonly<ProfileEvidenceRef>): string {
  return `${reference.sourceId}\u0000${reference.contentHash ?? ""}\u0000${reference.locator}`;
}

function orderedEvidence(...groups: readonly (readonly ProfileEvidenceRef[])[]): ProfileEvidenceRef[] {
  const byKey = new Map<string, ProfileEvidenceRef>();
  for (const reference of groups.flat()) byKey.set(evidenceKey(reference), reference);
  return [...byKey.entries()]
    .sort(([left], [right]) => compareDesignV2Tokens(left, right))
    .map(([, reference]) => reference);
}

function conditionRange(condition: Readonly<OperatingRange>): { minimum: number; maximum: number } | null {
  if (condition.minimum === null || condition.maximum === null) return null;
  return { minimum: condition.minimum.value, maximum: condition.maximum.value };
}

function requiredRangeForCondition(
  parameterId: string,
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
): Readonly<{ minimum: number; maximum: number }> | null {
  switch (parameterId) {
    case "ambientTemperature": return envelope.ambientTemperatureK;
    case "dcBias": return envelope.outputVoltageV;
    case "supplyVoltage": return envelope.inputVoltageV;
    case "switchingFrequency": return envelope.switchingFrequencyHz;
    case "testCurrent": return envelope.outputCurrentA;
    default: return null;
  }
}

function conditionMismatches(
  conditions: readonly OperatingRange[],
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
): string[] {
  return conditions.flatMap((condition) => {
    const reviewed = conditionRange(condition);
    const required = requiredRangeForCondition(condition.parameterId, envelope);
    if (reviewed === null) return [`${condition.parameterId}:open_or_missing_endpoint`];
    if (required === null) return [`${condition.parameterId}:unresolved_operating_condition`];
    return required.minimum >= reviewed.minimum && required.maximum <= reviewed.maximum
      ? []
      : [`${condition.parameterId}:outside_reviewed_range`];
  }).sort(compareDesignV2Tokens);
}

function unavailable(explanation: string, evidence: readonly ProfileEvidenceRef[] = []): PowerPassiveEvidenceNumberV1 {
  return { value: null, authority: "unavailable", explanation, evidence: orderedEvidence(evidence) };
}

function reviewedFactNumber(
  fact: Readonly<ProfileFact<ProfileQuantity>>,
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
  semantic: BoundFactSemantic,
): PowerPassiveEvidenceNumberV1 {
  if (fact.state !== "reviewed" || fact.value === null || fact.evidence.length === 0) {
    return unavailable(fact.explanation, fact.evidence);
  }
  const mismatches = conditionMismatches(fact.validFor, envelope);
  return {
    value: fact.value.value,
    authority: mismatches.length > 0
      ? "condition_mismatched_observation"
      : semantic === "bound"
        ? "condition_covering_bound"
        : "source_backed_observation",
    explanation: mismatches.length > 0
      ? `${fact.explanation} The operating envelope does not match: ${mismatches.join(", ")}.`
      : fact.explanation,
    evidence: orderedEvidence(fact.evidence, ...fact.validFor.map((condition) => condition.evidence)),
  };
}

function mountedArea(profile: Readonly<InductorProfile | CapacitorProfile>): number | null {
  const fact = profile.facts.mountedGeometry.boardArea;
  return fact.state === "calculated" && fact.value !== null ? fact.value.area.value : null;
}

/**
 * Projects only structurally reviewed profile fields into the pure kernel.
 * The current facts schemas expose nominal inductance, not a minimum over
 * tolerance, bias, temperature, and frequency, so it remains an observation.
 */
export function powerPassiveInductorCandidateFromReviewedProfileV1(
  profile: Readonly<InductorProfile>,
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
): PowerPassiveInductorCandidateV1 {
  return detachedFrozenDesignV2Value({
    profileId: designProfileId(profile.partClass, profile.part),
    inductanceH: reviewedFactNumber(profile.facts.inductance, envelope, "observation"),
    saturationCurrentMinimumA: reviewedFactNumber(profile.facts.saturationCurrent, envelope, "bound"),
    rmsCurrentMinimumA: reviewedFactNumber(profile.facts.rmsCurrent, envelope, "bound"),
    dcResistanceMaximumOhm: reviewedFactNumber(profile.facts.dcResistance, envelope, "bound"),
    coreLossMaximumW: profile.facts.coreLoss.state === "reviewed" && profile.facts.coreLoss.value !== null
      ? {
          ...reviewedFactNumber(profile.facts.coreLoss, envelope, "observation"),
          explanation: `${profile.facts.coreLoss.explanation} The facts schema does not identify this point value as a production maximum.`,
        }
      : unavailable(profile.facts.coreLoss.explanation, profile.facts.coreLoss.evidence),
    mountedAreaM2: mountedArea(profile),
  });
}

/**
 * Projects reviewed capacitor facts without treating nominal/nameplate or
 * point-characterization values as minimum effective capacitance or max ESR.
 */
export function powerPassiveCapacitorCandidateFromReviewedProfileV1(
  profile: Readonly<CapacitorProfile>,
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
  quantity: number,
): PowerPassiveCapacitorCandidateV1 {
  const effective = profile.facts.effectiveCapacitance;
  const capacitance = effective.state === "reviewed" && effective.value !== null
    ? reviewedFactNumber(effective, envelope, "observation")
    : {
        ...reviewedFactNumber(profile.facts.nominalCapacitance, envelope, "observation"),
        explanation: `${profile.facts.nominalCapacitance.explanation} No reviewed minimum effective capacitance is available; nameplate capacitance is observation-only.`,
      };
  return detachedFrozenDesignV2Value({
    profileId: designProfileId(profile.partClass, profile.part),
    quantity,
    capacitanceF: capacitance,
    ratedVoltageMinimumV: reviewedFactNumber(profile.facts.ratedVoltage, envelope, "bound"),
    equivalentSeriesResistanceMaximumOhm:
      profile.facts.equivalentSeriesResistance.state === "reviewed"
      && profile.facts.equivalentSeriesResistance.value !== null
        ? {
            ...reviewedFactNumber(profile.facts.equivalentSeriesResistance, envelope, "observation"),
            explanation: `${profile.facts.equivalentSeriesResistance.explanation} The facts schema does not identify this point value as a production maximum.`,
          }
        : unavailable(
            profile.facts.equivalentSeriesResistance.explanation,
            profile.facts.equivalentSeriesResistance.evidence,
          ),
    rippleCurrentMinimumA: reviewedFactNumber(profile.facts.rippleCurrent, envelope, "bound"),
    mountedAreaM2: mountedArea(profile),
  });
}

function validateRange(label: string, range: Readonly<{ minimum: number; maximum: number }>): void {
  if (
    !Number.isFinite(range.minimum)
    || !Number.isFinite(range.maximum)
    || range.minimum <= 0
    || range.maximum < range.minimum
  ) throw new TypeError(`${label} must be a finite positive ordered range`);
}

function validateEnvelope(envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>): void {
  validateRange("inputVoltageV", envelope.inputVoltageV);
  validateRange("outputVoltageV", envelope.outputVoltageV);
  validateRange("outputCurrentA", envelope.outputCurrentA);
  validateRange("switchingFrequencyHz", envelope.switchingFrequencyHz);
  validateRange("ambientTemperatureK", envelope.ambientTemperatureK);
  if (envelope.outputVoltageV.maximum >= envelope.inputVoltageV.minimum) {
    throw new TypeError("Integrated-buck passive evaluation requires a step-down envelope at every voltage corner");
  }
  if (
    envelope.maximumOutputRippleV !== null
    && (!Number.isFinite(envelope.maximumOutputRippleV) || envelope.maximumOutputRippleV <= 0)
  ) throw new TypeError("maximumOutputRippleV must be null or a finite positive value");
}

function validateEvidenceNumber(label: string, value: Readonly<PowerPassiveEvidenceNumberV1>, allowZero: boolean): void {
  if (value.authority === "unavailable") {
    if (value.value !== null) throw new TypeError(`${label} cannot carry a value when unavailable`);
    return;
  }
  if (
    value.value === null
    || !Number.isFinite(value.value)
    || (allowZero ? value.value < 0 : value.value <= 0)
  ) throw new TypeError(`${label} must carry a finite ${allowZero ? "non-negative" : "positive"} value`);
  if (value.evidence.length === 0) throw new TypeError(`${label} cannot claim evidence authority without evidence`);
}

function validateInputs(input: Readonly<PowerPassiveSelectionInputV1>): void {
  validateEnvelope(input.envelope);
  const ids = new Set<string>();
  for (const inductor of input.inductors) {
    if (inductor.profileId.length === 0 || ids.has(`L\u0000${inductor.profileId}`)) {
      throw new TypeError("Inductor profile IDs must be non-empty and unique");
    }
    ids.add(`L\u0000${inductor.profileId}`);
    validateEvidenceNumber(`${inductor.profileId}.inductanceH`, inductor.inductanceH, false);
    validateEvidenceNumber(`${inductor.profileId}.saturationCurrentMinimumA`, inductor.saturationCurrentMinimumA, false);
    validateEvidenceNumber(`${inductor.profileId}.rmsCurrentMinimumA`, inductor.rmsCurrentMinimumA, false);
    validateEvidenceNumber(`${inductor.profileId}.dcResistanceMaximumOhm`, inductor.dcResistanceMaximumOhm, true);
    validateEvidenceNumber(`${inductor.profileId}.coreLossMaximumW`, inductor.coreLossMaximumW, true);
    if (inductor.mountedAreaM2 !== null && (!Number.isFinite(inductor.mountedAreaM2) || inductor.mountedAreaM2 <= 0)) {
      throw new TypeError(`${inductor.profileId}.mountedAreaM2 must be null or finite and positive`);
    }
  }
  for (const capacitor of input.outputCapacitors) {
    if (!Number.isSafeInteger(capacitor.quantity) || capacitor.quantity <= 0) {
      throw new TypeError(`${capacitor.profileId}.quantity must be a positive safe integer`);
    }
    const capacitorIdentity = `C\u0000${capacitor.profileId}\u0000quantity=${capacitor.quantity}`;
    if (capacitor.profileId.length === 0 || ids.has(capacitorIdentity)) {
      throw new TypeError("Output-capacitor profile ID and quantity pairs must be non-empty and unique");
    }
    ids.add(capacitorIdentity);
    validateEvidenceNumber(`${capacitor.profileId}.capacitanceF`, capacitor.capacitanceF, false);
    validateEvidenceNumber(`${capacitor.profileId}.ratedVoltageMinimumV`, capacitor.ratedVoltageMinimumV, false);
    validateEvidenceNumber(
      `${capacitor.profileId}.equivalentSeriesResistanceMaximumOhm`,
      capacitor.equivalentSeriesResistanceMaximumOhm,
      true,
    );
    validateEvidenceNumber(`${capacitor.profileId}.rippleCurrentMinimumA`, capacitor.rippleCurrentMinimumA, false);
    if (capacitor.mountedAreaM2 !== null && (!Number.isFinite(capacitor.mountedAreaM2) || capacitor.mountedAreaM2 <= 0)) {
      throw new TypeError(`${capacitor.profileId}.mountedAreaM2 must be null or finite and positive`);
    }
  }
}

function calculationAuthority(
  ...facts: readonly Readonly<PowerPassiveEvidenceNumberV1>[]
): PowerPassiveCalculationAuthorityV1 {
  if (facts.some((fact) => fact.authority === "unavailable" || fact.value === null)) return "unavailable";
  return facts.every((fact) => fact.authority === "condition_covering_bound") ? "bound" : "observation";
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values.map(canon))].sort(compareNumbers);
}

function pointId(inputVoltageV: number, outputVoltageV: number, outputCurrentA: number, switchingFrequencyHz: number): string {
  return `vin=${inputVoltageV}|vout=${outputVoltageV}|iout=${outputCurrentA}|fsw=${switchingFrequencyHz}`;
}

function aggregateParallelCapacitanceF(
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
): number | null {
  return capacitor.capacitanceF.value === null
    ? null
    : canon(capacitor.capacitanceF.value * capacitor.quantity);
}

function aggregateParallelEsrOhm(
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
): number | null {
  return capacitor.equivalentSeriesResistanceMaximumOhm.value === null
    ? null
    : canon(capacitor.equivalentSeriesResistanceMaximumOhm.value / capacitor.quantity);
}

function projectOperatingPoint(
  inputVoltageV: number,
  outputVoltageV: number,
  outputCurrentA: number,
  switchingFrequencyHz: number,
  inductor: Readonly<PowerPassiveInductorCandidateV1>,
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
): PowerPassiveOperatingPointV1 {
  const inductanceH = inductor.inductanceH.value;
  if (inductanceH === null) throw new Error("Cannot project an operating point without an inductance observation or bound");
  const offDuty = canon(1 - canon(outputVoltageV / inputVoltageV));
  const ccmRipple = canon(canon(outputVoltageV * offDuty) / canon(inductanceH * switchingFrequencyHz));
  const boundaryCurrent = canon(ccmRipple / 2);
  const mode: PowerBuckConductionModeV1 = outputCurrentA === boundaryCurrent
    ? "boundary"
    : outputCurrentA > boundaryCurrent
      ? "ccm"
      : "dcm";
  const currentAuthority = inductor.inductanceH.authority === "condition_covering_bound" ? "bound" : "observation";

  let dutyCycle: number;
  let rippleCurrent: number;
  let peakCurrent: number;
  let valleyCurrent: number;
  let inductorRmsCurrent: number;
  let capacitorRmsCurrent: number;
  let capacitiveChargePerCycle: number;
  if (mode === "dcm") {
    peakCurrent = canon(Math.sqrt(canon(2 * canon(outputCurrentA * ccmRipple))));
    rippleCurrent = peakCurrent;
    valleyCurrent = 0;
    dutyCycle = canon(Math.sqrt(canon(
      canon(canon(2 * inductanceH) * canon(outputVoltageV * outputCurrentA) * switchingFrequencyHz)
      / canon(inputVoltageV * canon(inputVoltageV - outputVoltageV)),
    )));
    inductorRmsCurrent = canon(Math.sqrt(canon(canon(2 * outputCurrentA * peakCurrent) / 3)));
    capacitorRmsCurrent = canon(Math.sqrt(Math.max(0, canon(
      canon(canon(2 * outputCurrentA * peakCurrent) / 3) - canon(outputCurrentA * outputCurrentA),
    ))));
    const loadToPeak = canon(outputCurrentA / peakCurrent);
    capacitiveChargePerCycle = canon(
      canon(outputCurrentA / switchingFrequencyHz)
      * canon(canon(1 - loadToPeak) * canon(1 - loadToPeak)),
    );
  } else {
    dutyCycle = canon(outputVoltageV / inputVoltageV);
    rippleCurrent = ccmRipple;
    const halfRipple = canon(ccmRipple / 2);
    peakCurrent = canon(outputCurrentA + halfRipple);
    valleyCurrent = canon(outputCurrentA - halfRipple);
    inductorRmsCurrent = canon(Math.sqrt(canon(
      canon(outputCurrentA * outputCurrentA) + canon(canon(ccmRipple * ccmRipple) / 12),
    )));
    capacitorRmsCurrent = canon(ccmRipple / Math.sqrt(12));
    capacitiveChargePerCycle = canon(ccmRipple / canon(8 * switchingFrequencyHz));
  }

  const capacitanceF = aggregateParallelCapacitanceF(capacitor);
  const esrOhm = aggregateParallelEsrOhm(capacitor);
  const dcrOhm = inductor.dcResistanceMaximumOhm.value;
  const coreLossW = inductor.coreLossMaximumW.value;
  const capacitiveRipple = capacitanceF === null ? null : canon(capacitiveChargePerCycle / capacitanceF);
  const capacitiveRippleAuthority = calculationAuthority(inductor.inductanceH, capacitor.capacitanceF);
  const esrRipple = esrOhm === null ? null : canon(rippleCurrent * esrOhm);
  const totalRipple = capacitiveRipple === null || esrRipple === null ? null : canon(capacitiveRipple + esrRipple);
  const totalRippleAuthority = calculationAuthority(
    inductor.inductanceH,
    capacitor.capacitanceF,
    capacitor.equivalentSeriesResistanceMaximumOhm,
  );
  const copperLoss = dcrOhm === null ? null : canon(canon(inductorRmsCurrent * inductorRmsCurrent) * dcrOhm);
  const inductorTotalLoss = copperLoss === null || coreLossW === null ? null : canon(copperLoss + coreLossW);
  const inductorTotalLossAuthority = calculationAuthority(
    inductor.inductanceH,
    inductor.dcResistanceMaximumOhm,
    inductor.coreLossMaximumW,
  );
  const capacitorLoss = esrOhm === null ? null : canon(canon(capacitorRmsCurrent * capacitorRmsCurrent) * esrOhm);
  const capacitorLossAuthority = calculationAuthority(
    inductor.inductanceH,
    capacitor.equivalentSeriesResistanceMaximumOhm,
  );
  const totalPassiveLoss = inductorTotalLoss === null || capacitorLoss === null
    ? null
    : canon(inductorTotalLoss + capacitorLoss);
  const totalPassiveLossAuthority = calculationAuthority(
    inductor.inductanceH,
    inductor.dcResistanceMaximumOhm,
    inductor.coreLossMaximumW,
    capacitor.equivalentSeriesResistanceMaximumOhm,
  );

  return {
    id: pointId(inputVoltageV, outputVoltageV, outputCurrentA, switchingFrequencyHz),
    inputVoltageV,
    outputVoltageV,
    outputCurrentA,
    switchingFrequencyHz,
    evaluatedInductanceH: inductanceH,
    currentAuthority,
    conductionMode: mode,
    dutyCycle,
    ccmBoundaryCurrentA: boundaryCurrent,
    ccmReferenceRippleCurrentPeakToPeakA: ccmRipple,
    inductorRippleCurrentPeakToPeakA: rippleCurrent,
    inductorPeakCurrentA: peakCurrent,
    inductorValleyCurrentA: valleyCurrent,
    inductorRmsCurrentA: inductorRmsCurrent,
    capacitorRmsCurrentA: capacitorRmsCurrent,
    capacitiveRipplePeakToPeakV: capacitiveRipple,
    capacitiveRippleAuthority,
    esrRipplePeakToPeakV: esrRipple,
    totalOutputRipplePeakToPeakV: totalRipple,
    totalOutputRippleAuthority: totalRippleAuthority,
    inductorCopperLossW: copperLoss,
    inductorTotalLossW: inductorTotalLoss,
    inductorTotalLossAuthority,
    capacitorEsrLossW: capacitorLoss,
    capacitorEsrLossAuthority: capacitorLossAuthority,
    totalPassiveLossW: totalPassiveLoss,
    totalPassiveLossAuthority,
  };
}

function operatingPoints(
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
  inductor: Readonly<PowerPassiveInductorCandidateV1>,
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
): PowerPassiveOperatingPointV1[] {
  const inductanceH = inductor.inductanceH.value;
  if (inductanceH === null) return [];
  const inputVoltages = uniqueNumbers([envelope.inputVoltageV.minimum, envelope.inputVoltageV.maximum]);
  const outputVoltages = uniqueNumbers([
    envelope.outputVoltageV.minimum,
    envelope.outputVoltageV.maximum,
    ...inputVoltages
      .map((inputVoltage) => canon(inputVoltage / 2))
      .filter((value) => value >= envelope.outputVoltageV.minimum && value <= envelope.outputVoltageV.maximum),
  ]);
  const frequencies = uniqueNumbers([
    envelope.switchingFrequencyHz.minimum,
    envelope.switchingFrequencyHz.maximum,
  ]);
  const baseCurrents = uniqueNumbers([envelope.outputCurrentA.minimum, envelope.outputCurrentA.maximum]);
  const points = new Map<string, PowerPassiveOperatingPointV1>();
  for (const inputVoltage of inputVoltages) {
    for (const outputVoltage of outputVoltages) {
      for (const frequency of frequencies) {
        const ccmRipple = canon(
          canon(outputVoltage * canon(1 - canon(outputVoltage / inputVoltage)))
          / canon(inductanceH * frequency),
        );
        const boundaryCurrent = canon(ccmRipple / 2);
        const currents = uniqueNumbers([
          ...baseCurrents,
          ...(boundaryCurrent >= envelope.outputCurrentA.minimum && boundaryCurrent <= envelope.outputCurrentA.maximum
            ? [boundaryCurrent]
            : []),
        ]);
        for (const current of currents) {
          const point = projectOperatingPoint(
            inputVoltage,
            outputVoltage,
            current,
            frequency,
            inductor,
            capacitor,
          );
          points.set(point.id, point);
        }
      }
    }
  }
  return [...points.values()].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
}

function maximumPoint(
  points: readonly PowerPassiveOperatingPointV1[],
  value: (point: Readonly<PowerPassiveOperatingPointV1>) => number | null,
): Readonly<{ value: number | null; pointId: string | null }> {
  let selected: Readonly<{ value: number; pointId: string }> | null = null;
  for (const point of points) {
    const candidate = value(point);
    if (candidate === null) continue;
    if (
      selected === null
      || candidate > selected.value
      || (candidate === selected.value && compareDesignV2Tokens(point.id, selected.pointId) < 0)
    ) selected = { value: candidate, pointId: point.id };
  }
  return selected ?? { value: null, pointId: null };
}

function worstCase(points: readonly PowerPassiveOperatingPointV1[]): PowerPassiveWorstCaseV1 {
  const ripple = maximumPoint(points, (point) => point.inductorRippleCurrentPeakToPeakA);
  const peak = maximumPoint(points, (point) => point.inductorPeakCurrentA);
  const rms = maximumPoint(points, (point) => point.inductorRmsCurrentA);
  const capRms = maximumPoint(points, (point) => point.capacitorRmsCurrentA);
  const capRipple = maximumPoint(points, (point) => point.capacitiveRipplePeakToPeakV);
  const outputRipple = maximumPoint(points, (point) => point.totalOutputRipplePeakToPeakV);
  const inductorLoss = maximumPoint(points, (point) => point.inductorTotalLossW);
  const capacitorLoss = maximumPoint(points, (point) => point.capacitorEsrLossW);
  const passiveLoss = maximumPoint(points, (point) => point.totalPassiveLossW);
  return {
    maximumInductorRippleCurrentPeakToPeakA: ripple.value,
    maximumInductorRipplePointId: ripple.pointId,
    maximumInductorPeakCurrentA: peak.value,
    maximumInductorPeakPointId: peak.pointId,
    maximumInductorRmsCurrentA: rms.value,
    maximumInductorRmsPointId: rms.pointId,
    maximumCapacitorRmsCurrentA: capRms.value,
    maximumCapacitorRmsPointId: capRms.pointId,
    maximumCapacitiveRipplePeakToPeakV: capRipple.value,
    maximumCapacitiveRipplePointId: capRipple.pointId,
    maximumOutputRipplePeakToPeakV: outputRipple.value,
    maximumOutputRipplePointId: outputRipple.pointId,
    maximumInductorTotalLossW: inductorLoss.value,
    maximumInductorTotalLossPointId: inductorLoss.pointId,
    maximumCapacitorEsrLossW: capacitorLoss.value,
    maximumCapacitorEsrLossPointId: capacitorLoss.pointId,
    maximumTotalPassiveLossW: passiveLoss.value,
    maximumTotalPassiveLossPointId: passiveLoss.pointId,
  };
}

function diagnostic(
  id: PowerPassiveDiagnosticV1["id"],
  status: PowerPassiveDiagnosticStatusV1,
  authority: PowerPassiveCalculationAuthorityV1,
  actual: number | null,
  limit: number | null,
  unit: PowerPassiveDiagnosticV1["unit"],
  explanation: string,
  evidence: readonly ProfileEvidenceRef[],
): PowerPassiveDiagnosticV1 {
  return { id, status, authority, actual, limit, unit, explanation, evidence: orderedEvidence(evidence) };
}

function candidateDiagnostics(
  envelope: Readonly<PowerIntegratedBuckOperatingEnvelopeV1>,
  inductor: Readonly<PowerPassiveInductorCandidateV1>,
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
  maximum: Readonly<PowerPassiveWorstCaseV1>,
): PowerPassiveDiagnosticV1[] {
  const currentAuthority = calculationAuthority(inductor.inductanceH);
  const inductanceBound = currentAuthority === "bound";
  const diagnostics: PowerPassiveDiagnosticV1[] = [diagnostic(
    "power.passive.inductor.minimum-inductance",
    inductanceBound ? "pass" : "unknown",
    currentAuthority,
    inductor.inductanceH.value,
    null,
    "H",
    inductanceBound
      ? "A condition-covering minimum inductance is available for corner calculations."
      : inductor.inductanceH.value === null
        ? "No reviewed inductance value is available; current and ripple projections are unavailable."
        : "The available inductance is nominal, typical/reference, or condition-mismatched rather than a production minimum. Calculated current and mode are observations only.",
    inductor.inductanceH.evidence,
  )];

  const currentRatingDiagnostic = (
    id: "power.passive.inductor.saturation-current" | "power.passive.inductor.rms-current",
    rating: Readonly<PowerPassiveEvidenceNumberV1>,
    actual: number | null,
    label: string,
  ): PowerPassiveDiagnosticV1 => {
    const ratingBound = rating.authority === "condition_covering_bound" && rating.value !== null;
    const rawLoadFailure = ratingBound && envelope.outputCurrentA.maximum > rating.value!;
    if (rawLoadFailure) return diagnostic(
      id,
      "fail",
      "bound",
      envelope.outputCurrentA.maximum,
      rating.value,
      "A",
      `Maximum output current alone exceeds the condition-covering ${label}; ripple cannot restore margin.`,
      rating.evidence,
    );
    if (ratingBound && inductanceBound && actual !== null) return diagnostic(
      id,
      actual <= rating.value! ? "pass" : "fail",
      "bound",
      actual,
      rating.value,
      "A",
      actual <= rating.value!
        ? `Worst evaluated condition-covering current does not exceed the ${label}.`
        : `Worst evaluated condition-covering current exceeds the ${label}.`,
      orderedEvidence(rating.evidence, inductor.inductanceH.evidence),
    );
    return diagnostic(
      id,
      "unknown",
      actual === null ? "unavailable" : "observation",
      actual,
      rating.value,
      "A",
      `No pass is available because the ${label}, minimum inductance, or operating-condition coverage is missing.`,
      orderedEvidence(rating.evidence, inductor.inductanceH.evidence),
    );
  };
  diagnostics.push(
    currentRatingDiagnostic(
      "power.passive.inductor.saturation-current",
      inductor.saturationCurrentMinimumA,
      maximum.maximumInductorPeakCurrentA,
      "minimum saturation-current rating",
    ),
    currentRatingDiagnostic(
      "power.passive.inductor.rms-current",
      inductor.rmsCurrentMinimumA,
      maximum.maximumInductorRmsCurrentA,
      "minimum RMS-current rating",
    ),
  );

  const inductorLossBound = inductanceBound
    && inductor.dcResistanceMaximumOhm.authority === "condition_covering_bound"
    && inductor.coreLossMaximumW.authority === "condition_covering_bound"
    && maximum.maximumInductorTotalLossW !== null;
  diagnostics.push(diagnostic(
    "power.passive.inductor.loss-bound",
    inductorLossBound ? "pass" : "unknown",
    inductorLossBound ? "bound" : maximum.maximumInductorTotalLossW === null ? "unavailable" : "observation",
    maximum.maximumInductorTotalLossW,
    null,
    "W",
    inductorLossBound
      ? "Worst evaluated inductor copper plus core loss has a condition-covering upper bound."
      : "No total inductor-loss bound is available because minimum inductance, maximum DCR, or maximum core loss is absent or condition-mismatched.",
    orderedEvidence(
      inductor.inductanceH.evidence,
      inductor.dcResistanceMaximumOhm.evidence,
      inductor.coreLossMaximumW.evidence,
    ),
  ));

  const capacitanceBound = capacitor.capacitanceF.authority === "condition_covering_bound";
  const aggregateCapacitanceF = aggregateParallelCapacitanceF(capacitor);
  diagnostics.push(diagnostic(
    "power.passive.capacitor.effective-capacitance",
    capacitanceBound ? "pass" : "unknown",
    calculationAuthority(capacitor.capacitanceF),
    aggregateCapacitanceF,
    null,
    "F",
    capacitanceBound
      ? `A condition-covering per-part minimum effective capacitance is available; ${capacitor.quantity} exact parallel BOM part(s) are aggregated without changing evidence authority.`
      : `The aggregate for ${capacitor.quantity} exact parallel BOM part(s) is based on nominal/nameplate or point-characterization capacitance, not a production minimum under DC bias, temperature, tolerance, and aging.`,
    capacitor.capacitanceF.evidence,
  ));

  const voltageBound = capacitor.ratedVoltageMinimumV.authority === "condition_covering_bound"
    && capacitor.ratedVoltageMinimumV.value !== null;
  diagnostics.push(diagnostic(
    "power.passive.capacitor.voltage-rating",
    voltageBound
      ? envelope.outputVoltageV.maximum <= capacitor.ratedVoltageMinimumV.value! ? "pass" : "fail"
      : "unknown",
    voltageBound ? "bound" : calculationAuthority(capacitor.ratedVoltageMinimumV),
    envelope.outputVoltageV.maximum,
    capacitor.ratedVoltageMinimumV.value,
    "V",
    voltageBound
      ? envelope.outputVoltageV.maximum <= capacitor.ratedVoltageMinimumV.value!
        ? "Maximum output voltage does not exceed the reviewed capacitor voltage rating."
        : "Maximum output voltage exceeds the reviewed capacitor voltage rating."
      : "No condition-covering capacitor voltage rating is available.",
    capacitor.ratedVoltageMinimumV.evidence,
  ));

  const capacitorCurrentBound = inductanceBound
    && capacitor.rippleCurrentMinimumA.authority === "condition_covering_bound"
    && capacitor.rippleCurrentMinimumA.value !== null
    && maximum.maximumCapacitorRmsCurrentA !== null;
  diagnostics.push(diagnostic(
    "power.passive.capacitor.ripple-current",
    capacitorCurrentBound
      ? maximum.maximumCapacitorRmsCurrentA! <= capacitor.rippleCurrentMinimumA.value! ? "pass" : "fail"
      : "unknown",
    capacitorCurrentBound ? "bound" : maximum.maximumCapacitorRmsCurrentA === null ? "unavailable" : "observation",
    maximum.maximumCapacitorRmsCurrentA,
    capacitor.rippleCurrentMinimumA.value,
    "A",
    capacitorCurrentBound
      ? maximum.maximumCapacitorRmsCurrentA! <= capacitor.rippleCurrentMinimumA.value!
        ? "Worst evaluated total bank RMS current does not exceed one per-part reviewed rating. This is conservative: no parallel current-sharing multiplier is claimed without reviewed sharing evidence."
        : "Worst evaluated total bank RMS current exceeds one per-part reviewed rating. This is conservative: no parallel current-sharing multiplier is claimed without reviewed sharing evidence."
      : "No pass is available because a condition-covering total bank current projection or per-part capacitor ripple-current rating is missing. No parallel current-sharing multiplier is claimed without reviewed sharing evidence.",
    orderedEvidence(inductor.inductanceH.evidence, capacitor.rippleCurrentMinimumA.evidence),
  ));

  const capacitorLossBound = inductanceBound
    && capacitor.equivalentSeriesResistanceMaximumOhm.authority === "condition_covering_bound"
    && maximum.maximumCapacitorEsrLossW !== null;
  diagnostics.push(diagnostic(
    "power.passive.capacitor.loss-bound",
    capacitorLossBound ? "pass" : "unknown",
    capacitorLossBound ? "bound" : maximum.maximumCapacitorEsrLossW === null ? "unavailable" : "observation",
    maximum.maximumCapacitorEsrLossW,
    null,
    "W",
    capacitorLossBound
      ? "Worst evaluated capacitor ESR dissipation has a condition-covering upper bound."
      : "No capacitor-loss bound is available because minimum inductance or maximum condition-covering ESR is absent.",
    orderedEvidence(inductor.inductanceH.evidence, capacitor.equivalentSeriesResistanceMaximumOhm.evidence),
  ));

  const outputRippleBound = inductanceBound
    && capacitanceBound
    && capacitor.equivalentSeriesResistanceMaximumOhm.authority === "condition_covering_bound"
    && maximum.maximumOutputRipplePeakToPeakV !== null;
  diagnostics.push(envelope.maximumOutputRippleV === null
    ? diagnostic(
        "power.passive.output-ripple",
        "inapplicable",
        "unavailable",
        maximum.maximumOutputRipplePeakToPeakV,
        null,
        "V",
        "The operating envelope supplies no output-ripple limit; no ripple compliance claim is applicable.",
        orderedEvidence(inductor.inductanceH.evidence, capacitor.capacitanceF.evidence),
      )
    : diagnostic(
        "power.passive.output-ripple",
        outputRippleBound
          ? maximum.maximumOutputRipplePeakToPeakV! <= envelope.maximumOutputRippleV ? "pass" : "fail"
          : "unknown",
        outputRippleBound ? "bound" : maximum.maximumOutputRipplePeakToPeakV === null ? "unavailable" : "observation",
        maximum.maximumOutputRipplePeakToPeakV,
        envelope.maximumOutputRippleV,
        "V",
        outputRippleBound
          ? maximum.maximumOutputRipplePeakToPeakV! <= envelope.maximumOutputRippleV
            ? "Worst evaluated capacitive-plus-ESR ripple remains within the requested limit."
            : "Worst evaluated capacitive-plus-ESR ripple exceeds the requested limit."
          : "No ripple pass is available because minimum inductance, minimum effective capacitance, or maximum ESR evidence is absent or condition-mismatched.",
        orderedEvidence(
          inductor.inductanceH.evidence,
          capacitor.capacitanceF.evidence,
          capacitor.equivalentSeriesResistanceMaximumOhm.evidence,
        ),
      ));
  return diagnostics.sort((left, right) => compareDesignV2Tokens(left.id, right.id));
}

function metricAuthority(points: readonly PowerPassiveOperatingPointV1[], field: "totalOutputRippleAuthority" | "totalPassiveLossAuthority"): PowerPassiveCalculationAuthorityV1 {
  const authorities = points.map((point) => point[field]);
  if (authorities.length === 0 || authorities.every((authority) => authority === "unavailable")) return "unavailable";
  return authorities.every((authority) => authority === "bound") ? "bound" : "observation";
}

function rank(
  objective: ElectricalDesignObjectiveV2,
  inductor: Readonly<PowerPassiveInductorCandidateV1>,
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
  points: readonly PowerPassiveOperatingPointV1[],
  maximum: Readonly<PowerPassiveWorstCaseV1>,
  diagnostics: readonly PowerPassiveDiagnosticV1[],
): PowerPassiveRankV1 {
  const unknownDiagnosticCount = diagnostics.filter((entry) => entry.status === "unknown").length;
  if (objective === "area") {
    const area = inductor.mountedAreaM2 === null || capacitor.mountedAreaM2 === null
      ? null
      : canon(inductor.mountedAreaM2 + canon(capacitor.mountedAreaM2 * capacitor.quantity));
    return {
      objective,
      unknownDiagnosticCount,
      primaryMetric: "mounted-area",
      primaryMetricValue: area,
      primaryMetricAuthority: area === null ? "unavailable" : "calculated_proxy",
    };
  }
  if (objective === "balanced") {
    const authority = metricAuthority(points, "totalOutputRippleAuthority");
    return {
      objective,
      unknownDiagnosticCount,
      primaryMetric: "output-ripple",
      primaryMetricValue: maximum.maximumOutputRipplePeakToPeakV,
      primaryMetricAuthority: authority,
    };
  }
  const authority = metricAuthority(points, "totalPassiveLossAuthority");
  return {
    objective,
    unknownDiagnosticCount,
    primaryMetric: "passive-loss",
    primaryMetricValue: maximum.maximumTotalPassiveLossW,
    primaryMetricAuthority: authority,
  };
}

function combination(
  input: Readonly<PowerPassiveSelectionInputV1>,
  inductor: Readonly<PowerPassiveInductorCandidateV1>,
  capacitor: Readonly<PowerPassiveCapacitorCandidateV1>,
): PowerPassiveCombinationV1 {
  const points = operatingPoints(input.envelope, inductor, capacitor);
  const maximum = worstCase(points);
  const diagnostics = candidateDiagnostics(input.envelope, inductor, capacitor, maximum);
  const eligibility: PowerPassiveCombinationV1["eligibility"] = diagnostics.some((entry) => entry.status === "fail")
    ? "fail"
    : diagnostics.some((entry) => entry.status === "unknown")
      ? "unknown"
      : "pass";
  return {
    id: `${inductor.profileId}\u0000${capacitor.profileId}\u0000quantity=${capacitor.quantity}`,
    inductorProfileId: inductor.profileId,
    outputCapacitorProfileId: capacitor.profileId,
    outputCapacitorQuantity: capacitor.quantity,
    eligibility,
    evaluatedPoints: points,
    conductionModesAtEvaluatedInductance: [...new Set(points.map((point) => point.conductionMode))]
      .sort(compareDesignV2Tokens),
    worstCase: maximum,
    diagnostics,
    rank: rank(input.objective, inductor, capacitor, points, maximum, diagnostics),
  };
}

function compareOptionalMetric(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compareNumbers(left, right);
}

function compareCombinations(left: Readonly<PowerPassiveCombinationV1>, right: Readonly<PowerPassiveCombinationV1>): number {
  const eligibilityOrder = { pass: 0, unknown: 1, fail: 2 } as const;
  return eligibilityOrder[left.eligibility] - eligibilityOrder[right.eligibility]
    || left.rank.unknownDiagnosticCount - right.rank.unknownDiagnosticCount
    || compareOptionalMetric(left.rank.primaryMetricValue, right.rank.primaryMetricValue)
    || compareDesignV2Tokens(left.inductorProfileId, right.inductorProfileId)
    || compareDesignV2Tokens(left.outputCapacitorProfileId, right.outputCapacitorProfileId)
    || compareNumbers(left.outputCapacitorQuantity, right.outputCapacitorQuantity);
}

/**
 * Pure deterministic passive enumeration. Observation-only math can influence
 * an explicit ranking tie-break, but it can never promote eligibility to pass.
 */
export function selectPowerIntegratedBuckPassivesV1(
  input: Readonly<PowerPassiveSelectionInputV1>,
): PowerPassiveSelectionResultV1 {
  validateInputs(input);
  const inductors = [...input.inductors].sort((left, right) => compareDesignV2Tokens(left.profileId, right.profileId));
  const capacitors = [...input.outputCapacitors]
    .sort((left, right) => (
      compareDesignV2Tokens(left.profileId, right.profileId)
      || compareNumbers(left.quantity, right.quantity)
    ));
  const combinations = inductors.flatMap((inductor) => capacitors.map((capacitor) => (
    combination(input, inductor, capacitor)
  ))).sort(compareCombinations);
  const rankedAdmissibleCombinations = combinations.filter((entry) => entry.eligibility !== "fail");
  const rejectedCombinations = combinations.filter((entry) => entry.eligibility === "fail");
  return detachedFrozenDesignV2Value({
    status: rankedAdmissibleCombinations.length > 0 ? "ranked" : "no_admissible_combinations",
    rankedAdmissibleCombinations,
    rejectedCombinations,
  });
}
