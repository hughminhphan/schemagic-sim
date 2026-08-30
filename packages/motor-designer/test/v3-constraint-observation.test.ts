import { describe, expect, it } from "vitest";
import { generateScenarioNetlist, validateCircuitV4 } from "@opencircuit/circuit-schema";
import { canonicalDesignExecutionReportV2Payload } from "@opencircuit/design-engine";
import { exportProductionDesignArtifactV2 } from "@opencircuit/design-export/production-artifact-v2";
import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  designSha256ContentHash,
  migrateDesignRequestV1ToV2,
  parseElectricalDesignRequestV3,
  type BrushedDcMotorDesignRequest,
  type BrushedDcMotorDesignRequestV3,
} from "@opencircuit/design-schema";
import {
  evaluateMotorConstraintDecisionWithInstalledPolicyV3,
  getInstalledMotorConstraintPolicyCatalogV3,
} from "@opencircuit/design-engine/v3-motor-runtime";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "../src/fixtures";
import { getMotorDesignContextManifestV2, getMotorDesignContextV2 } from "../src/v2";
import { generateMotorConstraintObservationV3 } from "../src/v3";
import { MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS } from "../src/v3-status";

function requestV3(source: BrushedDcMotorDesignRequest): BrushedDcMotorDesignRequestV3 {
  const migrated = migrateDesignRequestV1ToV2(source, getMotorDesignContextManifestV2().version);
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") {
    throw new Error("Expected a migrated Motor request");
  }
  const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = migrated.request.constraints;
  const parsed = parseElectricalDesignRequestV3({
    ...migrated.request,
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    constraints,
  });
  if (parsed.application !== "motor.brushed-dc") throw new Error("Expected a Motor V3 request");
  return parsed;
}

function expectConservativeDecision(generation: ReturnType<typeof generateMotorConstraintObservationV3>): void {
  expect(generation.kind).toBe("production_constraint_observation");
  expect(generation.decision.source.resultContentHash).toBe(generation.observation.result.contentHash);
  expect(generation.decision.eligibleCandidateIds).toEqual([]);
  expect(generation.decision.candidates.every((candidate) => !candidate.eligible)).toBe(true);
  expect(generation.decision.candidates.flatMap((candidate) => candidate.rules).some((rule) => rule.criticality === "engineering_gap")).toBe(false);
  expect(generation.decision.candidates.flatMap((candidate) => candidate.rules).some((rule) => rule.disposition === "blocked_unknown")).toBe(true);
}

function withAssemblyConstraints(request: BrushedDcMotorDesignRequestV3): BrushedDcMotorDesignRequestV3 {
  const packageNames = Object.values(getMotorDesignContextV2().catalogDocuments.profiles)
    .flatMap((profile) => {
      const value = (profile as { commonFacts?: { packageName?: { value?: unknown } } }).commonFacts?.packageName?.value;
      return typeof value === "string" ? [value] : [];
    })
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  const parsed = parseElectricalDesignRequestV3({
    ...request,
    constraints: {
      ...request.constraints,
      allowedPackages: packageNames,
      maximumComponentHeight: { value: 1, unit: "m", displayUnit: "m" },
      maximumBoardArea: { value: 1, unit: "m2", displayUnit: "m²" },
    },
  });
  if (parsed.application !== "motor.brushed-dc") throw new Error("Expected a Motor V3 request");
  return parsed;
}

function expectAssemblyDecisions(
  generation: ReturnType<typeof generateMotorConstraintObservationV3>,
  prefix: "motor.integrated" | "motor.external",
): void {
  for (const candidate of generation.decision.candidates) {
    expect(candidate.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: `${prefix}.assembly.allowed-packages`, sourceStatus: "pass", disposition: "satisfied" }),
      expect.objectContaining({ ruleId: `${prefix}.assembly.component-height`, sourceStatus: "pass", disposition: "satisfied" }),
      expect.objectContaining({ ruleId: `${prefix}.assembly.board-area`, sourceStatus: "unknown", disposition: "blocked_unknown" }),
    ]));
  }
}

describe("Motor Designer V3 production constraint observation", () => {
  it("observes the connected integrated structure but keeps every unknown safety design ineligible", () => {
    const first = generateMotorConstraintObservationV3(requestV3(M1_COMPACT_REQUEST));
    expectConservativeDecision(first);
    expect(first.observation.result.candidates).toHaveLength(1);
    expect(first.decision.candidates.map((candidate) => candidate.recipeId)).toEqual([
      "motor.native.integrated-h-bridge.facts-v3-2",
    ]);
    expect({
      result: first.observation.result.contentHash,
      execution: designSha256ContentHash(canonicalDesignExecutionReportV2Payload(first.observation.execution)),
      candidateIds: first.observation.result.candidates.map((candidate) => candidate.id),
      decision: first.decision.contentHash,
    }).toEqual({
      result: "sha256:487cfeca28ed0a67d27df858b87925deca3896a8f9fc4ac19c9de75647cacdb2",
      execution: "sha256:34a59924931a3d6200594670374c5e6d57f07e4722b9d7a92736a0001adc79e4",
      candidateIds: ["candidate:v2:sha256:3f9953a5582e56cd999070367f1b3c4830bfad4d4e9df55e2ce91891fb5cb16e"],
      decision: "sha256:093fab8cc210268d42e0af901b9fe72be506268c69d74ceb733bd01f807f70b2",
    });
    expect(first.observation.result.candidates[0]!.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.integrated.local-capacitance-nominal", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.integrated.capacitor-derating", status: "unknown" }),
    ]));
    expect(first.decision.candidates[0]!.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.integrated.local-capacitance-nominal", sourceStatus: "unknown", disposition: "blocked_unknown" }),
      expect.objectContaining({ ruleId: "motor.integrated.capacitor-derating", sourceStatus: "unknown", disposition: "blocked_unknown" }),
    ]));
    const exactTargetRejections = first.observation.execution.rejections.filter((entry) => (
      entry.componentProfileIds.some((profileId) => profileId.endsWith("/DRV8876PWPR.json"))
      && entry.componentProfileIds.some((profileId) => profileId.endsWith("/C1608X7R1H104K080AA.json"))
    ));
    expect(exactTargetRejections).toHaveLength(2);
    expect(exactTargetRejections.every((entry) => (
      entry.constraints?.some((constraint) => (
        constraint.ruleId === "motor.integrated.local-capacitance-nominal"
        && constraint.status === "pass"
      ))
      && entry.constraints?.some((constraint) => (
        constraint.ruleId === "motor.integrated.capacitor-derating"
        && constraint.status === "unknown"
      ))
    ))).toBe(true);
    const candidate = first.observation.result.candidates[0]!;
    expect(validateCircuitV4(candidate.circuit)).toEqual([]);
    expect(candidate.components.length).toBeGreaterThan(0);
    expect(candidate.metrics.values.every((metric) => (
      metric.state === "calculated" && metric.value !== null && Number.isFinite(metric.value.value)
    ))).toBe(true);
    const scenario = generateScenarioNetlist(candidate.circuit, "pwm_loaded_steady_state");
    expect(scenario.omissions).toEqual([]);
    expect(scenario.netlist).toContain(".op");
    expect(candidate.simulationCoverage).toContainEqual(expect.objectContaining({
      scenarioId: "selected_part_model",
      modelTier: "unavailable",
    }));
    const context = getMotorDesignContextV2();
    const exportBom = () => exportProductionDesignArtifactV2(
      first.observation.result,
      candidate.id,
      "electrical_bom_csv",
      { engineeringContext: context, constraintDecision: first.decision },
    );
    const artifact = exportBom();
    expect(designSha256ContentHash(artifact.content)).toBe(
      "sha256:50cac47c797affeebd6d2bba32c404315d2242cd9e5de68ea70c85a6085d7be9",
    );
    expect(artifact.content).toContain("observation_only,ineligible");
    for (const component of candidate.components) {
      expect(artifact.content).toContain(component.part.manufacturerPartNumber);
    }
    expect(Reflect.apply(evaluateMotorConstraintDecisionWithInstalledPolicyV3, undefined, [
      first.observation.result,
      getMotorDesignContextManifestV2(),
      { callerSuppliedCriticality: "engineering_gap" },
    ])).toEqual(first.decision);
    expect(generateMotorConstraintObservationV3(requestV3(M1_COMPACT_REQUEST))).toEqual(first);
  }, 60_000);

  it("observes the exact MIC4606-2 direct-gate structure without inventing a gate resistor or eligibility", () => {
    const generation = generateMotorConstraintObservationV3(requestV3(M2_POWER_REQUEST));
    expectConservativeDecision(generation);
    expect({
      result: generation.observation.result.contentHash,
      candidateIds: generation.observation.result.candidates.map((candidate) => candidate.id),
      decision: generation.decision.contentHash,
    }).toEqual({
      result: "sha256:8594f24adad54036b6e8df4d94a97798ee31c6ca8acdec2169a13966ebe287c0",
      candidateIds: [
        "candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152",
        "candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382",
      ],
      decision: "sha256:96a51723912ee42c1a1837c1ce388bef95fd6ecb0d328ca618a24e2380b4a9d4",
    });
    expect(generation.observation.result.candidates).toHaveLength(2);
    expect(generation.decision.candidates).toHaveLength(2);
    expect(generation.observation.execution.counts).toMatchObject({
      enumerated: 54,
      checked: 54,
      materialized: 54,
      pareto: 2,
      rejected: 52,
    });
    expect(generation.observation.execution.rejections.every((rejection) => (
      rejection.recipeId === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"
      && rejection.reasonCode === "pareto_dominated"
    ))).toBe(true);
    for (const candidate of generation.observation.result.candidates) {
      expect(candidate.recipeId).toBe("motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified");
      expect(candidate.components.some((component) => (
        component.id === "gate-resistor" || component.role === "mosfet-gate-resistor"
      ))).toBe(false);
      const assembly = candidate.circuit.circuits.find((circuit) => circuit.id === "assembly");
      expect(assembly?.components.some((component) => component.id === "gate-resistor")).toBe(false);
      expect(assembly?.wires.some((wire) => wire.id === "gate-drive-direct-to-bridge")).toBe(true);
      expect(candidate.components).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "driver", role: "full-bridge-gate-driver", part: {
          manufacturerId: "microchip-technology",
          manufacturerPartNumber: "MIC4606-2YML-T5",
        } }),
        expect.objectContaining({ id: "pulldown-resistor", role: "mosfet-gate-source-pulldown-resistor", quantityPerAssembly: 4 }),
        expect.objectContaining({ id: "bootstrap-capacitor", role: "bootstrap-capacitor", quantityPerAssembly: 2 }),
        expect.objectContaining({ id: "local-decoupling", role: "driver-local-decoupling-capacitor", quantityPerAssembly: 1 }),
        expect.objectContaining({ id: "supply-tvs", role: "motor-supply-tvs-diode", part: {
          manufacturerId: "diodes-incorporated",
          manufacturerPartNumber: "3.0SMCJ33CAQ",
        } }),
      ]));
      expect(candidate.constraints).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance-nominal", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-nominal", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.bulk-capacitance", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.capacitor-placement", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-effective", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.local-voltage-rating", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-operating-minimum", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-operating-maximum", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-absolute-maximum", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.driver-bias-source", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-driver-switch-node-limit", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-mosfet-limit", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-stand-off", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-coordination", status: "unknown" }),
        expect.objectContaining({
          ruleId: "motor.external.gate-network",
          status: "unknown",
          evidence: expect.arrayContaining([
            expect.objectContaining({ contentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135" }),
          ]),
        }),
      ]));
    }
    for (const candidate of generation.decision.candidates) {
      expect(candidate.rules.filter((rule) => rule.disposition === "satisfied")).toHaveLength(9);
      expect(candidate.rules.filter((rule) => rule.disposition !== "satisfied")).toHaveLength(21);
      expect(candidate.rules).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance-nominal", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-nominal", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", sourceStatus: "unknown", disposition: "blocked_unknown" }),
        expect.objectContaining({ ruleId: "motor.external.bulk-capacitance", sourceStatus: "unknown", disposition: "blocked_unknown" }),
        expect.objectContaining({ ruleId: "motor.external.capacitor-placement", sourceStatus: "unknown", disposition: "blocked_unknown" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-effective", sourceStatus: "unknown", disposition: "blocked_unknown" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-operating-minimum", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-operating-maximum", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-absolute-maximum", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.driver-bias-source", sourceStatus: "unknown", disposition: "blocked_unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-driver-switch-node-limit", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-mosfet-limit", sourceStatus: "pass", disposition: "satisfied" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-stand-off", sourceStatus: "unknown", disposition: "blocked_unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-coordination", sourceStatus: "unknown", disposition: "blocked_unknown" }),
      ]));
    }
  }, 30_000);

  it("pins the installed recipe-scoped policy and returns detached copies", () => {
    const first = getInstalledMotorConstraintPolicyCatalogV3();
    const second = getInstalledMotorConstraintPolicyCatalogV3();
    expect(first.contentHash).toBe("sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0");
    expect(MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS).toEqual({
      constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
      contentHash: first.contentHash,
      productionEngineeringGapRuleCount: 0,
    });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("evaluates all conditional assembly rules for both installed Motor recipe scopes", () => {
    const integrated = generateMotorConstraintObservationV3(withAssemblyConstraints(requestV3(M1_COMPACT_REQUEST)));
    const external = generateMotorConstraintObservationV3(withAssemblyConstraints(requestV3(M2_POWER_REQUEST)));
    expect(integrated.decision.candidates).toHaveLength(1);
    expect(external.decision.candidates).toHaveLength(2);
    expectAssemblyDecisions(integrated, "motor.integrated");
    expectAssemblyDecisions(external, "motor.external");
    expect(integrated.decision.eligibleCandidateIds).toEqual([]);
    expect(external.decision.eligibleCandidateIds).toEqual([]);
  }, 30_000);
});
