import { DISTRIBUTOR_IDS } from "@opencircuit/sourcing-schema";
import {
  PROVIDER_POLICY_SCHEMA_VERSION,
  migrateProviderPolicyManifestV1ToV2,
  type ProviderPolicyManifest,
} from "../provider-policy";

/**
 * Conservative manifest until Mouser issues access and approves the intended
 * display, caching, export, and public-user behavior.
 */
export const MOUSER_PROVIDER_POLICY = Object.freeze({
  schemaVersion: PROVIDER_POLICY_SCHEMA_VERSION,
  policyId: "schemagic-sourcing:mouser:v1",
  provider: DISTRIBUTOR_IDS.mouser,
  displayName: "Mouser",
  providerDocumentationUrl: "https://www.mouser.com/en/api-search/",
  state: "disabled_pending_approval",
  authorization: {
    mode: "api_key",
    credentialLocation: "server_only",
    approval: "pending",
  },
  lookup: {
    exactMpnOnly: true,
    maximumPartsPerRequest: 10,
    bulkCaptureAllowed: false,
    timeoutMilliseconds: 8_000,
  },
  rateLimit: {
    state: "unconfigured",
  },
  cache: {
    maximumTtlSeconds: 0,
    staleIfErrorSeconds: 0,
  },
  attribution: {
    required: true,
    label: "Mouser",
  },
  persistence: {
    allowedSnapshotPersistence: ["ephemeral"],
    browserStorageAllowed: false,
    publicShareAllowed: false,
    exportAllowed: false,
    deleteAfterSeconds: 0,
  },
  availability: {
    publicHosted: "disabled_pending_approval",
    selfHosted: "disabled_pending_approval",
  },
  notes: [
    "The API key remains server-only.",
    "Do not enable requests until issued limits and written terms are recorded.",
    "Normalize only bounded exact-MPN results; never retain raw responses or build a catalog mirror.",
    "The V2 part-number request documents a maximum of ten pipe-separated values; the adapter also requires one provider-listed manufacturer name.",
  ],
} as const satisfies ProviderPolicyManifest);

/** Hash-pinned native policy document; still closed pending written approval. */
export const MOUSER_PROVIDER_POLICY_V2 = Object.freeze(
  migrateProviderPolicyManifestV1ToV2(MOUSER_PROVIDER_POLICY, "2026-08-24"),
);
