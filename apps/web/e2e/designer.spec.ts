import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { parseDesignResultV2, parseElectricalDesignRequestV2 } from "@opencircuit/design-schema";
import type { PowerPhysicalImplementationHandoffV2 } from "@opencircuit/design-export/power-physical-implementation-handoff-v2";
import { MOTOR_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/motor-designer/v2-status";
import { POWER_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/power-designer/v2-status";
import {
  parseScenarioGatePlanV2,
  serializeScenarioGatePlanV2,
} from "../src/features/designer/ResultExport";
import {
  parseElectricalDesignRequestV2Text,
  serializeElectricalDesignRequestV2,
} from "../src/features/designer/RequestTransfer";

const M1_COMPACT_REQUEST = JSON.parse(readFileSync(
  new URL("../../../packages/design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
  "utf8",
)) as Record<string, unknown>;

function canonicalValue(value: unknown, omitDisplayUnits = false): unknown {
  if (typeof value === "number") return Number(value.toPrecision(12));
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, omitDisplayUnits));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
      if (omitDisplayUnits && key === "displayUnit") return [];
      const nested = (value as Record<string, unknown>)[key];
      return nested === undefined ? [] : [[key, canonicalValue(nested, omitDisplayUnits)]];
    }));
  }
  return value;
}

function canonicalJson(value: unknown, omitDisplayUnits = false): string {
  return JSON.stringify(canonicalValue(value, omitDisplayUnits));
}

function legacyCanonicalValue(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toPrecision(12));
  if (Array.isArray(value)) return value.map(legacyCanonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort((left, right) => left.localeCompare(right)).flatMap((key) => {
      const nested = (value as Record<string, unknown>)[key];
      return nested === undefined ? [] : [[key, legacyCanonicalValue(nested)]];
    }));
  }
  return value;
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function migrateRequestV2(): Record<string, unknown> {
  const { sourcing: _sourcing, ...request } = structuredClone(M1_COMPACT_REQUEST);
  request.schemaVersion = 2;
  request.libraryVersion = "motor-library-v2";
  const sortStrings = (values: unknown): string[] => [...(values as string[])].sort();
  const constraints = request.constraints as Record<string, unknown>;
  constraints.allowedTopologyFamilies = sortStrings(constraints.allowedTopologyFamilies);
  constraints.allowedPackages = sortStrings(constraints.allowedPackages);
  const requirements = request.requirements as Record<string, unknown>;
  requirements.operatingModes = sortStrings(requirements.operatingModes);
  const assumptions = request.assumptions as Array<Record<string, unknown>>;
  for (const assumption of assumptions) assumption.affects = sortStrings(assumption.affects);
  assumptions.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return request;
}

function emptyV2Result(): Record<string, unknown> {
  const request = migrateRequestV2();
  const payload: Record<string, unknown> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request,
    requestHash: sha256(canonicalJson(request, true)),
    libraryVersion: request.libraryVersion,
    libraryContentHash: `sha256:${"a".repeat(64)}`,
    candidates: [],
    rejectedCandidates: [],
    diagnostics: ["design.no_supported_recipe"],
  };
  return { ...payload, contentHash: sha256(canonicalJson(payload)) };
}

function scenarioV2Result(): Record<string, unknown> {
  const empty = emptyV2Result();
  const { contentHash: _contentHash, ...payload } = empty;
  const candidate = {
    schemaVersion: 2,
    id: `candidate:v2:sha256:${"c".repeat(64)}`,
    requestHash: payload.requestHash,
    recipeId: "fixture.scenario-inspection",
    libraryVersion: payload.libraryVersion,
    components: [],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [
      { scenarioId: "op", modelTier: "behavioral", limitations: ["Behavioral operating point only"] },
      { scenarioId: "startup", modelTier: "unavailable", limitations: ["No startup graph is authored"] },
    ],
    circuit: {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Scenario inspection fixture" },
      designBlocks: [],
      circuits: [{
        id: "main",
        title: "Behavioral operating-point graph",
        components: [{ id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    },
    circuitInstanceClassifications: [{ circuitId: "main", componentId: "ground", kind: "non_bom", reason: "Ground is not a BOM line" }],
    circuitBomNonRepresentations: [],
    warnings: [],
  };
  const withCandidate = { ...payload, candidates: [candidate], diagnostics: [] };
  return { ...withCandidate, contentHash: sha256(canonicalJson(withCandidate)) };
}

function legacyV1Result(): Record<string, unknown> {
  const requestHash = fnv1a64(canonicalJson(M1_COMPACT_REQUEST));
  return {
    format: "schemagic-design-result",
    schemaVersion: 1,
    request: structuredClone(M1_COMPACT_REQUEST),
    requestHash,
    libraryVersion: M1_COMPACT_REQUEST.libraryVersion,
    libraryContentHash: "legacy-e2e-audit-only",
    candidates: [{
      schemaVersion: 1,
      id: "candidate:legacy-e2e",
      requestHash,
      recipeId: "legacy.audit.fixture",
      libraryVersion: M1_COMPACT_REQUEST.libraryVersion,
      components: [],
      derivedValues: [],
      constraints: [],
      metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
      simulationCoverage: [],
      circuit: {
        format: "opencircuit-circuit",
        version: 1,
        meta: { title: "Legacy audit fixture" },
        components: [{ id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
        wires: [],
        probes: [],
        sim: { mode: "op" },
      },
      warnings: [],
    }],
    rejectedCandidates: [],
    diagnostics: [],
  };
}

function serializeV1(result: Record<string, unknown>): string {
  return `${JSON.stringify(legacyCanonicalValue(result), null, 2)}\n`;
}

function serializeV2(result: Record<string, unknown>): string {
  return canonicalJson(result);
}

async function downloadText(page: Page, label: string): Promise<{ filename: string; content: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error(`Playwright did not retain the ${label} download`);
  return { filename: download.suggestedFilename(), content: readFileSync(path, "utf8") };
}

async function expectUntrustedRequirementsOnly(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Generated design result" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toHaveCount(0);
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
  await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  await expect(page.locator("[data-production-export]")).toHaveCount(0);
  await expect(page.locator("[data-imported-scenario]")).toHaveCount(0);
  await expect(page.locator("[data-lcsc-search]")).toHaveCount(0);
}

async function openWorkspaceTab(page: Page, name: "Schematic" | "Operating results" | "BOM / parts" | "Optimize" | "Export"): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

async function openEvidenceCaveats(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Evidence & caveats", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Evidence & caveats" })).toBeVisible();
}

async function closeEvidenceCaveats(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Close evidence and caveats", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Evidence & caveats" })).not.toBeVisible();
}

async function productionPreviewText(page: Page): Promise<string> {
  const image = page.locator("[data-production-schematic-preview] img");
  await expect(image).toBeVisible();
  return image.evaluate(async (element) => {
    const response = await fetch((element as HTMLImageElement).src);
    return response.text();
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("schemagic.onboarding.v1.completed", "1"));
  await page.goto("/?designer");
  await expect(page.getByRole("heading", { name: "Start a new design" })).toBeVisible();
});

test("Motor requirements transfer preserves canonical values and units without transferring trust", async ({ page }) => {
  await page.locator('[data-application="motor.brushed-dc"]')
    .getByRole("button", { name: "Start Motor design" }).click();
  await page.getByLabel("Unit for Pwm Frequency").selectOption("kHz");
  await page.getByLabel("Pwm Frequency", { exact: true }).fill("25");
  await page.getByLabel("Pwm Frequency", { exact: true }).press("Tab");
  await expect(page.getByLabel("Reference design")).toBeChecked();

  const exported = await downloadText(page, "Download requirements JSON");
  expect(exported.filename).toBe("schemagic-electrical-request-v2.json");
  const transferred = parseElectricalDesignRequestV2Text(exported.content);
  if (transferred.request.application !== "motor.brushed-dc") throw new Error("Expected Motor requirements");
  expect(transferred.request.requirements.pwmFrequency).toEqual({ value: 25_000, unit: "Hz", displayUnit: "kHz" });
  expect(transferred.request.constraints.allowUnknownHardConstraints).toBe(true);

  await page.getByRole("button", { name: "Create requirements share URL" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#r=")).toBe(true);
  expect(new URL(page.url()).hash).not.toContain("d=");
  await page.reload();
  await expectUntrustedRequirementsOnly(page);
  await expect(page.getByLabel("Starting point")).toHaveValue("");
  await expect(page.getByRole("option", { name: "Transferred requirements" })).toHaveAttribute("disabled", "");
  await expect(page.getByLabel("Pwm Frequency", { exact: true })).toHaveValue("25");
  await expect(page.getByLabel("Unit for Pwm Frequency")).toHaveValue("kHz");

  await page.getByLabel("Pwm Frequency", { exact: true }).fill("26");
  await page.getByLabel("Pwm Frequency", { exact: true }).press("Tab");
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await page.getByRole("button", { name: "Create requirements share URL" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#r=")).toBe(true);
  await page.getByLabel("Starting point").selectOption("motor.integrated-12v");
  await expect.poll(() => new URL(page.url()).hash).toBe("");

  await page.getByRole("button", { name: "← Applications" }).click();
  await page.locator("[data-designer-request-file]").setInputFiles({
    name: exported.filename,
    mimeType: "application/json",
    buffer: Buffer.from(exported.content),
  });
  await expectUntrustedRequirementsOnly(page);
  await expect(page.getByLabel("Starting point")).toHaveValue("");
  await expect(page.getByLabel("Pwm Frequency", { exact: true })).toHaveValue("25");
  await expect(page.getByLabel("Unit for Pwm Frequency")).toHaveValue("kHz");
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await openEvidenceCaveats(page);
  await expect(page.getByRole("dialog", { name: "Evidence & caveats" }).locator("[data-production-constraint-policy]"))
    .toContainText("0 eligible");
  await closeEvidenceCaveats(page);
});

test("Power requirements transfer preserves canonical values and requires explicit generation", async ({ page }) => {
  await page.locator('[data-application="power.buck"]')
    .getByRole("button", { name: "Start Power design" }).click();
  await page.getByLabel("Unit for Maximum Output Current").selectOption("mA");
  await page.getByLabel("Maximum Output Current", { exact: true }).fill("250");
  await page.getByLabel("Maximum Output Current", { exact: true }).press("Tab");
  await expect(page.getByLabel("Reference design")).toBeChecked();

  const exported = await downloadText(page, "Download requirements JSON");
  const transferred = parseElectricalDesignRequestV2Text(exported.content);
  if (transferred.request.application !== "power.buck") throw new Error("Expected Power requirements");
  expect(transferred.request.requirements.maximumOutputCurrent).toEqual({ value: 0.25, unit: "A", displayUnit: "mA" });
  expect(transferred.request.constraints.allowUnknownHardConstraints).toBe(true);

  await page.getByRole("button", { name: "Create requirements share URL" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#r=")).toBe(true);
  await page.reload();
  await expectUntrustedRequirementsOnly(page);
  await expect(page.getByLabel("Starting point")).toHaveValue("");
  await expect(page.getByLabel("Maximum Output Current", { exact: true })).toHaveValue("250");
  await expect(page.getByLabel("Unit for Maximum Output Current")).toHaveValue("mA");

  await page.getByRole("button", { name: "← Applications" }).click();
  await page.locator("[data-designer-request-file]").setInputFiles({
    name: exported.filename,
    mimeType: "application/json",
    buffer: Buffer.from(exported.content),
  });
  await expectUntrustedRequirementsOnly(page);
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await openEvidenceCaveats(page);
  await expect(page.getByRole("dialog", { name: "Evidence & caveats" }).locator("[data-production-constraint-policy]"))
    .toContainText("0 eligible");
  await closeEvidenceCaveats(page);
});

test("a stale transferred library version is preserved and rejected by normal generation", async ({ page }) => {
  const request = structuredClone(parseElectricalDesignRequestV2(migrateRequestV2()));
  request.libraryVersion = "stale-motor-library-v2";
  const source = serializeElectricalDesignRequestV2(request);
  await page.locator("[data-designer-request-file]").setInputFiles({
    name: "stale-request.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });

  await expectUntrustedRequirementsOnly(page);
  await expect(page.getByLabel("Starting point")).toHaveValue("");
  expect((await downloadText(page, "Download requirements JSON")).content).toBe(source);
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Requirements status" }))
    .toContainText("scheMAGIC Designer V2 generation failed");
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toHaveCount(0);
});

test("Motor runs from requirements through deterministic inspection, JSON export, and share", async ({ page }) => {
  const motorLCSCRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://www.lcsc.com/")) motorLCSCRequests.push(request.url());
  });
  const motorCard = page.locator('[data-application="motor.brushed-dc"]');
  await expect(motorCard.getByText("2 starting points", { exact: true })).toBeVisible();
  await expect(motorCard.getByText(String(MOTOR_DESIGN_V2_PRODUCTION_STATUS.reviewedProfileCount), { exact: true })).toBeVisible();
  await motorCard.getByText("Capability details", { exact: true }).click();
  await expect(motorCard.getByText("generation_context_contract_satisfied", { exact: true })).toBeVisible();

  const powerCard = page.locator('[data-application="power.buck"]');
  await expect(powerCard.getByText("1 starting point", { exact: true })).toBeVisible();
  await expect(powerCard.getByText(String(POWER_DESIGN_V2_PRODUCTION_STATUS.reviewedProfileCount), { exact: true })).toBeVisible();
  await powerCard.getByText("Capability details", { exact: true }).click();
  await expect(powerCard.getByText("generation_context_contract_satisfied", { exact: true })).toBeVisible();
  await expect(powerCard.getByRole("button", { name: "Start Power design" })).toBeEnabled();

  await motorCard.getByRole("button", { name: "Start Motor design" }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  const referenceMode = page.getByLabel("Reference design");
  const strictMode = page.getByLabel("Strict evidence gate");
  await expect(referenceMode).toBeChecked();
  await strictMode.check();
  await page.getByRole("button", { name: "Generate design" }).click();

  await expect(page.getByRole("heading", { name: "Generated design result" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "No retained candidate" })).toBeVisible();
  const strictEmpty = page.locator(".designer-empty-results");
  await expect(strictEmpty.locator(":scope > p")).toHaveText("Strict results are still in progress. Inspect an evidence-limited reference solution; unknown remains unknown.");
  await expect(strictEmpty.locator("button:enabled, a[href]")).toHaveCount(1);
  await page.getByRole("button", { name: "← Edit requirements" }).click();
  await referenceMode.check();
  await page.getByRole("button", { name: "Generate design" }).click();

  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".designer-trust-banner")
    .getByText("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION", { exact: true })).toBeHidden();
  await expect(page.getByText("STRUCTURAL OBSERVATION ORDER · INSTALLED V3 POLICY", { exact: true })).toBeHidden();
  const solutionTools = page.locator(".designer-solution-tools");
  await expect(solutionTools).toHaveAttribute("open", "");
  const solutionFilter = page.getByLabel("Filter solutions");
  await solutionFilter.selectOption("eligible");
  await expect(page.locator("[data-designer-solution-row]").first()).toBeHidden();
  await expect(page.locator("[data-designer-solution-visible-count]")).toHaveText("0 shown");
  const solutionAnnouncement = page.locator("[data-designer-solution-announcement]");
  await expect(solutionAnnouncement).toHaveAttribute("role", "status");
  await expect(solutionAnnouncement).toHaveAttribute("aria-live", "polite");
  await expect(solutionAnnouncement).toHaveText("0 of 1 solutions shown. Eligible filter.");
  await solutionFilter.selectOption("all");
  await expect(page.locator("[data-designer-solution-row]").first()).toBeVisible();
  await expect(solutionAnnouncement).toHaveText("1 of 1 solutions shown. All solutions filter.");
  await expect(page.locator(".designer-workspace-selection-status")).toBeVisible();
  await expect(page.locator(".designer-workspace-selection-status")).toHaveAttribute("role", "status");
  await expect(page.locator(".designer-workspace-selection-status"))
    .toHaveAccessibleName("Selected design eligibility: Policy-ineligible");
  await expect(page.locator(".designer-workspace-selection-status")).toContainText("Policy-ineligible");
  const selectedObservationBoundary = page.locator('[data-production-observation-boundary="selected_detail"]');
  await expect(selectedObservationBoundary).toBeVisible();
  await expect(selectedObservationBoundary).toHaveAttribute("role", "status");
  await expect(selectedObservationBoundary).toContainText("Observation only · Ineligible");
  const firstMotorPin = page.locator("[data-imported-pin]").first();
  await firstMotorPin.check();
  await expect(firstMotorPin).toBeFocused();
  await expect(solutionTools).toHaveAttribute("open", "");
  await solutionFilter.selectOption("pinned");
  await expect(solutionAnnouncement).toHaveText("1 of 1 solutions shown. Pinned filter.");
  const solutionObjective = page.getByLabel("Sort solutions by objective");
  await solutionObjective.selectOption({ index: 1 });
  const selectedObjective = await solutionObjective.inputValue();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-imported-candidate]").first().click();
  await expect(solutionFilter).toHaveValue("pinned");
  await expect(solutionObjective).toHaveValue(selectedObjective);
  await expect(solutionTools).toHaveAttribute("open", "");
  await expect(page.locator("[data-designer-solution-visible-count]")).toHaveText("1 shown");
  await firstMotorPin.uncheck();
  await expect(solutionFilter).toHaveValue("pinned");
  await expect(solutionFilter).toBeFocused();
  await expect(solutionFilter).toBeVisible();
  await expect(solutionTools).toHaveAttribute("open", "");
  await expect(page.locator("[data-designer-solution-visible-count]")).toHaveText("0 shown");
  await expect(solutionAnnouncement).toHaveText("0 of 1 solutions shown. Pinned filter.");
  await solutionFilter.selectOption("all");
  await firstMotorPin.check();
  await page.setViewportSize({ width: 1440, height: 900 });
  const motorPinnedComparison = page.getByRole("region", { name: "Pinned comparison" });
  await expect(motorPinnedComparison).toBeVisible();
  await openEvidenceCaveats(page);
  const motorCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(motorCaveats.locator("[data-production-constraint-policy]")).toContainText("0 eligible");
  await motorCaveats.getByText("Blocked rule detail", { exact: true }).click();
  await expect(motorCaveats.locator('[data-disposition="blocked_unknown"]').first()).toBeVisible();
  const motorLedger = motorCaveats.locator("[data-production-execution-ledger]");
  await expect(motorLedger.getByRole("heading", { name: "Exact V2 observation execution ledger" })).toBeVisible();
  await expect(motorLedger.locator("[data-execution-group]")).toHaveCount(5);
  await expect(motorCaveats.locator("[data-pinned-comparison]")).toHaveCount(0);
  await expect(motorPinnedComparison).toBeVisible();
  await closeEvidenceCaveats(page);

  await openWorkspaceTab(page, "Export");
  for (const label of ["Electrical BOM CSV", "Structural SVG", "Engineering report HTML", "Structural KiCad schematic"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Physical handoff JSON", exact: true })).toHaveCount(0);
  for (const label of ["Portable Simulation CSV", "Commercial export", "Open in Simulator"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled();
  }

  await page.getByRole("button", { name: "← Edit requirements" }).click();
  await expect(referenceMode).toBeChecked();
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "Schematic", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Generated schematic" })).toBeVisible();

  await openWorkspaceTab(page, "Operating results");
  await expect(page.locator('[data-imported-scenario="pwm_loaded_steady_state"]')).toHaveAttribute("aria-pressed", "true");
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeEnabled();
  await openWorkspaceTab(page, "Operating results");
  await page.locator('[data-imported-scenario="selected_part_model"]').click();
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeDisabled();
  await openWorkspaceTab(page, "Operating results");
  await page.locator('[data-imported-scenario="pwm_loaded_steady_state"]').click();
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeEnabled();

  await openWorkspaceTab(page, "Schematic");
  const motorPreview = await productionPreviewText(page);
  expect(motorPreview).toContain('id="schemagic-production-constraint-observation-artifact-metadata-v1"');
  expect(motorPreview).toContain("OBSERVATION ONLY");
  expect(motorPreview).toContain("Eligibility: INELIGIBLE");
  expect(motorPreview).toContain("motor.integrated.current-limit");
  expect(motorPreview).not.toContain('id="schemagic-circuit-metadata-v2"');

  await openWorkspaceTab(page, "BOM / parts");
  const motorLCSCSearchLinks = page.locator("[data-lcsc-search]");
  expect(await motorLCSCSearchLinks.count()).toBeGreaterThan(0);
  await expect(motorLCSCSearchLinks.first()).toHaveAccessibleName(/^Search LCSC for .+ \(opens in a new tab\)$/u);
  const motorEvidenceDossier = page.getByRole("region", { name: "Selected-part evidence dossier" });
  await expect(motorEvidenceDossier).toBeVisible();
  await expect(motorEvidenceDossier.locator("[data-production-evidence-line]").first()).toBeVisible();
  expect(motorLCSCRequests).toEqual([]);
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("button", { name: "Open in Simulator" })).toBeDisabled();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Electrical design JSON" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("schemagic-design-v2.json");
  const path = await download.path();
  if (!path) throw new Error("Playwright did not retain the generated V2 result download");
  const generated = parseDesignResultV2(JSON.parse(readFileSync(path, "utf8")));
  expect(generated.candidates.length).toBeGreaterThan(0);
  const generatedMotorCandidate = generated.candidates[0]!;
  expect(generatedMotorCandidate.circuit.defaultCircuitId).toBe("assembly");
  expect(generatedMotorCandidate.circuit.defaultScenarioId).toBe("pwm_loaded_steady_state");
  expect(generatedMotorCandidate.circuit.scenarios).toContainEqual(expect.objectContaining({
    id: "pwm_loaded_steady_state",
    circuitId: "behavioral-operating-point",
  }));
  await openWorkspaceTab(page, "Export");
  const motorScenario = await downloadText(page, "Scenario SPICE");
  expect(motorScenario.filename).toMatch(/-pwm-loaded-steady-state-behavioral\.cir$/u);
  expect(motorScenario.content).toContain(`* result-hash ${generated.contentHash}`);
  expect(motorScenario.content).toContain(`* candidate-id ${generatedMotorCandidate.id}`);
  expect(motorScenario.content).toContain("* scenario-id pwm_loaded_steady_state");
  expect(motorScenario.content).toContain("* coverage-tier behavioral");
  expect(motorScenario.content).toContain("* model-boundary ");
  await openWorkspaceTab(page, "Export");
  const motorBom = await downloadText(page, "Electrical BOM CSV");
  expect(motorBom.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-electrical-bom\.csv$/u);
  expect(motorBom.content).toContain(generated.candidates[0]!.components[0]!.part.manufacturerPartNumber);
  const motorKicad = await downloadText(page, "Structural KiCad schematic");
  expect(motorKicad.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-structural\.kicad_sch$/u);
  expect(motorKicad.content).toContain(generatedMotorCandidate.id);
  const motorSvg = await downloadText(page, "Structural SVG");
  expect(motorSvg.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-structural-schematic\.svg$/u);
  expect(motorSvg.content).toContain('<metadata id="schemagic-production-constraint-observation-artifact-metadata-v1">');
  expect(motorSvg.content).toContain(generatedMotorCandidate.id);
  expect(motorSvg.content).toContain("OBSERVATION ONLY");
  const motorReport = await downloadText(page, "Engineering report HTML");
  expect(motorReport.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-engineering-report\.html$/u);
  expect(motorReport.content).toContain('id="schemagic-printable-report-metadata-v2"');
  expect(motorReport.content).toContain(generatedMotorCandidate.id);
  expect(motorReport.content).toContain('"commercialData":"not_included"');

  await page.getByRole("button", { name: "Create share URL" }).click();
  await expect(page).toHaveURL(/#d=/);
  const trustedShareUrl = page.url();
  await page.locator("[data-designer-result-file]").setInputFiles(path);
  await expect(page.getByRole("heading", { name: "Imported design result" })).toBeVisible();
  await openWorkspaceTab(page, "Export");
  await expect(page.locator(".designer-trust-banner")
    .getByText("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeDisabled();
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
  await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  await page.goto(trustedShareUrl);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Imported design result" })).toBeVisible();
  await openWorkspaceTab(page, "Schematic");
  await expect(page.locator(".designer-trust-banner")
    .getByText("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByText("Restored a strictly validated electrical result share. It remains structural-only until you explicitly regenerate it with the installed production context.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-production-constraint-policy]")).toHaveCount(0);
  await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  await expect(page.locator("[data-production-export]")).toHaveCount(0);
  await expect(page.locator("[data-production-schematic-preview]")).toHaveCount(0);
  const regenerateSharedMotor = page.getByRole("button", { name: "Regenerate with installed context", exact: true });
  await expect(regenerateSharedMotor).toBeEnabled();
  await regenerateSharedMotor.click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".designer-trust-banner")
    .getByText("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION", { exact: true })).toHaveCount(0);
  await expect(page.locator(".designer-trust-banner .designer-chip")).toHaveText("reference / estimated", { ignoreCase: true });
  await expect(page.getByText("Persisted structural observations explicitly regenerated; the installed production policy marks 0 eligible.", { exact: true })).toBeVisible();
  await openWorkspaceTab(page, "Schematic");
  expect(await productionPreviewText(page)).toBe(motorPreview);
  await openWorkspaceTab(page, "Optimize");
  await expect(page.getByRole("tab", { name: "Optimize", exact: true })).toBeFocused();
  await openEvidenceCaveats(page);
  const restoredMotorCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(restoredMotorCaveats.locator("[data-production-execution-ledger]")).toBeVisible();
  await expect(restoredMotorCaveats.locator("[data-pinned-comparison]")).toHaveCount(0);
  await closeEvidenceCaveats(page);
  await openWorkspaceTab(page, "Export");
  const restoredMotorBom = await downloadText(page, "Electrical BOM CSV");
  expect(restoredMotorBom).toEqual(motorBom);
  await openWorkspaceTab(page, "Export");
  expect(await downloadText(page, "Scenario SPICE")).toEqual(motorScenario);
});

test("external-NMOS Motor exposes only exact direct-gate structural observations behind explicit inspection", async ({ page }) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https:\/\/(?:[^/]+\.)?(?:digikey|mouser|lcsc)\.[^/]+\//u.test(request.url())) {
      providerRequests.push(request.url());
    }
  });

  await page.locator('[data-application="motor.brushed-dc"]')
    .getByRole("button", { name: "Start Motor design" }).click();
  await page.getByLabel("Starting point").selectOption("motor.external-24v");
  const referenceMode = page.getByLabel("Reference design");
  const strictMode = page.getByLabel("Strict evidence gate");
  await expect(referenceMode).toBeChecked();
  await strictMode.check();
  await page.getByRole("button", { name: "Generate design" }).click();

  await expect(page.getByRole("heading", { name: "Generated design result" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "No retained candidate" })).toBeVisible();
  await expect(page.locator(".designer-results-header")).toContainText("0 generated");
  await expect(page.locator(".designer-results-header")).toContainText("54 generation exclusions");
  await expect(page.locator(".designer-error-banner")).toContainText("enumerated and checked 54 exact MIC4606-2 direct-gate structures with separate bootstrap and VDD-local capacitor roles");
  await expect(page.locator(".designer-error-banner")).toContainText("the 100 nF C1608 is excluded from both roles");
  await expect(page.locator(".designer-error-banner")).toContainText("application adequacy remains unknown");
  await expect(page.locator(".designer-error-banner")).toContainText("no series-gate resistor was selected");
  const strictEmpty = page.locator(".designer-empty-results");
  await expect(strictEmpty.locator(":scope > p")).toHaveText("Strict results are still in progress. Inspect an evidence-limited reference solution; unknown remains unknown.");
  await expect(strictEmpty.locator("button:enabled, a[href]")).toHaveCount(1);
  await expect(page.locator("[data-power-evidence-inspection]")).toHaveCount(0);
  await openEvidenceCaveats(page);
  const strictMotorCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  const strictLedger = strictMotorCaveats.locator("[data-production-execution-ledger]");
  await expect(strictLedger.getByRole("heading", { name: "Exact execution ledger" })).toBeVisible();
  await expect(strictLedger).toContainText("3 supported recipes · 54 checked · 0 Pareto survivors · 54 exclusions");
  await expect(strictLedger.locator("[data-execution-group]")).toHaveCount(5);
  expect(await strictLedger.locator("[data-execution-group] > header > strong").allTextContents()).toEqual(["0", "0", "54", "0", "0"]);
  await expect(strictMotorCaveats.getByText("design.no_supported_recipe", { exact: true })).toHaveCount(0);
  await expect(strictLedger.getByText("unknown_constraint_disallowed", { exact: true })).toHaveCount(54);
  await expect(strictMotorCaveats.getByText("hard_constraint_failed", { exact: true })).toHaveCount(0);
  await closeEvidenceCaveats(page);
  const strictResultArtifact = await downloadText(page, "Electrical design JSON");
  const strictResult = parseDesignResultV2(JSON.parse(strictResultArtifact.content));
  expect(strictResult).toMatchObject({
    requestHash: "sha256:2fd2159070a51d75077ea7e2d7aa968af94728cc3d869aaf42f9dfc0be13d563",
    contentHash: "sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435",
    libraryContentHash: "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38",
    candidates: [],
    diagnostics: [],
  });
  expect(strictResult.rejectedCandidates).toHaveLength(54);
  expect(strictResult.rejectedCandidates.every((rejection) => rejection.constraints.some((constraint) => (
    constraint.ruleId === "motor.external.gate-network"
    && constraint.status === "unknown"
    && constraint.evidence.some((evidence) => evidence.sourceId === "microchip-mic4606-ds20005604h")
  )))).toBe(true);

  for (const selector of [
    ".designer-comparison",
    ".designer-candidate-detail",
    "[data-imported-pin]",
    "[data-pinned-comparison]",
    "[data-production-export]",
    "[data-production-schematic-preview]",
    "[data-primary-customization-import], [data-primary-customization-apply], [data-primary-customization-result], [data-primary-customization-signature]",
    "[data-customized-target-export]",
    "[data-customized-target-receipt-export]",
    "[data-sourcing-request-transfer]",
    "[data-production-evidence-dossier]",
    "[data-lcsc-search]",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }

  await page.getByRole("button", { name: "← Edit requirements" }).click();
  await referenceMode.check();
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Generated 2 structural observations; the installed production policy marks 0 eligible.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No retained candidate" })).toHaveCount(0);
  await openEvidenceCaveats(page);
  const externalMotorCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(externalMotorCaveats.locator("[data-production-constraint-policy]")).toContainText("0 eligible");
  await expect(externalMotorCaveats.locator("[data-production-constraint-policy]")).toContainText("2 structural observations");
  await expect(externalMotorCaveats.locator("[data-production-constraint-policy] .designer-stat-grid code"))
    .toHaveText("sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0");
  const permissiveLedger = externalMotorCaveats.locator("[data-production-execution-ledger]");
  await expect(permissiveLedger).toContainText("3 supported recipes · 54 checked · 2 Pareto survivors · 52 exclusions");
  expect(await permissiveLedger.locator("[data-execution-group] > header > strong").allTextContents()).toEqual(["0", "0", "0", "0", "52"]);
  await expect(permissiveLedger).not.toContainText("unknown_constraint_disallowed");
  await closeEvidenceCaveats(page);
  await expect(page.locator(".designer-results-header")).toContainText("0 eligible · 2 observed");
  await expect(page.locator(".designer-results-header")).toContainText("52 generation exclusions");
  await expect(page.locator(".designer-detail-header code")).toHaveText("candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed");
  await openWorkspaceTab(page, "BOM / parts");
  await expect(page.locator(".designer-candidate-detail")).toContainText("MIC4606-2YML-T5");
  await expect(page.locator(".designer-candidate-detail .designer-bom-table")).not.toContainText("gate-resistor");
  await expect(page.locator(".designer-candidate-detail .designer-bom-table")).not.toContainText("C1608X7R1H104K080AA");
  const bootstrapRow = page.locator(".designer-candidate-detail .designer-bom-table tbody tr").filter({ hasText: "bootstrap-capacitor" });
  const localRow = page.locator(".designer-candidate-detail .designer-bom-table tbody tr").filter({ hasText: "local-decoupling" });
  await expect(bootstrapRow).toContainText("GRM31CR61H106KA12L");
  await expect(bootstrapRow.locator("td").nth(2)).toHaveText("2");
  await expect(localRow).toContainText("GRM31CR61H106KA12L");
  await expect(localRow.locator("td").nth(2)).toHaveText("1");
  await openWorkspaceTab(page, "Operating results");
  const gateNetwork = page.locator('.designer-constraint-list article').filter({ hasText: "motor.external.gate-network" });
  await expect(gateNetwork).toHaveAttribute("data-status", "unknown");
  await expect(gateNetwork).toHaveAttribute("data-criticality", "safety");
  await expect(gateNetwork).toHaveAttribute("data-disposition", "blocked_unknown");
  const permissiveResultArtifact = await downloadText(page, "Electrical design JSON");
  const permissiveResult = parseDesignResultV2(JSON.parse(permissiveResultArtifact.content));
  expect(permissiveResult).toMatchObject({
    requestHash: "sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f",
    contentHash: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176",
    libraryContentHash: "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38",
    diagnostics: [],
  });
  expect(permissiveResult.candidates.map((candidate) => candidate.id)).toEqual([
    "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed",
    "candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70",
  ]);
  expect(permissiveResult.rejectedCandidates).toHaveLength(52);
  for (const candidate of permissiveResult.candidates) {
    expect(candidate.components).toHaveLength(8);
    expect(candidate.components.some((component) => component.id === "gate-resistor")).toBe(false);
    expect(candidate.components).toContainEqual(expect.objectContaining({
      id: "bootstrap-capacitor",
      quantityPerAssembly: 2,
      profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
    }));
    expect(candidate.components).toContainEqual(expect.objectContaining({
      id: "local-decoupling",
      quantityPerAssembly: 1,
      profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
    }));
    expect(candidate.constraints).toContainEqual(expect.objectContaining({
      ruleId: "motor.external.gate-network",
      status: "unknown",
      evidence: expect.arrayContaining([expect.objectContaining({
        sourceId: "microchip-mic4606-ds20005604h",
        contentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135",
      })]),
    }));
    expect(candidate.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance-nominal", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.local-capacitance-nominal", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.local-capacitance-effective", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.bulk-capacitance", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.capacitor-placement", status: "unknown" }),
    ]));
  }
  expect(JSON.stringify(permissiveResult)).not.toContain("C1608X7R1H104K080AA");
  await openWorkspaceTab(page, "Export");
  const bom = await downloadText(page, "Electrical BOM CSV");
  expect(bom.content).toContain("MIC4606-2YML-T5");
  expect(bom.content).toContain("bootstrap-capacitor,bootstrap-capacitor,murata-manufacturing,GRM31CR61H106KA12L,packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json,2");
  expect(bom.content).toContain("local-decoupling,driver-local-decoupling-capacitor,murata-manufacturing,GRM31CR61H106KA12L,packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json,1");
  expect(bom.content).not.toContain("C1608X7R1H104K080AA");
  expect(bom.content).not.toContain("gate-resistor");
  expect(providerRequests).toEqual([]);
});

test("Power retains the reviewed Bel BOM only as an ineligible exact structural observation", async ({ page }) => {
  const externalLCSCRequests: string[] = [];
  const externalProviderRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://www.lcsc.com/")) externalLCSCRequests.push(request.url());
    if (/^https:\/\/(?:[^/]+\.)?(?:digikey|mouser|lcsc)\.[^/]+\//u.test(request.url())) {
      externalProviderRequests.push(request.url());
    }
  });
  const powerCard = page.locator('[data-application="power.buck"]');
  await powerCard.getByRole("button", { name: "Start Power design" }).click();
  await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
  await expect(page.getByLabel("Starting point")).toHaveValue("power.integrated-12v-low-current");

  const referenceMode = page.getByLabel("Reference design");
  const strictMode = page.getByLabel("Strict evidence gate");
  await expect(referenceMode).toBeChecked();
  await strictMode.check();
  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.getByRole("heading", { name: "Generated design result" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "No retained candidate" })).toBeVisible();
  const strictEmpty = page.locator(".designer-empty-results");
  await expect(strictEmpty.locator(":scope > p")).toHaveText("Strict results are still in progress. Inspect an evidence-limited reference solution; unknown remains unknown.");
  await expect(strictEmpty.locator("button:enabled, a[href]")).toHaveCount(1);
  const evidenceInspection = page.getByRole("button", {
    name: "Show reference solution",
    exact: true,
  });
  await expect(evidenceInspection).toBeEnabled();
  await openEvidenceCaveats(page);
  const strictPowerCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  const strictLedger = strictPowerCaveats.locator("[data-production-execution-ledger]");
  await expect(strictLedger.getByRole("heading", { name: "Exact execution ledger" })).toBeVisible();
  await expect(strictLedger.getByText("unknown_constraint_disallowed", { exact: true })).toBeVisible();
  await expect(strictLedger).toContainText("power.regulator.current-limit");
  await expect(strictLedger).toContainText("power.feedback.output-voltage");
  await expect(strictLedger).toContainText("power.control.loop-stability");
  await expect(strictLedger.getByText("hard_constraint_failed", { exact: true })).toHaveCount(0);
  await expect(page.locator(".designer-results-header")).toContainText("0 generated");
  await expect(page.locator(".designer-results-header")).toContainText("1 generation exclusions");
  await expect(page.locator(".designer-trust-banner > code")).toHaveText("sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2");
  const strictReferenceEvidence = strictPowerCaveats.locator("[data-power-reference-evidence]");
  await expect(strictReferenceEvidence.getByRole("heading", { name: "TPS54302EVM-716 reference observations" })).toBeVisible();
  await expect(strictReferenceEvidence).toContainText("REFERENCE ONLY · NOT CANDIDATE EVIDENCE");
  await expect(strictReferenceEvidence).toContainText("PWR716-003 · SLVUAP9B Rev. B");
  await expect(strictReferenceEvidence).toContainText("Identity asserted but unattested");
  await expect(strictReferenceEvidence).toContainText("Request-relevant observations2");
  await expect(strictReferenceEvidence).toContainText("Strict rules closed0");
  await expect(strictReferenceEvidence).toContainText("Strict rules still blocked13");
  await expect(strictReferenceEvidence).toContainText("power.reference.tps54302evm716.tested-operating-envelope");
  await expect(strictReferenceEvidence).toContainText("power.reference.tps54302evm716.load-regulation");
  await expect(strictReferenceEvidence).toContainText("TPS54302DDC");
  await expect(strictReferenceEvidence).toContainText("7447714100 · 10uH");
  await expect(strictReferenceEvidence).toContainText("TPS54302DDCR");
  await expect(strictReferenceEvidence).toContainText("F1F2-0804-100M · 10uH");
  await expect(strictReferenceEvidence).toContainText("Exact MPN / BOM mismatch");
  await expect(strictReferenceEvidence).toContainText("Both inductors are nominally 10uH; the mismatch is exact MPN and BOM identity, not nominal inductance.");
  await expect(strictReferenceEvidence).toContainText("No eligibility, strict-rule, selected-part model, provider, sourcing, or commercial effect");
  await expect(strictReferenceEvidence.locator("a")).toHaveCount(0);
  await closeEvidenceCaveats(page);
  const strictResult = parseDesignResultV2(JSON.parse((await downloadText(page, "Electrical design JSON")).content));
  expect(strictResult).toMatchObject({
    libraryVersion: "2026-08-27.2",
    requestHash: "sha256:30b8c0fac110f71ce3e71c9347afe725f2a1ad29aa4fdb6bfde8bc87cc73771c",
    contentHash: "sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2",
    libraryContentHash: "sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3",
    candidates: [],
  });
  expect(strictResult.rejectedCandidates).toEqual([
    expect.objectContaining({
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      constraints: expect.arrayContaining([
        expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
        expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
        expect.objectContaining({ ruleId: "power.inductor.rms-current", status: "unknown" }),
      ]),
    }),
  ]);
  expect(strictResult.rejectedCandidates[0]!.constraints.some((constraint) => constraint.status === "fail")).toBe(false);
  for (const selector of [
    "[data-imported-pin]",
    "[data-pinned-comparison]",
    "[data-production-export]",
    "[data-production-schematic-preview]",
    "[data-primary-customization-import], [data-primary-customization-apply], [data-primary-customization-result], [data-primary-customization-signature]",
    "[data-customized-target-export]",
    "[data-sourcing-request-transfer]",
    "[data-production-evidence-dossier]",
    "[data-lcsc-search]",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }

  await evidenceInspection.click();
  await expect(page.getByRole("heading", { name: "Constraint observations" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Inspected one exact evidence-limited Power design after changing only allowUnknownHardConstraints to true. The installed policy marks 0 eligible; unknown ≠ pass.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-power-evidence-inspection]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No retained candidate" })).toHaveCount(0);
  await expect(page.locator(".designer-trust-banner")
    .getByText("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION", { exact: true })).toHaveCount(0);
  await expect(page.locator(".designer-trust-banner .designer-chip")).toHaveText("reference / estimated", { ignoreCase: true });
  await openEvidenceCaveats(page);
  const powerObservationCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(powerObservationCaveats.locator("[data-production-constraint-policy]")).toContainText("0 eligible");
  await expect(powerObservationCaveats.locator("[data-production-constraint-policy]")).toContainText("1 structural observation");
  await expect(powerObservationCaveats.locator("[data-production-constraint-policy] .designer-stat-grid code"))
    .toHaveText("sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6");
  await expect(page.locator(".designer-results-header")).toContainText("0 eligible · 1 observed");
  await expect(page.locator(".designer-results-header")).toContainText("0 generation exclusions");
  await expect(page.locator(".designer-trust-banner > code")).toHaveText("sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a");
  const permissiveReferenceEvidence = powerObservationCaveats.locator("[data-power-reference-evidence]");
  await expect(permissiveReferenceEvidence).toContainText("Request-relevant observations2");
  await expect(permissiveReferenceEvidence).toContainText("Strict rules closed0");
  await expect(permissiveReferenceEvidence).toContainText("Strict rules still blocked13");
  await expect(permissiveReferenceEvidence).toContainText("Candidate observations0");
  await expect(permissiveReferenceEvidence).toContainText("none of these observations applies to it");
  await expect(permissiveReferenceEvidence.locator("a")).toHaveCount(0);
  const permissiveLedger = powerObservationCaveats.locator("[data-production-execution-ledger]");
  await expect(permissiveLedger.getByRole("heading", { name: "Exact V2 observation execution ledger" })).toBeVisible();
  expect(await permissiveLedger.locator("[data-execution-group] > header > strong").allTextContents()).toEqual(["0", "0", "0", "0", "0"]);
  await expect(permissiveLedger.getByText("hard_constraint_failed", { exact: true })).toHaveCount(0);
  await expect(permissiveLedger.getByText("unknown_constraint_disallowed", { exact: true })).toHaveCount(0);
  await closeEvidenceCaveats(page);
  await expect(page.locator(".designer-detail-header code")).toHaveText("candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a");
  await openWorkspaceTab(page, "BOM / parts");
  await expect(page.locator(".designer-candidate-detail")).toContainText("F1F2-0804-100M");
  await expect(page.locator(".designer-candidate-detail")).toContainText("GRM32ER71E226KE15L");
  await openWorkspaceTab(page, "Schematic");
  await expect(page.locator("[data-production-schematic-preview] img")).toBeVisible({ timeout: 30_000 });
  await openWorkspaceTab(page, "Operating results");
  const constraints = page.locator(".designer-constraint-list");
  for (const unknownRuleId of [
    "power.regulator.output-current",
    "power.inductor.selected-value",
    "power.inductor.saturation-current",
    "power.inductor.rms-current",
    "power.passive.capacitor-effective-capacitance",
    "power.passive.bootstrap-effective-capacitance",
    "power.regulator.minimum-on-time",
    "power.regulator.minimum-off-time",
    "power.control.loop-stability",
    "power.request.output-ripple",
    "power.thermal.loss-model",
    "power.thermal.maximum-junction",
  ]) {
    await expect(constraints).toContainText(unknownRuleId);
  }
  await expect(constraints.locator('article[data-status="pass"]', { hasText: "power.feedback.output-voltage" })).toHaveCount(1);
  await expect(constraints.locator('article[data-status="pass"]', { hasText: "power.passive.resistor-power-voltage" })).toHaveCount(1);
  await expect(constraints).not.toContainText("power.request.load-transient");

  const generated = parseDesignResultV2(JSON.parse((await downloadText(page, "Electrical design JSON")).content));
  expect(generated).toMatchObject({
    libraryVersion: "2026-08-27.2",
    requestHash: "sha256:f21a643aba1a3c8cb75d42ff2e69b4f12a25168becdb68fbf54f720649821cd4",
    contentHash: "sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a",
    libraryContentHash: "sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3",
    rejectedCandidates: [],
  });
  const exactInspectionRequest = structuredClone(strictResult.request);
  exactInspectionRequest.constraints.allowUnknownHardConstraints = true;
  expect(generated.request).toEqual(exactInspectionRequest);
  expect(generated.candidates).toEqual([
    expect.objectContaining({
      id: "candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a",
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      components: expect.arrayContaining([
        expect.objectContaining({
          id: "power-inductor",
          part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" },
        }),
      ]),
      constraints: expect.arrayContaining([
        expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
        expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
        expect.objectContaining({ ruleId: "power.control.loop-stability", status: "unknown" }),
      ]),
    }),
  ]);
  const generatedCandidate = generated.candidates[0]!;
  expect(generatedCandidate.constraints.some((constraint) => constraint.status === "fail")).toBe(false);
  expect(generatedCandidate.components).toHaveLength(7);
  expect(generatedCandidate.components).toContainEqual(expect.objectContaining({
    id: "output-capacitor",
    part: { manufacturerId: "murata-manufacturing", manufacturerPartNumber: "GRM32ER71E226KE15L" },
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
    quantityPerAssembly: 2,
    value: { value: 0.000022, unit: "F", displayUnit: "F" },
  }));
  for (const circuitId of ["assembly", "ideal_pwm_output_stage"] as const) {
    const circuit = generatedCandidate.circuit.circuits.find((entry) => entry.id === circuitId);
    expect(circuit?.components.filter((component) => component.id.startsWith("output-capacitor-"))).toEqual([
      expect.objectContaining({ id: "output-capacitor-1", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
      expect.objectContaining({ id: "output-capacitor-2", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
    ]);
  }
  expect(generatedCandidate.metrics.values).toContainEqual(expect.objectContaining({
    id: "power.native.component-count",
    value: { value: 8, unit: "count", displayUnit: "count" },
  }));

  await openWorkspaceTab(page, "Export");
  const bom = await downloadText(page, "Electrical BOM CSV");
  expect(bom.content).toContain("F1F2-0804-100M");
  expect(bom.content).toContain("output-capacitor,output-capacitor,murata-manufacturing,GRM32ER71E226KE15L,packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json,2");
  expect(bom.content).toContain("sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c");
  expect(bom.content).toContain("sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37");
  expect(bom.content).toContain("ineligible");

  const powerSvg = await downloadText(page, "Structural SVG");
  expect(powerSvg.filename).toMatch(/^schemagic-power-buck-[0-9a-f]{12}-structural-schematic\.svg$/u);
  expect(powerSvg.content).toContain('<metadata id="schemagic-production-constraint-observation-artifact-metadata-v1">');
  expect(powerSvg.content).toContain(generatedCandidate.id);
  expect(powerSvg.content).toContain("OBSERVATION ONLY");
  const powerReport = await downloadText(page, "Engineering report HTML");
  expect(powerReport.filename).toMatch(/^schemagic-power-buck-[0-9a-f]{12}-engineering-report\.html$/u);
  expect(powerReport.content).toContain('id="schemagic-printable-report-metadata-v2"');
  expect(powerReport.content).toContain(generatedCandidate.id);
  expect(powerReport.content).toContain('"commercialData":"not_included"');

  const physicalHandoffDownload = await downloadText(page, "Physical handoff JSON");
  expect(physicalHandoffDownload.filename).toMatch(
    /^schemagic-power-buck-[0-9a-f]{12}-physical-implementation-handoff-v2\.json$/u,
  );
  const physicalHandoff = JSON.parse(physicalHandoffDownload.content) as PowerPhysicalImplementationHandoffV2;
  expect(physicalHandoff).toMatchObject({
    format: "schemagic-power-physical-implementation-handoff",
    schemaVersion: 2,
    artifactKind: "physical_implementation_handoff",
    scope: {
      application: "power.buck",
      attestation: "none",
      physicalFidelityClaim: "none",
      candidateEligibilityAuthority: "none",
      simulationFidelityClaim: "none",
      manufacturingOutputClaim: "none",
    },
    provenance: {
      designResult: {
        contentHash: generated.contentHash,
        requestHash: generated.requestHash,
        libraryContentHash: generated.libraryContentHash,
      },
      candidate: {
        id: generatedCandidate.id,
        recipeId: generatedCandidate.recipeId,
        recipeVersion: "3.4.6",
      },
      selectedBom: { lineCount: 7, physicalInstanceCount: 8 },
    },
    implementation: {
      state: "unavailable",
      footprintAssignedKicadSchematic: { state: "not_emitted", contentHash: null },
      placement: {
        state: "not_emitted",
        routing: "unrouted",
        verification: "unverified",
        contentHash: null,
      },
    },
    contentHash: "sha256:1cde50595ebed875cb5f77e8c7a449bd3e1be2355a9dcbc150dbe6e972d28af8",
  });
  expect(physicalHandoff.lines).toHaveLength(7);
  expect(physicalHandoff.lines.flatMap((line) => line.structuralInstances)).toHaveLength(8);
  expect(physicalHandoff.lines.flatMap((line) => line.structuralInstances)
    .every((instance) => (
      instance.footprintMapping.state === "unavailable"
      && instance.pins.every((pin) => (
        pin.mappingState === "unavailable" && pin.physicalPinNumber === null
      ))
    ))).toBe(true);

  await expect(page.locator("[data-imported-pin]")).toHaveCount(1);
  await expect(page.locator("[data-production-export]")).not.toHaveCount(0);
  await expect(page.locator("[data-production-schematic-preview]")).toHaveCount(1);
  await openWorkspaceTab(page, "Optimize");
  await expect(page.locator("[data-primary-customization]")).toContainText("No exact same-recipe primary alternate");
  await expect(page.locator("[data-primary-customization-result], [data-customized-target-export]")).toHaveCount(0);
  await openWorkspaceTab(page, "Export");
  const sourcingRequest = page.getByRole("region", { name: "Sourcing request packet" });
  await expect(sourcingRequest).toBeVisible();
  await expect(sourcingRequest).toContainText("no provider access authority or network destination");
  await expect(page.getByRole("button", { name: "Portable Simulation CSV", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Commercial export", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Open in Simulator", exact: true })).toBeDisabled();
  const artifactReadiness = page.getByRole("region", { name: "What this design can hand off" });
  await expect(artifactReadiness.locator("[data-artifact-readiness]")).toHaveCount(4);
  await expect(artifactReadiness.locator('[data-artifact-readiness="electrical"]')).toHaveAttribute("data-readiness", "inspection-only");
  await expect(artifactReadiness.locator('[data-artifact-readiness="behavioral-simulation"]')).toHaveAttribute("data-readiness", "bounded-input");
  await expect(artifactReadiness.locator('[data-artifact-readiness="physical"]')).toHaveAttribute("data-readiness", "structural-only");
  await expect(artifactReadiness.locator('[data-artifact-readiness="manufacturing-provider"]')).toHaveAttribute("data-readiness", "unavailable");
  await expect(artifactReadiness.locator('[data-artifact-readiness="physical"]')).toContainText("no reviewed footprints, placement, routing, or fabrication authority");
  await expect(artifactReadiness.locator('[data-artifact-readiness="physical"]')).toContainText("pin mappings and external attestation are unavailable");
  await expect(artifactReadiness.locator('[data-artifact-readiness="manufacturing-provider"]')).toContainText("No routed board, fabrication package, authorized provider snapshot, or commercial export is available.");
  await openWorkspaceTab(page, "BOM / parts");
  await expect(page.locator("[data-production-evidence-dossier]")).toHaveCount(1);
  await expect(page.locator("[data-lcsc-search]")).not.toHaveCount(0);
  await expect(page.getByText("Hard electrical failure", { exact: false })).toHaveCount(0);
  expect(externalLCSCRequests).toEqual([]);
  expect(externalProviderRequests).toEqual([]);

  await page.locator("[data-designer-result-file]").setInputFiles({
    name: "structural-only-v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeV2(scenarioV2Result())),
  });
  await openWorkspaceTab(page, "Export");
  await expect(page.locator(".designer-trust-banner")
    .getByText("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED", { exact: true })).toBeVisible();
  for (const label of ["Electrical BOM CSV", "Structural SVG", "Engineering report HTML", "Structural KiCad schematic"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled();
  }
  await expect(page.getByRole("button", { name: "Physical handoff JSON", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scenario SPICE", exact: true })).toBeDisabled();
  await expect(page.locator("[data-production-schematic-preview]")).toHaveCount(0);
  await expect(page.locator("[data-production-execution-ledger]")).toHaveCount(0);
  await expect(page.locator("[data-imported-pin]")).toHaveCount(0);
  await expect(page.locator("[data-lcsc-search]")).toHaveCount(0);
  await expect(page.locator("[data-production-evidence-dossier]")).toHaveCount(0);
  await expect(page.locator("[data-sourcing-request-transfer]")).toHaveCount(0);
  await expect(page.locator("[data-power-reference-evidence], [data-power-reference-evidence-invalid]")).toHaveCount(0);
});

test.describe("Power evidence-limited inspection async invalidation", () => {
  test.use({ serviceWorkers: "block" });

  test("discards a stale inspection completion after returning to strict requirements", async ({ page }) => {
    const providerRequests: string[] = [];
    page.on("request", (request) => {
      if (/^https:\/\/(?:[^/]+\.)?(?:digikey|mouser|lcsc)\.[^/]+\//u.test(request.url())) {
        providerRequests.push(request.url());
      }
    });
    await page.locator('[data-application="power.buck"]')
      .getByRole("button", { name: "Start Power design" }).click();
    await page.getByLabel("Strict evidence gate").check();
    await page.getByRole("button", { name: "Generate design" }).click();
    const inspectAction = page.getByRole("button", {
      name: "Show reference solution",
      exact: true,
    });
    await expect(inspectAction).toBeEnabled();

    const powerObservationChunk = /\/assets\/v3-[^/]+\.js(?:\?.*)?$/u;
    let releaseChunk!: () => void;
    let markChunkStarted!: () => void;
    const chunkGate = new Promise<void>((resolve) => { releaseChunk = resolve; });
    const chunkStarted = new Promise<void>((resolve) => { markChunkStarted = resolve; });
    const holdPowerObservationChunk = async (route: Route) => {
      markChunkStarted();
      await chunkGate;
      await route.continue();
    };
    await page.route(powerObservationChunk, holdPowerObservationChunk);

    await inspectAction.click();
    await chunkStarted;
    await expect(inspectAction).toBeDisabled();
    await expect(inspectAction).toHaveAttribute("aria-busy", "true");
    await page.getByRole("button", { name: "← Edit requirements", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
    await expect(page.getByLabel("Strict evidence gate")).toBeChecked();

    const chunkResponse = page.waitForResponse(powerObservationChunk);
    releaseChunk();
    await chunkResponse;
    await page.waitForTimeout(100);

    await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Constraint observations" })).toHaveCount(0);
    await expect(page.getByText("Inspected one exact evidence-limited Power design", { exact: false })).toHaveCount(0);
    await expect(page.getByLabel("Strict evidence gate")).toBeChecked();
    expect(providerRequests).toEqual([]);
    await page.unroute(powerObservationChunk, holdPowerObservationChunk);
  });
});

test.describe("sourcing request packet async invalidation", () => {
  test.use({ serviceWorkers: "block" });

  test("does not download a stale packet after a new production generation replaces its source", async ({ page }) => {
    const sourcingPacketProviderRequests: string[] = [];
    page.on("request", (request) => {
      if (/^https:\/\/(?:[^/]+\.)?(?:digikey|mouser|lcsc)\.[^/]+\//u.test(request.url())) {
        sourcingPacketProviderRequests.push(request.url());
      }
    });
    await page.locator('[data-application="motor.brushed-dc"]')
      .getByRole("button", { name: "Start Motor design" }).click();
    const referenceMode = page.getByLabel("Reference design");
    await expect(referenceMode).toBeChecked();
    await page.getByRole("button", { name: "Generate design" }).click();
    await openWorkspaceTab(page, "Export");
    const sourcingRequestPanel = page.getByRole("region", { name: "Sourcing request packet" });
    await expect(sourcingRequestPanel).toBeVisible();

    const packetChunkPattern = /\/assets\/request-packet-v1-[^/]+\.js(?:\?.*)?$/u;
    let releasePacketChunk!: () => void;
    let markPacketChunkStarted!: () => void;
    const packetChunkGate = new Promise<void>((resolve) => { releasePacketChunk = resolve; });
    const packetChunkStarted = new Promise<void>((resolve) => { markPacketChunkStarted = resolve; });
    const holdPacketChunk = async (route: Route) => {
      markPacketChunkStarted();
      await packetChunkGate;
      await route.continue();
    };
    await page.route(packetChunkPattern, holdPacketChunk);
    let stalePacketDownloads = 0;
    const countStalePacketDownload = () => { stalePacketDownloads += 1; };
    page.on("download", countStalePacketDownload);

    await sourcingRequestPanel.getByRole("button", { name: "Download sourcing request JSON" }).click();
    await packetChunkStarted;
    await page.getByRole("button", { name: "← Edit requirements", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Define the operating point" })).toBeVisible();
    await expect(referenceMode).toBeChecked();
    await page.getByRole("button", { name: "Generate design" }).click();
    await openWorkspaceTab(page, "Export");
    await expect(page.getByRole("region", { name: "Sourcing request packet" })).toBeVisible();

    const packetChunkResponse = page.waitForResponse(packetChunkPattern);
    releasePacketChunk();
    await packetChunkResponse;
    await page.waitForTimeout(100);

    expect(stalePacketDownloads).toBe(0);
    await expect(page.getByText("Provider-neutral sourcing request downloaded.", { exact: false })).toHaveCount(0);
    page.off("download", countStalePacketDownload);
    await page.unroute(packetChunkPattern, holdPacketChunk);

    const currentPacket = await downloadText(page, "Download sourcing request JSON");
    expect(JSON.parse(currentPacket.content)).toMatchObject({
      boundaries: {
        purpose: "provider_neutral_sourcing_request",
        offers: "not_included",
        providerUrls: "not_included",
        providerSelection: "not_included",
        credentials: "not_included",
        commercialObservations: "not_included",
        providerAccess: "not_authorized",
      },
    });
    expect(currentPacket.content).not.toMatch(/https?:\/\//u);
    expect(sourcingPacketProviderRequests).toEqual([]);
  });
});

test("strict V1 import remains audit-only and exports only canonical legacy JSON", async ({ page }) => {
  const source = serializeV1(legacyV1Result());
  await page.locator("[data-designer-result-file]").setInputFiles({
    name: "legacy-v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });

  await expect(page.getByRole("heading", { name: "Imported design result" })).toBeVisible();
  await openWorkspaceTab(page, "Export");
  await expect(page.locator(".designer-trust-banner")
    .getByText("LEGACY V1 · AUDIT ONLY", { exact: true })).toBeVisible();
  await expect(page.getByText("PERSISTED ORDER · UNVERIFIED", { exact: true })).toBeVisible();
  for (const label of ["Scenario gate plan unavailable", "Electrical BOM CSV", "Scenario SPICE", "Structural SVG", "Engineering report HTML", "Structural KiCad schematic", "Portable Simulation CSV", "Commercial export", "Open in Simulator"]) {
    await expect(page.getByRole("button", { name: label })).toBeDisabled();
  }
  await expect(page.locator("[data-production-schematic-preview]")).toHaveCount(0);

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Canonical legacy design JSON" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("schemagic-design-v1.json");
  const path = await download.path();
  if (!path) throw new Error("Playwright did not retain the design-result download");
  expect(readFileSync(path, "utf8")).toBe(source);
});

test("strict V2 import is structural-only and preserves a zero-candidate production result", async ({ page }) => {
  const source = serializeV2(emptyV2Result());
  await page.locator("[data-designer-result-file]").setInputFiles({
    name: "blocked-v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });

  await expect(page.locator(".designer-trust-banner")
    .getByText("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No persisted candidate" })).toBeVisible();
  await expect(page.getByText("The V2 artifact explicitly reports that no supported production recipe produced a candidate.", { exact: true })).toBeVisible();
  await openEvidenceCaveats(page);
  const emptyResultCaveats = page.getByRole("dialog", { name: "Evidence & caveats" });
  await expect(emptyResultCaveats.getByRole("heading", { name: "Persisted diagnostics" })).toBeVisible();
  await expect(emptyResultCaveats.getByText("design.no_supported_recipe", { exact: true })).toBeVisible();
  await closeEvidenceCaveats(page);
  await expect(page.getByRole("button", { name: "Electrical design JSON" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Electrical BOM CSV" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open in Simulator" })).toHaveCount(0);
  await expect(page.locator("[data-power-evidence-inspection]")).toHaveCount(0);

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Electrical design JSON" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("schemagic-design-v2.json");
  const path = await download.path();
  if (!path) throw new Error("Playwright did not retain the V2 design-result download");
  expect(readFileSync(path, "utf8")).toBe(source);
});

test("V2 scenario workspace traces coverage to graphs without enabling execution", async ({ page }) => {
  const source = serializeV2(scenarioV2Result());
  await page.locator("[data-designer-result-file]").setInputFiles({
    name: "scenario-v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });

  await openWorkspaceTab(page, "Operating results");
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  const operatingPoint = page.locator('[data-imported-scenario="op"]');
  const startup = page.locator('[data-imported-scenario="startup"]');
  await expect(operatingPoint).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Behavioral operating-point graph", { exact: true })).toBeVisible();
  await expect(page.getByText("Behavioral claim, not execution proof", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verified contexts + receipt required" })).toBeDisabled();
  await expect(page.getByText(/byte integrity, not independent execution attestation/u)).toBeVisible();
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("button", { name: "Portable Simulation CSV" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Scenario gate plan JSON" })).toBeEnabled();
  const exportCaveats = page.locator("details.designer-export-boundary");
  await exportCaveats.locator("summary").click();
  await expect(exportCaveats).toHaveAttribute("open", "");
  await expect(exportCaveats).toContainText(/hash-bound structural metadata only/u);
  for (const label of ["Electrical BOM CSV", "Structural SVG", "Engineering report HTML", "Structural KiCad schematic"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled();
  }

  const planDownloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scenario gate plan JSON" }).click();
  const planDownload = await planDownloadEvent;
  expect(planDownload.suggestedFilename()).toBe("schemagic-scenario-gates-v2.json");
  const planPath = await planDownload.path();
  if (!planPath) throw new Error("Playwright did not retain the scenario-gate download");
  const planSource = readFileSync(planPath, "utf8");
  const exactResult = parseDesignResultV2(scenarioV2Result());
  const exactCandidate = exactResult.candidates[0]!;
  expect(planSource).toBe(serializeScenarioGatePlanV2(exactResult, exactCandidate.id));
  const parsedPlan = parseScenarioGatePlanV2(planSource, exactResult);
  expect(parsedPlan.boundaries.simulationAttestation).toBe("none");
  expect(parsedPlan.boundaries.candidateRankingUse).toBe("prohibited");
  expect(parsedPlan.plan.entries.map((entry) => [entry.scenarioId, entry.spiceExportGate])).toEqual([
    ["op", "export_requires_verified_context"],
    ["startup", "no_scenario"],
  ]);

  await openWorkspaceTab(page, "Operating results");
  await startup.click();
  await expect(startup).toHaveAttribute("aria-pressed", "true");
  await expect(operatingPoint).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("No same-ID scenario", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "No executable scenario" })).toBeDisabled();
  await openWorkspaceTab(page, "Export");
  await expect(page.getByRole("button", { name: "Scenario SPICE" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Open in Simulator" })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "Create share URL" }).click();
  await expect.poll(() => new URL(page.url()).hash.startsWith("#d=")).toBe(true);
  await page.reload();
  await expect(page.getByText("Restored a strictly validated electrical result share. It remains structural-only until you explicitly regenerate it with the installed production context.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Regenerate with installed context", exact: true })).toBeEnabled();
  await openWorkspaceTab(page, "Operating results");
  await expect(page.locator('[data-imported-scenario="startup"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".designer-trust-banner")
    .getByText("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
