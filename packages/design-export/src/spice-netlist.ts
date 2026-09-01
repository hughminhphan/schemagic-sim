import {
  validateCircuit,
  type AnalysisMode,
  type CircuitComponent,
  type CircuitDocument,
  type ValidationIssue,
} from "@opencircuit/circuit-schema";
import type { DesignCandidate } from "@opencircuit/design-schema";
import { generateNetlist } from "@opencircuit/sim-engine";

export type CandidateSpiceExportErrorCode =
  | "generation_failed"
  | "invalid_circuit"
  | "unsafe_spice_scalar"
  | "unsupported_circuit";

export class CandidateSpiceExportError extends Error {
  readonly code: CandidateSpiceExportErrorCode;
  readonly issues: readonly ValidationIssue[];

  constructor(code: CandidateSpiceExportErrorCode, message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.name = "CandidateSpiceExportError";
    this.code = code;
    this.issues = issues;
  }
}

const SUPPORTED_MODES = new Set<AnalysisMode>(["live", "op", "dc-sweep", "tran", "ac", "noise"]);
const VALUE_COMPONENTS = new Set<CircuitComponent["type"]>([
  "capacitor",
  "inductor",
  "isource",
  "potentiometer",
  "resistor",
  "vsource",
  "vsource_pulse",
  "vsource_sine",
]);
const PARAMETER_KEYS: Partial<Record<CircuitComponent["type"], readonly string[]>> = {
  vsource: ["ac"],
  vsource_pulse: ["ac", "delay", "fall", "period", "rise", "v1", "v2", "width"],
  vsource_sine: ["ac", "frequency", "offset"],
};
const SAFE_SPICE_SCALAR = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:meg|[pnumkKMG])?(?:[a-zA-ZΩ]*)?$/i;
const SAFE_NODE_TOKEN = /^[a-zA-Z0-9_][a-zA-Z0-9_.:-]*$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function singleLine(value: string): string {
  const escaped = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return escaped || "(empty)";
}

function assertSafeScalar(candidateId: string, componentId: string, path: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
  } else if (typeof value === "string" && SAFE_SPICE_SCALAR.test(value.trim())) {
    return;
  }
  throw new CandidateSpiceExportError(
    "unsafe_spice_scalar",
    `Cannot export candidate ${singleLine(candidateId)}: component ${singleLine(componentId)} has an unsafe SPICE scalar at ${path}.`,
  );
}

function assertNoControlCharacters(candidateId: string, componentId: string, path: string, value: unknown): void {
  if (typeof value !== "string" || !CONTROL_CHARACTERS.test(value)) return;
  throw new CandidateSpiceExportError(
    "unsafe_spice_scalar",
    `Cannot export candidate ${singleLine(candidateId)}: component ${singleLine(componentId)} contains control characters at ${path}.`,
  );
}

function throwUnsafeCircuitValue(candidateId: string, path: string, detail: string): never {
  throw new CandidateSpiceExportError(
    "unsafe_spice_scalar",
    `Cannot export candidate ${singleLine(candidateId)}: ${detail} at ${path}.`,
  );
}

function assertFinitePositive(candidateId: string, path: string, value: unknown, optional = false): void {
  if (optional && value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throwUnsafeCircuitValue(candidateId, path, "simulation value must be a finite positive number");
  }
}

function assertSafeSimulationScalars(candidate: Readonly<DesignCandidate>): void {
  const sim = candidate.circuit.sim;
  if (sim.tran !== undefined) {
    if (!sim.tran || typeof sim.tran !== "object" || Array.isArray(sim.tran)) {
      throwUnsafeCircuitValue(candidate.id, "sim.tran", "transient settings must be an object");
    }
    assertFinitePositive(candidate.id, "sim.tran.tstop", (sim.tran as { tstop?: unknown }).tstop);
    assertFinitePositive(candidate.id, "sim.tran.tstep", (sim.tran as { tstep?: unknown }).tstep, true);
    assertFinitePositive(candidate.id, "sim.tran.maxstep", (sim.tran as { maxstep?: unknown }).maxstep, true);
  }
  if (sim.ac !== undefined) {
    if (!sim.ac || typeof sim.ac !== "object" || Array.isArray(sim.ac)) {
      throwUnsafeCircuitValue(candidate.id, "sim.ac", "AC settings must be an object");
    }
    assertFinitePositive(candidate.id, "sim.ac.fstart", (sim.ac as { fstart?: unknown }).fstart);
    assertFinitePositive(candidate.id, "sim.ac.fstop", (sim.ac as { fstop?: unknown }).fstop);
    const points = (sim.ac as { pointsPerDecade?: unknown }).pointsPerDecade;
    if (typeof points !== "number" || !Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
      throwUnsafeCircuitValue(candidate.id, "sim.ac.pointsPerDecade", "AC points per decade must be a finite positive integer");
    }
  }
}

type ProbeExpression = CircuitDocument["probes"][number]["expression"];

function assertSafeProbeExpression(
  candidateId: string,
  probeId: string,
  expression: Readonly<ProbeExpression>,
  path = "expression",
): void {
  const assertNode = (
    reference: Extract<ProbeExpression, { kind: "voltage" }>["positive"],
    referencePath: string,
  ): void => {
    if (reference.kind === "runtime-node" && !SAFE_NODE_TOKEN.test(reference.name)) {
      throwUnsafeCircuitValue(
        candidateId,
        `probes.${singleLine(probeId)}.${referencePath}.name`,
        "explicit probe node must be one allowlisted SPICE node token",
      );
    }
  };

  switch (expression.kind) {
    case "voltage":
      assertNode(expression.positive, `${path}.positive`);
      assertNode(expression.negative, `${path}.negative`);
      return;
    case "unary":
      assertSafeProbeExpression(candidateId, probeId, expression.operand, `${path}.operand`);
      return;
    case "binary":
      assertSafeProbeExpression(candidateId, probeId, expression.left, `${path}.left`);
      assertSafeProbeExpression(candidateId, probeId, expression.right, `${path}.right`);
      return;
    case "call":
      expression.arguments.forEach((argument, index) => {
        assertSafeProbeExpression(candidateId, probeId, argument, `${path}.arguments.${index}`);
      });
      return;
    default:
      return;
  }
}

function assertSafeCircuitScalars(candidate: Readonly<DesignCandidate>): void {
  for (const probe of candidate.circuit.probes) {
    assertSafeProbeExpression(candidate.id, probe.id, probe.expression);
  }
  for (const component of candidate.circuit.components) {
    if (typeof component.id !== "string" || CONTROL_CHARACTERS.test(component.id)) {
      throwUnsafeCircuitValue(candidate.id, `components.${singleLine(String(component.id))}.id`, "component ID must not contain line-breaking or control characters");
    }
    assertNoControlCharacters(candidate.id, component.id, `components.${component.id}.value`, component.value);
    if (VALUE_COMPONENTS.has(component.type)) {
      assertSafeScalar(candidate.id, component.id, `components.${component.id}.value`, component.value);
    }
    for (const key of PARAMETER_KEYS[component.type] ?? []) {
      assertNoControlCharacters(candidate.id, component.id, `components.${component.id}.params.${key}`, component.params?.[key]);
      assertSafeScalar(candidate.id, component.id, `components.${component.id}.params.${key}`, component.params?.[key]);
    }
    if (component.type === "potentiometer" && component.params?.t !== undefined) {
      const position = component.params.t;
      if (typeof position !== "number" || !Number.isFinite(position) || position <= 0 || position >= 1) {
        throwUnsafeCircuitValue(
          candidate.id,
          `components.${singleLine(component.id)}.params.t`,
          "potentiometer position must be a finite number strictly between 0 and 1",
        );
      }
    }
  }
  assertSafeSimulationScalars(candidate);
}

function headerComments(candidate: Readonly<DesignCandidate>, mode: AnalysisMode): string[] {
  const warnings = [...new Set(candidate.warnings.map(singleLine))].sort(lexical);
  const coverage = [...candidate.simulationCoverage]
    .sort((left, right) => lexical(left.scenarioId, right.scenarioId))
    .map((entry) => {
      const limitations = [...new Set(entry.limitations.map(singleLine))].sort(lexical);
      return `* coverage ${singleLine(entry.scenarioId)} | ${entry.modelTier} | ${limitations.length > 0 ? limitations.join("; ") : "no declared limitations"}`;
    });
  return [
    "* scheMAGIC Designer candidate export",
    `* candidate-id ${singleLine(candidate.id)}`,
    `* recipe-id ${singleLine(candidate.recipeId)}`,
    `* request-hash ${singleLine(candidate.requestHash)}`,
    `* analysis-mode ${mode}`,
    "* model-boundary Circuit behavior follows the candidate's declared simulation coverage; selected BOM identity does not imply a physical SPICE model.",
    ...(warnings.length > 0 ? warnings.map((warning) => `* candidate-warning ${warning}`) : ["* candidate-warning none"]),
    ...(coverage.length > 0 ? coverage : ["* coverage none declared"]),
  ];
}

/**
 * Export the selected candidate's editable circuit through the same public
 * netlist generator used by scheMAGIC Simulator. Invalid documents and unsafe
 * scalar tokens fail closed rather than producing a misleading partial deck.
 */
export function exportCandidateSpiceNetlist(candidate: Readonly<DesignCandidate>): string {
  try {
    assertSafeCircuitScalars(candidate);
  } catch (error) {
    if (error instanceof CandidateSpiceExportError) throw error;
    // Structurally malformed inputs remain owned by validateCircuit below.
  }
  let issues: ValidationIssue[];
  try {
    issues = validateCircuit(candidate.circuit);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CandidateSpiceExportError(
      "invalid_circuit",
      `Cannot export candidate ${singleLine(candidate.id)}: the circuit document is malformed (${singleLine(detail)}).`,
    );
  }
  if (issues.length > 0) {
    const first = issues[0]!;
    throw new CandidateSpiceExportError(
      "invalid_circuit",
      `Cannot export candidate ${singleLine(candidate.id)}: invalid circuit at ${first.path}: ${first.message}.`,
      issues,
    );
  }

  const sourceMode = candidate.circuit.sim.mode;
  if (!SUPPORTED_MODES.has(sourceMode)) {
    throw new CandidateSpiceExportError(
      "unsupported_circuit",
      `Cannot export candidate ${singleLine(candidate.id)}: unsupported simulation mode ${singleLine(String(sourceMode))}.`,
    );
  }
  const mode: AnalysisMode = sourceMode === "live" ? "op" : sourceMode;

  try {
    const generated = generateNetlist(candidate.circuit, mode).netlist;
    const titleEnd = generated.indexOf("\n");
    if (titleEnd < 0) throw new Error("The public netlist generator returned no SPICE title line");
    return `${generated.slice(0, titleEnd + 1)}${headerComments(candidate, mode).join("\n")}\n${generated.slice(titleEnd + 1)}`;
  } catch (error) {
    if (error instanceof CandidateSpiceExportError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new CandidateSpiceExportError(
      "generation_failed",
      `Cannot export candidate ${singleLine(candidate.id)}: SPICE generation failed (${singleLine(detail)}).`,
    );
  }
}
