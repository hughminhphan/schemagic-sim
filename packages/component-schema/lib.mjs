import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  activeVdmosModelCard,
  citationCohortMaterial,
  claimedIdentityMaterial,
  curveCohortMaterial,
  directEvidenceIntersectionErrors,
  directEvidenceUnionErrors,
  curveIdentityMaterial,
  identityHash,
  operatingRegionBoundMaterial,
  pointEvidenceMaterial,
  scalarEvidenceMaterial,
  stableIdentityValue,
  summarizeMosfetResiduals
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

function conditionDomain(condition, quantity, temperatureKind = null) {
  if (quantity === "temperature") {
    return condition.temperature.kind === temperatureKind
      ? { minimum: condition.temperature.value_c, maximum: condition.temperature.value_c }
      : null;
  }
  const electrical = condition.electrical[quantity];
  if (electrical.kind === "fixed") {
    const value = electrical[`value_${quantity === "id" ? "a" : "v"}`];
    return { minimum: value, maximum: value };
  }
  if (electrical.kind === "range") return {
    minimum: electrical[`lower_${quantity === "id" ? "a" : "v"}`],
    maximum: electrical[`upper_${quantity === "id" ? "a" : "v"}`]
  };
  if (electrical.kind === "enumerated") return { values: electrical.values };
  return null;
}

function conditionValues(condition, quantity, temperatureKind = null) {
  const domain = conditionDomain(condition, quantity, temperatureKind);
  return domain ? domain.values ?? [domain.minimum, domain.maximum] : [];
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

function sourceContractErrors(component, facts, sources, evidence) {
  const errors = [];
  const datasheetSources = (sources ?? []).filter((source) => source.kind === "datasheet");
  const matches = datasheetSources.filter((source) => source.url === component?.datasheet?.url);
  if (matches.length !== 1) {
    errors.push("component datasheet.url must resolve exactly once to a datasheet source");
    return errors;
  }
  const datasheet = matches[0];
  const selectedHashMatches = datasheetSources.filter((source) => source.sha256 === datasheet.sha256);
  if (selectedHashMatches.length !== 1) errors.push("selected datasheet SHA-256 must resolve exactly once in sources.json");
  if (component?.datasheet?.revision !== datasheet.revision) errors.push("component datasheet.revision disagrees with sources.json");
  const factsSource = facts?.source;
  if (!factsSource || factsSource.url !== datasheet.url || factsSource.sha256 !== datasheet.sha256 || factsSource.revision !== datasheet.revision) {
    errors.push("facts.source URL, SHA-256, and revision must exactly match the component datasheet source in sources.json");
  }
  const checkedCitationIds = new Set();
  for (const row of evidence) {
    if (checkedCitationIds.has(row.citation?.citation_id)) continue;
    checkedCitationIds.add(row.citation?.citation_id);
    if (row.citation?.source_sha256 !== datasheet.sha256) {
      errors.push(`${row.label}.citation_identity.source_sha256 must resolve to the same datasheet source in sources.json`);
    }
    if (row.citation?.source_revision != null && row.citation.source_revision !== datasheet.revision) {
      errors.push(`${row.label}.citation_identity.source_revision disagrees with sources.json`);
    }
  }
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

function residualCalibrationErrors(fitted, fidelityTier) {
  const errors = [];
  const observations = fitted?.calibration?.observations ?? [];
  const constraints = fitted?.calibration?.constraints ?? [];
  const records = [...observations, ...constraints];
  const residuals = fitted?.residuals ?? [];
  const primaryEvidenceId = (row) => row?.evidence_identity?.evidence_id;
  const sameCalibrationRecord = (left, right) =>
    primaryEvidenceId(left) === primaryEvidenceId(right)
    && left?.evidence_role === right?.evidence_role;
  const targetCount = fitted?.calibration?.residual_target_count;
  if (!Number.isInteger(targetCount) || targetCount < 0) {
    errors.push("fitted.calibration.residual_target_count must be a non-negative integer");
  } else if (fidelityTier === "F2") {
    const observationResidualCount = residuals.filter((residual) => observations.some((observation) => sameCalibrationRecord(observation, residual))).length;
    if (targetCount !== observations.length) errors.push("fitted.calibration.residual_target_count must equal the declared calibration observation count");
    if (targetCount !== observationResidualCount) errors.push("fitted.calibration.residual_target_count must equal the observation-linked residual row count");
  }
  for (const [index, residual] of residuals.entries()) {
    const matches = records.filter((record) => sameCalibrationRecord(record, residual));
    const label = `fitted.residuals[${index}]`;
    if (matches.length !== 1) {
      errors.push(`${label} must resolve exactly once to a declared calibration record`);
      continue;
    }
    const record = matches[0];
    for (const field of ["quantity", "gate_quantity", "datasheet_value", "unit", "evidence_role"]) {
      if (residual[field] !== record[field]) errors.push(`${label}.${field} disagrees with its declared calibration record`);
    }
    for (const [field, nested] of [["condition_identity", "condition_id"], ["citation_identity", "citation_id"], ["evidence_identity", "evidence_id"]]) {
      if (residual[field]?.[nested] !== record[field]?.[nested]) errors.push(`${label}.${field}.${nested} disagrees with its declared calibration record`);
    }
  }
  if (fidelityTier === "F2") for (const [index, observation] of observations.entries()) {
    const matches = residuals.filter((residual) => sameCalibrationRecord(residual, observation));
    if (matches.length !== 1) errors.push(`fitted.calibration.observations[${index}] must resolve exactly once to a residual row`);
  }
  return errors;
}

function mosfetResidualSummaryErrors(component, fitted, fidelityTier) {
  if (!["nmos", "pmos"].includes(component?.electrical_family) || fidelityTier !== "F2") return [];
  const errors = [];
  const summary = summarizeMosfetResiduals(fitted?.residuals);
  if (!summary.worst || !Number.isFinite(summary.rms)) return ["fitted F2 MOSFET residual summary requires finite residual rows"];
  const same = (left, right) => Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) <= 1e-12 * Math.max(1, Math.abs(Number(left)), Math.abs(Number(right)));
  for (const [index, item] of summary.rows.entries()) {
    if (!same(fitted.residuals[index].relative_error, item.relativeError)) errors.push(`fitted.residuals[${index}].relative_error disagrees with datasheet and fitted values`);
  }
  const declaredRms = fitted.rms_relative_error ?? fitted.rms;
  if (!same(declaredRms, summary.rms)) errors.push("fitted RMS relative error disagrees with recomputed residuals");
  const declaredWorst = fitted.worst_relative_error ?? fitted.worst;
  if (!same(declaredWorst?.value, summary.worst.relativeError) || declaredWorst?.quantity !== summary.worst.row.quantity) {
    errors.push("fitted worst relative error value and quantity disagree with recomputed residuals");
  }
  const declaredGate = fitted.gate?.pass ?? fitted.gate?.passed ?? fitted.f2_gate_pass;
  if (typeof declaredGate !== "boolean") errors.push("fitted F2 MOSFET gate result must be declared");
  else if (declaredGate !== summary.gatePass) errors.push("fitted F2 MOSFET gate result disagrees with recomputed 0.20 worst and 0.12 RMS quantity gates");
  if (!summary.gatePass) errors.push("fitted F2 MOSFET residuals fail the 0.20 worst and 0.12 RMS quantity gates");
  return errors;
}

function canonicalCalibrationQuantity(resolved) {
  if (resolved.kind === "point") return resolved.characteristic === "transfer_current" ? "transfer current" : "output current";
  if (resolved.characteristic === "rds_on") return "rds_on";
  if (resolved.characteristic === "gate_threshold") return "gate_threshold";
  return resolved.characteristic;
}

function canonicalGateQuantity(resolved) {
  return resolved.characteristic === "rds_on" ? "rds_on"
    : ["transfer_current", "output_current"].includes(resolved.characteristic) ? "drain_current"
      : resolved.characteristic;
}

function itemSemanticFields(item) {
  return {
    quantity: item?.quantity,
    value: Object.hasOwn(item ?? {}, "value_si") ? item.value_si
      : Object.hasOwn(item ?? {}, "datasheet_value") ? item.datasheet_value
        : Object.hasOwn(item ?? {}, "value") ? item.value : undefined,
    unit: item?.unit_si ?? item?.unit,
    role: item?.evidence_role ?? item?.role
  };
}

function roleMatchesEvidence(role, evidenceRole) {
  const accepted = new Set([
    evidenceRole,
    expectationRole(evidenceRole),
    evidenceRole === "digitized_typical_curve" ? "typical_observation" : null,
    ["minimum", "maximum"].includes(evidenceRole) ? "inequality_constraint" : null
  ]);
  return role == null || accepted.has(role);
}

function fittedEvidenceSemantics(row, item, resolved, group, itemLabel, errors) {
  const expectedValue = resolved.kind === "point" ? resolved.point?.y_si : resolved.valueSi;
  const expectedUnit = resolved.kind === "point" ? resolved.curve?.y_axis?.unit : resolved.unitSi;
  const expectedQuantity = resolved.kind === "point" ? resolved.curve?.y_axis?.quantity : resolved.quantity;
  const itemFields = itemSemanticFields(item);
  if (itemFields.quantity != null && itemFields.quantity !== expectedQuantity) errors.push(`${itemLabel}.quantity disagrees with referenced evidence`);
  if (itemFields.value != null && itemFields.value !== expectedValue) errors.push(`${itemLabel}.datasheet value disagrees with referenced evidence`);
  if (itemFields.unit != null && itemFields.unit !== expectedUnit) errors.push(`${itemLabel}.unit disagrees with referenced evidence`);
  if (!roleMatchesEvidence(itemFields.role, resolved.evidence?.role)) errors.push(`${itemLabel}.role disagrees with referenced evidence`);

  if (item.evidence_identity?.evidence_id !== row.evidence_identity?.evidence_id) return;
  const expectedRecordQuantity = canonicalCalibrationQuantity(resolved);
  if (row.datasheet_value != null && row.datasheet_value !== expectedValue) errors.push(`${itemLabel}.datasheet_value disagrees with referenced evidence`);
  if (row.value != null && row.value !== expectedValue) errors.push(`${itemLabel}.value disagrees with referenced evidence`);
  if (row.unit !== expectedUnit) errors.push(`${itemLabel}.unit disagrees with referenced evidence`);
  if (row.gate_quantity != null && row.gate_quantity !== canonicalGateQuantity(resolved)) errors.push(`${itemLabel}.gate_quantity disagrees with referenced evidence quantity`);
  const quantityText = String(row.quantity ?? "").toLowerCase().replaceAll("_", " ");
  const recordQuantityMatches = resolved.characteristic === "rds_on" ? /rds|rdson/i.test(quantityText)
    : quantityText.includes(expectedRecordQuantity.replaceAll("_", " "));
  if (row.quantity != null && !recordQuantityMatches) errors.push(`${itemLabel}.quantity disagrees with referenced evidence characteristic`);
  if (!roleMatchesEvidence(row.evidence_role ?? row.role, resolved.evidence?.role)) errors.push(`${itemLabel}.role disagrees with referenced evidence`);
  if (group === "residuals" && !Number.isFinite(Number(row.fitted_value))) errors.push(`${itemLabel}.fitted_value must declare the calibrated model observation`);
}

function validateMosfetChannelCard(component, modelText) {
  if (!["nmos", "pmos"].includes(component?.electrical_family)) return [];
  try {
    const card = activeVdmosModelCard(modelText);
    const vto = card.parameters.get("VTO");
    if (component.electrical_family === "pmos") {
      if (!card.pchan) return ["active DUT VDMOS model card must declare pchan exactly for electrical_family pmos"];
      if (!(vto < 0)) return ["active DUT VDMOS model card PMOS VTO must be negative"];
    } else {
      if (card.pchan) return ["active DUT VDMOS model card must not declare pchan for electrical_family nmos"];
      if (!(vto > 0)) return ["active DUT VDMOS model card NMOS VTO must be positive"];
    }
    return [];
  } catch (error) {
    return [error.message];
  }
}

function vdmosCardSignature(text, modelName, label) {
  const active = String(text).split(/\r?\n/)
    .filter((line) => !/^\s*\*/.test(line))
    .map((line) => line.replace(/\s+\$.*$/, ""))
    .join("\n");
  const cards = [...active.matchAll(/^\s*\.model\s+(\S+)\s+VDMOS\s*\(([^)]*)\)/gim)]
    .filter((match) => match[1].toLowerCase() === modelName.toLowerCase());
  if (cards.length !== 1) throw new Error(`${label} must resolve exactly one active model ${modelName} card`);
  return cards[0][2].trim().replace(/\s+/g, " ").toLowerCase();
}

function parseGeneratedMosfetBench(text, label, activeModelName, activeModelSignature) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("*"));
  if (lines.some((line) => /^\.(?:include|lib)\b/i.test(line))) {
    throw new Error(`${label} generated MOSFET bench must not load .include or .lib model definitions`);
  }
  const temperatures = lines.filter((line) => /^\.temp\b/i.test(line));
  if (temperatures.length !== 1) throw new Error(`${label} must declare exactly one .temp directive`);
  const tempTokens = temperatures[0].split(/\s+/);
  if (tempTokens.length !== 2 || !Number.isFinite(Number(tempTokens[1]))) throw new Error(`${label} has an unsupported .temp directive`);
  const analyses = lines.filter((line) => /^\.(?:op|dc|ac|tran)\b/i.test(line));
  if (analyses.length !== 1 || !/^\.op$/i.test(analyses[0])) throw new Error(`${label} linked MOSFET evidence supports only the generated .op bench grammar`);
  const modelNames = lines.flatMap((line) => {
    const match = /^\.model\s+(\S+)\b/i.exec(line);
    return match ? [match[1]] : [];
  });
  if (modelNames.filter((name) => name.toLowerCase() === activeModelName.toLowerCase()).length !== 1) {
    throw new Error(`${label} must embed exactly one authoritative active model ${activeModelName} card`);
  }
  if (vdmosCardSignature(text, activeModelName, label) !== activeModelSignature) {
    throw new Error(`${label} embedded active model ${activeModelName} card must exactly match model.cir`);
  }
  const sources = new Map();
  const mosfets = [];
  for (const line of lines) {
    let match = /^([VI]\S*)\s+(\S+)\s+(\S+)\s+DC\s+(\S+)$/i.exec(line);
    if (match) {
      const value = Number(match[4]);
      if (!Number.isFinite(value)) throw new Error(`${label} source ${match[1]} has a non-fixed or non-numeric DC value`);
      sources.set(match[1].toLowerCase(), { name: match[1], positive: match[2].toLowerCase(), negative: match[3].toLowerCase(), value });
      continue;
    }
    match = /^(M\S*)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/i.exec(line);
    if (match) mosfets.push({ name: match[1], drain: match[2].toLowerCase(), gate: match[3].toLowerCase(), source: match[4].toLowerCase(), model: match[5] });
  }
  return { temperature: Number(tempTokens[1]), sources, mosfets };
}

function validateLinkedMosfetBenches(component, packageDir, expectations, byEvidenceId, activeModelName, modelText) {
  if (!["nmos", "pmos"].includes(component?.electrical_family)) return [];
  const errors = [];
  let activeModelSignature;
  try { activeModelSignature = vdmosCardSignature(modelText, activeModelName, "model.cir"); }
  catch (error) { return [error.message]; }
  const sign = component.electrical_family === "pmos" ? -1 : 1;
  const same = (left, right) => Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) <= 1e-12 * Math.max(1, Math.abs(Number(left)), Math.abs(Number(right)));
  const assertVoltage = (bench, node, expected, label) => {
    const source = [...bench.sources.values()].find((candidate) => candidate.positive === node && candidate.negative === "0");
    if (!source || !same(source.value, sign * expected)) throw new Error(`${label} does not encode the exact ${component.electrical_family.toUpperCase()} voltage bias`);
  };
  const assertCurrent = (bench, node, expected, label) => {
    const source = [...bench.sources.values()].find((candidate) => component.electrical_family === "pmos"
      ? candidate.positive === node && candidate.negative === "0"
      : candidate.positive === "0" && candidate.negative === node);
    if (!source || !same(Math.abs(source.value), Math.abs(expected))) throw new Error(`${label} does not encode the exact ${component.electrical_family.toUpperCase()} drain-current bias`);
  };
  for (const [testIndex, test] of (expectations?.tests ?? []).entries()) {
    const linked = [...(test.scalar_checks ?? []), ...(test.hard_bounds_checks ?? [])].filter((check) => check.evidence_id);
    if (!linked.length || !linked.some((check) => ["transfer_current", "output_current", "rds_on", "gate_threshold"].includes(byEvidenceId.get(check.evidence_id)?.characteristic))) continue;
    const label = `tests[${testIndex}] ${test.test_netlist}`;
    if (test.analysis_type !== "operating_point") {
      errors.push(`${label} linked MOSFET condition cannot be represented outside the generated operating-point grammar`);
      continue;
    }
    let bench;
    try { bench = parseGeneratedMosfetBench(fs.readFileSync(path.join(packageDir, "tests", test.test_netlist), "utf8"), label, activeModelName, activeModelSignature); }
    catch (error) { errors.push(error.message); continue; }
    for (const check of linked) {
      const resolved = byEvidenceId.get(check.evidence_id);
      if (!resolved) continue;
      const condition = resolved.condition;
      const checkLabel = `${label} check ${check.name}`;
      if (!["dc", "continuous"].includes(condition.test_mode.kind)) {
        errors.push(`${checkLabel} condition cannot be represented by a static generated bench`);
        continue;
      }
      if (!same(bench.temperature, condition.temperature.value_c)) errors.push(`${checkLabel} .temp disagrees with condition identity`);
      try {
        const expression = String(check.expression_source?.expression ?? "").toLowerCase();
        if (["transfer_current", "output_current"].includes(resolved.characteristic)) {
          const branch = /i\(([^)]+)\)/.exec(expression)?.[1];
          const drainSource = branch ? bench.sources.get(branch) : null;
          if (!drainSource || drainSource.negative !== "0") throw new Error(`${checkLabel} does not reference a generated drain-voltage source`);
          const transistor = bench.mosfets.find((candidate) => candidate.drain === drainSource.positive && candidate.source === "0");
          if (!transistor) throw new Error(`${checkLabel} has no generated DUT instance for its drain source`);
          if (transistor.model.toLowerCase() !== activeModelName.toLowerCase()) throw new Error(`${checkLabel} generated DUT instance must use active model ${activeModelName}`);
          const vds = resolved.characteristic === "transfer_current" ? condition.electrical.vds?.value_v : resolved.point.x_si;
          const vgs = resolved.characteristic === "transfer_current" ? resolved.point.x_si : condition.electrical.vgs?.value_v;
          if (condition.electrical[resolved.characteristic === "transfer_current" ? "vds" : "vgs"]?.kind !== "fixed") throw new Error(`${checkLabel} linked curve condition lacks the required fixed bias`);
          if (!same(drainSource.value, sign * vds)) throw new Error(`${checkLabel} drain-source bias disagrees with condition identity`);
          assertVoltage(bench, transistor.gate, vgs, checkLabel);
        } else if (resolved.characteristic === "rds_on") {
          const node = /v\(([^)]+)\)/.exec(expression)?.[1];
          const transistor = bench.mosfets.find((candidate) => candidate.drain === node && candidate.source === "0");
          if (!transistor || condition.electrical.vgs.kind !== "fixed" || condition.electrical.id.kind !== "fixed") throw new Error(`${checkLabel} cannot represent the linked RDS(on) condition`);
          if (transistor.model.toLowerCase() !== activeModelName.toLowerCase()) throw new Error(`${checkLabel} generated DUT instance must use active model ${activeModelName}`);
          assertVoltage(bench, transistor.gate, condition.electrical.vgs.value_v, checkLabel);
          assertCurrent(bench, transistor.drain, condition.electrical.id.value_a, checkLabel);
        } else if (resolved.characteristic === "gate_threshold") {
          const node = /v\(([^)]+)\)/.exec(expression)?.[1];
          const transistor = bench.mosfets.find((candidate) => candidate.drain === node && candidate.gate === node && candidate.source === "0");
          if (!transistor || condition.electrical.vds?.relation !== "vds_equals_vgs" || condition.electrical.id.kind !== "fixed") throw new Error(`${checkLabel} cannot represent the linked threshold condition`);
          if (transistor.model.toLowerCase() !== activeModelName.toLowerCase()) throw new Error(`${checkLabel} generated DUT instance must use active model ${activeModelName}`);
          assertCurrent(bench, node, condition.electrical.id.value_a, checkLabel);
        } else throw new Error(`${checkLabel} uses unsupported linked MOSFET bench semantics`);
      } catch (error) { errors.push(error.message); }
    }
  }
  return errors;
}

function validateNewContractPackage(component, facts, fitted, modelText, expectations, sources, packageDir) {
  const errors = [];
  const evidence = collectFactsEvidence(facts);
  const region = component?.supported_operating_region;

  if (component?.evidence_contract_version !== "1.0.0") errors.push("component evidence_contract_version must be 1.0.0");
  if (facts?.evidence_contract_version !== "1.0.0") errors.push("facts evidence_contract_version must be 1.0.0");
  if (fitted?.evidence_contract_version !== "1.0.0") errors.push("fitted evidence_contract_version must be 1.0.0");
  if (!evidence.length) errors.push("facts must contain resolvable evidence identities for a 1.0.0 contract package");
  errors.push(...verifyFactsIdentities(evidence));
  errors.push(...sourceContractErrors(component, facts, sources, evidence));
  errors.push(...validateMosfetChannelCard(component, modelText));
  const byEvidenceId = new Map(evidence.map((row) => [row.evidence.evidence_id, row]));
  let activeModelName = null;
  if (["nmos", "pmos"].includes(component?.electrical_family)) {
    try { activeModelName = activeVdmosModelCard(modelText).name; } catch { /* channel-card validation emits the diagnostic */ }
  }
  if (activeModelName) errors.push(...validateLinkedMosfetBenches(component, packageDir, expectations, byEvidenceId, activeModelName, modelText));
  const fidelityTier = component?.fidelity_tier;
  if (fitted?.fidelity_tier !== fidelityTier) errors.push("fitted.fidelity_tier must exactly equal component.fidelity_tier");
  errors.push(...residualCalibrationErrors(fitted, fidelityTier));
  errors.push(...mosfetResidualSummaryErrors(component, fitted, fidelityTier));

  const emitted = ["nmos", "pmos"].includes(component?.electrical_family)
    ? (() => { try { return activeVdmosModelCard(modelText).parameters; } catch { return new Map(); } })()
    : (() => {
      const values = new Map();
      for (const match of modelText.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*([^\s(){}]+)/g)) {
        const value = Number(match[2]);
        if (Number.isFinite(value)) values.set(match[1], value);
      }
      return values;
    })();
  for (const [name, expected] of Object.entries(fitted?.parameters ?? {})) {
    if (!Number.isFinite(Number(expected))) continue;
    if (!emitted.has(name)) errors.push(`model.cir is missing fitted parameter ${name}`);
    else {
      const actual = emitted.get(name);
      const expectedValue = Number(expected);
      if (["nmos", "pmos"].includes(component?.electrical_family) && name === "VTO") {
        if (component.electrical_family === "pmos" && !(actual < 0)) errors.push("model.cir PMOS VTO must be negative");
        if (component.electrical_family === "nmos" && !(actual > 0)) errors.push("model.cir NMOS VTO must be positive");
        if (component.electrical_family === "nmos" && !(expectedValue > 0)) errors.push("fitted.json NMOS VTO must be positive");
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
          fittedEvidenceSemantics(row, item, resolved, group, itemLabel, errors);
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
    const domains = referenced.map((row) => conditionDomain(row.condition, bound.quantity, bound.temperature_kind));
    const values = domains.filter(Boolean).flatMap((domain) => domain.values ?? [domain.minimum, domain.maximum]);
    const covers = (value) => bound.kind === "enumerated" ? bound.values?.includes(value) : (bound.minimum == null || value >= bound.minimum - 1e-12) && (bound.maximum == null || value <= bound.maximum + 1e-12);
    if (bound.derivation === "direct_evidence_union" && values.some((value) => !covers(value))) errors.push(`${label} omits referenced evidence values`);
    errors.push(...directEvidenceUnionErrors(bound, values, label));
    errors.push(...directEvidenceIntersectionErrors(bound, domains, label));
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

const EVIDENCE_CONTRACT_VERSION = "1.0.0";

function hasOwn(value, field) {
  return value != null && typeof value === "object" && Object.hasOwn(value, field);
}

function packageContractSignals(component, facts, fitted, expectations, requireEvidenceContract) {
  const region = component?.supported_operating_region;
  const bounds = Array.isArray(region?.numeric_bounds) ? region.numeric_bounds : [];
  const checks = expectationChecks(expectations);
  return [
    requireEvidenceContract && "caller-required evidence contract",
    component?.evidence_contract_version != null && "component.evidence_contract_version",
    facts?.evidence_contract_version != null && "facts.evidence_contract_version",
    fitted?.evidence_contract_version != null && "fitted.evidence_contract_version",
    expectations?.evidence_contract_version != null && "expectations.evidence_contract_version",
    expectations?.evidence_cohorts != null && "expectations.evidence_cohorts",
    checks.some(({ check }) => LINKAGE_FIELDS.some((field) => hasOwn(check, field))) && "expectations versioned evidence linkage",
    region?.contract_version != null && "component supported_operating_region.contract_version",
    bounds.some((bound) => ["bound_id", "evidence_refs", "condition_ids", "citation_ids", "derivation"].some((field) => hasOwn(bound, field))) && "component versioned evidence refs"
  ].filter(Boolean);
}

function contractVersionErrors(component, facts, fitted, expectations) {
  const errors = [];
  const region = component?.supported_operating_region;
  for (const [label, value] of [
    ["component evidence_contract_version", component?.evidence_contract_version],
    ["facts evidence_contract_version", facts?.evidence_contract_version],
    ["fitted evidence_contract_version", fitted?.evidence_contract_version],
    ["expectations evidence_contract_version", expectations?.evidence_contract_version],
    ["component supported_operating_region.contract_version", region?.contract_version]
  ]) {
    if (value !== EVIDENCE_CONTRACT_VERSION) errors.push(`${label} must be ${EVIDENCE_CONTRACT_VERSION}`);
  }
  if (!Array.isArray(expectations?.evidence_cohorts)) errors.push(`expectations evidence_cohorts is required for evidence contract ${EVIDENCE_CONTRACT_VERSION}`);
  return errors;
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

export function validatePackage(packageDir, options = {}) {
  const absoluteDir = path.resolve(packageDir);
  const requireEvidenceContract = options.requireEvidenceContract === true;
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
  const factsPath = path.join(absoluteDir, "facts.json");
  const fittedPath = path.join(absoluteDir, "fitted.json");
  const modelPath = path.join(absoluteDir, "model.cir");
  let expectations = null;
  let facts = null;
  let fitted = null;
  if (fs.existsSync(expectationsPath)) {
    try { expectations = readJson(expectationsPath); } catch { /* read diagnostics are emitted above */ }
  }
  if (fs.existsSync(factsPath)) {
    try { facts = readJson(factsPath); } catch (error) { errors.push(`facts cannot be read: ${error.message}`); }
  }
  if (fs.existsSync(fittedPath)) {
    try { fitted = readJson(fittedPath); } catch (error) { errors.push(`fitted cannot be read: ${error.message}`); }
  }
  const contractSignals = packageContractSignals(component, facts, fitted, expectations, requireEvidenceContract);
  if (contractSignals.length) {
    for (const relative of ["facts.json", "fitted.json"]) {
      const target = path.join(absoluteDir, relative);
      if (!fs.existsSync(target)) errors.push(`missing required package file for evidence contract ${EVIDENCE_CONTRACT_VERSION}: ${relative}`);
      else if (fs.statSync(target).size === 0) errors.push(`required package file is empty: ${relative}`);
    }
    errors.push(...contractVersionErrors(component, facts, fitted, expectations));
    if (component && facts && fitted && expectations && fs.existsSync(modelPath)) {
      try {
        errors.push(...validateNewContractPackage(component, facts, fitted, fs.readFileSync(modelPath, "utf8"), expectations, sources, absoluteDir));
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
