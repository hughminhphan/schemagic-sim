import type { CircuitDocumentV2, Sha256ContentHash } from "@opencircuit/circuit-schema";
import type { DesignProfileEnvelope } from "@opencircuit/design-library/v2-runtime";
import type {
  CandidateIdV2, CandidateMetricV2, CandidateMetricsV2, CircuitBomNonRepresentationV2,
  CircuitInstanceClassificationV2, ConstraintResult, DerivedValue, DesignApplication,
  ElectricalDesignRequestV2, SelectedComponent, SimulationCoverageV2,
} from "@opencircuit/design-schema";

export interface NativeRecipeRefV2 {
  id: string;
  version: string;
  contentHash: Sha256ContentHash;
  applications: DesignApplication[];
  metricDeclarations: Array<{ id: string; unit: "A" | "count" | "m2" }>;
}

export interface NativeCatalogV2 {
  profiles: DesignProfileEnvelope[];
}

export interface NativeEnvironmentV2 {
  request: Readonly<ElectricalDesignRequestV2>;
  catalog: Readonly<NativeCatalogV2>;
  manifest: Readonly<object>;
}

export interface NativeSolvedOptionV2 { data: Record<string, null | boolean | number | string>; derivedValues: DerivedValue[] }
export interface NativeMatchedOptionV2 extends NativeSolvedOptionV2 {
  components: SelectedComponent[];
  simulationCoverage: SimulationCoverageV2[];
  warnings: string[];
}
export type NativeOutcomeV2<T> = { status: "ok"; value: T } | { status: "rejected"; reason: string; constraints?: ConstraintResult[]; componentProfileIds?: string[] };
export interface NativeCandidateV2 {
  id: CandidateIdV2;
  recipeId: string;
  libraryVersion: string;
  data: Record<string, null | boolean | number | string>;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetricsV2;
  simulationCoverage: SimulationCoverageV2[];
  warnings: string[];
}
export interface NativeMaterializationV2 {
  circuit: CircuitDocumentV2;
  circuitInstanceClassifications: CircuitInstanceClassificationV2[];
  circuitBomNonRepresentations: CircuitBomNonRepresentationV2[];
}

export interface NativeRecipeV2 extends NativeRecipeRefV2 {
  supports(request: Readonly<ElectricalDesignRequestV2>): boolean;
  enumerate(environment: NativeEnvironmentV2): Array<{ optionKey: string; data: Record<string, null | boolean | number | string> }>;
  solve(option: Readonly<{ data: Record<string, null | boolean | number | string> }>, environment: NativeEnvironmentV2): NativeOutcomeV2<NativeSolvedOptionV2>;
  match(option: Readonly<NativeSolvedOptionV2>, environment: NativeEnvironmentV2): Array<NativeOutcomeV2<NativeMatchedOptionV2>>;
  check(option: Readonly<NativeMatchedOptionV2>, environment: NativeEnvironmentV2): ConstraintResult[];
  estimate(option: Readonly<NativeMatchedOptionV2>, constraints: readonly ConstraintResult[], environment: NativeEnvironmentV2): { metrics: CandidateMetricV2[]; warnings: string[] };
  materialize(candidate: Readonly<NativeCandidateV2>, environment: NativeEnvironmentV2): NativeMaterializationV2;
}
