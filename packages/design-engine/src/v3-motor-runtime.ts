import {
  MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY,
} from "@opencircuit/design-recipes/motor-constraint-policy-engine-internal";
import {
  detachedFrozenDesignV2Value,
  type ConstraintDecisionV3,
  type ConstraintPolicyCatalogV3,
  type DesignResultV2,
  type PrimaryPartCustomizationSidecarV1,
} from "@opencircuit/design-schema";
import { evaluatePrimaryPartCustomizationV1 } from "./v2-generate";
import {
  assertPrimaryPartCustomizedResultV1,
  generatePrimaryPartCustomizedResultV1,
} from "./v2-generate";
import type {
  DesignGenerationV2,
  ElectricalDesignContextManifestV2,
  GenerateElectricalContextV2,
  PrimaryPartCustomizationObservationV1,
} from "./v2-types";
import type { PrimaryPartCustomizedResultSidecarV1 } from "@opencircuit/design-schema";
import {
  assertConstraintDecisionContextV3,
  evaluateConstraintDecisionV3,
} from "./v3-constraint-sidecar";

export { ConstraintDecisionEvaluationErrorV3 } from "./v3-constraint-sidecar";

export const MOTOR_PRODUCTION_CONSTRAINT_POLICY_V3_SCOPE_BOUNDARY =
  PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY;

export function getInstalledMotorConstraintPolicyCatalogV3(): Readonly<ConstraintPolicyCatalogV3> {
  return detachedFrozenDesignV2Value(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3);
}

/**
 * Evaluates primary-part customization with the exact installed Motor policy.
 *
 * @internal The policy is installed, but `context` is caller-supplied. This
 * function does not authorize that context as the installed application
 * context and does not grant the observation any application authority.
 */
export function evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1(
  instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
  context: Readonly<GenerateElectricalContextV2>,
): PrimaryPartCustomizationObservationV1 {
  return evaluatePrimaryPartCustomizationV1(
    instruction,
    sourceGeneration,
    context,
    MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  );
}

/**
 * Generates a customization result with the exact installed Motor policy.
 *
 * @internal The policy is installed, but `context` is caller-supplied. This
 * function does not authorize that context as the installed application
 * context and does not grant the returned result any application authority.
 */
export function generateMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(
  instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
  context: Readonly<GenerateElectricalContextV2>,
): PrimaryPartCustomizedResultSidecarV1 {
  return generatePrimaryPartCustomizedResultV1(
    instruction,
    sourceGeneration,
    context,
    MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  );
}

/**
 * Re-evaluates a customization result with the exact installed Motor policy.
 *
 * @internal The policy is installed, but `context` is caller-supplied. A
 * successful assertion is not installed-context or application authorization.
 */
export function assertMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(
  sidecar: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
  context: Readonly<GenerateElectricalContextV2>,
): PrimaryPartCustomizedResultSidecarV1 {
  return assertPrimaryPartCustomizedResultV1(
    sidecar,
    sourceGeneration,
    context,
    MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  );
}

/**
 * Evaluates a constraint decision with the exact installed Motor policy.
 *
 * @internal The policy is installed, but `context` is caller-supplied. This
 * function does not authorize that context as the installed application
 * context and does not grant the decision any application authority.
 */
export function evaluateMotorConstraintDecisionWithInstalledPolicyV3(
  source: Readonly<DesignResultV2>,
  context: Readonly<ElectricalDesignContextManifestV2>,
): ConstraintDecisionV3 {
  return evaluateConstraintDecisionV3(source, context, MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3);
}

/**
 * Re-evaluates a constraint decision with the exact installed Motor policy.
 *
 * @internal The policy is installed, but `context` is caller-supplied. A
 * successful assertion is not installed-context or application authorization.
 */
export function assertMotorConstraintDecisionContextWithInstalledPolicyV3(
  decision: Readonly<ConstraintDecisionV3>,
  source: Readonly<DesignResultV2>,
  context: Readonly<ElectricalDesignContextManifestV2>,
): ConstraintDecisionV3 {
  return assertConstraintDecisionContextV3(
    decision,
    source,
    context,
    MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  );
}
