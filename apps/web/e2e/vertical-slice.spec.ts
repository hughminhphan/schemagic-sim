import { expect, test } from "@playwright/test";
import { demoCircuit } from "../src/demo";
import { encodeCircuit } from "../src/share";

test("ngspice worker and reduced-motion static encoding are available", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto(baseURL ?? "http://127.0.0.1:4173/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Robonyx", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Robonyx products" }).getByText("Simulator", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.locator(".static-chevron").count()).toBeGreaterThan(0);
  const widths = await page.locator("path.editor-wire").evaluateAll((paths) => [...new Set(paths.map((path) => getComputedStyle(path).strokeWidth))]);
  expect(widths.length).toBeGreaterThan(1);
  await expect(page.locator(".pulse-layer")).toHaveCSS("display", "none");
  await context.close();
});

test("embed mode solves, refuses circuit edits, and links to the full simulator", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 640, height: 420 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    localStorage.setItem("schemagic.guidance-dismissed", "1");
  });
  const embeddedUrl = new URL(baseURL ?? "http://127.0.0.1:4173/");
  embeddedUrl.searchParams.set("embed", "1");
  embeddedUrl.hash = `c=${encodeCircuit(demoCircuit)}`;
  await page.goto(embeddedUrl.toString());

  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".schematic-editor")).toHaveAttribute("aria-readonly", "true");
  await expect(page.locator(".symbol-rail")).toHaveAttribute("inert", "");

  const openLink = page.getByTestId("embed-open-link");
  await expect(openLink).toBeVisible();
  await expect(openLink).toHaveAttribute("target", "_blank");
  const expectedOpenUrl = new URL(page.url());
  expectedOpenUrl.searchParams.delete("embed");
  await expect(openLink).toHaveAttribute("href", expectedOpenUrl.toString());
  const popupPromise = page.waitForEvent("popup");
  await openLink.click();
  const fullPage = await popupPromise;
  await expect(fullPage).toHaveURL(expectedOpenUrl.toString());
  await fullPage.close();

  const components = page.locator(".editor-component");
  const wires = page.locator(".editor-wire-group");
  const componentCount = await components.count();
  const wireCount = await wires.count();
  const firstComponent = components.first();
  const originalTransform = await firstComponent.getAttribute("transform");
  const bounds = await firstComponent.boundingBox();
  expect(bounds).not.toBeNull();

  await page.locator('[data-tool="resistor"]').dispatchEvent("click");
  await page.locator(".schematic-editor").dispatchEvent("pointerdown", { pointerId: 1, clientX: 320, clientY: 180, button: 0 });
  await page.locator(".schematic-editor").dispatchEvent("pointerup", { pointerId: 1, clientX: 320, clientY: 180, button: 0 });
  await page.locator('[data-tool="wire"]').dispatchEvent("click");
  await page.locator(".schematic-editor").dispatchEvent("click", { clientX: 300, clientY: 180 });
  await page.locator(".schematic-editor").dispatchEvent("click", { clientX: 360, clientY: 180 });
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 80, bounds!.y + bounds!.height / 2 + 40);
  await page.mouse.up();
  await page.keyboard.press("Delete");

  await expect(components).toHaveCount(componentCount);
  await expect(wires).toHaveCount(wireCount);
  await expect(firstComponent).toHaveAttribute("transform", originalTransform!);
  await context.close();
});
