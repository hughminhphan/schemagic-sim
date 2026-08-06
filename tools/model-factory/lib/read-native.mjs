#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [netlistPath, outputPath] = process.argv.slice(2);
if (!netlistPath || !outputPath) {
  console.error("Usage: node read-native.mjs <netlist.cir> <output.json>");
  process.exit(2);
}
const modulePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../native-ngspice-reference/lib/run-native.mjs");
const { runNative } = await import(pathToFileURL(modulePath));
const result = await runNative({ netlistPath: path.resolve(netlistPath), timeoutMs: 30_000 });
fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify({
  version: result.version,
  plotName: result.rawfile.plotName,
  vectors: result.rawfile.vectors
}, null, 2)}\n`);
