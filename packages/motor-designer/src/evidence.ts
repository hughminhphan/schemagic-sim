import type { EvidenceRef } from "@opencircuit/design-schema";

export const AUTHORED_MOTOR_RULE_EVIDENCE: EvidenceRef = {
  sourceId: "schemagic:motor-designer:authored-rules-v1",
  locator: "Track A1 deterministic equation and constraint implementation",
  licenseNote: "Original scheMAGIC implementation licensed under Apache-2.0",
};

export function syntheticProfileEvidence(profileId: string): EvidenceRef[] {
  return [{
    sourceId: `synthetic:${profileId}`,
    locator: "Synthetic M1/M2 test-fixture value; not a real manufacturer datasheet fact",
    licenseNote: "Original synthetic test data licensed under Apache-2.0; not an orderable part claim",
  }];
}

export function requestEvidence(locator: string): EvidenceRef[] {
  return [{
    sourceId: "schemagic:design-request",
    locator,
    licenseNote: "User or fixture supplied design input",
  }];
}

export function combinedEvidence(...groups: readonly EvidenceRef[][]): EvidenceRef[] {
  const byKey = new Map<string, EvidenceRef>();
  for (const evidence of groups.flat()) {
    byKey.set(`${evidence.sourceId}\u0000${evidence.locator}`, evidence);
  }
  return [...byKey.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.locator.localeCompare(right.locator));
}
