export interface FormattedReading {
  value: string;
  unit: string;
  title: string;
}

const PREFIXES: Record<number, string> = {
  [-12]: "p",
  [-9]: "n",
  [-6]: "µ",
  [-3]: "m",
  0: "",
  3: "k",
  6: "M",
  9: "G",
};

export function formatEngineering(input: number | undefined, unit: string, digits = 3): FormattedReading {
  if (input === undefined || !Number.isFinite(input)) return { value: "  –", unit: "", title: "No simulated value" };
  if (input === 0) return { value: " 0.00", unit, title: `0 ${unit}` };
  const exponent = Math.max(-12, Math.min(9, Math.floor(Math.log10(Math.abs(input)) / 3) * 3));
  const scaled = input / 10 ** exponent;
  const absolute = Math.abs(scaled);
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(absolute)));
  const sign = scaled < 0 ? "−" : "+";
  return {
    value: `${sign}${absolute.toFixed(decimals)}`,
    unit: `${PREFIXES[exponent] ?? ""}${unit}`,
    title: `${input.toPrecision(Math.min(12, Math.max(digits, 6)))} ${unit}`,
  };
}

export function readingMarkup(input: number | undefined, unit: string, testId?: string): string {
  const reading = formatEngineering(input, unit);
  return `<span class="reading"${testId ? ` data-testid="${testId}"` : ""} title="${reading.title}"><span class="reading-value">${reading.value}</span><span class="reading-unit">${reading.unit}</span></span>`;
}
