import type { DesignProfileV1 } from "./types";
import type { MountedGeometryFactsV2 } from "./v2-types";
import type { CoreFactsV32For, V32PartClassId } from "./v32-specs";

export const FACTS_SCHEMA_VERSION_V32 = "3.2.0" as const;

export type IntegratedBridgeCurrentRoleV32 =
  | "guaranteed_operating_limit"
  | "typical_observation"
  | "board_specific_observation"
  | "absolute_rating"
  | "protection_threshold";

export type TimingEvidenceRoleV32 = "guaranteed_bound" | "typical_observation";
export type MaximumEvidenceRoleV32 = "guaranteed_maximum" | "typical_observation";
export type CapacitanceRequirementV32 =
  | "required_minimum"
  | "recommended_value"
  | "typical_observation"
  | "application_dependent"
  | "not_specified";

export type MotorIntegratedHBridgeFactsV32 =
  CoreFactsV32For<"motor.integrated-h-bridge">
  & MountedGeometryFactsV2;

export type FactsV32For<ClassId extends V32PartClassId> =
  ClassId extends "motor.integrated-h-bridge"
    ? MotorIntegratedHBridgeFactsV32
    : never;

export type DesignProfileV32<ClassId extends V32PartClassId = V32PartClassId> =
  ClassId extends V32PartClassId
    ? Omit<DesignProfileV1<ClassId, FactsV32For<ClassId>>, "factsSchemaVersion"> & {
        schemaVersion: "1.0.0";
        factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V32;
      }
    : never;
