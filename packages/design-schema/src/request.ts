import type { SourcingPolicy } from "@opencircuit/sourcing-schema";
import type {
  BrushedDcMotorRequirements,
  BuckRequirements,
  DesignApplication,
  DesignAssumption,
  DesignObjective,
  V1TopologyFamily,
} from "./application";
import type { Area, Length, Temperature } from "./quantity";

export const DESIGN_REQUEST_FORMAT = "schemagic-design-request" as const;
export const DESIGN_REQUEST_SCHEMA_VERSION = 1 as const;

export interface UserConstraints {
  allowedTopologyFamilies: V1TopologyFamily[];
  maximumJunctionTemperature: Temperature;
  allowedPackages: string[];
  maximumComponentHeight: Length | null;
  maximumBoardArea: Area | null;
  allowEstimatedValues: boolean;
  allowUnknownWarnings: boolean;
  allowUnknownHardConstraints: boolean;
}

interface DesignRequestBase<Application extends DesignApplication, Requirements> {
  format: typeof DESIGN_REQUEST_FORMAT;
  schemaVersion: typeof DESIGN_REQUEST_SCHEMA_VERSION;
  application: Application;
  requirements: Requirements;
  objective: DesignObjective;
  constraints: UserConstraints;
  assumptions: DesignAssumption[];
  sourcing?: SourcingPolicy;
  libraryVersion: string;
}

export type BrushedDcMotorDesignRequest = DesignRequestBase<"motor.brushed-dc", BrushedDcMotorRequirements>;
export type BuckDesignRequest = DesignRequestBase<"power.buck", BuckRequirements>;
export type DesignRequestV1 = BrushedDcMotorDesignRequest | BuckDesignRequest;
export type DesignRequest = DesignRequestV1;
