import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Simulation } from "eecircuit-engine";
import { parseRawfile } from "./rawfile.mjs";

export const EECIRCUIT_ENGINE_VERSION = "1.7.0";

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
      timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function runWasm(options) {
  const {
    netlistPath,
    netlist,
    timeoutMs = 30_000,
    simulation = null,
  } = typeof options === "string" ? { netlistPath: options } : options;

  if ((netlistPath ? 1 : 0) + (netlist ? 1 : 0) !== 1) {
    throw new Error("runWasm requires exactly one of netlistPath or netlist");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");

  const source = netlist ?? await readFile(netlistPath, "utf8");
  const sim = simulation ?? new Simulation();
  const initStarted = performance.now();
  await withTimeout(sim.start(), timeoutMs, "WASM ngspice initialization");
  const initTimingMs = performance.now() - initStarted;

  sim.setNetList(source);
  const runStarted = performance.now();
  await withTimeout(sim.runSim(), timeoutMs, "WASM ngspice simulation");
  const timingMs = performance.now() - runStarted;

  const module = sim.__getSpiceModuleForTests();
  const bytes = module?.FS?.readFile("out.raw");
  if (!bytes) throw new Error("eecircuit-engine did not produce out.raw in MEMFS");
  const rawfile = parseRawfile(bytes);
  const initInfo = sim.getInitInfo();
  const ngspiceVersion = initInfo.match(/ngspice-[^\s:,]+/i)?.[0] ?? "unknown";
  const errors = sim.getError();

  return {
    rawfile,
    vectors: rawfile.vectors,
    stderr: Array.isArray(errors) ? errors.join("\n") : String(errors ?? ""),
    timingMs,
    initTimingMs,
    version: `eecircuit-engine ${EECIRCUIT_ENGINE_VERSION} (${ngspiceVersion})`,
    ngspiceVersion,
  };
}
