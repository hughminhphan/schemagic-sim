#!/usr/bin/env node
import path from "node:path";
import { validatePackage } from "./lib.mjs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: validate-package <models/manufacturer/mpn directory>");
  process.exit(2);
}
const packageDir = path.resolve(input);
const { errors } = validatePackage(packageDir);
if (errors.length) {
  console.error(`FAIL ${packageDir}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`PASS ${packageDir}`);
