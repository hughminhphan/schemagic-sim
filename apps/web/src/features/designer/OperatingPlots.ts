import type { ParsedPersistedDesignResult } from "@opencircuit/design-schema";
import { escapeHtml, formatQuantity } from "./view";

export type OperatingPlotRequest = ParsedPersistedDesignResult["request"];

export interface OperatingPlotCandidateContext {
  readonly recipeId: string;
  readonly simulationCoverage: readonly Readonly<{
    scenarioId: string;
    modelTier: string;
    limitations: readonly string[];
  }>[];
}

export interface OperatingPlotPoint {
  readonly x: number;
  readonly y: number;
}

export interface OperatingPlotBandPoint {
  readonly x: number;
  readonly lower: number;
  readonly upper: number;
}

type OperatingPlotTone = "primary" | "secondary" | "input" | "estimated" | "reference";

interface OperatingPlotSeriesBase {
  readonly id: string;
  readonly label: string;
  readonly provenance: string;
  readonly tone: OperatingPlotTone;
}

export type OperatingPlotSeries =
  | (OperatingPlotSeriesBase & { readonly kind: "line"; readonly points: readonly OperatingPlotPoint[] })
  | (OperatingPlotSeriesBase & { readonly kind: "band"; readonly points: readonly OperatingPlotBandPoint[] })
  | (OperatingPlotSeriesBase & { readonly kind: "point"; readonly points: readonly OperatingPlotPoint[] })
  | (OperatingPlotSeriesBase & { readonly kind: "reference"; readonly y: number });

export interface OperatingPlotAxis {
  readonly label: string;
  readonly unit: string;
  readonly domain: readonly [number, number];
  readonly ticks: readonly number[];
}

export interface OperatingPlotModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly xAxis: OperatingPlotAxis;
  readonly yAxis: OperatingPlotAxis;
  readonly series: readonly OperatingPlotSeries[];
  readonly summary: string;
  readonly boundary: string;
}

const SAMPLE_COUNT = 9;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 342;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 188;

function sampleRange(minimum: number, maximum: number, count = SAMPLE_COUNT): number[] {
  if (count < 2 || minimum === maximum) return [minimum];
  return Array.from({ length: count }, (_, index) => minimum + ((maximum - minimum) * index / (count - 1)));
}

function distinctTicks(values: readonly number[]): number[] {
  return [...values]
    .sort((left, right) => left - right)
    .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]!) > 1e-9);
}

function rangeTicks(minimum: number, maximum: number, preferred?: number): number[] {
  if (minimum === maximum) return [minimum];
  const middle = (minimum + maximum) / 2;
  return distinctTicks([
    minimum,
    minimum + ((maximum - minimum) / 4),
    ...(preferred === undefined ? [middle] : [preferred]),
    maximum - ((maximum - minimum) / 4),
    maximum,
  ]).filter((value) => value >= minimum && value <= maximum);
}

function niceUpper(maximum: number): number {
  if (!Number.isFinite(maximum) || maximum <= 0) return 1;
  const target = maximum * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalized = target / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function zeroBasedAxis(label: string, unit: string, maximum: number): OperatingPlotAxis {
  const upper = niceUpper(maximum);
  return { label, unit, domain: [0, upper], ticks: rangeTicks(0, upper) };
}

function powerDutyPlot(request: Extract<OperatingPlotRequest, { application: "power.buck" }>): OperatingPlotModel | undefined {
  const requirements = request.requirements;
  const inputMinimum = requirements.inputVoltage.minimum.value;
  const inputNominal = requirements.inputVoltage.nominal.value;
  const inputMaximum = requirements.inputVoltage.maximum.value;
  const outputNominal = requirements.outputVoltage.value;
  const outputEnvelope = requirements.dcOutputVoltageRegulation;
  const inputRangeVaries = inputMaximum - inputMinimum > 1e-9;

  if (inputRangeVaries) {
    const xValues = sampleRange(inputMinimum, inputMaximum);
    const nominalPoints = xValues.map((inputVoltage) => ({
      x: inputVoltage,
      y: (outputNominal / inputVoltage) * 100,
    }));
    const band = outputEnvelope === undefined ? undefined : xValues.map((inputVoltage) => ({
      x: inputVoltage,
      lower: (outputEnvelope.minimum.value / inputVoltage) * 100,
      upper: (outputEnvelope.maximum.value / inputVoltage) * 100,
    }));
    const maximumDuty = Math.max(
      ...nominalPoints.map((point) => point.y),
      ...(band?.map((point) => point.upper) ?? []),
    );
    const series: OperatingPlotSeries[] = [
      ...(band === undefined ? [] : [{
        kind: "band" as const,
        id: "power-requested-output-envelope",
        label: "Requested output envelope",
        provenance: "request input/output envelopes + ideal D = Vout/Vin",
        tone: "input" as const,
        points: band,
      }]),
      {
        kind: "line",
        id: "power-nominal-output-duty",
        label: "Nominal output",
        provenance: "request nominal output + ideal D = Vout/Vin",
        tone: "primary",
        points: nominalPoints,
      },
      {
        kind: "point",
        id: "power-nominal-input-point",
        label: "Nominal input point",
        provenance: "request nominal input and output",
        tone: "secondary",
        points: [{ x: inputNominal, y: (outputNominal / inputNominal) * 100 }],
      },
    ];
    return {
      id: "power-ideal-duty-input",
      title: "Ideal buck conversion ratio",
      subtitle: "input-voltage sweep",
      xAxis: {
        label: "Requested input voltage",
        unit: "V",
        domain: [inputMinimum, inputMaximum],
        ticks: rangeTicks(inputMinimum, inputMaximum, inputNominal),
      },
      yAxis: zeroBasedAxis("Ideal duty ratio", "%", maximumDuty),
      series,
      summary: `Across the requested ${inputMinimum} V to ${inputMaximum} V input range, ideal nominal-output duty falls from ${formatPlotNumber(nominalPoints[0]!.y)}% to ${formatPlotNumber(nominalPoints.at(-1)!.y)}%.`,
      boundary: "Ideal continuous-conduction conversion ratio only; excludes loss, control-law, pulse-skipping, timing, and selected-part regulation behavior.",
    };
  }

  if (outputEnvelope === undefined || outputEnvelope.maximum.value - outputEnvelope.minimum.value <= 1e-9) return undefined;
  const outputMinimum = outputEnvelope.minimum.value;
  const outputMaximum = outputEnvelope.maximum.value;
  const xValues = sampleRange(outputMinimum, outputMaximum);
  const points = xValues.map((outputVoltage) => ({
    x: outputVoltage,
    y: (outputVoltage / inputNominal) * 100,
  }));
  return {
    id: "power-ideal-duty-output",
    title: "Ideal buck conversion ratio",
    subtitle: "fixed-input output envelope",
    xAxis: {
      label: "Requested output voltage",
      unit: "V",
      domain: [outputMinimum, outputMaximum],
      ticks: rangeTicks(outputMinimum, outputMaximum, outputNominal),
    },
    yAxis: zeroBasedAxis("Ideal duty ratio", "%", Math.max(...points.map((point) => point.y))),
    series: [
      {
        kind: "line",
        id: "power-fixed-input-duty",
        label: "Ideal conversion ratio",
        provenance: "request fixed input/output envelope + ideal D = Vout/Vin",
        tone: "primary",
        points,
      },
      {
        kind: "point",
        id: "power-nominal-output-point",
        label: "Nominal output point",
        provenance: "request nominal output at fixed nominal input",
        tone: "input",
        points: [{ x: outputNominal, y: (outputNominal / inputNominal) * 100 }],
      },
    ],
    summary: `At the fixed requested ${inputNominal} V input, the ${outputMinimum} V to ${outputMaximum} V output envelope corresponds to an ideal duty range of ${formatPlotNumber((outputMinimum / inputNominal) * 100)}% to ${formatPlotNumber((outputMaximum / inputNominal) * 100)}%.`,
    boundary: "Ideal conversion arithmetic only; the output envelope is a request, not measured or predicted regulation performance.",
  };
}

function powerSwitchingPeriodPlot(request: Extract<OperatingPlotRequest, { application: "power.buck" }>): OperatingPlotModel | undefined {
  const switching = request.requirements.switchingFrequency;
  const minimumHz = switching.minimum.value;
  const maximumHz = switching.maximum.value;
  if (maximumHz - minimumHz <= 1e-9) return undefined;
  const frequenciesHz = sampleRange(minimumHz, maximumHz);
  const points = frequenciesHz.map((frequencyHz) => ({
    x: frequencyHz / 1_000,
    y: 1_000_000 / frequencyHz,
  }));
  const preferred = switching.preferred;
  const series: OperatingPlotSeries[] = [{
    kind: "line",
    id: "power-switching-period",
    label: "Frequency-to-period conversion",
    provenance: "request switching-frequency interval + exact T = 1/f",
    tone: "primary",
    points,
  }];
  if (preferred !== null) {
    series.push({
      kind: "point",
      id: "power-preferred-switching-frequency",
      label: "Preferred request value",
      provenance: "request preferred switching frequency",
      tone: "input",
      points: [{ x: preferred.value / 1_000, y: 1_000_000 / preferred.value }],
    });
  }
  return {
    id: "power-switching-period",
    title: "Switching frequency ↔ period",
    subtitle: "request conversion",
    xAxis: {
      label: "Requested switching frequency",
      unit: "kHz",
      domain: [minimumHz / 1_000, maximumHz / 1_000],
      ticks: rangeTicks(minimumHz / 1_000, maximumHz / 1_000, preferred?.value === undefined ? undefined : preferred.value / 1_000),
    },
    yAxis: zeroBasedAxis("Ideal period", "µs", Math.max(...points.map((point) => point.y))),
    series,
    summary: `The requested ${formatQuantity(switching.minimum)} to ${formatQuantity(switching.maximum)} switching interval converts exactly to ${formatPlotNumber(points[0]!.y)} µs down to ${formatPlotNumber(points.at(-1)!.y)} µs per cycle.`,
    boundary: "Clock-period conversion only; it is not a selected switching-frequency decision, switching waveform, or timing proof.",
  };
}

function motorVoltagePlot(request: Extract<OperatingPlotRequest, { application: "motor.brushed-dc" }>): OperatingPlotModel {
  const requirements = request.requirements;
  const supplyMinimum = requirements.supplyVoltage.minimum.value;
  const supplyNominal = requirements.supplyVoltage.nominal.value;
  const supplyMaximum = requirements.supplyVoltage.maximum.value;
  const requestedDuty = requirements.operatingPoint.dutyCycle.value * 100;
  const dutyValues = sampleRange(0, 100);
  const band = dutyValues.map((dutyPercent) => ({
    x: dutyPercent,
    lower: (dutyPercent / 100) * supplyMinimum,
    upper: (dutyPercent / 100) * supplyMaximum,
  }));
  const nominal = dutyValues.map((dutyPercent) => ({
    x: dutyPercent,
    y: (dutyPercent / 100) * supplyNominal,
  }));
  return {
    id: "motor-ideal-pwm-voltage",
    title: "Ideal PWM average voltage",
    subtitle: "request-derived command envelope",
    xAxis: { label: "Commanded duty ratio", unit: "%", domain: [0, 100], ticks: [0, 25, 50, 75, 100] },
    yAxis: zeroBasedAxis("Ideal average winding voltage", "V", supplyMaximum),
    series: [
      {
        kind: "band",
        id: "motor-supply-voltage-envelope",
        label: "Supply-range envelope",
        provenance: "request supply range + ideal Vavg = duty × supply",
        tone: "input",
        points: band,
      },
      {
        kind: "line",
        id: "motor-nominal-supply-voltage",
        label: "Nominal supply",
        provenance: "request nominal supply + ideal Vavg = duty × supply",
        tone: "primary",
        points: nominal,
      },
      {
        kind: "point",
        id: "motor-requested-duty-voltage",
        label: "Requested duty point",
        provenance: "request operating-point duty at nominal supply",
        tone: "secondary",
        points: [{ x: requestedDuty, y: requirements.operatingPoint.dutyCycle.value * supplyNominal }],
      },
    ],
    summary: `The requested ${formatQuantity(requirements.supplyVoltage.minimum)} to ${formatQuantity(requirements.supplyVoltage.maximum)} supply range maps to an ideal zero-to-${formatPlotNumber(supplyMaximum)} V average command envelope; the requested duty is ${formatQuantity(requirements.operatingPoint.dutyCycle)}.`,
    boundary: "Ideal unipolar forward-drive averaging with zero-volt recirculation only; excludes bridge drops, decay-mode switching, back EMF, ripple, and selected-part behavior.",
  };
}

function motorCurrentPlot(request: Extract<OperatingPlotRequest, { application: "motor.brushed-dc" }>): OperatingPlotModel {
  const requirements = request.requirements;
  const resistance = requirements.motorModel.windingResistance;
  const supplyMinimum = requirements.supplyVoltage.minimum.value;
  const supplyNominal = requirements.supplyVoltage.nominal.value;
  const supplyMaximum = requirements.supplyVoltage.maximum.value;
  const requestedDuty = requirements.operatingPoint.dutyCycle.value * 100;
  const dutyValues = sampleRange(0, 100);
  const band = dutyValues.map((dutyPercent) => ({
    x: dutyPercent,
    lower: ((dutyPercent / 100) * supplyMinimum) / resistance.value,
    upper: ((dutyPercent / 100) * supplyMaximum) / resistance.value,
  }));
  const nominal = dutyValues.map((dutyPercent) => ({
    x: dutyPercent,
    y: ((dutyPercent / 100) * supplyNominal) / resistance.value,
  }));
  const resistanceIsEstimated = requirements.motorModel.windingResistanceSource === "estimated_from_nominal_voltage_and_stall_current";
  const references: OperatingPlotSeries[] = [
    {
      kind: "reference",
      id: "motor-continuous-current-reference",
      label: "Continuous-current input",
      provenance: "request continuous-current rating",
      tone: "reference",
      y: requirements.continuousCurrent.value,
    },
    {
      kind: "reference",
      id: "motor-stall-current-reference",
      label: "Stall-current input",
      provenance: "request stall-current rating",
      tone: "reference",
      y: requirements.stallCurrent.value,
    },
    ...(requirements.currentLimitTarget === null ? [] : [{
      kind: "reference" as const,
      id: "motor-current-limit-reference",
      label: "Current-limit target",
      provenance: "request current-limit target",
      tone: "input" as const,
      y: requirements.currentLimitTarget.value,
    }]),
  ];
  const maximumCurrent = Math.max(
    supplyMaximum / resistance.value,
    requirements.continuousCurrent.value,
    requirements.stallCurrent.value,
    requirements.currentLimitTarget?.value ?? 0,
    requirements.operatingPoint.loadCurrent.value,
  );
  return {
    id: "motor-zero-speed-current",
    title: "Ideal zero-speed winding current",
    subtitle: resistanceIsEstimated ? "estimated request model" : "provided request model",
    xAxis: { label: "Commanded duty ratio", unit: "%", domain: [0, 100], ticks: [0, 25, 50, 75, 100] },
    yAxis: zeroBasedAxis("Ideal zero-speed winding current", "A", maximumCurrent),
    series: [
      {
        kind: "band",
        id: "motor-zero-speed-current-envelope",
        label: "Supply-range projection",
        provenance: `request supply range + ${resistanceIsEstimated ? "estimated" : "provided"} winding resistance + ideal I = duty × V/R`,
        tone: resistanceIsEstimated ? "estimated" : "input",
        points: band,
      },
      {
        kind: "line",
        id: "motor-zero-speed-current-nominal",
        label: "Nominal-supply projection",
        provenance: `request nominal supply + ${resistanceIsEstimated ? "estimated" : "provided"} winding resistance + ideal I = duty × V/R`,
        tone: resistanceIsEstimated ? "estimated" : "primary",
        points: nominal,
      },
      {
        kind: "point",
        id: "motor-requested-load-point",
        label: "Requested load point",
        provenance: "request duty and operating load current; not predicted by the curve",
        tone: "secondary",
        points: [{ x: requestedDuty, y: requirements.operatingPoint.loadCurrent.value }],
      },
      ...references,
    ],
    summary: `Using the request's ${formatQuantity(resistance)} ${resistanceIsEstimated ? "estimated" : "provided"} winding resistance, the ideal zero-speed nominal-supply projection reaches ${formatPlotNumber(supplyNominal / resistance.value)} A at 100% duty. The requested operating-load point remains a separate input.`,
    boundary: "Static zero-speed V/R arithmetic only; excludes back EMF, inductance, current-limit action, switching ripple, bridge drops, thermal behavior, and selected-part capability.",
  };
}

export function buildOperatingPlots(request: Readonly<OperatingPlotRequest>): readonly OperatingPlotModel[] {
  if (request.application === "power.buck") {
    return [powerDutyPlot(request), powerSwitchingPeriodPlot(request)].filter(
      (plot): plot is OperatingPlotModel => plot !== undefined,
    );
  }
  return [motorVoltagePlot(request), motorCurrentPlot(request)];
}

function formatPlotNumber(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1000) return Number(value.toPrecision(4)).toString();
  if (absolute >= 100) return Number(value.toFixed(1)).toString();
  if (absolute >= 10) return Number(value.toFixed(2)).toString();
  return Number(value.toFixed(3)).toString();
}

function scale(value: number, domain: readonly [number, number], start: number, end: number): number {
  const span = domain[1] - domain[0];
  if (span === 0) return (start + end) / 2;
  return start + (((value - domain[0]) / span) * (end - start));
}

function coordinate(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function linePath(points: readonly OperatingPlotPoint[], model: OperatingPlotModel): string {
  return points.map((point, index) => {
    const x = scale(point.x, model.xAxis.domain, PLOT_LEFT, PLOT_RIGHT);
    const y = scale(point.y, model.yAxis.domain, PLOT_BOTTOM, PLOT_TOP);
    return `${index === 0 ? "M" : "L"}${coordinate(x)},${coordinate(y)}`;
  }).join(" ");
}

function bandPath(points: readonly OperatingPlotBandPoint[], model: OperatingPlotModel): string {
  const upper = points.map((point, index) => {
    const x = scale(point.x, model.xAxis.domain, PLOT_LEFT, PLOT_RIGHT);
    const y = scale(point.upper, model.yAxis.domain, PLOT_BOTTOM, PLOT_TOP);
    return `${index === 0 ? "M" : "L"}${coordinate(x)},${coordinate(y)}`;
  });
  const lower = [...points].reverse().map((point) => {
    const x = scale(point.x, model.xAxis.domain, PLOT_LEFT, PLOT_RIGHT);
    const y = scale(point.lower, model.yAxis.domain, PLOT_BOTTOM, PLOT_TOP);
    return `L${coordinate(x)},${coordinate(y)}`;
  });
  return `${upper.join(" ")} ${lower.join(" ")} Z`;
}

function toneColor(tone: OperatingPlotTone): string {
  if (tone === "primary") return "var(--designer-blue)";
  if (tone === "estimated") return "var(--designer-amber)";
  if (tone === "input") return "var(--designer-green)";
  if (tone === "secondary") return "var(--designer-charcoal)";
  return "var(--designer-muted)";
}

function seriesMarkup(series: OperatingPlotSeries, model: OperatingPlotModel): string {
  const color = toneColor(series.tone);
  const attributes = `data-plot-series="${escapeHtml(series.id)}" data-series-kind="${series.kind}" data-series-provenance="${escapeHtml(series.provenance)}"`;
  if (series.kind === "band") {
    return `<path ${attributes} d="${bandPath(series.points, model)}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-opacity="0.65" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }
  if (series.kind === "reference") {
    const y = scale(series.y, model.yAxis.domain, PLOT_BOTTOM, PLOT_TOP);
    return `<line ${attributes} x1="${PLOT_LEFT}" x2="${PLOT_RIGHT}" y1="${coordinate(y)}" y2="${coordinate(y)}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>`;
  }
  if (series.kind === "line") {
    return `<path ${attributes} d="${linePath(series.points, model)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  return series.points.map((point) => {
    const x = scale(point.x, model.xAxis.domain, PLOT_LEFT, PLOT_RIGHT);
    const y = scale(point.y, model.yAxis.domain, PLOT_BOTTOM, PLOT_TOP);
    return `<circle ${attributes} cx="${coordinate(x)}" cy="${coordinate(y)}" r="4" fill="${color}" stroke="var(--designer-paper)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  }).join("");
}

function axesMarkup(model: OperatingPlotModel): string {
  const xGrid = model.xAxis.ticks.map((tick) => {
    const x = scale(tick, model.xAxis.domain, PLOT_LEFT, PLOT_RIGHT);
    return `<g data-axis-tick="x"><line x1="${coordinate(x)}" x2="${coordinate(x)}" y1="${PLOT_TOP}" y2="${PLOT_BOTTOM}" stroke="var(--designer-line)" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${coordinate(x)}" y="205" text-anchor="middle" fill="var(--designer-muted)" font-family="IBM Plex Mono, monospace" font-size="9">${escapeHtml(formatPlotNumber(tick))}</text></g>`;
  }).join("");
  const yGrid = model.yAxis.ticks.map((tick) => {
    const y = scale(tick, model.yAxis.domain, PLOT_BOTTOM, PLOT_TOP);
    return `<g data-axis-tick="y"><line x1="${PLOT_LEFT}" x2="${PLOT_RIGHT}" y1="${coordinate(y)}" y2="${coordinate(y)}" stroke="var(--designer-line)" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="50" y="${coordinate(y + 3)}" text-anchor="end" fill="var(--designer-muted)" font-family="IBM Plex Mono, monospace" font-size="9">${escapeHtml(formatPlotNumber(tick))}</text></g>`;
  }).join("");
  return `${xGrid}${yGrid}<rect data-chart-frame x="${PLOT_LEFT}" y="${PLOT_TOP}" width="${PLOT_RIGHT - PLOT_LEFT}" height="${PLOT_BOTTOM - PLOT_TOP}" fill="none" stroke="var(--designer-charcoal)" stroke-width="1" vector-effect="non-scaling-stroke"/><text data-axis="x" x="${(PLOT_LEFT + PLOT_RIGHT) / 2}" y="225" text-anchor="middle" fill="var(--designer-charcoal)" font-family="IBM Plex Mono, monospace" font-size="9">${escapeHtml(`${model.xAxis.label} (${model.xAxis.unit})`)}</text><text data-axis="y" x="0" y="0" transform="translate(15 ${(PLOT_TOP + PLOT_BOTTOM) / 2}) rotate(-90)" text-anchor="middle" fill="var(--designer-charcoal)" font-family="IBM Plex Mono, monospace" font-size="9">${escapeHtml(`${model.yAxis.label} (${model.yAxis.unit})`)}</text>`;
}

function legendMarkup(model: OperatingPlotModel): { readonly markup: string; readonly height: number } {
  const startY = 249;
  const rowHeight = 17;
  const markup = model.series.map((series, index) => {
    const y = startY + (index * rowHeight);
    const color = toneColor(series.tone);
    const swatch = series.kind === "point"
      ? `<circle cx="66" cy="${y - 4}" r="3.5" fill="${color}"/>`
      : series.kind === "band"
        ? `<rect x="61" y="${y - 9}" width="10" height="8" fill="${color}" fill-opacity="0.22" stroke="${color}"/>`
        : `<line x1="61" x2="71" y1="${y - 4}" y2="${y - 4}" stroke="${color}" stroke-width="${series.kind === "reference" ? 1 : 2}"${series.kind === "reference" ? " stroke-dasharray=\"3 2\"" : ""}/>`;
    return `<g data-plot-legend-item="${escapeHtml(series.id)}">${swatch}<text x="78" y="${y}" fill="var(--designer-charcoal)" font-family="IBM Plex Mono, monospace" font-size="9">${escapeHtml(series.label)}</text></g>`;
  }).join("");
  return { markup, height: startY + (model.series.length * rowHeight) + 4 };
}

function plotMarkup(model: OperatingPlotModel): string {
  const legend = legendMarkup(model);
  const provenance = model.series.map((series) => `${series.label} — ${series.provenance}`).join("; ");
  return `<figure class="designer-operating-chart" data-designer-operating-chart="${escapeHtml(model.id)}" data-operating-plot-authority="analytical-request-only"><figcaption><strong>${escapeHtml(model.title)}</strong><span>${escapeHtml(model.subtitle)}</span></figcaption><svg viewBox="0 0 360 ${legend.height}" role="img" aria-label="${escapeHtml(model.summary)}" focusable="false"><title>${escapeHtml(model.title)}</title><desc>${escapeHtml(`${model.summary} ${model.boundary}`)}</desc>${axesMarkup(model)}${model.series.map((series) => seriesMarkup(series, model)).join("")}${legend.markup}</svg><p><strong>Series provenance:</strong> ${escapeHtml(provenance)}. ${escapeHtml(model.boundary)}</p></figure>`;
}

function scenarioBoundary(candidate: Readonly<OperatingPlotCandidateContext>): string {
  const unavailable = candidate.simulationCoverage.filter((entry) => entry.modelTier === "unavailable").length;
  const other = candidate.simulationCoverage.length - unavailable;
  if (candidate.simulationCoverage.length === 0) {
    return "No persisted scenario coverage records or sampled outputs are available. Candidate scalar metrics are not promoted into curves.";
  }
  return `${candidate.simulationCoverage.length} persisted scenario coverage record${candidate.simulationCoverage.length === 1 ? "" : "s"} carry model-tier and limitation metadata only (${other} behavioral/reviewed, ${unavailable} unavailable); they contain no sampled outputs. Candidate scalar metrics are not promoted into curves.`;
}

export function renderOperatingPlots(
  request: Readonly<OperatingPlotRequest>,
  candidate: Readonly<OperatingPlotCandidateContext>,
): string {
  const models = buildOperatingPlots(request);
  if (models.length === 0) return "";
  const boundary = scenarioBoundary(candidate);
  return `<section class="designer-operating-charts" data-testid="designer-operating-plots" data-operating-plot-application="${escapeHtml(request.application)}" aria-labelledby="designer-operating-plots-title"><header><div><span class="designer-section-code">REQUEST + IDEAL EQUATIONS · NO SAMPLED RESULTS</span><h3 id="designer-operating-plots-title">Analytical operating plots</h3></div><p>${escapeHtml(`${boundary} No efficiency, regulation-performance, or waveform series is synthesized.`)}</p></header><div class="designer-operating-chart-grid">${models.map(plotMarkup).join("")}</div></section>`;
}
