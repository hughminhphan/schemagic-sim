import { deepFreeze } from "./canonical";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";

export const V3_PART_CLASS_IDS = deepFreeze([
  "shared.n-channel-power-mosfet",
  "motor.supply-tvs-diode",
] as const);

export type V3PartClassId = typeof V3_PART_CLASS_IDS[number];

const MOSFET_V3_SPEC = {
  operatingRanges: {
    ...PART_CLASS_SPECS["shared.n-channel-power-mosfet"].operatingRanges,
    caseTemperature: { unit: "K", domain: { minimum: 0 } },
  },
  facts: {
    ...PART_CLASS_SPECS["shared.n-channel-power-mosfet"].facts,
    onResistance: {
      kind: "quantity",
      unit: "ohm",
      requiredForAdmission: true,
      requiredRangeParameters: ["drainCurrent", "gateVoltage"],
      domain: { exclusiveMinimum: 0 },
    },
  },
} as const satisfies PartClassSpec;

const TVS_V3_SPEC = {
  operatingRanges: PART_CLASS_SPECS["motor.supply-tvs-diode"].operatingRanges,
  facts: {
    standOffVoltage: PART_CLASS_SPECS["motor.supply-tvs-diode"].facts.standOffVoltage,
    breakdownVoltageMinimum: PART_CLASS_SPECS["motor.supply-tvs-diode"].facts.breakdownVoltageMinimum,
    breakdownVoltageMaximum: PART_CLASS_SPECS["motor.supply-tvs-diode"].facts.breakdownVoltageMaximum,
    clampingBehavior: {
      kind: "text",
      values: ["avalanche", "snapback"],
      requiredForAdmission: true,
    },
    clampingVoltage: {
      kind: "quantity",
      unit: "V",
      requiredForAdmission: true,
      requiredRangeParameters: ["ambientTemperature", "pulseDuration", "testCurrent"],
      domain: { exclusiveMinimum: 0 },
    },
    pulseCurrent: {
      kind: "quantity",
      unit: "A",
      requiredForAdmission: true,
      requiredRangeParameters: ["ambientTemperature", "pulseDuration", "testCurrent"],
      domain: { exclusiveMinimum: 0 },
    },
    pulseWaveform: PART_CLASS_SPECS["motor.supply-tvs-diode"].facts.pulseWaveform,
    // Presence remains structural. Admission deliberately accepts reviewed source data
    // or an explicit unknown; V3 never manufactures this value from V * I * t.
    pulseEnergy: {
      kind: "quantity",
      unit: "J",
      requiredForAdmission: false,
      requiredRangeParameters: ["pulseDuration"],
      domain: { exclusiveMinimum: 0 },
    },
  },
} as const satisfies PartClassSpec;

export const V3_PART_CLASS_SPECS = deepFreeze({
  "shared.n-channel-power-mosfet": MOSFET_V3_SPEC,
  "motor.supply-tvs-diode": TVS_V3_SPEC,
} as const satisfies Readonly<Record<V3PartClassId, PartClassSpec>>);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsV3AgainstSpec<Spec extends PartClassSpec> = {
  -readonly [Key in keyof Spec["facts"]]: ProfileFact<FactValue<Extract<Spec["facts"][Key], FactSpec>>>;
};

export type CoreFactsV3For<ClassId extends V3PartClassId> = FactsV3AgainstSpec<typeof V3_PART_CLASS_SPECS[ClassId]>;
