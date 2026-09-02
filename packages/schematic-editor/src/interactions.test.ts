import { componentPinPoints, componentPoint, type CircuitComponent, type CircuitDocument, type Point } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import {
  compactDocumentWires,
  componentAnchorFromPointer,
  connectingWireIds,
  createSchematicClipboard,
  implicitPinBridgePlans,
  insertExplicitJunction,
  isFitShortcut,
  isRightButtonDrag,
  junctionPoints,
  panFromPointerDrag,
  pasteSchematicClipboard,
  potentiometerWiperLocalPoint,
  propertyLayout,
  rerouteWireSegment,
  removeReferencesToDeletedSelection,
  rotationDeltaForShortcut,
  rubberBandWire,
  SchematicEditor,
  translateWireSelection,
  translateWirePoints,
  transformComponentSelection,
  trimOverlappingWires,
  wireBlockDelta,
  wireKeyboardMovePlan,
} from "./index";

describe("schematic selection clipboard", () => {
  const baseDocument = (): CircuitDocument => ({
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: "clipboard test" },
    components: [
      { id: "c1", type: "resistor", pos: [2, 0], rot: 0, mirror: false, label: { text: "R1", offset: [0, -3] } },
      { id: "c2", type: "resistor", pos: [10, 0], rot: 0, mirror: false, label: { text: "R3", offset: [0, -3] } },
      { id: "c3", type: "capacitor", pos: [18, 0], rot: 0, mirror: false, label: { text: "C1", offset: [0, -3] } },
      { id: "c4", type: "resistor", pos: [26, 0], rot: 0, mirror: false, label: { text: "R4", offset: [0, -3] } },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
    ] as CircuitComponent[],
    wires: [
      { id: "w1", points: [[4, 0], [8, 0]] },
      { id: "w2", points: [[12, 0], [16, 0]] },
      { id: "w3", points: [[20, 0], [24, 0]] },
    ],
    probes: [],
    sim: { mode: "live", tran: { tstop: 1, tstep: 0.01, maxstep: 0.01 } },
  });

  it("includes wires between selected components but not wires to fixed components", () => {
    const document = baseDocument();
    expect([...connectingWireIds(document, ["c1", "c2", "c3"])]).toEqual(["w1", "w2"]);
    expect(createSchematicClipboard(document, ["c1", "c2", "c3"], []).wires.map((wire) => wire.id)).toEqual(["w1", "w2"]);
  });

  it("assigns the next free reference designator while preserving relative geometry", () => {
    const document = baseDocument();
    const clipboard = createSchematicClipboard(document, ["c1", "c3"], []);
    const pasted = pasteSchematicClipboard(document, clipboard, [30, 20]);

    expect(pasted.components).toEqual(["c5", "c6"]);
    expect(document.components.slice(-2).map((component) => component.label?.text)).toEqual(["R2", "C2"]);
    expect(document.components.slice(-2).map((component) => component.pos)).toEqual([[22, 20], [38, 20]]);
    expect(document.components[0]!.label?.text).toBe("R1");
  });

  it("undoes one paste with one editor history step", () => {
    const document = baseDocument();
    const clipboard = createSchematicClipboard(document, ["c1", "c2", "c3"], []);
    const editor = Object.create(SchematicEditor.prototype) as SchematicEditor & Record<string, unknown>;
    Object.assign(editor, {
      doc: structuredClone(document),
      selectedComponents: new Set<string>(),
      selectedWires: new Set<string>(),
      undoStack: [],
      redoStack: [],
      gestureSnapshot: "",
      pointerWorld: [30, 20],
      render: () => undefined,
      emit: () => undefined,
      emitSelection: () => undefined,
    });

    editor.paste(JSON.stringify(clipboard));
    expect(editor.getDocument().components).toHaveLength(8);
    expect(editor.getDocument().wires).toHaveLength(5);
    expect(editor.canUndo()).toBe(true);

    editor.undo();
    expect(editor.getDocument()).toEqual(document);
    expect(editor.canUndo()).toBe(false);
  });
});

describe("KiCad rotation shortcuts", () => {
  it("maps R counterclockwise and Shift+R clockwise", () => {
    expect(rotationDeltaForShortcut(false)).toBe(-90);
    expect(rotationDeltaForShortcut(true)).toBe(90);
    expect((rotationDeltaForShortcut(false) + 360) % 360).toBe(270);
    expect((rotationDeltaForShortcut(true) + 360) % 360).toBe(90);
  });

  it("uses Home for KiCad fit-to-circuit while retaining F as an alias", () => {
    expect(isFitShortcut("Home")).toBe(true);
    expect(isFitShortcut("f")).toBe(true);
    expect(isFitShortcut("F")).toBe(true);
    expect(isFitShortcut("End")).toBe(false);
  });

  it("rotates a component block around the union-bounds centre in either direction", () => {
    const components = [
      { id: "r1", type: "resistor", pos: [10, 10], rot: 0, mirror: false },
      { id: "r2", type: "resistor", pos: [20, 14], rot: 0, mirror: false },
    ] as CircuitComponent[];

    expect([...transformComponentSelection(components, ["r1", "r2"], { kind: "rotate", delta: -90 })]).toEqual([
      ["r1", { pos: [13, 17], rot: 270, mirror: false }],
      ["r2", { pos: [17, 7], rot: 270, mirror: false }],
    ]);
    expect([...transformComponentSelection(components, ["r1", "r2"], { kind: "rotate", delta: 90 })]).toEqual([
      ["r1", { pos: [17, 7], rot: 90, mirror: false }],
      ["r2", { pos: [13, 17], rot: 90, mirror: false }],
    ]);
    expect(components.map((component) => component.pos)).toEqual([[10, 10], [20, 14]]);
  });

  it.each([0, 90, 180, 270].flatMap((rot) => [false, true].flatMap((mirror) => ["x", "y"].map((axis) => ({ rot, mirror, axis }))))) (
    "applies a world-$axis block mirror to rot=$rot mirror=$mirror",
    ({ rot, mirror, axis }) => {
      const components = [
        { id: "a", type: "resistor", pos: [10, 10], rot, mirror },
        { id: "b", type: "resistor", pos: [20, 14], rot, mirror },
      ] as CircuitComponent[];
      const result = transformComponentSelection(components, ["a", "b"], { kind: "mirror", axis: axis as "x" | "y" });
      const expectedRotation = ((axis === "x" ? -rot : 180 - rot) % 360 + 360) % 360;

      expect(result.get("a")).toEqual({
        pos: axis === "x" ? [20, 10] : [10, 14],
        rot: expectedRotation,
        mirror: !mirror,
      });
      expect(result.get("b")).toEqual({
        pos: axis === "x" ? [10, 14] : [20, 10],
        rot: expectedRotation,
        mirror: !mirror,
      });
      const probe: Point = [1, 2];
      const oldPoint = componentPoint(components[0]!, probe);
      const transformed = { ...components[0]!, ...result.get("a")! } as CircuitComponent;
      const newPoint = componentPoint(transformed, probe);
      expect(newPoint).toEqual(axis === "x" ? [30 - oldPoint[0], oldPoint[1]] : [oldPoint[0], 24 - oldPoint[1]]);
    },
  );

  it("uses asymmetric rendered bounds rather than the average of component anchors", () => {
    const components = [
      { id: "g1", type: "ground", pos: [0, 0], rot: 0, mirror: false },
      { id: "r1", type: "resistor", pos: [10, 0], rot: 0, mirror: false },
    ] as CircuitComponent[];
    const result = transformComponentSelection(components, ["g1", "r1"], { kind: "rotate", delta: 90 });

    expect(result.get("g1")!.pos[0]).toBeCloseTo(6.06665);
    expect(result.get("g1")!.pos[1]).toBeCloseTo(-5.26665);
    expect(result.get("r1")!.pos[0]).toBeCloseTo(6.06665);
    expect(result.get("r1")!.pos[1]).toBeCloseTo(4.73335);
  });

  it("rubber-bands a transformed selected pin while retaining a fixed endpoint", () => {
    const components = [
      { id: "r1", type: "resistor", pos: [10, 10], rot: 0, mirror: false },
      { id: "r2", type: "resistor", pos: [20, 10], rot: 0, mirror: false },
    ] as CircuitComponent[];
    const states = transformComponentSelection(components, ["r1", "r2"], { kind: "rotate", delta: -90 });
    const transformed = { ...components[0]!, ...states.get("r1")! } as CircuitComponent;
    const movedPin = componentPinPoints(transformed)[0]!;

    expect(movedPin).toEqual([15, 17]);
    expect(rubberBandWire([[8, 10], [8, 20], [30, 20]], new Map([[0, movedPin]]), false)).toEqual([
      [15, 17], [15, 20], [30, 20],
    ]);
  });

  it("keeps item-local single-symbol mirrors unchanged and round-trips a block deterministically", () => {
    const single = [{ id: "r1", type: "resistor", pos: [10, 10], rot: 90, mirror: false }] as CircuitComponent[];
    expect(transformComponentSelection(single, ["r1"], { kind: "mirror", axis: "x" }).get("r1"))
      .toEqual({ pos: [10, 10], rot: 90, mirror: true });
    expect(transformComponentSelection(single, ["r1"], { kind: "mirror", axis: "y" }).get("r1"))
      .toEqual({ pos: [10, 10], rot: 270, mirror: true });

    const original = [
      { id: "r1", type: "resistor", pos: [10, 10], rot: 0, mirror: false },
      { id: "r2", type: "resistor", pos: [20, 14], rot: 180, mirror: true },
    ] as CircuitComponent[];
    const first = transformComponentSelection(original, ["r1", "r2"], { kind: "rotate", delta: -90 });
    const transformed = original.map((component) => ({ ...component, ...first.get(component.id)! }));
    const inverse = transformComponentSelection(transformed, ["r1", "r2"], { kind: "rotate", delta: 90 });
    expect(original.map((component) => [component.id, { pos: component.pos, rot: component.rot, mirror: component.mirror }]))
      .toEqual([...inverse]);

    for (const axis of ["x", "y"] as const) {
      const mirrored = transformComponentSelection(original, ["r1", "r2"], { kind: "mirror", axis });
      const once = original.map((component) => ({ ...component, ...mirrored.get(component.id)! }));
      expect([...transformComponentSelection(once, ["r1", "r2"], { kind: "mirror", axis })])
        .toEqual(original.map((component) => [component.id, { pos: component.pos, rot: component.rot, mirror: component.mirror }]));
    }
  });
});

describe("rendered wire junction topology", () => {
  it("marks the common-emitter T-junction where branch endpoints land inside the bus", () => {
    const wires: CircuitDocument["wires"] = [
      { id: "w3", points: [[18, 26], [22, 26], [22, 22], [36, 22]] },
      { id: "w5", points: [[24, 20], [24, 22]] },
      { id: "w6", points: [[24, 24], [24, 22]] },
    ];

    expect(junctionPoints(wires)).toContainEqual([24, 22]);
  });

  it("marks an explicit crossing vertex but not an implicit crossing or a simple bend", () => {
    expect(junctionPoints([
      { id: "horizontal", points: [[0, 2], [2, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 4]] },
    ])).toEqual([[2, 2]]);
    expect(junctionPoints([
      { id: "horizontal", points: [[0, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 4]] },
    ])).toEqual([]);
    expect(junctionPoints([{ id: "bend", points: [[0, 0], [4, 0], [4, 4]] }])).toEqual([]);
  });

  it("turns an implicit orthogonal crossing into shared explicit vertices and a rendered junction", () => {
    const wires: CircuitDocument["wires"] = [
      { id: "horizontal", points: [[0, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 4]] },
    ];
    const explicit = insertExplicitJunction(wires, [2, 2]);

    expect(explicit).toEqual([
      { id: "horizontal", points: [[0, 2], [2, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 2], [2, 4]] },
    ]);
    expect(wires).toEqual([
      { id: "horizontal", points: [[0, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 4]] },
    ]);
    expect(junctionPoints(explicit!)).toEqual([[2, 2]]);

    const expected = structuredClone(explicit!);
    const document = {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "explicit crossing" },
      components: [],
      wires: explicit!,
      probes: [],
      sim: { mode: "live" },
    } as CircuitDocument;
    compactDocumentWires(document);
    expect(document.wires).toEqual(expected);
  });

  it("splits a remaining participant but ignores off-crossing, collinear and already-explicit no-ops", () => {
    const partial: CircuitDocument["wires"] = [
      { id: "horizontal", points: [[0, 2], [2, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 4]] },
    ];
    expect(insertExplicitJunction(partial, [2, 2])).toEqual([
      partial[0],
      { id: "vertical", points: [[2, 0], [2, 2], [2, 4]] },
    ]);
    expect(insertExplicitJunction(partial, [3, 3])).toBeUndefined();
    expect(insertExplicitJunction([
      { id: "left", points: [[0, 2], [4, 2]] },
      { id: "right", points: [[2, 2], [6, 2]] },
    ], [3, 2])).toBeUndefined();
    expect(insertExplicitJunction([
      { id: "horizontal", points: [[0, 2], [2, 2], [4, 2]] },
      { id: "vertical", points: [[2, 0], [2, 2], [2, 4]] },
    ], [2, 2])).toBeUndefined();
  });
});

function documentWith(component: CircuitComponent, points: Point[]): CircuitDocument {
  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: "wire trim test" },
    components: [component],
    wires: [{ id: "w1", points }],
    probes: [],
    sim: { mode: "live", tran: { tstop: 1, tstep: 0.01, maxstep: 0.01 }, ac: { fstart: 1, fstop: 10, pointsPerDecade: 10, sweep: "dec" } },
  };
}

describe("KiCad-style symbol placement wire trimming", () => {
  it.each([0, 90, 180, 270].flatMap((rot) => [false, true].map((mirror) => ({ rot, mirror }))))(
    "opens the covered conductor for a resistor at $rot degrees with mirror=$mirror",
    ({ rot, mirror }) => {
      const component = { id: "c1", type: "resistor", pos: [20, 20], rot, mirror } as CircuitComponent;
      const pins = componentPinPoints(component);
      const horizontal = pins[0]![1] === pins[1]![1];
      const ordered = [...pins].sort((left, right) => horizontal ? left[0] - right[0] : left[1] - right[1]);
      const start: Point = horizontal ? [ordered[0]![0] - 4, ordered[0]![1]] : [ordered[0]![0], ordered[0]![1] - 4];
      const end: Point = horizontal ? [ordered[1]![0] + 4, ordered[1]![1]] : [ordered[1]![0], ordered[1]![1] + 4];
      const document = documentWith(component, [start, end]);

      trimOverlappingWires(document, [component.id]);

      expect(document.wires).toEqual([
        { id: "w1", points: [start, ordered[0]] },
        { id: "w2", points: [ordered[1], end] },
      ]);
    },
  );

  it("preserves bends outside the removed run and leaves unrelated wires intact", () => {
    const component = { id: "c1", type: "resistor", pos: [20, 20], rot: 0, mirror: false } as CircuitComponent;
    const document = documentWith(component, [[10, 12], [10, 20], [30, 20], [30, 28]]);
    document.wires.push({ id: "w7", points: [[0, 0], [8, 0]] });

    trimOverlappingWires(document, [component.id]);

    expect(document.wires).toEqual([
      { id: "w1", points: [[10, 12], [10, 20], [18, 20]] },
      { id: "w8", points: [[22, 20], [30, 20], [30, 28]] },
      { id: "w7", points: [[0, 0], [8, 0]] },
    ]);
  });

  it("does not cut a bus passing through both ideal-opamp inputs", () => {
    const component = { id: "u1", type: "opamp_ideal", pos: [20, 20], rot: 0, mirror: false } as CircuitComponent;
    const document = documentWith(component, [[16, 12], [16, 28]]);

    trimOverlappingWires(document, [component.id]);

    expect(document.wires).toEqual([{ id: "w1", points: [[16, 12], [16, 28]] }]);
  });
});

describe("topology-aware wire compaction", () => {
  it("removes legacy zero-length wires without disturbing coincident-pin connectivity", () => {
    const document = documentWith(
      { id: "g1", type: "ground", pos: [5, 0], rot: 0, mirror: false } as CircuitComponent,
      [[5, 0], [5, 0]],
    );

    compactDocumentWires(document);

    expect(document.wires).toEqual([]);
    expect(componentPinPoints(document.components[0]!)[0]).toEqual([5, 0]);
  });

  it("removes a stale collinear branch anchor after its branch is deleted", () => {
    const document = documentWith(
      { id: "r1", type: "resistor", pos: [30, 30], rot: 0, mirror: false } as CircuitComponent,
      [[0, 0], [5, 0], [10, 0]],
    );
    document.wires.push({ id: "w2", points: [[5, 0], [5, 5]] });

    compactDocumentWires(document);
    expect(document.wires[0]!.points).toEqual([[0, 0], [5, 0], [10, 0]]);

    document.wires = document.wires.filter((wire) => wire.id !== "w2");
    compactDocumentWires(document);
    expect(document.wires[0]!.points).toEqual([[0, 0], [10, 0]]);
    expect(rerouteWireSegment(document.wires[0]!.points, 1, 2)).toEqual([[0, 0], [0, 2], [10, 2], [10, 0]]);
  });

  it("preserves a collinear vertex that is a real component pin", () => {
    const component = { id: "g1", type: "ground", pos: [5, 0], rot: 0, mirror: false } as CircuitComponent;
    const document = documentWith(component, [[0, 0], [5, 0], [10, 0]]);

    compactDocumentWires(document);

    expect(document.wires[0]!.points).toEqual([[0, 0], [5, 0], [10, 0]]);
  });
});

describe("measurement state follows editor deletion", () => {
  it("removes probes and analysis references that target deleted schematic objects", () => {
    const document = documentWith(
      { id: "r1", type: "resistor", pos: [5, 0], rot: 0, mirror: false } as CircuitComponent,
      [[0, 0], [3, 0]],
    );
    document.probes = [
      { id: "wire", expressionVersion: 1, expression: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w1" }, negative: { kind: "runtime-node", name: "0" } } },
      { id: "device", expressionVersion: 1, expression: { kind: "power", component: { kind: "schematic-component", componentId: "r1" } } },
      { id: "runtime", expressionVersion: 1, expression: { kind: "voltage", positive: { kind: "runtime-node", name: "out" }, negative: { kind: "runtime-node", name: "0" } } },
    ];
    document.components.push({ id: "v1", type: "vsource", pos: [0, 4], rot: 0, mirror: false, value: 1 });
    document.sim.ac = { fstart: 1, fstop: 10, pointsPerDecade: 10, sweep: "dec", stimulus: { sourceId: "v1", magnitude: 1, phaseDeg: 0 } };
    document.sim.noise = { outputProbeId: "wire", inputSourceId: "v1", fstart: 1, fstop: 10, pointsPerDecade: 10, sweep: "dec", temperatureC: 27 };

    removeReferencesToDeletedSelection(document, new Set(["r1", "v1"]), new Set(["w1"]));

    expect(document.probes.map((probe) => probe.id)).toEqual(["runtime"]);
    expect(document.sim.ac.stimulus).toBeUndefined();
    expect(document.sim.noise).toBeUndefined();
  });
});

describe("stable component manipulation anchors", () => {
  it("retains an off-centre pointer grab and translates selected wire geometry by the same delta", () => {
    expect(componentAnchorFromPointer([13.25, 9.75], [1.25, -0.25])).toEqual([12, 10]);
    expect(translateWirePoints([[1, 2], [4, 2]], [11, 8])).toEqual([[12, 10], [15, 10]]);
  });

  it("keeps the potentiometer adjustment target on the movable internal wiper", () => {
    const centered = { id: "p1", type: "potentiometer", pos: [0, 0], rot: 0, mirror: false, params: { t: 0.5 } } as CircuitComponent;
    const raised = { ...centered, params: { t: 0.25 } } as CircuitComponent;

    expect(potentiometerWiperLocalPoint(centered)).toEqual([0.95, 0]);
    expect(potentiometerWiperLocalPoint(raised)).toEqual([0.95, 1]);
    expect(potentiometerWiperLocalPoint(centered)[0]).toBeLessThan(componentPinPoints(centered)[1]![0]);
  });
});

describe("implicit coincident-pin drag bridges", () => {
  const document = (wires: CircuitDocument["wires"] = []): CircuitDocument => ({
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: "implicit pin bridge" },
    components: [
      { id: "c1", type: "vsource_pulse", pos: [8, 20], rot: 0, mirror: false, value: 1 },
      { id: "c4", type: "ground", pos: [8, 22], rot: 0, mirror: false },
    ],
    wires,
    probes: [],
    sim: { mode: "live", tran: { tstop: 1, tstep: 0.01, maxstep: 0.01 }, ac: { fstart: 1, fstop: 10, pointsPerDecade: 10, sweep: "dec" } },
  });

  it("plans a bridge when selected and fixed pins share a coordinate without a physical wire", () => {
    expect(implicitPinBridgePlans(document(), new Set(["c4"]))).toEqual([{
      point: [8, 22],
      reference: { componentId: "c4", pinIndex: 0 },
    }]);
    expect(implicitPinBridgePlans(document(), new Set(["c1", "c4"]))).toEqual([]);
  });

  it("reuses the deterministic legacy coincident wire and moves only one endpoint", () => {
    const legacy = document([
      { id: "w10", points: [[8, 22], [8, 22]] },
      { id: "w3", points: [[8, 22], [8, 22]] },
    ]);
    expect(implicitPinBridgePlans(legacy, new Set(["c4"]))).toEqual([{
      point: [8, 22],
      reference: { componentId: "c4", pinIndex: 0 },
      existingWireId: "w3",
    }]);
    expect(rubberBandWire([[8, 22], [8, 22]], new Map([[1, [12, 26]]]), false)).toEqual([
      [8, 22], [8, 26], [12, 26],
    ]);
  });
});

describe("generated KiCad property anchors", () => {
  it("ignores historical screen-side offsets and transforms ref/value sides together", () => {
    const base = {
      id: "m1",
      type: "nmos",
      pos: [20, 20],
      rot: 0,
      mirror: false,
      label: { text: "M1", offset: [-99, 0] },
    } as CircuitComponent;
    const normal = propertyLayout(base, 8);
    const mirrored = propertyLayout({ ...base, mirror: true }, 8);
    const rotated = propertyLayout({ ...base, rot: 90 }, 8);

    expect(normal.refdes.anchor).toBe("start");
    expect(normal.value.anchor).toBe("start");
    expect(normal.value.point[1] - normal.refdes.point[1]).toBeCloseTo(14 / 8);
    expect(mirrored.refdes.anchor).toBe("end");
    expect(mirrored.value.anchor).toBe("end");
    expect(rotated.refdes.anchor).toBe("middle");
    expect(rotated.value.anchor).toBe("middle");
    expect(rotated.value.point[1]).toBeGreaterThan(rotated.refdes.point[1]);
  });

  it.each([4, 8, 16])("keeps capacitor side, gap and along offsets screen-stable at screenScale=%s", (screenScale) => {
    for (const rot of [0, 90, 180, 270] as const) {
      for (const mirror of [false, true]) {
        const component = {
          id: "c1",
          type: "capacitor",
          pos: [30, 40],
          rot,
          mirror,
          label: { text: "C1", offset: [99, 99] },
          value: "100n",
        } as CircuitComponent;
        const layout = propertyLayout(component, screenScale);
        const pins = componentPinPoints(component);
        const horizontalPinAxis = pins[0]![1] === pins[1]![1];
        const expectedSign = rot === 0 || rot === 270 ? -1 : 1;

        if (horizontalPinAxis) {
          expect(Math.sign(layout.refdes.point[1] - component.pos[1])).toBe(expectedSign);
          expect(Math.sign(layout.value.point[1] - component.pos[1])).toBe(expectedSign);
          expect(layout.value.point[1]).toBeCloseTo(layout.refdes.point[1]);
          expect((Math.abs(layout.refdes.point[1] - component.pos[1]) - 1.0667) * screenScale).toBeCloseTo(10);
          expect((Math.abs(layout.value.point[1] - component.pos[1]) - 1.0667) * screenScale).toBeCloseTo(10);
          const referenceHorizontalSign = rot === 0 ? (mirror ? 1 : -1) : (mirror ? -1 : 1);
          expect(Math.sign(layout.refdes.point[0] - component.pos[0])).toBe(referenceHorizontalSign);
          expect(Math.sign(layout.value.point[0] - component.pos[0])).toBe(-referenceHorizontalSign);
          expect(Math.abs(layout.refdes.point[0] - component.pos[0]) * screenScale).toBeCloseTo(3);
          expect(Math.abs(layout.value.point[0] - component.pos[0]) * screenScale).toBeCloseTo(3);
        } else {
          expect(Math.sign(layout.refdes.point[0] - component.pos[0])).toBe(expectedSign);
          expect(Math.sign(layout.value.point[0] - component.pos[0])).toBe(expectedSign);
          expect(layout.value.point[0]).toBeCloseTo(layout.refdes.point[0]);
          expect((Math.abs(layout.refdes.point[0] - component.pos[0]) - 1.0667) * screenScale).toBeCloseTo(3);
          expect((Math.abs(layout.value.point[0] - component.pos[0]) - 1.0667) * screenScale).toBeCloseTo(3);
          const referenceVerticalSign = rot === 90 ? (mirror ? 1 : -1) : (mirror ? -1 : 1);
          expect(Math.sign(layout.refdes.point[1] - component.pos[1])).toBe(referenceVerticalSign);
          expect(Math.sign(layout.value.point[1] - component.pos[1])).toBe(-referenceVerticalSign);
          expect(Math.abs(layout.refdes.point[1] - component.pos[1]) * screenScale).toBeCloseTo(10);
          expect(Math.abs(layout.value.point[1] - component.pos[1]) * screenScale).toBeCloseTo(10);
        }
      }
    }
  });

  it("places the RC demo capacitor labels beside its body instead of on the vertical wire", () => {
    const component = {
      id: "c3",
      type: "capacitor",
      pos: [26, 20],
      rot: 90,
      mirror: false,
      label: { text: "C1", offset: [4, 0] },
      value: "100n",
    } as CircuitComponent;

    const layout = propertyLayout(component, 8);
    expect(layout.refdes.anchor).toBe("start");
    expect(layout.value.anchor).toBe("start");
    expect(layout.refdes.point[0]).toBeCloseTo(27.4417);
    expect(layout.refdes.point[1]).toBeCloseTo(18.75);
    expect(layout.value.point[0]).toBeCloseTo(27.4417);
    expect(layout.value.point[1]).toBeCloseTo(21.25);
    expect(layout.refdes.point[0]).toBeGreaterThan(component.pos[0]);
    expect(layout.value.point[0]).toBeGreaterThan(component.pos[0]);
  });
});

describe("KiCad-style wire segment rerouting", () => {
  it("moves an interior horizontal segment while retaining its orthogonal neighbours", () => {
    expect(rerouteWireSegment([[8, 8], [12, 8], [12, 16], [20, 16], [20, 24]], 3, 19)).toEqual([
      [8, 8], [12, 8], [12, 19], [20, 19], [20, 24],
    ]);
  });

  it("adds endpoint doglegs instead of detaching a moved first segment", () => {
    expect(rerouteWireSegment([[8, 8], [16, 8], [16, 20]], 1, 11)).toEqual([
      [8, 8], [8, 11], [16, 11], [16, 20],
    ]);
  });

  it("supports off-grid vertical coordinates without disturbing fixed endpoints", () => {
    expect(rerouteWireSegment([[8, 8], [8, 20]], 1, 10.375)).toEqual([
      [8, 8], [10.375, 8], [10.375, 20], [8, 20],
    ]);
  });

  it("keeps collinear junction split-points connected with doglegs", () => {
    expect(rerouteWireSegment([[8, 22], [8, 11], [18, 11], [58, 11]], 3, 13)).toEqual([
      [8, 22], [8, 11], [18, 11], [18, 13], [58, 13], [58, 11],
    ]);
  });
});

describe("wire-only block translation", () => {
  it("snaps the gesture delta without jumping from an off-centre grab", () => {
    expect(wireBlockDelta([29.4, 25.4], [25, 22])).toEqual([4, 3]);
    expect(wireBlockDelta([29.4, 25.4], [25, 22], true)).toEqual([4.4, 3.4]);
    expect(wireBlockDelta([20.2, 18.8], [25, 22])).toEqual([-5, -3]);
  });

  it("translates every selected wire from immutable gesture origins", () => {
    const originals = new Map<string, Point[]>([
      ["w5", [[20, 22], [30, 22]]],
      ["w6", [[34, 22], [42, 22]]],
    ]);

    expect([...translateWireSelection(originals, [4, 3])]).toEqual([
      ["w5", [[24, 25], [34, 25]]],
      ["w6", [[38, 25], [46, 25]]],
    ]);
    expect(originals.get("w5")).toEqual([[20, 22], [30, 22]]);
    expect([...translateWireSelection(originals, [0, 0])]).toEqual([...originals]);
  });

  it("plans M as whole-block translation and G as nearest selected-segment reroute", () => {
    const wires: CircuitDocument["wires"] = [
      { id: "w1", points: [[0, 0], [8, 0]] },
      { id: "w2", points: [[0, 8], [8, 8]] },
      { id: "w3", points: [[20, 20], [24, 20]] },
    ];

    expect(wireKeyboardMovePlan("move", wires, ["w1"], [7, 7])).toEqual({ wireId: "w1", block: true });
    expect(wireKeyboardMovePlan("move", wires, ["w1", "w2"], [7, 7])).toEqual({ wireId: "w1", block: true });
    expect(wireKeyboardMovePlan("drag", wires, ["w1", "w2"], [7, 7.5])).toEqual({ wireId: "w2", block: false });
    expect(wireKeyboardMovePlan("drag", wires, ["w1", "w2"], [4, 4])).toEqual({ wireId: "w1", block: false });
    expect(wireKeyboardMovePlan("drag", wires, ["w3"], [0, 0])).toEqual({ wireId: "w3", block: false });
    expect(wireKeyboardMovePlan("move", wires, ["missing"], [0, 0])).toBeUndefined();
  });
});

describe("pointer pan geometry and right-button disambiguation", () => {
  it("keeps click jitter below the drag threshold and accepts a deliberate drag", () => {
    expect(isRightButtonDrag([100, 100], [103, 102])).toBe(false);
    expect(isRightButtonDrag([100, 100], [104, 100])).toBe(true);
    expect(isRightButtonDrag([100, 100], [96, 100])).toBe(true);
  });

  it("derives pan from immutable screen and view origins", () => {
    const origin: Point = [5, -7];
    const start: Point = [100, 50];

    expect(panFromPointerDrag(origin, start, [132, 28])).toEqual([37, -29]);
    expect(origin).toEqual([5, -7]);
    expect(start).toEqual([100, 50]);
  });
});
