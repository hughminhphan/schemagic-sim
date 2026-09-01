import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { BuckDesignRequestV2 } from "@opencircuit/design-schema";
import {
  generateBuckDesignV2,
  getPowerDesignContextManifestV2,
} from "@opencircuit/power-designer/v2";
import { evaluatePowerConstraintDecisionWithInstalledPolicyV3 } from "@opencircuit/design-engine/v3-power-runtime";
import { calculateSimulationNetlistContentHashV1, generateScenarioNetlist } from "../src";

interface SelectedPassiveBinding {
  selectedComponentId: "output-capacitor" | "power-inductor";
  assemblyComponentId: "output-capacitor-1" | "output-capacitor-2" | "power-inductor";
  circuitComponentId: "output-capacitor-1" | "output-capacitor-2" | "power-inductor";
  physicalInstanceOrdinal: 1 | 2;
  selectedLineQuantityPerAssembly: 1 | 2;
  representedQuantityPerAssembly: 1;
  classification: "physical";
  profileId: string;
  profileContentHash: `sha256:${string}`;
  manufacturerId: string;
  manufacturerPartNumber: string;
  nominalValue: { value: number; unit: "F" | "H" };
  nominalEvidenceContentHash: `sha256:${string}`;
  representation: "ideal_nominal_capacitor" | "ideal_nominal_inductor";
  reviewedOperatingConditionStatus: "outside" | "outside_or_unproved";
}

interface SelectedPassiveContract {
  format: "opencircuit-selected-passive-application-golden-contract";
  schemaVersion: 2;
  engines: {
    native: { version: "ngspice-46"; solverClaim: "unverified" };
    browserWasm: {
      module: string;
      engineVersion: "ngspice-46-opencircuit-wasm1";
      simulatorVersion: "ngspice-46";
      solver: "KLU";
    };
  };
  evidenceBoundary: {
    modelTier: "behavioral";
    attestation: "none";
    productionProfilesUsed: true;
    primitiveValueBasis: "reviewed_nominal_only";
    productionConstraintEligibility: false;
    currentProductionIdentity: true;
    selectedSemiconductorModelsUsed: false;
    claim: string;
    operatingConditionsWithinReviewedEvidence: false;
    authority: Record<
      | "switchingBehavior"
      | "effectiveCapacitance"
      | "capacitorEsr"
      | "capacitorRippleCurrent"
      | "passiveCurrent"
      | "loss"
      | "physicalPassiveModel"
      | "fullBomModel"
      | "selectedSemiconductorModel"
      | "constraintEligibility"
      | "candidateRanking"
      | "safety",
      "unavailable"
    >;
    purpose: string;
    doesNotProve: string[];
  };
  case: {
    id: string;
    application: "power.buck";
    presetId: string;
    candidateId: string;
    recipe: { id: string; version: string; contentHash: `sha256:${string}` };
    requestHash: `sha256:${string}`;
    resultContentHash: `sha256:${string}`;
    strictGeneration: {
      requestHash: `sha256:${string}`;
      resultContentHash: `sha256:${string}`;
      retainedCandidateCount: 0;
      rejectedCandidateId: string;
      rejectionReasonCode: "unknown_constraint_disallowed";
      counts: Record<string, number>;
    };
    constraintPolicy: { id: "production_strict_v1"; contentHash: `sha256:${string}` };
    constraintDecisionContentHash: `sha256:${string}`;
    observationCounts: Record<string, number>;
    observationCandidateCount: 1;
    eligibleCandidateCount: 0;
    library: {
      version: string;
      contextManifestContentHash: `sha256:${string}`;
      catalogContentHash: `sha256:${string}`;
      sourceReleaseContentHash: `sha256:${string}`;
    };
    scenarioId: string;
    scenarioHash: string;
    serializationHash: string;
    fixture: string;
    netlistContentHash: `sha256:${string}`;
    selectedVectors: string[];
    selectedBindings: SelectedPassiveBinding[];
    primaryBinding: {
      selectedComponentId: "primary";
      circuitComponentId: "ideal-pwm-primary";
      manufacturerPartNumber: "TPS54302DDCR";
      classification: "behavioral";
      executableSelectedPartModel: false;
    };
    observationContract: {
      kind: "ideal-nominal-output-node-kcl-outside-reviewed-conditions";
      capacitorCurrentVectors: string[];
      productionSwitchingFrequencyMinimumHz: number;
      scenarioSwitchingFrequencyHz: number;
      reviewedNominalInductanceTestFrequencyHz: number;
      reviewedNominalInductanceTestVoltageVrms: number;
      reviewedNominalCapacitanceTestFrequencyMinimumHz: number;
      reviewedNominalCapacitanceTestFrequencyMaximumHz: number;
      reviewedNominalCapacitanceTestVoltageMinimumVrms: number;
      reviewedNominalCapacitanceTestVoltageMaximumVrms: number;
      capacitorPrimitiveCount: 2;
      capacitorNominalValuePerPrimitiveF: number;
      minimumAbsoluteCapacitorCurrentA: number;
      maximumAbsoluteCapacitorCurrentA: number;
      minimumOutputSpanV: number;
      interpretation: "mathematical_projection_outside_reviewed_conditions";
    };
  };
}

interface CatalogRelease {
  version: string;
  contentHash: `sha256:${string}`;
  profiles: Array<{
    profileId: string;
    profilePath: string;
    partClass: string;
    part: { manufacturerId: string; manufacturerPartNumber: string };
    profileContentHash: `sha256:${string}`;
  }>;
}

interface DesignerPowerAdapter {
  application: "power.buck";
  presets: ReadonlyArray<{
    id: string;
    createRequest(): BuckDesignRequestV2;
  }>;
}

interface CapacitorProfile {
  part: { manufacturerId: string; manufacturerPartNumber: string };
  facts: {
    nominalCapacitance: {
      value: { value: number; unit: "F" };
      evidence: Array<{ contentHash: string }>;
      validFor: Array<{
        parameterId: string;
        minimum: { value: number; unit: string } | null;
        maximum: { value: number; unit: string } | null;
      }>;
    };
    effectiveCapacitance: { value: null };
    biasDeratingRatio: { value: null };
    equivalentSeriesResistance: { value: null };
    rippleCurrent: { value: null };
  };
}

interface InductorProfile {
  part: { manufacturerId: string; manufacturerPartNumber: string };
  facts: {
    inductance: {
      value: { value: number; unit: "H" };
      evidence: Array<{ contentHash: string }>;
      validFor: Array<{
        parameterId: string;
        minimum: { value: number; unit: string } | null;
        maximum: { value: number; unit: string } | null;
      }>;
    };
  };
}

const CONTRACT_URL = new URL(
  "../../../tools/native-ngspice-reference/selected-passive-application-golden/contract.json",
  import.meta.url,
);
const CONTRACT = JSON.parse(readFileSync(CONTRACT_URL, "utf8")) as SelectedPassiveContract;
const CATALOG_RELEASE_URL = new URL("../../../packages/design-library/catalog-release.json", import.meta.url);
const CATALOG_RELEASE = JSON.parse(readFileSync(CATALOG_RELEASE_URL, "utf8")) as CatalogRelease;

function profileUrl(profileId: string): URL {
  return new URL(`../../../${profileId}`, import.meta.url);
}

async function currentPowerPreset(): Promise<{
  adapter: DesignerPowerAdapter;
  request: BuckDesignRequestV2;
}> {
  const moduleUrl = new URL("../../../apps/web/src/features/designer/applications.ts", import.meta.url);
  const applicationModule = await import(/* @vite-ignore */ moduleUrl.href) as {
    powerDesignerAdapter(): DesignerPowerAdapter;
  };
  const adapter = applicationModule.powerDesignerAdapter();
  const preset = adapter.presets.find((entry) => entry.id === CONTRACT.case.presetId);
  if (!preset) throw new Error(`Missing exact Power preset ${CONTRACT.case.presetId}`);
  return { adapter, request: structuredClone(preset.createRequest()) };
}

describe("current-production ineligible selected-passive native/WASM golden identity", () => {
  it("keeps the claim at exact profile identity plus ideal nominal primitive wiring and outside reviewed conditions", () => {
    expect(CONTRACT).toEqual(expect.objectContaining({
      format: "opencircuit-selected-passive-application-golden-contract",
      schemaVersion: 2,
      engines: {
        native: { version: "ngspice-46", solverClaim: "unverified" },
        browserWasm: expect.objectContaining({
          engineVersion: "ngspice-46-opencircuit-wasm1",
          simulatorVersion: "ngspice-46",
          solver: "KLU",
        }),
      },
      evidenceBoundary: expect.objectContaining({
        modelTier: "behavioral",
        attestation: "none",
        productionProfilesUsed: true,
        primitiveValueBasis: "reviewed_nominal_only",
        productionConstraintEligibility: false,
        selectedSemiconductorModelsUsed: false,
        operatingConditionsWithinReviewedEvidence: false,
        currentProductionIdentity: true,
        claim: "Current production observation identity and two explicit parallel per-part ideal nominal capacitor primitives plus one ideal nominal inductor primitive only; the exact retained candidate is ineligible under the installed production policy.",
        authority: {
          switchingBehavior: "unavailable",
          effectiveCapacitance: "unavailable",
          capacitorEsr: "unavailable",
          capacitorRippleCurrent: "unavailable",
          passiveCurrent: "unavailable",
          loss: "unavailable",
          physicalPassiveModel: "unavailable",
          fullBomModel: "unavailable",
          selectedSemiconductorModel: "unavailable",
          constraintEligibility: "unavailable",
          candidateRanking: "unavailable",
          safety: "unavailable",
        },
      }),
    }));
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/TPS54302DDCR/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/tolerance.*bias.*ESR.*ripple-current.*current sharing.*parasitic.*temperature/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/DCR.*saturation-current.*RMS-current.*core-loss/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/safe passive operating conditions.*regulation/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/candidate constraint eligibility.*ranking/u);
    expect(CONTRACT.case.observationContract).toEqual(expect.objectContaining({
      kind: "ideal-nominal-output-node-kcl-outside-reviewed-conditions",
      interpretation: "mathematical_projection_outside_reviewed_conditions",
      productionSwitchingFrequencyMinimumHz: 290_000,
      scenarioSwitchingFrequencyHz: 400_000,
      reviewedNominalInductanceTestFrequencyHz: 100_000,
      reviewedNominalInductanceTestVoltageVrms: 0.25,
      reviewedNominalCapacitanceTestFrequencyMinimumHz: 96,
      reviewedNominalCapacitanceTestFrequencyMaximumHz: 144,
      reviewedNominalCapacitanceTestVoltageMinimumVrms: 0.4,
      reviewedNominalCapacitanceTestVoltageMaximumVrms: 0.6,
      capacitorPrimitiveCount: 2,
      capacitorNominalValuePerPrimitiveF: 0.000022,
      minimumAbsoluteCapacitorCurrentA: 5,
      maximumAbsoluteCapacitorCurrentA: 6,
    }));
    expect(CONTRACT.case.observationContract.minimumOutputSpanV).toBeGreaterThan(0);
    expect(CONTRACT.case.observationContract.reviewedNominalInductanceTestFrequencyHz)
      .toBeLessThan(CONTRACT.case.observationContract.productionSwitchingFrequencyMinimumHz);
    expect(CONTRACT.case.observationContract.reviewedNominalInductanceTestFrequencyHz)
      .toBeLessThan(CONTRACT.case.observationContract.scenarioSwitchingFrequencyHz);
    expect(CONTRACT.case.observationContract.reviewedNominalCapacitanceTestFrequencyMaximumHz)
      .toBeLessThan(CONTRACT.case.observationContract.productionSwitchingFrequencyMinimumHz);
    expect(CONTRACT.case.observationContract.capacitorCurrentVectors).toHaveLength(2);
    expect(new Set(CONTRACT.case.observationContract.capacitorCurrentVectors).size).toBe(2);
  });

  it("binds strict zero and one permissive policy-ineligible observation to the exact generated fixture", async () => {
    const { adapter, request } = await currentPowerPreset();
    expect(adapter.application).toBe("power.buck");
    expect(request.constraints.allowUnknownHardConstraints).toBe(false);

    const strict = generateBuckDesignV2(request);
    expect(strict.result.requestHash).toBe(CONTRACT.case.strictGeneration.requestHash);
    expect(strict.result.contentHash).toBe(CONTRACT.case.strictGeneration.resultContentHash);
    expect(strict.result.candidates).toHaveLength(CONTRACT.case.strictGeneration.retainedCandidateCount);
    expect(strict.execution.counts).toEqual(CONTRACT.case.strictGeneration.counts);
    expect(strict.execution.rejections).toEqual([
      expect.objectContaining({
        candidateId: CONTRACT.case.strictGeneration.rejectedCandidateId,
        recipeId: CONTRACT.case.recipe.id,
        stage: "check",
        reasonCode: CONTRACT.case.strictGeneration.rejectionReasonCode,
        constraints: expect.arrayContaining([
          expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.selected-value", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.passive.capacitor-effective-capacitance", status: "unknown" }),
        ]),
      }),
    ]);
    expect(strict.execution.rejections[0]?.constraints?.some((entry) => entry.status === "fail")).toBe(false);

    const observationRequest = structuredClone(request);
    observationRequest.constraints.allowUnknownHardConstraints = true;
    const observation = generateBuckDesignV2(observationRequest);
    expect(observation.result.requestHash).toBe(CONTRACT.case.requestHash);
    expect(observation.result.contentHash).toBe(CONTRACT.case.resultContentHash);
    expect(observation.execution.counts).toEqual(CONTRACT.case.observationCounts);
    expect(observation.execution.rejections).toEqual([]);
    expect(observation.result.candidates).toHaveLength(CONTRACT.case.observationCandidateCount);
    const candidate = observation.result.candidates[0]!;
    expect(candidate).toMatchObject({ id: CONTRACT.case.candidateId, recipeId: CONTRACT.case.recipe.id });
    expect(candidate.components.find((entry) => entry.id === "power-inductor")).toMatchObject({
      part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" },
      quantityPerAssembly: 1,
      value: { value: 0.00001, unit: "H" },
    });
    expect(candidate.components.find((entry) => entry.id === "output-capacitor")).toMatchObject({
      part: { manufacturerId: "murata-manufacturing", manufacturerPartNumber: "GRM32ER71E226KE15L" },
      quantityPerAssembly: 2,
      value: { value: 0.000022, unit: "F" },
    });
    expect(candidate.constraints.some((entry) => entry.status === "fail")).toBe(false);
    for (const [ruleId, diagnosticId] of [
      ["power.inductor.selected-value", "power.passive.inductor.minimum-inductance"],
      ["power.inductor.saturation-current", "power.passive.inductor.saturation-current"],
      ["power.inductor.rms-current", "power.passive.inductor.rms-current"],
      ["power.passive.capacitor-effective-capacitance", "power.passive.capacitor.effective-capacitance"],
      ["power.request.output-ripple", "power.passive.output-ripple"],
      ["power.thermal.loss-model", "power.passive.inductor.loss-bound"],
    ] as const) {
      expect(candidate.constraints.find((entry) => entry.ruleId === ruleId)).toMatchObject({
        status: "unknown",
        explanation: expect.stringContaining(diagnosticId),
      });
    }
    expect(candidate.constraints.find((entry) => entry.ruleId === "power.regulator.current-limit")?.status).toBe("unknown");

    const manifest = getPowerDesignContextManifestV2();
    expect(manifest.contentHash).toBe(CONTRACT.case.library.contextManifestContentHash);
    expect(manifest.catalog.contentHash).toBe(CONTRACT.case.library.catalogContentHash);
    expect(manifest.catalog.sourceReleaseContentHash).toBe(CONTRACT.case.library.sourceReleaseContentHash);
    expect(manifest.recipes.find((entry) => entry.id === CONTRACT.case.recipe.id)).toEqual(expect.objectContaining(CONTRACT.case.recipe));
    expect(observation.result.libraryVersion).toBe(CONTRACT.case.library.version);
    expect(observation.result.libraryContentHash).toBe(CONTRACT.case.library.contextManifestContentHash);
    expect(CATALOG_RELEASE.version).toBe(CONTRACT.case.library.version);
    expect(CATALOG_RELEASE.contentHash).toBe(CONTRACT.case.library.sourceReleaseContentHash);

    const decision = evaluatePowerConstraintDecisionWithInstalledPolicyV3(observation.result, manifest);
    expect(decision.policy).toEqual({
      constraintPolicy: CONTRACT.case.constraintPolicy.id,
      contentHash: CONTRACT.case.constraintPolicy.contentHash,
    });
    expect(decision.source).toMatchObject({
      resultContentHash: CONTRACT.case.resultContentHash,
      candidateIds: [CONTRACT.case.candidateId],
    });
    expect(decision.contentHash).toBe(CONTRACT.case.constraintDecisionContentHash);
    expect(decision.candidates).toEqual([
      expect.objectContaining({ candidateId: CONTRACT.case.candidateId, eligible: false }),
    ]);
    expect(decision.eligibleCandidateIds).toHaveLength(CONTRACT.case.eligibleCandidateCount);

    for (const binding of CONTRACT.case.selectedBindings) {
      expect(CATALOG_RELEASE.profiles.find((entry) => entry.profileId === binding.profileId)).toEqual(expect.objectContaining({
        profileId: binding.profileId,
        profilePath: binding.profileId,
        part: {
          manufacturerId: binding.manufacturerId,
          manufacturerPartNumber: binding.manufacturerPartNumber,
        },
        profileContentHash: binding.profileContentHash,
      }));
      for (const circuitId of ["assembly", "ideal_pwm_output_stage"]) {
        expect(candidate.circuitInstanceClassifications).toContainEqual({
          circuitId,
          componentId: circuitId === "assembly" ? binding.assemblyComponentId : binding.circuitComponentId,
          kind: "physical",
          selectedComponentId: binding.selectedComponentId,
          representedQuantityPerAssembly: binding.representedQuantityPerAssembly,
        });
      }
    }

    const capacitorBindings = CONTRACT.case.selectedBindings.filter((entry) => entry.selectedComponentId === "output-capacitor");
    expect(capacitorBindings.map((entry) => ({
      assemblyComponentId: entry.assemblyComponentId,
      circuitComponentId: entry.circuitComponentId,
      physicalInstanceOrdinal: entry.physicalInstanceOrdinal,
      selectedLineQuantityPerAssembly: entry.selectedLineQuantityPerAssembly,
      representedQuantityPerAssembly: entry.representedQuantityPerAssembly,
    }))).toEqual([
      {
        assemblyComponentId: "output-capacitor-1",
        circuitComponentId: "output-capacitor-1",
        physicalInstanceOrdinal: 1,
        selectedLineQuantityPerAssembly: 2,
        representedQuantityPerAssembly: 1,
      },
      {
        assemblyComponentId: "output-capacitor-2",
        circuitComponentId: "output-capacitor-2",
        physicalInstanceOrdinal: 2,
        selectedLineQuantityPerAssembly: 2,
        representedQuantityPerAssembly: 1,
      },
    ]);
    for (const circuitId of ["assembly", "ideal_pwm_output_stage"]) {
      const graph = candidate.circuit.circuits.find((entry) => entry.id === circuitId);
      expect(graph?.components.filter((entry) => entry.id.startsWith("output-capacitor-"))).toEqual([
        expect.objectContaining({ id: "output-capacitor-1", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
        expect.objectContaining({ id: "output-capacitor-2", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
      ]);
    }

    const fixture = readFileSync(
      new URL(`../../../tools/native-ngspice-reference/selected-passive-application-golden/${CONTRACT.case.fixture}`, import.meta.url),
      "utf8",
    );
    const generated = generateScenarioNetlist(candidate.circuit, CONTRACT.case.scenarioId);
    expect(generated.omissions).toEqual([]);
    expect(generated.scenarioHash).toBe(CONTRACT.case.scenarioHash);
    expect(generated.serializationHash).toBe(CONTRACT.case.serializationHash);
    expect(generated.netlist).toBe(fixture);
    await expect(calculateSimulationNetlistContentHashV1(fixture)).resolves.toBe(CONTRACT.case.netlistContentHash);
    const capacitorOne = "Coc_6f75747075742d636170616369746f722d31 n2 0 0.000022";
    const capacitorTwo = "Coc_6f75747075742d636170616369746f722d32 n2 0 0.000022";
    expect(fixture).toContain(capacitorOne);
    expect(fixture).toContain(capacitorTwo);
    expect(fixture.match(/^Coc_/gmu)).toHaveLength(2);
    expect(fixture).not.toContain(" n2 0 0.000044");
    expect(fixture).toContain("Loc_706f7765722d696e647563746f72 n1 n2 0.00001");
    expect(CONTRACT.case.observationContract.capacitorCurrentVectors).toEqual([
      "i(@coc_6f75747075742d636170616369746f722d31[i])",
      "i(@coc_6f75747075742d636170616369746f722d32[i])",
    ]);
    expect(CONTRACT.case.selectedVectors).toEqual([
      ...CONTRACT.case.observationContract.capacitorCurrentVectors,
      "i(@loc_706f7765722d696e647563746f72[i])",
      "i(@roc_6e6f6d696e616c2d6c6f6164[i])",
      "v(n1)",
      "v(n2)",
    ]);
    expect(fixture).not.toContain("TPS54302DDCR");
    expect(candidate.simulationCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenarioId: "catalog-native-model", modelTier: "unavailable" }),
      expect.objectContaining({ scenarioId: CONTRACT.case.scenarioId, modelTier: "behavioral" }),
    ]));
  });

  it("binds reviewed nominal facts while proving the ideal projection is outside or beyond their conditions", () => {
    const capacitorBindings = CONTRACT.case.selectedBindings.filter((entry) => entry.selectedComponentId === "output-capacitor");
    const inductorBinding = CONTRACT.case.selectedBindings.find((entry) => entry.selectedComponentId === "power-inductor");
    if (capacitorBindings.length !== 2 || !inductorBinding) throw new Error("Selected-passive bindings are incomplete");
    const capacitorBinding = capacitorBindings[0]!;
    expect(capacitorBindings[1]).toEqual({
      ...capacitorBinding,
      assemblyComponentId: "output-capacitor-2",
      circuitComponentId: "output-capacitor-2",
      physicalInstanceOrdinal: 2,
    });
    const capacitor = JSON.parse(readFileSync(profileUrl(capacitorBinding.profileId), "utf8")) as CapacitorProfile;
    const inductor = JSON.parse(readFileSync(profileUrl(inductorBinding.profileId), "utf8")) as InductorProfile;

    expect(capacitor.part).toEqual({
      manufacturerId: capacitorBinding.manufacturerId,
      manufacturerPartNumber: capacitorBinding.manufacturerPartNumber,
    });
    expect(capacitor.facts.nominalCapacitance.value).toEqual(expect.objectContaining(capacitorBinding.nominalValue));
    expect(capacitor.facts.nominalCapacitance.evidence.some((entry) => entry.contentHash === capacitorBinding.nominalEvidenceContentHash)).toBe(true);
    const capacitorFrequencyCondition = capacitor.facts.nominalCapacitance.validFor.find((entry) => entry.parameterId === "switchingFrequency");
    const capacitorVoltageCondition = capacitor.facts.nominalCapacitance.validFor.find((entry) => entry.parameterId === "testVoltage");
    expect(capacitorFrequencyCondition?.minimum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalCapacitanceTestFrequencyMinimumHz);
    expect(capacitorFrequencyCondition?.maximum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalCapacitanceTestFrequencyMaximumHz);
    expect(capacitorVoltageCondition?.minimum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalCapacitanceTestVoltageMinimumVrms);
    expect(capacitorVoltageCondition?.maximum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalCapacitanceTestVoltageMaximumVrms);
    expect(capacitor.facts.effectiveCapacitance.value).toBeNull();
    expect(capacitor.facts.biasDeratingRatio.value).toBeNull();
    expect(capacitor.facts.equivalentSeriesResistance.value).toBeNull();
    expect(capacitor.facts.rippleCurrent.value).toBeNull();
    expect(capacitorBinding.reviewedOperatingConditionStatus).toBe("outside_or_unproved");

    expect(inductor.part).toEqual({
      manufacturerId: inductorBinding.manufacturerId,
      manufacturerPartNumber: inductorBinding.manufacturerPartNumber,
    });
    expect(inductor.facts.inductance.value).toEqual(expect.objectContaining(inductorBinding.nominalValue));
    expect(inductor.facts.inductance.evidence.some((entry) => entry.contentHash === inductorBinding.nominalEvidenceContentHash)).toBe(true);
    const frequencyCondition = inductor.facts.inductance.validFor.find((entry) => entry.parameterId === "switchingFrequency");
    const voltageCondition = inductor.facts.inductance.validFor.find((entry) => entry.parameterId === "testVoltage");
    expect(frequencyCondition?.minimum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalInductanceTestFrequencyHz);
    expect(frequencyCondition?.maximum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalInductanceTestFrequencyHz);
    expect(voltageCondition?.minimum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalInductanceTestVoltageVrms);
    expect(voltageCondition?.maximum?.value).toBe(CONTRACT.case.observationContract.reviewedNominalInductanceTestVoltageVrms);
    expect(inductorBinding.reviewedOperatingConditionStatus).toBe("outside");
  });
});
