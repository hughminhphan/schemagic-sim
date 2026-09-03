import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { componentCurrentProbe, componentPowerProbe, migrateCircuit, pinVoltageProbe, type CircuitDocument } from "@opencircuit/circuit-schema";
import { importedPartFromModel, parseSpiceLibrary } from "@opencircuit/model-import";
import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";
import { createInitialMeasurementWorkbenchState } from "./measurement-state";
import { circuitFromLocation, decodeCircuit, decodeWorkspaceShare, encodeCircuit, encodeWorkspaceShare, shareUrl } from "./share";

const examplesDirectory = fileURLToPath(new URL("../../../examples/", import.meta.url));

function fixturePaths(directory = examplesDirectory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return fixturePaths(path);
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  }).sort();
}

function fixtureCircuit(path: string): CircuitDocument {
  return migrateCircuit(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

const fixtures = fixturePaths().map((path) => ({
  name: path.slice(examplesDirectory.length).replace(/\.json$/, ""),
  path,
  document: fixtureCircuit(path),
}));

describe("share payload", () => {
  it("round-trips canonical circuit data through versioned structural binary compression", () => {
    const payload = encodeCircuit(demoCircuit);
    expect(payload).toMatch(/^v2\.[A-Za-z0-9_-]+$/);
    expect(decodeCircuit(payload)).toEqual(demoCircuit);
  });

  it("keeps unprefixed and explicitly prefixed v1 JSON payloads readable", () => {
    const source = readFileSync(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2/demo.v1.json", import.meta.url), "utf8");
    const legacy = Buffer.from(deflateSync(strToU8(source), { level: 9 })).toString("base64url");
    const expected = migrateCircuit(JSON.parse(source));
    expect(decodeCircuit(legacy)).toEqual(expected);
    expect(decodeCircuit(`v1.${legacy}`)).toEqual(expected);
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
    expect(shareUrl(document, new URL("https://sim.robonyx.com/") as unknown as Location).length).toBeLessThanOrEqual(8_000);
  });

  it("round-trips a one-megabyte imported model source without exceeding argument limits", () => {
    const document = structuredClone(demoCircuit);
    const modelLine = ".model LARGE_MODEL NPN(BF=120)";
    const sourceText = `${modelLine}\n`.padEnd(1_048_576, "*");
    const record = importedPartFromModel(parseSpiceLibrary(modelLine).models[0]!, {
      sourceName: "large-model.lib",
      sourceText,
      baseType: "bjt_npn",
    });
    document.modelImports = { format: "opencircuit-imported-models", version: 1, parts: [record] };

    expect(Buffer.byteLength(sourceText, "utf8")).toBeGreaterThanOrEqual(1_048_576);
    expect(decodeCircuit(encodeCircuit(document))).toEqual(document);
  });

  it.each(fixtures)("round-trips fixture $name", ({ document }) => {
    const payload = encodeCircuit(document);
    expect(decodeCircuit(payload)).toEqual(document);
    expect(encodeCircuit(decodeCircuit(payload))).toBe(payload);
  });

  it("keeps the largest fixture URL inside the platform ceiling and target", () => {
    const urls = fixtures.map(({ name, document }) => ({
      name,
      url: shareUrl(document, new URL("https://sim.robonyx.com/") as unknown as Location),
    }));
    const largest = urls.sort((left, right) => right.url.length - left.url.length)[0]!;
    expect(largest.url.length, `${largest.name} share URL`).toBeLessThanOrEqual(8_000);
    expect(largest.url.length, `${largest.name} share URL`).toBeLessThanOrEqual(2_000);
  });

  it("decodes every recorded example share URL to its fixture circuit", () => {
    const recorded = [...readFileSync(join(examplesDirectory, "URLS.md"), "utf8").matchAll(/^- ([^:]+): (https?:\/\/\S+)$/gm)];
    expect(recorded.length).toBeGreaterThan(0);
    for (const [, name, url] of recorded) {
      const fixture = fixtures.find((candidate) => candidate.name === name);
      expect(fixture, `fixture for recorded URL ${name}`).toBeDefined();
      const decoded = circuitFromLocation(new URL(url!).hash);
      if (!decoded) {
        throw new Error(`recorded URL ${name} did not decode`);
      }
      if (name === "zener-regulator") {
        // The published URL predates the dedicated Zener visual variant. Keep
        // its exact legacy diode shape readable; catalog resolution accepts
        // that one historical binding without rewriting the immutable URL.
        expect(decoded.components.find((component) => component.id === "c3")?.type).toBe("diode");
        const visualUpgrade = structuredClone(decoded);
        visualUpgrade.components.find((component) => component.id === "c3")!.type = "zener";
        expect(visualUpgrade, name).toEqual(fixture!.document);
      } else {
        expect(decoded, name).toEqual(fixture!.document);
      }
    }
  });

  it("rejects malformed or unsupported payloads instead of partially loading them", () => {
    expect(() => decodeCircuit("not+base64")).toThrow(/valid supported/i);
    expect(() => decodeCircuit("v9.abc")).toThrow(/valid supported/i);
  });
});
