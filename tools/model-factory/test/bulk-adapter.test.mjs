import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyConditionAdjudicationSupplement, evaluateEvidenceContract, fitBulkPart, libraryCollisionReason, libraryDuplicateDieReason, normalizedIdentity, normalizeBulkManifest, normalizePackageVariants, pinPackageBenchTemperature, repairKnownEvidenceDefects, runBulkManifest, stageBulkPart, validateBulkCandidateEvidence, validateMosfetCandidateEvidence } from "../lib/bulk-adapter.mjs";
import { validatePackage } from "../../../packages/component-schema/lib.mjs";

const quantity = (value, unit) => ({ value, unit, conditions: "TA = 25 C; test mode = DC", page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" });
const fixtureSourceSha256 = "58346148e907c6d42d5efbb6ac681765701d53d09413067fe67e2b7ea9294e86";
const semanticFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "factory-semantic-test-"));
const semanticFixturePdf = path.join(semanticFixtureRoot, "datasheet.pdf");
fs.writeFileSync(semanticFixturePdf, "%PDF-1.7\nsemantic fixture\n");
const semanticSourceSha256 = createHash("sha256").update(fs.readFileSync(semanticFixturePdf)).digest("hex");
test.after(() => fs.rmSync(semanticFixtureRoot, { recursive: true, force: true }));

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

function contentHash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex")}`;
}

function extractionPointer(root, pointer) {
  return pointer.slice(1).split("/").reduce((value, token) => value[Number.isInteger(Number(token)) && String(Number(token)) === token ? Number(token) : token], root);
}

function adjudicationSupplement(extraction, entries, extractionBytes = Buffer.from(JSON.stringify(extraction))) {
  const supplement = {
    schema_version: "1.0.0",
    kind: "opencircuit-condition-adjudication-supplement",
    extraction_sha256: `sha256:${createHash("sha256").update(extractionBytes).digest("hex")}`,
    source_sha256: extraction.source_sha256,
    entries: entries.map((entry) => ({
      ...entry,
      targets: entry.targets.map((json_pointer) => ({ json_pointer, target_sha256: contentHash(extractionPointer(extraction, json_pointer)) })),
    })),
  };
  return { ...supplement, supplement_id: contentHash(supplement) };
}

function semanticCondition({ polarity = "n", magnitude = "absolute", temperature = 25, provenance = "table_heading", mode = "dc", electrical }) {
  return {
    polarity,
    magnitude_convention: magnitude,
    temperature: { status: "stated", kind: "junction", value_c: temperature, provenance },
    electrical,
    test_mode: typeof mode === "string" ? { kind: mode } : mode,
  };
}

function diodePart(pdf) {
  return {
    mpn: "FIXTURE-D1", manufacturer: "Fixture Semi", conveyor_family: "diode",
    datasheet_path: pdf, datasheet_url: "https://example.test/fixture.pdf",
    category: "Diodes", subcategory: "Switching Diodes", package: "SOD-123", description: "fixture diode",
    seed_hints: [{ factory_target: "diode.forward_voltage", raw_value: "0.7V@10mA" }], allow_f1_demotion: true,
  };
}

function mosfetPart(pdf) {
  return {
    mpn: "FIXTURE-P1", manufacturer: "Fixture Semi", conveyor_family: "mosfet",
    datasheet_path: pdf, datasheet_url: "https://example.test/mosfet.pdf",
    category: "MOSFETs", subcategory: "P-Channel MOSFET", package: "SOT-23", description: "P-channel fixture",
    seed_hints: [
      { factory_target: "vdmos.threshold", raw_value: "2.5V@250uA" },
      { factory_target: "vdmos.rds_on", raw_value: "45mΩ@2.5V,4A" },
      { factory_target: "vdmos.ciss", raw_value: "50pF@25V" },
      { factory_target: "vdmos.coss", raw_value: "20pF@25V" },
      { factory_target: "vdmos.crss", raw_value: "5pF@25V" },
    ],
    allow_f1_demotion: true,
  };
}

function semanticMosfetPart() {
  return mosfetPart(semanticFixturePdf);
}

function typicalMosfetExtraction(polarity = "p") {
  const sign = polarity === "p" ? -1 : 1;
  const thresholdConditions = `VDS = VGS, ID = ${sign * 250} µA, TJ = 25 °C; test mode = DC`;
  const rdsonConditions = `VGS = ${sign * 4.5} V, ID = ${sign * 2} A, TJ = 25 °C; test mode = DC`;
  return { source_sha256: fixtureSourceSha256, specs: {
    polarity,
    threshold_min: { value: sign * 1, unit: "V", conditions: thresholdConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "minimum" },
    threshold_typ: { value: sign * 1.5, unit: "V", conditions: thresholdConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
    threshold_max: { value: sign * 2, unit: "V", conditions: thresholdConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "maximum" },
    rdson_points: [{
      vgs: { value: sign * 4.5, unit: "V", conditions: rdsonConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
      current: { value: sign * 2, unit: "A", conditions: rdsonConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
      resistance: { value: 0.08, unit: "ohm", conditions: rdsonConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
    }],
    ciss: quantity(50e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(5e-12, "F"),
  } };
}

function curveBackedMosfetExtraction(polarity) {
  const sign = polarity === "p" ? -1 : 1;
  const thresholdConditions = `VDS = VGS, ID = ${sign * 250} µA, TJ = 25 °C; test mode = DC`;
  const rdsonConditions = `VGS = ${sign * 4.5} V, ID = ${sign * 2} A, TJ = 25 °C; test mode = DC`;
  return {
    schema_version: "1.0.0", mpn: `FIXTURE-${polarity.toUpperCase()}F2`, manufacturer: "Fixture Semi", family: "mosfet",
    datasheet_identity: { title: `Fixture ${polarity.toUpperCase()}F2`, revision: "A", pages_examined: ["p. 2", "p. 4"] },
    usable_curves: true,
    curves: [{
      name: "Figure 4 transfer curve 25 C typical",
      x_axis: { quantity: "gate-source voltage magnitude", unit: "V", scale: "linear" },
      y_axis: { quantity: "drain current magnitude", unit: "A", scale: "linear" },
      test_conditions: `VDS = ${sign * 10} V, TJ = 25 °C; test mode = DC`,
      page_reference: "p. 4, Figure 4, curve 25 C typical",
      points: [
        { x: 2, y: 0.24947561191452294 }, { x: 2.5, y: 0.9541553189214618 },
        { x: 3, y: 2.062867136930862 }, { x: 3.5, y: 3.530660490174647 },
        { x: 4, y: 5.320235612695495 },
      ],
    }],
    specs: {
      polarity,
      threshold_min: { value: sign * 1, unit: "V", conditions: thresholdConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "minimum" },
      threshold_typ: { value: sign * 1.5, unit: "V", conditions: thresholdConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
      threshold_max: { value: sign * 2, unit: "V", conditions: thresholdConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "maximum" },
      rdson_points: [{
        vgs: { value: sign * 4.5, unit: "V", conditions: rdsonConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
        current: { value: sign * 2, unit: "A", conditions: rdsonConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
        resistance: { value: 0.24609678127274964, unit: "ohm", conditions: rdsonConditions, page_reference: "p. 2, Electrical Characteristics table", source_kind: "typical" },
      }],
      ciss: quantity(50e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(5e-12, "F"), breakdown_voltage: quantity(30, "V"), body_diode: null,
    },
    extraction_notes: [], omission_reason: null,
  };
}

function intervalMosfetExtraction({ polarity = "n", thresholdModeText = "", temperatureText = "TJ = +25 degC" } = {}) {
  const sign = polarity === "p" ? 1 : 1;
  const thresholdConditions = `VDS = VGS, ID = ${sign * 250} µA, ${temperatureText}${thresholdModeText}`;
  const rdsonConditions = `VGS = ${sign * 5} V, ID = ${sign * 0.2} A, ${temperatureText}; test mode = DC`;
  return {
    source_sha256: semanticSourceSha256,
    datasheet_identity: { title: "Semantic MOSFET fixture", revision: "A", pages_examined: ["p. 2"] },
    specs: {
    polarity,
    threshold_min: { ...quantity(sign * 0.5, "V"), conditions: thresholdConditions, source_kind: "minimum" },
    threshold_typ: null,
    threshold_max: { ...quantity(sign * 1.5, "V"), conditions: thresholdConditions, source_kind: "maximum" },
    rdson_points: [{
      vgs: { ...quantity(sign * 5, "V"), conditions: rdsonConditions },
      current: { ...quantity(sign * 0.2, "A"), conditions: rdsonConditions },
      resistance: { ...quantity(3.5, "ohm"), conditions: rdsonConditions, source_kind: "maximum" },
    }],
    ciss: quantity(45e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(4e-12, "F"),
  } };
}

function intervalAdjudication(extraction, { thresholdMode = "not_stated", disclosures = ["typical figure label"], temperature = null, magnitude = "absolute" } = {}) {
  const statedTemperature = temperature ?? { status: "stated", kind: "junction", value_c: 25, provenance: "table_heading" };
  const thresholdElectrical = {
    vgs: { kind: "relation", relation: "vds_equals_vgs" },
    vds: { kind: "relation", relation: "vds_equals_vgs" },
    id: { kind: "fixed", value_a: 250e-6 },
  };
  const rdsonElectrical = {
    vgs: { kind: "fixed", value_v: 5 },
    vds: { kind: "relation", relation: "vds_not_stated" },
    id: { kind: "fixed", value_a: 0.2 },
  };
  return adjudicationSupplement(extraction, [
    {
      characteristic: "gate_threshold",
      targets: ["/specs/threshold_min", "/specs/threshold_max"],
      condition: { polarity: extraction.specs.polarity, magnitude_convention: magnitude, temperature: statedTemperature, electrical: thresholdElectrical, test_mode: { kind: thresholdMode } },
      disclosures,
    },
    {
      characteristic: "rds_on",
      targets: ["/specs/rdson_points/0/vgs", "/specs/rdson_points/0/current", "/specs/rdson_points/0/resistance"],
      condition: semanticCondition({ polarity: extraction.specs.polarity, magnitude, electrical: rdsonElectrical }),
      disclosures: ["RDS row label retained verbatim"],
    },
  ]);
}

function passThroughConstraintRunner(payload) {
  const rdson = payload.seed.rdson;
  return {
    parameters: {
      VTO: payload.seed.vto, KP: 2 / rdson, THETA: 0, LAMBDA: 0.003, RD: 0.55 * rdson, RS: 0.2 * rdson,
      RG: 1e-4, ...payload.fixed, IS: 1e-12, N: 1.5, RB: 0.2 * rdson,
    },
    constraint_results: payload.constraints.map((constraint) => ({ ...constraint, inclusive: true, satisfied: true })),
    optimizer: { method: "fixture feasibility projection", residual_target_count: 0 },
  };
}

const f2MosfetParameters = {
  VTO: 1.5, KP: 8, THETA: 0, LAMBDA: 0.003, RD: 0.04, RS: 0.02, RG: 1e-4,
  CGS: 45e-12, CGDMAX: 5e-12, CGDMIN: 5e-12, CJO: 15e-12, IS: 1e-12, N: 1.5, RB: 0.02,
};

function acceptedF2Attempt() {
  return {
    fidelity: "F2", evidence_contract_version: "1.0.0", parameters: f2MosfetParameters,
    residuals: [], worst: { value: 0, quantity: "drain_current" }, rms: 0, gate_pass: true,
  };
}

function productionCurveExtraction({ xQuantity = "V_GS", yQuantity = "I_D", fixedQuantity = "V_DS", output = false } = {}) {
  const value = curveBackedMosfetExtraction("n");
  value.source_sha256 = fixtureSourceSha256;
  const curve = value.curves[0];
  curve.name = output ? "Figure 5 output trace VGS 4.5 V" : "Figure 4 transfer trace 25 C typical";
  curve.x_axis.quantity = xQuantity;
  curve.y_axis.quantity = yQuantity;
  curve.test_conditions = output ? "VGS = 4.5 V, TJ = 25 °C; test mode = DC" : "VDS = 10 V, TJ = 25 °C; test mode = DC";
  curve.page_reference = output ? "p. 4, Figure 5, trace VGS 4.5 V" : "p. 4, Figure 4, curve 25 C typical";
  curve.locator = { page: 4, figure: output ? "5" : "4", curve_or_trace: output ? "VGS 4.5 V" : "25 C typical" };
  curve.temperature = { kind: "junction", value: 25, provenance: "figure_label" };
  curve.electrical_bias = [{ quantity: fixedQuantity, value: output ? 4.5 : 10, unit: "V" }];
  curve.test_mode = { kind: "dc" };
  curve.magnitude_convention = "absolute";
  const thresholdCondition = semanticCondition({ polarity: "n", magnitude: "absolute", electrical: {
    vgs: { kind: "relation", relation: "vds_equals_vgs" },
    vds: { kind: "relation", relation: "vds_equals_vgs" },
    id: { kind: "fixed", value_a: 250e-6 },
  } });
  const rdsonCondition = semanticCondition({ polarity: "n", magnitude: "absolute", electrical: {
    vgs: { kind: "fixed", value_v: 4.5 },
    vds: { kind: "relation", relation: "vds_not_stated" },
    id: { kind: "fixed", value_a: 2 },
  } });
  for (const threshold of [value.specs.threshold_min, value.specs.threshold_typ, value.specs.threshold_max]) {
    threshold.locator = { page: 2, table: "Electrical Characteristics", row: "Gate Threshold Voltage" };
    threshold.condition = structuredClone(thresholdCondition);
  }
  for (const datum of Object.values(value.specs.rdson_points[0])) {
    datum.locator = { page: 2, table: "Electrical Characteristics", row: "Static Drain-Source On-Resistance" };
    datum.condition = structuredClone(rdsonCondition);
  }
  if (output) {
    value.curves.push({
      ...structuredClone(curve),
      name: "Figure 4 transfer trace 25 C typical",
      x_axis: { quantity: "VGS", unit: "V", scale: "linear" },
      y_axis: { quantity: "ID", unit: "A", scale: "linear" },
      test_conditions: "VDS = 10 V, TJ = 25 °C; test mode = DC",
      page_reference: "p. 4, Figure 4, curve 25 C typical",
      locator: { page: 4, figure: "4", curve_or_trace: "25 C typical" },
      electrical_bias: [{ quantity: "VDS", value: 10, unit: "V" }],
    });
  }
  return value;
}

function extraction() {
  return {
    schema_version: "1.0.0", mpn: "FIXTURE-D1", manufacturer: "Fixture Semi", family: "diode",
    datasheet_identity: { title: "Fixture D1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: true,
    curves: [{ name: "Forward IV", x_axis: { quantity: "voltage", unit: "V", scale: "linear" }, y_axis: { quantity: "current", unit: "A", scale: "log" }, test_conditions: "TA=25 C; test mode = DC", page_reference: "p. 2, Figure 1, curve: Forward IV", points: [{ x: 0.48, y: 1e-4 }, { x: 0.60, y: 1e-3 }, { x: 0.72, y: 1e-2 }, { x: 0.84, y: 1e-1 }] }],
    specs: { variant: "signal", forward_voltage_points: [{ current: quantity(10, "mA"), voltage: quantity(720, "mV") }], reverse_current: { ...quantity(2, "µA"), conditions: "VR=5 V, TA=25 C" }, capacitance: null, reverse_recovery: null, breakdown_voltage: null, breakdown_current: null }, extraction_notes: [], omission_reason: null,
  };
}

function zenerExtraction() {
  const value = extraction();
  value.specs.variant = "zener";
  value.specs.breakdown_voltage = { ...quantity(5.1, "V"), conditions: "VZ = 5.1 V at IZT = 5 mA", page_reference: "p. 2 Zener table" };
  value.specs.breakdown_current = { ...quantity(5, "mA"), conditions: "IZT = 5 mA at VZ = 5.1 V", page_reference: "p. 2 Zener table" };
  return value;
}

test("production MOSFET axis aliases and structured evidence normalize to the canonical fit contract", () => {
  const cases = [
    { xQuantity: "VGS", yQuantity: "ID", fixedQuantity: "VDS", output: false, characteristic: "transfer_current", xCanonical: "vgs" },
    { xQuantity: "V_GS", yQuantity: "I_D", fixedQuantity: "V_DS", output: false, characteristic: "transfer_current", xCanonical: "vgs" },
    { xQuantity: "VDS", yQuantity: "ID", fixedQuantity: "VGS", output: true, characteristic: "output_current", xCanonical: "vds" },
    { xQuantity: "V_DS", yQuantity: "I_D", fixedQuantity: "V_GS", output: true, characteristic: "output_current", xCanonical: "vds" },
  ];
  for (const item of cases) {
    const extraction = productionCurveExtraction(item);
    const original = structuredClone(extraction);
    let fitterPayload;
    const fit = fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extraction, {
      fitRunner: (payload) => { fitterPayload = payload; return acceptedF2Attempt(); },
      ngspiceRunner: () => ({ pass: true }),
    });
    const [normalized] = fitterPayload.extraction.curves;
    assert.equal(normalized.characteristic, item.characteristic);
    assert.deepEqual(normalized.x_axis, { quantity: item.xCanonical, unit: "V" });
    assert.deepEqual(normalized.y_axis, { quantity: "id", unit: "A" });
    assert.deepEqual(normalized.condition_identity.temperature, { kind: "junction", value_c: 25 });
    assert.equal(normalized.condition_identity.test_mode.kind, "dc");
    assert.ok(normalized.condition_identity.qualifiers.some((item) => item.key === "typed_temperature_provenance" && item.value === "figure_label"));
    assert.equal(normalized.citation_identity.page, 4);
    assert.equal(normalized.citation_identity.curve, item.output ? "VGS 4.5 V" : "25 C typical");
    assert.equal(fitterPayload.extraction.specs.threshold_min.citation_identity.row, "Gate Threshold Voltage");
    assert.equal(fitterPayload.extraction.specs.rdson_points[0].resistance.citation_identity.row, "Static Drain-Source On-Resistance");
    assert.equal(fit.evidence_curves[0].characteristic, item.characteristic);
    assert.deepEqual(extraction, original, "axis and structured-evidence normalization must not mutate source values, units, points, or citations");
  }
});

test("production MOSFET curve fields fail closed without weakening units, citations, temperature, bias, or mode gates", () => {
  const mutations = [
    ["near-miss axis", (curve) => { curve.x_axis.quantity = "V_GD"; }, /unsupported electrical axis pairing/],
    ["inverted standard axes", (curve) => {
      curve.x_axis.quantity = "ID";
      curve.y_axis.quantity = "VGS";
    }, /unsupported electrical axis pairing/],
    ["inverted descriptive axes", (curve) => {
      curve.x_axis.quantity = "drain current";
      curve.y_axis.quantity = "gate source voltage";
    }, /unsupported electrical axis pairing/],
    ["partial descriptive electrical axes", (curve) => {
      curve.x_axis.quantity = "drain current";
      curve.y_axis.quantity = "capacitance";
    }, /unsupported electrical axis pairing/],
    ["wrong axis unit", (curve) => { curve.x_axis.unit = "mA"; }, /requires voltage and current axes/],
    ["incomplete locator", (curve) => { delete curve.locator.curve_or_trace; }, /invalid fields|curve_or_trace/],
    ["text locator page", (curve) => { curve.locator.page = "4"; }, /positive integer page/],
    ["temperature not stated", (curve) => { curve.temperature.kind = "not_stated"; }, /temperature.kind is unknown/],
    ["temperature conflict", (curve) => { curve.temperature.value = 125; }, /structured temperature disagrees/],
    ["wrong fixed bias", (curve) => { curve.electrical_bias[0].quantity = "VGS"; }, /may only state fixed VDS/],
    ["bias conflict", (curve) => { curve.electrical_bias[0].value = 9; }, /structured electrical bias disagrees/],
    ["mode not stated", (curve) => { curve.test_mode.kind = "not_stated"; }, /not_stated fails closed/],
    ["pulsed static fit", (curve) => {
      curve.test_mode = { kind: "pulsed", pulse_width_s: 1e-6, duty_cycle: 0.01 };
      curve.test_conditions = "VDS = 10 V, TJ = 25 °C; pulsed; pulse width = 1 us; duty cycle = 1%";
    }, /pulsed evidence and cannot enter a static DC MOSFET fit/],
  ];
  for (const [name, mutate, pattern] of mutations) {
    const extraction = productionCurveExtraction();
    mutate(extraction.curves[0]);
    assert.throws(
      () => fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extraction, {
        fitRunner: () => { throw new Error("fitter must not run for invalid structured evidence"); },
        ngspiceRunner: () => ({ pass: true }),
      }),
      pattern,
      name,
    );
  }
  const scalarLocator = productionCurveExtraction();
  delete scalarLocator.specs.threshold_min.locator.row;
  assert.throws(
    () => fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, scalarLocator, {
      fitRunner: () => { throw new Error("fitter must not run for invalid scalar locator"); },
      ngspiceRunner: () => ({ pass: true }),
    }),
    /invalid fields|row/,
  );
});

test("direct MOSFET conditions admit opaque source prose while explicit contradictions still fail", () => {
  const extraction = productionCurveExtraction();
  extraction.curves[0].test_conditions = "Figure caption retained verbatim: nominal transfer characteristic";
  for (const datum of [
    extraction.specs.threshold_min, extraction.specs.threshold_typ, extraction.specs.threshold_max,
    ...Object.values(extraction.specs.rdson_points[0]),
  ]) datum.conditions = "Electrical Characteristics table; see note 3";
  let invoked = false;
  fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extraction, {
    fitRunner: () => { invoked = true; return acceptedF2Attempt(); }, ngspiceRunner: () => ({ pass: true }),
  });
  assert.equal(invoked, true);
  assert.equal(validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extraction).route, "curve-fitted");
  assert.ok(extraction.curves[0].condition_identity == null, "source extraction remains unmodified");

  const contradictory = productionCurveExtraction();
  contradictory.curves[0].test_conditions = "VDS = 9 V, TJ = 25 °C; test mode = DC";
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, contradictory),
    /structured electrical bias disagrees/,
  );
  const temperatureConflict = productionCurveExtraction();
  temperatureConflict.specs.threshold_min.conditions = "VDS = VGS, ID = 250 uA, TJ = 125 °C; test mode = DC";
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, temperatureConflict),
    /typed temperature disagrees/,
  );
  const distinctThresholdBias = productionCurveExtraction();
  distinctThresholdBias.specs.threshold_typ.conditions = "VDS = 10 V, VGS = 1 V, ID = 250 uA, TJ = 25 °C; test mode = DC";
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, distinctThresholdBias),
    /relationship disagrees with fixed VDS or VGS/,
  );
  const oneFixedThresholdBias = productionCurveExtraction();
  oneFixedThresholdBias.specs.threshold_typ.conditions = "VDS = 10 V, ID = 250 uA, TJ = 25 °C; test mode = DC";
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, oneFixedThresholdBias),
    /relationship disagrees with fixed VDS or VGS/,
  );
  const fixedRdsonVds = productionCurveExtraction();
  for (const datum of Object.values(fixedRdsonVds.specs.rdson_points[0])) {
    datum.conditions = "VGS = 4.5 V, VDS = 10 V, ID = 2 A, TJ = 25 °C; test mode = DC";
  }
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, fixedRdsonVds),
    /VDS-not-stated relation disagrees with fixed VDS/,
  );
  const rawPulsed = productionCurveExtraction();
  rawPulsed.curves[0].test_conditions = "VDS = 10 V, TJ = 25 °C; pulsed";
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, rawPulsed),
    /structured test mode disagrees/,
  );
});

test("fit entrypoint cannot bypass MOSFET or diode preflight", () => {
  // Evidence that supports NO tier is still terminal. Stripping the scalar calibration as
  // well as the curves leaves nothing any card could be built from.
  const nothing = productionCurveExtraction();
  nothing.curves = [];
  delete nothing.specs.threshold_min;
  delete nothing.specs.threshold_typ;
  delete nothing.specs.threshold_max;
  delete nothing.specs.rdson_points;
  let mosfetRunnerCalled = false;
  assert.throws(
    () => fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, nothing, {
      fitRunner: () => { mosfetRunnerCalled = true; return acceptedF2Attempt(); }, ngspiceRunner: () => ({ pass: true }),
    }),
    /evidence supports no fidelity tier/,
  );
  assert.equal(mosfetRunnerCalled, false);
  const noDiodeEvidence = extraction();
  noDiodeEvidence.specs.forward_voltage_points = [];
  let diodeRunnerCalled = false;
  assert.throws(
    () => fitBulkPart(diodePart("unused.pdf"), noDiodeEvidence, {
      fitRunner: () => { diodeRunnerCalled = true; return acceptedF2Attempt(); }, ngspiceRunner: () => ({ pass: true }),
    }),
    /positive cited forward-voltage\/current pair/,
  );
  assert.equal(diodeRunnerCalled, false);
});

test("an absent F2 curve demotes to F1 and never reaches the F2 fitter", () => {
  // The curve evidence is missing, not contradicted, and the scalar calibration is intact.
  // Rejecting the part would throw away a measurement over evidence that was never
  // claimed; running the F2 fitter anyway would spend a fit to reach the answer the
  // contract already gave, and could produce an F2 result from refused evidence.
  const extractionWithoutCurves = productionCurveExtraction();
  extractionWithoutCurves.curves = [];
  const report = evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extractionWithoutCurves);
  assert.equal(report.tier, "F1");
  const curveRule = report.rules.find((rule) => rule.id === "mosfet_f2_curve_evidence");
  assert.equal(curveRule.status, "fail");
  assert.match(curveRule.reason, /requires at least one normalized static transfer_current curve/);
  assert.equal(report.rules.find((rule) => rule.id === "mosfet_f1_critical_calibration").status, "pass");
  assert.ok(report.omissions.some((line) => /mosfet_f2_curve_evidence/.test(line)));

  let fitterCalled = false;
  const fit = fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extractionWithoutCurves, {
    fitRunner: () => { fitterCalled = true; return acceptedF2Attempt(); },
    ngspiceRunner: () => ({ pass: true }),
    mosfetConstraintRunner: passThroughConstraintRunner,
  });
  assert.equal(fitterCalled, false);
  assert.equal(fit.fidelity, "F1");
  assert.equal(fit.evidence_contract.tier, "F1");
});

test("a contradicted curve still rejects the whole part rather than demoting", () => {
  // The line the incremental contract turns on. Absent evidence demotes; evidence that
  // contradicts the extraction is a wrong claim, and silently dropping it would hide a
  // contradiction in the source.
  const contradictions = [
    ["axis pairing", (curve) => { curve.x_axis.quantity = "V_GD"; }, /unsupported electrical axis pairing/],
    ["axis unit", (curve) => { curve.x_axis.unit = "mA"; }, /requires voltage and current axes/],
    ["temperature", (curve) => { curve.temperature.value = 125; }, /structured temperature disagrees/],
    ["bias", (curve) => { curve.electrical_bias[0].value = 9; }, /structured electrical bias disagrees/],
  ];
  for (const [name, mutate, pattern] of contradictions) {
    const contradicted = productionCurveExtraction();
    mutate(contradicted.curves[0]);
    assert.throws(
      () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, contradicted),
      pattern,
      name,
    );
  }
});

test("bulk manifests stage an F1 package when only the F2 rule fails, and fail terminally when nothing holds", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-preflight-terminal-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");

    const demotable = productionCurveExtraction();
    demotable.curves = [];
    const demotablePath = path.join(root, "demotable.json");
    fs.writeFileSync(demotablePath, JSON.stringify(demotable));
    const demotableManifest = path.join(root, "demotable-batch.json");
    fs.writeFileSync(demotableManifest, JSON.stringify({
      schema_version: "1.0.0", kind: "opencircuit-conveyor-batch",
      parts: [{ ...mosfetPart(pdf), subcategory: "N-Channel MOSFET", extraction_path: demotablePath }],
    }));
    const [demoted] = runBulkManifest(demotableManifest, path.join(root, "staging-demoted"), {
      fitRunner: () => { throw new Error("the F2 fitter must not run once the F2 rule has failed"); },
    });
    assert.equal(demoted.status, "staged");
    assert.equal(demoted.fidelity, "F1");
    const component = JSON.parse(fs.readFileSync(path.join(demoted.package_path, "component.json"), "utf8"));
    assert.ok(
      component.known_omissions.some((line) => /mosfet_f2_curve_evidence/.test(line)),
      `the package must say what it does not claim: ${component.known_omissions.join(" | ")}`,
    );
    const card = fs.readFileSync(path.join(demoted.package_path, "MODEL_CARD.md"), "utf8");
    assert.match(card, /mosfet_f2_curve_evidence/);

    const hopeless = productionCurveExtraction();
    hopeless.curves = [];
    delete hopeless.specs.threshold_min;
    delete hopeless.specs.threshold_typ;
    delete hopeless.specs.threshold_max;
    delete hopeless.specs.rdson_points;
    const hopelessPath = path.join(root, "hopeless.json");
    fs.writeFileSync(hopelessPath, JSON.stringify(hopeless));
    const hopelessManifest = path.join(root, "hopeless-batch.json");
    fs.writeFileSync(hopelessManifest, JSON.stringify({
      schema_version: "1.0.0", kind: "opencircuit-conveyor-batch",
      parts: [{ ...mosfetPart(pdf), subcategory: "N-Channel MOSFET", extraction_path: hopelessPath }],
    }));
    const [failed] = runBulkManifest(hopelessManifest, path.join(root, "staging-hopeless"), { fitRunner: () => { throw new Error("must not fit"); } });
    assert.equal(failed.status, "failed");
    assert.equal(failed.stage, "preflight");
    assert.match(failed.reason, /evidence supports no fidelity tier/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("direct MOSFET conditions preserve signed P-channel evidence and reject a false absolute claim", () => {
  const extraction = productionCurveExtraction();
  extraction.specs.polarity = "p";
  extraction.curves[0].points = extraction.curves[0].points.map((point) => ({ x: -point.x, y: -point.y }));
  extraction.curves[0].magnitude_convention = "absolute";
  for (const datum of [
    extraction.specs.threshold_min, extraction.specs.threshold_typ, extraction.specs.threshold_max,
    ...Object.values(extraction.specs.rdson_points[0]),
  ]) {
    datum.condition.polarity = "p";
    datum.condition.magnitude_convention = "signed";
  }
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "P-Channel MOSFET" }, extraction),
    /structured magnitude convention contradicts signed curve coordinates/,
  );
  extraction.curves[0].magnitude_convention = "signed";
  extraction.curves[0].electrical_bias[0].value = -10;
  assert.equal(validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "P-Channel MOSFET" }, extraction).route, "curve-fitted");
  const negativeAbsoluteBias = productionCurveExtraction();
  negativeAbsoluteBias.curves[0].electrical_bias[0].value = -10;
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, negativeAbsoluteBias),
    /negative value requires signed magnitude_convention/,
  );
});

test("direct threshold not_stated remains an explicit static-characteristic policy while curves stay strict", () => {
  const extraction = productionCurveExtraction();
  extraction.specs.threshold_min.condition.test_mode = { kind: "not_stated" };
  extraction.specs.threshold_typ.condition.test_mode = { kind: "not_stated" };
  extraction.specs.threshold_max.condition.test_mode = { kind: "not_stated" };
  for (const threshold of [extraction.specs.threshold_min, extraction.specs.threshold_typ, extraction.specs.threshold_max]) {
    threshold.conditions = "Electrical Characteristics table; static parameter";
  }
  assert.equal(validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extraction).route, "curve-fitted");
  const explicitModeConflict = productionCurveExtraction();
  explicitModeConflict.specs.threshold_typ.condition.test_mode = { kind: "not_stated" };
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, explicitModeConflict),
    /structured test mode disagrees/,
  );

  const missing = productionCurveExtraction();
  delete missing.curves[0].magnitude_convention;
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, missing),
    /missing magnitude_convention/,
  );
  const missingScalar = productionCurveExtraction();
  delete missingScalar.specs.threshold_typ.condition.temperature;
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, missingScalar),
    /condition has invalid fields; missing temperature/,
  );
  const negativeId = productionCurveExtraction();
  negativeId.specs.threshold_typ.condition.electrical.id.value_a = -250e-6;
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, negativeId),
    /fixed ID must be positive/,
  );
  const negativeVgs = productionCurveExtraction();
  negativeVgs.specs.rdson_points[0].vgs.condition.electrical.vgs.value_v = -4.5;
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, negativeVgs),
    /fixed VGS must be positive/,
  );
  const pulsed = productionCurveExtraction();
  pulsed.curves[0].test_mode = { kind: "pulsed", pulse_width_s: 1e-6 };
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, pulsed),
    /pulsed evidence and cannot enter a static DC MOSFET fit/,
  );
  const noTransfer = productionCurveExtraction();
  noTransfer.curves = [];
  assert.throws(
    () => validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, noTransfer),
    /requires at least one normalized static transfer_current curve/,
  );
});

test("pulse-tested scalar RDS(on) remains pulse-labelled while pulsed curves and thresholds stay excluded", () => {
  const extraction = productionCurveExtraction();
  extraction.usable_curves = false;
  extraction.curves = [];
  extraction.specs.threshold_typ = null;
  const pulsedMode = { kind: "pulsed", pulse_width_s: 400e-6, duty_cycle: 0.02 };
  for (const datum of Object.values(extraction.specs.rdson_points[0])) {
    datum.condition.test_mode = structuredClone(pulsedMode);
    datum.conditions = "VGS = 4.5 V, ID = 2 A; pulse width <= 400 us, duty cycle <= 2%";
    datum.source_kind = datum === extraction.specs.rdson_points[0].resistance ? "maximum" : datum.source_kind;
  }
  let runnerPayload;
  const part = { ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" };
  assert.equal(validateMosfetCandidateEvidence(part, extraction).route, "interval-constrained");
  fitBulkPart(part, extraction, {
    forceF1: true,
    ngspiceRunner: () => ({ pass: true }),
    mosfetConstraintRunner: (payload) => { runnerPayload = payload; return passThroughConstraintRunner(payload); },
  });
  const identity = runnerPayload.constraints.find((constraint) => constraint.kind === "rdson_maximum").condition_identity;
  assert.deepEqual(identity.test_mode, pulsedMode);
  assert.ok(identity.qualifiers.some((item) => item.key === "calibration_interpretation" && item.value === "quasi_static_rds_snapshot"));
  assert.ok(identity.qualifiers.some((item) => item.key === "typed_source_test_mode" && item.value === "pulsed"));

  const adjudicationExtraction = intervalMosfetExtraction();
  for (const datum of Object.values(adjudicationExtraction.specs.rdson_points[0])) {
    datum.conditions = "VGS = 5 V, ID = 0.2 A, TJ = 25 degC; pulse width <= 400 us, duty cycle <= 2%";
  }
  const supplement = intervalAdjudication(adjudicationExtraction);
  supplement.entries[1].condition.test_mode = structuredClone(pulsedMode);
  supplement.supplement_id = contentHash(Object.fromEntries(Object.entries(supplement).filter(([key]) => key !== "supplement_id")));
  const adjudicationPart = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const adjudicated = applyConditionAdjudicationSupplement(adjudicationPart, adjudicationExtraction, supplement);
  let adjudicatedPayload;
  fitBulkPart(adjudicationPart, adjudicated, {
    forceF1: true,
    ngspiceRunner: () => ({ pass: true }),
    mosfetConstraintRunner: (payload) => { adjudicatedPayload = payload; return passThroughConstraintRunner(payload); },
  });
  const adjudicatedIdentity = adjudicatedPayload.constraints.find((constraint) => constraint.kind === "rdson_maximum").condition_identity;
  assert.deepEqual(adjudicatedIdentity.test_mode, pulsedMode);
  assert.ok(adjudicatedIdentity.qualifiers.some((item) => item.key === "calibration_interpretation" && item.value === "quasi_static_rds_snapshot"));
  assert.ok(adjudicatedIdentity.qualifiers.some((item) => item.key === "semantic_adjudication" && item.value === "content_addressed"));

  const pulsedThreshold = structuredClone(extraction);
  pulsedThreshold.specs.threshold_min.condition.test_mode = structuredClone(pulsedMode);
  pulsedThreshold.specs.threshold_min.conditions = "VDS = VGS, ID = 250 uA; pulse width <= 400 us, duty cycle <= 2%";
  assert.throws(() => validateMosfetCandidateEvidence(part, pulsedThreshold), /pulsed evidence and cannot enter a static DC MOSFET fit/);

  const pulsedCurve = productionCurveExtraction();
  pulsedCurve.curves[0].test_mode = structuredClone(pulsedMode);
  pulsedCurve.curves[0].test_conditions = "VDS = 10 V, TJ = 25 °C; pulse width <= 400 us, duty cycle <= 2%";
  assert.throws(() => validateMosfetCandidateEvidence(part, pulsedCurve), /pulsed evidence and cannot enter a static DC MOSFET fit/);
});

test("family-wide candidate preflight classifies cited diode evidence without seed-only admission", () => {
  const typical = extraction();
  assert.equal(validateBulkCandidateEvidence(diodePart("unused.pdf"), typical).route, "direct-typical-or-digitized");

  const maximumOnly = extraction();
  maximumOnly.specs.forward_voltage_points[0].voltage.source_kind = "maximum";
  maximumOnly.specs.forward_voltage_points[0].current.source_kind = "maximum";
  assert.equal(validateBulkCandidateEvidence(diodePart("unused.pdf"), maximumOnly).route, "maximum-bound-only");
  const maximumFit = fitBulkPart(diodePart("unused.pdf"), maximumOnly, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(maximumFit.evidence_mode, "bound-constrained");
  assert.equal(maximumFit.calibration.residual_target_count, 0);
  assert.deepEqual(maximumFit.calibration.observations, []);
  assert.equal(maximumFit.calibration.constraints[0].kind, "forward_voltage_maximum");
  assert.equal(maximumFit.calibration.seeds[0].current_factor, 0.95);
  assert.equal(maximumFit.calibration.seeds[0].voltage_factor, 0.97);
  assert.match(maximumFit.parameter_metadata.IS.status, /cited maximum bound/);
  assert.match(maximumFit.parameter_metadata.N.status, /fixed F1 policy/);
  assert.match(maximumFit.parameter_metadata.RS.status, /fixed F1 policy/);

  const directWithMaximum = extraction();
  directWithMaximum.specs.forward_voltage_points.push({
    current: { ...quantity(2, "A"), source_kind: "maximum" },
    voltage: { ...quantity(0.55, "V"), source_kind: "maximum" },
  });
  const mixedFit = fitBulkPart(diodePart("unused.pdf"), directWithMaximum, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(mixedFit.evidence_mode, "typ-point");
  assert.equal(mixedFit.calibration.constraints.length, 1);
  assert.equal(mixedFit.calibration.constraints[0].current_a, 2);
  assert.equal(mixedFit.calibration.constraints[0].maximum_voltage_v, 0.55);

  const noEvidence = extraction();
  noEvidence.specs.forward_voltage_points = [];
  assert.throws(() => validateBulkCandidateEvidence(diodePart("unused.pdf"), noEvidence), /positive cited forward-voltage\/current pair/);
  const minimumOnly = extraction();
  minimumOnly.specs.forward_voltage_points[0].voltage.source_kind = "minimum";
  minimumOnly.specs.forward_voltage_points[0].current.source_kind = "minimum";
  assert.throws(() => validateBulkCandidateEvidence(diodePart("unused.pdf"), minimumOnly), /matching typical, digitized_typical_curve, or maximum/);
  const mixedRoles = extraction();
  mixedRoles.specs.forward_voltage_points[0].current.source_kind = "maximum";
  assert.throws(() => validateBulkCandidateEvidence(diodePart("unused.pdf"), mixedRoles), /matching typical, digitized_typical_curve, or maximum/);
  const wrongUnit = extraction();
  wrongUnit.specs.forward_voltage_points[0].voltage.unit = "ohm";
  assert.throws(() => validateBulkCandidateEvidence(diodePart("unused.pdf"), wrongUnit), /matching typical, digitized_typical_curve, or maximum/);
});

test("MOSFET pure preflight uses the fitter's interval route when only RDS(on) maximum is admitted", () => {
  const extraction = productionCurveExtraction();
  extraction.usable_curves = false;
  extraction.curves = [];
  extraction.specs.threshold_min = null;
  extraction.specs.threshold_max = null;
  extraction.specs.rdson_points[0].resistance.source_kind = "maximum";
  assert.equal(
    validateMosfetCandidateEvidence({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, extraction).route,
    "interval-constrained",
  );
});

test("the conveyor MOSFET critical fixture crosses the producer-consumer boundary", () => {
  const staleExtraction = JSON.parse(fs.readFileSync(
    new URL("../../conveyor/test/fixtures/mosfet-critical.json", import.meta.url),
    "utf8",
  ));
  let fitterPayload;
  const part = {
    ...mosfetPart(semanticFixturePdf),
    mpn: "M1",
    manufacturer: "Fixture",
    subcategory: "N-Channel MOSFET",
  };
  assert.throws(
    () => validateBulkCandidateEvidence(part, staleExtraction),
    /must preserve that VDS was not stated/,
    "the consumer must reject the producer's obsolete saturation-region fiction",
  );
  const extraction = structuredClone(staleExtraction);
  for (const point of extraction.specs.rdson_points) {
    for (const field of ["vgs", "current", "resistance"]) {
      point[field].condition.electrical.vds = { kind: "relation", relation: "vds_not_stated" };
    }
  }
  assert.equal(validateBulkCandidateEvidence(part, extraction).route, "curve-fitted");
  const fit = fitBulkPart(part, extraction, {
    fitRunner: (payload) => { fitterPayload = payload; return acceptedF2Attempt(); },
    ngspiceRunner: () => ({ pass: true }),
  });
  const [curve] = fitterPayload.extraction.curves;
  assert.equal(curve.characteristic, "transfer_current");
  assert.deepEqual(curve.citation_identity, {
    source_sha256: semanticSourceSha256,
    source_revision: "A",
    page: 5,
    figure: "Figure 3",
    curve: "VDS = 10 V transfer trace",
    citation_id: curve.citation_identity.citation_id,
  });
  assert.ok(curve.condition_identity.qualifiers.some(
    (item) => item.key === "typed_temperature_provenance" && item.value === "inline_condition",
  ));
  assert.ok(curve.condition_identity.qualifiers.some(
    (item) => item.key === "typed_condition_source" && item.value === "direct_extraction",
  ));
  assert.ok(!curve.condition_identity.qualifiers.some((item) => item.key === "semantic_adjudication"));
  assert.equal(fit.fidelity, "F2");
  assert.equal(fit.evidence_curves.length, 1);
});

test("bulk adapter fits curve-backed diode without touching reviewed library", () => {
  const fit = fitBulkPart(diodePart("unused.pdf"), extraction(), { ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.fidelity, "F2");
  assert.match(fit.model.text, /\.model .* D\(/);
});

test("Zener model cards emit only cited positive BV and IBV values", () => {
  const fit = fitBulkPart(diodePart("unused.pdf"), zenerExtraction(), { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.parameters.BV, 5.1);
  assert.equal(fit.parameters.IBV, 0.005);
  assert.equal(fit.parameters.NBV, 1);
  assert.match(fit.model.text, / BV=5\.1000000000e0 IBV=5\.0000000000e-3 NBV=1\.0000000000e0/);

  const incomplete = zenerExtraction();
  incomplete.specs.breakdown_current = null;
  const ratingOnlyPart = { ...diodePart("unused.pdf"), seed_hints: [{ factory_target: "diode.reverse_voltage", raw_value: "100V maximum rating" }] };
  const ratingOnly = fitBulkPart(ratingOnlyPart, incomplete, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(ratingOnly.parameters.BV, undefined);
  assert.doesNotMatch(ratingOnly.model.text, /\sBV=/);
});

test("staged Zener facts preserve the cited breakdown model inputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-zener-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(zenerExtraction()));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { ngspiceRunner: () => ({ pass: true }) });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    assert.deepEqual(facts.derived_model_inputs.BV, { ...quantity(5.1, "V"), conditions: "VZ = 5.1 V at IZT = 5 mA", page_reference: "p. 2 Zener table" });
    assert.equal(facts.derived_model_inputs.IBV.value, 0.005);
    assert.equal(facts.derived_model_inputs.IBV.unit, "A");
    assert.equal(facts.derived_model_inputs.IBV.page_reference, "p. 2 Zener table");
    assert.equal(facts.derived_model_inputs.NBV.value, 1);
    assert.equal(facts.derived_model_inputs.NBV.source_kind, "held_default");
    const fitted = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "fitted.json"), "utf8"));
    assert.equal(fitted.fitter, "datasheet typical-point diode F1 formula");
    assert.deepEqual(validatePackage(result[0].package_path, { requireEvidenceContract: true }).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("F1 diode calibration honors SI units and a cited maximum at 25 C", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-diode-f1-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const maximum = extraction();
    maximum.usable_curves = false;
    maximum.curves = [];
    maximum.omission_reason = "no part-specific curve";
    maximum.specs.forward_voltage_points = [{
      current: { ...quantity(5, "A"), conditions: "TA = 25 C; source test mode is not stated", source_kind: "maximum" },
      voltage: { ...quantity(550, "mV"), conditions: "IF = 5 A; TA = 25 C; source test mode is not stated", source_kind: "maximum" },
    }];
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(maximum));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { ngspiceRunner: () => ({ pass: true }) });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    assert.equal(result[0].fidelity, "F1");
    const fitted = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "fitted.json"), "utf8"));
    assert.equal(fitted.fitter, "cited-maximum diode F1 interior-feasibility projection");
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    assert.equal(facts.forward_voltage_points[0].voltage.condition_identity.test_mode.kind, "not_stated");
    const expectations = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "tests", "expectations.json"), "utf8"));
    const [bound] = expectations.tests[0].hard_bounds_checks;
    assert.deepEqual(bound.evidence_qualification, { test_mode: "not_stated" });
    assert.deepEqual(bound.bench_qualification, { test_mode: "continuous_dc" });
    assert.equal(bound.bench_equivalence_policy, "isothermal_diode_forward_projection");
    assert.deepEqual(validatePackage(result[0].package_path, { requireEvidenceContract: true }).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("bulk manifest accepts external datasheet and seed paths and stages pending-review", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-bulk-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    const pulsedExtraction = extraction();
    pulsedExtraction.curves[0].test_conditions = "TJ = 25 C; pulse width = 300 us; duty cycle = 1%";
    fs.writeFileSync(extractionPath, JSON.stringify(pulsedExtraction));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath }] }));
    const staging = path.join(root, "staging");
    const result = runBulkManifest(manifestPath, staging, { ngspiceRunner: () => ({ pass: true }) });
    assert.equal(result[0].status, "staged");
    assert.equal(result[0].fidelity, "F2");
    const component = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "component.json"), "utf8"));
    assert.equal(component.reviewer.tool_or_agent, "pending-independent-package-review");
    assert.equal(component.test_results.status, "complete");
    assert.ok(component.test_results.total_count > 0);
    const modelText = fs.readFileSync(path.join(result[0].package_path, "model.cir"), "utf8");
    const licenseText = fs.readFileSync(path.join(result[0].package_path, "LICENSE"), "utf8");
    assert.match(modelText, /^\* scheMAGIC Model Factory v0\.1\.0 bulk adapter$/m);
    assert.doesNotMatch(modelText, /OpenCircuit/);
    assert.match(licenseText, /^Copyright \(c\) 2026 scheMAGIC contributors$/m);
    assert.doesNotMatch(licenseText, /OpenCircuit/);
    const expectations = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "tests", "expectations.json"), "utf8"));
    assert.ok(expectations.tests.length > 0);
    assert.ok(expectations.tests.some((entry) => entry.analysis_type === "transient"));
    const benches = fs.readdirSync(path.join(result[0].package_path, "tests")).filter((name) => name.endsWith(".cir"));
    assert.ok(benches.length > 0);
    for (const bench of benches) {
      const text = fs.readFileSync(path.join(result[0].package_path, "tests", bench), "utf8");
      const temperature = text.match(/^\.temp\s+([^\s]+)$/m);
      assert.equal(Number(temperature?.[1]), 25, `${bench} must pin the cited nominal temperature`);
    }
    assert.match(fs.readFileSync(path.join(result[0].package_path, "tests", "forward_01.cir"), "utf8"), /Itest 0 anode PULSE\(/);
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    assert.ok(facts.fit_points.some((point) => point.current.value === 0.01 && point.current.unit === "A" && point.voltage.value === 0.72 && point.voltage.unit === "V"));
    assert.equal(facts.electrical_limits.reverse_current_5v.value, 2e-6);
    assert.equal(facts.electrical_limits.reverse_current_5v.unit, "A");
    assert.deepEqual(validatePackage(result[0].package_path, { requireEvidenceContract: true }).errors, [], "bulk packages must pass strict evidence-contract validation by construction");
    const expectationsPath = path.join(result[0].package_path, "tests", "expectations.json");
    const linked = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));
    linked.tests[0].scalar_checks[0].citation_id = `sha256:${"0".repeat(64)}`;
    fs.writeFileSync(expectationsPath, JSON.stringify(linked));
    assert.ok(
      validatePackage(result[0].package_path, { requireEvidenceContract: true }).errors.some((error) => error.includes("does not resolve to facts evidence")),
      "strict diode validation must fail closed when an expectation citation link is malformed",
    );
    fs.writeFileSync(expectationsPath, JSON.stringify(expectations));
    const fittedPath = path.join(result[0].package_path, "fitted.json");
    const malformedFitted = JSON.parse(fs.readFileSync(fittedPath, "utf8"));
    malformedFitted.residuals[0].evidence_identity.evidence_id = `sha256:${"1".repeat(64)}`;
    fs.writeFileSync(fittedPath, JSON.stringify(malformedFitted));
    assert.ok(
      validatePackage(result[0].package_path, { requireEvidenceContract: true }).errors.some((error) => error.includes("fitted.residuals[0] does not resolve to facts evidence")),
      "strict diode validation must fail closed when a residual evidence link is malformed",
    );
    assert.doesNotMatch(result[0].package_path, /packages\/model-library/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("bench temperature pinning preserves an exact non-25 C directive", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-temperature-test-"));
  try {
    const tests = path.join(root, "tests");
    fs.mkdirSync(tests);
    const bench = path.join(tests, "constraint.cir");
    fs.writeFileSync(bench, "temperature fixture\n.model M D\n.temp 75\nV1 n 0 0\n.op\n.end\n");
    pinPackageBenchTemperature(root);
    const text = fs.readFileSync(bench, "utf8");
    assert.equal(text.match(/^\.temp 75$/gm)?.length, 1);
    assert.equal(text.match(/^\.temp 25$/gm)?.length ?? 0, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("native curve-backed NMOS and PMOS stage end to end with complete point identities", { timeout: 600_000 }, () => {
  for (const polarity of ["n", "p"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `factory-${polarity}mos-f2-stage-`));
    try {
      const pdf = path.join(root, "datasheet.pdf");
      fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
      const extractionPath = path.join(root, "extraction.json");
      fs.writeFileSync(extractionPath, JSON.stringify(curveBackedMosfetExtraction(polarity)));
      const manifestPath = path.join(root, "batch.json");
      const base = mosfetPart(pdf);
      fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{
        ...base, mpn: `FIXTURE-${polarity.toUpperCase()}F2`, subcategory: polarity === "p" ? "P-Channel MOSFET" : "N-Channel MOSFET", extraction_path: extractionPath,
      }] }));
      const [result] = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
      assert.equal(result.status, "staged", JSON.stringify(result));
      assert.equal(result.fidelity, "F2");
      assert.deepEqual(validatePackage(result.package_path, { requireEvidenceContract: true }).errors, []);
      const facts = JSON.parse(fs.readFileSync(path.join(result.package_path, "facts.json"), "utf8"));
      assert.ok(facts.curves[0].points.every((point) => point.evidence_identity.point_index === point.point_index));
      const model = fs.readFileSync(path.join(result.package_path, "model.cir"), "utf8");
      if (polarity === "p") {
        assert.match(model, /VDMOS\(\s*pchan VTO=-/);
        fs.writeFileSync(path.join(result.package_path, "model.cir"), model.replace(/VTO=-/, "VTO="));
        assert.ok(validatePackage(result.package_path, { requireEvidenceContract: true }).errors.some((error) => error.includes("PMOS VTO must be negative")));
      } else assert.match(model, /VDMOS\(\s*VTO=\+?/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("forced F1 MOSFET refuses silently defaulted critical calibration", () => {
  assert.throws(
    () => fitBulkPart(mosfetPart("unused.pdf"), null, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /critical calibration requires a datasheet extraction/,
  );
});

test("F1 MOSFET bounds are constraints while interval midpoints and maxima are seeds only", () => {
  const thresholdConditions = "VDS = VGS, ID = 250 µA, TJ = 25 °C; test mode = DC";
  const rdsonConditions = "VGS = 5 V, ID = 0.2 A, TJ = 25 °C; test mode = DC";
  const payload = { source_sha256: fixtureSourceSha256, specs: {
    polarity: "n",
    threshold_min: { ...quantity(0.5, "V"), conditions: thresholdConditions, source_kind: "minimum" },
    threshold_typ: null,
    threshold_max: { ...quantity(1.5, "V"), conditions: thresholdConditions, source_kind: "maximum" },
    rdson_points: [{
      vgs: { ...quantity(5, "V"), conditions: rdsonConditions },
      current: { ...quantity(0.2, "A"), conditions: rdsonConditions },
      resistance: { ...quantity(3.5, "ohm"), conditions: rdsonConditions, source_kind: "maximum" },
    }],
    ciss: quantity(45e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(4e-12, "F"),
  } };
  let runnerPayload;
  const fit = fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, payload, {
    forceF1: true,
    ngspiceRunner: () => ({ pass: true }),
    mosfetConstraintRunner: (input) => { runnerPayload = input; return passThroughConstraintRunner(input); },
  });
  assert.equal(fit.evidence_mode, "interval-constrained");
  assert.equal(fit.residuals?.length ?? 0, 0);
  assert.equal(fit.calibration.residual_target_count, 0);
  assert.deepEqual(runnerPayload.constraints.map((constraint) => constraint.kind), ["threshold_interval", "rdson_maximum"]);
  assert.deepEqual(fit.calibration.seeds.map((seed) => seed.evidence_role), ["interval_midpoint_seed_only", "bound_value_seed_only"]);
  assert.ok(fit.calibration.seeds.every((seed) => seed.scored_as_residual === false));
  assert.equal(fit.parameters.KP, 2 / 3.5, "a maximum may seed the optimizer but is not scaled into a synthetic target");
});

test("content-addressed semantics admit threshold not_stated without parsing disclosures", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  const original = structuredClone(extraction);
  const first = intervalAdjudication(extraction, { disclosures: ["typical output characteristic", "arbitrary Luna disclosure wording"] });
  const second = intervalAdjudication(extraction, { disclosures: ["same facts, completely different disclosure prose"] });
  const adjudicatedFirst = applyConditionAdjudicationSupplement(part, extraction, first);
  const adjudicatedSecond = applyConditionAdjudicationSupplement(part, extraction, second);
  let firstPayload;
  let secondPayload;
  const firstFit = fitBulkPart(part, adjudicatedFirst, {
    forceF1: true,
    mosfetConstraintRunner: (payload) => { firstPayload = payload; return passThroughConstraintRunner(payload); },
  });
  const secondFit = fitBulkPart(part, adjudicatedSecond, {
    forceF1: true,
    mosfetConstraintRunner: (payload) => { secondPayload = payload; return passThroughConstraintRunner(payload); },
  });
  assert.equal(firstFit.evidence_mode, "interval-constrained");
  assert.equal(firstPayload.constraints[0].condition_identity.test_mode.kind, "dc");
  assert.ok(firstPayload.constraints[0].condition_identity.qualifiers.some((item) => item.key === "source_test_mode" && item.value === "not_stated"));
  assert.equal(firstPayload.constraints[0].condition_identity.condition_id, secondPayload.constraints[0].condition_identity.condition_id);
  assert.deepEqual(extraction, original, "semantic adjudication must not mutate the immutable extraction");
});

test("validated semantic fit view cannot mutate after hash verification", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  const supplement = intervalAdjudication(extraction);
  const adjudicated = applyConditionAdjudicationSupplement(part, extraction, supplement);

  assert.ok(Object.isFrozen(adjudicated));
  assert.ok(Object.isFrozen(adjudicated.specs.threshold_min));
  assert.ok(Object.isFrozen(adjudicated.specs.threshold_min.condition_semantics));
  assert.throws(() => { adjudicated.specs.threshold_min.value = 0.05; }, TypeError);
  assert.throws(() => { adjudicated.specs.threshold_max.value = 0.15; }, TypeError);
  assert.throws(() => {
    adjudicated.specs.threshold_min.condition_semantics.condition.temperature.value_c = 125;
  }, TypeError);

  let runnerPayload;
  const fit = fitBulkPart(part, adjudicated, {
    forceF1: true,
    mosfetConstraintRunner: (payload) => {
      runnerPayload = payload;
      return passThroughConstraintRunner(payload);
    },
  });
  assert.equal(fit.evidence_mode, "interval-constrained");
  assert.equal(runnerPayload.constraints[0].minimum_v, 0.5);
  assert.equal(runnerPayload.constraints[0].maximum_v, 1.5);

  extraction.specs.threshold_min.value = 0.05;
  assert.throws(
    () => stageBulkPart(part, adjudicated, fit, path.join(semanticFixtureRoot, "mutated-source-stage"), { sourceExtraction: extraction }),
    /source extraction no longer matches its validated snapshot/,
  );
});

test("manifest staging preserves the original extraction while using validated semantics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-semantic-stage-test-"));
  try {
    const extraction = intervalMosfetExtraction();
    const extractionBytes = Buffer.from(JSON.stringify(extraction));
    const supplement = intervalAdjudication(extraction, { disclosures: ["staging disclosure remains sidecar-only"] });
    const extractionPath = path.join(root, "extraction.json");
    const supplementPath = path.join(root, "supplement.json");
    fs.writeFileSync(extractionPath, extractionBytes);
    fs.writeFileSync(supplementPath, JSON.stringify(supplement));
    const manifestPath = path.join(root, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({
      schema_version: "1.0.0",
      kind: "opencircuit-conveyor-batch",
      parts: [{
        ...semanticMosfetPart(),
        subcategory: "N-Channel MOSFET",
        extraction_path: extractionPath,
        adjudication_supplement_path: supplementPath,
        force_f1: true,
      }],
    }));
    const [result] = runBulkManifest(manifestPath, path.join(root, "staging"), {
      libraryRoot: path.join(root, "empty-library"),
      mosfetConstraintRunner: passThroughConstraintRunner,
    });
    assert.equal(result.status, "staged", JSON.stringify(result));
    const facts = JSON.parse(fs.readFileSync(path.join(result.package_path, "facts.json"), "utf8"));
    assert.deepEqual(facts.extraction, extraction);
    assert.ok(!JSON.stringify(facts.extraction).includes("condition_semantics"));
    assert.ok(facts.threshold.minimum.condition_identity.qualifiers.some((item) => item.key === "source_test_mode" && item.value === "not_stated"));
    assert.equal(facts.rdson_points[0].resistance.condition_identity.electrical.vds.relation, "vds_not_stated");
    const component = JSON.parse(fs.readFileSync(path.join(result.package_path, "component.json"), "utf8"));
    const expectations = JSON.parse(fs.readFileSync(path.join(result.package_path, "tests", "expectations.json"), "utf8"));
    assert.ok(expectations.evidence_cohorts.length > 0);
    assert.ok(expectations.evidence_cohorts.every((cohort) => cohort.fidelity_tier === component.fidelity_tier));
    assert.deepEqual(component.supported_analyses, ["operating_point"]);
    assert.ok(component.supported_operating_region.numeric_bounds.every((bound) => bound.kind === "enumerated"));
    assert.ok(component.supported_operating_region.numeric_bounds.every((bound) => (
      bound.minimum === bound.values[0] && bound.maximum === bound.values.at(-1)
      && /confer no range or interpolation authority/.test(bound.conditions)
    )));
    assert.deepEqual(component.supported_operating_region.numeric_bounds.find((bound) => bound.quantity === "vgs").values, [5]);
    assert.deepEqual(component.supported_operating_region.numeric_bounds.find((bound) => bound.quantity === "id").values, [250e-6, 0.2]);
    assert.equal(component.supported_operating_region.numeric_bounds.some((bound) => bound.quantity === "vds"), false);
    assert.match(component.supported_operating_region.summary, /coupled cited condition-ID tuples/);
    assert.match(component.supported_operating_region.summary, /not Cartesian ranges/);
    assert.match(component.known_omissions.join("\n"), /interpolation and DC sweeps are excluded/);
    assert.match(component.known_omissions.join("\n"), /non-claim numerical auxiliaries/);
    assert.match(component.known_omissions.join("\n"), /do not state VDS/);
    assert.match(component.known_omissions.join("\n"), /Off-state behavior/);
    assert.match(component.known_omissions.join("\n"), /Body-diode forward behavior/);
    assert.match(component.known_omissions.join("\n"), /Breakdown, avalanche energy/);
    assert.match(component.known_omissions.join("\n"), /Gate charge, Miller behavior/);
    assert.match(component.known_omissions.join("\n"), /Temperature scaling, self-heating/);
    const validation = JSON.parse(fs.readFileSync(path.join(result.package_path, "validation-results.json"), "utf8"));
    assert.equal(validation.strict_dual_engine_expectations, true);
    assert.match(validation.engines.native.version, /ngspice/i);
    assert.ok(validation.engines.browser_wasm.version);
    assert.ok(validation.engines.browser_wasm.ngspice_version);
    assert.match(validation.artifact_hashes.model_cir, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(validation.artifact_hashes.benches).sort(), validation.benches.map((bench) => bench.test_netlist).sort());
    for (const bench of validation.benches) {
      assert.equal(bench.bench_sha256, validation.artifact_hashes.benches[bench.test_netlist]);
      assert.match(bench.bench_sha256, /^sha256:[0-9a-f]{64}$/);
      for (const check of bench.checks) {
        assert.equal(typeof check.native.value, "number");
        assert.equal(typeof check.native.pass, "boolean");
        assert.equal(typeof check.browser_wasm.value, "number");
        assert.equal(typeof check.browser_wasm.pass, "boolean");
        assert.equal(check.pass, check.native.pass && check.browser_wasm.pass);
      }
    }
    assert.deepEqual(validatePackage(result.package_path, { requireEvidenceContract: true }).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("typed semantic mutations fail before fitting", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  const mutations = [
    ["unknown typed field", (supplement) => { supplement.entries[0].condition.unexpected = true; }],
    ["temperature not stated", (supplement) => { supplement.entries[0].condition.temperature = { status: "not_stated" }; }],
    ["RDS not stated", (supplement) => { supplement.entries[1].condition.test_mode = { kind: "not_stated" }; }],
    ["typed current drift", (supplement) => { supplement.entries[0].condition.electrical.id.value_a = 500e-6; }],
  ];
  for (const [name, mutate] of mutations) {
    const supplement = intervalAdjudication(extraction);
    mutate(supplement);
    supplement.supplement_id = contentHash(Object.fromEntries(Object.entries(supplement).filter(([key]) => key !== "supplement_id")));
    assert.throws(() => {
      const adjudicated = applyConditionAdjudicationSupplement(part, extraction, supplement);
      fitBulkPart(part, adjudicated, { forceF1: true, mosfetConstraintRunner: passThroughConstraintRunner });
    }, undefined, name);
  }
});

test("raw extraction semantics cannot bypass supplement validation", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  const supplement = intervalAdjudication(extraction);
  const forged = structuredClone(extraction);
  forged.specs.threshold_min.condition_semantics = {
    schema_version: "1.0.0",
    characteristic: "gate_threshold",
    condition: supplement.entries[0].condition,
    disclosures: [],
    supplement_id: supplement.supplement_id,
  };
  assert.throws(
    () => fitBulkPart(part, forged, { forceF1: true, mosfetConstraintRunner: passThroughConstraintRunner }),
    /were not loaded from a validated supplement/,
  );
});

test("supplement source hash must match canonical datasheet bytes", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  extraction.source_sha256 = "f".repeat(64);
  const supplement = intervalAdjudication(extraction);
  assert.throws(
    () => applyConditionAdjudicationSupplement(part, extraction, supplement),
    /source hash does not match the canonical datasheet bytes/,
  );
});

test("supplement extraction bytes must encode the trusted extraction object", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const bytesExtraction = intervalMosfetExtraction();
  const extractionBytes = Buffer.from(JSON.stringify(bytesExtraction));
  const rawExtraction = structuredClone(bytesExtraction);
  rawExtraction.specs.threshold_min.value = 0.05;
  rawExtraction.specs.threshold_max.value = 0.15;
  const supplement = intervalAdjudication(rawExtraction);
  supplement.extraction_sha256 = `sha256:${createHash("sha256").update(extractionBytes).digest("hex")}`;
  supplement.supplement_id = contentHash(Object.fromEntries(Object.entries(supplement).filter(([key]) => key !== "supplement_id")));
  assert.throws(
    () => applyConditionAdjudicationSupplement(part, rawExtraction, supplement, extractionBytes),
    /extraction bytes do not encode the supplied extraction object/,
  );
});

test("pulsed adjudication cannot enter a static MOSFET fit", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  const supplement = intervalAdjudication(extraction);
  supplement.entries[0].condition.test_mode = { kind: "pulsed", pulse_width_s: 1e-6 };
  supplement.supplement_id = contentHash(Object.fromEntries(Object.entries(supplement).filter(([key]) => key !== "supplement_id")));
  const adjudicated = applyConditionAdjudicationSupplement(part, extraction, supplement);
  assert.throws(
    () => fitBulkPart(part, adjudicated, { forceF1: true, mosfetConstraintRunner: passThroughConstraintRunner }),
    /pulsed evidence and cannot enter a static DC MOSFET fit/,
  );
});

test("supplement hashes bind extraction values, units, citations, conditions, and points", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const original = intervalMosfetExtraction();
  const supplement = intervalAdjudication(original);
  for (const mutate of [
    (value) => { value.specs.threshold_min.value = 0.6; },
    (value) => { value.specs.threshold_min.unit = "mV"; },
    (value) => { value.specs.threshold_min.page_reference = "p. 9, other row"; },
    (value) => { value.specs.threshold_min.conditions += "; changed"; },
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => applyConditionAdjudicationSupplement(part, changed, supplement), /extraction hash does not match/);
  }
  const targetTamper = structuredClone(supplement);
  targetTamper.entries[0].targets[0].target_sha256 = `sha256:${"0".repeat(64)}`;
  targetTamper.supplement_id = contentHash(Object.fromEntries(Object.entries(targetTamper).filter(([key]) => key !== "supplement_id")));
  assert.throws(() => applyConditionAdjudicationSupplement(part, original, targetTamper), /target_sha256/);
});

test("signed positive temperatures and prose-independent P-channel magnitudes are accepted", () => {
  const part = semanticMosfetPart();
  const extraction = intervalMosfetExtraction({ polarity: "p", temperatureText: "TJ = +25 °C" });
  const supplement = intervalAdjudication(extraction, {
    magnitude: "absolute",
    disclosures: ["p-channel value recorded as magnitude", "typical figure label retained"],
  });
  const adjudicated = applyConditionAdjudicationSupplement(part, extraction, supplement);
  const fit = fitBulkPart(part, adjudicated, { forceF1: true, mosfetConstraintRunner: passThroughConstraintRunner });
  assert.equal(fit.evidence_mode, "interval-constrained");
  assert.equal(fit.calibration.constraints[0].condition_identity.temperature.value_c, 25);
  assert.equal(fit.calibration.constraints[0].condition_identity.magnitude_convention, "absolute");
});

test("typed absolute curve semantics reject signed source coordinates", () => {
  const part = semanticMosfetPart();
  const extraction = curveBackedMosfetExtraction("p");
  extraction.source_sha256 = semanticSourceSha256;
  extraction.curves[0].points = extraction.curves[0].points.map((point) => ({ x: -Math.abs(point.x), y: -Math.abs(point.y) }));
  extraction.curves[0].test_conditions = "VDS = -10 V, TJ = +25 °C";
  const xs = extraction.curves[0].points.map((point) => Math.abs(point.x));
  const ys = extraction.curves[0].points.map((point) => Math.abs(point.y));
  const supplement = adjudicationSupplement(extraction, [{
    characteristic: "transfer_current",
    targets: ["/curves/0"],
    condition: semanticCondition({ polarity: "p", magnitude: "absolute", provenance: "figure_label", mode: "not_stated", electrical: {
      vgs: { kind: "range", lower_v: Math.min(...xs), upper_v: Math.max(...xs) },
      vds: { kind: "fixed", value_v: 10 },
      id: { kind: "range", lower_a: Math.min(...ys), upper_a: Math.max(...ys) },
    } }),
    disclosures: ["source figure uses signed P-channel coordinates"],
  }]);
  const adjudicated = applyConditionAdjudicationSupplement(part, extraction, supplement);
  assert.throws(() => fitBulkPart(part, adjudicated), /magnitude convention contradicts signed curve coordinates/);
});

test("one-sided threshold evidence remains insufficient after semantic adjudication", () => {
  const part = { ...semanticMosfetPart(), subcategory: "N-Channel MOSFET" };
  const extraction = intervalMosfetExtraction();
  delete extraction.specs.threshold_max;
  const supplement = adjudicationSupplement(extraction, [{
    characteristic: "gate_threshold",
    targets: ["/specs/threshold_min"],
    condition: semanticCondition({ mode: "not_stated", electrical: {
      vgs: { kind: "relation", relation: "vds_equals_vgs" },
      vds: { kind: "relation", relation: "vds_equals_vgs" },
      id: { kind: "fixed", value_a: 250e-6 },
    } }),
    disclosures: [],
  }]);
  const adjudicated = applyConditionAdjudicationSupplement(part, extraction, supplement);
  assert.throws(() => fitBulkPart(part, adjudicated, { forceF1: true, mosfetConstraintRunner: passThroughConstraintRunner }), /both minimum and maximum/);
});

test("pre-demoted bulk part keeps extraction and p-channel metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-bulk-pmos-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    const mosfetExtraction = {
      schema_version: "1.0.0", mpn: "FIXTURE-P1", manufacturer: "Fixture Semi", family: "mosfet",
      datasheet_identity: { title: "Fixture P1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: false, curves: [],
      specs: { ...typicalMosfetExtraction("p").specs, breakdown_voltage: quantity(30, "V"), body_diode: null },
      extraction_notes: [], omission_reason: "curve unavailable",
    };
    fs.writeFileSync(extractionPath, JSON.stringify(mosfetExtraction));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...mosfetPart(pdf), extraction_path: extractionPath, force_f1: true, demotion_reason: "catalog discrepancy" }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library"), ngspiceRunner: () => ({ pass: true }), mosfetConstraintRunner: passThroughConstraintRunner });
    assert.equal(result[0].demotion_reason, "catalog discrepancy");
    const component = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "component.json"), "utf8"));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    assert.equal(component.electrical_family, "pmos");
    assert.match(component.known_omissions.join("\n"), /catalog discrepancy/);
    assert.equal(facts.extraction.mpn, "FIXTURE-P1");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("F1 diode fallback narrows a failed curve claim to its calibration point", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-diode-narrow-f1-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const payload = extraction();
    payload.usable_curves = false;
    payload.curves = [];
    payload.omission_reason = "curve fit did not meet the F2 gate";
    payload.specs.forward_voltage_points = [
      { current: { ...quantity(0.1, "A"), source_kind: "digitized_typical_curve" }, voltage: { ...quantity(0.25, "V"), source_kind: "digitized_typical_curve" } },
      { current: { ...quantity(50, "A"), source_kind: "digitized_typical_curve" }, voltage: { ...quantity(1.05, "V"), source_kind: "digitized_typical_curve" } },
      { current: { ...quantity(2, "A"), source_kind: "maximum" }, voltage: { ...quantity(0.55, "V"), source_kind: "maximum" } },
    ];
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    assert.deepEqual(facts.fit_points.map((point) => point.current.value), [0.1, 2]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("F1 BJT fit does not turn a published maximum gain into a typical target", () => {
  const payload = {
    specs: {
      polarity: "npn",
      gain_points: [
        { hfe: { ...quantity(120, "1"), source_kind: "minimum" } },
        { hfe: { ...quantity(350, "1"), source_kind: "maximum" } },
        { hfe: { ...quantity(118, "1"), source_kind: "digitized_typical_curve" } },
      ],
    },
  };
  const fit = fitBulkPart({ mpn: "FIXTURE-Q1", manufacturer: "Fixture Semi", conveyor_family: "bjt", subcategory: "NPN" }, payload, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.parameters.BF, 118);
});

test("F1 BJT fit parameterizes slightly above a published minimum", () => {
  const payload = { specs: { polarity: "npn", gain_points: [
    { hfe: { ...quantity(60, "1"), source_kind: "minimum" } },
    { hfe: { ...quantity(400, "1"), source_kind: "maximum" } },
  ] } };
  const fit = fitBulkPart({ mpn: "FIXTURE-Q2", manufacturer: "Fixture Semi", conveyor_family: "bjt", subcategory: "NPN" }, payload, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.parameters.BF, 60.6);
});

test("signed P-channel RDS evidence is magnitude-normalized before bench polarity is applied", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-signed-pmos-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const payload = {
      schema_version: "1.0.0", mpn: "FIXTURE-P1", manufacturer: "Fixture Semi", family: "mosfet",
      datasheet_identity: { title: "Fixture P1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: false, curves: [],
      source_sha256: fixtureSourceSha256,
      specs: {
        polarity: "p",
        threshold_min: { ...quantity(-0.7, "V"), conditions: "VDS = VGS, ID = -250 µA, TJ = 25 °C; test mode = DC", source_kind: "minimum" },
        threshold_typ: null,
        threshold_max: { ...quantity(-1.3, "V"), conditions: "VDS = VGS, ID = -250 µA, TJ = 25 °C; test mode = DC", source_kind: "maximum" },
        rdson_points: [
          { vgs: { ...quantity(-10, "V"), conditions: "VGS = -10 V, ID = -4.2 A, TJ = 25 °C; test mode = DC" }, current: { ...quantity(-4.2, "A"), conditions: "VGS = -10 V, ID = -4.2 A, TJ = 25 °C; test mode = DC" }, resistance: { ...quantity(0.065, "ohm"), conditions: "VGS = -10 V, ID = -4.2 A, TJ = 25 °C; test mode = DC", source_kind: "maximum" } },
          { vgs: { ...quantity(-4.5, "V"), conditions: "VGS = -4.5 V, ID = -4 A, TJ = 25 °C; test mode = DC" }, current: { ...quantity(-4, "A"), conditions: "VGS = -4.5 V, ID = -4 A, TJ = 25 °C; test mode = DC" }, resistance: { ...quantity(0.075, "ohm"), conditions: "VGS = -4.5 V, ID = -4 A, TJ = 25 °C; test mode = DC", source_kind: "maximum" } },
        ],
        ciss: quantity(954e-12, "F"), coss: quantity(115e-12, "F"), crss: quantity(77e-12, "F"), breakdown_voltage: quantity(-30, "V"), body_diode: null,
      },
      extraction_notes: [], omission_reason: "curve unavailable",
    };
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...mosfetPart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "fitted.json"), "utf8"));
    assert.deepEqual(facts.rdson_points.map((point) => [point.vgs.value, point.current.value]), [[10, 4.2], [4.5, 4]]);
    assert.equal(fitted.evidence_mode, "interval-constrained");
    assert.equal(fitted.calibration.constraints.length, 3);
    assert.equal(fitted.residuals.length, 0);
    assert.ok(Object.values(fitted.parameter_metadata).filter((metadata) => metadata.evidence_mode).every((metadata) => metadata.evidence_mode === "interval-constrained"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("catalog range and documented package-marking identities normalize into aliases", () => {
  const ranged = normalizedIdentity({ mpn: "B772(RANGE:160-320)", manufacturer: "Fixture Semi" });
  assert.equal(ranged.canonical, "B772");
  assert.deepEqual(ranged.aliases, ["B772(RANGE:160-320)"]);
  const marked = normalizedIdentity(
    { mpn: "CJ2301 S1", manufacturer: "Fixture Semi" },
    { datasheet_identity: { title: "CJ2301 P-Channel MOSFET" }, extraction_notes: ["The datasheet prints MARKING: S1."] },
  );
  assert.equal(marked.canonical, "CJ2301");
  assert.deepEqual(marked.aliases, ["CJ2301 S1"]);
  const markedRange = normalizedIdentity(
    { mpn: "S9012 2T1(RANGE:200-350)", manufacturer: "Fixture Semi" },
    { datasheet_identity: { title: "S9012 PNP transistor" }, extraction_notes: ["Marking 2T1 is classification rank H with hFE range 200-350."] },
  );
  assert.equal(markedRange.canonical, "S9012");
  assert.deepEqual(markedRange.aliases, ["S9012 2T1(RANGE:200-350)"]);
  const fullWidthMark = normalizedIdentity(
    { mpn: "2SC1623（L6）", manufacturer: "Fixture Semi" },
    { datasheet_identity: { title: "2SC1623 NPN transistor" }, extraction_notes: ["The L6 bin is identified by its hFE classification range."] },
  );
  assert.equal(fullWidthMark.canonical, "2SC1623");
  assert.deepEqual(fullWidthMark.aliases, ["2SC1623（L6）"]);
  const titleCorroboratedMark = normalizedIdentity(
    { mpn: "MMBT8050D(J3Y)", manufacturer: "ST Semtech" },
    { datasheet_identity: { title: "MMBT8050D NPN transistor" }, extraction_notes: ["Target identity preserved."] },
  );
  assert.equal(titleCorroboratedMark.canonical, "MMBT8050D");
  assert.deepEqual(titleCorroboratedMark.aliases, ["MMBT8050D(J3Y)"]);
  const gainRankAndMark = normalizedIdentity(
    { mpn: "MMBT8050D(J3Y)", manufacturer: "ST Semtech" },
    { datasheet_identity: { title: "MMBT8050 NPN transistor" }, extraction_notes: ["Identity preserved from the supplied target."] },
  );
  assert.equal(gainRankAndMark.canonical, "MMBT8050");
  assert.deepEqual(gainRankAndMark.aliases, ["MMBT8050D(J3Y)"]);
  const supplierTag = normalizedIdentity(
    { mpn: "FDN304P(UMW)", manufacturer: "UMW" },
    { datasheet_identity: { title: "UMW FDN304P P-Channel MOSFET" }, extraction_notes: [] },
  );
  assert.equal(supplierTag.canonical, "FDN304P");
  assert.deepEqual(supplierTag.aliases, ["FDN304P(UMW)"]);
  const tapeReelSupplierTag = normalizedIdentity(
    { mpn: "IRLR7843TR(UMW)", manufacturer: "UMW" },
    { datasheet_identity: { title: "IRLR7843 30V N-Channel MOSFET" }, extraction_notes: [] },
  );
  assert.equal(tapeReelSupplierTag.canonical, "IRLR7843");
  assert.deepEqual(tapeReelSupplierTag.aliases, ["IRLR7843TR(UMW)"]);
});

test("Nexperia ordering suffixes normalize into aliases", () => {
  const identity = normalizedIdentity({ mpn: "BAS316,115", manufacturer: "Nexperia" });
  assert.equal(identity.canonical, "BAS316");
  assert.deepEqual(identity.aliases, ["BAS316,115"]);
  assert.equal(identity.packageSlug, "BAS316-115");
});

test("datasheet-corroborated comma ordering codes normalize into aliases", () => {
  const identity = normalizedIdentity(
    { mpn: "T2N7002BK,LM", manufacturer: "TOSHIBA" },
    {
      datasheet_identity: { title: "T2N7002BK MOSFETs Silicon N-Channel MOS" },
      extraction_notes: ["Ordering-code identity is preserved: the requested ordering code is T2N7002BK,LM."],
    },
  );
  assert.equal(identity.canonical, "T2N7002BK");
  assert.deepEqual(identity.aliases, ["T2N7002BK,LM"]);
  assert.equal(identity.packageSlug, "T2N7002BK-LM");
});

test("bulk staging skips canonical and ordering-code alias collisions before fitting", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-collision-test-"));
  try {
    const library = path.join(root, "models");
    const existing = path.join(library, "onsemi", "MMBT2222A");
    fs.mkdirSync(existing, { recursive: true });
    fs.writeFileSync(path.join(existing, "component.json"), JSON.stringify({ canonical_mpn: "MMBT2222A", ordering_code_aliases: ["MMBT2222ALT1G"] }));
    assert.match(libraryCollisionReason({ mpn: "MMBT2222ALT1G", manufacturer: "onsemi" }, library), /onsemi\/MMBT2222A/);

    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), mpn: "MMBT2222ALT1G" }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: library });
    assert.equal(result[0].status, "skipped");
    assert.equal(result[0].stage, "selection");
    assert.match(result[0].reason, /ordering|identity collision/i);
    assert.equal(fs.existsSync(path.join(root, "staging", "packages")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("duplicate die vectors are rejected against the library and across one batch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-duplicate-die-test-"));
  try {
    const library = path.join(root, "models");
    const existing = path.join(library, "fixture", "EXISTING-P1");
    fs.mkdirSync(existing, { recursive: true });
    const fit = fitBulkPart(mosfetPart("unused.pdf"), typicalMosfetExtraction("p"), { forceF1: true, ngspiceRunner: () => ({ pass: true }), mosfetConstraintRunner: passThroughConstraintRunner });
    fs.writeFileSync(path.join(existing, "component.json"), JSON.stringify({ electrical_family: "pmos" }));
    fs.writeFileSync(path.join(existing, "fitted.json"), JSON.stringify({ parameters: fit.parameters }));
    assert.match(libraryDuplicateDieReason(mosfetPart("unused.pdf"), fit, library), /fixture\/EXISTING-P1/);

    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const mosfetExtraction = {
      schema_version: "1.0.0", mpn: "FIXTURE-P1", manufacturer: "Fixture Semi", family: "mosfet",
      datasheet_identity: { title: "Fixture P1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: false, curves: [],
      specs: { ...typicalMosfetExtraction("p").specs, breakdown_voltage: quantity(30, "V"), body_diode: null },
      extraction_notes: [], omission_reason: "curve unavailable",
    };
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(mosfetExtraction));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [
      { ...mosfetPart(pdf), mpn: "FIXTURE-P1A", extraction_path: extractionPath, force_f1: true },
      { ...mosfetPart(pdf), mpn: "FIXTURE-P1B", extraction_path: extractionPath, force_f1: true },
    ] }));
    const results = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library"), ngspiceRunner: () => ({ pass: true }), mosfetConstraintRunner: passThroughConstraintRunner });
    assert.deepEqual(results.map((result) => result.status), ["skipped", "skipped"]);
    assert.ok(results.every((result) => /same-batch candidate/.test(result.reason)));
    assert.equal(fs.existsSync(path.join(root, "staging", "packages", "fixture-semi", "FIXTURE-P1A")), false);
    assert.equal(fs.existsSync(path.join(root, "staging", "packages", "fixture-semi", "FIXTURE-P1B")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("known bare-page evidence is repaired to an explicit page and figure citation", () => {
  const input = { curves: [{ page_reference: "3" }], specs: { gain: { page_reference: "3" } } };
  const repaired = repairKnownEvidenceDefects({ mpn: "MMBT2222ALT1G" }, input);
  assert.equal(repaired.curves[0].page_reference, "p. 3, Figure 3, DC Current Gain");
  assert.equal(repaired.specs.gain.page_reference, "p. 3, Figure 3, DC Current Gain");
  assert.equal(input.curves[0].page_reference, "3", "preserved extraction input must not be mutated");
});

test("bulk manifest validation is strict while legacy registry remains independent", () => {
  assert.throws(() => normalizeBulkManifest({ schema_version: "1.0.0", kind: "wrong", parts: [] }), /Unsupported conveyor bulk manifest/);
});

test("exact package variants support repeated electrical nodes across real multi-pin packages and reject ambiguous maps", () => {
  const pinInfo = {
    pins: [
      { name: "G", number: "1", role: "gate", node: "gate" },
      { name: "D", number: "2", role: "drain", node: "drain" },
      { name: "S", number: "3", role: "source", node: "source" },
    ],
  };
  const variant = {
    name: "VSON-CLIP (D2PAK-compatible pin semantics)",
    standard: "TI SON 5 mm x 6 mm",
    pin_count: 8,
    pin_map: [
      { package_pin: "1", symbol_pin_number: "3" },
      { package_pin: "2", symbol_pin_number: "3" },
      { package_pin: "3", symbol_pin_number: "3" },
      { package_pin: "4", symbol_pin_number: "1" },
      { package_pin: "5", symbol_pin_number: "2" },
      { package_pin: "6", symbol_pin_number: "2" },
      { package_pin: "7", symbol_pin_number: "2" },
      { package_pin: "8", symbol_pin_number: "2" },
    ],
  };
  assert.deepEqual(normalizePackageVariants([variant], pinInfo), [variant]);

  const mutate = (change) => {
    const candidate = structuredClone(variant);
    change(candidate);
    return candidate;
  };
  assert.throws(
    () => normalizePackageVariants([mutate((candidate) => { candidate.pin_map[1].package_pin = "1"; })], pinInfo),
    /duplicates package pin 1/,
  );
  assert.throws(
    () => normalizePackageVariants([mutate((candidate) => { candidate.pin_map[1].symbol_pin_number = "9"; })], pinInfo),
    /unknown symbol pin 9/,
  );
  assert.throws(
    () => normalizePackageVariants([mutate((candidate) => { candidate.pin_count = 7; })], pinInfo),
    /pin_map count must exactly match pin_count 7/,
  );
  assert.throws(
    () => normalizePackageVariants([variant, structuredClone(variant)], pinInfo),
    /duplicates a package variant name and standard/,
  );
  assert.throws(
    () => normalizePackageVariants([mutate((candidate) => {
      candidate.pin_map = candidate.pin_map.filter((mapping) => mapping.symbol_pin_number !== "1");
      candidate.pin_count = candidate.pin_map.length;
    })], pinInfo),
    /omits electrical symbol pin 1/,
  );
});

// ---------------------------------------------------------------------------------
// Hard gates, after the ceremony relaxation.
//
// The relaxations in this change all loosen how evidence may be SPELLED or how much of
// it must be present. None of them loosen what a package may CLAIM. Each test below
// names the concrete wrong electrical claim its gate prevents, and proves the gate still
// rejects with the relaxed adapter in place.
// ---------------------------------------------------------------------------------

test("gate: a curve's declared axis units are still applied, so a 1000x ordinate error cannot pass", () => {
  // Wrong claim prevented: a milliamp ordinate read as amps makes the part look 1000x
  // stronger than it is, and every current in every circuit built from it is wrong.
  const wrongUnit = productionCurveExtraction();
  wrongUnit.curves[0].y_axis.unit = "furlongs";
  assert.throws(
    () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, wrongUnit),
    /requires voltage and current axes with recognized SI units/,
  );

  // And the units that ARE recognised are converted, never assumed: the same curve
  // declared in milliamps produces different SI points from one declared in amps.
  const inAmps = productionCurveExtraction();
  const inMilliamps = productionCurveExtraction();
  inMilliamps.curves[0].y_axis.unit = "mA";
  const points = (value) => {
    let payload;
    fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, value, {
      fitRunner: (received) => { payload = received; return acceptedF2Attempt(); },
      ngspiceRunner: () => ({ pass: true }),
    });
    return payload.extraction.curves[0].points.map((point) => point.y_si);
  };
  const amps = points(inAmps);
  const milliamps = points(inMilliamps);
  assert.equal(amps.length, milliamps.length);
  for (const [index, value] of amps.entries()) {
    assert.ok(Math.abs(milliamps[index] / value - 1e-3) < 1e-9, "a milliamp ordinate must not be read as amps");
  }
});

test("gate: a curve's source identity is still bound to its own citation and condition", () => {
  // Wrong claim prevented: a curve taken from another figure, another trace or another
  // bias would be fitted as if it described this device at this condition.
  const cases = [
    ["missing trace locator", (curve) => { delete curve.locator.curve_or_trace; }, /invalid fields|curve_or_trace/],
    ["non-integer page", (curve) => { curve.locator.page = "4"; }, /positive integer page/],
    ["point-level identity override", (curve) => { curve.points[0].condition_identity = { condition_id: "sha256:0" }; }, /may not override shared identities/],
    ["bias that contradicts the extraction", (curve) => { curve.electrical_bias[0].value = 9; }, /structured electrical bias disagrees/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const value = productionCurveExtraction();
    mutate(value.curves[0]);
    assert.throws(
      () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, value),
      pattern,
      name,
    );
  }
});

test("gate: pulsed evidence still cannot enter a static DC fit, and a pulse with no width is still refused", () => {
  // Wrong claim prevented: a pulsed measurement is taken before the die heats. Read as
  // DC it claims a lower continuous on-resistance, and a higher continuous current, than
  // the part actually delivers.
  const pulsedCurve = productionCurveExtraction();
  pulsedCurve.curves[0].test_mode = { kind: "pulsed", pulse_width_s: 1e-6, duty_cycle: 0.01 };
  pulsedCurve.curves[0].test_conditions = "VDS = 10 V, TJ = 25 °C; pulsed; pulse width = 1 us; duty cycle = 1%";
  assert.throws(
    () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, pulsedCurve),
    /pulsed evidence and cannot enter a static DC MOSFET fit/,
  );

  // The duty cycle is no longer required. The pulse WIDTH still is: without it there is
  // nothing to check the measurement against the die's self-heating time constant.
  const widthOnly = productionCurveExtraction();
  widthOnly.curves[0].test_mode = { kind: "pulsed", pulse_width_s: 1e-6 };
  widthOnly.curves[0].test_conditions = "VDS = 10 V, TJ = 25 °C; pulsed; pulse width = 1 us";
  assert.throws(
    () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, widthOnly),
    /pulsed evidence and cannot enter a static DC MOSFET fit/,
  );

  const noWidth = productionCurveExtraction();
  noWidth.curves[0].test_mode = { kind: "pulsed" };
  noWidth.curves[0].test_conditions = "VDS = 10 V, TJ = 25 °C; pulse tested";
  assert.throws(
    () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, noWidth),
    /pulsed mode requires pulse_width_s|pulsed evidence must state its pulse width/,
  );
});

test("gate: an unstated test mode is still refused for RDS(on), where the datasheet convention is not static", () => {
  // Wrong claim prevented: RDS(on) is the row datasheets most often pulse-test. Admitting
  // an unknown mode there as DC understates continuous on-resistance. The relaxation
  // widens how a mode may be SPELLED and admits not_stated for the static characteristics
  // (threshold, transfer, output); it does not admit it here.
  const value = productionCurveExtraction();
  for (const field of Object.values(value.specs.rdson_points[0])) {
    delete field.condition;
    field.conditions = "VGS = 4.5 V, ID = 2 A, TJ = 25 degC";
  }
  assert.throws(
    () => evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, value),
    /not_stated is not admitted for rds_on|states no test mode/,
  );

  // The same row with the mode supplied as a typed field, rather than as prose the old
  // phrase list had to recognise, is admitted.
  const typed = productionCurveExtraction();
  for (const field of Object.values(typed.specs.rdson_points[0])) {
    delete field.condition;
    field.conditions = "VGS = 4.5 V, ID = 2 A, TJ = 25 degC";
    field.test_mode = { kind: "dc" };
  }
  const report = evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, typed);
  assert.ok(report.candidate, "a typed test mode is evidence even when the prose never spells one");
});

test("gate: an unstated temperature demotes to F1 and is written into the omissions, and never reaches F2", () => {
  // Wrong claim prevented: a device characteristic with no stated temperature, presented
  // at F2, claims curve-grade accuracy at a temperature the source never gave. It is not
  // discarded: the measurement is real and stays at F1, and the package says so.
  const value = productionCurveExtraction();
  value.curves[0].test_conditions = "VDS = 10 V";
  delete value.curves[0].temperature;
  delete value.curves[0].magnitude_convention;
  delete value.curves[0].electrical_bias;
  delete value.curves[0].test_mode;
  const report = evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, value);
  const temperatureRule = report.rules.find((rule) => rule.id === "stated_temperature");
  assert.ok(temperatureRule, "the contract must report on the temperature rule");
  assert.equal(temperatureRule.status, "fail");
  assert.match(temperatureRule.reason, /no stated temperature/);
  assert.equal(report.tier, "F1", "an unstated temperature must never reach F2");
  assert.ok(report.omissions.some((line) => /stated_temperature/.test(line)),
    `the package must say why it is not F2: ${report.omissions.join(" | ")}`);
  // The scalar rows still carry their own stated temperatures, so the F1 claim stands.
  assert.equal(report.rules.find((rule) => rule.id === "mosfet_f1_critical_calibration").status, "pass");
});

test("relaxation: a test mode the extractor supplies as a typed field no longer has to be spelled in prose", () => {
  // The old identity was built by exact-phrase matching, so evidence that said "d.c."
  // rather than the literal token "DC" was rejected. That was a spelling test, not an
  // electrical one. The kinds themselves stay closed and every rule that depends on the
  // kind is unchanged.
  for (const spelling of ["test mode = DC", "d.c.", "steady state"]) {
    const value = productionCurveExtraction();
    value.curves[0].test_conditions = `VDS = 10 V, TJ = 25 °C; ${spelling}`;
    delete value.curves[0].test_mode;
    delete value.curves[0].magnitude_convention;
    delete value.curves[0].electrical_bias;
    delete value.curves[0].temperature;
    const report = evaluateEvidenceContract({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, value);
    assert.ok(report.candidate, `"${spelling}" must be admitted as a stated test mode`);
  }
});

test("relaxation: disclosure prose is recorded as free text and never enters a condition identity", () => {
  // Two identical measurements whose datasheets word their footnotes differently must
  // produce the SAME condition ID. The old whitelist made the identity depend on the
  // wording, which split cohorts that describe one measurement.
  const identityFor = (prose) => {
    const value = productionCurveExtraction();
    for (const field of Object.values(value.specs.rdson_points[0])) {
      delete field.condition;
      field.conditions = prose;
    }
    value.usable_curves = false;
    let payload;
    fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, value, {
      forceF1: true, ngspiceRunner: () => ({ pass: true }),
      mosfetConstraintRunner: (received) => { payload = received; return passThroughConstraintRunner(received); },
    });
    const row = payload.constraints.concat(payload.observations ?? []).find((item) => item.condition_identity);
    return row.condition_identity;
  };
  const plain = identityFor("VGS = 4.5 V, ID = 2 A, TJ = 25 degC; test mode = DC");
  const wordy = identityFor("VGS = 4.5 V, ID = 2 A, TJ = 25 degC; test mode = DC; unless otherwise noted; values converted to SI per Note 3");
  assert.equal(plain.condition_id, wordy.condition_id,
    "a differently worded footnote must not split one measurement into two conditions");
  assert.ok(!JSON.stringify(plain.qualifiers).includes("unless_otherwise_noted"));
});

test("gate: a published saturation maximum is still a bound, never a fitted target", () => {
  // Wrong claim prevented: reading VCE(sat) MAX or hFE MAX as a typical target makes the
  // model claim the worst-case part is the ordinary part.
  const maximumGain = {
    schema_version: "1.0.0", mpn: "FIXTURE-Q1", manufacturer: "Fixture Semi", family: "bjt", usable_curves: false,
    specs: { gain_points: [{ hfe: { value: 300, unit: "1", source_kind: "maximum", conditions: "IC = 2 mA", page_reference: "p. 2" } }] },
  };
  const fit = fitBulkPart(
    { mpn: "FIXTURE-Q1", manufacturer: "Fixture Semi", conveyor_family: "bjt", subcategory: "NPN", description: "fixture", seed_hints: [{ factory_target: "bjt.dc_current_gain", raw_value: "100" }] },
    maximumGain,
    { ngspiceRunner: () => ({ pass: true }) },
  );
  assert.equal(fit.parameters.BF, 100, "a published maximum must fall back to the seed, not become the target");
});

test("gate: a fitted parameter parked on a physical bound is still declared, not presented as a measurement", () => {
  // Wrong claim prevented: a value set by a bound is not a measurement of the part, and
  // presenting one as fitted invents a device characteristic the source never showed.
  const gates = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../lib/fit-gates.json"), "utf8"));
  assert.ok(gates.parameter_physicality.bound_saturation_tolerance > 0);
  for (const family of Object.values(gates.families)) {
    for (const limit of Object.values(family.quantities)) {
      assert.ok(limit.worst > 0 && limit.rms > 0, "every gate quantity keeps a positive tolerance");
    }
  }
});

test("gate: catalog parametrics are still seeds, never evidence, constraints or citations", () => {
  // Wrong claim prevented: a distributor's parametric table is not a datasheet. Fitting
  // to one and citing the datasheet claims a measurement that was never published there.
  // The seed hint below is a perfectly good forward-voltage number, and it is still not
  // enough to build a package from.
  const catalogOnly = extraction();
  catalogOnly.specs.forward_voltage_points = [];
  catalogOnly.usable_curves = false;
  const part = { ...diodePart("unused.pdf"), seed_hints: [{ factory_target: "diode.forward_voltage", raw_value: "0.7V@10mA" }] };
  const report = evaluateEvidenceContract(part, catalogOnly);
  assert.equal(report.tier, null, "a catalog hint supports no fidelity tier at all");
  assert.match(report.rules.find((rule) => rule.id === "diode_forward_evidence").reason, /catalog hints are seeds only/);
  assert.throws(() => validateBulkCandidateEvidence(part, catalogOnly), /catalog hints are seeds only/);
});

test("gate: the collision and duplicate-die guards still refuse to restate a reviewed package", () => {
  // Wrong claim prevented: two packages carrying the same fitted die vector under
  // different part numbers assert that two distinct parts were independently measured.
  const reviewedRoot = path.resolve(import.meta.dirname, "../../../packages/model-library/models");
  const collision = libraryCollisionReason(
    { mpn: "1N4148", manufacturer: "Vishay", conveyor_family: "diode", subcategory: "Switching Diodes", description: "collision fixture" },
    reviewedRoot, null,
  );
  assert.ok(collision, "a canonical MPN already in the reviewed library must be skipped, not restaged");
  assert.match(collision, /1N4148/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-gate-die-test-"));
  try {
    const library = path.join(root, "models");
    const existing = path.join(library, "fixture", "EXISTING-D1");
    fs.mkdirSync(existing, { recursive: true });
    const fit = fitBulkPart(diodePart("unused.pdf"), extraction(), { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
    fs.writeFileSync(path.join(existing, "component.json"), JSON.stringify({ electrical_family: "diode" }));
    fs.writeFileSync(path.join(existing, "fitted.json"), JSON.stringify({ parameters: fit.parameters }));
    assert.match(
      libraryDuplicateDieReason({ ...diodePart("unused.pdf"), mpn: "NOT-THE-SAME-PART" }, fit, library),
      /duplicate fitted die vector/,
      "an identical fitted die vector must be refused however the part is named",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("gate: the staged package still declares native and WASM engine agreement per bench", () => {
  // Wrong claim prevented: a card that behaves one way in the reference simulator and
  // another in the browser engine is two different models wearing one name.
  const bench = path.resolve(import.meta.dirname, "../../native-ngspice-reference/compare.mjs");
  assert.ok(fs.existsSync(bench), "the native-versus-WASM comparison harness must stay wired in");
  const source = fs.readFileSync(bench, "utf8");
  assert.match(source, /run-wasm/, "the comparison must still run the WASM engine, not only native ngspice");
  assert.match(source, /run-native/, "the comparison must still run native ngspice");
});
