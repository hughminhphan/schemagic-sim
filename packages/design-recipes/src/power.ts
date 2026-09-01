import { canonicalDesignV2Payload, compareDesignV2Tokens, designSha256ContentHash, type BuckDesignRequestV2, type ConstraintResult, type Quantity } from "@opencircuit/design-schema";
import { designProfileId, type DesignProfileV1 } from "@opencircuit/design-library/v2-runtime";
import { evidenceFor, legacyProfiles, limitConstraint, materializeBom, numberFact, profilesFor, projectedEvidence, selected, totalBoardArea, unknownConstraint } from "./common";
import type { NativeMatchedOptionV2, NativeRecipeV2 } from "./types";

const RELEASE = { id: "power.native.integrated-synchronous-buck", version: "1.0.0", equations: ["power.feedback-divider.v1", "power.profile-limits.v1"] } as const;
const metricDeclarations = [
  { id: "power.native.board-area", unit: "m2" as const },
  { id: "power.native.component-count", unit: "count" as const },
];
function q(value: number, unit: Quantity["unit"]): Quantity { return { value, unit, displayUnit: unit }; }
function optionProfile(option: NativeMatchedOptionV2, id: string, profiles: readonly DesignProfileV1[]): DesignProfileV1 {
  const component = option.components.find((entry) => entry.id === id);
  const profile = component && profiles.find((entry) => designProfileId(entry.partClass, entry.part) === component.profileId);
  if (!profile) throw new TypeError(`Missing selected profile ${id}`);
  return profile;
}

export const POWER_NATIVE_RECIPE: NativeRecipeV2 = {
  id: RELEASE.id,
  version: RELEASE.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(RELEASE)),
  applications: ["power.buck"],
  metricDeclarations,
  supports(request) { return request.application === "power.buck" && request.constraints.allowedTopologyFamilies.includes("power.buck.integrated-synchronous"); },
  enumerate(environment) { return profilesFor(environment.catalog, "power.integrated-synchronous-buck-regulator").map((profile) => ({ optionKey: designProfileId(profile.partClass, profile.part), data: { primaryProfileId: designProfileId(profile.partClass, profile.part) } })); },
  solve(option) { return { status: "ok", value: { data: { ...option.data }, derivedValues: [] } }; },
  match(option, environment) {
    const primary = profilesFor(environment.catalog, "power.integrated-synchronous-buck-regulator").find((profile) => designProfileId(profile.partClass, profile.part) === option.data.primaryProfileId);
    if (!primary) return [{ status: "rejected", reason: "The enumerated regulator profile is no longer present in the exact catalog." }];
    const request = environment.request as BuckDesignRequestV2;
    const capacitors = profilesFor(environment.catalog, "shared.mlcc-capacitor");
    const inputCap = capacitors.find((profile) => numberFact(profile, "ratedVoltage") >= request.requirements.inputVoltage.maximum.value);
    const outputCap = capacitors.find((profile) => numberFact(profile, "ratedVoltage") >= request.requirements.outputVoltage.value);
    const inductor = profilesFor(environment.catalog, "power.power-inductor").find((profile) => numberFact(profile, "saturationCurrent") >= request.requirements.maximumOutputCurrent.value && numberFact(profile, "rmsCurrent") >= request.requirements.maximumOutputCurrent.value);
    const resistors = profilesFor(environment.catalog, "shared.general-purpose-resistor");
    const reference = numberFact(primary, "feedbackReference");
    const divider = resistors.flatMap((upper) => resistors.map((lower) => ({ upper, lower, predicted: reference * (1 + numberFact(upper, "resistance") / numberFact(lower, "resistance")) })))
      .sort((left, right) => Math.abs(left.predicted - request.requirements.outputVoltage.value) - Math.abs(right.predicted - request.requirements.outputVoltage.value) || compareDesignV2Tokens(designProfileId(left.upper.partClass, left.upper.part), designProfileId(right.upper.partClass, right.upper.part)) || compareDesignV2Tokens(designProfileId(left.lower.partClass, left.lower.part), designProfileId(right.lower.partClass, right.lower.part)))[0];
    if (!inputCap || !outputCap || !inductor || !divider) return [{ status: "rejected", reason: "No exact reviewed passive set closes the integrated buck BOM.", componentProfileIds: [designProfileId(primary.partClass, primary.part)] }];
    return [{ status: "ok", value: {
      data: { ...option.data, predictedOutputVoltage: divider.predicted },
      derivedValues: [],
      components: [selected("feedback-lower", "feedback-lower-resistor", divider.lower, "resistance"), selected("feedback-upper", "feedback-upper-resistor", divider.upper, "resistance"), selected("input-capacitor", "input-capacitor", inputCap, "nominalCapacitance"), selected("output-capacitor", "output-capacitor", outputCap, "nominalCapacitance"), selected("power-inductor", "power-inductor", inductor, "inductance"), selected("primary", "integrated-synchronous-buck-regulator", primary)],
      simulationCoverage: [{ scenarioId: "catalog-native-model", modelTier: "unavailable", limitations: ["No reviewed executable model is bundled for the exact selected regulator."] }],
      warnings: [],
    } }];
  },
  check(option, environment) {
    const request = environment.request as BuckDesignRequestV2;
    const allProfiles = legacyProfiles(environment.catalog);
    const primary = optionProfile(option, "primary", allProfiles);
    const profiles = option.components.map((component) => allProfiles.find((profile) => designProfileId(profile.partClass, profile.part) === component.profileId)!).filter(Boolean);
    const inputCapacitor = optionProfile(option, "input-capacitor", allProfiles);
    const outputCapacitor = optionProfile(option, "output-capacitor", allProfiles);
    const inductor = optionProfile(option, "power-inductor", allProfiles);
    const feedbackUpper = optionProfile(option, "feedback-upper", allProfiles);
    const feedbackLower = optionProfile(option, "feedback-lower", allProfiles);
    const predicted = Number(option.data.predictedOutputVoltage);
    const constraints: ConstraintResult[] = [
      limitConstraint("power.regulator.input-minimum", q(request.requirements.inputVoltage.minimum.value, "V"), q(numberFact(primary, "inputVoltageMinimum"), "V"), "at_least", evidenceFor(primary, "inputVoltageMinimum"), "Requested minimum input is not below the reviewed operating minimum."),
      limitConstraint("power.regulator.input-maximum", q(request.requirements.inputVoltage.maximum.value, "V"), q(numberFact(primary, "inputVoltageMaximum"), "V"), "at_most", evidenceFor(primary, "inputVoltageMaximum"), "Requested maximum input does not exceed the reviewed operating maximum."),
      limitConstraint("power.regulator.output-minimum", q(request.requirements.outputVoltage.value, "V"), q(numberFact(primary, "outputVoltageMinimum"), "V"), "at_least", evidenceFor(primary, "outputVoltageMinimum"), "Requested output is not below the reviewed range."),
      limitConstraint("power.regulator.output-maximum", q(request.requirements.outputVoltage.value, "V"), q(numberFact(primary, "outputVoltageMaximum"), "V"), "at_most", evidenceFor(primary, "outputVoltageMaximum"), "Requested output does not exceed the reviewed range."),
      limitConstraint("power.regulator.output-current", q(numberFact(primary, "outputCurrentMaximum"), "A"), q(request.requirements.maximumOutputCurrent.value, "A"), "at_least", evidenceFor(primary, "outputCurrentMaximum"), "Reviewed current capability covers the load requirement."),
      limitConstraint("power.feedback.output-voltage", q(Math.abs(predicted - request.requirements.outputVoltage.value), "V"), q(Math.max(request.requirements.outputVoltage.value * 0.01, 1e-9), "V"), "at_most", evidenceFor(primary, "feedbackReference"), "The exact reviewed divider values set output within one percent."),
      limitConstraint("power.regulator.switching-range-lower", q(numberFact(primary, "switchingFrequencyMaximum"), "Hz"), q(request.requirements.switchingFrequency.minimum.value, "Hz"), "at_least", evidenceFor(primary, "switchingFrequencyMaximum"), "The reviewed switching range overlaps the requested lower bound."),
      limitConstraint("power.regulator.switching-range-upper", q(numberFact(primary, "switchingFrequencyMinimum"), "Hz"), q(request.requirements.switchingFrequency.maximum.value, "Hz"), "at_most", evidenceFor(primary, "switchingFrequencyMinimum"), "The reviewed switching range overlaps the requested upper bound."),
      unknownConstraint("power.inductor.ripple-current", "The native recipe has not calculated and proved ripple, peak, and RMS inductor current at a selected switching point.", [...evidenceFor(inductor, "saturationCurrent"), ...evidenceFor(inductor, "rmsCurrent")]),
      unknownConstraint("power.inductor.selected-value", "The selected inductance has not been proved by a reviewed sizing equation at the request voltage, current, ripple, and switching conditions.", evidenceFor(inductor, "inductance")),
      unknownConstraint("power.passive.capacitor-voltage", "Input and output capacitor voltage derating and headroom have not been proved for the requested rails.", [...evidenceFor(inputCapacitor, "ratedVoltage"), ...evidenceFor(outputCapacitor, "ratedVoltage")]),
      unknownConstraint("power.passive.resistor-power-voltage", "Feedback-resistor continuous-power and working-voltage margins have not been proved.", [...evidenceFor(feedbackUpper, "continuousPower"), ...evidenceFor(feedbackUpper, "workingVoltage"), ...evidenceFor(feedbackLower, "continuousPower"), ...evidenceFor(feedbackLower, "workingVoltage")]),
      unknownConstraint("power.regulator.current-limit", "The selected regulator current limit has not been proved against calculated inductor peak current.", evidenceFor(primary, "currentLimit")),
      unknownConstraint("power.regulator.minimum-off-time", "Worst-case off time has not been calculated and proved against the reviewed regulator minimum.", evidenceFor(primary, "minimumOffTime")),
      unknownConstraint("power.regulator.minimum-on-time", "Worst-case on time has not been calculated and proved against the reviewed regulator minimum.", evidenceFor(primary, "minimumOnTime")),
      unknownConstraint("power.request.load-transient", request.requirements.loadTransientTarget === null
        ? "No numeric load-transient target is requested, and the native recipe therefore makes no transient-response pass claim."
        : "The requested current step, output deviation, and settling time have not been proved by a reviewed transient model."),
      unknownConstraint("power.request.output-ripple", "Output ripple has not been calculated from reviewed effective capacitance, ESR, inductance, and switching conditions."),
      unknownConstraint("power.request.switching-selection", "The native recipe has not made and proved the requested automatic or fixed switching-frequency selection.", evidenceFor(primary, "switchingFrequencyRecommended")),
      unknownConstraint("power.thermal.ambient-range", "The request ambient temperature has not been proved against every selected semiconductor and passive operating range."),
      unknownConstraint("power.thermal.maximum-junction", "No reviewed loss and thermal calculation proves the requested maximum junction temperature.", [...evidenceFor(primary, "junctionToAmbientThermalResistance"), ...evidenceFor(primary, "maximumJunctionTemperature")]),
    ];
    if (request.constraints.allowedPackages.length > 0) constraints.push({ ruleId: "power.assembly.allowed-packages", status: profiles.every((profile) => profile.commonFacts.packageName.value !== null && request.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)) ? "pass" : "fail", explanation: "Every reviewed package name must be in the user's exact allowlist.", evidence: profiles.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)) });
    if (request.constraints.maximumComponentHeight) constraints.push(limitConstraint("power.assembly.component-height", q(Math.max(...profiles.map((profile) => profile.commonFacts.maximumHeight.value?.value ?? Number.POSITIVE_INFINITY)), "m"), request.constraints.maximumComponentHeight, "at_most", profiles.flatMap((profile) => projectedEvidence(profile.commonFacts.maximumHeight.evidence)), "Every selected package fits the user component-height limit."));
    if (request.constraints.maximumBoardArea) constraints.push(unknownConstraint(
      "power.assembly.board-area",
      "The sum of per-component board-area proxies cannot prove a placed and routed assembly fits the requested board area; a verified placement artifact is required.",
      profiles.flatMap((profile) => projectedEvidence(profile.commonFacts.boardArea.evidence)),
    ));
    return constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
  },
  estimate(option, _constraints, environment) {
    const allProfiles = legacyProfiles(environment.catalog);
    const profiles = option.components.map((component) => allProfiles.find((profile) => designProfileId(profile.partClass, profile.part) === component.profileId)!).filter(Boolean);
    return { metrics: [
      { id: "power.native.board-area", value: q(totalBoardArea(profiles), "m2"), state: "calculated", explanation: "Ranking-only sum of per-component board-area proxies; not a placement, routing, or courtyard fit proof.", evidence: [] },
      { id: "power.native.component-count", value: q(option.components.length, "count"), state: "calculated", explanation: "Selected physical BOM line count.", evidence: [] },
    ], warnings: [] };
  },
  materialize(candidate) { return materializeBom(candidate, "Catalog-native integrated synchronous buck", new Set(["primary"])); },
};
