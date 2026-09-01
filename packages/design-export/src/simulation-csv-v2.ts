import {
  canonicalDesignV2Payload,
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignCandidateV2,
  type DesignResultV2,
  type DesignValidationIssue,
} from "@opencircuit/design-schema";
import {
  validateDesignResultEngineeringContextV2,
  validateDesignResultExecutionContextV2,
  type DesignResultExecutionContextV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine";
import {
  calculateSimulationNetlistContentHashV1,
  generateScenarioNetlist,
  verifySimulationExecutionReceiptV1,
  type DCSweepResultMetadata,
  type NoiseResultMetadata,
  type SimulationExecutionReceiptV1,
  type SimulationRequestType,
  type SimulationResult,
  type SimulationRunProvenance,
  type VectorMeta,
} from "@opencircuit/sim-engine";
import { escapeBomTextCellV2 } from "./bom-v2";

export type DesignScenarioSimulationCsvErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "scenario_not_found"
  | "coverage_unavailable"
  | "execution_context_invalid"
  | "simulation_receipt_invalid"
  | "analysis_mismatch"
  | "netlist_mismatch"
  | "invalid_csv"
  | "artifact_unverified";

export class DesignScenarioSimulationCsvErrorV2 extends Error {
  readonly code: DesignScenarioSimulationCsvErrorCodeV2;
  readonly issues: readonly DesignValidationIssue[];

  constructor(code: DesignScenarioSimulationCsvErrorCodeV2, issues: readonly DesignValidationIssue[] = []) {
    super("scheMAGIC behavioral simulation CSV was rejected");
    this.name = "DesignScenarioSimulationCsvErrorV2";
    this.code = code;
    this.issues = Object.freeze([...issues]);
  }
}

export interface DesignScenarioSimulationCsvColumnV2 {
  header: string;
  vectorIndex: number;
  component: "real" | "imaginary" | "scalar";
  unit: string;
}

export interface DesignScenarioSimulationProvenanceV2 {
  format: "schemagic-scenario-simulation-provenance";
  schemaVersion: 2;
  fidelity: "behavioral_model";
  evidenceUse: "waveform_only_not_ranking";
  attestation: "none";
  designResultRef: {
    contentHash: DesignResultV2["contentHash"];
    requestHash: DesignResultV2["requestHash"];
    libraryVersion: string;
    libraryContentHash: DesignResultV2["libraryContentHash"];
  };
  engineeringContextRef: {
    manifestVersion: GenerateElectricalContextV2["manifest"]["version"];
    manifestContentHash: GenerateElectricalContextV2["manifest"]["contentHash"];
  };
  candidateRef: { id: CandidateIdV2; recipeId: string };
  scenarioRef: {
    id: string;
    circuitId: string;
    analysisMode: "op" | "tran" | "ac" | "dc-sweep" | "noise";
    scenarioHash: string;
    serializationHash: string;
  };
  coverage: {
    modelTier: "behavioral";
    limitations: string[];
  };
  runProvenance: SimulationRunProvenance;
  timing: {
    elapsedMs: number;
    engineMs: number;
    parseMs: number;
    queueMs: number;
  };
  executionReceipt: SimulationExecutionReceiptV1;
  vectors: VectorMeta[];
  columns: DesignScenarioSimulationCsvColumnV2[];
  rowCount: number;
  rawfileBytes: number;
  sweep?: DCSweepResultMetadata;
  noise?: NoiseResultMetadata;
}

export interface ParsedDesignScenarioSimulationCsvV2 {
  provenance: Readonly<DesignScenarioSimulationProvenanceV2>;
  data: ReadonlyMap<string, Float64Array>;
}

const MAX_CSV_BYTES = 128 * 1024 * 1024;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const RUN_KEY = /^[0-9a-f]{64}$/u;

function rfc4180(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function jsonCell(value: unknown): string {
  return rfc4180(canonicalDesignV2Payload(value));
}

function sampleCell(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError("Simulation CSV samples must be finite");
  return Object.is(value, -0) ? "-0" : JSON.stringify(value);
}

function expectedRequestType(mode: DesignScenarioSimulationProvenanceV2["scenarioRef"]["analysisMode"]): SimulationRequestType {
  if (mode === "op") return "runOpPoint";
  if (mode === "tran") return "runTransient";
  if (mode === "ac") return "runAC";
  if (mode === "dc-sweep") return "runDCSweep";
  return "runNoise";
}

function unitFor(vector: Readonly<VectorMeta>, result: Readonly<SimulationResult>): string {
  if (vector.kind === "time") return "s";
  if (vector.kind === "frequency") return "Hz";
  if (vector.kind === "voltage") return "V";
  if (vector.kind === "current") return "A";
  if (vector.kind === "output-noise-density") return "V/√Hz";
  if (vector.kind === "input-noise-density") return result.noise?.input.densityUnit ?? "";
  if (vector.kind === "sweep") return result.sweep?.primary.unit ?? "";
  return "";
}

function columnsFor(result: Readonly<SimulationResult>): DesignScenarioSimulationCsvColumnV2[] {
  return result.vectors.flatMap<DesignScenarioSimulationCsvColumnV2>((vector, vectorIndex) => {
    const unit = unitFor(vector, result);
    const suffix = unit === "" ? "" : ` [${unit}]`;
    if (vector.complex) return [
      { header: `${vector.name}.real${suffix}`, vectorIndex, component: "real" as const, unit },
      { header: `${vector.name}.imaginary${suffix}`, vectorIndex, component: "imaginary" as const, unit },
    ];
    return [{ header: `${vector.name}${suffix}`, vectorIndex, component: "scalar" as const, unit }];
  });
}

function rowCount(result: Readonly<SimulationResult>): number {
  const lengths = new Set(result.vectors.map((vector) => vector.length));
  if (lengths.size !== 1) throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  const count = result.vectors[0]?.length;
  if (count === undefined || !Number.isSafeInteger(count) || count <= 0) {
    throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  }
  return count;
}

function assertAnalysisShape(
  mode: DesignScenarioSimulationProvenanceV2["scenarioRef"]["analysisMode"],
  result: Readonly<SimulationResult>,
): void {
  const axisKinds = result.vectors.filter((vector) => vector.kind === "time" || vector.kind === "frequency" || vector.kind === "sweep");
  const expectedAxis = mode === "tran" ? "time" : mode === "ac" || mode === "noise" ? "frequency" : mode === "dc-sweep" ? "sweep" : undefined;
  if (expectedAxis === undefined ? axisKinds.length !== 0 : axisKinds.length !== 1
    || (expectedAxis !== undefined && (result.vectors[0]?.kind !== expectedAxis || axisKinds[0]?.kind !== expectedAxis))) {
    throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  }
  if ((mode === "op" || mode === "tran" || mode === "dc-sweep" || mode === "noise")
    && result.vectors.some((vector) => vector.complex)) {
    throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  }
  if (mode === "dc-sweep" && result.sweep === undefined) {
    throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  }
  if (mode === "noise" && result.noise === undefined) throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  if (mode !== "dc-sweep" && result.sweep !== undefined) throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  if (mode !== "noise" && result.noise !== undefined) throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
}

function parsedResult(
  resultInput: Readonly<DesignResultV2>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): DesignResultV2 {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_result");
  }
  const issues = validateDesignResultEngineeringContextV2(result, engineeringContext);
  if (issues.length > 0) throw new DesignScenarioSimulationCsvErrorV2("engineering_context_unverified", issues);
  return result;
}

interface BoundScenarioV2 {
  result: DesignResultV2;
  candidate: DesignCandidateV2;
  scenario: DesignCandidateV2["circuit"]["scenarios"][number];
  coverage: DesignCandidateV2["simulationCoverage"][number] & { modelTier: "behavioral" };
  generated: ReturnType<typeof generateScenarioNetlist>;
}

function snapshotSimulationResult(result: Readonly<SimulationResult>): SimulationResult {
  return {
    provenance: structuredClone(result.provenance),
    vectors: result.vectors.map((vector) => ({ ...vector })),
    data: new Map([...result.data].map(([name, values]) => [name, values.slice()])),
    elapsedMs: result.elapsedMs,
    engineMs: result.engineMs,
    parseMs: result.parseMs,
    queueMs: result.queueMs,
    rawfileBytes: result.rawfileBytes,
    receipt: structuredClone(result.receipt),
    ...(result.sweep === undefined ? {} : { sweep: structuredClone(result.sweep) }),
    ...(result.noise === undefined ? {} : { noise: structuredClone(result.noise) }),
  };
}

function validFiniteDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validRunProvenance(value: unknown): value is SimulationRunProvenance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const provenance = value as Partial<SimulationRunProvenance>;
  const limits = provenance.limits as Partial<SimulationRunProvenance["limits"]> | undefined;
  return Object.keys(value).length === 5
    && typeof provenance.runKey === "string" && RUN_KEY.test(provenance.runKey)
    && provenance.identityVersion === 1
    && provenance.engine === "ngspice-46-opencircuit-wasm1"
    && ["runOpPoint", "runDCSweep", "runTransient", "runAC", "runNoise"].includes(provenance.requestType ?? "")
    && !!limits && Object.keys(limits).length === 3
    && Number.isSafeInteger(limits.timeoutMs) && (limits.timeoutMs ?? 0) > 0
    && Number.isSafeInteger(limits.maxRawfileBytes) && (limits.maxRawfileBytes ?? 0) > 0
    && Number.isSafeInteger(limits.maxSamples) && (limits.maxSamples ?? 0) > 0;
}

function validTiming(value: unknown): value is DesignScenarioSimulationProvenanceV2["timing"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const timing = value as Partial<DesignScenarioSimulationProvenanceV2["timing"]>;
  return Object.keys(value).length === 4
    && validFiniteDuration(timing.elapsedMs)
    && validFiniteDuration(timing.engineMs)
    && validFiniteDuration(timing.parseMs)
    && validFiniteDuration(timing.queueMs);
}

function closedSimulationSnapshot(result: Readonly<SimulationResult>): SimulationResult {
  try {
    return snapshotSimulationResult(result);
  } catch {
    throw new DesignScenarioSimulationCsvErrorV2("simulation_receipt_invalid");
  }
}

function boundScenario(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  executionContext: Readonly<DesignResultExecutionContextV2>,
): BoundScenarioV2 {
  const result = parsedResult(resultInput, engineeringContext);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new DesignScenarioSimulationCsvErrorV2("candidate_not_found");
  const coverage = candidate.simulationCoverage.find((entry) => entry.scenarioId === scenarioId);
  if (coverage === undefined) throw new DesignScenarioSimulationCsvErrorV2("scenario_not_found");
  if (coverage.modelTier !== "behavioral") throw new DesignScenarioSimulationCsvErrorV2("coverage_unavailable");
  const scenario = candidate.circuit.scenarios.find((entry) => entry.id === scenarioId);
  if (scenario === undefined) throw new DesignScenarioSimulationCsvErrorV2("scenario_not_found");
  const executionIssues = validateDesignResultExecutionContextV2(result, executionContext);
  if (executionIssues.length > 0) {
    throw new DesignScenarioSimulationCsvErrorV2("execution_context_invalid", executionIssues);
  }
  try {
    const generated = generateScenarioNetlist(candidate.circuit, scenarioId, {
      ...(executionContext.trustedSubcircuitRegistry === undefined
        ? {}
        : { registry: executionContext.trustedSubcircuitRegistry }),
    });
    if (generated.omissions.length !== 0) throw new DesignScenarioSimulationCsvErrorV2("execution_context_invalid");
    return { result, candidate, scenario, coverage: { ...coverage, modelTier: "behavioral" }, generated };
  } catch (error) {
    if (error instanceof DesignScenarioSimulationCsvErrorV2) throw error;
    throw new DesignScenarioSimulationCsvErrorV2("execution_context_invalid");
  }
}

async function createSimulationProvenanceFromSnapshotV2(
  bound: Readonly<BoundScenarioV2>,
  simulationResult: Readonly<SimulationResult>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Promise<Readonly<DesignScenarioSimulationProvenanceV2>> {
  const receiptIssues = await verifySimulationExecutionReceiptV1(simulationResult);
  if (receiptIssues.length > 0) throw new DesignScenarioSimulationCsvErrorV2("simulation_receipt_invalid");
  if (!validRunProvenance(simulationResult.provenance)
    || simulationResult.provenance.requestType !== simulationResult.receipt.requestType
    || simulationResult.provenance.engine !== simulationResult.receipt.engine.buildVersion
    || !validTiming({
      elapsedMs: simulationResult.elapsedMs,
      engineMs: simulationResult.engineMs,
      parseMs: simulationResult.parseMs,
      queueMs: simulationResult.queueMs,
    })) {
    throw new DesignScenarioSimulationCsvErrorV2("simulation_receipt_invalid");
  }
  const mode = bound.scenario.config.mode;
  if (simulationResult.receipt.requestType !== expectedRequestType(mode)) {
    throw new DesignScenarioSimulationCsvErrorV2("analysis_mismatch");
  }
  assertAnalysisShape(mode, simulationResult);
  const rows = rowCount(simulationResult);
  const netlistHash = await calculateSimulationNetlistContentHashV1(bound.generated.netlist);
  if (netlistHash !== simulationResult.receipt.netlistContentHash) {
    throw new DesignScenarioSimulationCsvErrorV2("netlist_mismatch");
  }
  const provenance: DesignScenarioSimulationProvenanceV2 = {
    format: "schemagic-scenario-simulation-provenance",
    schemaVersion: 2,
    fidelity: "behavioral_model",
    evidenceUse: "waveform_only_not_ranking",
    attestation: "none",
    designResultRef: {
      contentHash: bound.result.contentHash,
      requestHash: bound.result.requestHash,
      libraryVersion: bound.result.libraryVersion,
      libraryContentHash: bound.result.libraryContentHash,
    },
    engineeringContextRef: {
      manifestVersion: engineeringContext.manifest.version,
      manifestContentHash: engineeringContext.manifest.contentHash,
    },
    candidateRef: { id: bound.candidate.id, recipeId: bound.candidate.recipeId },
    scenarioRef: {
      id: bound.scenario.id,
      circuitId: bound.scenario.circuitId,
      analysisMode: mode,
      scenarioHash: bound.generated.scenarioHash,
      serializationHash: bound.generated.serializationHash,
    },
    coverage: { modelTier: "behavioral", limitations: [...bound.coverage.limitations] },
    runProvenance: structuredClone(simulationResult.provenance),
    timing: {
      elapsedMs: simulationResult.elapsedMs,
      engineMs: simulationResult.engineMs,
      parseMs: simulationResult.parseMs,
      queueMs: simulationResult.queueMs,
    },
    executionReceipt: structuredClone(simulationResult.receipt),
    vectors: simulationResult.vectors.map((vector) => ({ ...vector })),
    columns: columnsFor(simulationResult),
    rowCount: rows,
    rawfileBytes: simulationResult.rawfileBytes,
    ...(simulationResult.sweep === undefined ? {} : { sweep: structuredClone(simulationResult.sweep) }),
    ...(simulationResult.noise === undefined ? {} : { noise: structuredClone(simulationResult.noise) }),
  };
  return Object.freeze(provenance);
}

/** Bind a point-in-time snapshot of local-worker samples to the exact V2 result, scenario, and generated netlist. */
export async function createDesignScenarioSimulationProvenanceV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
  simulationResult: Readonly<SimulationResult>,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
  }>,
): Promise<Readonly<DesignScenarioSimulationProvenanceV2>> {
  const bound = boundScenario(
    resultInput,
    candidateId,
    scenarioId,
    options.engineeringContext,
    options.executionContext,
  );
  return createSimulationProvenanceFromSnapshotV2(
    bound,
    closedSimulationSnapshot(simulationResult),
    options.engineeringContext,
  );
}

function renderCsv(
  provenance: Readonly<DesignScenarioSimulationProvenanceV2>,
  data: ReadonlyMap<string, Float64Array>,
): string {
  const header = ["record_type", "metadata_json", "sample_index", ...provenance.columns.map((column) => column.header)]
    .map(escapeBomTextCellV2)
    .join(",");
  const metadataRow = ["metadata", jsonCell(provenance), "", ...provenance.columns.map(() => "")].join(",");
  const rows = Array.from({ length: provenance.rowCount }, (_, sampleIndex) => {
    const samples = provenance.columns.map((column) => {
      const vector = provenance.vectors[column.vectorIndex];
      const values = vector === undefined ? undefined : data.get(vector.name);
      if (vector === undefined || values === undefined) throw new TypeError("Simulation CSV vector data is missing");
      const offset = vector.complex
        ? sampleIndex * 2 + (column.component === "imaginary" ? 1 : 0)
        : sampleIndex;
      const value = values[offset];
      if (value === undefined) throw new TypeError("Simulation CSV sample is missing");
      return sampleCell(value);
    });
    return ["sample", "", String(sampleIndex), ...samples].join(",");
  });
  const csv = `${header}\n${metadataRow}\n${rows.join("\n")}\n`;
  if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) throw new TypeError("Simulation CSV exceeds its byte limit");
  return csv;
}

/** Export semantically bound behavioral samples as deterministic RFC-4180 CSV rows. */
export async function exportDesignResultScenarioSimulationCsvV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
  simulationResult: Readonly<SimulationResult>,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
  }>,
): Promise<string> {
  const bound = boundScenario(
    resultInput,
    candidateId,
    scenarioId,
    options.engineeringContext,
    options.executionContext,
  );
  const snapshot = closedSimulationSnapshot(simulationResult);
  const provenance = await createSimulationProvenanceFromSnapshotV2(
    bound,
    snapshot,
    options.engineeringContext,
  );
  try {
    return renderCsv(provenance, snapshot.data);
  } catch {
    throw new DesignScenarioSimulationCsvErrorV2("simulation_receipt_invalid");
  }
}

function parseCsvRows(csv: string): string[][] {
  if (!csv.endsWith("\n") || csv.includes("\r") || new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
      } else cell += character;
      continue;
    }
    if (character === '"') {
      if (cell.length !== 0) throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
      quoted = true;
    } else if (character === ",") {
      row.push(cell); cell = "";
    } else if (character === "\n") {
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (quoted || row.length !== 0 || cell.length !== 0 || rows.length < 3) {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  return rows;
}

function basicProvenance(value: unknown): value is DesignScenarioSimulationProvenanceV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const provenance = value as Partial<DesignScenarioSimulationProvenanceV2>;
  return provenance.format === "schemagic-scenario-simulation-provenance"
    && provenance.schemaVersion === 2
    && provenance.fidelity === "behavioral_model"
    && provenance.evidenceUse === "waveform_only_not_ranking"
    && provenance.attestation === "none"
    && !!provenance.designResultRef && typeof provenance.designResultRef.contentHash === "string" && HASH.test(provenance.designResultRef.contentHash)
    && !!provenance.engineeringContextRef
    && typeof provenance.engineeringContextRef.manifestVersion === "string" && provenance.engineeringContextRef.manifestVersion.length > 0
    && typeof provenance.engineeringContextRef.manifestContentHash === "string" && HASH.test(provenance.engineeringContextRef.manifestContentHash)
    && !!provenance.candidateRef && typeof provenance.candidateRef.id === "string"
    && !!provenance.scenarioRef && typeof provenance.scenarioRef.id === "string"
    && validRunProvenance(provenance.runProvenance)
    && validTiming(provenance.timing)
    && Array.isArray(provenance.vectors) && Array.isArray(provenance.columns)
    && Number.isSafeInteger(provenance.rowCount) && (provenance.rowCount ?? 0) > 0
    && !!provenance.executionReceipt;
}

function assertSafeParsedVectorAllocation(provenance: Readonly<DesignScenarioSimulationProvenanceV2>): void {
  const names = new Set<string>();
  let scalarSampleCount = 0;
  for (const [index, vector] of provenance.vectors.entries()) {
    if (!vector || typeof vector.name !== "string" || vector.name.length === 0 || names.has(vector.name)
      || vector.bufferIndex !== index || !Number.isSafeInteger(vector.length)
      || vector.length !== provenance.rowCount || typeof vector.complex !== "boolean") {
      throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
    }
    names.add(vector.name);
    scalarSampleCount += vector.length * (vector.complex ? 2 : 1);
    if (!Number.isSafeInteger(scalarSampleCount)) throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  if (provenance.vectors.length === 0
    || provenance.executionReceipt.vectorCount !== provenance.vectors.length
    || provenance.executionReceipt.scalarSampleCount !== scalarSampleCount
    || provenance.executionReceipt.rawfileBytes !== provenance.rawfileBytes) {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
}

function parseNumberCell(value: string): number {
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/u.test(value)) {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || sampleCell(parsed) !== value) throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  return parsed;
}

/** Parse CSV samples and re-run every result/context/netlist/receipt verification. */
export async function parseDesignResultScenarioSimulationCsvV2(
  csv: string,
  resultInput: Readonly<DesignResultV2>,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
  }>,
): Promise<ParsedDesignScenarioSimulationCsvV2> {
  const rows = parseCsvRows(csv);
  const metadataRow = rows[1];
  let provenance: DesignScenarioSimulationProvenanceV2;
  try {
    if (metadataRow?.[0] !== "metadata" || typeof metadataRow[1] !== "string") {
      throw new TypeError("Simulation CSV has no metadata row");
    }
    const parsed = JSON.parse(metadataRow[1]) as unknown;
    if (!basicProvenance(parsed) || canonicalDesignV2Payload(parsed) !== metadataRow[1]) {
      throw new TypeError("Simulation CSV metadata is invalid");
    }
    provenance = parsed;
  } catch {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  const width = 3 + provenance.columns.length;
  if (rows.some((row) => row.length !== width) || rows.length !== provenance.rowCount + 2) {
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  assertSafeParsedVectorAllocation(provenance);
  const data = new Map<string, Float64Array>();
  try {
    for (const vector of provenance.vectors) data.set(vector.name, new Float64Array(vector.length * (vector.complex ? 2 : 1)));
    for (const [sampleIndex, row] of rows.slice(2).entries()) {
      if (row[0] !== "sample" || row[1] !== "" || row[2] !== String(sampleIndex)) {
        throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
      }
      provenance.columns.forEach((column, columnIndex) => {
        const vector = provenance.vectors[column.vectorIndex];
        const values = vector === undefined ? undefined : data.get(vector.name);
        if (vector === undefined || values === undefined) throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
        const offset = vector.complex
          ? sampleIndex * 2 + (column.component === "imaginary" ? 1 : 0)
          : sampleIndex;
        values[offset] = parseNumberCell(row[columnIndex + 3]!);
      });
    }
  } catch (error) {
    if (error instanceof DesignScenarioSimulationCsvErrorV2) throw error;
    throw new DesignScenarioSimulationCsvErrorV2("invalid_csv");
  }
  const simulationResult: SimulationResult = {
    provenance: provenance.runProvenance,
    vectors: provenance.vectors,
    data,
    elapsedMs: provenance.timing.elapsedMs,
    engineMs: provenance.timing.engineMs,
    parseMs: provenance.timing.parseMs,
    queueMs: provenance.timing.queueMs,
    rawfileBytes: provenance.rawfileBytes,
    receipt: provenance.executionReceipt,
    ...(provenance.sweep === undefined ? {} : { sweep: provenance.sweep }),
    ...(provenance.noise === undefined ? {} : { noise: provenance.noise }),
  };
  let expected: Readonly<DesignScenarioSimulationProvenanceV2>;
  try {
    expected = await createDesignScenarioSimulationProvenanceV2(
      resultInput,
      provenance.candidateRef.id,
      provenance.scenarioRef.id,
      simulationResult,
      options,
    );
  } catch (error) {
    if (error instanceof DesignScenarioSimulationCsvErrorV2) throw error;
    throw new DesignScenarioSimulationCsvErrorV2("artifact_unverified");
  }
  if (canonicalDesignV2Payload(expected) !== canonicalDesignV2Payload(provenance)
    || renderCsv(expected, data) !== csv) {
    throw new DesignScenarioSimulationCsvErrorV2("artifact_unverified");
  }
  return { provenance: Object.freeze(structuredClone(expected)), data };
}
