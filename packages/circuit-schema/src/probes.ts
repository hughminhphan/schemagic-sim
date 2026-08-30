import { SIGNAL_EXPRESSION_VERSION, type SerializedNodeReference, type SerializedSignalExpression } from "@opencircuit/signal-workbench";
import type { CircuitProbe } from "./types";

interface ProbePresentation { label?: string; color?: string }

function presentation(id: string, value: ProbePresentation): Pick<CircuitProbe, "id" | "expressionVersion" | "label" | "color"> {
  return {
    id,
    expressionVersion: SIGNAL_EXPRESSION_VERSION,
    ...(value.label === undefined ? {} : { label: value.label }),
    ...(value.color === undefined ? {} : { color: value.color }),
  };
}

export function wireVoltageProbe(id: string, wireId: string, options: ProbePresentation = {}): CircuitProbe {
  return {
    ...presentation(id, options),
    expression: {
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId },
      negative: { kind: "runtime-node", name: "0" },
    },
  };
}

export function pinVoltageProbe(id: string, componentId: string, pin: number, options: ProbePresentation = {}): CircuitProbe {
  return {
    ...presentation(id, options),
    expression: {
      kind: "voltage",
      positive: { kind: "schematic-pin", componentId, pin },
      negative: { kind: "runtime-node", name: "0" },
    },
  };
}

export function componentCurrentProbe(id: string, componentId: string, terminal?: number | string, options: ProbePresentation = {}): CircuitProbe {
  return {
    ...presentation(id, options),
    expression: {
      kind: "current",
      component: { kind: "schematic-component", componentId },
      ...(terminal === undefined ? {} : { terminal }),
    },
  };
}

export function componentPowerProbe(id: string, componentId: string, options: ProbePresentation = {}): CircuitProbe {
  return {
    ...presentation(id, options),
    expression: { kind: "power", component: { kind: "schematic-component", componentId } },
  };
}

export function removeCircuitProbe(probes: readonly CircuitProbe[], probeId: string): CircuitProbe[] {
  return probes.filter((probe) => probe.id !== probeId);
}

export function simpleVoltageExpression(probe: CircuitProbe): Extract<SerializedSignalExpression, { kind: "voltage" }> | undefined {
  return probe.expression.kind === "voltage" ? probe.expression : undefined;
}

export function probeDisplayLabel(probe: CircuitProbe): string {
  if (probe.label?.trim()) return probe.label.trim();
  const expression = probe.expression;
  if (expression.kind === "voltage") return `V(${nodeReferenceLabel(expression.positive)}, ${nodeReferenceLabel(expression.negative)})`;
  if (expression.kind === "current") return `I(${expression.component.kind === "schematic-component" ? expression.component.componentId : expression.component.name}${expression.terminal === undefined ? "" : `:${String(expression.terminal)}`})`;
  if (expression.kind === "power") return `P(${expression.component.kind === "schematic-component" ? expression.component.componentId : expression.component.name})`;
  return expression.kind === "constant" ? `${expression.value} ${expression.unit}` : `${expression.kind} expression`;
}

export function nodeReferenceLabel(reference: SerializedNodeReference): string {
  if (reference.kind === "schematic-wire") return `wire:${reference.wireId}`;
  if (reference.kind === "schematic-pin") return `${reference.componentId}.${reference.pin + 1}`;
  return reference.name;
}

export function resolveNodeReference(
  reference: SerializedNodeReference,
  componentNodes: Readonly<Record<string, readonly string[]>>,
  wireNodes: Readonly<Record<string, string>>,
): string | undefined {
  if (reference.kind === "runtime-node") return reference.name;
  if (reference.kind === "schematic-wire") return wireNodes[reference.wireId];
  return componentNodes[reference.componentId]?.[reference.pin];
}

export function resolveVoltageProbeNodes(
  probe: CircuitProbe,
  componentNodes: Readonly<Record<string, readonly string[]>>,
  wireNodes: Readonly<Record<string, string>>,
): { positiveNode: string; negativeNode: string } | undefined {
  const voltage = simpleVoltageExpression(probe);
  if (!voltage) return undefined;
  const positiveNode = resolveNodeReference(voltage.positive, componentNodes, wireNodes);
  const negativeNode = resolveNodeReference(voltage.negative, componentNodes, wireNodes);
  return positiveNode && negativeNode ? { positiveNode, negativeNode } : undefined;
}
