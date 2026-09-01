import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  selectedPassiveExecutionIdentity,
  validateSelectedPassiveContract,
  validateSelectedPassiveExecutionReport,
} from "../selected-passive-application-golden.mjs";

const CONTRACT_URL = new URL("../selected-passive-application-golden/contract.json", import.meta.url);
const REPORT_URL = new URL("../selected-passive-application-golden/execution-report.json", import.meta.url);

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

test("strictly validates the persisted selected-passive execution artifact", async () => {
  const { contract, contractContentHash, report } = await fixture();
  assert.equal(
    validateSelectedPassiveExecutionReport(report, contract, contractContentHash),
    report,
  );
});

test("rejects execution-artifact identity, receipt, bounds, claim, and shape drift", async () => {
  const { contract, contractContentHash, report } = await fixture();
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.contractContentHash = `sha256:${"0".repeat(64)}`; },
    (value) => { value.case.productionProfileBindings[0].profileContentHash = `sha256:${"1".repeat(64)}`; },
    (value) => { value.case.productionProfileBindings[1].circuitComponentId = "output-capacitor-1"; },
    (value) => { value.case.strictGeneration.counts.rejected = 0; },
    (value) => { value.case.constraintDecisionContentHash = `sha256:${"2".repeat(64)}`; },
    (value) => { value.case.eligibleCandidateCount = 1; },
    (value) => { value.case.receiptContentHash = "not-a-hash"; },
    (value) => { value.case.selectedVectors[0].maxRelativeError = 0.02; },
    (value) => { value.case.native.sampleCount = 1; },
    (value) => { value.case.browserWasm.maximumOutputNodeKclResidualA = 1; },
    (value) => { value.case.browserWasm.maximumAbsoluteCapacitorCurrentsA.pop(); },
    (value) => { value.case.crossEngineAbsoluteInductorCurrentRelativeDifference = 1; },
    (value) => { value.case.operatingConditionsWithinReviewedEvidence = true; },
    (value) => { value.case.physicalWaveformFidelityProved = true; },
    (value) => { value.case.attestation = "independent"; },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(report);
    mutate(forged);
    assert.throws(() => validateSelectedPassiveExecutionReport(forged, contract, contractContentHash));
  }
});

test("strictly validates the contract on the hard persisted-artifact path", async () => {
  const { contract, report } = await fixture();
  const mutations = [
    (value) => { value.case.observationContract.extraClaim = "forged"; },
    (value) => { value.case.selectedBindings[1].nominalValue.value = 0.000044; },
    (value) => { value.evidenceBoundary.claim = "forged"; },
    (value) => { value.evidenceBoundary.authority.safety = "available"; },
    (value) => { value.evidenceBoundary.purpose = 42; },
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
    assert.throws(() => validateSelectedPassiveContract(forgedContract));
    assert.throws(() => validateSelectedPassiveExecutionReport(
      forgedReport,
      forgedContract,
      forgedContractContentHash,
    ));
  }
});

test("rejects the V1 schema and any collapsed one-capacitor shape on the V2 path", async () => {
  const { contract } = await fixture();
  const v1 = structuredClone(contract);
  v1.schemaVersion = 1;
  assert.throws(() => validateSelectedPassiveContract(v1), /Unsupported selected-passive application golden contract/u);

  const collapsed = structuredClone(contract);
  collapsed.case.selectedBindings = collapsed.case.selectedBindings.filter((entry) => (
    entry.circuitComponentId !== "output-capacitor-2"
  ));
  collapsed.case.selectedVectors = collapsed.case.selectedVectors.filter((name) => (
    name !== collapsed.case.observationContract.capacitorCurrentVectors[1]
  ));
  collapsed.case.observationContract.capacitorCurrentVectors.pop();
  collapsed.case.observationContract.capacitorPrimitiveCount = 1;
  assert.throws(() => validateSelectedPassiveContract(collapsed), /exactly three physical-instance bindings/u);
});

test("binds every persisted browser-WASM measurement compared with a fresh run", async () => {
  const { report } = await fixture();
  const mutations = [
    (value) => { value.case.browserWasm.sampleCount += 1; },
    (value) => { value.case.browserWasm.inputSpanV += 1e-9; },
    (value) => { value.case.browserWasm.outputSpanV += 1e-9; },
    (value) => { value.case.browserWasm.maximumAbsoluteInductorCurrentA += 1e-9; },
    (value) => { value.case.browserWasm.maximumAbsoluteCapacitorCurrentsA[0] += 1e-9; },
    (value) => { value.case.browserWasm.maximumOutputNodeKclResidualA *= 0.5; },
    (value) => { value.case.browserWasm.maximumLoadRelationResidualA *= 0.5; },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(report);
    mutate(forged);
    assert.notDeepEqual(
      selectedPassiveExecutionIdentity(forged),
      selectedPassiveExecutionIdentity(report),
    );
  }
});
