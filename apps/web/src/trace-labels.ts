import { componentPinPoints, partByType, probeDisplayLabel, type CircuitComponent, type CircuitDocument, type CircuitProbe, type ComponentType } from "@opencircuit/circuit-schema";
import type { SerializedNodeReference } from "@opencircuit/signal-workbench";

/**
 * Human-facing trace names only. The serialized probe expression, the persisted
 * probe format and every netlist node name stay exactly as they are: this module
 * exists so the scope legend reads "V(D1 anode)" instead of "V(c6.1, 0)".
 */
const PIN_NAMES: Partial<Record<ComponentType, readonly string[]>> = {
  diode: ["anode", "cathode"],
  led: ["anode", "cathode"],
  bjt_npn: ["collector", "base", "emitter"],
  bjt_pnp: ["collector", "base", "emitter"],
  nmos: ["drain", "gate", "source"],
  pmos: ["drain", "gate", "source"],
  opamp_ideal: ["in+", "in−", "out"],
  potentiometer: ["top", "wiper", "bottom"],
  vsource: ["+", "−"],
  vsource_pulse: ["+", "−"],
  vsource_sine: ["+", "−"],
  isource: ["+", "−"],
};

/** Devices whose pin names actually teach something get to name an unlabelled net. */
const NET_NAMING_PRIORITY: readonly ComponentType[] = [
  "led", "diode", "opamp_ideal", "bjt_npn", "bjt_pnp", "nmos", "pmos", "potentiometer",
  "vsource", "vsource_pulse", "vsource_sine", "isource", "switch_spst",
  "inductor", "capacitor", "resistor",
];

type CircuitView = Pick<CircuitDocument, "components" | "wires">;

export function componentReference(component: CircuitComponent): string {
  const text = component.label?.text?.trim();
  if (text) return text;
  return `${partByType(component.type).prefix}${component.id.replace(/^c/, "")}`;
}

function componentById(circuit: CircuitView | undefined, componentId: string): CircuitComponent | undefined {
  return circuit?.components.find((component) => component.id === componentId);
}

function pinName(component: CircuitComponent, pin: number): string | undefined {
  return PIN_NAMES[component.type]?.[pin];
}

function pinLabel(circuit: CircuitView | undefined, componentId: string, pin: number): string {
  const component = componentById(circuit, componentId);
  if (!component) return `${componentId}.${pin + 1}`;
  const reference = componentReference(component);
  const name = pinName(component, pin);
  return name ? `${reference} ${name}` : `${reference} pin ${pin + 1}`;
}

/** Name an unlabelled net after the most descriptive device pin that lands on it. */
function wireNetName(circuit: CircuitView | undefined, wireId: string): string {
  const wire = circuit?.wires.find((candidate) => candidate.id === wireId);
  const netLabel = wire?.netLabel?.trim();
  if (netLabel) return netLabel;
  if (!wire || !circuit) return `wire ${wireId}`;
  const points = new Set(wire.points.map((point) => point.join(",")));
  const attached = circuit.components
    .filter((component) => component.type !== "ground")
    .flatMap((component) => componentPinPoints(component)
      .map((point, pin) => ({ component, pin, point }))
      .filter((candidate) => points.has(candidate.point.join(","))));
  if (attached.length === 0) return `wire ${wireId}`;
  const rank = (component: CircuitComponent): number => {
    const index = NET_NAMING_PRIORITY.indexOf(component.type);
    return index < 0 ? NET_NAMING_PRIORITY.length : index;
  };
  const best = [...attached].sort((a, b) => rank(a.component) - rank(b.component)
    || a.component.id.localeCompare(b.component.id, undefined, { numeric: true })
    || a.pin - b.pin)[0]!;
  const name = pinName(best.component, best.pin);
  const reference = componentReference(best.component);
  return name ? `${reference} ${name}` : `${reference} pin ${best.pin + 1}`;
}

export function nodeDisplayName(reference: SerializedNodeReference, circuit: CircuitView | undefined): string {
  if (reference.kind === "runtime-node") return reference.name === "0" ? "GND" : reference.name;
  if (reference.kind === "schematic-wire") return wireNetName(circuit, reference.wireId);
  return pinLabel(circuit, reference.componentId, reference.pin);
}

function deviceDisplayName(component: { kind: string; componentId?: string; name?: string }, circuit: CircuitView | undefined): string {
  if (component.kind === "schematic-component" && component.componentId) {
    const resolved = componentById(circuit, component.componentId);
    return resolved ? componentReference(resolved) : component.componentId;
  }
  return component.name ?? "device";
}

/**
 * Display label for a probe. An author-supplied label always wins, so nothing a
 * user or a saved document already named is renamed underneath them.
 */
export function probeTraceLabel(probe: CircuitProbe, circuit: CircuitView | undefined): string {
  if (probe.label?.trim()) return probe.label.trim();
  const expression = probe.expression;
  if (expression.kind === "voltage") {
    const positive = nodeDisplayName(expression.positive, circuit);
    const negative = expression.negative.kind === "runtime-node" && expression.negative.name === "0"
      ? undefined
      : nodeDisplayName(expression.negative, circuit);
    return negative ? `V(${positive}, ${negative})` : `V(${positive})`;
  }
  if (expression.kind === "current") {
    const device = deviceDisplayName(expression.component, circuit);
    if (typeof expression.terminal === "number" && expression.component.kind === "schematic-component") {
      const component = componentById(circuit, expression.component.componentId);
      const name = component ? pinName(component, expression.terminal) : undefined;
      return `I(${device}${name ? ` ${name}` : `.${expression.terminal + 1}`})`;
    }
    return `I(${device})`;
  }
  if (expression.kind === "power") return `P(${deviceDisplayName(expression.component, circuit)})`;
  return probeDisplayLabel(probe);
}

/** Label used when a fresh probe is created from a wire, pin or component target. */
export function wireProbeLabel(circuit: CircuitView | undefined, wireId: string): string {
  return `V(${wireNetName(circuit, wireId)})`;
}

export function pinProbeLabel(circuit: CircuitView | undefined, componentId: string, pin: number): string {
  return `V(${pinLabel(circuit, componentId, pin)})`;
}

export function componentTraceReference(circuit: CircuitView | undefined, componentId: string): string {
  const component = componentById(circuit, componentId);
  return component ? componentReference(component) : componentId;
}

export function pinTraceReference(circuit: CircuitView | undefined, componentId: string, pin: number): string {
  const component = componentById(circuit, componentId);
  const name = component ? pinName(component, pin) : undefined;
  return `${componentTraceReference(circuit, componentId)}${name ? ` ${name}` : `.${pin + 1}`}`;
}
