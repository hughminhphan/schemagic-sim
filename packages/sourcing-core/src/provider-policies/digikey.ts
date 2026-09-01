import { DISTRIBUTOR_IDS } from "@opencircuit/sourcing-schema";
import {
  PROVIDER_POLICY_SCHEMA_VERSION,
  migrateProviderPolicyManifestV1ToV2,
  type ProviderPolicyManifest,
} from "../provider-policy";

/**
 * Conservative manifest until DigiKey approves the deployment's exact display,
 * caching, export, and public-user behavior. Zero TTL means no API call is
 * permitted by the service composition yet.
 */
export const DIGIKEY_PROVIDER_POLICY = Object.freeze({
  schemaVersion: PROVIDER_POLICY_SCHEMA_VERSION,
  policyId: "schemagic-sourcing:digikey:v1",
  provider: DISTRIBUTOR_IDS.digikey,
  displayName: "DigiKey",
  providerDocumentationUrl: "https://developer.digikey.com/products/product-information-v4/productsearch/productdetails?prod=true",
  state: "disabled_pending_approval",
  authorization: {
    mode: "oauth2",
    credentialLocation: "server_only",
    approval: "pending",
  },
  lookup: {
    exactMpnOnly: true,
    maximumPartsPerRequest: 1,
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
    label: "DigiKey",
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
    "OAuth credentials and refresh tokens remain server-only.",
    "Do not enable requests until written terms approve the intended display and cache behavior.",
    "Normalize only bounded exact-MPN results; never retain raw responses or build a catalog mirror.",
    "ProductDetails accepts one product number per call, so each authorized runtime lookup is limited to one exact manufacturer identity.",
  ],
} as const satisfies ProviderPolicyManifest);

/** Hash-pinned native policy document; still closed pending written approval. */
export const DIGIKEY_PROVIDER_POLICY_V2 = Object.freeze(
  migrateProviderPolicyManifestV1ToV2(DIGIKEY_PROVIDER_POLICY, "2026-08-24"),
);
