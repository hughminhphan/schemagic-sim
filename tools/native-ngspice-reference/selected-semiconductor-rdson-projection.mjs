#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserWorkerHarness, selectedComparison } from "./application-golden.mjs";
import { compareRawfiles } from "./lib/compare-results.mjs";
import { runNative } from "./lib/run-native.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = resolve(HERE, "selected-semiconductor-rdson-projection/contract.json");
const EXECUTION_REPORT_PATH = resolve(HERE, "selected-semiconductor-rdson-projection/execution-report.json");
const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;
const CLAIM = "An ideal reviewed-RDS(on) projection binds four selected CSD18540Q5B identities to four independent 2.2 mOhm resistors at the reviewed 25 C, 10 V gate-condition, 28 A table point.";
const PURPOSE = "Deterministic current-production identity, exact reviewed resistance evidence, ideal-resistor netlist, execution-receipt, and native/browser-WASM 61.6 mV voltage-drop parity only.";
const EXCLUSIONS = Object.freeze([
  "transistor-equation or selected-part SPICE fidelity",
  "switching, transient, gate charge, Miller, reverse recovery, body-diode, avalanche, SOA, thermal, self-heating, package, or parasitic behavior",
  "the 40 C, 5 A load, 20 A stall, 18-30 V, 20 kHz, 80%-duty production request",
  "gate-driver, TVS, motor, capacitor, shunt, pull-down, bulk, local-decoupling, bootstrap, or full-BOM behavior",
  "candidate eligibility, ranking, safety, provider approval, commercial availability, or release readiness",
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
    "sampleCount", "instanceCount", "voltageDropsV", "apparentResistanceOhm",
    "maximumVoltageDropAbsoluteErrorV", "maximumInstanceSpreadV",
    "conditionsBoundToReviewedProfile", "selectedPartDeviceEquationUsed", "physicalFidelityProved",
  ], label);
  invariant(value.sampleCount === 1, `${label} must contain one operating-point sample`);
  invariant(value.instanceCount === spec.instanceCount, `${label} instance count drifted`);
  invariant(Array.isArray(value.voltageDropsV) && value.voltageDropsV.length === spec.instanceCount, `${label} voltage-drop set drifted`);
  invariant(Array.isArray(value.apparentResistanceOhm) && value.apparentResistanceOhm.length === spec.instanceCount, `${label} apparent-resistance set drifted`);
  for (const [index, voltageDrop] of value.voltageDropsV.entries()) {
    invariant(finiteNumber(voltageDrop, `${label}.voltageDropsV[${index}]`) > 0, `${label} voltage drop must be positive`);
    invariant(
      Math.abs(voltageDrop - spec.expectedVoltageDropV) <= spec.maximumVoltageDropAbsoluteErrorV,
      `${label} ideal reviewed-RDS(on) voltage drop exceeded its bound`,
    );
    const apparentResistance = finiteNumber(value.apparentResistanceOhm[index], `${label}.apparentResistanceOhm[${index}]`);
    invariant(apparentResistance === voltageDrop / spec.forcedCurrentA, `${label} apparent resistance no longer matches V/I`);
    invariant(
      Math.abs(apparentResistance - spec.reviewedMaximumRdsOhm)
        <= spec.maximumVoltageDropAbsoluteErrorV / spec.forcedCurrentA,
      `${label} apparent resistance drifted from the reviewed maximum`,
    );
  }
  const expectedMaximumError = Math.max(...value.voltageDropsV.map((entry) => Math.abs(entry - spec.expectedVoltageDropV)));
  invariant(value.maximumVoltageDropAbsoluteErrorV === expectedMaximumError, `${label} maximum voltage-drop error drifted`);
  const expectedSpread = Math.max(...value.voltageDropsV) - Math.min(...value.voltageDropsV);
  invariant(value.maximumInstanceSpreadV === expectedSpread, `${label} instance spread drifted`);
  invariant(value.maximumInstanceSpreadV <= spec.maximumInstanceSpreadV, `${label} instance spread exceeded its bound`);
  invariant(value.conditionsBoundToReviewedProfile === true, `${label} must retain the reviewed-condition binding`);
  invariant(value.selectedPartDeviceEquationUsed === false, `${label} must remain an ideal-resistor projection`);
  invariant(value.physicalFidelityProved === false, `${label} must not claim physical fidelity`);
}

export function validateSelectedSemiconductorRdsonProjectionContract(contract) {
  exactKeys(contract, ["format", "schemaVersion", "engines", "evidenceBoundary", "case"], "ideal reviewed-RDS(on) projection contract");
  invariant(
    contract.format === "opencircuit-selected-semiconductor-rdson-projection-contract" && contract.schemaVersion === 1,
    "Unsupported ideal reviewed-RDS(on) projection contract",
  );
  exactKeys(contract.engines, ["native", "browserWasm"], "projection engines");
  exactKeys(contract.engines.native, ["version", "solverClaim"], "projection native engine");
  exactKeys(contract.engines.browserWasm, ["module", "engineVersion", "simulatorVersion", "solver"], "projection browser-WASM engine");
  invariant(contract.engines.native.version === "ngspice-46" && contract.engines.native.solverClaim === "unverified", "Projection native engine boundary drifted");
  invariant(
    contract.engines.browserWasm.module === "../../ngspice-wasm-build/dist-loader/index.mjs"
      && contract.engines.browserWasm.engineVersion === "ngspice-46-opencircuit-wasm1"
      && contract.engines.browserWasm.simulatorVersion === "ngspice-46"
      && contract.engines.browserWasm.solver === "KLU",
    "Projection browser-WASM engine boundary drifted",
  );

  exactKeys(contract.evidenceBoundary, [
    "projectionKind", "attestation", "productionProfileUsed", "currentProductionObservationIdentity",
    "selectedPartDeviceEquationUsed", "physicalFidelityProved", "productionRequestConditionsEvaluated",
    "productionConstraintEligibility", "rankingAuthority", "fullBomCoverage", "claim", "purpose", "doesNotProve",
  ], "projection evidence boundary");
  invariant(contract.evidenceBoundary.projectionKind === "ideal_reviewed_maximum_rdson_resistors", "Projection kind drifted");
  invariant(contract.evidenceBoundary.attestation === "none", "Projection must stay unattested");
  invariant(contract.evidenceBoundary.productionProfileUsed === true, "Projection must bind the reviewed production profile");
  invariant(contract.evidenceBoundary.currentProductionObservationIdentity === true, "Projection must bind current production identity");
  for (const property of [
    "selectedPartDeviceEquationUsed", "physicalFidelityProved", "productionRequestConditionsEvaluated",
    "productionConstraintEligibility", "rankingAuthority", "fullBomCoverage",
  ]) invariant(contract.evidenceBoundary[property] === false, `Projection ${property} boundary drifted`);
  invariant(contract.evidenceBoundary.claim === CLAIM, "Projection claim drifted");
  invariant(contract.evidenceBoundary.purpose === PURPOSE, "Projection purpose drifted");
  invariant(JSON.stringify(contract.evidenceBoundary.doesNotProve) === JSON.stringify(EXCLUSIONS), "Projection exclusions drifted");

  const testCase = contract.case;
  exactKeys(testCase, [
    "id", "application", "presetId", "observationKind", "currentIdentity", "selectedBinding",
    "sourceBinding", "analysis", "fixture", "netlistContentHash", "selectedVectors", "projectionContract",
  ], "projection case");
  invariant(testCase.id === "motor.production.external-24v.csd18540q5b.ideal-reviewed-rdson-projection", "Projection case id drifted");
  invariant(testCase.application === "motor.brushed-dc" && testCase.presetId === "motor.external-24v", "Projection application identity drifted");
  invariant(testCase.observationKind === "production_constraint_observation", "Projection observation kind drifted");
  invariant(testCase.analysis === "op", "Projection must remain an operating-point analysis");
  invariant(testCase.fixture === "fixtures/csd18540q5b-four-ideal-rdson-resistors.cir", "Projection fixture path drifted");
  invariant(
    testCase.netlistContentHash === "sha256:5ce0b7c5825f1b2a38c40be1a61b632c34a0e36456f00a56afbd33bc70fb715b",
    "Projection netlist hash drifted",
  );
  invariant(JSON.stringify(testCase.selectedVectors) === JSON.stringify(["v(d1)", "v(d2)", "v(d3)", "v(d4)"]), "Projection selected vectors drifted");

  const identity = testCase.currentIdentity;
  exactKeys(identity, [
    "requestHash", "resultContentHash", "constraintDecisionContentHash", "candidateId", "candidateIndex",
    "candidateEligible", "recipe", "library",
  ], "projection current identity");
  exactKeys(identity.recipe, ["id", "version", "contentHash"], "projection recipe identity");
  exactKeys(identity.library, ["version", "contextManifestContentHash", "catalogReleaseContentHash"], "projection library identity");
  for (const contentHash of [
    identity.requestHash, identity.resultContentHash, identity.constraintDecisionContentHash,
    identity.recipe.contentHash, identity.library.contextManifestContentHash, identity.library.catalogReleaseContentHash,
  ]) invariant(HASH.test(contentHash), "Projection current identity hash is invalid");
  invariant(CANDIDATE_ID.test(identity.candidateId), "Projection candidate id is invalid");
  invariant(identity.requestHash === "sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f", "Projection request identity drifted");
  invariant(identity.resultContentHash === "sha256:6e3986d02348a5415bbc0c56d85c1899450551c0635fac258bd575b010be1be7", "Projection result identity drifted");
  invariant(identity.constraintDecisionContentHash === "sha256:ff525983f903d423d8cdb782176bf591d9990c9ffcf0fac4e404fbefb4f3ed59", "Projection decision identity drifted");
  invariant(identity.candidateId === "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed" && identity.candidateIndex === 0 && identity.candidateEligible === false, "Projection selected candidate identity drifted");
  invariant(
    identity.recipe.id === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"
      && identity.recipe.version === "3.1.7"
      && identity.recipe.contentHash === "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
    "Projection recipe identity drifted",
  );
  invariant(
    identity.library.version === "2026-08-27.2"
      && identity.library.contextManifestContentHash === "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38"
      && identity.library.catalogReleaseContentHash === "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    "Projection library identity drifted",
  );

  exactKeys(testCase.selectedBinding, [
    "selectedComponentId", "role", "profileId", "profileContentHash", "manufacturerId",
    "manufacturerPartNumber", "quantityPerAssembly", "catalogAdmissionState",
  ], "projection selected binding");
  invariant(
    testCase.selectedBinding.selectedComponentId === "mosfet"
      && testCase.selectedBinding.role === "bridge-n-channel-power-mosfet"
      && testCase.selectedBinding.profileId === "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json"
      && testCase.selectedBinding.profileContentHash === "sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8"
      && testCase.selectedBinding.manufacturerId === "texas-instruments"
      && testCase.selectedBinding.manufacturerPartNumber === "CSD18540Q5B"
      && testCase.selectedBinding.quantityPerAssembly === 4
      && testCase.selectedBinding.catalogAdmissionState === "reviewed",
    "Projection selected binding drifted",
  );
  exactKeys(testCase.sourceBinding, ["kind", "url", "revision", "contentHash", "locator"], "projection source binding");
  invariant(
    testCase.sourceBinding.kind === "manufacturer_datasheet"
      && testCase.sourceBinding.url === "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf"
      && testCase.sourceBinding.revision === "SLPS488B, revised April 2017; Package Option Addendum dated 10-Nov-2025"
      && testCase.sourceBinding.contentHash === "sha256:2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0"
      && /page 3.*2\.2 mOhm.*10 V.*28 A/u.test(testCase.sourceBinding.locator),
    "Projection source binding drifted",
  );

  const spec = testCase.projectionContract;
  exactKeys(spec, [
    "kind", "instanceCount", "temperatureC", "gateConditionVoltageV", "forcedCurrentA",
    "reviewedMaximumRdsOhm", "expectedVoltageDropV", "maximumVoltageDropAbsoluteErrorV",
    "maximumInstanceSpreadV", "maximumCrossEngineVoltageDropRelativeDifference", "interpretation",
  ], "projection numeric contract");
  invariant(
    spec.kind === "four-ideal-reviewed-maximum-rdson-resistors"
      && spec.instanceCount === 4
      && spec.temperatureC === 25
      && spec.gateConditionVoltageV === 10
      && spec.forcedCurrentA === 28
      && spec.reviewedMaximumRdsOhm === 0.0022
      && spec.expectedVoltageDropV === 0.0616
      && spec.expectedVoltageDropV === spec.forcedCurrentA * spec.reviewedMaximumRdsOhm
      && spec.maximumVoltageDropAbsoluteErrorV === 1e-9
      && spec.maximumInstanceSpreadV === 1e-12
      && spec.maximumCrossEngineVoltageDropRelativeDifference === 1e-6
      && spec.interpretation === "ideal_reviewed_rdson_projection_only",
    "Projection numeric contract drifted",
  );
  return testCase;
}

export function validateSelectedSemiconductorRdsonProjectionReport(report, contract, contractContentHash) {
  const testCase = validateSelectedSemiconductorRdsonProjectionContract(contract);
  exactKeys(report, ["format", "schemaVersion", "contractContentHash", "evidenceBoundary", "case", "pass"], "projection execution report");
  invariant(
    report.format === "opencircuit-selected-semiconductor-rdson-projection-report" && report.schemaVersion === 1,
    "Unsupported ideal reviewed-RDS(on) projection report",
  );
  invariant(report.contractContentHash === contractContentHash, "Projection report contract hash drifted");
  invariant(JSON.stringify(report.evidenceBoundary) === JSON.stringify(contract.evidenceBoundary), "Projection report evidence boundary drifted");
  invariant(report.pass === true, "Projection report did not pass");

  const result = report.case;
  exactKeys(result, [
    "id", "application", "presetId", "observationKind", "currentIdentity", "selectedBinding", "sourceBinding",
    "analysis", "projectionKind", "attestation", "engineIdentity", "netlistContentHash", "sampleContentHash",
    "receiptContentHash", "repeatableBrowserReceipt", "selectedVectors", "fullVectorComparisonPass",
    "fullVectorComparisonIsReleaseGate", "native", "browserWasm", "maximumCrossEngineVoltageDropRelativeDifference",
    "selectedPartDeviceEquationUsed", "physicalFidelityProved", "productionRequestConditionsEvaluated",
    "productionConstraintEligibility", "rankingAuthority", "fullBomCoverage", "pass",
  ], "projection execution case");
  for (const key of ["id", "application", "presetId", "observationKind", "analysis"]) {
    invariant(result[key] === testCase[key], `Projection report ${key} drifted`);
  }
  invariant(JSON.stringify(result.currentIdentity) === JSON.stringify(testCase.currentIdentity), "Projection report current identity drifted");
  invariant(JSON.stringify(result.selectedBinding) === JSON.stringify(testCase.selectedBinding), "Projection report selected binding drifted");
  invariant(JSON.stringify(result.sourceBinding) === JSON.stringify(testCase.sourceBinding), "Projection report source binding drifted");
  invariant(result.projectionKind === contract.evidenceBoundary.projectionKind, "Projection report kind drifted");
  invariant(result.attestation === "none", "Projection report must remain unattested");
  exactKeys(result.engineIdentity, ["id", "buildVersion", "simulatorVersion", "solver", "numericFormat"], "projection engine identity");
  invariant(
    result.engineIdentity.id === "@opencircuit/ngspice-wasm"
      && result.engineIdentity.buildVersion === contract.engines.browserWasm.engineVersion
      && result.engineIdentity.simulatorVersion === contract.engines.browserWasm.simulatorVersion
      && result.engineIdentity.solver === contract.engines.browserWasm.solver
      && result.engineIdentity.numericFormat === "ieee754-binary64",
    "Projection report browser-WASM engine identity drifted",
  );
  invariant(result.netlistContentHash === testCase.netlistContentHash, "Projection report netlist hash drifted");
  invariant(HASH.test(result.sampleContentHash) && HASH.test(result.receiptContentHash), "Projection report execution hashes are invalid");
  invariant(result.repeatableBrowserReceipt === true, "Projection browser receipt was not repeatable");
  invariant(Array.isArray(result.selectedVectors) && result.selectedVectors.length === testCase.selectedVectors.length, "Projection selected-vector report drifted");
  for (const [index, entry] of result.selectedVectors.entries()) {
    exactKeys(entry, ["name", "metric", "maxAbsError", "maxRelativeError", "nativeValue", "browserWasmValue"], `projection selected vector ${index}`);
    invariant(entry.name === testCase.selectedVectors[index] && entry.metric === "point-relative", `Projection selected vector ${index} identity drifted`);
    invariant(finiteNumber(entry.maxAbsError, `projection selected vector ${index} maxAbsError`) >= 0, "Projection selected-vector absolute error is invalid");
    invariant(finiteNumber(entry.maxRelativeError, `projection selected vector ${index} maxRelativeError`) <= testCase.projectionContract.maximumCrossEngineVoltageDropRelativeDifference, "Projection selected-vector relative error exceeded its bound");
    invariant(entry.nativeValue === result.native.voltageDropsV[index], `Projection selected vector ${index} native value drifted`);
    invariant(entry.browserWasmValue === result.browserWasm.voltageDropsV[index], `Projection selected vector ${index} browser-WASM value drifted`);
  }
  invariant(typeof result.fullVectorComparisonPass === "boolean" && result.fullVectorComparisonIsReleaseGate === false, "Projection full-vector boundary drifted");
  validateMeasurements(result.native, testCase.projectionContract, "projection native measurements");
  validateMeasurements(result.browserWasm, testCase.projectionContract, "projection browser-WASM measurements");
  const expectedCrossEngineDifference = Math.max(...result.native.voltageDropsV.map((entry, index) => (
    relativeDifference(entry, result.browserWasm.voltageDropsV[index])
  )));
  invariant(result.maximumCrossEngineVoltageDropRelativeDifference === expectedCrossEngineDifference, "Projection cross-engine difference drifted");
  invariant(
    result.maximumCrossEngineVoltageDropRelativeDifference
      <= testCase.projectionContract.maximumCrossEngineVoltageDropRelativeDifference,
    "Projection cross-engine voltage drop exceeded its bound",
  );
  for (const property of [
    "selectedPartDeviceEquationUsed", "physicalFidelityProved", "productionRequestConditionsEvaluated",
    "productionConstraintEligibility", "rankingAuthority", "fullBomCoverage",
  ]) invariant(result[property] === false, `Projection report ${property} boundary drifted`);
  invariant(result.pass === true, "Projection execution case did not pass");
  return report;
}

export function selectedSemiconductorRdsonProjectionExecutionIdentity(report) {
  return structuredClone(report);
}

async function verifyPersistedExecutionReport(freshReport, contract, contractContentHash, reportPath) {
  const persistedText = await readFile(reportPath, "utf8");
  const persisted = JSON.parse(persistedText);
  invariant(persistedText === `${JSON.stringify(persisted, null, 2)}\n`, "Projection persisted report is not canonical JSON");
  validateSelectedSemiconductorRdsonProjectionReport(persisted, contract, contractContentHash);
  invariant(
    JSON.stringify(selectedSemiconductorRdsonProjectionExecutionIdentity(persisted))
      === JSON.stringify(selectedSemiconductorRdsonProjectionExecutionIdentity(freshReport)),
    "Projection persisted report differs from the fresh native/browser-WASM execution",
  );
}

function measurements(rawfile, spec, label) {
  const voltageDropsV = Array.from({ length: spec.instanceCount }, (_entry, index) => (
    vector(rawfile, `v(d${index + 1})`)[0]
  ));
  const apparentResistanceOhm = voltageDropsV.map((entry) => entry / spec.forcedCurrentA);
  const value = {
    sampleCount: 1,
    instanceCount: voltageDropsV.length,
    voltageDropsV,
    apparentResistanceOhm,
    maximumVoltageDropAbsoluteErrorV: Math.max(...voltageDropsV.map((entry) => Math.abs(entry - spec.expectedVoltageDropV))),
    maximumInstanceSpreadV: Math.max(...voltageDropsV) - Math.min(...voltageDropsV),
    conditionsBoundToReviewedProfile: true,
    selectedPartDeviceEquationUsed: false,
    physicalFidelityProved: false,
  };
  validateMeasurements(value, spec, `${label} measurements`);
  return value;
}

async function runCase(testCase, contract, browserWorker) {
  const netlistPath = resolve(HERE, "selected-semiconductor-rdson-projection", testCase.fixture);
  const netlist = await readFile(netlistPath, "utf8");
  invariant(sha256(netlist) === testCase.netlistContentHash, "Projection exact netlist bytes drifted");
  invariant(netlist.startsWith("scheMAGIC CSD18540Q5B ideal reviewed-RDS(on) projection\n"), "Projection title drifted");
  invariant(netlist.match(/^R[1-4]\s+d[1-4]\s+0\s+2\.2m$/gmu)?.length === 4, "Projection requires exactly four ideal 2.2 mOhm resistors");
  invariant(netlist.match(/^I[1-4]\s+0\s+d[1-4]\s+DC\s+28$/gmu)?.length === 4, "Projection requires exactly four 28 A DC injections");
  invariant(!/^[ \t]*\.(?:model|subckt|include|lib|tran|ac|noise)\b/imu.test(netlist), "Projection expanded beyond its ideal-resistor operating point");
  invariant(!/^M\S*\s/gmu.test(netlist), "Projection must not contain a transistor instance");

  const browserModule = new URL(contract.engines.browserWasm.module, pathToFileURL(CONTRACT_PATH)).href;
  const [native, firstWasm] = await Promise.all([
    runNative({ netlist, timeoutMs: 30_000 }),
    browserWorker.run(netlist, "runOpPoint", browserModule),
  ]);
  const secondWasm = await browserWorker.run(netlist, "runOpPoint", browserModule);
  invariant(native.version === contract.engines.native.version, "Projection native engine version drifted");
  invariant(firstWasm.version === contract.engines.browserWasm.engineVersion, "Projection browser-WASM engine version drifted");
  invariant(firstWasm.ngspiceVersion === contract.engines.browserWasm.simulatorVersion, "Projection browser-WASM simulator version drifted");

  const comparison = compareRawfiles(native.rawfile, firstWasm.rawfile, {
    analysis: "op",
    tolerances: { rtol: 1e-9, atol: 1e-12 },
  });
  const selectedVectors = selectedComparison(comparison, testCase.selectedVectors).map((entry) => ({
    ...entry,
    nativeValue: vector(native.rawfile, entry.name)[0],
    browserWasmValue: vector(firstWasm.rawfile, entry.name)[0],
  }));
  const nativeMeasurements = measurements(native.rawfile, testCase.projectionContract, "native");
  const wasmMeasurements = measurements(firstWasm.rawfile, testCase.projectionContract, "browser-WASM");
  const maximumCrossEngineVoltageDropRelativeDifference = Math.max(...nativeMeasurements.voltageDropsV.map((entry, index) => (
    relativeDifference(entry, wasmMeasurements.voltageDropsV[index])
  )));
  invariant(
    maximumCrossEngineVoltageDropRelativeDifference
      <= testCase.projectionContract.maximumCrossEngineVoltageDropRelativeDifference,
    "Projection voltage drop differed across engines",
  );

  const firstReceipt = firstWasm.receipt;
  const secondReceipt = secondWasm.receipt;
  invariant(firstReceipt.attestation === "none", "Projection receipt must stay unattested");
  invariant(firstReceipt.executionHost === "local_worker", "Projection receipt was not minted by the local worker");
  invariant(JSON.stringify(firstReceipt.engine) === JSON.stringify(firstWasm.engineIdentity), "Projection receipt engine identity drifted");
  invariant(JSON.stringify(firstReceipt) === JSON.stringify(secondReceipt), "Projection browser receipt was not repeatable");
  invariant(firstWasm.receiptVerificationIssues.length === 0, `Projection first receipt verification failed: ${firstWasm.receiptVerificationIssues.join(", ")}`);
  invariant(secondWasm.receiptVerificationIssues.length === 0, `Projection repeated receipt verification failed: ${secondWasm.receiptVerificationIssues.join(", ")}`);
  invariant(firstReceipt.netlistContentHash === testCase.netlistContentHash, "Projection receipt did not bind the exact netlist");

  return {
    id: testCase.id,
    application: testCase.application,
    presetId: testCase.presetId,
    observationKind: testCase.observationKind,
    currentIdentity: testCase.currentIdentity,
    selectedBinding: testCase.selectedBinding,
    sourceBinding: testCase.sourceBinding,
    analysis: testCase.analysis,
    projectionKind: contract.evidenceBoundary.projectionKind,
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
    maximumCrossEngineVoltageDropRelativeDifference,
    selectedPartDeviceEquationUsed: false,
    physicalFidelityProved: false,
    productionRequestConditionsEvaluated: false,
    productionConstraintEligibility: false,
    rankingAuthority: false,
    fullBomCoverage: false,
    pass: true,
  };
}

export async function runSelectedSemiconductorRdsonProjection() {
  const contractBytes = await readFile(CONTRACT_PATH, "utf8");
  const contract = JSON.parse(contractBytes);
  const testCase = validateSelectedSemiconductorRdsonProjectionContract(contract);
  const browserWorker = new BrowserWorkerHarness();
  let result;
  try {
    result = await runCase(testCase, contract, browserWorker);
  } catch (error) {
    throw new Error(`Ideal reviewed-RDS(on) projection execution failed; build @opencircuit/sim-engine first: ${error.message}`);
  } finally {
    await browserWorker.close();
  }
  const report = {
    format: "opencircuit-selected-semiconductor-rdson-projection-report",
    schemaVersion: 1,
    contractContentHash: sha256(contractBytes),
    evidenceBoundary: contract.evidenceBoundary,
    case: result,
    pass: result.pass,
  };
  validateSelectedSemiconductorRdsonProjectionReport(report, contract, report.contractContentHash);
  return { report, contract, contractContentHash: report.contractContentHash };
}

async function main() {
  const args = process.argv.slice(2);
  invariant(
    args.length === 0 || (args.length === 1 && args[0] === "--verify-persisted-report"),
    "Usage: selected-semiconductor-rdson-projection.mjs [--verify-persisted-report]",
  );
  const { report, contract, contractContentHash } = await runSelectedSemiconductorRdsonProjection();
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
