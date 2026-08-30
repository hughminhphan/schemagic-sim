import type { ProviderPolicyManifestV2 } from "@opencircuit/sourcing-core";
import type { DistributorId, OfferSnapshotV2 } from "@opencircuit/sourcing-schema";
import type { ProviderLookupContext } from "./provider";
import type { SourcingLookupRequest } from "./request";

/**
 * Native V2 adapters return only closed, content-addressed snapshots. Raw
 * provider responses and credentials remain inside the injected transport.
 */
export interface SourcingProviderAdapterV2 {
  readonly id: DistributorId;
  lookup(
    request: Readonly<SourcingLookupRequest>,
    context: Readonly<ProviderLookupContext>,
  ): Promise<OfferSnapshotV2>;
}

export type ProviderRuntimePolicyV2 = ProviderPolicyManifestV2;
