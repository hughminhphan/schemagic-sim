import type { SimulationLimits, SimulationRequestType, SimulationRunProvenance } from "./types";

export const SIM_ENGINE_IDENTITY = "ngspice-46-opencircuit-wasm1" as const;
export const RUN_IDENTITY_VERSION = 1 as const;
export const DEFAULT_MAX_RAWFILE_BYTES = 128 * 1024 * 1024;
export const DEFAULT_MAX_SAMPLES = 1_000_000;
export const MAX_TIMEOUT_MS = 60_000;

function finitePositiveInteger(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

export function effectiveSimulationLimits(type: SimulationRequestType, requested: SimulationLimits = {}): Required<SimulationLimits> {
  const timeoutMs = finitePositiveInteger(requested.timeoutMs, "timeoutMs") ?? (type === "runOpPoint" ? 2_000 : 10_000);
  const maxRawfileBytes = finitePositiveInteger(requested.maxRawfileBytes, "maxRawfileBytes") ?? DEFAULT_MAX_RAWFILE_BYTES;
  const maxSamples = finitePositiveInteger(requested.maxSamples, "maxSamples") ?? DEFAULT_MAX_SAMPLES;
  return {
    timeoutMs: Math.min(timeoutMs, MAX_TIMEOUT_MS),
    maxRawfileBytes: Math.min(maxRawfileBytes, DEFAULT_MAX_RAWFILE_BYTES),
    maxSamples: Math.min(maxSamples, DEFAULT_MAX_SAMPLES),
  };
}

function canonical(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Run identity cannot contain non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => [key, canonical(record[key])]));
  }
  return value;
}

export function canonicalRunIdentityInput(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256(source: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable in this runtime");
  return hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)));
}

export interface RunIdentityInput {
  type: SimulationRequestType;
  netlist: string;
  limits: Required<SimulationLimits>;
  sweep?: unknown;
  noise?: unknown;
}

export async function createRunProvenance(input: RunIdentityInput): Promise<SimulationRunProvenance> {
  const runKey = await sha256(canonicalRunIdentityInput({
    identityVersion: RUN_IDENTITY_VERSION,
    engine: SIM_ENGINE_IDENTITY,
    type: input.type,
    netlist: input.netlist,
    limits: input.limits,
    ...(input.sweep !== undefined ? { sweep: input.sweep } : {}),
    ...(input.noise !== undefined ? { noise: input.noise } : {}),
  }));
  return { runKey, identityVersion: RUN_IDENTITY_VERSION, engine: SIM_ENGINE_IDENTITY, requestType: input.type, limits: input.limits };
}
