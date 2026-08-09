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
const ngspice = "/opt/homebrew/bin/ngspice";

const toolingPresent = fs.existsSync(venvPython) && fs.existsSync(ngspice);
const skip = toolingPresent ? false : "requires tools/model-factory/.venv and native ngspice";

// Cited facts for the Vishay NTCLE100E3103JB0, matching the reviewed package's facts.json.
// R25 = 10 kohm, B25/85 = 3977 K, both explicitly "transcribed without adjustment".
const CITED_R25 = 10000;
const CITED_BETA = 3977;

function ntcFacts() {
  const cited = (value, unit, conditions) => ({
    value, unit, conditions,
    page_reference: "p. 2 electrical data and ordering information",
    source_kind: "typical",
  });
  const tablePoint = (temperature, resistance) => ({
    environment: { value: temperature, unit: "degC", conditions: "zero-power table row", page_reference: "p. 10 resistance column", source_kind: "typical_table" },
    electrical: { value: resistance, unit: "ohm", conditions: `zero-power resistance at ${temperature} degC`, page_reference: "p. 10 resistance column", source_kind: "typical_table" },
  });
  return {
    sensor_variant: "beta_ntc",
    parameters: {
      nominal_resistance: cited(CITED_R25, "ohm", "R25 at 25 degC, transcribed without adjustment"),
      reference_temperature: cited(25, "degC", "R25 reference temperature, transcribed without adjustment"),
      beta: cited(CITED_BETA, "K", "B25/85, transcribed without adjustment"),
      resistance_tolerance: { ...cited(5, "%", "ordering-code J tolerance on R25"), source_kind: "maximum" },
      beta_tolerance: { ...cited(0.75, "%", "B25/85 tolerance"), source_kind: "maximum" },
    },
    // The zero-power resistance table does NOT sit exactly on the B-parameter curve.
    // That mismatch is what previously pulled the optimizer onto its bounds.
    transfer_points: [tablePoint(25, 10000), tablePoint(55, 2989), tablePoint(85, 1070)],
  };
}

function runFitSensor(facts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fit-sensor-test-"));
  try {
    const factsPath = path.join(root, "facts.json");
    const outPath = path.join(root, "fitted.json");
    fs.writeFileSync(factsPath, JSON.stringify(facts));
    const result = spawnSync(venvPython, [path.join(pythonDir, "fit_sensor.py"), factsPath, outPath], {
      cwd: pythonDir, encoding: "utf8", timeout: 120_000,
    });
    assert.equal(result.status, 0, `fit_sensor.py failed: ${result.stdout}\n${result.stderr}`);
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("beta_ntc transcribes cited R25 and B25/85 exactly rather than fitting them", { skip }, () => {
  const fitted = runFitSensor(ntcFacts());

  // The whole point: the emitted constants are the cited ones, bit for bit.
  assert.equal(fitted.parameters.R0, CITED_R25);
  assert.equal(fitted.parameters.BETA, CITED_BETA);
  assert.equal(fitted.parameters.T0_C, 25);

  // No optimizer ran, so there is nothing that could saturate a tolerance bound.
  assert.equal(fitted.optimizer, null);
  assert.match(fitted.fitter, /transcription/i);
  assert.doesNotMatch(fitted.fitter, /least_squares/i);
  for (const name of ["R0", "BETA", "T0_C"]) {
    assert.match(fitted.parameter_metadata[name].status, /transcription/i, `${name} must be declared as transcribed`);
  }
});

test("beta_ntc never reproduces the P5-rejected bound-saturated values", { skip }, () => {
  const facts = ntcFacts();
  const fitted = runFitSensor(facts);

  // P5 rejected R0 = 9500 and BETA = 3947.1725. Those are not arbitrary bad numbers:
  // they are exactly the lower optimizer bounds that the removed least_squares call used.
  const rejectedR0 = 0.95 * CITED_R25;          // 9500
  const rejectedBeta = 0.9925 * CITED_BETA;     // 3947.1725
  assert.equal(rejectedR0, 9500);
  assert.equal(rejectedBeta, 3947.1725);
  assert.notEqual(fitted.parameters.R0, rejectedR0);
  assert.notEqual(fitted.parameters.BETA, rejectedBeta);

  // And nothing anywhere inside the published tolerance band, in either direction.
  assert.ok(fitted.parameters.R0 === CITED_R25, "R0 drifted off the cited R25");
  assert.ok(fitted.parameters.BETA === CITED_BETA, "BETA drifted off the cited B25/85");
});

test("beta_ntc reports the transcription residual honestly instead of optimising it away", { skip }, () => {
  const fitted = runFitSensor(ntcFacts());

  // The B-parameter curve through the cited constants misses the 55 degC table row by
  // ~1.2%. That residual must be reported, not absorbed by moving the constants.
  const at55 = fitted.residuals.find((row) => row.quantity.includes("55"));
  assert.ok(at55, "missing 55 degC residual row");
  assert.ok(at55.relative_error > 0.005 && at55.relative_error < 0.02,
    `expected ~1.2% residual at 55 degC, got ${at55.relative_error}`);
  assert.equal(fitted.worst_relative_error.quantity, "resistance at 55 degC");

  // Endpoints of the cited B25/85 interval must land essentially on the table.
  const at25 = fitted.residuals.find((row) => row.quantity.includes("25 degC"));
  const at85 = fitted.residuals.find((row) => row.quantity.includes("85 degC"));
  assert.ok(at25.relative_error < 1e-9, "25 degC is the reference point and must be exact");
  assert.ok(at85.relative_error < 0.01, "85 degC is a cited B-interval endpoint");
});

test("fit_sensor.py carries no optimizer over the NTC constants", () => {
  const source = fs.readFileSync(path.join(pythonDir, "fit_sensor.py"), "utf8");
  const branch = source.slice(source.indexOf('elif variant == "beta_ntc"'), source.indexOf('elif variant == "power_ldr"'));
  assert.ok(branch.length > 0, "beta_ntc branch not found");
  // Assert on executable code only; the branch's comments deliberately name what was removed.
  const code = branch.split("\n").filter((line) => !line.trim().startsWith("#")).join("\n");
  assert.doesNotMatch(code, /least_squares/, "beta_ntc must not call least_squares");
  assert.doesNotMatch(code, /bounds\s*=/, "beta_ntc must not define optimizer bounds");
  assert.doesNotMatch(source, /def residual_ntc/, "residual_ntc must stay removed so the optimizer cannot be re-wired");
});
