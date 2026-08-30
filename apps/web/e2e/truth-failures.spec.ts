import { expect, test, type Page } from "@playwright/test";

async function loadFresh(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("schemagic-simulator");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

async function clickComponent(page: Page, componentId: string, modifiers: readonly "Shift"[] = []): Promise<void> {
  const point = await page.locator(`[data-component-id="${componentId}"] .editor-component-hit`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  await page.mouse.click(point.x, point.y);
  for (const modifier of [...modifiers].reverse()) await page.keyboard.up(modifier);
}

async function canvasInk(page: Page): Promise<number> {
  return page.locator("canvas.pulse-layer").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext("2d");
    if (!context) return 0;
    const data = context.getImageData(0, 0, element.width, element.height).data;
    let ink = 0;
    for (let index = 3; index < data.length; index += 4) ink += data[index]!;
    return ink;
  });
}

async function placeTimeOnlyImportedModel(page: Page): Promise<string> {
  const existing = new Set(await page.locator(".editor-component").evaluateAll((items) => items.map((item) => item.getAttribute("data-component-id")).filter((id): id is string => Boolean(id))));
  await page.getByRole("button", { name: "Import models" }).click();
  await page.locator("#model-text").fill(`.subckt TIME_ONLY A K\nRLEAK A K 1T\nILEAK A K PWL(0 0 1 0)\n.ends TIME_ONLY`);
  await page.getByRole("button", { name: "Parse and review" }).click();
  await expect(page.getByText("Mapping is complete and bijective.")).toBeVisible();
  await page.locator('[data-subckt-index="0"]').getByRole("button", { name: "Add imported part" }).click();
  await page.getByRole("dialog", { name: "Import models" }).getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Place imported TIME_ONLY" }).click();
  const anchor = await page.locator('[data-component-id="c6"] .editor-component-hit').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.click(anchor.x, anchor.y);
  const ids = await page.locator(".editor-component").evaluateAll((items) => items.map((item) => item.getAttribute("data-component-id")).filter((id): id is string => Boolean(id)));
  const componentId = ids.find((id) => !existing.has(id));
  if (!componentId) throw new Error("Imported component was not placed");
  return componentId;
}

test.describe("electrical truth failures", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Electrical visual truth is verified once in installed Chrome");

  test("a blocked solve immediately neutralizes every stale electrical visual", async ({ page }) => {
    test.setTimeout(120_000);
    await loadFresh(page);

    await clickComponent(page, "c2");
    const slider = page.locator("#wiper-value");
    const box = await slider.boundingBox();
    if (!box) throw new Error("Potentiometer slider is unavailable");
    const completed = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    await page.mouse.click(box.x + box.width * 0.95, box.y + box.height / 2);
    await expect.poll(() => page.getByTestId("engine-banner").getAttribute("data-solve-completed"), { timeout: 45_000 }).not.toBe(completed);
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(100);

    const energizedWireCount = await page.locator("path.editor-wire").evaluateAll((wires) => wires.filter((wire) => getComputedStyle(wire).stroke !== "rgb(110, 115, 120)").length);
    expect(energizedWireCount).toBeGreaterThan(0);
    expect(await canvasInk(page)).toBeGreaterThan(0);
    expect(await page.locator("[data-led-halo]").evaluateAll((halos) => halos.some((halo) => Number(getComputedStyle(halo).opacity) > 0))).toBe(true);
    await expect(page.getByTestId("branch-current")).not.toContainText("–");

    const beforeImport = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    await placeTimeOnlyImportedModel(page);
    await expect.poll(() => page.getByTestId("engine-banner").getAttribute("data-solve-completed"), { timeout: 45_000 }).not.toBe(beforeImport);
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    expect(await canvasInk(page)).toBeGreaterThan(0);
    await page.locator('[data-mode="ac"]').click();
    await expect(page.getByTestId("engine-banner")).toHaveAttribute("data-engine-state", "error", { timeout: 45_000 });
    await expect(page.locator("#engine-status")).toContainText(/does not declare AC support/i);
    await expect(page.locator("#scope-run-label")).toHaveText("BLOCKED");
    await expect(page.locator(".scope-run-state .run-indicator")).toHaveClass(/error/);
    await page.waitForTimeout(50);

    const neutralWires = await page.locator("path.editor-wire").evaluateAll((wires) => wires.every((wire) => {
      const style = getComputedStyle(wire);
      return style.stroke === "rgb(110, 115, 120)" && style.strokeDasharray === "none";
    }));
    expect(neutralWires).toBe(true);
    expect(await page.locator("[data-led-halo]").evaluateAll((halos) => halos.every((halo) => Number(getComputedStyle(halo).opacity) === 0))).toBe(true);
    expect(await canvasInk(page)).toBe(0);
    await expect(page.locator("#scope-empty")).toBeVisible();
    await expect(page.locator(".scope-viewer-host")).toBeHidden();

    await clickComponent(page, "c6");
    const readings = page.locator(".inspector .reading-value");
    await expect(readings).not.toHaveCount(0);
    for (let index = 0; index < await readings.count(); index += 1) await expect(readings.nth(index)).toContainText("–");
  });

  test("an imported unsupported analysis keeps actionable component attribution", async ({ page }) => {
    test.setTimeout(120_000);
    await loadFresh(page);
    const componentId = await placeTimeOnlyImportedModel(page);

    await page.locator('[data-mode="ac"]').click();
    await expect(page.getByTestId("engine-banner")).toHaveAttribute("data-engine-state", "error", { timeout: 45_000 });
    const diagnostic = page.locator(".error-toast").filter({ hasText: componentId });
    await expect(diagnostic).toContainText(/does not declare AC support/i);
    await expect(diagnostic).toContainText(/Choose one of its declared modes/i);
    await diagnostic.click();
    await expect(page.locator(".inspector .part-ref")).toContainText("TIME_ONLY");
    await expect(page.locator(".inspector .unverified-tag")).toHaveText("imported, unverified");
  });

  test("a restored AC workspace labels its logarithmic frequency scope honestly", async ({ page }) => {
    await loadFresh(page, "/#example=rc-filter-bode");
    await page.locator('[data-mode="ac"]').click();
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await page.reload();
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("#scope-title")).toHaveText("AC RESPONSE");
    await expect(page.locator("#scope-scale")).toContainText("LOG Hz");
    await expect(page.locator("#scope-scale")).not.toContainText("s/div");
  });
});
