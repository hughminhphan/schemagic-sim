import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1,
  parseDesignerCleanCheckoutReportV1,
} from "../src/clean-checkout-audit";
import { runDesignerCleanCheckoutCommandV1 } from "../src/clean-checkout-runner-command";
import {
  runDesignerCleanCheckoutMatrixV1,
  type DesignerCleanCheckoutExecutionRequestV1,
  type DesignerCleanCheckoutExecutionResultV1,
  type DesignerCleanCheckoutExecutorV1,
} from "../src/clean-checkout-runner";

const temporaryDirectories: string[] = [];

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore",
    env: { ...process.env, LC_ALL: "C", LANG: "C" },
  });
}

function cleanFixtureRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "schemagic-clean-checkout-runner-"));
  temporaryDirectories.push(root);
  mkdirSync(join(root, "tools/native-ngspice-reference"), { recursive: true });
  writeFileSync(join(root, "package-lock.json"), `${JSON.stringify({
    name: "clean-checkout-runner-fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "clean-checkout-runner-fixture" },
      "node_modules/@playwright/test": { version: "1.62.1" },
    },
  }, null, 2)}\n`);
  writeFileSync(join(root, "tools/native-ngspice-reference/package-lock.json"), `${JSON.stringify({
    name: "native-reference-fixture",
    lockfileVersion: 3,
    packages: { "": { name: "native-reference-fixture" } },
  }, null, 2)}\n`);
  writeFileSync(join(root, "README.md"), "clean checkout runner fixture\n");
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "Clean Checkout Runner Test"]);
  git(root, ["config", "user.email", "clean-checkout-runner@example.invalid"]);
  git(root, ["add", "--all"]);
  git(root, ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"]);
  return realpathSync(root);
}

interface FakeExecutorOptions {
  nodeVersion?: string;
  failedCommand?: string;
  mutateOnCommand?: string;
}

function fakeExecutor(
  repositoryRoot: string,
  options: FakeExecutorOptions = {},
): { calls: DesignerCleanCheckoutExecutionRequestV1[]; executor: DesignerCleanCheckoutExecutorV1 } {
  const calls: DesignerCleanCheckoutExecutionRequestV1[] = [];
  const executor: DesignerCleanCheckoutExecutorV1 = (request): DesignerCleanCheckoutExecutionResultV1 => {
    calls.push(structuredClone(request));
    if (request.kind === "tool") {
      if (request.id === "git") return { exitCode: 0, stdout: "git version 2.50.1\n", stderr: "" };
      if (request.id === "node") {
        return { exitCode: 0, stdout: `${options.nodeVersion ?? "v22.20.0"}\n`, stderr: "" };
      }
      if (request.id === "npm") return { exitCode: 0, stdout: "10.9.4\n", stderr: "" };
      if (request.id === "ngspice") {
        return {
          exitCode: 0,
          stdout: "Circuit simulator build information\n",
          stderr: "** ngspice-46 shared release **\n",
        };
      }
      if (request.id === "playwright") {
        return { exitCode: 0, stdout: "Version 1.62.1\n", stderr: "" };
      }
      throw new Error(`Unexpected tool: ${request.id}`);
    }
    if (request.id === options.mutateOnCommand) {
      writeFileSync(join(repositoryRoot, "unexpected-mutation.txt"), "mutation\n");
    }
    return {
      exitCode: request.id === options.failedCommand ? 1 : 0,
      stdout: `stdout:${request.id}\n`,
      stderr: `stderr:${request.id}\n`,
    };
  };
  return { calls, executor };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  }
});

describe("Designer clean-checkout matrix runner V1", () => {
  it("runs the exact ordered matrix and emits one deterministic parsed report", () => {
    const root = cleanFixtureRepository();
    const first = fakeExecutor(root);
    const firstReport = runDesignerCleanCheckoutMatrixV1(root, first.executor);
    const second = fakeExecutor(root);
    const secondReport = runDesignerCleanCheckoutMatrixV1(root, second.executor);

    expect(firstReport).toEqual(secondReport);
    expect(parseDesignerCleanCheckoutReportV1(structuredClone(firstReport))).toEqual(firstReport);
    expect(Object.isFrozen(firstReport)).toBe(true);
    expect(first.calls.map(({ kind, id }) => `${kind}:${id}`)).toEqual([
      ...DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.map((tool) => `tool:${tool.id}`),
      ...DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => `command:${command.id}`),
    ]);
    expect(first.calls.slice(0, DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.length)).toEqual(
      DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.map((tool) => ({
        kind: "tool",
        id: tool.id,
        executable: tool.executable,
        args: [...tool.args],
        cwd: root,
      })),
    );
    expect(first.calls.slice(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.length)).toEqual(
      DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => ({
        kind: "command",
        id: command.id,
        executable: command.executable,
        args: [...command.args],
        cwd: root,
      })),
    );
    expect(firstReport.tools).toEqual([
      { id: "git", version: "git version 2.50.1", versionContentHash: sha256("git version 2.50.1") },
      { id: "node", version: "v22.20.0", versionContentHash: sha256("v22.20.0") },
      { id: "npm", version: "10.9.4", versionContentHash: sha256("10.9.4") },
      { id: "ngspice", version: "ngspice-46", versionContentHash: sha256("ngspice-46") },
      { id: "playwright", version: "Version 1.62.1", versionContentHash: sha256("Version 1.62.1") },
    ]);
    expect(firstReport.commands).toEqual(
      DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => ({
        ...structuredClone(command),
        exitCode: 0,
        stdoutContentHash: sha256(`stdout:${command.id}\n`),
        stderrContentHash: sha256(`stderr:${command.id}\n`),
      })),
    );
  }, 15_000);

  it("fails preflight before the matrix unless the strict parser accepts Node 22", () => {
    const root = cleanFixtureRepository();
    const fake = fakeExecutor(root, { nodeVersion: "v26.0.0" });

    expect(() => runDesignerCleanCheckoutMatrixV1(root, fake.executor)).toThrow(
      "report/tools/1/version:invalid_node_version",
    );
    expect(fake.calls).toHaveLength(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.length);
    expect(fake.calls.every((call) => call.kind === "tool")).toBe(true);
  });

  it("rejects a dirty initial checkout without executing any process", () => {
    const root = cleanFixtureRepository();
    writeFileSync(join(root, "already-dirty.txt"), "dirty\n");
    const fake = fakeExecutor(root);

    expect(() => runDesignerCleanCheckoutMatrixV1(root, fake.executor)).toThrow(
      "repository:initial_state_dirty",
    );
    expect(fake.calls).toEqual([]);
  });

  it("rejects a nonzero result and never executes later matrix commands", () => {
    const root = cleanFixtureRepository();
    const fake = fakeExecutor(root, { failedCommand: "workspace-tests" });

    expect(() => runDesignerCleanCheckoutMatrixV1(root, fake.executor)).toThrow(
      "command:workspace-tests:nonzero_exit:1",
    );
    expect(fake.calls.filter((call) => call.kind === "command").map((call) => call.id)).toEqual([
      "workspace-install",
      "workspace-tests",
    ]);
  });

  it("rejects checkout mutation at the final repository boundary", () => {
    const root = cleanFixtureRepository();
    const fake = fakeExecutor(root, { mutateOnCommand: "workspace-install" });

    expect(() => runDesignerCleanCheckoutMatrixV1(root, fake.executor)).toThrow(
      "repository:final:state_dirty",
    );
    expect(fake.calls.filter((call) => call.kind === "command")).toHaveLength(
      DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.length,
    );
  });

  it("requires an external absent output and creates it exclusively only after success", () => {
    const root = cleanFixtureRepository();
    const outputDirectory = mkdtempSync(join(tmpdir(), "schemagic-clean-checkout-output-"));
    temporaryDirectories.push(outputDirectory);
    const outputPath = join(realpathSync(outputDirectory), "report.json");
    const first = fakeExecutor(root);

    const result = runDesignerCleanCheckoutCommandV1(
      ["--output", outputPath],
      root,
      root,
      first.executor,
    );
    const persisted = parseDesignerCleanCheckoutReportV1(
      JSON.parse(readFileSync(outputPath, "utf8")) as unknown,
    );
    expect(result.outputPath).toBe(outputPath);
    expect(persisted).toEqual(result.report);
    expect(statSync(outputPath).mode & 0o777).toBe(0o600);

    const existing = fakeExecutor(root);
    expect(() => runDesignerCleanCheckoutCommandV1(
      ["--output", outputPath],
      root,
      root,
      existing.executor,
    )).toThrow("--output:already_exists");
    expect(existing.calls).toEqual([]);

    const inside = fakeExecutor(root);
    expect(() => runDesignerCleanCheckoutCommandV1(
      ["--output", "inside-repository.json"],
      root,
      root,
      inside.executor,
    )).toThrow("--output:must_be_outside_repository");
    expect(inside.calls).toEqual([]);

    const missing = fakeExecutor(root);
    expect(() => runDesignerCleanCheckoutCommandV1([], root, root, missing.executor)).toThrow(
      "usage:clean-checkout-runner --output <external-report-path>",
    );
    expect(missing.calls).toEqual([]);
  });
});
