import { inspectDCSweepConfig } from "./dc-sweep";
import { inspectNoiseConfig } from "./noise";
import { componentPinPoints } from "./parts";
import { SPICE_NODE_TOKEN_PATTERN, hasForbiddenControl, hasUnpairedSurrogate, isSafeDecimalValue, isSafeEngineeringValue } from "./spice-token";
import type { CircuitDocument, ValidationIssue } from "./types";

function inspectNetlistedTokens(document: CircuitDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const unsafe = (path: string, componentId?: string, message = "Recognized SPICE values must be finite numbers or safe ASCII engineering literals"): void => {
    issues.push({ path, message, ...(componentId ? { componentId } : {}) });
  };
  const engineeringParamKeys: Partial<Record<string, readonly string[]>> = {
    vsource: ["ac"],
    vsource_pulse: ["v1", "v2", "delay", "rise", "fall", "width", "period"],
    vsource_sine: ["offset", "frequency", "ac"],
  };
  const valueTypes = new Set(["resistor", "capacitor", "inductor", "vsource", "vsource_pulse", "vsource_sine", "isource", "potentiometer"]);
  for (const component of document.components) {
    if (typeof component.id !== "string" || hasForbiddenControl(component.id) || /[\u0080-\u009f\u2028\u2029]/u.test(component.id) || hasUnpairedSurrogate(component.id)) {
      unsafe(`components.${String(component.id)}.id`, undefined, "Component IDs in generated comments cannot contain line-breaking, control, or invalid Unicode characters");
    }
    if (valueTypes.has(component.type) && component.value !== undefined && !isSafeEngineeringValue(component.value)) {
      unsafe(`components.${component.id}.value`, component.id);
    }
    for (const key of engineeringParamKeys[component.type] ?? []) {
      const value = component.params?.[key];
      if (value !== undefined && !isSafeEngineeringValue(value)) unsafe(`components.${component.id}.params.${key}`, component.id);
    }
    if (component.type === "potentiometer" && component.params?.t !== undefined && !isSafeDecimalValue(component.params.t)) {
      unsafe(`components.${component.id}.params.t`, component.id);
    }
    if (component.type === "switch_spst" && component.params?.closed !== undefined && typeof component.params.closed !== "boolean") {
      unsafe(`components.${component.id}.params.closed`, component.id);
    }
  }
  const finite = (value: unknown, path: string): void => { if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) unsafe(path); };
  finite(document.sim.tran?.tstop, "sim.tran.tstop");
  finite(document.sim.tran?.tstep, "sim.tran.tstep");
  finite(document.sim.tran?.maxstep, "sim.tran.maxstep");
  finite(document.sim.ac?.fstart, "sim.ac.fstart");
  finite(document.sim.ac?.fstop, "sim.ac.fstop");
  finite(document.sim.ac?.pointsPerDecade, "sim.ac.pointsPerDecade");
  for (const probe of document.probes) {
    if (probe.target.node !== undefined && !SPICE_NODE_TOKEN_PATTERN.test(probe.target.node)) unsafe(`probes.${probe.id}.target.node`);
  }
  return issues;
}

export function validateCircuit(document: CircuitDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (document.format !== "opencircuit-circuit" || document.version !== 1) issues.push({ path: "version", message: "Unsupported circuit document format or version" });
  if (!document.meta?.title?.trim()) issues.push({ path: "meta.title", message: "Workspace needs a title" });
  const ids = new Set<string>();
  for (const component of document.components) {
    if (ids.has(component.id)) issues.push({ path: `components.${component.id}`, message: `Duplicate id ${component.id}`, componentId: component.id });
    ids.add(component.id);
    if (!Number.isInteger(component.pos[0]) || !Number.isInteger(component.pos[1])) issues.push({ path: `components.${component.id}.pos`, message: "Component position must be on the grid", componentId: component.id });
    try { componentPinPoints(component); } catch (error) { issues.push({ path: `components.${component.id}.type`, message: error instanceof Error ? error.message : String(error), componentId: component.id }); }
  }
  for (const wire of document.wires) {
    if (ids.has(wire.id)) issues.push({ path: `wires.${wire.id}`, message: `Duplicate id ${wire.id}` });
    ids.add(wire.id);
    if (wire.points.length < 2) issues.push({ path: `wires.${wire.id}.points`, message: "Wire needs at least two points" });
    wire.points.slice(1).forEach((point, index) => { const prior = wire.points[index]!; if (point[0] !== prior[0] && point[1] !== prior[1]) issues.push({ path: `wires.${wire.id}.points.${index+1}`, message: "Wire segments must be orthogonal" }); });
  }
  if (!document.components.some((component) => component.type === "ground")) issues.push({ path: "components", message: "Add a ground symbol before running the circuit" });
  issues.push(...inspectNetlistedTokens(document));
  if (document.sim.mode === "dc-sweep") issues.push(...inspectDCSweepConfig(document, document.sim.dcSweep).issues);
  if (document.sim.mode === "noise") issues.push(...inspectNoiseConfig(document, document.sim.noise).issues);
  return issues;
}
export function assertValidCircuit(document: CircuitDocument): void {
  const issue = validateCircuit(document)[0];
  if (issue) throw new Error(issue.message);
}
