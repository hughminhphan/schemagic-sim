import { createHash } from "node:crypto";
import {
  parseDesignerRuntimeContractV1,
  parseDesignerRuntimeReportV1,
  type DesignerRuntimeContractV1,
  type DesignerRuntimeReportV1,
} from "./designer-runtime-audit";

export interface DesignerRuntimeReleaseContextV1 {
  repository: string;
  sourceRevision: string;
  workflowRevision: string;
  workflowRef: string;
  event: "workflow_dispatch";
  job: string;
  runId: string;
  runAttempt: number;
  artifactName: string;
}

export interface DesignerRuntimeReleaseReceiptV1 {
  format: "schemagic-designer-runtime-release-receipt";
  schemaVersion: 1;
  proofScope: "environment_bound_budget_pass_byte_association";
  ciAssociation: "self_reported_github_actions_context";
  attestation: "none";
  contract: {
    version: string;
    contentHash: `sha256:${string}`;
  };
  report: {
    byteLength: number;
    fileContentHash: `sha256:${string}`;
    contentHash: `sha256:${string}`;
    productionArtifactSetHash: `sha256:${string}`;
  };
  githubActions: DesignerRuntimeReleaseContextV1;
  claims: {
    deployed: "not_claimed";
    crossBrowser: "not_claimed";
    wholeProcessMemory: "not_claimed";
    provider: "not_claimed";
    simulationFidelity: "not_claimed";
  };
  contentHash: `sha256:${string}`;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const HASH = /^sha256:[0-9a-f]{64}$/u;
const SOURCE_REVISION = /^[0-9a-f]{40}$/u;
const DECIMAL_RUN_ID = /^[1-9][0-9]{0,19}$/u;
const REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]+$/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;

function canonicalValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Runtime release receipt values must be finite");
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
  throw new TypeError("Runtime release receipt values must be JSON-compatible");
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

function literal<T extends string | number>(input: unknown, expected: T, path: string): T {
  if (input !== expected) throw new TypeError(`${path}:invalid_value`);
  return expected;
}

function boundedString(input: unknown, path: string, maximumLength: number): string {
  if (typeof input !== "string"
    || input.length === 0
    || input.length > maximumLength
    || input.trim() !== input
    || CONTROL_CHARACTER.test(input)) throw new TypeError(`${path}:invalid_string`);
  return input;
}

function positiveInteger(input: unknown, path: string): number {
  if (!Number.isSafeInteger(input) || (input as number) <= 0) throw new TypeError(`${path}:invalid_integer`);
  return input as number;
}

function hash(input: unknown, path: string): `sha256:${string}` {
  if (typeof input !== "string" || !HASH.test(input)) throw new TypeError(`${path}:invalid_hash`);
  return input as `sha256:${string}`;
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

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

function parseRepository(input: unknown, path: string): string {
  const repository = boundedString(input, path, 141);
  const segments = repository.split("/");
  if (segments.length !== 2
    || segments[0]!.length > 39
    || segments[1]!.length > 100
    || segments.some((segment) => segment === "." || segment === ".." || !REPOSITORY_SEGMENT.test(segment))) {
    throw new TypeError(`${path}:invalid_repository`);
  }
  return repository;
}

export function parseDesignerRuntimeReleaseContextV1(
  input: unknown,
  path = "githubActions",
): DesignerRuntimeReleaseContextV1 {
  const value = object(input, path);
  exactKeys(value, [
    "repository",
    "sourceRevision",
    "workflowRevision",
    "workflowRef",
    "event",
    "job",
    "runId",
    "runAttempt",
    "artifactName",
  ], path);
  const sourceRevision = boundedString(value.sourceRevision, `${path}/sourceRevision`, 40);
  if (!SOURCE_REVISION.test(sourceRevision)) throw new TypeError(`${path}/sourceRevision:invalid_revision`);
  const workflowRevision = boundedString(value.workflowRevision, `${path}/workflowRevision`, 40);
  if (!SOURCE_REVISION.test(workflowRevision)) throw new TypeError(`${path}/workflowRevision:invalid_revision`);
  const runId = boundedString(value.runId, `${path}/runId`, 20);
  if (!DECIMAL_RUN_ID.test(runId)) throw new TypeError(`${path}/runId:invalid_decimal`);
  const artifactName = boundedString(value.artifactName, `${path}/artifactName`, 128);
  if (/[\\/:*?"<>|]/u.test(artifactName)) throw new TypeError(`${path}/artifactName:invalid_name`);
  return detachedFrozen({
    repository: parseRepository(value.repository, `${path}/repository`),
    sourceRevision,
    workflowRevision,
    workflowRef: boundedString(value.workflowRef, `${path}/workflowRef`, 512),
    event: literal(value.event, "workflow_dispatch", `${path}/event`),
    job: boundedString(value.job, `${path}/job`, 128),
    runId,
    runAttempt: positiveInteger(value.runAttempt, `${path}/runAttempt`),
    artifactName,
  });
}

function fileContentHash(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseReportBytes(
  input: unknown,
  contract: DesignerRuntimeContractV1,
): { bytes: Uint8Array; report: DesignerRuntimeReportV1 } {
  if (!(input instanceof Uint8Array) || input.byteLength === 0) throw new TypeError("reportBytes:invalid_bytes");
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    throw new TypeError("reportBytes:invalid_utf8");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decoded) as unknown;
  } catch {
    throw new TypeError("reportBytes:invalid_json");
  }
  return { bytes: input, report: parseDesignerRuntimeReportV1(parsedJson, contract) };
}

export function canonicalDesignerRuntimeReleaseReceiptPayloadV1(
  receipt: Omit<DesignerRuntimeReleaseReceiptV1, "contentHash"> | DesignerRuntimeReleaseReceiptV1,
): string {
  const { contentHash: _contentHash, ...payload } = receipt as DesignerRuntimeReleaseReceiptV1;
  return JSON.stringify(canonicalValue(payload));
}

export function calculateDesignerRuntimeReleaseReceiptContentHashV1(
  receipt: Omit<DesignerRuntimeReleaseReceiptV1, "contentHash"> | DesignerRuntimeReleaseReceiptV1,
): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalDesignerRuntimeReleaseReceiptPayloadV1(receipt), "utf8")
    .digest("hex")}`;
}

export function parseDesignerRuntimeReleaseReceiptV1(
  input: unknown,
  reportBytesInput: Uint8Array,
  contractInput: unknown,
  expectedGithubActionsContextInput: unknown,
): DesignerRuntimeReleaseReceiptV1 {
  const contract = parseDesignerRuntimeContractV1(contractInput);
  const { bytes: reportBytes, report } = parseReportBytes(reportBytesInput, contract);
  const expectedGithubActions = parseDesignerRuntimeReleaseContextV1(
    expectedGithubActionsContextInput,
    "expectedGithubActions",
  );
  const value = object(input, "receipt");
  exactKeys(value, [
    "format",
    "schemaVersion",
    "proofScope",
    "ciAssociation",
    "attestation",
    "contract",
    "report",
    "githubActions",
    "claims",
    "contentHash",
  ], "receipt");
  literal(value.format, "schemagic-designer-runtime-release-receipt", "receipt/format");
  literal(value.schemaVersion, 1, "receipt/schemaVersion");
  const proofScope = literal(
    value.proofScope,
    "environment_bound_budget_pass_byte_association",
    "receipt/proofScope",
  );
  const ciAssociation = literal(
    value.ciAssociation,
    "self_reported_github_actions_context",
    "receipt/ciAssociation",
  );
  const attestation = literal(value.attestation, "none", "receipt/attestation");

  const contractReference = object(value.contract, "receipt/contract");
  exactKeys(contractReference, ["version", "contentHash"], "receipt/contract");
  if (contractReference.version !== contract.version || contractReference.contentHash !== contract.contentHash) {
    throw new TypeError("receipt/contract:contract_mismatch");
  }

  const reportReference = object(value.report, "receipt/report");
  exactKeys(
    reportReference,
    ["byteLength", "fileContentHash", "contentHash", "productionArtifactSetHash"],
    "receipt/report",
  );
  const reportByteLength = positiveInteger(reportReference.byteLength, "receipt/report/byteLength");
  const reportFileContentHash = hash(reportReference.fileContentHash, "receipt/report/fileContentHash");
  const reportContentHash = hash(reportReference.contentHash, "receipt/report/contentHash");
  const productionArtifactSetHash = hash(
    reportReference.productionArtifactSetHash,
    "receipt/report/productionArtifactSetHash",
  );
  if (reportByteLength !== reportBytes.byteLength) throw new TypeError("receipt/report:byte_length_mismatch");
  if (reportFileContentHash !== fileContentHash(reportBytes)) throw new TypeError("receipt/report:file_content_hash_mismatch");
  if (reportContentHash !== report.contentHash) throw new TypeError("receipt/report:content_hash_mismatch");
  if (productionArtifactSetHash !== report.productionArtifactSetHash) {
    throw new TypeError("receipt/report:production_artifact_set_hash_mismatch");
  }

  const githubActions = parseDesignerRuntimeReleaseContextV1(value.githubActions);
  if (!same(githubActions, expectedGithubActions)) throw new TypeError("receipt/githubActions:context_mismatch");

  const claimsInput = object(value.claims, "receipt/claims");
  exactKeys(
    claimsInput,
    ["deployed", "crossBrowser", "wholeProcessMemory", "provider", "simulationFidelity"],
    "receipt/claims",
  );
  const claims = {
    deployed: literal(claimsInput.deployed, "not_claimed", "receipt/claims/deployed"),
    crossBrowser: literal(claimsInput.crossBrowser, "not_claimed", "receipt/claims/crossBrowser"),
    wholeProcessMemory: literal(
      claimsInput.wholeProcessMemory,
      "not_claimed",
      "receipt/claims/wholeProcessMemory",
    ),
    provider: literal(claimsInput.provider, "not_claimed", "receipt/claims/provider"),
    simulationFidelity: literal(
      claimsInput.simulationFidelity,
      "not_claimed",
      "receipt/claims/simulationFidelity",
    ),
  };
  const parsed: DesignerRuntimeReleaseReceiptV1 = {
    format: "schemagic-designer-runtime-release-receipt",
    schemaVersion: 1,
    proofScope,
    ciAssociation,
    attestation,
    contract: { version: contract.version, contentHash: contract.contentHash },
    report: {
      byteLength: reportByteLength,
      fileContentHash: reportFileContentHash,
      contentHash: reportContentHash,
      productionArtifactSetHash,
    },
    githubActions,
    claims,
    contentHash: hash(value.contentHash, "receipt/contentHash"),
  };
  if (calculateDesignerRuntimeReleaseReceiptContentHashV1(parsed) !== parsed.contentHash) {
    throw new TypeError("receipt:content_hash_mismatch");
  }
  return detachedFrozen(parsed);
}

export function createDesignerRuntimeReleaseReceiptV1(
  reportBytes: Uint8Array,
  contractInput: unknown,
  githubActionsContextInput: unknown,
): DesignerRuntimeReleaseReceiptV1 {
  const contract = parseDesignerRuntimeContractV1(contractInput);
  const { report } = parseReportBytes(reportBytes, contract);
  const githubActions = parseDesignerRuntimeReleaseContextV1(githubActionsContextInput);
  const payload: Omit<DesignerRuntimeReleaseReceiptV1, "contentHash"> = {
    format: "schemagic-designer-runtime-release-receipt",
    schemaVersion: 1,
    proofScope: "environment_bound_budget_pass_byte_association",
    ciAssociation: "self_reported_github_actions_context",
    attestation: "none",
    contract: { version: contract.version, contentHash: contract.contentHash },
    report: {
      byteLength: reportBytes.byteLength,
      fileContentHash: fileContentHash(reportBytes),
      contentHash: report.contentHash,
      productionArtifactSetHash: report.productionArtifactSetHash,
    },
    githubActions,
    claims: {
      deployed: "not_claimed",
      crossBrowser: "not_claimed",
      wholeProcessMemory: "not_claimed",
      provider: "not_claimed",
      simulationFidelity: "not_claimed",
    },
  };
  return parseDesignerRuntimeReleaseReceiptV1(
    { ...payload, contentHash: calculateDesignerRuntimeReleaseReceiptContentHashV1(payload) },
    reportBytes,
    contract,
    githubActions,
  );
}
