import { parseOfferSnapshotV2, type OfferSnapshotV2 } from "@opencircuit/sourcing-schema";

export interface SnapshotCacheV2 {
  get(key: string): Promise<OfferSnapshotV2 | undefined>;
  set(key: string, snapshot: OfferSnapshotV2, retentionSeconds: number): Promise<void>;
}

interface CacheEntryV2 {
  snapshot: OfferSnapshotV2;
  deleteAt: number;
}

export class InMemorySnapshotCacheV2 implements SnapshotCacheV2 {
  readonly #entries = new Map<string, CacheEntryV2>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  async get(key: string): Promise<OfferSnapshotV2 | undefined> {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.deleteAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return parseOfferSnapshotV2(entry.snapshot);
  }

  async set(key: string, snapshot: OfferSnapshotV2, retentionSeconds: number): Promise<void> {
    if (!Number.isFinite(retentionSeconds) || retentionSeconds <= 0) return;
    this.#entries.set(key, {
      snapshot: parseOfferSnapshotV2(snapshot),
      deleteAt: this.#now() + retentionSeconds * 1_000,
    });
  }
}
