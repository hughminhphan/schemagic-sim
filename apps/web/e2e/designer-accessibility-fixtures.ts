import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const M1_COMPACT_REQUEST = JSON.parse(readFileSync(
  new URL("../../../packages/design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
  "utf8",
)) as Record<string, unknown>;

function canonicalValue(value: unknown, omitDisplayUnits = false): unknown {
  if (typeof value === "number") return Number(value.toPrecision(12));
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, omitDisplayUnits));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
      if (omitDisplayUnits && key === "displayUnit") return [];
      const nested = (value as Record<string, unknown>)[key];
      return nested === undefined ? [] : [[key, canonicalValue(nested, omitDisplayUnits)]];
    }));
  }
  return value;
}

function canonicalJson(value: unknown, omitDisplayUnits = false): string {
  return JSON.stringify(canonicalValue(value, omitDisplayUnits));
}

function legacyCanonicalValue(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toPrecision(12));
  if (Array.isArray(value)) return value.map(legacyCanonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort((left, right) => left.localeCompare(right)).flatMap((key) => {
      const nested = (value as Record<string, unknown>)[key];
      return nested === undefined ? [] : [[key, legacyCanonicalValue(nested)]];
    }));
  }
  return value;
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function migrateRequestV2(): Record<string, unknown> {
  const { sourcing: _sourcing, ...request } = structuredClone(M1_COMPACT_REQUEST);
  request.schemaVersion = 2;
  request.libraryVersion = "motor-library-v2";
  const sortStrings = (values: unknown): string[] => [...(values as string[])].sort();
  const constraints = request.constraints as Record<string, unknown>;
  constraints.allowedTopologyFamilies = sortStrings(constraints.allowedTopologyFamilies);
  constraints.allowedPackages = sortStrings(constraints.allowedPackages);
  const requirements = request.requirements as Record<string, unknown>;
  requirements.operatingModes = sortStrings(requirements.operatingModes);
  const assumptions = request.assumptions as Array<Record<string, unknown>>;
  for (const assumption of assumptions) assumption.affects = sortStrings(assumption.affects);
  assumptions.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return request;
}

function emptyV2Result(): Record<string, unknown> {
  const request = migrateRequestV2();
  const payload: Record<string, unknown> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request,
    requestHash: sha256(canonicalJson(request, true)),
    libraryVersion: request.libraryVersion,
    libraryContentHash: `sha256:${"a".repeat(64)}`,
    candidates: [],
    rejectedCandidates: [],
    diagnostics: ["design.no_supported_recipe"],
  };
  return { ...payload, contentHash: sha256(canonicalJson(payload)) };
}

function scenarioV2Result(): Record<string, unknown> {
  const empty = emptyV2Result();
  const { contentHash: _contentHash, ...payload } = empty;
  const candidate = {
    schemaVersion: 2,
    id: `candidate:v2:sha256:${"c".repeat(64)}`,
    requestHash: payload.requestHash,
    recipeId: "fixture.scenario-inspection",
    libraryVersion: payload.libraryVersion,
    components: [],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [
      { scenarioId: "op", modelTier: "behavioral", limitations: ["Behavioral operating point only"] },
      { scenarioId: "startup", modelTier: "unavailable", limitations: ["No startup graph is authored"] },
    ],
    circuit: {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Scenario inspection fixture" },
      designBlocks: [],
      circuits: [{
        id: "main",
        title: "Behavioral operating-point graph",
        components: [{ id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    },
    circuitInstanceClassifications: [{ circuitId: "main", componentId: "ground", kind: "non_bom", reason: "Ground is not a BOM line" }],
    circuitBomNonRepresentations: [],
    warnings: [],
  };
  const withCandidate = { ...payload, candidates: [candidate], diagnostics: [] };
  return { ...withCandidate, contentHash: sha256(canonicalJson(withCandidate)) };
}

function legacyV1Result(): Record<string, unknown> {
  const requestHash = fnv1a64(canonicalJson(M1_COMPACT_REQUEST));
  return {
    format: "schemagic-design-result",
    schemaVersion: 1,
    request: structuredClone(M1_COMPACT_REQUEST),
    requestHash,
    libraryVersion: M1_COMPACT_REQUEST.libraryVersion,
    libraryContentHash: "legacy-accessibility-audit-only",
    candidates: [{
      schemaVersion: 1,
      id: "candidate:legacy-accessibility",
      requestHash,
      recipeId: "legacy.accessibility.fixture",
      libraryVersion: M1_COMPACT_REQUEST.libraryVersion,
      components: [],
      derivedValues: [],
      constraints: [],
      metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
      simulationCoverage: [],
      circuit: {
        format: "opencircuit-circuit",
        version: 1,
        meta: { title: "Legacy accessibility fixture" },
        components: [{ id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
        wires: [],
        probes: [],
        sim: { mode: "op" },
      },
      warnings: [],
    }],
    rejectedCandidates: [],
    diagnostics: [],
  };
}

export function legacyV1Source(): string {
  return `${JSON.stringify(legacyCanonicalValue(legacyV1Result()), null, 2)}\n`;
}

export function emptyV2Source(): string {
  return canonicalJson(emptyV2Result());
}

export function scenarioV2Source(): string {
  return canonicalJson(scenarioV2Result());
}
