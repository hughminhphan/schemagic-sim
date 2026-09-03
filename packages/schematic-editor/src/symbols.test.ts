import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PARTS,
  componentPinPoints,
  type CircuitComponent,
  type ComponentType,
  type Point,
  type Rotation,
} from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { componentSymbolMarkup, partSymbolMarkup } from "./index";
import { EDITOR_SYMBOLS } from "./symbols.generated";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rotations: readonly Rotation[] = [0, 90, 180, 270];
const mirrors = [false, true] as const;

interface SymbolGolden {
  pins: readonly (readonly [number, number])[];
  bodyBbox: readonly [number, number, number, number];
  bbox: readonly [number, number, number, number];
  refdesAnchor: readonly [number, number];
  valueAnchor: readonly [number, number];
}

const GOLDENS = {
  resistor: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1.3333, -0.5333, 1.3333, 0.5333], bbox: [-2, -0.5333, 2, 0.5333], refdesAnchor: [0, -1.3333], valueAnchor: [0, 1.3333] },
  capacitor: { pins: [[-2, 0], [2, 0]], bodyBbox: [-0.4, -1.0667, 0.4, 1.0667], bbox: [-2, -1.0667, 2, 1.0667], refdesAnchor: [-1.3333, -0.3333], valueAnchor: [1.3333, -0.3333] },
  inductor: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1.3333, -0.3319, 1.3333, 0], bbox: [-2, -0.3319, 2, 0], refdesAnchor: [0, 0.6667], valueAnchor: [0, -1] },
  vsource: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2], refdesAnchor: [1, -1], valueAnchor: [1, 0] },
  vsource_pulse: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2], refdesAnchor: [1, -1], valueAnchor: [1, 0] },
  vsource_sine: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2], refdesAnchor: [1, -1], valueAnchor: [1, 0] },
  isource: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2], refdesAnchor: [1, -1], valueAnchor: [1, 0] },
  isource_pulse: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2], refdesAnchor: [1, -1], valueAnchor: [1, 0] },
  ground: { pins: [[0, 0]], bodyBbox: [-0.6667, 0, 0.6667, 1.3333], bbox: [-0.6667, 0, 0.6667, 1.3333], refdesAnchor: [0, 3.3333], valueAnchor: [0, 2] },
  switch_spst: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1, -0.7, 1, 0.2], bbox: [-2, -0.7, 2, 0.2], refdesAnchor: [0, -1.25], valueAnchor: [0, 1] },
  switch_spdt: { pins: [[-2, 0], [2, -1], [2, 1]], bodyBbox: [-1, -1, 1, 1], bbox: [-2, -1, 2, 1], refdesAnchor: [0, -2], valueAnchor: [0, 2] },
  switch_dpdt: { pins: [[-3, -2], [3, -3], [3, -1], [-3, 2], [3, 1], [3, 3]], bodyBbox: [-2, -3, 2, 3], bbox: [-3, -3, 3, 3], refdesAnchor: [0, -4.3333], valueAnchor: [0, 4.3333] },
  switch_pushbutton: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1, -1.35, 1, 0.2], bbox: [-2, -1.35, 2, 0.2], refdesAnchor: [0, -2], valueAnchor: [0, 1.4] },
  switch_toggle: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1, -1.35, 1, 0.2], bbox: [-2, -1.35, 2, 0.2], refdesAnchor: [0, -2], valueAnchor: [0, 1.4] },
  switch_vcontrolled: { pins: [[-3, -1], [3, -1], [-1, 3], [1, 3]], bodyBbox: [-1.5, -2, 1.5, 1], bbox: [-3, -2, 3, 3], refdesAnchor: [0, -3.3333], valueAnchor: [0, 4.3333] },
  potentiometer: { pins: [[0, -2], [2, 0], [0, 2]], bodyBbox: [-0.5333, -2.2667, 1.3333, 2.2667], bbox: [-0.5333, -2.2667, 2, 2.2667], refdesAnchor: [-2.3333, 0], valueAnchor: [-1.3333, 0] },
  diode: { pins: [[0, -2], [0, 2]], bodyBbox: [-0.6667, -0.6667, 0.6667, 0.6667], bbox: [-0.6667, -2, 0.6667, 2], refdesAnchor: [-1.3333, 0], valueAnchor: [1.3333, 0] },
  zener: { pins: [[0, -2], [0, 2]], bodyBbox: [-0.9, -0.6667, 0.9, 0.9], bbox: [-0.9, -2, 0.9, 2], refdesAnchor: [-1.3333, 0], valueAnchor: [1.3333, 0] },
  led: { pins: [[0, -2], [0, 2]], bodyBbox: [-0.6667, -0.6667, 1.2, 2.4], bbox: [-0.6667, -2, 1.2, 2.4], refdesAnchor: [-1.3333, 0], valueAnchor: [1.3333, 0] },
  bjt_npn: { pins: [[2, -3], [-2, 0], [2, 3]], bodyBbox: [-0.6667, -1.665, 2.8133, 1.665], bbox: [-2, -3, 2.8133, 3], refdesAnchor: [-0.6667, -4.5], valueAnchor: [-0.6667, -3] },
  bjt_pnp: { pins: [[2, -3], [-2, 0], [2, 3]], bodyBbox: [-0.6667, -1.665, 2.8133, 1.665], bbox: [-2, -3, 2.8133, 3], refdesAnchor: [-0.6667, -4.5], valueAnchor: [-0.6667, -3] },
  nmos: { pins: [[2, -3], [-2, 0], [2, 3]], bodyBbox: [-0.6667, -1.65, 3, 1.65], bbox: [-2, -3, 3, 3], refdesAnchor: [3.3333, -0.75], valueAnchor: [3.3333, 0.75] },
  pmos: { pins: [[2, -3], [-2, 0], [2, 3]], bodyBbox: [-0.6667, -1.65, 3, 1.65], bbox: [-2, -3, 3, 3], refdesAnchor: [3.3333, -0.75], valueAnchor: [3.3333, 0.75] },
  opamp_ideal: { pins: [[-4, -2], [-4, 2], [4, 0]], bodyBbox: [-2.6667, -4, 2.6667, 4], bbox: [-4, -4, 4, 4], refdesAnchor: [2, -2.5], valueAnchor: [2, 2.5] },
  vcvs: { pins: [[0, -3], [0, 3], [-3, -1], [-3, 1]], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -3, 2, 3], refdesAnchor: [2.6, -2], valueAnchor: [2.6, 2] },
  vccs: { pins: [[0, -3], [0, 3], [-3, -1], [-3, 1]], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -3, 2, 3], refdesAnchor: [2.6, -2], valueAnchor: [2.6, 2] },
  cccs: { pins: [[0, -3], [0, 3], [-3, -1], [-3, 1]], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -3, 2, 3], refdesAnchor: [2.6, -2], valueAnchor: [2.6, 2] },
  ccvs: { pins: [[0, -3], [0, 3], [-3, -1], [-3, 1]], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -3, 2, 3], refdesAnchor: [2.6, -2], valueAnchor: [2.6, 2] },
  behavioral_source: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2], refdesAnchor: [1, -1], valueAnchor: [1, 0] },
  transformer: { pins: [[-3, -2], [-3, 2], [3, -2], [3, 2]], bodyBbox: [-1.75, -2, 1.75, 2], bbox: [-3, -2, 3, 2], refdesAnchor: [0, -3.3333], valueAnchor: [0, 3.3333] },
  crystal: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1, -1, 1, 1], bbox: [-2, -1, 2, 1], refdesAnchor: [0, -2], valueAnchor: [0, 2] },
  transmission_line: { pins: [[-3, -1], [-3, 1], [3, -1], [3, 1]], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -2, 3, 2], refdesAnchor: [0, -3.3333], valueAnchor: [0, 3.3333] },
  battery: { pins: [[0, -2], [0, 2]], bodyBbox: [-1, -0.35, 1, 0.35], bbox: [-1, -2, 1, 2], refdesAnchor: [1.3333, -0.7], valueAnchor: [1.3333, 0.7] },
  fuse: { pins: [[-2, 0], [2, 0]], bodyBbox: [-1.2, -0.6, 1.2, 0.6], bbox: [-2, -0.6, 2, 0.6], refdesAnchor: [0, -1.6], valueAnchor: [0, 1.6] },
  timer_555: { pins: [[-6, -3], [-6, -1], [-6, 1], [-6, 3], [6, 3], [6, 1], [6, -1], [6, -3]], bodyBbox: [-4, -4, 4, 4], bbox: [-6, -4, 6, 4], refdesAnchor: [0, -5.3333], valueAnchor: [0, 5.3333] },
  vreg_linear_3: { pins: [[-4, 0], [4, 0], [0, 3]], bodyBbox: [-3, -2, 3, 2], bbox: [-4, -2, 4, 3], refdesAnchor: [0, -3.3333], valueAnchor: [0, 4.3333] },
  comparator: { pins: [[-6, -2], [-6, 2], [6, 0], [0, -5], [0, 5]], bodyBbox: [-4, -4, 4, 4], bbox: [-6, -5, 6, 5], refdesAnchor: [-2, -5.3333], valueAnchor: [-2, 5.3333] },
  jfet_n: { pins: [[2, -3], [-2, 0], [2, 3]], bodyBbox: [-1, -1.8, 2.6, 1.8], bbox: [-2, -3, 2.6, 3], refdesAnchor: [3.3333, -0.75], valueAnchor: [3.3333, 0.75] },
  optocoupler_led: { pins: [[0, -2], [0, 2]], bodyBbox: [-1.7333, -1.7333, 1.7333, 1.7333], bbox: [-1.7333, -2, 1.7333, 2], refdesAnchor: [-2.6667, 0], valueAnchor: [2.6667, 0] },
  ic_block_2: { pins: [[-6, 0], [6, 0]], bodyBbox: [-4, -1, 4, 1], bbox: [-6, -1, 6, 1], refdesAnchor: [0, -2.3333], valueAnchor: [0, 2.3333] },
  ic_block_3: { pins: [[-6, -1], [-6, 1], [6, -1]], bodyBbox: [-4, -2, 4, 2], bbox: [-6, -2, 6, 2], refdesAnchor: [0, -3.3333], valueAnchor: [0, 3.3333] },
  ic_block_4: { pins: [[-6, -1], [-6, 1], [6, 1], [6, -1]], bodyBbox: [-4, -2, 4, 2], bbox: [-6, -2, 6, 2], refdesAnchor: [0, -3.3333], valueAnchor: [0, 3.3333] },
  ic_block_5: { pins: [[-6, -2], [-6, 0], [-6, 2], [6, 0], [6, -2]], bodyBbox: [-4, -3, 4, 3], bbox: [-6, -3, 6, 3], refdesAnchor: [0, -4.3333], valueAnchor: [0, 4.3333] },
  ic_block_6: { pins: [[-6, -2], [-6, 0], [-6, 2], [6, 2], [6, 0], [6, -2]], bodyBbox: [-4, -3, 4, 3], bbox: [-6, -3, 6, 3], refdesAnchor: [0, -4.3333], valueAnchor: [0, 4.3333] },
  ic_block_8: { pins: [[-6, -3], [-6, -1], [-6, 1], [-6, 3], [6, 3], [6, 1], [6, -1], [6, -3]], bodyBbox: [-4, -4, 4, 4], bbox: [-6, -4, 6, 4], refdesAnchor: [0, -5.3333], valueAnchor: [0, 5.3333] },
  ic_block_9: { pins: [[-6, -4], [-6, -2], [-6, 0], [-6, 2], [-6, 4], [6, 2], [6, 0], [6, -2], [6, -4]], bodyBbox: [-4, -5, 4, 5], bbox: [-6, -5, 6, 5], refdesAnchor: [0, -6.3333], valueAnchor: [0, 6.3333] },
  ic_block_14: { pins: [[-6, -6], [-6, -4], [-6, -2], [-6, 0], [-6, 2], [-6, 4], [-6, 6], [6, 6], [6, 4], [6, 2], [6, 0], [6, -2], [6, -4], [6, -6]], bodyBbox: [-4, -7, 4, 7], bbox: [-6, -7, 6, 7], refdesAnchor: [0, -8.3333], valueAnchor: [0, 8.3333] },
  ic_block_16: { pins: [[-6, -7], [-6, -5], [-6, -3], [-6, -1], [-6, 1], [-6, 3], [-6, 5], [-6, 7], [6, 7], [6, 5], [6, 3], [6, 1], [6, -1], [6, -3], [6, -5], [6, -7]], bodyBbox: [-4, -8, 4, 8], bbox: [-6, -8, 6, 8], refdesAnchor: [0, -9.3333], valueAnchor: [0, 9.3333] },
} as const satisfies Record<ComponentType, SymbolGolden>;

const PIN_LABEL_TYPES = new Set<ComponentType>([
  "timer_555", "vreg_linear_3", "comparator", "jfet_n", "optocoupler_led",
  "ic_block_2", "ic_block_3", "ic_block_4", "ic_block_5", "ic_block_6",
  "ic_block_8", "ic_block_9", "ic_block_14", "ic_block_16",
]);

const numberPattern = "-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
const pinLeadPattern = new RegExp(`<path class="pin-lead" d="M(${numberPattern}) (${numberPattern}) L(${numberPattern}) (${numberPattern})"\\/>`, "g");

function pinLeads(markup: string): { inner: Point; outer: Point }[] {
  return [...markup.matchAll(pinLeadPattern)].map((match) => ({
    inner: [Number(match[1]), Number(match[2])],
    outer: [Number(match[3]), Number(match[4])],
  }));
}

function clean(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function orient([inputX, inputY]: readonly [number, number], rotation: Rotation, mirror: boolean, position: Point = [0, 0]): Point {
  const x = mirror ? -inputX : inputX;
  let offset: Point;
  switch (rotation) {
    case 0: offset = [x, inputY]; break;
    case 90: offset = [-inputY, x]; break;
    case 180: offset = [-x, -inputY]; break;
    case 270: offset = [inputY, -x]; break;
  }
  return [clean(position[0] + offset[0]), clean(position[1] + offset[1])];
}

function orientedBbox(bbox: readonly [number, number, number, number], rotation: Rotation, mirror: boolean): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = bbox;
  const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]] as const;
  const points = corners.map((point) => orient(point, rotation, mirror));
  return [
    Math.min(...points.map(([x]) => x)),
    Math.min(...points.map(([, y]) => y)),
    Math.max(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)),
  ].map(clean) as [number, number, number, number];
}

function expandedBbox(bbox: readonly [number, number, number, number], amount: number): [number, number, number, number] {
  return [bbox[0] - amount, bbox[1] - amount, bbox[2] + amount, bbox[3] + amount];
}

function pathVertices(markup: string): Point[] {
  const pointPattern = new RegExp(`[ML](${numberPattern}) (${numberPattern})`, "g");
  return [...markup.matchAll(pointPattern)].map((match) => [Number(match[1]), Number(match[2])]);
}

function rotateAround([x, y]: Point, [pivotX, pivotY]: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180;
  const offsetX = x - pivotX;
  const offsetY = y - pivotY;
  return [
    pivotX + offsetX * Math.cos(radians) - offsetY * Math.sin(radians),
    pivotY + offsetX * Math.sin(radians) + offsetY * Math.cos(radians),
  ];
}

function countClass(markup: string, className: string): number {
  return [...markup.matchAll(/class="([^"]+)"/g)]
    .filter((match) => match[1]?.split(/\s+/).includes(className))
    .length;
}

describe("generated KiCad editor symbols", () => {
  for (const part of PARTS) {
    it(`${part.type} matches the editor contract`, () => {
      const symbol = EDITOR_SYMBOLS[part.type];
      expect(symbol.type).toBe(part.type);
      expect(symbol.pins).toEqual(part.pins);
      expect(symbol.refdesAnchor.every(Number.isFinite)).toBe(true);
      expect(symbol.valueAnchor.every(Number.isFinite)).toBe(true);

      const [bodyMinX, bodyMinY, bodyMaxX, bodyMaxY] = symbol.bodyBbox;
      const [minX, minY, maxX, maxY] = symbol.bbox;
      expect(symbol.bodyBbox.every(Number.isFinite)).toBe(true);
      expect(bodyMaxX).toBeGreaterThan(bodyMinX);
      expect(bodyMaxY).toBeGreaterThan(bodyMinY);
      expect(bodyMinX).toBeGreaterThanOrEqual(minX);
      expect(bodyMinY).toBeGreaterThanOrEqual(minY);
      expect(bodyMaxX).toBeLessThanOrEqual(maxX);
      expect(bodyMaxY).toBeLessThanOrEqual(maxY);
      expect(symbol.bbox.every(Number.isFinite)).toBe(true);
      expect(maxX).toBeGreaterThan(minX);
      expect(maxY).toBeGreaterThan(minY);
      for (const [x, y] of symbol.pins) {
        expect(x).toBeGreaterThanOrEqual(minX);
        expect(x).toBeLessThanOrEqual(maxX);
        expect(y).toBeGreaterThanOrEqual(minY);
        expect(y).toBeLessThanOrEqual(maxY);
      }

      expect(symbol.markup.length).toBeGreaterThan(0);
      const allMarkup = [symbol.markup, symbol.wiper, symbol.lever].filter((value): value is string => value !== undefined).join("");
      expect(allMarkup).not.toMatch(/\b(?:stroke|fill|style)=/);
      if (PIN_LABEL_TYPES.has(part.type)) {
        expect(allMarkup.match(/<text\b/g)).toHaveLength(part.pins.length);
        expect(allMarkup.match(/data-pin-label-index="\d+"/g)).toHaveLength(part.pins.length);
      } else expect(allMarkup).not.toMatch(/<text\b/i);
      for (const classAttribute of allMarkup.matchAll(/class="([^"]+)"/g)) {
        for (const className of classAttribute[1]!.split(/\s+/)) {
          expect(["sym-bg", "sym-solid", "sym-bold", "pin-lead", "sym-pin-label"]).toContain(className);
        }
      }
    });
  }

  it("uses actual placed-package pin names while keeping palette markup label-free", () => {
    const component: CircuitComponent = { id: "u1", type: "timer_555", pos: [10, 20], rot: 90, mirror: true };
    const names = ["PWR−", "TRIGGER", "OUTPUT", "RESET", "CONTROL", "THRESHOLD", "DISCHARGE", "PWR+"];
    const placed = componentSymbolMarkup(component, names);
    expect(placed.match(/class="editor-label sym-pin-label"/g)).toHaveLength(8);
    for (const name of names) expect(placed).toContain(name);
    expect(placed).toContain("scale(-1 1) rotate(-90)");
    expect(partSymbolMarkup("timer_555")).not.toMatch(/<text\b/);
    expect(partSymbolMarkup("ic_block_16")).not.toMatch(/<text\b/);
  });

  describe("pin endpoint, outward lead, property anchor, bbox, and hitbox transform matrix", () => {
    for (const part of PARTS) {
      for (const rotation of rotations) {
        for (const mirror of mirrors) {
          it(`${part.type} rot=${rotation} mirror=${mirror}`, () => {
            const symbol = EDITOR_SYMBOLS[part.type];
            const golden = GOLDENS[part.type];
            const leads = pinLeads(symbol.markup);
            expect(symbol.pins).toEqual(golden.pins);
            expect(symbol.bodyBbox).toEqual(golden.bodyBbox);
            expect(symbol.bbox).toEqual(golden.bbox);
            expect(symbol.refdesAnchor).toEqual(golden.refdesAnchor);
            expect(symbol.valueAnchor).toEqual(golden.valueAnchor);
            expect(leads).toHaveLength(golden.pins.length);
            expect(leads.map(({ outer }) => outer)).toEqual(golden.pins);

            const position: Point = [17, -11];
            const component: CircuitComponent = { id: "audit", type: part.type, pos: position, rot: rotation, mirror };
            const expectedPins = golden.pins.map((point) => orient(point, rotation, mirror, position));
            expect(componentPinPoints(component)).toEqual(expectedPins);
            expect(leads.map(({ outer }) => orient(outer, rotation, mirror, position))).toEqual(expectedPins);
            expect([
              orient(symbol.refdesAnchor, rotation, mirror, position),
              orient(symbol.valueAnchor, rotation, mirror, position),
            ]).toEqual([
              orient(golden.refdesAnchor, rotation, mirror, position),
              orient(golden.valueAnchor, rotation, mirror, position),
            ]);

            for (const { inner, outer } of leads) {
              const worldInner = orient(inner, rotation, mirror, position);
              const worldOuter = orient(outer, rotation, mirror, position);
              const vector = [worldOuter[0] - worldInner[0], worldOuter[1] - worldInner[1]] as const;
              if (part.type === "ground") {
                expect(Math.hypot(...vector)).toBeLessThanOrEqual(1e-8);
                continue;
              }
              expect(Math.hypot(...vector)).toBeGreaterThan(1e-8);
              const radial = [worldOuter[0] - position[0], worldOuter[1] - position[1]] as const;
              expect(vector[0] * radial[0] + vector[1] * radial[1]).toBeGreaterThan(0);
            }

            const expectedBounds = orientedBbox(golden.bbox, rotation, mirror);
            const expectedBodyBounds = orientedBbox(golden.bodyBbox, rotation, mirror);
            expect(orientedBbox(symbol.bodyBbox, rotation, mirror)).toEqual(expectedBodyBounds);
            expect(orientedBbox(symbol.bbox, rotation, mirror)).toEqual(expectedBounds);
            expect(expectedBodyBounds[0]).toBeGreaterThanOrEqual(expectedBounds[0]);
            expect(expectedBodyBounds[1]).toBeGreaterThanOrEqual(expectedBounds[1]);
            expect(expectedBodyBounds[2]).toBeLessThanOrEqual(expectedBounds[2]);
            expect(expectedBodyBounds[3]).toBeLessThanOrEqual(expectedBounds[3]);
            const hitbox = orientedBbox(expandedBbox(symbol.bbox, 0.5), rotation, mirror);
            expect(hitbox[0]).toBeLessThan(expectedBounds[0]);
            expect(hitbox[1]).toBeLessThan(expectedBounds[1]);
            expect(hitbox[2]).toBeGreaterThan(expectedBounds[2]);
            expect(hitbox[3]).toBeGreaterThan(expectedBounds[3]);
            for (const point of golden.pins.map((pin) => orient(pin, rotation, mirror))) {
              expect(point[0]).toBeGreaterThanOrEqual(hitbox[0]);
              expect(point[0]).toBeLessThanOrEqual(hitbox[2]);
              expect(point[1]).toBeGreaterThanOrEqual(hitbox[1]);
              expect(point[1]).toBeLessThanOrEqual(hitbox[3]);
            }
          });
        }
      }
    }
  });

  it("keeps capacitor body bounds on the plates and excludes both pin leads", () => {
    expect(EDITOR_SYMBOLS.capacitor.bodyBbox).toEqual([-0.4, -1.0667, 0.4, 1.0667]);
    expect(EDITOR_SYMBOLS.capacitor.bbox).toEqual([-2, -1.0667, 2, 1.0667]);
  });

  it("keeps the potentiometer terminal static and isolates full-travel internal wiper artwork", () => {
    expect(EDITOR_SYMBOLS.potentiometer.wiper).toBeTruthy();
    expect(countClass(EDITOR_SYMBOLS.potentiometer.markup, "pin-lead")).toBe(3);
    expect(countClass(EDITOR_SYMBOLS.potentiometer.wiper!, "pin-lead")).toBe(0);
    expect(EDITOR_SYMBOLS.potentiometer.wiperAnchor).toEqual([1.3333, 0]);
    expect(EDITOR_SYMBOLS.potentiometer.wiperTravel).toEqual([-2, 2]);
    const externalTerminal = pinLeads(EDITOR_SYMBOLS.potentiometer.markup)[1]!;
    expect(externalTerminal).toEqual({ inner: [1.3333, 0], outer: [2, 0] });
    const [minX, minY, maxX, maxY] = EDITOR_SYMBOLS.potentiometer.bbox;
    for (const translation of EDITOR_SYMBOLS.potentiometer.wiperTravel!) {
      expect(externalTerminal.outer).toEqual([2, 0]);
      expect({
        fixed: EDITOR_SYMBOLS.potentiometer.wiperAnchor,
        moving: [EDITOR_SYMBOLS.potentiometer.wiperAnchor![0], EDITOR_SYMBOLS.potentiometer.wiperAnchor![1] + translation],
      }).toEqual({ fixed: [1.3333, 0], moving: [1.3333, translation] });
      for (const [x, y] of pathVertices(EDITOR_SYMBOLS.potentiometer.wiper!)) {
        expect(x).toBeGreaterThanOrEqual(minX);
        expect(x).toBeLessThanOrEqual(maxX);
        expect(y + translation).toBeGreaterThanOrEqual(minY);
        expect(y + translation).toBeLessThanOrEqual(maxY);
      }
    }
  });

  it("preserves anisotropic KiCad circles as ellipses", () => {
    expect(EDITOR_SYMBOLS.bjt_npn.markup).toContain('<ellipse cx="1.3333" cy="0" rx="1.48" ry="1.665"/>');
    expect(EDITOR_SYMBOLS.bjt_pnp.markup).toContain('<ellipse cx="1.3333" cy="0" rx="1.48" ry="1.665"/>');
    expect(EDITOR_SYMBOLS.nmos.markup).toContain('<ellipse cx="1.5333" cy="0" rx="1.4667" ry="1.65"/>');
    expect(EDITOR_SYMBOLS.pmos.markup).toContain('<ellipse cx="1.5333" cy="0" rx="1.4667" ry="1.65"/>');
    for (const type of ["bjt_npn", "bjt_pnp", "nmos", "pmos"] as const) {
      expect(EDITOR_SYMBOLS[type].markup).not.toMatch(/<circle(?:\s|>)/);
    }
  });

  it("keeps sufficient arc precision for rendered bounds to match KiCad geometry", () => {
    expect(EDITOR_SYMBOLS.inductor.markup).toContain("A0.333336 0.333336");
    expect(EDITOR_SYMBOLS.inductor.bbox).toEqual([-2, -0.3319, 2, 0]);
  });

  it("isolates the open switch lever and pivot", () => {
    expect(EDITOR_SYMBOLS.switch_spst.lever).toBeTruthy();
    expect(EDITOR_SYMBOLS.switch_spst.leverPivot).toEqual([-0.8, 0]);
    const closedAngle = Math.atan2(0.7, 1.4) * 180 / Math.PI;
    const [minX, minY, maxX, maxY] = EDITOR_SYMBOLS.switch_spst.bbox;
    for (const point of pathVertices(EDITOR_SYMBOLS.switch_spst.lever!).map((vertex) => rotateAround(vertex, EDITOR_SYMBOLS.switch_spst.leverPivot!, closedAngle))) {
      expect(point[0]).toBeGreaterThanOrEqual(minX);
      expect(point[0]).toBeLessThanOrEqual(maxX);
      expect(point[1]).toBeGreaterThanOrEqual(minY);
      expect(point[1]).toBeLessThanOrEqual(maxY);
    }
  });

  it("keeps the two LED emission arrows", () => {
    expect(EDITOR_SYMBOLS.led.markup).toContain("M0.4 1.6");
    expect(EDITOR_SYMBOLS.led.markup).toContain("M0.4 0.9333");
  });

  it("drops opamp rail pins and keeps exactly three electrical leads", () => {
    expect(countClass(EDITOR_SYMBOLS.opamp_ideal.markup, "pin-lead")).toBe(3);
  });

  it("regenerates byte-identically", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "opencircuit-symbols-"));
    const outputPath = join(outputDir, "symbols.generated.ts");
    execFileSync(process.execPath, [join(packageRoot, "scripts", "generate-symbols.mjs"), "--output", outputPath], {
      cwd: packageRoot,
      stdio: "pipe",
    });
    expect(readFileSync(outputPath)).toEqual(readFileSync(join(packageRoot, "src", "symbols.generated.ts")));
  });
});
