import { expect, test, type Page } from "@playwright/test";

const COACH_COPY = "Drag the wiper. The LED, wire colours and current respond live.";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Onboarding acceptance runs once in Chromium");
  await page.goto("/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
});

async function coachMarkClearsSchematic(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const mark = document.querySelector("#coach-mark");
    if (!mark) return false;
    const box = mark.getBoundingClientRect();
    return [...document.querySelectorAll(".editor-component, path.editor-wire, .editor-label")].every((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return true;
      return box.left >= rect.right || rect.left >= box.right || box.top >= rect.bottom || rect.top >= box.bottom;
    });
  });
}

test("greets a first-time visitor with a non-blocking coach mark instead of a welcome modal", async ({ page }) => {
  const coach = page.locator("#coach-mark");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText(COACH_COPY);
  await expect(coach.getByRole("button", { name: "Show me around" })).toBeVisible();
  await expect(page.locator("#tour-layer")).toBeHidden();
  await expect(page.locator("#guide-overlay")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Make the schematic move." })).toHaveCount(0);

  expect(await coachMarkClearsSchematic(page), "the coach mark must never cover the schematic").toBe(true);
  const anchored = await page.evaluate(() => {
    const mark = document.querySelector("#coach-mark")?.getBoundingClientRect();
    const potId = document.querySelector<SVGElement>("[data-pot-hit]")?.dataset.potHit;
    const pot = potId ? document.querySelector(`[data-component-id="${potId}"] .editor-symbol`)?.getBoundingClientRect() : undefined;
    if (!mark || !pot) return Number.POSITIVE_INFINITY;
    return Math.hypot((mark.left + mark.right) / 2 - (pot.left + pot.right) / 2, (mark.top + mark.bottom) / 2 - (pot.top + pot.bottom) / 2);
  });
  expect(anchored, "the coach mark should sit beside the potentiometer").toBeLessThan(420);
});

test("the coach mark dismisses on the first potentiometer drag and stays dismissed", async ({ page }) => {
  await expect(page.locator("#coach-mark")).toBeVisible();
  const wiper = page.locator('[data-testid="pot-wiper"]').first();
  const box = await wiper.boundingBox();
  if (!box) throw new Error("The default bench should render a potentiometer wiper");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 24, { steps: 6 });
  await page.mouse.up();

  await expect(page.locator("#coach-mark")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("schemagic.onboarding.coach-mark.v1.dismissed"))).toBe("1");
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("#coach-mark")).toHaveCount(0);
  await expect(page.locator("#tour-layer")).toBeHidden();
});

test("clicking away dismisses the coach mark without blocking the bench", async ({ page }) => {
  await expect(page.locator("#coach-mark")).toBeVisible();
  await page.locator(".analysis-tabs .analysis-tab", { hasText: "LIVE" }).first().click();
  await expect(page.locator("#coach-mark")).toHaveCount(0);
});

test("Show me around opens the persistent guide, which still replays the full walkthrough", async ({ page }) => {
  await page.locator("#coach-mark").getByRole("button", { name: "Show me around" }).click();
  const guide = page.getByRole("dialog", { name: "From blank canvas to a useful trace." });
  await expect(guide).toBeVisible();
  await expect(page.locator("#coach-mark")).toHaveCount(0);

  await guide.getByRole("button", { name: "Replay walkthrough" }).click();
  const tour = page.getByRole("dialog", { name: "Make the schematic move." });
  await expect(tour).toBeVisible();
  await expect(page.locator("#tour-progress i")).toHaveCount(8);

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
});

test("opens a persistent written guide with live UI references from the Guide button", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("#coach-mark")).toHaveCount(0);

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
