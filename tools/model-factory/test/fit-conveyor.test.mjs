import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pythonDir = path.resolve(here, "../python");
const venvPython = path.resolve(here, "../.venv/bin/python");
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
subject.vdmos_bench([2, 1, 0.1, 0.01, 0.1], {"RS": 0.1, "CGS": 1e-9, "CGDMAX": 1e-9, "CGDMIN": 1e-12, "CJO": 1e-9, "RB": 1}, [], [], [])
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

test("MOSFET residual curves require explicit temperature, citation, and transfer bias or range", { skip }, () => {
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
  assert.match(temperatureResult.curves_rejected.join("\n"), /no explicit curve temperature/);

  const noFigure = structuredClone(base);
  noFigure.name = "Typical Transfer Characteristics";
  noFigure.page_reference = "PDF page 3";
  const citationResult = runFit(payload(noFigure));
  assert.equal(citationResult.fidelity, "F1");
  assert.match(citationResult.curves_rejected.join("\n"), /figure or curve number/);

  const noBias = structuredClone(base);
  noBias.test_conditions = "TJ = 25 degC";
  const biasResult = runFit(payload(noBias));
  assert.equal(biasResult.fidelity, "F1");
  assert.match(biasResult.curves_rejected.join("\n"), /neither an explicit VDS bias nor a stated VDS saturation range/);
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

test("standalone VDMOS native DC and capacitance probes pin 25 degC", { skip }, () => {
  const program = String.raw`
import json
import fit_vdmos as subject
captured = []
subject.run_ngspice = lambda netlist: captured.append(netlist) or {}
fixed = {"A": 0.5, "RS": 0.1, "RG": 0.1, "CGS": 1e-9, "CGDMAX": 1e-10, "CGDMIN": 1e-11, "CJO": 1e-10, "IS": 1e-12, "RB": 0.1, "TT": 1e-9, "BV": 100, "IBV": 1e-6, "RTHJC": 1, "RTHCA": 10}
subject.evaluate_dc([2, 1, 0, 0.003, 0.1], fixed, {"transfer_points": [], "rdson_points": [], "output_points": []})
subject.evaluate_capacitance(0.5, [2, 1, 0, 0.003, 0.1], fixed, {"capacitances": {"crss_curve": []}})
print(json.dumps(captured))
`;
  const result = spawnSync(venvPython, ["-c", program], { cwd: pythonDir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const probes = JSON.parse(result.stdout);
  assert.equal(probes.length, 2);
  for (const netlist of probes) assert.equal(netlist.match(/^\.temp 25$/gm)?.length, 1, netlist);
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
