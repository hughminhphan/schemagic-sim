#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { compareNetlist } from "./compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
process.env.OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE ??= join(REPO_ROOT, "tools/ngspice-wasm-build/dist-loader/index.mjs");
export const DEFAULT_LIBRARY_ROOT = join(REPO_ROOT, "packages/model-library/models");
export const DEFAULT_OUTPUT_DIR = join(HERE, "output/replay");
export const DEFAULT_PACKAGE_TIMEOUT_MS = 60_000;
export const DEFAULT_TOTAL_TIMEOUT_MS = 90 * 60_000;
export const DEFAULT_BENCH_TIMEOUT_MS = 30_000;

function positiveNumber(flag, value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${flag} requires a positive number`);
  return number;
}

export function parseArgs(argv) {
  const options = {
    libraryRoot: DEFAULT_LIBRARY_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    packageTimeoutMs: DEFAULT_PACKAGE_TIMEOUT_MS,
    totalTimeoutMs: DEFAULT_TOTAL_TIMEOUT_MS,
    benchTimeoutMs: DEFAULT_BENCH_TIMEOUT_MS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[++index];
    if (value === undefined) throw new Error(`${flag} requires a value`);
    if (flag === "--library-root") options.libraryRoot = resolve(value);
    else if (flag === "--output-dir") options.outputDir = resolve(value);
    else if (flag === "--package-timeout-ms") options.packageTimeoutMs = positiveNumber(flag, value);
    else if (flag === "--total-timeout-ms") options.totalTimeoutMs = positiveNumber(flag, value);
    else if (flag === "--bench-timeout-ms") options.benchTimeoutMs = positiveNumber(flag, value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

export function comparisonAnalysis(analysisType) {
  if (analysisType === "ac_small_signal") return "ac";
  if (analysisType === "transient") return "tran";
  if (analysisType === "operating_point" || analysisType === "dc_sweep") return "op";
  return null;
}

export async function discoverPackages(libraryRoot) {
  const root = resolve(libraryRoot);
  const manufacturers = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const packages = [];
  for (const manufacturer of manufacturers) {
    const manufacturerRoot = join(root, manufacturer.name);
    const models = (await readdir(manufacturerRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const model of models) {
      const packageDir = join(manufacturerRoot, model.name);
      const expectationsPath = join(packageDir, "tests/expectations.json");
      const expectations = JSON.parse(await readFile(expectationsPath, "utf8"));
      if (!Array.isArray(expectations.tests)) throw new Error(`${expectationsPath} has no tests array`);
      packages.push({
        id: `${manufacturer.name}/${model.name}`,
        packageDir,
        benches: expectations.tests.map((test) => ({
          name: test.test_netlist,
          netlistPath: join(packageDir, "tests", test.test_netlist),
          analysisType: test.analysis_type,
          analysis: comparisonAnalysis(test.analysis_type),
        })),
      });
    }
  }
  return packages;
}

function skippedBench(bench, reason) {
  return {
    name: bench.name,
    analysisType: bench.analysisType,
    comparisonAnalysis: bench.analysis,
    status: "skipped",
    reason,
    durationMs: 0,
  };
}

function skippedPackage(pkg, reason) {
  return {
    id: pkg.id,
    status: "skipped",
    reason,
    durationMs: 0,
    benches: pkg.benches.map((bench) => skippedBench(bench, reason)),
  };
}

function packageStatus(benches) {
  if (benches.some((bench) => bench.status === "fail")) return "fail";
  if (benches.some((bench) => bench.status === "pass")) return "pass";
  return "skipped";
}

function maxMetric(vectors, key) {
  return Math.max(0, ...vectors.map((vector) => vector[key]).filter(Number.isFinite));
}

export function summarize(packages) {
  const packageCounts = { pass: 0, fail: 0, skipped: 0 };
  const benchCounts = { pass: 0, fail: 0, skipped: 0 };
  const skipReasons = {};
  const failingPackageIds = [];
  for (const pkg of packages) {
    packageCounts[pkg.status] += 1;
    if (pkg.status === "fail") failingPackageIds.push(pkg.id);
    for (const bench of pkg.benches) {
      benchCounts[bench.status] += 1;
      if (bench.status === "skipped") skipReasons[bench.reason] = (skipReasons[bench.reason] ?? 0) + 1;
    }
  }
  return { packageCounts, benchCounts, skipReasons, failingPackageIds };
}

export async function runReplay(options, dependencies = {}) {
  const compare = dependencies.compare ?? compareNetlist;
  const now = dependencies.now ?? (() => performance.now());
  const wallNow = dependencies.wallNow ?? (() => new Date().toISOString());
  const discovered = dependencies.packages ?? await discoverPackages(options.libraryRoot);
  const startedAt = wallNow();
  const replayStarted = now();
  const packages = [];

  for (let packageIndex = 0; packageIndex < discovered.length; packageIndex += 1) {
    const pkg = discovered[packageIndex];
    const totalElapsed = now() - replayStarted;
    if (totalElapsed >= options.totalTimeoutMs) {
      const reason = `total budget exhausted after ${Math.round(totalElapsed)} ms`;
      for (const remaining of discovered.slice(packageIndex)) packages.push(skippedPackage(remaining, reason));
      break;
    }

    const packageStarted = now();
    const benches = [];
    for (let benchIndex = 0; benchIndex < pkg.benches.length; benchIndex += 1) {
      const bench = pkg.benches[benchIndex];
      const packageElapsed = now() - packageStarted;
      const totalNow = now() - replayStarted;
      if (totalNow >= options.totalTimeoutMs) {
        const reason = `total budget exhausted after ${Math.round(totalNow)} ms`;
        for (const remaining of pkg.benches.slice(benchIndex)) benches.push(skippedBench(remaining, reason));
        break;
      }
      if (packageElapsed >= options.packageTimeoutMs) {
        const reason = `package budget exhausted after ${Math.round(packageElapsed)} ms`;
        for (const remaining of pkg.benches.slice(benchIndex)) benches.push(skippedBench(remaining, reason));
        break;
      }
      if (!bench.analysis) {
        benches.push(skippedBench(bench, `unsupported comparison analysis: ${bench.analysisType}`));
        continue;
      }

      const benchStarted = now();
      const remainingPackageMs = Math.max(1, options.packageTimeoutMs - packageElapsed);
      const remainingTotalMs = Math.max(1, options.totalTimeoutMs - totalNow);
      const timeoutMs = Math.min(options.benchTimeoutMs, remainingPackageMs, remainingTotalMs);
      try {
        const report = await compare({
          netlistPath: bench.netlistPath,
          analysis: bench.analysis,
          timeoutMs,
        });
        benches.push({
          name: bench.name,
          analysisType: bench.analysisType,
          comparisonAnalysis: bench.analysis,
          status: report.pass ? "pass" : "fail",
          ...(report.pass ? {} : { reason: "native and WASM results disagree outside tolerance" }),
          durationMs: now() - benchStarted,
          tolerances: report.tolerances,
          nativeVersion: report.engines.native.version,
          wasmVersion: report.engines.wasm.version,
          maxRelativeError: maxMetric(report.vectors, "maxRelativeError"),
          maxAbsoluteError: maxMetric(report.vectors, "maxAbsError"),
          failingVectors: report.vectors.filter((vector) => !vector.pass).map((vector) => ({
            name: vector.name,
            metric: vector.metric,
            reason: vector.error ?? (vector.metric === "missing" ? "vector missing from one engine" : "outside tolerance"),
          })),
        });
      } catch (error) {
        benches.push({
          name: bench.name,
          analysisType: bench.analysisType,
          comparisonAnalysis: bench.analysis,
          status: "fail",
          reason: error.message,
          durationMs: now() - benchStarted,
        });
      }
    }
    const status = packageStatus(benches);
    packages.push({
      id: pkg.id,
      status,
      ...(status === "skipped" ? { reason: benches[0]?.reason ?? "no comparable benches" } : {}),
      durationMs: now() - packageStarted,
      benches,
    });
  }

  const finishedAt = wallNow();
  const summary = summarize(packages);
  return {
    schemaVersion: 1,
    startedAt,
    finishedAt,
    durationMs: now() - replayStarted,
    libraryRoot: resolve(options.libraryRoot),
    budgets: {
      packageTimeoutMs: options.packageTimeoutMs,
      totalTimeoutMs: options.totalTimeoutMs,
      benchTimeoutMs: options.benchTimeoutMs,
    },
    inventory: {
      packages: discovered.length,
      benches: discovered.reduce((total, pkg) => total + pkg.benches.length, 0),
    },
    summary,
    complete: summary.benchCounts.skipped === 0,
    pass: summary.benchCounts.fail === 0,
    packages,
  };
}

export function renderMarkdown(report) {
  const rows = [
    ["Packages", report.inventory.packages, report.summary.packageCounts.pass, report.summary.packageCounts.fail, report.summary.packageCounts.skipped],
    ["Benches", report.inventory.benches, report.summary.benchCounts.pass, report.summary.benchCounts.fail, report.summary.benchCounts.skipped],
  ];
  const lines = [
    "# Native versus WASM fresh replay",
    "",
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Duration: ${(report.durationMs / 1000).toFixed(1)} s`,
    "",
    "| Scope | Total | Pass | Fail | Skipped |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
  if (report.summary.failingPackageIds.length) {
    lines.push("", "## Failing packages", "", ...report.summary.failingPackageIds.map((id) => `- \`${id}\``));
  }
  const skipReasons = Object.entries(report.summary.skipReasons);
  if (skipReasons.length) {
    lines.push("", "## Skipped benches", "", "| Reason | Count |", "| --- | ---: |", ...skipReasons.map(([reason, count]) => `| ${reason.replaceAll("|", "\\|")} | ${count} |`));
  }
  lines.push("");
  return lines.join("\n");
}

async function writeOutputs(report, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, "replay-summary.json");
  const markdownPath = join(outputDir, "replay-summary.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdown(report), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runReplay(options);
  const outputs = await writeOutputs(report, options.outputDir);
  const counts = report.summary.benchCounts;
  console.log(`Replay: ${report.inventory.packages} packages, ${report.inventory.benches} benches`);
  console.log(`Benches: ${counts.pass} pass, ${counts.fail} fail, ${counts.skipped} skipped`);
  console.log(`Summary JSON: ${relative(process.cwd(), outputs.jsonPath)}`);
  console.log(`Summary Markdown: ${relative(process.cwd(), outputs.markdownPath)}`);
  if (!report.pass) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
