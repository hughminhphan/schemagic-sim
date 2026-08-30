import type { EvidenceRef } from "./evidence";
import type { Quantity } from "./quantity";

export type ConstraintStatus = "fail" | "pass" | "unknown" | "warning";

export interface ConstraintResult {
  ruleId: string;
  status: ConstraintStatus;
  actual?: Quantity;
  limit?: Quantity;
  margin?: Quantity;
  explanation: string;
  evidence: EvidenceRef[];
}
