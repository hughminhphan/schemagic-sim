import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  loadAdmissionPolicy,
  packageIdFromDirectory,
  validateAdmissionPolicy,
  validatorArgsForPackage
} from "./admission-policy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const modelsRoot = join(here, "models");
const validator = resolve(here, "../component-schema/validate-package.mjs");
const policy = loadAdmissionPolicy();
const { legacySet, strictSet } = validateAdmissionPolicy(policy);
const failures = [];

const manufacturerEntries = readdirSync(modelsRoot, { withFileTypes: true });
for (const entry of manufacturerEntries) {
  if (!entry.isDirectory()) failures.push(`models/${entry.name} must be a real directory, not a file or symlink`);
}

const packages = manufacturerEntries
  .filter((entry) => entry.isDirectory())
  .flatMap((manufacturer) => {
    const entries = readdirSync(join(modelsRoot, manufacturer.name), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) failures.push(`${manufacturer.name}/${entry.name} must be a real directory, not a file or symlink`);
    }
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(modelsRoot, manufacturer.name, entry.name));
  })
  .sort();
const packageIds = packages.map((packageDir) => packageIdFromDirectory(modelsRoot, packageDir));
const registeredIds = [...legacySet, ...strictSet].sort();
if (JSON.stringify(packageIds) !== JSON.stringify(registeredIds)) {
  failures.push("model-library inventory must exactly equal the registered legacy and strict package identities");
}

for (const [index, packageDir] of packages.entries()) {
  const packageId = packageIds[index];
  let args;
  try {
    args = validatorArgsForPackage(policy, packageId, validator, packageDir);
  } catch (error) {
    failures.push(`${packageId}: ${error.message}`);
    continue;
  }
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: 30_000
  });
  if (result.status !== 0) failures.push(`${packageId}:\n${result.stdout}${result.stderr}`);
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`PASS: validated ${packages.length} registered model packages`);
