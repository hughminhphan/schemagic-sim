import { readFileSync } from "node:fs";
import { componentCurrentProbe, componentPowerProbe, migrateCircuit, pinVoltageProbe } from "@opencircuit/circuit-schema";
import { importedPartFromModel, parseSpiceLibrary } from "@opencircuit/model-import";
import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";
import { createInitialMeasurementWorkbenchState } from "./measurement-state";
import { decodeCircuit, decodeWorkspaceShare, encodeCircuit, encodeWorkspaceShare } from "./share";

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

  it("shares deterministic instrument profiles without dangling capture state", () => {
    const instrumentState = createInitialMeasurementWorkbenchState();
    instrumentState.profiles[0]!.name = "RC bench";
    instrumentState.profiles[0]!.viewer.cursors.a = { x: 1_000 };
    instrumentState.savedCaptureIds = ["capture-before"];
    instrumentState.comparison = { baselineCaptureId: "capture-before" };

    const first = encodeWorkspaceShare(demoCircuit, instrumentState);
    const decoded = decodeWorkspaceShare(first);

    expect(decoded.document).toEqual(demoCircuit);
    expect(decoded.instrumentState?.profiles[0]?.name).toBe("RC bench");
    expect(decoded.instrumentState?.profiles[0]?.viewer.cursors.a).toEqual({ x: 1_000 });
    expect(decoded.instrumentState?.savedCaptureIds).toEqual([]);
    expect(decoded.instrumentState?.comparison).toEqual({});
    expect(encodeWorkspaceShare(decoded.document, decoded.instrumentState)).toBe(first);
  });

  it("deterministically preserves imported source, expression probes, and all analysis settings", () => {
    const document = structuredClone(demoCircuit);
    const sourceText = ".model USER_Q NPN(BF=120)";
    const record = importedPartFromModel(parseSpiceLibrary(sourceText).models[0]!, {
      sourceName: "user.model",
      sourceText,
      baseType: "bjt_npn",
    });
    document.modelImports = { format: "opencircuit-imported-models", version: 1, parts: [record] };
    document.components.find((component) => component.id === "c4")!.params = { importedPartId: record.id };
    document.probes = [
      pinVoltageProbe("p1", "c4", 0),
      componentCurrentProbe("p2", "c4", 0),
      componentPowerProbe("p3", "c4"),
    ];
    document.sim = {
      mode: "live",
      tran: { tstep: 1e-6, tstop: 1e-3, maxstep: 2e-6 },
      ac: {
        fstart: 20,
        fstop: 2_000_000,
        pointsPerDecade: 40,
        sweep: "dec",
        stimulus: { sourceId: "c1", magnitude: 0.5, phaseDeg: 45 },
      },
      noise: {
        outputProbeId: "p1", inputSourceId: "c1", fstart: 20, fstop: 2_000_000,
        pointsPerDecade: 40, sweep: "dec", temperatureC: 85,
      },
    };

    const first = encodeCircuit(document);
    const decoded = decodeCircuit(first);
    expect(encodeCircuit(decoded)).toBe(first);
    expect(decoded).toEqual(document);
  });

  it("rejects malformed base64url instead of partially loading it", () => {
    expect(() => decodeCircuit("not+base64")).toThrow(/malformed|valid supported/i);
  });
});
