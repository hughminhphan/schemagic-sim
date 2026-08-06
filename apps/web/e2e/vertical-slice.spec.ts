import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const screenshotDir = resolve(import.meta.dirname, "../../../spikes/p1-screenshots");

function parseReading(text: string): number {
  const normalized = text.replace(/−/g, "-").replace(/\s+/g, "").trim();
  const match = normalized.match(/^([+-]?\d+(?:\.\d+)?)([pnumkMGµ]?)(?:V|A)/);
  if (!match) throw new Error(`Cannot parse reading: ${text}`);
  const prefix: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6, G: 1e9 };
  return Number(match[1]) * (prefix[match[2] ?? ""] ?? 1);
}

test("real WASM worker runs the interactive vertical slice", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  await page.goto("/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => page.getByTestId("led-voltage").innerText()).not.toContain("--");

  const animatedPixels = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#pulse-layer");
    if (!canvas) return 0;
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return 0;
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 0) > 0) count += 1;
    return count;
  });
  expect(animatedPixels).toBeGreaterThan(0);

  const ledVoltage = parseReading(await page.getByTestId("led-voltage").innerText());
  expect(ledVoltage).toBeGreaterThan(1.4);
  expect(ledVoltage).toBeLessThan(5.1);
  const collectorBefore = parseReading(await page.getByTestId("collector-voltage").innerText());
  await page.screenshot({ path: resolve(screenshotDir, "default-view.png"), fullPage: true });

  await page.evaluate(() => window.__ocMetrics.resetLongTasks());
  const wiper = page.getByTestId("pot-wiper");
  const box = await wiper.boundingBox();
  if (!box) throw new Error("Pot wiper has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.92, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => parseReading(await page.getByTestId("collector-voltage").innerText())).not.toBeCloseTo(collectorBefore, 2);
  const collectorAfter = parseReading(await page.getByTestId("collector-voltage").innerText());
  expect(Math.abs(collectorAfter - collectorBefore)).toBeGreaterThan(0.1);

  const longTaskCount = await page.evaluate(() => window.__ocMetrics.longTasks);
  expect(longTaskCount).toBe(0);

  await page.getByRole("button", { name: "TRAN", exact: true }).click();
  await expect(page.getByText("TRANSIENT", { exact: true })).toBeVisible();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => page.evaluate(() => window.__ocMetrics.rawfileBytes)).toBeGreaterThan(1000);
  await page.screenshot({ path: resolve(screenshotDir, "tran-scope-open.png"), fullPage: true });

  const transientBytes = await page.evaluate(() => window.__ocMetrics.rawfileBytes);
  await page.getByRole("button", { name: "AC", exact: true }).click();
  await expect(page.getByText("AC RESPONSE", { exact: true })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.__ocMetrics.rawfileBytes)).not.toBe(transientBytes);

  await page.getByRole("button", { name: "Copy share link" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("#c=");
  const shared = await context.newPage();
  await shared.goto(copied);
  await expect(shared.getByTestId("engine-ready")).toBeVisible({ timeout: 30_000 });
  await shared.locator('[data-component-id="c2"] .component-label').click();
  const sharedT = Number(await shared.locator("#wiper-value").inputValue());
  expect(sharedT).toBeLessThan(0.2);
  await shared.close();

  const metrics = await page.evaluate(() => window.__ocMetrics);
  writeFileSync(resolve(screenshotDir, "metrics.json"), JSON.stringify({
    engineInitMs: metrics.engineInitMs,
    warmOpMs: metrics.warmOpMs,
    wasmTransferSize: metrics.wasmTransferSize,
    rawfileBytes: metrics.rawfileBytes,
    longTasks: longTaskCount,
    ledVoltage,
    collectorBefore,
    collectorAfter,
  }, null, 2));
});

test("reduced motion uses static current encoding", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => page.locator("#chevron-layer .static-chevron").count()).toBeGreaterThan(0);
  await expect(page.locator("#pulse-layer")).toHaveCSS("display", "none");
  await page.screenshot({ path: resolve(screenshotDir, "reduced-motion.png"), fullPage: true });
  await context.close();
});
