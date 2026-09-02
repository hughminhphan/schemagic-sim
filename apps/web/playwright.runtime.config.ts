import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.SCHEMAGIC_E2E_BASE_URL;
const isCI = process.env.CI === "true" || process.env.CI === "1";

// Stable release evidence (the workflow_dispatch path in
// .github/workflows/designer-runtime-release.yml) writes a persisted report and
// receipt, so it must observe a single unretried attempt. Every other CI run of
// this environment-bound suite is a drift signal and may retry.
const producesStableReleaseEvidence = process.env.DESIGNER_RUNTIME_REPORT_OUTPUT !== undefined;
const retries = producesStableReleaseEvidence ? 0 : (isCI ? 2 : 0);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "designer-runtime.spec.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries,
  expect: { timeout: 15_000 },
  reporter: producesStableReleaseEvidence ? "line" : [
    ["line"],
    ["html", { outputFolder: "playwright-report/designer-runtime", open: "never" }],
    ["json", { outputFile: "test-results/designer-runtime/report.json" }],
  ],
  outputDir: "test-results/designer-runtime",
  preserveOutput: "always",
  projects: [{
    name: "chromium-runtime",
    use: {
      ...devices["Desktop Chrome"],
      headless: true,
      viewport: { width: 1440, height: 900 },
      serviceWorkers: "allow",
      reducedMotion: "no-preference",
      colorScheme: "light",
    },
  }],
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  webServer: externalBaseUrl ? undefined : {
    command: "npm run build && npx vite preview --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
