import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  exportDesignResultCircuitSvgV2,
  exportDesignResultKicadSchematicV2,
  exportDesignResultPrintableReportV2,
  exportDesignResultScenarioSimulationCsvV2,
  exportDesignResultScenarioSpiceV2,
  exportElectricalBomCsvV2,
  createPowerPhysicalImplementationHandoffV1,
  createPowerPhysicalImplementationHandoffV2,
  exportFootprintAssignedPowerKicadSchematicV1,
  exportFootprintAssignedPowerKicadSchematicV2,
  parseDesignResultCircuitSvgV2,
  parseDesignResultKicadSchematicV2,
  parseDesignResultPrintableReportV2,
  parseDesignResultScenarioSimulationCsvV2,
  parsePowerPhysicalImplementationHandoffV1,
  parsePowerPhysicalImplementationHandoffV2,
  serializeDesignResultV2,
  verifyPowerPhysicalImplementationHandoffV1,
  verifyPowerPhysicalImplementationHandoffV2,
} from "@opencircuit/design-export";
import { buildExternalKicadQaArtifactsV1 } from "@opencircuit/design-export/external-kicad-fixtures";
import {
  parseExternalKicadQaReportV1,
  type ExternalKicadQaReportV1,
} from "@opencircuit/design-export/external-kicad-qa";
import {
  getBundledDesignLibraryDocuments,
  type CatalogProfileRefV1,
  type DesignCatalogReleaseV1,
  type DesignProfileAdmissionLedgerV1,
} from "@opencircuit/design-library";
import { MOTOR_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/motor-designer/v2-status";
import { REVIEWED_REAL_MOTOR_CATALOG_REPORT } from "@opencircuit/motor-designer/reviewed-real";
import { POWER_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/power-designer/v2-status";
import { getPowerDesignContextManifestV2 } from "@opencircuit/power-designer/v2";
import {
  REAL_PRIMARY_PART_ADMISSION_GAP_REPORT,
  REAL_PRIMARY_PART_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT,
} from "@opencircuit/power-designer/real-catalog";
import {
  SIMULATION_ENGINE_IDENTITY_V1,
  verifySimulationExecutionReceiptV1,
} from "@opencircuit/sim-engine";
import {
  DIGIKEY_PROVIDER_POLICY_V2,
  MOUSER_PROVIDER_POLICY_V2,
  calculateProviderPolicyManifestV2ContentHash,
  validateProviderPolicyOperationPermissionV2,
} from "@opencircuit/sourcing-core";
import { createSourcingServiceV2 } from "@opencircuit/sourcing-service";
import { parseDesignerRuntimeContractV1 } from "./designer-runtime-audit";
import {
  parseDesignerRuntimeReleaseReceiptV1,
  type DesignerRuntimeReleaseContextV1,
  type DesignerRuntimeReleaseReceiptV1,
} from "./designer-runtime-release-receipt";
import {
  assessDesignerCleanCheckoutReleaseAttachmentV1,
  type DesignerCleanCheckoutAttachmentAssessmentV1,
} from "./clean-checkout-audit";
import { scanDesignerReleaseRepositoryV1 } from "./repository-scan";

export type DesignerReleaseGateStatus = "pass" | "blocked" | "unverified";

export interface DesignerReleaseGateV1 {
  id: string;
  status: DesignerReleaseGateStatus;
  blockers: string[];
  evidence: Record<string, unknown>;
}

export interface DesignerReleaseReadinessReportV1 {
  format: "schemagic-designer-release-readiness";
  schemaVersion: 1;
  target: "Designer V1";
  status: "ready" | "blocked";
  gates: DesignerReleaseGateV1[];
  contentHash: `sha256:${string}`;
}

export interface DesignerRuntimeReleaseAttachmentInputV1 {
  reportBytes: Uint8Array;
  receipt: unknown;
  expectedGithubActionsContext: DesignerRuntimeReleaseContextV1;
}

export interface DesignerExternalKicadQaReleaseAttachmentInputV1 {
  reportBytes: Uint8Array;
}

export interface DesignerCleanCheckoutReleaseAttachmentInputV1 {
  reportBytes: Uint8Array;
}

export interface DesignerReleaseReadinessOptionsV1 {
  runtimeReleaseAttachment?: DesignerRuntimeReleaseAttachmentInputV1;
  externalKicadQaReleaseAttachment?: DesignerExternalKicadQaReleaseAttachmentInputV1;
  cleanCheckoutReleaseAttachment?: DesignerCleanCheckoutReleaseAttachmentInputV1;
}

export type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

interface DataManifestTarget {
  profiles: number;
  manufacturers: number;
}

interface DataManifestPartClass {
  id: string;
  minimum_targets: Partial<Record<"motor" | "power", DataManifestTarget>>;
  review_state: string;
  current_reviewed_profiles: number;
  current_reviewed_manufacturers: number;
}

interface DataManifestOwnership {
  part: { manufacturerId: string; manufacturerPartNumber: string };
  part_class_id: string;
  profile_path: string;
  owning_track: string;
  review_track: string;
  review_state: string;
}

interface DesignerDataManifest {
  schema_version: string;
  manifest_id: string;
  status: string;
  summary: {
    part_class_count: number;
    reviewed_part_classes: number;
    reviewed_profile_count: number;
  };
  part_classes: DataManifestPartClass[];
  exact_mpn_ownership: DataManifestOwnership[];
}

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Release report values must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) result[key] = canonicalValue(nested);
    }
    return result;
  }
  throw new TypeError("Release report values must be JSON-compatible");
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function canonicalDesignerReleaseReadinessPayloadV1(
  report:
    | DeepReadonly<Omit<DesignerReleaseReadinessReportV1, "contentHash">>
    | DeepReadonly<DesignerReleaseReadinessReportV1>,
): string {
  const { contentHash: _contentHash, ...payload } = report as DeepReadonly<DesignerReleaseReadinessReportV1>;
  return JSON.stringify(canonicalValue(payload));
}

export function calculateDesignerReleaseReadinessContentHashV1(
  report:
    | DeepReadonly<Omit<DesignerReleaseReadinessReportV1, "contentHash">>
    | DeepReadonly<DesignerReleaseReadinessReportV1>,
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalDesignerReleaseReadinessPayloadV1(report), "utf8").digest("hex")}`;
}

function repoFile(relativePath: string): string {
  for (const depth of ["../../../", "../../../../"]) {
    const candidate = fileURLToPath(new URL(`${depth}${relativePath}`, import.meta.url));
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Repository file is unavailable: ${relativePath}`);
}

function optionalRepoText(relativePath: string): string {
  try {
    return readFileSync(repoFile(relativePath), "utf8");
  } catch {
    return "";
  }
}

interface GithubWorkflowStepV1 {
  name: string;
  properties: Readonly<Record<string, string>>;
}

interface GithubWorkflowJobV1 {
  id: string;
  properties: Readonly<Record<string, string>>;
  steps: readonly GithubWorkflowStepV1[];
}

function yamlIndentation(line: string): number {
  return line.length - line.trimStart().length;
}

function setUniqueYamlProperty(properties: Record<string, string>, key: string, value: string): void {
  properties[key] = Object.prototype.hasOwnProperty.call(properties, key)
    ? "__duplicate_property__"
    : value;
}

function exactYamlPropertyKeys(properties: Readonly<Record<string, string>>, expected: readonly string[]): boolean {
  const observed = Object.keys(properties).sort();
  const required = [...expected].sort();
  return observed.length === required.length
    && observed.every((key, index) => key === required[index]);
}

function yamlBlockScalar(
  lines: readonly string[],
  startIndex: number,
  propertyIndent: number,
): { value: string; endIndex: number } {
  let endIndex = startIndex + 1;
  while (endIndex < lines.length) {
    const line = lines[endIndex]!;
    if (line.trim().length > 0 && yamlIndentation(line) <= propertyIndent) break;
    endIndex += 1;
  }
  const blockLines = lines.slice(startIndex + 1, endIndex);
  const nonblankIndents = blockLines
    .filter((line) => line.trim().length > 0)
    .map(yamlIndentation);
  if (nonblankIndents.length === 0) return { value: "", endIndex };
  const blockIndent = Math.min(...nonblankIndents);
  if (blockIndent <= propertyIndent) return { value: "__invalid_block_scalar__", endIndex };
  return {
    value: blockLines.map((line) => line.trim().length === 0 ? "" : line.slice(blockIndent)).join("\n").trimEnd(),
    endIndex,
  };
}

function githubWorkflowStepListV1(
  lines: readonly string[],
  startIndex: number,
  endIndex: number,
): GithubWorkflowStepV1[] {
  const steps: GithubWorkflowStepV1[] = [];
  let current: Record<string, string> | null = null;
  let directContainer: string | null = null;
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = lines[index]!;
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
    if (yamlIndentation(line) === 6) {
      const item = /^-\s+([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line.trimStart());
      if (current !== null) steps.push({ name: current.name ?? "", properties: current });
      if (item === null) {
        current = { __unparsed_direct_mapping__: line.trimStart() };
        directContainer = null;
        continue;
      }
      current = {};
      const key = item[1]!;
      const value = item[2] ?? "";
      if (value === "|" || value === ">") {
        const block = yamlBlockScalar(lines, index, 6);
        setUniqueYamlProperty(current, key, value === "|" ? block.value : "__unsupported_folded_block__");
        directContainer = null;
        index = block.endIndex - 1;
      } else {
        setUniqueYamlProperty(current, key, value);
        directContainer = value === "" ? key : null;
      }
      continue;
    }
    if (current === null) continue;
    if (yamlIndentation(line) === 10 && directContainer !== null) {
      const nested = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line.trimStart());
      if (nested === null) {
        setUniqueYamlProperty(current, "__unparsed_direct_mapping__", line.trimStart());
      } else {
        setUniqueYamlProperty(current, `${directContainer}.${nested[1]!}`, nested[2] ?? "");
      }
      continue;
    }
    if (yamlIndentation(line) !== 8) continue;
    const property = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line.trimStart());
    if (property === null) {
      setUniqueYamlProperty(current, "__unparsed_direct_mapping__", line.trimStart());
      directContainer = null;
      continue;
    }
    const key = property[1]!;
    const value = property[2] ?? "";
    if (value === "|" || value === ">") {
      const block = yamlBlockScalar(lines, index, 8);
      setUniqueYamlProperty(current, key, value === "|" ? block.value : "__unsupported_folded_block__");
      directContainer = null;
      index = block.endIndex - 1;
    } else {
      setUniqueYamlProperty(current, key, value);
      directContainer = value === "" ? key : null;
    }
  }
  if (current !== null) steps.push({ name: current.name ?? "", properties: current });
  return steps;
}

function githubWorkflowJobsV1(workflowText: string): GithubWorkflowJobV1[] {
  const lines = workflowText.split(/\r?\n/u);
  const jobsHeaders = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line === "jobs:");
  if (jobsHeaders.length !== 1) return [];
  const jobs: GithubWorkflowJobV1[] = [];
  for (let index = jobsHeaders[0]!.index + 1; index < lines.length;) {
    const line = lines[index]!;
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    const indentation = yamlIndentation(line);
    if (indentation === 0) break;
    const jobHeader = /^  ([A-Za-z][A-Za-z0-9_-]*):\s*$/u.exec(line);
    if (jobHeader === null) {
      index += 1;
      continue;
    }
    const jobStart = index;
    let jobEnd = jobStart + 1;
    while (jobEnd < lines.length) {
      const candidate = lines[jobEnd]!;
      if (candidate.trim().length > 0 && !candidate.trimStart().startsWith("#")
        && yamlIndentation(candidate) <= 2) break;
      jobEnd += 1;
    }
    const properties: Record<string, string> = {};
    const stepsHeaders: number[] = [];
    for (let cursor = jobStart + 1; cursor < jobEnd; cursor += 1) {
      const candidate = lines[cursor]!;
      if (candidate.trim().length === 0 || candidate.trimStart().startsWith("#")
        || yamlIndentation(candidate) !== 4) continue;
      const property = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(candidate.trimStart());
      if (property === null) {
        setUniqueYamlProperty(properties, "__unparsed_direct_mapping__", candidate.trimStart());
        continue;
      }
      const key = property[1]!;
      const value = property[2] ?? "";
      if (key === "steps" && value === "") stepsHeaders.push(cursor);
      else setUniqueYamlProperty(properties, key, value);
    }
    const steps = stepsHeaders.length === 1
      ? githubWorkflowStepListV1(lines, stepsHeaders[0]! + 1, jobEnd)
      : [];
    jobs.push({ id: jobHeader[1]!, properties, steps });
    index = jobEnd;
  }
  return jobs;
}

function workflowTopLevelExecutionControlsAbsentV1(workflowText: string): boolean {
  for (const line of workflowText.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.trimStart().startsWith("#") || yamlIndentation(line) !== 0) continue;
    const property = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line);
    if (property === null || property[1] === "env" || property[1] === "defaults") return false;
  }
  return true;
}

function workflowHasUnfilteredPushAndPullRequestTriggersV1(workflowText: string): boolean {
  const lines = workflowText.split(/\r?\n/u);
  const triggerHeaders = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line === "on:");
  if (triggerHeaders.length !== 1) return false;

  const triggers: Array<{ key: string; value: string }> = [];
  for (let index = triggerHeaders[0]!.index + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
    const indentation = yamlIndentation(line);
    if (indentation === 0) break;
    if (indentation !== 2) return false;
    const property = /^  ([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line);
    if (property === null) return false;
    triggers.push({ key: property[1]!, value: property[2] ?? "" });
  }

  return triggers.length === 2
    && triggers.every(({ value }) => value === "")
    && [...triggers.map(({ key }) => key)].sort().join(",")
      === "pull_request,push";
}

export interface SelectedPassiveCiWiringAssessmentV1 {
  implemented: boolean;
  checks: {
    exactHarnessCommand: boolean;
    workflowExecutionDefaultsAbsent: boolean;
    unfilteredPushAndPullRequestTriggers: boolean;
    uniqueNativeComparisonJob: boolean;
    repositoryCheckout: boolean;
    nodeRuntimeSetup: boolean;
    lockedWorkspaceDependenciesInstalled: boolean;
    comparisonHarnessDependenciesInstalled: boolean;
    nativeRuntimeInstalled: boolean;
    uniqueNativeVersionDetection: boolean;
    orderedNativeComparisonSteps: boolean;
    conditionalBehavioralComparison: boolean;
    hardPersistedArtifactAndCurrentIdentity: boolean;
    conditionalSelectedPassiveNumericalRerun: boolean;
  };
}

export function assessSelectedPassiveCiWiringV1(
  workflowText: string,
  harnessPackageText: string,
): SelectedPassiveCiWiringAssessmentV1 {
  const expectedHarnessCommand = "npm --prefix ../.. run test --workspace=@opencircuit/sim-engine -- test/selected-passive-application-golden.test.ts && npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-passive-application-golden.mjs --verify-persisted-report";
  let harnessPackage: { scripts?: Record<string, unknown> } | null = null;
  try {
    harnessPackage = JSON.parse(harnessPackageText) as { scripts?: Record<string, unknown> };
  } catch {
    harnessPackage = null;
  }
  const jobs = githubWorkflowJobsV1(workflowText);
  const nativeJobs = jobs.filter((job) => job.id === "native-comparison");
  const nativeJob = nativeJobs.length === 1 ? nativeJobs[0] : undefined;
  const steps = nativeJob?.steps ?? [];
  const uniqueStep = (id: string): { step: GithubWorkflowStepV1; index: number } | null => {
    const matches = steps.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.properties.id === id);
    return matches.length === 1 ? matches[0]! : null;
  };
  const namedStep = (name: string): { step: GithubWorkflowStepV1; index: number } | null => {
    const matches = steps.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.name === name);
    return matches.length === 1 ? matches[0]! : null;
  };
  const conditionalExpression = "${{ steps.native-version.outputs.major != '46' }}";
  const repositoryCheckout = namedStep("Check out repository");
  const nodeRuntimeSetup = namedStep("Set up Node.js");
  const workspaceInstall = namedStep("Install locked workspace dependencies");
  const harnessInstall = namedStep("Install comparison harness dependencies");
  const nativeInstall = namedStep("Install Ubuntu ngspice");
  const nativeDetection = uniqueStep("native-version");
  const behavioralComparison = uniqueStep("comparison");
  const hardDetachment = uniqueStep("selected-passive-detachment");
  const numericalRerun = uniqueStep("selected-passive-rerun");
  const expectedNativeInstall = [
    "sudo apt-get update",
    "sudo apt-get install -y ngspice",
    "sudo mkdir -p /opt/homebrew/bin",
    "sudo ln -sf \"$(command -v ngspice)\" /opt/homebrew/bin/ngspice",
  ].join("\n");
  const expectedNativeDetection = [
    "version_output=\"$(ngspice --version 2>&1)\"",
    "printf '%s\\n' \"$version_output\"",
    "major=\"$(printf '%s\\n' \"$version_output\" | grep -Eo 'ngspice-[0-9]+' | head -1 | cut -d- -f2 || true)\"",
    "echo \"major=$major\" >> \"$GITHUB_OUTPUT\"",
    "echo \"text<<EOF\" >> \"$GITHUB_OUTPUT\"",
    "echo \"$version_output\" >> \"$GITHUB_OUTPUT\"",
    "echo \"EOF\" >> \"$GITHUB_OUTPUT\"",
  ].join("\n");
  const orderedIndices = [
    repositoryCheckout?.index,
    nodeRuntimeSetup?.index,
    workspaceInstall?.index,
    harnessInstall?.index,
    nativeInstall?.index,
    nativeDetection?.index,
    behavioralComparison?.index,
    hardDetachment?.index,
    numericalRerun?.index,
  ];
  const checks = {
    exactHarnessCommand: harnessPackage?.scripts?.["test:selected-passive-application-golden"] === expectedHarnessCommand,
    workflowExecutionDefaultsAbsent: workflowTopLevelExecutionControlsAbsentV1(workflowText),
    unfilteredPushAndPullRequestTriggers: workflowHasUnfilteredPushAndPullRequestTriggersV1(workflowText),
    uniqueNativeComparisonJob: nativeJobs.length === 1
      && nativeJob !== undefined
      && exactYamlPropertyKeys(nativeJob.properties, ["name", "runs-on"])
      && nativeJob.properties.name === "Native versus WASM comparison"
      && nativeJob.properties["runs-on"] === "ubuntu-latest"
      && nativeJob.properties.if === undefined,
    repositoryCheckout: repositoryCheckout !== null
      && exactYamlPropertyKeys(repositoryCheckout.step.properties, ["name", "uses"])
      && repositoryCheckout.step.properties.uses === "actions/checkout@v4",
    nodeRuntimeSetup: nodeRuntimeSetup !== null
      && exactYamlPropertyKeys(nodeRuntimeSetup.step.properties, [
        "name", "uses", "with", "with.cache", "with.cache-dependency-path", "with.node-version",
      ])
      && nodeRuntimeSetup.step.properties.uses === "actions/setup-node@v4"
      && nodeRuntimeSetup.step.properties["with.node-version"] === "22"
      && nodeRuntimeSetup.step.properties["with.cache"] === "npm"
      && nodeRuntimeSetup.step.properties["with.cache-dependency-path"] === "tools/native-ngspice-reference/package-lock.json",
    lockedWorkspaceDependenciesInstalled: workspaceInstall !== null
      && exactYamlPropertyKeys(workspaceInstall.step.properties, ["name", "run", "shell"])
      && workspaceInstall.step.properties.if === undefined
      && workspaceInstall.step.properties["continue-on-error"] === undefined
      && workspaceInstall.step.properties.shell === "bash"
      && workspaceInstall.step.properties.run === "npm ci",
    comparisonHarnessDependenciesInstalled: harnessInstall !== null
      && exactYamlPropertyKeys(harnessInstall.step.properties, ["name", "run", "shell"])
      && harnessInstall.step.properties.if === undefined
      && harnessInstall.step.properties["continue-on-error"] === undefined
      && harnessInstall.step.properties.shell === "bash"
      && harnessInstall.step.properties.run === "npm ci --prefix tools/native-ngspice-reference",
    nativeRuntimeInstalled: nativeInstall !== null
      && exactYamlPropertyKeys(nativeInstall.step.properties, ["name", "run", "shell"])
      && nativeInstall.step.properties.if === undefined
      && nativeInstall.step.properties["continue-on-error"] === undefined
      && nativeInstall.step.properties.shell === "bash"
      && nativeInstall.step.properties.run === expectedNativeInstall,
    uniqueNativeVersionDetection: nativeDetection !== null
      && exactYamlPropertyKeys(nativeDetection.step.properties, ["id", "name", "run", "shell"])
      && nativeDetection.step.name === "Detect native ngspice version"
      && nativeDetection.step.properties.if === undefined
      && nativeDetection.step.properties["continue-on-error"] === undefined
      && nativeDetection.step.properties.shell === "bash"
      && nativeDetection.step.properties.run === expectedNativeDetection,
    orderedNativeComparisonSteps: orderedIndices.every((index) => index !== undefined)
      && orderedIndices[0] === 0
      && orderedIndices.every((index, position) => position === 0 || index === orderedIndices[position - 1]! + 1),
    conditionalBehavioralComparison: behavioralComparison !== null
      && exactYamlPropertyKeys(behavioralComparison.step.properties, [
        "continue-on-error", "env", "env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE",
        "id", "name", "run", "shell", "working-directory",
      ])
      && behavioralComparison.step.name === "Run native and WASM comparison and behavioral application-golden suites"
      && behavioralComparison.step.properties.if === undefined
      && behavioralComparison.step.properties.shell === "bash"
      && behavioralComparison.step.properties["continue-on-error"] === conditionalExpression
      && behavioralComparison.step.properties["env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE"] === "${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs"
      && behavioralComparison.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && behavioralComparison.step.properties.run === "node --test test/*.test.mjs && node suite.mjs && npm run test:application-golden",
    hardPersistedArtifactAndCurrentIdentity: hardDetachment !== null
      && exactYamlPropertyKeys(hardDetachment.step.properties, ["id", "if", "name", "run", "shell", "working-directory"])
      && hardDetachment.step.name === "Validate selected-passive persisted artifact and current-production identity"
      && hardDetachment.step.properties.if === "always()"
      && hardDetachment.step.properties["continue-on-error"] === undefined
      && hardDetachment.step.properties.shell === "bash"
      && hardDetachment.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && hardDetachment.step.properties.run === "node --test test/selected-passive-execution-report.test.mjs && npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-passive-application-golden.test.ts",
    conditionalSelectedPassiveNumericalRerun: numericalRerun !== null
      && exactYamlPropertyKeys(numericalRerun.step.properties, [
        "continue-on-error", "env", "env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE",
        "id", "if", "name", "run", "shell", "working-directory",
      ])
      && numericalRerun.step.name === "Rerun selected-passive native and WASM artifact"
      && numericalRerun.step.properties.if === "always()"
      && numericalRerun.step.properties.shell === "bash"
      && numericalRerun.step.properties["continue-on-error"] === conditionalExpression
      && numericalRerun.step.properties["env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE"] === "${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs"
      && numericalRerun.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && numericalRerun.step.properties.run === "npm run test:selected-passive-application-golden",
  };
  return {
    implemented: Object.values(checks).every(Boolean),
    checks,
  };
}

export interface SelectedSemiconductorCiWiringAssessmentV1 {
  implemented: boolean;
  checks: {
    exactHarnessCommand: boolean;
    workflowExecutionDefaultsAbsent: boolean;
    unfilteredPushAndPullRequestTriggers: boolean;
    uniqueNativeComparisonJob: boolean;
    uniqueNativeVersionDetection: boolean;
    selectedPassiveNumericalAnchor: boolean;
    orderedSelectedSemiconductorSteps: boolean;
    hardPersistedArtifactAndProductionIdentity: boolean;
    conditionalSelectedSemiconductorNumericalRerun: boolean;
  };
}

export function assessSelectedSemiconductorCiWiringV1(
  workflowText: string,
  harnessPackageText: string,
): SelectedSemiconductorCiWiringAssessmentV1 {
  const expectedHarnessCommand = "npm --prefix ../.. run test --workspace=@opencircuit/sim-engine -- test/selected-semiconductor-application-golden.test.ts && if [ -f selected-semiconductor-application-golden/contract.json ] && [ -f selected-semiconductor-application-golden/execution-report.json ]; then npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-application-golden.mjs --verify-persisted-report; else echo 'Selected-semiconductor device-model golden unavailable: current external-Motor structural identities exist, but no approved model package, dedicated device-model contract, or execution report is present.'; fi";
  let harnessPackage: { scripts?: Record<string, unknown> } | null = null;
  try {
    harnessPackage = JSON.parse(harnessPackageText) as { scripts?: Record<string, unknown> };
  } catch {
    harnessPackage = null;
  }
  const jobs = githubWorkflowJobsV1(workflowText);
  const nativeJobs = jobs.filter((job) => job.id === "native-comparison");
  const nativeJob = nativeJobs.length === 1 ? nativeJobs[0] : undefined;
  const steps = nativeJob?.steps ?? [];
  const uniqueStep = (id: string): { step: GithubWorkflowStepV1; index: number } | null => {
    const matches = steps.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.properties.id === id);
    return matches.length === 1 ? matches[0]! : null;
  };
  const namedStep = (name: string): { step: GithubWorkflowStepV1; index: number } | null => {
    const matches = steps.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.name === name);
    return matches.length === 1 ? matches[0]! : null;
  };
  const conditionalExpression = "${{ steps.native-version.outputs.major != '46' }}";
  const nativeDetection = uniqueStep("native-version");
  const selectedPassiveRerun = uniqueStep("selected-passive-rerun");
  const hardIdentity = uniqueStep("selected-semiconductor-identity");
  const numericalRerun = uniqueStep("selected-semiconductor-rerun");
  const recordAuthority = namedStep("Record comparison authority");
  const expectedNativeDetection = [
    "version_output=\"$(ngspice --version 2>&1)\"",
    "printf '%s\\n' \"$version_output\"",
    "major=\"$(printf '%s\\n' \"$version_output\" | grep -Eo 'ngspice-[0-9]+' | head -1 | cut -d- -f2 || true)\"",
    "echo \"major=$major\" >> \"$GITHUB_OUTPUT\"",
    "echo \"text<<EOF\" >> \"$GITHUB_OUTPUT\"",
    "echo \"$version_output\" >> \"$GITHUB_OUTPUT\"",
    "echo \"EOF\" >> \"$GITHUB_OUTPUT\"",
  ].join("\n");
  const checks = {
    exactHarnessCommand: harnessPackage?.scripts?.["test:selected-semiconductor-application-golden"] === expectedHarnessCommand,
    workflowExecutionDefaultsAbsent: workflowTopLevelExecutionControlsAbsentV1(workflowText),
    unfilteredPushAndPullRequestTriggers: workflowHasUnfilteredPushAndPullRequestTriggersV1(workflowText),
    uniqueNativeComparisonJob: nativeJobs.length === 1
      && nativeJob !== undefined
      && exactYamlPropertyKeys(nativeJob.properties, ["name", "runs-on"])
      && nativeJob.properties.name === "Native versus WASM comparison"
      && nativeJob.properties["runs-on"] === "ubuntu-latest"
      && nativeJob.properties.if === undefined,
    uniqueNativeVersionDetection: nativeDetection !== null
      && exactYamlPropertyKeys(nativeDetection.step.properties, ["id", "name", "run", "shell"])
      && nativeDetection.step.name === "Detect native ngspice version"
      && nativeDetection.step.properties.if === undefined
      && nativeDetection.step.properties["continue-on-error"] === undefined
      && nativeDetection.step.properties.shell === "bash"
      && nativeDetection.step.properties.run === expectedNativeDetection,
    selectedPassiveNumericalAnchor: selectedPassiveRerun !== null
      && exactYamlPropertyKeys(selectedPassiveRerun.step.properties, [
        "continue-on-error", "env", "env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE",
        "id", "if", "name", "run", "shell", "working-directory",
      ])
      && selectedPassiveRerun.step.name === "Rerun selected-passive native and WASM artifact"
      && selectedPassiveRerun.step.properties.if === "always()"
      && selectedPassiveRerun.step.properties.shell === "bash"
      && selectedPassiveRerun.step.properties["continue-on-error"] === conditionalExpression
      && selectedPassiveRerun.step.properties["env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE"] === "${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs"
      && selectedPassiveRerun.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && selectedPassiveRerun.step.properties.run === "npm run test:selected-passive-application-golden",
    orderedSelectedSemiconductorSteps: selectedPassiveRerun !== null
      && hardIdentity !== null
      && numericalRerun !== null
      && recordAuthority !== null
      && hardIdentity.index === selectedPassiveRerun.index + 1
      && numericalRerun.index === hardIdentity.index + 1
      && recordAuthority.index === numericalRerun.index + 1,
    hardPersistedArtifactAndProductionIdentity: hardIdentity !== null
      && exactYamlPropertyKeys(hardIdentity.step.properties, ["id", "if", "name", "run", "shell", "working-directory"])
      && hardIdentity.step.name === "Validate selected-semiconductor persisted artifact and production identity"
      && hardIdentity.step.properties.if === "always()"
      && hardIdentity.step.properties["continue-on-error"] === undefined
      && hardIdentity.step.properties.shell === "bash"
      && hardIdentity.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && hardIdentity.step.properties.run === "node --test test/selected-semiconductor-execution-report.test.mjs && npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-application-golden.test.ts",
    conditionalSelectedSemiconductorNumericalRerun: numericalRerun !== null
      && exactYamlPropertyKeys(numericalRerun.step.properties, [
        "continue-on-error", "env", "env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE",
        "id", "if", "name", "run", "shell", "working-directory",
      ])
      && numericalRerun.step.name === "Rerun selected-semiconductor native and WASM artifact"
      && numericalRerun.step.properties.if === "always()"
      && numericalRerun.step.properties.shell === "bash"
      && numericalRerun.step.properties["continue-on-error"] === conditionalExpression
      && numericalRerun.step.properties["env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE"] === "${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs"
      && numericalRerun.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && numericalRerun.step.properties.run === "npm run test:selected-semiconductor-application-golden",
  };
  return {
    implemented: Object.values(checks).every(Boolean),
    checks,
  };
}

export interface SelectedSemiconductorRdsonProjectionCiWiringAssessmentV1 {
  implemented: boolean;
  checks: {
    exactHarnessCommand: boolean;
    aggregateHarnessIncludesProjection: boolean;
    workflowExecutionDefaultsAbsent: boolean;
    unfilteredPushAndPullRequestTriggers: boolean;
    uniqueNativeComparisonJob: boolean;
    orderedHardValidationThenConditionalRerun: boolean;
    hardProjectionIdentityAndPersistedReport: boolean;
    conditionalProjectionRerun: boolean;
  };
}

export function assessSelectedSemiconductorRdsonProjectionCiWiringV1(
  workflowText: string,
  harnessPackageText: string,
): SelectedSemiconductorRdsonProjectionCiWiringAssessmentV1 {
  const expectedHarnessCommand = "npm --prefix ../.. run test --workspace=@opencircuit/sim-engine -- test/selected-semiconductor-rdson-projection.test.ts && node --test test/selected-semiconductor-rdson-projection-report.test.mjs && npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-rdson-projection.mjs --verify-persisted-report";
  let harnessPackage: { scripts?: Record<string, unknown> } | null = null;
  try {
    harnessPackage = JSON.parse(harnessPackageText) as { scripts?: Record<string, unknown> };
  } catch {
    harnessPackage = null;
  }
  const jobs = githubWorkflowJobsV1(workflowText);
  const nativeJobs = jobs.filter((job) => job.id === "native-comparison");
  const nativeJob = nativeJobs.length === 1 ? nativeJobs[0] : undefined;
  const steps = nativeJob?.steps ?? [];
  const uniqueStep = (id: string): { step: GithubWorkflowStepV1; index: number } | null => {
    const matches = steps.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.properties.id === id);
    return matches.length === 1 ? matches[0]! : null;
  };
  const hardProjectionValidation = uniqueStep("selected-semiconductor-rdson-projection-identity");
  const projectionRerun = uniqueStep("selected-semiconductor-rdson-projection");
  const conditionalExpression = "${{ steps.native-version.outputs.major != '46' }}";
  const aggregateTest = harnessPackage?.scripts?.test;
  const checks = {
    exactHarnessCommand: harnessPackage?.scripts?.["test:selected-semiconductor-rdson-projection"] === expectedHarnessCommand,
    aggregateHarnessIncludesProjection: typeof aggregateTest === "string"
      && aggregateTest.endsWith("&& npm run test:selected-semiconductor-rdson-projection"),
    workflowExecutionDefaultsAbsent: workflowTopLevelExecutionControlsAbsentV1(workflowText),
    unfilteredPushAndPullRequestTriggers: workflowHasUnfilteredPushAndPullRequestTriggersV1(workflowText),
    uniqueNativeComparisonJob: nativeJobs.length === 1
      && nativeJob !== undefined
      && exactYamlPropertyKeys(nativeJob.properties, ["name", "runs-on"])
      && nativeJob.properties.name === "Native versus WASM comparison"
      && nativeJob.properties["runs-on"] === "ubuntu-latest"
      && nativeJob.properties.if === undefined,
    orderedHardValidationThenConditionalRerun: hardProjectionValidation !== null
      && projectionRerun !== null
      && projectionRerun.index === hardProjectionValidation.index + 1,
    hardProjectionIdentityAndPersistedReport: hardProjectionValidation !== null
      && exactYamlPropertyKeys(hardProjectionValidation.step.properties, [
        "id", "if", "name", "run", "shell", "working-directory",
      ])
      && hardProjectionValidation.step.name === "Validate ideal reviewed-RDS(on) projection identity and persisted report"
      && hardProjectionValidation.step.properties.if === "always()"
      && hardProjectionValidation.step.properties["continue-on-error"] === undefined
      && hardProjectionValidation.step.properties.shell === "bash"
      && hardProjectionValidation.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && hardProjectionValidation.step.properties.run === "npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-rdson-projection.test.ts && node --test test/selected-semiconductor-rdson-projection-report.test.mjs",
    conditionalProjectionRerun: projectionRerun !== null
      && exactYamlPropertyKeys(projectionRerun.step.properties, [
        "continue-on-error", "env", "env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE",
        "id", "if", "name", "run", "shell", "working-directory",
      ])
      && projectionRerun.step.name === "Rerun ideal reviewed-RDS(on) projection"
      && projectionRerun.step.properties.if === "always()"
      && projectionRerun.step.properties.shell === "bash"
      && projectionRerun.step.properties["continue-on-error"] === conditionalExpression
      && projectionRerun.step.properties["working-directory"] === "tools/native-ngspice-reference"
      && projectionRerun.step.properties["env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE"] === "${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs"
      && projectionRerun.step.properties.run === "npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-rdson-projection.mjs --verify-persisted-report",
  };
  return {
    implemented: Object.values(checks).every(Boolean),
    checks,
  };
}

export interface SelectedSemiconductorRdsonProjectionExecutableEvidenceAssessmentV1 {
  implemented: boolean;
  checks: {
    exactIdentityTestContentHash: boolean;
    exactReportTestContentHash: boolean;
    exactRunnerContentHash: boolean;
    activeCurrentIdentityTestSuite: boolean;
    activePersistedReportTamperTests: boolean;
    executableRunnerMain: boolean;
  };
  sourceContentHashes: {
    expected: { identityTest: `sha256:${string}`; reportTest: `sha256:${string}`; runner: `sha256:${string}` };
    actual: { identityTest: `sha256:${string}`; reportTest: `sha256:${string}`; runner: `sha256:${string}` };
  };
}

function directCallV1(
  statement: ts.Statement,
  name: string,
  title?: string,
): ts.CallExpression | null {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return null;
  const call = statement.expression;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== name) return null;
  const firstArgument = call.arguments[0];
  if (title !== undefined && (firstArgument === undefined || !ts.isStringLiteral(firstArgument) || firstArgument.text !== title)) return null;
  return call;
}

function directNamedTestCallsV1(statements: readonly ts.Statement[], name: string, title: string): ts.CallExpression[] {
  return statements
    .map((statement) => directCallV1(statement, name, title))
    .filter((call): call is ts.CallExpression => call !== null);
}

function testCallbackV1(call: ts.CallExpression | undefined): ts.ArrowFunction | ts.FunctionExpression | null {
  const callback = call?.arguments[1];
  return callback !== undefined && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
    ? callback
    : null;
}

function staticBooleanV1(expression: ts.Expression): boolean | undefined {
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isParenthesizedExpression(expression)) return staticBooleanV1(expression.expression);
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = staticBooleanV1(expression.operand);
    return operand === undefined ? undefined : !operand;
  }
  if (ts.isBinaryExpression(expression)) {
    const left = staticBooleanV1(expression.left);
    if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      if (left === false) return false;
      return left === true ? staticBooleanV1(expression.right) : undefined;
    }
    if (expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      if (left === true) return true;
      return left === false ? staticBooleanV1(expression.right) : undefined;
    }
  }
  return undefined;
}

function statementUnconditionallyExitsV1(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) {
    return statement.statements.some((entry) => statementUnconditionallyExitsV1(entry));
  }
  if (ts.isIfStatement(statement)) {
    const condition = staticBooleanV1(statement.expression);
    if (condition === true) return statementUnconditionallyExitsV1(statement.thenStatement);
    if (condition === false) return statement.elseStatement !== undefined
      && statementUnconditionallyExitsV1(statement.elseStatement);
    return statement.elseStatement !== undefined
      && statementUnconditionallyExitsV1(statement.thenStatement)
      && statementUnconditionallyExitsV1(statement.elseStatement);
  }
  return false;
}

function reachableSubtreeHasCallV1(node: ts.Node | null, expectedName: string): boolean {
  if (node === null) return false;
  let found = false;
  const visitStatements = (statements: readonly ts.Statement[]): void => {
    for (const statement of statements) {
      visit(statement);
      if (found || statementUnconditionallyExitsV1(statement)) return;
    }
  };
  const visit = (entry: ts.Node): void => {
    if (found) return;
    if (ts.isBlock(entry)) {
      visitStatements(entry.statements);
      return;
    }
    if (ts.isIfStatement(entry)) {
      visit(entry.expression);
      if (found) return;
      const condition = staticBooleanV1(entry.expression);
      if (condition !== false) visit(entry.thenStatement);
      if (!found && condition !== true && entry.elseStatement !== undefined) visit(entry.elseStatement);
      return;
    }
    if (ts.isWhileStatement(entry)) {
      visit(entry.expression);
      if (!found && staticBooleanV1(entry.expression) !== false) visit(entry.statement);
      return;
    }
    if (ts.isForStatement(entry)) {
      if (entry.initializer !== undefined) visit(entry.initializer);
      if (!found && entry.condition !== undefined) visit(entry.condition);
      if (!found && (entry.condition === undefined || staticBooleanV1(entry.condition) !== false)) visit(entry.statement);
      if (!found && entry.incrementor !== undefined) visit(entry.incrementor);
      return;
    }
    if (ts.isConditionalExpression(entry)) {
      visit(entry.condition);
      if (found) return;
      const condition = staticBooleanV1(entry.condition);
      if (condition !== false) visit(entry.whenTrue);
      if (!found && condition !== true) visit(entry.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(entry)) {
      visit(entry.left);
      if (found) return;
      const left = staticBooleanV1(entry.left);
      if (entry.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && left === false) return;
      if (entry.operatorToken.kind === ts.SyntaxKind.BarBarToken && left === true) return;
      visit(entry.right);
      return;
    }
    if (ts.isCallExpression(entry)) {
      const name = ts.isIdentifier(entry.expression)
        ? entry.expression.text
        : ts.isPropertyAccessExpression(entry.expression) && ts.isIdentifier(entry.expression.expression)
          ? `${entry.expression.expression.text}.${entry.expression.name.text}`
          : null;
      if (name === expectedName) {
        found = true;
        return;
      }
    }
    ts.forEachChild(entry, visit);
  };
  visit(node);
  return found;
}

function directAwaitedCallV1(statement: ts.Statement, name: string): boolean {
  if (!ts.isExpressionStatement(statement) || !ts.isAwaitExpression(statement.expression)) return false;
  const call = statement.expression.expression;
  return ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === name;
}

function directMainCatchInvocationV1(statement: ts.Statement): boolean {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false;
  const catchCall = statement.expression;
  if (!ts.isPropertyAccessExpression(catchCall.expression) || catchCall.expression.name.text !== "catch") return false;
  const mainCall = catchCall.expression.expression;
  return ts.isCallExpression(mainCall)
    && ts.isIdentifier(mainCall.expression)
    && mainCall.expression.text === "main"
    && mainCall.arguments.length === 0;
}

export function assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
  identityTestText: string,
  reportTestText: string,
  runnerText: string,
): SelectedSemiconductorRdsonProjectionExecutableEvidenceAssessmentV1 {
  const expectedSourceContentHashes = {
    identityTest: "sha256:1345107849bc4684bce0e42e907b50710af2ed6101b2a2e506e8015520a24c68",
    reportTest: "sha256:5dfecf3c77792cceeb011c9dbab63e1f84feedb4887fecdef14204d41d2ef711",
    runner: "sha256:5b360aa72d7f409b05cf39c858891a2b3b78f5d796a059e10ccb6184d24d1380",
  } as const;
  const hashSource = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
  const actualSourceContentHashes = {
    identityTest: hashSource(identityTestText),
    reportTest: hashSource(reportTestText),
    runner: hashSource(runnerText),
  };
  const identitySource = ts.createSourceFile("selected-semiconductor-rdson-projection.test.ts", identityTestText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const reportSource = ts.createSourceFile("selected-semiconductor-rdson-projection-report.test.mjs", reportTestText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const runnerSource = ts.createSourceFile("selected-semiconductor-rdson-projection.mjs", runnerText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const suiteTitle = "current selected-semiconductor ideal reviewed-RDS(on) projection";
  const suites = identitySource.statements
    .map((statement) => directCallV1(statement, "describe", suiteTitle))
    .filter((call): call is ts.CallExpression => call !== null);
  const suiteCallback = suites.length === 1 ? suites[0]!.arguments[1] : undefined;
  const suiteStatements = suiteCallback !== undefined
    && (ts.isArrowFunction(suiteCallback) || ts.isFunctionExpression(suiteCallback))
    && ts.isBlock(suiteCallback.body)
    ? suiteCallback.body.statements
    : [];
  const bindingCalls = directNamedTestCallsV1(
    suiteStatements,
    "it",
    "binds only the reviewed maximum resistance, its exact conditions, and four ideal resistor instances",
  );
  const identityCalls = directNamedTestCallsV1(
    suiteStatements,
    "it",
    "regenerates the exact current ineligible candidate and selected quantity without adding simulation authority",
  );
  const bindingCallback = testCallbackV1(bindingCalls.length === 1 ? bindingCalls[0] : undefined);
  const identityCallback = testCallbackV1(identityCalls.length === 1 ? identityCalls[0] : undefined);
  const persistedReportCalls = directNamedTestCallsV1(
    reportSource.statements,
    "test",
    "strictly validates the persisted ideal reviewed-RDS(on) projection",
  );
  const reportTamperCalls = directNamedTestCallsV1(
    reportSource.statements,
    "test",
    "rejects projection identity, quantity, evidence, receipt, numerical, and claim drift",
  );
  const contractTamperCalls = directNamedTestCallsV1(
    reportSource.statements,
    "test",
    "strictly validates the reviewed profile and ideal-resistor contract on the persisted path",
  );
  const executionIdentityCalls = directNamedTestCallsV1(
    reportSource.statements,
    "test",
    "binds every persisted browser-WASM voltage and receipt field compared with a fresh run",
  );
  const persistedReportCallback = testCallbackV1(persistedReportCalls.length === 1 ? persistedReportCalls[0] : undefined);
  const reportTamperCallback = testCallbackV1(reportTamperCalls.length === 1 ? reportTamperCalls[0] : undefined);
  const contractTamperCallback = testCallbackV1(contractTamperCalls.length === 1 ? contractTamperCalls[0] : undefined);
  const executionIdentityCallback = testCallbackV1(executionIdentityCalls.length === 1 ? executionIdentityCalls[0] : undefined);
  const mainDeclarations = runnerSource.statements.filter((statement): statement is ts.FunctionDeclaration => (
    ts.isFunctionDeclaration(statement) && statement.name?.text === "main"
  ));
  const mainEntrypoints = runnerSource.statements.filter((statement): statement is ts.IfStatement => (
    ts.isIfStatement(statement)
      && ts.isIdentifier(statement.expression)
      && statement.expression.text === "isMain"
      && ts.isBlock(statement.thenStatement)
      && statement.thenStatement.statements.some(directMainCatchInvocationV1)
      && statement.elseStatement === undefined
  ));
  const mainBody = mainDeclarations.length === 1 ? mainDeclarations[0]!.body : undefined;
  const mainStatements = mainBody?.statements ?? [];
  const projectionRunIndices = mainStatements.flatMap((statement, index) => {
    if (!ts.isVariableStatement(statement)) return [];
    const directRun = statement.declarationList.declarations.some((declaration) => {
      const initializer = declaration.initializer;
      return initializer !== undefined
        && ts.isAwaitExpression(initializer)
        && ts.isCallExpression(initializer.expression)
        && ts.isIdentifier(initializer.expression.expression)
        && initializer.expression.expression.text === "runSelectedSemiconductorRdsonProjection"
        && initializer.expression.arguments.length === 0;
    });
    return directRun ? [index] : [];
  });
  const persistedVerificationPaths = mainStatements.flatMap((statement, index) => {
    if (!ts.isIfStatement(statement)
      || statement.expression.getText(runnerSource) !== 'args[0] === "--verify-persisted-report"'
      || !ts.isBlock(statement.thenStatement)
      || statement.elseStatement !== undefined) return [];
    const verificationIndices = statement.thenStatement.statements.flatMap((entry, nestedIndex) => (
      directAwaitedCallV1(entry, "verifyPersistedExecutionReport") ? [nestedIndex] : []
    ));
    if (verificationIndices.length !== 1) return [];
    const verificationIndex = verificationIndices[0]!;
    if (statement.thenStatement.statements.slice(0, verificationIndex).some(statementUnconditionallyExitsV1)) return [];
    return [{ index }];
  });
  const orderedReachableMainPath = projectionRunIndices.length === 1
    && persistedVerificationPaths.length === 1
    && projectionRunIndices[0]! < persistedVerificationPaths[0]!.index
    && !mainStatements.slice(0, projectionRunIndices[0]).some(statementUnconditionallyExitsV1)
    && !mainStatements.slice(projectionRunIndices[0]! + 1, persistedVerificationPaths[0]!.index)
      .some(statementUnconditionallyExitsV1);
  const checks = {
    exactIdentityTestContentHash: actualSourceContentHashes.identityTest === expectedSourceContentHashes.identityTest,
    exactReportTestContentHash: actualSourceContentHashes.reportTest === expectedSourceContentHashes.reportTest,
    exactRunnerContentHash: actualSourceContentHashes.runner === expectedSourceContentHashes.runner,
    activeCurrentIdentityTestSuite: suites.length === 1
      && bindingCalls.length === 1
      && identityCalls.length === 1
      && reachableSubtreeHasCallV1(bindingCallback, "expect")
      && reachableSubtreeHasCallV1(identityCallback, "currentExternalMotorObservation")
      && reachableSubtreeHasCallV1(identityCallback, "expect"),
    activePersistedReportTamperTests: persistedReportCalls.length === 1
      && reportTamperCalls.length === 1
      && contractTamperCalls.length === 1
      && executionIdentityCalls.length === 1
      && reachableSubtreeHasCallV1(persistedReportCallback, "validateSelectedSemiconductorRdsonProjectionReport")
      && reachableSubtreeHasCallV1(reportTamperCallback, "assert.throws")
      && reachableSubtreeHasCallV1(reportTamperCallback, "validateSelectedSemiconductorRdsonProjectionReport")
      && reachableSubtreeHasCallV1(contractTamperCallback, "assert.throws")
      && reachableSubtreeHasCallV1(contractTamperCallback, "validateSelectedSemiconductorRdsonProjectionContract")
      && reachableSubtreeHasCallV1(contractTamperCallback, "validateSelectedSemiconductorRdsonProjectionReport")
      && reachableSubtreeHasCallV1(executionIdentityCallback, "assert.notDeepEqual")
      && reachableSubtreeHasCallV1(executionIdentityCallback, "selectedSemiconductorRdsonProjectionExecutionIdentity"),
    executableRunnerMain: mainDeclarations.length === 1
      && mainEntrypoints.length === 1
      && orderedReachableMainPath,
  };
  return {
    implemented: Object.values(checks).every(Boolean),
    checks,
    sourceContentHashes: {
      expected: expectedSourceContentHashes,
      actual: actualSourceContentHashes,
    },
  };
}

function propertyName(node: ts.PropertyName): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isIdentifier(node)) return node.text;
  return undefined;
}

function duplicateJsonKeys(source: ts.JsonSourceFile): string[] {
  const issues: string[] = [];
  const visit = (node: ts.Node, path: string): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set<string>();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyName(property.name);
        if (name === undefined) continue;
        const childPath = `${path}.${name}`;
        if (seen.has(name)) issues.push(`duplicate_json_key:${childPath}`);
        seen.add(name);
        visit(property.initializer, childPath);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => visit(element, `${path}[${index}]`));
    }
  };
  const statement = source.statements[0];
  if (statement !== undefined && ts.isExpressionStatement(statement)) visit(statement.expression, "$" );
  return issues;
}

function manifestDocument(): { manifest: DesignerDataManifest | null; issues: string[] } {
  const path = repoFile("docs/designer-v1-data-manifest.json");
  const text = readFileSync(path, "utf8");
  const source = ts.parseJsonText(path, text);
  const parseDiagnostics = (source as ts.JsonSourceFile & {
    parseDiagnostics?: readonly ts.Diagnostic[];
  }).parseDiagnostics ?? [];
  const issues = [
    ...parseDiagnostics.map((diagnostic) => `json_syntax:${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`),
    ...duplicateJsonKeys(source),
  ];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { manifest: null, issues: [...new Set(issues)].sort() }; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    issues.push("manifest_root_not_object");
    return { manifest: null, issues: [...new Set(issues)].sort() };
  }
  const manifest = parsed as DesignerDataManifest;
  if (manifest.schema_version !== "1.0.0") issues.push("manifest_schema_version_mismatch");
  if (!Array.isArray(manifest.part_classes)) issues.push("manifest_part_classes_missing");
  if (!Array.isArray(manifest.exact_mpn_ownership)) issues.push("manifest_ownership_missing");
  if (!manifest.summary || manifest.summary.part_class_count !== manifest.part_classes?.length) {
    issues.push("manifest_part_class_count_mismatch");
  }
  if (!manifest.summary || manifest.summary.reviewed_part_classes
    !== manifest.part_classes?.filter((entry) => entry.review_state === "reviewed").length) {
    issues.push("manifest_reviewed_part_class_count_mismatch");
  }
  const classIds = manifest.part_classes?.map((entry) => entry.id) ?? [];
  if (new Set(classIds).size !== classIds.length) issues.push("manifest_duplicate_part_class");
  const ownershipKeys = (manifest.exact_mpn_ownership ?? []).map((entry) => JSON.stringify([
    entry.part?.manufacturerId,
    entry.part?.manufacturerPartNumber,
  ]));
  if (new Set(ownershipKeys).size !== ownershipKeys.length) issues.push("manifest_duplicate_exact_mpn_ownership");
  if ((manifest.exact_mpn_ownership ?? []).some((entry) => entry.owning_track === entry.review_track)) {
    issues.push("manifest_non_independent_review_assignment");
  }
  return { manifest, issues: [...new Set(issues)].sort() };
}

function gate(
  id: string,
  status: DesignerReleaseGateStatus,
  blockers: readonly string[],
  evidence: Record<string, unknown>,
): DesignerReleaseGateV1 {
  return {
    id,
    status,
    blockers: [...new Set(blockers)].sort(),
    evidence: canonicalValue(evidence) as Record<string, unknown>,
  };
}

function manifestGate(
  manifest: DesignerDataManifest | null,
  syntaxIssues: readonly string[],
  admission: DesignProfileAdmissionLedgerV1,
): DesignerReleaseGateV1 {
  const blockers = [...syntaxIssues];
  const admissionKeys = new Set(admission.entries.map((entry) => JSON.stringify([
    entry.partClass,
    entry.part.manufacturerId,
    entry.part.manufacturerPartNumber,
    entry.profilePath,
    entry.ownerTrack,
    entry.reviewerTrack,
    entry.state,
  ])));
  const missingOwnership = manifest?.exact_mpn_ownership.filter((entry) => !admissionKeys.has(JSON.stringify([
    entry.part_class_id,
    entry.part.manufacturerId,
    entry.part.manufacturerPartNumber,
    entry.profile_path,
    entry.owning_track,
    entry.review_track,
    entry.review_state,
  ]))) ?? [];
  blockers.push(...missingOwnership.map((entry) => `ownership_not_reserved:${entry.part.manufacturerId}:${entry.part.manufacturerPartNumber}`));
  return gate("contract.data-manifest", blockers.length === 0 ? "pass" : "blocked", blockers, {
    manifestId: manifest?.manifest_id ?? null,
    manifestStatus: manifest?.status ?? null,
    partClassCount: manifest?.part_classes.length ?? null,
    exactMpnOwnershipCount: manifest?.exact_mpn_ownership.length ?? null,
    admissionEntryCount: admission.entries.length,
  });
}

function catalogGate(
  manifest: DesignerDataManifest | null,
  release: DesignCatalogReleaseV1,
): DesignerReleaseGateV1 {
  const refs = release.profiles as CatalogProfileRefV1[];
  const blockers: string[] = [];
  const reviewedPartClassCount = new Set(refs.map((ref) => ref.partClass)).size;
  if (manifest !== null) {
    if (manifest.summary.reviewed_profile_count !== refs.length) {
      blockers.push(`manifest_reviewed_profile_count_drift:${manifest.summary.reviewed_profile_count}/${refs.length}`);
    }
    if (manifest.summary.reviewed_part_classes !== reviewedPartClassCount) {
      blockers.push(`manifest_reviewed_part_class_count_drift:${manifest.summary.reviewed_part_classes}/${reviewedPartClassCount}`);
    }
  }
  for (const partClass of manifest?.part_classes ?? []) {
    const classRefs = refs.filter((ref) => ref.partClass === partClass.id);
    const manufacturers = new Set(classRefs.map((ref) => ref.part.manufacturerId)).size;
    if (partClass.current_reviewed_profiles !== classRefs.length) {
      blockers.push(`manifest_part_class_profile_count_drift:${partClass.id}:${partClass.current_reviewed_profiles}/${classRefs.length}`);
    }
    if (partClass.current_reviewed_manufacturers !== manufacturers) {
      blockers.push(`manifest_part_class_manufacturer_count_drift:${partClass.id}:${partClass.current_reviewed_manufacturers}/${manufacturers}`);
    }
    for (const [application, target] of Object.entries(partClass.minimum_targets)) {
      if (target === undefined) continue;
      if (classRefs.length < target.profiles) {
        blockers.push(`catalog_target:${application}:${partClass.id}:profiles:${classRefs.length}/${target.profiles}`);
      }
      if (manufacturers < target.manufacturers) {
        blockers.push(`catalog_target:${application}:${partClass.id}:manufacturers:${manufacturers}/${target.manufacturers}`);
      }
    }
  }
  return gate("catalog.reviewed-release", blockers.length === 0 ? "pass" : "blocked", blockers, {
    catalogVersion: release.version,
    catalogContentHash: release.contentHash,
    admittedProfileCount: refs.length,
    admittedManufacturerCount: new Set(refs.map((ref) => ref.part.manufacturerId)).size,
    admittedPartClassCount: reviewedPartClassCount,
    manifestCountsMatchCatalogRelease: blockers.every((blocker) => !blocker.startsWith("manifest_")),
  });
}

function productionContextGate(
  id: string,
  status: typeof MOTOR_DESIGN_V2_PRODUCTION_STATUS | typeof POWER_DESIGN_V2_PRODUCTION_STATUS,
): DesignerReleaseGateV1 {
  const contextReady = (status.status as string) === "ready";
  const blockers = contextReady ? [] : [
    `production_status:${status.reason}`,
    ...status.diagnostics,
  ];
  return gate(id, contextReady ? "pass" : "blocked", blockers, {
    contextStatus: status.status,
    reason: status.reason,
    catalogVersion: status.catalogVersion,
    catalogProfileCount: status.catalogProfileCount,
    reviewedProfileCount: status.reviewedProfileCount,
    compatibleProfileCount: status.compatibleProfileCount,
    installedRecipeSet: status.installedRecipeSet,
    factsV2RecipeInstalled: status.factsV2RecipeInstalled,
    installedReadyRecipeIds: status.readyRecipeIds,
    recipeReadiness: status.recipeReadiness.map((recipe) => ({
      recipeId: recipe.recipeId,
      recipeVersion: recipe.recipeVersion,
      recognizedContract: recipe.recognizedContract,
      ...("releaseEligible" in recipe ? { releaseEligible: recipe.releaseEligible } : {}),
      ready: recipe.ready,
    })),
    strictCandidateReadiness: "not_established_by_context_snapshot",
    claimBoundary: "Pass means only that the reviewed catalog and required native recipe identities form a hash-verified executable generation context. It does not by itself establish a strict-default candidate, circuit connectivity, or selected-part simulation fidelity; those outcomes require separate evidence.",
  });
}

function motorEvidenceGate(): DesignerReleaseGateV1 {
  const report = REVIEWED_REAL_MOTOR_CATALOG_REPORT;
  const blockers = [
    ...report.missingSourceHashes.map((sourceId) => `missing_source_bytes:${sourceId}`),
    ...report.coverageRequirementGaps.applicationEnvelope.map((message) => `application_envelope:${message}`),
    ...report.coverageRequirementGaps.integratedBridges.map((message) => `integrated_coverage:${message}`),
    ...report.coverageRequirementGaps.gateDrivers.map((message) => `gate_driver_coverage:${message}`),
    ...report.sharedProfileGaps.map((message) => `shared_profile_gap:${message}`),
  ];
  if (report.totals.catalogAdmittedProfiles === 0 && MOTOR_DESIGN_V2_PRODUCTION_STATUS.status !== "ready") {
    blockers.push("independent_profile_review_and_admission_pending");
  }
  return gate("motor.primary-evidence", blockers.length === 0 ? "pass" : "blocked", blockers, {
    authoredProfileCount: report.totals.profiles,
    manufacturerCount: report.totals.manufacturers,
    missingSourceHashCount: report.totals.missingSourceHashCount,
    sourceHashCompleteProfiles: report.totals.sourceHashCompleteProfiles,
    catalogAdmittedProfiles: report.totals.catalogAdmittedProfiles,
    generatorEligibleProfiles: report.totals.generatorEligibleProfiles,
    integratedBridgeCurrentBoundary: report.coverageBoundaries.integratedBridges,
    remainingSharedProfileGapCount: report.sharedProfileGaps.length,
    sharedProfileCoverage: {
      bootstrapCapacitors: {
        factCoverageSatisfied: report.sharedProfileCoverage.bootstrapCapacitors.factCoverageSatisfied,
        roleAuthority: report.sharedProfileCoverage.bootstrapCapacitors.roleAuthority,
        satisfied: report.sharedProfileCoverage.bootstrapCapacitors.satisfied,
        profileIds: report.sharedProfileCoverage.bootstrapCapacitors.profiles.map((profile) => profile.profileId),
        profileContentHashes: report.sharedProfileCoverage.bootstrapCapacitors.profiles.map((profile) => profile.profileContentHash),
        recipeIds: [...new Set(report.sharedProfileCoverage.bootstrapCapacitors.profiles
          .flatMap((profile) => profile.generatorEnumerationRecipes.map((recipe) => recipe.recipeId)))].sort(),
        dataKey: "bootstrapProfileId",
        quantityPerAssembly: 2,
        nominalFloorF: 0.1e-6,
        nominalFloorStatus: "source_bound_pass",
        applicationAdequacy: "unknown",
      },
      localDecouplingCapacitors: {
        factCoverageSatisfied: report.sharedProfileCoverage.localDecouplingCapacitors.factCoverageSatisfied,
        roleAuthority: report.sharedProfileCoverage.localDecouplingCapacitors.roleAuthority,
        satisfied: report.sharedProfileCoverage.localDecouplingCapacitors.satisfied,
        profileIds: report.sharedProfileCoverage.localDecouplingCapacitors.profiles.map((profile) => profile.profileId),
        profileContentHashes: report.sharedProfileCoverage.localDecouplingCapacitors.profiles.map((profile) => profile.profileContentHash),
        recipeIds: [...new Set(report.sharedProfileCoverage.localDecouplingCapacitors.profiles
          .flatMap((profile) => profile.generatorEnumerationRecipes.map((recipe) => recipe.recipeId)))].sort(),
        dataKey: "localProfileId",
        quantityPerAssembly: 1,
        nominalFloorF: 1e-6,
        nominalFloorStatus: "source_bound_pass",
        applicationAdequacy: "unknown",
      },
      currentShunts: {
        factCoverageSatisfied: report.sharedProfileCoverage.currentShunts.factCoverageSatisfied,
        roleAuthority: report.sharedProfileCoverage.currentShunts.roleAuthority,
        satisfied: report.sharedProfileCoverage.currentShunts.satisfied,
        profileIds: report.sharedProfileCoverage.currentShunts.profiles.map((profile) => profile.profileId),
        recipeIds: [...new Set(report.sharedProfileCoverage.currentShunts.profiles
          .flatMap((profile) => profile.generatorEnumerationRecipes.map((recipe) => recipe.recipeId)))].sort(),
      },
      seriesGateResistors: {
        factCoverageSatisfied: report.sharedProfileCoverage.seriesGateResistors.factCoverageSatisfied,
        roleAuthority: report.sharedProfileCoverage.seriesGateResistors.roleAuthority,
        satisfied: report.sharedProfileCoverage.seriesGateResistors.satisfied,
        profileIds: report.sharedProfileCoverage.seriesGateResistors.profiles.map((profile) => profile.profileId),
        recipeIds: [...new Set(report.sharedProfileCoverage.seriesGateResistors.profiles
          .flatMap((profile) => profile.generatorEnumerationRecipes.map((recipe) => recipe.recipeId)))].sort(),
      },
      pulldownResistors: {
        factCoverageSatisfied: report.sharedProfileCoverage.pulldownResistors.factCoverageSatisfied,
        roleAuthority: report.sharedProfileCoverage.pulldownResistors.roleAuthority,
        satisfied: report.sharedProfileCoverage.pulldownResistors.satisfied,
        profileIds: report.sharedProfileCoverage.pulldownResistors.profiles.map((profile) => profile.profileId),
        recipeIds: [...new Set(report.sharedProfileCoverage.pulldownResistors.profiles
          .flatMap((profile) => profile.generatorEnumerationRecipes.map((recipe) => recipe.recipeId)))].sort(),
      },
    },
    productionContextContractSatisfied: MOTOR_DESIGN_V2_PRODUCTION_STATUS.status === "ready",
  });
}

function powerEvidenceGate(): DesignerReleaseGateV1 {
  const report = REAL_PRIMARY_PART_ADMISSION_GAP_REPORT;
  const draftAssessment = REAL_PRIMARY_PART_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT;
  const selectedBlockerCounts = Object.fromEntries([...new Set(draftAssessment.selectedProfileBlockers.map((entry) => entry.code))]
    .sort()
    .map((code) => [code, draftAssessment.selectedProfileBlockers.filter((entry) => entry.code === code).length]));
  const blockers = [
    ...report.admissionBlockers.missingExactMpnOwnership.map((entry) => `ownership:${entry.profileId}`),
    ...report.admissionBlockers.missingSourceContentHashes.map((entry) => `missing_source_bytes:${entry.sourceId}`),
    ...report.admissionBlockers.factsV2ProfileAuthoring.map((entry) => `facts_v2:${entry.profileId}:${entry.code}`),
    ...report.coverageGaps.map((entry) => `coverage:${entry.code}:${entry.message}`),
  ];
  if (report.admissionEligibleProfileCount === 0 && POWER_DESIGN_V2_PRODUCTION_STATUS.status !== "ready") {
    blockers.push("independent_profile_review_and_admission_pending");
  }
  return gate("power.primary-evidence", blockers.length === 0 ? "pass" : "blocked", blockers, {
    authoredProfileCount: report.profileCount,
    manufacturerCount: report.manufacturerCount,
    admissionEligibleProfileCount: report.admissionEligibleProfileCount,
    admissionBlockerCount: report.admissionBlockerCount,
    missingSourceHashCount: report.admissionBlockers.missingSourceContentHashes.length,
    factsV2AuthoringGapCount: report.admissionBlockers.factsV2ProfileAuthoring.length,
    factsV2AuthoringAssessmentCount: report.factsV2AuthoringAssessments.length,
    factsV2ReviewedReleaseReconciliations: report.factsV2ReviewedReleaseReconciliations.map((reconciliation) => ({
      status: reconciliation.status,
      scope: reconciliation.scope,
      failures: reconciliation.failures,
      evidence: reconciliation.evidence,
    })),
    productionContextContractSatisfied: POWER_DESIGN_V2_PRODUCTION_STATUS.status === "ready",
    draftAuthoringAssessment: {
      decision: draftAssessment.decision,
      evaluatedProfileCount: draftAssessment.evaluatedProfileIds.length,
      selectedProfileId: draftAssessment.selectedProfileId,
      selectedScore: draftAssessment.selectedScore,
      selectedBlockerCounts,
      authorableProfileCount: draftAssessment.authorableProfileCount,
      independentReviewState: draftAssessment.independentReviewState,
      admissionState: draftAssessment.admissionState,
      draft: draftAssessment.draft,
    },
  });
}

function providerGate(
  id: string,
  policy: typeof DIGIKEY_PROVIDER_POLICY_V2 | typeof MOUSER_PROVIDER_POLICY_V2,
): DesignerReleaseGateV1 {
  const contentHashValid = policy.contentHash === calculateProviderPolicyManifestV2ContentHash(policy);
  const operationPermissionIssues = {
    publicHosted: validateProviderPolicyOperationPermissionV2(policy, "public_hosted"),
    selfHosted: validateProviderPolicyOperationPermissionV2(policy, "self_hosted"),
  };
  const blockers = [
    ...(contentHashValid ? [] : ["provider_policy_content_hash_invalid"]),
    ...operationPermissionIssues.publicHosted.map((issue) => `public_hosted:${issue.code}`),
    ...operationPermissionIssues.selfHosted.map((issue) => `self_hosted:${issue.code}`),
  ];
  return gate(id, blockers.length === 0 ? "pass" : "blocked", blockers, {
    provider: policy.provider,
    version: policy.version,
    contentHash: policy.contentHash,
    contentHashValid,
    state: policy.state,
    approval: policy.authorization.approval,
    approvalReferenceState: typeof policy.authorization.approvalReference === "string"
      ? "recorded"
      : "missing",
    publicHosted: policy.availability.publicHosted,
    selfHosted: policy.availability.selfHosted,
    operationPermissionIssueCodes: {
      publicHosted: operationPermissionIssues.publicHosted.map((issue) => issue.code),
      selfHosted: operationPermissionIssues.selfHosted.map((issue) => issue.code),
    },
  });
}

function sourcingContractGate(): DesignerReleaseGateV1 {
  const providerPolicySource = optionalRepoText("packages/sourcing-core/src/provider-policy.ts");
  const providerPolicyTest = optionalRepoText("packages/sourcing-core/test/provider-policy.test.ts");
  const runtimeSource = optionalRepoText("apps/sourcing-service/src/v2-service.ts");
  const runtimeTest = optionalRepoText("apps/sourcing-service/test/v2-service.test.ts");
  const issuanceSource = optionalRepoText("apps/sourcing-service/src/authorization.ts");
  const authorizationTest = optionalRepoText("apps/sourcing-service/test/authorization.test.ts");
  const trustedVerificationSource = optionalRepoText("apps/sourcing-service/src/trusted-authorization.ts");
  const legacySource = optionalRepoText("apps/sourcing-service/src/service.ts");
  const legacyTest = optionalRepoText("apps/sourcing-service/test/service.test.ts");
  let publicSubpaths: string[] = [];
  try {
    const packageDocument = JSON.parse(optionalRepoText("apps/sourcing-service/package.json")) as {
      exports?: Record<string, unknown>;
    };
    publicSubpaths = Object.keys(packageDocument.exports ?? {}).sort();
  } catch {
    publicSubpaths = [];
  }
  const nativeServiceFactory = typeof createSourcingServiceV2 === "function";
  const contentAddressedPolicies = [DIGIKEY_PROVIDER_POLICY_V2, MOUSER_PROVIDER_POLICY_V2]
    .every((policy) => policy.contentHash === calculateProviderPolicyManifestV2ContentHash(policy));
  const canonicalPredicateDelegation = providerPolicySource.includes(
    "const issues = validateProviderPolicyOperationPermissionV2(policy, executionMode)",
  );
  const canonicalOperationPermissionConsumers = {
    runtimeLookup: canonicalPredicateDelegation
      && runtimeSource.includes("assertProviderPolicyAllowsOperationV2(policy, options.executionMode)"),
    authorizationIssuance: canonicalPredicateDelegation
      && issuanceSource.includes("assertProviderPolicyAllowsOperationV2(policy, request.executionMode)"),
    trustedVerification: trustedVerificationSource.includes("validateProviderPolicyOperationPermissionV2(")
      && trustedVerificationSource.includes("authorization.executionMode"),
  };
  const unsupportedExecutionModeFailsClosed = providerPolicySource.includes('"execution_mode_invalid"')
    && providerPolicyTest.includes("rejects an unsupported runtime execution mode inside the canonical validator")
    && providerPolicyTest.includes('validateProviderPolicyOperationPermissionV2(policy, "remote_hosted")');
  const approvalReferenceFailClosedCases = ["blank", "control-bearing", "missing", "oversized"]
    .filter((label) => [providerPolicyTest, runtimeTest, authorizationTest]
      .every((source) => source.includes(`\"${label}\"`)))
    .sort();
  const blockedLookupSideEffectIsolation = runtimeTest.includes(
    "blocks a %s approval reference before every cache or adapter call",
  ) && runtimeTest.includes("expect({ cacheReads, cacheWrites, adapterCalls }).toEqual({")
    && runtimeTest.includes("cacheReads: 0")
    && runtimeTest.includes("cacheWrites: 0")
    && runtimeTest.includes("adapterCalls: 0");
  const legacyV1AuditOnly = legacySource.includes("throw new LegacySourcingServiceV1AuditOnlyError()")
    && legacySource.includes("before cache, rate-limiter, clock, or adapter state is read")
    && legacyTest.includes("keeps an approvalReference-incapable %s policy audit-only with zero side effects")
    && legacyTest.includes("legacy_v1_sourcing_service_audit_only")
    && legacyTest.includes("rateLimiterCalls: 0")
    && legacyTest.includes("clockReads: 0");
  const rawProviderAdapterPublicSubpathsAbsent = JSON.stringify(publicSubpaths) === JSON.stringify([".", "./v2"])
    && legacyTest.includes("does not publicly export raw DigiKey or Mouser adapter factories");
  const canonicalConsumersVerified = Object.values(canonicalOperationPermissionConsumers).every(Boolean)
    && unsupportedExecutionModeFailsClosed;
  const blockers = [
    ...(nativeServiceFactory ? [] : ["native_v2_service_missing"]),
    ...(contentAddressedPolicies ? [] : ["content_addressed_provider_policies_unverified"]),
    ...(canonicalConsumersVerified ? [] : ["canonical_provider_operation_permission_unverified"]),
    ...(approvalReferenceFailClosedCases.length === 4
      ? []
      : ["approval_reference_fail_closed_parity_unverified"]),
    ...(blockedLookupSideEffectIsolation
      ? []
      : ["blocked_provider_path_side_effect_isolation_unverified"]),
    ...(legacyV1AuditOnly ? [] : ["legacy_v1_provider_execution_authority_present"]),
    ...(rawProviderAdapterPublicSubpathsAbsent ? [] : ["raw_provider_adapter_public_subpath_present"]),
  ];
  return gate("sourcing.native-v2-contract", blockers.length === 0 ? "pass" : "blocked", blockers, {
    contentAddressedPolicies,
    nativeServiceFactory,
    canonicalOperationPermissionConsumers,
    unsupportedExecutionModeFailsClosed,
    approvalReferenceFailClosedCases,
    blockedLookupSideEffects: blockedLookupSideEffectIsolation
      ? { cacheReads: 0, cacheWrites: 0, adapterCalls: 0 }
      : null,
    legacyV1ExecutionAuthority: legacyV1AuditOnly ? "audit_only" : "unverified",
    legacyV1SideEffects: legacyV1AuditOnly ? "none" : "unverified",
    rawProviderAdapterPublicSubpaths: rawProviderAdapterPublicSubpathsAbsent ? "absent" : publicSubpaths,
    providerPoliciesRemainDisabled: [DIGIKEY_PROVIDER_POLICY_V2, MOUSER_PROVIDER_POLICY_V2]
      .every((policy) => policy.state === "disabled_pending_approval"),
    claimBoundary: "Pass proves deterministic policy-authority code-path isolation only. It does not approve provider access, credentials, terms, live lookup, commercial observations, or export authority.",
  });
}

function sourcingRequestPacketV1Gate(): DesignerReleaseGateV1 {
  const schema = optionalRepoText("packages/sourcing-schema/src/request-packet-v1.ts");
  const schemaTest = optionalRepoText("packages/sourcing-schema/test/request-packet-v1.test.ts");
  const applications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const applicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const route = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const transfer = optionalRepoText("apps/web/src/features/designer/SourcingRequestTransfer.ts");
  const transferTest = optionalRepoText("apps/web/src/features/designer/sourcing-request-transfer.test.ts");
  const browserTest = optionalRepoText("apps/web/e2e/designer.spec.ts");
  const bundleAudit = optionalRepoText("apps/web/scripts/assert-production-bundle.mjs");
  const coreCanonicalContract = schema.includes('format: "schemagic-sourcing-request-packet"')
    && schema.includes("SOURCING_REQUEST_PACKET_MAX_BYTES_V1 = 256 * 1024")
    && schema.includes("SOURCING_REQUEST_PACKET_MAX_BOM_LINES_V1 = 256")
    && schema.includes("SOURCING_REQUEST_PACKET_MAX_TEXT_BYTES_V1 = 256")
    && schema.includes("SOURCING_REQUEST_PACKET_MAX_BUILD_QUANTITY_V1 = 1_000_000")
    && schema.includes("SOURCING_REQUEST_PACKET_MAX_QUANTITY_PER_ASSEMBLY_V1 = 1_000_000")
    && schema.includes("serializeSourcingRequestPacketV1")
    && schema.includes("parseSourcingRequestPacketV1")
    && schema.includes("verifySourcingRequestPacketV1")
    && schema.includes('purpose: "provider_neutral_sourcing_request"')
    && schema.includes('offers: "not_included"')
    && schema.includes('providerUrls: "not_included"')
    && schema.includes('providerSelection: "not_included"')
    && schema.includes('credentials: "not_included"')
    && schema.includes('commercialObservations: "not_included"')
    && schema.includes('providerAccess: "not_authorized"')
    && schemaTest.includes("has a closed shape with no provider choice, offers, URLs, credentials, or commercial observations")
    && schemaTest.includes("rejects unknown keys at every packet boundary and noncanonical wire bytes")
    && schemaTest.includes("rejects self-rehashed wrong, missing, or extra lines against exact authoritative input")
    && schemaTest.includes("rejects duplicate stable line IDs and fixed count, byte, string, and unit limits")
    && schemaTest.includes('toBe("authority_mismatch")');
  const installedApplicationBoundary = applications.includes("exactInstalledSourcingRequestPacketBoundary")
    && applications.includes("serializeSourcingRequestPacketV1(input)")
    && applications.includes("verifySourcingRequestPacketV1(content, input)")
    && applications.includes("!productionBoundary.authorizesProductionGeneration(source)")
    && applications.includes("Sourcing request export mutated its authorized source or policy")
    && applicationsTest.includes("authorized production generation")
    && applicationsTest.includes("exact candidate")
    && applicationsTest.includes('provider: "digikey"');
  const routePreDownloadAuthority = route.includes("verifyExactSourcingRequestPacketArtifactV1(artifact, exactInput)")
    && route.includes("adapter.authorizesProductionGeneration?.(source) !== true")
    && route.includes("this.#sourcingRequestBuildQuantity !== buildQuantity")
    && route.includes("this.#sourcingRequestRegion !== region")
    && route.includes("this.#sourcingRequestCurrency !== currency")
    && transfer.includes("verifySourcingRequestPacketV1(artifact.content, exactInput)")
    && transfer.includes("JSON.stringify(verified) !== presentedPacket")
    && transferTest.includes("FORGED-MPN")
    && transferTest.includes("separately self-rehashed changed MPN")
    && transferTest.includes("separately self-rehashed changed quantity")
    && transferTest.includes('code: "authority_mismatch"')
    && transferTest.includes("content and parsed-packet split");
  const exactGenerationBrowserSurface = route.includes("this.#productionGeneration !== undefined")
    && route.includes("this.#importedDemonstration === undefined")
    && browserTest.includes('page.locator("[data-sourcing-request-transfer]")).toHaveCount(0)')
    && browserTest.includes('getByRole("region", { name: "Sourcing request packet" })');
  const staleCompletionBrowserGuard = browserTest.includes("packetChunkGate")
    && browserTest.includes("stalePacketDownloads")
    && browserTest.includes("expect(stalePacketDownloads).toBe(0)")
    && browserTest.includes("page.unroute(packetChunkPattern, holdPacketChunk)");
  const bundleLeafIsolation = bundleAudit.includes("maximumSourcingRequestPacketClosureBytes = 64 * 1024")
    && bundleAudit.includes("expectedSourcingRequestPacketSources")
    && bundleAudit.includes("The sourcing request packet root must be a one-chunk static leaf with no outgoing dynamic imports")
    && bundleAudit.includes("Only the exact installed Designer application boundary and route verifier may dynamically import")
    && bundleAudit.includes("serializeSourcingRequestPacketV1(input)")
    && bundleAudit.includes("verifySourcingRequestPacketV1(content, input)")
    && bundleAudit.includes("\\bsendBeacon\\s*\\(")
    && bundleAudit.includes("\\bimportScripts\\s*\\(")
    && bundleAudit.includes("/https?:\\/\\//u");
  const explicitNoAuthorityBoundary = transfer.includes("no provider access authority or network destination")
    && transfer.includes("no offers, provider URLs or selection, credentials, commercial observations")
    && route.includes("The packet authorizes no provider access or selection")
    && browserTest.includes("sourcingPacketProviderRequests")
    && browserTest.includes("expect(sourcingPacketProviderRequests).toEqual([])")
    && browserTest.includes("providerAccess: \"not_authorized\"");
  const checks = {
    coreCanonicalContract,
    installedApplicationBoundary,
    routePreDownloadAuthority,
    exactGenerationBrowserSurface,
    staleCompletionBrowserGuard,
    bundleLeafIsolation,
    explicitNoAuthorityBoundary,
  };
  const blockers = Object.entries(checks)
    .filter(([, implemented]) => !implemented)
    .map(([name]) => `sourcing_request_packet_v1_unverified:${name}`);
  return gate("sourcing.request-packet-v1", blockers.length === 0 ? "pass" : "blocked", blockers, {
    ...checks,
    exactAuthorityLayers: installedApplicationBoundary && routePreDownloadAuthority
      ? ["installed_application_boundary", "designer_route_pre_download"]
      : [],
    packetSchemaVersion: 1,
    limits: coreCanonicalContract ? {
      maxBytes: 262_144,
      maxBomLines: 256,
      maxTextBytes: 256,
      maxBuildQuantity: 1_000_000,
      maxQuantityPerAssembly: 1_000_000,
    } : null,
    providerAccess: explicitNoAuthorityBoundary ? "not_authorized" : "unverified",
    networkCapabilityContract: bundleLeafIsolation ? "prohibited_in_exact_packet_leaf" : "unverified",
    commercialObservations: coreCanonicalContract ? "not_included" : "unverified",
    appOrProviderSnapshotPersistence: explicitNoAuthorityBoundary ? "none" : "unverified",
    transfer: "user_initiated_local_download",
    rankingOrEligibilityAuthority: explicitNoAuthorityBoundary ? "none" : "unverified",
    claimBoundary: "A pass proves a closed local provider-neutral transfer contract over exact result/candidate references, selected-candidate BOM, build quantity, and visible policy. It does not prove a clean build or deployed run, contact or authorize a provider, include offers or commercial observations, or add ranking or eligibility authority.",
  });
}

function simulationContractGate(): DesignerReleaseGateV1 {
  const implemented = typeof verifySimulationExecutionReceiptV1 === "function"
    && typeof exportDesignResultScenarioSimulationCsvV2 === "function"
    && typeof parseDesignResultScenarioSimulationCsvV2 === "function";
  return gate("simulation.execution-integrity-contract", implemented ? "pass" : "blocked", implemented ? [] : ["execution_receipt_or_bound_csv_missing"], {
    engine: SIMULATION_ENGINE_IDENTITY_V1,
    executionHost: "local_worker",
    attestation: "none",
    evidenceUse: "waveform_only_not_ranking",
    receiptVerifier: typeof verifySimulationExecutionReceiptV1 === "function",
    boundSimulationCsv: typeof exportDesignResultScenarioSimulationCsvV2 === "function",
    simulationCsvParser: typeof parseDesignResultScenarioSimulationCsvV2 === "function",
  });
}

interface BehavioralApplicationGoldenContractDocument {
  format?: unknown;
  schemaVersion?: unknown;
  evidenceBoundary?: { modelTier?: unknown; attestation?: unknown; productionProfilesUsed?: unknown };
  cases?: Array<{
    id?: unknown;
    application?: unknown;
    topology?: unknown;
    recipeId?: unknown;
    analyticTrendContract?: { kind?: unknown };
  }>;
}

function behavioralApplicationGoldenContractGate(): DesignerReleaseGateV1 {
  const contractText = optionalRepoText("tools/native-ngspice-reference/application-golden/contract.json");
  const identityTest = optionalRepoText("packages/sim-engine/test/application-golden.test.ts");
  const runner = optionalRepoText("tools/native-ngspice-reference/application-golden.mjs");
  const worker = optionalRepoText("tools/native-ngspice-reference/application-golden-worker.mjs");
  const harnessPackage = optionalRepoText("tools/native-ngspice-reference/package.json");
  let contract: BehavioralApplicationGoldenContractDocument | null = null;
  try {
    contract = JSON.parse(contractText) as BehavioralApplicationGoldenContractDocument;
  } catch {
    contract = null;
  }
  const cases = contract?.cases ?? [];
  const expectedCases = [
    ["motor.m1.pwm-loaded-steady-state.behavioral", "motor.brushed-dc", "motor.hbridge.integrated", "motor.brushed-dc.integrated-h-bridge.v1", "motor-authored-closure-with-represented-series-resistance"],
    ["motor.m2.external-nmos.pwm-loaded-steady-state.behavioral", "motor.brushed-dc", "motor.hbridge.external-nmos", "motor.brushed-dc.external-nmos-h-bridge.v1", "motor-authored-closure-with-represented-series-resistance"],
    ["power.p1.startup.behavioral", "power.buck", "power.buck.integrated-synchronous", "schemagic.power.buck.integrated-synchronous.v1", "power-passive-connectivity-positive-slopes"],
    ["power.p2.external-fet.startup.behavioral", "power.buck", "power.buck.controller-external-nmos", "schemagic.power.buck.controller-external-nmos.v1", "power-passive-connectivity-positive-slopes"],
  ].map((entry) => JSON.stringify(entry)).sort();
  const observedCases = cases
    .map((entry) => JSON.stringify([entry.id, entry.application, entry.topology, entry.recipeId, entry.analyticTrendContract?.kind]))
    .sort();
  const implemented = {
    closedBehavioralContract: contract?.format === "opencircuit-application-golden-contract"
      && contract.schemaVersion === 1
      && contract.evidenceBoundary?.modelTier === "behavioral"
      && contract.evidenceBoundary.attestation === "none"
      && contract.evidenceBoundary.productionProfilesUsed === false
      && JSON.stringify(observedCases) === JSON.stringify(expectedCases),
    generatedContextIdentityTest: identityTest.includes("generateMotorDesign")
      && identityTest.includes("M2_POWER_REQUEST")
      && identityTest.includes("generateP1CompactFixture")
      && identityTest.includes("generateP2HighVoltageFixture")
      && identityTest.includes('expect.soft(generated.netlist, `${testCase.id} netlist`).toBe(fixture)')
      && identityTest.includes("calculateSimulationNetlistContentHashV1"),
    nativeAndWasmRunner: runner.includes("runNative({ netlist")
      && runner.includes("browserWorker.run(netlist")
      && runner.includes("fullVectorComparisonIsReleaseGate: false"),
    selectedAnalyticTrendExecution: runner.includes("motorAnalyticTrendMeasurements")
      && runner.includes("powerAnalyticTrendMeasurements")
      && runner.includes("analytic trend output span is vacuous")
      && identityTest.includes("analyticallyExpectedCurrentA")
      && identityTest.includes("minimumObservedOutputSpanV"),
    localWorkerReceiptVerification: runner.includes("new Worker(")
      && worker.includes("parentPort.on")
      && worker.includes("verifySimulationExecutionReceiptV1")
      && worker.includes("_createSimulationExecutionReceiptV1"),
    explicitHarnessCommand: harnessPackage.includes('"test:application-golden"')
      && harnessPackage.includes("node application-golden.mjs"),
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `behavioral_application_golden_contract_missing:${name}`);
  return gate("simulation.behavioral-application-golden-contract", blockers.length === 0 ? "pass" : "blocked", blockers, {
    implemented,
    contractContentHash: contractText.length > 0
      ? `sha256:${createHash("sha256").update(contractText, "utf8").digest("hex")}`
      : null,
    caseIds: cases.map((entry) => entry.id).filter((id): id is string => typeof id === "string").sort(),
    modelTier: "behavioral",
    attestation: "none",
    productionProfilesUsed: false,
    claimBoundary: "This gate proves a bounded executable contract is wired; clean-checkout execution, production-profile fidelity, regulation, ranking and full-waveform equivalence remain separate gates",
  });
}

interface SelectedPassiveApplicationGoldenContractDocument {
  format?: unknown;
  schemaVersion?: unknown;
  engines?: {
    native?: { version?: unknown; solverClaim?: unknown };
    browserWasm?: { module?: unknown; engineVersion?: unknown; simulatorVersion?: unknown; solver?: unknown };
  };
  evidenceBoundary?: {
    modelTier?: unknown;
    attestation?: unknown;
    productionProfilesUsed?: unknown;
    primitiveValueBasis?: unknown;
    productionConstraintEligibility?: unknown;
    currentProductionIdentity?: unknown;
    selectedSemiconductorModelsUsed?: unknown;
    operatingConditionsWithinReviewedEvidence?: unknown;
    authority?: Record<string, unknown>;
  };
  case?: {
    id?: unknown;
    application?: unknown;
    presetId?: unknown;
    candidateId?: unknown;
    recipe?: { id?: unknown; version?: unknown; contentHash?: unknown };
    requestHash?: unknown;
    resultContentHash?: unknown;
    strictGeneration?: {
      requestHash?: unknown;
      resultContentHash?: unknown;
      retainedCandidateCount?: unknown;
      rejectedCandidateId?: unknown;
      rejectionReasonCode?: unknown;
      counts?: unknown;
    };
    constraintPolicy?: { id?: unknown; contentHash?: unknown };
    constraintDecisionContentHash?: unknown;
    observationCounts?: unknown;
    observationCandidateCount?: unknown;
    eligibleCandidateCount?: unknown;
    library?: {
      version?: unknown;
      contextManifestContentHash?: unknown;
      catalogContentHash?: unknown;
      sourceReleaseContentHash?: unknown;
    };
    scenarioId?: unknown;
    scenarioHash?: unknown;
    serializationHash?: unknown;
    analysis?: unknown;
    fixture?: unknown;
    netlistContentHash?: unknown;
    selectedVectors?: unknown[];
    selectedBindings?: Array<{
      selectedComponentId?: unknown;
      assemblyComponentId?: unknown;
      circuitComponentId?: unknown;
      physicalInstanceOrdinal?: unknown;
      selectedLineQuantityPerAssembly?: unknown;
      representedQuantityPerAssembly?: unknown;
      classification?: unknown;
      profileId?: unknown;
      profileContentHash?: unknown;
      manufacturerId?: unknown;
      manufacturerPartNumber?: unknown;
      nominalValue?: { value?: unknown; unit?: unknown };
      nominalEvidenceContentHash?: unknown;
      representation?: unknown;
      reviewedOperatingConditionStatus?: unknown;
    }>;
    primaryBinding?: {
      selectedComponentId?: unknown;
      circuitComponentId?: unknown;
      manufacturerPartNumber?: unknown;
      classification?: unknown;
      executableSelectedPartModel?: unknown;
    };
    observationContract?: {
      kind?: unknown;
      productionSwitchingFrequencyMinimumHz?: unknown;
      scenarioSwitchingFrequencyHz?: unknown;
      reviewedNominalInductanceTestFrequencyHz?: unknown;
      reviewedNominalInductanceTestVoltageVrms?: unknown;
      reviewedNominalCapacitanceTestFrequencyMinimumHz?: unknown;
      reviewedNominalCapacitanceTestFrequencyMaximumHz?: unknown;
      reviewedNominalCapacitanceTestVoltageMinimumVrms?: unknown;
      reviewedNominalCapacitanceTestVoltageMaximumVrms?: unknown;
      capacitorPrimitiveCount?: unknown;
      capacitorNominalValuePerPrimitiveF?: unknown;
      minimumSampleCount?: unknown;
      minimumOutputSpanV?: unknown;
      maximumOutputNodeKclResidualA?: unknown;
      maximumLoadRelationResidualA?: unknown;
      minimumAbsoluteInductorCurrentA?: unknown;
      maximumAbsoluteInductorCurrentA?: unknown;
      minimumAbsoluteCapacitorCurrentA?: unknown;
      maximumAbsoluteCapacitorCurrentA?: unknown;
      maximumCrossEngineAbsoluteInductorCurrentRelativeDifference?: unknown;
      interpretation?: unknown;
    };
  };
}

interface SelectedPassiveExecutionMeasurementsDocument {
  sampleCount?: unknown;
  inputSpanV?: unknown;
  outputSpanV?: unknown;
  maximumAbsoluteInductorCurrentA?: unknown;
  maximumAbsoluteCapacitorCurrentsA?: unknown;
  maximumOutputNodeKclResidualA?: unknown;
  maximumLoadRelationResidualA?: unknown;
  operatingConditionsWithinReviewedEvidence?: unknown;
  physicalWaveformFidelityProved?: unknown;
}

type SelectedPassiveObservationContractDocument = NonNullable<
  NonNullable<SelectedPassiveApplicationGoldenContractDocument["case"]>["observationContract"]
>;

interface SelectedPassiveExecutionReportDocument {
  format?: unknown;
  schemaVersion?: unknown;
  contractContentHash?: unknown;
  evidenceBoundary?: unknown;
  pass?: unknown;
  case?: {
    id?: unknown;
    application?: unknown;
    presetId?: unknown;
    candidateId?: unknown;
    recipe?: unknown;
    requestHash?: unknown;
    resultContentHash?: unknown;
    strictGeneration?: unknown;
    constraintPolicy?: unknown;
    constraintDecisionContentHash?: unknown;
    observationCounts?: unknown;
    observationCandidateCount?: unknown;
    eligibleCandidateCount?: unknown;
    library?: unknown;
    scenarioId?: unknown;
    scenarioHash?: unknown;
    serializationHash?: unknown;
    analysis?: unknown;
    modelTier?: unknown;
    attestation?: unknown;
    productionProfileBindings?: unknown;
    primaryBinding?: unknown;
    engineIdentity?: {
      id?: unknown;
      buildVersion?: unknown;
      simulatorVersion?: unknown;
      solver?: unknown;
      numericFormat?: unknown;
    };
    netlistContentHash?: unknown;
    sampleContentHash?: unknown;
    receiptContentHash?: unknown;
    repeatableBrowserReceipt?: unknown;
    selectedVectors?: Array<{
      name?: unknown;
      metric?: unknown;
      maxAbsError?: unknown;
      maxRelativeError?: unknown;
    }>;
    fullVectorComparisonPass?: unknown;
    fullVectorComparisonIsReleaseGate?: unknown;
    relation?: unknown;
    native?: SelectedPassiveExecutionMeasurementsDocument;
    browserWasm?: SelectedPassiveExecutionMeasurementsDocument;
    crossEngineAbsoluteInductorCurrentRelativeDifference?: unknown;
    operatingConditionsWithinReviewedEvidence?: unknown;
    physicalWaveformFidelityProved?: unknown;
    pass?: unknown;
  };
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function selectedPassiveExecutionMeasurementsValid(
  value: SelectedPassiveExecutionMeasurementsDocument | undefined,
  observation: SelectedPassiveObservationContractDocument | undefined,
): boolean {
  if (value === undefined || observation === undefined) return false;
  return Number.isInteger(value.sampleCount)
    && typeof value.sampleCount === "number"
    && typeof observation.minimumSampleCount === "number"
    && value.sampleCount >= observation.minimumSampleCount
    && finiteNonNegative(value.inputSpanV)
    && value.inputSpanV > 0
    && finiteNonNegative(value.outputSpanV)
    && typeof observation.minimumOutputSpanV === "number"
    && value.outputSpanV >= observation.minimumOutputSpanV
    && finiteNonNegative(value.maximumAbsoluteInductorCurrentA)
    && typeof observation.minimumAbsoluteInductorCurrentA === "number"
    && typeof observation.maximumAbsoluteInductorCurrentA === "number"
    && value.maximumAbsoluteInductorCurrentA >= observation.minimumAbsoluteInductorCurrentA
    && value.maximumAbsoluteInductorCurrentA <= observation.maximumAbsoluteInductorCurrentA
    && Array.isArray(value.maximumAbsoluteCapacitorCurrentsA)
    && typeof observation.capacitorPrimitiveCount === "number"
    && value.maximumAbsoluteCapacitorCurrentsA.length === observation.capacitorPrimitiveCount
    && typeof observation.minimumAbsoluteCapacitorCurrentA === "number"
    && typeof observation.maximumAbsoluteCapacitorCurrentA === "number"
    && value.maximumAbsoluteCapacitorCurrentsA.every((entry) => finiteNonNegative(entry)
      && entry >= (observation.minimumAbsoluteCapacitorCurrentA as number)
      && entry <= (observation.maximumAbsoluteCapacitorCurrentA as number))
    && finiteNonNegative(value.maximumOutputNodeKclResidualA)
    && typeof observation.maximumOutputNodeKclResidualA === "number"
    && value.maximumOutputNodeKclResidualA <= observation.maximumOutputNodeKclResidualA
    && finiteNonNegative(value.maximumLoadRelationResidualA)
    && typeof observation.maximumLoadRelationResidualA === "number"
    && value.maximumLoadRelationResidualA <= observation.maximumLoadRelationResidualA
    && value.operatingConditionsWithinReviewedEvidence === false
    && value.physicalWaveformFidelityProved === false;
}

function selectedPassiveApplicationGoldenContractGate(): DesignerReleaseGateV1 {
  const contractText = optionalRepoText("tools/native-ngspice-reference/selected-passive-application-golden/contract.json");
  const fixtureText = optionalRepoText("tools/native-ngspice-reference/selected-passive-application-golden/fixtures/power-integrated-12v-ideal-nominal-lc.cir");
  const executionReportText = optionalRepoText("tools/native-ngspice-reference/selected-passive-application-golden/execution-report.json");
  const executionReportTest = optionalRepoText("tools/native-ngspice-reference/test/selected-passive-execution-report.test.mjs");
  const identityTest = optionalRepoText("packages/sim-engine/test/selected-passive-application-golden.test.ts");
  const runner = optionalRepoText("tools/native-ngspice-reference/selected-passive-application-golden.mjs");
  const harnessPackage = optionalRepoText("tools/native-ngspice-reference/package.json");
  const continuousIntegration = optionalRepoText(".github/workflows/ci.yml");
  const ciWiring = assessSelectedPassiveCiWiringV1(continuousIntegration, harnessPackage);
  let contract: SelectedPassiveApplicationGoldenContractDocument | null = null;
  let executionReport: SelectedPassiveExecutionReportDocument | null = null;
  try {
    contract = JSON.parse(contractText) as SelectedPassiveApplicationGoldenContractDocument;
  } catch {
    contract = null;
  }
  try {
    executionReport = JSON.parse(executionReportText) as SelectedPassiveExecutionReportDocument;
  } catch {
    executionReport = null;
  }
  const testCase = contract?.case;
  const bindings = testCase?.selectedBindings ?? [];
  const expectedBindings = [
    [
      "output-capacitor",
      "output-capacitor-1",
      "output-capacitor-1",
      1,
      2,
      1,
      "physical",
      "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
      "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
      "murata-manufacturing",
      "GRM32ER71E226KE15L",
      0.000022,
      "F",
      "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873",
      "ideal_nominal_capacitor",
      "outside_or_unproved",
    ],
    [
      "output-capacitor",
      "output-capacitor-2",
      "output-capacitor-2",
      2,
      2,
      1,
      "physical",
      "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
      "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
      "murata-manufacturing",
      "GRM32ER71E226KE15L",
      0.000022,
      "F",
      "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873",
      "ideal_nominal_capacitor",
      "outside_or_unproved",
    ],
    [
      "power-inductor",
      "power-inductor",
      "power-inductor",
      1,
      1,
      1,
      "physical",
      "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
      "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
      "bel-fuse",
      "F1F2-0804-100M",
      0.00001,
      "H",
      "sha256:c3523b58c262a6d39716711a5a05a5b6e5a60081eb15818bf35ba4b93e7a828f",
      "ideal_nominal_inductor",
      "outside",
    ],
  ];
  const observedBindings = bindings.map((binding) => [
    binding.selectedComponentId,
    binding.assemblyComponentId,
    binding.circuitComponentId,
    binding.physicalInstanceOrdinal,
    binding.selectedLineQuantityPerAssembly,
    binding.representedQuantityPerAssembly,
    binding.classification,
    binding.profileId,
    binding.profileContentHash,
    binding.manufacturerId,
    binding.manufacturerPartNumber,
    binding.nominalValue?.value,
    binding.nominalValue?.unit,
    binding.nominalEvidenceContentHash,
    binding.representation,
    binding.reviewedOperatingConditionStatus,
  ]);
  const fixtureContentHash = fixtureText.length > 0
    ? `sha256:${createHash("sha256").update(fixtureText, "utf8").digest("hex")}`
    : null;
  const contractContentHash = contractText.length > 0
    ? `sha256:${createHash("sha256").update(contractText, "utf8").digest("hex")}`
    : null;
  const executionCase = executionReport?.case;
  const executionObservation = testCase?.observationContract;
  const executionVectorNames = executionCase?.selectedVectors?.map((entry) => entry.name) ?? [];
  const executionCrossEngineDifference = executionCase?.crossEngineAbsoluteInductorCurrentRelativeDifference;
  const executionArtifactContentHash = executionReportText.length > 0
    ? `sha256:${createHash("sha256").update(executionReportText, "utf8").digest("hex")}`
    : null;
  const executionReportCanonical = executionReport !== null
    && executionReportText === `${JSON.stringify(executionReport, null, 2)}\n`;
  const executionIdentityBound = executionReportCanonical
    && contract !== null
    && testCase !== undefined
    && executionCase !== undefined
    && executionReport?.format === "opencircuit-selected-passive-application-golden-report"
    && executionReport.schemaVersion === 2
    && executionReport.contractContentHash === contractContentHash
    && JSON.stringify(executionReport.evidenceBoundary) === JSON.stringify(contract?.evidenceBoundary)
    && executionReport.pass === true
    && executionCase?.id === testCase?.id
    && executionCase.application === testCase?.application
    && executionCase.presetId === testCase?.presetId
    && executionCase.candidateId === testCase?.candidateId
    && JSON.stringify(executionCase.recipe) === JSON.stringify(testCase?.recipe)
    && executionCase.requestHash === testCase?.requestHash
    && executionCase.resultContentHash === testCase?.resultContentHash
    && JSON.stringify(executionCase.strictGeneration) === JSON.stringify(testCase?.strictGeneration)
    && JSON.stringify(executionCase.constraintPolicy) === JSON.stringify(testCase?.constraintPolicy)
    && executionCase.constraintDecisionContentHash === testCase?.constraintDecisionContentHash
    && JSON.stringify(executionCase.observationCounts) === JSON.stringify(testCase?.observationCounts)
    && executionCase.observationCandidateCount === testCase?.observationCandidateCount
    && executionCase.eligibleCandidateCount === testCase?.eligibleCandidateCount
    && JSON.stringify(executionCase.library) === JSON.stringify(testCase?.library)
    && executionCase.scenarioId === testCase?.scenarioId
    && executionCase.scenarioHash === testCase?.scenarioHash
    && executionCase.serializationHash === testCase?.serializationHash
    && executionCase.analysis === testCase?.analysis
    && executionCase.modelTier === "behavioral"
    && executionCase.attestation === "none"
    && JSON.stringify(executionCase.productionProfileBindings) === JSON.stringify(bindings)
    && JSON.stringify(executionCase.primaryBinding) === JSON.stringify(testCase?.primaryBinding)
    && executionCase.engineIdentity?.id === "@opencircuit/ngspice-wasm"
    && executionCase.engineIdentity.buildVersion === "ngspice-46-opencircuit-wasm1"
    && executionCase.engineIdentity.simulatorVersion === "ngspice-46"
    && executionCase.engineIdentity.solver === "KLU"
    && executionCase.engineIdentity.numericFormat === "ieee754-binary64"
    && executionCase.netlistContentHash === testCase?.netlistContentHash
    && typeof executionCase.sampleContentHash === "string" && /^sha256:[0-9a-f]{64}$/u.test(executionCase.sampleContentHash)
    && typeof executionCase.receiptContentHash === "string" && /^sha256:[0-9a-f]{64}$/u.test(executionCase.receiptContentHash)
    && executionCase.repeatableBrowserReceipt === true
    && JSON.stringify(executionVectorNames) === JSON.stringify(testCase?.selectedVectors)
    && (executionCase.selectedVectors ?? []).every((entry) => entry.metric === "full-scale"
      && finiteNonNegative(entry.maxAbsError)
      && finiteNonNegative(entry.maxRelativeError)
      && entry.maxRelativeError <= 1e-2)
      && executionCase.fullVectorComparisonPass === true
    && executionCase.fullVectorComparisonIsReleaseGate === false
    && executionCase.relation === "Iinductor=Icapacitor1+Icapacitor2+Iload and Iload=Voutput/Rload for two parallel per-part ideal nominal capacitor primitives"
    && executionCase.operatingConditionsWithinReviewedEvidence === false
    && executionCase.physicalWaveformFidelityProved === false
    && executionCase.pass === true;
  const executionMeasurementsWithinContract = executionIdentityBound
    && selectedPassiveExecutionMeasurementsValid(executionCase?.native, executionObservation)
    && selectedPassiveExecutionMeasurementsValid(executionCase?.browserWasm, executionObservation)
    && finiteNonNegative(executionCrossEngineDifference)
    && typeof executionObservation?.maximumCrossEngineAbsoluteInductorCurrentRelativeDifference === "number"
    && executionCrossEngineDifference
      <= executionObservation.maximumCrossEngineAbsoluteInductorCurrentRelativeDifference;
  const executionRegenerationWired = runner.includes("validateSelectedPassiveExecutionReport(report, contract, report.contractContentHash)")
    && runner.includes("validateSelectedPassiveContract(contract);\n  exactKeys(report")
    && runner.includes("verifyPersistedExecutionReport(report, contract, contractContentHash, EXECUTION_REPORT_PATH)")
    && runner.includes("selectedPassiveExecutionIdentity(persisted)")
    && runner.includes("selectedPassiveExecutionIdentity(freshReport)")
    && executionReportTest.includes("strictly validates the contract on the hard persisted-artifact path")
    && executionReportTest.includes("binds every persisted browser-WASM measurement compared with a fresh run")
    && ciWiring.checks.exactHarnessCommand;
  const executionResultAttached = executionMeasurementsWithinContract && executionRegenerationWired;
  const expectedUnavailableAuthority = {
    switchingBehavior: "unavailable",
    effectiveCapacitance: "unavailable",
    capacitorEsr: "unavailable",
    capacitorRippleCurrent: "unavailable",
    passiveCurrent: "unavailable",
    loss: "unavailable",
    physicalPassiveModel: "unavailable",
    fullBomModel: "unavailable",
    selectedSemiconductorModel: "unavailable",
    constraintEligibility: "unavailable",
    candidateRanking: "unavailable",
    safety: "unavailable",
  } as const;
  const implemented = {
    closedNominalProjectionContract: contract?.format === "opencircuit-selected-passive-application-golden-contract"
      && contract.schemaVersion === 2
      && contract.evidenceBoundary?.modelTier === "behavioral"
      && contract.evidenceBoundary.attestation === "none"
      && contract.evidenceBoundary.productionProfilesUsed === true
      && contract.evidenceBoundary.primitiveValueBasis === "reviewed_nominal_only"
      && contract.evidenceBoundary.productionConstraintEligibility === false
      && contract.evidenceBoundary.selectedSemiconductorModelsUsed === false
      && contract.evidenceBoundary.operatingConditionsWithinReviewedEvidence === false
      && JSON.stringify(contract.evidenceBoundary.authority) === JSON.stringify(expectedUnavailableAuthority)
      && contract.engines?.native?.version === "ngspice-46"
      && contract.engines.native.solverClaim === "unverified"
      && contract.engines.browserWasm?.module === "../../ngspice-wasm-build/dist-loader/index.mjs"
      && contract.engines.browserWasm.engineVersion === "ngspice-46-opencircuit-wasm1"
      && contract.engines.browserWasm.simulatorVersion === "ngspice-46"
      && contract.engines.browserWasm.solver === "KLU",
    exactProductionObservationIdentity: testCase?.id === "power.production.integrated-12v-low-current.ideal-nominal-selected-passives"
      && contract?.evidenceBoundary?.currentProductionIdentity === true
      && testCase.application === "power.buck"
      && testCase.presetId === "power.integrated-12v-low-current"
      && testCase.candidateId === "candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a"
      && testCase.recipe?.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
      && testCase.recipe.version === "3.4.6"
      && testCase.recipe.contentHash === "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c"
      && testCase.requestHash === "sha256:f21a643aba1a3c8cb75d42ff2e69b4f12a25168becdb68fbf54f720649821cd4"
      && testCase.resultContentHash === "sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a"
      && testCase.strictGeneration?.requestHash === "sha256:30b8c0fac110f71ce3e71c9347afe725f2a1ad29aa4fdb6bfde8bc87cc73771c"
      && testCase.strictGeneration.resultContentHash === "sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2"
      && testCase.strictGeneration.retainedCandidateCount === 0
      && testCase.strictGeneration.rejectedCandidateId === "candidate:v2:sha256:88b7d52b012cd7edfda6ba8f5ef0611c7d2ffeff870614ccf9d0dea6f1ca679d"
      && testCase.strictGeneration.rejectionReasonCode === "unknown_constraint_disallowed"
      && JSON.stringify(testCase.strictGeneration.counts) === JSON.stringify({
        recipes: 4, supportedRecipes: 3, enumerated: 1, solved: 1, matchOutcomes: 1,
        matched: 1, checked: 1, estimated: 0, deduped: 0, pareto: 0,
        materialized: 0, coverageValidated: 0, rejected: 1,
      })
      && testCase.constraintPolicy?.id === "production_strict_v1"
      && testCase.constraintPolicy.contentHash === "sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6"
      && testCase.constraintDecisionContentHash === "sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37"
      && JSON.stringify(testCase.observationCounts) === JSON.stringify({
        recipes: 4, supportedRecipes: 3, enumerated: 1, solved: 1, matchOutcomes: 1,
        matched: 1, checked: 1, estimated: 1, deduped: 1, pareto: 1,
        materialized: 1, coverageValidated: 1, rejected: 0,
      })
      && testCase.observationCandidateCount === 1
      && testCase.eligibleCandidateCount === 0
      && testCase.library?.version === "2026-08-27.2"
      && testCase.library.contextManifestContentHash === "sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3"
      && testCase.library.catalogContentHash === "sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890"
      && testCase.library.sourceReleaseContentHash === "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e"
      && testCase.scenarioId === "ideal_pwm_output_stage_transient"
      && testCase.scenarioHash === "a09afbbb72d487c1"
      && testCase.serializationHash === "550831affe3a64c1"
      && testCase.analysis === "tran",
    exactReviewedPassiveBindings: JSON.stringify(observedBindings) === JSON.stringify(expectedBindings),
    behavioralPrimaryWithoutSelectedModel: testCase?.primaryBinding?.selectedComponentId === "primary"
      && testCase.primaryBinding.circuitComponentId === "ideal-pwm-primary"
      && testCase.primaryBinding.manufacturerPartNumber === "TPS54302DDCR"
      && testCase.primaryBinding.classification === "behavioral"
      && testCase.primaryBinding.executableSelectedPartModel === false,
    exactGeneratedNetlistFixture: testCase?.fixture === "fixtures/power-integrated-12v-ideal-nominal-lc.cir"
      && testCase.netlistContentHash === "sha256:7d0a83af5d553344adaedbd6ab9d2ad86a70630313ab56045e46304c9eaeac97"
      && fixtureContentHash === testCase.netlistContentHash
      && fixtureText.startsWith("scheMAGIC Simulator scenario a09afbbb72d487c1\n* scenario-hash a09afbbb72d487c1\n")
      && fixtureText.includes("Coc_6f75747075742d636170616369746f722d31 n2 0 0.000022")
      && fixtureText.includes("Coc_6f75747075742d636170616369746f722d32 n2 0 0.000022"),
    generatedProductionIdentityTest: identityTest.includes("currentPowerPreset")
      && identityTest.includes("generateBuckDesignV2")
      && identityTest.includes("getPowerDesignContextManifestV2")
      && identityTest.includes("generateScenarioNetlist")
      && identityTest.includes("generated.netlist).toBe(fixture)")
      && identityTest.includes("catalog-native-model")
      && identityTest.includes("observationRequest.constraints.allowUnknownHardConstraints = true")
      && identityTest.includes("candidate constraint eligibility"),
    nativeAndWasmSelectedVectorRunner: runner.includes("runNative({ netlist")
      && runner.includes("browserWorker.run(netlist")
      && runner.includes("selectedComparison(comparison, testCase.selectedVectors)")
      && runner.includes("receiptVerificationIssues.length === 0")
      && runner.includes("fullVectorComparisonIsReleaseGate: false"),
    explicitOutsideReviewedConditions: testCase?.observationContract?.kind === "ideal-nominal-output-node-kcl-outside-reviewed-conditions"
      && testCase.observationContract.interpretation === "mathematical_projection_outside_reviewed_conditions"
      && testCase.observationContract.productionSwitchingFrequencyMinimumHz === 290000
      && testCase.observationContract.scenarioSwitchingFrequencyHz === 400000
      && testCase.observationContract.reviewedNominalInductanceTestFrequencyHz === 100000
      && testCase.observationContract.reviewedNominalInductanceTestVoltageVrms === 0.25
      && testCase.observationContract.reviewedNominalCapacitanceTestFrequencyMinimumHz === 96
      && testCase.observationContract.reviewedNominalCapacitanceTestFrequencyMaximumHz === 144
      && testCase.observationContract.reviewedNominalCapacitanceTestVoltageMinimumVrms === 0.4
      && testCase.observationContract.reviewedNominalCapacitanceTestVoltageMaximumVrms === 0.6
      && testCase.observationContract.capacitorPrimitiveCount === 2
      && testCase.observationContract.capacitorNominalValuePerPrimitiveF === 0.000022
      && testCase.observationContract.minimumAbsoluteCapacitorCurrentA === 5
      && testCase.observationContract.maximumAbsoluteCapacitorCurrentA === 6
      && runner.includes("operatingConditionsWithinReviewedEvidence: false")
      && runner.includes("physicalWaveformFidelityProved: false"),
    explicitHarnessCommand: harnessPackage.includes('"test:selected-passive-application-golden"')
      && harnessPackage.includes("run test --workspace=@opencircuit/sim-engine -- test/selected-passive-application-golden.test.ts")
      && harnessPackage.includes("node selected-passive-application-golden.mjs"),
    conditionalContinuousIntegrationWiring: ciWiring.implemented,
    canonicalExecutionArtifact: executionResultAttached,
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `selected_passive_application_golden_contract_missing:${name}`);
  return gate(
    "simulation.production-selected-passive-nominal-projection-golden-contract",
    blockers.length === 0 ? "pass" : "blocked",
    blockers,
    {
      implemented,
      contractContentHash,
      caseId: typeof testCase?.id === "string" ? testCase.id : null,
      candidateId: typeof testCase?.candidateId === "string" ? testCase.candidateId : null,
      requestHash: typeof testCase?.requestHash === "string" ? testCase.requestHash : null,
      resultContentHash: typeof testCase?.resultContentHash === "string" ? testCase.resultContentHash : null,
      strictGeneration: testCase?.strictGeneration ?? null,
      constraintPolicy: testCase?.constraintPolicy ?? null,
      constraintDecisionContentHash: typeof testCase?.constraintDecisionContentHash === "string"
        ? testCase.constraintDecisionContentHash
        : null,
      observationCounts: testCase?.observationCounts ?? null,
      observationCandidateCount: testCase?.observationCandidateCount ?? null,
      eligibleCandidateCount: testCase?.eligibleCandidateCount ?? null,
      recipe: testCase?.recipe ?? null,
      library: testCase?.library ?? null,
      scenario: {
        id: typeof testCase?.scenarioId === "string" ? testCase.scenarioId : null,
        hash: typeof testCase?.scenarioHash === "string" ? testCase.scenarioHash : null,
        serializationHash: typeof testCase?.serializationHash === "string" ? testCase.serializationHash : null,
      },
      netlistContentHash: typeof testCase?.netlistContentHash === "string" ? testCase.netlistContentHash : null,
      selectedPassiveProfiles: bindings.map((binding) => ({
        selectedComponentId: binding.selectedComponentId,
        assemblyComponentId: binding.assemblyComponentId,
        circuitComponentId: binding.circuitComponentId,
        physicalInstanceOrdinal: binding.physicalInstanceOrdinal,
        selectedLineQuantityPerAssembly: binding.selectedLineQuantityPerAssembly,
        representedQuantityPerAssembly: binding.representedQuantityPerAssembly,
        profileId: binding.profileId,
        profileContentHash: binding.profileContentHash,
        manufacturerPartNumber: binding.manufacturerPartNumber,
        nominalValue: binding.nominalValue,
        representation: binding.representation,
        reviewedOperatingConditionStatus: binding.reviewedOperatingConditionStatus,
      })),
      primitiveValueBasis: contract?.evidenceBoundary?.primitiveValueBasis ?? "unverified",
      productionConstraintEligibility: contract?.evidenceBoundary?.productionConstraintEligibility ?? "unverified",
      currentProductionIdentity: contract?.evidenceBoundary?.currentProductionIdentity ?? "unverified",
      selectedSemiconductorModelsUsed: contract?.evidenceBoundary?.selectedSemiconductorModelsUsed ?? "unverified",
      operatingConditionsWithinReviewedEvidence: contract?.evidenceBoundary?.operatingConditionsWithinReviewedEvidence ?? "unverified",
      authority: contract?.evidenceBoundary?.authority ?? "unverified",
      modelTier: contract?.evidenceBoundary?.modelTier ?? "unverified",
      attestation: contract?.evidenceBoundary?.attestation ?? "unverified",
      engineClaims: {
        nativeVersion: contract?.engines?.native?.version ?? "unverified",
        nativeSolver: contract?.engines?.native?.solverClaim ?? "unverified",
        browserWasmBuildVersion: contract?.engines?.browserWasm?.engineVersion ?? "unverified",
        browserWasmSimulatorVersion: contract?.engines?.browserWasm?.simulatorVersion ?? "unverified",
        browserWasmSolver: contract?.engines?.browserWasm?.solver ?? "unverified",
      },
      executionResultAttached,
      executionArtifactAttested: false,
      ciWiringChecks: ciWiring.checks,
      ciExecutionAuthority: ciWiring.implemented ? {
        mode: "conditional_native_reference",
        referenceNativeVersion: "ngspice-46",
        persistedCurrentIdentityAuthority: "hard_gate",
        matchingReferenceFailureAuthority: "hard_gate",
        nonmatchingNativeVersionFailureAuthority: "informational_soft_fail",
      } : "unverified",
      executionArtifact: executionResultAttached ? {
        contentHash: executionArtifactContentHash,
        byteLength: Buffer.byteLength(executionReportText, "utf8"),
        sampleContentHash: executionCase?.sampleContentHash ?? null,
        browserReceiptContentHash: executionCase?.receiptContentHash ?? null,
        nativeSampleCount: executionCase?.native?.sampleCount ?? null,
        browserWasmSampleCount: executionCase?.browserWasm?.sampleCount ?? null,
        validation: "canonical_current_identity_bound_regenerated_unattested_ineligible_observation",
      } : null,
      claimBoundary: "A pass requires a closed current-production exact-identity contract, generated-fixture identity test, native/browser-WASM selected-vector runner, canonical persisted execution report, exact invariant-identity regeneration check, explicit local command, and structurally assessed unfiltered push/pull-request CI wiring. The current local report is unattested and binds one permissive structural observation that the installed policy keeps ineligible; strict generation retains zero candidates. It represents the two selected 22 uF capacitors as two separate ideal nominal primitives and the selected 10 uH inductor as one ideal nominal primitive. The exact 100 kHz / 0.25 V RMS inductor characterization and 96-144 Hz / 0.4-0.6 V RMS capacitor nameplate characterization do not cover the 290 kHz production minimum, 400 kHz behavioral scenario, DC bias, ESR, ripple current, loss, current sharing, or physical passive behavior. Every switching, effective-capacitance, passive-current, loss, physical-model, full-BOM, selected-semiconductor, eligibility, ranking, and safety authority remains unavailable.",
    },
  );
}

interface SelectedSemiconductorApplicationGoldenContractDocument {
  format?: unknown;
  schemaVersion?: unknown;
  engines?: {
    native?: { version?: unknown; solverClaim?: unknown };
    browserWasm?: { module?: unknown; engineVersion?: unknown; simulatorVersion?: unknown; solver?: unknown };
  };
  evidenceBoundary?: {
    modelTier?: unknown;
    attestation?: unknown;
    productionProfilesUsed?: unknown;
    productionObservationCandidateEligible?: unknown;
    benchOperatingConditionsWithinReviewedEvidence?: unknown;
    productionRequestConditionsEvaluated?: unknown;
    productionConstraintEligibility?: unknown;
    rankingAuthority?: unknown;
    fullBomCoverage?: unknown;
    doesNotProve?: unknown;
  };
  case?: {
    id?: unknown;
    application?: unknown;
    presetId?: unknown;
    observationKind?: unknown;
    candidateId?: unknown;
    candidateIndex?: unknown;
    recipe?: { id?: unknown; version?: unknown; contentHash?: unknown };
    requestHash?: unknown;
    resultContentHash?: unknown;
    constraintDecisionContentHash?: unknown;
    library?: { version?: unknown; contextManifestContentHash?: unknown; sourceReleaseContentHash?: unknown };
    selectedBinding?: {
      selectedComponentId?: unknown;
      role?: unknown;
      profileId?: unknown;
      profileContentHash?: unknown;
      manufacturerId?: unknown;
      manufacturerPartNumber?: unknown;
      quantityPerAssembly?: unknown;
      catalogAdmissionState?: unknown;
    };
    modelBinding?: {
      packageId?: unknown;
      packagePath?: unknown;
      componentContentHash?: unknown;
      factsContentHash?: unknown;
      fittedContentHash?: unknown;
      modelContentHash?: unknown;
      sourcesContentHash?: unknown;
      validationResultsContentHash?: unknown;
      expectationsContentHash?: unknown;
      modelName?: unknown;
      modelType?: unknown;
      fidelityTier?: unknown;
      electricalFamily?: unknown;
      evidenceContractVersion?: unknown;
      generator?: unknown;
      reviewer?: unknown;
      supportedAnalyses?: unknown;
      domainCoverage?: unknown;
      strictAdmission?: unknown;
    };
    sourceBinding?: { kind?: unknown; url?: unknown; revision?: unknown; sha256?: unknown; pagesReferenced?: unknown };
    benchId?: unknown;
    analysis?: unknown;
    fixture?: unknown;
    netlistContentHash?: unknown;
    selectedVectors?: unknown;
    observationContract?: SelectedSemiconductorObservationContractDocument;
  };
}

interface SelectedSemiconductorObservationContractDocument {
  kind?: unknown;
  instanceCount?: unknown;
  temperatureC?: unknown;
  gateVoltageV?: unknown;
  forcedDrainCurrentA?: unknown;
  reviewedMaximumRdsOhm?: unknown;
  conditionId?: unknown;
  resistanceEvidenceId?: unknown;
  maximumInstanceSpreadOhm?: unknown;
  maximumCrossEngineRdsRelativeDifference?: unknown;
  productionRequestConditions?: unknown;
  interpretation?: unknown;
}

interface SelectedSemiconductorExecutionMeasurementsDocument {
  sampleCount?: unknown;
  instanceCount?: unknown;
  drainVoltagesV?: unknown;
  rdsOhm?: unknown;
  minimumRdsOhm?: unknown;
  maximumRdsOhm?: unknown;
  instanceSpreadOhm?: unknown;
  allWithinReviewedMaximum?: unknown;
  productionRequestConditionsEvaluated?: unknown;
}

interface SelectedSemiconductorExecutionReportDocument {
  format?: unknown;
  schemaVersion?: unknown;
  contractContentHash?: unknown;
  evidenceBoundary?: unknown;
  pass?: unknown;
  case?: {
    id?: unknown;
    application?: unknown;
    presetId?: unknown;
    observationKind?: unknown;
    candidateId?: unknown;
    candidateIndex?: unknown;
    recipe?: unknown;
    requestHash?: unknown;
    resultContentHash?: unknown;
    constraintDecisionContentHash?: unknown;
    library?: unknown;
    selectedBinding?: unknown;
    modelBinding?: unknown;
    sourceBinding?: unknown;
    benchId?: unknown;
    analysis?: unknown;
    modelTier?: unknown;
    attestation?: unknown;
    engineIdentity?: { id?: unknown; buildVersion?: unknown; simulatorVersion?: unknown; solver?: unknown; numericFormat?: unknown };
    netlistContentHash?: unknown;
    sampleContentHash?: unknown;
    receiptContentHash?: unknown;
    repeatableBrowserReceipt?: unknown;
    selectedVectors?: Array<{
      name?: unknown;
      metric?: unknown;
      nativeValue?: unknown;
      browserWasmValue?: unknown;
      maxAbsError?: unknown;
      maxRelativeError?: unknown;
    }>;
    fullVectorComparisonPass?: unknown;
    fullVectorComparisonIsReleaseGate?: unknown;
    native?: SelectedSemiconductorExecutionMeasurementsDocument;
    browserWasm?: SelectedSemiconductorExecutionMeasurementsDocument;
    maximumCrossEngineRdsRelativeDifference?: unknown;
    benchOperatingConditionsWithinReviewedEvidence?: unknown;
    productionRequestConditionsEvaluated?: unknown;
    productionConstraintEligibility?: unknown;
    rankingAuthority?: unknown;
    fullBomCoverage?: unknown;
    pass?: unknown;
  };
}

function parseOptionalJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function selectedSemiconductorExecutionMeasurementsValid(
  value: SelectedSemiconductorExecutionMeasurementsDocument | undefined,
  observation: SelectedSemiconductorObservationContractDocument | undefined,
): boolean {
  if (value === undefined || observation === undefined
    || typeof observation.instanceCount !== "number"
    || typeof observation.forcedDrainCurrentA !== "number"
    || typeof observation.reviewedMaximumRdsOhm !== "number"
    || typeof observation.maximumInstanceSpreadOhm !== "number"
    || !Array.isArray(value.drainVoltagesV)
    || !Array.isArray(value.rdsOhm)) return false;
  const drainVoltagesV = value.drainVoltagesV;
  const rdsOhm = value.rdsOhm;
  const forcedDrainCurrentA = observation.forcedDrainCurrentA;
  if (drainVoltagesV.length !== observation.instanceCount || rdsOhm.length !== observation.instanceCount
    || !drainVoltagesV.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0)
    || !rdsOhm.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0)) return false;
  const minimum = Math.min(...rdsOhm);
  const maximum = Math.max(...rdsOhm);
  const spread = maximum - minimum;
  return value.sampleCount === 1
    && value.instanceCount === observation.instanceCount
    && rdsOhm.every((entry, index) => entry === drainVoltagesV[index]! / forcedDrainCurrentA)
    && maximum <= observation.reviewedMaximumRdsOhm
    && value.minimumRdsOhm === minimum
    && value.maximumRdsOhm === maximum
    && value.instanceSpreadOhm === spread
    && spread <= observation.maximumInstanceSpreadOhm
    && value.allWithinReviewedMaximum === true
    && value.productionRequestConditionsEvaluated === false;
}

export interface SelectedSemiconductorStoredValidationAssessmentV1 {
  implemented: boolean;
  checks: {
    aggregatePass: boolean;
    strictDualEngineExpectations: boolean;
    exactStoredEngineIdentities: boolean;
    exactModelArtifactHash: boolean;
    exactOperatingPointBenchSetAndHashes: boolean;
    everyNativeAndBrowserCheckPassed: boolean;
  };
}

export function assessSelectedSemiconductorStoredValidationV1(
  validationText: string,
  modelText: string,
  rdsonBenchText: string,
  thresholdBenchText: string,
): SelectedSemiconductorStoredValidationAssessmentV1 {
  const validation = parseOptionalJson<{
    native_wasm_all_pass?: unknown;
    expectations_all_pass?: unknown;
    expectation_pass_count?: unknown;
    expectation_fail_count?: unknown;
    strict_dual_engine_expectations?: unknown;
    engines?: {
      native?: { version?: unknown };
      browser_wasm?: { version?: unknown; ngspice_version?: unknown };
    };
    artifact_hashes?: { model_cir?: unknown; benches?: Record<string, unknown> };
    benches?: Array<{
      test_netlist?: unknown;
      bench_sha256?: unknown;
      analysis?: unknown;
      native_wasm_pass?: unknown;
      engines?: {
        native?: { version?: unknown };
        browser_wasm?: { version?: unknown; ngspice_version?: unknown };
      };
      checks?: Array<{
        pass?: unknown;
        native?: { pass?: unknown };
        browser_wasm?: { pass?: unknown };
      }>;
    }>;
  }>(validationText);
  const sha256Text = (text: string): `sha256:${string}` => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
  const benches = validation?.benches ?? [];
  const allChecks = benches.flatMap((bench) => bench.checks ?? []);
  const exactEngine = (engines: {
    native?: { version?: unknown };
    browser_wasm?: { version?: unknown; ngspice_version?: unknown };
  } | undefined): boolean => engines?.native?.version === "ngspice-46"
    && engines.browser_wasm?.version === "ngspice-46-opencircuit-wasm1"
    && engines.browser_wasm.ngspice_version === "ngspice-46";
  const expectedBenchHashes: Record<string, `sha256:${string}`> = {
    "rdson.cir": sha256Text(rdsonBenchText),
    "threshold.cir": sha256Text(thresholdBenchText),
  };
  const observedBenchIds = benches
    .map((bench) => bench.test_netlist)
    .filter((entry): entry is string => typeof entry === "string")
    .sort();
  const checks = {
    aggregatePass: validation?.native_wasm_all_pass === true
      && validation.expectations_all_pass === true
      && validation.expectation_fail_count === 0
      && validation.expectation_pass_count === allChecks.length
      && allChecks.length > 0,
    strictDualEngineExpectations: validation?.strict_dual_engine_expectations === true,
    exactStoredEngineIdentities: exactEngine(validation?.engines)
      && benches.length === 2
      && benches.every((bench) => exactEngine(bench.engines)),
    exactModelArtifactHash: modelText.length > 0
      && validation?.artifact_hashes?.model_cir === sha256Text(modelText),
    exactOperatingPointBenchSetAndHashes: rdsonBenchText.length > 0
      && thresholdBenchText.length > 0
      && JSON.stringify(observedBenchIds) === JSON.stringify(["rdson.cir", "threshold.cir"])
      && benches.every((bench) => typeof bench.test_netlist === "string"
        && bench.analysis === "op"
        && bench.bench_sha256 === expectedBenchHashes[bench.test_netlist]
        && validation?.artifact_hashes?.benches?.[bench.test_netlist] === expectedBenchHashes[bench.test_netlist]),
    everyNativeAndBrowserCheckPassed: benches.length === 2
      && benches.every((bench) => bench.native_wasm_pass === true
        && Array.isArray(bench.checks)
        && bench.checks.length > 0
        && bench.checks.every((check) => check.pass === true
          && check.native?.pass === true
          && check.browser_wasm?.pass === true)),
  };
  return {
    implemented: Object.values(checks).every(Boolean),
    checks,
  };
}

export interface SelectedSemiconductorExpectationCohortAssessmentV1 {
  implemented: boolean;
  checks: {
    nonemptyF1Cohorts: boolean;
    exactReviewedCohortIdentities: boolean;
  };
}

export function assessSelectedSemiconductorExpectationCohortsV1(
  expectationsText: string,
): SelectedSemiconductorExpectationCohortAssessmentV1 {
  const expectations = parseOptionalJson<{
    evidence_cohorts?: Array<{
      cohort_id?: unknown;
      fidelity_tier?: unknown;
      evidence_ids?: unknown;
    }>;
  }>(expectationsText);
  const cohorts = expectations?.evidence_cohorts ?? [];
  const observed = cohorts.map((entry) => ({
    cohort_id: entry.cohort_id,
    fidelity_tier: entry.fidelity_tier,
    evidence_ids: entry.evidence_ids,
  }));
  const expected = [
    {
      cohort_id: "sha256:02b284f52a9973b82b3a440a0f5d4461bea078e4c34f34f3761c9f0cdc933d89",
      fidelity_tier: "F1",
      evidence_ids: ["sha256:cd106948f4a3205f7238690b5bd1cde3af99a32125edb10874af70c3b10ce6d3"],
    },
    {
      cohort_id: "sha256:eb68271ddc9729ee19cfb3bb44aa0c5ba4d4134252043fa463e8e50da57d5615",
      fidelity_tier: "F1",
      evidence_ids: ["sha256:19133942b07fa7ec8aeb66d49d0039dcf1b57358b9631f6eac4ee121f59513f0"],
    },
    {
      cohort_id: "sha256:f1f021bf67ae0521041b2438945e13ea99d77dff4e92f8b47b8409aeaf9ebe7a",
      fidelity_tier: "F1",
      evidence_ids: [
        "sha256:c6554cce55d6c54b3c2ea46ec96c17f5523cec2e21c4093dcdf3a990ecf273db",
        "sha256:df51d02877ef95c19fcb8b751bad82db8e17349a42e69b07386a8e1e1bf56d4a",
        "sha256:6e675e85780c42ebedf5133e9ced47c54ad22c4ec572da1d0ebfe8fcbd9ceea8",
      ],
    },
  ];
  const checks = {
    nonemptyF1Cohorts: cohorts.length > 0
      && cohorts.every((entry) => entry.fidelity_tier === "F1"
        && Array.isArray(entry.evidence_ids)
        && entry.evidence_ids.length > 0),
    exactReviewedCohortIdentities: JSON.stringify(observed) === JSON.stringify(expected),
  };
  return {
    implemented: Object.values(checks).every(Boolean),
    checks,
  };
}

interface RdsonProjectionIdentityDocument {
  requestHash?: string;
  resultContentHash?: string;
  constraintDecisionContentHash?: string;
  candidateId?: string;
  candidateIndex?: number;
  candidateEligible?: boolean;
  recipe?: { id?: string; version?: string; contentHash?: string };
  library?: { version?: string; contextManifestContentHash?: string; catalogReleaseContentHash?: string };
}

interface RdsonProjectionBindingDocument {
  selectedComponentId?: string;
  role?: string;
  profileId?: string;
  profileContentHash?: string;
  manufacturerId?: string;
  manufacturerPartNumber?: string;
  quantityPerAssembly?: number;
  catalogAdmissionState?: string;
}

interface RdsonProjectionSourceDocument {
  kind?: string;
  url?: string;
  revision?: string;
  contentHash?: string;
  locator?: string;
}

interface RdsonProjectionNumericContractDocument {
  kind?: string;
  instanceCount?: number;
  temperatureC?: number;
  gateConditionVoltageV?: number;
  forcedCurrentA?: number;
  reviewedMaximumRdsOhm?: number;
  expectedVoltageDropV?: number;
  maximumVoltageDropAbsoluteErrorV?: number;
  maximumInstanceSpreadV?: number;
  maximumCrossEngineVoltageDropRelativeDifference?: number;
  interpretation?: string;
}

interface RdsonProjectionContractDocument {
  format?: string;
  schemaVersion?: number;
  engines?: {
    native?: { version?: string; solverClaim?: string };
    browserWasm?: { module?: string; engineVersion?: string; simulatorVersion?: string; solver?: string };
  };
  evidenceBoundary?: {
    projectionKind?: string;
    attestation?: string;
    productionProfileUsed?: boolean;
    currentProductionObservationIdentity?: boolean;
    selectedPartDeviceEquationUsed?: boolean;
    physicalFidelityProved?: boolean;
    productionRequestConditionsEvaluated?: boolean;
    productionConstraintEligibility?: boolean;
    rankingAuthority?: boolean;
    fullBomCoverage?: boolean;
    claim?: string;
    purpose?: string;
    doesNotProve?: unknown;
  };
  case?: {
    id?: string;
    application?: string;
    presetId?: string;
    observationKind?: string;
    currentIdentity?: RdsonProjectionIdentityDocument;
    selectedBinding?: RdsonProjectionBindingDocument;
    sourceBinding?: RdsonProjectionSourceDocument;
    analysis?: string;
    fixture?: string;
    netlistContentHash?: string;
    selectedVectors?: unknown;
    projectionContract?: RdsonProjectionNumericContractDocument;
  };
}

interface RdsonProjectionMeasurementDocument {
  sampleCount?: number;
  instanceCount?: number;
  voltageDropsV?: unknown;
  apparentResistanceOhm?: unknown;
  maximumVoltageDropAbsoluteErrorV?: number;
  maximumInstanceSpreadV?: number;
  conditionsBoundToReviewedProfile?: boolean;
  selectedPartDeviceEquationUsed?: boolean;
  physicalFidelityProved?: boolean;
}

interface RdsonProjectionReportDocument {
  format?: string;
  schemaVersion?: number;
  contractContentHash?: string;
  evidenceBoundary?: unknown;
  case?: {
    id?: string;
    application?: string;
    presetId?: string;
    observationKind?: string;
    currentIdentity?: unknown;
    selectedBinding?: unknown;
    sourceBinding?: unknown;
    analysis?: string;
    projectionKind?: string;
    attestation?: string;
    engineIdentity?: { id?: string; buildVersion?: string; simulatorVersion?: string; solver?: string; numericFormat?: string };
    netlistContentHash?: string;
    sampleContentHash?: string;
    receiptContentHash?: string;
    repeatableBrowserReceipt?: boolean;
    selectedVectors?: Array<{
      name?: string;
      metric?: string;
      maxAbsError?: number;
      maxRelativeError?: number;
      nativeValue?: number;
      browserWasmValue?: number;
    }>;
    fullVectorComparisonPass?: boolean;
    fullVectorComparisonIsReleaseGate?: boolean;
    native?: RdsonProjectionMeasurementDocument;
    browserWasm?: RdsonProjectionMeasurementDocument;
    maximumCrossEngineVoltageDropRelativeDifference?: number;
    selectedPartDeviceEquationUsed?: boolean;
    physicalFidelityProved?: boolean;
    productionRequestConditionsEvaluated?: boolean;
    productionConstraintEligibility?: boolean;
    rankingAuthority?: boolean;
    fullBomCoverage?: boolean;
    pass?: boolean;
  };
  pass?: boolean;
}

function selectedSemiconductorRdsonProjectionGate(
  release: DesignCatalogReleaseV1,
  admission: DesignProfileAdmissionLedgerV1,
): DesignerReleaseGateV1 {
  const contractText = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-rdson-projection/contract.json");
  const fixtureText = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-rdson-projection/fixtures/csd18540q5b-four-ideal-rdson-resistors.cir");
  const executionReportText = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-rdson-projection/execution-report.json");
  const identityTest = optionalRepoText("packages/sim-engine/test/selected-semiconductor-rdson-projection.test.ts");
  const runner = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-rdson-projection.mjs");
  const reportTest = optionalRepoText("tools/native-ngspice-reference/test/selected-semiconductor-rdson-projection-report.test.mjs");
  const harnessPackage = optionalRepoText("tools/native-ngspice-reference/package.json");
  const continuousIntegration = optionalRepoText(".github/workflows/ci.yml");
  const profilePath = "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";
  const profileText = optionalRepoText(profilePath);
  const contract = parseOptionalJson<RdsonProjectionContractDocument>(contractText);
  const executionReport = parseOptionalJson<RdsonProjectionReportDocument>(executionReportText);
  const profile = parseOptionalJson<{
    part?: { manufacturerId?: string; manufacturerPartNumber?: string };
    facts?: {
      onResistance?: {
        value?: { value?: number; unit?: string; displayUnit?: string };
        state?: string;
        evidence?: Array<{ contentHash?: string; url?: string; revision?: string; locator?: string }>;
        validFor?: Array<{
          parameterId?: string;
          minimum?: { value?: number; unit?: string } | null;
          maximum?: { value?: number; unit?: string } | null;
        }>;
      };
    };
  }>(profileText);
  const testCase = contract?.case;
  const identity = testCase?.currentIdentity;
  const selectedBinding = testCase?.selectedBinding;
  const sourceBinding = testCase?.sourceBinding;
  const projection = testCase?.projectionContract;
  const executionCase = executionReport?.case;
  const catalogProfile = release.profiles.find((entry) => entry.profileId === profilePath);
  const admissionEntry = admission.entries.find((entry) => entry.profilePath === profilePath);
  const ciWiring = assessSelectedSemiconductorRdsonProjectionCiWiringV1(continuousIntegration, harnessPackage);
  const executableEvidence = assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
    identityTest,
    reportTest,
    runner,
  );
  const hashText = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
  const contractContentHash = contractText.length > 0 ? hashText(contractText) : null;
  const executionArtifactContentHash = executionReportText.length > 0 ? hashText(executionReportText) : null;
  const expectedFixture = [
    "scheMAGIC CSD18540Q5B ideal reviewed-RDS(on) projection",
    "* four independent ideal 2.2 mOhm resistors; no transistor equation or selected-part device",
    "* reviewed resistance conditions only: TA=25 C, VGS=10 V, ID=28 A",
    "* expected ideal voltage drop per instance: 61.6 mV",
    ".temp 25",
    "R1 d1 0 2.2m",
    "I1 0 d1 DC 28",
    "R2 d2 0 2.2m",
    "I2 0 d2 DC 28",
    "R3 d3 0 2.2m",
    "I3 0 d3 DC 28",
    "R4 d4 0 2.2m",
    "I4 0 d4 DC 28",
    ".op",
    ".end",
    "",
  ].join("\n");
  const profileConditions = profile?.facts?.onResistance?.validFor ?? [];
  const exactProfileConditions = JSON.stringify(profileConditions.map((entry) => [
    entry.parameterId,
    entry.minimum?.value ?? null,
    entry.minimum?.unit ?? null,
    entry.maximum?.value ?? null,
    entry.maximum?.unit ?? null,
  ])) === JSON.stringify([
    ["ambientTemperature", 298.15, "K", 298.15, "K"],
    ["drainCurrent", 28, "A", 28, "A"],
    ["gateVoltage", 10, "V", 10, "V"],
  ]);
  const exactMeasurement = (value: RdsonProjectionMeasurementDocument | undefined): boolean => value !== undefined
    && value.sampleCount === 1
    && value.instanceCount === 4
    && JSON.stringify(value.voltageDropsV) === JSON.stringify([0.0616, 0.0616, 0.0616, 0.0616])
    && JSON.stringify(value.apparentResistanceOhm) === JSON.stringify([0.0022, 0.0022, 0.0022, 0.0022])
    && value.maximumVoltageDropAbsoluteErrorV === 0
    && value.maximumInstanceSpreadV === 0
    && value.conditionsBoundToReviewedProfile === true
    && value.selectedPartDeviceEquationUsed === false
    && value.physicalFidelityProved === false;
  const exclusions = Array.isArray(contract?.evidenceBoundary?.doesNotProve)
    ? contract.evidenceBoundary.doesNotProve.filter((entry): entry is string => typeof entry === "string").join("\n")
    : "";
  const implemented = {
    closedIdealReviewedRdsonProjectionContract: contract?.format === "opencircuit-selected-semiconductor-rdson-projection-contract"
      && contract.schemaVersion === 1
      && contractText === `${JSON.stringify(contract, null, 2)}\n`
      && contract.engines?.native?.version === "ngspice-46"
      && contract.engines.native.solverClaim === "unverified"
      && contract.engines.browserWasm?.module === "../../ngspice-wasm-build/dist-loader/index.mjs"
      && contract.engines.browserWasm.engineVersion === "ngspice-46-opencircuit-wasm1"
      && contract.engines.browserWasm.simulatorVersion === "ngspice-46"
      && contract.engines.browserWasm.solver === "KLU"
      && contract.evidenceBoundary?.projectionKind === "ideal_reviewed_maximum_rdson_resistors"
      && contract.evidenceBoundary.attestation === "none"
      && contract.evidenceBoundary.productionProfileUsed === true
      && contract.evidenceBoundary.currentProductionObservationIdentity === true
      && contract.evidenceBoundary.selectedPartDeviceEquationUsed === false
      && contract.evidenceBoundary.physicalFidelityProved === false
      && contract.evidenceBoundary.productionRequestConditionsEvaluated === false
      && contract.evidenceBoundary.productionConstraintEligibility === false
      && contract.evidenceBoundary.rankingAuthority === false
      && contract.evidenceBoundary.fullBomCoverage === false,
    exactCurrentProductionObservationIdentity: testCase?.id === "motor.production.external-24v.csd18540q5b.ideal-reviewed-rdson-projection"
      && testCase.application === "motor.brushed-dc"
      && testCase.presetId === "motor.external-24v"
      && testCase.observationKind === "production_constraint_observation"
      && identity?.requestHash === "sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f"
      && identity.resultContentHash === "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176"
      && identity.constraintDecisionContentHash === "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e"
      && identity.candidateId === "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed"
      && identity.candidateIndex === 0
      && identity.candidateEligible === false
      && identity.recipe?.id === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"
      && identity.recipe.version === "3.1.7"
      && identity.recipe.contentHash === "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947"
      && identity.library?.version === "2026-08-27.2"
      && identity.library.contextManifestContentHash === "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38"
      && identity.library.catalogReleaseContentHash === "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e"
      && release.version === identity.library.version
      && release.contentHash === identity.library.catalogReleaseContentHash,
    exactReviewedProfileAndSource: selectedBinding?.selectedComponentId === "mosfet"
      && selectedBinding.role === "bridge-n-channel-power-mosfet"
      && selectedBinding.profileId === profilePath
      && selectedBinding.profileContentHash === "sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8"
      && selectedBinding.manufacturerId === "texas-instruments"
      && selectedBinding.manufacturerPartNumber === "CSD18540Q5B"
      && selectedBinding.quantityPerAssembly === 4
      && selectedBinding.catalogAdmissionState === "reviewed"
      && release.version === identity?.library?.version
      && release.contentHash === identity?.library?.catalogReleaseContentHash
      && catalogProfile?.profileContentHash === selectedBinding.profileContentHash
      && admissionEntry?.state === "reviewed"
      && admissionEntry.profileContentHash === selectedBinding.profileContentHash
      && typeof admissionEntry.reviewedBy === "string"
      && profile?.part?.manufacturerId === selectedBinding.manufacturerId
      && profile.part.manufacturerPartNumber === selectedBinding.manufacturerPartNumber
      && profile.facts?.onResistance?.state === "reviewed"
      && profile.facts.onResistance.value?.value === 0.0022
      && profile.facts.onResistance.value.unit === "ohm"
      && profile.facts.onResistance.value.displayUnit === "2.2 mOhm maximum"
      && profile.facts.onResistance.evidence?.some((entry) => (
        entry.contentHash === "sha256:2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0"
        && entry.contentHash === sourceBinding?.contentHash
        && entry.url === sourceBinding.url
        && entry.revision === sourceBinding.revision
        && entry.locator === sourceBinding.locator
      )) === true
      && sourceBinding?.kind === "manufacturer_datasheet"
      && sourceBinding.url === "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf"
      && sourceBinding.contentHash === "sha256:2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0"
      && exactProfileConditions,
    exactFourIdealResistorFixture: testCase?.analysis === "op"
      && testCase.fixture === "fixtures/csd18540q5b-four-ideal-rdson-resistors.cir"
      && fixtureText === expectedFixture
      && testCase.netlistContentHash === hashText(fixtureText)
      && fixtureText.match(/^R[1-4]\s+d[1-4]\s+0\s+2\.2m$/gmu)?.length === 4
      && fixtureText.match(/^I[1-4]\s+0\s+d[1-4]\s+DC\s+28$/gmu)?.length === 4
      && !/^[ \t]*\.(?:model|subckt|include|lib|tran|ac|noise)\b/imu.test(fixtureText)
      && !/^M\S*\s/gmu.test(fixtureText)
      && JSON.stringify(testCase.selectedVectors) === JSON.stringify(["v(d1)", "v(d2)", "v(d3)", "v(d4)"])
      && projection?.kind === "four-ideal-reviewed-maximum-rdson-resistors"
      && projection.instanceCount === 4
      && projection.temperatureC === 25
      && projection.gateConditionVoltageV === 10
      && projection.forcedCurrentA === 28
      && projection.reviewedMaximumRdsOhm === 0.0022
      && projection.expectedVoltageDropV === 0.0616
      && projection.maximumVoltageDropAbsoluteErrorV === 1e-9
      && projection.maximumInstanceSpreadV === 1e-12
      && projection.maximumCrossEngineVoltageDropRelativeDifference === 1e-6
      && projection.interpretation === "ideal_reviewed_rdson_projection_only",
    generatedCurrentIdentityTest: executableEvidence.checks.exactIdentityTestContentHash
      && executableEvidence.checks.activeCurrentIdentityTestSuite
      && identityTest.includes("currentExternalMotorObservation")
      && identityTest.includes("request.constraints.allowUnknownHardConstraints = true")
      && identityTest.includes("CONTRACT.case.currentIdentity.requestHash")
      && identityTest.includes("CONTRACT.case.currentIdentity.resultContentHash")
      && identityTest.includes("CONTRACT.case.currentIdentity.constraintDecisionContentHash")
      && identityTest.includes("CONTRACT.case.currentIdentity.candidateId")
      && identityTest.includes("quantityPerAssembly: CONTRACT.case.selectedBinding.quantityPerAssembly")
      && identityTest.includes("candidate.constraints.some((entry) => entry.status === \"unknown\")")
      && identityTest.includes("CONTRACT.evidenceBoundary.productionConstraintEligibility"),
    nativeAndWasmIdealProjectionRunner: executableEvidence.checks.exactRunnerContentHash
      && executableEvidence.checks.executableRunnerMain
      && runner.includes("runNative({ netlist")
      && runner.includes('browserWorker.run(netlist, "runOpPoint"')
      && runner.includes("selectedComparison(comparison, testCase.selectedVectors)")
      && runner.includes("Projection requires exactly four ideal 2.2 mOhm resistors")
      && runner.includes("Projection requires exactly four 28 A DC injections")
      && runner.includes("firstReceipt.attestation === \"none\"")
      && runner.includes("firstReceipt.netlistContentHash === testCase.netlistContentHash")
      && runner.includes("selectedPartDeviceEquationUsed: false")
      && runner.includes("physicalFidelityProved: false")
      && runner.includes("verifyPersistedExecutionReport(report, contract, contractContentHash, EXECUTION_REPORT_PATH)"),
    canonicalExecutionArtifact: executionReport?.format === "opencircuit-selected-semiconductor-rdson-projection-report"
      && executionReport.schemaVersion === 1
      && executionReportText === `${JSON.stringify(executionReport, null, 2)}\n`
      && executionReport.contractContentHash === contractContentHash
      && JSON.stringify(executionReport.evidenceBoundary) === JSON.stringify(contract?.evidenceBoundary)
      && executionCase !== undefined
      && executionCase.id === testCase?.id
      && executionCase.application === testCase?.application
      && executionCase.presetId === testCase?.presetId
      && executionCase.observationKind === testCase?.observationKind
      && JSON.stringify(executionCase.currentIdentity) === JSON.stringify(identity)
      && JSON.stringify(executionCase.selectedBinding) === JSON.stringify(selectedBinding)
      && JSON.stringify(executionCase.sourceBinding) === JSON.stringify(sourceBinding)
      && executionCase.analysis === "op"
      && executionCase.projectionKind === "ideal_reviewed_maximum_rdson_resistors"
      && executionCase.attestation === "none"
      && executionCase.engineIdentity?.id === "@opencircuit/ngspice-wasm"
      && executionCase.engineIdentity.buildVersion === "ngspice-46-opencircuit-wasm1"
      && executionCase.engineIdentity.simulatorVersion === "ngspice-46"
      && executionCase.engineIdentity.solver === "KLU"
      && executionCase.engineIdentity.numericFormat === "ieee754-binary64"
      && executionCase.netlistContentHash === testCase?.netlistContentHash
      && typeof executionCase.sampleContentHash === "string"
      && /^sha256:[0-9a-f]{64}$/u.test(executionCase.sampleContentHash)
      && typeof executionCase.receiptContentHash === "string"
      && /^sha256:[0-9a-f]{64}$/u.test(executionCase.receiptContentHash)
      && executionCase.repeatableBrowserReceipt === true
      && executionCase.selectedVectors?.length === 4
      && executionCase.selectedVectors.every((entry, index) => (
        entry.name === `v(d${index + 1})`
        && entry.metric === "point-relative"
        && entry.maxAbsError === 0
        && entry.maxRelativeError === 0
        && entry.nativeValue === 0.0616
        && entry.browserWasmValue === 0.0616
      )) === true
      && executionCase.fullVectorComparisonPass === true
      && executionCase.fullVectorComparisonIsReleaseGate === false
      && exactMeasurement(executionCase.native)
      && exactMeasurement(executionCase.browserWasm)
      && executionCase.maximumCrossEngineVoltageDropRelativeDifference === 0
      && executionCase.selectedPartDeviceEquationUsed === false
      && executionCase.physicalFidelityProved === false
      && executionCase.productionRequestConditionsEvaluated === false
      && executionCase.productionConstraintEligibility === false
      && executionCase.rankingAuthority === false
      && executionCase.fullBomCoverage === false
      && executionCase.pass === true
      && executionReport.pass === true
      && executableEvidence.checks.exactReportTestContentHash
      && executableEvidence.checks.activePersistedReportTamperTests
      && reportTest.includes("validateSelectedSemiconductorRdsonProjectionReport")
      && reportTest.includes("rejects projection identity, quantity, evidence, receipt, numerical, and claim drift")
      && reportTest.includes("strictly validates the reviewed profile and ideal-resistor contract on the persisted path"),
    explicitBoundedClaimExclusions: /transistor-equation.*selected-part SPICE fidelity/isu.test(exclusions)
      && /switching.*transient.*Miller.*reverse recovery.*body-diode.*avalanche.*SOA.*thermal.*self-heating.*parasitic/isu.test(exclusions)
      && /40 C.*5 A.*20 A.*18-30 V.*20 kHz.*80%-duty/isu.test(exclusions)
      && /gate-driver.*TVS.*motor.*capacitor.*shunt.*full-BOM/isu.test(exclusions)
      && /eligibility.*ranking.*safety.*provider approval.*commercial availability.*release readiness/isu.test(exclusions),
    conditionalContinuousIntegrationWiring: ciWiring.implemented,
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `selected_semiconductor_rdson_projection_missing:${name}`);
  return gate(
    "simulation.selected-semiconductor-ideal-rdson-projection-golden",
    blockers.length === 0 ? "pass" : "blocked",
    blockers,
    {
      implemented,
      contractContentHash,
      executionResultAttached: implemented.canonicalExecutionArtifact,
      executionArtifactAttested: false,
      caseId: typeof testCase?.id === "string" ? testCase.id : null,
      currentIdentity: identity ?? null,
      currentCatalogRelease: {
        version: release.version,
        contentHash: release.contentHash,
      },
      persistedProjectionCatalogRelease: {
        version: identity?.library?.version ?? null,
        contentHash: identity?.library?.catalogReleaseContentHash ?? null,
      },
      selectedBinding: selectedBinding ?? null,
      sourceBinding: sourceBinding ?? null,
      projectionContract: projection ?? null,
      ciWiringChecks: ciWiring.checks,
      executableEvidence,
      executionArtifact: implemented.canonicalExecutionArtifact ? {
        contentHash: executionArtifactContentHash,
        byteLength: Buffer.byteLength(executionReportText, "utf8"),
        sampleContentHash: executionCase?.sampleContentHash ?? null,
        browserReceiptContentHash: executionCase?.receiptContentHash ?? null,
        nativeVoltageDropsV: executionCase?.native?.voltageDropsV ?? null,
        browserWasmVoltageDropsV: executionCase?.browserWasm?.voltageDropsV ?? null,
        validation: "canonical_current_identity_bound_unattested_ideal_reviewed_rdson_projection",
      } : null,
      selectedPartDeviceEquationUsed: false,
      physicalFidelityProved: false,
      productionRequestConditionsEvaluated: false,
      productionConstraintEligibility: false,
      rankingAuthority: false,
      fullBomCoverage: false,
      claimBoundary: "A pass proves only that the exact current ineligible external-Motor candidate's four reviewed CSD18540Q5B selections are identity-bound to four independent ideal 2.2 mOhm resistors, each producing the expected 61.6 mV drop at a 28 A DC injection on native ngspice 46 and browser-WASM. The resistance value is bound to the reviewed 25 C, VGS 10 V, ID 28 A table condition. It is not transistor-equation or physical selected-part fidelity and does not evaluate the production request, switching, transient, gate charge, Miller, recovery, body diode, avalanche, SOA, thermal, parasitic, full-BOM, eligibility, ranking, safety, provider, commercial, or release behavior.",
    },
  );
}

function selectedSemiconductorApplicationGoldenContractGate(
  release: DesignCatalogReleaseV1,
  admission: DesignProfileAdmissionLedgerV1,
): DesignerReleaseGateV1 {
  const contractText = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-application-golden/contract.json");
  const fixtureText = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-application-golden/fixtures/csd18540q5b-four-selected-op.cir");
  const executionReportText = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-application-golden/execution-report.json");
  const identityTest = optionalRepoText("packages/sim-engine/test/selected-semiconductor-application-golden.test.ts");
  const motorObservationTest = optionalRepoText("packages/motor-designer/test/v3-constraint-observation.test.ts");
  const motorGenerationTest = optionalRepoText("packages/motor-designer/test/v2-compatibility.test.ts");
  const externalMotor = optionalRepoText("packages/design-recipes/src/motor-external-v2.ts");
  const motorRecipeTest = optionalRepoText("packages/design-recipes/test/motor-v2.test.ts");
  const webApplicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const reportTest = optionalRepoText("tools/native-ngspice-reference/test/selected-semiconductor-execution-report.test.mjs");
  const runner = optionalRepoText("tools/native-ngspice-reference/selected-semiconductor-application-golden.mjs");
  const harnessPackage = optionalRepoText("tools/native-ngspice-reference/package.json");
  const continuousIntegration = optionalRepoText(".github/workflows/ci.yml");
  const packageRoot = "packages/model-library/models/texas-instruments/CSD18540Q5B";
  const componentText = optionalRepoText(`${packageRoot}/component.json`);
  const factsText = optionalRepoText(`${packageRoot}/facts.json`);
  const fittedText = optionalRepoText(`${packageRoot}/fitted.json`);
  const modelText = optionalRepoText(`${packageRoot}/model.cir`);
  const sourcesText = optionalRepoText(`${packageRoot}/sources.json`);
  const validationText = optionalRepoText(`${packageRoot}/validation-results.json`);
  const expectationsText = optionalRepoText(`${packageRoot}/tests/expectations.json`);
  const rdsonBenchText = optionalRepoText(`${packageRoot}/tests/rdson.cir`);
  const thresholdBenchText = optionalRepoText(`${packageRoot}/tests/threshold.cir`);
  const admissionPolicyText = optionalRepoText("packages/model-library/admission-policy.json");
  const profileText = optionalRepoText("packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json");
  const contract = parseOptionalJson<SelectedSemiconductorApplicationGoldenContractDocument>(contractText);
  const executionReport = parseOptionalJson<SelectedSemiconductorExecutionReportDocument>(executionReportText);
  const component = parseOptionalJson<{
    canonical_mpn?: unknown;
    manufacturer?: unknown;
    electrical_family?: unknown;
    evidence_contract_version?: unknown;
    model_type?: unknown;
    fidelity_tier?: unknown;
    domain_coverage?: unknown;
    supported_analyses?: unknown;
    generator?: { tool_or_agent?: unknown };
    reviewer?: { tool_or_agent?: unknown };
    test_results?: { status?: unknown; pass_count?: unknown; fail_count?: unknown; total_count?: unknown };
  }>(componentText);
  const sources = parseOptionalJson<Array<{
    kind?: unknown;
    url?: unknown;
    revision?: unknown;
    sha256?: unknown;
    pages_referenced?: unknown;
    placeholder?: unknown;
  }>>(sourcesText);
  const expectations = parseOptionalJson<{
    tests?: Array<{
      analysis_type?: unknown;
      hard_bounds_checks?: Array<{
        maximum?: unknown;
        evidence_id?: unknown;
        condition_id?: unknown;
        bench_condition_id?: unknown;
      }>;
    }>;
  }>(expectationsText);
  const admissionPolicy = parseOptionalJson<{
    legacy_inventory?: { packages?: unknown };
    strict_evidence_contract_packages?: unknown;
  }>(admissionPolicyText);
  const profile = parseOptionalJson<{
    part?: { manufacturerId?: unknown; manufacturerPartNumber?: unknown };
    facts?: {
      onResistance?: {
        state?: unknown;
        value?: { value?: unknown; unit?: unknown };
        evidence?: Array<{ contentHash?: unknown; url?: unknown }>;
        validFor?: Array<{
          parameterId?: unknown;
          minimum?: { value?: unknown; unit?: unknown };
          maximum?: { value?: unknown; unit?: unknown };
        }>;
      };
    };
  }>(profileText);
  const ciWiring = assessSelectedSemiconductorCiWiringV1(continuousIntegration, harnessPackage);
  const storedValidation = assessSelectedSemiconductorStoredValidationV1(
    validationText,
    modelText,
    rdsonBenchText,
    thresholdBenchText,
  );
  const expectationCohorts = assessSelectedSemiconductorExpectationCohortsV1(expectationsText);
  const testCase = contract?.case;
  const observation = testCase?.observationContract;
  const executionCase = executionReport?.case;
  const contractContentHash = contractText.length > 0
    ? `sha256:${createHash("sha256").update(contractText, "utf8").digest("hex")}`
    : null;
  const executionArtifactContentHash = executionReportText.length > 0
    ? `sha256:${createHash("sha256").update(executionReportText, "utf8").digest("hex")}`
    : null;
  const installedExternalLaneHasIneligibleObservations = motorObservationTest.includes(
    "observes the exact MIC4606-2 direct-gate structure without inventing a gate resistor or eligibility",
  )
    && motorObservationTest.includes("result: generation.observation.result.contentHash")
    && motorObservationTest.includes('result: "sha256:01b56be6e6dfc3ca46bb36550f6999571d19bd109e73e99d29d308a69a7733b3"')
    && motorObservationTest.includes("expect(generation.observation.result.candidates).toHaveLength(2)")
    && motorObservationTest.includes("expect(generation.decision.candidates).toHaveLength(2)")
    && motorObservationTest.includes("materialized: 54,")
    && motorObservationTest.includes("pareto: 2,")
    && motorObservationTest.includes("rejected: 52,")
    && motorObservationTest.includes('rejection.reasonCode === "pareto_dominated"')
    && motorObservationTest.includes('component.id === "gate-resistor" || component.role === "mosfet-gate-resistor"')
    && motorObservationTest.includes('wire.id === "gate-drive-direct-to-bridge"')
    && motorObservationTest.includes('contentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135"')
    && motorObservationTest.includes("expect(generation.decision.source.resultContentHash).toBe(generation.observation.result.contentHash)")
    && motorObservationTest.includes("decision: generation.decision.contentHash")
    && motorObservationTest.includes('decision: "sha256:f7dafa7fd6397b7a3fcfe43f12a93e0b05017faa0f91d25ae846584c5afe0604"')
    && motorObservationTest.includes('"candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152"')
    && motorObservationTest.includes('"candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382"')
    && motorObservationTest.includes('rule.disposition === "satisfied")).toHaveLength(9)')
    && motorObservationTest.includes('rule.disposition !== "satisfied")).toHaveLength(21)')
    && motorGenerationTest.includes("strictResult: strict.result.contentHash")
    && motorGenerationTest.includes('strictResult: "sha256:b0bf69fc7bac1accbaf0232204f14ae243bb59d6401b979b370e2b40b1e65a77"')
    && motorGenerationTest.includes('strictExecution: "sha256:a776a7eea754a7a7724d4df2663693f11eaeb3485784b7d2e7e9e0b7107590da"')
    && motorGenerationTest.includes('permissiveResult: "sha256:01b56be6e6dfc3ca46bb36550f6999571d19bd109e73e99d29d308a69a7733b3"')
    && motorGenerationTest.includes('permissiveExecution: "sha256:5b45a733cea233ab9c9c36603747e623e2cb6031dfbb4b22c1020cff86af1fce"')
    && motorGenerationTest.includes('"candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152"')
    && motorGenerationTest.includes('"candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382"')
    && webApplicationsTest.includes("keeps exact MIC4606-2 direct-gate observations structural and V3-ineligible")
    && webApplicationsTest.includes('strictResult: "sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435"')
    && webApplicationsTest.includes('permissiveResult: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176"')
    && webApplicationsTest.includes('decision: "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e"')
    && webApplicationsTest.includes('"candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed"')
    && webApplicationsTest.includes('"candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70"')
    && exactExternalMotorDirectGateCountsImplemented(webApplicationsTest)
    && exactExternalMotorCapacitorRoleContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorInterfaceQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorTvsVoltageQualifiedContractImplemented(externalMotor, motorRecipeTest);
  const hashText = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
  const sourceBinding = testCase?.sourceBinding;
  const selectedBinding = testCase?.selectedBinding;
  const modelBinding = testCase?.modelBinding;
  const catalogProfile = release.profiles.find((entry) => entry.profileId === selectedBinding?.profileId);
  const admissionEntry = admission.entries.find((entry) => entry.profilePath === selectedBinding?.profileId);
  const expectedDomainCoverage = { dc: "approx", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" };
  const expectedProductionRequestConditions = {
    ambientTemperatureC: 40,
    loadCurrentA: 5,
    stallCurrentA: 20,
    supplyMinimumV: 18,
    supplyNominalV: 24,
    supplyMaximumV: 30,
    pwmFrequencyHz: 20000,
    dutyCycle: 0.8,
    evaluated: false,
  };
  const expectedFixture = modelText.length === 0 ? "" : [
    "scheMAGIC selected semiconductor F1 reviewed DC operating point",
    "* exact selected quantity: four CSD18540Q5B instances",
    "* reviewed table point only: TA=25C, VGS=10V, ID=28A",
    "* not the 40C/5A/18-30V/20kHz/80%-duty production request",
    modelText.trimEnd(),
    "",
    ".temp 25",
    "M1 d1 g1 0 OC_TEXAS-INSTRUMENTS_CSD18540Q5B",
    "I1 0 d1 DC 28",
    "VG1 g1 0 DC 10",
    "M2 d2 g2 0 OC_TEXAS-INSTRUMENTS_CSD18540Q5B",
    "I2 0 d2 DC 28",
    "VG2 g2 0 DC 10",
    "M3 d3 g3 0 OC_TEXAS-INSTRUMENTS_CSD18540Q5B",
    "I3 0 d3 DC 28",
    "VG3 g3 0 DC 10",
    "M4 d4 g4 0 OC_TEXAS-INSTRUMENTS_CSD18540Q5B",
    "I4 0 d4 DC 28",
    "VG4 g4 0 DC 10",
    ".op",
    ".end",
    "",
  ].join("\n");
  const packageHashesMatch = modelBinding !== undefined
    && modelBinding.componentContentHash === hashText(componentText)
    && modelBinding.factsContentHash === hashText(factsText)
    && modelBinding.fittedContentHash === hashText(fittedText)
    && modelBinding.modelContentHash === hashText(modelText)
    && modelBinding.sourcesContentHash === hashText(sourcesText)
    && modelBinding.validationResultsContentHash === hashText(validationText)
    && modelBinding.expectationsContentHash === hashText(expectationsText);
  const componentReviewed = component !== null
    && component.canonical_mpn === "CSD18540Q5B"
    && component.manufacturer === "Texas Instruments"
    && component.electrical_family === "nmos"
    && component.evidence_contract_version === "1.0.0"
    && component.model_type === "dot_model"
    && component.fidelity_tier === "F1"
    && JSON.stringify(component.domain_coverage) === JSON.stringify(expectedDomainCoverage)
    && JSON.stringify(component.supported_analyses) === JSON.stringify(["operating_point"])
    && component.generator?.tool_or_agent === "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0"
    && component.generator.tool_or_agent === modelBinding?.generator
    && component.reviewer?.tool_or_agent === "gpt-5.6-sol independent package reviewer"
    && component.reviewer.tool_or_agent === modelBinding?.reviewer
    && component.generator.tool_or_agent.length > 0
    && component.reviewer.tool_or_agent.length > 0
    && !/pending/iu.test(component.reviewer.tool_or_agent)
    && String(component.reviewer.tool_or_agent) !== String(component.generator.tool_or_agent)
    && component.test_results?.status === "complete"
    && component.test_results.fail_count === 0
    && component.test_results.pass_count === component.test_results.total_count;
  const exactSource = sources !== null
    && sources.length === 1
    && sourceBinding?.kind === "datasheet"
    && sourceBinding.url === "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf"
    && sourceBinding.revision === "SLPS488B, June 2014, revised April 2017; packaged PDF generated 2025-11-11"
    && sourceBinding.sha256 === "2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0"
    && JSON.stringify(sourceBinding.pagesReferenced) === JSON.stringify(["1", "3", "11"])
    && sources[0]?.kind === sourceBinding?.kind
    && sources[0]?.url === sourceBinding?.url
    && sources[0]?.revision === sourceBinding?.revision
    && sources[0]?.sha256 === sourceBinding?.sha256
    && JSON.stringify(sources[0]?.pages_referenced) === JSON.stringify(sourceBinding?.pagesReferenced)
    && sources[0]?.placeholder === false;
  const strictAdmission = admissionPolicy !== null
    && Array.isArray(admissionPolicy.strict_evidence_contract_packages)
    && admissionPolicy.strict_evidence_contract_packages.includes("texas-instruments/CSD18540Q5B")
    && Array.isArray(admissionPolicy.legacy_inventory?.packages)
    && !admissionPolicy.legacy_inventory.packages.includes("texas-instruments/CSD18540Q5B");
  const validationPassed = storedValidation.implemented;
  const reviewedExpectation = expectations?.tests
    ?.filter((entry) => entry.analysis_type === "operating_point")
    .flatMap((entry) => entry.hard_bounds_checks ?? [])
    .find((entry) => entry.maximum === 0.0022);
  const profileConditions = profile?.facts?.onResistance?.validFor ?? [];
  const exactProfile = profile?.part?.manufacturerId === "texas-instruments"
    && profile.part.manufacturerPartNumber === "CSD18540Q5B"
    && profile.facts?.onResistance?.state === "reviewed"
    && profile.facts.onResistance.value?.value === 0.0022
    && profile.facts.onResistance.value.unit === "ohm"
    && profile.facts.onResistance.evidence?.some((entry) => entry.contentHash === `sha256:${sourceBinding?.sha256}` && entry.url === sourceBinding?.url) === true
    && JSON.stringify(profileConditions.map((entry) => [entry.parameterId, entry.minimum?.value, entry.minimum?.unit, entry.maximum?.value, entry.maximum?.unit]))
      === JSON.stringify([
        ["ambientTemperature", 298.15, "K", 298.15, "K"],
        ["drainCurrent", 28, "A", 28, "A"],
        ["gateVoltage", 10, "V", 10, "V"],
      ]);
  const nativeDrainVoltagesV = Array.isArray(executionCase?.native?.drainVoltagesV)
    && executionCase.native.drainVoltagesV.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    ? executionCase.native.drainVoltagesV
    : [];
  const browserDrainVoltagesV = Array.isArray(executionCase?.browserWasm?.drainVoltagesV)
    && executionCase.browserWasm.drainVoltagesV.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    ? executionCase.browserWasm.drainVoltagesV
    : [];
  const vectorsValid = nativeDrainVoltagesV.length === 4
    && browserDrainVoltagesV.length === 4
    && Array.isArray(executionCase?.selectedVectors)
    && executionCase.selectedVectors.length === 4
    && executionCase.selectedVectors.every((entry, index) => {
      if (entry.name !== `v(d${index + 1})` || entry.metric !== "point-relative"
        || typeof entry.nativeValue !== "number" || !Number.isFinite(entry.nativeValue) || entry.nativeValue <= 0
        || typeof entry.browserWasmValue !== "number" || !Number.isFinite(entry.browserWasmValue) || entry.browserWasmValue <= 0) return false;
      const observedAbsError = Math.abs(entry.browserWasmValue - entry.nativeValue);
      const observedRelativeError = observedAbsError / Math.max(Math.abs(entry.nativeValue), 1e-9);
      return entry.nativeValue === nativeDrainVoltagesV[index]
        && entry.browserWasmValue === browserDrainVoltagesV[index]
        && entry.maxAbsError === observedAbsError
        && entry.maxRelativeError === observedRelativeError
        && observedRelativeError <= 1e-3;
    });
  const nativeRdsOhm = Array.isArray(executionCase?.native?.rdsOhm)
    && executionCase.native.rdsOhm.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    ? executionCase.native.rdsOhm
    : [];
  const browserRdsOhm = Array.isArray(executionCase?.browserWasm?.rdsOhm)
    && executionCase.browserWasm.rdsOhm.every((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    ? executionCase.browserWasm.rdsOhm
    : [];
  const observedCrossEngineRdsRelativeDifference = nativeRdsOhm.length === 4 && browserRdsOhm.length === 4
    ? Math.max(...nativeRdsOhm.map((value, index) => (
      Math.abs(value - browserRdsOhm[index]!) / Math.max(Math.abs(value), Math.abs(browserRdsOhm[index]!), 1e-15)
    )))
    : null;
  const measurementsValid = selectedSemiconductorExecutionMeasurementsValid(executionCase?.native, observation)
    && selectedSemiconductorExecutionMeasurementsValid(executionCase?.browserWasm, observation)
    && typeof executionCase?.maximumCrossEngineRdsRelativeDifference === "number"
    && Number.isFinite(executionCase.maximumCrossEngineRdsRelativeDifference)
    && executionCase.maximumCrossEngineRdsRelativeDifference >= 0
    && executionCase.maximumCrossEngineRdsRelativeDifference === observedCrossEngineRdsRelativeDifference
    && typeof observation?.maximumCrossEngineRdsRelativeDifference === "number"
    && executionCase.maximumCrossEngineRdsRelativeDifference <= observation.maximumCrossEngineRdsRelativeDifference;
  const executionIdentityBound = executionReport !== null
    && executionReport.format === "opencircuit-selected-semiconductor-application-golden-report"
    && executionReport.schemaVersion === 1
    && executionReport.contractContentHash === contractContentHash
    && JSON.stringify(executionReport.evidenceBoundary) === JSON.stringify(contract?.evidenceBoundary)
    && executionReport.pass === true
    && executionCase !== undefined
    && executionCase.id === testCase?.id
    && executionCase.application === testCase?.application
    && executionCase.presetId === testCase?.presetId
    && executionCase.observationKind === testCase?.observationKind
    && executionCase.candidateId === testCase?.candidateId
    && executionCase.candidateIndex === testCase?.candidateIndex
    && JSON.stringify(executionCase.recipe) === JSON.stringify(testCase?.recipe)
    && executionCase.requestHash === testCase?.requestHash
    && executionCase.resultContentHash === testCase?.resultContentHash
    && executionCase.constraintDecisionContentHash === testCase?.constraintDecisionContentHash
    && JSON.stringify(executionCase.library) === JSON.stringify(testCase?.library)
    && JSON.stringify(executionCase.selectedBinding) === JSON.stringify(testCase?.selectedBinding)
    && JSON.stringify(executionCase.modelBinding) === JSON.stringify(testCase?.modelBinding)
    && JSON.stringify(executionCase.sourceBinding) === JSON.stringify(testCase?.sourceBinding)
    && executionCase.benchId === testCase?.benchId
    && executionCase.analysis === "op"
    && executionCase.modelTier === "F1"
    && executionCase.attestation === "none"
    && executionCase.engineIdentity !== undefined
    && executionCase.engineIdentity.id === "@opencircuit/ngspice-wasm"
    && executionCase.engineIdentity.buildVersion === contract?.engines?.browserWasm?.engineVersion
    && executionCase.engineIdentity.simulatorVersion === contract?.engines?.browserWasm?.simulatorVersion
    && executionCase.engineIdentity.solver === contract?.engines?.browserWasm?.solver
    && executionCase.engineIdentity.numericFormat === "ieee754-binary64"
    && executionCase.netlistContentHash === testCase?.netlistContentHash
    && typeof executionCase.sampleContentHash === "string" && /^sha256:[0-9a-f]{64}$/u.test(executionCase.sampleContentHash)
    && typeof executionCase.receiptContentHash === "string" && /^sha256:[0-9a-f]{64}$/u.test(executionCase.receiptContentHash)
    && executionCase.repeatableBrowserReceipt === true
    && typeof executionCase.fullVectorComparisonPass === "boolean"
    && executionCase.fullVectorComparisonIsReleaseGate === false
    && executionCase.benchOperatingConditionsWithinReviewedEvidence === true
    && executionCase.productionRequestConditionsEvaluated === false
    && executionCase.productionConstraintEligibility === false
    && executionCase.rankingAuthority === false
    && executionCase.fullBomCoverage === false
    && executionCase.pass === true;
  const canonicalExecutionArtifact = executionReport !== null
    && executionReportText === `${JSON.stringify(executionReport, null, 2)}\n`
    && executionIdentityBound
    && vectorsValid
    && measurementsValid
    && runner.includes("validateSelectedSemiconductorExecutionReport(report, contract, report.contractContentHash)")
    && runner.includes("verifyPersistedExecutionReport(report, contract, contractContentHash, EXECUTION_REPORT_PATH)")
    && runner.includes("executionIdentity(persisted)")
    && reportTest.includes("validateSelectedSemiconductorExecutionReport")
    && ciWiring.checks.exactHarnessCommand;
  const exclusions = Array.isArray(contract?.evidenceBoundary?.doesNotProve)
    ? contract.evidenceBoundary.doesNotProve.filter((entry): entry is string => typeof entry === "string").join("\n")
    : "";
  const implemented = {
    closedReviewedF1OperatingPointContract: contract?.format === "opencircuit-selected-semiconductor-application-golden-contract"
      && contract.schemaVersion === 1
      && contractText === `${JSON.stringify(contract, null, 2)}\n`
      && contract.evidenceBoundary?.modelTier === "F1"
      && contract.evidenceBoundary.attestation === "none"
      && contract.evidenceBoundary.productionProfilesUsed === true
      && contract.evidenceBoundary.productionObservationCandidateEligible === false
      && contract.evidenceBoundary.benchOperatingConditionsWithinReviewedEvidence === true
      && contract.evidenceBoundary.productionRequestConditionsEvaluated === false
      && contract.evidenceBoundary.productionConstraintEligibility === false
      && contract.evidenceBoundary.rankingAuthority === false
      && contract.evidenceBoundary.fullBomCoverage === false
      && contract.engines?.native?.version === "ngspice-46"
      && contract.engines.native.solverClaim === "unverified"
      && contract.engines.browserWasm?.module === "../../ngspice-wasm-build/dist-loader/index.mjs"
      && contract.engines.browserWasm.engineVersion === "ngspice-46-opencircuit-wasm1"
      && contract.engines.browserWasm.simulatorVersion === "ngspice-46"
      && contract.engines.browserWasm.solver === "KLU",
    exactProductionObservationIdentity: testCase?.id === "motor.production.external-24v.selected-csd18540q5b-reviewed-f1-op"
      && testCase.application === "motor.brushed-dc"
      && testCase.presetId === "motor.external-24v"
      && testCase.observationKind === "production_constraint_observation"
      && testCase.candidateId === "candidate:v2:sha256:2a12514f1e2dd9f54b92c4ec527e509006fb774fbfe00b2a531836b848bac147"
      && testCase.candidateIndex === 0
      && testCase.recipe?.id === "motor.native.external-nmos-h-bridge.facts-v3-1"
      && testCase.recipe.version === "3.1.1"
      && testCase.recipe.contentHash === "sha256:3832200e9181d616299bb7cec73f3ca8fe6c2021d6efd033c3913a0b3894c9df"
      && testCase.requestHash === "sha256:69ea6b6f00e1851d0f32a5391691aab14467333a1bc04348c7cbda2eb3ada262"
      && testCase.resultContentHash === "sha256:647513545c74e1ac5a30fcfc93192a042ab785b7f256e214a66bd2043d9067db"
      && testCase.constraintDecisionContentHash === "sha256:cc5b7db9824de6bed6dea9da70cc6203ab66fde7662ad0fe779384556a40c30e"
      && testCase.library?.version === "2026-08-24.14"
      && testCase.library.contextManifestContentHash === "sha256:e71d2ea32adc21a98f8063356307519beeb51c0c67076e55f57fcde231e929ca"
      && testCase.library.sourceReleaseContentHash === "sha256:15e4b3f05961d4453664f55c804594e45c5363c38a9e9b9c73a7942294cf94c7"
      && !installedExternalLaneHasIneligibleObservations,
    exactSelectedQuantityAndReviewedProfile: selectedBinding?.selectedComponentId === "mosfet"
      && selectedBinding.role === "bridge-n-channel-power-mosfet"
      && selectedBinding.profileId === "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json"
      && selectedBinding.profileContentHash === "sha256:9de9fd7e729d57c0c068336af5d601b4c2c897dcb5d6e211915116bbcd4ad39e"
      && selectedBinding.manufacturerId === "texas-instruments"
      && selectedBinding.manufacturerPartNumber === "CSD18540Q5B"
      && selectedBinding.quantityPerAssembly === 4
      && selectedBinding.catalogAdmissionState === "reviewed"
      && release.version === testCase?.library?.version
      && release.contentHash === testCase?.library?.sourceReleaseContentHash
      && catalogProfile?.profileContentHash === selectedBinding.profileContentHash
      && catalogProfile.part.manufacturerId === selectedBinding.manufacturerId
      && catalogProfile.part.manufacturerPartNumber === selectedBinding.manufacturerPartNumber
      && admissionEntry?.state === "reviewed"
      && admissionEntry.profileContentHash === selectedBinding.profileContentHash
      && typeof admissionEntry.reviewedBy === "string"
      && exactProfile,
    exactStrictReviewedModelPackage: modelBinding?.packageId === "texas-instruments/CSD18540Q5B"
      && modelBinding.packagePath === packageRoot
      && modelBinding.modelName === "OC_TEXAS-INSTRUMENTS_CSD18540Q5B"
      && modelBinding.modelType === "dot_model"
      && modelBinding.fidelityTier === "F1"
      && modelBinding.electricalFamily === "nmos"
      && modelBinding.evidenceContractVersion === "1.0.0"
      && modelBinding.generator === "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0"
      && modelBinding.reviewer === "gpt-5.6-sol independent package reviewer"
      && modelBinding.generator.length > 0
      && modelBinding.reviewer.length > 0
      && String(modelBinding.generator) !== String(modelBinding.reviewer)
      && !/pending/iu.test(modelBinding.reviewer)
      && JSON.stringify(modelBinding.supportedAnalyses) === JSON.stringify(["operating_point"])
      && JSON.stringify(modelBinding.domainCoverage) === JSON.stringify(expectedDomainCoverage)
      && modelBinding.strictAdmission === true
      && packageHashesMatch
      && componentReviewed
      && exactSource
      && validationPassed
      && expectationCohorts.implemented
      && strictAdmission
      && modelText.includes(`.model ${modelBinding.modelName} VDMOS(`)
      && !/^[ \t]*\.subckt\b/imu.test(modelText),
    exactReviewedOperatingPoint: testCase?.benchId === "csd18540q5b.f1.four-selected.reviewed-rdson-10v-28a-25c"
      && testCase.analysis === "op"
      && JSON.stringify(testCase.selectedVectors) === JSON.stringify(["v(d1)", "v(d2)", "v(d3)", "v(d4)"])
      && observation?.kind === "four-selected-quantity-f1-rdson-at-reviewed-table-point"
      && observation.instanceCount === 4
      && observation.temperatureC === 25
      && observation.gateVoltageV === 10
      && observation.forcedDrainCurrentA === 28
      && observation.reviewedMaximumRdsOhm === 0.0022
      && observation.conditionId === "sha256:33ef6c18457632e255a3da9444ba2c6ca18598bd2d0c5f77d07e42cf24d9ed01"
      && observation.resistanceEvidenceId === "sha256:19133942b07fa7ec8aeb66d49d0039dcf1b57358b9631f6eac4ee121f59513f0"
      && reviewedExpectation?.condition_id === observation.conditionId
      && reviewedExpectation.bench_condition_id === observation.conditionId
      && reviewedExpectation.evidence_id === observation.resistanceEvidenceId
      && observation.maximumInstanceSpreadOhm === 1e-12
      && observation.maximumCrossEngineRdsRelativeDifference === 1e-6
      && JSON.stringify(observation.productionRequestConditions) === JSON.stringify(expectedProductionRequestConditions)
      && observation.interpretation === "reviewed_dc_table_point_only_not_production_request_conditions",
    exactFourIndependentInstanceFixture: testCase?.fixture === "fixtures/csd18540q5b-four-selected-op.cir"
      && fixtureText === expectedFixture
      && testCase.netlistContentHash === hashText(fixtureText)
      && fixtureText.match(/^M[1-4]\s+d[1-4]\s+g[1-4]\s+0\s+OC_TEXAS-INSTRUMENTS_CSD18540Q5B$/gmu)?.length === 4
      && !/^\.(?:tran|ac|noise)\b/imu.test(fixtureText),
    generatedProductionIdentityTest: !installedExternalLaneHasIneligibleObservations
      && identityTest.includes("currentExternalMotorObservation")
      && identityTest.includes("allowUnknownHardConstraints = true")
      && identityTest.includes("expect(strict.result.candidates).toEqual([])")
      && identityTest.includes("eligible: false")
      && identityTest.includes("quantityPerAssembly: 4")
      && identityTest.includes('modelTier: "unavailable"')
      && identityTest.includes('supportedAnalyses: ["operating_point"]'),
    nativeAndWasmOperatingPointRunner: runner.includes("runNative({ netlist")
      && runner.includes('browserWorker.run(netlist, "runOpPoint"')
      && runner.includes("selectedComparison(comparison, testCase.selectedVectors)")
      && runner.includes("receiptVerificationIssues.length === 0")
      && runner.includes('attestation === "none"')
      && runner.includes("productionRequestConditionsEvaluated: false")
      && runner.includes("fullVectorComparisonIsReleaseGate: false"),
    explicitBoundedClaimExclusions: /production request.*40.*5 A.*18.*30 V.*20 kHz.*duty/isu.test(exclusions)
      && /switching.*transient.*Miller.*reverse recovery.*body diode/isu.test(exclusions)
      && /avalanche.*SOA.*thermal.*self-heating.*parasitic/isu.test(exclusions)
      && /gate driver.*TVS.*motor.*passive.*full BOM/isu.test(exclusions)
      && /eligibility.*ranking.*safety.*release readiness/isu.test(exclusions),
    conditionalContinuousIntegrationWiring: ciWiring.implemented,
    canonicalExecutionArtifact,
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `selected_semiconductor_application_golden_contract_missing:${name}`);
  return gate(
    "simulation.production-selected-semiconductor-dc-golden-contract",
    blockers.length === 0 ? "pass" : "blocked",
    blockers,
    {
      implemented,
      contractContentHash,
      caseId: typeof testCase?.id === "string" ? testCase.id : null,
      candidateId: typeof testCase?.candidateId === "string" ? testCase.candidateId : null,
      requestHash: typeof testCase?.requestHash === "string" ? testCase.requestHash : null,
      resultContentHash: typeof testCase?.resultContentHash === "string" ? testCase.resultContentHash : null,
      constraintDecisionContentHash: typeof testCase?.constraintDecisionContentHash === "string" ? testCase.constraintDecisionContentHash : null,
      recipe: testCase?.recipe ?? null,
      library: testCase?.library ?? null,
      selectedBinding: selectedBinding ?? null,
      modelBinding: modelBinding ?? null,
      observationContract: observation ?? null,
      storedValidationChecks: storedValidation.checks,
      expectationCohortChecks: expectationCohorts.checks,
      executionResultAttached: canonicalExecutionArtifact,
      executionArtifactAttested: false,
      currentProductionIdentity: implemented.exactProductionObservationIdentity,
      currentProductionIdentityAuthority: implemented.exactProductionObservationIdentity ? "verified" : "unverified",
      installedExternalLane: installedExternalLaneHasIneligibleObservations ? {
        recipe: {
          id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
          version: "3.1.7",
          contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
        },
        contextManifestContentHash: "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38",
        catalogContentHash: "sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890",
        sourceReleaseContentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
        installedPolicyContentHash: "sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0",
        exactDriverApplicationSourceContentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135",
        exactTvsProfileContentHash: "sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474",
        exactTvsSourceContentHash: "sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24",
        browserStrictResultContentHash: "sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435",
        browserStrictRetainedCandidateCount: 0,
        browserStrictRejectionCount: 54,
        browserPermissiveResultContentHash: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176",
        browserPermissiveDecisionContentHash: "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e",
        browserCandidateIds: [
          "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed",
          "candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70",
        ],
        packageObservationResultContentHash: "sha256:01b56be6e6dfc3ca46bb36550f6999571d19bd109e73e99d29d308a69a7733b3",
        packageObservationExecutionContentHash: "sha256:5b45a733cea233ab9c9c36603747e623e2cb6031dfbb4b22c1020cff86af1fce",
        packageObservationDecisionContentHash: "sha256:f7dafa7fd6397b7a3fcfe43f12a93e0b05017faa0f91d25ae846584c5afe0604",
        packageStrictResultContentHash: "sha256:b0bf69fc7bac1accbaf0232204f14ae243bb59d6401b979b370e2b40b1e65a77",
        packageStrictExecutionContentHash: "sha256:a776a7eea754a7a7724d4df2663693f11eaeb3485784b7d2e7e9e0b7107590da",
        packageCandidateIds: [
          "candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152",
          "candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382",
        ],
        retainedCandidateCount: 2,
        decisionCandidateCount: 2,
        materializedCandidateCount: 54,
        rejectionCount: 52,
        eligibleCandidateCount: 0,
        satisfiedRuleCountPerCandidate: 9,
        blockedRuleCountPerCandidate: 21,
        gateResistorBomLineCount: 0,
        capacitorRoleBindings: {
          profileContentHashes: [
            "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
            "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
            "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
          ],
          bootstrap: { dataKey: "bootstrapProfileId", quantityPerAssembly: 2, nominalRuleTruth: "pass" },
          local: { dataKey: "localProfileId", quantityPerAssembly: 1, nominalRuleTruth: "pass" },
          applicationAdequacy: "unknown",
        },
        gateNetworkDisposition: "blocked_unknown",
        currentProductionIdentity: true,
        currentProductionIdentityAuthority: "verified_structural_observation_ineligible",
      } : "unverified",
      candidateEligible: false,
      productionRequestConditionsEvaluated: false,
      productionConstraintEligibility: false,
      rankingAuthority: false,
      fullBomCoverage: false,
      ciWiringChecks: ciWiring.checks,
      executionArtifact: canonicalExecutionArtifact ? {
        contentHash: executionArtifactContentHash,
        byteLength: Buffer.byteLength(executionReportText, "utf8"),
        sampleContentHash: executionCase?.sampleContentHash ?? null,
        browserReceiptContentHash: executionCase?.receiptContentHash ?? null,
        nativeRdsOhm: executionCase?.native?.rdsOhm ?? null,
        browserWasmRdsOhm: executionCase?.browserWasm?.rdsOhm ?? null,
        validation: "canonical_identity_bound_regenerated_unattested",
      } : null,
      claimBoundary: "A pass would prove only four independent selected CSD18540Q5B F1 dot-model operating-point instances at the cited 25 C, VGS 10 V, ID 28 A DC table point on native ngspice 46 and the browser-WASM engine. The installed 3.1.7 external-Motor lane has two deterministic direct-gate structural observations with the exact Diodes 33 V TVS, separate source-bound bootstrap and VDD-local nominal-capacitance roles, and no series-gate resistor BOM line. Its static 53.3 V published-clamp comparisons do not prove the production transient or full TVS coordination; both observations remain ineligible because gate-network, capacitor application adequacy, TVS coordination, and other required evidence are unknown. The selected-semiconductor contract and admitted model package remain absent, so current structural identity cannot establish selected-part simulation authority. No trusted Circuit V2 subcircuit integration, production request, switching, transient, Miller, recovery, body-diode, avalanche, SOA, thermal, parasitic, full-BOM, safety, eligibility, or ranking behavior is claimed.",
    },
  );
}

function exportGate(): DesignerReleaseGateV1 {
  const physicalHandoffV1 = optionalRepoText("packages/design-export/src/power-physical-implementation-handoff-v1.ts");
  const physicalHandoffV1Test = optionalRepoText("packages/design-export/test/power-physical-implementation-handoff-v1.test.ts");
  const physicalHandoffV2 = optionalRepoText("packages/design-export/src/power-physical-implementation-handoff-v2.ts");
  const physicalHandoffV2Test = optionalRepoText("packages/design-export/test/power-physical-implementation-handoff-v2.test.ts");
  const implemented = {
    designJsonV2: typeof serializeDesignResultV2 === "function",
    electricalBomCsvV2: typeof exportElectricalBomCsvV2 === "function",
    scenarioSpiceV2: typeof exportDesignResultScenarioSpiceV2 === "function",
    simulationCsvV2: typeof exportDesignResultScenarioSimulationCsvV2 === "function",
    structuralSvgV2: typeof exportDesignResultCircuitSvgV2 === "function" && typeof parseDesignResultCircuitSvgV2 === "function",
    structuralKicadV2: typeof exportDesignResultKicadSchematicV2 === "function" && typeof parseDesignResultKicadSchematicV2 === "function",
    printableReportV2: typeof exportDesignResultPrintableReportV2 === "function" && typeof parseDesignResultPrintableReportV2 === "function",
    powerPhysicalImplementationHandoffV1: typeof createPowerPhysicalImplementationHandoffV1 === "function"
      && typeof parsePowerPhysicalImplementationHandoffV1 === "function"
      && typeof verifyPowerPhysicalImplementationHandoffV1 === "function"
      && typeof exportFootprintAssignedPowerKicadSchematicV1 === "function"
      && physicalHandoffV1.includes('POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V1 = 1')
      && physicalHandoffV1.includes('manufacturingOutputClaim: "none"')
      && physicalHandoffV1.includes('export function exportFootprintAssignedPowerKicadSchematicV1')
      && physicalHandoffV1.includes('"physical_mapping_unavailable",\n    handoff.diagnostics')
      && physicalHandoffV1Test.includes('"sha256:dc8671f69b6588e6d11fd65fa9b954951ccc0dc28d208a6e3c877e8cbf24e068"')
      && physicalHandoffV1Test.includes('.toBe("physical_mapping_unavailable")'),
    powerPhysicalImplementationHandoffV2: typeof createPowerPhysicalImplementationHandoffV2 === "function"
      && typeof parsePowerPhysicalImplementationHandoffV2 === "function"
      && typeof verifyPowerPhysicalImplementationHandoffV2 === "function"
      && typeof exportFootprintAssignedPowerKicadSchematicV2 === "function"
      && physicalHandoffV2.includes('POWER_PHYSICAL_IMPLEMENTATION_HANDOFF_SCHEMA_VERSION_V2 = 2')
      && physicalHandoffV2.includes("const HERO_RECIPE_IDENTITIES = Object.freeze([")
      && physicalHandoffV2.includes('version: "3.4.5"')
      && physicalHandoffV2.includes('contentHash: "sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee"')
      && physicalHandoffV2.includes('version: "3.4.6"')
      && physicalHandoffV2.includes('contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c"')
      && physicalHandoffV2.includes('manufacturerPartNumber: "GRM32ER71E226KE15L"')
      && physicalHandoffV2.includes('quantityPerAssembly: 2')
      && physicalHandoffV2.includes('{ componentId: "output-capacitor-1", refdes: "C3"')
      && physicalHandoffV2.includes('{ componentId: "output-capacitor-2", refdes: "C4"')
      && physicalHandoffV2.includes('manufacturerPartNumber: "F1F2-0804-100M"')
      && physicalHandoffV2.includes('manufacturingOutputClaim: "none"')
      && physicalHandoffV2.includes('export function exportFootprintAssignedPowerKicadSchematicV2')
      && physicalHandoffV2.includes('"physical_mapping_unavailable",\n    handoff.diagnostics')
      && physicalHandoffV2Test.includes('"sha256:1cde50595ebed875cb5f77e8c7a449bd3e1be2355a9dcbc150dbe6e972d28af8"')
      && physicalHandoffV2Test.includes('recipeVersion: "3.4.6"')
      && physicalHandoffV2Test.includes("priorImmutableRecipeArtifact.provenance.candidate.recipeVersion = \"3.4.5\"")
      && physicalHandoffV2Test.includes('fails footprint-assigned KiCad emission closed for all eight structural instances')
      && physicalHandoffV2Test.includes('rejects collapsed quantity, footprint claims, byte drift, unknown candidates, and context drift'),
  };
  const missingRequired: string[] = [];
  const blockers = [
    ...Object.entries(implemented).filter(([, present]) => !present).map(([name]) => `export_missing:${name}`),
    ...missingRequired.map((name) => `export_missing:${name}`),
  ];
  return gate("exports.contract-availability", blockers.length === 0 ? "pass" : "blocked", blockers, {
    implemented,
    missingRequired,
    productionReachability: {
      designJsonV2: true,
      electricalBomCsvV2: true,
      scenarioSpiceV2: true,
      simulationCsvV2: false,
      structuralSvgV2: true,
      structuralKicadV2: true,
      printableReportV2: true,
      powerPhysicalImplementationHandoffV1: "programmatic_exact_predecessor_only",
      powerPhysicalImplementationHandoffV2: "programmatic_exact_successor_only",
      footprintAssignedPowerKicadV1: false,
      footprintAssignedPowerKicadV2: false,
      simulatorHandoff: false,
      commercialExport: false,
    },
    physicalImplementationHandoff: {
      v1PredecessorContentHash: "sha256:dc8671f69b6588e6d11fd65fa9b954951ccc0dc28d208a6e3c877e8cbf24e068",
      v2SuccessorContentHash: "sha256:1cde50595ebed875cb5f77e8c7a449bd3e1be2355a9dcbc150dbe6e972d28af8",
      supportedRecipeIdentities: [
        {
          version: "3.4.5",
          contentHash: "sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee",
        },
        {
          version: "3.4.6",
          contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
        },
      ],
      v2OutputCapacitorBomQuantity: 2,
      v2OutputCapacitorStructuralInstances: ["output-capacitor-1/C3", "output-capacitor-2/C4"],
      footprintIdentity: "unavailable",
      physicalPinMapping: "unavailable",
      placement: "not_emitted",
      routing: "unrouted",
      physicalVerification: "unverified",
      manufacturingOutputAuthority: "none",
    },
    claimBoundary: "Pass proves deterministic exporter contracts exist, not selected-part simulation fidelity. Exact-regenerated production observations expose JSON, BOM, structural SVG, structural KiCad, printable HTML, and Scenario SPICE only for the separate zero-omission generic behavioral scenarios under exact installed engineering/execution contexts. The additive Power physical-handoff V2 binds the quantity-two 22 uF BOM line to two explicit structural instances and the 10 uH inductor while preserving V1 as an immutable quantity-one predecessor. Both handoffs deliberately lack footprint identities, physical-pin mappings, placement, routing verification, physical fidelity, eligibility, simulation, manufacturing-output authority, and attestation; footprint-assigned KiCad emission fails closed. Scenario SPICE cannot affect BOM, constraints, ranking, evidence, receipts, or V3 eligibility; simulation CSV, Simulator handoff, and commercial export remain gated.",
  });
}

function externalKicadCliQaContractGate(
  releaseAttachment: ExternalKicadQaReleaseAttachmentAssessment,
): DesignerReleaseGateV1 {
  const packageDocument = optionalRepoText("packages/design-export/package.json");
  const contract = optionalRepoText("packages/design-export/src/external-kicad-qa.ts");
  const fixtures = optionalRepoText("packages/design-export/src/external-kicad-fixtures.ts");
  const runner = optionalRepoText("packages/design-export/scripts/verify-kicad-external.ts");
  const test = optionalRepoText("packages/design-export/test/external-kicad-qa.test.ts");
  const releaseAudit = optionalRepoText("packages/designer-release-audit/src/index.ts");
  const releaseCli = optionalRepoText("packages/designer-release-audit/src/cli.ts");
  const releaseAttachmentTest = optionalRepoText(
    "packages/designer-release-audit/test/external-kicad-release-attachment.test.ts",
  );
  const implemented = {
    optInOnly: packageDocument.includes('"qa:kicad-external": "vite-node scripts/verify-kicad-external.ts"'),
    exactInputOutputReceipt: contract.includes('EXTERNAL_KICAD_QA_FORMAT = "schemagic-external-kicad-qa-report"')
      && contract.includes("io.writeInput(fixturePlan.inputPath, inputBytes)")
      && contract.includes("const afterExecutionInput = io.readInput(fixturePlan.inputPath)")
      && contract.includes("contentHash: sha256(output)"),
    boundedClaims: contract.includes('attestation: "none"')
      && contract.includes('interactiveOpenSaveWithoutRepairClaim: "unverified"')
      && contract.includes('footprintVerificationClaim: "none"'),
    exactContextMotorAndPowerFixtures: fixtures.includes('fixtureId: "motor-integrated-v2"')
      && fixtures.includes('fixtureId: "power-integrated-v2"')
      && fixtures.includes("generateElectricalDesignV2")
      && fixtures.includes("exportDesignResultKicadSchematicV2"),
    freshRealExecutionDirectory: runner.includes("mkdtempSync")
      && runner.includes('"schemagic-external-kicad-qa-"')
      && runner.includes("spawnSync")
      && runner.includes("serializeExternalKicadQaReportV1(report)"),
    fakeRunnerCannotPromoteClaims: test.includes("keeps missing and unsupported external executables as hard failures")
      && test.includes('forgedAttestation.scope.attestation = "independent"')
      && test.includes('code: "kicad_input_unverified"'),
    releaseAttachmentCurrentFixtureBinding: packageDocument.includes('"./external-kicad-fixtures"')
      && releaseAudit.includes("buildExternalKicadQaArtifactsV1")
      && releaseAudit.includes('new TextDecoder("utf-8", { fatal: true })')
      && releaseAudit.includes("reported.designResultContentHash !== artifact.designResultContentHash")
      && releaseAudit.includes("reported.engineeringContextContentHash !== artifact.engineeringContextContentHash")
      && releaseAudit.includes("reported.input.byteLength !== inputBytes.byteLength")
      && releaseAudit.includes("reported.input.contentHash !== inputContentHash"),
    releaseAttachmentCli: releaseCli.includes('"--external-kicad-report"')
      && releaseCli.includes("externalKicadQaReleaseAttachment"),
    staleSelfHashedReleaseReportRejected: releaseAttachmentTest.includes("rejects self-hashed reports for stale current fixtures")
      && releaseAttachmentTest.includes("current_fixture_identity_mismatch")
      && releaseAttachmentTest.includes("current_fixture_input_bytes_mismatch"),
    releaseAttachmentBoundedClaims: releaseAudit.includes("reportedOutputOrPdfBytesVerified: false")
      && releaseAudit.includes("externalCommandRerunByReleaseAudit: false")
      && releaseAudit.includes("executionHostAuthenticated: false")
      && releaseAudit.includes("visualQualityVerified: false")
      && releaseAudit.includes('simulationFidelityClaim: "none"'),
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `external_kicad_cli_qa_contract_missing:${name}`);
  return gate("exports.external-kicad-cli-qa-contract", blockers.length === 0 ? "pass" : "blocked", blockers, {
    implemented,
    fixtureIds: ["motor-integrated-v2", "power-integrated-v2"],
    attestation: "none",
    externalReportedExecutionResultAssociated: releaseAttachment.associated,
    externalReleaseArtifactAttested: releaseAttachment.artifactAttested,
    externalReleaseAttachment: releaseAttachment.evidence,
    claimBoundary: "This gate proves the opt-in exact-byte CLI QA and fail-closed current-fixture attachment contracts are wired. A valid attachment binds its strict self-hashed report to regenerated current Motor and Power fixture identity and input bytes only. It does not verify reported output/PDF bytes, rerun KiCad, authenticate a host or execution context, attest execution, prove visual quality or interactive open/save without repair, verify footprints, admit production profiles, or establish selected-part simulation fidelity.",
  });
}

function simulationCoverageGate(
  release: DesignCatalogReleaseV1,
  behavioralApplicationGoldenContractImplemented: boolean,
  selectedPassiveNominalProjectionGoldenContractImplemented: boolean,
  selectedPassiveNominalProjectionExecutionArtifactAttached: boolean,
  selectedSemiconductorIdealRdsonProjectionImplemented: boolean,
  selectedSemiconductorReviewedDcGoldenImplemented: boolean,
): DesignerReleaseGateV1 {
  return gate("simulation.application-golden-coverage", "unverified", [
    ...(behavioralApplicationGoldenContractImplemented ? [] : ["motor_integrated_behavioral_native_wasm_golden_unverified"]),
    ...(behavioralApplicationGoldenContractImplemented ? [] : ["motor_external_nmos_native_wasm_golden_unverified"]),
    ...(behavioralApplicationGoldenContractImplemented ? [] : ["power_integrated_behavioral_native_wasm_golden_unverified"]),
    ...(behavioralApplicationGoldenContractImplemented ? [] : ["power_external_fet_native_wasm_golden_unverified"]),
    ...(behavioralApplicationGoldenContractImplemented ? [] : ["selected_behavioral_analytic_simulation_relations_unverified"]),
    ...(selectedPassiveNominalProjectionGoldenContractImplemented ? [] : ["production_selected_passive_nominal_projection_native_wasm_golden_unverified"]),
    ...(selectedPassiveNominalProjectionExecutionArtifactAttached
      ? []
      : ["production_selected_passive_nominal_projection_native_wasm_execution_artifact_unverified"]),
    ...(selectedSemiconductorIdealRdsonProjectionImplemented ? [] : ["reviewed_selected_semiconductor_native_wasm_golden_unverified"]),
    "selected_passive_operating_condition_fidelity_unverified",
    "full_bom_selected_part_native_wasm_coverage_unverified",
  ], {
    receiptContractImplemented: true,
    behavioralAllTopologyApplicationGoldenContractImplemented: behavioralApplicationGoldenContractImplemented,
    selectedBehavioralAnalyticSimulationRelationsImplemented: behavioralApplicationGoldenContractImplemented,
    selectedPassiveNominalPrimitiveGoldenContractImplemented: selectedPassiveNominalProjectionGoldenContractImplemented,
    selectedPassiveNominalProjectionExecutionArtifactAttached,
    idealReviewedRdsonProjectionImplemented: selectedSemiconductorIdealRdsonProjectionImplemented,
    reviewedSelectedSemiconductorDcGoldenImplemented: selectedSemiconductorReviewedDcGoldenImplemented,
    productionCatalogProfileCount: release.profiles.length,
    claimBoundary: "The selected synthetic behavioral circuit relations are implemented contracts. The attached selected-passive report is a canonical current-production identity artifact for one permissive structural observation that the installed policy keeps ineligible; strict generation retains zero candidates. It proves only deterministic ideal-nominal primitive wiring and the declared native/browser-WASM numerical relations. The exact 100 kHz / 0.25 V RMS inductance characterization does not cover the 290 kHz production minimum or 400 kHz behavioral scenario. The separate ideal reviewed-RDS(on) projection binds the exact current ineligible external-Motor candidate's four reviewed CSD18540Q5B identities to four independent 2.2 mOhm resistors and verifies the 61.6 mV drop at 28 A on native ngspice 46 and browser-WASM. It is not transistor-equation or physical selected-part fidelity, does not satisfy the blocked production selected-semiconductor DC contract, and does not evaluate the production request, switching, transient, Miller, recovery, body-diode, avalanche, SOA, thermal, parasitic, full-BOM, eligibility, ranking, safety, or release readiness behavior. Passive operating-condition fidelity and full-BOM selected-part coverage remain unverified.",
  });
}

function exactExternalMotorCapacitorRoleContractImplemented(
  externalMotor: string,
  motorRecipeTest: string,
): boolean {
  const releaseStart = externalMotor.indexOf("const RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED = {");
  const releaseEnd = releaseStart < 0 ? -1 : externalMotor.indexOf("const RELEASE_V31_INTERFACE_QUALIFIED = {", releaseStart);
  const releaseContract = releaseStart < 0 || releaseEnd < 0 ? "" : externalMotor.slice(releaseStart, releaseEnd);
  const testStart = motorRecipeTest.indexOf('it("splits exact-driver bootstrap and VDD-local MLCC roles without claiming capacitor adequacy"');
  const testEnd = testStart < 0 ? -1 : motorRecipeTest.indexOf('\n  it("', testStart + 1);
  const contractTest = testStart < 0 || testEnd < 0 ? "" : motorRecipeTest.slice(testStart, testEnd);
  const exactProfileHashes = [
    "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
    "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
    "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
  ] as const;
  const requiredUnknownRuleIds = [
    "motor.external.bootstrap-capacitance",
    "motor.external.bulk-capacitance",
    "motor.external.capacitor-placement",
    "motor.external.gate-network",
    "motor.external.local-capacitance-effective",
    "motor.external.local-voltage-rating",
    "motor.external.passive-derating",
    "motor.external.switching-and-loss",
  ] as const;
  return releaseContract.includes("...RELEASE_V31_DIRECT_GATE")
    && releaseContract.includes('version: "3.1.5"')
    && releaseContract.includes("id: RELEASE_V31_DIRECT_GATE.id")
    && releaseContract.includes("version: RELEASE_V31_DIRECT_GATE.version")
    && releaseContract.includes('contentHash: "sha256:c8145e32480a29e0d9d008ac7e73ff73f9b93cb08aa2f7f0919f199af4955d84"')
    && releaseContract.includes("motor.external.facts-v3-1-role-qualified.exact-driver-capacitor-role-binding.v1")
    && releaseContract.includes('dataKey: "bootstrapProfileId"')
    && releaseContract.includes('dataKey: "localProfileId"')
    && releaseContract.includes("quantityPerAssembly: 2")
    && releaseContract.includes("quantityPerAssembly: 1")
    && releaseContract.includes("documentedNominalMinimumF: 0.1e-6")
    && releaseContract.includes("documentedNominalMinimumF: 1e-6")
    && exactProfileHashes.every((hash) => releaseContract.includes(hash))
    && releaseContract.includes('"bootstrap_effective_capacitance"')
    && releaseContract.includes('"bootstrap_charge_adequacy"')
    && releaseContract.includes('"local_effective_capacitance_or_voltage_adequacy"')
    && releaseContract.includes('"bulk_capacitance_adequacy"')
    && releaseContract.includes('"capacitor_placement_or_interconnect_feasibility"')
    && releaseContract.includes('"selected_part_scenario_or_simulation_fidelity"')
    && contractTest.includes("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED")
    && contractTest.includes('version: "3.1.5"')
    && contractTest.includes('contentHash: "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187"')
    && exactProfileHashes.every((hash) => contractTest.includes(hash))
    && contractTest.includes("expect(options).toHaveLength(108)")
    && contractTest.includes("option.data.bootstrapProfileId")
    && contractTest.includes("option.data.localProfileId")
    && contractTest.includes('id: "bootstrap-capacitor", profileId: bootstrapId, quantityPerAssembly: 2')
    && contractTest.includes('id: "local-decoupling", profileId: localId, quantityPerAssembly: 1')
    && contractTest.includes('"motor.external.bootstrap-capacitance-nominal"')
    && contractTest.includes('"motor.external.local-capacitance-nominal"')
    && contractTest.includes('status: "pass"')
    && requiredUnknownRuleIds.every((ruleId) => contractTest.includes(`ruleId: "${ruleId}", status: "unknown"`))
    && contractTest.includes('component.id === "gate-resistor"')
    && contractTest.includes("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE.enumerate(environment)).toHaveLength(60)")
    && contractTest.includes('version: "3.1.4"')
    && contractTest.includes('contentHash: "sha256:c8145e32480a29e0d9d008ac7e73ff73f9b93cb08aa2f7f0919f199af4955d84"');
}

function exactExternalMotorInterfaceQualifiedContractImplemented(
  externalMotor: string,
  motorRecipeTest: string,
): boolean {
  const releaseStart = externalMotor.indexOf("const RELEASE_V31_INTERFACE_QUALIFIED = {");
  const releaseEnd = releaseStart < 0 ? -1 : externalMotor.indexOf("const REQUIRED_CLASSES = [", releaseStart);
  const releaseContract = releaseStart < 0 || releaseEnd < 0 ? "" : externalMotor.slice(releaseStart, releaseEnd);
  const testStart = motorRecipeTest.indexOf(
    'it("exact-binds the 33 V Diodes TVS while preserving the unimplemented MIC4606 VDD rail and transient coordination blockers"',
  );
  const testEnd = testStart < 0 ? -1 : motorRecipeTest.indexOf('\n  it("', testStart + 1);
  const contractTest = testStart < 0 || testEnd < 0 ? "" : motorRecipeTest.slice(testStart, testEnd);
  const switchNodeRuleIds = [
    "motor.external.driver-switch-node-operating-minimum",
    "motor.external.driver-switch-node-operating-maximum",
    "motor.external.driver-switch-node-absolute-maximum",
  ] as const;
  return releaseContract.includes("...RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED")
    && releaseContract.includes('version: "3.1.6"')
    && releaseContract.includes("id: RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.id")
    && releaseContract.includes("version: RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.version")
    && releaseContract.includes('contentHash: "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187"')
    && releaseContract.includes("motor.external.facts-v3-1-role-qualified.interface-qualified-driver-voltage-limits.v1")
    && externalMotor.includes("release: RELEASE_V31_INTERFACE_QUALIFIED")
    && externalMotor.includes('driverVoltageSemantics: "bridge_interface_qualified"')
    && switchNodeRuleIds.every((ruleId) => externalMotor.includes(`"${ruleId}"`))
    && externalMotor.includes("nominal 0 V-to-requested-bus xHS excursion")
    && externalMotor.includes("recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved elsewhere")
    && externalMotor.includes("does not implement a VDD driver-bias rail")
    && externalMotor.includes("inside the reviewed VDD minimum and maximum")
    && contractTest.includes("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_INTERFACE_QUALIFIED")
    && contractTest.includes('version: "3.1.5"')
    && contractTest.includes('contentHash: "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187"')
    && contractTest.includes('version: "3.1.6"')
    && contractTest.includes('contentHash: "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320"')
    && contractTest.includes('constraint.status === "pass")).toHaveLength(11)')
    && contractTest.includes('constraint.status === "unknown")).toHaveLength(19)')
    && contractTest.includes('constraint.status === "fail")).toEqual([])')
    && switchNodeRuleIds.every((ruleId) => contractTest.includes(`"${ruleId}"`))
    && contractTest.includes('ruleId === "motor.external.driver-bias-source"')
    && contractTest.includes('status: "unknown"');
}

function exactExternalMotorTvsVoltageQualifiedContractImplemented(
  externalMotor: string,
  motorRecipeTest: string,
): boolean {
  const releaseStart = externalMotor.indexOf("const RELEASE_V31_TVS_VOLTAGE_QUALIFIED = {");
  const releaseEnd = releaseStart < 0 ? -1 : externalMotor.indexOf("const REQUIRED_CLASSES = [", releaseStart);
  const releaseContract = releaseStart < 0 || releaseEnd < 0 ? "" : externalMotor.slice(releaseStart, releaseEnd);
  const testStart = motorRecipeTest.indexOf(
    'it("exact-binds the 33 V Diodes TVS while preserving the unimplemented MIC4606 VDD rail and transient coordination blockers"',
  );
  const testEnd = testStart < 0 ? -1 : motorRecipeTest.indexOf('\n  it("', testStart + 1);
  const contractTest = testStart < 0 || testEnd < 0 ? "" : motorRecipeTest.slice(testStart, testEnd);
  return releaseContract.includes("...RELEASE_V31_INTERFACE_QUALIFIED")
    && releaseContract.includes('version: "3.1.7"')
    && releaseContract.includes("id: RELEASE_V31_INTERFACE_QUALIFIED.id")
    && releaseContract.includes("version: RELEASE_V31_INTERFACE_QUALIFIED.version")
    && releaseContract.includes('contentHash: "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320"')
    && releaseContract.includes("motor.external.facts-v3-1-role-qualified.exact-supply-tvs-static-voltage-binding.v1")
    && releaseContract.includes("motor.external.facts-v3-1-role-qualified.tvs-stand-off-ambient-condition-gate.v1")
    && releaseContract.includes("supplyTvsBinding: DIODES_3_0SMCJ33CAQ_TVS_BINDING")
    && externalMotor.includes('manufacturerPartNumber: "3.0SMCJ33CAQ"')
    && externalMotor.includes('"sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474"')
    && externalMotor.includes('"sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24"')
    && externalMotor.includes("standOffVoltageV: 33")
    && externalMotor.includes("clampingVoltageMaximumV: 53.3")
    && externalMotor.includes('"tvs_coordination"')
    && externalMotor.includes("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED")
    && contractTest.includes("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED")
    && contractTest.includes('version: "3.1.6"')
    && contractTest.includes('contentHash: "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320"')
    && contractTest.includes('version: "3.1.7"')
    && contractTest.includes('contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947"')
    && contractTest.includes('3%2E0SMCJ33CAQ.json')
    && contractTest.includes('ruleId === "motor.external.tvs-stand-off"')
    && contractTest.includes('["motor.external.tvs-published-clamp-mosfet-limit", 60]')
    && contractTest.includes('["motor.external.tvs-published-clamp-driver-switch-node-limit", 90]')
    && contractTest.includes("constraints.find((constraint) => constraint.ruleId === ruleId)")
    && contractTest.includes('status: "pass"')
    && contractTest.includes('ruleId === "motor.external.tvs-coordination"')
    && contractTest.includes('constraint.status === "pass")).toHaveLength(9)')
    && contractTest.includes('constraint.status === "unknown")).toHaveLength(21)');
}

function exactExternalMotorDirectGateCountsImplemented(test: string): boolean {
  const start = test.indexOf("const expectedStrictExternalCounts = {");
  const end = start < 0 ? -1 : test.indexOf("} as const;", start);
  if (start < 0 || end < 0) return false;
  const strictCounts = test.slice(start, end);
  const permissiveStart = test.indexOf("expect(first.execution.counts).toEqual({", end);
  const permissiveEnd = permissiveStart < 0 ? -1 : test.indexOf("});", permissiveStart);
  if (permissiveStart < 0 || permissiveEnd < 0) return false;
  const permissiveCounts = test.slice(permissiveStart, permissiveEnd);
  const strictImplemented = [
    "recipes: 6,",
    "supportedRecipes: 3,",
    "enumerated: 54,",
    "solved: 54,",
    "matchOutcomes: 54,",
    "matched: 54,",
    "checked: 54,",
    "estimated: 0,",
    "deduped: 0,",
    "pareto: 0,",
    "materialized: 0,",
    "coverageValidated: 0,",
    "rejected: 54,",
  ].every((token) => strictCounts.includes(token))
    && test.includes("expect(strict.execution.counts).toEqual(expectedStrictExternalCounts)");
  const permissiveImplemented = [
    "recipes: 6,",
    "supportedRecipes: 3,",
    "enumerated: 54,",
    "solved: 54,",
    "matchOutcomes: 54,",
    "matched: 54,",
    "checked: 54,",
    "estimated: 54,",
    "deduped: 54,",
    "pareto: 2,",
    "materialized: 54,",
    "coverageValidated: 54,",
    "rejected: 52,",
  ].every((token) => permissiveCounts.includes(token));
  return strictImplemented && permissiveImplemented;
}

function strictDefaultCandidateContractImplemented(): boolean {
  const test = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const view = optionalRepoText("apps/web/src/features/designer/ImportedResultView.ts");
  const browserTest = optionalRepoText("apps/web/e2e/designer.spec.ts");
  const powerReadme = optionalRepoText("packages/power-designer/README.md");
  const externalMotor = optionalRepoText("packages/design-recipes/src/motor-external-v2.ts");
  const motorRecipeTest = optionalRepoText("packages/design-recipes/test/motor-v2.test.ts");
  return test.includes("keeps strict generation empty until an explicit unknown-evidence opt-in")
    && test.includes("keeps exact MIC4606-2 direct-gate observations structural and V3-ineligible")
    && test.includes('strictResult: "sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435"')
    && test.includes('expect(strict.contextManifestContentHash).toBe("sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38")')
    && test.includes("expect(strict.result.rejectedCandidates).toHaveLength(54)")
    && test.includes('rejection.reasonCode === "unknown_constraint_disallowed"')
    && test.includes('constraint.ruleId === "motor.external.gate-network"')
    && test.includes('evidence.sourceId === "microchip-mic4606-ds20005604h"')
    && exactExternalMotorDirectGateCountsImplemented(test)
    && exactExternalMotorCapacitorRoleContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorInterfaceQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorTvsVoltageQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && test.includes("Strict generation enumerated and checked 54 exact MIC4606-2 direct-gate options")
    && test.includes("with separate bootstrap and VDD-local capacitor roles")
    && test.includes("No series-gate resistor is selected")
    && test.includes("exactly three reviewed 10 µF MLCC profiles while excluding the 100 nF C1608 from both roles")
    && test.includes("Those nominal passes do not prove effective capacitance")
    && test.includes('permissiveResult: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176"')
    && test.includes('decision: "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e"')
    && test.includes("expect(first.constraintDecision.candidates).toHaveLength(2)")
    && test.includes('"candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed"')
    && test.includes('"candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70"')
    && test.includes('candidate.rules.filter((rule) => rule.disposition === "satisfied").length === 9')
    && test.includes('candidate.rules.filter((rule) => rule.disposition !== "satisfied").length === 21')
    && test.includes('component.id === "gate-resistor"')
    && test.includes('id: "bootstrap-capacitor"')
    && test.includes("quantityPerAssembly: 2")
    && test.includes('id: "local-decoupling"')
    && test.includes("quantityPerAssembly: 1")
    && test.includes('ruleId: "motor.external.bootstrap-capacitance-nominal", status: "pass"')
    && test.includes('ruleId: "motor.external.local-capacitance-nominal", status: "pass"')
    && test.includes('ruleId: "motor.external.bootstrap-capacitance", status: "unknown"')
    && test.includes('ruleId: "motor.external.local-capacitance-effective", status: "unknown"')
    && test.includes('ruleId: "motor.external.bulk-capacitance", status: "unknown"')
    && test.includes('ruleId: "motor.external.capacitor-placement", status: "unknown"')
    && test.includes('ruleId: "motor.external.tvs-published-clamp-driver-switch-node-limit", status: "pass"')
    && test.includes('ruleId: "motor.external.tvs-published-clamp-mosfet-limit", status: "pass"')
    && test.includes('ruleId: "motor.external.tvs-stand-off", status: "unknown"')
    && test.includes('ruleId: "motor.external.tvs-coordination", status: "unknown"')
    && test.includes('not.toContain("C1608X7R1H104K080AA")')
    && test.includes('contentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135"')
    && test.includes("retains the reviewed Bel Power BOM only as an exact ineligible unknown-evidence observation")
    && test.split("expect(strict.result.candidates).toEqual([]);").length - 1 === 3
    && test.split('entry.reasonCode === "unknown_constraint_disallowed"').length - 1 === 1
    && test.includes('reasonCode: "unknown_constraint_disallowed"')
    && test.includes('candidateId: "candidate:v2:sha256:88b7d52b012cd7edfda6ba8f5ef0611c7d2ffeff870614ccf9d0dea6f1ca679d"')
    && test.includes('expect(strict.contextManifestContentHash).toBe("sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3")')
    && test.includes('expect(strict.result.contentHash).toBe("sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2")')
    && test.includes('expect(first.result.contentHash).toBe("sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a")')
    && test.includes('expect(first.constraintDecision.contentHash).toBe("sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37")')
    && test.includes('id: "candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a"')
    && test.includes("expect(strict.execution.rejections[0]!.constraints?.some((constraint) => constraint.status === \"fail\")).toBe(false)")
    && test.includes("expect(first.result.candidates).toHaveLength(1)")
    && test.includes("expect(first.constraintDecision.eligibleCandidateIds).toEqual([])")
    && view.includes("function executionAwareEmptyResultCopy(")
    && view.includes("Strict generation enumerated and checked ${execution.counts.checked} exact MIC4606-2 direct-gate options")
    && view.includes("No series-gate resistor is selected")
    && view.includes("motor.external.gate-network")
    && view.includes('execution.rejections[0].recipeId === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"')
    && view.includes("Strict generation excluded the one exact-BOM Power option because unresolved hard constraints are disallowed")
    && view.includes("policy-ineligible structural observation")
    && browserTest.includes("external-NMOS Motor exposes only exact direct-gate structural observations behind explicit inspection")
    && browserTest.includes("enumerated and checked 54 exact MIC4606-2 direct-gate structures")
    && browserTest.includes("the 100 nF C1608 is excluded from both roles")
    && browserTest.includes("application adequacy remains unknown")
    && browserTest.includes("Generated 2 structural observations; the installed production policy marks 0 eligible.")
    && browserTest.includes('contentHash: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176"')
    && browserTest.includes('contentHash: "sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a"')
    && browserTest.includes('component.id === "gate-resistor"')
    && browserTest.includes('sourceId: "microchip-mic4606-ds20005604h"')
    && browserTest.includes("Power retains the reviewed Bel BOM only as an ineligible exact structural observation")
    && browserTest.includes('expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" })')
    && browserTest.includes('expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" })')
    && browserTest.includes('await expect(page.getByText("Hard electrical failure", { exact: false })).toHaveCount(0)')
    && powerReadme.includes("strict generation has one `unknown_constraint_disallowed` rejection and no")
    && powerReadme.includes("retains one materialized exact-BOM structural observation")
    && powerReadme.includes("marks that observation ineligible. There is no hard-failure disposition.");
}

function productionConnectedStructuralCircuitContractImplemented(): boolean {
  const integratedMotor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32.ts");
  const integratedMotorFrozenSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-mode-qualified.ts");
  const integratedMotorBindingRefreshedSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-mode-qualified-binding-refreshed.ts");
  const integratedMotorInstalledSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-local-capacitance-recommendation-qualified.ts");
  const integratedMotorCompanionNetworkSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-companion-network-gated.ts");
  const motorEngine = optionalRepoText("packages/design-recipes/src/motor-engine-internal.ts");
  const externalMotor = optionalRepoText("packages/design-recipes/src/motor-external-v2.ts");
  const motorRecipeTest = optionalRepoText("packages/design-recipes/test/motor-v2.test.ts");
  const integratedMotorTest = optionalRepoText("packages/design-recipes/test/motor-integrated-v32.test.ts");
  const integratedMotorCompanionNetworkTest = optionalRepoText("packages/design-recipes/test/motor-integrated-v326-companion-network.test.ts");
  const integratedPower = optionalRepoText("packages/design-recipes/src/power-integrated-v33.ts");
  const qualifiedIntegratedPower = optionalRepoText("packages/design-recipes/src/power-integrated-v34-inductor-qualified.ts");
  const integratedPowerTest = optionalRepoText("packages/design-recipes/test/power-integrated-v33.test.ts");
  const browserContract = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  return integratedMotor.includes("motor.integrated.facts-v3-2.connected-structural-bom-binding.v1")
    && integratedMotor.includes('kind: "schematic_only"')
    && integratedMotorFrozenSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32")
    && integratedMotorFrozenSuccessor.includes("return MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.check(option, environment).map")
    && integratedMotorTest.includes('contentHash: "sha256:86d3e6fed563d7e663d74f692286a2287b2932afea198fe76dc86eab07c50ece"')
    && integratedMotorBindingRefreshedSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED")
    && integratedMotorBindingRefreshedSuccessor.includes('version: "3.2.4"')
    && integratedMotorBindingRefreshedSuccessor.includes('"sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b"')
    && integratedMotorTest.includes('contentHash: "sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84"')
    && integratedMotorInstalledSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED")
    && integratedMotorInstalledSuccessor.includes('version: "3.2.5"')
    && integratedMotorInstalledSuccessor.includes('"sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6"')
    && integratedMotorInstalledSuccessor.includes('"sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12"')
    && integratedMotorTest.includes('contentHash: "sha256:75e1ea8fa6c3c4fadd44187b9134a2e61840d2ad5b0123d0bbaff17a910dce1a"')
    && integratedMotorCompanionNetworkSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED")
    && integratedMotorCompanionNetworkSuccessor.includes('version: "3.2.6"')
    && integratedMotorCompanionNetworkSuccessor.includes('"sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a"')
    && integratedMotorCompanionNetworkSuccessor.includes('"motor.integrated.companion-network-representability"')
    && integratedMotorCompanionNetworkSuccessor.includes("reject_before_candidate_component_materialization_and_customization_witness")
    && integratedMotorCompanionNetworkTest.includes('contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07"')
    && integratedMotorCompanionNetworkTest.includes("rejects every exact DRV8262 option in match before components can be materialized")
    && motorEngine.includes("MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED")
    && externalMotor.includes("motor.external.facts-v3-1-role-qualified.connected-structural-bom-binding.v1")
    && externalMotor.includes("RELEASE_V31_TVS_VOLTAGE_QUALIFIED")
    && externalMotor.includes('version: "3.1.7"')
    && externalMotor.includes("motor.external.facts-v3-1-role-qualified.exact-driver-direct-gate-structure.v1")
    && externalMotor.includes('sourceId: "microchip-mic4606-ds20005604h"')
    && externalMotor.includes('"sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135"')
    && externalMotor.includes('id: "gate-drive-direct-to-bridge"')
    && externalMotor.includes("Exact-driver direct-gate BOM must not contain a series gate-resistor data binding")
    && externalMotor.split('kind: "schematic_only"').length - 1 >= 3
    && exactExternalMotorCapacitorRoleContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorInterfaceQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorTvsVoltageQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && motorRecipeTest.includes('component.id === "gate-resistor"')
    && motorRecipeTest.includes('{ id: "gate-drive-direct-to-bridge", points: [[52, 28], [76, 28]] }')
    && motorRecipeTest.includes('ruleId === "motor.external.gate-network"')
    && integratedPower.includes("power.connected-structural-bom-binding.v1")
    && integratedPower.includes('kind: "schematic_only"')
    && integratedPower.includes("circuitBomNonRepresentations: []")
    && integratedPowerTest.includes("materializes the exact BOM as a deterministic connected structural schematic with no executable scenario")
    && integratedPowerTest.includes("expect(materialized.circuit.circuits[0]!.wires.length).toBeGreaterThan(0)")
    && integratedPowerTest.includes("expect(materialized.circuitBomNonRepresentations).toEqual([])")
    && qualifiedIntegratedPower.includes('id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"')
    && qualifiedIntegratedPower.includes("createPowerIntegratedSynchronousBuckStructuralRecipe")
    && qualifiedIntegratedPower.includes("createPowerIntegratedSynchronousBuckBehavioralRecipe")
    && integratedPowerTest.includes("facts V3.4 exact-inductor-qualified integrated synchronous-buck successor")
    && integratedPowerTest.includes('part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" }')
    && integratedPowerTest.includes('expect.objectContaining({ id: "output-capacitor-1", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" })')
    && integratedPowerTest.includes('expect.objectContaining({ id: "output-capacitor-2", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" })')
    && browserContract.includes("keeps exact MIC4606-2 direct-gate observations structural and V3-ineligible")
    && browserContract.includes("retains the reviewed Bel Power BOM only as an exact ineligible unknown-evidence observation")
    && exactExternalMotorDirectGateCountsImplemented(browserContract)
    && browserContract.split("candidate.circuit.circuits[0]!.wires.length").length - 1 === 1
    && browserContract.includes('expect.objectContaining({ netlist: expect.objectContaining({ kind: "schematic_only" }) })');
}

function powerExternalFetReadinessContractGate(): DesignerReleaseGateV1 {
  const externalLeaf = optionalRepoText("packages/design-recipes/src/power-external-v3.ts");
  const powerFactory = optionalRepoText("packages/design-recipes/src/power-v2.ts");
  const recipeTest = optionalRepoText("packages/design-recipes/test/power-v2.test.ts");
  const readinessTest = optionalRepoText("packages/power-designer/test/v2-compatibility.test.ts");
  const powerPolicy = optionalRepoText("packages/design-recipes/src/power-constraint-policy-engine-internal.ts");
  const bundleAudit = optionalRepoText("apps/web/scripts/assert-production-bundle.mjs");
  const externalReadiness = POWER_DESIGN_V2_PRODUCTION_STATUS.recipeReadiness.find((recipe) => (
    recipe.recipeId === "power.native.external-fet-synchronous-buck.facts-v3"
  ));
  const releaseIdentityIsDedicated = externalLeaf.includes('id: "power.native.external-fet-synchronous-buck.facts-v3"')
    && externalLeaf.includes('version: "3.0.0"')
    && externalLeaf.includes("power.connected-external-fet-structural-bom-binding.v1")
    && externalLeaf.includes("createPowerNativeExternalFactsV3Recipe(RELEASE, materializeExternalStructuralBom)")
    && recipeTest.includes("sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538");
  const externalOnlyPrimaryAuthority = powerFactory.includes('type PowerPrimaryScope = "mixed" | "external_only"')
    && powerFactory.includes('if (scope === "external_only")')
    && powerFactory.includes('if (scope === "external_only" && partClass !== "power.external-fet-synchronous-buck-controller")')
    && powerFactory.includes('primaryScope: "external_only"')
    && recipeTest.includes("withTooManyIntegratedPrimaries")
    && recipeTest.includes("withInvalidIntegratedPrimary")
    && recipeTest.includes("INTEGRATED-IRRELEVANT-")
    && recipeTest.includes("cannot estimate a non-controller primary option");
  const exactStructuralMaterialization = externalLeaf.includes("const EXPECTED_COMPONENT_IDS = [")
    && externalLeaf.includes("exact nine-line selected BOM")
    && externalLeaf.includes("circuitBomNonRepresentations: []")
    && externalLeaf.includes("scenarios: []")
    && externalLeaf.includes('defaultCircuitId: "assembly"')
    && externalLeaf.includes("defaultScenarioId: null")
    && recipeTest.includes("componentPinPointsV4")
    && recipeTest.includes("is unwired")
    && recipeTest.includes("modelTier: \"unavailable\"");
  const readinessSeparatedFromIntegrated = externalReadiness?.recognizedContract === true
    && externalReadiness.releaseEligible === false
    && externalReadiness.ready === false
    && externalReadiness.profileRequirements.some((requirement) => (
      requirement.partClass === "power.external-fet-synchronous-buck-controller"
      && requirement.reviewedProfileCount === 0
    ))
    && externalReadiness.profileRequirements.every((requirement) => (
      requirement.partClass !== "power.integrated-synchronous-buck-regulator"
    ))
    && readinessTest.includes("without implying release eligibility or an integrated-regulator dependency")
    && readinessTest.includes("malformedIntegrated");
  const policyScopeRemainsIntegratedOnly = powerPolicy.includes(
    'recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"',
  ) && !powerPolicy.includes('recipeId: "power.native.external-fet-synchronous-buck.facts-v3"');
  const browserPowerClosureRequiresLeaf = bundleAudit.includes(
    'sourceContentForSuffix(powerEvidence, "packages/design-recipes/src/power-external-v3.ts")',
  );
  const checks = {
    releaseIdentityIsDedicated,
    externalOnlyPrimaryAuthority,
    exactStructuralMaterialization,
    readinessSeparatedFromIntegrated,
    policyScopeRemainsIntegratedOnly,
    browserPowerClosureRequiresLeaf,
  };
  const blockers = Object.entries(checks)
    .filter(([, implemented]) => !implemented)
    .map(([name]) => `power_external_fet_readiness_contract_unverified:${name}`);
  return gate("power.external-fet-readiness-contract", blockers.length === 0 ? "pass" : "blocked", blockers, {
    ...checks,
    recipeId: externalReadiness?.recipeId ?? null,
    recipeVersion: externalReadiness?.recipeVersion ?? null,
    recipeContentHash: "sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538",
    contextManifestContentHash: getPowerDesignContextManifestV2().contentHash,
    recognizedContract: externalReadiness?.recognizedContract ?? false,
    releaseEligible: externalReadiness?.releaseEligible ?? false,
    ready: externalReadiness?.ready ?? false,
    reviewedExternalControllerProfileCount: externalReadiness?.profileRequirements.find((requirement) => (
      requirement.partClass === "power.external-fet-synchronous-buck-controller"
    ))?.reviewedProfileCount ?? null,
    installedConstraintPolicyRecipeIds: policyScopeRemainsIntegratedOnly
      ? ["power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"]
      : [],
    integratedRecipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    integratedRecipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
    structuralBomLineCount: exactStructuralMaterialization ? 9 : null,
    defaultScenarioId: null,
    modelTier: "unavailable",
    claimBoundary: "Pass proves the installed external-FET recipe is class-isolated, structurally materialized, and independently assessed for data readiness. It remains non-release-eligible, has no installed V3 policy scope, no bundled external-controller profile, no executable selected-part model, and no production candidate claim.",
  });
}

function productionBehavioralScenarioSpiceContractImplemented(): boolean {
  const integratedMotor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32.ts");
  const integratedMotorFrozenSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-mode-qualified.ts");
  const integratedMotorBindingRefreshedSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-mode-qualified-binding-refreshed.ts");
  const integratedMotorInstalledSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-local-capacitance-recommendation-qualified.ts");
  const integratedMotorCompanionNetworkSuccessor = optionalRepoText("packages/design-recipes/src/motor-integrated-v32-companion-network-gated.ts");
  const motorEngine = optionalRepoText("packages/design-recipes/src/motor-engine-internal.ts");
  const externalMotor = optionalRepoText("packages/design-recipes/src/motor-external-v2.ts");
  const motorRecipeTest = optionalRepoText("packages/design-recipes/test/motor-v2.test.ts");
  const integratedMotorTest = optionalRepoText("packages/design-recipes/test/motor-integrated-v32.test.ts");
  const integratedMotorCompanionNetworkTest = optionalRepoText("packages/design-recipes/test/motor-integrated-v326-companion-network.test.ts");
  const integratedPower = optionalRepoText("packages/design-recipes/src/power-integrated-v34.ts");
  const qualifiedIntegratedPower = optionalRepoText("packages/design-recipes/src/power-integrated-v34-inductor-qualified.ts");
  const motorTest = optionalRepoText("packages/motor-designer/test/materialization.test.ts");
  const powerTest = optionalRepoText("packages/design-recipes/test/power-integrated-v33.test.ts");
  const productionArtifact = optionalRepoText("packages/design-export/src/production-artifact-v2.ts");
  const designerRoute = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const importedResultView = optionalRepoText("apps/web/src/features/designer/ImportedResultView.ts");
  return integratedMotor.includes("buildMotorOperatingPointCompanionV2")
    && integratedMotor.includes("circuits: [assembly, companion.graph]")
    && integratedMotor.includes("scenarios: [companion.scenario]")
    && integratedMotor.includes('defaultCircuitId: "assembly"')
    && integratedMotorFrozenSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32")
    && integratedMotorFrozenSuccessor.includes("return MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.check(option, environment).map")
    && integratedMotorTest.includes('contentHash: "sha256:86d3e6fed563d7e663d74f692286a2287b2932afea198fe76dc86eab07c50ece"')
    && integratedMotorBindingRefreshedSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED")
    && integratedMotorBindingRefreshedSuccessor.includes('version: "3.2.4"')
    && integratedMotorBindingRefreshedSuccessor.includes('"sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b"')
    && integratedMotorTest.includes('contentHash: "sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84"')
    && integratedMotorInstalledSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED")
    && integratedMotorInstalledSuccessor.includes('version: "3.2.5"')
    && integratedMotorInstalledSuccessor.includes('"sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6"')
    && integratedMotorInstalledSuccessor.includes('"sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12"')
    && integratedMotorTest.includes('contentHash: "sha256:75e1ea8fa6c3c4fadd44187b9134a2e61840d2ad5b0123d0bbaff17a910dce1a"')
    && integratedMotorCompanionNetworkSuccessor.includes("...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED")
    && integratedMotorCompanionNetworkSuccessor.includes('version: "3.2.6"')
    && integratedMotorCompanionNetworkSuccessor.includes('"sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a"')
    && integratedMotorCompanionNetworkSuccessor.includes('"motor.integrated.companion-network-representability"')
    && integratedMotorCompanionNetworkSuccessor.includes("reject_before_candidate_component_materialization_and_customization_witness")
    && integratedMotorCompanionNetworkTest.includes('contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07"')
    && integratedMotorCompanionNetworkTest.includes("rejects every exact DRV8262 option in match before components can be materialized")
    && motorEngine.includes("MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED")
    && externalMotor.includes("circuits: [...structuralCircuit.circuits, companion.graph]")
    && externalMotor.includes("scenarios: [companion.scenario]")
    && externalMotor.includes("circuitBomNonRepresentations: companion.circuitBomNonRepresentations")
    && externalMotor.includes("motor.external.facts-v3-1-role-qualified.request-derived-operating-point-companion.v1")
    && externalMotor.includes("RELEASE_V31_TVS_VOLTAGE_QUALIFIED")
    && externalMotor.includes('version: "3.1.7"')
    && exactExternalMotorCapacitorRoleContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorInterfaceQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorTvsVoltageQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && motorRecipeTest.includes("recipe.materialize(candidate, environment)")
    && motorRecipeTest.includes('{ id: "gate-drive-direct-to-bridge", points: [[52, 28], [76, 28]] }')
    && motorRecipeTest.includes('expect(assembly.components.some((component) => component.id === "gate-resistor")).toBe(false)')
    && integratedPower.includes('const BEHAVIORAL_SCENARIO_ID = "ideal_pwm_output_stage_transient"')
    && integratedPower.includes("createPowerIntegratedSynchronousBuckBehavioralRecipe")
    && integratedPower.includes('defaultCircuitId: "assembly"')
    && integratedPower.includes("circuitBomNonRepresentations")
    && motorTest.includes("pwm_loaded_steady_state")
    && motorTest.includes('modelTier: "behavioral"')
    && powerTest.includes('scenarioId: "ideal_pwm_output_stage_transient"')
    && powerTest.includes('modelTier: "behavioral"')
    && qualifiedIntegratedPower.includes("createPowerIntegratedSynchronousBuckBehavioralRecipe")
    && powerTest.includes("materializes the inherited behavioral scenario but leaves all unresolved safety boundaries unknown")
    && powerTest.includes('expect(materialized.circuit.defaultScenarioId).toBe("ideal_pwm_output_stage_transient")')
    && productionArtifact.includes('| "scenario_spice"')
    && productionArtifact.includes("Behavioral scenario SPICE export requires an exact scenario and execution context")
    && designerRoute.includes('coverage?.modelTier !== "behavioral"')
    && designerRoute.includes('artifactKind === "scenario_spice"')
    && importedResultView.includes('data-production-export="scenario_spice"')
    && importedResultView.includes("not a selected-part model, V3 eligibility decision, simulation receipt, or ranking input")
    && importedResultView.includes("Simulation CSV requires actual pinned-engine samples and an exact receipt");
}

function constraintDecisionSidecarV3Gate(): DesignerReleaseGateV1 {
  const schemaTypes = optionalRepoText("packages/design-schema/src/v3-constraint-types.ts");
  const request = optionalRepoText("packages/design-schema/src/v3-request.ts");
  const engineIndex = optionalRepoText("packages/design-engine/src/index.ts");
  const evaluator = optionalRepoText("packages/design-engine/src/v3-constraint-sidecar.ts");
  const motorEvaluator = optionalRepoText("packages/design-engine/src/v3-motor-runtime.ts");
  const powerEvaluator = optionalRepoText("packages/design-engine/src/v3-power-runtime.ts");
  const motorPolicy = optionalRepoText("packages/design-recipes/src/motor-constraint-policy-engine-internal.ts");
  const powerPolicy = optionalRepoText("packages/design-recipes/src/power-constraint-policy-engine-internal.ts");
  const commonPolicy = optionalRepoText("packages/design-recipes/src/production-constraint-policy-v3-common.ts");
  const externalMotor = optionalRepoText("packages/design-recipes/src/motor-external-v2.ts");
  const motorRecipeTest = optionalRepoText("packages/design-recipes/test/motor-v2.test.ts");
  const motorRuntime = optionalRepoText("packages/motor-designer/src/v3.ts");
  const motorTest = optionalRepoText("packages/motor-designer/test/v3-constraint-observation.test.ts");
  const powerRuntime = optionalRepoText("packages/power-designer/src/v3.ts");
  const powerTest = optionalRepoText("packages/power-designer/test/v3-constraint-observation.test.ts");
  const qualifiedIntegratedPower = optionalRepoText("packages/design-recipes/src/power-integrated-v34-inductor-qualified.ts");
  const powerRecipeTest = optionalRepoText("packages/design-recipes/test/power-integrated-v33.test.ts");
  const webApplications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const webRoute = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const webView = optionalRepoText("apps/web/src/features/designer/ImportedResultView.ts");
  const productionArtifact = optionalRepoText("packages/design-export/src/production-artifact-v2.ts");
  const productionArtifactTest = optionalRepoText("packages/design-export/test/circuit-svg-v2.test.ts");
  const webImport = optionalRepoText("apps/web/src/features/designer/ResultImport.ts");
  const webApplicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const webImportTest = optionalRepoText("apps/web/src/features/designer/result-import.test.ts");
  const webBrowserTest = optionalRepoText("apps/web/e2e/designer.spec.ts");
  const webBundleAudit = optionalRepoText("apps/web/scripts/assert-production-bundle.mjs");
  const productionConstraintDecisionUiImplemented = webApplications.includes('await import("@opencircuit/motor-designer/v3")')
    && webApplications.includes('await import("@opencircuit/power-designer/v3")')
    && webApplications.includes("exactInstalledProductionGenerationBoundary")
    && webApplications.includes("new WeakMap<object, string>()")
    && webApplications.includes("assertMotorProductionConstraintObservationDecisionV3")
    && webApplications.includes("assertPowerProductionConstraintObservationDecisionV3")
    && webRoute.includes("adapter.authorizesProductionGeneration?.(value) !== true")
    && webRoute.includes("#authorizedDisplayedObservationDecision")
    && webRoute.includes("policy-detached observation artifact")
    && webRoute.includes("policy-detached observation preview")
    && webView.includes('data-production-constraint-policy')
    && webView.includes('data-production-observation-boundary="${surface}"')
    && webView.includes("blockedUnknowns.length} blocked unknowns")
    && webView.includes("embed this exact recorded V3 decision and policy boundary; no eligibility is inferred")
    && webView.includes('data-truth="${policyRule.truth}"')
    && webView.includes('data-criticality="${policyRule.criticality}"')
    && webView.includes('data-disposition="${policyRule.disposition}"')
    && webView.includes("is not accepted from imports")
    && webImport.includes('trust: "production_constraint_observation"')
    && webImport.includes("constraintDecision?: never")
    && webApplicationsTest.includes("eligibleCandidateIds).toEqual([])")
    && webApplicationsTest.includes("forgedEligibilityDecision")
    && webApplicationsTest.includes("did not authorize this exact production generation")
    && webApplicationsTest.includes("motor.external.gate-network")
    && webApplicationsTest.includes("observation_only,ineligible")
    && webApplicationsTest.includes("data-production-observation-boundary=")
    && webApplicationsTest.includes('data-trust=\"structurally_valid\"')
    && productionArtifact.includes("schemagic-production-constraint-observation-artifact-metadata")
    && productionArtifact.includes("exactObservationArtifactContext")
    && productionArtifact.includes("blockedFailureCount")
    && productionArtifact.includes("blockedUnknownCount")
    && productionArtifact.includes("verifyProductionConstraintObservationArtifactV1")
    && productionArtifactTest.includes("leaves ordinary V2 CSV and SVG bytes exactly on their established renderers")
    && productionArtifactTest.includes("decision_source_mismatch")
    && productionArtifactTest.includes("recipe_mismatch")
    && webImportTest.includes("rejects caller-authored V3 decision fields and envelopes")
    && webBrowserTest.includes("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED")
    && webBrowserTest.includes('name: "Regenerate with installed context"')
    && webBrowserTest.includes("Persisted structural observations explicitly regenerated")
    && webBundleAudit.includes("motor-constraint-policy-engine-internal.ts")
    && webBundleAudit.includes("power-constraint-policy-engine-internal.ts")
    && webBundleAudit.includes("must not import the combined Motor/Power policy catalog");
  const implemented = schemaTypes.includes('"pass" | "fail" | "unknown"')
    && schemaTypes.includes('"safety" | "requirement" | "engineering_gap"')
    && schemaTypes.includes('"satisfied" | "blocked_failure" | "blocked_unknown" | "inspectable_unknown"')
    && request.includes('constraintPolicy !== PRODUCTION_STRICT_CONSTRAINT_POLICY_V3')
    && request.includes('hasOwnProperty.call(rawConstraints, "allowUnknownWarnings")')
    && request.includes('hasOwnProperty.call(rawConstraints, "allowUnknownHardConstraints")')
    && !engineIndex.includes('from "./v3-constraint-sidecar"')
    && evaluator.includes('policyRule.criticality')
    && evaluator.includes('candidate.warnings.length === 0')
    && evaluator.includes('rule.disposition === "satisfied" || rule.disposition === "inspectable_unknown"')
    && motorEvaluator.includes("evaluateMotorConstraintDecisionWithInstalledPolicyV3")
    && motorEvaluator.includes("MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3")
    && powerEvaluator.includes("evaluatePowerConstraintDecisionWithInstalledPolicyV3")
    && powerEvaluator.includes("POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3")
    && motorPolicy.includes('recipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"')
    && motorPolicy.includes('recipeId: "motor.native.integrated-h-bridge.facts-v3-2"')
    && motorPolicy.includes("recipeContentHash: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.contentHash")
    && powerPolicy.includes('recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"')
    && powerPolicy.includes('recipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c"')
    && !powerPolicy.includes('recipeId: "power.native.external-fet-synchronous-buck.facts-v3"')
    && !motorPolicy.includes('"engineering_gap"')
    && !powerPolicy.includes('"engineering_gap"')
    && commonPolicy.includes("PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY")
    && motorRuntime.includes('kind: "production_constraint_observation"')
    && motorRuntime.includes("not a standalone serialized artifact")
    && exactExternalMotorCapacitorRoleContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorInterfaceQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && exactExternalMotorTvsVoltageQualifiedContractImplemented(externalMotor, motorRecipeTest)
    && powerRuntime.includes('kind: "production_constraint_observation"')
    && powerRuntime.includes("not a standalone serialized artifact")
    && motorTest.includes('expect(first.contentHash).toBe("sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0")')
    && powerTest.includes('expect(first.contentHash).toBe("sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6")')
    && webApplicationsTest.includes('expect(strict.contextManifestContentHash).toBe("sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38")')
    && webApplicationsTest.includes('expect(strict.contextManifestContentHash).toBe("sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3")')
    && motorTest.includes("observes the exact MIC4606-2 direct-gate structure without inventing a gate resistor or eligibility")
    && motorTest.includes("result: generation.observation.result.contentHash")
    && motorTest.includes('result: "sha256:487cfeca28ed0a67d27df858b87925deca3896a8f9fc4ac19c9de75647cacdb2"')
    && motorTest.includes("expect(generation.observation.result.candidates).toHaveLength(2)")
    && motorTest.includes("expect(generation.decision.candidates).toHaveLength(2)")
    && motorTest.includes("materialized: 54,")
    && motorTest.includes("pareto: 2,")
    && motorTest.includes("rejected: 52,")
    && motorTest.includes('rejection.reasonCode === "pareto_dominated"')
    && motorTest.includes('component.id === "gate-resistor" || component.role === "mosfet-gate-resistor"')
    && motorTest.includes('wire.id === "gate-drive-direct-to-bridge"')
    && motorTest.includes('id: "bootstrap-capacitor", role: "bootstrap-capacitor", quantityPerAssembly: 2')
    && motorTest.includes('id: "local-decoupling", role: "driver-local-decoupling-capacitor", quantityPerAssembly: 1')
    && motorTest.includes('ruleId: "motor.external.bootstrap-capacitance-nominal", status: "pass"')
    && motorTest.includes('ruleId: "motor.external.local-capacitance-nominal", status: "pass"')
    && motorTest.includes('ruleId: "motor.external.bootstrap-capacitance", status: "unknown"')
    && motorTest.includes('ruleId: "motor.external.bulk-capacitance", status: "unknown"')
    && motorTest.includes('ruleId: "motor.external.capacitor-placement", status: "unknown"')
    && motorTest.includes('ruleId: "motor.external.local-capacitance-effective", status: "unknown"')
    && motorTest.includes('ruleId: "motor.external.local-voltage-rating", status: "unknown"')
    && motorTest.includes('"candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152"')
    && motorTest.includes('"candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382"')
    && motorTest.includes('ruleId: "motor.external.gate-network"')
    && motorTest.includes('contentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135"')
    && motorTest.includes('rule.disposition === "satisfied")).toHaveLength(9)')
    && motorTest.includes('rule.disposition !== "satisfied")).toHaveLength(21)')
    && motorTest.includes("decision: generation.decision.contentHash")
    && motorTest.includes('decision: "sha256:093fab8cc210268d42e0af901b9fe72be506268c69d74ceb733bd01f807f70b2"')
    && motorTest.includes('result: "sha256:8594f24adad54036b6e8df4d94a97798ee31c6ca8acdec2169a13966ebe287c0"')
    && motorTest.includes('execution: "sha256:34a59924931a3d6200594670374c5e6d57f07e4722b9d7a92736a0001adc79e4"')
    && motorTest.includes('"candidate:v2:sha256:3f9953a5582e56cd999070367f1b3c4830bfad4d4e9df55e2ce91891fb5cb16e"')
    && motorTest.includes('decision: "sha256:96a51723912ee42c1a1837c1ce388bef95fd6ecb0d328ca618a24e2380b4a9d4"')
    && powerTest.includes('expect(first.observation.result.contentHash).toBe("sha256:6530aafac0a6060283fb17dabfd8121bfe4b3051634dcbe43a88ed8ea21b498f")')
    && powerTest.includes('expect(first.observation.result.candidates).toHaveLength(1)')
    && powerTest.includes('id: "candidate:v2:sha256:1fc0e2f47f13060b4606b7cda6e54fae2b297ffbf7873bfe089c37114c444173"')
    && powerTest.includes('expect(first.observation.execution.rejections).toEqual([])')
    && powerTest.includes('ruleId: "power.regulator.current-limit", status: "unknown"')
    && powerTest.includes('ruleId: "power.inductor.selected-value", status: "unknown"')
    && powerTest.includes('ruleId: "power.inductor.saturation-current", status: "unknown"')
    && powerTest.includes('manufacturerPartNumber: "F1F2-0804-100M"')
    && powerTest.includes('manufacturerPartNumber: "GRM32ER71E226KE15L"')
    && powerTest.includes('quantityPerAssembly: 2')
    && qualifiedIntegratedPower.includes('version: "3.4.6"')
    && qualifiedIntegratedPower.includes('"power.passive-operating-observation-metrics.v1"')
    && qualifiedIntegratedPower.includes("surfacePassiveOperatingObservationsV1: true")
    && powerRecipeTest.includes('describe("facts V3.4.6 immutable passive operating-observation successor"')
    && powerRecipeTest.includes('id: "power.passive.inductor-peak-current-observation"')
    && powerRecipeTest.includes('id: "power.passive.inductor-ripple-current-observation"')
    && powerRecipeTest.includes('id: "power.passive.inductor-rms-current-observation"')
    && powerRecipeTest.includes('id: "power.passive.output-capacitor-bank-rms-current-observation"')
    && powerRecipeTest.includes('toContain("peak-to-peak ripple current")')
    && powerRecipeTest.includes('entry.state === "estimated"')
    && powerRecipeTest.includes('no per-part current-sharing multiplier or balance is claimed')
    && powerRecipeTest.includes('expect.objectContaining({ id: "output-capacitor-1", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" })')
    && powerRecipeTest.includes('expect.objectContaining({ id: "output-capacitor-2", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" })')
    && powerTest.includes(']))).toEqual({ pass: 9, unknown: 13, fail: 0 })')
    && powerTest.includes('expect(first.decision.eligibleCandidateIds).toEqual([])')
    && powerTest.includes('expect(first.decision.contentHash).toBe("sha256:95231bcb28308d796619e24ea92d936639bc4e426ea17fed9f9f4c8a88a168cd")')
    && productionConstraintDecisionUiImplemented;
  return gate("contract.constraint-decision-sidecar-v3", implemented ? "pass" : "blocked", [
    ...(implemented ? [] : ["production_constraint_decision_sidecar_v3_contract_unverified"]),
  ], {
    policy: "production_strict_v1",
    motorPolicyContentHash: "sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0",
    powerPolicyContentHash: "sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6",
    catalogVersion: "2026-08-27.2",
    catalogReleaseContentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    contextCatalogContentHash: "sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890",
    motorContextManifestContentHash: "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38",
    powerContextManifestContentHash: "sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3",
    powerPassiveOperatingObservationMetrics: {
      recipeVersion: "3.4.6",
      recipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
      metricState: "estimated",
      units: "A",
      count: 4,
      constraintOrEligibilityAuthority: false,
      selectedRegulatorControlModelAuthority: false,
      perPartCapacitorCurrentSharingAuthority: false,
    },
    motorExternalRecipe: {
      id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      version: "3.1.7",
      contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
    },
    productionEngineeringGapRuleCount: 0,
    installedMotorPolicyRecipeIds: [
      "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      "motor.native.integrated-h-bridge.facts-v3-2",
    ],
    installedPowerPolicyRecipeIds: ["power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"],
    motorObservationIdentities: {
      external: {
        resultContentHash: "sha256:01b56be6e6dfc3ca46bb36550f6999571d19bd109e73e99d29d308a69a7733b3",
        decisionContentHash: "sha256:f7dafa7fd6397b7a3fcfe43f12a93e0b05017faa0f91d25ae846584c5afe0604",
        candidateIds: [
          "candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152",
          "candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382",
        ],
        retainedCandidateCount: 2,
        materializedCandidateCount: 54,
        rejectionCount: 52,
        eligibleCandidateCount: 0,
        satisfiedRuleCountPerCandidate: 9,
        blockedRuleCountPerCandidate: 21,
        gateResistorBomLineCount: 0,
        capacitorRoleBindings: {
          bootstrap: {
            dataKey: "bootstrapProfileId",
            quantityPerAssembly: 2,
            nominalRuleTruth: "pass",
            applicationAdequacy: "unknown",
          },
          local: {
            dataKey: "localProfileId",
            quantityPerAssembly: 1,
            nominalRuleTruth: "pass",
            applicationAdequacy: "unknown",
          },
        },
        gateNetworkRule: {
          truth: "unknown",
          criticality: "safety",
          disposition: "blocked_unknown",
          evidenceContentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135",
        },
      },
      integrated: {
        resultContentHash: "sha256:5d3073a4e68e71f60f2d9eeaabb2ca90da213a3794c6a6779ad83eeefd703044",
        executionContentHash: "sha256:34a59924931a3d6200594670374c5e6d57f07e4722b9d7a92736a0001adc79e4",
        candidateId: "candidate:v2:sha256:3f9953a5582e56cd999070367f1b3c4830bfad4d4e9df55e2ce91891fb5cb16e",
        decisionContentHash: "sha256:27aabbc0fc3d812752e803d3ce15d40457572b2faa1f81def3a8f52ff6d05276",
        retainedCandidateCount: 1,
      },
    },
    powerIntegratedObservationIdentities: {
      resultContentHash: "sha256:0c0beab37c6d04b2bac6cd028035dae9de69855e85ef6e190ccbe5098e25021b",
      candidateId: "candidate:v2:sha256:1fc0e2f47f13060b4606b7cda6e54fae2b297ffbf7873bfe089c37114c444173",
      decisionContentHash: "sha256:7bb304f6a30b58adac8ee9250ec2cda6e4104af965f0d517de0918295228c76c",
      retainedCandidateCount: 1,
      rejectionCount: 0,
      eligibleCandidateCount: 0,
      satisfiedRuleCount: 9,
      blockedRuleCount: 13,
      unknownRuleIds: [
        "power.control.loop-stability",
        "power.inductor.rms-current",
        "power.inductor.saturation-current",
        "power.inductor.selected-value",
        "power.passive.bootstrap-effective-capacitance",
        "power.passive.capacitor-effective-capacitance",
        "power.regulator.current-limit",
        "power.regulator.minimum-off-time",
        "power.regulator.minimum-on-time",
        "power.regulator.output-current",
        "power.request.output-ripple",
        "power.thermal.loss-model",
        "power.thermal.maximum-junction",
      ],
    },
    permissiveObservationCandidateCounts: { motorExternal: 2, motorIntegrated: 1, powerIntegrated: 1 },
    eligibleCandidateCounts: { motorExternal: 0, motorIntegrated: 0, powerIntegrated: 0 },
    productionConstraintDecisionUiImplemented,
    claimBoundary: "V3 is an additive, content-addressed decision sidecar over permissive V2 structural observations. The installed external-Motor lane retains two deterministic MIC4606-2 direct-gate observations with the exact Diodes 33 V TVS binding, separate bootstrap and VDD-local nominal-capacitance passes, and no series-gate resistor BOM line. Its 53.3 V published clamp comparisons are source-condition-bound; full TVS coordination and the production-temperature stand-off comparison remain unknown. The installed policy keeps both observations ineligible. V3 does not alter V2 generation, make unknown safety or requirement evidence eligible, or claim simulation fidelity, commercial authority, or release readiness.",
  });
}

function primaryPartCustomizationObservationV1ContractImplemented(): Readonly<{
  instructionTransferContractImplemented: boolean;
  engineObservationImplemented: boolean;
  targetOnlyPolicyResultImplemented: boolean;
}> {
  const schema = optionalRepoText("packages/design-schema/src/primary-part-customization.ts");
  const customizedResultSchema = optionalRepoText("packages/design-schema/src/primary-part-customized-result.ts");
  const schemaIndex = optionalRepoText("packages/design-schema/src/index.ts");
  const schemaTest = optionalRepoText("packages/design-schema/test/primary-part-customization.test.ts");
  const customizedResultSchemaTest = optionalRepoText("packages/design-schema/test/primary-part-customized-result.test.ts");
  const engine = optionalRepoText("packages/design-engine/src/v2-generate.ts");
  const engineTypes = optionalRepoText("packages/design-engine/src/v2-types.ts");
  const engineIndex = optionalRepoText("packages/design-engine/src/index.ts");
  const motorRuntime = optionalRepoText("packages/design-engine/src/v3-motor-runtime.ts");
  const powerRuntime = optionalRepoText("packages/design-engine/src/v3-power-runtime.ts");
  const engineTest = optionalRepoText("packages/design-engine/test/primary-part-customization.test.ts");
  return {
    instructionTransferContractImplemented: schema.includes('const FORMAT = "schemagic-designer-primary-part-customization"')
      && schema.includes("PRIMARY_PART_CUSTOMIZATION_MAX_BYTES = 16 * 1024")
      && schema.includes("requestByteContentHash")
      && schema.includes("sourceResultContentHash")
      && schema.includes("sourceCandidateId")
      && schema.includes("sourceProfile: Readonly")
      && schema.includes("targetProfile: Readonly")
      && schema.includes("parsePrimaryPartCustomizationSidecarV1Text")
      && schema.includes('new TextDecoder("utf-8", { fatal: true })')
      && schemaIndex.includes('export * from "./primary-part-customization"')
      && schemaTest.includes("sha256:f69c7603d0f77c198ea84b361a8d5dc151325479b9e48bbe3c214610167da959")
      && schemaTest.includes("keeps the schema closed and cannot transport facts or commercial/simulation trust")
      && schemaTest.includes("PRIMARY_PART_CUSTOMIZATION_MAX_BYTES + 1"),
    engineObservationImplemented: engine.includes("function generatePreparedWithDrafts")
      && engine.includes("preParetoDrafts: deduped")
      && engine.includes("export function evaluatePrimaryPartCustomizationV1")
      && engine.includes("parseConstraintPolicyCatalogV3(input)")
      && engine.includes("policy.application !== prepared.manifest.application")
      && engine.includes("!canonicalSame(baseGeneration.result, sourceGeneration.result)")
      && engine.includes("instruction.sourceResultContentHash !== baseGeneration.result.contentHash")
      && engine.includes("designProfileEnvelopeContentHash(targetProfile)")
      && engine.includes("sameComponentBytes(")
      && engine.includes('constraintPolicyEligibility: "not_evaluated"')
      && engine.includes('selectedPartModel: "not_added"')
      && engineTypes.includes('kind: "primary_part_customization_observation"')
      && !engineIndex.includes("evaluatePrimaryPartCustomizationV1")
      && motorRuntime.includes("evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1")
      && motorRuntime.includes("MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3")
      && powerRuntime.includes("evaluatePowerPrimaryPartCustomizationWithInstalledPolicyV1")
      && powerRuntime.includes("POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3")
      && engineTest.includes("recovers one fully materialized pre-Pareto target without changing the ordinary generation")
      && engineTest.includes("fails closed on instruction request/profile bindings and source execution")
      && engineTest.includes("rejects a well-formed sidecar carrying a forged installed-policy hash"),
    targetOnlyPolicyResultImplemented: customizedResultSchema.includes('const FORMAT = "schemagic-designer-primary-part-customized-result"')
      && customizedResultSchema.includes('targetConstraintPolicyEligibility: "evaluated"')
      && customizedResultSchema.includes('ranking: "not_recomputed"')
      && customizedResultSchema.includes('selectedPartModel: "not_added"')
      && customizedResultSchema.includes('commercialAuthority: "not_added"')
      && customizedResultSchema.includes("targetResultProjection")
      && customizedResultSchema.includes("constraintDecision")
      && schemaIndex.includes('export * from "./primary-part-customized-result"')
      && customizedResultSchemaTest.includes("round-trips a self-hashed target-only policy projection")
      && engine.includes("export function generatePrimaryPartCustomizedResultV1")
      && engine.includes("export function assertPrimaryPartCustomizedResultV1")
      && motorRuntime.includes("generateMotorPrimaryPartCustomizedResultWithInstalledPolicyV1")
      && powerRuntime.includes("generatePowerPrimaryPartCustomizedResultWithInstalledPolicyV1")
      && engineTest.includes("builds a distinct target-only result and evaluates it under the installed policy"),
  };
}

function primaryPartCustomizationBrowserWorkflowImplemented(): boolean {
  const transfer = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizationTransfer.ts");
  const transferTest = optionalRepoText("apps/web/src/features/designer/primary-part-customization-transfer.test.ts");
  const applications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const applicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const route = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const requirementsForm = optionalRepoText("apps/web/src/features/designer/RequirementsForm.ts");
  const view = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizationView.ts");
  const browserTest = optionalRepoText("apps/web/e2e/designer-customization.spec.ts");
  const accessibilityTest = optionalRepoText("apps/web/e2e/designer-accessibility.spec.ts");
  return transfer.includes('const SHARE_FORMAT = "schemagic-designer-primary-part-customization-share"')
    && transfer.includes("assertPrimaryPartCustomizationRequestBinding(sidecar, request)")
    && transfer.includes("r: encodeElectricalDesignRequestShare(request)")
    && transfer.includes("c: encodePrimaryPartCustomizationShare(sidecar)")
    && transferTest.includes("accepts only empty, d, r, and exact r+c route hash states")
    && transferTest.includes("rejects malformed, noncanonical, tampered, and oversized c envelopes")
    && applications.includes("exactInstalledPrimaryPartCustomizationBoundary(")
    && applications.includes("const authorizations = new WeakMap<object")
    && applications.includes("authorizesCustomizedResult(")
    && applicationsTest.includes("authorizes an exact Motor target customization without mutating the ordinary generation")
    && applicationsTest.includes("authorizesCustomizedResult(independentlyGenerated, generation)).toBe(false)")
    && applicationsTest.includes('code: "engineering_context_unverified"')
    && route.includes("file.size > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES")
    && route.includes("primaryPartCustomizationShareUrl(")
    && requirementsForm.includes("Regenerate source + evaluate substitution")
    && route.includes("customization.authorizesCustomizedResult(customized, source)")
    && view.includes("TARGET-ONLY PROJECTION · INSTALLED V3 POLICY")
    && view.includes("These files describe only this exact target projection.")
    && view.includes("They add no authority to the ordinary result, ranking, eligibility, simulation samples, commercial decisions, release, or attestation.")
    && browserTest.includes("Motor primary-part customization remains an inert target-only projection across file and URL transfer")
    && browserTest.includes("Restored exact requirements plus an inert customization instruction")
    && browserTest.includes("Reset to the ordinary generated primary part")
    && accessibilityTest.includes("Customization evaluation must expose a busy state")
    && accessibilityTest.includes("Completed target evaluation must move focus to its result");
}

function primaryPartCustomizedTargetStructuralElectricalExportImplemented(): boolean {
  const packageDocument = optionalRepoText("packages/design-export/package.json");
  const artifact = optionalRepoText("packages/design-export/src/primary-part-customized-artifact-v1.ts");
  const csvByteLimit = optionalRepoText("packages/design-export/src/csv-repeated-prefix-byte-limit-internal.ts");
  const artifactPublicFacade = optionalRepoText("packages/design-export/src/primary-part-customized-artifact-v1-public.ts");
  const circuitSvgPublicFacade = optionalRepoText("packages/design-export/src/circuit-svg-v2-public.ts");
  const exportIndex = optionalRepoText("packages/design-export/src/index.ts");
  const artifactTest = optionalRepoText("packages/design-export/test/primary-part-customized-artifact-v1.test.ts");
  const contracts = optionalRepoText("apps/web/src/features/designer/contracts.ts");
  const applications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const artifactRuntime = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizedArtifactRuntime.ts");
  const applicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const route = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const view = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizationView.ts");
  const browserTest = optionalRepoText("apps/web/e2e/designer-customization.spec.ts");
  return packageDocument.includes('"./primary-part-customized-artifact-v1": "./src/primary-part-customized-artifact-v1-public.ts"')
    && packageDocument.includes('"./circuit-svg-v2": "./src/circuit-svg-v2-public.ts"')
    && artifactPublicFacade.includes("Types-only package facade")
    && artifactPublicFacade.includes("export type")
    && !artifactPublicFacade.includes("exportPrimaryPartCustomizedArtifactV1")
    && !artifactPublicFacade.includes("verifyPrimaryPartCustomizedArtifactV1")
    && circuitSvgPublicFacade.includes("exportDesignResultCircuitSvgV2")
    && circuitSvgPublicFacade.includes("parseDesignResultCircuitSvgV2")
    && !circuitSvgPublicFacade.includes("_renderCandidateCircuitSvgV2")
    && !exportIndex.includes("exportPrimaryPartCustomizedArtifactV1")
    && !exportIndex.includes("verifyPrimaryPartCustomizedArtifactV1")
    && artifact.includes('"customized_target_electrical_bom_csv"')
    && artifact.includes('"customized_target_structural_svg"')
    && artifact.includes("export function exportPrimaryPartCustomizedArtifactV1")
    && artifact.includes("export function verifyPrimaryPartCustomizedArtifactV1")
    && artifact.includes('simulationData: "not_included"')
    && artifact.includes('commercialAuthority: "not_added"')
    && artifact.includes('attestation: "none"')
    && artifact.includes("csvWithRepeatedPrefixFitsByteLimitV1(")
    && csvByteLimit.includes("outputBytes += prefixBytes + 1 + encoder.encode(row).byteLength + 1")
    && csvByteLimit.includes("if (outputBytes > maximumBytes) return false")
    && artifactTest.includes("rejects")
    && artifactTest.includes("preflights repeated customized-target metadata before joining BOM rows")
    && contracts.includes("exportArtifact(")
    && applications.includes("assertMotorPrimaryPartCustomizedResultV1")
    && applications.includes("assertPowerPrimaryPartCustomizedResultV1")
    && applications.includes('await import("./PrimaryPartCustomizedArtifactRuntime")')
    && applications.includes("exportAuthorizedPrimaryPartCustomizedFileV1(")
    && !applications.includes('"../../../../../packages/design-export/src/primary-part-customized-artifact-v1"')
    && artifactRuntime.includes('"../../../../../packages/design-export/src/primary-part-customized-artifact-v1"')
    && artifactRuntime.includes("exportPrimaryPartCustomizedArtifactV1(")
    && artifactRuntime.includes("verifyPrimaryPartCustomizedArtifactV1(")
    && applicationsTest.includes("customized_target_electrical_bom_csv")
    && applicationsTest.includes("customized_target_structural_svg")
    && route.includes('querySelectorAll<HTMLButtonElement>("[data-customized-target-export]")')
    && view.includes('data-customized-target-export="customized_target_electrical_bom_csv"')
    && view.includes('data-customized-target-export="customized_target_structural_svg"')
    && browserTest.includes("customized-target")
    && browserTest.includes("These files describe only this exact target projection.");
}

function primaryPartCustomizedTargetFullProductionArtifactAuthorityImplemented(): boolean {
  const packageDocument = optionalRepoText("packages/design-export/package.json");
  const artifact = optionalRepoText("packages/design-export/src/primary-part-customized-artifact-v1.ts");
  const installedArtifact = optionalRepoText("packages/design-export/src/primary-part-customized-installed-artifact-v1.ts");
  const spice = optionalRepoText("packages/design-export/src/spice-v2.ts");
  const artifactPublicFacade = optionalRepoText("packages/design-export/src/primary-part-customized-artifact-v1-public.ts");
  const exportIndex = optionalRepoText("packages/design-export/src/index.ts");
  const artifactTest = optionalRepoText("packages/design-export/test/primary-part-customized-artifact-v1.test.ts");
  const receipt = optionalRepoText("packages/design-export/src/customized-target-inspection-receipt-v1.ts");
  const receiptTest = optionalRepoText("packages/design-export/test/customized-target-inspection-receipt-v1.test.ts");
  const contracts = optionalRepoText("apps/web/src/features/designer/contracts.ts");
  const applications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const artifactRuntime = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizedArtifactRuntime.ts");
  const applicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const route = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const view = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizationView.ts");
  const browserTest = optionalRepoText("apps/web/e2e/designer-customization.spec.ts");
  const accessibilityTest = optionalRepoText("apps/web/e2e/designer-accessibility.spec.ts");
  const bundleAudit = optionalRepoText("apps/web/scripts/assert-production-bundle.mjs");
  const kinds = [
    "customized_target_electrical_bom_csv",
    "customized_target_structural_svg",
    "customized_target_engineering_report_html",
    "customized_target_structural_kicad",
    "customized_target_behavioral_scenario_spice",
  ] as const;
  const installedKinds = kinds.slice(2);
  const behavioralSpiceSeamStart = spice.indexOf(
    "export function _assertBehavioralScenarioSpiceGateV2(",
  );
  const behavioralSpiceSeamEnd = spice.indexOf(
    "export function exportDesignResultScenarioSpiceV2(",
    behavioralSpiceSeamStart,
  );
  const behavioralSpiceSeam = behavioralSpiceSeamStart === -1
    || behavioralSpiceSeamEnd <= behavioralSpiceSeamStart
    ? ""
    : spice.slice(behavioralSpiceSeamStart, behavioralSpiceSeamEnd);
  return kinds.every((kind) => artifact.includes(`"${kind}"`))
    && installedKinds.every((kind) => installedArtifact.includes(`"${kind}"`))
    && kinds.every((kind) => contracts.includes(kind))
    && kinds.every((kind) => applications.includes(`"${kind}"`))
    && kinds.every((kind) => applicationsTest.includes(kind))
    && kinds.every((kind) => route.includes(`"${kind}"`))
    && kinds.every((kind) => view.includes(`data-customized-target-export="${kind}"`))
    && kinds.every((kind) => browserTest.includes(kind))
    && !packageDocument.includes('"./primary-part-customized-installed-artifact-v1"')
    && !exportIndex.includes("primary-part-customized-installed-artifact-v1")
    && !artifactPublicFacade.includes("_exportPrimaryPartCustomizedInstalledArtifactV1")
    && !artifactPublicFacade.includes("_verifyPrimaryPartCustomizedInstalledArtifactV1")
    && installedArtifact.includes("PrimaryPartCustomizedInstalledRenderContextV1")
    && installedArtifact.includes("_exportPrimaryPartCustomizedInstalledArtifactV1")
    && installedArtifact.includes("_verifyPrimaryPartCustomizedInstalledArtifactV1")
    && installedArtifact.includes("defaultScenarioId")
    && !installedArtifact.includes("allowIncomplete")
    && behavioralSpiceSeam.includes("scenarioId !== candidate.circuit.defaultScenarioId")
    && behavioralSpiceSeam.includes("coverage.length !== 1")
    && behavioralSpiceSeam.includes('coverage[0]!.modelTier !== "behavioral"')
    && behavioralSpiceSeam.includes("_assertBehavioralScenarioSpiceGateV2(candidate, scenarioId)")
    && behavioralSpiceSeam.includes("generateScenarioNetlist(candidate.circuit, scenarioId")
    && behavioralSpiceSeam.includes("generated.omissions.length !== 0")
    && behavioralSpiceSeam.includes("omissionCount: 0 as const")
    && !behavioralSpiceSeam.includes("allowIncomplete")
    && artifact.includes("customizedResultContentHash")
    && artifact.includes("requestByteContentHash")
    && artifact.includes("executionReportContentHash")
    && artifact.includes("manifestContentHash")
    && artifact.includes("sourceReleaseContentHash")
    && artifact.includes("constraintPolicy")
    && artifact.includes("constraintDecisionContentHash")
    && artifact.includes("eligible: boolean")
    && artifact.includes('ordinaryGenerationMutation: "none"')
    && artifact.includes('ranking: "not_recomputed"')
    && artifact.includes('selectedPartModel: "not_added"')
    && artifact.includes('commercialAuthority: "not_added"')
    && artifact.includes('attestation: "none"')
    && artifactTest.includes("exportDesignResultPrintableReportV2")
    && artifactTest.includes("exportDesignResultKicadSchematicV2")
    && artifactTest.includes("exportDesignResultScenarioSpiceV2")
    && artifactTest.includes('code: "engineering_context_unverified"')
    && artifactTest.includes("parseDesignResultPrintableReportV2")
    && artifactTest.includes("parseDesignResultKicadSchematicV2")
    && artifactTest.includes("omissionCount: 0")
    && applications.includes("const authorizations = new WeakMap<object")
    && applications.includes("authorization.source !== source")
    && applications.includes("sourceFingerprintBefore")
    && applications.includes("sourceResultBytesBefore")
    && applications.includes("customizedFingerprintBefore")
    && applications.includes("Customized-target export authority is stale or mutated")
    && applications.includes("Customized-target export mutated its authorized source or result")
    && applications.includes('await import("./PrimaryPartCustomizedArtifactRuntime")')
    && applications.includes("authorizePrimaryPartCustomizedFileRequestV1({")
    && applications.includes("exportAuthorizedPrimaryPartCustomizedFileV1(")
    && !applications.includes("_exportPrimaryPartCustomizedInstalledArtifactV1")
    && !applications.includes("_verifyPrimaryPartCustomizedInstalledArtifactV1")
    && artifactRuntime.includes('"../../../../../packages/design-export/src/primary-part-customized-installed-artifact-v1"')
    && artifactRuntime.includes("_consumeAuthorizedPrimaryPartCustomizedFileRequestV1(authorizationToken)")
    && artifactRuntime.includes("_exportPrimaryPartCustomizedInstalledArtifactV1(")
    && artifactRuntime.includes("_verifyPrimaryPartCustomizedInstalledArtifactV1(")
    && artifactRuntime.includes("export function exportAuthorizedPrimaryPartCustomizedFileV1(")
    && artifactRuntime.includes("export function verifyCustomizedTargetInspectionReceiptBytesV1(")
    && applicationsTest.includes("exact authorized customized result and source")
    && applicationsTest.includes("engineering_context_unverified")
    && applicationsTest.includes("omissionCount")
    && route.includes('"text/csv;charset=utf-8"')
    && route.includes('"image/svg+xml;charset=utf-8"')
    && route.includes('"text/html;charset=utf-8"')
    && route.includes('"application/x-kicad-schematic;charset=utf-8"')
    && route.includes('"text/x-spice;charset=utf-8"')
    && route.includes("requiredProvenance")
    && route.includes("customized.contextManifestContentHash")
    && route.includes("sourceReleaseContentHash")
    && route.includes("customization.authorizesCustomizedResult(customized, source) !== true")
    && route.includes('`[data-customized-target-export="${artifactKind}"]`')
    && view.includes("Download target engineering report HTML")
    && view.includes("Download target structural KiCad schematic")
    && view.includes("Download target behavioral Scenario SPICE")
    && browserTest.includes("toHaveCount(5)")
    && accessibilityTest.includes("Download target engineering report HTML")
    && accessibilityTest.includes("Download target structural KiCad schematic")
    && accessibilityTest.includes("Download target behavioral Scenario SPICE")
    && bundleAudit.includes("customizedTargetArtifactRuntimeChunk")
    && bundleAudit.includes("customizedTargetArtifactRuntimeDynamicImporters")
    && bundleAudit.includes("installedCustomizedTargetRuntimeExports")
    && bundleAudit.includes("customizedTargetRuntimeNamedExports")
    && bundleAudit.includes("customizedTargetSpiceSeam")
    && receipt.includes('"customized_target_electrical_bom_csv"')
    && receipt.includes('"customized_target_structural_svg"')
    && installedKinds.every((kind) => !receipt.includes(kind))
    && installedKinds.every((kind) => !receiptTest.includes(kind))
    && receiptTest.includes("both exact artifact descriptors");
}

function primaryPartCustomizedTargetInspectionReceiptImplemented(): boolean {
  const packageDocument = optionalRepoText("packages/design-export/package.json");
  const exportIndex = optionalRepoText("packages/design-export/src/index.ts");
  const receipt = optionalRepoText("packages/design-export/src/customized-target-inspection-receipt-v1.ts");
  const receiptTest = optionalRepoText("packages/design-export/test/customized-target-inspection-receipt-v1.test.ts");
  const contracts = optionalRepoText("apps/web/src/features/designer/contracts.ts");
  const applications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const artifactRuntime = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizedArtifactRuntime.ts");
  const applicationsTest = optionalRepoText("apps/web/src/features/designer/applications.test.ts");
  const route = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const view = optionalRepoText("apps/web/src/features/designer/PrimaryPartCustomizationView.ts");
  const browserTest = optionalRepoText("apps/web/e2e/designer-customization.spec.ts");
  const accessibilityTest = optionalRepoText("apps/web/e2e/designer-accessibility.spec.ts");
  const bundleAudit = optionalRepoText("apps/web/scripts/assert-production-bundle.mjs");
  return !packageDocument.includes('"./customized-target-inspection-receipt-v1"')
    && !exportIndex.includes("customized-target-inspection-receipt-v1")
    && receipt.includes('const FORMAT = "schemagic-customized-target-inspection-receipt"')
    && receipt.includes("CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 = 4 * 1024 * 1024")
    && receipt.includes('"customized_target_electrical_bom_csv"')
    && receipt.includes('"customized_target_structural_svg"')
    && receipt.includes('purpose: "inspection_only"')
    && receipt.includes('artifactReplay: "required"')
    && receipt.includes('parseAndSelfHash: "integrity_only"')
    && receipt.includes('installedContextAuthority: "not_conferred"')
    && receipt.includes('attestation: "none"')
    && receipt.includes('new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })')
    && receipt.includes("export function parseCustomizedTargetInspectionReceiptV1Bytes")
    && receipt.includes("export function verifyCustomizedTargetInspectionReceiptV1")
    && receipt.includes("exportPrimaryPartCustomizedArtifactV1(customizedResult, kind)")
    && receiptTest.includes("round-trips one bounded canonical receipt with both exact artifact descriptors")
    && receiptTest.includes("treats parse/hash validity as integrity only and requires artifact replay")
    && receiptTest.includes("keeps every receipt runtime function and constant off public package surfaces")
    && receiptTest.includes("new Uint8Array(CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 + 1)")
    && contracts.includes("inspectionReceiptMaxBytes: number")
    && contracts.includes("exportInspectionReceipt(")
    && contracts.includes("restoreInspectionReceipt(")
    && !applications.includes('"../../../../../packages/design-export/src/customized-target-inspection-receipt-v1"')
    && applications.includes('await import("./PrimaryPartCustomizedArtifactRuntime")')
    && applications.includes("verifyCustomizedTargetInspectionReceiptBytesV1(")
    && applications.includes("installedRuntime.assert(receipt.customizedResult, exactSource(source))")
    && applications.includes("authorizations.set(asserted")
    && artifactRuntime.includes('"../../../../../packages/design-export/src/customized-target-inspection-receipt-v1"')
    && artifactRuntime.includes("verifyCustomizedTargetInspectionReceiptV1(")
    && artifactRuntime.includes("parseCustomizedTargetInspectionReceiptV1Bytes(receiptBytes)")
    && applicationsTest.includes("authorizesCustomizedResult(parsedReceipt.customizedResult, generation)).toBe(false)")
    && applicationsTest.includes("restoreInspectionReceipt(")
    && applicationsTest.includes('code: "artifact_descriptor_mismatch"')
    && route.includes("file.size > customization.inspectionReceiptMaxBytes")
    && route.includes('this.#customizationPhase = "verifying_receipt"')
    && route.includes("customization.restoreInspectionReceipt(source, candidate.id, bytes)")
    && route.includes("this.#customizationTargets !== targets")
    && route.includes("selectedInstruction.contentHash !== restored.instruction.contentHash")
    && route.includes("clearPrimaryPartCustomizationShareFromUrl()")
    && view.includes("Verify inspection receipt JSON")
    && view.includes("Download inspection receipt JSON")
    && view.includes("inert portable integrity data")
    && view.includes("Parsing and replay prove byte association only")
    && browserTest.includes("downloadCustomizedTargetInspectionReceipt")
    && browserTest.includes("tampered-inspection-receipt.json")
    && browserTest.includes("Inspection receipt replayed exactly")
    && accessibilityTest.includes("Download inspection receipt JSON")
    && accessibilityTest.includes("never regenerate a source automatically")
    && bundleAudit.includes("customizedTargetArtifactRuntimeChunk")
    && bundleAudit.includes("customizedTargetArtifactRuntimeDynamicImporters")
    && bundleAudit.includes("receipt replay must guarded-verify/replay, installed-assert");
}

function primaryPartCustomizationObservationV1Gate(): DesignerReleaseGateV1 {
  const implemented = primaryPartCustomizationObservationV1ContractImplemented();
  const browserWorkflowImplemented = primaryPartCustomizationBrowserWorkflowImplemented();
  const structuralElectricalExportImplemented = primaryPartCustomizedTargetStructuralElectricalExportImplemented();
  const fullProductionArtifactAuthorityImplemented =
    primaryPartCustomizedTargetFullProductionArtifactAuthorityImplemented();
  const inspectionReceiptImplemented = primaryPartCustomizedTargetInspectionReceiptImplemented();
  const complete = Object.values(implemented).every(Boolean)
    && browserWorkflowImplemented
    && structuralElectricalExportImplemented
    && inspectionReceiptImplemented;
  return gate("contract.primary-part-customization-observation-v1", complete ? "pass" : "blocked", [
    ...(implemented.instructionTransferContractImplemented ? [] : ["primary_part_customization_instruction_transfer_contract_unverified"]),
    ...(implemented.engineObservationImplemented ? [] : ["primary_part_customization_engine_observation_unverified"]),
    ...(implemented.targetOnlyPolicyResultImplemented ? [] : ["primary_part_customization_target_policy_result_unverified"]),
    ...(browserWorkflowImplemented ? [] : ["primary_part_customization_browser_workflow_unverified"]),
    ...(structuralElectricalExportImplemented ? [] : ["primary_part_customized_target_structural_electrical_export_unverified"]),
    ...(inspectionReceiptImplemented ? [] : ["primary_part_customized_target_inspection_receipt_unverified"]),
  ], {
    ...implemented,
    browserWorkflowImplemented,
    ordinaryGenerationMutation: "none",
    targetConstraintPolicyEligibility: implemented.targetOnlyPolicyResultImplemented ? "evaluated" : "not_evaluated",
    selectedPartModel: "not_added",
    commercialAuthority: "not_added",
    customizedTargetStructuralElectricalInspectionExport: structuralElectricalExportImplemented
      ? "implemented"
      : "unverified",
    customizedTargetPortableInspectionReceipt: inspectionReceiptImplemented
      ? "installed_context_replay_verified_integrity_only"
      : "unverified",
    customizedTargetFullProductionArtifactAuthorityImplemented: fullProductionArtifactAuthorityImplemented,
    customizedTargetArtifactKinds: fullProductionArtifactAuthorityImplemented
      ? [
          "customized_target_electrical_bom_csv",
          "customized_target_structural_svg",
          "customized_target_engineering_report_html",
          "customized_target_structural_kicad",
          "customized_target_behavioral_scenario_spice",
        ]
      : [],
    customizedTargetBehavioralScenarioAuthority: fullProductionArtifactAuthorityImplemented
      ? "exact_default_behavioral_zero_omission"
      : "unavailable",
    customizedTargetProductionArtifactAuthority: fullProductionArtifactAuthorityImplemented
      ? "available_target_only_zero_omission_behavioral"
      : "unavailable",
    claimBoundary: fullProductionArtifactAuthorityImplemented
      ? "The shared sidecar remains inert exact-source transfer data until an explicit installed-adapter action regenerates the source and target. The separately authorized target-only result evaluates installed V3 policy without mutating the ordinary result or ranking. Exact in-process authority may emit separately named, content-addressed electrical-BOM CSV, structural SVG, engineering-report HTML, structural KiCad, and the exact default behavioral Scenario SPICE deck only after its existing zero-omission gate passes. Every artifact binds the exact source result/execution, instruction/customized result, target result/candidate/profile, installed context/recipe/policy/decision/eligibility, and—where relevant—scenario identity. The behavioral deck adds no selected-part model, samples, physical fidelity, ranking, commercial, KiCad-attestation, or release authority. The portable receipt deliberately remains limited to the BOM/SVG descriptors; parse/hash validity is integrity-only, restore still requires an already authorized exact source, installed-runtime reassertion, and deterministic replay before only the newly asserted object is authorized."
      : "The shared sidecar remains inert exact-source transfer data until an explicit installed-adapter action regenerates the source and target. The separately authorized target-only result evaluates installed V3 policy without mutating the ordinary result or ranking. Exact in-process authority may emit separately named, content-addressed electrical-BOM CSV and structural-SVG inspection artifacts which visibly preserve the target eligibility decision. A portable receipt self-hashes the exact target sidecar and both artifact descriptors, but parse/hash validity is integrity-only; restore requires an already authorized exact source, installed-runtime reassertion, and deterministic replay of both artifacts before only the newly asserted object is authorized. These surfaces are not ordinary-result, ranking, selected-part model/simulation, commercial, KiCad, attested, or production-readiness authority.",
  });
}

function productionRequirementsTransferContractImplemented(): boolean {
  const requestTransfer = optionalRepoText("apps/web/src/features/designer/RequestTransfer.ts");
  const requestTransferTest = optionalRepoText("apps/web/src/features/designer/request-transfer.test.ts");
  const requirementsForm = optionalRepoText("apps/web/src/features/designer/RequirementsForm.ts");
  const designerRoute = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const designerSpec = optionalRepoText("apps/web/e2e/designer.spec.ts");
  const accessibilitySpec = optionalRepoText("apps/web/e2e/designer-accessibility.spec.ts");
  const offlineSpec = optionalRepoText("apps/web/e2e/designer-offline.spec.ts");
  return requestTransfer.includes('const SHARE_FORMAT = "schemagic-designer-request-share"')
    && requestTransfer.includes('const SHARE_PARAMETER = "r"')
    && requestTransfer.includes('const RESULT_SHARE_PARAMETER = "d"')
    && requestTransfer.includes("parseElectricalDesignRequestV2(input)")
    && requestTransfer.includes("canonicalText !== source")
    && requestTransfer.includes('["format", "schemaVersion", "request", "requestHash", "byteContentHash"]')
    && requestTransfer.includes("payload.requestHash !== transferred.requestHash || payload.byteContentHash !== transferred.byteContentHash")
    && requestTransfer.includes("requestValues.length > 0 && resultValues.length > 0")
    && requestTransferTest.includes("round-trips canonical Motor and Power files with separate semantic and byte identities")
    && requestTransferTest.includes("preserves display units in file bytes while excluding them from semantic request identity")
    && requestTransferTest.includes("rejects V1, V3, result, sourcing-bearing, and extra-field shapes without migration")
    && requestTransferTest.includes('expect(Object.keys(text.request).sort()).toEqual([')
    && requestTransferTest.includes('expectTransferError(() => electricalDesignRequestShareFromHash(`#d=result&r=${encoded}`), "invalid_share")')
    && requirementsForm.includes("Transferred requirements")
    && requirementsForm.includes("Download requirements JSON")
    && requirementsForm.includes("Create requirements share URL")
    && designerRoute.includes("Loaded exact canonical V2 requirements as untrusted input. Review them and press Generate design to use the installed production context.")
    && designerRoute.includes("Restored exact canonical V2 requirements as untrusted input. Review them and press Generate design to use the installed production context.")
    && designerRoute.includes('"schemagic-electrical-request-v2.json"')
    && designerRoute.includes('this.#root.querySelector<HTMLFormElement>("[data-designer-form]")?.addEventListener("submit"')
    && designerSpec.includes("Motor requirements transfer preserves canonical values and units without transferring trust")
    && designerSpec.includes("Power requirements transfer preserves canonical values and requires explicit generation")
    && designerSpec.includes("a stale transferred library version is preserved and rejected by normal generation")
    && designerSpec.includes("expectUntrustedRequirementsOnly(page)")
    && designerSpec.includes('(await downloadText(page, "Download requirements JSON")).content).toBe(source)')
    && designerSpec.includes('hasText: "Requirements status"')
    && designerSpec.includes('toContainText("scheMAGIC Designer V2 generation failed")')
    && accessibilitySpec.includes("transferred requirements remain axe-clean, narrow-safe, and expose focused named actions")
    && accessibilitySpec.includes('Request-share feedback must restore focus to its trigger after rerender')
    && offlineSpec.includes("a shared V2 requirements form reopens from the same-origin static cache while offline")
    && offlineSpec.includes("await context.setOffline(true)");
}

function browserWorkflowGate(): DesignerReleaseGateV1 {
  const strictDefaultCandidateContract = strictDefaultCandidateContractImplemented();
  const connectedStructuralCircuitContract = productionConnectedStructuralCircuitContractImplemented();
  const behavioralScenarioSpiceContract = productionBehavioralScenarioSpiceContractImplemented();
  const requirementsTransferContract = productionRequirementsTransferContractImplemented();
  const primaryPartCustomizationBrowserWorkflow = primaryPartCustomizationBrowserWorkflowImplemented();
  const customizedTargetStructuralElectricalExport = primaryPartCustomizedTargetStructuralElectricalExportImplemented();
  const customizedTargetFullProductionArtifactAuthority =
    primaryPartCustomizedTargetFullProductionArtifactAuthorityImplemented();
  const customizedTargetInspectionReceipt = primaryPartCustomizedTargetInspectionReceiptImplemented();
  return gate("web.production-workflow", "blocked", [
    ...(MOTOR_DESIGN_V2_PRODUCTION_STATUS.status === "ready"
      ? []
      : [`motor_generation:${MOTOR_DESIGN_V2_PRODUCTION_STATUS.reason}`]),
    ...(POWER_DESIGN_V2_PRODUCTION_STATUS.status === "ready"
      ? []
      : [`power_generation:${POWER_DESIGN_V2_PRODUCTION_STATUS.reason}`]),
    ...(strictDefaultCandidateContract
      ? [
          "motor_strict_default_verified_candidate_unavailable",
          "power_strict_default_verified_candidate_unavailable",
        ]
      : ["strict_default_candidate_outcome_unverified"]),
    ...(connectedStructuralCircuitContract ? [] : ["production_connected_structural_circuit_contract_unverified"]),
    ...(behavioralScenarioSpiceContract ? [] : ["production_behavioral_scenario_spice_contract_unverified"]),
    ...(requirementsTransferContract ? [] : ["production_requirements_transfer_contract_unverified"]),
    ...(primaryPartCustomizationBrowserWorkflow
      ? customizedTargetStructuralElectricalExport
        ? customizedTargetFullProductionArtifactAuthority
          ? []
          : ["customized_target_full_production_artifact_authority_unavailable"]
        : ["customized_target_structural_electrical_inspection_export_unavailable"]
      : ["primary_part_customization_browser_workflow_unverified"]),
    "reviewed_selected_part_simulation_fidelity_unavailable",
    "commercial_sourcing_providers_not_authorized",
  ], {
    motorContextStatus: MOTOR_DESIGN_V2_PRODUCTION_STATUS.status,
    powerContextStatus: POWER_DESIGN_V2_PRODUCTION_STATUS.status,
    strictDefaultCandidateContractImplemented: strictDefaultCandidateContract,
    productionConnectedStructuralCircuitContractImplemented: connectedStructuralCircuitContract,
    productionBehavioralScenarioSpiceContractImplemented: behavioralScenarioSpiceContract,
    productionRequirementsTransferContractImplemented: requirementsTransferContract,
    primaryPartCustomizationCoreContractImplemented: Object.values(primaryPartCustomizationObservationV1ContractImplemented()).every(Boolean),
    primaryPartCustomizationBrowserWorkflowImplemented: primaryPartCustomizationBrowserWorkflow,
    customizedTargetStructuralElectricalInspectionExportImplemented: customizedTargetStructuralElectricalExport,
    customizedTargetFullProductionArtifactAuthorityImplemented: customizedTargetFullProductionArtifactAuthority,
    customizedTargetPortableInspectionReceiptImplemented: customizedTargetInspectionReceipt,
    customizedTargetArtifactKinds: customizedTargetFullProductionArtifactAuthority
      ? [
          "customized_target_electrical_bom_csv",
          "customized_target_structural_svg",
          "customized_target_engineering_report_html",
          "customized_target_structural_kicad",
          "customized_target_behavioral_scenario_spice",
        ]
      : [],
    customizedTargetBehavioralScenarioAuthority: customizedTargetFullProductionArtifactAuthority
      ? "exact_default_behavioral_zero_omission"
      : "unavailable",
    customizedTargetProductionArtifactAuthority: customizedTargetFullProductionArtifactAuthority
      ? "available_target_only_zero_omission_behavioral"
      : "unavailable",
    strictDefaultCandidateCounts: strictDefaultCandidateContract ? { motor: 0, power: 0 } : null,
    permissiveInspectionCandidateCounts: { motorExternal: 2, motorIntegrated: 1, powerIntegrated: 1 },
    materialization: connectedStructuralCircuitContract
      ? "connected_exact_bom_structural_default_plus_separate_generic_behavioral_scenarios"
      : "production_connected_structural_circuit_contract_unverified",
    currentProductionSurface: customizedTargetFullProductionArtifactAuthority
      ? "reviewed_motor_and_power_generation_contexts_external_motor_exact_mic4606_2_direct_gate_split_capacitor_roles_54_strict_unknown_policy_rejections_2_permissive_structural_observations_no_series_gate_bom_nominal_capacitance_passes_application_adequacy_unknown_installed_v3_truth_criticality_disposition_zero_eligibility_observation_ui_explicit_unknown_evidence_inspection_canonical_v2_requirements_download_import_share_input_only_explicit_installed_regeneration_primary_part_customization_file_and_r_plus_c_transfer_explicit_adapter_authorized_target_policy_evaluation_customized_target_five_kind_target_only_zero_omission_behavioral_authority_and_bom_svg_portable_receipt_integrity_only_connected_exact_bom_structural_default_separate_generic_behavioral_scenarios_exact_context_scenario_spice_verified_decision_explorer_selected_part_evidence_dossier_exact_mpn_lcsc_search_handoff_exact_result_share_regeneration_exact_engineering_context_bom_svg_report_structural_kicad_exports_and_inline_structural_svg_preview"
      : "reviewed_motor_and_power_generation_contexts_external_motor_exact_mic4606_2_direct_gate_split_capacitor_roles_54_strict_unknown_policy_rejections_2_permissive_structural_observations_no_series_gate_bom_nominal_capacitance_passes_application_adequacy_unknown_installed_v3_truth_criticality_disposition_zero_eligibility_observation_ui_explicit_unknown_evidence_inspection_canonical_v2_requirements_download_import_share_input_only_explicit_installed_regeneration_primary_part_customization_file_and_r_plus_c_transfer_explicit_adapter_authorized_target_policy_evaluation_customized_target_structural_electrical_inspection_and_portable_receipt_integrity_only_connected_exact_bom_structural_default_separate_generic_behavioral_scenarios_exact_context_scenario_spice_verified_decision_explorer_selected_part_evidence_dossier_exact_mpn_lcsc_search_handoff_exact_result_share_regeneration_exact_engineering_context_bom_svg_report_structural_kicad_exports_and_inline_structural_svg_preview",
    claimBoundary: customizedTargetFullProductionArtifactAuthority
      ? "Canonical Motor and Power V2 requirements can be downloaded, imported, and shared as exact untrusted input. Transfer preserves exact libraryVersion and display units, carries no generated result or trust, never generates automatically, and requires an explicit installed-adapter action. Primary-part instruction files and exact #r+c shares are likewise inert until explicit source regeneration; a separately authorized target-only result then evaluates the installed V3 policy without mutating ordinary ranking or exports. Exact WeakMap-bound in-process authority may emit the five separately named customized-target artifacts: electrical-BOM CSV, structural SVG, engineering-report HTML, structural KiCad, and only the exact default behavioral Scenario SPICE deck after its existing zero-omission gate passes. All five bind exact source, target, installed-context, policy-decision and eligibility provenance; the deck remains a generic behavioral projection with no selected-part model or samples. The receipt deliberately continues to describe only BOM/SVG and remains integrity-only. Simulation CSV, Simulator handoff, package-pin mapping, selected-part physical fidelity, external KiCad open/save attestation, release attestation, and commercial authority remain unavailable. Current strict starting points yield no verified candidate. The installed external-Motor lane now enumerates and checks 54 direct-gate options with separate bootstrap and VDD-local capacitor roles under strict policy, rejecting all on unresolved required evidence; explicit inspection Pareto-retains two deterministic structural observations with no series-gate resistor BOM line, and V3 keeps both ineligible. The source-bound nominal-capacitance passes do not establish effective capacitance, bootstrap charge or refresh, VDD-local voltage or placement, bulk energy, switching behavior, or simulation fidelity. Unknown constraints remain unknown and cannot be promoted by the opt-in."
      : "Canonical Motor and Power V2 requirements can be downloaded, imported, and shared as exact untrusted input. Transfer preserves exact libraryVersion and display units, carries no generated result or trust, never generates automatically, and requires an explicit installed-adapter action. Primary-part instruction files and exact #r+c shares are likewise inert until explicit source regeneration; a separately authorized target-only result then evaluates the installed V3 policy without mutating ordinary ranking or exports. That exact in-process pair may emit separately named electrical-BOM CSV and structural-SVG inspection artifacts, plus an integrity-only portable receipt whose restore path requires the authorized source and exact artifact replay. Full customized-target production artifacts, Simulation CSV, Simulator handoff, package-pin mapping, selected-part fidelity, KiCad authority, attestation, and commercial authority remain unavailable. Current strict starting points yield no verified candidate. The installed external-Motor lane now enumerates and checks 54 direct-gate options with separate bootstrap and VDD-local capacitor roles under strict policy, rejecting all on unresolved required evidence; explicit inspection Pareto-retains two deterministic structural observations with no series-gate resistor BOM line, and V3 keeps both ineligible. The source-bound nominal-capacitance passes do not establish effective capacitance, bootstrap charge or refresh, VDD-local voltage or placement, bulk energy, switching behavior, or simulation fidelity. Unknown constraints remain unknown and cannot be promoted by the opt-in.",
  });
}

function staticOfflineAuditContractImplemented(): boolean {
  const packageDocument = optionalRepoText("apps/web/package.json");
  const audit = optionalRepoText("apps/web/scripts/static-offline-audit.mjs");
  const auditCli = optionalRepoText("apps/web/scripts/audit-static-offline.mjs");
  const auditTest = optionalRepoText("apps/web/scripts/static-offline-audit.test.mjs");
  return packageDocument.includes("node scripts/audit-static-offline.mjs")
    && packageDocument.includes("node --test scripts/static-offline-audit.test.mjs")
    && audit.includes('format: "schemagic-static-offline-network-audit"')
    && audit.includes('scope: "production_build_static_artifacts"')
    && audit.includes("source_map_missing")
    && audit.includes("emitted_network_capability_unaccounted")
    && audit.includes("service_worker_fetch_target_unbounded")
    && audit.includes("runtime_external_endpoint_unapproved")
    && audit.includes("lcsc_external_navigation_source_unapproved")
    && audit.includes("userInitiatedExternalNavigationUrls")
    && audit.includes("Static artifact and source-map inspection does not execute the service worker")
    && auditCli.includes('report.status !== "pass"')
    && auditTest.includes("blocks an emitted network call that has no corresponding approved source capability")
    && auditTest.includes("blocks a service worker that fetches outside its guarded request")
    && auditTest.includes("does not let a catalog URL authorize the same endpoint in another chunk")
    && auditTest.includes("inventories only the source-scoped safe-tab LCSC exact-MPN search as user-initiated navigation")
    && auditTest.includes("keeps fetch, XHR, beacon, and provider-style LCSC access fail-closed");
}

function webRegressionContractGate(): DesignerReleaseGateV1 {
  const packageDocument = optionalRepoText("apps/web/package.json");
  const accessibilitySpec = optionalRepoText("apps/web/e2e/designer-accessibility.spec.ts");
  const offlineSpec = optionalRepoText("apps/web/e2e/designer-offline.spec.ts");
  const bundleAssertion = optionalRepoText("apps/web/scripts/assert-production-bundle.mjs");
  const viteConfig = optionalRepoText("apps/web/vite.config.ts");
  const designerEntry = optionalRepoText("apps/web/src/entry.ts");
  const designerRoute = optionalRepoText("apps/web/src/features/designer/DesignerRoute.ts");
  const designerApplications = optionalRepoText("apps/web/src/features/designer/applications.ts");
  const importedResultView = optionalRepoText("apps/web/src/features/designer/ImportedResultView.ts");
  const productionArtifact = optionalRepoText("packages/design-export/src/production-artifact-v2.ts");
  const exampleGallery = optionalRepoText("apps/web/src/features/designer/ExampleGallery.ts");
  const exampleGalleryTest = optionalRepoText("apps/web/src/features/designer/example-gallery.test.ts");
  const exampleGallerySpec = optionalRepoText("apps/web/e2e/designer-examples.spec.ts");
  const resultExport = optionalRepoText("apps/web/src/features/designer/ResultExport.ts");
  const designerSpec = optionalRepoText("apps/web/e2e/designer.spec.ts");
  const staticOfflineAudit = optionalRepoText("apps/web/scripts/static-offline-audit.mjs");
  const staticOfflineAuditTest = optionalRepoText("apps/web/scripts/static-offline-audit.test.mjs");
  const implemented = {
    axePlaywrightPinned: packageDocument.includes('"@axe-core/playwright": "4.13.0"')
      && packageDocument.includes('"test:a11y": "playwright test e2e/designer-accessibility.spec.ts"'),
    accessibilityRouteMatrix: accessibilitySpec.includes("new AxeBuilder({ page })")
      && accessibilitySpec.includes('violation.impact === "serious" || violation.impact === "critical"')
      && accessibilitySpec.includes('reducedMotion: "reduce"')
      && accessibilitySpec.includes("width: 390"),
    sharedResultOfflineReopen: packageDocument.includes('"test:offline": "playwright test e2e/designer-offline.spec.ts"')
      && offlineSpec.includes("await context.setOffline(true)")
      && offlineSpec.includes("It remains structural-only until you explicitly regenerate it with the installed production context.")
      && offlineSpec.includes('name: "Regenerate with installed context"')
      && offlineSpec.includes("await regenerate.click()")
      && offlineSpec.includes("/remains structural-only|does not exactly match the installed production context/u")
      && designerEntry.includes('navigator.serviceWorker.register("/sw.js")'),
    designerBundleBudget: bundleAssertion.includes("const maximumDesignerBytes = 256 * 1024")
      && bundleAssertion.includes("Production Designer chunk exceeds")
      && bundleAssertion.includes("powerGeneratorChunk")
      && bundleAssertion.includes("reachableChunkClosure")
      && bundleAssertion.includes("Production Designer generator bundles are not isolated"),
    reviewedMotorPowerGeneration: designerApplications.includes('await import("@opencircuit/motor-designer/v2")')
      && designerApplications.includes('import("@opencircuit/power-designer/v2")')
      && designerApplications.includes('import("@opencircuit/power-designer/reference-evidence")')
      && designerApplications.includes("const [{ generateVerifiedBuckDesignV2 }, { assessPowerTps54302Evm716ReferenceEvidenceV1 }] = await Promise.all([")
      && designerApplications.includes("generateVerifiedMotorDesignV2(request)")
      && designerApplications.includes("generateVerifiedBuckDesignV2(request)")
      && designerRoute.includes("entry.application === imported.result.request.application")
      && designerSpec.includes("Power retains the reviewed Bel BOM only as an ineligible exact structural observation")
      && designerSpec.includes("power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified")
      && designerSpec.includes('getByText("unknown_constraint_disallowed", { exact: true })')
      && designerSpec.includes('toContainText("power.regulator.current-limit")')
      && designerSpec.includes('toContainText("0 eligible · 1 observed")')
      && designerSpec.includes('toContainText("F1F2-0804-100M")')
      && designerSpec.includes('getByText("Hard electrical failure", { exact: false })).toHaveCount(0)')
      && designerSpec.includes('page.locator("[data-production-schematic-preview] img")).toBeVisible'),
    productionPrimaryPartCustomization: primaryPartCustomizationBrowserWorkflowImplemented(),
    productionPrimaryPartCustomizedTargetStructuralElectricalExport:
      primaryPartCustomizedTargetStructuralElectricalExportImplemented(),
    productionRequirementsTransfer: productionRequirementsTransferContractImplemented(),
    productionContextExports: productionArtifact.includes('"electrical_bom_csv"')
      && productionArtifact.includes('| "scenario_spice"')
      && productionArtifact.includes('"structural_svg"')
      && productionArtifact.includes('"engineering_report_html"')
      && productionArtifact.includes('"structural_kicad"')
      && productionArtifact.includes("Structural KiCad export requires an exact execution context")
      && productionArtifact.includes("Unsupported production artifact kind")
      && designerApplications.includes("getMotorDesignContextV2()")
      && designerApplications.includes("getPowerDesignContextV2()")
      && designerApplications.includes('import("@opencircuit/design-export/production-artifact-v2")')
      && importedResultView.includes('data-production-export="electrical_bom_csv"')
      && importedResultView.includes('data-production-export="scenario_spice"')
      && importedResultView.includes("Simulation CSV requires actual pinned-engine samples and an exact receipt")
      && designerRoute.includes("!importedHasVerifiedProductionContext(this.#imported)")
      && designerRoute.includes('imported?.trust === "production_constraint_observation"')
      && designerRoute.includes("this.#adapter.application !== this.#imported.result.request.application")
      && designerSpec.includes('downloadText(page, "Electrical BOM CSV")')
      && designerSpec.includes('downloadText(page, "Structural KiCad schematic")')
      && designerSpec.includes("expect(motorKicad.content).toContain(generatedMotorCandidate.id)")
      && designerSpec.includes("restoredMotorBom")
      && bundleAssertion.includes("productionExportEvidence")
      && bundleAssertion.includes("forbiddenProductionExportSourceRules"),
    productionBehavioralScenarioSpice: productionBehavioralScenarioSpiceContractImplemented(),
    productionSchematicPreview: importedResultView.includes("data-production-schematic-preview")
      && importedResultView.includes("EXACT STRUCTURAL PROJECTION · NO SIMULATION DATA")
      && designerRoute.includes("#ensureProductionSchematicPreview")
      && designerRoute.includes("URL.createObjectURL")
      && designerRoute.includes("URL.revokeObjectURL")
      && designerRoute.includes("currentTarget?.key !== target.key")
      && designerSpec.includes("productionPreviewText")
      && designerSpec.includes("toBe(motorPreview)")
      && designerSpec.includes('page.locator("[data-production-schematic-preview]")).toHaveCount(0)')
      && designerSpec.includes('toHaveCount(0)')
      && accessibilitySpec.includes("production schematic preview is named, keyboard-scrollable, axe-clean, and internally contained")
      && accessibilitySpec.includes('getByRole("region", { name: "Generated schematic" })'),
    productionDecisionExplorer: importedResultView.includes("data-imported-pin")
      && importedResultView.includes("data-pinned-comparison")
      && importedResultView.includes("data-production-execution-ledger")
      && importedResultView.includes('id: "recipe-feasibility"')
      && importedResultView.includes('id: "electrical-hard-failure"')
      && importedResultView.includes('id: "evidence-policy-exclusion"')
      && importedResultView.includes('id: "duplicate"')
      && importedResultView.includes('id: "objective-relative-pareto"')
      && importedResultView.includes("primaryComponentPriority")
      && importedResultView.includes('component.id === "primary"')
      && importedResultView.includes("varyingComponentIds")
      && importedResultView.includes('data-testid="designer-candidate-variant"')
      && importedResultView.includes("demonstration === undefined")
      && designerRoute.includes("#pinnedImportedCandidateIds")
      && designerRoute.includes("You can pin up to three production candidates or structural observations.")
      && designerSpec.includes("data-production-execution-ledger")
      && designerSpec.includes("data-pinned-comparison")
      && accessibilitySpec.includes('getByRole("region", { name: "Exact V2 observation execution ledger" })')
      && accessibilitySpec.includes('getByRole("region", { name: "Pinned comparison" })'),
    productionExactMpnSearchHandoff: importedResultView.includes('https://www.lcsc.com/search?q=')
      && importedResultView.includes("encodeURIComponent(manufacturerPartNumber)")
      && importedResultView.includes("data-lcsc-search")
      && importedResultView.includes("data-lcsc-search-boundary")
      && importedResultView.includes('target="_blank" rel="noopener noreferrer"')
      && importedResultView.includes('aria-describedby="designer-lcsc-search-boundary"')
      && importedResultView.includes("(opens in a new tab)")
      && importedResultView.includes("scheMAGIC has not queried or verified stock, price, lifecycle, lead time, packaging, or orderability.")
      && importedResultView.includes("productionContextVerified && demonstration === undefined")
      && designerSpec.includes("motorLCSCRequests")
      && designerSpec.includes("/^Search LCSC for .+ \\(opens in a new tab\\)$/u")
      && designerSpec.includes("expect(motorLCSCRequests).toEqual([])")
      && designerSpec.includes('locator("[data-lcsc-search]")')
      && accessibilitySpec.includes("Search LCSC for")
      && staticOfflineAudit.includes('const LCSC_SEARCH_PREFIX = "https://www.lcsc.com/search?q="')
      && staticOfflineAudit.includes("lcsc_external_navigation_source_unapproved")
      && staticOfflineAuditTest.includes("alternate LCSC paths and origins")
      && staticOfflineAuditTest.includes("provider-style LCSC access fail-closed")
      && staticOfflineAuditTest.includes("automatic LCSC navigation and embedded-resource sinks fail-closed"),
    productionSelectedPartEvidenceDossier: importedResultView.includes("data-production-evidence-dossier")
      && importedResultView.includes("data-production-evidence-line")
      && importedResultView.includes("data-production-evidence-ref")
      && importedResultView.includes("orderedUniqueEvidenceRefs")
      && importedResultView.includes("Traceability only.")
      && importedResultView.includes("no new review, admission, model, commercial, or simulation authority")
      && importedResultView.includes("productionContextVerified && demonstration === undefined")
      && designerSpec.includes('name: "Selected-part evidence dossier"')
      && designerSpec.includes('motorEvidenceDossier.locator("[data-production-evidence-line]").first()')
      && designerSpec.includes("data-production-evidence-dossier")
      && accessibilitySpec.includes('name: "Selected-part evidence dossier"')
      && accessibilitySpec.includes("Scrollable evidence references for"),
    productionConnectedStructuralCircuits: productionConnectedStructuralCircuitContractImplemented(),
    strictDefaultCandidateBoundary: strictDefaultCandidateContractImplemented(),
    strictImportedResultExports: resultExport.includes('format: "schemagic-scenario-gate-plan"')
      && resultExport.includes('engineeringContext: "not_present"')
      && resultExport.includes('executionContext: "not_present"')
      && resultExport.includes('candidateRankingUse: "prohibited"')
      && resultExport.includes("source !== expected")
      && designerSpec.includes("schemagic-design-v2.json")
      && designerSpec.includes("schemagic-scenario-gates-v2.json")
      && designerSpec.includes("serializeScenarioGatePlanV2(exactResult, exactCandidate.id)"),
    contentAddressedExampleGallery: viteConfig.includes('fileName: `designer-examples/${path}`')
      && viteConfig.includes("does not match its manifest identity")
      && exampleGallery.includes("exactResponseBytes")
      && exampleGallery.includes("designSha256ContentHash(source) !== expectedContentHash")
      && exampleGallery.includes("parseImportedDesignResultText")
      && designerRoute.includes("loadDesignerDemonstration")
      && exampleGalleryTest.includes("renders four topology lanes and the complete evidence boundary without fetching")
      && exampleGalleryTest.includes("exact manifest, artifact, identity, and strict-import checks")
      && exampleGallerySpec.includes("demonstrationRequests).toEqual([])")
      && exampleGallerySpec.includes("await expect(heading).toBeFocused()")
      && exampleGallerySpec.includes("a changed manifest fails closed before any result artifact request"),
    staticOfflineNetworkAudit: staticOfflineAuditContractImplemented(),
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `web_regression_contract_missing:${name}`);
  return gate("web.automated-regression-contracts", blockers.length === 0 ? "pass" : "blocked", blockers, {
    implemented,
    configuredBrowserProjects: ["chromium", "firefox", "webkit"],
    accessibilityClaimBoundary: "Automated serious/critical axe WCAG A/AA regression coverage is not a complete WCAG or assistive-technology audit",
    offlineClaimBoundary: "The exact production build is statically audited and one shared V2 inspection route is tested against a same-origin local runtime cache; deployed routes, headers, CDN, cache persistence/eviction and browser-specific production behavior remain unverified",
    requirementsTransferClaimBoundary: "Canonical Motor and Power V2 requirement files and #r shares are strict untrusted input only. They preserve exact request bytes, libraryVersion, and display units but carry no generated result, execution, V3 decision, verified context, candidate/scenario, provider/commercial, simulation, component override, or MPN override state; loading never generates, and only an explicit installed-adapter generation attempt can create a new production observation.",
    primaryPartCustomizationClaimBoundary: "Canonical instruction files and exact #r+c shares remain inert until explicit installed-adapter regeneration. The adapter authorizes only the exact in-process target-only result, which evaluates installed V3 policy without mutating ordinary result bytes or ranking. Separately named electrical-BOM CSV and structural-SVG inspection artifacts bind that exact target and eligibility decision; they add no ordinary-result, selected-part model/simulation, commercial, KiCad, attestation, or production-readiness authority.",
    performanceClaimBoundary: "A static Designer route byte ceiling is not runtime evidence; the separate environment-bound Chromium contract measures exact local Motor/Power completion and post-GC JS heap without claiming deployed, cross-browser, whole-process, provider, or simulation performance",
    exportClaimBoundary: "Exact-regenerated production results may preview and export context-validated structural SVG plus electrical BOM, engineering HTML, structural KiCad, and a zero-omission Scenario SPICE deck for the separate generic behavioral scenario. The deck is not a selected-part model and cannot affect BOM, constraints, ranking, evidence, receipts, or V3 eligibility. Ordinary imports remain limited to strict result bytes or context-free gate metadata; Simulation CSV, Simulator handoff, commercial data, footprints and external KiCad verification remain unavailable",
    decisionExplorerClaimBoundary: "The pinned comparison and five-class execution ledger expose only the exact regenerated production result and execution report. They do not reinterpret a rejection as a bad part, promote unknown evidence, enable component substitution, or add commercial or simulation authority",
    exactMpnSearchClaimBoundary: "Production BOM link-outs perform user-initiated exact-MPN LCSC navigation only. scheMAGIC does not query, import, store, rank, export, or attest LCSC stock, price, lifecycle, lead time, packaging, orderability, or provider data",
    selectedPartEvidenceDossierClaimBoundary: "The selected-part dossier exposes only exact persisted EvidenceRef fields already bound to the regenerated candidate. It adds no review, admission, model, commercial, provider, or simulation-fidelity authority",
    connectedStructuralCircuitClaimBoundary: "Production retained candidates preserve the exact BOM in connected structural default graphs with content-addressed schematic-only primary blocks. Separate generic request/passive-derived behavioral scenario graphs add no package-pin mapping, selected-part model, regulation/performance proof, ranking input, or V3-eligibility authority",
    exampleGalleryClaimBoundary: "Four examples are explicit-click, content-addressed synthetic result inspections; they are not production-profile, provider, commercial, selected-part-fidelity or generation evidence",
  });
}

export interface DesignerRuntimeTimingBranchAssessmentV1 {
  readonly applicationGuard: boolean;
  readonly completionPushCount: number;
  readonly matchedRequiredSettlementAwaits: number;
  readonly requiredSettlementAwaitCount: number;
  readonly completionAfterRequiredSettlement: boolean;
}

export interface DesignerRuntimeTimingOrderAssessmentV1 {
  readonly parseValid: boolean;
  readonly branchStructureValid: boolean;
  readonly motor: DesignerRuntimeTimingBranchAssessmentV1;
  readonly power: DesignerRuntimeTimingBranchAssessmentV1;
  readonly pass: boolean;
}

type RuntimeExpressionMatcherV1 = (expression: ts.Expression) => boolean;
type RuntimeStatementMatcherV1 = (statement: ts.Statement) => boolean;

function runtimeLiteralV1(expression: ts.Expression, expected: string | number): boolean {
  if (typeof expected === "string") {
    return (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
      && expression.text === expected;
  }
  return ts.isNumericLiteral(expression) && Number(expression.text) === expected;
}

function runtimeIdentifierV1(name: string): RuntimeExpressionMatcherV1 {
  return (expression) => ts.isIdentifier(expression) && expression.text === name;
}

function runtimePropertyV1(objectName: string, propertyName: string): RuntimeExpressionMatcherV1 {
  return (expression) => ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === objectName
    && expression.name.text === propertyName;
}

function runtimeLocatorV1(objectName: string, locator: string): RuntimeExpressionMatcherV1 {
  return (expression) => ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && ts.isIdentifier(expression.expression.expression)
    && expression.expression.expression.text === objectName
    && expression.expression.name.text === "locator"
    && expression.arguments.length === 1
    && runtimeLiteralV1(expression.arguments[0]!, locator);
}

function runtimeDirectCallV1(statement: ts.Statement, awaited: boolean): ts.CallExpression | undefined {
  if (!ts.isExpressionStatement(statement)) return undefined;
  const expression = awaited
    ? ts.isAwaitExpression(statement.expression)
      ? statement.expression.expression
      : undefined
    : statement.expression;
  return expression !== undefined && ts.isCallExpression(expression) ? expression : undefined;
}

function runtimeAwaitedIdentifierCallV1(name: string, argument: string): RuntimeStatementMatcherV1 {
  return (statement) => {
    const call = runtimeDirectCallV1(statement, true);
    return call !== undefined
      && ts.isIdentifier(call.expression)
      && call.expression.text === name
      && call.arguments.length === 1
      && runtimeIdentifierV1(argument)(call.arguments[0]!);
  };
}

function runtimeExpectCallV1(
  statement: ts.Statement,
  awaited: boolean,
  subject: RuntimeExpressionMatcherV1,
  matcherName: string,
  expectedArguments: readonly (string | number)[],
): boolean {
  const call = runtimeDirectCallV1(statement, awaited);
  if (
    call === undefined
    || !ts.isPropertyAccessExpression(call.expression)
    || call.expression.name.text !== matcherName
    || !ts.isCallExpression(call.expression.expression)
  ) return false;
  const expectCall = call.expression.expression;
  return ts.isIdentifier(expectCall.expression)
    && expectCall.expression.text === "expect"
    && expectCall.arguments.length === 1
    && subject(expectCall.arguments[0]!)
    && call.arguments.length === expectedArguments.length
    && expectedArguments.every((expected, index) => runtimeLiteralV1(call.arguments[index]!, expected));
}

function runtimeAwaitedExpectV1(
  subject: RuntimeExpressionMatcherV1,
  matcherName: string,
  expectedArguments: readonly (string | number)[] = [],
): RuntimeStatementMatcherV1 {
  return (statement) => runtimeExpectCallV1(statement, true, subject, matcherName, expectedArguments);
}

function runtimeApplicationGuardV1(statement: ts.Statement, application: string): boolean {
  return runtimeExpectCallV1(
    statement,
    false,
    runtimePropertyV1("workload", "application"),
    "toBe",
    [application],
  );
}

function runtimeCompletionPushCallV1(call: ts.CallExpression): boolean {
  return ts.isPropertyAccessExpression(call.expression)
    && ts.isIdentifier(call.expression.expression)
    && call.expression.expression.text === "generationAndPreviewUs"
    && call.expression.name.text === "push"
    && call.arguments.length === 1;
}

function runtimeCompletionPushV1(statement: ts.Statement): boolean {
  const call = runtimeDirectCallV1(statement, false);
  return call !== undefined && runtimeCompletionPushCallV1(call);
}

function runtimeCompletionPushCountV1(node: ts.Node | undefined): number {
  if (node === undefined) return 0;
  let count = 0;
  const visit = (nested: ts.Node): void => {
    if (ts.isCallExpression(nested) && runtimeCompletionPushCallV1(nested)) count += 1;
    ts.forEachChild(nested, visit);
  };
  visit(node);
  return count;
}

function runtimeCompletionConditionV1(expression: ts.Expression, completionPoint: string): boolean {
  if (!ts.isBinaryExpression(expression) || expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) {
    return false;
  }
  const completionProperty = runtimePropertyV1("workload", "completionPoint");
  return (completionProperty(expression.left) && runtimeLiteralV1(expression.right, completionPoint))
    || (completionProperty(expression.right) && runtimeLiteralV1(expression.left, completionPoint));
}

function assessRuntimeTimingBranchV1(
  block: ts.Block | undefined,
  application: string,
  requiredSettlementAwaits: readonly RuntimeStatementMatcherV1[],
): DesignerRuntimeTimingBranchAssessmentV1 {
  const statements = block?.statements ?? [];
  const applicationGuardIndices = statements.flatMap((statement, index) => (
    runtimeApplicationGuardV1(statement, application) ? [index] : []
  ));
  const completionPushIndices = statements.flatMap((statement, index) => (
    runtimeCompletionPushV1(statement) ? [index] : []
  ));
  const completionPushCount = runtimeCompletionPushCountV1(block);
  const requiredAwaitIndices = requiredSettlementAwaits.map((matcher) => (
    statements.flatMap((statement, index) => matcher(statement) ? [index] : [])
  ));
  const applicationGuard = applicationGuardIndices.length === 1;
  const completionPushIndex = completionPushCount === 1 && completionPushIndices.length === 1
    ? completionPushIndices[0]!
    : undefined;
  const matchedRequiredSettlementAwaits = requiredAwaitIndices.filter((indices) => indices.length === 1).length;
  const completionAfterRequiredSettlement = applicationGuard
    && completionPushIndex !== undefined
    && applicationGuardIndices[0]! < completionPushIndex
    && matchedRequiredSettlementAwaits === requiredSettlementAwaits.length
    && requiredAwaitIndices.every((indices) => indices[0]! < completionPushIndex);
  return Object.freeze({
    applicationGuard,
    completionPushCount,
    matchedRequiredSettlementAwaits,
    requiredSettlementAwaitCount: requiredSettlementAwaits.length,
    completionAfterRequiredSettlement,
  });
}

export function assessDesignerRuntimeTimingOrderV1(
  runtimeSpecText: string,
): DesignerRuntimeTimingOrderAssessmentV1 {
  const source = ts.createSourceFile(
    "designer-runtime.spec.ts",
    runtimeSpecText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const parseDiagnostics = (source as ts.SourceFile & {
    readonly parseDiagnostics: readonly ts.Diagnostic[];
  }).parseDiagnostics;
  const measureFunctions = source.statements.filter((statement): statement is ts.FunctionDeclaration => (
    ts.isFunctionDeclaration(statement)
      && statement.name?.text === "measureApplication"
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) === true
      && statement.body !== undefined
  ));
  const measureBody = measureFunctions.length === 1 ? measureFunctions[0]!.body : undefined;
  const motorCompletionPoint = "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled";
  const completionBranches = measureBody?.statements.flatMap((statement) => {
    if (!ts.isForStatement(statement) || !ts.isBlock(statement.statement)) return [];
    return statement.statement.statements.filter((nested): nested is ts.IfStatement => (
      ts.isIfStatement(nested)
        && runtimeCompletionConditionV1(nested.expression, motorCompletionPoint)
        && ts.isBlock(nested.thenStatement)
        && nested.elseStatement !== undefined
        && ts.isBlock(nested.elseStatement)
    ));
  }) ?? [];
  const completionBranch = completionBranches.length === 1 ? completionBranches[0] : undefined;
  const powerBranch = completionBranch?.elseStatement;
  const decodedPreview = runtimeAwaitedIdentifierCallV1("waitForDecodedPreview", "page");
  const settledBusy = runtimeAwaitedExpectV1(
    runtimeIdentifierV1("customization"),
    "toHaveAttribute",
    ["aria-busy", "false"],
  );
  const targetOptions = runtimeLocatorV1("customizationTargets", "option");
  const motor = assessRuntimeTimingBranchV1(
    completionBranch !== undefined && ts.isBlock(completionBranch.thenStatement)
      ? completionBranch.thenStatement
      : undefined,
    "motor.brushed-dc",
    [
      decodedPreview,
      settledBusy,
      runtimeAwaitedExpectV1(runtimeIdentifierV1("customizationTargets"), "toBeEnabled"),
      runtimeAwaitedExpectV1(targetOptions, "toHaveCount", [2]),
    ],
  );
  const power = assessRuntimeTimingBranchV1(
    powerBranch !== undefined && ts.isBlock(powerBranch)
      ? powerBranch
      : undefined,
    "power.buck",
    [
      decodedPreview,
      settledBusy,
      runtimeAwaitedExpectV1(runtimeIdentifierV1("customization"), "toContainText", ["0 compatible"]),
      runtimeAwaitedExpectV1(
        runtimeIdentifierV1("customization"),
        "toContainText",
        ["No exact same-recipe primary alternate"],
      ),
      runtimeAwaitedExpectV1(runtimeIdentifierV1("customizationTargets"), "toBeDisabled"),
      runtimeAwaitedExpectV1(targetOptions, "toHaveCount", [1]),
    ],
  );
  const parseValid = parseDiagnostics.length === 0;
  const branchStructureValid = measureFunctions.length === 1
    && completionBranches.length === 1
    && runtimeCompletionPushCountV1(measureBody) === 2;
  return Object.freeze({
    parseValid,
    branchStructureValid,
    motor,
    power,
    pass: parseValid
      && branchStructureValid
      && motor.completionAfterRequiredSettlement
      && power.completionAfterRequiredSettlement,
  });
}

function runtimePerformanceMemoryContractGate(): DesignerReleaseGateV1 {
  const runtimeSpec = optionalRepoText("apps/web/e2e/designer-runtime.spec.ts");
  const runtimeConfig = optionalRepoText("apps/web/playwright.runtime.config.ts");
  const runtimeModule = optionalRepoText("packages/designer-release-audit/src/designer-runtime-audit.ts");
  const runtimeTest = optionalRepoText("packages/designer-release-audit/test/designer-runtime-audit.test.ts");
  const releaseReceiptModule = optionalRepoText("packages/designer-release-audit/src/designer-runtime-release-receipt.ts");
  const releaseReceiptTest = optionalRepoText("packages/designer-release-audit/test/designer-runtime-release-receipt.test.ts");
  const releaseCli = optionalRepoText("packages/designer-release-audit/src/cli.ts");
  const packageDocument = optionalRepoText("apps/web/package.json");
  const workflow = optionalRepoText(".github/workflows/ci.yml");
  const releaseWorkflow = optionalRepoText(".github/workflows/designer-runtime-release.yml");
  let contract: ReturnType<typeof parseDesignerRuntimeContractV1> | undefined;
  try {
    contract = parseDesignerRuntimeContractV1(JSON.parse(optionalRepoText("apps/web/designer-runtime-contract.json")));
  } catch {
    contract = undefined;
  }
  const runtimeTimingOrder = assessDesignerRuntimeTimingOrderV1(runtimeSpec);
  const implemented = {
    contentAddressedContract: contract !== undefined,
    exactMotorPowerWorkloads: contract?.workloads.map((entry) => [
      entry.application,
      entry.presetId,
      entry.completionPoint,
    ])
      .every((entry, index) => JSON.stringify(entry) === JSON.stringify([
        [
          "motor.brushed-dc",
          "motor.integrated-12v",
          "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
        ],
        [
          "power.buck",
          "power.integrated-12v-low-current",
          "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled",
        ],
      ][index])) ?? false,
    strictEnvironmentReport: runtimeModule.includes("parseDesignerRuntimeReportV1")
      && runtimeModule.includes("productionArtifactSetHash")
      && runtimeModule.includes("content_hash_mismatch")
      && runtimeModule.includes("budget_exceeded")
      && runtimeTest.includes("rejects extra keys, forged scope, identity drift, summary drift, and exceeded budgets")
      && runtimeTest.includes('forged.boundaries.attestation = "independent"'),
    exactProductionIdentities: runtimeSpec.includes("requestHash")
      && runtimeSpec.includes("resultContentHash")
      && runtimeSpec.includes('completionPoint: "exact_result_and_decoded_structural_svg_preview_and_customization_target_discovery_settled"')
      && runtimeSpec.includes("candidateId")
      && runtimeSpec.includes("previewContentHash")
      && runtimeSpec.includes('completionPoint: "exact_ineligible_observation_and_decoded_structural_svg_preview_and_customization_target_discovery_settled"')
      && runtimeSpec.includes("constraintDecisionContentHash")
      && runtimeSpec.includes("candidateEligible: false")
      && runtimeSpec.includes('toContainText("0 eligible · 1 observed")')
      && runtimeSpec.includes('toContainText("1 structural observation")')
      && runtimeSpec.includes('data-production-observation-boundary="selected_detail"')
      && runtimeSpec.includes("expect(observedIdentity).toEqual(exactIdentity)")
      && runtimeSpec.includes("auditStaticOfflineNetworkBuild")
      && runtimeSpec.includes("productionArtifactSetHash: staticAudit.artifactSetHash")
      && runtimeModule.includes("DesignerRuntimeRetainedApplicationMeasurementV1")
      && runtimeModule.includes("DesignerRuntimeIneligiblePowerApplicationMeasurementV1")
      && runtimeModule.includes("DesignerRuntimeRejectedApplicationMeasurementV1")
      && runtimeModule.includes('value.candidateEligible, false, `${path}/candidateEligible`')
      && runtimeTest.includes("forgedEligibility")
      && runtimeTest.includes("forgedRejectedFields")
      && runtimeTest.includes("legacy rejected Power workload shape strictly validated"),
    browserSideTimingAndRetainedHeap: runtimeSpec.includes("performance.now()")
      && runtimeSpec.includes('HeapProfiler.collectGarbage')
      && runtimeSpec.includes('entry.name === "JSHeapUsedSize"')
      && runtimeSpec.includes("retainedJsHeapGrowthBytes")
      && runtimeSpec.includes("longtask")
      && runtimeTimingOrder.pass
      && runtimeSpec.includes('getByRole("heading", { name: "No retained candidate" })')
      && runtimeSpec.includes('getByRole("heading", { name: "Exact V2 observation execution ledger" })'),
    dedicatedPinnedRunner: runtimeConfig.includes('testMatch: "designer-runtime.spec.ts"')
      && runtimeConfig.includes('name: "chromium-runtime"')
      && runtimeConfig.includes("headless: true")
      && runtimeConfig.includes('serviceWorkers: "allow"')
      && runtimeSpec.includes("expect(page.viewportSize()).toEqual(contract.runner.viewport)")
      && runtimeConfig.includes("reuseExistingServer: false")
      && runtimeConfig.includes('preserveOutput: "always"')
      && packageDocument.includes('"audit:designer-runtime": "playwright test --config playwright.runtime.config.ts"'),
    ciArtifactLane: workflow.includes("designer-runtime-audit:")
      && workflow.includes("npx playwright install --with-deps chromium")
      && workflow.includes("apps/web/test-results/designer-runtime"),
    releaseAttachmentReceipt: releaseReceiptModule.includes("parseDesignerRuntimeReleaseReceiptV1")
      && releaseReceiptModule.includes("environment_bound_budget_pass_byte_association")
      && releaseReceiptModule.includes("self_reported_github_actions_context")
      && releaseReceiptModule.includes("workflowRevision")
      && releaseReceiptModule.includes('attestation: "none"')
      && releaseReceiptModule.includes("file_content_hash_mismatch")
      && releaseReceiptModule.includes("context_mismatch")
      && releaseReceiptTest.includes("rejects forged claim scope, attestation, and canonical receipt hash")
      && releaseReceiptTest.includes("keeps runtime release blocked when bytes are associated to caller-supplied context without attestation")
      && runtimeSpec.includes("DESIGNER_RUNTIME_REPORT_OUTPUT and DESIGNER_RUNTIME_RECEIPT_OUTPUT must be set together")
      && runtimeSpec.includes("createDesignerRuntimeReleaseReceiptV1")
      && runtimeSpec.includes('requiredEnvironment("GITHUB_WORKFLOW_SHA")')
      && releaseCli.includes("runtime_release_attachment:report_receipt_and_github_context_are_required_together")
      && releaseCli.includes('requiredEnvironment("GITHUB_WORKFLOW_SHA")')
      && releaseWorkflow.includes("workflow_dispatch:")
      && releaseWorkflow.includes("Verify the exact dispatched revision")
      && releaseWorkflow.includes("--github-context-from-env")
      && releaseWorkflow.includes("DESIGNER_RUNTIME_RECEIPT_OUTPUT")
      && releaseWorkflow.includes("DESIGNER_RELEASE_READINESS_OUTPUT")
      && releaseWorkflow.includes("actions/attest@v4")
      && releaseWorkflow.includes("attestations: write")
      && releaseWorkflow.includes("artifact-metadata: write"),
    boundedClaims: contract?.boundaries.attestation === "none"
      && contract.boundaries.providers.includes("disabled")
      && contract.boundaries.simulation.includes("No simulation")
      && contract.boundaries.deployment.includes("does not measure a deployed origin")
      && contract.boundaries.memory.includes("not whole-process")
      && contract.boundaries.memory.includes("customization target discovery")
      && contract.boundaries.memory.includes("aria-busy=false"),
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `runtime_audit_contract_missing:${name}`);
  return gate("web.runtime-performance-memory-contract", blockers.length === 0 ? "pass" : "blocked", blockers, {
    implemented,
    contractVersion: contract?.version ?? null,
    contractContentHash: contract?.contentHash ?? null,
    workloads: contract?.workloads ?? [],
    budgets: contract?.budgets ?? null,
    claimBoundary: "A passing report proves only the bound local headless Chromium production build, exact Motor retained-result plus decoded structural-SVG and settled enabled two-option primary-customization completion, exact retained-but-ineligible Power observation plus installed decision, decoded structural-SVG, and settled zero-compatible primary-customization completion, browser-side completion time, Chromium post-GC JS heap, retained heap, and long-task budgets. The Power workload records `candidateEligible:false`; observation retention, preview availability, and customization settlement grant no eligibility or selected-part fidelity. A receipt adds exact byte association to self-reported GitHub context, not run authentication. The manual workflow publishes provenance attestations, but this audit does not verify them. Nothing here proves deployed performance, cross-browser or low-end-device performance, whole-process memory, provider readiness, or simulation fidelity.",
  });
}

function repositorySafetyGate(): DesignerReleaseGateV1 {
  try {
    const report = scanDesignerReleaseRepositoryV1(dirname(repoFile("package.json")));
    const blockers = report.findings.map((finding) => [
      "repository_scan",
      finding.ruleId,
      finding.path,
      finding.line ?? "file",
    ].join(":"));
    return gate("release.repository-safety-scan", report.status === "pass" ? "pass" : "blocked", blockers, {
      scanFormat: report.format,
      scanSchemaVersion: report.schemaVersion,
      scanScope: report.scope,
      candidateFileCount: report.candidateFileCount,
      scannedTextFileCount: report.scannedTextFileCount,
      skippedBinaryFileCount: report.skippedBinaryFileCount,
      candidateSetContentHash: report.candidateSetContentHash,
      scanContentHash: report.contentHash,
      boundaries: report.boundaries,
    });
  } catch {
    return gate("release.repository-safety-scan", "blocked", ["repository_scan_unavailable"], {
      scanAvailable: false,
    });
  }
}

interface DesignerExampleGalleryDocument {
  format?: unknown;
  schemaVersion?: unknown;
  contractVersion?: unknown;
  contentHash?: unknown;
  boundaries?: {
    classification?: unknown;
    allowedUse?: unknown;
    productionProfileCount?: unknown;
    productionProfileAdmissionClaim?: unknown;
    providerAccess?: unknown;
    commercialData?: unknown;
    simulationFidelityClaim?: unknown;
  };
  examples?: Array<{
    id?: unknown;
    artifact?: { path?: unknown; byteLength?: unknown; contentHash?: unknown };
    generator?: unknown;
    request?: unknown;
    result?: unknown;
    library?: unknown;
    recipes?: unknown;
    candidateIds?: unknown;
  }>;
}

interface DesignerExampleArtifactDocument {
  format?: unknown;
  schemaVersion?: unknown;
  id?: unknown;
  boundaries?: unknown;
  generator?: unknown;
  identities?: { request?: unknown; result?: unknown; library?: unknown; recipes?: unknown };
  result?: { candidates?: Array<{ id?: unknown }> };
}

function exampleGalleryContractGate(): DesignerReleaseGateV1 {
  const manifestText = optionalRepoText("packages/designer-examples/artifacts/manifest.json");
  const generator = optionalRepoText("packages/designer-examples/src/generate.ts");
  const galleryTest = optionalRepoText("packages/designer-examples/test/gallery.test.ts");
  let manifest: DesignerExampleGalleryDocument | null = null;
  try {
    manifest = JSON.parse(manifestText) as DesignerExampleGalleryDocument;
  } catch {
    manifest = null;
  }
  const boundaries = manifest?.boundaries;
  const examples = manifest?.examples ?? [];
  const expectedIds = ["m1-compact", "m2-power", "p1-compact", "p2-high-voltage"];
  const observedIds = examples
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string")
    .sort();
  const artifactChecks = examples.map((entry) => {
    const id = typeof entry.id === "string" ? entry.id : "invalid";
    const expectedPath = expectedIds.includes(id) ? `artifacts/${id}.json` : null;
    const artifactText = expectedPath === null
      ? ""
      : optionalRepoText(`packages/designer-examples/${expectedPath}`);
    let artifact: DesignerExampleArtifactDocument | undefined;
    try {
      artifact = JSON.parse(artifactText) as DesignerExampleArtifactDocument;
    } catch {
      artifact = undefined;
    }
    return {
      id,
      exactPath: entry.artifact?.path === expectedPath,
      exactByteLength: typeof entry.artifact?.byteLength === "number"
        && entry.artifact.byteLength === Buffer.byteLength(artifactText, "utf8"),
      exactContentHash: typeof entry.artifact?.contentHash === "string"
        && entry.artifact.contentHash === `sha256:${createHash("sha256").update(artifactText, "utf8").digest("hex")}`,
      exactDocumentIdentity: artifact?.format === "schemagic-designer-example"
        && artifact.schemaVersion === 1
        && artifact.id === id,
      inheritedBoundaries: JSON.stringify(canonicalValue(artifact?.boundaries ?? null))
        === JSON.stringify(canonicalValue(boundaries ?? null)),
      exactIdentityBindings: JSON.stringify(canonicalValue([
        artifact?.generator ?? null,
        artifact?.identities?.request ?? null,
        artifact?.identities?.result ?? null,
        artifact?.identities?.library ?? null,
        artifact?.identities?.recipes ?? null,
        artifact?.result?.candidates?.map((candidate) => candidate.id ?? null) ?? null,
      ])) === JSON.stringify(canonicalValue([
        entry.generator ?? null,
        entry.request ?? null,
        entry.result ?? null,
        entry.library ?? null,
        entry.recipes ?? null,
        entry.candidateIds ?? null,
      ])),
    };
  });
  const { contentHash: _contentHash, ...manifestPayload } = manifest ?? {};
  const expectedManifestContentHash = `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(manifestPayload)), "utf8")
    .digest("hex")}`;
  const implemented = {
    closedManifest: manifest?.format === "schemagic-designer-example-gallery"
      && manifest.schemaVersion === 1
      && manifest.contractVersion === "designer-reference-gallery.1",
    exactFourFixtureSet: JSON.stringify(observedIds) === JSON.stringify(expectedIds),
    contentAddressedManifest: manifest?.contentHash === expectedManifestContentHash,
    exactArtifactBytes: artifactChecks.length === expectedIds.length
      && artifactChecks.every((entry) => entry.exactPath
        && entry.exactByteLength
        && entry.exactContentHash
        && entry.exactDocumentIdentity
        && entry.inheritedBoundaries
        && entry.exactIdentityBindings),
    regenerationContract: generator.includes("buildDesignerExampleGalleryBundle")
      && generator.includes("assertExactGenerationContext")
      && generator.includes("canonicalContentHash")
      && galleryTest.includes("regenerates all four checked-in artifacts and the manifest byte-for-byte")
      && galleryTest.includes("binds exact request, result, library, recipe, and artifact identities"),
    syntheticBoundary: boundaries?.classification === "synthetic_test_fixture"
      && boundaries.allowedUse === "testing_and_ui_examples_only"
      && boundaries.productionProfileCount === 0
      && boundaries.productionProfileAdmissionClaim === "none"
      && boundaries.providerAccess === "none"
      && boundaries.commercialData === "none"
      && boundaries.simulationFidelityClaim === "none",
  };
  const blockers = Object.entries(implemented)
    .filter(([, present]) => !present)
    .map(([name]) => `example_gallery_contract_missing:${name}`);
  return gate("designer.synthetic-example-gallery-contract", blockers.length === 0 ? "pass" : "blocked", blockers, {
    implemented,
    manifestContentHash: manifest?.contentHash ?? null,
    exampleIds: observedIds,
    artifacts: artifactChecks,
    boundaries,
    claimBoundary: "These four content-addressed documents are synthetic test/UI examples, not production-profile, provider, commercial, selected-part-fidelity or release evidence",
  });
}

interface ExternalKicadQaReleaseAttachmentAssessment {
  associated: boolean;
  artifactAttested: boolean;
  blocker: string;
  evidence: Record<string, unknown> | null;
}

function externalKicadQaReleaseAttachmentFileHash(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactExternalKicadQaFixtureInputEvidence(
  report: Readonly<ExternalKicadQaReportV1>,
): Array<Record<string, unknown>> {
  const currentArtifacts = buildExternalKicadQaArtifactsV1();
  if (currentArtifacts.length !== report.fixtures.length) {
    throw new TypeError("external_kicad_cli_qa_fixture_set_mismatch");
  }
  const reportedByFixtureId = new Map(report.fixtures.map((fixture) => [fixture.fixtureId, fixture]));
  if (reportedByFixtureId.size !== currentArtifacts.length) {
    throw new TypeError("external_kicad_cli_qa_fixture_set_mismatch");
  }
  return currentArtifacts.map((artifact) => {
    const reported = reportedByFixtureId.get(artifact.fixtureId);
    if (reported === undefined
      || reported.fixtureId !== artifact.fixtureId
      || reported.application !== artifact.application
      || reported.candidateId !== artifact.candidateId
      || reported.circuitId !== artifact.circuitId
      || reported.designResultContentHash !== artifact.designResultContentHash
      || reported.engineeringContextContentHash !== artifact.engineeringContextContentHash) {
      throw new TypeError(`${artifact.fixtureId}:current_fixture_identity_mismatch`);
    }
    const inputBytes = new TextEncoder().encode(artifact.schematic);
    const inputContentHash = externalKicadQaReleaseAttachmentFileHash(inputBytes);
    if (reported.input.byteLength !== inputBytes.byteLength
      || reported.input.contentHash !== inputContentHash) {
      throw new TypeError(`${artifact.fixtureId}:current_fixture_input_bytes_mismatch`);
    }
    return {
      fixtureId: artifact.fixtureId,
      application: artifact.application,
      candidateId: artifact.candidateId,
      circuitId: artifact.circuitId,
      designResultContentHash: artifact.designResultContentHash,
      engineeringContextContentHash: artifact.engineeringContextContentHash,
      input: {
        byteLength: inputBytes.byteLength,
        contentHash: inputContentHash,
      },
    };
  });
}

function assessExternalKicadQaReleaseAttachment(
  input: DesignerExternalKicadQaReleaseAttachmentInputV1 | undefined,
): ExternalKicadQaReleaseAttachmentAssessment {
  if (input === undefined) return {
    associated: false,
    artifactAttested: false,
    blocker: "external_kicad_cli_qa_release_report_unattached",
    evidence: null,
  };
  try {
    if (!(input.reportBytes instanceof Uint8Array)) {
      throw new TypeError("external_kicad_cli_qa_report_bytes_invalid");
    }
    const reportText = new TextDecoder("utf-8", { fatal: true }).decode(input.reportBytes);
    const report = parseExternalKicadQaReportV1(reportText);
    const fixtures = exactExternalKicadQaFixtureInputEvidence(report);
    return {
      associated: true,
      artifactAttested: false,
      blocker: "external_kicad_cli_qa_release_artifact_attestation_unverified",
      evidence: {
        validation: "current_fixture_input_identity_associated_unattested",
        reportContentHash: report.contentHash,
        reportFileContentHash: externalKicadQaReleaseAttachmentFileHash(input.reportBytes),
        reportByteLength: input.reportBytes.byteLength,
        reportedProofScope: report.scope.proof,
        reportedAttestation: report.scope.attestation,
        reportedKicad: {
          executable: report.kicad.executable,
          version: report.kicad.version,
        },
        fixtures,
        boundaries: {
          exactCurrentFixtureInputsRegeneratedAndMatched: true,
          reportSchemaAndSelfHashVerified: true,
          reportedOutputOrPdfBytesVerified: false,
          externalCommandRerunByReleaseAudit: false,
          executionHostAuthenticated: false,
          executionContextAuthenticated: false,
          artifactAttested: false,
          visualQualityVerified: false,
          interactiveOpenSaveWithoutRepairVerified: false,
          footprintVerificationClaim: "none",
          productionProfileClaim: "none",
          simulationFidelityClaim: "none",
        },
      },
    };
  } catch (error) {
    return {
      associated: false,
      artifactAttested: false,
      blocker: "external_kicad_cli_qa_release_attachment_invalid",
      evidence: {
        validation: "invalid",
        reportFileContentHash: input.reportBytes instanceof Uint8Array
          ? externalKicadQaReleaseAttachmentFileHash(input.reportBytes)
          : null,
        reportByteLength: input.reportBytes instanceof Uint8Array ? input.reportBytes.byteLength : null,
        reason: error instanceof Error ? error.message : "unknown_error",
      },
    };
  }
}

interface RuntimeReleaseAttachmentAssessment {
  associated: boolean;
  artifactAttested: boolean;
  blocker: string;
  evidence: Record<string, unknown> | null;
}

function assessRuntimeReleaseAttachment(
  input: DesignerRuntimeReleaseAttachmentInputV1 | undefined,
): RuntimeReleaseAttachmentAssessment {
  if (input === undefined) return {
    associated: false,
    artifactAttested: false,
    blocker: "runtime_performance_and_memory_release_report_unattached",
    evidence: null,
  };
  try {
    const contract = parseDesignerRuntimeContractV1(JSON.parse(optionalRepoText("apps/web/designer-runtime-contract.json")));
    const receipt: DesignerRuntimeReleaseReceiptV1 = parseDesignerRuntimeReleaseReceiptV1(
      input.receipt,
      input.reportBytes,
      contract,
      input.expectedGithubActionsContext,
    );
    return {
      associated: true,
      artifactAttested: false,
      blocker: "runtime_performance_and_memory_release_artifact_attestation_unverified",
      evidence: {
        validation: "associated_unattested",
        receiptContentHash: receipt.contentHash,
        reportContentHash: receipt.report.contentHash,
        reportFileContentHash: receipt.report.fileContentHash,
        reportByteLength: receipt.report.byteLength,
        productionArtifactSetHash: receipt.report.productionArtifactSetHash,
        contract: receipt.contract,
        githubActions: receipt.githubActions,
        proofScope: receipt.proofScope,
        ciAssociation: receipt.ciAssociation,
        attestation: receipt.attestation,
        claims: receipt.claims,
      },
    };
  } catch (error) {
    return {
      associated: false,
      artifactAttested: false,
      blocker: "runtime_performance_and_memory_release_attachment_invalid",
      evidence: {
        validation: "invalid",
        reason: error instanceof Error ? error.message : "unknown_error",
      },
    };
  }
}

function assessCleanCheckoutReleaseAttachment(
  input: DesignerCleanCheckoutReleaseAttachmentInputV1 | undefined,
): DesignerCleanCheckoutAttachmentAssessmentV1 {
  if (input === undefined) return {
    associated: false,
    artifactAttested: false,
    blocker: "clean_checkout_full_matrix_unverified",
    evidence: {
      validation: "unattached",
      attestation: "none",
    },
  };
  return assessDesignerCleanCheckoutReleaseAttachmentV1(
    input.reportBytes,
    dirname(repoFile("package.json")),
  );
}

function externalVerificationGate(
  exampleGalleryImplemented: boolean,
  staticOfflineAuditImplemented: boolean,
  cleanCheckoutReleaseAttachment: DesignerCleanCheckoutAttachmentAssessmentV1,
  externalKicadCliQaContractImplemented: boolean,
  externalKicadQaReleaseAttachment: ExternalKicadQaReleaseAttachmentAssessment,
  runtimePerformanceMemoryContractImplemented: boolean,
  runtimeReleaseAttachment: RuntimeReleaseAttachmentAssessment,
): DesignerReleaseGateV1 {
  return gate("release.reproducible-verification", "unverified", [
    ...(cleanCheckoutReleaseAttachment.blocker === null
      ? []
      : [cleanCheckoutReleaseAttachment.blocker]),
    "manual_accessibility_and_assistive_technology_audit_unverified",
    ...(runtimePerformanceMemoryContractImplemented
      ? [runtimeReleaseAttachment.blocker]
      : ["runtime_performance_and_memory_audit_unverified"]),
    ...(staticOfflineAuditImplemented ? [] : ["broader_static_offline_network_audit_unverified"]),
    "deployed_offline_and_network_behavior_unverified",
    ...(exampleGalleryImplemented ? [] : ["four_fixture_example_gallery_unavailable"]),
    ...(externalKicadCliQaContractImplemented
      ? [externalKicadQaReleaseAttachment.blocker]
      : ["external_kicad_cli_qa_audit_unverified"]),
    "kicad_open_without_repair_unverified",
  ], {
    adHocSelfReportedCommandResultsAreNotReleaseEvidence: true,
    cleanCheckoutFullMatrixReportAssociated: cleanCheckoutReleaseAttachment.associated,
    cleanCheckoutFullMatrixArtifactAttested: cleanCheckoutReleaseAttachment.artifactAttested,
    cleanCheckoutFullMatrixAttachment: cleanCheckoutReleaseAttachment.evidence,
    cleanCheckoutFullMatrixAttachmentClaimBoundary: "A valid strict report associates an exact clean current commit and tree, both exact lockfile byte identities, Node 22, ngspice 46, the lockfile-bound Playwright version, and zero exit codes plus output hashes for the exact command matrix. The report is self-reported with attestation none: this audit does not rerun the checkout or commands, authenticate the execution host, include ignored working data, or establish deployment, provider, simulation-fidelity, or physical-fidelity claims.",
    fourFixtureExampleGalleryImplemented: exampleGalleryImplemented,
    staticOfflineNetworkAuditImplemented: staticOfflineAuditImplemented,
    externalKicadCliQaContractImplemented,
    externalKicadCliQaReleaseReportAssociated: externalKicadQaReleaseAttachment.associated,
    externalKicadCliQaReleaseArtifactAttested: externalKicadQaReleaseAttachment.artifactAttested,
    externalKicadCliQaReleaseAttachment: externalKicadQaReleaseAttachment.evidence,
    externalKicadCliQaReleaseAttachmentClaimBoundary: "A valid strict report attachment is accepted only when its exact regenerated current Motor and Power fixture/application/candidate/circuit/result/context identities and input schematic byte lengths and SHA-256 hashes match. This does not verify reported output/PDF bytes, rerun KiCad, authenticate the host or execution context, attest the artifact, prove visual quality or interactive open/save without repair, verify footprints, admit production profiles, or establish selected-part simulation fidelity.",
    runtimePerformanceMemoryContractImplemented,
    runtimePerformanceMemoryReleaseReportAssociated: runtimeReleaseAttachment.associated,
    runtimePerformanceMemoryReleaseArtifactAttested: runtimeReleaseAttachment.artifactAttested,
    runtimePerformanceMemoryReleaseAttachment: runtimeReleaseAttachment.evidence,
    runtimeReleaseAttachmentClaimBoundary: "A valid receipt associates exact environment-bound report bytes with caller-supplied GitHub Actions context, but does not authenticate that context or prove the run occurred. The manual workflow publishes GitHub provenance for the evidence files, but this audit does not yet ingest and verify that attestation, so an associated receipt remains release-blocking. It also does not prove deployed, cross-browser, whole-process-memory, provider, or simulation-fidelity performance.",
  });
}

export function buildDesignerReleaseReadinessReportV1(
  options: DesignerReleaseReadinessOptionsV1 = {},
): DeepReadonly<DesignerReleaseReadinessReportV1> {
  const documents = getBundledDesignLibraryDocuments();
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  const loadedManifest = manifestDocument();
  const behavioralApplicationGolden = behavioralApplicationGoldenContractGate();
  const selectedPassiveApplicationGolden = selectedPassiveApplicationGoldenContractGate();
  const selectedSemiconductorRdsonProjection = selectedSemiconductorRdsonProjectionGate(release, admission);
  const selectedSemiconductorApplicationGolden = selectedSemiconductorApplicationGoldenContractGate(release, admission);
  const exampleGallery = exampleGalleryContractGate();
  const externalKicadQaReleaseAttachment = assessExternalKicadQaReleaseAttachment(
    options.externalKicadQaReleaseAttachment,
  );
  const externalKicadCliQa = externalKicadCliQaContractGate(externalKicadQaReleaseAttachment);
  const runtimePerformanceMemory = runtimePerformanceMemoryContractGate();
  const runtimeReleaseAttachment = assessRuntimeReleaseAttachment(options.runtimeReleaseAttachment);
  const cleanCheckoutReleaseAttachment = assessCleanCheckoutReleaseAttachment(
    options.cleanCheckoutReleaseAttachment,
  );
  const gates = [
    manifestGate(loadedManifest.manifest, loadedManifest.issues, admission),
    constraintDecisionSidecarV3Gate(),
    primaryPartCustomizationObservationV1Gate(),
    catalogGate(loadedManifest.manifest, release),
    productionContextGate("motor.production-context-v2", MOTOR_DESIGN_V2_PRODUCTION_STATUS),
    motorEvidenceGate(),
    productionContextGate("power.production-context-v2", POWER_DESIGN_V2_PRODUCTION_STATUS),
    powerEvidenceGate(),
    powerExternalFetReadinessContractGate(),
    sourcingContractGate(),
    sourcingRequestPacketV1Gate(),
    providerGate("sourcing.provider.digikey", DIGIKEY_PROVIDER_POLICY_V2),
    providerGate("sourcing.provider.mouser", MOUSER_PROVIDER_POLICY_V2),
    simulationContractGate(),
    behavioralApplicationGolden,
    selectedPassiveApplicationGolden,
    selectedSemiconductorRdsonProjection,
    selectedSemiconductorApplicationGolden,
    simulationCoverageGate(
      release,
      behavioralApplicationGolden.status === "pass",
      selectedPassiveApplicationGolden.status === "pass",
      selectedPassiveApplicationGolden.evidence.executionResultAttached === true,
      selectedSemiconductorRdsonProjection.status === "pass"
        && selectedSemiconductorRdsonProjection.evidence.executionResultAttached === true,
      selectedSemiconductorApplicationGolden.status === "pass"
        && selectedSemiconductorApplicationGolden.evidence.executionResultAttached === true,
    ),
    exportGate(),
    externalKicadCliQa,
    browserWorkflowGate(),
    webRegressionContractGate(),
    runtimePerformanceMemory,
    exampleGallery,
    repositorySafetyGate(),
    externalVerificationGate(
      exampleGallery.status === "pass",
      staticOfflineAuditContractImplemented(),
      cleanCheckoutReleaseAttachment,
      externalKicadCliQa.status === "pass",
      externalKicadQaReleaseAttachment,
      runtimePerformanceMemory.status === "pass",
      runtimeReleaseAttachment,
    ),
  ].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const payload: Omit<DesignerReleaseReadinessReportV1, "contentHash"> = {
    format: "schemagic-designer-release-readiness",
    schemaVersion: 1,
    target: "Designer V1",
    status: gates.every((entry) => entry.status === "pass") ? "ready" : "blocked",
    gates,
  };
  const report = { ...payload, contentHash: calculateDesignerReleaseReadinessContentHashV1(payload) };
  return deepFreeze(structuredClone(report));
}
