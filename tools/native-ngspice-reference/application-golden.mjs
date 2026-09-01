#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { compareRawfiles } from "./lib/compare-results.mjs";
import { runNative } from "./lib/run-native.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = resolve(HERE, "application-golden/contract.json");
const HASH = /^sha256:[0-9a-f]{64}$/u;

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

function mean(values) {
  invariant(values.length > 0, "Cannot average an empty observation window");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1e-15);
}

export class BrowserWorkerHarness {
  constructor() {
    this.worker = new Worker(new URL("./application-golden-worker.mjs", import.meta.url), { type: "module" });
    this.nextId = 1;
    this.pending = new Map();
    this.failure = null;
    this.worker.on("message", (message) => {
      const pending = this.pending.get(message?.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.status === "ok") pending.resolve(message);
      else pending.reject(new Error(message.error ?? "Application golden worker failed"));
    });
    this.worker.on("error", (error) => this.rejectAll(error));
    this.worker.on("exit", (code) => {
      if (code !== 0 && !this.failure) this.rejectAll(new Error(`Application golden worker exited with code ${code}`));
    });
  }

  rejectAll(error) {
    this.failure = error;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  run(netlist, requestType, engineModule) {
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.worker.postMessage({ id, netlist, requestType, engineModule });
    });
  }

  async close() {
    await this.worker.terminate();
  }
}

export function selectedComparison(comparison, selectedNames) {
  return selectedNames.map((name) => {
    const result = comparison.vectors.find((entry) => entry.name === name);
    invariant(result, `Comparison omitted selected vector ${name}`);
    invariant(result.pass, `Selected vector ${name} exceeded its declared ${comparison.analysis} tolerance`);
    return {
      name,
      metric: result.metric,
      maxAbsError: result.maxAbsError,
      maxRelativeError: result.maxRelativeError,
    };
  });
}

function motorMeasurements(spec, native, wasm) {
  exactKeys(spec, [
    "kind", "windingCurrentVector", "minimumCurrentA", "maximumCurrentA",
    "maximumCrossEngineRelativeDifference",
  ], "motor measurement contract");
  const nativeCurrentA = vector(native, spec.windingCurrentVector)[0];
  const wasmCurrentA = vector(wasm, spec.windingCurrentVector)[0];
  for (const [engine, current] of [["native", nativeCurrentA], ["browser-WASM", wasmCurrentA]]) {
    invariant(current >= spec.minimumCurrentA && current <= spec.maximumCurrentA, `${engine} motor current is outside the declared behavioral window`);
  }
  const crossEngineRelativeDifference = relativeDifference(nativeCurrentA, wasmCurrentA);
  invariant(crossEngineRelativeDifference <= spec.maximumCrossEngineRelativeDifference, "Motor current cross-engine difference exceeded tolerance");
  return { nativeCurrentA, wasmCurrentA, crossEngineRelativeDifference };
}

function motorExternalEngineMeasurements(rawfile, spec) {
  const windingCurrentA = Math.abs(vector(rawfile, spec.windingCurrentVector)[0]);
  const shuntCurrentA = Math.abs(vector(rawfile, spec.shuntCurrentVector)[0]);
  const shuntNodeV = Math.abs(vector(rawfile, spec.shuntNodeVector)[0]);
  const seriesCurrentMismatchA = Math.abs(windingCurrentA - shuntCurrentA);
  const shuntRelationAbsoluteErrorV = Math.abs(shuntNodeV - shuntCurrentA * spec.shuntResistanceOhm);
  invariant(windingCurrentA >= spec.minimumCurrentA && windingCurrentA <= spec.maximumCurrentA, "External-Motor winding current is outside the declared behavioral window");
  invariant(seriesCurrentMismatchA <= spec.maximumSeriesCurrentMismatchA, "External-Motor winding/shunt series-current relation exceeded tolerance");
  invariant(shuntRelationAbsoluteErrorV <= spec.maximumShuntRelationAbsoluteErrorV, "External-Motor shunt voltage/current relation exceeded tolerance");
  return { windingCurrentA, shuntCurrentA, shuntNodeV, seriesCurrentMismatchA, shuntRelationAbsoluteErrorV };
}

function motorExternalMeasurements(spec, native, wasm) {
  exactKeys(spec, [
    "kind", "windingCurrentVector", "shuntCurrentVector", "shuntNodeVector",
    "shuntResistanceOhm", "minimumCurrentA", "maximumCurrentA",
    "maximumCrossEngineRelativeDifference", "maximumSeriesCurrentMismatchA",
    "maximumShuntRelationAbsoluteErrorV",
  ], "external-Motor measurement contract");
  const nativeMeasurements = motorExternalEngineMeasurements(native, spec);
  const wasmMeasurements = motorExternalEngineMeasurements(wasm, spec);
  const crossEngineRelativeDifference = relativeDifference(nativeMeasurements.windingCurrentA, wasmMeasurements.windingCurrentA);
  invariant(crossEngineRelativeDifference <= spec.maximumCrossEngineRelativeDifference, "External-Motor winding-current cross-engine difference exceeded tolerance");
  return { native: nativeMeasurements, browserWasm: wasmMeasurements, crossEngineRelativeDifference };
}

function powerEngineMeasurements(rawfile, spec) {
  const time = vector(rawfile, "time");
  const output = vector(rawfile, spec.outputVector);
  const feedback = vector(rawfile, spec.feedbackVector);
  const loadCurrent = vector(rawfile, spec.loadCurrentVector);
  invariant(time.length === output.length && output.length === feedback.length && feedback.length === loadCurrent.length, "Power observation vector lengths differ");
  const preEnableOutput = output.filter((_value, index) => time[index] < spec.enableTimeS);
  const finalIndexes = time.map((value, index) => value >= spec.finalWindowStartS ? index : -1).filter((index) => index >= 0);
  const finalOutput = finalIndexes.map((index) => output[index]);
  const finalFeedback = finalIndexes.map((index) => feedback[index]);
  const finalLoadCurrent = finalIndexes.map((index) => loadCurrent[index]);
  const maximumPreEnableAbsoluteOutputV = Math.max(0, ...preEnableOutput.map(Math.abs));
  const finalWindowMeanOutputV = mean(finalOutput);
  const finalWindowMeanFeedbackV = mean(finalFeedback);
  const finalWindowMeanLoadCurrentA = mean(finalLoadCurrent);
  const maximumFeedbackRatioAbsoluteError = Math.max(...finalIndexes.map((index) => Math.abs(feedback[index] - output[index] * spec.feedbackDividerRatio)));
  const maximumLoadRelationAbsoluteErrorA = Math.max(...finalIndexes.map((index) => Math.abs(loadCurrent[index] - output[index] * spec.loadConductanceAperV)));
  const maximumObservedOutputV = Math.max(...output);

  invariant(maximumPreEnableAbsoluteOutputV <= spec.maximumPreEnableAbsoluteOutputV, "Power output changed before the authored gate-enable time");
  invariant(finalWindowMeanOutputV >= spec.minimumFinalWindowMeanOutputV && finalWindowMeanOutputV <= spec.maximumFinalWindowMeanOutputV, "Power final-window mean is outside the declared passive-rise regression window");
  invariant(maximumFeedbackRatioAbsoluteError <= spec.maximumFeedbackRatioAbsoluteError, "Power feedback-divider relation exceeded tolerance");
  invariant(maximumLoadRelationAbsoluteErrorA <= spec.maximumLoadRelationAbsoluteErrorA, "Power resistive-load relation exceeded tolerance");
  invariant(maximumObservedOutputV <= spec.maximumObservedOutputVForNonFidelityBoundary, "Power fixture no longer demonstrates its explicit non-regulation boundary");
  invariant(maximumObservedOutputV < spec.requestedOutputV, "Power startup fixture unexpectedly reached the requested regulation target");
  return {
    maximumPreEnableAbsoluteOutputV,
    finalWindowMeanOutputV,
    finalWindowMeanFeedbackV,
    finalWindowMeanLoadCurrentA,
    maximumFeedbackRatioAbsoluteError,
    maximumLoadRelationAbsoluteErrorA,
    maximumObservedOutputV,
    requestedOutputV: spec.requestedOutputV,
    targetRegulationProved: false,
  };
}

function powerMeasurements(spec, native, wasm) {
  exactKeys(spec, [
    "kind", "outputVector", "feedbackVector", "loadCurrentVector", "enableTimeS",
    "finalWindowStartS", "maximumPreEnableAbsoluteOutputV", "minimumFinalWindowMeanOutputV",
    "maximumFinalWindowMeanOutputV", "maximumCrossEngineRelativeDifference", "feedbackDividerRatio",
    "maximumFeedbackRatioAbsoluteError", "loadConductanceAperV", "maximumLoadRelationAbsoluteErrorA",
    "requestedOutputV", "maximumObservedOutputVForNonFidelityBoundary",
  ], "power measurement contract");
  const nativeMeasurements = powerEngineMeasurements(native, spec);
  const wasmMeasurements = powerEngineMeasurements(wasm, spec);
  const crossEngineRelativeDifference = relativeDifference(nativeMeasurements.finalWindowMeanOutputV, wasmMeasurements.finalWindowMeanOutputV);
  invariant(crossEngineRelativeDifference <= spec.maximumCrossEngineRelativeDifference, "Power output-window cross-engine difference exceeded tolerance");
  return { native: nativeMeasurements, browserWasm: wasmMeasurements, crossEngineRelativeDifference };
}

function motorAnalyticTrendEngineMeasurements(rawfile, spec) {
  const observedCurrentA = vector(rawfile, spec.windingCurrentVector)[0];
  const representedSeriesResistanceOhm = spec.windingResistanceOhm
    + spec.representedClosedSwitchCount * spec.representedClosedSwitchResistanceOhm
    + spec.representedShuntResistanceOhm;
  const analyticallyExpectedCurrentA = (spec.averageBridgeVoltageV - spec.operatingBackEmfV)
    / representedSeriesResistanceOhm;
  const analyticCurrentRelativeDifference = relativeDifference(observedCurrentA, analyticallyExpectedCurrentA);
  invariant(observedCurrentA > 0, "Motor analytic trend requires a positive observed current");
  invariant(observedCurrentA <= spec.authoredLoadCurrentA, "Motor represented series resistance no longer reduces current below the authored closure current");
  invariant(analyticCurrentRelativeDifference <= spec.maximumAnalyticCurrentRelativeDifference, "Motor observed current exceeded its declared analytic closure tolerance");
  return { observedCurrentA, analyticallyExpectedCurrentA, analyticCurrentRelativeDifference };
}

function motorAnalyticTrendMeasurements(spec, native, wasm) {
  exactKeys(spec, [
    "kind", "windingCurrentVector", "averageBridgeVoltageV", "operatingBackEmfV",
    "windingResistanceOhm", "representedClosedSwitchResistanceOhm",
    "representedClosedSwitchCount", "representedShuntResistanceOhm", "authoredLoadCurrentA",
    "maximumAuthoredClosureAbsoluteErrorV", "maximumAnalyticCurrentRelativeDifference",
  ], "Motor analytic trend contract");
  invariant(spec.averageBridgeVoltageV > spec.operatingBackEmfV, "Motor analytic closure requires positive applied winding voltage");
  invariant(spec.windingResistanceOhm > 0 && spec.representedClosedSwitchResistanceOhm > 0, "Motor analytic closure resistances must be positive");
  invariant(Number.isInteger(spec.representedClosedSwitchCount) && spec.representedClosedSwitchCount > 0, "Motor analytic closure switch count must be a positive integer");
  invariant(spec.representedShuntResistanceOhm >= 0 && spec.authoredLoadCurrentA > 0, "Motor analytic closure inputs are invalid");
  const authoredClosureAbsoluteErrorV = Math.abs(
    (spec.averageBridgeVoltageV - spec.operatingBackEmfV)
      - spec.authoredLoadCurrentA * spec.windingResistanceOhm,
  );
  invariant(authoredClosureAbsoluteErrorV <= spec.maximumAuthoredClosureAbsoluteErrorV, "Motor authored back-EMF no longer closes the declared request current");
  const nativeMeasurements = motorAnalyticTrendEngineMeasurements(native, spec);
  const wasmMeasurements = motorAnalyticTrendEngineMeasurements(wasm, spec);
  return {
    relation: "I=(Vbridge(avg)-Eback)/(Rwinding+Nclosed*Rclosed+Rshunt)",
    authoredClosureAbsoluteErrorV,
    requestDirection: "positive and no greater than the authored load current after represented series resistance",
    native: nativeMeasurements,
    browserWasm: wasmMeasurements,
  };
}

function powerAnalyticTrendEngineMeasurements(rawfile, spec) {
  const time = vector(rawfile, "time");
  const output = vector(rawfile, spec.outputVector);
  const feedback = vector(rawfile, spec.feedbackVector);
  const loadCurrent = vector(rawfile, spec.loadCurrentVector);
  invariant(time.length === output.length && output.length === feedback.length && feedback.length === loadCurrent.length, "Power analytic trend observation vector lengths differ");
  const indexes = time.map((value, index) => value >= spec.postEnableStartS ? index : -1).filter((index) => index >= 0);
  invariant(indexes.length >= 2, "Power analytic trend requires at least two post-enable observations");
  const minimumOutputIndex = indexes.reduce((selected, index) => output[index] < output[selected] ? index : selected, indexes[0]);
  const maximumOutputIndex = indexes.reduce((selected, index) => output[index] > output[selected] ? index : selected, indexes[0]);
  const observedOutputSpanV = output[maximumOutputIndex] - output[minimumOutputIndex];
  invariant(observedOutputSpanV >= spec.minimumObservedOutputSpanV, "Power analytic trend output span is vacuous or below its declared bound");

  const analyticallyExpectedFeedbackSlope = spec.feedbackLowerResistanceOhm
    / (spec.feedbackUpperResistanceOhm + spec.feedbackLowerResistanceOhm);
  const analyticallyExpectedLoadSlopeAperV = 1 / spec.behavioralLoadResistanceOhm;
  const observedFeedbackSpanV = feedback[maximumOutputIndex] - feedback[minimumOutputIndex];
  const observedLoadCurrentSpanA = loadCurrent[maximumOutputIndex] - loadCurrent[minimumOutputIndex];
  invariant(observedFeedbackSpanV > 0, "Power feedback observation did not increase with output");
  invariant(observedLoadCurrentSpanA > 0, "Power load-current observation did not increase with output");
  const observedFeedbackSlope = observedFeedbackSpanV / observedOutputSpanV;
  const observedLoadSlopeAperV = observedLoadCurrentSpanA / observedOutputSpanV;
  const feedbackSlopeAbsoluteError = Math.abs(observedFeedbackSlope - analyticallyExpectedFeedbackSlope);
  const loadSlopeAbsoluteErrorAperV = Math.abs(observedLoadSlopeAperV - analyticallyExpectedLoadSlopeAperV);
  const maximumFeedbackRelationAbsoluteErrorV = Math.max(...indexes.map((index) =>
    Math.abs(feedback[index] - output[index] * analyticallyExpectedFeedbackSlope)));
  const maximumLoadRelationAbsoluteErrorA = Math.max(...indexes.map((index) =>
    Math.abs(loadCurrent[index] - output[index] * analyticallyExpectedLoadSlopeAperV)));
  invariant(maximumFeedbackRelationAbsoluteErrorV <= spec.maximumFeedbackRelationAbsoluteErrorV, "Power feedback passive relation exceeded tolerance");
  invariant(maximumLoadRelationAbsoluteErrorA <= spec.maximumLoadRelationAbsoluteErrorA, "Power load passive relation exceeded tolerance");
  invariant(feedbackSlopeAbsoluteError <= spec.maximumFeedbackSlopeAbsoluteError, "Power feedback positive-slope relation exceeded tolerance");
  invariant(loadSlopeAbsoluteErrorAperV <= spec.maximumLoadSlopeAbsoluteErrorAperV, "Power load-current positive-slope relation exceeded tolerance");
  return {
    observedOutputSpanV,
    observedFeedbackSpanV,
    observedLoadCurrentSpanA,
    analyticallyExpectedFeedbackSlope,
    analyticallyExpectedLoadSlopeAperV,
    observedFeedbackSlope,
    observedLoadSlopeAperV,
    feedbackSlopeAbsoluteError,
    loadSlopeAbsoluteErrorAperV,
    maximumFeedbackRelationAbsoluteErrorV,
    maximumLoadRelationAbsoluteErrorA,
  };
}

function powerAnalyticTrendMeasurements(spec, native, wasm) {
  exactKeys(spec, [
    "kind", "outputVector", "feedbackVector", "loadCurrentVector", "postEnableStartS",
    "behavioralLoadResistanceOhm", "feedbackUpperResistanceOhm",
    "feedbackLowerResistanceOhm", "minimumObservedOutputSpanV",
    "maximumFeedbackRelationAbsoluteErrorV", "maximumLoadRelationAbsoluteErrorA",
    "maximumFeedbackSlopeAbsoluteError", "maximumLoadSlopeAbsoluteErrorAperV",
    "maximumCrossEngineOutputSpanRelativeDifference",
  ], "Power analytic trend contract");
  invariant(spec.postEnableStartS >= 0 && spec.minimumObservedOutputSpanV > 0, "Power analytic trend interval must be non-vacuous");
  invariant(spec.behavioralLoadResistanceOhm > 0 && spec.feedbackUpperResistanceOhm > 0 && spec.feedbackLowerResistanceOhm > 0, "Power analytic trend resistances must be positive");
  const nativeMeasurements = powerAnalyticTrendEngineMeasurements(native, spec);
  const wasmMeasurements = powerAnalyticTrendEngineMeasurements(wasm, spec);
  const crossEngineOutputSpanRelativeDifference = relativeDifference(
    nativeMeasurements.observedOutputSpanV,
    wasmMeasurements.observedOutputSpanV,
  );
  invariant(crossEngineOutputSpanRelativeDifference <= spec.maximumCrossEngineOutputSpanRelativeDifference, "Power analytic trend output span differed across engines");
  return {
    relations: [
      "Vfeedback=Voutput*Rlower/(Rupper+Rlower)",
      "Iload=Voutput/Rload",
    ],
    direction: "feedback voltage and load current increase with output voltage over a non-zero post-enable span",
    native: nativeMeasurements,
    browserWasm: wasmMeasurements,
    crossEngineOutputSpanRelativeDifference,
  };
}

async function loadContract() {
  const contractBytes = await readFile(CONTRACT_PATH, "utf8");
  const contract = JSON.parse(contractBytes);
  exactKeys(contract, ["format", "schemaVersion", "engines", "evidenceBoundary", "cases"], "application golden contract");
  invariant(contract.format === "opencircuit-application-golden-contract" && contract.schemaVersion === 1, "Unsupported application golden contract");
  invariant(contract.evidenceBoundary.modelTier === "behavioral", "Application golden must stay behavioral");
  invariant(contract.evidenceBoundary.attestation === "none", "Application golden must stay unattested");
  invariant(contract.evidenceBoundary.productionProfilesUsed === false, "Application golden must not use production profiles");
  invariant(Array.isArray(contract.cases) && contract.cases.length === 4, "Application golden requires exactly four topology cases");
  invariant(JSON.stringify(contract.cases.map((entry) => entry.topology)) === JSON.stringify([
    "motor.hbridge.integrated",
    "motor.hbridge.external-nmos",
    "power.buck.integrated-synchronous",
    "power.buck.controller-external-nmos",
  ]), "Application golden topology set or order drifted");
  return { contract, contractContentHash: sha256(contractBytes) };
}

async function runCase(testCase, contract, browserWorker) {
  exactKeys(testCase, [
    "id", "application", "topology", "contextExport", "candidateId", "recipeId", "scenarioId",
    "scenarioHash", "serializationHash", "analysis", "fixture", "netlistContentHash",
    "selectedVectors", "measurementContract", "analyticTrendContract", "unavailableScenarios",
  ], `case ${testCase.id}`);
  invariant(testCase.analysis === "op" || testCase.analysis === "tran", `${testCase.id} analysis is unsupported`);
  invariant(HASH.test(testCase.netlistContentHash), `${testCase.id} netlist hash is invalid`);
  const expectedMeasurementKind = testCase.topology === "motor.hbridge.integrated"
    ? "motor-averaged-operating-point"
    : testCase.topology === "motor.hbridge.external-nmos"
      ? "motor-external-averaged-operating-point"
      : "power-passive-startup-rise";
  invariant(testCase.measurementContract.kind === expectedMeasurementKind, `${testCase.id} measurement kind does not match its topology`);
  const expectedAnalyticTrendKind = testCase.application === "motor.brushed-dc"
    ? "motor-authored-closure-with-represented-series-resistance"
    : "power-passive-connectivity-positive-slopes";
  invariant(testCase.analyticTrendContract.kind === expectedAnalyticTrendKind, `${testCase.id} analytic trend kind does not match its application`);
  if (testCase.application === "motor.brushed-dc") {
    invariant(testCase.analyticTrendContract.windingCurrentVector === testCase.measurementContract.windingCurrentVector, `${testCase.id} analytic trend is not bound to the selected winding-current observation`);
  } else {
    invariant(testCase.analyticTrendContract.outputVector === testCase.measurementContract.outputVector, `${testCase.id} analytic trend is not bound to the selected output observation`);
    invariant(testCase.analyticTrendContract.feedbackVector === testCase.measurementContract.feedbackVector, `${testCase.id} analytic trend is not bound to the selected feedback observation`);
    invariant(testCase.analyticTrendContract.loadCurrentVector === testCase.measurementContract.loadCurrentVector, `${testCase.id} analytic trend is not bound to the selected load-current observation`);
    invariant(testCase.analyticTrendContract.postEnableStartS === testCase.measurementContract.enableTimeS, `${testCase.id} analytic trend does not start at the authored gate-enable time`);
  }
  const netlistPath = resolve(HERE, "application-golden", testCase.fixture);
  const netlist = await readFile(netlistPath, "utf8");
  invariant(sha256(netlist) === testCase.netlistContentHash, `${testCase.id} exact netlist bytes drifted`);
  invariant(netlist.startsWith(`scheMAGIC Simulator scenario ${testCase.scenarioHash}\n* scenario-hash ${testCase.scenarioHash}\n`), `${testCase.id} scenario identity is not embedded in its netlist`);

  const browserModule = new URL(contract.engines.browserWasm.module, pathToFileURL(CONTRACT_PATH)).href;
  const requestType = testCase.analysis === "op" ? "runOpPoint" : "runTransient";
  const [native, firstWasm] = await Promise.all([
    runNative({ netlist, timeoutMs: 30_000 }),
    browserWorker.run(netlist, requestType, browserModule),
  ]);
  const secondWasm = await browserWorker.run(netlist, requestType, browserModule);
  invariant(native.version === contract.engines.native.version, `${testCase.id} native engine version drifted`);
  invariant(firstWasm.version === contract.engines.browserWasm.engineVersion, `${testCase.id} browser-WASM engine version drifted`);
  invariant(firstWasm.ngspiceVersion === contract.engines.browserWasm.simulatorVersion, `${testCase.id} browser-WASM simulator version drifted`);

  const comparison = compareRawfiles(native.rawfile, firstWasm.rawfile, { analysis: testCase.analysis });
  const selectedVectors = selectedComparison(comparison, testCase.selectedVectors);
  const measurements = testCase.measurementContract.kind === "motor-averaged-operating-point"
    ? motorMeasurements(testCase.measurementContract, native.rawfile, firstWasm.rawfile)
    : testCase.measurementContract.kind === "motor-external-averaged-operating-point"
      ? motorExternalMeasurements(testCase.measurementContract, native.rawfile, firstWasm.rawfile)
      : powerMeasurements(testCase.measurementContract, native.rawfile, firstWasm.rawfile);
  const analyticTrend = testCase.analyticTrendContract.kind === "motor-authored-closure-with-represented-series-resistance"
    ? motorAnalyticTrendMeasurements(testCase.analyticTrendContract, native.rawfile, firstWasm.rawfile)
    : powerAnalyticTrendMeasurements(testCase.analyticTrendContract, native.rawfile, firstWasm.rawfile);

  const firstReceipt = firstWasm.receipt;
  const secondReceipt = secondWasm.receipt;
  invariant(firstReceipt.attestation === "none", `${testCase.id} receipt attestation boundary drifted`);
  invariant(firstReceipt.executionHost === "local_worker", `${testCase.id} receipt was not minted by the local worker`);
  invariant(JSON.stringify(firstReceipt.engine) === JSON.stringify(firstWasm.engineIdentity), `${testCase.id} receipt engine identity drifted`);
  invariant(JSON.stringify(firstReceipt) === JSON.stringify(secondReceipt), `${testCase.id} browser-WASM receipt was not repeatable`);
  invariant(firstWasm.receiptVerificationIssues.length === 0, `${testCase.id} first receipt verification failed: ${firstWasm.receiptVerificationIssues.join(", ")}`);
  invariant(secondWasm.receiptVerificationIssues.length === 0, `${testCase.id} repeated receipt verification failed: ${secondWasm.receiptVerificationIssues.join(", ")}`);
  invariant(firstReceipt.netlistContentHash === testCase.netlistContentHash, `${testCase.id} receipt did not bind the exact golden netlist`);

  return {
    id: testCase.id,
    application: testCase.application,
    topology: testCase.topology,
    candidateId: testCase.candidateId,
    recipeId: testCase.recipeId,
    scenarioId: testCase.scenarioId,
    scenarioHash: testCase.scenarioHash,
    serializationHash: testCase.serializationHash,
    analysis: testCase.analysis,
    modelTier: "behavioral",
    attestation: firstReceipt.attestation,
    unavailableScenariosPreserved: testCase.unavailableScenarios,
    engineIdentity: firstReceipt.engine,
    netlistContentHash: firstReceipt.netlistContentHash,
    sampleContentHash: firstReceipt.sampleContentHash,
    receiptContentHash: firstReceipt.contentHash,
    repeatableBrowserReceipt: true,
    selectedVectors,
    fullVectorComparisonPass: comparison.pass,
    fullVectorComparisonIsReleaseGate: false,
    measurements,
    analyticTrend,
    pass: true,
  };
}

export async function runApplicationGolden() {
  const { contract, contractContentHash } = await loadContract();
  const browserWorker = new BrowserWorkerHarness();
  const cases = [];
  try {
    for (const testCase of contract.cases) cases.push(await runCase(testCase, contract, browserWorker));
  } catch (error) {
    throw new Error(`Application golden execution failed; build @opencircuit/sim-engine first: ${error.message}`);
  } finally {
    await browserWorker.close();
  }
  return {
    format: "opencircuit-application-golden-report",
    schemaVersion: 1,
    contractContentHash,
    evidenceBoundary: contract.evidenceBoundary,
    cases,
    pass: cases.every((entry) => entry.pass),
  };
}

async function main() {
  const report = await runApplicationGolden();
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
