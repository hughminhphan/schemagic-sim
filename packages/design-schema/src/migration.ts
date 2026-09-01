import { fnv1a64 } from "@opencircuit/circuit-schema";
import { DESIGN_REQUEST_FORMAT, DESIGN_REQUEST_SCHEMA_VERSION, type DesignRequest } from "./request";
import { assertValidDesignRequest } from "./validation";

export interface DesignRequestMigration<From = unknown, To = unknown> {
  fromVersion: number;
  toVersion: number;
  migrate: (input: From) => To;
}

export const DESIGN_REQUEST_MIGRATIONS: readonly DesignRequestMigration[] = [];

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Design requests cannot contain non-finite numbers");
  return Number(value.toPrecision(12));
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === "number") return roundNumber(value);
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .filter((key) => object[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(object[key])]),
    );
  }
  return value;
}

export function migrateDesignRequest(input: unknown): DesignRequest {
  const value = input as { format?: unknown; schemaVersion?: unknown };
  if (value?.format !== DESIGN_REQUEST_FORMAT) throw new Error("Not a scheMAGIC Designer request");
  if (value.schemaVersion !== DESIGN_REQUEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported scheMAGIC Designer request version ${String(value.schemaVersion)}`);
  }
  assertValidDesignRequest(input);
  return input;
}

export function serializeDesignRequest(request: DesignRequest): string {
  assertValidDesignRequest(request);
  return JSON.stringify(canonicalValue(request));
}

export function deserializeDesignRequest(source: string): DesignRequest {
  return migrateDesignRequest(JSON.parse(source));
}

export function designRequestHash(request: DesignRequest): string {
  return fnv1a64(serializeDesignRequest(request));
}
