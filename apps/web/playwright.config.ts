import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.SCHEMAGIC_E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;
const chromiumChannel = process.env.PLAYWRIGHT_CHANNEL;
const isCI = process.env.CI === "true" || process.env.CI === "1";

// The two environment-bound budget suites are excluded from this PR-blocking
// config and live in scheduled workflows instead:
//   designer-runtime.spec.ts   -> playwright.runtime.config.ts   (JS heap)
//   performance-budget.spec.ts -> playwright.budgets.config.ts   (wall clock)
// Both assert wall-clock and memory numbers measured on one machine, so on a
// shared GitHub runner they are drift signals, not correctness gates.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/designer-runtime.spec.ts", "**/performance-budget.spec.ts"],
  outputDir: "test-results",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  // Browser specs flake on shared runners. Two retries locally would hide real
  // local failures, so retries are CI-only.
  retries: isCI ? 2 : 0,
  reporter: "line",
  expect: { timeout: 15_000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...(chromiumChannel ? { channel: chromiumChannel } : {}), viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
  ],
  use: { baseURL, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure", colorScheme: "light", reducedMotion: "no-preference" },
  webServer: externalBaseURL ? undefined : { command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port}`, url: baseURL, reuseExistingServer: false, timeout: 120_000 },
});
