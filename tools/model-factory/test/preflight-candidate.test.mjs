import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runCandidatePreflight } from "../preflight-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../../conveyor/test/fixtures/mosfet-critical.json");

test("standalone candidate preflight uses the real datasheet path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-preflight-"));
  try {
    const datasheet = path.join(root, "datasheet.pdf");
    const part = path.join(root, "part.json");
    fs.writeFileSync(datasheet, "%PDF-1.4\nfixture\n");
    fs.writeFileSync(part, JSON.stringify({
      mpn: "M1",
      manufacturer: "Fixture",
      conveyor_family: "mosfet",
      seed_hints: [],
    }));
    const result = runCandidatePreflight({
      partPath: part,
      extractionPath: fixture,
      datasheetPath: datasheet,
    });
    assert.deepEqual(result, {
      schema_version: "1.0.0",
      status: "accepted",
      family: "mosfet",
      route: "curve-fitted",
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("standalone candidate preflight fails closed on insufficient evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-preflight-reject-"));
  try {
    const datasheet = path.join(root, "datasheet.pdf");
    const part = path.join(root, "part.json");
    const extraction = path.join(root, "extraction.json");
    fs.writeFileSync(datasheet, "%PDF-1.4\nfixture\n");
    fs.writeFileSync(part, JSON.stringify({
      mpn: "M1",
      manufacturer: "Fixture",
      conveyor_family: "mosfet",
      seed_hints: [],
    }));
    const payload = JSON.parse(fs.readFileSync(fixture, "utf8"));
    payload.usable_curves = false;
    payload.curves = [];
    payload.specs.threshold_min = null;
    payload.specs.threshold_typ = null;
    payload.specs.threshold_max = null;
    fs.writeFileSync(extraction, JSON.stringify(payload));
    assert.throws(
      () => runCandidatePreflight({ partPath: part, extractionPath: extraction, datasheetPath: datasheet }),
      /threshold calibration/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
