import {
  DESIGN_RESULT_V2_MAX_CANONICAL_BYTES,
  DesignParseErrorV2,
  parsePersistedDesignResult,
  serializeDesignResultV1,
  serializeDesignResultV2,
  type ConstraintDecisionV3,
  type DesignResultV2,
  type ParsedPersistedDesignResult,
} from "@opencircuit/design-schema";
import type { DesignExecutionReportV2 } from "@opencircuit/design-engine/v2-motor-runtime";

export type ImportedDesignTrust =
  | "legacy_v1_audit_only"
  | "production_constraint_observation"
  | "production_context_verified"
  | "structurally_valid";

interface UnverifiedImportedDesignResult {
  result: ParsedPersistedDesignResult;
  trust: "legacy_v1_audit_only" | "structurally_valid";
  execution?: never;
  contextManifestContentHash?: never;
  constraintDecision?: never;
}

interface ProductionContextGeneratedDesignResult {
  result: DesignResultV2;
  trust: "production_context_verified";
  execution: Readonly<DesignExecutionReportV2>;
  contextManifestContentHash: string;
  constraintDecision?: never;
}

interface ProductionConstraintObservationResult {
  result: DesignResultV2;
  trust: "production_constraint_observation";
  execution: Readonly<DesignExecutionReportV2>;
  contextManifestContentHash: string;
  constraintDecision: Readonly<ConstraintDecisionV3>;
}

export type ImportedDesignResult =
  | UnverifiedImportedDesignResult
  | ProductionContextGeneratedDesignResult
  | ProductionConstraintObservationResult;

export type ImportedDesignResultErrorCode = "invalid_json" | "invalid_result" | "resource_limit";
export const LEGACY_INLINE_SOURCING_EXPORT_REASON = "Legacy V1 JSON export is disabled for this audit-only artifact because at least one candidate contains inline sourcing without an authorized V2 commercial context.";

export class ImportedDesignResultError extends Error {
  readonly code: ImportedDesignResultErrorCode;

  constructor(code: ImportedDesignResultErrorCode) {
    super(code === "resource_limit"
      ? "Design result exceeds the supported import limits."
      : code === "invalid_json"
        ? "Design result is not valid JSON."
        : "Design result failed strict structural validation.");
    this.name = "ImportedDesignResultError";
    this.code = code;
  }
}

export const DESIGN_RESULT_IMPORT_MAX_BYTES = DESIGN_RESULT_V2_MAX_CANONICAL_BYTES;

export function designResultHasLegacyInlineSourcing(result: Readonly<ParsedPersistedDesignResult>): boolean {
  return result.schemaVersion === 1
    && result.candidates.some((candidate) => candidate.sourcing !== undefined);
}

export function importedResultHasLegacyInlineSourcing(imported: Readonly<ImportedDesignResult>): boolean {
  return designResultHasLegacyInlineSourcing(imported.result);
}

export function parseImportedDesignResultText(source: string): ImportedDesignResult {
  if (new TextEncoder().encode(source).byteLength > DESIGN_RESULT_IMPORT_MAX_BYTES) {
    throw new ImportedDesignResultError("resource_limit");
  }
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new ImportedDesignResultError("invalid_json");
  }
  try {
    const result = parsePersistedDesignResult(input);
    return {
      result,
      trust: result.schemaVersion === 1 ? "legacy_v1_audit_only" : "structurally_valid",
    };
  } catch (error) {
    if (error instanceof DesignParseErrorV2 && error.detail.code === "resource_limit") {
      throw new ImportedDesignResultError("resource_limit");
    }
    throw new ImportedDesignResultError("invalid_result");
  }
}

export function serializeImportedDesignResult(imported: Readonly<ImportedDesignResult>): string {
  if (importedResultHasLegacyInlineSourcing(imported)) {
    throw new Error(LEGACY_INLINE_SOURCING_EXPORT_REASON);
  }
  return imported.result.schemaVersion === 1
    ? serializeDesignResultV1(imported.result)
    : serializeDesignResultV2(imported.result);
}
