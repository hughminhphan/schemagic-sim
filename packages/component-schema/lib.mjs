import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  citationCohortMaterial,
  claimedIdentityMaterial,
  curveCohortMaterial,
  directEvidenceUnionErrors,
  curveIdentityMaterial,
  identityHash,
  operatingRegionBoundMaterial,
  pointEvidenceMaterial,
  scalarEvidenceMaterial,
  stableIdentityValue
} from "./evidence-identity.mjs";

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

function sameCanonicalContent(left, right) {
  return JSON.stringify(stableIdentityValue(left)) === JSON.stringify(stableIdentityValue(right));
}

function sameQualification(left, right) {
  return left?.test_mode === right?.test_mode
    && left?.pulse_width_s === right?.pulse_width_s
    && left?.duty_cycle === right?.duty_cycle;
}

function qualificationFromCondition(condition) {
  if (["pulsed", "single_pulse"].includes(condition?.test_mode?.kind)) {
    return {
      test_mode: condition.test_mode.kind,
      pulse_width_s: condition.test_mode.pulse_width_s,
      ...(condition.test_mode.duty_cycle == null ? {} : { duty_cycle: condition.test_mode.duty_cycle })
    };
  }
  return { test_mode: "continuous_dc" };
}

function locatorFromCitation(citation) {
  if (citation?.table) return { page: citation.page, table: citation.table, row: citation.row };
  if (citation?.figure) return { page: citation.page, figure: citation.figure, ...(citation.curve ? { curve: citation.curve } : { trace: citation.trace }) };
  return null;
}

function expectationRole(evidenceRole) {
  return evidenceRole === "minimum" ? "inclusive_minimum"
    : evidenceRole === "maximum" ? "inclusive_maximum"
      : evidenceRole === "digitized_typical_curve" ? "curve_point"
        : "typical_observation";
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
  const addDatum = (datum, label) => {
    if (datum?.condition_identity && datum?.citation_identity && datum?.evidence_identity) {
      rows.push({
        condition: datum.condition_identity,
        citation: datum.citation_identity,
        evidence: datum.evidence_identity,
        characteristic: datum.condition_identity.characteristic,
        quantity: datum.quantity,
        valueSi: datum.value,
        unitSi: datum.unit,
        label,
        kind: "scalar"
      });
    }
  };
  for (const [pointIndex, point] of (facts?.rdson_points ?? []).entries()) {
    for (const field of ["vgs", "current", "resistance"]) addDatum(point[field], `facts.rdson_points[${pointIndex}].${field}`);
  }
  for (const field of ["minimum", "typical", "maximum"]) addDatum(facts?.threshold?.[field], `facts.threshold.${field}`);
  for (const [curveIndex, curve] of (facts?.curves ?? []).entries()) for (const [pointIndex, point] of (curve.points ?? []).entries()) {
    rows.push({
      condition: curve.condition_identity,
      citation: curve.citation_identity,
      evidence: point.evidence_identity,
      characteristic: curve.characteristic,
      curve,
      point,
      label: `facts.curves[${curveIndex}].points[${pointIndex}]`,
      kind: "point"
    });
  }
  return rows;
}

function verifyClaimedIdentity(claimed, material, label, errors) {
  if (claimed !== identityHash(material)) errors.push(`${label} does not match canonical content`);
}

function verifyFactsIdentities(evidence) {
  const errors = [];
  const checkedConditions = new Set();
  const checkedCitations = new Set();
  const checkedCurves = new Set();
  const checkedCohortIds = new Set();
  const cohortMaterials = new Map();

  for (const row of evidence) {
    const conditionLabel = `${row.label}.condition_identity.condition_id`;
    if (!checkedConditions.has(row.condition)) {
      verifyClaimedIdentity(row.condition?.condition_id, claimedIdentityMaterial(row.condition ?? {}, "condition_id"), conditionLabel, errors);
      checkedConditions.add(row.condition);
    }
    const citationLabel = `${row.label}.citation_identity.citation_id`;
    if (!checkedCitations.has(row.citation)) {
      verifyClaimedIdentity(row.citation?.citation_id, claimedIdentityMaterial(row.citation ?? {}, "citation_id"), citationLabel, errors);
      checkedCitations.add(row.citation);
    }

    if (row.kind === "point") {
      if (!checkedCurves.has(row.curve)) {
        verifyClaimedIdentity(
          row.curve?.curve_id,
          curveIdentityMaterial(row.curve, row.condition.condition_id, row.citation.citation_id),
          `${row.label.replace(/\.points\[\d+\]$/, "")}.curve_id`,
          errors
        );
        checkedCurves.add(row.curve);
      }
      if (row.evidence?.point_index !== row.point?.point_index) errors.push(`${row.label}.evidence_identity.point_index disagrees with raw point`);
      if (row.evidence?.curve_id !== row.curve?.curve_id) errors.push(`${row.label}.evidence_identity.curve_id disagrees with enclosing curve`);
      if (row.evidence?.condition_id !== row.condition?.condition_id) errors.push(`${row.label}.evidence_identity.condition_id disagrees with enclosing curve`);
      if (row.evidence?.citation_id !== row.citation?.citation_id) errors.push(`${row.label}.evidence_identity.citation_id disagrees with enclosing curve`);
      if (row.evidence?.role !== "digitized_typical_curve") errors.push(`${row.label}.evidence_identity.role must be digitized_typical_curve for a curve point`);
      const cohortMaterial = curveCohortMaterial(row.characteristic, row.condition.condition_id, row.citation.citation_id, row.curve.curve_id);
      const cohortKey = JSON.stringify(stableIdentityValue(cohortMaterial));
      const previousCohortMaterial = cohortMaterials.get(row.evidence?.cohort_id);
      if (previousCohortMaterial && previousCohortMaterial !== cohortKey) errors.push(`${row.label}.evidence_identity.cohort_id is reused for different canonical content`);
      cohortMaterials.set(row.evidence?.cohort_id, cohortKey);
      if (!checkedCohortIds.has(row.evidence?.cohort_id)) {
        verifyClaimedIdentity(row.evidence?.cohort_id, cohortMaterial, `${row.label}.evidence_identity.cohort_id`, errors);
        checkedCohortIds.add(row.evidence?.cohort_id);
      }
      verifyClaimedIdentity(row.evidence?.evidence_id, pointEvidenceMaterial(row.characteristic, row.point, row.evidence), `${row.label}.evidence_identity.evidence_id`, errors);
    } else {
      const cohortMaterial = citationCohortMaterial(row.characteristic, row.condition.condition_id, row.citation);
      const cohortKey = JSON.stringify(stableIdentityValue(cohortMaterial));
      const previousCohortMaterial = cohortMaterials.get(row.evidence?.cohort_id);
      if (previousCohortMaterial && previousCohortMaterial !== cohortKey) errors.push(`${row.label}.evidence_identity.cohort_id is reused for different canonical content`);
      cohortMaterials.set(row.evidence?.cohort_id, cohortKey);
      if (!checkedCohortIds.has(row.evidence?.cohort_id)) {
        verifyClaimedIdentity(row.evidence?.cohort_id, cohortMaterial, `${row.label}.evidence_identity.cohort_id`, errors);
        checkedCohortIds.add(row.evidence?.cohort_id);
      }
      verifyClaimedIdentity(
        row.evidence?.evidence_id,
        scalarEvidenceMaterial(row.characteristic, row.evidence, row.quantity, row.valueSi, row.unitSi),
        `${row.label}.evidence_identity.evidence_id`,
        errors
      );
    }
  }
  return errors;
}

function sourceContractErrors(component, sources, evidence) {
  const errors = [];
  const byHash = new Map();
  for (const [index, source] of (sources ?? []).entries()) {
    const rows = byHash.get(source.sha256) ?? [];
    rows.push({ source, index });
    byHash.set(source.sha256, rows);
  }
  for (const row of evidence) {
    const matches = byHash.get(row.citation?.source_sha256) ?? [];
    if (matches.length !== 1) errors.push(`${row.label}.citation_identity.source_sha256 must resolve exactly once in sources.json`);
    else if (row.citation?.source_revision != null && row.citation.source_revision !== matches[0].source.revision) {
      errors.push(`${row.label}.citation_identity.source_revision disagrees with sources.json`);
    }
  }
  const datasheetMatches = (sources ?? []).filter((source) => source.kind === "datasheet" && source.url === component?.datasheet?.url);
  if (datasheetMatches.length !== 1) errors.push("component datasheet.url must resolve exactly once to a datasheet source");
  else if (component?.datasheet?.revision !== datasheetMatches[0].revision) errors.push("component datasheet.revision disagrees with sources.json");
  return errors;
}

function expectationEvidenceSemantics(check, resolved, checkPath, errors) {
  const expectedValue = resolved.kind === "point" ? resolved.point?.y_si : resolved.valueSi;
  const expectedUnit = resolved.kind === "point" ? resolved.curve?.y_axis?.unit : resolved.unitSi;
  if (Object.hasOwn(check, "expected_value") && check.expected_value !== expectedValue) errors.push(`expectations ${checkPath} expected_value disagrees with facts evidence`);
  if (Object.hasOwn(check, "minimum") && resolved.evidence?.role === "minimum" && check.minimum !== expectedValue) errors.push(`expectations ${checkPath} minimum disagrees with facts evidence`);
  if (Object.hasOwn(check, "maximum") && resolved.evidence?.role === "maximum" && check.maximum !== expectedValue) errors.push(`expectations ${checkPath} maximum disagrees with facts evidence`);
  if (check.unit !== expectedUnit) errors.push(`expectations ${checkPath} unit disagrees with facts evidence`);

  const expression = String(check.expression_source?.expression ?? "").toLowerCase();
  const characteristic = resolved.characteristic;
  const quantityMatches = ["transfer_current", "output_current"].includes(characteristic) ? /\bi\s*\(/.test(expression)
    : characteristic === "gate_threshold" ? /\bv\s*\(/.test(expression) && !/\bi\s*\(/.test(expression)
      : characteristic === "rds_on" ? /scale_abs:/.test(expression)
        : true;
  if (!quantityMatches) errors.push(`expectations ${checkPath} expression quantity disagrees with bench metric semantics`);
  if (resolved.kind === "point" && resolved.curve?.y_axis?.quantity !== "id") errors.push(`expectations ${checkPath} quantity disagrees with bench metric semantics`);
}

function residualCalibrationErrors(fitted) {
  const errors = [];
  const records = [...(fitted?.calibration?.observations ?? []), ...(fitted?.calibration?.constraints ?? [])];
  const primaryEvidenceId = (row) => row?.evidence_identity?.evidence_id;
  for (const [index, residual] of (fitted?.residuals ?? []).entries()) {
    const matches = records.filter((record) => primaryEvidenceId(record) === primaryEvidenceId(residual));
    const label = `fitted.residuals[${index}]`;
    if (matches.length !== 1) {
      errors.push(`${label} must resolve exactly once to a declared calibration record`);
      continue;
    }
    const record = matches[0];
    for (const field of ["quantity", "gate_quantity", "datasheet_value", "unit"]) {
      if (residual[field] !== record[field]) errors.push(`${label}.${field} disagrees with its declared calibration record`);
    }
    for (const [field, nested] of [["condition_identity", "condition_id"], ["citation_identity", "citation_id"], ["evidence_identity", "evidence_id"]]) {
      if (residual[field]?.[nested] !== record[field]?.[nested]) errors.push(`${label}.${field}.${nested} disagrees with its declared calibration record`);
    }
  }
  return errors;
}

function fittedEvidenceSemantics(row, item, resolved, group, index, itemLabel, errors) {
  if (group !== "residuals" || item.evidence_identity?.evidence_id !== row.evidence_identity?.evidence_id) return;
  const expectedQuantity = resolved.kind === "point" ? resolved.curve?.y_axis?.quantity : resolved.quantity;
  const expectedValue = resolved.kind === "point" ? resolved.point?.y_si : resolved.valueSi;
  const expectedUnit = resolved.kind === "point" ? resolved.curve?.y_axis?.unit : resolved.unitSi;
  const gateQuantity = resolved.characteristic === "rds_on" ? "rds_on"
    : resolved.characteristic === "transfer_current" || resolved.characteristic === "output_current" ? "drain_current"
      : resolved.characteristic;
  if (row.datasheet_value !== expectedValue) errors.push(`${itemLabel}.datasheet_value disagrees with referenced evidence`);
  if (row.unit !== expectedUnit) errors.push(`${itemLabel}.unit disagrees with referenced evidence`);
  if (row.gate_quantity !== gateQuantity) errors.push(`${itemLabel}.gate_quantity disagrees with referenced evidence quantity`);
  if (resolved.kind === "point" && !String(row.quantity ?? "").toLowerCase().includes(resolved.characteristic === "transfer_current" ? "transfer current" : "output current")) {
    errors.push(`${itemLabel}.quantity disagrees with referenced evidence characteristic`);
  }
  if (resolved.kind === "scalar" && resolved.characteristic === "rds_on" && !/rds\s*\(?on\)?/i.test(String(row.quantity ?? ""))) {
    errors.push(`${itemLabel}.quantity disagrees with referenced evidence characteristic`);
  }
  const declared = (group === "residuals" ? row : null);
  if (!declared || !Number.isFinite(Number(declared.fitted_value))) errors.push(`${itemLabel}.fitted_value must declare the calibrated model observation`);
}

function validateNewContractPackage(component, facts, fitted, modelText, expectations, sources) {
  const errors = [];
  const evidence = collectFactsEvidence(facts);
  const region = component?.supported_operating_region;

  if (facts?.evidence_contract_version !== "1.0.0") errors.push("facts evidence_contract_version must be 1.0.0");
  if (fitted?.evidence_contract_version !== "1.0.0") errors.push("fitted evidence_contract_version must be 1.0.0");
  if (!evidence.length) errors.push("facts must contain resolvable evidence identities for a 1.0.0 contract package");
  errors.push(...verifyFactsIdentities(evidence));
  errors.push(...sourceContractErrors(component, sources, evidence));
  const byEvidenceId = new Map(evidence.map((row) => [row.evidence.evidence_id, row]));
  errors.push(...residualCalibrationErrors(fitted));

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
      if (component?.electrical_family === "pmos" && name === "VTO") {
        if (!(actual < 0)) errors.push("model.cir PMOS VTO must be negative");
        if (Math.abs(Math.abs(actual) - Math.abs(expectedValue)) > 5e-10 * Math.max(1, Math.abs(expectedValue))) {
          errors.push("model.cir parameter VTO magnitude disagrees with fitted.json");
        }
      } else if (Math.abs(actual - expectedValue) > 5e-10 * Math.max(1, Math.abs(expectedValue))) {
        errors.push(`model.cir parameter ${name} disagrees with fitted.json`);
      }
    }
  }

  for (const { check, path: checkPath } of expectationChecks(expectations)) {
    if (!check.evidence_id) continue;
    const resolved = byEvidenceId.get(check.evidence_id);
    if (!resolved || resolved.condition.condition_id !== check.condition_id || resolved.citation.citation_id !== check.citation_id || resolved.evidence.cohort_id !== check.cohort_id) {
      errors.push(`expectations ${checkPath} does not resolve to facts evidence`);
      continue;
    }
    if (check.evidence_role !== expectationRole(resolved.evidence.role)) errors.push(`expectations ${checkPath} evidence_role disagrees with facts evidence`);
    if (!sameCanonicalContent(check.citation_locator, locatorFromCitation(resolved.citation))) errors.push(`expectations ${checkPath} citation_locator disagrees with facts citation`);
    if (!sameQualification(check.evidence_qualification, qualificationFromCondition(resolved.condition))) errors.push(`expectations ${checkPath} evidence_qualification disagrees with facts condition`);
    expectationEvidenceSemantics(check, resolved, checkPath, errors);
  }

  for (const [group, rows] of [["calibration.observations", fitted?.calibration?.observations ?? []], ["calibration.constraints", fitted?.calibration?.constraints ?? []], ["residuals", fitted?.residuals ?? []]]) {
    for (const [index, row] of rows.entries()) {
      const linked = Array.isArray(row.evidence) && row.evidence.length ? row.evidence
        : Array.isArray(row.evidence_identities) ? row.evidence_identities.map((evidence_identity, evidenceIndex) => ({ condition_identity: row.condition_identity, citation_identity: row.citation_identities?.[evidenceIndex], evidence_identity }))
          : row.evidence_identity ? [{ condition_identity: row.condition_identity, citation_identity: row.citation_identity, evidence_identity: row.evidence_identity }] : [];
      for (const [evidenceIndex, item] of linked.entries()) {
        const itemLabel = `fitted.${group}[${index}]${linked.length > 1 ? `.evidence[${evidenceIndex}]` : ""}`;
        verifyClaimedIdentity(item.condition_identity?.condition_id, claimedIdentityMaterial(item.condition_identity ?? {}, "condition_id"), `${itemLabel}.condition_identity.condition_id`, errors);
        verifyClaimedIdentity(item.citation_identity?.citation_id, claimedIdentityMaterial(item.citation_identity ?? {}, "citation_id"), `${itemLabel}.citation_identity.citation_id`, errors);
        const resolved = byEvidenceId.get(item.evidence_identity?.evidence_id);
        if (!resolved || resolved.condition.condition_id !== item.condition_identity?.condition_id || resolved.citation.citation_id !== item.citation_identity?.citation_id
          || !sameCanonicalContent(item.evidence_identity, resolved.evidence)) {
          errors.push(`${itemLabel} does not resolve to facts evidence`);
        } else {
          fittedEvidenceSemantics(row, item, resolved, group, index, itemLabel, errors);
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
    errors.push(...directEvidenceUnionErrors(bound, values, label));
    if (bound.bound_id) {
      if (bound.bound_id !== identityHash(operatingRegionBoundMaterial(bound))) errors.push(`${label}.bound_id does not match canonical content`);
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
    for (const [cohortId, cohort] of cohorts) {
      const linkedEvidenceIds = [...new Set(linkedChecks.filter(({ check }) => check.cohort_id === cohortId).map(({ check }) => check.evidence_id))].sort();
      if (!linkedEvidenceIds.length) {
        errors.push(`expectations F2 evidence cohort ${cohortId} must have at least one linked expectation`);
      } else if (JSON.stringify([...cohort.evidence_ids].sort()) !== JSON.stringify(linkedEvidenceIds)) {
        errors.push(`expectations F2 evidence cohort ${cohortId} membership must exactly match linked expectations`);
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
  let sources = null;

  try {
    component = readJson(absoluteComponentPath);
    errors.push(...schemaErrors("component", validators.component, component));
  } catch (error) {
    return { errors: [`component cannot be read: ${error.message}`], component: null };
  }

  if (fs.existsSync(sourcesPath)) {
    try {
      sources = readJson(sourcesPath);
      errors.push(...schemaErrors("sources", validators.sources, sources));
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

  return { errors, component, expectations, sources };
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
  let sources = null;
  if (fs.existsSync(componentPath)) {
    const validation = validateComponentFiles(componentPath);
    component = validation.component;
    sources = validation.sources;
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
        errors.push(...validateNewContractPackage(component, readJson(factsPath), readJson(fittedPath), fs.readFileSync(modelPath, "utf8"), expectations, sources));
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
