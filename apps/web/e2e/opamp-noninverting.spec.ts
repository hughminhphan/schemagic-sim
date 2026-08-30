import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => browserName !== "chromium", "The installed-Chrome ngspice regression runs once");

test("fresh TL072 demo produces its promised closed-loop transient gain", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/#example=opamp-noninverting");
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("schemagic-simulator");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".error-toast")).toHaveCount(0);

  const result = await page.evaluate(() => {
    const amplitude = (values: ArrayLike<number>) => {
      const samples = Array.from(values);
      return (Math.max(...samples) - Math.min(...samples)) / 2;
    };
    const input = window.__ocSignalSeries?.find((series) => series.definition.id === "p1");
    const output = window.__ocSignalSeries?.find((series) => series.definition.id === "p2");
    const inputValues = input ? Array.from(input.signal.values) : [];
    const outputValues = output ? Array.from(output.signal.values) : [];
    const inputPeakIndex = inputValues.reduce(
      (best, value, index) => value > (inputValues[best] ?? Number.NEGATIVE_INFINITY) ? index : best,
      0,
    );
    return {
      inputAmplitude: amplitude(inputValues),
      outputAmplitude: amplitude(outputValues),
      outputAtInputPeak: outputValues[inputPeakIndex] ?? 0,
      inputSamples: input?.signal.length ?? 0,
      outputSamples: output?.signal.length ?? 0,
      netlist: window.__ocLastNetlist ?? "",
    };
  });

  expect(result.inputSamples).toBeGreaterThan(500);
  expect(result.outputSamples).toBe(result.inputSamples);
  expect(result.inputAmplitude).toBeGreaterThan(0.99);
  expect(result.inputAmplitude).toBeLessThan(1.01);
  expect(result.outputAmplitude / result.inputAmplitude).toBeGreaterThan(10.5);
  expect(result.outputAmplitude / result.inputAmplitude).toBeLessThan(11.5);
  expect(result.outputAtInputPeak).toBeGreaterThan(10.5);
  const opamp = result.netlist.match(/X4\s+(\S+)\s+(\S+)\s+\S+\s+\S+\s+(\S+)\s+OC_TI_TL072/);
  const feedback = result.netlist.match(/R5\s+(\S+)\s+(\S+)\s+100k/);
  expect(opamp).not.toBeNull();
  expect(feedback).not.toBeNull();
  expect(feedback?.[1]).toBe(opamp?.[2]);
  expect(feedback?.[2]).toBe(opamp?.[3]);
});
