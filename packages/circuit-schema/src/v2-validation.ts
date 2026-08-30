import { deserializeCircuit } from "./canonical";
import { DC_SWEEP_MAX_POINTS, dcSweepRangePointCount } from "./dc-sweep";
import { NOISE_MAX_POINTS, noisePointCount } from "./noise";
import { componentPinPointsV2 } from "./parts";
import { hasForbiddenControl, hasUnpairedSurrogate, isSafeEngineeringValue } from "./spice-token";
import { calculateDesignBlockContentHash, canonicalizeCircuitV2, canonicalizeV2Value, detachedCircuitV2Snapshot } from "./v2-canonical";
import type {
  AnyCircuitDocument,
  CircuitComponentV2,
  CircuitContractFailureCode,
  CircuitContractIssue,
  CircuitDocumentV2,
  CircuitGraphV2,
  CircuitProbeV2,
  DCSweepRange,
  DesignBlockDefinition,
  ExecutableSimConfigV2,
  JsonAnnotation,
  NoiseConfig,
  Point,
} from "./types";
import { CircuitNetlistError } from "./types";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ENTRYPOINT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_ANNOTATION_BYTES = 64 * 1024;
const MAX_ANNOTATION_DEPTH = 16;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function push(
  issues: CircuitContractIssue[],
  code: CircuitContractFailureCode,
  path: string,
  message: string,
  context: Partial<Pick<CircuitContractIssue, "circuitId" | "scenarioId" | "componentId" | "blockId">> = {},
): void {
  issues.push({ code, path, message, ...context });
}

function closed(issues: CircuitContractIssue[], value: unknown, path: string, allowed: readonly string[]): value is RecordValue {
  if (!isRecord(value)) {
    push(issues, "UNKNOWN_FIELD", path, "Must be an object");
    return false;
  }
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) if (!permitted.has(key)) push(issues, "UNKNOWN_FIELD", path ? `${path}.${key}` : key, "Unknown field");
  return true;
}

function safeString(issues: CircuitContractIssue[], value: unknown, path: string, nonempty = false): value is string {
  if (typeof value !== "string" || (nonempty && value.length === 0)) {
    push(issues, "UNSAFE_SPICE_TOKEN", path, nonempty ? "Must be a non-empty string" : "Must be a string");
    return false;
  }
  if (hasForbiddenControl(value) || hasUnpairedSurrogate(value)) {
    push(issues, "UNSAFE_SPICE_TOKEN", path, "Strings cannot contain control characters or unpaired surrogates");
    return false;
  }
  return true;
}

function exactMpnString(issues: CircuitContractIssue[], value: unknown, path: string): value is string {
  if (typeof value !== "string" || value.length === 0) {
    push(issues, "INVALID_REFERENCE", path, "Manufacturer part number must be a non-empty exact identity string");
    return false;
  }
  return true;
}

function safeId(issues: CircuitContractIssue[], value: unknown, path: string): value is string {
  if (!safeString(issues, value, path, true)) return false;
  if (!ID_PATTERN.test(value)) {
    push(issues, "UNSAFE_SPICE_TOKEN", path, "Must be a safe ASCII identifier of at most 128 characters");
    return false;
  }
  return true;
}

function finite(issues: CircuitContractIssue[], value: unknown, path: string): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    push(issues, "INVALID_SIM_CONFIG", path, "Must be a finite number");
    return false;
  }
  return true;
}

function point(issues: CircuitContractIssue[], value: unknown, path: string, integers = false): value is Point {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    push(issues, "INVALID_REFERENCE", path, "Must be a finite two-coordinate point");
    return false;
  }
  if (integers && !value.every(Number.isInteger)) push(issues, "INVALID_REFERENCE", path, "Point must lie on the integer grid");
  return true;
}

function annotation(issues: CircuitContractIssue[], value: unknown, path: string, depth: number): value is JsonAnnotation {
  if (depth > MAX_ANNOTATION_DEPTH) {
    push(issues, "EXECUTION_LIMIT", path, `Annotations are limited to depth ${MAX_ANNOTATION_DEPTH}`);
    return false;
  }
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) push(issues, "INVALID_SIM_CONFIG", path, "Annotation numbers must be finite");
    return Number.isFinite(value);
  }
  if (typeof value === "string") return safeString(issues, value, path);
  if (Array.isArray(value)) return value.every((entry, index) => annotation(issues, entry, `${path}.${index}`, depth + 1));
  if (isRecord(value)) {
    let valid = true;
    for (const [key, nested] of Object.entries(value)) {
      valid = safeString(issues, key, `${path}.<key>`) && annotation(issues, nested, `${path}.${key}`, depth + 1) && valid;
    }
    return valid;
  }
  push(issues, "UNKNOWN_FIELD", path, "Annotations must contain only JSON values");
  return false;
}

function label(issues: CircuitContractIssue[], value: unknown, path: string): void {
  if (!closed(issues, value, path, ["text", "offset"])) return;
  safeString(issues, value.text, `${path}.text`);
  point(issues, value.offset, `${path}.offset`);
}

function designBlockRef(issues: CircuitContractIssue[], value: unknown, path: string): void {
  if (!closed(issues, value, path, ["id", "version", "contentHash"])) return;
  safeId(issues, value.id, `${path}.id`);
  safeId(issues, value.version, `${path}.version`);
  if (typeof value.contentHash !== "string" || !HASH_PATTERN.test(value.contentHash)) push(issues, "BLOCK_HASH_MISMATCH", `${path}.contentHash`, "Must be a lowercase sha256 digest");
}

function validateComponent(
  issues: CircuitContractIssue[],
  component: unknown,
  path: string,
  circuitId: string | undefined,
): component is CircuitComponentV2 {
  if (!isRecord(component)) {
    push(issues, "UNKNOWN_FIELD", path, "Must be an object", { ...(circuitId ? { circuitId } : {}) });
    return false;
  }
  const type = component.type;
  const base = ["id", "type", "pos", "rot", "mirror", "mpn", "label", "annotations"];
  const extras: Record<string, string[]> = {
    resistor: ["value"], capacitor: ["value"], inductor: ["value"],
    vsource: ["value", "params"], isource: ["value"], vsource_pulse: ["params"],
    vsource_sine: ["value", "params"], isource_pulse: ["params"], switch_spst: ["params"],
    potentiometer: ["value", "params"], design_block: ["block"],
    diode: [], led: [], bjt_npn: [], bjt_pnp: [], nmos: [], pmos: [], opamp_ideal: [], ground: [],
  };
  if (typeof type !== "string" || !Object.hasOwn(extras, type)) {
    push(issues, "INVALID_REFERENCE", `${path}.type`, `Unsupported v2 component type ${String(type)}`, { ...(circuitId ? { circuitId } : {}) });
    closed(issues, component, path, base);
    return false;
  }
  closed(issues, component, path, [...base, ...extras[type]!]);
  const componentId = safeId(issues, component.id, `${path}.id`) ? component.id : undefined;
  const context = { ...(circuitId ? { circuitId } : {}), ...(componentId ? { componentId } : {}) };
  point(issues, component.pos, `${path}.pos`, true);
  if (![0, 90, 180, 270].includes(component.rot as number)) push(issues, "INVALID_REFERENCE", `${path}.rot`, "Rotation must be 0, 90, 180, or 270", context);
  if (typeof component.mirror !== "boolean") push(issues, "INVALID_REFERENCE", `${path}.mirror`, "Mirror must be boolean", context);
  if (component.mpn !== undefined) exactMpnString(issues, component.mpn, `${path}.mpn`);
  if (component.label !== undefined) label(issues, component.label, `${path}.label`);
  if (component.annotations !== undefined) {
    if (!isRecord(component.annotations)) push(issues, "UNKNOWN_FIELD", `${path}.annotations`, "Annotations must be an object", context);
    else {
      annotation(issues, component.annotations, `${path}.annotations`, 0);
      try {
        if (new TextEncoder().encode(JSON.stringify(canonicalizeV2Value(component.annotations))).byteLength > MAX_ANNOTATION_BYTES) {
          push(issues, "EXECUTION_LIMIT", `${path}.annotations`, `Annotations are limited to ${MAX_ANNOTATION_BYTES} bytes`, context);
        }
      } catch {
        push(issues, "UNKNOWN_FIELD", `${path}.annotations`, "Annotations must be JSON serializable", context);
      }
    }
  }
  const engineering = (value: unknown, valuePath: string): void => {
    if (!isSafeEngineeringValue(value)) push(issues, "UNSAFE_SPICE_TOKEN", valuePath, "Must be a finite number or safe ASCII engineering literal", context);
  };
  if (["resistor", "capacitor", "inductor", "vsource", "isource", "vsource_sine", "potentiometer"].includes(type)) engineering(component.value, `${path}.value`);
  if (type === "vsource") {
    if (component.params !== undefined && closed(issues, component.params, `${path}.params`, ["ac"]) && component.params.ac !== undefined) engineering(component.params.ac, `${path}.params.ac`);
  } else if (type === "vsource_pulse") {
    if (closed(issues, component.params, `${path}.params`, ["v1", "v2", "delay", "rise", "fall", "width", "period"])) {
      for (const key of ["v1", "v2", "delay", "rise", "fall", "width", "period"]) engineering(component.params[key], `${path}.params.${key}`);
    }
  } else if (type === "vsource_sine") {
    if (closed(issues, component.params, `${path}.params`, ["offset", "frequency", "ac"])) {
      engineering(component.params.offset, `${path}.params.offset`);
      engineering(component.params.frequency, `${path}.params.frequency`);
      if (component.params.ac !== undefined) engineering(component.params.ac, `${path}.params.ac`);
    }
  } else if (type === "isource_pulse") {
    if (closed(issues, component.params, `${path}.params`, ["i1", "i2", "delay", "rise", "fall", "width", "period"])) {
      const params = component.params;
      const values = ["i1", "i2", "delay", "rise", "fall", "width", "period"].map((key) => params[key]);
      values.forEach((value, index) => finite(issues, value, `${path}.params.${["i1", "i2", "delay", "rise", "fall", "width", "period"][index]}`));
      const [,, delay, rise, fall, width, period] = values as number[];
      if (values.every((value) => typeof value === "number" && Number.isFinite(value))) {
        if (delay! < 0 || rise! < 0 || fall! < 0 || width! <= 0 || period! <= 0 || rise! + width! + fall! > period!) {
          push(issues, "INVALID_PULSE", `${path}.params`, "Pulse timing must be non-negative, have positive width/period, and fit within the period", context);
        }
      }
    }
  } else if (type === "switch_spst") {
    if (closed(issues, component.params, `${path}.params`, ["closed"]) && typeof component.params.closed !== "boolean") {
      push(issues, "UNSAFE_SPICE_TOKEN", `${path}.params.closed`, "Must be boolean", context);
    }
  } else if (type === "potentiometer") {
    if (closed(issues, component.params, `${path}.params`, ["t"])) {
      if (!finite(issues, component.params.t, `${path}.params.t`) || (component.params.t as number) <= 0 || (component.params.t as number) >= 1) {
        push(issues, "INVALID_SIM_CONFIG", `${path}.params.t`, "Potentiometer t must satisfy 0 < t < 1", context);
      }
    }
  } else if (type === "design_block") designBlockRef(issues, component.block, `${path}.block`);
  return true;
}

function validateWire(issues: CircuitContractIssue[], wire: unknown, path: string, circuitId?: string): string | undefined {
  if (!closed(issues, wire, path, ["id", "points"])) return undefined;
  const id = safeId(issues, wire.id, `${path}.id`) ? wire.id : undefined;
  if (!Array.isArray(wire.points) || wire.points.length < 2) push(issues, "INVALID_REFERENCE", `${path}.points`, "Wire needs at least two points", { ...(circuitId ? { circuitId } : {}) });
  else {
    wire.points.forEach((entry, index) => point(issues, entry, `${path}.points.${index}`, true));
    for (let index = 1; index < wire.points.length; index += 1) {
      const prior = wire.points[index - 1] as Point;
      const current = wire.points[index] as Point;
      if (Array.isArray(prior) && Array.isArray(current) && current[0] !== prior[0] && current[1] !== prior[1]) {
        push(issues, "INVALID_REFERENCE", `${path}.points.${index}`, "Wire segments must be orthogonal", { ...(circuitId ? { circuitId } : {}) });
      }
    }
  }
  return id;
}

function validateProbe(issues: CircuitContractIssue[], probe: unknown, path: string, circuitId?: string): probe is CircuitProbeV2 {
  if (!closed(issues, probe, path, ["id", "kind", "target", "color"])) return false;
  safeId(issues, probe.id, `${path}.id`);
  if (!["voltage", "current", "diff"].includes(probe.kind as string)) push(issues, "INVALID_REFERENCE", `${path}.kind`, "Unsupported probe kind", { ...(circuitId ? { circuitId } : {}) });
  if (probe.color !== undefined) safeString(issues, probe.color, `${path}.color`);
  if (closed(issues, probe.target, `${path}.target`, ["node", "wire", "componentPin"])) {
    const choices = [probe.target.node !== undefined, probe.target.wire !== undefined, probe.target.componentPin !== undefined].filter(Boolean).length;
    if (choices !== 1) push(issues, "INVALID_REFERENCE", `${path}.target`, "Probe target must select exactly one node, wire, or component pin", { ...(circuitId ? { circuitId } : {}) });
    if (probe.target.node !== undefined) safeId(issues, probe.target.node, `${path}.target.node`);
    if (probe.target.wire !== undefined) safeId(issues, probe.target.wire, `${path}.target.wire`);
    if (probe.target.componentPin !== undefined) {
      const target = probe.target.componentPin;
      if (!Array.isArray(target) || target.length !== 2 || typeof target[0] !== "string" || !(typeof target[1] === "string" || Number.isInteger(target[1]))) {
        push(issues, "INVALID_REFERENCE", `${path}.target.componentPin`, "Must be [componentId, pin]", { ...(circuitId ? { circuitId } : {}) });
      } else {
        safeId(issues, target[0], `${path}.target.componentPin.0`);
        if (typeof target[1] === "string") safeId(issues, target[1], `${path}.target.componentPin.1`);
      }
    }
  }
  return true;
}

function validateRange(issues: CircuitContractIssue[], range: unknown, path: string, sources: Set<string>): number {
  if (!closed(issues, range, path, ["sourceId", "start", "stop", "step"])) return 0;
  const sourceId = safeId(issues, range.sourceId, `${path}.sourceId`) ? range.sourceId : "";
  if (!sources.has(sourceId)) push(issues, "INVALID_REFERENCE", `${path}.sourceId`, "Must reference an independent source", { componentId: sourceId });
  const values = [range.start, range.stop, range.step];
  values.forEach((value, index) => finite(issues, value, `${path}.${["start", "stop", "step"][index]}`));
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return 0;
  if (range.start === range.stop || range.step === 0 || Math.sign((range.stop as number) - (range.start as number)) !== Math.sign(range.step as number)) {
    push(issues, "INVALID_SIM_CONFIG", path, "Sweep start/stop must differ and step must move toward stop");
    return 0;
  }
  return dcSweepRangePointCount(range as unknown as DCSweepRange);
}

function validateConfig(
  issues: CircuitContractIssue[],
  config: unknown,
  path: string,
  graph: CircuitGraphV2 | undefined,
  scenarioId: string | undefined,
): config is ExecutableSimConfigV2 {
  if (!isRecord(config) || typeof config.mode !== "string") {
    push(issues, "INVALID_SIM_CONFIG", path, "Scenario needs a closed executable config", { ...(scenarioId ? { scenarioId } : {}) });
    return false;
  }
  const branches: Record<string, string[]> = { op: [], tran: ["tran"], ac: ["ac"], "dc-sweep": ["dcSweep"], noise: ["noise"] };
  if (!Object.hasOwn(branches, config.mode)) {
    push(issues, "INVALID_SIM_CONFIG", `${path}.mode`, "Unsupported executable mode", { ...(scenarioId ? { scenarioId } : {}) });
    return false;
  }
  closed(issues, config, path, ["mode", ...branches[config.mode]!]);
  const graphComponents = Array.isArray(graph?.components) ? graph.components : [];
  const graphProbes = Array.isArray(graph?.probes) ? graph.probes : [];
  if (config.mode === "tran") {
    if (closed(issues, config.tran, `${path}.tran`, ["tstop", "tstep", "maxstep"])) {
      const values = [config.tran.tstop, config.tran.tstep, config.tran.maxstep];
      values.forEach((value, index) => finite(issues, value, `${path}.tran.${["tstop", "tstep", "maxstep"][index]}`));
      if (values.every((value) => typeof value === "number" && Number.isFinite(value))) {
        const [tstop, tstep, maxstep] = values as number[];
        if (values.some((value) => (value as number) <= 0) || tstep! > tstop! || maxstep! > tstop!) {
          push(issues, "INVALID_SIM_CONFIG", `${path}.tran`, "Transient fields must be positive and tstep/maxstep cannot exceed tstop", { ...(scenarioId ? { scenarioId } : {}) });
        }
        for (const component of graphComponents.filter((item) => item.type === "isource_pulse")) {
          if (tstop! <= component.params.delay) push(issues, "INVALID_PULSE", `${path}.tran.tstop`, "Transient stop must be greater than pulse delay", { ...(scenarioId ? { scenarioId } : {}), componentId: component.id });
        }
      }
    }
  } else if (config.mode === "ac") {
    if (closed(issues, config.ac, `${path}.ac`, ["fstart", "fstop", "pointsPerDecade", "sweep"])) {
      const values = [config.ac.fstart, config.ac.fstop, config.ac.pointsPerDecade];
      values.forEach((value, index) => finite(issues, value, `${path}.ac.${["fstart", "fstop", "pointsPerDecade"][index]}`));
      if (config.ac.sweep !== "dec" || (typeof config.ac.fstart === "number" && config.ac.fstart <= 0) || (typeof config.ac.fstop === "number" && config.ac.fstop <= (config.ac.fstart as number)) || !Number.isInteger(config.ac.pointsPerDecade) || (config.ac.pointsPerDecade as number) < 1) {
        push(issues, "INVALID_SIM_CONFIG", `${path}.ac`, "AC config requires positive increasing frequencies, integer points, and dec sweep", { ...(scenarioId ? { scenarioId } : {}) });
      }
    }
  } else if (config.mode === "dc-sweep") {
    if (closed(issues, config.dcSweep, `${path}.dcSweep`, ["sourceId", "start", "stop", "step", "secondary"])) {
      const sources = new Set(graphComponents.filter((component) => ["vsource", "vsource_pulse", "vsource_sine", "isource"].includes(component.type)).map((component) => component.id));
      const primary = validateRange(issues, config.dcSweep, `${path}.dcSweep`, sources);
      const secondary = config.dcSweep.secondary === undefined ? 1 : validateRange(issues, config.dcSweep.secondary, `${path}.dcSweep.secondary`, sources);
      if (isRecord(config.dcSweep.secondary) && config.dcSweep.secondary.sourceId === config.dcSweep.sourceId) push(issues, "INVALID_SIM_CONFIG", `${path}.dcSweep.secondary.sourceId`, "Secondary source must differ from primary");
      if (primary * secondary > DC_SWEEP_MAX_POINTS) push(issues, "EXECUTION_LIMIT", `${path}.dcSweep`, `DC sweep exceeds ${DC_SWEEP_MAX_POINTS} points`);
    }
  } else if (config.mode === "noise") {
    if (closed(issues, config.noise, `${path}.noise`, ["outputProbeId", "inputSourceId", "fstart", "fstop", "pointsPerDecade", "sweep", "temperatureC"])) {
      const noise = config.noise as unknown as NoiseConfig;
      safeId(issues, noise.outputProbeId, `${path}.noise.outputProbeId`);
      safeId(issues, noise.inputSourceId, `${path}.noise.inputSourceId`);
      ["fstart", "fstop", "pointsPerDecade", "temperatureC"].forEach((key) => finite(issues, noise[key as keyof NoiseConfig], `${path}.noise.${key}`));
      const probe = graphProbes.find((entry) => entry.id === noise.outputProbeId && entry.kind === "voltage");
      if (!probe) push(issues, "INVALID_REFERENCE", `${path}.noise.outputProbeId`, "Noise output must reference a voltage probe");
      const source = graphComponents.find((entry) => entry.id === noise.inputSourceId && ["vsource", "vsource_pulse", "vsource_sine", "isource"].includes(entry.type));
      if (!source) push(issues, "INVALID_REFERENCE", `${path}.noise.inputSourceId`, "Noise input must reference an independent source");
      if (noise.sweep !== "dec" || noise.fstart <= 0 || noise.fstop <= noise.fstart || !Number.isInteger(noise.pointsPerDecade) || noise.pointsPerDecade < 1 || noise.temperatureC <= -273.15 || noise.temperatureC > 1000) push(issues, "INVALID_SIM_CONFIG", `${path}.noise`, "Noise config is outside its explicit bounds");
      if (noisePointCount(noise) > NOISE_MAX_POINTS) push(issues, "EXECUTION_LIMIT", `${path}.noise`, `Noise analysis exceeds ${NOISE_MAX_POINTS} points`);
    }
  }
  if (graphComponents.some((component) => component.type === "isource_pulse") && config.mode !== "tran") {
    push(issues, "INVALID_SIM_CONFIG", path, "Graphs with a pulsed current source require transient analysis", { ...(scenarioId ? { scenarioId } : {}) });
  }
  return true;
}

function validateDefinition(issues: CircuitContractIssue[], definition: unknown, path: string): definition is DesignBlockDefinition {
  if (!closed(issues, definition, path, ["id", "version", "contentHash", "title", "pins", "netlist"])) return false;
  const id = safeId(issues, definition.id, `${path}.id`) ? definition.id : undefined;
  const context = { ...(id ? { blockId: id } : {}) };
  safeId(issues, definition.version, `${path}.version`);
  safeString(issues, definition.title, `${path}.title`, true);
  if (typeof definition.contentHash !== "string" || !HASH_PATTERN.test(definition.contentHash)) push(issues, "BLOCK_HASH_MISMATCH", `${path}.contentHash`, "Must be a lowercase sha256 digest", context);
  if (!Array.isArray(definition.pins) || definition.pins.length < 1 || definition.pins.length > 128) {
    push(issues, "BLOCK_PIN_MAPPING_INVALID", `${path}.pins`, "Design blocks require 1 through 128 pins", context);
  } else {
    const pinIds = new Set<string>();
    definition.pins.forEach((pinValue, index) => {
      const pinPath = `${path}.pins.${index}`;
      if (!closed(issues, pinValue, pinPath, ["id", "name", "offset"])) return;
      if (safeId(issues, pinValue.id, `${pinPath}.id`)) {
        if (pinIds.has(pinValue.id)) push(issues, "DUPLICATE_ID", `${pinPath}.id`, "Duplicate block pin ID", context);
        pinIds.add(pinValue.id);
      }
      safeString(issues, pinValue.name, `${pinPath}.name`, true);
      point(issues, pinValue.offset, `${pinPath}.offset`, true);
    });
  }
  if (isRecord(definition.netlist) && definition.netlist.kind === "schematic_only") {
    if (closed(issues, definition.netlist, `${path}.netlist`, ["kind", "reason"])) safeString(issues, definition.netlist.reason, `${path}.netlist.reason`, true);
  } else if (isRecord(definition.netlist) && definition.netlist.kind === "spice_subcircuit") {
    if (closed(issues, definition.netlist, `${path}.netlist`, ["kind", "asset", "pinOrder"])) {
      if (closed(issues, definition.netlist.asset, `${path}.netlist.asset`, ["assetId", "contentHash", "entrypoint"])) {
        safeId(issues, definition.netlist.asset.assetId, `${path}.netlist.asset.assetId`);
        if (typeof definition.netlist.asset.contentHash !== "string" || !HASH_PATTERN.test(definition.netlist.asset.contentHash)) push(issues, "TRUSTED_MODEL_HASH_MISMATCH", `${path}.netlist.asset.contentHash`, "Must be a lowercase sha256 digest", context);
        if (typeof definition.netlist.asset.entrypoint !== "string" || !ENTRYPOINT_PATTERN.test(definition.netlist.asset.entrypoint)) push(issues, "TRUSTED_MODEL_ENTRYPOINT_INVALID", `${path}.netlist.asset.entrypoint`, "Entrypoint is not a safe SPICE identifier", context);
      }
      if (!Array.isArray(definition.netlist.pinOrder) || !definition.netlist.pinOrder.every((entry) => typeof entry === "string" && ID_PATTERN.test(entry))) {
        push(issues, "BLOCK_PIN_MAPPING_INVALID", `${path}.netlist.pinOrder`, "Pin order must contain safe pin IDs", context);
      } else if (Array.isArray(definition.pins)) {
        const expected = definition.pins.map((pinValue) => isRecord(pinValue) ? pinValue.id : undefined).filter((entry): entry is string => typeof entry === "string").sort();
        const actual = [...definition.netlist.pinOrder].sort();
        if (expected.length !== actual.length || expected.some((entry, index) => entry !== actual[index])) push(issues, "BLOCK_PIN_MAPPING_INVALID", `${path}.netlist.pinOrder`, "Pin order must be an exact permutation of block pins", context);
      }
    }
  } else push(issues, "UNKNOWN_FIELD", `${path}.netlist.kind`, "Unsupported design-block netlist behavior", context);
  try {
    if (typeof definition.contentHash === "string" && HASH_PATTERN.test(definition.contentHash) && calculateDesignBlockContentHash(definition as unknown as DesignBlockDefinition) !== definition.contentHash) {
      push(issues, "BLOCK_HASH_MISMATCH", `${path}.contentHash`, "Design block content does not match its hash", context);
    }
  } catch {
    push(issues, "BLOCK_HASH_MISMATCH", `${path}.contentHash`, "Design block cannot be canonically hashed", context);
  }
  return true;
}

export function validateCircuitV2(inputDocument: CircuitDocumentV2): CircuitContractIssue[] {
  const issues: CircuitContractIssue[] = [];
  let document: CircuitDocumentV2;
  try {
    document = detachedCircuitV2Snapshot(inputDocument);
  } catch {
    push(issues, "UNKNOWN_FIELD", "", "Circuit document cannot be detached into canonical JSON");
    return issues;
  }
  if (!closed(issues, document, "", ["format", "version", "meta", "designBlocks", "circuits", "scenarios", "defaultCircuitId", "defaultScenarioId"])) return issues;
  if (document.format !== "opencircuit-circuit" || document.version !== 2) push(issues, "UNSUPPORTED_CIRCUIT_VERSION", "version", "Unsupported circuit document format or version");
  if (closed(issues, document.meta, "meta", ["title", "description"])) {
    safeString(issues, document.meta.title, "meta.title", true);
    if (document.meta.description !== undefined) safeString(issues, document.meta.description, "meta.description");
  }
  try {
    if (new TextEncoder().encode(canonicalizeCircuitV2(document)).byteLength > MAX_DOCUMENT_BYTES) push(issues, "EXECUTION_LIMIT", "", `Circuit document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  } catch {
    push(issues, "UNKNOWN_FIELD", "", "Circuit document is not canonical JSON");
  }

  const definitions = new Map<string, DesignBlockDefinition>();
  if (!Array.isArray(document.designBlocks) || document.designBlocks.length > 256) push(issues, "EXECUTION_LIMIT", "designBlocks", "At most 256 design blocks are allowed");
  else document.designBlocks.forEach((definition, index) => {
    validateDefinition(issues, definition, `designBlocks.${index}`);
    if (isRecord(definition) && typeof definition.id === "string" && typeof definition.version === "string" && typeof definition.contentHash === "string") {
      const key = `${definition.id}\0${definition.version}\0${definition.contentHash}`;
      if (definitions.has(key)) push(issues, "DUPLICATE_ID", `designBlocks.${index}`, "Duplicate design block identity", { blockId: definition.id });
      else definitions.set(key, definition as unknown as DesignBlockDefinition);
    }
  });

  const circuits = new Map<string, CircuitGraphV2>();
  if (!Array.isArray(document.circuits) || document.circuits.length < 1 || document.circuits.length > 64) push(issues, "EXECUTION_LIMIT", "circuits", "Documents require 1 through 64 circuits");
  else document.circuits.forEach((graph, graphIndex) => {
    const path = `circuits.${graphIndex}`;
    if (!closed(issues, graph, path, ["id", "title", "components", "wires", "probes", "view"])) return;
    const circuitId = safeId(issues, graph.id, `${path}.id`) ? graph.id : undefined;
    if (circuitId) {
      if (circuits.has(circuitId)) push(issues, "DUPLICATE_ID", `${path}.id`, "Duplicate circuit ID", { circuitId });
      else circuits.set(circuitId, graph as unknown as CircuitGraphV2);
    }
    safeString(issues, graph.title, `${path}.title`, true);
    const total = (Array.isArray(graph.components) ? graph.components.length : 0) + (Array.isArray(graph.wires) ? graph.wires.length : 0) + (Array.isArray(graph.probes) ? graph.probes.length : 0);
    if (total > 10_000) push(issues, "EXECUTION_LIMIT", path, "A graph may contain at most 10,000 components, wires, and probes", { ...(circuitId ? { circuitId } : {}) });
    const ids = new Set<string>();
    if (!Array.isArray(graph.components)) push(issues, "UNKNOWN_FIELD", `${path}.components`, "Must be an array");
    else graph.components.forEach((component, index) => {
      validateComponent(issues, component, `${path}.components.${index}`, circuitId);
      if (isRecord(component) && typeof component.id === "string") {
        if (ids.has(component.id)) push(issues, "DUPLICATE_ID", `${path}.components.${index}.id`, "Duplicate graph item ID", { ...(circuitId ? { circuitId } : {}), componentId: component.id });
        ids.add(component.id);
      }
      if (isRecord(component) && component.type === "design_block" && isRecord(component.block)) {
        const key = `${String(component.block.id)}\0${String(component.block.version)}\0${String(component.block.contentHash)}`;
        if (!definitions.has(key)) push(issues, "INVALID_REFERENCE", `${path}.components.${index}.block`, "Design block ref does not resolve exactly", { ...(circuitId ? { circuitId } : {}), componentId: String(component.id), blockId: String(component.block.id) });
      }
    });
    if (Array.isArray(graph.components) && !graph.components.some((component) => isRecord(component) && component.type === "ground")) push(issues, "INVALID_REFERENCE", `${path}.components`, "Add a ground symbol before running the circuit", { ...(circuitId ? { circuitId } : {}) });
    if (!Array.isArray(graph.wires)) push(issues, "UNKNOWN_FIELD", `${path}.wires`, "Must be an array");
    else graph.wires.forEach((wire, index) => { const id = validateWire(issues, wire, `${path}.wires.${index}`, circuitId); if (id) { if (ids.has(id)) push(issues, "DUPLICATE_ID", `${path}.wires.${index}.id`, "Duplicate graph item ID", { ...(circuitId ? { circuitId } : {}) }); ids.add(id); } });
    if (!Array.isArray(graph.probes)) push(issues, "UNKNOWN_FIELD", `${path}.probes`, "Must be an array");
    else graph.probes.forEach((probe, index) => { validateProbe(issues, probe, `${path}.probes.${index}`, circuitId); if (isRecord(probe) && typeof probe.id === "string") { if (ids.has(probe.id)) push(issues, "DUPLICATE_ID", `${path}.probes.${index}.id`, "Duplicate graph item ID", { ...(circuitId ? { circuitId } : {}) }); ids.add(probe.id); } });
    if (graph.view !== undefined && closed(issues, graph.view, `${path}.view`, ["pan", "zoom"])) {
      point(issues, graph.view.pan, `${path}.view.pan`);
      if (!finite(issues, graph.view.zoom, `${path}.view.zoom`) || (graph.view.zoom as number) <= 0) push(issues, "INVALID_SIM_CONFIG", `${path}.view.zoom`, "Zoom must be positive");
    }
    if (Array.isArray(graph.components)) {
      for (const [index, component] of graph.components.entries()) {
        try { componentPinPointsV2(component as CircuitComponentV2, [...definitions.values()]); }
        catch (error) { push(issues, "INVALID_REFERENCE", `${path}.components.${index}`, error instanceof Error ? error.message : String(error), { ...(circuitId ? { circuitId } : {}) }); }
      }
    }
    if (Array.isArray(graph.probes) && Array.isArray(graph.components) && Array.isArray(graph.wires)) {
      const componentMap = new Map(graph.components.filter(isRecord).map((entry) => [String(entry.id), entry]));
      const wireIds = new Set(graph.wires.filter(isRecord).map((entry) => String(entry.id)));
      graph.probes.forEach((probe, index) => {
        if (!isRecord(probe) || !isRecord(probe.target)) return;
        if (typeof probe.target.wire === "string" && !wireIds.has(probe.target.wire)) push(issues, "INVALID_REFERENCE", `${path}.probes.${index}.target.wire`, "Probe wire does not resolve", { ...(circuitId ? { circuitId } : {}) });
        if (Array.isArray(probe.target.componentPin)) {
          const [componentId, pin] = probe.target.componentPin;
          const component = componentMap.get(String(componentId));
          if (!component) push(issues, "INVALID_REFERENCE", `${path}.probes.${index}.target.componentPin`, "Probe component does not resolve", { ...(circuitId ? { circuitId } : {}) });
          else if (component.type === "design_block") {
            const ref = component.block as unknown as RecordValue;
            const block = definitions.get(`${String(ref.id)}\0${String(ref.version)}\0${String(ref.contentHash)}`);
            if (typeof pin !== "string" || !block?.pins.some((entry) => entry.id === pin)) push(issues, "INVALID_REFERENCE", `${path}.probes.${index}.target.componentPin.1`, "Design-block probe must reference a stable pin ID", { ...(circuitId ? { circuitId } : {}) });
          } else {
            try {
              const count = componentPinPointsV2(component as unknown as CircuitComponentV2, [...definitions.values()]).length;
              if (!Number.isInteger(pin) || (pin as number) < 0 || (pin as number) >= count) push(issues, "INVALID_REFERENCE", `${path}.probes.${index}.target.componentPin.1`, "Primitive pin index is out of range", { ...(circuitId ? { circuitId } : {}) });
            } catch { /* component issue already recorded */ }
          }
        }
      });
    }
  });

  if (!safeId(issues, document.defaultCircuitId, "defaultCircuitId") || !circuits.has(document.defaultCircuitId)) push(issues, "INVALID_REFERENCE", "defaultCircuitId", "Default circuit does not resolve");
  const scenarios = new Set<string>();
  if (!Array.isArray(document.scenarios) || document.scenarios.length > 64) push(issues, "EXECUTION_LIMIT", "scenarios", "At most 64 scenarios are allowed");
  else document.scenarios.forEach((scenario, index) => {
    const path = `scenarios.${index}`;
    if (!closed(issues, scenario, path, ["id", "title", "circuitId", "config"])) return;
    const scenarioId = safeId(issues, scenario.id, `${path}.id`) ? scenario.id : undefined;
    if (scenarioId) { if (scenarios.has(scenarioId)) push(issues, "DUPLICATE_ID", `${path}.id`, "Duplicate scenario ID", { scenarioId }); scenarios.add(scenarioId); }
    safeString(issues, scenario.title, `${path}.title`, true);
    const circuitId = safeId(issues, scenario.circuitId, `${path}.circuitId`) ? scenario.circuitId : undefined;
    const graph = circuitId ? circuits.get(circuitId) : undefined;
    if (!graph) push(issues, "INVALID_REFERENCE", `${path}.circuitId`, "Scenario circuit does not resolve", { ...(scenarioId ? { scenarioId } : {}) });
    validateConfig(issues, scenario.config, `${path}.config`, graph, scenarioId);
  });
  if (Array.isArray(document.scenarios) && document.scenarios.length === 0) {
    if (document.defaultScenarioId !== null) push(issues, "INVALID_REFERENCE", "defaultScenarioId", "Documents without scenarios require null defaultScenarioId");
  } else if (Array.isArray(document.scenarios) && (typeof document.defaultScenarioId !== "string" || !scenarios.has(document.defaultScenarioId))) push(issues, "INVALID_REFERENCE", "defaultScenarioId", "Default scenario does not resolve");
  return issues;
}

export function assertValidCircuitV2(document: CircuitDocumentV2): void {
  const issue = validateCircuitV2(document)[0];
  if (issue) throw new CircuitNetlistError(issue);
}

export function deserializeCircuitV2(source: string): CircuitDocumentV2 {
  const parsed = JSON.parse(source) as CircuitDocumentV2;
  assertValidCircuitV2(parsed);
  return parsed;
}

export function deserializeAnyCircuit(source: string): AnyCircuitDocument {
  const parsed = JSON.parse(source) as { version?: unknown };
  if (parsed?.version === 1) return deserializeCircuit(source);
  if (parsed?.version === 2) return deserializeCircuitV2(source);
  throw new CircuitNetlistError({
    code: "UNSUPPORTED_CIRCUIT_VERSION",
    path: "version",
    message: `Unsupported circuit document version ${String(parsed?.version)}`,
  });
}
