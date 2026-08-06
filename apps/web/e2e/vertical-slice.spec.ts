import { expect, test } from "@playwright/test";

test("ngspice worker and reduced-motion static encoding are available", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("scheMAGIC Simulator", { exact: true })).toBeVisible();
  await expect.poll(() => page.locator(".static-chevron").count()).toBeGreaterThan(0);
  const widths = await page.locator("path.editor-wire").evaluateAll((paths) => [...new Set(paths.map((path) => getComputedStyle(path).strokeWidth))]);
  expect(widths.length).toBeGreaterThan(1);
  await expect(page.locator(".pulse-layer")).toHaveCSS("display", "none");
  await context.close();
});
