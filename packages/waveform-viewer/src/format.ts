const PREFIXES: Readonly<Record<number, string>> = {
  [-24]: "y",
  [-21]: "z",
  [-18]: "a",
  [-15]: "f",
  [-12]: "p",
  [-9]: "n",
  [-6]: "µ",
  [-3]: "m",
  [0]: "",
  [3]: "k",
  [6]: "M",
  [9]: "G",
  [12]: "T",
  [15]: "P",
  [18]: "E",
  [21]: "Z",
  [24]: "Y",
};

export interface FormatValueOptions {
  significantDigits?: number;
  unit?: string;
  reserveSign?: boolean;
}

export function formatValue(value: number, options: FormatValueOptions = {}): string {
  const significantDigits = options.significantDigits ?? 3;
  const unit = options.unit ?? "";
  const sign = value < 0 ? "−" : options.reserveSign === false ? "" : " ";
  const magnitude = Math.abs(value);

  if (!Number.isFinite(value)) return `${sign}${String(magnitude)}${unit ? ` ${unit}` : ""}`;
  if (magnitude === 0) return `${sign}0${unit ? ` ${unit}` : ""}`;

  const exponent = unit === "dB" || unit === "°"
    ? 0
    : Math.max(-24, Math.min(24, Math.floor(Math.log10(magnitude) / 3) * 3));
  const scaled = magnitude / 10 ** exponent;
  const integerDigits = Math.floor(Math.log10(scaled)) + 1;
  const decimals = Math.max(0, significantDigits - integerDigits);
  const numeric = scaled.toFixed(decimals);
  const prefix = PREFIXES[exponent] ?? `e${exponent}`;
  return `${sign}${numeric}${unit ? ` ${prefix}${unit}` : prefix}`;
}
