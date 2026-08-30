import type { SIUnit } from "@opencircuit/design-schema";
import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";
import { deepFreeze } from "./canonical";

export const DESIGN_PROFILE_FORMAT = "schemagic-design-profile" as const;
export const DESIGN_PROFILE_SCHEMA_VERSION = "1.0.0" as const;
export const FACTS_SCHEMA_VERSION = "1.0.0" as const;
export const MANUFACTURER_REGISTRY_FORMAT = "schemagic-manufacturer-registry" as const;
export const ADMISSION_LEDGER_FORMAT = "schemagic-design-profile-admission" as const;
export const CATALOG_RELEASE_FORMAT = "schemagic-design-catalog-release" as const;

export const PART_CLASS_IDS = deepFreeze([
  "motor.integrated-h-bridge",
  "motor.full-bridge-gate-driver",
  "power.integrated-synchronous-buck-regulator",
  "power.external-fet-synchronous-buck-controller",
  "shared.n-channel-power-mosfet",
  "shared.current-sense-resistor",
  "shared.general-purpose-resistor",
  "shared.switching-diode",
  "shared.mlcc-capacitor",
  "shared.bulk-capacitor",
  "motor.supply-tvs-diode",
  "power.power-inductor",
] as const);

export type PartClassId = typeof PART_CLASS_IDS[number];
export type ProfileExtraUnit = "C" | "J" | "K/W" | "1/K";
export type ProfileUnit = SIUnit | ProfileExtraUnit;

/** Profile-only quantities. Extra units require explicit conversion before use in design-schema. */
export interface ProfileQuantity<Unit extends ProfileUnit = ProfileUnit> {
  value: number;
  unit: Unit;
  displayUnit: string;
}

export type ProfileEvidenceKind =
  | "manufacturer_datasheet"
  | "manufacturer_product_page"
  | "independent_measurement"
  | "authored_derivation"
  | "synthetic_fixture";

interface ProfileEvidenceBase {
  sourceId: string;
  locator: string;
  licenseNote: string;
}

export interface PublishedProfileEvidenceRef extends ProfileEvidenceBase {
  kind: Exclude<ProfileEvidenceKind, "synthetic_fixture">;
  retrievedAt: string;
  contentHash: `sha256:${string}`;
  url: string;
  revision: string;
  publicationBasis: "public_facts" | "licensed_redistribution" | "original_measurement";
}

/** Honest adapter provenance: absent source fields remain absent, never synthesized. */
export interface SyntheticProfileEvidenceRef extends ProfileEvidenceBase {
  kind: "synthetic_fixture";
  retrievedAt: string | null;
  contentHash: `sha256:${string}` | null;
  url: null;
  revision: null;
  publicationBasis: null;
}

export type ProfileEvidenceRef = PublishedProfileEvidenceRef | SyntheticProfileEvidenceRef;

export interface OperatingRange<Unit extends ProfileUnit = ProfileUnit> {
  parameterId: string;
  minimum: ProfileQuantity<Unit> | null;
  maximum: ProfileQuantity<Unit> | null;
  evidence: ProfileEvidenceRef[];
}

export interface ProfileFact<Value> {
  value: Value | null;
  state: "reviewed" | "calculated" | "estimated" | "unknown";
  evidence: ProfileEvidenceRef[];
  validFor: OperatingRange[];
  explanation: string;
}

export interface CommonProfileFacts {
  packageName: ProfileFact<string>;
  boardArea: ProfileFact<ProfileQuantity<"m2">>;
  maximumHeight: ProfileFact<ProfileQuantity<"m">>;
}

export interface DesignProfileV1<ClassId extends PartClassId = PartClassId, Facts extends object = object> {
  format: typeof DESIGN_PROFILE_FORMAT;
  schemaVersion: typeof DESIGN_PROFILE_SCHEMA_VERSION;
  partClass: ClassId;
  part: ManufacturerPartIdentity;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION;
  commonFacts: CommonProfileFacts;
  facts: Facts;
}

export interface ManufacturerRegistryEntryV1 {
  manufacturerId: string;
  displayName: string;
  primaryEvidenceHosts: string[];
}

export interface ManufacturerRegistryV1 {
  format: typeof MANUFACTURER_REGISTRY_FORMAT;
  schemaVersion: typeof DESIGN_PROFILE_SCHEMA_VERSION;
  manufacturers: ManufacturerRegistryEntryV1[];
}

export type OwnershipTrack = "motor" | "power" | "integration-data-review";
export type AdmissionState = "planned" | "researching" | "authored" | "in_independent_review" | "reviewed" | "blocked";

export interface AdmissionCheckV1 {
  checkId: string;
  status: "pass" | "fail" | "not_run";
}

export interface DesignProfileAdmissionEntryV1 {
  partClass: PartClassId;
  part: ManufacturerPartIdentity;
  profilePath: string;
  ownerTrack: OwnershipTrack;
  reviewerTrack: OwnershipTrack;
  state: AdmissionState;
  authoredBy: string | null;
  authoredAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  profileContentHash: `sha256:${string}` | null;
  checks: AdmissionCheckV1[];
}

export interface DesignProfileAdmissionLedgerV1 {
  format: typeof ADMISSION_LEDGER_FORMAT;
  schemaVersion: typeof DESIGN_PROFILE_SCHEMA_VERSION;
  entries: DesignProfileAdmissionEntryV1[];
}

export interface CatalogProfileRefV1 {
  profileId: string;
  profilePath: string;
  partClass: PartClassId;
  part: ManufacturerPartIdentity;
  profileContentHash: `sha256:${string}`;
}

export interface DesignCatalogReleaseV1 {
  format: typeof CATALOG_RELEASE_FORMAT;
  schemaVersion: typeof DESIGN_PROFILE_SCHEMA_VERSION;
  version: string;
  releasedAt: string;
  manufacturerRegistryContentHash: `sha256:${string}`;
  admissionContentHash: `sha256:${string}`;
  profiles: CatalogProfileRefV1[];
  contentHash: `sha256:${string}`;
}

export interface DesignLibraryDocuments {
  manufacturerRegistry: unknown;
  admission: unknown;
  catalogRelease: unknown;
  profiles: Readonly<Record<string, unknown>>;
}

export interface ReviewedDesignLibrary {
  version: string;
  contentHash: `sha256:${string}`;
  profiles: DesignProfileV1[];
  diagnostics: string[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type CommercialBoundaryCategory =
  | "provider_identity"
  | "offer_state"
  | "snapshot_state"
  | "policy_or_terms"
  | "secret_or_authorization"
  | "raw_provider_payload";

export interface CommercialBoundaryIssue extends ValidationIssue {
  category: CommercialBoundaryCategory;
}
