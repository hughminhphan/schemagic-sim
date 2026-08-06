#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareNetlist } from "./compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURES = join(HERE, "fixtures");

function inferAnalysis(netlist) {
  if (/^\s*\.op(?:\s|$)/im.test(netlist)) return "op";
  if (/^\s*\.tran(?:\s|$)/im.test(netlist)) return "tran";
  if (/^\s*\.ac(?:\s|$)/im.test(netlist)) return "ac";
  throw new Error("Cannot infer analysis; expected one of .op, .tran, or .ac");
}

async function loadManifest(directory) {
  try {
    return JSON.parse(await readFile(join(directory, "suite.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { circuits: {} };
    throw error;
  }
}

function maxMetric(vectors, key) {
  return Math.max(0, ...vectors.map((vector) => vector[key]).filter(Number.isFinite));
}

export async function runSuite(directory = DEFAULT_FIXTURES) {
  const fixtureDirectory = resolve(directory);
  const manifest = await loadManifest(fixtureDirectory);
  const filenames = (await readdir(fixtureDirectory)).filter((name) => name.toLowerCase().endsWith(".cir")).sort();
  if (filenames.length === 0) throw new Error(`No .cir files found in ${fixtureDirectory}`);

  const reports = [];
  for (const filename of filenames) {
    const netlistPath = join(fixtureDirectory, filename);
    const fixture = manifest.circuits?.[filename] ?? {};
    const analysis = fixture.analysis ?? inferAnalysis(await readFile(netlistPath, "utf8"));
    try {
      const report = await compareNetlist({
        netlistPath,
        analysis,
        rtol: fixture.rtol,
        atol: fixture.atol,
        phaseDeg: fixture.phaseDeg,
        timeoutMs: fixture.timeoutMs ?? 30_000,
      });
      reports.push(report);
    } catch (error) {
      reports.push({ netlist: netlistPath, analysis, pass: false, error: error.message, vectors: [] });
    }
  }

  return {
    schemaVersion: 1,
    fixtureDirectory,
    pass: reports.every((report) => report.pass),
    reports,
  };
}

function printSuite(suite) {
  const rows = suite.reports.map((report) => ({
    circuit: basename(report.netlist),
    analysis: report.analysis,
    vectors: report.vectors.length,
    maxRel: report.error ? "-" : maxMetric(report.vectors, "maxRelativeError").toExponential(3),
    phase: report.error || report.analysis !== "ac" ? "-" : `${maxMetric(report.vectors, "maxPhaseErrorDeg").toFixed(4)} deg`,
    result: report.pass ? "PASS" : "FAIL",
  }));
  const headers = { circuit: "circuit", analysis: "analysis", vectors: "vectors", maxRel: "max rel", phase: "phase", result: "result" };
  const keys = Object.keys(headers);
  const widths = Object.fromEntries(keys.map((key) => [key, Math.max(headers[key].length, ...rows.map((row) => String(row[key]).length))]));
  const line = (row) => keys.map((key) => String(row[key]).padEnd(widths[key])).join("  ");
  console.log(line(headers));
  console.log(keys.map((key) => "-".repeat(widths[key])).join("  "));
  for (const row of rows) console.log(line(row));
  for (const report of suite.reports.filter((entry) => entry.error)) console.error(`${basename(report.netlist)}: ${report.error}`);
  console.log(suite.pass ? `PASS: ${rows.length}/${rows.length} circuits` : `FAIL: ${rows.filter((row) => row.result === "PASS").length}/${rows.length} circuits`);
}

function parseArgs(argv) {
  let directory = DEFAULT_FIXTURES;
  let jsonPath;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--json") {
      jsonPath = argv[++index];
      if (!jsonPath) throw new Error("--json requires a path");
    } else if (argv[index].startsWith("--")) {
      throw new Error(`Unknown option: ${argv[index]}`);
    } else if (directory !== DEFAULT_FIXTURES) {
      throw new Error("Expected at most one fixture directory");
    } else {
      directory = argv[index];
    }
  }
  return { directory, jsonPath };
}

async function main() {
  const { directory, jsonPath } = parseArgs(process.argv.slice(2));
  const suite = await runSuite(directory);
  printSuite(suite);
  if (jsonPath) {
    const outputPath = resolve(jsonPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
  }
  if (!suite.pass) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
