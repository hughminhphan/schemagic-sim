import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CircuitDocument } from "@opencircuit/circuit-schema";
import { COMPACT_CATALOG_BENCH, catalogBenchDocument, ne555AstableDocument, type CatalogBenchPart } from "../src/catalog-bench";
import { baseTypeForManifest } from "../src/catalog-truth";
import { encodeCircuit } from "../src/share";

const shots = process.env.SCHEMAGIC_CATALOG_SHOTS ?? resolve(import.meta.dirname, "../test-results/catalog-captures");
const MODELS_ROOT = resolve(import.meta.dirname, "../../../packages/model-library/models");

interface SpecPart extends CatalogBenchPart { description: string }

/**
 * Reads a package straight from the library. The browser catalog resolves the
 * same files through import.meta.glob, which the Playwright runner cannot use.
 */
const partFor = (id: string): SpecPart => {
  const manifest = JSON.parse(readFileSync(join(MODELS_ROOT, id, "component.json"), "utf8")) as CatalogBenchPart["manifest"] & { description: string };
  const baseType = baseTypeForManifest(manifest);
  if (!baseType) throw new Error(`Catalog package ${id} has no placeable symbol`);
  return { id, baseType, manifest, description: manifest.description };
};

const loadShared = async (page: Page, document: CircuitDocument): Promise<void> => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
  });
  await page.goto(`/#c=${encodeCircuit(document)}`);
  // Navigating from "/" to "/#c=..." only fires hashchange, so the app has to
  // be reloaded before it reads the shared circuit out of the hash.
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".editor-component").first()).toBeVisible();
};

test.describe("catalog-only parts place and simulate", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Catalog capture and placement coverage runs once in Chromium");
  test.beforeAll(() => mkdirSync(shots, { recursive: true }));

  test("runs an NE555 astable built from the catalog package", async ({ page }) => {
    await loadShared(page, ne555AstableDocument(partFor("ti/NE555")));
    await expect(page.locator('[data-component-id="c1"]')).toBeVisible();
    await page.locator('[data-component-id="c1"] .editor-component-hit').click({ force: true });
    await expect(page.locator(".inspector .part-ref")).toHaveText("NE555");
    await expect(page.locator(".inspector .fidelity")).toHaveText("F2");
    // Pin readouts are named from the package, not numbered.
    await expect(page.locator(".inspector .measure-label").first()).toHaveText("GND V");
    await expect(page.locator(".inspector")).toContainText("DISCH V");
    await expect(page.getByTestId("engine-banner")).toHaveAttribute("data-engine-state", "ready", { timeout: 45_000 });
    await page.screenshot({ path: `${shots}/ne555-astable.png`, fullPage: false });
  });

  for (const id of ["nexperia/74HC595", "st/LM317T"]) {
    const slug = id.split("/")[1]!.toLowerCase();
    test(`places ${id} on a supply and load bench`, async ({ page }) => {
      const part = partFor(id);
      await loadShared(page, catalogBenchDocument(part, COMPACT_CATALOG_BENCH));
      await page.locator('[data-component-id="c1"] .editor-component-hit').click({ force: true });
      await expect(page.locator(".inspector .part-name")).toContainText(part.description);
      await expect(page.getByTestId("engine-banner")).toHaveAttribute("data-engine-state", "ready", { timeout: 45_000 });
      await page.screenshot({ path: `${shots}/${slug}-bench.png`, fullPage: false });
    });
  }

  test("ranks 555 and filters the catalog", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
    await page.reload();
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Catalog", exact: true }).click();
    const sheet = page.locator(".catalog-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("header span")).toContainText("reference-only");
    await sheet.locator("#catalog-search").fill("555");
    await expect(sheet.locator(".catalog-row").first().locator("strong")).toHaveText("NE555");
    await sheet.locator(".catalog-row").first().click();
    await expect(sheet.getByTestId("supported-analyses")).toContainText("Supported analyses");
    await expect(sheet.getByTestId("known-omissions")).toBeVisible();
    await page.screenshot({ path: `${shots}/catalog-search-555.png`, fullPage: false });

    await sheet.locator('[data-filter="placeable"]').click();
    await expect(sheet.locator('[data-filter="placeable"]')).toHaveAttribute("aria-pressed", "true");
    await sheet.locator("#catalog-search").fill("");
    await expect(sheet.locator("[data-catalog-summary]")).toContainText("of 771 shown");
    await sheet.locator('[data-filter="analysis:noise"]').click();
    const summary = await sheet.locator("[data-catalog-summary]").textContent();
    expect(Number(summary!.split(" ")[0])).toBeLessThan(771);
  });
});
