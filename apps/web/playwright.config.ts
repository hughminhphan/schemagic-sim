import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",timeout:90_000,fullyParallel:false,workers:1,reporter:"line",
  projects:[
    {name:"chromium",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}},
    {name:"firefox",use:{...devices["Desktop Firefox"],viewport:{width:1440,height:900}}},
    {name:"webkit",use:{...devices["Desktop Safari"],viewport:{width:1440,height:900}}},
  ],
  use:{baseURL:"http://127.0.0.1:4173",viewport:{width:1440,height:900},trace:"retain-on-failure",colorScheme:"light",reducedMotion:"no-preference"},
  webServer:{command:"npm run build && npx vite preview --host 127.0.0.1 --port 4173",url:"http://127.0.0.1:4173",reuseExistingServer:true,timeout:120_000},
});
