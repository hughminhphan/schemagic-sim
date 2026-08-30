import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  generateElectricalDesignV2,
  getInstalledCompilerImplementationRefV2,
  getInstalledRecipeRefsV2,
  resolveInstalledRecipeRegistryV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine";
import {
  canonicalDesignResultV2ContentHash,
  canonicalDesignV2Payload,
  designSha256ContentHash,
  parseElectricalDesignRequestV2,
  serializeDesignResultV2,
  type BuckDesignRequestV2,
  type DesignResultV2,
  type Quantity,
  type SIUnit,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  PowerPhysicalImplementationHandoffErrorV1,
  createPowerPhysicalImplementationHandoffV1,
  exportFootprintAssignedPowerKicadSchematicV1,
  exportDesignResultKicadSchematicV2,
  parseDesignResultKicadSchematicV2,
  parsePowerPhysicalImplementationHandoffV1,
  serializePowerPhysicalImplementationHandoffV1,
  verifyPowerPhysicalImplementationHandoffV1,
  type PowerPhysicalImplementationHandoffV1,
} from "../src/index";

function quantity<Unit extends SIUnit>(value: number, unit: Unit, displayUnit: string): Quantity<Unit> {
  return { value, unit, displayUnit };
}

function exactPowerContext(): GenerateElectricalContextV2 {
  const documents = getBundledReviewedReleaseDocuments();
  const catalog = buildReviewedProfileCatalogV2(documents);
  const area = { source: "metric", metricId: "power.native.board-area", direction: "minimize" } as const;
  const count = { source: "metric", metricId: "power.native.component-count", direction: "minimize" } as const;
  const rankingPayload: Omit<ElectricalRankingPolicyV2, "contentHash"> = {
    format: "schemagic-electrical-ranking-policy",
    schemaVersion: 2,
    version: "power-native-ranking-v2.1",
    application: "power.buck",
    paretoCriteria: [area, count],
    rankingProfiles: {
      area: [area, count],
      balanced: [area, count],
      efficiency: [area, count],
      temperature: [area, count],
    },
  };
  const rankingPolicy = {
    ...rankingPayload,
    contentHash: calculateElectricalRankingPolicyV2ContentHash(rankingPayload),
  };
  const manifestPayload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
    format: "schemagic-electrical-design-context",
    schemaVersion: 2,
    version: catalog.version,
    application: "power.buck",
    compiler: getInstalledCompilerImplementationRefV2(),
    catalog: {
      version: catalog.version,
      contentHash: catalog.contentHash,
      sourceReleaseContentHash: catalog.sourceRelease.contentHash,
    },
    rankingPolicy: { version: rankingPolicy.version, contentHash: rankingPolicy.contentHash },
    recipes: [...getInstalledRecipeRefsV2("power.buck")],
  };
  const manifest = {
    ...manifestPayload,
    contentHash: calculateElectricalDesignContextManifestV2ContentHash(manifestPayload),
  };
  const installedRecipeRegistry = resolveInstalledRecipeRegistryV2(manifest);
  if (installedRecipeRegistry === undefined) throw new Error("Installed Power recipe registry unavailable");
  return { manifest, catalogDocuments: documents, rankingPolicy, installedRecipeRegistry };
}

function exactHeroRequest(libraryVersion: string): BuckDesignRequestV2 {
  const request = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: quantity(12, "V", "V"),
        nominal: quantity(12, "V", "V"),
        maximum: quantity(12, "V", "V"),
      },
      outputVoltage: quantity(5, "V", "V"),
      dcOutputVoltageRegulation: {
        minimum: quantity(4.7, "V", "V"),
        maximum: quantity(5.3, "V", "V"),
      },
      maximumOutputCurrent: quantity(0.2, "A", "A"),
      ambientTemperature: quantity(298.15, "K", "°C"),
      switchingFrequency: {
        selection: "automatic",
        minimum: quantity(250_000, "Hz", "kHz"),
        preferred: null,
        maximum: quantity(600_000, "Hz", "kHz"),
      },
      maximumOutputRipple: quantity(0.03, "V", "mV"),
      loadTransientTarget: null,
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
      maximumJunctionTemperature: quantity(398.15, "K", "°C"),
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: true,
    },
    assumptions: [
      {
        id: "power-browser.exact-vfb-condition",
        description: "The input is fixed at the exact 12 V condition of the reviewed TPS54302 feedback-reference production spread, and the request explicitly accepts a 4.7 V to 5.3 V DC regulation envelope.",
        source: "fixture",
        affects: ["requirements.dcOutputVoltageRegulation", "requirements.inputVoltage", "power.feedback.output-voltage"],
      },
      {
        id: "power-browser.unknown-inspection-opt-in",
        description: "Loop stability, passive effective values, current capability, timing, loss, and thermal proofs remain unknown unless explicitly inspected.",
        source: "user",
        affects: ["constraints.allowUnknownHardConstraints", "ranking"],
      },
      {
        id: "power-browser.no-selected-part-model",
        description: "No executable model is bundled for the exact selected regulator or passive stage; selected-part simulation fidelity is unavailable.",
        source: "unavailable",
        affects: ["simulation"],
      },
    ],
    libraryVersion,
  });
  if (request.application !== "power.buck") throw new Error("Expected exact Power request");
  return request;
}

type ExactHeroFixture = {
  result: DesignResultV2;
  candidateId: DesignResultV2["candidates"][number]["id"];
  context: GenerateElectricalContextV2;
};

let exactHeroFixture: ExactHeroFixture | undefined;

function exactHero(): ExactHeroFixture {
  if (exactHeroFixture !== undefined) return exactHeroFixture;
  const context = exactPowerContext();
  const generation = generateElectricalDesignV2(exactHeroRequest(context.manifest.version), context);
  const candidate = generation.result.candidates[0];
  if (candidate === undefined || generation.result.candidates.length !== 1) {
    throw new Error("Expected one exact integrated-Power hero observation");
  }
  exactHeroFixture = { result: generation.result, candidateId: candidate.id, context };
  return exactHeroFixture;
}

function recomputeHandoffHash(value: PowerPhysicalImplementationHandoffV1): void {
  const { contentHash: _contentHash, ...payload } = value;
  value.contentHash = designSha256ContentHash(canonicalDesignV2Payload(payload));
}

const frozenV1Installed = getInstalledRecipeRefsV2("power.buck").some((recipe) => (
  recipe.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
  && recipe.version === "3.4.4"
));

describe("frozen integrated-Power physical implementation handoff V1 successor boundary", () => {
  it("keeps the immutable quantity-one V1 implementation byte-for-byte frozen", () => {
    const source = readFileSync(new URL(
      "../src/power-physical-implementation-handoff-v1.ts",
      import.meta.url,
    ));
    expect(createHash("sha256").update(source).digest("hex"))
      .toBe("49bc49977dc05f03ba4efe44b5ef1a1bca1f3010485be1fd567ec2f470d84dcc");
  });

  it("rejects the installed quantity-two 3.4.6 successor instead of silently reinterpreting V1", () => {
    const { result, candidateId, context } = exactHero();
    expect(context.manifest.recipes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
        version: "3.4.6",
      }),
    ]));
    expect(result.candidates[0]!.components.find((entry) => entry.id === "output-capacitor"))
      .toMatchObject({ quantityPerAssembly: 2 });
    expect(() => createPowerPhysicalImplementationHandoffV1(result, candidateId, context))
      .toThrowError(expect.objectContaining({ code: "unsupported_candidate" }));
  }, 15_000);
});

describe.runIf(frozenV1Installed)("exact integrated-Power physical implementation handoff V1", () => {
  it("binds exact result, recipe, profile, source, symbol, pin, and net identities without a physical claim", () => {
    const { result, candidateId, context } = exactHero();
    const first = createPowerPhysicalImplementationHandoffV1(result, candidateId, context);
    const second = createPowerPhysicalImplementationHandoffV1(result, candidateId, context);
    const parsed = parsePowerPhysicalImplementationHandoffV1(
      serializePowerPhysicalImplementationHandoffV1(first),
    );

    expect(second).toEqual(first);
    expect(parsed).toEqual(first);
    expect(verifyPowerPhysicalImplementationHandoffV1(
      parsed,
      result,
      candidateId,
      context,
    )).toEqual(first);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.lines)).toBe(true);
    expect(first.scope).toEqual({
      application: "power.buck",
      candidateKind: "integrated_synchronous_buck_exact_bom_observation",
      attestation: "none",
      physicalFidelityClaim: "none",
      candidateEligibilityAuthority: "none",
      simulationFidelityClaim: "none",
      behavioralAndElectricalArtifacts: "unchanged",
      manufacturingOutputClaim: "none",
    });
    expect(first.provenance).toMatchObject({
      designResult: {
        contentHash: "sha256:a7aec2124975f7e3afa77b2e192b211255c0ecc9783f1fe07aa9b5f9e4b02a84",
        requestHash: result.requestHash,
        libraryContentHash: result.libraryContentHash,
      },
      engineeringContext: {
        contentHash: "sha256:1e2c4ebf7c8186d4546c5ea209f8694c84b9880a1bf626ea7c7ce013d626d807",
      },
      candidate: {
        id: candidateId,
        recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
        recipeVersion: "3.4.4",
        recipeContentHash: "sha256:e39f5e67c0fd52d44170f0222455eade876385ba0771d6e78c420d02aa60999c",
      },
      circuit: { id: "assembly", contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u) },
    });
    expect(first.lines.map((line) => [line.bomLineId, line.refdes])).toEqual([
      ["bootstrap-capacitor", "C1"],
      ["feedback-lower", "R1"],
      ["feedback-upper", "R2"],
      ["input-capacitor", "C2"],
      ["output-capacitor", "C3"],
      ["power-inductor", "L1"],
      ["primary", "U1"],
    ]);
    expect(first.lines.every((line) => line.profile.review.state === "reviewed")).toBe(true);
    expect(first.lines.every((line) => line.profile.review.ownerTrack !== line.profile.review.reviewerTrack)).toBe(true);
    expect(first.lines.every((line) => line.physicalEvidence.sourceEvidence.length > 0)).toBe(true);
    expect(first.lines.every((line) => line.structuralInstance.pins.every((pin) => (
      pin.mappingState === "unavailable" && pin.physicalPinNumber === null && pin.netId.startsWith("POWER_NET_")
    )))).toBe(true);
    expect(first.lines.every((line) => line.footprintMapping.state === "unavailable"
      && line.footprintMapping.kicadLibraryId === null)).toBe(true);

    const regulator = first.lines.find((line) => line.bomLineId === "primary")!;
    expect(regulator.selectedPart).toEqual({
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "TPS54302DDCR",
    });
    expect(regulator.profile.contentHash).toBe(
      "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
    );
    expect(regulator.physicalEvidence.packageIdentity.name).toBe("SOT-23-THIN (DDC), 6-pin");
    expect(regulator.structuralInstance.pins).toHaveLength(5);
    expect(regulator.diagnostics.map((entry) => entry.code)).toEqual([
      "kicad_footprint_identity_unavailable",
      "physical_pin_mapping_unavailable",
      "structural_symbol_not_package_complete",
    ]);
    const inductor = first.lines.find((line) => line.bomLineId === "power-inductor")!;
    expect(inductor.selectedPart.manufacturerPartNumber).toBe("F1F2-0804-2R2M");
    expect(inductor.profile.contentHash).toBe(
      "sha256:6eb4c18bb984319a5fa56d615f571c03e4fa7670e2782ff4754dbba13dbc89b6",
    );
    expect(inductor.physicalEvidence.mountedGeometry).toMatchObject({
      boardArea: { state: "calculated", squareMetres: 0.00004028 },
      maximumHeight: { state: "reviewed", metres: 0.004 },
      claimBoundary: "package_or_land_pattern_envelope_only_not_footprint_identity",
    });
    const feedbackLower = first.lines.find((line) => line.bomLineId === "feedback-lower")!;
    expect(feedbackLower.selectedPart).toEqual({
      manufacturerId: "bourns",
      manufacturerPartNumber: "CR0603-FX-1003ELF",
    });
    expect(feedbackLower.profile.contentHash).toBe(
      "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6",
    );
    expect(first.implementation).toEqual({
      state: "unavailable",
      footprintAssignedKicadSchematic: { state: "not_emitted", contentHash: null },
      placement: {
        state: "not_emitted",
        routing: "unrouted",
        verification: "unverified",
        contentHash: null,
      },
    });
    expect(first.contentHash).toBe(
      "sha256:dc8671f69b6588e6d11fd65fa9b954951ccc0dc28d208a6e3c877e8cbf24e068",
    );
  }, 15_000);

  it("fails footprint-assigned KiCad emission closed with exact per-line diagnostics", () => {
    const { result, candidateId, context } = exactHero();
    const handoff = createPowerPhysicalImplementationHandoffV1(result, candidateId, context);
    try {
      exportFootprintAssignedPowerKicadSchematicV1(handoff);
    } catch (error) {
      expect(error).toBeInstanceOf(PowerPhysicalImplementationHandoffErrorV1);
      expect((error as PowerPhysicalImplementationHandoffErrorV1).code)
        .toBe("physical_mapping_unavailable");
      expect((error as PowerPhysicalImplementationHandoffErrorV1).diagnostics).toEqual(handoff.diagnostics);
      expect((error as PowerPhysicalImplementationHandoffErrorV1).diagnostics[0]!.affectedBomLineIds)
        .toEqual(handoff.lines.map((line) => line.bomLineId));
      return;
    }
    throw new Error("Expected footprint-assigned KiCad emission to fail closed");
  }, 15_000);

  it("rejects byte drift, recomputed invariant violations, unknown candidates, and context drift", () => {
    const { result, candidateId, context } = exactHero();
    const handoff = createPowerPhysicalImplementationHandoffV1(result, candidateId, context);
    const staleHash = structuredClone(handoff) as PowerPhysicalImplementationHandoffV1;
    staleHash.lines[0]!.role = "tampered-role";
    expect(() => parsePowerPhysicalImplementationHandoffV1(staleHash))
      .toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    const forgedFootprint = structuredClone(handoff) as unknown as PowerPhysicalImplementationHandoffV1;
    (forgedFootprint.lines[0]!.footprintMapping as unknown as Record<string, unknown>).state = "available";
    (forgedFootprint.lines[0]!.footprintMapping as unknown as Record<string, unknown>).kicadLibraryId = "Capacitor_SMD:C_0603_1608Metric";
    recomputeHandoffHash(forgedFootprint);
    expect(() => parsePowerPhysicalImplementationHandoffV1(forgedFootprint))
      .toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    const forgedSource = structuredClone(handoff) as PowerPhysicalImplementationHandoffV1;
    forgedSource.lines[0]!.physicalEvidence.sourceEvidence[0]!.locator =
      "validly rehashed but non-authoritative locator drift";
    recomputeHandoffHash(forgedSource);
    expect(parsePowerPhysicalImplementationHandoffV1(forgedSource).contentHash)
      .toBe(forgedSource.contentHash);
    expect(() => verifyPowerPhysicalImplementationHandoffV1(
      forgedSource,
      result,
      candidateId,
      context,
    )).toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    expect(() => createPowerPhysicalImplementationHandoffV1(
      result,
      `candidate:v2:sha256:${"9".repeat(64)}`,
      context,
    )).toThrowError(expect.objectContaining({ code: "candidate_not_found" }));

    const drifted = structuredClone(result);
    drifted.candidates[0]!.warnings.push("physical-handoff-context-drift-fixture");
    drifted.candidates[0]!.warnings.sort();
    const { contentHash: _contentHash, ...payload } = drifted;
    drifted.contentHash = canonicalDesignResultV2ContentHash(payload);
    expect(() => createPowerPhysicalImplementationHandoffV1(drifted, candidateId, context))
      .toThrowError(expect.objectContaining({ code: "engineering_context_unverified" }));
  }, 15_000);

  it("does not mutate electrical result bytes or the externally QA-able structural KiCad fallback", () => {
    const { result, candidateId, context } = exactHero();
    const options = { engineeringContext: context, executionContext: {} } as const;
    const resultBefore = serializeDesignResultV2(result);
    const structuralBefore = exportDesignResultKicadSchematicV2(
      result,
      candidateId,
      "assembly",
      options,
    );
    const parsedBefore = parseDesignResultKicadSchematicV2(structuralBefore, result, options);

    createPowerPhysicalImplementationHandoffV1(result, candidateId, context);

    expect(serializeDesignResultV2(result)).toBe(resultBefore);
    const structuralAfter = exportDesignResultKicadSchematicV2(
      result,
      candidateId,
      "assembly",
      options,
    );
    expect(structuralAfter).toBe(structuralBefore);
    expect(parseDesignResultKicadSchematicV2(structuralAfter, result, options)).toEqual(parsedBefore);
    expect(structuralAfter).toContain("Footprint mapping unavailable");
    expect(structuralAfter).toContain('property "Footprint" ""');
    expect(structuralAfter).not.toContain("Capacitor_SMD:");
  }, 15_000);
});
