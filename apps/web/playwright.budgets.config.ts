import { defineConfig, devices } from "@playwright/test";

// Wall-clock startup, solver and payload budgets.
//
// These thresholds were measured on one developer machine against a local Vite
// preview. On a shared GitHub runner the same numbers are scheduling noise, so
// this suite is deliberately NOT part of the PR-blocking CI workflow. It runs
// nightly from .github/workflows/nightly-budgets.yml and publishes its HTML and
// JSON report as an artifact for drift review.
//
// Run locally: npm run audit:performance-budget

const externalBaseURL = process.env.SCHEMAGIC_E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;
const chromiumChannel = process.env.PLAYWRIGHT_CHANNEL;
const isCI = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance-budget.spec.ts",
  outputDir: "test-results/performance-budget",
  preserveOutput: "always",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 2 : 0,
  expect: { timeout: 15_000 },
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report/performance-budget", open: "never" }],
    ["json", { outputFile: "test-results/performance-budget/report.json" }],
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumChannel ? { channel: chromiumChannel } : {}),
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  use: { baseURL, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure", colorScheme: "light", reducedMotion: "no-preference" },
  webServer: externalBaseURL ? undefined : {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
