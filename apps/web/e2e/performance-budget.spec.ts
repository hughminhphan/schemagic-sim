import { expect, test, type BrowserContext, type Response } from "@playwright/test";

const MIB = 1024 * 1024;

// Measured on installed Chrome against the Vite server at 127.0.0.1:4197 on
// 2026-08-28. These are regression guards, not benchmark targets: thresholds
// deliberately retain substantial CPU, filesystem, and CI scheduling headroom.
const BUDGET = {
  startupReadyMs: 6_000,
  engineInitMs: 750,
  startupLongTasks: 12,
  warmSolveMs: 250,
  rapidChangeReadyMs: 3_000,
  rapidChangeLongTasks: 4,
  wasmBytes: 8 * MIB,
  catalogBytes: 24 * MIB,
  totalStartupBytes: 40 * MIB,
} as const;

interface RuntimeMetrics {
  engineInitMs: number;
  warmOpMs: number[];
  wasmTransferSize: number;
  rawfileBytes: number;
  longTasks: number;
}

interface PayloadObservation {
  totalBytes: number;
  catalogBytes: number;
  catalogResponses: number;
  wasmBytes: number;
  responseCount: number;
}

function observePayload(context: BrowserContext): { finish: () => Promise<PayloadObservation> } {
  const sizes = new Map<string, number>();
  const pending = new Set<Promise<void>>();
  const onResponse = (response: Response): void => {
    const task = response.allHeaders().then((headers) => {
      const size = Number(headers["content-length"] ?? 0);
      if (Number.isFinite(size) && size > 0) sizes.set(response.url(), Math.max(sizes.get(response.url()) ?? 0, size));
    }).catch(() => { /* A missing size remains covered by the aggregate entries that do report one. */ });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  };
  context.on("response", onResponse);
  return {
    async finish() {
      await Promise.all([...pending]);
      context.off("response", onResponse);
      const entries = [...sizes.entries()];
      const catalog = entries.filter(([url]) => url.includes("model-library") || url.includes("component.json"));
      const wasm = entries.filter(([url]) => new URL(url).pathname.endsWith(".wasm"));
      return {
        totalBytes: entries.reduce((sum, [, size]) => sum + size, 0),
        catalogBytes: catalog.reduce((sum, [, size]) => sum + size, 0),
        catalogResponses: catalog.length,
        wasmBytes: Math.max(0, ...wasm.map(([, size]) => size)),
        responseCount: entries.length,
      };
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
});

test("startup, solver, WASM and catalog payloads stay inside measured budgets", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Installed Chrome supplies the authoritative performance sample");
  const payloadObserver = observePayload(context);
  const started = performance.now();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  const startupReadyMs = performance.now() - started;
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => window.__ocMetrics as RuntimeMetrics);
  const payload = await payloadObserver.finish();
  const observation = { startupReadyMs, metrics, payload, budget: BUDGET };
  await testInfo.attach("startup-performance.json", {
    body: Buffer.from(JSON.stringify(observation, null, 2)),
    contentType: "application/json",
  });

  expect(startupReadyMs, "navigation through first completed operating-point solve").toBeLessThan(BUDGET.startupReadyMs);
  expect(metrics.engineInitMs, "ngspice worker initialization").toBeGreaterThan(0);
  expect(metrics.engineInitMs, "ngspice worker initialization").toBeLessThan(BUDGET.engineInitMs);
  expect(metrics.warmOpMs.length, "the startup operating-point solve is measured").toBeGreaterThan(0);
  expect(Math.max(...metrics.warmOpMs), "startup operating-point solver time").toBeLessThan(BUDGET.warmSolveMs);
  expect(metrics.longTasks, "startup main-thread long-task count").toBeLessThanOrEqual(BUDGET.startupLongTasks);

  expect(payload.wasmBytes, "the ngspice WASM response is observable").toBeGreaterThan(0);
  expect(payload.wasmBytes, "unique ngspice WASM binary payload").toBeLessThanOrEqual(BUDGET.wasmBytes);
  expect(payload.totalBytes, "observable unique startup response payload").toBeGreaterThan(0);
  expect(payload.totalBytes, "observable unique startup response payload").toBeLessThanOrEqual(BUDGET.totalStartupBytes);
  if (payload.catalogResponses > 0) {
    expect(payload.catalogBytes, "separately observable catalog manifest payload").toBeLessThanOrEqual(BUDGET.catalogBytes);
  }
});

test("rapid real-pointer changes cancel stale work and publish only the final solve", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Installed Chrome supplies the authoritative performance sample");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });

  await page.locator('[data-component-id="c2"] .editor-component-hit').click({ force: true });
  const slider = page.locator("#wiper-value");
  await expect(slider).toBeVisible();
  const banner = page.getByTestId("engine-banner");
  await expect.poll(async () => {
    const started = await banner.getAttribute("data-solve-started");
    return started === await banner.getAttribute("data-solve-completed") && await banner.getAttribute("data-engine-state") === "ready";
  }, { timeout: 45_000 }).toBe(true);

  const box = await slider.boundingBox();
  expect(box, "potentiometer range control has a pointer target").not.toBeNull();
  const before = await page.evaluate(() => {
    window.__ocMetrics.resetLongTasks();
    const banner = document.querySelector("#engine-banner");
    return {
      started: Number(banner?.getAttribute("data-solve-started") ?? 0),
      completed: Number(banner?.getAttribute("data-solve-completed") ?? 0),
      warmCount: window.__ocMetrics.warmOpMs.length,
    };
  });

  const gestureStarted = performance.now();
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.9, box!.y + box!.height / 2, { steps: 18 });
  await page.mouse.up();
  await page.waitForFunction((completedBefore) => {
    const banner = document.querySelector("#engine-banner");
    const started = Number(banner?.getAttribute("data-solve-started") ?? 0);
    const completed = Number(banner?.getAttribute("data-solve-completed") ?? 0);
    return completed > completedBefore && completed === started && banner?.getAttribute("data-engine-state") === "ready";
  }, before.completed, { timeout: 45_000 });
  const rapidChangeReadyMs = performance.now() - gestureStarted;

  // Give an already-running stale worker enough time to expose an incorrect
  // late completion before asserting that the final generation remains live.
  await page.waitForTimeout(250);
  const after = await page.evaluate((warmCount) => {
    const banner = document.querySelector("#engine-banner");
    const input = document.querySelector<HTMLInputElement>("#wiper-value");
    return {
      started: Number(banner?.getAttribute("data-solve-started") ?? 0),
      completed: Number(banner?.getAttribute("data-solve-completed") ?? 0),
      state: banner?.getAttribute("data-engine-state"),
      finalWiper: Number(input?.value ?? 0),
      warmSolveMs: window.__ocMetrics.warmOpMs.slice(warmCount),
      longTasks: window.__ocMetrics.longTasks,
      status: document.querySelector("#engine-status")?.textContent ?? "",
    };
  }, before.warmCount);
  await testInfo.attach("rapid-change-performance.json", {
    body: Buffer.from(JSON.stringify({ before, rapidChangeReadyMs, after, budget: BUDGET }, null, 2)),
    contentType: "application/json",
  });

  expect(after.started - before.started, "the pointer drag schedules several replace-active solves").toBeGreaterThanOrEqual(3);
  expect(after.completed, "only the newest generation is published").toBe(after.started);
  expect(after.state).toBe("ready");
  expect(after.status).toContain("ENGINE READY");
  expect(after.finalWiper, "the visible control retains the pointer's final value").toBeGreaterThan(0.8);
  expect(after.warmSolveMs.length, "at least one final warm solve completes").toBeGreaterThan(0);
  expect(Math.max(...after.warmSolveMs), "warm operating-point solver time").toBeLessThan(BUDGET.warmSolveMs);
  expect(rapidChangeReadyMs, "pointer-up through final published solve").toBeLessThan(BUDGET.rapidChangeReadyMs);
  expect(after.longTasks, "warm interaction main-thread long-task count").toBeLessThanOrEqual(BUDGET.rapidChangeLongTasks);
});
