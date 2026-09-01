import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { parseDesignResultV2 } from "@opencircuit/design-schema";
import { serializeElectricalDesignRequestV2 } from "../src/features/designer/RequestTransfer";
import {
  emptyV2Source,
  legacyV1Source,
  scenarioV2Source,
} from "./designer-accessibility-fixtures";

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] as const;

async function importResult(page: Page, name: string, source: string): Promise<void> {
  await page.locator("[data-designer-result-file]").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });
  await expect(page.getByRole("heading", { name: "Imported design result" })).toBeVisible();
}

async function expectNoSeriousOrCriticalWcagViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_AA_TAGS]).analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
  expect(blocking, "Automated axe coverage found serious/critical WCAG A/AA violations").toEqual([]);
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    body: document.body.scrollWidth <= document.body.clientWidth,
  }))).toEqual({ document: true, body: true });
}

async function expectVisibleFocus(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
}

async function expectReducedMotionContract(page: Page): Promise<void> {
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const movingElements = await page.locator(".designer-shell *").evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const activeDuration = (value: string): boolean => value.split(",").some((part) => Number.parseFloat(part) > 0);
    return activeDuration(style.animationDuration) || activeDuration(style.transitionDuration)
      ? [element.outerHTML.slice(0, 160)]
      : [];
  }));
  expect(movingElements, "Reduced-motion mode must remove Designer animations and transitions").toEqual([]);
}

async function expectNoApplicationDialogs(page: Page): Promise<void> {
  await expect(page.locator('dialog:visible, [role="dialog"]:visible, [role="alertdialog"]:visible')).toHaveCount(0);
}

async function openWorkspaceTab(page: Page, name: "Schematic" | "Operating results" | "BOM / parts" | "Optimize" | "Export"): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

async function openEvidenceAndCaveats(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Evidence & caveats", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Evidence & caveats" })).toBeVisible();
}

async function expectVisibleTrustTitle(page: Page, title: string): Promise<void> {
  const trustBanner = page.locator(".designer-trust-banner:visible");
  await expect(trustBanner).toHaveCount(1);
  await expect(trustBanner).toHaveRole("status");
  await expect(trustBanner.getByText(title, { exact: true })).toBeVisible();
}

function forwardFocusKey(browserName: string): "Alt+Tab" | "Tab" {
  // WebKit models Safari's default macOS keyboard policy: Option+Tab traverses every link and form control.
  return browserName === "webkit" ? "Alt+Tab" : "Tab";
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
});

test("production chooser has an axe-clean critical path and keyboard-visible named controls", async ({ page }) => {
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectNoApplicationDialogs(page);
  await expectReducedMotionContract(page);

  const wordmark = page.getByRole("link", { name: "scheMAGIC Designer" });
  const designer = page.getByRole("link", { name: "Designer", exact: true });
  const simulator = page.getByRole("link", { name: "Simulator", exact: true });
  const applicationActions = page.getByRole("button", { name: /^Start (?:Power|Motor) design$/u });
  const importedTools = page.locator("summary").filter({ hasText: "Open or inspect existing design files" });
  await importedTools.focus();
  await expectVisibleFocus(importedTools);
  await page.keyboard.press("Enter");
  const demonstrations = ["M1", "M2", "P1", "P2"].map((code) => page.getByRole("button", { name: `Open ${code} demonstration result` }));
  const requestImportButton = page.getByRole("button", { name: "Choose requirements file" });
  const resultImportButton = page.getByRole("button", { name: "Choose result file" });
  for (const control of [wordmark, designer, simulator, applicationActions.nth(0), applicationActions.nth(1), ...demonstrations, requestImportButton, resultImportButton]) {
    await control.focus();
    await expectVisibleFocus(control);
  }
  await expect(applicationActions).toHaveCount(2);
  await expect(applicationActions.nth(0)).toBeEnabled();
  await expect(applicationActions.nth(1)).toBeEnabled();

  await page.locator("[data-designer-result-file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("Design result failed strict structural validation.");

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
});

test("transferred requirements remain axe-clean, narrow-safe, and expose focused named actions", async ({ page }) => {
  const result = parseDesignResultV2(JSON.parse(scenarioV2Source()));
  const source = serializeElectricalDesignRequestV2(result.request);
  await page.locator("[data-designer-request-file]").setInputFiles({
    name: "motor-requirements.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });

  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByLabel("Starting point")).toHaveValue("");
  await expect(page.getByRole("option", { name: "Transferred requirements" })).toHaveAttribute("disabled", "");
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
  await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  const download = page.getByRole("button", { name: "Download requirements JSON" });
  const share = page.getByRole("button", { name: "Create requirements share URL" });
  await expect(download).toBeEnabled();
  await expect(share).toBeEnabled();
  await share.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => new URL(page.url()).hash.startsWith("#r=")).toBe(true);
  await expect(share, "Request-share feedback must restore focus to its trigger after rerender").toBeFocused();
  await expectNoApplicationDialogs(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectReducedMotionContract(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
});

test("production schematic preview is named, keyboard-scrollable, axe-clean, and internally contained", async ({ page, browserName }) => {
  const motorCard = page.locator('[data-application="motor.brushed-dc"]');
  await motorCard.getByRole("button", { name: "Start Motor design" }).click();
  await expect(page.getByLabel("Reference design")).toBeChecked();
  await page.getByRole("button", { name: "Generate design" }).click();

  const firstPin = page.locator("[data-imported-pin]").first();
  await firstPin.check();
  await expect(firstPin).toBeFocused();
  const comparison = page.getByRole("region", { name: "Pinned comparison" });
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText("PINNED DECISION SET · 1/3");
  await expect(page.locator("[data-designer-caveat-dialog] [data-pinned-comparison]")).toHaveCount(0);
  await firstPin.uncheck();
  await expect(comparison).toHaveCount(0);
  await firstPin.check();
  await expect(comparison).toBeVisible();
  await openEvidenceAndCaveats(page);
  const dialog = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(dialog.getByRole("region", { name: "Pinned comparison" })).toHaveCount(0);
  const policyDecision = dialog.getByRole("region", { name: "Constraint disposition" });
  await expect(policyDecision).toBeVisible();
  await expect(policyDecision).toContainText("0 eligible");
  const ledger = dialog.getByRole("region", { name: "Exact V2 observation execution ledger" });
  await expect(ledger).toBeVisible();
  await ledger.getByText("Inspect all decision classes", { exact: true }).click();
  await expect(ledger.locator("[data-execution-group]")).toHaveCount(5);
  await page.getByRole("button", { name: "Close evidence and caveats" }).click();
  await expectNoApplicationDialogs(page);

  await openWorkspaceTab(page, "BOM / parts");
  const lcscSearchLinks = page.locator("[data-lcsc-search]");
  expect(await lcscSearchLinks.count()).toBeGreaterThan(0);
  await expect(lcscSearchLinks.first()).toHaveAccessibleName(/^Search LCSC for .+ \(opens in a new tab\)$/u);
  await expect(lcscSearchLinks.first()).toHaveAttribute("aria-describedby", "designer-lcsc-search-boundary");
  await expect(page.locator("[data-lcsc-search-boundary]")).toBeVisible();
  const evidenceDossier = page.getByRole("region", { name: "Selected-part evidence dossier" });
  await expect(evidenceDossier).toBeVisible();
  await expect(evidenceDossier.locator("[data-production-evidence-line]").first()).toBeVisible();
  const evidenceReferences = evidenceDossier.getByLabel(/^Scrollable evidence references for /u).first();
  await evidenceReferences.focus();
  await expectVisibleFocus(evidenceReferences);

  await openWorkspaceTab(page, "Operating results");
  const behavioralScenario = page.locator('[data-imported-scenario="pwm_loaded_steady_state"]');
  await expect(behavioralScenario).toHaveAttribute("aria-pressed", "true");

  await openWorkspaceTab(page, "Export");
  const artifactReadiness = page.getByRole("region", { name: "What this design can hand off" });
  const scenarioSpice = artifactReadiness.getByRole("button", { name: "Scenario SPICE", exact: true });
  await expect(scenarioSpice).toBeEnabled();
  await expect(artifactReadiness.getByRole("button", { name: "Scenario gate plan JSON", exact: true })).toBeEnabled();
  await expect(artifactReadiness.getByRole("button", { name: "Portable Simulation CSV", exact: true })).toBeDisabled();
  await expect(artifactReadiness.getByRole("button", { name: "Open in Simulator", exact: true })).toBeDisabled();
  await scenarioSpice.focus();
  await expect(scenarioSpice).toBeFocused();

  await openWorkspaceTab(page, "Operating results");
  await page.locator('[data-imported-scenario="selected_part_model"]').click();
  await openWorkspaceTab(page, "Export");
  await expect(artifactReadiness.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeDisabled();

  await openWorkspaceTab(page, "Operating results");
  await behavioralScenario.click();
  await openWorkspaceTab(page, "Export");
  await expect(artifactReadiness.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeEnabled();

  await openWorkspaceTab(page, "Optimize");
  const customization = page.locator("[data-primary-customization]");
  const customizationTitle = customization.getByRole("heading", { name: "Primary-part substitution" });
  await expect(customizationTitle).toBeVisible();
  const targetSelect = customization.locator("[data-primary-customization-target]");
  await expect(targetSelect).toBeEnabled();
  await targetSelect.selectOption({ index: 1 });
  await expect(customizationTitle, "Target selection must return focus to the substitution decision surface").toBeFocused();
  const evaluateSubstitution = page.getByRole("button", { name: "Evaluate substitution", exact: true });
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(page.getByRole("button", { name: "Replace instruction JSON", exact: true }));
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(page.getByRole("button", { name: "Verify inspection receipt JSON", exact: true }));
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(page.locator("[data-primary-customization-target]"));
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(evaluateSubstitution);
  const observedBusyState = page.evaluate(() => new Promise<boolean>((resolve) => {
    const observe = (): boolean => document.querySelector("[data-primary-customization]")?.getAttribute("aria-busy") === "true";
    if (observe()) {
      resolve(true);
      return;
    }
    const observer = new MutationObserver(() => {
      if (!observe()) return;
      observer.disconnect();
      resolve(true);
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, 5_000);
  }));
  await evaluateSubstitution.click();
  expect(await observedBusyState, "Customization evaluation must expose a busy state").toBe(true);
  const customizedResultTitle = page.locator("#designer-customization-result-title");
  await expect(customizedResultTitle, "Completed target evaluation must move focus to its result").toBeFocused();
  const customizedResult = page.locator("[data-primary-customization-result]");
  await expect(customizedResult).toContainText("These files describe only this exact target projection.");
  await expect(customizedResult).toContainText("They add no authority to the ordinary result, ranking, eligibility, simulation samples, commercial decisions, release, or attestation.");
  await expect(customizedResult).toContainText("The engineering report is for inspection only.");
  await expect(customizedResult).toContainText("It adds no release, physical-fidelity, or commercial authority.");
  await expect(customizedResult).toContainText("The KiCad schematic is structural only and its footprints stay empty.");
  await expect(customizedResult).toContainText("Opening it in external KiCad remains UNVERIFIED; it carries no KiCad or release attestation.");
  await expect(customizedResult).toContainText("Scenario SPICE is the exact default behavioral input and is available only with zero omissions.");
  await expect(customizedResult).toContainText("It adds no selected-part model, samples, physical fidelity, ranking, or eligibility authority.");
  await expect(customization.locator("#designer-customized-target-receipt-boundary")).toContainText("inert portable integrity data");
  await expect(customization.locator("#designer-customized-target-receipt-boundary")).toContainText("never regenerate a source automatically");
  await expect(customizedResult.locator("[data-production-export]")).toHaveCount(0);
  await expect(customizedResult.locator("[data-customized-target-export]")).toHaveCount(5);
  const electricalBom = customizedResult.locator('[data-customized-target-export="customized_target_electrical_bom_csv"]');
  const structuralSvg = customizedResult.locator('[data-customized-target-export="customized_target_structural_svg"]');
  const engineeringReport = customizedResult.locator('[data-customized-target-export="customized_target_engineering_report_html"]');
  const structuralKicad = customizedResult.locator('[data-customized-target-export="customized_target_structural_kicad"]');
  const behavioralSpice = customizedResult.locator('[data-customized-target-export="customized_target_behavioral_scenario_spice"]');
  const inspectionReceipt = customizedResult.locator("[data-customized-target-receipt-export]");
  await expect(electricalBom).toHaveAccessibleName("Download electrical BOM inspection CSV");
  await expect(structuralSvg).toHaveAccessibleName("Download structural schematic inspection SVG");
  await expect(engineeringReport).toHaveAccessibleName("Download target engineering report HTML");
  await expect(structuralKicad).toHaveAccessibleName("Download target structural KiCad schematic");
  await expect(behavioralSpice).toHaveAccessibleName("Download target behavioral Scenario SPICE");
  await expect(inspectionReceipt).toHaveAccessibleName("Download inspection receipt JSON");
  await expect(engineeringReport).toHaveAttribute("aria-describedby", /\bdesigner-customized-target-report-boundary\b/u);
  await expect(structuralKicad).toHaveAttribute("aria-describedby", /\bdesigner-customized-target-kicad-boundary\b/u);
  await expect(behavioralSpice).toHaveAttribute("aria-describedby", /\bdesigner-customized-target-spice-boundary\b/u);
  await electricalBom.focus();
  await expectVisibleFocus(electricalBom);
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(structuralSvg);
  const customizedTargetDownload = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  await customizedTargetDownload;
  await expect(structuralSvg, "Customized-target download feedback must restore focus to its trigger").toBeFocused();
  await expect(page.getByText("Customized-target structural schematic inspection SVG downloaded. The ordinary result and installed V3 decision are unchanged.", { exact: true })).toBeVisible();
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(engineeringReport);
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(structuralKicad);
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(behavioralSpice);
  const observedExportBusyState = page.evaluate(() => new Promise<{
    ariaBusy: string | null;
    exportActionCount: number;
    everyExportActionDisabled: boolean;
    receiptActionDisabled: boolean;
  }>((resolve, reject) => {
    const inspect = (): boolean => {
      const customizationSurface = document.querySelector("[data-primary-customization]");
      if (customizationSurface?.getAttribute("aria-busy") !== "true") return false;
      const exportActions = [...document.querySelectorAll<HTMLButtonElement>("[data-customized-target-export]")];
      const receiptAction = document.querySelector<HTMLButtonElement>("[data-customized-target-receipt-export]");
      resolve({
        ariaBusy: customizationSurface.getAttribute("aria-busy"),
        exportActionCount: exportActions.length,
        everyExportActionDisabled: exportActions.every((button) => button.disabled),
        receiptActionDisabled: receiptAction?.disabled ?? false,
      });
      return true;
    };
    if (inspect()) return;
    const observer = new MutationObserver(() => {
      if (!inspect()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("Customized-target export did not expose its busy state"));
    }, 5_000);
  }));
  const behavioralSpiceDownload = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  await expect(observedExportBusyState).resolves.toEqual({
    ariaBusy: "true",
    exportActionCount: 5,
    everyExportActionDisabled: true,
    receiptActionDisabled: true,
  });
  await behavioralSpiceDownload;
  await expect(behavioralSpice, "Behavioral Scenario SPICE feedback must restore focus to its trigger").toBeFocused();
  await expect(page.getByText("Customized-target behavioral Scenario SPICE downloaded. It is zero-omission scenario input, not selected-part simulation evidence.", { exact: true })).toBeVisible();
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(inspectionReceipt);

  await openWorkspaceTab(page, "Schematic");
  const preview = page.getByRole("region", { name: "Generated schematic" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("img", { name: /Exact structural schematic for/u })).toBeVisible({ timeout: 20_000 });
  await expect(preview).toContainText("EXACT STRUCTURAL PROJECTION · NO SIMULATION DATA");
  const viewport = preview.getByLabel("Scrollable exact structural schematic");
  await viewport.focus();
  await expectVisibleFocus(viewport);
  await expectNoApplicationDialogs(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectReducedMotionContract(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
  expect(await viewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await preview.getByRole("button", { name: "100%", exact: true }).click();
  expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await preview.getByRole("button", { name: "Fit circuit", exact: true }).click();
  expect(await viewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await openWorkspaceTab(page, "Operating results");
  await expect(page.getByRole("heading", { name: "Operating results" })).toBeVisible();
  expect(await page.locator("[data-chart-series]").count()).toBeGreaterThan(0);
  await openWorkspaceTab(page, "BOM / parts");
  await expect(page.getByRole("region", { name: "Selected-part evidence dossier" })).toBeVisible();
  await openWorkspaceTab(page, "Optimize");
  await expect(page.getByRole("heading", { name: "Primary-part substitution" })).toBeVisible();
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("region", { name: "What this design can hand off" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Electrical BOM CSV", exact: true })).toBeEnabled();
  await expectNoDocumentOverflow(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
});

test("Power selected workspace remains operable, axe-clean, and internally contained at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 712, height: 900 });
  await page.locator('[data-application="power.buck"]')
    .getByRole("button", { name: "Start Power design" }).click();
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Candidate solutions" })).toBeVisible({ timeout: 30_000 });

  const trustBanner = page.locator(".designer-trust-banner");
  const trustGeometry = await trustBanner.evaluate((element) => {
    const trustRow = element.firstElementChild;
    const caveatAction = element.querySelector("button[data-designer-caveats]");
    const compactStatus = element.querySelector(".designer-compact-status");
    if (!(trustRow instanceof HTMLElement)
      || !(caveatAction instanceof HTMLElement)
      || !(compactStatus instanceof HTMLElement)) return null;
    const trustRect = trustRow.getBoundingClientRect();
    const actionRect = caveatAction.getBoundingClientRect();
    const statusRect = compactStatus.getBoundingClientRect();
    return {
      firstRowBottom: Math.max(trustRect.bottom, actionRect.bottom),
      statusTop: statusRect.top,
    };
  });
  expect(trustGeometry).not.toBeNull();
  expect(trustGeometry!.statusTop).toBeGreaterThanOrEqual(trustGeometry!.firstRowBottom - 1);

  await page.setViewportSize({ width: 390, height: 844 });

  await openWorkspaceTab(page, "Schematic");
  const preview = page.getByRole("region", { name: "Generated schematic" });
  await expect(preview.getByRole("img", { name: /Exact structural schematic for/u })).toBeVisible({ timeout: 20_000 });
  const viewport = preview.getByLabel("Scrollable exact structural schematic");
  expect(await viewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await preview.getByRole("button", { name: "100%", exact: true }).click();
  expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await preview.getByRole("button", { name: "Fit circuit", exact: true }).click();
  await openWorkspaceTab(page, "Operating results");
  await expect(page.getByRole("heading", { name: "Operating results" })).toBeVisible();
  expect(await page.locator("[data-chart-series]").count()).toBeGreaterThan(0);
  await openWorkspaceTab(page, "BOM / parts");
  await expect(page.getByRole("region", { name: "Selected-part evidence dossier" })).toBeVisible();
  await openWorkspaceTab(page, "Optimize");
  await expect(page.getByRole("heading", { name: "Primary-part substitution" })).toBeVisible();
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("region", { name: "What this design can hand off" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Engineering report HTML", exact: true })).toBeEnabled();
  await expectNoDocumentOverflow(page);
  await expectNoApplicationDialogs(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectReducedMotionContract(page);
});

test("strict V1 audit route preserves named controls, status semantics, and narrow layout", async ({ page }) => {
  await importResult(page, "legacy-v1.json", legacyV1Source());
  await expectVisibleTrustTitle(page, "LEGACY V1 · AUDIT ONLY");
  await expect(page.getByRole("button", { name: "Canonical legacy design JSON" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Create share URL" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Inspect another result" })).toBeEnabled();
  await expectNoApplicationDialogs(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectReducedMotionContract(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
});

test("strict V2 zero-candidate route exposes its trust status without horizontal page overflow", async ({ page }) => {
  await importResult(page, "blocked-v2.json", emptyV2Source());
  await expectVisibleTrustTitle(page, "STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED");
  await expect(page.getByRole("heading", { name: "No persisted candidate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Electrical design JSON" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Create share URL" })).toBeEnabled();
  await expectNoApplicationDialogs(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectReducedMotionContract(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
});

test("V2 scenario and share restoration remain keyboard-operable and retain trust semantics", async ({ page, browserName }) => {
  await importResult(page, "scenario-v2.json", scenarioV2Source());
  await openWorkspaceTab(page, "Operating results");
  const operatingPoint = page.locator('[data-imported-scenario="op"]');
  const startup = page.locator('[data-imported-scenario="startup"]');
  await operatingPoint.focus();
  await expectVisibleFocus(operatingPoint);
  await page.keyboard.press(forwardFocusKey(browserName));
  await expectVisibleFocus(startup);
  await page.keyboard.press("Space");
  await expect(startup).toHaveAttribute("aria-pressed", "true");
  await expect(startup, "Scenario selection must not strand a keyboard user after rerender").toBeFocused();
  await expect(page.locator("#designer-scenario-detail")).toContainText("No same-ID scenario");
  await expectNoApplicationDialogs(page);
  await expectNoSeriousOrCriticalWcagViolations(page);
  await expectReducedMotionContract(page);

  const shareButton = page.getByRole("button", { name: "Create share URL" });
  await shareButton.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => new URL(page.url()).hash.startsWith("#d=")).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Share URL created in the address bar." })).toHaveCount(1);
  await expect(shareButton, "Share feedback must return focus to its trigger after rerender").toBeFocused();

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Restored a strictly validated electrical result share. It remains structural-only until you explicitly regenerate it with the installed production context." })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Regenerate with installed context", exact: true })).toBeEnabled();
  await openWorkspaceTab(page, "Operating results");
  await expect(page.locator('[data-imported-scenario="startup"]')).toHaveAttribute("aria-pressed", "true");
  await expectNoSeriousOrCriticalWcagViolations(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
});
