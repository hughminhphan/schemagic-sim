import { canonicalDesignV2Payload, compareDesignV2Tokens, designSha256ContentHash, type BrushedDcMotorDesignRequestV2, type ConstraintResult, type Quantity } from "@opencircuit/design-schema";
import { designProfileId, type DesignProfileV1 } from "@opencircuit/design-library/v2-runtime";
import { evidenceFor, legacyProfiles, limitConstraint, materializeBom, numberFact, profilesFor, projectedEvidence, selected, totalBoardArea, unknownConstraint } from "./common";
import type { NativeMatchedOptionV2, NativeRecipeV2 } from "./types";

const RELEASE = { id: "motor.native.integrated-h-bridge", version: "1.0.0", equations: ["motor.bulk-energy.v1", "motor.profile-limits.v1"] } as const;
const metricDeclarations = [
  { id: "motor.native.board-area", unit: "m2" as const },
  { id: "motor.native.component-count", unit: "count" as const },
];

function optionProfile(option: NativeMatchedOptionV2, id: string, profiles: readonly DesignProfileV1[]): DesignProfileV1 {
  const component = option.components.find((entry) => entry.id === id);
  const profile = component && profiles.find((entry) => designProfileId(entry.partClass, entry.part) === component.profileId);
  if (!profile) throw new TypeError(`Missing selected profile ${id}`);
  return profile;
}

function q(value: number, unit: Quantity["unit"]): Quantity { return { value, unit, displayUnit: unit }; }

export const MOTOR_NATIVE_RECIPE: NativeRecipeV2 = {
  id: RELEASE.id,
  version: RELEASE.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE)),
  applications: ["motor.brushed-dc"],
  metricDeclarations,
  supports(request) {
    return request.application === "motor.brushed-dc" && request.constraints.allowedTopologyFamilies.includes("motor.hbridge.integrated");
  },
  enumerate(environment) {
    return profilesFor(environment.catalog, "motor.integrated-h-bridge").map((profile) => ({
      optionKey: designProfileId(profile.partClass, profile.part),
      data: { primaryProfileId: designProfileId(profile.partClass, profile.part) },
    }));
  },
  solve(option) { return { status: "ok", value: { data: { ...option.data }, derivedValues: [] } }; },
  match(option, environment) {
    const primary = profilesFor(environment.catalog, "motor.integrated-h-bridge").find((profile) => designProfileId(profile.partClass, profile.part) === option.data.primaryProfileId);
    if (!primary) return [{ status: "rejected", reason: "The enumerated bridge profile is no longer present in the exact catalog." }];
    const request = environment.request as BrushedDcMotorDesignRequestV2;
    const localMinimum = numberFact(primary, "localDecouplingMinimum");
    const bulkMinimum = Math.max(numberFact(primary, "bulkCapacitanceMinimum"), request.requirements.stallCurrent.value * 100e-6 / 2);
    const local = profilesFor(environment.catalog, "shared.mlcc-capacitor").find((profile) => numberFact(profile, "ratedVoltage") >= request.requirements.supplyVoltage.maximum.value && numberFact(profile, "nominalCapacitance") >= localMinimum);
    const bulk = profilesFor(environment.catalog, "shared.bulk-capacitor").find((profile) => numberFact(profile, "ratedVoltage") >= request.requirements.supplyVoltage.maximum.value && numberFact(profile, "nominalCapacitance") >= bulkMinimum);
    if (!local || !bulk) return [{ status: "rejected", reason: "No exact reviewed local and bulk capacitor pair closes the bridge requirements.", componentProfileIds: [designProfileId(primary.partClass, primary.part)] }];
    return [{ status: "ok", value: {
      data: { ...option.data, localProfileId: designProfileId(local.partClass, local.part), bulkProfileId: designProfileId(bulk.partClass, bulk.part) },
      derivedValues: [],
      components: [selected("bulk-capacitor", "bulk-capacitor", bulk, "nominalCapacitance"), selected("local-decoupling", "local-decoupling-capacitor", local, "nominalCapacitance"), selected("primary", "integrated-h-bridge", primary)],
      simulationCoverage: [{ scenarioId: "catalog-native-model", modelTier: "unavailable", limitations: ["No reviewed executable model is bundled for the exact selected bridge."] }],
      warnings: [],
    } }];
  },
  check(option, environment) {
    const request = environment.request as BrushedDcMotorDesignRequestV2;
    const allProfiles = legacyProfiles(environment.catalog);
    const primary = optionProfile(option, "primary", allProfiles);
    const selectedProfiles = option.components.map((component) => allProfiles.find((profile) => designProfileId(profile.partClass, profile.part) === component.profileId)!).filter(Boolean);
    const constraints: ConstraintResult[] = [
      limitConstraint("motor.bridge.supply-minimum", q(request.requirements.supplyVoltage.minimum.value, "V"), q(numberFact(primary, "supplyMinimum"), "V"), "at_least", evidenceFor(primary, "supplyMinimum"), "Requested minimum supply is not below the reviewed operating minimum."),
      limitConstraint("motor.bridge.supply-maximum", q(request.requirements.supplyVoltage.maximum.value, "V"), q(numberFact(primary, "supplyMaximum"), "V"), "at_most", evidenceFor(primary, "supplyMaximum"), "Requested maximum supply does not exceed the reviewed operating maximum."),
      limitConstraint("motor.bridge.continuous-current", q(numberFact(primary, "continuousCurrent"), "A"), q(request.requirements.continuousCurrent.value, "A"), "at_least", evidenceFor(primary, "continuousCurrent"), "Reviewed continuous bridge current covers the motor requirement."),
      limitConstraint("motor.bridge.peak-current", q(numberFact(primary, "peakCurrent"), "A"), q(request.requirements.stallCurrent.value, "A"), "at_least", evidenceFor(primary, "peakCurrent"), "Reviewed peak bridge current covers stall current."),
      limitConstraint("motor.bridge.logic-threshold", q(numberFact(primary, "logicHighThresholdMaximum"), "V"), q(request.requirements.logicVoltage.value, "V"), "at_most", evidenceFor(primary, "logicHighThresholdMaximum"), "The logic rail reaches the reviewed worst-case high threshold."),
      limitConstraint("motor.bridge.pwm-frequency", q(numberFact(primary, "pwmMaximum"), "Hz"), q(request.requirements.pwmFrequency.value, "Hz"), "at_least", evidenceFor(primary, "pwmMaximum"), "Reviewed PWM capability covers the requested frequency."),
      limitConstraint("motor.bridge.high-side-duty", q(numberFact(primary, "maximumHighSideDutyCycle"), "1"), q(request.requirements.operatingPoint.dutyCycle.value, "1"), "at_least", evidenceFor(primary, "maximumHighSideDutyCycle"), "Reviewed high-side duty capability covers the operating point."),
      unknownConstraint("motor.current-limit.profile-range", "The native recipe has not proved that the reviewed current-limit range and configuration cover this request.", [...evidenceFor(primary, "currentLimitMinimum"), ...evidenceFor(primary, "currentLimitMaximum")]),
      unknownConstraint("motor.request.current-limit-target", request.requirements.currentLimitTarget === null
        ? "No numeric current-limit target is requested, but that absence does not prove the selected bridge's protection configuration or safe stall-current behavior."
        : "The native recipe has not proved the requested current-limit target against a reviewed configured current-limit implementation.", [...evidenceFor(primary, "currentLimitMinimum"), ...evidenceFor(primary, "currentLimitMaximum")]),
      unknownConstraint("motor.request.motor-model", "The native recipe does not yet prove the winding model, speed-dependent behavior, or dynamic motor response declared or omitted by the request."),
      unknownConstraint("motor.request.motor-nominal-voltage", "The native recipe has not proved the motor nominal-voltage operating point independently of the bridge supply limits."),
      unknownConstraint("motor.request.operating-load", "The native recipe has not proved the declared operating-point load current, basis, and steady-state load profile against a reviewed loss model."),
      unknownConstraint("motor.request.operating-modes", "The profile codec does not yet carry reviewed forward, reverse, coast, and brake mode support facts for the exact selected bridge."),
      unknownConstraint("motor.thermal.ambient-range", "The request ambient temperature has not been proved against the exact selected bridge and passive operating ranges."),
      unknownConstraint("motor.thermal.maximum-junction", "No reviewed loss and thermal calculation proves the requested maximum junction temperature.", [...evidenceFor(primary, "junctionToAmbientThermalResistance"), ...evidenceFor(primary, "maximumJunctionTemperature")]),
    ];
    if (request.constraints.allowedPackages.length > 0) constraints.push({ ruleId: "motor.assembly.allowed-packages", status: selectedProfiles.every((profile) => profile.commonFacts.packageName.value !== null && request.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)) ? "pass" : "fail", explanation: "Every reviewed package name must be in the user's exact allowlist.", evidence: selectedProfiles.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)) });
    if (request.constraints.maximumComponentHeight) constraints.push(limitConstraint("motor.assembly.component-height", q(Math.max(...selectedProfiles.map((profile) => profile.commonFacts.maximumHeight.value?.value ?? Number.POSITIVE_INFINITY)), "m"), request.constraints.maximumComponentHeight, "at_most", selectedProfiles.flatMap((profile) => projectedEvidence(profile.commonFacts.maximumHeight.evidence)), "Every selected package fits the user component-height limit."));
    if (request.constraints.maximumBoardArea) constraints.push(unknownConstraint(
      "motor.assembly.board-area",
      "The sum of per-component board-area proxies cannot prove a placed and routed assembly fits the requested board area; a verified placement artifact is required.",
      selectedProfiles.flatMap((profile) => projectedEvidence(profile.commonFacts.boardArea.evidence)),
    ));
    return constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
  },
  estimate(option, _constraints, environment) {
    const allProfiles = legacyProfiles(environment.catalog);
    const profiles = option.components.map((component) => allProfiles.find((profile) => designProfileId(profile.partClass, profile.part) === component.profileId)!).filter(Boolean);
    return { metrics: [
      { id: "motor.native.board-area", value: q(totalBoardArea(profiles), "m2"), state: "calculated", explanation: "Ranking-only sum of per-component board-area proxies; not a placement, routing, or courtyard fit proof.", evidence: [] },
      { id: "motor.native.component-count", value: q(option.components.length, "count"), state: "calculated", explanation: "Selected physical BOM line count.", evidence: [] },
    ], warnings: [] };
  },
  materialize(candidate) { return materializeBom(candidate, "Catalog-native integrated motor bridge", new Set(["primary"])); },
};
