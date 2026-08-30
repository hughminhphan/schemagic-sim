import { describe, expect, it } from "vitest";
import {
  designRequestHashV2,
  designSha256ContentHash,
  type ElectricalDesignRequestV2,
} from "@opencircuit/design-schema";
import { deflateSync, inflateSync } from "fflate";
import { designerApplications } from "./applications";
import {
  DESIGN_REQUEST_IMPORT_MAX_BYTES,
  DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES,
  DESIGN_REQUEST_SHARE_MAX_ENCODED_CHARACTERS,
  DESIGN_REQUEST_SHARE_MAX_UNCOMPRESSED_BYTES,
  ElectricalDesignRequestTransferError,
  clearElectricalDesignRequestShareFromUrl,
  decodeElectricalDesignRequestShare,
  electricalDesignRequestShareFromHash,
  electricalDesignRequestShareUrl,
  encodeElectricalDesignRequestShare,
  parseElectricalDesignRequestV2Bytes,
  parseElectricalDesignRequestV2Text,
  serializeElectricalDesignRequestV2,
} from "./RequestTransfer";

function requests(): ElectricalDesignRequestV2[] {
  return designerApplications().map((application) => {
    const request = application.presets[0]!.createRequest();
    if (request.schemaVersion !== 2) throw new Error("Expected a production V2 request preset");
    return request;
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

function sharePayload(encoded: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(inflateSync(fromBase64Url(encoded)))) as Record<string, unknown>;
}

function encodedPayload(payload: unknown, whitespace = false): string {
  const source = whitespace ? `${JSON.stringify(payload)}\n` : JSON.stringify(payload);
  return base64Url(deflateSync(new TextEncoder().encode(source), { level: 9 }));
}

function expectTransferError(action: () => unknown, code: ElectricalDesignRequestTransferError["code"]): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ElectricalDesignRequestTransferError);
    expect((error as ElectricalDesignRequestTransferError).code).toBe(code);
  }
}

describe("strict V2 electrical requirements transfer", () => {
  it("round-trips canonical Motor and Power files with separate semantic and byte identities", () => {
    for (const request of requests()) {
      const source = serializeElectricalDesignRequestV2(request);
      const text = parseElectricalDesignRequestV2Text(source);
      const bytes = parseElectricalDesignRequestV2Bytes(new TextEncoder().encode(source));

      expect(text).toEqual(bytes);
      expect(text.request).toEqual(request);
      expect(text.canonicalText).toBe(source);
      expect(text.requestHash).toBe(designRequestHashV2(request));
      expect(text.byteContentHash).toBe(designSha256ContentHash(source));
      expect(serializeElectricalDesignRequestV2(text.request)).toBe(source);
      expect(text.request.schemaVersion).toBe(2);
      expect(Object.keys(text.request).sort()).toEqual([
        "application",
        "assumptions",
        "constraints",
        "format",
        "libraryVersion",
        "objective",
        "requirements",
        "schemaVersion",
      ]);
    }
  });

  it("preserves display units in file bytes while excluding them from semantic request identity", () => {
    const original = requests()[0]!;
    if (original.application !== "motor.brushed-dc") throw new Error("Expected Motor request");
    const changed = structuredClone(original);
    changed.requirements.pwmFrequency.displayUnit = "Hz";

    const originalTransfer = parseElectricalDesignRequestV2Text(serializeElectricalDesignRequestV2(original));
    const changedTransfer = parseElectricalDesignRequestV2Text(serializeElectricalDesignRequestV2(changed));
    if (changedTransfer.request.application !== "motor.brushed-dc") throw new Error("Expected transferred Motor request");
    expect(changedTransfer.request.requirements.pwmFrequency.displayUnit).toBe("Hz");
    expect(changedTransfer.requestHash).toBe(originalTransfer.requestHash);
    expect(changedTransfer.byteContentHash).not.toBe(originalTransfer.byteContentHash);
    expect(changedTransfer.canonicalText).not.toBe(originalTransfer.canonicalText);
  });

  it("round-trips a canonical hash-bound share envelope and replaces only its own hash state", () => {
    for (const request of requests()) {
      const encoded = encodeElectricalDesignRequestShare(request);
      const payload = sharePayload(encoded);
      const decoded = decodeElectricalDesignRequestShare(encoded);

      expect(Object.keys(payload).sort()).toEqual([
        "byteContentHash",
        "format",
        "request",
        "requestHash",
        "schemaVersion",
      ]);
      expect(payload).toMatchObject({
        format: "schemagic-designer-request-share",
        schemaVersion: 1,
        request: decoded.canonicalText,
        requestHash: decoded.requestHash,
        byteContentHash: decoded.byteContentHash,
      });
      expect(decodeElectricalDesignRequestShare(encoded)).toEqual(decoded);
      expect(electricalDesignRequestShareFromHash(`#r=${encoded}`)).toEqual(decoded);
      expect(electricalDesignRequestShareUrl(request, { href: "https://schemagic.test/?designer#d=old" }))
        .toBe(`https://schemagic.test/?designer#r=${encoded}`);
      expect(clearElectricalDesignRequestShareFromUrl({ href: `https://schemagic.test/?designer#r=${encoded}` }))
        .toBe("https://schemagic.test/?designer");
    }
  });

  it("rejects V1, V3, result, sourcing-bearing, and extra-field shapes without migration", () => {
    const request = requests()[0]!;
    const invalid = [
      { ...structuredClone(request), schemaVersion: 1 },
      { ...structuredClone(request), schemaVersion: 3, constraintPolicy: "production_strict_v1" },
      { format: "schemagic-design-result", schemaVersion: 2, request },
      { ...structuredClone(request), sourcing: { mode: "any" } },
      { ...structuredClone(request), unexpected: true },
    ];
    for (const value of invalid) {
      expectTransferError(() => parseElectricalDesignRequestV2Text(JSON.stringify(value)), "invalid_request");
    }
  });

  it("rejects malformed, noncanonical, duplicate-key, fatal-UTF8, and oversized files", () => {
    const source = serializeElectricalDesignRequestV2(requests()[0]!);
    expectTransferError(() => parseElectricalDesignRequestV2Text("{"), "invalid_request");
    expectTransferError(() => parseElectricalDesignRequestV2Text(`${source}\n`), "invalid_request");
    expectTransferError(
      () => parseElectricalDesignRequestV2Text(`{"format":"wrong",${source.slice(1)}`),
      "invalid_request",
    );
    expectTransferError(() => parseElectricalDesignRequestV2Bytes(Uint8Array.from([0xc3, 0x28])), "invalid_request");
    expectTransferError(
      () => parseElectricalDesignRequestV2Bytes(new Uint8Array(DESIGN_REQUEST_IMPORT_MAX_BYTES + 1)),
      "resource_limit",
    );
  });

  it("rejects malformed, noncanonical, hash-tampered, oversized, duplicate-r, and dual d+r shares", () => {
    const encoded = encodeElectricalDesignRequestShare(requests()[0]!);
    const payload = sharePayload(encoded);
    expectTransferError(() => decodeElectricalDesignRequestShare("%%%"), "invalid_share");
    expectTransferError(() => decodeElectricalDesignRequestShare(`${encoded}A`), "invalid_share");
    expectTransferError(() => decodeElectricalDesignRequestShare(encodedPayload(payload, true)), "invalid_share");
    expectTransferError(
      () => decodeElectricalDesignRequestShare(encodedPayload({ ...payload, requestHash: `sha256:${"0".repeat(64)}` })),
      "invalid_share",
    );
    expectTransferError(
      () => decodeElectricalDesignRequestShare(encodedPayload({ ...payload, byteContentHash: `sha256:${"0".repeat(64)}` })),
      "invalid_share",
    );
    expectTransferError(
      () => decodeElectricalDesignRequestShare("A".repeat(DESIGN_REQUEST_SHARE_MAX_ENCODED_CHARACTERS + 1)),
      "resource_limit",
    );
    expectTransferError(
      () => decodeElectricalDesignRequestShare(base64Url(new Uint8Array(DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES + 1))),
      "resource_limit",
    );
    expectTransferError(
      () => decodeElectricalDesignRequestShare(base64Url(deflateSync(
        new Uint8Array(DESIGN_REQUEST_SHARE_MAX_UNCOMPRESSED_BYTES + 1),
        { level: 9 },
      ))),
      "resource_limit",
    );
    expectTransferError(() => electricalDesignRequestShareFromHash(`#r=${encoded}&r=${encoded}`), "invalid_share");
    expectTransferError(() => electricalDesignRequestShareFromHash(`#d=result&r=${encoded}`), "invalid_share");
    expectTransferError(() => electricalDesignRequestShareFromHash(`#r=${encoded}&extra=1`), "invalid_share");
  });
});
