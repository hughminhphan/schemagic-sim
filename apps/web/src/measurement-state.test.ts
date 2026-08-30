import { describe, expect, it } from "vitest";
import { serializeSignalExpression, type SerializedSignalExpression, type SignalDefinition, type SignalSeries } from "@opencircuit/signal-workbench";
import {
  createInstrumentAnalysisSnapshot,
  createInitialMeasurementWorkbenchState,
  normalizeMeasurementWorkbenchState,
  synchronizeMeasurementWorkbenchCircuit,
} from "./measurement-state";
import {
  createWorkbenchMeasurementDefinition,
  groupResolvedSeriesByDefinition,
  validateWorkbenchVI,
  workbenchMeasurementParameterSummary,
  workbenchSignalDisplayLabel,
  WORKBENCH_MEASUREMENT_KINDS,
} from "./measurement-workbench";

describe("measurement workbench state", () => {
  it("preserves every stepped-DC segment under one stable signal definition", () => {
    const definition: SignalDefinition = {
      id: "wire:w1",
      label: "Output",
      expression: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w1" }, negative: { kind: "runtime-node", name: "0" } },
      quantity: "voltage",
      unit: "V",
      polarity: "signed",
    };
    const makeSeries = (segment: number | undefined, value: number): SignalSeries => ({
      definition,
      runKey: "run-key",
      axis: { id: "sweep", quantity: "dimensionless", unit: "1", values: new Float64Array([0, 1]) },
      signal: {
        kind: "real",
        unit: "V",
        dimension: { voltage: 1, current: 0, time: 0 },
        length: 2,
        values: new Float64Array([value, value + 1]),
        canonicalExpression: "V(wire:w1,0)",
      },
      ...(segment === undefined ? {} : { segment }),
    });

    const grouped = groupResolvedSeriesByDefinition([
      makeSeries(2, 2),
      makeSeries(0, 0),
      makeSeries(3, 3),
      makeSeries(1, 1),
    ]);
    expect(grouped.get(definition.id)?.map((series) => series.segment)).toEqual([0, 1, 2, 3]);
    expect(grouped.get(definition.id)?.map((series) => series.signal.values[0])).toEqual([0, 1, 2, 3]);

    const single = makeSeries(undefined, 9);
    expect(groupResolvedSeriesByDefinition([single]).get(definition.id)).toEqual([single]);
    const override = makeSeries(undefined, 11);
    expect(groupResolvedSeriesByDefinition(grouped.get(definition.id)!, new Map([[definition.id, override]])).get(definition.id)).toEqual([override]);
  });

  it("keeps complete signal definitions in serialized traces", () => {
    const state = createInitialMeasurementWorkbenchState();
    state.profiles[0]!.traces.push({
      definition: {
        id: "wire:w1",
        label: "Output",
        expression: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w1" }, negative: { kind: "runtime-node", name: "0" } },
        quantity: "voltage",
        unit: "V",
        polarity: "signed",
      },
      visible: true,
      color: "#3FD983",
      axisGroup: "voltage",
      yScale: "linear",
      comparisonRole: "current",
    });
    state.profiles[0]!.viewer.cursors = { a: { x: 0.25 }, b: { x: 0.75, y: 1.5, traceId: "current:wire:w1:0" } };

    const restored = normalizeMeasurementWorkbenchState(JSON.parse(JSON.stringify(state)));
    expect(restored.profiles[0]!.traces[0]!.definition.expression).toEqual(state.profiles[0]!.traces[0]!.definition.expression);
    expect(restored.profiles[0]!.viewer.cursors).toEqual(state.profiles[0]!.viewer.cursors);
  });

  it("retargets exact probe expression copies across active and inactive profiles", () => {
    const oldExpression = {
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId: "w8" },
      negative: { kind: "runtime-node", name: "0" },
    } as const satisfies SerializedSignalExpression;
    const nextExpression = {
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId: "survivor" },
      negative: { kind: "runtime-node", name: "0" },
    } as const satisfies SerializedSignalExpression;
    const stableExpression = { kind: "constant", value: 1, unit: "V" } as const satisfies SerializedSignalExpression;
    const definition: SignalDefinition = {
      id: "p2",
      label: "Output",
      expression: structuredClone(oldExpression),
      quantity: "voltage",
      unit: "V",
      polarity: "signed",
    };
    const state = createInitialMeasurementWorkbenchState();
    const profile = state.profiles[0]!;
    profile.traces = [
      {
        definition,
        visible: true,
        color: "#3FD983",
        axisGroup: "voltage",
        yScale: "linear",
        comparisonRole: "current",
      },
      {
        definition: {
          ...definition,
          id: "derived",
          label: "Derived legacy reference",
          expression: { kind: "unary", operator: "-", operand: structuredClone(oldExpression) },
        },
        visible: true,
        color: "#E8A244",
        axisGroup: "voltage",
        yScale: "linear",
        comparisonRole: "current",
      },
    ];
    profile.measurements = [
      { id: "rms", name: "Output RMS", kind: "rms", expression: structuredClone(oldExpression) },
      {
        id: "delay",
        name: "Output delay",
        kind: "delay",
        expression: stableExpression,
        reference: structuredClone(oldExpression),
        referenceEdge: { threshold: 0, direction: "rising", ordinal: 1 },
        targetEdge: { threshold: 0, direction: "rising", ordinal: 1 },
      },
    ];
    profile.transforms = {
      fft: {
        expression: structuredClone(oldExpression),
        window: { start: 0, stop: 1 },
        samples: 16,
        windowFunction: "hann",
        normalization: "one-sided-amplitude",
      },
      xy: { x: structuredClone(oldExpression), y: stableExpression, alignment: "same-axis" },
      trigger: { expression: structuredClone(oldExpression), mode: "auto", edge: "rising", level: 0, holdoff: 0, pretrigger: 0.5 },
    };
    profile.viewer.plotMode = "xy";
    profile.analysis = {
      mode: "noise",
      ac: {
        fstart: 10,
        fstop: 1_000,
        pointsPerDecade: 10,
        sweep: "dec",
        stimulus: { sourceId: "c9", magnitude: 1, phaseDeg: 0 },
      },
      dcSweep: { sourceId: "c9", start: 0, stop: 1, step: 0.1 },
      noise: { outputProbeId: "p2", inputSourceId: "v1", fstart: 10, fstop: 1_000, pointsPerDecade: 10, sweep: "dec", temperatureC: 27 },
    };
    state.stagedTarget = {
      target: { kind: "wire", wireId: "w8" },
      definition: structuredClone(definition),
      expressionSource: serializeSignalExpression(oldExpression),
      signText: "Voltage sign: + on wire w8; − at ground (node 0).",
    };
    state.expressionSource = serializeSignalExpression(oldExpression);
    state.expressionDiagnostics = [{ code: "STALE", message: "Old draft" }];
    state.selectedTraceId = "p2";
    state.savedCaptureIds = ["capture-before-normalization"];
    state.comparison = { baselineCaptureId: "capture-before-normalization", currentCaptureId: "capture-after-normalization" };
    state.profiles.push({ ...structuredClone(profile), id: "saved-profile", name: "Saved profile" });
    const original = structuredClone(state);

    const reconciled = synchronizeMeasurementWorkbenchCircuit(state, {
      document: {
        components: [{ id: "v1", type: "vsource", value: 1, pos: [0, 0], rot: 0, mirror: false }],
        wires: [{ id: "survivor", points: [[0, 0], [1, 0]] }],
      },
      definitions: [{ ...definition, expression: structuredClone(nextExpression) }],
      previousProbeIds: new Set(),
    });

    expect(state).toEqual(original);
    for (const reconciledProfile of reconciled.profiles) {
      expect(reconciledProfile.traces.map((trace) => trace.definition.id)).toEqual(["p2"]);
      expect(reconciledProfile.traces[0]!.definition.expression).toEqual(nextExpression);
      expect(reconciledProfile.measurements[0]!.expression).toEqual(nextExpression);
      expect(reconciledProfile.measurements[1]).toMatchObject({ reference: nextExpression });
      expect(reconciledProfile.transforms.fft?.expression).toEqual(nextExpression);
      expect(reconciledProfile.transforms.xy?.x).toEqual(nextExpression);
      expect(reconciledProfile.transforms.trigger?.expression).toEqual(nextExpression);
      expect(reconciledProfile.viewer.plotMode).toBe("xy");
      expect(reconciledProfile.analysis?.noise?.outputProbeId).toBe("p2");
    }
    expect(reconciled.stagedTarget).toMatchObject({
      target: { kind: "wire", wireId: "survivor" },
      definition: { expression: nextExpression },
      expressionSource: serializeSignalExpression(nextExpression),
    });
    expect(reconciled.expressionSource).toBe(serializeSignalExpression(nextExpression));
    expect(reconciled.expressionDiagnostics).toEqual([]);
    expect(reconciled.savedCaptureIds).toEqual(["capture-before-normalization"]);
    expect(reconciled.comparison).toEqual({ baselineCaptureId: "capture-before-normalization", currentCaptureId: "capture-after-normalization" });
  });

  it("invalidates live workbook state that still names deleted schematic objects", () => {
    const deletedWire = {
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId: "deleted-wire" },
      negative: { kind: "runtime-node", name: "0" },
    } as const satisfies SerializedSignalExpression;
    const stable = { kind: "constant", value: 0, unit: "V" } as const satisfies SerializedSignalExpression;
    const state = createInitialMeasurementWorkbenchState();
    const profile = state.profiles[0]!;
    const trace = (definition: SignalDefinition) => ({
      definition,
      visible: true,
      color: "#3FD983",
      axisGroup: definition.quantity,
      yScale: "linear" as const,
      comparisonRole: "current" as const,
    });
    profile.traces = [
      trace({ id: "p2", label: "Deleted wire", expression: deletedWire, quantity: "voltage", unit: "V", polarity: "signed" }),
      trace({
        id: "deleted-device",
        label: "Deleted device current",
        expression: { kind: "current", component: { kind: "schematic-component", componentId: "c9" } },
        quantity: "current",
        unit: "A",
        polarity: "signed",
      }),
      trace({ id: "stable", label: "Stable", expression: stable, quantity: "voltage", unit: "V", polarity: "signed" }),
    ];
    profile.measurements = [
      { id: "invalid", name: "Invalid", kind: "rms", expression: deletedWire },
      { id: "stable-measurement", name: "Stable", kind: "average", expression: stable },
    ];
    profile.transforms = {
      fft: { expression: deletedWire, window: { start: 0, stop: 1 }, samples: 16, windowFunction: "hann", normalization: "one-sided-amplitude" },
      xy: { x: deletedWire, y: stable },
      trigger: { expression: deletedWire, mode: "normal", edge: "rising", level: 0, holdoff: 0, pretrigger: 0.5 },
    };
    profile.viewer.plotMode = "spectrum";
    profile.analysis = {
      mode: "noise",
      noise: { outputProbeId: "p2", inputSourceId: "v1", fstart: 10, fstop: 1_000, pointsPerDecade: 10, sweep: "dec", temperatureC: 27 },
    };
    profile.viewer.cursors = {
      a: { x: 0.25, traceId: "current:p2:0" },
      b: { x: 0.75, traceId: "current:stable:0" },
    };
    state.selectedTraceId = "p2";
    state.stagedTarget = {
      target: { kind: "wire", wireId: "deleted-wire" },
      definition: profile.traces[0]!.definition,
      expressionSource: serializeSignalExpression(deletedWire),
      signText: "Deleted wire",
    };
    state.expressionSource = serializeSignalExpression(deletedWire);
    state.profiles.push({ ...structuredClone(profile), id: "inactive", name: "Inactive profile" });

    const reconciled = synchronizeMeasurementWorkbenchCircuit(state, {
      document: { components: [], wires: [] },
      definitions: [],
      previousProbeIds: new Set(["p2"]),
    });

    for (const reconciledProfile of reconciled.profiles) {
      expect(reconciledProfile.traces.map((item) => item.definition.id)).toEqual(["stable"]);
      expect(reconciledProfile.measurements.map((measurement) => measurement.id)).toEqual(["stable-measurement"]);
      expect(reconciledProfile.transforms).toEqual({});
      expect(reconciledProfile.viewer.plotMode).toBe("time");
      expect(reconciledProfile.analysis?.noise).toBeUndefined();
      expect(reconciledProfile.analysis?.mode).toBe("op");
      expect(reconciledProfile.analysis?.dcSweep).toBeUndefined();
      expect(reconciledProfile.analysis?.ac?.stimulus).toBeUndefined();
      expect(reconciledProfile.viewer.cursors.a).toEqual({ x: 0.25 });
      expect(reconciledProfile.viewer.cursors.b).toEqual({ x: 0.75, traceId: "current:stable:0" });
    }
    expect(reconciled.selectedTraceId).toBe("stable");
    expect(reconciled.stagedTarget).toBeUndefined();
    expect(reconciled.expressionSource).toBe("");
  });

  it("invalidates a parseable draft that names a deleted schematic object without a staged target", () => {
    const state = createInitialMeasurementWorkbenchState();
    state.expressionSource = "V(wire:gone)";

    const reconciled = synchronizeMeasurementWorkbenchCircuit(state, {
      document: { components: [], wires: [] },
      definitions: [],
      previousProbeIds: new Set(),
    });

    expect(reconciled.expressionSource).toBe("");
    expect(reconciled.expressionDiagnostics).toEqual([{
      code: "STALE_REFERENCE",
      message: "The drafted signal referenced a schematic object removed by the last edit.",
    }]);
  });

  it("presents named nets without changing the stable wire expression", () => {
    const definition = {
      id: "p1",
      label: "V(wire:w1, 0)",
      expression: {
        kind: "voltage",
        positive: { kind: "schematic-wire", wireId: "w1" },
        negative: { kind: "runtime-node", name: "0" },
      },
      quantity: "voltage",
      unit: "V",
      polarity: "signed",
    } as const;
    const expression = structuredClone(definition.expression);
    expect(workbenchSignalDisplayLabel(definition, {
      wires: [{ id: "w1", points: [[0, 0], [1, 0]], netLabel: "in" }],
    })).toBe("V(in)");
    expect(definition.expression).toEqual(expression);
    expect(definition.id).toBe("p1");
  });

  it("falls back safely for unknown state versions", () => {
    expect(normalizeMeasurementWorkbenchState({ version: 999 }).profiles[0]!.id).toBe("default");
  });

  it("round-trips an exact per-profile analysis snapshot", () => {
    const sim = {
      mode: "ac",
      tran: { tstop: 0.01, tstep: 5e-6, maxstep: 5e-6 },
      ac: { fstart: 20, fstop: 200_000, pointsPerDecade: 24, sweep: "dec", stimulus: { sourceId: "c1", magnitude: 2, phaseDeg: 45 } },
      noise: { outputProbeId: "p2", inputSourceId: "c1", fstart: 10, fstop: 100_000, pointsPerDecade: 20, sweep: "dec", temperatureC: 42 },
    } as const;
    const state = createInitialMeasurementWorkbenchState();
    state.profiles[0]!.analysis = createInstrumentAnalysisSnapshot(sim);
    const restored = normalizeMeasurementWorkbenchState(JSON.parse(JSON.stringify(state)));
    expect(restored.profiles[0]!.analysis).toEqual(sim);
    expect(restored.profiles[0]!.analysis).not.toBe(sim);
  });

  it("round-trips the selected trigger expression", () => {
    const state = createInitialMeasurementWorkbenchState();
    const source = {
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId: "w2" },
      negative: { kind: "runtime-node", name: "0" },
    } as const;
    state.profiles[0]!.transforms.trigger = {
      expression: source,
      mode: "normal",
      edge: "rising",
      level: 0.5,
      holdoff: 100e-6,
      pretrigger: 0.25,
      windowDuration: 2e-3,
    };
    const restored = normalizeMeasurementWorkbenchState(JSON.parse(JSON.stringify(state)));
    expect(restored.profiles[0]!.transforms.trigger).toEqual(state.profiles[0]!.transforms.trigger);
  });

  it("fails VI closed for runtime-node and cross-device identities", () => {
    const state = createInitialMeasurementWorkbenchState();
    const profile = state.profiles[0]!;
    const voltage = {
      id: "device-voltage",
      label: "V(c2.2,c2.1)",
      expression: {
        kind: "voltage",
        positive: { kind: "schematic-pin", componentId: "c2", pin: 1 },
        negative: { kind: "schematic-pin", componentId: "c2", pin: 0 },
      },
      quantity: "voltage",
      unit: "V",
      polarity: "signed",
    } as const;
    const current = {
      id: "terminal-current",
      label: "I(c2.2)",
      expression: { kind: "current", component: { kind: "schematic-component", componentId: "c2" }, terminal: 1 },
      quantity: "current",
      unit: "A",
      polarity: "signed",
    } as const;
    profile.traces = [voltage, current].map((definition, index) => ({
      definition,
      visible: true,
      color: index ? "#E8A244" : "#3FD983",
      axisGroup: definition.quantity,
      yScale: "linear" as const,
      comparisonRole: "current" as const,
    }));
    profile.transforms.xy = { x: voltage.expression, y: current.expression, alignment: "same-axis" };
    expect(validateWorkbenchVI(profile)).toMatchObject({ valid: true });

    profile.traces[1]!.definition.expression = {
      kind: "current",
      component: { kind: "schematic-component", componentId: "c3" },
      terminal: 1,
    };
    profile.transforms.xy.y = profile.traces[1]!.definition.expression;
    expect(validateWorkbenchVI(profile)).toMatchObject({ valid: false, message: expect.stringContaining("different devices") });

    profile.traces[0]!.definition.expression = {
      kind: "voltage",
      positive: { kind: "runtime-node", name: "out" },
      negative: { kind: "runtime-node", name: "0" },
    };
    profile.transforms.xy.x = profile.traces[0]!.definition.expression;
    expect(validateWorkbenchVI(profile)).toMatchObject({ valid: false, message: expect.stringContaining("Runtime-node") });
  });

  it("exposes the complete named-measurement evaluator contract", () => {
    expect(WORKBENCH_MEASUREMENT_KINDS).toEqual([
      "minimum", "maximum", "peak-to-peak", "average", "rms", "integral", "x-at-level", "frequency", "period",
      "rise-time", "fall-time", "duty", "delay", "overshoot", "settling-time", "phase",
    ]);
  });

  it("creates the editable axis-crossing contract with −3 dB defaults", () => {
    const expression = { kind: "constant", value: -3, unit: "dB" } as const;
    expect(createWorkbenchMeasurementDefinition("corner", "−3 dB corner", "x-at-level", expression)).toEqual({
      id: "corner",
      name: "−3 dB corner",
      kind: "x-at-level",
      expression,
      threshold: -3,
      direction: "falling",
      ordinal: 1,
    });
    expect(createWorkbenchMeasurementDefinition("second", "Second rise", "x-at-level", expression, {
      threshold: 2.5,
      direction: "rising",
      ordinal: 2,
    })).toMatchObject({ threshold: 2.5, direction: "rising", ordinal: 2 });
  });

  it("serializes and restores edited timing, settling, and phase parameters", () => {
    const target = {
      kind: "voltage",
      positive: { kind: "runtime-node", name: "out" },
      negative: { kind: "runtime-node", name: "0" },
    } as const;
    const reference = {
      kind: "voltage",
      positive: { kind: "runtime-node", name: "in" },
      negative: { kind: "runtime-node", name: "0" },
    } as const;
    const rise = createWorkbenchMeasurementDefinition("rise", "Output rise", "rise-time", target, {
      lowThreshold: 0.2,
      highThreshold: 0.8,
      ordinal: 2,
    });
    const settling = createWorkbenchMeasurementDefinition("settle", "Output settling", "settling-time", target, {
      initial: 0.1,
      final: 1.1,
      toleranceKind: "absolute",
      toleranceValue: 0.025,
    });
    const phase = createWorkbenchMeasurementDefinition("phase", "Output phase", "phase", target, {
      reference,
      frequency: 1_592,
      unwrap: true,
    });

    expect(rise).toMatchObject({ lowThreshold: 0.2, highThreshold: 0.8, ordinal: 2 });
    expect(settling).toMatchObject({ initial: 0.1, final: 1.1, tolerance: { kind: "absolute", value: 0.025 } });
    expect(phase).toMatchObject({ reference, frequency: 1_592, unwrap: true });
    expect(workbenchMeasurementParameterSummary(rise)).toBe("0.2→0.8; transition 2");
    expect(workbenchMeasurementParameterSummary(settling)).toBe("0.1→1.1; ±0.025 absolute");
    expect(workbenchMeasurementParameterSummary(phase)).toBe("vs V(in) @ 1592 Hz; unwrapped");

    const state = createInitialMeasurementWorkbenchState();
    state.profiles[0]!.measurements.push(rise, settling, phase);
    const restored = normalizeMeasurementWorkbenchState(JSON.parse(JSON.stringify(state)));
    expect(restored.profiles[0]!.measurements).toEqual([rise, settling, phase]);
  });

  it("maps every advanced parameter editor to the serialized evaluator contract", () => {
    const target = { kind: "constant", value: 1, unit: "V" } as const;
    const reference = { kind: "constant", value: 0, unit: "V" } as const;
    expect(createWorkbenchMeasurementDefinition("frequency", "Frequency", "frequency", target, {
      edge: { threshold: 0.4, direction: "falling", ordinal: 2 },
      lastOrdinal: 5,
    })).toMatchObject({ edge: { threshold: 0.4, direction: "falling", ordinal: 2 }, lastOrdinal: 5 });
    expect(createWorkbenchMeasurementDefinition("duty", "Duty", "duty", target, {
      threshold: 0.6,
      highWhen: "below",
    })).toMatchObject({ threshold: 0.6, highWhen: "below" });
    expect(createWorkbenchMeasurementDefinition("delay", "Delay", "delay", target, {
      reference,
      referenceEdge: { threshold: 0.25, direction: "rising", ordinal: 2 },
      targetEdge: { threshold: 0.75, direction: "falling", ordinal: 3 },
    })).toMatchObject({
      reference,
      referenceEdge: { threshold: 0.25, direction: "rising", ordinal: 2 },
      targetEdge: { threshold: 0.75, direction: "falling", ordinal: 3 },
    });
    expect(createWorkbenchMeasurementDefinition("overshoot", "Overshoot", "overshoot", target, {
      initial: -1,
      final: 2,
    })).toMatchObject({ initial: -1, final: 2 });
  });
});
