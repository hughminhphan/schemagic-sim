import { parseElectricalDesignRequestV2 } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  buildOperatingPlots,
  renderOperatingPlots,
  type OperatingPlotCandidateContext,
  type OperatingPlotRequest,
} from "./OperatingPlots";

const candidate = {
  recipeId: "fixture.operating-plots",
  simulationCoverage: [
    { scenarioId: "behavioral-op", modelTier: "behavioral", limitations: ["Behavioral structure only"] },
    { scenarioId: "selected-part", modelTier: "unavailable", limitations: ["No selected-part model"] },
  ],
} satisfies OperatingPlotCandidateContext;

function powerRequest(inputMinimum = 12, inputMaximum = 12): Extract<OperatingPlotRequest, { application: "power.buck" }> {
  const request = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: inputMinimum, unit: "V", displayUnit: "V" },
        nominal: { value: 12, unit: "V", displayUnit: "V" },
        maximum: { value: inputMaximum, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
      dcOutputVoltageRegulation: {
        minimum: { value: 4.7, unit: "V", displayUnit: "V" },
        maximum: { value: 5.3, unit: "V", displayUnit: "V" },
      },
      maximumOutputCurrent: { value: 0.2, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: 298.15, unit: "K", displayUnit: "°C" },
      switchingFrequency: {
        selection: "automatic",
        minimum: { value: 250_000, unit: "Hz", displayUnit: "kHz" },
        preferred: null,
        maximum: { value: 600_000, unit: "Hz", displayUnit: "kHz" },
      },
      maximumOutputRipple: { value: 0.03, unit: "V", displayUnit: "mV" },
      loadTransientTarget: null,
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
      maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: true,
    },
    assumptions: [{
      id: "plot-test.power",
      description: "The fixture exercises request-derived analytical plots only.",
      source: "fixture",
      affects: ["operating-plots"],
    }],
    libraryVersion: "plot-test",
  });
  if (request.application !== "power.buck") throw new Error("Expected Power request");
  return request;
}

function motorRequest(): Extract<OperatingPlotRequest, { application: "motor.brushed-dc" }> {
  const request = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "motor.brushed-dc",
    requirements: {
      supplyVoltage: {
        minimum: { value: 9, unit: "V", displayUnit: "V" },
        nominal: { value: 12, unit: "V", displayUnit: "V" },
        maximum: { value: 15, unit: "V", displayUnit: "V" },
      },
      motorNominalVoltage: { value: 12, unit: "V", displayUnit: "V" },
      continuousCurrent: { value: 1.5, unit: "A", displayUnit: "A" },
      stallCurrent: { value: 3, unit: "A", displayUnit: "A" },
      pwmFrequency: { value: 20_000, unit: "Hz", displayUnit: "kHz" },
      logicVoltage: { value: 3.3, unit: "V", displayUnit: "V" },
      ambientTemperature: { value: 313.15, unit: "K", displayUnit: "°C" },
      operatingModes: ["brake", "coast", "forward", "reverse"],
      currentLimitTarget: null,
      operatingPoint: {
        dutyCycle: { value: 0.8, unit: "1", displayUnit: "%" },
        loadCurrent: { value: 1.5, unit: "A", displayUnit: "A" },
        loadCurrentBasis: "continuous_rating",
        loadProfile: "steady_state",
      },
      motorModel: {
        windingResistance: { value: 4, unit: "ohm", displayUnit: "Ω" },
        windingResistanceSource: "estimated_from_nominal_voltage_and_stall_current",
        windingInductance: null,
        backEmfConstant: null,
        targetSpeed: null,
      },
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["motor.hbridge.integrated"],
      maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: true,
    },
    assumptions: [{
      id: "plot-test.motor",
      description: "The fixture exercises request-derived analytical plots only.",
      source: "fixture",
      affects: ["operating-plots"],
    }],
    libraryVersion: "plot-test",
  });
  if (request.application !== "motor.brushed-dc") throw new Error("Expected Motor request");
  return request;
}

describe("analytical operating plots", () => {
  it("plots the fixed-input Power output envelope and exact switching-period conversion", () => {
    const request = powerRequest();
    const plots = buildOperatingPlots(request);
    expect(plots.map((plot) => plot.id)).toEqual([
      "power-ideal-duty-output",
      "power-switching-period",
    ]);

    const duty = plots[0]!;
    expect(duty.xAxis).toMatchObject({ label: "Requested output voltage", unit: "V", domain: [4.7, 5.3] });
    expect(duty.yAxis).toMatchObject({ label: "Ideal duty ratio", unit: "%" });
    const conversion = duty.series.find((series) => series.id === "power-fixed-input-duty");
    expect(conversion?.kind).toBe("line");
    if (conversion?.kind !== "line") throw new Error("Expected conversion line");
    expect(conversion.points[0]).toEqual({ x: 4.7, y: (4.7 / 12) * 100 });
    expect(conversion.points.at(-1)).toEqual({ x: 5.3, y: (5.3 / 12) * 100 });

    const period = plots[1]!;
    const periodSeries = period.series.find((series) => series.id === "power-switching-period");
    if (periodSeries?.kind !== "line") throw new Error("Expected period line");
    expect(periodSeries.points[0]).toEqual({ x: 250, y: 4 });
    expect(periodSeries.points.at(-1)?.x).toBe(600);
    expect(periodSeries.points.at(-1)?.y).toBeCloseTo(5 / 3);

    const markup = renderOperatingPlots(request, candidate);
    expect(markup).toContain('data-designer-operating-chart="power-ideal-duty-output"');
    expect(markup).toContain('data-designer-operating-chart="power-switching-period"');
    expect(markup).toContain("Requested output voltage (V)");
    expect(markup).toContain("Ideal duty ratio (%)");
    expect(markup).toContain("Requested switching frequency (kHz)");
    expect(markup).toContain("Ideal period (µs)");
    expect(markup).toContain("Series provenance:");
    expect(markup).toContain("ideal D = Vout/Vin");
    expect(markup).toContain("2 persisted scenario coverage records");
    expect(markup).toContain("contain no sampled outputs");
    expect(markup).not.toContain('data-designer-operating-chart="efficiency"');
    expect(markup).not.toContain('data-designer-operating-chart="regulation"');
    expect(markup.match(/<desc>/g)).toHaveLength(2);
  });

  it("renders a real Power duty area only when the request supplies both input and output envelopes", () => {
    const request = powerRequest(9, 16);
    const duty = buildOperatingPlots(request)[0]!;
    expect(duty.id).toBe("power-ideal-duty-input");
    const envelope = duty.series.find((series) => series.id === "power-requested-output-envelope");
    if (envelope?.kind !== "band") throw new Error("Expected duty envelope band");
    expect(envelope.points[0]).toEqual({
      x: 9,
      lower: (4.7 / 9) * 100,
      upper: (5.3 / 9) * 100,
    });
    expect(envelope.points.at(-1)).toEqual({
      x: 16,
      lower: (4.7 / 16) * 100,
      upper: (5.3 / 16) * 100,
    });
    expect(renderOperatingPlots(request, candidate)).toContain('data-series-kind="band"');
  });

  it("plots Motor ideal voltage and zero-speed resistance projections while keeping the load point separate", () => {
    const request = motorRequest();
    const plots = buildOperatingPlots(request);
    expect(plots.map((plot) => plot.id)).toEqual([
      "motor-ideal-pwm-voltage",
      "motor-zero-speed-current",
    ]);

    const voltage = plots[0]!;
    const voltageBand = voltage.series.find((series) => series.id === "motor-supply-voltage-envelope");
    if (voltageBand?.kind !== "band") throw new Error("Expected voltage envelope band");
    expect(voltageBand.points.at(-1)).toEqual({ x: 100, lower: 9, upper: 15 });
    const voltageLine = voltage.series.find((series) => series.id === "motor-nominal-supply-voltage");
    if (voltageLine?.kind !== "line") throw new Error("Expected nominal voltage line");
    expect(voltageLine.points.at(-1)).toEqual({ x: 100, y: 12 });

    const current = plots[1]!;
    const currentLine = current.series.find((series) => series.id === "motor-zero-speed-current-nominal");
    if (currentLine?.kind !== "line") throw new Error("Expected nominal current line");
    expect(currentLine.points.at(-1)).toEqual({ x: 100, y: 3 });
    expect(currentLine.provenance).toContain("estimated winding resistance");
    const loadPoint = current.series.find((series) => series.id === "motor-requested-load-point");
    if (loadPoint?.kind !== "point") throw new Error("Expected requested load point");
    expect(loadPoint.points).toEqual([{ x: 80, y: 1.5 }]);
    expect(loadPoint.provenance).toContain("not predicted by the curve");

    const markup = renderOperatingPlots(request, candidate);
    expect(markup).toContain("Commanded duty ratio (%)");
    expect(markup).toContain("Ideal average winding voltage (V)");
    expect(markup).toContain("Ideal zero-speed winding current (A)");
    expect(markup).toContain("estimated request model");
    expect(markup).toContain("excludes back EMF");
    expect(markup).toContain("no sampled outputs");
    expect(renderOperatingPlots(request, { recipeId: "no-samples", simulationCoverage: [] }))
      .toContain("No persisted scenario coverage records or sampled outputs are available");
  });
});
