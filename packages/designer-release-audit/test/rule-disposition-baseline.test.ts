import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { designProfileEnvelopeContentHash, getBundledDesignLibraryDocuments } from "@opencircuit/design-library";
import { getMotorDesignContextManifestV2 } from "@opencircuit/motor-designer/v2";
import {
  assessSelectedSemiconductorRdsonProjectionIdentityBindingV1,
  buildDesignerReleaseReadinessReportV1,
} from "../src/index";
import { parseDesignerRuntimeContractV1 } from "../src/designer-runtime-audit";
import {
  assessDesignerRuleDispositionsV1,
  calculateRuleDispositionBaselineContentHashV1,
  collectDesignerRuleDispositionsV1,
  loadDesignerRuleDispositionBaselineV1,
} from "../src/rule-disposition-baseline";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function repoJson(relativePath: string): any {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

const PROFILE_PATH = "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";

/** Rebuilds the exact input the release audit feeds the identity assessor. */
function identityBindingInput() {
  const contract = repoJson("tools/native-ngspice-reference/selected-semiconductor-rdson-projection/contract.json");
  const documents = getBundledDesignLibraryDocuments();
  const release = documents.catalogRelease as any;
  const admission = documents.admission as any;
  const profile = (documents.profiles as Record<string, any>)[PROFILE_PATH];
  const testCase = contract.case;
  const manifest: any = getMotorDesignContextManifestV2();
  const installedRecipe = manifest.recipes.find((entry: any) => entry.id === testCase.currentIdentity.recipe.id);
  return {
    caseId: testCase.id as string,
    application: testCase.application as string,
    presetId: testCase.presetId as string,
    observationKind: testCase.observationKind as string,
    identity: testCase.currentIdentity,
    selectedBinding: testCase.selectedBinding,
    sourceBinding: testCase.sourceBinding,
    profilePath: PROFILE_PATH,
    profileManufacturerId: profile.part.manufacturerId as string,
    profileManufacturerPartNumber: profile.part.manufacturerPartNumber as string,
    onResistanceState: profile.facts.onResistance.state as string,
    onResistanceValue: profile.facts.onResistance.value.value as number,
    onResistanceUnit: profile.facts.onResistance.value.unit as string,
    onResistanceDisplayUnit: profile.facts.onResistance.value.displayUnit as string,
    onResistanceEvidence: profile.facts.onResistance.evidence,
    releaseVersion: release.version as string,
    catalogProfileContentHash: release.profiles.find((entry: any) => entry.profileId === PROFILE_PATH).profileContentHash as string,
    admissionState: admission.entries.find((entry: any) => entry.profilePath === PROFILE_PATH).state as string,
    admissionProfileContentHash: admission.entries.find((entry: any) => entry.profilePath === PROFILE_PATH).profileContentHash as string,
    admissionReviewedBy: admission.entries.find((entry: any) => entry.profilePath === PROFILE_PATH).reviewedBy,
    installedRecipe: installedRecipe === undefined ? undefined : {
      id: installedRecipe.id as string,
      version: installedRecipe.version as string,
      contentHash: installedRecipe.contentHash as string,
    },
    selectedProfileContentHash: designProfileEnvelopeContentHash(profile),
    exactProfileConditions: true,
  };
}

function runtimeContract(workloads: unknown[]) {
  const base = repoJson("apps/web/designer-runtime-contract.json");
  return { ...base, workloads, contentHash: base.contentHash };
}

describe("de-pinned release-audit property assertions", () => {
  it("keeps the ideal-RDS(on) identity binding valid when an unrelated profile is admitted", () => {
    const input = identityBindingInput();
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1(input)).toEqual({
      exactCurrentProductionObservationIdentity: true,
      exactReviewedProfileAndSource: true,
    });

    // Admitting one more reviewed profile changes the whole-catalog and
    // context-manifest identities the golden records. Neither determines this
    // MOSFET projection, so the binding must survive with zero audit edits.
    const admittedAnotherProfile = {
      ...input,
      identity: {
        ...input.identity,
        library: {
          ...input.identity.library,
          catalogReleaseContentHash: `sha256:${"a".repeat(64)}`,
          contextManifestContentHash: `sha256:${"b".repeat(64)}`,
        },
      },
    };
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1(admittedAnotherProfile)).toEqual({
      exactCurrentProductionObservationIdentity: true,
      exactReviewedProfileAndSource: true,
    });

    // A regenerated observation legitimately produces new request, result,
    // decision, and candidate identities. Those are shape-checked, not pinned.
    const regenerated = {
      ...input,
      identity: {
        ...input.identity,
        requestHash: `sha256:${"c".repeat(64)}`,
        resultContentHash: `sha256:${"d".repeat(64)}`,
        constraintDecisionContentHash: `sha256:${"e".repeat(64)}`,
        candidateId: `candidate:v2:sha256:${"f".repeat(64)}`,
      },
    };
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1(regenerated))
      .toMatchObject({ exactCurrentProductionObservationIdentity: true });
  });

  it("still fails closed on the things the golden actually depends on", () => {
    const input = identityBindingInput();

    // The selected profile's bytes changed under the golden.
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1({
      ...input,
      selectedProfileContentHash: `sha256:${"0".repeat(64)}`,
    }).exactReviewedProfileAndSource).toBe(false);

    // The catalog release no longer records that profile hash.
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1({
      ...input,
      catalogProfileContentHash: `sha256:${"1".repeat(64)}`,
    }).exactReviewedProfileAndSource).toBe(false);

    // The installed recipe drifted from the one the golden was generated under.
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1({
      ...input,
      installedRecipe: { ...input.installedRecipe!, contentHash: `sha256:${"2".repeat(64)}` },
    }).exactCurrentProductionObservationIdentity).toBe(false);
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1({
      ...input,
      installedRecipe: undefined,
    }).exactCurrentProductionObservationIdentity).toBe(false);

    // A malformed identity is still rejected: shape checking is not no checking.
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1({
      ...input,
      identity: { ...input.identity, candidateId: "candidate:v2:not-a-hash" },
    }).exactCurrentProductionObservationIdentity).toBe(false);
    expect(assessSelectedSemiconductorRdsonProjectionIdentityBindingV1({
      ...input,
      identity: { ...input.identity, candidateEligible: true },
    }).exactCurrentProductionObservationIdentity).toBe(false);
  });

  it("accepts N runtime workloads without pinning a count or a motor-then-power order", () => {
    const base = repoJson("apps/web/designer-runtime-contract.json");
    expect(parseDesignerRuntimeContractV1(base).workloads).toHaveLength(2);

    const motorOnly = runtimeContract([base.workloads[0]]);
    expect(() => parseDesignerRuntimeContractV1(motorOnly)).toThrow(/content_hash_mismatch/u);
    expect(() => parseDesignerRuntimeContractV1({ ...base, workloads: [] }))
      .toThrow(/contract\/workloads:invalid_length/u);
    expect(() => parseDesignerRuntimeContractV1(runtimeContract([base.workloads[0], base.workloads[0]])))
      .toThrow(/contract\/workloads:duplicate_workload/u);
    expect(() => parseDesignerRuntimeContractV1(runtimeContract([base.workloads[1], base.workloads[0]])))
      .toThrow(/contract\/workloads:invalid_order/u);
  });

  it("publishes a rule-disposition baseline gate bound to the installed catalog and recipes", () => {
    const report = buildDesignerReleaseReadinessReportV1();
    const gate = report.gates.find((entry) => entry.id === "eligibility.rule-disposition-baseline");
    expect(gate, "rule-disposition baseline gate is published").toBeDefined();
    expect(gate!.blockers).toEqual([]);
    expect(gate!.status).toBe("pass");
    const fixtures = gate!.evidence.fixtures as Array<{ fixtureId: string; candidateCount: number }>;
    expect(fixtures.map((entry) => entry.fixtureId).sort())
      .toEqual(["motor.m1-compact", "motor.m2-power", "power.p1-compact-browser-preset"]);
    for (const fixture of fixtures) expect(fixture.candidateCount, fixture.fixtureId).toBeGreaterThanOrEqual(1);
  });

  it("records the exact committed eligibility outcomes", () => {
    const baseline = loadDesignerRuleDispositionBaselineV1();
    expect(baseline).not.toBeNull();
    const fixture = (id: string) => baseline!.fixtures.find((entry) => entry.fixtureId === id)!;

    // Power buck: nine passing rules and thirteen unknowns on the retained
    // exact-BOM observation, no candidate eligible.
    expect(fixture("power.p1-compact-browser-preset").constraintStatusCounts).toEqual({ pass: 9, unknown: 13 });
    expect(fixture("power.p1-compact-browser-preset").eligibleCandidateCount).toBe(0);

    // External Motor: nine satisfied and twenty-one blocked required rules per
    // retained structural candidate, no candidate eligible.
    for (const candidate of fixture("motor.m2-power").candidates) {
      expect(candidate.rules.filter((rule) => rule.disposition === "satisfied")).toHaveLength(9);
      expect(candidate.rules.filter((rule) => rule.disposition !== "satisfied")).toHaveLength(21);
      expect(candidate.eligible).toBe(false);
    }
    expect(fixture("motor.m2-power").eligibleCandidateCount).toBe(0);
  });

  it("regenerates live dispositions and finds no rule regressed against the committed baseline", () => {
    const baseline = loadDesignerRuleDispositionBaselineV1();
    expect(baseline).not.toBeNull();
    expect(calculateRuleDispositionBaselineContentHashV1({
      format: baseline!.format,
      schemaVersion: baseline!.schemaVersion,
      generatedAgainst: baseline!.generatedAgainst,
      fixtures: baseline!.fixtures,
    })).toBe(baseline!.contentHash);

    const assessment = assessDesignerRuleDispositionsV1(collectDesignerRuleDispositionsV1(), baseline);
    expect(assessment.staleReasons).toEqual([]);
    expect(assessment.regressions).toEqual([]);
    expect(assessment.stale).toBe(false);
  }, 600_000);
});
