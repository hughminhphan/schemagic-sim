export type PowerCalculatorDispositionV1 = "pass" | "fail" | "unknown";

export interface PowerCalculatorUnknownV1 {
  readonly disposition: "unknown";
  readonly missingInputs: readonly string[];
}

export interface IntegratedBuckLossInputsV1 {
  readonly inputVoltageV: number | null;
  readonly outputVoltageV: number | null;
  readonly outputCurrentA: number | null;
  readonly switchingFrequencyHz: number | null;
  readonly inductanceMinimumH: number | null;
  readonly highSideOnResistanceMaximumOhm: number | null;
  readonly lowSideOnResistanceMaximumOhm: number | null;
  readonly nonSwitchingSupplyCurrentMaximumA: number | null;
  readonly switchingTransitionMaximumS: number | null;
}

export interface IntegratedBuckLossResultV1 {
  readonly disposition: "pass";
  readonly dutyCycle: number;
  readonly rippleCurrentA: number;
  readonly rmsCurrentA: number;
  readonly conductionLossW: number;
  readonly switchingLossW: number;
  readonly quiescentLossW: number;
  readonly totalLossW: number;
  readonly switchingTransitionTimeS: number;
  readonly switchingTransitionBasis: "condition_covering_transition_bound";
}

function missingPositive(
  input: Readonly<Record<string, number | null | undefined>>,
  allowZero: ReadonlySet<string> = new Set(),
): string[] {
  return Object.entries(input)
    .filter(([key, value]) => value === null || value === undefined || !Number.isFinite(value) || (allowZero.has(key) ? value < 0 : value <= 0))
    .map(([key]) => key)
    .sort();
}

/**
 * Worst-case point loss model for an integrated synchronous buck.
 *
 * Conduction uses the triangular-ripple RMS current and duty-weights the
 * guaranteed high-side and low-side RDS(on) maxima. Switching uses the standard
 * overlap approximation, 0.5 * Vin * Iout * ttransition * fs. The transition
 * duration must be a condition-covering maximum. This intentionally omits
 * deadtime/body-diode and Coss loss terms, so callers must not claim a complete
 * stage-loss bound unless those omissions are accepted by the governing contract.
 */
export function calculateIntegratedBuckLossV1(
  input: Readonly<IntegratedBuckLossInputsV1>,
): IntegratedBuckLossResultV1 | PowerCalculatorUnknownV1 {
  const missing = missingPositive({
    inputVoltageV: input.inputVoltageV,
    outputVoltageV: input.outputVoltageV,
    outputCurrentA: input.outputCurrentA,
    switchingFrequencyHz: input.switchingFrequencyHz,
    inductanceMinimumH: input.inductanceMinimumH,
    highSideOnResistanceMaximumOhm: input.highSideOnResistanceMaximumOhm,
    lowSideOnResistanceMaximumOhm: input.lowSideOnResistanceMaximumOhm,
    nonSwitchingSupplyCurrentMaximumA: input.nonSwitchingSupplyCurrentMaximumA,
  }, new Set(["nonSwitchingSupplyCurrentMaximumA"]));
  if (
    input.switchingTransitionMaximumS === null
    || !Number.isFinite(input.switchingTransitionMaximumS)
    || input.switchingTransitionMaximumS <= 0
  ) missing.push("facts 3.5 has no switching-transition bound field");
  if (missing.length > 0) return { disposition: "unknown", missingInputs: [...new Set(missing)].sort() };

  const inputVoltageV = input.inputVoltageV!;
  const outputVoltageV = input.outputVoltageV!;
  if (outputVoltageV >= inputVoltageV) {
    return { disposition: "unknown", missingInputs: ["stepDownOperatingPoint"] };
  }
  const dutyCycle = outputVoltageV / inputVoltageV;
  const rippleCurrentA = outputVoltageV * (1 - dutyCycle)
    / (input.switchingFrequencyHz! * input.inductanceMinimumH!);
  const rmsCurrentA = Math.sqrt(input.outputCurrentA! ** 2 + rippleCurrentA ** 2 / 12);
  const conductionLossW = rmsCurrentA ** 2 * (
    dutyCycle * input.highSideOnResistanceMaximumOhm!
    + (1 - dutyCycle) * input.lowSideOnResistanceMaximumOhm!
  );
  const switchingTransitionTimeS = input.switchingTransitionMaximumS!;
  const switchingLossW = 0.5 * inputVoltageV * input.outputCurrentA!
    * switchingTransitionTimeS * input.switchingFrequencyHz!;
  const quiescentLossW = input.inputVoltageV! * input.nonSwitchingSupplyCurrentMaximumA!;
  return {
    disposition: "pass",
    dutyCycle,
    rippleCurrentA,
    rmsCurrentA,
    conductionLossW,
    switchingLossW,
    quiescentLossW,
    totalLossW: conductionLossW + switchingLossW + quiescentLossW,
    switchingTransitionTimeS,
    switchingTransitionBasis: "condition_covering_transition_bound",
  };
}

export interface IntegratedBuckJunctionTemperatureInputsV1 {
  readonly totalLossW: number | null;
  readonly ambientTemperatureK: number | null;
  readonly thermalResistanceJunctionAmbientMaximumKPerW: number | null;
  readonly datasheetMaximumJunctionTemperatureK: number | null;
  readonly designMaximumJunctionTemperatureK: number | null;
}

export interface IntegratedBuckJunctionTemperatureResultV1 {
  readonly disposition: "pass" | "fail";
  readonly junctionTemperatureK: number;
  readonly limitK: number;
  readonly marginK: number;
}

export function calculateIntegratedBuckJunctionTemperatureV1(
  input: Readonly<IntegratedBuckJunctionTemperatureInputsV1>,
): IntegratedBuckJunctionTemperatureResultV1 | PowerCalculatorUnknownV1 {
  const missing = missingPositive({
    totalLossW: input.totalLossW,
    ambientTemperatureK: input.ambientTemperatureK,
    thermalResistanceJunctionAmbientMaximumKPerW: input.thermalResistanceJunctionAmbientMaximumKPerW,
    datasheetMaximumJunctionTemperatureK: input.datasheetMaximumJunctionTemperatureK,
    designMaximumJunctionTemperatureK: input.designMaximumJunctionTemperatureK,
  }, new Set(["totalLossW"]));
  if (missing.length > 0) return { disposition: "unknown", missingInputs: missing };
  const junctionTemperatureK = input.ambientTemperatureK!
    + input.totalLossW! * input.thermalResistanceJunctionAmbientMaximumKPerW!;
  const limitK = Math.min(
    input.datasheetMaximumJunctionTemperatureK!,
    input.designMaximumJunctionTemperatureK!,
  );
  return {
    disposition: junctionTemperatureK <= limitK ? "pass" : "fail",
    junctionTemperatureK,
    limitK,
    marginK: limitK - junctionTemperatureK,
  };
}

export interface IntegratedBuckCurrentLimitInputsV1 {
  readonly inputVoltageMaximumV: number | null;
  readonly outputVoltageV: number | null;
  readonly outputCurrentMaximumA: number | null;
  readonly switchingFrequencyMinimumHz: number | null;
  readonly inductanceMinimumH: number | null;
  readonly currentLimitMinimumA: number | null;
  readonly requiredMarginRatio: number | null;
}

export interface IntegratedBuckCurrentLimitResultV1 {
  readonly disposition: "pass" | "fail";
  readonly rippleCurrentA: number;
  readonly peakInductorCurrentA: number;
  readonly requiredCurrentLimitA: number;
  readonly currentLimitMinimumA: number;
  readonly marginA: number;
}

export function calculateIntegratedBuckCurrentLimitV1(
  input: Readonly<IntegratedBuckCurrentLimitInputsV1>,
): IntegratedBuckCurrentLimitResultV1 | PowerCalculatorUnknownV1 {
  const missing = missingPositive({
    inputVoltageMaximumV: input.inputVoltageMaximumV,
    outputVoltageV: input.outputVoltageV,
    outputCurrentMaximumA: input.outputCurrentMaximumA,
    switchingFrequencyMinimumHz: input.switchingFrequencyMinimumHz,
    inductanceMinimumH: input.inductanceMinimumH,
    currentLimitMinimumA: input.currentLimitMinimumA,
    requiredMarginRatio: input.requiredMarginRatio,
  }, new Set(["requiredMarginRatio"]));
  if (missing.length > 0) return { disposition: "unknown", missingInputs: missing };
  if (input.outputVoltageV! >= input.inputVoltageMaximumV!) {
    return { disposition: "unknown", missingInputs: ["stepDownOperatingPoint"] };
  }
  const rippleCurrentA = input.outputVoltageV!
    * (1 - input.outputVoltageV! / input.inputVoltageMaximumV!)
    / (input.switchingFrequencyMinimumHz! * input.inductanceMinimumH!);
  const peakInductorCurrentA = input.outputCurrentMaximumA! + rippleCurrentA / 2;
  const requiredCurrentLimitA = peakInductorCurrentA * (1 + input.requiredMarginRatio!);
  return {
    disposition: input.currentLimitMinimumA! >= requiredCurrentLimitA ? "pass" : "fail",
    rippleCurrentA,
    peakInductorCurrentA,
    requiredCurrentLimitA,
    currentLimitMinimumA: input.currentLimitMinimumA!,
    marginA: input.currentLimitMinimumA! - requiredCurrentLimitA,
  };
}
