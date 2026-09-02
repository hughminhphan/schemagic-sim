import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  migrateDesignRequestV1ToV2,
  parseElectricalDesignRequestV3,
  type BrushedDcMotorDesignRequest,
  type BrushedDcMotorDesignRequestV3,
  type BuckDesignRequest,
  type BuckDesignRequestV3,
} from "@opencircuit/design-schema";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "@opencircuit/motor-designer/fixtures";
import { getMotorDesignContextManifestV2 } from "@opencircuit/motor-designer/v2";
import { generateMotorConstraintObservationV3 } from "@opencircuit/motor-designer/v3";
import { createP1CompactRequest } from "@opencircuit/power-designer/fixtures";
import { getPowerDesignContextManifestV2 } from "@opencircuit/power-designer/v2";
import { generateBuckConstraintObservationV3 } from "@opencircuit/power-designer/v3";

/**
 * A committed record of what every constraint rule currently decides, per
 * fixture. It exists so the release audit can assert a *property* ("no rule got
 * worse") instead of pinning result hashes: adding a reviewed profile, a
 * recipe, or a candidate is allowed to change identities, and is not allowed to
 * turn a passing rule into an unknown or a failure.
 */
export const DESIGNER_RULE_DISPOSITION_BASELINE_FORMAT_V1 = "schemagic-designer-rule-disposition-baseline" as const;

export type RuleSourceStatusV1 = "pass" | "fail" | "unknown" | "inapplicable";
export type RuleDispositionV1 = "satisfied" | "blocked_failure" | "blocked_unknown" | "inspectable_unknown";

export interface RuleDispositionEntryV1 {
  ruleId: string;
  sourceStatus: RuleSourceStatusV1;
  disposition: RuleDispositionV1;
}

export interface CandidateRuleDispositionsV1 {
  /** `<recipeId>#<ordinal>`: stable across runs without pinning a candidate hash. */
  candidateKey: string;
  recipeId: string;
  eligible: boolean;
  rules: RuleDispositionEntryV1[];
}

export interface ConstraintStatusEntryV1 {
  ruleId: string;
  status: string;
}

export interface FixtureRuleDispositionsV1 {
  fixtureId: string;
  application: "motor.brushed-dc" | "power.buck";
  contextVersion: string;
  candidateCount: number;
  eligibleCandidateCount: number;
  /** Per-candidate policy dispositions, keyed by recipe so candidate ids may change. */
  candidates: CandidateRuleDispositionsV1[];
  /** The retained observation's own constraint statuses, deduplicated by rule. */
  constraints: ConstraintStatusEntryV1[];
  constraintStatusCounts: Record<string, number>;
  dispositionCounts: Record<string, number>;
}

export interface DesignerRuleDispositionBaselineV1 {
  format: typeof DESIGNER_RULE_DISPOSITION_BASELINE_FORMAT_V1;
  schemaVersion: 1;
  /** Identities the baseline was generated against; a change makes it stale. */
  generatedAgainst: {
    motorContextVersion: string;
    powerContextVersion: string;
    motorRecipeIds: string[];
    powerRecipeIds: string[];
  };
  fixtures: FixtureRuleDispositionsV1[];
  contentHash: `sha256:${string}`;
}

export interface RuleDispositionRegressionV1 {
  fixtureId: string;
  recipeId: string;
  ruleId: string;
  from: string;
  to: string;
  kind: "disposition_regression" | "source_status_regression" | "rule_removed" | "eligibility_regression";
}

export interface RuleDispositionAssessmentV1 {
  stale: boolean;
  staleReasons: string[];
  regressions: RuleDispositionRegressionV1[];
  improvements: RuleDispositionRegressionV1[];
  addedRules: Array<{ fixtureId: string; recipeId: string; ruleId: string }>;
}

const SOURCE_STATUS_RANK: Readonly<Record<string, number>> = Object.freeze({
  pass: 3,
  inapplicable: 2,
  unknown: 1,
  fail: 0,
});

const DISPOSITION_RANK: Readonly<Record<string, number>> = Object.freeze({
  satisfied: 3,
  inspectable_unknown: 2,
  blocked_unknown: 1,
  blocked_failure: 0,
});

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

export function calculateRuleDispositionBaselineContentHashV1(
  payload: Omit<DesignerRuleDispositionBaselineV1, "contentHash">,
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex")}`;
}

function counted(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values.slice().sort()) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function motorRequestV3(source: BrushedDcMotorDesignRequest): BrushedDcMotorDesignRequestV3 {
  const migrated = migrateDesignRequestV1ToV2(source, getMotorDesignContextManifestV2().version);
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") {
    throw new TypeError("rule_disposition_baseline:motor_request_not_migrated");
  }
  const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = migrated.request.constraints;
  const parsed = parseElectricalDesignRequestV3({
    ...migrated.request,
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    constraints,
  });
  if (parsed.application !== "motor.brushed-dc") throw new TypeError("rule_disposition_baseline:motor_request_invalid");
  return parsed;
}

/**
 * The exact browser-preset P1 compact request: 12 V in, 0.2 A out, 25 C, a
 * 250-600 kHz switching window, and a declared 4.7-5.3 V DC regulation
 * envelope. This is the request that retains one exact-BOM Power observation,
 * so it is the one whose rule dispositions are worth baselining.
 */
function powerBrowserPresetRequest(): BuckDesignRequest {
  const request = createP1CompactRequest();
  request.requirements.inputVoltage.minimum.value = 12;
  request.requirements.inputVoltage.maximum.value = 12;
  request.requirements.maximumOutputCurrent.value = 0.2;
  request.requirements.ambientTemperature.value = 298.15;
  request.requirements.switchingFrequency.minimum.value = 250_000;
  request.requirements.switchingFrequency.maximum.value = 600_000;
  request.requirements.dcOutputVoltageRegulation = {
    minimum: { value: 4.7, unit: "V", displayUnit: "V" },
    maximum: { value: 5.3, unit: "V", displayUnit: "V" },
  };
  return request;
}

function powerRequestV3(source: BuckDesignRequest): BuckDesignRequestV3 {
  const migrated = migrateDesignRequestV1ToV2(source, getPowerDesignContextManifestV2().version);
  if (migrated.status !== "migrated" || migrated.request.application !== "power.buck") {
    throw new TypeError("rule_disposition_baseline:power_request_not_migrated");
  }
  const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = migrated.request.constraints;
  const parsed = parseElectricalDesignRequestV3({
    ...migrated.request,
    schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    constraints,
  });
  if (parsed.application !== "power.buck") throw new TypeError("rule_disposition_baseline:power_request_invalid");
  return parsed;
}

function fixtureFrom(
  fixtureId: string,
  application: "motor.brushed-dc" | "power.buck",
  contextVersion: string,
  generation: {
    observation: { result: { candidates: readonly { constraints: readonly { ruleId: string; status: string }[] }[] } };
    decision: {
      eligibleCandidateIds: readonly string[];
      candidates: readonly {
        recipeId: string;
        eligible: boolean;
        rules: readonly { ruleId: string; sourceStatus: string; disposition: string }[];
      }[];
    };
  },
): FixtureRuleDispositionsV1 {
  const ordinals = new Map<string, number>();
  const candidates = generation.decision.candidates
    .map((candidate) => {
      const ordinal = ordinals.get(candidate.recipeId) ?? 0;
      ordinals.set(candidate.recipeId, ordinal + 1);
      return {
        candidateKey: `${candidate.recipeId}#${ordinal}`,
        recipeId: candidate.recipeId,
        eligible: candidate.eligible,
        rules: candidate.rules
          .map((rule) => ({
            ruleId: rule.ruleId,
            sourceStatus: rule.sourceStatus as RuleSourceStatusV1,
            disposition: rule.disposition as RuleDispositionV1,
          }))
          .sort((left, right) => left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0),
      };
    })
    .sort((left, right) => left.candidateKey < right.candidateKey ? -1 : left.candidateKey > right.candidateKey ? 1 : 0);

  const byRule = new Map<string, string>();
  for (const candidate of generation.observation.result.candidates) {
    for (const constraint of candidate.constraints) {
      const existing = byRule.get(constraint.ruleId);
      // Keep the weakest observed status so the baseline never records an
      // optimistic reading of a rule that differs across candidates.
      if (existing === undefined || (SOURCE_STATUS_RANK[constraint.status] ?? 0) < (SOURCE_STATUS_RANK[existing] ?? 0)) {
        byRule.set(constraint.ruleId, constraint.status);
      }
    }
  }
  const constraints = [...byRule.entries()]
    .map(([ruleId, status]) => ({ ruleId, status }))
    .sort((left, right) => left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0);

  return {
    fixtureId,
    application,
    contextVersion,
    candidateCount: generation.decision.candidates.length,
    eligibleCandidateCount: generation.decision.eligibleCandidateIds.length,
    candidates,
    constraints,
    constraintStatusCounts: counted(constraints.map((entry) => entry.status)),
    dispositionCounts: counted(candidates.flatMap((candidate) => candidate.rules.map((rule) => rule.disposition))),
  };
}

/** Regenerates the current dispositions from the checked-in fixtures and catalog. */
export function collectDesignerRuleDispositionsV1(): Omit<DesignerRuleDispositionBaselineV1, "contentHash"> {
  const motorContextVersion = getMotorDesignContextManifestV2().version;
  const powerContextVersion = getPowerDesignContextManifestV2().version;
  const fixtures = [
    fixtureFrom(
      "motor.m1-compact",
      "motor.brushed-dc",
      motorContextVersion,
      generateMotorConstraintObservationV3(motorRequestV3(M1_COMPACT_REQUEST)) as never,
    ),
    fixtureFrom(
      "motor.m2-power",
      "motor.brushed-dc",
      motorContextVersion,
      generateMotorConstraintObservationV3(motorRequestV3(M2_POWER_REQUEST)) as never,
    ),
    fixtureFrom(
      "power.p1-compact-browser-preset",
      "power.buck",
      powerContextVersion,
      generateBuckConstraintObservationV3(powerRequestV3(powerBrowserPresetRequest())) as never,
    ),
  ].sort((left, right) => left.fixtureId < right.fixtureId ? -1 : 1);

  const recipeIds = (application: string) => [...new Set(fixtures
    .filter((fixture) => fixture.application === application)
    .flatMap((fixture) => fixture.candidates.map((candidate) => candidate.recipeId)))].sort();

  return {
    format: DESIGNER_RULE_DISPOSITION_BASELINE_FORMAT_V1,
    schemaVersion: 1,
    generatedAgainst: {
      motorContextVersion,
      powerContextVersion,
      motorRecipeIds: recipeIds("motor.brushed-dc"),
      powerRecipeIds: recipeIds("power.buck"),
    },
    fixtures,
  };
}

export function buildDesignerRuleDispositionBaselineV1(): DesignerRuleDispositionBaselineV1 {
  const payload = collectDesignerRuleDispositionsV1();
  return { ...payload, contentHash: calculateRuleDispositionBaselineContentHashV1(payload) };
}

const here = dirname(fileURLToPath(import.meta.url));

export const DESIGNER_RULE_DISPOSITION_BASELINE_PATH_V1 = `${here}/../rule-disposition-baseline.json`;

export function loadDesignerRuleDispositionBaselineV1(): DesignerRuleDispositionBaselineV1 | null {
  if (!existsSync(DESIGNER_RULE_DISPOSITION_BASELINE_PATH_V1)) return null;
  const parsed = JSON.parse(readFileSync(DESIGNER_RULE_DISPOSITION_BASELINE_PATH_V1, "utf8")) as DesignerRuleDispositionBaselineV1;
  return parsed.format === DESIGNER_RULE_DISPOSITION_BASELINE_FORMAT_V1 && parsed.schemaVersion === 1 ? parsed : null;
}

/**
 * Compares regenerated dispositions against the committed baseline. Only
 * *worsening* counts as a regression; new rules and improved dispositions are
 * reported separately so a reviewer can refresh the baseline deliberately.
 */
export function assessDesignerRuleDispositionsV1(
  current: Omit<DesignerRuleDispositionBaselineV1, "contentHash">,
  baseline: DesignerRuleDispositionBaselineV1 | null,
): RuleDispositionAssessmentV1 {
  if (!baseline) {
    return { stale: true, staleReasons: ["baseline_missing"], regressions: [], improvements: [], addedRules: [] };
  }
  const staleReasons: string[] = [];
  const expectedHash = calculateRuleDispositionBaselineContentHashV1({
    format: baseline.format,
    schemaVersion: baseline.schemaVersion,
    generatedAgainst: baseline.generatedAgainst,
    fixtures: baseline.fixtures,
  });
  if (expectedHash !== baseline.contentHash) staleReasons.push("baseline_self_hash_mismatch");
  if (baseline.generatedAgainst.motorContextVersion !== current.generatedAgainst.motorContextVersion) {
    staleReasons.push(`motor_context_version:${baseline.generatedAgainst.motorContextVersion}->${current.generatedAgainst.motorContextVersion}`);
  }
  if (baseline.generatedAgainst.powerContextVersion !== current.generatedAgainst.powerContextVersion) {
    staleReasons.push(`power_context_version:${baseline.generatedAgainst.powerContextVersion}->${current.generatedAgainst.powerContextVersion}`);
  }

  const regressions: RuleDispositionRegressionV1[] = [];
  const improvements: RuleDispositionRegressionV1[] = [];
  const addedRules: Array<{ fixtureId: string; recipeId: string; ruleId: string }> = [];

  for (const baseFixture of baseline.fixtures) {
    const currentFixture = current.fixtures.find((entry) => entry.fixtureId === baseFixture.fixtureId);
    if (!currentFixture) {
      staleReasons.push(`fixture_missing:${baseFixture.fixtureId}`);
      continue;
    }
    if (currentFixture.eligibleCandidateCount < baseFixture.eligibleCandidateCount) {
      regressions.push({
        fixtureId: baseFixture.fixtureId,
        recipeId: "",
        ruleId: "",
        from: String(baseFixture.eligibleCandidateCount),
        to: String(currentFixture.eligibleCandidateCount),
        kind: "eligibility_regression",
      });
    }
    for (const baseCandidate of baseFixture.candidates) {
      const currentCandidate = currentFixture.candidates.find((entry) => entry.candidateKey === baseCandidate.candidateKey);
      if (!currentCandidate) {
        staleReasons.push(`candidate_missing:${baseFixture.fixtureId}:${baseCandidate.candidateKey}`);
        continue;
      }
      for (const baseRule of baseCandidate.rules) {
        const currentRule = currentCandidate.rules.find((entry) => entry.ruleId === baseRule.ruleId);
        if (!currentRule) {
          regressions.push({
            fixtureId: baseFixture.fixtureId,
            recipeId: baseCandidate.recipeId,
            ruleId: baseRule.ruleId,
            from: baseRule.disposition,
            to: "absent",
            kind: "rule_removed",
          });
          continue;
        }
        const baseDisposition = DISPOSITION_RANK[baseRule.disposition] ?? 0;
        const currentDisposition = DISPOSITION_RANK[currentRule.disposition] ?? 0;
        if (currentDisposition < baseDisposition) {
          regressions.push({
            fixtureId: baseFixture.fixtureId,
            recipeId: baseCandidate.recipeId,
            ruleId: baseRule.ruleId,
            from: baseRule.disposition,
            to: currentRule.disposition,
            kind: "disposition_regression",
          });
        } else if (currentDisposition > baseDisposition) {
          improvements.push({
            fixtureId: baseFixture.fixtureId,
            recipeId: baseCandidate.recipeId,
            ruleId: baseRule.ruleId,
            from: baseRule.disposition,
            to: currentRule.disposition,
            kind: "disposition_regression",
          });
        }
        const baseSource = SOURCE_STATUS_RANK[baseRule.sourceStatus] ?? 0;
        const currentSource = SOURCE_STATUS_RANK[currentRule.sourceStatus] ?? 0;
        if (currentSource < baseSource) {
          regressions.push({
            fixtureId: baseFixture.fixtureId,
            recipeId: baseCandidate.recipeId,
            ruleId: baseRule.ruleId,
            from: baseRule.sourceStatus,
            to: currentRule.sourceStatus,
            kind: "source_status_regression",
          });
        }
      }
      for (const currentRule of currentCandidate.rules) {
        if (!baseCandidate.rules.some((entry) => entry.ruleId === currentRule.ruleId)) {
          addedRules.push({ fixtureId: baseFixture.fixtureId, recipeId: baseCandidate.recipeId, ruleId: currentRule.ruleId });
        }
      }
    }
  }

  return { stale: staleReasons.length > 0, staleReasons: staleReasons.sort(), regressions, improvements, addedRules };
}
