import { expect, test } from "@playwright/test";

test("Simulator is a distinct Robonyx product surface", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/");

  await expect(page).toHaveTitle("Robonyx Simulator");
  const products = page.getByRole("navigation", { name: "Robonyx products" });
  await expect(products.getByText("Simulator", { exact: true })).toHaveAttribute("aria-current", "page");
  const designerLink = products.getByRole("link", { name: "Open Robonyx Designer" });
  await expect(designerLink).toHaveAttribute("href", "/designer");
  await expect(page.getByRole("navigation", { name: "Analysis mode" })).toBeVisible();
  await expect(page.locator("#editor-host")).toBeVisible();

  await designerLink.click();
  await expect(page).toHaveURL(/\/designer\/?$/);
  await expect(page).toHaveTitle("Robonyx Designer");
  await expect(page.locator(".designer-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
  await expect(page.getByText("RELEASE CANDIDATE", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Product" }).getByText("Designer", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Analysis mode" })).toHaveCount(0);
  await expect(page.locator("#editor-host")).toHaveCount(0);
  await expect(page.locator(".workbench, .scope-dock")).toHaveCount(0);

  await page.getByRole("link", { name: "Simulator", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("Robonyx Simulator");
  await expect(page.getByRole("navigation", { name: "Robonyx products" }).getByText("Simulator", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Analysis mode" })).toBeVisible();
  await expect(page.locator("#editor-host")).toBeVisible();
});
