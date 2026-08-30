type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot export a non-finite number");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(source).sort((a, b) => a.localeCompare(b))) {
      if (source[key] !== undefined) result[key] = canonicalValue(source[key]);
    }
    return result;
  }
  throw new Error(`Cannot export ${typeof value} in design JSON`);
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}
