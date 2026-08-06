#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];

if (!input) {
  console.error("Usage: node validate.mjs <path/to/component.json>");
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const componentPath = path.resolve(process.cwd(), input);
const packageDir = path.dirname(componentPath);
const sourcesPath = path.join(packageDir, "sources.json");
const expectationsPath = path.join(packageDir, "tests", "expectations.json");
const errors = [];

let component;
try {
  component = readJson(componentPath);
} catch (error) {
  console.error(`Cannot read component JSON: ${error.message}`);
  process.exit(1);
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validators = {
  component: ajv.compile(readJson(path.join(here, "component.schema.json"))),
  sources: ajv.compile(readJson(path.join(here, "sources.schema.json"))),
  expectations: ajv.compile(readJson(path.join(here, "expectations.schema.json")))
};

const collectSchemaErrors = (label, validator, data) => {
  if (!validator(data)) {
    for (const error of validator.errors ?? []) {
      errors.push(`${label}${error.instancePath || "/"} ${error.message}`);
    }
  }
};

collectSchemaErrors("component", validators.component, component);

let expectations = null;
if (fs.existsSync(sourcesPath)) {
  try {
    collectSchemaErrors("sources", validators.sources, readJson(sourcesPath));
  } catch (error) {
    errors.push(`sources cannot be read: ${error.message}`);
  }
}

if (fs.existsSync(expectationsPath)) {
  try {
    expectations = readJson(expectationsPath);
    collectSchemaErrors("expectations", validators.expectations, expectations);
  } catch (error) {
    errors.push(`expectations cannot be read: ${error.message}`);
  }
}

if (component?.reviewer?.tool_or_agent === component?.generator?.tool_or_agent) {
  errors.push("reviewer.tool_or_agent must differ from generator.tool_or_agent");
}

if (!Array.isArray(component?.known_omissions) || component.known_omissions.length === 0) {
  errors.push("known_omissions must be non-empty");
}

const tierNumber = Number.parseInt(String(component?.fidelity_tier).slice(1), 10);
if (Number.isFinite(tierNumber) && tierNumber >= 2) {
  const hasCitedTest = expectations?.tests?.some((test) => {
    const checks = [...(test.scalar_checks ?? []), ...(test.hard_bounds_checks ?? [])];
    return checks.some(
      (check) =>
        typeof check.datasheet_citation === "string" &&
        check.datasheet_citation.trim().length > 0
    );
  });

  if (!hasCitedTest) {
    errors.push("F2+ requires at least one test check with a datasheet_citation");
  }
}

if (expectations?.tests) {
  for (const test of expectations.tests) {
    const netlistPath = path.join(packageDir, "tests", test.test_netlist);
    if (!fs.existsSync(netlistPath)) {
      errors.push(`referenced test netlist does not exist: tests/${test.test_netlist}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`FAIL ${componentPath}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`PASS ${componentPath}`);
