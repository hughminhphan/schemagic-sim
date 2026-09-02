import { defaultDCSweepConfig } from "./dc-sweep";
import { DEFAULT_NOISE_TEMPERATURE_C } from "./noise";
import { isSafeDecimalValue, isSafeEngineeringValue } from "./spice-token";
import { assertValidCircuitV4 } from "./v4-validation";
import type {
  CircuitComponent,
  CircuitComponentV4,
  CircuitDocumentV1,
  CircuitDocumentV4,
  EngineeringValue,
  ExecutableSimConfigV4,
  JsonAnnotation,
} from "./types";
import { CircuitNetlistError } from "./types";

function fail(path: string, message: string): never {
  throw new CircuitNetlistError({ code: "UNSAFE_SPICE_TOKEN", path, message });
}

function annotationRecord(): Record<string, JsonAnnotation> {
  return Object.create(null) as Record<string, JsonAnnotation>;
}

function setAnnotation(target: Record<string, JsonAnnotation>, key: string, value: JsonAnnotation): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}

function engineering(value: unknown, fallback: EngineeringValue, path: string): EngineeringValue {
  const selected = value ?? fallback;
  if (!isSafeEngineeringValue(selected)) fail(path, "Cannot upgrade an unsafe recognized SPICE value");
  return selected;
}

function cloneAnnotation(value: unknown, path: string): JsonAnnotation {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "Cannot upgrade non-finite annotation data");
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => cloneAnnotation(entry, `${path}.${index}`));
  if (value && typeof value === "object") {
    const result = annotationRecord();
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) fail(`${path}.${key}`, "Cannot upgrade undefined annotation data");
      setAnnotation(result, key, cloneAnnotation(nested, `${path}.${key}`));
    }
    return result;
  }
  fail(path, "Cannot upgrade non-JSON annotation data");
}

function annotations(component: CircuitComponent, recognized: readonly string[]): { [key: string]: JsonAnnotation } | undefined {
  if (!component.params) return undefined;
  const recognizedSet = new Set(recognized);
  const result = annotationRecord();
  for (const [key, value] of Object.entries(component.params)) {
    if (!recognizedSet.has(key)) setAnnotation(result, key, cloneAnnotation(value, `components.${component.id}.params.${key}`));
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function base(component: CircuitComponent, inert?: { [key: string]: JsonAnnotation }): Pick<CircuitComponentV4, "id" | "pos" | "rot" | "mirror" | "mpn" | "label" | "annotations"> {
  return {
    id: component.id,
    pos: [...component.pos],
    rot: component.rot,
    mirror: component.mirror,
    ...(component.mpn !== undefined ? { mpn: component.mpn } : {}),
    ...(component.label !== undefined ? { label: { ...component.label, offset: [...component.label.offset] } } : {}),
    ...(inert ? { annotations: inert } : {}),
  };
}

function upgradeComponent(component: CircuitComponent): CircuitComponentV4 {
  const path = `components.${component.id}`;
  switch (component.type) {
    case "resistor": return { ...base(component, annotations(component, [])), type: "resistor", value: engineering(component.value, 1000, `${path}.value`) };
    case "capacitor": return { ...base(component, annotations(component, [])), type: "capacitor", value: engineering(component.value, 1e-7, `${path}.value`) };
    case "inductor": return { ...base(component, annotations(component, [])), type: "inductor", value: engineering(component.value, 1e-3, `${path}.value`) };
    case "vsource": {
      const ac = component.params?.ac;
      return {
        ...base(component, annotations(component, ["ac"])),
        type: "vsource",
        value: engineering(component.value, 5, `${path}.value`),
        ...(ac !== undefined ? { params: { ac: engineering(ac, 1, `${path}.params.ac`) } } : {}),
      };
    }
    case "isource": return { ...base(component, annotations(component, [])), type: "isource", value: engineering(component.value, 0.001, `${path}.value`) };
    case "vsource_pulse": return {
      ...base(component, annotations(component, ["v1", "v2", "delay", "rise", "fall", "width", "period"])),
      type: "vsource_pulse",
      params: {
        v1: engineering(component.params?.v1, 0, `${path}.params.v1`),
        v2: engineering(component.params?.v2, component.value ?? 5, `${path}.params.v2`),
        delay: engineering(component.params?.delay, 0.001, `${path}.params.delay`),
        rise: engineering(component.params?.rise, 0.00001, `${path}.params.rise`),
        fall: engineering(component.params?.fall, 0.00001, `${path}.params.fall`),
        width: engineering(component.params?.width, 0.004, `${path}.params.width`),
        period: engineering(component.params?.period, 0.01, `${path}.params.period`),
      },
    };
    case "vsource_sine": return {
      ...base(component, annotations(component, ["offset", "frequency", "ac"])),
      type: "vsource_sine",
      value: engineering(component.value, 1, `${path}.value`),
      params: {
        offset: engineering(component.params?.offset, 0, `${path}.params.offset`),
        frequency: engineering(component.params?.frequency, 1000, `${path}.params.frequency`),
        ...(component.params?.ac !== undefined ? { ac: engineering(component.params.ac, 1, `${path}.params.ac`) } : {}),
      },
    };
    case "switch_spst": {
      const closed = component.params?.closed ?? false;
      if (typeof closed !== "boolean") fail(`${path}.params.closed`, "Switch closed must be boolean");
      return { ...base(component, annotations(component, ["closed"])), type: "switch_spst", params: { closed } };
    }
    case "potentiometer": {
      const raw = component.params?.t;
      if (raw !== undefined && !isSafeDecimalValue(raw)) fail(`${path}.params.t`, "Potentiometer t must be a finite ASCII decimal without whitespace or suffixes");
      const t = raw === undefined ? 0.5 : Math.min(0.995, Math.max(0.005, Number(raw)));
      return {
        ...base(component, annotations(component, ["t"])),
        type: "potentiometer",
        value: engineering(component.value, 10000, `${path}.value`),
        params: { t },
      };
    }
    case "diode": case "led": case "bjt_npn": case "bjt_pnp": case "nmos": case "pmos": case "opamp_ideal": case "ground":
      return { ...base(component, annotations(component, [])), type: component.type };
    default:
      // Catalog-only simulator symbols have no Designer V4 counterpart yet: V4
      // resolves device models through trusted design blocks, not the catalog.
      return fail(`${path}.type`, `Cannot upgrade catalog-only component type ${component.type} to a v4 document`);
  }
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "Cannot upgrade a non-finite simulation setting");
  return value;
}

function upgradeConfig(input: CircuitDocumentV1): ExecutableSimConfigV4 {
  const sim = input.sim;
  if (sim.mode === "live" || sim.mode === "op") return { mode: "op" };
  if (sim.mode === "tran") return {
    mode: "tran",
    tran: {
      tstop: finite(sim.tran?.tstop ?? 0.01, "sim.tran.tstop"),
      tstep: finite(sim.tran?.tstep ?? 0.00002, "sim.tran.tstep"),
      maxstep: finite(sim.tran?.maxstep ?? 0.00005, "sim.tran.maxstep"),
    },
  };
  if (sim.mode === "ac") return {
    mode: "ac",
    ac: {
      fstart: finite(sim.ac?.fstart ?? 10, "sim.ac.fstart"),
      fstop: finite(sim.ac?.fstop ?? 1_000_000, "sim.ac.fstop"),
      pointsPerDecade: finite(sim.ac?.pointsPerDecade ?? 30, "sim.ac.pointsPerDecade"),
      sweep: "dec",
    },
  };
  if (sim.mode === "dc-sweep") {
    const config = sim.dcSweep ?? defaultDCSweepConfig(input);
    if (!config) fail("sim.dcSweep", "Cannot infer a DC sweep without an independent source");
    return { mode: "dc-sweep", dcSweep: structuredClone(config) };
  }
  const output = input.probes.find((probe) => probe.kind === "voltage");
  const source = input.components.find((component) => component.type === "vsource" || component.type === "vsource_pulse" || component.type === "vsource_sine" || component.type === "isource");
  const config = sim.noise ?? (output && source ? {
    outputProbeId: output.id,
    inputSourceId: source.id,
    fstart: 10,
    fstop: 1_000_000,
    pointsPerDecade: 30,
    sweep: "dec" as const,
    temperatureC: DEFAULT_NOISE_TEMPERATURE_C,
  } : undefined);
  if (!config) fail("sim.noise", "Cannot infer noise settings without a voltage probe and independent source");
  return { mode: "noise", noise: structuredClone(config) };
}

export function upgradeCircuitV1ToV4(input: CircuitDocumentV1): CircuitDocumentV4 {
  const config = upgradeConfig(input);
  const upgradedComponents = input.components.map(upgradeComponent);
  if (config.mode === "ac") {
    for (let index = 0; index < upgradedComponents.length; index += 1) {
      const component = upgradedComponents[index]!;
      if (component.type === "vsource") upgradedComponents[index] = { ...component, params: { ac: component.params?.ac ?? 1 } };
    }
  }
  const document: CircuitDocumentV4 = {
    format: "opencircuit-circuit",
    version: 4,
    meta: { ...input.meta },
    designBlocks: [],
    circuits: [{
      id: "main",
      title: input.meta.title,
      components: upgradedComponents,
      wires: structuredClone(input.wires),
      probes: input.probes.map((probe) => {
        const target = probe.target.wire !== undefined
          ? { wire: probe.target.wire } as const
          : probe.target.componentPin !== undefined
            ? { componentPin: [...probe.target.componentPin] as [string, number] } as const
            : probe.target.node !== undefined
              ? { node: probe.target.node } as const
              : fail(`probes.${probe.id}.target`, "Cannot upgrade a probe without a target");
        return { id: probe.id, kind: probe.kind, target, ...(probe.color !== undefined ? { color: probe.color } : {}) };
      }),
      ...(input.view ? { view: structuredClone(input.view) } : {}),
    }],
    scenarios: [{ id: "default", title: "Default", circuitId: "main", config }],
    defaultCircuitId: "main",
    defaultScenarioId: "default",
  };
  assertValidCircuitV4(document);
  return document;
}
