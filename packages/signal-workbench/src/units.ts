import type { EngineeringUnit, QuantityDimension, UnitSymbol } from "./types";

export const DIMENSIONLESS: QuantityDimension = Object.freeze({ voltage: 0, current: 0, time: 0 });
export const VOLTAGE_DIMENSION: QuantityDimension = Object.freeze({ voltage: 1, current: 0, time: 0 });
export const CURRENT_DIMENSION: QuantityDimension = Object.freeze({ voltage: 0, current: 1, time: 0 });
export const POWER_DIMENSION: QuantityDimension = Object.freeze({ voltage: 1, current: 1, time: 0 });
export const TIME_DIMENSION: QuantityDimension = Object.freeze({ voltage: 0, current: 0, time: 1 });
export const FREQUENCY_DIMENSION: QuantityDimension = Object.freeze({ voltage: 0, current: 0, time: -1 });

export interface UnitDescriptor {
  unit: EngineeringUnit;
  dimension: QuantityDimension;
  scale: number;
}

const DESCRIPTORS: Readonly<Record<EngineeringUnit, UnitDescriptor>> = {
  "1": { unit: "1", dimension: DIMENSIONLESS, scale: 1 },
  V: { unit: "V", dimension: VOLTAGE_DIMENSION, scale: 1 },
  A: { unit: "A", dimension: CURRENT_DIMENSION, scale: 1 },
  W: { unit: "W", dimension: POWER_DIMENSION, scale: 1 },
  s: { unit: "s", dimension: TIME_DIMENSION, scale: 1 },
  Hz: { unit: "Hz", dimension: FREQUENCY_DIMENSION, scale: 1 },
  Ohm: { unit: "Ohm", dimension: { voltage: 1, current: -1, time: 0 }, scale: 1 },
  rad: { unit: "rad", dimension: DIMENSIONLESS, scale: 1 },
  deg: { unit: "deg", dimension: DIMENSIONLESS, scale: Math.PI / 180 },
  dB: { unit: "dB", dimension: DIMENSIONLESS, scale: 1 },
};

export function unitDescriptor(unit: EngineeringUnit): UnitDescriptor {
  return DESCRIPTORS[unit];
}

export function sameDimension(left: QuantityDimension, right: QuantityDimension): boolean {
  return left.voltage === right.voltage && left.current === right.current && left.time === right.time;
}

export function multiplyDimensions(left: QuantityDimension, right: QuantityDimension): QuantityDimension {
  return { voltage: left.voltage + right.voltage, current: left.current + right.current, time: left.time + right.time };
}

export function divideDimensions(left: QuantityDimension, right: QuantityDimension): QuantityDimension {
  return { voltage: left.voltage - right.voltage, current: left.current - right.current, time: left.time - right.time };
}

export function powerDimension(dimension: QuantityDimension, exponent: number): QuantityDimension {
  return { voltage: dimension.voltage * exponent, current: dimension.current * exponent, time: dimension.time * exponent };
}

export function canonicalUnit(dimension: QuantityDimension, preferred?: UnitSymbol): UnitSymbol {
  if (preferred && preferred !== "" && preferred !== "1") return preferred;
  if (sameDimension(dimension, DIMENSIONLESS)) return "1";
  if (sameDimension(dimension, VOLTAGE_DIMENSION)) return "V";
  if (sameDimension(dimension, CURRENT_DIMENSION)) return "A";
  if (sameDimension(dimension, POWER_DIMENSION)) return "W";
  if (sameDimension(dimension, TIME_DIMENSION)) return "s";
  if (sameDimension(dimension, FREQUENCY_DIMENSION)) return "Hz";
  if (sameDimension(dimension, DESCRIPTORS.Ohm.dimension)) return "Ohm";
  const pieces: string[] = [];
  for (const [symbol, exponent] of [["V", dimension.voltage], ["A", dimension.current], ["s", dimension.time]] as const) {
    if (exponent === 0) continue;
    pieces.push(exponent === 1 ? symbol : `${symbol}^${canonicalNumber(exponent)}`);
  }
  return pieces.join("*") || "1";
}

export function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Numeric values must be finite");
  if (Object.is(value, -0)) return "0";
  return Number(value.toPrecision(15)).toString();
}

const PREFIXES: Readonly<Record<string, number>> = {
  f: 1e-15,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  "µ": 1e-6,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

const UNIT_ALIASES: Readonly<Record<string, EngineeringUnit>> = {
  "": "1",
  V: "V",
  A: "A",
  W: "W",
  s: "s",
  Hz: "Hz",
  Ohm: "Ohm",
  ohm: "Ohm",
  "Ω": "Ohm",
  rad: "rad",
  deg: "deg",
  dB: "dB",
};

export interface ParsedEngineeringLiteral { value: number; unit: EngineeringUnit }

export function parseEngineeringLiteral(source: string): ParsedEngineeringLiteral | undefined {
  const matched = source.match(/^((?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(.*)$/);
  if (!matched) return undefined;
  const numeric = Number(matched[1]);
  if (!Number.isFinite(numeric)) return undefined;
  const suffix = matched[2] ?? "";
  let prefix = "";
  let unitText = suffix;
  if (suffix.length > 0 && Object.hasOwn(PREFIXES, suffix[0]!)) {
    prefix = suffix[0]!;
    unitText = suffix.slice(1);
  }
  const unit = UNIT_ALIASES[unitText];
  if (!unit) return undefined;
  const factor = prefix ? PREFIXES[prefix] : 1;
  if (factor === undefined) return undefined;
  return { value: numeric * factor, unit };
}
