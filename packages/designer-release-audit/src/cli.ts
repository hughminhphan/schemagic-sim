import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildDesignerReleaseReadinessReportV1,
  type DesignerReleaseReadinessOptionsV1,
} from "./index";
import type { DesignerRuntimeReleaseContextV1 } from "./designer-runtime-release-receipt";
import { DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1 } from "./clean-checkout-audit";

interface CliArguments {
  assertReady: boolean;
  runtimeReportPath?: string;
  runtimeReceiptPath?: string;
  cleanCheckoutReportPath?: string;
  externalKicadReportPath?: string;
  githubContextFromEnv: boolean;
  outputPath?: string;
}

function parseArguments(argv: readonly string[]): CliArguments {
  const parsed: CliArguments = { assertReady: false, githubContextFromEnv: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--assert-ready") parsed.assertReady = true;
    else if (argument === "--github-context-from-env") parsed.githubContextFromEnv = true;
    else if ([
      "--runtime-report",
      "--runtime-receipt",
      "--clean-checkout-report",
      "--external-kicad-report",
      "--output",
    ].includes(argument)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new TypeError(`${argument}:missing_value`);
      index += 1;
      if (argument === "--runtime-report") parsed.runtimeReportPath = value;
      else if (argument === "--runtime-receipt") parsed.runtimeReceiptPath = value;
      else if (argument === "--clean-checkout-report") parsed.cleanCheckoutReportPath = value;
      else if (argument === "--external-kicad-report") parsed.externalKicadReportPath = value;
      else parsed.outputPath = value;
    } else throw new TypeError(`unknown_argument:${argument}`);
  }
  const attachmentArguments = [
    parsed.runtimeReportPath !== undefined,
    parsed.runtimeReceiptPath !== undefined,
    parsed.githubContextFromEnv,
  ];
  if (attachmentArguments.some(Boolean) && !attachmentArguments.every(Boolean)) {
    throw new TypeError("runtime_release_attachment:report_receipt_and_github_context_are_required_together");
  }
  return parsed;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`environment:${name}:missing_or_invalid`);
  }
  return value;
}

function githubContextFromEnvironment(): DesignerRuntimeReleaseContextV1 {
  const runAttemptText = requiredEnvironment("GITHUB_RUN_ATTEMPT");
  const runAttempt = Number(runAttemptText);
  if (!Number.isSafeInteger(runAttempt) || runAttempt <= 0 || String(runAttempt) !== runAttemptText) {
    throw new TypeError("environment:GITHUB_RUN_ATTEMPT:invalid_positive_integer");
  }
  return {
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    sourceRevision: requiredEnvironment("GITHUB_SHA"),
    workflowRevision: requiredEnvironment("GITHUB_WORKFLOW_SHA"),
    workflowRef: requiredEnvironment("GITHUB_WORKFLOW_REF"),
    event: requiredEnvironment("GITHUB_EVENT_NAME") as "workflow_dispatch",
    job: requiredEnvironment("GITHUB_JOB"),
    runId: requiredEnvironment("GITHUB_RUN_ID"),
    runAttempt,
    artifactName: requiredEnvironment("DESIGNER_RUNTIME_ARTIFACT_NAME"),
  };
}

function cleanCheckoutReportBytes(path: string): Uint8Array {
  const stat = lstatSync(path);
  if (!stat.isFile()
    || stat.isSymbolicLink()
    || stat.size <= 0
    || stat.size > DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1) {
    throw new TypeError("clean_checkout_release_attachment:invalid_file");
  }
  const bytes = readFileSync(path);
  if (bytes.byteLength !== stat.size
    || bytes.byteLength > DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1) {
    throw new TypeError("clean_checkout_release_attachment:file_changed_during_read");
  }
  return bytes;
}

function optionsFromArguments(arguments_: CliArguments): DesignerReleaseReadinessOptionsV1 {
  const options: DesignerReleaseReadinessOptionsV1 = {};
  if (arguments_.runtimeReportPath !== undefined && arguments_.runtimeReceiptPath !== undefined) {
    const reportBytes = readFileSync(arguments_.runtimeReportPath);
    const receipt = JSON.parse(readFileSync(arguments_.runtimeReceiptPath, "utf8")) as unknown;
    options.runtimeReleaseAttachment = {
      reportBytes,
      receipt,
      expectedGithubActionsContext: githubContextFromEnvironment(),
    };
  }
  if (arguments_.externalKicadReportPath !== undefined) {
    options.externalKicadQaReleaseAttachment = {
      reportBytes: readFileSync(arguments_.externalKicadReportPath),
    };
  }
  if (arguments_.cleanCheckoutReportPath !== undefined) {
    options.cleanCheckoutReleaseAttachment = {
      reportBytes: cleanCheckoutReportBytes(arguments_.cleanCheckoutReportPath),
    };
  }
  return options;
}

const arguments_ = parseArguments(process.argv.slice(2));
const report = buildDesignerReleaseReadinessReportV1(optionsFromArguments(arguments_));
const output = `${JSON.stringify(report, null, 2)}\n`;
if (arguments_.outputPath === undefined) process.stdout.write(output);
else {
  mkdirSync(dirname(arguments_.outputPath), { recursive: true });
  writeFileSync(arguments_.outputPath, output, "utf8");
  process.stdout.write(`Designer release readiness report ${report.contentHash} written to ${arguments_.outputPath}\n`);
}
if (arguments_.assertReady && report.status !== "ready") process.exitCode = 1;
