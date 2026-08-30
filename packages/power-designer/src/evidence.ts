import type { EvidenceRef } from "@opencircuit/design-schema";

export const SYNTHETIC_CATALOG_EVIDENCE: EvidenceRef = {
  sourceId: "schemagic.power.synthetic-test-catalog",
  locator: "packages/power-designer/src/catalog.ts",
  licenseNote: "Authored synthetic test data; not a real manufacturer datasheet or reviewed production part.",
};

export const BUCK_EQUATION_EVIDENCE: EvidenceRef = {
  sourceId: "schemagic.power.buck-equations-v1",
  locator: "packages/power-designer/src/equations.ts",
  licenseNote: "Project-authored deterministic sizing and estimate rules for test-fixture validation.",
};

export const B1_PLACEHOLDER_EVIDENCE: EvidenceRef = {
  sourceId: "schemagic.power.track-b1-boundary",
  locator: "Track B1 analytic-only boundary",
  licenseNote: "Project-authored implementation boundary; full circuit materialization and simulation are deferred to Track B2.",
};

export const B2_BEHAVIORAL_CIRCUIT_EVIDENCE: EvidenceRef = {
  sourceId: "schemagic.power.track-b2-behavioral-circuit",
  locator: "packages/power-designer/src/circuit.ts",
  licenseNote: "Project-authored connected behavioral power stage; not a reviewed regulator/controller or MOSFET simulation model.",
};

export function profileEvidence(profileId: string): EvidenceRef[] {
  return [{ ...SYNTHETIC_CATALOG_EVIDENCE, locator: `synthetic-profile:${profileId}` }];
}
