import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { fitBulkPart, stageBulkPart } from "../lib/bulk-adapter.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "fixtures", "2N7000-small-signal.json");
const outputOmission = /output-characteristic family is deliberately omitted/;

function fixture(root) {
  const datasheetPath = path.join(root, "2n7000.pdf");
  fs.writeFileSync(datasheetPath, "%PDF-1.7\n2N7000 local evidence fixture\n");
  const extraction = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  extraction.source_sha256 = createHash("sha256").update(fs.readFileSync(datasheetPath)).digest("hex");
  const part = {
    mpn: "2N7000", manufacturer: "onsemi", conveyor_family: "mosfet",
    datasheet_path: datasheetPath, datasheet_url: "https://www.onsemi.com/pdf/datasheet/2n7000-d.pdf",
    category: "MOSFETs", subcategory: "N-Channel MOSFET", package: "TO-92",
    description: "Small-signal N-channel MOSFET", seed_hints: [], allow_f1_demotion: true,
  };
  return { part, extraction };
}

test("2N7000 stages as F2-DC with the output-family omission in its model card", { timeout: 600_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "2n7000-f2dc-test-"));
  try {
    const { part, extraction } = fixture(root);
    const fit = fitBulkPart(part, extraction);
    assert.equal(fit.fidelity, "F2");
    assert.equal(fit.policy_tier, "F2-DC");
    assert.equal(fit.output_family_omitted, true);
    assert.ok(fit.worst <= 0.20);
    assert.ok(fit.rms <= 0.12);
    const rdsonResidual = fit.residuals.find((entry) => entry.gate_quantity === "rds_on");
    assert.ok(rdsonResidual.relative_error < 0.09, `RDS(on) residual needs CI margin, got ${rdsonResidual.relative_error}`);
    assert.ok(fit.optimizer.optimizer_status > 0);
    assert.ok(fit.optimizer.optimizer_nfev < 100);
    assert.equal(fit.parameters.THETA, 0);
    assert.equal(fit.parameters.LAMBDA, 0.003);
    assert.equal(fit.parameters.RD, 1e-6);
    for (const name of ["THETA", "LAMBDA", "RD"]) {
      assert.match(fit.optimizer.held_defaults.find((entry) => entry.parameter === name).reason, /F2-DC/);
    }
    const repeatedFit = fitBulkPart(part, extraction);
    assert.deepEqual(repeatedFit.parameters, fit.parameters, "the fixed F2-DC seed must converge deterministically");
    assert.equal(
      repeatedFit.residuals.find((entry) => entry.gate_quantity === "rds_on").relative_error,
      rdsonResidual.relative_error,
    );

    const contradictoryAttempt = {
      ...fit,
      policy_tier: "F2",
      output_family_omitted: false,
      worst: { value: fit.worst, quantity: fit.worst_quantity },
    };
    assert.throws(
      () => fitBulkPart(part, extraction, { fitRunner: () => contradictoryAttempt }),
      /fitter policy mismatch: fitter policy_tier=F2, output_family_omitted=false; extraction-derived policy_tier=F2-DC, output_family_omitted=true/,
    );

    const packagePath = stageBulkPart(part, extraction, fit, path.join(root, "staging"));
    const component = JSON.parse(fs.readFileSync(path.join(packagePath, "component.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(packagePath, "fitted.json"), "utf8"));
    const card = fs.readFileSync(path.join(packagePath, "MODEL_CARD.md"), "utf8");

    // The frozen component schema retains its F2 enum. The existing model-card and
    // known-omissions surfaces carry the narrower public policy label.
    assert.equal(component.fidelity_tier, "F2");
    assert.equal(fitted.fidelity_tier, "F2");
    assert.match(component.known_omissions.join("\n"), outputOmission);
    assert.match(card, /Fidelity tier: F2-DC, datasheet-constrained/);
    assert.match(card, outputOmission);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
