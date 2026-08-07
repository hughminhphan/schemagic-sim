import { chromium } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const output = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(output, "../..");
const frames = process.env.FRAME_DIR ?? path.join(output, ".capture-work/demo-frames");
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4640/";
const fps = 15;
const frameCount = 14 * fps;

await mkdir(output, { recursive: true });
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
  colorScheme: "light",
  serviceWorkers: "block",
});
const page = await context.newPage();
await page.route("**/*.wasm", async (route) => {
  if (route.request().url().includes("ngspice-")) await new Promise((resolve) => setTimeout(resolve, 700));
  await route.continue();
});

const waitForReady = () => page.getByTestId("engine-ready").waitFor({ state: "visible", timeout: 45_000 });

async function pointOnPot(t) {
  return page.locator('[data-pot-hit="c2"]').evaluate((element, value) => {
    const matrix = element.getScreenCTM();
    if (!matrix) throw new Error("Potentiometer transform is unavailable");
    const localY = 6 - 12 * value;
    const point = new DOMPoint(4, localY).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }, t);
}

async function pointOnWire(id) {
  return page.locator(`path.editor-wire[data-wire-id="${id}"]`).evaluate((element) => {
    const matrix = element.getScreenCTM();
    if (!matrix) throw new Error("Wire transform is unavailable");
    const point = element.getPointAtLength(element.getTotalLength() * 0.5).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
}

async function movePointer(point) {
  await page.mouse.move(point.x, point.y);
}

await page.goto(baseURL, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("schemagic-simulator");
    request.onsuccess = resolve;
    request.onerror = resolve;
    request.onblocked = resolve;
  });
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator(".schematic-editor").waitFor({ state: "visible" });
await waitForReady();

// Persist the same default bench at a low starting wiper position so the
// recorded reload can show the real engine warm-up before the drag begins.
const setupPoint = await pointOnPot(0.15);
await movePointer(setupPoint);
await page.mouse.down();
await page.mouse.up();
await waitForReady();
await page.waitForTimeout(700);

await page.reload({ waitUntil: "domcontentloaded" });
await page.locator(".schematic-editor").waitFor({ state: "visible" });
await page.addStyleTag({ content: `
  @media (max-height: 759px) {
    .app-shell:not(.scope-collapsed) { grid-template-rows: 32px minmax(0, 1fr) 250px !important; }
    .app-shell:not(.scope-collapsed) .scope-dock { grid-template-rows: 24px minmax(0, 1fr) !important; overflow: visible !important; }
  }
  .canvas-status { z-index: 9 !important; }
  #capture-pointer {
    position: fixed; z-index: 10000; width: 24px; height: 28px;
    pointer-events: none; transform: translate(-2px, -2px);
    filter: drop-shadow(0 1px 0 rgba(241,238,232,.9));
  }
` });
await page.evaluate(() => {
  const pointer = document.createElement("div");
  pointer.id = "capture-pointer";
  pointer.innerHTML = '<svg viewBox="0 0 24 28" width="24" height="28" aria-hidden="true"><path d="M3 2v20l5.2-5.1 3.9 8.6 3.8-1.8-4-8.4H20Z" fill="#15181B" stroke="#F1EEE8" stroke-width="1.4" stroke-linejoin="miter"/></svg>';
  document.body.append(pointer);
  window.addEventListener("pointermove", (event) => {
    pointer.style.left = `${event.clientX}px`;
    pointer.style.top = `${event.clientY}px`;
  }, { capture: true });
});
await movePointer({ x: 642, y: 154 });

let dragStarted = false;
let scopeOpened = false;
let tranStarted = false;
let acStarted = false;
let wireAdded = false;

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / fps;

  if (frame === 28) await waitForReady();

  if (time >= 2 && time < 5.5) {
    const progress = Math.min(1, Math.max(0, (time - 2) / 3.5));
    const wiper = 0.15 + 0.70 * progress;
    const point = await pointOnPot(wiper);
    if (!dragStarted) {
      await movePointer(point);
      await page.mouse.down();
      dragStarted = true;
    } else {
      await movePointer(point);
    }
  } else if (dragStarted && time >= 5.5) {
    const point = await pointOnPot(0.85);
    await movePointer(point);
    await page.mouse.up();
    dragStarted = false;
  }

  if (!wireAdded && time >= 7.5) {
    const point = await pointOnWire("w6");
    await movePointer(point);
    await page.mouse.click(point.x, point.y);
    wireAdded = true;
  }

  if (!scopeOpened && time >= 8.0) {
    const button = page.getByRole("button", { name: "Open scope" });
    const box = await button.boundingBox();
    if (!box) throw new Error("Open scope button is unavailable");
    await movePointer({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await button.click();
    scopeOpened = true;
  }

  if (!tranStarted && time >= 8.2) {
    const button = page.locator('[data-mode="tran"]');
    const box = await button.boundingBox();
    if (!box) throw new Error("TRAN tab is unavailable");
    await movePointer({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await button.click();
    tranStarted = true;
  }

  if (tranStarted && !acStarted && time >= 9.1) {
    await page.waitForFunction(() => document.querySelectorAll(".oc-waveform-viewer__trace").length >= 2, null, { timeout: 45_000 });
  }

  if (!acStarted && time >= 10.0) {
    const button = page.locator('[data-mode="ac"]');
    const box = await button.boundingBox();
    if (!box) throw new Error("AC tab is unavailable");
    await movePointer({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await button.click();
    acStarted = true;
  }

  if (acStarted && time >= 10.9) {
    await page.waitForFunction(() => document.querySelectorAll(".oc-waveform-viewer__trace").length >= 2, null, { timeout: 45_000 });
  }

  await page.screenshot({ path: path.join(frames, `frame-${String(frame).padStart(4, "0")}.png`) });
}

const finalState = await page.evaluate(() => ({
  status: document.querySelector("#engine-status")?.textContent?.trim(),
  wiper: document.querySelector("#wiper-percent")?.textContent?.trim(),
  mode: document.querySelector('[data-mode="ac"]')?.getAttribute("aria-selected"),
  scopeTitle: document.querySelector("#scope-title")?.textContent?.trim(),
  traces: document.querySelectorAll(".oc-waveform-viewer__trace").length,
  probes: document.querySelectorAll(".scope-probe-marker").length,
}));
console.log(JSON.stringify({ frames, fps, frameCount, finalState }, null, 2));

await browser.close();
