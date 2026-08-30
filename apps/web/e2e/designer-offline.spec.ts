import { expect, type Page, test } from "@playwright/test";
import { parseDesignResultV2 } from "@opencircuit/design-schema";
import { serializeElectricalDesignRequestV2 } from "../src/features/designer/RequestTransfer";
import { scenarioV2Source } from "./designer-accessibility-fixtures";

const STRUCTURAL_RESULT_RESTORED = "Restored a strictly validated electrical result share. It remains structural-only until you explicitly regenerate it with the installed production context.";
const STRUCTURAL_TRUST_TITLE = "STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED";

async function expectStructuralTrustBanner(page: Page): Promise<void> {
  const trustBanner = page.locator(".designer-trust-banner:visible");
  await expect(trustBanner).toHaveCount(1);
  await expect(trustBanner).toHaveRole("status");
  await expect(trustBanner.getByText(STRUCTURAL_TRUST_TITLE, { exact: true })).toBeVisible();
}

async function openScenarioShare(page: Page): Promise<void> {
  await page.locator("[data-designer-result-file]").setInputFiles({
    name: "offline-scenario-v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(scenarioV2Source()),
  });
  await page.getByRole("tab", { name: "Operating results", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await page.locator('[data-imported-scenario="startup"]').click();
  await page.getByRole("button", { name: "Create share URL" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#d=")).toBe(true);
}

test("a shared Designer V2 result reopens from the same-origin static cache while offline", async ({ browserName, context, page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
  await openScenarioShare(page);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller === null) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
  });

  // This controlled online reload populates the runtime cache with the exact
  // route, local fonts, CSS, and lazy Designer modules needed by the share.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: STRUCTURAL_RESULT_RESTORED })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Regenerate with installed context", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "Operating results", exact: true }).click();
  await expect(page.locator('[data-imported-scenario="startup"]')).toHaveAttribute("aria-pressed", "true");
  await expectStructuralTrustBanner(page);
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
  await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  const cachedPaths = await page.evaluate(async () => {
    const cache = await caches.open("schemagic-shell-v2");
    return (await cache.keys()).map((request) => new URL(request.url).pathname).sort();
  });
  expect(cachedPaths).toContain("/");
  expect(cachedPaths.some((path) => path.endsWith(".js"))).toBe(true);
  expect(cachedPaths.some((path) => path.endsWith(".css"))).toBe(true);

  await context.setOffline(true);
  try {
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
    } catch (error) {
      // Playwright WebKit 1.62 can report an internal navigation error after
      // the service worker has already completed the offline reload. The
      // end-state assertions below remain authoritative and must all pass.
      if (browserName !== "webkit" || !(error instanceof Error) || !error.message.includes("WebKit encountered an internal error")) {
        throw error;
      }
    }
    await expect(page.getByRole("status").filter({ hasText: STRUCTURAL_RESULT_RESTORED })).toHaveCount(1);
    await page.getByRole("tab", { name: "Operating results", exact: true }).click();
    await expect(page.locator('[data-imported-scenario="startup"]')).toHaveAttribute("aria-pressed", "true");
    await expectStructuralTrustBanner(page);
    const regenerate = page.getByRole("button", { name: "Regenerate with installed context", exact: true });
    await expect(regenerate).toBeEnabled();
    await regenerate.click();
    await expect(page.getByRole("status").filter({ hasText: /remains structural-only|does not exactly match the installed production context/u })).toHaveCount(1);
    await expectStructuralTrustBanner(page);
    await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
    await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
    await expect(page.locator("[data-production-export]")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});

test("a shared V2 requirements form reopens from the same-origin static cache while offline", async ({ browserName, context, page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/?designer");
  const request = parseDesignResultV2(JSON.parse(scenarioV2Source())).request;
  await page.locator("[data-designer-request-file]").setInputFiles({
    name: "offline-motor-requirements.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeElectricalDesignRequestV2(request)),
  });
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await page.getByRole("button", { name: "Create requirements share URL" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#r=")).toBe(true);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller === null) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
  });
  await page.reload();
  const restored = "Restored exact canonical V2 requirements as untrusted input. Review them and press Generate design to use the installed production context.";
  await expect(page.getByRole("status").filter({ hasText: restored })).toHaveCount(1);
  await expect(page.getByLabel("Starting point")).toHaveValue("");
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);

  await context.setOffline(true);
  try {
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
    } catch (error) {
      if (browserName !== "webkit" || !(error instanceof Error) || !error.message.includes("WebKit encountered an internal error")) {
        throw error;
      }
    }
    await expect(page.getByRole("status").filter({ hasText: restored })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
    await expect(page.getByLabel("Starting point")).toHaveValue("");
    await expect(page.getByRole("option", { name: "Transferred requirements" })).toHaveAttribute("disabled", "");
    await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
    await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});
