import type { CircuitComponentV2, CircuitDocumentV2 } from "@opencircuit/circuit-schema";
import { FACTS_SCHEMA_VERSION, designProfileId, getDesignProfileCodec, parseDesignProfileFor, type DesignProfileV1, type PartClassId, type ProfileEvidenceRef, type ProfileFact, type ProfileQuantity } from "@opencircuit/design-library/v2-runtime";
import { compareDesignV2Tokens, type ConstraintResult, type EvidenceRef, type Quantity, type SelectedComponent } from "@opencircuit/design-schema";
import type { NativeCandidateV2, NativeCatalogV2, NativeMaterializationV2 } from "./types";

type AnyFact = ProfileFact<unknown>;

export function legacyProfiles(catalog: Readonly<NativeCatalogV2>): DesignProfileV1[] {
  return catalog.profiles.filter(
    (profile): profile is DesignProfileV1 => profile.factsSchemaVersion === FACTS_SCHEMA_VERSION,
  );
}

export function profilesFor<ClassId extends PartClassId>(catalog: Readonly<NativeCatalogV2>, partClass: ClassId): DesignProfileV1<ClassId, object>[] {
  const codec = getDesignProfileCodec(partClass);
  return catalog.profiles
    .filter((profile) => profile.factsSchemaVersion === FACTS_SCHEMA_VERSION && profile.partClass === partClass)
    .map((profile) => {
      const typed = parseDesignProfileFor(codec, profile);
      if (codec.validateAdmission(typed).length > 0) throw new TypeError(`Profile no longer satisfies ${partClass} admission`);
      return typed;
    })
    .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
}

export function fact(profile: DesignProfileV1, factId: string): AnyFact {
  const value = (profile.facts as Record<string, unknown>)[factId];
  if (!value || typeof value !== "object") throw new TypeError(`Missing reviewed fact ${factId}`);
  return value as AnyFact;
}

export function numberFact(profile: DesignProfileV1, factId: string): number {
  const value = fact(profile, factId).value as ProfileQuantity | null;
  if (!value || !Number.isFinite(value.value)) throw new TypeError(`Missing reviewed quantity ${factId}`);
  return value.value;
}

export function projectedEvidence(input: readonly ProfileEvidenceRef[]): EvidenceRef[] {
  return input.map((entry) => ({
    sourceId: entry.sourceId,
    locator: entry.locator,
    ...(entry.retrievedAt === null ? {} : { retrievedAt: entry.retrievedAt }),
    ...(entry.contentHash === null ? {} : { contentHash: entry.contentHash }),
    licenseNote: entry.licenseNote,
  }));
}

export function evidenceFor(profile: DesignProfileV1, factId: string): EvidenceRef[] {
  return projectedEvidence(fact(profile, factId).evidence);
}

export function selected(id: string, role: string, profile: DesignProfileV1, factId?: string): SelectedComponent {
  const base: SelectedComponent = {
    id,
    role,
    profileId: designProfileId(profile.partClass, profile.part),
    part: { ...profile.part },
    quantityPerAssembly: 1,
    evidence: factId ? evidenceFor(profile, factId) : projectedEvidence(profile.commonFacts.packageName.evidence),
  };
  if (!factId) return base;
  const source = fact(profile, factId).value as ProfileQuantity;
  return { ...base, value: { value: source.value, unit: source.unit as Quantity["unit"], displayUnit: source.displayUnit } };
}

export function limitConstraint(ruleId: string, actual: Quantity, limit: Quantity, direction: "at_least" | "at_most", evidence: EvidenceRef[], explanation: string): ConstraintResult {
  const marginValue = direction === "at_least" ? actual.value - limit.value : limit.value - actual.value;
  return {
    ruleId,
    status: marginValue >= 0 ? "pass" : "fail",
    actual,
    limit,
    margin: { value: marginValue, unit: actual.unit, displayUnit: actual.displayUnit },
    explanation,
    evidence,
  };
}

export function unknownConstraint(ruleId: string, explanation: string, evidence: EvidenceRef[] = []): ConstraintResult {
  return { ruleId, status: "unknown", explanation, evidence };
}

function passiveType(role: string): "capacitor" | "inductor" | "resistor" {
  if (role.includes("capacitor") || role.includes("decoupling")) return "capacitor";
  if (role.includes("inductor")) return "inductor";
  return "resistor";
}

export function materializeBom(candidate: Readonly<NativeCandidateV2>, title: string, nonRepresentedIds: ReadonlySet<string>): NativeMaterializationV2 {
  const physical = candidate.components.filter((entry) => !nonRepresentedIds.has(entry.id));
  const components: CircuitComponentV2[] = [
    { id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false },
    ...physical.map((entry, index) => ({
      id: `bom-${String(index + 1).padStart(2, "0")}`,
      type: passiveType(entry.role),
      value: entry.value?.value ?? 1,
      mpn: entry.part.manufacturerPartNumber,
      pos: [80 * (index + 1), 0] as [number, number],
      rot: 0 as const,
      mirror: false,
    })),
  ];
  const circuit: CircuitDocumentV2 = {
    format: "opencircuit-circuit",
    version: 2,
    meta: { title, description: "Deterministic BOM placement graph; executable semiconductor models are not yet admitted." },
    designBlocks: [],
    circuits: [{ id: "assembly", title: "BOM placement", components, wires: [], probes: [] }],
    scenarios: [],
    defaultCircuitId: "assembly",
    defaultScenarioId: null,
  };
  return {
    circuit,
    circuitInstanceClassifications: [
      { circuitId: "assembly", componentId: "ground", kind: "non_bom", reason: "Ground is a schematic reference, not a BOM line." },
      ...physical.map((entry, index) => ({ circuitId: "assembly", componentId: `bom-${String(index + 1).padStart(2, "0")}`, kind: "physical" as const, selectedComponentId: entry.id, representedQuantityPerAssembly: 1 })),
    ],
    circuitBomNonRepresentations: candidate.components
      .filter((entry) => nonRepresentedIds.has(entry.id))
      .map((entry) => ({ circuitId: "assembly", selectedComponentId: entry.id, reason: "No reviewed executable semiconductor model is bundled for this exact manufacturer part." })),
  };
}

export function totalBoardArea(components: readonly DesignProfileV1[]): number {
  return components.reduce((total, profile) => total + (profile.commonFacts.boardArea.value?.value ?? 0), 0);
}
