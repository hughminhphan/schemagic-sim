import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonAnalysis,
  DEFAULT_BENCH_TIMEOUT_MS,
  DEFAULT_PACKAGE_TIMEOUT_MS,
  DEFAULT_TOTAL_TIMEOUT_MS,
  parseArgs,
  renderMarkdown,
  runReplay,
} from "../replay.mjs";

test("parseArgs provides bounded defaults and accepts overrides", () => {
  const defaults = parseArgs([]);
  assert.equal(defaults.packageTimeoutMs, DEFAULT_PACKAGE_TIMEOUT_MS);
  assert.equal(defaults.totalTimeoutMs, DEFAULT_TOTAL_TIMEOUT_MS);
  assert.equal(defaults.benchTimeoutMs, DEFAULT_BENCH_TIMEOUT_MS);
  const overridden = parseArgs(["--package-timeout-ms", "100", "--total-timeout-ms", "200", "--bench-timeout-ms", "50"]);
  assert.equal(overridden.packageTimeoutMs, 100);
  assert.equal(overridden.totalTimeoutMs, 200);
  assert.equal(overridden.benchTimeoutMs, 50);
  assert.throws(() => parseArgs(["--total-timeout-ms", "0"]), /positive number/);
});

test("analysis mapping mirrors the reviewed package comparison contract", () => {
  assert.equal(comparisonAnalysis("operating_point"), "op");
  assert.equal(comparisonAnalysis("dc_sweep"), "op");
  assert.equal(comparisonAnalysis("transient"), "tran");
  assert.equal(comparisonAnalysis("ac_small_signal"), "ac");
  assert.equal(comparisonAnalysis("noise"), null);
});

test("runReplay records fresh pass, disagreement, and unsupported skip", async () => {
  let now = 0;
  const packages = [{
    id: "maker/part",
    packageDir: "/models/maker/part",
    benches: [
      { name: "pass.cir", netlistPath: "/models/maker/part/tests/pass.cir", analysisType: "operating_point", analysis: "op" },
      { name: "fail.cir", netlistPath: "/models/maker/part/tests/fail.cir", analysisType: "transient", analysis: "tran" },
      { name: "noise.cir", netlistPath: "/models/maker/part/tests/noise.cir", analysisType: "noise", analysis: null },
    ],
  }];
  const compare = async ({ netlistPath }) => {
    now += 5;
    const pass = netlistPath.endsWith("pass.cir");
    return {
      pass,
      tolerances: { rtol: 0.001, atol: 1e-9 },
      engines: { native: { version: "ngspice-46" }, wasm: { version: "wasm-46" } },
      vectors: [{ name: "v(out)", metric: "point-relative", pass, maxRelativeError: pass ? 0 : 1, maxAbsError: pass ? 0 : 1 }],
    };
  };
  const report = await runReplay({
    libraryRoot: "/models",
    outputDir: "/output",
    packageTimeoutMs: 100,
    totalTimeoutMs: 1_000,
    benchTimeoutMs: 50,
  }, { packages, compare, now: () => now, wallNow: () => "2026-09-03T00:00:00.000Z" });
  assert.deepEqual(report.summary.benchCounts, { pass: 1, fail: 1, skipped: 1 });
  assert.deepEqual(report.summary.failingPackageIds, ["maker/part"]);
  assert.match(report.packages[0].benches[2].reason, /unsupported comparison analysis/);
  assert.match(renderMarkdown(report), /maker\/part/);
});

test("runReplay reports every remaining bench when the total budget is exhausted", async () => {
  let now = 0;
  const clock = () => { now += 10; return now; };
  const packages = [
    { id: "a/one", benches: [{ name: "a.cir", analysisType: "operating_point", analysis: "op", netlistPath: "/a.cir" }] },
    { id: "b/two", benches: [{ name: "b.cir", analysisType: "operating_point", analysis: "op", netlistPath: "/b.cir" }] },
  ];
  const report = await runReplay({
    libraryRoot: "/models",
    outputDir: "/output",
    packageTimeoutMs: 100,
    totalTimeoutMs: 5,
    benchTimeoutMs: 50,
  }, { packages, compare: async () => assert.fail("comparison should not run"), now: clock, wallNow: () => "2026-09-03T00:00:00.000Z" });
  assert.deepEqual(report.summary.packageCounts, { pass: 0, fail: 0, skipped: 2 });
  assert.deepEqual(report.summary.benchCounts, { pass: 0, fail: 0, skipped: 2 });
});
