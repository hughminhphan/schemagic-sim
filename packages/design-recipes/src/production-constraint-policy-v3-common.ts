import {
  calculateConstraintPolicyCatalogV3ContentHash,
  parseConstraintPolicyCatalogV3,
  type ConstraintCriticalityV3,
  type ConstraintPolicyCatalogV3,
  type ConstraintPolicyRuleV3,
} from "@opencircuit/design-schema";

export const PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY =
  "These catalogs cover normal-path check rules for retained candidates. Solve, match, and missing-profile fallback rules execute before retention and are deliberately excluded." as const;

export function productionConstraintPolicyRuleV3(
  ruleId: string,
  criticality: ConstraintCriticalityV3,
  presence: ConstraintPolicyRuleV3["presence"],
  rationale: string,
): ConstraintPolicyRuleV3 {
  return { ruleId, criticality, presence, rationale };
}

export function createProductionConstraintPolicyCatalogV3(
  payload: Omit<ConstraintPolicyCatalogV3, "contentHash">,
): ConstraintPolicyCatalogV3 {
  return parseConstraintPolicyCatalogV3({
    ...payload,
    contentHash: calculateConstraintPolicyCatalogV3ContentHash(payload),
  });
}
