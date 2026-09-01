import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateScenarioNetlist, validateCircuitV4 } from "@opencircuit/circuit-schema";
import {
  FACTS_SCHEMA_VERSION_V2,
  admissionContentHash,
  canonicalDesignProfileEnvelope,
  contentHash,
  designProfileEnvelopeContentHash,
  designProfilePath,
  loadReviewedDesignLibraryEnvelope,
  reviewedAdmissionProjection,
  validateDesignLibraryEnvelope,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileEnvelope,
  type DesignProfileV1,
  type ManufacturerRegistryV1,
  type MountedGeometryFactsV2,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library";
import {
  createSyntheticReviewedLibraryFixture,
} from "@opencircuit/design-library/fixtures";
import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import {
  DESIGN_V2_MAX_OPTIONS_PER_RECIPE,
  migrateDesignRequestV1ToV2,
  type BrushedDcMotorDesignRequestV2,
} from "@opencircuit/design-schema";
import {
  MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3,
  createInstalledNativeRecipeSets,
} from "../src";
import { MOTOR_NATIVE_RECIPE } from "../src/motor";
import {
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31,
  MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_PROFILE_CONTENT_HASH,
  MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
  MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_URL,
  MOTOR_EXTERNAL_V31_TVS_PROFILE_CONTENT_HASH,
  MOTOR_EXTERNAL_V31_TVS_SOURCE_CONTENT_HASH,
  MOTOR_EXTERNAL_V31_TVS_SOURCE_URL,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_INTERFACE_QUALIFIED,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED,
} from "../src/motor-external-v2";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32 } from "../src/motor-integrated-v32";
import { MOTOR_NATIVE_RECIPE_FACTS_V2 } from "../src/motor-v2";
import type {
  NativeCandidateV2,
  NativeEnvironmentV2,
  NativeMatchedOptionV2,
} from "../src/types";

const CLASSES = [
  "motor.integrated-h-bridge",
  "motor.full-bridge-gate-driver",
  "motor.supply-tvs-diode",
  "shared.current-sense-resistor",
  "shared.general-purpose-resistor",
  "shared.n-channel-power-mosfet",
  "shared.mlcc-capacitor",
  "shared.bulk-capacitor",
] as const;

function unknownLegacyGeometry(label: string) {
  return {
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation: `${label} is carried only by mountedGeometry in facts schema V2.`,
  };
}

function mountedGeometry(
  area: number,
  evidence: readonly ProfileEvidenceRef[],
): MountedGeometryFactsV2["mountedGeometry"] {
  const copiedEvidence = [...structuredClone(evidence)];
  const x = area / 1e-3;
  return {
    boardArea: {
      value: {
        area: { value: area, unit: "m2", displayUnit: "mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          {
            axis: "x",
            dimensionId: "land-x",
            multiplier: 1,
            maximum: { value: x, unit: "m", displayUnit: "mm" },
            evidence: [...structuredClone(copiedEvidence)],
          },
          {
            axis: "y",
            dimensionId: "land-y",
            multiplier: 1,
            maximum: { value: 1e-3, unit: "m", displayUnit: "mm" },
            evidence: [...structuredClone(copiedEvidence)],
          },
        ],
      },
      state: "calculated",
      evidence: [...structuredClone(copiedEvidence)],
      validFor: [],
      explanation: "Synthetic reviewed manufacturer land-pattern proxy.",
    },
    maximumHeight: {
      value: {
        height: { value: 1e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      state: "reviewed",
      evidence: [...structuredClone(copiedEvidence)],
      validFor: [],
      explanation: "Synthetic reviewed maximum mounted package height.",
    },
  };
}

function setQuantity(profile: DesignProfileV1, factId: string, value: number): void {
  const fact = (profile.facts as Record<string, { value: { value: number } | null }>)[factId];
  if (fact?.value === null || fact === undefined) throw new Error(`Missing fixture quantity ${factId}`);
  fact.value.value = value;
}

function setRange(profile: DesignProfileV1, factId: string, parameterId: string, minimum: number, maximum: number): void {
  const fact = (profile.facts as Record<string, { validFor: Array<{ parameterId: string; minimum: { value: number } | null; maximum: { value: number } | null }> }>)[factId];
  const range = fact?.validFor.find((entry) => entry.parameterId === parameterId);
  if (!range?.minimum || !range.maximum) throw new Error(`Missing fixture range ${factId}.${parameterId}`);
  range.minimum = { ...range.minimum, value: minimum };
  range.maximum = { ...range.maximum, value: maximum };
}

function v2Documents(): DesignLibraryDocuments {
  const documents = structuredClone(createSyntheticReviewedLibraryFixture(CLASSES)) as unknown as {
    manufacturerRegistry: ManufacturerRegistryV1;
    admission: DesignProfileAdmissionLedgerV1;
    catalogRelease: DesignCatalogReleaseV1;
    profiles: Record<string, DesignProfileV1 | DesignProfileEnvelope>;
  };
  for (const [path, rawProfile] of Object.entries(documents.profiles)) {
    const profile = rawProfile as DesignProfileV1;
    let area: number;
    if (profile.partClass === "motor.integrated-h-bridge") {
      area = 3e-6;
      setQuantity(profile, "supplyMinimum", 3);
      setQuantity(profile, "supplyMaximum", 20);
      setQuantity(profile, "continuousCurrent", 6);
      setQuantity(profile, "peakCurrent", 10);
      setQuantity(profile, "logicHighThresholdMaximum", 3);
      setQuantity(profile, "pwmMaximum", 25_000);
      setQuantity(profile, "minimumPulseWidth", 1e-6);
      setQuantity(profile, "maximumHighSideDutyCycle", 0.9);
      setQuantity(profile, "localDecouplingMinimum", 1e-6);
      setQuantity(profile, "bulkCapacitanceMinimum", 100e-6);
    } else if (profile.partClass === "motor.full-bridge-gate-driver") {
      area = 4e-6;
      setQuantity(profile, "supplyMinimum", 5);
      setQuantity(profile, "supplyMaximum", 40);
      setQuantity(profile, "absoluteMaximum", 50);
      setQuantity(profile, "driverBiasMinimum", 8);
      setQuantity(profile, "driverBiasMaximum", 12);
      setQuantity(profile, "logicHighThresholdMaximum", 2);
      setQuantity(profile, "pwmMaximum", 100_000);
      setQuantity(profile, "minimumPulseWidth", 1e-6);
      setQuantity(profile, "gateVoltage", 10);
      setQuantity(profile, "bootstrapMaximumDutyCycle", 0.9);
      setQuantity(profile, "senseMaximumVoltage", 0.25);
      setQuantity(profile, "localDecouplingMinimum", 1e-6);
    } else if (profile.partClass === "shared.n-channel-power-mosfet") {
      area = 3e-6;
      setQuantity(profile, "drainSourceVoltage", 60);
      setQuantity(profile, "continuousDrainCurrent", 10);
      setQuantity(profile, "pulsedDrainCurrent", 30);
      setRange(profile, "continuousDrainCurrent", "ambientTemperature", 300, 350);
    } else if (profile.partClass === "shared.current-sense-resistor") {
      area = 1e-6;
      setQuantity(profile, "resistance", 0.01);
      setQuantity(profile, "continuousPower", 5);
      setRange(profile, "resistance", "ambientTemperature", 300, 350);
    } else if (profile.partClass === "shared.general-purpose-resistor") {
      area = 1e-6;
      setQuantity(profile, "resistance", 10);
    } else if (profile.partClass === "motor.supply-tvs-diode") {
      area = 1e-6;
      setQuantity(profile, "standOffVoltage", 33);
      setQuantity(profile, "breakdownVoltageMinimum", 40);
      setQuantity(profile, "breakdownVoltageMaximum", 45);
      setQuantity(profile, "clampingVoltage", 50);
    } else if (profile.partClass === "shared.mlcc-capacitor") {
      area = 1e-6;
      setQuantity(profile, "nominalCapacitance", 10e-6);
      setQuantity(profile, "ratedVoltage", 50);
    } else if (profile.partClass === "shared.bulk-capacitor") {
      area = 2e-6;
      setQuantity(profile, "nominalCapacitance", 220e-6);
      setQuantity(profile, "ratedVoltage", 50);
    } else {
      throw new Error(`Unexpected fixture class ${profile.partClass}`);
    }
    const commonEvidence = structuredClone(profile.commonFacts.packageName.evidence);
    documents.profiles[path] = {
      ...profile,
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
      commonFacts: {
        packageName: profile.commonFacts.packageName,
        boardArea: unknownLegacyGeometry("Board area"),
        maximumHeight: unknownLegacyGeometry("Maximum height"),
      },
      facts: {
        ...profile.facts,
        mountedGeometry: mountedGeometry(area, commonEvidence),
      },
    };
  }

  for (const entry of documents.admission.entries) {
    const profile = documents.profiles[entry.profilePath] as DesignProfileEnvelope;
    entry.profileContentHash = designProfileEnvelopeContentHash(profile);
  }
  documents.catalogRelease.admissionContentHash = admissionContentHash(documents.admission);
  for (const ref of documents.catalogRelease.profiles) {
    const profile = documents.profiles[ref.profilePath] as DesignProfileEnvelope;
    ref.profileContentHash = designProfileEnvelopeContentHash(profile);
  }
  const profiles = Object.values(documents.profiles) as DesignProfileEnvelope[];
  const canonicalProfiles = [...profiles]
    .sort((left, right) => {
      const leftPath = designProfilePath(left.partClass, left.part);
      const rightPath = designProfilePath(right.partClass, right.part);
      return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
    })
    .map(canonicalDesignProfileEnvelope);
  documents.catalogRelease.contentHash = contentHash({
    manufacturerRegistry: documents.manufacturerRegistry,
    admission: reviewedAdmissionProjection(documents.admission),
    profiles: canonicalProfiles,
  });
  return documents as DesignLibraryDocuments;
}

function externalEnvironment(documents: DesignLibraryDocuments): NativeEnvironmentV2 {
  const base = environment(documents);
  if (base.request.application !== "motor.brushed-dc") throw new Error("Expected Motor environment");
  return {
    ...base,
    request: {
      ...base.request,
      constraints: { ...base.request.constraints, allowedTopologyFamilies: ["motor.hbridge.external-nmos"] },
    },
  };
}

function mixedV3ExternalEnvironment(): NativeEnvironmentV2 {
  const base = externalEnvironment(v2Documents());
  const mosfet = JSON.parse(readFileSync(new URL(
    "../../design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json",
    import.meta.url,
  ), "utf8")) as DesignProfileEnvelope;
  const tvs = JSON.parse(readFileSync(new URL(
    "../../design-library/parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json",
    import.meta.url,
  ), "utf8")) as DesignProfileEnvelope;
  return {
    ...base,
    request: {
      ...base.request,
      constraints: {
        ...base.request.constraints,
        allowedPackages: [],
        maximumComponentHeight: null,
      },
    },
    catalog: {
      profiles: [
        ...base.catalog.profiles.filter((profile) => (
          profile.partClass !== "shared.n-channel-power-mosfet"
          && profile.partClass !== "motor.supply-tvs-diode"
        )),
        mosfet,
        tvs,
      ],
    },
  };
}

function mixedV31ExternalEnvironment(): NativeEnvironmentV2 {
  const base = mixedV3ExternalEnvironment();
  const driver = JSON.parse(readFileSync(new URL(
    "../../design-library/parts/motor.full-bridge-gate-driver/microchip-technology/MIC4606-2YML-T5.json",
    import.meta.url,
  ), "utf8")) as DesignProfileEnvelope;
  return {
    ...base,
    catalog: {
      profiles: [
        ...base.catalog.profiles.filter((profile) => profile.partClass !== "motor.full-bridge-gate-driver"),
        driver,
      ],
    },
  };
}

function roleQualifiedExternalEnvironment(): NativeEnvironmentV2 {
  const base = mixedV31ExternalEnvironment();
  const resistors = [
    "bourns/CR0603-FX-1003ELF.json",
    "panasonic-industry/ERJ3EKF1003V.json",
    "vishay-intertechnology/CRCW0603100KFKEA.json",
    "vishay-intertechnology/CRCW0603732KFKEA.json",
  ].map((path) => JSON.parse(readFileSync(new URL(
    `../../design-library/parts/shared.general-purpose-resistor/${path}`,
    import.meta.url,
  ), "utf8")) as DesignProfileEnvelope);
  return {
    ...base,
    catalog: {
      profiles: [
        ...base.catalog.profiles.filter((profile) => profile.partClass !== "shared.general-purpose-resistor"),
        ...resistors,
      ],
    },
  };
}

function bundledRoleQualifiedExternalEnvironment(): NativeEnvironmentV2 {
  const documents = structuredClone(getBundledReviewedReleaseDocuments());
  const reviewed = loadReviewedDesignLibraryEnvelope(documents);
  const designRequest = request(reviewed.version);
  return {
    request: {
      ...designRequest,
      constraints: {
        ...designRequest.constraints,
        allowedTopologyFamilies: ["motor.hbridge.external-nmos"],
        allowedPackages: [],
        maximumBoardArea: null,
        maximumComponentHeight: null,
      },
    },
    catalog: { profiles: reviewed.profiles },
    manifest: { version: reviewed.version },
  };
}

function request(version: string): BrushedDcMotorDesignRequestV2 {
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migrated = migrateDesignRequestV1ToV2(source, version);
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") {
    throw new Error("Expected a migrated Motor request");
  }
  const parsed = structuredClone(migrated.request);
  parsed.constraints.allowedPackages = ["SYNTHETIC-PACKAGE"];
  parsed.constraints.maximumComponentHeight = { value: 2e-3, unit: "m", displayUnit: "mm" };
  parsed.constraints.maximumBoardArea = { value: 1e-4, unit: "m2", displayUnit: "mm²" };
  parsed.constraints.allowUnknownHardConstraints = true;
  return parsed;
}

function environment(documents: DesignLibraryDocuments): NativeEnvironmentV2 {
  expect(validateDesignLibraryEnvelope(documents)).toEqual([]);
  const reviewed = loadReviewedDesignLibraryEnvelope(documents);
  return {
    request: request(reviewed.version),
    catalog: { profiles: reviewed.profiles },
    manifest: { version: reviewed.version },
  };
}

function runMatched(environment: NativeEnvironmentV2): {
  matched: NativeMatchedOptionV2;
  constraints: ReturnType<typeof MOTOR_NATIVE_RECIPE_FACTS_V2.check>;
} {
  const enumerated = MOTOR_NATIVE_RECIPE_FACTS_V2.enumerate(environment);
  expect(enumerated).toHaveLength(1);
  const solved = MOTOR_NATIVE_RECIPE_FACTS_V2.solve({ data: enumerated[0]!.data }, environment);
  if (solved.status !== "ok") throw new Error("Expected solved Motor option");
  const matched = MOTOR_NATIVE_RECIPE_FACTS_V2.match(solved.value, environment);
  expect(matched).toHaveLength(1);
  if (matched[0]!.status !== "ok") throw new Error("Expected matched Motor option");
  const constraints = MOTOR_NATIVE_RECIPE_FACTS_V2.check(matched[0]!.value, environment);
  return { matched: matched[0]!.value, constraints };
}

function runExternal(environment: NativeEnvironmentV2) {
  const enumerated = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.enumerate(environment);
  expect(enumerated).toHaveLength(1);
  const solved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.solve(enumerated[0]!, environment);
  if (solved.status !== "ok") throw new Error(`Expected external solve: ${solved.reason}`);
  const outcome = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.match(solved.value, environment)[0]!;
  if (outcome.status !== "ok") throw new Error(`Expected external match: ${outcome.reason}`);
  const constraints = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.check(outcome.value, environment);
  const estimate = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.estimate(outcome.value, constraints, environment);
  return { enumerated, matched: outcome.value, constraints, estimate };
}

describe("facts-schema-V2 native Motor recipe", () => {
  it("runs only from hash-pinned reviewed V2 documents and keeps unproved requirements unknown", () => {
    const exactEnvironment = environment(v2Documents());
    const { matched, constraints } = runMatched(exactEnvironment);
    expect(matched.components.map((entry) => entry.id)).toEqual([
      "bulk-capacitor",
      "local-decoupling",
      "primary",
    ]);
    expect(constraints.filter((entry) => entry.status === "fail")).toEqual([]);
    expect(constraints.filter((entry) => entry.status === "unknown").map((entry) => entry.ruleId)).toEqual([
      "motor.assembly.board-area",
      "motor.passive.capacitor-derating",
      "motor.protection.current-limit",
      "motor.request.motor-model",
      "motor.request.motor-nominal-voltage",
      "motor.request.operating-load",
      "motor.request.operating-modes",
      "motor.thermal.ambient-range",
      "motor.thermal.maximum-junction",
    ]);
    expect(constraints.find((entry) => entry.ruleId === "motor.assembly.component-height")).toMatchObject({ status: "pass", actual: { value: 1e-3 } });
    expect(constraints.find((entry) => entry.ruleId === "motor.assembly.board-area")).not.toHaveProperty("actual");

    const estimate = MOTOR_NATIVE_RECIPE_FACTS_V2.estimate(matched, constraints, exactEnvironment);
    expect(estimate.metrics).toContainEqual(expect.objectContaining({
      id: "motor.native.board-area",
      state: "calculated",
      value: { value: 6e-6, unit: "m2", displayUnit: "m2" },
    }));
    expect(estimate.metrics.find((entry) => entry.id === "motor.native.board-area")!.explanation).toMatch(/Ranking-only/);
  });

  it("materializes exact passive bindings and an explicit primary non-representation", () => {
    const exactEnvironment = environment(v2Documents());
    const { matched, constraints } = runMatched(exactEnvironment);
    const estimate = MOTOR_NATIVE_RECIPE_FACTS_V2.estimate(matched, constraints, exactEnvironment);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: MOTOR_NATIVE_RECIPE_FACTS_V2.id,
      libraryVersion: String((exactEnvironment.manifest as { version: string }).version),
      data: matched.data,
      components: matched.components,
      derivedValues: matched.derivedValues,
      constraints,
      metrics: { values: estimate.metrics, warningCount: 0, estimateCount: 0, unknownCount: 0 },
      simulationCoverage: matched.simulationCoverage,
      warnings: matched.warnings,
    };
    const materialized = MOTOR_NATIVE_RECIPE_FACTS_V2.materialize(candidate, exactEnvironment);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuitInstanceClassifications).toEqual([
      { circuitId: "assembly", componentId: "bulk-capacitor", kind: "physical", selectedComponentId: "bulk-capacitor", representedQuantityPerAssembly: 1 },
      { circuitId: "assembly", componentId: "ground", kind: "non_bom", reason: "Ground is a schematic reference, not a BOM line." },
      { circuitId: "assembly", componentId: "local-decoupling", kind: "physical", selectedComponentId: "local-decoupling", representedQuantityPerAssembly: 1 },
    ]);
    expect(materialized.circuitBomNonRepresentations).toEqual([{
      circuitId: "assembly",
      selectedComponentId: "primary",
      reason: "No reviewed executable integrated H-bridge model is bound to this exact selected profile.",
    }]);
    for (const classification of materialized.circuitInstanceClassifications) {
      if (classification.kind !== "physical") continue;
      const selected = matched.components.find((entry) => entry.id === classification.selectedComponentId)!;
      const instance = materialized.circuit.circuits[0]!.components.find((entry) => entry.id === classification.componentId)!;
      expect(instance.mpn).toBe(selected.part.manufacturerPartNumber);
    }
  });

  it("does not cast V1 profiles into the V2 path and installs the exact six Motor recipes", () => {
    const v1 = loadReviewedDesignLibraryEnvelope(createSyntheticReviewedLibraryFixture(CLASSES));
    const v1Environment: NativeEnvironmentV2 = {
      request: request(v1.version),
      catalog: { profiles: v1.profiles },
      manifest: { version: v1.version },
    };
    expect(MOTOR_NATIVE_RECIPE_FACTS_V2.enumerate(v1Environment)).toEqual([]);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.enumerate({
      ...v1Environment,
      request: { ...v1Environment.request, constraints: { ...v1Environment.request.constraints, allowedTopologyFamilies: ["motor.hbridge.external-nmos"] } } as BrushedDcMotorDesignRequestV2,
    })).toEqual([]);
    expect(createInstalledNativeRecipeSets()["motor.brushed-dc"].map((recipe) => recipe.id)).toEqual([
      MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.id,
      "motor.native.external-nmos-h-bridge.facts-v3",
      MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.id,
      "motor.native.integrated-h-bridge",
      MOTOR_NATIVE_RECIPE_FACTS_V2.id,
      MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32.id,
    ]);
  });

  it("locks all prior Motor recipe identities and the immutable facts-3.2 identity", () => {
    expect(MOTOR_NATIVE_RECIPE.contentHash).toBe("sha256:3e441b3002d1cf83fe083c46cd5aae88425f39886617e66ec2253a60d53fed2c");
    expect(MOTOR_NATIVE_RECIPE_FACTS_V2.contentHash).toBe("sha256:3fa1058e67d5906423153d1dc1150d78951f696fc5a747b8bfcc135ba7275d0b");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.contentHash).toBe("sha256:3bc0f393cab9ac039bc4b564131dcb1e95c2369bd4855ee330454f64d65847d8");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3.contentHash).toBe("sha256:cffc48e4bee012d0013243a84cfd74ae1790f49d9f4fa88ec6a066de52fb2854");
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31).toMatchObject({
      id: "motor.native.external-nmos-h-bridge.facts-v3-1",
      version: "3.1.1",
      contentHash: "sha256:3832200e9181d616299bb7cec73f3ca8fe6c2021d6efd033c3913a0b3894c9df",
    });
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED).toMatchObject({
      id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      version: "3.1.2",
      contentHash: "sha256:7d1877def1349959d2834fe5ceed0710bba805d408e3493b2ad82add8f781a6b",
    });
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED).toMatchObject({
      id: MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.id,
      version: "3.1.3",
      contentHash: "sha256:8fc5d70793b391cc7d67746f6d7a413a6f08574688c9294fda634858a17d8c1a",
    });
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE).toMatchObject({
      id: MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.id,
      version: "3.1.4",
      contentHash: "sha256:c8145e32480a29e0d9d008ac7e73ff73f9b93cb08aa2f7f0919f199af4955d84",
    });
    expect(MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32).toMatchObject({
      id: "motor.native.integrated-h-bridge.facts-v3-2",
      version: "3.2.2",
      contentHash: "sha256:26eb9e820053a9fb4924962fccde309076f7d29cec0e334b5f09f2bd34b9c328",
    });
  });

  it("enumerates and binds the exact external-NMOS profile contract while keeping unsupported engineering unknown", () => {
    const exactEnvironment = externalEnvironment(v2Documents());
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.supports(exactEnvironment.request)).toBe(true);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.enumerate({ ...exactEnvironment, catalog: { profiles: [] } })).toEqual([]);
    const reversed = { ...exactEnvironment, catalog: { profiles: [...exactEnvironment.catalog.profiles].reverse() } };
    const result = runExternal(exactEnvironment);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.enumerate(reversed)).toEqual(result.enumerated);
    expect(result.matched.components.map((component) => [component.id, component.quantityPerAssembly])).toEqual([
      ["bootstrap-capacitor", 2],
      ["bulk-capacitor", 1],
      ["current-sense-resistor", 1],
      ["driver", 1],
      ["gate-resistor", 4],
      ["local-decoupling", 1],
      ["mosfet", 4],
      ["pulldown-resistor", 4],
      ["supply-tvs", 1],
    ]);
    expect(result.constraints.filter((constraint) => constraint.status === "fail")).toEqual([]);
    expect(result.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.driver-supply-maximum", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.mosfet-continuous-current", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.tvs-stand-off", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.mosfet-pulsed-soa", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.switching-and-loss", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.tvs-coordination", status: "unknown" }),
    ]));
    expect(result.estimate.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "motor.native.board-area", value: { value: 31e-6, unit: "m2", displayUnit: "m2" } }),
      expect.objectContaining({ id: "motor.native.component-count", value: { value: 19, unit: "count", displayUnit: "count" } }),
    ]));

    for (const [highSideSupply, bootstrapExpected] of [
      ["bootstrap", true],
      ["bootstrap_with_charge_pump", true],
      ["bootstrap_with_top_off_charge_pump", true],
      ["charge_pump", false],
    ] as const) {
      const classified = structuredClone(exactEnvironment);
      const driver = classified.catalog.profiles.find((profile) => profile.partClass === "motor.full-bridge-gate-driver") as unknown as {
        facts: { highSideSupply: { value: typeof highSideSupply } };
      };
      driver.facts.highSideSupply.value = highSideSupply;
      const classifiedResult = runExternal(classified);
      expect(classifiedResult.matched.data.bootstrapRequired).toBe(bootstrapExpected);
      expect(classifiedResult.matched.components.some((component) => component.id === "bootstrap-capacitor")).toBe(bootstrapExpected);
    }

    const withCurrentLimit = structuredClone(exactEnvironment);
    if (withCurrentLimit.request.application !== "motor.brushed-dc") throw new Error("Expected Motor request");
    withCurrentLimit.request.requirements.currentLimitTarget = { value: 3, unit: "A", displayUnit: "A" };
    expect(runExternal(withCurrentLimit).constraints).toContainEqual(expect.objectContaining({
      ruleId: "motor.external.current-sense-threshold",
      status: "unknown",
      explanation: expect.stringMatching(/not a reviewed configured current-limit threshold/),
    }));

    const outsideMosfetCondition = structuredClone(exactEnvironment);
    if (outsideMosfetCondition.request.application !== "motor.brushed-dc") throw new Error("Expected Motor request");
    outsideMosfetCondition.request.requirements.ambientTemperature.value = 360;
    expect(runExternal(outsideMosfetCondition).constraints).toContainEqual(expect.objectContaining({
      ruleId: "motor.external.mosfet-continuous-current",
      status: "unknown",
    }));
  });

  it("runs the mixed V2/V3 external recipe without projecting selected V3 profile bytes", () => {
    const environment = mixedV3ExternalEnvironment();
    const enumerated = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3.enumerate(environment);
    expect(enumerated).toHaveLength(1);
    expect(enumerated[0]!.optionKey).toMatch(/^motor-external-v3:sha256:/);
    const solved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3.solve(enumerated[0]!, environment);
    if (solved.status !== "ok") throw new Error(`Expected V3 external solve: ${solved.reason}`);
    const outcome = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3.match(solved.value, environment)[0]!;
    if (outcome.status !== "ok") throw new Error(`Expected V3 external match: ${outcome.reason}`);
    expect(outcome.value.components.find((component) => component.id === "mosfet")?.part.manufacturerPartNumber).toBe("CSD18540Q5B");
    expect(outcome.value.components.find((component) => component.id === "supply-tvs")?.part.manufacturerPartNumber).toBe("PTVS10-058C-SH");
    expect(outcome.value.simulationCoverage[0]).toEqual(expect.objectContaining({ modelTier: "unavailable" }));
    expect(outcome.value.simulationCoverage[0]!.limitations[0]).toMatch(/mixed facts-V2\/V3/);
    const constraints = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3.check(outcome.value, environment);
    expect(constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.mosfet-vds", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.tvs-stand-off", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.mosfet-pulsed-soa", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.tvs-coordination", status: "unknown" }),
    ]));
  });

  it("runs the exact V3.1/V3/V2 Motor tuple without promoting admission or typical timing to feasibility", () => {
    const environment = mixedV31ExternalEnvironment();
    const enumerated = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.enumerate(environment);
    expect(enumerated).toHaveLength(1);
    expect(enumerated[0]!.optionKey).toMatch(/^motor-external-v3-1:sha256:/);

    const withoutV31Driver = {
      ...environment,
      catalog: {
        profiles: [
          ...environment.catalog.profiles.filter((profile) => profile.partClass !== "motor.full-bridge-gate-driver"),
          ...externalEnvironment(v2Documents()).catalog.profiles.filter((profile) => profile.partClass === "motor.full-bridge-gate-driver"),
        ],
      },
    };
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.enumerate(withoutV31Driver)).toEqual([]);
    const allV2 = externalEnvironment(v2Documents());
    const withOnlyV31Driver = {
      ...allV2,
      catalog: {
        profiles: [
          ...allV2.catalog.profiles.filter((profile) => profile.partClass !== "motor.full-bridge-gate-driver"),
          ...environment.catalog.profiles.filter((profile) => profile.partClass === "motor.full-bridge-gate-driver"),
        ],
      },
    };
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.enumerate(withOnlyV31Driver)).toEqual([]);

    const solved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.solve(enumerated[0]!, environment);
    if (solved.status !== "ok") throw new Error(`Expected V3.1 external solve: ${solved.reason}`);
    const outcome = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.match(solved.value, environment)[0]!;
    if (outcome.status !== "ok") throw new Error(`Expected V3.1 external match: ${outcome.reason}`);
    expect(outcome.value.components.find((component) => component.id === "driver")?.part.manufacturerPartNumber).toBe("MIC4606-2YML-T5");
    expect(outcome.value.components.find((component) => component.id === "mosfet")?.part.manufacturerPartNumber).toBe("CSD18540Q5B");
    expect(outcome.value.components.find((component) => component.id === "supply-tvs")?.part.manufacturerPartNumber).toBe("PTVS10-058C-SH");
    expect(outcome.value.simulationCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenarioId: "pwm_loaded_steady_state", modelTier: "behavioral" }),
      expect.objectContaining({ scenarioId: "selected_part_model", modelTier: "unavailable" }),
    ]));
    expect(outcome.value.simulationCoverage.find((entry) => entry.scenarioId === "selected_part_model")?.limitations[0])
      .toMatch(/mixed facts-V2\/V3\/V3\.1/);

    const constraints = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.check(outcome.value, environment);
    expect(constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.driver-absolute-maximum", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.driver-supply-maximum", status: "pass" }),
      expect.objectContaining({ ruleId: "motor.external.driver-supply-minimum", status: "unknown", explanation: expect.stringMatching(/switch-node limit, not a motor-bus supply minimum/) }),
      expect.objectContaining({ ruleId: "motor.external.driver-pwm-frequency", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.driver-pulse-on-time", status: "unknown", explanation: expect.stringMatching(/not a guaranteed bound/) }),
      expect.objectContaining({ ruleId: "motor.external.driver-pulse-off-time", status: "unknown", explanation: expect.stringMatching(/not a guaranteed bound/) }),
      expect.objectContaining({ ruleId: "motor.external.high-side-duty", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.local-capacitance-nominal", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.local-voltage-rating", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.current-sense-threshold", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.driver-bias-source", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.mosfet-pulsed-soa", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.switching-and-loss", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.thermal", status: "unknown" }),
    ]));
    expect(constraints.find((constraint) => constraint.ruleId === "motor.external.driver-pulse-on-time")!.evidence.length).toBeGreaterThan(0);

    const mismatchedRoleEnvironment = structuredClone(environment);
    const mismatchedDriver = mismatchedRoleEnvironment.catalog.profiles.find((profile) => (
      profile.partClass === "motor.full-bridge-gate-driver"
    )) as any;
    mismatchedDriver.facts.minimumPulseWidth.validFor = [];
    mismatchedDriver.facts.minimumPulseWidthRole.value = "guaranteed_bound";
    const mismatchedOptions = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.enumerate(mismatchedRoleEnvironment);
    expect(mismatchedOptions).toHaveLength(1);
    const mismatchedSolved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.solve(mismatchedOptions[0]!, mismatchedRoleEnvironment);
    if (mismatchedSolved.status !== "ok") throw new Error(`Expected mismatched-role V3.1 solve: ${mismatchedSolved.reason}`);
    const mismatchedOutcome = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.match(mismatchedSolved.value, mismatchedRoleEnvironment)[0]!;
    if (mismatchedOutcome.status !== "ok") throw new Error(`Expected mismatched-role V3.1 match: ${mismatchedOutcome.reason}`);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.check(mismatchedOutcome.value, mismatchedRoleEnvironment)).toContainEqual(expect.objectContaining({
      ruleId: "motor.external.driver-pulse-on-time",
      status: "unknown",
      explanation: expect.stringMatching(/quantity and its guaranteed-bound role do not both cover/),
    }));
  });

  it("installs the binding-refreshed role-qualified successor and fails closed while series-gate pulse/drive evidence is absent", () => {
    const environment = roleQualifiedExternalEnvironment();
    const recipe = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED;
    expect(recipe.supports(environment.request)).toBe(true);
    expect(recipe.enumerate(environment)).toEqual([]);
    expect(recipe.enumerate({
      ...environment,
      catalog: { profiles: [...environment.catalog.profiles].reverse() },
    })).toEqual([]);

    const legacyOptions = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.enumerate(environment);
    expect(legacyOptions.length).toBeGreaterThan(0);
    expect(legacyOptions.some((option) => (
      typeof option.data.gateResistorProfileId === "string"
      && option.data.gateResistorProfileId.includes("CRCW0603732KFKEA")
    ))).toBe(true);
    expect(createInstalledNativeRecipeSets()["motor.brushed-dc"].some((recipe) => (
      recipe.id === MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.id
    ))).toBe(false);

    const profileIdForMpn = (mpn: string) => {
      const profile = environment.catalog.profiles.find((candidate) => (
        candidate.partClass === "shared.general-purpose-resistor"
        && candidate.part.manufacturerPartNumber === mpn
      ));
      if (profile === undefined) throw new Error(`Missing resistor ${mpn}`);
      return designProfilePath(profile.partClass, profile.part);
    };
    const exact100k = profileIdForMpn("CR0603-FX-1003ELF");
    const exact732k = profileIdForMpn("CRCW0603732KFKEA");
    const baseData = {
      ...legacyOptions[0]!.data,
      gateResistorProfileId: exact100k,
      pulldownProfileId: exact100k,
    };
    const predecessorBourns = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.solve({ data: baseData }, environment);
    if (predecessorBourns.status !== "ok") throw new Error(`Expected predecessor role-qualified solve: ${predecessorBourns.reason}`);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.match(predecessorBourns.value, environment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/pull-down is not one of the exact reviewed 100 kΩ role-qualified profiles/),
    }));
    for (const predecessorPulldown of [
      profileIdForMpn("ERJ3EKF1003V"),
      profileIdForMpn("CRCW0603100KFKEA"),
    ]) {
      const predecessorSolved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.solve({
        data: { ...baseData, pulldownProfileId: predecessorPulldown },
      }, environment);
      if (predecessorSolved.status !== "ok") throw new Error(`Expected predecessor role-qualified solve: ${predecessorSolved.reason}`);
      const predecessorOutcome = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED.match(predecessorSolved.value, environment)[0]!;
      expect(predecessorOutcome).toEqual(expect.objectContaining({
        status: "rejected",
        reason: expect.stringMatching(/No exact reviewed series-gate resistor profile has pulse and driver evidence/),
      }));
      if (predecessorOutcome.status !== "rejected") throw new Error("Expected predecessor role-qualified rejection");
      expect(predecessorOutcome.reason).not.toMatch(/pull-down is not one of/);
    }
    const solved = recipe.solve({ data: baseData }, environment);
    if (solved.status !== "ok") throw new Error(`Expected role-qualified solve: ${solved.reason}`);
    expect(recipe.match(solved.value, environment)).toEqual([{
      status: "rejected",
      reason: expect.stringMatching(/No exact reviewed series-gate resistor profile has pulse and driver evidence/),
      componentProfileIds: [exact100k],
    }]);
    for (const exactPulldown of [
      exact100k,
      profileIdForMpn("ERJ3EKF1003V"),
      profileIdForMpn("CRCW0603100KFKEA"),
    ]) {
      const exactPulldownSolved = recipe.solve({
        data: { ...baseData, pulldownProfileId: exactPulldown },
      }, environment);
      if (exactPulldownSolved.status !== "ok") throw new Error(`Expected role-qualified solve: ${exactPulldownSolved.reason}`);
      const exactPulldownOutcome = recipe.match(exactPulldownSolved.value, environment)[0]!;
      expect(exactPulldownOutcome).toEqual(expect.objectContaining({
        status: "rejected",
        reason: expect.stringMatching(/No exact reviewed series-gate resistor profile has pulse and driver evidence/),
      }));
      if (exactPulldownOutcome.status !== "rejected") throw new Error("Expected role-qualified rejection");
      expect(exactPulldownOutcome.reason).not.toMatch(/pull-down is not one of/);
    }
    for (const reviewedGateMpn of [
      "CR0603-FX-1003ELF",
      "ERJ3EKF1003V",
      "CRCW0603100KFKEA",
      "CRCW0603732KFKEA",
    ]) {
      const reviewedGateSolved = recipe.solve({
        data: { ...baseData, gateResistorProfileId: profileIdForMpn(reviewedGateMpn) },
      }, environment);
      if (reviewedGateSolved.status !== "ok") throw new Error(`Expected role-qualified solve: ${reviewedGateSolved.reason}`);
      expect(recipe.match(reviewedGateSolved.value, environment)[0]).toEqual(expect.objectContaining({
        status: "rejected",
        reason: expect.stringMatching(/No exact reviewed series-gate resistor profile has pulse and driver evidence/),
      }));
    }
    const hashDriftEnvironment = structuredClone(environment);
    const hashDriftPulldown = hashDriftEnvironment.catalog.profiles.find((profile) => (
      profile.partClass === "shared.general-purpose-resistor"
      && profile.part.manufacturerPartNumber === "CR0603-FX-1003ELF"
    ))!;
    (hashDriftPulldown.facts as any).resistance.explanation += " Tampered after review.";
    expect(recipe.match(solved.value, hashDriftEnvironment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/pull-down is not one of the exact reviewed 100 kΩ role-qualified profiles/),
    }));

    const wrongPulldown = recipe.solve({
      data: { ...baseData, pulldownProfileId: exact732k },
    }, environment);
    if (wrongPulldown.status !== "ok") throw new Error(`Expected role-qualified solve: ${wrongPulldown.reason}`);
    expect(recipe.match(wrongPulldown.value, environment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/pull-down is not one of the exact reviewed 100 kΩ role-qualified profiles/),
    }));

    const legacyExactOption = legacyOptions.find((option) => (
      option.data.gateResistorProfileId === exact100k
      && option.data.pulldownProfileId === exact100k
    ));
    if (legacyExactOption === undefined) throw new Error("Expected exact 100 kΩ legacy option");
    const legacySolved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.solve(legacyExactOption, environment);
    if (legacySolved.status !== "ok") throw new Error(`Expected legacy solve: ${legacySolved.reason}`);
    const legacyMatched = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.match(legacySolved.value, environment)[0]!;
    if (legacyMatched.status !== "ok") throw new Error(`Expected legacy match: ${legacyMatched.reason}`);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: recipe.id,
      libraryVersion: String((environment.manifest as { version: string }).version),
      data: legacyMatched.value.data,
      components: legacyMatched.value.components,
      derivedValues: legacyMatched.value.derivedValues,
      constraints: [],
      metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
      simulationCoverage: legacyMatched.value.simulationCoverage,
      warnings: [],
    };
    expect(() => recipe.materialize({
      ...candidate,
      recipeId: MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.id,
    }, environment)).toThrow(/exact recipe identity/);
    for (const mutate of [
      (component: any) => { component.role = "not-a-pulldown"; },
      (component: any) => { component.profileId = `${component.profileId}.tampered`; },
      (component: any) => { component.part.manufacturerPartNumber += "-TAMPERED"; },
      (component: any) => { component.quantityPerAssembly = 1; },
      (component: any) => { component.value.value = 732_000; },
    ]) {
      const drifted = structuredClone(candidate);
      mutate(drifted.components.find((component) => component.id === "pulldown-resistor")!);
      expect(() => recipe.materialize(drifted, environment))
        .toThrow(/BOM (binding|value) drifted for pulldown-resistor/);
    }
    expect(() => recipe.materialize(candidate, environment))
      .toThrow(/No exact reviewed series-gate resistor profile has the pulse and driver evidence/);
  });

  it("binds the exact rev-H MIC4606 direct-gate successor while retaining the required gate-network unknown", () => {
    const environment = roleQualifiedExternalEnvironment();
    const recipe = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE;
    expect(MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_PROFILE_CONTENT_HASH)
      .toBe("sha256:1fd9a7097dd7359f39cfd1fa285671d830ba9e544d16e37a34d28854efbb2f47");
    expect(MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH)
      .toBe("sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135");
    expect(MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_URL)
      .toBe("https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-85V-Full-Bridge-MOSFET-Drivers-with-Adaptive-Dead-Time-and-Shoot-Through-Protection-DS20005604.pdf");

    const driver = environment.catalog.profiles.find((profile) => (
      profile.partClass === "motor.full-bridge-gate-driver"
      && profile.part.manufacturerPartNumber === "MIC4606-2YML-T5"
    ));
    if (driver === undefined) throw new Error("Missing exact MIC4606 driver fixture");
    expect(designProfileEnvelopeContentHash(driver)).toBe(MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_PROFILE_CONTENT_HASH);

    const options = recipe.enumerate(environment);
    expect(options).toHaveLength(3);
    expect(recipe.enumerate({
      ...environment,
      catalog: { profiles: [...environment.catalog.profiles].reverse() },
    })).toEqual(options);
    expect(options.every((option) => !Object.hasOwn(option.data, "gateResistorProfileId"))).toBe(true);

    const scalableClasses = new Set([
      "motor.supply-tvs-diode",
      "shared.bulk-capacitor",
      "shared.current-sense-resistor",
      "shared.mlcc-capacitor",
      "shared.n-channel-power-mosfet",
    ]);
    const oversizedProfiles = environment.catalog.profiles.flatMap((profile) => (
      scalableClasses.has(profile.partClass)
        ? Array.from({ length: 5 }, (_, index) => ({
            ...structuredClone(profile),
            part: { ...profile.part, manufacturerPartNumber: `${profile.part.manufacturerPartNumber}-${index}` },
          }))
        : [profile]
    ));
    expect(() => recipe.enumerate({ ...environment, catalog: { profiles: oversizedProfiles } }))
      .toThrowError(new RangeError(`${recipe.id}:enumerate:resource_limit:9375>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`));

    const solved = recipe.solve(options[0]!, environment);
    if (solved.status !== "ok") throw new Error(`Expected direct-gate solve: ${solved.reason}`);
    const outcome = recipe.match(solved.value, environment)[0]!;
    if (outcome.status !== "ok") throw new Error(`Expected direct-gate match: ${outcome.reason}`);
    expect(outcome.value.components.some((component) => component.id === "gate-resistor")).toBe(false);
    expect(outcome.value.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "driver", part: { manufacturerId: "microchip-technology", manufacturerPartNumber: "MIC4606-2YML-T5" } }),
      expect.objectContaining({ id: "pulldown-resistor", quantityPerAssembly: 4, value: { value: 100_000, unit: "ohm", displayUnit: "ohm" } }),
    ]));

    const constraints = recipe.check(outcome.value, environment);
    const gateNetwork = constraints.find((constraint) => constraint.ruleId === "motor.external.gate-network");
    expect(gateNetwork).toEqual(expect.objectContaining({
      status: "unknown",
      explanation: expect.stringMatching(/does not prove a resistor value, switching behavior, dv\/dt, Miller immunity, shoot-through prevention, package-pin mapping, or physical gate-network feasibility/),
      evidence: expect.arrayContaining([expect.objectContaining({
        sourceId: "microchip-mic4606-ds20005604h",
        retrievedAt: "2026-08-26T01:11:06Z",
        contentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
        locator: expect.stringMatching(/physical PDF page 20.*optional.*physical PDF page 21.*not recommended/),
      })]),
    }));
    const policy = MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3.recipePolicies.find((entry) => entry.recipeId === recipe.id);
    expect(policy?.recipeContentHash).toBe(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED.contentHash);
    expect(policy?.recipeContentHash).not.toBe(recipe.contentHash);
    expect(policy?.rules.find((entry) => entry.ruleId === "motor.external.gate-network")).toEqual(expect.objectContaining({
      criticality: "safety",
      presence: "required",
    }));

    const estimate = recipe.estimate(outcome.value, constraints, environment);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: recipe.id,
      libraryVersion: String((environment.manifest as { version: string }).version),
      data: outcome.value.data,
      components: outcome.value.components,
      derivedValues: outcome.value.derivedValues,
      constraints,
      metrics: {
        values: estimate.metrics,
        warningCount: constraints.filter((entry) => entry.status === "warning").length,
        estimateCount: estimate.metrics.filter((entry) => entry.state === "estimated").length,
        unknownCount: constraints.filter((entry) => entry.status === "unknown").length,
      },
      simulationCoverage: outcome.value.simulationCoverage,
      warnings: outcome.value.warnings,
    };
    const materialized = recipe.materialize(candidate, environment);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    const assembly = materialized.circuit.circuits.find((circuit) => circuit.id === "assembly")!;
    expect(assembly.components.some((component) => component.id === "gate-resistor")).toBe(false);
    expect(assembly.wires).toEqual(expect.arrayContaining([
      { id: "gate-drive-direct-to-bridge", points: [[52, 28], [76, 28]] },
    ]));
    expect(assembly.wires.some((wire) => wire.id === "gate-drive-before-resistor" || wire.id === "gate-drive-to-bridge")).toBe(false);

    const unexpectedGateData = recipe.solve({
      data: { ...options[0]!.data, gateResistorProfileId: options[0]!.data.pulldownProfileId! },
    }, environment);
    if (unexpectedGateData.status !== "ok") throw new Error(`Expected direct-gate drift solve: ${unexpectedGateData.reason}`);
    expect(recipe.match(unexpectedGateData.value, environment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/must not bind a series gate-resistor data key/),
    }));

    const hashDriftEnvironment = structuredClone(environment);
    const hashDriftDriver = hashDriftEnvironment.catalog.profiles.find((profile) => (
      profile.partClass === "motor.full-bridge-gate-driver"
      && profile.part.manufacturerPartNumber === "MIC4606-2YML-T5"
    ))!;
    (hashDriftDriver.facts as any).bridgeTopology.explanation += " Tampered after review.";
    expect(recipe.enumerate(hashDriftEnvironment)).toEqual([]);
    expect(recipe.match(solved.value, hashDriftEnvironment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/requires the hash-bound MIC4606-2YML-T5 profile/),
    }));

    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED).toMatchObject({
      version: "3.1.3",
      contentHash: "sha256:8fc5d70793b391cc7d67746f6d7a413a6f08574688c9294fda634858a17d8c1a",
    });
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED.enumerate(environment)).toEqual([]);
  });

  it("splits exact-driver bootstrap and VDD-local MLCC roles without claiming capacitor adequacy", () => {
    const environment = bundledRoleQualifiedExternalEnvironment();
    const recipe = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED;
    expect(recipe).toMatchObject({
      id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      version: "3.1.5",
      contentHash: "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187",
    });
    expect(MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH)
      .toBe("sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135");

    const profileIdForMpn = (mpn: string) => {
      const profile = environment.catalog.profiles.find((candidate) => candidate.part.manufacturerPartNumber === mpn);
      if (profile === undefined) throw new Error(`Missing exact reviewed profile ${mpn}`);
      return designProfilePath(profile.partClass, profile.part);
    };
    const bootstrapId = profileIdForMpn("GRM31CR61H106KA12L");
    const localId = profileIdForMpn("CL31A106KBHNNNE");
    const exactMinimumId = profileIdForMpn("C1608X7R1H104K080AA");
    for (const [mpn, expectedHash] of [
      ["GRM31CR61H106KA12L", "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992"],
      ["CL31A106KBHNNNE", "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99"],
      ["C3216X7R1H106K160AC", "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd"],
    ] as const) {
      const profile = environment.catalog.profiles.find((candidate) => candidate.part.manufacturerPartNumber === mpn)!;
      expect(designProfileEnvelopeContentHash(profile)).toBe(expectedHash);
    }

    const options = recipe.enumerate(environment);
    expect(options).toHaveLength(108);
    expect(recipe.enumerate({
      ...environment,
      catalog: { profiles: [...environment.catalog.profiles].reverse() },
    })).toEqual(options);
    expect(new Set(options.map((option) => option.data.bootstrapProfileId))).toHaveLength(3);
    expect(new Set(options.map((option) => option.data.localProfileId))).toHaveLength(3);
    expect(options.every((option) => (
      option.data.bootstrapProfileId !== exactMinimumId
      && option.data.localProfileId !== exactMinimumId
      && typeof option.data.bulkProfileId === "string"
      && !Object.hasOwn(option.data, "gateResistorProfileId")
    ))).toBe(true);

    const selectedOption = options.find((option) => (
      option.data.bootstrapProfileId === bootstrapId
      && option.data.localProfileId === localId
    ));
    if (selectedOption === undefined) throw new Error("Missing independent bootstrap/local exact option");
    const solved = recipe.solve(selectedOption, environment);
    if (solved.status !== "ok") throw new Error(`Expected capacitor-role solve: ${solved.reason}`);
    const outcome = recipe.match(solved.value, environment)[0]!;
    if (outcome.status !== "ok") throw new Error(`Expected capacitor-role match: ${outcome.reason}`);
    expect(outcome.value.data).toMatchObject({
      bootstrapProfileId: bootstrapId,
      localProfileId: localId,
    });
    expect(outcome.value.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bootstrap-capacitor", profileId: bootstrapId, quantityPerAssembly: 2 }),
      expect.objectContaining({ id: "local-decoupling", profileId: localId, quantityPerAssembly: 1 }),
    ]));
    expect(outcome.value.components.some((component) => component.id === "gate-resistor")).toBe(false);

    const constraints = recipe.check(outcome.value, environment);
    for (const [ruleId, limit] of [
      ["motor.external.bootstrap-capacitance-nominal", 0.1e-6],
      ["motor.external.local-capacitance-nominal", 1e-6],
    ] as const) {
      expect(constraints.find((constraint) => constraint.ruleId === ruleId)).toEqual(expect.objectContaining({
        status: "pass",
        limit: { value: limit, unit: "F", displayUnit: "F" },
        explanation: expect.stringMatching(/nameplate.*not an effective-capacitance/i),
        evidence: expect.arrayContaining([expect.objectContaining({
          sourceId: "microchip-mic4606-ds20005604h",
          retrievedAt: "2026-08-26T01:11:06Z",
          contentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
          locator: expect.stringMatching(/physical PDF pages 25-26, section 7\.10.*0\.1 uF.*1 uF.*QGATE.*IHBS\*tON.*short, wide traces/),
        })]),
      }));
    }
    expect(constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown", explanation: expect.stringMatching(/QGATE and IHBS\*tON equations are not evaluated/) }),
      expect.objectContaining({ ruleId: "motor.external.bulk-capacitance", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.capacitor-placement", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.gate-network", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.local-capacitance-effective", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.local-voltage-rating", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.passive-derating", status: "unknown" }),
      expect.objectContaining({ ruleId: "motor.external.switching-and-loss", status: "unknown" }),
    ]));

    const estimate = recipe.estimate(outcome.value, constraints, environment);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: recipe.id,
      libraryVersion: String((environment.manifest as { version: string }).version),
      data: outcome.value.data,
      components: outcome.value.components,
      derivedValues: outcome.value.derivedValues,
      constraints,
      metrics: {
        values: estimate.metrics,
        warningCount: constraints.filter((entry) => entry.status === "warning").length,
        estimateCount: estimate.metrics.filter((entry) => entry.state === "estimated").length,
        unknownCount: constraints.filter((entry) => entry.status === "unknown").length,
      },
      simulationCoverage: outcome.value.simulationCoverage,
      warnings: outcome.value.warnings,
    };
    const materialized = recipe.materialize(candidate, environment);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    const assembly = materialized.circuit.circuits.find((circuit) => circuit.id === "assembly")!;
    expect(assembly.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bootstrap-capacitor", mpn: "GRM31CR61H106KA12L" }),
      expect.objectContaining({ id: "local-decoupling", mpn: "CL31A106KBHNNNE" }),
    ]));
    expect(assembly.components.some((component) => component.id === "gate-resistor")).toBe(false);
    expect(materialized.circuitInstanceClassifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ circuitId: "assembly", componentId: "bootstrap-capacitor", representedQuantityPerAssembly: 2 }),
      expect.objectContaining({ circuitId: "assembly", componentId: "local-decoupling", representedQuantityPerAssembly: 1 }),
    ]));

    const swappedBom = structuredClone(candidate);
    const bootstrapComponent = swappedBom.components.find((component) => component.id === "bootstrap-capacitor")!;
    const localComponent = swappedBom.components.find((component) => component.id === "local-decoupling")!;
    bootstrapComponent.profileId = localComponent.profileId;
    bootstrapComponent.part = structuredClone(localComponent.part);
    expect(() => recipe.materialize(swappedBom, environment)).toThrow(/BOM binding drifted for bootstrap-capacitor/);

    for (const key of ["bootstrapProfileId", "localProfileId"] as const) {
      const belowFloor = recipe.solve({ data: { ...selectedOption.data, [key]: exactMinimumId } }, environment);
      if (belowFloor.status !== "ok") throw new Error(`Expected forged ${key} solve: ${belowFloor.reason}`);
      expect(recipe.match(belowFloor.value, environment)[0]).toEqual(expect.objectContaining({
        status: "rejected",
        reason: expect.stringMatching(key === "bootstrapProfileId" ? /bootstrap capacitor.*above.*0\.1 uF/i : /VDD-local capacitor.*above.*1 uF/i),
      }));
    }

    const hashDriftEnvironment = structuredClone(environment);
    const hashDriftDriver = hashDriftEnvironment.catalog.profiles.find((profile) => (
      profile.partClass === "motor.full-bridge-gate-driver"
      && profile.part.manufacturerPartNumber === "MIC4606-2YML-T5"
    ))!;
    (hashDriftDriver.facts as any).bridgeTopology.explanation += " Tampered after review.";
    expect(recipe.enumerate(hashDriftEnvironment)).toEqual([]);

    const capacitorHashDriftEnvironment = structuredClone(environment);
    const hashDriftBootstrap = capacitorHashDriftEnvironment.catalog.profiles.find((profile) => (
      profile.partClass === "shared.mlcc-capacitor"
      && profile.part.manufacturerPartNumber === "GRM31CR61H106KA12L"
    ))!;
    (hashDriftBootstrap.facts as any).nominalCapacitance.explanation += " Tampered after review.";
    const capacitorHashDriftOptions = recipe.enumerate(capacitorHashDriftEnvironment);
    expect(capacitorHashDriftOptions).toHaveLength(48);
    expect(capacitorHashDriftOptions.every((option) => (
      option.data.bootstrapProfileId !== bootstrapId
      && option.data.localProfileId !== bootstrapId
    ))).toBe(true);
    expect(recipe.match(solved.value, capacitorHashDriftEnvironment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/bootstrap capacitor.*above.*0\.1 uF/i),
    }));

    const unlistedEnvironment = structuredClone(environment);
    const listedTemplate = unlistedEnvironment.catalog.profiles.find((profile) => (
      profile.partClass === "shared.mlcc-capacitor"
      && profile.part.manufacturerPartNumber === "C3216X7R1H106K160AC"
    ))!;
    const unlistedMpn = "UNLISTED-10UF-MLCC";
    const unlistedProfile = {
      ...structuredClone(listedTemplate),
      part: { ...listedTemplate.part, manufacturerPartNumber: unlistedMpn },
    };
    unlistedEnvironment.catalog.profiles.push(unlistedProfile);
    expect(recipe.enumerate(unlistedEnvironment)).toEqual(options);
    const unlistedId = designProfilePath(unlistedProfile.partClass, unlistedProfile.part);
    const unlistedSolved = recipe.solve({
      data: { ...selectedOption.data, bootstrapProfileId: unlistedId },
    }, unlistedEnvironment);
    if (unlistedSolved.status !== "ok") throw new Error(`Expected unlisted-capacitor solve: ${unlistedSolved.reason}`);
    expect(recipe.match(unlistedSolved.value, unlistedEnvironment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/bootstrap capacitor.*above.*0\.1 uF/i),
    }));

    const scalableClasses = new Set([
      "motor.supply-tvs-diode",
      "shared.bulk-capacitor",
      "shared.current-sense-resistor",
      "shared.n-channel-power-mosfet",
    ]);
    const oversizedProfiles = environment.catalog.profiles.flatMap((profile) => (
      scalableClasses.has(profile.partClass)
        ? Array.from({ length: 3 }, (_, index) => ({
            ...structuredClone(profile),
            part: { ...profile.part, manufacturerPartNumber: `${profile.part.manufacturerPartNumber}-${index}` },
          }))
        : [profile]
    ));
    expect(() => recipe.enumerate({ ...environment, catalog: { profiles: oversizedProfiles } }))
      .toThrowError(new RangeError(`${recipe.id}:enumerate:resource_limit:8748>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`));

    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE).toMatchObject({
      version: "3.1.4",
      contentHash: "sha256:c8145e32480a29e0d9d008ac7e73ff73f9b93cb08aa2f7f0919f199af4955d84",
    });
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE.enumerate(environment)).toHaveLength(60);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED).toMatchObject({
      version: "3.1.3",
      contentHash: "sha256:8fc5d70793b391cc7d67746f6d7a413a6f08574688c9294fda634858a17d8c1a",
    });
  });

  it("exact-binds the 33 V Diodes TVS while preserving the unimplemented MIC4606 VDD rail and transient coordination blockers", () => {
    const outOfRangeEnvironment = bundledRoleQualifiedExternalEnvironment();
    if (outOfRangeEnvironment.request.application !== "motor.brushed-dc") throw new Error("Expected a Motor request");
    expect(outOfRangeEnvironment.request.requirements.ambientTemperature).toEqual({ value: 313.15, unit: "K", displayUnit: "°C" });
    const environment = structuredClone(outOfRangeEnvironment);
    environment.request.requirements.ambientTemperature = { value: 298.15, unit: "K", displayUnit: "°C" };
    const capacitorPredecessor = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED;
    const predecessor = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_INTERFACE_QUALIFIED;
    const recipe = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED;
    expect(capacitorPredecessor).toMatchObject({
      version: "3.1.5",
      contentHash: "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187",
    });
    expect(predecessor).toMatchObject({
      version: "3.1.6",
      contentHash: "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320",
    });
    expect(recipe).toMatchObject({
      id: predecessor.id,
      version: "3.1.7",
      contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
    });

    const options = recipe.enumerate(environment);
    expect(options).toHaveLength(54);
    expect(options.every((option) => option.data.tvsProfileId === "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json")).toBe(true);
    const option = options[0]!;
    const solved = recipe.solve(option, environment);
    if (solved.status !== "ok") throw new Error(`Expected interface-qualified solve: ${solved.reason}`);
    const outcome = recipe.match(solved.value, environment)[0]!;
    if (outcome.status !== "ok") throw new Error(`Expected interface-qualified match: ${outcome.reason}`);
    const constraints = recipe.check(outcome.value, environment);

    expect(constraints.filter((constraint) => constraint.status === "fail")).toEqual([]);
    expect(constraints.filter((constraint) => constraint.status === "pass")).toHaveLength(11);
    expect(constraints.filter((constraint) => constraint.status === "unknown")).toHaveLength(19);
    if (environment.request.application !== "motor.brushed-dc") throw new Error("Expected a Motor request");
    const requestedBusMaximumV = environment.request.requirements.supplyVoltage.maximum.value;
    for (const [ruleId, measured, limit] of [
      ["motor.external.driver-switch-node-operating-minimum", 0, -0.3],
      ["motor.external.driver-switch-node-operating-maximum", requestedBusMaximumV, 85],
      ["motor.external.driver-switch-node-absolute-maximum", requestedBusMaximumV, 90],
    ] as const) {
      expect(constraints.find((constraint) => constraint.ruleId === ruleId)).toEqual(expect.objectContaining({
        status: "pass",
        actual: { value: measured, unit: "V", displayUnit: "V" },
        limit: { value: limit, unit: "V", displayUnit: "V" },
        explanation: expect.stringMatching(/nominal 0 V-to-requested-bus xHS excursion.*recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved elsewhere/),
      }));
    }
    expect(constraints.map((constraint) => constraint.ruleId)).not.toEqual(expect.arrayContaining([
      "motor.external.driver-absolute-maximum",
      "motor.external.driver-supply-maximum",
      "motor.external.driver-supply-minimum",
    ]));
    expect(constraints.find((constraint) => constraint.ruleId === "motor.external.driver-bias-source")).toEqual(expect.objectContaining({
      status: "unknown",
      explanation: expect.stringMatching(/does not implement a VDD driver-bias rail.*reviewed VDD minimum and maximum.*Switch-node range coverage is separate/),
    }));
    expect(constraints.find((constraint) => constraint.ruleId === "motor.external.tvs-stand-off")).toEqual(expect.objectContaining({
      status: "pass",
      actual: { value: 33, unit: "V", displayUnit: "V" },
      limit: { value: requestedBusMaximumV, unit: "V", displayUnit: "V" },
    }));

    const outOfRangeOption = recipe.enumerate(outOfRangeEnvironment)[0]!;
    const outOfRangeSolved = recipe.solve(outOfRangeOption, outOfRangeEnvironment);
    if (outOfRangeSolved.status !== "ok") throw new Error(`Expected out-of-range solve: ${outOfRangeSolved.reason}`);
    const outOfRangeOutcome = recipe.match(outOfRangeSolved.value, outOfRangeEnvironment)[0]!;
    if (outOfRangeOutcome.status !== "ok") throw new Error(`Expected out-of-range match: ${outOfRangeOutcome.reason}`);
    const outOfRangeConstraints = recipe.check(outOfRangeOutcome.value, outOfRangeEnvironment);
    expect(outOfRangeConstraints.filter((constraint) => constraint.status === "fail")).toEqual([]);
    expect(outOfRangeConstraints.filter((constraint) => constraint.status === "pass")).toHaveLength(9);
    expect(outOfRangeConstraints.filter((constraint) => constraint.status === "unknown")).toHaveLength(21);
    expect(outOfRangeConstraints.find((constraint) => constraint.ruleId === "motor.external.tvs-stand-off")).toEqual(expect.objectContaining({
      status: "unknown",
      explanation: "The reviewed TVS stand-off-voltage conditions do not cover the declared ambient point, so normal-bus non-conduction is unproved.",
      evidence: expect.arrayContaining([expect.objectContaining({
        sourceId: "diodes-incorporated-3-0smcj-automotive-ds40742",
        contentHash: MOTOR_EXTERNAL_V31_TVS_SOURCE_CONTENT_HASH,
      })]),
    }));
    for (const [ruleId, limit] of [
      ["motor.external.tvs-published-clamp-mosfet-limit", 60],
      ["motor.external.tvs-published-clamp-driver-switch-node-limit", 90],
    ] as const) {
      expect(constraints.find((constraint) => constraint.ruleId === ruleId)).toEqual(expect.objectContaining({
        status: "pass",
        actual: { value: 53.3, unit: "V", displayUnit: "V" },
        limit: { value: limit, unit: "V", displayUnit: "V" },
        explanation: expect.stringMatching(/25 C, 56\.3 A.*non-repetitive 10 x 1000 us.*does not prove the application's transient current, waveform, energy/),
        evidence: expect.arrayContaining([expect.objectContaining({
          sourceId: "diodes-incorporated-3-0smcj-automotive-ds40742",
          contentHash: MOTOR_EXTERNAL_V31_TVS_SOURCE_CONTENT_HASH,
        })]),
      }));
    }
    expect(constraints.find((constraint) => constraint.ruleId === "motor.external.tvs-coordination")).toEqual(expect.objectContaining({
      status: "unknown",
      explanation: expect.stringMatching(/do not bind the application's transient current, waveform, pulse energy.*full TVS coordination remains unproved/),
    }));
    expect(MOTOR_EXTERNAL_V31_TVS_PROFILE_CONTENT_HASH).toBe("sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474");
    expect(MOTOR_EXTERNAL_V31_TVS_SOURCE_URL).toBe("https://www.diodes.com/datasheet/download/ds40742.pdf");

    const legacyTvsOption = {
      ...option,
      data: { ...option.data, tvsProfileId: "packages/design-library/parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json" },
    };
    const legacySolved = recipe.solve(legacyTvsOption, environment);
    if (legacySolved.status !== "ok") throw new Error(`Expected legacy-TVS tamper solve: ${legacySolved.reason}`);
    expect(recipe.match(legacySolved.value, environment)[0]).toEqual(expect.objectContaining({
      status: "rejected",
      reason: expect.stringMatching(/exact external-NMOS.*profile is absent/i),
    }));
  });

  it("materializes the V3.1 external bridge as a deterministic connected exact-BOM structural graph", () => {
    const environment = mixedV31ExternalEnvironment();
    const enumerated = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.enumerate(environment);
    expect(enumerated).toHaveLength(1);
    const solved = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.solve(enumerated[0]!, environment);
    if (solved.status !== "ok") throw new Error(`Expected V3.1 external solve: ${solved.reason}`);
    const outcome = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.match(solved.value, environment)[0]!;
    if (outcome.status !== "ok") throw new Error(`Expected V3.1 external match: ${outcome.reason}`);
    const constraints = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.check(outcome.value, environment);
    const estimate = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.estimate(outcome.value, constraints, environment);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.id,
      libraryVersion: String((environment.manifest as { version: string }).version),
      data: outcome.value.data,
      components: outcome.value.components,
      derivedValues: outcome.value.derivedValues,
      constraints,
      metrics: {
        values: estimate.metrics,
        warningCount: constraints.filter((entry) => entry.status === "warning").length,
        estimateCount: estimate.metrics.filter((entry) => entry.state === "estimated").length,
        unknownCount: constraints.filter((entry) => entry.status === "unknown").length + estimate.metrics.filter((entry) => entry.state === "unknown").length,
      },
      simulationCoverage: outcome.value.simulationCoverage,
      warnings: outcome.value.warnings,
    };
    const materialized = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.materialize(candidate, environment);
    expect(MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31.materialize(candidate, environment)).toEqual(materialized);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuit.circuits.map((circuit) => circuit.id)).toEqual(["assembly", "behavioral-operating-point"]);
    expect(materialized.circuit.defaultCircuitId).toBe("assembly");
    expect(materialized.circuit.scenarios).toEqual([
      expect.objectContaining({ id: "pwm_loaded_steady_state", circuitId: "behavioral-operating-point", config: { mode: "op" } }),
    ]);
    expect(materialized.circuit.defaultScenarioId).toBe("pwm_loaded_steady_state");
    expect(materialized.circuit.circuits[0]!.wires.map((wire) => wire.id)).toEqual(expect.arrayContaining([
      "control-bus",
      "gate-drive-to-bridge",
      "motor-output-bus",
      "return-through-sense",
      "supply-bulk",
    ]));
    expect(materialized.circuit.circuits[0]!.wires.length).toBeGreaterThan(0);

    const exactBlocks = materialized.circuit.circuits[0]!.components
      .filter((component) => component.type === "design_block")
      .map((component) => [component.id, component.mpn, component.block.id]);
    expect(exactBlocks).toEqual([
      ["driver", "MIC4606-2YML-T5", "motor.full-bridge-gate-driver.exact-part"],
      ["mosfet", "CSD18540Q5B", "shared.n-channel-power-mosfet.quad-bridge"],
      ["supply-tvs", "PTVS10-058C-SH", "motor.supply-tvs-diode.exact-part"],
    ]);
    expect(materialized.circuit.designBlocks).toHaveLength(3);
    for (const block of materialized.circuit.designBlocks) {
      expect(block.netlist).toEqual({
        kind: "schematic_only",
        reason: expect.stringMatching(/No reviewed executable model/),
      });
    }
    const behavioralGraph = materialized.circuit.circuits[1]!;
    expect(behavioralGraph.components.every((component) => component.type !== "design_block" && !("mpn" in component))).toBe(true);
    expect(materialized.circuitInstanceClassifications.filter((entry) => entry.circuitId === behavioralGraph.id)).toHaveLength(behavioralGraph.components.length);
    expect(materialized.circuitInstanceClassifications
      .filter((entry) => entry.circuitId === behavioralGraph.id)
      .every((entry) => entry.kind === "non_bom")).toBe(true);
    expect(materialized.circuitBomNonRepresentations.map((entry) => entry.selectedComponentId)).toEqual(
      outcome.value.components.map((component) => component.id).sort(),
    );
    expect(materialized.circuitBomNonRepresentations.every((entry) => entry.circuitId === behavioralGraph.id)).toBe(true);
    const generated = generateScenarioNetlist(materialized.circuit, "pwm_loaded_steady_state");
    expect(generated.omissions).toEqual([]);
    expect(generated.netlist).toContain(".op\n.end\n");
    const value = (id: string) => {
      const component = behavioralGraph.components.find((entry) => entry.id === id);
      return component && "value" in component ? Number(component.value) : Number.NaN;
    };
    const requestCurrent = environment.request.application === "motor.brushed-dc"
      ? environment.request.requirements.operatingPoint.loadCurrent.value
      : Number.NaN;
    expect((value("v-bridge-average") - value("v-motor-back-emf")) / value("r-motor-winding")).toBeCloseTo(requestCurrent, 12);
    expect(materialized.circuitInstanceClassifications).toHaveLength(
      materialized.circuit.circuits.reduce((total, circuit) => total + circuit.components.length, 0),
    );
    for (const component of outcome.value.components) {
      const represented = materialized.circuitInstanceClassifications
        .reduce((total, entry) => entry.kind === "physical" && entry.selectedComponentId === component.id
          ? total + entry.representedQuantityPerAssembly
          : total, 0);
      expect(represented).toBe(component.quantityPerAssembly);
      const instance = materialized.circuit.circuits[0]!.components.find((entry) => entry.id === component.id)!;
      expect(instance.mpn).toBe(component.part.manufacturerPartNumber);
    }
  });

  it("materializes only exact passive quantities and explicitly leaves semiconductors and TVS unrepresented", () => {
    const exactEnvironment = externalEnvironment(v2Documents());
    const result = runExternal(exactEnvironment);
    const candidate: NativeCandidateV2 = {
      id: `candidate:v2:sha256:${"0".repeat(64)}`,
      recipeId: MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.id,
      libraryVersion: String((exactEnvironment.manifest as { version: string }).version),
      data: result.matched.data,
      components: result.matched.components,
      derivedValues: result.matched.derivedValues,
      constraints: result.constraints,
      metrics: { values: result.estimate.metrics, warningCount: 0, estimateCount: 0, unknownCount: result.constraints.filter((entry) => entry.status === "unknown").length },
      simulationCoverage: result.matched.simulationCoverage,
      warnings: [],
    };
    const materialized = MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.materialize(candidate, exactEnvironment);
    expect(validateCircuitV4(materialized.circuit)).toEqual([]);
    expect(materialized.circuitInstanceClassifications.filter((entry) => entry.kind === "physical").map((entry) => entry.representedQuantityPerAssembly)).toEqual([2, 1, 1, 4, 1, 4]);
    expect(materialized.circuitBomNonRepresentations.map((entry) => entry.selectedComponentId)).toEqual(["driver", "mosfet", "supply-tvs"]);
  });

  it("preflights the exact full-BOM Cartesian work before allocating external options", () => {
    const base = externalEnvironment(v2Documents());
    const required = new Set(CLASSES.filter((partClass) => partClass !== "motor.integrated-h-bridge"));
    const profiles = base.catalog.profiles
      .filter((profile) => required.has(profile.partClass as never))
      .flatMap((profile) => Array.from({ length: 4 }, (_, index) => ({
        ...structuredClone(profile),
        part: { ...profile.part, manufacturerPartNumber: `${profile.part.manufacturerPartNumber}-${index}` },
      })));
    const over = { ...base, catalog: { profiles } };
    const expected = `${MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.id}:enumerate:resource_limit:65536>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`;
    expect(() => MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.enumerate(over)).toThrowError(new RangeError(expected));
    expect(() => MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2.enumerate({ ...over, catalog: { profiles: [...profiles].reverse() } })).toThrowError(new RangeError(expected));
  });
});
