import { describe, expect, it } from "vitest";
import {
  ConstraintParseErrorV3,
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  calculateConstraintDecisionV3ContentHash,
  calculateConstraintPolicyCatalogV3ContentHash,
  canonicalElectricalDesignRequestV3Payload,
  designRequestHashV3,
  migrateDesignRequestV1ToV2,
  parseConstraintDecisionV3,
  parseConstraintPolicyCatalogV3,
  parseElectricalDesignRequestV3,
  projectElectricalDesignRequestV3ToObservationV2,
  type BrushedDcMotorDesignRequest,
  type ConstraintDecisionV3,
  type ConstraintPolicyCatalogV3,
} from "../src";

const hash = (digit: string) => (`sha256:${digit.repeat(64)}`) as `sha256:${string}`;
const candidateId = (digit: string) => `candidate:v2:${hash(digit)}` as const;

function policy(): ConstraintPolicyCatalogV3 {
  const payload: Omit<ConstraintPolicyCatalogV3, "contentHash"> = {
    format: "schemagic-constraint-policy-catalog",
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    application: "motor.brushed-dc",
    recipePolicies: [{
      recipeId: "motor.native.integrated",
      recipeContentHash: hash("1"),
      rules: [
        { ruleId: "motor.engineering-gap", criticality: "engineering_gap", presence: "conditional", rationale: "Inspectable engineering work remains." },
        { ruleId: "motor.requirement", criticality: "requirement", presence: "required", rationale: "The request must be satisfied." },
        { ruleId: "motor.safety", criticality: "safety", presence: "required", rationale: "Unknown safety cannot be eligible." },
      ],
    }],
  };
  return { ...payload, contentHash: calculateConstraintPolicyCatalogV3ContentHash(payload) };
}

function decision(): ConstraintDecisionV3 {
  const payload: Omit<ConstraintDecisionV3, "contentHash"> = {
    format: "schemagic-constraint-decision",
    schemaVersion: 3,
    source: { schemaVersion: 2, resultContentHash: hash("2"), candidateIds: [candidateId("3")] },
    policy: { constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3, contentHash: policy().contentHash },
    candidates: [{
      candidateId: candidateId("3"),
      recipeId: "motor.native.integrated",
      recipeContentHash: hash("1"),
      sourceWarnings: [],
      rules: [
        { ruleId: "motor.engineering-gap", sourceStatus: "unknown", truth: "unknown", criticality: "engineering_gap", disposition: "inspectable_unknown", policyRationale: "Inspectable engineering work remains." },
        { ruleId: "motor.requirement", sourceStatus: "pass", truth: "pass", criticality: "requirement", disposition: "satisfied", policyRationale: "The request must be satisfied." },
        { ruleId: "motor.safety", sourceStatus: "pass", truth: "pass", criticality: "safety", disposition: "satisfied", policyRationale: "Unknown safety cannot be eligible." },
      ],
      eligible: true,
    }],
    eligibleCandidateIds: [candidateId("3")],
  };
  return { ...payload, contentHash: calculateConstraintDecisionV3ContentHash(payload) };
}

const q = (value: number, unit: any, displayUnit = unit) => ({ value, unit, displayUnit });
const v1Request: BrushedDcMotorDesignRequest = {
  format: "schemagic-design-request", schemaVersion: 1, application: "motor.brushed-dc",
  requirements: { supplyVoltage: { minimum: q(9,"V"), nominal: q(12,"V"), maximum: q(16,"V") }, motorNominalVoltage: q(12,"V"), continuousCurrent: q(1,"A"), stallCurrent: q(3,"A"), pwmFrequency: q(20_000,"Hz"), logicVoltage: q(3.3,"V"), ambientTemperature: q(300,"K"), operatingModes: ["forward","reverse"], currentLimitTarget: null, operatingPoint: { dutyCycle: q(.5,"1"), loadCurrent: q(1,"A"), loadCurrentBasis: "continuous_rating", loadProfile: "steady_state" }, motorModel: { windingResistance: q(4,"ohm"), windingResistanceSource: "estimated_from_nominal_voltage_and_stall_current", windingInductance: null, backEmfConstant: null, targetSpeed: null } },
  objective: "balanced", constraints: { allowedTopologyFamilies: ["motor.hbridge.integrated"], maximumJunctionTemperature: q(400,"K"), allowedPackages: [], maximumComponentHeight: null, maximumBoardArea: null, allowEstimatedValues: true, allowUnknownWarnings: true, allowUnknownHardConstraints: true }, assumptions: [{ id: "fixture", description: "Schema-only request fixture.", source: "fixture", affects: ["request"] }], libraryVersion: "v1",
};

describe("Designer V3 constraint sidecar schema", () => {
  it("parses a recipe-content-addressed policy and rejects drift or non-canonical coverage", () => {
    const exact = policy();
    expect(parseConstraintPolicyCatalogV3(exact)).toEqual(exact);
    expect(() => parseConstraintPolicyCatalogV3({ ...exact, application: "power.buck" })).toThrow(ConstraintParseErrorV3);
    const { contentHash: _hash, ...payload } = exact;
    const reversed = { ...payload, recipePolicies: [{ ...payload.recipePolicies[0]!, rules: [...payload.recipePolicies[0]!.rules].reverse() }] };
    expect(() => parseConstraintPolicyCatalogV3({ ...reversed, contentHash: calculateConstraintPolicyCatalogV3ContentHash(reversed) })).toThrow(ConstraintParseErrorV3);
    const duplicate = { ...payload, recipePolicies: [payload.recipePolicies[0]!, payload.recipePolicies[0]!] };
    expect(() => parseConstraintPolicyCatalogV3({ ...duplicate, contentHash: calculateConstraintPolicyCatalogV3ContentHash(duplicate) })).toThrow(ConstraintParseErrorV3);
  });

  it("keeps truth, criticality, and disposition separate and makes warnings fail closed", () => {
    const exact = decision();
    expect(parseConstraintDecisionV3(exact)).toEqual(exact);
    const safetyUnknownPayload = structuredClone(exact);
    safetyUnknownPayload.candidates[0]!.rules[2] = { ruleId: "motor.safety", sourceStatus: "unknown", truth: "unknown", criticality: "safety", disposition: "blocked_unknown", policyRationale: "Unknown safety cannot be eligible." };
    safetyUnknownPayload.candidates[0]!.eligible = false;
    safetyUnknownPayload.eligibleCandidateIds = [];
    safetyUnknownPayload.contentHash = calculateConstraintDecisionV3ContentHash(safetyUnknownPayload);
    expect(parseConstraintDecisionV3(safetyUnknownPayload).candidates[0]!.eligible).toBe(false);

    const forgedEligible = structuredClone(safetyUnknownPayload);
    forgedEligible.candidates[0]!.rules[2]!.disposition = "inspectable_unknown";
    forgedEligible.candidates[0]!.eligible = true;
    forgedEligible.eligibleCandidateIds = [candidateId("3")];
    forgedEligible.contentHash = calculateConstraintDecisionV3ContentHash(forgedEligible);
    expect(() => parseConstraintDecisionV3(forgedEligible)).toThrow(ConstraintParseErrorV3);

    const warning = structuredClone(exact) as any;
    warning.candidates[0].rules[0].sourceStatus = "warning";
    warning.candidates[0].eligible = false;
    warning.eligibleCandidateIds = [];
    warning.contentHash = calculateConstraintDecisionV3ContentHash(warning);
    expect(() => parseConstraintDecisionV3(warning)).toThrow(ConstraintParseErrorV3);

    const warningString = structuredClone(exact);
    warningString.candidates[0]!.sourceWarnings = ["manual-review"];
    warningString.candidates[0]!.eligible = false;
    warningString.eligibleCandidateIds = [];
    warningString.contentHash = calculateConstraintDecisionV3ContentHash(warningString);
    expect(parseConstraintDecisionV3(warningString).candidates[0]!.eligible).toBe(false);
  });

  it("binds the exact decision hash and candidate set", () => {
    const exact = decision();
    expect(() => parseConstraintDecisionV3({ ...exact, eligibleCandidateIds: [] })).toThrow(ConstraintParseErrorV3);
    const rebound = structuredClone(exact);
    rebound.source.candidateIds = [candidateId("4")];
    rebound.contentHash = calculateConstraintDecisionV3ContentHash(rebound);
    expect(() => parseConstraintDecisionV3(rebound)).toThrow(ConstraintParseErrorV3);
  });

  it("parses only the installed production-strict request literal and keeps display units out of identity", () => {
    const migrated = migrateDesignRequestV1ToV2(v1Request, "v2");
    if (migrated.status !== "migrated") throw new Error("migration failed");
    const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = migrated.request.constraints;
    const v3 = parseElectricalDesignRequestV3({ ...migrated.request, schemaVersion: 3, constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3, constraints });
    if (v3.application !== "motor.brushed-dc") throw new Error("Expected Motor V3 request");
    expect(v3.constraintPolicy).toBe(PRODUCTION_STRICT_CONSTRAINT_POLICY_V3);
    expect(canonicalElectricalDesignRequestV3Payload(v3)).toContain('"schemaVersion":3');
    const display = { ...v3, requirements: { ...v3.requirements, continuousCurrent: { ...v3.requirements.continuousCurrent, displayUnit: "mA" } } };
    expect(designRequestHashV3(display)).toBe(designRequestHashV3(v3));
    expect(() => parseElectricalDesignRequestV3({ ...v3, constraintPolicy: "permissive" })).toThrow(ConstraintParseErrorV3);
    expect(() => parseElectricalDesignRequestV3({ ...v3, constraints: { ...v3.constraints, allowUnknownHardConstraints: true } })).toThrow(ConstraintParseErrorV3);
    const projected = projectElectricalDesignRequestV3ToObservationV2(v3);
    expect(projected.constraints).toEqual(expect.objectContaining({ allowUnknownWarnings: true, allowUnknownHardConstraints: true }));
    expect(projectElectricalDesignRequestV3ToObservationV2(v3)).toEqual(projected);
  });
});
