import {
  canonicalCommercialNumberV2,
  isDistributorId,
  parseCandidateSourcingEvaluationV2,
  parseOfferSnapshotV2,
  parseOfferSnapshotV2Ref,
  parseRfc3339InstantV2,
  parseSnapshotAuthorizationV1,
  parseSourcingPolicy,
  snapshotAuthorizationRefV1,
  validateCandidateSourcingEvaluationContextV2,
  type CommercialRankingCriterionV1,
  type CommercialSnapshotContextV1,
  type OfferSnapshotV2,
  type ProviderAttributionV1,
  type SnapshotAuthorizationRefV1,
  type SnapshotAuthorizationV1,
  type SnapshotAuthorizationVerifierV1,
  type SnapshotAuthorizedUseV1,
  type ValidationIssue,
  type VerifiedCommercialAuthorizationOperationV1,
} from "@opencircuit/sourcing-schema";
import {
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
} from "./v2-canonical";
import { parseDesignResultV2 } from "./v2-result";
import {
  COMMERCIAL_OVERLAY_SCHEMA_VERSION,
  type CommercialCandidateOverlayV1,
  type CommercialOverlayV1,
  type CommercialOverlayV1Id,
} from "./commercial-overlay-types";
import type { CandidateIdV2, DesignResultV2, Sha256ContentHash } from "./v2-types";

type UnknownRecord = Record<string, unknown>;
type CommercialField = CommercialRankingCriterionV1["field"];

const HASH = /^sha256:[0-9a-f]{64}$/;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/;
const OVERLAY_ID = /^commercial-overlay:v1:sha256:[0-9a-f]{64}$/;
const AUTHORIZATION_ID = /^snapshot-authorization:v1:sha256:[0-9a-f]{64}$/;
const ISSUER_KEY_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const FIELD_DIRECTION: Readonly<Record<CommercialField, CommercialRankingCriterionV1["direction"]>> = {
  buildableQuantity: "maximize",
  extendedBomCost: "minimize",
  maximumLeadTimeDays: "minimize",
};

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path}: Must be an object`);
  return value as UnknownRecord;
}

function exactKeys(value: UnknownRecord, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${path}.${key}: Unknown key`);
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${path}.${key}: Missing key`);
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${path}: Must be a non-empty string`);
  return value;
}

function compareSnapshotRef(left: { schemaVersion: number; id: string; contentHash: string }, right: { schemaVersion: number; id: string; contentHash: string }): number {
  return left.schemaVersion - right.schemaVersion
    || compareDesignV2Tokens(left.id, right.id)
    || compareDesignV2Tokens(left.contentHash, right.contentHash);
}

function authorizationRefKey(ref: SnapshotAuthorizationRefV1): string {
  return canonicalDesignV2Payload([ref.issuerKeyId, ref.id, ref.contentHash]);
}

function attributionKey(attribution: ProviderAttributionV1): string {
  return canonicalDesignV2Payload([
    attribution.provider,
    attribution.providerPolicy.contentHash,
    attribution.label,
  ]);
}

function compareAttribution(left: ProviderAttributionV1, right: ProviderAttributionV1): number {
  return compareDesignV2Tokens(left.provider, right.provider)
    || compareDesignV2Tokens(left.providerPolicy.contentHash, right.providerPolicy.contentHash)
    || compareDesignV2Tokens(left.label, right.label);
}

function sortedUnique<T>(values: readonly T[], compare: (left: T, right: T) => number): boolean {
  return values.every((value, index) => index === 0 || compare(values[index - 1]!, value) < 0);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function sameCanonical(left: unknown, right: unknown): boolean {
  try { return canonicalDesignV2Payload(left) === canonicalDesignV2Payload(right); }
  catch { return false; }
}

function detachPlainJson(input: unknown): unknown {
  const active = new Set<object>();
  const visit = (value: unknown, path: string): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`${path}: Must be a finite JSON number`);
      return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value !== "object") throw new Error(`${path}: Must be plain JSON data`);
    if (active.has(value)) throw new Error(`${path}: Cyclic data is not allowed`);
    active.add(value);
    let prototype: object | null;
    let keys: (string | symbol)[];
    try { prototype = Object.getPrototypeOf(value); keys = Reflect.ownKeys(value); }
    catch { throw new Error(`${path}: Could not inspect plain JSON data`); }
    if (keys.some((key) => typeof key !== "string")) throw new Error(`${path}: Symbol keys are not allowed`);
    const stringKeys = keys as string[];
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) throw new Error(`${path}: Arrays must use the intrinsic prototype`);
      let lengthDescriptor: PropertyDescriptor | undefined;
      try { lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length"); }
      catch { throw new Error(`${path}: Could not inspect array length`); }
      const length = lengthDescriptor?.value;
      if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0
        || stringKeys.length !== length + 1
        || stringKeys.some((key) => key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length))) {
        throw new Error(`${path}: Must be a dense JSON array`);
      }
      const output: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        let descriptor: PropertyDescriptor | undefined;
        try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); }
        catch { throw new Error(`${path}.${index}: Could not inspect array item`); }
        if (descriptor === undefined || !descriptor.enumerable || descriptor.get !== undefined || descriptor.set !== undefined) {
          throw new Error(`${path}.${index}: Must be an enumerable data property`);
        }
        output.push(visit(descriptor.value, `${path}.${index}`));
      }
      active.delete(value);
      return output;
    }
    if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path}: Objects must use a plain prototype`);
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of stringKeys) {
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(value, key); }
      catch { throw new Error(`${path}.${key}: Could not inspect object field`); }
      if (descriptor === undefined || !descriptor.enumerable || descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new Error(`${path}.${key}: Must be an enumerable data property`);
      }
      output[key] = visit(descriptor.value, `${path}.${key}`);
    }
    active.delete(value);
    return output;
  };
  return visit(input, "overlay");
}

export function canonicalCommercialCandidateSetHashV1(
  candidateIds: readonly CandidateIdV2[],
): Sha256ContentHash {
  if (!Array.isArray(candidateIds) || candidateIds.some((id) => typeof id !== "string" || !CANDIDATE_ID.test(id))) {
    throw new Error("candidateIds: Must contain V2 candidate IDs");
  }
  const sorted = [...candidateIds].sort(compareDesignV2Tokens);
  if (!sortedUnique(sorted, compareDesignV2Tokens)) throw new Error("candidateIds: Must be unique");
  return designSha256ContentHash(canonicalDesignV2Payload(sorted));
}

export function canonicalCommercialOverlayV1Payload(
  overlay: Omit<CommercialOverlayV1, "id" | "contentHash"> | CommercialOverlayV1,
): string {
  const { id: _id, contentHash: _contentHash, ...payload } = overlay as CommercialOverlayV1;
  return canonicalDesignV2Payload(payload);
}

export function calculateCommercialOverlayV1ContentHash(
  overlay: Omit<CommercialOverlayV1, "id" | "contentHash"> | CommercialOverlayV1,
): Sha256ContentHash {
  return designSha256ContentHash(canonicalCommercialOverlayV1Payload(overlay));
}

export function calculateCommercialOverlayV1Id(
  overlay: Omit<CommercialOverlayV1, "id" | "contentHash"> | CommercialOverlayV1,
): CommercialOverlayV1Id {
  return `commercial-overlay:v1:${calculateCommercialOverlayV1ContentHash(overlay)}`;
}

function parseCriterion(value: unknown, path: string): CommercialRankingCriterionV1 {
  const criterion = record(value, path);
  exactKeys(criterion, ["field", "direction"], path);
  if (typeof criterion.field !== "string" || !Object.hasOwn(FIELD_DIRECTION, criterion.field)) {
    throw new Error(`${path}.field: Unsupported field`);
  }
  const field = criterion.field as CommercialField;
  if (criterion.direction !== FIELD_DIRECTION[field]) throw new Error(`${path}.direction: Must use canonical direction`);
  return { field, direction: FIELD_DIRECTION[field] };
}

function parseCriteria(value: unknown, path: string, pareto: boolean): CommercialRankingCriterionV1[] {
  if (!Array.isArray(value)) throw new Error(`${path}: Must be an array`);
  const criteria = value.map((entry, index) => parseCriterion(entry, `${path}.${index}`));
  if (new Set(criteria.map((entry) => entry.field)).size !== criteria.length) throw new Error(`${path}: Duplicate field`);
  if (pareto && !sortedUnique(criteria, (left, right) => (
    compareDesignV2Tokens(left.field, right.field)
    || compareDesignV2Tokens(left.direction, right.direction)
  ))) throw new Error(`${path}: Must be canonically sorted`);
  return criteria;
}

function parseAuthorizationRef(value: unknown, path: string): SnapshotAuthorizationRefV1 {
  const ref = record(value, path);
  exactKeys(ref, ["id", "contentHash", "issuerKeyId"], path);
  if (typeof ref.id !== "string" || !AUTHORIZATION_ID.test(ref.id)) throw new Error(`${path}.id: Invalid authorization ID`);
  if (typeof ref.contentHash !== "string" || !HASH.test(ref.contentHash)) throw new Error(`${path}.contentHash: Invalid hash`);
  if (typeof ref.issuerKeyId !== "string" || !ISSUER_KEY_ID.test(ref.issuerKeyId)) throw new Error(`${path}.issuerKeyId: Invalid issuer key ID`);
  return cloneJson(ref) as unknown as SnapshotAuthorizationRefV1;
}

function parseAttribution(value: unknown, path: string): ProviderAttributionV1 {
  const attribution = record(value, path);
  exactKeys(attribution, ["provider", "providerPolicy", "required", "label"], path);
  if (!isDistributorId(attribution.provider)) throw new Error(`${path}.provider: Invalid provider`);
  if (typeof attribution.required !== "boolean") throw new Error(`${path}.required: Must be boolean`);
  text(attribution.label, `${path}.label`);
  const policy = record(attribution.providerPolicy, `${path}.providerPolicy`);
  exactKeys(policy, ["id", "version", "contentHash"], `${path}.providerPolicy`);
  text(policy.id, `${path}.providerPolicy.id`);
  text(policy.version, `${path}.providerPolicy.version`);
  if (typeof policy.contentHash !== "string" || !HASH.test(policy.contentHash)) {
    throw new Error(`${path}.providerPolicy.contentHash: Invalid hash`);
  }
  return cloneJson(attribution) as unknown as ProviderAttributionV1;
}

function parsePareto(value: unknown, path: string): CommercialCandidateOverlayV1["pareto"] {
  const pareto = record(value, path);
  if (pareto.status === "frontier") {
    exactKeys(pareto, ["status"], path);
  } else if (pareto.status === "dominated") {
    exactKeys(pareto, ["status", "dominatedByCandidateId"], path);
    if (typeof pareto.dominatedByCandidateId !== "string" || !CANDIDATE_ID.test(pareto.dominatedByCandidateId)) {
      throw new Error(`${path}.dominatedByCandidateId: Invalid candidate ID`);
    }
  } else if (pareto.status === "not_evaluated") {
    exactKeys(pareto, ["status", "reason"], path);
    if (pareto.reason !== "policy_not_pass" && pareto.reason !== "missing_requested_metric") {
      throw new Error(`${path}.reason: Unsupported reason`);
    }
  } else throw new Error(`${path}.status: Unsupported status`);
  return cloneJson(pareto) as CommercialCandidateOverlayV1["pareto"];
}

function parseRank(value: unknown, path: string): CommercialCandidateOverlayV1["rank"] {
  const rank = record(value, path);
  if (rank.status === "ranked") {
    exactKeys(rank, ["status", "rank"], path);
    if (!Number.isSafeInteger(rank.rank) || (rank.rank as number) <= 0) throw new Error(`${path}.rank: Must be a positive safe integer`);
  } else if (rank.status === "unranked") {
    exactKeys(rank, ["status", "reason"], path);
    if (!["policy_not_pass", "missing_requested_metric", "dominated", "no_ranking_criteria"].includes(rank.reason as string)) {
      throw new Error(`${path}.reason: Unsupported reason`);
    }
  } else throw new Error(`${path}.status: Unsupported status`);
  return cloneJson(rank) as CommercialCandidateOverlayV1["rank"];
}

function parseCandidate(value: unknown, path: string): CommercialCandidateOverlayV1 {
  const candidate = record(value, path);
  exactKeys(candidate, ["candidateId", "status", "policyStatus", "metrics", "constraints", "pareto", "rank", "order"], path);
  if (typeof candidate.candidateId !== "string" || !CANDIDATE_ID.test(candidate.candidateId)) throw new Error(`${path}.candidateId: Invalid V2 candidate ID`);
  if (!["compliant", "unproven", "rejected"].includes(candidate.status as string)) throw new Error(`${path}.status: Unsupported status`);
  const evaluation = parseCandidateSourcingEvaluationV2({
    metrics: candidate.metrics,
    policyStatus: candidate.policyStatus,
    constraints: candidate.constraints,
  });
  const expectedStatus = evaluation.policyStatus === "pass" ? "compliant" : evaluation.policyStatus === "unknown" ? "unproven" : "rejected";
  if (candidate.status !== expectedStatus) throw new Error(`${path}.status: Does not match policy status`);
  const pareto = parsePareto(candidate.pareto, `${path}.pareto`);
  const rank = parseRank(candidate.rank, `${path}.rank`);
  if (!Number.isSafeInteger(candidate.order) || (candidate.order as number) < 0) throw new Error(`${path}.order: Must be a non-negative safe integer`);
  return {
    candidateId: candidate.candidateId as CandidateIdV2,
    status: expectedStatus,
    policyStatus: evaluation.policyStatus,
    metrics: evaluation.metrics,
    constraints: evaluation.constraints,
    pareto,
    rank,
    order: candidate.order as number,
  };
}

export function parseCommercialOverlayV1(input: unknown): CommercialOverlayV1 {
  const overlay = record(detachPlainJson(input), "overlay");
  exactKeys(overlay, [
    "format", "schemaVersion", "id", "persistence", "designResultRef", "policy",
    "evaluatedAt", "snapshotRefs", "authorizationRefs", "authorizationNotAfter",
    "attributions", "paretoCriteria", "rankingCriteria", "candidates", "contentHash",
  ], "overlay");
  if (overlay.format !== "schemagic-commercial-overlay") throw new Error("overlay.format: Unsupported format");
  if (overlay.schemaVersion !== COMMERCIAL_OVERLAY_SCHEMA_VERSION) throw new Error("overlay.schemaVersion: Must equal 1");
  if (overlay.persistence !== "user_local" && overlay.persistence !== "exportable") throw new Error("overlay.persistence: Unsupported target");
  const designResultRef = record(overlay.designResultRef, "overlay.designResultRef");
  exactKeys(designResultRef, ["schemaVersion", "designResultContentHash", "requestHash", "libraryVersion", "libraryContentHash", "candidateSetHash"], "overlay.designResultRef");
  if (designResultRef.schemaVersion !== 2) throw new Error("overlay.designResultRef.schemaVersion: Must equal 2");
  for (const field of ["designResultContentHash", "requestHash", "libraryContentHash", "candidateSetHash"] as const) {
    if (typeof designResultRef[field] !== "string" || !HASH.test(designResultRef[field] as string)) throw new Error(`overlay.designResultRef.${field}: Invalid hash`);
  }
  text(designResultRef.libraryVersion, "overlay.designResultRef.libraryVersion");
  const policy = parseSourcingPolicy(overlay.policy);
  if (!Number.isSafeInteger(policy.buildQuantity) || policy.buildQuantity <= 0
    || !Number.isSafeInteger(policy.maximumSnapshotAgeSeconds) || policy.maximumSnapshotAgeSeconds <= 0
    || (policy.minimumStock !== undefined && (!Number.isSafeInteger(policy.minimumStock) || policy.minimumStock < 0))) {
    throw new Error("overlay.policy: Unit counts must be safe integers");
  }
  for (const values of [policy.distributors, policy.allowedLifecycle, ...(policy.packaging === undefined ? [] : [policy.packaging])] as readonly string[][]) {
    if (!sortedUnique(values, compareDesignV2Tokens)) throw new Error("overlay.policy: Set-like arrays must be sorted and unique");
  }
  for (const value of [policy.buildQuantity, policy.minimumStock, policy.maximumLeadTimeDays, policy.maximumSnapshotAgeSeconds]) {
    if (value !== undefined && canonicalCommercialNumberV2(value) !== value) throw new Error("overlay.policy: Numbers must use canonical commercial projection");
  }
  if (typeof overlay.evaluatedAt !== "string") throw new Error("overlay.evaluatedAt: Must be a timestamp");
  parseRfc3339InstantV2(overlay.evaluatedAt);
  if (!Array.isArray(overlay.snapshotRefs)) throw new Error("overlay.snapshotRefs: Must be an array");
  const snapshotRefs = overlay.snapshotRefs.map((ref) => parseOfferSnapshotV2Ref(ref));
  if (!sortedUnique(snapshotRefs, compareSnapshotRef)) throw new Error("overlay.snapshotRefs: Must be sorted and unique");
  if (!Array.isArray(overlay.authorizationRefs)) throw new Error("overlay.authorizationRefs: Must be an array");
  const authorizationRefs = overlay.authorizationRefs.map((ref, index) => parseAuthorizationRef(ref, `overlay.authorizationRefs.${index}`));
  if (!sortedUnique(authorizationRefs, (left, right) => compareDesignV2Tokens(authorizationRefKey(left), authorizationRefKey(right)))) {
    throw new Error("overlay.authorizationRefs: Must be sorted and unique");
  }
  if (overlay.authorizationNotAfter !== null) {
    if (typeof overlay.authorizationNotAfter !== "string") throw new Error("overlay.authorizationNotAfter: Must be a timestamp or null");
    parseRfc3339InstantV2(overlay.authorizationNotAfter);
  }
  if (!Array.isArray(overlay.attributions)) throw new Error("overlay.attributions: Must be an array");
  const attributions = overlay.attributions.map((entry, index) => parseAttribution(entry, `overlay.attributions.${index}`));
  if (!sortedUnique(attributions, compareAttribution)) {
    throw new Error("overlay.attributions: Must be sorted and unique");
  }
  const paretoCriteria = parseCriteria(overlay.paretoCriteria, "overlay.paretoCriteria", true);
  const rankingCriteria = parseCriteria(overlay.rankingCriteria, "overlay.rankingCriteria", false);
  if (!Array.isArray(overlay.candidates)) throw new Error("overlay.candidates: Must be an array");
  const candidates = overlay.candidates.map((entry, index) => parseCandidate(entry, `overlay.candidates.${index}`));
  if (new Set(candidates.map((candidate) => candidate.candidateId)).size !== candidates.length) throw new Error("overlay.candidates: Duplicate candidate ID");
  if (candidates.some((candidate, index) => candidate.order !== index)) throw new Error("overlay.candidates: Order must be unique, contiguous, and array-sorted");
  const ranks = candidates.flatMap((candidate) => candidate.rank.status === "ranked" ? [candidate.rank.rank] : []).sort((left, right) => left - right);
  if (ranks.some((rank, index) => rank !== index + 1)) throw new Error("overlay.candidates: Ranked values must be contiguous");
  if (typeof overlay.contentHash !== "string" || !HASH.test(overlay.contentHash)) throw new Error("overlay.contentHash: Invalid hash");
  if (typeof overlay.id !== "string" || !OVERLAY_ID.test(overlay.id)) throw new Error("overlay.id: Invalid ID");
  const parsed = {
    format: "schemagic-commercial-overlay" as const,
    schemaVersion: COMMERCIAL_OVERLAY_SCHEMA_VERSION,
    id: overlay.id as CommercialOverlayV1Id,
    persistence: overlay.persistence,
    designResultRef: cloneJson(designResultRef) as CommercialOverlayV1["designResultRef"],
    policy,
    evaluatedAt: overlay.evaluatedAt,
    snapshotRefs,
    authorizationRefs,
    authorizationNotAfter: overlay.authorizationNotAfter as string | null,
    attributions,
    paretoCriteria,
    rankingCriteria,
    candidates,
    contentHash: overlay.contentHash as Sha256ContentHash,
  } satisfies CommercialOverlayV1;
  const expectedHash = calculateCommercialOverlayV1ContentHash(parsed);
  if (parsed.contentHash !== expectedHash) throw new Error("overlay.contentHash: Does not match canonical payload");
  if (parsed.id !== `commercial-overlay:v1:${expectedHash}`) throw new Error("overlay.id: Does not match content hash");
  return cloneJson(parsed);
}

function metricValue(candidate: CommercialCandidateOverlayV1, field: CommercialField): number | undefined {
  if (field === "buildableQuantity") return candidate.metrics.buildableQuantity;
  if (field === "extendedBomCost") return candidate.metrics.extendedBomCost?.amount;
  return candidate.metrics.maximumLeadTimeDays;
}

function completeFor(candidate: CommercialCandidateOverlayV1, criteria: readonly CommercialRankingCriterionV1[]): boolean {
  return criteria.every((criterion) => metricValue(candidate, criterion.field) !== undefined);
}

function dominates(left: CommercialCandidateOverlayV1, right: CommercialCandidateOverlayV1, criteria: readonly CommercialRankingCriterionV1[]): boolean {
  let strict = false;
  for (const criterion of criteria) {
    const leftValue = metricValue(left, criterion.field)!;
    const rightValue = metricValue(right, criterion.field)!;
    if (criterion.direction === "maximize") {
      if (leftValue < rightValue) return false;
      if (leftValue > rightValue) strict = true;
    } else {
      if (leftValue > rightValue) return false;
      if (leftValue < rightValue) strict = true;
    }
  }
  return strict;
}

function compareRankable(left: CommercialCandidateOverlayV1, right: CommercialCandidateOverlayV1, criteria: readonly CommercialRankingCriterionV1[]): number {
  for (const criterion of criteria) {
    const leftValue = metricValue(left, criterion.field)!;
    const rightValue = metricValue(right, criterion.field)!;
    if (leftValue === rightValue) continue;
    return criterion.direction === "maximize" ? rightValue - leftValue : leftValue - rightValue;
  }
  return compareDesignV2Tokens(left.candidateId, right.candidateId);
}

function deriveCommercialCandidates(
  candidates: readonly CommercialCandidateOverlayV1[],
  paretoCriteria: readonly CommercialRankingCriterionV1[],
  rankingCriteria: readonly CommercialRankingCriterionV1[],
): CommercialCandidateOverlayV1[] {
  const projected = candidates.map((candidate): CommercialCandidateOverlayV1 => ({
    ...cloneJson(candidate),
    status: candidate.policyStatus === "pass" ? "compliant" : candidate.policyStatus === "unknown" ? "unproven" : "rejected",
    pareto: candidate.policyStatus === "pass"
      ? { status: "frontier" }
      : { status: "not_evaluated", reason: "policy_not_pass" },
    rank: candidate.policyStatus === "pass"
      ? { status: "unranked", reason: "no_ranking_criteria" }
      : { status: "unranked", reason: "policy_not_pass" },
    order: 0,
  }));
  const pass = projected.filter((candidate) => candidate.policyStatus === "pass");
  const paretoEligible = pass.filter((candidate) => completeFor(candidate, paretoCriteria));
  for (const candidate of pass) {
    if (!completeFor(candidate, paretoCriteria)) {
      candidate.pareto = { status: "not_evaluated", reason: "missing_requested_metric" };
      candidate.rank = { status: "unranked", reason: "missing_requested_metric" };
      continue;
    }
    const dominators = paretoEligible
      .filter((other) => other.candidateId !== candidate.candidateId && dominates(other, candidate, paretoCriteria))
      .sort((left, right) => compareDesignV2Tokens(left.candidateId, right.candidateId));
    if (dominators[0] !== undefined) {
      candidate.pareto = { status: "dominated", dominatedByCandidateId: dominators[0].candidateId };
      candidate.rank = { status: "unranked", reason: "dominated" };
    } else candidate.pareto = { status: "frontier" };
  }
  const frontier = pass.filter((candidate) => candidate.pareto.status === "frontier");
  if (rankingCriteria.length === 0) {
    for (const candidate of frontier) candidate.rank = { status: "unranked", reason: "no_ranking_criteria" };
  } else {
    const rankable = frontier.filter((candidate) => completeFor(candidate, rankingCriteria)).sort((left, right) => compareRankable(left, right, rankingCriteria));
    const rankableIds = new Set(rankable.map((candidate) => candidate.candidateId));
    for (const candidate of frontier) if (!rankableIds.has(candidate.candidateId)) candidate.rank = { status: "unranked", reason: "missing_requested_metric" };
    rankable.forEach((candidate, index) => { candidate.rank = { status: "ranked", rank: index + 1 }; });
  }
  const group = (candidate: CommercialCandidateOverlayV1): number => {
    if (candidate.rank.status === "ranked") return 0;
    if (candidate.pareto.status === "dominated") return 1;
    if (candidate.status === "compliant" && (candidate.pareto.status === "not_evaluated" || candidate.rank.reason === "missing_requested_metric")) return 2;
    if (candidate.status === "compliant") return 3;
    if (candidate.status === "unproven") return 4;
    return 5;
  };
  projected.sort((left, right) => (
    group(left) - group(right)
    || (left.rank.status === "ranked" && right.rank.status === "ranked" ? left.rank.rank - right.rank.rank : 0)
    || compareDesignV2Tokens(left.candidateId, right.candidateId)
  ));
  projected.forEach((candidate, index) => { candidate.order = index; });
  return projected;
}

export function validateCommercialOverlayDesignBindingV1(
  resultInput: Readonly<DesignResultV2>,
  overlayInput: Readonly<CommercialOverlayV1>,
): ValidationIssue[] {
  let result: DesignResultV2;
  let overlay: CommercialOverlayV1;
  try { result = parseDesignResultV2(resultInput); }
  catch { return [issue("result", "Invalid design result")]; }
  try { overlay = parseCommercialOverlayV1(overlayInput); }
  catch { return [issue("overlay", "Invalid commercial overlay")]; }
  const issues: ValidationIssue[] = [];
  const expectedRef: CommercialOverlayV1["designResultRef"] = {
    schemaVersion: 2,
    designResultContentHash: result.contentHash,
    requestHash: result.requestHash,
    libraryVersion: result.libraryVersion,
    libraryContentHash: result.libraryContentHash,
    candidateSetHash: canonicalCommercialCandidateSetHashV1(result.candidates.map((candidate) => candidate.id)),
  };
  if (!sameCanonical(overlay.designResultRef, expectedRef)) issues.push(issue("overlay.designResultRef", "Does not bind the exact design result"));
  const resultIds = [...result.candidates.map((candidate) => candidate.id)].sort(compareDesignV2Tokens);
  const overlayIds = [...overlay.candidates.map((candidate) => candidate.candidateId)].sort(compareDesignV2Tokens);
  if (!sameCanonical(resultIds, overlayIds)) issues.push(issue("overlay.candidates", "Must contain exactly one entry per electrical candidate"));
  const expectedCandidates = deriveCommercialCandidates(overlay.candidates, overlay.paretoCriteria, overlay.rankingCriteria);
  if (!sameCanonical(overlay.candidates, expectedCandidates)) issues.push(issue("overlay.candidates", "Pareto, rank, and order do not match the deterministic commercial projection"));
  return issues;
}

function expectedAttributions(authorizations: readonly SnapshotAuthorizationV1[]): ProviderAttributionV1[] {
  return [...new Map(authorizations.map((authorization) => [
    attributionKey(authorization.attribution),
    cloneJson(authorization.attribution),
  ])).values()].sort(compareAttribution);
}

function refsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  return sameCanonical(left, right);
}

interface InternalAuthorizationCapability {
  readonly operation: VerifiedCommercialAuthorizationOperationV1;
  readonly verifier: SnapshotAuthorizationVerifierV1;
  readonly use: SnapshotAuthorizedUseV1;
}

function historicalEvaluationCapability(
  capability: InternalAuthorizationCapability,
  evaluatedAt: string,
  snapshots: readonly OfferSnapshotV2[],
  authorizations: readonly SnapshotAuthorizationV1[],
): Pick<CommercialSnapshotContextV1, "authorizationVerifier" | "authorizationOperation"> {
  const operation = Object.freeze({ use: capability.use, checkedAt: evaluatedAt }) as VerifiedCommercialAuthorizationOperationV1;
  const snapshotIds = snapshots.map((snapshot) => snapshot.id);
  const authorizationIds = authorizations.map((authorization) => authorization.id);
  const verifier: SnapshotAuthorizationVerifierV1 = {
    verify: (authorization, snapshot) => capability.verifier.verify(authorization, snapshot),
    authorizeOperation: () => { throw new Error("Historical validation capability cannot mint operations"); },
    validateOperation: (candidateOperation, use, candidateSnapshots, candidateAuthorizations) => (
      candidateOperation === operation
      && use === capability.use
      && sameCanonical(candidateSnapshots.map((snapshot) => snapshot.id), snapshotIds)
      && sameCanonical(candidateAuthorizations.map((authorization) => authorization.id), authorizationIds)
        ? []
        : [issue("authorizationOperation", "Historical validation capability mismatch")]
    ),
  };
  return { authorizationVerifier: verifier, authorizationOperation: operation };
}

function validateOverlayContextInternal(
  result: DesignResultV2,
  overlay: CommercialOverlayV1,
  snapshots: readonly OfferSnapshotV2[],
  authorizations: readonly SnapshotAuthorizationV1[],
  capability: InternalAuthorizationCapability,
): ValidationIssue[] {
  const issues = validateCommercialOverlayDesignBindingV1(result, overlay);
  const snapshotRefs = snapshots.map((snapshot) => ({ id: snapshot.id, schemaVersion: 2 as const, contentHash: snapshot.contentHash }))
    .sort(compareSnapshotRef);
  const authorizationRefs = authorizations.map(snapshotAuthorizationRefV1)
    .sort((left, right) => compareDesignV2Tokens(authorizationRefKey(left), authorizationRefKey(right)));
  if (!refsEqual(overlay.snapshotRefs, snapshotRefs)) issues.push(issue("overlay.snapshotRefs", "Must equal the exact context snapshot refs"));
  if (!refsEqual(overlay.authorizationRefs, authorizationRefs)) issues.push(issue("overlay.authorizationRefs", "Must equal the exact context authorization refs"));
  if (!sameCanonical(overlay.attributions, expectedAttributions(authorizations))) issues.push(issue("overlay.attributions", "Must equal verified authorization attributions"));
  if (overlay.authorizationNotAfter !== null) issues.push(issue("overlay.authorizationNotAfter", "Persisted overlays require perpetual authorization"));
  try {
    if (parseRfc3339InstantV2(overlay.evaluatedAt).epochNanoseconds > parseRfc3339InstantV2(capability.operation.checkedAt).epochNanoseconds) {
      issues.push(issue("overlay.evaluatedAt", "Cannot be later than the trusted validation clock"));
    }
  } catch { issues.push(issue("overlay.evaluatedAt", "Could not compare the trusted validation clock")); }
  if (authorizations.some((authorization) => {
    try { return parseRfc3339InstantV2(authorization.issuedAt).epochNanoseconds > parseRfc3339InstantV2(overlay.evaluatedAt).epochNanoseconds; }
    catch { return true; }
  })) issues.push(issue("overlay.evaluatedAt", "Cannot precede a referenced authorization issuance"));
  const permitted = overlay.persistence === "user_local"
    ? authorizations.every((authorization) => authorization.effectivePersistence === "user_local" || authorization.effectivePersistence === "exportable")
    : authorizations.every((authorization) => authorization.effectivePersistence === "exportable");
  if (!permitted) issues.push(issue("overlay.persistence", "Verified authorization does not permit the persistence target"));
  const resultCandidates = new Map(result.candidates.map((candidate) => [candidate.id, candidate]));
  const historicalCapability = historicalEvaluationCapability(
    capability,
    overlay.evaluatedAt,
    snapshots,
    authorizations,
  );
  for (const [index, entry] of overlay.candidates.entries()) {
    const candidate = resultCandidates.get(entry.candidateId);
    if (candidate === undefined) continue;
    issues.push(...validateCandidateSourcingEvaluationContextV2({
      metrics: entry.metrics,
      policyStatus: entry.policyStatus,
      constraints: entry.constraints,
    }, {
      candidateId: candidate.id,
      components: candidate.components.map((component) => ({
        id: component.id,
        part: component.part,
        quantityPerAssembly: component.quantityPerAssembly,
      })),
      policy: overlay.policy,
      snapshots,
      authorizations,
      authorizationVerifier: historicalCapability.authorizationVerifier,
      authorizationOperation: historicalCapability.authorizationOperation,
      expectedAuthorizationUse: capability.use,
      evaluatedAt: overlay.evaluatedAt,
    }).map((entryIssue) => issue(`overlay.candidates.${index}.${entryIssue.path}`, entryIssue.message)));
  }
  return issues;
}

export function validateCommercialOverlayContextForUseV1(
  resultInput: Readonly<DesignResultV2>,
  overlayInput: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
  expectedUse: "user_local_storage" | "download_export" | "public_share",
): ValidationIssue[] {
  let result: DesignResultV2;
  let overlay: CommercialOverlayV1;
  let documents: ReturnType<typeof parseContextDocuments>;
  try {
    result = parseDesignResultV2(resultInput);
    overlay = parseCommercialOverlayV1(overlayInput);
    documents = parseContextDocuments(context);
  } catch { return [issue("context", "Invalid commercial snapshot context")]; }
  const bindingIssues = validateCommercialOverlayDesignBindingV1(result, overlay);
  if (bindingIssues.length > 0) return bindingIssues;
  if (expectedUse !== "user_local_storage" && overlay.persistence !== "exportable") {
    return [issue("overlay.persistence", "Transfer authorization requires an exportable overlay")];
  }
  let operationIssues: ValidationIssue[];
  try {
    operationIssues = context.authorizationVerifier.validateOperation(
      context.authorizationOperation,
      expectedUse,
      documents.snapshots,
      documents.authorizations,
    );
  } catch { return [issue("context.authorizationOperation", "Commercial authorization operation was rejected")]; }
  if (operationIssues.length > 0) return operationIssues.map((entry) => issue(`context.${entry.path}`, entry.message));
  return validateOverlayContextInternal(result, overlay, documents.snapshots, documents.authorizations, {
    operation: context.authorizationOperation,
    verifier: context.authorizationVerifier,
    use: expectedUse,
  });
}

function parseContextDocuments(context: Readonly<CommercialSnapshotContextV1>): {
  snapshots: OfferSnapshotV2[];
  authorizations: SnapshotAuthorizationV1[];
} {
  const snapshots = context.snapshots.map((snapshot) => parseOfferSnapshotV2(detachPlainJson(snapshot)))
    .sort((left, right) => compareSnapshotRef(
      { id: left.id, schemaVersion: 2, contentHash: left.contentHash },
      { id: right.id, schemaVersion: 2, contentHash: right.contentHash },
    ));
  const authorizations = context.authorizations.map((authorization) => parseSnapshotAuthorizationV1(detachPlainJson(authorization)))
    .sort((left, right) => compareDesignV2Tokens(
      authorizationRefKey(snapshotAuthorizationRefV1(left)),
      authorizationRefKey(snapshotAuthorizationRefV1(right)),
    ));
  return { snapshots, authorizations };
}

export function validateCommercialOverlayContextV1(
  resultInput: Readonly<DesignResultV2>,
  overlayInput: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
): ValidationIssue[] {
  let result: DesignResultV2;
  let overlay: CommercialOverlayV1;
  let documents: ReturnType<typeof parseContextDocuments>;
  try {
    result = parseDesignResultV2(resultInput);
    overlay = parseCommercialOverlayV1(overlayInput);
    documents = parseContextDocuments(context);
  } catch { return [issue("context", "Invalid commercial snapshot context")]; }
  const bindingIssues = validateCommercialOverlayDesignBindingV1(result, overlay);
  if (bindingIssues.length > 0) return bindingIssues;
  const use: SnapshotAuthorizedUseV1 = overlay.persistence === "user_local" ? "user_local_storage" : "download_export";
  let operationIssues: ValidationIssue[];
  try {
    operationIssues = context.authorizationVerifier.validateOperation(
      context.authorizationOperation,
      use,
      documents.snapshots,
      documents.authorizations,
    );
  } catch { return [issue("context.authorizationOperation", "Commercial authorization operation was rejected")]; }
  if (operationIssues.length > 0) return operationIssues.map((entry) => issue(`context.${entry.path}`, entry.message));
  return validateOverlayContextInternal(result, overlay, documents.snapshots, documents.authorizations, {
    operation: context.authorizationOperation,
    verifier: context.authorizationVerifier,
    use,
  });
}

export function validateCommercialOverlaySetContextV1(
  resultInput: Readonly<DesignResultV2>,
  overlayInputs: readonly CommercialOverlayV1[],
  context: Readonly<CommercialSnapshotContextV1>,
  expectedUse: "download_export" | "public_share",
): ValidationIssue[] {
  let result: DesignResultV2;
  let overlays: CommercialOverlayV1[];
  let documents: ReturnType<typeof parseContextDocuments>;
  try {
    result = parseDesignResultV2(resultInput);
    overlays = overlayInputs.map((overlay) => parseCommercialOverlayV1(overlay));
    documents = parseContextDocuments(context);
  } catch { return [issue("context", "Invalid commercial overlay set context")]; }
  if (overlays.some((overlay) => overlay.persistence !== "exportable")) {
    return [issue("overlays", "Transfer validation requires exportable overlays")];
  }
  const unionSnapshotKeys = new Set(overlays.flatMap((overlay) => overlay.snapshotRefs.map((ref) => canonicalDesignV2Payload(ref))));
  const unionAuthorizationKeys = new Set(overlays.flatMap((overlay) => overlay.authorizationRefs.map(authorizationRefKey)));
  const contextSnapshotKeys = documents.snapshots.map((snapshot) => canonicalDesignV2Payload({ id: snapshot.id, schemaVersion: 2, contentHash: snapshot.contentHash }));
  const contextAuthorizationKeys = documents.authorizations.map((authorization) => authorizationRefKey(snapshotAuthorizationRefV1(authorization)));
  if (!sameCanonical([...unionSnapshotKeys].sort(compareDesignV2Tokens), [...contextSnapshotKeys].sort(compareDesignV2Tokens))) {
    return [issue("context.snapshots", "Must equal the exact union of overlay snapshot refs")];
  }
  if (!sameCanonical([...unionAuthorizationKeys].sort(compareDesignV2Tokens), [...contextAuthorizationKeys].sort(compareDesignV2Tokens))) {
    return [issue("context.authorizations", "Must equal the exact union of overlay authorization refs")];
  }
  let unionIssues: ValidationIssue[];
  try {
    unionIssues = context.authorizationVerifier.validateOperation(
      context.authorizationOperation,
      expectedUse,
      documents.snapshots,
      documents.authorizations,
    );
  } catch { return [issue("context.authorizationOperation", "Commercial authorization operation was rejected")]; }
  if (unionIssues.length > 0) return unionIssues.map((entry) => issue(`context.${entry.path}`, entry.message));
  const privateOperation = Object.freeze({ use: expectedUse, checkedAt: context.authorizationOperation.checkedAt }) as VerifiedCommercialAuthorizationOperationV1;
  const allIssues: ValidationIssue[] = [];
  overlays.forEach((overlay, overlayIndex) => {
    const snapshotKeys = new Set(overlay.snapshotRefs.map((ref) => canonicalDesignV2Payload(ref)));
    const subsetSnapshots = documents.snapshots.filter((snapshot) => snapshotKeys.has(canonicalDesignV2Payload({ id: snapshot.id, schemaVersion: 2, contentHash: snapshot.contentHash })));
    const authorizationKeys = new Set(overlay.authorizationRefs.map(authorizationRefKey));
    const subsetAuthorizations = documents.authorizations.filter((authorization) => authorizationKeys.has(authorizationRefKey(snapshotAuthorizationRefV1(authorization))));
    for (const [index, snapshot] of subsetSnapshots.entries()) {
      const matches = subsetAuthorizations.filter((candidate) => candidate.snapshotRef.id === snapshot.id
        && candidate.snapshotRef.schemaVersion === 2
        && candidate.snapshotRef.contentHash === snapshot.contentHash);
      if (matches.length !== 1) allIssues.push(issue(`overlays.${overlayIndex}.authorizations.${index}`, "Exactly one authorization must match each snapshot"));
      else allIssues.push(...context.authorizationVerifier.verify(matches[0]!, snapshot).map((entry) => issue(`overlays.${overlayIndex}.${entry.path}`, entry.message)));
    }
    if (subsetAuthorizations.some((authorization) => !subsetSnapshots.some((snapshot) => (
      authorization.snapshotRef.id === snapshot.id
      && authorization.snapshotRef.schemaVersion === 2
      && authorization.snapshotRef.contentHash === snapshot.contentHash
    )))) {
      allIssues.push(issue(`overlays.${overlayIndex}.authorizations`, "Extra authorization does not resolve to this overlay's snapshots"));
    }
    const privateVerifier: SnapshotAuthorizationVerifierV1 = {
      verify: (authorization, snapshot) => context.authorizationVerifier.verify(authorization, snapshot),
      authorizeOperation: () => { throw new Error("Private overlay-set capability cannot mint operations"); },
      validateOperation: (operation, use, snapshots, authorizations) => {
        if (operation !== privateOperation || use !== expectedUse
          || !sameCanonical(snapshots.map((snapshot) => snapshot.id), subsetSnapshots.map((snapshot) => snapshot.id))
          || !sameCanonical(authorizations.map((authorization) => authorization.id), subsetAuthorizations.map((authorization) => authorization.id))) {
          return [issue("authorizationOperation", "Private overlay-set capability mismatch")];
        }
        return [];
      },
    };
    allIssues.push(...validateOverlayContextInternal(result, overlay, subsetSnapshots, subsetAuthorizations, {
      operation: privateOperation,
      verifier: privateVerifier,
      use: expectedUse,
    }).map((entry) => issue(`overlays.${overlayIndex}.${entry.path}`, entry.message)));
  });
  return allIssues;
}
