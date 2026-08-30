import { expect, test } from "@playwright/test";

test("Simulator is a distinct scheMAGIC product surface", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/");

  await expect(page).toHaveTitle("scheMAGIC Simulator");
  const products = page.getByRole("navigation", { name: "scheMAGIC products" });
  await expect(products.getByText("Simulator", { exact: true })).toHaveAttribute("aria-current", "page");
  const designerLink = products.getByRole("link", { name: "Open scheMAGIC Designer" });
  await expect(designerLink).toHaveAttribute("href", "/?designer");
  await expect(page.getByRole("navigation", { name: "Analysis mode" })).toBeVisible();
  await expect(page.locator("#editor-host")).toBeVisible();

  await designerLink.click();
  await expect(page).toHaveURL(/\?designer$/);
  await expect(page).toHaveTitle("scheMAGIC Designer");
  await expect(page.locator('[data-product="designer"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Designer isn’t bundled in this Simulator preview." })).toBeVisible();
  await expect(page.getByText("Designer workspace unavailable in this build")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "scheMAGIC products" }).getByText("Designer", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Analysis mode" })).toHaveCount(0);
  await expect(page.locator("#editor-host")).toHaveCount(0);
  await expect(page.locator(".workbench, .scope-dock")).toHaveCount(0);

  await page.getByRole("link", { name: "Return to Simulator" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("scheMAGIC Simulator");
  await expect(page.getByRole("navigation", { name: "scheMAGIC products" }).getByText("Simulator", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Analysis mode" })).toBeVisible();
  await expect(page.locator("#editor-host")).toBeVisible();
});
