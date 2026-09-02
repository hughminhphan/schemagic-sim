import { createHash } from "node:crypto";

export type DesignerRuntimeApplicationV1 = "motor.brushed-dc" | "power.buck";
export type DesignerRuntimeCompletionPointV1 =
  | "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled"
  | "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled"
  | "exact_rejected_result_and_execution_ledger_ready";

export interface DesignerRuntimeContractV1 {
  format: "schemagic-designer-runtime-contract";
  schemaVersion: 1;
  version: string;
  scope: "local_headless_chromium_production_build";
  workloads: Array<{
    application: DesignerRuntimeApplicationV1;
    presetId: string;
    completionPoint: DesignerRuntimeCompletionPointV1;
  }>;
  iterationsPerApplication: number;
  runner: {
    browser: "chromium";
    headless: true;
    viewport: { width: number; height: number };
    cachePolicy: "browser_default";
    serviceWorkerPolicy: "production_default";
  };
  budgets: {
    routeInteractiveUs: number;
    generationAndPreviewP95Us: number;
    maximumJsHeapBytes: number;
    retainedJsHeapGrowthBytes: number;
    longTasksPerApplication: number;
  };
  boundaries: {
    environment: string;
    deployment: string;
    memory: string;
    providers: string;
    simulation: string;
    attestation: "none";
  };
  contentHash: `sha256:${string}`;
}

interface DesignerRuntimeApplicationMeasurementCommonV1 {
  application: DesignerRuntimeApplicationV1;
  presetId: string;
  requestHash: `sha256:${string}`;
  resultContentHash: `sha256:${string}`;
  generationAndPreviewUs: number[];
  p95Us: number;
  baselineJsHeapBytes: number;
  finalJsHeapBytes: number;
  maximumJsHeapBytes: number;
  retainedJsHeapGrowthBytes: number;
  longTasks: number;
}

export interface DesignerRuntimeRetainedApplicationMeasurementV1
  extends DesignerRuntimeApplicationMeasurementCommonV1 {
  application: "motor.brushed-dc";
  completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled";
  candidateId: `candidate:v2:sha256:${string}`;
  previewContentHash: `sha256:${string}`;
}

export interface DesignerRuntimeRejectedApplicationMeasurementV1
  extends DesignerRuntimeApplicationMeasurementCommonV1 {
  application: "power.buck";
  completionPoint: "exact_rejected_result_and_execution_ledger_ready";
  rejectedCandidateId: `candidate:v2:sha256:${string}`;
  rejectionReasonCode: "hard_constraint_failed";
  rejectionRuleId: "power.regulator.current-limit";
}

export interface DesignerRuntimeIneligiblePowerApplicationMeasurementV1
  extends DesignerRuntimeApplicationMeasurementCommonV1 {
  application: "power.buck";
  completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled";
  candidateId: `candidate:v2:sha256:${string}`;
  constraintDecisionContentHash: `sha256:${string}`;
  candidateEligible: false;
  previewContentHash: `sha256:${string}`;
}

export type DesignerRuntimeApplicationMeasurementV1 =
  | DesignerRuntimeRetainedApplicationMeasurementV1
  | DesignerRuntimeIneligiblePowerApplicationMeasurementV1
  | DesignerRuntimeRejectedApplicationMeasurementV1;

export interface DesignerRuntimeReportV1 {
  format: "schemagic-designer-runtime-report";
  schemaVersion: 1;
  contract: { version: string; contentHash: `sha256:${string}` };
  productionArtifactSetHash: `sha256:${string}`;
  environment: {
    scope: "local_headless_chromium_production_build";
    browser: "chromium";
    browserVersion: string;
    platform: string;
    architecture: string;
  };
  measurements: {
    routeInteractiveUs: number;
    applications: DesignerRuntimeApplicationMeasurementV1[];
  };
  boundaries: DesignerRuntimeContractV1["boundaries"];
  contentHash: `sha256:${string}`;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;

function canonicalValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Runtime audit values must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) output[key] = canonicalValue(nested);
    }
    return output;
  }
  throw new TypeError("Runtime audit values must be JSON-compatible");
}

function object(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new TypeError(`${path}:invalid_object`);
  return input as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${path}:invalid_keys`);
}

function string(input: unknown, path: string): string {
  if (typeof input !== "string" || input.length === 0) throw new TypeError(`${path}:invalid_string`);
  return input;
}

function literal<T extends string | number | boolean>(input: unknown, expected: T, path: string): T {
  if (input !== expected) throw new TypeError(`${path}:invalid_value`);
  return expected;
}

function integer(input: unknown, path: string, positive = false): number {
  if (!Number.isSafeInteger(input) || (input as number) < (positive ? 1 : 0)) throw new TypeError(`${path}:invalid_integer`);
  return input as number;
}

function hash(input: unknown, path: string): `sha256:${string}` {
  if (typeof input !== "string" || !HASH.test(input)) throw new TypeError(`${path}:invalid_hash`);
  return input as `sha256:${string}`;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function detachedFrozen<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function parseBoundaries(input: unknown, path: string): DesignerRuntimeContractV1["boundaries"] {
  const value = object(input, path);
  exactKeys(value, ["environment", "deployment", "memory", "providers", "simulation", "attestation"], path);
  return {
    environment: string(value.environment, `${path}/environment`),
    deployment: string(value.deployment, `${path}/deployment`),
    memory: string(value.memory, `${path}/memory`),
    providers: string(value.providers, `${path}/providers`),
    simulation: string(value.simulation, `${path}/simulation`),
    attestation: literal(value.attestation, "none", `${path}/attestation`),
  };
}

export function canonicalDesignerRuntimeContractPayloadV1(
  contract: Omit<DesignerRuntimeContractV1, "contentHash"> | DesignerRuntimeContractV1,
): string {
  const { contentHash: _contentHash, ...payload } = contract as DesignerRuntimeContractV1;
  return JSON.stringify(canonicalValue(payload));
}

export function calculateDesignerRuntimeContractContentHashV1(
  contract: Omit<DesignerRuntimeContractV1, "contentHash"> | DesignerRuntimeContractV1,
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalDesignerRuntimeContractPayloadV1(contract), "utf8").digest("hex")}`;
}

export function parseDesignerRuntimeContractV1(input: unknown): DesignerRuntimeContractV1 {
  const value = object(input, "contract");
  exactKeys(value, ["format", "schemaVersion", "version", "scope", "workloads", "iterationsPerApplication", "runner", "budgets", "boundaries", "contentHash"], "contract");
  literal(value.format, "schemagic-designer-runtime-contract", "contract/format");
  literal(value.schemaVersion, 1, "contract/schemaVersion");
  const version = string(value.version, "contract/version");
  const scope = literal(value.scope, "local_headless_chromium_production_build", "contract/scope");
  // N workloads. The contract declares how many it covers; the audit requires
  // at least one and refuses duplicate (application, presetId) pairs instead of
  // pinning an exact count or a motor-then-power order.
  if (!Array.isArray(value.workloads) || value.workloads.length < 1) throw new TypeError("contract/workloads:invalid_length");
  const workloads = value.workloads.map((entry, index) => {
    const workload = object(entry, `contract/workloads/${index}`);
    exactKeys(workload, ["application", "presetId", "completionPoint"], `contract/workloads/${index}`);
    let application: DesignerRuntimeApplicationV1;
    if (workload.application === "motor.brushed-dc") application = "motor.brushed-dc";
    else if (workload.application === "power.buck") application = "power.buck";
    else throw new TypeError(`contract/workloads/${index}/application:invalid_value`);
    let completionPoint: DesignerRuntimeCompletionPointV1;
    if (application === "motor.brushed-dc") {
      completionPoint = literal(
        workload.completionPoint,
        "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
        `contract/workloads/${index}/completionPoint`,
      );
    } else if (
      workload.completionPoint === "exact_rejected_result_and_execution_ledger_ready"
      || workload.completionPoint === "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled"
    ) {
      completionPoint = workload.completionPoint;
    } else {
      throw new TypeError(`contract/workloads/${index}/completionPoint:invalid_value`);
    }
    return {
      application,
      presetId: string(workload.presetId, `contract/workloads/${index}/presetId`),
      completionPoint,
    };
  });
  const workloadKeys = workloads.map((workload) => `${workload.application}\u0000${workload.presetId}`);
  if (new Set(workloadKeys).size !== workloadKeys.length) throw new TypeError("contract/workloads:duplicate_workload");
  if ([...workloadKeys].sort().join("\u0001") !== workloadKeys.join("\u0001")) {
    throw new TypeError("contract/workloads:invalid_order");
  }
  const iterationsPerApplication = integer(value.iterationsPerApplication, "contract/iterationsPerApplication", true);
  const runnerInput = object(value.runner, "contract/runner");
  exactKeys(runnerInput, ["browser", "headless", "viewport", "cachePolicy", "serviceWorkerPolicy"], "contract/runner");
  const viewportInput = object(runnerInput.viewport, "contract/runner/viewport");
  exactKeys(viewportInput, ["width", "height"], "contract/runner/viewport");
  const runner = {
    browser: literal(runnerInput.browser, "chromium", "contract/runner/browser"),
    headless: literal(runnerInput.headless, true, "contract/runner/headless"),
    viewport: {
      width: integer(viewportInput.width, "contract/runner/viewport/width", true),
      height: integer(viewportInput.height, "contract/runner/viewport/height", true),
    },
    cachePolicy: literal(runnerInput.cachePolicy, "browser_default", "contract/runner/cachePolicy"),
    serviceWorkerPolicy: literal(runnerInput.serviceWorkerPolicy, "production_default", "contract/runner/serviceWorkerPolicy"),
  };
  const budgetsInput = object(value.budgets, "contract/budgets");
  exactKeys(budgetsInput, ["routeInteractiveUs", "generationAndPreviewP95Us", "maximumJsHeapBytes", "retainedJsHeapGrowthBytes", "longTasksPerApplication"], "contract/budgets");
  const budgets = {
    routeInteractiveUs: integer(budgetsInput.routeInteractiveUs, "contract/budgets/routeInteractiveUs", true),
    generationAndPreviewP95Us: integer(budgetsInput.generationAndPreviewP95Us, "contract/budgets/generationAndPreviewP95Us", true),
    maximumJsHeapBytes: integer(budgetsInput.maximumJsHeapBytes, "contract/budgets/maximumJsHeapBytes", true),
    retainedJsHeapGrowthBytes: integer(budgetsInput.retainedJsHeapGrowthBytes, "contract/budgets/retainedJsHeapGrowthBytes"),
    longTasksPerApplication: integer(budgetsInput.longTasksPerApplication, "contract/budgets/longTasksPerApplication"),
  };
  const boundaries = parseBoundaries(value.boundaries, "contract/boundaries");
  const contentHash = hash(value.contentHash, "contract/contentHash");
  const parsed: DesignerRuntimeContractV1 = {
    format: "schemagic-designer-runtime-contract",
    schemaVersion: 1,
    version,
    scope,
    workloads,
    iterationsPerApplication,
    runner,
    budgets,
    boundaries,
    contentHash,
  };
  if (calculateDesignerRuntimeContractContentHashV1(parsed) !== contentHash) throw new TypeError("contract:content_hash_mismatch");
  return detachedFrozen(parsed);
}

function p95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!;
}

function parseApplicationMeasurement(
  input: unknown,
  contract: DesignerRuntimeContractV1,
  index: number,
): DesignerRuntimeApplicationMeasurementV1 {
  const path = `report/measurements/applications/${index}`;
  const value = object(input, path);
  const workload = contract.workloads[index];
  if (workload === undefined
    || value.application !== workload.application
    || value.presetId !== workload.presetId
    || value.completionPoint !== workload.completionPoint) {
    throw new TypeError(`${path}:workload_mismatch`);
  }
  const commonKeys = [
    "application", "presetId", "completionPoint", "requestHash", "resultContentHash",
    "generationAndPreviewUs", "p95Us", "baselineJsHeapBytes", "finalJsHeapBytes",
    "maximumJsHeapBytes", "retainedJsHeapGrowthBytes", "longTasks",
  ];
  const workloadKeys = workload.completionPoint === "exact_rejected_result_and_execution_ledger_ready"
    ? [...commonKeys, "rejectedCandidateId", "rejectionReasonCode", "rejectionRuleId"]
    : workload.completionPoint === "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled"
      ? [...commonKeys, "candidateId", "constraintDecisionContentHash", "candidateEligible", "previewContentHash"]
      : [...commonKeys, "candidateId", "previewContentHash"];
  exactKeys(value, workloadKeys, path);
  if (!Array.isArray(value.generationAndPreviewUs) || value.generationAndPreviewUs.length !== contract.iterationsPerApplication) {
    throw new TypeError(`${path}/generationAndPreviewUs:invalid_length`);
  }
  const generationAndPreviewUs = value.generationAndPreviewUs.map((entry, sampleIndex) => integer(entry, `${path}/generationAndPreviewUs/${sampleIndex}`));
  const p95Us = integer(value.p95Us, `${path}/p95Us`);
  const baselineJsHeapBytes = integer(value.baselineJsHeapBytes, `${path}/baselineJsHeapBytes`);
  const finalJsHeapBytes = integer(value.finalJsHeapBytes, `${path}/finalJsHeapBytes`);
  const maximumJsHeapBytes = integer(value.maximumJsHeapBytes, `${path}/maximumJsHeapBytes`);
  const retainedJsHeapGrowthBytes = integer(value.retainedJsHeapGrowthBytes, `${path}/retainedJsHeapGrowthBytes`);
  const longTasks = integer(value.longTasks, `${path}/longTasks`);
  if (p95(generationAndPreviewUs) !== p95Us) throw new TypeError(`${path}:p95_mismatch`);
  if (maximumJsHeapBytes < Math.max(baselineJsHeapBytes, finalJsHeapBytes)) throw new TypeError(`${path}:heap_maximum_mismatch`);
  if (retainedJsHeapGrowthBytes !== Math.max(0, finalJsHeapBytes - baselineJsHeapBytes)) throw new TypeError(`${path}:heap_growth_mismatch`);
  if (p95Us > contract.budgets.generationAndPreviewP95Us
    || maximumJsHeapBytes > contract.budgets.maximumJsHeapBytes
    || retainedJsHeapGrowthBytes > contract.budgets.retainedJsHeapGrowthBytes
    || longTasks > contract.budgets.longTasksPerApplication) throw new TypeError(`${path}:budget_exceeded`);
  const common = {
    presetId: workload.presetId,
    requestHash: hash(value.requestHash, `${path}/requestHash`),
    resultContentHash: hash(value.resultContentHash, `${path}/resultContentHash`),
    generationAndPreviewUs,
    p95Us,
    baselineJsHeapBytes,
    finalJsHeapBytes,
    maximumJsHeapBytes,
    retainedJsHeapGrowthBytes,
    longTasks,
  };
  if (workload.application === "motor.brushed-dc"
    && workload.completionPoint === "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled") {
    const candidateId = string(value.candidateId, `${path}/candidateId`);
    if (!CANDIDATE_ID.test(candidateId)) throw new TypeError(`${path}/candidateId:invalid_candidate_id`);
    return {
      ...common,
      application: "motor.brushed-dc",
      completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
      candidateId: candidateId as `candidate:v2:sha256:${string}`,
      previewContentHash: hash(value.previewContentHash, `${path}/previewContentHash`),
    };
  }
  if (workload.application === "power.buck"
    && workload.completionPoint === "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled") {
    const candidateId = string(value.candidateId, `${path}/candidateId`);
    if (!CANDIDATE_ID.test(candidateId)) throw new TypeError(`${path}/candidateId:invalid_candidate_id`);
    return {
      ...common,
      application: "power.buck",
      completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
      candidateId: candidateId as `candidate:v2:sha256:${string}`,
      constraintDecisionContentHash: hash(
        value.constraintDecisionContentHash,
        `${path}/constraintDecisionContentHash`,
      ),
      candidateEligible: literal(value.candidateEligible, false, `${path}/candidateEligible`),
      previewContentHash: hash(value.previewContentHash, `${path}/previewContentHash`),
    };
  }
  if (workload.application === "power.buck"
    && workload.completionPoint === "exact_rejected_result_and_execution_ledger_ready") {
    const rejectedCandidateId = string(value.rejectedCandidateId, `${path}/rejectedCandidateId`);
    if (!CANDIDATE_ID.test(rejectedCandidateId)) {
      throw new TypeError(`${path}/rejectedCandidateId:invalid_candidate_id`);
    }
    return {
      ...common,
      application: "power.buck",
      completionPoint: "exact_rejected_result_and_execution_ledger_ready",
      rejectedCandidateId: rejectedCandidateId as `candidate:v2:sha256:${string}`,
      rejectionReasonCode: literal(
        value.rejectionReasonCode,
        "hard_constraint_failed",
        `${path}/rejectionReasonCode`,
      ),
      rejectionRuleId: literal(
        value.rejectionRuleId,
        "power.regulator.current-limit",
        `${path}/rejectionRuleId`,
      ),
    };
  }
  throw new TypeError(`${path}:workload_mismatch`);
}

export function canonicalDesignerRuntimeReportPayloadV1(
  report: Omit<DesignerRuntimeReportV1, "contentHash"> | DesignerRuntimeReportV1,
): string {
  const { contentHash: _contentHash, ...payload } = report as DesignerRuntimeReportV1;
  return JSON.stringify(canonicalValue(payload));
}

export function calculateDesignerRuntimeReportContentHashV1(
  report: Omit<DesignerRuntimeReportV1, "contentHash"> | DesignerRuntimeReportV1,
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalDesignerRuntimeReportPayloadV1(report), "utf8").digest("hex")}`;
}

export function parseDesignerRuntimeReportV1(input: unknown, contractInput: unknown): DesignerRuntimeReportV1 {
  const contract = parseDesignerRuntimeContractV1(contractInput);
  const value = object(input, "report");
  exactKeys(value, ["format", "schemaVersion", "contract", "productionArtifactSetHash", "environment", "measurements", "boundaries", "contentHash"], "report");
  literal(value.format, "schemagic-designer-runtime-report", "report/format");
  literal(value.schemaVersion, 1, "report/schemaVersion");
  const contractRef = object(value.contract, "report/contract");
  exactKeys(contractRef, ["version", "contentHash"], "report/contract");
  if (contractRef.version !== contract.version || contractRef.contentHash !== contract.contentHash) throw new TypeError("report/contract:contract_mismatch");
  const environmentInput = object(value.environment, "report/environment");
  exactKeys(environmentInput, ["scope", "browser", "browserVersion", "platform", "architecture"], "report/environment");
  const environment = {
    scope: literal(environmentInput.scope, contract.scope, "report/environment/scope"),
    browser: literal(environmentInput.browser, "chromium", "report/environment/browser"),
    browserVersion: string(environmentInput.browserVersion, "report/environment/browserVersion"),
    platform: string(environmentInput.platform, "report/environment/platform"),
    architecture: string(environmentInput.architecture, "report/environment/architecture"),
  };
  const measurementsInput = object(value.measurements, "report/measurements");
  exactKeys(measurementsInput, ["routeInteractiveUs", "applications"], "report/measurements");
  const routeInteractiveUs = integer(measurementsInput.routeInteractiveUs, "report/measurements/routeInteractiveUs");
  if (routeInteractiveUs > contract.budgets.routeInteractiveUs) throw new TypeError("report/measurements/routeInteractiveUs:budget_exceeded");
  if (!Array.isArray(measurementsInput.applications) || measurementsInput.applications.length !== contract.workloads.length) {
    throw new TypeError("report/measurements/applications:invalid_length");
  }
  const applications = measurementsInput.applications.map((entry, index) => parseApplicationMeasurement(entry, contract, index));
  const boundaries = parseBoundaries(value.boundaries, "report/boundaries");
  if (!same(boundaries, contract.boundaries)) throw new TypeError("report/boundaries:contract_mismatch");
  const parsed: DesignerRuntimeReportV1 = {
    format: "schemagic-designer-runtime-report",
    schemaVersion: 1,
    contract: { version: contract.version, contentHash: contract.contentHash },
    productionArtifactSetHash: hash(value.productionArtifactSetHash, "report/productionArtifactSetHash"),
    environment,
    measurements: { routeInteractiveUs, applications },
    boundaries,
    contentHash: hash(value.contentHash, "report/contentHash"),
  };
  if (calculateDesignerRuntimeReportContentHashV1(parsed) !== parsed.contentHash) throw new TypeError("report:content_hash_mismatch");
  return detachedFrozen(parsed);
}

export function createDesignerRuntimeReportV1(
  payload: Omit<DesignerRuntimeReportV1, "contentHash">,
  contract: DesignerRuntimeContractV1,
): DesignerRuntimeReportV1 {
  return parseDesignerRuntimeReportV1({ ...payload, contentHash: calculateDesignerRuntimeReportContentHashV1(payload) }, contract);
}
