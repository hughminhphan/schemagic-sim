import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  admissionModeForPackageId,
  loadAdmissionPolicy,
  packageInventoryHash,
  validateAdmissionPolicy,
  validatorArgsForPackage
} from "../admission-policy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const validator = path.join(repoRoot, "packages/component-schema/validate-package.mjs");

function policyFixture() {
  const legacyPackages = ["legacy/V1"];
  return {
    schema_version: "1.0.0",
    legacy_inventory: {
      frozen_at_commit: "fixture",
      package_count: legacyPackages.length,
      sha256: packageInventoryHash(legacyPackages),
      packages: legacyPackages
    },
    strict_evidence_contract_packages: ["strict/M1"]
  };
}

test("tracked admission policy preserves the frozen 710-package legacy inventory", () => {
  const policy = loadAdmissionPolicy();
  assert.equal(policy.legacy_inventory.package_count, 710);
  assert.equal(
    policy.legacy_inventory.sha256,
    "a587d60b946e42f1285f293fba7c5eedbfc5229415e09813de7e85d7fda4c87e"
  );
  assert.deepEqual(policy.strict_evidence_contract_packages, [
    "born/DSS26",
    "born/F1M",
    "born/SS56SMC",
    "diodes/B130-13-F",
    "diodes/B230A-13-F",
    "diodes/B540C-13-F",
    "diodes/DFLS1150Q-7",
    "fosan/DSK26W",
    "fuxinsemi/DFLS2100",
    "goodwork/S5M",
    "goodwork/SS34F",
    "guangdong-hottech/SS24L",
    "hongjiacheng/SSL510B",
    "hxy-mosfet/ZMM3V6",
    "hxy-mosfet/ZMM4V3",
    "lge/BZV55C12",
    "mcc-micro-commercial-components/1N4148WX-TP",
    "mdd-microdiode/10A10",
    "mdd-microdiode/6A10",
    "mdd-microdiode/DL4007",
    "mdd-microdiode/ES1DF",
    "mdd-microdiode/MUR460",
    "mdd-microdiode/SS54C",
    "msksemi/MS2A40LWS",
    "msksemi/SK34",
    "nexperia/BAS21GWX",
    "nexperia/BAT46WJ-115",
    "nexperia/BZX384-B12-115",
    "nexperia/BZX384-B24-115",
    "nexperia/BZX585-B15-115",
    "nexperia/BZX84-C2V7-215",
    "nexperia/BZX84-C33-215",
    "nexperia/BZX84J-B10-115",
    "nexperia/BZX84J-C30-115",
    "nexperia/PMEG10030ELPX",
    "nexperia/PMEG4010CEH-115",
    "onsemi/BAS21HT1G",
    "rohm-semicon/RB161QS-40T18R",
    "rohm-semicon/RB168MM-40TR",
    "rohm-semicon/RFU02VSM6STR",
    "shanghai-prisemi-elec/PSBD2FD30V01",
    "shikues/MBR130",
    "shikues/MSK4005",
    "slkor-slkormicro-elec/ZMM3V3",
    "slkor-slkormicro-elec/ZMM5V6",
    "smc-sangdest-microelectronicstronic-nanjing/1N4007FL",
    "st-semtech/MM1Z3B3",
    "stmicroelectronics/STTH112A",
    "tech-public/RB520S-30",
    "tech-public/TPMEG4020EPK",
    "tech-public/TPNSR05F40NXT5G",
    "tokmas/MBR230LSFT1G",
    "vishay-intertech/1N4148W-E3-08",
    "vishay-intertech/BYV26EGP-E3-73",
    "vishay-intertech/MSS1P6-M3-89A",
    "vishay-intertech/S1G-E3-61T",
    "vishay-intertech/SS16-E3-61T",
    "vishay-intertech/SS5P10-M3-86A",
    "yangzhou-yangjie-elec-tech/G1M",
    "yongyutai/CD4148WSP",
    "yongyutai/ZMM16V"
  ]);
});

test("admission policy selects strict validation outside candidate package contents", () => {
  const policy = policyFixture();
  assert.equal(admissionModeForPackageId(policy, "legacy/V1"), "legacy");
  assert.equal(admissionModeForPackageId(policy, "strict/M1"), "evidence-contract-1.0.0");
  assert.deepEqual(
    validatorArgsForPackage(policy, "strict/M1", "/validator.mjs", "/models/strict/M1"),
    ["/validator.mjs", "--require-evidence-contract", "/models/strict/M1"]
  );
  assert.deepEqual(
    validatorArgsForPackage(policy, "legacy/V1", "/validator.mjs", "/models/legacy/V1"),
    ["/validator.mjs", "/models/legacy/V1"]
  );
});

test("unregistered packages cannot enter the reviewed library", () => {
  assert.throws(
    () => admissionModeForPackageId(policyFixture(), "new/M1"),
    /not registered.*new reviewed packages must be registered as strict/s
  );
});

test("registered strict package fails contract validation even when legacy validation passes", () => {
  const source = path.join(repoRoot, "packages/model-library/models/infineon/IRLZ44N");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "model-library-strict-admission-"));
  try {
    fs.cpSync(source, root, { recursive: true });
    const legacyResult = spawnSync(process.execPath, [validator, root], {
      encoding: "utf8",
      timeout: 30_000
    });
    assert.equal(legacyResult.status, 0, `${legacyResult.stdout}${legacyResult.stderr}`);

    const args = validatorArgsForPackage(
      policyFixture(),
      "strict/M1",
      validator,
      root
    );
    const strictResult = spawnSync(process.execPath, args, {
      encoding: "utf8",
      timeout: 30_000
    });
    assert.notEqual(strictResult.status, 0);
    assert.match(`${strictResult.stdout}${strictResult.stderr}`, /component evidence_contract_version must be 1\.0\.0/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("admission policy rejects overlap, duplicate identities, and stale legacy hashes", () => {
  const overlap = policyFixture();
  overlap.strict_evidence_contract_packages = ["legacy/V1"];
  assert.throws(() => validateAdmissionPolicy(overlap), /cannot be both legacy and strict/);

  const duplicate = policyFixture();
  duplicate.strict_evidence_contract_packages = ["strict/M1", "strict/M1"];
  assert.throws(() => validateAdmissionPolicy(duplicate), /duplicate strict package identities/);

  const stale = policyFixture();
  stale.legacy_inventory.sha256 = "0".repeat(64);
  assert.throws(() => validateAdmissionPolicy(stale), /sha256 disagrees/);

});

test("tracked policy cannot reclassify a new package as legacy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "model-library-forged-legacy-policy-"));
  try {
    const forgedLegacy = loadAdmissionPolicy();
    forgedLegacy.legacy_inventory.packages.push("new/M1");
    forgedLegacy.legacy_inventory.package_count++;
    forgedLegacy.legacy_inventory.sha256 = packageInventoryHash(
      forgedLegacy.legacy_inventory.packages
    );
    const policyPath = path.join(root, "admission-policy.json");
    fs.writeFileSync(policyPath, JSON.stringify(forgedLegacy));
    assert.throws(() => loadAdmissionPolicy(policyPath), /legacy inventory is immutable/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
