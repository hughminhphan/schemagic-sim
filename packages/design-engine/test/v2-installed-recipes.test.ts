import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  admissionContentHash,
  designCatalogContentHash,
  designProfileContentHash,
  designProfileId,
  designProfilePath,
  getBundledDesignLibraryDocuments,
  type DesignLibraryDocuments,
  type DesignProfileV1,
} from "@opencircuit/design-library";
import { createSyntheticReviewedLibraryFixture } from "@opencircuit/design-library/fixtures";
import { createInstalledNativeRecipeSets } from "@opencircuit/design-recipes/engine-internal";
import { canonicalDesignResultV2ContentHash, migrateDesignRequestV1ToV2, parseDesignResultV2, serializeDesignResultV2, type ElectricalDesignRequestV2 } from "@opencircuit/design-schema";
import * as designEnginePublic from "../src";
import {
  DesignGenerationErrorV2,
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  generateElectricalDesignV2,
  getInstalledCompilerImplementationRefV2,
  getInstalledRecipeRefsV2,
  parseDesignExecutionReportV2,
  renderGenerationRejectionMessageV2,
  resolveInstalledRecipeRegistryV2,
  validateDesignExecutionReportContextV2,
  validateDesignResultEngineeringContextV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type GenerateElectricalContextV2,
} from "../src";

function refreshedDocuments(classes: Parameters<typeof createSyntheticReviewedLibraryFixture>[0], changes: Record<string, Record<string, number>>): DesignLibraryDocuments {
  const documents = structuredClone(createSyntheticReviewedLibraryFixture(classes)) as any;
  for (const profile of Object.values(documents.profiles) as DesignProfileV1[]) {
    const updates = changes[profile.partClass] ?? {};
    for (const [factId, value] of Object.entries(updates)) (profile.facts as any)[factId].value.value = value;
  }
  for (const entry of documents.admission.entries) {
    const profile = documents.profiles[entry.profilePath] as DesignProfileV1;
    entry.profileContentHash = designProfileContentHash(profile);
  }
  documents.catalogRelease.admissionContentHash = admissionContentHash(documents.admission);
  for (const ref of documents.catalogRelease.profiles) {
    const profile = Object.values(documents.profiles).find((entry: any) => designProfileId(entry.partClass, entry.part) === ref.profileId) as DesignProfileV1;
    ref.profileContentHash = designProfileContentHash(profile);
  }
  documents.catalogRelease.contentHash = designCatalogContentHash(documents.manufacturerRegistry, documents.admission, Object.values(documents.profiles) as DesignProfileV1[]);
  return documents;
}

function rewriteProfileMpn(source: DesignLibraryDocuments, partClass: DesignProfileV1["partClass"], manufacturerPartNumber: string): DesignLibraryDocuments {
  const documents = structuredClone(source) as any;
  const oldPath = Object.keys(documents.profiles).find((path) => documents.profiles[path].partClass === partClass);
  if (!oldPath) throw new Error(`Missing profile ${partClass}`);
  const profile = documents.profiles[oldPath] as DesignProfileV1;
  profile.part.manufacturerPartNumber = manufacturerPartNumber;
  const newPath = designProfilePath(profile.partClass, profile.part);
  delete documents.profiles[oldPath];
  documents.profiles[newPath] = profile;
  const admission = documents.admission.entries.find((entry: any) => entry.partClass === partClass);
  admission.part = { ...profile.part };
  admission.profilePath = newPath;
  admission.profileContentHash = designProfileContentHash(profile);
  documents.admission.entries.sort((left: any, right: any) => left.profilePath < right.profilePath ? -1 : left.profilePath > right.profilePath ? 1 : 0);
  const releaseRef = documents.catalogRelease.profiles.find((entry: any) => entry.partClass === partClass);
  releaseRef.part = { ...profile.part };
  releaseRef.profilePath = newPath;
  releaseRef.profileId = designProfileId(profile.partClass, profile.part);
  releaseRef.profileContentHash = designProfileContentHash(profile);
  documents.catalogRelease.profiles.sort((left: any, right: any) => left.profileId < right.profileId ? -1 : left.profileId > right.profileId ? 1 : 0);
  documents.catalogRelease.admissionContentHash = admissionContentHash(documents.admission);
  documents.catalogRelease.contentHash = designCatalogContentHash(documents.manufacturerRegistry, documents.admission, Object.values(documents.profiles) as DesignProfileV1[]);
  return documents;
}

function ranking(application: "motor.brushed-dc" | "power.buck"): ElectricalRankingPolicyV2 {
  const prefix = application === "motor.brushed-dc" ? "motor" : "power";
  const area = { source: "metric", metricId: `${prefix}.native.board-area`, direction: "minimize" } as const;
  const count = { source: "metric", metricId: `${prefix}.native.component-count`, direction: "minimize" } as const;
  const payload: Omit<ElectricalRankingPolicyV2, "contentHash"> = { format: "schemagic-electrical-ranking-policy", schemaVersion: 2, version: `${prefix}-native-test.1`, application, paretoCriteria: [area, count], rankingProfiles: { area: [area, count], balanced: [area, count], efficiency: [area, count], temperature: [area, count] } };
  return { ...payload, contentHash: calculateElectricalRankingPolicyV2ContentHash(payload) };
}

function manifest(application: "motor.brushed-dc" | "power.buck", documents: DesignLibraryDocuments, policy = ranking(application)): ElectricalDesignContextManifestV2 {
  const catalog = buildReviewedProfileCatalogV2(documents);
  const payload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
    format: "schemagic-electrical-design-context", schemaVersion: 2, version: catalog.version, application,
    compiler: getInstalledCompilerImplementationRefV2(),
    catalog: { version: catalog.version, contentHash: catalog.contentHash, sourceReleaseContentHash: catalog.sourceRelease.contentHash },
    rankingPolicy: { version: policy.version, contentHash: policy.contentHash },
    recipes: [...getInstalledRecipeRefsV2(application)],
  };
  return { ...payload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(payload) };
}

function context(application: "motor.brushed-dc" | "power.buck", documents: DesignLibraryDocuments): GenerateElectricalContextV2 {
  const policy = ranking(application);
  const exactManifest = manifest(application, documents, policy);
  const capability = resolveInstalledRecipeRegistryV2(exactManifest);
  if (!capability) throw new Error("Expected installed recipe capability");
  return { manifest: exactManifest, catalogDocuments: documents, rankingPolicy: policy, installedRecipeRegistry: capability };
}

function migratedFixture(file: string, version: string): ElectricalDesignRequestV2 {
  const source = JSON.parse(readFileSync(new URL(`../../design-schema/test/fixtures/requests/${file}`, import.meta.url), "utf8"));
  const migrated = migrateDesignRequestV1ToV2(source, version);
  if (migrated.status !== "migrated") throw new Error("Expected migrated electrical fixture");
  return migrated.request;
}

function expectRecursivelyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) expectRecursivelyFrozen(descriptor.value, seen);
  }
}

describe("private installed native recipe sets", () => {
  it("fast-paths only the exact frozen installed result and keeps detached validation fail-closed", () => {
    const documents = refreshedDocuments(
      ["motor.integrated-h-bridge", "shared.mlcc-capacitor", "shared.bulk-capacitor"],
      {
        "motor.integrated-h-bridge": {
          supplyMaximum: 20,
          absoluteMaximum: 25,
          continuousCurrent: 6,
          logicHighThresholdMaximum: 3,
          pwmMaximum: 25_000,
          maximumHighSideDutyCycle: 0.9,
        },
        "shared.mlcc-capacitor": { ratedVoltage: 25 },
        "shared.bulk-capacitor": { ratedVoltage: 25 },
      },
    );
    const exactContext = context("motor.brushed-dc", documents);
    const request = structuredClone(migratedFixture(
      "m1-compact.design-request.json",
      (documents.catalogRelease as { version: string }).version,
    ));
    request.constraints.allowUnknownHardConstraints = true;
    const generation = generateElectricalDesignV2(request, exactContext);

    expectRecursivelyFrozen(generation.result);
    expect(validateDesignResultEngineeringContextV2(generation.result, exactContext)).toEqual([]);
    expect(validateDesignResultEngineeringContextV2(structuredClone(generation.result), exactContext)).toEqual([]);

    const tampered = structuredClone(generation.result);
    tampered.candidates[0]!.warnings.push("forged warning");
    const { contentHash: _contentHash, ...withoutHash } = tampered;
    tampered.contentHash = canonicalDesignResultV2ContentHash(withoutHash);
    expect(validateDesignResultEngineeringContextV2(tampered, exactContext)).not.toEqual([]);
    expect(validateDesignResultEngineeringContextV2(generation.result, {
      ...exactContext,
      manifest: { ...exactContext.manifest, version: "mismatched-context" },
    })).not.toEqual([]);
  });

  it("runs deterministic non-vacuous Motor and Power generations against only reviewed test documents", () => {
    let motorDocuments = refreshedDocuments(["motor.integrated-h-bridge", "shared.mlcc-capacitor", "shared.bulk-capacitor"], {
      "motor.integrated-h-bridge": { supplyMaximum: 20, absoluteMaximum: 25, continuousCurrent: 6, logicHighThresholdMaximum: 3, pwmMaximum: 25_000, maximumHighSideDutyCycle: 0.9 },
      "shared.mlcc-capacitor": { ratedVoltage: 25 },
      "shared.bulk-capacitor": { ratedVoltage: 25 },
    });
    const nativeExactPrimaryMpn = "EXACT\u0000/\u202ePRIMARY";
    const nativeExactPhysicalMpn = "EXACT\u0000/\u202eMPN";
    motorDocuments = rewriteProfileMpn(motorDocuments, "motor.integrated-h-bridge", nativeExactPrimaryMpn);
    motorDocuments = rewriteProfileMpn(motorDocuments, "shared.mlcc-capacitor", nativeExactPhysicalMpn);
    const motorStrictRequest = migratedFixture("m1-compact.design-request.json", (motorDocuments.catalogRelease as any).version);
    const motorContext = context("motor.brushed-dc", motorDocuments);
    const motorStrict = generateElectricalDesignV2(motorStrictRequest, motorContext);
    expect(motorStrict.result.candidates).toEqual([]);
    expect(motorStrict.execution.rejections.some((entry) => entry.stage === "check" && entry.reasonCode === "unknown_constraint_disallowed")).toBe(true);
    const motorRequest = structuredClone(motorStrictRequest);
    motorRequest.constraints.allowUnknownHardConstraints = true;
    const motor = generateElectricalDesignV2(motorRequest, motorContext);
    expect(motor.result.candidates).toHaveLength(1);
    expect(generateElectricalDesignV2(motorRequest, motorContext)).toEqual(motor);
    const motorWithoutEstimatedValuesRequest = structuredClone(motorRequest);
    motorWithoutEstimatedValuesRequest.constraints.allowEstimatedValues = false;
    const motorWithoutEstimatedValues = generateElectricalDesignV2(motorWithoutEstimatedValuesRequest, motorContext);
    expect(motorWithoutEstimatedValues.result.candidates).toHaveLength(1);
    expect(motorWithoutEstimatedValues.result.candidates[0]!.derivedValues.some((entry) => entry.state === "estimated")).toBe(false);
    expect(motorWithoutEstimatedValues.result.candidates[0]!.metrics.values.some((entry) => entry.state === "estimated")).toBe(false);
    expect(motorWithoutEstimatedValues.execution.rejections.some((entry) => entry.reasonCode === "estimated_values_disallowed")).toBe(false);
    expect(motor.result.candidates[0]!.components.map((entry) => entry.profileId).every((id) => buildReviewedProfileCatalogV2(motorDocuments).profiles.some((profile) => designProfileId(profile.partClass, profile.part) === id))).toBe(true);
    expect(motor.result.candidates[0]!.circuitBomNonRepresentations.map((entry) => entry.selectedComponentId)).toEqual(["primary"]);
    expect(motor.result.candidates[0]!.components.find((entry) => entry.id === "primary")!.part.manufacturerPartNumber).toBe(nativeExactPrimaryMpn);
    expect(motor.result.candidates[0]!.constraints.filter((entry) => entry.status === "unknown").map((entry) => entry.ruleId)).toEqual([
      "motor.current-limit.profile-range",
      "motor.request.current-limit-target",
      "motor.request.motor-model",
      "motor.request.motor-nominal-voltage",
      "motor.request.operating-load",
      "motor.request.operating-modes",
      "motor.thermal.ambient-range",
      "motor.thermal.maximum-junction",
    ]);
    const localClassification = motor.result.candidates[0]!.circuitInstanceClassifications.find((entry) => entry.kind === "physical" && entry.selectedComponentId === "local-decoupling")!;
    const localCircuitComponent = motor.result.candidates[0]!.circuit.circuits[0]!.components.find((entry) => entry.id === localClassification.componentId)!;
    expect(localCircuitComponent.mpn).toBe(nativeExactPhysicalMpn);
    const primaryNonRepresentation = motor.result.candidates[0]!.circuitBomNonRepresentations.find((entry) => entry.selectedComponentId === "primary");
    expect(primaryNonRepresentation).toBeDefined();
    expect(motor.result.candidates[0]!.components.find((entry) => entry.id === primaryNonRepresentation!.selectedComponentId)!.part.manufacturerPartNumber).toBe(nativeExactPrimaryMpn);
    const exactMpn = "EXACT\u0000/\u202eMPN";
    const controlIdentity = structuredClone(motor.result);
    const controlPrimary = controlIdentity.candidates[0]!.components.find((entry) => entry.id === "primary")!;
    controlPrimary.part.manufacturerPartNumber = exactMpn;
    controlPrimary.profileId = designProfileId("motor.integrated-h-bridge", controlPrimary.part);
    expect(controlPrimary.profileId).toContain("EXACT%00%2F%E2%80%AEMPN");
    const { contentHash: _controlHash, ...controlPayload } = controlIdentity;
    controlIdentity.contentHash = canonicalDesignResultV2ContentHash(controlPayload);
    const controlParsed = parseDesignResultV2(controlIdentity);
    const controlRoundTrip = parseDesignResultV2(JSON.parse(serializeDesignResultV2(controlParsed)));
    expect(controlRoundTrip.candidates[0]!.components.find((entry) => entry.id === "primary")!.part.manufacturerPartNumber).toBe(exactMpn);
    const packageBlockedRequest = structuredClone(motorRequest);
    packageBlockedRequest.constraints.allowedPackages = ["NOT-THE-REVIEWED-PACKAGE"];
    const packageBlocked = generateElectricalDesignV2(packageBlockedRequest, motorContext);
    expect(packageBlocked.result.candidates).toEqual([]);
    expect(packageBlocked.execution.rejections.some((entry) => entry.stage === "check" && entry.constraints.some((constraint) => constraint.ruleId === "motor.assembly.allowed-packages" && constraint.status === "fail"))).toBe(true);

    const powerDocuments = refreshedDocuments(["power.integrated-synchronous-buck-regulator", "power.power-inductor", "shared.mlcc-capacitor", "shared.general-purpose-resistor"], {
      "power.integrated-synchronous-buck-regulator": { inputVoltageMaximum: 20, feedbackReference: 2.5, switchingFrequencyMaximum: 2_000_000 },
      "power.power-inductor": { saturationCurrent: 5, rmsCurrent: 5 },
      "shared.mlcc-capacitor": { ratedVoltage: 25 },
    });
    const powerStrictRequest = migratedFixture("p1-compact.design-request.json", (powerDocuments.catalogRelease as any).version);
    const powerContext = context("power.buck", powerDocuments);
    const powerStrict = generateElectricalDesignV2(powerStrictRequest, powerContext);
    expect(powerStrict.result.candidates).toEqual([]);
    expect(powerStrict.execution.rejections.some((entry) => entry.stage === "check" && entry.reasonCode === "unknown_constraint_disallowed")).toBe(true);
    const powerRequest = structuredClone(powerStrictRequest);
    powerRequest.constraints.allowUnknownHardConstraints = true;
    const power = generateElectricalDesignV2(powerRequest, powerContext);
    expect(power.result.candidates).toHaveLength(1);
    expect(generateElectricalDesignV2(powerRequest, powerContext)).toEqual(power);
    expect(power.result.candidates[0]!.components).toHaveLength(6);
    expect(power.result.candidates[0]!.circuitBomNonRepresentations.map((entry) => entry.selectedComponentId)).toEqual(["primary"]);
    expect(power.result.candidates[0]!.constraints.filter((entry) => entry.status === "unknown").map((entry) => entry.ruleId)).toEqual([
      "power.inductor.ripple-current",
      "power.inductor.selected-value",
      "power.passive.capacitor-voltage",
      "power.passive.resistor-power-voltage",
      "power.regulator.current-limit",
      "power.regulator.minimum-off-time",
      "power.regulator.minimum-on-time",
      "power.request.load-transient",
      "power.request.output-ripple",
      "power.request.switching-selection",
      "power.thermal.ambient-range",
      "power.thermal.maximum-junction",
    ]);
  });

  it("runs the installed facts-V3.2 Motor path end to end without promoting unsupported fidelity", () => {
    const documents = structuredClone(getBundledDesignLibraryDocuments()) as DesignLibraryDocuments;
    const reviewed = buildReviewedProfileCatalogV2(documents);
    expect(reviewed.profiles).toContainEqual(expect.objectContaining({
      partClass: "motor.integrated-h-bridge",
      factsSchemaVersion: "3.2.0",
      part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8876PWPR" },
    }));

    const request = structuredClone(migratedFixture("m1-compact.design-request.json", (documents.catalogRelease as { version: string }).version));
    if (request.application !== "motor.brushed-dc") throw new Error("Expected the Motor fixture");
    request.constraints.allowUnknownHardConstraints = true;
    request.constraints.maximumBoardArea = { value: 1e-3, unit: "m2", displayUnit: "m2" };
    request.requirements.currentLimitTarget = { value: 1.5, unit: "A", displayUnit: "A" };
    const exactContext = context("motor.brushed-dc", documents);
    const generation = generateElectricalDesignV2(request, exactContext);
    expect(generation.result.candidates.length).toBeGreaterThan(0);
    expect(generateElectricalDesignV2(request, exactContext)).toEqual(generation);

    for (const candidate of generation.result.candidates) {
      expect(candidate.recipeId).toBe("motor.native.integrated-h-bridge.facts-v3-2");
      expect(candidate.components.find((component) => component.id === "primary")?.part).toEqual(expect.objectContaining({
        manufacturerPartNumber: expect.stringMatching(/^(DRV8876PWPR|STSPIN840)$/),
      }));
      expect(candidate.constraints).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: "motor.integrated.assembly.board-area", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.integrated.continuous-current", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.integrated.current-limit", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.integrated.operating-load", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.integrated.peak-current", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.integrated.thermal", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.integrated.transient-margin", status: "unknown" }),
      ]));
      expect(candidate.simulationCoverage).toEqual([
        expect.objectContaining({
          scenarioId: "pwm_loaded_steady_state",
          modelTier: "behavioral",
        }),
        expect.objectContaining({
          scenarioId: "selected_part_model",
          modelTier: "unavailable",
        }),
      ]);
      expect(candidate.circuit.scenarios).toEqual([
        expect.objectContaining({
          id: "pwm_loaded_steady_state",
          circuitId: "behavioral-operating-point",
          config: { mode: "op" },
        }),
      ]);
      expect(candidate.circuit.defaultCircuitId).toBe("assembly");
      expect(candidate.circuit.defaultScenarioId).toBe("pwm_loaded_steady_state");
      expect(candidate.circuit.circuits.find((circuit) => circuit.id === "assembly")?.wires.length).toBeGreaterThan(0);
      expect(candidate.circuit.designBlocks).toEqual([
        expect.objectContaining({ netlist: expect.objectContaining({ kind: "schematic_only" }) }),
      ]);
      expect(candidate.circuitBomNonRepresentations.filter((entry) => entry.circuitId === "assembly")).toEqual([]);
      expect(candidate.circuitBomNonRepresentations
        .filter((entry) => entry.circuitId === "behavioral-operating-point")
        .map((entry) => entry.selectedComponentId))
        .toEqual(candidate.components.map((component) => component.id).sort());
      expect(candidate.circuitInstanceClassifications.some((entry) => entry.kind === "physical" && entry.selectedComponentId === "primary")).toBe(true);
      expect(candidate.circuitInstanceClassifications
        .filter((entry) => entry.circuitId === "behavioral-operating-point")
        .every((entry) => entry.kind === "non_bom")).toBe(true);
    }

    const strictRequest = structuredClone(request);
    strictRequest.constraints.allowUnknownHardConstraints = false;
    const strict = generateElectricalDesignV2(strictRequest, exactContext);
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.rejections).toContainEqual(expect.objectContaining({
      stage: "check",
      reasonCode: "unknown_constraint_disallowed",
      recipeId: "motor.native.integrated-h-bridge.facts-v3-2",
    }));
  }, 60_000);

  it("enforces allowEstimatedValues for installed Power estimates without perturbing true mode", () => {
    const documents = structuredClone(getBundledDesignLibraryDocuments()) as DesignLibraryDocuments;
    const allowedRequest = structuredClone(migratedFixture(
      "p1-compact.design-request.json",
      (documents.catalogRelease as { version: string }).version,
    ));
    if (allowedRequest.application !== "power.buck") throw new Error("Expected the Power fixture");
    allowedRequest.requirements.inputVoltage = {
      minimum: { value: 12, unit: "V", displayUnit: "V" },
      nominal: { value: 12, unit: "V", displayUnit: "V" },
      maximum: { value: 12, unit: "V", displayUnit: "V" },
    };
    allowedRequest.requirements.outputVoltage = { value: 5, unit: "V", displayUnit: "V" };
    allowedRequest.requirements.dcOutputVoltageRegulation = {
      minimum: { value: 4.7, unit: "V", displayUnit: "V" },
      maximum: { value: 5.3, unit: "V", displayUnit: "V" },
    };
    allowedRequest.requirements.maximumOutputCurrent = { value: 0.2, unit: "A", displayUnit: "A" };
    allowedRequest.requirements.ambientTemperature = { value: 298.15, unit: "K", displayUnit: "K" };
    allowedRequest.requirements.switchingFrequency = {
      selection: "automatic",
      minimum: { value: 250_000, unit: "Hz", displayUnit: "Hz" },
      preferred: null,
      maximum: { value: 600_000, unit: "Hz", displayUnit: "Hz" },
    };
    allowedRequest.constraints.allowEstimatedValues = true;
    allowedRequest.constraints.allowUnknownHardConstraints = true;
    const exactContext = context("power.buck", documents);

    const allowed = generateElectricalDesignV2(allowedRequest, exactContext);
    const allowedAgain = generateElectricalDesignV2(structuredClone(allowedRequest), exactContext);
    expect(allowedAgain).toEqual(allowed);
    expect({
      contentHash: allowed.result.contentHash,
      candidateIds: allowed.result.candidates.map((candidate) => candidate.id),
    }).toEqual({
      contentHash: "sha256:2690a9ead0c94172456da4c46477637bb6ac73e562d91ed0526aee5883a4fd8a",
      candidateIds: [
        "candidate:v2:sha256:4ab497c91c72e20f50fdcad9fd509757b0f2f2bb0bb37f86c82d41825c232199",
      ],
    });
    const estimatedPowerCandidates = allowed.result.candidates.filter((candidate) => (
      candidate.recipeId === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
      && (
        candidate.derivedValues.some((entry) => entry.state === "estimated")
        || candidate.metrics.values.some((entry) => entry.state === "estimated")
      )
    ));
    expect(estimatedPowerCandidates.length).toBeGreaterThan(0);
    expect(estimatedPowerCandidates.every((candidate) => candidate.metrics.estimateCount > 0)).toBe(true);

    const disallowedRequest = structuredClone(allowedRequest);
    disallowedRequest.constraints.allowEstimatedValues = false;
    const disallowed = generateElectricalDesignV2(disallowedRequest, exactContext);
    expect(generateElectricalDesignV2(disallowedRequest, exactContext)).toEqual(disallowed);
    expect(disallowed.result.candidates.every((candidate) => (
      candidate.derivedValues.every((entry) => entry.state !== "estimated")
      && candidate.metrics.values.every((entry) => entry.state !== "estimated")
    ))).toBe(true);
    const estimateRejections = disallowed.execution.rejections.filter((entry) => (
      entry.stage === "estimate" && entry.reasonCode === "estimated_values_disallowed"
    ));
    expect(estimateRejections.length).toBeGreaterThan(0);
    expect(estimateRejections.some((entry) => (
      entry.recipeId === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
    ))).toBe(true);
    for (const rejection of estimateRejections) {
      const { message, ...messageInput } = rejection;
      expect(rejection).toMatchObject({
        stage: "estimate",
        reasonCode: "estimated_values_disallowed",
        candidateId: expect.stringMatching(/^candidate:v2:sha256:[0-9a-f]{64}$/),
      });
      expect(message).toBe(renderGenerationRejectionMessageV2(messageInput));
    }
    expect(disallowed.execution.counts.materialized + estimateRejections.length).toBe(disallowed.execution.counts.estimated);
    expect(parseDesignExecutionReportV2(structuredClone(disallowed.execution))).toEqual(disallowed.execution);
    expect(validateDesignExecutionReportContextV2(disallowed.execution, disallowed.result, exactContext)).toEqual([]);
    expect(generateElectricalDesignV2(allowedRequest, exactContext)).toEqual(allowed);
  }, 60_000);

  it("binds resolution to the exact complete sorted ref set and rejects forged capabilities", () => {
    const documents = createSyntheticReviewedLibraryFixture([]);
    const exact = manifest("motor.brushed-dc", documents);
    expect(exact.recipes.map((recipe) => recipe.id)).toEqual([
      "motor.native.external-nmos-h-bridge.facts-v2",
      "motor.native.external-nmos-h-bridge.facts-v3",
      "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      "motor.native.integrated-h-bridge",
      "motor.native.integrated-h-bridge.facts-v2",
      "motor.native.integrated-h-bridge.facts-v3-2",
    ]);
    expect(exact.recipes.map(({ id, version, contentHash }) => ({ id, version, contentHash }))).toEqual([
      { id: "motor.native.external-nmos-h-bridge.facts-v2", version: "2.0.0", contentHash: "sha256:3bc0f393cab9ac039bc4b564131dcb1e95c2369bd4855ee330454f64d65847d8" },
      { id: "motor.native.external-nmos-h-bridge.facts-v3", version: "3.0.0", contentHash: "sha256:cffc48e4bee012d0013243a84cfd74ae1790f49d9f4fa88ec6a066de52fb2854" },
      { id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified", version: "3.1.7", contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947" },
      { id: "motor.native.integrated-h-bridge", version: "1.0.0", contentHash: "sha256:3e441b3002d1cf83fe083c46cd5aae88425f39886617e66ec2253a60d53fed2c" },
      { id: "motor.native.integrated-h-bridge.facts-v2", version: "2.0.0", contentHash: "sha256:3fa1058e67d5906423153d1dc1150d78951f696fc5a747b8bfcc135ba7275d0b" },
      { id: "motor.native.integrated-h-bridge.facts-v3-2", version: "3.2.6", contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07" },
    ]);
    expect(exact.recipes.some((recipe) => recipe.id === "motor.native.external-nmos-h-bridge.facts-v2")).toBe(true);
    expect(getInstalledRecipeRefsV2("power.buck").map((recipe) => recipe.id)).toEqual([
      "power.native.external-fet-synchronous-buck.facts-v3",
      "power.native.facts-v2",
      "power.native.integrated-synchronous-buck",
      "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    ]);
    expect(getInstalledRecipeRefsV2("power.buck").find((recipe) => (
      recipe.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
    ))).toMatchObject({
      id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      version: "3.4.6",
      contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
    });
    for (const recipe of [...exact.recipes, ...getInstalledRecipeRefsV2("power.buck")]) {
      expect(Object.keys(recipe).sort()).toEqual(["applications", "contentHash", "id", "metricDeclarations", "version"]);
      for (const callback of ["supports", "enumerate", "solve", "match", "check", "estimate", "materialize"]) {
        expect(recipe).not.toHaveProperty(callback);
      }
    }
    expect(designEnginePublic).not.toHaveProperty("createInstalledNativeRecipeSets");
    expect(designEnginePublic).not.toHaveProperty("MOTOR_NATIVE_RECIPE_FACTS_V2");
    expect(designEnginePublic).not.toHaveProperty("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3");
    expect(designEnginePublic).not.toHaveProperty("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31");
    expect(designEnginePublic).not.toHaveProperty("MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED");
    expect(designEnginePublic).not.toHaveProperty("MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32");
    expect(designEnginePublic).not.toHaveProperty("POWER_NATIVE_RECIPE_FACTS_V2");
    expect(designEnginePublic).not.toHaveProperty("POWER_NATIVE_RECIPE_FACTS_V3");
    expect(designEnginePublic).not.toHaveProperty("POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3");
    const capability = resolveInstalledRecipeRegistryV2(exact);
    expect(capability).toBeDefined();
    const { contentHash: _hash, ...withoutHash } = exact;
    const missingPayload = { ...withoutHash, recipes: exact.recipes.slice(0, -1) };
    expect(resolveInstalledRecipeRegistryV2({ ...missingPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(missingPayload) })).toBeUndefined();
    const forgedRef = { ...exact.recipes.at(-1)!, contentHash: (`sha256:${"f".repeat(64)}`) as `sha256:${string}` };
    const forgedPayload = { ...withoutHash, recipes: [...exact.recipes.slice(0, -1), forgedRef] };
    expect(resolveInstalledRecipeRegistryV2({ ...forgedPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(forgedPayload) })).toBeUndefined();
    const extraRef = { ...exact.recipes[0]!, id: "motor.native.uninstalled", contentHash: (`sha256:${"e".repeat(64)}`) as `sha256:${string}` };
    const extraRecipes = [...exact.recipes, extraRef];
    const extraPayload = { ...withoutHash, recipes: extraRecipes };
    expect(resolveInstalledRecipeRegistryV2({ ...extraPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(extraPayload) })).toBeUndefined();
    const refs = getInstalledRecipeRefsV2("motor.brushed-dc") as any;
    expect(Object.isFrozen(refs)).toBe(true);
    expect(() => refs.push(extraRef)).toThrow();

    const motorDocuments = refreshedDocuments(["motor.integrated-h-bridge", "shared.mlcc-capacitor", "shared.bulk-capacitor"], { "motor.integrated-h-bridge": { supplyMaximum: 20, absoluteMaximum: 25, continuousCurrent: 6, logicHighThresholdMaximum: 3, pwmMaximum: 25_000, maximumHighSideDutyCycle: 0.9 }, "shared.mlcc-capacitor": { ratedVoltage: 25 }, "shared.bulk-capacitor": { ratedVoltage: 25 } });
    const validContext = context("motor.brushed-dc", motorDocuments);
    const request = structuredClone(migratedFixture("m1-compact.design-request.json", (motorDocuments.catalogRelease as any).version));
    request.constraints.allowUnknownHardConstraints = true;
    const baseline = generateElectricalDesignV2(request, validContext);
    expect(baseline.result.candidates).toHaveLength(1);
    const exposed = createInstalledNativeRecipeSets();
    expect(() => { (createInstalledNativeRecipeSets as any).forged = true; }).toThrow();
    for (const recipes of Object.values(exposed)) for (const recipe of recipes) {
      expect(() => { (recipe as any).id = "forged.recipe"; }).toThrow();
      expect(() => { (recipe.applications as any).push("power.buck"); }).toThrow();
      expect(() => { (recipe.metricDeclarations[0] as any).id = "forged.metric"; }).toThrow();
      for (const callback of ["supports", "enumerate", "solve", "match", "check", "estimate", "materialize"] as const) expect(() => { (recipe as any)[callback] = () => { throw new Error("forged"); }; }).toThrow();
    }
    expect(generateElectricalDesignV2(request, validContext)).toEqual(baseline);
    expect(() => generateElectricalDesignV2(request, { ...validContext, installedRecipeRegistry: { ...validContext.installedRecipeRegistry } as any })).toThrow(DesignGenerationErrorV2);
    expect(() => generateElectricalDesignV2(request, { ...validContext, recipes: [] } as any)).toThrow(DesignGenerationErrorV2);
  });

  it("rejects catalog tampering and remains non-vacuously catalog driven", () => {
    const documents = refreshedDocuments(["motor.integrated-h-bridge", "shared.mlcc-capacitor", "shared.bulk-capacitor"], { "motor.integrated-h-bridge": { supplyMaximum: 20, absoluteMaximum: 25, continuousCurrent: 6, logicHighThresholdMaximum: 3, pwmMaximum: 25_000, maximumHighSideDutyCycle: 0.9 }, "shared.mlcc-capacitor": { ratedVoltage: 25 }, "shared.bulk-capacitor": { ratedVoltage: 25 } });
    const request = migratedFixture("m1-compact.design-request.json", (documents.catalogRelease as any).version);
    const validContext = context("motor.brushed-dc", documents);
    const tampered = structuredClone(documents) as any;
    const primary = Object.values(tampered.profiles).find((entry: any) => entry.partClass === "motor.integrated-h-bridge") as any;
    primary.facts.supplyMaximum.value.value += 1;
    expect(() => generateElectricalDesignV2(request, { ...validContext, catalogDocuments: tampered })).toThrow(DesignGenerationErrorV2);

    const incomplete = refreshedDocuments(["motor.integrated-h-bridge", "shared.mlcc-capacitor"], { "motor.integrated-h-bridge": { supplyMaximum: 20, absoluteMaximum: 25, continuousCurrent: 6, logicHighThresholdMaximum: 3, pwmMaximum: 25_000, maximumHighSideDutyCycle: 0.9 }, "shared.mlcc-capacitor": { ratedVoltage: 25 } });
    const incompleteRequest = migratedFixture("m1-compact.design-request.json", (incomplete.catalogRelease as any).version);
    const generation = generateElectricalDesignV2(incompleteRequest, context("motor.brushed-dc", incomplete));
    expect(generation.result.candidates).toEqual([]);
    expect(generation.execution.rejections.some((entry) => entry.stage === "match")).toBe(true);
  });

  it("keeps production wrappers free of adapter, fixture, and V1 catalog imports", () => {
    for (const file of ["../../motor-designer/src/v2.ts", "../../power-designer/src/v2.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      for (const forbidden of ["adaptDesignRecipeV1ToV2", "./catalog", "./recipes", "./recipe", "SYNTHETIC_"]) expect(source).not.toContain(forbidden);
    }
  });
});
