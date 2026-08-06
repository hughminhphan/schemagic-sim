import assert from "node:assert/strict";
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

test("validate-package accepts both generated F2 gold packages", () => {
  for (const relative of ["vishay/1N4148", "kingbright/WP7113ID"]) {
    const directory = path.join(repoRoot, "packages/model-library/models", relative);
    assert.deepEqual(validatePackage(directory).errors, []);
  }
});

test("validate-package reports a missing directory contract", () => {
  const missing = path.join(repoRoot, "packages/model-library/models/not-a-real-package");
  assert.ok(validatePackage(missing).errors.some((error) => error.includes("missing required package file")));
});
