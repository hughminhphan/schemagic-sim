import { describe, expect, it } from "vitest";
import {
  canonicalDesignResultV2ContentHash,
  createPrimaryPartCustomizationSidecarV1,
  designRequestHashV2,
  designSha256ContentHash,
  type DesignResultV2,
  type ElectricalDesignRequestV2,
  type PrimaryPartCustomizationSidecarV1,
  type Sha256ContentHash,
} from "@opencircuit/design-schema";
import { deflateSync, inflateSync } from "fflate";
import { designerApplications } from "./applications";
import { parseDesignerShareState, DesignerShareStateError } from "./DesignerShareState";
import {
  PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_ENCODED_CHARACTERS,
  PrimaryPartCustomizationTransferError,
  assertPrimaryPartCustomizationRequestBinding,
  clearPrimaryPartCustomizationShareFromUrl,
  decodePrimaryPartCustomizationShare,
  encodePrimaryPartCustomizationShare,
  parsePrimaryPartCustomizationFileV1Bytes,
  parsePrimaryPartCustomizationFileV1Text,
  primaryPartCustomizationShareUrl,
  serializePrimaryPartCustomizationFileV1,
} from "./PrimaryPartCustomizationTransfer";
import {
  encodeElectricalDesignRequestShare,
  serializeElectricalDesignRequestV2,
} from "./RequestTransfer";
import { encodeImportedDesignResultShare } from "./ResultShare";

const hash = (character: string): Sha256ContentHash => (
  `sha256:${character.repeat(64)}` as Sha256ContentHash
);

function request(): ElectricalDesignRequestV2 {
  const value = designerApplications()[0]!.presets[0]!.createRequest();
  if (value.schemaVersion !== 2) throw new Error("Expected a V2 request");
  return value;
}

function instruction(boundRequest = request()): PrimaryPartCustomizationSidecarV1 {
  return createPrimaryPartCustomizationSidecarV1({
    format: "schemagic-designer-primary-part-customization",
    schemaVersion: 1,
    application: "motor.brushed-dc",
    requestHash: designRequestHashV2(boundRequest),
    requestByteContentHash: designSha256ContentHash(serializeElectricalDesignRequestV2(boundRequest)),
    sourceResultContentHash: hash("a"),
    sourceCandidateId: `candidate:v2:${hash("b")}`,
    context: {
      libraryVersion: "reviewed-release",
      contextManifestContentHash: hash("c"),
      catalog: {
        version: "reviewed-release",
        contentHash: hash("d"),
        sourceReleaseContentHash: hash("e"),
      },
      recipe: { id: "motor.native.integrated", version: "1", contentHash: hash("f") },
      constraintPolicy: { id: "production_strict_v1", contentHash: hash("1") },
    },
    substitution: {
      role: "primary",
      sourceProfile: {
        profileId: "packages/design-library/parts/motor.integrated-h-bridge/st/OLD.json",
        contentHash: hash("2"),
      },
      targetProfile: {
        profileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/NEW.json",
        contentHash: hash("3"),
      },
    },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function encodedPayload(payload: unknown, whitespace = false): string {
  return base64Url(deflateSync(new TextEncoder().encode(
    whitespace ? `${JSON.stringify(payload)}\n` : JSON.stringify(payload),
  ), { level: 9 }));
}

function sharePayload(encoded: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(inflateSync(fromBase64Url(encoded)))) as Record<string, unknown>;
}

function emptyResult(boundRequest: ElectricalDesignRequestV2): DesignResultV2 {
  const payload: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: boundRequest,
    requestHash: designRequestHashV2(boundRequest),
    libraryVersion: boundRequest.libraryVersion,
    libraryContentHash: hash("4"),
    candidates: [],
    rejectedCandidates: [],
    diagnostics: ["design.no_supported_recipe"],
  };
  return { ...payload, contentHash: canonicalDesignResultV2ContentHash(payload) };
}

function expectError(run: () => unknown, code: PrimaryPartCustomizationTransferError["code"]): void {
  try { run(); throw new Error(`Expected ${code}`); }
  catch (error) {
    expect(error).toBeInstanceOf(PrimaryPartCustomizationTransferError);
    expect((error as PrimaryPartCustomizationTransferError).code).toBe(code);
  }
}

describe("primary-part customization browser transfer", () => {
  it("round-trips exact canonical file bytes and rejects noncanonical or fatal UTF-8 input", () => {
    const sidecar = instruction();
    const source = serializePrimaryPartCustomizationFileV1(sidecar);
    expect(parsePrimaryPartCustomizationFileV1Text(source).sidecar).toEqual(sidecar);
    expect(parsePrimaryPartCustomizationFileV1Bytes(new TextEncoder().encode(source)).canonicalText).toBe(source);
    expectError(() => parsePrimaryPartCustomizationFileV1Text(`${source}\n`), "invalid_customization");
    expectError(
      () => parsePrimaryPartCustomizationFileV1Bytes(Uint8Array.from([0xc3, 0x28])),
      "invalid_customization",
    );
  });

  it("round-trips a canonical c envelope and binds it to exact r request bytes", () => {
    const boundRequest = request();
    const sidecar = instruction(boundRequest);
    const encoded = encodePrimaryPartCustomizationShare(sidecar);
    expect(decodePrimaryPartCustomizationShare(encoded).sidecar).toEqual(sidecar);
    expect(sharePayload(encoded)).toMatchObject({
      format: "schemagic-designer-primary-part-customization-share",
      schemaVersion: 1,
      customization: serializePrimaryPartCustomizationFileV1(sidecar),
      contentHash: sidecar.contentHash,
    });
    expect(primaryPartCustomizationShareUrl(boundRequest, sidecar, {
      href: "https://schemagic.test/?designer#d=old",
    })).toBe(`https://schemagic.test/?designer#r=${encodeElectricalDesignRequestShare(boundRequest)}&c=${encoded}`);
    expect(clearPrimaryPartCustomizationShareFromUrl({
      href: `https://schemagic.test/?designer#r=${encodeElectricalDesignRequestShare(boundRequest)}&c=${encoded}`,
    })).toBe(`https://schemagic.test/?designer#r=${encodeElectricalDesignRequestShare(boundRequest)}`);

    const displayChanged = structuredClone(boundRequest);
    if (displayChanged.application !== "motor.brushed-dc") throw new Error("Expected Motor request");
    displayChanged.requirements.pwmFrequency.displayUnit = "Hz";
    expect(designRequestHashV2(displayChanged)).toBe(sidecar.requestHash);
    expectError(() => assertPrimaryPartCustomizationRequestBinding(sidecar, displayChanged), "request_mismatch");
  });

  it("rejects malformed, noncanonical, tampered, and oversized c envelopes", () => {
    const encoded = encodePrimaryPartCustomizationShare(instruction());
    const payload = sharePayload(encoded);
    expectError(() => decodePrimaryPartCustomizationShare("%%%"), "invalid_share");
    expectError(() => decodePrimaryPartCustomizationShare(`${encoded}A`), "invalid_share");
    expectError(() => decodePrimaryPartCustomizationShare(encodedPayload(payload, true)), "invalid_share");
    expectError(() => decodePrimaryPartCustomizationShare(encodedPayload({
      ...payload,
      contentHash: hash("0"),
    })), "invalid_share");
    expectError(
      () => decodePrimaryPartCustomizationShare("A".repeat(
        PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_ENCODED_CHARACTERS + 1,
      )),
      "resource_limit",
    );
  });

  it("accepts only empty, d, r, and exact r+c route hash states", () => {
    const boundRequest = request();
    const sidecar = instruction(boundRequest);
    const r = encodeElectricalDesignRequestShare(boundRequest);
    const c = encodePrimaryPartCustomizationShare(sidecar);
    const d = encodeImportedDesignResultShare({
      result: emptyResult(boundRequest),
      trust: "structurally_valid",
    });
    expect(parseDesignerShareState("")).toEqual({ kind: "empty" });
    expect(parseDesignerShareState(`#r=${r}`)).toMatchObject({ kind: "request" });
    expect(parseDesignerShareState(`#r=${r}&c=${c}`)).toMatchObject({
      kind: "request",
      customization: { contentHash: sidecar.contentHash },
    });
    expect(parseDesignerShareState(`#d=${d}`)).toMatchObject({ kind: "result" });
    for (const hashState of [
      `#c=${c}`,
      `#d=${d}&r=${r}`,
      `#d=${d}&c=${c}`,
      `#d=${d}&r=${r}&c=${c}`,
      `#r=${r}&r=${r}`,
      `#r=${r}&c=${c}&c=${c}`,
      `#r=${r}&unknown=1`,
    ]) expect(() => parseDesignerShareState(hashState)).toThrow(DesignerShareStateError);
  });
});
