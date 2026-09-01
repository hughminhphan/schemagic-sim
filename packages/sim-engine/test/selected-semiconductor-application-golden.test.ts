import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DesignExecutionReportV2 } from "@opencircuit/design-engine/v2-motor-runtime";
import type {
  BrushedDcMotorDesignRequestV2,
  ConstraintDecisionV3,
  DesignResultV2,
} from "@opencircuit/design-schema";
import { getMotorDesignContextManifestV2 } from "@opencircuit/motor-designer/v2";

interface SelectedSemiconductorContract {
  format: "opencircuit-selected-semiconductor-application-golden-contract";
  schemaVersion: 1;
  engines: {
    native: { version: "ngspice-46"; solverClaim: "unverified" };
    browserWasm: {
      module: "../../ngspice-wasm-build/dist-loader/index.mjs";
      engineVersion: "ngspice-46-opencircuit-wasm1";
      simulatorVersion: "ngspice-46";
      solver: "KLU";
    };
  };
  evidenceBoundary: {
    modelTier: "F1";
    attestation: "none";
    productionProfilesUsed: true;
    productionObservationCandidateEligible: false;
    benchOperatingConditionsWithinReviewedEvidence: true;
    productionRequestConditionsEvaluated: false;
    productionConstraintEligibility: false;
    rankingAuthority: false;
    fullBomCoverage: false;
    claim: string;
    purpose: string;
    doesNotProve: string[];
  };
  case: {
    id: string;
    application: "motor.brushed-dc";
    presetId: "motor.external-24v";
    observationKind: "production_constraint_observation";
    candidateId: string;
    candidateIndex: 0;
    recipe: { id: string; version: string; contentHash: `sha256:${string}` };
    requestHash: `sha256:${string}`;
    resultContentHash: `sha256:${string}`;
    constraintDecisionContentHash: `sha256:${string}`;
    library: {
      version: string;
      contextManifestContentHash: `sha256:${string}`;
      sourceReleaseContentHash: `sha256:${string}`;
    };
    selectedBinding: {
      selectedComponentId: "mosfet";
      role: "bridge-n-channel-power-mosfet";
      profileId: string;
      profileContentHash: `sha256:${string}`;
      manufacturerId: "texas-instruments";
      manufacturerPartNumber: "CSD18540Q5B";
      quantityPerAssembly: 4;
      catalogAdmissionState: "reviewed";
    };
    modelBinding: {
      packageId: "texas-instruments/CSD18540Q5B";
      packagePath: string;
      componentContentHash: `sha256:${string}`;
      factsContentHash: `sha256:${string}`;
      fittedContentHash: `sha256:${string}`;
      modelContentHash: `sha256:${string}`;
      sourcesContentHash: `sha256:${string}`;
      validationResultsContentHash: `sha256:${string}`;
      expectationsContentHash: `sha256:${string}`;
      modelName: "OC_TEXAS-INSTRUMENTS_CSD18540Q5B";
      modelType: "dot_model";
      fidelityTier: "F1";
      electricalFamily: "nmos";
      evidenceContractVersion: "1.0.0";
      generator: "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0";
      reviewer: "gpt-5.6-sol independent package reviewer";
      supportedAnalyses: ["operating_point"];
      domainCoverage: {
        dc: "approx";
        ac: "none";
        transient: "none";
        noise: "none";
        thermal: "none";
        digital: "none";
      };
      strictAdmission: true;
    };
    sourceBinding: {
      kind: "datasheet";
      url: "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf";
      revision: "SLPS488B, June 2014, revised April 2017; packaged PDF generated 2025-11-11";
      sha256: "2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0";
      pagesReferenced: ["1", "3", "11"];
    };
    benchId: string;
    analysis: "op";
    fixture: string;
    netlistContentHash: `sha256:${string}`;
    selectedVectors: ["v(d1)", "v(d2)", "v(d3)", "v(d4)"];
    observationContract: {
      kind: "four-selected-quantity-f1-rdson-at-reviewed-table-point";
      instanceCount: 4;
      temperatureC: 25;
      gateVoltageV: 10;
      forcedDrainCurrentA: 28;
      reviewedMaximumRdsOhm: 0.0022;
      conditionId: `sha256:${string}`;
      resistanceEvidenceId: `sha256:${string}`;
      maximumInstanceSpreadOhm: 1e-12;
      maximumCrossEngineRdsRelativeDifference: 1e-6;
      productionRequestConditions: {
        ambientTemperatureC: 40;
        loadCurrentA: 5;
        stallCurrentA: 20;
        supplyMinimumV: 18;
        supplyNominalV: 24;
        supplyMaximumV: 30;
        pwmFrequencyHz: 20000;
        dutyCycle: 0.8;
        evaluated: false;
      };
      interpretation: "reviewed_dc_table_point_only_not_production_request_conditions";
    };
  };
}

interface CatalogRelease {
  version: string;
  contentHash: `sha256:${string}`;
  profiles: Array<{
    profileId: string;
    profilePath: string;
    part: { manufacturerId: string; manufacturerPartNumber: string };
    profileContentHash: `sha256:${string}`;
  }>;
}

interface AdmissionLedger {
  entries: Array<{
    profilePath: string;
    state: string;
    profileContentHash: string;
    reviewedBy?: string;
  }>;
}

interface MosfetProfile {
  part: { manufacturerId: string; manufacturerPartNumber: string };
  facts: {
    onResistance: {
      value: { value: number; unit: string };
      state: string;
      evidence: Array<{ contentHash?: string; url?: string }>;
      validFor: Array<{
        parameterId: string;
        minimum: { value: number; unit: string } | null;
        maximum: { value: number; unit: string } | null;
      }>;
    };
    riseTime: { state: string; value: unknown };
    fallTime: { state: string; value: unknown };
    reverseRecoveryCharge: { state: string; value: unknown };
  };
}

interface ModelComponent {
  canonical_mpn: string;
  manufacturer: string;
  electrical_family: string;
  evidence_contract_version: string;
  model_type: string;
  fidelity_tier: string;
  domain_coverage: Record<string, string>;
  supported_analyses: string[];
  generator: { tool_or_agent: string };
  reviewer: { tool_or_agent: string };
  test_results: { status: string; pass_count: number; fail_count: number; total_count: number };
  licence: { spdx_id: string; provenance_basis: string };
}

interface ModelSource {
  kind: string;
  url: string;
  revision: string;
  sha256: string;
  pages_referenced: string[];
  placeholder: boolean;
}

interface ValidationResults {
  native_wasm_all_pass: boolean;
  expectations_all_pass: boolean;
  expectation_pass_count: number;
  expectation_fail_count: number;
  artifact_hashes: { model_cir: string };
  benches: Array<{ native_wasm_pass: boolean; checks: Array<{ pass: boolean }> }>;
}

interface ModelExpectations {
  evidence_cohorts: Array<{
    cohort_id: string;
    fidelity_tier: string;
    evidence_ids: string[];
  }>;
  tests: Array<{
    analysis_type: string;
    hard_bounds_checks: Array<{
      maximum?: number;
      evidence_id?: string;
      condition_id?: string;
      bench_condition_id?: string;
    }>;
  }>;
}

interface DesignerMotorAdapter {
  application: "motor.brushed-dc";
  presets: ReadonlyArray<{ id: string; createRequest(): BrushedDcMotorDesignRequestV2 }>;
  generate(request: BrushedDcMotorDesignRequestV2): Promise<{
    kind: string;
    result: Readonly<DesignResultV2>;
    execution: Readonly<DesignExecutionReportV2>;
    constraintDecision?: Readonly<ConstraintDecisionV3>;
  }>;
}

const CONTRACT_URL = new URL(
  "../../../tools/native-ngspice-reference/selected-semiconductor-application-golden/contract.json",
  import.meta.url,
);
const MODEL_COMPONENT_URL = new URL(
  "../../../packages/model-library/models/texas-instruments/CSD18540Q5B/component.json",
  import.meta.url,
);
const CONTRACT_PRESENT = existsSync(CONTRACT_URL);
const MODEL_PACKAGE_PRESENT = existsSync(MODEL_COMPONENT_URL);
const CURRENT_GOLDEN_PRESENT = CONTRACT_PRESENT && MODEL_PACKAGE_PRESENT;
const CONTRACT = CONTRACT_PRESENT
  ? JSON.parse(readFileSync(CONTRACT_URL, "utf8")) as SelectedSemiconductorContract
  : undefined as unknown as SelectedSemiconductorContract;
const CATALOG_RELEASE = JSON.parse(readFileSync(new URL("../../../packages/design-library/catalog-release.json", import.meta.url), "utf8")) as CatalogRelease;
const ADMISSION = JSON.parse(readFileSync(new URL("../../../packages/design-library/admission.json", import.meta.url), "utf8")) as AdmissionLedger;

function sha256(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function repositoryUrl(path: string): URL {
  return new URL(`../../../${path}`, import.meta.url);
}

function packageText(relativePath: string): string {
  return readFileSync(repositoryUrl(`${CONTRACT.case.modelBinding.packagePath}/${relativePath}`), "utf8");
}

function expectedFixture(modelText: string): string {
  const lines = [
    "scheMAGIC selected semiconductor F1 reviewed DC operating point",
    "* exact selected quantity: four CSD18540Q5B instances",
    "* reviewed table point only: TA=25C, VGS=10V, ID=28A",
    "* not the 40C/5A/18-30V/20kHz/80%-duty production request",
    modelText.trimEnd(),
    "",
    ".temp 25",
  ];
  for (let index = 1; index <= 4; index += 1) {
    lines.push(
      `M${index} d${index} g${index} 0 ${CONTRACT.case.modelBinding.modelName}`,
      `I${index} 0 d${index} DC 28`,
      `VG${index} g${index} 0 DC 10`,
    );
  }
  lines.push(".op", ".end", "");
  return lines.join("\n");
}

async function currentExternalMotorObservation(presetId = "motor.external-24v"): Promise<{
  adapter: DesignerMotorAdapter;
  strict: Awaited<ReturnType<DesignerMotorAdapter["generate"]>>;
  permissive: Awaited<ReturnType<DesignerMotorAdapter["generate"]>>;
}> {
  const moduleUrl = new URL("../../../apps/web/src/features/designer/applications.ts", import.meta.url);
  const module = await import(/* @vite-ignore */ moduleUrl.href) as { motorDesignerAdapter(): DesignerMotorAdapter };
  const adapter = module.motorDesignerAdapter();
  const preset = adapter.presets.find((entry) => entry.id === presetId);
  if (!preset) throw new Error(`Missing exact Motor preset ${presetId}`);
  const strictRequest = structuredClone(preset.createRequest());
  const strict = await adapter.generate(strictRequest);
  const permissiveRequest = structuredClone(strictRequest);
  permissiveRequest.constraints.allowUnknownHardConstraints = true;
  const permissive = await adapter.generate(permissiveRequest);
  return { adapter, strict, permissive };
}

describe.runIf(!CURRENT_GOLDEN_PRESENT)("current selected-semiconductor production blocker", () => {
  it("keeps the absent package detached from the current ineligible external-Motor observations", async () => {
    expect(CONTRACT_PRESENT).toBe(false);
    expect(MODEL_PACKAGE_PRESENT).toBe(false);

    const manifest = getMotorDesignContextManifestV2();
    expect(manifest.contentHash).toBe("sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38");
    expect(manifest.catalog).toMatchObject({
      version: "2026-08-27.2",
      sourceReleaseContentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    });
    expect(manifest.recipes).toContainEqual(expect.objectContaining({
      id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      version: "3.1.7",
      contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
    }));

    const { strict, permissive } = await currentExternalMotorObservation();
    expect(strict.result).toMatchObject({
      requestHash: "sha256:2fd2159070a51d75077ea7e2d7aa968af94728cc3d869aaf42f9dfc0be13d563",
      contentHash: "sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435",
      candidates: [],
    });
    expect(strict.execution.counts).toMatchObject({ enumerated: 54, checked: 54, materialized: 0, rejected: 54 });
    expect(strict.execution.rejections).toHaveLength(54);
    expect(strict.execution.rejections.every((rejection) => (
      rejection.reasonCode === "unknown_constraint_disallowed"
      && rejection.constraints?.some((constraint) => (
        constraint.ruleId === "motor.external.gate-network" && constraint.status === "unknown"
      ))
    ))).toBe(true);
    expect(permissive.result).toMatchObject({
      requestHash: "sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f",
      contentHash: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176",
    });
    expect(permissive.result.candidates.map((candidate) => candidate.id)).toEqual([
      "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed",
      "candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70",
    ]);
    expect(permissive.execution.counts).toMatchObject({ enumerated: 54, materialized: 54, pareto: 2, rejected: 52 });
    expect(permissive.result.candidates.every((candidate) => (
      candidate.components.every((component) => component.id !== "gate-resistor" && component.role !== "mosfet-gate-resistor")
      && candidate.components.some((component) => component.id === "bootstrap-capacitor" && component.quantityPerAssembly === 2)
      && candidate.components.some((component) => component.id === "local-decoupling" && component.quantityPerAssembly === 1)
      && candidate.constraints.some((constraint) => (
        constraint.ruleId === "motor.external.gate-network" && constraint.status === "unknown"
      ))
      && candidate.constraints.some((constraint) => (
        constraint.ruleId === "motor.external.bootstrap-capacitance-nominal" && constraint.status === "pass"
      ))
      && candidate.constraints.some((constraint) => (
        constraint.ruleId === "motor.external.bootstrap-capacitance" && constraint.status === "unknown"
      ))
      && candidate.constraints.some((constraint) => (
        constraint.ruleId === "motor.external.local-capacitance-effective" && constraint.status === "unknown"
      ))
      && candidate.constraints.filter((constraint) => constraint.status === "pass").length === 9
      && candidate.constraints.filter((constraint) => constraint.status === "unknown").length === 21
      && candidate.constraints.filter((constraint) => constraint.status === "fail").length === 0
    ))).toBe(true);
    if (permissive.constraintDecision === undefined) {
      throw new Error("Expected the installed external-Motor V3 constraint decision");
    }
    expect(permissive.constraintDecision).toMatchObject({
      contentHash: "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e",
      eligibleCandidateIds: [],
    });
    expect(permissive.constraintDecision.candidates).toHaveLength(2);
    expect(permissive.constraintDecision.candidates.every((candidate) => candidate.eligible === false)).toBe(true);
  }, 60_000);
});

describe.runIf(CURRENT_GOLDEN_PRESENT)("production-selected CSD18540Q5B native/WASM golden identity", () => {
  it("keeps the evidence claim at a reviewed F1 DC table point and explicitly outside production-request authority", () => {
    expect(CONTRACT).toEqual(expect.objectContaining({
      format: "opencircuit-selected-semiconductor-application-golden-contract",
      schemaVersion: 1,
      engines: {
        native: { version: "ngspice-46", solverClaim: "unverified" },
        browserWasm: expect.objectContaining({
          module: "../../ngspice-wasm-build/dist-loader/index.mjs",
          engineVersion: "ngspice-46-opencircuit-wasm1",
          simulatorVersion: "ngspice-46",
          solver: "KLU",
        }),
      },
      evidenceBoundary: expect.objectContaining({
        modelTier: "F1",
        attestation: "none",
        productionProfilesUsed: true,
        productionObservationCandidateEligible: false,
        benchOperatingConditionsWithinReviewedEvidence: true,
        productionRequestConditionsEvaluated: false,
        productionConstraintEligibility: false,
        rankingAuthority: false,
        fullBomCoverage: false,
      }),
    }));
    const exclusions = CONTRACT.evidenceBoundary.doesNotProve.join("\n");
    expect(exclusions).toMatch(/production request.*40.*5 A.*18.*30 V.*20 kHz.*duty/iu);
    expect(exclusions).toMatch(/switching.*transient.*Miller.*reverse recovery.*body diode/iu);
    expect(exclusions).toMatch(/avalanche.*SOA.*thermal.*self-heating.*parasitic/iu);
    expect(exclusions).toMatch(/gate driver.*TVS.*motor.*passive.*full BOM/iu);
    expect(exclusions).toMatch(/eligibility.*ranking.*safety.*release readiness/iu);
    expect(CONTRACT.case.observationContract).toMatchObject({
      kind: "four-selected-quantity-f1-rdson-at-reviewed-table-point",
      instanceCount: 4,
      temperatureC: 25,
      gateVoltageV: 10,
      forcedDrainCurrentA: 28,
      reviewedMaximumRdsOhm: 0.0022,
      maximumInstanceSpreadOhm: 1e-12,
      maximumCrossEngineRdsRelativeDifference: 1e-6,
      productionRequestConditions: {
        ambientTemperatureC: 40,
        loadCurrentA: 5,
        stallCurrentA: 20,
        supplyMinimumV: 18,
        supplyNominalV: 24,
        supplyMaximumV: 30,
        pwmFrequencyHz: 20_000,
        dutyCycle: 0.8,
        evaluated: false,
      },
      interpretation: "reviewed_dc_table_point_only_not_production_request_conditions",
    });
    expect(CONTRACT.case.sourceBinding).toEqual({
      kind: "datasheet",
      url: "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf",
      revision: "SLPS488B, June 2014, revised April 2017; packaged PDF generated 2025-11-11",
      sha256: "2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0",
      pagesReferenced: ["1", "3", "11"],
    });
    expect(CONTRACT.case.modelBinding).toMatchObject({
      generator: "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0",
      reviewer: "gpt-5.6-sol independent package reviewer",
      supportedAnalyses: ["operating_point"],
    });
  });

  it("regenerates the exact ineligible production-context observation candidate and selected quantity four", async () => {
    const { adapter, strict, permissive } = await currentExternalMotorObservation();
    expect(adapter.application).toBe("motor.brushed-dc");
    expect(strict.result.candidates).toEqual([]);
    expect(permissive.kind).toBe(CONTRACT.case.observationKind);
    expect(permissive.result.requestHash).toBe(CONTRACT.case.requestHash);
    expect(permissive.result.contentHash).toBe(CONTRACT.case.resultContentHash);
    expect(permissive.result.libraryVersion).toBe(CONTRACT.case.library.version);
    expect(permissive.result.libraryContentHash).toBe(CONTRACT.case.library.contextManifestContentHash);
    expect(permissive.constraintDecision?.contentHash).toBe(CONTRACT.case.constraintDecisionContentHash);
    expect(permissive.constraintDecision?.eligibleCandidateIds).toEqual([]);

    const candidate = permissive.result.candidates[CONTRACT.case.candidateIndex];
    if (!candidate) throw new Error("Missing exact selected-semiconductor observation candidate");
    expect(candidate.id).toBe(CONTRACT.case.candidateId);
    expect(candidate.recipeId).toBe(CONTRACT.case.recipe.id);
    expect(permissive.constraintDecision?.candidates.find((entry) => entry.candidateId === candidate.id)).toEqual(expect.objectContaining({
      candidateId: candidate.id,
      eligible: false,
      recipeId: CONTRACT.case.recipe.id,
      recipeContentHash: CONTRACT.case.recipe.contentHash,
    }));
    const selected = candidate.components.filter((entry) => entry.id === CONTRACT.case.selectedBinding.selectedComponentId);
    expect(selected).toEqual([expect.objectContaining({
      id: "mosfet",
      role: CONTRACT.case.selectedBinding.role,
      profileId: CONTRACT.case.selectedBinding.profileId,
      part: {
        manufacturerId: CONTRACT.case.selectedBinding.manufacturerId,
        manufacturerPartNumber: CONTRACT.case.selectedBinding.manufacturerPartNumber,
      },
      quantityPerAssembly: 4,
    })]);
    expect(candidate.simulationCoverage.find((entry) => entry.scenarioId === "selected_part_model")).toEqual(expect.objectContaining({
      modelTier: "unavailable",
      limitations: [expect.stringMatching(/No reviewed executable gate-driver, MOSFET, TVS, parasitic, motor, or switching model/iu)],
    }));

    const manifest = getMotorDesignContextManifestV2();
    expect(manifest.contentHash).toBe(CONTRACT.case.library.contextManifestContentHash);
    expect(manifest.catalog.sourceReleaseContentHash).toBe(CONTRACT.case.library.sourceReleaseContentHash);
    expect(manifest.recipes.find((entry) => entry.id === candidate.recipeId)).toEqual(expect.objectContaining(CONTRACT.case.recipe));
  }, 60_000);

  it("binds the exact reviewed profile, model package, source bytes, and four-instance fixture", () => {
    expect(CATALOG_RELEASE.version).toBe(CONTRACT.case.library.version);
    expect(CATALOG_RELEASE.contentHash).toBe(CONTRACT.case.library.sourceReleaseContentHash);
    expect(CATALOG_RELEASE.profiles.find((entry) => entry.profileId === CONTRACT.case.selectedBinding.profileId)).toEqual(expect.objectContaining({
      profileId: CONTRACT.case.selectedBinding.profileId,
      profilePath: CONTRACT.case.selectedBinding.profileId,
      part: {
        manufacturerId: CONTRACT.case.selectedBinding.manufacturerId,
        manufacturerPartNumber: CONTRACT.case.selectedBinding.manufacturerPartNumber,
      },
      profileContentHash: CONTRACT.case.selectedBinding.profileContentHash,
    }));
    expect(ADMISSION.entries.find((entry) => entry.profilePath === CONTRACT.case.selectedBinding.profileId)).toEqual(expect.objectContaining({
      state: "reviewed",
      profileContentHash: CONTRACT.case.selectedBinding.profileContentHash,
    }));

    const profile = JSON.parse(readFileSync(repositoryUrl(CONTRACT.case.selectedBinding.profileId), "utf8")) as MosfetProfile;
    expect(profile.part).toEqual({ manufacturerId: "texas-instruments", manufacturerPartNumber: "CSD18540Q5B" });
    expect(profile.facts.onResistance).toEqual(expect.objectContaining({
      state: "reviewed",
      value: expect.objectContaining({ value: 0.0022, unit: "ohm" }),
    }));
    expect(profile.facts.onResistance.evidence).toContainEqual(expect.objectContaining({
      contentHash: `sha256:${CONTRACT.case.sourceBinding.sha256}`,
      url: CONTRACT.case.sourceBinding.url,
    }));
    for (const [parameterId, value, unit] of [
      ["ambientTemperature", 298.15, "K"],
      ["drainCurrent", 28, "A"],
      ["gateVoltage", 10, "V"],
    ] as const) {
      expect(profile.facts.onResistance.validFor.find((entry) => entry.parameterId === parameterId)).toEqual(expect.objectContaining({
        minimum: expect.objectContaining({ value, unit }),
        maximum: expect.objectContaining({ value, unit }),
      }));
    }
    for (const unknown of [profile.facts.riseTime, profile.facts.fallTime, profile.facts.reverseRecoveryCharge]) {
      expect(unknown).toMatchObject({ state: "unknown", value: null });
    }

    const componentText = packageText("component.json");
    const factsText = packageText("facts.json");
    const fittedText = packageText("fitted.json");
    const modelText = packageText("model.cir");
    const sourcesText = packageText("sources.json");
    const validationText = packageText("validation-results.json");
    const expectationsText = packageText("tests/expectations.json");
    expect(CONTRACT.case.modelBinding).toEqual(expect.objectContaining({
      componentContentHash: sha256(componentText),
      factsContentHash: sha256(factsText),
      fittedContentHash: sha256(fittedText),
      modelContentHash: sha256(modelText),
      sourcesContentHash: sha256(sourcesText),
      validationResultsContentHash: sha256(validationText),
      expectationsContentHash: sha256(expectationsText),
    }));

    const component = JSON.parse(componentText) as ModelComponent;
    expect(component).toEqual(expect.objectContaining({
      canonical_mpn: "CSD18540Q5B",
      manufacturer: "Texas Instruments",
      electrical_family: "nmos",
      evidence_contract_version: "1.0.0",
      model_type: "dot_model",
      fidelity_tier: "F1",
      domain_coverage: CONTRACT.case.modelBinding.domainCoverage,
      supported_analyses: CONTRACT.case.modelBinding.supportedAnalyses,
      licence: { spdx_id: "MIT", provenance_basis: "original_from_facts" },
    }));
    expect(component.generator.tool_or_agent).toBe(CONTRACT.case.modelBinding.generator);
    expect(component.reviewer.tool_or_agent).toBe(CONTRACT.case.modelBinding.reviewer);
    expect(component.reviewer.tool_or_agent).not.toBe(component.generator.tool_or_agent);
    expect(component.reviewer.tool_or_agent).not.toMatch(/pending/iu);
    expect(component.test_results).toMatchObject({ status: "complete", fail_count: 0 });
    expect(component.test_results.pass_count).toBe(component.test_results.total_count);

    const sources = JSON.parse(sourcesText) as ModelSource[];
    expect(sources).toEqual([expect.objectContaining({
      kind: CONTRACT.case.sourceBinding.kind,
      url: CONTRACT.case.sourceBinding.url,
      revision: CONTRACT.case.sourceBinding.revision,
      sha256: CONTRACT.case.sourceBinding.sha256,
      pages_referenced: CONTRACT.case.sourceBinding.pagesReferenced,
      placeholder: false,
    })]);
    const validation = JSON.parse(validationText) as ValidationResults;
    expect(validation).toMatchObject({ native_wasm_all_pass: true, expectations_all_pass: true, expectation_fail_count: 0 });
    expect(validation.artifact_hashes.model_cir).toBe(CONTRACT.case.modelBinding.modelContentHash);
    expect(validation.expectation_pass_count).toBeGreaterThan(0);
    expect(validation.benches.length).toBeGreaterThan(0);
    expect(validation.benches.every((bench) => bench.native_wasm_pass && bench.checks.every((check) => check.pass))).toBe(true);

    const expectations = JSON.parse(expectationsText) as ModelExpectations;
    expect(expectations.evidence_cohorts.map((entry) => ({
      cohort_id: entry.cohort_id,
      fidelity_tier: entry.fidelity_tier,
      evidence_ids: entry.evidence_ids,
    }))).toEqual([
      {
        cohort_id: "sha256:02b284f52a9973b82b3a440a0f5d4461bea078e4c34f34f3761c9f0cdc933d89",
        fidelity_tier: "F1",
        evidence_ids: ["sha256:cd106948f4a3205f7238690b5bd1cde3af99a32125edb10874af70c3b10ce6d3"],
      },
      {
        cohort_id: "sha256:eb68271ddc9729ee19cfb3bb44aa0c5ba4d4134252043fa463e8e50da57d5615",
        fidelity_tier: "F1",
        evidence_ids: ["sha256:19133942b07fa7ec8aeb66d49d0039dcf1b57358b9631f6eac4ee121f59513f0"],
      },
      {
        cohort_id: "sha256:f1f021bf67ae0521041b2438945e13ea99d77dff4e92f8b47b8409aeaf9ebe7a",
        fidelity_tier: "F1",
        evidence_ids: [
          "sha256:c6554cce55d6c54b3c2ea46ec96c17f5523cec2e21c4093dcdf3a990ecf273db",
          "sha256:df51d02877ef95c19fcb8b751bad82db8e17349a42e69b07386a8e1e1bf56d4a",
          "sha256:6e675e85780c42ebedf5133e9ced47c54ad22c4ec572da1d0ebfe8fcbd9ceea8",
        ],
      },
    ]);
    const reviewedPoint = expectations.tests
      .filter((entry) => entry.analysis_type === "operating_point")
      .flatMap((entry) => entry.hard_bounds_checks)
      .find((entry) => entry.maximum === CONTRACT.case.observationContract.reviewedMaximumRdsOhm);
    expect(reviewedPoint).toEqual(expect.objectContaining({
      maximum: 0.0022,
      evidence_id: CONTRACT.case.observationContract.resistanceEvidenceId,
      condition_id: CONTRACT.case.observationContract.conditionId,
      bench_condition_id: CONTRACT.case.observationContract.conditionId,
    }));

    const admissionPolicy = JSON.parse(readFileSync(repositoryUrl("packages/model-library/admission-policy.json"), "utf8")) as {
      legacy_inventory: { packages: string[] };
      strict_evidence_contract_packages: string[];
    };
    expect(admissionPolicy.strict_evidence_contract_packages).toContain(CONTRACT.case.modelBinding.packageId);
    expect(admissionPolicy.legacy_inventory.packages).not.toContain(CONTRACT.case.modelBinding.packageId);

    const fixture = readFileSync(new URL(`../../../tools/native-ngspice-reference/selected-semiconductor-application-golden/${CONTRACT.case.fixture}`, import.meta.url), "utf8");
    expect(fixture).toBe(expectedFixture(modelText));
    expect(sha256(fixture)).toBe(CONTRACT.case.netlistContentHash);
    expect(fixture.match(/^M[1-4]\s+d[1-4]\s+g[1-4]\s+0\s+OC_TEXAS-INSTRUMENTS_CSD18540Q5B$/gmu)).toHaveLength(4);
    expect(fixture).toContain(".temp 25");
    expect(fixture).toContain(".op");
    expect(fixture).not.toMatch(/^\.(?:tran|ac|noise)\b/imu);
  });
});
