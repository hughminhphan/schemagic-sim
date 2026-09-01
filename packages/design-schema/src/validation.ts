import { validateSourcingPolicy } from "@opencircuit/sourcing-schema";
import {
  DESIGN_REQUEST_FORMAT,
  DESIGN_REQUEST_SCHEMA_VERSION,
  type DesignRequest,
} from "./request";
import type { SIUnit } from "./quantity";

export interface DesignRequestValidationIssue {
  path: string;
  code: "invalid_format" | "invalid_range" | "invalid_type" | "invalid_unit" | "missing_value" | "unknown_field" | "unsupported_value";
  message: string;
}

const OBJECTIVES = new Set(["area", "availability", "balanced", "bom_cost", "efficiency", "lead_time", "temperature"]);
const MOTOR_TOPOLOGIES = new Set(["motor.hbridge.external-nmos", "motor.hbridge.integrated"]);
const POWER_TOPOLOGIES = new Set(["power.buck.controller-external-nmos", "power.buck.integrated-synchronous"]);
const MOTOR_MODES = new Set(["brake", "coast", "forward", "reverse"]);
const ASSUMPTION_SOURCES = new Set(["derived", "fixture", "unavailable", "user"]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function issue(
  issues: DesignRequestValidationIssue[],
  path: string,
  code: DesignRequestValidationIssue["code"],
  message: string,
): void {
  issues.push({ path, code, message });
}

function requireRecord(value: unknown, path: string, issues: DesignRequestValidationIssue[]): Record<string, unknown> | undefined {
  const result = record(value);
  if (!result) issue(issues, path, "invalid_type", "Expected an object");
  return result;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[],
  issues: DesignRequestValidationIssue[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issue(issues, path === "$" ? key : `${path}.${key}`, "unknown_field", `Unknown persisted field ${key}`);
  }
}

function requireString(value: unknown, path: string, issues: DesignRequestValidationIssue[]): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    issue(issues, path, value === undefined ? "missing_value" : "invalid_type", "Expected a non-empty string");
    return undefined;
  }
  return value;
}

function requireBoolean(value: unknown, path: string, issues: DesignRequestValidationIssue[]): void {
  if (typeof value !== "boolean") issue(issues, path, value === undefined ? "missing_value" : "invalid_type", "Expected a boolean");
}

function quantityValue(
  value: unknown,
  path: string,
  unit: SIUnit,
  issues: DesignRequestValidationIssue[],
  options: { positive?: boolean; nonNegative?: boolean } = {},
): number | undefined {
  const quantity = requireRecord(value, path, issues);
  if (!quantity) return undefined;
  rejectUnknownKeys(quantity, path, ["value", "unit", "displayUnit"], issues);
  if (quantity.unit !== unit) issue(issues, `${path}.unit`, "invalid_unit", `Expected canonical SI unit ${unit}`);
  if (typeof quantity.displayUnit !== "string" || !quantity.displayUnit.trim()) {
    issue(issues, `${path}.displayUnit`, "missing_value", "Display unit must be declared separately from the SI value");
  }
  if (typeof quantity.value !== "number" || !Number.isFinite(quantity.value)) {
    issue(issues, `${path}.value`, "invalid_type", "Expected a finite number");
    return undefined;
  }
  if (options.positive && quantity.value <= 0) issue(issues, `${path}.value`, "invalid_range", "Value must be greater than zero");
  if (options.nonNegative && quantity.value < 0) issue(issues, `${path}.value`, "invalid_range", "Value must not be negative");
  return quantity.value;
}

function nullableQuantity(
  value: unknown,
  path: string,
  unit: SIUnit,
  issues: DesignRequestValidationIssue[],
  options: { positive?: boolean; nonNegative?: boolean } = {},
): number | null | undefined {
  return value === null ? null : quantityValue(value, path, unit, issues, options);
}

function stringArray(value: unknown, path: string, allowed: Set<string> | undefined, issues: DesignRequestValidationIssue[]): string[] | undefined {
  if (!Array.isArray(value)) {
    issue(issues, path, value === undefined ? "missing_value" : "invalid_type", "Expected an array");
    return undefined;
  }
  const result: string[] = [];
  value.forEach((entry, index) => {
    const parsed = requireString(entry, `${path}.${index}`, issues);
    if (!parsed) return;
    if (allowed && !allowed.has(parsed)) issue(issues, `${path}.${index}`, "unsupported_value", `Unsupported value ${parsed}`);
    result.push(parsed);
  });
  return result;
}

function validateVoltageRange(
  value: unknown,
  path: string,
  issues: DesignRequestValidationIssue[],
): { minimum?: number; nominal?: number; maximum?: number } {
  const range = requireRecord(value, path, issues);
  if (!range) return {};
  rejectUnknownKeys(range, path, ["minimum", "nominal", "maximum"], issues);
  const minimum = quantityValue(range.minimum, `${path}.minimum`, "V", issues, { positive: true });
  const nominal = quantityValue(range.nominal, `${path}.nominal`, "V", issues, { positive: true });
  const maximum = quantityValue(range.maximum, `${path}.maximum`, "V", issues, { positive: true });
  if (minimum !== undefined && nominal !== undefined && maximum !== undefined && !(minimum <= nominal && nominal <= maximum)) {
    issue(issues, path, "invalid_range", "Voltage range must satisfy minimum <= nominal <= maximum");
  }
  return { ...(minimum === undefined ? {} : { minimum }), ...(nominal === undefined ? {} : { nominal }), ...(maximum === undefined ? {} : { maximum }) };
}

function validateAssumptions(value: unknown, issues: DesignRequestValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issue(issues, "assumptions", value === undefined ? "missing_value" : "invalid_range", "Declare at least one assumption; fixtures may not rely on hidden defaults");
    return;
  }
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const assumption = requireRecord(entry, `assumptions.${index}`, issues);
    if (!assumption) return;
    rejectUnknownKeys(assumption, `assumptions.${index}`, ["id", "description", "source", "affects"], issues);
    const id = requireString(assumption.id, `assumptions.${index}.id`, issues);
    if (id && ids.has(id)) issue(issues, `assumptions.${index}.id`, "invalid_range", `Duplicate assumption id ${id}`);
    if (id) ids.add(id);
    requireString(assumption.description, `assumptions.${index}.description`, issues);
    const source = requireString(assumption.source, `assumptions.${index}.source`, issues);
    if (source && !ASSUMPTION_SOURCES.has(source)) issue(issues, `assumptions.${index}.source`, "unsupported_value", `Unsupported assumption source ${source}`);
    const affects = stringArray(assumption.affects, `assumptions.${index}.affects`, undefined, issues);
    if (affects && affects.length === 0) issue(issues, `assumptions.${index}.affects`, "invalid_range", "Assumption must name at least one affected field or analysis");
  });
}

function validateConstraints(value: unknown, application: unknown, issues: DesignRequestValidationIssue[]): void {
  const constraints = requireRecord(value, "constraints", issues);
  if (!constraints) return;
  rejectUnknownKeys(constraints, "constraints", [
    "allowedTopologyFamilies",
    "maximumJunctionTemperature",
    "allowedPackages",
    "maximumComponentHeight",
    "maximumBoardArea",
    "allowEstimatedValues",
    "allowUnknownWarnings",
    "allowUnknownHardConstraints",
  ], issues);
  const topologySet = application === "motor.brushed-dc" ? MOTOR_TOPOLOGIES : application === "power.buck" ? POWER_TOPOLOGIES : undefined;
  const topologies = stringArray(constraints.allowedTopologyFamilies, "constraints.allowedTopologyFamilies", topologySet, issues);
  if (topologies && topologies.length === 0) issue(issues, "constraints.allowedTopologyFamilies", "invalid_range", "At least one topology family must be allowed");
  quantityValue(constraints.maximumJunctionTemperature, "constraints.maximumJunctionTemperature", "K", issues, { positive: true });
  stringArray(constraints.allowedPackages, "constraints.allowedPackages", undefined, issues);
  nullableQuantity(constraints.maximumComponentHeight, "constraints.maximumComponentHeight", "m", issues, { positive: true });
  nullableQuantity(constraints.maximumBoardArea, "constraints.maximumBoardArea", "m2", issues, { positive: true });
  requireBoolean(constraints.allowEstimatedValues, "constraints.allowEstimatedValues", issues);
  requireBoolean(constraints.allowUnknownWarnings, "constraints.allowUnknownWarnings", issues);
  requireBoolean(constraints.allowUnknownHardConstraints, "constraints.allowUnknownHardConstraints", issues);
}

function validateMotorRequirements(value: unknown, issues: DesignRequestValidationIssue[]): void {
  const requirements = requireRecord(value, "requirements", issues);
  if (!requirements) return;
  rejectUnknownKeys(requirements, "requirements", [
    "supplyVoltage",
    "motorNominalVoltage",
    "continuousCurrent",
    "stallCurrent",
    "pwmFrequency",
    "logicVoltage",
    "ambientTemperature",
    "operatingModes",
    "currentLimitTarget",
    "operatingPoint",
    "motorModel",
  ], issues);
  const supply = validateVoltageRange(requirements.supplyVoltage, "requirements.supplyVoltage", issues);
  if (supply.minimum !== undefined && supply.minimum < 4.5) issue(issues, "requirements.supplyVoltage.minimum.value", "invalid_range", "Motor V1 minimum supply is 4.5 V");
  if (supply.maximum !== undefined && supply.maximum > 60) issue(issues, "requirements.supplyVoltage.maximum.value", "invalid_range", "Motor V1 maximum supply is 60 V");
  const motorNominal = quantityValue(requirements.motorNominalVoltage, "requirements.motorNominalVoltage", "V", issues, { positive: true });
  if (motorNominal !== undefined && supply.minimum !== undefined && supply.maximum !== undefined && (motorNominal < supply.minimum || motorNominal > supply.maximum)) {
    issue(issues, "requirements.motorNominalVoltage.value", "invalid_range", "Motor nominal voltage must fall within the supply range");
  }
  const continuousCurrent = quantityValue(requirements.continuousCurrent, "requirements.continuousCurrent", "A", issues, { positive: true });
  if (continuousCurrent !== undefined && (continuousCurrent < 0.1 || continuousCurrent > 10)) issue(issues, "requirements.continuousCurrent.value", "invalid_range", "Motor V1 continuous-current range is 0.1 A to 10 A");
  const stallCurrent = quantityValue(requirements.stallCurrent, "requirements.stallCurrent", "A", issues, { positive: true });
  if (stallCurrent !== undefined && stallCurrent > 30) issue(issues, "requirements.stallCurrent.value", "invalid_range", "Motor V1 stall-current maximum is 30 A");
  if (continuousCurrent !== undefined && stallCurrent !== undefined && stallCurrent < continuousCurrent) issue(issues, "requirements.stallCurrent.value", "invalid_range", "Stall current must not be lower than continuous current");
  const pwm = quantityValue(requirements.pwmFrequency, "requirements.pwmFrequency", "Hz", issues, { positive: true });
  if (pwm !== undefined && (pwm < 1_000 || pwm > 100_000)) issue(issues, "requirements.pwmFrequency.value", "invalid_range", "Motor V1 PWM range is 1 kHz to 100 kHz");
  const logic = quantityValue(requirements.logicVoltage, "requirements.logicVoltage", "V", issues, { positive: true });
  if (logic !== undefined && logic !== 3.3 && logic !== 5) issue(issues, "requirements.logicVoltage.value", "unsupported_value", "Motor V1 logic voltage must be 3.3 V or 5 V");
  const ambient = quantityValue(requirements.ambientTemperature, "requirements.ambientTemperature", "K", issues, { positive: true });
  if (ambient !== undefined && (ambient < 253.15 || ambient > 358.15)) issue(issues, "requirements.ambientTemperature.value", "invalid_range", "V1 ambient range is -20 °C to 85 °C");
  const modes = stringArray(requirements.operatingModes, "requirements.operatingModes", MOTOR_MODES, issues);
  if (modes && modes.length === 0) issue(issues, "requirements.operatingModes", "invalid_range", "At least one operating mode is required");
  nullableQuantity(requirements.currentLimitTarget, "requirements.currentLimitTarget", "A", issues, { positive: true });

  const operatingPoint = requireRecord(requirements.operatingPoint, "requirements.operatingPoint", issues);
  if (operatingPoint) {
    rejectUnknownKeys(operatingPoint, "requirements.operatingPoint", ["dutyCycle", "loadCurrent", "loadCurrentBasis", "loadProfile"], issues);
    const dutyCycle = quantityValue(operatingPoint.dutyCycle, "requirements.operatingPoint.dutyCycle", "1", issues, { positive: true });
    if (dutyCycle !== undefined && dutyCycle > 1) issue(issues, "requirements.operatingPoint.dutyCycle.value", "invalid_range", "Duty cycle must not exceed 1");
    const loadCurrent = quantityValue(operatingPoint.loadCurrent, "requirements.operatingPoint.loadCurrent", "A", issues, { positive: true });
    if (loadCurrent !== undefined && stallCurrent !== undefined && loadCurrent > stallCurrent) issue(issues, "requirements.operatingPoint.loadCurrent.value", "invalid_range", "Operating-point load current must not exceed stall current");
    const loadCurrentBasis = requireString(operatingPoint.loadCurrentBasis, "requirements.operatingPoint.loadCurrentBasis", issues);
    if (loadCurrentBasis && loadCurrentBasis !== "continuous_rating" && loadCurrentBasis !== "user_provided") {
      issue(issues, "requirements.operatingPoint.loadCurrentBasis", "unsupported_value", `Unsupported load-current basis ${loadCurrentBasis}`);
    }
    if (loadCurrentBasis === "continuous_rating" && loadCurrent !== undefined && continuousCurrent !== undefined && loadCurrent !== continuousCurrent) {
      issue(issues, "requirements.operatingPoint.loadCurrent.value", "invalid_range", "A continuous-rating operating point must use the declared continuous current");
    }
    if (operatingPoint.loadProfile !== "steady_state") issue(issues, "requirements.operatingPoint.loadProfile", "unsupported_value", "Motor V1 supports only a steady-state loss operating point");
  }

  const motorModel = requireRecord(requirements.motorModel, "requirements.motorModel", issues);
  if (!motorModel) return;
  rejectUnknownKeys(motorModel, "requirements.motorModel", [
    "windingResistance",
    "windingResistanceSource",
    "windingInductance",
    "backEmfConstant",
    "targetSpeed",
  ], issues);
  const resistance = quantityValue(motorModel.windingResistance, "requirements.motorModel.windingResistance", "ohm", issues, { positive: true });
  const resistanceSource = requireString(motorModel.windingResistanceSource, "requirements.motorModel.windingResistanceSource", issues);
  if (resistanceSource && resistanceSource !== "provided" && resistanceSource !== "estimated_from_nominal_voltage_and_stall_current") {
    issue(issues, "requirements.motorModel.windingResistanceSource", "unsupported_value", `Unsupported winding-resistance source ${resistanceSource}`);
  }
  if (resistanceSource === "estimated_from_nominal_voltage_and_stall_current" && resistance !== undefined && motorNominal !== undefined && stallCurrent !== undefined) {
    const expected = motorNominal / stallCurrent;
    if (Math.abs(resistance - expected) > Math.max(1e-12, expected * 1e-9)) {
      issue(issues, "requirements.motorModel.windingResistance.value", "invalid_range", "Estimated winding resistance must equal nominal motor voltage divided by stall current");
    }
  }
  nullableQuantity(motorModel.windingInductance, "requirements.motorModel.windingInductance", "H", issues, { positive: true });
  nullableQuantity(motorModel.backEmfConstant, "requirements.motorModel.backEmfConstant", "V_s_per_rad", issues, { positive: true });
  nullableQuantity(motorModel.targetSpeed, "requirements.motorModel.targetSpeed", "rad_per_s", issues, { nonNegative: true });
}

function validateBuckRequirements(value: unknown, issues: DesignRequestValidationIssue[]): void {
  const requirements = requireRecord(value, "requirements", issues);
  if (!requirements) return;
  rejectUnknownKeys(requirements, "requirements", [
    "inputVoltage",
    "outputVoltage",
    "dcOutputVoltageRegulation",
    "maximumOutputCurrent",
    "ambientTemperature",
    "switchingFrequency",
    "maximumOutputRipple",
    "loadTransientTarget",
  ], issues);
  const input = validateVoltageRange(requirements.inputVoltage, "requirements.inputVoltage", issues);
  if (input.minimum !== undefined && input.minimum < 5) issue(issues, "requirements.inputVoltage.minimum.value", "invalid_range", "Buck V1 minimum input is 5 V");
  if (input.maximum !== undefined && input.maximum > 60) issue(issues, "requirements.inputVoltage.maximum.value", "invalid_range", "Buck V1 maximum input is 60 V");
  const outputVoltage = quantityValue(requirements.outputVoltage, "requirements.outputVoltage", "V", issues, { positive: true });
  if (outputVoltage !== undefined && (outputVoltage < 0.8 || outputVoltage > 24)) issue(issues, "requirements.outputVoltage.value", "invalid_range", "Buck V1 output range is 0.8 V to 24 V");
  if (outputVoltage !== undefined && input.minimum !== undefined && outputVoltage >= input.minimum) issue(issues, "requirements.outputVoltage.value", "invalid_range", "Buck output voltage must be strictly below minimum input voltage");
  if (requirements.dcOutputVoltageRegulation !== undefined) {
    const regulation = requireRecord(requirements.dcOutputVoltageRegulation, "requirements.dcOutputVoltageRegulation", issues);
    if (regulation) {
      rejectUnknownKeys(regulation, "requirements.dcOutputVoltageRegulation", ["minimum", "maximum"], issues);
      const minimum = quantityValue(regulation.minimum, "requirements.dcOutputVoltageRegulation.minimum", "V", issues, { positive: true });
      const maximum = quantityValue(regulation.maximum, "requirements.dcOutputVoltageRegulation.maximum", "V", issues, { positive: true });
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        issue(issues, "requirements.dcOutputVoltageRegulation", "invalid_range", "DC output-voltage regulation minimum must not exceed maximum");
      }
      if (minimum !== undefined && outputVoltage !== undefined && minimum > outputVoltage) {
        issue(issues, "requirements.dcOutputVoltageRegulation.minimum.value", "invalid_range", "DC output-voltage regulation minimum must not exceed the requested nominal output voltage");
      }
      if (maximum !== undefined && outputVoltage !== undefined && maximum < outputVoltage) {
        issue(issues, "requirements.dcOutputVoltageRegulation.maximum.value", "invalid_range", "DC output-voltage regulation maximum must not be below the requested nominal output voltage");
      }
      if (maximum !== undefined && input.minimum !== undefined && maximum >= input.minimum) {
        issue(issues, "requirements.dcOutputVoltageRegulation.maximum.value", "invalid_range", "Buck DC regulation maximum must remain strictly below minimum input voltage");
      }
    }
  }
  const current = quantityValue(requirements.maximumOutputCurrent, "requirements.maximumOutputCurrent", "A", issues, { positive: true });
  if (current !== undefined && (current < 0.1 || current > 10)) issue(issues, "requirements.maximumOutputCurrent.value", "invalid_range", "Buck V1 output-current range is 0.1 A to 10 A");
  const ambient = quantityValue(requirements.ambientTemperature, "requirements.ambientTemperature", "K", issues, { positive: true });
  if (ambient !== undefined && (ambient < 253.15 || ambient > 358.15)) issue(issues, "requirements.ambientTemperature.value", "invalid_range", "V1 ambient range is -20 °C to 85 °C");
  quantityValue(requirements.maximumOutputRipple, "requirements.maximumOutputRipple", "V", issues, { positive: true });

  const switching = requireRecord(requirements.switchingFrequency, "requirements.switchingFrequency", issues);
  if (switching) {
    rejectUnknownKeys(switching, "requirements.switchingFrequency", ["selection", "minimum", "preferred", "maximum"], issues);
    const selection = requireString(switching.selection, "requirements.switchingFrequency.selection", issues);
    if (selection && selection !== "automatic" && selection !== "fixed") issue(issues, "requirements.switchingFrequency.selection", "unsupported_value", `Unsupported switching-frequency selection ${selection}`);
    const minimum = quantityValue(switching.minimum, "requirements.switchingFrequency.minimum", "Hz", issues, { positive: true });
    const maximum = quantityValue(switching.maximum, "requirements.switchingFrequency.maximum", "Hz", issues, { positive: true });
    const preferred = nullableQuantity(switching.preferred, "requirements.switchingFrequency.preferred", "Hz", issues, { positive: true });
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) issue(issues, "requirements.switchingFrequency", "invalid_range", "Switching-frequency minimum must not exceed maximum");
    if (selection === "automatic" && preferred !== null) issue(issues, "requirements.switchingFrequency.preferred", "invalid_range", "Automatic frequency selection must explicitly set preferred to null");
    if (selection === "fixed" && typeof preferred === "number" && minimum !== undefined && maximum !== undefined && (preferred < minimum || preferred > maximum)) {
      issue(issues, "requirements.switchingFrequency.preferred.value", "invalid_range", "Fixed preferred frequency must fall within the declared range");
    }
    if (selection === "fixed" && preferred === null) issue(issues, "requirements.switchingFrequency.preferred", "missing_value", "Fixed frequency selection requires a preferred frequency");
  }

  if (requirements.loadTransientTarget !== null) {
    const transient = requireRecord(requirements.loadTransientTarget, "requirements.loadTransientTarget", issues);
    if (transient) {
      rejectUnknownKeys(transient, "requirements.loadTransientTarget", ["currentStep", "maximumOutputDeviation", "maximumSettlingTime"], issues);
      quantityValue(transient.currentStep, "requirements.loadTransientTarget.currentStep", "A", issues, { positive: true });
      quantityValue(transient.maximumOutputDeviation, "requirements.loadTransientTarget.maximumOutputDeviation", "V", issues, { positive: true });
      quantityValue(transient.maximumSettlingTime, "requirements.loadTransientTarget.maximumSettlingTime", "s", issues, { positive: true });
    }
  }
}

export function validateDesignRequest(input: unknown): DesignRequestValidationIssue[] {
  const issues: DesignRequestValidationIssue[] = [];
  const value = requireRecord(input, "$", issues);
  if (!value) return issues;
  rejectUnknownKeys(value, "$", ["format", "schemaVersion", "application", "requirements", "objective", "constraints", "assumptions", "sourcing", "libraryVersion"], issues);
  if (value.format !== DESIGN_REQUEST_FORMAT) issue(issues, "format", "invalid_format", `Expected ${DESIGN_REQUEST_FORMAT}`);
  if (value.schemaVersion !== DESIGN_REQUEST_SCHEMA_VERSION) issue(issues, "schemaVersion", "unsupported_value", `Only schema version ${DESIGN_REQUEST_SCHEMA_VERSION} is supported`);
  const application = value.application;
  if (application !== "motor.brushed-dc" && application !== "power.buck") issue(issues, "application", "unsupported_value", `Unsupported application ${String(application)}`);
  const objective = requireString(value.objective, "objective", issues);
  if (objective && !OBJECTIVES.has(objective)) issue(issues, "objective", "unsupported_value", `Unsupported objective ${objective}`);
  requireString(value.libraryVersion, "libraryVersion", issues);
  validateAssumptions(value.assumptions, issues);
  validateConstraints(value.constraints, application, issues);
  if (value.sourcing !== undefined) {
    for (const sourcingIssue of validateSourcingPolicy(value.sourcing)) {
      issue(
        issues,
        sourcingIssue.path ? `sourcing.${sourcingIssue.path}` : "sourcing",
        "invalid_type",
        sourcingIssue.message,
      );
    }
  }
  if (application === "motor.brushed-dc") validateMotorRequirements(value.requirements, issues);
  if (application === "power.buck") validateBuckRequirements(value.requirements, issues);
  return issues;
}

export function assertValidDesignRequest(input: unknown): asserts input is DesignRequest {
  const first = validateDesignRequest(input)[0];
  if (first) throw new Error(`${first.path}: ${first.message}`);
}
