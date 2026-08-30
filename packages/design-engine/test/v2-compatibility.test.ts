import { describe,expect,it } from "vitest";
import {
  InstalledRecipeRegistryCapabilityV2,
  PIPELINE_STAGES_V2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  calculateReviewedProfileCatalogV2ContentHash,
  canonicalCandidateIdentityV2,
  getInstalledCompilerImplementationRefV2,
  parseElectricalDesignContextManifestV2,
  parseElectricalRankingPolicyV2,
  parseDesignExecutionReportV2,
  parseReviewedProfileCatalogV2,
  projectCandidateIdentityDerivedValuesV2,
  projectCandidateIdentitySelectedComponentsV2,
  renderGenerationRejectionMessageV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type ReviewedProfileCatalogV2,
} from "../src";
import { DesignParseErrorV2 } from "@opencircuit/design-schema";

const RELEASE = { version: "test-library.1", contentHash: ("sha256:" + "1".repeat(64)) as `sha256:${string}` } as const;
function emptyCatalog(): ReviewedProfileCatalogV2 {
  const payload: Omit<ReviewedProfileCatalogV2, "contentHash"> = { format: "schemagic-reviewed-profile-catalog", schemaVersion: 2, version: RELEASE.version, sourceRelease: RELEASE, profiles: [] };
  return { ...payload, contentHash: calculateReviewedProfileCatalogV2ContentHash(payload) };
}
function emptyRanking(): ElectricalRankingPolicyV2 {
  const payload: Omit<ElectricalRankingPolicyV2, "contentHash"> = { format: "schemagic-electrical-ranking-policy", schemaVersion: 2, version: "test-ranking.1", application: "motor.brushed-dc", paretoCriteria: [], rankingProfiles: { area: [], balanced: [], efficiency: [], temperature: [] } };
  return { ...payload, contentHash: calculateElectricalRankingPolicyV2ContentHash(payload) };
}
function manifestWithRecipe(recipe: ElectricalDesignContextManifestV2["recipes"][number]): ElectricalDesignContextManifestV2 {
  const catalog = emptyCatalog(); const ranking = emptyRanking();
  const payload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = { format: "schemagic-electrical-design-context", schemaVersion: 2, version: RELEASE.version, application: "motor.brushed-dc", compiler: getInstalledCompilerImplementationRefV2(), catalog: { version: catalog.version, contentHash: catalog.contentHash, sourceReleaseContentHash: catalog.sourceRelease.contentHash }, rankingPolicy: { version: ranking.version, contentHash: ranking.contentHash }, recipes: [recipe] };
  return { ...payload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(payload) };
}

describe("Designer V2 engine compatibility",()=>{
  it("rejects direct opaque-capability construction",()=>{expect(()=>new InstalledRecipeRegistryCapabilityV2({}, {id:"@opencircuit/design-engine",version:"forged",contentHash:("sha256:"+"0".repeat(64)) as `sha256:${string}`},("sha256:"+"1".repeat(64)) as `sha256:${string}`)).toThrow("engine-owned");});
  it("keeps presentation units out of candidate identity",()=>{const part={manufacturerId:"m",manufacturerPartNumber:"p"};const base={recipe:{id:"r",version:"1",contentHash:("sha256:"+"1".repeat(64)) as `sha256:${string}`},context:{version:"v",contentHash:("sha256:"+"2".repeat(64)) as `sha256:${string}`},requestHash:("sha256:"+"3".repeat(64)) as `sha256:${string}`,data:{x:1},components:projectCandidateIdentitySelectedComponentsV2([{id:"c",role:"r",profileId:"p",part,quantityPerAssembly:1,value:{value:1,unit:"V",displayUnit:"V"},evidence:[]}]),derivedValues:projectCandidateIdentityDerivedValuesV2([{id:"d",value:{value:2,unit:"A",displayUnit:"A"},equationId:"e",state:"calculated",evidence:[]}])};const changed={...base,components:projectCandidateIdentitySelectedComponentsV2([{id:"c",role:"r",profileId:"p",part,quantityPerAssembly:1,value:{value:1,unit:"V",displayUnit:"mV"},evidence:[]}])};expect(canonicalCandidateIdentityV2(changed)).toBe(canonicalCandidateIdentityV2(base));});
  it("parses context artifacts through a descriptor-safe single-read boundary", () => {
    const catalog = emptyCatalog(); const ranking = emptyRanking();
    const recipe = { id: "test.recipe", version: "1", contentHash: ("sha256:" + "2".repeat(64)) as `sha256:${string}`, applications: ["motor.brushed-dc" as const], metricDeclarations: [{ id: "test.metric", unit: "W" as const }] };
    const manifest = manifestWithRecipe(recipe);
    expect(parseReviewedProfileCatalogV2(catalog)).toEqual(catalog);
    expect(parseElectricalRankingPolicyV2(ranking)).toEqual(ranking);
    expect(parseElectricalDesignContextManifestV2(manifest)).toEqual(manifest);
    for (const [artifact, parser] of [[catalog, parseReviewedProfileCatalogV2], [ranking, parseElectricalRankingPolicyV2], [manifest, parseElectricalDesignContextManifestV2]] as const) {
      let reads = 0; const hostile = { ...artifact } as Record<string, unknown>;
      Object.defineProperty(hostile, "version", { enumerable: true, get() { reads += 1; return artifact.version; } });
      expect(() => parser(hostile)).toThrow(); expect(reads).toBe(0);
    }
  });
  it("rejects non-admitted profiles and closed recipe-ref vocabulary before hash drift can hide it", () => {
    const catalog = emptyCatalog();
    const fakePayload = { ...catalog, profiles: [{ format: "schemagic-design-profile", schemaVersion: "1.0.0", partClass: "motor.integrated-h-bridge", part: { manufacturerId: "fake", manufacturerPartNumber: "FAKE" }, factsSchemaVersion: "1.0.0", commonFacts: {}, facts: {} }] };
    const { contentHash: _oldCatalogHash, ...fakeWithoutHash } = fakePayload;
    expect(() => parseReviewedProfileCatalogV2({ ...fakeWithoutHash, contentHash: calculateReviewedProfileCatalogV2ContentHash(fakeWithoutHash as never) })).toThrow();
    const base = { id: "test.recipe", version: "1", contentHash: ("sha256:" + "2".repeat(64)) as `sha256:${string}`, applications: ["motor.brushed-dc" as const], metricDeclarations: [{ id: "test.metric", unit: "W" as const }] };
    for (const recipe of [
      { ...base, applications: ["unknown.application"] },
      { ...base, metricDeclarations: [{ id: "test.metric", unit: "dBm" }] },
      { ...base, metricDeclarations: [{ id: "test.metric", unit: "W", extra: true }] },
    ]) expect(() => parseElectricalDesignContextManifestV2(manifestWithRecipe(recipe as never))).toThrow();
  });
  it("correlates report, manifest, and ranking collection type versus resource failures", () => {
    const rejectionInputs = Array.from({ length: 16_385 }, (_, index) => ({
      stage: "solve" as const, reasonCode: "recipe_rejected" as const, recipeId: "test.recipe",
      optionKey: `option-${String(index).padStart(5, "0")}`, recipeReason: "rejected",
      componentProfileIds: [], constraints: [],
    }));
    const rejections = rejectionInputs.map((rejection) => ({ ...rejection, message: renderGenerationRejectionMessageV2(rejection) }));
    const counts = { recipes: 1, supportedRecipes: 1, enumerated: rejections.length, solved: 0, matchOutcomes: 0, matched: 0, checked: 0, estimated: 0, deduped: 0, pareto: 0, materialized: 0, coverageValidated: 0, rejected: rejections.length };
    try { parseDesignExecutionReportV2({ pipeline: PIPELINE_STAGES_V2, counts, rejections }); throw new Error("Expected report resource failure"); }
    catch (error) { expect(error).toBeInstanceOf(DesignParseErrorV2); expect((error as DesignParseErrorV2).detail).toEqual({ code: "resource_limit", stage: "parse", artifact: "execution_report" }); }
    try { parseDesignExecutionReportV2({ pipeline: PIPELINE_STAGES_V2, counts: { ...counts, enumerated: 0, rejected: 0 }, rejections: {} }); throw new Error("Expected report type failure"); }
    catch (error) { expect((error as DesignParseErrorV2).detail).toEqual({ code: "invalid_document", stage: "parse", artifact: "execution_report" }); }
    const oneCounts = { ...counts, enumerated: 1, rejected: 1 };
    const invalidQuantityInput = { ...rejectionInputs[0]!, constraints: [{ ruleId: "test.rule", status: "fail", actual: { value: 1, unit: "dBm", displayUnit: "dBm" }, explanation: "invalid unit", evidence: [] }] };
    const invalidQuantity = { ...invalidQuantityInput, message: renderGenerationRejectionMessageV2(invalidQuantityInput as never) };
    expect(() => parseDesignExecutionReportV2({ pipeline: PIPELINE_STAGES_V2, counts: oneCounts, rejections: [invalidQuantity] })).toThrow(DesignParseErrorV2);
    const invalidDisplayInput = { ...rejectionInputs[0]!, constraints: [{ ruleId: "test.rule", status: "fail", actual: { value: 1, unit: "V", displayUnit: "V\n" }, explanation: "invalid display", evidence: [] }] };
    const invalidDisplay = { ...invalidDisplayInput, message: renderGenerationRejectionMessageV2(invalidDisplayInput as never) };
    expect(() => parseDesignExecutionReportV2({ pipeline: PIPELINE_STAGES_V2, counts: oneCounts, rejections: [invalidDisplay] })).toThrow(DesignParseErrorV2);
    const overProfilesInput = { ...rejectionInputs[0]!, componentProfileIds: Array.from({ length: 4_097 }, (_, index) => `profile-${String(index).padStart(4, "0")}`) };
    const overProfiles = { ...overProfilesInput, message: renderGenerationRejectionMessageV2(overProfilesInput) };
    try { parseDesignExecutionReportV2({ pipeline: PIPELINE_STAGES_V2, counts: oneCounts, rejections: [overProfiles] }); throw new Error("Expected profile resource failure"); }
    catch (error) { expect((error as DesignParseErrorV2).detail).toEqual({ code: "resource_limit", stage: "parse", artifact: "execution_report" }); }

    const recipe = { id: "test.recipe", version: "1", contentHash: ("sha256:" + "2".repeat(64)) as `sha256:${string}`, applications: ["motor.brushed-dc" as const], metricDeclarations: [{ id: "test.metric", unit: "W" as const }] };
    const baseManifest = manifestWithRecipe(recipe); const { contentHash: _manifestHash, ...manifestPayload } = baseManifest;
    const recipes = Array.from({ length: 257 }, (_, index) => ({ ...recipe, id: `test.recipe.${String(index).padStart(3, "0")}` }));
    const overManifestPayload = { ...manifestPayload, recipes };
    try { parseElectricalDesignContextManifestV2({ ...overManifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(overManifestPayload) }); throw new Error("Expected manifest resource failure"); }
    catch (error) { expect((error as DesignParseErrorV2).detail).toEqual({ code: "resource_limit", stage: "parse", artifact: "electrical_context_manifest" }); }

    const ranking = emptyRanking();
    try { parseElectricalRankingPolicyV2({ ...ranking, paretoCriteria: {} }); throw new Error("Expected ranking type failure"); }
    catch (error) { expect((error as DesignParseErrorV2).detail).toEqual({ code: "invalid_document", stage: "parse", artifact: "electrical_ranking_policy" }); }
    try { parseElectricalRankingPolicyV2({ ...ranking, paretoCriteria: Array.from({ length: 4_097 }, () => ({ source: "metric", metricId: "test.metric", direction: "minimize" })) }); throw new Error("Expected ranking resource failure"); }
    catch (error) { expect((error as DesignParseErrorV2).detail).toEqual({ code: "resource_limit", stage: "parse", artifact: "electrical_ranking_policy" }); }
  });
});
