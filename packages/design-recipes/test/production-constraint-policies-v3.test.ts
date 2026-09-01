import {
  calculateConstraintPolicyCatalogV3ContentHash,
  parseConstraintPolicyCatalogV3,
  type ConstraintPolicyCatalogV3,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_INTERFACE_QUALIFIED,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED,
} from "../src/motor-external-v2";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED } from "../src/motor-integrated-v32-mode-qualified";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED } from "../src/motor-integrated-v32-mode-qualified-binding-refreshed";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED } from "../src/motor-integrated-v32-local-capacitance-recommendation-qualified";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED } from "../src/motor-integrated-v32-companion-network-gated";
import { MOTOR_NATIVE_RECIPE_FACTS_V2 } from "../src/motor-v2";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33 } from "../src/power-integrated-v33";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34 } from "../src/power-integrated-v34";
import {
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS,
  POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES,
} from "../src/power-integrated-v34-inductor-qualified";
import { POWER_NATIVE_RECIPE_FACTS_V2 } from "../src/power-v2";
import {
  MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY,
} from "../src";

const MOTOR_EXTERNAL_V31_RULE_IDS = [
  "motor.external.assembly.allowed-packages",
  "motor.external.assembly.board-area",
  "motor.external.assembly.component-height",
  "motor.external.bootstrap-capacitance",
  "motor.external.bootstrap-capacitance-nominal",
  "motor.external.bulk-capacitance",
  "motor.external.bulk-voltage-rating",
  "motor.external.capacitor-placement",
  "motor.external.current-sense-threshold",
  "motor.external.driver-bias-source",
  "motor.external.driver-logic-threshold",
  "motor.external.driver-pulse-off-time",
  "motor.external.driver-pulse-on-time",
  "motor.external.driver-pwm-frequency",
  "motor.external.driver-switch-node-absolute-maximum",
  "motor.external.driver-switch-node-operating-maximum",
  "motor.external.driver-switch-node-operating-minimum",
  "motor.external.gate-network",
  "motor.external.high-side-duty",
  "motor.external.local-capacitance-effective",
  "motor.external.local-capacitance-nominal",
  "motor.external.local-voltage-rating",
  "motor.external.mosfet-continuous-current",
  "motor.external.mosfet-pulsed-soa",
  "motor.external.mosfet-vds",
  "motor.external.passive-derating",
  "motor.external.request.motor-dynamics",
  "motor.external.switching-and-loss",
  "motor.external.thermal",
  "motor.external.tvs-coordination",
  "motor.external.tvs-published-clamp-driver-switch-node-limit",
  "motor.external.tvs-published-clamp-mosfet-limit",
  "motor.external.tvs-stand-off",
] as const;

const MOTOR_INTEGRATED_V32_RULE_IDS = [
  "motor.integrated.assembly.allowed-packages",
  "motor.integrated.assembly.board-area",
  "motor.integrated.assembly.component-height",
  "motor.integrated.bulk-capacitance-nominal",
  "motor.integrated.bulk-voltage-rating",
  "motor.integrated.capacitor-derating",
  "motor.integrated.continuous-current",
  "motor.integrated.current-limit",
  "motor.integrated.high-side-duty",
  "motor.integrated.local-capacitance-nominal",
  "motor.integrated.local-voltage-rating",
  "motor.integrated.logic-threshold",
  "motor.integrated.motor-dynamics",
  "motor.integrated.operating-load",
  "motor.integrated.operating-modes",
  "motor.integrated.peak-current",
  "motor.integrated.pulse-off-time",
  "motor.integrated.pulse-on-time",
  "motor.integrated.pwm-frequency",
  "motor.integrated.supply-absolute-maximum",
  "motor.integrated.supply-maximum",
  "motor.integrated.supply-minimum",
  "motor.integrated.thermal",
  "motor.integrated.transient-margin",
] as const;

const POWER_INTEGRATED_V33_RULE_IDS = [
  "power.assembly.allowed-packages",
  "power.assembly.board-area",
  "power.assembly.component-height",
  "power.control.loop-stability",
  "power.feedback.output-voltage",
  "power.inductor.rms-current",
  "power.inductor.saturation-current",
  "power.inductor.selected-value",
  "power.passive.bootstrap-effective-capacitance",
  "power.passive.capacitor-effective-capacitance",
  "power.passive.resistor-power-voltage",
  "power.regulator.absolute-maximum-junction",
  "power.regulator.current-limit",
  "power.regulator.input-maximum",
  "power.regulator.input-minimum",
  "power.regulator.minimum-off-time",
  "power.regulator.minimum-on-time",
  "power.regulator.output-current",
  "power.regulator.output-maximum",
  "power.regulator.output-minimum",
  "power.regulator.switching-spread-maximum",
  "power.regulator.switching-spread-minimum",
  "power.request.load-transient",
  "power.request.output-ripple",
  "power.thermal.loss-model",
  "power.thermal.maximum-junction",
] as const;

const MOTOR_EXTERNAL_V31_SAFETY_RULE_IDS = [
  "motor.external.bootstrap-capacitance",
  "motor.external.bootstrap-capacitance-nominal",
  "motor.external.bulk-capacitance",
  "motor.external.bulk-voltage-rating",
  "motor.external.capacitor-placement",
  "motor.external.current-sense-threshold",
  "motor.external.driver-switch-node-absolute-maximum",
  "motor.external.gate-network",
  "motor.external.local-capacitance-effective",
  "motor.external.local-capacitance-nominal",
  "motor.external.local-voltage-rating",
  "motor.external.mosfet-continuous-current",
  "motor.external.mosfet-pulsed-soa",
  "motor.external.mosfet-vds",
  "motor.external.passive-derating",
  "motor.external.switching-and-loss",
  "motor.external.thermal",
  "motor.external.tvs-coordination",
  "motor.external.tvs-published-clamp-driver-switch-node-limit",
  "motor.external.tvs-published-clamp-mosfet-limit",
  "motor.external.tvs-stand-off",
] as const;

const MOTOR_INTEGRATED_V32_SAFETY_RULE_IDS = [
  "motor.integrated.bulk-capacitance-nominal",
  "motor.integrated.bulk-voltage-rating",
  "motor.integrated.capacitor-derating",
  "motor.integrated.continuous-current",
  "motor.integrated.current-limit",
  "motor.integrated.local-capacitance-nominal",
  "motor.integrated.local-voltage-rating",
  "motor.integrated.operating-load",
  "motor.integrated.peak-current",
  "motor.integrated.supply-absolute-maximum",
  "motor.integrated.thermal",
  "motor.integrated.transient-margin",
] as const;

const POWER_INTEGRATED_V33_SAFETY_RULE_IDS = [
  "power.control.loop-stability",
  "power.inductor.rms-current",
  "power.inductor.saturation-current",
  "power.inductor.selected-value",
  "power.passive.bootstrap-effective-capacitance",
  "power.passive.capacitor-effective-capacitance",
  "power.passive.resistor-power-voltage",
  "power.regulator.absolute-maximum-junction",
  "power.regulator.current-limit",
  "power.regulator.input-maximum",
  "power.regulator.output-current",
  "power.thermal.loss-model",
  "power.thermal.maximum-junction",
] as const;

function expectRecursivelyFrozen(catalog: ConstraintPolicyCatalogV3): void {
  expect(Object.isFrozen(catalog)).toBe(true);
  expect(Object.isFrozen(catalog.recipePolicies)).toBe(true);
  for (const recipe of catalog.recipePolicies) {
    expect(Object.isFrozen(recipe)).toBe(true);
    expect(Object.isFrozen(recipe.rules)).toBe(true);
    for (const policyRule of recipe.rules) expect(Object.isFrozen(policyRule)).toBe(true);
  }
}

describe("production V3 constraint policy catalogs", () => {
  it("parses, hashes, freezes, and reproduces each catalog deterministically", () => {
    for (const exact of [MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3, POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3]) {
      expect(parseConstraintPolicyCatalogV3(exact)).toEqual(exact);
      expect(calculateConstraintPolicyCatalogV3ContentHash(exact)).toBe(exact.contentHash);
      const reparsed = parseConstraintPolicyCatalogV3(structuredClone(exact));
      expect(reparsed).toEqual(exact);
      expect(reparsed.contentHash).toBe(exact.contentHash);
      expectRecursivelyFrozen(exact);
      expectRecursivelyFrozen(reparsed);
    }
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.contentHash).toBe("sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0");
    expect(POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.contentHash).toBe("sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6");
  });

  it("binds exact sorted production recipe and normal-path rule coverage", () => {
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies.map(({ recipeId, recipeContentHash }) => ({ recipeId, recipeContentHash }))).toEqual([
      {
        recipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
        recipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
      },
      {
        recipeId: "motor.native.integrated-h-bridge.facts-v3-2",
        recipeContentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07",
      },
    ]);
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[0]!.rules.map((entry) => entry.ruleId)).toEqual(MOTOR_EXTERNAL_V31_RULE_IDS);
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[1]!.rules.map((entry) => entry.ruleId)).toEqual(MOTOR_INTEGRATED_V32_RULE_IDS);
    expect(POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies.map(({ recipeId, recipeContentHash }) => ({ recipeId, recipeContentHash }))).toEqual([{
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      recipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
    }]);
    expect(POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[0]!.rules.map((entry) => entry.ruleId)).toEqual(POWER_INTEGRATED_V33_RULE_IDS);
  });

  it("keeps only request-conditional and assembly rules optional in their exact recipe scope", () => {
    for (const exact of [MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3, POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3]) {
      for (const recipe of exact.recipePolicies) {
        const expectedConditional = recipe.rules
          .filter((entry) => entry.ruleId.includes(".assembly.") || entry.ruleId === "power.request.load-transient")
          .map((entry) => entry.ruleId);
        expect(recipe.rules.filter((entry) => entry.presence === "conditional").map((entry) => entry.ruleId)).toEqual(expectedConditional);
        expect(recipe.rules
          .filter((entry) => !expectedConditional.includes(entry.ruleId))
          .every((entry) => entry.presence === "required")).toBe(true);
      }
    }
  });

  it("uses only conservative safety or requirement criticality with explicit rationales", () => {
    const rules = [MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3, POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3]
      .flatMap((catalog) => catalog.recipePolicies)
      .flatMap((recipe) => recipe.rules);
    expect(rules.some((entry) => entry.criticality === "engineering_gap")).toBe(false);
    expect(rules.every((entry) => entry.criticality === "safety" || entry.criticality === "requirement")).toBe(true);
    expect(rules.every((entry) => entry.rationale.length > 0)).toBe(true);
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[0]!.rules.filter((entry) => entry.criticality === "safety").map((entry) => entry.ruleId)).toEqual(MOTOR_EXTERNAL_V31_SAFETY_RULE_IDS);
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[1]!.rules.filter((entry) => entry.criticality === "safety").map((entry) => entry.ruleId)).toEqual(MOTOR_INTEGRATED_V32_SAFETY_RULE_IDS);
    expect(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[1]!.rules.find((entry) => entry.ruleId === "motor.integrated.local-capacitance-nominal")?.rationale)
      .toMatch(/exact reviewed nominal-value conformance.*does not assert a manufacturer-required minimum or effective local-supply adequacy/);
    expect(POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[0]!.rules.filter((entry) => entry.criticality === "safety").map((entry) => entry.ruleId)).toEqual(POWER_INTEGRATED_V33_SAFETY_RULE_IDS);
  });

  it("documents the retained-candidate boundary and excludes fallback-only rules", () => {
    expect(PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY).toContain("retained candidates");
    expect(PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY).toContain("deliberately excluded");
    const ruleIds = [MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3, POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3]
      .flatMap((catalog) => catalog.recipePolicies)
      .flatMap((recipe) => recipe.rules)
      .map((entry) => entry.ruleId);
    expect(ruleIds).not.toContain("motor.integrated.profile-set");
    expect(ruleIds).not.toContain("motor.external.profile-set");
    expect(ruleIds).not.toContain("power.profile.primary");
    expect(ruleIds).not.toContain("power.profile.passive-set");
    expect(ruleIds).not.toContain("power.request.switching-selection");
  });

  it("does not drift existing V2 recipe release hashes", () => {
    expect(MOTOR_NATIVE_RECIPE_FACTS_V2.contentHash).toBe("sha256:3fa1058e67d5906423153d1dc1150d78951f696fc5a747b8bfcc135ba7275d0b");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.contentHash).toBe("sha256:3bc0f393cab9ac039bc4b564131dcb1e95c2369bd4855ee330454f64d65847d8");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.contentHash).toBe("sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_INTERFACE_QUALIFIED.contentHash).toBe("sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED.contentHash).toBe(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[0]!.recipeContentHash);
    expect(POWER_NATIVE_RECIPE_FACTS_V2.contentHash).toBe("sha256:639380e8e9bd232d69d3038f3f263a8e5f708fa7f7a6f2262bd32944e7916eb5");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED.contentHash)
      .toBe("sha256:86d3e6fed563d7e663d74f692286a2287b2932afea198fe76dc86eab07c50ece");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED.contentHash)
      .toBe("sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.contentHash)
      .toBe("sha256:75e1ea8fa6c3c4fadd44187b9134a2e61840d2ad5b0123d0bbaff17a910dce1a");
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.contentHash)
      .toBe(MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[1]!.recipeContentHash);
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33.contentHash).toBe("sha256:17c209ff53ac786a0e1399abf3b959ab8b2a735e7272366bc18bb116f2d29e36");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34.contentHash).toBe("sha256:905cb64fa631ff59c87689043dfe76ee314bd36dcd8ee53297a29053f982e9a7");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED.contentHash).toBe("sha256:86d679c665cd46d355eddfdaa3bda2f80e8f6c7d97b31f7f6e6ce88dc619968a");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_REQUEST_CONDITIONAL.contentHash).toBe("sha256:b39032f3fe4ab1b40a12ac7128bf09db18c31e369a96ead925dd3e1b06710a84");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_INDUCTOR_QUALIFIED_DC_REGULATION.contentHash)
      .toBe("sha256:e39f5e67c0fd52d44170f0222455eade876385ba0771d6e78c420d02aa60999c");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVES.contentHash)
      .toBe("sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee");
    expect(POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS.contentHash)
      .toBe(POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies[0]!.recipeContentHash);
  });
});
