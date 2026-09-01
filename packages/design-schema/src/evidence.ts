export type EvidenceState = "authored_rule" | "calculated" | "estimated" | "reviewed" | "unknown";

export interface EvidenceRef {
  sourceId: string;
  locator: string;
  retrievedAt?: string;
  contentHash?: string;
  licenseNote: string;
}

export interface EvidenceValue<T> {
  value: T | null;
  state: EvidenceState;
  evidence: EvidenceRef[];
  explanation: string;
}
