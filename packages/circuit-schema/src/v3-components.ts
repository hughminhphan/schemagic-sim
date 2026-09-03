import { componentPinPoints, finiteEngineering, spiceNumber } from "./parts";
import type {
  BehavioralExpressionV3,
  BehavioralNodeReferenceV3,
  CircuitComponent,
  CircuitDocument,
  ComponentType,
  EngineeringValue,
  ValidationIssue,
} from "./types";

export function defaultComponentParamsV3(type: ComponentType): Record<string, unknown> | undefined {
  switch (type) {
    case "switch_spst":
    case "switch_pushbutton":
    case "switch_toggle": return { closed: false };
    case "switch_spdt":
    case "switch_dpdt": return { throw: "a" };
    case "switch_vcontrolled": return { ron: "1m", roff: "1G", threshold: 2.5, hysteresis: 0 };
    case "vcvs":
    case "vccs":
    case "cccs":
    case "ccvs": return { gain: 1 };
    case "behavioral_source": return { output: "voltage", expression: { kind: "constant", value: 0 } };
    case "transformer": return { primaryInductance: "10m", secondaryInductance: "10m", coupling: 0.999 };
    case "crystal": return { seriesResistance: 30, seriesInductance: "10m", seriesCapacitance: "20f", parallelCapacitance: "3p" };
    case "transmission_line": return { impedance: 50, delay: "1n" };
    case "fuse": return { blown: false, blownResistance: "1G" };
    case "isource_pulse": return { i1: 0, i2: "1m", delay: "1m", rise: "10u", fall: "10u", width: "4m", period: "10m" };
    default: return undefined;
  }
}

function recordParams(component: CircuitComponent, issues: ValidationIssue[]): Record<string, unknown> | undefined {
  const params = component.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    issues.push({ path: `components.${component.id}.params`, message: `${component.type} requires its typed Simulator V3 parameters`, componentId: component.id });
    return undefined;
  }
  return params;
}

function engineering(
  component: CircuitComponent,
  params: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
  options: { positive?: boolean; nonNegative?: boolean } = {},
): number | undefined {
  const value = params[key];
  if (typeof value !== "number" && typeof value !== "string") {
    issues.push({ path: `components.${component.id}.params.${key}`, message: `${key} must be a finite engineering value`, componentId: component.id });
    return undefined;
  }
  let parsed: number;
  try { parsed = finiteEngineering(value, Number.NaN, key); }
  catch {
    issues.push({ path: `components.${component.id}.params.${key}`, message: `${key} must be a finite engineering value`, componentId: component.id });
    return undefined;
  }
  if (options.positive && parsed <= 0) issues.push({ path: `components.${component.id}.params.${key}`, message: `${key} must be greater than zero`, componentId: component.id });
  if (options.nonNegative && parsed < 0) issues.push({ path: `components.${component.id}.params.${key}`, message: `${key} must not be negative`, componentId: component.id });
  return parsed;
}

function nodeReferenceIssues(
  document: CircuitDocument,
  component: CircuitComponent,
  reference: unknown,
  path: string,
): ValidationIssue[] {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    return [{ path, message: "Behavioral voltage references must use a typed ground, wire, or component-pin reference", componentId: component.id }];
  }
  const candidate = reference as Partial<BehavioralNodeReferenceV3> & Record<string, unknown>;
  if (candidate.kind === "ground") return [];
  if (candidate.kind === "wire") {
    return typeof candidate.wireId === "string" && document.wires.some((wire) => wire.id === candidate.wireId)
      ? []
      : [{ path: `${path}.wireId`, message: "Behavioral voltage reference names a missing wire", componentId: component.id }];
  }
  if (candidate.kind === "pin") {
    const target = typeof candidate.componentId === "string"
      ? document.components.find((entry) => entry.id === candidate.componentId)
      : undefined;
    if (!target) return [{ path: `${path}.componentId`, message: "Behavioral voltage reference names a missing component", componentId: component.id }];
    if (!Number.isInteger(candidate.pin) || Number(candidate.pin) < 0 || Number(candidate.pin) >= componentPinPoints(target).length) {
      return [{ path: `${path}.pin`, message: "Behavioral voltage reference pin must be a non-negative integer", componentId: component.id }];
    }
    return [];
  }
  return [{ path: `${path}.kind`, message: "Behavioral voltage references allow only ground, wire, or component pin kinds", componentId: component.id }];
}

function behavioralExpressionIssues(
  document: CircuitDocument,
  component: CircuitComponent,
  expression: unknown,
  path: string,
  depth = 0,
): ValidationIssue[] {
  if (depth > 16) return [{ path, message: "Behavioral expressions are limited to 16 nested operations", componentId: component.id }];
  if (!expression || typeof expression !== "object" || Array.isArray(expression)) {
    return [{ path, message: "Behavioral expressions must use the typed expression contract; raw SPICE text is not accepted", componentId: component.id }];
  }
  const value = expression as Partial<BehavioralExpressionV3> & Record<string, unknown>;
  if (value.kind === "constant") {
    if (typeof value.value !== "number" && typeof value.value !== "string") return [{ path: `${path}.value`, message: "Behavioral constants must be finite engineering values", componentId: component.id }];
    try { finiteEngineering(value.value, Number.NaN, "Behavioral constant"); return []; }
    catch { return [{ path: `${path}.value`, message: "Behavioral constants must be finite engineering values", componentId: component.id }]; }
  }
  if (value.kind === "voltage") {
    const issues = nodeReferenceIssues(document, component, value.positive, `${path}.positive`);
    if (value.negative !== undefined) issues.push(...nodeReferenceIssues(document, component, value.negative, `${path}.negative`));
    return issues;
  }
  if (value.kind === "unary") {
    const issues: ValidationIssue[] = value.operator === "+" || value.operator === "-"
      ? []
      : [{ path: `${path}.operator`, message: "Behavioral unary operator must be + or -", componentId: component.id }];
    issues.push(...behavioralExpressionIssues(document, component, value.operand, `${path}.operand`, depth + 1));
    return issues;
  }
  if (value.kind === "binary") {
    const issues: ValidationIssue[] = ["+", "-", "*", "/", "^"].includes(String(value.operator))
      ? []
      : [{ path: `${path}.operator`, message: "Behavioral binary operator is not supported", componentId: component.id }];
    issues.push(...behavioralExpressionIssues(document, component, value.left, `${path}.left`, depth + 1));
    issues.push(...behavioralExpressionIssues(document, component, value.right, `${path}.right`, depth + 1));
    return issues;
  }
  if (value.kind === "function") {
    const unary = new Set(["abs", "sqrt", "exp", "ln", "log", "sin", "cos", "tan"]);
    const binary = new Set(["min", "max"]);
    const name = String(value.name);
    const args = Array.isArray(value.arguments) ? value.arguments : [];
    const issues: ValidationIssue[] = unary.has(name)
      ? (args.length === 1 ? [] : [{ path: `${path}.arguments`, message: `${name} requires exactly one argument`, componentId: component.id }])
      : binary.has(name)
        ? (args.length === 2 ? [] : [{ path: `${path}.arguments`, message: `${name} requires exactly two arguments`, componentId: component.id }])
        : [{ path: `${path}.name`, message: "Behavioral function is not supported", componentId: component.id }];
    args.forEach((argument, index) => issues.push(...behavioralExpressionIssues(document, component, argument, `${path}.arguments.${index}`, depth + 1)));
    return issues;
  }
  return [{ path: `${path}.kind`, message: "Behavioral expression kind is not supported; raw SPICE text is not accepted", componentId: component.id }];
}

export function inspectSimulatorComponentV3(document: CircuitDocument, component: CircuitComponent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const binarySwitch = component.type === "switch_pushbutton" || component.type === "switch_toggle";
  if (binarySwitch) {
    const params = recordParams(component, issues);
    if (params && typeof params.closed !== "boolean") issues.push({ path: `components.${component.id}.params.closed`, message: `${component.type} closed must be boolean`, componentId: component.id });
    return issues;
  }
  if (component.type === "switch_spdt" || component.type === "switch_dpdt") {
    const params = recordParams(component, issues);
    if (params && params.throw !== "a" && params.throw !== "b") issues.push({ path: `components.${component.id}.params.throw`, message: `${component.type} throw must be a or b`, componentId: component.id });
    return issues;
  }
  if (component.type === "switch_vcontrolled") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    const ron = engineering(component, params, "ron", issues, { positive: true });
    const roff = engineering(component, params, "roff", issues, { positive: true });
    engineering(component, params, "threshold", issues);
    engineering(component, params, "hysteresis", issues, { nonNegative: true });
    if (ron !== undefined && roff !== undefined && roff <= ron) issues.push({ path: `components.${component.id}.params.roff`, message: "roff must be greater than ron", componentId: component.id });
    return issues;
  }
  if (["vcvs", "vccs", "cccs", "ccvs"].includes(component.type)) {
    const params = recordParams(component, issues);
    if (params) engineering(component, params, "gain", issues);
    return issues;
  }
  if (component.type === "behavioral_source") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    if (params.output !== "voltage" && params.output !== "current") issues.push({ path: `components.${component.id}.params.output`, message: "Behavioral source output must be voltage or current", componentId: component.id });
    issues.push(...behavioralExpressionIssues(document, component, params.expression, `components.${component.id}.params.expression`));
    return issues;
  }
  if (component.type === "transformer") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    engineering(component, params, "primaryInductance", issues, { positive: true });
    engineering(component, params, "secondaryInductance", issues, { positive: true });
    if (typeof params.coupling !== "number" || !Number.isFinite(params.coupling) || params.coupling <= 0 || params.coupling > 1) {
      issues.push({ path: `components.${component.id}.params.coupling`, message: "Transformer coupling must be a finite number greater than zero and at most one", componentId: component.id });
    }
    return issues;
  }
  if (component.type === "crystal") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    for (const key of ["seriesResistance", "seriesInductance", "seriesCapacitance", "parallelCapacitance"]) engineering(component, params, key, issues, { positive: true });
    return issues;
  }
  if (component.type === "transmission_line") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    engineering(component, params, "impedance", issues, { positive: true });
    engineering(component, params, "delay", issues, { positive: true });
    return issues;
  }
  if (component.type === "fuse") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    if (typeof params.blown !== "boolean") issues.push({ path: `components.${component.id}.params.blown`, message: "Fuse blown must be boolean", componentId: component.id });
    engineering(component, params, "blownResistance", issues, { positive: true });
    if (component.value !== undefined) {
      try { if (finiteEngineering(component.value, Number.NaN, "Fuse resistance") <= 0) throw new Error(); }
      catch { issues.push({ path: `components.${component.id}.value`, message: "Fuse resistance must be a finite engineering value greater than zero", componentId: component.id }); }
    }
    return issues;
  }
  if (component.type === "isource_pulse") {
    const params = recordParams(component, issues);
    if (!params) return issues;
    engineering(component, params, "i1", issues);
    engineering(component, params, "i2", issues);
    engineering(component, params, "delay", issues, { nonNegative: true });
    const rise = engineering(component, params, "rise", issues, { nonNegative: true });
    const fall = engineering(component, params, "fall", issues, { nonNegative: true });
    const width = engineering(component, params, "width", issues, { positive: true });
    const period = engineering(component, params, "period", issues, { positive: true });
    if (rise !== undefined && width !== undefined && fall !== undefined && period !== undefined && rise + width + fall > period) {
      issues.push({ path: `components.${component.id}.params`, message: "Current pulse rise, width, and fall must fit within its period", componentId: component.id });
    }
    return issues;
  }
  return issues;
}

export interface BehavioralExpressionNodeResolverV3 {
  node(reference: BehavioralNodeReferenceV3): string;
}

/** Safe renderer: every emitted token comes from an enum or spiceNumber. */
export function renderBehavioralExpressionV3(
  expression: BehavioralExpressionV3,
  resolver: BehavioralExpressionNodeResolverV3,
): string {
  switch (expression.kind) {
    case "constant": return spiceNumber(expression.value as EngineeringValue, 0, "Behavioral constant");
    case "voltage": {
      const positive = resolver.node(expression.positive);
      const negative = expression.negative ? resolver.node(expression.negative) : "0";
      return negative === "0" ? `v(${positive})` : `v(${positive},${negative})`;
    }
    case "unary": return `(${expression.operator}${renderBehavioralExpressionV3(expression.operand, resolver)})`;
    case "binary": return `(${renderBehavioralExpressionV3(expression.left, resolver)}${expression.operator}${renderBehavioralExpressionV3(expression.right, resolver)})`;
    case "function": return `${expression.name}(${expression.arguments.map((argument) => renderBehavioralExpressionV3(argument, resolver)).join(",")})`;
  }
}
