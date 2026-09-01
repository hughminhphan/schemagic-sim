import { dcSweepSourceUnit, isIndependentSource } from "./dc-sweep";
import { simpleVoltageExpression } from "./probes";
import type { CircuitDocument, CircuitProbe, NoiseConfig } from "./types";

export const NOISE_MAX_POINTS = 200_000;
export const DEFAULT_NOISE_TEMPERATURE_C = 27;

export interface NoiseConfigIssue {
  path: string;
  message: string;
  componentId?: string;
}

export interface NoiseShape {
  points: number;
  inputUnit: "V" | "A";
}

function voltageProbe(document: Pick<CircuitDocument, "components" | "wires" | "probes">, probeId: string): CircuitProbe | undefined {
  const probe = document.probes.find((candidate) => candidate.id === probeId);
  return probe && simpleVoltageExpression(probe) ? probe : undefined;
}

export function noisePointCount(config: Pick<NoiseConfig, "fstart" | "fstop" | "pointsPerDecade">): number {
  if (![config.fstart, config.fstop, config.pointsPerDecade].every(Number.isFinite)) return 0;
  if (config.fstart <= 0 || config.fstop <= config.fstart || config.pointsPerDecade < 1) return 0;
  return Math.floor(Math.log10(config.fstop / config.fstart) * Math.round(config.pointsPerDecade) + 1e-10) + 1;
}

export function inspectNoiseConfig(
  document: Pick<CircuitDocument, "components" | "wires" | "probes">,
  config: NoiseConfig | undefined,
  maxPoints = NOISE_MAX_POINTS,
): { issues: NoiseConfigIssue[]; shape?: NoiseShape } {
  if (!config) return { issues: [{ path: "sim.noise", message: "Choose an output probe, input source and frequency range for noise analysis" }] };
  const issues: NoiseConfigIssue[] = [];
  const probe = voltageProbe(document, config.outputProbeId);
  if (!probe) issues.push({ path: "sim.noise.outputProbeId", message: "Choose a valid voltage probe for the output noise measurement" });
  const source = document.components.find((component) => component.id === config.inputSourceId && isIndependentSource(component));
  if (!source) issues.push({ path: "sim.noise.inputSourceId", message: "Choose an independent voltage or current source as the input reference", componentId: config.inputSourceId });
  if (![config.fstart, config.fstop, config.pointsPerDecade].every(Number.isFinite)) {
    issues.push({ path: "sim.noise", message: "Noise frequency settings must be finite numbers" });
  } else {
    if (config.fstart <= 0) issues.push({ path: "sim.noise.fstart", message: "Noise start frequency must be greater than zero" });
    if (config.fstop <= config.fstart) issues.push({ path: "sim.noise.fstop", message: "Noise stop frequency must be greater than the start frequency" });
    if (!Number.isInteger(config.pointsPerDecade) || config.pointsPerDecade < 1) issues.push({ path: "sim.noise.pointsPerDecade", message: "Noise points per decade must be a positive integer" });
  }
  const temperatureC = config.temperatureC;
  if (!Number.isFinite(temperatureC) || temperatureC <= -273.15 || temperatureC > 1000) {
    issues.push({ path: "sim.noise.temperatureC", message: "Noise temperature must be above absolute zero and no more than 1000 °C" });
  }
  const points = noisePointCount(config);
  if (points > maxPoints) issues.push({ path: "sim.noise", message: `Noise analysis is limited to ${maxPoints.toLocaleString()} frequency points; this setup requests ${points.toLocaleString()}` });
  return issues.length > 0 || !source ? { issues } : { issues, shape: { points, inputUnit: dcSweepSourceUnit(source) } };
}

export function defaultNoiseConfig(document: Pick<CircuitDocument, "components" | "wires" | "probes">): NoiseConfig | undefined {
  const output = document.probes.find((probe) => simpleVoltageExpression(probe));
  const input = document.components.find(isIndependentSource);
  if (!output || !input) return undefined;
  return {
    outputProbeId: output.id,
    inputSourceId: input.id,
    fstart: 10,
    fstop: 1_000_000,
    pointsPerDecade: 30,
    sweep: "dec",
    temperatureC: DEFAULT_NOISE_TEMPERATURE_C,
  };
}
