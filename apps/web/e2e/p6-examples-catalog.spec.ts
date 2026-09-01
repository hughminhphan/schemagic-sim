import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const examplesDirectory = resolve(import.meta.dirname, "../../../examples");
const examples = readdirSync(examplesDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const id = name.replace(/\.json$/, "");
    const document = JSON.parse(readFileSync(resolve(examplesDirectory, name), "utf8")) as { meta: { title: string } };
    return [id, document.meta.title] as const;
  });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "P6 acceptance and screenshots run once in Chromium");
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
    await new Promise<void>((done) => {
      const request = indexedDB.deleteDatabase("schemagic-simulator");
      request.onsuccess = () => done();
      request.onerror = () => done();
      request.onblocked = () => done();
    });
  });
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
});

test("loads all bundled examples and solves", async ({ page }, testInfo) => {
  for (const [id, title] of examples) {
    const banner = page.locator("#engine-banner");
    const completedBefore = Number(await banner.getAttribute("data-solve-completed") ?? 0);
    await page.getByRole("button", { name: "Examples" }).click();
    const dialog = page.getByRole("dialog", { name: "Example circuits" });
    await dialog.locator(`[data-example="${id}"]`).click();
    await expect(page.locator("#workspace-button")).toHaveText(title);
    await expect(page).toHaveURL(new RegExp(`#example=${id}$`));
    await expect.poll(async () => Number(await banner.getAttribute("data-solve-started")), { message: `${id} should start a fresh solve` }).toBeGreaterThan(completedBefore);
    const started = await banner.getAttribute("data-solve-started");
    await expect(banner, `${id} should complete the solve it started`).toHaveAttribute("data-solve-completed", started!);
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".error-toast")).toHaveCount(0);
    if (id === "rc-filter-bode" || id === "mosfet-led-switch") {
      await expect(page.locator(".oc-waveform-viewer__trace")).toHaveCount(2, { timeout: 45_000 });
      await page.waitForTimeout(100);
      await page.screenshot({ path: testInfo.outputPath(id === "rc-filter-bode" ? "example-rc-filter-bode.png" : "example-mosfet-led-switch.png"), fullPage: true });
    }
  }
});

test("opamp example keeps its generated background outline", async ({ page }) => {
  await page.goto("/#example=opamp-noninverting");
  await page.reload();
  await expect(page.locator("#workspace-button")).toHaveText("TL072 non-inverting amplifier");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });

  const body = page.locator('[data-component-id="c4"] .sym-bg');
  await expect(body).toHaveCount(1);
  expect(await body.evaluate((element) => getComputedStyle(element).stroke)).not.toBe("none");
});

test("catalog renders model detail and places real 2N3904 model", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Catalog" }).click();
  const dialog = page.getByRole("dialog", { name: "Component catalog" });
  await expect(dialog).toBeVisible();
  expect(await dialog.locator("[data-catalog-part]").count()).toBeGreaterThanOrEqual(5);
  await page.screenshot({ path: testInfo.outputPath("catalog-view.png"), fullPage: true });

  await dialog.locator('[data-catalog-part="onsemi/2N3904"]').click();
  await expect(dialog.getByTestId("model-card")).toContainText("2N3904 model card");
  await expect(dialog.getByRole("link", { name: "View model source and tests on GitHub" })).toHaveAttribute("href", /packages\/model-library\/models\/onsemi\/2N3904$/);
  await page.screenshot({ path: testInfo.outputPath("catalog-2n3904-model-card.png"), fullPage: true });

  await dialog.getByRole("button", { name: "Place 2N3904" }).click();
  const box = await page.locator("#editor-host").boundingBox();
  if (!box) throw new Error("Editor host is not visible");
  await page.mouse.click(box.x + 520, box.y + 250);
  await expect(page.locator(".inspector .fidelity")).toHaveText("F2");
  await expect(page.locator("#engine-status")).toContainText("ENGINE READY", { timeout: 45_000 });
  const netlist = await page.evaluate(() => window.__ocLastNetlist ?? "");
  expect(netlist).toContain("OC_ONSEMI_2N3904");
  expect(netlist).toMatch(/Q\w+\s+\S+\s+\S+\s+\S+\s+OC_ONSEMI_2N3904/);
});
