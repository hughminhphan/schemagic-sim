import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { bjtArchetypeFacts, defaultBjtF1Runner, fitBulkPart, insufficientExtractedTargetsReason, libraryCollisionReason, libraryDuplicateDieReason, normalizedIdentity, normalizeBulkManifest, polarityContractReason, repairKnownEvidenceDefects, runBulkManifest, unsupportedPackageContractReason } from "../lib/bulk-adapter.mjs";
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

function bjtPart(pdf = "unused.pdf") {
  return {
    mpn: "FIXTURE-Q1", manufacturer: "Fixture Semi", conveyor_family: "bjt",
    datasheet_path: pdf, datasheet_url: "https://example.test/bjt.pdf",
    category: "Transistors", subcategory: "NPN BJT", package: "SOT-23", description: "single NPN transistor",
    seed_hints: [], allow_f1_demotion: true,
  };
}

function gainPoint(hfe, sourceKind = "typical", current = 0.01, vce = 5) {
  return {
    collector_current: { ...quantity(current, "A"), source_kind: sourceKind },
    vce: { ...quantity(vce, "V"), source_kind: sourceKind },
    hfe: { ...quantity(hfe, "1"), source_kind: sourceKind },
  };
}

function bjtExtraction() {
  return {
    schema_version: "1.0.0", mpn: "FIXTURE-Q1", manufacturer: "Fixture Semi", family: "bjt",
    datasheet_identity: { title: "FIXTURE-Q1 single NPN transistor", revision: "A", pages_examined: ["p. 2"] },
    usable_curves: false, curves: [], extraction_notes: [], omission_reason: "table evidence only",
    specs: {
      polarity: "npn",
      gain_points: [gainPoint(100, "minimum"), gainPoint(300, "maximum"), gainPoint(180)],
      saturation_points: [], ft: null, cobo: null, cibo: null, vceo: quantity(40, "V"),
    },
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
  value.specs.breakdown_voltage = { ...quantity(5.1, "V"), conditions: "VZ = 5.1 V at IZT = 5 mA", page_reference: "p. 2 Zener table" };
  value.specs.breakdown_current = { ...quantity(5, "mA"), conditions: "IZT = 5 mA at VZ = 5.1 V", page_reference: "p. 2 Zener table" };
  return value;
}

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
    const result = runBulkManifest(manifestPath, staging, { libraryRoot: path.join(root, "empty-library"), ngspiceRunner: () => ({ pass: true }) });
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

test("F1 BJT native fit satisfies a published minimum without targeting an unrelated maximum", () => {
  const base = bjtExtraction();
  base.specs.gain_points = [
    gainPoint(120, "minimum", 0.001, 5),
    gainPoint(118, "digitized_typical_curve", 0.01, 5),
  ];
  const bounded = structuredClone(base);
  bounded.specs.gain_points.splice(1, 0, gainPoint(350, "maximum", 0.1, 2));
  const baseFit = fitBulkPart(bjtPart(), base, { forceF1: true });
  const boundedFit = fitBulkPart(bjtPart(), bounded, { forceF1: true });
  assert.ok(Math.abs(baseFit.parameters.BF - boundedFit.parameters.BF) < 1e-6);
  assert.ok(Math.abs(baseFit.parameters.IKF - boundedFit.parameters.IKF) < 1e-9);
  const minimum = boundedFit.residuals.find((row) => row.source_kind === "minimum");
  const maximum = boundedFit.residuals.find((row) => row.source_kind === "maximum");
  assert.match(minimum.quantity, /IC=0\.001 A, VCE=5 V/);
  assert.ok(minimum.fitted_value >= minimum.datasheet_value);
  assert.match(maximum.quantity, /IC=0\.1 A, VCE=2 V/);
  assert.ok(maximum.fitted_value <= maximum.datasheet_value);
});

test("F1 BJT native fit evaluates each inclusive gain bound at its cited condition", () => {
  const payload = bjtExtraction();
  payload.specs.gain_points = [
    gainPoint(60, "minimum", 0.001, 5),
    gainPoint(400, "maximum", 0.1, 2),
  ];
  const fit = fitBulkPart(bjtPart(), payload, { forceF1: true });
  assert.equal(fit.residuals.length, 2);
  const [minimum, maximum] = fit.residuals;
  assert.equal(minimum.quantity, "hFE at IC=0.001 A, VCE=5 V");
  assert.equal(maximum.quantity, "hFE at IC=0.1 A, VCE=2 V");
  assert.ok(minimum.fitted_value >= minimum.datasheet_value);
  assert.ok(maximum.fitted_value <= maximum.datasheet_value);
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

test("empty BJT gain evidence parks deterministically before fitting", () => {
  const payload = bjtExtraction();
  payload.specs.gain_points = [];
  assert.match(insufficientExtractedTargetsReason(bjtPart(), payload), /^insufficient-extracted-targets:/);
  assert.throws(
    () => fitBulkPart(bjtPart(), payload, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /^Error: insufficient-extracted-targets:/,
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-empty-bjt-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...bjtPart(pdf), extraction_path: extractionPath }] }));
    let fitCalls = 0;
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library"), fitRunner: () => { fitCalls += 1; throw new Error("must not fit"); } });
    assert.equal(fitCalls, 0);
    assert.equal(result[0].status, "failed");
    assert.equal(result[0].failure_category, "insufficient-extracted-targets");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("BJT F1 shares canonical native fitting with voltage-deembedded capacitance and delay-corrected fT", () => {
  const payload = bjtExtraction();
  payload.specs.gain_points = [
    gainPoint(100, "minimum", 0.001, 5),
    gainPoint(180, "typical", 0.01, 5),
    gainPoint(300, "maximum", 0.1, 5),
  ];
  payload.specs.ft = { ...quantity(200, "MHz"), conditions: "IC = 10 mA, VCE = 5 V, fT = 200 MHz" };
  payload.specs.cobo = { ...quantity(4, "pF"), source_kind: "maximum", conditions: "VCB = 5 V, f = 1 MHz" };
  payload.specs.cibo = { ...quantity(12, "pF"), source_kind: "maximum", conditions: "VEB = 0.5 V, f = 1 MHz" };
  const facts = bjtArchetypeFacts(bjtPart(), payload);
  const canonical = defaultBjtF1Runner(facts);
  const fit = fitBulkPart(bjtPart(), payload, { forceF1: true });
  assert.deepEqual(fit.parameters, canonical.parameters, "bulk F1 must use the canonical fit_bjt parameter vector");
  const expectedCjc = 4e-12 * (1 + 5 / 0.75) ** 0.33;
  const expectedCje = 12e-12 * (1 + 0.5 / 0.75) ** 0.33;
  assert.ok(Math.abs(fit.parameters.CJC - expectedCjc) < 1e-24);
  assert.ok(Math.abs(fit.parameters.CJE - expectedCje) < 1e-24);
  assert.notEqual(fit.parameters.CJC, 4e-12);
  assert.notEqual(fit.parameters.CJE, 8e-12);
  const totalDelay = 1 / (2 * Math.PI * 200e6);
  const gm = 0.01 / (1.380649e-23 * 298.15 / 1.602176634e-19);
  const expectedTf = Math.max(totalDelay - (expectedCje + expectedCjc) / gm - expectedCjc * (fit.parameters.RC + fit.parameters.RE), 1e-12);
  assert.ok(Math.abs(fit.parameters.TF - expectedTf) < 1e-20);
  assert.ok(fit.parameters.TF < totalDelay);
  assert.match(fit.parameter_metadata.CJC.status, /voltage-de-embedded/);
  assert.match(fit.parameter_metadata.TF.status, /delay-corrected/);
});

test("BJT F1 preserves condition-specific hFE bounds and PNP polarity in native ngspice", () => {
  const payload = bjtExtraction();
  payload.specs.gain_points = [
    gainPoint(200, "minimum", 0.001, 5),
    gainPoint(175, "typical", 0.01, 5),
    gainPoint(120, "maximum", 0.1, 2),
  ];
  const fit = fitBulkPart(bjtPart(), payload, { forceF1: true });
  assert.equal(fit.residuals.filter((row) => row.quantity.startsWith("hFE")).length, 3);
  assert.ok(fit.residuals.some((row) => row.quantity.includes("IC=0.001 A, VCE=5 V") && row.source_kind === "minimum"));
  assert.ok(fit.residuals.some((row) => row.quantity.includes("IC=0.1 A, VCE=2 V") && row.source_kind === "maximum"));

  const pnp = structuredClone(payload);
  pnp.specs.polarity = "pnp";
  pnp.datasheet_identity.title = "FIXTURE-Q1 single PNP transistor";
  const pnpPart = { ...bjtPart(), subcategory: "PNP BJT", description: "single PNP transistor" };
  const pnpFit = fitBulkPart(pnpPart, pnp, { forceF1: true });
  assert.equal(pnpFit.polarity, "p");
  assert.ok(pnpFit.residuals.every((row) => Number.isFinite(row.fitted_value) && row.fitted_value > 0));
});

test("BJT saturation limits seed only a native fit and never become final resistances", () => {
  const payload = bjtExtraction();
  payload.specs.gain_points = [gainPoint(180, "typical", 0.01, 5), gainPoint(120, "typical", 0.1, 5)];
  payload.specs.saturation_points = [
    { collector_current: quantity(0.01, "A"), base_current: quantity(0.001, "A"), vce_sat: { ...quantity(0.20, "V"), source_kind: "maximum" }, vbe_sat: { ...quantity(0.80, "V"), source_kind: "maximum" } },
    { collector_current: quantity(0.10, "A"), base_current: quantity(0.010, "A"), vce_sat: { ...quantity(1.00, "V"), source_kind: "maximum" }, vbe_sat: { ...quantity(1.00, "V"), source_kind: "maximum" } },
  ];
  const fit = fitBulkPart(bjtPart(), payload, { forceF1: true });
  const slope = (1.00 - 0.20) / (0.10 - 0.01);
  const seed = { RE: 0.25 * slope, RC: 0.75 * slope, RB: (1.00 - 0.80) / (0.010 - 0.001) };
  assert.match(fit.parameter_metadata.RB.status, /native fitted; cited saturation slopes were optimizer seeds only/);
  assert.ok(["RB", "RC", "RE"].some((name) => Math.abs(fit.parameters[name] - seed[name]) > 1e-6));
  assert.equal(fit.optimizer.resistance_seed_only, true);
  assert.equal(fit.optimizer.resistance_fit_supported, true);
});

test("BJT F1 preserves partial saturation bounds without using them to identify resistances", () => {
  const payload = bjtExtraction();
  payload.specs.saturation_points = [
    { collector_current: quantity(0.01, "A"), base_current: quantity(0.001, "A"), vce_sat: { ...quantity(0.20, "V"), source_kind: "maximum" }, vbe_sat: null },
    { collector_current: quantity(0.10, "A"), base_current: quantity(0.010, "A"), vce_sat: { ...quantity(1.00, "V"), source_kind: "maximum" }, vbe_sat: { ...quantity(1.00, "V"), source_kind: "maximum" } },
  ];
  const facts = bjtArchetypeFacts(bjtPart(), payload);
  assert.equal(facts.saturation_bound_points.length, 2);
  assert.equal(facts.saturation_points.length, 1);
  const fit = fitBulkPart(bjtPart(), payload, { forceF1: true });
  assert.equal(fit.optimizer.resistance_fit_supported, false);
  assert.match(fit.parameter_metadata.RB.status, /held default/);
});

test("BJT impossible condition-specific hard bounds fail without weakening inclusive checks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-bjt-hard-bound-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const payload = bjtExtraction();
    payload.specs.gain_points = [gainPoint(200, "minimum", 0.01, 5), gainPoint(100, "typical", 0.01, 5)];
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...bjtPart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "failed");
    assert.match(result[0].reason, /hfe_(?:minimum|maximum)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("BJT unavailable capacitance dimensions remain held and disclosed", () => {
  const ciboOnly = bjtExtraction();
  ciboOnly.specs.cibo = { ...quantity(12, "pF"), source_kind: "maximum", conditions: "VEB = 0.5 V, f = 1 MHz" };
  const fit = fitBulkPart(bjtPart(), ciboOnly, { forceF1: true });
  assert.ok(fit.parameters.CJE > 12e-12, "Cibo with cited bias is independently voltage-de-embedded");
  assert.equal(fit.parameters.CJC, 1e-15);
  assert.ok(fit.held_defaults.some((item) => item.parameter === "CJC"));
});

test("diode F1 transcribes cited capacitance and recovery without Schottky invention", () => {
  const payload = extraction();
  payload.usable_curves = false;
  payload.curves = [];
  payload.specs.variant = "schottky";
  payload.specs.capacitance = { ...quantity(10, "pF"), source_kind: "maximum", conditions: "VR = 0 V, f = 1 MHz" };
  payload.specs.reverse_recovery = { ...quantity(20, "ns"), source_kind: "maximum", conditions: "IF = 10 mA, IR = 10 mA" };
  const fit = fitBulkPart({ ...diodePart("unused.pdf"), subcategory: "Schottky Diodes" }, payload, { forceF1: true, ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.parameters.N, 1.8);
  assert.equal(fit.parameters.CJO, 10e-12);
  assert.equal(fit.parameters.TT, 20e-9);
  assert.match(fit.model.text, / CJO=1\.0000000000e-11 TT=2\.0000000000e-8/);
  assert.match(fit.parameter_metadata.CJO.status, /maximum values are retained conservatively/);
});

test("polarity and dual-package guards never silently change a BJT model", () => {
  const payload = bjtExtraction();
  assert.equal(polarityContractReason(bjtPart(), payload, "FIXTURE-Q1 NPN silicon transistor"), null);
  assert.match(polarityContractReason(bjtPart(), { ...payload, specs: { ...payload.specs, polarity: "pnp" } }, "FIXTURE-Q1 NPN silicon transistor"), /^polarity-mismatch:/);
  assert.match(unsupportedPackageContractReason({ ...bjtPart(), description: "dual NPN transistors" }, payload, ""), /^unsupported-package-contract:/);
  assert.throws(
    () => fitBulkPart({ ...bjtPart(), description: "dual NPN transistors" }, payload, { forceF1: true, ngspiceRunner: () => ({ pass: true }) }),
    /unsupported-package-contract/,
  );
});

test("new model comments sanitize OCR control text without mutating source metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-comment-hygiene-test-"));
  try {
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const payload = extraction();
    payload.usable_curves = false;
    payload.curves = [];
    payload.datasheet_identity.revision = "Rev A\n* OCR\u0000garbage Ω";
    const extractionPath = path.join(root, "extraction.json");
    fs.writeFileSync(extractionPath, JSON.stringify(payload));
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts: [{ ...diodePart(pdf), extraction_path: extractionPath, force_f1: true }] }));
    const result = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot: path.join(root, "empty-library") });
    assert.equal(result[0].status, "staged", JSON.stringify(result[0]));
    const model = fs.readFileSync(path.join(result[0].package_path, "model.cir"), "utf8");
    assert.match(model, /^\* Revision: Rev A \* OCRgarbage$/m);
    assert.doesNotMatch(model, /Ω|\u0000/);
    const sources = JSON.parse(fs.readFileSync(path.join(result[0].package_path, "sources.json"), "utf8"));
    assert.equal(sources[0].revision, payload.datasheet_identity.revision, "factual source JSON remains byte-faithful to the extraction");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("all reviewed packages including the 11 Batch 9 promotions are collision-only and never refitted", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-reviewed-regression-test-"));
  try {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
    const libraryRoot = path.join(repoRoot, "packages/model-library/models");
    const promotion = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/batch-9-promotion-manifest.json"), "utf8"));
    const promoted = promotion.packages.filter((item) => item.disposition === "promoted");
    assert.equal(promoted.length, 11);
    const componentPaths = [];
    for (const manufacturer of fs.readdirSync(libraryRoot)) {
      const manufacturerDir = path.join(libraryRoot, manufacturer);
      if (!fs.statSync(manufacturerDir).isDirectory()) continue;
      for (const packageName of fs.readdirSync(manufacturerDir)) {
        const componentPath = path.join(manufacturerDir, packageName, "component.json");
        if (fs.existsSync(componentPath)) componentPaths.push(componentPath);
      }
    }
    assert.equal(componentPaths.length, 703);
    const digest = () => {
      const hash = crypto.createHash("sha256");
      for (const componentPath of componentPaths.sort()) {
        const packageDir = path.dirname(componentPath);
        for (const file of fs.readdirSync(packageDir).sort()) {
          const candidate = path.join(packageDir, file);
          if (fs.statSync(candidate).isFile()) hash.update(path.relative(libraryRoot, candidate)).update(fs.readFileSync(candidate));
        }
      }
      return hash.digest("hex");
    };
    const before = digest();
    const pdf = path.join(root, "datasheet.pdf");
    fs.writeFileSync(pdf, "%PDF-1.7\nfixture\n");
    const parts = componentPaths.map((componentPath, index) => {
      const component = JSON.parse(fs.readFileSync(componentPath, "utf8"));
      const family = String(component.electrical_family).startsWith("bjt_") ? "bjt" : ["nmos", "pmos"].includes(component.electrical_family) ? "mosfet" : "diode";
      return { lcsc_id: `REVIEWED-${index}`, mpn: component.canonical_mpn, manufacturer: component.manufacturer, conveyor_family: family, datasheet_path: pdf, datasheet_url: component.datasheet.url };
    });
    const manifestPath = path.join(root, "batch.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema_version: "1.0.0", kind: "opencircuit-conveyor-batch", parts }));
    let fitCalls = 0;
    const results = runBulkManifest(manifestPath, path.join(root, "staging"), { libraryRoot, fitRunner: () => { fitCalls += 1; throw new Error("reviewed package refit attempted"); } });
    assert.equal(fitCalls, 0);
    assert.equal(results.length, 703);
    assert.ok(results.every((result) => result.status === "skipped" && result.failure_category === "library-identity-collision"));
    assert.equal(digest(), before);
    const reviewedPaths = new Set(componentPaths.map((componentPath) => path.relative(libraryRoot, path.dirname(componentPath))));
    assert.ok(promoted.every((item) => reviewedPaths.has(item.target_library_package)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("bulk manifest validation is strict while legacy registry remains independent", () => {
  assert.throws(() => normalizeBulkManifest({ schema_version: "1.0.0", kind: "wrong", parts: [] }), /Unsupported conveyor bulk manifest/);
});
