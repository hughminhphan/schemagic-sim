import type {
  RegistrySubcircuitAsset,
  TrustedSubcircuitRef,
  TrustedSubcircuitRegistry,
} from "@opencircuit/circuit-schema";
import { GENERATED_TRUSTED_SUBCIRCUITS } from "./generated/trusted-subcircuits";

export interface TrustedSubcircuitDescriptor {
  readonly packageId: string;
  readonly ref: Readonly<TrustedSubcircuitRef>;
  readonly symbolPinOrder: readonly string[];
}

interface RegistryRecord {
  descriptor: TrustedSubcircuitDescriptor;
  asset: Readonly<RegistrySubcircuitAsset>;
}

function refKey(assetId: string, contentHash: string, entrypoint: string): string {
  return `${assetId}\0${contentHash}\0${entrypoint}`;
}

function freezeRef(ref: TrustedSubcircuitRef): Readonly<TrustedSubcircuitRef> {
  return Object.freeze({ assetId: ref.assetId, contentHash: ref.contentHash, entrypoint: ref.entrypoint });
}

const records = GENERATED_TRUSTED_SUBCIRCUITS.map((generated): RegistryRecord => {
  const ref = freezeRef(generated.ref);
  const descriptor = Object.freeze({
    packageId: generated.packageId,
    ref,
    symbolPinOrder: Object.freeze([...generated.symbolPinOrder]),
  });
  const asset = Object.freeze({ ref, canonicalText: generated.canonicalText });
  return Object.freeze({ descriptor, asset });
});

const byPackageId = new Map(records.map((record) => [record.descriptor.packageId, record]));
const byExactRef = new Map(records.map((record) => [
  refKey(record.asset.ref.assetId, record.asset.ref.contentHash, record.asset.ref.entrypoint),
  record,
]));

export const TRUSTED_SUBCIRCUIT_PACKAGE_IDS: readonly string[] = Object.freeze(
  records.map((record) => record.descriptor.packageId),
);

export function trustedSubcircuitDescriptor(packageId: string): TrustedSubcircuitDescriptor | undefined {
  return byPackageId.get(packageId)?.descriptor;
}

export const trustedSubcircuitRegistry: TrustedSubcircuitRegistry = Object.freeze({
  resolve(ref: TrustedSubcircuitRef): RegistrySubcircuitAsset | undefined {
    let assetId: unknown;
    let contentHash: unknown;
    let entrypoint: unknown;
    try {
      assetId = ref.assetId;
      contentHash = ref.contentHash;
      entrypoint = ref.entrypoint;
    } catch {
      return undefined;
    }
    if (typeof assetId !== "string" || typeof contentHash !== "string" || typeof entrypoint !== "string") return undefined;
    return byExactRef.get(refKey(assetId, contentHash, entrypoint))?.asset;
  },
});
