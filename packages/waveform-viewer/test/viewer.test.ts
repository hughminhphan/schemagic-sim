import { beforeEach, describe, expect, it, vi } from "vitest";
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

class FakeContext {
  fillStyle = "";
  strokeStyle = "";
  font = "";
  textBaseline = "";
  textAlign = "";
  lineWidth = 1;
  globalAlpha = 1;
  readonly dashCalls: number[][] = [];
  clipCount = 0;

  setTransform(): void {}
  clearRect(): void {}
  fillRect(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  stroke(): void {}
  fillText(): void {}
  strokeRect(): void {}
  save(): void {}
  restore(): void {}
  rect(): void {}
  clip(): void { this.clipCount += 1; }
  setLineDash(dash: number[]): void { this.dashCalls.push([...dash]); }
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
  it("centres a useful autoscale span around a flat trace", () => {
    const range = paddedRange(new Float64Array([0.0801, 0.0801, 0.0801]));
    expect((range.min + range.max) / 2).toBeCloseTo(0.0801, 12);
    expect(range.max - range.min).toBeGreaterThan(0.008);

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
