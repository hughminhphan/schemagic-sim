import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  loadAdmissionPolicy,
  packageIdFromDirectory,
  validateAdmissionPolicy,
  validatorArgsForPackage
} from "../admission-policy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(here, "..");
const modelsRoot = join(libraryRoot, "models");
const validator = resolve(libraryRoot, "../component-schema/validate-package.mjs");
const admissionPolicy = loadAdmissionPolicy();

const manufacturerEntries = readdirSync(modelsRoot, { withFileTypes: true });
assert.deepEqual(
  manufacturerEntries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name),
  [],
  "model-library manufacturers must be real directories, not files or symlinks"
);
const packages = manufacturerEntries
  .flatMap((manufacturer) => {
    const entries = readdirSync(join(modelsRoot, manufacturer.name), { withFileTypes: true });
    assert.deepEqual(
      entries.filter((entry) => !entry.isDirectory()).map((entry) => `${manufacturer.name}/${entry.name}`),
      [],
      "model-library packages must be real directories, not files or symlinks"
    );
    return entries.map((entry) => join(modelsRoot, manufacturer.name, entry.name));
  })
  .sort();

const packageIds = packages.map((packageDir) => packageIdFromDirectory(modelsRoot, packageDir));
const { legacySet, strictSet } = validateAdmissionPolicy(admissionPolicy);
assert.deepEqual(
  packageIds,
  [...legacySet, ...strictSet].sort(),
  "model-library inventory must exactly equal the registered legacy and strict package identities"
);

test(`component-schema validates all ${packages.length} model packages`, () => {
  const failures = [];
  for (const [index, packageDir] of packages.entries()) {
    const packageId = packageIds[index];
    let args;
    try {
      args = validatorArgsForPackage(
        admissionPolicy,
        packageId,
        validator,
        packageDir
      );
    } catch (error) {
      failures.push(`${packageDir}:\n${error.message}`);
      continue;
    }
    const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 30_000 });
    if (result.status !== 0) failures.push(`${packageDir}:\n${result.stdout}${result.stderr}`);
  }
  assert.deepEqual(failures, []);
});
