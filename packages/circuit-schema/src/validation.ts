import { SIGNAL_EXPRESSION_VERSION, type SerializedNodeReference, type SerializedSignalExpression } from "@opencircuit/signal-workbench";
import { inspectACConfig, inspectSourceWaveform, inspectTransientConfig } from "./analysis";
import { inspectDCSweepConfig } from "./dc-sweep";
import {
  importedModelPartId,
  inspectImportedAnalysisValidity,
  MAX_IMPORTED_MODEL_PARTS,
  MAX_IMPORTED_MODEL_SOURCE_BYTES,
  MAX_IMPORTED_MODEL_TOTAL_BYTES,
} from "./imports";
import { inspectNoiseConfig } from "./noise";
import { componentPinPoints, finiteEngineering, isCatalogOnlyType, partByType } from "./parts";
import { SPICE_NODE_TOKEN_PATTERN, hasForbiddenControl, hasUnpairedSurrogate, isSafeDecimalValue } from "./spice-token";
import type { CircuitDocument, ImportedModelPart, ValidationIssue } from "./types";

const idPattern = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const netLabelPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const importedIdPattern = /^imp_[0-9a-f]{16}$/;
const pointKey = ([x, y]: readonly [number, number]): string => `${x},${y}`;

class Connectivity {
  private readonly parents = new Map<string, string>();
  find(key: string): string {
    const parent = this.parents.get(key);
    if (!parent) { this.parents.set(key, key); return key; }
    if (parent === key) return key;
    const root = this.find(parent);
    this.parents.set(key, root);
    return root;
  }
  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parents.set(rightRoot, leftRoot);
  }
}

function expressionIssues(
  document: CircuitDocument,
  expression: SerializedSignalExpression,
  path: string,
  depth = 0,
): ValidationIssue[] {
  if (depth > 32) return [{ path, message: "Signal expressions are limited to 32 nested operations" }];
  const issues: ValidationIssue[] = [];
  const inspectNode = (reference: SerializedNodeReference, referencePath: string): void => {
    if (reference.kind === "runtime-node") {
      if (!SPICE_NODE_TOKEN_PATTERN.test(reference.name)) issues.push({ path: referencePath, message: "Runtime node references must be safe SPICE node tokens" });
      return;
    }
    if (reference.kind === "schematic-wire") {
      if (!document.wires.some((wire) => wire.id === reference.wireId)) issues.push({ path: referencePath, message: `Signal expression references missing wire ${reference.wireId}` });
      return;
    }
    const component = document.components.find((candidate) => candidate.id === reference.componentId);
    if (!component) {
      issues.push({ path: referencePath, message: `Signal expression references missing component ${reference.componentId}`, componentId: reference.componentId });
      return;
    }
    if (!Number.isInteger(reference.pin) || reference.pin < 0 || reference.pin >= componentPinPoints(component).length) issues.push({ path: referencePath, message: `Signal expression references invalid pin ${reference.pin} on ${reference.componentId}`, componentId: reference.componentId });
  };

  switch (expression.kind) {
    case "constant":
      if (!Number.isFinite(expression.value)) issues.push({ path: `${path}.value`, message: "Signal constants must be finite" });
      break;
    case "voltage":
      inspectNode(expression.positive, `${path}.positive`);
      inspectNode(expression.negative, `${path}.negative`);
      break;
    case "current":
    case "power": {
      const component = expression.component;
      if (component.kind === "runtime-device") {
        if (!component.name.trim()) issues.push({ path: `${path}.component`, message: "Runtime device references must not be empty" });
      } else if (!document.components.some((candidate) => candidate.id === component.componentId)) {
        issues.push({ path: `${path}.component`, message: `Signal expression references missing component ${component.componentId}`, componentId: component.componentId });
      }
      break;
    }
    case "unary":
      issues.push(...expressionIssues(document, expression.operand, `${path}.operand`, depth + 1));
      break;
    case "binary":
      issues.push(...expressionIssues(document, expression.left, `${path}.left`, depth + 1));
      issues.push(...expressionIssues(document, expression.right, `${path}.right`, depth + 1));
      break;
    case "call":
      if (expression.arguments.length === 0) issues.push({ path: `${path}.arguments`, message: "Signal functions need at least one argument" });
      expression.arguments.forEach((argument, index) => issues.push(...expressionIssues(document, argument, `${path}.arguments.${index}`, depth + 1)));
      break;
  }
  return issues;
}

function importedPartIssues(part: ImportedModelPart, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!importedIdPattern.test(part.id)) issues.push({ path: `${path}.id`, message: "Imported part id must be a deterministic content id" });
  else if (part.id !== importedModelPartId(part)) issues.push({ path: `${path}.id`, message: "Imported part id does not match its source, selected definition and pin map" });
  if (!part.sourceName.trim() || part.sourceName.length > 256 || /[\r\n\0]/.test(part.sourceName)) issues.push({ path: `${path}.sourceName`, message: "Imported source name must be a non-empty single-line value of at most 256 characters" });
  const sourceBytes = new TextEncoder().encode(part.sourceText).byteLength;
  if (sourceBytes === 0) issues.push({ path: `${path}.sourceText`, message: "Imported model source must not be empty" });
  if (sourceBytes > MAX_IMPORTED_MODEL_SOURCE_BYTES) issues.push({ path: `${path}.sourceText`, message: `Each imported model source is limited to ${MAX_IMPORTED_MODEL_SOURCE_BYTES.toLocaleString()} bytes` });
  if (!part.definition.name.trim() || /\s/.test(part.definition.name) || part.definition.name.length > 256) issues.push({ path: `${path}.definition.name`, message: "Imported definition name must be a non-empty SPICE token of at most 256 characters" });
  if (part.definition.scopePath.some((segment) => !segment.trim() || /\s/.test(segment))) issues.push({ path: `${path}.definition.scopePath`, message: "Imported definition scope segments must be non-empty SPICE tokens" });
  if (part.definition.librarySection !== undefined && (!part.definition.librarySection.trim() || /\s/.test(part.definition.librarySection))) issues.push({ path: `${path}.definition.librarySection`, message: "Imported library section must be a non-empty SPICE token" });
  issues.push(...inspectImportedAnalysisValidity((part as ImportedModelPart & { analysisValidity?: unknown }).analysisValidity)
    .map((issue) => ({ path: `${path}.${issue.path}`, message: issue.message })));
  let symbolPinCount = 0;
  try { symbolPinCount = partByType(part.baseType).pins.length; }
  catch { issues.push({ path: `${path}.baseType`, message: `Imported part uses unsupported symbol type ${String(part.baseType)}` }); }
  if (part.definition.kind === "model") {
    if (part.pinMapping.length !== 0) issues.push({ path: `${path}.pinMapping`, message: "Primitive .model imports must not carry a subcircuit pin map" });
  } else {
    if (part.pinMapping.length !== symbolPinCount) issues.push({ path: `${path}.pinMapping`, message: `Imported subcircuit pin map must contain exactly ${symbolPinCount} symbol pins` });
    const symbolPins = new Set<number>();
    const modelPins = new Set<number>();
    for (const [index, mapping] of part.pinMapping.entries()) {
      if (!Number.isInteger(mapping.symbolPinIndex) || mapping.symbolPinIndex < 0 || mapping.symbolPinIndex >= symbolPinCount) issues.push({ path: `${path}.pinMapping.${index}.symbolPinIndex`, message: "Imported symbol pin index is outside the selected symbol" });
      if (!Number.isInteger(mapping.modelPinIndex) || mapping.modelPinIndex < 0) issues.push({ path: `${path}.pinMapping.${index}.modelPinIndex`, message: "Imported model pin index must be a non-negative integer" });
      if (symbolPins.has(mapping.symbolPinIndex)) issues.push({ path: `${path}.pinMapping.${index}.symbolPinIndex`, message: `Imported symbol pin ${mapping.symbolPinIndex} is mapped more than once` });
      if (modelPins.has(mapping.modelPinIndex)) issues.push({ path: `${path}.pinMapping.${index}.modelPinIndex`, message: `Imported model pin ${mapping.modelPinIndex} is mapped more than once` });
      symbolPins.add(mapping.symbolPinIndex);
      modelPins.add(mapping.modelPinIndex);
    }
  }
  return issues;
}

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
    if (valueTypes.has(component.type) && component.value !== undefined) {
      try { finiteEngineering(component.value, 0); }
      catch { unsafe(`components.${component.id}.value`, component.id); }
    }
    for (const key of engineeringParamKeys[component.type] ?? []) {
      const value = component.params?.[key];
      if (value !== undefined) {
        if (typeof value !== "number" && typeof value !== "string") unsafe(`components.${component.id}.params.${key}`, component.id);
        else {
          try { finiteEngineering(value, 0); }
          catch { unsafe(`components.${component.id}.params.${key}`, component.id); }
        }
      }
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
  return issues;
}

export function validateCircuit(document: CircuitDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!document || typeof document !== "object" || document.format !== "opencircuit-circuit" || document.version !== 3) return [{ path: "version", message: "Unsupported circuit document format or version" }];
  if (!document.meta?.title?.trim()) issues.push({ path: "meta.title", message: "Workspace needs a title" });
  if (!Array.isArray(document.components) || !Array.isArray(document.wires) || !Array.isArray(document.probes)) return [...issues, { path: "document", message: "Circuit components, wires and probes must be arrays" }];
  const ids = new Set<string>();
  for (const component of document.components) {
    if (!idPattern.test(component.id)) issues.push({ path: `components.${component.id}.id`, message: `Invalid component id ${component.id}`, componentId: component.id });
    if (ids.has(component.id)) issues.push({ path: `components.${component.id}`, message: `Duplicate id ${component.id}`, componentId: component.id });
    ids.add(component.id);
    if (!Array.isArray(component.pos) || !Number.isInteger(component.pos[0]) || !Number.isInteger(component.pos[1])) issues.push({ path: `components.${component.id}.pos`, message: "Component position must be on the grid", componentId: component.id });
    try { componentPinPoints(component); } catch (error) { issues.push({ path: `components.${component.id}.type`, message: error instanceof Error ? error.message : String(error), componentId: component.id }); }
    if (isCatalogOnlyType(component.type)) {
      const catalogPartId = component.params?.catalogPartId;
      if (typeof catalogPartId !== "string" || !catalogPartId.trim()) {
        issues.push({ path: `components.${component.id}.params.catalogPartId`, message: `Component ${component.id} uses a catalog-only ${component.type} symbol, which carries no generic model; select a reviewed catalog package for it`, componentId: component.id });
      }
      if (component.value !== undefined) {
        issues.push({ path: `components.${component.id}.value`, message: `Component ${component.id} uses a catalog-only ${component.type} symbol, whose electrical behaviour comes from its catalog package rather than an editable value`, componentId: component.id });
      }
    }
    issues.push(...inspectSourceWaveform(component));
  }
  for (const wire of document.wires) {
    if (!idPattern.test(wire.id)) issues.push({ path: `wires.${wire.id}.id`, message: `Invalid wire id ${wire.id}` });
    if (ids.has(wire.id)) issues.push({ path: `wires.${wire.id}`, message: `Duplicate id ${wire.id}` });
    ids.add(wire.id);
    if (!Array.isArray(wire.points) || wire.points.length < 2) issues.push({ path: `wires.${wire.id}.points`, message: "Wire needs at least two points" });
    else wire.points.slice(1).forEach((point, index) => { const prior = wire.points[index]!; if (point[0] !== prior[0] && point[1] !== prior[1]) issues.push({ path: `wires.${wire.id}.points.${index+1}`, message: "Wire segments must be orthogonal" }); });
    if (wire.netLabel !== undefined && (!netLabelPattern.test(wire.netLabel) || wire.netLabel === "0")) {
      issues.push({ path: `wires.${wire.id}.netLabel`, message: "Net labels must start with a letter or underscore, contain only letters, digits or underscores, and must not be 0" });
    }
  }
  const connectivity = new Connectivity();
  for (const wire of document.wires) {
    const first = wire.points[0];
    if (!first) continue;
    const firstKey = pointKey(first);
    connectivity.find(firstKey);
    for (const point of wire.points.slice(1)) connectivity.union(firstKey, pointKey(point));
  }
  const grounds = document.components.filter((component) => component.type === "ground");
  const groundKeys = grounds.flatMap((ground) => componentPinPoints(ground).slice(0, 1).map(pointKey));
  if (groundKeys[0]) for (const key of groundKeys.slice(1)) connectivity.union(groundKeys[0], key);
  const groundRoot = groundKeys[0] ? connectivity.find(groundKeys[0]) : undefined;
  const labelOwners = new Map<string, string>();
  const labelsByRoot = new Map<string, string>();
  for (const wire of document.wires) {
    if (!wire.netLabel || !wire.points[0] || !netLabelPattern.test(wire.netLabel) || wire.netLabel === "0") continue;
    const normalized = wire.netLabel.toLowerCase();
    const duplicate = labelOwners.get(normalized);
    if (duplicate) issues.push({ path: `wires.${wire.id}.netLabel`, message: `Net label ${wire.netLabel} is already used by wire ${duplicate}` });
    else labelOwners.set(normalized, wire.id);
    const root = connectivity.find(pointKey(wire.points[0]));
    if (groundRoot && root === groundRoot) issues.push({ path: `wires.${wire.id}.netLabel`, message: `Net label ${wire.netLabel} cannot name the ground net` });
    const existing = labelsByRoot.get(root);
    if (existing && existing.toLowerCase() !== normalized) issues.push({ path: `wires.${wire.id}.netLabel`, message: `Connected net is already named ${existing}` });
    else labelsByRoot.set(root, wire.netLabel);
  }
  for (const [index, probe] of document.probes.entries()) {
    if (!idPattern.test(probe.id)) issues.push({ path: `probes.${index}.id`, message: `Invalid probe id ${probe.id}` });
    if (ids.has(probe.id)) issues.push({ path: `probes.${index}.id`, message: `Duplicate id ${probe.id}` });
    ids.add(probe.id);
    if (probe.expressionVersion !== SIGNAL_EXPRESSION_VERSION) issues.push({ path: `probes.${index}.expressionVersion`, message: `Unsupported signal expression version ${String(probe.expressionVersion)}` });
    issues.push(...expressionIssues(document, probe.expression, `probes.${index}.expression`));
  }
  if (!document.components.some((component) => component.type === "ground")) issues.push({ path: "components", message: "Add a ground symbol before running the circuit" });
  issues.push(...inspectNetlistedTokens(document));

  if (document.modelImports) {
    if (document.modelImports.format !== "opencircuit-imported-models" || document.modelImports.version !== 1) issues.push({ path: "modelImports.version", message: "Unsupported imported-model library format or version" });
    if (document.modelImports.parts.length > MAX_IMPORTED_MODEL_PARTS) issues.push({ path: "modelImports.parts", message: `A circuit may contain at most ${MAX_IMPORTED_MODEL_PARTS} imported model definitions` });
    let totalBytes = 0;
    const importIds = new Set<string>();
    for (const [index, part] of document.modelImports.parts.entries()) {
      totalBytes += new TextEncoder().encode(part.sourceText).byteLength;
      if (importIds.has(part.id)) issues.push({ path: `modelImports.parts.${index}.id`, message: `Duplicate imported part id ${part.id}` });
      importIds.add(part.id);
      issues.push(...importedPartIssues(part, `modelImports.parts.${index}`));
    }
    if (totalBytes > MAX_IMPORTED_MODEL_TOTAL_BYTES) issues.push({ path: "modelImports.parts", message: `Imported model source is limited to ${MAX_IMPORTED_MODEL_TOTAL_BYTES.toLocaleString()} aggregate bytes per circuit` });
    for (const component of document.components) {
      if (!component.params || !Object.prototype.hasOwnProperty.call(component.params, "importedPartId")) continue;
      const importedPartId = component.params.importedPartId;
      const part = typeof importedPartId === "string" ? document.modelImports.parts.find((candidate) => candidate.id === importedPartId) : undefined;
      if (!part) issues.push({ path: `components.${component.id}.params.importedPartId`, message: `Component ${component.id} references a missing imported model`, componentId: component.id });
      else if (part.baseType !== component.type) issues.push({ path: `components.${component.id}.params.importedPartId`, message: `Imported model ${part.definition.name} requires a ${part.baseType} symbol, not ${component.type}`, componentId: component.id });
    }
  } else {
    for (const component of document.components) if (component.params && Object.prototype.hasOwnProperty.call(component.params, "importedPartId")) issues.push({ path: `components.${component.id}.params.importedPartId`, message: `Component ${component.id} references an imported model, but the document has no imported-model library`, componentId: component.id });
  }

  if (document.sim.tran || document.sim.mode === "tran") issues.push(...inspectTransientConfig(document.sim.tran));
  if (document.sim.ac || document.sim.mode === "ac") issues.push(...inspectACConfig(document, document.sim.ac));
  if (document.sim.dcSweep || document.sim.mode === "dc-sweep") issues.push(...inspectDCSweepConfig(document, document.sim.dcSweep).issues);
  if (document.sim.noise || document.sim.mode === "noise") issues.push(...inspectNoiseConfig(document, document.sim.noise).issues);
  return issues;
}

export function assertValidCircuit(document: CircuitDocument): void {
  const issue = validateCircuit(document)[0];
  if (issue) throw new Error(issue.message);
}
