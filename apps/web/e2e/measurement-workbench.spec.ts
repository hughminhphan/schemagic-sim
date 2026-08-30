import { expect, test, type Locator, type Page } from "@playwright/test";

const browserExecutable = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
if (browserExecutable) test.use({ launchOptions: { executablePath: browserExecutable } });

async function waitForSolve(page: Page, action: () => Promise<void>): Promise<void> {
  const banner = page.getByTestId("engine-banner");
  const completed = await banner.getAttribute("data-solve-completed");
  await action();
  await expect.poll(() => banner.getAttribute("data-solve-completed"), { timeout: 45_000 }).not.toBe(completed);
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

async function loadRcExample(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Examples" }).click();
  await waitForSolve(page, () => page.getByRole("button", { name: /RC low-pass Bode plot/ }).click());
  await expect(page.getByRole("dialog", { name: "Example circuits" })).toBeHidden();
}

async function commitInput(input: Locator, value: string): Promise<void> {
  await input.fill(value);
  await input.press("Tab");
}

async function canvasPoint(page: Page, point: [number, number]): Promise<{ x: number; y: number }> {
  return page.locator("#editor-host").evaluate((element, [xRatio, yRatio]) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width * xRatio, y: rect.top + rect.height * yRatio };
  }, point);
}

async function realPointerClick(page: Page, point: { x: number; y: number }, modifiers: readonly ("Shift" | "Alt")[] = []): Promise<void> {
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  try {
    await page.mouse.click(point.x, point.y);
  } finally {
    for (const modifier of [...modifiers].reverse()) await page.keyboard.up(modifier);
  }
}

async function clickWire(page: Page, wireId: string, modifiers: readonly ("Shift" | "Alt")[] = []): Promise<void> {
  const point = await page.locator(`path.editor-hit[data-wire-id="${wireId}"]`).evaluate((element) => {
    const path = element as SVGPathElement;
    const local = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("Wire transform is unavailable");
    const screen = local.matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  });
  await realPointerClick(page, point, modifiers);
}

async function clickComponent(page: Page, componentId: string, modifiers: readonly ("Shift" | "Alt")[] = []): Promise<void> {
  const point = await page.locator(`[data-component-id="${componentId}"] .editor-component-hit`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= rect.height
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.75 }
      : { x: rect.left + rect.width * 0.75, y: rect.top + rect.height / 2 };
  });
  await realPointerClick(page, point, modifiers);
}

async function clickPin(page: Page, componentId: string, pinIndex: number, modifiers: readonly ("Shift" | "Alt")[] = []): Promise<void> {
  const point = await page.locator(`[data-pin-hit][data-pin-component="${componentId}"][data-pin-index="${pinIndex}"]`).evaluate((element) => {
    const circle = element as SVGCircleElement;
    const matrix = circle.getScreenCTM();
    if (!matrix) throw new Error("Pin transform is unavailable");
    const screen = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  });
  await realPointerClick(page, point, modifiers);
}

async function toggleMeasurements(page: Page): Promise<void> {
  const point = await page.getByRole("button", { name: "Measurements" }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
}

async function openMeasurements(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: "Measurements" });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggleMeasurements(page);
  await expect(page.getByTestId("measurement-workbench")).toBeVisible();
}

test.describe("measurement workbench real-input acceptance", () => {
  test("RC filter target, measurements, transforms, cursors, profiles, and before/after", async ({ page }) => {
    test.slow();
    await loadRcExample(page);
    const namedNetlist = await page.evaluate(() => window.__ocLastNetlist);
    expect(namedNetlist).toMatch(/^V\S*\s+in\s+0\s+/im);
    expect(namedNetlist).toMatch(/^R\S*\s+in\s+\S+\s+/im);
    expect(namedNetlist).toMatch(/^VOCS\S*\s+\S+\s+out\s+0/im);
    expect(namedNetlist).toMatch(/^C\S*\s+out\s+\S+\s+/im);

    await toggleMeasurements(page);
    const workbench = page.getByTestId("measurement-workbench");
    await expect(workbench).toBeVisible();
    const measureMode = workbench.getByTestId("measure-mode-toggle");
    await measureMode.click();
    await expect(measureMode).toHaveAttribute("aria-pressed", "true");

    await clickWire(page, "w2");
    await toggleMeasurements(page);
    await expect(workbench.getByTestId("measurement-target")).toHaveAttribute("data-measure-target-kind", "wire");
    await expect(workbench.getByTestId("measurement-target")).toHaveAttribute("data-measure-target-id", "w2");
    await expect(workbench.getByTestId("measurement-sign")).toContainText("+ on wire w2");
    await expect(workbench.getByTestId("measurement-sign")).toContainText("− at ground");

    await toggleMeasurements(page);
    await clickWire(page, "w1");
    await toggleMeasurements(page);
    await expect.poll(() => workbench.getByTestId("trace-list").locator("[data-trace-id]").count()).toBeGreaterThanOrEqual(2);

    await workbench.getByTestId("measurement-expression").fill("db20(mag(V(out)/V(in)))");
    await workbench.getByTestId("add-trace").click();
    await workbench.getByTestId("measurement-name").fill("−3 dB corner");
    await workbench.getByTestId("measurement-kind").selectOption("x-at-level");
    const crossing = workbench.getByTestId("x-at-level-controls");
    await expect(crossing).toBeVisible();
    await expect(crossing.getByTestId("measurement-threshold")).toHaveValue("-3");
    await expect(crossing.getByTestId("measurement-direction")).toHaveValue("falling");
    await expect(crossing.getByTestId("measurement-ordinal")).toHaveValue("1");
    await workbench.getByTestId("add-measurement").click();
    const cornerRow = workbench.getByTestId("measurement-results").getByRole("row", { name: /−3 dB corner/ });
    await expect(cornerRow).toContainText("OK");
    await expect(cornerRow).toContainText("Hz");

    const outputTrace = workbench.getByTestId("trace-list").locator('[data-trace-id="p2"]');
    const inputTrace = workbench.getByTestId("trace-list").locator('[data-trace-id="p1"]');
    await expect(inputTrace).toContainText("V(in) · V");
    await expect(inputTrace).toHaveAttribute("data-expression-positive", "wire:w1");
    await expect(outputTrace).toContainText("V(out) · V");
    await expect(outputTrace).toHaveAttribute("data-expression-kind", "voltage");
    await expect(outputTrace).toHaveAttribute("data-expression-positive", "wire:w2");
    await expect(outputTrace).toHaveAttribute("data-expression-negative", "node:0");
    await outputTrace.locator('[data-trace-action="select"]').click();
    await workbench.getByTestId("measurement-name").fill("Output phase");
    await workbench.getByTestId("measurement-kind").selectOption("phase");
    const phaseControls = workbench.getByTestId("phase-controls");
    await expect(phaseControls).toBeVisible();
    await phaseControls.getByTestId("measurement-phase-reference").fill("V(in)");
    await phaseControls.getByTestId("measurement-phase-frequency").fill("1592");
    await phaseControls.getByTestId("measurement-phase-unwrap").check();
    await workbench.getByTestId("add-measurement").click();
    const phaseRow = workbench.getByTestId("measurement-results").getByRole("row", { name: /Output phase/ });
    await expect(phaseRow).toContainText("vs V(in) @ 1592 Hz; unwrapped");
    await expect(phaseRow).toContainText("OK");
    await expect(phaseRow).toContainText("deg");

    await workbench.getByTestId("trace-list").locator('[data-trace-id="p1"]').getByRole("button", { name: /^Remove / }).click();
    await expect(workbench.getByTestId("trace-list").locator('[data-trace-id="p1"]')).toHaveCount(0);

    await toggleMeasurements(page);
    await clickPin(page, "c2", 0);
    await toggleMeasurements(page);
    const pinVoltage = workbench.getByTestId("trace-list").locator('[data-trace-id="p3"]');
    await expect(workbench.getByTestId("measurement-target")).toHaveAttribute("data-measure-target-kind", "pin");
    await expect(pinVoltage).toHaveAttribute("data-expression-kind", "voltage");
    await expect(pinVoltage).toHaveAttribute("data-expression-positive", "pin:c2:0");
    await expect(pinVoltage).toHaveAttribute("data-expression-negative", "node:0");
    await expect(workbench.getByTestId("measurement-sign")).toContainText("+ on c2 pin 1");
    await expect(workbench.getByTestId("measurement-sign")).toContainText("− at ground");

    await toggleMeasurements(page);
    await clickPin(page, "c2", 1, ["Shift"]);
    await toggleMeasurements(page);
    const differentialVoltage = workbench.getByTestId("trace-list").locator('[data-trace-id="p4"]');
    await expect(differentialVoltage).toHaveAttribute("data-expression-kind", "voltage");
    await expect(differentialVoltage).toHaveAttribute("data-expression-positive", "pin:c2:1");
    await expect(differentialVoltage).toHaveAttribute("data-expression-negative", "pin:c2:0");
    await expect(workbench.getByTestId("measurement-sign")).toContainText("+ on c2 pin 2");
    await expect(workbench.getByTestId("measurement-sign")).toContainText("− at c2 pin 1");

    await toggleMeasurements(page);
    await clickComponent(page, "c2");
    await toggleMeasurements(page);
    const deviceCurrent = workbench.getByTestId("trace-list").locator('[data-trace-id="p5"]');
    await expect(workbench.getByTestId("measurement-target")).toHaveAttribute("data-measure-target-kind", "component");
    await expect(deviceCurrent).toHaveAttribute("data-expression-kind", "current");
    await expect(deviceCurrent).toHaveAttribute("data-expression-component", "c2");
    await expect(deviceCurrent).not.toHaveAttribute("data-expression-terminal", /.+/);
    await expect(workbench.getByTestId("measurement-sign")).toContainText(/positive current enters/i);
    await expect(workbench.getByTestId("measurement-sign")).toContainText(/positive means.*absorbs power/i);

    await toggleMeasurements(page);
    await clickPin(page, "c2", 1, ["Alt"]);
    await toggleMeasurements(page);
    const terminalCurrent = workbench.getByTestId("trace-list").locator('[data-trace-id="p6"]');
    await expect(workbench.getByTestId("measurement-target")).toHaveAttribute("data-measure-target-kind", "pin");
    await expect(terminalCurrent).toHaveAttribute("data-expression-kind", "current");
    await expect(terminalCurrent).toHaveAttribute("data-expression-component", "c2");
    await expect(terminalCurrent).toHaveAttribute("data-expression-terminal", "1");
    await expect(workbench.getByTestId("measurement-sign")).toContainText(/positive current enters/i);

    await toggleMeasurements(page);
    await clickComponent(page, "c2", ["Alt"]);
    await toggleMeasurements(page);
    const absorbedPower = workbench.getByTestId("trace-list").locator('[data-trace-id="p7"]');
    await expect(workbench.getByTestId("measurement-target")).toHaveAttribute("data-measure-target-kind", "component");
    await expect(absorbedPower).toHaveAttribute("data-expression-kind", "power");
    await expect(absorbedPower).toHaveAttribute("data-expression-component", "c2");
    await expect(workbench.getByTestId("measurement-sign")).toContainText(/positive means.*absorbs power/i);
    await expect(workbench.getByTestId("measurement-sign")).toContainText(/negative means.*delivers power/i);

    await waitForSolve(page, () => workbench.getByTestId("workbench-run").click());
    for (const traceId of ["p2", "p3", "p4", "p5", "p6", "p7"]) {
      const row = workbench.getByTestId("trace-list").locator(`[data-trace-id="${traceId}"]`);
      await expect(row.locator("[data-trace-evaluation]")).toHaveCount(0);
      await expect(page.locator(`.oc-waveform-viewer__trace[data-trace-id^="current:${traceId}:"]`)).toBeVisible();
    }

    const transferTraceId = await workbench.getByTestId("trace-list")
      .locator('[data-trace-id^="trace-"]')
      .filter({ hasText: "db20" })
      .first()
      .getAttribute("data-trace-id");
    expect(transferTraceId).toBeTruthy();
    await workbench.getByTestId("trigger-enabled").check();
    await workbench.getByTestId("trigger-source").selectOption(transferTraceId!);
    await workbench.getByTestId("trigger-mode").selectOption("normal");
    await workbench.getByTestId("trigger-edge").selectOption("falling");
    await commitInput(workbench.getByTestId("trigger-level"), "-3");
    await expect(workbench.getByTestId("trigger-status")).toHaveAttribute("data-axis-unit", "Hz");
    await expect(workbench.getByTestId("trigger-status")).toContainText("Hz");

    await toggleMeasurements(page);
    await clickWire(page, "w2");
    await waitForSolve(page, () => page.locator('[data-mode="tran"]').click());
    await toggleMeasurements(page);
    await waitForSolve(page, () => workbench.getByTestId("workbench-run").click());
    await expect(workbench.getByTestId("save-capture")).toBeEnabled({ timeout: 45_000 });
    for (const traceId of ["p2", "p3", "p4", "p5", "p6", "p7"]) {
      const row = workbench.getByTestId("trace-list").locator(`[data-trace-id="${traceId}"]`);
      await expect(row.locator("[data-trace-evaluation]")).toHaveCount(0);
      await expect(page.locator(`.oc-waveform-viewer__trace[data-trace-id^="current:${traceId}:"]`)).toBeVisible();
    }

    for (const measurement of [{ name: "Output P2P", kind: "peak-to-peak" }, { name: "Output RMS", kind: "rms" }] as const) {
      await workbench.getByTestId("measurement-name").fill(measurement.name);
      await workbench.getByTestId("measurement-kind").selectOption(measurement.kind);
      await workbench.getByTestId("add-measurement").click();
      const row = workbench.getByTestId("measurement-results").getByRole("row", { name: new RegExp(measurement.name) });
      await expect(row).toContainText("OK", { timeout: 45_000 });
      await expect(row).toContainText(/[0-9]/);
    }

    await workbench.getByTestId("measurement-name").fill("Output rise time");
    await workbench.getByTestId("measurement-kind").selectOption("rise-time");
    const riseControls = workbench.getByTestId("rise-fall-controls");
    await expect(riseControls).toBeVisible();
    await riseControls.getByTestId("measurement-low-threshold").fill("0.2");
    await riseControls.getByTestId("measurement-high-threshold").fill("0.8");
    await riseControls.getByTestId("measurement-transition-ordinal").fill("1");
    await workbench.getByTestId("add-measurement").click();
    const riseRow = workbench.getByTestId("measurement-results").getByRole("row", { name: /Output rise time/ });
    await expect(riseRow).toContainText("0.2→0.8; transition 1");
    await expect(riseRow).toContainText("OK");
    await expect(riseRow).toContainText("s");

    await workbench.getByTestId("measurement-name").fill("Output settling time");
    await workbench.getByTestId("measurement-kind").selectOption("settling-time");
    const settlingControls = workbench.getByTestId("step-response-controls");
    await expect(settlingControls).toBeVisible();
    await settlingControls.getByTestId("measurement-initial").fill("0");
    await settlingControls.getByTestId("measurement-final").fill("1");
    await settlingControls.getByTestId("measurement-tolerance-kind").selectOption("step-percent");
    await settlingControls.getByTestId("measurement-tolerance").fill("5");
    await workbench.getByTestId("add-measurement").click();
    const settlingRow = workbench.getByTestId("measurement-results").getByRole("row", { name: /Output settling time/ });
    await expect(settlingRow).toContainText("0→1; ±5% step");
    await expect(settlingRow).toContainText("OK");
    await expect(settlingRow).toContainText("s");

    await workbench.getByTestId("trigger-enabled").check();
    await workbench.getByTestId("trigger-source").selectOption("p3");
    await workbench.getByTestId("trigger-mode").selectOption("normal");
    await workbench.getByTestId("trigger-edge").selectOption("rising");
    await commitInput(workbench.getByTestId("trigger-level"), "0.5");
    await commitInput(workbench.getByTestId("trigger-holdoff"), "100u");
    await commitInput(workbench.getByTestId("trigger-pretrigger"), "125");
    await expect(workbench.getByTestId("trigger-pretrigger")).toHaveAttribute("aria-invalid", "true");
    await expect(workbench.getByTestId("trigger-config-diagnostic")).toContainText("between 0% and 100%");
    await commitInput(workbench.getByTestId("trigger-pretrigger"), "25%");
    await commitInput(workbench.getByTestId("trigger-window-duration"), "2m");
    await expect(workbench.getByTestId("trigger-holdoff")).toHaveValue("0.0001");
    await expect(workbench.getByTestId("trigger-pretrigger")).toHaveValue("25");
    await expect(workbench.getByTestId("trigger-window-duration")).toHaveValue("0.002");
    await expect(workbench.getByTestId("trigger-source")).toHaveValue("p3");
    await expect(workbench.getByTestId("trigger-status")).toHaveAttribute("data-axis-unit", "s");
    await expect(workbench.getByTestId("trigger-status")).toContainText(/Trigger (triggered|waiting)/);

    const layout = workbench.getByTestId("plot-layout");
    await layout.selectOption("overlay");
    await expect(page.locator(".oc-waveform-viewer")).toHaveAttribute("data-diagnostic-count", /\d+/);
    await layout.selectOption("stack");
    await layout.selectOption("split");

    const plotMode = workbench.getByTestId("plot-mode");
    await plotMode.selectOption("spectrum");
    await commitInput(workbench.getByTestId("fft-samples"), "1024");
    await workbench.getByTestId("fft-window").selectOption("hann");
    await workbench.getByTestId("fft-db").check();
    await expect(page.locator('.oc-waveform-viewer__trace[data-trace-id^="fft:"]')).toContainText("spectrum", { timeout: 45_000 });

    await plotMode.selectOption("xy");
    await workbench.getByTestId("xy-x").selectOption("p2");
    await workbench.getByTestId("xy-y").selectOption("p3");
    await expect(workbench.getByTestId("xy-order-status")).toHaveText("Source sample order is preserved.");
    await expect(page.locator('.oc-waveform-viewer__trace[data-trace-id="xy:series"]')).toBeVisible();
    await plotMode.selectOption("vi");
    await workbench.getByTestId("xy-y").selectOption("p5");
    await expect(workbench.getByTestId("xy-order-status")).toHaveAttribute("data-xy-status", "invalid");
    await expect(workbench.getByTestId("xy-order-status")).toContainText("same-device pin-to-pin voltage");
    await expect(page.locator('.oc-waveform-viewer__trace[data-trace-id="xy:series"]')).toHaveCount(0);
    await workbench.getByTestId("xy-x").selectOption("p4");
    await workbench.getByTestId("xy-y").selectOption("p6");
    await expect(workbench.getByTestId("xy-order-status")).toHaveAttribute("data-xy-status", "valid");
    await expect(workbench.getByTestId("xy-order-status")).toContainText("c2 terminal 2");
    await expect(page.locator('.oc-waveform-viewer__trace[data-trace-id="xy:series"]')).toContainText("Device characteristic");

    await plotMode.selectOption("time");
    await toggleMeasurements(page);
    const plot = page.locator(".oc-waveform-viewer__canvas-wrap");
    await plot.focus();
    await plot.press("a");
    await plot.press("b");
    await plot.press("Shift+ArrowLeft");
    await expect(page.locator('[data-cursor="a"]').first()).not.toContainText("off");
    await expect(page.locator('[data-cursor="b"]').first()).not.toContainText("off");
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("table", { name: "Cursor measurement results" })).toBeVisible();
    await page.getByRole("button", { name: "Clear Cursor A" }).click();
    await expect(page.locator('[data-cursor="a"]').first()).toContainText("off");
    await toggleMeasurements(page);

    await workbench.getByTestId("profile-name").fill("RC acceptance");
    await workbench.getByTestId("save-profile").click();
    await expect(workbench.getByTestId("profile-select")).toContainText("RC acceptance");
    await toggleMeasurements(page);
    await page.getByRole("button", { name: "Clear Cursor B" }).click();
    await expect(page.locator('[data-cursor="b"]').first()).toContainText("off");
    await toggleMeasurements(page);
    await workbench.getByTestId("profile-select").selectOption("default");
    await expect(page.locator('[data-cursor="b"]').first()).not.toContainText("off");
    await toggleMeasurements(page);
    await waitForSolve(page, () => page.locator('[data-mode="ac"]').click());
    await toggleMeasurements(page);
    await waitForSolve(page, () => workbench.getByTestId("profile-select").selectOption({ label: "RC acceptance" }));
    await expect(page.locator('[data-mode="tran"]')).toHaveAttribute("aria-selected", "true");
    const restoredProfileNetlist = await page.evaluate(() => window.__ocLastNetlist);
    expect(restoredProfileNetlist).toMatch(/\.tran\s+0\.000005\s+0\.01\s+0\s+0\.000005/i);
    await expect(page.locator('[data-cursor="b"]').first()).toContainText("off");

    await toggleMeasurements(page);
    await plot.focus();
    await plot.press("b");
    await expect(page.locator('[data-cursor="b"]').first()).not.toContainText("off");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
    await page.getByRole("button", { name: "Share URL" }).click();
    await expect(page.locator("#engine-status")).toContainText("Share URL copied");
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toContain("#c=");
    await page.goto(sharedUrl);
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await openMeasurements(page);
    await expect(workbench.getByTestId("profile-select")).toHaveValue(/profile-/);
    await expect(workbench.getByTestId("profile-select").locator("option:checked")).toHaveText("RC acceptance");
    await expect(workbench.getByTestId("measurement-results")).toContainText("−3 dB corner");
    await expect(workbench.getByTestId("measurement-results")).toContainText("Output rise time");
    await expect(workbench.getByTestId("trigger-holdoff")).toHaveValue("0.0001");
    await expect(workbench.getByTestId("trigger-pretrigger")).toHaveValue("25");
    await expect(workbench.getByTestId("trigger-window-duration")).toHaveValue("0.002");
    await expect(workbench.getByTestId("trigger-source")).toHaveValue("p3");
    await expect(page.locator('[data-cursor="b"]').first()).not.toContainText("off");

    await page.reload();
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await openMeasurements(page);
    await expect(workbench.getByTestId("profile-select").locator("option:checked")).toHaveText("RC acceptance");
    await expect(workbench.getByTestId("measurement-results")).toContainText("Output settling time");
    await expect(workbench.getByTestId("trigger-source")).toHaveValue("p3");
    await expect(page.locator('[data-cursor="b"]').first()).not.toContainText("off");

    await workbench.getByTestId("capture-name").fill("Before");
    await workbench.getByTestId("save-capture").click();
    await expect(workbench.getByTestId("capture-list")).toContainText("Before");

    await measureMode.click();
    await toggleMeasurements(page);
    await clickComponent(page, "c2");
    await waitForSolve(page, async () => commitInput(page.locator("#component-value"), "2k"));
    await toggleMeasurements(page);
    await waitForSolve(page, () => workbench.getByTestId("workbench-run").click());
    await workbench.getByTestId("capture-name").fill("After");
    await workbench.getByTestId("save-capture").click();
    await expect(workbench.getByTestId("capture-list")).toContainText("After");
    await workbench.getByTestId("comparison-baseline").selectOption({ label: "Before" });
    await workbench.getByTestId("comparison-current").selectOption({ label: "After" });
    await expect(workbench.getByTestId("comparison-status")).toContainText("Before/after overlay active");
    await expect(page.locator('[data-comparison-role="baseline"]').first()).toBeVisible();

    // Captures are intentionally excluded from immutable Share URLs. Open the
    // persisted workspace route so pagehide flush and IndexedDB recovery are
    // exercised with the same workspace identity.
    await page.waitForTimeout(350);
    await page.goto("/");
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await openMeasurements(page);
    await expect(page.locator('[data-mode="tran"]')).toHaveAttribute("aria-selected", "true");
    await expect(workbench.getByTestId("profile-select").locator("option:checked")).toHaveText("RC acceptance");
    await expect(workbench.getByTestId("measurement-results")).toContainText("−3 dB corner");
    await expect(workbench.getByTestId("measurement-results")).toContainText("Output settling time");
    await expect(workbench.getByTestId("capture-list")).toContainText("Before");
    await expect(workbench.getByTestId("capture-list")).toContainText("After");
    await expect(workbench.getByTestId("comparison-baseline").locator("option:checked")).toHaveText("Before");
    await expect(workbench.getByTestId("comparison-current").locator("option:checked")).toHaveText("After");
    await expect(workbench.getByTestId("comparison-status")).toContainText("Before/after overlay active");
    await expect(page.locator('[data-comparison-role="baseline"]').first()).toBeVisible();

    await openMeasurements(page);
    const traceList = workbench.getByTestId("trace-list");
    const localExpressionTrace = traceList.locator('[data-trace-id^="trace-"]').filter({ hasText: "db20" }).first();
    const circuitTrace = traceList.locator('[data-trace-id="p2"]');
    await expect(localExpressionTrace).toBeVisible();
    await expect(circuitTrace).toBeVisible();
    const markerCount = await page.locator(".scope-probe-marker").count();
    await circuitTrace.getByRole("button", { name: /^Remove / }).click();
    await expect(circuitTrace).toHaveCount(0);
    await expect(localExpressionTrace).toBeVisible();
    await expect(page.locator(".scope-probe-marker")).toHaveCount(markerCount - 1);
  });

  test("real inspector inputs cover transient, source waveforms, AC stimulus, and noise temperature", async ({ page }) => {
    test.slow();
    await loadRcExample(page);

    await toggleMeasurements(page);
    const workbench = page.getByTestId("measurement-workbench");
    const measureMode = workbench.getByTestId("measure-mode-toggle");
    await measureMode.click();
    await clickComponent(page, "c2");
    await toggleMeasurements(page);
    await expect(workbench.getByTestId("trace-list").locator('[data-trace-id="p3"]')).toBeVisible();
    await measureMode.click();
    await toggleMeasurements(page);

    await clickComponent(page, "c1");
    const pulse = page.getByTestId("pulse-waveform-fields");
    await expect(pulse).toBeVisible();
    await commitInput(pulse.locator('[data-source-param="rise"]'), "5u");
    await commitInput(pulse.locator('[data-source-param="width"]'), "500u");
    await commitInput(pulse.locator('[data-source-param="period"]'), "2m");
    await expect(page.getByTestId("pulse-waveform-fields").locator('[data-source-param="period"]')).toHaveValue("0.002");

    await page.locator('[data-tool="vsource_sine"]').click();
    const placement = await canvasPoint(page, [0.82, 0.72]);
    await page.mouse.click(placement.x, placement.y);
    const sine = page.getByTestId("sine-waveform-fields");
    await expect(sine).toBeVisible();
    await commitInput(sine.locator('[data-source-param="offset"]'), "250m");
    await commitInput(sine.locator('[data-source-value="true"]'), "2");
    await commitInput(sine.locator('[data-source-param="frequency"]'), "2k");
    await expect(page.getByTestId("sine-waveform-fields").locator('[data-source-param="frequency"]')).toHaveValue("2000");
    await page.locator(".schematic-editor").press("Escape");
    await page.locator('[data-tool="select"]').click();

    const acSource = page.locator("#ac-source");
    const sourceOptions = await acSource.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(sourceOptions.length).toBeGreaterThanOrEqual(2);
    await acSource.selectOption(sourceOptions.at(-1)!);
    await page.locator("#ac-source").selectOption("c1");
    await clickComponent(page, "c6");
    await page.locator(".schematic-editor").press("Delete");
    await expect(page.locator('[data-component-id="c6"]')).toHaveCount(0);

    await clickComponent(page, "c1");
    await commitInput(page.locator('[data-sim="tran-maxstep"]'), "10u");
    await commitInput(page.locator('[data-sim="ac-magnitude"]'), "2");
    await commitInput(page.locator('[data-sim="ac-phase"]'), "45");
    await commitInput(page.locator('[data-sim="ac-fstart"]'), "20");
    await commitInput(page.locator('[data-sim="ac-fstop"]'), "200k");
    await waitForSolve(page, () => commitInput(page.locator('[data-sim="ac-points"]'), "20"));
    await expect(page.locator('[data-sim="ac-points"]')).toHaveValue("20");

    await expect.poll(() => page.evaluate(() => window.__ocLastNetlist), { timeout: 45_000 })
      .toMatch(/\.ac dec 20 20 200000/i);
    const acNetlist = await page.evaluate(() => window.__ocLastNetlist);
    expect(acNetlist).toMatch(/AC 2 45/i);
    expect(acNetlist).toMatch(/\.ac dec 20 20 200000/i);

    await waitForSolve(page, () => page.locator('[data-mode="tran"]').click());
    const transientNetlist = await page.evaluate(() => window.__ocLastNetlist);
    expect(transientNetlist).toMatch(/\.tran\s+\S+\s+\S+\s+0\s+0\.00001/i);

    await waitForSolve(page, () => page.locator('[data-mode="noise"]').click());
    await expect(page.getByTestId("noise-panel")).toBeVisible();
    await commitInput(page.locator("#noise-temperature"), "42");
    await waitForSolve(page, () => page.getByRole("button", { name: "Run noise" }).click());
    const noiseNetlist = await page.evaluate(() => window.__ocLastNetlist);
    expect(noiseNetlist).toMatch(/\.temp 42/i);

    await toggleMeasurements(page);
    const currentTrace = workbench.getByTestId("trace-list").locator('[data-trace-id="p3"]');
    const unsupported = currentTrace.locator("[data-trace-evaluation]");
    await expect(unsupported).toHaveAttribute("data-trace-evaluation", /UNSUPPORTED|NOT_FOUND/);
    await expect(unsupported).toContainText(/current|power|signal|vector/i);
    await toggleMeasurements(page);
    await waitForSolve(page, () => page.locator('[data-mode="tran"]').click());
    await toggleMeasurements(page);
    await expect(currentTrace.locator("[data-trace-evaluation]")).toHaveCount(0);
  });

  test("desktop measurement drawer preserves the complete waveform toolbar and mixed-unit plot height", async ({ page }) => {
    await loadRcExample(page);
    await openMeasurements(page);
    const workbench = page.getByTestId("measurement-workbench");

    await workbench.getByTestId("measurement-expression").fill("db20(mag(V(out)/V(in)))");
    await workbench.getByTestId("add-trace").click();
    await workbench.getByTestId("measurement-name").fill("−3 dB corner");
    await workbench.getByTestId("measurement-kind").selectOption("x-at-level");
    await workbench.getByTestId("add-measurement").click();
    await expect(workbench.getByTestId("measurement-results").getByRole("row", { name: /−3 dB corner/ })).toContainText("OK");

    const layout = await page.evaluate(() => {
      const drawer = document.querySelector<HTMLElement>("#instrument-drawer")!;
      const scope = document.querySelector<HTMLElement>(".scope-dock")!;
      const root = document.querySelector<HTMLElement>('[data-testid="measurement-workbench"]')!;
      const drawerBox = drawer.getBoundingClientRect();
      const scopeBox = scope.getBoundingClientRect();
      return {
        viewport: [innerWidth, innerHeight],
        bodyWidths: [document.body.clientWidth, document.body.scrollWidth],
        drawerBottom: drawerBox.bottom,
        scopeTop: scopeBox.top,
        scopeHeight: scopeBox.height,
        drawerScroll: [drawer.clientHeight, drawer.scrollHeight],
        workbenchScroll: [root.clientHeight, root.scrollHeight],
      };
    });
    expect(layout.viewport).toEqual([1440, 900]);
    expect(layout.bodyWidths[1]).toBe(layout.bodyWidths[0]);
    expect(layout.drawerBottom).toBeLessThanOrEqual(layout.scopeTop + 1);
    expect(layout.scopeHeight).toBeGreaterThanOrEqual(300);
    expect(layout.drawerScroll[1]).toBeLessThanOrEqual(layout.drawerScroll[0]);
    expect(layout.workbenchScroll[1]).toBeLessThanOrEqual(layout.drawerScroll[0]);

    const drawerBox = await page.locator("#instrument-drawer").boundingBox();
    if (!drawerBox) throw new Error("Measurement drawer is not visible");
    for (const name of ["Autoscale", "CSV", "PNG", "Table"] as const) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      if (!box) throw new Error(`${name} waveform control is not visible`);
      expect(box.x).toBeGreaterThanOrEqual(drawerBox.x + drawerBox.width);
      expect(await page.evaluate(({ x, y, label }) => {
        const hit = document.elementFromPoint(x, y)?.closest("button");
        return hit?.textContent?.trim() === label;
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2, label: name })).toBe(true);
    }

    await expect(workbench.getByTestId("trace-list").locator('[data-trace-id="p1"]')).toContainText("V(in) · V");
    await expect(workbench.getByTestId("trace-list").locator('[data-trace-id="p2"]')).toContainText("V(out) · V");
    await expect(page.locator('.oc-waveform-viewer__trace[data-trace-id^="current:p1:"]')).toContainText("V(in)");
    await expect(page.locator('.oc-waveform-viewer__trace[data-trace-id^="current:p2:"]')).toContainText("V(out)");
  });
});
