import { contentHash } from "./canonical";
import { designProfileId, designProfilePath } from "./path";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import {
  admissionContentHash,
  designCatalogContentHash,
  designProfileContentHash,
  manufacturerRegistryContentHash,
  requiredAdmissionCheckIds,
  type DesignProfileFor,
} from "./validation";
import {
  ADMISSION_LEDGER_FORMAT,
  CATALOG_RELEASE_FORMAT,
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION,
  MANUFACTURER_REGISTRY_FORMAT,
  PART_CLASS_IDS,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type ManufacturerRegistryV1,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
  type ProfileUnit,
} from "./types";

export const SYNTHETIC_MANUFACTURER_ID = "schemagic-synthetic-components";
export const SYNTHETIC_MANUFACTURER_HOST = "synthetic-components.example.invalid";
const SYNTHETIC_AT = "2026-08-23T00:00:00.000Z";

export const SYNTHETIC_MANUFACTURER_REGISTRY: ManufacturerRegistryV1 = {
  format: MANUFACTURER_REGISTRY_FORMAT,
  schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
  manufacturers: [{
    manufacturerId: SYNTHETIC_MANUFACTURER_ID,
    displayName: "scheMAGIC Synthetic Components",
    primaryEvidenceHosts: [SYNTHETIC_MANUFACTURER_HOST],
  }],
};

function quantity<Unit extends ProfileUnit>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function evidence(partClass: PartClassId, factId: string): ProfileEvidenceRef {
  return {
    sourceId: `synthetic:${partClass}:${factId}`,
    locator: `Synthetic reviewed-contract fixture for ${factId}`,
    retrievedAt: SYNTHETIC_AT,
    contentHash: contentHash({ partClass, factId }),
    licenseNote: "Hand-authored synthetic fixture; no real manufacturer claim or copied datasheet content.",
    kind: "manufacturer_product_page",
    url: `https://${SYNTHETIC_MANUFACTURER_HOST}/${encodeURIComponent(partClass)}/${encodeURIComponent(factId)}`,
    revision: "synthetic-v1",
    publicationBasis: "public_facts",
  };
}

function numericFixtureValue(factId: string, unit: ProfileUnit): number {
  if (/duty|tolerance/i.test(factId)) return 0.5;
  if (/minimum|standOff/i.test(factId)) return 1;
  if (/recommended/i.test(factId)) return 5;
  if (/maximum|absolute|peak|pulsed|clamping/i.test(factId)) return 10;
  if (/continuousDrainCurrent/i.test(factId)) return 2;
  if (/breakdownVoltageMinimum/i.test(factId)) return 3;
  if (/breakdownVoltageMaximum/i.test(factId)) return 4;
  if (unit === "K") return 350;
  return 1;
}

function fixtureFact(partClass: PartClassId, factId: string, spec: FactSpec): ProfileFact<unknown> {
  const value = spec.kind === "quantity"
    ? quantity(numericFixtureValue(factId, spec.unit), spec.unit)
    : spec.kind === "boolean"
      ? true
      : spec.values?.[0] ?? "Synthetic normalized engineering value";
  const factEvidence = evidence(partClass, factId);
  const validFor = (spec.requiredRangeParameters ?? []).map((parameterId) => {
    const rangeSpec = (PART_CLASS_SPECS[partClass] as PartClassSpec).operatingRanges[parameterId]!;
    const exact = quantity(numericFixtureValue(parameterId, rangeSpec.unit), rangeSpec.unit);
    return { parameterId, minimum: exact, maximum: exact, evidence: [factEvidence] };
  });
  return { value, state: "reviewed", evidence: [factEvidence], validFor, explanation: "Synthetic value used only to exercise the closed reviewed-admission contract." };
}

export function createSyntheticReviewedProfile<ClassId extends PartClassId>(partClass: ClassId, sequence = 1): DesignProfileFor<ClassId> {
  const part = { manufacturerId: SYNTHETIC_MANUFACTURER_ID, manufacturerPartNumber: `SYN-${sequence}-${partClass.toUpperCase()}` };
  const commonEvidence = evidence(partClass, "common");
  const facts = Object.fromEntries(Object.entries(PART_CLASS_SPECS[partClass].facts).map(([factId, spec]) => [factId, fixtureFact(partClass, factId, spec)]));
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part,
    factsSchemaVersion: FACTS_SCHEMA_VERSION,
    commonFacts: {
      packageName: { value: "SYNTHETIC-PACKAGE", state: "reviewed", evidence: [commonEvidence], validFor: [], explanation: "Synthetic package name." },
      boardArea: { value: quantity(1e-6, "m2"), state: "reviewed", evidence: [commonEvidence], validFor: [], explanation: "Synthetic board area." },
      maximumHeight: { value: quantity(1e-3, "m"), state: "reviewed", evidence: [commonEvidence], validFor: [], explanation: "Synthetic maximum height." },
    },
    facts,
  } as unknown as DesignProfileFor<ClassId>;
}

export function createSyntheticReviewedLibraryFixture(classes: readonly PartClassId[] = PART_CLASS_IDS): DesignLibraryDocuments {
  const profiles = classes.map((partClass, index) => createSyntheticReviewedProfile(partClass, index + 1));
  const entries = profiles.map((profile) => ({
    partClass: profile.partClass,
    part: { ...profile.part },
    profilePath: designProfilePath(profile.partClass, profile.part),
    ownerTrack: profile.partClass.startsWith("motor.") && profile.partClass !== "motor.supply-tvs-diode" ? "motor" as const
      : profile.partClass.startsWith("power.") && profile.partClass !== "power.power-inductor" ? "power" as const
        : "integration-data-review" as const,
    reviewerTrack: profile.partClass.startsWith("motor.") && profile.partClass !== "motor.supply-tvs-diode" ? "power" as const : "motor" as const,
    state: "reviewed" as const,
    authoredBy: "synthetic-author",
    authoredAt: SYNTHETIC_AT,
    reviewedBy: "synthetic-independent-reviewer",
    reviewedAt: SYNTHETIC_AT,
    profileContentHash: designProfileContentHash(profile),
    checks: requiredAdmissionCheckIds(profile.partClass).map((checkId) => ({ checkId, status: "pass" as const })),
  })).sort((left, right) => left.profilePath < right.profilePath ? -1 : 1);
  const admission: DesignProfileAdmissionLedgerV1 = {
    format: ADMISSION_LEDGER_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    entries,
  };
  const releaseWithoutHash: Omit<DesignCatalogReleaseV1, "contentHash"> = {
    format: CATALOG_RELEASE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    version: "synthetic-reviewed-contract.1",
    releasedAt: SYNTHETIC_AT,
    manufacturerRegistryContentHash: manufacturerRegistryContentHash(SYNTHETIC_MANUFACTURER_REGISTRY),
    admissionContentHash: admissionContentHash(admission),
    profiles: profiles.map((profile) => ({
      profileId: designProfileId(profile.partClass, profile.part),
      profilePath: designProfilePath(profile.partClass, profile.part),
      partClass: profile.partClass,
      part: { ...profile.part },
      profileContentHash: designProfileContentHash(profile),
    })).sort((left, right) => left.profileId < right.profileId ? -1 : 1),
  };
  const release = { ...releaseWithoutHash, contentHash: "sha256:" + "0".repeat(64) } as DesignCatalogReleaseV1;
  release.contentHash = designCatalogContentHash(SYNTHETIC_MANUFACTURER_REGISTRY, admission, profiles);
  return {
    manufacturerRegistry: SYNTHETIC_MANUFACTURER_REGISTRY,
    admission,
    catalogRelease: release,
    profiles: Object.fromEntries(profiles.map((profile) => [designProfilePath(profile.partClass, profile.part), profile])),
  };
}
