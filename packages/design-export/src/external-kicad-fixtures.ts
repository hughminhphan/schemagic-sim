import { existsSync, readFileSync } from "node:fs";
import {
  admissionContentHash,
  designCatalogContentHash,
  designProfileContentHash,
  designProfileId,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileV1,
  type DesignProfileAdmissionLedgerV1,
  type ManufacturerRegistryV1,
} from "@opencircuit/design-library";
import { createSyntheticReviewedLibraryFixture } from "@opencircuit/design-library/fixtures";
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
  migrateDesignRequestV1ToV2,
  type DesignRequestV1,
  type ElectricalDesignRequestV2,
} from "@opencircuit/design-schema";
import {
  exportDesignResultKicadSchematicV2,
  parseDesignResultKicadSchematicV2,
} from "./kicad-schematic-v2";
import type {
  ExternalKicadQaApplicationV1,
  ExternalKicadQaArtifactV1,
  ExternalKicadQaFixtureIdV1,
} from "./external-kicad-qa";

interface FixtureSpec {
  fixtureId: ExternalKicadQaFixtureIdV1;
  application: ExternalKicadQaApplicationV1;
  requestFile: "m1-compact.design-request.json" | "p1-compact.design-request.json";
  classes: Parameters<typeof createSyntheticReviewedLibraryFixture>[0];
  changes: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

const FIXTURES: readonly FixtureSpec[] = Object.freeze([
  {
    fixtureId: "motor-integrated-v2",
    application: "motor.brushed-dc",
    requestFile: "m1-compact.design-request.json",
    classes: ["motor.integrated-h-bridge", "shared.mlcc-capacitor", "shared.bulk-capacitor"],
    changes: {
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
  },
  {
    fixtureId: "power-integrated-v2",
    application: "power.buck",
    requestFile: "p1-compact.design-request.json",
    classes: [
      "power.integrated-synchronous-buck-regulator",
      "power.power-inductor",
      "shared.mlcc-capacitor",
      "shared.general-purpose-resistor",
    ],
    changes: {
      "power.integrated-synchronous-buck-regulator": {
        inputVoltageMaximum: 20,
        feedbackReference: 2.5,
        switchingFrequencyMaximum: 2_000_000,
      },
      "power.power-inductor": { saturationCurrent: 5, rmsCurrent: 5 },
      "shared.mlcc-capacitor": { ratedVoltage: 25 },
    },
  },
]);

function refreshedDocuments(spec: Readonly<FixtureSpec>): DesignLibraryDocuments {
  const documents = structuredClone(createSyntheticReviewedLibraryFixture(spec.classes)) as {
    manufacturerRegistry: ManufacturerRegistryV1;
    admission: DesignProfileAdmissionLedgerV1;
    catalogRelease: DesignCatalogReleaseV1;
    profiles: Record<string, DesignProfileV1>;
  };
  for (const profile of Object.values(documents.profiles) as DesignProfileV1[]) {
    const updates = spec.changes[profile.partClass] ?? {};
    const facts = profile.facts as Record<string, { value: { value: number } }>;
    for (const [factId, value] of Object.entries(updates)) {
      const fact = facts[factId];
      if (fact === undefined) throw new Error(`${spec.fixtureId}: missing fixture fact ${factId}`);
      fact.value.value = value;
    }
  }
  for (const entry of documents.admission.entries) {
    const profile = documents.profiles[entry.profilePath] as DesignProfileV1 | undefined;
    if (profile === undefined) throw new Error(`${spec.fixtureId}: missing admitted profile`);
    entry.profileContentHash = designProfileContentHash(profile);
  }
  documents.catalogRelease.admissionContentHash = admissionContentHash(documents.admission);
  for (const ref of documents.catalogRelease.profiles) {
    const profile = Object.values(documents.profiles).find(
      (entry) => designProfileId(entry.partClass, entry.part) === ref.profileId,
    );
    if (profile === undefined) throw new Error(`${spec.fixtureId}: missing release profile`);
    ref.profileContentHash = designProfileContentHash(profile);
  }
  documents.catalogRelease.contentHash = designCatalogContentHash(
    documents.manufacturerRegistry,
    documents.admission,
    Object.values(documents.profiles),
  );
  return documents;
}

function ranking(application: ExternalKicadQaApplicationV1): ElectricalRankingPolicyV2 {
  const prefix = application === "motor.brushed-dc" ? "motor" : "power";
  const area = { source: "metric", metricId: `${prefix}.native.board-area`, direction: "minimize" } as const;
  const count = { source: "metric", metricId: `${prefix}.native.component-count`, direction: "minimize" } as const;
  const payload: Omit<ElectricalRankingPolicyV2, "contentHash"> = {
    format: "schemagic-electrical-ranking-policy",
    schemaVersion: 2,
    version: `${prefix}-external-kicad-qa.1`,
    application,
    paretoCriteria: [area, count],
    rankingProfiles: {
      area: [area, count],
      balanced: [area, count],
      efficiency: [area, count],
      temperature: [area, count],
    },
  };
  return { ...payload, contentHash: calculateElectricalRankingPolicyV2ContentHash(payload) };
}

function context(
  application: ExternalKicadQaApplicationV1,
  documents: DesignLibraryDocuments,
): GenerateElectricalContextV2 {
  const rankingPolicy = ranking(application);
  const catalog = buildReviewedProfileCatalogV2(documents);
  const payload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
    format: "schemagic-electrical-design-context",
    schemaVersion: 2,
    version: catalog.version,
    application,
    compiler: getInstalledCompilerImplementationRefV2(),
    catalog: {
      version: catalog.version,
      contentHash: catalog.contentHash,
      sourceReleaseContentHash: catalog.sourceRelease.contentHash,
    },
    rankingPolicy: { version: rankingPolicy.version, contentHash: rankingPolicy.contentHash },
    recipes: [...getInstalledRecipeRefsV2(application)],
  };
  const manifest = { ...payload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(payload) };
  const installedRecipeRegistry = resolveInstalledRecipeRegistryV2(manifest);
  if (installedRecipeRegistry === undefined) throw new Error(`${application}: installed recipe registry unavailable`);
  return { manifest, catalogDocuments: documents, rankingPolicy, installedRecipeRegistry };
}

function requestFixtureUrl(name: FixtureSpec["requestFile"]): URL {
  const candidates = [
    new URL(`../../design-schema/test/fixtures/requests/${name}`, import.meta.url),
    new URL(`../../../design-schema/test/fixtures/requests/${name}`, import.meta.url),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error(`${name}: source request fixture unavailable`);
  return found;
}

function request(spec: Readonly<FixtureSpec>, libraryVersion: string): ElectricalDesignRequestV2 {
  const source = JSON.parse(readFileSync(requestFixtureUrl(spec.requestFile), "utf8")) as DesignRequestV1;
  const migration = migrateDesignRequestV1ToV2(source, libraryVersion);
  if (migration.status !== "migrated") throw new Error(`${spec.fixtureId}: source request did not migrate`);
  const migrated = structuredClone(migration.request);
  migrated.constraints.allowUnknownHardConstraints = true;
  return migrated;
}

function buildFixture(spec: Readonly<FixtureSpec>): ExternalKicadQaArtifactV1 {
  const documents = refreshedDocuments(spec);
  const engineeringContext = context(spec.application, documents);
  const generation = generateElectricalDesignV2(request(spec, engineeringContext.manifest.version), engineeringContext);
  const candidate = generation.result.candidates[0];
  const circuit = candidate?.circuit.circuits[0];
  if (candidate === undefined || circuit === undefined) {
    throw new Error(`${spec.fixtureId}: exact V2 fixture did not produce a circuit`);
  }
  const options = { engineeringContext, executionContext: {} } as const;
  const schematic = exportDesignResultKicadSchematicV2(
    generation.result,
    candidate.id,
    circuit.id,
    options,
  );
  parseDesignResultKicadSchematicV2(schematic, generation.result, options);
  return {
    fixtureId: spec.fixtureId,
    application: spec.application,
    candidateId: candidate.id,
    circuitId: circuit.id,
    designResultContentHash: generation.result.contentHash,
    engineeringContextContentHash: engineeringContext.manifest.contentHash,
    schematic,
  };
}

/**
 * Regenerates synthetic Motor and Power V2 fixtures from their exact catalog,
 * recipe, ranking, compiler, engineering, and execution contexts. These are QA
 * fixtures only; they are not admitted production-profile evidence.
 */
export function buildExternalKicadQaArtifactsV1(): ReadonlyArray<Readonly<ExternalKicadQaArtifactV1>> {
  return Object.freeze(FIXTURES.map((spec) => Object.freeze(buildFixture(spec))));
}
