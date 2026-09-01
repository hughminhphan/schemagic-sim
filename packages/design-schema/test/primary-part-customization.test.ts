import { describe, expect, it } from "vitest";
import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import {
  PRIMARY_PART_CUSTOMIZATION_MAX_BYTES,
  PrimaryPartCustomizationTransferError,
  canonicalDesignV2Payload,
  calculatePrimaryPartCustomizationContentHash,
  canonicalPrimaryPartCustomizationPayload,
  createPrimaryPartCustomizationSidecarV1,
  parsePrimaryPartCustomizationSidecarV1Bytes,
  parsePrimaryPartCustomizationSidecarV1Text,
  serializePrimaryPartCustomizationSidecarV1,
  serializePrimaryPartCustomizationSidecarV1Bytes,
  type PrimaryPartCustomizationDraftV1,
} from "../src";

const hash = (digit: string): Sha256ContentHash => `sha256:${digit.repeat(64)}` as Sha256ContentHash;

function draft(): PrimaryPartCustomizationDraftV1 {
  return {
    format: "schemagic-designer-primary-part-customization",
    schemaVersion: 1,
    application: "motor.brushed-dc",
    requestHash: hash("1"),
    requestByteContentHash: hash("7"),
    sourceResultContentHash: hash("a"),
    sourceCandidateId: `candidate:v2:${hash("b")}`,
    context: {
      libraryVersion: "2026-08-24.14",
      contextManifestContentHash: hash("2"),
      catalog: {
        version: "2026-08-24.14",
        contentHash: hash("3"),
        sourceReleaseContentHash: hash("4"),
      },
      recipe: {
        id: "motor.native.external-nmos-h-bridge.facts-v3-1",
        version: "3.1.1",
        contentHash: hash("5"),
      },
      constraintPolicy: {
        id: "production_strict_v1",
        contentHash: hash("6"),
      },
    },
    substitution: {
      role: "primary",
      sourceProfile: {
        profileId: "packages/design-library/parts/shared.n-channel-power-mosfet/vendor/OLD.json",
        contentHash: hash("8"),
      },
      targetProfile: {
        profileId: "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json",
        contentHash: hash("9"),
      },
    },
  };
}

function expectTransferError(action: () => unknown, code: PrimaryPartCustomizationTransferError["code"]): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(PrimaryPartCustomizationTransferError);
    expect((error as PrimaryPartCustomizationTransferError).code).toBe(code);
  }
}

describe("primary-part customization sidecar transfer", () => {
  it("round-trips one deterministic exact-context substitution through canonical UTF-8 bytes", () => {
    const sidecar = createPrimaryPartCustomizationSidecarV1(draft());
    const source = serializePrimaryPartCustomizationSidecarV1(sidecar);
    const bytes = serializePrimaryPartCustomizationSidecarV1Bytes(sidecar);
    const fromText = parsePrimaryPartCustomizationSidecarV1Text(source);
    const fromBytes = parsePrimaryPartCustomizationSidecarV1Bytes(bytes);

    expect(fromBytes).toEqual(fromText);
    expect(fromText.sidecar).toEqual(sidecar);
    expect(fromText.canonicalText).toBe(source);
    expect(new TextDecoder().decode(bytes)).toBe(source);
    expect(source).toBe(canonicalDesignV2Payload(JSON.parse(source)));
    expect(sidecar.contentHash).toBe(calculatePrimaryPartCustomizationContentHash(sidecar));
    expect(sidecar.contentHash).toBe("sha256:f69c7603d0f77c198ea84b361a8d5dc151325479b9e48bbe3c214610167da959");
    expect(JSON.parse(canonicalPrimaryPartCustomizationPayload(sidecar))).not.toHaveProperty("contentHash");
    expect(Object.isFrozen(sidecar)).toBe(true);
    expect(Object.isFrozen(sidecar.context.catalog)).toBe(true);
    expect(Object.isFrozen(sidecar.substitution.sourceProfile)).toBe(true);
    expect(Object.isFrozen(sidecar.substitution.targetProfile)).toBe(true);
  });

  it("binds every request, library, catalog, recipe, policy, and profile identity into the content hash", () => {
    const original = draft();
    const mutations: PrimaryPartCustomizationDraftV1[] = [
      { ...original, requestHash: hash("a") },
      { ...original, requestByteContentHash: hash("f") },
      { ...original, sourceResultContentHash: hash("f") },
      { ...original, sourceCandidateId: `candidate:v2:${hash("f")}` },
      { ...original, application: "power.buck" },
      {
        ...original,
        context: {
          ...original.context,
          libraryVersion: "other-library",
          catalog: { ...original.context.catalog, version: "other-library" },
        },
      },
      { ...original, context: { ...original.context, contextManifestContentHash: hash("b") } },
      { ...original, context: { ...original.context, catalog: { ...original.context.catalog, contentHash: hash("c") } } },
      { ...original, context: { ...original.context, recipe: { ...original.context.recipe, contentHash: hash("d") } } },
      { ...original, context: { ...original.context, constraintPolicy: { ...original.context.constraintPolicy, contentHash: hash("e") } } },
      {
        ...original,
        substitution: {
          ...original.substitution,
          sourceProfile: { ...original.substitution.sourceProfile, contentHash: hash("e") },
        },
      },
      {
        ...original,
        substitution: {
          ...original.substitution,
          targetProfile: {
            ...original.substitution.targetProfile,
            profileId: "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B_ALT.json",
          },
        },
      },
      {
        ...original,
        substitution: {
          ...original.substitution,
          targetProfile: { ...original.substitution.targetProfile, contentHash: hash("0") },
        },
      },
    ];
    const expected = createPrimaryPartCustomizationSidecarV1(original).contentHash;
    expect(new Set(mutations.map((value) => createPrimaryPartCustomizationSidecarV1(value).contentHash)).has(expected)).toBe(false);
  });

  it("rejects noncanonical bytes, malformed UTF-8, oversized input, and hash tampering", () => {
    const sidecar = createPrimaryPartCustomizationSidecarV1(draft());
    const source = serializePrimaryPartCustomizationSidecarV1(sidecar);
    expectTransferError(() => parsePrimaryPartCustomizationSidecarV1Text(`${source}\n`), "invalid_customization");
    expectTransferError(() => parsePrimaryPartCustomizationSidecarV1Text("{"), "invalid_customization");
    expectTransferError(
      () => parsePrimaryPartCustomizationSidecarV1Bytes(Uint8Array.from([0xc3, 0x28])),
      "invalid_customization",
    );
    expectTransferError(
      () => parsePrimaryPartCustomizationSidecarV1Bytes(Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(source)])),
      "invalid_customization",
    );
    expectTransferError(
      () => parsePrimaryPartCustomizationSidecarV1Bytes(new Uint8Array(PRIMARY_PART_CUSTOMIZATION_MAX_BYTES + 1)),
      "resource_limit",
    );
    expectTransferError(
      () => parsePrimaryPartCustomizationSidecarV1Text("x".repeat(PRIMARY_PART_CUSTOMIZATION_MAX_BYTES + 1)),
      "resource_limit",
    );
    expectTransferError(
      () => parsePrimaryPartCustomizationSidecarV1Text(JSON.stringify({ ...sidecar, contentHash: hash("0") })),
      "invalid_customization",
    );
  });

  it("keeps the schema closed and cannot transport facts or commercial/simulation trust", () => {
    const sidecar = createPrimaryPartCustomizationSidecarV1(draft());
    const invalid: unknown[] = [
      { ...sidecar, electricalFacts: { drainSourceVoltage: 60 } },
      { ...sidecar, commercialTrust: "authorized" },
      { ...sidecar, simulationTrust: "validated" },
      { ...sidecar, generation: { requested: true } },
      { ...sidecar, sourceCandidateId: "candidate:v2:invalid" },
      { ...sidecar, context: { ...sidecar.context, unexpected: true } },
      { ...sidecar, context: { ...sidecar.context, catalog: { ...sidecar.context.catalog, profiles: [] } } },
      { ...sidecar, substitution: { ...sidecar.substitution, role: "secondary" } },
      { ...sidecar, substitution: { ...sidecar.substitution, electricalFacts: {} } },
      {
        ...sidecar,
        substitution: {
          ...sidecar.substitution,
          targetProfile: { ...sidecar.substitution.targetProfile, profileId: "not-a-profile-id" },
        },
      },
      {
        ...sidecar,
        substitution: {
          ...sidecar.substitution,
          targetProfile: {
            ...sidecar.substitution.targetProfile,
            profileId: "packages/design-library/parts/shared.mlcc-capacitor/vendor/C.json",
          },
        },
      },
    ];
    for (const value of invalid) {
      expectTransferError(() => parsePrimaryPartCustomizationSidecarV1Text(JSON.stringify(value)), "invalid_customization");
    }
  });

  it("rejects a no-op substitution and non-production policy identifiers", () => {
    const input = draft();
    expectTransferError(
      () => createPrimaryPartCustomizationSidecarV1({
        ...input,
        substitution: {
          ...input.substitution,
          targetProfile: {
            ...input.substitution.targetProfile,
            profileId: input.substitution.sourceProfile.profileId,
          },
        },
      }),
      "invalid_customization",
    );
    expectTransferError(
      () => createPrimaryPartCustomizationSidecarV1({
        ...input,
        context: {
          ...input.context,
          constraintPolicy: { ...input.context.constraintPolicy, id: "permissive" as "production_strict_v1" },
        },
      }),
      "invalid_customization",
    );
  });
});
