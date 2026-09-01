import {
  parseSourcingRequestPacketV1,
  serializeSourcingRequestPacketV1,
  type SourcingRequestPacketInputV1,
} from "@opencircuit/sourcing-schema/request-packet-v1";
import { describe, expect, it } from "vitest";
import type { DesignerSourcingRequestPacketArtifactV1 } from "./contracts";
import {
  renderSourcingRequestTransferV1,
  verifyExactSourcingRequestPacketArtifactV1,
} from "./SourcingRequestTransfer";

const candidateId = "candidate:v2:sha256:0000000000000000000000000000000000000000000000000000000000000000" as const;
const contentHash = "sha256:1111111111111111111111111111111111111111111111111111111111111111" as const;
const exactInput = Object.freeze({
  designResultRef: {
    schemaVersion: 2,
    designResultContentHash: contentHash,
    requestHash: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    libraryVersion: "reviewed-2026-08-25",
    libraryContentHash: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
  },
  candidateRef: { id: candidateId, recipeId: "power.native.fixture" },
  bomLines: [{
    lineId: "primary",
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "TPS54302DDCR",
    quantityPerAssembly: 1,
  }],
  buildQuantity: 25,
  policy: {
    schemaVersion: 1,
    region: "AU",
    currency: "AUD",
    allowedLifecycle: ["active"],
    allowBackorder: false,
    allowMarketplace: false,
    maximumSnapshotAgeSeconds: 3_600,
  },
} as const satisfies SourcingRequestPacketInputV1);

function artifactFor(
  input: Readonly<SourcingRequestPacketInputV1>,
): DesignerSourcingRequestPacketArtifactV1 {
  const content = serializeSourcingRequestPacketV1(input);
  return {
    kind: "provider_neutral_sourcing_request_packet",
    filename: "schemagic-power-buck-fixture-sourcing-request-v1.json",
    mimeType: "application/json;charset=utf-8",
    content,
    packet: parseSourcingRequestPacketV1(content),
  };
}

describe("provider-neutral sourcing request transfer view", () => {
  it("renders only visible local packet inputs and an explicit no-authority boundary", () => {
    const html = renderSourcingRequestTransferV1({
      candidateId,
      buildQuantity: 25,
      region: "AU<&",
      currency: "AUD",
      busy: false,
    });
    expect(html).toContain("EXACT BOM · PROVIDER-NEUTRAL TRANSFER");
    expect(html).toContain('data-sourcing-request-form');
    expect(html).toContain('data-sourcing-request-build-quantity');
    expect(html).toContain('value="25"');
    expect(html).toContain('value="AU&lt;&amp;"');
    expect(html).toContain('value="AUD"');
    expect(html).toContain('data-sourcing-request-download');
    expect(html).toContain("includes no provider access authority or network destination and adds no app/provider snapshot persistence, ranking, or commercial evaluation");
    expect(html).toContain("no offers, provider URLs or selection, credentials, commercial observations, ranking evidence, eligibility evidence, or provider authorization");
    expect(html).not.toContain("AU<&");
    expect(html).not.toContain("data-production-export");
    expect(html).not.toContain("data-lcsc-search");
    expect(html).not.toContain("Commercial export");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("exposes one coherent busy state", () => {
    const html = renderSourcingRequestTransferV1({
      candidateId,
      buildQuantity: 1,
      region: "US",
      currency: "USD",
      busy: true,
    });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Preparing exact packet…");
    expect(html.match(/ disabled/g)).toHaveLength(4);
  });

  it("accepts packet bytes regenerated from the exact result, candidate, BOM, and policy", async () => {
    const artifact = artifactFor(exactInput);
    await expect(verifyExactSourcingRequestPacketArtifactV1(artifact, exactInput))
      .resolves.toEqual(artifact.packet);
  });

  it("rejects a separately self-rehashed changed MPN", async () => {
    const forgedInput = {
      ...exactInput,
      bomLines: [{
        ...exactInput.bomLines[0],
        manufacturerPartNumber: "FORGED-MPN",
      }],
    } satisfies SourcingRequestPacketInputV1;
    await expect(verifyExactSourcingRequestPacketArtifactV1(artifactFor(forgedInput), exactInput))
      .rejects.toMatchObject({ code: "authority_mismatch" });
  });

  it("rejects a separately self-rehashed changed quantity", async () => {
    const forgedInput = {
      ...exactInput,
      bomLines: [{
        ...exactInput.bomLines[0],
        quantityPerAssembly: 2,
      }],
    } satisfies SourcingRequestPacketInputV1;
    await expect(verifyExactSourcingRequestPacketArtifactV1(artifactFor(forgedInput), exactInput))
      .rejects.toMatchObject({ code: "authority_mismatch" });
  });

  it("rejects a content and parsed-packet split before the route can download it", async () => {
    const exactArtifact = artifactFor(exactInput);
    const splitArtifact = {
      ...exactArtifact,
      packet: artifactFor({
        ...exactInput,
        buildQuantity: exactInput.buildQuantity + 1,
      }).packet,
    };
    await expect(verifyExactSourcingRequestPacketArtifactV1(splitArtifact, exactInput))
      .rejects.toThrow("context-mismatched sourcing request packet");
  });
});
