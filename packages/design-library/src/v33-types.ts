import type { DesignProfileV1 } from "./types";
import type { MountedGeometryFactsV2 } from "./v2-types";
import type { CoreFactsV33For, V33PartClassId } from "./v33-specs";

export const FACTS_SCHEMA_VERSION_V33 = "3.3.0" as const;

export type OutputCurrentEvidenceRoleV33 =
  | "guaranteed_operating_limit"
  | "continuous_capability_statement"
  | "typical_observation"
  | "board_specific_observation"
  | "absolute_rating"
  | "protection_threshold";

export type SwitchingFrequencyArchitectureV33 =
  | "fixed_oscillator"
  | "resistor_programmed"
  | "externally_synchronized"
  | "fixed_or_synchronized";

export type SwitchingFrequencyEvidenceRoleV33 =
  | "production_spread"
  | "guaranteed_adjustment_range"
  | "recommended_setting"
  | "typical_observation";

export type FeedbackReferenceEvidenceRoleV33 = "production_spread" | "typical_observation";
export type CurrentLimitEvidenceRoleV33 = "protection_threshold" | "guaranteed_operating_limit" | "typical_observation";
export type TimingEvidenceRoleV33 = "guaranteed_bound" | "typical_observation";
export type MaximumEvidenceRoleV33 = "guaranteed_maximum" | "typical_observation";
export type ThermalResistanceEvidenceRoleV33 =
  | "guaranteed_maximum"
  | "test_characteristic"
  | "board_specific_observation"
  | "typical_observation";
export type CapacitanceRequirementV33 =
  | "required_nominal_value"
  | "recommended_value"
  | "typical_observation"
  | "application_dependent"
  | "not_specified";

export type PowerIntegratedSynchronousBuckFactsV33 =
  CoreFactsV33For<"power.integrated-synchronous-buck-regulator">
  & MountedGeometryFactsV2;

export type FactsV33For<ClassId extends V33PartClassId> =
  ClassId extends "power.integrated-synchronous-buck-regulator"
    ? PowerIntegratedSynchronousBuckFactsV33
    : never;

export type DesignProfileV33<ClassId extends V33PartClassId = V33PartClassId> =
  ClassId extends V33PartClassId
    ? Omit<DesignProfileV1<ClassId, FactsV33For<ClassId>>, "factsSchemaVersion"> & {
        schemaVersion: "1.0.0";
        factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V33;
      }
    : never;
