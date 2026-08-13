import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pythonDir = path.resolve(here, "../python");
const localVenvPython = path.resolve(here, "../.venv/bin/python");
const sharedVenvPython = "/Users/hughp/Documents/opencircuit/tools/model-factory/.venv/bin/python";
const venvPython = fs.existsSync(localVenvPython) ? localVenvPython : sharedVenvPython;
const gates = JSON.parse(fs.readFileSync(path.resolve(here, "../lib/fit-gates.json"), "utf8"));
const skip = fs.existsSync(venvPython) && fs.existsSync("/opt/homebrew/bin/ngspice")
  ? false : "requires tools/model-factory/.venv and native ngspice";

function runFit(payload) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fit-conveyor-test-"));
  try {
    const input = path.join(root, "payload.json");
    const output = path.join(root, "fitted.json");
    fs.writeFileSync(input, JSON.stringify(payload));
    const result = spawnSync(venvPython, [path.join(pythonDir, "fit_conveyor.py"), input, output], {
      cwd: pythonDir, encoding: "utf8", timeout: 300_000,
    });
    assert.equal(result.status, 0, `fit_conveyor.py failed: ${result.stdout}\n${result.stderr}`);
    return JSON.parse(fs.readFileSync(output, "utf8"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function captureNativeResidualProbeNetlists() {
  const program = String.raw`
import json
import fit_conveyor as subject
captured = []
subject.run_ngspice = lambda netlist: captured.append(netlist) or {}
subject.vector = lambda *_args: [0.7]
subject.diode_bench({"IS": 1e-12, "N": 1.5, "RS": 0.1}, [1e-3])
subject.bjt_bench({"IS": 1e-15, "BF": 100, "VAF": 100, "IKF": 0.1, "ISE": 1e-15, "RB": 1, "RC": 0.1, "RE": 0.1}, [(1e-3, 100)], 5, "n")
subject.vdmos_bench([2, 1, 0.1, 0.01, 0.1], {"RS": 0.1, "CGS": 1e-9, "CGDMAX": 1e-9, "CGDMIN": 1e-12, "CJO": 1e-9, "RB": 1}, [(3, 7, 0.1, 25)], [], [])
print(json.dumps(captured))
`;
  const result = spawnSync(venvPython, ["-c", program], {
    cwd: pythonDir, encoding: "utf8", timeout: 300_000,
  });
  assert.equal(result.status, 0, `native residual probe capture failed: ${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

const curve = (name, xq, xu, yq, yu, conditions, points, page = "p. 3") => ({
  name, x_axis: { quantity: xq, unit: xu, scale: "linear" }, y_axis: { quantity: yq, unit: yu, scale: "log" },
  test_conditions: conditions, page_reference: page, points: points.map(([x, y]) => ({ x, y })),
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

const hash = (value) => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
const sourceSha = "1".repeat(64);

function conditionIdentity(characteristic, { polarity = "n", temperature = 25, vgs, vds, id, mode = { kind: "dc" }, qualifiers = [] } = {}) {
  const identity = {
    schema_version: "1.0.0", characteristic, polarity, magnitude_convention: "absolute",
    temperature: { kind: "junction", value_c: temperature },
    electrical: { vgs, vds, id }, test_mode: mode, qualifiers,
  };
  return { ...identity, condition_id: hash(identity) };
}

function citationIdentity({ page = 3, table, row, column, figure, curve: curveName } = {}) {
  const identity = { source_sha256: sourceSha, page,
    ...(table ? { table, row, ...(column ? { column } : {}) } : { figure, curve: curveName }) };
  return { ...identity, citation_id: hash(identity) };
}

function evidenceDatum({ characteristic, quantity, value, unit, role, condition, citation }) {
  const cohortMaterial = { characteristic, condition_id: condition.condition_id, source_sha256: citation.source_sha256,
    page: citation.page, ...(citation.table ? { table: citation.table, row: citation.row } : { figure: citation.figure, curve: citation.curve }) };
  const identity = { role, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: hash(cohortMaterial) };
  const evidenceMaterial = { characteristic, role, quantity, value_si: value, unit_si: unit,
    condition_id: condition.condition_id, citation_id: citation.citation_id };
  return { value, unit, condition_identity: condition, citation_identity: citation,
    evidence_identity: { ...identity, evidence_id: hash(evidenceMaterial) } };
}

function canonicalCurve(characteristic, points, condition, citation, axes = { x: "VGS", y: "ID" }) {
  const normalized = points.map(([x, y], point_index) => ({ point_index, x_si: x, y_si: y }));
  const x_axis = { quantity: axes.x, unit: "V", scale: "linear" };
  const y_axis = { quantity: axes.y, unit: "A", scale: "log" };
  const curveMaterial = { schema_version: "1.0.0", characteristic, x_axis, y_axis,
    condition_id: condition.condition_id, citation_id: citation.citation_id, points: normalized };
  const curve_id = hash(curveMaterial);
  const cohort_id = hash({ characteristic, condition_id: condition.condition_id, citation_id: citation.citation_id, curve_id });
  return {
    name: `${citation.figure} ${citation.curve}`, x_axis, y_axis, condition_identity: condition,
    citation_identity: citation, curve_id,
    points: normalized.map((point) => ({ ...point, evidence_identity: {
      role: "digitized_typical_curve", condition_id: condition.condition_id, citation_id: citation.citation_id,
      cohort_id, curve_id, point_index: point.point_index, evidence_id: hash({ characteristic, role: "digitized_typical_curve", ...point,
        condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id, curve_id }),
    } })),
  };
}

function canonicalMosfetPayload({ polarity = "n", temperature = 25, transferVds = 7, mode = { kind: "dc" } } = {}) {
  const thresholdCondition = conditionIdentity("gate_threshold", { polarity, temperature,
    vgs: { kind: "relation", relation: "measured_threshold" },
    vds: { kind: "relation", relation: "vds_equals_vgs" }, id: { kind: "fixed", value_a: 250e-6 }, mode });
  const thresholdCitation = citationIdentity({ page: 2, table: "Electrical characteristics", row: "Gate threshold voltage" });
  const transferCondition = conditionIdentity("transfer_current", { polarity, temperature,
    vgs: { kind: "range", lower_v: 1, upper_v: 4 }, vds: { kind: "fixed", value_v: transferVds },
    id: { kind: "range", lower_a: 1e-4, upper_a: 1 }, mode });
  const transferCitation = citationIdentity({ page: 3, figure: "Figure 1", curve: "25 C trace" });
  const rdsCondition = conditionIdentity("rds_on", { polarity, temperature,
    vgs: { kind: "fixed", value_v: 4.5 }, vds: { kind: "range", lower_v: 0, upper_v: 1 },
    id: { kind: "fixed", value_a: 1 }, mode });
  const rdsCitation = citationIdentity({ page: 2, table: "Electrical characteristics", row: "Static drain-source on resistance" });
  const threshold = {
    threshold_min: evidenceDatum({ characteristic: "gate_threshold", quantity: "threshold_minimum", value: 1, unit: "V", role: "minimum", condition: thresholdCondition, citation: thresholdCitation }),
    threshold_max: evidenceDatum({ characteristic: "gate_threshold", quantity: "threshold_maximum", value: 2.5, unit: "V", role: "maximum", condition: thresholdCondition, citation: thresholdCitation }),
  };
  const rdson = {
    vgs: evidenceDatum({ characteristic: "rds_on", quantity: "vgs", value: 4.5, unit: "V", role: "typical", condition: rdsCondition, citation: rdsCitation }),
    current: evidenceDatum({ characteristic: "rds_on", quantity: "drain_current", value: 1, unit: "A", role: "typical", condition: rdsCondition, citation: rdsCitation }),
    resistance: evidenceDatum({ characteristic: "rds_on", quantity: "rds_on_typical", value: 0.2, unit: "ohm", role: "typical", condition: rdsCondition, citation: rdsCitation }),
  };
  return { family: "mosfet", polarity, evidence_contract_version: "1.0.0", extraction: {
    usable_curves: true, specs: { ...threshold, rdson_points: [rdson] },
    curves: [canonicalCurve("transfer_current", [[1, 1e-4], [1.5, 1e-3], [2, 1e-2], [2.5, 0.1], [3, 0.5], [3.5, 1]], transferCondition, transferCitation)],
  } };
}

const diodePayload = (curves, specs = {}) => ({
  family: "diode", polarity: "n", mpn: "FIXTURE-D", manufacturer: "Fixture", seed_hints: [],
  extraction: { schema_version: "1.0.0", mpn: "FIXTURE-D", manufacturer: "Fixture", family: "diode", usable_curves: true, curves, specs },
});

// A clean silicon forward curve: one decade per 120 mV, so N ~ 2 and RS ~ 0.
const CLEAN_IV = [[0.48, 1e-4], [0.60, 1e-3], [0.72, 1e-2], [0.84, 1e-1]];

// ---------------------------------------------------------------- curve selection

test("a thermal derating curve is never fitted as an I-V curve", { skip }, () => {
  // SS36-E3/57T's first name match for "forward" was its derating curve, which the old
  // substring matcher regressed into N = -2511 and IS = 12 A.
  const fitted = runFit(diodePayload([
    curve("Fig. 1 - Forward Current Derating Curve", "lead temperature", "degC", "average forward rectified current", "A",
      "PCB mounted", [[0, 3.0], [50, 3.0], [100, 3.0], [120, 3.0], [135, 1.5]]),
    curve("Fig. 3 - Typical Instantaneous Forward Characteristics", "instantaneous forward voltage", "V",
      "instantaneous forward current", "A", "TJ = 25 degC", CLEAN_IV),
  ]));
  assert.equal(fitted.fidelity, "F2");
  assert.ok(fitted.parameters.N > 0.9 && fitted.parameters.N < 4, `N must stay physical, got ${fitted.parameters.N}`);
  assert.ok(fitted.parameters.IS < 1e-3, `IS must stay physical, got ${fitted.parameters.IS}`);
  assert.equal(fitted.curves_used.length, 1);
  assert.match(fitted.curves_used[0], /Instantaneous Forward Characteristics/);
  assert.match(fitted.curves_rejected.join("\n"), /Derating Curve: abscissa is 'lead temperature'/);
});

test("declared axis units are applied, so a milliamp ordinate is not read as amps", { skip }, () => {
  const inAmps = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "A", "Tamb = 25 degC", CLEAN_IV)]));
  const inMilliamps = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "mA", "Tamb = 25 degC",
    CLEAN_IV.map(([v, i]) => [v, i * 1000]))]));
  assert.equal(inAmps.fidelity, "F2");
  assert.equal(inMilliamps.fidelity, "F2");
  // Identical physics expressed in different units must produce the same saturation current.
  const ratio = inMilliamps.parameters.IS / inAmps.parameters.IS;
  assert.ok(ratio > 0.99 && ratio < 1.01, `mA and A curves disagreed on IS by ${ratio}x`);
});

test("an unrecognised unit is refused rather than silently treated as SI", { skip }, () => {
  const fitted = runFit(diodePayload([curve("Forward", "Forward voltage", "furlongs", "Forward current", "A", "25 degC", CLEAN_IV)]));
  assert.equal(fitted.fidelity, "F1");
  assert.match(fitted.demotion_reason, /cannot support an F2 fit/);
});

// ------------------------------------------------------------ extraction validation

test("legacy MOSFET residual curves are not admissible without canonical identities", { skip }, () => {
  const base = curve(
    "Figure 1 Typical Transfer Characteristics",
    "gate-to-source voltage VGS", "V", "drain current ID", "A",
    "VDS = 10 V, TJ = 25 degC",
    [[1, 1e-4], [1.5, 1e-3], [2, 1e-2], [2.5, 0.1], [3, 0.5], [3.5, 1]],
    "PDF page 3 (Figure 1)",
  );
  const payload = (candidate) => ({ family: "mosfet", polarity: "n", mpn: "FIXTURE-M", manufacturer: "Fixture", seed_hints: [], extraction: {
    schema_version: "1.0.0", mpn: "FIXTURE-M", manufacturer: "Fixture", family: "mosfet", usable_curves: true,
    curves: [candidate], specs: { polarity: "n" },
  } });

  const noTemperature = structuredClone(base);
  noTemperature.test_conditions = "VDS = 10 V";
  const temperatureResult = runFit(payload(noTemperature));
  assert.equal(temperatureResult.fidelity, "F1");
  assert.match(temperatureResult.demotion_reason, /evidence_contract_version/);

  const noFigure = structuredClone(base);
  noFigure.name = "Typical Transfer Characteristics";
  noFigure.page_reference = "PDF page 3";
  const citationResult = runFit(payload(noFigure));
  assert.equal(citationResult.fidelity, "F1");
  assert.match(citationResult.demotion_reason, /evidence_contract_version/);

  const noBias = structuredClone(base);
  noBias.test_conditions = "TJ = 25 degC";
  const biasResult = runFit(payload(noBias));
  assert.equal(biasResult.fidelity, "F1");
  assert.match(biasResult.demotion_reason, /evidence_contract_version/);
});

test("canonical MOSFET F2 carries identities and probes exact curve bias and temperature", { skip, timeout: 300_000 }, () => {
  const payload = canonicalMosfetPayload({ polarity: "n", temperature: 75, transferVds: 7 });
  const fitted = runFit(payload);
  assert.ok(["F1", "F2"].includes(fitted.fidelity));
  assert.ok(fitted.parameters, `${fitted.demotion_reason}\n${fitted.curves_rejected.join("\n")}`);
  assert.ok(fitted.residuals.every((row) => row.condition_identity?.condition_id?.startsWith("sha256:")));
  assert.ok(fitted.residuals.every((row) => row.citation_identity?.citation_id?.startsWith("sha256:")));
  assert.ok(fitted.residuals.every((row) => row.evidence_identity?.evidence_id?.startsWith("sha256:")));
  assert.ok(fitted.residuals.every((row) => row.temperature_c === 75));
  assert.equal(fitted.optimizer.seed_provenance.VTO.condition_identity.temperature.value_c, 75);
  assert.match(fitted.residuals[0].citation, /page 3, figure Figure 1/);
});

test("MOSFET F2 fails closed without the canonical contract marker", { skip }, () => {
  const payload = canonicalMosfetPayload();
  delete payload.evidence_contract_version;
  const fitted = runFit(payload);
  assert.equal(fitted.fidelity, "F1");
  assert.equal(fitted.parameters, null);
  assert.match(fitted.demotion_reason, /evidence_contract_version 1\.0\.0/);
});

test("MOSFET F2 VTO never exceeds a complete published threshold maximum", { skip, timeout: 300_000 }, () => {
  const payload = canonicalMosfetPayload();
  payload.extraction.specs.threshold_max.value = 2.05;
  payload.extraction.specs.threshold_max.evidence_identity = evidenceDatum({
    characteristic: "gate_threshold", quantity: "threshold_maximum", value: 2.05, unit: "V", role: "maximum",
    condition: payload.extraction.specs.threshold_max.condition_identity,
    citation: payload.extraction.specs.threshold_max.citation_identity,
  }).evidence_identity;
  const fitted = runFit(payload);
  assert.ok(fitted.parameters, fitted.demotion_reason);
  assert.ok(fitted.parameters.VTO <= 2.05 + 1e-12, `VTO ${fitted.parameters.VTO} exceeded published maximum`);
  assert.ok(!(fitted.optimizer.held_defaults ?? []).some((item) => item.parameter === "VTO"), "critical VTO must not be a held-default exception");
});

test("MOSFET F2 rejects incomplete, hybrid, pulsed, placeholder, and unknown qualifier evidence", { skip }, () => {
  const mutations = [
    ["missing temperature", (p) => { delete p.extraction.specs.threshold_min.condition_identity.temperature; }],
    ["hybrid RDS cohort", (p) => { p.extraction.specs.rdson_points[0].current.evidence_identity.cohort_id = `sha256:${"f".repeat(64)}`; }],
    ["pulsed DC evidence", (p) => { p.extraction.curves[0].condition_identity.test_mode = { kind: "pulsed", pulse_width_s: 1e-6 }; }],
    ["placeholder citation", (p) => { p.extraction.specs.threshold_max.citation_identity.table = "pending review"; }],
    ["unknown RDS qualifier", (p) => { p.extraction.specs.rdson_points[0].resistance.evidence_identity.role = "estimated"; }],
    ["point identity override", (p) => { p.extraction.curves[0].points[0].condition_identity = p.extraction.curves[0].condition_identity; }],
  ];
  for (const [name, mutate] of mutations) {
    const payload = canonicalMosfetPayload();
    mutate(payload);
    const fitted = runFit(payload);
    assert.equal(fitted.fidelity, "F1", name);
    assert.equal(fitted.parameters, null, name);
  }
});

test("MOSFET F2 rejects a published incomplete critical point rather than dropping it", { skip }, () => {
  const payload = canonicalMosfetPayload();
  delete payload.extraction.specs.rdson_points[0].current.condition_identity;
  const fitted = runFit(payload);
  assert.equal(fitted.fidelity, "F1");
  assert.equal(fitted.parameters, null);
  assert.match(fitted.demotion_reason, /condition_identity/);
});

test("canonical N, P, and mixed threshold cohorts validate independently", { skip }, () => {
  for (const polarity of ["n", "p"]) {
    const payload = canonicalMosfetPayload({ polarity });
    const fitted = runFit(payload);
    assert.ok(fitted.parameters, `${polarity}: ${fitted.demotion_reason}`);
  }
  const mixed = canonicalMosfetPayload();
  const foreign = canonicalMosfetPayload({ temperature: 125 }).extraction.specs.threshold_max;
  mixed.extraction.specs.threshold_max = foreign;
  const fitted = runFit(mixed);
  assert.equal(fitted.fidelity, "F1");
  assert.equal(fitted.parameters, null);
  assert.match(fitted.demotion_reason, /hybrid|cohort/i);
});

test("a non-monotonic forward curve is rejected, not fitted", { skip }, () => {
  const fitted = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "A", "25 degC",
    [[0.48, 1e-4], [0.60, 1e-3], [0.72, 9e-4], [0.84, 1e-1]])]));
  assert.equal(fitted.fidelity, "F1");
  assert.match(fitted.curves_rejected.join("\n"), /non-monotonic digitised trace/);
  assert.match(fitted.demotion_reason, /cannot support an F2 fit/);
});

test("too few surviving points demotes honestly instead of fitting noise", { skip }, () => {
  const fitted = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "A", "25 degC",
    [[0.48, 1e-4], [0.60, 1e-3], [0.72, 1e-2]])]));
  assert.equal(fitted.fidelity, "F1");
  assert.match(fitted.demotion_reason, /3 usable points|no 25 degC forward/);
});

// ------------------------------------------------------------- parameter physicality

test("a parameter parked on a physical bound fails the gate however small the residual", { skip }, () => {
  // 60 mV/decade implies N ~ 1.0 for an ideal junction; 40 mV/decade demands N < 0.9,
  // which is better than ideal and therefore a digitisation slope error.
  const fitted = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "A", "25 degC",
    [[0.30, 1e-4], [0.34, 1e-3], [0.38, 1e-2], [0.42, 1e-1]])]));
  assert.equal(fitted.fidelity, "F1");
  assert.match(fitted.demotion_reason, /N saturated its physical bound/);
});

test("zero series resistance is a declared held default, not a bound artefact", { skip }, () => {
  const fitted = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "A", "25 degC", CLEAN_IV)]));
  assert.equal(fitted.fidelity, "F2");
  assert.equal(fitted.parameters.RS, 0, "sub-micro-ohm RS must snap to exactly 0 so ngspice omits the internal node");
  const held = fitted.optimizer.held_defaults.map((item) => item.parameter);
  assert.ok(held.includes("RS"), `RS should be declared held, got ${JSON.stringify(fitted.optimizer.held_defaults)}`);
});

// --------------------------------------------------------------- residual provenance

test("all native conveyor residual probes pin the cited 25 degC temperature", { skip }, () => {
  const probes = captureNativeResidualProbeNetlists();
  assert.equal(probes.length, 3);
  for (const netlist of probes) {
    assert.equal(netlist.match(/^\.temp 25$/gm)?.length, 1, netlist);
    assert.ok(netlist.indexOf("\n.temp 25\n") < netlist.indexOf("\n.op\n"), netlist);
  }
});

test("standalone VDMOS native probes use exact evidence temperatures and transfer VDS", { skip }, () => {
  const program = String.raw`
import json
import fit_vdmos as subject
captured = []
subject.run_ngspice = lambda netlist: captured.append(netlist) or {}
subject.vector = lambda *_args: [0.1]
fixed = {"A": 0.5, "RS": 0.1, "RG": 0.1, "CGS": 1e-9, "CGDMAX": 1e-10, "CGDMIN": 1e-11, "CJO": 1e-10, "IS": 1e-12, "RB": 0.1, "TT": 1e-9, "BV": 100, "IBV": 1e-6, "RTHJC": 1, "RTHCA": 10}
prepared = {"_prepared": True, "transfer_points": [{"vgs": 3, "vds": 7, "current": 0.1, "temperature_c": 75}], "rdson_points": [], "output_points": []}
subject.evaluate_dc([2, 1, 0, 0.003, 0.1], fixed, prepared)
subject.evaluate_capacitance(0.5, [2, 1, 0, 0.003, 0.1], fixed, {"capacitance_temperature_c": 125, "capacitances": {"crss_curve": []}})
print(json.dumps(captured))
`;
  const result = spawnSync(venvPython, ["-c", program], { cwd: pythonDir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const probes = JSON.parse(result.stdout);
  assert.equal(probes.length, 2);
  assert.match(probes[0], /^\.temp 75$/m);
  assert.match(probes[0], / DC 7(?:\.0+)?$/m);
  assert.doesNotMatch(probes[0], / DC 25$/m);
  assert.match(probes[1], /^\.temp 125$/m);
});

test("residuals are measured through native ngspice, not the fitter's own algebra", { skip }, () => {
  const fitted = runFit(diodePayload([curve("Forward", "Forward voltage", "V", "Forward current", "A", "25 degC", CLEAN_IV)]));
  assert.match(fitted.fitter, /native ngspice/);
  assert.equal(fitted.residuals.length, CLEAN_IV.length);
  for (const [index, row] of fitted.residuals.entries()) {
    assert.equal(row.datasheet_value, CLEAN_IV[index][0], "residual rows carry the datasheet voltage");
    assert.ok(Number.isFinite(row.fitted_value) && row.fitted_value > 0);
    assert.equal(row.gate_quantity, "forward_voltage");
  }
  assert.ok(fitted.worst.value <= gates.families.diode.quantities.forward_voltage.worst);
});

test("signed PNP gain and VBE curves are fitted as magnitudes", { skip }, () => {
  const extraction = {
    schema_version: "1.0.0", mpn: "FIXTURE-PNP", manufacturer: "Fixture", family: "bjt", usable_curves: true,
    curves: [
      curve("PNP DC current gain at 25 degC", "collector current", "A", "DC current gain hFE", "1", "VCE = -10 V, TJ = 25 degC",
        [[-5e-2, 50], [-2e-2, 80], [-1e-2, 90], [-1e-3, 95], [-1e-4, 95]], "p. 3, Figure 1"),
      curve("PNP base-emitter on voltage at 25 degC", "collector current", "A", "base-emitter on voltage VBE(on)", "V", "TJ = 25 degC",
        [[-5e-2, -0.76], [-1e-2, -0.68], [-1e-3, -0.63], [-1e-4, -0.59]], "p. 3, Figure 4"),
    ],
    specs: { polarity: "pnp" },
  };
  const fitted = runFit({ family: "bjt", polarity: "p", mpn: "FIXTURE-PNP", manufacturer: "Fixture", extraction });
  assert.equal(fitted.fidelity, "F2");
  assert.equal(fitted.residuals.length, 5);
  assert.ok(fitted.residuals.every((row) => row.datasheet_value > 0));
  assert.match(fitted.optimizer.held_defaults.find((item) => item.parameter === "IS").reason, /VBE = 0\.68 V/);
});

test("BJT nominal IS uses the 25 degC VBE curve even when a hot curve appears first", { skip }, () => {
  const extraction = {
    schema_version: "1.0.0", mpn: "FIXTURE-Q", manufacturer: "Fixture", family: "bjt", usable_curves: true,
    curves: [
      curve("DC current gain at 25 degC", "collector current", "A", "DC current gain hFE", "1", "VCE = 10 V, TJ = 25 degC",
        [[1e-4, 95], [1e-3, 95], [1e-2, 90], [2e-2, 80], [5e-2, 50]], "p. 3, Figure 1"),
      curve("Base-emitter on voltage at 150 degC", "collector current", "A", "base-emitter on voltage VBE(on)", "V", "TJ = 150 degC",
        [[1e-4, 0.28], [1e-3, 0.36], [1e-2, 0.43], [5e-2, 0.57]], "p. 3, Figure 4"),
      curve("Base-emitter on voltage at 25 degC", "collector current", "A", "base-emitter on voltage VBE(on)", "V", "TJ = 25 degC",
        [[1e-4, 0.59], [1e-3, 0.63], [1e-2, 0.68], [5e-2, 0.76]], "p. 3, Figure 4"),
    ],
    specs: {},
  };
  const fitted = runFit({ family: "bjt", polarity: "n", mpn: "FIXTURE-Q", manufacturer: "Fixture", extraction });
  assert.equal(fitted.fidelity, "F2");
  assert.match(fitted.curves_used.join("\n"), /Base-emitter on voltage at 25 degC/);
  assert.doesNotMatch(fitted.curves_used.join("\n"), /150 degC/);
  const heldIs = fitted.optimizer.held_defaults.find((item) => item.parameter === "IS");
  assert.match(heldIs.reason, /VBE = 0\.68 V/);
});

// ------------------------------------------------------------- gate calibration table

test("gate calibration stays below the level that would have passed the P5 demotions", () => {
  const tolerances = [];
  for (const family of Object.values(gates.families)) {
    for (const [name, limit] of Object.entries(family.quantities)) {
      tolerances.push([name, limit]);
      assert.ok(limit.rationale && limit.rationale.length > 80, `${name} tolerance needs a written justification`);
      assert.ok(limit.rms <= limit.worst, `${name} RMS tolerance must not exceed its worst tolerance`);
    }
  }
  assert.ok(tolerances.length >= 4);
  const ceiling = Math.max(...tolerances.map(([, limit]) => limit.worst));
  assert.ok(ceiling < 0.40, `no tolerance may reach 0.40, found ${ceiling}`);
  for (const demoted of gates.precedent.must_stay_demoted) {
    assert.ok(demoted.worst > ceiling,
      `${demoted.part} was correctly demoted at ${demoted.worst} but the loosest gate is ${ceiling}`);
  }
});

test("a conveyor F2 claims DC coverage only", () => {
  assert.equal(gates.coverage.ac, "none");
  assert.equal(gates.coverage.transient, "none");
  assert.equal(gates.coverage.dc, "fitted");
});
