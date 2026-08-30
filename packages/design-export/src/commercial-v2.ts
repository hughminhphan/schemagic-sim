import {
  canonicalDesignV2Payload,
  parseCommercialOverlayV1,
  parseDesignResultV2,
  validateCommercialOverlayContextForUseV1,
  validateCommercialOverlayDesignBindingV1,
  validateCommercialOverlaySetContextV1,
  type CandidateIdV2,
  type CommercialOverlayV1,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import {
  parseAuthorizedOfferSnapshotDocumentV2,
  parseOfferSnapshotV2,
  parseSnapshotAuthorizationV1,
  type AuthorizedOfferSnapshotDocumentV2,
  type CommercialSnapshotContextV1,
  type OfferSnapshotV2,
  type SnapshotAuthorizationV1,
  type SnapshotAuthorizedUseV1,
  type SourcingObservation,
  type ValidationIssue,
} from "@opencircuit/sourcing-schema";
import {
  COMMERCIAL_BOM_V2_COLUMNS,
  CommercialDesignExportErrorV2,
  _bomJsonCellV2,
  _bomNumericCellV2,
  escapeBomTextCellV2,
} from "./bom-v2";
import {
  validateDesignResultEngineeringContextV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine";

type CanonicalJson = boolean | null | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function canonicalSourcingValue(value: unknown): CanonicalJson {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Commercial JSON number must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalSourcingValue);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(value).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested === undefined) throw new TypeError("Commercial JSON cannot contain undefined");
      result[key] = canonicalSourcingValue(nested);
    }
    return result;
  }
  throw new TypeError("Commercial JSON contains an unsupported value");
}

function canonicalSourcingJson(value: unknown): string {
  return JSON.stringify(canonicalSourcingValue(value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameSnapshot(left: Readonly<OfferSnapshotV2>, right: Readonly<OfferSnapshotV2>): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.id === right.id
    && left.contentHash === right.contentHash;
}

function contextForSingleSnapshot(
  snapshotInput: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
  use: SnapshotAuthorizedUseV1,
  persistence: "local" | "transferable",
): AuthorizedOfferSnapshotDocumentV2 {
  let snapshot: OfferSnapshotV2;
  try {
    snapshot = parseOfferSnapshotV2(snapshotInput);
  } catch {
    throw new CommercialDesignExportErrorV2("invalid_snapshot");
  }
  let contextSnapshot: OfferSnapshotV2;
  let authorization: SnapshotAuthorizationV1;
  try {
    if (context.snapshots.length !== 1 || context.authorizations.length !== 1) {
      throw new Error("Context must contain exactly one snapshot and authorization");
    }
    contextSnapshot = parseOfferSnapshotV2(context.snapshots[0]);
    authorization = parseSnapshotAuthorizationV1(context.authorizations[0]);
  } catch {
    throw new CommercialDesignExportErrorV2("commercial_context_unverified");
  }
  if (!sameSnapshot(snapshot, contextSnapshot)) {
    throw new CommercialDesignExportErrorV2("commercial_context_unverified");
  }
  if (persistence === "transferable" ? snapshot.persistence !== "exportable" : snapshot.persistence === "ephemeral") {
    throw new CommercialDesignExportErrorV2("persistence_not_exportable");
  }
  let operationIssues;
  try {
    operationIssues = context.authorizationVerifier.validateOperation(
      context.authorizationOperation,
      use,
      [contextSnapshot],
      [authorization],
    );
  } catch {
    throw new CommercialDesignExportErrorV2("commercial_context_unverified");
  }
  if (operationIssues.length > 0) {
    throw new CommercialDesignExportErrorV2("commercial_context_unverified", operationIssues);
  }
  try {
    return parseAuthorizedOfferSnapshotDocumentV2({
      format: "schemagic-authorized-offer-snapshot",
      schemaVersion: 2,
      snapshot,
      authorization,
    });
  } catch {
    throw new CommercialDesignExportErrorV2("commercial_context_unverified");
  }
}

function serializeAuthorizedSnapshot(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
  use: SnapshotAuthorizedUseV1,
  persistence: "local" | "transferable",
): string {
  const document = contextForSingleSnapshot(snapshot, context, use, persistence);
  return `${canonicalSourcingJson(document)}\n`;
}

/** Persist an authorized snapshot only in provider-approved local storage. */
export function serializeAuthorizedOfferSnapshotForLocalStorageV2(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeAuthorizedSnapshot(snapshot, context, "user_local_storage", "local");
}

/** Produce an authorized, transferable snapshot document for download. */
export function serializeAuthorizedOfferSnapshotV2(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeAuthorizedSnapshot(snapshot, context, "download_export", "transferable");
}

/** Produce an authorized snapshot document for an explicit public-share action. */
export function serializeAuthorizedOfferSnapshotForPublicShareV2(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeAuthorizedSnapshot(snapshot, context, "public_share", "transferable");
}

export interface DesignExportBundleV2 {
  format: "schemagic-design-export";
  schemaVersion: 2;
  design: DesignResultV2;
  commercialOverlays: CommercialOverlayV1[];
}

class BundleParseError extends Error {
  readonly code: "invalid_result" | "invalid_overlay" | "persistence_not_exportable";
  constructor(code: BundleParseError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function parseBundle(input: unknown): DesignExportBundleV2 {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("bundle: Must be an object");
  const source = input as Record<string, unknown>;
  const keys = ["format", "schemaVersion", "design", "commercialOverlays"] as const;
  for (const key of Object.keys(source)) if (!keys.includes(key as typeof keys[number])) throw new Error(`bundle.${key}: Unknown key`);
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(source, key)) throw new Error(`bundle.${key}: Missing key`);
  if (source.format !== "schemagic-design-export" || source.schemaVersion !== 2) throw new Error("bundle: Unsupported version");
  let design: DesignResultV2;
  try { design = parseDesignResultV2(source.design); }
  catch { throw new BundleParseError("invalid_result", "bundle.design: Invalid design result"); }
  if (!Array.isArray(source.commercialOverlays)) throw new Error("bundle.commercialOverlays: Must be an array");
  let commercialOverlays: CommercialOverlayV1[];
  try { commercialOverlays = source.commercialOverlays.map((overlay) => parseCommercialOverlayV1(overlay)); }
  catch { throw new BundleParseError("invalid_overlay", "bundle.commercialOverlays: Invalid overlay"); }
  if (commercialOverlays.some((overlay) => overlay.persistence !== "exportable")) throw new BundleParseError("persistence_not_exportable", "bundle.commercialOverlays: Overlay is not exportable");
  for (let index = 1; index < commercialOverlays.length; index += 1) {
    if (compareText(commercialOverlays[index - 1]!.id, commercialOverlays[index]!.id) >= 0) {
      throw new Error("bundle.commercialOverlays: Must be ID-sorted and unique");
    }
  }
  for (const overlay of commercialOverlays) {
    if (validateCommercialOverlayDesignBindingV1(design, overlay).length > 0) {
      throw new Error("bundle.commercialOverlays: Overlay does not bind the design result");
    }
  }
  return { format: "schemagic-design-export", schemaVersion: 2, design, commercialOverlays };
}

/** Structurally parse a V2 transfer bundle without claiming commercial trust. */
export function parseDesignExportBundleV2(input: unknown): DesignExportBundleV2 {
  return parseBundle(input);
}

/** Validate the exact union authorization context for an ordinary download. */
export function validateDesignExportBundleCommercialContextV2(
  bundleInput: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): ValidationIssue[] {
  let bundle: DesignExportBundleV2;
  try { bundle = parseBundle(bundleInput); }
  catch { return [{ path: "bundle", message: "Invalid design export bundle" }]; }
  return validateCommercialOverlaySetContextV1(bundle.design, bundle.commercialOverlays, context, "download_export");
}

function serializeOverlayForUse(
  resultInput: Readonly<DesignResultV2>,
  overlayInput: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
  use: "user_local_storage" | "download_export",
): string {
  let result: DesignResultV2;
  let overlay: CommercialOverlayV1;
  try { result = parseDesignResultV2(resultInput); }
  catch { throw new CommercialDesignExportErrorV2("invalid_result"); }
  try { overlay = parseCommercialOverlayV1(overlayInput); }
  catch { throw new CommercialDesignExportErrorV2("invalid_overlay"); }
  if (use === "download_export" && overlay.persistence !== "exportable") {
    throw new CommercialDesignExportErrorV2("persistence_not_exportable");
  }
  const issues = validateCommercialOverlayContextForUseV1(result, overlay, context, use);
  if (issues.length > 0) throw new CommercialDesignExportErrorV2("commercial_context_unverified", issues);
  return `${canonicalDesignV2Payload(overlay)}\n`;
}

export function serializeCommercialOverlayForLocalStorageV1(
  result: Readonly<DesignResultV2>,
  overlay: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeOverlayForUse(result, overlay, context, "user_local_storage");
}

export function serializeCommercialOverlayV1(
  result: Readonly<DesignResultV2>,
  overlay: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeOverlayForUse(result, overlay, context, "download_export");
}

function serializeBundleForUse(
  bundleInput: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
  use: "download_export" | "public_share",
): string {
  let bundle: DesignExportBundleV2;
  try { bundle = parseBundle(bundleInput); }
  catch (error) {
    throw new CommercialDesignExportErrorV2(error instanceof BundleParseError ? error.code : "invalid_overlay");
  }
  const issues = validateCommercialOverlaySetContextV1(bundle.design, bundle.commercialOverlays, context, use);
  if (issues.length > 0) throw new CommercialDesignExportErrorV2("commercial_context_unverified", issues);
  return `${canonicalDesignV2Payload(bundle)}\n`;
}

export function serializeDesignExportBundleV2(
  bundle: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeBundleForUse(bundle, context, "download_export");
}

export function serializeDesignExportBundleForPublicShareV2(
  bundle: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string {
  return serializeBundleForUse(bundle, context, "public_share");
}

function scalarCell(value: boolean | null | number | string | undefined): string {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "number") return _bomNumericCellV2(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return escapeBomTextCellV2(value);
}

function observationCells(observation: SourcingObservation<unknown> | undefined): [string, string, string] {
  if (observation === undefined) return ["", "", ""];
  if (observation.state === "known") return ["known", scalarCell(observation.value as boolean | null | number | string), ""];
  return ["unknown", "null", escapeBomTextCellV2(observation.reason)];
}

function sameRef(
  left: { id: string; schemaVersion: number; contentHash: string },
  right: { id: string; schemaVersion: number; contentHash: string },
): boolean {
  return left.id === right.id && left.schemaVersion === right.schemaVersion && left.contentHash === right.contentHash;
}

export function exportCommercialBomCsvV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  overlayInput: Readonly<CommercialOverlayV1>,
  context: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    commercial: CommercialSnapshotContextV1;
  }>,
): string {
  let result: DesignResultV2;
  let overlay: CommercialOverlayV1;
  try { result = parseDesignResultV2(resultInput); }
  catch { throw new CommercialDesignExportErrorV2("invalid_result"); }
  try { overlay = parseCommercialOverlayV1(overlayInput); }
  catch { throw new CommercialDesignExportErrorV2("invalid_overlay"); }
  const engineeringIssues = validateDesignResultEngineeringContextV2(result, context.engineeringContext);
  if (engineeringIssues.length > 0) throw new CommercialDesignExportErrorV2("engineering_context_unverified", engineeringIssues);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CommercialDesignExportErrorV2("candidate_not_found");
  if (candidate.components.length === 0) throw new CommercialDesignExportErrorV2("invalid_result");
  if (overlay.persistence !== "exportable") throw new CommercialDesignExportErrorV2("persistence_not_exportable");
  let commercialContext: CommercialSnapshotContextV1;
  try {
    commercialContext = {
      ...context.commercial,
      snapshots: context.commercial.snapshots.map((snapshot) => parseOfferSnapshotV2(snapshot)),
      authorizations: context.commercial.authorizations.map((authorization) => parseSnapshotAuthorizationV1(authorization)),
    };
  } catch {
    throw new CommercialDesignExportErrorV2("commercial_context_unverified");
  }
  const commercialIssues = validateCommercialOverlayContextForUseV1(result, overlay, commercialContext, "download_export");
  if (commercialIssues.length > 0) throw new CommercialDesignExportErrorV2("commercial_context_unverified", commercialIssues);
  const candidateOverlay = overlay.candidates.find((entry) => entry.candidateId === candidateId)!;
  const lineById = new Map(candidateOverlay.metrics.lines.map((line) => [line.bomLineId, line]));
  const attributionJson = _bomJsonCellV2(overlay.attributions);
  try {
    const rows = [...candidate.components].sort((left, right) => compareText(left.id, right.id)).map((component) => {
      const line = lineById.get(component.id)!;
      const evaluated = line.evaluatedOffer;
      const authorization = evaluated === undefined ? undefined : commercialContext.authorizations.find((entry) => (
        entry.provider === evaluated.distributor && sameRef(entry.snapshotRef, evaluated.snapshot)
      ));
      const cells = [
        escapeBomTextCellV2(component.id),
        escapeBomTextCellV2(component.role),
        escapeBomTextCellV2(component.part.manufacturerId),
        escapeBomTextCellV2(component.part.manufacturerPartNumber),
        escapeBomTextCellV2(component.profileId),
        _bomNumericCellV2(component.quantityPerAssembly),
        _bomNumericCellV2(component.value?.value),
        component.value === undefined ? "" : escapeBomTextCellV2(component.value.unit),
        _bomJsonCellV2(component.evidence),
        escapeBomTextCellV2(candidateOverlay.metrics.status),
        escapeBomTextCellV2(candidateOverlay.policyStatus),
        _bomNumericCellV2(candidateOverlay.metrics.unknownObservationCount),
        evaluated === undefined ? "" : escapeBomTextCellV2(evaluated.snapshot.id),
        evaluated === undefined ? "" : _bomNumericCellV2(evaluated.snapshot.schemaVersion),
        evaluated === undefined ? "" : escapeBomTextCellV2(evaluated.snapshot.contentHash),
        evaluated === undefined ? "" : escapeBomTextCellV2(evaluated.distributor),
        evaluated === undefined ? "" : escapeBomTextCellV2(evaluated.distributorSku),
        escapeBomTextCellV2(line.status),
        authorization === undefined ? "" : escapeBomTextCellV2(authorization.providerPolicy.id),
        authorization === undefined ? "" : escapeBomTextCellV2(authorization.providerPolicy.version),
        authorization === undefined ? "" : escapeBomTextCellV2(authorization.providerPolicy.contentHash),
        authorization === undefined ? "" : escapeBomTextCellV2(authorization.attribution.label),
        attributionJson,
        _bomNumericCellV2(line.purchaseQuantity),
        _bomNumericCellV2(line.buildableQuantity),
        _bomNumericCellV2(line.extendedCost?.amount),
        line.extendedCost === undefined ? "" : escapeBomTextCellV2(line.extendedCost.currency),
        _bomNumericCellV2(line.stockQuantity),
        ...observationCells(line.region),
        ...observationCells(line.currency),
        ...observationCells(line.packaging),
        ...observationCells(line.marketplace),
        ...observationCells(line.backorderAvailable),
        ...observationCells(line.lifecycle),
        ...observationCells(line.lifecycleSource),
        ...observationCells(line.leadTimeDays),
        ...observationCells(line.leadTimeKind),
      ];
      if (cells.length !== COMMERCIAL_BOM_V2_COLUMNS.length) throw new Error("Commercial BOM column mismatch");
      return cells.join(",");
    });
    return `${COMMERCIAL_BOM_V2_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
  } catch {
    throw new CommercialDesignExportErrorV2("invalid_overlay");
  }
}
