import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DesignExecutionReportV2 } from "@opencircuit/design-engine/v2-motor-runtime";
import type {
  BrushedDcMotorDesignRequestV2,
  ConstraintDecisionV3,
  DesignResultV2,
} from "@opencircuit/design-schema";
import { getMotorDesignContextManifestV2 } from "@opencircuit/motor-designer/v2";

interface ProjectionContract {
  format: "opencircuit-selected-semiconductor-rdson-projection-contract";
  schemaVersion: 1;
  evidenceBoundary: {
    projectionKind: "ideal_reviewed_maximum_rdson_resistors";
    attestation: "none";
    productionProfileUsed: true;
    currentProductionObservationIdentity: true;
    selectedPartDeviceEquationUsed: false;
    physicalFidelityProved: false;
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
    currentIdentity: {
      requestHash: `sha256:${string}`;
      resultContentHash: `sha256:${string}`;
      constraintDecisionContentHash: `sha256:${string}`;
      candidateId: `candidate:v2:sha256:${string}`;
      candidateIndex: 0;
      candidateEligible: false;
      recipe: { id: string; version: string; contentHash: `sha256:${string}` };
      library: {
        version: string;
        contextManifestContentHash: `sha256:${string}`;
        catalogReleaseContentHash: `sha256:${string}`;
      };
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
    sourceBinding: {
      kind: "manufacturer_datasheet";
      url: string;
      revision: string;
      contentHash: `sha256:${string}`;
      locator: string;
    };
    analysis: "op";
    fixture: string;
    netlistContentHash: `sha256:${string}`;
    selectedVectors: ["v(d1)", "v(d2)", "v(d3)", "v(d4)"];
    projectionContract: {
      kind: "four-ideal-reviewed-maximum-rdson-resistors";
      instanceCount: 4;
      temperatureC: 25;
      gateConditionVoltageV: 10;
      forcedCurrentA: 28;
      reviewedMaximumRdsOhm: 0.0022;
      expectedVoltageDropV: 0.0616;
      maximumVoltageDropAbsoluteErrorV: number;
      maximumInstanceSpreadV: number;
      maximumCrossEngineVoltageDropRelativeDifference: number;
      interpretation: "ideal_reviewed_rdson_projection_only";
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
      value: { value: number; unit: string; displayUnit: string };
      state: string;
      evidence: Array<{
        contentHash?: string;
        url?: string;
        locator?: string;
        revision?: string;
      }>;
      validFor: Array<{
        parameterId: string;
        minimum: { value: number; unit: string } | null;
        maximum: { value: number; unit: string } | null;
      }>;
    };
  };
}

interface DesignerMotorAdapter {
  application: "motor.brushed-dc";
  presets: ReadonlyArray<{ id: string; createRequest(): BrushedDcMotorDesignRequestV2 }>;
  generate(request: BrushedDcMotorDesignRequestV2): Promise<{
    kind: string;
    contextManifestContentHash: string;
    result: Readonly<DesignResultV2>;
    execution: Readonly<DesignExecutionReportV2>;
    constraintDecision?: Readonly<ConstraintDecisionV3>;
  }>;
}

const CONTRACT_URL = new URL(
  "../../../tools/native-ngspice-reference/selected-semiconductor-rdson-projection/contract.json",
  import.meta.url,
);
const CONTRACT_TEXT = readFileSync(CONTRACT_URL, "utf8");
const CONTRACT = JSON.parse(CONTRACT_TEXT) as ProjectionContract;
const CATALOG_RELEASE = JSON.parse(readFileSync(
  new URL("../../../packages/design-library/catalog-release.json", import.meta.url),
  "utf8",
)) as CatalogRelease;
const ADMISSION = JSON.parse(readFileSync(
  new URL("../../../packages/design-library/admission.json", import.meta.url),
  "utf8",
)) as AdmissionLedger;
const PROFILE = JSON.parse(readFileSync(
  new URL(`../../../${CONTRACT.case.selectedBinding.profileId}`, import.meta.url),
  "utf8",
)) as MosfetProfile;
const FIXTURE = readFileSync(new URL(
  `../../../tools/native-ngspice-reference/selected-semiconductor-rdson-projection/${CONTRACT.case.fixture}`,
  import.meta.url,
), "utf8");

function sha256(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

async function currentExternalMotorObservation(): Promise<{
  adapter: DesignerMotorAdapter;
  observation: Awaited<ReturnType<DesignerMotorAdapter["generate"]>>;
}> {
  const moduleUrl = new URL("../../../apps/web/src/features/designer/applications.ts", import.meta.url);
  const module = await import(/* @vite-ignore */ moduleUrl.href) as { motorDesignerAdapter(): DesignerMotorAdapter };
  const adapter = module.motorDesignerAdapter();
  const preset = adapter.presets.find((entry) => entry.id === CONTRACT.case.presetId);
  if (!preset) throw new Error(`Missing exact Motor preset ${CONTRACT.case.presetId}`);
  const request = structuredClone(preset.createRequest());
  expect(request.constraints.allowUnknownHardConstraints).toBe(false);
  request.constraints.allowUnknownHardConstraints = true;
  return { adapter, observation: await adapter.generate(request) };
}

describe("current selected-semiconductor ideal reviewed-RDS(on) projection", () => {
  it("binds only the reviewed maximum resistance, its exact conditions, and four ideal resistor instances", () => {
    expect(CONTRACT).toMatchObject({
      format: "opencircuit-selected-semiconductor-rdson-projection-contract",
      schemaVersion: 1,
      evidenceBoundary: {
        projectionKind: "ideal_reviewed_maximum_rdson_resistors",
        attestation: "none",
        productionProfileUsed: true,
        currentProductionObservationIdentity: true,
        selectedPartDeviceEquationUsed: false,
        physicalFidelityProved: false,
        productionRequestConditionsEvaluated: false,
        productionConstraintEligibility: false,
        rankingAuthority: false,
        fullBomCoverage: false,
      },
    });
    expect(CONTRACT.evidenceBoundary.claim).toMatch(/ideal reviewed-RDS\(on\) projection.*four independent 2\.2 mOhm resistors.*25 C.*10 V.*28 A/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/transistor-equation.*selected-part SPICE fidelity/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/switching.*transient.*thermal.*parasitic/u);
    expect(CONTRACT.evidenceBoundary.doesNotProve.join("\n")).toMatch(/40 C.*5 A.*20 A.*18-30 V.*20 kHz.*80%-duty/u);

    expect(CATALOG_RELEASE).toMatchObject({
      version: CONTRACT.case.currentIdentity.library.version,
      contentHash: CONTRACT.case.currentIdentity.library.catalogReleaseContentHash,
    });
    expect(CATALOG_RELEASE.profiles).toContainEqual(expect.objectContaining({
      profileId: CONTRACT.case.selectedBinding.profileId,
      profilePath: CONTRACT.case.selectedBinding.profileId,
      profileContentHash: CONTRACT.case.selectedBinding.profileContentHash,
      part: {
        manufacturerId: CONTRACT.case.selectedBinding.manufacturerId,
        manufacturerPartNumber: CONTRACT.case.selectedBinding.manufacturerPartNumber,
      },
    }));
    expect(ADMISSION.entries).toContainEqual(expect.objectContaining({
      profilePath: CONTRACT.case.selectedBinding.profileId,
      profileContentHash: CONTRACT.case.selectedBinding.profileContentHash,
      state: "reviewed",
      reviewedBy: expect.any(String),
    }));
    expect(PROFILE.part).toEqual({
      manufacturerId: CONTRACT.case.selectedBinding.manufacturerId,
      manufacturerPartNumber: CONTRACT.case.selectedBinding.manufacturerPartNumber,
    });
    expect(PROFILE.facts.onResistance).toMatchObject({
      value: { value: 0.0022, unit: "ohm", displayUnit: "2.2 mOhm maximum" },
      state: "reviewed",
      evidence: [expect.objectContaining({
        contentHash: CONTRACT.case.sourceBinding.contentHash,
        url: CONTRACT.case.sourceBinding.url,
        locator: CONTRACT.case.sourceBinding.locator,
        revision: CONTRACT.case.sourceBinding.revision,
      })],
    });
    expect(PROFILE.facts.onResistance.validFor.map((entry) => ({
      parameterId: entry.parameterId,
      minimum: entry.minimum === null ? null : { value: entry.minimum.value, unit: entry.minimum.unit },
      maximum: entry.maximum === null ? null : { value: entry.maximum.value, unit: entry.maximum.unit },
    }))).toEqual([
      { parameterId: "ambientTemperature", minimum: { value: 298.15, unit: "K" }, maximum: { value: 298.15, unit: "K" } },
      { parameterId: "drainCurrent", minimum: { value: 28, unit: "A" }, maximum: { value: 28, unit: "A" } },
      { parameterId: "gateVoltage", minimum: { value: 10, unit: "V" }, maximum: { value: 10, unit: "V" } },
    ]);

    expect(CONTRACT.case.projectionContract).toEqual({
      kind: "four-ideal-reviewed-maximum-rdson-resistors",
      instanceCount: 4,
      temperatureC: 25,
      gateConditionVoltageV: 10,
      forcedCurrentA: 28,
      reviewedMaximumRdsOhm: 0.0022,
      expectedVoltageDropV: 0.0616,
      maximumVoltageDropAbsoluteErrorV: 1e-9,
      maximumInstanceSpreadV: 1e-12,
      maximumCrossEngineVoltageDropRelativeDifference: 1e-6,
      interpretation: "ideal_reviewed_rdson_projection_only",
    });
    expect(CONTRACT.case.projectionContract.expectedVoltageDropV).toBe(
      CONTRACT.case.projectionContract.forcedCurrentA * CONTRACT.case.projectionContract.reviewedMaximumRdsOhm,
    );
    expect(sha256(FIXTURE)).toBe(CONTRACT.case.netlistContentHash);
    expect(FIXTURE.match(/^R[1-4]\s+d[1-4]\s+0\s+2\.2m$/gmu)).toHaveLength(4);
    expect(FIXTURE.match(/^I[1-4]\s+0\s+d[1-4]\s+DC\s+28$/gmu)).toHaveLength(4);
    expect(FIXTURE).toContain(".temp 25");
    expect(FIXTURE).toContain("expected ideal voltage drop per instance: 61.6 mV");
    expect(FIXTURE).not.toMatch(/^[ \t]*\.(?:model|subckt|include|lib|tran|ac|noise)\b/imu);
    expect(FIXTURE).not.toMatch(/^M\S*\s/gmu);
    expect(sha256(CONTRACT_TEXT)).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("regenerates the exact current ineligible candidate and selected quantity without adding simulation authority", async () => {
    const manifest = getMotorDesignContextManifestV2();
    expect(manifest.contentHash).toBe(CONTRACT.case.currentIdentity.library.contextManifestContentHash);
    expect(manifest.catalog.sourceReleaseContentHash).toBe(CONTRACT.case.currentIdentity.library.catalogReleaseContentHash);
    expect(manifest.recipes).toContainEqual(expect.objectContaining(CONTRACT.case.currentIdentity.recipe));

    const { adapter, observation } = await currentExternalMotorObservation();
    expect(adapter.application).toBe(CONTRACT.case.application);
    expect(observation.kind).toBe(CONTRACT.case.observationKind);
    expect(observation.contextManifestContentHash).toBe(CONTRACT.case.currentIdentity.library.contextManifestContentHash);
    expect(observation.result.requestHash).toBe(CONTRACT.case.currentIdentity.requestHash);
    expect(observation.result.contentHash).toBe(CONTRACT.case.currentIdentity.resultContentHash);
    expect(observation.result.candidates[CONTRACT.case.currentIdentity.candidateIndex]?.id)
      .toBe(CONTRACT.case.currentIdentity.candidateId);
    const candidate = observation.result.candidates[CONTRACT.case.currentIdentity.candidateIndex]!;
    expect(candidate.recipeId).toBe(CONTRACT.case.currentIdentity.recipe.id);
    expect(candidate.components).toContainEqual(expect.objectContaining({
      id: CONTRACT.case.selectedBinding.selectedComponentId,
      role: CONTRACT.case.selectedBinding.role,
      profileId: CONTRACT.case.selectedBinding.profileId,
      quantityPerAssembly: CONTRACT.case.selectedBinding.quantityPerAssembly,
      part: {
        manufacturerId: CONTRACT.case.selectedBinding.manufacturerId,
        manufacturerPartNumber: CONTRACT.case.selectedBinding.manufacturerPartNumber,
      },
    }));
    if (observation.constraintDecision === undefined) throw new Error("Expected installed Motor V3 decision");
    expect(observation.constraintDecision.contentHash).toBe(CONTRACT.case.currentIdentity.constraintDecisionContentHash);
    expect(observation.constraintDecision.eligibleCandidateIds).not.toContain(candidate.id);
    expect(observation.constraintDecision.candidates).toContainEqual(expect.objectContaining({
      candidateId: candidate.id,
      eligible: CONTRACT.case.currentIdentity.candidateEligible,
    }));
    expect(candidate.constraints.some((entry) => entry.status === "unknown")).toBe(true);
    expect(CONTRACT.evidenceBoundary.productionConstraintEligibility).toBe(false);
    expect(CONTRACT.evidenceBoundary.rankingAuthority).toBe(false);
  }, 60_000);
});
