import { generateScenarioNetlist, validateCircuitV4 } from "@opencircuit/circuit-schema";
import type {
  DesignGenerationV2,
  GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-motor-runtime";
import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  migrateDesignRequestV1ToV2,
  parseElectricalDesignRequestV3,
  type BrushedDcMotorDesignRequestV2,
  type BrushedDcMotorDesignRequestV3,
  type BuckDesignRequest,
  type BuckDesignRequestV2,
  type BuckDesignRequestV3,
  type ConstraintDecisionV3,
  type DesignCandidateV2,
} from "@opencircuit/design-schema";
import { M1_COMPACT_REQUEST } from "@opencircuit/motor-designer/fixtures";
import {
  generateMotorDesignV2,
  getMotorDesignContextManifestV2,
  getMotorDesignContextV2,
} from "@opencircuit/motor-designer/v2";
import { generateMotorConstraintObservationV3 } from "@opencircuit/motor-designer/v3";
import { createP1CompactRequest } from "@opencircuit/power-designer/fixtures";
import {
  generateBuckDesignV2,
  getPowerDesignContextManifestV2,
  getPowerDesignContextV2,
} from "@opencircuit/power-designer/v2";
import { generateBuckConstraintObservationV3 } from "@opencircuit/power-designer/v3";
import { describe, expect, it } from "vitest";
import {
  exportProductionDesignArtifactV2,
  verifyProductionConstraintObservationArtifactV1,
} from "../src/production-artifact-v2";

function motorRequest(): {
  strict: BrushedDcMotorDesignRequestV2;
  observation: BrushedDcMotorDesignRequestV3;
} {
  const migrated = migrateDesignRequestV1ToV2(
    M1_COMPACT_REQUEST,
    getMotorDesignContextManifestV2().version,
  );
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") {
    throw new Error("Expected the known compact Motor request to migrate to V2");
  }
  const {
    allowUnknownWarnings: _allowUnknownWarnings,
    allowUnknownHardConstraints: _allowUnknownHardConstraints,
    ...constraints
  } = migrated.request.constraints;
  const observation = parseElectricalDesignRequestV3({
    ...migrated.request,
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    constraints,
  });
  if (observation.application !== "motor.brushed-dc") throw new Error("Expected Motor V3");
  return { strict: migrated.request, observation };
}

function powerRequest(): {
  strict: BuckDesignRequestV2;
  observation: BuckDesignRequestV3;
} {
  const source: BuckDesignRequest = createP1CompactRequest();
  source.requirements.inputVoltage.minimum.value = 12;
  source.requirements.inputVoltage.maximum.value = 12;
  source.requirements.maximumOutputCurrent.value = 0.2;
  source.requirements.ambientTemperature.value = 298.15;
  source.requirements.switchingFrequency.minimum.value = 250_000;
  source.requirements.switchingFrequency.maximum.value = 600_000;
  source.requirements.dcOutputVoltageRegulation = {
    minimum: { value: 4.7, unit: "V", displayUnit: "V" },
    maximum: { value: 5.3, unit: "V", displayUnit: "V" },
  };
  const migrated = migrateDesignRequestV1ToV2(
    source,
    getPowerDesignContextManifestV2().version,
  );
  if (migrated.status !== "migrated" || migrated.request.application !== "power.buck") {
    throw new Error("Expected the known compact Power request to migrate to V2");
  }
  const {
    allowUnknownWarnings: _allowUnknownWarnings,
    allowUnknownHardConstraints: _allowUnknownHardConstraints,
    ...constraints
  } = migrated.request.constraints;
  const observation = parseElectricalDesignRequestV3({
    ...migrated.request,
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    constraints,
  });
  if (observation.application !== "power.buck") throw new Error("Expected Power V3");
  return { strict: migrated.request, observation };
}

function expectReferenceFlow(
  generation: Readonly<DesignGenerationV2>,
  decision: Readonly<ConstraintDecisionV3>,
  context: Readonly<GenerateElectricalContextV2>,
  scenarioId: string,
  unavailableCoverageId: string,
): { candidate: DesignCandidateV2; netlist: string } {
  expect(generation.result.candidates).toHaveLength(1);
  expect(decision.eligibleCandidateIds).toEqual([]);
  expect(generation.execution.counts.pareto).toBe(1);
  expect(generation.execution.counts.deduped).toBeGreaterThanOrEqual(1);
  expect(generation.execution.counts.materialized).toBeGreaterThanOrEqual(1);
  const candidate = generation.result.candidates[0]!;
  const candidateDecision = decision.candidates.find((entry) => entry.candidateId === candidate.id);
  expect(candidateDecision).toMatchObject({ eligible: false, recipeId: candidate.recipeId });
  expect(candidateDecision?.rules.some((rule) => rule.disposition === "blocked_unknown")).toBe(true);
  expect(candidateDecision?.recipeContentHash).toBe(
    context.manifest.recipes.find((entry) => entry.id === candidate.recipeId)?.contentHash,
  );

  expect(validateCircuitV4(candidate.circuit)).toEqual([]);
  const assembly = candidate.circuit.circuits.find((entry) => entry.id === "assembly");
  expect(assembly?.components.length).toBeGreaterThan(0);
  expect(assembly?.wires.length).toBeGreaterThan(0);
  expect(candidate.circuitInstanceClassifications.filter((entry) => (
    entry.circuitId === "assembly" && entry.kind === "physical"
  )).length).toBeGreaterThanOrEqual(candidate.components.length);
  expect(candidate.simulationCoverage).toContainEqual(expect.objectContaining({
    scenarioId,
    modelTier: "behavioral",
  }));
  expect(candidate.simulationCoverage).toContainEqual(expect.objectContaining({
    scenarioId: unavailableCoverageId,
    modelTier: "unavailable",
  }));
  const generated = generateScenarioNetlist(candidate.circuit, scenarioId);
  expect(generated.omissions).toEqual([]);

  const artifact = exportProductionDesignArtifactV2(
    generation.result,
    candidate.id,
    "electrical_bom_csv",
    { engineeringContext: context, constraintDecision: decision },
  );
  expect(exportProductionDesignArtifactV2(
    generation.result,
    candidate.id,
    "electrical_bom_csv",
    { engineeringContext: context, constraintDecision: decision },
  )).toEqual(artifact);
  expect(candidate.components.length).toBeGreaterThan(0);
  for (const component of candidate.components) {
    expect(artifact.content).toContain(component.part.manufacturerPartNumber);
  }
  expect(artifact.content).toContain("observation_only,ineligible");
  expect(verifyProductionConstraintObservationArtifactV1(
    artifact,
    generation.result,
    candidate.id,
    context,
    decision,
  )).toMatchObject({
    provenance: { constraintDecision: { eligible: false } },
    claimBoundary: {
      purpose: "production_constraint_observation",
      simulationData: "not_included",
      commercialAuthority: "not_added",
    },
  });
  return { candidate, netlist: generated.netlist };
}

describe("known production-reference generation flows", () => {
  it("completes Motor while strict selection remains empty", () => {
    const request = motorRequest();
    const strict = generateMotorDesignV2(request.strict);
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.rejections.some((entry) => (
      entry.reasonCode === "unknown_constraint_disallowed"
    ))).toBe(true);

    const first = generateMotorConstraintObservationV3(request.observation);
    expect(generateMotorConstraintObservationV3(structuredClone(request.observation))).toEqual(first);
    const { candidate, netlist } = expectReferenceFlow(
      first.observation,
      first.decision,
      getMotorDesignContextV2(),
      "pwm_loaded_steady_state",
      "selected_part_model",
    );
    expect(candidate.metrics.values.map((entry) => entry.id)).toEqual([
      "motor.native.board-area",
      "motor.native.component-count",
    ]);
    expect(candidate.metrics.values.every((entry) => (
      entry.state === "calculated" && entry.value !== null && Number.isFinite(entry.value.value)
    ))).toBe(true);
    expect(candidate.circuit.circuits.find((entry) => (
      entry.id === "behavioral-operating-point"
    ))?.probes).toHaveLength(3);
    expect(netlist).toContain(".op");
  }, 60_000);

  it("completes Power with estimated chart values while strict selection remains empty", () => {
    const request = powerRequest();
    const strict = generateBuckDesignV2(request.strict);
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.rejections).toEqual([
      expect.objectContaining({ reasonCode: "unknown_constraint_disallowed" }),
    ]);

    const first = generateBuckConstraintObservationV3(request.observation);
    expect(generateBuckConstraintObservationV3(structuredClone(request.observation))).toEqual(first);
    const { candidate, netlist } = expectReferenceFlow(
      first.observation,
      first.decision,
      getPowerDesignContextV2(),
      "ideal_pwm_output_stage_transient",
      "catalog-native-model",
    );
    const operatingMetrics = candidate.metrics.values.filter((entry) => (
      entry.id.startsWith("power.passive.")
    ));
    expect(operatingMetrics).toHaveLength(4);
    expect(operatingMetrics.every((entry) => (
      entry.state === "estimated"
      && entry.value?.unit === "A"
      && Number.isFinite(entry.value.value)
    ))).toBe(true);
    expect(candidate.circuit.circuits.find((entry) => (
      entry.id === "ideal_pwm_output_stage"
    ))?.probes).toHaveLength(1);
    expect(netlist).toContain(".tran");
    expect(netlist).not.toContain("TPS54302DDCR");
  }, 60_000);
});
