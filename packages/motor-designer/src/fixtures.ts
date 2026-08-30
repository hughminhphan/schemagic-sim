import type { BrushedDcMotorDesignRequest, Quantity, SIUnit } from "@opencircuit/design-schema";
import { MOTOR_LIBRARY_VERSION } from "./catalog";

function q<Unit extends SIUnit>(value: number, unit: Unit, displayUnit: string): Quantity<Unit> {
  return { value, unit, displayUnit };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

export const M1_COMPACT_REQUEST = freeze<BrushedDcMotorDesignRequest>({
  format: "schemagic-design-request",
  schemaVersion: 1,
  application: "motor.brushed-dc",
  requirements: {
    supplyVoltage: { minimum: q(9, "V", "V"), nominal: q(12, "V", "V"), maximum: q(16, "V", "V") },
    motorNominalVoltage: q(12, "V", "V"),
    continuousCurrent: q(1.5, "A", "A"),
    stallCurrent: q(5, "A", "A"),
    pwmFrequency: q(20_000, "Hz", "kHz"),
    logicVoltage: q(3.3, "V", "V"),
    ambientTemperature: q(313.15, "K", "°C"),
    operatingModes: ["forward", "reverse", "coast", "brake"],
    currentLimitTarget: null,
    operatingPoint: {
      dutyCycle: q(0.8, "1", "%"),
      loadCurrent: q(1.5, "A", "A"),
      loadCurrentBasis: "continuous_rating",
      loadProfile: "steady_state",
    },
    motorModel: {
      windingResistance: q(2.4, "ohm", "Ω"),
      windingResistanceSource: "estimated_from_nominal_voltage_and_stall_current",
      windingInductance: null,
      backEmfConstant: null,
      targetSpeed: null,
    },
  },
  objective: "balanced",
  constraints: {
    allowedTopologyFamilies: ["motor.hbridge.integrated"],
    maximumJunctionTemperature: q(398.15, "K", "°C"),
    allowedPackages: [],
    maximumComponentHeight: null,
    maximumBoardArea: null,
    allowEstimatedValues: true,
    allowUnknownWarnings: true,
    allowUnknownHardConstraints: false,
  },
  assumptions: [
    {
      id: "m1.loss-operating-point",
      description: "Loss and efficiency are evaluated at 80% PWM duty and the declared 1.5 A continuous rating under a steady-state load.",
      source: "fixture",
      affects: ["requirements.operatingPoint", "efficiency", "loss", "temperature"],
    },
    {
      id: "m1.winding-resistance-estimate",
      description: "Winding resistance is estimated as 12 V divided by 5 A stall current.",
      source: "derived",
      affects: ["requirements.motorModel.windingResistance", "pwm_loaded_steady_state", "stall_or_current_limit"],
    },
    {
      id: "m1.dynamic-motor-data-unavailable",
      description: "Winding inductance, back-EMF constant, and target speed are unavailable, so startup and speed-dependent simulations are not eligible.",
      source: "unavailable",
      affects: ["startup", "fast_decay_brake"],
    },
    {
      id: "m1.no-current-limit-target",
      description: "No user current-limit target is imposed; device safety limits remain hard constraints.",
      source: "fixture",
      affects: ["requirements.currentLimitTarget"],
    },
    {
      id: "m1.thermal-ceiling",
      description: "The reference fixture uses a 125 °C maximum estimated junction temperature.",
      source: "fixture",
      affects: ["constraints.maximumJunctionTemperature"],
    },
    {
      id: "m1.no-sourcing-policy",
      description: "This electrical reference request deliberately omits live sourcing; sourcing behavior is covered by separate synthetic fixtures.",
      source: "fixture",
      affects: ["sourcing"],
    },
  ],
  libraryVersion: MOTOR_LIBRARY_VERSION,
});

export const M2_POWER_REQUEST = freeze<BrushedDcMotorDesignRequest>({
  format: "schemagic-design-request",
  schemaVersion: 1,
  application: "motor.brushed-dc",
  requirements: {
    supplyVoltage: { minimum: q(18, "V", "V"), nominal: q(24, "V", "V"), maximum: q(30, "V", "V") },
    motorNominalVoltage: q(24, "V", "V"),
    continuousCurrent: q(5, "A", "A"),
    stallCurrent: q(20, "A", "A"),
    pwmFrequency: q(20_000, "Hz", "kHz"),
    logicVoltage: q(3.3, "V", "V"),
    ambientTemperature: q(323.15, "K", "°C"),
    operatingModes: ["forward", "reverse", "coast", "brake"],
    currentLimitTarget: null,
    operatingPoint: {
      dutyCycle: q(0.8, "1", "%"),
      loadCurrent: q(5, "A", "A"),
      loadCurrentBasis: "continuous_rating",
      loadProfile: "steady_state",
    },
    motorModel: {
      windingResistance: q(1.2, "ohm", "Ω"),
      windingResistanceSource: "estimated_from_nominal_voltage_and_stall_current",
      windingInductance: null,
      backEmfConstant: null,
      targetSpeed: null,
    },
  },
  objective: "efficiency",
  constraints: {
    allowedTopologyFamilies: ["motor.hbridge.external-nmos"],
    maximumJunctionTemperature: q(398.15, "K", "°C"),
    allowedPackages: [],
    maximumComponentHeight: null,
    maximumBoardArea: null,
    allowEstimatedValues: true,
    allowUnknownWarnings: true,
    allowUnknownHardConstraints: false,
  },
  assumptions: [
    {
      id: "m2.loss-operating-point",
      description: "Loss and efficiency are evaluated at 80% PWM duty and the declared 5 A continuous rating under a steady-state load.",
      source: "fixture",
      affects: ["requirements.operatingPoint", "efficiency", "loss", "temperature"],
    },
    {
      id: "m2.winding-resistance-estimate",
      description: "Winding resistance is estimated as 24 V divided by 20 A stall current.",
      source: "derived",
      affects: ["requirements.motorModel.windingResistance", "pwm_loaded_steady_state", "stall_or_current_limit"],
    },
    {
      id: "m2.dynamic-motor-data-unavailable",
      description: "Winding inductance, back-EMF constant, and target speed are unavailable, so startup and speed-dependent simulations are not eligible.",
      source: "unavailable",
      affects: ["startup", "fast_decay_brake"],
    },
    {
      id: "m2.no-current-limit-target",
      description: "No user current-limit target is imposed; device safety limits remain hard constraints.",
      source: "fixture",
      affects: ["requirements.currentLimitTarget"],
    },
    {
      id: "m2.thermal-ceiling",
      description: "The reference fixture uses a 125 °C maximum estimated junction temperature.",
      source: "fixture",
      affects: ["constraints.maximumJunctionTemperature"],
    },
    {
      id: "m2.no-sourcing-policy",
      description: "This electrical reference request deliberately omits live sourcing; sourcing behavior is covered by separate synthetic fixtures.",
      source: "fixture",
      affects: ["sourcing"],
    },
  ],
  libraryVersion: MOTOR_LIBRARY_VERSION,
});
