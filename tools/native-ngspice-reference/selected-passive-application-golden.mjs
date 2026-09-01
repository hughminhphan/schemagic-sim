#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserWorkerHarness, selectedComparison } from "./application-golden.mjs";
import { compareRawfiles } from "./lib/compare-results.mjs";
import { runNative } from "./lib/run-native.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = resolve(HERE, "selected-passive-application-golden/contract.json");
const EXECUTION_REPORT_PATH = resolve(HERE, "selected-passive-application-golden/execution-report.json");
const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;
const GENERATION_COUNT_KEYS = Object.freeze([
  "recipes", "supportedRecipes", "enumerated", "solved", "matchOutcomes", "matched", "checked",
  "estimated", "deduped", "pareto", "materialized", "coverageValidated", "rejected",
]);
const SELECTED_VECTOR_MAX_RELATIVE_ERROR = 1e-2;
const SELECTED_PASSIVE_CLAIM = "Current production observation identity and two explicit parallel per-part ideal nominal capacitor primitives plus one ideal nominal inductor primitive only; the exact retained candidate is ineligible under the installed production policy.";
const SELECTED_PASSIVE_PURPOSE = "Deterministic current production observation-to-generated-netlist, execution-receipt, selected-vector parity, and ideal nominal output-node relation evidence for two explicit parallel capacitor instances and one inductor instance in one policy-ineligible candidate.";
const SELECTED_PASSIVE_RELATION = "Iinductor=Icapacitor1+Icapacitor2+Iload and Iload=Voutput/Rload for two parallel per-part ideal nominal capacitor primitives";
const SELECTED_PASSIVE_CAPACITOR_CURRENT_VECTORS = Object.freeze([
  "i(@coc_6f75747075742d636170616369746f722d31[i])",
  "i(@coc_6f75747075742d636170616369746f722d32[i])",
]);
const SELECTED_PASSIVE_VECTORS = Object.freeze([
  ...SELECTED_PASSIVE_CAPACITOR_CURRENT_VECTORS,
  "i(@loc_706f7765722d696e647563746f72[i])",
  "i(@roc_6e6f6d696e616c2d6c6f6164[i])",
  "v(n1)",
  "v(n2)",
]);
const UNAVAILABLE_AUTHORITY = "unavailable";
const SELECTED_PASSIVE_AUTHORITIES = Object.freeze({
  switchingBehavior: UNAVAILABLE_AUTHORITY,
  effectiveCapacitance: UNAVAILABLE_AUTHORITY,
  capacitorEsr: UNAVAILABLE_AUTHORITY,
  capacitorRippleCurrent: UNAVAILABLE_AUTHORITY,
  passiveCurrent: UNAVAILABLE_AUTHORITY,
  loss: UNAVAILABLE_AUTHORITY,
  physicalPassiveModel: UNAVAILABLE_AUTHORITY,
  fullBomModel: UNAVAILABLE_AUTHORITY,
  selectedSemiconductorModel: UNAVAILABLE_AUTHORITY,
  constraintEligibility: UNAVAILABLE_AUTHORITY,
  candidateRanking: UNAVAILABLE_AUTHORITY,
  safety: UNAVAILABLE_AUTHORITY,
});
const SELECTED_PASSIVE_BINDING_IDENTITIES = Object.freeze([
  Object.freeze({
    selectedComponentId: "output-capacitor",
    assemblyComponentId: "output-capacitor-1",
    circuitComponentId: "output-capacitor-1",
    physicalInstanceOrdinal: 1,
    selectedLineQuantityPerAssembly: 2,
    representedQuantityPerAssembly: 1,
    classification: "physical",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
    profileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM32ER71E226KE15L",
    nominalValue: Object.freeze({ value: 0.000022, unit: "F" }),
    nominalEvidenceContentHash: "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873",
    representation: "ideal_nominal_capacitor",
    reviewedOperatingConditionStatus: "outside_or_unproved",
  }),
  Object.freeze({
    selectedComponentId: "output-capacitor",
    assemblyComponentId: "output-capacitor-2",
    circuitComponentId: "output-capacitor-2",
    physicalInstanceOrdinal: 2,
    selectedLineQuantityPerAssembly: 2,
    representedQuantityPerAssembly: 1,
    classification: "physical",
    profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
    profileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
    manufacturerId: "murata-manufacturing",
    manufacturerPartNumber: "GRM32ER71E226KE15L",
    nominalValue: Object.freeze({ value: 0.000022, unit: "F" }),
    nominalEvidenceContentHash: "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873",
    representation: "ideal_nominal_capacitor",
    reviewedOperatingConditionStatus: "outside_or_unproved",
  }),
  Object.freeze({
    selectedComponentId: "power-inductor",
    assemblyComponentId: "power-inductor",
    circuitComponentId: "power-inductor",
    physicalInstanceOrdinal: 1,
    selectedLineQuantityPerAssembly: 1,
    representedQuantityPerAssembly: 1,
    classification: "physical",
    profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
    profileContentHash: "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
    manufacturerId: "bel-fuse",
    manufacturerPartNumber: "F1F2-0804-100M",
    nominalValue: Object.freeze({ value: 0.00001, unit: "H" }),
    nominalEvidenceContentHash: "sha256:c3523b58c262a6d39716711a5a05a5b6e5a60081eb15818bf35ba4b93e7a828f",
    representation: "ideal_nominal_inductor",
    reviewedOperatingConditionStatus: "outside",
  }),
]);
const SELECTED_PASSIVE_EXCLUSIONS = Object.freeze([
  "TPS54302DDCR control, timing, current-limit, protection, package, semiconductor, or selected-part model fidelity",
  "capacitor tolerance, effective capacitance under bias, ESR, ripple-current, current sharing, parasitic, temperature, or physical waveform fidelity",
  "inductor tolerance, inductance away from the exact 100 kHz / 0.25 V RMS characterization, DCR, saturation-current, RMS-current, core-loss, parasitic, temperature, or physical waveform fidelity",
  "safe passive operating conditions, regulation, loop stability, loss, efficiency, thermal behavior, EMI, or PCB behavior",
  "candidate constraint eligibility, ranking, provider approval, commercial availability, or release readiness",
  "full selected-part or full-vector native/browser-WASM equivalence outside the declared observations",
]);

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

function vector(rawfile, name) {
  const found = rawfile.vectors.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  invariant(found, `Missing vector ${name}`);
  invariant(found.values.length > 0 && found.values.every((value) => typeof value === "number" && Number.isFinite(value)), `${name} must be a finite real vector`);
  return found.values;
}

function maximumAbsolute(values) {
  return Math.max(...values.map(Math.abs));
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1e-15);
}

function finiteNumber(value, label) {
  invariant(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
  return value;
}

function validateGenerationCounts(value, label) {
  exactKeys(value, GENERATION_COUNT_KEYS, label);
  for (const key of GENERATION_COUNT_KEYS) {
    invariant(Number.isInteger(value[key]) && value[key] >= 0, `${label}.${key} must be a non-negative integer`);
  }
}

function validatePersistedMeasurements(value, spec, label) {
  exactKeys(value, [
    "sampleCount", "inputSpanV", "outputSpanV", "maximumAbsoluteInductorCurrentA",
    "maximumAbsoluteCapacitorCurrentsA",
    "maximumOutputNodeKclResidualA", "maximumLoadRelationResidualA",
    "operatingConditionsWithinReviewedEvidence", "physicalWaveformFidelityProved",
  ], label);
  invariant(Number.isInteger(value.sampleCount) && value.sampleCount >= spec.minimumSampleCount, `${label} has too few samples`);
  invariant(finiteNumber(value.inputSpanV, `${label}.inputSpanV`) > 0, `${label} input span is vacuous`);
  invariant(finiteNumber(value.outputSpanV, `${label}.outputSpanV`) >= spec.minimumOutputSpanV, `${label} output span is vacuous`);
  const maximumAbsoluteInductorCurrentA = finiteNumber(value.maximumAbsoluteInductorCurrentA, `${label}.maximumAbsoluteInductorCurrentA`);
  invariant(
    maximumAbsoluteInductorCurrentA >= spec.minimumAbsoluteInductorCurrentA
      && maximumAbsoluteInductorCurrentA <= spec.maximumAbsoluteInductorCurrentA,
    `${label} ideal nominal inductor-current projection is outside its bounded regression window`,
  );
  invariant(
    Array.isArray(value.maximumAbsoluteCapacitorCurrentsA)
      && value.maximumAbsoluteCapacitorCurrentsA.length === spec.capacitorCurrentVectors.length,
    `${label} must retain one maximum-current observation per explicit capacitor primitive`,
  );
  for (const [index, maximumAbsoluteCapacitorCurrentA] of value.maximumAbsoluteCapacitorCurrentsA.entries()) {
    invariant(
      finiteNumber(maximumAbsoluteCapacitorCurrentA, `${label}.maximumAbsoluteCapacitorCurrentsA[${index}]`)
        >= spec.minimumAbsoluteCapacitorCurrentA
        && maximumAbsoluteCapacitorCurrentA <= spec.maximumAbsoluteCapacitorCurrentA,
      `${label} capacitor primitive ${index + 1} current observation is outside its bounded ideal regression window`,
    );
  }
  invariant(
    finiteNumber(value.maximumOutputNodeKclResidualA, `${label}.maximumOutputNodeKclResidualA`) <= spec.maximumOutputNodeKclResidualA,
    `${label} output-node KCL residual exceeds the contract`,
  );
  invariant(
    finiteNumber(value.maximumLoadRelationResidualA, `${label}.maximumLoadRelationResidualA`) <= spec.maximumLoadRelationResidualA,
    `${label} load-relation residual exceeds the contract`,
  );
  invariant(value.operatingConditionsWithinReviewedEvidence === false, `${label} must remain outside reviewed operating conditions`);
  invariant(value.physicalWaveformFidelityProved === false, `${label} must not claim physical waveform fidelity`);
}

export function validateSelectedPassiveExecutionReport(report, contract, contractContentHash) {
  validateSelectedPassiveContract(contract);
  exactKeys(report, ["format", "schemaVersion", "contractContentHash", "evidenceBoundary", "case", "pass"], "selected-passive execution report");
  invariant(
    report.format === "opencircuit-selected-passive-application-golden-report" && report.schemaVersion === 2,
    "Unsupported selected-passive execution report",
  );
  invariant(report.contractContentHash === contractContentHash, "Selected-passive execution report contract hash drifted");
  invariant(JSON.stringify(report.evidenceBoundary) === JSON.stringify(contract.evidenceBoundary), "Selected-passive execution report evidence boundary drifted");
  invariant(report.pass === true, "Selected-passive execution report did not pass");

  const result = report.case;
  exactKeys(result, [
    "id", "application", "presetId", "candidateId", "recipe", "requestHash", "resultContentHash",
    "strictGeneration", "constraintPolicy", "constraintDecisionContentHash", "observationCounts",
    "observationCandidateCount", "eligibleCandidateCount", "library", "scenarioId", "scenarioHash", "serializationHash", "analysis", "modelTier",
    "attestation", "productionProfileBindings", "primaryBinding", "engineIdentity",
    "netlistContentHash", "sampleContentHash", "receiptContentHash", "repeatableBrowserReceipt",
    "selectedVectors", "fullVectorComparisonPass", "fullVectorComparisonIsReleaseGate", "relation",
    "native", "browserWasm", "crossEngineAbsoluteInductorCurrentRelativeDifference",
    "operatingConditionsWithinReviewedEvidence", "physicalWaveformFidelityProved", "pass",
  ], "selected-passive execution report case");
  for (const key of [
    "id", "application", "presetId", "candidateId", "requestHash", "resultContentHash", "scenarioId",
    "scenarioHash", "serializationHash", "analysis", "netlistContentHash",
  ]) {
    invariant(result[key] === contract.case[key], `Selected-passive execution report ${key} drifted`);
  }
  invariant(JSON.stringify(result.recipe) === JSON.stringify(contract.case.recipe), "Selected-passive execution report recipe drifted");
  invariant(JSON.stringify(result.strictGeneration) === JSON.stringify(contract.case.strictGeneration), "Selected-passive execution report strict generation drifted");
  invariant(JSON.stringify(result.constraintPolicy) === JSON.stringify(contract.case.constraintPolicy), "Selected-passive execution report policy drifted");
  invariant(result.constraintDecisionContentHash === contract.case.constraintDecisionContentHash, "Selected-passive execution report decision drifted");
  invariant(JSON.stringify(result.observationCounts) === JSON.stringify(contract.case.observationCounts), "Selected-passive execution report observation counts drifted");
  invariant(result.observationCandidateCount === 1 && result.eligibleCandidateCount === 0, "Selected-passive execution report eligibility counts drifted");
  invariant(JSON.stringify(result.library) === JSON.stringify(contract.case.library), "Selected-passive execution report library drifted");
  invariant(JSON.stringify(result.productionProfileBindings) === JSON.stringify(contract.case.selectedBindings), "Selected-passive execution report profile bindings drifted");
  invariant(JSON.stringify(result.primaryBinding) === JSON.stringify(contract.case.primaryBinding), "Selected-passive execution report primary binding drifted");
  exactKeys(result.engineIdentity, ["id", "buildVersion", "simulatorVersion", "solver", "numericFormat"], "selected-passive execution engine identity");
  invariant(result.engineIdentity.id === "@opencircuit/ngspice-wasm", "Selected-passive execution engine id drifted");
  invariant(result.engineIdentity.buildVersion === contract.engines.browserWasm.engineVersion, "Selected-passive execution engine build drifted");
  invariant(result.engineIdentity.simulatorVersion === contract.engines.browserWasm.simulatorVersion, "Selected-passive execution simulator version drifted");
  invariant(result.engineIdentity.solver === contract.engines.browserWasm.solver, "Selected-passive execution solver drifted");
  invariant(result.engineIdentity.numericFormat === "ieee754-binary64", "Selected-passive execution numeric format drifted");
  invariant(HASH.test(result.sampleContentHash) && HASH.test(result.receiptContentHash), "Selected-passive execution hashes are invalid");
  invariant(result.modelTier === "behavioral" && result.attestation === "none", "Selected-passive execution claim boundary drifted");
  invariant(result.repeatableBrowserReceipt === true, "Selected-passive execution browser receipt was not repeatable");
  invariant(result.fullVectorComparisonPass === true && result.fullVectorComparisonIsReleaseGate === false, "Selected-passive full-vector boundary drifted");
  invariant(result.relation === SELECTED_PASSIVE_RELATION, "Selected-passive relation drifted");
  invariant(Array.isArray(result.selectedVectors) && result.selectedVectors.length === contract.case.selectedVectors.length, "Selected-passive execution vector set drifted");
  for (const [index, vectorResult] of result.selectedVectors.entries()) {
    exactKeys(vectorResult, ["name", "metric", "maxAbsError", "maxRelativeError"], `selected-passive execution vector ${index}`);
    invariant(vectorResult.name === contract.case.selectedVectors[index], `Selected-passive execution vector ${index} drifted`);
    invariant(vectorResult.metric === "full-scale", `Selected-passive execution vector ${index} metric drifted`);
    invariant(finiteNumber(vectorResult.maxAbsError, `selected-passive execution vector ${index}.maxAbsError`) >= 0, `Selected-passive execution vector ${index} absolute error is negative`);
    const maxRelativeError = finiteNumber(vectorResult.maxRelativeError, `selected-passive execution vector ${index}.maxRelativeError`);
    invariant(
      maxRelativeError >= 0 && maxRelativeError <= SELECTED_VECTOR_MAX_RELATIVE_ERROR,
      `Selected-passive execution vector ${index} exceeded the transient relative tolerance`,
    );
  }
  validatePersistedMeasurements(result.native, contract.case.observationContract, "selected-passive native measurements");
  validatePersistedMeasurements(result.browserWasm, contract.case.observationContract, "selected-passive browser-WASM measurements");
  invariant(
    finiteNumber(result.crossEngineAbsoluteInductorCurrentRelativeDifference, "selected-passive cross-engine inductor-current difference")
      <= contract.case.observationContract.maximumCrossEngineAbsoluteInductorCurrentRelativeDifference,
    "Selected-passive cross-engine inductor-current difference exceeds the contract",
  );
  invariant(result.operatingConditionsWithinReviewedEvidence === false, "Selected-passive execution must remain outside reviewed operating conditions");
  invariant(result.physicalWaveformFidelityProved === false, "Selected-passive execution must not claim physical waveform fidelity");
  invariant(result.pass === true, "Selected-passive execution case did not pass");
  return report;
}

export function selectedPassiveExecutionIdentity(report) {
  const result = report.case;
  return {
    contractContentHash: report.contractContentHash,
    evidenceBoundary: report.evidenceBoundary,
    id: result.id,
    application: result.application,
    presetId: result.presetId,
    candidateId: result.candidateId,
    recipe: result.recipe,
    requestHash: result.requestHash,
    resultContentHash: result.resultContentHash,
    strictGeneration: result.strictGeneration,
    constraintPolicy: result.constraintPolicy,
    constraintDecisionContentHash: result.constraintDecisionContentHash,
    observationCounts: result.observationCounts,
    observationCandidateCount: result.observationCandidateCount,
    eligibleCandidateCount: result.eligibleCandidateCount,
    library: result.library,
    scenarioId: result.scenarioId,
    scenarioHash: result.scenarioHash,
    serializationHash: result.serializationHash,
    analysis: result.analysis,
    modelTier: result.modelTier,
    attestation: result.attestation,
    productionProfileBindings: result.productionProfileBindings,
    primaryBinding: result.primaryBinding,
    engineIdentity: result.engineIdentity,
    netlistContentHash: result.netlistContentHash,
    sampleContentHash: result.sampleContentHash,
    receiptContentHash: result.receiptContentHash,
    repeatableBrowserReceipt: result.repeatableBrowserReceipt,
    selectedVectorNames: result.selectedVectors.map((entry) => entry.name),
    fullVectorComparisonPass: result.fullVectorComparisonPass,
    fullVectorComparisonIsReleaseGate: result.fullVectorComparisonIsReleaseGate,
    relation: result.relation,
    browserWasm: result.browserWasm,
    operatingConditionsWithinReviewedEvidence: result.operatingConditionsWithinReviewedEvidence,
    physicalWaveformFidelityProved: result.physicalWaveformFidelityProved,
    casePass: result.pass,
    reportPass: report.pass,
  };
}

async function verifyPersistedExecutionReport(freshReport, contract, contractContentHash, reportPath) {
  const persistedText = await readFile(reportPath, "utf8");
  let persisted;
  try {
    persisted = JSON.parse(persistedText);
  } catch (error) {
    throw new Error(`Persisted selected-passive execution report is not JSON: ${error.message}`);
  }
  invariant(
    persistedText === `${JSON.stringify(persisted, null, 2)}\n`,
    "Persisted selected-passive execution report is not canonical pretty JSON",
  );
  validateSelectedPassiveExecutionReport(persisted, contract, contractContentHash);
  invariant(
    JSON.stringify(selectedPassiveExecutionIdentity(persisted))
      === JSON.stringify(selectedPassiveExecutionIdentity(freshReport)),
    "Persisted selected-passive execution identity does not match the fresh native/browser-WASM run",
  );
  return {
    path: reportPath,
    contentHash: sha256(persistedText),
  };
}

function measurements(rawfile, spec, engine) {
  const time = vector(rawfile, "time");
  const input = vector(rawfile, spec.inputVector);
  const output = vector(rawfile, spec.outputVector);
  const inductorCurrent = vector(rawfile, spec.inductorCurrentVector);
  const capacitorCurrents = spec.capacitorCurrentVectors.map((name) => vector(rawfile, name));
  const loadCurrent = vector(rawfile, spec.loadCurrentVector);
  const sampleCount = time.length;
  invariant(
    [input, output, inductorCurrent, ...capacitorCurrents, loadCurrent].every((values) => values.length === sampleCount),
    `${engine} selected-passive observation vector lengths differ`,
  );
  invariant(sampleCount >= spec.minimumSampleCount, `${engine} selected-passive observation has too few samples`);

  const outputSpanV = Math.max(...output) - Math.min(...output);
  const maximumAbsoluteInductorCurrentA = maximumAbsolute(inductorCurrent);
  const maximumAbsoluteCapacitorCurrentsA = capacitorCurrents.map(maximumAbsolute);
  const maximumOutputNodeKclResidualA = Math.max(...inductorCurrent.map((value, index) =>
    Math.abs(value - capacitorCurrents.reduce((total, values) => total + values[index], 0) - loadCurrent[index])));
  const maximumLoadRelationResidualA = Math.max(...loadCurrent.map((value, index) =>
    Math.abs(value - output[index] / spec.behavioralLoadResistanceOhm)));

  invariant(outputSpanV >= spec.minimumOutputSpanV, `${engine} ideal nominal output span is vacuous`);
  invariant(maximumOutputNodeKclResidualA <= spec.maximumOutputNodeKclResidualA, `${engine} ideal nominal output-node KCL relation exceeded tolerance`);
  invariant(maximumLoadRelationResidualA <= spec.maximumLoadRelationResidualA, `${engine} ideal nominal load relation exceeded tolerance`);
  invariant(
    maximumAbsoluteInductorCurrentA >= spec.minimumAbsoluteInductorCurrentA
      && maximumAbsoluteInductorCurrentA <= spec.maximumAbsoluteInductorCurrentA,
    `${engine} ideal nominal inductor-current projection drifted outside its bounded regression window`,
  );
  invariant(
    maximumAbsoluteCapacitorCurrentsA.every((value) => (
      value >= spec.minimumAbsoluteCapacitorCurrentA
      && value <= spec.maximumAbsoluteCapacitorCurrentA
    )),
    `${engine} capacitor primitive current projection drifted outside its bounded ideal regression window`,
  );

  return {
    sampleCount,
    inputSpanV: Math.max(...input) - Math.min(...input),
    outputSpanV,
    maximumAbsoluteInductorCurrentA,
    maximumAbsoluteCapacitorCurrentsA,
    maximumOutputNodeKclResidualA,
    maximumLoadRelationResidualA,
    operatingConditionsWithinReviewedEvidence: false,
    physicalWaveformFidelityProved: false,
  };
}

export function validateSelectedPassiveContract(contract) {
  exactKeys(contract, ["format", "schemaVersion", "engines", "evidenceBoundary", "case"], "selected-passive golden contract");
  invariant(
    contract.format === "opencircuit-selected-passive-application-golden-contract" && contract.schemaVersion === 2,
    "Unsupported selected-passive application golden contract",
  );
  exactKeys(contract.engines, ["native", "browserWasm"], "selected-passive engines");
  exactKeys(contract.engines.native, ["version", "solverClaim"], "selected-passive native engine");
  exactKeys(contract.engines.browserWasm, ["module", "engineVersion", "simulatorVersion", "solver"], "selected-passive browser-WASM engine");
  invariant(contract.engines.native.solverClaim === "unverified", "Selected-passive native solver must remain unclaimed");
  exactKeys(contract.evidenceBoundary, [
    "modelTier", "attestation", "productionProfilesUsed", "primitiveValueBasis",
    "productionConstraintEligibility", "currentProductionIdentity", "selectedSemiconductorModelsUsed", "claim",
    "operatingConditionsWithinReviewedEvidence", "authority", "purpose", "doesNotProve",
  ], "selected-passive evidence boundary");
  invariant(contract.evidenceBoundary.modelTier === "behavioral", "Selected-passive scenario must stay behavioral");
  invariant(contract.evidenceBoundary.attestation === "none", "Selected-passive receipts must stay unattested");
  invariant(contract.evidenceBoundary.productionProfilesUsed === true, "Selected-passive contract must bind production profiles");
  invariant(contract.evidenceBoundary.primitiveValueBasis === "reviewed_nominal_only", "Selected-passive primitive value basis drifted");
  invariant(contract.evidenceBoundary.productionConstraintEligibility === false, "Selected-passive contract must not authorize production constraint eligibility");
  invariant(contract.evidenceBoundary.currentProductionIdentity === true, "Selected-passive contract must bind current production identity");
  invariant(contract.evidenceBoundary.selectedSemiconductorModelsUsed === false, "Selected-passive contract must not claim a selected semiconductor model");
  invariant(contract.evidenceBoundary.operatingConditionsWithinReviewedEvidence === false, "Selected-passive operating-condition boundary must stay false");
  exactKeys(contract.evidenceBoundary.authority, Object.keys(SELECTED_PASSIVE_AUTHORITIES), "selected-passive evidence authority");
  invariant(
    JSON.stringify(contract.evidenceBoundary.authority) === JSON.stringify(SELECTED_PASSIVE_AUTHORITIES),
    "Selected-passive unavailable-authority boundary drifted",
  );
  invariant(contract.evidenceBoundary.claim === SELECTED_PASSIVE_CLAIM, "Selected-passive claim boundary drifted");
  invariant(contract.evidenceBoundary.purpose === SELECTED_PASSIVE_PURPOSE, "Selected-passive purpose boundary drifted");
  invariant(
    JSON.stringify(contract.evidenceBoundary.doesNotProve) === JSON.stringify(SELECTED_PASSIVE_EXCLUSIONS),
    "Selected-passive claim exclusions drifted",
  );

  const testCase = contract.case;
  exactKeys(testCase, [
    "id", "application", "presetId", "candidateId", "recipe", "requestHash",
    "resultContentHash", "strictGeneration", "constraintPolicy", "constraintDecisionContentHash",
    "observationCounts", "observationCandidateCount", "eligibleCandidateCount",
    "library", "scenarioId", "scenarioHash", "serializationHash",
    "analysis", "fixture", "netlistContentHash", "selectedVectors", "selectedBindings",
    "primaryBinding", "observationContract",
  ], "selected-passive case");
  exactKeys(testCase.recipe, ["id", "version", "contentHash"], "selected-passive recipe");
  exactKeys(testCase.strictGeneration, [
    "requestHash", "resultContentHash", "retainedCandidateCount", "rejectedCandidateId",
    "rejectionReasonCode", "counts",
  ], "selected-passive strict generation");
  exactKeys(testCase.constraintPolicy, ["id", "contentHash"], "selected-passive constraint policy");
  exactKeys(testCase.library, ["version", "contextManifestContentHash", "catalogContentHash", "sourceReleaseContentHash"], "selected-passive library");
  validateGenerationCounts(testCase.strictGeneration.counts, "selected-passive strict generation counts");
  validateGenerationCounts(testCase.observationCounts, "selected-passive observation counts");
  exactKeys(testCase.primaryBinding, [
    "selectedComponentId", "circuitComponentId", "manufacturerPartNumber",
    "classification", "executableSelectedPartModel",
  ], "selected-passive primary binding");
  invariant(testCase.analysis === "tran", "Selected-passive golden requires a transient analysis");
  invariant(testCase.strictGeneration.retainedCandidateCount === 0, "Selected-passive strict generation must retain zero candidates");
  invariant(CANDIDATE_ID.test(testCase.candidateId) && CANDIDATE_ID.test(testCase.strictGeneration.rejectedCandidateId), "Selected-passive candidate identity is invalid");
  invariant(testCase.strictGeneration.rejectionReasonCode === "unknown_constraint_disallowed", "Selected-passive strict generation reason drifted");
  invariant(testCase.strictGeneration.counts.rejected === 1 && testCase.strictGeneration.counts.materialized === 0, "Selected-passive strict generation count boundary drifted");
  invariant(testCase.observationCounts.rejected === 0 && testCase.observationCounts.materialized === 1, "Selected-passive observation count boundary drifted");
  invariant(testCase.constraintPolicy.id === "production_strict_v1", "Selected-passive installed policy id drifted");
  invariant(testCase.observationCandidateCount === 1 && testCase.eligibleCandidateCount === 0, "Selected-passive observation must bind one ineligible candidate");
  for (const contentHash of [
    testCase.requestHash, testCase.resultContentHash, testCase.strictGeneration.requestHash,
    testCase.strictGeneration.resultContentHash, testCase.constraintPolicy.contentHash,
    testCase.constraintDecisionContentHash, testCase.library.contextManifestContentHash,
    testCase.library.catalogContentHash, testCase.library.sourceReleaseContentHash,
  ]) invariant(HASH.test(contentHash), "Selected-passive production identity hash is invalid");
  invariant(testCase.primaryBinding.classification === "behavioral" && testCase.primaryBinding.executableSelectedPartModel === false, "Selected-passive primary boundary drifted");
  invariant(Array.isArray(testCase.selectedBindings) && testCase.selectedBindings.length === 3, "Selected-passive golden requires exactly three physical-instance bindings");
  for (const binding of testCase.selectedBindings) {
    exactKeys(binding, [
      "selectedComponentId", "assemblyComponentId", "circuitComponentId", "physicalInstanceOrdinal",
      "selectedLineQuantityPerAssembly", "representedQuantityPerAssembly", "classification", "profileId",
      "profileContentHash", "manufacturerId", "manufacturerPartNumber", "nominalValue",
      "nominalEvidenceContentHash", "representation", "reviewedOperatingConditionStatus",
    ], `selected-passive binding ${binding?.selectedComponentId ?? "unknown"}`);
    exactKeys(binding.nominalValue, ["value", "unit"], `selected-passive value ${binding.selectedComponentId}`);
    invariant(binding.classification === "physical", `${binding.selectedComponentId} must remain a physical binding`);
    invariant(Number.isSafeInteger(binding.physicalInstanceOrdinal) && binding.physicalInstanceOrdinal > 0, `${binding.circuitComponentId} physical-instance ordinal is invalid`);
    invariant(Number.isSafeInteger(binding.selectedLineQuantityPerAssembly) && binding.selectedLineQuantityPerAssembly > 0, `${binding.circuitComponentId} selected-line quantity is invalid`);
    invariant(binding.representedQuantityPerAssembly === 1, `${binding.circuitComponentId} must bind one explicit physical instance`);
    invariant(binding.assemblyComponentId === binding.circuitComponentId, `${binding.circuitComponentId} assembly/behavioral instance identity drifted`);
    invariant(HASH.test(binding.profileContentHash) && HASH.test(binding.nominalEvidenceContentHash), `${binding.selectedComponentId} content hash is invalid`);
    invariant(binding.reviewedOperatingConditionStatus !== "within", `${binding.selectedComponentId} must not claim reviewed operating-condition coverage`);
  }
  invariant(
    JSON.stringify(testCase.selectedBindings.map((entry) => [
      entry.selectedComponentId,
      entry.circuitComponentId,
      entry.physicalInstanceOrdinal,
      entry.selectedLineQuantityPerAssembly,
    ])) === JSON.stringify([
      ["output-capacitor", "output-capacitor-1", 1, 2],
      ["output-capacitor", "output-capacitor-2", 2, 2],
      ["power-inductor", "power-inductor", 1, 1],
    ]),
    "Selected-passive physical-instance binding set or order drifted",
  );
  invariant(
    JSON.stringify(testCase.selectedBindings) === JSON.stringify(SELECTED_PASSIVE_BINDING_IDENTITIES),
    "Selected-passive exact reviewed profile/physical-instance bindings drifted",
  );
  for (const selectedComponentId of ["output-capacitor", "power-inductor"]) {
    const bindings = testCase.selectedBindings.filter((entry) => entry.selectedComponentId === selectedComponentId);
    invariant(
      bindings.reduce((total, entry) => total + entry.representedQuantityPerAssembly, 0)
        === bindings[0]?.selectedLineQuantityPerAssembly,
      `Selected-passive ${selectedComponentId} bindings do not cover the exact selected BOM quantity`,
    );
  }
  invariant(Array.isArray(testCase.selectedVectors) && testCase.selectedVectors.length === 6, "Selected-passive vector set drifted");
  invariant(JSON.stringify(testCase.selectedVectors) === JSON.stringify(SELECTED_PASSIVE_VECTORS), "Selected-passive exact vector set or order drifted");
  invariant(HASH.test(testCase.netlistContentHash), "Selected-passive netlist hash is invalid");

  const spec = testCase.observationContract;
  exactKeys(spec, [
    "kind", "inputVector", "outputVector", "inductorCurrentVector", "capacitorCurrentVectors",
    "loadCurrentVector", "behavioralLoadResistanceOhm", "minimumSampleCount",
    "minimumOutputSpanV", "maximumOutputNodeKclResidualA", "maximumLoadRelationResidualA",
    "minimumAbsoluteInductorCurrentA", "maximumAbsoluteInductorCurrentA",
    "minimumAbsoluteCapacitorCurrentA", "maximumAbsoluteCapacitorCurrentA",
    "maximumCrossEngineAbsoluteInductorCurrentRelativeDifference", "productionSwitchingFrequencyMinimumHz",
    "scenarioSwitchingFrequencyHz", "reviewedNominalInductanceTestFrequencyHz", "reviewedNominalInductanceTestVoltageVrms",
    "reviewedNominalCapacitanceTestFrequencyMinimumHz", "reviewedNominalCapacitanceTestFrequencyMaximumHz",
    "reviewedNominalCapacitanceTestVoltageMinimumVrms", "reviewedNominalCapacitanceTestVoltageMaximumVrms",
    "capacitorPrimitiveCount", "capacitorNominalValuePerPrimitiveF", "interpretation",
  ], "selected-passive observation contract");
  invariant(spec.kind === "ideal-nominal-output-node-kcl-outside-reviewed-conditions", "Selected-passive observation kind drifted");
  invariant(spec.interpretation === "mathematical_projection_outside_reviewed_conditions", "Selected-passive observation interpretation drifted");
  invariant(
    Array.isArray(spec.capacitorCurrentVectors)
      && spec.capacitorCurrentVectors.length === 2
      && new Set(spec.capacitorCurrentVectors).size === 2,
    "Selected-passive observation must retain two distinct capacitor-current vectors",
  );
  invariant(
    JSON.stringify(spec.capacitorCurrentVectors) === JSON.stringify(SELECTED_PASSIVE_CAPACITOR_CURRENT_VECTORS),
    "Selected-passive exact capacitor-current vector set or order drifted",
  );
  invariant(spec.inductorCurrentVector === SELECTED_PASSIVE_VECTORS[2], "Selected-passive inductor-current vector drifted");
  invariant(spec.loadCurrentVector === SELECTED_PASSIVE_VECTORS[3], "Selected-passive load-current vector drifted");
  invariant(spec.inputVector === SELECTED_PASSIVE_VECTORS[4] && spec.outputVector === SELECTED_PASSIVE_VECTORS[5], "Selected-passive voltage vectors drifted");
  invariant(spec.capacitorPrimitiveCount === 2, "Selected-passive observation must retain exactly two capacitor primitives");
  invariant(spec.capacitorNominalValuePerPrimitiveF === 0.000022, "Selected-passive per-primitive capacitor value drifted");
  invariant(
    spec.minimumAbsoluteCapacitorCurrentA > 0
      && spec.minimumAbsoluteCapacitorCurrentA <= spec.maximumAbsoluteCapacitorCurrentA,
    "Selected-passive ideal capacitor-current regression bounds are invalid",
  );
  invariant(spec.reviewedNominalInductanceTestFrequencyHz < spec.productionSwitchingFrequencyMinimumHz, "Selected-passive production minimum must stay outside the reviewed nominal-inductance test frequency");
  invariant(spec.reviewedNominalInductanceTestFrequencyHz < spec.scenarioSwitchingFrequencyHz, "Selected-passive scenario must stay outside the reviewed nominal-inductance test frequency");
  invariant(spec.reviewedNominalInductanceTestVoltageVrms > 0, "Selected-passive reviewed inductance test voltage must be positive");
  invariant(spec.reviewedNominalCapacitanceTestFrequencyMaximumHz < spec.productionSwitchingFrequencyMinimumHz, "Selected-passive production minimum must stay outside the reviewed nominal-capacitance test frequency");
  invariant(spec.reviewedNominalCapacitanceTestFrequencyMaximumHz < spec.scenarioSwitchingFrequencyHz, "Selected-passive scenario must stay outside the reviewed nominal-capacitance test frequency");
  invariant(
    spec.reviewedNominalCapacitanceTestFrequencyMinimumHz > 0
      && spec.reviewedNominalCapacitanceTestFrequencyMinimumHz <= spec.reviewedNominalCapacitanceTestFrequencyMaximumHz
      && spec.reviewedNominalCapacitanceTestVoltageMinimumVrms > 0
      && spec.reviewedNominalCapacitanceTestVoltageMinimumVrms <= spec.reviewedNominalCapacitanceTestVoltageMaximumVrms,
    "Selected-passive reviewed nominal-capacitance conditions are invalid",
  );
  return testCase;
}

async function runCase(testCase, contract, browserWorker) {
  const netlistPath = resolve(HERE, "selected-passive-application-golden", testCase.fixture);
  const netlist = await readFile(netlistPath, "utf8");
  invariant(sha256(netlist) === testCase.netlistContentHash, "Selected-passive exact netlist bytes drifted");
  invariant(netlist.startsWith(`scheMAGIC Simulator scenario ${testCase.scenarioHash}\n* scenario-hash ${testCase.scenarioHash}\n`), "Selected-passive scenario identity is not embedded in its netlist");

  const browserModule = new URL(contract.engines.browserWasm.module, pathToFileURL(CONTRACT_PATH)).href;
  const [native, firstWasm] = await Promise.all([
    runNative({ netlist, timeoutMs: 30_000 }),
    browserWorker.run(netlist, "runTransient", browserModule),
  ]);
  const secondWasm = await browserWorker.run(netlist, "runTransient", browserModule);
  invariant(native.version === contract.engines.native.version, "Selected-passive native engine version drifted");
  invariant(firstWasm.version === contract.engines.browserWasm.engineVersion, "Selected-passive browser-WASM engine version drifted");
  invariant(firstWasm.ngspiceVersion === contract.engines.browserWasm.simulatorVersion, "Selected-passive browser-WASM simulator version drifted");

  const comparison = compareRawfiles(native.rawfile, firstWasm.rawfile, { analysis: "tran" });
  const selectedVectors = selectedComparison(comparison, testCase.selectedVectors);
  const nativeMeasurements = measurements(native.rawfile, testCase.observationContract, "native");
  const wasmMeasurements = measurements(firstWasm.rawfile, testCase.observationContract, "browser-WASM");
  const crossEngineAbsoluteInductorCurrentRelativeDifference = relativeDifference(
    nativeMeasurements.maximumAbsoluteInductorCurrentA,
    wasmMeasurements.maximumAbsoluteInductorCurrentA,
  );
  invariant(
    crossEngineAbsoluteInductorCurrentRelativeDifference
      <= testCase.observationContract.maximumCrossEngineAbsoluteInductorCurrentRelativeDifference,
    "Selected-passive inductor-current projection differed across engines",
  );

  const firstReceipt = firstWasm.receipt;
  const secondReceipt = secondWasm.receipt;
  invariant(firstReceipt.attestation === "none", "Selected-passive receipt attestation boundary drifted");
  invariant(firstReceipt.executionHost === "local_worker", "Selected-passive receipt was not minted by the local worker");
  invariant(JSON.stringify(firstReceipt.engine) === JSON.stringify(firstWasm.engineIdentity), "Selected-passive receipt engine identity drifted");
  invariant(JSON.stringify(firstReceipt) === JSON.stringify(secondReceipt), "Selected-passive browser-WASM receipt was not repeatable");
  invariant(firstWasm.receiptVerificationIssues.length === 0, `Selected-passive first receipt verification failed: ${firstWasm.receiptVerificationIssues.join(", ")}`);
  invariant(secondWasm.receiptVerificationIssues.length === 0, `Selected-passive repeated receipt verification failed: ${secondWasm.receiptVerificationIssues.join(", ")}`);
  invariant(firstReceipt.netlistContentHash === testCase.netlistContentHash, "Selected-passive receipt did not bind the exact golden netlist");

  return {
    id: testCase.id,
    application: testCase.application,
    presetId: testCase.presetId,
    candidateId: testCase.candidateId,
    recipe: testCase.recipe,
    requestHash: testCase.requestHash,
    resultContentHash: testCase.resultContentHash,
    strictGeneration: testCase.strictGeneration,
    constraintPolicy: testCase.constraintPolicy,
    constraintDecisionContentHash: testCase.constraintDecisionContentHash,
    observationCounts: testCase.observationCounts,
    observationCandidateCount: testCase.observationCandidateCount,
    eligibleCandidateCount: testCase.eligibleCandidateCount,
    library: testCase.library,
    scenarioId: testCase.scenarioId,
    scenarioHash: testCase.scenarioHash,
    serializationHash: testCase.serializationHash,
    analysis: testCase.analysis,
    modelTier: "behavioral",
    attestation: firstReceipt.attestation,
    productionProfileBindings: testCase.selectedBindings,
    primaryBinding: testCase.primaryBinding,
    engineIdentity: firstReceipt.engine,
    netlistContentHash: firstReceipt.netlistContentHash,
    sampleContentHash: firstReceipt.sampleContentHash,
    receiptContentHash: firstReceipt.contentHash,
    repeatableBrowserReceipt: true,
    selectedVectors,
    fullVectorComparisonPass: comparison.pass,
    fullVectorComparisonIsReleaseGate: false,
    relation: SELECTED_PASSIVE_RELATION,
    native: nativeMeasurements,
    browserWasm: wasmMeasurements,
    crossEngineAbsoluteInductorCurrentRelativeDifference,
    operatingConditionsWithinReviewedEvidence: false,
    physicalWaveformFidelityProved: false,
    pass: true,
  };
}

export async function runSelectedPassiveApplicationGolden() {
  const contractBytes = await readFile(CONTRACT_PATH, "utf8");
  const contract = JSON.parse(contractBytes);
  const testCase = validateSelectedPassiveContract(contract);
  const browserWorker = new BrowserWorkerHarness();
  let result;
  try {
    result = await runCase(testCase, contract, browserWorker);
  } catch (error) {
    throw new Error(`Selected-passive application golden execution failed; build @opencircuit/sim-engine first: ${error.message}`);
  } finally {
    await browserWorker.close();
  }
  const report = {
    format: "opencircuit-selected-passive-application-golden-report",
    schemaVersion: 2,
    contractContentHash: sha256(contractBytes),
    evidenceBoundary: contract.evidenceBoundary,
    case: result,
    pass: result.pass,
  };
  validateSelectedPassiveExecutionReport(report, contract, report.contractContentHash);
  return { report, contract, contractContentHash: report.contractContentHash };
}

async function main() {
  const args = process.argv.slice(2);
  invariant(
    args.length === 0 || (args.length === 1 && args[0] === "--verify-persisted-report"),
    "Usage: selected-passive-application-golden.mjs [--verify-persisted-report]",
  );
  const { report, contract, contractContentHash } = await runSelectedPassiveApplicationGolden();
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
