import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fitBulkPart, normalizeBulkManifest, runBulkManifest } from "../lib/bulk-adapter.mjs";

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

function extraction() {
  return {
    schema_version: "1.0.0", mpn: "FIXTURE-D1", manufacturer: "Fixture Semi", family: "diode",
    datasheet_identity: { title: "Fixture D1", revision: "A", pages_examined: ["p. 2"] }, usable_curves: true,
    curves: [{ name: "Forward IV", x_axis: { quantity: "voltage", unit: "V", scale: "linear" }, y_axis: { quantity: "current", unit: "A", scale: "log" }, test_conditions: "TA=25 C", page_reference: "p. 2", points: [{ x: 0.48, y: 1e-4 }, { x: 0.60, y: 1e-3 }, { x: 0.72, y: 1e-2 }, { x: 0.84, y: 1e-1 }] }],
    specs: { variant: "signal", forward_voltage_points: [{ current: quantity(0.01, "A"), voltage: quantity(0.72, "V") }], reverse_current: null, capacitance: null, reverse_recovery: null, breakdown_voltage: null, breakdown_current: null }, extraction_notes: [], omission_reason: null,
  };
}

test("bulk adapter fits curve-backed diode without touching reviewed library", () => {
  const fit = fitBulkPart(diodePart("unused.pdf"), extraction(), { ngspiceRunner: () => ({ pass: true }) });
  assert.equal(fit.fidelity, "F2");
  assert.match(fit.model.text, /\.model .* D\(/);
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
    assert.equal(component.reviewer.tool_or_agent, "pending-review");
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

test("bulk manifest validation is strict while legacy registry remains independent", () => {
  assert.throws(() => normalizeBulkManifest({ schema_version: "1.0.0", kind: "wrong", parts: [] }), /Unsupported conveyor bulk manifest/);
});
