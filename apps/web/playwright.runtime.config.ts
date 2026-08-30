import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.SCHEMAGIC_E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "designer-runtime.spec.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
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
