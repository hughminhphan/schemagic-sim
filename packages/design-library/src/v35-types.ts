import type { DesignProfileV1 } from "./types";
import type { MountedGeometryFactsV2 } from "./v2-types";
import type { CoreFactsV35For, V35PartClassId } from "./v35-specs";

export const FACTS_SCHEMA_VERSION_V35 = "3.5.0" as const;

export type PowerInductorFactsV35 = CoreFactsV35For<"power.power-inductor"> & MountedGeometryFactsV2;
export type MlccCapacitorFactsV35 = CoreFactsV35For<"shared.mlcc-capacitor"> & MountedGeometryFactsV2;
export type PowerIntegratedSynchronousBuckFactsV35 =
  CoreFactsV35For<"power.integrated-synchronous-buck-regulator">
  & MountedGeometryFactsV2;

export type FactsV35For<ClassId extends V35PartClassId> =
  ClassId extends "power.power-inductor"
    ? PowerInductorFactsV35
    : ClassId extends "shared.mlcc-capacitor"
      ? MlccCapacitorFactsV35
      : ClassId extends "power.integrated-synchronous-buck-regulator"
        ? PowerIntegratedSynchronousBuckFactsV35
        : never;

export type DesignProfileV35<ClassId extends V35PartClassId = V35PartClassId> =
  ClassId extends V35PartClassId
    ? Omit<DesignProfileV1<ClassId, FactsV35For<ClassId>>, "factsSchemaVersion"> & {
        schemaVersion: "1.0.0";
        factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V35;
      }
    : never;
