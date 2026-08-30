import { describe, expect, it } from "vitest";
import { generateScenarioNetlist, validateCircuitV2 } from "@opencircuit/circuit-schema";
import { designProfileEnvelopeContentHash } from "@opencircuit/design-library";
import { exportProductionDesignArtifactV2 } from "@opencircuit/design-export/production-artifact-v2";
import {
  evaluatePowerConstraintDecisionWithInstalledPolicyV3,
  getInstalledPowerConstraintPolicyCatalogV3,
} from "@opencircuit/design-engine/v3-power-runtime";
import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  designSha256ContentHash,
  migrateDesignRequestV1ToV2,
  parseElectricalDesignRequestV3,
  type BuckDesignRequest,
  type BuckDesignRequestV3,
} from "@opencircuit/design-schema";
import { createP1CompactRequest } from "../src/fixtures";
import { getPowerDesignContextManifestV2, getPowerDesignContextV2 } from "../src/v2";
import { generateBuckConstraintObservationV3 } from "../src/v3";
import { POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS } from "../src/v3-status";

function requestV3(source: BuckDesignRequest): BuckDesignRequestV3 {
  const migrated = migrateDesignRequestV1ToV2(source, getPowerDesignContextManifestV2().version);
  if (migrated.status !== "migrated" || migrated.request.application !== "power.buck") {
    throw new Error("Expected a migrated Power request");
  }
  const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = migrated.request.constraints;
  const parsed = parseElectricalDesignRequestV3({
    ...migrated.request,
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    constraints,
  });
  if (parsed.application !== "power.buck") throw new Error("Expected a Power V3 request");
  return parsed;
}

function withAssemblyConstraints(request: BuckDesignRequestV3): BuckDesignRequestV3 {
  const packageNames = Object.values(getPowerDesignContextV2().catalogDocuments.profiles)
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
  if (parsed.application !== "power.buck") throw new Error("Expected a Power V3 request");
  return parsed;
}

describe("Power Designer V3 production constraint observation", () => {
  it("retains one exact-BOM observation without hard failures while policy keeps every unresolved boundary ineligible", () => {
    const browserPreset = createP1CompactRequest();
    browserPreset.requirements.inputVoltage.minimum.value = 12;
    browserPreset.requirements.inputVoltage.maximum.value = 12;
    browserPreset.requirements.maximumOutputCurrent.value = 0.2;
    browserPreset.requirements.ambientTemperature.value = 298.15;
    browserPreset.requirements.switchingFrequency.minimum.value = 250_000;
    browserPreset.requirements.switchingFrequency.maximum.value = 600_000;
    browserPreset.requirements.dcOutputVoltageRegulation = {
      minimum: { value: 4.7, unit: "V", displayUnit: "V" },
      maximum: { value: 5.3, unit: "V", displayUnit: "V" },
    };
    const v3Request = requestV3(browserPreset);
    const first = generateBuckConstraintObservationV3(v3Request);
    expect(first.kind).toBe("production_constraint_observation");
    expect(first.observation.result.requestHash).toBe("sha256:3702fc5b906a3bfc2caeccc547b222b44fe0827b4a4972b1d4890ef35e100400");
    expect(first.observation.result.contentHash).toBe("sha256:0c0beab37c6d04b2bac6cd028035dae9de69855e85ef6e190ccbe5098e25021b");
    expect(first.observation.execution.counts).toEqual({
      recipes: 4,
      supportedRecipes: 3,
      enumerated: 1,
      solved: 1,
      matchOutcomes: 1,
      matched: 1,
      checked: 1,
      estimated: 1,
      deduped: 1,
      pareto: 1,
      materialized: 1,
      coverageValidated: 1,
      rejected: 0,
    });
    expect(first.observation.execution.rejections).toEqual([]);
    expect(first.observation.result.candidates).toHaveLength(1);
    const candidate = first.observation.result.candidates[0]!;
    expect(candidate).toMatchObject({
      id: "candidate:v2:sha256:1fc0e2f47f13060b4606b7cda6e54fae2b297ffbf7873bfe089c37114c444173",
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    });
    expect(candidate.metrics.estimateCount).toBe(4);
    expect(candidate.metrics.values.filter((entry) => entry.id.startsWith("power.passive."))).toEqual([
      expect.objectContaining({
        id: "power.passive.inductor-peak-current-observation",
        value: { value: 0.638874729145, unit: "A", displayUnit: "A" },
        state: "estimated",
        explanation: expect.stringContaining("Evaluated conduction modes: dcm"),
      }),
      expect.objectContaining({
        id: "power.passive.inductor-ripple-current-observation",
        value: { value: 0.638874729145, unit: "A", displayUnit: "A" },
        state: "estimated",
        explanation: expect.stringContaining("peak-to-peak ripple current"),
      }),
      expect.objectContaining({
        id: "power.passive.inductor-rms-current-observation",
        value: { value: 0.291861777592, unit: "A", displayUnit: "A" },
        state: "estimated",
      }),
      expect.objectContaining({
        id: "power.passive.output-capacitor-bank-rms-current-observation",
        value: { value: 0.212563630989, unit: "A", displayUnit: "A" },
        state: "estimated",
        explanation: expect.stringContaining("no per-part current-sharing multiplier or balance is claimed"),
      }),
    ]);
    expect(candidate.components.find((entry) => entry.id === "power-inductor")).toMatchObject({
      part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" },
      quantityPerAssembly: 1,
    });
    expect(candidate.components.find((entry) => entry.id === "output-capacitor")).toMatchObject({
      part: { manufacturerId: "murata-manufacturing", manufacturerPartNumber: "GRM32ER71E226KE15L" },
      quantityPerAssembly: 2,
    });
    expect(candidate.components.find((entry) => entry.id === "feedback-lower")).toMatchObject({
      part: { manufacturerId: "bourns", manufacturerPartNumber: "CR0603-FX-1003ELF" },
    });
    expect(candidate.components.find((entry) => entry.id === "feedback-upper")).toMatchObject({
      part: { manufacturerId: "vishay-intertechnology", manufacturerPartNumber: "CRCW0603732KFKEA" },
    });
    const bundledProfiles = getPowerDesignContextV2().catalogDocuments.profiles;
    expect(designProfileEnvelopeContentHash(bundledProfiles[
      "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json"
    ] as never)).toBe("sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6");
    expect(designProfileEnvelopeContentHash(bundledProfiles[
      "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json"
    ] as never)).toBe("sha256:30d45602549f1ab1c4f9434b419ccdfa95a5381ef70ff4297d7ceb6ae50259c4");
    expect(candidate.constraints.some((entry) => entry.status === "fail")).toBe(false);
    expect(Object.fromEntries(["pass", "unknown", "fail"].map((status) => [
      status,
      candidate.constraints.filter((entry) => entry.status === status).length,
    ]))).toEqual({ pass: 9, unknown: 13, fail: 0 });
    expect(candidate.constraints.some((entry) => entry.ruleId === "power.request.load-transient")).toBe(false);
    expect(candidate.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "power.passive.resistor-power-voltage",
        status: "pass",
        actual: { value: 4.5628739394, unit: "V", displayUnit: "V" },
        limit: { value: 75, unit: "V", displayUnit: "V" },
        explanation: expect.stringContaining("All four DC power and working-voltage comparisons"),
      }),
      expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.inductor.selected-value", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.inductor.rms-current", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.control.loop-stability", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.feedback.output-voltage", status: "pass" }),
      expect.objectContaining({ ruleId: "power.thermal.maximum-junction", status: "unknown" }),
    ]));
    expect(first.decision.source.resultContentHash).toBe(first.observation.result.contentHash);
    expect(first.decision.eligibleCandidateIds).toEqual([]);
    expect(first.decision.candidates).toEqual([
      expect.objectContaining({
        candidateId: candidate.id,
        recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
        eligible: false,
        rules: expect.arrayContaining([
          expect.objectContaining({ ruleId: "power.regulator.current-limit", disposition: "blocked_unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.saturation-current", disposition: "blocked_unknown" }),
          expect.objectContaining({ ruleId: "power.control.loop-stability", disposition: "blocked_unknown" }),
        ]),
      }),
    ]);
    expect(first.decision.contentHash).toBe("sha256:7bb304f6a30b58adac8ee9250ec2cda6e4104af965f0d517de0918295228c76c");
    expect(validateCircuitV2(candidate.circuit)).toEqual([]);
    expect(candidate.components.length).toBeGreaterThan(0);
    const scenario = generateScenarioNetlist(candidate.circuit, "ideal_pwm_output_stage_transient");
    expect(scenario.omissions).toEqual([]);
    expect(scenario.netlist).toContain(".tran");
    expect(scenario.netlist).not.toContain("TPS54302DDCR");
    expect(candidate.simulationCoverage).toContainEqual(expect.objectContaining({
      scenarioId: "catalog-native-model",
      modelTier: "unavailable",
    }));
    const context = getPowerDesignContextV2();
    const exportBom = () => exportProductionDesignArtifactV2(
      first.observation.result,
      candidate.id,
      "electrical_bom_csv",
      { engineeringContext: context, constraintDecision: first.decision },
    );
    const artifact = exportBom();
    expect(designSha256ContentHash(artifact.content)).toBe(
      "sha256:8864b2d5edfb6bb6c7a1e6fe03b919b131eddaee907c4e4b0a2e6c3492fd69ab",
    );
    expect(artifact.content).toContain("observation_only,ineligible");
    for (const component of candidate.components) {
      expect(artifact.content).toContain(component.part.manufacturerPartNumber);
    }
    expect(Reflect.apply(evaluatePowerConstraintDecisionWithInstalledPolicyV3, undefined, [
      first.observation.result,
      getPowerDesignContextManifestV2(),
      { callerSuppliedCriticality: "engineering_gap" },
    ])).toEqual(first.decision);
    expect(generateBuckConstraintObservationV3(v3Request)).toEqual(first);
  }, 30_000);

  it("emits and blocks the conditional load-transient rule when the request supplies numeric targets", () => {
    const browserPreset = createP1CompactRequest();
    browserPreset.requirements.inputVoltage.minimum.value = 12;
    browserPreset.requirements.inputVoltage.maximum.value = 12;
    browserPreset.requirements.maximumOutputCurrent.value = 0.2;
    browserPreset.requirements.ambientTemperature.value = 298.15;
    browserPreset.requirements.switchingFrequency.minimum.value = 250_000;
    browserPreset.requirements.switchingFrequency.maximum.value = 600_000;
    browserPreset.requirements.dcOutputVoltageRegulation = {
      minimum: { value: 4.7, unit: "V", displayUnit: "V" },
      maximum: { value: 5.3, unit: "V", displayUnit: "V" },
    };
    browserPreset.requirements.loadTransientTarget = {
      currentStep: { value: 0.1, unit: "A", displayUnit: "A" },
      maximumOutputDeviation: { value: 0.1, unit: "V", displayUnit: "V" },
      maximumSettlingTime: { value: 0.001, unit: "s", displayUnit: "ms" },
    };
    const v3Request = requestV3(browserPreset);
    const first = generateBuckConstraintObservationV3(v3Request);
    expect(first.observation.result.candidates).toHaveLength(1);
    const candidate = first.observation.result.candidates[0]!;
    expect(Object.fromEntries(["pass", "unknown", "fail"].map((status) => [
      status,
      candidate.constraints.filter((entry) => entry.status === status).length,
    ]))).toEqual({ pass: 9, unknown: 14, fail: 0 });
    expect(candidate.constraints.find((entry) => entry.ruleId === "power.request.load-transient")).toEqual({
      ruleId: "power.request.load-transient",
      status: "unknown",
      explanation: "The requested load transient has not been proved by a reviewed transient model.",
      evidence: [],
    });
    expect(first.decision.candidates).toEqual([
      expect.objectContaining({
        candidateId: candidate.id,
        eligible: false,
        rules: expect.arrayContaining([
          expect.objectContaining({
            ruleId: "power.request.load-transient",
            criticality: "requirement",
            disposition: "blocked_unknown",
          }),
        ]),
      }),
    ]);
    expect(first.decision.eligibleCandidateIds).toEqual([]);
    expect(generateBuckConstraintObservationV3(v3Request)).toEqual(first);
  });

  it("pins the installed recipe-scoped policy and returns detached copies", () => {
    const first = getInstalledPowerConstraintPolicyCatalogV3();
    const second = getInstalledPowerConstraintPolicyCatalogV3();
    expect(first.contentHash).toBe("sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6");
    expect(POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS).toEqual({
      constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
      contentHash: first.contentHash,
      productionEngineeringGapRuleCount: 0,
    });
    expect(first.recipePolicies.map((policy) => policy.recipeId)).toEqual([
      "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    ]);
    expect(first.recipePolicies.some((policy) => (
      policy.recipeId === "power.native.external-fet-synchronous-buck.facts-v3"
    ))).toBe(false);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("retains every conditional assembly observation on the materialized but ineligible Power option", () => {
    const source = createP1CompactRequest();
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
    const generation = generateBuckConstraintObservationV3(withAssemblyConstraints(requestV3(source)));
    expect(generation.observation.execution.rejections).toEqual([]);
    expect(generation.observation.result.candidates).toHaveLength(1);
    expect(generation.observation.result.candidates[0]!.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "power.assembly.allowed-packages", status: "pass" }),
      expect.objectContaining({ ruleId: "power.assembly.component-height", status: "pass" }),
      expect.objectContaining({ ruleId: "power.assembly.board-area", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
    ]));
    expect(generation.decision.candidates).toEqual([
      expect.objectContaining({
        eligible: false,
        rules: expect.arrayContaining([
          expect.objectContaining({ ruleId: "power.assembly.allowed-packages", disposition: "satisfied" }),
          expect.objectContaining({ ruleId: "power.assembly.component-height", disposition: "satisfied" }),
          expect.objectContaining({ ruleId: "power.assembly.board-area", disposition: "blocked_unknown" }),
        ]),
      }),
    ]);
    expect(generation.decision.eligibleCandidateIds).toEqual([]);
  });
});
