import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import {
  createDesignerRuntimeReleaseReceiptV1,
  type DesignerRuntimeReleaseContextV1,
} from "@opencircuit/designer-release-audit/runtime-release-receipt";
import {
  createDesignerRuntimeReportV1,
  parseDesignerRuntimeContractV1,
  type DesignerRuntimeApplicationMeasurementV1,
  type DesignerRuntimeContractV1,
} from "../../../packages/designer-release-audit/src/designer-runtime-audit";
import { auditStaticOfflineNetworkBuild } from "../scripts/static-offline-audit.mjs";

const contract = parseDesignerRuntimeContractV1(JSON.parse(readFileSync(
  new URL("../designer-runtime-contract.json", import.meta.url),
  "utf8",
)));

interface StableRuntimeEvidenceOutput {
  reportPath: string;
  receiptPath: string;
  context: DesignerRuntimeReleaseContextV1;
}

type RuntimeExactIdentity =
  | Pick<
      Extract<DesignerRuntimeApplicationMeasurementV1, { completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled" }>,
      "application" | "requestHash" | "resultContentHash" | "completionPoint" | "candidateId" | "previewContentHash"
    >
  | Pick<
      Extract<DesignerRuntimeApplicationMeasurementV1, { completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled" }>,
      "application" | "requestHash" | "resultContentHash" | "completionPoint" | "candidateId" | "constraintDecisionContentHash" | "candidateEligible" | "previewContentHash"
    >;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required for stable runtime release evidence`);
  return value;
}

function stableRuntimeEvidenceOutput(): StableRuntimeEvidenceOutput | undefined {
  const reportPath = process.env.DESIGNER_RUNTIME_REPORT_OUTPUT;
  const receiptPath = process.env.DESIGNER_RUNTIME_RECEIPT_OUTPUT;
  if ((reportPath === undefined) !== (receiptPath === undefined)) {
    throw new Error("DESIGNER_RUNTIME_REPORT_OUTPUT and DESIGNER_RUNTIME_RECEIPT_OUTPUT must be set together");
  }
  if (reportPath === undefined || receiptPath === undefined) return undefined;
  if (reportPath.trim().length === 0 || receiptPath.trim().length === 0) {
    throw new Error("Stable runtime release evidence output paths must not be empty");
  }
  if (resolve(reportPath) === resolve(receiptPath)) {
    throw new Error("Stable runtime report and receipt outputs must be different files");
  }

  const event = requiredEnvironment("GITHUB_EVENT_NAME");
  if (event !== "workflow_dispatch") {
    throw new Error("Stable runtime release evidence is restricted to workflow_dispatch");
  }
  const runAttemptText = requiredEnvironment("GITHUB_RUN_ATTEMPT");
  const runAttempt = Number(runAttemptText);
  if (!Number.isSafeInteger(runAttempt) || runAttempt < 1 || String(runAttempt) !== runAttemptText) {
    throw new Error("GITHUB_RUN_ATTEMPT must be a canonical positive integer");
  }
  const context: DesignerRuntimeReleaseContextV1 = {
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    sourceRevision: requiredEnvironment("GITHUB_SHA"),
    workflowRevision: requiredEnvironment("GITHUB_WORKFLOW_SHA"),
    workflowRef: requiredEnvironment("GITHUB_WORKFLOW_REF"),
    event,
    job: requiredEnvironment("GITHUB_JOB"),
    runId: requiredEnvironment("GITHUB_RUN_ID"),
    runAttempt,
    artifactName: requiredEnvironment("DESIGNER_RUNTIME_ARTIFACT_NAME"),
  };
  return { reportPath, receiptPath, context };
}

const releaseEvidenceOutput = stableRuntimeEvidenceOutput();

function textContentHash(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!;
}

async function browserNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

async function longTaskCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as Window & { __designerRuntimeLongTasks?: number }).__designerRuntimeLongTasks ?? 0);
}

async function jsHeapUsedBytes(session: CDPSession): Promise<number> {
  await session.send("HeapProfiler.collectGarbage");
  const result = await session.send("Performance.getMetrics");
  const metric = result.metrics.find((entry) => entry.name === "JSHeapUsedSize");
  if (metric === undefined || !Number.isFinite(metric.value)) throw new Error("Chromium did not expose JSHeapUsedSize");
  return metric.value;
}

async function waitForDecodedPreview(page: Page): Promise<void> {
  const image = page.locator("[data-production-schematic-preview] img");
  await expect(image).toBeVisible();
  await image.evaluate(async (element) => {
    const imageElement = element as HTMLImageElement;
    if (!imageElement.complete) await imageElement.decode();
    if (imageElement.naturalWidth <= 0) throw new Error("Generated schematic preview did not decode");
  });
}

async function measureApplication(
  page: Page,
  session: CDPSession,
  workload: DesignerRuntimeContractV1["workloads"][number],
): Promise<DesignerRuntimeApplicationMeasurementV1> {
  const applicationAction = workload.application === "motor.brushed-dc"
    ? "Start Motor design"
    : "Start Power design";
  await page.locator(`[data-application="${workload.application}"]`).getByRole("button", { name: applicationAction }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.locator("[data-designer-preset]")).toHaveValue(workload.presetId);
  await expect(page.getByRole("radio", { name: /Reference design/u })).toBeChecked();

  const longTasksBefore = await longTaskCount(page);
  const generationAndPreviewUs: number[] = [];
  const heapSamples: number[] = [];
  let baselineJsHeapBytes = 0;
  let exactIdentity: RuntimeExactIdentity | undefined;

  for (let iteration = 0; iteration < contract.iterationsPerApplication; iteration += 1) {
    const started = await browserNow(page);
    await page.getByRole("button", { name: "Generate design" }).click();
    let observedIdentity: RuntimeExactIdentity;
    if (workload.completionPoint === "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled") {
      expect(workload.application).toBe("motor.brushed-dc");
      await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible();
      const trustBanner = page.locator(".designer-trust-banner:visible");
      await expect(trustBanner.getByText("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION", { exact: true })).toHaveCount(0);
      await expect(trustBanner.locator(".designer-chip")).toHaveText("reference / estimated", { ignoreCase: true });
      await page.getByRole("tab", { name: "Schematic" }).click();
      await waitForDecodedPreview(page);
      await page.getByRole("tab", { name: "Optimize" }).click();
      const customization = page.locator("[data-primary-customization]");
      await expect(customization).toHaveAttribute("aria-busy", "false");
      const customizationTargets = customization.locator("[data-primary-customization-target]");
      await expect(customizationTargets).toBeEnabled();
      await expect(customizationTargets.locator("option")).toHaveCount(2);
      generationAndPreviewUs.push(Math.round(((await browserNow(page)) - started) * 1000));

      const previewSource = await page.locator("[data-production-schematic-preview] img").evaluate(async (element) => (
        fetch((element as HTMLImageElement).src).then((response) => response.text())
      ));
      observedIdentity = {
        application: "motor.brushed-dc",
        completionPoint: workload.completionPoint,
        requestHash: await page.locator(".designer-results-header p code").innerText() as `sha256:${string}`,
        resultContentHash: await trustBanner.locator(":scope > code").innerText() as `sha256:${string}`,
        candidateId: await page.locator(".designer-detail-header code").innerText() as `candidate:v2:sha256:${string}`,
        previewContentHash: textContentHash(previewSource),
      };
    } else {
      expect(workload.application).toBe("power.buck");
      await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "No retained candidate" })).toHaveCount(0);
      const trustBanner = page.locator(".designer-trust-banner:visible");
      await expect(trustBanner.getByText("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION", { exact: true })).toHaveCount(0);
      await expect(trustBanner.locator(".designer-chip")).toHaveText("reference / estimated", { ignoreCase: true });
      await expect(page.locator(".designer-results-header")).toContainText("0 eligible · 1 observed");
      await expect(page.locator(".designer-results-header")).toContainText("0 generation exclusions");
      await page.getByTestId("designer-caveats").first().click();
      const caveatDialog = page.getByRole("dialog", { name: "Evidence & caveats" });
      const policy = caveatDialog.locator("[data-production-constraint-policy]");
      await expect(policy).toContainText("1 structural observation");
      await expect(policy).toContainText("0 eligible");
      const ledger = caveatDialog.locator("[data-production-execution-ledger]");
      await expect(ledger.getByRole("heading", { name: "Exact V2 observation execution ledger" })).toBeVisible();
      expect(await ledger.locator("[data-execution-group] > header > strong").allTextContents()).toEqual(["0", "0", "0", "0", "0"]);
      const constraintDecisionContentHash = await policy.getAttribute("data-production-constraint-decision");
      if (constraintDecisionContentHash === null) throw new Error("Power policy surface omitted its exact decision hash");
      await caveatDialog.getByRole("button", { name: "Close evidence and caveats" }).click();
      await expect(page.locator('[data-production-observation-boundary="selected_detail"]')).toContainText("Observation only · Ineligible");
      await page.getByRole("tab", { name: "Export" }).click();
      await expect(page.getByRole("button", { name: "Portable Simulation CSV", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Commercial export", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Open in Simulator", exact: true })).toBeDisabled();
      await page.getByRole("tab", { name: "Schematic" }).click();
      await waitForDecodedPreview(page);
      await page.getByRole("tab", { name: "Optimize" }).click();
      const customization = page.locator("[data-primary-customization]");
      await expect(customization).toHaveAttribute("aria-busy", "false");
      await expect(customization).toContainText("0 compatible");
      await expect(customization).toContainText("No exact same-recipe primary alternate");
      const customizationTargets = customization.locator("[data-primary-customization-target]");
      await expect(customizationTargets).toBeDisabled();
      await expect(customizationTargets.locator("option")).toHaveCount(1);
      generationAndPreviewUs.push(Math.round(((await browserNow(page)) - started) * 1000));

      const previewSource = await page.locator("[data-production-schematic-preview] img").evaluate(async (element) => (
        fetch((element as HTMLImageElement).src).then((response) => response.text())
      ));
      observedIdentity = {
        application: "power.buck",
        completionPoint: workload.completionPoint,
        requestHash: await page.locator(".designer-results-header p code").innerText() as `sha256:${string}`,
        resultContentHash: await trustBanner.locator(":scope > code").innerText() as `sha256:${string}`,
        candidateId: await page.locator(".designer-detail-header code").innerText() as `candidate:v2:sha256:${string}`,
        constraintDecisionContentHash: constraintDecisionContentHash as `sha256:${string}`,
        candidateEligible: false,
        previewContentHash: textContentHash(previewSource),
      };
    }
    if (exactIdentity === undefined) exactIdentity = observedIdentity;
    else expect(observedIdentity).toEqual(exactIdentity);

    const heap = await jsHeapUsedBytes(session);
    heapSamples.push(heap);
    if (iteration === 0) baselineJsHeapBytes = heap;

    if (iteration + 1 < contract.iterationsPerApplication) {
      await page.getByRole("button", { name: "← Edit requirements" }).click();
      await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
    }
  }

  const finalJsHeapBytes = heapSamples.at(-1)!;
  if (exactIdentity === undefined) throw new Error("Runtime workload produced no exact identity");
  return {
    presetId: workload.presetId,
    ...exactIdentity,
    generationAndPreviewUs,
    p95Us: percentile95(generationAndPreviewUs),
    baselineJsHeapBytes,
    finalJsHeapBytes,
    maximumJsHeapBytes: Math.max(...heapSamples),
    retainedJsHeapGrowthBytes: Math.max(0, finalJsHeapBytes - baselineJsHeapBytes),
    longTasks: (await longTaskCount(page)) - longTasksBefore,
  };
}

test("Motor and ineligible Power previews stay within the environment-bound Designer runtime contract", async ({
  browser,
  browserName,
  page,
}, testInfo) => {
  test.skip(browserName !== "chromium", "Chromium DevTools JS heap metrics define this environment-bound contract");

  expect(contract.format).toBe("schemagic-designer-runtime-contract");
  expect(contract.schemaVersion).toBe(1);
  expect(contract.scope).toBe("local_headless_chromium_production_build");
  expect(contract.boundaries).toMatchObject({ attestation: "none" });
  expect(contract.workloads.map((entry) => entry.application)).toEqual(["motor.brushed-dc", "power.buck"]);
  expect(page.viewportSize()).toEqual(contract.runner.viewport);

  await page.addInitScript(() => {
    const runtimeWindow = window as Window & { __designerRuntimeLongTasks?: number };
    runtimeWindow.__designerRuntimeLongTasks = 0;
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((entries) => {
        runtimeWindow.__designerRuntimeLongTasks = (runtimeWindow.__designerRuntimeLongTasks ?? 0) + entries.getEntries().length;
      }).observe({ type: "longtask", buffered: true });
    }
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
  });

  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
  const routeInteractiveUs = Math.round((await browserNow(page)) * 1000);
  expect(routeInteractiveUs).toBeLessThanOrEqual(contract.budgets.routeInteractiveUs);

  const measurements: DesignerRuntimeApplicationMeasurementV1[] = [];
  for (const workload of contract.workloads) {
    if (measurements.length > 0) {
      await page.goto("/?designer");
      await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
    }
    const measurement = await measureApplication(page, session, workload);
    expect(measurement.p95Us).toBeLessThanOrEqual(contract.budgets.generationAndPreviewP95Us);
    expect(measurement.maximumJsHeapBytes).toBeLessThanOrEqual(contract.budgets.maximumJsHeapBytes);
    expect(measurement.retainedJsHeapGrowthBytes).toBeLessThanOrEqual(contract.budgets.retainedJsHeapGrowthBytes);
    expect(measurement.longTasks).toBeLessThanOrEqual(contract.budgets.longTasksPerApplication);
    measurements.push(measurement);
  }

  const staticAudit = auditStaticOfflineNetworkBuild(new URL("../dist/", import.meta.url));
  expect(staticAudit.status).toBe("pass");
  const report = createDesignerRuntimeReportV1({
    format: "schemagic-designer-runtime-report",
    schemaVersion: 1,
    contract: { version: contract.version, contentHash: contract.contentHash },
    productionArtifactSetHash: staticAudit.artifactSetHash,
    environment: {
      scope: contract.scope,
      browser: "chromium",
      browserVersion: browser.version(),
      platform: process.platform,
      architecture: process.arch,
    },
    measurements: { routeInteractiveUs, applications: measurements },
    boundaries: structuredClone(contract.boundaries),
  }, contract);
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
  const reportPath = testInfo.outputPath("designer-runtime-report.json");
  writeFileSync(reportPath, reportBytes);
  await testInfo.attach("designer-runtime-report.json", {
    path: reportPath,
    contentType: "application/json",
  });
  if (releaseEvidenceOutput !== undefined) {
    const receipt = createDesignerRuntimeReleaseReceiptV1(
      reportBytes,
      contract,
      releaseEvidenceOutput.context,
    );
    mkdirSync(dirname(releaseEvidenceOutput.reportPath), { recursive: true });
    mkdirSync(dirname(releaseEvidenceOutput.receiptPath), { recursive: true });
    writeFileSync(releaseEvidenceOutput.reportPath, reportBytes);
    writeFileSync(releaseEvidenceOutput.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  }
  console.log(`Designer runtime report ${report.contentHash}: ${JSON.stringify(report.measurements)}`);
});
