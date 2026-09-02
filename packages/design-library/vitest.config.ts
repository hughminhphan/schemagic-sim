import { defineConfig } from "vitest/config";

/**
 * Several suites compile every checked-in JSON Schema through AJV. That cost
 * grows with each additive facts contract and is compile-bound, not a hang, so
 * the per-test budget is set well above the 20 s default.
 */
export default defineConfig({ test: { environment: "node", testTimeout: 120_000, hookTimeout: 120_000 } });
