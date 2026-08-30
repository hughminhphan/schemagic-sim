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
  type DesignProfileAdmissionEntryV1,
  type DesignProfileEnvelope,
  type ProfileEvidenceKind,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library/v2-runtime";
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
  type SelectedComponent,
} from "@opencircuit/design-schema";

export const POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V2 =
  "schemagic-power-physical-implementation-handoff" as const;
export const POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V2 = 2 as const;

const HERO_RECIPE_ID =
  "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified" as const;
const HERO_RECIPE_IDENTITIES = Object.freeze([
  {
    version: "3.4.5",
    contentHash: "sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee",
  },
  {
    version: "3.4.6",
    contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
  },
] as const);
type HeroRecipeIdentityV2 = typeof HERO_RECIPE_IDENTITIES[number];

function isHeroRecipeIdentityV2(
  value: Readonly<{ version: string; contentHash: string }>,
): value is Readonly<HeroRecipeIdentityV2> {
  return HERO_RECIPE_IDENTITIES.some((identity) => (
    identity.version === value.version && identity.contentHash === value.contentHash
  ));
}
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

type HeroLineIdV2 = typeof HERO_LINE_IDS[number];

const HERO_LINE_EXPECTATIONS = Object.freeze({
  "bootstrap-capacitor": {
    quantityPerAssembly: 1,
    partClass: "shared.mlcc-capacitor",
    manufacturerId: "tdk-corporation",
    manufacturerPartNumber: "C1608X7R1H104K080AA",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json",
    profileContentHash: "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6",
    instances: [{ componentId: "bootstrap-capacitor", refdes: "C1", componentType: "capacitor" }],
  },
  "feedback-lower": {
    quantityPerAssembly: 1,
    partClass: "shared.general-purpose-resistor",
    manufacturerId: "bourns",
    manufacturerPartNumber: "CR0603-FX-1003ELF",
    profileId: "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json",
    profileContentHash: "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6",
    instances: [{ componentId: "feedback-lower", refdes: "R1", componentType: "resistor" }],
  },
  "feedback-upper": {
    quantityPerAssembly: 1,
    partClass: "shared.general-purpose-resistor",
    manufacturerId: "vishay-intertechnology",
    manufacturerPartNumber: "CRCW0603732KFKEA",
    profileId: "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json",
    profileContentHash: "sha256:30d45602549f1ab1c4f9434b419ccdfa95a5381ef70ff4297d7ceb6ae50259c4",
    instances: [{ componentId: "feedback-upper", refdes: "R2", componentType: "resistor" }],
  },
  "input-capacitor": {
    quantityPerAssembly: 1,
    partClass: "shared.mlcc-capacitor",
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM31CR61H106KA12L",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
    profileContentHash: "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
    instances: [{ componentId: "input-capacitor", refdes: "C2", componentType: "capacitor" }],
  },
  "output-capacitor": {
    quantityPerAssembly: 2,
    partClass: "shared.mlcc-capacitor",
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM32ER71E226KE15L",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
    profileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
    instances: [
      { componentId: "output-capacitor-1", refdes: "C3", componentType: "capacitor" },
      { componentId: "output-capacitor-2", refdes: "C4", componentType: "capacitor" },
    ],
  },
  "power-inductor": {
    quantityPerAssembly: 1,
    partClass: "power.power-inductor",
    manufacturerId: "bel-fuse",
    manufacturerPartNumber: "F1F2-0804-100M",
    profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
    profileContentHash: "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
    instances: [{ componentId: "power-inductor", refdes: "L1", componentType: "inductor" }],
  },
  primary: {
    quantityPerAssembly: 1,
    partClass: "power.integrated-synchronous-buck-regulator",
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "TPS54302DDCR",
    profileId: "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json",
    profileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
    instances: [{ componentId: "primary", refdes: "U1", componentType: "design_block" }],
  },
} as const satisfies Record<HeroLineIdV2, Readonly<{
  quantityPerAssembly: number;
  partClass: string;
  manufacturerId: string;
  manufacturerPartNumber: string;
  profileId: string;
  profileContentHash: `sha256:${string}`;
  instances: readonly Readonly<{
    componentId: string;
    refdes: string;
    componentType: CircuitComponentV4["type"];
  }>[];
}>>);

const HERO_INSTANCE_IDS = Object.freeze(HERO_LINE_IDS.flatMap((lineId) => (
  HERO_LINE_EXPECTATIONS[lineId].instances.map((instance) => instance.componentId)
)));
const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;
const MAX_HANDOFF_BYTES = 16 * 1024 * 1024;

type PhysicalProfileFactStateV2 = "reviewed" | "calculated" | "estimated" | "unknown";
type PublishedProfileEvidenceKindV2 = Exclude<
  ProfileEvidenceKind,
  "synthetic_fixture" | "authored_derivation"
>;

export type PowerPhysicalImplementationLineDiagnosticCodeV2 =
  | "physical_pin_mapping_unavailable"
  | "kicad_footprint_identity_unavailable"
  | "structural_symbol_not_package_complete";

export type PowerPhysicalImplementationDiagnosticCodeV2 =
  | "footprint_assignments_incomplete"
  | "placement_not_authored";

export type PowerPhysicalImplementationHandoffErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "unsupported_candidate"
  | "catalog_identity_unverified"
  | "physical_mapping_unavailable"
  | "invalid_handoff";

export interface PowerPhysicalSourceEvidenceRefV2 {
  factPath: string;
  sourceId: string;
  locator: string;
  licenseNote: string;
  kind: PublishedProfileEvidenceKindV2;
  retrievedAt: string;
  contentHash: `sha256:${string}`;
  url: string;
  revision: string;
  publicationBasis: "public_facts" | "licensed_redistribution" | "original_measurement";
  referenceContentHash: `sha256:${string}`;
}

interface PowerPhysicalAdmissionIdentityV2 {
  partClass: string;
  part: {
    manufacturerId: string;
    manufacturerPartNumber: string;
  };
  profilePath: string;
  ownerTrack: string;
  reviewerTrack: string;
  state: "reviewed";
  authoredBy: string;
  authoredAt: string;
  reviewedBy: string;
  reviewedAt: string;
  profileContentHash: `sha256:${string}`;
  checks: Array<{
    checkId: string;
    status: "pass";
  }>;
  contentHash: `sha256:${string}`;
}

export interface PowerPhysicalStructuralInstanceV2 {
  refdes: string;
  circuitId: typeof HERO_CIRCUIT_ID;
  componentId: string;
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
  footprintMapping: {
    state: "unavailable";
    kicadLibraryId: null;
    mappingContentHash: null;
  };
}

export interface PowerPhysicalImplementationLineV2 {
  bomLineId: HeroLineIdV2;
  role: string;
  quantityPerAssembly: number;
  bomLineContentHash: `sha256:${string}`;
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
    releaseEntryContentHash: `sha256:${string}`;
    admission: PowerPhysicalAdmissionIdentityV2;
  };
  structuralInstances: PowerPhysicalStructuralInstanceV2[];
  physicalEvidence: {
    packageIdentity: {
      state: "reviewed_profile_fact";
      name: string;
      profileFactPath: "commonFacts.packageName";
    };
    mountedGeometry: {
      boardArea: {
        state: PhysicalProfileFactStateV2;
        squareMetres: number | null;
        basis: string | null;
      };
      maximumHeight: {
        state: PhysicalProfileFactStateV2;
        metres: number | null;
        basis: string | null;
      };
      claimBoundary: "package_or_land_pattern_envelope_only_not_footprint_identity";
    };
    sourceEvidenceContentHash: `sha256:${string}`;
    sourceEvidence: PowerPhysicalSourceEvidenceRefV2[];
  };
  diagnostics: Array<{
    code: PowerPhysicalImplementationLineDiagnosticCodeV2;
    message: string;
  }>;
  contentHash: `sha256:${string}`;
}

export interface PowerPhysicalImplementationHandoffV2 {
  format: typeof POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V2;
  schemaVersion: typeof POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V2;
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
      recipeVersion: HeroRecipeIdentityV2["version"];
      recipeContentHash: `sha256:${string}`;
    };
    circuit: {
      id: typeof HERO_CIRCUIT_ID;
      contentHash: `sha256:${string}`;
    };
    selectedBom: {
      lineCount: 7;
      physicalInstanceCount: 8;
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
  lines: PowerPhysicalImplementationLineV2[];
  diagnostics: Array<{
    code: PowerPhysicalImplementationDiagnosticCodeV2;
    affectedBomLineIds: HeroLineIdV2[];
    affectedStructuralInstanceIds: string[];
    message: string;
  }>;
  contentHash: `sha256:${string}`;
}

export class PowerPhysicalImplementationHandoffErrorV2 extends Error {
  readonly code: PowerPhysicalImplementationHandoffErrorCodeV2;
  readonly diagnostics: readonly Readonly<{
    code: PowerPhysicalImplementationDiagnosticCodeV2;
    affectedBomLineIds: readonly HeroLineIdV2[];
    affectedStructuralInstanceIds: readonly string[];
    message: string;
  }>[];

  constructor(
    code: PowerPhysicalImplementationHandoffErrorCodeV2,
    diagnostics: PowerPhysicalImplementationHandoffV2["diagnostics"] = [],
  ) {
    super(`scheMAGIC Power physical implementation handoff V2 was rejected: ${code}`);
    this.name = "PowerPhysicalImplementationHandoffErrorV2";
    this.code = code;
    this.diagnostics = Object.freeze(diagnostics.map((entry) => Object.freeze({
      ...entry,
      affectedBomLineIds: Object.freeze([...entry.affectedBomLineIds]),
      affectedStructuralInstanceIds: Object.freeze([...entry.affectedStructuralInstanceIds]),
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

function contentHash(value: unknown): `sha256:${string}` {
  return designSha256ContentHash(canonicalDesignV2Payload(value));
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
): PowerPhysicalSourceEvidenceRefV2[] {
  const found: PowerPhysicalSourceEvidenceRefV2[] = [];
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
        throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified");
      }
      const draft: Omit<PowerPhysicalSourceEvidenceRefV2, "referenceContentHash"> = {
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
      };
      found.push({ ...draft, referenceContentHash: contentHash(draft) });
      return;
    }
    const item = record(value);
    if (item === undefined) return;
    for (const key of Object.keys(item).sort(compareText)) visit(item[key], `${path}.${key}`);
  };
  visit(profile.commonFacts.packageName, "commonFacts.packageName");
  const mounted = record(profile.facts)?.mountedGeometry;
  if (mounted !== undefined) visit(mounted, "facts.mountedGeometry");
  const unique = new Map(found.map((entry) => [canonicalDesignV2Payload(entry), entry]));
  return [...unique.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, entry]) => entry);
}

function factState(value: unknown): PhysicalProfileFactStateV2 {
  const state = record(value)?.state;
  return state === "reviewed" || state === "calculated" || state === "estimated" || state === "unknown"
    ? state
    : "unknown";
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return validText(value) ? value : null;
}

function mountedGeometry(
  profile: Readonly<DesignProfileEnvelope>,
): PowerPhysicalImplementationLineV2["physicalEvidence"]["mountedGeometry"] {
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
    throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
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
  return contentHash({
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
  });
}

function lineDiagnostics(
  lineId: HeroLineIdV2,
): PowerPhysicalImplementationLineV2["diagnostics"] {
  const diagnostics: PowerPhysicalImplementationLineV2["diagnostics"] = [
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

function selectedBomContentHash(candidate: Readonly<DesignCandidateV2>): `sha256:${string}` {
  return contentHash([...candidate.components].sort((left, right) => compareText(left.id, right.id)));
}

function selectedBomLineContentHash(component: Readonly<SelectedComponent>): `sha256:${string}` {
  return contentHash(component);
}

function exactHeroCandidate(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): {
  candidate: DesignCandidateV2;
  circuit: CircuitGraphV4;
  recipe: GenerateElectricalContextV2["manifest"]["recipes"][number] & Readonly<HeroRecipeIdentityV2>;
} {
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new PowerPhysicalImplementationHandoffErrorV2("candidate_not_found");
  const circuit = candidate.circuit.circuits.find((entry) => entry.id === HERO_CIRCUIT_ID);
  const recipeMatches = engineeringContext.manifest.recipes.filter((entry) => entry.id === candidate.recipeId);
  const recipe = recipeMatches[0];
  const selectedIds = candidate.components.map((entry) => entry.id).sort(compareText);
  const expectedCircuitIds = [...HERO_INSTANCE_IDS, "ground"].sort(compareText);
  const actualCircuitIds = circuit?.components.map((entry) => entry.id).sort(compareText) ?? [];
  const assemblyClassifications = candidate.circuitInstanceClassifications.filter((entry) => (
    entry.circuitId === HERO_CIRCUIT_ID
  ));
  if (
    result.request.application !== "power.buck"
    || candidate.recipeId !== HERO_RECIPE_ID
    || circuit === undefined
    || recipeMatches.length !== 1
    || recipe === undefined
    || !isHeroRecipeIdentityV2(recipe)
    || canonicalDesignV2Payload(selectedIds) !== canonicalDesignV2Payload(HERO_LINE_IDS)
    || canonicalDesignV2Payload(actualCircuitIds) !== canonicalDesignV2Payload(expectedCircuitIds)
    || candidate.circuitBomNonRepresentations.some((entry) => entry.circuitId === HERO_CIRCUIT_ID)
    || assemblyClassifications.length !== HERO_INSTANCE_IDS.length + 1
  ) {
    throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
  }
  for (const lineId of HERO_LINE_IDS) {
    const selected = candidate.components.find((entry) => entry.id === lineId);
    const expected = HERO_LINE_EXPECTATIONS[lineId];
    if (selected === undefined
      || selected.quantityPerAssembly !== expected.quantityPerAssembly
      || selected.profileId !== expected.profileId
      || !samePart(selected.part, expected)) {
      throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
    }
    for (const instance of expected.instances) {
      const component = circuit.components.find((entry) => entry.id === instance.componentId);
      const classifications = assemblyClassifications.filter((entry) => entry.componentId === instance.componentId);
      const classification = classifications[0];
      if (component === undefined || component.type !== instance.componentType
        || classifications.length !== 1 || classification?.kind !== "physical"
        || classification.selectedComponentId !== lineId
        || classification.representedQuantityPerAssembly !== 1) {
        throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
      }
    }
  }
  const ground = assemblyClassifications.filter((entry) => entry.componentId === "ground");
  if (ground.length !== 1 || ground[0]!.kind !== "non_bom") {
    throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
  }
  return { candidate, circuit, recipe };
}

function admissionIdentity(
  entry: Readonly<DesignProfileAdmissionEntryV1>,
): PowerPhysicalAdmissionIdentityV2 {
  if (entry.state !== "reviewed" || entry.profileContentHash === null
    || entry.authoredBy === null || entry.authoredAt === null
    || entry.reviewedBy === null || entry.reviewedAt === null
    || entry.ownerTrack === entry.reviewerTrack || entry.authoredBy === entry.reviewedBy
    || entry.checks.length === 0 || entry.checks.some((check) => check.status !== "pass")) {
    throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified");
  }
  const draft: Omit<PowerPhysicalAdmissionIdentityV2, "contentHash"> = {
    partClass: entry.partClass,
    part: { ...entry.part },
    profilePath: entry.profilePath,
    ownerTrack: entry.ownerTrack,
    reviewerTrack: entry.reviewerTrack,
    state: entry.state,
    authoredBy: entry.authoredBy,
    authoredAt: entry.authoredAt,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt,
    profileContentHash: entry.profileContentHash,
    checks: entry.checks
      .map((check) => ({ checkId: check.checkId, status: check.status as "pass" }))
      .sort((left, right) => compareText(left.checkId, right.checkId)),
  };
  return { ...draft, contentHash: contentHash(draft) };
}

function buildLine(
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  lineId: HeroLineIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  labels: ReadonlyMap<string, readonly string[]>,
): PowerPhysicalImplementationLineV2 {
  const selected = candidate.components.find((entry) => entry.id === lineId)!;
  const expected = HERO_LINE_EXPECTATIONS[lineId];
  const registry = parseManufacturerRegistry(engineeringContext.catalogDocuments.manufacturerRegistry);
  const release = parseDesignCatalogRelease(engineeringContext.catalogDocuments.catalogRelease);
  const admission = parseDesignProfileAdmission(engineeringContext.catalogDocuments.admission);
  const releaseMatches = release.profiles.filter((entry) => entry.profileId === selected.profileId);
  const releaseRef = releaseMatches[0];
  const rawProfile = engineeringContext.catalogDocuments.profiles[selected.profileId];
  if (releaseMatches.length !== 1 || releaseRef === undefined || rawProfile === undefined
    || releaseRef.profilePath !== selected.profileId || !samePart(releaseRef.part, selected.part)) {
    throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified");
  }
  let profile: DesignProfileEnvelope;
  try { profile = parseDesignProfileEnvelope(rawProfile, registry); }
  catch { throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified"); }
  const profileHash = designProfileEnvelopeContentHash(profile);
  const admissionMatches = admission.entries.filter((entry) => entry.profilePath === selected.profileId);
  const review = admissionMatches[0];
  if (releaseRef.profileId !== expected.profileId
    || releaseRef.partClass !== expected.partClass
    || !samePart(releaseRef.part, expected)
    || releaseRef.profileContentHash !== expected.profileContentHash
    || profileHash !== releaseRef.profileContentHash
    || profile.partClass !== releaseRef.partClass
    || !samePart(profile.part, selected.part)
    || admissionMatches.length !== 1 || review === undefined
    || review.profileContentHash !== profileHash
    || review.partClass !== releaseRef.partClass
    || !samePart(review.part, selected.part)) {
    throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified");
  }
  const packageName = profile.commonFacts.packageName;
  if (packageName.state !== "reviewed" || !validText(packageName.value)) {
    throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified");
  }
  const sources = physicalEvidence(profile);
  if (sources.length === 0) throw new PowerPhysicalImplementationHandoffErrorV2("catalog_identity_unverified");
  const structuralInstances = expected.instances.map((expectedInstance): PowerPhysicalStructuralInstanceV2 => {
    const component = circuit.components.find((entry) => entry.id === expectedInstance.componentId)!;
    const points = componentPinPointsV4(component, candidate.circuit.designBlocks);
    const names = structuralPinNames(candidate, component, points.length);
    const componentLabels = labels.get(component.id);
    if (points.length === 0 || componentLabels === undefined || componentLabels.length !== points.length) {
      throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
    }
    return {
      refdes: expectedInstance.refdes,
      circuitId: HERO_CIRCUIT_ID,
      componentId: expectedInstance.componentId,
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
      footprintMapping: {
        state: "unavailable",
        kicadLibraryId: null,
        mappingContentHash: null,
      },
    };
  });
  const sourceEvidenceContentHash = contentHash(sources);
  const lineDraft: Omit<PowerPhysicalImplementationLineV2, "contentHash"> = {
    bomLineId: lineId,
    role: selected.role,
    quantityPerAssembly: selected.quantityPerAssembly,
    bomLineContentHash: selectedBomLineContentHash(selected),
    selectedPart: { ...selected.part },
    profile: {
      id: releaseRef.profileId,
      path: releaseRef.profilePath,
      partClass: releaseRef.partClass,
      factsSchemaVersion: profile.factsSchemaVersion,
      contentHash: profileHash,
      releaseEntryContentHash: contentHash(releaseRef),
      admission: admissionIdentity(review),
    },
    structuralInstances,
    physicalEvidence: {
      packageIdentity: {
        state: "reviewed_profile_fact",
        name: packageName.value,
        profileFactPath: "commonFacts.packageName",
      },
      mountedGeometry: mountedGeometry(profile),
      sourceEvidenceContentHash,
      sourceEvidence: sources,
    },
    diagnostics: lineDiagnostics(lineId),
  };
  return { ...lineDraft, contentHash: contentHash(lineDraft) };
}

/**
 * Creates a separately content-addressed physical handoff for the immutable
 * supported exact-reference-passive Power observations. The selected capacitor BOM
 * line remains quantity two while its two physical structural instances stay
 * distinct. No footprint, package-pin, placement, routing, or manufacturing
 * authority is inferred.
 */
export function createPowerPhysicalImplementationHandoffV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Readonly<PowerPhysicalImplementationHandoffV2> {
  let result: DesignResultV2;
  try { result = parseDesignResultV2(resultInput); }
  catch { throw new PowerPhysicalImplementationHandoffErrorV2("invalid_result"); }
  const requestedCandidate = result.candidates.find((entry) => entry.id === candidateId);
  const manifestRecipeMatches = requestedCandidate === undefined
    ? []
    : engineeringContext.manifest.recipes.filter((entry) => entry.id === requestedCandidate.recipeId);
  const manifestRecipe = manifestRecipeMatches[0];
  if (requestedCandidate !== undefined && (
    requestedCandidate.recipeId !== HERO_RECIPE_ID
    || manifestRecipeMatches.length !== 1
    || manifestRecipe === undefined
    || !isHeroRecipeIdentityV2(manifestRecipe)
  )) {
    throw new PowerPhysicalImplementationHandoffErrorV2("unsupported_candidate");
  }
  if (validateDesignResultEngineeringContextV2(result, engineeringContext).length > 0) {
    throw new PowerPhysicalImplementationHandoffErrorV2("engineering_context_unverified");
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
  const diagnostics: PowerPhysicalImplementationHandoffV2["diagnostics"] = [
    {
      code: "footprint_assignments_incomplete",
      affectedBomLineIds: [...HERO_LINE_IDS],
      affectedStructuralInstanceIds: [...HERO_INSTANCE_IDS],
      message: "No footprint-assigned KiCad schematic is emitted because all eight exact structural instances across seven BOM lines lack a reviewed complete physical-pin map and exact KiCad footprint identity.",
    },
    {
      code: "placement_not_authored",
      affectedBomLineIds: [...HERO_LINE_IDS],
      affectedStructuralInstanceIds: [...HERO_INSTANCE_IDS],
      message: "No placement is emitted; routing remains explicitly unrouted and physical verification remains unverified.",
    },
  ];
  const draft: Omit<PowerPhysicalImplementationHandoffV2, "contentHash"> = {
    format: POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V2,
    schemaVersion: POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V2,
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
        contentHash: contentHash(circuit),
      },
      selectedBom: {
        lineCount: 7,
        physicalInstanceCount: 8,
        contentHash: selectedBomContentHash(candidate),
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
    contentHash: contentHash(draft),
  });
}

function invalidHandoff(): never {
  throw new PowerPhysicalImplementationHandoffErrorV2("invalid_handoff");
}

function validateSourceEvidence(value: unknown): value is PowerPhysicalSourceEvidenceRefV2 {
  const item = record(value);
  if (item === undefined || !exactKeys(item, [
    "factPath", "sourceId", "locator", "licenseNote", "kind", "retrievedAt",
    "contentHash", "url", "revision", "publicationBasis", "referenceContentHash",
  ]) || !validText(item.factPath) || !validText(item.sourceId) || !validText(item.locator)
    || !validText(item.licenseNote) || !validText(item.retrievedAt) || !validHash(item.contentHash)
    || !validText(item.url) || !validText(item.revision) || !validHash(item.referenceContentHash)
    || !["manufacturer_datasheet", "manufacturer_product_page", "independent_measurement"].includes(String(item.kind))
    || !["public_facts", "licensed_redistribution", "original_measurement"].includes(String(item.publicationBasis))) {
    return false;
  }
  const { referenceContentHash, ...draft } = item;
  return contentHash(draft) === referenceContentHash;
}

function validateAdmission(
  value: unknown,
  expected: typeof HERO_LINE_EXPECTATIONS[HeroLineIdV2],
): value is PowerPhysicalAdmissionIdentityV2 {
  const admission = record(value);
  if (admission === undefined || !exactKeys(admission, [
    "partClass", "part", "profilePath", "ownerTrack", "reviewerTrack", "state",
    "authoredBy", "authoredAt", "reviewedBy", "reviewedAt", "profileContentHash",
    "checks", "contentHash",
  ]) || admission.partClass !== expected.partClass || admission.profilePath !== expected.profileId
    || !validText(admission.ownerTrack) || !validText(admission.reviewerTrack)
    || admission.ownerTrack === admission.reviewerTrack || admission.state !== "reviewed"
    || !validText(admission.authoredBy) || !validText(admission.authoredAt)
    || !validText(admission.reviewedBy) || !validText(admission.reviewedAt)
    || admission.authoredBy === admission.reviewedBy
    || admission.profileContentHash !== expected.profileContentHash
    || !validHash(admission.contentHash) || !Array.isArray(admission.checks)
    || admission.checks.length === 0) return false;
  const part = record(admission.part);
  if (part === undefined || !exactKeys(part, ["manufacturerId", "manufacturerPartNumber"])
    || part.manufacturerId !== expected.manufacturerId
    || part.manufacturerPartNumber !== expected.manufacturerPartNumber) return false;
  const checkIds: string[] = [];
  for (const valueCheck of admission.checks) {
    const check = record(valueCheck);
    if (check === undefined || !exactKeys(check, ["checkId", "status"])
      || !validText(check.checkId) || check.status !== "pass") return false;
    checkIds.push(check.checkId);
  }
  if (new Set(checkIds).size !== checkIds.length
    || checkIds.some((entry, index) => index > 0 && checkIds[index - 1]! >= entry)) return false;
  const { contentHash: admissionHash, ...draft } = admission;
  return contentHash(draft) === admissionHash;
}

function validateStructuralInstance(
  value: unknown,
  expected: Readonly<{ componentId: string; refdes: string; componentType: CircuitComponentV4["type"] }>,
): value is PowerPhysicalStructuralInstanceV2 {
  const instance = record(value);
  const symbol = record(instance?.symbol);
  if (instance === undefined || !exactKeys(instance, [
    "refdes", "circuitId", "componentId", "componentType", "symbol", "pins", "footprintMapping",
  ]) || instance.refdes !== expected.refdes || instance.circuitId !== HERO_CIRCUIT_ID
    || instance.componentId !== expected.componentId || instance.componentType !== expected.componentType
    || symbol === undefined || !exactKeys(symbol, ["kind", "contentHash", "physicalPackageComplete"])
    || symbol.kind !== "project_authored_structural" || !validHash(symbol.contentHash)
    || symbol.physicalPackageComplete !== false || !Array.isArray(instance.pins)
    || instance.pins.length === 0) return false;
  for (const [index, valuePin] of instance.pins.entries()) {
    const pin = record(valuePin);
    if (pin === undefined || !exactKeys(pin, [
      "structuralPinIndex", "structuralPinName", "netId", "physicalPinNumber", "mappingState",
    ]) || pin.structuralPinIndex !== index + 1 || !validText(pin.structuralPinName)
      || !validText(pin.netId) || pin.physicalPinNumber !== null
      || pin.mappingState !== "unavailable") return false;
  }
  const footprint = record(instance.footprintMapping);
  return footprint !== undefined
    && exactKeys(footprint, ["state", "kicadLibraryId", "mappingContentHash"])
    && footprint.state === "unavailable"
    && footprint.kicadLibraryId === null
    && footprint.mappingContentHash === null;
}

function validateLine(value: unknown, expectedId: HeroLineIdV2): value is PowerPhysicalImplementationLineV2 {
  const line = record(value);
  const expected = HERO_LINE_EXPECTATIONS[expectedId];
  if (line === undefined || !exactKeys(line, [
    "bomLineId", "role", "quantityPerAssembly", "bomLineContentHash", "selectedPart", "profile",
    "structuralInstances", "physicalEvidence", "diagnostics", "contentHash",
  ]) || line.bomLineId !== expectedId || !validText(line.role)
    || line.quantityPerAssembly !== expected.quantityPerAssembly
    || !validHash(line.bomLineContentHash) || !validHash(line.contentHash)) return false;
  const part = record(line.selectedPart);
  const profile = record(line.profile);
  if (part === undefined || !exactKeys(part, ["manufacturerId", "manufacturerPartNumber"])
    || part.manufacturerId !== expected.manufacturerId
    || part.manufacturerPartNumber !== expected.manufacturerPartNumber
    || profile === undefined || !exactKeys(profile, [
      "id", "path", "partClass", "factsSchemaVersion", "contentHash",
      "releaseEntryContentHash", "admission",
    ]) || profile.id !== expected.profileId || profile.path !== expected.profileId
    || profile.partClass !== expected.partClass || !validText(profile.factsSchemaVersion)
    || profile.contentHash !== expected.profileContentHash || !validHash(profile.releaseEntryContentHash)
    || !validateAdmission(profile.admission, expected)) return false;
  const releaseProjection = {
    profileId: profile.id,
    profilePath: profile.path,
    partClass: profile.partClass,
    part,
    profileContentHash: profile.contentHash,
  };
  if (contentHash(releaseProjection) !== profile.releaseEntryContentHash
    || !Array.isArray(line.structuralInstances)
    || line.structuralInstances.length !== expected.instances.length
    || !line.structuralInstances.every((instance, index) => validateStructuralInstance(
      instance,
      expected.instances[index]!,
    ))) return false;
  const physical = record(line.physicalEvidence);
  const packageIdentity = record(physical?.packageIdentity);
  const geometry = record(physical?.mountedGeometry);
  const board = record(geometry?.boardArea);
  const height = record(geometry?.maximumHeight);
  const states = new Set(["reviewed", "calculated", "estimated", "unknown"]);
  if (physical === undefined || !exactKeys(physical, [
    "packageIdentity", "mountedGeometry", "sourceEvidenceContentHash", "sourceEvidence",
  ]) || packageIdentity === undefined || !exactKeys(packageIdentity, ["state", "name", "profileFactPath"])
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
    || !validHash(physical.sourceEvidenceContentHash)
    || !Array.isArray(physical.sourceEvidence) || physical.sourceEvidence.length === 0
    || !physical.sourceEvidence.every(validateSourceEvidence)) return false;
  const sourceTokens = physical.sourceEvidence.map((entry) => canonicalDesignV2Payload(entry));
  if (new Set(sourceTokens).size !== sourceTokens.length
    || sourceTokens.some((entry, index) => index > 0 && sourceTokens[index - 1]! >= entry)
    || contentHash(physical.sourceEvidence) !== physical.sourceEvidenceContentHash) return false;
  if (!Array.isArray(line.diagnostics)) return false;
  const expectedCodes: PowerPhysicalImplementationLineDiagnosticCodeV2[] = expectedId === "primary"
    ? ["kicad_footprint_identity_unavailable", "physical_pin_mapping_unavailable", "structural_symbol_not_package_complete"]
    : ["kicad_footprint_identity_unavailable", "physical_pin_mapping_unavailable"];
  if (line.diagnostics.length !== expectedCodes.length) return false;
  for (const [index, valueDiagnostic] of line.diagnostics.entries()) {
    const diagnostic = record(valueDiagnostic);
    if (diagnostic === undefined || !exactKeys(diagnostic, ["code", "message"])
      || diagnostic.code !== expectedCodes[index] || !validText(diagnostic.message)) return false;
  }
  const { contentHash: lineHash, ...draft } = line;
  return contentHash(draft) === lineHash;
}

/** Strict structural parser. Exact installed-context authority requires verification. */
export function parsePowerPhysicalImplementationHandoffV2(
  input: unknown,
): Readonly<PowerPhysicalImplementationHandoffV2> {
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
  ]) || artifact.format !== POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_FORMAT_V2
    || artifact.schemaVersion !== POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V2
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
  const bom = record(provenance?.selectedBom);
  if (provenance === undefined || !exactKeys(provenance, [
    "designResult", "engineeringContext", "catalogRelease", "candidate", "circuit", "selectedBom",
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
    || candidate.recipeId !== HERO_RECIPE_ID
    || !isHeroRecipeIdentityV2({
      version: String(candidate.recipeVersion),
      contentHash: String(candidate.recipeContentHash),
    })
    || circuit === undefined || !exactKeys(circuit, ["id", "contentHash"])
    || circuit.id !== HERO_CIRCUIT_ID || !validHash(circuit.contentHash)
    || bom === undefined || !exactKeys(bom, ["lineCount", "physicalInstanceCount", "contentHash"])
    || bom.lineCount !== 7 || bom.physicalInstanceCount !== 8 || !validHash(bom.contentHash)) {
    return invalidHandoff();
  }
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
  const expectedGlobalCodes: PowerPhysicalImplementationDiagnosticCodeV2[] = [
    "footprint_assignments_incomplete",
    "placement_not_authored",
  ];
  for (const [index, value] of artifact.diagnostics.entries()) {
    const diagnostic = record(value);
    if (diagnostic === undefined || !exactKeys(diagnostic, [
      "code", "affectedBomLineIds", "affectedStructuralInstanceIds", "message",
    ]) || diagnostic.code !== expectedGlobalCodes[index] || !validText(diagnostic.message)
      || !Array.isArray(diagnostic.affectedBomLineIds)
      || canonicalDesignV2Payload(diagnostic.affectedBomLineIds) !== canonicalDesignV2Payload(HERO_LINE_IDS)
      || !Array.isArray(diagnostic.affectedStructuralInstanceIds)
      || canonicalDesignV2Payload(diagnostic.affectedStructuralInstanceIds) !== canonicalDesignV2Payload(HERO_INSTANCE_IDS)) {
      return invalidHandoff();
    }
  }
  const { contentHash: artifactHash, ...payload } = artifact;
  if (contentHash(payload) !== artifactHash) return invalidHandoff();
  return detachedFrozenDesignV2Value(artifact as unknown as PowerPhysicalImplementationHandoffV2);
}

export function serializePowerPhysicalImplementationHandoffV2(
  input: Readonly<PowerPhysicalImplementationHandoffV2>,
): string {
  return `${canonicalDesignV2Payload(parsePowerPhysicalImplementationHandoffV2(input))}\n`;
}

/** Recreates the handoff and rejects even validly rehashed semantic drift. */
export function verifyPowerPhysicalImplementationHandoffV2(
  input: Readonly<PowerPhysicalImplementationHandoffV2>,
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Readonly<PowerPhysicalImplementationHandoffV2> {
  const parsed = parsePowerPhysicalImplementationHandoffV2(input);
  const expected = createPowerPhysicalImplementationHandoffV2(result, candidateId, engineeringContext);
  if (canonicalDesignV2Payload(parsed) !== canonicalDesignV2Payload(expected)) {
    throw new PowerPhysicalImplementationHandoffErrorV2("invalid_handoff");
  }
  return parsed;
}

/** No footprint-assigned bytes are emitted without exact reviewed mappings. */
export function exportFootprintAssignedPowerKicadSchematicV2(
  input: Readonly<PowerPhysicalImplementationHandoffV2>,
): never {
  const handoff = parsePowerPhysicalImplementationHandoffV2(input);
  throw new PowerPhysicalImplementationHandoffErrorV2(
    "physical_mapping_unavailable",
    handoff.diagnostics,
  );
}
