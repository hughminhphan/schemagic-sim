import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  createPrimaryPartCustomizationSidecarV1,
  createPrimaryPartCustomizedResultSidecarV1,
  PRIMARY_PART_CUSTOMIZATION_MAX_BYTES,
} from "@opencircuit/design-schema";
import {
  createCustomizedTargetInspectionReceiptV1,
  CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1,
  parseCustomizedTargetInspectionReceiptV1Text,
  serializeCustomizedTargetInspectionReceiptV1,
} from "../../../packages/design-export/src/customized-target-inspection-receipt-v1";

const UNKNOWN_PROFILE_CONTENT_HASH = `sha256:${"0".repeat(64)}` as const;

type CustomizedTargetArtifactKind =
  | "customized_target_electrical_bom_csv"
  | "customized_target_structural_svg"
  | "customized_target_engineering_report_html"
  | "customized_target_structural_kicad"
  | "customized_target_behavioral_scenario_spice";

function receiptWithMismatchedInstruction(source: string): string {
  const receipt = parseCustomizedTargetInspectionReceiptV1Text(source);
  const {
    contentHash: _instructionContentHash,
    ...instructionDraft
  } = receipt.customizedResult.instruction;
  const instruction = createPrimaryPartCustomizationSidecarV1({
    ...instructionDraft,
    substitution: {
      ...instructionDraft.substitution,
      targetProfile: {
        ...instructionDraft.substitution.targetProfile,
        contentHash: UNKNOWN_PROFILE_CONTENT_HASH,
      },
    },
  });
  const {
    contentHash: _customizedResultContentHash,
    ...customizedResultDraft
  } = receipt.customizedResult;
  const customizedResult = createPrimaryPartCustomizedResultSidecarV1({
    ...customizedResultDraft,
    instruction,
  });
  return serializeCustomizedTargetInspectionReceiptV1(
    createCustomizedTargetInspectionReceiptV1(customizedResult),
  );
}

async function downloadInstruction(page: Page): Promise<{ filename: string; content: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download instruction", exact: true }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Playwright did not retain the customization instruction download");
  return {
    filename: download.suggestedFilename(),
    content: readFileSync(path, "utf8"),
  };
}

async function downloadCustomizedTargetArtifact(
  page: Page,
  kind: CustomizedTargetArtifactKind,
): Promise<{ filename: string; content: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(`[data-customized-target-export="${kind}"]`).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Playwright did not retain the customized-target artifact download");
  return {
    filename: download.suggestedFilename(),
    content: readFileSync(path, "utf8"),
  };
}

async function downloadCustomizedTargetInspectionReceipt(
  page: Page,
): Promise<{ filename: string; content: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("[data-customized-target-receipt-export]").click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Playwright did not retain the customized-target inspection receipt");
  return {
    filename: download.suggestedFilename(),
    content: readFileSync(path, "utf8"),
  };
}

async function ordinaryResultHash(page: Page): Promise<string> {
  return page.locator(".designer-trust-banner > code").innerText();
}

async function selectedCandidateId(page: Page): Promise<string> {
  const value = await page.locator('.designer-comparison-table tr[aria-current="true"] [data-imported-candidate]')
    .getAttribute("data-imported-candidate");
  if (!value) throw new Error("Designer did not expose the selected ordinary candidate identity");
  return value;
}

async function startReferenceDesign(page: Page, application: "Motor" | "Power"): Promise<void> {
  await page.getByRole("button", { name: `Start ${application} design`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByLabel("Reference design", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Generate design", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
}

async function openWorkspaceTab(page: Page, name: "Operating results" | "Optimize"): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
});

test("ordinary Motor target discovery starts after the exact structural preview decodes and remains eventual", async ({ page }) => {
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __deferredCustomizationProbe?: {
        targetRendered: boolean;
        previewCompleteAtTargetRender: boolean;
        previewNaturalWidthAtTargetRender: number;
      };
      __deferredCustomizationObserver?: MutationObserver;
    };
    testWindow.__deferredCustomizationProbe = {
      targetRendered: false,
      previewCompleteAtTargetRender: false,
      previewNaturalWidthAtTargetRender: 0,
    };
    const inspect = (): void => {
      if (document.querySelector("[data-primary-customization-target] option:nth-child(2)") === null) return;
      const image = document.querySelector<HTMLImageElement>("[data-production-schematic-preview] img");
      testWindow.__deferredCustomizationProbe = {
        targetRendered: true,
        previewCompleteAtTargetRender: image?.complete ?? false,
        previewNaturalWidthAtTargetRender: image?.naturalWidth ?? 0,
      };
      testWindow.__deferredCustomizationObserver?.disconnect();
    };
    testWindow.__deferredCustomizationObserver = new MutationObserver(inspect);
    testWindow.__deferredCustomizationObserver.observe(document.body, { childList: true, subtree: true });
  });
  await startReferenceDesign(page, "Motor");
  const preview = page.locator("[data-production-schematic-preview] img");
  await expect(preview).toBeVisible();
  await preview.evaluate(async (image) => {
    const previewImage = image as HTMLImageElement;
    if (!previewImage.complete) await previewImage.decode();
    if (previewImage.naturalWidth <= 0) throw new Error("Exact structural preview did not decode");
  });
  await openWorkspaceTab(page, "Optimize");
  const targetSelect = page.locator("[data-primary-customization-target]");
  await expect(targetSelect).toBeEnabled();
  await expect(targetSelect.locator("option")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => (
    (window as Window & {
      __deferredCustomizationProbe?: { targetRendered: boolean };
    }).__deferredCustomizationProbe?.targetRendered ?? false
  ))).toBe(true);
  expect(await page.evaluate(() => (
    (window as Window & {
      __deferredCustomizationProbe?: {
        previewCompleteAtTargetRender: boolean;
        previewNaturalWidthAtTargetRender: number;
      };
    }).__deferredCustomizationProbe
  ))).toMatchObject({
    previewCompleteAtTargetRender: true,
    previewNaturalWidthAtTargetRender: expect.any(Number),
  });
  expect(await page.evaluate(() => (
    (window as Window & {
      __deferredCustomizationProbe?: { previewNaturalWidthAtTargetRender: number };
    }).__deferredCustomizationProbe?.previewNaturalWidthAtTargetRender ?? 0
  ))).toBeGreaterThan(0);
});

test("a structural preview decode failure stops optional target discovery and owns an error surface", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () => Promise.reject(new DOMException("forced decode failure", "EncodingError")),
    });
  });
  await startReferenceDesign(page, "Motor");
  const preview = page.locator("[data-production-schematic-preview]");
  await expect(preview.locator('[data-status="error"]')).toContainText("Structural preview unavailable");
  await expect(preview).toContainText("Exact structural preview could not be decoded.");
  await openWorkspaceTab(page, "Optimize");
  const customization = page.locator("[data-primary-customization]");
  await expect(customization).toHaveAttribute("aria-busy", "false");
  await expect(customization).toContainText("Discovery unavailable");
  await expect(customization).toContainText("Exact compatible-target discovery is unavailable");
  await expect(customization).not.toContainText("0 compatible");
  await expect(customization).not.toContainText("No exact same-recipe primary alternate");
  await expect(customization.locator("[data-primary-customization-target]")).toBeDisabled();
  await expect(customization.locator("[data-primary-customization-target] option")).toHaveCount(1);
});

test("ordinary Power target discovery settles to zero compatible targets after preview", async ({ page }) => {
  await startReferenceDesign(page, "Power");
  const preview = page.locator("[data-production-schematic-preview] img");
  await expect(preview).toBeVisible();
  await preview.evaluate(async (image) => {
    const previewImage = image as HTMLImageElement;
    if (!previewImage.complete) await previewImage.decode();
    if (previewImage.naturalWidth <= 0) throw new Error("Exact structural preview did not decode");
  });
  await openWorkspaceTab(page, "Optimize");
  const customization = page.locator("[data-primary-customization]");
  await expect(customization).toHaveAttribute("aria-busy", "false");
  await expect(customization).toContainText("0 compatible");
  await expect(customization).toContainText("No exact same-recipe primary alternate");
  await expect(customization.locator("[data-primary-customization-target]")).toBeDisabled();
  await expect(customization.locator("[data-primary-customization-target] option")).toHaveCount(1);
});

test("Motor primary-part customization remains an inert target-only projection across file and URL transfer", async ({ page }) => {
  test.setTimeout(120_000);
  await startReferenceDesign(page, "Motor");
  await openWorkspaceTab(page, "Optimize");
  const sourceResultHash = await ordinaryResultHash(page);
  const sourceCandidateId = await selectedCandidateId(page);
  const customization = page.locator("[data-primary-customization]");
  await expect(customization.getByRole("heading", { name: "Primary-part substitution" })).toBeVisible();
  const targetSelect = customization.locator("[data-primary-customization-target]");
  await expect(targetSelect).toBeEnabled();
  await expect(targetSelect.locator("option")).toHaveCount(2);
  const targetLabel = (await targetSelect.locator("option").nth(1).innerText()).trim();
  expect(targetLabel).not.toBe("Choose an exact admitted profile");

  await targetSelect.selectOption({ index: 1 });
  await expect(customization.locator("[data-primary-customization-signature]")).toContainText(targetLabel);
  await expect(customization).toContainText("target eligibility not yet evaluated");
  await expect(customization.locator("[data-primary-customization-result]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Evaluate substitution", exact: true })).toBeEnabled();
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);
  expect(await selectedCandidateId(page)).toBe(sourceCandidateId);

  const instructionDownload = await downloadInstruction(page);
  expect(instructionDownload.filename).toBe("schemagic-primary-customization-v1.json");
  const instruction = JSON.parse(instructionDownload.content) as {
    contentHash: string;
    sourceCandidateId: string;
    substitution: { targetProfile: { profileId: string; contentHash: string } };
  };
  expect(instruction.sourceCandidateId).toBe(sourceCandidateId);

  await page.locator("[data-primary-customization-file]").setInputFiles({
    name: instructionDownload.filename,
    mimeType: "application/json",
    buffer: Buffer.from(instructionDownload.content),
  });
  await expect(page.getByText("Loaded an exact customization instruction. Evaluate substitution to regenerate and evaluate its target.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue(instruction.contentHash);
  await expect(page.locator("[data-primary-customization-result]")).toHaveCount(0);

  await page.locator("[data-primary-customization-file]").setInputFiles({
    name: "oversize-customization.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(PRIMARY_PART_CUSTOMIZATION_MAX_BYTES + 1, 0x20),
  });
  await expect(page.getByText("Primary-part customization exceeds the supported transfer limits.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue(instruction.contentHash);

  await page.getByRole("button", { name: "Evaluate substitution", exact: true }).click();
  const targetResult = page.locator("[data-primary-customization-result]");
  await expect(targetResult).toBeVisible();
  await expect(targetResult.getByRole("heading", { name: targetLabel, exact: true })).toBeFocused();
  await expect(targetResult.getByText("Ineligible", { exact: true })).toBeVisible();
  await expect(targetResult).toContainText("The ordinary generated result is unchanged.");
  await expect(targetResult).toContainText("not recomputed");
  await expect(targetResult).toContainText("not added");
  await expect(targetResult).toContainText("Installed V3 decision: ineligible.");
  await expect(targetResult).toContainText("These files describe only this exact target projection.");
  await expect(targetResult).toContainText("They add no authority to the ordinary result, ranking, eligibility, simulation samples, commercial decisions, release, or attestation.");
  await expect(targetResult).toContainText("The engineering report is for inspection only.");
  await expect(targetResult).toContainText("It adds no release, physical-fidelity, or commercial authority.");
  await expect(targetResult).toContainText("The KiCad schematic is structural only and its footprints stay empty.");
  await expect(targetResult).toContainText("Opening it in external KiCad remains UNVERIFIED; it carries no KiCad or release attestation.");
  await expect(targetResult).toContainText("Scenario SPICE is the exact default behavioral input and is available only with zero omissions.");
  await expect(targetResult).toContainText("It adds no selected-part model, samples, physical fidelity, ranking, or eligibility authority.");
  await expect(targetResult.locator("[data-production-export]")).toHaveCount(0);
  const targetArtifactActions = targetResult.locator("[data-customized-target-export]");
  await expect(targetArtifactActions).toHaveCount(5);
  await expect(targetResult.getByRole("button")).toHaveCount(6);
  await expect(targetResult.locator('[data-customized-target-export="customized_target_electrical_bom_csv"]')).toHaveAccessibleName("Download electrical BOM inspection CSV");
  await expect(targetResult.locator('[data-customized-target-export="customized_target_structural_svg"]')).toHaveAccessibleName("Download structural schematic inspection SVG");
  await expect(targetResult.locator('[data-customized-target-export="customized_target_engineering_report_html"]')).toHaveAccessibleName("Download target engineering report HTML");
  await expect(targetResult.locator('[data-customized-target-export="customized_target_structural_kicad"]')).toHaveAccessibleName("Download target structural KiCad schematic");
  await expect(targetResult.locator('[data-customized-target-export="customized_target_behavioral_scenario_spice"]')).toHaveAccessibleName("Download target behavioral Scenario SPICE");
  await expect(targetResult.locator("[data-customized-target-receipt-export]")).toHaveAccessibleName("Download inspection receipt JSON");
  await expect(customization.locator("[data-customized-target-receipt-import]")).toHaveAccessibleName("Verify inspection receipt JSON");
  for (const forbiddenName of ["Simulator", "Simulation CSV", "Commercial BOM", "Create share URL"]) {
    await expect(targetResult.getByRole("button", { name: forbiddenName, exact: true })).toHaveCount(0);
  }
  const targetResultHash = await targetResult.locator(":scope > code").innerText();
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);
  expect(await selectedCandidateId(page)).toBe(sourceCandidateId);

  const bomDownloadEvent = page.waitForEvent("download");
  const exportStartFocus = await page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-customized-target-export="customized_target_electrical_bom_csv"]',
    );
    if (trigger === null) throw new Error("Customized-target BOM trigger is absent");
    trigger.click();
    return {
      ariaBusy: document.querySelector("[data-primary-customization]")?.getAttribute("aria-busy"),
      activeElementId: document.activeElement?.id,
      activeElementTag: document.activeElement?.tagName,
      bodyFocused: document.activeElement === document.body,
      exportActionCount: document.querySelectorAll("[data-customized-target-export]").length,
      everyExportActionDisabled: [...document.querySelectorAll<HTMLButtonElement>("[data-customized-target-export]")]
        .every((button) => button.disabled),
      receiptActionDisabled: document.querySelector<HTMLButtonElement>("[data-customized-target-receipt-export]")?.disabled,
    };
  });
  expect(exportStartFocus).toEqual({
    ariaBusy: "true",
    activeElementId: "designer-customization-result-title",
    activeElementTag: "H3",
    bodyFocused: false,
    exportActionCount: 5,
    everyExportActionDisabled: true,
    receiptActionDisabled: true,
  });
  const bomDownload = await bomDownloadEvent;
  const bomPath = await bomDownload.path();
  if (!bomPath) throw new Error("Playwright did not retain the delayed customized-target BOM download");
  const bomArtifact = {
    filename: bomDownload.suggestedFilename(),
    content: readFileSync(bomPath, "utf8"),
  };
  expect(bomArtifact.filename).toMatch(/^schemagic-motor-brushed-dc-.+-customized-target-electrical-bom\.csv$/u);
  for (const identity of [sourceResultHash, instruction.contentHash, instruction.substitution.targetProfile.contentHash, targetResultHash]) {
    expect(bomArtifact.content).toContain(identity);
  }
  expect(bomArtifact.content).toContain("customized_target_electrical_bom_csv");
  expect(bomArtifact.content).toContain("inspection_only");
  expect(bomArtifact.content).toContain("inspection_only,ineligible,");
  await expect(page.getByText("Customized-target electrical BOM inspection CSV downloaded. The ordinary result and installed V3 decision are unchanged.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-customized-target-export="customized_target_electrical_bom_csv"]')).toBeFocused();

  const svgArtifact = await downloadCustomizedTargetArtifact(page, "customized_target_structural_svg");
  expect(svgArtifact.filename).toMatch(/^schemagic-motor-brushed-dc-.+-customized-target-structural-schematic\.svg$/u);
  for (const identity of [sourceResultHash, instruction.contentHash, instruction.substitution.targetProfile.contentHash, targetResultHash]) {
    expect(svgArtifact.content).toContain(identity);
  }
  expect(svgArtifact.content).toContain("customized_target_structural_svg");
  expect(svgArtifact.content).toContain("inspection_only");
  expect(svgArtifact.content).toContain("Recorded evaluated-policy state: ineligible");
  await expect(page.getByText("Customized-target structural schematic inspection SVG downloaded. The ordinary result and installed V3 decision are unchanged.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-customized-target-export="customized_target_structural_svg"]')).toBeFocused();

  const reportArtifact = await downloadCustomizedTargetArtifact(
    page,
    "customized_target_engineering_report_html",
  );
  expect(reportArtifact.filename).toMatch(/^schemagic-motor-brushed-dc-.+-customized-target-engineering-report\.html$/u);
  expect(reportArtifact.content).toContain("<!doctype html>");
  expect(reportArtifact.content).toContain("scheMAGIC customized-target engineering report");
  expect(reportArtifact.content).toContain("TARGET ONLY · INSPECTION ONLY");
  expect(reportArtifact.content).toContain("Customized-target authority boundary");
  expect(reportArtifact.content).not.toContain("schemagic-printable-report-metadata-v2");
  await expect(page.getByText("Customized-target engineering report HTML downloaded. It remains target-only inspection output with no release authority.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-customized-target-export="customized_target_engineering_report_html"]')).toBeFocused();

  const kicadArtifact = await downloadCustomizedTargetArtifact(
    page,
    "customized_target_structural_kicad",
  );
  expect(kicadArtifact.filename).toMatch(/^schemagic-motor-brushed-dc-.+-customized-target-structural\.kicad_sch$/u);
  expect(kicadArtifact.content).toContain("(kicad_sch");
  expect(kicadArtifact.content).toContain("CUSTOMIZED TARGET - INSPECTION ONLY");
  expect(kicadArtifact.content).toContain('"Footprint" ""');
  expect(kicadArtifact.content).toContain("external KiCad open verification UNVERIFIED");
  expect(kicadArtifact.content).not.toContain("scheMAGIC Metadata V2");
  await expect(page.getByText("Customized-target structural KiCad schematic downloaded. Footprints and external-open attestation remain unavailable.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-customized-target-export="customized_target_structural_kicad"]')).toBeFocused();

  const spiceArtifact = await downloadCustomizedTargetArtifact(
    page,
    "customized_target_behavioral_scenario_spice",
  );
  expect(spiceArtifact.filename).toMatch(/^schemagic-motor-brushed-dc-.+-customized-target-[A-Za-z0-9._-]+-behavioral\.cir$/u);
  expect(spiceArtifact.content).toContain("coverage-tier behavioral");
  expect(spiceArtifact.content).toContain("customized_target_behavioral_scenario_spice");
  expect(spiceArtifact.content).toContain("omissionCount");
  expect(spiceArtifact.content).toContain(":0");
  expect(spiceArtifact.content).toContain("scenarioHash");
  expect(spiceArtifact.content).toContain("serializationHash");
  expect(spiceArtifact.content).toContain("netlistContentHash");
  expect(spiceArtifact.content).not.toContain("INCOMPLETE-MODE");
  expect(spiceArtifact.content).not.toContain("* omission ");
  await expect(page.getByText("Customized-target behavioral Scenario SPICE downloaded. It is zero-omission scenario input, not selected-part simulation evidence.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-customized-target-export="customized_target_behavioral_scenario_spice"]')).toBeFocused();

  const receiptArtifact = await downloadCustomizedTargetInspectionReceipt(page);
  expect(receiptArtifact.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-customized-target-inspection-receipt-v1\.json$/u);
  const receipt = JSON.parse(receiptArtifact.content) as {
    format: string;
    schemaVersion: number;
    contentHash: string;
    customizedResult: { contentHash: string; instruction: { contentHash: string } };
    artifacts: Array<{ kind: string; utf8ByteLength: number; utf8Sha256: string }>;
    claimBoundary: Record<string, string>;
  };
  expect(receipt).toMatchObject({
    format: "schemagic-customized-target-inspection-receipt",
    schemaVersion: 1,
    customizedResult: {
      contentHash: targetResultHash,
      instruction: { contentHash: instruction.contentHash },
    },
    claimBoundary: {
      purpose: "inspection_only",
      artifactReplay: "required",
      parseAndSelfHash: "integrity_only",
      installedContextAuthority: "not_conferred",
      ordinaryResultEvidence: "not_evidence",
      eligibilityEvidence: "not_evidence",
      rankingEvidence: "not_evidence",
      simulationData: "not_included",
      commercialAuthority: "not_added",
      attestation: "none",
    },
  });
  expect(receipt.artifacts.map((artifact) => artifact.kind)).toEqual([
    "customized_target_electrical_bom_csv",
    "customized_target_structural_svg",
  ]);
  expect(receipt.artifacts.every((artifact) => (
    artifact.utf8ByteLength > 0 && /^sha256:[0-9a-f]{64}$/u.test(artifact.utf8Sha256)
  ))).toBe(true);
  const parsedReceipt = parseCustomizedTargetInspectionReceiptV1Text(receiptArtifact.content);
  const artifactRuntimeUrl = await page.evaluate(() => (
    performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => /\/assets\/PrimaryPartCustomizedArtifactRuntime-[A-Za-z0-9_-]+\.js$/u.test(name))
  ));
  if (artifactRuntimeUrl === undefined) {
    throw new Error("The guarded customized-target artifact runtime was not loaded lazily");
  }
  const directImportProbe = await page.evaluate(async ({ runtimeUrl, receiptContent }) => {
    const runtime = await import(runtimeUrl) as Record<string, unknown>;
    const verifyReceipt = runtime.verifyCustomizedTargetInspectionReceiptBytesV1;
    const exportFile = runtime.exportAuthorizedPrimaryPartCustomizedFileV1;
    if (typeof verifyReceipt !== "function" || typeof exportFile !== "function") {
      throw new Error("The guarded customized-target runtime surface is incomplete");
    }
    const verified = (verifyReceipt as (bytes: Uint8Array) => {
      contentHash: string;
      customizedResult: unknown;
    })(new TextEncoder().encode(receiptContent));
    let unauthorizedError = "";
    try {
      (exportFile as (token: unknown) => unknown)(verified.customizedResult);
    } catch (error) {
      unauthorizedError = error instanceof Error ? error.message : String(error);
    }
    return {
      exports: Object.keys(runtime).sort(),
      receiptContentHash: verified.contentHash,
      unauthorizedError,
    };
  }, { runtimeUrl: artifactRuntimeUrl, receiptContent: receiptArtifact.content });
  expect(directImportProbe).toEqual({
    exports: [
      "exportAuthorizedPrimaryPartCustomizedFileV1",
      "verifyCustomizedTargetInspectionReceiptBytesV1",
    ],
    receiptContentHash: parsedReceipt.contentHash,
    unauthorizedError: "Customized-target file export requires an exact application authorization token",
  });
  const exactCustomizedResult = parsedReceipt.customizedResult;
  const exactTargetCandidate = exactCustomizedResult.targetResultProjection.candidates[0]!;
  const exactDefaultScenarioId = exactTargetCandidate.circuit.defaultScenarioId;
  expect(exactDefaultScenarioId).not.toBeNull();
  const exactDefaultScenario = exactTargetCandidate.circuit.scenarios.find(
    (scenario) => scenario.id === exactDefaultScenarioId,
  );
  expect(exactDefaultScenario).toBeDefined();
  const sharedProvenance = [
    exactCustomizedResult.source.resultContentHash,
    exactCustomizedResult.source.executionReportContentHash,
    exactCustomizedResult.source.candidateId,
    exactCustomizedResult.contentHash,
    exactCustomizedResult.instruction.contentHash,
    exactCustomizedResult.instruction.requestHash,
    exactCustomizedResult.instruction.requestByteContentHash,
    exactCustomizedResult.targetResultProjection.contentHash,
    exactCustomizedResult.constraintDecision.contentHash,
    exactCustomizedResult.contextManifestContentHash,
    exactCustomizedResult.instruction.context.catalog.contentHash,
    exactCustomizedResult.instruction.context.catalog.sourceReleaseContentHash,
    exactCustomizedResult.instruction.context.recipe.id,
    exactCustomizedResult.instruction.context.recipe.contentHash,
    exactCustomizedResult.instruction.context.constraintPolicy.contentHash,
    exactCustomizedResult.instruction.substitution.targetProfile.contentHash,
    exactTargetCandidate.id,
    exactTargetCandidate.circuit.defaultCircuitId,
  ];
  for (const artifact of [bomArtifact, svgArtifact, reportArtifact, kicadArtifact, spiceArtifact]) {
    for (const identity of sharedProvenance) expect(artifact.content).toContain(identity);
    for (const marker of [
      "schemagic-primary-part-customized-artifact-metadata",
      "constraintDecisionContentHash",
      "eligible",
      "sourceWarnings",
    ]) expect(artifact.content).toContain(marker);
  }
  for (const artifact of [reportArtifact, kicadArtifact, spiceArtifact]) {
    expect(artifact.content).toContain("customized_target_only");
    expect(artifact.content).toContain("exact_reasserted");
    expect(artifact.content).toContain("not_bypassed");
  }
  expect(spiceArtifact.content).toContain(exactDefaultScenarioId!);
  expect(spiceArtifact.content).toContain(exactDefaultScenario!.circuitId);
  expect(spiceArtifact.content).toContain(exactDefaultScenario!.config.mode);
  await expect(page.getByText("Customized-target inspection receipt downloaded. It binds the exact BOM/SVG payloads by descriptor; the payloads are not included, and it confers no installed-context or production authority.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-customized-target-receipt-export]")).toBeFocused();

  await page.evaluate(() => {
    const testWindow = window as Window & { __oversizeReceiptArrayBufferCalls?: number };
    const nativeArrayBuffer = File.prototype.arrayBuffer;
    testWindow.__oversizeReceiptArrayBufferCalls = 0;
    File.prototype.arrayBuffer = function guardedReceiptArrayBuffer(): Promise<ArrayBuffer> {
      if (this.name === "oversize-inspection-receipt.json") {
        testWindow.__oversizeReceiptArrayBufferCalls! += 1;
      }
      return nativeArrayBuffer.call(this);
    };
  });
  await page.locator("[data-customized-target-receipt-file]").setInputFiles({
    name: "oversize-inspection-receipt.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 + 1, 0x20),
  });
  await expect(page.getByText(
    "Customized-target inspection receipt exceeds the supported transfer limits.",
    { exact: true },
  )).toBeVisible();
  expect(await page.evaluate(() => (
    (window as Window & { __oversizeReceiptArrayBufferCalls?: number })
      .__oversizeReceiptArrayBufferCalls
  ))).toBe(0);
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue(instruction.contentHash);
  expect(await targetResult.locator(":scope > code").innerText()).toBe(targetResultHash);

  const mismatchedReceipt = receiptWithMismatchedInstruction(receiptArtifact.content);
  await page.locator("[data-customized-target-receipt-file]").setInputFiles({
    name: "active-instruction-mismatch-inspection-receipt.json",
    mimeType: "application/json",
    buffer: Buffer.from(mismatchedReceipt),
  });
  await expect(page.getByText(
    /scheMAGIC primary-part customization evaluation failed \(profile_mismatch\)/u,
  )).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue(instruction.contentHash);
  await expect(targetResult).toBeVisible();
  expect(await targetResult.locator(":scope > code").innerText()).toBe(targetResultHash);
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);

  await page.locator("[data-customized-target-receipt-file]").setInputFiles({
    name: "tampered-inspection-receipt.json",
    mimeType: "application/json",
    buffer: Buffer.from(`${receiptArtifact.content}\n`),
  });
  await expect(page.getByText(/scheMAGIC customized-target inspection receipt was rejected/u)).toBeVisible();
  await expect(targetResult).toBeVisible();
  expect(await targetResult.locator(":scope > code").innerText()).toBe(targetResultHash);
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);

  await page.getByRole("button", { name: "Reset to generated part", exact: true }).click();
  await expect(page.locator("[data-primary-customization-result]")).toHaveCount(0);
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue("");
  await page.locator("[data-customized-target-receipt-file]").setInputFiles({
    name: receiptArtifact.filename,
    mimeType: "application/json",
    buffer: Buffer.from(receiptArtifact.content),
  });
  await expect(page.getByText("Inspection receipt replayed exactly and the target was re-evaluated as ineligible under the installed V3 policy. The ordinary result remains unchanged.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue(instruction.contentHash);
  await expect(page.locator("[data-primary-customization-result]")).toBeVisible();
  expect(await page.locator("[data-primary-customization-result] > code").innerText()).toBe(targetResultHash);
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);
  expect(await selectedCandidateId(page)).toBe(sourceCandidateId);

  await page.getByRole("button", { name: "Create request + instruction URL", exact: true }).click();
  const shareUrl = page.url();
  const shareHash = new URL(shareUrl).hash;
  expect(shareHash).toMatch(/^#r=[A-Za-z0-9_-]+&c=[A-Za-z0-9_-]+$/u);
  expect(shareHash).not.toContain("d=");
  await page.reload();

  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByText("Restored exact requirements plus an inert customization instruction. Review them and explicitly regenerate the source before target policy evaluation.", { exact: true })).toBeVisible();
  await expect(page.getByText("Customization instruction loaded", { exact: true })).toBeVisible();
  await expect(page.getByText(instruction.substitution.targetProfile.profileId, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toHaveCount(0);
  await expect(page.locator("[data-primary-customization-result]")).toHaveCount(0);
  await expect(page.locator("[data-customized-target-export]")).toHaveCount(0);
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe(shareHash);

  const regenerate = page.getByRole("button", { name: "Regenerate source + evaluate substitution", exact: true });
  await expect(regenerate).toBeEnabled();
  await regenerate.click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Exact source and target regenerated; the target is ineligible under the installed V3 policy. Ordinary ranking and ordinary-result exports remain unchanged.", { exact: true })).toBeVisible();
  await openWorkspaceTab(page, "Optimize");
  const restoredTargetResult = page.locator("[data-primary-customization-result]");
  await expect(restoredTargetResult).toBeVisible();
  await expect(restoredTargetResult.getByRole("heading", { name: targetLabel, exact: true })).toBeVisible();
  await expect(restoredTargetResult.locator("[data-customized-target-export]")).toHaveCount(5);
  expect(await restoredTargetResult.locator(":scope > code").innerText()).toBe(targetResultHash);
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);
  expect(await selectedCandidateId(page)).toBe(sourceCandidateId);

  const pinned = page.locator("[data-imported-pin]").first();
  await pinned.check();
  const pinnedComparison = page.getByRole("region", { name: "Pinned comparison" });
  await expect(pinnedComparison).toBeVisible();
  await page.getByRole("button", { name: "Evidence & caveats", exact: true }).first().click();
  const caveatDialog = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(caveatDialog).toBeVisible();
  await expect(caveatDialog.locator("[data-pinned-comparison]")).toHaveCount(0);
  await expect(pinnedComparison).toBeVisible();
  await caveatDialog.getByRole("button", { name: "Close evidence and caveats" }).click();
  await openWorkspaceTab(page, "Operating results");
  const selectedPartScenario = page.locator('[data-imported-scenario="selected_part_model"]');
  await selectedPartScenario.click();
  await expect(selectedPartScenario).toHaveAttribute("aria-pressed", "true");
  const reset = page.getByRole("button", { name: "Reset to generated part", exact: true });
  await page.evaluate(() => {
    const browserWindow = window as Window & { __customizedTargetDownloads?: string[] };
    browserWindow.__customizedTargetDownloads = [];
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function instrumentedDownload(): void {
      browserWindow.__customizedTargetDownloads!.push(this.download);
    };
    document.querySelector<HTMLButtonElement>('[data-customized-target-export="customized_target_structural_svg"]')?.click();
    document.querySelector<HTMLButtonElement>("[data-primary-customization-reset]")?.click();
    window.setTimeout(() => {
      HTMLAnchorElement.prototype.click = nativeClick;
    }, 5_000);
  });

  const resetHash = new URL(page.url()).hash;
  expect(resetHash).toMatch(/^#r=[A-Za-z0-9_-]+$/u);
  expect(resetHash).not.toContain("c=");
  await expect(page.getByText("Reset to the ordinary generated primary part. The generated result, ranking, pins, and scenario selection are unchanged.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-primary-customization-result]")).toHaveCount(0);
  await expect(page.locator("[data-customized-target-export]")).toHaveCount(0);
  await expect(page.locator("[data-primary-customization-target]")).toHaveValue("");
  await page.waitForTimeout(1_000);
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __customizedTargetDownloads?: string[] }).__customizedTargetDownloads ?? []
  ))).toEqual([]);
  expect(await ordinaryResultHash(page)).toBe(sourceResultHash);
  expect(await selectedCandidateId(page)).toBe(sourceCandidateId);
  await expect(page.locator("[data-imported-pin]").first()).toBeChecked();
  await page.getByRole("button", { name: "Evidence & caveats", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Evidence & caveats" }).locator("[data-pinned-comparison]")).toHaveCount(0);
  await expect(pinnedComparison).toBeVisible();
  await page.getByRole("dialog", { name: "Evidence & caveats" })
    .getByRole("button", { name: "Close evidence and caveats" }).click();
  await expect(page.locator('[data-imported-scenario="selected_part_model"]')).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => {
    const testWindow = window as Window & {
      __delayedReceiptReadStarted?: boolean;
      __releaseDelayedReceiptRead?: () => void;
    };
    const nativeArrayBuffer = File.prototype.arrayBuffer;
    testWindow.__delayedReceiptReadStarted = false;
    File.prototype.arrayBuffer = function delayedReceiptArrayBuffer(): Promise<ArrayBuffer> {
      if (this.name !== "delayed-inspection-receipt.json") return nativeArrayBuffer.call(this);
      testWindow.__delayedReceiptReadStarted = true;
      return new Promise<ArrayBuffer>((resolve, reject) => {
        testWindow.__releaseDelayedReceiptRead = () => {
          nativeArrayBuffer.call(this).then(resolve, reject);
        };
      });
    };
  });
  await page.locator("[data-customized-target-receipt-file]").setInputFiles({
    name: "delayed-inspection-receipt.json",
    mimeType: "application/json",
    buffer: Buffer.from(receiptArtifact.content),
  });
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __delayedReceiptReadStarted?: boolean }).__delayedReceiptReadStarted
  ))).toBe(true);
  await expect(page.locator("[data-primary-customization]")).toHaveAttribute("aria-busy", "true");
  await page.getByRole("button", { name: "← Edit requirements", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await page.evaluate(() => {
    const testWindow = window as Window & { __releaseDelayedReceiptRead?: () => void };
    testWindow.__releaseDelayedReceiptRead?.();
  });
  await page.waitForTimeout(100);
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByText(/Inspection receipt replayed exactly/u)).toHaveCount(0);
  await expect(page.locator("[data-primary-customization-result]")).toHaveCount(0);
});
