import { compareDesignV2Tokens, type EvidenceRef } from "@opencircuit/design-schema";
import {
  getBundledDesignLibraryDocuments,
  type CatalogProfileRefV1,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionEntryV1,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileEnvelope,
} from "@opencircuit/design-library";
import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import {
  buildReviewedProfileCatalogV2,
  getInstalledMotorRecipeRefsV2,
} from "@opencircuit/design-engine/v2-motor-runtime";
import type { DesignRecipeRefV2, ReviewedProfileCatalogV2 } from "@opencircuit/design-engine";
import { assessMotorDesignV2ProductionReadiness, type MotorDesignV2ProductionStatus } from "../v2-readiness";
import {
  GATE_DRIVER_FACT_IDS,
  INTEGRATED_BRIDGE_FACT_IDS,
  type ReviewedFact,
  type ReviewedRealMotorCatalog,
  type ReviewedRealMotorProfile,
} from "./types";
import { assertValidReviewedRealMotorCatalog } from "./validation";

export interface ReviewedProfileCoverage {
  profileId: string;
  kind: ReviewedRealMotorProfile["kind"];
  manufacturerId: string;
  manufacturerPartNumber: string;
  ownershipTargetPath: string;
  reviewedFactCount: number;
  evidenceReferenceCount: number;
  missingFields: string[];
  missingSourceHashes: string[];
  authoredFromPrimarySources: true;
  technicalFactComplete: boolean;
  sourceHashComplete: boolean;
  ownershipReserved: boolean;
  /**
   * Exact ownership/admission-ledger lifecycle evidence only. An authored hash
   * is not reviewed-catalog admission; `catalogAdmitted` remains authoritative.
   */
  ownershipLedger: {
    state: DesignProfileAdmissionEntryV1["state"];
    profileContentHash: `sha256:${string}` | null;
    factsReviewedAndConditionedCheck: DesignProfileAdmissionEntryV1["checks"][number]["status"] | null;
    independentReviewCheck: DesignProfileAdmissionEntryV1["checks"][number]["status"] | null;
  } | null;
  catalogAdmitted: boolean;
  admittedProfileId: string | null;
  admittedFactsSchemaVersion: string | null;
  admittedProfileContentHash: `sha256:${string}` | null;
  /**
   * True only when the exact admitted identity/facts tuple can pass the
   * installed recipe's pre-materialization identity gates. This is not
   * constraint feasibility, policy eligibility, candidate retention,
   * selected-part fidelity, or overall Designer release readiness.
   */
  generatorEligible: boolean;
  /** Legacy field name: these are recipes that can reach candidate materialization. */
  generatorEnumerationRecipeIds: string[];
  generatorEligibilityScope: "candidate_materialization_after_recipe_match";
  exclusionReasons: string[];
}

export interface ReviewedSharedProfileFactCoverage {
  path: string;
  state: "reviewed" | "calculated";
  evidenceContentHashes: `sha256:${string}`[];
}

export interface ReviewedSharedProfileExplicitUnknownFactCoverage {
  path: string;
  state: "unknown";
  explanation: string;
}

export interface ReviewedSharedProfileBinding {
  profileId: string;
  profilePath: string;
  partClass:
    | "motor.supply-tvs-diode"
    | "shared.current-sense-resistor"
    | "shared.general-purpose-resistor"
    | "shared.mlcc-capacitor"
    | "shared.n-channel-power-mosfet";
  manufacturerId: string;
  manufacturerPartNumber: string;
  factsSchemaVersion: "2.0.0" | "3.0.0";
  profileContentHash: `sha256:${string}`;
  admissionState: "reviewed";
  requiredFacts: ReviewedSharedProfileFactCoverage[];
  preservedUnknownFacts: ReviewedSharedProfileExplicitUnknownFactCoverage[];
  generatorEnumerationRecipes: Array<{
    recipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified";
    recipeVersion: "3.1.7";
    recipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947";
  }>;
}

export interface ReviewedSharedProfileCoverage {
  partClass: ReviewedSharedProfileBinding["partClass"];
  factsSchemaVersion: ReviewedSharedProfileBinding["factsSchemaVersion"];
  requiredFactPaths: string[];
  preservedUnknownFactPaths: string[];
  requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified";
  requiredRecipeVersion: "3.1.7";
  requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947";
  factCoverageSatisfied: boolean;
  roleAuthority: {
    status: "available" | "unavailable" | "not_required";
    basis:
      | "exact_recipe_component_role"
      | "exact_recipe_bootstrap_capacitor_role"
      | "exact_recipe_driver_local_decoupling_capacitor_role"
      | "part_class_is_role_specific"
      | "no_exact_reviewed_series_gate_profile_with_pulse_and_drive_evidence"
      | "exact_driver_guidance_omits_series_gate_resistors";
  };
  satisfied: boolean;
  profiles: ReviewedSharedProfileBinding[];
}

export interface ReviewedRealCatalogReport {
  catalogId: string;
  provenanceState: "authored_from_primary_sources";
  catalogAdmission: "pending_independent_review";
  generatedFromRetrievedAt: string;
  totals: {
    profiles: number;
    integratedBridges: number;
    gateDrivers: number;
    manufacturers: number;
    evidenceReferences: number;
    missingSourceHashCount: number;
    sourceHashCompleteProfiles: number;
    reservedOwnershipProfiles: number;
    catalogAdmittedProfiles: number;
    generatorEligibleProfiles: number;
  };
  targets: {
    integratedBridges: { authoredProfiles: number; targetProfiles: 8; manufacturers: number; targetManufacturers: 3; profilesRemaining: number };
    gateDrivers: { authoredProfiles: number; targetProfiles: 6; manufacturers: number; targetManufacturers: 3; profilesRemaining: number };
  };
  missingSourceHashes: string[];
  ownershipTargets: Array<{
    profileId: string;
    manufacturerId: string;
    manufacturerPartNumber: string;
    profilePath: string;
  }>;
  coverageRequirementGaps: {
    applicationEnvelope: string[];
    integratedBridges: string[];
    gateDrivers: string[];
  };
  coverageBoundaries: {
    integratedBridges: {
      authoredNormalPeakCurrentMaximumA: number;
      explanation: string;
    };
  };
  sharedProfileCoverage: {
    bootstrapCapacitors: ReviewedSharedProfileCoverage;
    localDecouplingCapacitors: ReviewedSharedProfileCoverage;
    externalNmos: ReviewedSharedProfileCoverage;
    currentShunts: ReviewedSharedProfileCoverage;
    seriesGateResistors: ReviewedSharedProfileCoverage;
    pulldownResistors: ReviewedSharedProfileCoverage;
    supplyTvs: ReviewedSharedProfileCoverage;
  };
  sharedProfileGaps: string[];
  profiles: ReviewedProfileCoverage[];
}

export interface ReviewedRealCatalogReportOptions {
  reviewedDocuments?: Readonly<DesignLibraryDocuments>;
  installedMotorRecipes?: readonly DesignRecipeRefV2[];
}

type SharedProfileRequirement = Readonly<{
  partClass: ReviewedSharedProfileBinding["partClass"];
  factsSchemaVersion: ReviewedSharedProfileBinding["factsSchemaVersion"];
  exactProfiles?: readonly Readonly<{
    manufacturerId: string;
    manufacturerPartNumber: string;
    profilePath: string;
    profileContentHash: `sha256:${string}`;
  }>[];
  requiredRecipeId: ReviewedSharedProfileCoverage["requiredRecipeId"];
  requiredRecipeVersion: ReviewedSharedProfileCoverage["requiredRecipeVersion"];
  requiredRecipeContentHash: ReviewedSharedProfileCoverage["requiredRecipeContentHash"];
  roleAuthority: ReviewedSharedProfileCoverage["roleAuthority"];
  requiredFacts: readonly Readonly<{
    path: string;
    allowedStates: readonly ReviewedSharedProfileFactCoverage["state"][];
  }>[];
  preservedUnknownFacts?: readonly Readonly<{
    path: string;
  }>[];
}>;

const EXTERNAL_NMOS_SHARED_GAP = "External N-MOSF profiles: exact manufacturer/MPN, VDS maximum, continuous and pulsed current with conditions, RDS(on) at supported VGS and temperature, total gate charge, switching/reverse-recovery evidence, maximum junction temperature, package thermal assumptions, and body area.";
const CURRENT_SHUNT_SHARED_GAP = "Current shunts: resistance, tolerance, TCR, continuous and pulse power with duration, thermal/package assumptions, and Kelvin-terminal evidence.";
const CAPACITOR_SHARED_GAP = "Capacitor application evidence: effective capacitance over bias and temperature, ESR and ripple current, bootstrap QGATE and IHBS*tON charge/refresh/leakage adequacy, VDD-local voltage and placement/interconnect adequacy, and bulk transient-energy adequacy remain unknown.";
const SUPPLY_TVS_SHARED_GAP = "Supply TVS: stand-off, breakdown, clamping voltage, and the pulse waveform/energy condition.";
const REQUIRED_EXTERNAL_NMOS_RECIPE = {
  id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
  version: "3.1.7",
  contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
} as const;

const EXACT_NOMINAL_10UF_MLCC_PROFILES = [
  {
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM31CR61H106KA12L",
    profilePath: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
    profileContentHash: "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
  },
  {
    manufacturerId: "samsung-electro-mechanics",
    manufacturerPartNumber: "CL31A106KBHNNNE",
    profilePath: "packages/design-library/parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json",
    profileContentHash: "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
  },
  {
    manufacturerId: "tdk-corporation",
    manufacturerPartNumber: "C3216X7R1H106K160AC",
    profilePath: "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json",
    profileContentHash: "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
  },
] as const;

const NOMINAL_MLCC_REQUIRED_FACTS = [
  { path: "/commonFacts/packageName", allowedStates: ["reviewed"] },
  { path: "/facts/nominalCapacitance", allowedStates: ["reviewed"] },
] as const;

const NOMINAL_MLCC_PRESERVED_UNKNOWNS = [
  { path: "/facts/effectiveCapacitance" },
  { path: "/facts/biasDeratingRatio" },
  { path: "/facts/equivalentSeriesResistance" },
  { path: "/facts/rippleCurrent" },
] as const;

const BOOTSTRAP_CAPACITOR_REQUIREMENT: SharedProfileRequirement = {
  partClass: "shared.mlcc-capacitor",
  factsSchemaVersion: "2.0.0",
  exactProfiles: EXACT_NOMINAL_10UF_MLCC_PROFILES,
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "available",
    basis: "exact_recipe_bootstrap_capacitor_role",
  },
  requiredFacts: NOMINAL_MLCC_REQUIRED_FACTS,
  preservedUnknownFacts: NOMINAL_MLCC_PRESERVED_UNKNOWNS,
};

const LOCAL_DECOUPLING_CAPACITOR_REQUIREMENT: SharedProfileRequirement = {
  partClass: "shared.mlcc-capacitor",
  factsSchemaVersion: "2.0.0",
  exactProfiles: EXACT_NOMINAL_10UF_MLCC_PROFILES,
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "available",
    basis: "exact_recipe_driver_local_decoupling_capacitor_role",
  },
  requiredFacts: NOMINAL_MLCC_REQUIRED_FACTS,
  preservedUnknownFacts: NOMINAL_MLCC_PRESERVED_UNKNOWNS,
};

const EXTERNAL_NMOS_REQUIREMENT: SharedProfileRequirement = {
  partClass: "shared.n-channel-power-mosfet",
  factsSchemaVersion: "3.0.0",
  exactProfiles: [{
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "CSD18540Q5B",
    profilePath: "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json",
    profileContentHash: "sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8",
  }],
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "available",
    basis: "exact_recipe_component_role",
  },
  requiredFacts: [
    { path: "/commonFacts/packageName", allowedStates: ["reviewed"] },
    { path: "/facts/drainSourceVoltage", allowedStates: ["reviewed"] },
    { path: "/facts/continuousDrainCurrent", allowedStates: ["reviewed"] },
    { path: "/facts/pulsedDrainCurrent", allowedStates: ["reviewed"] },
    { path: "/facts/onResistance", allowedStates: ["reviewed"] },
    { path: "/facts/totalGateCharge", allowedStates: ["reviewed"] },
    { path: "/facts/maximumJunctionTemperature", allowedStates: ["reviewed"] },
    { path: "/facts/junctionToAmbientThermalResistance", allowedStates: ["reviewed"] },
    { path: "/facts/thermalBoardAssumption", allowedStates: ["reviewed"] },
    { path: "/facts/packageBodyArea", allowedStates: ["reviewed"] },
    { path: "/facts/mountedGeometry/boardArea", allowedStates: ["reviewed", "calculated"] },
    { path: "/facts/mountedGeometry/maximumHeight", allowedStates: ["reviewed", "calculated"] },
  ],
  preservedUnknownFacts: [
    { path: "/facts/riseTime" },
    { path: "/facts/fallTime" },
    { path: "/facts/reverseRecoveryCharge" },
  ],
};

const SUPPLY_TVS_REQUIREMENT: SharedProfileRequirement = {
  partClass: "motor.supply-tvs-diode",
  factsSchemaVersion: "3.0.0",
  exactProfiles: [{
    manufacturerId: "diodes-incorporated",
    manufacturerPartNumber: "3.0SMCJ33CAQ",
    profilePath: "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json",
    profileContentHash: "sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474",
  }],
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "available",
    basis: "part_class_is_role_specific",
  },
  requiredFacts: [
    { path: "/commonFacts/packageName", allowedStates: ["reviewed"] },
    { path: "/facts/standOffVoltage", allowedStates: ["reviewed"] },
    { path: "/facts/breakdownVoltageMinimum", allowedStates: ["reviewed"] },
    { path: "/facts/breakdownVoltageMaximum", allowedStates: ["reviewed"] },
    { path: "/facts/clampingBehavior", allowedStates: ["reviewed"] },
    { path: "/facts/clampingVoltage", allowedStates: ["reviewed"] },
    { path: "/facts/pulseCurrent", allowedStates: ["reviewed"] },
    { path: "/facts/pulseWaveform", allowedStates: ["reviewed"] },
    { path: "/facts/mountedGeometry/boardArea", allowedStates: ["reviewed", "calculated"] },
    { path: "/facts/mountedGeometry/maximumHeight", allowedStates: ["reviewed", "calculated"] },
  ],
  preservedUnknownFacts: [
    { path: "/facts/pulseEnergy" },
  ],
};

const CURRENT_SHUNT_REQUIREMENT: SharedProfileRequirement = {
  partClass: "shared.current-sense-resistor",
  factsSchemaVersion: "2.0.0",
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "available",
    basis: "part_class_is_role_specific",
  },
  requiredFacts: [
    { path: "/commonFacts/packageName", allowedStates: ["reviewed"] },
    { path: "/facts/resistance", allowedStates: ["reviewed"] },
    { path: "/facts/tolerance", allowedStates: ["reviewed"] },
    { path: "/facts/temperatureCoefficient", allowedStates: ["reviewed"] },
    { path: "/facts/continuousPower", allowedStates: ["reviewed"] },
    { path: "/facts/pulsePower", allowedStates: ["reviewed"] },
    { path: "/facts/pulseDuration", allowedStates: ["reviewed"] },
    { path: "/facts/thermalLimit", allowedStates: ["reviewed"] },
    { path: "/facts/kelvinTerminals", allowedStates: ["reviewed"] },
    { path: "/facts/mountedGeometry/boardArea", allowedStates: ["reviewed", "calculated"] },
    { path: "/facts/mountedGeometry/maximumHeight", allowedStates: ["reviewed", "calculated"] },
  ],
};

const SERIES_GATE_RESISTOR_REQUIREMENT: SharedProfileRequirement = {
  partClass: "shared.general-purpose-resistor",
  factsSchemaVersion: "2.0.0",
  exactProfiles: [],
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "not_required",
    basis: "exact_driver_guidance_omits_series_gate_resistors",
  },
  requiredFacts: [],
};

const PULLDOWN_RESISTOR_REQUIREMENT: SharedProfileRequirement = {
  partClass: "shared.general-purpose-resistor",
  factsSchemaVersion: "2.0.0",
  exactProfiles: [
    {
      manufacturerId: "bourns",
      manufacturerPartNumber: "CR0603-FX-1003ELF",
      profilePath: "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json",
      profileContentHash: "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6",
    },
    {
      manufacturerId: "panasonic-industry",
      manufacturerPartNumber: "ERJ3EKF1003V",
      profilePath: "packages/design-library/parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json",
      profileContentHash: "sha256:56f2022018a349a1bd48bf60804aa6147967fc3173e5ffea78d001a0c162e0a1",
    },
    {
      manufacturerId: "vishay-intertechnology",
      manufacturerPartNumber: "CRCW0603100KFKEA",
      profilePath: "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json",
      profileContentHash: "sha256:f0320c991d8cf882396657e8d0b23aa3c8253b7d7be16f3aff6a29a15a6b83a0",
    },
  ],
  requiredRecipeId: REQUIRED_EXTERNAL_NMOS_RECIPE.id,
  requiredRecipeVersion: REQUIRED_EXTERNAL_NMOS_RECIPE.version,
  requiredRecipeContentHash: REQUIRED_EXTERNAL_NMOS_RECIPE.contentHash,
  roleAuthority: {
    status: "available",
    basis: "exact_recipe_component_role",
  },
  requiredFacts: [
    { path: "/commonFacts/packageName", allowedStates: ["reviewed"] },
    { path: "/facts/resistance", allowedStates: ["reviewed"] },
    { path: "/facts/tolerance", allowedStates: ["reviewed"] },
    { path: "/facts/temperatureCoefficient", allowedStates: ["reviewed"] },
    { path: "/facts/continuousPower", allowedStates: ["reviewed"] },
    { path: "/facts/workingVoltage", allowedStates: ["reviewed"] },
    { path: "/facts/mountedGeometry/boardArea", allowedStates: ["reviewed", "calculated"] },
    { path: "/facts/mountedGeometry/maximumHeight", allowedStates: ["reviewed", "calculated"] },
  ],
};

function profileEvidence(profile: ReviewedRealMotorProfile): EvidenceRef[] {
  const factIds = profile.kind === "integrated_bridge" ? INTEGRATED_BRIDGE_FACT_IDS : GATE_DRIVER_FACT_IDS;
  const facts = profile.facts as Record<string, ReviewedFact>;
  return [
    ...profile.identityEvidence,
    ...profile.package.name.evidence,
    ...profile.package.bodyAreaM2.evidence,
    ...factIds.flatMap((id) => facts[id]!.evidence),
  ];
}

function mpnPathToken(mpn: string): string {
  return [...new TextEncoder().encode(mpn)].map((byte) => {
    const ascii = String.fromCharCode(byte);
    return /[A-Za-z0-9_-]/.test(ascii) ? ascii : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }).join("");
}

function exactProfilePath(
  partClass: string,
  part: Readonly<{ manufacturerId: string; manufacturerPartNumber: string }>,
): string {
  return `packages/design-library/parts/${partClass}/${part.manufacturerId}/${mpnPathToken(part.manufacturerPartNumber)}.json`;
}

function ownershipTargetPath(profile: ReviewedRealMotorProfile): string {
  const partClass = profile.kind === "integrated_bridge"
    ? "motor.integrated-h-bridge"
    : "motor.full-bridge-gate-driver";
  return exactProfilePath(partClass, profile.part);
}

function exactOwnershipEntry(
  profile: ReviewedRealMotorProfile,
  admission: DesignProfileAdmissionLedgerV1,
): DesignProfileAdmissionEntryV1 | null {
  const partClass = profile.kind === "integrated_bridge" ? "motor.integrated-h-bridge" : "motor.full-bridge-gate-driver";
  const path = ownershipTargetPath(profile);
  const entries = admission.entries.filter((entry) =>
    entry.partClass === partClass
    && entry.part.manufacturerId === profile.part.manufacturerId
    && entry.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
    && entry.profilePath === path
    && entry.ownerTrack === "motor"
    && entry.reviewerTrack === "integration-data-review"
    && ["researching", "authored", "in_independent_review", "reviewed"].includes(entry.state)
  );
  return entries.length === 1 ? entries[0]! : null;
}

function exactAdmissionCheckStatus(
  entry: Readonly<DesignProfileAdmissionEntryV1>,
  checkId: string,
): DesignProfileAdmissionEntryV1["checks"][number]["status"] | null {
  const checks = entry.checks.filter((check) => check.checkId === checkId);
  return checks.length === 1 ? checks[0]!.status : null;
}

interface ReviewedReleaseReconciliation {
  catalog: Readonly<ReviewedProfileCatalogV2>;
  release: Readonly<DesignCatalogReleaseV1>;
  admission: Readonly<DesignProfileAdmissionLedgerV1>;
  installedRecipes: readonly DesignRecipeRefV2[];
  productionStatus: Readonly<MotorDesignV2ProductionStatus>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function valueAtPath(value: unknown, path: string): unknown {
  let cursor = value;
  for (const token of path.split("/").slice(1)) {
    const parent = record(cursor);
    if (parent === null || !Object.prototype.hasOwnProperty.call(parent, token)) return undefined;
    cursor = parent[token];
  }
  return cursor;
}

function requiredFactCoverage(
  profile: Readonly<DesignProfileEnvelope>,
  requirement: SharedProfileRequirement["requiredFacts"][number],
): ReviewedSharedProfileFactCoverage | null {
  const fact = record(valueAtPath(profile, requirement.path));
  if (fact === null || !requirement.allowedStates.includes(fact.state as ReviewedSharedProfileFactCoverage["state"])) {
    return null;
  }
  if (fact.value === null || fact.value === undefined) return null;
  if (!Array.isArray(fact.evidence) || fact.evidence.length === 0) return null;
  const evidenceContentHashes = [...new Set(fact.evidence.map((entry) => {
    const evidence = record(entry);
    return evidence?.contentHash;
  }))];
  if (evidenceContentHashes.some((hash) => typeof hash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(hash))) {
    return null;
  }
  return {
    path: requirement.path,
    state: fact.state as ReviewedSharedProfileFactCoverage["state"],
    evidenceContentHashes: (evidenceContentHashes as `sha256:${string}`[])
      .sort(compareDesignV2Tokens),
  };
}

function preservedUnknownFactCoverage(
  profile: Readonly<DesignProfileEnvelope>,
  requirement: NonNullable<SharedProfileRequirement["preservedUnknownFacts"]>[number],
): ReviewedSharedProfileExplicitUnknownFactCoverage | null {
  const fact = record(valueAtPath(profile, requirement.path));
  if (
    fact === null
    || fact.state !== "unknown"
    || fact.value !== null
    || !Array.isArray(fact.evidence)
    || fact.evidence.length !== 0
    || !Array.isArray(fact.validFor)
    || fact.validFor.length !== 0
    || typeof fact.explanation !== "string"
    || fact.explanation.length === 0
  ) return null;
  return {
    path: requirement.path,
    state: "unknown",
    explanation: fact.explanation,
  };
}

function exactReviewedAdmission(
  profile: Readonly<DesignProfileEnvelope>,
  releaseRef: Readonly<CatalogProfileRefV1>,
  admission: Readonly<DesignProfileAdmissionLedgerV1>,
): boolean {
  const entries = admission.entries.filter((entry) => (
    entry.partClass === profile.partClass
    && entry.part.manufacturerId === profile.part.manufacturerId
    && entry.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
    && entry.profilePath === releaseRef.profilePath
  ));
  if (entries.length !== 1) return false;
  const entry = entries[0]!;
  const checks = new Map(entry.checks.map((check) => [check.checkId, check.status]));
  return entry.state === "reviewed"
    && entry.profileContentHash === releaseRef.profileContentHash
    && entry.reviewedBy !== null
    && entry.reviewedAt !== null
    && entry.checks.length > 0
    && entry.checks.every((check) => check.status === "pass")
    && checks.get("contract.identity_path") === "pass"
    && checks.get("contract.profile_content_hash") === "pass"
    && checks.get("evidence.primary") === "pass"
    && checks.get("facts.reviewed_and_conditioned") === "pass"
    && checks.get("review.independent") === "pass";
}

function enumeratingRecipeBindings(
  requirement: SharedProfileRequirement,
  reconciliation: ReviewedReleaseReconciliation,
): ReviewedSharedProfileBinding["generatorEnumerationRecipes"] {
  if (reconciliation.productionStatus.status !== "ready" || !reconciliation.productionStatus.installedRecipeSet) {
    return [];
  }
  const installedRefs = reconciliation.installedRecipes.filter((recipe) => recipe.id === requirement.requiredRecipeId);
  const readinessEntries = reconciliation.productionStatus.recipeReadiness.filter((recipe) => (
    recipe.recipeId === requirement.requiredRecipeId
  ));
  if (installedRefs.length !== 1 || readinessEntries.length !== 1) return [];
  const installedRef = installedRefs[0]!;
  const readiness = readinessEntries[0]!;
  const profileRequirements = readiness.profileRequirements.filter((profileRequirement) => (
    profileRequirement.partClass === requirement.partClass
    && profileRequirement.factsSchemaVersion === requirement.factsSchemaVersion
  ));
  if (
    installedRef.version !== requirement.requiredRecipeVersion
    || installedRef.contentHash !== requirement.requiredRecipeContentHash
    || installedRef.applications.length !== 1
    || installedRef.applications[0] !== "motor.brushed-dc"
    || readiness.recipeVersion !== installedRef.version
    || !readiness.recognizedContract
    || !readiness.ready
    || profileRequirements.length !== 1
    || profileRequirements[0]!.reviewedProfileCount < 1
  ) return [];
  return [{
    recipeId: requirement.requiredRecipeId,
    recipeVersion: requirement.requiredRecipeVersion,
    recipeContentHash: requirement.requiredRecipeContentHash,
  }];
}

function sharedProfileCoverage(
  requirement: SharedProfileRequirement,
  reconciliation: ReviewedReleaseReconciliation,
): ReviewedSharedProfileCoverage {
  const recipeBindings = enumeratingRecipeBindings(requirement, reconciliation);
  const exactBindings = requirement.exactProfiles;
  const matchingProfiles = reconciliation.catalog.profiles
    .filter((profile) => (
      profile.partClass === requirement.partClass
      && profile.factsSchemaVersion === requirement.factsSchemaVersion
      && (exactBindings === undefined || exactBindings.some((binding) => (
        profile.part.manufacturerId === binding.manufacturerId
        && profile.part.manufacturerPartNumber === binding.manufacturerPartNumber
      )))
    ));
  const candidateProfiles = exactBindings !== undefined && (
    matchingProfiles.length !== exactBindings.length
    || new Set(exactBindings.map((binding) => `${binding.manufacturerId}\n${binding.manufacturerPartNumber}`)).size !== exactBindings.length
  )
    ? []
    : matchingProfiles;
  const profiles = candidateProfiles
    .flatMap((profile): ReviewedSharedProfileBinding[] => {
      const expectedPath = exactProfilePath(profile.partClass, profile.part);
      const exactBinding = exactBindings?.find((binding) => (
        binding.manufacturerId === profile.part.manufacturerId
        && binding.manufacturerPartNumber === profile.part.manufacturerPartNumber
      ));
      if (exactBindings !== undefined && (exactBinding === undefined || expectedPath !== exactBinding.profilePath)) return [];
      const identityReleaseRefs = reconciliation.release.profiles.filter((entry) => (
        entry.partClass === profile.partClass
        && entry.part.manufacturerId === profile.part.manufacturerId
        && entry.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
      ));
      const identityAdmissionEntries = reconciliation.admission.entries.filter((entry) => (
        entry.partClass === profile.partClass
        && entry.part.manufacturerId === profile.part.manufacturerId
        && entry.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
      ));
      if (
        exactBindings !== undefined
        && (identityReleaseRefs.length !== 1 || identityAdmissionEntries.length !== 1)
      ) return [];
      const releaseRefs = identityReleaseRefs.filter((entry) => (
        entry.profileId === expectedPath
        && entry.profilePath === expectedPath
        && (exactBinding === undefined
          || entry.profileContentHash === exactBinding.profileContentHash)
      ));
      if (releaseRefs.length !== 1 || recipeBindings.length === 0) return [];
      const releaseRef = releaseRefs[0]!;
      if (!exactReviewedAdmission(profile, releaseRef, reconciliation.admission)) return [];
      const requiredFacts = requirement.requiredFacts.map((fact) => requiredFactCoverage(profile, fact));
      if (requiredFacts.some((fact) => fact === null)) return [];
      const preservedUnknownFacts = (requirement.preservedUnknownFacts ?? [])
        .map((fact) => preservedUnknownFactCoverage(profile, fact));
      if (preservedUnknownFacts.some((fact) => fact === null)) return [];
      return [{
        profileId: releaseRef.profileId,
        profilePath: releaseRef.profilePath,
        partClass: requirement.partClass,
        manufacturerId: profile.part.manufacturerId,
        manufacturerPartNumber: profile.part.manufacturerPartNumber,
        factsSchemaVersion: requirement.factsSchemaVersion,
        profileContentHash: releaseRef.profileContentHash,
        admissionState: "reviewed",
        requiredFacts: requiredFacts as ReviewedSharedProfileFactCoverage[],
        preservedUnknownFacts: preservedUnknownFacts as ReviewedSharedProfileExplicitUnknownFactCoverage[],
        generatorEnumerationRecipes: recipeBindings.map((recipe) => ({ ...recipe })),
      }];
    })
    .sort((left, right) => compareDesignV2Tokens(left.profilePath, right.profilePath));
  const factCoverageSatisfied = profiles.length > 0;
  const roleSatisfied = requirement.roleAuthority.status === "not_required"
    ? recipeBindings.length === 1
    : factCoverageSatisfied && requirement.roleAuthority.status === "available";
  return {
    partClass: requirement.partClass,
    factsSchemaVersion: requirement.factsSchemaVersion,
    requiredFactPaths: requirement.requiredFacts.map((fact) => fact.path),
    preservedUnknownFactPaths: (requirement.preservedUnknownFacts ?? []).map((fact) => fact.path),
    requiredRecipeId: requirement.requiredRecipeId,
    requiredRecipeVersion: requirement.requiredRecipeVersion,
    requiredRecipeContentHash: requirement.requiredRecipeContentHash,
    factCoverageSatisfied,
    roleAuthority: { ...requirement.roleAuthority },
    satisfied: roleSatisfied,
    profiles,
  };
}

function partClass(profile: ReviewedRealMotorProfile): "motor.integrated-h-bridge" | "motor.full-bridge-gate-driver" {
  return profile.kind === "integrated_bridge" ? "motor.integrated-h-bridge" : "motor.full-bridge-gate-driver";
}

function exactReleasedProfile(
  profile: ReviewedRealMotorProfile,
  reconciliation: ReviewedReleaseReconciliation,
): { profile: DesignProfileEnvelope; releaseRef: CatalogProfileRefV1 } | null {
  const expectedClass = partClass(profile);
  const expectedPath = ownershipTargetPath(profile);
  const normalizedProfiles = reconciliation.catalog.profiles.filter((candidate) => (
    candidate.partClass === expectedClass
    && candidate.part.manufacturerId === profile.part.manufacturerId
    && candidate.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
  ));
  const releaseRefs = reconciliation.release.profiles.filter((candidate) => (
    candidate.partClass === expectedClass
    && candidate.part.manufacturerId === profile.part.manufacturerId
    && candidate.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
    && candidate.profilePath === expectedPath
  ));
  if (normalizedProfiles.length !== 1 || releaseRefs.length !== 1) return null;
  const normalized = normalizedProfiles[0]!;
  const releaseRef = releaseRefs[0]!;
  if (releaseRef.profileId !== expectedPath || releaseRef.profilePath !== expectedPath) return null;
  return { profile: normalized, releaseRef };
}

const DRV8262_COMPANION_NETWORK_GATE = Object.freeze({
  profileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
  profileContentHash: "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a",
  recipeId: "motor.native.integrated-h-bridge.facts-v3-2",
  recipeVersion: "3.2.6",
  recipeContentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07",
});

function exactCompanionNetworkMaterializationExclusion(
  released: ReturnType<typeof exactReleasedProfile>,
  reconciliation: ReviewedReleaseReconciliation,
): boolean {
  if (
    released === null
    || released.releaseRef.profileId !== DRV8262_COMPANION_NETWORK_GATE.profileId
    || released.releaseRef.profileContentHash !== DRV8262_COMPANION_NETWORK_GATE.profileContentHash
  ) return false;
  return reconciliation.installedRecipes.some((recipe) => (
    recipe.id === DRV8262_COMPANION_NETWORK_GATE.recipeId
    && recipe.version === DRV8262_COMPANION_NETWORK_GATE.recipeVersion
    && recipe.contentHash === DRV8262_COMPANION_NETWORK_GATE.recipeContentHash
  ));
}

function generatorEnumerationRecipeIds(
  released: ReturnType<typeof exactReleasedProfile>,
  reconciliation: ReviewedReleaseReconciliation,
): string[] {
  if (released === null) return [];
  const exactCompanionNetworkExclusion = exactCompanionNetworkMaterializationExclusion(released, reconciliation);
  return reconciliation.productionStatus.recipeReadiness
    .filter((recipe) => recipe.recognizedContract && recipe.ready)
    .filter((recipe) => recipe.profileRequirements.some((requirement) => (
      requirement.partClass === released.profile.partClass
      && requirement.factsSchemaVersion === released.profile.factsSchemaVersion
      && requirement.reviewedProfileCount > 0
    )))
    .filter((recipe) => !(
      exactCompanionNetworkExclusion
      && recipe.recipeId === DRV8262_COMPANION_NETWORK_GATE.recipeId
      && recipe.recipeVersion === DRV8262_COMPANION_NETWORK_GATE.recipeVersion
    ))
    .map((recipe) => recipe.recipeId)
    .sort(compareDesignV2Tokens);
}

function coverage(
  profile: ReviewedRealMotorProfile,
  admission: DesignProfileAdmissionLedgerV1,
  reconciliation: ReviewedReleaseReconciliation,
): ReviewedProfileCoverage {
  const factIds = profile.kind === "integrated_bridge" ? INTEGRATED_BRIDGE_FACT_IDS : GATE_DRIVER_FACT_IDS;
  const facts = profile.facts as Record<string, ReviewedFact>;
  const missingFields: string[] = factIds.filter((id) => facts[id]!.state === "unknown");
  if (profile.package.name.state === "unknown") missingFields.push("package.name");
  if (profile.package.bodyAreaM2.state === "unknown") missingFields.push("package.bodyAreaM2");
  const evidence = profileEvidence(profile);
  const missingSourceHashes = [...new Set(evidence
    .filter((entry) => entry.contentHash === undefined)
    .map((entry) => entry.sourceId))]
    .sort(compareDesignV2Tokens);
  const technicalFactComplete = missingFields.length === 0;
  const sourceHashComplete = missingSourceHashes.length === 0;
  const ownershipEntry = exactOwnershipEntry(profile, admission);
  const reserved = ownershipEntry !== null;
  const released = exactReleasedProfile(profile, reconciliation);
  const catalogAdmitted = released !== null;
  const companionNetworkExcluded = exactCompanionNetworkMaterializationExclusion(released, reconciliation);
  const enumerationRecipeIds = generatorEnumerationRecipeIds(released, reconciliation);
  const generatorEligible = enumerationRecipeIds.length > 0;
  return {
    profileId: profile.id,
    kind: profile.kind,
    manufacturerId: profile.part.manufacturerId,
    manufacturerPartNumber: profile.part.manufacturerPartNumber,
    ownershipTargetPath: ownershipTargetPath(profile),
    reviewedFactCount: factIds.length + 2 - missingFields.length,
    evidenceReferenceCount: evidence.length,
    missingFields,
    missingSourceHashes,
    authoredFromPrimarySources: true,
    technicalFactComplete,
    sourceHashComplete,
    ownershipReserved: reserved,
    ownershipLedger: ownershipEntry === null ? null : {
      state: ownershipEntry.state,
      profileContentHash: ownershipEntry.profileContentHash,
      factsReviewedAndConditionedCheck: exactAdmissionCheckStatus(ownershipEntry, "facts.reviewed_and_conditioned"),
      independentReviewCheck: exactAdmissionCheckStatus(ownershipEntry, "review.independent"),
    },
    catalogAdmitted,
    admittedProfileId: released?.releaseRef.profileId ?? null,
    admittedFactsSchemaVersion: released?.profile.factsSchemaVersion ?? null,
    admittedProfileContentHash: released?.releaseRef.profileContentHash ?? null,
    generatorEligible,
    generatorEnumerationRecipeIds: enumerationRecipeIds,
    generatorEligibilityScope: "candidate_materialization_after_recipe_match",
    exclusionReasons: [
      ...(technicalFactComplete ? [] : [`Missing required design facts: ${missingFields.join(", ")}`]),
      ...(sourceHashComplete ? [] : [`ADR-0003 source content hashes missing: ${missingSourceHashes.join(", ")}`]),
      ...(reserved ? [] : ["Exact-MPN manifest ownership is not reserved"]),
      ...(catalogAdmitted ? [] : ["Independent evidence review and catalog admission are pending; staged evidence remains excluded from generation"]),
      ...(companionNetworkExcluded
        ? ["The exact installed Motor recipe rejects this admitted DRV8262DDVR profile before component materialization because two distinct VM bypass positions plus separate charge-pump and regulator capacitor networks are unrepresentable by its one-local-capacitor structure"]
        : catalogAdmitted && !generatorEligible
        ? ["The admitted facts profile is not enumerable by an exact recognized installed ready Motor recipe contract"]
        : []),
      "This staged source record remains isolated from the legacy synthetic M1/M2 generator library; exact normalized catalog profiles are reconciled separately",
    ],
  };
}

export function buildReviewedRealCatalogReport(
  catalog: ReviewedRealMotorCatalog,
  options: Readonly<ReviewedRealCatalogReportOptions> = {},
): ReviewedRealCatalogReport {
  assertValidReviewedRealMotorCatalog(catalog);
  const allProfiles: ReviewedRealMotorProfile[] = [...catalog.integratedBridges, ...catalog.gateDrivers];
  const documents = getBundledDesignLibraryDocuments();
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const reviewedDocuments = options.reviewedDocuments ?? getBundledReviewedReleaseDocuments();
  const installedRecipes = options.installedMotorRecipes ?? getInstalledMotorRecipeRefsV2();
  const reviewedCatalog = buildReviewedProfileCatalogV2(reviewedDocuments);
  const productionStatus = assessMotorDesignV2ProductionReadiness(reviewedCatalog, installedRecipes);
  const reconciliation: ReviewedReleaseReconciliation = {
    catalog: reviewedCatalog,
    release: reviewedDocuments.catalogRelease as DesignCatalogReleaseV1,
    admission: reviewedDocuments.admission as DesignProfileAdmissionLedgerV1,
    installedRecipes,
    productionStatus,
  };
  const profiles = allProfiles.map((profile) => coverage(profile, admission, reconciliation));
  const bootstrapCapacitors = sharedProfileCoverage(BOOTSTRAP_CAPACITOR_REQUIREMENT, reconciliation);
  const localDecouplingCapacitors = sharedProfileCoverage(LOCAL_DECOUPLING_CAPACITOR_REQUIREMENT, reconciliation);
  const externalNmos = sharedProfileCoverage(EXTERNAL_NMOS_REQUIREMENT, reconciliation);
  const currentShunts = sharedProfileCoverage(CURRENT_SHUNT_REQUIREMENT, reconciliation);
  const seriesGateResistors = sharedProfileCoverage(SERIES_GATE_RESISTOR_REQUIREMENT, reconciliation);
  const pulldownResistors = sharedProfileCoverage(PULLDOWN_RESISTOR_REQUIREMENT, reconciliation);
  const supplyTvs = sharedProfileCoverage(SUPPLY_TVS_REQUIREMENT, reconciliation);
  const integratedManufacturers = new Set(catalog.integratedBridges.map((profile) => profile.part.manufacturerId));
  const gateDriverManufacturers = new Set(catalog.gateDrivers.map((profile) => profile.part.manufacturerId));
  const missingSourceHashes = [...new Set(profiles.flatMap((profile) => profile.missingSourceHashes))]
    .sort(compareDesignV2Tokens);
  return {
    catalogId: catalog.catalogId,
    provenanceState: catalog.provenanceState,
    catalogAdmission: catalog.catalogAdmission,
    generatedFromRetrievedAt: catalog.retrievedAt,
    totals: {
      profiles: allProfiles.length,
      integratedBridges: catalog.integratedBridges.length,
      gateDrivers: catalog.gateDrivers.length,
      manufacturers: new Set(allProfiles.map((profile) => profile.part.manufacturerId)).size,
      evidenceReferences: profiles.reduce((sum, profile) => sum + profile.evidenceReferenceCount, 0),
      missingSourceHashCount: missingSourceHashes.length,
      sourceHashCompleteProfiles: profiles.filter((profile) => profile.sourceHashComplete).length,
      reservedOwnershipProfiles: profiles.filter((profile) => profile.ownershipReserved).length,
      catalogAdmittedProfiles: profiles.filter((profile) => profile.catalogAdmitted).length,
      generatorEligibleProfiles: profiles.filter((profile) => profile.generatorEligible).length,
    },
    targets: {
      integratedBridges: {
        authoredProfiles: catalog.integratedBridges.length,
        targetProfiles: 8,
        manufacturers: integratedManufacturers.size,
        targetManufacturers: 3,
        profilesRemaining: Math.max(0, 8 - catalog.integratedBridges.length),
      },
      gateDrivers: {
        authoredProfiles: catalog.gateDrivers.length,
        targetProfiles: 6,
        manufacturers: gateDriverManufacturers.size,
        targetManufacturers: 3,
        profilesRemaining: Math.max(0, 6 - catalog.gateDrivers.length),
      },
    },
    missingSourceHashes,
    ownershipTargets: profiles.map((profile) => ({
      profileId: profile.profileId,
      manufacturerId: profile.manufacturerId,
      manufacturerPartNumber: profile.manufacturerPartNumber,
      profilePath: profile.ownershipTargetPath,
    })),
    coverageRequirementGaps: {
      applicationEnvelope: [
        "The Motor application envelope remains unclosed for stall or peak requirements up to 30 A. The external-FET H-bridge topology is the intended high-current path, but stall duration, pulse duty, MOSFET safe-operating-area, protection response, and transient-thermal evidence are not jointly bound.",
      ],
      integratedBridges: [
        "The tranche has incomplete 1 kHz to 100 kHz hard PWM evidence: DRV8262DDVR's 200 kHz statement is application guidance rather than a guaranteed bound, and STSPIN840 has no admitted PWM maximum.",
      ],
      gateDrivers: [
        "The tranche does not yet establish overlapping coverage down to a 4.5 V motor bus.",
        "HIP4081AIBZ has no authored bridge-bus operating maximum; 80 V is retained only as an absolute maximum.",
        "Source/sink current is missing for A3941KLPTR-T.",
        "Configured dead time is missing for A3941KLPTR-T and HIP4081AIBZ because their programmable value is application-dependent.",
        "Bootstrap ripple/overhead-charge limits are missing for all three profiles, and continuous-duty limits remain unknown for HIP4081AIBZ.",
      ],
    },
    coverageBoundaries: {
      integratedBridges: {
        authoredNormalPeakCurrentMaximumA: 3.5,
        explanation: "The integrated-bridge tranche's authored normal peak-current ceiling is 3.5 A. DRV8262DDVR's 32 A figure is protection-threshold evidence, not a normal peak or stall-current guarantee.",
      },
    },
    sharedProfileCoverage: {
      bootstrapCapacitors,
      localDecouplingCapacitors,
      externalNmos,
      currentShunts,
      seriesGateResistors,
      pulldownResistors,
      supplyTvs,
    },
    sharedProfileGaps: [
      ...(externalNmos.satisfied ? [] : [EXTERNAL_NMOS_SHARED_GAP]),
      ...(currentShunts.satisfied ? [] : [CURRENT_SHUNT_SHARED_GAP]),
      CAPACITOR_SHARED_GAP,
      ...(supplyTvs.satisfied ? [] : [SUPPLY_TVS_SHARED_GAP]),
    ],
    profiles,
  };
}
