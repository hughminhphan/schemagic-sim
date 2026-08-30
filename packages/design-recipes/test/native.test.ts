import { describe, expect, it } from "vitest";
import { createSyntheticReviewedLibraryFixture } from "@opencircuit/design-library/fixtures";
import { designProfileId, loadReviewedDesignLibrary } from "@opencircuit/design-library";
import { createInstalledNativeRecipeSets } from "../src";

describe("catalog-native recipe release identities", () => {
  it("installs the exact six closed Motor topology recipes", () => {
    const ids = createInstalledNativeRecipeSets()["motor.brushed-dc"].map((recipe) => recipe.id);
    expect(ids).toEqual([
      "motor.native.external-nmos-h-bridge.facts-v2",
      "motor.native.external-nmos-h-bridge.facts-v3",
      "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      "motor.native.integrated-h-bridge",
      "motor.native.integrated-h-bridge.facts-v2",
      "motor.native.integrated-h-bridge.facts-v3-2",
    ]);
    expect(createInstalledNativeRecipeSets()["motor.brushed-dc"].map(({ id, version, contentHash }) => ({ id, version, contentHash }))).toEqual([
      { id: "motor.native.external-nmos-h-bridge.facts-v2", version: "2.0.0", contentHash: "sha256:3bc0f393cab9ac039bc4b564131dcb1e95c2369bd4855ee330454f64d65847d8" },
      { id: "motor.native.external-nmos-h-bridge.facts-v3", version: "3.0.0", contentHash: "sha256:cffc48e4bee012d0013243a84cfd74ae1790f49d9f4fa88ec6a066de52fb2854" },
      { id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified", version: "3.1.7", contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947" },
      { id: "motor.native.integrated-h-bridge", version: "1.0.0", contentHash: "sha256:3e441b3002d1cf83fe083c46cd5aae88425f39886617e66ec2253a60d53fed2c" },
      { id: "motor.native.integrated-h-bridge.facts-v2", version: "2.0.0", contentHash: "sha256:3fa1058e67d5906423153d1dc1150d78951f696fc5a747b8bfcc135ba7275d0b" },
      { id: "motor.native.integrated-h-bridge.facts-v3-2", version: "3.2.6", contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07" },
    ]);
  });

  it("installs the dedicated external-FET facts-V3 recipe beside the facts-V3.4 inductor-qualified successor", () => {
    const installed = createInstalledNativeRecipeSets()["power.buck"];
    const ids = installed.map((recipe) => recipe.id);
    expect(ids).toContain("power.native.facts-v2");
    expect(installed.find((recipe) => recipe.id === "power.native.external-fet-synchronous-buck.facts-v3")).toMatchObject({
      id: "power.native.external-fet-synchronous-buck.facts-v3",
      version: "3.0.0",
      contentHash: "sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538",
    });
    expect(installed).toHaveLength(4);
    expect(installed.filter((recipe) => recipe.supports({
      application: "power.buck",
      constraints: { allowedTopologyFamilies: ["power.buck.integrated-synchronous"] },
    } as never))).toHaveLength(3);
    expect(installed.find((recipe) => recipe.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified")).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.6",
      contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
      metricDeclarations: expect.arrayContaining([
        { id: "power.passive.inductor-peak-current-observation", unit: "A" },
        { id: "power.passive.inductor-ripple-current-observation", unit: "A" },
        { id: "power.passive.inductor-rms-current-observation", unit: "A" },
        { id: "power.passive.output-capacitor-bank-rms-current-observation", unit: "A" },
      ]),
    });
    expect(installed.some((recipe) => recipe.id === "power.native.integrated-synchronous-buck.facts-v3-4")).toBe(false);
  });

  it("enumerates exact reviewed profile IDs and stays empty without the primary class", () => {
    const documents = createSyntheticReviewedLibraryFixture(["motor.integrated-h-bridge", "shared.mlcc-capacitor"]);
    const profiles = loadReviewedDesignLibrary(documents).profiles;
    const environment = { request: {} as never, catalog: { profiles }, manifest: {} };
    const recipes = createInstalledNativeRecipeSets();
    const motorCompatibility = recipes["motor.brushed-dc"].find((recipe) => recipe.id === "motor.native.integrated-h-bridge")!;
    const powerCompatibility = recipes["power.buck"].find((recipe) => recipe.id === "power.native.integrated-synchronous-buck")!;
    expect(motorCompatibility.enumerate(environment)).toEqual([{
      optionKey: designProfileId(profiles[0]!.partClass, profiles[0]!.part),
      data: { primaryProfileId: designProfileId(profiles[0]!.partClass, profiles[0]!.part) },
    }]);
    expect(powerCompatibility.enumerate(environment)).toEqual([]);
    expect(Object.isFrozen(recipes)).toBe(true);
    expect(createInstalledNativeRecipeSets()).not.toBe(recipes);
    const invalid = structuredClone(profiles);
    const primary = invalid.find((profile) => profile.partClass === "motor.integrated-h-bridge")!;
    (primary.facts as any).supplyMaximum.value = { value: "not-a-number", unit: "V", displayUnit: "V" };
    expect(() => motorCompatibility.enumerate({ request: {} as never, catalog: { profiles: invalid }, manifest: {} })).toThrow();
    const forgedClass = structuredClone(profiles);
    (forgedClass.find((profile) => profile.partClass === "shared.mlcc-capacitor") as any).partClass = "motor.integrated-h-bridge";
    expect(() => motorCompatibility.enumerate({ request: {} as never, catalog: { profiles: forgedClass }, manifest: {} })).toThrow();
  });

  it("uses frozen raw UTF-16 token order rather than locale collation", () => {
    const base = loadReviewedDesignLibrary(createSyntheticReviewedLibraryFixture(["motor.integrated-h-bridge"])).profiles[0]!;
    const upper = structuredClone(base);
    upper.part.manufacturerPartNumber = "Z-PART";
    const lower = structuredClone(base);
    lower.part.manufacturerPartNumber = "a-PART";
    const environment = { request: {} as never, catalog: { profiles: [lower, upper] }, manifest: {} };
    const compatibility = createInstalledNativeRecipeSets()["motor.brushed-dc"]
      .find((recipe) => recipe.id === "motor.native.integrated-h-bridge")!;
    const options = compatibility.enumerate(environment);
    expect(options.map((entry) => entry.optionKey)).toEqual([
      designProfileId(upper.partClass, upper.part),
      designProfileId(lower.partClass, lower.part),
    ]);
  });
});
