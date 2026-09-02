import {
  calculateDesignBlockContentHash,
  type CircuitComponentV4,
  type CircuitDocumentV4,
  type DesignBlockDefinition,
} from "@opencircuit/circuit-schema";
import {
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V33,
  FACTS_SCHEMA_VERSION_V34,
  FACTS_SCHEMA_VERSION_V35,
  canonicalProfileNumberV2,
  designProfileEnvelopeContentHash,
  designProfileContentHashV34,
  designProfileId,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  parseDesignProfileV33,
  parseDesignProfileV34,
  parseDesignProfileV35,
  validateProfileAdmissionRulesV33,
  validateProfileAdmissionRulesV34,
  validateProfileAdmissionRulesV35,
  type DesignProfileV33,
  type DesignProfileV34,
  type DesignProfileV35,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
  type OperatingRange,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Number,
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
  type BuckDesignRequestV2,
  type CandidateMetricV2,
  type ConstraintResult,
  type Quantity,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import { limitConstraint, projectedEvidence, unknownConstraint } from "./common";
import {
  calculateIntegratedBuckCurrentLimitV1,
  calculateIntegratedBuckJunctionTemperatureV1,
  calculateIntegratedBuckLossV1,
} from "./power-integrated-calculators-v1";
import {
  powerPassiveCapacitorCandidateFromReviewedProfileV1,
  powerPassiveInductorCandidateFromReviewedProfileV1,
  selectPowerIntegratedBuckPassivesV1,
  type PowerPassiveCombinationV1,
  type PowerPassiveDiagnosticV1,
} from "./power-passive-selection-v1";
import type {
  NativeCandidateV2,
  NativeCatalogV2,
  NativeEnvironmentV2,
  NativeMatchedOptionV2,
  NativeMaterializationV2,
  NativeRecipeV2,
} from "./types";

const RELEASE = {
  id: "power.native.integrated-synchronous-buck.facts-v3-3",
  version: "3.3.1",
  equations: [
    "power.connected-structural-bom-binding.v1",
    "power.fixed-oscillator-selection.v3-3",
    "power.feedback-divider-corners.v3-3",
    "power.mounted-geometry-ranking-proxy.v2",
    "power.inductor.raw-output-current-lower-bound-fail.v1",
  ],
} as const;

const METRICS = [
  { id: "power.native.board-area", unit: "m2" as const },
  { id: "power.native.component-count", unit: "count" as const },
] as const;

const PASSIVE_OPERATING_OBSERVATION_METRICS = [
  { id: "power.passive.inductor-peak-current-observation", unit: "A" as const },
  { id: "power.passive.inductor-ripple-current-observation", unit: "A" as const },
  { id: "power.passive.inductor-rms-current-observation", unit: "A" as const },
  { id: "power.passive.output-capacitor-bank-rms-current-observation", unit: "A" as const },
] as const;

type PassiveOperatingObservationMetricId = typeof PASSIVE_OPERATING_OBSERVATION_METRICS[number]["id"];

type IntegratedProfileV33 = DesignProfileV33<"power.integrated-synchronous-buck-regulator">;
type IntegratedProfileV35 = DesignProfileV35<"power.integrated-synchronous-buck-regulator">;
type IntegratedProfile = IntegratedProfileV33 | IntegratedProfileV35;
type CapacitorProfileV2 = DesignProfileWithFactsV2<"shared.mlcc-capacitor", FactsV2For<"shared.mlcc-capacitor">>;
type CapacitorProfileV35 = DesignProfileV35<"shared.mlcc-capacitor">;
type CapacitorProfile = CapacitorProfileV2 | CapacitorProfileV35;
type InductorProfileV2 = DesignProfileWithFactsV2<"power.power-inductor", FactsV2For<"power.power-inductor">>;
type InductorProfileV34 = DesignProfileV34<"power.power-inductor">;
type InductorProfileV35 = DesignProfileV35<"power.power-inductor">;
type InductorProfile = InductorProfileV2 | InductorProfileV34 | InductorProfileV35;
type ResistorProfileV2 = DesignProfileWithFactsV2<"shared.general-purpose-resistor", FactsV2For<"shared.general-purpose-resistor">>;
type SelectedProfile = IntegratedProfile | CapacitorProfile | InductorProfile | ResistorProfileV2;

export type PowerIntegratedInductorContract = Readonly<
  | { factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V2 }
  | {
      factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V34;
      exactProfileContentHash: `sha256:${string}`;
    }
  | {
      factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V35;
      profileId: string;
    }
>;

export type PowerIntegratedOutputCapacitorContract = Readonly<
  | {
      readonly factsSchemaVersion?: typeof FACTS_SCHEMA_VERSION_V2;
      readonly exactProfileContentHash: `sha256:${string}`;
      readonly profileId?: never;
      readonly quantityPerAssembly: number;
    }
  | {
      readonly factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V35;
      readonly exactProfileContentHash?: never;
      readonly profileId: string;
      readonly quantityPerAssembly: number;
    }
>;

export interface PowerIntegratedStructuralRecipeConfig {
  readonly release: Readonly<{
    id: string;
    version: string;
    equations: readonly string[];
    profileBindings?: readonly Readonly<Record<string, unknown>>[];
  }>;
  readonly optionKeyPrefix: string;
  readonly primaryFactsSchemaVersion?: typeof FACTS_SCHEMA_VERSION_V33 | typeof FACTS_SCHEMA_VERSION_V35;
  readonly inductorContract: PowerIntegratedInductorContract;
  readonly outputCapacitorContract?: Readonly<PowerIntegratedOutputCapacitorContract>;
  readonly evaluatePassiveSelectionV1?: boolean;
  readonly surfacePassiveOperatingObservationsV1?: boolean;
  readonly omitLoadTransientConstraintWhenUnrequested?: boolean;
  readonly evaluateDcOutputVoltageRegulationEnvelope?: boolean;
  readonly currentLimitRequiredMarginRatio?: number;
  readonly thermalResistanceBoardQualifier?: "jedec_2s2p" | "declared";
}

interface DividerSelectionV33 {
  upper: ResistorProfileV2;
  lower: ResistorProfileV2;
  nominalOutputVoltage: number;
  lowCornerOutputVoltage: number;
  highCornerOutputVoltage: number;
}

interface InductorCurrentObservationV33 {
  rippleCurrent: number;
  peakCurrent: number;
  rmsCurrent: number;
  valleyCurrent: number;
  nominalPointSupported: boolean;
  unsupportedReason: string | null;
}

interface FeedbackResistorStressCheckV33 {
  key: string;
  actual: Quantity<"V"> | Quantity<"W">;
  limit: Quantity<"V"> | Quantity<"W">;
  supported: boolean;
}

interface FeedbackResistorStressObservationV33 {
  checks: FeedbackResistorStressCheckV33[];
  explanation: string;
  evidence: ProfileEvidenceRef[];
}

function q(value: number, unit: Quantity["unit"]): Quantity {
  return { value, unit, displayUnit: unit };
}

function canon(value: number): number {
  const design = canonicalDesignV2Number(value);
  const profile = canonicalProfileNumberV2(value);
  if (design !== profile) throw new Error("Design and profile canonical arithmetic diverged");
  return design;
}

function request(environment: Readonly<NativeEnvironmentV2>): Readonly<BuckDesignRequestV2> {
  if (environment.request.application !== "power.buck") throw new TypeError("Facts V3.3 integrated-buck recipe requires a power.buck request");
  return environment.request;
}

function v2Profiles<ClassId extends PartClassId>(
  catalog: Readonly<NativeCatalogV2>,
  partClass: ClassId,
): Array<DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>> {
  const codec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V2);
  return catalog.profiles
    .filter((profile) => profile.partClass === partClass && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2)
    .map((profile) => parseDesignProfileForV2(codec, profile))
    .map((profile) => {
      const issue = codec.validateAdmission(profile)[0];
      if (issue) throw new TypeError(`Invalid admitted facts-V2 ${partClass} profile: ${issue.path}: ${issue.message}`);
      return profile;
    })
    .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
}

function integratedProfiles(
  catalog: Readonly<NativeCatalogV2>,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V33 | typeof FACTS_SCHEMA_VERSION_V35,
): IntegratedProfile[] {
  return catalog.profiles
    .filter((profile) => profile.partClass === "power.integrated-synchronous-buck-regulator" && profile.factsSchemaVersion === factsSchemaVersion)
    .map((profile) => factsSchemaVersion === FACTS_SCHEMA_VERSION_V35
      ? parseDesignProfileV35(profile) as IntegratedProfileV35
      : parseDesignProfileV33(profile) as IntegratedProfileV33)
    .map((profile) => {
      const issue = profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V35
        ? validateProfileAdmissionRulesV35(profile)
        : validateProfileAdmissionRulesV33(profile);
      if (issue[0]) throw new TypeError(`Invalid admitted facts-${factsSchemaVersion} integrated regulator profile: ${issue[0].path}: ${issue[0].message}`);
      return profile;
    })
    .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
}

function inductorProfiles(
  catalog: Readonly<NativeCatalogV2>,
  contract: PowerIntegratedInductorContract,
): InductorProfile[] {
  if (contract.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) {
    return v2Profiles(catalog, "power.power-inductor");
  }
  if (contract.factsSchemaVersion === FACTS_SCHEMA_VERSION_V35) {
    return catalog.profiles
      .filter((profile) => profile.partClass === "power.power-inductor" && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V35)
      .map((profile) => parseDesignProfileV35(profile) as InductorProfileV35)
      .map((profile) => {
        const issue = validateProfileAdmissionRulesV35(profile)[0];
        if (issue) throw new TypeError(`Invalid admitted facts-V3.5 power-inductor profile: ${issue.path}: ${issue.message}`);
        return profile;
      })
      .filter((profile) => designProfileId(profile.partClass, profile.part) === contract.profileId)
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
  }
  return catalog.profiles
    .filter((profile) => profile.partClass === "power.power-inductor" && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V34)
    .map((profile) => parseDesignProfileV34(profile))
    .map((profile) => {
      const issue = validateProfileAdmissionRulesV34(profile)[0];
      if (issue) throw new TypeError(`Invalid admitted facts-V3.4 power-inductor profile: ${issue.path}: ${issue.message}`);
      return profile;
    })
    .filter((profile) => designProfileContentHashV34(profile) === contract.exactProfileContentHash)
    .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
}

function capacitorProfiles(catalog: Readonly<NativeCatalogV2>): CapacitorProfile[] {
  const v35 = catalog.profiles
    .filter((profile) => profile.partClass === "shared.mlcc-capacitor" && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V35)
    .map((profile) => parseDesignProfileV35(profile) as CapacitorProfileV35)
    .map((profile) => {
      const issue = validateProfileAdmissionRulesV35(profile)[0];
      if (issue) throw new TypeError(`Invalid admitted facts-V3.5 MLCC profile: ${issue.path}: ${issue.message}`);
      return profile;
    });
  return [...v2Profiles(catalog, "shared.mlcc-capacitor"), ...v35]
    .sort((left, right) => compareDesignV2Tokens(
      `${designProfileId(left.partClass, left.part)}\u0000${left.factsSchemaVersion}`,
      `${designProfileId(right.partClass, right.part)}\u0000${right.factsSchemaVersion}`,
    ));
}

function primaryFromData(
  data: Readonly<Record<string, null | boolean | number | string>>,
  catalog: Readonly<NativeCatalogV2>,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V33 | typeof FACTS_SCHEMA_VERSION_V35,
): IntegratedProfile | undefined {
  const id = data.primaryProfileId;
  return typeof id === "string"
    ? integratedProfiles(catalog, factsSchemaVersion).find((profile) => designProfileId(profile.partClass, profile.part) === id)
    : undefined;
}

function factQuantity<Unit extends ProfileQuantity["unit"]>(fact: Readonly<ProfileFact<ProfileQuantity<Unit>>>): ProfileQuantity<Unit> | undefined {
  return fact.state === "reviewed" && fact.value !== null ? fact.value : undefined;
}

function profileFactById(profile: Readonly<{ facts: object }>, factId: string): Readonly<ProfileFact<unknown>> | undefined {
  const fact = (profile.facts as Record<string, unknown>)[factId];
  return typeof fact === "object" && fact !== null ? fact as Readonly<ProfileFact<unknown>> : undefined;
}

function profileQuantityById<Unit extends ProfileQuantity["unit"]>(
  profile: Readonly<{ facts: object }>,
  factId: string,
): Readonly<ProfileFact<ProfileQuantity<Unit>>> | undefined {
  return profileFactById(profile, factId) as Readonly<ProfileFact<ProfileQuantity<Unit>>> | undefined;
}

function profileTextById(
  profile: Readonly<{ facts: object }>,
  factId: string,
): Readonly<ProfileFact<string>> | undefined {
  return profileFactById(profile, factId) as Readonly<ProfileFact<string>> | undefined;
}

function conditionRange(condition: Readonly<OperatingRange>): { minimum: number; maximum: number } | undefined {
  if (condition.minimum === null || condition.maximum === null) return undefined;
  return { minimum: condition.minimum.value, maximum: condition.maximum.value };
}

function conditionsCover(
  conditions: readonly OperatingRange[],
  designRequest: Readonly<BuckDesignRequestV2>,
  selectedSwitchingFrequency: number,
  selectedTestCurrent?: Readonly<{ minimum: number; maximum: number }>,
): boolean {
  return conditions.every((condition) => {
    const range = conditionRange(condition);
    if (!range) return false;
    switch (condition.parameterId) {
      case "ambientTemperature":
        return designRequest.requirements.ambientTemperature.value >= range.minimum
          && designRequest.requirements.ambientTemperature.value <= range.maximum;
      case "junctionTemperature":
        return designRequest.requirements.ambientTemperature.value >= range.minimum
          && designRequest.constraints.maximumJunctionTemperature.value <= range.maximum;
      case "supplyVoltage":
        return designRequest.requirements.inputVoltage.minimum.value >= range.minimum
          && designRequest.requirements.inputVoltage.maximum.value <= range.maximum;
      case "switchingFrequency":
        return selectedSwitchingFrequency >= range.minimum && selectedSwitchingFrequency <= range.maximum;
      case "testCurrent":
        return selectedTestCurrent !== undefined
          && selectedTestCurrent.minimum >= range.minimum
          && selectedTestCurrent.maximum <= range.maximum;
      default:
        return false;
    }
  });
}

function coveredQuantityById<Unit extends ProfileQuantity["unit"]>(
  profile: Readonly<{ facts: object }>,
  factId: string,
  designRequest: Readonly<BuckDesignRequestV2>,
  selectedSwitchingFrequency: number,
  selectedTestCurrent?: Readonly<{ minimum: number; maximum: number }>,
): ProfileQuantity<Unit> | undefined {
  const fact = profileQuantityById<Unit>(profile, factId);
  return fact !== undefined && conditionsCover(fact.validFor, designRequest, selectedSwitchingFrequency, selectedTestCurrent)
    ? factQuantity(fact)
    : undefined;
}

function coveredGuaranteedMaximumByRole<Unit extends ProfileQuantity["unit"]>(
  profile: Readonly<{ facts: object }>,
  factId: string,
  roleFactId: string,
  designRequest: Readonly<BuckDesignRequestV2>,
  selectedSwitchingFrequency: number,
): ProfileQuantity<Unit> | undefined {
  const role = profileTextById(profile, roleFactId);
  return role?.state === "reviewed" && role.value === "guaranteed_maximum"
    ? coveredQuantityById<Unit>(profile, factId, designRequest, selectedSwitchingFrequency)
    : undefined;
}

function evidence(...facts: ReadonlyArray<Readonly<ProfileFact<unknown>>>): ProfileEvidenceRef[] {
  return facts.flatMap((fact) => fact.evidence);
}

function selectedComponent(
  id: string,
  role: string,
  profile: SelectedProfile,
  valueFact?: Readonly<ProfileFact<ProfileQuantity>>,
  quantityPerAssembly = 1,
): SelectedComponent {
  const value = valueFact === undefined ? undefined : factQuantity(valueFact);
  return {
    id,
    role,
    profileId: designProfileId(profile.partClass, profile.part),
    part: { ...profile.part },
    quantityPerAssembly,
    ...(value === undefined ? {} : { value: q(value.value, value.unit as Quantity["unit"]) }),
    evidence: projectedEvidence(valueFact?.evidence ?? profile.commonFacts.packageName.evidence),
  };
}

function feedbackPoint(reference: number, upper: number, lower: number): number {
  return canon(reference * canon(1 + canon(upper / lower)));
}

function selectDivider(
  primary: IntegratedProfile,
  resistors: readonly ResistorProfileV2[],
  designRequest: Readonly<BuckDesignRequestV2>,
  selectedSwitchingFrequency: number,
): DividerSelectionV33 | undefined {
  const minimum = factQuantity(primary.facts.feedbackReferenceMinimum);
  const typical = factQuantity(primary.facts.feedbackReferenceTypical);
  const maximum = factQuantity(primary.facts.feedbackReferenceMaximum);
  if (!minimum || !typical || !maximum) return undefined;
  if (![primary.facts.feedbackReferenceMinimum, primary.facts.feedbackReferenceTypical, primary.facts.feedbackReferenceMaximum]
    .every((fact) => conditionsCover(fact.validFor, designRequest, selectedSwitchingFrequency))) return undefined;

  const values = resistors.map((profile) => ({
    profile,
    resistance: factQuantity(profile.facts.resistance)?.value,
    tolerance: factQuantity(profile.facts.tolerance)?.value,
  })).filter((entry): entry is { profile: ResistorProfileV2; resistance: number; tolerance: number } => (
    entry.resistance !== undefined && entry.resistance > 0
    && entry.tolerance !== undefined && entry.tolerance >= 0 && entry.tolerance < 1
  ));
  let best: { upper: typeof values[number]; lower: typeof values[number]; error: number } | undefined;
  for (const upper of values) {
    for (const lower of values) {
      const error = Math.abs(feedbackPoint(typical.value, upper.resistance, lower.resistance) - designRequest.requirements.outputVoltage.value);
      if (
        best === undefined
        || error < best.error
        || (error === best.error && (
          compareDesignV2Tokens(designProfileId(upper.profile.partClass, upper.profile.part), designProfileId(best.upper.profile.partClass, best.upper.profile.part))
          || compareDesignV2Tokens(designProfileId(lower.profile.partClass, lower.profile.part), designProfileId(best.lower.profile.partClass, best.lower.profile.part))
        ) < 0)
      ) best = { upper, lower, error };
    }
  }
  if (!best) return undefined;
  const upperMinimum = canon(best.upper.resistance * canon(1 - best.upper.tolerance));
  const upperMaximum = canon(best.upper.resistance * canon(1 + best.upper.tolerance));
  const lowerMinimum = canon(best.lower.resistance * canon(1 - best.lower.tolerance));
  const lowerMaximum = canon(best.lower.resistance * canon(1 + best.lower.tolerance));
  return {
    upper: best.upper.profile,
    lower: best.lower.profile,
    nominalOutputVoltage: feedbackPoint(typical.value, best.upper.resistance, best.lower.resistance),
    lowCornerOutputVoltage: feedbackPoint(minimum.value, upperMinimum, lowerMaximum),
    highCornerOutputVoltage: feedbackPoint(maximum.value, upperMaximum, lowerMinimum),
  };
}

function profileArea(profile: SelectedProfile): number {
  const area = profile.facts.mountedGeometry.boardArea;
  if (area.state !== "calculated" || area.value === null) throw new TypeError("Selected profile lacks its calculated mounted-area ranking proxy");
  return area.value.area.value;
}

function profileHeight(profile: SelectedProfile): number {
  const height = profile.facts.mountedGeometry.maximumHeight;
  if (height.state !== "reviewed" || height.value === null) throw new TypeError("Selected profile lacks its reviewed mounted maximum height");
  return height.value.height.value;
}

function selectedProfiles(
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
  config: Readonly<PowerIntegratedStructuralRecipeConfig>,
): SelectedProfile[] {
  const catalog: SelectedProfile[] = [
    ...integratedProfiles(environment.catalog, config.primaryFactsSchemaVersion ?? FACTS_SCHEMA_VERSION_V33),
    ...capacitorProfiles(environment.catalog),
    ...inductorProfiles(environment.catalog, config.inductorContract),
    ...v2Profiles(environment.catalog, "shared.general-purpose-resistor"),
  ];
  return option.components.map((component) => catalog.find((profile) => designProfileId(profile.partClass, profile.part) === component.profileId))
    .filter((profile): profile is SelectedProfile => profile !== undefined);
}

function matchedComponent(option: Readonly<NativeMatchedOptionV2>, id: string): SelectedComponent | undefined {
  const matches = option.components.filter((component) => component.id === id);
  return matches.length === 1 ? matches[0] : undefined;
}

function selectedPartMatches(
  component: Readonly<SelectedComponent> | undefined,
  profile: Readonly<SelectedProfile>,
  quantityPerAssembly = 1,
): boolean {
  return component?.profileId === designProfileId(profile.partClass, profile.part)
    && component.part.manufacturerId === profile.part.manufacturerId
    && component.part.manufacturerPartNumber === profile.part.manufacturerPartNumber
    && component.quantityPerAssembly === quantityPerAssembly;
}

function selectedValueMatches(
  component: Readonly<SelectedComponent> | undefined,
  profile: Readonly<SelectedProfile>,
  value: Readonly<ProfileQuantity>,
  quantityPerAssembly = 1,
): boolean {
  return component !== undefined
    && selectedPartMatches(component, profile, quantityPerAssembly)
    && component.value?.unit === value.unit
    && component.value.value === value.value;
}

function outputCapacitorMatchesContract(
  profile: Readonly<CapacitorProfile>,
  contract: Readonly<PowerIntegratedOutputCapacitorContract>,
): boolean {
  if (contract.exactProfileContentHash !== undefined) {
    return (contract.factsSchemaVersion === undefined || profile.factsSchemaVersion === contract.factsSchemaVersion)
      && designProfileEnvelopeContentHash(profile) === contract.exactProfileContentHash;
  }
  if (contract.profileId !== undefined) {
    return profile.factsSchemaVersion === contract.factsSchemaVersion
      && designProfileId(profile.partClass, profile.part) === contract.profileId;
  }
  return false;
}

function exactOutputCapacitor(
  profiles: readonly CapacitorProfile[],
  contract: Readonly<PowerIntegratedOutputCapacitorContract> | undefined,
  minimumRatedVoltage: number,
): CapacitorProfile | undefined {
  const voltageQualified = profiles.filter((profile) => (
    (factQuantity(profile.facts.ratedVoltage)?.value ?? -Infinity) >= minimumRatedVoltage
  ));
  if (contract === undefined) return voltageQualified[0];
  return voltageQualified.find((profile) => outputCapacitorMatchesContract(profile, contract));
}

function passiveSelectionEnvelope(
  designRequest: Readonly<BuckDesignRequestV2>,
  primary: Readonly<IntegratedProfile>,
) {
  const switchingMinimum = factQuantity(primary.facts.switchingFrequencyMinimum);
  const switchingMaximum = factQuantity(primary.facts.switchingFrequencyMaximum);
  if (!switchingMinimum || !switchingMaximum) return undefined;
  const regulation = designRequest.requirements.dcOutputVoltageRegulation;
  const outputVoltageMinimum = regulation?.minimum.value ?? designRequest.requirements.outputVoltage.value;
  const outputVoltageMaximum = regulation?.maximum.value ?? designRequest.requirements.outputVoltage.value;
  const maximumOutputCurrent = designRequest.requirements.maximumOutputCurrent.value;
  const ambientTemperature = designRequest.requirements.ambientTemperature.value;
  if (outputVoltageMaximum >= designRequest.requirements.inputVoltage.minimum.value) return undefined;
  return {
    inputVoltageV: {
      minimum: designRequest.requirements.inputVoltage.minimum.value,
      maximum: designRequest.requirements.inputVoltage.maximum.value,
    },
    outputVoltageV: { minimum: outputVoltageMinimum, maximum: outputVoltageMaximum },
    outputCurrentA: { minimum: maximumOutputCurrent, maximum: maximumOutputCurrent },
    switchingFrequencyHz: { minimum: switchingMinimum.value, maximum: switchingMaximum.value },
    ambientTemperatureK: { minimum: ambientTemperature, maximum: ambientTemperature },
    maximumOutputRippleV: designRequest.requirements.maximumOutputRipple.value,
  } as const;
}

function evaluatedPassiveCombination(
  designRequest: Readonly<BuckDesignRequestV2>,
  primary: Readonly<IntegratedProfile>,
  inductor: Readonly<InductorProfile>,
  outputCapacitor: Readonly<CapacitorProfile>,
  outputCapacitorQuantity: number,
): PowerPassiveCombinationV1 | undefined {
  const envelope = passiveSelectionEnvelope(designRequest, primary);
  if (envelope === undefined) return undefined;
  const result = selectPowerIntegratedBuckPassivesV1({
    envelope,
    objective: designRequest.objective,
    inductors: [powerPassiveInductorCandidateFromReviewedProfileV1(inductor, envelope)],
    outputCapacitors: [powerPassiveCapacitorCandidateFromReviewedProfileV1(
      outputCapacitor,
      envelope,
      outputCapacitorQuantity,
    )],
  });
  return result.rankedAdmissibleCombinations[0] ?? result.rejectedCombinations[0];
}

function passiveDiagnosticEvidenceKey(reference: Readonly<ProfileEvidenceRef>): string {
  return `${reference.sourceId}\u0000${reference.contentHash ?? ""}\u0000${reference.locator}`;
}

function orderedProjectedPassiveEvidence(
  ...groups: readonly (readonly ProfileEvidenceRef[])[]
): ReturnType<typeof projectedEvidence> {
  const byKey = new Map<string, ProfileEvidenceRef>();
  for (const reference of groups.flat()) byKey.set(passiveDiagnosticEvidenceKey(reference), reference);
  return projectedEvidence([...byKey.entries()]
    .sort(([left], [right]) => compareDesignV2Tokens(left, right))
    .map(([, reference]) => reference));
}

function unknownPassiveOperatingObservationMetrics(
  explanation: string,
  evidenceRefs: ReturnType<typeof projectedEvidence> = [],
): CandidateMetricV2[] {
  return PASSIVE_OPERATING_OBSERVATION_METRICS.map(({ id }) => ({
    id,
    value: null,
    state: "unknown",
    explanation,
    evidence: evidenceRefs,
  }));
}

function passiveOperatingObservationMetrics(
  designRequest: Readonly<BuckDesignRequestV2>,
  primary: Readonly<IntegratedProfile>,
  inductor: Readonly<InductorProfile>,
  outputCapacitor: Readonly<CapacitorProfile>,
  outputCapacitorQuantity: number,
): CandidateMetricV2[] {
  const envelope = passiveSelectionEnvelope(designRequest, primary);
  const currentEvidence = orderedProjectedPassiveEvidence(
    primary.facts.switchingFrequencyMinimum.evidence,
    primary.facts.switchingFrequencyMaximum.evidence,
    inductor.facts.inductance.evidence,
  );
  if (envelope === undefined) return unknownPassiveOperatingObservationMetrics(
    "The exact selected passive maximum-load observation envelope cannot be reproduced; no operating-current observation is emitted.",
    currentEvidence,
  );
  const combination = evaluatedPassiveCombination(
    designRequest,
    primary,
    inductor,
    outputCapacitor,
    outputCapacitorQuantity,
  );
  if (combination === undefined || combination.evaluatedPoints.length === 0) {
    return unknownPassiveOperatingObservationMetrics(
      "The exact selected passive combination has no reproducible operating points; no operating-current observation is emitted.",
      currentEvidence,
    );
  }
  const modes = combination.conductionModesAtEvaluatedInductance.join(", ");
  const envelopeSummary = `Vin ${envelope.inputVoltageV.minimum} V to ${envelope.inputVoltageV.maximum} V, Vout ${envelope.outputVoltageV.minimum} V to ${envelope.outputVoltageV.maximum} V, Iout ${envelope.outputCurrentA.minimum} A to ${envelope.outputCurrentA.maximum} A, fsw ${envelope.switchingFrequencyHz.minimum} Hz to ${envelope.switchingFrequencyHz.maximum} Hz, and ambient ${envelope.ambientTemperatureK.minimum} K to ${envelope.ambientTemperatureK.maximum} K`;
  const authorityBoundary = "The ideal buck equations use the selected nominal or condition-mismatched inductance and do not model the selected regulator's pulse-skipping or control law. This estimated observation is not a production bound and cannot change any constraint status, candidate eligibility, thermal/loss/output-ripple/current-sharing claim, or SPICE/model authority.";
  const bankEvidence = orderedProjectedPassiveEvidence(
    primary.facts.switchingFrequencyMinimum.evidence,
    primary.facts.switchingFrequencyMaximum.evidence,
    inductor.facts.inductance.evidence,
    outputCapacitor.facts.nominalCapacitance.evidence,
  );
  const values: ReadonlyArray<Readonly<{
    id: PassiveOperatingObservationMetricId;
    label: string;
    value: number | null;
    pointId: string | null;
    evidence: ReturnType<typeof projectedEvidence>;
    extraBoundary: string;
  }>> = [
    {
      id: "power.passive.inductor-peak-current-observation",
      label: "maximum inductor peak current",
      value: combination.worstCase.maximumInductorPeakCurrentA,
      pointId: combination.worstCase.maximumInductorPeakPointId,
      evidence: currentEvidence,
      extraBoundary: "",
    },
    {
      id: "power.passive.inductor-ripple-current-observation",
      label: "maximum inductor peak-to-peak ripple current",
      value: combination.worstCase.maximumInductorRippleCurrentPeakToPeakA,
      pointId: combination.worstCase.maximumInductorRipplePointId,
      evidence: currentEvidence,
      extraBoundary: "",
    },
    {
      id: "power.passive.inductor-rms-current-observation",
      label: "maximum inductor RMS current",
      value: combination.worstCase.maximumInductorRmsCurrentA,
      pointId: combination.worstCase.maximumInductorRmsPointId,
      evidence: currentEvidence,
      extraBoundary: "",
    },
    {
      id: "power.passive.output-capacitor-bank-rms-current-observation",
      label: "maximum total output-capacitor-bank RMS current",
      value: combination.worstCase.maximumCapacitorRmsCurrentA,
      pointId: combination.worstCase.maximumCapacitorRmsPointId,
      evidence: bankEvidence,
      extraBoundary: ` This is total current for the exact quantity-${outputCapacitorQuantity} bank; no per-part current-sharing multiplier or balance is claimed.`,
    },
  ];
  return values.map(({ id, label, value, pointId, evidence: metricEvidence, extraBoundary }) => {
    if (value === null || pointId === null || !Number.isFinite(value)) return {
      id,
      value: null,
      state: "unknown" as const,
      explanation: `The ${label} worst point cannot be reproduced from the exact selected passive observation envelope.`,
      evidence: metricEvidence,
    };
    return {
      id,
      value: q(value, "A"),
      state: "estimated" as const,
      explanation: `The passive kernel estimates the ${label} over ${envelopeSummary}. Evaluated conduction modes: ${modes}. Worst point: ${pointId}.${extraBoundary} ${authorityBoundary}`,
      evidence: metricEvidence,
    };
  });
}

function mappedPassiveConstraint(
  ruleId: string,
  diagnostics: readonly Readonly<PowerPassiveDiagnosticV1>[],
): ConstraintResult {
  const ordered = [...diagnostics].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
  const status: ConstraintResult["status"] = ordered.some((entry) => entry.status === "fail")
    ? "fail"
    : ordered.some((entry) => entry.status === "unknown" || entry.status === "inapplicable")
      ? "unknown"
      : "pass";
  const evidenceByKey = new Map<string, ProfileEvidenceRef>();
  for (const reference of ordered.flatMap((entry) => entry.evidence)) {
    evidenceByKey.set(passiveDiagnosticEvidenceKey(reference), reference);
  }
  const single = ordered.length === 1 ? ordered[0] : undefined;
  const actual = single?.actual !== null && single?.actual !== undefined && single.unit !== null
    ? q(single.actual, single.unit)
    : undefined;
  const limit = single?.limit !== null && single?.limit !== undefined && single.unit !== null
    ? q(single.limit, single.unit)
    : undefined;
  return {
    ruleId,
    status,
    ...(actual === undefined ? {} : { actual }),
    ...(limit === undefined ? {} : { limit }),
    ...(actual === undefined || limit === undefined
      ? {}
      : { margin: q(canon(limit.value - actual.value), actual.unit) }),
    explanation: ordered
      .map((entry) => `${entry.id} [${entry.status}/${entry.authority}]: ${entry.explanation}`)
      .join(" "),
    evidence: projectedEvidence([...evidenceByKey.entries()]
      .sort(([left], [right]) => compareDesignV2Tokens(left, right))
      .map(([, reference]) => reference)),
  };
}

function mappedPassiveConstraints(combination: Readonly<PowerPassiveCombinationV1>): ConstraintResult[] {
  const diagnostics = combination.diagnostics;
  const selected = (...ids: readonly PowerPassiveDiagnosticV1["id"][]) => diagnostics.filter((entry) => ids.includes(entry.id));
  return [
    mappedPassiveConstraint("power.inductor.selected-value", selected("power.passive.inductor.minimum-inductance")),
    mappedPassiveConstraint("power.inductor.saturation-current", selected("power.passive.inductor.saturation-current")),
    mappedPassiveConstraint("power.inductor.rms-current", selected("power.passive.inductor.rms-current")),
    mappedPassiveConstraint("power.passive.capacitor-effective-capacitance", selected(
      "power.passive.capacitor.effective-capacitance",
      "power.passive.capacitor.voltage-rating",
      "power.passive.capacitor.ripple-current",
    )),
    mappedPassiveConstraint("power.request.output-ripple", selected("power.passive.output-ripple")),
    mappedPassiveConstraint("power.thermal.loss-model", selected(
      "power.passive.inductor.loss-bound",
      "power.passive.capacitor.loss-bound",
    )),
  ].sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
}

function inductorCurrentObservation(
  option: Readonly<NativeMatchedOptionV2>,
  primary: Readonly<IntegratedProfile>,
  inductor: Readonly<InductorProfile>,
  designRequest: Readonly<BuckDesignRequestV2>,
  switchingMinimum: Readonly<Quantity<"Hz">>,
): InductorCurrentObservationV33 | undefined {
  const inductance = factQuantity(inductor.facts.inductance);
  const component = matchedComponent(option, "power-inductor");
  if (component?.role !== "power-inductor" || !inductance || !selectedValueMatches(component, inductor, inductance)) return undefined;

  const inputMaximum = designRequest.requirements.inputVoltage.maximum.value;
  const inputMinimum = designRequest.requirements.inputVoltage.minimum.value;
  const outputVoltage = designRequest.requirements.outputVoltage.value;
  const outputCurrent = designRequest.requirements.maximumOutputCurrent.value;
  const frequency = switchingMinimum.value;
  if (
    ![inputMinimum, inputMaximum, outputVoltage, outputCurrent, frequency, inductance.value]
      .every((value) => Number.isFinite(value) && value > 0)
    || inputMinimum <= outputVoltage
    || inputMaximum < inputMinimum
  ) return undefined;

  const offDuty = canon(1 - canon(outputVoltage / inputMaximum));
  const rippleCurrent = canon(canon(outputVoltage * offDuty) / canon(inductance.value * frequency));
  const halfRipple = canon(rippleCurrent / 2);
  const peakCurrent = canon(outputCurrent + halfRipple);
  const valleyCurrent = canon(outputCurrent - halfRipple);
  const rmsCurrent = canon(Math.sqrt(canon(canon(outputCurrent * outputCurrent) + canon(canon(rippleCurrent * rippleCurrent) / 12))));
  if (![rippleCurrent, peakCurrent, valleyCurrent, rmsCurrent].every(Number.isFinite)) return undefined;

  const inductanceConditionsCover = conditionsCover(
    inductor.facts.inductance.validFor,
    designRequest,
    frequency,
    { minimum: Math.max(0, valleyCurrent), maximum: peakCurrent },
  );
  const frequencyConditionsCover = conditionsCover(primary.facts.switchingFrequencyMinimum.validFor, designRequest, frequency);
  const continuousConduction = valleyCurrent > 0;
  return {
    rippleCurrent,
    peakCurrent,
    rmsCurrent,
    valleyCurrent,
    nominalPointSupported: inductanceConditionsCover && frequencyConditionsCover && continuousConduction,
    unsupportedReason: !inductanceConditionsCover
      ? "the reviewed inductance measurement conditions do not cover the calculated operating point"
      : !frequencyConditionsCover
        ? "the reviewed minimum-frequency conditions do not cover the request"
        : !continuousConduction
          ? "the ideal CCM projection reaches zero current and cannot bound discontinuous or pulse-skipping behavior"
          : null,
  };
}

function feedbackResistorStressObservation(
  option: Readonly<NativeMatchedOptionV2>,
  primary: Readonly<IntegratedProfile>,
  resistors: readonly ResistorProfileV2[],
  designRequest: Readonly<BuckDesignRequestV2>,
  selectedSwitchingFrequency: number,
): FeedbackResistorStressObservationV33 | undefined {
  const componentAndProfile = (id: "feedback-lower" | "feedback-upper"): { component: SelectedComponent; profile: ResistorProfileV2 } | undefined => {
    const component = matchedComponent(option, id);
    const expectedRole = id === "feedback-lower" ? "feedback-lower-resistor" : "feedback-upper-resistor";
    if (!component || component.role !== expectedRole) return undefined;
    const matches = resistors.filter((profile) => designProfileId(profile.partClass, profile.part) === component.profileId);
    return matches.length === 1 ? { component, profile: matches[0]! } : undefined;
  };
  const lower = componentAndProfile("feedback-lower");
  const upper = componentAndProfile("feedback-upper");
  const referenceMaximum = factQuantity(primary.facts.feedbackReferenceMaximum);
  if (!lower || !upper || !referenceMaximum) return undefined;

  const lowerResistance = factQuantity(lower.profile.facts.resistance);
  const lowerTolerance = factQuantity(lower.profile.facts.tolerance);
  const upperResistance = factQuantity(upper.profile.facts.resistance);
  const upperTolerance = factQuantity(upper.profile.facts.tolerance);
  if (!lowerResistance || !lowerTolerance || !upperResistance || !upperTolerance) return undefined;
  if (
    !selectedValueMatches(lower.component, lower.profile, lowerResistance)
    || !selectedValueMatches(upper.component, upper.profile, upperResistance)
    || ![referenceMaximum.value, lowerResistance.value, lowerTolerance.value, upperResistance.value, upperTolerance.value]
      .every(Number.isFinite)
    || referenceMaximum.value <= 0
    || lowerResistance.value <= 0
    || upperResistance.value <= 0
    || lowerTolerance.value < 0
    || lowerTolerance.value >= 1
    || upperTolerance.value < 0
    || upperTolerance.value >= 1
  ) return undefined;

  const baseConditionsCover = conditionsCover(primary.facts.feedbackReferenceMaximum.validFor, designRequest, selectedSwitchingFrequency)
    && conditionsCover(lower.profile.facts.resistance.validFor, designRequest, selectedSwitchingFrequency)
    && conditionsCover(lower.profile.facts.tolerance.validFor, designRequest, selectedSwitchingFrequency)
    && conditionsCover(upper.profile.facts.resistance.validFor, designRequest, selectedSwitchingFrequency)
    && conditionsCover(upper.profile.facts.tolerance.validFor, designRequest, selectedSwitchingFrequency);
  const lowerMinimum = canon(lowerResistance.value * canon(1 - lowerTolerance.value));
  const upperMaximum = canon(upperResistance.value * canon(1 + upperTolerance.value));
  if (lowerMinimum <= 0 || upperMaximum <= 0) return undefined;
  const maximumDividerCurrent = canon(referenceMaximum.value / lowerMinimum);
  const lowerVoltage = referenceMaximum.value;
  const upperVoltage = canon(maximumDividerCurrent * upperMaximum);
  const lowerPower = canon(canon(lowerVoltage * lowerVoltage) / lowerMinimum);
  const upperPower = canon(canon(maximumDividerCurrent * maximumDividerCurrent) * upperMaximum);

  const checks: FeedbackResistorStressCheckV33[] = [];
  const addChecks = (
    id: "feedback-lower" | "feedback-upper",
    profile: Readonly<ResistorProfileV2>,
    voltage: number,
    power: number,
  ): void => {
    const workingVoltage = factQuantity(profile.facts.workingVoltage);
    const continuousPower = factQuantity(profile.facts.continuousPower);
    if (workingVoltage) checks.push({
      key: `${id}.working-voltage`,
      actual: q(voltage, "V") as Quantity<"V">,
      limit: q(workingVoltage.value, "V") as Quantity<"V">,
      supported: baseConditionsCover && conditionsCover(profile.facts.workingVoltage.validFor, designRequest, selectedSwitchingFrequency),
    });
    if (continuousPower) checks.push({
      key: `${id}.continuous-power`,
      actual: q(power, "W") as Quantity<"W">,
      limit: q(continuousPower.value, "W") as Quantity<"W">,
      supported: baseConditionsCover && conditionsCover(profile.facts.continuousPower.validFor, designRequest, selectedSwitchingFrequency),
    });
  };
  addChecks("feedback-lower", lower.profile, lowerVoltage, lowerPower);
  addChecks("feedback-upper", upper.profile, upperVoltage, upperPower);
  if (checks.length !== 4) return undefined;
  checks.sort((left, right) => compareDesignV2Tokens(left.key, right.key));
  return {
    checks,
    explanation: `At the reviewed maximum feedback reference and selected resistor tolerances, the divider projects ${maximumDividerCurrent} A maximum DC current; lower stress is ${lowerVoltage} V/${lowerPower} W and upper stress is ${upperVoltage} V/${upperPower} W.`,
    evidence: evidence(
      primary.facts.feedbackReferenceMaximum,
      lower.profile.facts.resistance,
      lower.profile.facts.tolerance,
      lower.profile.facts.continuousPower,
      lower.profile.facts.workingVoltage,
      upper.profile.facts.resistance,
      upper.profile.facts.tolerance,
      upper.profile.facts.continuousPower,
      upper.profile.facts.workingVoltage,
    ),
  };
}

function selectedFrequency(primary: IntegratedProfile, designRequest: Readonly<BuckDesignRequestV2>): number | undefined {
  const nominal = factQuantity(primary.facts.switchingFrequencyNominal);
  if (!nominal || primary.facts.switchingFrequencyArchitecture.value !== "fixed_oscillator") return undefined;
  if (!conditionsCover(primary.facts.switchingFrequencyNominal.validFor, designRequest, nominal.value)) return undefined;
  if (designRequest.requirements.switchingFrequency.selection === "fixed") {
    const preferred = designRequest.requirements.switchingFrequency.preferred;
    if (preferred === null || preferred.value !== nominal.value) return undefined;
  }
  return nominal.value;
}

function physicalInstanceIds(selectedComponentId: string, quantityPerAssembly: number): string[] {
  return quantityPerAssembly === 1
    ? [selectedComponentId]
    : Array.from({ length: quantityPerAssembly }, (_, index) => `${selectedComponentId}-${index + 1}`);
}

function materialize(
  candidate: Readonly<NativeCandidateV2>,
  outputCapacitorQuantity = 1,
): NativeMaterializationV2 {
  const expectedIds = [
    "bootstrap-capacitor",
    "feedback-lower",
    "feedback-upper",
    "input-capacitor",
    "output-capacitor",
    "power-inductor",
    "primary",
  ] as const;
  const selected = new Map(candidate.components.map((component) => [component.id, component]));
  if (selected.size !== expectedIds.length || candidate.components.length !== expectedIds.length || expectedIds.some((id) => !selected.has(id))) {
    throw new TypeError("Facts-V3.3 integrated-buck materialization requires the exact seven-line selected BOM");
  }
  const passive = (
    selectedComponentId: typeof expectedIds[number],
    type: "capacitor" | "inductor" | "resistor",
    pos: [number, number],
    rot: 0 | 90,
    componentId: string = selectedComponentId,
    expectedQuantityPerAssembly = 1,
  ): CircuitComponentV4 => {
    const component = selected.get(selectedComponentId)!;
    if (component.value === undefined || component.quantityPerAssembly !== expectedQuantityPerAssembly) {
      throw new TypeError(`Facts-V3.3 integrated-buck materialization requires ${expectedQuantityPerAssembly} exact-valued ${selectedComponentId}`);
    }
    return {
      id: componentId,
      type,
      value: component.value.value,
      mpn: component.part.manufacturerPartNumber,
      pos,
      rot,
      mirror: false,
    };
  };
  const outputCapacitorInstanceIds = physicalInstanceIds("output-capacitor", outputCapacitorQuantity);
  const outputCapacitors = outputCapacitorInstanceIds.map((componentId, index) => passive(
    "output-capacitor",
    "capacitor",
    [52 + index * 6, 12],
    90,
    componentId,
    outputCapacitorQuantity,
  ));
  const primary = selected.get("primary")!;
  if (
    primary.quantityPerAssembly !== 1
    || primary.part.manufacturerId !== "texas-instruments"
    || primary.part.manufacturerPartNumber !== "TPS54302DDCR"
  ) {
    throw new TypeError("The production facts-V3.3 structural binding is pinned to one exact TPS54302DDCR primary");
  }
  const definitionPayload: Omit<DesignBlockDefinition, "contentHash"> = {
    id: "power.integrated-synchronous-buck-regulator.texas-instruments.TPS54302DDCR",
    version: "structural-v1",
    title: "Texas Instruments TPS54302DDCR integrated synchronous buck regulator",
    pins: [
      { id: "ground", name: "GROUND", offset: [0, 12] },
      { id: "switch-node", name: "SWITCH NODE", offset: [12, 0] },
      { id: "input-supply", name: "INPUT SUPPLY", offset: [-12, -8] },
      { id: "feedback", name: "FEEDBACK", offset: [12, 8] },
      { id: "bootstrap", name: "BOOTSTRAP", offset: [12, -8] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model or package-pin mapping is bundled for the exact selected TPS54302DDCR primary regulator; these are generic functional structural ports only.",
    },
  };
  const primaryBlock: DesignBlockDefinition = {
    ...definitionPayload,
    contentHash: calculateDesignBlockContentHash(definitionPayload),
  };
  const components: CircuitComponentV4[] = [
    passive("bootstrap-capacitor", "capacitor", [20, -8], 0),
    passive("feedback-lower", "resistor", [44, 16], 90),
    passive("feedback-upper", "resistor", [44, 8], 90),
    { id: "ground", type: "ground", pos: [0, 24], rot: 0, mirror: false },
    passive("input-capacitor", "capacitor", [-24, 12], 90),
    ...outputCapacitors,
    passive("power-inductor", "inductor", [36, 0], 0),
    {
      id: "primary",
      type: "design_block",
      block: { id: primaryBlock.id, version: primaryBlock.version, contentHash: primaryBlock.contentHash },
      mpn: primary.part.manufacturerPartNumber,
      pos: [0, 0],
      rot: 0,
      mirror: false,
    },
  ];
  const circuit: CircuitDocumentV4 = {
    format: "opencircuit-circuit",
    version: 4,
    meta: {
      title: "Catalog-native facts-V3.3 integrated synchronous buck structural schematic",
      description: "Connected exact-BOM structure only; it provides no regulation, simulation, performance, or selected-part fidelity claim.",
    },
    designBlocks: [primaryBlock],
    circuits: [{
      id: "assembly",
      title: "TPS54302DDCR structural buck assembly",
      components,
      wires: [
        { id: "net-boot", points: [[12, -8], [18, -8]] },
        { id: "net-feedback-lower", points: [[44, 12], [44, 14]] },
        { id: "net-feedback-primary", points: [[12, 8], [32, 8], [32, 12], [44, 12]] },
        { id: "net-feedback-upper", points: [[44, 10], [44, 12]] },
        { id: "net-ground-bus", points: [[-24, 24], [0, 24], [44, 24], ...outputCapacitors.map((_, index) => [52 + index * 6, 24] as [number, number])] },
        { id: "net-ground-divider", points: [[44, 18], [44, 24]] },
        { id: "net-ground-input-capacitor", points: [[-24, 14], [-24, 24]] },
        ...outputCapacitors.map((_, index) => ({ id: `net-ground-output-capacitor${outputCapacitorQuantity === 1 ? "" : `-${index + 1}`}`, points: [[52 + index * 6, 14], [52 + index * 6, 24]] as [number, number][] })),
        { id: "net-ground-primary", points: [[0, 12], [0, 24]] },
        { id: "net-input-capacitor", points: [[-24, -8], [-24, 10]] },
        { id: "net-input-supply", points: [[-32, -8], [-24, -8], [-12, -8]] },
        ...outputCapacitors.map((_, index) => ({ id: `net-output-capacitor${outputCapacitorQuantity === 1 ? "" : `-${index + 1}`}`, points: [[52 + index * 6, 0], [52 + index * 6, 10]] as [number, number][] })),
        { id: "net-output-feedback", points: [[44, 0], [44, 6]] },
        { id: "net-output-port", points: [[38, 0], [44, 0], ...outputCapacitors.map((_, index) => [52 + index * 6, 0] as [number, number]), [Math.max(60, 52 + (outputCapacitorQuantity - 1) * 6 + 8), 0]] },
        { id: "net-switch-bootstrap", points: [[24, 0], [24, -8], [22, -8]] },
        { id: "net-switch-stage", points: [[12, 0], [24, 0], [34, 0]] },
      ],
      probes: [],
    }],
    scenarios: [],
    defaultCircuitId: "assembly",
    defaultScenarioId: null,
  };
  return {
    circuit,
    circuitInstanceClassifications: [
      ...expectedIds.filter((id) => id !== "output-capacitor").map((id) => ({
        circuitId: "assembly",
        componentId: id,
        kind: "physical" as const,
        selectedComponentId: id,
        representedQuantityPerAssembly: 1,
      })),
      ...outputCapacitorInstanceIds.map((componentId) => ({
        circuitId: "assembly",
        componentId,
        kind: "physical" as const,
        selectedComponentId: "output-capacitor",
        representedQuantityPerAssembly: 1,
      })),
      { circuitId: "assembly", componentId: "ground", kind: "non_bom" as const, reason: "Ground is a schematic reference, not a BOM line." },
    ].sort((left, right) => compareDesignV2Tokens(left.componentId, right.componentId)),
    circuitBomNonRepresentations: [],
  };
}

export function createPowerIntegratedSynchronousBuckStructuralRecipe(
  config: PowerIntegratedStructuralRecipeConfig,
): NativeRecipeV2 {
  const outputCapacitorQuantity = config.outputCapacitorContract?.quantityPerAssembly ?? 1;
  if (!Number.isSafeInteger(outputCapacitorQuantity) || outputCapacitorQuantity <= 0) {
    throw new TypeError("Integrated-buck output-capacitor quantity must be a positive safe integer");
  }
  if (config.evaluatePassiveSelectionV1 && config.outputCapacitorContract === undefined) {
    throw new TypeError("Passive-selection evaluation requires an exact output-capacitor contract");
  }
  if (config.surfacePassiveOperatingObservationsV1 && !config.evaluatePassiveSelectionV1) {
    throw new TypeError("Passive operating-observation metrics require passive-selection evaluation");
  }
  const metricDeclarations = [
    ...METRICS,
    ...(config.surfacePassiveOperatingObservationsV1 ? PASSIVE_OPERATING_OBSERVATION_METRICS : []),
  ];
  return {
  id: config.release.id,
  version: config.release.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(config.release)),
  applications: ["power.buck"],
  metricDeclarations: metricDeclarations.map((entry) => ({ ...entry })),
  supports(designRequest) {
    return designRequest.application === "power.buck"
      && designRequest.constraints.allowedTopologyFamilies.includes("power.buck.integrated-synchronous");
  },
  enumerate(environment) {
    if (!request(environment).constraints.allowedTopologyFamilies.includes("power.buck.integrated-synchronous")) return [];
    return integratedProfiles(environment.catalog, config.primaryFactsSchemaVersion ?? FACTS_SCHEMA_VERSION_V33).map((profile) => {
      const data = { primaryProfileId: designProfileId(profile.partClass, profile.part) };
      return { optionKey: `${config.optionKeyPrefix}:${designSha256ContentHash(canonicalDesignV2Payload(data))}`, data };
    });
  },
  solve(option, environment) {
    const designRequest = request(environment);
    const primary = primaryFromData(option.data, environment.catalog, config.primaryFactsSchemaVersion ?? FACTS_SCHEMA_VERSION_V33);
    if (!primary) return { status: "rejected", reason: "The exact admitted facts-V3.3 integrated-regulator profile is absent from the reviewed catalog." };
    const frequency = selectedFrequency(primary, designRequest);
    const primaryId = designProfileId(primary.partClass, primary.part);
    if (frequency === undefined) {
      return {
        status: "rejected",
        reason: "The fixed oscillator nominal point is unavailable or its reviewed conditions do not cover this request.",
        constraints: [unknownConstraint("power.request.switching-selection", "The fixed-oscillator nominal point cannot be selected outside its exact reviewed conditions.", projectedEvidence(primary.facts.switchingFrequencyNominal.evidence))],
        componentProfileIds: [primaryId],
      };
    }
    return {
      status: "ok",
      value: {
        data: { ...option.data, selectedSwitchingFrequency: frequency },
        derivedValues: [{
          id: "power.selected-switching-frequency",
          value: q(frequency, "Hz"),
          equationId: "power.fixed-oscillator-selection.v3-3",
          state: "calculated",
          evidence: projectedEvidence(primary.facts.switchingFrequencyNominal.evidence),
        }],
      },
    };
  },
  match(option, environment) {
    const designRequest = request(environment);
    const primary = primaryFromData(option.data, environment.catalog, config.primaryFactsSchemaVersion ?? FACTS_SCHEMA_VERSION_V33);
    const frequency = typeof option.data.selectedSwitchingFrequency === "number" ? option.data.selectedSwitchingFrequency : undefined;
    if (!primary || frequency === undefined) return [{ status: "rejected", reason: "The solved facts-V3.3 primary selection is unavailable." }];
    const primaryId = designProfileId(primary.partClass, primary.part);
    const capacitors = capacitorProfiles(environment.catalog);
    const inputCapacitor = capacitors.find((profile) => (factQuantity(profile.facts.ratedVoltage)?.value ?? -Infinity) >= designRequest.requirements.inputVoltage.maximum.value);
    const outputCapacitor = exactOutputCapacitor(
      capacitors,
      config.outputCapacitorContract,
      designRequest.requirements.outputVoltage.value,
    );
    const requiredBootstrapCapacitance = factQuantity(primary.facts.bootstrapCapacitance)?.value;
    const bootstrapCapacitor = requiredBootstrapCapacitance === undefined ? undefined : capacitors.find((profile) => (
      factQuantity(profile.facts.nominalCapacitance)?.value === requiredBootstrapCapacitance
    ));
    const inductor = inductorProfiles(environment.catalog, config.inductorContract)[0];
    if (!inputCapacitor || !outputCapacitor || !bootstrapCapacitor || !inductor) {
      const reason = config.primaryFactsSchemaVersion === FACTS_SCHEMA_VERSION_V35
        ? `The facts-V3.5 calculator recipe is missing required exact profiles: ${[
            inputCapacitor === undefined ? "input-capacitor" : undefined,
            outputCapacitor === undefined ? "output-capacitor" : undefined,
            bootstrapCapacitor === undefined ? "bootstrap-capacitor" : undefined,
            inductor === undefined ? "power-inductor" : undefined,
          ].filter((entry) => entry !== undefined).join(", ")}.`
        : config.outputCapacitorContract !== undefined
        ? "No exact reviewed facts-V2 input and bootstrap-capacitor, exact-bound facts-V2 output-capacitor bank, and exact-bound facts-V3.4 inductor set is available."
        : config.inductorContract.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2
          ? "No exact reviewed facts-V2 input, output, bootstrap-capacitor, and inductor set is available."
          : "No exact reviewed facts-V2 input, output, and bootstrap-capacitor plus exact-bound facts-V3.4 inductor set is available.";
      return [{ status: "rejected", reason, componentProfileIds: [primaryId] }];
    }
    const divider = selectDivider(primary, v2Profiles(environment.catalog, "shared.general-purpose-resistor"), designRequest, frequency);
    if (!divider) {
      return [{
        status: "rejected",
        reason: "Feedback-divider selection is unknown because the exact reference spread, conditions, resistance, or tolerance evidence is unavailable.",
        constraints: [unknownConstraint("power.feedback.output-voltage", "Feedback-divider selection requires a context-covering reference production spread and exact reviewed resistor values and tolerances.", projectedEvidence(evidence(primary.facts.feedbackReferenceMinimum, primary.facts.feedbackReferenceTypical, primary.facts.feedbackReferenceMaximum)))],
        componentProfileIds: [primaryId],
      }];
    }
    const components = [
      selectedComponent("bootstrap-capacitor", "bootstrap-capacitor", bootstrapCapacitor, bootstrapCapacitor.facts.nominalCapacitance),
      selectedComponent("feedback-lower", "feedback-lower-resistor", divider.lower, divider.lower.facts.resistance),
      selectedComponent("feedback-upper", "feedback-upper-resistor", divider.upper, divider.upper.facts.resistance),
      selectedComponent("input-capacitor", "input-capacitor", inputCapacitor, inputCapacitor.facts.nominalCapacitance),
      selectedComponent(
        "output-capacitor",
        "output-capacitor",
        outputCapacitor,
        outputCapacitor.facts.nominalCapacitance,
        outputCapacitorQuantity,
      ),
      selectedComponent("power-inductor", "power-inductor", inductor, inductor.facts.inductance),
      selectedComponent("primary", "integrated-synchronous-buck-regulator", primary),
    ].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
    if (config.evaluatePassiveSelectionV1) {
      const passive = evaluatedPassiveCombination(
        designRequest,
        primary,
        inductor,
        outputCapacitor,
        outputCapacitorQuantity,
      );
      if (passive === undefined || passive.eligibility === "fail") {
        return [{
          status: "rejected",
          reason: passive === undefined
            ? "The exact passive maximum-load observation envelope cannot be evaluated from reviewed regulator spread and selected profiles."
            : "The exact passive bank has a deterministic safety failure in the bounded maximum-load observation envelope.",
          ...(passive === undefined ? {} : { constraints: mappedPassiveConstraints(passive) }),
          componentProfileIds: [
            primaryId,
            designProfileId(inductor.partClass, inductor.part),
            designProfileId(outputCapacitor.partClass, outputCapacitor.part),
          ].sort(compareDesignV2Tokens),
        }];
      }
    }
    return [{ status: "ok", value: {
      data: {
        ...option.data,
        feedbackNominalOutputVoltage: divider.nominalOutputVoltage,
        feedbackLowCornerOutputVoltage: divider.lowCornerOutputVoltage,
        feedbackHighCornerOutputVoltage: divider.highCornerOutputVoltage,
      },
      derivedValues: option.derivedValues,
      components,
      simulationCoverage: [{ scenarioId: "catalog-native-model", modelTier: "unavailable", limitations: ["No reviewed executable model is bundled for the exact TPS54302DDCR regulator or selected passive stage."] }],
      warnings: [],
    } }];
  },
  check(option, environment) {
    const designRequest = request(environment);
    const primary = primaryFromData(option.data, environment.catalog, config.primaryFactsSchemaVersion ?? FACTS_SCHEMA_VERSION_V33);
    const frequency = typeof option.data.selectedSwitchingFrequency === "number" ? option.data.selectedSwitchingFrequency : undefined;
    const primaryComponent = matchedComponent(option, "primary");
    const exactFrequency = primary === undefined ? undefined : selectedFrequency(primary, designRequest);
    if (
      !primary
      || frequency === undefined
      || !Number.isFinite(frequency)
      || frequency <= 0
      || exactFrequency !== frequency
      || !selectedPartMatches(primaryComponent, primary)
      || primaryComponent?.role !== "integrated-synchronous-buck-regulator"
    ) return [unknownConstraint("power.profile.primary", "The exact solved facts-V3.3 primary profile and reviewed fixed-frequency selection are unavailable or do not match the selected BOM during constraint evaluation.")];
    const profiles = selectedProfiles(option, environment, config);
    const inductor = profiles.find((profile): profile is InductorProfile => profile.partClass === "power.power-inductor");
    const inductorComponent = matchedComponent(option, "power-inductor");
    const inductance = inductor === undefined ? undefined : factQuantity(inductor.facts.inductance);
    const capacitors = profiles.filter((profile): profile is CapacitorProfile => profile.partClass === "shared.mlcc-capacitor");
    const resistors = profiles.filter((profile): profile is ResistorProfileV2 => profile.partClass === "shared.general-purpose-resistor");
    const outputCapacitorComponent = matchedComponent(option, "output-capacitor");
    const outputCapacitor = outputCapacitorComponent === undefined
      ? undefined
      : capacitors.find((profile) => (
          designProfileId(profile.partClass, profile.part) === outputCapacitorComponent.profileId
        ));
    const expectedComponentIds = [
      "bootstrap-capacitor",
      "feedback-lower",
      "feedback-upper",
      "input-capacitor",
      "output-capacitor",
      "power-inductor",
      "primary",
    ];
    const exactQuantityAwareBom = config.outputCapacitorContract === undefined || (
      option.components.length === expectedComponentIds.length
      && expectedComponentIds.every((id) => option.components.filter((component) => component.id === id).length === 1)
      && option.components.every((component) => component.quantityPerAssembly === (
        component.id === "output-capacitor" ? outputCapacitorQuantity : 1
      ))
      && outputCapacitor !== undefined
      && outputCapacitorComponent?.role === "output-capacitor"
      && outputCapacitorMatchesContract(outputCapacitor, config.outputCapacitorContract)
      && factQuantity(outputCapacitor.facts.nominalCapacitance) !== undefined
      && selectedValueMatches(
        outputCapacitorComponent,
        outputCapacitor,
        factQuantity(outputCapacitor.facts.nominalCapacitance)!,
        outputCapacitorQuantity,
      )
    );
    if (
      !inductor
      || !inductance
      || !selectedValueMatches(inductorComponent, inductor, inductance)
      || inductorComponent?.role !== "power-inductor"
      || capacitors.length < 3
      || resistors.length < 2
      || !exactQuantityAwareBom
    ) return [unknownConstraint("power.profile.passive-set", "The exact solved passive set, including the selected inductor value, is unavailable or does not match the selected BOM during constraint evaluation.")];
    const required = <Unit extends Quantity["unit"]>(fact: Readonly<ProfileFact<ProfileQuantity<Unit>>>): Quantity<Unit> => {
      const value = factQuantity(fact);
      if (!value) throw new TypeError("A required admitted facts-V3.3 quantity became unavailable");
      return { value: value.value, unit: value.unit, displayUnit: value.displayUnit };
    };
    const switchingMinimum = required(primary.facts.switchingFrequencyMinimum);
    const switchingMaximum = required(primary.facts.switchingFrequencyMaximum);
    const outputCurrent = required(primary.facts.outputCurrent);
    const maximumJunction = required(primary.facts.maximumJunctionTemperature);
    const constraints: ConstraintResult[] = [
      limitConstraint("power.regulator.input-minimum", designRequest.requirements.inputVoltage.minimum, required(primary.facts.inputVoltageOperatingMinimum), "at_least", projectedEvidence(primary.facts.inputVoltageOperatingMinimum.evidence), "Requested minimum input is not below the reviewed operating endpoint."),
      limitConstraint("power.regulator.input-maximum", designRequest.requirements.inputVoltage.maximum, required(primary.facts.inputVoltageOperatingMaximum), "at_most", projectedEvidence(primary.facts.inputVoltageOperatingMaximum.evidence), "Requested maximum input does not exceed the reviewed operating endpoint."),
      limitConstraint("power.regulator.output-minimum", designRequest.requirements.outputVoltage, required(primary.facts.outputVoltageOperatingMinimum), "at_least", projectedEvidence(primary.facts.outputVoltageOperatingMinimum.evidence), "Requested output is not below the reviewed published range endpoint."),
      limitConstraint("power.regulator.output-maximum", designRequest.requirements.outputVoltage, required(primary.facts.outputVoltageOperatingMaximum), "at_most", projectedEvidence(primary.facts.outputVoltageOperatingMaximum.evidence), "Requested output does not exceed the reviewed published range endpoint."),
      limitConstraint("power.regulator.switching-spread-minimum", switchingMinimum, designRequest.requirements.switchingFrequency.minimum, "at_least", projectedEvidence(primary.facts.switchingFrequencyMinimum.evidence), "The fixed-oscillator production-spread minimum is not below the requested interval."),
      limitConstraint("power.regulator.switching-spread-maximum", switchingMaximum, designRequest.requirements.switchingFrequency.maximum, "at_most", projectedEvidence(primary.facts.switchingFrequencyMaximum.evidence), "The fixed-oscillator production-spread maximum does not exceed the requested interval."),
      limitConstraint("power.regulator.absolute-maximum-junction", designRequest.constraints.maximumJunctionTemperature, maximumJunction, "at_most", projectedEvidence(primary.facts.maximumJunctionTemperature.evidence), "The requested junction ceiling does not exceed the absolute rating; actual thermal feasibility remains separate."),
    ];
    constraints.push(designRequest.requirements.maximumOutputCurrent.value > outputCurrent.value
      ? limitConstraint("power.regulator.output-current", designRequest.requirements.maximumOutputCurrent, outputCurrent, "at_most", projectedEvidence(primary.facts.outputCurrent.evidence), "The requested output current exceeds the manufacturer's continuous-capability statement.")
      : unknownConstraint("power.regulator.output-current", "The manufacturer continuous-capability statement is not a condition-covering guarantee for this selected converter design.", projectedEvidence(evidence(primary.facts.outputCurrent, primary.facts.outputCurrentRole))));
    const nominal = typeof option.data.feedbackNominalOutputVoltage === "number" ? option.data.feedbackNominalOutputVoltage : Number.NaN;
    const low = typeof option.data.feedbackLowCornerOutputVoltage === "number" ? option.data.feedbackLowCornerOutputVoltage : Number.NaN;
    const high = typeof option.data.feedbackHighCornerOutputVoltage === "number" ? option.data.feedbackHighCornerOutputVoltage : Number.NaN;
    const feedbackEvidence = projectedEvidence(evidence(
      primary.facts.feedbackReferenceMinimum,
      primary.facts.feedbackReferenceTypical,
      primary.facts.feedbackReferenceMaximum,
      ...resistors.flatMap((profile) => [profile.facts.resistance, profile.facts.tolerance]),
    ));
    const regulationEnvelope = designRequest.requirements.dcOutputVoltageRegulation;
    if (
      config.evaluateDcOutputVoltageRegulationEnvelope
      && regulationEnvelope !== undefined
      && [nominal, low, high].every(Number.isFinite)
    ) {
      const minimum = regulationEnvelope.minimum.value;
      const maximum = regulationEnvelope.maximum.value;
      const cornersInside = low >= minimum && high <= maximum;
      constraints.push({
        ruleId: "power.feedback.output-voltage",
        status: cornersInside ? "pass" : "fail",
        explanation: cornersInside
          ? `The exact divider projects ${nominal} V nominal and ${low} V to ${high} V worst-case VFB/resistor corners, all inside the explicit ${minimum} V to ${maximum} V requested DC regulation envelope.`
          : `The exact divider projects ${nominal} V nominal and ${low} V to ${high} V worst-case VFB/resistor corners, which do not remain inside the explicit ${minimum} V to ${maximum} V requested DC regulation envelope.`,
        evidence: feedbackEvidence,
      });
    } else {
      constraints.push(unknownConstraint(
        "power.feedback.output-voltage",
        `The exact divider projects ${nominal} V nominal and ${low} V to ${high} V production/tolerance corners, but the request has no explicit DC regulation envelope supported by this immutable recipe; no pass is claimed.`,
        feedbackEvidence,
      ));
    }
    const observedUnknown = (
      ruleId: string,
      explanation: string,
      constraintEvidence: ConstraintResult["evidence"],
      actual?: Quantity,
      limit?: Quantity,
    ): ConstraintResult => ({
      ...unknownConstraint(ruleId, explanation, constraintEvidence),
      ...(actual === undefined ? {} : { actual }),
      ...(limit === undefined ? {} : { limit }),
      ...(actual === undefined || limit === undefined || actual.unit !== limit.unit
        ? {}
        : { margin: q(canon(limit.value - actual.value), actual.unit) }),
    });
    const currentObservation = inductorCurrentObservation(option, primary, inductor, designRequest, switchingMinimum);
    const currentObservationSummary = currentObservation === undefined
      ? "The exact selected inductance, step-down operating point, or minimum switching frequency is unavailable for a finite projection."
      : `The selected nominal values project ${currentObservation.rippleCurrent} A peak-to-peak ripple, ${currentObservation.peakCurrent} A peak, ${currentObservation.rmsCurrent} A RMS, and ${currentObservation.valleyCurrent} A valley at maximum requested input/current and minimum reviewed switching frequency.`;
    for (const [ruleId, fact, unknownExplanation, failureExplanation] of [
      [
        "power.inductor.saturation-current",
        inductor.facts.saturationCurrent,
        "No condition-covering peak-inductor-current envelope has been proved; raw output current not exceeding the reviewed saturation-current rating cannot establish margin.",
        "The requested output current alone already exceeds the reviewed saturation-current rating, so the uncalculated peak-inductor current cannot satisfy it.",
      ],
      [
        "power.inductor.rms-current",
        inductor.facts.rmsCurrent,
        "No condition-covering RMS-inductor-current envelope has been proved; raw output current not exceeding the reviewed temperature-rise current rating cannot establish margin.",
        "The requested output current alone already exceeds the reviewed temperature-rise current rating, so the uncalculated RMS-inductor current cannot satisfy it.",
      ],
    ] as const) {
      const rating = factQuantity(fact);
      const ratingConditionsCover = rating !== undefined && conditionsCover(fact.validFor, designRequest, frequency);
      const calculatedCurrent = ruleId === "power.inductor.saturation-current"
        ? currentObservation?.peakCurrent
        : currentObservation?.rmsCurrent;
      const constraintEvidence = projectedEvidence(evidence(inductor.facts.inductance, primary.facts.switchingFrequencyMinimum, fact));
      constraints.push(
        rating && ratingConditionsCover && designRequest.requirements.maximumOutputCurrent.value > rating.value
          ? limitConstraint(ruleId, designRequest.requirements.maximumOutputCurrent, rating, "at_most", projectedEvidence(fact.evidence), failureExplanation)
          : observedUnknown(
              ruleId,
              `${unknownExplanation} ${currentObservationSummary}${currentObservation?.unsupportedReason ? ` The nominal calculation is unavailable even as a CCM point observation because ${currentObservation.unsupportedReason}.` : " The nominal point is not a production bound because no reviewed minimum inductance covers tolerance, bias, and temperature, and maximum-load CCM does not cover feedback-voltage corners or lower-load control modes."}`,
              constraintEvidence,
              currentObservation?.nominalPointSupported && calculatedCurrent !== undefined ? q(calculatedCurrent, "A") : undefined,
              currentObservation?.nominalPointSupported ? rating : undefined,
            ),
      );
    }
    const selectedValueEvidence = projectedEvidence(evidence(inductor.facts.inductance, primary.facts.switchingFrequencyMinimum));
    const selectedValueConstraint = observedUnknown(
      "power.inductor.selected-value",
      currentObservation?.nominalPointSupported
        ? `${currentObservationSummary} This is a nominal maximum-load CCM point only: no reviewed minimum inductance covers tolerance, bias, and temperature, feedback-voltage corners and lower-load modes are not bounded, and the request defines no admissible inductor-ripple-current target. The selected inductance is not promoted to a sizing pass.`
        : `${currentObservationSummary}${currentObservation?.unsupportedReason ? ` It is not a sizing bound because ${currentObservation.unsupportedReason}.` : ""}`,
      selectedValueEvidence,
      currentObservation?.nominalPointSupported ? q(currentObservation.rippleCurrent, "A") : undefined,
    );

    const resistorStress = feedbackResistorStressObservation(option, primary, resistors, designRequest, frequency);
    let resistorConstraint: ConstraintResult;
    if (!resistorStress) {
      resistorConstraint = unknownConstraint(
        "power.passive.resistor-power-voltage",
        "The exact feedback roles, selected values, reference bound, tolerance, continuous-power rating, or working-voltage rating is unavailable for a deterministic stress observation.",
        projectedEvidence(resistors.flatMap((profile) => evidence(profile.facts.continuousPower, profile.facts.workingVoltage))),
      );
    } else {
      const orderedByHeadroom = [...resistorStress.checks].sort((left, right) => (
        canon((left.limit.value - left.actual.value) / left.limit.value)
        - canon((right.limit.value - right.actual.value) / right.limit.value)
        || compareDesignV2Tokens(left.key, right.key)
      ));
      const supportedFailure = orderedByHeadroom.find((check) => check.supported && check.actual.value > check.limit.value);
      const evidenceRefs = projectedEvidence(resistorStress.evidence);
      if (supportedFailure) {
        resistorConstraint = limitConstraint(
          "power.passive.resistor-power-voltage",
          supportedFailure.actual,
          supportedFailure.limit,
          "at_most",
          evidenceRefs,
          `${resistorStress.explanation} ${supportedFailure.key} exceeds its condition-covering reviewed limit.`,
        );
      } else if (resistorStress.checks.every((check) => check.supported)) {
        const tightest = orderedByHeadroom[0]!;
        resistorConstraint = limitConstraint(
          "power.passive.resistor-power-voltage",
          tightest.actual,
          tightest.limit,
          "at_most",
          evidenceRefs,
          `${resistorStress.explanation} All four DC power and working-voltage comparisons remain within condition-covering reviewed limits; transient behavior remains a separate constraint.`,
        );
      } else {
        const observed = orderedByHeadroom.find((check) => check.supported) ?? orderedByHeadroom[0];
        resistorConstraint = observedUnknown(
          "power.passive.resistor-power-voltage",
          `${resistorStress.explanation} At least one selected resistor power or working-voltage fact does not cover the request, so no combined pass is claimed.`,
          evidenceRefs,
          observed?.actual,
          observed?.limit,
        );
      }
    }

    const currentLimitMinimum = factQuantity(primary.facts.currentLimitMinimum);
    const currentLimitMaximum = factQuantity(primary.facts.currentLimitMaximum);
    const saturationRating = factQuantity(inductor.facts.saturationCurrent);
    const inductanceMinimumFact = profileQuantityById<"H">(inductor, "inductanceMinimum");
    const inductanceMinimum = inductanceMinimumFact !== undefined
      && conditionsCover(
        inductanceMinimumFact.validFor,
        designRequest,
        switchingMinimum.value,
        { minimum: designRequest.requirements.maximumOutputCurrent.value, maximum: designRequest.requirements.maximumOutputCurrent.value },
      )
      ? factQuantity(inductanceMinimumFact)
      : undefined;
    const currentLimitEvidence = projectedEvidence(evidence(
      primary.facts.currentLimitMinimum,
      primary.facts.currentLimitTypical,
      primary.facts.currentLimitMaximum,
      primary.facts.currentLimitRole,
      primary.facts.switchingFrequencyMinimum,
      inductor.facts.inductance,
      inductor.facts.saturationCurrent,
      ...(inductanceMinimumFact === undefined ? [] : [inductanceMinimumFact]),
    ));
    const currentLimitFactsCover = currentLimitMinimum !== undefined
      && currentLimitMaximum !== undefined
      && primary.facts.currentLimitRole.state === "reviewed"
      && primary.facts.currentLimitRole.value === "protection_threshold"
      && [primary.facts.currentLimitMinimum, primary.facts.currentLimitMaximum, primary.facts.currentLimitRole]
        .every((fact) => conditionsCover(fact.validFor, designRequest, switchingMinimum.value));
    const currentLimitCalculation = calculateIntegratedBuckCurrentLimitV1({
      inputVoltageMaximumV: designRequest.requirements.inputVoltage.maximum.value,
      outputVoltageV: designRequest.requirements.outputVoltage.value,
      outputCurrentMaximumA: designRequest.requirements.maximumOutputCurrent.value,
      switchingFrequencyMinimumHz: switchingMinimum.value,
      inductanceMinimumH: inductanceMinimum?.value ?? null,
      currentLimitMinimumA: currentLimitFactsCover ? currentLimitMinimum?.value ?? null : null,
      requiredMarginRatio: config.currentLimitRequiredMarginRatio ?? null,
    });
    let currentLimitConstraint: ConstraintResult;
    if (
      currentLimitFactsCover
      && currentLimitMaximum
      && saturationRating
      && conditionsCover(inductor.facts.saturationCurrent.validFor, designRequest, frequency)
      && currentLimitMaximum.value > saturationRating.value
    ) {
      currentLimitConstraint = limitConstraint(
        "power.regulator.current-limit",
        currentLimitMaximum,
        saturationRating,
        "at_most",
        currentLimitEvidence,
        config.currentLimitRequiredMarginRatio === undefined
          ? `${currentObservationSummary} Independently of the nominal ripple projection, the maximum reviewed protection threshold exceeds the selected inductor saturation-current rating, so protection can act too late to preserve the inductor rating.`
          : `${currentObservationSummary} Independently of the minimum-threshold margin, the maximum reviewed protection threshold exceeds the selected inductor saturation-current rating, so protection can act too late to preserve the inductor rating.`,
      );
    } else if (currentLimitCalculation.disposition === "unknown") {
      currentLimitConstraint = observedUnknown(
        "power.regulator.current-limit",
        config.currentLimitRequiredMarginRatio === undefined
          ? `${currentObservationSummary} No protection-coordination pass is available: a threshold is not a peak-current clamp, and comparator delay, overshoot, off-time behavior, minimum inductance, feedback corners, and the load-mode envelope are not bounded.${currentObservation?.unsupportedReason ? ` The nominal CCM point is also unsupported because ${currentObservation.unsupportedReason}.` : ""}`
          : `Current-limit coordination is unknown because these required condition-covering inputs are missing: ${currentLimitCalculation.missingInputs.join(", ")}. A nominal inductance or typical threshold cannot improve feasibility.`,
        currentLimitEvidence,
        currentObservation?.nominalPointSupported ? q(currentObservation.peakCurrent, "A") : undefined,
        currentObservation?.nominalPointSupported ? currentLimitMinimum : undefined,
      );
    } else {
      currentLimitConstraint = {
        ruleId: "power.regulator.current-limit",
        status: currentLimitCalculation.disposition,
        actual: q(currentLimitCalculation.currentLimitMinimumA, "A"),
        limit: q(currentLimitCalculation.requiredCurrentLimitA, "A"),
        margin: q(currentLimitCalculation.marginA, "A"),
        explanation: `Using the condition-covering minimum inductance at maximum input and minimum switching frequency gives ${currentLimitCalculation.rippleCurrentA} A peak-to-peak ripple and ${currentLimitCalculation.peakInductorCurrentA} A peak current. The recipe requires ${(config.currentLimitRequiredMarginRatio! * 100)} percent margin, so the guaranteed minimum current limit must be at least ${currentLimitCalculation.requiredCurrentLimitA} A.`,
        evidence: currentLimitEvidence,
      };
    }

    const highSideResistanceFact = profileQuantityById<"ohm">(primary, "highSideOnResistance");
    const lowSideResistanceFact = profileQuantityById<"ohm">(primary, "lowSideOnResistance");
    const supplyCurrentFact = profileQuantityById<"A">(primary, "nonSwitchingSupplyCurrent");
    const thermalResistanceFact = profileQuantityById<"K/W">(primary, "thermalResistanceJunctionAmbient");
    const thermalBoardFact = profileTextById(primary, "thermalResistanceJunctionAmbientBoard");
    const lossInductanceMinimum = inductanceMinimumFact !== undefined
      && conditionsCover(inductanceMinimumFact.validFor, designRequest, switchingMinimum.value, {
        minimum: designRequest.requirements.maximumOutputCurrent.value,
        maximum: designRequest.requirements.maximumOutputCurrent.value,
      })
      && conditionsCover(inductanceMinimumFact.validFor, designRequest, switchingMaximum.value, {
        minimum: designRequest.requirements.maximumOutputCurrent.value,
        maximum: designRequest.requirements.maximumOutputCurrent.value,
      })
      ? factQuantity(inductanceMinimumFact)
      : undefined;
    const coveredLossMaximum = <Unit extends ProfileQuantity["unit"]>(
      factId: string,
      roleFactId: string,
    ): ProfileQuantity<Unit> | undefined => {
      const atMinimum = coveredGuaranteedMaximumByRole<Unit>(
        primary, factId, roleFactId, designRequest, switchingMinimum.value,
      );
      const atMaximum = coveredGuaranteedMaximumByRole<Unit>(
        primary, factId, roleFactId, designRequest, switchingMaximum.value,
      );
      return atMinimum !== undefined && atMaximum !== undefined ? atMaximum : undefined;
    };
    const lossInputs = {
      outputVoltageV: designRequest.requirements.outputVoltage.value,
      outputCurrentA: designRequest.requirements.maximumOutputCurrent.value,
      inductanceMinimumH: lossInductanceMinimum?.value ?? null,
      highSideOnResistanceMaximumOhm: coveredLossMaximum<"ohm">(
        "highSideOnResistance", "highSideOnResistanceRole",
      )?.value ?? null,
      lowSideOnResistanceMaximumOhm: coveredLossMaximum<"ohm">(
        "lowSideOnResistance", "lowSideOnResistanceRole",
      )?.value ?? null,
      nonSwitchingSupplyCurrentMaximumA: coveredLossMaximum<"A">(
        "nonSwitchingSupplyCurrent", "nonSwitchingSupplyCurrentRole",
      )?.value ?? null,
      switchingTransitionMaximumS: null,
    } as const;
    const lossCorners = [
      designRequest.requirements.inputVoltage.minimum.value,
      designRequest.requirements.inputVoltage.maximum.value,
    ].flatMap((inputVoltageV) => [switchingMinimum.value, switchingMaximum.value].map((switchingFrequencyHz) => (
      calculateIntegratedBuckLossV1({ ...lossInputs, inputVoltageV, switchingFrequencyHz })
    )));
    const unknownLossCorners = lossCorners.filter((corner) => corner.disposition === "unknown");
    const lossCalculation = unknownLossCorners.length === 0
      ? lossCorners.reduce((worst, corner) => (
          corner.disposition === "pass" && worst.disposition === "pass" && corner.totalLossW > worst.totalLossW
            ? corner
            : worst
        ))
      : {
          disposition: "unknown" as const,
          missingInputs: [...new Set(unknownLossCorners.flatMap((corner) => corner.missingInputs))].sort(),
        };
    const lossEvidence = projectedEvidence(evidence(
      ...(inductanceMinimumFact === undefined ? [] : [inductanceMinimumFact]),
      ...(highSideResistanceFact === undefined ? [] : [highSideResistanceFact]),
      ...(lowSideResistanceFact === undefined ? [] : [lowSideResistanceFact]),
      ...(supplyCurrentFact === undefined ? [] : [supplyCurrentFact]),
    ));
    const lossConstraint = config.primaryFactsSchemaVersion !== FACTS_SCHEMA_VERSION_V35
      ? unknownConstraint("power.thermal.loss-model", "Typical on-resistance and supply-current observations do not form a guaranteed full-stage loss model.")
      : lossCalculation.disposition === "unknown"
        ? unknownConstraint(
            "power.thermal.loss-model",
            `The integrated-stage loss model is unknown because these required condition-covering inputs are missing: ${lossCalculation.missingInputs.join(", ")}. Observed or typical values do not improve feasibility.`,
            lossEvidence,
          )
        : {
          ruleId: "power.thermal.loss-model",
          status: "pass" as const,
          actual: q(lossCalculation.totalLossW, "W"),
          explanation: `The bounded loss model totals ${lossCalculation.totalLossW} W: ${lossCalculation.conductionLossW} W conduction, ${lossCalculation.switchingLossW} W switching, and ${lossCalculation.quiescentLossW} W quiescent loss.`,
          evidence: lossEvidence,
        };
    const thermalResistance = thermalResistanceFact !== undefined
      && thermalBoardFact?.state === "reviewed"
      && thermalBoardFact.value === config.thermalResistanceBoardQualifier
      && conditionsCover(thermalResistanceFact.validFor, designRequest, switchingMinimum.value)
      && conditionsCover(thermalResistanceFact.validFor, designRequest, switchingMaximum.value)
      && conditionsCover(thermalBoardFact.validFor, designRequest, switchingMinimum.value)
      && conditionsCover(thermalBoardFact.validFor, designRequest, switchingMaximum.value)
      ? factQuantity(thermalResistanceFact)
      : undefined;
    const junctionCalculation = calculateIntegratedBuckJunctionTemperatureV1({
      totalLossW: lossCalculation.disposition === "pass" ? lossCalculation.totalLossW : null,
      ambientTemperatureK: designRequest.requirements.ambientTemperature.value,
      thermalResistanceJunctionAmbientMaximumKPerW: thermalResistance?.value ?? null,
      datasheetMaximumJunctionTemperatureK: maximumJunction.value,
      designMaximumJunctionTemperatureK: designRequest.constraints.maximumJunctionTemperature.value,
    });
    const junctionEvidence = projectedEvidence(evidence(
      primary.facts.maximumJunctionTemperature,
      ...(thermalResistanceFact === undefined ? [] : [thermalResistanceFact]),
      ...(thermalBoardFact === undefined ? [] : [thermalBoardFact]),
    ));
    const junctionConstraint = config.primaryFactsSchemaVersion !== FACTS_SCHEMA_VERSION_V35
      ? unknownConstraint("power.thermal.maximum-junction", "No reviewed loss, board-layout, and thermal calculation proves actual junction temperature.")
      : junctionCalculation.disposition === "unknown"
        ? unknownConstraint(
            "power.thermal.maximum-junction",
            `Junction temperature is unknown because these required condition-covering inputs are missing: ${[...new Set([
              ...junctionCalculation.missingInputs,
              ...(lossCalculation.disposition === "unknown" ? lossCalculation.missingInputs : []),
            ])].sort().join(", ")}. The board-qualified thermal bound cannot substitute for a missing loss bound.`,
            [...lossEvidence, ...junctionEvidence],
          )
        : {
          ruleId: "power.thermal.maximum-junction",
          status: junctionCalculation.disposition,
          actual: q(junctionCalculation.junctionTemperatureK, "K"),
          limit: q(junctionCalculation.limitK, "K"),
          margin: q(junctionCalculation.marginK, "K"),
          explanation: `At the declared ${config.thermalResistanceBoardQualifier} board and requested ambient, the bounded total loss projects ${junctionCalculation.junctionTemperatureK} K against the stricter ${junctionCalculation.limitK} K design or datasheet limit.`,
          evidence: [...lossEvidence, ...junctionEvidence],
        };
    const loadTransientConstraint = unknownConstraint(
      "power.request.load-transient",
      designRequest.requirements.loadTransientTarget == null
        ? "No numeric load-transient target is requested; no transient-response pass is claimed."
        : "The requested load transient has not been proved by a reviewed transient model.",
    );
    constraints.push(
      unknownConstraint("power.control.loop-stability", "No reviewed loop-gain or compensation model proves closed-loop stability for the selected stage."),
      selectedValueConstraint,
      unknownConstraint("power.passive.capacitor-effective-capacitance", "Rated voltage and nominal capacitance do not establish DC-biased effective capacitance, ripple current, ESR, or transient suitability.", projectedEvidence(capacitors.flatMap((profile) => evidence(profile.facts.nominalCapacitance, profile.facts.ratedVoltage)))),
      unknownConstraint("power.passive.bootstrap-effective-capacitance", "The selected bootstrap capacitor matches the required nominal value, but effective capacitance under its switching bias is not proved.", projectedEvidence(evidence(primary.facts.bootstrapCapacitance, primary.facts.bootstrapCapacitanceRequirement))),
      resistorConstraint,
      currentLimitConstraint,
      unknownConstraint("power.regulator.minimum-on-time", "The available minimum-on-time value is a condition-specific typical observation, not a guaranteed production bound.", projectedEvidence(evidence(primary.facts.minimumOnTime, primary.facts.minimumOnTimeRole))),
      unknownConstraint("power.regulator.minimum-off-time", "No reviewed minimum-off-time bound is available."),
      ...(config.omitLoadTransientConstraintWhenUnrequested && designRequest.requirements.loadTransientTarget == null
        ? []
        : [loadTransientConstraint]),
      unknownConstraint("power.request.output-ripple", "Output ripple has not been calculated from reviewed effective capacitance, ESR, inductance, and switching conditions."),
      lossConstraint,
      junctionConstraint,
    );
    if (designRequest.constraints.allowedPackages.length > 0) {
      constraints.push({
        ruleId: "power.assembly.allowed-packages",
        status: profiles.every((profile) => profile.commonFacts.packageName.value !== null && designRequest.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)) ? "pass" : "fail",
        explanation: "Every selected reviewed package name must occur in the exact user allowlist.",
        evidence: profiles.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)),
      });
    }
    if (designRequest.constraints.maximumComponentHeight !== null) {
      constraints.push(limitConstraint("power.assembly.component-height", q(Math.max(...profiles.map(profileHeight)), "m"), designRequest.constraints.maximumComponentHeight, "at_most", profiles.flatMap((profile) => projectedEvidence(profile.facts.mountedGeometry.maximumHeight.evidence)), "Every selected component fits the reviewed mounted-height limit."));
    }
    if (designRequest.constraints.maximumBoardArea !== null) {
      constraints.push(unknownConstraint("power.assembly.board-area", "The sum of reviewed mounted land-pattern projections is ranking-only and cannot prove a placed, routed, courtyard, or keep-out fit.", profiles.flatMap((profile) => projectedEvidence(profile.facts.mountedGeometry.boardArea.evidence))));
    }
    const orderedConstraints = constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
    if (config.evaluatePassiveSelectionV1 && outputCapacitor !== undefined) {
      const passive = evaluatedPassiveCombination(
        designRequest,
        primary,
        inductor,
        outputCapacitor,
        outputCapacitorQuantity,
      );
      if (passive === undefined) {
        return [unknownConstraint(
          "power.profile.passive-set",
          "The exact passive maximum-load observation envelope cannot be evaluated from reviewed regulator spread and selected profiles.",
        )];
      }
      const replacements = new Map(mappedPassiveConstraints(passive).map((constraint) => [constraint.ruleId, constraint]));
      if (config.primaryFactsSchemaVersion === FACTS_SCHEMA_VERSION_V35) {
        replacements.delete("power.thermal.loss-model");
      }
      return orderedConstraints.map((constraint) => replacements.get(constraint.ruleId) ?? constraint);
    }
    return orderedConstraints;
  },
  estimate(option, _constraints, environment) {
    const profiles = selectedProfiles(option, environment, config);
    const profileById = new Map(profiles.map((profile) => [designProfileId(profile.partClass, profile.part), profile]));
    const area = option.components.reduce((total, component) => {
      const profile = profileById.get(component.profileId);
      return profile === undefined
        ? total
        : canon(total + canon(profileArea(profile) * component.quantityPerAssembly));
    }, 0);
    const componentCount = option.components.reduce((total, component) => total + component.quantityPerAssembly, 0);
    const hasMultiQuantityLine = option.components.some((component) => component.quantityPerAssembly !== 1);
    let passiveMetrics: CandidateMetricV2[] = [];
    if (config.surfacePassiveOperatingObservationsV1) {
      const primary = primaryFromData(option.data, environment.catalog, config.primaryFactsSchemaVersion ?? FACTS_SCHEMA_VERSION_V33);
      const inductorComponent = matchedComponent(option, "power-inductor");
      const outputCapacitorComponent = matchedComponent(option, "output-capacitor");
      const inductor = inductorProfiles(environment.catalog, config.inductorContract).find((profile) => (
        selectedPartMatches(inductorComponent, profile)
      ));
      const outputCapacitor = capacitorProfiles(environment.catalog).find((profile) => (
        selectedPartMatches(outputCapacitorComponent, profile, outputCapacitorQuantity)
      ));
      passiveMetrics = primary === undefined || inductor === undefined || outputCapacitor === undefined
        ? unknownPassiveOperatingObservationMetrics(
            "The exact selected primary, inductor, or output-capacitor bank cannot be reproduced; no operating-current observation is emitted.",
          )
        : passiveOperatingObservationMetrics(
            request(environment),
            primary,
            inductor,
            outputCapacitor,
            outputCapacitorQuantity,
          );
    }
    return {
      metrics: [
        { id: "power.native.board-area", value: q(area, "m2"), state: "calculated", explanation: "Ranking-only sum of reviewed mounted land-pattern projections; not placement or routing proof.", evidence: profiles.flatMap((profile) => projectedEvidence(profile.facts.mountedGeometry.boardArea.evidence)) },
        { id: "power.native.component-count", value: q(componentCount, "count"), state: "calculated", explanation: hasMultiQuantityLine ? "Selected physical BOM quantity across all lines." : "Selected physical BOM line count.", evidence: [] },
        ...passiveMetrics,
      ],
      warnings: [],
    };
  },
  materialize(candidate) {
    return materialize(candidate, outputCapacitorQuantity);
  },
  };
}

export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckStructuralRecipe({
    release: RELEASE,
    optionKeyPrefix: "power-v3-3",
    inductorContract: { factsSchemaVersion: FACTS_SCHEMA_VERSION_V2 },
  });
