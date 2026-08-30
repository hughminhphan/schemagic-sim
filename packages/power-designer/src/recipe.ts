import {
  contentHash,
  type CandidateEstimate,
  type DesignRecipe,
  type JsonObject,
  type MatchedOption,
  type RecipeEnvironment,
  type SolvedOption,
  type StageOutcome,
} from "@opencircuit/design-engine";
import type {
  BuckDesignRequest,
  BuckRequirements,
  CandidateMetric,
  ConstraintResult,
  DerivedValue,
  EvidenceRef,
  Quantity,
  SIUnit,
  SelectedComponent,
} from "@opencircuit/design-schema";
import { SYNTHETIC_BUCK_TEST_CATALOG } from "./catalog";
import { buckSimulationCoverage, materializeBuckCircuit } from "./circuit";
import {
  BUCK_EQUATION_IDS,
  feedbackOutputVoltage,
  inductorRippleCurrent,
  inductorRmsCurrent,
  outputRippleVoltage,
  selectSwitchingFrequency,
  solveIdealBuck,
} from "./equations";
import { B1_PLACEHOLDER_EVIDENCE, BUCK_EQUATION_EVIDENCE, SYNTHETIC_CATALOG_EVIDENCE } from "./evidence";
import type {
  BuckPrimaryProfile,
  CapacitorProfile,
  ExternalControllerProfile,
  InductorProfile,
  IntegratedRegulatorProfile,
  PowerMosfetProfile,
  ResistorProfile,
} from "./types";

const INDUCTOR_MATCH_MINIMUM_RATIO = 0.65;
const INDUCTOR_MATCH_MAXIMUM_RATIO = 1.5;
const PRIMARY_VOLTAGE_HEADROOM_RATIO = 1.2;
const CAPACITOR_VOLTAGE_HEADROOM_RATIO = 1.25;
const FEEDBACK_ACCURACY_LIMIT_RATIO = 0.02;

interface OperatingEstimate {
  boardAreaM2: number;
  capacitorLossW: number;
  conductionLossW: number;
  controllerOrQuiescentLossW: number;
  efficiencyRatio: number;
  feedbackLossW: number;
  gateDriveLossW: number;
  hottestJunctionTemperatureK: number;
  inductorCopperLossW: number;
  inductorCoreLossW: number | null;
  inductorPeakCurrentA: number;
  inductorRippleCurrentA: number;
  inductorRmsCurrentA: number;
  inputCapacitorRmsCurrentA: number;
  outputCapacitorEffectiveF: number;
  outputCapacitorEffectiveState: "calculated" | "estimated";
  outputRippleV: number;
  switchingLossW: number;
  totalLossW: number;
}

function numberData(data: JsonObject, key: string): number {
  const value = data[key];
  if (typeof value !== "number") throw new Error(`Buck recipe data ${key} must be numeric`);
  return value;
}

function stringData(data: JsonObject, key: string): string {
  const value = data[key];
  if (typeof value !== "string") throw new Error(`Buck recipe data ${key} must be text`);
  return value;
}

function buckRequest(environment: RecipeEnvironment): BuckDesignRequest {
  if (environment.request.application !== "power.buck") throw new Error("Buck recipe received a non-buck request");
  return environment.request as BuckDesignRequest;
}

function quantity<Unit extends SIUnit>(value: number, unit: Unit, displayUnit: string = unit): Quantity<Unit> {
  return { value, unit, displayUnit };
}

function constraintAtMost(
  ruleId: string,
  actual: number,
  limit: number,
  unit: SIUnit,
  explanation: string,
  evidence: EvidenceRef[],
): ConstraintResult {
  return {
    ruleId,
    status: actual <= limit ? "pass" : "fail",
    actual: quantity(actual, unit),
    limit: quantity(limit, unit),
    margin: quantity(limit - actual, unit),
    explanation,
    evidence,
  };
}

function constraintAtLeast(
  ruleId: string,
  actual: number,
  limit: number,
  unit: SIUnit,
  explanation: string,
  evidence: EvidenceRef[],
): ConstraintResult {
  return {
    ruleId,
    status: actual >= limit ? "pass" : "fail",
    actual: quantity(actual, unit),
    limit: quantity(limit, unit),
    margin: quantity(actual - limit, unit),
    explanation,
    evidence,
  };
}

function primaryProfile(profileId: string): BuckPrimaryProfile {
  const profile = [...SYNTHETIC_BUCK_TEST_CATALOG.integratedRegulators, ...SYNTHETIC_BUCK_TEST_CATALOG.externalControllers]
    .find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic buck primary profile ${profileId}`);
  return profile;
}

function integratedProfile(profileId: string): IntegratedRegulatorProfile {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.integratedRegulators.find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic integrated regulator profile ${profileId}`);
  return profile;
}

function controllerProfile(profileId: string): ExternalControllerProfile {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.externalControllers.find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic external controller profile ${profileId}`);
  return profile;
}

function mosfetProfile(profileId: string): PowerMosfetProfile {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.mosfets.find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic MOSFET profile ${profileId}`);
  return profile;
}

function inductorProfile(profileId: string): InductorProfile {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.inductors.find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic inductor profile ${profileId}`);
  return profile;
}

function capacitorProfile(profileId: string): CapacitorProfile {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.capacitors.find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic capacitor profile ${profileId}`);
  return profile;
}

function resistorProfile(profileId: string): ResistorProfile {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.resistors.find((entry) => entry.profileId === profileId);
  if (!profile) throw new Error(`Unknown synthetic resistor profile ${profileId}`);
  return profile;
}

function effectiveCapacitance(profile: CapacitorProfile): { value: number; state: "calculated" | "estimated" } {
  if (profile.effectiveCapacitanceF !== null) return { value: profile.effectiveCapacitanceF, state: "calculated" };
  if (profile.estimatedBiasDeratingRatio === null) throw new Error(`Capacitor ${profile.profileId} has neither effective capacitance nor an explicit fixture derating`);
  return { value: profile.nominalCapacitanceF * profile.estimatedBiasDeratingRatio, state: "estimated" };
}

function selectedComponent(
  id: string,
  role: string,
  profile: { profileId: string; part: SelectedComponent["part"]; evidence: EvidenceRef[] },
  value?: Quantity,
): SelectedComponent {
  return {
    id,
    role,
    profileId: profile.profileId,
    part: profile.part,
    quantityPerAssembly: 1,
    ...(value === undefined ? {} : { value }),
    evidence: profile.evidence,
  };
}

function primaryPredicateConstraints(
  profile: BuckPrimaryProfile,
  requirements: BuckRequirements,
  switchingFrequencyHz: number,
): ConstraintResult[] {
  const evidence = [...profile.evidence, BUCK_EQUATION_EVIDENCE];
  return [
    constraintAtLeast("buck.device.input-minimum", requirements.inputVoltage.minimum.value, profile.inputVoltageMinV, "V", "Minimum requested input must remain inside the device operating range.", evidence),
    constraintAtMost("buck.device.input-maximum", requirements.inputVoltage.maximum.value, profile.inputVoltageMaxV, "V", "Maximum requested input must remain inside the device operating range.", evidence),
    constraintAtLeast("buck.device.output-minimum", requirements.outputVoltage.value, profile.outputVoltageMinV, "V", "Requested output must be no lower than the device output range.", evidence),
    constraintAtMost("buck.device.output-maximum", requirements.outputVoltage.value, profile.outputVoltageMaxV, "V", "Requested output must be no higher than the device output range.", evidence),
    constraintAtMost("buck.device.output-current", requirements.maximumOutputCurrent.value, profile.outputCurrentMaxA, "A", "Maximum output current must not exceed the device continuous fixture rating.", evidence),
    constraintAtLeast("buck.device.switching-frequency-minimum", switchingFrequencyHz, profile.switchingFrequencyMinHz, "Hz", "Selected switching frequency must be within the device range.", evidence),
    constraintAtMost("buck.device.switching-frequency-maximum", switchingFrequencyHz, profile.switchingFrequencyMaxHz, "Hz", "Selected switching frequency must be within the device range.", evidence),
  ];
}

function selectInductor(targetH: number, targetPeakA: number, targetRmsA: number): InductorProfile | undefined {
  return [...SYNTHETIC_BUCK_TEST_CATALOG.inductors]
    .filter((profile) => profile.inductanceH / targetH >= INDUCTOR_MATCH_MINIMUM_RATIO)
    .filter((profile) => profile.inductanceH / targetH <= INDUCTOR_MATCH_MAXIMUM_RATIO)
    .filter((profile) => profile.saturationCurrentA >= targetPeakA && profile.rmsCurrentA >= targetRmsA)
    .sort((left, right) => Math.abs(left.inductanceH / targetH - 1) - Math.abs(right.inductanceH / targetH - 1)
      || left.areaM2 - right.areaM2
      || left.profileId.localeCompare(right.profileId))[0];
}

function selectCapacitor(
  role: CapacitorProfile["role"],
  minimumCapacitanceF: number,
  minimumVoltageV: number,
  minimumRippleCurrentA: number,
): CapacitorProfile | undefined {
  return [...SYNTHETIC_BUCK_TEST_CATALOG.capacitors]
    .filter((profile) => profile.role === role)
    .filter((profile) => effectiveCapacitance(profile).value >= minimumCapacitanceF)
    .filter((profile) => profile.voltageRatingV >= minimumVoltageV)
    .filter((profile) => profile.rippleCurrentA >= minimumRippleCurrentA)
    .sort((left, right) => left.areaM2 - right.areaM2
      || effectiveCapacitance(left).value - effectiveCapacitance(right).value
      || left.profileId.localeCompare(right.profileId))[0];
}

function selectResistor(targetOhm: number): ResistorProfile {
  const profile = [...SYNTHETIC_BUCK_TEST_CATALOG.resistors]
    .sort((left, right) => Math.abs(left.resistanceOhm / targetOhm - 1) - Math.abs(right.resistanceOhm / targetOhm - 1)
      || left.profileId.localeCompare(right.profileId))[0];
  if (!profile) throw new Error("Synthetic resistor catalog is empty");
  return profile;
}

function matchPassives(
  solved: Readonly<SolvedOption>,
  requirements: BuckRequirements,
  profile: BuckPrimaryProfile,
): {
  inputCapacitor: CapacitorProfile;
  outputCapacitor: CapacitorProfile;
  inductor: InductorProfile;
  feedbackBottom: ResistorProfile;
  feedbackTop: ResistorProfile;
} | undefined {
  const targetRippleA = numberData(solved.data, "targetRippleCurrentA");
  const targetPeakA = requirements.maximumOutputCurrent.value + targetRippleA / 2;
  const targetRmsA = inductorRmsCurrent(requirements.maximumOutputCurrent.value, targetRippleA);
  const inductor = selectInductor(numberData(solved.data, "targetInductanceH"), targetPeakA, targetRmsA);
  const inputCapacitor = selectCapacitor(
    "input",
    numberData(solved.data, "targetInputCapacitanceF"),
    requirements.inputVoltage.maximum.value * CAPACITOR_VOLTAGE_HEADROOM_RATIO,
    numberData(solved.data, "inputCapacitorRmsCurrentA"),
  );
  const outputCapacitor = selectCapacitor(
    "output",
    numberData(solved.data, "targetOutputCapacitanceF"),
    requirements.outputVoltage.value * CAPACITOR_VOLTAGE_HEADROOM_RATIO,
    targetRippleA / Math.sqrt(12),
  );
  if (!inductor || !inputCapacitor || !outputCapacitor) return undefined;
  const feedbackBottom = selectResistor(numberData(solved.data, "feedbackBottomResistanceOhm"));
  const feedbackTopTarget = feedbackBottom.resistanceOhm * (requirements.outputVoltage.value / profile.feedbackReferenceV - 1);
  return {
    inputCapacitor,
    outputCapacitor,
    inductor,
    feedbackBottom,
    feedbackTop: selectResistor(feedbackTopTarget),
  };
}

function passiveMatchRejection(profile: BuckPrimaryProfile, solved: Readonly<SolvedOption>): StageOutcome<MatchedOption> {
  return {
    status: "rejected",
    reason: "No deterministic synthetic passive set satisfies the named inductance, effective-capacitance, voltage, and ripple-current tolerances",
    constraints: [{
      ruleId: "buck.passive-match",
      status: "fail",
      explanation: `No passive fixture set matched ${profile.profileId} at ${numberData(solved.data, "switchingFrequencyHz")} Hz`,
      evidence: [BUCK_EQUATION_EVIDENCE, SYNTHETIC_CATALOG_EVIDENCE],
    }],
    componentProfileIds: [profile.profileId],
  };
}

function matchedValue(
  solved: Readonly<SolvedOption>,
  profile: BuckPrimaryProfile,
  passives: NonNullable<ReturnType<typeof matchPassives>>,
  mosfet?: PowerMosfetProfile,
): MatchedOption {
  const outputEffective = effectiveCapacitance(passives.outputCapacitor);
  const switchingFrequencyHz = numberData(solved.data, "switchingFrequencyHz");
  const requestOutputCurrentA = numberData(solved.data, "outputCurrentA");
  const rippleCurrentA = inductorRippleCurrent(
    numberData(solved.data, "outputVoltageV"),
    numberData(solved.data, "inputVoltageMaxV"),
    switchingFrequencyHz,
    passives.inductor.inductanceH,
  );
  const actualOutputRippleV = outputRippleVoltage(
    rippleCurrentA,
    switchingFrequencyHz,
    outputEffective.value,
    passives.outputCapacitor.esrOhm,
  );
  const actualFeedbackOutputV = feedbackOutputVoltage(
    profile.feedbackReferenceV,
    passives.feedbackTop.resistanceOhm,
    passives.feedbackBottom.resistanceOhm,
  );
  const derivedValues: DerivedValue[] = [
    ...solved.derivedValues,
    {
      id: "buck.inductor.selected",
      value: quantity(passives.inductor.inductanceH, "H"),
      equationId: "buck.match.inductor-nearest-within-tolerance-v1",
      state: "calculated",
      evidence: [...passives.inductor.evidence, BUCK_EQUATION_EVIDENCE],
    },
    {
      id: "buck.inductor.ripple-current",
      value: quantity(rippleCurrentA, "A"),
      equationId: BUCK_EQUATION_IDS.inductorRipple,
      state: "calculated",
      evidence: [BUCK_EQUATION_EVIDENCE],
    },
    {
      id: "buck.inductor.peak-current",
      value: quantity(requestOutputCurrentA + rippleCurrentA / 2, "A"),
      equationId: BUCK_EQUATION_IDS.inductorPeak,
      state: "calculated",
      evidence: [BUCK_EQUATION_EVIDENCE],
    },
    {
      id: "buck.output-capacitor.effective-capacitance",
      value: quantity(outputEffective.value, "F"),
      equationId: outputEffective.state === "estimated" ? "buck.capacitor.synthetic-bias-derating-v1" : "buck.capacitor.profile-effective-at-bias-v1",
      state: outputEffective.state,
      evidence: passives.outputCapacitor.evidence,
    },
    {
      id: "buck.output-ripple",
      value: quantity(actualOutputRippleV, "V"),
      equationId: BUCK_EQUATION_IDS.outputRipple,
      state: outputEffective.state,
      evidence: [...passives.outputCapacitor.evidence, BUCK_EQUATION_EVIDENCE],
    },
    {
      id: "buck.feedback.actual-output-voltage",
      value: quantity(actualFeedbackOutputV, "V"),
      equationId: BUCK_EQUATION_IDS.feedbackDivider,
      state: "calculated",
      evidence: [...passives.feedbackTop.evidence, ...passives.feedbackBottom.evidence, BUCK_EQUATION_EVIDENCE],
    },
  ];
  const components: SelectedComponent[] = [
    selectedComponent(profile.topology === "integrated" ? "regulator" : "controller", profile.topology === "integrated" ? "power.regulator" : "power.controller", profile),
    selectedComponent("inductor", "power.inductor", passives.inductor, quantity(passives.inductor.inductanceH, "H")),
    selectedComponent("input-capacitor", "power.input-capacitor", passives.inputCapacitor, quantity(passives.inputCapacitor.nominalCapacitanceF, "F")),
    selectedComponent("output-capacitor", "power.output-capacitor", passives.outputCapacitor, quantity(passives.outputCapacitor.nominalCapacitanceF, "F")),
    selectedComponent("feedback-upper", "power.feedback-upper", passives.feedbackTop, quantity(passives.feedbackTop.resistanceOhm, "ohm")),
    selectedComponent("feedback-lower", "power.feedback-lower", passives.feedbackBottom, quantity(passives.feedbackBottom.resistanceOhm, "ohm")),
  ];
  if (mosfet) {
    components.push(
      selectedComponent("high-side-mosfet", "power.high-side-mosfet", mosfet),
      selectedComponent("low-side-mosfet", "power.low-side-mosfet", mosfet),
    );
  }
  const warnings = [
    "Synthetic test-only component profiles are not real orderable parts and are not reviewed production evidence.",
    "Analytic estimates use a simplified loss and single-resistance thermal model; bench validation remains required.",
    profile.topology === "integrated"
      ? "The editable circuit decomposes the integrated regulator into generic internal switches and behavioral gate drive; it is not a physical IC model."
      : "The editable circuit represents the selected controller only through behavioral gate-drive sources; it is not a physical controller IC model.",
  ];
  if (outputEffective.state === "estimated") {
    warnings.push("Selected output capacitor has nominal capacitance only; effective capacitance uses the profile's explicit synthetic fixture derating and is estimated.");
  }
  return {
    ...solved,
    data: {
      ...solved.data,
      primaryProfileId: profile.profileId,
      mosfetProfileId: mosfet?.profileId ?? "",
      inductorProfileId: passives.inductor.profileId,
      inputCapacitorProfileId: passives.inputCapacitor.profileId,
      outputCapacitorProfileId: passives.outputCapacitor.profileId,
      feedbackTopProfileId: passives.feedbackTop.profileId,
      feedbackBottomProfileId: passives.feedbackBottom.profileId,
      outputCapacitorEffectiveF: outputEffective.value,
      outputCapacitorEffectiveState: outputEffective.state,
      inductorRippleCurrentA: rippleCurrentA,
      outputRippleV: actualOutputRippleV,
      feedbackActualOutputV: actualFeedbackOutputV,
    },
    derivedValues,
    components,
    simulationCoverage: buckSimulationCoverage(),
    warnings,
  };
}

function integratedMatch(solved: Readonly<SolvedOption>, environment: RecipeEnvironment): readonly StageOutcome<MatchedOption>[] {
  const request = buckRequest(environment);
  const profile = integratedProfile(stringData(solved.data, "primaryProfileId"));
  const predicate = primaryPredicateConstraints(profile, request.requirements, numberData(solved.data, "switchingFrequencyHz"));
  if (predicate.some((entry) => entry.status === "fail")) {
    return [{
      status: "rejected",
      reason: "Synthetic integrated regulator is outside the requested voltage, current, or frequency envelope",
      constraints: predicate,
      componentProfileIds: [profile.profileId],
    }];
  }
  const passives = matchPassives(solved, request.requirements, profile);
  if (!passives) return [passiveMatchRejection(profile, solved)];
  return [{ status: "ok", value: matchedValue(solved, profile, passives) }];
}

function externalMatch(solved: Readonly<SolvedOption>, environment: RecipeEnvironment): readonly StageOutcome<MatchedOption>[] {
  const request = buckRequest(environment);
  const profile = controllerProfile(stringData(solved.data, "primaryProfileId"));
  const predicate = primaryPredicateConstraints(profile, request.requirements, numberData(solved.data, "switchingFrequencyHz"));
  if (predicate.some((entry) => entry.status === "fail")) {
    return [{
      status: "rejected",
      reason: "Synthetic external-FET controller is outside the requested voltage, current, or frequency envelope",
      constraints: predicate,
      componentProfileIds: [profile.profileId],
    }];
  }
  const passives = matchPassives(solved, request.requirements, profile);
  if (!passives) return [passiveMatchRejection(profile, solved)];
  const peakCurrentA = request.requirements.maximumOutputCurrent.value + numberData(solved.data, "targetRippleCurrentA") / 2;
  return [...SYNTHETIC_BUCK_TEST_CATALOG.mosfets]
    .sort((left, right) => left.profileId.localeCompare(right.profileId))
    .map((mosfet): StageOutcome<MatchedOption> => {
      const evidence = [...mosfet.evidence, ...profile.evidence, BUCK_EQUATION_EVIDENCE];
      const constraints = [
        constraintAtLeast("buck.mosfet.voltage-headroom", mosfet.drainSourceVoltageV, request.requirements.inputVoltage.maximum.value * PRIMARY_VOLTAGE_HEADROOM_RATIO, "V", "External MOSFET VDS rating must include the named 20% fixture headroom over maximum input.", evidence),
        constraintAtLeast("buck.mosfet.current", mosfet.continuousCurrentA, peakCurrentA, "A", "External MOSFET continuous fixture current must exceed calculated peak inductor current.", evidence),
        constraintAtLeast("buck.mosfet.gate-drive-voltage", profile.gateDriveVoltageV, mosfet.resistanceGateVoltageV, "V", "Controller gate-drive voltage must reach the voltage at which the synthetic RDS(on) fact is stated.", evidence),
      ];
      if (constraints.some((entry) => entry.status === "fail")) {
        return {
          status: "rejected",
          reason: "Synthetic external MOSFET fails voltage, current, or gate-drive matching",
          constraints,
          componentProfileIds: [profile.profileId, mosfet.profileId],
        };
      }
      return { status: "ok", value: matchedValue(solved, profile, passives, mosfet) };
    });
}

function estimateOperating(option: Readonly<MatchedOption>, environment: RecipeEnvironment): OperatingEstimate {
  const request = buckRequest(environment);
  const requirements = request.requirements;
  const primary = primaryProfile(stringData(option.data, "primaryProfileId"));
  const inductor = inductorProfile(stringData(option.data, "inductorProfileId"));
  const inputCapacitor = capacitorProfile(stringData(option.data, "inputCapacitorProfileId"));
  const outputCapacitor = capacitorProfile(stringData(option.data, "outputCapacitorProfileId"));
  const feedbackTop = resistorProfile(stringData(option.data, "feedbackTopProfileId"));
  const feedbackBottom = resistorProfile(stringData(option.data, "feedbackBottomProfileId"));
  const switchingFrequencyHz = numberData(option.data, "switchingFrequencyHz");
  const duty = numberData(option.data, "dutyAtNominalInput");
  const rippleCurrentA = numberData(option.data, "inductorRippleCurrentA");
  const outputCurrentA = requirements.maximumOutputCurrent.value;
  const currentSquared = outputCurrentA ** 2 + rippleCurrentA ** 2 / 12;
  const inductorRmsA = Math.sqrt(currentSquared);
  const inputCapacitorRmsA = numberData(option.data, "inputCapacitorRmsCurrentA");
  let conductionLossW: number;
  let switchingLossW: number;
  let gateDriveLossW = 0;
  let controllerOrQuiescentLossW: number;
  let semiconductorAreaM2 = primary.areaM2;
  let hottestJunctionTemperatureK: number;
  if (primary.topology === "integrated") {
    const regulator = integratedProfile(primary.profileId);
    conductionLossW = currentSquared * (duty * regulator.highSideResistanceOhm + (1 - duty) * regulator.lowSideResistanceOhm);
    switchingLossW = 0.5 * requirements.inputVoltage.nominal.value * outputCurrentA
      * (regulator.riseTimeS + regulator.fallTimeS) * switchingFrequencyHz;
    controllerOrQuiescentLossW = requirements.inputVoltage.nominal.value * regulator.quiescentCurrentA;
    const regulatorLossW = conductionLossW + switchingLossW + controllerOrQuiescentLossW;
    hottestJunctionTemperatureK = requirements.ambientTemperature.value + regulatorLossW * regulator.thermalResistanceKPerW;
  } else {
    const controller = controllerProfile(primary.profileId);
    const mosfet = mosfetProfile(stringData(option.data, "mosfetProfileId"));
    conductionLossW = currentSquared * mosfet.resistanceOhm;
    switchingLossW = 0.5 * requirements.inputVoltage.nominal.value * outputCurrentA
      * (mosfet.riseTimeS + mosfet.fallTimeS) * switchingFrequencyHz;
    gateDriveLossW = 2 * mosfet.totalGateChargeC * controller.gateDriveVoltageV * switchingFrequencyHz;
    controllerOrQuiescentLossW = controller.controllerLossW + requirements.inputVoltage.nominal.value * controller.quiescentCurrentA;
    const highSideLossW = currentSquared * mosfet.resistanceOhm * duty + switchingLossW;
    const lowSideLossW = currentSquared * mosfet.resistanceOhm * (1 - duty);
    const hottestFetK = requirements.ambientTemperature.value + Math.max(highSideLossW, lowSideLossW) * mosfet.thermalResistanceKPerW;
    const controllerK = requirements.ambientTemperature.value
      + (controllerOrQuiescentLossW + gateDriveLossW) * controller.thermalResistanceKPerW;
    hottestJunctionTemperatureK = Math.max(hottestFetK, controllerK);
    semiconductorAreaM2 += 2 * mosfet.areaM2;
  }
  const inductorCopperLossW = currentSquared * inductor.dcResistanceOhm;
  const inductorCoreLossW = inductor.coreLossWAtFixturePoint;
  const capacitorLossW = inputCapacitorRmsA ** 2 * inputCapacitor.esrOhm
    + (rippleCurrentA / Math.sqrt(12)) ** 2 * outputCapacitor.esrOhm;
  const feedbackLossW = requirements.outputVoltage.value ** 2 / (feedbackTop.resistanceOhm + feedbackBottom.resistanceOhm);
  const totalLossW = conductionLossW + switchingLossW + gateDriveLossW + controllerOrQuiescentLossW
    + inductorCopperLossW + (inductorCoreLossW ?? 0) + capacitorLossW + feedbackLossW;
  const outputPowerW = requirements.outputVoltage.value * outputCurrentA;
  const outputEffectiveState = stringData(option.data, "outputCapacitorEffectiveState");
  if (outputEffectiveState !== "calculated" && outputEffectiveState !== "estimated") throw new Error("Invalid output-capacitor evidence state");
  return {
    boardAreaM2: semiconductorAreaM2 + inductor.areaM2 + inputCapacitor.areaM2 + outputCapacitor.areaM2 + feedbackTop.areaM2 + feedbackBottom.areaM2,
    capacitorLossW,
    conductionLossW,
    controllerOrQuiescentLossW,
    efficiencyRatio: outputPowerW / (outputPowerW + totalLossW),
    feedbackLossW,
    gateDriveLossW,
    hottestJunctionTemperatureK,
    inductorCopperLossW,
    inductorCoreLossW,
    inductorPeakCurrentA: outputCurrentA + rippleCurrentA / 2,
    inductorRippleCurrentA: rippleCurrentA,
    inductorRmsCurrentA: inductorRmsA,
    inputCapacitorRmsCurrentA: inputCapacitorRmsA,
    outputCapacitorEffectiveF: numberData(option.data, "outputCapacitorEffectiveF"),
    outputCapacitorEffectiveState: outputEffectiveState,
    outputRippleV: numberData(option.data, "outputRippleV"),
    switchingLossW,
    totalLossW,
  };
}

function checkMatched(option: Readonly<MatchedOption>, environment: RecipeEnvironment): readonly ConstraintResult[] {
  const request = buckRequest(environment);
  const requirements = request.requirements;
  const primary = primaryProfile(stringData(option.data, "primaryProfileId"));
  const inductor = inductorProfile(stringData(option.data, "inductorProfileId"));
  const inputCapacitor = capacitorProfile(stringData(option.data, "inputCapacitorProfileId"));
  const outputCapacitor = capacitorProfile(stringData(option.data, "outputCapacitorProfileId"));
  const feedbackTop = resistorProfile(stringData(option.data, "feedbackTopProfileId"));
  const feedbackBottom = resistorProfile(stringData(option.data, "feedbackBottomProfileId"));
  const operating = estimateOperating(option, environment);
  const switchingFrequencyHz = numberData(option.data, "switchingFrequencyHz");
  const commonEvidence = [...primary.evidence, BUCK_EQUATION_EVIDENCE];
  const feedbackError = Math.abs(numberData(option.data, "feedbackActualOutputV") / requirements.outputVoltage.value - 1);
  const thermalLimitK = Math.min(request.constraints.maximumJunctionTemperature.value, primary.maximumJunctionTemperatureK);
  const constraints: ConstraintResult[] = [
    ...primaryPredicateConstraints(primary, requirements, switchingFrequencyHz),
    constraintAtLeast("buck.minimum-on-time", numberData(option.data, "minimumOnTimeAtMaximumInputS"), primary.minimumOnTimeS, "s", "Calculated worst-case on-time must meet the primary device minimum on-time.", commonEvidence),
    constraintAtLeast("buck.minimum-off-time", numberData(option.data, "minimumOffTimeAtMinimumInputS"), primary.minimumOffTimeS, "s", "Calculated worst-case off-time must meet the primary device minimum off-time.", commonEvidence),
    constraintAtMost("buck.current-limit", operating.inductorPeakCurrentA, primary.currentLimitA, "A", "Calculated peak inductor current must remain below the synthetic primary current limit.", commonEvidence),
    constraintAtMost("buck.inductor.saturation-current", operating.inductorPeakCurrentA, inductor.saturationCurrentA, "A", "Peak inductor current must remain below the synthetic saturation-current fixture limit.", [...inductor.evidence, BUCK_EQUATION_EVIDENCE]),
    constraintAtMost("buck.inductor.rms-current", operating.inductorRmsCurrentA, inductor.rmsCurrentA, "A", "Inductor RMS current must remain below the synthetic RMS fixture limit.", [...inductor.evidence, BUCK_EQUATION_EVIDENCE]),
    constraintAtMost("buck.input-capacitor.ripple-current", operating.inputCapacitorRmsCurrentA, inputCapacitor.rippleCurrentA, "A", "Input-capacitor RMS current must remain below the fixture rating.", inputCapacitor.evidence),
    constraintAtLeast("buck.input-capacitor.voltage", inputCapacitor.voltageRatingV, requirements.inputVoltage.maximum.value * CAPACITOR_VOLTAGE_HEADROOM_RATIO, "V", "Input-capacitor voltage rating must include the named 25% fixture headroom.", inputCapacitor.evidence),
    constraintAtLeast("buck.output-capacitor.voltage", outputCapacitor.voltageRatingV, requirements.outputVoltage.value * CAPACITOR_VOLTAGE_HEADROOM_RATIO, "V", "Output-capacitor voltage rating must include the named 25% fixture headroom.", outputCapacitor.evidence),
    constraintAtMost("buck.output-ripple", operating.outputRippleV, requirements.maximumOutputRipple.value, "V", "Calculated capacitive-plus-ESR output ripple must not exceed the request.", [...outputCapacitor.evidence, BUCK_EQUATION_EVIDENCE]),
    constraintAtMost("buck.feedback.accuracy", feedbackError, FEEDBACK_ACCURACY_LIMIT_RATIO, "1", "Matched feedback-divider error must remain within the named 2% fixture tolerance.", [...feedbackTop.evidence, ...feedbackBottom.evidence, BUCK_EQUATION_EVIDENCE]),
    constraintAtMost("buck.loss.less-than-output-power", operating.totalLossW, requirements.outputVoltage.value * requirements.maximumOutputCurrent.value, "W", "The bounded synthetic loss estimate must remain below delivered output power.", [BUCK_EQUATION_EVIDENCE, ...primary.evidence]),
    constraintAtMost("buck.thermal.maximum-junction", operating.hottestJunctionTemperatureK, thermalLimitK, "K", "Estimated hottest junction must remain below both the user ceiling and the synthetic profile limit.", [BUCK_EQUATION_EVIDENCE, ...primary.evidence]),
  ];
  constraints.push({
    ruleId: "buck.output-capacitor.effective-capacitance-confidence",
    status: operating.outputCapacitorEffectiveState === "calculated" ? "pass" : "warning",
    actual: quantity(operating.outputCapacitorEffectiveF, "F"),
    explanation: operating.outputCapacitorEffectiveState === "calculated"
      ? "The synthetic fixture provides effective capacitance at the selected bias point."
      : "Only nominal capacitance is present; the visible synthetic fixture derating is an estimate, not measured bias evidence.",
    evidence: outputCapacitor.evidence,
  });
  constraints.push({
    ruleId: "buck.loss-model-confidence",
    status: "warning",
    actual: quantity(operating.totalLossW, "W"),
    explanation: "Losses use named first-order equations and synthetic fixture facts; layout, detailed switching waveforms, and frequency-dependent magnetic loss remain unverified.",
    evidence: [BUCK_EQUATION_EVIDENCE, ...primary.evidence],
  });
  constraints.push({
    ruleId: "buck.control-model-confidence",
    status: primary.controlEvidence === "synthetic_bounded_model" ? "warning" : "unknown",
    explanation: primary.controlEvidence === "synthetic_bounded_model"
      ? "The synthetic fixture bounds operating behavior only. Loop crossover and phase margin remain unavailable and no stability claim is made."
      : "No control-model evidence is present; the profile cannot make a loop-stability claim or pass a required control-confidence check.",
    evidence: primary.controlEvidence === "missing" ? [] : primary.evidence,
  });
  if (primary.topology === "external-controller") {
    const controller = controllerProfile(primary.profileId);
    const mosfet = mosfetProfile(stringData(option.data, "mosfetProfileId"));
    constraints.push(
      constraintAtLeast("buck.mosfet.voltage-headroom", mosfet.drainSourceVoltageV, requirements.inputVoltage.maximum.value * PRIMARY_VOLTAGE_HEADROOM_RATIO, "V", "External MOSFET VDS rating must include the named 20% fixture headroom.", [...mosfet.evidence, BUCK_EQUATION_EVIDENCE]),
      constraintAtLeast("buck.mosfet.gate-drive-voltage", controller.gateDriveVoltageV, mosfet.resistanceGateVoltageV, "V", "Controller gate drive must reach the voltage used for the synthetic RDS(on) fact.", [...controller.evidence, ...mosfet.evidence]),
    );
  }
  return constraints;
}

function metric(
  id: string,
  value: Quantity | null,
  state: CandidateMetric["state"],
  explanation: string,
  evidence: EvidenceRef[],
): CandidateMetric {
  return { id, value, state, explanation, evidence };
}

function estimateMatched(option: Readonly<MatchedOption>, environment: RecipeEnvironment): CandidateEstimate {
  const operating = estimateOperating(option, environment);
  const evidence = [BUCK_EQUATION_EVIDENCE, SYNTHETIC_CATALOG_EVIDENCE];
  const metrics: CandidateMetric[] = [
    metric("power.efficiency", quantity(operating.efficiencyRatio, "1", "%"), "estimated", "Output power divided by output power plus the named loss components.", evidence),
    metric("power.total-loss", quantity(operating.totalLossW, "W"), "estimated", "Sum of conduction, switching, drive/quiescent, magnetic, capacitor, and feedback losses.", evidence),
    metric("power.conduction-loss", quantity(operating.conductionLossW, "W"), "estimated", "Semiconductor conduction loss at maximum requested load.", evidence),
    metric("power.switching-loss", quantity(operating.switchingLossW, "W"), "estimated", "First-order voltage-current-overlap switching loss.", evidence),
    metric("power.gate-drive-loss", quantity(operating.gateDriveLossW, "W"), "estimated", "External-FET gate-charge loss; zero for the integrated fixture model.", evidence),
    metric("power.controller-or-quiescent-loss", quantity(operating.controllerOrQuiescentLossW, "W"), "estimated", "Controller loss or integrated-regulator input quiescent loss.", evidence),
    metric("power.inductor-copper-loss", quantity(operating.inductorCopperLossW, "W"), "estimated", "Inductor RMS current squared times synthetic DCR.", evidence),
    metric("power.inductor-core-loss", operating.inductorCoreLossW === null ? null : quantity(operating.inductorCoreLossW, "W"), operating.inductorCoreLossW === null ? "unknown" : "estimated", "Synthetic fixture-point core loss; unavailable when the profile omits it.", operating.inductorCoreLossW === null ? [] : evidence),
    metric("power.capacitor-loss", quantity(operating.capacitorLossW, "W"), "estimated", "Input and output capacitor RMS-current ESR loss.", evidence),
    metric("power.feedback-loss", quantity(operating.feedbackLossW, "W"), "calculated", "Output voltage squared divided by total feedback resistance.", evidence),
    metric("power.output-ripple", quantity(operating.outputRippleV, "V"), operating.outputCapacitorEffectiveState, "Capacitive ripple plus ESR ripple at the matched effective capacitance.", evidence),
    metric("power.inductor-ripple-current", quantity(operating.inductorRippleCurrentA, "A"), "calculated", "Matched-inductor ripple at maximum input voltage.", evidence),
    metric("power.hottest-junction-temperature", quantity(operating.hottestJunctionTemperatureK, "K"), "estimated", "Ambient plus first-order device loss times the synthetic thermal resistance.", evidence),
    metric("power.board-area", quantity(operating.boardAreaM2, "m2"), "estimated", "Sum of synthetic package-area proxies for selected components.", evidence),
    metric("power.bom-line-count", quantity(option.components.length, "count"), "calculated", "Number of selected analytic BOM lines.", [SYNTHETIC_CATALOG_EVIDENCE]),
    metric("power.loop-phase-margin", null, "unknown", "Unavailable: the synthetic fixture has no sufficient control model and makes no loop-stability claim.", []),
  ];
  return { metrics, warnings: [] };
}

function solveOption(option: { optionKey: string; data: JsonObject }, environment: RecipeEnvironment): StageOutcome<SolvedOption> {
  const request = buckRequest(environment);
  const profile = primaryProfile(stringData(option.data, "primaryProfileId"));
  const requirements = request.requirements;
  const selectedFrequencyHz = selectSwitchingFrequency(
    requirements.switchingFrequency.minimum.value,
    requirements.switchingFrequency.preferred?.value ?? null,
    requirements.switchingFrequency.maximum.value,
    profile.switchingFrequencyMinHz,
    profile.switchingFrequencyRecommendedHz,
    profile.switchingFrequencyMaxHz,
  );
  const sizing = solveIdealBuck({
    inputVoltageMinV: requirements.inputVoltage.minimum.value,
    inputVoltageNominalV: requirements.inputVoltage.nominal.value,
    inputVoltageMaxV: requirements.inputVoltage.maximum.value,
    outputVoltageV: requirements.outputVoltage.value,
    outputCurrentA: requirements.maximumOutputCurrent.value,
    switchingFrequencyHz: selectedFrequencyHz,
    maximumOutputRippleV: requirements.maximumOutputRipple.value,
  });
  const derivedValues: DerivedValue[] = [
    { id: "buck.switching-frequency", value: quantity(selectedFrequencyHz, "Hz"), equationId: BUCK_EQUATION_IDS.switchingFrequency, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE, ...profile.evidence] },
    { id: "buck.duty-cycle.nominal", value: quantity(sizing.dutyAtNominalInput, "1"), equationId: BUCK_EQUATION_IDS.dutyCycle, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
    { id: "buck.inductor.target", value: quantity(sizing.targetInductanceH, "H"), equationId: BUCK_EQUATION_IDS.inductorTarget, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
    { id: "buck.inductor.target-ripple-current", value: quantity(sizing.targetRippleCurrentA, "A"), equationId: BUCK_EQUATION_IDS.inductorTarget, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
    { id: "buck.input-capacitor.target", value: quantity(sizing.targetInputCapacitanceF, "F"), equationId: BUCK_EQUATION_IDS.inputCapacitance, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
    { id: "buck.output-capacitor.target", value: quantity(sizing.targetOutputCapacitanceF, "F"), equationId: BUCK_EQUATION_IDS.outputCapacitance, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
    { id: "buck.minimum-on-time-at-maximum-input", value: quantity(sizing.minimumOnTimeAtMaximumInputS, "s"), equationId: BUCK_EQUATION_IDS.dutyCycle, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
    { id: "buck.minimum-off-time-at-minimum-input", value: quantity(sizing.minimumOffTimeAtMinimumInputS, "s"), equationId: BUCK_EQUATION_IDS.dutyCycle, state: "calculated", evidence: [BUCK_EQUATION_EVIDENCE] },
  ];
  return {
    status: "ok",
    value: {
      ...option,
      data: {
        ...option.data,
        switchingFrequencyHz: selectedFrequencyHz,
        inputVoltageMaxV: requirements.inputVoltage.maximum.value,
        outputVoltageV: requirements.outputVoltage.value,
        outputCurrentA: requirements.maximumOutputCurrent.value,
        dutyAtMinimumInput: sizing.dutyAtMinimumInput,
        dutyAtNominalInput: sizing.dutyAtNominalInput,
        dutyAtMaximumInput: sizing.dutyAtMaximumInput,
        targetRippleCurrentA: sizing.targetRippleCurrentA,
        targetInductanceH: sizing.targetInductanceH,
        targetInputCapacitanceF: sizing.targetInputCapacitanceF,
        targetOutputCapacitanceF: sizing.targetOutputCapacitanceF,
        inputCapacitorRmsCurrentA: sizing.inputCapacitorRmsCurrentA,
        minimumOnTimeAtMaximumInputS: sizing.minimumOnTimeAtMaximumInputS,
        minimumOffTimeAtMinimumInputS: sizing.minimumOffTimeAtMinimumInputS,
        feedbackBottomResistanceOhm: sizing.feedbackBottomResistanceOhm,
      },
      derivedValues,
    },
  };
}

function createRecipe(topology: "integrated" | "external-controller"): DesignRecipe {
  const isIntegrated = topology === "integrated";
  const id = isIntegrated
    ? "schemagic.power.buck.integrated-synchronous.v1"
    : "schemagic.power.buck.controller-external-nmos.v1";
  const topologyFamily = isIntegrated
    ? "power.buck.integrated-synchronous"
    : "power.buck.controller-external-nmos";
  const profiles = isIntegrated
    ? SYNTHETIC_BUCK_TEST_CATALOG.integratedRegulators
    : SYNTHETIC_BUCK_TEST_CATALOG.externalControllers;
  const recipe: DesignRecipe = {
    id,
    version: "1.0.0-b1-synthetic",
    contentHash: contentHash({ id, topology, catalogVersion: SYNTHETIC_BUCK_TEST_CATALOG.version, equations: BUCK_EQUATION_IDS }),
    supports: (request) => request.application === "power.buck"
      && request.constraints.allowedTopologyFamilies.includes(topologyFamily),
    enumerate: () => [...profiles]
      .sort((left, right) => left.profileId.localeCompare(right.profileId))
      .map((profile) => ({
        optionKey: `${topology}:${profile.profileId}`,
        data: { primaryProfileId: profile.profileId, topology },
      })),
    solve: solveOption,
    match: isIntegrated ? integratedMatch : externalMatch,
    check: checkMatched,
    estimate: (option, _constraints, environment) => estimateMatched(option, environment),
    materialize: materializeBuckCircuit,
  };
  return Object.freeze(recipe);
}

export const INTEGRATED_SYNCHRONOUS_BUCK_RECIPE = createRecipe("integrated");
export const EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE = createRecipe("external-controller");
export const BUCK_RECIPES: readonly DesignRecipe[] = Object.freeze([
  INTEGRATED_SYNCHRONOUS_BUCK_RECIPE,
  EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE,
]);

export const TRACK_B1_EVIDENCE = Object.freeze([
  BUCK_EQUATION_EVIDENCE,
  SYNTHETIC_CATALOG_EVIDENCE,
  B1_PLACEHOLDER_EVIDENCE,
]);
