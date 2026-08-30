import {
  componentPinPointsV4,
  type CircuitComponentV4,
  type CircuitGraphV4,
  type Point,
} from "@opencircuit/circuit-schema";
import {
  designProfileEnvelopeContentHash,
  parseDesignCatalogRelease,
  parseDesignProfileAdmission,
  parseDesignProfileEnvelope,
  parseManufacturerRegistry,
  type DesignProfileEnvelope,
  type ProfileEvidenceKind,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library";
import {
  validateDesignResultEngineeringContextV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignCandidateV2,
  type DesignResultV2,
} from "@opencircuit/design-schema";

export const POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V1 =
  "schemagic-power-physical-implementation-handoff" as const;
export const POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V1 = 1 as const;

const HERO_RECIPE_ID =
  "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified" as const;
const HERO_CIRCUIT_ID = "assembly" as const;
const HERO_LINE_IDS = Object.freeze([
  "bootstrap-capacitor",
  "feedback-lower",
  "feedback-upper",
  "input-capacitor",
  "output-capacitor",
  "power-inductor",
  "primary",
] as const);
const HERO_REFDES = Object.freeze({
  "bootstrap-capacitor": "C1",
  "feedback-lower": "R1",
  "feedback-upper": "R2",
  "input-capacitor": "C2",
  "output-capacitor": "C3",
  "power-inductor": "L1",
  primary: "U1",
} satisfies Record<HeroLineIdV1, string>);
const HERO_COMPONENT_TYPES = Object.freeze({
  "bootstrap-capacitor": "capacitor",
  "feedback-lower": "resistor",
  "feedback-upper": "resistor",
  "input-capacitor": "capacitor",
  "output-capacitor": "capacitor",
  "power-inductor": "inductor",
  primary: "design_block",
} satisfies Record<HeroLineIdV1, CircuitComponentV4["type"]>);
const HERO_LINE_PROFILE_EXPECTATIONS = Object.freeze({
  "bootstrap-capacitor": {
    partClass: "shared.mlcc-capacitor",
    manufacturerId: "tdk-corporation",
    manufacturerPartNumber: "C1608X7R1H104K080AA",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json",
    profileContentHash: "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6",
  },
  "feedback-lower": {
    partClass: "shared.general-purpose-resistor",
    manufacturerId: "bourns",
    manufacturerPartNumber: "CR0603-FX-1003ELF",
    profileId: "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json",
    profileContentHash: "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6",
  },
  "feedback-upper": {
    partClass: "shared.general-purpose-resistor",
    manufacturerId: "vishay-intertechnology",
    manufacturerPartNumber: "CRCW0603732KFKEA",
    profileId: "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json",
    profileContentHash: "sha256:30d45602549f1ab1c4f9434b419ccdfa95a5381ef70ff4297d7ceb6ae50259c4",
  },
  "input-capacitor": {
    partClass: "shared.mlcc-capacitor",
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM31CR61H106KA12L",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
    profileContentHash: "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
  },
  "output-capacitor": {
    partClass: "shared.mlcc-capacitor",
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM31CR61H106KA12L",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
    profileContentHash: "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
  },
  "power-inductor": {
    partClass: "power.power-inductor",
    manufacturerId: "bel-fuse",
    manufacturerPartNumber: "F1F2-0804-2R2M",
    profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json",
    profileContentHash: "sha256:6eb4c18bb984319a5fa56d615f571c03e4fa7670e2782ff4754dbba13dbc89b6",
  },
  primary: {
    partClass: "power.integrated-synchronous-buck-regulator",
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "TPS54302DDCR",
    profileId: "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json",
    profileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
  },
} satisfies Record<HeroLineIdV1, Readonly<{
  partClass: string;
  manufacturerId: string;
  manufacturerPartNumber: string;
  profileId: string;
  profileContentHash: `sha256:${string}`;
}>>);
const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;
const MAX_HANDOFF_BYTES = 16 * 1024 * 1024;

type HeroLineIdV1 = typeof HERO_LINE_IDS[number];
type PhysicalProfileFactStateV1 = "reviewed" | "calculated" | "estimated" | "unknown";
type PublishedProfileEvidenceKindV1 = Exclude<
  ProfileEvidenceKind,
  "synthetic_fixture" | "authored_derivation"
>;

export type PowerPhysicalImplementationLineDiagnosticCodeV1 =
  | "physical_pin_mapping_unavailable"
  | "kicad_footprint_identity_unavailable"
  | "structural_symbol_not_package_complete";

export type PowerPhysicalImplementationDiagnosticCodeV1 =
  | "footprint_assignments_incomplete"
  | "placement_not_authored";

export type PowerPhysicalImplementationHandoffErrorCodeV1 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "unsupported_candidate"
  | "catalog_identity_unverified"
  | "physical_mapping_unavailable"
  | "invalid_handoff";

export interface PowerPhysicalSourceEvidenceRefV1 {
  factPath: string;
  sourceId: string;
  locator: string;
  licenseNote: string;
  kind: PublishedProfileEvidenceKindV1;
  retrievedAt: string;
  contentHash: `sha256:${string}`;
  url: string;
  revision: string;
  publicationBasis: "public_facts" | "licensed_redistribution" | "original_measurement";
}

export interface PowerPhysicalImplementationLineV1 {
  bomLineId: HeroLineIdV1;
  role: string;
  quantityPerAssembly: 1;
  refdes: string;
  selectedPart: {
    manufacturerId: string;
    manufacturerPartNumber: string;
  };
  profile: {
    id: string;
    path: string;
    partClass: string;
    factsSchemaVersion: string;
    contentHash: `sha256:${string}`;
    review: {
      state: "reviewed";
      ownerTrack: string;
      reviewerTrack: string;
      authoredBy: string;
      authoredAt: string;
      reviewedBy: string;
      reviewedAt: string;
    };
  };
  structuralInstance: {
    circuitId: typeof HERO_CIRCUIT_ID;
    componentId: HeroLineIdV1;
    componentType: CircuitComponentV4["type"];
    symbol: {
      kind: "project_authored_structural";
      contentHash: `sha256:${string}`;
      physicalPackageComplete: false;
    };
    pins: Array<{
      structuralPinIndex: number;
      structuralPinName: string;
      netId: string;
      physicalPinNumber: null;
      mappingState: "unavailable";
    }>;
  };
  physicalEvidence: {
    packageIdentity: {
      state: "reviewed_profile_fact";
      name: string;
      profileFactPath: "commonFacts.packageName";
    };
    mountedGeometry: {
      boardArea: {
        state: PhysicalProfileFactStateV1;
        squareMetres: number | null;
        basis: string | null;
      };
      maximumHeight: {
        state: PhysicalProfileFactStateV1;
        metres: number | null;
        basis: string | null;
      };
      claimBoundary: "package_or_land_pattern_envelope_only_not_footprint_identity";
    };
    sourceEvidence: PowerPhysicalSourceEvidenceRefV1[];
  };
  footprintMapping: {
    state: "unavailable";
    kicadLibraryId: null;
    mappingContentHash: null;
  };
  diagnostics: Array<{
    code: PowerPhysicalImplementationLineDiagnosticCodeV1;
    message: string;
  }>;
}

export interface PowerPhysicalImplementationHandoffV1 {
  format: typeof POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V1;
  schemaVersion: typeof POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V1;
  artifactKind: "physical_implementation_handoff";
  scope: {
    application: "power.buck";
    candidateKind: "integrated_synchronous_buck_exact_bom_observation";
    attestation: "none";
    physicalFidelityClaim: "none";
    candidateEligibilityAuthority: "none";
    simulationFidelityClaim: "none";
    behavioralAndElectricalArtifacts: "unchanged";
    manufacturingOutputClaim: "none";
  };
  provenance: {
    designResult: {
      contentHash: DesignResultV2["contentHash"];
      requestHash: DesignResultV2["requestHash"];
      libraryVersion: string;
      libraryContentHash: DesignResultV2["libraryContentHash"];
    };
    engineeringContext: {
      version: string;
      contentHash: `sha256:${string}`;
    };
    catalogRelease: {
      version: string;
      contentHash: `sha256:${string}`;
    };
    candidate: {
      id: CandidateIdV2;
      recipeId: typeof HERO_RECIPE_ID;
      recipeVersion: string;
      recipeContentHash: `sha256:${string}`;
    };
    circuit: {
      id: typeof HERO_CIRCUIT_ID;
      contentHash: `sha256:${string}`;
    };
  };
  implementation: {
    state: "unavailable";
    footprintAssignedKicadSchematic: {
      state: "not_emitted";
      contentHash: null;
    };
    placement: {
      state: "not_emitted";
      routing: "unrouted";
      verification: "unverified";
      contentHash: null;
    };
  };
  lines: PowerPhysicalImplementationLineV1[];
  diagnostics: Array<{
    code: PowerPhysicalImplementationDiagnosticCodeV1;
    affectedBomLineIds: HeroLineIdV1[];
    message: string;
  }>;
  contentHash: `sha256:${string}`;
}

export class PowerPhysicalImplementationHandoffErrorV1 extends Error {
  readonly code: PowerPhysicalImplementationHandoffErrorCodeV1;
  readonly diagnostics: readonly Readonly<{
    code: PowerPhysicalImplementationDiagnosticCodeV1;
    affectedBomLineIds: readonly HeroLineIdV1[];
    message: string;
  }>[];

  constructor(
    code: PowerPhysicalImplementationHandoffErrorCodeV1,
    diagnostics: PowerPhysicalImplementationHandoffV1["diagnostics"] = [],
  ) {
    super(`scheMAGIC Power physical implementation handoff was rejected: ${code}`);
    this.name = "PowerPhysicalImplementationHandoffErrorV1";
    this.code = code;
    this.diagnostics = Object.freeze(diagnostics.map((entry) => Object.freeze({
      ...entry,
      affectedBomLineIds: Object.freeze([...entry.affectedBomLineIds]),
    })));
  }
}

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
    && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value);
}

function validHash(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && HASH.test(value);
}

function samePart(
  left: Readonly<{ manufacturerId: string; manufacturerPartNumber: string }>,
  right: Readonly<{ manufacturerId: string; manufacturerPartNumber: string }>,
): boolean {
  return left.manufacturerId === right.manufacturerId
    && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function isProfileEvidence(value: unknown): value is ProfileEvidenceRef {
  const item = record(value);
  return item !== undefined
    && typeof item.kind === "string"
    && typeof item.sourceId === "string"
    && typeof item.locator === "string"
    && typeof item.licenseNote === "string";
}

function physicalEvidence(
  profile: Readonly<DesignProfileEnvelope>,
): PowerPhysicalSourceEvidenceRefV1[] {
  const found: PowerPhysicalSourceEvidenceRefV1[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}.${index}`));
      return;
    }
    if (isProfileEvidence(value)) {
      if (value.kind === "synthetic_fixture" || value.kind === "authored_derivation"
        || value.contentHash === null
        || value.url === null || value.revision === null || value.publicationBasis === null
        || value.retrievedAt === null) {
        throw new PowerPhysicalImplementationHandoffErrorV1("catalog_identity_unverified");
      }
      found.push({
        factPath: path,
        sourceId: value.sourceId,
        locator: value.locator,
        licenseNote: value.licenseNote,
        kind: value.kind,
        retrievedAt: value.retrievedAt,
        contentHash: value.contentHash,
        url: value.url,
        revision: value.revision,
        publicationBasis: value.publicationBasis,
      });
      return;
    }
    const item = record(value);
    if (item === undefined) return;
    for (const key of Object.keys(item).sort(compareText)) visit(item[key], `${path}.${key}`);
  };
  visit(profile.commonFacts.packageName, "commonFacts.packageName");
  const mountedGeometry = record(profile.facts)?.mountedGeometry;
  if (mountedGeometry !== undefined) visit(mountedGeometry, "facts.mountedGeometry");
  const unique = new Map(found.map((entry) => [canonicalDesignV2Payload(entry), entry]));
  return [...unique.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, entry]) => entry);
}

function factState(value: unknown): PhysicalProfileFactStateV1 {
  const state = record(value)?.state;
  if (state === "reviewed" || state === "calculated" || state === "estimated" || state === "unknown") {
    return state;
  }
  return "unknown";
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return validText(value) ? value : null;
}

function mountedGeometry(profile: Readonly<DesignProfileEnvelope>): PowerPhysicalImplementationLineV1["physicalEvidence"]["mountedGeometry"] {
  const mounted = record(record(profile.facts)?.mountedGeometry);
  const board = record(mounted?.boardArea);
  const boardValue = record(board?.value);
  const area = record(boardValue?.area);
  const height = record(mounted?.maximumHeight);
  const heightValue = record(height?.value);
  const heightQuantity = record(heightValue?.height);
  return {
    boardArea: {
      state: factState(board),
      squareMetres: finiteOrNull(area?.value),
      basis: stringOrNull(boardValue?.basis),
    },
    maximumHeight: {
      state: factState(height),
      metres: finiteOrNull(heightQuantity?.value),
      basis: stringOrNull(heightValue?.basis),
    },
    claimBoundary: "package_or_land_pattern_envelope_only_not_footprint_identity",
  };
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(value: string): void {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }

  find(value: string): string {
    this.add(value);
    const parent = this.parent.get(value)!;
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

function pointKey(point: Readonly<Point>): string {
  return `${Object.is(point[0], -0) ? 0 : point[0]},${Object.is(point[1], -0) ? 0 : point[1]}`;
}

function netLabels(
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
): ReadonlyMap<string, readonly string[]> {
  const union = new UnionFind();
  const componentPoints = new Map<string, Point[]>();
  for (const wire of circuit.wires) {
    const first = pointKey(wire.points[0]!);
    union.add(first);
    for (const point of wire.points.slice(1)) union.union(first, pointKey(point));
  }
  for (const component of circuit.components) {
    const points = componentPinPointsV4(component, candidate.circuit.designBlocks);
    componentPoints.set(component.id, points);
    for (const point of points) union.add(pointKey(point));
  }
  const roots = new Set<string>();
  for (const points of componentPoints.values()) {
    for (const point of points) roots.add(union.find(pointKey(point)));
  }
  for (const wire of circuit.wires) roots.add(union.find(pointKey(wire.points[0]!)));
  const labels = new Map([...roots].sort(compareText).map((root, index) => [
    root,
    `POWER_NET_${String(index + 1).padStart(3, "0")}`,
  ]));
  return new Map([...componentPoints].map(([componentId, points]) => [
    componentId,
    points.map((point) => labels.get(union.find(pointKey(point)))!),
  ]));
}

function structuralPinNames(
  candidate: Readonly<DesignCandidateV2>,
  component: Readonly<CircuitComponentV4>,
  count: number,
): string[] {
  if (component.type !== "design_block") {
    return Array.from({ length: count }, (_, index) => `P${index + 1}`);
  }
  const block = candidate.circuit.designBlocks.find((entry) => entry.id === component.block.id
    && entry.version === component.block.version
    && entry.contentHash === component.block.contentHash);
  if (block === undefined || block.pins.length !== count) {
    throw new PowerPhysicalImplementationHandoffErrorV1("unsupported_candidate");
  }
  return block.pins.map((pin) => pin.name);
}

function structuralSymbolHash(
  candidate: Readonly<DesignCandidateV2>,
  component: Readonly<CircuitComponentV4>,
  points: readonly Readonly<Point>[],
  names: readonly string[],
): `sha256:${string}` {
  const block = component.type === "design_block"
    ? candidate.circuit.designBlocks.find((entry) => entry.id === component.block.id
      && entry.version === component.block.version
      && entry.contentHash === component.block.contentHash)
    : undefined;
  return designSha256ContentHash(canonicalDesignV2Payload({
    componentType: component.type,
    block: block === undefined ? null : {
      id: block.id,
      version: block.version,
      contentHash: block.contentHash,
    },
    pins: points.map((point, index) => ({
      name: names[index]!,
      offset: [point[0] - component.pos[0], point[1] - component.pos[1]],
    })),
  }));
}

function lineDiagnostics(
  lineId: HeroLineIdV1,
): PowerPhysicalImplementationLineV1["diagnostics"] {
  const diagnostics: PowerPhysicalImplementationLineV1["diagnostics"] = [
    {
      code: "kicad_footprint_identity_unavailable",
      message: "The reviewed profile binds package and geometry evidence, but no exact reviewed KiCad footprint library identity and footprint bytes.",
    },
    {
      code: "physical_pin_mapping_unavailable",
      message: "No reviewed source-backed mapping binds every persisted structural pin to an exact physical package pin or pad.",
    },
  ];
  if (lineId === "primary") {
    diagnostics.push({
      code: "structural_symbol_not_package_complete",
      message: "The persisted TPS54302DDCR structural symbol has five generic functional ports for a reviewed six-pin package and is not a complete package-pin symbol.",
    });
  }
  return diagnostics.sort((left, right) => compareText(left.code, right.code));
}

function exactHeroCandidate(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): {
  candidate: DesignCandidateV2;
  circuit: CircuitGraphV4;
  recipe: GenerateElectricalContextV2["manifest"]["recipes"][number];
} {
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new PowerPhysicalImplementationHandoffErrorV1("candidate_not_found");
  const circuit = candidate.circuit.circuits.find((entry) => entry.id === HERO_CIRCUIT_ID);
  const recipeMatches = engineeringContext.manifest.recipes.filter((entry) => entry.id === candidate.recipeId);
  const selectedIds = candidate.components.map((entry) => entry.id).sort(compareText);
  if (
    result.request.application !== "power.buck"
    || candidate.recipeId !== HERO_RECIPE_ID
    || circuit === undefined
    || recipeMatches.length !== 1
    || canonicalDesignV2Payload(selectedIds) !== canonicalDesignV2Payload(HERO_LINE_IDS)
    || candidate.components.some((entry) => entry.quantityPerAssembly !== 1)
    || candidate.circuitBomNonRepresentations.some((entry) => entry.circuitId === HERO_CIRCUIT_ID)
  ) {
    throw new PowerPhysicalImplementationHandoffErrorV1("unsupported_candidate");
  }
  for (const lineId of HERO_LINE_IDS) {
    const selected = candidate.components.find((entry) => entry.id === lineId);
    const expectedProfile = HERO_LINE_PROFILE_EXPECTATIONS[lineId];
    const component = circuit.components.find((entry) => entry.id === lineId);
    const classifications = candidate.circuitInstanceClassifications.filter((entry) => (
      entry.circuitId === HERO_CIRCUIT_ID && entry.componentId === lineId
    ));
    const classification = classifications[0];
    if (selected === undefined || component === undefined || component.type !== HERO_COMPONENT_TYPES[lineId]
      || selected.profileId !== expectedProfile.profileId
      || !samePart(selected.part, expectedProfile)
      || classifications.length !== 1 || classification?.kind !== "physical"
      || classification.selectedComponentId !== lineId
      || classification.representedQuantityPerAssembly !== 1) {
      throw new PowerPhysicalImplementationHandoffErrorV1("unsupported_candidate");
    }
  }
  return { candidate, circuit, recipe: recipeMatches[0]! };
}

function buildLine(
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  lineId: HeroLineIdV1,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  labels: ReadonlyMap<string, readonly string[]>,
): PowerPhysicalImplementationLineV1 {
  const selected = candidate.components.find((entry) => entry.id === lineId)!;
  const expectedProfile = HERO_LINE_PROFILE_EXPECTATIONS[lineId];
  const component = circuit.components.find((entry) => entry.id === lineId)!;
  const registry = parseManufacturerRegistry(engineeringContext.catalogDocuments.manufacturerRegistry);
  const release = parseDesignCatalogRelease(engineeringContext.catalogDocuments.catalogRelease);
  const admission = parseDesignProfileAdmission(engineeringContext.catalogDocuments.admission);
  const releaseMatches = release.profiles.filter((entry) => entry.profileId === selected.profileId);
  const releaseRef = releaseMatches[0];
  const rawProfile = engineeringContext.catalogDocuments.profiles[selected.profileId];
  if (releaseMatches.length !== 1 || releaseRef === undefined || rawProfile === undefined
    || releaseRef.profilePath !== selected.profileId || !samePart(releaseRef.part, selected.part)) {
    throw new PowerPhysicalImplementationHandoffErrorV1("catalog_identity_unverified");
  }
  let profile: DesignProfileEnvelope;
  try { profile = parseDesignProfileEnvelope(rawProfile, registry); }
  catch { throw new PowerPhysicalImplementationHandoffErrorV1("catalog_identity_unverified"); }
  const profileHash = designProfileEnvelopeContentHash(profile);
  const admissionMatches = admission.entries.filter((entry) => entry.profilePath === selected.profileId);
  const review = admissionMatches[0];
  if (releaseRef.profileId !== expectedProfile.profileId
    || releaseRef.partClass !== expectedProfile.partClass
    || !samePart(releaseRef.part, expectedProfile)
    || releaseRef.profileContentHash !== expectedProfile.profileContentHash
    || profileHash !== releaseRef.profileContentHash
    || profile.partClass !== releaseRef.partClass
    || !samePart(profile.part, selected.part)
    || admissionMatches.length !== 1
    || review === undefined
    || review.state !== "reviewed"
    || review.profileContentHash !== profileHash
    || review.authoredBy === null || review.authoredAt === null
    || review.reviewedBy === null || review.reviewedAt === null
    || review.ownerTrack === review.reviewerTrack
    || review.authoredBy === review.reviewedBy) {
    throw new PowerPhysicalImplementationHandoffErrorV1("catalog_identity_unverified");
  }
  const packageName = profile.commonFacts.packageName;
  if (packageName.state !== "reviewed" || !validText(packageName.value)) {
    throw new PowerPhysicalImplementationHandoffErrorV1("catalog_identity_unverified");
  }
  const points = componentPinPointsV4(component, candidate.circuit.designBlocks);
  const names = structuralPinNames(candidate, component, points.length);
  const componentLabels = labels.get(component.id);
  if (points.length === 0 || componentLabels === undefined || componentLabels.length !== points.length) {
    throw new PowerPhysicalImplementationHandoffErrorV1("unsupported_candidate");
  }
  const sources = physicalEvidence(profile);
  if (sources.length === 0) throw new PowerPhysicalImplementationHandoffErrorV1("catalog_identity_unverified");
  return {
    bomLineId: lineId,
    role: selected.role,
    quantityPerAssembly: 1,
    refdes: HERO_REFDES[lineId],
    selectedPart: { ...selected.part },
    profile: {
      id: releaseRef.profileId,
      path: releaseRef.profilePath,
      partClass: releaseRef.partClass,
      factsSchemaVersion: profile.factsSchemaVersion,
      contentHash: profileHash,
      review: {
        state: "reviewed",
        ownerTrack: review.ownerTrack,
        reviewerTrack: review.reviewerTrack,
        authoredBy: review.authoredBy,
        authoredAt: review.authoredAt,
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt,
      },
    },
    structuralInstance: {
      circuitId: HERO_CIRCUIT_ID,
      componentId: lineId,
      componentType: component.type,
      symbol: {
        kind: "project_authored_structural",
        contentHash: structuralSymbolHash(candidate, component, points, names),
        physicalPackageComplete: false,
      },
      pins: points.map((_, index) => ({
        structuralPinIndex: index + 1,
        structuralPinName: names[index]!,
        netId: componentLabels[index]!,
        physicalPinNumber: null,
        mappingState: "unavailable",
      })),
    },
    physicalEvidence: {
      packageIdentity: {
        state: "reviewed_profile_fact",
        name: packageName.value,
        profileFactPath: "commonFacts.packageName",
      },
      mountedGeometry: mountedGeometry(profile),
      sourceEvidence: sources,
    },
    footprintMapping: {
      state: "unavailable",
      kicadLibraryId: null,
      mappingContentHash: null,
    },
    diagnostics: lineDiagnostics(lineId),
  };
}

/**
 * Creates a separately content-addressed physical handoff for the exact
 * integrated-Power observation. It intentionally records the strongest
 * reviewed package/geometry evidence while withholding footprint assignment,
 * package-pin mapping, placement, routing, and manufacturing claims.
 */
export function createPowerPhysicalImplementationHandoffV1(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Readonly<PowerPhysicalImplementationHandoffV1> {
  let result: DesignResultV2;
  try { result = parseDesignResultV2(resultInput); }
  catch { throw new PowerPhysicalImplementationHandoffErrorV1("invalid_result"); }
  if (validateDesignResultEngineeringContextV2(result, engineeringContext).length > 0) {
    throw new PowerPhysicalImplementationHandoffErrorV1("engineering_context_unverified");
  }
  const { candidate, circuit, recipe } = exactHeroCandidate(result, candidateId, engineeringContext);
  const labels = netLabels(candidate, circuit);
  const lines = HERO_LINE_IDS.map((lineId) => buildLine(
    candidate,
    circuit,
    lineId,
    engineeringContext,
    labels,
  ));
  const release = parseDesignCatalogRelease(engineeringContext.catalogDocuments.catalogRelease);
  const diagnostics: PowerPhysicalImplementationHandoffV1["diagnostics"] = [
    {
      code: "footprint_assignments_incomplete",
      affectedBomLineIds: [...HERO_LINE_IDS],
      message: "No footprint-assigned KiCad schematic is emitted because all seven exact BOM lines lack a reviewed complete physical-pin map and exact KiCad footprint identity.",
    },
    {
      code: "placement_not_authored",
      affectedBomLineIds: [...HERO_LINE_IDS],
      message: "No placement is emitted; routing remains explicitly unrouted and physical verification remains unverified.",
    },
  ];
  const draft: Omit<PowerPhysicalImplementationHandoffV1, "contentHash"> = {
    format: POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V1,
    schemaVersion: POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V1,
    artifactKind: "physical_implementation_handoff",
    scope: {
      application: "power.buck",
      candidateKind: "integrated_synchronous_buck_exact_bom_observation",
      attestation: "none",
      physicalFidelityClaim: "none",
      candidateEligibilityAuthority: "none",
      simulationFidelityClaim: "none",
      behavioralAndElectricalArtifacts: "unchanged",
      manufacturingOutputClaim: "none",
    },
    provenance: {
      designResult: {
        contentHash: result.contentHash,
        requestHash: result.requestHash,
        libraryVersion: result.libraryVersion,
        libraryContentHash: result.libraryContentHash,
      },
      engineeringContext: {
        version: engineeringContext.manifest.version,
        contentHash: engineeringContext.manifest.contentHash,
      },
      catalogRelease: {
        version: release.version,
        contentHash: release.contentHash,
      },
      candidate: {
        id: candidate.id,
        recipeId: HERO_RECIPE_ID,
        recipeVersion: recipe.version,
        recipeContentHash: recipe.contentHash,
      },
      circuit: {
        id: HERO_CIRCUIT_ID,
        contentHash: designSha256ContentHash(canonicalDesignV2Payload(circuit)),
      },
    },
    implementation: {
      state: "unavailable",
      footprintAssignedKicadSchematic: { state: "not_emitted", contentHash: null },
      placement: {
        state: "not_emitted",
        routing: "unrouted",
        verification: "unverified",
        contentHash: null,
      },
    },
    lines,
    diagnostics,
  };
  return detachedFrozenDesignV2Value({
    ...draft,
    contentHash: designSha256ContentHash(canonicalDesignV2Payload(draft)),
  });
}

function invalidHandoff(): never {
  throw new PowerPhysicalImplementationHandoffErrorV1("invalid_handoff");
}

function validateSourceEvidence(value: unknown): value is PowerPhysicalSourceEvidenceRefV1 {
  const item = record(value);
  return item !== undefined
    && exactKeys(item, [
      "factPath", "sourceId", "locator", "licenseNote", "kind", "retrievedAt",
      "contentHash", "url", "revision", "publicationBasis",
    ])
    && validText(item.factPath) && validText(item.sourceId) && validText(item.locator)
    && validText(item.licenseNote) && validText(item.retrievedAt) && validHash(item.contentHash)
    && validText(item.url) && validText(item.revision)
    && ["manufacturer_datasheet", "manufacturer_product_page", "independent_measurement"].includes(String(item.kind))
    && ["public_facts", "licensed_redistribution", "original_measurement"].includes(String(item.publicationBasis));
}

function validateLine(value: unknown, expectedId: HeroLineIdV1): value is PowerPhysicalImplementationLineV1 {
  const line = record(value);
  const expectedProfile = HERO_LINE_PROFILE_EXPECTATIONS[expectedId];
  if (line === undefined || !exactKeys(line, [
    "bomLineId", "role", "quantityPerAssembly", "refdes", "selectedPart", "profile",
    "structuralInstance", "physicalEvidence", "footprintMapping", "diagnostics",
  ]) || line.bomLineId !== expectedId || !validText(line.role)
    || line.quantityPerAssembly !== 1 || line.refdes !== HERO_REFDES[expectedId]) return false;
  const part = record(line.selectedPart);
  const profile = record(line.profile);
  const review = record(profile?.review);
  if (part === undefined || !exactKeys(part, ["manufacturerId", "manufacturerPartNumber"])
    || part.manufacturerId !== expectedProfile.manufacturerId
    || part.manufacturerPartNumber !== expectedProfile.manufacturerPartNumber
    || profile === undefined || !exactKeys(profile, [
      "id", "path", "partClass", "factsSchemaVersion", "contentHash", "review",
    ]) || profile.id !== expectedProfile.profileId || profile.path !== expectedProfile.profileId
    || profile.partClass !== expectedProfile.partClass || !validText(profile.factsSchemaVersion)
    || profile.contentHash !== expectedProfile.profileContentHash
    || review === undefined || !exactKeys(review, [
      "state", "ownerTrack", "reviewerTrack", "authoredBy", "authoredAt", "reviewedBy", "reviewedAt",
    ]) || review.state !== "reviewed" || !validText(review.ownerTrack) || !validText(review.reviewerTrack)
    || review.ownerTrack === review.reviewerTrack || !validText(review.authoredBy)
    || !validText(review.authoredAt) || !validText(review.reviewedBy)
    || !validText(review.reviewedAt) || review.authoredBy === review.reviewedBy) return false;
  const structural = record(line.structuralInstance);
  const symbol = record(structural?.symbol);
  if (structural === undefined || !exactKeys(structural, [
    "circuitId", "componentId", "componentType", "symbol", "pins",
  ]) || structural.circuitId !== HERO_CIRCUIT_ID || structural.componentId !== expectedId
    || structural.componentType !== HERO_COMPONENT_TYPES[expectedId]
    || symbol === undefined || !exactKeys(symbol, ["kind", "contentHash", "physicalPackageComplete"])
    || symbol.kind !== "project_authored_structural" || !validHash(symbol.contentHash)
    || symbol.physicalPackageComplete !== false || !Array.isArray(structural.pins)
    || structural.pins.length === 0) return false;
  for (const [index, valuePin] of structural.pins.entries()) {
    const pin = record(valuePin);
    if (pin === undefined || !exactKeys(pin, [
      "structuralPinIndex", "structuralPinName", "netId", "physicalPinNumber", "mappingState",
    ]) || pin.structuralPinIndex !== index + 1 || !validText(pin.structuralPinName)
      || !validText(pin.netId) || pin.physicalPinNumber !== null
      || pin.mappingState !== "unavailable") return false;
  }
  const physical = record(line.physicalEvidence);
  const packageIdentity = record(physical?.packageIdentity);
  const geometry = record(physical?.mountedGeometry);
  const board = record(geometry?.boardArea);
  const height = record(geometry?.maximumHeight);
  const states = new Set(["reviewed", "calculated", "estimated", "unknown"]);
  if (physical === undefined || !exactKeys(physical, ["packageIdentity", "mountedGeometry", "sourceEvidence"])
    || packageIdentity === undefined || !exactKeys(packageIdentity, ["state", "name", "profileFactPath"])
    || packageIdentity.state !== "reviewed_profile_fact" || !validText(packageIdentity.name)
    || packageIdentity.profileFactPath !== "commonFacts.packageName"
    || geometry === undefined || !exactKeys(geometry, ["boardArea", "maximumHeight", "claimBoundary"])
    || geometry.claimBoundary !== "package_or_land_pattern_envelope_only_not_footprint_identity"
    || board === undefined || !exactKeys(board, ["state", "squareMetres", "basis"])
    || !states.has(String(board.state))
    || !(board.squareMetres === null || (typeof board.squareMetres === "number" && Number.isFinite(board.squareMetres) && board.squareMetres >= 0))
    || !(board.basis === null || validText(board.basis))
    || height === undefined || !exactKeys(height, ["state", "metres", "basis"])
    || !states.has(String(height.state))
    || !(height.metres === null || (typeof height.metres === "number" && Number.isFinite(height.metres) && height.metres >= 0))
    || !(height.basis === null || validText(height.basis))
    || !Array.isArray(physical.sourceEvidence) || physical.sourceEvidence.length === 0
    || !physical.sourceEvidence.every(validateSourceEvidence)) return false;
  const sourceTokens = physical.sourceEvidence.map((entry) => canonicalDesignV2Payload(entry));
  if (new Set(sourceTokens).size !== sourceTokens.length
    || sourceTokens.some((entry, index) => index > 0 && sourceTokens[index - 1]! >= entry)) return false;
  const footprint = record(line.footprintMapping);
  if (footprint === undefined || !exactKeys(footprint, ["state", "kicadLibraryId", "mappingContentHash"])
    || footprint.state !== "unavailable" || footprint.kicadLibraryId !== null
    || footprint.mappingContentHash !== null || !Array.isArray(line.diagnostics)) return false;
  const expectedCodes: PowerPhysicalImplementationLineDiagnosticCodeV1[] = expectedId === "primary"
    ? ["kicad_footprint_identity_unavailable", "physical_pin_mapping_unavailable", "structural_symbol_not_package_complete"]
    : ["kicad_footprint_identity_unavailable", "physical_pin_mapping_unavailable"];
  if (line.diagnostics.length !== expectedCodes.length) return false;
  return line.diagnostics.every((entry, index) => {
    const diagnostic = record(entry);
    return diagnostic !== undefined && exactKeys(diagnostic, ["code", "message"])
      && diagnostic.code === expectedCodes[index] && validText(diagnostic.message);
  });
}

/** Strict structural parser. Source authority is established only by creation against the exact installed context. */
export function parsePowerPhysicalImplementationHandoffV1(
  input: unknown,
): Readonly<PowerPhysicalImplementationHandoffV1> {
  let snapshot: unknown;
  try {
    if (typeof input === "string") {
      if (new TextEncoder().encode(input).byteLength > MAX_HANDOFF_BYTES) return invalidHandoff();
      snapshot = JSON.parse(input);
    } else {
      snapshot = JSON.parse(canonicalDesignV2Payload(input));
    }
  } catch {
    return invalidHandoff();
  }
  const artifact = record(snapshot);
  if (artifact === undefined || !exactKeys(artifact, [
    "format", "schemaVersion", "artifactKind", "scope", "provenance", "implementation",
    "lines", "diagnostics", "contentHash",
  ]) || artifact.format !== POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V1
    || artifact.schemaVersion !== POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V1
    || artifact.artifactKind !== "physical_implementation_handoff" || !validHash(artifact.contentHash)) {
    return invalidHandoff();
  }
  const scope = record(artifact.scope);
  if (scope === undefined || !exactKeys(scope, [
    "application", "candidateKind", "attestation", "physicalFidelityClaim",
    "candidateEligibilityAuthority", "simulationFidelityClaim", "behavioralAndElectricalArtifacts",
    "manufacturingOutputClaim",
  ]) || scope.application !== "power.buck"
    || scope.candidateKind !== "integrated_synchronous_buck_exact_bom_observation"
    || scope.attestation !== "none" || scope.physicalFidelityClaim !== "none"
    || scope.candidateEligibilityAuthority !== "none" || scope.simulationFidelityClaim !== "none"
    || scope.behavioralAndElectricalArtifacts !== "unchanged"
    || scope.manufacturingOutputClaim !== "none") return invalidHandoff();
  const provenance = record(artifact.provenance);
  const result = record(provenance?.designResult);
  const context = record(provenance?.engineeringContext);
  const release = record(provenance?.catalogRelease);
  const candidate = record(provenance?.candidate);
  const circuit = record(provenance?.circuit);
  if (provenance === undefined || !exactKeys(provenance, [
    "designResult", "engineeringContext", "catalogRelease", "candidate", "circuit",
  ]) || result === undefined || !exactKeys(result, [
    "contentHash", "requestHash", "libraryVersion", "libraryContentHash",
  ]) || !validHash(result.contentHash) || !validHash(result.requestHash)
    || !validText(result.libraryVersion) || !validHash(result.libraryContentHash)
    || context === undefined || !exactKeys(context, ["version", "contentHash"])
    || !validText(context.version) || !validHash(context.contentHash)
    || release === undefined || !exactKeys(release, ["version", "contentHash"])
    || !validText(release.version) || !validHash(release.contentHash)
    || candidate === undefined || !exactKeys(candidate, [
      "id", "recipeId", "recipeVersion", "recipeContentHash",
    ]) || typeof candidate.id !== "string" || !CANDIDATE_ID.test(candidate.id)
    || candidate.recipeId !== HERO_RECIPE_ID || !validText(candidate.recipeVersion)
    || !validHash(candidate.recipeContentHash)
    || circuit === undefined || !exactKeys(circuit, ["id", "contentHash"])
    || circuit.id !== HERO_CIRCUIT_ID || !validHash(circuit.contentHash)) return invalidHandoff();
  const implementation = record(artifact.implementation);
  const schematic = record(implementation?.footprintAssignedKicadSchematic);
  const placement = record(implementation?.placement);
  if (implementation === undefined || !exactKeys(implementation, [
    "state", "footprintAssignedKicadSchematic", "placement",
  ]) || implementation.state !== "unavailable"
    || schematic === undefined || !exactKeys(schematic, ["state", "contentHash"])
    || schematic.state !== "not_emitted" || schematic.contentHash !== null
    || placement === undefined || !exactKeys(placement, [
      "state", "routing", "verification", "contentHash",
    ]) || placement.state !== "not_emitted" || placement.routing !== "unrouted"
    || placement.verification !== "unverified" || placement.contentHash !== null) return invalidHandoff();
  if (!Array.isArray(artifact.lines) || artifact.lines.length !== HERO_LINE_IDS.length
    || !artifact.lines.every((line, index) => validateLine(line, HERO_LINE_IDS[index]!))) return invalidHandoff();
  if (!Array.isArray(artifact.diagnostics) || artifact.diagnostics.length !== 2) return invalidHandoff();
  const expectedGlobalCodes: PowerPhysicalImplementationDiagnosticCodeV1[] = [
    "footprint_assignments_incomplete",
    "placement_not_authored",
  ];
  for (const [index, value] of artifact.diagnostics.entries()) {
    const diagnostic = record(value);
    if (diagnostic === undefined || !exactKeys(diagnostic, ["code", "affectedBomLineIds", "message"])
      || diagnostic.code !== expectedGlobalCodes[index] || !validText(diagnostic.message)
      || !Array.isArray(diagnostic.affectedBomLineIds)
      || canonicalDesignV2Payload(diagnostic.affectedBomLineIds) !== canonicalDesignV2Payload(HERO_LINE_IDS)) {
      return invalidHandoff();
    }
  }
  const { contentHash, ...payload } = artifact as unknown as PowerPhysicalImplementationHandoffV1;
  if (designSha256ContentHash(canonicalDesignV2Payload(payload)) !== contentHash) return invalidHandoff();
  return detachedFrozenDesignV2Value(artifact as unknown as PowerPhysicalImplementationHandoffV1);
}

export function serializePowerPhysicalImplementationHandoffV1(
  input: Readonly<PowerPhysicalImplementationHandoffV1>,
): string {
  return `${canonicalDesignV2Payload(parsePowerPhysicalImplementationHandoffV1(input))}\n`;
}

/** Recreates the handoff from authoritative inputs and rejects even validly rehashed semantic drift. */
export function verifyPowerPhysicalImplementationHandoffV1(
  input: Readonly<PowerPhysicalImplementationHandoffV1>,
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Readonly<PowerPhysicalImplementationHandoffV1> {
  const parsed = parsePowerPhysicalImplementationHandoffV1(input);
  const expected = createPowerPhysicalImplementationHandoffV1(
    result,
    candidateId,
    engineeringContext,
  );
  if (canonicalDesignV2Payload(parsed) !== canonicalDesignV2Payload(expected)) {
    throw new PowerPhysicalImplementationHandoffErrorV1("invalid_handoff");
  }
  return parsed;
}

/**
 * Fail-closed export boundary. The current exact hero has no complete reviewed
 * physical mapping, so no footprint-assigned KiCad bytes can be produced.
 */
export function exportFootprintAssignedPowerKicadSchematicV1(
  input: Readonly<PowerPhysicalImplementationHandoffV1>,
): never {
  const handoff = parsePowerPhysicalImplementationHandoffV1(input);
  throw new PowerPhysicalImplementationHandoffErrorV1(
    "physical_mapping_unavailable",
    handoff.diagnostics,
  );
}
