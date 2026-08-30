import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;
const chromiumChannel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir:"./e2e",outputDir:"test-results",timeout:90_000,fullyParallel:false,workers:1,reporter:"line",
  projects:[
    {name:"chromium",use:{...devices["Desktop Chrome"],...(chromiumChannel?{channel:chromiumChannel}:{}),viewport:{width:1440,height:900}}},
    {name:"firefox",use:{...devices["Desktop Firefox"],viewport:{width:1440,height:900}}},
    {name:"webkit",use:{...devices["Desktop Safari"],viewport:{width:1440,height:900}}},
  ],
  use:{baseURL,viewport:{width:1440,height:900},trace:"retain-on-failure",colorScheme:"light",reducedMotion:"no-preference"},
  webServer:externalBaseURL?undefined:{command:`npm run build && npx vite preview --host 127.0.0.1 --port ${port}`,url:baseURL,reuseExistingServer:false,timeout:120_000},
});
