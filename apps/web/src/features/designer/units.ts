import type { SIUnit } from "@opencircuit/design-schema";

const PREFIX_FACTORS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  "µ": 1e-6,
  u: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  M: 1e6,
  G: 1e9,
};

export interface UnitConversion {
  fromCanonical(value: number): number;
  toCanonical(value: number): number;
}

export function unitConversion(canonical: SIUnit, display: string): UnitConversion {
  if (canonical === "K" && display === "°C") {
    return {
      fromCanonical: (value) => value - 273.15,
      toCanonical: (value) => value + 273.15,
    };
  }
  let factor = 1;
  if (canonical === "1" && display === "%") factor = 0.01;
  else if (canonical === "m2" && display === "mm²") factor = 1e-6;
  else if (canonical !== "m2") {
    const normalized = display.replace("Ω", "ohm").replace("µ", "u");
    const suffix = canonical === "ohm" ? "ohm" : canonical;
    if (normalized.endsWith(suffix)) {
      const prefix = normalized.slice(0, -suffix.length).replace("u", "µ");
      factor = PREFIX_FACTORS[prefix] ?? 1;
    }
  }
  return {
    fromCanonical: (value) => value / factor,
    toCanonical: (value) => value * factor,
  };
}
