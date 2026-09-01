import { REVIEWED_REAL_MOTOR_CATALOG } from "./catalog";
import { buildReviewedRealCatalogReport } from "./report";
import { assertValidReviewedRealMotorCatalog } from "./validation";

assertValidReviewedRealMotorCatalog(REVIEWED_REAL_MOTOR_CATALOG);

export const REVIEWED_REAL_MOTOR_CATALOG_REPORT = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG);

export {
  REVIEWED_REAL_LICENSE_NOTE,
  REVIEWED_REAL_MOTOR_CATALOG,
  REVIEWED_REAL_RETRIEVED_AT,
} from "./catalog";
export { buildReviewedRealCatalogReport } from "./report";
export {
  REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS,
  buildReviewedRealMotorFactsV2CandidateProfilePlans,
} from "./facts-v2-candidate-plans";
export {
  REVIEWED_REAL_MOTOR_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT,
  buildReviewedRealMotorFactsV2DraftAuthoringAssessment,
} from "./facts-v2-authoring-assessment";
export { assertValidReviewedRealMotorCatalog, validateReviewedRealMotorCatalog } from "./validation";
export { REVIEWED_REAL_MANUFACTURER_ALLOWLIST } from "./manufacturer-allowlist";
export {
  GATE_DRIVER_FACT_IDS,
  INTEGRATED_BRIDGE_FACT_IDS,
  type GateDriverFactId,
  type IntegratedBridgeFactId,
  type MotorFactsV2CandidateProfilePlan,
  type MotorFactsV2AuthoringGap,
  type MotorFactsV2AuthoringGapCategory,
  type MotorFactsV2DraftAuthoringAssessment,
  type MotorFactsV2ExactByteEvidenceBinding,
  type MotorFactsV2MandatoryEvidenceCandidate,
  type MotorFactsV2MandatoryEvidenceEntry,
  type MotorFactsV2MandatoryEvidenceStatus,
  type MotorFactsV2ProfileAuthoringAssessment,
  type ReviewedFact,
  type ReviewedGateDriverProfile,
  type ReviewedIntegratedBridgeProfile,
  type ReviewedManufacturer,
  type ReviewedPackageFacts,
  type ReviewedProfileStatus,
  type ReviewedRealMotorCatalog,
  type ReviewedRealMotorProfile,
} from "./types";
export type { ReviewedProfileCoverage, ReviewedRealCatalogReport } from "./report";
