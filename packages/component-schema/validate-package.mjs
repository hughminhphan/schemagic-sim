#!/usr/bin/env node
import path from "node:path";
import { validatePackage } from "./lib.mjs";

const args = process.argv.slice(2);
const requireEvidenceContract = args.includes("--require-evidence-contract");
const input = args.find((arg) => !arg.startsWith("--"));
if (!input) {
  console.error("Usage: validate-package [--require-evidence-contract] <models/manufacturer/mpn directory>");
  process.exit(2);
}
const packageDir = path.resolve(input);
const { errors } = validatePackage(packageDir, { requireEvidenceContract });
if (errors.length) {
  console.error(`FAIL ${packageDir}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`PASS ${packageDir}`);
