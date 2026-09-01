import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  selectedSemiconductorRdsonProjectionExecutionIdentity,
  validateSelectedSemiconductorRdsonProjectionContract,
  validateSelectedSemiconductorRdsonProjectionReport,
} from "../selected-semiconductor-rdson-projection.mjs";

const CONTRACT_URL = new URL("../selected-semiconductor-rdson-projection/contract.json", import.meta.url);
const REPORT_URL = new URL("../selected-semiconductor-rdson-projection/execution-report.json", import.meta.url);

async function fixture() {
  const [contractText, reportText] = await Promise.all([
    readFile(CONTRACT_URL, "utf8"),
    readFile(REPORT_URL, "utf8"),
  ]);
  return {
    contract: JSON.parse(contractText),
    contractContentHash: `sha256:${createHash("sha256").update(contractText).digest("hex")}`,
    report: JSON.parse(reportText),
  };
}

test("strictly validates the persisted ideal reviewed-RDS(on) projection", async () => {
  const { contract, contractContentHash, report } = await fixture();
  assert.equal(
    validateSelectedSemiconductorRdsonProjectionReport(report, contract, contractContentHash),
    report,
  );
});

test("rejects projection identity, quantity, evidence, receipt, numerical, and claim drift", async () => {
  const { contract, contractContentHash, report } = await fixture();
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.contractContentHash = `sha256:${"0".repeat(64)}`; },
    (value) => { value.case.currentIdentity.requestHash = `sha256:${"1".repeat(64)}`; },
    (value) => { value.case.currentIdentity.candidateEligible = true; },
    (value) => { value.case.selectedBinding.quantityPerAssembly = 1; },
    (value) => { value.case.selectedBinding.profileContentHash = `sha256:${"2".repeat(64)}`; },
    (value) => { value.case.sourceBinding.contentHash = `sha256:${"3".repeat(64)}`; },
    (value) => { value.case.attestation = "independent"; },
    (value) => { value.case.receiptContentHash = "not-a-hash"; },
    (value) => { value.case.selectedVectors[0].maxRelativeError = 1; },
    (value) => { value.case.selectedVectors[0].browserWasmValue += 1e-9; },
    (value) => { value.case.native.voltageDropsV[0] = 0.07; },
    (value) => { value.case.browserWasm.apparentResistanceOhm[0] = 0.001; },
    (value) => { value.case.maximumCrossEngineVoltageDropRelativeDifference = 1; },
    (value) => { value.case.selectedPartDeviceEquationUsed = true; },
    (value) => { value.case.physicalFidelityProved = true; },
    (value) => { value.case.productionRequestConditionsEvaluated = true; },
    (value) => { value.case.productionConstraintEligibility = true; },
    (value) => { value.case.rankingAuthority = true; },
    (value) => { value.case.fullBomCoverage = true; },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(report);
    mutate(forged);
    assert.throws(() => validateSelectedSemiconductorRdsonProjectionReport(
      forged,
      contract,
      contractContentHash,
    ));
  }
});

test("strictly validates the reviewed profile and ideal-resistor contract on the persisted path", async () => {
  const { contract, report } = await fixture();
  const mutations = [
    (value) => { value.case.projectionContract.extraClaim = "forged"; },
    (value) => { value.case.projectionContract.instanceCount = 1; },
    (value) => { value.case.projectionContract.gateConditionVoltageV = 8; },
    (value) => { value.case.projectionContract.reviewedMaximumRdsOhm = 0.0018; },
    (value) => { value.case.netlistContentHash = `sha256:${"4".repeat(64)}`; },
    (value) => { value.evidenceBoundary.claim = "forged"; },
    (value) => { value.evidenceBoundary.selectedPartDeviceEquationUsed = true; },
    (value) => { value.evidenceBoundary.doesNotProve[0] = "forged"; },
  ];
  for (const mutate of mutations) {
    const forgedContract = structuredClone(contract);
    mutate(forgedContract);
    const forgedContractText = `${JSON.stringify(forgedContract, null, 2)}\n`;
    const forgedContractContentHash = `sha256:${createHash("sha256").update(forgedContractText).digest("hex")}`;
    const forgedReport = structuredClone(report);
    forgedReport.contractContentHash = forgedContractContentHash;
    forgedReport.evidenceBoundary = structuredClone(forgedContract.evidenceBoundary);
    assert.throws(() => validateSelectedSemiconductorRdsonProjectionContract(forgedContract));
    assert.throws(() => validateSelectedSemiconductorRdsonProjectionReport(
      forgedReport,
      forgedContract,
      forgedContractContentHash,
    ));
  }
});

test("binds every persisted browser-WASM voltage and receipt field compared with a fresh run", async () => {
  const { report } = await fixture();
  const mutations = [
    (value) => { value.case.browserWasm.sampleCount += 1; },
    (value) => { value.case.browserWasm.instanceCount -= 1; },
    (value) => { value.case.browserWasm.voltageDropsV[0] += 1e-12; },
    (value) => { value.case.browserWasm.apparentResistanceOhm[0] += 1e-12; },
    (value) => { value.case.browserWasm.maximumVoltageDropAbsoluteErrorV += 1e-12; },
    (value) => { value.case.browserWasm.maximumInstanceSpreadV += 1e-12; },
    (value) => { value.case.sampleContentHash = `sha256:${"5".repeat(64)}`; },
    (value) => { value.case.receiptContentHash = `sha256:${"6".repeat(64)}`; },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(report);
    mutate(forged);
    assert.notDeepEqual(
      selectedSemiconductorRdsonProjectionExecutionIdentity(forged),
      selectedSemiconductorRdsonProjectionExecutionIdentity(report),
    );
  }
});
