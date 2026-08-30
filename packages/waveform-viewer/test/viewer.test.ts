import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatValue } from "../src/format";
import { mount, paddedRange } from "../src/viewer";
import type { AxisRange } from "../src/types";

class FakeStyle {
  readonly values = new Map<string, string>();
  width = "";
  height = "";

  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly style = new FakeStyle();
  readonly dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  hidden = false;
  tabIndex = -1;
  type = "";
  clientWidth = 640;
  clientHeight = 320;

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...children);
  }

  setAttribute(): void {}
  addEventListener(): void {}
  setPointerCapture(): void {}
  click(): void {}
  remove(): void {}
}

interface StrokeCall {
  strokeStyle: string;
  dash: number[];
  globalAlpha: number;
  clipped: boolean;
  segments: number;
}

class FakeContext {
  fillStyle = "";
  strokeStyle = "";
  font = "";
  textBaseline = "";
  textAlign = "";
  lineWidth = 1;
  globalAlpha = 1;
  readonly dashCalls: number[][] = [];
  readonly fillTextCalls: string[] = [];
  readonly strokeCalls: StrokeCall[] = [];
  clipCount = 0;
  private clipDepth = 0;
  private readonly clipStack: number[] = [];
  private currentDash: number[] = [];
  private currentSegments = 0;

  setTransform(): void {}
  clearRect(): void {}
  fillRect(): void {}
  beginPath(): void { this.currentSegments = 0; }
  moveTo(): void {}
  lineTo(): void { this.currentSegments += 1; }
  stroke(): void {
    this.strokeCalls.push({
      strokeStyle: this.strokeStyle,
      dash: [...this.currentDash],
      globalAlpha: this.globalAlpha,
      clipped: this.clipDepth > 0,
      segments: this.currentSegments,
    });
  }
  fillText(text: string): void { this.fillTextCalls.push(text); }
  strokeRect(): void {}
  save(): void { this.clipStack.push(this.clipDepth); }
  restore(): void { this.clipDepth = this.clipStack.pop() ?? 0; }
  rect(): void {}
  clip(): void { this.clipCount += 1; this.clipDepth += 1; }
  setLineDash(dash: number[]): void {
    this.currentDash = [...dash];
    this.dashCalls.push([...dash]);
  }
}

class FakeCanvas extends FakeElement {
  width = 0;
  height = 0;
  readonly context = new FakeContext();

  getContext(): FakeContext {
    return this.context;
  }

  toDataURL(): string {
    return "data:image/png;base64,test";
  }
}

let lastCanvas: FakeCanvas;

beforeEach(() => {
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        lastCanvas = new FakeCanvas();
        return lastCanvas;
      }
      return new FakeElement();
    },
  });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    disconnect(): void {}
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

describe("waveform viewer rendering", () => {
  it("renders the graticule without an internal empty-state message", () => {
    mount(new FakeElement() as unknown as HTMLElement);

    expect(lastCanvas.context.strokeCalls.length).toBeGreaterThanOrEqual(21);
    expect(lastCanvas.context.fillTextCalls).toContain("AMPLITUDE");
    expect(lastCanvas.context.fillTextCalls).not.toContain("No waveform data");
  });

  it("centres a useful autoscale span around a flat trace", () => {
    const range = paddedRange(new Float64Array([0.0801, 0.0801, 0.0801]));
    expect((range.min + range.max) / 2).toBeCloseTo(0.0801, 12);
    expect(range.max - range.min).toBeGreaterThan(0.008);
    const labels = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
      formatValue(range.max - ratio * (range.max - range.min), { unit: "V", reserveSign: false }),
    );
    expect(new Set(labels).size).toBe(labels.length);

    const viewer = mount(new FakeElement() as unknown as HTMLElement);
    viewer.setData({
      kind: "tran",
      vectors: {
        time: new Float64Array([0, 1, 2]),
        "V(flat)": new Float64Array([0.0801, 0.0801, 0.0801]),
      },
    });
    const yRange = (viewer as unknown as { yRanges: Map<string, AxisRange> }).yRanges.get("V");
    expect(yRange).toEqual(range);
  });

  it("assigns option dashes per trace and applies them at stroke time", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      colors: ["#3FD983", "#E8A244"],
      dashes: [[], [6, 3]],
    });
    viewer.setData({
      kind: "tran",
      vectors: {
        time: new Float64Array([0, 1, 2]),
        "V(a)": new Float64Array([0, 1, 0]),
        "V(b)": new Float64Array([1, 0, 1]),
      },
    });

    const traces = (viewer as unknown as { traces: Array<{ dash: number[] }> }).traces;
    expect(traces.map((trace) => trace.dash)).toEqual([[], [6, 3]]);
    expect(lastCanvas.context.dashCalls).toContainEqual([6, 3]);
  });

  it("renders DC sweep families on a swept-value axis", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      xVector: "sweep",
      xUnit: "V",
      traces: [
        { source: "family-0", label: "V(out) · I2=0 A", unit: "V", color: "#3FD983" },
        { source: "family-1", label: "V(out) · I2=1 mA", unit: "V", color: "#3FD983", dash: [6, 3] },
      ],
    });
    viewer.setData({
      kind: "dc-sweep",
      vectors: {
        sweep: new Float64Array([0, 1, 2]),
        "family-0": new Float64Array([0, 0.7, 0.75]),
        "family-1": new Float64Array([0.1, 0.72, 0.78]),
      },
    });

    const internal = viewer as unknown as { xUnit: string; traces: Array<{ label: string }> };
    expect(internal.xUnit).toBe("V");
    expect(internal.traces.map((trace) => trace.label)).toEqual(["V(out) · I2=0 A", "V(out) · I2=1 mA"]);
    expect(lastCanvas.context.dashCalls).toContainEqual([6, 3]);
  });

  it("renders noise spectral density on a logarithmic frequency axis with explicit units", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      traces: [
        { source: "onoise_spectrum", label: "Output noise", unit: "V/√Hz", axisGroup: "output noise" },
        { source: "inoise_spectrum", label: "Input-referred noise", unit: "V/√Hz", axisGroup: "input noise" },
      ],
    });
    viewer.setData({
      kind: "noise",
      vectors: {
        frequency: new Float64Array([10, 100, 1000]),
        onoise_spectrum: new Float64Array([2e-9, 2e-9, 2e-9]),
        inoise_spectrum: new Float64Array([4e-9, 4e-9, 4e-9]),
      },
    });

    const internal = viewer as unknown as { xScale: string; xUnit: string; traces: Array<{ unit: string }> };
    expect(internal.xScale).toBe("log");
    expect(internal.xUnit).toBe("Hz");
    expect(internal.traces.map((trace) => trace.unit)).toEqual(["V/√Hz", "V/√Hz"]);
    expect(() => viewer.setXScale("linear")).toThrow(/logarithmic frequency/i);
  });

  it("uses distinct default dashes when channels reuse colours", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement);
    viewer.setData({
      kind: "tran",
      vectors: {
        time: new Float64Array([0, 1]),
        "V(1)": new Float64Array([0, 1]),
        "V(2)": new Float64Array([1, 0]),
        "V(3)": new Float64Array([0, 1]),
        "V(4)": new Float64Array([1, 0]),
        "V(5)": new Float64Array([0, 1]),
        "V(6)": new Float64Array([1, 0]),
      },
    });

    const traces = (viewer as unknown as { traces: Array<{ color: string; dash: number[] }> }).traces;
    expect(traces.map((trace) => trace.color)).toEqual([
      "#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#3FD983", "#E8A244",
    ]);
    expect(traces.map((trace) => trace.dash)).toEqual([[], [], [], [], [6, 3], [2, 3]]);
  });

  it("upserts named annotations, clips them, and exposes a cursor value", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement);
    viewer.addAnnotation({
      id: "pot-sweep",
      label: "Pot sweep",
      points: [[-1, 0], [0.5, 1], [Number.NaN, Number.NaN], [2, 2]],
      style: { axisGroup: "voltage", color: "#3FD983", opacity: 0.4, unit: "V", xMode: "normalized" },
    });

    const internal = viewer as unknown as {
      annotations: Map<string, { points: Array<readonly [number, number] | null> }>;
    };
    expect(internal.annotations.get("pot-sweep")?.points[2]).toBeNull();
    expect(lastCanvas.context.clipCount).toBeGreaterThan(0);
    const annotationStrokes = lastCanvas.context.strokeCalls.filter((call) =>
      call.strokeStyle === "#3FD983" && call.globalAlpha === 0.4,
    );
    expect(annotationStrokes).not.toHaveLength(0);
    expect(annotationStrokes.every((call) => call.clipped)).toBe(true);
    expect(annotationStrokes.at(-1)?.segments).toBe(1);

    viewer.addAnnotation({
      id: "pot-sweep",
      label: "Pot sweep",
      points: [[0, 0.4], [1, 1.4]],
      style: { axisGroup: "voltage", unit: "V", xMode: "normalized" },
    });
    expect(internal.annotations.size).toBe(1);
    expect(internal.annotations.get("pot-sweep")?.points).toHaveLength(2);

    viewer.setCursor("a", { x: 0.5 });
    expect(viewer.getCursorState().a?.values["annotation:pot-sweep"]).toBeTypeOf("number");

    viewer.removeAnnotation("pot-sweep");
    expect(internal.annotations.size).toBe(0);
  });

  it("keeps duplicate display labels distinct through stable trace ids", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      traces: [
        { id: "run-a:out", source: "a", label: "V(out)", unit: "V" },
        { id: "run-b:out", source: "b", label: "V(out)", unit: "V" },
      ],
    });
    viewer.setData({
      kind: "tran",
      vectors: {
        time: Float64Array.of(0, 1, 2),
        a: Float64Array.of(1, 2, 3),
        b: Float64Array.of(4, 5, 6),
      },
    });
    viewer.setCursor("a", { x: 1 });

    expect(viewer.getCursorState().a?.values).toMatchObject({ "run-a:out": 2, "run-b:out": 5 });
  });

  it("renders mixed complex and real derived traces on an AC frequency axis", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      traces: [
        { id: "voltage", source: "voltage", label: "V(out)", valueKind: "complex" },
        { id: "gain", source: "gain", label: "Transfer gain", unit: "dB", axisGroup: "gain", valueKind: "real" },
      ],
    });
    expect(() => viewer.setData({
      kind: "ac",
      vectors: {
        frequency: Float64Array.of(10, 100, 1_000),
        voltage: Float64Array.of(1, 0, 0.7, -0.2, 0.1, -0.1),
        gain: Float64Array.of(-0.1, -3, -20),
      },
    })).not.toThrow();
    viewer.setCursor("a", { x: 100 });

    expect(viewer.getCursorState().a?.values).toMatchObject({
      "voltage:magnitude": expect.any(Number),
      "voltage:phase": expect.any(Number),
      gain: -3,
    });
  });

  it("preserves visibility, ranges, layout, and cursors across compatible samples", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      traces: [{ id: "out", source: "out", label: "Output", unit: "V" }],
    });
    viewer.setData({ kind: "tran", vectors: { time: Float64Array.of(0, 1, 2), out: Float64Array.of(0, 1, 0) } });
    viewer.setTraceVisible("out", false);
    viewer.setLayout("stack");
    viewer.setCursor("a", { x: 1 });
    const before = viewer.getState();
    viewer.setTraces([{ id: "out", source: "out", label: "Renamed output", unit: "V" }]);
    expect(viewer.getState()).toEqual(before);
    viewer.setData({ kind: "tran", vectors: { time: Float64Array.of(0, 1, 2), out: Float64Array.of(0, 2, 0) } });

    expect(viewer.getState()).toEqual(before);
  });

  it("reports unit-incompatible overlays", () => {
    const viewer = mount(new FakeElement() as unknown as HTMLElement, {
      layout: "overlay",
      traces: [
        { id: "voltage", source: "v", label: "Signal", unit: "V" },
        { id: "current", source: "i", label: "Signal", unit: "A" },
      ],
    });
    viewer.setData({ kind: "tran", vectors: { time: Float64Array.of(0, 1), v: Float64Array.of(0, 1), i: Float64Array.of(1, 0) } });

    expect(viewer.getDiagnostics()).toContainEqual(expect.objectContaining({ code: "INCOMPATIBLE_OVERLAY" }));
  });
});
