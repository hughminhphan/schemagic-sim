import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const manifestSource = readFileSync(
  new URL("../../../packages/designer-examples/artifacts/manifest.json", import.meta.url),
  "utf8",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
});

test("a keyboard action fetches and opens one exact demonstration without confusing its trust with production", async ({ page }) => {
  const demonstrationRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/designer-examples/")) demonstrationRequests.push(pathname);
  });
  await page.goto("/?designer");

  await page.getByText("Open or inspect existing design files", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open a complete result" })).toBeVisible();
  expect(demonstrationRequests).toEqual([]);
  await expect(page.locator(".designer-example-boundary")).toContainText(
    "No production admission, live provider or commercial data, or selected-part or simulation-fidelity claim.",
  );
  await expect(page.getByRole("button", { name: /Start (Power|Motor) design/u })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Generate design" })).toHaveCount(0);

  const open = page.getByRole("button", { name: "Open M1 demonstration result" });
  await open.focus();
  await page.keyboard.press("Enter");

  const heading = page.getByRole("heading", { name: "Imported design result" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("heading", { name: "Demonstration data — not production evidence" })).toBeVisible();
  await expect(page.getByText("No production admission.", { exact: true })).toBeVisible();
  await expect(page.getByText("No live provider or commercial data.", { exact: true })).toBeVisible();
  await expect(page.getByText("No selected-part or simulation-fidelity claim.", { exact: true })).toBeVisible();
  await expect(page.locator(".designer-trust-banner strong")).toHaveText("LEGACY V1 · AUDIT ONLY");
  await page.getByRole("tab", { name: "Operating results", exact: true }).click();
  await expect(page.getByRole("button", { name: "Scenario SPICE", exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Behavioral simulation graph has not been run" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "M1 demonstration opened after exact manifest" })).toHaveCount(1);
  expect(demonstrationRequests).toEqual([
    "/designer-examples/manifest.json",
    "/designer-examples/artifacts/m1-compact.json",
  ]);

  await page.getByRole("button", { name: "Production readiness" }).click();
  await expect(page.getByRole("button", { name: /Start (Power|Motor) design/u })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Generate design" })).toHaveCount(0);
});

test("a changed manifest fails closed before any result artifact request", async ({ page }) => {
  const artifactRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/designer-examples/artifacts/")) artifactRequests.push(pathname);
  });
  const changed = manifestSource.replace("M1 compact motor bridge", "X1 compact motor bridge");
  await page.addInitScript((source) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.pathname === "/designer-examples/manifest.json") {
        return new Response(source, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-length": String(new TextEncoder().encode(source).byteLength),
          },
        });
      }
      return nativeFetch(input, init);
    };
  }, changed);
  await page.goto("/?designer");
  await page.getByText("Open or inspect existing design files", { exact: true }).click();
  const open = page.getByRole("button", { name: "Open M1 demonstration result" });
  await open.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("alert")).toContainText("Demonstration data failed its published identity check. Nothing was opened.");
  await expect(page.getByRole("heading", { name: "Imported design result" })).toHaveCount(0);
  expect(artifactRequests).toEqual([]);
  await expect(page.getByRole("button", { name: /Start (Power|Motor) design/u })).toHaveCount(2);
});

test("the topology lanes stay narrow-screen safe and motionless in reduced-motion mode", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?designer");

  await page.getByText("Open or inspect existing design files", { exact: true }).click();
  await expect(page.locator(".designer-example-lanes article")).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => ({
    document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    body: document.body.scrollWidth <= document.body.clientWidth,
  }))).toEqual({ document: true, body: true });
  const moving = await page.locator(".designer-example-gallery *").evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const active = (value: string): boolean => value.split(",").some((part) => Number.parseFloat(part) > 0);
    return active(style.animationDuration) || active(style.transitionDuration) ? [element.tagName] : [];
  }));
  expect(moving).toEqual([]);
});
