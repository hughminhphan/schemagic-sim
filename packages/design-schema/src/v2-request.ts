import { assertValidDesignRequest } from "./validation";
import type { CommercialRankingCriterionV1 } from "@opencircuit/sourcing-schema";
import type { DesignRequestV1 } from "./request";
import {
  boundedDetachedFrozenElectricalRequestV2Value,
  canonicalDesignV2Value,
  compareDesignV2Tokens,
  containsUnsafeDesignDisplayCharactersV2,
  designValidationIssue,
  detachedFrozenDesignV2Value,
} from "./v2-canonical";
import {
  DesignParseErrorV2,
  type DesignRequestV2Migration,
  type ElectricalDesignObjectiveV2,
  type ElectricalDesignRequestV2,
} from "./v2-types";
import { DESIGN_V2_MAX_ASSUMPTIONS, DESIGN_V2_MAX_SET_MEMBERS } from "./v2-limits";

const ELECTRICAL_OBJECTIVES = new Set<ElectricalDesignObjectiveV2>(["area", "balanced", "efficiency", "temperature"]);

function assertSafeRequestStrings(value: unknown, path = ""): void {
  if (typeof value === "string") {
    if (containsUnsafeDesignDisplayCharactersV2(value)) parseFailure(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeRequestStrings(entry, `${path}/${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) assertSafeRequestStrings(entry, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
}

function parseFailure(path: string, code: "invalid_type" | "invalid_value" | "invalid_order" | "resource_limit" = "invalid_value"): never {
  throw new DesignParseErrorV2({ code: code==="resource_limit"?"resource_limit":"invalid_document", stage: "parse", artifact: "electrical_request" }, [designValidationIssue(code, path)]);
}

function sortedUnique(values: unknown, path: string): string[] {
  if (!Array.isArray(values)) return parseFailure(path, "invalid_type");
  if(values.length>DESIGN_V2_MAX_SET_MEMBERS)return parseFailure(path,"resource_limit");
  const strings = values.map((entry, index) => typeof entry === "string" ? entry : parseFailure(`${path}/${index}`, "invalid_type"));
  if (new Set(strings).size !== strings.length) return parseFailure(path, "invalid_order");
  return [...strings].sort(compareDesignV2Tokens);
}

function normalizeSetArrays(request: ElectricalDesignRequestV2): ElectricalDesignRequestV2 {
  const mutable = canonicalDesignV2Value(request) as unknown as ElectricalDesignRequestV2;
  mutable.constraints.allowedTopologyFamilies = sortedUnique(mutable.constraints.allowedTopologyFamilies, "/constraints/allowedTopologyFamilies") as typeof mutable.constraints.allowedTopologyFamilies;
  mutable.constraints.allowedPackages = sortedUnique(mutable.constraints.allowedPackages, "/constraints/allowedPackages");
  const assumptions = mutable.assumptions;
  if (!Array.isArray(assumptions)) return parseFailure("/assumptions", "invalid_type");
  if(assumptions.length>DESIGN_V2_MAX_ASSUMPTIONS)return parseFailure("/assumptions","resource_limit");
  const assumptionIds = assumptions.map((entry, index) => typeof entry?.id === "string" ? entry.id : parseFailure(`/assumptions/${index}/id`, "invalid_type"));
  if (new Set(assumptionIds).size !== assumptionIds.length) return parseFailure("/assumptions", "invalid_order");
  for (const [index, assumption] of assumptions.entries()) {
    assumption.affects = sortedUnique(assumption.affects, `/assumptions/${index}/affects`);
  }
  assumptions.sort((left, right) => compareDesignV2Tokens(left.id, right.id));
  if (mutable.application === "motor.brushed-dc") {
    mutable.requirements.operatingModes = sortedUnique(mutable.requirements.operatingModes, "/requirements/operatingModes") as typeof mutable.requirements.operatingModes;
  }
  return mutable;
}

export function parseElectricalDesignRequestV2(input: unknown): ElectricalDesignRequestV2 {
  const snapshot=boundedDetachedFrozenElectricalRequestV2Value(input);
  assertSafeRequestStrings(snapshot);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return parseFailure("", "invalid_type");
  const raw = snapshot as Record<string, unknown>;
  if (raw.schemaVersion !== 2 || !ELECTRICAL_OBJECTIVES.has(raw.objective as ElectricalDesignObjectiveV2) || Object.prototype.hasOwnProperty.call(raw, "sourcing")) {
    return parseFailure(raw.schemaVersion !== 2 ? "/schemaVersion" : Object.prototype.hasOwnProperty.call(raw, "sourcing") ? "/sourcing" : "/objective");
  }
  const v1 = { ...raw, schemaVersion: 1 };
  try { assertValidDesignRequest(v1); }
  catch { return parseFailure(""); }
  const normalized = normalizeSetArrays(snapshot as unknown as ElectricalDesignRequestV2);
  return detachedFrozenDesignV2Value(normalized);
}

const SUGGESTIONS: Record<"availability" | "bom_cost" | "lead_time", readonly CommercialRankingCriterionV1[]> = {
  availability: [{ field: "buildableQuantity", direction: "maximize" }],
  bom_cost: [{ field: "extendedBomCost", direction: "minimize" }],
  lead_time: [{ field: "maximumLeadTimeDays", direction: "minimize" }],
};

export function migrateDesignRequestV1ToV2(
  request: DesignRequestV1,
  targetLibraryVersion: string,
  engineeringObjective?: ElectricalDesignObjectiveV2,
): DesignRequestV2Migration {
  assertValidDesignRequest(request);
  if (!ELECTRICAL_OBJECTIVES.has(request.objective as ElectricalDesignObjectiveV2)) {
    const sourceObjective = request.objective as "availability" | "bom_cost" | "lead_time";
    const suggestedCommercialRankingCriteria = SUGGESTIONS[sourceObjective].map((criterion) => ({ ...criterion }));
    if (engineeringObjective === undefined) return { status: "engineering_objective_required", sourceObjective, suggestedCommercialRankingCriteria };
  } else if (engineeringObjective !== undefined && request.objective !== engineeringObjective) {
    return { status: "engineering_objective_conflict", sourceObjective: request.objective as ElectricalDesignObjectiveV2, suppliedObjective: engineeringObjective };
  }
  if (typeof targetLibraryVersion !== "string" || targetLibraryVersion.trim() === "") throw new TypeError("targetLibraryVersion must be a non-empty string");
  const { sourcing: _sourcing, ...withoutSourcing } = request;
  const sourceObjective = request.objective;
  const objective = ELECTRICAL_OBJECTIVES.has(sourceObjective as ElectricalDesignObjectiveV2)
    ? sourceObjective as ElectricalDesignObjectiveV2
    : engineeringObjective!;
  const suggestedCommercialRankingCriteria = ELECTRICAL_OBJECTIVES.has(sourceObjective as ElectricalDesignObjectiveV2)
    ? []
    : SUGGESTIONS[sourceObjective as "availability" | "bom_cost" | "lead_time"].map((criterion) => ({ ...criterion }));
  const migrated = parseElectricalDesignRequestV2({
    ...withoutSourcing,
    schemaVersion: 2,
    objective,
    libraryVersion: targetLibraryVersion,
  });
  return { status: "migrated", request: migrated, suggestedCommercialRankingCriteria };
}
