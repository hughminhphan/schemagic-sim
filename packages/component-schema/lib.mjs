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

const LINKAGE_FIELDS = [
  "evidence_id",
  "condition_id",
  "citation_id",
  "cohort_id",
  "bench_condition_id",
  "evidence_role",
  "citation_locator",
  "evidence_qualification",
  "bench_qualification"
];
const GENERIC_CITATION = /^(?:n\/?a|none|unknown|tbd|todo|placeholder|datasheet|data\s*sheet|source|manufacturer(?:\s+datasheet)?|see\s+datasheet|electrical characteristics|typical characteristics|figure|table|page|p\.?|fig\.?)$/i;

function expectationChecks(expectations) {
  return (expectations?.tests ?? []).flatMap((test, testIndex) => [
    ...(test.scalar_checks ?? []).map((check, checkIndex) => ({ check, path: `tests[${testIndex}].scalar_checks[${checkIndex}]` })),
    ...(test.hard_bounds_checks ?? []).map((check, checkIndex) => ({ check, path: `tests[${testIndex}].hard_bounds_checks[${checkIndex}]` }))
  ]);
}

function isGenericCitation(value) {
  if (typeof value !== "string") return true;
  const normalized = value.trim().replace(/[.:;,]+$/g, "").replace(/\s+/g, " ");
  return normalized.length < 4 || GENERIC_CITATION.test(normalized);
}

function hasPlaceholderLocator(locator) {
  return Object.entries(locator ?? {}).some(([key, value]) =>
    key !== "page"
    && typeof value === "string"
    && /^(?:n\/?a|none|unknown|tbd|todo|placeholder|generic|unspecified)$/i.test(value.trim())
  );
}

function sameQualification(left, right) {
  return left?.test_mode === right?.test_mode
    && left?.pulse_width_s === right?.pulse_width_s
    && left?.duty_cycle === right?.duty_cycle;
}

export function validateExpectationsDocument(expectations) {
  return [
    ...schemaErrors("expectations", validators.expectations, expectations),
    ...evidenceContractErrors(expectations)
  ];
}

function evidenceContractErrors(expectations) {
  const errors = [];
  const checks = expectationChecks(expectations);
  const linkedChecks = checks.filter(({ check }) => LINKAGE_FIELDS.some((field) => Object.hasOwn(check, field)));
  const marked = expectations?.evidence_contract_version === "1.0.0";

  if (linkedChecks.length > 0 && !marked) {
    errors.push("expectations evidence_contract_version 1.0.0 is required when evidence linkage is declared");
  }

  const cohorts = new Map();
  for (const [index, cohort] of (expectations?.evidence_cohorts ?? []).entries()) {
    if (cohorts.has(cohort.cohort_id)) errors.push(`expectations evidence_cohorts[${index}] duplicates cohort_id ${cohort.cohort_id}`);
    cohorts.set(cohort.cohort_id, cohort);
  }

  for (const { check, path: checkPath } of linkedChecks) {
    if (check.bench_condition_id !== check.condition_id) {
      errors.push(`expectations ${checkPath} bench_condition_id must equal condition_id`);
    }
    if (isGenericCitation(check.datasheet_citation)) {
      errors.push(`expectations ${checkPath} datasheet_citation must identify a specific primary citation`);
    }
    if (hasPlaceholderLocator(check.citation_locator)) {
      errors.push(`expectations ${checkPath} citation_locator must identify a specific table row or figure curve/trace`);
    }
    if (!sameQualification(check.evidence_qualification, check.bench_qualification)) {
      errors.push(`expectations ${checkPath} bench qualification must match evidence qualification`);
    }
    if (check.evidence_qualification?.test_mode === "pulse" && check.bench_qualification?.test_mode === "continuous_dc") {
      errors.push(`expectations ${checkPath} pulse-qualified evidence cannot be claimed by a continuous DC bench`);
    }

    const cohort = cohorts.get(check.cohort_id);
    if (marked && !cohort) {
      errors.push(`expectations ${checkPath} references undeclared evidence cohort ${check.cohort_id}`);
    } else if (cohort && !cohort.evidence_ids?.includes(check.evidence_id)) {
      errors.push(`expectations ${checkPath} evidence_id is not a member of cohort ${check.cohort_id}`);
    }
  }

  if (marked) {
    for (const [cohortId] of cohorts) {
      if (!linkedChecks.some(({ check }) => check.cohort_id === cohortId)) {
        errors.push(`expectations F2 evidence cohort ${cohortId} must have at least one linked expectation`);
      }
    }
  }

  return errors;
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
      errors.push(...validateExpectationsDocument(expectations));
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
