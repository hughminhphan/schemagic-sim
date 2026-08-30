import type {
  QuantityDimension,
  SerializedComponentReference,
  SerializedNodeReference,
  SerializedTerminalReference,
  SignalResolution,
  SignalResolver,
  SignalVector,
  UnitSymbol,
} from "../src/types";
import { CURRENT_DIMENSION, POWER_DIMENSION, VOLTAGE_DIMENSION } from "../src/units";

export function real(values: ArrayLike<number>, unit: UnitSymbol = "V", dimension: QuantityDimension = VOLTAGE_DIMENSION): SignalVector {
  return { kind: "real", unit, dimension, length: values.length, values: Float64Array.from(values) };
}

export function complex(values: ArrayLike<number>, unit: UnitSymbol = "V", dimension: QuantityDimension = VOLTAGE_DIMENSION): SignalVector {
  return { kind: "complex", unit, dimension, length: values.length / 2, values: Float64Array.from(values) };
}

export class FixtureResolver implements SignalResolver {
  readonly nodes = new Map<string, SignalVector>();
  readonly currents = new Map<string, SignalVector>();
  readonly powers = new Map<string, SignalVector>();

  voltage(reference: SerializedNodeReference): SignalResolution {
    const key = reference.kind === "runtime-node" ? `node:${reference.name}` : reference.kind === "schematic-wire" ? `wire:${reference.wireId}` : `pin:${reference.componentId}:${reference.pin}`;
    const signal = this.nodes.get(key);
    return signal ? { ok: true, signal } : { ok: false, error: { code: "NOT_FOUND", message: `Missing ${key}` } };
  }

  current(component: SerializedComponentReference, terminal?: SerializedTerminalReference): SignalResolution {
    const componentKey = component.kind === "runtime-device" ? `device:${component.name}` : `component:${component.componentId}`;
    const key = `${componentKey}:${terminal === undefined ? "default" : String(terminal)}`;
    const signal = this.currents.get(key);
    return signal ? { ok: true, signal } : { ok: false, error: { code: "UNSUPPORTED", message: `Missing terminal current ${key}` } };
  }

  power(component: SerializedComponentReference): SignalResolution {
    const key = component.kind === "runtime-device" ? `device:${component.name}` : `component:${component.componentId}`;
    const signal = this.powers.get(key);
    return signal ? { ok: true, signal } : { ok: false, error: { code: "UNSUPPORTED", message: `Missing power ${key}` } };
  }
}

export { CURRENT_DIMENSION, POWER_DIMENSION };
