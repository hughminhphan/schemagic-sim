import { readFileSync } from "node:fs";
import { migrateCircuit } from "@opencircuit/circuit-schema";
import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";
import { decodeCircuit, encodeCircuit } from "./share";

describe("share payload", () => {
  it("round-trips canonical circuit JSON through deflate-raw base64url", () => {
    const payload = encodeCircuit(demoCircuit);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCircuit(payload)).toEqual(demoCircuit);
  });

  it("migrates a v1 share payload on decode", () => {
    const source = readFileSync(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2/demo.v1.json", import.meta.url), "utf8");
    const payload = Buffer.from(deflateSync(strToU8(source), { level: 9 })).toString("base64url");
    expect(decodeCircuit(payload)).toEqual(migrateCircuit(JSON.parse(source)));
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
