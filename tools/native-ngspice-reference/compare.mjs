#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareRawfiles, DEFAULT_TOLERANCES } from "./lib/compare-results.mjs";
import { runNative } from "./lib/run-native.mjs";
import { runWasm } from "./lib/run-wasm.mjs";

function parseNumber(flag, value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${flag} requires a non-negative number`);
  return number;
}

export function parseArgs(argv) {
  const options = { timeoutMs: 30_000 };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const value = argv[++index];
    if (value === undefined) throw new Error(`${argument} requires a value`);
    if (argument === "--analysis") options.analysis = value.toLowerCase();
    else if (argument === "--rtol") options.rtol = parseNumber(argument, value);
    else if (argument === "--atol") options.atol = parseNumber(argument, value);
    else if (argument === "--phase-deg") options.phaseDeg = parseNumber(argument, value);
    else if (argument === "--timeout-ms") options.timeoutMs = parseNumber(argument, value);
    else if (argument === "--json") options.jsonPath = value;
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (positional.length !== 1) throw new Error("Expected exactly one netlist path");
  if (!options.analysis || !["op", "tran", "ac"].includes(options.analysis)) {
    throw new Error("--analysis must be one of op, tran, or ac");
  }
  options.netlistPath = resolve(positional[0]);
  return options;
}

export async function compareNetlist(options) {
  const netlistPath = resolve(options.netlistPath);
  const [native, wasm] = await Promise.all([
    runNative({ netlistPath, timeoutMs: options.timeoutMs }),
    runWasm({ netlistPath, timeoutMs: options.timeoutMs }),
  ]);
  const base = DEFAULT_TOLERANCES[options.analysis];
  const tolerances = {
    rtol: options.rtol ?? base.rtol,
    atol: options.atol ?? base.atol,
    ...(options.analysis === "ac" ? { phaseDeg: options.phaseDeg ?? base.phaseDeg } : {}),
  };
  const comparison = compareRawfiles(native.rawfile, wasm.rawfile, {
    analysis: options.analysis,
    tolerances,
  });

  return {
    schemaVersion: 1,
    netlist: netlistPath,
    analysis: options.analysis,
    pass: comparison.pass,
    tolerances,
    engines: {
      native: {
        version: native.version,
        executable: native.executable,
        timingMs: native.timingMs,
        stderr: native.stderr,
      },
      wasm: {
        version: wasm.version,
        ngspiceVersion: wasm.ngspiceVersion,
        initTimingMs: wasm.initTimingMs,
        timingMs: wasm.timingMs,
        stderr: wasm.stderr,
      },
    },
    plots: { native: comparison.nativePlot, wasm: comparison.wasmPlot },
    vectors: comparison.vectors,
  };
}

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  if (value === 0) return "0";
  return value.toExponential(3);
}

function printTable(report) {
  const rows = report.vectors.map((vector) => ({
    vector: vector.name,
    points: `${vector.nativePoints}/${vector.wasmPoints}`,
    metric: vector.metric,
    rel: formatNumber(vector.maxRelativeError),
    abs: formatNumber(vector.maxAbsError),
    phase: vector.maxPhaseErrorDeg === undefined ? "-" : `${vector.maxPhaseErrorDeg.toFixed(4)} deg`,
    result: vector.pass ? "PASS" : "FAIL",
  }));
  const headers = { vector: "vector", points: "N/W", metric: "metric", rel: "max rel", abs: "max abs", phase: "phase", result: "result" };
  const keys = Object.keys(headers);
  const widths = Object.fromEntries(keys.map((key) => [key, Math.max(headers[key].length, ...rows.map((row) => String(row[key]).length))]));
  const line = (row) => keys.map((key) => String(row[key]).padEnd(widths[key])).join("  ");
  console.log(line(headers));
  console.log(keys.map((key) => "-".repeat(widths[key])).join("  "));
  for (const row of rows) console.log(line(row));
}

function printReport(report) {
  console.log(`${report.analysis.toUpperCase()}  ${report.netlist}`);
  console.log(`native ${report.engines.native.version} ${report.engines.native.timingMs.toFixed(1)} ms`);
  console.log(`wasm   ${report.engines.wasm.version} ${report.engines.wasm.timingMs.toFixed(1)} ms, init ${report.engines.wasm.initTimingMs.toFixed(1)} ms`);
  printTable(report);
  console.log(report.pass ? "PASS" : "FAIL");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await compareNetlist(options);
  printReport(report);
  if (options.jsonPath) {
    const jsonPath = resolve(options.jsonPath);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!report.pass) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
