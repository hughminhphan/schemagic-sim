import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1,
  DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1,
  assessDesignerCleanCheckoutReleaseAttachmentV1,
  calculateDesignerCleanCheckoutReportContentHashV1,
  inspectDesignerCleanCheckoutRepositoryV1,
  parseDesignerCleanCheckoutReportV1,
  type DesignerCleanCheckoutReportV1,
  type DesignerCleanCheckoutRepositoryStateV1,
} from "../src/clean-checkout-audit";
import { buildDesignerReleaseReadinessReportV1 } from "../src/index";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const releaseAuditCli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const viteNodeCli = fileURLToPath(new URL("../../../node_modules/vite-node/vite-node.mjs", import.meta.url));
const temporaryDirectories: string[] = [];
const encoder = new TextEncoder();

function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function testOnlyReportFixture(
  state: DesignerCleanCheckoutRepositoryStateV1,
): DesignerCleanCheckoutReportV1 {
  const versions: Record<string, string> = {
    git: "git version 2.50.1",
    node: "v22.20.0",
    npm: "10.9.4",
    ngspice: "ngspice-46",
    playwright: `Version ${state.playwrightVersion}`,
  };
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
    environment: { platform: "test-platform", architecture: "test-architecture" },
    lockfiles: structuredClone(state.lockfiles),
    tools: DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.map((tool) => {
      const version = versions[tool.id];
      if (version === undefined) throw new Error(`Missing test tool version: ${tool.id}`);
      return { id: tool.id, version, versionContentHash: sha256(version) };
    }),
    commands: DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => ({
      ...structuredClone(command),
      exitCode: 0,
      stdoutContentHash: sha256(""),
      stderrContentHash: sha256(""),
    })),
    boundaries: structuredClone(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.boundaries),
  };
  return {
    ...payload,
    contentHash: calculateDesignerCleanCheckoutReportContentHashV1(payload),
  };
}

function rehash(report: DesignerCleanCheckoutReportV1): DesignerCleanCheckoutReportV1 {
  report.contentHash = calculateDesignerCleanCheckoutReportContentHashV1(report);
  return report;
}

function bytes(report: DesignerCleanCheckoutReportV1): Uint8Array {
  return encoder.encode(`${JSON.stringify(report, null, 2)}\n`);
}

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore",
    env: { ...process.env, LC_ALL: "C", LANG: "C" },
  });
}

function cleanFixtureRepository(): DesignerCleanCheckoutRepositoryStateV1 {
  const root = mkdtempSync(join(tmpdir(), "schemagic-clean-checkout-audit-"));
  temporaryDirectories.push(root);
  mkdirSync(join(root, "tools/native-ngspice-reference"), { recursive: true });
  writeFileSync(join(root, "package-lock.json"), `${JSON.stringify({
    name: "clean-checkout-fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "clean-checkout-fixture" },
      "node_modules/@playwright/test": { version: "1.62.1" },
    },
  }, null, 2)}\n`);
  writeFileSync(join(root, "tools/native-ngspice-reference/package-lock.json"), `${JSON.stringify({
    name: "native-reference-fixture",
    lockfileVersion: 3,
    packages: { "": { name: "native-reference-fixture" } },
  }, null, 2)}\n`);
  writeFileSync(join(root, "README.md"), "clean checkout fixture\n");
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "Clean Checkout Test"]);
  git(root, ["config", "user.email", "clean-checkout-test@example.invalid"]);
  git(root, ["add", "--all"]);
  git(root, ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"]);
  return inspectDesignerCleanCheckoutRepositoryV1(root);
}

function releaseGate(report: ReturnType<typeof buildDesignerReleaseReadinessReportV1>) {
  const gate = report.gates.find((entry) => entry.id === "release.reproducible-verification");
  if (gate === undefined) throw new Error("Release reproducibility gate is unavailable");
  return gate;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  }
});

describe("Designer clean-checkout release attachment V1", () => {
  it("pins a unique exact matrix and explicitly unattested proof boundary", () => {
    expect(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1).toMatchObject({
      format: "schemagic-designer-clean-checkout-contract",
      schemaVersion: 1,
      version: "2026-08-26.2",
      proofScope: "local_clean_checkout_exact_command_matrix_self_report",
      requirements: {
        nodeMajor: 22,
        ngspiceMajor: 46,
        maximumReportBytes: 1_048_576,
      },
      lockfilePaths: [
        "package-lock.json",
        "tools/native-ngspice-reference/package-lock.json",
      ],
      boundaries: {
        attestation: "none",
        executionHostAuthenticated: false,
        cleanCheckoutReexecutedByReleaseAudit: false,
        ignoredWorkingDataExcluded: true,
        specialIndexFlagsRejected: true,
        deploymentClaim: "none",
        providerAuthority: "none",
        simulationFidelityClaim: "none",
        physicalFidelityClaim: "none",
      },
    });
    expect(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.map((tool) => tool.id)).toEqual([
      "git",
      "node",
      "npm",
      "ngspice",
      "playwright",
    ]);
    expect(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => command.id)).toEqual([
      "workspace-install",
      "workspace-tests",
      "model-library-validation",
      "workspace-typecheck",
      "workspace-build",
      "native-reference-install",
      "native-wasm-reference-tests",
      "browser-e2e-matrix",
    ]);
    expect(new Set(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.tools.map((tool) => tool.id)).size).toBe(5);
    expect(new Set(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.commands.map((command) => command.id)).size).toBe(8);
    expect(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1.contentHash).toBe(
      "sha256:a8c77801ae45f0e559b319a26d1d49a9d59415b00985e6bd1109d471166c7960",
    );
    expect(Object.isFrozen(DESIGNER_CLEAN_CHECKOUT_CONTRACT_V1)).toBe(true);
  });

  it("parses, self-hashes, and associates an exact clean current repository without attestation", () => {
    const state = cleanFixtureRepository();
    const report = testOnlyReportFixture(state);
    const parsed = parseDesignerCleanCheckoutReportV1(JSON.parse(new TextDecoder().decode(bytes(report))));
    const assessment = assessDesignerCleanCheckoutReleaseAttachmentV1(bytes(report), state.repositoryRoot);

    expect(parsed).toEqual(report);
    expect(parsed.contentHash).toBe(calculateDesignerCleanCheckoutReportContentHashV1(parsed));
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(assessment).toMatchObject({
      associated: true,
      artifactAttested: false,
      blocker: null,
      evidence: {
        validation: "exact_current_clean_checkout_matrix_associated_unattested",
        attestation: "none",
        repository: {
          sourceRevision: state.sourceRevision,
          sourceTree: state.sourceTree,
          worktreeClean: true,
        },
        boundaries: {
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
  });

  it("rejects a dirty current tree and preserves the exact release blocker", () => {
    const state = cleanFixtureRepository();
    const report = testOnlyReportFixture(state);
    writeFileSync(join(state.repositoryRoot, "untracked-after-report.txt"), "dirty\n");

    expect(assessDesignerCleanCheckoutReleaseAttachmentV1(bytes(report), state.repositoryRoot)).toMatchObject({
      associated: false,
      artifactAttested: false,
      blocker: "clean_checkout_full_matrix_unverified",
      evidence: {
        validation: "current_repository_dirty",
        currentRepositoryClean: false,
        currentRepositoryStable: true,
        attestation: "none",
      },
    });
  });

  it.each([
    ["assume-unchanged", "--assume-unchanged"],
    ["skip-worktree", "--skip-worktree"],
  ])("rejects tracked byte drift hidden by %s", (_label, flag) => {
    const state = cleanFixtureRepository();
    const report = testOnlyReportFixture(state);
    git(state.repositoryRoot, ["update-index", flag, "README.md"]);
    writeFileSync(join(state.repositoryRoot, "README.md"), "hidden tracked byte drift\n");
    const status = execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: state.repositoryRoot,
      encoding: "utf8",
    });
    expect(status).toBe("");

    expect(assessDesignerCleanCheckoutReleaseAttachmentV1(bytes(report), state.repositoryRoot)).toMatchObject({
      associated: false,
      artifactAttested: false,
      blocker: "clean_checkout_full_matrix_unverified",
      evidence: {
        validation: "current_repository_dirty",
        currentRepositoryClean: false,
        currentIndexSpecialFlagCount: 1,
        attestation: "none",
      },
    });
  });

  it("fails closed on commit, tree, lockfile, tool, command, boundary, and schema drift", () => {
    const state = cleanFixtureRepository();
    const exact = testOnlyReportFixture(state);
    const variants: DesignerCleanCheckoutReportV1[] = [];

    const revision = structuredClone(exact);
    revision.repository.sourceRevision = "a".repeat(40);
    variants.push(rehash(revision));

    const tree = structuredClone(exact);
    tree.repository.sourceTree = "b".repeat(40);
    variants.push(rehash(tree));

    const lockfile = structuredClone(exact);
    lockfile.lockfiles[0]!.contentHash = `sha256:${"c".repeat(64)}`;
    variants.push(rehash(lockfile));

    const playwright = structuredClone(exact);
    playwright.tools.find((tool) => tool.id === "playwright")!.version = "Version 1.62.2";
    playwright.tools.find((tool) => tool.id === "playwright")!.versionContentHash = sha256("Version 1.62.2");
    variants.push(rehash(playwright));

    const node = structuredClone(exact);
    node.tools.find((tool) => tool.id === "node")!.version = "v23.1.0";
    node.tools.find((tool) => tool.id === "node")!.versionContentHash = sha256("v23.1.0");
    variants.push(rehash(node));

    const command = structuredClone(exact);
    command.commands[0]!.args = ["install"];
    variants.push(rehash(command));

    const failedCommand = structuredClone(exact) as unknown as Record<string, unknown>;
    const failedCommands = failedCommand.commands as Array<Record<string, unknown>>;
    failedCommands[1]!.exitCode = 1;
    variants.push(rehash(failedCommand as unknown as DesignerCleanCheckoutReportV1));

    const boundary = structuredClone(exact) as unknown as Record<string, unknown>;
    (boundary.boundaries as Record<string, unknown>).attestation = "github";
    variants.push(rehash(boundary as unknown as DesignerCleanCheckoutReportV1));

    const extra = structuredClone(exact) as unknown as Record<string, unknown>;
    extra.unexpected = true;
    variants.push(rehash(extra as unknown as DesignerCleanCheckoutReportV1));

    for (const report of variants) {
      const assessment = assessDesignerCleanCheckoutReleaseAttachmentV1(bytes(report), state.repositoryRoot);
      expect(assessment.associated).toBe(false);
      expect(assessment.artifactAttested).toBe(false);
      expect(assessment.blocker).toBe("clean_checkout_full_matrix_unverified");
      expect(assessment.evidence.validation).toBe("invalid");
    }
  });

  it("rejects invalid bytes and a forged canonical content hash", () => {
    const state = cleanFixtureRepository();
    const forged = testOnlyReportFixture(state);
    forged.contentHash = `sha256:${"f".repeat(64)}`;

    for (const reportBytes of [
      new Uint8Array(),
      new Uint8Array(DESIGNER_CLEAN_CHECKOUT_MAX_REPORT_BYTES_V1 + 1),
      new Uint8Array([0xff]),
      encoder.encode("{}"),
      bytes(forged),
    ]) {
      expect(assessDesignerCleanCheckoutReleaseAttachmentV1(reportBytes, state.repositoryRoot)).toMatchObject({
        associated: false,
        artifactAttested: false,
        blocker: "clean_checkout_full_matrix_unverified",
        evidence: { validation: "invalid", attestation: "none" },
      });
    }
  });

  it("keeps the release blocker on the shared dirty tree and accepts the CLI attachment flag", () => {
    const state = inspectDesignerCleanCheckoutRepositoryV1(repositoryRoot);
    const reportBytes = bytes(testOnlyReportFixture(state));
    const direct = buildDesignerReleaseReadinessReportV1({
      cleanCheckoutReleaseAttachment: { reportBytes },
    });
    const directGate = releaseGate(direct);
    expect(directGate.evidence).toMatchObject({
      cleanCheckoutFullMatrixReportAssociated: state.clean,
      cleanCheckoutFullMatrixArtifactAttested: false,
    });
    expect(directGate.blockers.includes("clean_checkout_full_matrix_unverified")).toBe(!state.clean);

    const directory = mkdtempSync(join(tmpdir(), "schemagic-clean-checkout-cli-"));
    temporaryDirectories.push(directory);
    const reportPath = join(directory, "clean-checkout-report.json");
    const outputPath = join(directory, "release-report.json");
    writeFileSync(reportPath, reportBytes);
    const result = spawnSync(process.execPath, [
      viteNodeCli,
      releaseAuditCli,
      "--clean-checkout-report",
      reportPath,
      "--output",
      outputPath,
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const cli = JSON.parse(readFileSync(outputPath, "utf8")) as ReturnType<
      typeof buildDesignerReleaseReadinessReportV1
    >;
    expect(releaseGate(cli).blockers.includes("clean_checkout_full_matrix_unverified")).toBe(!state.clean);
  }, 60_000);
});
