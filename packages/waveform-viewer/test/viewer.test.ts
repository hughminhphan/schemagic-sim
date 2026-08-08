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
      setCursor(which: "a" | "b", pixelX: number): void;
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

    internal.setCursor("a", 344);
    expect(viewer.getCursorState().a?.values["Pot sweep"]).toBeTypeOf("number");

    viewer.removeAnnotation("pot-sweep");
    expect(internal.annotations.size).toBe(0);
  });
});
