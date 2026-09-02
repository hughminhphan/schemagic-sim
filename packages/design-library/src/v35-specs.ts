import { deepFreeze } from "./canonical";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";
import { V33_PART_CLASS_SPECS } from "./v33-specs";
import { POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34, V34_PART_CLASS_SPECS } from "./v34-specs";

export const V35_PART_CLASS_IDS = deepFreeze([
  "power.integrated-synchronous-buck-regulator",
  "power.power-inductor",
  "shared.mlcc-capacitor",
] as const);

export type V35PartClassId = typeof V35_PART_CLASS_IDS[number];

/**
 * Facts 3.5.0 is the first contract that can express a *bound-typed* field: a
 * value the manufacturer publishes as a guaranteed production limit over the
 * declared conditions, as distinct from a nominal, nameplate, typical, or
 * point-characterization observation. Every bound-typed field is optional and
 * additive; a profile that omits it is exactly as valid as it was under its
 * predecessor contract, and consumers must keep treating the predecessor
 * nominal/point fields as observations.
 */
export const V35_BOUND_TYPED_FACT_IDS = deepFreeze({
  "power.power-inductor": ["inductanceMinimum", "coreLossMaximum"],
  "shared.mlcc-capacitor": ["effectiveCapacitanceMinimum", "esrMaximum"],
  "power.integrated-synchronous-buck-regulator": [
    "minimumOnTimeMaximum",
    "minimumOffTimeMaximum",
    "thermalResistanceJunctionAmbient",
  ],
} as const satisfies Readonly<Record<V35PartClassId, readonly string[]>>);

/**
 * A junction-to-ambient thermal resistance is only comparable when the board it
 * was measured on is named. `jedec_2s2p` is the standard high-K four-layer test
 * board; `declared` means the profile's evidence names a different, explicitly
 * described board in the fact locator.
 */
export const V35_THERMAL_RESISTANCE_BOARD_VALUES = deepFreeze(["jedec_2s2p", "declared"] as const);

export type ThermalResistanceBoardQualifierV35 = typeof V35_THERMAL_RESISTANCE_BOARD_VALUES[number];

/**
 * Bound-typed facts are paired with the conditions they are bounded over. A
 * reviewed bound without its conditions is not a bound, so each declares its
 * required range parameters exactly like its observation predecessor.
 */
export const V35_BOUND_CONDITION_POLICY = deepFreeze({
  inductanceMinimum: ["ambientTemperature", "switchingFrequency", "testCurrent"],
  coreLossMaximum: ["switchingFrequency", "testCurrent"],
  effectiveCapacitanceMinimum: ["ambientTemperature", "dcBias"],
  esrMaximum: ["switchingFrequency"],
  minimumOnTimeMaximum: [],
  minimumOffTimeMaximum: [],
  thermalResistanceJunctionAmbient: [],
} as const);

const POWER_INDUCTOR_V35_SPEC = {
  operatingRanges: V34_PART_CLASS_SPECS["power.power-inductor"].operatingRanges,
  facts: {
    ...V34_PART_CLASS_SPECS["power.power-inductor"].facts,
    /**
     * Guaranteed minimum inductance over tolerance, DC current bias
     * (`testCurrent`), temperature, and switching frequency.
     */
    inductanceMinimum: {
      kind: "quantity",
      unit: "H",
      requiredForAdmission: false,
      requiredRangeParameters: V35_BOUND_CONDITION_POLICY.inductanceMinimum,
      domain: { exclusiveMinimum: 0 },
    },
    /** Guaranteed maximum core loss over the declared excitation. */
    coreLossMaximum: {
      kind: "quantity",
      unit: "W",
      requiredForAdmission: false,
      requiredRangeParameters: V35_BOUND_CONDITION_POLICY.coreLossMaximum,
      domain: { exclusiveMinimum: 0 },
    },
  },
} as const satisfies PartClassSpec;

const MLCC_CAPACITOR_V35_SPEC = {
  operatingRanges: PART_CLASS_SPECS["shared.mlcc-capacitor"].operatingRanges,
  facts: {
    ...PART_CLASS_SPECS["shared.mlcc-capacitor"].facts,
    /** Guaranteed minimum effective capacitance at the declared DC bias and temperature. */
    effectiveCapacitanceMinimum: {
      kind: "quantity",
      unit: "F",
      requiredForAdmission: false,
      requiredRangeParameters: V35_BOUND_CONDITION_POLICY.effectiveCapacitanceMinimum,
      domain: { exclusiveMinimum: 0 },
    },
    /** Guaranteed maximum equivalent series resistance at the declared frequency. */
    esrMaximum: {
      kind: "quantity",
      unit: "ohm",
      requiredForAdmission: false,
      requiredRangeParameters: V35_BOUND_CONDITION_POLICY.esrMaximum,
      domain: { exclusiveMinimum: 0 },
    },
  },
} as const satisfies PartClassSpec;

const INTEGRATED_SYNCHRONOUS_BUCK_V35_SPEC = {
  operatingRanges: V33_PART_CLASS_SPECS["power.integrated-synchronous-buck-regulator"].operatingRanges,
  facts: {
    ...V33_PART_CLASS_SPECS["power.integrated-synchronous-buck-regulator"].facts,
    /** Guaranteed maximum controllable on-time floor. */
    minimumOnTimeMaximum: {
      kind: "quantity",
      unit: "s",
      requiredForAdmission: false,
      domain: { exclusiveMinimum: 0 },
    },
    /** Guaranteed maximum enforced off-time floor. */
    minimumOffTimeMaximum: {
      kind: "quantity",
      unit: "s",
      requiredForAdmission: false,
      domain: { exclusiveMinimum: 0 },
    },
    /** Junction-to-ambient thermal resistance; meaningless without its board qualifier. */
    thermalResistanceJunctionAmbient: {
      kind: "quantity",
      unit: "K/W",
      requiredForAdmission: false,
      domain: { exclusiveMinimum: 0 },
    },
    /** Names the board the paired thermal resistance was established on. */
    thermalResistanceJunctionAmbientBoard: {
      kind: "text",
      values: V35_THERMAL_RESISTANCE_BOARD_VALUES,
      requiredForAdmission: false,
    },
  },
} as const satisfies PartClassSpec;

export const V35_PART_CLASS_SPECS = deepFreeze({
  "power.integrated-synchronous-buck-regulator": INTEGRATED_SYNCHRONOUS_BUCK_V35_SPEC,
  "power.power-inductor": POWER_INDUCTOR_V35_SPEC,
  "shared.mlcc-capacitor": MLCC_CAPACITOR_V35_SPEC,
} as const satisfies Readonly<Record<V35PartClassId, PartClassSpec>>);

/** The inclusive excitation policy is inherited byte-for-byte from facts 3.4.0. */
export const POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V35 = POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34;

/**
 * Migration policy for facts 3.5.0.
 *
 * - Additive only. Every 3.5.0 field is optional; no predecessor field changes
 *   name, unit, domain, or meaning.
 * - No automatic migration. A 3.4.0, 3.3.0, or 2.0.0 profile stays valid at its
 *   own version; nothing rewrites it, and every predecessor validator keeps
 *   rejecting the 3.5.0 keys as unknown. Adopting 3.5.0 is an explicit,
 *   independently reviewed re-authoring of one profile.
 * - Still closed. Unknown keys are rejected at 3.5.0 exactly as before.
 * - Bounds never appear by inference. A bound-typed field may only be reviewed
 *   when the manufacturer publishes it as a guaranteed limit over conditions
 *   that the fact's `validFor` records; otherwise it stays `unknown` and the
 *   consumer keeps the predecessor observation semantics.
 */
export const FACTS_V35_MIGRATION_POLICY = deepFreeze({
  contract: "additive_optional_fields_only",
  automaticMigration: "none",
  predecessorVersionsStillAccepted: ["2.0.0", "3.0.0", "3.1.0", "3.2.0", "3.3.0", "3.4.0"],
  unknownKeys: "rejected",
  boundAdmission: "explicit_published_guaranteed_limit_with_recorded_conditions_only",
} as const);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsV35AgainstSpec<Spec extends PartClassSpec> = {
  -readonly [Key in keyof Spec["facts"]]: ProfileFact<FactValue<Extract<Spec["facts"][Key], FactSpec>>>;
};

export type CoreFactsV35For<ClassId extends V35PartClassId> = FactsV35AgainstSpec<typeof V35_PART_CLASS_SPECS[ClassId]>;
