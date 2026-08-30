import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  designProfileEnvelopeContentHash,
  loadReviewedDesignLibraryEnvelope,
} from "@opencircuit/design-library";
import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import { compareDesignV2Tokens, migrateDesignRequestV1ToV2 } from "@opencircuit/design-schema";
import {
  MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID,
  MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_SOURCE_CONTENT_HASH,
  MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID,
  MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED,
  createInstalledNativeRecipeSets,
} from "../src";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED } from "../src/motor-integrated-v32-local-capacitance-recommendation-qualified";
import type { NativeEnvironmentV2, NativeSolvedOptionV2 } from "../src/types";

const DRV8876_PROFILE_ID =
  "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json";
const STSPIN840_PROFILE_ID =
  "packages/design-library/parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json";

function environment(): NativeEnvironmentV2 {
  const catalog = loadReviewedDesignLibraryEnvelope(getBundledReviewedReleaseDocuments());
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migrated = migrateDesignRequestV1ToV2(source, catalog.version);
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") {
    throw new Error("Expected a migrated Motor request");
  }
  return {
    request: {
      ...migrated.request,
      constraints: {
        ...migrated.request.constraints,
        allowedTopologyFamilies: ["motor.hbridge.integrated"],
        allowedPackages: [],
        allowUnknownHardConstraints: true,
      },
    },
    catalog: { profiles: catalog.profiles },
    manifest: { version: catalog.version },
  };
}

function solved(
  option: ReturnType<typeof MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.enumerate>[number],
  input: NativeEnvironmentV2,
): NativeSolvedOptionV2 {
  const outcome = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.solve(option, input);
  if (outcome.status !== "ok") throw new Error(`Expected solve success: ${outcome.reason}`);
  return outcome.value;
}

describe("Motor integrated facts-V3.2.6 companion-network safety gate", () => {
  it("rejects every exact DRV8262 option in match before components can be materialized", () => {
    const input = environment();
    const profile = input.catalog.profiles.find((entry) => (
      entry.part.manufacturerPartNumber === "DRV8262DDVR"
    ));
    expect(profile).toBeDefined();
    expect(designProfileEnvelopeContentHash(profile!))
      .toBe(MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_CONTENT_HASH);

    const options = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED
      .enumerate(input)
      .filter((option) => option.data.primaryProfileId === MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID);
    expect(options).toHaveLength(10);

    for (const option of options) {
      const exactSolved = solved(option, input);
      const predecessor = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED
        .match(exactSolved, input);
      expect(predecessor).toEqual([expect.objectContaining({
        status: "ok",
        value: expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({ id: "local-decoupling", quantityPerAssembly: 1 }),
          ]),
        }),
      })]);

      const outcomes = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED
        .match(exactSolved, input);
      expect(outcomes).toEqual([{
        status: "rejected",
        reason: expect.stringMatching(/^companion_network_unrepresentable:.*two distinct VM bypass positions.*separate charge-pump and regulator capacitor networks.*one-local-capacitor recipe/),
        constraints: [{
          ruleId: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID,
          status: "fail",
          explanation: expect.stringMatching(/rejected at match before component materialization or customization-witness creation/),
          evidence: [expect.objectContaining({
            sourceId: "ti-drv8262-slvsfv5c",
            contentHash: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_SOURCE_CONTENT_HASH,
            locator: expect.stringMatching(/CVM1 and CVM2.*VM to PGND12 and PGND34/),
          })],
        }],
        componentProfileIds: Object.values(option.data)
          .filter((value): value is string => typeof value === "string")
          .sort(compareDesignV2Tokens),
      }]);
      expect(outcomes.some((outcome) => outcome.status === "ok")).toBe(false);
      expect(outcomes[0]).not.toHaveProperty("value");
    }
  }, 30_000);

  it("fails the reserved exact identity closed when its profile bytes drift", () => {
    const input = environment();
    const changed = structuredClone(input);
    const profile = changed.catalog.profiles.find((entry) => (
      entry.part.manufacturerPartNumber === "DRV8262DDVR"
    ));
    if (!profile || profile.factsSchemaVersion !== "3.2.0") throw new Error("Expected DRV8262 facts V3.2");
    profile.facts.localSupplyDecouplingCapacitance.explanation += " Byte drift after review.";
    expect(designProfileEnvelopeContentHash(profile))
      .not.toBe(MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_CONTENT_HASH);

    const option = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED
      .enumerate(changed)
      .find((entry) => entry.data.primaryProfileId === MOTOR_INTEGRATED_V32_COMPANION_NETWORK_DRV8262_PROFILE_ID);
    if (!option) throw new Error("Expected reserved DRV8262 option");
    const outcomes = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED
      .match(solved(option, changed), changed);
    expect(outcomes).toEqual([expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/^companion_network_binding_unverified:/),
      constraints: [expect.objectContaining({
        ruleId: MOTOR_INTEGRATED_V32_COMPANION_NETWORK_RULE_ID,
        status: "fail",
        evidence: [],
      })],
    })]);
  });

  it("delegates all DRV8876 and STSPIN options unchanged to immutable 3.2.5", () => {
    const input = environment();
    const options = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED
      .enumerate(input)
      .filter((option) => (
        option.data.primaryProfileId === DRV8876_PROFILE_ID
        || option.data.primaryProfileId === STSPIN840_PROFILE_ID
      ));
    expect(options).toHaveLength(20);
    for (const option of options) {
      const exactSolved = solved(option, input);
      expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.match(exactSolved, input))
        .toEqual(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.match(exactSolved, input));
    }
  }, 30_000);

  it("locks and installs the immutable 3.2.6 successor without changing its recipe ID", () => {
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED).toMatchObject({
      id: "motor.native.integrated-h-bridge.facts-v3-2",
      version: "3.2.6",
      contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07",
    });
    expect(Object.isFrozen(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED)).toBe(true);
    expect(createInstalledNativeRecipeSets()["motor.brushed-dc"].find((recipe) => (
      recipe.id === MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.id
    ))).toMatchObject({
      version: "3.2.6",
      contentHash: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.contentHash,
    });
  });
});
