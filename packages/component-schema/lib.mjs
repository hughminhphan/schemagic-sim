import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

function identityHash(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex")}`;
}

function conditionValues(condition, quantity) {
  if (quantity === "temperature") return [condition.temperature.value_c];
  const electrical = condition.electrical[quantity];
  if (electrical.kind === "fixed") return [electrical[`value_${quantity === "id" ? "a" : "v"}`]];
  if (electrical.kind === "range") return [electrical[`lower_${quantity === "id" ? "a" : "v"}`], electrical[`upper_${quantity === "id" ? "a" : "v"}`]];
  return [];
}

function collectFactsEvidence(facts) {
  const rows = [];
  const addDatum = (datum) => {
    if (datum?.condition_identity && datum?.citation_identity && datum?.evidence_identity) {
      rows.push({ condition: datum.condition_identity, citation: datum.citation_identity, evidence: datum.evidence_identity });
    }
  };
  for (const point of facts?.rdson_points ?? []) for (const datum of [point.vgs, point.current, point.resistance]) addDatum(datum);
  for (const field of ["minimum", "typical", "maximum"]) addDatum(facts?.threshold?.[field]);
  for (const curve of facts?.curves ?? []) for (const point of curve.points ?? []) {
    rows.push({ condition: curve.condition_identity, citation: curve.citation_identity, evidence: point.evidence_identity });
  }
  return rows;
}

function validateNewContractPackage(component, facts, fitted, modelText, expectations) {
  const errors = [];
  const evidence = collectFactsEvidence(facts);
  const byEvidenceId = new Map(evidence.map((row) => [row.evidence.evidence_id, row]));
  const region = component?.supported_operating_region;

  if (facts?.evidence_contract_version !== "1.0.0") errors.push("facts evidence_contract_version must be 1.0.0");
  if (fitted?.evidence_contract_version !== "1.0.0") errors.push("fitted evidence_contract_version must be 1.0.0");
  if (!evidence.length) errors.push("facts must contain resolvable evidence identities for a 1.0.0 contract package");

  const emitted = new Map();
  for (const match of modelText.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*([^\s(){}]+)/g)) {
    const value = Number(match[2]);
    if (Number.isFinite(value)) emitted.set(match[1], value);
  }
  for (const [name, expected] of Object.entries(fitted?.parameters ?? {})) {
    if (!Number.isFinite(Number(expected))) continue;
    if (!emitted.has(name)) errors.push(`model.cir is missing fitted parameter ${name}`);
    else {
      const actual = emitted.get(name);
      const expectedValue = Number(expected);
      const polarityMagnitude = component?.electrical_family === "pmos" && name === "VTO"
        && Math.abs(Math.abs(actual) - Math.abs(expectedValue)) <= 5e-10 * Math.max(1, Math.abs(expectedValue));
      if (!polarityMagnitude && Math.abs(actual - expectedValue) > 5e-10 * Math.max(1, Math.abs(expectedValue))) {
        errors.push(`model.cir parameter ${name} disagrees with fitted.json`);
      }
    }
  }

  for (const { check, path: checkPath } of expectationChecks(expectations)) {
    if (!check.evidence_id) continue;
    const resolved = byEvidenceId.get(check.evidence_id);
    if (!resolved || resolved.condition.condition_id !== check.condition_id || resolved.citation.citation_id !== check.citation_id || resolved.evidence.cohort_id !== check.cohort_id) {
      errors.push(`expectations ${checkPath} does not resolve to facts evidence`);
    }
  }

  for (const [group, rows] of [["calibration.observations", fitted?.calibration?.observations ?? []], ["calibration.constraints", fitted?.calibration?.constraints ?? []], ["residuals", fitted?.residuals ?? []]]) {
    for (const [index, row] of rows.entries()) {
      const linked = [
        ...(Array.isArray(row.evidence) && row.evidence.length ? row.evidence
          : Array.isArray(row.evidence_identities) ? row.evidence_identities.map((evidence_identity, evidenceIndex) => ({ condition_identity: row.condition_identity, citation_identity: row.citation_identities?.[evidenceIndex], evidence_identity }))
            : row.evidence_identity ? [{ condition_identity: row.condition_identity, citation_identity: row.citation_identity, evidence_identity: row.evidence_identity }] : []),
        ...(row.component_evidence ?? []).map((evidence_identity) => ({ condition_identity: row.condition_identity, citation_identity: row.citation_identity, evidence_identity })),
      ];
      for (const item of linked) {
        const resolved = byEvidenceId.get(item.evidence_identity?.evidence_id);
        if (!resolved || resolved.condition.condition_id !== item.condition_identity?.condition_id || resolved.citation.citation_id !== item.citation_identity?.citation_id) {
          errors.push(`fitted.${group}[${index}] does not resolve to facts evidence`);
        }
      }
    }
  }

  if (region?.contract_version !== "1.0.0") errors.push("component supported_operating_region.contract_version must be 1.0.0");
  if (!(region?.numeric_bounds?.length > 0)) errors.push("component supported_operating_region.numeric_bounds must be non-empty");
  for (const [index, bound] of (region?.numeric_bounds ?? []).entries()) {
    const label = `component supported_operating_region.numeric_bounds[${index}]`;
    for (const field of ["bound_id", "kind", "evidence_refs", "condition_ids", "citation_ids", "derivation"]) {
      if (bound[field] == null || (Array.isArray(bound[field]) && bound[field].length === 0)) errors.push(`${label}.${field} is required for contract 1.0.0`);
    }
    const referenced = [];
    for (const ref of bound.evidence_refs ?? []) {
      const resolved = byEvidenceId.get(ref.evidence_id);
      if (!resolved || resolved.condition.condition_id !== ref.condition_id || resolved.citation.citation_id !== ref.citation_id || resolved.evidence.cohort_id !== ref.cohort_id) {
        errors.push(`${label} evidence_refs do not resolve to facts`);
      } else referenced.push(resolved);
    }
    const conditionIds = [...new Set(referenced.map((row) => row.condition.condition_id))].sort();
    const citationIds = [...new Set(referenced.map((row) => row.citation.citation_id))].sort();
    if (JSON.stringify(bound.condition_ids) !== JSON.stringify(conditionIds) || JSON.stringify(bound.citation_ids) !== JSON.stringify(citationIds)) errors.push(`${label} identity sets disagree with evidence_refs`);
    const values = referenced.flatMap((row) => bound.quantity === "temperature" && row.condition.temperature.kind !== bound.temperature_kind ? [] : conditionValues(row.condition, bound.quantity));
    const covers = (value) => bound.kind === "enumerated" ? bound.values?.includes(value) : (bound.minimum == null || value >= bound.minimum - 1e-12) && (bound.maximum == null || value <= bound.maximum + 1e-12);
    if (values.some((value) => !covers(value))) errors.push(`${label} omits referenced evidence values`);
    if (bound.bound_id) {
      const material = Object.fromEntries(Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key)));
      if (bound.bound_id !== identityHash(material)) errors.push(`${label}.bound_id does not match canonical content`);
    }
  }
  return errors;
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
    if (["pulsed", "single_pulse"].includes(check.evidence_qualification?.test_mode)) {
      errors.push(`expectations ${checkPath} pulse-qualified evidence is unsupported without an implemented equivalent pulse bench`);
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
  let component = null;
  if (fs.existsSync(componentPath)) {
    const validation = validateComponentFiles(componentPath);
    component = validation.component;
    errors.push(...validation.errors);
  }

  const expectationsPath = path.join(absoluteDir, "tests", "expectations.json");
  let expectations = null;
  if (fs.existsSync(expectationsPath)) {
    try { expectations = readJson(expectationsPath); } catch { /* read diagnostics are emitted above */ }
  }
  const newContract = expectations?.evidence_contract_version === "1.0.0";
  if (newContract) {
    for (const relative of ["facts.json", "fitted.json"]) {
      const target = path.join(absoluteDir, relative);
      if (!fs.existsSync(target)) errors.push(`missing required package file for evidence contract 1.0.0: ${relative}`);
      else if (fs.statSync(target).size === 0) errors.push(`required package file is empty: ${relative}`);
    }
    const factsPath = path.join(absoluteDir, "facts.json");
    const fittedPath = path.join(absoluteDir, "fitted.json");
    const modelPath = path.join(absoluteDir, "model.cir");
    if (component && [factsPath, fittedPath, modelPath].every((target) => fs.existsSync(target))) {
      try {
        errors.push(...validateNewContractPackage(component, readJson(factsPath), readJson(fittedPath), fs.readFileSync(modelPath, "utf8"), expectations));
      } catch (error) {
        errors.push(`evidence contract package cannot be read: ${error.message}`);
      }
    }
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
