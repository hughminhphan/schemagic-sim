#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserWorkerHarness, selectedComparison } from "./application-golden.mjs";
import { compareRawfiles } from "./lib/compare-results.mjs";
import { runNative } from "./lib/run-native.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(HERE, "../..");
const CONTRACT_PATH = resolve(HERE, "selected-semiconductor-application-golden/contract.json");
const EXECUTION_REPORT_PATH = resolve(HERE, "selected-semiconductor-application-golden/execution-report.json");
const HASH = /^sha256:[0-9a-f]{64}$/u;
const SELECTED_VECTOR_MAX_RELATIVE_ERROR = 1e-3;
const MAXIMUM_INSTANCE_SPREAD_OHM = 1e-12;
const MAXIMUM_CROSS_ENGINE_RDS_RELATIVE_DIFFERENCE = 1e-6;
const MODEL_GENERATOR = "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0";
const MODEL_REVIEWER = "gpt-5.6-sol independent package reviewer";
const OFFICIAL_SOURCE = Object.freeze({
  kind: "datasheet",
  url: "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf",
  revision: "SLPS488B, June 2014, revised April 2017; packaged PDF generated 2025-11-11",
  sha256: "2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0",
  pagesReferenced: ["1", "3", "11"],
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function exactKeys(value, keys, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(actual.length === expected.length && actual.every((key, index) => key === expected[index]), `${label} has an unexpected shape`);
}

function finiteNumber(value, label) {
  invariant(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
  return value;
}

function vector(rawfile, name) {
  const found = rawfile.vectors.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  invariant(found, `Missing vector ${name}`);
  invariant(found.values.length === 1, `${name} must contain exactly one operating-point sample`);
  invariant(found.values.every((value) => typeof value === "number" && Number.isFinite(value)), `${name} must be a finite real vector`);
  return found.values;
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1e-15);
}

function validateMeasurements(value, spec, label) {
  exactKeys(value, [
    "sampleCount", "instanceCount", "drainVoltagesV", "rdsOhm", "minimumRdsOhm",
    "maximumRdsOhm", "instanceSpreadOhm", "allWithinReviewedMaximum",
    "productionRequestConditionsEvaluated",
  ], label);
  invariant(value.sampleCount === 1, `${label} must contain one operating-point sample`);
  invariant(value.instanceCount === spec.instanceCount, `${label} instance count drifted`);
  invariant(Array.isArray(value.drainVoltagesV) && value.drainVoltagesV.length === spec.instanceCount, `${label} drain-voltage set drifted`);
  invariant(Array.isArray(value.rdsOhm) && value.rdsOhm.length === spec.instanceCount, `${label} RDS set drifted`);
  for (const [index, drainVoltage] of value.drainVoltagesV.entries()) {
    invariant(finiteNumber(drainVoltage, `${label}.drainVoltagesV[${index}]`) > 0, `${label} drain voltage must be positive`);
  }
  for (const [index, resistance] of value.rdsOhm.entries()) {
    invariant(finiteNumber(resistance, `${label}.rdsOhm[${index}]`) > 0, `${label} RDS must be positive`);
    invariant(resistance <= spec.reviewedMaximumRdsOhm, `${label} RDS exceeds the reviewed maximum`);
    invariant(resistance === value.drainVoltagesV[index] / spec.forcedDrainCurrentA, `${label} RDS no longer matches drain voltage and forced current`);
  }
  const minimumRdsOhm = finiteNumber(value.minimumRdsOhm, `${label}.minimumRdsOhm`);
  const maximumRdsOhm = finiteNumber(value.maximumRdsOhm, `${label}.maximumRdsOhm`);
  const instanceSpreadOhm = finiteNumber(value.instanceSpreadOhm, `${label}.instanceSpreadOhm`);
  invariant(minimumRdsOhm === Math.min(...value.rdsOhm), `${label} minimum RDS drifted`);
  invariant(maximumRdsOhm === Math.max(...value.rdsOhm), `${label} maximum RDS drifted`);
  invariant(instanceSpreadOhm === maximumRdsOhm - minimumRdsOhm, `${label} instance spread drifted`);
  invariant(instanceSpreadOhm <= spec.maximumInstanceSpreadOhm, `${label} instance spread exceeds the contract`);
  invariant(value.allWithinReviewedMaximum === true, `${label} must remain within the reviewed RDS maximum`);
  invariant(value.productionRequestConditionsEvaluated === false, `${label} must not claim production-request evaluation`);
}

export function validateSelectedSemiconductorExecutionReport(report, contract, contractContentHash) {
  exactKeys(report, ["format", "schemaVersion", "contractContentHash", "evidenceBoundary", "case", "pass"], "selected-semiconductor execution report");
  invariant(
    report.format === "opencircuit-selected-semiconductor-application-golden-report" && report.schemaVersion === 1,
    "Unsupported selected-semiconductor execution report",
  );
  invariant(report.contractContentHash === contractContentHash, "Selected-semiconductor execution report contract hash drifted");
  invariant(JSON.stringify(report.evidenceBoundary) === JSON.stringify(contract.evidenceBoundary), "Selected-semiconductor execution report evidence boundary drifted");
  invariant(report.pass === true, "Selected-semiconductor execution report did not pass");

  const result = report.case;
  exactKeys(result, [
    "id", "application", "presetId", "observationKind", "candidateId", "candidateIndex",
    "recipe", "requestHash", "resultContentHash", "constraintDecisionContentHash", "library",
    "selectedBinding", "modelBinding", "sourceBinding", "benchId", "analysis", "modelTier",
    "attestation", "engineIdentity", "netlistContentHash", "sampleContentHash", "receiptContentHash",
    "repeatableBrowserReceipt", "selectedVectors", "fullVectorComparisonPass",
    "fullVectorComparisonIsReleaseGate", "native", "browserWasm",
    "maximumCrossEngineRdsRelativeDifference", "benchOperatingConditionsWithinReviewedEvidence",
    "productionRequestConditionsEvaluated", "productionConstraintEligibility", "rankingAuthority",
    "fullBomCoverage", "pass",
  ], "selected-semiconductor execution report case");
  for (const key of [
    "id", "application", "presetId", "observationKind", "candidateId", "candidateIndex",
    "requestHash", "resultContentHash", "constraintDecisionContentHash", "benchId", "analysis",
    "netlistContentHash",
  ]) {
    invariant(result[key] === contract.case[key], `Selected-semiconductor execution report ${key} drifted`);
  }
  for (const key of ["recipe", "library", "selectedBinding", "modelBinding", "sourceBinding"]) {
    invariant(JSON.stringify(result[key]) === JSON.stringify(contract.case[key]), `Selected-semiconductor execution report ${key} drifted`);
  }
  exactKeys(result.engineIdentity, ["id", "buildVersion", "simulatorVersion", "solver", "numericFormat"], "selected-semiconductor execution engine identity");
  invariant(result.engineIdentity.id === "@opencircuit/ngspice-wasm", "Selected-semiconductor execution engine id drifted");
  invariant(result.engineIdentity.buildVersion === contract.engines.browserWasm.engineVersion, "Selected-semiconductor execution engine build drifted");
  invariant(result.engineIdentity.simulatorVersion === contract.engines.browserWasm.simulatorVersion, "Selected-semiconductor execution simulator version drifted");
  invariant(result.engineIdentity.solver === contract.engines.browserWasm.solver, "Selected-semiconductor execution solver drifted");
  invariant(result.engineIdentity.numericFormat === "ieee754-binary64", "Selected-semiconductor execution numeric format drifted");
  invariant(HASH.test(result.sampleContentHash) && HASH.test(result.receiptContentHash), "Selected-semiconductor execution hashes are invalid");
  invariant(result.modelTier === "F1" && result.attestation === "none", "Selected-semiconductor execution claim boundary drifted");
  invariant(result.repeatableBrowserReceipt === true, "Selected-semiconductor browser receipt was not repeatable");
  invariant(typeof result.fullVectorComparisonPass === "boolean" && result.fullVectorComparisonIsReleaseGate === false, "Selected-semiconductor informational full-vector boundary drifted");
  invariant(Array.isArray(result.selectedVectors) && result.selectedVectors.length === contract.case.selectedVectors.length, "Selected-semiconductor execution vector set drifted");
  for (const [index, vectorResult] of result.selectedVectors.entries()) {
    exactKeys(vectorResult, [
      "name", "metric", "nativeValue", "browserWasmValue", "maxAbsError", "maxRelativeError",
    ], `selected-semiconductor execution vector ${index}`);
    invariant(vectorResult.name === contract.case.selectedVectors[index], `Selected-semiconductor execution vector ${index} drifted`);
    invariant(vectorResult.metric === "point-relative", `Selected-semiconductor execution vector ${index} metric drifted`);
    const nativeValue = finiteNumber(vectorResult.nativeValue, `selected-semiconductor vector ${index}.nativeValue`);
    const browserWasmValue = finiteNumber(vectorResult.browserWasmValue, `selected-semiconductor vector ${index}.browserWasmValue`);
    invariant(nativeValue > 0 && browserWasmValue > 0, `Selected-semiconductor vector ${index} samples must retain the positive drain polarity`);
    const observedAbsError = Math.abs(browserWasmValue - nativeValue);
    const observedRelativeError = observedAbsError / Math.max(Math.abs(nativeValue), 1e-9);
    invariant(vectorResult.maxAbsError === observedAbsError, `Selected-semiconductor vector ${index} absolute error was not recomputed from stored samples`);
    const maxRelativeError = finiteNumber(vectorResult.maxRelativeError, `selected-semiconductor vector ${index}.maxRelativeError`);
    invariant(maxRelativeError === observedRelativeError, `Selected-semiconductor vector ${index} relative error was not recomputed from stored samples`);
    invariant(maxRelativeError >= 0 && maxRelativeError <= SELECTED_VECTOR_MAX_RELATIVE_ERROR, `Selected-semiconductor vector ${index} exceeded the operating-point relative tolerance`);
    invariant(nativeValue === result.native.drainVoltagesV[index], `Selected-semiconductor vector ${index} native sample drifted from its measurement`);
    invariant(browserWasmValue === result.browserWasm.drainVoltagesV[index], `Selected-semiconductor vector ${index} browser-WASM sample drifted from its measurement`);
  }
  validateMeasurements(result.native, contract.case.observationContract, "selected-semiconductor native measurements");
  validateMeasurements(result.browserWasm, contract.case.observationContract, "selected-semiconductor browser-WASM measurements");
  const observedCrossEngineRdsRelativeDifference = Math.max(...result.native.rdsOhm.map((value, index) => (
    relativeDifference(value, result.browserWasm.rdsOhm[index])
  )));
  invariant(
    result.maximumCrossEngineRdsRelativeDifference === observedCrossEngineRdsRelativeDifference,
    "Selected-semiconductor stored cross-engine RDS difference drifted from the measurements",
  );
  invariant(
    finiteNumber(result.maximumCrossEngineRdsRelativeDifference, "selected-semiconductor cross-engine RDS difference")
      <= contract.case.observationContract.maximumCrossEngineRdsRelativeDifference,
    "Selected-semiconductor cross-engine RDS difference exceeds the contract",
  );
  invariant(result.benchOperatingConditionsWithinReviewedEvidence === true, "Selected-semiconductor bench must remain at the reviewed operating point");
  invariant(result.productionRequestConditionsEvaluated === false, "Selected-semiconductor execution must not claim production-request evaluation");
  invariant(result.productionConstraintEligibility === false, "Selected-semiconductor execution must not grant production eligibility");
  invariant(result.rankingAuthority === false && result.fullBomCoverage === false, "Selected-semiconductor execution authority expanded");
  invariant(result.pass === true, "Selected-semiconductor execution case did not pass");
  return report;
}

function executionIdentity(report) {
  const result = report.case;
  return {
    contractContentHash: report.contractContentHash,
    evidenceBoundary: report.evidenceBoundary,
    id: result.id,
    application: result.application,
    presetId: result.presetId,
    observationKind: result.observationKind,
    candidateId: result.candidateId,
    candidateIndex: result.candidateIndex,
    recipe: result.recipe,
    requestHash: result.requestHash,
    resultContentHash: result.resultContentHash,
    constraintDecisionContentHash: result.constraintDecisionContentHash,
    library: result.library,
    selectedBinding: result.selectedBinding,
    modelBinding: result.modelBinding,
    sourceBinding: result.sourceBinding,
    benchId: result.benchId,
    analysis: result.analysis,
    modelTier: result.modelTier,
    attestation: result.attestation,
    engineIdentity: result.engineIdentity,
    netlistContentHash: result.netlistContentHash,
    sampleContentHash: result.sampleContentHash,
    receiptContentHash: result.receiptContentHash,
    repeatableBrowserReceipt: result.repeatableBrowserReceipt,
    selectedVectors: result.selectedVectors,
    fullVectorComparisonIsReleaseGate: result.fullVectorComparisonIsReleaseGate,
    native: result.native,
    browserWasm: result.browserWasm,
    maximumCrossEngineRdsRelativeDifference: result.maximumCrossEngineRdsRelativeDifference,
    benchOperatingConditionsWithinReviewedEvidence: result.benchOperatingConditionsWithinReviewedEvidence,
    productionRequestConditionsEvaluated: result.productionRequestConditionsEvaluated,
    productionConstraintEligibility: result.productionConstraintEligibility,
    rankingAuthority: result.rankingAuthority,
    fullBomCoverage: result.fullBomCoverage,
  };
}

async function verifyPersistedExecutionReport(freshReport, contract, contractContentHash, reportPath) {
  const persistedText = await readFile(reportPath, "utf8");
  let persisted;
  try {
    persisted = JSON.parse(persistedText);
  } catch (error) {
    throw new Error(`Persisted selected-semiconductor execution report is not JSON: ${error.message}`);
  }
  invariant(persistedText === `${JSON.stringify(persisted, null, 2)}\n`, "Persisted selected-semiconductor execution report is not canonical pretty JSON");
  validateSelectedSemiconductorExecutionReport(persisted, contract, contractContentHash);
  invariant(
    JSON.stringify(executionIdentity(persisted)) === JSON.stringify(executionIdentity(freshReport)),
    "Persisted selected-semiconductor execution identity does not match the fresh native/browser-WASM run",
  );
  return { path: reportPath, contentHash: sha256(persistedText) };
}

export function validateSelectedSemiconductorContract(contract) {
  exactKeys(contract, ["format", "schemaVersion", "engines", "evidenceBoundary", "case"], "selected-semiconductor golden contract");
  invariant(contract.format === "opencircuit-selected-semiconductor-application-golden-contract" && contract.schemaVersion === 1, "Unsupported selected-semiconductor application golden contract");
  exactKeys(contract.engines, ["native", "browserWasm"], "selected-semiconductor engines");
  exactKeys(contract.engines.native, ["version", "solverClaim"], "selected-semiconductor native engine");
  exactKeys(contract.engines.browserWasm, ["module", "engineVersion", "simulatorVersion", "solver"], "selected-semiconductor browser-WASM engine");
  invariant(contract.engines.native.version === "ngspice-46" && contract.engines.native.solverClaim === "unverified", "Selected-semiconductor native identity drifted");
  invariant(
    contract.engines.browserWasm.module === "../../ngspice-wasm-build/dist-loader/index.mjs"
      && contract.engines.browserWasm.engineVersion === "ngspice-46-opencircuit-wasm1"
      && contract.engines.browserWasm.simulatorVersion === "ngspice-46"
      && contract.engines.browserWasm.solver === "KLU",
    "Selected-semiconductor browser-WASM identity drifted",
  );

  exactKeys(contract.evidenceBoundary, [
    "modelTier", "attestation", "productionProfilesUsed", "productionObservationCandidateEligible",
    "benchOperatingConditionsWithinReviewedEvidence", "productionRequestConditionsEvaluated",
    "productionConstraintEligibility", "rankingAuthority", "fullBomCoverage", "claim", "purpose",
    "doesNotProve",
  ], "selected-semiconductor evidence boundary");
  invariant(contract.evidenceBoundary.modelTier === "F1", "Selected-semiconductor model tier must stay F1");
  invariant(contract.evidenceBoundary.attestation === "none", "Selected-semiconductor receipts must stay unattested");
  invariant(contract.evidenceBoundary.productionProfilesUsed === true, "Selected-semiconductor contract must bind a production profile");
  invariant(contract.evidenceBoundary.productionObservationCandidateEligible === false, "Selected-semiconductor observation candidate must remain ineligible");
  invariant(contract.evidenceBoundary.benchOperatingConditionsWithinReviewedEvidence === true, "Selected-semiconductor bench must stay at the reviewed point");
  for (const key of ["productionRequestConditionsEvaluated", "productionConstraintEligibility", "rankingAuthority", "fullBomCoverage"]) {
    invariant(contract.evidenceBoundary[key] === false, `Selected-semiconductor ${key} must remain false`);
  }
  invariant(Array.isArray(contract.evidenceBoundary.doesNotProve) && contract.evidenceBoundary.doesNotProve.length >= 8, "Selected-semiconductor exclusions are incomplete");

  const testCase = contract.case;
  exactKeys(testCase, [
    "id", "application", "presetId", "observationKind", "candidateId", "candidateIndex", "recipe",
    "requestHash", "resultContentHash", "constraintDecisionContentHash", "library", "selectedBinding",
    "modelBinding", "sourceBinding", "benchId", "analysis", "fixture", "netlistContentHash",
    "selectedVectors", "observationContract",
  ], "selected-semiconductor case");
  exactKeys(testCase.recipe, ["id", "version", "contentHash"], "selected-semiconductor recipe");
  exactKeys(testCase.library, ["version", "contextManifestContentHash", "sourceReleaseContentHash"], "selected-semiconductor library");
  exactKeys(testCase.selectedBinding, [
    "selectedComponentId", "role", "profileId", "profileContentHash", "manufacturerId",
    "manufacturerPartNumber", "quantityPerAssembly", "catalogAdmissionState",
  ], "selected-semiconductor selected binding");
  exactKeys(testCase.modelBinding, [
    "packageId", "packagePath", "componentContentHash", "factsContentHash", "fittedContentHash",
    "modelContentHash", "sourcesContentHash", "validationResultsContentHash",
    "expectationsContentHash", "modelName", "modelType", "fidelityTier", "electricalFamily",
    "evidenceContractVersion", "generator", "reviewer", "supportedAnalyses", "domainCoverage",
    "strictAdmission",
  ], "selected-semiconductor model binding");
  exactKeys(testCase.modelBinding.domainCoverage, ["dc", "ac", "transient", "noise", "thermal", "digital"], "selected-semiconductor model domain coverage");
  exactKeys(testCase.sourceBinding, ["kind", "url", "revision", "sha256", "pagesReferenced"], "selected-semiconductor source binding");
  invariant(testCase.observationKind === "production_constraint_observation", "Selected-semiconductor observation kind drifted");
  invariant(testCase.analysis === "op", "Selected-semiconductor golden requires an operating-point analysis");
  invariant(testCase.candidateIndex === 0, "Selected-semiconductor candidate index drifted");
  invariant(testCase.selectedBinding.selectedComponentId === "mosfet" && testCase.selectedBinding.role === "bridge-n-channel-power-mosfet", "Selected-semiconductor selected role drifted");
  invariant(testCase.selectedBinding.quantityPerAssembly === 4, "Selected-semiconductor selected quantity must stay four");
  invariant(testCase.selectedBinding.catalogAdmissionState === "reviewed", "Selected-semiconductor profile must remain reviewed");
  invariant(testCase.modelBinding.packageId === "texas-instruments/CSD18540Q5B", "Selected-semiconductor model package drifted");
  invariant(testCase.modelBinding.packagePath === "packages/model-library/models/texas-instruments/CSD18540Q5B", "Selected-semiconductor model package path drifted");
  invariant(testCase.modelBinding.modelType === "dot_model" && testCase.modelBinding.fidelityTier === "F1", "Selected-semiconductor model type or tier drifted");
  invariant(testCase.modelBinding.electricalFamily === "nmos" && testCase.modelBinding.evidenceContractVersion === "1.0.0", "Selected-semiconductor model contract drifted");
  invariant(testCase.modelBinding.generator === MODEL_GENERATOR, "Selected-semiconductor model generator attribution drifted");
  invariant(testCase.modelBinding.reviewer === MODEL_REVIEWER, "Selected-semiconductor independent reviewer attribution drifted");
  invariant(testCase.modelBinding.generator.length > 0 && testCase.modelBinding.reviewer.length > 0 && testCase.modelBinding.generator !== testCase.modelBinding.reviewer && !/pending/iu.test(testCase.modelBinding.reviewer), "Selected-semiconductor model lacks completed independent review");
  invariant(JSON.stringify(testCase.modelBinding.supportedAnalyses) === JSON.stringify(["operating_point"]), "Selected-semiconductor supported analyses drifted beyond the OP-only package authority");
  invariant(JSON.stringify(testCase.modelBinding.domainCoverage) === JSON.stringify({ dc: "approx", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" }), "Selected-semiconductor domain coverage drifted");
  invariant(testCase.modelBinding.strictAdmission === true, "Selected-semiconductor model must remain strictly admitted");
  for (const key of [
    "profileContentHash", "componentContentHash", "factsContentHash", "fittedContentHash", "modelContentHash",
    "sourcesContentHash", "validationResultsContentHash", "expectationsContentHash", "netlistContentHash",
  ]) {
    const value = key === "profileContentHash" ? testCase.selectedBinding[key]
      : key === "netlistContentHash" ? testCase[key]
        : testCase.modelBinding[key];
    invariant(HASH.test(value), `Selected-semiconductor ${key} is invalid`);
  }
  invariant(JSON.stringify(testCase.sourceBinding) === JSON.stringify(OFFICIAL_SOURCE), "Selected-semiconductor official TI source identity drifted");
  invariant(Array.isArray(testCase.selectedVectors) && JSON.stringify(testCase.selectedVectors) === JSON.stringify(["v(d1)", "v(d2)", "v(d3)", "v(d4)"]), "Selected-semiconductor selected vectors drifted");

  const spec = testCase.observationContract;
  exactKeys(spec, [
    "kind", "instanceCount", "temperatureC", "gateVoltageV", "forcedDrainCurrentA",
    "reviewedMaximumRdsOhm", "conditionId", "resistanceEvidenceId", "maximumInstanceSpreadOhm",
    "maximumCrossEngineRdsRelativeDifference", "productionRequestConditions", "interpretation",
  ], "selected-semiconductor observation contract");
  exactKeys(spec.productionRequestConditions, [
    "ambientTemperatureC", "loadCurrentA", "stallCurrentA", "supplyMinimumV", "supplyNominalV",
    "supplyMaximumV", "pwmFrequencyHz", "dutyCycle", "evaluated",
  ], "selected-semiconductor production request conditions");
  invariant(spec.kind === "four-selected-quantity-f1-rdson-at-reviewed-table-point", "Selected-semiconductor observation kind drifted");
  invariant(spec.instanceCount === 4 && spec.temperatureC === 25 && spec.gateVoltageV === 10 && spec.forcedDrainCurrentA === 28, "Selected-semiconductor reviewed operating point drifted");
  invariant(spec.reviewedMaximumRdsOhm === 0.0022, "Selected-semiconductor reviewed RDS maximum drifted");
  invariant(HASH.test(spec.conditionId) && HASH.test(spec.resistanceEvidenceId), "Selected-semiconductor evidence identity is invalid");
  invariant(spec.maximumInstanceSpreadOhm === MAXIMUM_INSTANCE_SPREAD_OHM, "Selected-semiconductor instance-spread tolerance drifted");
  invariant(spec.maximumCrossEngineRdsRelativeDifference === MAXIMUM_CROSS_ENGINE_RDS_RELATIVE_DIFFERENCE, "Selected-semiconductor cross-engine RDS tolerance drifted");
  invariant(JSON.stringify(spec.productionRequestConditions) === JSON.stringify({
    ambientTemperatureC: 40,
    loadCurrentA: 5,
    stallCurrentA: 20,
    supplyMinimumV: 18,
    supplyNominalV: 24,
    supplyMaximumV: 30,
    pwmFrequencyHz: 20000,
    dutyCycle: 0.8,
    evaluated: false,
  }), "Selected-semiconductor production-request boundary drifted");
  invariant(spec.interpretation === "reviewed_dc_table_point_only_not_production_request_conditions", "Selected-semiconductor interpretation drifted");
  return testCase;
}

function measurements(rawfile, spec, engine) {
  const drainVoltagesV = Array.from({ length: spec.instanceCount }, (_unused, index) => Math.abs(vector(rawfile, `v(d${index + 1})`)[0]));
  const rdsOhm = drainVoltagesV.map((value) => value / spec.forcedDrainCurrentA);
  const minimumRdsOhm = Math.min(...rdsOhm);
  const maximumRdsOhm = Math.max(...rdsOhm);
  const instanceSpreadOhm = maximumRdsOhm - minimumRdsOhm;
  invariant(rdsOhm.every((value) => value > 0 && value <= spec.reviewedMaximumRdsOhm), `${engine} selected-semiconductor RDS is outside the reviewed maximum`);
  invariant(instanceSpreadOhm <= spec.maximumInstanceSpreadOhm, `${engine} selected-semiconductor instance spread exceeds the contract`);
  return {
    sampleCount: 1,
    instanceCount: spec.instanceCount,
    drainVoltagesV,
    rdsOhm,
    minimumRdsOhm,
    maximumRdsOhm,
    instanceSpreadOhm,
    allWithinReviewedMaximum: true,
    productionRequestConditionsEvaluated: false,
  };
}

async function runCase(testCase, contract, browserWorker) {
  const netlistPath = resolve(HERE, "selected-semiconductor-application-golden", testCase.fixture);
  const [netlist, modelText] = await Promise.all([
    readFile(netlistPath, "utf8"),
    readFile(resolve(REPOSITORY_ROOT, testCase.modelBinding.packagePath, "model.cir"), "utf8"),
  ]);
  invariant(sha256(netlist) === testCase.netlistContentHash, "Selected-semiconductor exact netlist bytes drifted");
  invariant(sha256(modelText) === testCase.modelBinding.modelContentHash, "Selected-semiconductor exact model bytes drifted");
  invariant(netlist.includes(modelText.trimEnd()), "Selected-semiconductor fixture is not bound to the exact model text");
  const mosfetInstances = netlist.split(/\r?\n/u).filter((line) => /^M[1-4]\s+d[1-4]\s+g[1-4]\s+0\s+OC_TEXAS-INSTRUMENTS_CSD18540Q5B$/u.test(line));
  invariant(mosfetInstances.length === 4, "Selected-semiconductor fixture must contain exactly four bound MOSFET instances");
  invariant(!/^\.(?:tran|ac|noise)\b/imu.test(netlist), "Selected-semiconductor fixture expanded beyond operating-point analysis");

  const browserModule = new URL(contract.engines.browserWasm.module, pathToFileURL(CONTRACT_PATH)).href;
  const [native, firstWasm] = await Promise.all([
    runNative({ netlist, timeoutMs: 30_000 }),
    browserWorker.run(netlist, "runOpPoint", browserModule),
  ]);
  const secondWasm = await browserWorker.run(netlist, "runOpPoint", browserModule);
  invariant(native.version === contract.engines.native.version, "Selected-semiconductor native engine version drifted");
  invariant(firstWasm.version === contract.engines.browserWasm.engineVersion, "Selected-semiconductor browser-WASM engine version drifted");
  invariant(firstWasm.ngspiceVersion === contract.engines.browserWasm.simulatorVersion, "Selected-semiconductor browser-WASM simulator version drifted");

  const comparison = compareRawfiles(native.rawfile, firstWasm.rawfile, { analysis: "op" });
  const selectedVectors = selectedComparison(comparison, testCase.selectedVectors).map((entry) => ({
    ...entry,
    nativeValue: vector(native.rawfile, entry.name)[0],
    browserWasmValue: vector(firstWasm.rawfile, entry.name)[0],
  }));
  const nativeMeasurements = measurements(native.rawfile, testCase.observationContract, "native");
  const wasmMeasurements = measurements(firstWasm.rawfile, testCase.observationContract, "browser-WASM");
  const maximumCrossEngineRdsRelativeDifference = Math.max(...nativeMeasurements.rdsOhm.map((value, index) => relativeDifference(value, wasmMeasurements.rdsOhm[index])));
  invariant(maximumCrossEngineRdsRelativeDifference <= testCase.observationContract.maximumCrossEngineRdsRelativeDifference, "Selected-semiconductor RDS differed across engines");

  const firstReceipt = firstWasm.receipt;
  const secondReceipt = secondWasm.receipt;
  invariant(firstReceipt.attestation === "none", "Selected-semiconductor receipt attestation boundary drifted");
  invariant(firstReceipt.executionHost === "local_worker", "Selected-semiconductor receipt was not minted by the local worker");
  invariant(JSON.stringify(firstReceipt.engine) === JSON.stringify(firstWasm.engineIdentity), "Selected-semiconductor receipt engine identity drifted");
  invariant(JSON.stringify(firstReceipt) === JSON.stringify(secondReceipt), "Selected-semiconductor browser receipt was not repeatable");
  invariant(firstWasm.receiptVerificationIssues.length === 0, `Selected-semiconductor first receipt verification failed: ${firstWasm.receiptVerificationIssues.join(", ")}`);
  invariant(secondWasm.receiptVerificationIssues.length === 0, `Selected-semiconductor repeated receipt verification failed: ${secondWasm.receiptVerificationIssues.join(", ")}`);
  invariant(firstReceipt.netlistContentHash === testCase.netlistContentHash, "Selected-semiconductor receipt did not bind the exact golden netlist");

  return {
    id: testCase.id,
    application: testCase.application,
    presetId: testCase.presetId,
    observationKind: testCase.observationKind,
    candidateId: testCase.candidateId,
    candidateIndex: testCase.candidateIndex,
    recipe: testCase.recipe,
    requestHash: testCase.requestHash,
    resultContentHash: testCase.resultContentHash,
    constraintDecisionContentHash: testCase.constraintDecisionContentHash,
    library: testCase.library,
    selectedBinding: testCase.selectedBinding,
    modelBinding: testCase.modelBinding,
    sourceBinding: testCase.sourceBinding,
    benchId: testCase.benchId,
    analysis: testCase.analysis,
    modelTier: "F1",
    attestation: firstReceipt.attestation,
    engineIdentity: firstReceipt.engine,
    netlistContentHash: firstReceipt.netlistContentHash,
    sampleContentHash: firstReceipt.sampleContentHash,
    receiptContentHash: firstReceipt.contentHash,
    repeatableBrowserReceipt: true,
    selectedVectors,
    fullVectorComparisonPass: comparison.pass,
    fullVectorComparisonIsReleaseGate: false,
    native: nativeMeasurements,
    browserWasm: wasmMeasurements,
    maximumCrossEngineRdsRelativeDifference,
    benchOperatingConditionsWithinReviewedEvidence: true,
    productionRequestConditionsEvaluated: false,
    productionConstraintEligibility: false,
    rankingAuthority: false,
    fullBomCoverage: false,
    pass: true,
  };
}

export async function runSelectedSemiconductorApplicationGolden() {
  const contractBytes = await readFile(CONTRACT_PATH, "utf8");
  const contract = JSON.parse(contractBytes);
  const testCase = validateSelectedSemiconductorContract(contract);
  const browserWorker = new BrowserWorkerHarness();
  let result;
  try {
    result = await runCase(testCase, contract, browserWorker);
  } catch (error) {
    throw new Error(`Selected-semiconductor application golden execution failed; build @opencircuit/sim-engine first: ${error.message}`);
  } finally {
    await browserWorker.close();
  }
  const report = {
    format: "opencircuit-selected-semiconductor-application-golden-report",
    schemaVersion: 1,
    contractContentHash: sha256(contractBytes),
    evidenceBoundary: contract.evidenceBoundary,
    case: result,
    pass: result.pass,
  };
  validateSelectedSemiconductorExecutionReport(report, contract, report.contractContentHash);
  return { report, contract, contractContentHash: report.contractContentHash };
}

async function main() {
  const args = process.argv.slice(2);
  invariant(args.length === 0 || (args.length === 1 && args[0] === "--verify-persisted-report"), "Usage: selected-semiconductor-application-golden.mjs [--verify-persisted-report]");
  const { report, contract, contractContentHash } = await runSelectedSemiconductorApplicationGolden();
  if (args[0] === "--verify-persisted-report") {
    await verifyPersistedExecutionReport(report, contract, contractContentHash, EXECUTION_REPORT_PATH);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
