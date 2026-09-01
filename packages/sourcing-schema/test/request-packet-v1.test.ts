import { describe, expect, it } from "vitest";
import {
  SOURCING_REQUEST_PACKET_MAX_BOM_LINES_V1,
  SOURCING_REQUEST_PACKET_MAX_BYTES_V1,
  SOURCING_REQUEST_PACKET_MAX_TEXT_BYTES_V1,
  SourcingRequestPacketErrorV1,
  calculateSourcingRequestPacketContentHashV1,
  finalizeSourcingRequestPacketV1,
  parseSourcingRequestPacketV1,
  serializeSourcingRequestPacketV1,
  verifySourcingRequestPacketV1,
  type SourcingRequestPacketInputV1,
} from "../src/request-packet-v1";

const hash = (digit: string) => `sha256:${digit.repeat(64)}` as const;

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

function input(): Mutable<SourcingRequestPacketInputV1> {
  return {
    designResultRef: {
      schemaVersion: 2,
      designResultContentHash: hash("1"),
      requestHash: hash("2"),
      libraryVersion: "catalog-2026-08-25",
      libraryContentHash: hash("3"),
    },
    candidateRef: {
      id: `candidate:v2:${hash("4")}`,
      recipeId: "power.buck.external-fet.v1",
    },
    bomLines: [
      { lineId: "switch-b", manufacturerId: "infineon", manufacturerPartNumber: "BSC010N04LS6", quantityPerAssembly: 2 },
      { lineId: "controller", manufacturerId: "ti", manufacturerPartNumber: "LM25149-Q1", quantityPerAssembly: 1 },
    ],
    buildQuantity: 25,
    policy: {
      schemaVersion: 1,
      region: "AU",
      currency: "AUD",
      allowedLifecycle: ["unknown", "active"],
      minimumStock: 50,
      maximumLeadTimeDays: 30,
      allowBackorder: false,
      allowMarketplace: false,
      packaging: ["reel", "cut_tape"],
      maximumSnapshotAgeSeconds: 86_400,
    },
  };
}

function code(action: () => unknown): string | undefined {
  try { action(); }
  catch (error) { return error instanceof SourcingRequestPacketErrorV1 ? error.code : undefined; }
  return undefined;
}

describe("provider-neutral sourcing request packet V1", () => {
  it("sorts the exact BOM and set-like policy values into deterministic content-addressed bytes", () => {
    const request = input();
    const packet = finalizeSourcingRequestPacketV1(request);
    const source = serializeSourcingRequestPacketV1(request);

    expect(packet.bomLines.map((line) => line.lineId)).toEqual(["controller", "switch-b"]);
    expect(packet.policy.allowedLifecycle).toEqual(["active", "unknown"]);
    expect(packet.policy.packaging).toEqual(["cut_tape", "reel"]);
    expect(packet.contentHash).toBe(calculateSourcingRequestPacketContentHashV1(request));
    expect(parseSourcingRequestPacketV1(source)).toEqual(packet);
    expect(verifySourcingRequestPacketV1(source, request)).toEqual(packet);
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.bomLines)).toBe(true);

    const reordered = input();
    reordered.bomLines = [...reordered.bomLines].reverse();
    reordered.policy.allowedLifecycle = [...reordered.policy.allowedLifecycle].reverse();
    expect(serializeSourcingRequestPacketV1(reordered)).toBe(source);
  });

  it("has a closed shape with no provider choice, offers, URLs, credentials, or commercial observations", () => {
    const packet = finalizeSourcingRequestPacketV1(input());
    expect(packet.boundaries).toEqual({
      purpose: "provider_neutral_sourcing_request",
      offers: "not_included",
      providerUrls: "not_included",
      providerSelection: "not_included",
      credentials: "not_included",
      commercialObservations: "not_included",
      providerAccess: "not_authorized",
    });
    expect(packet.policy).not.toHaveProperty("distributors");
    expect(packet.policy).not.toHaveProperty("mode");
    expect(packet).not.toHaveProperty("provider");
    expect(packet).not.toHaveProperty("offers");

    const withProviderChoice = structuredClone(input()) as unknown as Record<string, unknown>;
    (withProviderChoice.policy as Record<string, unknown>).distributors = ["digikey"];
    expect(code(() => finalizeSourcingRequestPacketV1(withProviderChoice as never))).toBe("invalid_input");
    const withOffer = { ...input(), offers: [] };
    expect(code(() => finalizeSourcingRequestPacketV1(withOffer as never))).toBe("invalid_input");
  });

  it("rejects unknown keys at every packet boundary and noncanonical wire bytes", () => {
    const source = serializeSourcingRequestPacketV1(input());
    const packet = JSON.parse(source) as Record<string, unknown>;
    expect(code(() => parseSourcingRequestPacketV1(`${source}\n`))).toBe("invalid_packet");

    for (const mutate of [
      (value: Record<string, unknown>) => { value.unexpected = true; },
      (value: Record<string, unknown>) => { (value.designResultRef as Record<string, unknown>).unexpected = true; },
      (value: Record<string, unknown>) => { ((value.bomLines as Record<string, unknown>[])[0]!).unexpected = true; },
      (value: Record<string, unknown>) => { (value.policy as Record<string, unknown>).provider = "digikey"; },
      (value: Record<string, unknown>) => { (value.boundaries as Record<string, unknown>).offers = "included"; },
    ]) {
      const changed = structuredClone(packet);
      mutate(changed);
      expect(code(() => parseSourcingRequestPacketV1(JSON.stringify(changed)))).toBe("invalid_packet");
    }
  });

  it("rejects a mutated hash and stale-hash MPN or quantity changes", () => {
    const source = serializeSourcingRequestPacketV1(input());
    const packet = JSON.parse(source) as Record<string, unknown>;

    const hashChanged = structuredClone(packet);
    hashChanged.contentHash = hash("f");
    expect(code(() => parseSourcingRequestPacketV1(JSON.stringify(hashChanged)))).toBe("invalid_packet");

    for (const change of [
      (line: Record<string, unknown>) => { line.manufacturerPartNumber = "BSC010N04LS6-TAMPERED"; },
      (line: Record<string, unknown>) => { line.quantityPerAssembly = 3; },
    ]) {
      const changed = structuredClone(packet);
      change((changed.bomLines as Record<string, unknown>[])[0]!);
      expect(code(() => parseSourcingRequestPacketV1(JSON.stringify(changed)))).toBe("invalid_packet");
    }
  });

  it("rejects self-rehashed wrong, missing, or extra lines against exact authoritative input", () => {
    const expected = input();
    const changedMpn = input();
    changedMpn.bomLines = changedMpn.bomLines.map((line) => line.lineId === "controller"
      ? { ...line, manufacturerPartNumber: "LM25149-Q1-WRONG" }
      : line);
    expect(code(() => verifySourcingRequestPacketV1(serializeSourcingRequestPacketV1(changedMpn), expected))).toBe("authority_mismatch");

    const changedQuantity = input();
    changedQuantity.bomLines = changedQuantity.bomLines.map((line) => line.lineId === "controller"
      ? { ...line, quantityPerAssembly: 2 }
      : line);
    expect(code(() => verifySourcingRequestPacketV1(serializeSourcingRequestPacketV1(changedQuantity), expected))).toBe("authority_mismatch");

    const missing = input();
    missing.bomLines = missing.bomLines.slice(0, 1);
    expect(code(() => verifySourcingRequestPacketV1(serializeSourcingRequestPacketV1(missing), expected))).toBe("authority_mismatch");

    const extra = input();
    extra.bomLines = [...extra.bomLines, { lineId: "invented", manufacturerId: "ti", manufacturerPartNumber: "INVENTED", quantityPerAssembly: 1 }];
    expect(code(() => verifySourcingRequestPacketV1(serializeSourcingRequestPacketV1(extra), expected))).toBe("authority_mismatch");
  });

  it("rejects duplicate stable line IDs and fixed count, byte, string, and unit limits", () => {
    const duplicate = input();
    duplicate.bomLines = [...duplicate.bomLines, { ...duplicate.bomLines[0]! }];
    expect(code(() => finalizeSourcingRequestPacketV1(duplicate))).toBe("invalid_input");

    const tooMany = input();
    tooMany.bomLines = Array.from({ length: SOURCING_REQUEST_PACKET_MAX_BOM_LINES_V1 + 1 }, (_, index) => ({
      lineId: `line-${index}`,
      manufacturerId: "ti",
      manufacturerPartNumber: `MPN-${index}`,
      quantityPerAssembly: 1,
    }));
    expect(code(() => finalizeSourcingRequestPacketV1(tooMany))).toBe("resource_limit");

    const longText = input();
    longText.bomLines = [{ ...longText.bomLines[0]!, manufacturerPartNumber: "x".repeat(SOURCING_REQUEST_PACKET_MAX_TEXT_BYTES_V1 + 1) }];
    expect(code(() => finalizeSourcingRequestPacketV1(longText))).toBe("resource_limit");
    expect(code(() => parseSourcingRequestPacketV1(" ".repeat(SOURCING_REQUEST_PACKET_MAX_BYTES_V1 + 1)))).toBe("resource_limit");

    const invalidQuantity = input();
    invalidQuantity.bomLines = [{ ...invalidQuantity.bomLines[0]!, quantityPerAssembly: 0 }];
    expect(code(() => finalizeSourcingRequestPacketV1(invalidQuantity))).toBe("invalid_input");

    const sparse = input();
    sparse.bomLines = new Array(1);
    expect(code(() => finalizeSourcingRequestPacketV1(sparse))).toBe("invalid_input");
  });
});
