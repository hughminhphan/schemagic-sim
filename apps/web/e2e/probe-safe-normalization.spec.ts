import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

interface BundledExample {
  id: string;
  title: string;
  probeIds: string[];
}

const examplesDirectory = resolve(import.meta.dirname, "../../../examples");
const bundledExamples: BundledExample[] = readdirSync(examplesDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const document = JSON.parse(readFileSync(resolve(examplesDirectory, name), "utf8")) as { meta: { title: string }; probes: Array<{ id: string }> };
    return { id: name.replace(/\.json$/, ""), title: document.meta.title, probeIds: document.probes.map((probe) => probe.id) };
  });
const focusedExampleIds = new Set(["rc-filter-bode", "mosfet-led-switch"]);
for (const id of focusedExampleIds) if (!bundledExamples.some((example) => example.id === id)) throw new Error(`Required focused example ${id} is missing`);

const undoShortcut = process.platform === "darwin" ? "Meta+z" : "Control+z";

async function worldPoint(page: Page, point: [number, number]): Promise<{ x: number; y: number }> {
  return page.locator(".editor-world").evaluate((element, [x, y]) => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM();
    if (!matrix) throw new Error("World transform missing");
    const screen = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  }, point);
}

async function componentPoint(page: Page, id: string, point: [number, number] = [0, 0]): Promise<{ x: number; y: number }> {
  return page.locator(`[data-component-id="${id}"]`).evaluate((element, [x, y]) => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM();
    if (!matrix) throw new Error("Component transform missing");
    const screen = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  }, point);
}

async function renderedWires(page: Page): Promise<Array<{ id: string; points: Array<[number, number]> }>> {
  return page.locator("path.editor-wire").evaluateAll((paths) => paths.map((path) => ({
    id: path.getAttribute("data-wire-id") ?? "",
    points: [...(path.getAttribute("d") ?? "").matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map((match) => [Number(match[1]), Number(match[2])] as [number, number]),
  })));
}

async function loadExample(page: Page, id: string, waitForEngine = true): Promise<void> {
  await page.goto(`/#example=${id}`);
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
  await expect(page.locator(".schematic-editor")).toBeVisible();
  if (waitForEngine) await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

async function editAndWaitForSolve(page: Page, edit: () => Promise<void>): Promise<void> {
  const banner = page.locator("#engine-banner");
  const startedBefore = Number(await banner.getAttribute("data-solve-started") ?? 0);
  await edit();
  await expect.poll(async () => {
    const started = Number(await banner.getAttribute("data-solve-started") ?? 0);
    const completed = Number(await banner.getAttribute("data-solve-completed") ?? 0);
    return started > startedBefore && completed === started && await banner.getAttribute("data-engine-state") === "ready";
  }, { timeout: 45_000 }).toBe(true);
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

async function editAndWaitForReady(page: Page, edit: () => Promise<void>): Promise<void> {
  await edit();
  // Simulation scheduling is debounced. A connectivity-preserving drag may
  // regenerate an identical netlist, so readiness is authoritative even when
  // no distinct solve generation is observable.
  await page.waitForTimeout(50);
  const banner = page.locator("#engine-banner");
  await expect.poll(async () => {
    const started = Number(await banner.getAttribute("data-solve-started") ?? 0);
    const completed = Number(await banner.getAttribute("data-solve-completed") ?? 0);
    return completed === started && await banner.getAttribute("data-engine-state") === "ready";
  }, { timeout: 45_000 }).toBe(true);
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

async function placeResistor(page: Page): Promise<void> {
  const componentCount = await page.locator(".editor-component").count();
  await page.locator('[data-tool="resistor"]').click();
  const box = await page.locator("#editor-host").boundingBox();
  if (!box) throw new Error("Editor host is not visible");
  await page.mouse.click(box.x + box.width * 0.78, box.y + box.height * 0.78);
  await expect(page.locator(".editor-component")).toHaveCount(componentCount + 1);
  await expect(page.locator(".editor-component.selected")).toHaveCount(1);
}

async function expectNoDegenerateRenderedWires(page: Page): Promise<void> {
  const invalid = await page.locator("path.editor-wire").evaluateAll((paths) => paths.flatMap((path) => {
    const data = path.getAttribute("d") ?? "";
    const points = [...data.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map((match) => [Number(match[1]), Number(match[2])] as const);
    return points.length < 2 || points.every(([x, y]) => x === points[0]![0] && y === points[0]![1]) ? [data] : [];
  }));
  expect(invalid).toEqual([]);
}

async function expectProbeOutcomes(page: Page, probeIds: readonly string[]): Promise<void> {
  const outcomes = await page.evaluate((ids) => ids.map((id) => {
    const series = window.__ocSignalSeries?.find((candidate) => candidate.definition.id === id);
    return {
      id,
      resolved: Boolean(series),
      length: series?.signal.length ?? 0,
      finite: series ? [...series.signal.values].every(Number.isFinite) && [...series.axis.values].every(Number.isFinite) : false,
    };
  }), probeIds);
  const traceList = page.getByTestId("trace-list");
  for (const outcome of outcomes) {
    const trace = traceList.locator(`[data-trace-id="${outcome.id}"]`);
    await expect(trace, `${outcome.id} must remain in the circuit trace registry`).toHaveCount(1);
    if (outcome.resolved) {
      expect(outcome.length, `${outcome.id} must contain evaluated samples`).toBeGreaterThan(0);
      expect(outcome.finite, `${outcome.id} must contain finite signal and axis samples`).toBe(true);
      await expect(trace.locator("[data-trace-evaluation]")).toHaveCount(0);
      continue;
    }
    const unsupported = trace.locator('[data-trace-evaluation="UNSUPPORTED"]');
    await expect(unsupported, `${outcome.id} must expose an explicit unsupported result`).toHaveCount(1);
    await expect(unsupported).toContainText(/analysis|available|current|power|provide|requires|signal|use|vector/i);
  }
}

test.describe("probe-safe normalization", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Installed-Chrome normalization coverage runs once");

  test("RC placement and deletion normalize legacy wires and return ENGINE READY", async ({ page }) => {
    test.setTimeout(180_000);
    await loadExample(page, "rc-filter-bode");

    await placeResistor(page);
    await expectNoDegenerateRenderedWires(page);

    await editAndWaitForSolve(page, async () => {
      await page.locator(".schematic-editor").press("Delete");
    });
    await expectNoDegenerateRenderedWires(page);
    await expectProbeOutcomes(page, ["p1", "p2"]);
    await expect(page.locator("#engine-status")).toContainText("ENGINE READY");
  });

  test("RC coincident ground stays connected through a real pointer drag and undo", async ({ page }) => {
    test.setTimeout(180_000);
    await loadExample(page, "rc-filter-bode");

    const untouchedLegacyWires = await renderedWires(page);
    const groundBody = await componentPoint(page, "c4", [0, 1]);
    await page.mouse.click(groundBody.x, groundBody.y);
    expect(await renderedWires(page), "a selection-only click must not rewrite the coincident connection").toEqual(untouchedLegacyWires);

    // Force the legacy duplicated-point ground wire through normalization. The
    // source and ground remain electrically connected only by coincident pins.
    await placeResistor(page);
    await editAndWaitForReady(page, async () => {
      await page.locator(".schematic-editor").press("Delete");
    });
    await expectNoDegenerateRenderedWires(page);
    await expect(page.locator('[data-pin-hit][data-pin-component="c1"][data-pin-index="1"]')).toHaveAttribute("cx", "8");
    await expect(page.locator('[data-pin-hit][data-pin-component="c1"][data-pin-index="1"]')).toHaveAttribute("cy", "22");
    const normalizedWires = await renderedWires(page);
    expect(normalizedWires.some(({ points }) => points.some(([x, y]) => x === 8 && y === 22)), "normalization must remove the legacy wire at the coincident pins").toBe(false);
    const normalizedWireCount = normalizedWires.length;

    const dragStart = await componentPoint(page, "c4", [0, 1]);
    const dragEnd = await worldPoint(page, [12, 23]);
    await editAndWaitForReady(page, async () => {
      await page.mouse.move(dragStart.x, dragStart.y);
      await page.mouse.down();
      await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 6 });
      await page.mouse.up();
    });

    await expect(page.locator('[data-component-id="c4"]')).toHaveAttribute("data-anchor-x", "12");
    await expect(page.locator('[data-component-id="c4"]')).toHaveAttribute("data-anchor-y", "22");
    await expectNoDegenerateRenderedWires(page);
    const connectedAfterDrag = (await renderedWires(page)).find(({ points }) => {
      const first = points[0];
      const last = points.at(-1);
      return points.length >= 2 && first && last && (
        first[0] === 8 && first[1] === 22 && last[0] === 12 && last[1] === 22
        || first[0] === 12 && first[1] === 22 && last[0] === 8 && last[1] === 22
      );
    });
    expect(connectedAfterDrag, "dragging a coincident ground must materialize a connector to the fixed VIN pin").toBeDefined();
    await expect(page.locator("path.editor-wire")).toHaveCount(normalizedWireCount + 1);
    expect(await page.evaluate(() => window.__ocLastNetlist ?? "")).toMatch(/^V1\s+in\s+0\b/m);
    await expect(page.locator(".error-toast")).toHaveCount(0);
    await expect(page.locator("#engine-status")).toContainText("ENGINE READY");

    await editAndWaitForReady(page, async () => {
      await page.locator(".schematic-editor").press(undoShortcut);
    });
    await expect(page.locator('[data-component-id="c4"]')).toHaveAttribute("data-anchor-x", "8");
    await expect(page.locator('[data-component-id="c4"]')).toHaveAttribute("data-anchor-y", "22");
    await expect(page.locator("path.editor-wire")).toHaveCount(normalizedWireCount);
    await expectNoDegenerateRenderedWires(page);
    expect(await renderedWires(page)).toEqual(normalizedWires);
    expect(await page.evaluate(() => window.__ocLastNetlist ?? "")).toMatch(/^V1\s+in\s+0\b/m);
    await expect(page.locator("#engine-status")).toContainText("ENGINE READY");
  });

  test("MOSFET LED p2 remains resolvable after a normalization-triggering edit", async ({ page }) => {
    test.setTimeout(180_000);
    await loadExample(page, "mosfet-led-switch", false);
    await editAndWaitForSolve(page, async () => {
      await page.locator('[data-mode="op"]').click();
    });
    await expect.poll(() => page.evaluate(() => window.__ocSignalSeries?.find((series) => series.definition.id === "p2")?.signal.length ?? 0), { timeout: 45_000 }).toBeGreaterThan(0);

    await page.locator("#instrument-toggle").click();
    const workbench = page.getByTestId("measurement-workbench");
    const p2Trace = workbench.getByTestId("trace-list").locator('[data-trace-id="p2"]');
    await expect(p2Trace).toHaveAttribute("data-expression-positive", "wire:w8");
    await p2Trace.locator('[data-trace-action="select"]').click();
    await workbench.getByTestId("measurement-name").fill("p2 normalization maximum");
    await workbench.getByTestId("measurement-kind").selectOption("maximum");
    await workbench.getByTestId("add-measurement").click();
    await workbench.getByTestId("trigger-enabled").check();
    await expect(workbench.getByTestId("trigger-source")).toHaveValue("p2");
    await page.locator("#instrument-toggle").click();

    await placeResistor(page);
    await expectNoDegenerateRenderedWires(page);
    await editAndWaitForSolve(page, async () => {
      await page.locator(".schematic-editor").press("Delete");
    });

    await expectNoDegenerateRenderedWires(page);
    await expect.poll(() => page.evaluate(() => window.__ocSignalSeries?.find((series) => series.definition.id === "p2")?.signal.length ?? 0), { timeout: 45_000 }).toBeGreaterThan(0);
    await expectProbeOutcomes(page, ["p1", "p2"]);
    await page.locator("#instrument-toggle").click();
    await expect(p2Trace).toHaveAttribute("data-expression-positive", "wire:migration-v1-v2-1");
    await expect(workbench.getByTestId("measurement-results").getByRole("row", { name: /p2 normalization maximum/ })).not.toContainText("NOT_FOUND");
    await expect(workbench.getByTestId("trigger-source")).toHaveValue("p2");
    await expect(workbench).not.toContainText("Unavailable saved source");
    await expect(workbench.locator('[data-trace-evaluation="NOT_FOUND"]')).toHaveCount(0);
    await expect(page.locator("#engine-status")).toContainText("ENGINE READY");
  });

  for (const example of bundledExamples.filter(({ id }) => !focusedExampleIds.has(id))) {
    test(`${example.title} survives a real normalization edit with honest probe outcomes`, async ({ page }) => {
      test.setTimeout(180_000);
      await loadExample(page, example.id, false);
      await editAndWaitForSolve(page, async () => {
        await page.locator('[data-mode="op"]').click();
      });

      await placeResistor(page);
      await expectNoDegenerateRenderedWires(page);
      await editAndWaitForSolve(page, async () => {
        await page.locator(".schematic-editor").press("Delete");
      });

      await expectNoDegenerateRenderedWires(page);
      await expect(page.locator(".error-toast")).toHaveCount(0);
      await expectProbeOutcomes(page, example.probeIds);
      await expect(page.locator("#engine-status")).toContainText("ENGINE READY");
    });
  }
});
