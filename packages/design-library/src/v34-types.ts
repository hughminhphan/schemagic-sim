import type { DesignProfileV1 } from "./types";
import type { MountedGeometryFactsV2 } from "./v2-types";
import type { CoreFactsV34For, V34PartClassId } from "./v34-specs";

export const FACTS_SCHEMA_VERSION_V34 = "3.4.0" as const;

export type PowerInductorFactsV34 = CoreFactsV34For<"power.power-inductor"> & MountedGeometryFactsV2;

export type FactsV34For<ClassId extends V34PartClassId> =
  ClassId extends "power.power-inductor"
    ? PowerInductorFactsV34
    : never;

export type DesignProfileV34<ClassId extends V34PartClassId = V34PartClassId> =
  ClassId extends V34PartClassId
    ? Omit<DesignProfileV1<ClassId, FactsV34For<ClassId>>, "factsSchemaVersion"> & {
        schemaVersion: "1.0.0";
        factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V34;
      }
    : never;
