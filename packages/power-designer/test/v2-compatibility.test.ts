import { describe, expect, it } from "vitest";
import {
  buildReviewedProfileCatalogV2,
  canonicalDesignExecutionReportV2Payload,
  getInstalledRecipeRefsV2,
  parseDesignExecutionReportV2,
  parseElectricalDesignContextManifestV2,
  resolveInstalledRecipeRegistryV2,
  validateDesignResultExecutionContextV2,
  type DesignRecipeRefV2,
  type ReviewedProfileCatalogV2,
} from "@opencircuit/design-engine";
import {
  designProfileId,
  getBundledDesignLibraryDocuments,
  type DesignCatalogReleaseV1,
} from "@opencircuit/design-library";
import { migrateDesignRequestV1ToV2 } from "@opencircuit/design-schema";
import {
  POWER_DESIGN_V2_PRODUCTION_STATUS,
  assessPowerDesignV2ProductionReadiness,
  generateBuckDesignV2,
  getPowerDesignContextManifestV2,
  getPowerDesignContextV2,
} from "../src";
import { createP1CompactRequest, createP2HighVoltageRequest } from "../src/fixtures";
import { POWER_DESIGN_V2_PRODUCTION_STATUS as POWER_STATUS_SUBPATH } from "../src/v2-status";
import {
  createSyntheticPowerDesignContextV2ForTesting,
  generateSyntheticBuckDesignV2ForTesting,
} from "../src/v2-testing";

function expectDeepFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) expectDeepFrozen(child);
}

function installedRecipe(id: string): DesignRecipeRefV2 {
  const installed = getInstalledRecipeRefsV2("power.buck").find((recipe) => recipe.id === id);
  if (installed) return installed;
  const template = getInstalledRecipeRefsV2("power.buck")[0];
  if (!template) throw new Error("Expected an installed Power recipe template");
  return {
    ...template,
    id,
    version: id === "power.native.facts-v2"
      ? "2.0.0"
      : id === "power.native.external-fet-synchronous-buck.facts-v3"
        ? "3.0.0"
        : id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
          ? "3.4.6"
        : template.version,
  };
}

function factsV2CoverageCatalog(source: Readonly<ReviewedProfileCatalogV2>): ReviewedProfileCatalogV2 {
  const requiredClasses = [
    "power.external-fet-synchronous-buck-controller",
    "power.integrated-synchronous-buck-regulator",
    "power.power-inductor",
    "shared.general-purpose-resistor",
    "shared.mlcc-capacitor",
    "shared.n-channel-power-mosfet",
  ] as const;
  const profiles = requiredClasses.map((partClass) => {
    const profile = source.profiles.find((entry) => entry.partClass === partClass);
    if (!profile) throw new Error(`Synthetic Power catalog is missing ${partClass}`);
    return { ...structuredClone(profile), factsSchemaVersion: "2.0.0" as const };
  });
  const resistor = source.profiles.find((entry) => entry.partClass === "shared.general-purpose-resistor");
  if (!resistor) throw new Error("Synthetic Power catalog is missing a resistor template");
  profiles.push({
    ...structuredClone(resistor),
    partClass: "shared.current-sense-resistor",
    part: { ...resistor.part, manufacturerPartNumber: `${resistor.part.manufacturerPartNumber}-SENSE` },
    factsSchemaVersion: "2.0.0",
  } as unknown as (typeof profiles)[number]);
  return { ...source, profiles } as ReviewedProfileCatalogV2;
}

function externalFactsV3CoverageCatalog(source: Readonly<ReviewedProfileCatalogV2>): ReviewedProfileCatalogV2 {
  const catalog = structuredClone(factsV2CoverageCatalog(source)) as ReviewedProfileCatalogV2;
  const profiles = catalog.profiles.filter((profile) => (
    profile.partClass !== "power.integrated-synchronous-buck-regulator"
  ));
  for (const profile of profiles) {
    if (profile.partClass === "shared.n-channel-power-mosfet") {
      (profile as { factsSchemaVersion: string }).factsSchemaVersion = "3.0.0";
    }
  }
  return { ...catalog, profiles };
}

describe("Power Designer V2 compatibility release", () => {
  it("publishes a hash-verified ready context while strict P1 generation retains its exact evidence rejection", () => {
    const first = getPowerDesignContextManifestV2();
    const second = getPowerDesignContextManifestV2();
    expect(parseElectricalDesignContextManifestV2(first)).toEqual(first);
    expect(first.contentHash).toBe("sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3");
    expect(first.catalog).toEqual({
      version: "2026-08-27.2",
      contentHash: "sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890",
      sourceReleaseContentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    });
    expect(getBundledDesignLibraryDocuments().catalogRelease as DesignCatalogReleaseV1).toMatchObject({
      version: "2026-08-27.2",
      manufacturerRegistryContentHash: "sha256:bf74225d2500671e39cf0aff44fa8cd76d6795b25bc4302a3b117583bb611b47",
      admissionContentHash: "sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6",
      contentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.recipes.map((recipe) => `${recipe.id}@${recipe.version}`)).toEqual([
      "power.native.external-fet-synchronous-buck.facts-v3@3.0.0",
      "power.native.facts-v2@2.0.0",
      "power.native.integrated-synchronous-buck@1.0.0",
      "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6",
    ]);
    expect(resolveInstalledRecipeRegistryV2(first)).toBeDefined();
    expect(POWER_DESIGN_V2_PRODUCTION_STATUS).toEqual(expect.objectContaining({
      status: "ready",
      reason: null,
      catalogProfileCount: 24,
      reviewedProfileCount: 15,
      compatibleProfileCount: 14,
      installedRecipeSet: true,
      factsV2RecipeInstalled: true,
      readyRecipeIds: ["power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"],
      missingProfileRequirements: [
        "power.external-fet-synchronous-buck-controller@facts-2.0.0",
        "power.integrated-synchronous-buck-regulator@facts-1.0.0",
        "power.integrated-synchronous-buck-regulator@facts-2.0.0",
        "power.power-inductor@facts-1.0.0",
        "shared.general-purpose-resistor@facts-1.0.0",
        "shared.mlcc-capacitor@facts-1.0.0",
        "shared.n-channel-power-mosfet@facts-2.0.0",
      ],
    }));
    const productionReadiness = POWER_DESIGN_V2_PRODUCTION_STATUS.recipeReadiness.find((recipe) => (
      recipe.recipeId === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
    ));
    expect(productionReadiness).toMatchObject({ recipeVersion: "3.4.6", ready: true });
    expect(productionReadiness?.profileRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirementId: "power-inductor",
        partClass: "power.power-inductor",
        exactProfileContentHash: "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
        reviewedProfileCount: 1,
      }),
      expect.objectContaining({
        requirementId: "generic-mlcc-support",
        partClass: "shared.mlcc-capacitor",
        exactProfileContentHash: null,
        reviewedProfileCount: 5,
      }),
      expect.objectContaining({
        requirementId: "output-capacitor-bank",
        partClass: "shared.mlcc-capacitor",
        exactProfileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
        reviewedProfileCount: 1,
      }),
    ]));
    expectDeepFrozen(POWER_DESIGN_V2_PRODUCTION_STATUS);
    expect(POWER_STATUS_SUBPATH).toBe(POWER_DESIGN_V2_PRODUCTION_STATUS);
    expect(assessPowerDesignV2ProductionReadiness(
      buildReviewedProfileCatalogV2(getBundledDesignLibraryDocuments()),
      getInstalledRecipeRefsV2("power.buck"),
    )).toEqual(POWER_DESIGN_V2_PRODUCTION_STATUS);
    expect(getPowerDesignContextV2().manifest).toEqual(first);
    const v1 = createP1CompactRequest();
    const strict = generateBuckDesignV2({ ...v1, schemaVersion: 2, objective: "balanced", libraryVersion: first.version });
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.rejections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
        stage: "match",
        reasonCode: "recipe_rejected",
        message: expect.stringContaining("Feedback-divider selection is unknown"),
      }),
    ]));
  });

  it("keeps the qualified exact-BOM path at one deterministic unknown rejection in strict mode", () => {
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
    const migration = migrateDesignRequestV1ToV2(source, getPowerDesignContextManifestV2().version);
    if (migration.status !== "migrated" || migration.request.application !== "power.buck") throw new Error("Expected P1 migration");
    const strict = generateBuckDesignV2({
      ...migration.request,
      constraints: { ...migration.request.constraints, allowUnknownHardConstraints: false },
    });
    expect(strict.result.requestHash).toBe("sha256:ebaaa77210a40c2192dd8414dc05edb429d6ef5b45c1370f8a0e5d26e680050e");
    expect(strict.result.contentHash).toBe("sha256:8a79cbbbe0cae67c05808b352bf910d96ac521659c4847eaf5d9c9586ba10245");
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.counts).toEqual({
      recipes: 4,
      supportedRecipes: 3,
      enumerated: 1,
      solved: 1,
      matchOutcomes: 1,
      matched: 1,
      checked: 1,
      estimated: 0,
      deduped: 0,
      pareto: 0,
      materialized: 0,
      coverageValidated: 0,
      rejected: 1,
    });
    expect(strict.execution.rejections).toEqual([
      expect.objectContaining({
        candidateId: "candidate:v2:sha256:62dd4ac80d3ea6139640eb4dafc064f40ee99e778849b3c13ba95b50f8b2a697",
        recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
        stage: "check",
        reasonCode: "unknown_constraint_disallowed",
        constraints: expect.arrayContaining([
          expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.rms-current", status: "unknown" }),
        ]),
      }),
    ]);
    expect(strict.execution.rejections[0]!.constraints?.some((entry) => entry.status === "fail")).toBe(false);
  });

  it("recognizes complete external mixed facts-V2/V3 coverage without implying release eligibility or an integrated-regulator dependency", () => {
    const source = createSyntheticPowerDesignContextV2ForTesting().catalog;
    const legacyRecipe = installedRecipe("power.native.integrated-synchronous-buck");
    const legacyComplete = assessPowerDesignV2ProductionReadiness(source, [legacyRecipe]);
    expect(legacyComplete).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "no_release_eligible_recipe_contract",
      installedRecipeSet: true,
      factsV2RecipeInstalled: false,
      readyRecipeIds: [],
      missingProfileRequirements: [],
      diagnostics: [],
    }));
    expect(legacyComplete.recipeReadiness).toEqual([
      expect.objectContaining({
        recipeId: "power.native.integrated-synchronous-buck",
        recognizedContract: true,
        releaseEligible: false,
        ready: false,
      }),
    ]);
    expect(legacyComplete.recipeReadiness[0]?.profileRequirements.map((requirement) => ({
      partClass: requirement.partClass,
      factsSchemaVersion: requirement.factsSchemaVersion,
    }))).toEqual([
      { partClass: "power.integrated-synchronous-buck-regulator", factsSchemaVersion: "1.0.0" },
      { partClass: "power.power-inductor", factsSchemaVersion: "1.0.0" },
      { partClass: "shared.general-purpose-resistor", factsSchemaVersion: "1.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "1.0.0" },
    ]);
    expectDeepFrozen(legacyComplete);
    expect(assessPowerDesignV2ProductionReadiness(
      { ...source, profiles: [...source.profiles].reverse() },
      [legacyRecipe],
    )).toEqual(legacyComplete);

    const factsV2Recipe = installedRecipe("power.native.facts-v2");
    const factsV2Catalog = factsV2CoverageCatalog(source);
    const factsV2Complete = assessPowerDesignV2ProductionReadiness(factsV2Catalog, [factsV2Recipe]);
    expect(factsV2Complete).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "no_release_eligible_recipe_contract",
      factsV2RecipeInstalled: true,
      readyRecipeIds: [],
      missingProfileRequirements: [],
    }));
    expect(factsV2Complete.recipeReadiness).toEqual([
      expect.objectContaining({
        recipeId: "power.native.facts-v2",
        recognizedContract: true,
        releaseEligible: false,
        ready: false,
      }),
    ]);
    expect(factsV2Complete.recipeReadiness[0]?.profileRequirements.every((requirement) => (
      requirement.factsSchemaVersion === "2.0.0"
    ))).toBe(true);
    expectDeepFrozen(factsV2Complete);

    const factsV3Recipe = installedRecipe("power.native.external-fet-synchronous-buck.facts-v3");
    const factsV3Catalog = externalFactsV3CoverageCatalog(source);
    const factsV3Complete = assessPowerDesignV2ProductionReadiness(factsV3Catalog, [factsV3Recipe]);
    expect(factsV3Complete).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "no_release_eligible_recipe_contract",
      factsV2RecipeInstalled: false,
      readyRecipeIds: [],
      missingProfileRequirements: [],
    }));
    expect(factsV3Complete.recipeReadiness[0]).toEqual(expect.objectContaining({
      recipeId: "power.native.external-fet-synchronous-buck.facts-v3",
      recognizedContract: true,
      releaseEligible: false,
      ready: false,
    }));
    expect(factsV3Complete.recipeReadiness[0]?.profileRequirements.find((requirement) => (
      requirement.partClass === "shared.n-channel-power-mosfet"
    ))?.factsSchemaVersion).toBe("3.0.0");
    expect(factsV3Complete.recipeReadiness[0]?.profileRequirements.some((requirement) => (
      requirement.partClass === "power.integrated-synchronous-buck-regulator"
    ))).toBe(false);
    const irrelevantIntegrated = source.profiles.find((profile) => (
      profile.partClass === "power.integrated-synchronous-buck-regulator"
    ));
    if (!irrelevantIntegrated) throw new Error("Synthetic Power catalog is missing an integrated-primary template");
    const malformedIntegrated = structuredClone(irrelevantIntegrated) as unknown as Record<string, unknown>;
    malformedIntegrated.facts = null;
    const withIrrelevantIntegratedProfiles = {
      ...factsV3Catalog,
      profiles: [
        ...factsV3Catalog.profiles,
        ...Array.from({ length: 32 }, () => irrelevantIntegrated),
        malformedIntegrated,
      ],
    } as unknown as ReviewedProfileCatalogV2;
    expect(assessPowerDesignV2ProductionReadiness(
      withIrrelevantIntegratedProfiles,
      [factsV3Recipe],
    ).recipeReadiness).toEqual(factsV3Complete.recipeReadiness);
    expectDeepFrozen(factsV3Complete);
  });

  it("deterministically distinguishes missing classes, facts-version mismatch, and unknown recipes", () => {
    const source = createSyntheticPowerDesignContextV2ForTesting().catalog;
    const legacyRecipe = installedRecipe("power.native.integrated-synchronous-buck");
    const factsV3Recipe = installedRecipe("power.native.external-fet-synchronous-buck.facts-v3");
    const factsV3Catalog = externalFactsV3CoverageCatalog(source);

    const withoutSense: ReviewedProfileCatalogV2 = {
      ...factsV3Catalog,
      profiles: factsV3Catalog.profiles.filter((profile) => profile.partClass !== "shared.current-sense-resistor"),
    };
    expect(assessPowerDesignV2ProductionReadiness(withoutSense, [factsV3Recipe])).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "no_release_eligible_recipe_contract",
      missingProfileRequirements: ["shared.current-sense-resistor@facts-2.0.0"],
      diagnostics: ["missing_profile_requirement:shared.current-sense-resistor@facts-2.0.0"],
    }));

    const incompatibleSense = structuredClone(factsV3Catalog) as ReviewedProfileCatalogV2;
    for (const profile of incompatibleSense.profiles) {
      if (profile.partClass === "shared.current-sense-resistor") {
        (profile as { factsSchemaVersion: string }).factsSchemaVersion = "1.0.0";
      }
    }
    expect(assessPowerDesignV2ProductionReadiness(incompatibleSense, [factsV3Recipe])).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "no_release_eligible_recipe_contract",
      missingProfileRequirements: ["shared.current-sense-resistor@facts-2.0.0"],
      diagnostics: ["profile_schema_mismatch:shared.current-sense-resistor@facts-2.0.0:found-1.0.0"],
    }));

    const unknownRecipe = [{ ...legacyRecipe, id: `${legacyRecipe.id}.unknown` }];
    expect(assessPowerDesignV2ProductionReadiness(source, unknownRecipe)).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "unrecognized_installed_recipe_contract",
      installedRecipeSet: false,
      readyRecipeIds: [],
      diagnostics: ["unrecognized_recipe:power.native.integrated-synchronous-buck.unknown@1.0.0"],
    }));

    const integratedV34 = installedRecipe("power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified");
    const wrongV34Hash = [{
      ...integratedV34,
      contentHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as const,
    }];
    expect(assessPowerDesignV2ProductionReadiness(source, wrongV34Hash)).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "unrecognized_installed_recipe_contract",
      installedRecipeSet: false,
      readyRecipeIds: [],
    }));

    const productionCatalog = buildReviewedProfileCatalogV2(getBundledDesignLibraryDocuments());
    const driftedPrimaryCatalog = structuredClone(productionCatalog) as ReviewedProfileCatalogV2;
    const driftedPrimary = driftedPrimaryCatalog.profiles.find((profile) => (
      profile.part.manufacturerId === "texas-instruments"
      && profile.part.manufacturerPartNumber === "TPS54302DDCR"
    ));
    if (!driftedPrimary) throw new Error("Expected exact TPS54302DDCR primary profile");
    driftedPrimary.commonFacts.packageName.explanation += " drift";
    expect(assessPowerDesignV2ProductionReadiness(
      driftedPrimaryCatalog,
      [integratedV34],
    )).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "incomplete_recipe_profile_coverage",
      readyRecipeIds: [],
      missingProfileRequirements: ["power.integrated-synchronous-buck-regulator@facts-3.3.0"],
    }));

    const driftedInductorCatalog = structuredClone(productionCatalog) as ReviewedProfileCatalogV2;
    const driftedInductor = driftedInductorCatalog.profiles.find((profile) => (
      profile.part.manufacturerId === "bel-fuse"
      && profile.part.manufacturerPartNumber === "F1F2-0804-100M"
    ));
    if (!driftedInductor) throw new Error("Expected exact F1F2-0804-100M profile");
    driftedInductor.commonFacts.packageName.explanation += " drift";
    expect(assessPowerDesignV2ProductionReadiness(
      driftedInductorCatalog,
      [integratedV34],
    )).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "incomplete_recipe_profile_coverage",
      readyRecipeIds: [],
      missingProfileRequirements: ["power.power-inductor@facts-3.4.0"],
      diagnostics: ["missing_profile_requirement:power.power-inductor@facts-3.4.0"],
    }));

    const driftedOutputCapacitorCatalog = structuredClone(productionCatalog) as ReviewedProfileCatalogV2;
    const driftedOutputCapacitor = driftedOutputCapacitorCatalog.profiles.find((profile) => (
      profile.part.manufacturerId === "murata-manufacturing"
      && profile.part.manufacturerPartNumber === "GRM32ER71E226KE15L"
    ));
    if (!driftedOutputCapacitor) throw new Error("Expected exact GRM32ER71E226KE15L profile");
    driftedOutputCapacitor.commonFacts.packageName.explanation += " drift";
    const outputCapacitorDrift = assessPowerDesignV2ProductionReadiness(
      driftedOutputCapacitorCatalog,
      [integratedV34],
    );
    expect(outputCapacitorDrift).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "incomplete_recipe_profile_coverage",
      readyRecipeIds: [],
      missingProfileRequirements: ["shared.mlcc-capacitor@facts-2.0.0#output-capacitor-bank"],
      diagnostics: ["missing_profile_requirement:shared.mlcc-capacitor@facts-2.0.0#output-capacitor-bank"],
    }));
    expect(outputCapacitorDrift.recipeReadiness[0]?.profileRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirementId: "generic-mlcc-support",
        reviewedProfileCount: 5,
        exactProfileContentHash: null,
      }),
      expect.objectContaining({
        requirementId: "output-capacitor-bank",
        reviewedProfileCount: 0,
        exactProfileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
      }),
    ]));

    const bothCatalog = externalFactsV3CoverageCatalog(source);
    const bothForward = assessPowerDesignV2ProductionReadiness(bothCatalog, [legacyRecipe, factsV3Recipe]);
    const bothReversed = assessPowerDesignV2ProductionReadiness(
      { ...bothCatalog, profiles: [...bothCatalog.profiles].reverse() },
      [factsV3Recipe, legacyRecipe],
    );
    expect(bothReversed).toEqual(bothForward);
    expect(bothForward).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "no_release_eligible_recipe_contract",
      readyRecipeIds: [],
    }));
    expectDeepFrozen(bothForward);
  });

  it("keeps the synthetic adapter executable only through the explicit testing seam", () => {
    const source = createP1CompactRequest();
    const migration = migrateDesignRequestV1ToV2(source, source.libraryVersion);
    if (migration.status !== "migrated" || migration.request.application !== "power.buck") throw new Error("Expected P1 migration");
    const generation = generateSyntheticBuckDesignV2ForTesting(migration.request);
    const repeated = generateSyntheticBuckDesignV2ForTesting(migration.request);
    expect(generation.result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(repeated).toEqual(generation);
    expect(parseDesignExecutionReportV2(generation.execution)).toEqual(generation.execution);
    expect(canonicalDesignExecutionReportV2Payload(repeated.execution)).toBe(canonicalDesignExecutionReportV2Payload(generation.execution));
    expect(validateDesignResultExecutionContextV2(generation.result, {})).toEqual([]);
    for (const candidate of generation.result.candidates) {
      expect(candidate.circuitInstanceClassifications).toHaveLength(
        candidate.circuit.circuits.reduce((count, circuit) => count + circuit.components.length, 0),
      );
    }
    expect(generation.execution.counts.coverageValidated).toBe(generation.execution.counts.materialized);
    const p2source = createP2HighVoltageRequest();
    const p2 = migrateDesignRequestV1ToV2(p2source, p2source.libraryVersion);
    if (p2.status !== "migrated" || p2.request.application !== "power.buck") throw new Error("Expected P2 migration");
    const second = generateSyntheticBuckDesignV2ForTesting(p2.request);
    expect(second.result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(second.result.rejectedCandidates.length).toBeGreaterThan(0);
    const context = createSyntheticPowerDesignContextV2ForTesting(p2.request.libraryVersion);
    const profileIds = new Set(context.catalog.profiles.map((profile) => designProfileId(profile.partClass, profile.part)));
    const rejectedIds = second.execution.rejections.flatMap((rejection) => rejection.componentProfileIds);
    expect(rejectedIds.length).toBeGreaterThan(0);
    for (const profileId of rejectedIds) expect(profileIds.has(profileId)).toBe(true);
  });
});
