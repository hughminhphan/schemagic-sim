import {
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  canonicalJson,
  canonicalProfileNumberV2,
  compareAscii,
  designProfileEnvelopeContentHash,
  getBundledDesignLibraryDocuments,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type ManufacturerRegistryV1,
  type PowerIntegratedSynchronousBuckFactsV2,
  type ProfileConditionV2,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantityClaimV2,
} from "@opencircuit/design-library";
import {
  REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT,
  buildRealCatalogFactsV2ReadinessReport,
} from "./facts-v2-readiness";
import { REAL_PRIMARY_PART_CATALOG } from "./profiles";
import type {
  FactsV2CandidateDimensionTerm,
  FactsV2CandidateObservedCondition,
  FactsV2CandidateProfilePlan,
  FactsV2ClaimCandidate,
  FactsV2ConfiguredProductionSpreadObservation,
  FactsV2DraftAuthoringAssessment,
  FactsV2DraftAuthoringBlocker,
  FactsV2MandatoryEvidenceCandidate,
  FactsV2MandatoryEvidenceEntry,
  FactsV2PartialNonAdmittedDraft,
  RealCatalogFactsV2ReadinessReport,
  RealPrimaryPartCatalog,
  RealPrimaryPartClass,
  RealPrimaryPartProfile,
  SourceLocator,
} from "./types";

const SCHEMA_DRAFT_BLOCKERS: Readonly<Record<RealPrimaryPartClass, readonly string[]>> = {
  "power.integrated-synchronous-buck-regulator": [
    "/commonFacts/packageName",
    "/facts/controlEvidenceBasis",
    "/facts/mountedGeometry/boardArea",
    "/facts/mountedGeometry/maximumHeight",
  ],
  "power.external-fet-synchronous-buck-controller": [
    "/commonFacts/packageName",
    "/facts/controlEvidenceBasis",
    "/facts/currentSenseThresholdOptions",
    "/facts/gateDriveVoltageOptions",
    "/facts/mountedGeometry/boardArea",
    "/facts/mountedGeometry/maximumHeight",
  ],
};

const CLAIM_GROUPS: Readonly<Record<RealPrimaryPartClass, readonly (readonly string[])[]>> = {
  "power.integrated-synchronous-buck-regulator": [
    ["inputVoltageMinimum", "inputVoltageMaximum"],
    ["outputVoltageMinimum", "outputVoltageMaximum"],
    ["outputCurrentCapabilityMinimum"],
    ["currentLimitMinimum", "currentLimitTypical", "currentLimitMaximum"],
    ["switchingFrequencyMinimum", "switchingFrequencyRecommended", "switchingFrequencyMaximum"],
    ["minimumOnTimeMaximum"],
    ["minimumOffTimeMaximum"],
    ["feedbackReferenceMinimum", "feedbackReferenceTypical", "feedbackReferenceMaximum"],
    ["quiescentCurrentMaximum"],
    ["junctionToAmbientThermalResistanceMaximum"],
    ["maximumJunctionTemperature"],
    ["highSideOnResistanceMaximum"],
    ["lowSideOnResistanceMaximum"],
  ],
  "power.external-fet-synchronous-buck-controller": [
    ["inputVoltageMinimum", "inputVoltageMaximum"],
    ["outputVoltageMinimum", "outputVoltageMaximum"],
    ["switchingFrequencyMinimum", "switchingFrequencyRecommended", "switchingFrequencyMaximum"],
    ["minimumOnTimeMaximum"],
    ["minimumOffTimeMaximum"],
    ["feedbackReferenceMinimum", "feedbackReferenceTypical", "feedbackReferenceMaximum"],
    ["quiescentCurrentMaximum"],
    ["junctionToAmbientThermalResistanceMaximum"],
    ["maximumJunctionTemperature"],
    ["gateSourceCurrentMinimum"],
    ["gateSinkCurrentMinimum"],
    ["gatePullupResistanceMaximum"],
    ["gatePulldownResistanceMaximum"],
    ["deadTimeMaximum"],
  ],
};

const NCP1599_PARTIAL_KNOWN_CLAIM_PATHS = [
  "/facts/currentLimitMaximum",
  "/facts/currentLimitMinimum",
  "/facts/currentLimitTypical",
  "/facts/inputVoltageMaximum",
  "/facts/inputVoltageMinimum",
  "/facts/maximumJunctionTemperature",
  "/facts/minimumOnTimeMaximum",
] as const;

const NCP1599_PARTIAL_UNKNOWN_PATHS = [
  "/commonFacts/boardArea",
  "/commonFacts/maximumHeight",
  "/facts/controlEvidenceBasis",
  "/facts/fallTimeMaximum",
  "/facts/feedbackReferenceMaximum",
  "/facts/feedbackReferenceMinimum",
  "/facts/feedbackReferenceTypical",
  "/facts/highSideOnResistanceMaximum",
  "/facts/junctionToAmbientThermalResistanceMaximum",
  "/facts/lowSideOnResistanceMaximum",
  "/facts/minimumOffTimeMaximum",
  "/facts/outputCurrentCapabilityMinimum",
  "/facts/outputVoltageMaximum",
  "/facts/outputVoltageMinimum",
  "/facts/quiescentCurrentMaximum",
  "/facts/riseTimeMaximum",
  "/facts/switchingFrequencyMaximum",
  "/facts/switchingFrequencyMinimum",
  "/facts/switchingFrequencyRecommended",
] as const;

const EXPECTED_PROFILE_IDENTITY = {
  "real.analog-devices.lt8640siv-pbf": {
    partClass: "power.integrated-synchronous-buck-regulator",
    manufacturerId: "analog-devices",
    manufacturerPartNumber: "LT8640SIV#PBF",
  },
  "real.analog-devices.ltc3891efe-pbf": {
    partClass: "power.external-fet-synchronous-buck-controller",
    manufacturerId: "analog-devices",
    manufacturerPartNumber: "LTC3891EFE#PBF",
  },
  "real.analog-devices.ltc3895efe-pbf": {
    partClass: "power.external-fet-synchronous-buck-controller",
    manufacturerId: "analog-devices",
    manufacturerPartNumber: "LTC3895EFE#PBF",
  },
  "real.onsemi.ncp1599mntwg": {
    partClass: "power.integrated-synchronous-buck-regulator",
    manufacturerId: "onsemi",
    manufacturerPartNumber: "NCP1599MNTWG",
  },
  "real.texas-instruments.lm5145rgyr": {
    partClass: "power.external-fet-synchronous-buck-controller",
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "LM5145RGYR",
  },
  "real.texas-instruments.lm70880rrxr": {
    partClass: "power.integrated-synchronous-buck-regulator",
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "LM70880RRXR",
  },
  "real.texas-instruments.tps54302ddcr": {
    partClass: "power.integrated-synchronous-buck-regulator",
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "TPS54302DDCR",
  },
} as const;

type CandidateProfileId = keyof typeof EXPECTED_PROFILE_IDENTITY;

const EXPECTED_EXACT_SOURCE_HASHES: Readonly<Record<string, `sha256:${string}`>> = {
  "adi-lt8640s-datasheet": "sha256:489bb5559a2103cb9f90b59ae9e6e45b7a4e06f5c3df8c7154a9e23c5f457ecc",
  "adi-ltc3891-datasheet": "sha256:21a46463d6a45e3ce64349c2359866de6eeb819a33372c909f1426af8ef1aba6",
  "adi-ltc3895-datasheet": "sha256:33b389917fddb3be0e9e549217a41b791445c8acb34349dfe711a9e786105c09",
  "onsemi-ncp1599-datasheet": "sha256:40e0c29696d6adb4b35e8f331fc404d5c4efab35a15f8b449223c97931fc5650",
  "ti-lm5145-datasheet": "sha256:9916caabb1429cc97985e260e0d0b0ccce1850156ac31557c9be079f7dd00a9e",
  "ti-lm70880-datasheet": "sha256:f6115dacb305ac44d58d1985647095d05406861532e22d8d8643cb215561f3dc",
  "ti-tps54302-datasheet": "sha256:1632b388d1ba3a46c8e8f090ddfec2114c0f538cfb8364ddcda583fee3fdbdc5",
};

const EXPECTED_EXACT_SOURCE_URLS: Readonly<Record<string, string>> = {
  "adi-lt8640s-datasheet": "https://www.analog.com/media/en/technical-documentation/data-sheets/lt8640s-lt8643s-lt8640sa-lt8643sa.pdf",
  "adi-ltc3891-datasheet": "https://www.analog.com/media/en/technical-documentation/data-sheets/3891fa.pdf",
  "adi-ltc3895-datasheet": "https://www.analog.com/media/en/technical-documentation/data-sheets/3895fa.pdf",
  "onsemi-ncp1599-datasheet": "https://www.onsemi.com/download/data-sheet/pdf/ncp1599-d.pdf",
  "ti-lm5145-datasheet": "https://www.ti.com/lit/ds/symlink/lm5145.pdf",
  "ti-lm70880-datasheet": "https://www.ti.com/lit/ds/symlink/lm70880.pdf",
  "ti-tps54302-datasheet": "https://www.ti.com/lit/ds/symlink/tps54302.pdf",
};

type UnboundEvidenceEntry = Omit<FactsV2MandatoryEvidenceEntry, "exactByteEvidence"> & {
  sourceRefs: readonly SourceLocator[];
};

function ref(sourceId: string, locator: string): SourceLocator {
  return { sourceId, locator };
}

function quantityCondition(
  parameterId: string,
  factsV2ParameterId: string | null,
  minimum: number,
  maximum: number,
  unit: "V" | "A" | "K",
  sourceRef: SourceLocator,
  minimumExclusive = false,
  maximumExclusive = false,
): FactsV2CandidateObservedCondition {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
    throw new Error(`Invalid observed condition range for ${parameterId}`);
  }
  return {
    parameterId,
    factsV2ParameterId,
    minimum: { value: minimum, unit },
    maximum: { value: maximum, unit },
    setting: null,
    minimumExclusive,
    maximumExclusive,
    sourceRefs: [sourceRef],
  };
}

function settingCondition(
  parameterId: string,
  setting: string,
  sourceRef: SourceLocator,
): FactsV2CandidateObservedCondition {
  return {
    parameterId,
    factsV2ParameterId: null,
    minimum: null,
    maximum: null,
    setting,
    minimumExclusive: false,
    maximumExclusive: false,
    sourceRefs: [sourceRef],
  };
}

function spreadObservation(
  settingId: string,
  setting: string,
  minimum: number,
  typical: number,
  maximum: number,
  observedConditions: readonly FactsV2CandidateObservedCondition[],
): FactsV2ConfiguredProductionSpreadObservation {
  if (!(minimum > 0 && minimum <= typical && typical <= maximum)) {
    throw new Error(`Invalid configured production spread for ${settingId}`);
  }
  const conditionIds = observedConditions.map((condition) => condition.parameterId);
  const sortedConditionIds = [...conditionIds].sort(compareAscii);
  if (conditionIds.some((conditionId, index) => conditionId !== sortedConditionIds[index]) || new Set(conditionIds).size !== conditionIds.length) {
    throw new Error(`Observed conditions must be unique and sorted for ${settingId}`);
  }
  return {
    settingId,
    setting,
    minimum: { value: minimum, unit: "V" },
    typical: { value: typical, unit: "V" },
    maximum: { value: maximum, unit: "V" },
    sourceRequiredConditionIds: conditionIds,
    factsV2RequiredConditionIds: observedConditions
      .map((condition) => condition.factsV2ParameterId)
      .filter((conditionId): conditionId is string => conditionId !== null),
    observedConditions,
  };
}

function dimension(
  axis: "x" | "y",
  dimensionId: string,
  multiplier: number,
  maximumMillimetres: number,
  sourceRef: SourceLocator,
): FactsV2CandidateDimensionTerm {
  return {
    axis,
    dimensionId,
    multiplier,
    maximum: { value: maximumMillimetres / 1_000, unit: "m", displayUnit: "mm" },
    sourceRefs: [sourceRef],
  };
}

function boardAreaCandidate(sourceDimensions: readonly FactsV2CandidateDimensionTerm[]): FactsV2MandatoryEvidenceCandidate {
  let xSpan = 0;
  let ySpan = 0;
  for (const term of sourceDimensions) {
    const contribution = canonicalProfileNumberV2(term.multiplier * term.maximum.value);
    if (term.axis === "x") xSpan = canonicalProfileNumberV2(xSpan + contribution);
    else ySpan = canonicalProfileNumberV2(ySpan + contribution);
  }
  if (xSpan <= 0 || ySpan <= 0) throw new Error("Candidate board-area evidence requires both axes");
  return {
    kind: "board_area_projection",
    area: {
      value: canonicalProfileNumberV2(xSpan * ySpan),
      unit: "m2",
      displayUnit: "mm2",
    },
    basis: "manufacturer_recommended_land_pattern_bounding_box",
    calculation: "maximum_x_span_times_maximum_y_span",
    sourceDimensions: [...sourceDimensions],
  };
}

function commonEntry(
  targetPath: string,
  candidate: FactsV2MandatoryEvidenceCandidate,
  sourceRefs: readonly SourceLocator[],
  blockingReason: string,
): UnboundEvidenceEntry {
  return {
    targetPath,
    status: "source_bound_pending_independent_review",
    candidate,
    sourceRefs,
    blockingReason,
    requiredResolution: "An independent reviewer must verify the exact MPN-to-package drawing mapping and candidate value before any reviewed fact is authored.",
  };
}

function lt8640sEvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "adi-lt8640s-datasheet";
  const packageRef = ref(sourceId, "Order Information, LT8640SIV#PBF LQFN with QFN footprint row, page 2; Package Description, 24-lead 4 mm x 4 mm x 0.94 mm LQFN, LTC drawing 05-08-1511 Rev. C, page 30");
  const footprintRef = ref(sourceId, "Package Description, Suggested PCB Layout Top View, 4.50 mm +/- 0.05 mm bounding span on both axes, page 30");
  const heightRef = ref(sourceId, "Package Description dimension table, package height A maximum 1.03 mm, page 30");
  const controlRefs = [
    ref(sourceId, "Features, peak current mode control with 30 ns minimum on-time, page 1"),
    ref(sourceId, "Applications Information, internal frequency compensation for LT8640S/LT8640SA and application-specific loop-stability discussion, pages 22-23"),
  ];
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "24-lead 4 mm x 4 mm x 0.94 mm LQFN with QFN footprint" },
      [packageRef],
      "The exact LT8640SIV#PBF-to-LQFN package mapping is source-bound, but commonFacts.packageName remains authored pending independent review.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The datasheet identifies peak-current-mode control and internal compensation, but it does not establish a bounded profile-level control model or application-specific loop-stability evidence.",
      requiredResolution: "Provide independently reviewed control-model evidence for a configured design and explicit operating envelope; do not relabel topology or compensation prose as stability evidence.",
    },
    commonEntry(
      "/facts/mountedGeometry/boardArea",
      boardAreaCandidate([
        dimension("x", "suggested-pcb-layout-span", 1, 4.55, footprintRef),
        dimension("y", "suggested-pcb-layout-span", 1, 4.55, footprintRef),
      ]),
      [footprintRef],
      "The manufacturer suggested PCB layout supports a conservative 4.55 mm x 4.55 mm authored bounding calculation; the MPN-to-drawing mapping remains pending independent review.",
    ),
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1.03e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The drawing supplies a 1.03 mm maximum package height, but facts-V2 requires an independently reviewed maximum-height fact.",
    ),
  ];
}

function ncp1599EvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "onsemi-ncp1599-datasheet";
  const packageRef = ref(sourceId, "Ordering Information, NCP1599MNTWG DFN6 row, page 1; Mechanical Case Outline 98AON19891D, DFN6 3 mm x 3 mm CASE 506AH, page 15");
  const footprintRef = ref(sourceId, "Mechanical Case Outline 98AON19891D, Soldering Footprint, 2.60 mm x 3.31 mm exposed-metal bounding span, page 15");
  const heightRef = ref(sourceId, "Mechanical Case Outline 98AON19891D, Package Dimensions, dimension A maximum 1.00 mm, page 15");
  const controlRefs = [
    ref(sourceId, "Detailed Description, Overview, current-mode control, page 10"),
    ref(sourceId, "Compensation Design, application-specific external compensation network, pages 12-13"),
  ];
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "DFN6 3 mm x 3 mm, 0.95 mm pitch (CASE 506AH)" },
      [packageRef],
      "The exact package identity is source-bound, but commonFacts.packageName must be a reviewed fact and this mapping is authored only.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The datasheet identifies current-mode control and supplies general compensation guidance, but it does not establish a profile-level bounded control model or application-specific loop-stability evidence.",
      requiredResolution: "Provide independently reviewed control-model evidence with an explicit operating envelope; do not relabel control topology or compensation prose as stability evidence.",
    },
    commonEntry(
      "/facts/mountedGeometry/boardArea",
      boardAreaCandidate([
        dimension("x", "land-pattern-x-span", 1, 2.60, footprintRef),
        dimension("y", "land-pattern-y-span", 1, 3.31, footprintRef),
      ]),
      [footprintRef],
      "The manufacturer land-pattern dimensions support an exact authored area calculation, but the MPN-to-drawing mapping has not been independently reviewed.",
    ),
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1.00e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The manufacturer maximum package height is source-bound, but facts-V2 requires a reviewed maximum-height fact.",
    ),
  ];
}

function tps54302EvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "ti-tps54302-datasheet";
  const packageRef = ref(sourceId, "Package Option Addendum, TPS54302DDCR active-production SOT-23-THIN (DDC), 6-pin row, page 25; Package Outline DDC0006A, page 29");
  const footprintRef = ref(sourceId, "Package drawing DDC0006A, Example Board Layout: 2.7 mm pad-row center spacing, 1.1 mm pad length, two 0.95 mm pitch intervals, and 0.6 mm pad width, page 30");
  const heightRef = ref(sourceId, "Package Outline DDC0006A, SOT-23 1.1 mm maximum height, page 29");
  const controlRefs = [
    ref(sourceId, "Section 6.3.1 Fixed-Frequency PWM Control, peak-current-mode operation, page 9"),
    ref(sourceId, "Section 6.1 Overview and Section 6.3.3 Error Amplifier, internal loop compensation, pages 8 and 10"),
  ];
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "SOT-23-THIN (DDC), 6-pin" },
      [packageRef],
      "The exact orderable part-to-package identity is source-bound, but commonFacts.packageName must be independently reviewed.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The datasheet identifies peak-current-mode control and internal compensation, but it does not provide the application-specific bounded control or loop-stability evidence required by this profile field.",
      requiredResolution: "Provide independently reviewed control-model evidence over a stated operating envelope; control mode and internal-compensation labels alone are insufficient.",
    },
    commonEntry(
      "/facts/mountedGeometry/boardArea",
      boardAreaCandidate([
        dimension("x", "pad-length", 1, 1.1, footprintRef),
        dimension("x", "pad-row-center-spacing", 1, 2.7, footprintRef),
        dimension("y", "pad-width", 1, 0.6, footprintRef),
        dimension("y", "terminal-pitch", 2, 0.95, footprintRef),
      ]),
      [footprintRef],
      "The manufacturer land-pattern dimensions support a 3.8 mm x 2.5 mm authored bounding calculation; the mapping remains pending independent review.",
    ),
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1.1e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The manufacturer maximum package height is source-bound, but facts-V2 requires a reviewed maximum-height fact.",
    ),
  ];
}

function lm70880EvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "ti-lm70880-datasheet";
  const packageRef = ref(sourceId, "Package Option Addendum dated 6-Feb-2026, exact active-production LM70880RRXR VQFN (RRX), 29-pin row, physical PDF page 48; RRX0029B Package Outline, physical PDF page 52");
  const footprintRef = ref(sourceId, "RRX0029B Package Outline note 1 says parenthesized dimensions are reference-only, physical PDF page 52; the Example Board Layout uses parenthesized, asymmetric 3.2 mm and 2.9 mm outer coordinates, physical PDF page 53");
  const heightRef = ref(sourceId, "RRX0029B Package Outline, drawing 4228757/D 04/2024, VQFN 1.0 mm maximum height, physical PDF page 52");
  const controlRefs = [
    ref(sourceId, "Section 3 Description, peak current-mode control architecture, physical PDF page 1"),
    ref(sourceId, "Section 6.3.10 Error Amplifier and PWM Comparator (FB, EXTCOMP), EXTCOMP impedance selects internal or external compensation, physical PDF page 17"),
  ];
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "VQFN (RRX), 29-pin" },
      [packageRef],
      "The exact active-production LM70880RRXR-to-RRX package mapping is source-bound, but a facts-V2 package fact would still require independent review.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The source identifies peak-current-mode control and an application-selected internal/external compensation architecture, but it does not establish a configured bounded control model or application-specific loop-stability evidence.",
      requiredResolution: "Provide independently reviewed control-model and loop evidence for the selected compensation and power network over an explicit operating envelope; do not relabel architecture prose as stability evidence.",
    },
    {
      targetPath: "/facts/mountedGeometry/boardArea",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: [footprintRef],
      blockingReason: "RRX0029B note 1 marks every parenthesized dimension as reference-only, and the page 53 example-layout extents are parenthesized and asymmetric. They do not establish manufacturer maximum mounted geometry under ADR-0006.",
      requiredResolution: "Provide exact-byte manufacturer evidence with non-reference, bounded maximum land-pattern extents on both axes, then independently review the ADR-0006 board-area projection.",
    },
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The manufacturer maximum package height is source-bound, but a facts-V2 maximum-height fact would still require independent review.",
    ),
  ];
}

function ltc3891EvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "adi-ltc3891-datasheet";
  const packageRef = ref(sourceId, "Order Information, LTC3891EFE#PBF 20-lead plastic TSSOP row, page 3; FE Package, 20-lead plastic TSSOP 4.4 mm, exposed pad variation CB, LTC drawing 05-08-1663 Rev. I, page 30");
  const footprintRef = ref(sourceId, "FE Package Recommended Solder Pad Layout: 6.60 mm +/- 0.10 mm pad-row span, nine 0.65 mm pitches, and 0.45 mm +/- 0.05 mm terminal-pad width, page 30");
  const heightRef = ref(sourceId, "FE Package side view, maximum package height 1.20 mm, page 30");
  const controlRefs = [
    ref(sourceId, "Description, constant-frequency current-mode architecture, page 1"),
    ref(sourceId, "Applications Information, OPTI-LOOP compensation and checking transient response for an application-specific network, pages 24-25"),
  ];
  const currentSenseRef = ref(sourceId, "Electrical Characteristics, VSENSE(MAX) production spreads for ILIM = 0 V, INTVCC, and FLOAT; defaults VIN = 12 V, VRUN = 5 V, EXTVCC = 0 V; VFB = 0.7 V and VSENSE- = 3.3 V; limits apply over the LTC3891E operating junction-temperature range, page 3");
  const currentSenseConditions = [
    quantityCondition("extvcc-voltage", null, 0, 0, "V", currentSenseRef),
    quantityCondition("feedback-voltage", null, 0.7, 0.7, "V", currentSenseRef),
    quantityCondition("input-voltage", "input-voltage", 12, 12, "V", currentSenseRef),
    quantityCondition("junction-temperature", "junction-temperature", 233.15, 398.15, "K", currentSenseRef),
    quantityCondition("run-voltage", null, 5, 5, "V", currentSenseRef),
    quantityCondition("sense-minus-voltage", null, 3.3, 3.3, "V", currentSenseRef),
  ];
  const gateDriveRef = ref(sourceId, "Electrical Characteristics, INTVCC Linear Regulator VINTVCCVIN and VINTVCCEXT 4.85 V / 5.1 V / 5.35 V production spreads; table defaults VRUN = 5 V and TA = 25 C, page 4");
  const vinLdoConditions = [
    quantityCondition("extvcc-voltage", null, 0, 0, "V", gateDriveRef),
    quantityCondition("input-voltage", "input-voltage", 6, 60, "V", gateDriveRef, true, true),
    quantityCondition("junction-temperature", "junction-temperature", 298.15, 298.15, "K", gateDriveRef),
    quantityCondition("run-voltage", null, 5, 5, "V", gateDriveRef),
  ];
  const extvccLdoConditions = [
    quantityCondition("extvcc-voltage", null, 6, 13, "V", gateDriveRef, true, true),
    quantityCondition("input-voltage", "input-voltage", 12, 12, "V", gateDriveRef),
    quantityCondition("junction-temperature", "junction-temperature", 298.15, 298.15, "K", gateDriveRef),
    quantityCondition("run-voltage", null, 5, 5, "V", gateDriveRef),
  ];
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "FE 20-lead plastic TSSOP (4.4 mm), exposed pad variation CB" },
      [packageRef],
      "The exact LTC3891EFE#PBF-to-FE package mapping is source-bound, but commonFacts.packageName remains pending independent review.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The datasheet identifies current-mode control and supplies application compensation guidance, but no configured power stage, compensation network, or bounded operating envelope is selected.",
      requiredResolution: "Provide independently reviewed control-model and loop evidence for a configured design over an explicit operating envelope.",
    },
    {
      targetPath: "/facts/currentSenseThresholdOptions",
      status: "blocked_unrepresentable_condition",
      candidate: {
        kind: "configured_production_spread_observations",
        options: [
          spreadObservation("ilim-ground", "ILIM = 0 V", 0.022, 0.03, 0.036, currentSenseConditions),
          spreadObservation("ilim-intvcc", "ILIM = INTVCC", 0.043, 0.05, 0.057, currentSenseConditions),
          spreadObservation("ilim-float", "ILIM = FLOAT", 0.064, 0.075, 0.085, currentSenseConditions),
        ],
      },
      sourceRefs: [currentSenseRef],
      blockingReason: "The three exact voltage-threshold spreads are source-bound, but VFB, VSENSE-, VRUN, and EXTVCC applicability conditions are not representable in the closed facts-V2 configured-option condition grammar. The selected RSENSE or inductor-DCR network remains an application choice that converts voltage threshold to current.",
      requiredResolution: "Represent every published applicability condition in the closed schema, select and independently review the application sensing network, then author options without converting voltage thresholds into universal current limits.",
    },
    {
      targetPath: "/facts/gateDriveVoltageOptions",
      status: "blocked_unrepresentable_condition",
      candidate: {
        kind: "configured_production_spread_observations",
        options: [
          spreadObservation("vin-ldo", "INTVCC supplied by VIN LDO", 4.85, 5.1, 5.35, vinLdoConditions),
          spreadObservation("extvcc-ldo", "INTVCC supplied by EXTVCC LDO", 4.85, 5.1, 5.35, extvccLdoConditions),
        ],
      },
      sourceRefs: [gateDriveRef],
      blockingReason: "The two exact INTVCC production-spread observations retain their distinct VIN-LDO and EXTVCC-LDO conditions. EXTVCC and RUN conditions are absent from the closed facts-V2 configured-option grammar, and the supply path remains application-configured.",
      requiredResolution: "Add closed condition parameters for the complete supply-path applicability, select the application supply path, and complete independent review before emitting gate-drive options.",
    },
    commonEntry(
      "/facts/mountedGeometry/boardArea",
      boardAreaCandidate([
        dimension("x", "solder-pad-row-span", 1, 6.70, footprintRef),
        dimension("y", "terminal-pad-width", 1, 0.50, footprintRef),
        dimension("y", "terminal-pitch", 9, 0.65, footprintRef),
      ]),
      [footprintRef],
      "The recommended solder-pad dimensions support a conservative 6.70 mm x 6.35 mm authored bounding calculation; the MPN-to-drawing mapping remains pending independent review.",
    ),
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1.20e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The drawing supplies a 1.20 mm maximum package height, but facts-V2 requires an independently reviewed maximum-height fact.",
    ),
  ];
}

function lm5145EvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "ti-lm5145-datasheet";
  const packageRef = ref(sourceId, "Figure 6-1, RGY Package 20-Pin VQFN With Wettable Flanks, page 4; Package Option Addendum, LM5145RGYR active-production VQFN (RGY), 20-pin row, page 67");
  const footprintRef = ref(sourceId, "Package drawing RGY0020B, Example Board Layout, 3.3 mm x 4.3 mm land-pattern bounding box, page 65");
  const heightRef = ref(sourceId, "Package Outline RGY0020B, VQFN 1 mm maximum height, page 64");
  const controlRefs = [
    ref(sourceId, "Section 8.3.8 Voltage-Mode Control, page 22"),
    ref(sourceId, "Section 9.1.5 Control Loop Compensation, application-specific compensation design, pages 31-36"),
  ];
  const currentSenseRefs = [
    ref(sourceId, "Section 7.5 Electrical Characteristics, OCP valley-current-limit ILIM source currents and comparator offset, page 9"),
    ref(sourceId, "Section 8.3.10 Current Sensing and Overcurrent Protection, external RILIM and selected RDS(on) or shunt determine the threshold, pages 23-24"),
  ];
  const gateDriveRef = ref(sourceId, "Section 7.5 Electrical Characteristics, VCC regulator VVCC 7.3 V / 7.5 V / 7.7 V at VSS/TRK = 0 V, 9 V <= VIN <= 75 V, and 0 mA < IVCC <= 20 mA; limits cover -40 C to 125 C, page 8");
  const gateConditions = [
    {
      parameterId: "input-voltage",
      factsV2ParameterId: "input-voltage",
      minimum: { value: 9, unit: "V" as const },
      maximum: { value: 75, unit: "V" as const },
      setting: null,
      minimumExclusive: false,
      maximumExclusive: false,
      sourceRefs: [gateDriveRef],
    },
    {
      parameterId: "junction-temperature",
      factsV2ParameterId: "junction-temperature",
      minimum: { value: 233.15, unit: "K" as const },
      maximum: { value: 398.15, unit: "K" as const },
      setting: null,
      minimumExclusive: false,
      maximumExclusive: false,
      sourceRefs: [gateDriveRef],
    },
    {
      parameterId: "ss-trk-voltage",
      factsV2ParameterId: null,
      minimum: { value: 0, unit: "V" as const },
      maximum: { value: 0, unit: "V" as const },
      setting: null,
      minimumExclusive: false,
      maximumExclusive: false,
      sourceRefs: [gateDriveRef],
    },
    {
      parameterId: "vcc-output-current",
      factsV2ParameterId: null,
      minimum: { value: 0, unit: "A" as const },
      maximum: { value: 0.02, unit: "A" as const },
      setting: null,
      minimumExclusive: true,
      maximumExclusive: false,
      sourceRefs: [gateDriveRef],
    },
  ];
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "VQFN (RGY), 20-pin, wettable flanks" },
      [packageRef],
      "The exact orderable part-to-package identity is source-bound, but commonFacts.packageName must be independently reviewed.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The datasheet identifies voltage-mode control and gives application design guidance, but no configured design or operating envelope is selected for a bounded control/stability claim.",
      requiredResolution: "Provide independently reviewed control-model evidence for a specific configured design and explicit operating envelope.",
    },
    {
      targetPath: "/facts/currentSenseThresholdOptions",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: currentSenseRefs,
      blockingReason: "LM5145 has no profile-intrinsic configured voltage-threshold options: external RILIM plus the selected low-side RDS(on) or shunt sets the application threshold. The published ILIM source-current spreads are in amperes, and the comparator offset includes non-positive values, so neither can be relabeled as a positive voltage production-spread option.",
      requiredResolution: "Select an independently reviewed sensing mode, sensor, and RILIM setting, then bind the resulting positive voltage spread and all required conditions without changing units or semantics.",
    },
    {
      targetPath: "/facts/gateDriveVoltageOptions",
      status: "blocked_unrepresentable_condition",
      candidate: {
        kind: "configured_production_spread_observation",
        settingId: "internal-vcc-regulator",
        setting: "internal-vcc-regulator",
        minimum: { value: 7.3, unit: "V" },
        typical: { value: 7.5, unit: "V" },
        maximum: { value: 7.7, unit: "V" },
        sourceRequiredConditionIds: [
          "input-voltage",
          "junction-temperature",
          "ss-trk-voltage",
          "vcc-output-current",
        ],
        factsV2RequiredConditionIds: ["input-voltage", "junction-temperature"],
        observedConditions: gateConditions,
      },
      sourceRefs: [gateDriveRef],
      blockingReason: "The exact internal-VCC production spread is source-bound, but its VSS/TRK = 0 V and 0 mA < IVCC <= 20 mA applicability conditions have no facts-V2 condition parameters. Omitting them would overstate the claim; external VCC bias is a separate application choice, not this production spread.",
      requiredResolution: "Add an approved closed-schema representation for gate-drive load and VSS/TRK conditions, or obtain a source claim whose complete applicability is expressible without dropping conditions; then complete independent review.",
    },
    commonEntry(
      "/facts/mountedGeometry/boardArea",
      boardAreaCandidate([
        dimension("x", "land-pattern-x-span", 1, 3.3, footprintRef),
        dimension("y", "land-pattern-y-span", 1, 4.3, footprintRef),
      ]),
      [footprintRef],
      "The manufacturer land-pattern bounding dimensions support an exact authored area calculation, but the MPN-to-drawing mapping remains pending independent review.",
    ),
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The manufacturer maximum package height is source-bound, but facts-V2 requires a reviewed maximum-height fact.",
    ),
  ];
}

function ltc3895EvidenceMap(): readonly UnboundEvidenceEntry[] {
  const sourceId = "adi-ltc3895-datasheet";
  const packageRef = ref(sourceId, "Order Information, LTC3895EFE#PBF 38-lead plastic TSSOP row, page 2; FE Package variation FE38 (31), 38-lead plastic TSSOP 4.4 mm, exposed pad variation AB, LTC drawing 05-08-1865 Rev. B, page 36");
  const footprintRef = ref(sourceId, "FE38 Recommended Solder Pad Layout: 6.60 mm +/- 0.10 mm pad-row span, eighteen 0.50 mm pitches, and 0.315 mm +/- 0.05 mm terminal-pad width, page 36");
  const heightRef = ref(sourceId, "FE38 Package side view, maximum package height 1.20 mm, page 36");
  const controlRefs = [
    ref(sourceId, "Description, constant-frequency current-mode architecture, page 1"),
    ref(sourceId, "Applications Information, OPTI-LOOP compensation and checking transient response for an application-specific network, pages 30-31"),
  ];
  const currentSenseRef = ref(sourceId, "Electrical Characteristics, VSENSE(MAX) production spreads for ILIM = FLOAT, 0 V, and INTVCC; defaults VIN = 12 V, VRUN = 5 V, VEXTVCC = 0 V, VDRVSET = 0 V, and VPRG = FLOAT; VFB = 0.7 V and VSENSE- = 3.3 V; limits apply over the LTC3895E operating junction-temperature range, page 3");
  const currentSenseConditions = [
    settingCondition("drvset-setting", "0 V", currentSenseRef),
    quantityCondition("extvcc-voltage", null, 0, 0, "V", currentSenseRef),
    quantityCondition("feedback-voltage", null, 0.7, 0.7, "V", currentSenseRef),
    quantityCondition("input-voltage", "input-voltage", 12, 12, "V", currentSenseRef),
    quantityCondition("junction-temperature", "junction-temperature", 233.15, 398.15, "K", currentSenseRef),
    quantityCondition("run-voltage", null, 5, 5, "V", currentSenseRef),
    quantityCondition("sense-minus-voltage", null, 3.3, 3.3, "V", currentSenseRef),
    settingCondition("vprg-state", "FLOAT", currentSenseRef),
  ];
  const gateDriveRef = ref(sourceId, "Electrical Characteristics, DRVCC LDO Regulator production spreads for NDRV, internal VIN-LDO, internal EXTVCC-LDO, and RDRVSET = 70 kohm configurations; table defaults VIN = 12 V, VRUN = 5 V, VEXTVCC = 0 V, VDRVSET = 0 V, VPRG = FLOAT, and TA = 25 C, page 4");
  function gateConditions(
    drvsetParameterId: string,
    drvsetSetting: string,
    extvccMinimum: number,
    extvccMaximum: number,
    extvccExclusive: boolean,
    supplyPath: string,
    inputMinimum: number,
    inputMaximum: number,
    inputExclusive: boolean,
  ): readonly FactsV2CandidateObservedCondition[] {
    return [
      settingCondition(drvsetParameterId, drvsetSetting, gateDriveRef),
      quantityCondition("extvcc-voltage", null, extvccMinimum, extvccMaximum, "V", gateDriveRef, extvccExclusive, extvccExclusive),
      settingCondition("gate-drive-supply-path", supplyPath, gateDriveRef),
      quantityCondition("input-voltage", "input-voltage", inputMinimum, inputMaximum, "V", gateDriveRef, inputExclusive, inputExclusive),
      quantityCondition("junction-temperature", "junction-temperature", 298.15, 298.15, "K", gateDriveRef),
      quantityCondition("run-voltage", null, 5, 5, "V", gateDriveRef),
      settingCondition("vprg-state", "FLOAT", gateDriveRef),
    ];
  }
  return [
    commonEntry(
      "/commonFacts/packageName",
      { kind: "text", value: "FE38 (31) 38-lead plastic TSSOP (4.4 mm), exposed pad variation AB" },
      [packageRef],
      "The exact LTC3895EFE#PBF-to-FE38 package mapping is source-bound, but commonFacts.packageName remains pending independent review.",
    ),
    {
      targetPath: "/facts/controlEvidenceBasis",
      status: "blocked_missing_profile_evidence",
      candidate: null,
      sourceRefs: controlRefs,
      blockingReason: "The datasheet identifies current-mode control and supplies application compensation guidance, but no configured power stage, compensation network, or bounded operating envelope is selected.",
      requiredResolution: "Provide independently reviewed control-model and loop evidence for a configured design over an explicit operating envelope.",
    },
    {
      targetPath: "/facts/currentSenseThresholdOptions",
      status: "blocked_unrepresentable_condition",
      candidate: {
        kind: "configured_production_spread_observations",
        options: [
          spreadObservation("ilim-float", "ILIM = FLOAT", 0.066, 0.075, 0.084, currentSenseConditions),
          spreadObservation("ilim-ground", "ILIM = 0 V", 0.043, 0.05, 0.057, currentSenseConditions),
          spreadObservation("ilim-intvcc", "ILIM = INTVCC", 0.09, 0.1, 0.109, currentSenseConditions),
        ],
      },
      sourceRefs: [currentSenseRef],
      blockingReason: "The three exact voltage-threshold spreads are source-bound, but VFB, VSENSE-, VRUN, EXTVCC, DRVSET, and VPRG applicability conditions are not representable in the closed facts-V2 configured-option grammar. The selected RSENSE or inductor-DCR network remains an application choice that converts voltage threshold to current.",
      requiredResolution: "Represent every published applicability condition in the closed schema, select and independently review the application sensing network, then author options without converting voltage thresholds into universal current limits.",
    },
    {
      targetPath: "/facts/gateDriveVoltageOptions",
      status: "blocked_unrepresentable_condition",
      candidate: {
        kind: "configured_production_spread_observations",
        options: [
          spreadObservation("ndrv-external-6v", "NDRV external NFET, DRVSET = 0 V", 5.8, 6, 6.2, gateConditions("drvset-setting", "0 V", 0, 0, false, "NDRV driving external NFET", 7, 150, true)),
          spreadObservation("ndrv-external-10v", "NDRV external NFET, DRVSET = INTVCC", 9.6, 10, 10.4, gateConditions("drvset-setting", "INTVCC", 0, 0, false, "NDRV driving external NFET", 11, 150, true)),
          spreadObservation("internal-vin-ldo-6v", "Internal VIN LDO, DRVSET = 0 V", 5.6, 5.85, 6.1, gateConditions("drvset-setting", "0 V", 0, 0, false, "NDRV = DRVCC; internal VIN LDO", 7, 150, true)),
          spreadObservation("internal-vin-ldo-10v", "Internal VIN LDO, DRVSET = INTVCC", 9.5, 9.85, 10.3, gateConditions("drvset-setting", "INTVCC", 0, 0, false, "NDRV = DRVCC; internal VIN LDO", 11, 150, true)),
          spreadObservation("internal-extvcc-ldo-6v", "Internal EXTVCC LDO, DRVSET = 0 V", 5.8, 6, 6.2, gateConditions("drvset-setting", "0 V", 7, 13, true, "internal EXTVCC LDO", 12, 12, false)),
          spreadObservation("internal-extvcc-ldo-10v", "Internal EXTVCC LDO, DRVSET = INTVCC", 9.6, 10, 10.4, gateConditions("drvset-setting", "INTVCC", 11, 13, true, "internal EXTVCC LDO", 12, 12, false)),
          spreadObservation("programmable-70kohm", "NDRV external NFET, RDRVSET = 70 kohm", 6.4, 7, 7.6, gateConditions("drvset-resistance", "70 kohm", 0, 0, false, "NDRV driving external NFET", 12, 12, false)),
        ],
      },
      sourceRefs: [gateDriveRef],
      blockingReason: "The exact DRVCC observations preserve supply-path, DRVSET or RDRVSET, EXTVCC, VIN, RUN, VPRG, and temperature applicability. Several required conditions and the application-selected NDRV/EXTVCC topology are absent from the closed facts-V2 grammar; the 50 kohm and 90 kohm programmable rows provide typical values only and are not promoted to production spreads.",
      requiredResolution: "Add closed representations for every applicability and topology condition, select the application gate-drive supply path and setting, and complete independent review before emitting configured gate-drive options.",
    },
    commonEntry(
      "/facts/mountedGeometry/boardArea",
      boardAreaCandidate([
        dimension("x", "solder-pad-row-span", 1, 6.70, footprintRef),
        dimension("y", "terminal-pad-width", 1, 0.365, footprintRef),
        dimension("y", "terminal-pitch", 18, 0.50, footprintRef),
      ]),
      [footprintRef],
      "The recommended solder-pad dimensions support a conservative 6.70 mm x 9.365 mm authored bounding calculation; the MPN-to-drawing mapping remains pending independent review.",
    ),
    commonEntry(
      "/facts/mountedGeometry/maximumHeight",
      {
        kind: "maximum_height",
        height: { value: 1.20e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      [heightRef],
      "The drawing supplies a 1.20 mm maximum package height, but facts-V2 requires an independently reviewed maximum-height fact.",
    ),
  ];
}

const EVIDENCE_MAP_BUILDERS: Readonly<Record<CandidateProfileId, () => readonly UnboundEvidenceEntry[]>> = {
  "real.analog-devices.lt8640siv-pbf": lt8640sEvidenceMap,
  "real.analog-devices.ltc3891efe-pbf": ltc3891EvidenceMap,
  "real.analog-devices.ltc3895efe-pbf": ltc3895EvidenceMap,
  "real.onsemi.ncp1599mntwg": ncp1599EvidenceMap,
  "real.texas-instruments.lm5145rgyr": lm5145EvidenceMap,
  "real.texas-instruments.lm70880rrxr": lm70880EvidenceMap,
  "real.texas-instruments.tps54302ddcr": tps54302EvidenceMap,
};

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function assertCandidateProfileIdentity(profile: RealPrimaryPartProfile, profileId: CandidateProfileId): void {
  const expected = EXPECTED_PROFILE_IDENTITY[profileId];
  if (
    profile.partClass !== expected.partClass
    || profile.identity.part.manufacturerId !== expected.manufacturerId
    || profile.identity.part.manufacturerPartNumber !== expected.manufacturerPartNumber
  ) {
    throw new Error(`Candidate evidence identity mismatch for ${profileId}`);
  }
}

function bindExactByteEvidence(
  profile: RealPrimaryPartProfile,
  refs: readonly SourceLocator[],
): FactsV2MandatoryEvidenceEntry["exactByteEvidence"] {
  const sources = new Map(profile.sources.map((source) => [source.sourceId, source]));
  const uniqueRefs = [...new Map(refs.map((sourceRef) => [`${sourceRef.sourceId}\u0000${sourceRef.locator}`, sourceRef])).values()]
    .sort((left, right) => compareAscii(left.sourceId, right.sourceId) || compareAscii(left.locator, right.locator));
  if (uniqueRefs.length === 0) throw new Error(`Mandatory evidence entry for ${profile.profileId} has no source locator`);
  return uniqueRefs.map((sourceRef) => {
    const source = sources.get(sourceRef.sourceId);
    if (source === undefined) throw new Error(`Missing source ${sourceRef.sourceId} for ${profile.profileId}`);
    const expectedHash = EXPECTED_EXACT_SOURCE_HASHES[sourceRef.sourceId];
    const expectedUrl = EXPECTED_EXACT_SOURCE_URLS[sourceRef.sourceId];
    if (
      expectedUrl === undefined
      || source.url !== expectedUrl
      || source.sourceType !== "manufacturer_datasheet"
      || source.manufacturerId !== profile.identity.part.manufacturerId
    ) {
      throw new Error(`Exact-byte source identity mismatch for ${sourceRef.sourceId}`);
    }
    if (
      expectedHash === undefined
      || source.contentHash.state !== "verified"
      || source.contentHash.value !== expectedHash
    ) {
      throw new Error(`Exact-byte source hash mismatch for ${sourceRef.sourceId}`);
    }
    return {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      contentHash: source.contentHash.value,
      url: source.url,
      locator: sourceRef.locator,
    };
  });
}

function bindProfileExactByteEvidence(
  profile: RealPrimaryPartProfile,
  refs: readonly SourceLocator[],
): FactsV2MandatoryEvidenceEntry["exactByteEvidence"] {
  const sources = new Map(profile.sources.map((source) => [source.sourceId, source]));
  return [...new Map(refs.map((sourceRef) => [`${sourceRef.sourceId}\u0000${sourceRef.locator}`, sourceRef])).values()]
    .sort((left, right) => compareAscii(left.sourceId, right.sourceId) || compareAscii(left.locator, right.locator))
    .map((sourceRef) => {
      const source = sources.get(sourceRef.sourceId);
      if (source === undefined) throw new Error(`Missing source ${sourceRef.sourceId} for ${profile.profileId}`);
      if (source.contentHash.state !== "verified") {
        throw new Error(`Unverified blocker source ${sourceRef.sourceId} for ${profile.profileId}`);
      }
      return {
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        contentHash: source.contentHash.value,
        url: source.url,
        locator: sourceRef.locator,
      };
    });
}

function claimRequiredResolution(code: FactsV2DraftAuthoringBlocker["code"]): string {
  switch (code) {
    case "blocked_missing_source_fact":
      return "Obtain exact primary-source evidence for the required claim semantics and bind its complete applicability before authoring.";
    case "blocked_semantic_mismatch":
      return "Obtain an exact source fact matching the facts-V2 claim kind, basis, unit, and bound direction; do not relabel the existing observation.";
    case "blocked_unverified_source_bytes":
      return "Capture and verify the exact official source bytes before authoring the claim.";
    case "blocked_unrepresentable_condition":
      return "Extend the closed facts-V2 condition grammar for every source-stated applicability condition; do not discard or generalize an unrepresentable condition.";
    case "needs_condition_authoring_and_independent_review":
      return "Author every required applicability condition from exact primary-source evidence, then leave the resulting claim pending independent review.";
    case "blocked_missing_profile_evidence":
      throw new Error(`Mandatory-evidence code ${code} cannot be used as a scalar-claim blocker`);
  }
}

function deriveDraftAuthoringBlockers(
  profile: RealPrimaryPartProfile,
  gap: RealCatalogFactsV2ReadinessReport["profileGaps"][number],
  mandatoryEvidenceMap: readonly FactsV2MandatoryEvidenceEntry[],
): readonly FactsV2DraftAuthoringBlocker[] {
  const candidates = new Map(gap.claimCandidates.map((candidate) => [candidate.targetPath, candidate]));
  const groups = CLAIM_GROUPS[profile.partClass].map((fields) => {
    const groupMemberPaths = fields.map((field) => `/facts/${field}`).sort(compareAscii);
    const members = groupMemberPaths.map((path) => candidates.get(path as `/facts/${string}`));
    if (members.some((candidate) => candidate === undefined)) {
      throw new Error(`Facts-V2 claim-group membership mismatch for ${profile.profileId}`);
    }
    const groupPath = groupMemberPaths.length === 1
      ? groupMemberPaths[0]!
      : `/facts/${fields[0]!.replace(/(?:Minimum|Typical|Maximum|Recommended)$/, "")}`;
    return { groupPath, groupMemberPaths, members: members as FactsV2ClaimCandidate[] };
  });
  const coveredPaths = groups.flatMap((group) => group.groupMemberPaths).sort(compareAscii);
  const candidatePaths = [...candidates.keys()].sort(compareAscii);
  if (
    coveredPaths.length !== candidatePaths.length
    || coveredPaths.some((path, index) => path !== candidatePaths[index])
    || new Set(coveredPaths).size !== coveredPaths.length
  ) {
    throw new Error(`Facts-V2 claim groups must cover every candidate exactly once for ${profile.profileId}`);
  }
  const claimBlockers = groups.flatMap(({ groupPath, groupMemberPaths, members }) =>
    members.flatMap((candidate): FactsV2DraftAuthoringBlocker[] => {
      if (candidate.status === "needs_independent_review") return [];
      return [{
        targetPath: candidate.targetPath,
        groupPath,
        groupMemberPaths,
        source: "claim_candidate",
        code: candidate.status,
        reason: candidate.reason,
        requiredResolution: claimRequiredResolution(candidate.status),
        exactByteEvidence: candidate.sourceCandidate === null
          ? []
          : bindProfileExactByteEvidence(profile, candidate.sourceCandidate.sourceRefs),
      }];
    })
  );
  const mandatoryBlockers = mandatoryEvidenceMap
    .flatMap((entry): FactsV2DraftAuthoringBlocker[] => {
      if (entry.status === "source_bound_pending_independent_review") return [];
      return [{
        targetPath: entry.targetPath,
        groupPath: entry.targetPath,
        groupMemberPaths: [entry.targetPath],
        source: "mandatory_evidence",
        code: entry.status,
        reason: entry.blockingReason,
        requiredResolution: entry.requiredResolution,
        exactByteEvidence: entry.exactByteEvidence,
      }];
    });
  return [...claimBlockers, ...mandatoryBlockers].sort((left, right) =>
    compareAscii(left.targetPath, right.targetPath)
    || compareAscii(left.source, right.source)
    || compareAscii(left.code, right.code)
  );
}

function evidenceMap(profile: RealPrimaryPartProfile): readonly FactsV2MandatoryEvidenceEntry[] {
  const profileId = profile.profileId as CandidateProfileId;
  const build = EVIDENCE_MAP_BUILDERS[profileId];
  if (build === undefined) throw new Error(`No exact-byte candidate evidence map for ${profile.profileId}`);
  assertCandidateProfileIdentity(profile, profileId);
  const result = build().map(({ sourceRefs, ...entry }) => ({
    ...entry,
    exactByteEvidence: bindExactByteEvidence(profile, sourceRefs),
  })).sort((left, right) => compareAscii(left.targetPath, right.targetPath));
  const paths = result.map((entry) => entry.targetPath);
  const expectedPaths = [...SCHEMA_DRAFT_BLOCKERS[profile.partClass]].sort(compareAscii);
  if (paths.length !== expectedPaths.length || paths.some((path, index) => path !== expectedPaths[index])) {
    throw new Error(`Mandatory evidence map path mismatch for ${profile.profileId}`);
  }
  return result;
}

function evidenceRefs(
  profile: RealPrimaryPartProfile,
  refs: readonly SourceLocator[],
): ProfileEvidenceRef[] {
  const sources = new Map(profile.sources.map((source) => [source.sourceId, source]));
  return bindExactByteEvidence(profile, refs).map((binding) => {
    const source = sources.get(binding.sourceId);
    if (source === undefined || source.revision === null) {
      throw new Error(`Published draft evidence requires a source revision for ${binding.sourceId}`);
    }
    return {
      sourceId: binding.sourceId,
      locator: binding.locator,
      retrievedAt: source.retrievedAt,
      contentHash: binding.contentHash,
      licenseNote: source.licenseNote,
      kind: binding.sourceType,
      url: binding.url,
      revision: source.revision,
      publicationBasis: "public_facts",
    };
  });
}

function draftQuantity(value: number, unit: "V" | "A" | "K" | "s" | "ohm") {
  return { value, unit, displayUnit: unit };
}

function draftCondition(
  profile: RealPrimaryPartProfile,
  condition: FactsV2CandidateObservedCondition,
): ProfileConditionV2 {
  if (condition.factsV2ParameterId === null || condition.factsV2ParameterId !== condition.parameterId) {
    throw new Error(`Cannot author unrepresentable condition ${condition.parameterId}`);
  }
  const evidence = evidenceRefs(profile, condition.sourceRefs);
  if (condition.setting !== null) {
    return {
      parameterId: condition.parameterId,
      kind: "token_equals",
      value: condition.setting,
      evidence,
    };
  }
  return {
    parameterId: condition.parameterId,
    kind: "quantity_range",
    minimum: condition.minimum === null
      ? null
      : draftQuantity(condition.minimum.value, condition.minimum.unit),
    maximum: condition.maximum === null
      ? null
      : draftQuantity(condition.maximum.value, condition.maximum.unit),
    evidence,
  };
}

function unknownClaim(
  spec: (typeof POWER_INTEGRATED_CLAIM_SPECS_V2)[keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2],
  explanation: string,
): ProfileQuantityClaimV2<typeof spec.unit> {
  return {
    claimKind: spec.claimKind,
    basis: spec.basis,
    value: null,
    state: "unknown",
    evidence: [],
    validFor: [],
    explanation,
  };
}

function authoredClaim(
  profile: RealPrimaryPartProfile,
  candidate: FactsV2ClaimCandidate,
): ProfileQuantityClaimV2<typeof candidate.targetUnit> {
  const source = candidate.sourceCandidate;
  if (candidate.status !== "needs_independent_review" || source === null || source.value === null) {
    throw new Error(`NCP1599 partial draft claim is not fully source-bound: ${candidate.targetPath}`);
  }
  const refs = [
    ...source.sourceRefs,
    ...source.observedConditions.flatMap((condition) => condition.sourceRefs),
  ];
  return {
    claimKind: candidate.claimKind,
    basis: candidate.basis,
    value: {
      value: source.value,
      unit: candidate.targetUnit,
      displayUnit: candidate.targetUnit,
    },
    state: "estimated",
    evidence: evidenceRefs(profile, refs),
    validFor: source.observedConditions.map((condition) => draftCondition(profile, condition)),
    explanation: "Exact-byte primary-source extraction with complete source applicability; authored only and pending independent review.",
  };
}

function unknownFact<Value>(explanation: string): ProfileFact<Value> {
  return { value: null, state: "unknown", evidence: [], validFor: [], explanation };
}

function collectUnknownPaths(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  if (object.state === "unknown") return [path];
  return Object.entries(object).flatMap(([key, child]) =>
    collectUnknownPaths(child, `${path}/${key}`)
  ).sort(compareAscii);
}

function assertExactPaths(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    throw new Error(`${label} path membership mismatch`);
  }
}

function buildNcp1599PartialDraft(
  profile: RealPrimaryPartProfile,
  gap: RealCatalogFactsV2ReadinessReport["profileGaps"][number],
  mandatoryEvidenceMap: readonly FactsV2MandatoryEvidenceEntry[],
): FactsV2PartialNonAdmittedDraft {
  if (
    profile.profileId !== "real.onsemi.ncp1599mntwg"
    || profile.partClass !== "power.integrated-synchronous-buck-regulator"
  ) throw new Error("Partial facts-V2 draft is scoped only to exact NCP1599MNTWG evidence");
  assertCandidateProfileIdentity(profile, "real.onsemi.ncp1599mntwg");
  const candidates = new Map(gap.claimCandidates.map((candidate) => [candidate.targetPath, candidate]));
  const knownClaims = new Set<string>(NCP1599_PARTIAL_KNOWN_CLAIM_PATHS);
  const facts = Object.fromEntries(Object.entries(POWER_INTEGRATED_CLAIM_SPECS_V2).map(([field, spec]) => {
    const path = `/facts/${field}`;
    const candidate = candidates.get(path as `/facts/${string}`);
    if (knownClaims.has(path)) {
      if (candidate === undefined) throw new Error(`Missing NCP1599 source candidate ${path}`);
      return [field, authoredClaim(profile, candidate)];
    }
    const reason = candidate?.reason
      ?? "The exact source extraction does not establish this optional facts-V2 claim with complete applicability.";
    return [field, unknownClaim(spec, `Explicit non-admitted unknown: ${reason}`)];
  })) as unknown as Omit<PowerIntegratedSynchronousBuckFactsV2, "controlEvidenceBasis" | "mountedGeometry">;

  const mandatory = new Map(mandatoryEvidenceMap.map((entry) => [entry.targetPath, entry]));
  const packageEntry = mandatory.get("/commonFacts/packageName");
  const areaEntry = mandatory.get("/facts/mountedGeometry/boardArea");
  const heightEntry = mandatory.get("/facts/mountedGeometry/maximumHeight");
  if (
    packageEntry?.candidate?.kind !== "text"
    || areaEntry?.candidate?.kind !== "board_area_projection"
    || heightEntry?.candidate?.kind !== "maximum_height"
  ) throw new Error("NCP1599 partial draft requires exact package and geometry candidates");

  const sourceRefsFromBinding = (entry: FactsV2MandatoryEvidenceEntry): SourceLocator[] =>
    entry.exactByteEvidence.map((binding) => ({ sourceId: binding.sourceId, locator: binding.locator }));
  const packageEvidence = evidenceRefs(profile, sourceRefsFromBinding(packageEntry));
  const sourceDimensions = areaEntry.candidate.sourceDimensions.map((term) => ({
    axis: term.axis,
    dimensionId: term.dimensionId,
    multiplier: term.multiplier,
    maximum: { ...term.maximum, displayUnit: term.maximum.displayUnit },
    evidence: evidenceRefs(profile, term.sourceRefs),
  }));
  const boardEvidence = sourceDimensions.flatMap((term) => term.evidence)
    .sort((left, right) => compareAscii(canonicalJson(left), canonicalJson(right)))
    .filter((entry, index, all) => index === 0 || canonicalJson(entry) !== canonicalJson(all[index - 1]));
  const heightEvidence = evidenceRefs(profile, sourceRefsFromBinding(heightEntry));
  const draft = {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass: profile.partClass,
    part: { ...profile.identity.part },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: {
        value: packageEntry.candidate.value,
        state: "estimated",
        evidence: packageEvidence,
        validFor: [],
        explanation: "Exact-byte MPN-to-package extraction; authored only and pending independent review.",
      },
      boardArea: unknownFact("Facts-V2 mounted geometry replaces the legacy scalar board-area field."),
      maximumHeight: unknownFact("Facts-V2 mounted geometry replaces the legacy scalar maximum-height field."),
    },
    facts: {
      ...facts,
      controlEvidenceBasis: unknownFact("No bounded configured control or loop-stability evidence has been independently reviewed."),
      mountedGeometry: {
        boardArea: {
          value: {
            area: { ...areaEntry.candidate.area, displayUnit: areaEntry.candidate.area.displayUnit },
            basis: areaEntry.candidate.basis,
            calculation: areaEntry.candidate.calculation,
            sourceDimensions,
          },
          state: "calculated",
          evidence: boardEvidence,
          validFor: [],
          explanation: "Canonical land-pattern bounding-box calculation from exact-byte manufacturer dimensions; profile review remains pending.",
        },
        maximumHeight: {
          value: {
            height: { ...heightEntry.candidate.height, displayUnit: heightEntry.candidate.height.displayUnit },
            basis: heightEntry.candidate.basis,
          },
          state: "reviewed",
          evidence: heightEvidence,
          validFor: [],
          explanation: "Exact manufacturer package maximum retained for schema-valid geometry; profile-level independent review and admission remain pending.",
        },
      },
    },
  } as unknown as FactsV2PartialNonAdmittedDraft;
  const registry = getBundledDesignLibraryDocuments().manufacturerRegistry as ManufacturerRegistryV1;
  const issues = validateDesignProfileEnvelope(draft, registry);
  if (issues.length > 0) {
    const first = issues[0]!;
    throw new Error(`NCP1599 partial facts-V2 draft is invalid at ${first.path} [${first.code}]: ${first.message}`);
  }
  if (validateProfileAdmissionRulesV2(draft).length === 0) {
    throw new Error("NCP1599 partial facts-V2 draft must remain ineligible for admission");
  }
  const unknownPaths = collectUnknownPaths(draft);
  assertExactPaths(unknownPaths, NCP1599_PARTIAL_UNKNOWN_PATHS, "NCP1599 partial unknown");
  const authoredClaimPaths = Object.entries(draft.facts)
    .filter(([field, fact]) => field in POWER_INTEGRATED_CLAIM_SPECS_V2 && (fact as { state?: string }).state !== "unknown")
    .map(([field]) => `/facts/${field}`)
    .sort(compareAscii);
  assertExactPaths(authoredClaimPaths, NCP1599_PARTIAL_KNOWN_CLAIM_PATHS, "NCP1599 partial authored claim");
  return draft;
}

function assertPartialPlanIntegrity(plan: FactsV2CandidateProfilePlan): void {
  if (plan.status === "needs_evidence") {
    if (plan.draft !== null || plan.draftContentHash !== null || plan.draftUnknownPaths.length !== 0) {
      throw new Error(`Non-partial plan unexpectedly carries a draft: ${plan.sourceProfileId}`);
    }
    return;
  }
  if (plan.sourceProfileId !== "real.onsemi.ncp1599mntwg" || plan.draft === null || plan.draftContentHash === null) {
    throw new Error("partial_non_admitted is restricted to the exact NCP1599 plan");
  }
  if (designProfileEnvelopeContentHash(plan.draft) !== plan.draftContentHash) {
    throw new Error("NCP1599 partial draft content hash mismatch");
  }
  assertExactPaths(collectUnknownPaths(plan.draft), plan.draftUnknownPaths, "NCP1599 plan unknown");
  assertExactPaths(plan.draftUnknownPaths, NCP1599_PARTIAL_UNKNOWN_PATHS, "NCP1599 contract unknown");
}

/**
 * Plans only: ADR-0006 requires draft:null while structurally mandatory facts
 * remain unreviewed or cannot be represented. Exact-byte candidates below are
 * authoring aids; they never relabel authored mappings as independent review.
 */
export function buildRealCatalogFactsV2CandidateProfilePlans(
  catalog: RealPrimaryPartCatalog = REAL_PRIMARY_PART_CATALOG,
  readiness: RealCatalogFactsV2ReadinessReport = REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT,
): readonly FactsV2CandidateProfilePlan[] {
  const rebuiltReadiness = buildRealCatalogFactsV2ReadinessReport(catalog);
  if (canonicalJson(rebuiltReadiness) !== canonicalJson(readiness)) {
    throw new Error("Candidate readiness mismatch: rebuild exact source mappings before authoring");
  }
  const profiles = new Map(catalog.profiles.map((profile) => [profile.profileId, profile]));
  const plans = readiness.profileGaps
    .filter((gap) => gap.sourceHashComplete && Object.hasOwn(EVIDENCE_MAP_BUILDERS, gap.profileId))
    .map((gap): FactsV2CandidateProfilePlan => {
      const profile = profiles.get(gap.profileId);
      if (profile === undefined) throw new Error(`Missing staged profile ${gap.profileId}`);
      const sourceBoundClaimCount = gap.claimCandidates.filter((candidate) => (
        candidate.status === "needs_independent_review"
        || candidate.status === "needs_condition_authoring_and_independent_review"
        || candidate.status === "blocked_unrepresentable_condition"
      )).length;
      const mandatoryEvidenceMap = evidenceMap(profile);
      const draftAuthoringBlockers = deriveDraftAuthoringBlockers(profile, gap, mandatoryEvidenceMap);
      const partialDraft = gap.profileId === "real.onsemi.ncp1599mntwg"
        ? buildNcp1599PartialDraft(profile, gap, mandatoryEvidenceMap)
        : null;
      const draftUnknownPaths = partialDraft === null ? [] : collectUnknownPaths(partialDraft);
      return {
        sourceProfileId: gap.profileId,
        partClass: gap.partClass,
        part: { ...profile.identity.part },
        targetFactsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
        status: partialDraft === null ? "needs_evidence" : "partial_non_admitted",
        sourceHashComplete: true,
        sourceBoundClaimCount,
        sourceBoundMandatoryEvidenceCount: mandatoryEvidenceMap.filter((entry) => entry.status === "source_bound_pending_independent_review").length,
        schemaDraftBlockingPaths: mandatoryEvidenceMap.map((entry) => entry.targetPath),
        mandatoryEvidenceMap,
        draftAuthorable: false,
        draftAuthoringBlockerCount: draftAuthoringBlockers.length,
        draftAuthoringBlockers,
        admissionUnresolvedPaths: [...gap.unresolvedPaths],
        draftUnknownPaths,
        draftContentHash: partialDraft === null ? null : designProfileEnvelopeContentHash(partialDraft),
        independentReviewState: "pending",
        admissionState: "isolated_not_admitted",
        draft: partialDraft,
      };
    })
    .sort((left, right) => compareAscii(left.sourceProfileId, right.sourceProfileId));
  plans.forEach(assertPartialPlanIntegrity);
  return deepFreeze(plans) as readonly FactsV2CandidateProfilePlan[];
}

export const REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS = buildRealCatalogFactsV2CandidateProfilePlans();

const DRAFT_SELECTION_POLICY = "fewest_draft_blockers_then_most_source_bound_claims_then_most_source_bound_mandatory_facts_then_most_candidate_values_then_ascii_profile_id" as const;

/**
 * Selects the strongest current plan without converting that selection into a
 * draft. If evidence ever closes every authoring blocker, this audit throws so
 * the profile must be deliberately authored rather than silently left null.
 */
export function buildRealCatalogFactsV2DraftAuthoringAssessment(
  plans: readonly FactsV2CandidateProfilePlan[] = REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS,
  readiness: RealCatalogFactsV2ReadinessReport = REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT,
): FactsV2DraftAuthoringAssessment {
  plans.forEach(assertPartialPlanIntegrity);
  const gaps = new Map(readiness.profileGaps.map((gap) => [gap.profileId, gap]));
  const ranked = [...plans].sort((left, right) => {
    const leftGap = gaps.get(left.sourceProfileId);
    const rightGap = gaps.get(right.sourceProfileId);
    if (leftGap === undefined || rightGap === undefined) throw new Error("Candidate plan/readiness identity mismatch");
    return left.draftAuthoringBlockerCount - right.draftAuthoringBlockerCount
      || right.sourceBoundClaimCount - left.sourceBoundClaimCount
      || right.sourceBoundMandatoryEvidenceCount - left.sourceBoundMandatoryEvidenceCount
      || rightGap.candidateValueCount - leftGap.candidateValueCount
      || compareAscii(left.sourceProfileId, right.sourceProfileId);
  });
  const evaluatedProfileIds = [...plans.map((plan) => plan.sourceProfileId)].sort(compareAscii);
  if (new Set(evaluatedProfileIds).size !== evaluatedProfileIds.length || evaluatedProfileIds.length !== readiness.profileGaps.length) {
    throw new Error("Draft authoring assessment must cover every readiness profile exactly once");
  }
  const authorableProfileIds = ranked
    .filter((plan) => plan.draftAuthoringBlockerCount === 0)
    .map((plan) => plan.sourceProfileId);
  if (authorableProfileIds.length > 0) {
    throw new Error(`Facts-V2 draft is authorable and must not remain null: ${authorableProfileIds.join(",")}`);
  }
  const selected = ranked[0];
  if (selected === undefined) throw new Error("No exact-byte candidate plans are available for authoring assessment");
  const selectedGap = gaps.get(selected.sourceProfileId);
  if (selectedGap === undefined) throw new Error(`Missing readiness gap for ${selected.sourceProfileId}`);
  const decision = selected.draft === null ? "no_honest_draft" : "partial_non_admitted_draft";
  return deepFreeze({
    evaluatedProfileIds,
    selectionPolicy: DRAFT_SELECTION_POLICY,
    selectedProfileId: selected.sourceProfileId,
    selectedScore: {
      draftAuthoringBlockerCount: selected.draftAuthoringBlockerCount,
      sourceBoundClaimCount: selected.sourceBoundClaimCount,
      sourceBoundMandatoryEvidenceCount: selected.sourceBoundMandatoryEvidenceCount,
      candidateValueCount: selectedGap.candidateValueCount,
    },
    authorableProfileCount: 0 as const,
    authorableProfileIds,
    decision,
    independentReviewState: "pending" as const,
    admissionState: "isolated_not_admitted" as const,
    selectedProfileBlockers: selected.draftAuthoringBlockers,
    draftUnknownPaths: selected.draftUnknownPaths,
    draftContentHash: selected.draftContentHash,
    draft: selected.draft,
  }) as FactsV2DraftAuthoringAssessment;
}

export const REAL_PRIMARY_PART_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT =
  buildRealCatalogFactsV2DraftAuthoringAssessment();
