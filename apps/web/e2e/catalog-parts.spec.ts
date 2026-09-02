import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CircuitDocument } from "@opencircuit/circuit-schema";
import { CATALOG_PARTS, preloadCatalogPart, type CatalogPart } from "../src/catalog";
import { COMPACT_CATALOG_BENCH, catalogBenchDocument, ne555AstableDocument } from "../src/catalog-bench";
import { encodeCircuit } from "../src/share";

const shots = process.env.SCHEMAGIC_CATALOG_SHOTS ?? resolve(import.meta.dirname, "../test-results/catalog-captures");

const partFor = (mpn: string): CatalogPart => {
  const part = CATALOG_PARTS.find((candidate) => candidate.manifest.canonical_mpn === mpn);
  if (!part) throw new Error(`Catalog package ${mpn} is not bundled`);
  return part;
};

const loadShared = async (page: Page, document: CircuitDocument): Promise<void> => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
  });
  await page.goto(`/#c=${encodeCircuit(document)}`);
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".editor-component").first()).toBeVisible();
};

test.describe("catalog-only parts place and simulate", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Catalog capture and placement coverage runs once in Chromium");
  test.beforeAll(async () => {
    mkdirSync(shots, { recursive: true });
    await Promise.all(["NE555", "74HC595", "LM317T"].map((mpn) => preloadCatalogPart(partFor(mpn).id)));
  });

  test("runs an NE555 astable built from the catalog package", async ({ page }) => {
    await loadShared(page, ne555AstableDocument(partFor("NE555")));
    await expect(page.locator('[data-component-id="c1"]')).toBeVisible();
    await page.locator('[data-component-id="c1"] .editor-component-hit').click({ force: true });
    await expect(page.locator(".inspector .part-ref")).toHaveText("U1");
    await expect(page.locator(".inspector .fidelity")).toHaveText("F2");
    // Pin readouts are named from the package, not numbered.
    await expect(page.locator(".inspector .measure-label").first()).toHaveText("GND V");
    await expect(page.locator(".inspector")).toContainText("DISCH V");
    await expect(page.locator(".status-line")).not.toHaveClass(/error/, { timeout: 45_000 });
    await page.screenshot({ path: `${shots}/ne555-astable.png`, fullPage: false });
  });

  for (const mpn of ["74HC595", "LM317T"]) {
    test(`places ${mpn} on a supply and load bench`, async ({ page }) => {
      const part = partFor(mpn);
      await loadShared(page, catalogBenchDocument(part, COMPACT_CATALOG_BENCH));
      await page.locator('[data-component-id="c1"] .editor-component-hit').click({ force: true });
      await expect(page.locator(".inspector .part-name")).toContainText(part.manifest.description);
      await expect(page.locator(".status-line")).not.toHaveClass(/error/, { timeout: 45_000 });
      await page.screenshot({ path: `${shots}/${mpn.toLowerCase()}-bench.png`, fullPage: false });
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
