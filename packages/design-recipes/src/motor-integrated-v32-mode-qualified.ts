import {
  FACTS_SCHEMA_VERSION_V32,
  designProfileEnvelopeContentHash,
  designProfileId,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  type BrushedDcMotorDesignRequestV2,
  type ConstraintResult,
  type EvidenceRef,
} from "@opencircuit/design-schema";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32 } from "./motor-integrated-v32";
import type { NativeEnvironmentV2, NativeMatchedOptionV2, NativeRecipeV2 } from "./types";

export const MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_PROFILE_CONTENT_HASH =
  "sha256:1786e77a459d8efbc83693b2c79770a3673d6b28e093b3f4f655468156850ef5" as const;

export const MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_SOURCE_CONTENT_HASH =
  "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032" as const;

const OPERATING_MODES_RULE_ID = "motor.integrated.operating-modes" as const;
const SUPPORTED_OPERATING_MODES = ["brake", "coast", "forward", "reverse"] as const;

const DRV8876_MODE_EVIDENCE: EvidenceRef = {
  sourceId: "ti-drv8876-slvsds7b",
  locator: "physical PDF pages 10-11, section 7.3.2, Table 2 PMODE selection and Table 4 PWM-mode control truth table: with PMODE sampled logic high at device power-up and nSLEEP logic high, IN1/IN2 00 is coast (Hi-Z/Hi-Z), 01 is reverse (L/H), 10 is forward (H/L), and 11 is brake (L/L, low-side slow decay)",
  retrievedAt: "2026-08-24T10:44:40Z",
  contentHash: MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_SOURCE_CONTENT_HASH,
  licenseNote: "Manufacturer-published factual data referenced by URL; the source document is not redistributed.",
};

const RELEASE_V323 = {
  id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
  version: "3.2.3",
  predecessor: {
    id: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
    version: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.version,
    contentHash: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.contentHash,
  },
  equations: [
    "motor.integrated.facts-v3-2.exact-operating-mode-evidence-binding.v1",
  ],
  operatingModeBindings: [{
    role: "primary",
    partClass: "motor.integrated-h-bridge",
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "DRV8876PWPR",
    profileContentHash: MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_PROFILE_CONTENT_HASH,
    source: {
      sourceId: DRV8876_MODE_EVIDENCE.sourceId,
      contentHash: MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_SOURCE_CONTENT_HASH,
      url: "https://www.ti.com/lit/ds/symlink/drv8876.pdf",
      revision: "SLVSDS7B, August 2019 – revised November 2019",
      retrievedAt: DRV8876_MODE_EVIDENCE.retrievedAt,
      locator: DRV8876_MODE_EVIDENCE.locator,
    },
    configuration: {
      controlMode: "pwm",
      pmodeAtPowerUp: "logic_high",
      nSleep: "logic_high",
    },
    truthTable: [
      { in1: 0, in2: 0, out1: "high_impedance", out2: "high_impedance", mode: "coast" },
      { in1: 0, in2: 1, out1: "low", out2: "high", mode: "reverse" },
      { in1: 1, in2: 0, out1: "high", out2: "low", mode: "forward" },
      { in1: 1, in2: 1, out1: "low", out2: "low", mode: "brake", decay: "low_side_slow" },
    ],
    supportedRequestModes: SUPPORTED_OPERATING_MODES,
    nonclaims: [
      "pmode_or_nsleep_wiring",
      "package_pin_mapping",
      "current_regulation_interaction",
      "braking_torque_energy_thermal_or_suppression",
      "fast_decay_braking",
      "selected_part_scenario_or_simulation_fidelity",
    ],
  }],
} as const;

function selectedPrimaryProfile(
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
) {
  const selectedId = option.data.primaryProfileId;
  if (typeof selectedId !== "string") return undefined;
  return environment.catalog.profiles.find((profile) => (
    profile.partClass === "motor.integrated-h-bridge"
    && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32
    && designProfileId(profile.partClass, profile.part) === selectedId
  ));
}

function operatingModesConstraint(
  predecessor: ConstraintResult,
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
): ConstraintResult {
  const primary = selectedPrimaryProfile(option, environment);
  if (
    primary === undefined
    || primary.part.manufacturerId !== "texas-instruments"
    || primary.part.manufacturerPartNumber !== "DRV8876PWPR"
    || designProfileEnvelopeContentHash(primary) !== MOTOR_INTEGRATED_V32_MODE_QUALIFIED_DRV8876_PROFILE_CONTENT_HASH
  ) {
    return predecessor;
  }
  if (environment.request.application !== "motor.brushed-dc") return predecessor;
  const request = environment.request as Readonly<BrushedDcMotorDesignRequestV2>;
  const unsupported = request.requirements.operatingModes.filter((mode) => (
    !(SUPPORTED_OPERATING_MODES as readonly string[]).includes(mode)
  ));
  if (unsupported.length > 0) {
    return {
      ruleId: OPERATING_MODES_RULE_ID,
      status: "fail",
      explanation: `The exact bound PWM-mode truth table does not support requested mode(s): ${unsupported.join(", ")}.`,
      evidence: [{ ...DRV8876_MODE_EVIDENCE }],
    };
  }
  return {
    ruleId: OPERATING_MODES_RULE_ID,
    status: "pass",
    explanation: "The exact DRV8876PWPR profile and hash-bound TI PWM-mode truth table support every requested forward, reverse, coast, and brake mode when PMODE is sampled logic high at device power-up and nSLEEP is logic high. This device-support result does not prove PMODE or nSLEEP wiring, package-pin mapping, current-regulation interaction, braking torque, energy, thermal or suppression capability, fast-decay braking, or selected-part scenario and simulation fidelity.",
    evidence: [{ ...DRV8876_MODE_EVIDENCE }],
  };
}

/**
 * Immutable facts-V3.2 successor. It delegates every 3.2.2 behavior and changes
 * only the operating-mode result for the exact hash-bound DRV8876PWPR profile.
 */
export const MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED: NativeRecipeV2 = Object.freeze({
  ...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32,
  version: RELEASE_V323.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE_V323)),
  applications: Object.freeze([...MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.applications]) as NativeRecipeV2["applications"],
  metricDeclarations: Object.freeze(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.metricDeclarations.map((entry) => Object.freeze({ ...entry }))) as NativeRecipeV2["metricDeclarations"],
  check(option: Readonly<NativeMatchedOptionV2>, environment: NativeEnvironmentV2) {
    return MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.check(option, environment).map((constraint) => (
      constraint.ruleId === OPERATING_MODES_RULE_ID
        ? operatingModesConstraint(constraint, option, environment)
        : constraint
    ));
  },
});
