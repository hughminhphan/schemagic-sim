import { describe, expect, it } from "vitest";
import {
  COMPONENT_CURRENT_VECTOR_POLICY,
  generateNetlist,
  inspectACConfig,
  inspectSourceWaveform,
  inspectTransientConfig,
  resolvedPulseWaveform,
  resolvedSineWaveform,
  spiceNumber,
  type CircuitDocument,
} from "../src";

const document: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 3,
  meta: { title: "Analysis controls" },
  components: [
    { id: "v1", type: "vsource", value: "5V", pos: [0, 0], rot: 0, mirror: false },
    { id: "i1", type: "isource", value: "1mA", pos: [8, 0], rot: 0, mirror: false },
    { id: "g1", type: "ground", pos: [0, 2], rot: 0, mirror: false },
  ],
  wires: [], probes: [],
  sim: {
    mode: "ac",
    ac: {
      fstart: 10, fstop: 1_000_000, pointsPerDecade: 30, sweep: "dec",
      stimulus: { sourceId: "i1", magnitude: 0.25, phaseDeg: -90 },
    },
  },
};

describe("analysis controls", () => {
  it("emits AC stimulus only on the exactly selected independent source", () => {
    expect(inspectACConfig(document, document.sim.ac)).toEqual([]);
    const netlist = generateNetlist(document, "ac").netlist;
    expect(netlist).toMatch(/^V1 .* DC 5 \$ component:v1$/m);
    expect(netlist).toMatch(/^I1 .* DC 1m AC 0\.25 -90 \$ component:i1$/m);
    expect(netlist.match(/ AC /g)).toHaveLength(1);
  });

  it("saves only current vectors that the selected analysis can honestly provide", () => {
    const ac = generateNetlist(document, "ac");
    expect(COMPONENT_CURRENT_VECTOR_POLICY).toEqual({
      live: "saved", op: "saved", "dc-sweep": "saved", tran: "saved", ac: "saved", noise: "unsupported",
    });
    expect(ac.componentCurrents).toEqual({ i1: "vocsi1#branch", v1: "v1#branch" });
    expect(ac.netlist).toMatch(/^VOCSi1 .* 0 \$ component:i1$/m);
    expect(ac.netlist).toMatch(/^\.save all .*vocsi1#branch.*v1#branch|^\.save all .*v1#branch.*vocsi1#branch/m);
    expect(ac.netlist).not.toMatch(/@\w+\[i\]/i);

    const transient = generateNetlist(document, "tran");
    expect(transient.componentCurrents).toMatchObject({ i1: "@i1[i]", v1: "v1#branch" });
    expect(transient.netlist).toMatch(/^\.save all .*(?:@i1\[i\]|v1#branch)/m);
  });

  it("validates transient output and maximum step independently", () => {
    expect(inspectTransientConfig({ tstop: 1e-3, tstep: 1e-6, maxstep: 2e-6 })).toEqual([]);
    expect(inspectTransientConfig({ tstop: 1e-3, tstep: 2e-3, maxstep: 2e-6 })[0]?.path).toBe("sim.tran.tstep");
    expect(inspectTransientConfig({ tstop: 1e-3, tstep: 1e-6, maxstep: 2e-3 })[0]?.path).toBe("sim.tran.maxstep");
  });

  it("resolves editable pulse and sine fields with amplitude stored in component.value", () => {
    const pulse = { id: "vp", type: "vsource_pulse" as const, value: "3.3V", params: { v1: "0V", delay: "500u", rise: "10u", fall: "20u", width: "2m", period: "4m" }, pos: [0, 0] as [number, number], rot: 0 as const, mirror: false };
    const resolvedPulse = resolvedPulseWaveform(pulse);
    expect(resolvedPulse).toMatchObject({ v1: 0, v2: 3.3, delay: 0.0005, width: 0.002, period: 0.004 });
    expect(resolvedPulse.rise).toBeCloseTo(0.00001, 12);
    expect(resolvedPulse.fall).toBeCloseTo(0.00002, 12);
    const sine = { id: "vs", type: "vsource_sine" as const, value: "350mV", params: { offset: "1V", frequency: "10kHz" }, pos: [0, 0] as [number, number], rot: 0 as const, mirror: false };
    const resolvedSine = resolvedSineWaveform(sine);
    expect(resolvedSine).toMatchObject({ offset: 1, frequency: 10_000 });
    expect(resolvedSine.amplitude).toBeCloseTo(0.35, 12);
    expect(inspectSourceWaveform(sine)).toEqual([]);
  });

  it("normalizes safe engineering tokens and rejects netlist injection", () => {
    expect(spiceNumber("10 kΩ", 0)).toBe("10k");
    expect(spiceNumber("1MegOhm", 0)).toBe("1meg");
    expect(() => spiceNumber("1); shell touch /tmp/x", 0)).toThrow(/finite engineering/i);
  });
});
