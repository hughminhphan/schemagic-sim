import {
  contentHash,
  type CandidateEstimate,
  type DesignRecipe,
  type ElectricalDesignRequest,
  type EnumeratedOption,
  type MatchedOption,
  type SolvedOption,
  type StageOutcome,
} from "@opencircuit/design-engine";
import type {
  BrushedDcMotorDesignRequest,
  CandidateMetric,
  ConstraintResult,
  DerivedValue,
  EvidenceRef,
  SelectedComponent,
  SimulationCoverage,
} from "@opencircuit/design-schema";
import {
  MOTOR_EQUATION_IDS,
  authoredConstraint,
  externalLosses,
  gateTransitionTimeS,
  integratedLosses,
  lossMetrics,
  maximumConstraint,
  minimumConstraint,
  quantity,
  requiredBootstrapCapacitanceF,
  requiredBulkCapacitanceF,
} from "./analysis";
import { MOTOR_CATALOG_CONTENT_HASH, SYNTHETIC_MOTOR_CATALOG, motorProfileById } from "./catalog";
import { AUTHORED_MOTOR_RULE_EVIDENCE, combinedEvidence, requestEvidence } from "./evidence";
import { materializeBehavioralMotorCircuit } from "./materialize";
import { deriveBehavioralMotorLoad } from "./motor-load";
import type {
  CapacitorProfile,
  MotorComponentProfile,
  ResistorProfile,
  ShuntProfile,
} from "./profile";

const RECIPE_VERSION = "1";
const VOLTAGE_TRANSIENT_MARGIN = 1.2;

function motorRequest(request: Readonly<ElectricalDesignRequest>): Readonly<BrushedDcMotorDesignRequest> {
  if (request.application !== "motor.brushed-dc") throw new Error("Motor recipe received a non-motor request");
  return request as BrushedDcMotorDesignRequest;
}

function stringField(data: EnumeratedOption["data"], key: string): string {
  const value = data[key];
  if (typeof value !== "string") throw new Error(`Motor recipe data.${key} must be a string`);
  return value;
}

function profile<Kind extends MotorComponentProfile["kind"]>(id: string, kind: Kind): Extract<MotorComponentProfile, { kind: Kind }> {
  const value = motorProfileById(id);
  if (value.kind !== kind) throw new Error(`Expected ${id} to be ${kind}, received ${value.kind}`);
  return value as Extract<MotorComponentProfile, { kind: Kind }>;
}

function selected(
  profileValue: MotorComponentProfile,
  id: string,
  role: string,
  quantityPerAssembly: number,
  value?: SelectedComponent["value"],
): SelectedComponent {
  return {
    id,
    role,
    profileId: profileValue.id,
    part: profileValue.part,
    quantityPerAssembly,
    ...(value === undefined ? {} : { value }),
    evidence: profileValue.evidence,
  };
}

function selectCapacitor(role: CapacitorProfile["role"], minimumF: number, minimumVoltageV: number): CapacitorProfile | undefined {
  return SYNTHETIC_MOTOR_CATALOG.capacitors
    .filter((entry) => entry.role === role
      && entry.effectiveCapacitanceF + 1e-15 >= minimumF
      && entry.ratedVoltageV + 1e-12 >= minimumVoltageV)
    .sort((left, right) =>
      (left.effectiveCapacitanceF - minimumF) - (right.effectiveCapacitanceF - minimumF)
      || left.boardAreaM2 - right.boardAreaM2
      || left.id.localeCompare(right.id))[0];
}

function resistor(role: ResistorProfile["role"]): ResistorProfile {
  const result = SYNTHETIC_MOTOR_CATALOG.resistors.find((entry) => entry.role === role);
  if (!result) throw new Error(`Synthetic fixture catalog is missing ${role}`);
  return result;
}

function shunt(): ShuntProfile {
  const result = [...SYNTHETIC_MOTOR_CATALOG.shunts].sort((left, right) =>
    right.resistanceOhm - left.resistanceOhm || left.id.localeCompare(right.id))[0];
  if (!result) throw new Error("Synthetic fixture catalog is missing a shunt");
  return result;
}

function equationEvidence(locator: string): EvidenceRef[] {
  return combinedEvidence([AUTHORED_MOTOR_RULE_EVIDENCE], requestEvidence(locator));
}

function baseDerivedValues(request: Readonly<BrushedDcMotorDesignRequest>): DerivedValue[] {
  const requirements = request.requirements;
  const point = requirements.operatingPoint;
  const periodS = 1 / requirements.pwmFrequency.value;
  const resistanceState = requirements.motorModel.windingResistanceSource === "estimated_from_nominal_voltage_and_stall_current"
    ? "estimated" as const
    : "calculated" as const;
  const motorLoad = deriveBehavioralMotorLoad(request);
  const values: DerivedValue[] = [
    {
      id: "motor.operating-point.output-power",
      value: quantity(requirements.supplyVoltage.nominal.value * point.dutyCycle.value * point.loadCurrent.value, "W", "W"),
      equationId: MOTOR_EQUATION_IDS.outputPower,
      state: "calculated",
      evidence: equationEvidence("requirements.operatingPoint"),
    },
    {
      id: "motor.model.winding-resistance",
      value: requirements.motorModel.windingResistance,
      equationId: "motor.model.winding-resistance.request-v1",
      state: resistanceState,
      evidence: requestEvidence("requirements.motorModel.windingResistance"),
    },
    {
      id: "motor.pwm.period",
      value: quantity(periodS, "s", "µs"),
      equationId: "motor.pwm.period.v1",
      state: "calculated",
      evidence: equationEvidence("requirements.pwmFrequency"),
    },
    {
      id: "motor.pwm.minimum-commanded-pulse",
      value: quantity(periodS * Math.min(point.dutyCycle.value, 1 - point.dutyCycle.value), "s", "µs"),
      equationId: "motor.pwm.minimum-commanded-pulse.v1",
      state: "calculated",
      evidence: equationEvidence("requirements.operatingPoint.dutyCycle"),
    },
  ];
  if (motorLoad.operatingPointBackEmf.value !== null) {
    values.push({
      id: "motor.model.operating-point-back-emf",
      value: motorLoad.operatingPointBackEmf.value,
      equationId: motorLoad.operatingPointBackEmf.state === "estimated"
        ? "motor.behavioral.operating-point-closure.v1"
        : "motor.model.target-back-emf.v1",
      state: motorLoad.operatingPointBackEmf.state === "estimated" ? "estimated" : "calculated",
      evidence: motorLoad.operatingPointBackEmf.evidence,
    });
  }
  return values;
}

function simulationCoverage(request: Readonly<BrushedDcMotorDesignRequest>): SimulationCoverage[] {
  const motorLoad = deriveBehavioralMotorLoad(request);
  return [
    {
      scenarioId: "pwm_loaded_steady_state",
      modelTier: motorLoad.scenarioEligibility.pwmLoadedSteadyState ? "behavioral" : "unavailable",
      limitations: [
        "Explicitly averaged model: the bridge rail is nominal supply multiplied by declared duty cycle",
        "Four static ideal 1 mΩ/1 GΩ switches show one forward conduction state; PWM edges, dead time, switching loss and selected-part silicon are not simulated",
        motorLoad.operatingPointBackEmf.state === "estimated"
          ? "Back-EMF is an algebraic operating-point closure, not evidence for a motor constant"
          : "Back-EMF uses the request-provided Ke and target speed",
        "Behavioral netlist generation is tested; no native-ngspice/WASM numerical-validation claim is made",
      ],
    },
    {
      scenarioId: "startup",
      modelTier: "unavailable",
      limitations: [
        !motorLoad.dynamicInputsComplete
          ? "Winding inductance, back-EMF constant, or target speed is missing from the request"
          : "The frozen CircuitDocument cannot express speed-coupled back-EMF/torque dynamics",
        "The candidate carries one averaged operating-point circuit and no scenario-specific startup circuit/config",
      ],
    },
    {
      scenarioId: "stall_or_current_limit",
      modelTier: "unavailable",
      limitations: ["Static ideal switches do not express driver current-limit/protection behavior"],
    },
    {
      scenarioId: "fast_decay_brake",
      modelTier: "unavailable",
      limitations: ["The averaged static bridge does not express commutated braking or decay transients"],
    },
  ];
}

function warnings(request: Readonly<BrushedDcMotorDesignRequest>): string[] {
  const motorLoad = deriveBehavioralMotorLoad(request);
  const values = [
    "Synthetic fixture component profiles are not reviewed real parts and are not orderable",
    "Circuit is an averaged steady-state behavioral bridge with static ideal switches, not selected-part silicon or switching simulation",
  ];
  if (request.requirements.motorModel.windingResistanceSource === "estimated_from_nominal_voltage_and_stall_current") {
    values.push("Motor winding resistance is estimated from nominal voltage and stall current");
  }
  if (!motorLoad.dynamicInputsComplete) {
    values.push("Dynamic motor parameters are incomplete; startup and speed-dependent simulation are unavailable");
  } else if (!motorLoad.scenarioEligibility.startup) {
    values.push("Dynamic motor inputs are present, but startup remains unavailable because the frozen circuit cannot express speed-coupled back-EMF/torque dynamics");
  }
  if (motorLoad.operatingPointBackEmf.state === "estimated") {
    values.push("Behavioral back-EMF is an algebraic operating-point closure, not evidence for a physical motor constant");
  }
  return values;
}

function matchingRejection(recipeId: string, _option: Readonly<SolvedOption>, reason: string, profileIds: string[]): StageOutcome<MatchedOption> {
  return {
    status: "rejected",
    reason,
    componentProfileIds: profileIds,
    constraints: [authoredConstraint(`${recipeId}.component-match`, "fail", reason)],
  };
}

function estimatedValueConstraint(request: Readonly<BrushedDcMotorDesignRequest>): ConstraintResult {
  const estimated = request.requirements.motorModel.windingResistanceSource === "estimated_from_nominal_voltage_and_stall_current";
  return authoredConstraint(
    "motor.request.estimated-values",
    estimated && !request.constraints.allowEstimatedValues ? "fail" : "pass",
    estimated
      ? request.constraints.allowEstimatedValues
        ? "The request explicitly permits the declared winding-resistance estimate"
        : "The request forbids the declared winding-resistance estimate"
      : "The winding resistance is user-provided",
    requestEvidence("constraints.allowEstimatedValues"),
  );
}

function packageConstraint(request: Readonly<BrushedDcMotorDesignRequest>, packageNames: string[]): ConstraintResult {
  if (request.constraints.allowedPackages.length === 0) {
    return authoredConstraint("motor.assembly.allowed-packages", "pass", "The request does not restrict package names", requestEvidence("constraints.allowedPackages"));
  }
  const unsupported = packageNames.filter((name) => !request.constraints.allowedPackages.includes(name));
  return authoredConstraint(
    "motor.assembly.allowed-packages",
    unsupported.length === 0 ? "pass" : "fail",
    unsupported.length === 0
      ? "Every selected package is explicitly allowed"
      : `Selected packages are not allowed: ${unsupported.join(", ")}`,
    requestEvidence("constraints.allowedPackages"),
  );
}

function heightConstraint(request: Readonly<BrushedDcMotorDesignRequest>): ConstraintResult {
  return request.constraints.maximumComponentHeight === null
    ? authoredConstraint("motor.assembly.maximum-height", "pass", "The request does not impose a component-height limit", requestEvidence("constraints.maximumComponentHeight"))
    : authoredConstraint("motor.assembly.maximum-height", "unknown", "Synthetic A1 profiles do not contain component-height evidence", requestEvidence("constraints.maximumComponentHeight"));
}

function boardAreaConstraint(request: Readonly<BrushedDcMotorDesignRequest>, boardAreaM2: number, evidence: EvidenceRef[]): ConstraintResult {
  if (request.constraints.maximumBoardArea === null) {
    return authoredConstraint("motor.assembly.maximum-board-area", "pass", "The request does not impose a board-area limit", requestEvidence("constraints.maximumBoardArea"));
  }
  return maximumConstraint({
    ruleId: "motor.assembly.maximum-board-area",
    actual: boardAreaM2,
    limit: request.constraints.maximumBoardArea.value,
    unit: "m2",
    displayUnit: "mm²",
    explanation: "The summed synthetic package-area proxy must not exceed the user limit",
    evidence: combinedEvidence(evidence, requestEvidence("constraints.maximumBoardArea")),
  });
}

function countAndAreaMetrics(components: readonly SelectedComponent[], evidence: EvidenceRef[]): CandidateMetric[] {
  const profiles = components.map((component) => ({ component, profile: motorProfileById(component.profileId) }));
  const boardAreaM2 = profiles.reduce((sum, entry) => sum + entry.profile.boardAreaM2 * entry.component.quantityPerAssembly, 0);
  return [
    {
      id: "motor.bom-line-count",
      value: quantity(components.length, "count", "lines"),
      state: "calculated",
      explanation: "Count of selected BOM lines",
      evidence: [AUTHORED_MOTOR_RULE_EVIDENCE],
    },
    {
      id: "motor.component-count",
      value: quantity(components.reduce((sum, component) => sum + component.quantityPerAssembly, 0), "count", "components"),
      state: "calculated",
      explanation: "Sum of quantity-per-assembly across selected BOM lines",
      evidence: [AUTHORED_MOTOR_RULE_EVIDENCE],
    },
    {
      id: "motor.board-area-proxy",
      value: quantity(boardAreaM2, "m2", "mm²"),
      state: "estimated",
      explanation: "Sum of synthetic fixture package-area proxies; not a routed PCB area",
      evidence,
    },
  ];
}

function marginMetric(id: string, value: number, unit: "A" | "Hz" | "V", evidence: EvidenceRef[]): CandidateMetric {
  return {
    id,
    value: quantity(value, unit, unit),
    state: "calculated",
    explanation: "Positive values indicate remaining analytic margin",
    evidence,
  };
}

function componentEvidence(components: readonly SelectedComponent[]): EvidenceRef[] {
  return combinedEvidence(...components.map((component) => component.evidence));
}

function boardArea(components: readonly SelectedComponent[]): number {
  return components.reduce((sum, component) =>
    sum + motorProfileById(component.profileId).boardAreaM2 * component.quantityPerAssembly, 0);
}

function behavioralSteadyStateConstraints(request: Readonly<BrushedDcMotorDesignRequest>): ConstraintResult[] {
  const motorLoad = deriveBehavioralMotorLoad(request);
  const backEmf = motorLoad.operatingPointBackEmf.value;
  if (backEmf === null) {
    return [authoredConstraint(
      "motor.behavioral.non-negative-operating-back-emf",
      "unknown",
      "An averaged steady-state motor back-EMF could not be derived",
      motorLoad.operatingPointBackEmf.evidence,
    )];
  }
  const averageBridgeV = request.requirements.supplyVoltage.nominal.value
    * request.requirements.operatingPoint.dutyCycle.value;
  const closureBackEmfV = averageBridgeV
    - request.requirements.operatingPoint.loadCurrent.value * request.requirements.motorModel.windingResistance.value;
  const evidenceConstraint = authoredConstraint(
    "motor.behavioral.operating-back-emf-evidence",
    motorLoad.operatingPointBackEmf.state === "estimated" && !request.constraints.allowEstimatedValues ? "fail" : "pass",
    motorLoad.operatingPointBackEmf.state === "estimated"
      ? request.constraints.allowEstimatedValues
        ? "The request permits the explicitly estimated algebraic operating-point back-EMF closure"
        : "The request forbids the estimated algebraic operating-point back-EMF closure"
      : "Operating-point back-EMF is calculated from request-provided Ke and target speed",
    combinedEvidence(motorLoad.operatingPointBackEmf.evidence, requestEvidence("constraints.allowEstimatedValues")),
  );
  const consistencyConstraint = motorLoad.targetBackEmf.value === null
    ? authoredConstraint(
      "motor.behavioral.operating-point-consistency",
      "pass",
      "The visible estimated back-EMF source algebraically closes the declared steady-state operating point",
      motorLoad.operatingPointBackEmf.evidence,
    )
    : maximumConstraint({
      ruleId: "motor.behavioral.operating-point-consistency",
      actual: Math.abs(motorLoad.targetBackEmf.value.value - closureBackEmfV),
      limit: Math.max(0.1, averageBridgeV * 0.05),
      unit: "V",
      displayUnit: "V",
      explanation: "Ke × target-speed back-EMF must agree with the declared duty/current/R operating point within 5% of averaged bridge voltage or 0.1 V",
      evidence: combinedEvidence(motorLoad.targetBackEmf.evidence, requestEvidence("requirements.operatingPoint")),
    });
  return [
    minimumConstraint({
      ruleId: "motor.behavioral.non-negative-operating-back-emf",
      actual: backEmf.value,
      limit: 0,
      unit: "V",
      displayUnit: "V",
      explanation: "The averaged motoring operating point must not require a negative back-EMF source",
      evidence: motorLoad.operatingPointBackEmf.evidence,
    }),
    evidenceConstraint,
    consistencyConstraint,
  ];
}

export const INTEGRATED_H_BRIDGE_RECIPE: DesignRecipe = {
  id: "motor.brushed-dc.integrated-h-bridge.v1",
  version: RECIPE_VERSION,
  contentHash: contentHash({
    recipe: "motor.brushed-dc.integrated-h-bridge.v1",
    version: RECIPE_VERSION,
    catalog: MOTOR_CATALOG_CONTENT_HASH,
    equations: MOTOR_EQUATION_IDS,
  }),
  supports(request) {
    return request.application === "motor.brushed-dc"
      && request.constraints.allowedTopologyFamilies.includes("motor.hbridge.integrated");
  },
  enumerate() {
    return SYNTHETIC_MOTOR_CATALOG.integratedBridges.map((driver) => ({
      optionKey: `integrated:${driver.id}`,
      data: { driverProfileId: driver.id },
    }));
  },
  solve(option, environment) {
    const request = motorRequest(environment.request);
    return { status: "ok", value: { ...option, derivedValues: baseDerivedValues(request) } };
  },
  match(option, environment) {
    const request = motorRequest(environment.request);
    const driver = profile(stringField(option.data, "driverProfileId"), "integrated_bridge");
    const bulkMinimumF = Math.max(driver.bulkCapacitanceMinimumF, requiredBulkCapacitanceF(request.requirements.stallCurrent.value));
    const decoupling = selectCapacitor("decoupling", driver.localDecouplingMinimumF, request.requirements.supplyVoltage.maximum.value);
    const bulk = selectCapacitor("bulk", bulkMinimumF, request.requirements.supplyVoltage.maximum.value);
    if (!decoupling || !bulk) {
      return [matchingRejection(this.id, option, "No synthetic decoupling/bulk capacitor matches the required capacitance and voltage", [driver.id])];
    }
    return [{
      status: "ok",
      value: {
        ...option,
        data: { ...option.data, decouplingProfileId: decoupling.id, bulkProfileId: bulk.id },
        components: [
          selected(driver, "driver", "h-bridge-driver", 1),
          selected(decoupling, "c-local", "local-decoupling", 1, quantity(decoupling.nominalCapacitanceF, "F", "µF")),
          selected(bulk, "c-bulk", "supply-bulk-capacitance", 1, quantity(bulk.nominalCapacitanceF, "F", "µF")),
        ],
        simulationCoverage: simulationCoverage(request),
        warnings: warnings(request),
      },
    }];
  },
  check(option, environment) {
    const request = motorRequest(environment.request);
    const driver = profile(stringField(option.data, "driverProfileId"), "integrated_bridge");
    const decoupling = profile(stringField(option.data, "decouplingProfileId"), "capacitor");
    const bulk = profile(stringField(option.data, "bulkProfileId"), "capacitor");
    const requirements = request.requirements;
    const evidence = combinedEvidence(driver.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]);
    const periodS = 1 / requirements.pwmFrequency.value;
    const minimumPulseS = periodS * Math.min(requirements.operatingPoint.dutyCycle.value, 1 - requirements.operatingPoint.dutyCycle.value);
    const losses = integratedLosses(request, driver);
    const bulkMinimumF = Math.max(driver.bulkCapacitanceMinimumF, requiredBulkCapacitanceF(requirements.stallCurrent.value));
    const currentLimitMinimum = requirements.currentLimitTarget === null
      ? authoredConstraint("motor.integrated.current-limit-minimum", "pass", "No programmable current-limit target is requested", requestEvidence("requirements.currentLimitTarget"))
      : minimumConstraint({ ruleId: "motor.integrated.current-limit-minimum", actual: requirements.currentLimitTarget.value, limit: driver.currentLimitMinimumA, unit: "A", displayUnit: "A", explanation: "Requested current limit must remain inside the fixture programming range", evidence });
    const currentLimitMaximum = requirements.currentLimitTarget === null
      ? authoredConstraint("motor.integrated.current-limit-maximum", "pass", "No programmable current-limit target is requested", requestEvidence("requirements.currentLimitTarget"))
      : maximumConstraint({ ruleId: "motor.integrated.current-limit-maximum", actual: requirements.currentLimitTarget.value, limit: driver.currentLimitMaximumA, unit: "A", displayUnit: "A", explanation: "Requested current limit must remain inside the fixture programming range", evidence });
    return [
      minimumConstraint({ ruleId: "motor.integrated.supply-minimum", actual: requirements.supplyVoltage.minimum.value, limit: driver.supplyMinimumV, unit: "V", displayUnit: "V", explanation: "Minimum motor supply must remain inside the driver operating range", evidence }),
      maximumConstraint({ ruleId: "motor.integrated.supply-maximum", actual: requirements.supplyVoltage.maximum.value, limit: driver.supplyMaximumV, unit: "V", displayUnit: "V", explanation: "Maximum motor supply must remain inside the driver operating range", evidence }),
      maximumConstraint({ ruleId: "motor.integrated.absolute-maximum-voltage", actual: requirements.supplyVoltage.maximum.value, limit: driver.absoluteMaximumV, unit: "V", displayUnit: "V", explanation: "Maximum motor supply must remain below the absolute-maximum fixture value", evidence }),
      maximumConstraint({ ruleId: "motor.integrated.continuous-current", actual: requirements.continuousCurrent.value, limit: driver.continuousCurrentA, unit: "A", displayUnit: "A", explanation: "Rated motor current must not exceed continuous bridge capability", evidence }),
      maximumConstraint({ ruleId: "motor.integrated.peak-current", actual: requirements.stallCurrent.value, limit: driver.peakCurrentA, unit: "A", displayUnit: "A", explanation: "Stall current must not exceed the declared bridge peak capability", evidence }),
      currentLimitMinimum,
      currentLimitMaximum,
      minimumConstraint({ ruleId: "motor.integrated.logic-high", actual: requirements.logicVoltage.value, limit: driver.logicHighMaximumV, unit: "V", displayUnit: "V", explanation: "Logic supply must meet the worst-case input-high threshold", evidence }),
      maximumConstraint({ ruleId: "motor.integrated.pwm-frequency", actual: requirements.pwmFrequency.value, limit: driver.pwmMaximumHz, unit: "Hz", displayUnit: "kHz", explanation: "PWM frequency must not exceed the driver limit", evidence }),
      minimumConstraint({ ruleId: "motor.integrated.minimum-pulse-width", actual: minimumPulseS, limit: driver.minimumPulseWidthS, unit: "s", displayUnit: "µs", explanation: "Both commanded on-time and off-time must exceed the driver minimum pulse width", evidence }),
      maximumConstraint({ ruleId: "motor.integrated.high-side-on-time", actual: requirements.operatingPoint.dutyCycle.value, limit: driver.maximumHighSideDutyCycle, unit: "1", displayUnit: "%", explanation: "Declared duty must stay inside the synthetic charge-pump high-side limit", evidence }),
      minimumConstraint({ ruleId: "motor.integrated.local-decoupling", actual: decoupling.effectiveCapacitanceF, limit: driver.localDecouplingMinimumF, unit: "F", displayUnit: "µF", explanation: "Effective local capacitance must meet the driver requirement", evidence: combinedEvidence(evidence, decoupling.evidence) }),
      minimumConstraint({ ruleId: "motor.integrated.local-decoupling-voltage", actual: decoupling.ratedVoltageV, limit: requirements.supplyVoltage.maximum.value, unit: "V", displayUnit: "V", explanation: "Local capacitor rating must cover maximum motor supply", evidence: combinedEvidence(evidence, decoupling.evidence) }),
      minimumConstraint({ ruleId: "motor.integrated.bulk-capacitance", actual: bulk.effectiveCapacitanceF, limit: bulkMinimumF, unit: "F", displayUnit: "µF", explanation: `Bulk capacitance uses ${MOTOR_EQUATION_IDS.bulkCapacitance} and the driver minimum`, evidence: combinedEvidence(evidence, bulk.evidence) }),
      minimumConstraint({ ruleId: "motor.integrated.bulk-capacitor-voltage", actual: bulk.ratedVoltageV, limit: requirements.supplyVoltage.maximum.value, unit: "V", displayUnit: "V", explanation: "Bulk capacitor rating must cover maximum motor supply", evidence: combinedEvidence(evidence, bulk.evidence) }),
      authoredConstraint("motor.integrated.shunt-applicability", "pass", "No current-limit target is requested and this synthetic integrated recipe does not use an external shunt", combinedEvidence(evidence, requestEvidence("requirements.currentLimitTarget"))),
      maximumConstraint({ ruleId: "motor.integrated.junction-temperature", actual: losses.driverJunctionK, limit: Math.min(driver.maximumJunctionTemperatureK, request.constraints.maximumJunctionTemperature.value), unit: "K", displayUnit: "°C", explanation: "Estimated driver junction temperature must satisfy both profile and user limits", evidence }),
      estimatedValueConstraint(request),
      packageConstraint(request, [driver.packageName, decoupling.packageName, bulk.packageName]),
      heightConstraint(request),
      boardAreaConstraint(request, boardArea(option.components), componentEvidence(option.components)),
      ...behavioralSteadyStateConstraints(request),
    ];
  },
  estimate(option, _constraints, environment): CandidateEstimate {
    const request = motorRequest(environment.request);
    const driver = profile(stringField(option.data, "driverProfileId"), "integrated_bridge");
    const evidence = combinedEvidence(driver.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]);
    const losses = integratedLosses(request, driver);
    return {
      metrics: [
        ...lossMetrics(losses, evidence, "integrated"),
        ...countAndAreaMetrics(option.components, componentEvidence(option.components)),
        marginMetric("motor.margin.voltage", driver.absoluteMaximumV - request.requirements.supplyVoltage.maximum.value, "V", evidence),
        marginMetric("motor.margin.continuous-current", driver.continuousCurrentA - request.requirements.continuousCurrent.value, "A", evidence),
        marginMetric("motor.margin.peak-current", driver.peakCurrentA - request.requirements.stallCurrent.value, "A", evidence),
        marginMetric("motor.margin.pwm", driver.pwmMaximumHz - request.requirements.pwmFrequency.value, "Hz", evidence),
        marginMetric("motor.margin.logic", request.requirements.logicVoltage.value - driver.logicHighMaximumV, "V", evidence),
      ],
      warnings: [],
    };
  },
  materialize(candidate, environment) {
    return materializeBehavioralMotorCircuit(candidate, motorRequest(environment.request), "integrated");
  },
};

export const EXTERNAL_NMOS_H_BRIDGE_RECIPE: DesignRecipe = {
  id: "motor.brushed-dc.external-nmos-h-bridge.v1",
  version: RECIPE_VERSION,
  contentHash: contentHash({
    recipe: "motor.brushed-dc.external-nmos-h-bridge.v1",
    version: RECIPE_VERSION,
    catalog: MOTOR_CATALOG_CONTENT_HASH,
    equations: MOTOR_EQUATION_IDS,
  }),
  supports(request) {
    return request.application === "motor.brushed-dc"
      && request.constraints.allowedTopologyFamilies.includes("motor.hbridge.external-nmos");
  },
  enumerate() {
    return SYNTHETIC_MOTOR_CATALOG.gateDrivers.flatMap((driver) =>
      SYNTHETIC_MOTOR_CATALOG.mosfets.map((mosfetValue) => ({
        optionKey: `external:${driver.id}:${mosfetValue.id}`,
        data: { driverProfileId: driver.id, mosfetProfileId: mosfetValue.id },
      })));
  },
  solve(option, environment) {
    const request = motorRequest(environment.request);
    const driver = profile(stringField(option.data, "driverProfileId"), "gate_driver");
    const mosfetValue = profile(stringField(option.data, "mosfetProfileId"), "mosfet");
    const bootstrapF = requiredBootstrapCapacitanceF(driver, mosfetValue);
    const derivedValues = baseDerivedValues(request);
    if (bootstrapF !== null) {
      derivedValues.push({
        id: "motor.external.bootstrap-capacitance-required",
        value: quantity(bootstrapF, "F", "nF"),
        equationId: MOTOR_EQUATION_IDS.bootstrapCapacitance,
        state: "calculated",
        evidence: combinedEvidence(driver.evidence, mosfetValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]),
      });
    }
    derivedValues.push({
      id: "motor.external.gate-transition-time",
      value: quantity(gateTransitionTimeS(driver, mosfetValue), "s", "ns"),
      equationId: "motor.external.gate-transition-time.v1",
      state: "calculated",
      evidence: combinedEvidence(driver.evidence, mosfetValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]),
    });
    return { status: "ok", value: { ...option, derivedValues } };
  },
  match(option, environment) {
    const request = motorRequest(environment.request);
    const driver = profile(stringField(option.data, "driverProfileId"), "gate_driver");
    const mosfetValue = profile(stringField(option.data, "mosfetProfileId"), "mosfet");
    const requiredBootstrapF = requiredBootstrapCapacitanceF(driver, mosfetValue);
    const bootstrap = requiredBootstrapF === null ? undefined : selectCapacitor("bootstrap", requiredBootstrapF, driver.gateVoltageV);
    const decoupling = selectCapacitor("decoupling", driver.localDecouplingMinimumF, request.requirements.supplyVoltage.maximum.value);
    const bulkMinimumF = requiredBulkCapacitanceF(request.requirements.stallCurrent.value);
    const bulk = selectCapacitor("bulk", bulkMinimumF, request.requirements.supplyVoltage.maximum.value);
    const shuntValue = shunt();
    const gateResistor = resistor("gate");
    const pulldown = resistor("gate_pulldown");
    if ((requiredBootstrapF !== null && !bootstrap) || !decoupling || !bulk) {
      return [matchingRejection(this.id, option, "No synthetic bootstrap/decoupling/bulk capacitor matches the solved requirement", [driver.id, mosfetValue.id])];
    }
    const components: SelectedComponent[] = [
      selected(driver, "driver", "h-bridge-driver", 1),
      selected(mosfetValue, "q-bridge", "bridge-nmos", 4),
      selected(shuntValue, "r-shunt", "current-sense-shunt", 1, quantity(shuntValue.resistanceOhm, "ohm", "mΩ")),
      selected(gateResistor, "r-gate", "gate-resistor", 4, quantity(gateResistor.resistanceOhm, "ohm", "Ω")),
      selected(pulldown, "r-gate-pulldown", "gate-source-pulldown", 4, quantity(pulldown.resistanceOhm, "ohm", "kΩ")),
      selected(decoupling, "c-local", "local-decoupling", 1, quantity(decoupling.nominalCapacitanceF, "F", "µF")),
      selected(bulk, "c-bulk", "supply-bulk-capacitance", 1, quantity(bulk.nominalCapacitanceF, "F", "µF")),
    ];
    if (bootstrap) components.push(selected(bootstrap, "c-bootstrap", "bootstrap-capacitor", 2, quantity(bootstrap.nominalCapacitanceF, "F", "nF")));
    return [{
      status: "ok",
      value: {
        ...option,
        data: {
          ...option.data,
          shuntProfileId: shuntValue.id,
          decouplingProfileId: decoupling.id,
          bulkProfileId: bulk.id,
          ...(bootstrap === undefined ? {} : { bootstrapProfileId: bootstrap.id }),
        },
        components,
        simulationCoverage: simulationCoverage(request),
        warnings: warnings(request),
      },
    }];
  },
  check(option, environment) {
    const request = motorRequest(environment.request);
    const requirements = request.requirements;
    const driver = profile(stringField(option.data, "driverProfileId"), "gate_driver");
    const mosfetValue = profile(stringField(option.data, "mosfetProfileId"), "mosfet");
    const shuntValue = profile(stringField(option.data, "shuntProfileId"), "shunt");
    const decoupling = profile(stringField(option.data, "decouplingProfileId"), "capacitor");
    const bulk = profile(stringField(option.data, "bulkProfileId"), "capacitor");
    const bootstrapId = option.data.bootstrapProfileId;
    const bootstrap = typeof bootstrapId === "string" ? profile(bootstrapId, "capacitor") : undefined;
    const evidence = combinedEvidence(driver.evidence, mosfetValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]);
    const driverEvidence = combinedEvidence(driver.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]);
    const mosfetEvidence = combinedEvidence(mosfetValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]);
    const losses = externalLosses(request, driver, mosfetValue, shuntValue);
    const periodS = 1 / requirements.pwmFrequency.value;
    const minimumPulseS = periodS * Math.min(requirements.operatingPoint.dutyCycle.value, 1 - requirements.operatingPoint.dutyCycle.value);
    const transitionS = gateTransitionTimeS(driver, mosfetValue);
    const bootstrapRequiredF = requiredBootstrapCapacitanceF(driver, mosfetValue);
    const bootstrapConstraint = bootstrapRequiredF === null || !bootstrap
      ? authoredConstraint("motor.external.bootstrap-capacitance", "unknown", "Bootstrap ripple or matched capacitance evidence is unavailable", driver.evidence)
      : minimumConstraint({ ruleId: "motor.external.bootstrap-capacitance", actual: bootstrap.effectiveCapacitanceF, limit: bootstrapRequiredF, unit: "F", displayUnit: "nF", explanation: `Effective bootstrap capacitance must meet ${MOTOR_EQUATION_IDS.bootstrapCapacitance}`, evidence: combinedEvidence(evidence, bootstrap.evidence) });
    const logicConstraint = driver.logicHighMaximumV === null
      ? authoredConstraint("motor.external.logic-high", "unknown", "The synthetic rejected driver deliberately omits a worst-case logic-high threshold", driver.evidence)
      : minimumConstraint({ ruleId: "motor.external.logic-high", actual: requirements.logicVoltage.value, limit: driver.logicHighMaximumV, unit: "V", displayUnit: "V", explanation: "Logic supply must meet the worst-case input-high threshold", evidence: driverEvidence });
    const currentLimitConstraint = requirements.currentLimitTarget === null
      ? authoredConstraint("motor.external.current-limit-target", "pass", "No programmable current-limit target is requested", requestEvidence("requirements.currentLimitTarget"))
      : maximumConstraint({ ruleId: "motor.external.current-limit-target", actual: requirements.currentLimitTarget.value * shuntValue.resistanceOhm, limit: driver.senseMaximumVoltageV, unit: "V", displayUnit: "V", explanation: "Requested current-limit shunt voltage must remain inside the driver sense range", evidence: combinedEvidence(driver.evidence, shuntValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]) });
    return [
      minimumConstraint({ ruleId: "motor.external.driver-supply-minimum", actual: requirements.supplyVoltage.minimum.value, limit: driver.supplyMinimumV, unit: "V", displayUnit: "V", explanation: "Minimum motor supply must remain inside the gate-driver range", evidence: driverEvidence }),
      maximumConstraint({ ruleId: "motor.external.driver-supply-maximum", actual: requirements.supplyVoltage.maximum.value, limit: driver.supplyMaximumV, unit: "V", displayUnit: "V", explanation: "Maximum motor supply must remain inside the gate-driver range", evidence: driverEvidence }),
      maximumConstraint({ ruleId: "motor.external.driver-absolute-maximum", actual: requirements.supplyVoltage.maximum.value, limit: driver.absoluteMaximumV, unit: "V", displayUnit: "V", explanation: "Maximum motor supply must remain below gate-driver absolute maximum", evidence: driverEvidence }),
      minimumConstraint({ ruleId: "motor.external.mosfet-vds-margin", actual: mosfetValue.drainSourceMaximumV, limit: requirements.supplyVoltage.maximum.value * VOLTAGE_TRANSIENT_MARGIN, unit: "V", displayUnit: "V", explanation: "MOSFET VDS rating must cover 1.2 times maximum supply; system overshoot still requires bench validation", evidence: mosfetEvidence }),
      minimumConstraint({ ruleId: "motor.external.mosfet-continuous-current", actual: mosfetValue.continuousCurrentA, limit: requirements.continuousCurrent.value, unit: "A", displayUnit: "A", explanation: "MOSFET continuous current rating must cover rated motor current", evidence: mosfetEvidence }),
      minimumConstraint({ ruleId: "motor.external.mosfet-pulsed-current", actual: mosfetValue.pulsedCurrentA, limit: requirements.stallCurrent.value, unit: "A", displayUnit: "A", explanation: "MOSFET pulsed current rating must cover stall current; complete SOA remains unverified", evidence: mosfetEvidence }),
      minimumConstraint({ ruleId: "motor.external.rds-on-gate-voltage", actual: driver.gateVoltageV, limit: mosfetValue.rdsOnGateVoltageV, unit: "V", displayUnit: "V", explanation: "Gate drive must reach the voltage at which the fixture RDS(on) value is stated", evidence }),
      logicConstraint,
      maximumConstraint({ ruleId: "motor.external.pwm-frequency", actual: requirements.pwmFrequency.value, limit: driver.pwmMaximumHz, unit: "Hz", displayUnit: "kHz", explanation: "PWM frequency must not exceed the gate-driver limit", evidence: driverEvidence }),
      minimumConstraint({ ruleId: "motor.external.minimum-pulse-width", actual: minimumPulseS, limit: driver.minimumPulseWidthS, unit: "s", displayUnit: "µs", explanation: "Commanded on/off pulses must exceed the gate-driver minimum", evidence: driverEvidence }),
      maximumConstraint({ ruleId: "motor.external.gate-transition-time", actual: transitionS, limit: periodS * 0.05, unit: "s", displayUnit: "ns", explanation: "Calculated rise-plus-fall time must remain within 5% of the PWM period", evidence }),
      minimumConstraint({ ruleId: "motor.external.gate-source-current", actual: driver.sourceCurrentA, limit: mosfetValue.totalGateChargeC / (periodS * 0.025), unit: "A", displayUnit: "A", explanation: "Source current must charge the gate inside 2.5% of the PWM period", evidence }),
      minimumConstraint({ ruleId: "motor.external.gate-sink-current", actual: driver.sinkCurrentA, limit: mosfetValue.totalGateChargeC / (periodS * 0.025), unit: "A", displayUnit: "A", explanation: "Sink current must discharge the gate inside 2.5% of the PWM period", evidence }),
      bootstrapConstraint,
      ...(bootstrap === undefined ? [] : [minimumConstraint({ ruleId: "motor.external.bootstrap-voltage", actual: bootstrap.ratedVoltageV, limit: driver.gateVoltageV, unit: "V", displayUnit: "V", explanation: "Bootstrap capacitor voltage rating must cover gate drive", evidence: combinedEvidence(driverEvidence, bootstrap.evidence) })]),
      maximumConstraint({ ruleId: "motor.external.bootstrap-high-side-on-time", actual: requirements.operatingPoint.dutyCycle.value, limit: driver.bootstrapMaximumDutyCycle, unit: "1", displayUnit: "%", explanation: "Declared duty must remain below the bootstrap refresh limit", evidence: driverEvidence }),
      maximumConstraint({ ruleId: "motor.external.dead-time", actual: driver.deadTimeS, limit: minimumPulseS, unit: "s", displayUnit: "ns", explanation: "Driver dead time must fit inside the minimum commanded pulse", evidence: driverEvidence }),
      maximumConstraint({ ruleId: "motor.external.shunt-continuous-power", actual: requirements.operatingPoint.loadCurrent.value ** 2 * shuntValue.resistanceOhm, limit: shuntValue.continuousPowerW, unit: "W", displayUnit: "W", explanation: "Shunt continuous dissipation must not exceed its fixture rating", evidence: combinedEvidence(shuntValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]) }),
      maximumConstraint({ ruleId: "motor.external.shunt-pulse-power", actual: requirements.stallCurrent.value ** 2 * shuntValue.resistanceOhm, limit: shuntValue.pulsePowerW, unit: "W", displayUnit: "W", explanation: "Shunt stall pulse dissipation must not exceed its fixture pulse rating", evidence: combinedEvidence(shuntValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]) }),
      maximumConstraint({ ruleId: "motor.external.sense-range", actual: requirements.stallCurrent.value * shuntValue.resistanceOhm, limit: driver.senseMaximumVoltageV, unit: "V", displayUnit: "V", explanation: "Worst-case shunt voltage at stall must remain inside the driver sense range", evidence: combinedEvidence(driver.evidence, shuntValue.evidence) }),
      currentLimitConstraint,
      minimumConstraint({ ruleId: "motor.external.local-decoupling", actual: decoupling.effectiveCapacitanceF, limit: driver.localDecouplingMinimumF, unit: "F", displayUnit: "µF", explanation: "Effective local capacitance must meet the gate-driver minimum", evidence: combinedEvidence(driverEvidence, decoupling.evidence) }),
      minimumConstraint({ ruleId: "motor.external.local-decoupling-voltage", actual: decoupling.ratedVoltageV, limit: requirements.supplyVoltage.maximum.value, unit: "V", displayUnit: "V", explanation: "Local capacitor voltage rating must cover maximum motor supply", evidence: combinedEvidence(driverEvidence, decoupling.evidence) }),
      minimumConstraint({ ruleId: "motor.external.bulk-capacitance", actual: bulk.effectiveCapacitanceF, limit: requiredBulkCapacitanceF(requirements.stallCurrent.value), unit: "F", displayUnit: "µF", explanation: `Bulk capacitance must meet ${MOTOR_EQUATION_IDS.bulkCapacitance}`, evidence: combinedEvidence(bulk.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]) }),
      minimumConstraint({ ruleId: "motor.external.bulk-capacitor-voltage", actual: bulk.ratedVoltageV, limit: requirements.supplyVoltage.maximum.value, unit: "V", displayUnit: "V", explanation: "Bulk capacitor voltage rating must cover maximum motor supply", evidence: bulk.evidence }),
      maximumConstraint({ ruleId: "motor.external.fet-junction-temperature", actual: losses.fetJunctionK ?? Number.POSITIVE_INFINITY, limit: Math.min(mosfetValue.maximumJunctionTemperatureK, request.constraints.maximumJunctionTemperature.value), unit: "K", displayUnit: "°C", explanation: "Estimated hottest MOSFET junction must satisfy profile and user limits", evidence: mosfetEvidence }),
      maximumConstraint({ ruleId: "motor.external.driver-junction-temperature", actual: losses.driverJunctionK, limit: Math.min(driver.maximumJunctionTemperatureK, request.constraints.maximumJunctionTemperature.value), unit: "K", displayUnit: "°C", explanation: "Estimated gate-driver junction must satisfy profile and user limits", evidence: driverEvidence }),
      estimatedValueConstraint(request),
      packageConstraint(request, option.components.map((component) => motorProfileById(component.profileId).packageName)),
      heightConstraint(request),
      boardAreaConstraint(request, boardArea(option.components), componentEvidence(option.components)),
      ...behavioralSteadyStateConstraints(request),
    ];
  },
  estimate(option, _constraints, environment): CandidateEstimate {
    const request = motorRequest(environment.request);
    const driver = profile(stringField(option.data, "driverProfileId"), "gate_driver");
    const mosfetValue = profile(stringField(option.data, "mosfetProfileId"), "mosfet");
    const shuntValue = profile(stringField(option.data, "shuntProfileId"), "shunt");
    const evidence = combinedEvidence(driver.evidence, mosfetValue.evidence, shuntValue.evidence, [AUTHORED_MOTOR_RULE_EVIDENCE]);
    const losses = externalLosses(request, driver, mosfetValue, shuntValue);
    const logicMargin = driver.logicHighMaximumV === null ? null : request.requirements.logicVoltage.value - driver.logicHighMaximumV;
    const metrics: CandidateMetric[] = [
      ...lossMetrics(losses, evidence, "external"),
      ...countAndAreaMetrics(option.components, componentEvidence(option.components)),
      marginMetric("motor.margin.voltage", mosfetValue.drainSourceMaximumV - request.requirements.supplyVoltage.maximum.value * VOLTAGE_TRANSIENT_MARGIN, "V", evidence),
      marginMetric("motor.margin.continuous-current", mosfetValue.continuousCurrentA - request.requirements.continuousCurrent.value, "A", evidence),
      marginMetric("motor.margin.peak-current", mosfetValue.pulsedCurrentA - request.requirements.stallCurrent.value, "A", evidence),
      marginMetric("motor.margin.pwm", driver.pwmMaximumHz - request.requirements.pwmFrequency.value, "Hz", evidence),
    ];
    metrics.push(logicMargin === null
      ? { id: "motor.margin.logic", value: null, state: "unknown", explanation: "Logic threshold evidence is unavailable", evidence: [] }
      : marginMetric("motor.margin.logic", logicMargin, "V", evidence));
    return { metrics, warnings: [] };
  },
  materialize(candidate, environment) {
    return materializeBehavioralMotorCircuit(candidate, motorRequest(environment.request), "external-nmos");
  },
};

export const MOTOR_DESIGN_RECIPES = [INTEGRATED_H_BRIDGE_RECIPE, EXTERNAL_NMOS_H_BRIDGE_RECIPE] as const;
