import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(here, "..");
const modelsRoot = join(libraryRoot, "models");
const validator = resolve(libraryRoot, "../component-schema/validate-package.mjs");

const packages = readdirSync(modelsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((manufacturer) => readdirSync(join(modelsRoot, manufacturer.name), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(modelsRoot, manufacturer.name, entry.name)))
  .sort();

test(`component-schema validates all ${packages.length} model packages`, () => {
  const failures = [];
  for (const packageDir of packages) {
    const result = spawnSync(process.execPath, [validator, packageDir], { encoding: "utf8", timeout: 30_000 });
    if (result.status !== 0) failures.push(`${packageDir}:\n${result.stdout}${result.stderr}`);
  }
  assert.deepEqual(failures, []);
});
