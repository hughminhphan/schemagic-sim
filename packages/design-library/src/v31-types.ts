import type { DesignProfileV1 } from "./types";
import type { MountedGeometryFactsV2 } from "./v2-types";
import type { CoreFactsV31For, V31PartClassId } from "./v31-specs";

export const FACTS_SCHEMA_VERSION_V31 = "3.1.0" as const;

export type BridgeVoltageInterfaceV31 = "motor_bus_supply_pin" | "switch_node_only";
export type DriverBiasSourceV31 = "external_supply" | "internal_regulator";
export type DeadTimeControlV31 = "fixed" | "adaptive" | "programmable" | "external";
export type CurrentSenseInterfaceV31 = "none" | "amplifier" | "comparator";
export type TimingEvidenceRoleV31 = "guaranteed_bound" | "typical_observation";

export type MotorFullBridgeGateDriverFactsV31 =
  CoreFactsV31For<"motor.full-bridge-gate-driver">
  & MountedGeometryFactsV2;

export type FactsV31For<ClassId extends V31PartClassId> =
  ClassId extends "motor.full-bridge-gate-driver"
    ? MotorFullBridgeGateDriverFactsV31
    : never;

export type DesignProfileV31<ClassId extends V31PartClassId = V31PartClassId> =
  ClassId extends V31PartClassId
    ? Omit<DesignProfileV1<ClassId, FactsV31For<ClassId>>, "factsSchemaVersion"> & {
        schemaVersion: "1.0.0";
        factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V31;
      }
    : never;
