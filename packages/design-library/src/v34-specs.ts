import { deepFreeze } from "./canonical";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";

export const V34_PART_CLASS_IDS = deepFreeze([
  "power.power-inductor",
] as const);

export type V34PartClassId = typeof V34_PART_CLASS_IDS[number];

/**
 * Facts 3.4.0 is the first contract that admits either manufacturer test-current
 * or test-voltage excitation for reviewed inductance. Both are allowed when the
 * source publishes both; each named condition remains unique.
 */
export const POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34 = deepFreeze({
  factId: "inductance",
  requiredExactlyOnce: ["switchingFrequency"],
  requiredAtLeastOneOf: ["testCurrent", "testVoltage"],
  uniqueWhenPresent: ["testCurrent", "testVoltage"],
} as const);

const V2_POWER_INDUCTOR_SPEC = PART_CLASS_SPECS["power.power-inductor"];

const POWER_INDUCTOR_V34_SPEC = {
  operatingRanges: V2_POWER_INDUCTOR_SPEC.operatingRanges,
  facts: {
    ...V2_POWER_INDUCTOR_SPEC.facts,
    inductance: {
      ...V2_POWER_INDUCTOR_SPEC.facts.inductance,
      requiredRangeParameters: POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34.requiredExactlyOnce,
    },
  },
} as const satisfies PartClassSpec;

export const V34_PART_CLASS_SPECS = deepFreeze({
  "power.power-inductor": POWER_INDUCTOR_V34_SPEC,
} as const satisfies Readonly<Record<V34PartClassId, PartClassSpec>>);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsV34AgainstSpec<Spec extends PartClassSpec> = {
  -readonly [Key in keyof Spec["facts"]]: ProfileFact<FactValue<Extract<Spec["facts"][Key], FactSpec>>>;
};

export type CoreFactsV34For<ClassId extends V34PartClassId> = FactsV34AgainstSpec<typeof V34_PART_CLASS_SPECS[ClassId]>;
