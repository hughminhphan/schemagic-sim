import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { migrateCircuit } from "@opencircuit/circuit-schema";
import { parseBinaryRawfile } from "@opencircuit/sim-engine";
import { generateNetlistWithCatalog } from "../../apps/web/src/catalog-netlist.ts";

const projectRoot = process.cwd();
const examplesRoot = resolve(projectRoot, "examples");
const modelsRoot = resolve(projectRoot, "packages/model-library/models");
const modelName = (source) => source.match(/^\s*\.model\s+(\S+)/im)?.[1] ?? source.match(/^\s*\.subckt\s+(\S+)/im)?.[1] ?? "";
const parts = [];
for (const manufacturer of await readdir(modelsRoot, { withFileTypes: true })) {
  if (!manufacturer.isDirectory()) continue;
  const makerRoot = resolve(modelsRoot, manufacturer.name);
  for (const packageEntry of await readdir(makerRoot, { withFileTypes: true })) {
    if (!packageEntry.isDirectory()) continue;
    const packageRoot = resolve(makerRoot, packageEntry.name);
    try {
      const manifest = JSON.parse(await readFile(resolve(packageRoot, "component.json"), "utf8"));
      const modelSource = await readFile(resolve(packageRoot, "model.cir"), "utf8");
      parts.push({ id: `${manufacturer.name}/${packageEntry.name}`, manifest, modelSource, modelName: modelName(modelSource) });
    } catch {}
  }
}

const intended = {
  "transistor-led-bench": ["op"],
  "resistive-divider": ["dc-sweep", "op"],
  "led-current-limit": ["dc-sweep", "op"],
  "rc-filter-bode": ["ac"],
  "rlc-resonance": ["ac", "tran"],
  "halfwave-rectifier": ["tran"],
  "bridge-rectifier": ["tran"],
  "inverting-opamp": ["tran", "ac"],
  "common-emitter-amp": ["ac", "tran"],
  "mosfet-led-switch": ["tran"],
  "opamp-noninverting": ["ac", "tran"],
};
const [singleId, singleAnalysis] = process.argv.slice(2);
if (!singleId || !singleAnalysis) {
  let failed = false;
  for (const [id, analyses] of Object.entries(intended)) {
    const results = [];
    for (const analysis of analyses) {
      const child = spawnSync(process.execPath, [process.argv[1], id, analysis], { cwd: projectRoot, encoding: "utf8" });
      if (child.status !== 0) {
        failed = true;
        console.error(child.stderr || child.stdout);
      } else results.push(child.stdout.trim());
    }
    console.log(`${id}: ${results.join(", ")}`);
  }
  if (failed) process.exitCode = 1;
} else {
  const document = migrateCircuit(JSON.parse(await readFile(resolve(examplesRoot, `${singleId}.json`), "utf8")));
  const generated = generateNetlistWithCatalog(document, singleAnalysis, parts);
  const loaderUrl = pathToFileURL(resolve(projectRoot, "tools/ngspice-wasm-build/dist-loader/index.mjs")).href;
  const { createNgspiceEngine } = await import(loaderUrl);
  const engine = await createNgspiceEngine();
  const run = await engine.runNetlist(generated.netlist);
  const output = `${run.stdout}\n${run.stderr}`;
  const fatal = /fatal error|singular matrix|timestep too small|doAnalyses:|no such model|unknown subckt/i.test(output);
  const vectors = parseBinaryRawfile(run.rawfile).vectors.length;
  if (fatal || run.rawfile.byteLength === 0 || vectors === 0) {
    console.error(`${singleId} ${singleAnalysis}: FAIL\n${output.slice(-1200)}`);
    process.exitCode = 1;
  } else console.log(`${singleAnalysis}=pass (${vectors} vectors, ${run.rawfile.byteLength} bytes)`);
}
