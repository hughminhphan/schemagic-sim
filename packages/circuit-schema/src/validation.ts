import { inspectDCSweepConfig } from "./dc-sweep";
import { componentPinPoints } from "./parts";
import type { CircuitDocument, ValidationIssue } from "./types";

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
  if (document.sim.mode === "dc-sweep") issues.push(...inspectDCSweepConfig(document, document.sim.dcSweep).issues);
  return issues;
}
export function assertValidCircuit(document: CircuitDocument): void {
  const issue = validateCircuit(document)[0];
  if (issue) throw new Error(issue.message);
}
