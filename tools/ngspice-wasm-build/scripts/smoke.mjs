import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createNgspiceEngine } from "../dist-loader/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const FIXTURES = resolve(ROOT, "../native-ngspice-reference/fixtures");
const names = ["op-diode-divider.cir", "rc-transient.cir", "rc-ac.cir"];

const generatedModule = await readFile(join(ROOT, "dist/ngspice.mjs"), "utf8");
const wasmBytes = await readFile(join(ROOT, "dist/ngspice.wasm"));
if (!generatedModule.includes("ngspice.wasm")) throw new Error("generated module does not reference separate ngspice.wasm");
if (/base64,/.test(generatedModule)) throw new Error("generated module contains an embedded base64 payload");
if (wasmBytes[0] !== 0x00 || wasmBytes[1] !== 0x61 || wasmBytes[2] !== 0x73 || wasmBytes[3] !== 0x6d) {
  throw new Error("ngspice.wasm has an invalid WebAssembly header");
}

const engine = await createNgspiceEngine();
const initInfo = engine.getInitInfo();
if (!/ngspice-46/i.test(initInfo)) throw new Error(`runtime banner is not ngspice-46:\n${initInfo}`);
if (!/KLU/i.test(initInfo)) throw new Error(`runtime did not report KLU:\n${initInfo}`);

for (const name of names) {
  const result = await engine.runNetlist(await readFile(join(FIXTURES, name), "utf8"));
  if (!(result.rawfile instanceof Uint8Array) || result.rawfile.byteLength < 64) {
    throw new Error(`${name} did not produce a binary rawfile`);
  }
  const header = Buffer.from(result.rawfile.subarray(0, Math.min(result.rawfile.byteLength, 4096))).toString("latin1");
  if (!header.includes("Binary:")) throw new Error(`${name} rawfile is not binary`);
}

const noise = await engine.runNoiseNetlist(`noise smoke\nV1 in 0 DC 1 AC 1\nR1 in out 1k\nR2 out 0 1k\n.temp 27\n.noise V(out) V1 dec 10 10 100k\n.end\n`);
for (const [label, rawfile] of [["noise density", noise.rawfile], ["integrated noise", noise.integratedRawfile]]) {
  const header = Buffer.from(rawfile.subarray(0, Math.min(rawfile.byteLength, 4096))).toString("latin1");
  if (!header.includes("Binary:")) throw new Error(`${label} rawfile is not binary`);
}

const op = await readFile(join(FIXTURES, names[0]), "utf8");
await engine.runNetlist(op);
await engine.reset();
await engine.runNetlist(op);
console.log(`smoke PASS: ngspice-46, KLU, 4 analyses including dual-plot noise, reset, repeated-run reuse, ${engine.memoryBytes} heap bytes`);
