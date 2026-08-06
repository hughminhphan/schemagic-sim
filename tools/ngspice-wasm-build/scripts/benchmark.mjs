import { brotliCompressSync, gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Simulation } from "../../../spikes/engine/node_modules/eecircuit-engine/dist/eecircuit-engine.mjs";
import { createNgspiceEngine } from "../dist-loader/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const opNetlist = await readFile(resolve(ROOT, "../native-ngspice-reference/fixtures/op-diode-divider.cir"), "utf8");

function memorySnapshot() {
  global.gc?.();
  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    runs: values.length,
    meanMs: mean,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
}

const ownInitStarted = performance.now();
const engine = await createNgspiceEngine();
const ownInitMs = performance.now() - ownInitStarted;
for (let index = 0; index < 5; index += 1) await engine.runNetlist(opNetlist);
const ownBefore = memorySnapshot();
const wasmHeapBeforeBytes = engine.memoryBytes;
const ownTimings = [];
for (let index = 0; index < 100; index += 1) {
  const started = performance.now();
  await engine.runNetlist(opNetlist);
  ownTimings.push(performance.now() - started);
}
const ownAfter = memorySnapshot();

const interim = new Simulation();
const interimInitStarted = performance.now();
await interim.start();
const interimInitMs = performance.now() - interimInitStarted;
for (let index = 0; index < 5; index += 1) {
  interim.setNetList(opNetlist);
  await interim.runSim();
}
const interimTimings = [];
for (let index = 0; index < 100; index += 1) {
  interim.setNetList(opNetlist);
  const started = performance.now();
  await interim.runSim();
  interimTimings.push(performance.now() - started);
}

const wasm = await readFile(join(ROOT, "dist/ngspice.wasm"));
const loader = await readFile(join(ROOT, "dist-loader/index.mjs"));
const generatedJs = await readFile(join(ROOT, "dist/ngspice.mjs"));
const result = {
  schemaVersion: 1,
  node: process.version,
  engine: {
    ngspice: "46",
    emscripten: (await readFile(join(ROOT, "dist/EMSCRIPTEN_VERSION.txt"), "utf8")).trim(),
  },
  sizes: {
    wasmRawBytes: wasm.byteLength,
    wasmGzipBytes: gzipSync(wasm, { level: 9 }).byteLength,
    wasmBrotliBytes: brotliCompressSync(wasm).byteLength,
    generatedModuleBytes: generatedJs.byteLength,
    loaderBytes: loader.byteLength,
  },
  init: {
    ownMs: ownInitMs,
    interimMs: interimInitMs,
  },
  repeatedOp: {
    own: summarize(ownTimings),
    interim: summarize(interimTimings),
    ownMemoryBefore: ownBefore,
    ownMemoryAfter: ownAfter,
    ownMemoryGrowth: Object.fromEntries(Object.keys(ownBefore).map((key) => [key, ownAfter[key] - ownBefore[key]])),
    wasmHeapBeforeBytes,
    wasmHeapAfterBytes: engine.memoryBytes,
  },
};
console.log(JSON.stringify(result, null, 2));
