import { compareAscii } from "@opencircuit/design-library";
import type { EvidenceRef } from "@opencircuit/design-schema";
import { REVIEWED_REAL_LICENSE_NOTE, REVIEWED_REAL_MOTOR_CATALOG } from "./catalog";
import {
  GATE_DRIVER_FACT_IDS,
  type MotorFactsV2CandidateProfilePlan,
  type MotorFactsV2ExactByteEvidenceBinding,
  type MotorFactsV2MandatoryEvidenceCandidate,
  type MotorFactsV2MandatoryEvidenceEntry,
  type ReviewedFact,
  type ReviewedGateDriverProfile,
  type ReviewedRealMotorCatalog,
} from "./types";
import { assertValidReviewedRealMotorCatalog } from "./validation";

const SCHEMA_DRAFT_BLOCKERS = [
  "/commonFacts/packageName",
  "/facts/mountedGeometry/boardArea",
  "/facts/mountedGeometry/maximumHeight",
] as const;

const EXPECTED_PROFILE_IDENTITY = {
  "motor.real.gate-driver.allegro-a3941klptr-t": {
    manufacturerId: "allegro-microsystems",
    manufacturerPartNumber: "A3941KLPTR-T",
    packageName: "28-pin TSSOP with exposed thermal pad (LP)",
    datasheetUrl: "https://allegromicro.com/-/media/files/datasheets/a3941-datasheet.pdf",
    datasheetHash: "sha256:86adffc26c22cd8a2ecea15ea1ce65bc617327c5d3bac7c669be2168c535cbe6",
    datasheetEvidenceReferenceCount: 16,
    packageLocator: "A3941 datasheet 3941-DS Rev 8, page 2, Selection Guide, A3941KLPTR-T package LP; page 20, Package LP 28-Pin TSSOP drawing",
    geometryLocator: "A3941 datasheet 3941-DS Rev 8, page 20, PCB Layout Reference View; a bounded maximum land-pattern projection has not been independently authored",
    heightLocator: "A3941 datasheet 3941-DS Rev 8, page 20, Package LP drawing, dimension A maximum 1.20 mm",
    maximumHeightM: 1.2e-3,
  },
  "motor.real.gate-driver.renesas-hip4081aibz": {
    manufacturerId: "renesas-electronics",
    manufacturerPartNumber: "HIP4081AIBZ",
    packageName: "20-pin SOICW",
    datasheetUrl: "https://renesas.com/en/document/dst/hip4081a-datasheet",
    datasheetHash: "sha256:9712192314428f328145659674cafe4b8a58cbce7ca93da50d2ff27e74d685b5",
    datasheetEvidenceReferenceCount: 19,
    packageLocator: "HIP4081A datasheet FN3659 Rev 8, page 1, Ordering Information, HIP4081AIBZ M20.3 package; page 17, M20.3 package outline",
    geometryLocator: "HIP4081A datasheet FN3659 Rev 8, page 17, Typical Recommended Land Pattern; dimensions are reference-only and no bounded maximum projection is authored",
    heightLocator: "HIP4081A datasheet FN3659 Rev 8, page 17, M20.3 package outline, package height maximum 2.65 mm",
    maximumHeightM: 2.65e-3,
  },
  "motor.real.gate-driver.ti-drv8701erger": {
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "DRV8701ERGER",
    packageName: "VQFN-24 (RGE)",
    datasheetUrl: "https://ti.com/lit/gpn/DRV8701",
    datasheetHash: "sha256:8f211bc6b6a0ae77fb7956a0a809644aa502a7095ab228425cc63fe4e5ffba3c",
    datasheetEvidenceReferenceCount: 20,
    packageLocator: "DRV8701 datasheet SLVSCX5B, page 35, Package Option Addendum, DRV8701ERGER active-production VQFN RGE 24-pin row; page 39, RGE 24 Generic Package View",
    geometryLocator: "DRV8701 datasheet SLVSCX5B, page 39, RGE 24 Generic Package View; the exact bytes contain no dimensioned manufacturer-recommended land pattern",
    heightLocator: "DRV8701 datasheet SLVSCX5B, page 39, RGE 24 Generic Package View, VQFN 1 mm maximum height",
    maximumHeightM: 1e-3,
  },
} as const;

type CandidateProfileId = keyof typeof EXPECTED_PROFILE_IDENTITY;
type UnboundEntry = Omit<MotorFactsV2MandatoryEvidenceEntry, "exactByteEvidence"> & {
  sourceId: string;
  locator: string;
};

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value as Readonly<T>;
}

function profileEvidence(profile: ReviewedGateDriverProfile): EvidenceRef[] {
  const facts = profile.facts as Record<string, ReviewedFact>;
  return [
    ...profile.identityEvidence,
    ...profile.package.name.evidence,
    ...profile.package.bodyAreaM2.evidence,
    ...GATE_DRIVER_FACT_IDS.flatMap((factId) => facts[factId]!.evidence),
  ];
}

function assertCandidateProfileIdentity(profile: ReviewedGateDriverProfile, profileId: CandidateProfileId): void {
  const expected = EXPECTED_PROFILE_IDENTITY[profileId];
  if (
    profile.id !== profileId
    || profile.part.manufacturerId !== expected.manufacturerId
    || profile.part.manufacturerPartNumber !== expected.manufacturerPartNumber
    || profile.package.name.state !== "reviewed"
    || profile.package.name.value !== expected.packageName
  ) {
    throw new Error(`Candidate evidence identity mismatch for ${profileId}`);
  }
}

function bindExactByteEvidence(
  profile: ReviewedGateDriverProfile,
  profileId: CandidateProfileId,
  sourceId: string,
  locator: string,
): readonly MotorFactsV2ExactByteEvidenceBinding[] {
  const expected = EXPECTED_PROFILE_IDENTITY[profileId];
  if (sourceId !== expected.datasheetUrl) throw new Error(`Unexpected exact-byte source for ${profileId}`);
  const evidence = profileEvidence(profile);
  const matching = evidence.filter((entry) => entry.sourceId === sourceId);
  if (matching.length !== expected.datasheetEvidenceReferenceCount) {
    throw new Error(`Exact-byte source reference count mismatch for ${sourceId}`);
  }
  if (evidence.some((entry) => entry.contentHash === expected.datasheetHash && entry.sourceId !== sourceId)) {
    throw new Error(`Exact-byte source identity mismatch for ${sourceId}`);
  }
  for (const evidence of matching) {
    if (evidence.contentHash !== expected.datasheetHash) throw new Error(`Exact-byte source hash mismatch for ${sourceId}`);
    if (evidence.licenseNote !== REVIEWED_REAL_LICENSE_NOTE) throw new Error(`Exact-byte source license mismatch for ${sourceId}`);
  }
  const retrievedAt = matching[0]!.retrievedAt;
  if (retrievedAt === undefined) throw new Error(`Exact-byte source retrieval missing for ${sourceId}`);
  if (matching.some((evidence) => evidence.retrievedAt !== retrievedAt)) {
    throw new Error(`Exact-byte source retrieval mismatch for ${sourceId}`);
  }
  return [{
    sourceId,
    contentHash: expected.datasheetHash,
    locator,
    retrievedAt,
    licenseNote: REVIEWED_REAL_LICENSE_NOTE,
  }];
}

function sourceBoundEntry(
  targetPath: string,
  candidate: MotorFactsV2MandatoryEvidenceCandidate,
  sourceId: string,
  locator: string,
  blockingReason: string,
): UnboundEntry {
  return {
    targetPath,
    status: "source_bound_pending_independent_review",
    candidate,
    sourceId,
    locator,
    blockingReason,
    requiredResolution: "An independent reviewer must verify the exact MPN-to-package mapping, source bytes, locator, and candidate semantics before any reviewed facts-V2 profile is authored.",
  };
}

function evidenceMap(profile: ReviewedGateDriverProfile, profileId: CandidateProfileId): readonly MotorFactsV2MandatoryEvidenceEntry[] {
  const expected = EXPECTED_PROFILE_IDENTITY[profileId];
  const entries: readonly UnboundEntry[] = [
    sourceBoundEntry(
      "/commonFacts/packageName",
      { kind: "text", value: expected.packageName },
      expected.datasheetUrl,
      expected.packageLocator,
      "The exact orderable MPN and package are source-bound, but commonFacts.packageName still requires independent evidence review.",
    ),
    {
      targetPath: "/facts/mountedGeometry/boardArea",
      status: "blocked_missing_bounded_geometry",
      candidate: null,
      sourceId: expected.datasheetUrl,
      locator: expected.geometryLocator,
      blockingReason: profileId === "motor.real.gate-driver.ti-drv8701erger"
        ? "The pinned DRV8701 datasheet supplies a generic package view but no dimensioned manufacturer-recommended land pattern, so package body or carrier-pocket area cannot substitute for mounted board area."
        : "The pinned package drawing contains a reference land pattern, but a facts-V2 maximum bounding-box projection has not been independently authored and reference dimensions are not silently promoted to guaranteed maxima.",
      requiredResolution: "Bind a manufacturer-recommended land pattern to the exact MPN, author every maximum x/y projection term without using body or carrier dimensions, and obtain independent evidence review.",
    },
    sourceBoundEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: expected.maximumHeightM, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      expected.datasheetUrl,
      expected.heightLocator,
      "The manufacturer maximum package height is source-bound, but facts-V2 requires an independently reviewed maximum-height fact.",
    ),
  ];
  const result = entries.map(({ sourceId, locator, ...entry }) => ({
    ...entry,
    exactByteEvidence: bindExactByteEvidence(profile, profileId, sourceId, locator),
  })).sort((left, right) => compareAscii(left.targetPath, right.targetPath));
  const paths = result.map((entry) => entry.targetPath);
  const expectedPaths = [...SCHEMA_DRAFT_BLOCKERS].sort(compareAscii);
  if (paths.length !== expectedPaths.length || paths.some((path, index) => path !== expectedPaths[index])) {
    throw new Error(`Mandatory evidence map path mismatch for ${profileId}`);
  }
  return result;
}

/**
 * Candidate plans only. The pinned package bytes support exact package-name and
 * maximum-height candidates for the three external-NMOS gate-driver profiles.
 * Board area and complete facts-V2 profile review remain unresolved, so every
 * plan is isolated with draft:null and cannot affect catalog admission.
 */
export function buildReviewedRealMotorFactsV2CandidateProfilePlans(
  catalog: ReviewedRealMotorCatalog = REVIEWED_REAL_MOTOR_CATALOG,
): readonly MotorFactsV2CandidateProfilePlan[] {
  assertValidReviewedRealMotorCatalog(catalog);
  const profiles = new Map(catalog.gateDrivers.map((profile) => [profile.id, profile]));
  const plans = (Object.keys(EXPECTED_PROFILE_IDENTITY) as CandidateProfileId[]).map((profileId) => {
    const profile = profiles.get(profileId);
    if (profile === undefined) throw new Error(`Missing staged profile ${profileId}`);
    assertCandidateProfileIdentity(profile, profileId);
    const mandatoryEvidenceMap = evidenceMap(profile, profileId);
    return {
      sourceProfileId: profileId,
      partClass: "motor.full-bridge-gate-driver" as const,
      part: { ...profile.part },
      targetFactsSchemaVersion: "2.0.0" as const,
      status: "needs_evidence" as const,
      sourceHashComplete: true as const,
      sourceBoundMandatoryEvidenceCount: mandatoryEvidenceMap.filter((entry) => entry.status === "source_bound_pending_independent_review").length,
      schemaDraftBlockingPaths: mandatoryEvidenceMap.map((entry) => entry.targetPath),
      mandatoryEvidenceMap,
      independentReviewState: "pending" as const,
      admissionState: "isolated_not_admitted" as const,
      draft: null,
    };
  }).sort((left, right) => compareAscii(left.sourceProfileId, right.sourceProfileId));
  return deepFreeze(plans) as readonly MotorFactsV2CandidateProfilePlan[];
}

export const REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS =
  buildReviewedRealMotorFactsV2CandidateProfilePlans();
