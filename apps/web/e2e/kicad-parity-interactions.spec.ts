import { expect, test, type Page } from "@playwright/test";

const undoShortcut = process.platform === "darwin" ? "Meta+z" : "Control+z";
const commandKey = process.platform === "darwin" ? "Meta" : "Control";

const worldPoint = async (page: Page, point: [number, number]) => page.locator(".editor-world").evaluate((element, [x, y]) => {
  const matrix = (element as SVGGraphicsElement).getScreenCTM();
  if (!matrix) throw new Error("World transform missing");
  const screen = new DOMPoint(x, y).matrixTransform(matrix);
  return { x: screen.x, y: screen.y };
}, point);

const componentPoint = async (page: Page, id: string, point: [number, number] = [0, 0]) => page.locator(`[data-component-id="${id}"]`).evaluate((element, [x, y]) => {
  const matrix = (element as SVGGraphicsElement).getScreenCTM();
  if (!matrix) throw new Error("Component transform missing");
  const screen = new DOMPoint(x, y).matrixTransform(matrix);
  return { x: screen.x, y: screen.y };
}, point);

const loadFreshEditor = async (page: Page) => {
  await page.goto("/");
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
  await expect(page.locator("path.editor-wire")).toHaveCount(10);
};

const componentState = async (page: Page, id: string) => page.locator(`[data-component-id="${id}"]`).evaluate((element) => ({
  x: Number((element as SVGGElement).dataset.anchorX),
  y: Number((element as SVGGElement).dataset.anchorY),
  rotation: Number((element as SVGGElement).dataset.rotation),
  mirror: (element as SVGGElement).dataset.mirror === "true",
}));

const pinPoint = async (page: Page, componentId: string, pinIndex: number) => page
  .locator(`[data-pin-hit][data-pin-component="${componentId}"][data-pin-index="${pinIndex}"]`)
  .evaluate((element) => [Number(element.getAttribute("cx")), Number(element.getAttribute("cy"))]);

const expectLabelsAttached = async (page: Page, componentIds: string[]) => {
  const attachments = await page.evaluate((ids) => ids.flatMap((componentId) => {
    const symbol = document.querySelector<SVGGraphicsElement>(`[data-component-id="${componentId}"] .editor-symbol`);
    if (!symbol) throw new Error(`Missing symbol ${componentId}`);
    const symbolBox = symbol.getBoundingClientRect();
    return [...document.querySelectorAll<SVGTextElement>(`[data-label-component-id="${componentId}"]`)].map((label) => {
      const box = label.getBoundingClientRect();
      const gapX = Math.max(symbolBox.left - box.right, box.left - symbolBox.right, 0);
      const gapY = Math.max(symbolBox.top - box.bottom, box.top - symbolBox.bottom, 0);
      return { componentId, property: label.dataset.property, gap: Math.hypot(gapX, gapY), transform: label.getAttribute("transform") };
    });
  }), componentIds);
  expect(attachments.map(({ componentId, property }) => `${componentId}:${property}`).sort()).toEqual(
    componentIds.flatMap((componentId) => [`${componentId}:reference`, `${componentId}:value`]).sort(),
  );
  expect(attachments.every(({ gap }) => gap <= 24)).toBeTruthy();
  expect(attachments.every(({ transform }) => transform === null)).toBeTruthy();
};

test.describe("KiCad parity interaction audit", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Detailed real-input parity coverage runs once in Chromium");
  test.beforeEach(async ({ page }) => loadFreshEditor(page));

  test("R rotates counter-clockwise, Shift+R clockwise, and X/Y mirror the expected axes", async ({ page }) => {
    const transistor = await componentPoint(page, "c4");
    await page.mouse.click(transistor.x, transistor.y);

    await page.keyboard.press("r");
    expect(await componentState(page, "c4")).toEqual({ x: 44, y: 22, rotation: 270, mirror: false });
    expect(await pinPoint(page, "c4", 0)).toEqual([41, 20]);

    await page.keyboard.press("Shift+r");
    expect(await componentState(page, "c4")).toEqual({ x: 44, y: 22, rotation: 0, mirror: false });
    expect(await pinPoint(page, "c4", 0)).toEqual([46, 19]);

    await page.keyboard.press("x");
    expect(await componentState(page, "c4")).toEqual({ x: 44, y: 22, rotation: 0, mirror: true });
    expect(await pinPoint(page, "c4", 0)).toEqual([42, 19]);
    expect(await pinPoint(page, "c4", 1)).toEqual([46, 22]);

    await page.locator(".schematic-editor").press(undoShortcut);
    await page.mouse.click(transistor.x, transistor.y);
    await page.keyboard.press("y");
    expect(await componentState(page, "c4")).toEqual({ x: 44, y: 22, rotation: 180, mirror: true });
    expect(await pinPoint(page, "c4", 0)).toEqual([46, 25]);
    expect(await pinPoint(page, "c4", 2)).toEqual([46, 19]);
  });

  test("multi-selection rotates and mirrors around its group centre while labels remain attached", async ({ page }) => {
    await page.locator('[data-tool="resistor"]').click();
    const placement = await worldPoint(page, [40, 32]);
    await page.mouse.click(placement.x, placement.y);
    const c3 = await componentPoint(page, "c3");
    await expect(page.locator('[data-component-id="c10"]')).toHaveAttribute("data-anchor-x", "40");
    await page.keyboard.down("Shift");
    await page.mouse.click(c3.x, c3.y);
    await page.keyboard.up("Shift");
    await expect(page.locator(".editor-component.selected")).toHaveCount(2);
    await expectLabelsAttached(page, ["c3", "c10"]);

    await page.keyboard.press("r");
    expect(await componentState(page, "c3")).toEqual({ x: 31, y: 31, rotation: 270, mirror: false });
    expect(await componentState(page, "c10")).toEqual({ x: 41, y: 23, rotation: 270, mirror: false });
    await expectLabelsAttached(page, ["c3", "c10"]);

    await page.keyboard.press("Shift+r");
    expect(await componentState(page, "c3")).toEqual({ x: 32, y: 22, rotation: 0, mirror: false });
    expect(await componentState(page, "c10")).toEqual({ x: 40, y: 32, rotation: 0, mirror: false });

    await page.keyboard.press("x");
    expect(await componentState(page, "c3")).toEqual({ x: 40, y: 22, rotation: 0, mirror: true });
    expect(await componentState(page, "c10")).toEqual({ x: 32, y: 32, rotation: 0, mirror: true });
    await expectLabelsAttached(page, ["c3", "c10"]);
  });

  test("Cmd/Ctrl+Shift removes selected items by click and marquee", async ({ page }) => {
    const c3 = await componentPoint(page, "c3");
    const c4 = await componentPoint(page, "c4");
    await page.mouse.click(c3.x, c3.y);
    await page.keyboard.down("Shift");
    await page.mouse.click(c4.x, c4.y);
    await page.keyboard.up("Shift");
    await expect(page.locator(".editor-component.selected")).toHaveCount(2);

    await page.keyboard.down(commandKey);
    await page.keyboard.down("Shift");
    await page.mouse.click(c3.x, c3.y);
    await page.keyboard.up("Shift");
    await page.keyboard.up(commandKey);
    await expect(page.locator('[data-component-id="c3"]')).not.toHaveClass(/selected/);
    await expect(page.locator('[data-component-id="c4"]')).toHaveClass(/selected/);

    await page.keyboard.down("Shift");
    await page.mouse.click(c3.x, c3.y);
    await page.keyboard.up("Shift");
    const topLeft = await worldPoint(page, [41, 18]);
    const bottomRight = await worldPoint(page, [48, 26]);
    await page.keyboard.down(commandKey);
    await page.keyboard.down("Shift");
    await page.mouse.move(topLeft.x, topLeft.y);
    await page.mouse.down();
    await page.mouse.move(bottomRight.x, bottomRight.y, { steps: 4 });
    await expect(page.locator(".selection-box")).toHaveAttribute("data-selection-direction", "contain");
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await page.keyboard.up(commandKey);
    await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);
    await expect(page.locator('[data-component-id="c4"]')).not.toHaveClass(/selected/);
  });

  test("wire-only M moves the full block while G reroutes only the pointed segment", async ({ page }) => {
    const editor = page.locator(".schematic-editor");
    const wire = page.locator('path.editor-wire[data-wire-id="w1"]');
    const segment = await worldPoint(page, [38, 11]);
    const moveTarget = await worldPoint(page, [40, 13]);
    const original = "M8 22 L8 11 L18 11 L58 11";
    await expect(wire).toHaveAttribute("d", original);

    await page.mouse.click(segment.x, segment.y);
    await page.keyboard.press("m");
    await page.mouse.move(moveTarget.x, moveTarget.y, { steps: 4 });
    await expect(editor).toHaveAttribute("data-interaction", "wire-block-move");
    await page.mouse.click(moveTarget.x, moveTarget.y);
    await expect(wire).toHaveAttribute("d", "M10 24 L10 13 L60 13");
    await expect(page.locator('path.editor-wire[data-wire-id="w2"]')).toHaveAttribute("d", "M18 20 L18 11");

    await editor.press(undoShortcut);
    await expect(wire).toHaveAttribute("d", original);
    await page.mouse.click(segment.x, segment.y);
    const rerouteTarget = await worldPoint(page, [38, 13]);
    await page.keyboard.press("g");
    await page.mouse.move(rerouteTarget.x, rerouteTarget.y, { steps: 4 });
    await expect(editor).toHaveAttribute("data-interaction", "wire-reroute");
    await page.mouse.click(rerouteTarget.x, rerouteTarget.y);
    await expect(wire).toHaveAttribute("d", "M8 22 L8 11 L18 11 L18 13 L58 13 L58 11");
    await editor.press(undoShortcut);
    await expect(wire).toHaveAttribute("d", original);
  });

  test("J explicitly connects an implicit orthogonal crossing and undo removes the junction", async ({ page }) => {
    const editor = page.locator(".schematic-editor");
    const drawWire = async (start: [number, number], end: [number, number]) => {
      const startPoint = await worldPoint(page, start);
      const endPoint = await worldPoint(page, end);
      await page.mouse.click(startPoint.x, startPoint.y);
      await page.mouse.move(endPoint.x, endPoint.y, { steps: 3 });
      await page.keyboard.press("Enter");
    };

    await page.locator('[data-tool="wire"]').click();
    await drawWire([22, 28], [30, 28]);
    await drawWire([26, 25], [26, 31]);
    await expect(page.locator('path.editor-wire[data-wire-id="w10"]')).toHaveAttribute("d", "M22 28 L30 28");
    await expect(page.locator('path.editor-wire[data-wire-id="w11"]')).toHaveAttribute("d", "M26 25 L26 31");
    await expect(page.locator('.connection-node.junction[cx="26"][cy="28"]')).toHaveCount(0);

    await page.locator('[data-tool="select"]').click();
    const crossing = await worldPoint(page, [26, 28]);
    await page.mouse.move(crossing.x, crossing.y);
    await page.keyboard.press("j");
    await expect(page.locator('.connection-node.junction[cx="26"][cy="28"]')).toHaveCount(1);
    await expect(page.locator('path.editor-wire[data-wire-id="w10"]')).toHaveAttribute("d", "M22 28 L26 28 L30 28");
    await expect(page.locator('path.editor-wire[data-wire-id="w11"]')).toHaveAttribute("d", "M26 25 L26 28 L26 31");

    await editor.press(undoShortcut);
    await expect(page.locator('path.editor-wire[data-wire-id="w10"]')).toHaveAttribute("d", "M22 28 L30 28");
    await expect(page.locator('path.editor-wire[data-wire-id="w11"]')).toHaveAttribute("d", "M26 25 L26 31");
    await expect(page.locator('.connection-node.junction[cx="26"][cy="28"]')).toHaveCount(0);
  });
});
