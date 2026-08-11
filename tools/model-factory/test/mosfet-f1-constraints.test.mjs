import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultMosfetConstraintRunner, fitBulkPart } from "../lib/bulk-adapter.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, "fixtures", "mosfet-f1");
const venvPython = path.resolve(here, "../.venv/bin/python");
const pythonDir = path.resolve(here, "../python");
const nativeAvailable = fs.existsSync(venvPython) && fs.existsSync("/opt/homebrew/bin/ngspice");
const skipNative = nativeAvailable ? false : "requires tools/model-factory/.venv and native ngspice";

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), "utf8"));
}

function syntaxPass() {
  return { pass: true };
}

function verifyWithoutProjection(payload) {
  const rdson = payload.seed.rdson;
  return {
    parameters: { VTO: payload.seed.vto, KP: 2 / rdson, THETA: 0, LAMBDA: 0.003, RD: 0.55 * rdson, RS: 0.2 * rdson, RG: 1e-4, ...payload.fixed, IS: 1e-12, N: 1.5, RB: 0.2 * rdson },
    constraint_results: payload.constraints.map((constraint) => ({ ...constraint, inclusive: true, satisfied: true })),
    optimizer: { residual_target_count: 0 },
  };
}

test("five Batch 12 typical-point outputs stay exact and all seven survivors retain fidelity gates", { skip: skipNative, timeout: 900_000 }, () => {
  const regression = loadFixture("batch12-survivor-regression");
  assert.equal(regression.survivors.length, 7);
  for (const survivor of regression.survivors) {
    const fit = fitBulkPart(survivor.part, survivor.extraction, {
      forceF1: survivor.expected.fidelity === "F1",
      ngspiceRunner: syntaxPass,
      ...(survivor.expected.fidelity === "F1" ? { mosfetConstraintRunner: verifyWithoutProjection } : {}),
    });
    assert.equal(fit.fidelity, survivor.expected.fidelity, survivor.name);
    if (survivor.expected.fidelity === "F1") {
      assert.deepEqual(fit.parameters, survivor.expected.parameters, `${survivor.name} typical-point parameter vector changed`);
      assert.equal(fit.model.text, survivor.expected.model_text, `${survivor.name} typical-point model card changed`);
    } else {
      assert.equal(fit.evidence_mode, "curve-fitted", survivor.name);
      assert.ok(fit.worst <= 0.20, `${survivor.name} F2 worst gate changed`);
      assert.ok(fit.rms <= 0.12, `${survivor.name} F2 RMS gate changed`);
      assert.ok(fit.calibration.constraints.every((row) => row.evidence_role === "inequality_constraint"));
      assert.ok(fit.calibration.observations.every((row) => row.evidence_role !== "inequality_constraint"));
    }
  }
});

test("an incompatible legacy typical-point vector stops rather than changing its numerical output", { skip: skipNative, timeout: 300_000 }, () => {
  const regression = loadFixture("batch12-survivor-regression");
  const survivor = regression.survivors.find((row) => row.name === "FSS2301S");
  assert.throws(
    () => fitBulkPart(survivor.part, survivor.extraction, { forceF1: true, ngspiceRunner: syntaxPass }),
    /fixed typical-point VTO seed .* outside feasible interval/,
  );
});

for (const name of ["IRLML5203TRPBF", "IRF740PBF", "FDN360P"]) {
  test(`clean-room ${name} fixture satisfies native 25 C inclusive constraints`, { skip: skipNative, timeout: 300_000 }, () => {
    const fixture = loadFixture(name);
    const fit = fitBulkPart(fixture.part, fixture.extraction, { forceF1: true, ngspiceRunner: syntaxPass });
    assert.equal(fit.fidelity, "F1");
    assert.equal(fit.evidence_mode, "interval-constrained");
    assert.equal(fit.calibration.evidence_mode, "interval-constrained");
    assert.ok(fit.calibration.constraints.length >= 2);
    assert.ok(fit.calibration.constraints.every((constraint) => constraint.inclusive && constraint.satisfied));
    assert.ok(fit.calibration.constraints.every((constraint) => constraint.temperature_c === 25));
    assert.equal(fit.optimizer.residual_target_count, 0, "bound constraints never enter a residual-target vector");
    assert.equal(fit.residuals?.length ?? 0, 0, "bound constraints are not emitted as equality residuals");
    for (const constraint of fit.calibration.constraints) {
      if (constraint.kind === "threshold_interval") {
        assert.ok(constraint.predicted_value >= constraint.minimum_v);
        assert.ok(constraint.predicted_value <= constraint.maximum_v);
      } else {
        assert.equal(Object.hasOwn(constraint, "minimum_ohm"), false, "RDS maximum stays one-sided");
        assert.ok(constraint.predicted_value <= constraint.maximum_ohm);
      }
    }
  });
}

test("threshold interval rejects equal endpoints before optimizer execution", () => {
  const fixture = loadFixture("IRF740PBF");
  fixture.extraction.specs.threshold_min.value = 4;
  assert.throws(
    () => fitBulkPart(fixture.part, fixture.extraction, { forceF1: true, ngspiceRunner: syntaxPass, mosfetConstraintRunner: () => assert.fail("optimizer must not run") }),
    /degenerate or reversed/,
  );
});

test("constraint evidence without an exact cited temperature fails before probing", () => {
  const fixture = loadFixture("IRF740PBF");
  fixture.extraction.specs.threshold_min.conditions = "VDS = VGS, ID = 250 µA";
  fixture.extraction.specs.threshold_max.conditions = "VDS = VGS, ID = 250 µA";
  assert.throws(
    () => fitBulkPart(fixture.part, fixture.extraction, { forceF1: true, ngspiceRunner: syntaxPass, mosfetConstraintRunner: () => assert.fail("probe must not run") }),
    /must cite an exact temperature/,
  );
});

test("threshold and RDS conditions map exact cited temperature and bias into constraint probes", () => {
  const fixture = loadFixture("IRF740PBF");
  for (const threshold of [fixture.extraction.specs.threshold_min, fixture.extraction.specs.threshold_max]) {
    threshold.conditions = "VDS = VGS, ID = 500 µA, TJ = 75 °C";
  }
  for (const point of fixture.extraction.specs.rdson_points) {
    for (const quantity of [point.vgs, point.current, point.resistance]) quantity.conditions = "VGS = 10 V, ID = 6 A, TJ = 75 °C";
  }
  let captured;
  const fit = fitBulkPart(fixture.part, fixture.extraction, {
    forceF1: true,
    ngspiceRunner: syntaxPass,
    mosfetConstraintRunner: (payload) => {
      captured = payload;
      const rdson = payload.seed.rdson;
      return {
        parameters: { VTO: payload.seed.vto, KP: 2 / rdson, THETA: 0, LAMBDA: 0.003, RD: 0.55 * rdson, RS: 0.2 * rdson, RG: 1e-4, ...payload.fixed, IS: 1e-12, N: 1.5, RB: 0.2 * rdson },
        constraint_results: payload.constraints.map((constraint) => ({ ...constraint, inclusive: true, satisfied: true })),
        optimizer: { residual_target_count: 0 },
      };
    },
  });
  assert.equal(fit.evidence_mode, "interval-constrained");
  assert.deepEqual(captured.constraints.map((constraint) => constraint.temperature_c), [75, 75]);
  assert.equal(captured.constraints[0].current_a, 500e-6);
  assert.equal(captured.constraints[1].vgs_v, 10);
  assert.equal(captured.constraints[1].current_a, 6);
});

test("native constraint probes emit exactly the cited temperature directive", { skip: skipNative }, () => {
  const program = String.raw`
import json
import fit_mosfet_f1_constraints as subject
captured = []
subject.run_ngspice = lambda netlist: captured.append(netlist) or {}
subject.vector = lambda *_args: [1.5]
params = subject.model_parameters(1.0, 0.1, {"CGS": 1e-9, "CGDMAX": 1e-10, "CGDMIN": 1e-10, "CJO": 1e-10})
subject.probe(params, [{"id": "threshold", "kind": "threshold_interval", "minimum_v": 1, "maximum_v": 2, "current_a": 250e-6, "temperature_c": 75}], "n")
print(json.dumps(captured))
`;
  const result = spawnSync(venvPython, ["-c", program], { cwd: pythonDir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const [netlist] = JSON.parse(result.stdout);
  assert.equal(netlist.match(/^\.temp 75$/gm)?.length, 1, netlist);
  assert.equal(netlist.match(/^\.temp 25$/gm)?.length ?? 0, 0, netlist);
});

test("native constraint runner fails an empty feasible threshold set instead of relaxing it", { skip: skipNative, timeout: 300_000 }, () => {
  const fixed = { CGS: 1e-9, CGDMAX: 1e-10, CGDMIN: 1e-10, CJO: 1e-10 };
  assert.throws(() => defaultMosfetConstraintRunner({
    polarity: "n",
    constraints: [{
      id: "impossible_threshold", kind: "threshold_interval", minimum_v: 1e-5, maximum_v: 2e-5,
      current_a: 100, temperature_c: 25, inclusive: true, citations: ["fixture"],
    }],
    seed: { vto: 1.5e-5, rdson: 1 },
    adjustable: { vto: true, rdson: true },
    fixed,
  }), /infeasible|outside model response/i);
});
