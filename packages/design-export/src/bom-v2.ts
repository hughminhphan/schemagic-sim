import {
  canonicalDesignV2Payload,
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignCandidateV2,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import {
  validateDesignResultEngineeringContextV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import type { ValidationIssue } from "@opencircuit/sourcing-schema";

export const ELECTRICAL_BOM_V2_COLUMNS = Object.freeze([
  "bom_line_id",
  "role",
  "manufacturer_id",
  "manufacturer_part_number",
  "profile_id",
  "quantity_per_assembly",
  "value",
  "value_unit",
  "evidence_json",
] as const);

export const COMMERCIAL_BOM_V2_COLUMNS = Object.freeze([
  ...ELECTRICAL_BOM_V2_COLUMNS,
  "sourcing_data_status",
  "sourcing_policy_status",
  "unknown_observation_count",
  "snapshot_id",
  "snapshot_schema_version",
  "snapshot_content_hash",
  "distributor",
  "distributor_sku",
  "line_status",
  "provider_policy_id",
  "provider_policy_version",
  "provider_policy_content_hash",
  "provider_attribution_label",
  "all_provider_attributions_json",
  "purchase_quantity",
  "buildable_quantity",
  "extended_cost_amount",
  "extended_cost_currency",
  "stock_quantity",
  "region_state",
  "region_value",
  "region_reason",
  "currency_state",
  "currency_value",
  "currency_reason",
  "packaging_state",
  "packaging_value",
  "packaging_reason",
  "marketplace_state",
  "marketplace_value",
  "marketplace_reason",
  "backorder_state",
  "backorder_value",
  "backorder_reason",
  "lifecycle_state",
  "lifecycle_value",
  "lifecycle_reason",
  "lifecycle_source_state",
  "lifecycle_source_value",
  "lifecycle_source_reason",
  "lead_time_days_state",
  "lead_time_days_value",
  "lead_time_days_reason",
  "lead_time_kind_state",
  "lead_time_kind_value",
  "lead_time_kind_reason",
] as const);

export type CommercialDesignExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "invalid_snapshot"
  | "invalid_overlay"
  | "commercial_context_unverified"
  | "persistence_not_exportable";

export class CommercialDesignExportErrorV2 extends Error {
  readonly code: CommercialDesignExportErrorCodeV2;
  readonly issues: readonly ValidationIssue[];

  constructor(
    code: CommercialDesignExportErrorCodeV2,
    issues: readonly ValidationIssue[] = [],
  ) {
    super("scheMAGIC design export was rejected");
    this.name = "CommercialDesignExportErrorV2";
    this.code = code;
    this.issues = Object.freeze([...issues]);
  }
}

const FORMULA_PREFIXES = new Set(["'", "=", "+", "-", "@"]);

function firstNonSpaceOrTab(value: string): string | undefined {
  for (const codePoint of value) if (codePoint !== " " && codePoint !== "\t") return codePoint;
  return undefined;
}

function rfc4180(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function formulaSafe(value: string): string {
  const first = firstNonSpaceOrTab(value);
  return first !== undefined && FORMULA_PREFIXES.has(first) ? `'${value}` : value;
}

function isEscapedControl(codePoint: number): boolean {
  return codePoint <= 0x1f
    || (codePoint >= 0x7f && codePoint <= 0x9f)
    || codePoint === 0x2028
    || codePoint === 0x2029;
}

/** Reversible text escaping, spreadsheet-formula defence, then RFC-4180 quoting. */
export function escapeBomTextCellV2(value: string): string {
  let escaped = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new TypeError("BOM text must contain Unicode scalar values");
    }
    if (character === "\\") escaped += "\\\\";
    else if (isEscapedControl(codePoint)) escaped += `\\u${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    else escaped += character;
  }
  return rfc4180(formulaSafe(escaped));
}

/** Inverse of the V2 text layer after an RFC-4180 reader has decoded the cell. */
export function decodeBomTextCellV2(rfcDecodedCell: string): string {
  let encoded = rfcDecodedCell;
  if (encoded.startsWith("'") && FORMULA_PREFIXES.has(firstNonSpaceOrTab(encoded.slice(1)) ?? "")) {
    encoded = encoded.slice(1);
  }
  let decoded = "";
  for (let index = 0; index < encoded.length;) {
    const codePoint = encoded.codePointAt(index)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new TypeError("BOM text contains a non-scalar value");
    }
    const character = String.fromCodePoint(codePoint);
    if (character !== "\\") {
      if (isEscapedControl(codePoint)) throw new TypeError("BOM text contains an unescaped control");
      decoded += character;
      index += character.length;
      continue;
    }
    if (encoded[index + 1] === "\\") {
      decoded += "\\";
      index += 2;
      continue;
    }
    const escape = encoded.slice(index + 1, index + 6);
    if (!/^u[0-9A-F]{4}$/u.test(escape)) throw new TypeError("BOM text contains a malformed escape");
    const escapedCodePoint = Number.parseInt(escape.slice(1), 16);
    if (!isEscapedControl(escapedCodePoint)) throw new TypeError("BOM text contains a non-canonical escape");
    decoded += String.fromCodePoint(escapedCodePoint);
    index += 6;
  }
  return decoded;
}

function jsonCell(value: unknown): string {
  const json = canonicalDesignV2Payload(value).replace(
    /[\u007f-\u009f\u2028\u2029]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
  );
  return rfc4180(formulaSafe(json));
}

function numericCell(value: number | undefined): string {
  if (value === undefined) return "";
  if (!Number.isFinite(value)) throw new TypeError("BOM value must be finite");
  return JSON.stringify(Object.is(value, -0) ? 0 : value);
}

/** @internal Shared only by the commercial V2 row projector. */
export function _bomJsonCellV2(value: unknown): string { return jsonCell(value); }
/** @internal Shared only by the commercial V2 row projector. */
export function _bomNumericCellV2(value: number | undefined): string { return numericCell(value); }

function electricalRows(candidate: Readonly<DesignCandidateV2>): string[] {
  return [...candidate.components]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map((component) => [
      escapeBomTextCellV2(component.id),
      escapeBomTextCellV2(component.role),
      escapeBomTextCellV2(component.part.manufacturerId),
      escapeBomTextCellV2(component.part.manufacturerPartNumber),
      escapeBomTextCellV2(component.profileId),
      numericCell(component.quantityPerAssembly),
      numericCell(component.value?.value),
      component.value === undefined ? "" : escapeBomTextCellV2(component.value.unit),
      jsonCell(component.evidence),
    ].join(","));
}

/**
 * @internal Render an already-authorized candidate as an electrical-only BOM.
 *
 * This seam deliberately performs no context or candidate authorization. It
 * exists so closed higher-level artifact contracts can reuse the exact V2 CSV
 * escaping without weakening `exportElectricalBomCsvV2`.
 */
export function _renderElectricalBomCsvV2(candidate: Readonly<DesignCandidateV2>): string {
  const rows = electricalRows(candidate);
  return `${ELECTRICAL_BOM_V2_COLUMNS.join(",")}\n${rows.length > 0 ? `${rows.join("\n")}\n` : ""}`;
}

/** Export only engineering-context-verified electrical BOM facts. */
export function exportElectricalBomCsvV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): string {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CommercialDesignExportErrorV2("invalid_result");
  }
  const engineeringIssues = validateDesignResultEngineeringContextV2(result, engineeringContext);
  if (engineeringIssues.length > 0) {
    throw new CommercialDesignExportErrorV2("engineering_context_unverified", engineeringIssues);
  }
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CommercialDesignExportErrorV2("candidate_not_found");
  try {
    return _renderElectricalBomCsvV2(candidate);
  } catch {
    throw new CommercialDesignExportErrorV2("invalid_result");
  }
}
