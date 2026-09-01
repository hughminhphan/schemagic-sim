import { isIndependentSource } from "./dc-sweep";
import { parseEngineering } from "./parts";
import type {
  ACConfig,
  ACStimulusConfig,
  CircuitComponent,
  CircuitDocument,
  TransientConfig,
  ValidationIssue,
} from "./types";

export const AC_MAX_POINTS = 200_000;
export const DEFAULT_TRANSIENT_CONFIG: Readonly<Required<TransientConfig>> = Object.freeze({
  tstop: 0.01,
  tstep: 0.00002,
  maxstep: 0.00005,
});
export const DEFAULT_AC_RANGE = Object.freeze({
  fstart: 10,
  fstop: 1_000_000,
  pointsPerDecade: 30,
  sweep: "dec" as const,
});

export interface PulseWaveform {
  v1: number;
  v2: number;
  delay: number;
  rise: number;
  fall: number;
  width: number;
  period: number;
}

export interface SineWaveform {
  offset: number;
  amplitude: number;
  frequency: number;
}

function engineering(value: unknown, fallback: number): number {
  if (typeof value !== "number" && typeof value !== "string" && value !== undefined) return Number.NaN;
  return parseEngineering(value, fallback);
}

export function resolvedPulseWaveform(component: CircuitComponent): PulseWaveform {
  return {
    v1: engineering(component.params?.v1, 0),
    v2: engineering(component.params?.v2, engineering(component.value, 5)),
    delay: engineering(component.params?.delay, 0.001),
    rise: engineering(component.params?.rise, 0.00001),
    fall: engineering(component.params?.fall, 0.00001),
    width: engineering(component.params?.width, 0.004),
    period: engineering(component.params?.period, 0.01),
  };
}

export function resolvedSineWaveform(component: CircuitComponent): SineWaveform {
  return {
    offset: engineering(component.params?.offset, 0),
    amplitude: engineering(component.value, 1),
    frequency: engineering(component.params?.frequency, 1_000),
  };
}

export function inspectSourceWaveform(component: CircuitComponent): ValidationIssue[] {
  if (component.type === "vsource_pulse") {
    const pulse = resolvedPulseWaveform(component);
    const entries = Object.entries(pulse) as Array<[keyof PulseWaveform, number]>;
    const issues = entries.flatMap(([field, value]) => Number.isFinite(value)
      ? []
      : [{ path: `components.${component.id}.params.${field}`, message: `Pulse ${field} must be a finite engineering value`, componentId: component.id }]);
    if (Number.isFinite(pulse.delay) && pulse.delay < 0) issues.push({ path: `components.${component.id}.params.delay`, message: "Pulse delay must not be negative", componentId: component.id });
    for (const field of ["rise", "fall"] as const) {
      if (Number.isFinite(pulse[field]) && pulse[field] < 0) issues.push({ path: `components.${component.id}.params.${field}`, message: `Pulse ${field} time must not be negative`, componentId: component.id });
    }
    for (const field of ["width", "period"] as const) {
      if (Number.isFinite(pulse[field]) && pulse[field] <= 0) issues.push({ path: `components.${component.id}.params.${field}`, message: `Pulse ${field} must be greater than zero`, componentId: component.id });
    }
    if (Number.isFinite(pulse.width) && Number.isFinite(pulse.period) && pulse.width > pulse.period) {
      issues.push({ path: `components.${component.id}.params.width`, message: "Pulse width must not exceed its period", componentId: component.id });
    }
    return issues;
  }
  if (component.type === "vsource_sine") {
    const sine = resolvedSineWaveform(component);
    const issues: ValidationIssue[] = [];
    if (!Number.isFinite(sine.offset)) issues.push({ path: `components.${component.id}.params.offset`, message: "Sine offset must be a finite engineering value", componentId: component.id });
    if (!Number.isFinite(sine.amplitude)) issues.push({ path: `components.${component.id}.value`, message: "Sine amplitude must be a finite engineering value", componentId: component.id });
    if (!Number.isFinite(sine.frequency) || sine.frequency <= 0) issues.push({ path: `components.${component.id}.params.frequency`, message: "Sine frequency must be a finite value greater than zero", componentId: component.id });
    return issues;
  }
  return [];
}

export function inspectTransientConfig(config: TransientConfig | undefined): ValidationIssue[] {
  if (!config) return [{ path: "sim.tran", message: "Choose transient stop, output step and maximum step settings" }];
  const issues: ValidationIssue[] = [];
  for (const field of ["tstop", "tstep", "maxstep"] as const) {
    const value = config[field];
    if (value === undefined && field !== "tstop") continue;
    if (!Number.isFinite(value) || (value ?? 0) <= 0) issues.push({ path: `sim.tran.${field}`, message: `Transient ${field} must be a finite value greater than zero` });
  }
  if (Number.isFinite(config.tstep) && config.tstep !== undefined && config.tstep > config.tstop) issues.push({ path: "sim.tran.tstep", message: "Transient output step must not exceed stop time" });
  if (Number.isFinite(config.maxstep) && config.maxstep !== undefined && config.maxstep > config.tstop) issues.push({ path: "sim.tran.maxstep", message: "Transient maximum step must not exceed stop time" });
  return issues;
}

export function defaultACStimulus(document: Pick<CircuitDocument, "components">): ACStimulusConfig | undefined {
  const sources = document.components.filter(isIndependentSource).sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
  const explicit = sources.find((source) => Number.isFinite(engineering(source.params?.ac, Number.NaN)));
  const selected = explicit ?? sources.find((source) => source.type === "vsource_sine") ?? sources.find((source) => source.type === "vsource_pulse") ?? sources[0];
  if (!selected) return undefined;
  return {
    sourceId: selected.id,
    magnitude: engineering(selected.params?.ac, 1),
    phaseDeg: engineering(selected.params?.acPhase, 0),
  };
}

export function defaultACConfig(document: Pick<CircuitDocument, "components">): ACConfig | undefined {
  const stimulus = defaultACStimulus(document);
  return stimulus ? { ...DEFAULT_AC_RANGE, stimulus } : undefined;
}

export function resolvedACConfig(document: Pick<CircuitDocument, "components">, config: ACConfig | undefined): ACConfig | undefined {
  const base = config ?? defaultACConfig(document);
  if (!base) return undefined;
  const stimulus = base.stimulus ?? defaultACStimulus(document);
  return { ...base, ...(stimulus ? { stimulus } : {}) };
}

export function acPointCount(config: Pick<ACConfig, "fstart" | "fstop" | "pointsPerDecade">): number {
  if (![config.fstart, config.fstop, config.pointsPerDecade].every(Number.isFinite)) return 0;
  if (config.fstart <= 0 || config.fstop <= config.fstart || config.pointsPerDecade < 1) return 0;
  return Math.floor(Math.log10(config.fstop / config.fstart) * Math.round(config.pointsPerDecade) + 1e-10) + 1;
}

export function inspectACConfig(
  document: Pick<CircuitDocument, "components">,
  config: ACConfig | undefined,
  maxPoints = AC_MAX_POINTS,
): ValidationIssue[] {
  const resolved = resolvedACConfig(document, config);
  if (!resolved?.stimulus) return [{ path: "sim.ac.stimulus", message: "Choose one independent voltage or current source as the AC stimulus" }];
  const issues: ValidationIssue[] = [];
  const source = document.components.find((component) => component.id === resolved.stimulus!.sourceId && isIndependentSource(component));
  if (!source) issues.push({ path: "sim.ac.stimulus.sourceId", message: "Choose a valid independent voltage or current source as the AC stimulus", componentId: resolved.stimulus.sourceId });
  if (!Number.isFinite(resolved.stimulus.magnitude) || resolved.stimulus.magnitude <= 0) issues.push({ path: "sim.ac.stimulus.magnitude", message: "AC stimulus magnitude must be a finite value greater than zero", ...(source ? { componentId: source.id } : {}) });
  if (!Number.isFinite(resolved.stimulus.phaseDeg)) issues.push({ path: "sim.ac.stimulus.phaseDeg", message: "AC stimulus phase must be finite", ...(source ? { componentId: source.id } : {}) });
  if (![resolved.fstart, resolved.fstop, resolved.pointsPerDecade].every(Number.isFinite)) issues.push({ path: "sim.ac", message: "AC frequency settings must be finite numbers" });
  else {
    if (resolved.fstart <= 0) issues.push({ path: "sim.ac.fstart", message: "AC start frequency must be greater than zero" });
    if (resolved.fstop <= resolved.fstart) issues.push({ path: "sim.ac.fstop", message: "AC stop frequency must be greater than the start frequency" });
    if (!Number.isInteger(resolved.pointsPerDecade) || resolved.pointsPerDecade < 1) issues.push({ path: "sim.ac.pointsPerDecade", message: "AC points per decade must be a positive integer" });
  }
  const points = acPointCount(resolved);
  if (points > maxPoints) issues.push({ path: "sim.ac", message: `AC analysis is limited to ${maxPoints.toLocaleString()} frequency points; this setup requests ${points.toLocaleString()}` });
  return issues;
}
