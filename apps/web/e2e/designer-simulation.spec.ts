import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

type DesignerApplication = "Power" | "Motor";

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] as const;

async function startReferenceDesign(page: Page, application: DesignerApplication): Promise<void> {
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
  await page.getByRole("button", { name: `Start ${application} design`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Reference design/u })).toBeChecked();
  await page.getByRole("button", { name: "Generate design", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("designer-candidate-row").first()).toContainText("Reference / estimated");
  await page.getByTestId("designer-candidate-select").first().click();
  await expect(page.locator(".designer-design-workspace")).toBeVisible();
  await expect(page.locator(".designer-workspace-selection-status")).toContainText("Policy-ineligible");
}

async function waitForDecodedImage(image: Locator): Promise<void> {
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(async (element) => {
    const preview = element as HTMLImageElement;
    if (!preview.complete) await preview.decode();
    return preview.naturalWidth > 0 && preview.naturalHeight > 0;
  })).toBe(true);
}

async function expectFittedSchematicAndActualSizeOverflow(page: Page): Promise<void> {
  const preview = page.locator("[data-production-schematic-preview]");
  await expect(preview.getByRole("heading", { name: "Generated schematic", exact: true })).toBeVisible();
  const viewport = preview.locator("[data-schematic-scale]");
  const image = viewport.locator("img");
  await waitForDecodedImage(image);
  await expect(viewport).toHaveAttribute("data-schematic-scale", "fit");
  await expect(preview.getByRole("button", { name: "Fit circuit", exact: true })).toHaveAttribute("aria-pressed", "true");

  const fit = await viewport.evaluate((element) => {
    const previewImage = element.querySelector("img");
    if (!(previewImage instanceof HTMLImageElement)) throw new Error("Schematic image is missing");
    const viewportRect = element.getBoundingClientRect();
    const imageRect = previewImage.getBoundingClientRect();
    const style = getComputedStyle(previewImage);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollTop: element.scrollTop,
      imageLeft: imageRect.left,
      imageRight: imageRect.right,
      imageTop: imageRect.top,
      imageWidth: imageRect.width,
      marginTop: style.marginTop,
      transform: style.transform,
      viewportLeft: viewportRect.left,
      viewportRight: viewportRect.right,
      viewportTop: viewportRect.top,
    };
  });
  expect(fit.transform).toBe("none");
  expect(fit.marginTop).toBe("0px");
  expect(fit.scrollTop).toBe(0);
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1);
  expect(fit.imageWidth).toBeLessThanOrEqual(fit.clientWidth + 1);
  expect(fit.imageLeft).toBeGreaterThanOrEqual(fit.viewportLeft - 1);
  expect(fit.imageRight).toBeLessThanOrEqual(fit.viewportRight + 1);
  expect(fit.imageTop).toBeGreaterThanOrEqual(fit.viewportTop - 1);

  await preview.getByRole("button", { name: "100%", exact: true }).click();
  await expect(viewport).toHaveAttribute("data-schematic-scale", "actual");
  await expect(preview.getByRole("button", { name: "100%", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => viewport.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(true);

  await preview.getByRole("button", { name: "Fit circuit", exact: true }).click();
  await expect(viewport).toHaveAttribute("data-schematic-scale", "fit");
  await expect.poll(() => viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop })))
    .toEqual({ left: 0, top: 0 });
}

async function expectAnalyticalOperatingPlots(page: Page, application: "power.buck" | "motor.brushed-dc"): Promise<void> {
  await page.getByRole("tab", { name: "Operating results", exact: true }).click();
  const plots = page.getByTestId("designer-operating-plots");
  await expect(plots.getByRole("heading", { name: "Analytical operating plots", exact: true })).toBeVisible();
  await expect(plots).toHaveAttribute("data-operating-plot-application", application);
  await expect(plots).toContainText("NO SAMPLED RESULTS");
  await expect(plots).toContainText("No efficiency, regulation-performance, or waveform series is synthesized.");

  const figures = plots.locator("[data-designer-operating-chart]");
  expect(await figures.count()).toBeGreaterThanOrEqual(2);
  const audit = await figures.evaluateAll((elements) => elements.map((element) => ({
    authority: element.getAttribute("data-operating-plot-authority"),
    axesX: element.querySelectorAll('[data-axis="x"]').length,
    axesY: element.querySelectorAll('[data-axis="y"]').length,
    roleImages: element.querySelectorAll('svg[role="img"]').length,
    series: [...element.querySelectorAll<SVGElement>("[data-plot-series]")].map((series) => ({
      id: series.dataset.plotSeries,
      provenance: series.dataset.seriesProvenance,
    })),
    text: element.textContent ?? "",
  })));
  for (const figure of audit) {
    expect(figure.authority).toBe("analytical-request-only");
    expect(figure.axesX).toBe(1);
    expect(figure.axesY).toBe(1);
    expect(figure.roleImages).toBe(1);
    expect(figure.series.length).toBeGreaterThan(0);
    expect(figure.series.every((series) => Boolean(series.id) && Boolean(series.provenance))).toBe(true);
    expect(figure.text).toContain("Series provenance:");
  }
}

async function expectExecutionReceipt(lab: Locator, analysis: "OP" | "TRAN"): Promise<void> {
  await expect(lab).toHaveAttribute("aria-busy", "false");
  await expect(lab.locator(".designer-chip")).toContainText("completed", { ignoreCase: true });
  const receipt = lab.locator('.designer-simulation-receipt[aria-label="Local simulation execution receipt"]');
  await expect(receipt).toBeVisible();
  const fields = await receipt.locator(":scope > div").evaluateAll((elements) => Object.fromEntries(elements.map((element) => [
    element.querySelector("dt")?.textContent?.trim() ?? "",
    element.querySelector("dd")?.textContent?.trim() ?? "",
  ])));
  expect(fields.Engine).toBe("ngspice-46 + KLU");
  expect(fields.Analysis).toBe(analysis);
  expect(fields.Solve).toMatch(/^\d+(?:\.\d+)? ms$/u);
  expect(fields.Samples).toMatch(/^[\d,]+ · \d+ vectors$/u);
  expect(Number(fields.Samples?.replace(/,/gu, "").split(" · ")[0])).toBeGreaterThan(0);
  expect(Number(fields.Samples?.match(/· (\d+) vectors$/u)?.[1])).toBeGreaterThan(0);
  expect(fields.Receipt).toMatch(/^sha256:[0-9a-f]{64}$/u);
  await expect(lab.locator("footer")).toContainText("local ngspice samples from the authored behavioral circuit");
  await expect(lab.locator("footer")).toContainText("not measurements, selected-part fidelity, eligibility evidence, or a production guarantee");
}

async function expectCompletedSimulationAccessibleAtPhoneWidth(page: Page, lab: Locator): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= document.body.clientWidth,
    document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }))).toEqual({ body: true, document: true });

  await expect.poll(() => lab.evaluate((element) => {
    const labRect = element.getBoundingClientRect();
    const plot = element.querySelector<HTMLElement>("[data-designer-simulation-host]");
    const receipt = element.querySelector<HTMLElement>(".designer-simulation-receipt");
    const visual = plot?.firstElementChild;
    const plotRect = plot?.getBoundingClientRect();
    const receiptRect = receipt?.getBoundingClientRect();
    const visualRect = visual?.getBoundingClientRect();
    const visualStyle = visual === null || visual === undefined ? undefined : getComputedStyle(visual);
    return {
      labContained: labRect.left >= -1 && labRect.right <= document.documentElement.clientWidth + 1,
      labInternallyContained: element.scrollWidth <= element.clientWidth + 1,
      plotContained: plotRect !== undefined
        && plotRect.left >= labRect.left - 1
        && plotRect.right <= labRect.right + 1,
      receiptContained: receiptRect !== undefined
        && receiptRect.left >= labRect.left - 1
        && receiptRect.right <= labRect.right + 1,
      visualContained: visualRect !== undefined
        && plotRect !== undefined
        && visualRect.left >= plotRect.left - 1
        && visualRect.right <= plotRect.right + 1,
      wideVisualScrollsInternally: visual === null || visual === undefined
        ? false
        : visual.scrollWidth <= visual.clientWidth + 1
          || visualStyle?.overflowX === "auto"
          || visualStyle?.overflowX === "scroll",
    };
  })).toEqual({
    labContained: true,
    labInternallyContained: true,
    plotContained: true,
    receiptContained: true,
    visualContained: true,
    wideVisualScrollsInternally: true,
  });

  const results = await new AxeBuilder({ page }).withTags([...WCAG_AA_TAGS]).analyze();
  expect(results.violations.filter((violation) => (
    violation.impact === "serious" || violation.impact === "critical"
  )).map((violation) => ({
    help: violation.help,
    id: violation.id,
    targets: violation.nodes.map((node) => node.target),
  })), "Executed simulation state has serious/critical WCAG A/AA violations").toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
});

test("Power fits the exact schematic, plots analytical envelopes, and runs an interactive behavioral transient", async ({ page }) => {
  await startReferenceDesign(page, "Power");
  await expectFittedSchematicAndActualSizeOverflow(page);
  await expectAnalyticalOperatingPlots(page, "power.buck");

  const lab = page.locator("[data-designer-simulation-lab]");
  await expect(lab).toContainText("LOCAL ENGINE · BEHAVIORAL MODEL");
  await expect(lab).toContainText("TRAN · behavioral coverage");
  const run = lab.getByRole("button", { name: "Run ngspice simulation", exact: true });
  await run.click();
  const cancellationWon = await lab.evaluate((element) => {
    const cancel = element.querySelector<HTMLButtonElement>("[data-designer-cancel-simulation]");
    if (cancel === null) return false;
    cancel.click();
    return true;
  });
  const rerun = cancellationWon
    ? lab.getByRole("button", { name: "Run ngspice simulation", exact: true })
    : lab.getByRole("button", { name: "Run again", exact: true });
  if (cancellationWon) {
    await expect(rerun).toBeFocused();
    await expect(lab.locator(".designer-simulation-receipt")).toHaveCount(0);
  } else {
    await expectExecutionReceipt(lab, "TRAN");
  }

  await rerun.click();
  await expect(lab.locator(".oc-waveform-viewer__canvas")).toBeVisible({ timeout: 30_000 });
  expect(await lab.locator(".oc-waveform-viewer__trace").count()).toBeGreaterThan(0);
  await expectExecutionReceipt(lab, "TRAN");
  await lab.locator(".oc-waveform-viewer__canvas").click({ position: { x: 220, y: 100 } });
  await expect(lab.locator(".oc-waveform-viewer__readout")).not.toContainText("Cursor A off");
  await expectCompletedSimulationAccessibleAtPhoneWidth(page, lab);
});

test("Motor plots request-derived envelopes and runs a solved behavioral operating point", async ({ page }) => {
  await startReferenceDesign(page, "Motor");
  await expectFittedSchematicAndActualSizeOverflow(page);
  await expectAnalyticalOperatingPlots(page, "motor.brushed-dc");

  const lab = page.locator("[data-designer-simulation-lab]");
  await expect(lab).toContainText("OP · behavioral coverage");
  await lab.getByRole("button", { name: "Run ngspice simulation", exact: true }).click();
  const solvedPlots = lab.locator(".designer-op-point-plots");
  await expect(solvedPlots).toBeVisible({ timeout: 30_000 });
  expect(await solvedPlots.locator("figure").count()).toBeGreaterThan(0);
  expect(await solvedPlots.locator(".designer-op-marker").count()).toBeGreaterThan(0);
  await expect(solvedPlots.locator('svg[role="img"]').first()).toHaveAttribute("aria-label", /One solved behavioral operating point/u);
  await expectExecutionReceipt(lab, "OP");
  await expectCompletedSimulationAccessibleAtPhoneWidth(page, lab);
});
