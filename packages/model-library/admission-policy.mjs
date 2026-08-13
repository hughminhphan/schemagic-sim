import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const defaultAdmissionPolicyPath = resolve(here, "admission-policy.json");

const FROZEN_LEGACY_PACKAGE_COUNT = 710;
const FROZEN_LEGACY_INVENTORY_SHA256 =
  "a587d60b946e42f1285f293fba7c5eedbfc5229415e09813de7e85d7fda4c87e";

function canonicalPackageIds(packageIds) {
  return [...packageIds].sort().join("\n") + "\n";
}

export function packageInventoryHash(packageIds) {
  return createHash("sha256")
    .update(canonicalPackageIds(packageIds))
    .digest("hex");
}

function assertPackageId(packageId, label) {
  if (
    typeof packageId !== "string"
    || packageId.length === 0
    || packageId.startsWith("/")
    || packageId.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(packageId)
    || packageId.split("/").length !== 2
    || packageId.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} contains invalid package identity ${JSON.stringify(packageId)}`);
  }
}

export function validateAdmissionPolicy(policy) {
  if (policy?.schema_version !== "1.0.0") {
    throw new Error("model-library admission policy schema_version must be 1.0.0");
  }

  const legacy = policy?.legacy_inventory;
  const legacyPackages = legacy?.packages;
  const strictPackages = policy?.strict_evidence_contract_packages;
  if (!Array.isArray(legacyPackages)) {
    throw new Error("model-library admission policy legacy_inventory.packages must be an array");
  }
  if (!Array.isArray(strictPackages)) {
    throw new Error("model-library admission policy strict_evidence_contract_packages must be an array");
  }

  for (const packageId of legacyPackages) assertPackageId(packageId, "legacy_inventory.packages");
  for (const packageId of strictPackages) assertPackageId(packageId, "strict_evidence_contract_packages");

  const legacySet = new Set(legacyPackages);
  const strictSet = new Set(strictPackages);
  if (legacySet.size !== legacyPackages.length) {
    throw new Error("model-library admission policy contains duplicate legacy package identities");
  }
  if (strictSet.size !== strictPackages.length) {
    throw new Error("model-library admission policy contains duplicate strict package identities");
  }
  for (const packageId of strictSet) {
    if (legacySet.has(packageId)) {
      throw new Error(`model-library package ${packageId} cannot be both legacy and strict`);
    }
  }

  if (legacy?.package_count !== legacyPackages.length) {
    throw new Error("model-library legacy_inventory.package_count disagrees with its package list");
  }
  const actualHash = packageInventoryHash(legacyPackages);
  if (legacy?.sha256 !== actualHash) {
    throw new Error("model-library legacy_inventory.sha256 disagrees with its package list");
  }
  return { legacySet, strictSet };
}

export function loadAdmissionPolicy(filePath = defaultAdmissionPolicyPath) {
  const policy = JSON.parse(readFileSync(filePath, "utf8"));
  validateAdmissionPolicy(policy);
  if (
    policy.legacy_inventory.package_count !== FROZEN_LEGACY_PACKAGE_COUNT
    || policy.legacy_inventory.sha256 !== FROZEN_LEGACY_INVENTORY_SHA256
  ) {
    throw new Error(
      "model-library legacy inventory is immutable; new packages must be registered as strict evidence-contract packages"
    );
  }
  return policy;
}

export function packageIdFromDirectory(modelsRoot, packageDir) {
  const packageId = relative(resolve(modelsRoot), resolve(packageDir)).split(sep).join("/");
  assertPackageId(packageId, "model-library package path");
  return packageId;
}

export function admissionModeForPackageId(policy, packageId) {
  const { legacySet, strictSet } = validateAdmissionPolicy(policy);
  if (strictSet.has(packageId)) return "evidence-contract-1.0.0";
  if (legacySet.has(packageId)) return "legacy";
  throw new Error(
    `model-library package ${packageId} is not registered in admission-policy.json; `
    + "new reviewed packages must be registered as strict evidence-contract packages"
  );
}

export function validatorArgsForPackage(policy, packageId, validator, packageDir) {
  const mode = admissionModeForPackageId(policy, packageId);
  return [
    validator,
    ...(mode === "evidence-contract-1.0.0" ? ["--require-evidence-contract"] : []),
    packageDir
  ];
}
