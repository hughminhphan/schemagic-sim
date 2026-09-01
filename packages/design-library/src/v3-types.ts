import type {
  DesignProfileV1,
  OperatingRange,
  ProfileFact,
} from "./types";
import type { MountedGeometryFactsV2 } from "./v2-types";
import type { CoreFactsV3For, V3PartClassId } from "./v3-specs";

export const FACTS_SCHEMA_VERSION_V3 = "3.0.0" as const;

export const MOSFET_ON_RESISTANCE_TEMPERATURE_PARAMETERS_V3 = [
  "ambientTemperature",
  "caseTemperature",
  "junctionTemperature",
] as const;

export const TVS_MATCHED_CONDITION_PARAMETERS_V3 = [
  "ambientTemperature",
  "pulseDuration",
  "testCurrent",
] as const;

export type MosfetOnResistanceTemperatureParameterV3 =
  typeof MOSFET_ON_RESISTANCE_TEMPERATURE_PARAMETERS_V3[number];

export type ClampingBehaviorV3 = "avalanche" | "snapback";

/** V3 deliberately retains the V1 condition shape; no implicit point/range conversion is allowed. */
export type OperatingRangeV3 = OperatingRange;

export type NChannelPowerMosfetFactsV3 =
  CoreFactsV3For<"shared.n-channel-power-mosfet">
  & MountedGeometryFactsV2;

export type SupplyTvsDiodeFactsV3 =
  Omit<CoreFactsV3For<"motor.supply-tvs-diode">, "clampingBehavior">
  & { clampingBehavior: ProfileFact<ClampingBehaviorV3> }
  & MountedGeometryFactsV2;

export type FactsV3For<ClassId extends V3PartClassId> =
  ClassId extends "shared.n-channel-power-mosfet"
    ? NChannelPowerMosfetFactsV3
    : SupplyTvsDiodeFactsV3;

export type DesignProfileV3<ClassId extends V3PartClassId = V3PartClassId> =
  ClassId extends V3PartClassId
    ? Omit<DesignProfileV1<ClassId, FactsV3For<ClassId>>, "factsSchemaVersion"> & {
        schemaVersion: "1.0.0";
        factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V3;
      }
    : never;
