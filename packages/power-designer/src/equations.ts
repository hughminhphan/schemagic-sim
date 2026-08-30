export const BUCK_EQUATION_IDS = {
  dutyCycle: "buck.duty-cycle.ideal-v1",
  switchingFrequency: "buck.switching-frequency.deterministic-selection-v1",
  inductorTarget: "buck.inductor.target-ripple-v1",
  inductorRipple: "buck.inductor.ripple-v1",
  inductorPeak: "buck.inductor.peak-current-v1",
  inductorRms: "buck.inductor.rms-current-v1",
  inputCapacitance: "buck.input-capacitance.five-percent-ripple-v1",
  inputCapacitorRms: "buck.input-capacitor.rms-current-v1",
  outputCapacitance: "buck.output-capacitance.seventy-percent-ripple-budget-v1",
  outputRipple: "buck.output-ripple.capacitive-plus-esr-v1",
  feedbackDivider: "buck.feedback-divider-v1",
  integratedConductionLoss: "buck.integrated-fet.conduction-loss-v1",
  externalConductionLoss: "buck.external-fet.conduction-loss-v1",
  switchingLoss: "buck.fet.switching-loss-v1",
  gateDriveLoss: "buck.external-fet.gate-drive-loss-v1",
  thermalRise: "buck.thermal.single-resistance-v1",
} as const;

export interface SizingInputs {
  inputVoltageMinV: number;
  inputVoltageNominalV: number;
  inputVoltageMaxV: number;
  outputVoltageV: number;
  outputCurrentA: number;
  switchingFrequencyHz: number;
  maximumOutputRippleV: number;
}

export interface IdealBuckSizing {
  dutyAtMinimumInput: number;
  dutyAtNominalInput: number;
  dutyAtMaximumInput: number;
  targetRippleCurrentA: number;
  targetInductanceH: number;
  targetInputCapacitanceF: number;
  targetOutputCapacitanceF: number;
  inputCapacitorRmsCurrentA: number;
  minimumOnTimeAtMaximumInputS: number;
  minimumOffTimeAtMinimumInputS: number;
  feedbackBottomResistanceOhm: number;
}

const TARGET_INDUCTOR_RIPPLE_RATIO = 0.3;
const OUTPUT_CAPACITIVE_RIPPLE_BUDGET = 0.7;
const INPUT_RIPPLE_BUDGET_RATIO = 0.05;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function selectSwitchingFrequency(
  requestMinimumHz: number,
  requestPreferredHz: number | null,
  requestMaximumHz: number,
  deviceMinimumHz: number,
  deviceRecommendedHz: number,
  deviceMaximumHz: number,
): number {
  const overlapMinimum = Math.max(requestMinimumHz, deviceMinimumHz);
  const overlapMaximum = Math.min(requestMaximumHz, deviceMaximumHz);
  const target = requestPreferredHz ?? deviceRecommendedHz;
  if (overlapMinimum <= overlapMaximum) return clamp(target, overlapMinimum, overlapMaximum);
  return clamp(target, requestMinimumHz, requestMaximumHz);
}

export function solveIdealBuck(inputs: SizingInputs): IdealBuckSizing {
  const dutyAtMinimumInput = inputs.outputVoltageV / inputs.inputVoltageMinV;
  const dutyAtNominalInput = inputs.outputVoltageV / inputs.inputVoltageNominalV;
  const dutyAtMaximumInput = inputs.outputVoltageV / inputs.inputVoltageMaxV;
  const targetRippleCurrentA = inputs.outputCurrentA * TARGET_INDUCTOR_RIPPLE_RATIO;
  const targetInductanceH = inputs.outputVoltageV * (1 - dutyAtMaximumInput)
    / (inputs.switchingFrequencyHz * targetRippleCurrentA);
  const targetOutputCapacitanceF = targetRippleCurrentA
    / (8 * inputs.switchingFrequencyHz * inputs.maximumOutputRippleV * OUTPUT_CAPACITIVE_RIPPLE_BUDGET);
  const targetInputCapacitanceF = inputs.outputCurrentA * dutyAtNominalInput * (1 - dutyAtNominalInput)
    / (inputs.switchingFrequencyHz * inputs.inputVoltageNominalV * INPUT_RIPPLE_BUDGET_RATIO);
  return {
    dutyAtMinimumInput,
    dutyAtNominalInput,
    dutyAtMaximumInput,
    targetRippleCurrentA,
    targetInductanceH,
    targetInputCapacitanceF,
    targetOutputCapacitanceF,
    inputCapacitorRmsCurrentA: inputs.outputCurrentA * Math.sqrt(dutyAtNominalInput * (1 - dutyAtNominalInput)),
    minimumOnTimeAtMaximumInputS: dutyAtMaximumInput / inputs.switchingFrequencyHz,
    minimumOffTimeAtMinimumInputS: (1 - dutyAtMinimumInput) / inputs.switchingFrequencyHz,
    feedbackBottomResistanceOhm: 10_000,
  };
}

export function inductorRippleCurrent(
  outputVoltageV: number,
  inputVoltageMaxV: number,
  switchingFrequencyHz: number,
  inductanceH: number,
): number {
  return outputVoltageV * (1 - outputVoltageV / inputVoltageMaxV) / (switchingFrequencyHz * inductanceH);
}

export function inductorRmsCurrent(outputCurrentA: number, rippleCurrentA: number): number {
  return Math.sqrt(outputCurrentA ** 2 + rippleCurrentA ** 2 / 12);
}

export function outputRippleVoltage(
  rippleCurrentA: number,
  switchingFrequencyHz: number,
  effectiveCapacitanceF: number,
  esrOhm: number,
): number {
  return rippleCurrentA / (8 * switchingFrequencyHz * effectiveCapacitanceF) + rippleCurrentA * esrOhm;
}

export function feedbackOutputVoltage(referenceV: number, topOhm: number, bottomOhm: number): number {
  return referenceV * (1 + topOhm / bottomOhm);
}
