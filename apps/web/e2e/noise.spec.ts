import { expect, test } from "@playwright/test";

const resistorDividerNoise = {
  format: "opencircuit-circuit",
  version: 2,
  meta: { title: "Resistor divider noise" },
  components: [
    { id: "c1", type: "vsource", value: 1, pos: [8, 12], rot: 0, mirror: false, label: { text: "VIN", offset: [-4, 0] } },
    { id: "c2", type: "resistor", value: "1k", pos: [14, 10], rot: 0, mirror: false, label: { text: "R1", offset: [0, -3] } },
    { id: "c3", type: "resistor", value: "1k", pos: [18, 14], rot: 90, mirror: false, label: { text: "R2", offset: [4, 0] } },
    { id: "c4", type: "ground", pos: [8, 14], rot: 0, mirror: false },
    { id: "c5", type: "ground", pos: [18, 16], rot: 0, mirror: false },
  ],
  wires: [
    { id: "w1", points: [[8, 10], [12, 10]] },
    { id: "w2", points: [[16, 10], [18, 10], [18, 12]] },
  ],
  probes: [{ id: "p1", kind: "voltage", target: { wire: "w2" }, color: "#3FD983" }],
  sim: {
    mode: "noise",
    noise: {
      outputProbeId: "p1",
      inputSourceId: "c1",
      fstart: 10,
      fstop: 100_000,
      pointsPerDecade: 10,
      sweep: "dec",
      temperatureC: 27,
    },
  },
} as const;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Noise acceptance runs once in Chromium");
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await page.locator("#json-file").setInputFiles({
    name: "resistor-divider-noise.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(resistorDividerNoise)),
  });
  await expect(page.getByTestId("noise-panel")).toBeVisible();
  await page.waitForFunction(() => window.__ocLastNetlist?.includes(".noise V(n2) V1") ?? false, undefined, { timeout: 45_000 });
  await expect(page.getByTestId("noise-totals")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
});

test("runs resistor thermal noise and exposes input/output assumptions and totals", async ({ page }) => {
  await page.locator("#noise-start").fill("0");
  await page.getByRole("button", { name: "Run noise" }).click();
  await expect(page.locator("#noise-error")).toHaveText("Noise start frequency must be greater than zero");

  await page.locator("#noise-start").fill("10");
  await page.getByRole("button", { name: "Run noise" }).click();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".error-toast")).toHaveCount(0);
  await expect(page.locator(".oc-waveform-viewer__trace")).toHaveCount(2);
  await expect(page.locator(".oc-waveform-viewer__legend")).toContainText("Output noise at V(n2)");
  await expect(page.locator(".oc-waveform-viewer__legend")).toContainText("Input-referred to V1");

  const totals = page.getByTestId("noise-totals");
  await expect(totals).toBeVisible();
  await expect(totals).toContainText("Integrated output");
  await expect(totals).toContainText("Integrated input-referred");
  await expect(totals).toContainText("RMS");
  await expect(totals).toContainText("V²");
  await expect(totals).toContainText("27 °C");

  const panel = page.getByTestId("noise-panel");
  await expect(panel).toContainText("DC operating point");
  await expect(panel).toContainText("Ideal independent sources are noiseless");
  await expect(panel).toContainText("forced to AC 1 only as a gain reference");
  await expect(panel).toContainText("output noise divided by the small-signal gain");

  const netlist = await page.evaluate(() => window.__ocLastNetlist ?? "");
  expect(netlist).toContain("V1 n1 0 DC 1 AC 1");
  expect(netlist).toContain(".temp 27");
  expect(netlist).toContain(".noise V(n2) V1 dec 10 10 100000");

  await page.locator(".oc-waveform-viewer__canvas").click({ position: { x: 260, y: 110 } });
  await expect(page.locator(".oc-waveform-viewer__readout")).toContainText("A:Output noise at V(n2)");
  await expect(page.locator(".oc-waveform-viewer__readout")).toContainText("V/√Hz");
});
