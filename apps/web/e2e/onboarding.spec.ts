import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Onboarding acceptance runs once in Chromium");
  await page.goto("/");
});

test("walks a first-time visitor through the core bench and remembers completion", async ({ page }) => {
  const tour = page.getByRole("dialog", { name: "Make the schematic move." });
  await expect(tour).toBeVisible();
  await expect(page.locator("#tour-progress i")).toHaveCount(8);
  await expect(tour.getByText("Your work stays in this browser.")).toBeVisible();

  const expectedSteps = [
    "Load a known circuit or a real part.",
    "Place parts and draw wires.",
    "Read the circuit while it runs.",
    "Select a part to edit and measure it.",
    "Choose the question you want to ask.",
    "Click a wire to send it to the scope.",
    "The full guide always lives here.",
  ];

  await tour.getByRole("button", { name: "Start walkthrough" }).click();
  for (const [index, title] of expectedSteps.entries()) {
    await expect(page.locator("#tour-title")).toHaveText(title);
    await expect(page.locator("#tour-count")).toHaveText(`${index + 2} / 8`);
    if (index < expectedSteps.length - 1) await page.getByRole("button", { name: "Next", exact: true }).click();
  }

  await page.getByRole("button", { name: "Start experimenting" }).click();
  await expect(page.locator("#tour-layer")).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("schemagic.onboarding.v1.completed"))).toBe("1");
  await page.reload();
  await expect(page.locator("#tour-layer")).toBeHidden();
});

test("opens a persistent written guide with live UI references and can replay the tour", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });

  await page.getByRole("button", { name: "Open guide" }).click();
  const guide = page.getByRole("dialog", { name: "From blank canvas to a useful trace." });
  await expect(guide).toBeVisible();
  await expect(guide.locator(".guide-section")).toHaveCount(6);
  await expect(guide.locator(".guide-ui-clone")).toHaveCount(5);
  await expect(guide.locator(".guide-ui-canvas .editor-wire:visible").first()).toBeVisible();
  await expect(guide.getByText("Imported source stays browser-local until you copy a Share URL or export the project; both carry it explicitly.")).toBeVisible();

  await guide.getByRole("button", { name: "Replay walkthrough" }).click();
  await expect(page.getByRole("dialog", { name: "Make the schematic move." })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#tour-layer")).toBeHidden();
});
