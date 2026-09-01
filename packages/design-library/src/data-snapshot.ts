export class DescriptorSafeJsonSnapshotError extends Error {
  constructor(readonly path: string) {
    super(path);
  }
}

/** Internal additive-boundary capture. It never invokes input accessors. */
export function descriptorSafeJsonSnapshot(input: unknown): unknown {
  const active = new Set<object>();
  const visit = (value: unknown, path: string): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new DescriptorSafeJsonSnapshotError(path);
      return value;
    }
    if (typeof value !== "object" || active.has(value)) throw new DescriptorSafeJsonSnapshotError(path);
    active.add(value);
    let descriptors: PropertyDescriptorMap;
    let prototype: object | null;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
      prototype = Object.getPrototypeOf(value);
    } catch {
      throw new DescriptorSafeJsonSnapshotError(path);
    }
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== "string")) throw new DescriptorSafeJsonSnapshotError(path);
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) throw new DescriptorSafeJsonSnapshotError(path);
      const lengthDescriptor = descriptors.length;
      if (
        !lengthDescriptor
        || !("value" in lengthDescriptor)
        || !Number.isSafeInteger(lengthDescriptor.value)
        || lengthDescriptor.value < 0
      ) throw new DescriptorSafeJsonSnapshotError(path);
      const length = lengthDescriptor.value as number;
      const result: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
          throw new DescriptorSafeJsonSnapshotError(`${path}.${index}`);
        }
        result.push(visit(descriptor.value, `${path}.${index}`));
      }
      if (keys.some((key) => (
        key !== "length"
        && (!/^(?:0|[1-9][0-9]*)$/.test(key as string) || Number(key) >= length)
      ))) throw new DescriptorSafeJsonSnapshotError(path);
      active.delete(value);
      return result;
    }
    if (prototype !== Object.prototype && prototype !== null) throw new DescriptorSafeJsonSnapshotError(path);
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of (keys as string[]).sort()) {
      const descriptor = descriptors[key]!;
      if (!("value" in descriptor) || descriptor.enumerable !== true) {
        throw new DescriptorSafeJsonSnapshotError(path ? `${path}.${key}` : key);
      }
      result[key] = visit(descriptor.value, path ? `${path}.${key}` : key);
    }
    active.delete(value);
    return result;
  };
  return visit(input, "");
}
