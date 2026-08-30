import { readFileSync } from "node:fs";
import type { CircuitDocument } from "@opencircuit/circuit-schema";
import {
  migrateDesignRequest,
  type CandidateMetric,
  type ConstraintResult,
  type DesignRequest,
  type EvidenceRef,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import type {
  DesignLibrary,
  DesignRecipe,
  GenerateContext,
  JsonObject,
  MatchedOption,
} from "../src";

export interface ToyCounters {
  materializedCandidateIds: string[];
  checkedOptionKeys: string[];
  sourcedCandidateIds: string[];
}

export interface ToyExpected {
  survivorLabels: string[];
  survivorIds: string[];
  optionKeys: {
    boundaryPass: string;
    overBoundaryFail: string;
    missingUnknown: string;
    duplicateA: string;
    duplicateB: string;
    dominated: string;
    tieA: string;
    tieB: string;
    solveRejected: string;
    matchRejected: string;
  };
}

export interface ToyPipelineHarness {
  request: DesignRequest;
  context: GenerateContext;
  counters: ToyCounters;
  expected: ToyExpected;
}

const optionKeys: ToyExpected["optionKeys"] = {
  boundaryPass: "boundary-pass",
  overBoundaryFail: "over-boundary-fail",
  missingUnknown: "missing-unknown",
  duplicateA: "duplicate-a",
  duplicateB: "duplicate-b",
  dominated: "dominated",
  tieA: "tie-a",
  tieB: "tie-b",
  solveRejected: "solve-rejected",
  matchRejected: "match-rejected",
};

const authoredEvidence: EvidenceRef = {
  sourceId: "toy-rulebook",
  locator: "rule:toy.boundary",
  licenseNote: "Test-only authored fixture",
};

function option(optionKey: string, label: string, status: string, cost: number, efficiency: number, partKey: string): { optionKey: string; data: JsonObject } {
  return { optionKey, data: { label, status, cost, efficiency, partKey } };
}

function numberField(data: JsonObject, key: string): number {
  const value = data[key];
  if (typeof value !== "number") throw new Error(`Toy option ${key} must be numeric`);
  return value;
}

function stringField(data: JsonObject, key: string): string {
  const value = data[key];
  if (typeof value !== "string") throw new Error(`Toy option ${key} must be text`);
  return value;
}

function component(data: JsonObject): SelectedComponent {
  const partKey = stringField(data, "partKey");
  return {
    id: "primary",
    role: "toy.primary",
    profileId: `toy.profile.${partKey}`,
    part: { manufacturerId: "toy-vendor", manufacturerPartNumber: `TOY-${partKey.toUpperCase()}` },
    quantityPerAssembly: 1,
    evidence: [authoredEvidence],
  };
}

function constraintsFor(option: MatchedOption): ConstraintResult[] {
  const status = stringField(option.data, "status");
  if (status === "fail") {
    return [{
      ruleId: "toy.maximum",
      status: "fail",
      actual: { value: 11, unit: "A", displayUnit: "A" },
      limit: { value: 10, unit: "A", displayUnit: "A" },
      margin: { value: -1, unit: "A", displayUnit: "A" },
      explanation: "Toy value exceeds the hard boundary",
      evidence: [authoredEvidence],
    }];
  }
  if (status === "unknown") {
    return [{
      ruleId: "toy.missing-fact",
      status: "unknown",
      explanation: "Required toy fact is absent and cannot be treated as a pass",
      evidence: [],
    }];
  }
  return [{
    ruleId: "toy.maximum",
    status: "pass",
    actual: { value: 10, unit: "A", displayUnit: "A" },
    limit: { value: 10, unit: "A", displayUnit: "A" },
    margin: { value: 0, unit: "A", displayUnit: "A" },
    explanation: "Exact-boundary values pass with zero margin",
    evidence: [authoredEvidence],
  }];
}

function metricsFor(option: MatchedOption): CandidateMetric[] {
  const metrics: CandidateMetric[] = [
    {
      id: "toy.cost",
      value: { value: numberField(option.data, "cost"), unit: "count", displayUnit: "points" },
      state: "calculated",
      explanation: "Transparent toy cost input",
      evidence: [authoredEvidence],
    },
    {
      id: "toy.efficiency",
      value: { value: numberField(option.data, "efficiency"), unit: "1", displayUnit: "%" },
      state: "calculated",
      explanation: "Transparent toy efficiency input",
      evidence: [authoredEvidence],
    },
  ];
  if (stringField(option.data, "status") === "unknown") {
    metrics.push({
      id: "toy.unknown",
      value: null,
      state: "unknown",
      explanation: "Missing data stays unknown",
      evidence: [],
    });
  }
  return metrics;
}

function circuit(label: string): CircuitDocument {
  return {
    format: "opencircuit-circuit",
    version: 1,
    meta: { title: label },
    components: [{ id: "gnd", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
    wires: [],
    probes: [],
    sim: { mode: "op" },
  };
}

export function createToyPipelineHarness(): ToyPipelineHarness {
  const requestSource = readFileSync(
    new URL("../../design-schema/test/fixtures/requests/p1-compact.design-request.json", import.meta.url),
    "utf8",
  );
  const request = migrateDesignRequest(JSON.parse(requestSource));
  request.objective = "balanced";
  const counters: ToyCounters = { materializedCandidateIds: [], checkedOptionKeys: [], sourcedCandidateIds: [] };
  const library: DesignLibrary = {
    version: request.libraryVersion,
    contentHash: "fnv1a64:toy-library-v1",
    paretoCriteria: [
      { source: "metric", metricId: "toy.cost", direction: "minimize" },
      { source: "metric", metricId: "toy.efficiency", direction: "maximize" },
    ],
    rankingProfiles: {
      balanced: [
        { source: "metric", metricId: "toy.efficiency", direction: "maximize" },
        { source: "metric", metricId: "toy.cost", direction: "minimize" },
      ],
      availability: [{ source: "sourcing", field: "buildableQuantity", direction: "maximize" }],
      lead_time: [{ source: "sourcing", field: "maximumLeadTimeDays", direction: "minimize" }],
    },
  };
  const recipe: DesignRecipe = {
    id: "toy.recipe",
    version: "1",
    contentHash: "fnv1a64:toy-recipe-v1",
    supports: () => true,
    enumerate: () => [
      option(optionKeys.tieB, "tie-b", "pass", 3, 0.93, "tie-b"),
      option(optionKeys.overBoundaryFail, "over-boundary-fail", "fail", 0, 1, "fail"),
      option(optionKeys.duplicateB, "duplicate", "pass", 2, 0.9, "duplicate"),
      option(optionKeys.matchRejected, "match-rejected", "match-reject", 0, 0, "match-reject"),
      option(optionKeys.boundaryPass, "boundary-pass", "pass", 5, 0.95, "boundary"),
      option(optionKeys.missingUnknown, "missing-unknown", "unknown", 1, 0.5, "unknown"),
      option(optionKeys.dominated, "dominated", "pass", 8, 0.8, "dominated"),
      option(optionKeys.duplicateA, "duplicate", "pass", 2, 0.9, "duplicate"),
      option(optionKeys.solveRejected, "solve-rejected", "solve-reject", 0, 0, "solve-reject"),
      option(optionKeys.tieA, "tie-a", "pass", 3, 0.93, "tie-a"),
    ],
    solve: (enumerated) => stringField(enumerated.data, "status") === "solve-reject"
      ? { status: "rejected", reason: "Toy solve rejection" }
      : {
        status: "ok",
        value: {
          ...enumerated,
          derivedValues: [{
            id: "toy.derived",
            value: { value: 1, unit: "count", displayUnit: "count" },
            equationId: "toy.equation",
            state: "calculated",
            evidence: [authoredEvidence],
          }],
        },
      },
    match: (solved) => stringField(solved.data, "status") === "match-reject"
      ? [{ status: "rejected", reason: "Toy match rejection", componentProfileIds: ["toy.profile.rejected"] }]
      : [{
        status: "ok",
        value: {
          ...solved,
          components: [component(solved.data)],
          simulationCoverage: [],
          warnings: [],
        },
      }],
    check: (matched) => {
      counters.checkedOptionKeys.push(matched.optionKey);
      return constraintsFor(matched);
    },
    estimate: (matched) => ({ metrics: metricsFor(matched), warnings: [] }),
    materialize: (candidate) => {
      counters.materializedCandidateIds.push(candidate.id);
      return circuit(stringField(candidate.data, "label"));
    },
  };
  return {
    request,
    context: {
      library,
      recipes: [recipe],
      evaluatedAt: "2026-08-23T00:00:00.000Z",
    },
    counters,
    expected: {
      survivorLabels: ["boundary-pass", "tie-a", "tie-b", "duplicate"],
      survivorIds: [
        "fnv1a64:ff5c1302c7243156",
        "fnv1a64:1926e7e932fb305e",
        "fnv1a64:33b8d8d43c9f40f0",
        "fnv1a64:46c9ecb059b23e2c",
      ],
      optionKeys,
    },
  };
}
