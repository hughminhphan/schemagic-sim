import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateComponentFiles, validatePackage } from "../lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

test("promoted validator accepts the historical complete examples", () => {
  const diode = path.join(repoRoot, "spikes/component-schema/models-example/generic-example/vishay/1N4148/component.json");
  const bjt = path.join(repoRoot, "spikes/component-schema/models-example/onsemi/2N3904/component.json");
  assert.deepEqual(validateComponentFiles(diode).errors, []);
  assert.deepEqual(validateComponentFiles(bjt).errors, []);
});

test("promoted validator rejects the historical broken fixture", () => {
  const broken = path.join(repoRoot, "spikes/component-schema/fixtures/broken-component.json");
  assert.ok(validateComponentFiles(broken).errors.length > 0);
});

test("validate-package accepts all generated F2 gold packages", () => {
  for (const relative of ["vishay/1N4148", "kingbright/WP7113ID", "onsemi/2N3904", "infineon/IRLZ44N", "ti/TL072"]) {
    const directory = path.join(repoRoot, "packages/model-library/models", relative);
    assert.deepEqual(validatePackage(directory).errors, []);
  }
});

test("validate-package reports a missing directory contract", () => {
  const missing = path.join(repoRoot, "packages/model-library/models/not-a-real-package");
  assert.ok(validatePackage(missing).errors.some((error) => error.includes("missing required package file")));
});

test("versioned package chain requires facts and fitted while legacy packages stay compatible", () => {
  const source = path.join(repoRoot, "packages/model-library/models/infineon/IRLZ44N");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-contract-chain-"));
  try {
    fs.cpSync(source, root, { recursive: true });
    const expectationsPath = path.join(root, "tests", "expectations.json");
    const expectations = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));
    expectations.evidence_contract_version = "1.0.0";
    expectations.evidence_cohorts = [{ cohort_id: `sha256:${"a".repeat(64)}`, fidelity_tier: "F2", evidence_ids: [`sha256:${"b".repeat(64)}`] }];
    fs.writeFileSync(expectationsPath, JSON.stringify(expectations));
    fs.rmSync(path.join(root, "facts.json"));
    fs.rmSync(path.join(root, "fitted.json"));
    const errors = validatePackage(root).errors;
    assert.ok(errors.some((error) => error.includes("facts.json")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("fitted.json")), errors.join("\n"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
