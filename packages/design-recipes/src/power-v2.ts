import {
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V3,
  absoluteMaximumRating,
  buildPowerClaimEvaluationContextV2,
  canonicalProfileNumberV2,
  designProfileId,
  getDesignProfileCodecForVersion,
  guaranteedLowerEndpoint,
  guaranteedMinimumCapability,
  guaranteedUpperEndpoint,
  parseDesignProfileForV2,
  parseDesignProfileForV3,
  recommendedSettingTarget,
  worstCaseProductionMaximum,
  worstCaseProductionMinimum,
  typicalProductionTarget,
  type ConfiguredProductionSpreadV2,
  type DesignProfileWithFactsV2,
  type DesignProfileV3,
  type FactsV2For,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
} from "@opencircuit/design-library/v2-runtime";
import {
  DESIGN_V2_MAX_OPTIONS_PER_RECIPE,
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
  type BuckDesignRequestV2,
  type ConstraintResult,
  type EvidenceRef,
  type Quantity,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import { limitConstraint, materializeBom, projectedEvidence, unknownConstraint } from "./common";
import { selectPowerFeedbackDividerV2 } from "./power-feedback-divider-v2";
import type {
  NativeCatalogV2,
  NativeEnvironmentV2,
  NativeMatchedOptionV2,
  NativeRecipeV2,
  NativeSolvedOptionV2,
} from "./types";

const RELEASE = {
  id: "power.native.facts-v2",
  version: "2.0.0",
  equations: ["power.claim-context.v2", "power.enumeration-preflight.v2", "power.feedback-divider.v2", "power.mounted-geometry-ranking-proxy.v2"],
} as const;

const RELEASE_V3 = {
  id: "power.native.facts-v3",
  version: "3.0.0",
  equations: ["power.claim-context.v2", "power.enumeration-preflight.v2", "power.feedback-divider.v2", "power.mounted-geometry-ranking-proxy.v2"],
} as const;

const METRIC_DECLARATIONS = [
  { id: "power.native.board-area", unit: "m2" as const },
  { id: "power.native.component-count", unit: "count" as const },
] as const;

const PRIMARY_CLASSES = [
  "power.integrated-synchronous-buck-regulator",
  "power.external-fet-synchronous-buck-controller",
] as const;

type IntegratedProfileV2 = DesignProfileWithFactsV2<
  "power.integrated-synchronous-buck-regulator",
  FactsV2For<"power.integrated-synchronous-buck-regulator">
>;
type ExternalProfileV2 = DesignProfileWithFactsV2<
  "power.external-fet-synchronous-buck-controller",
  FactsV2For<"power.external-fet-synchronous-buck-controller">
>;
type PrimaryProfileV2 = IntegratedProfileV2 | ExternalProfileV2;
type CapacitorProfileV2 = DesignProfileWithFactsV2<"shared.mlcc-capacitor", FactsV2For<"shared.mlcc-capacitor">>;
type InductorProfileV2 = DesignProfileWithFactsV2<"power.power-inductor", FactsV2For<"power.power-inductor">>;
type ResistorProfileV2 = DesignProfileWithFactsV2<"shared.general-purpose-resistor", FactsV2For<"shared.general-purpose-resistor">>;
type SenseResistorProfileV2 = DesignProfileWithFactsV2<"shared.current-sense-resistor", FactsV2For<"shared.current-sense-resistor">>;
type MosfetProfileV2 = DesignProfileWithFactsV2<"shared.n-channel-power-mosfet", FactsV2For<"shared.n-channel-power-mosfet">>;
type MosfetProfileV3 = DesignProfileV3<"shared.n-channel-power-mosfet">;
type MosfetProfile = MosfetProfileV2 | MosfetProfileV3;
type SelectedProfile = PrimaryProfileV2 | CapacitorProfileV2 | InductorProfileV2 | ResistorProfileV2 | SenseResistorProfileV2 | MosfetProfile;
type MosfetFactsSchemaVersion = typeof FACTS_SCHEMA_VERSION_V2 | typeof FACTS_SCHEMA_VERSION_V3;

interface PowerNativeRelease {
  readonly id: string;
  readonly version: string;
  readonly equations: readonly string[];
}

type PowerPrimaryScope = "mixed" | "external_only";

interface PowerNativeRecipeConfig {
  release: PowerNativeRelease;
  primaryScope: PowerPrimaryScope;
  mosfetFactsSchemaVersion: MosfetFactsSchemaVersion;
  optionKeyPrefix: string;
  missingExternalProfilesReason: string;
  simulationLimitation: string;
  materializationLabel: string;
  materialize?: NativeRecipeV2["materialize"];
}

function q(value: number, unit: Quantity["unit"]): Quantity {
  return { value, unit, displayUnit: unit };
}

function profileQuantityAsDesignQuantity(quantity: ProfileQuantity): Quantity {
  switch (quantity.unit) {
    case "C":
    case "J":
    case "K/W":
    case "1/K":
      throw new TypeError(`Profile-only unit cannot cross the design quantity boundary: ${quantity.unit}`);
    default:
      return q(quantity.value, quantity.unit);
  }
}

function exactText(data: Readonly<Record<string, null | boolean | number | string>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function exactNumber(data: Readonly<Record<string, null | boolean | number | string>>, key: string): number | undefined {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function profilesForV2<ClassId extends PartClassId>(
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

function mosfetProfiles(
  catalog: Readonly<NativeCatalogV2>,
  factsSchemaVersion: MosfetFactsSchemaVersion,
): MosfetProfile[] {
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) {
    return profilesForV2(catalog, "shared.n-channel-power-mosfet");
  }
  const codec = getDesignProfileCodecForVersion("shared.n-channel-power-mosfet", FACTS_SCHEMA_VERSION_V3);
  return catalog.profiles
    .filter((profile) => profile.partClass === "shared.n-channel-power-mosfet" && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V3)
    .map((profile) => parseDesignProfileForV3(codec, profile))
    .map((profile) => {
      const issue = codec.validateAdmission(profile)[0];
      if (issue) throw new TypeError(`Invalid admitted facts-V3 shared.n-channel-power-mosfet profile: ${issue.path}: ${issue.message}`);
      return profile;
    })
    .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
}

function primaryProfiles(
  catalog: Readonly<NativeCatalogV2>,
  scope: PowerPrimaryScope,
): PrimaryProfileV2[] {
  if (scope === "external_only") {
    return profilesForV2(catalog, "power.external-fet-synchronous-buck-controller");
  }
  return [
    ...profilesForV2(catalog, "power.integrated-synchronous-buck-regulator"),
    ...profilesForV2(catalog, "power.external-fet-synchronous-buck-controller"),
  ].sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
}

function primaryFromData(
  data: Readonly<Record<string, null | boolean | number | string>>,
  catalog: Readonly<NativeCatalogV2>,
  scope: PowerPrimaryScope,
): PrimaryProfileV2 | undefined {
  const profileId = exactText(data, "primaryProfileId");
  const partClass = exactText(data, "primaryPartClass");
  if (!profileId || (partClass !== PRIMARY_CLASSES[0] && partClass !== PRIMARY_CLASSES[1])) return undefined;
  if (scope === "external_only" && partClass !== "power.external-fet-synchronous-buck-controller") return undefined;
  return primaryProfiles(catalog, scope).find((profile) => profile.partClass === partClass && designProfileId(profile.partClass, profile.part) === profileId);
}

function buckRequest(environment: Readonly<NativeEnvironmentV2>): Readonly<BuckDesignRequestV2> {
  if (environment.request.application !== "power.buck") throw new TypeError("Power facts-V2 recipe requires a power.buck request");
  return environment.request;
}

function context(
  request: Readonly<BuckDesignRequestV2>,
  selectedSwitchingFrequency: ProfileQuantity<"Hz"> | null,
) {
  return buildPowerClaimEvaluationContextV2(request, {
    selectedSwitchingFrequency,
    switchCurrent: null,
    operatingMode: null,
    boardLayout: null,
  });
}

function selectedFrequency(
  primary: PrimaryProfileV2,
  request: Readonly<BuckDesignRequestV2>,
): { value?: ProfileQuantity<"Hz">; evidence: readonly ProfileEvidenceRef[]; reason?: string } {
  if (request.requirements.switchingFrequency.selection === "fixed") {
    const preferred = request.requirements.switchingFrequency.preferred;
    return preferred === null
      ? { evidence: [], reason: "Fixed switching-frequency selection is missing its required preferred point." }
      : { value: preferred, evidence: [] };
  }
  const resolution = recommendedSettingTarget(primary.facts.switchingFrequencyRecommended, context(request, null));
  return resolution.status === "known"
    ? { value: resolution.quantity, evidence: resolution.evidence }
    : { evidence: primary.facts.switchingFrequencyRecommended.evidence, reason: `Recommended switching-frequency selection is unknown (${resolution.reason}${resolution.parameterId === null ? "" : `: ${resolution.parameterId}`}).` };
}

function configuredOption(
  options: readonly ConfiguredProductionSpreadV2<"V">[],
  settingId: string | undefined,
): ConfiguredProductionSpreadV2<"V"> | undefined {
  return settingId === undefined ? undefined : options.find((option) => option.settingId === settingId);
}

function configuredValues(
  option: ConfiguredProductionSpreadV2<"V">,
  claimContext: ReturnType<typeof context>,
): { minimum: number | null; typical: number | null; maximum: number | null; evidence: readonly ProfileEvidenceRef[] } {
  const minimum = worstCaseProductionMinimum(option.minimum, claimContext);
  const typical = typicalProductionTarget(option.typical, claimContext);
  const maximum = worstCaseProductionMaximum(option.maximum, claimContext);
  return {
    minimum: minimum.status === "known" ? minimum.quantity.value : null,
    typical: typical.status === "known" ? typical.quantity.value : null,
    maximum: maximum.status === "known" ? maximum.quantity.value : null,
    evidence: [
      ...option.setting.evidence,
      ...option.minimum.evidence,
      ...option.typical.evidence,
      ...option.maximum.evidence,
    ],
  };
}

function selectedComponent<Unit extends Quantity["unit"]>(
  id: string,
  role: string,
  profile: SelectedProfile,
  fact?: ProfileFact<ProfileQuantity<Unit>>,
): SelectedComponent {
  return {
    id,
    role,
    profileId: designProfileId(profile.partClass, profile.part),
    part: { ...profile.part },
    quantityPerAssembly: 1,
    ...(fact?.value === null ? {} : fact === undefined ? {} : { value: { value: fact.value.value, unit: fact.value.unit, displayUnit: fact.value.displayUnit } }),
    evidence: projectedEvidence(fact?.evidence ?? profile.commonFacts.packageName.evidence),
  };
}

function findById<Profile extends SelectedProfile>(profiles: readonly Profile[], profileId: string): Profile | undefined {
  return profiles.find((profile) => designProfileId(profile.partClass, profile.part) === profileId);
}

function selectedProfiles(
  option: Readonly<NativeMatchedOptionV2>,
  environment: Readonly<NativeEnvironmentV2>,
  mosfetFactsSchemaVersion: MosfetFactsSchemaVersion,
  primaryScope: PowerPrimaryScope,
): SelectedProfile[] {
  const byRole = new Map(option.components.map((component) => [component.id, component]));
  const primary = primaryFromData(option.data, environment.catalog, primaryScope);
  const capacitors = profilesForV2(environment.catalog, "shared.mlcc-capacitor");
  const inductors = profilesForV2(environment.catalog, "power.power-inductor");
  const resistors = profilesForV2(environment.catalog, "shared.general-purpose-resistor");
  const senseResistors = profilesForV2(environment.catalog, "shared.current-sense-resistor");
  const mosfets = mosfetProfiles(environment.catalog, mosfetFactsSchemaVersion);
  const resolve = <Profile extends SelectedProfile>(id: string, profiles: readonly Profile[]): Profile | undefined => {
    const profileId = byRole.get(id)?.profileId;
    return profileId === undefined ? undefined : findById(profiles, profileId);
  };
  return [
    primary,
    resolve("feedback-lower", resistors),
    resolve("feedback-upper", resistors),
    resolve("input-capacitor", capacitors),
    resolve("output-capacitor", capacitors),
    resolve("power-inductor", inductors),
    resolve("current-sense-resistor", senseResistors),
    resolve("high-side-mosfet", mosfets),
    resolve("low-side-mosfet", mosfets),
  ].filter((profile): profile is SelectedProfile => profile !== undefined);
}

function profileGeometryArea(profile: SelectedProfile): number {
  const fact = profile.facts.mountedGeometry.boardArea;
  if (fact.state !== "calculated" || fact.value === null) throw new TypeError("Missing calculated facts-V2 mounted board-area proxy");
  return fact.value.area.value;
}

function profileGeometryHeight(profile: SelectedProfile): number {
  const fact = profile.facts.mountedGeometry.maximumHeight;
  if (fact.state !== "reviewed" || fact.value === null) throw new TypeError("Missing reviewed facts-V2 mounted maximum height");
  return fact.value.height.value;
}

function geometryEvidence(profile: SelectedProfile): EvidenceRef[] {
  return projectedEvidence([
    ...profile.facts.mountedGeometry.boardArea.evidence,
    ...profile.facts.mountedGeometry.maximumHeight.evidence,
  ]);
}

function endpointConstraint(
  ruleId: string,
  actual: Quantity,
  resolution: ReturnType<typeof guaranteedLowerEndpoint>,
  direction: "at_least" | "at_most",
  claimEvidence: readonly ProfileEvidenceRef[],
  explanation: string,
): ConstraintResult {
  if (resolution.status === "unknown") {
    return unknownConstraint(ruleId, `${explanation} The exact reviewed bound is unknown (${resolution.reason}${resolution.parameterId === null ? "" : `: ${resolution.parameterId}`}).`, projectedEvidence(claimEvidence));
  }
  return limitConstraint(ruleId, actual, profileQuantityAsDesignQuantity(resolution.quantity), direction, projectedEvidence(resolution.evidence), explanation);
}

function commonUnknownConstraints(
  request: Readonly<BuckDesignRequestV2>,
  primary: PrimaryProfileV2,
  inductor: InductorProfileV2,
  inputCapacitor: CapacitorProfileV2,
  outputCapacitor: CapacitorProfileV2,
  feedbackUpper: ResistorProfileV2,
  feedbackLower: ResistorProfileV2,
): ConstraintResult[] {
  const currentLimitEvidence = primary.partClass === "power.integrated-synchronous-buck-regulator"
    ? primary.facts.currentLimitMinimum.evidence
    : primary.facts.currentSenseThresholdOptions.flatMap((option) => option.minimum.evidence);
  return [
    unknownConstraint("power.control.loop-stability", "No reviewed loop-gain or compensation model proves closed-loop stability for the selected stage."),
    unknownConstraint("power.inductor.ripple-current", "Ripple, peak, and RMS inductor current have not been proved at the selected switching point.", projectedEvidence([...inductor.facts.saturationCurrent.evidence, ...inductor.facts.rmsCurrent.evidence])),
    unknownConstraint("power.inductor.selected-value", "The selected inductance has not been proved by a reviewed sizing equation at the request voltage, current, ripple, and switching conditions.", projectedEvidence(inductor.facts.inductance.evidence)),
    unknownConstraint("power.passive.capacitor-voltage", "Capacitor voltage derating and effective-capacitance headroom remain unproved for the requested rails.", projectedEvidence([...inputCapacitor.facts.ratedVoltage.evidence, ...outputCapacitor.facts.ratedVoltage.evidence])),
    unknownConstraint("power.passive.resistor-power-voltage", "Feedback-resistor continuous-power and working-voltage margins remain unproved.", projectedEvidence([...feedbackUpper.facts.continuousPower.evidence, ...feedbackUpper.facts.workingVoltage.evidence, ...feedbackLower.facts.continuousPower.evidence, ...feedbackLower.facts.workingVoltage.evidence])),
    unknownConstraint("power.regulator.current-limit", "Guaranteed minimum current limit has not been compared with a proved inductor peak-current envelope.", projectedEvidence(currentLimitEvidence)),
    unknownConstraint("power.regulator.minimum-off-time", "Worst-case off time has not been calculated and proved against the reviewed production-spread maximum.", projectedEvidence(primary.facts.minimumOffTimeMaximum.evidence)),
    unknownConstraint("power.regulator.minimum-on-time", "Worst-case on time has not been calculated and proved against the reviewed production-spread maximum.", projectedEvidence(primary.facts.minimumOnTimeMaximum.evidence)),
    unknownConstraint("power.request.load-transient", request.requirements.loadTransientTarget === null
      ? "No numeric load-transient target is requested, and no transient-response pass is claimed."
      : "The requested load step, output deviation, and settling time have not been proved by a reviewed transient model."),
    unknownConstraint("power.request.output-ripple", "Output ripple has not been calculated from reviewed effective capacitance, ESR, inductance, and switching conditions."),
    unknownConstraint("power.thermal.ambient-range", "The request ambient point has not been proved against every selected semiconductor and passive operating range."),
    unknownConstraint("power.thermal.loss-model", "No complete reviewed conduction, switching, controller, magnetic, and passive loss model is available."),
    unknownConstraint("power.thermal.maximum-junction", "No reviewed loss, board-layout, and thermal calculation proves actual junction temperature."),
  ];
}

function optionKey(data: Readonly<Record<string, null | boolean | number | string>>, prefix: PowerNativeRecipeConfig["optionKeyPrefix"]): string {
  return `${prefix}:${designSha256ContentHash(canonicalDesignV2Payload(data))}`;
}

function preflightEnumerationWork(
  integratedProfiles: readonly IntegratedProfileV2[],
  externalProfiles: readonly ExternalProfileV2[],
  recipeId: string,
): void {
  const work = externalProfiles.reduce(
    (total, profile) => total
      + BigInt(profile.facts.currentSenseThresholdOptions.length)
        * BigInt(profile.facts.gateDriveVoltageOptions.length),
    BigInt(integratedProfiles.length),
  );
  if (work > BigInt(DESIGN_V2_MAX_OPTIONS_PER_RECIPE)) {
    throw new RangeError(`${recipeId}:enumerate:resource_limit:${work.toString()}>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`);
  }
}

function createPowerNativeRecipe(config: PowerNativeRecipeConfig): NativeRecipeV2 {
  const { release } = config;
  return {
  id: release.id,
  version: release.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(release)),
  applications: ["power.buck"],
  metricDeclarations: METRIC_DECLARATIONS.map((entry) => ({ ...entry })),
  supports(request) {
    return request.application === "power.buck" && request.constraints.allowedTopologyFamilies.some((topology) => (
      topology === "power.buck.controller-external-nmos"
      || (config.primaryScope === "mixed" && topology === "power.buck.integrated-synchronous")
    ));
  },
  enumerate(environment) {
    const request = buckRequest(environment);
    const integratedProfiles = config.primaryScope === "mixed"
      && request.constraints.allowedTopologyFamilies.includes("power.buck.integrated-synchronous")
      ? profilesForV2(environment.catalog, "power.integrated-synchronous-buck-regulator")
      : [];
    const externalProfiles = request.constraints.allowedTopologyFamilies.includes("power.buck.controller-external-nmos")
      ? profilesForV2(environment.catalog, "power.external-fet-synchronous-buck-controller")
      : [];
    preflightEnumerationWork(integratedProfiles, externalProfiles, release.id);
    const options: Array<{ optionKey: string; data: Record<string, null | boolean | number | string> }> = [];
    for (const profile of integratedProfiles) {
      const data = {
        primaryPartClass: profile.partClass,
        primaryProfileId: designProfileId(profile.partClass, profile.part),
        currentSenseSettingId: null,
        gateDriveSettingId: null,
      };
      options.push({ optionKey: optionKey(data, config.optionKeyPrefix), data });
    }
    for (const profile of externalProfiles) {
      for (const currentSense of profile.facts.currentSenseThresholdOptions) {
        for (const gateDrive of profile.facts.gateDriveVoltageOptions) {
          const data = {
            primaryPartClass: profile.partClass,
            primaryProfileId: designProfileId(profile.partClass, profile.part),
            currentSenseSettingId: currentSense.settingId,
            gateDriveSettingId: gateDrive.settingId,
          };
          options.push({ optionKey: optionKey(data, config.optionKeyPrefix), data });
        }
      }
    }
    return options.sort((left, right) => compareDesignV2Tokens(left.optionKey, right.optionKey));
  },
  solve(option, environment) {
    const request = buckRequest(environment);
    const primary = primaryFromData(option.data, environment.catalog, config.primaryScope);
    if (!primary) return { status: "rejected", reason: "The exact facts-V2 primary profile is absent from the mixed reviewed catalog." };
    const frequency = selectedFrequency(primary, request);
    const primaryId = designProfileId(primary.partClass, primary.part);
    if (!frequency.value) {
      return {
        status: "rejected",
        reason: frequency.reason ?? "Switching-frequency selection is unknown.",
        constraints: [unknownConstraint("power.request.switching-selection", frequency.reason ?? "Switching-frequency selection is unknown.", projectedEvidence(frequency.evidence))],
        componentProfileIds: [primaryId],
      };
    }
    if (frequency.value.value < request.requirements.switchingFrequency.minimum.value || frequency.value.value > request.requirements.switchingFrequency.maximum.value) {
      return { status: "rejected", reason: "The exact selected switching frequency is outside the requested interval.", componentProfileIds: [primaryId] };
    }
    const claimContext = context(request, frequency.value);
    const data: Record<string, null | boolean | number | string> = {
      ...option.data,
      selectedSwitchingFrequency: frequency.value.value,
      currentSenseThresholdMinimum: null,
      currentSenseThresholdTypical: null,
      currentSenseThresholdMaximum: null,
      gateDriveVoltageMinimum: null,
      gateDriveVoltageTypical: null,
      gateDriveVoltageMaximum: null,
    };
    const derivedValues: NativeSolvedOptionV2["derivedValues"] = [{
      id: "power.selected-switching-frequency",
      value: { ...frequency.value },
      equationId: request.requirements.switchingFrequency.selection === "fixed" ? "power.request-fixed-frequency.v2" : "power.recommended-frequency.v2",
      state: "calculated",
      evidence: projectedEvidence(frequency.evidence),
    }];
    if (primary.partClass === "power.external-fet-synchronous-buck-controller") {
      const currentSense = configuredOption(primary.facts.currentSenseThresholdOptions, exactText(option.data, "currentSenseSettingId"));
      const gateDrive = configuredOption(primary.facts.gateDriveVoltageOptions, exactText(option.data, "gateDriveSettingId"));
      if (!currentSense || !gateDrive) return { status: "rejected", reason: "The exact configured controller option is absent from the reviewed profile.", componentProfileIds: [primaryId] };
      const senseValues = configuredValues(currentSense, claimContext);
      const gateValues = configuredValues(gateDrive, claimContext);
      data.currentSenseThresholdMinimum = senseValues.minimum;
      data.currentSenseThresholdTypical = senseValues.typical;
      data.currentSenseThresholdMaximum = senseValues.maximum;
      data.gateDriveVoltageMinimum = gateValues.minimum;
      data.gateDriveVoltageTypical = gateValues.typical;
      data.gateDriveVoltageMaximum = gateValues.maximum;
      for (const [id, value, evidence] of [
        ["power.current-sense-threshold-minimum", senseValues.minimum, senseValues.evidence],
        ["power.current-sense-threshold-typical", senseValues.typical, senseValues.evidence],
        ["power.current-sense-threshold-maximum", senseValues.maximum, senseValues.evidence],
        ["power.gate-drive-voltage-minimum", gateValues.minimum, gateValues.evidence],
        ["power.gate-drive-voltage-typical", gateValues.typical, gateValues.evidence],
        ["power.gate-drive-voltage-maximum", gateValues.maximum, gateValues.evidence],
      ] as const) {
        if (value !== null) derivedValues.push({ id, value: q(value, "V"), equationId: "power.configured-production-spread.v2", state: "calculated", evidence: projectedEvidence(evidence) });
      }
    }
    return { status: "ok", value: { data, derivedValues } };
  },
  match(option, environment) {
    const request = buckRequest(environment);
    const primary = primaryFromData(option.data, environment.catalog, config.primaryScope);
    if (!primary) return [{ status: "rejected", reason: "The solved facts-V2 primary profile is no longer present in the exact catalog." }];
    const frequency = exactNumber(option.data, "selectedSwitchingFrequency");
    if (frequency === undefined) return [{ status: "rejected", reason: "The solved option lost its exact switching-frequency selection." }];
    const claimContext = context(request, { value: frequency, unit: "Hz", displayUnit: "Hz" });
    const capacitors = profilesForV2(environment.catalog, "shared.mlcc-capacitor");
    const inductors = profilesForV2(environment.catalog, "power.power-inductor");
    const resistors = profilesForV2(environment.catalog, "shared.general-purpose-resistor");
    const inputCapacitor = capacitors[0];
    const outputCapacitor = capacitors[0];
    const inductor = inductors[0];
    const primaryId = designProfileId(primary.partClass, primary.part);
    if (!inputCapacitor || !outputCapacitor || !inductor) return [{ status: "rejected", reason: "No exact reviewed facts-V2 capacitor and inductor set is available.", componentProfileIds: [primaryId] }];
    const divider = selectPowerFeedbackDividerV2({
      primaryPartClass: primary.partClass,
      primaryProfile: primary,
      resistorProfiles: resistors,
      requestedOutputVoltage: request.requirements.outputVoltage,
      claimContext,
    });
    if (divider.status === "unknown") {
      return [{ status: "rejected", reason: `Feedback-divider proof is unknown (${divider.reason}).`, constraints: [unknownConstraint("power.feedback.output-voltage", `Feedback-divider proof is unknown (${divider.reason}).`)], componentProfileIds: [primaryId] }];
    }
    if (divider.status === "rejected") {
      const componentProfileIds = "upperProfileId" in divider ? [primaryId, divider.upperProfileId, divider.lowerProfileId].sort(compareDesignV2Tokens) : [primaryId];
      return [{ status: "rejected", reason: `Feedback-divider selection rejected (${divider.reason}).`, constraints: [{ ruleId: "power.feedback.output-voltage", status: "fail", explanation: `Worst-case feedback-divider corners exceed the exact one-percent bound (${divider.reason}).`, evidence: [] }], componentProfileIds }];
    }
    const feedbackUpper = findById(resistors, divider.upperProfileId);
    const feedbackLower = findById(resistors, divider.lowerProfileId);
    if (!feedbackUpper || !feedbackLower) return [{ status: "rejected", reason: "The selected exact divider profiles are no longer present in the reviewed catalog.", componentProfileIds: [primaryId] }];
    const components: SelectedComponent[] = [
      selectedComponent("feedback-lower", "feedback-lower-resistor", feedbackLower, feedbackLower.facts.resistance),
      selectedComponent("feedback-upper", "feedback-upper-resistor", feedbackUpper, feedbackUpper.facts.resistance),
      selectedComponent("input-capacitor", "input-capacitor", inputCapacitor, inputCapacitor.facts.nominalCapacitance),
      selectedComponent("output-capacitor", "output-capacitor", outputCapacitor, outputCapacitor.facts.nominalCapacitance),
      selectedComponent("power-inductor", "power-inductor", inductor, inductor.facts.inductance),
      selectedComponent("primary", primary.partClass === "power.integrated-synchronous-buck-regulator" ? "integrated-synchronous-buck-regulator" : "external-fet-synchronous-buck-controller", primary),
    ];
    if (primary.partClass === "power.external-fet-synchronous-buck-controller") {
      const mosfet = mosfetProfiles(environment.catalog, config.mosfetFactsSchemaVersion)[0];
      const senseResistor = profilesForV2(environment.catalog, "shared.current-sense-resistor")[0];
      if (!mosfet || !senseResistor) return [{ status: "rejected", reason: config.missingExternalProfilesReason, componentProfileIds: [primaryId] }];
      components.push(
        selectedComponent("current-sense-resistor", "current-sense-resistor", senseResistor, senseResistor.facts.resistance),
        selectedComponent("high-side-mosfet", "high-side-n-channel-power-mosfet", mosfet),
        selectedComponent("low-side-mosfet", "low-side-n-channel-power-mosfet", mosfet),
      );
    }
    const boardAreaProxy = canonicalProfileNumberV2(components.reduce((total, component) => {
      const profile = [primary, inputCapacitor, outputCapacitor, inductor, feedbackUpper, feedbackLower,
        ...mosfetProfiles(environment.catalog, config.mosfetFactsSchemaVersion), ...profilesForV2(environment.catalog, "shared.current-sense-resistor")]
        .find((candidate) => designProfileId(candidate.partClass, candidate.part) === component.profileId);
      return canonicalProfileNumberV2(total + (profile === undefined ? 0 : profileGeometryArea(profile)));
    }, 0));
    return [{ status: "ok", value: {
      data: {
        ...option.data,
        feedbackNominalOutputVoltage: divider.nominal.outputVoltage,
        feedbackLowCornerError: divider.lowCorner.error,
        feedbackHighCornerError: divider.highCorner.error,
        feedbackThreshold: divider.threshold,
        boardAreaRankingProxy: boardAreaProxy,
      },
      derivedValues: option.derivedValues,
      components: components.sort((left, right) => compareDesignV2Tokens(left.id, right.id)),
      simulationCoverage: [{ scenarioId: "catalog-native-model", modelTier: "unavailable", limitations: [config.simulationLimitation] }],
      warnings: [],
    } }];
  },
  check(option, environment) {
    const request = buckRequest(environment);
    const primary = primaryFromData(option.data, environment.catalog, config.primaryScope);
    if (!primary) return [unknownConstraint("power.profile.primary", "The exact facts-V2 primary profile is unavailable during constraint evaluation.")];
    const frequency = exactNumber(option.data, "selectedSwitchingFrequency");
    if (frequency === undefined) return [unknownConstraint("power.request.switching-selection", "The exact selected switching frequency is unavailable during constraint evaluation.")];
    const claimContext = context(request, { value: frequency, unit: "Hz", displayUnit: "Hz" });
    const profiles = selectedProfiles(option, environment, config.mosfetFactsSchemaVersion, config.primaryScope);
    const capacitorProfiles = profiles.filter((profile): profile is CapacitorProfileV2 => profile.partClass === "shared.mlcc-capacitor");
    const inductor = profiles.find((profile): profile is InductorProfileV2 => profile.partClass === "power.power-inductor");
    const resistorProfiles = profiles.filter((profile): profile is ResistorProfileV2 => profile.partClass === "shared.general-purpose-resistor");
    if (!inductor || capacitorProfiles.length < 2 || resistorProfiles.length < 2) return [unknownConstraint("power.profile.passive-set", "The exact solved passive set is unavailable during constraint evaluation.")];
    const inputMinimum = guaranteedLowerEndpoint(primary.facts.inputVoltageMinimum, claimContext);
    const inputMaximum = guaranteedUpperEndpoint(primary.facts.inputVoltageMaximum, claimContext);
    const outputMinimum = guaranteedLowerEndpoint(primary.facts.outputVoltageMinimum, claimContext);
    const outputMaximum = guaranteedUpperEndpoint(primary.facts.outputVoltageMaximum, claimContext);
    const switchingMinimum = guaranteedLowerEndpoint(primary.facts.switchingFrequencyMinimum, claimContext);
    const switchingMaximum = guaranteedUpperEndpoint(primary.facts.switchingFrequencyMaximum, claimContext);
    const constraints: ConstraintResult[] = [
      endpointConstraint("power.regulator.input-minimum", request.requirements.inputVoltage.minimum, inputMinimum, "at_least", primary.facts.inputVoltageMinimum.evidence, "Requested minimum input is not below the guaranteed operating endpoint."),
      endpointConstraint("power.regulator.input-maximum", request.requirements.inputVoltage.maximum, inputMaximum, "at_most", primary.facts.inputVoltageMaximum.evidence, "Requested maximum input does not exceed the guaranteed operating endpoint."),
      endpointConstraint("power.regulator.output-minimum", request.requirements.outputVoltage, outputMinimum, "at_least", primary.facts.outputVoltageMinimum.evidence, "Requested output is not below the guaranteed operating endpoint."),
      endpointConstraint("power.regulator.output-maximum", request.requirements.outputVoltage, outputMaximum, "at_most", primary.facts.outputVoltageMaximum.evidence, "Requested output does not exceed the guaranteed operating endpoint."),
      endpointConstraint("power.regulator.switching-minimum", q(frequency, "Hz"), switchingMinimum, "at_least", primary.facts.switchingFrequencyMinimum.evidence, "Selected switching frequency is not below the guaranteed endpoint."),
      endpointConstraint("power.regulator.switching-maximum", q(frequency, "Hz"), switchingMaximum, "at_most", primary.facts.switchingFrequencyMaximum.evidence, "Selected switching frequency does not exceed the guaranteed endpoint."),
    ];
    if (primary.partClass === "power.integrated-synchronous-buck-regulator") {
      const current = guaranteedMinimumCapability(primary.facts.outputCurrentCapabilityMinimum, claimContext);
      constraints.push(endpointConstraint("power.regulator.output-current", request.requirements.maximumOutputCurrent, current, "at_most", primary.facts.outputCurrentCapabilityMinimum.evidence, "Requested output current does not exceed the guaranteed minimum capability."));
    } else {
      const currentSenseSettingId = exactText(option.data, "currentSenseSettingId");
      const gateDriveSettingId = exactText(option.data, "gateDriveSettingId");
      const currentSense = configuredOption(primary.facts.currentSenseThresholdOptions, currentSenseSettingId);
      const gateDrive = configuredOption(primary.facts.gateDriveVoltageOptions, gateDriveSettingId);
      if (currentSense && gateDrive && currentSenseSettingId && gateDriveSettingId) {
        constraints.push(
          { ruleId: `power.controller.current-sense-setting.${currentSenseSettingId}`, status: "pass", explanation: `Reviewed current-sense setting ${currentSenseSettingId} was selected before its production-spread claims were resolved.`, evidence: projectedEvidence(currentSense.setting.evidence) },
          { ruleId: `power.controller.gate-drive-setting.${gateDriveSettingId}`, status: "pass", explanation: `Reviewed gate-drive setting ${gateDriveSettingId} was selected before its production-spread claims were resolved.`, evidence: projectedEvidence(gateDrive.setting.evidence) },
        );
      } else {
        constraints.push(unknownConstraint("power.controller.configured-options", "The exact reviewed configured controller options are unavailable."));
      }
      constraints.push(
        unknownConstraint("power.controller.current-sense-feasibility", "The selected threshold spread has not been combined with a proved shunt, ripple, and current-limit equation."),
        unknownConstraint("power.controller.gate-drive-compatibility", "The selected gate-drive spread has not been proved against the exact MOSFET gate-charge and safe-drive requirements."),
        unknownConstraint("power.controller.dead-time", "Dead-time and body-diode commutation loss have not been proved for the selected MOSFET pair."),
        unknownConstraint("power.external.mosfet-safe-operating-area", "The selected external MOSFETs have no proved switching safe-operating-area, avalanche, or transient stress envelope."),
      );
    }
    const maximumJunction = absoluteMaximumRating(primary.facts.maximumJunctionTemperature, claimContext);
    constraints.push(endpointConstraint("power.regulator.absolute-maximum-junction", request.constraints.maximumJunctionTemperature, maximumJunction, "at_most", primary.facts.maximumJunctionTemperature.evidence, "Requested maximum junction limit does not exceed the absolute rating; actual thermal feasibility remains separate."));
    const feedbackError = Math.max(exactNumber(option.data, "feedbackLowCornerError") ?? Number.POSITIVE_INFINITY, exactNumber(option.data, "feedbackHighCornerError") ?? Number.POSITIVE_INFINITY);
    const feedbackThreshold = exactNumber(option.data, "feedbackThreshold") ?? 0;
    constraints.push(limitConstraint("power.feedback.output-voltage", q(feedbackError, "V"), q(feedbackThreshold, "V"), "at_most", projectedEvidence([
      ...primary.facts.feedbackReferenceMinimum.evidence,
      ...primary.facts.feedbackReferenceTypical.evidence,
      ...primary.facts.feedbackReferenceMaximum.evidence,
      ...resistorProfiles.flatMap((profile) => [...profile.facts.resistance.evidence, ...profile.facts.tolerance.evidence]),
    ]), "Worst-case feedback-reference and resistor-tolerance corners remain within one percent."));
    constraints.push(...commonUnknownConstraints(request, primary, inductor, capacitorProfiles[0]!, capacitorProfiles[1]!, resistorProfiles[0]!, resistorProfiles[1]!));
    if (request.constraints.allowedPackages.length > 0) {
      constraints.push({
        ruleId: "power.assembly.allowed-packages",
        status: profiles.every((profile) => profile.commonFacts.packageName.value !== null && request.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)) ? "pass" : "fail",
        explanation: "Every selected reviewed package name must occur in the exact user allowlist.",
        evidence: profiles.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)),
      });
    }
    if (request.constraints.maximumComponentHeight !== null) {
      constraints.push(limitConstraint(
        "power.assembly.component-height",
        q(Math.max(...profiles.map(profileGeometryHeight)), "m"),
        request.constraints.maximumComponentHeight,
        "at_most",
        profiles.flatMap(geometryEvidence),
        "Every selected component fits the reviewed mounted-height limit.",
      ));
    }
    if (request.constraints.maximumBoardArea !== null) {
      constraints.push(unknownConstraint(
        "power.assembly.board-area",
        "The sum of reviewed mounted land-pattern projections is ranking-only and cannot prove a placed, routed, courtyard, or keep-out fit.",
        profiles.flatMap(geometryEvidence),
      ));
    }
    return constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
  },
  estimate(option, _constraints, environment) {
    if (config.primaryScope === "external_only" && primaryFromData(option.data, environment.catalog, config.primaryScope) === undefined) {
      throw new TypeError("The dedicated external-FET recipe cannot estimate a non-controller primary option");
    }
    const profiles = selectedProfiles(option, environment, config.mosfetFactsSchemaVersion, config.primaryScope);
    const boardArea = profiles.reduce((total, profile) => canonicalProfileNumberV2(total + profileGeometryArea(profile)), 0);
    return {
      metrics: [
        { id: "power.native.board-area", value: q(boardArea, "m2"), state: "calculated", explanation: "Ranking-only sum of reviewed mounted land-pattern projections; not placement or routing proof.", evidence: profiles.flatMap(geometryEvidence) },
        { id: "power.native.component-count", value: q(option.components.length, "count"), state: "calculated", explanation: "Selected physical BOM line count.", evidence: [] },
      ],
      warnings: [],
    };
  },
  materialize(candidate, environment) {
    if (config.materialize !== undefined) return config.materialize(candidate, environment);
    const nonRepresentedIds = new Set(candidate.components
      .filter((component) => component.id === "primary" || component.id === "high-side-mosfet" || component.id === "low-side-mosfet")
      .map((component) => component.id));
    return materializeBom(candidate, config.materializationLabel, nonRepresentedIds);
  },
  };
}

export const POWER_NATIVE_RECIPE_FACTS_V2 = createPowerNativeRecipe({
  release: RELEASE,
  primaryScope: "mixed",
  mosfetFactsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
  optionKeyPrefix: "power-v2",
  missingExternalProfilesReason: "External-controller topology lacks exact reviewed facts-V2 MOSFET or current-sense profiles.",
  simulationLimitation: "No reviewed executable model is bundled for the exact facts-V2 primary and selected stage.",
  materializationLabel: "Catalog-native facts-V2 synchronous buck",
});

export const POWER_NATIVE_RECIPE_FACTS_V3 = createPowerNativeRecipe({
  release: RELEASE_V3,
  primaryScope: "mixed",
  mosfetFactsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
  optionKeyPrefix: "power-v3",
  missingExternalProfilesReason: "External-controller topology lacks an exact reviewed facts-V3 MOSFET or exact reviewed facts-V2 current-sense profile.",
  simulationLimitation: "No reviewed executable model is bundled for the exact facts-V2 primary and selected facts-V3 MOSFET stage.",
  materializationLabel: "Catalog-native mixed facts-V2/V3 synchronous buck",
});

/** Engine-internal constructor for the class-restricted external-FET facts-V3 leaf. */
export function createPowerNativeExternalFactsV3Recipe(
  release: PowerNativeRelease,
  materialize: NativeRecipeV2["materialize"],
): NativeRecipeV2 {
  return createPowerNativeRecipe({
    release,
    primaryScope: "external_only",
    mosfetFactsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
    optionKeyPrefix: "power-external-v3",
    missingExternalProfilesReason: "External-controller topology lacks an exact reviewed facts-V3 MOSFET or exact reviewed facts-V2 current-sense profile.",
    simulationLimitation: "No reviewed executable model is bundled for the exact facts-V2 primary and selected facts-V3 MOSFET stage.",
    materializationLabel: "Catalog-native mixed facts-V2/V3 external-FET synchronous buck",
    materialize,
  });
}
