import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_RAWFILE_BYTES,
  DEFAULT_MAX_SAMPLES,
  MAX_TIMEOUT_MS,
  SIM_ENGINE_IDENTITY,
  canonicalRunIdentityInput,
  createRunProvenance,
  effectiveSimulationLimits,
} from "../src/identity";

describe("simulation run identity", () => {
  it("hashes the exact final netlist, request spec, engine and effective limits", async () => {
    const limits = effectiveSimulationLimits("runDCSweep", { timeoutMs: 1234, maxSamples: 9000, maxRawfileBytes: 8000 });
    const sweep = { primary: { componentId: "c1", name: "V1", unit: "V" as const, start: 0, stop: 1, step: 0.1 } };
    const first = await createRunProvenance({ type: "runDCSweep", netlist: "exact\n.end\n", limits, sweep });
    const same = await createRunProvenance({ type: "runDCSweep", netlist: "exact\n.end\n", limits: { ...limits }, sweep: structuredClone(sweep) });
    const netlistChanged = await createRunProvenance({ type: "runDCSweep", netlist: "exact \n.end\n", limits, sweep });
    const specChanged = await createRunProvenance({ type: "runDCSweep", netlist: "exact\n.end\n", limits, sweep: { primary: { ...sweep.primary, step: 0.10000000000000002 } } });
    expect(first).toEqual(same);
    expect(first.runKey).toMatch(/^[0-9a-f]{64}$/);
    expect(first.runKey).not.toBe(netlistChanged.runKey);
    expect(first.runKey).not.toBe(specChanged.runKey);
    expect(first.engine).toBe(SIM_ENGINE_IDENTITY);
  });

  it("sorts object keys without sorting arrays and rejects non-finite identity input", () => {
    expect(canonicalRunIdentityInput({ z: 1, a: [2, 1], nested: { y: true, x: "v" } })).toBe('{"a":[2,1],"nested":{"x":"v","y":true},"z":1}');
    expect(() => canonicalRunIdentityInput({ value: Number.NaN })).toThrow(/non-finite/i);
  });

  it("applies and caps hard limits before the run is identified", () => {
    expect(effectiveSimulationLimits("runOpPoint")).toEqual({ timeoutMs: 2000, maxRawfileBytes: DEFAULT_MAX_RAWFILE_BYTES, maxSamples: DEFAULT_MAX_SAMPLES });
    expect(effectiveSimulationLimits("runTransient", { timeoutMs: Number.MAX_SAFE_INTEGER, maxRawfileBytes: Number.MAX_SAFE_INTEGER, maxSamples: Number.MAX_SAFE_INTEGER })).toEqual({
      timeoutMs: MAX_TIMEOUT_MS,
      maxRawfileBytes: DEFAULT_MAX_RAWFILE_BYTES,
      maxSamples: DEFAULT_MAX_SAMPLES,
    });
    expect(() => effectiveSimulationLimits("runAC", { maxSamples: 0 })).toThrow(/positive safe integer/i);
  });
});
