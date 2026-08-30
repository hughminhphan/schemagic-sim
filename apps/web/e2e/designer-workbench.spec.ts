import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] as const;

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= document.body.clientWidth,
    document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }))).toEqual({ body: true, document: true });
}

async function expectNoSeriousOrCriticalWcagViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_AA_TAGS]).analyze();
  expect(results.violations.filter((violation) => (
    violation.impact === "serious" || violation.impact === "critical"
  )).map((violation) => ({
    help: violation.help,
    id: violation.id,
    targets: violation.nodes.map((node) => node.target),
  }))).toEqual([]);
}

async function openDesigner(page: Page): Promise<void> {
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Design progress" })).toContainText("Requirements");
  await expect(page.getByRole("navigation", { name: "Design progress" })).toContainText("Solutions");
  await expect(page.getByRole("navigation", { name: "Design progress" })).toContainText("Design");
}

async function startReferenceDesign(page: Page, application: "Power" | "Motor"): Promise<void> {
  await page.getByRole("button", { name: `Start ${application} design` }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  const referenceMode = page.getByRole("radio", { name: /Reference design/u });
  await expect(referenceMode).toBeChecked();
  await expect(page.getByRole("radio", { name: /Strict evidence gate/u })).not.toBeChecked();
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("designer-candidate-row").first()).toBeVisible();
  await expect(page.getByTestId("designer-candidate-row").first()).toContainText("Reference / estimated");
  await expect(page.getByTestId("designer-candidate-row").first()).toContainText("Policy-ineligible");
  await page.getByTestId("designer-candidate-select").first().click();
  await expect(page.locator(".designer-design-workspace")).toBeVisible();
  await expect(page.locator(".designer-workspace-selection-status")).toContainText("Policy-ineligible");
}

test("a fresh-storage first-time Power flow reaches a selected WEBENCH-style design workspace", async ({ page }) => {
  await openDesigner(page);
  expect(await page.evaluate(() => localStorage.getItem("schemagic.onboarding.v1.completed"))).toBeNull();
  await expect(page.getByRole("dialog", { name: "Make the schematic move." })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Power design" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Motor design" })).toBeVisible();
  await startReferenceDesign(page, "Power");

  const requestContext = page.getByRole("region", { name: "Requested Power operating point" });
  await expect(requestContext).toBeVisible();
  await expect(requestContext.getByText("Vin", { exact: true })).toBeVisible();
  await expect(requestContext.getByText("Vout", { exact: true })).toBeVisible();
  await expect(requestContext.getByText("Max output current", { exact: true })).toBeVisible();
  await expect(requestContext.getByText("Ambient", { exact: true })).toBeVisible();
  await expect(requestContext).toContainText("12 V");
  await expect(requestContext).toContainText("5 V");
  await expect(requestContext).toContainText("0.2 A");
  await expect(requestContext).toContainText("25 °C");
  await expect(page.getByRole("tab", { name: "Schematic" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Generated schematic" })).toBeVisible();

  await page.getByRole("tab", { name: "Operating results" }).click();
  await expect(page.getByRole("heading", { name: "Operating results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operating charts" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Constraint evidence status chart/u })).toBeVisible();
  expect(await page.locator("[data-designer-operating-chart]").count()).toBeGreaterThan(1);
  await expect(page.locator(".designer-operating-charts").filter({ has: page.getByRole("heading", { name: "Operating charts" }) })).toContainText("not measurements, simulation samples, efficiency curves, or selected-part verification");
  await expect(page.getByRole("img", { name: "Behavioral simulation graph has not been run" })).toBeVisible();

  await page.getByRole("tab", { name: "BOM / parts" }).click();
  await expect(page.getByRole("heading", { name: /bill of materials/u })).toBeVisible();
  expect(await page.locator(".designer-bom-table tbody tr").count()).toBeGreaterThan(0);

  await page.getByRole("tab", { name: "Export" }).click();
  await expect(page.getByRole("button", { name: "Electrical BOM CSV", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Structural SVG", exact: true })).toBeEnabled();

  const caveats = page.getByTestId("designer-caveats").first();
  await caveats.click();
  const dialog = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION");
  await expect(dialog).toContainText("0 eligible");
  await expect(dialog.getByText("Blocked rule detail", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close evidence and caveats" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(caveats).toBeFocused();

  const workspaceCaveats = page.locator(".designer-workspace-status").getByRole("button", { name: "Evidence & caveats", exact: true });
  await workspaceCaveats.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(workspaceCaveats, "Escape must restore the exact second caveat invoker").toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("schemagic.onboarding.v1.completed"))).toBeNull();
});

test("Motor reference generation produces a circuit, results, parts, and optimization surface", async ({ page }) => {
  await openDesigner(page);
  await startReferenceDesign(page, "Motor");

  const requestContext = page.getByRole("region", { name: "Requested Motor operating point" });
  await expect(requestContext).toBeVisible();
  await expect(requestContext.getByText("Supply", { exact: true })).toBeVisible();
  await expect(requestContext.getByText("Operating current", { exact: true })).toBeVisible();
  await expect(requestContext.getByText("PWM", { exact: true })).toBeVisible();
  await expect(requestContext.getByText("Ambient", { exact: true })).toBeVisible();
  await expect(requestContext).toContainText("12 V");
  await expect(requestContext).toContainText("1.5 A");
  await expect(requestContext).toContainText("20 kHz · 80 % duty");
  await expect(requestContext).toContainText("40 °C");
  await expect(page.getByRole("heading", { name: "Generated schematic" })).toBeVisible();
  await page.getByRole("tab", { name: "Operating results" }).click();
  await expect(page.getByRole("heading", { name: "Operating results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operating charts" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Requested Motor current envelope chart/u })).toBeVisible();
  await expect(page.getByRole("img", { name: /Constraint evidence status chart/u })).toBeVisible();
  await expect(page.locator('[data-designer-operating-chart="motor-current-envelope"]')).toContainText("Requirement envelope only");
  expect(await page.locator("[data-designer-operating-chart]").count()).toBeGreaterThan(1);
  await page.getByRole("tab", { name: "BOM / parts" }).click();
  expect(await page.locator(".designer-bom-table tbody tr").count()).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "Optimize" }).click();
  await expect(page.getByRole("tabpanel", { name: "Optimize" })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Optimize" })).toContainText(/substitution|requirements/iu);
});

test("multi-solution Motor selection opens the chosen generated design", async ({ page }) => {
  await openDesigner(page);
  await page.getByRole("button", { name: "Start Motor design" }).click();
  await page.getByLabel("Starting point", { exact: true }).selectOption("motor.external-24v");
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });

  const rows = page.getByTestId("designer-candidate-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(rows.nth(0).locator(".designer-primary-part")).toContainText("MIC4606-2YML-T5");
  await expect(rows.nth(1).locator(".designer-primary-part")).toContainText("MIC4606-2YML-T5");
  const firstVariant = rows.nth(0).getByTestId("designer-candidate-variant");
  const secondVariant = rows.nth(1).getByTestId("designer-candidate-variant");
  await expect(firstVariant).toContainText("Pulldown resistor");
  await expect(secondVariant).toContainText("Pulldown resistor");
  expect(await secondVariant.innerText()).not.toBe(await firstVariant.innerText());
  const firstCandidateId = await rows.nth(0).getByTestId("designer-candidate-select").locator("small").innerText();
  const secondCandidateId = await rows.nth(1).getByTestId("designer-candidate-select").locator("small").innerText();
  expect(secondCandidateId).not.toBe(firstCandidateId);

  const pinnedComparison = page.getByRole("region", { name: "Pinned comparison" });
  await expect(pinnedComparison).toHaveCount(0);
  await rows.nth(0).locator("[data-imported-pin]").check();
  await expect(pinnedComparison).toBeVisible();
  await expect(pinnedComparison).toContainText("PINNED DECISION SET · 1/3");
  await expect(pinnedComparison.locator("thead th")).toHaveCount(2);
  await expect(page.locator("[data-designer-caveat-dialog] [data-pinned-comparison]")).toHaveCount(0);
  await rows.nth(1).locator("[data-imported-pin]").check();
  await expect(pinnedComparison).toContainText("PINNED DECISION SET · 2/3");
  await expect(pinnedComparison.locator("thead th")).toHaveCount(3);
  await rows.nth(0).locator("[data-imported-pin]").uncheck();
  await expect(pinnedComparison).toContainText("PINNED DECISION SET · 1/3");
  await expect(pinnedComparison.locator("thead th")).toHaveCount(2);

  await rows.nth(1).getByTestId("designer-candidate-select").click();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
  await expect(rows.nth(0)).not.toHaveAttribute("aria-current", "true");
  await expect(page.locator(".designer-detail-header code")).toHaveText(secondCandidateId);
  await expect(page.getByRole("heading", { name: "Generated schematic" })).toBeVisible();
});

test("strict zero-result recovery regenerates honest reference solutions", async ({ page }) => {
  await openDesigner(page);
  await page.getByRole("button", { name: "Start Motor design" }).click();
  await page.getByRole("radio", { name: /Strict evidence gate/u }).check();
  await expect(page.getByRole("radio", { name: /Reference design/u })).not.toBeChecked();
  await page.getByRole("button", { name: "Generate design" }).click();

  await expect(page.getByRole("heading", { name: "No retained candidate" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".designer-trust-banner")).toContainText("Verified generation · no retained selection");
  const recovery = page.getByRole("button", { name: "Show reference solutions" });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("designer-candidate-row").first()).toContainText("Reference / estimated");
});

test("Power can deliberately exclude visibly estimated candidates without changing policy eligibility", async ({ page }) => {
  await openDesigner(page);
  await page.getByRole("button", { name: "Start Power design" }).click();
  await page.getByText("Advanced constraints", { exact: false }).click();
  const allowEstimated = page.getByRole("checkbox", { name: "Allow estimated candidate outputs" });
  await expect(allowEstimated).toBeChecked();
  await allowEstimated.click();
  await page.locator(".designer-advanced > summary").click();
  await expect(page.getByRole("checkbox", { name: "Allow estimated candidate outputs" })).not.toBeChecked();
  await page.getByRole("button", { name: "Generate design" }).click();

  await expect(page.getByRole("heading", { name: "No retained candidate" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".designer-empty-results")).toContainText("Estimated candidate outputs were deliberately disallowed by this request");
  await expect(page.locator(".designer-empty-results")).toContainText("Re-enable “Allow estimated candidate outputs” only to inspect them; this does not change installed policy eligibility or hide request-declared estimates.");

  await page.getByRole("button", { name: "Evidence & caveats", exact: true }).click();
  const evidencePolicyGroup = page.getByRole("dialog", { name: "Evidence & caveats" })
    .locator('[data-execution-group="evidence-policy-exclusion"]');
  await expect(evidencePolicyGroup).toContainText("estimated_values_disallowed");
  await expect(evidencePolicyGroup).toContainText("Candidate");
  await page.locator("[data-designer-caveat-close]").click();

  await page.getByRole("button", { name: "Show reference solution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Inspected one exact evidence-limited Power design after enabling allowEstimatedValues. The installed policy marks 0 eligible; estimates remain estimated and unknown ≠ pass.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("designer-candidate-row").first()).toContainText("Reference / estimated");
});

test("a transient generation failure exposes Retry generation and then succeeds", async ({ page }) => {
  await openDesigner(page);
  await page.getByRole("button", { name: "Start Power design" }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();

  await page.evaluate(() => {
    const nativePromiseAll = Promise.all;
    Promise.all = ((values: Iterable<unknown>) => {
      void values;
      Promise.all = nativePromiseAll;
      return Promise.reject(new Error("Forced transient Designer generation failure."));
    }) as typeof Promise.all;
  });

  await page.getByRole("button", { name: "Generate design" }).click();
  const failureStatus = page.getByRole("status").filter({ hasText: "Requirements status" });
  await expect(failureStatus).toContainText("Forced transient Designer generation failure.");
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByTestId("designer-candidate-row")).toHaveCount(0);

  const retry = failureStatus.getByRole("button", { name: "Retry generation", exact: true });
  await expect(retry).toBeEnabled();
  await retry.click();

  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("designer-candidate-row").first()).toContainText("Reference / estimated");
  await expect(page.locator(".designer-design-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Generated schematic" })).toBeVisible();
});

test("entry and requirements remain responsive, keyboard-usable, and axe-clean", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  await expectNoDocumentOverflow(page);
  await expectNoSeriousOrCriticalWcagViolations(page);

  const start = page.getByRole("button", { name: "Start Power design" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoSeriousOrCriticalWcagViolations(page);

  const generate = page.getByRole("button", { name: "Generate design" });
  await generate.focus();
  await expect(generate).toBeFocused();
});
