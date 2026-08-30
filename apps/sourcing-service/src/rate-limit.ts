import type { DistributorId } from "@opencircuit/sourcing-schema";

export interface ProviderRateLimiter {
  consume(provider: DistributorId, requestsPerMinute: number, now: number): boolean;
}

interface WindowState {
  startedAt: number;
  count: number;
}

export class InMemoryFixedWindowRateLimiter implements ProviderRateLimiter {
  readonly #windows = new Map<DistributorId, WindowState>();

  consume(provider: DistributorId, requestsPerMinute: number, now: number): boolean {
    if (!Number.isInteger(requestsPerMinute) || requestsPerMinute <= 0) return false;
    const prior = this.#windows.get(provider);
    const window = prior === undefined || now - prior.startedAt >= 60_000
      ? { startedAt: now, count: 0 }
      : prior;
    if (window.count >= requestsPerMinute) {
      this.#windows.set(provider, window);
      return false;
    }
    window.count += 1;
    this.#windows.set(provider, window);
    return true;
  }
}
