#!/usr/bin/env node
import path from "node:path";
import { validateComponentFiles } from "./lib.mjs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: validate-component <path/to/component.json>");
  process.exit(2);
}
const componentPath = path.resolve(input);
const { errors } = validateComponentFiles(componentPath);
if (errors.length) {
  console.error(`FAIL ${componentPath}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`PASS ${componentPath}`);
