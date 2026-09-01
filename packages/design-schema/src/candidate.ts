import type { CircuitDocument } from "@opencircuit/circuit-schema";
import type { CandidateSourcingMetrics, ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";
import type { ConstraintResult } from "./constraint";
import type { EvidenceRef, EvidenceState } from "./evidence";
import type { Quantity } from "./quantity";
import type { DesignRequest } from "./request";

export interface SelectedComponent {
  id: string;
  role: string;
  profileId: string;
  part: ManufacturerPartIdentity;
  quantityPerAssembly: number;
  value?: Quantity;
  evidence: EvidenceRef[];
}

export interface DerivedValue {
  id: string;
  value: Quantity;
  equationId: string;
  state: Extract<EvidenceState, "calculated" | "estimated">;
  evidence: EvidenceRef[];
}

export interface CandidateMetric {
  id: string;
  value: Quantity | null;
  state: EvidenceState | "simulated";
  explanation: string;
  evidence: EvidenceRef[];
}

export interface CandidateMetrics {
  values: CandidateMetric[];
  warningCount: number;
  estimateCount: number;
  unknownCount: number;
}

export type SimulationModelTier = "behavioral" | "reviewed" | "unavailable" | "user_imported";

export interface SimulationCoverage {
  scenarioId: string;
  modelTier: SimulationModelTier;
  limitations: string[];
}

export interface DesignCandidate {
  schemaVersion: 1;
  id: string;
  requestHash: string;
  recipeId: string;
  libraryVersion: string;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetrics;
  sourcing?: CandidateSourcingMetrics;
  simulationCoverage: SimulationCoverage[];
  circuit: CircuitDocument;
  warnings: string[];
}

export interface RejectedCandidate {
  recipeId: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
}

export interface DesignResult {
  format: "schemagic-design-result";
  schemaVersion: 1;
  request: DesignRequest;
  requestHash: string;
  libraryVersion: string;
  libraryContentHash: string;
  candidates: DesignCandidate[];
  rejectedCandidates: RejectedCandidate[];
  diagnostics: string[];
}

/** Explicit persisted v1 aliases. The unsuffixed contracts remain v1. */
export type DesignCandidateV1 = DesignCandidate;
export type DesignResultV1 = DesignResult;
