export const ENGINEERING_LITERAL_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+|[TtGgKk]|[Mm][Ee][Gg]|[munpf])?$/;
export const ASCII_DECIMAL_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
export const SPICE_NODE_TOKEN_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/;

export function hasForbiddenControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

export function engineeringValueNumber(value: number | string): number {
  if (typeof value === "number") return value;
  const match = /^([+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+)))(?:([eE][+-]?\d+)|([TtGgKk]|[Mm][Ee][Gg]|[munpf]))?$/.exec(value);
  if (!match) return Number.NaN;
  if (match[2]) return Number(`${match[1]}${match[2]}`);
  const suffix = match[3] ?? "";
  const factors: Record<string, number> = {
    "": 1, T: 1e12, t: 1e12, G: 1e9, g: 1e9, K: 1e3, k: 1e3,
    M: 1e-3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
  };
  const factor = /^meg$/i.test(suffix) ? 1e6 : factors[suffix];
  return Number(match[1]) * (factor ?? Number.NaN);
}

export function isSafeEngineeringValue(value: unknown): value is number | string {
  return typeof value === "number"
    ? Number.isFinite(value)
    : typeof value === "string"
      && !hasForbiddenControl(value)
      && ENGINEERING_LITERAL_PATTERN.test(value)
      && Number.isFinite(engineeringValueNumber(value));
}

export function isSafeDecimalValue(value: unknown): value is number | string {
  return typeof value === "number"
    ? Number.isFinite(value)
    : typeof value === "string" && !hasForbiddenControl(value) && ASCII_DECIMAL_PATTERN.test(value) && Number.isFinite(Number(value));
}
