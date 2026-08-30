import { defineConfig, devices } from "@playwright/test";
const externalBaseUrl = process.env.SCHEMAGIC_E2E_BASE_URL;
export default defineConfig({
  testDir:"./e2e",testIgnore:"**/designer-runtime.spec.ts",timeout:90_000,fullyParallel:false,workers:1,reporter:"line",
  projects:[
    {name:"chromium",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}},
    {name:"firefox",use:{...devices["Desktop Firefox"],viewport:{width:1440,height:900}}},
    {name:"webkit",use:{...devices["Desktop Safari"],viewport:{width:1440,height:900}}},
  ],
  use:{baseURL:externalBaseUrl ?? "http://127.0.0.1:4173",viewport:{width:1440,height:900},trace:"retain-on-failure",colorScheme:"light",reducedMotion:"no-preference"},
  webServer:externalBaseUrl ? undefined : {command:"npm run build && npx vite preview --host 127.0.0.1 --port 4173",url:"http://127.0.0.1:4173",reuseExistingServer:false,timeout:120_000},
});
