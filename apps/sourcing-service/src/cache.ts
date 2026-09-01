import { parseOfferSnapshot, type OfferSnapshot } from "@opencircuit/sourcing-schema";

export interface SnapshotCache {
  get(key: string): Promise<OfferSnapshot | undefined>;
  set(key: string, snapshot: OfferSnapshot, retentionSeconds: number): Promise<void>;
}

interface CacheEntry {
  snapshot: OfferSnapshot;
  deleteAt: number;
}

export class InMemorySnapshotCache implements SnapshotCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  async get(key: string): Promise<OfferSnapshot | undefined> {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.deleteAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return parseOfferSnapshot(entry.snapshot);
  }

  async set(key: string, snapshot: OfferSnapshot, retentionSeconds: number): Promise<void> {
    if (!Number.isFinite(retentionSeconds) || retentionSeconds <= 0) return;
    this.#entries.set(key, {
      snapshot: parseOfferSnapshot(snapshot),
      deleteAt: this.#now() + retentionSeconds * 1_000,
    });
  }
}
