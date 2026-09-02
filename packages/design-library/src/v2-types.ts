import type { BuckDesignRequestV2 } from "@opencircuit/design-schema";
import type {
  DesignProfileV1,
  PartClassId,
  ProfileEvidenceRef,
  ProfileFact,
  ProfileQuantity,
  ProfileUnit,
} from "./types";
import type { FactsFor } from "./specs";
import type { DesignProfileV3 } from "./v3-types";
import type { DesignProfileV31 } from "./v31-types";
import type { DesignProfileV32 } from "./v32-types";
import type { DesignProfileV33 } from "./v33-types";
import type { DesignProfileV34 } from "./v34-types";
import type { DesignProfileV35 } from "./v35-types";

export const FACTS_SCHEMA_VERSION_V2 = "2.0.0" as const;

export type BoardAreaBasisV2 =
  | "manufacturer_recommended_land_pattern_bounding_box"
  | "reviewed_assembly_footprint_bounding_box";

export interface BoardAreaDimensionTermV2 {
  axis: "x" | "y";
  dimensionId: string;
  multiplier: number;
  maximum: ProfileQuantity<"m">;
  evidence: ProfileEvidenceRef[];
}

export interface BoardAreaProjectionV2 {
  area: ProfileQuantity<"m2">;
  basis: BoardAreaBasisV2;
  calculation: "maximum_x_span_times_maximum_y_span";
  sourceDimensions: BoardAreaDimensionTermV2[];
}

export type MaximumHeightBasisV2 =
  | "manufacturer_package_maximum_in_surface_mount_orientation"
  | "reviewed_assembly_envelope_maximum";

export interface MaximumHeightProjectionV2 {
  height: ProfileQuantity<"m">;
  basis: MaximumHeightBasisV2;
}

export interface MountedGeometryFactsV2 {
  mountedGeometry: {
    boardArea: ProfileFact<BoardAreaProjectionV2>;
    maximumHeight: ProfileFact<MaximumHeightProjectionV2>;
  };
}

export type DesignProfileWithFactsV2<
  ClassId extends PartClassId,
  Facts extends object,
> = Omit<DesignProfileV1<ClassId, Facts>, "factsSchemaVersion"> & {
  schemaVersion: "1.0.0";
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V2;
};

export type DesignProfileEnvelope =
  | DesignProfileV1
  | DesignProfileWithFactsV2<PartClassId, object>
  | DesignProfileV3
  | DesignProfileV31
  | DesignProfileV32
  | DesignProfileV33
  | DesignProfileV34
  | DesignProfileV35;

export interface ReviewedDesignLibraryEnvelope {
  version: string;
  contentHash: `sha256:${string}`;
  profiles: DesignProfileEnvelope[];
  diagnostics: string[];
}

export interface DesignProfileFactsV2AuthoringOverrides {
  mountedGeometry: MountedGeometryFactsV2["mountedGeometry"] | null;
  powerClaims:
    | Omit<PowerIntegratedSynchronousBuckFactsV2, "mountedGeometry">
    | Omit<PowerExternalFetSynchronousBuckFactsV2, "mountedGeometry">
    | null;
}

export type DesignProfileFactsV1ToV2MigrationPlan = Readonly<{
  status: "needs_evidence" | "ready_for_authored_v2";
  sourceProfileId: string;
  unresolvedPaths: string[];
  draft: DesignProfileWithFactsV2<PartClassId, object> | null;
}>;

export type QuantityClaimKindV2 =
  | "guaranteed_minimum"
  | "typical"
  | "guaranteed_maximum"
  | "absolute_maximum"
  | "recommended";

export type QuantityClaimBasisV2 =
  | "operating_range"
  | "production_spread"
  | "configurable_range"
  | "normal_operation_rating"
  | "absolute_rating"
  | "recommended_setting"
  | "test_characteristic";

export type ProfileConditionV2 =
  | {
      parameterId: string;
      kind: "quantity_range";
      minimum: ProfileQuantity | null;
      maximum: ProfileQuantity | null;
      evidence: ProfileEvidenceRef[];
    }
  | {
      parameterId: string;
      kind: "token_equals";
      value: string;
      evidence: ProfileEvidenceRef[];
    };

export interface ProfileQuantityClaimV2<Unit extends ProfileUnit> {
  claimKind: QuantityClaimKindV2;
  basis: QuantityClaimBasisV2;
  value: ProfileQuantity<Unit> | null;
  state: "reviewed" | "calculated" | "estimated" | "unknown";
  evidence: ProfileEvidenceRef[];
  validFor: ProfileConditionV2[];
  explanation: string;
}

export type QuantityClaimV2<
  Unit extends ProfileUnit,
  Kind extends QuantityClaimKindV2,
  Basis extends QuantityClaimBasisV2,
> = ProfileQuantityClaimV2<Unit> & { claimKind: Kind; basis: Basis };

export interface ConfiguredProductionSpreadV2<Unit extends ProfileUnit> {
  settingId: string;
  setting: ProfileFact<string>;
  minimum: QuantityClaimV2<Unit, "guaranteed_minimum", "production_spread">;
  typical: QuantityClaimV2<Unit, "typical", "production_spread">;
  maximum: QuantityClaimV2<Unit, "guaranteed_maximum", "production_spread">;
}

type Claim<
  Unit extends ProfileUnit,
  Kind extends QuantityClaimKindV2,
  Basis extends QuantityClaimBasisV2,
> = QuantityClaimV2<Unit, Kind, Basis>;

export interface PowerIntegratedSynchronousBuckFactsV2 extends MountedGeometryFactsV2 {
  inputVoltageMinimum: Claim<"V", "guaranteed_minimum", "operating_range">;
  inputVoltageMaximum: Claim<"V", "guaranteed_maximum", "operating_range">;
  outputVoltageMinimum: Claim<"V", "guaranteed_minimum", "operating_range">;
  outputVoltageMaximum: Claim<"V", "guaranteed_maximum", "operating_range">;
  outputCurrentCapabilityMinimum: Claim<"A", "guaranteed_minimum", "normal_operation_rating">;
  currentLimitMinimum: Claim<"A", "guaranteed_minimum", "production_spread">;
  currentLimitTypical: Claim<"A", "typical", "production_spread">;
  currentLimitMaximum: Claim<"A", "guaranteed_maximum", "production_spread">;
  switchingFrequencyMinimum: Claim<"Hz", "guaranteed_minimum", "operating_range">;
  switchingFrequencyRecommended: Claim<"Hz", "recommended", "recommended_setting">;
  switchingFrequencyMaximum: Claim<"Hz", "guaranteed_maximum", "operating_range">;
  minimumOnTimeMaximum: Claim<"s", "guaranteed_maximum", "production_spread">;
  minimumOffTimeMaximum: Claim<"s", "guaranteed_maximum", "production_spread">;
  feedbackReferenceMinimum: Claim<"V", "guaranteed_minimum", "production_spread">;
  feedbackReferenceTypical: Claim<"V", "typical", "production_spread">;
  feedbackReferenceMaximum: Claim<"V", "guaranteed_maximum", "production_spread">;
  quiescentCurrentMaximum: Claim<"A", "guaranteed_maximum", "production_spread">;
  junctionToAmbientThermalResistanceMaximum: Claim<"K/W", "guaranteed_maximum", "test_characteristic">;
  maximumJunctionTemperature: Claim<"K", "absolute_maximum", "absolute_rating">;
  controlEvidenceBasis: ProfileFact<string>;
  highSideOnResistanceMaximum: Claim<"ohm", "guaranteed_maximum", "test_characteristic">;
  lowSideOnResistanceMaximum: Claim<"ohm", "guaranteed_maximum", "test_characteristic">;
  riseTimeMaximum: Claim<"s", "guaranteed_maximum", "test_characteristic">;
  fallTimeMaximum: Claim<"s", "guaranteed_maximum", "test_characteristic">;
}

export interface PowerExternalFetSynchronousBuckFactsV2 extends MountedGeometryFactsV2 {
  inputVoltageMinimum: Claim<"V", "guaranteed_minimum", "operating_range">;
  inputVoltageMaximum: Claim<"V", "guaranteed_maximum", "operating_range">;
  outputVoltageMinimum: Claim<"V", "guaranteed_minimum", "operating_range">;
  outputVoltageMaximum: Claim<"V", "guaranteed_maximum", "operating_range">;
  currentSenseThresholdOptions: ConfiguredProductionSpreadV2<"V">[];
  switchingFrequencyMinimum: Claim<"Hz", "guaranteed_minimum", "operating_range">;
  switchingFrequencyRecommended: Claim<"Hz", "recommended", "recommended_setting">;
  switchingFrequencyMaximum: Claim<"Hz", "guaranteed_maximum", "operating_range">;
  minimumOnTimeMaximum: Claim<"s", "guaranteed_maximum", "production_spread">;
  minimumOffTimeMaximum: Claim<"s", "guaranteed_maximum", "production_spread">;
  feedbackReferenceMinimum: Claim<"V", "guaranteed_minimum", "production_spread">;
  feedbackReferenceTypical: Claim<"V", "typical", "production_spread">;
  feedbackReferenceMaximum: Claim<"V", "guaranteed_maximum", "production_spread">;
  quiescentCurrentMaximum: Claim<"A", "guaranteed_maximum", "production_spread">;
  junctionToAmbientThermalResistanceMaximum: Claim<"K/W", "guaranteed_maximum", "test_characteristic">;
  maximumJunctionTemperature: Claim<"K", "absolute_maximum", "absolute_rating">;
  controlEvidenceBasis: ProfileFact<string>;
  gateDriveVoltageOptions: ConfiguredProductionSpreadV2<"V">[];
  gateSourceCurrentMinimum: Claim<"A", "guaranteed_minimum", "normal_operation_rating">;
  gateSinkCurrentMinimum: Claim<"A", "guaranteed_minimum", "normal_operation_rating">;
  gatePullupResistanceMaximum: Claim<"ohm", "guaranteed_maximum", "test_characteristic">;
  gatePulldownResistanceMaximum: Claim<"ohm", "guaranteed_maximum", "test_characteristic">;
  deadTimeMaximum: Claim<"s", "guaranteed_maximum", "production_spread">;
  controllerLossMaximum: Claim<"W", "guaranteed_maximum", "test_characteristic">;
}

export type PowerPrimaryFactsV2 = PowerIntegratedSynchronousBuckFactsV2 | PowerExternalFetSynchronousBuckFactsV2;

export type FactsV2For<ClassId extends PartClassId> =
  ClassId extends "power.integrated-synchronous-buck-regulator"
    ? PowerIntegratedSynchronousBuckFactsV2
    : ClassId extends "power.external-fet-synchronous-buck-controller"
      ? PowerExternalFetSynchronousBuckFactsV2
      : FactsFor<ClassId> & MountedGeometryFactsV2;

export type ClaimConditionValueV2 = Readonly<
  | {
      parameterId: string;
      kind: "quantity_range";
      minimum: ProfileQuantity;
      maximum: ProfileQuantity;
    }
  | { parameterId: string; kind: "token"; value: string }
>;

export interface ClaimEvaluationContextV2 {
  values: ClaimConditionValueV2[];
}

export interface PowerClaimCandidateConditionStateV2 {
  selectedSwitchingFrequency: ProfileQuantity<"Hz"> | null;
  switchCurrent: Readonly<{
    minimum: ProfileQuantity<"A">;
    maximum: ProfileQuantity<"A">;
  }> | null;
  operatingMode: string | null;
  /** Reserved for a future verified placement-artifact capability; V2 callers must pass null. */
  boardLayout: null;
}

export type PowerClaimContextRequestV2 = BuckDesignRequestV2;

export type ClaimResolutionV2<Unit extends ProfileUnit> =
  | Readonly<{
      status: "known";
      quantity: ProfileQuantity<Unit>;
      evidence: readonly ProfileEvidenceRef[];
      conditions: readonly ProfileConditionV2[];
    }>
  | Readonly<{
      status: "unknown";
      reason: "claim_unknown" | "claim_not_reviewed" | "missing_condition" | "condition_out_of_range";
      parameterId: string | null;
    }>;
