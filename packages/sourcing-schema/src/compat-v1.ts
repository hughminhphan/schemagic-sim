import type { DistributorOffer } from "./offer";
import { validateDistributorOffer, type ValidationIssue } from "./validation";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Explicit V1 standalone-offer assertion added for the compatibility release. */
export function assertValidDistributorOfferV1(input: unknown): asserts input is DistributorOffer {
  const issue = validateDistributorOffer(input)[0];
  if (issue) throw new Error(`${issue.path || "offer"}: ${issue.message}`);
}

/** Explicit V1 standalone-offer parser; the unsuffixed validator remains frozen. */
export function parseDistributorOfferV1(input: unknown): DistributorOffer {
  assertValidDistributorOfferV1(input);
  return cloneJson(input);
}

export function validateDistributorOfferV1(input: unknown): ValidationIssue[] {
  return validateDistributorOffer(input);
}
