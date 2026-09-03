import { expect, test, type Page } from "@playwright/test";
import type { CircuitDocument, ComponentType } from "@opencircuit/circuit-schema";
import { encodeCircuit } from "../src/share";

const switchTypes = [
  "switch_spst", "switch_spdt", "switch_dpdt",
  "switch_pushbutton", "switch_toggle", "switch_vcontrolled",
] as const satisfies readonly ComponentType[];

async function ready(page: Page, document?: CircuitDocument): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    localStorage.setItem("schemagic.guidance-dismissed", "1");
    sessionStorage.clear();
  });
  await page.goto(document ? `/#c=${encodeCircuit(document)}` : "/");
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

function switchedLoad(type: "switch_toggle" | "switch_pushbutton"): CircuitDocument {
  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: `${type} solved bench` },
    components: [
      { id: "c1", type: "battery", value: 5, pos: [0, 2], rot: 0, mirror: false, label: { text: "BAT1", offset: [2, -1] } },
      { id: "c2", type, params: { closed: false }, pos: [4, 0], rot: 0, mirror: false, label: { text: "S1", offset: [0, -2] } },
      { id: "c3", type: "resistor", value: "1k", pos: [8, 0], rot: 0, mirror: false, label: { text: "R1", offset: [0, -2] } },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [10, 0], rot: 0, mirror: false },
    ],
    wires: [{ id: "w1", points: [[0, 0], [2, 0]] }],
    probes: [],
    sim: { mode: "op" },
  };
}

async function selectSwitch(page: Page): Promise<void> {
  await page.locator('[data-component-id="c2"] .editor-component-hit').click({ force: true });
  await expect(page.locator('[data-component-id="c2"]')).toHaveClass(/selected/);
}

async function waitForNextSolve(page: Page, previous: string | null): Promise<void> {
  await expect.poll(() => page.getByTestId("engine-banner").getAttribute("data-solve-completed"), { timeout: 45_000 }).not.toBe(previous);
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
}

test.describe("Simulator V3 browser controls", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Placement and solved-state coverage runs once in Chromium");

  test("places every switch family symbol from the browser palette", async ({ page }) => {
    await ready(page);
    const bounds = await page.locator("#editor-host").boundingBox();
    if (!bounds) throw new Error("Editor host is not visible");
    for (const [index, type] of switchTypes.entries()) {
      await page.locator(`[data-tool="${type}"]`).click();
      const column = index % 3;
      const row = Math.floor(index / 3);
      await page.mouse.click(bounds.x + bounds.width * (0.55 + column * 0.12), bounds.y + bounds.height * (0.18 + row * 0.16));
      await expect(page.locator(`[data-component-type="${type}"]`)).toHaveCount(1);
    }
  });

  test("toggle state changes a completed solve", async ({ page }) => {
    await ready(page, switchedLoad("switch_toggle"));
    await selectSwitch(page);
    const beforeSolve = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    const beforeReading = await page.getByTestId("branch-current").textContent();
    expect(await page.evaluate(() => window.__ocLastNetlist)).toMatch(/^R_SW_c2 \S+ \S+ 1G /m);
    await page.locator("#switch-state").check();
    await waitForNextSolve(page, beforeSolve);
    expect(await page.evaluate(() => window.__ocLastNetlist)).toMatch(/^R_SW_c2 \S+ \S+ 1m /m);
    await expect.poll(() => page.getByTestId("branch-current").textContent()).not.toBe(beforeReading);
  });

  test("pushbutton closes on press and opens on release", async ({ page }) => {
    await ready(page, switchedLoad("switch_pushbutton"));
    await selectSwitch(page);
    const button = page.locator("#pushbutton-state");
    const bounds = await button.boundingBox();
    if (!bounds) throw new Error("Momentary control is not visible");
    const openSolve = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveText("Pressed");
    await waitForNextSolve(page, openSolve);
    expect(await page.evaluate(() => window.__ocLastNetlist)).toMatch(/^R_SW_c2 \S+ \S+ 1m /m);
    const closedSolve = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    await page.mouse.up();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toHaveText("Press and hold");
    await waitForNextSolve(page, closedSolve);
    expect(await page.evaluate(() => window.__ocLastNetlist)).toMatch(/^R_SW_c2 \S+ \S+ 1G /m);

    await button.focus();
    const beforeKeyboardPress = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    await page.keyboard.down("Space");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await waitForNextSolve(page, beforeKeyboardPress);
    expect(await page.evaluate(() => window.__ocLastNetlist)).toMatch(/^R_SW_c2 \S+ \S+ 1m /m);
    const beforeKeyboardRelease = await page.getByTestId("engine-banner").getAttribute("data-solve-completed");
    await page.keyboard.up("Space");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await waitForNextSolve(page, beforeKeyboardRelease);
    expect(await page.evaluate(() => window.__ocLastNetlist)).toMatch(/^R_SW_c2 \S+ \S+ 1G /m);
  });

  test("every specialty element ships in a completed solved example", async ({ page }) => {
    await ready(page);
    const examples: readonly [string, RegExp][] = [
      ["battery-fuse-load", /^V1 battery 0 DC 5 \$ component:c1[\s\S]*^R_FUSE_c2 battery load 50m \$ component:c2/m],
      ["current-pulse-load", /^I1 out oc_ac_c1 PULSE\(0 5m 1m 10u 10u 4m 10m\) \$ component:c1[\s\S]*^VOCS_c1 oc_ac_c1 0 0 \$ component:c1[\s\S]*^\.save all vocs_c1#branch/m],
      ["transformer-isolation", /^K_XFMR_c3 L_XFMR_c3_P L_XFMR_c3_S 0\.99 \$ component:c3/m],
      ["crystal-resonator", /^C_XTAL_c3_S oc_y3_b vout 20f \$ component:c3/m],
      ["transmission-line-delay", /^T3 line_in 0 line_out 0 Z0=50 TD=1m \$ component:c3/m],
    ];
    for (const [id, netlistPattern] of examples) {
      await page.goto(`/#example=${id}`);
      await page.reload();
      await expect(page.getByTestId("engine-ready"), `${id} should complete its configured analysis`).toBeVisible({ timeout: 45_000 });
      await expect(page.locator(".error-toast"), `${id} should solve without a UI error`).toHaveCount(0);
      const netlist = await page.evaluate(() => window.__ocLastNetlist ?? "");
      expect(netlist, id).toMatch(netlistPattern);
      if(id==="current-pulse-load"){
        await expect(page.getByRole("button",{name:"DC",exact:true})).toBeDisabled();
        await expect(page.getByRole("button",{name:"AC",exact:true})).toBeDisabled();
        await expect(page.getByRole("button",{name:"NOISE",exact:true})).toBeDisabled();
        await page.locator('[data-component-id="c1"] .editor-component-hit').click({force:true});
        await expect(page.locator('[data-source-param="rise"]')).toHaveValue("10u");
        await expect(page.locator('[data-source-param="fall"]')).toHaveValue("10u");
        await expect(page.getByTestId("branch-current")).not.toHaveText("–");
      }
    }
  });

  test("zener example completes with its reviewed catalog model", async ({ page }) => {
    await ready(page);
    await page.goto("/#example=zener-regulator");
    await page.reload();
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    const netlist = await page.evaluate(() => window.__ocLastNetlist ?? "");
    expect(netlist).toMatch(/^D3 0 vout OC_ONSEMI_1N4733A \$ component:c3$/m);
    expect(netlist).toMatch(/^\.model OC_ONSEMI_1N4733A D\([^\n]*\bBV=5\.1000000000e\+00\b/m);
    expect(netlist).not.toContain("awaiting its catalog package model");
  });
});
