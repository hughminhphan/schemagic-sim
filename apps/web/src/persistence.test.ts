import { describe, expect, it } from "vitest";
import type { CircuitDocument } from "@opencircuit/circuit-schema";
import {
  MAX_CAPTURE_BYTES,
  captureSizeBytes,
  exportWorkspaceBundle,
  importWorkspaceBundle,
  type SavedCapture,
  type SavedCaptureInput,
  type Workspace,
} from "./persistence";

const document: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 3,
  meta: { title: "Persistence test" },
  components: [{ id: "g1", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
  wires: [],
  probes: [],
  sim: { mode: "tran", tran: { tstop: 1 } },
};

function input(values = Float64Array.of(-0, Math.PI, -2.5)): SavedCaptureInput {
  return {
    id: "capture-a",
    workspaceId: "workspace-a",
    name: "Before",
    createdAt: 123,
    identity: {
      circuitHash: "circuit-hash",
      engine: "ngspice-test",
      runKey: "run-a",
      modelIdentities: [{ componentId: "r1", modelId: "builtin:resistor" }],
      analysisSettings: { mode: "tran", tstop: 1 },
    },
    signals: [{
      definition: {
        id: "out",
        label: "Output",
        expression: { kind: "voltage", positive: { kind: "runtime-node", name: "out" }, negative: { kind: "runtime-node", name: "0" } },
        quantity: "voltage",
        unit: "V",
        polarity: "signed",
      },
      runKey: "run-a",
      axis: { id: "time", quantity: "time", unit: "s", values: Float64Array.of(0, 0.5, 1) },
      signal: {
        kind: "real",
        unit: "V",
        dimension: { voltage: 1, current: 0, time: 0 },
        length: values.length,
        canonicalExpression: "V(out)",
        values,
      },
    }],
    measurements: [],
  };
}

describe("workspace capture bundles", () => {
  it("exports deterministically and restores exact Float64 vectors", () => {
    const captureInput = input();
    const capture: SavedCapture = { ...captureInput, sizeBytes: captureSizeBytes(captureInput) };
    const workspace: Workspace = { id: "workspace-a", name: "Test", updatedAt: 456, document };

    const first = exportWorkspaceBundle(workspace, [capture]);
    const second = exportWorkspaceBundle(workspace, [capture]);
    const restored = importWorkspaceBundle(first);

    expect(second).toBe(first);
    const values = restored.captures[0]!.signals[0]!.signal.values;
    expect(Object.is(values[0], -0)).toBe(true);
    expect([...values.slice(1)]).toEqual([Math.PI, -2.5]);
    expect(restored.workspace.document.version).toBe(3);
    expect(first).not.toContain("rawfile");
  });

  it("rejects a selected-vector capture beyond the per-capture bound", () => {
    const oversized = input(new Float64Array(Math.ceil(MAX_CAPTURE_BYTES / 8) + 1));
    const capture: SavedCapture = { ...oversized, sizeBytes: captureSizeBytes(oversized) };
    const workspace: Workspace = { id: "workspace-a", name: "Test", updatedAt: 456, document };

    expect(() => exportWorkspaceBundle(workspace, [capture])).toThrow(/capture limit|total capture limit/i);
  });

  it("rejects a bundle whose migrated circuit contract is invalid", () => {
    const workspace: Workspace = { id: "workspace-a", name: "Test", updatedAt: 456, document };
    const bundle = JSON.parse(exportWorkspaceBundle(workspace, [])) as { workspace: { document: CircuitDocument } };
    bundle.workspace.document.components = [];

    expect(() => importWorkspaceBundle(JSON.stringify(bundle))).toThrow(/ground/i);
  });
});
