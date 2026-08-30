import {
  exportPrimaryPartCustomizedArtifactV1,
  verifyPrimaryPartCustomizedArtifactV1,
  type PrimaryPartCustomizedArtifactV1,
} from "../../../../../packages/design-export/src/primary-part-customized-artifact-v1";
import {
  _exportPrimaryPartCustomizedInstalledArtifactV1,
  _verifyPrimaryPartCustomizedInstalledArtifactV1,
} from "../../../../../packages/design-export/src/primary-part-customized-installed-artifact-v1";
import {
  CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1,
  createCustomizedTargetInspectionReceiptV1,
  parseCustomizedTargetInspectionReceiptV1Bytes,
  serializeCustomizedTargetInspectionReceiptV1,
  verifyCustomizedTargetInspectionReceiptV1,
  type CustomizedTargetInspectionReceiptV1,
} from "../../../../../packages/design-export/src/customized-target-inspection-receipt-v1";
import {
  _consumeAuthorizedPrimaryPartCustomizedFileRequestV1,
  type AuthorizedPrimaryPartCustomizedFileKindV1,
} from "./applications";

interface AuthorizedCustomizedTargetInspectionReceiptFileV1 {
  readonly kind: "customized_target_inspection_receipt";
  readonly filename: string;
  readonly mimeType: "application/json;charset=utf-8";
  readonly content: string;
}

export type AuthorizedPrimaryPartCustomizedFileV1 =
  | PrimaryPartCustomizedArtifactV1
  | AuthorizedCustomizedTargetInspectionReceiptFileV1;

const REPLAYABLE_KINDS = Object.freeze([
  "customized_target_electrical_bom_csv",
  "customized_target_structural_svg",
] as const);

const INSTALLED_KINDS = Object.freeze([
  "customized_target_engineering_report_html",
  "customized_target_structural_kicad",
  "customized_target_behavioral_scenario_spice",
] as const);

function includesKind(
  values: readonly string[],
  kind: AuthorizedPrimaryPartCustomizedFileKindV1,
): boolean {
  return values.includes(kind);
}

/**
 * The only production renderer entry point. Its opaque, single-use token is
 * minted by the installed application boundary and cannot be registered here.
 */
export function exportAuthorizedPrimaryPartCustomizedFileV1(
  authorizationToken: unknown,
): AuthorizedPrimaryPartCustomizedFileV1 {
  const request = _consumeAuthorizedPrimaryPartCustomizedFileRequestV1(authorizationToken);
  if (request.kind === "customized_target_inspection_receipt") {
    if (request.installedArtifactContext !== undefined) {
      throw new Error("Customized-target receipt authorization was context-mismatched");
    }
    const receipt = verifyCustomizedTargetInspectionReceiptV1(
      createCustomizedTargetInspectionReceiptV1(request.asserted),
    );
    const content = serializeCustomizedTargetInspectionReceiptV1(receipt);
    if (new TextEncoder().encode(content).byteLength
      > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1) {
      throw new Error("Customized-target inspection receipt exceeds the installed byte limit");
    }
    return Object.freeze({
      kind: "customized_target_inspection_receipt",
      filename: `schemagic-${request.asserted.application.replaceAll(".", "-")}-${receipt.contentHash.slice(7, 19)}-customized-target-inspection-receipt-v1.json`,
      mimeType: "application/json;charset=utf-8",
      content,
    });
  }
  if (includesKind(REPLAYABLE_KINDS, request.kind)) {
    if (request.installedArtifactContext !== undefined) {
      throw new Error("Customized-target replayable artifact authorization was context-mismatched");
    }
    const kind = request.kind as (typeof REPLAYABLE_KINDS)[number];
    const artifact = exportPrimaryPartCustomizedArtifactV1(request.asserted, kind);
    verifyPrimaryPartCustomizedArtifactV1(artifact, request.asserted);
    return artifact;
  }
  if (includesKind(INSTALLED_KINDS, request.kind)) {
    if (request.installedArtifactContext === undefined) {
      throw new Error("Customized-target installed artifact authorization requires exact context");
    }
    const kind = request.kind as (typeof INSTALLED_KINDS)[number];
    const artifact = _exportPrimaryPartCustomizedInstalledArtifactV1(
      request.asserted,
      kind,
      request.installedArtifactContext,
    );
    _verifyPrimaryPartCustomizedInstalledArtifactV1(
      artifact,
      request.asserted,
      request.installedArtifactContext,
    );
    return artifact;
  }
  throw new Error("Customized-target file authorization kind was unsupported");
}

/**
 * Portable receipt verification returns only its sidecar and descriptors. It
 * renders no payload and cannot register the returned sidecar as authorized.
 */
export function verifyCustomizedTargetInspectionReceiptBytesV1(
  receiptBytes: Uint8Array,
): Readonly<CustomizedTargetInspectionReceiptV1> {
  if (!(receiptBytes instanceof Uint8Array)
    || receiptBytes.byteLength > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1) {
    throw new Error("Customized-target inspection receipt requires bounded exact bytes");
  }
  return verifyCustomizedTargetInspectionReceiptV1(
    parseCustomizedTargetInspectionReceiptV1Bytes(receiptBytes),
  );
}
