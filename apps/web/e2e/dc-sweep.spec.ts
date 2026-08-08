import { expect, test } from "@playwright/test";

const bjtOutputFamily = {
  format: "opencircuit-circuit",
  version: 1,
  meta: { title: "2N3904 output family" },
  components: [
    { id: "c1", type: "vsource", value: 5, pos: [8, 12], rot: 0, mirror: false, label: { text: "VCE", offset: [-4, 0] } },
    { id: "c2", type: "vsource", value: 0.7, pos: [8, 24], rot: 0, mirror: false, label: { text: "VB", offset: [-4, 0] } },
    { id: "c3", type: "resistor", value: 100, pos: [18, 10], rot: 0, mirror: false, label: { text: "RC", offset: [0, -3] } },
    { id: "c4", type: "resistor", value: "10k", pos: [16, 22], rot: 0, mirror: false, label: { text: "RB", offset: [0, 3] } },
    { id: "c5", type: "bjt_npn", mpn: "2N3904", pos: [26, 18], rot: 0, mirror: false, label: { text: "Q1", offset: [5, 0] } },
    { id: "c6", type: "ground", pos: [8, 14], rot: 0, mirror: false },
    { id: "c7", type: "ground", pos: [8, 26], rot: 0, mirror: false },
    { id: "c8", type: "ground", pos: [28, 22], rot: 0, mirror: false },
  ],
  wires: [
    { id: "w1", points: [[8, 10], [16, 10]] },
    { id: "w2", points: [[20, 10], [28, 10], [28, 14]] },
    { id: "w3", points: [[8, 22], [14, 22]] },
    { id: "w4", points: [[18, 22], [24, 22], [24, 18]] },
  ],
  probes: [{ id: "p1", kind: "voltage", target: { wire: "w2" }, color: "#3FD983" }],
  sim: {
    mode: "dc-sweep",
    dcSweep: {
      sourceId: "c1", start: 0, stop: 5, step: 0.25,
      secondary: { sourceId: "c2", start: 0.55, stop: 0.85, step: 0.1 },
    },
  },
} as const;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "DC sweep acceptance runs once in Chromium");
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await page.locator("#json-file").setInputFiles({
    name: "bjt-output-family.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bjtOutputFamily)),
  });
  await expect(page.getByTestId("dc-sweep-panel")).toBeVisible();
  await page.waitForFunction(() => window.__ocLastNetlist?.includes(".dc V1 0 5 0.25 V2") ?? false, undefined, { timeout: 45_000 });
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
});

test("runs a stepped DC sweep from wire probes and plots the curve family", async ({ page }) => {
  await page.locator("#dc-primary-step").fill("-0.25");
  await page.getByRole("button", { name: "Run sweep" }).click();
  await expect(page.locator("#dc-sweep-error")).toHaveText("Sweep step sign must move from start toward stop");

  await page.locator("#dc-primary-step").fill("0.25");
  await page.getByRole("button", { name: "Run sweep" }).click();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".error-toast")).toHaveCount(0);
  await expect(page.locator(".scope-probe-marker")).toHaveCount(1);
  await expect(page.locator(".oc-waveform-viewer__trace")).toHaveCount(4);
  await expect(page.locator(".oc-waveform-viewer__legend")).toContainText("V2=550 mV");
  await expect(page.locator(".oc-waveform-viewer__legend")).toContainText("V2=850 mV");

  const netlist = await page.evaluate(() => window.__ocLastNetlist ?? "");
  expect(netlist).toContain(".dc V1 0 5 0.25 V2 0.55 0.85 0.1");

  await page.locator(".oc-waveform-viewer__canvas").click({ position: { x: 220, y: 100 } });
  await expect(page.locator(".oc-waveform-viewer__readout")).not.toContainText("Cursor A off");
  await expect(page.locator(".oc-waveform-viewer__readout")).toContainText("A:V(");
});
