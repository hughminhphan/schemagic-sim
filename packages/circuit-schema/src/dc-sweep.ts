import { parseEngineering } from "./parts";
import type { CircuitComponent, CircuitDocument, DCSweepConfig, DCSweepRange } from "./types";

export const DC_SWEEP_MAX_POINTS = 50_000;

export interface DCSweepShape {
  primaryPoints: number;
  secondaryPoints: number;
  totalPoints: number;
}

export interface DCSweepConfigIssue {
  path: string;
  message: string;
  componentId?: string;
}

export function isIndependentSource(component: CircuitComponent): boolean {
  return component.type === "vsource"
    || component.type === "vsource_pulse"
    || component.type === "vsource_sine"
    || component.type === "isource";
}

function suffix(id: string): string {
  return id.replace(/\D/g, "") || id.replace(/[^a-z0-9]/gi, "");
}

export function dcSweepSourceName(component: CircuitComponent): string {
  if (!isIndependentSource(component)) throw new Error(`${component.id} is not an independent voltage or current source`);
  return `${component.type === "isource" ? "I" : "V"}${suffix(component.id)}`;
}

export function dcSweepSourceUnit(component: CircuitComponent): "V" | "A" {
  return component.type === "isource" ? "A" : "V";
}

export function dcSweepRangePointCount(range: DCSweepRange): number {
  if (![range.start, range.stop, range.step].every(Number.isFinite)) return 0;
  const span = range.stop - range.start;
  if (span === 0 || range.step === 0 || Math.sign(span) !== Math.sign(range.step)) return 0;
  return Math.floor(Math.abs(span / range.step) + 1e-10) + 1;
}

export function inspectDCSweepConfig(
  document: Pick<CircuitDocument, "components">,
  config: DCSweepConfig | undefined,
  maxPoints = DC_SWEEP_MAX_POINTS,
): { issues: DCSweepConfigIssue[]; shape?: DCSweepShape } {
  if (!config) return { issues: [{ path: "sim.dcSweep", message: "Choose a source and range for the DC sweep" }] };
  const issues: DCSweepConfigIssue[] = [];
  const sources = new Map(document.components.filter(isIndependentSource).map((component) => [component.id, component]));
  const inspectRange = (range: DCSweepRange, path: string): number => {
    const component = sources.get(range.sourceId);
    if (!component) issues.push({ path: `${path}.sourceId`, message: "Choose an independent voltage or current source", componentId: range.sourceId });
    if (![range.start, range.stop, range.step].every(Number.isFinite)) {
      issues.push({ path, message: "Sweep start, stop and step must be finite numbers", ...(component ? { componentId: component.id } : {}) });
      return 0;
    }
    if (range.start === range.stop) issues.push({ path, message: "Sweep start and stop must be different", ...(component ? { componentId: component.id } : {}) });
    if (range.step === 0) issues.push({ path: `${path}.step`, message: "Sweep step must not be zero", ...(component ? { componentId: component.id } : {}) });
    if (range.start !== range.stop && range.step !== 0 && Math.sign(range.stop - range.start) !== Math.sign(range.step)) {
      issues.push({ path: `${path}.step`, message: "Sweep step sign must move from start toward stop", ...(component ? { componentId: component.id } : {}) });
    }
    return dcSweepRangePointCount(range);
  };
  const primaryPoints = inspectRange(config, "sim.dcSweep");
  const secondaryPoints = config.secondary ? inspectRange(config.secondary, "sim.dcSweep.secondary") : 1;
  if (config.secondary?.sourceId === config.sourceId) issues.push({ path: "sim.dcSweep.secondary.sourceId", message: "Secondary sweep source must be different from the primary source", componentId: config.sourceId });
  const totalPoints = primaryPoints * secondaryPoints;
  if (totalPoints > maxPoints) issues.push({ path: "sim.dcSweep", message: `DC sweep is limited to ${maxPoints.toLocaleString()} total points; this setup requests ${totalPoints.toLocaleString()}` });
  return issues.length > 0 ? { issues } : { issues, shape: { primaryPoints, secondaryPoints, totalPoints } };
}

export function defaultDCSweepConfig(document: Pick<CircuitDocument, "components">): DCSweepConfig | undefined {
  const sources = document.components.filter(isIndependentSource);
  const primary = sources[0];
  if (!primary) return undefined;
  const unit = dcSweepSourceUnit(primary);
  const nominal = Math.abs(parseEngineering(primary.value, unit === "V" ? 5 : 0.01));
  const stop = nominal > 0 ? nominal : unit === "V" ? 5 : 0.01;
  return { sourceId: primary.id, start: 0, stop, step: stop / 50 };
}
