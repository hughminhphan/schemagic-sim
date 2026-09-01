import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  validateSelectedSemiconductorContract,
  validateSelectedSemiconductorExecutionReport,
} from "../selected-semiconductor-application-golden.mjs";

const CONTRACT_URL = new URL("../selected-semiconductor-application-golden/contract.json", import.meta.url);
const REPORT_URL = new URL("../selected-semiconductor-application-golden/execution-report.json", import.meta.url);
const ARTIFACT_PRESENT = existsSync(CONTRACT_URL) && existsSync(REPORT_URL);

async function fixture() {
  const [contractText, reportText] = await Promise.all([
    readFile(CONTRACT_URL, "utf8"),
    readFile(REPORT_URL, "utf8"),
  ]);
  const contract = JSON.parse(contractText);
  const report = JSON.parse(reportText);
  return {
    contract,
    contractContentHash: `sha256:${createHash("sha256").update(contractText).digest("hex")}`,
    report,
    reportText,
  };
}

test("strictly validates the canonical persisted selected-semiconductor execution artifact", { skip: !ARTIFACT_PRESENT }, async () => {
  const { contract, contractContentHash, report, reportText } = await fixture();
  assert.equal(reportText, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(validateSelectedSemiconductorContract(contract), contract.case);
  assert.equal(
    validateSelectedSemiconductorExecutionReport(report, contract, contractContentHash),
    report,
  );
});

test("rejects contract authority expansion and reviewed-point drift", { skip: !ARTIFACT_PRESENT }, async () => {
  const { contract } = await fixture();
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.case.selectedBinding.quantityPerAssembly = 1; },
    (value) => { value.case.modelBinding.supportedAnalyses = ["operating_point", "dc_sweep"]; },
    (value) => { value.case.modelBinding.domainCoverage.transient = "approx"; },
    (value) => { value.case.modelBinding.reviewer = "pending-independent-review"; },
    (value) => { value.case.modelBinding.generator = ""; },
    (value) => { value.case.modelBinding.generator = "arbitrary-generator"; },
    (value) => { value.case.modelBinding.reviewer = ""; },
    (value) => { value.case.modelBinding.reviewer = "arbitrary-reviewer"; },
    (value) => { value.case.modelBinding.reviewer = "Pending-Independent-Review"; },
    (value) => { value.engines.browserWasm.module = "../../forged-engine.mjs"; },
    (value) => { value.case.analysis = "tran"; },
    (value) => { value.case.observationContract.gateVoltageV = 12; },
    (value) => { value.case.observationContract.maximumInstanceSpreadOhm = 1e-6; },
    (value) => { value.case.observationContract.maximumInstanceSpreadOhm = Number.NaN; },
    (value) => { value.case.observationContract.maximumCrossEngineRdsRelativeDifference = 1e-2; },
    (value) => { value.case.observationContract.maximumCrossEngineRdsRelativeDifference = Number.NaN; },
    (value) => { value.case.sourceBinding.kind = "secondary"; },
    (value) => { value.case.sourceBinding.url = "https://example.invalid/forged.pdf"; },
    (value) => { value.case.sourceBinding.revision = "forged revision"; },
    (value) => { value.case.sourceBinding.sha256 = "0".repeat(64); },
    (value) => { value.case.sourceBinding.pagesReferenced = ["1"]; },
    (value) => { value.case.observationContract.productionRequestConditions.evaluated = true; },
    (value) => { value.evidenceBoundary.productionConstraintEligibility = true; },
    (value) => { value.evidenceBoundary.rankingAuthority = true; },
    (value) => { value.evidenceBoundary.fullBomCoverage = true; },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(contract);
    mutate(forged);
    assert.throws(() => validateSelectedSemiconductorContract(forged));
  }
});

test("rejects selected-semiconductor identity, evidence, numerical, claim, and shape drift", { skip: !ARTIFACT_PRESENT }, async () => {
  const { contract, contractContentHash, report } = await fixture();
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.contractContentHash = `sha256:${"0".repeat(64)}`; },
    (value) => { value.case.selectedBinding.quantityPerAssembly = 1; },
    (value) => { value.case.modelBinding.modelContentHash = `sha256:${"1".repeat(64)}`; },
    (value) => { value.case.sourceBinding.sha256 = "2".repeat(64); },
    (value) => { value.case.modelBinding.reviewer = "pending-independent-review"; },
    (value) => { value.case.modelBinding.supportedAnalyses = ["operating_point", "dc_sweep"]; },
    (value) => { value.case.candidateId = "candidate:v2:forged"; },
    (value) => { value.evidenceBoundary.productionObservationCandidateEligible = true; },
    (value) => { value.case.attestation = "independent"; },
    (value) => { value.case.native.rdsOhm[0] = 0.003; },
    (value) => { value.case.productionRequestConditionsEvaluated = true; },
    (value) => { value.case.productionConstraintEligibility = true; },
    (value) => { value.case.rankingAuthority = true; },
    (value) => { value.case.fullBomCoverage = true; },
    (value) => { value.case.selectedVectors[0].maxRelativeError = 0.02; },
    (value) => {
      value.case.selectedVectors[0].nativeValue = 1;
      value.case.selectedVectors[0].browserWasmValue = 2;
      value.case.selectedVectors[0].maxAbsError = 0;
      value.case.selectedVectors[0].maxRelativeError = 0;
    },
    (value) => { value.case.selectedVectors[0].nativeValue *= -1; },
    (value) => { value.case.maximumCrossEngineRdsRelativeDifference = 1; },
    (value) => { value.case.browserWasm.sampleCount = 2; },
    (value) => { value.case.engineIdentity.buildVersion = "ngspice-forged"; },
    (value) => { value.case.pass = false; },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(report);
    mutate(forged);
    assert.throws(() => validateSelectedSemiconductorExecutionReport(forged, contract, contractContentHash));
  }
});

test("keeps the full-vector result informational while the selected proof remains strict", { skip: !ARTIFACT_PRESENT }, async () => {
  const { contract, contractContentHash, report } = await fixture();
  const informationalFailure = structuredClone(report);
  informationalFailure.case.fullVectorComparisonPass = false;
  assert.equal(
    validateSelectedSemiconductorExecutionReport(informationalFailure, contract, contractContentHash),
    informationalFailure,
  );
  const expanded = structuredClone(informationalFailure);
  expanded.case.fullVectorComparisonIsReleaseGate = true;
  assert.throws(() => validateSelectedSemiconductorExecutionReport(expanded, contract, contractContentHash));
});
