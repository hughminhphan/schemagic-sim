import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fitBulkPart, libraryCollisionReason, libraryDuplicateDieReason, normalizedIdentity, normalizeBulkManifest, repairKnownEvidenceDefects, runBulkManifest } from "../lib/bulk-adapter.mjs";
import { validatePackage } from "../../../packages/component-schema/lib.mjs";

const quantity = (value, unit) => ({ value, unit, conditions: "fixture at 25 C", page_reference: "p. 2", source_kind: "typical" });

function diodePart(pdf) {
  return {
    mpn: "FIXTURE-D1", manufacturer: "Fixture Semi", conveyor_family: "diode",
    datasheet_path: pdf, datasheet_url: "https://example.test/fixture.pdf",
    category: "Diodes", subcategory: "Switching Diodes", package: "SOD-123", description: "fixture diode",
    seed_hints: [{ factory_target: "diode.forward_voltage", raw_value: "0.7V@10mA" }], allow_f1_demotion: true,
  };
}

function zenerPart(pdf) {
  return { ...diodePart(pdf), subcategory: "Zener Diodes", description: "single Zener voltage regulator diode" };
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

function extraction() {
  return {
    schema_version: "1.0.0", mpn: "FIXTURE-D1", manufacturer: "Fixture Semi", family: "diode",
    datasheet_identity: { title: "Fixture D1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: true,
    curves: [{ name: "Forward IV", x_axis: { quantity: "voltage", unit: "V", scale: "linear" }, y_axis: { quantity: "current", unit: "A", scale: "log" }, test_conditions: "TA=25 C", page_reference: "p. 2", points: [{ x: 0.48, y: 1e-4 }, { x: 0.60, y: 1e-3 }, { x: 0.72, y: 1e-2 }, { x: 0.84, y: 1e-1 }] }],
    specs: { variant: "signal", forward_voltage_points: [{ current: quantity(10, "mA"), voltage: quantity(720, "mV") }], reverse_current: { ...quantity(2, "µA"), conditions: "VR=5 V, TA=25 C" }, capacitance: null, reverse_recovery: null, breakdown_voltage: null, breakdown_current: null }, extraction_notes: [], omission_reason: null,
  };
}

function zenerExtraction() {
  const value = extraction();
  value.specs.variant = "zener";
  value.specs.breakdown_voltage = { ...quantity(5.1, "V"), conditions: "Nominal Zener voltage VZ = 5.1 V at IZT = 5 mA, tolerance ±5%", page_reference: "p. 2 Zener table" };
  value.specs.breakdown_current = { ...quantity(5, "mA"), conditions: "Zener test current IZT = 5 mA at VZ = 5.1 V", page_reference: "p. 2 Zener table" };
  return value;
}

function explicitZenerExtraction() {
  const value = zenerExtraction();
  value.specs.breakdown_voltage = [
    { ...quantity(11.4, "V"), conditions: "Minimum Zener voltage VZ = 11.4 V at IZT = 10 mA", page_reference: "p. 2 MM1W12 VZ minimum", source_kind: "minimum" },
    { ...quantity(12, "V"), conditions: "Nominal Zener voltage VZ = 12 V at IZT = 10 mA", page_reference: "p. 2 MM1W12 VZ nominal" },
    { ...quantity(12.6, "V"), conditions: "Maximum Zener voltage VZ = 12.6 V at IZT = 10 mA", page_reference: "p. 2 MM1W12 VZ maximum", source_kind: "maximum" },
  ];
  value.specs.breakdown_current = { ...quantity(0.01, "A"), conditions: "Zener test current IZT = 0.01 A", page_reference: "p. 2 MM1W12 IZT" };
  return value;
}

test("bulk adapter fits curve-backed diode without touching reviewed library", () => {
  const fit = fitBulkPart(diodePart("unused.pdf"), extraction(), { ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.fidelity, "F2");
  assert.match(fit.model.text, /\.model .* D\(/);
});

test("Zener model cards emit only cited VZ and IZT values with held NBV", () => {
  const fit = fitBulkPart(zenerPart("unused.pdf"), zenerExtraction(), { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.parameters.BV, 5.1);
  assert.equal(fit.parameters.IBV, 0.005);
  assert.equal(fit.parameters.NBV, 1);
  assert.match(fit.model.text, / BV=5\.1000000000e0 IBV=5\.0000000000e-3 NBV=1\.0000000000e0/);
  assert.match(fit.parameter_metadata.NBV.status, /held first-order/);
  assert.ok(fit.held_defaults.some((item) => item.parameter === "NBV" && item.value === 1));
  assert.equal(fit.diode_evidence.breakdown.tolerance.percent, 5);

  const unitEquivalent = zenerExtraction();
  unitEquivalent.specs.breakdown_current = { ...quantity(0.005, "A"), conditions: "Zener test current IZT = 0.005 A", page_reference: "p. 2 Zener table" };
  assert.equal(fitBulkPart(zenerPart("unused.pdf"), unitEquivalent, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }).parameters.IBV, 0.005);

  const mismatched = zenerExtraction();
  mismatched.specs.breakdown_current = { ...quantity(10, "mA"), conditions: "Zener test current IZT = 10 mA", page_reference: "p. 2 Zener table" };
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), mismatched, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /VZ and breakdown-current IZT mismatch/,
  );

  const mislabeledCurrent = zenerExtraction();
  mislabeledCurrent.specs.breakdown_current.conditions = "Zener test current IZT = 10 mA";
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), mislabeledCurrent, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /conditions match the normalized breakdown-current value/,
  );

  const incomplete = zenerExtraction();
  incomplete.specs.breakdown_current = null;
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), incomplete, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /numeric cited IZT/,
  );

  const ratingOnly = zenerExtraction();
  ratingOnly.specs.breakdown_voltage.conditions = "Maximum repetitive reverse voltage VRRM = 100 V";
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), ratingOnly, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /requires cited VZ quantities/,
  );

  const oneSided = zenerExtraction();
  oneSided.specs.breakdown_voltage.source_kind = "maximum";
  oneSided.specs.breakdown_voltage.conditions = "Maximum Zener voltage VZ = 5.35 V at IZT = 5 mA";
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), oneSided, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /exactly one nominal VZ row is required/,
  );

  const explicitMismatch = explicitZenerExtraction();
  explicitMismatch.specs.breakdown_voltage[0].conditions = "Minimum Zener voltage VZ = 11.4 V at IZT = 5 mA";
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), explicitMismatch, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /VZ and breakdown-current IZT mismatch/,
  );

  const kneeTrace = zenerExtraction();
  kneeTrace.curves.push({ name: "Reverse Zener breakdown knee", x_axis: { quantity: "reverse voltage", unit: "V", scale: "linear" }, y_axis: { quantity: "reverse current", unit: "A", scale: "log" }, test_conditions: "TA = 25 C", page_reference: "p. 4", points: [{ x: 4.8, y: 1e-4 }, { x: 5.1, y: 5e-3 }, { x: 5.3, y: 2e-2 }] });
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), kneeTrace, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /reverse-knee trace requires a fitted knee shape/,
  );
});

test("staged Zener facts preserve VZ, IZT, tolerance, polarity, and inclusive native bounds", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-zener-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(zenerExtraction()));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...zenerPart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "fitted.json"), "utf8"));
    const component = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "component.json"), "utf8"));
    const expectations = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "tests", "expectations.json"), "utf8"));
    assert.deepEqual(facts.derived_model_inputs.BV, { ...quantity(5.1, "V"), conditions: "Nominal Zener voltage VZ = 5.1 V at IZT = 5 mA, tolerance ±5%", page_reference: "p. 2 Zener table" });
    assert.equal(facts.derived_model_inputs.IBV.value, 0.005);
    assert.equal(facts.derived_model_inputs.IBV.unit, "A");
    assert.equal(facts.derived_model_inputs.IBV.page_reference, "p. 2 Zener table");
    assert.equal(facts.derived_model_inputs.NBV.value, 1);
    assert.equal(facts.derived_model_inputs.NBV.source_kind, "held_default");
    assert.equal(facts.zener_points[0].voltage_minimum.value, 4.845);
    assert.equal(facts.zener_points[0].voltage_minimum.source_kind, "minimum");
    assert.equal(facts.zener_points[0].voltage_maximum.value, 5.3549999999999995);
    assert.equal(facts.zener_points[0].voltage_maximum.source_kind, "maximum");
    assert.deepEqual(component.symbol_pins.map((pin) => pin.role), ["anode", "cathode"]);
    assert.equal(component.domain_coverage.ac, "none");
    assert.equal(component.domain_coverage.transient, "none");
    assert.match(component.known_omissions.join("\n"), /knee shape, dynamic impedance, thermal behavior, noise, and AC behavior are unsupported/);
    assert.ok(fitted.held_defaults.some((item) => item.parameter === "NBV"));
    const zenerCheck = expectations.tests.flatMap((entry) => entry.hard_bounds_checks).find((check) => check.name.startsWith("zener_voltage_at_"));
    assert.deepEqual([zenerCheck.minimum, zenerCheck.maximum], [4.845, 5.3549999999999995]);
    assert.ok(fs.existsSync(path.join(result[0].package_path, "tests", "zener_01.cir")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MM1W12-style explicit Zener rows produce inclusive native bounds at one IZT", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-zener-explicit-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(explicitZenerExtraction()));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...zenerPart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    const expectations = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "tests", "expectations.json"), "utf8"));
    assert.equal(facts.derived_model_inputs.BV.value, 12);
    assert.equal(facts.derived_model_inputs.IBV.value, 0.01);
    assert.deepEqual(
      [facts.zener_points[0].voltage_minimum.value, facts.zener_points[0].voltage_maximum.value],
      [11.4, 12.6],
    );
    assert.equal(facts.zener_points[0].voltage_minimum.page_reference, "p. 2 MM1W12 VZ minimum");
    assert.equal(facts.zener_points[0].voltage_maximum.page_reference, "p. 2 MM1W12 VZ maximum");
    const zenerCheck = expectations.tests.flatMap((entry) => entry.hard_bounds_checks).find((check) => check.name.startsWith("zener_voltage_at_"));
    assert.deepEqual([zenerCheck.minimum, zenerCheck.maximum], [11.4, 12.6]);
    assert.ok(fs.existsSync(path.join(result[0].package_path, "tests", "zener_01.cir")));
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
      current: { ...quantity(5, "A"), source_kind: "maximum" },
      voltage: { ...quantity(550, "mV"), source_kind: "maximum" },
    }];
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(maximum));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { ngspiceRunner: () => ({ pass: true }) });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    assert.equal(result[0].fidelity, "F1");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CJO plus cited recovery evidence creates no TT model or condition-insensitive transient claim", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-diode-scalars-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const payload = extraction();
    payload.usable_curves = false;
    payload.curves = [];
    payload.omission_reason = "No usable forward curve; cited scalar table points retained.";
    payload.specs.forward_voltage_points = [
      { current: quantity(10, "uA"), voltage: quantity(0.4, "V") },
      { current: quantity(100, "uA"), voltage: quantity(0.49, "V") },
      { current: quantity(1, "mA"), voltage: quantity(0.59, "V") },
      { current: quantity(10, "mA"), voltage: quantity(0.7, "V") },
      { current: quantity(100, "mA"), voltage: quantity(0.86, "V") },
    ];
    payload.specs.capacitance = { ...quantity(4, "pF"), conditions: "Zero-bias junction capacitance, VR = 0 V, f = 1 MHz, TA = 25 C", page_reference: "p. 3 capacitance table", source_kind: "maximum" };
    payload.specs.reverse_recovery = { ...quantity(4, "ns"), conditions: "Reverse recovery trr at IF = 10 mA, VR = 6 V, IRR = 1 mA, RL = 100 ohm, TA = 25 C", page_reference: "p. 3 switching table", source_kind: "maximum" };
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const model = fs.readFileSync(path.join(result[0].package_path, "model.cir"), "utf8");
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "fitted.json"), "utf8"));
    const component = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "component.json"), "utf8"));
    assert.match(model, / CJO=4\.0000000000e-12/);
    assert.doesNotMatch(model, /\sTT=/);
    assert.equal(facts.derived_model_inputs.CJO.value, 4e-12);
    assert.equal(facts.derived_model_inputs.CJO.source_kind, "maximum");
    assert.equal(facts.derived_model_inputs.CJO.conditions, "Zero-bias junction capacitance, VR = 0 V, f = 1 MHz, TA = 25 C");
    assert.equal(facts.derived_model_inputs.TT, undefined);
    assert.equal(facts.scalar_model_inputs.TT, undefined);
    assert.equal(facts.reported_unsupported_evidence.reverse_recovery.value, 4e-9);
    assert.equal(facts.reported_unsupported_evidence.reverse_recovery.source_kind, "maximum");
    assert.equal(facts.reported_unsupported_evidence.reverse_recovery.page_reference, "p. 3 switching table");
    assert.match(facts.reported_unsupported_evidence.reverse_recovery.disposition, /reported source fact only/);
    assert.equal(fitted.held_defaults.some((item) => item.parameter === "CJO"), false);
    assert.ok(fitted.held_defaults.some((item) => item.parameter === "TT" && item.value === 0));
    assert.match(fitted.parameter_metadata.CJO.status, /zero-bias capacitance/);
    assert.match(fitted.parameter_metadata.TT.status, /exact cited IF, VR, IRR, RL, and recovery-criterion fixture/);
    assert.equal(component.domain_coverage.ac, "none");
    assert.equal(component.domain_coverage.transient, "none");
    assert.deepEqual(component.supported_analyses, ["operating_point", "dc_sweep"]);
    assert.match(component.known_omissions.join("\n"), /CJO represents only the cited zero-bias capacitance scalar/);
    assert.match(component.known_omissions.join("\n"), /no transient scope, bench, hard bound, or recovery claim is created/);
    assert.ok(fs.existsSync(path.join(result[0].package_path, "tests", "zero_bias_capacitance.cir")));
    assert.equal(fs.existsSync(path.join(result[0].package_path, "tests", "reverse_recovery.cir")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("nonzero-bias capacitance and incomplete recovery evidence stay omitted and disclosed", () => {
  const payload = extraction();
  payload.usable_curves = false;
  payload.curves = [];
  payload.specs.capacitance = { ...quantity(6, "pF"), conditions: "Junction capacitance at VR = 5 V, f = 1 MHz", page_reference: "p. 4 curve" };
  payload.specs.reverse_recovery = { ...quantity(20, "ns"), conditions: "Switching time at TA = 25 C", page_reference: "p. 4 table", source_kind: "maximum" };
  const fit = fitBulkPart(diodePart("unused.pdf"), payload, { forceF1: true });
  assert.equal(fit.parameters.CJO, undefined);
  assert.equal(fit.parameters.TT, undefined);
  assert.doesNotMatch(fit.model.text, /\s(?:CJO|TT)=/);
  assert.match(fit.parameter_metadata.CJO.status, /not stated at zero bias/);
  assert.match(fit.parameter_metadata.TT.status, /does not reproduce the exact cited IF, VR, IRR, RL, and recovery-criterion fixture/);
  assert.equal(fit.diode_evidence.recovery.evidence.value, 20e-9);
  assert.ok(fit.held_defaults.some((item) => item.parameter === "CJO" && item.value === 0));
  assert.ok(fit.held_defaults.some((item) => item.parameter === "TT" && item.value === 0));

  const absent = extraction();
  absent.usable_curves = false;
  absent.curves = [];
  const absentFit = fitBulkPart(diodePart("unused.pdf"), absent, { forceF1: true });
  assert.match(absentFit.parameter_metadata.CJO.status, /no positive cited junction-capacitance quantity/);
  assert.match(absentFit.parameter_metadata.TT.status, /no positive cited reverse-recovery quantity/);
});

test("TT-only evidence stays a reported fact with simulator-default TT and no transient claim", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-diode-tt-typical-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const payload = extraction();
    payload.usable_curves = false;
    payload.curves = [];
    payload.specs.reverse_recovery = { ...quantity(12, "ns"), conditions: "Typical reverse recovery trr at IF = 10 mA, IR = 10 mA, recovery to 25% of IRR", page_reference: "p. 5 switching graph", source_kind: "typical" };
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "fitted.json"), "utf8"));
    const component = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "component.json"), "utf8"));
    const expectations = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "tests", "expectations.json"), "utf8"));
    const model = fs.readFileSync(path.join(result[0].package_path, "model.cir"), "utf8");
    assert.equal(facts.scalar_model_inputs.TT, undefined);
    assert.equal(facts.derived_model_inputs.TT, undefined);
    assert.ok(Math.abs(facts.reported_unsupported_evidence.reverse_recovery.value - 12e-9) < 1e-22);
    assert.equal(facts.reported_unsupported_evidence.reverse_recovery.source_kind, "typical");
    assert.equal(facts.reported_unsupported_evidence.reverse_recovery.conditions, "Typical reverse recovery trr at IF = 10 mA, IR = 10 mA, recovery to 25% of IRR");
    assert.doesNotMatch(model, /\sTT=/);
    assert.ok(fitted.held_defaults.some((item) => item.parameter === "TT" && item.value === 0));
    assert.equal(component.domain_coverage.transient, "none");
    assert.equal(expectations.tests.some((entry) => entry.analysis_type === "transient"), false);
    assert.doesNotMatch(JSON.stringify(expectations), /recovery/i);
    assert.equal(fs.existsSync(path.join(result[0].package_path, "tests", "reverse_recovery.cir")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("diode variant and package contracts park semantic mismatches and incompatible topologies", () => {
  const zenerAsSignal = extraction();
  assert.throws(
    () => fitBulkPart(zenerPart("unused.pdf"), zenerAsSignal, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /variant mismatch: catalog identifies zener, extraction identifies signal/,
  );

  const schottky = extraction();
  schottky.specs.variant = "schottky";
  const schottkyPart = { ...diodePart("unused.pdf"), subcategory: "Schottky Barrier Diodes", description: "single Schottky diode" };
  const schottkyFit = fitBulkPart(schottkyPart, schottky, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(schottkyFit.parameters.N, 1.2, "catalog text must not invent a Schottky-specific ideality factor");

  const rectifier = extraction();
  rectifier.specs.variant = "rectifier";
  const rectifierFit = fitBulkPart({ ...diodePart("unused.pdf"), subcategory: "Rectifier Diodes", description: "single rectifier diode" }, rectifier, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(rectifierFit.fidelity, "F1");

  assert.throws(
    () => fitBulkPart({ ...diodePart("unused.pdf"), package: "SOT-23", description: "dual common-cathode switching diode" }, extraction(), { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /unsupported diode topology: multi-diode|common-terminal multi-diode/,
  );
  assert.throws(
    () => fitBulkPart({ ...diodePart("unused.pdf"), package: "SOT-23", description: "switching diode" }, extraction(), { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /unsupported diode package contract: catalog identifies 3 terminals/,
  );
  for (const description of [
    "bridge", "bridges", "bridge-rectifier", "bridge rectifiers",
    "dual diode", "dual diodes", "two-diodes", "multi diode",
    "diode array", "diode-array", "diode arrays", "array of diodes", "arrays-of-diodes",
    "common anode switching diode", "common-anode switching diode", "common cathodes", "common-cathode diodes",
    "series pair", "series-pair", "series pairs", "series connected diodes", "series-diode-pairs",
    "TVS diode", "transient voltage suppressors",
    "varactor diode", "varactors", "variable-capacitance diodes",
    "photodiode", "photodiodes", "photo diode", "photo diodes", "photo-diode", "photo-diodes",
    "PIN diode", "PIN diodes", "PIN-diode", "PIN-diodes",
  ]) {
    assert.throws(
      () => fitBulkPart({ ...diodePart("unused.pdf"), description }, extraction(), { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
      /unsupported diode topology/,
      description,
    );
  }
});

test("bulk manifest parks an incompatible diode package before staging", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-diode-park-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(extraction()));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), package: "SOT-23", description: "dual common-cathode switching diode", extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "failed");
    assert.equal(result[0].stage, "fitted");
    assert.match(result[0].reason, /unsupported diode topology/);
    assert.equal(fs.existsSync(path.join(root, "staging", "packages")), false);
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
    fs.writeFileSync(extractionPath, JSON.stringify(extraction()));
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
    const expectations = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "tests", "expectations.json"), "utf8"));
    assert.ok(expectations.tests.length > 0);
    const benches = fs.readdirSync(path.join(result[0].package_path, "tests")).filter((name) => name.endsWith(".cir"));
    assert.ok(benches.length > 0);
    for (const bench of benches) {
      const text = fs.readFileSync(path.join(result[0].package_path, "tests", bench), "utf8");
      assert.match(text, /^\.temp 25$/m, `${bench} must pin the cited nominal temperature`);
    }
    const facts = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "facts.json"), "utf8"));
    assert.ok(facts.fit_points.some((point) => point.current.value === 0.01 && point.current.unit === "A" && point.voltage.value === 0.72 && point.voltage.unit === "V"));
    assert.equal(facts.electrical_limits.reverse_current_5v.value, 2e-6);
    assert.equal(facts.electrical_limits.reverse_current_5v.unit, "A");
    assert.equal(validatePackage(result[0].package_path).errors.length, 0, "bulk packages must pass the package validator by construction");
    assert.doesNotMatch(result[0].package_path, /packages\/model-library/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("forced F1 MOSFET fallback parses SI-prefixed catalog hints", () => {
  const fit = fitBulkPart(mosfetPart("unused.pdf"), null, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.fidelity, "F1");
  assert.equal(fit.polarity, "p");
  assert.ok(fit.parameters.CGS < 1e-9);
  assert.equal(fit.parameters.CGDMAX, 5e-12);
  assert.match(fit.model.text, /VDMOS\( pchan/);
});

test("F1 MOSFET calibration uses the same nominal-temperature evidence as its package claim", () => {
  const nonNominal = { ...quantity(5.6, "ohm"), conditions: "TJ = -55 to 150 degC", source_kind: "typical" };
  const nominalMaximum = { ...quantity(3.5, "ohm"), source_kind: "maximum" };
  const payload = { specs: {
    polarity: "n", threshold_min: quantity(0.5, "V"), threshold_typ: null, threshold_max: quantity(1.5, "V"),
    rdson_points: [
      { vgs: quantity(2.75, "V"), current: quantity(0.2, "A"), resistance: nonNominal },
      { vgs: quantity(5, "V"), current: quantity(0.2, "A"), resistance: nominalMaximum },
    ],
    ciss: quantity(45e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(4e-12, "F"),
  } };
  const fit = fitBulkPart({ ...mosfetPart("unused.pdf"), subcategory: "N-Channel MOSFET" }, payload, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.parameters.KP, 2 / (3.5 * 0.9));
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
      specs: { polarity: "p", threshold_min: quantity(1, "V"), threshold_typ: quantity(1.5, "V"), threshold_max: quantity(2, "V"), rdson_points: [], ciss: quantity(50e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(5e-12, "F"), breakdown_voltage: quantity(30, "V"), body_diode: null },
      extraction_notes: [], omission_reason: "curve unavailable",
    };
    fs.writeFileSync(extractionPath, JSON.stringify(mosfetExtraction));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...mosfetPart(pdf), extraction_path: extractionPath, force_f1: true, demotion_reason: "catalog discrepancy" }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { ngspiceRunner: () => ({ pass: true }) });
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
    assert.deepEqual(facts.fit_points.map((point) => point.current.value), [0.1, 1.9]);
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
      specs: {
        polarity: "p",
        threshold_min: { ...quantity(-0.7, "V"), source_kind: "minimum" }, threshold_typ: null, threshold_max: { ...quantity(-1.3, "V"), source_kind: "maximum" },
        rdson_points: [
          { vgs: quantity(-10, "V"), current: quantity(-4.2, "A"), resistance: { ...quantity(0.065, "ohm"), source_kind: "maximum" } },
          { vgs: quantity(-4.5, "V"), current: quantity(-4, "A"), resistance: { ...quantity(0.075, "ohm"), source_kind: "maximum" } },
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
    assert.deepEqual(facts.rdson_points.map((point) => [point.vgs.value, point.current.value]), [[10, 4.2]]);
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
    const fit = fitBulkPart(mosfetPart("unused.pdf"), null, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
    fs.writeFileSync(path.join(existing, "component.json"), JSON.stringify({ electrical_family: "pmos" }));
    fs.writeFileSync(path.join(existing, "fitted.json"), JSON.stringify({ parameters: fit.parameters }));
    assert.match(libraryDuplicateDieReason(mosfetPart("unused.pdf"), fit, library), /fixture\/EXISTING-P1/);

    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const mosfetExtraction = {
      schema_version: "1.0.0", mpn: "FIXTURE-P1", manufacturer: "Fixture Semi", family: "mosfet",
      datasheet_identity: { title: "Fixture P1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: false, curves: [],
      specs: { polarity: "p", threshold_min: quantity(1, "V"), threshold_typ: quantity(1.5, "V"), threshold_max: quantity(2, "V"), rdson_points: [], ciss: quantity(50e-12, "F"), coss: quantity(20e-12, "F"), crss: quantity(5e-12, "F"), breakdown_voltage: quantity(30, "V"), body_diode: null },
      extraction_notes: [], omission_reason: "curve unavailable",
    };
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(mosfetExtraction));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [
      { ...mosfetPart(pdf), mpn: "FIXTURE-P1A", extraction_path: extractionPath, force_f1: true },
      { ...mosfetPart(pdf), mpn: "FIXTURE-P1B", extraction_path: extractionPath, force_f1: true },
    ] }));
    const results = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library"), ngspiceRunner: () => ({ pass: true }) });
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
