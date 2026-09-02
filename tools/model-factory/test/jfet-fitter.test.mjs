import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PARTS } from "../lib/parts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const factoryRoot = path.resolve(here, "..");
const python = path.join(factoryRoot, ".venv", "bin", "python");
const fitter = path.join(factoryRoot, "python", "fit_jfet.py");
const bf256bFacts = path.join(here, "fixtures", "BF256B-facts.json");

function runFitter(factsPath) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jfet-fit-test-"));
  const output = path.join(root, "fitted.json");
  const result = spawnSync(python, [fitter, factsPath, output], { encoding: "utf8", timeout: 600_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const fitted = JSON.parse(fs.readFileSync(output, "utf8"));
  fs.rmSync(root, { recursive: true, force: true });
  return fitted;
}

function runFitterFacts(facts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jfet-facts-test-"));
  try {
    const factsPath = path.join(root, "facts.json");
    fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2));
    return runFitter(factsPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("BF256B registry evidence reaches the NJF fitter and is honestly demoted", () => {
  const fixtureFacts = JSON.parse(fs.readFileSync(bf256bFacts, "utf8"));
  assert.ok(PARTS.BF256B.facts.electrical, "registry path must carry the electrical block consumed by fit_jfet.py");
  for (const name of ["idss_min", "idss_max", "vgsoff_near", "vgsoff_far", "igss_max", "ciss", "crss"]) {
    assert.equal(PARTS.BF256B.facts.electrical[name].value, fixtureFacts.electrical[name].value);
  }
  const fitted = runFitterFacts(PARTS.BF256B.facts);
  assert.equal(fitted.fidelity_tier, "F1");
  assert.deepEqual(fitted.evidence_support, {
    transfer_characteristic: false,
    output_characteristics: false,
    gfs: false,
  });
  assert.match(fitted.known_omissions.join("\n"), /no transfer-characteristic curve is admitted/);
  assert.match(fitted.known_omissions.join("\n"), /no output-characteristics curve is admitted/);
  assert.match(fitted.known_omissions.join("\n"), /gfs row/);
  assert.ok(fitted.parameters.VTO < 0);
  assert.ok(fitted.parameters.BETA > 0);
  assert.ok(fitted.parameters.LAMBDA >= 0);
  assert.equal(fitted.parameters.IS, 1e-9);
  assert.match(fitted.parameter_metadata.IS.status, /IGSS/);
  assert.deepEqual(new Set(fitted.held_defaults.map((entry) => entry.parameter)),
    new Set(["LAMBDA", "B", "PB", "M", "N", "FC", "RD", "RS"]));
  assert.ok(fitted.native_verification.idss_a >= 0.006 && fitted.native_verification.idss_a <= 0.015);
  assert.ok(fitted.native_verification.cutoff_current_at_far_vgsoff_a <= 10e-6);
  assert.ok(Math.abs(fitted.native_verification.ciss_f - 4e-12) / 4e-12 < 0.20);
  assert.ok(Math.abs(fitted.native_verification.crss_f - 1.5e-12) / 1.5e-12 < 0.20);
});

test("curve-backed NJF evidence fits transfer and output characteristics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jfet-curve-fixture-"));
  const factsPath = path.join(root, "facts.json");
  const quantity = (value, unit, conditions, page_reference) => ({ value, unit, conditions, page_reference, source_kind: "digitized_typical_curve" });
  const transfer = [
    [-1.8, 4.800013266503811e-5], [-1.5, 3.0000010156072676e-4],
    [-1.2, 7.679999689571559e-4], [-0.8, 1.7279996100114658e-3], [0, 4.7999977541621774e-3],
  ].map(([vgs, current]) => ({
    vgs: quantity(vgs, "V", "VDS=10 V, TA=25 C", "fixture transfer curve"),
    vds: quantity(10, "V", `VGS=${vgs} V, TA=25 C`, "fixture transfer curve"),
    current: quantity(current, "A", `VGS=${vgs} V, VDS=10 V, TA=25 C`, "fixture transfer curve"),
  }));
  const output = [
    [3, 4.2399982376082335e-3], [5, 4.399998098961078e-3],
    [8, 4.6399978891713545e-3], [12, 4.95999759004917e-3],
  ].map(([vds, current]) => ({
    vgs: quantity(0, "V", `VDS=${vds} V, TA=25 C`, "fixture output curve"),
    vds: quantity(vds, "V", "VGS=0 V, TA=25 C", "fixture output curve"),
    current: quantity(current, "A", `VGS=0 V, VDS=${vds} V, TA=25 C`, "fixture output curve"),
  }));
  fs.writeFileSync(factsPath, JSON.stringify({
    schema_version: "1.0.0",
    electrical: {
      idss_min: quantity(0.0047, "A", "VDS=10 V VGS=0", "fixture table"),
      idss_max: quantity(0.0049, "A", "VDS=10 V VGS=0", "fixture table"),
      vgsoff_near: quantity(-1.5, "V", "VDS=10 V ID=10 uA", "fixture table"),
      vgsoff_far: quantity(-2.5, "V", "VDS=10 V ID=10 uA", "fixture table"),
      gfs: quantity(0.0048, "S", "VDS=10 V VGS=0", "fixture table"),
      igss_max: quantity(1e-10, "A", "VGS=-20 V VDS=0", "fixture table"),
    },
    transfer_points: transfer,
    output_points: output,
  }, null, 2));
  const fitted = runFitter(factsPath);
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(fitted.fidelity_tier, "F2");
  assert.equal(fitted.evidence_support.transfer_characteristic, true);
  assert.equal(fitted.evidence_support.output_characteristics, true);
  assert.equal(fitted.evidence_support.gfs, true);
  assert.ok(fitted.optimizer.nfev > 0);
  assert.ok(fitted.worst_relative_error.value < 0.20);
  assert.ok(fitted.parameters.LAMBDA >= 0 && fitted.parameters.LAMBDA <= 0.1);
  assert.equal(fitted.parameter_metadata.LAMBDA.status, "fitted from output curves");
  assert.equal(fitted.parameters.IS, 1e-10);
  assert.match(fitted.parameter_metadata.IS.status, /IGSS/);
});

test("unstated JFET bench conditions are declared as held assumptions and omissions", () => {
  const facts = JSON.parse(fs.readFileSync(bf256bFacts, "utf8"));
  facts.electrical.idss_min.conditions = "VGS=0";
  facts.electrical.idss_max.conditions = "VGS=0";
  facts.electrical.vgsoff_near.conditions = "cutoff limit";
  facts.electrical.vgsoff_far.conditions = "cutoff limit";
  delete facts.electrical.vgsoff_test_current;
  const fitted = runFitterFacts(facts);
  const held = new Map(fitted.held_defaults.map((entry) => [entry.parameter, entry]));
  assert.equal(held.get("IDSS_VDS").value, 15);
  assert.equal(held.get("VGS_OFF_TEST_CURRENT").value, 1e-5);
  assert.match(fitted.known_omissions.join("\n"), /no admitted IDSS or VGS\(off\) condition states VDS/);
  assert.match(fitted.known_omissions.join("\n"), /no admitted VGS\(off\) condition states cutoff current/);
});
