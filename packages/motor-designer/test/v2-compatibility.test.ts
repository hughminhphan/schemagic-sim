import { describe, expect, it } from "vitest";
import {
  DesignGenerationErrorV2,
  adaptDesignRecipeV1ToV2,
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateReviewedProfileCatalogV2ContentHash,
  canonicalDesignExecutionReportV2Payload,
  getInstalledRecipeRefsV2,
  parseDesignExecutionReportV2,
  parseElectricalDesignContextManifestV2,
  regenerateDesignResultV1AsV2,
  renderGenerationRejectionMessageV2,
  validateDesignResultExecutionContextV2,
  type DesignRecipeV2,
  type ReviewedProfileCatalogV2,
} from "@opencircuit/design-engine";
import { generateElectricalDesignV2ForTesting } from "@opencircuit/design-engine/v2-testing";
import { MOTOR_DESIGN_V2_PRODUCTION_STATUS as MOTOR_STATUS_SUBPATH } from "../src/v2-status";
import { designProfileId, getBundledDesignLibraryDocuments } from "@opencircuit/design-library";
import {
  DesignParseErrorV2,
  canonicalDesignResultV2ContentHash,
  designSha256ContentHash,
  migrateDesignRequestV1ToV2,
  parseDesignResultV1,
  parseDesignResultV2,
  serializeDesignResultV1,
  serializeDesignResultV2,
} from "@opencircuit/design-schema";
import {
  MOTOR_DESIGN_RECIPES,
  MOTOR_DESIGN_V2_PRODUCTION_STATUS,
  assessMotorDesignV2ProductionReadiness,
  generateMotorDesign,
  generateMotorDesignV2,
  getMotorDesignContextManifestV2,
  getMotorDesignContextV2,
} from "../src";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "../src/fixtures";
import {
  createSyntheticMotorDesignContextV2ForTesting,
  generateSyntheticMotorDesignV2ForTesting,
} from "../src/v2-testing";

function expectDeepFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) expectDeepFrozen(child);
}

function replaceRecipe(
  context: ReturnType<typeof createSyntheticMotorDesignContextV2ForTesting>,
  recipe: DesignRecipeV2,
) {
  return { ...context, recipes: context.recipes.map((entry) => entry.id === recipe.id ? recipe : entry) };
}

function migratedM1() {
  const migration = migrateDesignRequestV1ToV2(M1_COMPACT_REQUEST, M1_COMPACT_REQUEST.libraryVersion);
  if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") throw new Error("Expected M1 migration");
  return migration.request;
}

function migratedM2() {
  const migration = migrateDesignRequestV1ToV2(M2_POWER_REQUEST, getMotorDesignContextManifestV2().version);
  if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") throw new Error("Expected M2 migration");
  return migration.request;
}

describe("Motor Designer V2 compatibility release", () => {
  it("publishes a hash-verified ready context while preserving unknown hard-constraint boundaries", () => {
    const first = getMotorDesignContextManifestV2();
    const second = getMotorDesignContextManifestV2();
    expect(parseElectricalDesignContextManifestV2(first)).toEqual(first);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.contentHash).toBe("sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38");
    expect(MOTOR_DESIGN_V2_PRODUCTION_STATUS).toEqual(expect.objectContaining({
      status: "ready",
      reason: null,
      catalogProfileCount: 24,
      reviewedProfileCount: 19,
      compatibleProfileCount: 19,
      installedRecipeSet: true,
      factsV2RecipeInstalled: true,
      requiredTopologyRecipeIds: [
        "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
        "motor.native.integrated-h-bridge.facts-v3-2",
      ],
      missingTopologyRecipeIds: [],
      readyRecipeIds: [
        "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
        "motor.native.integrated-h-bridge.facts-v3-2",
      ],
      missingProfileRequirements: [
        "motor.full-bridge-gate-driver@facts-2.0.0",
        "motor.integrated-h-bridge@facts-1.0.0",
        "motor.integrated-h-bridge@facts-2.0.0",
        "motor.supply-tvs-diode@facts-2.0.0",
        "shared.bulk-capacitor@facts-1.0.0",
        "shared.mlcc-capacitor@facts-1.0.0",
        "shared.n-channel-power-mosfet@facts-2.0.0",
      ],
    }));
    expectDeepFrozen(MOTOR_DESIGN_V2_PRODUCTION_STATUS);
    expect(MOTOR_STATUS_SUBPATH).toBe(MOTOR_DESIGN_V2_PRODUCTION_STATUS);
    const productionCatalog = buildReviewedProfileCatalogV2(getBundledDesignLibraryDocuments());
    expect(assessMotorDesignV2ProductionReadiness(productionCatalog, getInstalledRecipeRefsV2("motor.brushed-dc")))
      .toEqual(MOTOR_DESIGN_V2_PRODUCTION_STATUS);
    expect(getMotorDesignContextV2()).toEqual(expect.objectContaining({ manifest: first }));

    const strictRequest = { ...structuredClone(M1_COMPACT_REQUEST), schemaVersion: 2 as const, objective: "balanced" as const, libraryVersion: first.version };
    const strict = generateMotorDesignV2(strictRequest);
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.rejections.some((entry) => (
      entry.recipeId === "motor.native.integrated-h-bridge.facts-v3-2"
      && entry.reasonCode === "unknown_constraint_disallowed"
    ))).toBe(true);
    const exactStrictTarget = strict.execution.rejections.filter((entry) => (
      entry.componentProfileIds.some((profileId) => profileId.endsWith("/DRV8876PWPR.json"))
      && entry.componentProfileIds.some((profileId) => profileId.endsWith("/C1608X7R1H104K080AA.json"))
    ));
    expect(exactStrictTarget).toHaveLength(2);
    expect(exactStrictTarget.every((entry) => (
      entry.constraints?.some((constraint) => (
        constraint.ruleId === "motor.integrated.local-capacitance-nominal"
        && constraint.status === "pass"
        && !("actual" in constraint)
        && !("limit" in constraint)
        && !("margin" in constraint)
      ))
      && entry.constraints?.some((constraint) => (
        constraint.ruleId === "motor.integrated.capacitor-derating"
        && constraint.status === "unknown"
      ))
    ))).toBe(true);

    const permissiveRequest = structuredClone(strictRequest);
    permissiveRequest.constraints.allowUnknownHardConstraints = true;
    const permissive = generateMotorDesignV2(permissiveRequest);
    expect(generateMotorDesignV2(permissiveRequest)).toEqual(permissive);
    expect(permissive.result.candidates.length).toBeGreaterThan(0);
    const drv8262ProfileId = "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
    expect(permissive.result.candidates.some((candidate) => candidate.components.some((component) => (
      component.id === "primary" && component.profileId === drv8262ProfileId
    )))).toBe(false);
    const drv8262MatchRejections = permissive.execution.rejections.filter((rejection) => (
      rejection.stage === "match" && rejection.componentProfileIds.includes(drv8262ProfileId)
    ));
    expect(drv8262MatchRejections).toHaveLength(10);
    expect(drv8262MatchRejections.every((rejection) => (
      rejection.reasonCode === "recipe_rejected"
      && rejection.recipeReason.startsWith("companion_network_unrepresentable:")
      && rejection.constraints.some((constraint) => (
        constraint.ruleId === "motor.integrated.companion-network-representability"
        && constraint.status === "fail"
      ))
    ))).toBe(true);
    expect(permissive.result.candidates.every((candidate) => (
      candidate.recipeId === "motor.native.integrated-h-bridge.facts-v3-2"
      && candidate.constraints.some((constraint) => constraint.status === "unknown")
      && candidate.simulationCoverage.some((coverage) => coverage.scenarioId === "pwm_loaded_steady_state" && coverage.modelTier === "behavioral")
      && candidate.simulationCoverage.some((coverage) => coverage.scenarioId === "selected_part_model" && coverage.modelTier === "unavailable")
    ))).toBe(true);
    const drv8876Rejections = permissive.execution.rejections.filter((entry) => (
      entry.componentProfileIds.some((profileId) => profileId.endsWith("/DRV8876PWPR.json"))
    ));
    expect(drv8876Rejections).toHaveLength(10);
    expect(drv8876Rejections.every((entry) => entry.constraints?.some((constraint) => (
      constraint.ruleId === "motor.integrated.operating-modes"
      && constraint.status === "pass"
      && constraint.evidence.some((evidence) => evidence.contentHash === "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032")
    )))).toBe(true);
    const exactTargetRejections = drv8876Rejections.filter((entry) => (
      entry.componentProfileIds.some((profileId) => profileId.endsWith("/C1608X7R1H104K080AA.json"))
    ));
    expect(exactTargetRejections).toHaveLength(2);
    expect(exactTargetRejections.every((entry) => entry.constraints?.some((constraint) => (
      constraint.ruleId === "motor.integrated.local-capacitance-nominal"
      && constraint.status === "pass"
      && constraint.explanation.includes("exactly matching the 0.1 uF nominal value TI recommends")
    )))).toBe(true);
    expect(permissive.result.candidates).toEqual([
      expect.objectContaining({
        components: expect.arrayContaining([
          expect.objectContaining({ part: { manufacturerId: "stmicroelectronics", manufacturerPartNumber: "STSPIN840" } }),
        ]),
        constraints: expect.arrayContaining([
          expect.objectContaining({ ruleId: "motor.integrated.operating-modes", status: "unknown" }),
        ]),
      }),
    ]);
  }, 30_000);

  it("keeps strict direct-gate generation empty while permissive inspection splits exact nominal bootstrap and local roles", () => {
    const strictRequest = migratedM2();
    const strict = generateMotorDesignV2(strictRequest);
    const permissiveRequest = structuredClone(strictRequest);
    permissiveRequest.constraints.allowUnknownHardConstraints = true;
    const permissive = generateMotorDesignV2(permissiveRequest);
    expect({
      strictResult: strict.result.contentHash,
      strictExecution: designSha256ContentHash(canonicalDesignExecutionReportV2Payload(strict.execution)),
      permissiveResult: permissive.result.contentHash,
      permissiveExecution: designSha256ContentHash(canonicalDesignExecutionReportV2Payload(permissive.execution)),
      candidateIds: permissive.result.candidates.map((candidate) => candidate.id),
    }).toEqual({
      strictResult: "sha256:b0bf69fc7bac1accbaf0232204f14ae243bb59d6401b979b370e2b40b1e65a77",
      strictExecution: "sha256:a776a7eea754a7a7724d4df2663693f11eaeb3485784b7d2e7e9e0b7107590da",
      permissiveResult: "sha256:01b56be6e6dfc3ca46bb36550f6999571d19bd109e73e99d29d308a69a7733b3",
      permissiveExecution: "sha256:5b45a733cea233ab9c9c36603747e623e2cb6031dfbb4b22c1020cff86af1fce",
      candidateIds: [
        "candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152",
        "candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382",
      ],
    });
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.counts).toMatchObject({
      enumerated: 54,
      checked: 54,
      materialized: 0,
      pareto: 0,
      rejected: 54,
    });
    expect(strict.execution.rejections).toHaveLength(54);
    expect(strict.execution.rejections.every((rejection) => (
      rejection.recipeId === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"
      && rejection.reasonCode === "unknown_constraint_disallowed"
      && rejection.constraints?.some((constraint) => (
        constraint.ruleId === "motor.external.bootstrap-capacitance-nominal"
        && constraint.status === "pass"
      ))
      && rejection.constraints?.some((constraint) => (
        constraint.ruleId === "motor.external.local-capacitance-nominal"
        && constraint.status === "pass"
      ))
      && rejection.constraints?.some((constraint) => (
        constraint.ruleId === "motor.external.gate-network"
        && constraint.status === "unknown"
      ))
      && rejection.constraints?.some((constraint) => (
        constraint.ruleId === "motor.external.tvs-stand-off"
        && constraint.status === "unknown"
      ))
    ))).toBe(true);

    expect(permissive.result.candidates).toHaveLength(2);
    expect(permissive.result.candidates.map((candidate) => candidate.id)).toEqual([
      "candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152",
      "candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382",
    ]);
    expect(permissive.execution.counts).toMatchObject({
      enumerated: 54,
      checked: 54,
      materialized: 54,
      pareto: 2,
      rejected: 52,
    });
    for (const candidate of permissive.result.candidates) {
      expect(candidate.components.some((component) => (
        component.id === "gate-resistor" || component.role === "mosfet-gate-resistor"
      ))).toBe(false);
      const assembly = candidate.circuit.circuits.find((circuit) => circuit.id === "assembly");
      expect(assembly?.components.some((component) => component.id === "gate-resistor")).toBe(false);
      expect(assembly?.wires.some((wire) => wire.id === "gate-drive-direct-to-bridge")).toBe(true);
      expect(candidate.components).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "supply-tvs",
          profileId: "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json",
          part: { manufacturerId: "diodes-incorporated", manufacturerPartNumber: "3.0SMCJ33CAQ" },
        }),
        expect.objectContaining({
          id: "bootstrap-capacitor",
          role: "bootstrap-capacitor",
          quantityPerAssembly: 2,
          profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
        }),
        expect.objectContaining({
          id: "local-decoupling",
          role: "driver-local-decoupling-capacitor",
          quantityPerAssembly: 1,
          profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
        }),
      ]));
      expect(candidate.constraints).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance-nominal", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-nominal", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.bulk-capacitance", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.capacitor-placement", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-effective", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.local-voltage-rating", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.passive-derating", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.switching-and-loss", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-driver-switch-node-limit", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-mosfet-limit", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-stand-off", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-coordination", status: "unknown" }),
      ]));
    }
  }, 30_000);

  it("requires the V3.2 integrated and mixed V3/V3.1 external topology recipes and never lets compatibility-only coverage unlock production", () => {
    const installed = getInstalledRecipeRefsV2("motor.brushed-dc");
    expect(installed.map((recipe) => recipe.id)).toEqual([
      "motor.native.external-nmos-h-bridge.facts-v2",
      "motor.native.external-nmos-h-bridge.facts-v3",
      "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      "motor.native.integrated-h-bridge",
      "motor.native.integrated-h-bridge.facts-v2",
      "motor.native.integrated-h-bridge.facts-v3-2",
    ]);
    const compatibilityOnly = installed.filter((recipe) => recipe.id === "motor.native.integrated-h-bridge");
    const source = createSyntheticMotorDesignContextV2ForTesting().catalog;
    const complete = assessMotorDesignV2ProductionReadiness(source, compatibilityOnly);
    expect(complete).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "release_topology_recipe_missing",
      installedRecipeSet: true,
      factsV2RecipeInstalled: false,
      missingTopologyRecipeIds: [
        "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
        "motor.native.integrated-h-bridge.facts-v3-2",
      ],
      readyRecipeIds: ["motor.native.integrated-h-bridge"],
      missingProfileRequirements: [],
    }));
    expectDeepFrozen(complete);
    expect(complete.recipeReadiness[0]?.profileRequirements.map((requirement) => ({
      partClass: requirement.partClass,
      factsSchemaVersion: requirement.factsSchemaVersion,
    }))).toEqual([
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "1.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "1.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "1.0.0" },
    ]);
    expect(assessMotorDesignV2ProductionReadiness({ ...source, profiles: [...source.profiles].reverse() }, compatibilityOnly)).toEqual(complete);

    expect(assessMotorDesignV2ProductionReadiness(source, installed)).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "incompatible_facts_schema_versions",
      factsV2RecipeInstalled: true,
      missingTopologyRecipeIds: [],
      readyRecipeIds: ["motor.native.integrated-h-bridge"],
      missingProfileRequirements: [
        "motor.full-bridge-gate-driver@facts-2.0.0",
        "motor.full-bridge-gate-driver@facts-3.1.0",
        "motor.integrated-h-bridge@facts-2.0.0",
        "motor.integrated-h-bridge@facts-3.2.0",
        "motor.supply-tvs-diode@facts-2.0.0",
        "motor.supply-tvs-diode@facts-3.0.0",
        "shared.bulk-capacitor@facts-2.0.0",
        "shared.current-sense-resistor@facts-2.0.0",
        "shared.general-purpose-resistor@facts-2.0.0",
        "shared.mlcc-capacitor@facts-2.0.0",
        "shared.n-channel-power-mosfet@facts-2.0.0",
        "shared.n-channel-power-mosfet@facts-3.0.0",
      ],
    }));

    const integratedFactsV32 = installed.find((recipe) => recipe.id === "motor.native.integrated-h-bridge.facts-v3-2")!;
    const externalFactsV31 = installed.find((recipe) => recipe.id === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified")!;
    const fullReleaseSet = [externalFactsV31, integratedFactsV32];
    const v2Catalog = structuredClone(source) as unknown as ReviewedProfileCatalogV2;
    for (const profile of v2Catalog.profiles) {
      (profile as { factsSchemaVersion: string }).factsSchemaVersion = "2.0.0";
    }
    const mosfet = v2Catalog.profiles.find((profile) => profile.partClass === "shared.n-channel-power-mosfet")!;
    (mosfet as { factsSchemaVersion: string }).factsSchemaVersion = "3.0.0";
    const driver = v2Catalog.profiles.find((profile) => profile.partClass === "motor.full-bridge-gate-driver")!;
    (driver as { factsSchemaVersion: string }).factsSchemaVersion = "3.1.0";
    const integrated = v2Catalog.profiles.find((profile) => profile.partClass === "motor.integrated-h-bridge")!;
    (integrated as { factsSchemaVersion: string }).factsSchemaVersion = "3.2.0";
    const tvs = structuredClone(v2Catalog.profiles[0]!) as any;
    tvs.partClass = "motor.supply-tvs-diode";
    tvs.part = { manufacturerId: "synthetic-readiness-only", manufacturerPartNumber: "TVS-CONTRACT" };
    tvs.factsSchemaVersion = "3.0.0";
    (v2Catalog.profiles as any[]).push(tvs);
    const fullCoverage = assessMotorDesignV2ProductionReadiness(v2Catalog, fullReleaseSet);
    expect(fullCoverage).toEqual(expect.objectContaining({
      status: "ready",
      reason: null,
      missingTopologyRecipeIds: [],
      readyRecipeIds: [
        "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
        "motor.native.integrated-h-bridge.facts-v3-2",
      ],
      missingProfileRequirements: [],
    }));
    expectDeepFrozen(fullCoverage);
    expect(fullCoverage.recipeReadiness.find((recipe) => recipe.recipeId === externalFactsV31.id)?.profileRequirements
      .filter((requirement) => requirement.partClass === "motor.supply-tvs-diode" || requirement.partClass === "shared.n-channel-power-mosfet")
      .every((requirement) => requirement.factsSchemaVersion === "3.0.0")).toBe(true);
    expect(fullCoverage.recipeReadiness.find((recipe) => recipe.recipeId === externalFactsV31.id)?.profileRequirements
      .find((requirement) => requirement.partClass === "motor.full-bridge-gate-driver")?.factsSchemaVersion).toBe("3.1.0");

    const withoutBulk: ReviewedProfileCatalogV2 = {
      ...v2Catalog,
      profiles: v2Catalog.profiles.filter((profile) => profile.partClass !== "shared.bulk-capacitor"),
    };
    expect(assessMotorDesignV2ProductionReadiness(withoutBulk, fullReleaseSet)).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "incomplete_recipe_profile_coverage",
      missingTopologyRecipeIds: [],
      missingProfileRequirements: ["shared.bulk-capacitor@facts-2.0.0"],
      diagnostics: ["missing_profile_requirement:shared.bulk-capacitor@facts-2.0.0"],
    }));

    const incompatible = assessMotorDesignV2ProductionReadiness(source, fullReleaseSet);
    expect(incompatible).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "incompatible_facts_schema_versions",
      missingTopologyRecipeIds: [],
    }));
    expect(incompatible.diagnostics).toEqual(expect.arrayContaining([
      "profile_schema_mismatch:motor.integrated-h-bridge@facts-3.2.0:found-1.0.0",
      "profile_schema_mismatch:motor.full-bridge-gate-driver@facts-3.1.0:found-1.0.0",
      "profile_schema_mismatch:shared.n-channel-power-mosfet@facts-3.0.0:found-1.0.0",
    ]));

    const unknownRecipe = compatibilityOnly.map((recipe) => ({ ...recipe, id: `${recipe.id}.unknown` }));
    expect(assessMotorDesignV2ProductionReadiness(source, unknownRecipe)).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "unrecognized_installed_recipe_contract",
      installedRecipeSet: false,
      readyRecipeIds: [],
    }));
    expect(assessMotorDesignV2ProductionReadiness(source, unknownRecipe).diagnostics).toEqual(expect.arrayContaining([
      "unrecognized_recipe:motor.native.integrated-h-bridge.unknown@1.0.0",
    ]));

    const wrongV32Hash = [{ ...integratedFactsV32, contentHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as const }];
    expect(assessMotorDesignV2ProductionReadiness(v2Catalog, wrongV32Hash)).toEqual(expect.objectContaining({
      status: "blocked",
      reason: "unrecognized_installed_recipe_contract",
      installedRecipeSet: false,
    }));
  });

  it("keeps the synthetic adapter executable only through the explicit testing seam", () => {
    const request = migratedM1();
    const generation = generateSyntheticMotorDesignV2ForTesting(request);
    const repeated = generateSyntheticMotorDesignV2ForTesting(request);
    expect(generation.result.candidates).toHaveLength(2);
    expect(repeated).toEqual(generation);
    expect(parseDesignExecutionReportV2(generation.execution)).toEqual(generation.execution);
    const tampered = structuredClone(generation.execution);
    tampered.rejections[0]!.message += "x";
    expect(() => parseDesignExecutionReportV2(tampered)).toThrow();
    const oversized = structuredClone(generation.execution);
    const authored = oversized.rejections[0]!;
    authored.optionKey = "x".repeat(16 * 1024 + 1);
    const { message: _message, ...messageInput } = authored;
    authored.message = renderGenerationRejectionMessageV2(messageInput);
    expect(() => parseDesignExecutionReportV2(oversized)).toThrow();
    expect(canonicalDesignExecutionReportV2Payload(repeated.execution)).toBe(canonicalDesignExecutionReportV2Payload(generation.execution));
    expect(validateDesignResultExecutionContextV2(generation.result, {})).toEqual([]);
    for (const candidate of generation.result.candidates) {
      expect(candidate.circuitInstanceClassifications).toHaveLength(candidate.circuit.circuits.reduce((count, circuit) => count + circuit.components.length, 0));
    }
    expect(generation.execution.counts.coverageValidated).toBe(generation.execution.counts.materialized);
    const m2 = migrateDesignRequestV1ToV2(M2_POWER_REQUEST, M2_POWER_REQUEST.libraryVersion);
    if (m2.status !== "migrated" || m2.request.application !== "motor.brushed-dc") throw new Error("Expected M2 migration");
    const second = generateSyntheticMotorDesignV2ForTesting(m2.request);
    expect(second.result.candidates).toHaveLength(4);
    expect(second.result.rejectedCandidates.length).toBeGreaterThan(0);
  });

  it("strictly parses nested V2 and legacy V1 artifacts and correlates cardinality overflow", () => {
    const generation = generateSyntheticMotorDesignV2ForTesting(migratedM1());
    expect(parseDesignResultV2(generation.result)).toEqual(generation.result);
    expect(serializeDesignResultV2(generation.result)).toBeTruthy();
    const nested = structuredClone(generation.result) as any;
    nested.candidates[0].components[0].part.unexpected = true;
    expect(() => parseDesignResultV2(nested)).toThrow(DesignParseErrorV2);
    expect(() => serializeDesignResultV2(nested)).toThrow(DesignParseErrorV2);
    const overflow = structuredClone(generation.result) as any;
    overflow.candidates = Array.from({ length: 257 }, () => structuredClone(generation.result.candidates[0]));
    try {
      parseDesignResultV2(overflow);
      throw new Error("Expected resource failure");
    } catch (error) {
      expect((error as DesignParseErrorV2).detail).toEqual({ code: "resource_limit", stage: "parse", artifact: "design_result" });
    }
    const legacy = generateMotorDesign(M1_COMPACT_REQUEST);
    expect(parseDesignResultV1(legacy)).toEqual(legacy);
    const exactMpnLegacy = structuredClone(legacy);
    exactMpnLegacy.candidates[0]!.components[0]!.part.manufacturerPartNumber = "EXACT\u0000/\u202eMPN";
    const exactMpnRoundTrip = parseDesignResultV1(JSON.parse(serializeDesignResultV1(parseDesignResultV1(exactMpnLegacy))));
    expect(exactMpnRoundTrip.candidates[0]!.components[0]!.part.manufacturerPartNumber).toBe("EXACT\u0000/\u202eMPN");
    const badLegacy = structuredClone(legacy) as any;
    badLegacy.candidates[0].metrics.values[0].evidence = [{ sourceId: "x", locator: "x", licenseNote: "x", extra: true }];
    expect(() => parseDesignResultV1(badLegacy)).toThrow(DesignParseErrorV2);
    const badTrace = structuredClone(legacy) as any;
    badTrace.trace.counts.extra = 0;
    expect(() => parseDesignResultV1(badTrace)).toThrow(DesignParseErrorV2);
    const rejectedIndex = generation.result.rejectedCandidates.findIndex((rejection) => rejection.constraints.length >= 2);
    expect(rejectedIndex).toBeGreaterThanOrEqual(0);
    const reversed = structuredClone(generation.result);
    reversed.rejectedCandidates[rejectedIndex]!.constraints.reverse();
    const { contentHash: _reversedHash, ...reversedPayload } = reversed;
    reversed.contentHash = canonicalDesignResultV2ContentHash(reversedPayload);
    expect(() => parseDesignResultV2(reversed)).toThrow(DesignParseErrorV2);
    const duplicated = structuredClone(generation.result);
    duplicated.rejectedCandidates[rejectedIndex]!.constraints = [duplicated.rejectedCandidates[rejectedIndex]!.constraints[0]!, duplicated.rejectedCandidates[rejectedIndex]!.constraints[0]!];
    const { contentHash: _duplicateHash, ...duplicatePayload } = duplicated;
    duplicated.contentHash = canonicalDesignResultV2ContentHash(duplicatePayload);
    expect(() => parseDesignResultV2(duplicated)).toThrow(DesignParseErrorV2);
  });

  it("captures immutable V1 recipes and deep-freezes every V2 hook boundary", () => {
    const request = migratedM1();
    const base = createSyntheticMotorDesignContextV2ForTesting();
    const baseline = generateElectricalDesignV2ForTesting(request, base);
    const source = base.recipes.find((recipe) => recipe.id === baseline.result.candidates[0]!.recipeId)!;
    let contextAccessorReads = 0;
    const hostileContext = { ...base };
    Object.defineProperty(hostileContext, "recipes", { enumerable: true, get() { contextAccessorReads += 1; return base.recipes; } });
    expect(() => generateElectricalDesignV2ForTesting(request, hostileContext)).toThrow(DesignGenerationErrorV2);
    expect(contextAccessorReads).toBe(0);
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.applications)).toBe(true);
    expect(source.metricDeclarations.every((declaration) => Object.isFrozen(declaration))).toBe(true);
    for (const callback of [source.supports, source.enumerate, source.solve, source.match, source.check, source.estimate, source.materialize]) expect(Object.isFrozen(callback)).toBe(true);
    const wrapped: DesignRecipeV2 = {
      ...source,
      supports(input) { expectDeepFrozen(input); return source.supports(input); },
      enumerate(environment) { expectDeepFrozen(environment); return source.enumerate(environment); },
      solve(option, environment) { expectDeepFrozen(option); expectDeepFrozen(environment); return source.solve(option, environment); },
      match(option, environment) { expectDeepFrozen(option); expectDeepFrozen(environment); return source.match(option, environment); },
      check(option, environment) { expectDeepFrozen(option); expectDeepFrozen(environment); return source.check(option, environment); },
      estimate(option, constraints, environment) { expectDeepFrozen(option); expectDeepFrozen(constraints); expectDeepFrozen(environment); return source.estimate(option, constraints, environment); },
      materialize(candidate, environment) { expectDeepFrozen(candidate); expectDeepFrozen(environment); return source.materialize(candidate, environment); },
    };
    expect(generateElectricalDesignV2ForTesting(request, replaceRecipe(base, wrapped)).result.candidates).toHaveLength(2);
    const invalidSupports = { ...source, supports: () => "yes" as unknown as boolean };
    try {
      generateElectricalDesignV2ForTesting(request, replaceRecipe(base, invalidSupports));
      throw new Error("Expected supports failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DesignGenerationErrorV2);
      expect((error as DesignGenerationErrorV2).detail).toEqual({ code: "recipe_contract_invalid", stage: "supports", recipeId: source.id });
    }
    let accessorReads = 0;
    const accessorRecipe = { ...source } as DesignRecipeV2;
    Object.defineProperty(accessorRecipe, "enumerate", { enumerable: true, get() { accessorReads += 1; return source.enumerate; } });
    expect(() => generateElectricalDesignV2ForTesting(request, replaceRecipe(base, accessorRecipe))).toThrow(DesignGenerationErrorV2);
    expect(accessorReads).toBe(0);
    const nonfinite = { ...source, enumerate(environment: any) { return source.enumerate(environment).map((entry) => ({ ...entry, data: { ...entry.data, invalid: Infinity } })); } };
    try {
      generateElectricalDesignV2ForTesting(request, replaceRecipe(base, nonfinite));
      throw new Error("Expected enumerate failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DesignGenerationErrorV2);
      expect((error as DesignGenerationErrorV2).detail.stage).toBe("enumerate");
    }
    let outputAccessorReads = 0;
    const accessorOutput = { ...source, enumerate(environment: any) { const entries = source.enumerate(environment); const data = { ...entries[0]!.data }; Object.defineProperty(data, "hostile", { enumerable: true, get() { outputAccessorReads += 1; return 1; } }); return [{ ...entries[0]!, data }]; } };
    expect(() => generateElectricalDesignV2ForTesting(request, replaceRecipe(base, accessorOutput))).toThrow(DesignGenerationErrorV2);
    expect(outputAccessorReads).toBe(0);
    const thenableOutput = { ...source, enumerate(environment: any) { return source.enumerate(environment).map((entry) => ({ ...entry, data: { ...entry.data, then() {} } })); } };
    expect(() => generateElectricalDesignV2ForTesting(request, replaceRecipe(base, thenableOutput as unknown as DesignRecipeV2))).toThrow(DesignGenerationErrorV2);
    const extraOutput = { ...source, enumerate(environment: any) { return source.enumerate(environment).map((entry) => ({ ...entry, extra: true })); } };
    expect(() => generateElectricalDesignV2ForTesting(request, replaceRecipe(base, extraOutput as DesignRecipeV2))).toThrow(DesignGenerationErrorV2);
    const reservedCheck = { ...source, check(option: any, environment: any) { const constraints = source.check(option, environment); return [...constraints, { ...constraints[0]!, ruleId: "sourcing.injected" }]; } };
    try { generateElectricalDesignV2ForTesting(request, replaceRecipe(base, reservedCheck)); throw new Error("Expected reserved check failure"); }
    catch (error) { expect((error as DesignGenerationErrorV2).detail).toEqual({ code: "recipe_contract_invalid", stage: "check", recipeId: source.id }); }
    const invalidSolveUnit = { ...source, solve(option: any, environment: any) { const outcome = source.solve(option, environment); if (outcome.status !== "ok") return outcome; return { ...outcome, value: { ...outcome.value, derivedValues: outcome.value.derivedValues.map((entry, index) => index === 0 ? { ...entry, value: { ...entry.value, unit: "dBm" } } : entry) } }; } };
    try { generateElectricalDesignV2ForTesting(request, replaceRecipe(base, invalidSolveUnit as unknown as DesignRecipeV2)); throw new Error("Expected solve unit failure"); }
    catch (error) { expect((error as DesignGenerationErrorV2).detail.stage).toBe("solve"); }
    const duplicateMatchWarning = { ...source, match(option: any, environment: any) { return source.match(option, environment).map((outcome) => outcome.status === "ok" ? { ...outcome, value: { ...outcome.value, warnings: ["duplicate", "duplicate"] } } : outcome); } };
    try { generateElectricalDesignV2ForTesting(request, replaceRecipe(base, duplicateMatchWarning)); throw new Error("Expected match warning failure"); }
    catch (error) { expect((error as DesignGenerationErrorV2).detail.stage).toBe("match"); }
    const invalidCheckEvidence = { ...source, check(option: any, environment: any) { const constraints = source.check(option, environment); return constraints.map((constraint, index) => index === 0 ? { ...constraint, evidence: [{ sourceId: "bad\n", locator: "test", licenseNote: "test" }] } : constraint); } };
    try { generateElectricalDesignV2ForTesting(request, replaceRecipe(base, invalidCheckEvidence)); throw new Error("Expected check evidence failure"); }
    catch (error) { expect((error as DesignGenerationErrorV2).detail.stage).toBe("check"); }
    const invalidEstimateUnit = { ...source, estimate(option: any, constraints: any, environment: any) { const estimate = source.estimate(option, constraints, environment); return { ...estimate, metrics: estimate.metrics.map((metric, index) => index === 0 && metric.value ? { ...metric, value: { ...metric.value, unit: "dBm" } } : metric) }; } };
    try { generateElectricalDesignV2ForTesting(request, replaceRecipe(base, invalidEstimateUnit as unknown as DesignRecipeV2)); throw new Error("Expected estimate unit failure"); }
    catch (error) { expect((error as DesignGenerationErrorV2).detail.stage).toBe("estimate"); }
    let candidateMatchCalls = 0;
    const candidateOverflow = {
      ...source,
      enumerate(environment: any) { const first = source.enumerate(environment)[0]!; return Array.from({ length: 257 }, (_, index) => ({ ...first, optionKey: `${first.optionKey}-cap-${String(index).padStart(3, "0")}` })); },
      match(option: any, environment: any) { candidateMatchCalls += 1; const outcome = source.match(option, environment).find((entry) => entry.status === "ok"); if (!outcome || outcome.status !== "ok") throw new Error("Expected match"); return [{ ...outcome, value: { ...outcome.value, data: { ...outcome.value.data, candidateCapSeed: candidateMatchCalls } } }]; },
    };
    try {
      generateElectricalDesignV2ForTesting(request, replaceRecipe(base, candidateOverflow));
      throw new Error("Expected candidate resource failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DesignGenerationErrorV2);
      expect((error as DesignGenerationErrorV2).detail).toEqual({ code: "resource_limit", stage: "result" });
    }
    const mutator = { ...source, materialize(candidate: any, environment: any) { candidate.metrics.warningCount = 99; return source.materialize(candidate, environment); } };
    try {
      generateElectricalDesignV2ForTesting(request, replaceRecipe(base, mutator));
      throw new Error("Expected materializer mutation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DesignGenerationErrorV2);
      expect((error as DesignGenerationErrorV2).detail).toEqual({ code: "recipe_hook_threw", stage: "materialize", recipeId: source.id });
    }
    const before = generateSyntheticMotorDesignV2ForTesting(request);
    const mutableV1Recipe = { ...MOTOR_DESIGN_RECIPES[0]! };
    const capturedAdapter = adaptDesignRecipeV1ToV2(mutableV1Recipe, { applications: ["motor.brushed-dc"], metricDeclarations: source.metricDeclarations });
    const capturedSupport = capturedAdapter.supports(request);
    mutableV1Recipe.supports = () => !capturedSupport;
    expect(capturedAdapter.supports(request)).toBe(capturedSupport);
    const publicRecipe = MOTOR_DESIGN_RECIPES[0]!;
    const original = publicRecipe.supports;
    const changed = Reflect.set(publicRecipe, "supports", () => false);
    try { expect(generateSyntheticMotorDesignV2ForTesting(request)).toEqual(before); }
    finally { if (changed) Reflect.set(publicRecipe, "supports", original); }
  }, 15_000);

  it("normalizes test recipe order, exact-resolves rejection profiles, and short-circuits objective conflicts before context access", () => {
    const migration = migrateDesignRequestV1ToV2(M2_POWER_REQUEST, M2_POWER_REQUEST.libraryVersion);
    if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") throw new Error("Expected M2 migration");
    const context = createSyntheticMotorDesignContextV2ForTesting();
    const forward = generateElectricalDesignV2ForTesting(migration.request, context);
    const reversed = generateElectricalDesignV2ForTesting(migration.request, { ...context, recipes: [...context.recipes].reverse() });
    expect(reversed).toEqual(forward);
    const profileIds = new Set(context.catalog.profiles.map((profile) => designProfileId(profile.partClass, profile.part)));
    for (const rejection of forward.execution.rejections) for (const profileId of rejection.componentProfileIds) expect(profileIds.has(profileId)).toBe(true);
    expect(forward.execution.rejections.length).toBeGreaterThan(0);
    const rejectedProfileId = forward.execution.rejections.flatMap((rejection) => rejection.componentProfileIds)[0];
    if (rejectedProfileId) {
      const catalogPayload = {
        ...context.catalog,
        profiles: context.catalog.profiles.filter((profile) => designProfileId(profile.partClass, profile.part) !== rejectedProfileId),
      };
      const { contentHash: _catalogHash, ...catalogWithoutHash } = catalogPayload;
      const catalog = { ...catalogWithoutHash, contentHash: calculateReviewedProfileCatalogV2ContentHash(catalogWithoutHash) };
      const { contentHash: _manifestHash, ...manifestWithoutHash } = context.manifest;
      const manifestPayload = { ...manifestWithoutHash, catalog: { ...manifestWithoutHash.catalog, contentHash: catalog.contentHash } };
      const manifest = { ...manifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(manifestPayload) };
      try {
        generateElectricalDesignV2ForTesting(migration.request, { ...context, catalog, manifest });
        throw new Error("Expected exact profile resolution failure");
      } catch (error) {
        expect(error).toBeInstanceOf(DesignGenerationErrorV2);
        expect((error as DesignGenerationErrorV2).detail.code).toBe("recipe_contract_invalid");
      }
    }
    const sourceRecipe = context.recipes[0]!;
    const missingMetricRecipe = { ...sourceRecipe, metricDeclarations: sourceRecipe.metricDeclarations.filter((declaration) => declaration.id !== "motor.board-area-proxy") };
    const recipes = context.recipes.map((recipe) => recipe.id === sourceRecipe.id ? missingMetricRecipe : recipe);
    const { contentHash: _metricManifestHash, ...metricManifestWithoutHash } = context.manifest;
    const metricManifestPayload = {
      ...metricManifestWithoutHash,
      recipes: recipes.map(({ id, version, contentHash, applications, metricDeclarations }) => ({ id, version, contentHash, applications, metricDeclarations })),
    };
    const metricManifest = { ...metricManifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(metricManifestPayload) };
    try {
      generateElectricalDesignV2ForTesting(migration.request, { ...context, recipes, manifest: metricManifest });
      throw new Error("Expected required metric coverage failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DesignGenerationErrorV2);
      expect((error as DesignGenerationErrorV2).detail).toEqual({ code: "invalid_context", stage: "context" });
      expect((error as DesignGenerationErrorV2).issues).toContainEqual(expect.objectContaining({ code: "invalid_reference" }));
    }
    const { contentHash: _overManifestHash, ...overManifestWithoutHash } = context.manifest;
    const overRecipes = Array.from({ length: 257 }, (_, index) => ({ ...overManifestWithoutHash.recipes[0]!, id: `motor.recipe.${String(index).padStart(3, "0")}` }));
    const overManifestPayload = { ...overManifestWithoutHash, recipes: overRecipes };
    const overManifest = { ...overManifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(overManifestPayload) };
    try { generateElectricalDesignV2ForTesting(migration.request, { ...context, manifest: overManifest }); throw new Error("Expected manifest resource failure"); }
    catch (error) { expect((error as DesignGenerationErrorV2).detail).toEqual({ code: "invalid_context", stage: "context" }); expect((error as DesignGenerationErrorV2).issues).toContainEqual(expect.objectContaining({ code: "resource_limit" })); }
    const legacy = generateMotorDesign(M1_COMPACT_REQUEST);
    let reads = 0;
    const hostile = new Proxy({} as any, { get() { reads += 1; throw new Error("context read"); } });
    expect(regenerateDesignResultV1AsV2(legacy, hostile, "efficiency")).toEqual({ status: "engineering_objective_conflict", sourceObjective: "balanced", suppliedObjective: "efficiency" });
    expect(reads).toBe(0);
  });
});
