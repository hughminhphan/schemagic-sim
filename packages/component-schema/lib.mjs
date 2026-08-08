import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

export const validators = {
  component: ajv.compile(readJson(path.join(here, "component.schema.json"))),
  sources: ajv.compile(readJson(path.join(here, "sources.schema.json"))),
  expectations: ajv.compile(readJson(path.join(here, "expectations.schema.json")))
};

function schemaErrors(label, validator, data) {
  if (validator(data)) return [];
  return (validator.errors ?? []).map(
    (error) => `${label}${error.instancePath || "/"} ${error.message}`
  );
}

export function validateComponentFiles(componentPath) {
  const absoluteComponentPath = path.resolve(componentPath);
  const packageDir = path.dirname(absoluteComponentPath);
  const sourcesPath = path.join(packageDir, "sources.json");
  const expectationsPath = path.join(packageDir, "tests", "expectations.json");
  const errors = [];
  let component;
  let expectations = null;

  try {
    component = readJson(absoluteComponentPath);
    errors.push(...schemaErrors("component", validators.component, component));
  } catch (error) {
    return { errors: [`component cannot be read: ${error.message}`], component: null };
  }

  if (fs.existsSync(sourcesPath)) {
    try {
      errors.push(...schemaErrors("sources", validators.sources, readJson(sourcesPath)));
    } catch (error) {
      errors.push(`sources cannot be read: ${error.message}`);
    }
  }

  if (fs.existsSync(expectationsPath)) {
    try {
      expectations = readJson(expectationsPath);
      errors.push(...schemaErrors("expectations", validators.expectations, expectations));
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

  const symbolPins = new Set();
  for (const pin of component?.symbol_pins ?? []) {
    if (symbolPins.has(pin.number)) errors.push(`duplicate symbol pin number: ${pin.number}`);
    symbolPins.add(pin.number);
  }
  const spiceOrders = new Set();
  const mappedPins = new Set();
  for (const mapping of component?.spice_pin_mapping ?? []) {
    if (!symbolPins.has(mapping.symbol_pin_number)) {
      errors.push(`spice mapping references unknown symbol pin: ${mapping.symbol_pin_number}`);
    }
    if (spiceOrders.has(mapping.order)) errors.push(`duplicate SPICE pin order: ${mapping.order}`);
    spiceOrders.add(mapping.order);
    mappedPins.add(mapping.symbol_pin_number);
  }
  for (const pin of symbolPins) {
    if (!mappedPins.has(pin)) errors.push(`symbol pin is not mapped to SPICE: ${pin}`);
  }

  const tierNumber = Number.parseInt(String(component?.fidelity_tier).slice(1), 10);
  if (Number.isFinite(tierNumber) && tierNumber >= 2) {
    const hasCitedTest = expectations?.tests?.some((test) =>
      [...(test.scalar_checks ?? []), ...(test.hard_bounds_checks ?? [])].some(
        (check) => typeof check.datasheet_citation === "string" && check.datasheet_citation.trim()
      )
    );
    if (!hasCitedTest) errors.push("F2+ requires at least one cited test check");
  }

  for (const test of expectations?.tests ?? []) {
    const testPath = path.join(packageDir, "tests", test.test_netlist);
    if (!fs.existsSync(testPath)) errors.push(`referenced test netlist does not exist: tests/${test.test_netlist}`);
  }

  return { errors, component, expectations };
}

function syntaxCheckModel(packageDir) {
  const modelPath = path.join(packageDir, "model.cir");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "opencircuit-model-check-"));
  const wrapperPath = path.join(scratch, "syntax-check.cir");
  const escaped = modelPath.replaceAll("\\", "/").replaceAll('"', '\\"');
  fs.writeFileSync(
    wrapperPath,
    `OpenCircuit model syntax check\n.include "${escaped}"\nVsyntax syntax_node 0 0\nRsyntax syntax_node 0 1G\n.op\n.end\n`
  );
  const ngspiceBin = process.env.NGSPICE_BIN
    ?? ["/opt/homebrew/bin/ngspice", "/usr/bin/ngspice", "/usr/local/bin/ngspice"].find(p => fs.existsSync(p))
    ?? "ngspice";
  const result = spawnSync(ngspiceBin, ["-b", wrapperPath], {
    cwd: scratch,
    encoding: "utf8",
    timeout: 30_000
  });
  fs.rmSync(scratch, { recursive: true, force: true });
  if (result.error) return `ngspice syntax check could not run: ${result.error.message}`;
  if (result.status !== 0) {
    const diagnostic = `${result.stderr || ""}\n${result.stdout || ""}`.trim().split("\n").slice(-8).join(" | ");
    return `model.cir failed ngspice syntax check: ${diagnostic}`;
  }
  return null;
}

export function validatePackage(packageDir) {
  const absoluteDir = path.resolve(packageDir);
  const errors = [];
  for (const relative of [
    "component.json",
    "model.cir",
    "sources.json",
    "MODEL_CARD.md",
    "LICENSE",
    path.join("tests", "expectations.json")
  ]) {
    const target = path.join(absoluteDir, relative);
    if (!fs.existsSync(target)) errors.push(`missing required package file: ${relative}`);
    else if (fs.statSync(target).isFile() && fs.statSync(target).size === 0) errors.push(`required package file is empty: ${relative}`);
  }

  const testsDir = path.join(absoluteDir, "tests");
  if (!fs.existsSync(testsDir) || !fs.statSync(testsDir).isDirectory()) {
    errors.push("tests/ directory is missing");
  } else if (!fs.readdirSync(testsDir).some((name) => name.endsWith(".cir"))) {
    errors.push("tests/ must contain at least one .cir netlist");
  }

  const componentPath = path.join(absoluteDir, "component.json");
  if (fs.existsSync(componentPath)) {
    errors.push(...validateComponentFiles(componentPath).errors);
  }

  if (fs.existsSync(path.join(absoluteDir, "sources.json"))) {
    try {
      const sources = readJson(path.join(absoluteDir, "sources.json"));
      for (const [index, source] of sources.entries()) {
        if (source.placeholder) errors.push(`sources[${index}] must not be placeholder in a package validation`);
        if (/\.(?:lib|cir)(?:$|[?#])/i.test(source.url)) {
          errors.push(`sources[${index}] references a prohibited vendor model URL`);
        }
      }
    } catch {
      // Schema/read diagnostics are emitted above.
    }
  }

  if (fs.existsSync(path.join(absoluteDir, "model.cir"))) {
    const text = fs.readFileSync(path.join(absoluteDir, "model.cir"), "utf8");
    const lowerText = text.toLowerCase();
    for (const phrase of ["opencircuit model factory", "original work", "public factual specifications"]) {
      if (!lowerText.includes(phrase)) errors.push(`model.cir header is missing required phrase: ${phrase}`);
    }
    const syntaxError = syntaxCheckModel(absoluteDir);
    if (syntaxError) errors.push(syntaxError);
  }

  return { errors, packageDir: absoluteDir };
}
