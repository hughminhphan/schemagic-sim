import { describe, expect, it } from "vitest";
import { designRequestHash } from "@opencircuit/design-schema";
import {
  PIPELINE_STAGES,
  canonicalStringify,
  contentHash,
  generateDesign,
  normalizeDesignRequest,
  type DesignLibrary,
  type DesignRecipe,
  type DesignGeneration,
  type RankingCriterion,
} from "../src";
import { createToyPipelineHarness } from "./toy";

function runToyPipeline(): {
  generation: DesignGeneration;
  harness: ReturnType<typeof createToyPipelineHarness>;
} {
  const harness = createToyPipelineHarness();
  return {
    generation: generateDesign(harness.request, harness.context),
    harness,
  };
}

function candidateLabels(generation: DesignGeneration): string[] {
  return generation.candidates.map((candidate) => candidate.circuit.meta.title);
}

function equalKeyMatchHarness(reverse: boolean): ReturnType<typeof createToyPipelineHarness> {
  const harness = createToyPipelineHarness();
  const baseRecipe = harness.context.recipes[0];
  if (!baseRecipe) throw new Error("Toy harness requires one recipe");

  const recipe: DesignRecipe = {
    ...baseRecipe,
    match: (solved, environment) => {
      if (solved.optionKey !== harness.expected.optionKeys.matchRejected) {
        return baseRecipe.match(solved, environment);
      }
      const equalKeyOutcomes = [
        {
          status: "rejected" as const,
          reason: "Equal-key rejection alpha",
          componentProfileIds: ["toy.profile.equal-key-alpha"],
        },
        {
          status: "rejected" as const,
          reason: "Equal-key rejection beta",
          componentProfileIds: ["toy.profile.equal-key-beta"],
        },
      ];
      return reverse ? equalKeyOutcomes.reverse() : equalKeyOutcomes;
    },
  };
  harness.context = { ...harness.context, recipes: [recipe] };
  return harness;
}

describe("generic deterministic design pipeline", () => {
  it("produces byte-stable generations and canonical hashes across repeated runs", () => {
    const first = runToyPipeline();
    const second = runToyPipeline();

    expect(JSON.stringify(first.generation)).toBe(JSON.stringify(second.generation));
    expect(canonicalStringify(first.generation)).toBe(canonicalStringify(second.generation));
    expect(contentHash(first.generation)).toBe(contentHash(second.generation));
    expect(first.generation.requestHash).toBe(designRequestHash(first.generation.request));
    expect(first.generation.requestHash).toBe(designRequestHash(normalizeDesignRequest(first.harness.request)));
    expect(first.generation.libraryContentHash).toBe(first.harness.context.library.contentHash);

    expect(contentHash({ beta: 2, alpha: { delta: 4, gamma: 3 } })).toBe(
      contentHash({ alpha: { gamma: 3, delta: 4 }, beta: 2 }),
    );
  });

  it("canonically orders equal-key match outcomes regardless of recipe return order", () => {
    const forwardHarness = equalKeyMatchHarness(false);
    const reverseHarness = equalKeyMatchHarness(true);
    const forward = generateDesign(forwardHarness.request, forwardHarness.context);
    const reverse = generateDesign(reverseHarness.request, reverseHarness.context);

    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
    const equalKeyRejections = forward.rejections.filter(
      (entry) => entry.optionKey === forwardHarness.expected.optionKeys.matchRejected,
    );
    expect(equalKeyRejections).toHaveLength(2);
    expect(equalKeyRejections.map((entry) => entry.reason).sort()).toEqual([
      "Equal-key rejection alpha",
      "Equal-key rejection beta",
    ]);
  });

  it("gives hooks a detached recursively frozen library snapshot without mutating reusable caller context", () => {
    const harness = createToyPipelineHarness();
    const callerLibrary = harness.context.library;
    const callerLibraryBytes = canonicalStringify(callerLibrary);
    const baseRecipe = harness.context.recipes[0];
    if (!baseRecipe) throw new Error("Toy harness requires one recipe");

    const observations: Array<{
      detached: boolean;
      recursivelyFrozen: boolean;
      mutationErrors: number;
    }> = [];
    const recipe: DesignRecipe = {
      ...baseRecipe,
      enumerate: (environment) => {
        const paretoCriterion = environment.library.paretoCriteria[0];
        const rankingCriteria = environment.library.rankingProfiles.balanced;
        if (!paretoCriterion || !rankingCriteria?.[0]) throw new Error("Toy library requires nested criteria");

        let mutationErrors = 0;
        const mutationAttempts = [
          () => { (environment.library as DesignLibrary).version = "mutated"; },
          () => { (environment.library.paretoCriteria as RankingCriterion[]).push(paretoCriterion); },
          () => { (rankingCriteria as RankingCriterion[]).reverse(); },
          () => { paretoCriterion.direction = paretoCriterion.direction === "minimize" ? "maximize" : "minimize"; },
        ];
        for (const mutate of mutationAttempts) {
          try {
            mutate();
          } catch {
            mutationErrors += 1;
          }
        }

        observations.push({
          detached: environment.library !== callerLibrary,
          recursivelyFrozen: [
            environment.library,
            environment.library.paretoCriteria,
            paretoCriterion,
            environment.library.rankingProfiles,
            rankingCriteria,
            rankingCriteria[0],
          ].every(Object.isFrozen),
          mutationErrors,
        });
        return baseRecipe.enumerate(environment);
      },
    };
    harness.context = { ...harness.context, recipes: [recipe] };

    const first = generateDesign(harness.request, harness.context);
    const second = generateDesign(harness.request, harness.context);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(observations).toEqual([
      { detached: true, recursivelyFrozen: true, mutationErrors: 4 },
      { detached: true, recursivelyFrozen: true, mutationErrors: 4 },
    ]);
    expect(harness.context.library).toBe(callerLibrary);
    expect(canonicalStringify(harness.context.library)).toBe(callerLibraryBytes);
  });

  it("uses fixed pipeline ordering and content-derived IDs as the final tie-break", () => {
    const { generation, harness } = runToyPipeline();

    expect(generation).toEqual(expect.objectContaining({
      format: "schemagic-design-result",
      schemaVersion: 1,
      diagnostics: [],
    }));
    expect(generation.rejectedCandidates).toEqual(generation.rejections.map((entry) => ({
      recipeId: entry.recipeId,
      componentProfileIds: entry.componentProfileIds,
      constraints: entry.constraints,
    })));
    expect(generation.trace.pipeline).toEqual(PIPELINE_STAGES);
    expect(candidateLabels(generation)).toEqual(harness.expected.survivorLabels);
    expect(generation.candidates.map((candidate) => candidate.id)).toEqual(harness.expected.survivorIds);

    const tied = generation.candidates.filter((candidate) => candidate.circuit.meta.title.startsWith("tie-"));
    expect(tied).toHaveLength(2);
    expect(tied.map((candidate) => candidate.id)).toEqual(
      tied.map((candidate) => candidate.id).sort((left, right) => left.localeCompare(right)),
    );
    expect(tied.map((candidate) => candidate.metrics.values)).toSatisfy(([left, right]) =>
      canonicalStringify(left) === canonicalStringify(right),
    );
  });

  it("accepts the exact hard boundary and rejects the value immediately beyond it", () => {
    const { generation, harness } = runToyPipeline();
    const boundary = generation.candidates.find((candidate) => candidate.circuit.meta.title === "boundary-pass");
    const rejection = generation.rejections.find(
      (entry) => entry.stage === "check" && entry.optionKey === harness.expected.optionKeys.overBoundaryFail,
    );

    expect(boundary).toBeDefined();
    expect(boundary?.constraints).toContainEqual(expect.objectContaining({
      ruleId: "toy.maximum",
      status: "pass",
      actual: expect.objectContaining({ value: 10, unit: "A" }),
      limit: expect.objectContaining({ value: 10, unit: "A" }),
      margin: expect.objectContaining({ value: 0, unit: "A" }),
    }));
    expect(rejection).toEqual(expect.objectContaining({
      stage: "check",
      optionKey: harness.expected.optionKeys.overBoundaryFail,
      reason: "Hard electrical constraint failed",
    }));
    expect(rejection?.constraints).toContainEqual(expect.objectContaining({
      ruleId: "toy.maximum",
      status: "fail",
      actual: expect.objectContaining({ value: 11, unit: "A" }),
      limit: expect.objectContaining({ value: 10, unit: "A" }),
      margin: expect.objectContaining({ value: -1, unit: "A" }),
    }));
  });

  it("retains missing evidence as unknown and never promotes it to a pass", () => {
    const { generation, harness } = runToyPipeline();
    const rejection = generation.rejections.find(
      (entry) => entry.stage === "check" && entry.optionKey === harness.expected.optionKeys.missingUnknown,
    );

    expect(candidateLabels(generation)).not.toContain("missing-unknown");
    expect(rejection).toEqual(expect.objectContaining({
      reason: "Unknown constraint evidence is disallowed by the request",
    }));
    expect(rejection?.constraints).toContainEqual(expect.objectContaining({
      ruleId: "toy.missing-fact",
      status: "unknown",
    }));
    expect(rejection?.constraints.some((constraint) => constraint.status === "pass")).toBe(false);
  });

  it("keeps hard failures out of ranking and materialization while retaining their reasons", () => {
    const { generation, harness } = runToyPipeline();
    const hardFailure = generation.rejections.find(
      (entry) => entry.stage === "check" && entry.optionKey === harness.expected.optionKeys.overBoundaryFail,
    );

    expect(hardFailure?.componentProfileIds).toEqual(["toy.profile.fail"]);
    expect(hardFailure?.constraints.some((constraint) => constraint.status === "fail")).toBe(true);
    expect(hardFailure?.reason).not.toHaveLength(0);
    expect(harness.counters.materializedCandidateIds).toEqual(
      generation.candidates.map((candidate) => candidate.id),
    );
    expect(generation.trace.counts.materialized).toBe(generation.candidates.length);
    expect(generation.trace.counts.materialized).toBeLessThan(generation.trace.counts.checked);
    expect(generation.candidates.some((candidate) => candidate.components.some(
      (component) => component.profileId === "toy.profile.fail",
    ))).toBe(false);
  });

  it("deduplicates equivalent BOMs and Pareto-prunes dominated candidates before materialization", () => {
    const { generation, harness } = runToyPipeline();
    const duplicateRejections = generation.rejections.filter((entry) => entry.stage === "dedupe");
    const dominatedRejection = generation.rejections.find(
      (entry) => entry.stage === "pareto" && entry.optionKey === harness.expected.optionKeys.dominated,
    );

    expect(candidateLabels(generation).filter((label) => label === "duplicate")).toHaveLength(1);
    expect(duplicateRejections).toHaveLength(1);
    expect([
      harness.expected.optionKeys.duplicateA,
      harness.expected.optionKeys.duplicateB,
    ]).toContain(duplicateRejections[0]?.optionKey);
    expect(duplicateRejections[0]).toEqual(expect.objectContaining({
      candidateId: expect.stringMatching(/^fnv1a64:[0-9a-f]{16}$/),
      reason: expect.stringMatching(/^Duplicate of fnv1a64:[0-9a-f]{16}$/),
    }));

    expect(candidateLabels(generation)).not.toContain("dominated");
    expect(dominatedRejection).toEqual(expect.objectContaining({
      candidateId: expect.stringMatching(/^fnv1a64:[0-9a-f]{16}$/),
      reason: expect.stringMatching(/^Dominated by fnv1a64:[0-9a-f]{16}$/),
    }));
    expect(generation.trace.counts).toEqual({
      recipes: 1,
      enumerated: 10,
      solved: 9,
      matched: 8,
      checked: 8,
      estimated: 6,
      sourced: 0,
      deduped: 5,
      pareto: 4,
      materialized: 4,
      rejected: 6,
    });
  });

  it("preserves inspectable rejection records from every rejecting stage", () => {
    const { generation, harness } = runToyPipeline();
    const byOption = new Map(generation.rejections.map((entry) => [entry.optionKey, entry]));

    expect(byOption.get(harness.expected.optionKeys.solveRejected)).toEqual(expect.objectContaining({
      stage: "solve",
      reason: "Toy solve rejection",
      componentProfileIds: [],
      constraints: [],
    }));
    expect(byOption.get(harness.expected.optionKeys.matchRejected)).toEqual(expect.objectContaining({
      stage: "match",
      reason: "Toy match rejection",
      componentProfileIds: ["toy.profile.rejected"],
      constraints: [],
    }));
    expect(generation.rejections.every((entry) => entry.reason.length > 0)).toBe(true);
    expect(generation.trace.counts.rejected).toBe(generation.rejections.length);
  });
});
