import {
  calculateDesignBlockContentHash,
  type CircuitComponentV4,
  type CircuitDocumentV4,
  type DesignBlockDefinition,
} from "@opencircuit/circuit-schema";
import {
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V32,
  canonicalProfileNumberV2,
  designProfileId,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  parseDesignProfileForV32,
  type DesignProfileV32,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
  type ProfileUnit,
} from "@opencircuit/design-library/v2-runtime";
import {
  DESIGN_V2_MAX_OPTIONS_PER_RECIPE,
  canonicalDesignV2Number,
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
  type BrushedDcMotorDesignRequestV2,
  type ConstraintResult,
  type EvidenceRef,
  type Quantity,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import type {
  NativeCandidateV2,
  NativeCatalogV2,
  NativeEnvironmentV2,
  NativeMatchedOptionV2,
  NativeMaterializationV2,
  NativeRecipeV2,
} from "./types";
import {
  buildMotorOperatingPointCompanionV2,
  motorSelectedPartModelUnavailableCoverageV2,
} from "./motor-operating-point-companion-v2";

const RELEASE = {
  id: "motor.native.integrated-h-bridge.facts-v3-2",
  version: "3.2.2",
  profileVersions: {
    "motor.integrated-h-bridge": "3.2.0",
    "shared.bulk-capacitor": "2.0.0",
    "shared.mlcc-capacitor": "2.0.0",
  },
  equations: [
    "motor.integrated.facts-v3-2.capacitance-requirement-gate.v2",
    "motor.integrated.facts-v3-2.direct-profile-limits.v2",
    "motor.integrated.facts-v3-2.enumeration-preflight.v1",
    "motor.integrated.facts-v3-2.guaranteed-role-gate.v1",
    "motor.integrated.facts-v3-2.one-way-peak-current-exceedance.v1",
    "motor.integrated.facts-v3-2.continuous-high-side-duty-support.v1",
    "motor.integrated.facts-v3-2.mounted-geometry-ranking-proxy.v1",
    "motor.integrated.facts-v3-2.connected-structural-bom-binding.v1",
    "motor.integrated.facts-v3-2.request-derived-operating-point-companion.v1",
    "motor.integrated.facts-v3-2.unknown-feasibility-preservation.v1",
  ],
} as const;

const METRIC_DECLARATIONS = [
  { id: "motor.native.board-area", unit: "m2" as const },
  { id: "motor.native.component-count", unit: "count" as const },
] as const;

type PrimaryProfile = DesignProfileV32<"motor.integrated-h-bridge">;
type BulkProfile = DesignProfileWithFactsV2<"shared.bulk-capacitor", FactsV2For<"shared.bulk-capacitor">>;
type MlccProfile = DesignProfileWithFactsV2<"shared.mlcc-capacitor", FactsV2For<"shared.mlcc-capacitor">>;
type PassiveProfile = BulkProfile | MlccProfile;
type IntegratedProfile = PrimaryProfile | PassiveProfile;

function canon(value: number): number {
  const design = canonicalDesignV2Number(value);
  const profile = canonicalProfileNumberV2(value);
  if (design !== profile) throw new Error("Design and profile V2 canonical arithmetic diverged");
  return design;
}

function motorRequest(environment: Readonly<NativeEnvironmentV2>): Readonly<BrushedDcMotorDesignRequestV2> {
  if (environment.request.application !== "motor.brushed-dc") {
    throw new TypeError("Integrated H-bridge facts-V3.2 recipe requires a motor.brushed-dc request");
  }
  return environment.request;
}

function primaryProfiles(catalog: Readonly<NativeCatalogV2>): PrimaryProfile[] {
  const codec = getDesignProfileCodecForVersion("motor.integrated-h-bridge", FACTS_SCHEMA_VERSION_V32);
  return catalog.profiles
    .filter((profile) => profile.partClass === "motor.integrated-h-bridge" && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32)
    .map((profile) => parseDesignProfileForV32(codec, profile))
    .map((profile) => {
      const issue = codec.validateAdmission(profile)[0];
      if (issue) throw new TypeError(`Invalid admitted facts-V3.2 motor.integrated-h-bridge profile: ${issue.path}: ${issue.message}`);
      return profile;
    })
    .sort((left, right) => compareDesignV2Tokens(
      designProfileId(left.partClass, left.part),
      designProfileId(right.partClass, right.part),
    ));
}

function passiveProfiles<ClassId extends "shared.bulk-capacitor" | "shared.mlcc-capacitor">(
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
    .sort((left, right) => compareDesignV2Tokens(
      designProfileId(left.partClass, left.part),
      designProfileId(right.partClass, right.part),
    ));
}

function profileId(profile: IntegratedProfile): string {
  return designProfileId(profile.partClass, profile.part);
}

function exactText(data: Readonly<Record<string, null | boolean | number | string>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function exactProfile<Profile extends IntegratedProfile>(
  data: Readonly<Record<string, null | boolean | number | string>>,
  key: string,
  profiles: readonly Profile[],
): Profile | undefined {
  const id = exactText(data, key);
  return id === undefined ? undefined : profiles.find((profile) => profileId(profile) === id);
}

function reviewedQuantity<Unit extends ProfileUnit>(fact: ProfileFact<ProfileQuantity<Unit>>, unit: Unit): number {
  if (fact.state !== "reviewed" || fact.value === null || fact.value.unit !== unit) {
    throw new TypeError(`Expected a reviewed ${unit} quantity`);
  }
  return fact.value.value;
}

function reviewedText(fact: ProfileFact<string>): string | undefined {
  return fact.state === "reviewed" && fact.value !== null ? fact.value : undefined;
}

function projectedEvidence(input: readonly ProfileEvidenceRef[]): EvidenceRef[] {
  return input.map((entry) => ({
    sourceId: entry.sourceId,
    locator: entry.locator,
    ...(entry.retrievedAt === null ? {} : { retrievedAt: entry.retrievedAt }),
    ...(entry.contentHash === null ? {} : { contentHash: entry.contentHash }),
    licenseNote: entry.licenseNote,
  }));
}

function factEvidence(fact: ProfileFact<unknown>): EvidenceRef[] {
  return projectedEvidence([...fact.evidence, ...fact.validFor.flatMap((condition) => condition.evidence)]);
}

function quantity(value: number, unit: Quantity["unit"]): Quantity {
  return { value, unit, displayUnit: unit };
}

function limitConstraint(
  ruleId: string,
  actual: Quantity,
  limit: Quantity,
  direction: "at_least" | "at_most",
  evidence: EvidenceRef[],
  explanation: string,
): ConstraintResult {
  const margin = canon(direction === "at_least" ? actual.value - limit.value : limit.value - actual.value);
  return {
    ruleId,
    status: margin >= 0 ? "pass" : "fail",
    actual,
    limit,
    margin: quantity(margin, actual.unit),
    explanation,
    evidence,
  };
}

function unknownConstraint(ruleId: string, explanation: string, evidence: EvidenceRef[] = []): ConstraintResult {
  return { ruleId, status: "unknown", explanation, evidence };
}

type OperatingContext = Readonly<Record<string, readonly Readonly<ProfileQuantity>[]>>;

function operatingContext(request: Readonly<BrushedDcMotorDesignRequestV2>): OperatingContext {
  return {
    ambientTemperature: [request.requirements.ambientTemperature],
    dutyCycle: [request.requirements.operatingPoint.dutyCycle],
    junctionTemperature: [request.constraints.maximumJunctionTemperature],
    supplyVoltage: [request.requirements.supplyVoltage.minimum, request.requirements.supplyVoltage.maximum],
    switchingFrequency: [request.requirements.pwmFrequency],
    testCurrent: [request.requirements.continuousCurrent],
    testVoltage: [request.requirements.supplyVoltage.minimum, request.requirements.supplyVoltage.maximum],
  };
}

function conditionsCover(
  fact: ProfileFact<unknown>,
  context: OperatingContext,
): boolean {
  return fact.validFor.every((condition) => {
    const actuals = context[condition.parameterId];
    if (actuals === undefined || actuals.length === 0) return false;
    return actuals.every((actual) => {
      if (condition.minimum !== null && (condition.minimum.unit !== actual.unit || actual.value < condition.minimum.value)) return false;
      if (condition.maximum !== null && (condition.maximum.unit !== actual.unit || actual.value > condition.maximum.value)) return false;
      return true;
    });
  });
}

function reviewedLimit<Unit extends "V">(
  ruleId: string,
  fact: ProfileFact<ProfileQuantity<Unit>>,
  unit: Unit,
  actual: Quantity,
  direction: "at_least" | "at_most",
  factIsActual: boolean,
  context: OperatingContext,
  explanation: string,
): ConstraintResult {
  const evidence = factEvidence(fact);
  if (fact.state !== "reviewed" || fact.value === null || !conditionsCover(fact, context)) {
    return unknownConstraint(ruleId, "The reviewed profile limit does not cover the declared operating conditions.", evidence);
  }
  const profileQuantity = quantity(fact.value.value, unit);
  return factIsActual
    ? limitConstraint(ruleId, profileQuantity, actual, direction, evidence, explanation)
    : limitConstraint(ruleId, actual, profileQuantity, direction, evidence, explanation);
}

function roleGatedLimit<Unit extends "A" | "Hz" | "s">(
  ruleId: string,
  fact: ProfileFact<ProfileQuantity<Unit>>,
  role: ProfileFact<string>,
  acceptedRole: string,
  unit: Unit,
  actual: Quantity,
  direction: "at_least" | "at_most",
  factIsActual: boolean,
  context: OperatingContext,
  explanation: string,
): ConstraintResult {
  const evidence = [...factEvidence(fact), ...factEvidence(role)];
  if (fact.state !== "reviewed" || fact.value === null) {
    return unknownConstraint(ruleId, "No reviewed quantity is available for this constraint.", evidence);
  }
  if (role.state !== "reviewed" || role.value !== acceptedRole) {
    return unknownConstraint(ruleId, `The reviewed quantity does not have the required ${acceptedRole} evidence role.`, evidence);
  }
  if (!conditionsCover(fact, context) || !conditionsCover(role, context)) {
    return unknownConstraint(ruleId, "The reviewed quantity and its evidence role do not both cover the declared operating conditions.", evidence);
  }
  const profileQuantity = quantity(fact.value.value, unit);
  return factIsActual
    ? limitConstraint(ruleId, profileQuantity, actual, direction, evidence, explanation)
    : limitConstraint(ruleId, actual, profileQuantity, direction, evidence, explanation);
}

function peakCurrentConstraint(
  fact: ProfileFact<ProfileQuantity<"A">>,
  role: ProfileFact<string>,
  actual: Quantity,
  context: OperatingContext,
): ConstraintResult {
  const ruleId = "motor.integrated.peak-current";
  const evidence = [...factEvidence(fact), ...factEvidence(role)];
  if (fact.state !== "reviewed" || fact.value === null) {
    return unknownConstraint(ruleId, "No reviewed peak-output-current quantity is available for this constraint.", evidence);
  }
  if (role.state !== "reviewed" || role.value !== "guaranteed_operating_limit") {
    return unknownConstraint(ruleId, "The reviewed peak-output-current quantity is not classified as a guaranteed operating limit.", evidence);
  }
  if (!conditionsCover(fact, context) || !conditionsCover(role, context)) {
    return unknownConstraint(ruleId, "The reviewed peak-output-current quantity and its guaranteed-limit role do not both cover the declared stall conditions.", evidence);
  }
  const limit = quantity(fact.value.value, "A");
  if (actual.value > limit.value) {
    return limitConstraint(
      ruleId,
      actual,
      limit,
      "at_most",
      evidence,
      "The requested stall current exceeds the reviewed guaranteed peak-output-current operating limit.",
    );
  }
  return unknownConstraint(
    ruleId,
    "The requested stall current does not exceed the reviewed guaranteed peak-output-current limit, but stall duration, pulse duty, safe-operating area, protection response, and transient thermal feasibility remain unproved.",
    evidence,
  );
}

function highSideDutyConstraint(
  support: ProfileFact<boolean>,
  architecture: ProfileFact<string>,
  duty: number,
  context: OperatingContext,
): ConstraintResult {
  const ruleId = "motor.integrated.high-side-duty";
  const evidence = [...factEvidence(architecture), ...factEvidence(support)];
  if (support.state !== "reviewed" || support.value !== true) {
    return unknownConstraint(ruleId, "No reviewed affirmative continuous high-side-on support proves this duty-cycle architecture.", evidence);
  }
  if (!conditionsCover(support, context)) {
    return unknownConstraint(ruleId, "The reviewed continuous high-side-on support does not cover the declared operating conditions.", evidence);
  }
  if (!Number.isFinite(duty) || duty < 0 || duty > 1) {
    return unknownConstraint(ruleId, "The requested duty cycle is outside the valid dimensionless interval from zero through one.", evidence);
  }
  return limitConstraint(
    ruleId,
    quantity(duty, "1"),
    quantity(1, "1"),
    "at_most",
    evidence,
    "Reviewed continuous high-side-on support covers the requested duty cycle at the bridge-architecture level; current and thermal feasibility remain separate.",
  );
}

function capacitanceConstraint(
  ruleId: string,
  selected: PassiveProfile,
  required: ProfileFact<ProfileQuantity<"F">>,
  requirement: ProfileFact<string>,
  context: OperatingContext,
  label: string,
): ConstraintResult {
  const evidence = [
    ...factEvidence(selected.facts.nominalCapacitance),
    ...factEvidence(required),
    ...factEvidence(requirement),
  ];
  if (reviewedText(requirement) !== "required_minimum") {
    return unknownConstraint(ruleId, `The ${label} capacitance is not published as a required minimum.`, evidence);
  }
  if (required.state !== "reviewed" || required.value === null) {
    return unknownConstraint(ruleId, `No reviewed numeric ${label} capacitance minimum is available.`, evidence);
  }
  if (
    !conditionsCover(selected.facts.nominalCapacitance, context)
    || !conditionsCover(required, context)
    || !conditionsCover(requirement, context)
  ) {
    return unknownConstraint(ruleId, `The selected nominal ${label} capacitance, required quantity, and required-minimum classification do not all cover the declared operating conditions.`, evidence);
  }
  return limitConstraint(
    ruleId,
    quantity(reviewedQuantity(selected.facts.nominalCapacitance, "F"), "F"),
    quantity(required.value.value, "F"),
    "at_least",
    evidence,
    `Reviewed nominal ${label} capacitance meets the reviewed required minimum.`,
  );
}

function passiveVoltageConstraint(
  ruleId: string,
  selected: PassiveProfile,
  requiredVoltage: Quantity,
  context: OperatingContext,
  label: string,
): ConstraintResult {
  const ratedVoltage = selected.facts.ratedVoltage;
  const evidence = factEvidence(ratedVoltage);
  if (ratedVoltage.state !== "reviewed" || ratedVoltage.value === null || !conditionsCover(ratedVoltage, context)) {
    return unknownConstraint(ruleId, `The selected ${label} capacitor's reviewed rated voltage does not cover the declared operating conditions.`, evidence);
  }
  return limitConstraint(
    ruleId,
    quantity(ratedVoltage.value.value, "V"),
    requiredVoltage,
    "at_least",
    evidence,
    `The ${label} capacitor's reviewed nameplate voltage rating is not below maximum motor supply.`,
  );
}

function selectedPrimary(profile: PrimaryProfile): SelectedComponent {
  return {
    id: "primary",
    role: "integrated-h-bridge",
    profileId: profileId(profile),
    part: { ...profile.part },
    quantityPerAssembly: 1,
    evidence: projectedEvidence(profile.commonFacts.packageName.evidence),
  };
}

function selectedCapacitor(
  id: "bulk-capacitor" | "local-decoupling",
  role: "bulk-capacitor" | "local-decoupling-capacitor",
  profile: PassiveProfile,
): SelectedComponent {
  const nominal = profile.facts.nominalCapacitance;
  return {
    id,
    role,
    profileId: profileId(profile),
    part: { ...profile.part },
    quantityPerAssembly: 1,
    value: quantity(reviewedQuantity(nominal, "F"), "F"),
    evidence: projectedEvidence(nominal.evidence),
  };
}

function mountedBoardArea(profile: IntegratedProfile): number {
  const fact = profile.facts.mountedGeometry.boardArea;
  if (fact.state !== "calculated" || fact.value === null) throw new TypeError("Missing calculated mounted board-area proxy");
  return fact.value.area.value;
}

function mountedHeight(profile: IntegratedProfile): number {
  const fact = profile.facts.mountedGeometry.maximumHeight;
  if (fact.state !== "reviewed" || fact.value === null) throw new TypeError("Missing reviewed mounted maximum height");
  return fact.value.height.value;
}

function optionKey(data: Readonly<Record<string, string>>): string {
  return `motor-integrated-v3-2:${designSha256ContentHash(canonicalDesignV2Payload(data))}`;
}

function preflight(primary: readonly PrimaryProfile[], local: readonly MlccProfile[], bulk: readonly BulkProfile[]): void {
  const work = BigInt(primary.length) * BigInt(local.length) * BigInt(bulk.length);
  if (work > BigInt(DESIGN_V2_MAX_OPTIONS_PER_RECIPE)) {
    throw new RangeError(`${RELEASE.id}:enumerate:resource_limit:${work.toString()}>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`);
  }
}

function selectedProfiles(
  option: Readonly<NativeMatchedOptionV2>,
  catalog: Readonly<NativeCatalogV2>,
): IntegratedProfile[] {
  const profiles: IntegratedProfile[] = [
    ...primaryProfiles(catalog),
    ...passiveProfiles(catalog, "shared.mlcc-capacitor"),
    ...passiveProfiles(catalog, "shared.bulk-capacitor"),
  ];
  return option.components.map((component) => {
    const profile = profiles.find((candidate) => profileId(candidate) === component.profileId);
    if (profile) return profile;
    throw new TypeError(`Missing exact selected facts-V3.2/V2 profile ${component.id}`);
  });
}

function materialize(
  candidate: Readonly<NativeCandidateV2>,
  request: Readonly<BrushedDcMotorDesignRequestV2>,
): NativeMaterializationV2 {
  const bulk = candidate.components.find((component) => component.id === "bulk-capacitor");
  const local = candidate.components.find((component) => component.id === "local-decoupling");
  const primary = candidate.components.find((component) => component.id === "primary");
  if (bulk === undefined || local === undefined || primary === undefined || bulk.value === undefined || local.value === undefined) {
    throw new TypeError("Integrated H-bridge facts-V3.2 materialization requires the exact primary/local/bulk BOM");
  }
  const blockPayload: Omit<DesignBlockDefinition, "contentHash"> = {
    id: "motor.integrated-h-bridge.exact-part",
    version: "1",
    title: "Exact selected integrated H-bridge",
    pins: [
      { id: "supply", name: "MOTOR SUPPLY", offset: [0, -8] },
      { id: "ground", name: "GROUND", offset: [0, 8] },
      { id: "control-a", name: "CONTROL A", offset: [-8, -2] },
      { id: "control-b", name: "CONTROL B", offset: [-8, 2] },
      { id: "motor-a", name: "MOTOR A", offset: [8, -2] },
      { id: "motor-b", name: "MOTOR B", offset: [8, 2] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model is bundled for this exact integrated H-bridge manufacturer part; the block is structural only.",
    },
  };
  const primaryBlock: DesignBlockDefinition = {
    ...blockPayload,
    contentHash: calculateDesignBlockContentHash(blockPayload),
  };
  const components: CircuitComponentV4[] = [
    { id: "bulk-capacitor", type: "capacitor", value: bulk.value.value, mpn: bulk.part.manufacturerPartNumber, pos: [16, 16], rot: 90, mirror: false },
    { id: "ground", type: "ground", pos: [16, 32], rot: 0, mirror: false },
    { id: "local-decoupling", type: "capacitor", value: local.value.value, mpn: local.part.manufacturerPartNumber, pos: [24, 16], rot: 90, mirror: false },
    {
      id: "primary",
      type: "design_block",
      block: { id: primaryBlock.id, version: primaryBlock.version, contentHash: primaryBlock.contentHash },
      mpn: primary.part.manufacturerPartNumber,
      pos: [40, 20],
      rot: 0,
      mirror: false,
    },
  ];
  const companion = buildMotorOperatingPointCompanionV2(request, candidate.components);
  const assembly: CircuitDocumentV4["circuits"][number] = {
    id: "assembly",
    title: "Integrated H-bridge structural assembly",
    components,
    wires: [
      { id: "control-a", points: [[32, 18], [30, 18], [30, 12], [4, 12]] },
      { id: "control-b", points: [[32, 22], [28, 22], [28, 26], [4, 26]] },
      { id: "ground-bulk", points: [[16, 18], [16, 32]] },
      { id: "ground-local", points: [[24, 18], [24, 28], [16, 28]] },
      { id: "ground-primary", points: [[40, 28], [40, 32], [16, 32]] },
      { id: "motor-output-a", points: [[48, 18], [72, 18]] },
      { id: "motor-output-b", points: [[48, 22], [72, 22]] },
      { id: "supply-bulk", points: [[16, 14], [16, 8], [40, 8]] },
      { id: "supply-local", points: [[24, 14], [24, 8]] },
      { id: "supply-primary", points: [[40, 8], [40, 12]] },
    ],
    probes: [],
  };
  const assemblyClassifications = [
    { circuitId: "assembly", componentId: "bulk-capacitor", kind: "physical" as const, selectedComponentId: "bulk-capacitor", representedQuantityPerAssembly: bulk.quantityPerAssembly },
    { circuitId: "assembly", componentId: "ground", kind: "non_bom" as const, reason: "Ground is a schematic reference, not a BOM line." },
    { circuitId: "assembly", componentId: "local-decoupling", kind: "physical" as const, selectedComponentId: "local-decoupling", representedQuantityPerAssembly: local.quantityPerAssembly },
    { circuitId: "assembly", componentId: "primary", kind: "physical" as const, selectedComponentId: "primary", representedQuantityPerAssembly: primary.quantityPerAssembly },
  ];
  const circuit: CircuitDocumentV4 = {
    format: "opencircuit-circuit",
    version: 4,
    meta: {
      title: "Catalog-native facts-V3.2 integrated motor bridge",
      description: "The exact-BOM assembly remains structural and schematic-only. A separate request-derived averaged operating-point graph contains no selected-part model and makes no package-pin, switching, performance, or fidelity claim.",
    },
    designBlocks: [primaryBlock],
    circuits: [assembly, companion.graph],
    scenarios: [companion.scenario],
    defaultCircuitId: "assembly",
    defaultScenarioId: companion.scenario.id,
  };
  return {
    circuit,
    circuitInstanceClassifications: [
      ...assemblyClassifications,
      ...companion.circuitInstanceClassifications,
    ].sort((left, right) => compareDesignV2Tokens(left.circuitId, right.circuitId)
      || compareDesignV2Tokens(left.componentId, right.componentId)),
    circuitBomNonRepresentations: companion.circuitBomNonRepresentations,
  };
}

/** Installed facts-V3.2 integrated-H-bridge recipe for independently reviewed profiles. */
export const MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32: NativeRecipeV2 = {
  id: RELEASE.id,
  version: RELEASE.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE)),
  applications: ["motor.brushed-dc"],
  metricDeclarations: METRIC_DECLARATIONS.map((entry) => ({ ...entry })),
  supports(request) {
    return request.application === "motor.brushed-dc"
      && request.constraints.allowedTopologyFamilies.includes("motor.hbridge.integrated");
  },
  enumerate(environment) {
    const request = motorRequest(environment);
    if (!request.constraints.allowedTopologyFamilies.includes("motor.hbridge.integrated")) return [];
    const primary = primaryProfiles(environment.catalog);
    const local = passiveProfiles(environment.catalog, "shared.mlcc-capacitor");
    const bulk = passiveProfiles(environment.catalog, "shared.bulk-capacitor");
    preflight(primary, local, bulk);
    const options: Array<{ optionKey: string; data: Record<string, string> }> = [];
    for (const bridge of primary) for (const localCapacitor of local) for (const bulkCapacitor of bulk) {
      const data = {
        bulkProfileId: profileId(bulkCapacitor),
        localProfileId: profileId(localCapacitor),
        primaryProfileId: profileId(bridge),
      };
      options.push({ optionKey: optionKey(data), data });
    }
    return options.sort((left, right) => compareDesignV2Tokens(left.optionKey, right.optionKey));
  },
  solve(option) {
    return { status: "ok", value: { data: { ...option.data }, derivedValues: [] } };
  },
  match(option, environment) {
    const request = motorRequest(environment);
    const primary = exactProfile(option.data, "primaryProfileId", primaryProfiles(environment.catalog));
    const local = exactProfile(option.data, "localProfileId", passiveProfiles(environment.catalog, "shared.mlcc-capacitor"));
    const bulk = exactProfile(option.data, "bulkProfileId", passiveProfiles(environment.catalog, "shared.bulk-capacitor"));
    if (!primary || !local || !bulk) {
      return [{ status: "rejected", reason: "At least one exact integrated-bridge facts-V3.2/V2 profile is absent from the reviewed catalog." }];
    }
    if (reviewedText(primary.facts.bridgeTopology) !== "full_bridge" || reviewedText(primary.facts.powerStage) !== "integrated_fet") {
      return [{ status: "rejected", reason: "The selected primary does not declare the exact integrated full-bridge topology." }];
    }
    const components = [
      selectedCapacitor("bulk-capacitor", "bulk-capacitor", bulk),
      selectedCapacitor("local-decoupling", "local-decoupling-capacitor", local),
      selectedPrimary(primary),
    ].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
    return [{ status: "ok", value: {
      data: { ...option.data },
      derivedValues: option.derivedValues,
      components,
      simulationCoverage: [
        buildMotorOperatingPointCompanionV2(request, components).coverage,
        motorSelectedPartModelUnavailableCoverageV2(
          "No reviewed executable integrated H-bridge, motor, parasitic, switching, or thermal model is bundled for this exact facts-V3.2 BOM.",
        ),
      ],
      warnings: [],
    } }];
  },
  check(option, environment) {
    const request = motorRequest(environment);
    const primary = exactProfile(option.data, "primaryProfileId", primaryProfiles(environment.catalog));
    const local = exactProfile(option.data, "localProfileId", passiveProfiles(environment.catalog, "shared.mlcc-capacitor"));
    const bulk = exactProfile(option.data, "bulkProfileId", passiveProfiles(environment.catalog, "shared.bulk-capacitor"));
    if (!primary || !local || !bulk) {
      return [unknownConstraint("motor.integrated.profile-set", "The exact selected facts-V3.2/V2 profile set is unavailable during constraint evaluation.")];
    }
    const facts = primary.facts;
    const context = operatingContext(request);
    const peakContext: OperatingContext = {
      ...context,
      testCurrent: [request.requirements.stallCurrent],
    };
    const duty = request.requirements.operatingPoint.dutyCycle.value;
    const pwm = request.requirements.pwmFrequency.value;
    const onTime = canon(duty / pwm);
    const offTime = canon(canon(1 - duty) / pwm);
    const selectedSet: IntegratedProfile[] = [bulk, local, primary];
    const constraints: ConstraintResult[] = [
      roleGatedLimit("motor.integrated.continuous-current", facts.continuousOutputCurrent, facts.continuousOutputCurrentRole, "guaranteed_operating_limit", "A", request.requirements.continuousCurrent, "at_least", true, context, "The reviewed guaranteed continuous-output-current capability covers the request."),
      peakCurrentConstraint(facts.peakOutputCurrent, facts.peakOutputCurrentRole, request.requirements.stallCurrent, peakContext),
      reviewedLimit("motor.integrated.logic-threshold", facts.logicHighThresholdMaximum, "V", request.requirements.logicVoltage, "at_most", true, context, "The logic rail reaches the reviewed worst-case high threshold."),
      roleGatedLimit("motor.integrated.pulse-off-time", facts.minimumInputPulseWidth, facts.minimumInputPulseWidthRole, "guaranteed_bound", "s", quantity(offTime, "s"), "at_least", false, context, "The requested PWM off-time is not shorter than the reviewed guaranteed minimum input pulse width."),
      roleGatedLimit("motor.integrated.pulse-on-time", facts.minimumInputPulseWidth, facts.minimumInputPulseWidthRole, "guaranteed_bound", "s", quantity(onTime, "s"), "at_least", false, context, "The requested PWM on-time is not shorter than the reviewed guaranteed minimum input pulse width."),
      roleGatedLimit("motor.integrated.pwm-frequency", facts.pwmMaximum, facts.pwmMaximumRole, "guaranteed_bound", "Hz", request.requirements.pwmFrequency, "at_least", true, context, "The reviewed guaranteed PWM capability covers the request."),
      reviewedLimit("motor.integrated.supply-absolute-maximum", facts.supplyVoltageAbsoluteMaximum, "V", request.requirements.supplyVoltage.maximum, "at_most", false, context, "Maximum motor supply does not exceed the reviewed absolute maximum; transient overshoot margin remains unproved."),
      reviewedLimit("motor.integrated.supply-maximum", facts.supplyVoltageOperatingMaximum, "V", request.requirements.supplyVoltage.maximum, "at_most", false, context, "Maximum motor supply does not exceed the reviewed operating maximum."),
      reviewedLimit("motor.integrated.supply-minimum", facts.supplyVoltageOperatingMinimum, "V", request.requirements.supplyVoltage.minimum, "at_least", false, context, "Minimum motor supply is not below the reviewed operating minimum."),
      capacitanceConstraint("motor.integrated.bulk-capacitance-nominal", bulk, facts.bulkCapacitance, facts.bulkCapacitanceRequirement, context, "bulk"),
      passiveVoltageConstraint("motor.integrated.bulk-voltage-rating", bulk, request.requirements.supplyVoltage.maximum, context, "bulk"),
      capacitanceConstraint("motor.integrated.local-capacitance-nominal", local, facts.localSupplyDecouplingCapacitance, facts.localSupplyDecouplingRequirement, context, "local decoupling"),
      passiveVoltageConstraint("motor.integrated.local-voltage-rating", local, request.requirements.supplyVoltage.maximum, context, "local"),
      unknownConstraint("motor.integrated.capacitor-derating", "Nominal capacitance and nameplate voltage do not prove effective capacitance, bias derating, ripple, transient energy, or lifetime.", [...factEvidence(local.facts.nominalCapacitance), ...factEvidence(bulk.facts.nominalCapacitance)]),
      unknownConstraint("motor.integrated.current-limit", request.requirements.currentLimitTarget === null
        ? "No current-limit target is requested; the architecture classification alone does not prove configured protection or safe stall behavior."
        : "The initial facts-V3.2 contract has no reviewed configured current-limit equation or BOM binding, so the requested target remains unproved.", factEvidence(facts.currentRegulationInterface)),
      highSideDutyConstraint(facts.continuousHighSideOnSupported, facts.highSideDriveArchitecture, duty, context),
      unknownConstraint("motor.integrated.motor-dynamics", "No reviewed winding-inductance, back-EMF, speed, commutation, startup, or braking model is bound to this candidate."),
      unknownConstraint("motor.integrated.operating-load", "Path resistance, transition time, and active supply current do not form a reviewed request-specific conduction and switching loss calculation.", [...factEvidence(facts.pathResistance), ...factEvidence(facts.pathResistanceRole), ...factEvidence(facts.switchingTransitionTime), ...factEvidence(facts.switchingTransitionTimeRole), ...factEvidence(facts.activeSupplyCurrent), ...factEvidence(facts.activeSupplyCurrentRole)]),
      unknownConstraint("motor.integrated.operating-modes", "The initial facts-V3.2 contract does not prove every requested forward, reverse, coast, and brake operating mode."),
      unknownConstraint("motor.integrated.thermal", "No reviewed loss, PCB copper, airflow, or transient thermal calculation proves actual junction temperature.", [...factEvidence(facts.junctionToAmbientThermalResistance), ...factEvidence(facts.maximumJunctionTemperature)]),
      unknownConstraint("motor.integrated.transient-margin", "Absolute voltage rating does not prove wiring overshoot, recirculation, braking energy, or suppression coordination.", factEvidence(facts.supplyVoltageAbsoluteMaximum)),
    ];
    if (request.constraints.allowedPackages.length > 0) {
      constraints.push({
        ruleId: "motor.integrated.assembly.allowed-packages",
        status: selectedSet.every((profile) => profile.commonFacts.packageName.value !== null && request.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)) ? "pass" : "fail",
        explanation: "Every exact selected package name is in the request allowlist.",
        evidence: selectedSet.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)),
      });
    }
    if (request.constraints.maximumComponentHeight !== null) {
      constraints.push(limitConstraint(
        "motor.integrated.assembly.component-height",
        quantity(Math.max(...selectedSet.map(mountedHeight)), "m"),
        request.constraints.maximumComponentHeight,
        "at_most",
        selectedSet.flatMap((profile) => factEvidence(profile.facts.mountedGeometry.maximumHeight)),
        "Every selected part's reviewed mounted maximum height fits the request limit.",
      ));
    }
    if (request.constraints.maximumBoardArea !== null) {
      constraints.push(unknownConstraint(
        "motor.integrated.assembly.board-area",
        "The sum of mounted land-pattern rectangles is a ranking proxy, not placement, courtyard, keep-out, routing, or board-outline proof.",
        selectedSet.flatMap((profile) => factEvidence(profile.facts.mountedGeometry.boardArea)),
      ));
    }
    return constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
  },
  estimate(option, _constraints, environment) {
    const profiles = new Map(selectedProfiles(option, environment.catalog).map((profile) => [profileId(profile), profile]));
    const boardArea = option.components.reduce((total, component) => {
      const profile = profiles.get(component.profileId);
      if (!profile) throw new TypeError(`Missing exact selected profile for ${component.id}`);
      return canon(total + canon(mountedBoardArea(profile) * component.quantityPerAssembly));
    }, 0);
    return {
      metrics: [
        {
          id: "motor.native.board-area",
          value: quantity(boardArea, "m2"),
          state: "calculated",
          explanation: "Ranking-only canonical sum of reviewed mounted land-pattern proxies; not a PCB fit proof.",
          evidence: selectedProfiles(option, environment.catalog).flatMap((profile) => factEvidence(profile.facts.mountedGeometry.boardArea)),
        },
        {
          id: "motor.native.component-count",
          value: quantity(option.components.reduce((total, component) => total + component.quantityPerAssembly, 0), "count"),
          state: "calculated",
          explanation: "Selected physical component count.",
          evidence: [],
        },
      ],
      warnings: [],
    };
  },
  materialize(candidate, environment) {
    return materialize(candidate, motorRequest(environment));
  },
};
