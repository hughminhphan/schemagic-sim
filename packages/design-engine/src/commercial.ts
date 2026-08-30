import {
  calculateCommercialOverlayV1ContentHash,
  calculateCommercialOverlayV1Id,
  canonicalCommercialCandidateSetHashV1,
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  detachedFrozenDesignV2Value,
  parseCommercialOverlayV1,
  parseDesignResultV2,
  validateCommercialOverlayContextForUseV1,
  type CommercialCandidateOverlayV1,
  type CommercialOverlayV1,
  type DesignCandidateV2,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import {
  canonicalCommercialNumberV2,
  compareRfc3339InstantsV2,
  parseCandidateSourcingEvaluationV2,
  parseOfferSnapshotV2,
  parseSnapshotAuthorizationV1,
  parseSourcingPolicy,
  snapshotAuthorizationRefV1,
  validateCandidateSourcingEvaluationContextV2,
  type CommercialRankingCriterionV1,
  type OfferSnapshotV2,
  type OfferSnapshotV2Ref,
  type ProviderAttributionV1,
  type SnapshotAuthorizationRefV1,
  type SnapshotAuthorizationV1,
  type SnapshotAuthorizationVerifierV1,
  type SnapshotAuthorizedUseV1,
  type SourcingPolicy,
  type ValidationIssue,
  type VerifiedCommercialAuthorizationOperationV1,
} from "@opencircuit/sourcing-schema";
import { validateDesignResultEngineeringContextV2 } from "./v2-generate";
import {
  CommercialOverlayGenerationErrorV1,
  EPHEMERAL_COMMERCIAL_VIEW_V2,
  type CommercialEvaluationViewV2,
  type CommercialSourcingCandidateV2,
  type EvaluateCommercialViewContextV2,
  type EvaluateSourcingV2,
  type GenerateCommercialOverlayContextV1,
} from "./commercial-types";

type CommercialField = CommercialRankingCriterionV1["field"];
type PreparedCommercialContext = {
  policy: SourcingPolicy;
  snapshots: OfferSnapshotV2[];
  authorizations: SnapshotAuthorizationV1[];
  snapshotRefs: OfferSnapshotV2Ref[];
  authorizationRefs: SnapshotAuthorizationRefV1[];
  attributions: ProviderAttributionV1[];
  authorizationNotAfter: string | null;
  paretoCriteria: CommercialRankingCriterionV1[];
  rankingCriteria: CommercialRankingCriterionV1[];
  evaluatedAt: string;
  use: SnapshotAuthorizedUseV1;
  authorizationVerifier: SnapshotAuthorizationVerifierV1;
  authorizationOperation: VerifiedCommercialAuthorizationOperationV1;
};

const FIELD_DIRECTION: Readonly<Record<CommercialField, CommercialRankingCriterionV1["direction"]>> = {
  buildableQuantity: "maximize",
  extendedBomCost: "minimize",
  maximumLeadTimeDays: "minimize",
};

function problem(code: ConstructorParameters<typeof CommercialOverlayGenerationErrorV1>[0], path: string, message: string): never {
  throw new CommercialOverlayGenerationErrorV1(code, [{ path, message }]);
}

function compareSnapshotRef(left: OfferSnapshotV2Ref, right: OfferSnapshotV2Ref): number {
  return left.schemaVersion - right.schemaVersion
    || compareDesignV2Tokens(left.id, right.id)
    || compareDesignV2Tokens(left.contentHash, right.contentHash);
}

function authorizationKey(ref: SnapshotAuthorizationRefV1): string {
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

function normalizePolicy(input: Readonly<SourcingPolicy>): SourcingPolicy {
  const parsed = parseSourcingPolicy(input);
  if (!Number.isSafeInteger(parsed.buildQuantity) || parsed.buildQuantity <= 0
    || !Number.isSafeInteger(parsed.maximumSnapshotAgeSeconds) || parsed.maximumSnapshotAgeSeconds <= 0
    || (parsed.minimumStock !== undefined && (!Number.isSafeInteger(parsed.minimumStock) || parsed.minimumStock < 0))) {
    problem("invalid_context", "policy", "Commercial policy unit counts must be safe integers");
  }
  const unique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort(compareDesignV2Tokens);
  return parseSourcingPolicy({
    ...parsed,
    distributors: unique(parsed.distributors),
    allowedLifecycle: unique(parsed.allowedLifecycle),
    buildQuantity: canonicalCommercialNumberV2(parsed.buildQuantity),
    maximumSnapshotAgeSeconds: canonicalCommercialNumberV2(parsed.maximumSnapshotAgeSeconds),
    ...(parsed.minimumStock === undefined ? {} : { minimumStock: canonicalCommercialNumberV2(parsed.minimumStock) }),
    ...(parsed.maximumLeadTimeDays === undefined ? {} : { maximumLeadTimeDays: canonicalCommercialNumberV2(parsed.maximumLeadTimeDays) }),
    ...(parsed.packaging === undefined ? {} : { packaging: unique(parsed.packaging) }),
  });
}

function normalizeCriteria(input: readonly CommercialRankingCriterionV1[], pareto: boolean): CommercialRankingCriterionV1[] {
  if (!Array.isArray(input)) problem("invalid_context", "criteria", "Commercial criteria must be arrays");
  const criteria = input.map((criterion, index): CommercialRankingCriterionV1 => {
    if (typeof criterion !== "object" || criterion === null || Array.isArray(criterion)
      || Object.keys(criterion).some((key) => key !== "field" && key !== "direction")
      || Object.keys(criterion).length !== 2
      || typeof criterion.field !== "string"
      || !Object.hasOwn(FIELD_DIRECTION, criterion.field)
      || criterion.direction !== FIELD_DIRECTION[criterion.field as CommercialField]) {
      return problem("invalid_context", `criteria.${index}`, "Invalid commercial ranking criterion");
    }
    return { field: criterion.field as CommercialField, direction: criterion.direction };
  });
  if (new Set(criteria.map((criterion) => criterion.field)).size !== criteria.length) {
    problem("invalid_context", "criteria", "Commercial criteria fields must be unique");
  }
  return pareto
    ? criteria.sort((left, right) => compareDesignV2Tokens(left.field, right.field) || compareDesignV2Tokens(left.direction, right.direction))
    : criteria;
}

function prepareContext(
  context: Readonly<EvaluateCommercialViewContextV2>,
  use: SnapshotAuthorizedUseV1,
  persistence?: "user_local" | "exportable",
): PreparedCommercialContext {
  try {
    const authorizationVerifier = context.authorizationVerifier;
    const authorizationOperation = context.authorizationOperation;
    const policy = normalizePolicy(safeEvaluatorOutput(context.policy) as SourcingPolicy);
    const snapshotInputs = safeEvaluatorOutput(context.snapshots);
    const authorizationInputs = safeEvaluatorOutput(context.authorizations);
    if (!Array.isArray(snapshotInputs) || !Array.isArray(authorizationInputs)) {
      problem("invalid_context", "context", "Commercial documents must be arrays");
    }
    const snapshots = snapshotInputs.map((snapshot) => parseOfferSnapshotV2(snapshot)).sort((left, right) => compareSnapshotRef(
      { id: left.id, schemaVersion: 2, contentHash: left.contentHash },
      { id: right.id, schemaVersion: 2, contentHash: right.contentHash },
    ));
    const authorizations = authorizationInputs.map((authorization) => parseSnapshotAuthorizationV1(authorization)).sort((left, right) => (
      compareDesignV2Tokens(authorizationKey(snapshotAuthorizationRefV1(left)), authorizationKey(snapshotAuthorizationRefV1(right)))
    ));
    const snapshotRefs = snapshots.map((snapshot) => ({ id: snapshot.id, schemaVersion: 2 as const, contentHash: snapshot.contentHash }));
    const authorizationRefs = authorizations.map(snapshotAuthorizationRefV1);
    if (new Set(snapshotRefs.map((ref) => canonicalDesignV2Payload(ref))).size !== snapshotRefs.length
      || new Set(authorizationRefs.map(authorizationKey)).size !== authorizationRefs.length) {
      problem("invalid_context", "context", "Commercial snapshot and authorization refs must be unique");
    }
    if (snapshots.some((snapshot) => snapshot.evaluationEligibility !== "native_v2")) {
      problem("invalid_context", "context.snapshots", "Commercial evaluation requires native V2 snapshots");
    }
    const operationIssues = authorizationVerifier.validateOperation(
      authorizationOperation,
      use,
      snapshots,
      authorizations,
    );
    if (operationIssues.length > 0) problem("invalid_context", "context.authorizationOperation", "Commercial authorization operation was rejected");
    const evaluatedAt = authorizationOperation.checkedAt;
    if (snapshots.some((snapshot) => compareRfc3339InstantsV2(snapshot.retrievedAt, evaluatedAt) > 0)) {
      problem("invalid_context", "context.snapshots", "Commercial snapshots cannot be newer than the trusted operation clock");
    }
    if (persistence !== undefined) {
      const allowed = persistence === "user_local"
        ? authorizations.every((authorization) => authorization.effectivePersistence === "user_local" || authorization.effectivePersistence === "exportable")
        : authorizations.every((authorization) => authorization.effectivePersistence === "exportable");
      if (!allowed) problem("invalid_context", "context.persistenceTarget", "Commercial authorization does not permit the persistence target");
    }
    const paretoCriteria = normalizeCriteria(safeEvaluatorOutput(context.paretoCriteria) as CommercialRankingCriterionV1[], true);
    const rankingCriteria = normalizeCriteria(safeEvaluatorOutput(context.rankingCriteria) as CommercialRankingCriterionV1[], false);
    const attributions = [...new Map(authorizations.map((authorization) => [attributionKey(authorization.attribution), authorization.attribution])).values()]
      .sort(compareAttribution);
    const finiteNotAfter = authorizations.flatMap((authorization) => authorization.notAfter === null ? [] : [authorization.notAfter])
      .sort(compareRfc3339InstantsV2);
    const detached = detachedFrozenDesignV2Value({
      policy,
      snapshots,
      authorizations,
      snapshotRefs,
      authorizationRefs,
      attributions,
      authorizationNotAfter: finiteNotAfter[0] ?? null,
      paretoCriteria,
      rankingCriteria,
      evaluatedAt,
      use,
    });
    return Object.freeze({ ...detached, authorizationVerifier, authorizationOperation });
  } catch (caught) {
    if (caught instanceof CommercialOverlayGenerationErrorV1) throw caught;
    return problem("invalid_context", "context", "Commercial context is invalid");
  }
}

function safeEvaluatorOutput(input: unknown): unknown {
  const visit = (value: unknown, seen: Set<object>): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError("contract");
      return value;
    }
    if (typeof value !== "object") throw new TypeError("contract");
    if (seen.has(value)) throw new TypeError("contract");
    seen.add(value);
    let prototype: object | null;
    let keys: (string | symbol)[];
    try { prototype = Object.getPrototypeOf(value); keys = Reflect.ownKeys(value); }
    catch { throw new Error("accessor"); }
    if (keys.some((key) => typeof key !== "string")) throw new TypeError("contract");
    const stringKeys = keys as string[];
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) throw new TypeError("contract");
      let lengthDescriptor: PropertyDescriptor | undefined;
      try { lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length"); }
      catch { throw new Error("accessor"); }
      const length = lengthDescriptor?.value;
      if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0
        || stringKeys.length !== length + 1
        || stringKeys.some((key) => key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length))) {
        throw new TypeError("contract");
      }
      const output: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        let descriptor: PropertyDescriptor | undefined;
        try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); }
        catch { throw new Error("accessor"); }
        if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new Error("accessor");
        if (descriptor === undefined || !descriptor.enumerable) throw new TypeError("contract");
        output.push(visit(descriptor.value, seen));
      }
      seen.delete(value);
      return output;
    }
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("contract");
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of stringKeys) {
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(value, key); }
      catch { throw new Error("accessor"); }
      if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new Error("accessor");
      if (descriptor === undefined || !descriptor.enumerable) throw new TypeError("contract");
      output[key] = visit(descriptor.value, seen);
    }
    seen.delete(value);
    return output;
  };
  return detachedFrozenDesignV2Value(visit(input, new Set()));
}

/** @internal Package-private test hook; not exported by the package root. */
export function _safeCommercialEvaluatorOutputForTesting(input: unknown): unknown {
  return safeEvaluatorOutput(input);
}

function mutationGuard<T>(input: T): T {
  const guarded = new WeakMap<object, object>();
  const visit = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") return value;
    const existing = guarded.get(value);
    if (existing !== undefined) return existing;
    const target: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
    const proxy = new Proxy(target, {
      set() { throw new TypeError("Commercial evaluator inputs are immutable"); },
      deleteProperty() { throw new TypeError("Commercial evaluator inputs are immutable"); },
      defineProperty() { throw new TypeError("Commercial evaluator inputs are immutable"); },
      setPrototypeOf() { throw new TypeError("Commercial evaluator inputs are immutable"); },
    });
    guarded.set(value, proxy);
    if (Array.isArray(value)) {
      const arrayTarget = target as unknown[];
      for (const entry of value) arrayTarget.push(visit(entry));
    } else {
      const objectTarget = target as Record<string, unknown>;
      for (const key of Object.keys(value)) objectTarget[key] = visit((value as Record<string, unknown>)[key]);
    }
    Object.freeze(target);
    return proxy;
  };
  return visit(input) as T;
}

function metric(candidate: CommercialCandidateOverlayV1, field: CommercialField): number | undefined {
  if (field === "buildableQuantity") return candidate.metrics.buildableQuantity;
  if (field === "extendedBomCost") return candidate.metrics.extendedBomCost?.amount;
  return candidate.metrics.maximumLeadTimeDays;
}

function complete(candidate: CommercialCandidateOverlayV1, criteria: readonly CommercialRankingCriterionV1[]): boolean {
  return criteria.every((criterion) => metric(candidate, criterion.field) !== undefined);
}

function dominates(left: CommercialCandidateOverlayV1, right: CommercialCandidateOverlayV1, criteria: readonly CommercialRankingCriterionV1[]): boolean {
  let strict = false;
  for (const criterion of criteria) {
    const leftValue = metric(left, criterion.field)!;
    const rightValue = metric(right, criterion.field)!;
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

function deriveCandidates(
  evaluations: readonly Omit<CommercialCandidateOverlayV1, "pareto" | "rank" | "order">[],
  paretoCriteria: readonly CommercialRankingCriterionV1[],
  rankingCriteria: readonly CommercialRankingCriterionV1[],
): CommercialCandidateOverlayV1[] {
  const candidates = evaluations.map((entry): CommercialCandidateOverlayV1 => ({
    ...entry,
    pareto: entry.policyStatus === "pass" ? { status: "frontier" } : { status: "not_evaluated", reason: "policy_not_pass" },
    rank: entry.policyStatus === "pass" ? { status: "unranked", reason: "no_ranking_criteria" } : { status: "unranked", reason: "policy_not_pass" },
    order: 0,
  }));
  const pass = candidates.filter((candidate) => candidate.policyStatus === "pass");
  const paretoEligible = pass.filter((candidate) => complete(candidate, paretoCriteria));
  for (const candidate of pass) {
    if (!complete(candidate, paretoCriteria)) {
      candidate.pareto = { status: "not_evaluated", reason: "missing_requested_metric" };
      candidate.rank = { status: "unranked", reason: "missing_requested_metric" };
      continue;
    }
    const dominator = paretoEligible
      .filter((other) => other.candidateId !== candidate.candidateId && dominates(other, candidate, paretoCriteria))
      .sort((left, right) => compareDesignV2Tokens(left.candidateId, right.candidateId))[0];
    if (dominator !== undefined) {
      candidate.pareto = { status: "dominated", dominatedByCandidateId: dominator.candidateId };
      candidate.rank = { status: "unranked", reason: "dominated" };
    }
  }
  const frontier = pass.filter((candidate) => candidate.pareto.status === "frontier");
  if (rankingCriteria.length === 0) {
    for (const candidate of frontier) candidate.rank = { status: "unranked", reason: "no_ranking_criteria" };
  } else {
    const rankable = frontier.filter((candidate) => complete(candidate, rankingCriteria)).sort((left, right) => {
      for (const criterion of rankingCriteria) {
        const leftValue = metric(left, criterion.field)!;
        const rightValue = metric(right, criterion.field)!;
        if (leftValue !== rightValue) return criterion.direction === "maximize" ? rightValue - leftValue : leftValue - rightValue;
      }
      return compareDesignV2Tokens(left.candidateId, right.candidateId);
    });
    const rankedIds = new Set(rankable.map((candidate) => candidate.candidateId));
    for (const candidate of frontier) if (!rankedIds.has(candidate.candidateId)) candidate.rank = { status: "unranked", reason: "missing_requested_metric" };
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
  candidates.sort((left, right) => group(left) - group(right)
    || (left.rank.status === "ranked" && right.rank.status === "ranked" ? left.rank.rank - right.rank.rank : 0)
    || compareDesignV2Tokens(left.candidateId, right.candidateId));
  candidates.forEach((candidate, index) => { candidate.order = index; });
  return candidates;
}

function callbackCandidate(candidate: DesignCandidateV2): CommercialSourcingCandidateV2 {
  return detachedFrozenDesignV2Value({
    id: candidate.id,
    components: candidate.components.map((component) => ({
      id: component.id,
      part: component.part,
      quantityPerAssembly: component.quantityPerAssembly,
    })),
  });
}

function runEvaluations(
  result: DesignResultV2,
  context: Readonly<EvaluateCommercialViewContextV2>,
  prepared: PreparedCommercialContext,
): CommercialCandidateOverlayV1[] | undefined {
  let evaluator: EvaluateSourcingV2 | undefined;
  try { evaluator = context.evaluateSourcing; }
  catch { return problem("evaluator_threw", "evaluateSourcing", "Commercial evaluator access failed"); }
  if (evaluator === undefined) return undefined;
  if (typeof evaluator !== "function") return problem("evaluator_contract_invalid", "evaluateSourcing", "Commercial evaluator must be a function");
  const evaluations: Omit<CommercialCandidateOverlayV1, "pareto" | "rank" | "order">[] = [];
  const sortedCandidates = [...result.candidates].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
  for (const candidate of sortedCandidates) {
    let returned: unknown;
    const candidateInput = callbackCandidate(candidate);
    try {
      returned = evaluator(
        mutationGuard(candidateInput),
        mutationGuard(prepared.snapshots),
        mutationGuard(prepared.policy),
        prepared.evaluatedAt,
      );
    }
    catch { return problem("evaluator_threw", "evaluateSourcing", "Commercial evaluator threw"); }
    let detached: unknown;
    try { detached = safeEvaluatorOutput(returned); }
    catch (caught) {
      if (caught instanceof Error && caught.message === "accessor") return problem("evaluator_threw", "evaluateSourcing", "Commercial evaluator result access failed");
      return problem("evaluator_contract_invalid", "evaluateSourcing", "Commercial evaluator returned an invalid value");
    }
    let evaluation;
    try { evaluation = parseCandidateSourcingEvaluationV2(detached); }
    catch { return problem("evaluator_contract_invalid", "evaluateSourcing", "Commercial evaluator returned an invalid contract"); }
    const issues = validateCandidateSourcingEvaluationContextV2(evaluation, {
      candidateId: candidate.id,
      components: candidateInput.components,
      policy: prepared.policy,
      snapshots: prepared.snapshots,
      authorizations: prepared.authorizations,
      authorizationVerifier: prepared.authorizationVerifier,
      authorizationOperation: prepared.authorizationOperation,
      expectedAuthorizationUse: prepared.use,
      evaluatedAt: prepared.evaluatedAt,
    });
    if (issues.length > 0) return problem("evaluator_contract_invalid", "evaluateSourcing", "Commercial evaluator result failed contextual validation");
    evaluations.push({
      candidateId: candidate.id,
      status: evaluation.policyStatus === "pass" ? "compliant" : evaluation.policyStatus === "unknown" ? "unproven" : "rejected",
      policyStatus: evaluation.policyStatus,
      metrics: evaluation.metrics,
      constraints: evaluation.constraints,
    });
  }
  return deriveCandidates(evaluations, prepared.paretoCriteria, prepared.rankingCriteria);
}

function validateEngineering(result: DesignResultV2, context: Readonly<EvaluateCommercialViewContextV2>): void {
  let issues: readonly unknown[];
  try { issues = validateDesignResultEngineeringContextV2(result, context.engineeringContext); }
  catch { return problem("invalid_context", "engineeringContext", "Electrical result regeneration failed"); }
  if (issues.length > 0) problem("invalid_context", "engineeringContext", "Electrical result does not match its engineering context");
}

function parsedResult(result: Readonly<DesignResultV2>): DesignResultV2 {
  try { return parseDesignResultV2(result); }
  catch { return problem("invalid_design_result", "result", "Electrical design result is invalid"); }
}

export function evaluateCommercialViewV2(
  resultInput: Readonly<DesignResultV2>,
  context: Readonly<EvaluateCommercialViewContextV2>,
): CommercialEvaluationViewV2 | undefined {
  const result = parsedResult(resultInput);
  const prepared = prepareContext(context, "display");
  validateEngineering(result, context);
  const candidates = runEvaluations(result, context, prepared);
  if (candidates === undefined) return undefined;
  const detached = detachedFrozenDesignV2Value({
    designResultContentHash: result.contentHash,
    policy: prepared.policy,
    evaluatedAt: prepared.evaluatedAt,
    snapshotRefs: prepared.snapshotRefs,
    authorizationRefs: prepared.authorizationRefs,
    authorizationNotAfter: prepared.authorizationNotAfter,
    attributions: prepared.attributions,
    paretoCriteria: prepared.paretoCriteria,
    rankingCriteria: prepared.rankingCriteria,
    candidates,
  });
  const view = { ...detached } as Omit<CommercialEvaluationViewV2, typeof EPHEMERAL_COMMERCIAL_VIEW_V2>;
  Object.defineProperty(view, EPHEMERAL_COMMERCIAL_VIEW_V2, { value: true, enumerable: false });
  return Object.freeze(view) as CommercialEvaluationViewV2;
}

export function generateCommercialOverlayV1(
  resultInput: Readonly<DesignResultV2>,
  context: Readonly<GenerateCommercialOverlayContextV1>,
): CommercialOverlayV1 | undefined {
  const result = parsedResult(resultInput);
  let target: "user_local" | "exportable";
  try { target = context.persistenceTarget; }
  catch { return problem("invalid_context", "persistenceTarget", "Invalid commercial persistence target"); }
  if (target !== "user_local" && target !== "exportable") problem("invalid_context", "persistenceTarget", "Invalid commercial persistence target");
  const use: SnapshotAuthorizedUseV1 = target === "user_local" ? "user_local_storage" : "download_export";
  const prepared = prepareContext(context, use, target);
  validateEngineering(result, context);
  const candidates = runEvaluations(result, context, prepared);
  if (candidates === undefined) return undefined;
  const withoutIdentity: Omit<CommercialOverlayV1, "id" | "contentHash"> = {
    format: "schemagic-commercial-overlay",
    schemaVersion: 1,
    persistence: target,
    designResultRef: {
      schemaVersion: 2,
      designResultContentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
      candidateSetHash: canonicalCommercialCandidateSetHashV1(result.candidates.map((candidate) => candidate.id)),
    },
    policy: prepared.policy,
    evaluatedAt: prepared.evaluatedAt,
    snapshotRefs: prepared.snapshotRefs,
    authorizationRefs: prepared.authorizationRefs,
    authorizationNotAfter: null,
    attributions: prepared.attributions,
    paretoCriteria: prepared.paretoCriteria,
    rankingCriteria: prepared.rankingCriteria,
    candidates,
  };
  const contentHash = calculateCommercialOverlayV1ContentHash(withoutIdentity);
  const overlay = parseCommercialOverlayV1({
    ...withoutIdentity,
    id: calculateCommercialOverlayV1Id(withoutIdentity),
    contentHash,
  });
  const contextIssues: ValidationIssue[] = validateCommercialOverlayContextForUseV1(result, overlay, {
    snapshots: prepared.snapshots,
    authorizations: prepared.authorizations,
    authorizationVerifier: prepared.authorizationVerifier,
    authorizationOperation: prepared.authorizationOperation,
  }, use as "user_local_storage" | "download_export");
  if (contextIssues.length > 0) problem("evaluator_contract_invalid", "evaluateSourcing", "Commercial evaluator result failed overlay validation");
  return detachedFrozenDesignV2Value(overlay);
}
