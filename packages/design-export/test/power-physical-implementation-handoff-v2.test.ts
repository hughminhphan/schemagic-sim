import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import { parseDesignCatalogRelease } from "@opencircuit/design-library";
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
  PowerPhysicalImplementationHandoffErrorV2,
  createPowerPhysicalImplementationHandoffV2,
  exportDesignResultKicadSchematicV2,
  exportFootprintAssignedPowerKicadSchematicV2,
  exportProductionPowerPhysicalHandoffArtifactV2,
  parseDesignResultKicadSchematicV2,
  parsePowerPhysicalImplementationHandoffV2,
  serializePowerPhysicalImplementationHandoffV2,
  verifyPowerPhysicalImplementationHandoffV2,
  type PowerPhysicalImplementationHandoffV2,
  type PowerPhysicalImplementationLineV2,
  type PowerPhysicalSourceEvidenceRefV2,
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

function recomputeSourceReferenceHash(value: PowerPhysicalSourceEvidenceRefV2): void {
  const { referenceContentHash: _hash, ...payload } = value;
  value.referenceContentHash = designSha256ContentHash(canonicalDesignV2Payload(payload));
}

function recomputeLineHash(value: PowerPhysicalImplementationLineV2): void {
  const { contentHash: _hash, ...payload } = value;
  value.contentHash = designSha256ContentHash(canonicalDesignV2Payload(payload));
}

function recomputeHandoffHash(value: PowerPhysicalImplementationHandoffV2): void {
  const { contentHash: _hash, ...payload } = value;
  value.contentHash = designSha256ContentHash(canonicalDesignV2Payload(payload));
}

describe("exact integrated-Power physical implementation handoff V2", () => {
  it("binds the exact current recipe identity and two real output-capacitor instances without physical authority", async () => {
    const { result, candidateId, context } = exactHero();
    const first = createPowerPhysicalImplementationHandoffV2(result, candidateId, context);
    const second = createPowerPhysicalImplementationHandoffV2(result, candidateId, context);
    const parsed = parsePowerPhysicalImplementationHandoffV2(
      serializePowerPhysicalImplementationHandoffV2(first),
    );

    expect(second).toEqual(first);
    expect(parsed).toEqual(first);
    expect(verifyPowerPhysicalImplementationHandoffV2(parsed, result, candidateId, context)).toEqual(first);
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
    expect(first.provenance.designResult).toMatchObject({
      contentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
    });
    expect(first.provenance.engineeringContext).toEqual({
      version: context.manifest.version,
      contentHash: context.manifest.contentHash,
    });
    expect(first.provenance.catalogRelease.contentHash).toBe(
      parseDesignCatalogRelease(context.catalogDocuments.catalogRelease).contentHash,
    );
    expect(first.provenance.candidate).toMatchObject({
      id: candidateId,
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      recipeVersion: "3.4.6",
      recipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
    });
    expect(first.provenance.selectedBom).toMatchObject({
      lineCount: 7,
      physicalInstanceCount: 8,
      contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });

    const output = first.lines.find((line) => line.bomLineId === "output-capacitor")!;
    expect(output.quantityPerAssembly).toBe(2);
    expect(output.selectedPart).toEqual({
      manufacturerId: "murata-manufacturing",
      manufacturerPartNumber: "GRM32ER71E226KE15L",
    });
    expect(output.profile.contentHash).toBe(
      "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
    );
    expect(output.structuralInstances.map((instance) => [instance.componentId, instance.refdes])).toEqual([
      ["output-capacitor-1", "C3"],
      ["output-capacitor-2", "C4"],
    ]);
    expect(output.structuralInstances.every((instance) => (
      instance.footprintMapping.state === "unavailable"
      && instance.footprintMapping.kicadLibraryId === null
      && instance.pins.every((pin) => pin.mappingState === "unavailable" && pin.physicalPinNumber === null)
    ))).toBe(true);

    const candidate = result.candidates[0]!;
    const assembly = candidate.circuit.circuits.find((circuit) => circuit.id === "assembly")!;
    expect(assembly.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "output-capacitor-1", value: 22e-6 }),
      expect.objectContaining({ id: "output-capacitor-2", value: 22e-6 }),
    ]));
    expect(assembly.components.some((component) => (
      component.id === "output-capacitor" || (component.type === "capacitor" && component.value === 44e-6)
    ))).toBe(false);

    const inductor = first.lines.find((line) => line.bomLineId === "power-inductor")!;
    expect(inductor.selectedPart.manufacturerPartNumber).toBe("F1F2-0804-100M");
    expect(inductor.profile.contentHash).toBe(
      "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
    );
    expect(first.lines.every((line) => (
      /^sha256:[0-9a-f]{64}$/u.test(line.bomLineContentHash)
      && /^sha256:[0-9a-f]{64}$/u.test(line.profile.releaseEntryContentHash)
      && /^sha256:[0-9a-f]{64}$/u.test(line.profile.admission.contentHash)
      && line.physicalEvidence.sourceEvidence.every((source) => (
        /^sha256:[0-9a-f]{64}$/u.test(source.contentHash)
        && /^sha256:[0-9a-f]{64}$/u.test(source.referenceContentHash)
      ))
    ))).toBe(true);
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
      "sha256:2009c6b162838424343601bc8d0aa6da7188543f29a8f20b4fe6004b1d55b5d9",
    );

    const priorImmutableRecipeArtifact = structuredClone(first) as PowerPhysicalImplementationHandoffV2;
    priorImmutableRecipeArtifact.provenance.candidate.recipeVersion = "3.4.5";
    priorImmutableRecipeArtifact.provenance.candidate.recipeContentHash =
      "sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee";
    recomputeHandoffHash(priorImmutableRecipeArtifact);
    expect(parsePowerPhysicalImplementationHandoffV2(priorImmutableRecipeArtifact))
      .toEqual(priorImmutableRecipeArtifact);

    const productionArtifact = await exportProductionPowerPhysicalHandoffArtifactV2(
      result,
      candidateId,
      context,
    );
    expect(productionArtifact).toEqual({
      kind: "physical_handoff_json",
      filename: `schemagic-power-buck-${candidateId.slice(-12)}-physical-implementation-handoff-v2.json`,
      mimeType: "application/json;charset=utf-8",
      content: serializePowerPhysicalImplementationHandoffV2(first),
    });
    expect(parsePowerPhysicalImplementationHandoffV2(productionArtifact.content)).toEqual(first);
  }, 15_000);

  it("fails footprint-assigned KiCad emission closed for all eight structural instances", () => {
    const { result, candidateId, context } = exactHero();
    const handoff = createPowerPhysicalImplementationHandoffV2(result, candidateId, context);
    try {
      exportFootprintAssignedPowerKicadSchematicV2(handoff);
    } catch (error) {
      expect(error).toBeInstanceOf(PowerPhysicalImplementationHandoffErrorV2);
      expect((error as PowerPhysicalImplementationHandoffErrorV2).code)
        .toBe("physical_mapping_unavailable");
      expect((error as PowerPhysicalImplementationHandoffErrorV2).diagnostics).toEqual(handoff.diagnostics);
      expect((error as PowerPhysicalImplementationHandoffErrorV2).diagnostics[0]!.affectedStructuralInstanceIds)
        .toEqual(handoff.lines.flatMap((line) => line.structuralInstances.map((instance) => instance.componentId)));
      return;
    }
    throw new Error("Expected footprint-assigned KiCad emission to fail closed");
  }, 15_000);

  it("rejects collapsed quantity, footprint claims, byte drift, unknown candidates, and context drift", () => {
    const { result, candidateId, context } = exactHero();
    const handoff = createPowerPhysicalImplementationHandoffV2(result, candidateId, context);
    const staleHash = structuredClone(handoff) as PowerPhysicalImplementationHandoffV2;
    staleHash.lines[0]!.role = "tampered-role";
    expect(() => parsePowerPhysicalImplementationHandoffV2(staleHash))
      .toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    const collapsed = structuredClone(handoff) as PowerPhysicalImplementationHandoffV2;
    const collapsedOutput = collapsed.lines.find((line) => line.bomLineId === "output-capacitor")!;
    collapsedOutput.quantityPerAssembly = 1;
    collapsedOutput.structuralInstances.pop();
    recomputeLineHash(collapsedOutput);
    recomputeHandoffHash(collapsed);
    expect(() => parsePowerPhysicalImplementationHandoffV2(collapsed))
      .toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    const forgedFootprint = structuredClone(handoff) as PowerPhysicalImplementationHandoffV2;
    const firstInstance = forgedFootprint.lines[0]!.structuralInstances[0]!;
    (firstInstance.footprintMapping as unknown as Record<string, unknown>).state = "available";
    (firstInstance.footprintMapping as unknown as Record<string, unknown>).kicadLibraryId =
      "Capacitor_SMD:C_0603_1608Metric";
    recomputeLineHash(forgedFootprint.lines[0]!);
    recomputeHandoffHash(forgedFootprint);
    expect(() => parsePowerPhysicalImplementationHandoffV2(forgedFootprint))
      .toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    const forgedSource = structuredClone(handoff) as PowerPhysicalImplementationHandoffV2;
    const forgedLine = forgedSource.lines[0]!;
    forgedLine.physicalEvidence.sourceEvidence[0]!.locator =
      "validly rehashed but non-authoritative locator drift";
    recomputeSourceReferenceHash(forgedLine.physicalEvidence.sourceEvidence[0]!);
    forgedLine.physicalEvidence.sourceEvidenceContentHash = designSha256ContentHash(
      canonicalDesignV2Payload(forgedLine.physicalEvidence.sourceEvidence),
    );
    recomputeLineHash(forgedLine);
    recomputeHandoffHash(forgedSource);
    expect(parsePowerPhysicalImplementationHandoffV2(forgedSource).contentHash)
      .toBe(forgedSource.contentHash);
    expect(() => verifyPowerPhysicalImplementationHandoffV2(
      forgedSource,
      result,
      candidateId,
      context,
    )).toThrowError(expect.objectContaining({ code: "invalid_handoff" }));

    expect(() => createPowerPhysicalImplementationHandoffV2(
      result,
      `candidate:v2:sha256:${"9".repeat(64)}`,
      context,
    )).toThrowError(expect.objectContaining({ code: "candidate_not_found" }));

    const recipeDriftContext = {
      ...context,
      manifest: structuredClone(context.manifest),
    } as GenerateElectricalContextV2;
    const exactRecipe = recipeDriftContext.manifest.recipes.find((entry) => (
      entry.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
    ))!;
    (exactRecipe as { contentHash: `sha256:${string}` }).contentHash =
      `sha256:${"1".repeat(64)}`;
    expect(() => createPowerPhysicalImplementationHandoffV2(
      result,
      candidateId,
      recipeDriftContext,
    )).toThrowError(expect.objectContaining({ code: "unsupported_candidate" }));

    const drifted = structuredClone(result);
    drifted.candidates[0]!.warnings.push("physical-handoff-v2-context-drift-fixture");
    drifted.candidates[0]!.warnings.sort();
    const { contentHash: _contentHash, ...payload } = drifted;
    drifted.contentHash = canonicalDesignResultV2ContentHash(payload);
    expect(() => createPowerPhysicalImplementationHandoffV2(drifted, candidateId, context))
      .toThrowError(expect.objectContaining({ code: "engineering_context_unverified" }));
  }, 15_000);

  it("does not mutate result bytes or upgrade the empty-footprint structural KiCad fallback", () => {
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

    createPowerPhysicalImplementationHandoffV2(result, candidateId, context);

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
    expect(structuralAfter).toContain("output-capacitor-1");
    expect(structuralAfter).toContain("output-capacitor-2");
  }, 15_000);
});
