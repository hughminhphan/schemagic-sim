import {
  isDistributorId,
  isManufacturerId,
  type DistributorId,
  type ManufacturerPartIdentity,
} from "@opencircuit/sourcing-schema";

export const SOURCING_LOOKUP_REQUEST_SCHEMA_VERSION = 1 as const;

export interface SourcingLookupRequest {
  schemaVersion: typeof SOURCING_LOOKUP_REQUEST_SCHEMA_VERSION;
  provider: DistributorId;
  parts: ManufacturerPartIdentity[];
  region: string;
  currency: string;
}

export interface LookupRequestIssue {
  path: string;
  message: string;
}

const REQUEST_KEYS = ["schemaVersion", "provider", "parts", "region", "currency"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function identityKey(part: ManufacturerPartIdentity): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

function unknownKeys(input: Record<string, unknown>, allowed: readonly string[], path = ""): LookupRequestIssue[] {
  return Object.keys(input)
    .filter((key) => !allowed.includes(key))
    .map((key) => ({ path: path ? `${path}.${key}` : key, message: "Unknown key" }));
}

export function validateSourcingLookupRequest(input: unknown): LookupRequestIssue[] {
  if (!isRecord(input)) return [{ path: "", message: "Lookup request must be an object" }];
  const issues = unknownKeys(input, REQUEST_KEYS);
  if (input.schemaVersion !== SOURCING_LOOKUP_REQUEST_SCHEMA_VERSION) issues.push({ path: "schemaVersion", message: "Must equal 1" });
  if (!isDistributorId(input.provider)) issues.push({ path: "provider", message: "Must be a stable distributor registry ID" });
  if (typeof input.region !== "string" || input.region.trim() === "") issues.push({ path: "region", message: "Must be a non-empty region" });
  if (typeof input.currency !== "string" || !CURRENCY_PATTERN.test(input.currency)) issues.push({ path: "currency", message: "Must be a three-letter uppercase currency code" });
  if (!Array.isArray(input.parts) || input.parts.length === 0) {
    issues.push({ path: "parts", message: "Must contain at least one exact manufacturer identity" });
  } else {
    const identities = new Set<string>();
    input.parts.forEach((part, index) => {
      const path = `parts.${index}`;
      if (!isRecord(part)) {
        issues.push({ path, message: "Part identity must be an object" });
        return;
      }
      issues.push(...unknownKeys(part, PART_KEYS, path));
      if (!isManufacturerId(part.manufacturerId)) issues.push({ path: `${path}.manufacturerId`, message: "Must be a stable manufacturer registry ID" });
      if (typeof part.manufacturerPartNumber !== "string" || part.manufacturerPartNumber.trim() === "") issues.push({ path: `${path}.manufacturerPartNumber`, message: "Must be an exact non-empty MPN" });
      if (isManufacturerId(part.manufacturerId) && typeof part.manufacturerPartNumber === "string") {
        const key = `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
        if (identities.has(key)) issues.push({ path, message: "Duplicate exact manufacturer identity" });
        identities.add(key);
      }
    });
  }
  return issues;
}

export function parseSourcingLookupRequest(input: unknown): SourcingLookupRequest {
  const issue = validateSourcingLookupRequest(input)[0];
  if (issue !== undefined) throw new Error(`${issue.path || "request"}: ${issue.message}`);
  const request = structuredClone(input) as SourcingLookupRequest;
  request.parts.sort((left, right) => compareText(identityKey(left), identityKey(right)));
  return request;
}
