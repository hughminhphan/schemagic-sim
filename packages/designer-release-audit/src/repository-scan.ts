import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

export interface DesignerReleaseFileInputV1 {
  path: string;
  bytes: Uint8Array;
}

export interface DesignerRepositoryScanFindingV1 {
  ruleId: string;
  path: string;
  line: number | null;
}

export interface DesignerRepositoryScanReportV1 {
  format: "schemagic-designer-repository-scan";
  schemaVersion: 1;
  scope: "git_tracked_and_unignored_untracked";
  status: "pass" | "blocked";
  candidateFileCount: number;
  scannedTextFileCount: number;
  skippedBinaryFileCount: number;
  candidateSetContentHash: `sha256:${string}`;
  findings: DesignerRepositoryScanFindingV1[];
  boundaries: {
    gitIgnoredWorkingDataExcluded: true;
    providerAuthorizationNotInferred: true;
    publicationRightsNotInferred: true;
  };
  contentHash: `sha256:${string}`;
}

const MAX_FILES = 50_000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TEXT_BYTES = 8 * 1024 * 1024;
const PROHIBITED_VENDOR_ARTIFACT_EXTENSION = /\.(?:pdf|docx?|xlsx?|pptx?|zip|7z|rar|tar|tgz|gz|bz2|xz|p12|pfx|jks|keystore|pem|key)$/iu;
const PROHIBITED_CAPTURE_DIRECTORY = /^packages\/(?:motor|power)-designer\/(?:.*\/)?(?:datasheets?|vendor[-_](?:sources?|captures?)|evidence[-_]captures?)\//iu;
const ENV_FILE = /(?:^|\/)\.env(?:\.|$)/u;
const ENV_TEMPLATE = /(?:^|\/)\.env\.(?:example|sample|template)$/u;

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function sha256(bytes: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Repository scan values must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort(compareText)) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) result[key] = canonicalValue(nested);
    }
    return result;
  }
  throw new TypeError("Repository scan values must be JSON-compatible");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

function secretPatterns(): readonly { ruleId: string; expression: RegExp }[] {
  return [
    {
      ruleId: "private_key_material",
      expression: new RegExp(["-----BEGIN", "(?:[A-Z]+ )?PRIVATE", "KEY-----"].join(" "), "gu"),
    },
    {
      ruleId: "aws_access_key",
      expression: new RegExp(["AKIA", "[0-9A-Z]{16}"].join(""), "gu"),
    },
    {
      ruleId: "github_token",
      expression: new RegExp(["(?:github_pat_|gh[pousr]_)", "[A-Za-z0-9_]{20,}"].join(""), "gu"),
    },
    {
      ruleId: "slack_token",
      expression: new RegExp(["xox[baprs]-", "[A-Za-z0-9-]{20,}"].join(""), "gu"),
    },
    {
      ruleId: "openai_style_token",
      expression: new RegExp(["sk-", "[A-Za-z0-9]{20,}"].join(""), "gu"),
    },
  ];
}

function textFindings(path: string, text: string): DesignerRepositoryScanFindingV1[] {
  const findings: DesignerRepositoryScanFindingV1[] = [];
  for (const rule of secretPatterns()) {
    for (const match of text.matchAll(rule.expression)) {
      findings.push({ ruleId: rule.ruleId, path, line: lineAt(text, match.index ?? 0) });
    }
  }
  if (!/(?:^|\/)(?:test|tests|fixtures?)\//u.test(path)) {
    const assignment = /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?key)\b\s*[:=]\s*["']([^"'\\\r\n]{16,})["']/giu;
    for (const match of text.matchAll(assignment)) {
      const value = match[1] ?? "";
      if (/must-not|placeholder|example|forbidden|disabled|pending|secret|\$\{|<[^>]+>/iu.test(value)) continue;
      findings.push({ ruleId: "credential_assignment", path, line: lineAt(text, match.index ?? 0) });
    }
  }
  return findings;
}

export function scanDesignerReleaseFileInputsV1(
  inputs: readonly DesignerReleaseFileInputV1[],
): Readonly<DesignerRepositoryScanReportV1> {
  if (inputs.length > MAX_FILES) throw new RangeError("Designer release repository scan file count exceeds its bound");
  const paths = inputs.map((input) => input.path);
  if (new Set(paths).size !== paths.length) throw new TypeError("Designer release repository scan paths must be unique");
  const sorted = [...inputs].sort((left, right) => compareText(left.path, right.path));
  const findings: DesignerRepositoryScanFindingV1[] = [];
  const identities: string[] = [];
  let scannedTextFileCount = 0;
  let skippedBinaryFileCount = 0;
  for (const input of sorted) {
    if (input.path.length === 0 || isAbsolute(input.path) || input.path.includes("\\") || input.path.split("/").includes("..")) {
      throw new TypeError("Designer release repository scan path is unsafe");
    }
    const bytes = Buffer.from(input.bytes);
    if (bytes.byteLength > MAX_FILE_BYTES) {
      findings.push({ ruleId: "file_resource_limit", path: input.path, line: null });
      identities.push(`${input.path}\0resource-limit\0`);
      continue;
    }
    identities.push(`${input.path}\0${sha256(bytes)}\0`);
    if (PROHIBITED_VENDOR_ARTIFACT_EXTENSION.test(input.path)) {
      findings.push({ ruleId: "prohibited_vendor_or_credential_artifact", path: input.path, line: null });
    }
    if (PROHIBITED_CAPTURE_DIRECTORY.test(input.path)) {
      findings.push({ ruleId: "repository_local_vendor_capture", path: input.path, line: null });
    }
    if (ENV_FILE.test(input.path) && !ENV_TEMPLATE.test(input.path)) {
      findings.push({ ruleId: "environment_secret_file", path: input.path, line: null });
    }
    if (bytes.byteLength > MAX_TEXT_BYTES || bytes.includes(0)) {
      skippedBinaryFileCount += 1;
      continue;
    }
    scannedTextFileCount += 1;
    findings.push(...textFindings(input.path, bytes.toString("utf8")));
  }
  findings.sort((left, right) => compareText(left.path, right.path)
    || (left.line ?? 0) - (right.line ?? 0)
    || compareText(left.ruleId, right.ruleId));
  const payload: Omit<DesignerRepositoryScanReportV1, "contentHash"> = {
    format: "schemagic-designer-repository-scan",
    schemaVersion: 1,
    scope: "git_tracked_and_unignored_untracked",
    status: findings.length === 0 ? "pass" : "blocked",
    candidateFileCount: sorted.length,
    scannedTextFileCount,
    skippedBinaryFileCount,
    candidateSetContentHash: sha256(identities.join("")),
    findings,
    boundaries: {
      gitIgnoredWorkingDataExcluded: true,
      providerAuthorizationNotInferred: true,
      publicationRightsNotInferred: true,
    },
  };
  const report = {
    ...payload,
    contentHash: sha256(JSON.stringify(canonicalValue(payload))),
  };
  return deepFreeze(report);
}

const repositoryScanCache = new Map<string, Readonly<DesignerRepositoryScanReportV1>>();

export function scanDesignerReleaseRepositoryV1(repositoryRoot: string): Readonly<DesignerRepositoryScanReportV1> {
  const root = resolve(repositoryRoot);
  const cached = repositoryScanCache.get(root);
  if (cached !== undefined) return cached;
  const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8").split("\0").filter((path) => path.length > 0).sort(compareText);
  const inputs: DesignerReleaseFileInputV1[] = [];
  for (const path of listed) {
    const absolute = resolve(root, path);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new TypeError("Git returned a path outside the repository");
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      inputs.push({ path, bytes: Buffer.from(readlinkSync(absolute), "utf8") });
      continue;
    }
    if (!stat.isFile()) throw new TypeError(`Release candidate path is not a file: ${path}`);
    inputs.push({ path, bytes: readFileSync(absolute) });
  }
  const report = scanDesignerReleaseFileInputsV1(inputs);
  repositoryScanCache.set(root, report);
  return report;
}
