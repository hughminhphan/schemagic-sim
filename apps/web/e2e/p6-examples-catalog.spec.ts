import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const examplesDirectory = resolve(import.meta.dirname, "../../../examples");
const examples = readdirSync(examplesDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const id = name.replace(/\.json$/, "");
    const document = JSON.parse(readFileSync(resolve(examplesDirectory, name), "utf8")) as {
      meta: { title: string };
      probes: Array<{ id: string }>;
    };
    return [id, document.meta.title, document.probes[0]?.id] as const;
  });

const CLASSIC_TEACHING_IDS = [
  "rc-filter-bode",
  "resistive-divider",
  "555-astable",
  "h-bridge",
  "common-emitter-amp",
  "inverting-opamp",
  "opamp-noninverting",
  "halfwave-rectifier",
  "bridge-rectifier",
  "zener-regulator",
  "led-current-limit",
  "rlc-resonance",
] as const;

const NEW_SCREENSHOT_IDS = new Set(["555-astable", "h-bridge", "inverting-opamp", "zener-regulator"]);
const screenshotDirectory = process.env.EXAMPLE_SCREENSHOT_DIR;
if (screenshotDirectory) mkdirSync(screenshotDirectory, { recursive: true });

const shareUrls = new Map(
  readFileSync(resolve(examplesDirectory, "URLS.md"), "utf8")
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^- ([^:]+): (https?:\/\/\S+)$/);
      return match ? [[match[1]!, match[2]!] as const] : [];
    }),
);

const exampleById = new Map(examples.map(([id, title, defaultProbeId]) => [id, { title, defaultProbeId }]));

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "P6 acceptance and screenshots run once in Chromium");
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
    await new Promise<void>((done) => {
      const request = indexedDB.deleteDatabase("schemagic-simulator");
      request.onsuccess = () => done();
      request.onerror = () => done();
      request.onblocked = () => done();
    });
  });
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
});

test("opens all twelve classic teaching circuits from share URLs with a non-zero default trace", async ({ page }) => {
  test.setTimeout(10 * 60_000);

  for (const id of CLASSIC_TEACHING_IDS) {
    const example = exampleById.get(id);
    const shareUrl = shareUrls.get(id);
    expect(example, `${id} should have a bundled document`).toBeDefined();
    expect(shareUrl, `${id} should have a recorded share URL`).toBeDefined();
    expect(example?.defaultProbeId, `${id} should have a default probe`).toBeTruthy();

    await page.goto(shareUrl!);
    // Same-origin share navigation is only a hash change, so reload before the
    // application reads the recorded payload from location.hash.
    await page.reload();
    const banner = page.locator("#engine-banner");
    await expect(page.locator("#workspace-button")).toHaveText(example!.title);
    await expect(page).toHaveURL(/#c=/);
    await expect.poll(async () => Number(await banner.getAttribute("data-solve-started") ?? 0), {
      message: `${id} should start a solve from its share payload`,
      timeout: 45_000,
    }).toBeGreaterThan(0);
    const started = await banner.getAttribute("data-solve-started");
    await expect(banner, `${id} should complete the solve it started`).toHaveAttribute("data-solve-completed", started!, { timeout: 45_000 });
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".error-toast")).toHaveCount(0);

    const defaultProbeId = example!.defaultProbeId!;
    await expect(page.getByTestId("trace-list").locator(`[data-trace-id="${defaultProbeId}"]`), `${id} default trace should be listed`).toHaveCount(1);
    await expect.poll(() => page.evaluate((probeId) =>
      window.__ocSignalSeries?.find((candidate) => candidate.definition.id === probeId)?.signal.length ?? 0,
    defaultProbeId), { message: `${id} should resolve its default trace`, timeout: 45_000 }).toBeGreaterThan(1);
    const trace = await page.evaluate((probeId) => {
      const series = window.__ocSignalSeries?.find((candidate) => candidate.definition.id === probeId);
      const values = series ? Array.from(series.signal.values) : [];
      return {
        samples: values.length,
        finite: values.every(Number.isFinite),
        min: values.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY),
        max: values.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY),
        maxAbs: values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0),
      };
    }, defaultProbeId);
    expect(trace.samples, `${id} default trace should contain samples`).toBeGreaterThan(1);
    expect(trace.finite, `${id} default trace should contain finite samples`).toBe(true);
    expect(trace.maxAbs, `${id} default trace must not be flat zero`).toBeGreaterThan(1e-9);
    if (id === "555-astable") {
      expect(trace.max - trace.min, "555 output should oscillate over time").toBeGreaterThan(1);
    }
    if (id === "h-bridge") {
      expect(trace.max, "H-bridge load current should flow forward").toBeGreaterThan(0.1);
      expect(trace.min, "H-bridge load current should reverse").toBeLessThan(-0.1);
    }

    if (screenshotDirectory && NEW_SCREENSHOT_IDS.has(id)) {
      await page.screenshot({ path: resolve(screenshotDirectory, `example-${id}.png`), fullPage: true });
    }
  }
});

test("loads all bundled examples from the catalog and solves", async ({ page }, testInfo) => {
  test.setTimeout(5 * 60_000);

  for (const [id, title] of examples) {
    const banner = page.locator("#engine-banner");
    const completedBefore = Number(await banner.getAttribute("data-solve-completed") ?? 0);
    await page.getByRole("button", { name: "Examples" }).click();
    const dialog = page.getByRole("dialog", { name: "Example circuits" });
    await dialog.locator(`[data-example="${id}"]`).click();
    await expect(page.locator("#workspace-button")).toHaveText(title);
    await expect(page).toHaveURL(new RegExp(`#example=${id}$`));
    await expect.poll(async () => Number(await banner.getAttribute("data-solve-started")), { message: `${id} should start a fresh solve` }).toBeGreaterThan(completedBefore);
    const started = await banner.getAttribute("data-solve-started");
    await expect(banner, `${id} should complete the solve it started`).toHaveAttribute("data-solve-completed", started!);
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".error-toast")).toHaveCount(0);
    if (id === "rc-filter-bode" || id === "mosfet-led-switch") {
      await expect(page.locator(".oc-waveform-viewer__trace")).toHaveCount(2, { timeout: 45_000 });
      await page.waitForTimeout(100);
      await page.screenshot({ path: testInfo.outputPath(id === "rc-filter-bode" ? "example-rc-filter-bode.png" : "example-mosfet-led-switch.png"), fullPage: true });
    }
  }
});

test("opamp example keeps its generated background outline", async ({ page }) => {
  await page.goto("/#example=opamp-noninverting");
  await page.reload();
  await expect(page.locator("#workspace-button")).toHaveText("TL072 non-inverting amplifier");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });

  const body = page.locator('[data-component-id="c4"] .sym-bg');
  await expect(body).toHaveCount(1);
  expect(await body.evaluate((element) => getComputedStyle(element).stroke)).not.toBe("none");
});

test("catalog renders model detail and places real 2N3904 model", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Catalog" }).click();
  const dialog = page.getByRole("dialog", { name: "Component catalog" });
  await expect(dialog).toBeVisible();
  expect(await dialog.locator("[data-catalog-part]").count()).toBeGreaterThanOrEqual(5);
  await page.screenshot({ path: testInfo.outputPath("catalog-view.png"), fullPage: true });

  // The index renders in chunks, so 771 rows never lay out at once. Reach a
  // package the way a user does, by searching for it.
  await dialog.locator("#catalog-search").fill("2N3904");
  await dialog.locator('[data-catalog-part="onsemi/2N3904"]').click();
  await expect(dialog.getByTestId("model-card")).toContainText("2N3904 model card");
  await expect(dialog.getByRole("link", { name: "View model source and tests on GitHub" })).toHaveAttribute("href", /packages\/model-library\/models\/onsemi\/2N3904$/);
  await page.screenshot({ path: testInfo.outputPath("catalog-2n3904-model-card.png"), fullPage: true });

  await dialog.getByRole("button", { name: "Place 2N3904" }).click();
  const box = await page.locator("#editor-host").boundingBox();
  if (!box) throw new Error("Editor host is not visible");
  await page.mouse.click(box.x + 520, box.y + 250);
  await expect(page.locator(".inspector .fidelity")).toHaveText("F2");
  await expect(page.locator("#engine-status")).toContainText("ENGINE READY", { timeout: 45_000 });
  const netlist = await page.evaluate(() => window.__ocLastNetlist ?? "");
  expect(netlist).toContain("OC_ONSEMI_2N3904");
  expect(netlist).toMatch(/Q\w+\s+\S+\s+\S+\s+\S+\s+OC_ONSEMI_2N3904/);
});
