import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";
import { decodeCircuit, encodeCircuit } from "./share";

describe("share payload", () => {
  it("round-trips canonical circuit JSON through deflate-raw base64url", () => {
    const payload = encodeCircuit(demoCircuit);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCircuit(payload)).toEqual(demoCircuit);
  });

  it("preserves noise settings in share URLs", () => {
    const noiseCircuit = structuredClone(demoCircuit);
    noiseCircuit.sim = {
      ...noiseCircuit.sim,
      mode: "noise",
      noise: {
        outputProbeId: "p1",
        inputSourceId: "c1",
        fstart: 10,
        fstop: 1_000_000,
        pointsPerDecade: 30,
        sweep: "dec",
        temperatureC: 27,
      },
    };
    expect(decodeCircuit(encodeCircuit(noiseCircuit)).sim.noise).toEqual(noiseCircuit.sim.noise);
  });
});
