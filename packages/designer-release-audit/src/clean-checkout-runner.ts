import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import {
  DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1,
  calculateDesignerCleanCheckoutReportContentHashV1,
  inspectDesignerCleanCheckoutRepositoryV1,
  parseDesignerCleanCheckoutReportV1,
  type DesignerCleanCheckoutCommandResultV1,
  type DesignerCleanCheckoutReportV1,
  type DesignerCleanCheckoutRepositoryStateV1,
  type DesignerCleanCheckoutToolIdentityV1,
} from "./clean-checkout-audit";

const MAX_EXECUTION_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface DesignerCleanCheckoutExecutionRequestV1 {
  kind: "tool" | "command";
  id: string;
  executable: string;
  args: readonly string[];
  cwd: string;
}

export interface DesignerCleanCheckoutExecutionResultV1 {
  exitCode: number | null;
  stdout: Uint8Array | string;
  stderr: Uint8Array | string;
}

export type DesignerCleanCheckoutExecutorV1 = (
  request: Readonly<DesignerCleanCheckoutExecutionRequestV1>,
) => DesignerCleanCheckoutExecutionResultV1;

function sha256(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function outputBytes(input: unknown, path: string): Uint8Array {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? new Uint8Array(input)
      : null;
  if (bytes === null || bytes.byteLength > MAX_EXECUTION_OUTPUT_BYTES) {
    throw new TypeError(`${path}:invalid_or_oversize_output`);
  }
  return bytes;
}

function outputText(bytes: Uint8Array, path: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`${path}:invalid_utf8`);
  }
}

function normalizeToolVersion(
  normalization: string,
  stdout: Uint8Array,
  stderr: Uint8Array,
  id: string,
): string {
  if (normalization === "trimmed_stdout") {
    return outputText(stdout, `tool:${id}:stdout`).trim();
  }
  if (normalization === "first_ngspice_major_token") {
    const combined = `${outputText(stdout, `tool:${id}:stdout`)}\n${outputText(
      stderr,
      `tool:${id}:stderr`,
    )}`;
    const match = /(?:^|[^0-9A-Za-z_])(ngspice-[0-9]+)(?=$|[^0-9A-Za-z_])/u.exec(combined);
    if (match?.[1] === undefined) throw new TypeError(`tool:${id}:version_token_unavailable`);
    return match[1];
  }
  throw new TypeError(`tool:${id}:unsupported_normalization`);
}

function executionCwd(repositoryRoot: string, relativePath: string): string {
  const absolute = resolve(repositoryRoot, relativePath);
  if (absolute !== repositoryRoot && !absolute.startsWith(`${repositoryRoot}${sep}`)) {
    throw new TypeError(`execution_cwd:${relativePath}:unsafe_path`);
  }
  return absolute;
}

function executeWithSpawnSync(
  request: Readonly<DesignerCleanCheckoutExecutionRequestV1>,
): DesignerCleanCheckoutExecutionResultV1 {
  const result = spawnSync(request.executable, [...request.args], {
    cwd: request.cwd,
    encoding: null,
    env: { ...process.env, LC_ALL: "C", LANG: "C" },
    maxBuffer: MAX_EXECUTION_OUTPUT_BYTES,
    shell: false,
  });
  if (result.error !== undefined) {
    throw new Error(`${request.kind}:${request.id}:execution_failed`, { cause: result.error });
  }
  if (result.signal !== null) throw new Error(`${request.kind}:${request.id}:terminated:${result.signal}`);
  return {
    exitCode: result.status,
    stdout: result.stdout ?? new Uint8Array(),
    stderr: result.stderr ?? new Uint8Array(),
  };
}

function sameLockfiles(
  left: DesignerCleanCheckoutRepositoryStateV1["lockfiles"],
  right: DesignerCleanCheckoutRepositoryStateV1["lockfiles"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertInitialRepositoryState(state: DesignerCleanCheckoutRepositoryStateV1): void {
  if (!state.stable) throw new TypeError("repository:initial_state_unstable");
  if (!state.clean) throw new TypeError("repository:initial_state_dirty");
}

function assertRepositoryUnchanged(
  initial: DesignerCleanCheckoutRepositoryStateV1,
  current: DesignerCleanCheckoutRepositoryStateV1,
  stage: string,
): void {
  if (!current.stable) throw new TypeError(`repository:${stage}:state_unstable`);
  if (!current.clean) throw new TypeError(`repository:${stage}:state_dirty`);
  if (current.repositoryRoot !== initial.repositoryRoot
    || current.sourceRevision !== initial.sourceRevision
    || current.sourceTree !== initial.sourceTree
    || current.playwrightVersion !== initial.playwrightVersion
    || current.worktreeChangeCount !== initial.worktreeChangeCount
    || current.worktreeStatusContentHash !== initial.worktreeStatusContentHash
    || current.indexSpecialFlagCount !== initial.indexSpecialFlagCount
    || current.indexFlagsContentHash !== initial.indexFlagsContentHash
    || !sameLockfiles(current.lockfiles, initial.lockfiles)) {
    throw new TypeError(`repository:${stage}:identity_changed`);
  }
}

function executeProcess(
  request: Readonly<DesignerCleanCheckoutExecutionRequestV1>,
  executor: DesignerCleanCheckoutExecutorV1,
): DesignerCleanCheckoutExecutionResultV1 {
  try {
    return executor(request);
  } catch (error) {
    throw new Error(`${request.kind}:${request.id}:execution_failed`, { cause: error });
  }
}

function reportFromResults(
  state: DesignerCleanCheckoutRepositoryStateV1,
  tools: DesignerCleanCheckoutToolIdentityV1[],
  commands: DesignerCleanCheckoutCommandResultV1[],
): DesignerCleanCheckoutReportV1 {
  const payload: Omit<DesignerCleanCheckoutReportV1, "contentHash"> = {
    format: "schemagic-designer-clean-checkout-report",
    schemaVersion: 1,
    status: "pass",
    proofScope: DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.proofScope,
    attestation: "none",
    contract: {
      version: DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.version,
      contentHash: DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.contentHash,
    },
    repository: {
      sourceRevision: state.sourceRevision,
      sourceTree: state.sourceTree,
      worktreeClean: true,
    },
    environment: { platform: process.platform, architecture: process.arch },
    lockfiles: structuredClone(state.lockfiles),
    tools: structuredClone(tools),
    commands: structuredClone(commands),
    boundaries: structuredClone(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.boundaries),
  };
  return parseDesignerCleanCheckoutReportV1({
    ...payload,
    contentHash: calculateDesignerCleanCheckoutReportContentHashV1(payload),
  });
}

function validateToolPreflight(
  state: DesignerCleanCheckoutRepositoryStateV1,
  tools: DesignerCleanCheckoutToolIdentityV1[],
): void {
  const emptyHash = sha256(new Uint8Array());
  const placeholderCommands: DesignerCleanCheckoutCommandResultV1[] = (
    DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => ({
      ...structuredClone(command),
      exitCode: 0,
      stdoutContentHash: emptyHash,
      stderrContentHash: emptyHash,
    }))
  );
  const parsed = reportFromResults(state, tools, placeholderCommands);
  const playwright = parsed.tools.find((tool) => tool.id === "playwright");
  if (playwright?.version !== `Version ${state.playwrightVersion}`) {
    throw new TypeError("tool:playwright:lockfile_version_mismatch");
  }
}

/**
 * Executes the exact V1 clean-checkout command matrix synchronously.
 *
 * The returned report is self-reported and unattested. It proves only that this
 * runner observed zero exits and bound the raw output hashes while the checkout
 * remained clean and identity-stable before execution, after tool preflight,
 * and after the command matrix.
 */
export function runDesignerCleanCheckoutMatrixV1(
  repositoryRoot: string,
  executor: DesignerCleanCheckoutExecutorV1 = executeWithSpawnSync,
): DesignerCleanCheckoutReportV1 {
  const initial = inspectDesignerCleanCheckoutRepositoryV1(repositoryRoot);
  assertInitialRepositoryState(initial);

  const tools: DesignerCleanCheckoutToolIdentityV1[] = [];
  try {
    for (const tool of DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools) {
      const request: DesignerCleanCheckoutExecutionRequestV1 = {
        kind: "tool",
        id: tool.id,
        executable: tool.executable,
        args: tool.args,
        cwd: initial.repositoryRoot,
      };
      const result = executeProcess(request, executor);
      if (result.exitCode !== 0) throw new TypeError(`tool:${tool.id}:nonzero_exit:${String(result.exitCode)}`);
      const stdout = outputBytes(result.stdout, `tool:${tool.id}:stdout`);
      const stderr = outputBytes(result.stderr, `tool:${tool.id}:stderr`);
      const version = normalizeToolVersion(tool.normalization, stdout, stderr, tool.id);
      tools.push({ id: tool.id, version, versionContentHash: sha256(version) });
    }
  } catch (error) {
    const current = inspectDesignerCleanCheckoutRepositoryV1(initial.repositoryRoot);
    assertRepositoryUnchanged(initial, current, "tool_probe_failure");
    throw error;
  }
  const afterTools = inspectDesignerCleanCheckoutRepositoryV1(initial.repositoryRoot);
  assertRepositoryUnchanged(initial, afterTools, "after_tool_probes");

  // The existing strict report parser enforces Node 22, ngspice 46, all other
  // tool schemas, and the exact contract reference before expensive commands run.
  validateToolPreflight(initial, tools);

  const commands: DesignerCleanCheckoutCommandResultV1[] = [];
  try {
    for (const command of DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands) {
      const request: DesignerCleanCheckoutExecutionRequestV1 = {
        kind: "command",
        id: command.id,
        executable: command.executable,
        args: command.args,
        cwd: executionCwd(initial.repositoryRoot, command.cwd),
      };
      const result = executeProcess(request, executor);
      if (result.exitCode !== 0) {
        throw new TypeError(`command:${command.id}:nonzero_exit:${String(result.exitCode)}`);
      }
      const stdout = outputBytes(result.stdout, `command:${command.id}:stdout`);
      const stderr = outputBytes(result.stderr, `command:${command.id}:stderr`);
      commands.push({
        ...structuredClone(command),
        exitCode: 0,
        stdoutContentHash: sha256(stdout),
        stderrContentHash: sha256(stderr),
      });
    }
  } catch (error) {
    const current = inspectDesignerCleanCheckoutRepositoryV1(initial.repositoryRoot);
    assertRepositoryUnchanged(initial, current, "command_failure");
    throw error;
  }

  const final = inspectDesignerCleanCheckoutRepositoryV1(initial.repositoryRoot);
  assertRepositoryUnchanged(initial, final, "final");
  return reportFromResults(initial, tools, commands);
}
