import type { CircuitDocumentV2 } from "@opencircuit/circuit-schema";
import {
  canonicalProfileNumberV2,
  designProfileId,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
  type ProfileUnit,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Number,
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
  type ConstraintResult,
  type EvidenceRef,
  type Quantity,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import type {
  NativeCandidateV2,
  NativeCatalogV2,
  NativeMatchedOptionV2,
  NativeMaterializationV2,
  NativeRecipeV2,
} from "./types";

const RELEASE = {
  id: "motor.native.integrated-h-bridge.facts-v2",
  version: "2.0.0",
  equations: [
    "motor.facts-v2.circuit-binding.v1",
    "motor.facts-v2.mounted-geometry-proxy.v1",
    "motor.facts-v2.passive-selection.v1",
    "motor.facts-v2.profile-limits.v1",
  ],
} as const;

const METRIC_DECLARATIONS = [
  { id: "motor.native.board-area", unit: "m2" as const },
  { id: "motor.native.component-count", unit: "count" as const },
];

type ProfileV2<ClassId extends PartClassId> = DesignProfileWithFactsV2<
  ClassId,
  FactsV2For<ClassId>
>;

type CapacitorProfileV2 =
  | ProfileV2<"shared.mlcc-capacitor">
  | ProfileV2<"shared.bulk-capacitor">;

function canon(value: number): number {
  const design = canonicalDesignV2Number(value);
  const profile = canonicalProfileNumberV2(value);
  if (design !== profile) throw new Error("Design and profile V2 canonical arithmetic diverged");
  return design;
}

function profilesForV2<ClassId extends PartClassId>(
  catalog: Readonly<NativeCatalogV2>,
  partClass: ClassId,
): ProfileV2<ClassId>[] {
  const codec = getDesignProfileCodecForVersion(partClass, "2.0.0");
  return catalog.profiles
    .filter((profile) => profile.partClass === partClass && profile.factsSchemaVersion === "2.0.0")
    .map((profile) => parseDesignProfileForV2(codec, profile))
    .map((profile) => {
      const first = codec.validateAdmission(profile)[0];
      if (first) throw new TypeError(`Profile no longer satisfies ${partClass} admission at ${first.path}`);
      return profile;
    })
    .sort((left, right) => compareDesignV2Tokens(
      designProfileId(left.partClass, left.part),
      designProfileId(right.partClass, right.part),
    ));
}

function reviewedQuantity<Unit extends ProfileUnit>(
  fact: ProfileFact<ProfileQuantity<Unit>>,
  unit: Unit,
): number {
  if (fact.state !== "reviewed" || fact.value === null || fact.value.unit !== unit) {
    throw new TypeError(`Expected a reviewed ${unit} quantity`);
  }
  return fact.value.value;
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
    margin: { value: margin, unit: actual.unit, displayUnit: actual.displayUnit },
    explanation,
    evidence,
  };
}

function unknownConstraint(
  ruleId: string,
  explanation: string,
  evidence: EvidenceRef[] = [],
): ConstraintResult {
  return { ruleId, status: "unknown", explanation, evidence };
}

function selectedPrimary(profile: ProfileV2<"motor.integrated-h-bridge">): SelectedComponent {
  return {
    id: "primary",
    role: "integrated-h-bridge",
    profileId: designProfileId(profile.partClass, profile.part),
    part: { ...profile.part },
    quantityPerAssembly: 1,
    evidence: projectedEvidence(profile.commonFacts.packageName.evidence),
  };
}

function selectedCapacitor(
  id: "bulk-capacitor" | "local-decoupling",
  role: "bulk-capacitor" | "local-decoupling-capacitor",
  profile: CapacitorProfileV2,
): SelectedComponent {
  const nominal = profile.facts.nominalCapacitance;
  const value = reviewedQuantity(nominal, "F");
  return {
    id,
    role,
    profileId: designProfileId(profile.partClass, profile.part),
    part: { ...profile.part },
    quantityPerAssembly: 1,
    value: quantity(value, "F"),
    evidence: projectedEvidence(nominal.evidence),
  };
}

function matchedProfile<ClassId extends PartClassId>(
  option: Readonly<NativeMatchedOptionV2>,
  componentId: string,
  profiles: readonly ProfileV2<ClassId>[],
): ProfileV2<ClassId> {
  const component = option.components.find((entry) => entry.id === componentId);
  const profile = component === undefined
    ? undefined
    : profiles.find((entry) => designProfileId(entry.partClass, entry.part) === component.profileId);
  if (profile === undefined) throw new TypeError(`Missing facts-V2 selected profile ${componentId}`);
  return profile;
}

function mountedBoardArea(profile: ProfileV2<PartClassId>): number {
  const fact = profile.facts.mountedGeometry.boardArea;
  if (fact.state !== "calculated" || fact.value === null) throw new TypeError("Missing calculated mounted board-area proxy");
  return fact.value.area.value;
}

function mountedHeight(profile: ProfileV2<PartClassId>): number {
  const fact = profile.facts.mountedGeometry.maximumHeight;
  if (fact.state !== "reviewed" || fact.value === null) throw new TypeError("Missing reviewed mounted maximum height");
  return fact.value.height.value;
}

function boardAreaProxy(profiles: readonly ProfileV2<PartClassId>[]): number {
  return profiles.reduce((total, profile) => canon(total + mountedBoardArea(profile)), 0);
}

function materialize(candidate: Readonly<NativeCandidateV2>): NativeMaterializationV2 {
  const bulk = candidate.components.find((entry) => entry.id === "bulk-capacitor");
  const local = candidate.components.find((entry) => entry.id === "local-decoupling");
  const primary = candidate.components.find((entry) => entry.id === "primary");
  if (bulk === undefined || local === undefined || primary === undefined || bulk.value === undefined || local.value === undefined) {
    throw new TypeError("Motor facts-V2 materialization requires the exact three-component BOM");
  }
  const circuit: CircuitDocumentV2 = {
    format: "opencircuit-circuit",
    version: 2,
    meta: {
      title: "Facts-V2 catalog-native integrated motor bridge",
      description: "Exact passive BOM bindings; the selected bridge remains explicitly unrepresented without a reviewed executable model.",
    },
    designBlocks: [],
    circuits: [{
      id: "assembly",
      title: "Motor bridge BOM assembly",
      components: [
        { id: "bulk-capacitor", type: "capacitor", value: bulk.value.value, mpn: bulk.part.manufacturerPartNumber, pos: [80, 0], rot: 0, mirror: false },
        { id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false },
        { id: "local-decoupling", type: "capacitor", value: local.value.value, mpn: local.part.manufacturerPartNumber, pos: [160, 0], rot: 0, mirror: false },
      ],
      wires: [],
      probes: [],
    }],
    scenarios: [],
    defaultCircuitId: "assembly",
    defaultScenarioId: null,
  };
  return {
    circuit,
    circuitInstanceClassifications: [
      { circuitId: "assembly", componentId: "bulk-capacitor", kind: "physical", selectedComponentId: "bulk-capacitor", representedQuantityPerAssembly: 1 },
      { circuitId: "assembly", componentId: "ground", kind: "non_bom", reason: "Ground is a schematic reference, not a BOM line." },
      { circuitId: "assembly", componentId: "local-decoupling", kind: "physical", selectedComponentId: "local-decoupling", representedQuantityPerAssembly: 1 },
    ],
    circuitBomNonRepresentations: [{
      circuitId: "assembly",
      selectedComponentId: "primary",
      reason: "No reviewed executable integrated H-bridge model is bound to this exact selected profile.",
    }],
  };
}

/** Installed facts-schema-V2 Motor recipe; an empty reviewed catalog enumerates no options. */
export const MOTOR_NATIVE_RECIPE_FACTS_V2: NativeRecipeV2 = {
  id: RELEASE.id,
  version: RELEASE.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE)),
  applications: ["motor.brushed-dc"],
  metricDeclarations: METRIC_DECLARATIONS,
  supports(request) {
    return request.application === "motor.brushed-dc"
      && request.constraints.allowedTopologyFamilies.includes("motor.hbridge.integrated");
  },
  enumerate(environment) {
    return profilesForV2(environment.catalog, "motor.integrated-h-bridge").map((profile) => {
      const id = designProfileId(profile.partClass, profile.part);
      return { optionKey: id, data: { primaryProfileId: id } };
    });
  },
  solve(option) {
    return { status: "ok", value: { data: { ...option.data }, derivedValues: [] } };
  },
  match(option, environment) {
    if (environment.request.application !== "motor.brushed-dc") {
      throw new TypeError("Motor facts-V2 match requires a motor.brushed-dc request");
    }
    const primary = profilesForV2(environment.catalog, "motor.integrated-h-bridge")
      .find((profile) => designProfileId(profile.partClass, profile.part) === option.data.primaryProfileId);
    if (primary === undefined) {
      return [{ status: "rejected", reason: "The exact facts-V2 bridge profile is absent from the reviewed catalog." }];
    }
    const request = environment.request;
    const localMinimum = reviewedQuantity(primary.facts.localDecouplingMinimum, "F");
    const bulkMinimum = reviewedQuantity(primary.facts.bulkCapacitanceMinimum, "F");
    const local = profilesForV2(environment.catalog, "shared.mlcc-capacitor").find((profile) => (
      reviewedQuantity(profile.facts.ratedVoltage, "V") >= request.requirements.supplyVoltage.maximum.value
      && reviewedQuantity(profile.facts.nominalCapacitance, "F") >= localMinimum
    ));
    const bulk = profilesForV2(environment.catalog, "shared.bulk-capacitor").find((profile) => (
      reviewedQuantity(profile.facts.ratedVoltage, "V") >= request.requirements.supplyVoltage.maximum.value
      && reviewedQuantity(profile.facts.nominalCapacitance, "F") >= bulkMinimum
    ));
    if (local === undefined || bulk === undefined) {
      return [{
        status: "rejected",
        reason: "No exact reviewed facts-V2 local and bulk capacitor pair meets the bridge's stated nominal minima and supply rating.",
        componentProfileIds: [designProfileId(primary.partClass, primary.part)],
      }];
    }
    return [{ status: "ok", value: {
      data: {
        ...option.data,
        localProfileId: designProfileId(local.partClass, local.part),
        bulkProfileId: designProfileId(bulk.partClass, bulk.part),
      },
      derivedValues: [],
      components: [
        selectedCapacitor("bulk-capacitor", "bulk-capacitor", bulk),
        selectedCapacitor("local-decoupling", "local-decoupling-capacitor", local),
        selectedPrimary(primary),
      ],
      simulationCoverage: [{
        scenarioId: "catalog-native-model",
        modelTier: "unavailable",
        limitations: ["No reviewed executable model is bundled for the exact selected facts-V2 bridge."],
      }],
      warnings: [],
    } }];
  },
  check(option, environment) {
    if (environment.request.application !== "motor.brushed-dc") {
      throw new TypeError("Motor facts-V2 checks require a motor.brushed-dc request");
    }
    const request = environment.request;
    const primary = matchedProfile(
      option,
      "primary",
      profilesForV2(environment.catalog, "motor.integrated-h-bridge"),
    );
    const local = matchedProfile(
      option,
      "local-decoupling",
      profilesForV2(environment.catalog, "shared.mlcc-capacitor"),
    );
    const bulk = matchedProfile(
      option,
      "bulk-capacitor",
      profilesForV2(environment.catalog, "shared.bulk-capacitor"),
    );
    const selectedProfiles: ProfileV2<PartClassId>[] = [bulk, local, primary];
    const facts = primary.facts;
    const supplyMaximum = request.requirements.supplyVoltage.maximum.value;
    const pulseEvidence = projectedEvidence(facts.minimumPulseWidth.evidence);
    const duty = request.requirements.operatingPoint.dutyCycle.value;
    const pwm = request.requirements.pwmFrequency.value;
    const onTime = canon(duty / pwm);
    const offTime = canon(canon(1 - duty) / pwm);
    const minimumPulse = reviewedQuantity(facts.minimumPulseWidth, "s");
    const constraints: ConstraintResult[] = [
      limitConstraint("motor.bridge.continuous-current", quantity(reviewedQuantity(facts.continuousCurrent, "A"), "A"), request.requirements.continuousCurrent, "at_least", projectedEvidence(facts.continuousCurrent.evidence), "Reviewed continuous bridge current covers the declared motor current."),
      limitConstraint("motor.bridge.high-side-duty", quantity(reviewedQuantity(facts.maximumHighSideDutyCycle, "1"), "1"), request.requirements.operatingPoint.dutyCycle, "at_least", projectedEvidence(facts.maximumHighSideDutyCycle.evidence), "Reviewed high-side duty capability covers the operating point."),
      limitConstraint("motor.bridge.logic-threshold", quantity(reviewedQuantity(facts.logicHighThresholdMaximum, "V"), "V"), request.requirements.logicVoltage, "at_most", projectedEvidence(facts.logicHighThresholdMaximum.evidence), "The logic rail reaches the reviewed worst-case high threshold."),
      limitConstraint("motor.bridge.peak-current", quantity(reviewedQuantity(facts.peakCurrent, "A"), "A"), request.requirements.stallCurrent, "at_least", projectedEvidence(facts.peakCurrent.evidence), "Reviewed peak bridge current covers the declared stall current."),
      limitConstraint("motor.bridge.pulse-off-time", quantity(offTime, "s"), quantity(minimumPulse, "s"), "at_least", pulseEvidence, "The requested PWM off-time is not shorter than the reviewed minimum pulse width."),
      limitConstraint("motor.bridge.pulse-on-time", quantity(onTime, "s"), quantity(minimumPulse, "s"), "at_least", pulseEvidence, "The requested PWM on-time is not shorter than the reviewed minimum pulse width."),
      limitConstraint("motor.bridge.pwm-frequency", quantity(reviewedQuantity(facts.pwmMaximum, "Hz"), "Hz"), request.requirements.pwmFrequency, "at_least", projectedEvidence(facts.pwmMaximum.evidence), "Reviewed PWM capability covers the requested frequency."),
      limitConstraint("motor.bridge.supply-maximum", request.requirements.supplyVoltage.maximum, quantity(reviewedQuantity(facts.supplyMaximum, "V"), "V"), "at_most", projectedEvidence(facts.supplyMaximum.evidence), "Requested maximum supply does not exceed the reviewed operating maximum."),
      limitConstraint("motor.bridge.supply-minimum", request.requirements.supplyVoltage.minimum, quantity(reviewedQuantity(facts.supplyMinimum, "V"), "V"), "at_least", projectedEvidence(facts.supplyMinimum.evidence), "Requested minimum supply is not below the reviewed operating minimum."),
      limitConstraint("motor.passive.bulk-capacitance-nominal", quantity(reviewedQuantity(bulk.facts.nominalCapacitance, "F"), "F"), quantity(reviewedQuantity(facts.bulkCapacitanceMinimum, "F"), "F"), "at_least", [...projectedEvidence(bulk.facts.nominalCapacitance.evidence), ...projectedEvidence(facts.bulkCapacitanceMinimum.evidence)], "Reviewed nominal bulk capacitance meets the bridge's stated nominal minimum."),
      limitConstraint("motor.passive.bulk-voltage-rating", quantity(reviewedQuantity(bulk.facts.ratedVoltage, "V"), "V"), quantity(supplyMaximum, "V"), "at_least", projectedEvidence(bulk.facts.ratedVoltage.evidence), "The bulk capacitor's reviewed nameplate voltage rating is not below the maximum supply."),
      unknownConstraint("motor.passive.capacitor-derating", "Nominal capacitance and nameplate voltage do not prove effective capacitance, bias derating, ripple, or transient margins at this operating point.", [...projectedEvidence(local.facts.nominalCapacitance.evidence), ...projectedEvidence(bulk.facts.nominalCapacitance.evidence)]),
      limitConstraint("motor.passive.local-capacitance-nominal", quantity(reviewedQuantity(local.facts.nominalCapacitance, "F"), "F"), quantity(reviewedQuantity(facts.localDecouplingMinimum, "F"), "F"), "at_least", [...projectedEvidence(local.facts.nominalCapacitance.evidence), ...projectedEvidence(facts.localDecouplingMinimum.evidence)], "Reviewed nominal local capacitance meets the bridge's stated nominal minimum."),
      limitConstraint("motor.passive.local-voltage-rating", quantity(reviewedQuantity(local.facts.ratedVoltage, "V"), "V"), quantity(supplyMaximum, "V"), "at_least", projectedEvidence(local.facts.ratedVoltage.evidence), "The local capacitor's reviewed nameplate voltage rating is not below the maximum supply."),
      unknownConstraint("motor.protection.current-limit", request.requirements.currentLimitTarget === null
        ? "No current-limit target is requested, but the selected bridge's protection configuration and safe stall behavior remain unproved."
        : "The requested current-limit target is not bound to a reviewed configured current-limit setting.", [...projectedEvidence(facts.currentLimitMinimum.evidence), ...projectedEvidence(facts.currentLimitMaximum.evidence)]),
      unknownConstraint("motor.request.motor-model", "No reviewed winding, back-EMF, speed, or dynamic motor model is bound to this candidate."),
      unknownConstraint("motor.request.motor-nominal-voltage", "The motor nominal-voltage operating point is not independently proved by bridge supply limits."),
      unknownConstraint("motor.request.operating-load", "The declared steady-state load is not proved against reviewed conduction, switching, and motor-loss calculations.", [...projectedEvidence(facts.pathResistance.evidence), ...projectedEvidence(facts.switchingTransitionTime.evidence)]),
      unknownConstraint("motor.request.operating-modes", "The Motor facts-V2 codec has no reviewed per-mode forward, reverse, coast, and brake capability contract."),
      unknownConstraint("motor.thermal.ambient-range", "The request ambient temperature is not proved against every selected part's reviewed operating range."),
      unknownConstraint("motor.thermal.maximum-junction", "No reviewed loss and thermal calculation proves the requested maximum junction temperature.", [...projectedEvidence(facts.junctionToAmbientThermalResistance.evidence), ...projectedEvidence(facts.maximumJunctionTemperature.evidence)]),
    ];
    if (request.constraints.allowedPackages.length > 0) {
      constraints.push({
        ruleId: "motor.assembly.allowed-packages",
        status: selectedProfiles.every((profile) => (
          profile.commonFacts.packageName.value !== null
          && request.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)
        )) ? "pass" : "fail",
        explanation: "Every reviewed package name is in the exact request allowlist.",
        evidence: selectedProfiles.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)),
      });
    }
    if (request.constraints.maximumComponentHeight !== null) {
      constraints.push(limitConstraint(
        "motor.assembly.component-height",
        quantity(Math.max(...selectedProfiles.map(mountedHeight)), "m"),
        request.constraints.maximumComponentHeight,
        "at_most",
        selectedProfiles.flatMap((profile) => projectedEvidence(profile.facts.mountedGeometry.maximumHeight.evidence)),
        "Every selected part's reviewed mounted maximum height fits the component-height limit.",
      ));
    }
    if (request.constraints.maximumBoardArea !== null) {
      constraints.push(unknownConstraint(
        "motor.assembly.board-area",
        "The sum of mounted land-pattern rectangles is only a ranking proxy and cannot prove placement, courtyard, keep-out, routing, or board-outline fit.",
        selectedProfiles.flatMap((profile) => projectedEvidence(profile.facts.mountedGeometry.boardArea.evidence)),
      ));
    }
    return constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
  },
  estimate(option, _constraints, environment) {
    const primary = matchedProfile(option, "primary", profilesForV2(environment.catalog, "motor.integrated-h-bridge"));
    const local = matchedProfile(option, "local-decoupling", profilesForV2(environment.catalog, "shared.mlcc-capacitor"));
    const bulk = matchedProfile(option, "bulk-capacitor", profilesForV2(environment.catalog, "shared.bulk-capacitor"));
    return {
      metrics: [
        {
          id: "motor.native.board-area",
          value: quantity(boardAreaProxy([bulk, local, primary]), "m2"),
          state: "calculated",
          explanation: "Ranking-only canonical sum of reviewed mounted land-pattern proxies; not a PCB fit proof.",
          evidence: [
            ...projectedEvidence(bulk.facts.mountedGeometry.boardArea.evidence),
            ...projectedEvidence(local.facts.mountedGeometry.boardArea.evidence),
            ...projectedEvidence(primary.facts.mountedGeometry.boardArea.evidence),
          ],
        },
        {
          id: "motor.native.component-count",
          value: quantity(option.components.length, "count"),
          state: "calculated",
          explanation: "Selected physical BOM line count.",
          evidence: [],
        },
      ],
      warnings: [],
    };
  },
  materialize(candidate) {
    return materialize(candidate);
  },
};
