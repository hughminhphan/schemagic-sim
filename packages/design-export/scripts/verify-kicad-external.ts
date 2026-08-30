import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ExternalKicadQaErrorV1,
  planExternalKicadQaV1,
  runExternalKicadQaV1,
  serializeExternalKicadQaReportV1,
  type ExternalKicadQaCommandRunnerV1,
} from "../src/external-kicad-qa";
import { buildExternalKicadQaArtifactsV1 } from "../src/external-kicad-fixtures";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = mkdtempSync(join(tmpdir(), "schemagic-external-kicad-qa-"));
const executable = process.env.KICAD_CLI?.trim() || "kicad-cli";
const artifacts = buildExternalKicadQaArtifactsV1();
const plan = planExternalKicadQaV1({ executable, outputDirectory });

const runCommand: ExternalKicadQaCommandRunnerV1 = ({ executable: commandExecutable, args }) => {
  const result = spawnSync(commandExecutable, args, {
    cwd: outputDirectory,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, LC_ALL: "C", LANG: "C" },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error === undefined ? {} : { errorCode: (result.error as NodeJS.ErrnoException).code ?? "spawn_error" }),
  };
};

try {
  const report = runExternalKicadQaV1(plan, artifacts, runCommand, {
    writeInput: (path, bytes) => writeFileSync(path, bytes),
    readInput: (path) => readFileSync(path),
    readOutput: (path) => readFileSync(path),
  });
  const reportPath = join(outputDirectory, "report.json");
  writeFileSync(reportPath, serializeExternalKicadQaReportV1(report), "utf8");
  process.stdout.write(`External KiCad QA passed: ${report.contentHash}\n`);
  process.stdout.write(`Report: ${reportPath}\n`);
} catch (error) {
  if (error instanceof ExternalKicadQaErrorV1) {
    process.stderr.write(`External KiCad QA failed closed [${error.code}]: ${error.message}\n`);
    if (error.code === "kicad_cli_unavailable") {
      process.stderr.write(`Install KiCad 8, 9, or 10, or set KICAD_CLI to its kicad-cli executable. Package root: ${packageRoot}\n`);
    }
    process.exitCode = 1;
  } else {
    throw error;
  }
}
