import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface DesignerCleanCheckoutCommandV1 {
  id: string;
  cwd: string;
  executable: string;
  args: readonly string[];
}

export interface DesignerCleanCheckoutToolV1 {
  id: string;
  executable: string;
  args: readonly string[];
  normalization: string;
}

export interface DesignerCleanCheckoutBoundariesV1 {
  executionEvidence: "self_reported_exit_codes_and_output_hashes";
  attestation: "none";
  executionHostAuthenticated: false;
  cleanCheckoutReexecutedByReleaseAudit: false;
  ignoredWorkingDataExcluded: true;
  specialIndexFlagsRejected: true;
  deploymentClaim: "none";
  providerAuthority: "none";
  simulationFidelityClaim: "none";
  physicalFidelityClaim: "none";
}

export interface DesignerCleanCheckoutContractV1 {
  format: "schemagic-designer-clean-checkout-contract";
  schemaVersion: 1;
  version: "2026-08-26.2";
  proofScope: "local_clean_checkout_exact_command_matrix_self_report";
  requirements: {
    nodeMajor: 22;
    ngspiceMajor: 46;
    maximumReportBytes: 1_048_576;
  };
  lockfilePaths: readonly ["package-lock.json", "tools/native-ngspice-reference/package-lock.json"];
  tools: readonly DesignerCleanCheckoutToolV1[];
  commands: readonly DesignerCleanCheckoutCommandV1[];
  boundaries: DesignerCleanCheckoutBoundariesV1;
  contentHash: `sha256:${string}`;
}

export interface DesignerCleanCheckoutLockfileIdentityV1 {
  path: string;
  byteLength: number;
  contentHash: `sha256:${string}`;
}

export interface DesignerCleanCheckoutToolIdentityV1 {
  id: string;
  version: string;
  versionContentHash: `sha256:${string}`;
}

export interface DesignerCleanCheckoutCommandResultV1 extends DesignerCleanCheckoutCommandV1 {
  exitCode: 0;
  stdoutContentHash: `sha256:${string}`;
  stderrContentHash: `sha256:${string}`;
}

export interface DesignerCleanCheckoutReportV1 {
  format: "schemagic-designer-clean-checkout-report";
  schemaVersion: 1;
  status: "pass";
  proofScope: "local_clean_checkout_exact_command_matrix_self_report";
  attestation: "none";
  contract: {
    version: "2026-08-26.2";
    contentHash: `sha256:${string}`;
  };
  repository: {
    sourceRevision: string;
    sourceTree: string;
    worktreeClean: true;
  };
  environment: {
    platform: string;
    architecture: string;
  };
  lockfiles: DesignerCleanCheckoutLockfileIdentityV1[];
  tools: DesignerCleanCheckoutToolIdentityV1[];
  commands: DesignerCleanCheckoutCommandResultV1[];
  boundaries: DesignerCleanCheckoutBoundariesV1;
  contentHash: `sha256:${string}`;
}

export interface DesignerCleanCheckoutRepositoryStateV1 {
  repositoryRoot: string;
  sourceRevision: string;
  sourceTree: string;
  clean: boolean;
  stable: boolean;
  worktreeChangeCount: number;
  worktreeStatusContentHash: `sha256:${string}`;
  indexSpecialFlagCount: number;
  indexFlagsContentHash: `sha256:${string}`;
  lockfiles: DesignerCleanCheckoutLockfileIdentityV1[];
  playwrightVersion: string;
}

export interface DesignerCleanCheckoutAttachmentAssessmentV1 {
  associated: boolean;
  artifactAttested: false;
  blocker: "clean_checkout_full_matrix_unverified" | null;
  evidence: Record<string, unknown>;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^[0-9a-f]{40}$/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
export const DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1 = 1_048_576;

function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Clean-checkout values must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) output[key] = canonicalValue(nested);
    }
    return output;
  }
  throw new TypeError("Clean-checkout values must be JSON-compatible");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

const CONTRACT_BOUNDARIES: DesignerCleanCheckoutBoundariesV1 = {
  executionEvidence: "self_reported_exit_codes_and_output_hashes",
  attestation: "none",
  executionHostAuthenticated: false,
  cleanCheckoutReexecutedByReleaseAudit: false,
  ignoredWorkingDataExcluded: true,
  specialIndexFlagsRejected: true,
  deploymentClaim: "none",
  providerAuthority: "none",
  simulationFidelityClaim: "none",
  physicalFidelityClaim: "none",
};

const CONTRACT_TOOLS: readonly DesignerCleanCheckoutToolV1[] = [
  { id: "git", executable: "git", args: ["--version"], normalization: "trimmed_stdout" },
  { id: "node", executable: "node", args: ["--version"], normalization: "trimmed_stdout" },
  { id: "npm", executable: "npm", args: ["--version"], normalization: "trimmed_stdout" },
  { id: "ngspice", executable: "ngspice", args: ["--version"], normalization: "first_ngspice_major_token" },
  {
    id: "playwright",
    executable: "npx",
    args: ["--no-install", "playwright", "--version"],
    normalization: "trimmed_stdout",
  },
];

const CONTRACT_COMMANDS: readonly DesignerCleanCheckoutCommandV1[] = [
  { id: "workspace-install", cwd: ".", executable: "npm", args: ["ci"] },
  { id: "workspace-tests", cwd: ".", executable: "npm", args: ["test"] },
  {
    id: "model-library-validation",
    cwd: ".",
    executable: "node",
    args: ["packages/model-library/validate-library.mjs"],
  },
  { id: "workspace-typecheck", cwd: ".", executable: "npm", args: ["run", "typecheck"] },
  { id: "workspace-build", cwd: ".", executable: "npm", args: ["run", "build"] },
  {
    id: "native-reference-install",
    cwd: ".",
    executable: "npm",
    args: ["ci", "--prefix", "tools/native-ngspice-reference"],
  },
  {
    id: "native-wasm-reference-tests",
    cwd: ".",
    executable: "npm",
    args: ["test", "--prefix", "tools/native-ngspice-reference"],
  },
  {
    id: "browser-e2e-matrix",
    cwd: ".",
    executable: "npm",
    args: ["run", "test:e2e", "--workspace=@opencircuit/web"],
  },
];

const CONTRACT_PAYLOAD: Omit<DesignerCleanCheckoutContractV1, "contentHash"> = {
  format: "schemagic-designer-clean-checkout-contract",
  schemaVersion: 1,
  version: "2026-08-26.2",
  proofScope: "local_clean_checkout_exact_command_matrix_self_report",
  requirements: {
    nodeMajor: 22,
    ngspiceMajor: 46,
    maximumReportBytes: DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1,
  },
  lockfilePaths: ["package-lock.json", "tools/native-ngspice-reference/package-lock.json"],
  tools: CONTRACT_TOOLS,
  commands: CONTRACT_COMMANDS,
  boundaries: CONTRACT_BOUNDARIES,
};

export const DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1: DesignerCleanCheckoutContractV1 = deepFreeze({
  ...CONTRACT_PAYLOAD,
  contentHash: sha256(JSON.stringify(canonicalValue(CONTRACT_PAYLOAD))),
});

function object(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${path}:invalid_object`);
  }
  return input as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${path}:invalid_keys`);
}

function literal<T extends string | number | boolean>(input: unknown, expected: T, path: string): T {
  if (input !== expected) throw new TypeError(`${path}:invalid_value`);
  return expected;
}

function boundedString(input: unknown, path: string, maximumLength: number): string {
  if (typeof input !== "string"
    || input.length === 0
    || input.length > maximumLength
    || input.trim() !== input
    || CONTROL_CHARACTER.test(input)) throw new TypeError(`${path}:invalid_string`);
  return input;
}

function positiveInteger(input: unknown, path: string): number {
  if (!Number.isSafeInteger(input) || (input as number) <= 0) throw new TypeError(`${path}:invalid_integer`);
  return input as number;
}

function hash(input: unknown, path: string): `sha256:${string}` {
  if (typeof input !== "string" || !HASH.test(input)) throw new TypeError(`${path}:invalid_hash`);
  return input as `sha256:${string}`;
}

function gitObjectId(input: unknown, path: string): string {
  const value = boundedString(input, path, 40);
  if (!GIT_OBJECT_ID.test(value)) throw new TypeError(`${path}:invalid_git_object_id`);
  return value;
}

function stringArray(input: unknown, path: string): string[] {
  if (!Array.isArray(input)) throw new TypeError(`${path}:invalid_array`);
  return input.map((entry, index) => boundedString(entry, `${path}/${index}`, 512));
}

function parseLockfiles(input: unknown): DesignerCleanCheckoutLockfileIdentityV1[] {
  if (!Array.isArray(input) || input.length !== DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.lockfilePaths.length) {
    throw new TypeError("report/lockfiles:invalid_length");
  }
  return input.map((entry, index) => {
    const value = object(entry, `report/lockfiles/${index}`);
    exactKeys(value, ["path", "byteLength", "contentHash"], `report/lockfiles/${index}`);
    return {
      path: literal(
        value.path,
        DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.lockfilePaths[index]!,
        `report/lockfiles/${index}/path`,
      ),
      byteLength: positiveInteger(value.byteLength, `report/lockfiles/${index}/byteLength`),
      contentHash: hash(value.contentHash, `report/lockfiles/${index}/contentHash`),
    };
  });
}

function parseToolVersion(id: string, input: unknown, path: string): string {
  const version = boundedString(input, path, 256);
  if (id === "git" && !version.startsWith("git version ")) throw new TypeError(`${path}:invalid_git_version`);
  if (id === "node" && !/^v22\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new TypeError(`${path}:invalid_node_version`);
  }
  if (id === "npm" && !SEMVER.test(version)) throw new TypeError(`${path}:invalid_npm_version`);
  if (id === "ngspice" && version !== "ngspice-46") throw new TypeError(`${path}:invalid_ngspice_version`);
  if (id === "playwright" && !/^Version [0-9]+\.[0-9]+\.[0-9]+$/u.test(version)) {
    throw new TypeError(`${path}:invalid_playwright_version`);
  }
  return version;
}

function parseTools(input: unknown): DesignerCleanCheckoutToolIdentityV1[] {
  if (!Array.isArray(input) || input.length !== DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.length) {
    throw new TypeError("report/tools:invalid_length");
  }
  return input.map((entry, index) => {
    const value = object(entry, `report/tools/${index}`);
    exactKeys(value, ["id", "version", "versionContentHash"], `report/tools/${index}`);
    const id = literal(
      value.id,
      DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools[index]!.id,
      `report/tools/${index}/id`,
    );
    const version = parseToolVersion(id, value.version, `report/tools/${index}/version`);
    const versionContentHash = hash(value.versionContentHash, `report/tools/${index}/versionContentHash`);
    if (versionContentHash !== sha256(version)) throw new TypeError(`report/tools/${index}:version_content_hash_mismatch`);
    return { id, version, versionContentHash };
  });
}

function parseCommands(input: unknown): DesignerCleanCheckoutCommandResultV1[] {
  if (!Array.isArray(input) || input.length !== DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.length) {
    throw new TypeError("report/commands:invalid_length");
  }
  return input.map((entry, index) => {
    const expected = DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands[index]!;
    const value = object(entry, `report/commands/${index}`);
    exactKeys(
      value,
      ["id", "cwd", "executable", "args", "exitCode", "stdoutContentHash", "stderrContentHash"],
      `report/commands/${index}`,
    );
    const args = stringArray(value.args, `report/commands/${index}/args`);
    if (!same(args, expected.args)) throw new TypeError(`report/commands/${index}/args:matrix_mismatch`);
    return {
      id: literal(value.id, expected.id, `report/commands/${index}/id`),
      cwd: literal(value.cwd, expected.cwd, `report/commands/${index}/cwd`),
      executable: literal(value.executable, expected.executable, `report/commands/${index}/executable`),
      args,
      exitCode: literal(value.exitCode, 0, `report/commands/${index}/exitCode`),
      stdoutContentHash: hash(value.stdoutContentHash, `report/commands/${index}/stdoutContentHash`),
      stderrContentHash: hash(value.stderrContentHash, `report/commands/${index}/stderrContentHash`),
    };
  });
}

export function canonicalDesignerCleanCheckoutReportPayloadV1(
  report: Omit<DesignerCleanCheckoutReportV1, "contentHash"> | DesignerCleanCheckoutReportV1,
): string {
  const { contentHash: _contentHash, ...payload } = report as DesignerCleanCheckoutReportV1;
  return JSON.stringify(canonicalValue(payload));
}

export function calculateDesignerCleanCheckoutReportContentHashV1(
  report: Omit<DesignerCleanCheckoutReportV1, "contentHash"> | DesignerCleanCheckoutReportV1,
): `sha256:${string}` {
  return sha256(canonicalDesignerCleanCheckoutReportPayloadV1(report));
}

export function parseDesignerCleanCheckoutReportV1(input: unknown): DesignerCleanCheckoutReportV1 {
  const value = object(input, "report");
  exactKeys(value, [
    "format",
    "schemaVersion",
    "status",
    "proofScope",
    "attestation",
    "contract",
    "repository",
    "environment",
    "lockfiles",
    "tools",
    "commands",
    "boundaries",
    "contentHash",
  ], "report");
  literal(value.format, "schemagic-designer-clean-checkout-report", "report/format");
  literal(value.schemaVersion, 1, "report/schemaVersion");
  literal(value.status, "pass", "report/status");
  const proofScope = literal(
    value.proofScope,
    DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.proofScope,
    "report/proofScope",
  );
  const attestation = literal(value.attestation, "none", "report/attestation");

  const contract = object(value.contract, "report/contract");
  exactKeys(contract, ["version", "contentHash"], "report/contract");
  const contractReference = {
    version: literal(contract.version, DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.version, "report/contract/version"),
    contentHash: hash(contract.contentHash, "report/contract/contentHash"),
  };
  if (contractReference.contentHash !== DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.contentHash) {
    throw new TypeError("report/contract:content_hash_mismatch");
  }

  const repository = object(value.repository, "report/repository");
  exactKeys(repository, ["sourceRevision", "sourceTree", "worktreeClean"], "report/repository");
  const repositoryIdentity = {
    sourceRevision: gitObjectId(repository.sourceRevision, "report/repository/sourceRevision"),
    sourceTree: gitObjectId(repository.sourceTree, "report/repository/sourceTree"),
    worktreeClean: literal(repository.worktreeClean, true, "report/repository/worktreeClean"),
  };

  const environment = object(value.environment, "report/environment");
  exactKeys(environment, ["platform", "architecture"], "report/environment");
  const parsedEnvironment = {
    platform: boundedString(environment.platform, "report/environment/platform", 64),
    architecture: boundedString(environment.architecture, "report/environment/architecture", 64),
  };

  const boundaries = object(value.boundaries, "report/boundaries");
  exactKeys(boundaries, Object.keys(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.boundaries), "report/boundaries");
  if (!same(boundaries, DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.boundaries)) {
    throw new TypeError("report/boundaries:contract_mismatch");
  }

  const parsed: DesignerCleanCheckoutReportV1 = {
    format: "schemagic-designer-clean-checkout-report",
    schemaVersion: 1,
    status: "pass",
    proofScope,
    attestation,
    contract: contractReference,
    repository: repositoryIdentity,
    environment: parsedEnvironment,
    lockfiles: parseLockfiles(value.lockfiles),
    tools: parseTools(value.tools),
    commands: parseCommands(value.commands),
    boundaries: structuredClone(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.boundaries),
    contentHash: hash(value.contentHash, "report/contentHash"),
  };
  if (calculateDesignerCleanCheckoutReportContentHashV1(parsed) !== parsed.contentHash) {
    throw new TypeError("report:content_hash_mismatch");
  }
  return deepFreeze(parsed);
}

function gitOutput(repositoryRoot: string, args: readonly string[], encoding: "utf8"): string;
function gitOutput(repositoryRoot: string, args: readonly string[], encoding: "buffer"): Buffer;
function gitOutput(repositoryRoot: string, args: readonly string[], encoding: "utf8" | "buffer"): string | Buffer {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    env: { ...process.env, LC_ALL: "C", LANG: "C" },
  });
}

function exactRepositoryPath(repositoryRoot: string, relativePath: string): string {
  const absolute = resolve(repositoryRoot, relativePath);
  if (absolute === repositoryRoot || !absolute.startsWith(`${repositoryRoot}${sep}`)) {
    throw new TypeError(`lockfile:${relativePath}:unsafe_path`);
  }
  return absolute;
}

function lockfileIdentity(repositoryRoot: string, relativePath: string): DesignerCleanCheckoutLockfileIdentityV1 {
  const absolute = exactRepositoryPath(repositoryRoot, relativePath);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError(`lockfile:${relativePath}:not_regular_file`);
  const bytes = readFileSync(absolute);
  if (bytes.byteLength === 0) throw new TypeError(`lockfile:${relativePath}:empty`);
  return { path: relativePath, byteLength: bytes.byteLength, contentHash: sha256(bytes) };
}

function playwrightVersion(rootLockfile: DesignerCleanCheckoutLockfileIdentityV1, repositoryRoot: string): string {
  const bytes = readFileSync(exactRepositoryPath(repositoryRoot, rootLockfile.path));
  let document: unknown;
  try {
    document = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new TypeError("lockfile:package-lock.json:invalid_json");
  }
  const root = object(document, "lockfile/package-lock.json");
  const packages = object(root.packages, "lockfile/package-lock.json/packages");
  const playwright = object(
    packages["node_modules/@playwright/test"],
    "lockfile/package-lock.json/packages/@playwright/test",
  );
  return boundedString(playwright.version, "lockfile/package-lock.json/playwright/version", 64);
}

function statusEntryCount(status: Buffer): number {
  if (status.byteLength === 0) return 0;
  return status.toString("utf8").split("\0").filter((entry) => entry.length > 0).length;
}

function specialIndexFlagCount(indexFlags: Buffer): number {
  return indexFlags.toString("utf8").split("\0").filter((entry) => (
    entry.length > 0 && !entry.startsWith("H ")
  )).length;
}

export function inspectDesignerCleanCheckoutRepositoryV1(
  repositoryRootInput: string,
): DesignerCleanCheckoutRepositoryStateV1 {
  const repositoryRoot = realpathSync(resolve(repositoryRootInput));
  const topLevel = realpathSync(resolve(
    gitOutput(repositoryRoot, ["rev-parse", "--show-toplevel"], "utf8").trim(),
  ));
  if (topLevel !== repositoryRoot) throw new TypeError("current_repository:root_mismatch");

  const statusArgs = [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
  ] as const;
  const statusBefore = gitOutput(repositoryRoot, statusArgs, "buffer");
  const indexFlagsBefore = gitOutput(repositoryRoot, ["ls-files", "-v", "-z"], "buffer");
  const sourceRevisionBefore = gitOutput(repositoryRoot, ["rev-parse", "--verify", "HEAD"], "utf8").trim();
  const sourceTreeBefore = gitOutput(repositoryRoot, ["rev-parse", "--verify", "HEAD^{tree}"], "utf8").trim();
  if (!GIT_OBJECT_ID.test(sourceRevisionBefore) || !GIT_OBJECT_ID.test(sourceTreeBefore)) {
    throw new TypeError("current_repository:git_identity_invalid");
  }
  const lockfiles = DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.lockfilePaths.map((path) => (
    lockfileIdentity(repositoryRoot, path)
  ));
  const sourceRevisionAfter = gitOutput(repositoryRoot, ["rev-parse", "--verify", "HEAD"], "utf8").trim();
  const sourceTreeAfter = gitOutput(repositoryRoot, ["rev-parse", "--verify", "HEAD^{tree}"], "utf8").trim();
  const statusAfter = gitOutput(repositoryRoot, statusArgs, "buffer");
  const indexFlagsAfter = gitOutput(repositoryRoot, ["ls-files", "-v", "-z"], "buffer");
  const stable = sourceRevisionBefore === sourceRevisionAfter
    && sourceTreeBefore === sourceTreeAfter
    && statusBefore.equals(statusAfter)
    && indexFlagsBefore.equals(indexFlagsAfter);
  const indexSpecialFlagCount = Math.max(
    specialIndexFlagCount(indexFlagsBefore),
    specialIndexFlagCount(indexFlagsAfter),
  );
  const clean = stable
    && statusBefore.byteLength === 0
    && statusAfter.byteLength === 0
    && indexSpecialFlagCount === 0;
  const combinedStatus = Buffer.concat([statusBefore, statusAfter]);
  return deepFreeze({
    repositoryRoot,
    sourceRevision: sourceRevisionBefore,
    sourceTree: sourceTreeBefore,
    clean,
    stable,
    worktreeChangeCount: Math.max(statusEntryCount(statusBefore), statusEntryCount(statusAfter)),
    worktreeStatusContentHash: sha256(combinedStatus),
    indexSpecialFlagCount,
    indexFlagsContentHash: sha256(Buffer.concat([indexFlagsBefore, indexFlagsAfter])),
    lockfiles,
    playwrightVersion: playwrightVersion(lockfiles[0]!, repositoryRoot),
  });
}

function reportBytes(input: unknown): { bytes: Uint8Array; report: DesignerCleanCheckoutReportV1 } {
  if (!(input instanceof Uint8Array)
    || input.byteLength === 0
    || input.byteLength > DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1) {
    throw new TypeError("reportBytes:invalid_bytes");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    throw new TypeError("reportBytes:invalid_utf8");
  }
  let document: unknown;
  try {
    document = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("reportBytes:invalid_json");
  }
  return { bytes: input, report: parseDesignerCleanCheckoutReportV1(document) };
}

export function assessDesignerCleanCheckoutReleaseAttachmentV1(
  input: unknown,
  repositoryRoot: string,
): DesignerCleanCheckoutAttachmentAssessmentV1 {
  let byteLength: number | null = input instanceof Uint8Array ? input.byteLength : null;
  let fileContentHash: `sha256:${string}` | null = input instanceof Uint8Array ? sha256(input) : null;
  try {
    const parsed = reportBytes(input);
    byteLength = parsed.bytes.byteLength;
    fileContentHash = sha256(parsed.bytes);
    const current = inspectDesignerCleanCheckoutRepositoryV1(repositoryRoot);
    if (!current.clean) {
      return deepFreeze({
        associated: false,
        artifactAttested: false,
        blocker: "clean_checkout_full_matrix_unverified",
        evidence: {
          validation: current.stable ? "current_repository_dirty" : "current_repository_changed_during_validation",
          reportByteLength: byteLength,
          reportFileContentHash: fileContentHash,
          reportContentHash: parsed.report.contentHash,
          currentRepositoryClean: false,
          currentRepositoryStable: current.stable,
          currentWorktreeChangeCount: current.worktreeChangeCount,
          currentWorktreeStatusContentHash: current.worktreeStatusContentHash,
          currentIndexSpecialFlagCount: current.indexSpecialFlagCount,
          currentIndexFlagsContentHash: current.indexFlagsContentHash,
          attestation: "none",
        },
      });
    }
    if (parsed.report.repository.sourceRevision !== current.sourceRevision
      || parsed.report.repository.sourceTree !== current.sourceTree) {
      throw new TypeError("report/repository:current_identity_mismatch");
    }
    if (!same(parsed.report.lockfiles, current.lockfiles)) {
      throw new TypeError("report/lockfiles:current_identity_mismatch");
    }
    const playwright = parsed.report.tools.find((tool) => tool.id === "playwright");
    if (playwright?.version !== `Version ${current.playwrightVersion}`) {
      throw new TypeError("report/tools/playwright:lockfile_version_mismatch");
    }
    return deepFreeze({
      associated: true,
      artifactAttested: false,
      blocker: null,
      evidence: {
        validation: "exact_current_clean_checkout_matrix_associated_unattested",
        reportByteLength: byteLength,
        reportFileContentHash: fileContentHash,
        reportContentHash: parsed.report.contentHash,
        contract: parsed.report.contract,
        repository: parsed.report.repository,
        environment: parsed.report.environment,
        lockfiles: parsed.report.lockfiles,
        tools: parsed.report.tools,
        commands: parsed.report.commands,
        attestation: parsed.report.attestation,
        boundaries: {
          ...parsed.report.boundaries,
          exactCurrentCommitAndTreeMatched: true,
          exactCurrentLockfilesMatched: true,
          exactCommandMatrixValidated: true,
          exactToolVersionsBound: true,
          currentRepositoryClean: true,
          currentRepositoryStable: true,
          specialIndexFlagsRejected: true,
          artifactAttested: false,
        },
      },
    });
  } catch (error) {
    return deepFreeze({
      associated: false,
      artifactAttested: false,
      blocker: "clean_checkout_full_matrix_unverified",
      evidence: {
        validation: "invalid",
        reportByteLength: byteLength,
        reportFileContentHash: fileContentHash,
        reason: error instanceof Error ? error.message : "unknown_error",
        attestation: "none",
      },
    });
  }
}
