import type {
  NumericFact,
  NumericUnit,
  PrimarySource,
  RealManufacturerIdentity,
  RealPrimaryPartCatalog,
  RealPrimaryPartProfile,
  SourceLocator,
  TextFact,
  UnknownTextFact,
} from "./types";

const RETRIEVED_AT = "2026-08-23T21:00:00+10:00";
const VERIFIED_RETRIEVED_AT = "2026-08-24T02:16:17+10:00";
const TPS54302_PRODUCT_RETRIEVED_AT = "2026-08-24T11:13:12+10:00";
const LM5145_PRODUCT_RETRIEVED_AT = "2026-08-24T11:13:38+10:00";
const LM70880_RETRIEVED_AT = "2026-08-25T20:56:38Z";
const ADI_VERIFIED_RETRIEVED_AT = "2026-08-24T03:45:21.324Z";
const LICENSE_NOTE =
  "Manufacturer-published reference material used for factual extraction; only the URL and locators are retained. No PDF or model is redistributed.";
const MISSING_CONTENT_HASH_REASON =
  "The exact retrieved source bytes were not retained, so an exact SHA-256 cannot be computed or claimed.";

function source(
  sourceId: string,
  manufacturerId: string,
  sourceType: PrimarySource["sourceType"],
  title: string,
  url: string,
  documentId: string | null,
  revision: string | null,
  publicationDate: string | null,
  verifiedContentHash?: `sha256:${string}`,
  verifiedRetrievedAt: string = VERIFIED_RETRIEVED_AT,
): PrimarySource {
  return {
    sourceId,
    manufacturerId,
    sourceType,
    title,
    url,
    documentId,
    revision,
    publicationDate,
    retrievedAt: verifiedContentHash === undefined ? RETRIEVED_AT : verifiedRetrievedAt,
    contentHash: verifiedContentHash === undefined
      ? { state: "missing", value: null, reason: MISSING_CONTENT_HASH_REASON }
      : { state: "verified", value: verifiedContentHash, reason: null },
    retrievalMethod: "official_manufacturer_https",
    publicationRights: "link_and_factual_extract_only",
    licenseNote: LICENSE_NOTE,
  };
}

function ref(sourceId: string, locator: string): SourceLocator {
  return { sourceId, locator };
}

function knownNumeric(
  unit: NumericUnit,
  minimum: number | null,
  typical: number | null,
  maximum: number | null,
  sourceRefs: readonly SourceLocator[],
  qualification: string | null = null,
): NumericFact {
  return { state: "primary_source", minimum, typical, maximum, unit, qualification, sourceRefs };
}

function unknownNumeric(unit: NumericUnit, reason: string): NumericFact {
  return { state: "unknown", minimum: null, typical: null, maximum: null, unit, reason, sourceRefs: [] };
}

function knownText<T extends string>(
  value: T,
  sourceRefs: readonly SourceLocator[],
  qualification: string | null = null,
): TextFact<T> {
  return { state: "primary_source", value, qualification, sourceRefs };
}

function unknownText(reason: string): UnknownTextFact {
  return { state: "unknown", value: null, reason, sourceRefs: [] };
}

function unknownLoopFacts() {
  const reason =
    "No application-specific loop crossover or phase-margin evidence is present for a selected power stage and compensation network; this profile cannot produce a stability pass.";
  return {
    loopCrossoverFrequency: unknownNumeric("Hz", reason),
    phaseMargin: unknownNumeric("degree", reason),
    stabilityAssessment: unknownText(reason),
  } as const;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

const manufacturers: RealManufacturerIdentity[] = [
  {
    manufacturerId: "analog-devices",
    displayName: "Analog Devices",
    officialDomains: ["www.analog.com"],
  },
  {
    manufacturerId: "onsemi",
    displayName: "onsemi",
    officialDomains: ["www.onsemi.com"],
  },
  {
    manufacturerId: "texas-instruments",
    displayName: "Texas Instruments",
    officialDomains: ["www.ti.com"],
  },
];

const tps54302Part = source(
  "ti-tps54302ddcr-product",
  "texas-instruments",
  "manufacturer_product_page",
  "TPS54302DDCR part details",
  "https://www.ti.com/product/TPS54302",
  null,
  null,
  null,
  "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0",
  TPS54302_PRODUCT_RETRIEVED_AT,
);
const tps54302Product = source(
  "ti-tps54302-product",
  "texas-instruments",
  "manufacturer_product_page",
  "TPS54302 product information",
  "https://www.ti.com/product/TPS54302",
  null,
  null,
  null,
  "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0",
  TPS54302_PRODUCT_RETRIEVED_AT,
);
const tps54302Datasheet = source(
  "ti-tps54302-datasheet",
  "texas-instruments",
  "manufacturer_datasheet",
  "TPS54302 4.5V to 28V Input, 3A Output, EMI-Friendly Synchronous Step-Down Converter",
  "https://www.ti.com/lit/ds/symlink/tps54302.pdf",
  "SLVSDG6C",
  "Rev. C",
  "March 2026",
  "sha256:1632b388d1ba3a46c8e8f090ddfec2114c0f538cfb8364ddcda583fee3fdbdc5",
);

const lm70880Datasheet = source(
  "ti-lm70880-datasheet",
  "texas-instruments",
  "manufacturer_datasheet",
  "LM708x0 80V, 8A/6A/4A, High-Efficiency Buck Converters Designed for High Power Density",
  "https://www.ti.com/lit/ds/symlink/lm70880.pdf",
  "SNVSCD3",
  "September 2024; Package Option Addendum 6-Feb-2026",
  "September 2024",
  "sha256:f6115dacb305ac44d58d1985647095d05406861532e22d8d8643cb215561f3dc",
  LM70880_RETRIEVED_AT,
);

const lt8640sProduct = source(
  "adi-lt8640s-product",
  "analog-devices",
  "manufacturer_product_page",
  "LT8640S/LT8640SA product information",
  "https://www.analog.com/en/products/lt8640s.html",
  null,
  null,
  null,
  "sha256:0a2d3920d5535affa071f25ac995f2ecc243e9a341bb569355d397eb8073dec8",
  ADI_VERIFIED_RETRIEVED_AT,
);
const lt8640sDatasheet = source(
  "adi-lt8640s-datasheet",
  "analog-devices",
  "manufacturer_datasheet",
  "LT8640S/LT8643S/LT8640SA/LT8643SA synchronous step-down regulator",
  "https://www.analog.com/media/en/technical-documentation/data-sheets/lt8640s-lt8643s-lt8640sa-lt8643sa.pdf",
  "LT8640S/LT8643S/LT8640SA/LT8643SA",
  "Rev. D",
  "2024-09-19",
  "sha256:489bb5559a2103cb9f90b59ae9e6e45b7a4e06f5c3df8c7154a9e23c5f457ecc",
  ADI_VERIFIED_RETRIEVED_AT,
);

const ncp1599Datasheet = source(
  "onsemi-ncp1599-datasheet",
  "onsemi",
  "manufacturer_datasheet",
  "NCP1599 Buck Regulator - Synchronous 1 MHz, 3 A",
  "https://www.onsemi.com/download/data-sheet/pdf/ncp1599-d.pdf",
  "NCP1599/D",
  "Rev. 2",
  "May 2024",
  "sha256:40e0c29696d6adb4b35e8f331fc404d5c4efab35a15f8b449223c97931fc5650",
);

const lm5145Part = source(
  "ti-lm5145rgyr-product",
  "texas-instruments",
  "manufacturer_product_page",
  "LM5145RGYR part details",
  "https://www.ti.com/product/LM5145",
  null,
  null,
  null,
  "sha256:4e177c79e7235d5932fc56b5f16427284c30f8d0182dd5447b37088b0af8f681",
  LM5145_PRODUCT_RETRIEVED_AT,
);
const lm5145Datasheet = source(
  "ti-lm5145-datasheet",
  "texas-instruments",
  "manufacturer_datasheet",
  "LM5145 75-V Synchronous Buck DC/DC Controller With Wide Duty Cycle Range",
  "https://www.ti.com/lit/ds/symlink/lm5145.pdf",
  "SNVSAI4B",
  "Rev. B",
  "November 2020",
  "sha256:9916caabb1429cc97985e260e0d0b0ccce1850156ac31557c9be079f7dd00a9e",
);

const ltc3891Product = source(
  "adi-ltc3891-product",
  "analog-devices",
  "manufacturer_product_page",
  "LTC3891 product information",
  "https://www.analog.com/en/products/ltc3891.html",
  null,
  null,
  null,
  "sha256:d3c5306b703ea1d23601d909bf7ba658ef6921d9c896caae74dc139de27641ff",
  ADI_VERIFIED_RETRIEVED_AT,
);
const ltc3891Datasheet = source(
  "adi-ltc3891-datasheet",
  "analog-devices",
  "manufacturer_datasheet",
  "LTC3891 Low IQ, 60V Synchronous Step-Down Controller",
  "https://www.analog.com/media/en/technical-documentation/data-sheets/3891fa.pdf",
  "3891fa",
  "Rev. A",
  "2012-10-11",
  "sha256:21a46463d6a45e3ce64349c2359866de6eeb819a33372c909f1426af8ef1aba6",
  ADI_VERIFIED_RETRIEVED_AT,
);

const ltc3895Product = source(
  "adi-ltc3895-product",
  "analog-devices",
  "manufacturer_product_page",
  "LTC3895 product information",
  "https://www.analog.com/en/products/ltc3895.html",
  null,
  null,
  null,
  "sha256:77c7dd92d532fc02fd0692afa346ff415ab6c4717c032bdb3951ee2f141ed324",
  ADI_VERIFIED_RETRIEVED_AT,
);
const ltc3895Datasheet = source(
  "adi-ltc3895-datasheet",
  "analog-devices",
  "manufacturer_datasheet",
  "LTC3895 150V Low IQ, Synchronous Step-Down DC/DC Controller",
  "https://www.analog.com/media/en/technical-documentation/data-sheets/3895fa.pdf",
  "3895fa",
  "Rev. A",
  "2016-09-23",
  "sha256:33b389917fddb3be0e9e549217a41b791445c8acb34349dfe711a9e786105c09",
  ADI_VERIFIED_RETRIEVED_AT,
);

const profiles: RealPrimaryPartProfile[] = [
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.texas-instruments.tps54302ddcr",
    partClass: "power.integrated-synchronous-buck-regulator",
    displayName: "TPS54302 28 V, 3 A synchronous buck regulator",
    identity: {
      part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "TPS54302DDCR" },
      manufacturerDisplayName: "Texas Instruments",
      sourceRefs: [ref("ti-tps54302ddcr-product", "Page title and active orderable-part heading: TPS54302DDCR")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [tps54302Part, tps54302Product, tps54302Datasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 4.5, null, 28, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Input Supply, VIN input voltage range, page 5")]),
        outputVoltage: knownNumeric("V", 0.6, null, 26, [ref("ti-tps54302-product", "Product details parametric table, Vout (min) and Vout (max)")]),
        maximumOutputCurrent: knownNumeric("A", null, null, 3, [ref("ti-tps54302-datasheet", "Section 1 Features and Section 6.1 Overview, 3 A continuous output current, pages 1 and 8")]),
        feedbackReference: knownNumeric("V", 0.581, 0.596, 0.611, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Feedback and Error Amplifier, VFB, page 5")]),
        currentLimit: knownNumeric("A", 4, 5, 6, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Current Limit, I(LIM_HS), page 5")], "High-side maximum inductor peak-current limit."),
        currentSenseThreshold: unknownNumeric("V", "The datasheet specifies integrated switch current limits in amperes rather than exposing a current-sense threshold voltage."),
        currentSenseMechanism: knownText("integrated_switch_current", [ref("ti-tps54302-datasheet", "Section 6.3.1 Fixed-Frequency PWM Control and Section 6.3.11 Overcurrent Protection, pages 9 and 12")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", 290_000, 400_000, 510_000, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Oscillator, fSW, page 5")]),
        minimumOnTime: knownNumeric("s", null, 110e-9, null, [ref("ti-tps54302-datasheet", "Section 5.6 Timing Requirements, On Time Control, tMIN_ON, page 5")], "Typical value measured at 90%-to-90% with 1 A load; not production tested."),
        minimumOffTime: unknownNumeric("s", "No minimum controllable off-time specification was located in the reviewed primary sources."),
        softStartTime: knownNumeric("s", null, 5e-3, null, [ref("ti-tps54302-datasheet", "Section 5.6 Timing Requirements, tSS soft-start time, page 5")]),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 125, [ref("ti-tps54302-datasheet", "Section 5.3 Recommended Operating Conditions, TJ, page 4")]),
        maximumJunctionTemperature: unknownNumeric("K", "No absolute-maximum junction-temperature claim has been extracted for facts-V2 authoring."),
        thermalShutdownTemperature: knownNumeric("degC", null, 160, null, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Overtemperature Protection, page 5")], "Typical rising threshold; not production tested."),
      },
      control: {
        mode: knownText("peak_current_mode", [ref("ti-tps54302-datasheet", "Section 6.3.1 Fixed-Frequency PWM Control, page 9")]),
        compensation: knownText("internal", [ref("ti-tps54302-datasheet", "Section 6.1 Overview and Section 6.3.3 Error Amplifier, pages 8 and 10")]),
        ...unknownLoopFacts(),
      },
    },
    integratedPowerStage: {
      highSideOnResistance: knownNumeric("ohm", null, 0.085, null, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Power Stage, R(HSD), page 5")], "Typical at TA = 25 C, VBST - VSW = 5 V."),
      lowSideOnResistance: knownNumeric("ohm", null, 0.04, null, [ref("ti-tps54302-datasheet", "Section 5.5 Electrical Characteristics, Power Stage, R(LSD), page 5")], "Typical at TA = 25 C, VIN = 12 V."),
    },
  },
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.texas-instruments.lm70880rrxr",
    partClass: "power.integrated-synchronous-buck-regulator",
    displayName: "LM70880 80 V, 8 A synchronous buck regulator",
    identity: {
      part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "LM70880RRXR" },
      manufacturerDisplayName: "Texas Instruments",
      sourceRefs: [ref("ti-lm70880-datasheet", "Package Option Addendum, exact active-production LM70880RRXR VQFN (RRX), 29-pin row, physical PDF page 48")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [lm70880Datasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 4.5, null, 80, [ref("ti-lm70880-datasheet", "Section 5.3 Recommended Operating Conditions, VIN input supply 4.5 V to 80 V, physical PDF page 5")], "Recommended operating range; the separate 87.5 V absolute maximum is not an operating limit."),
        outputVoltage: knownNumeric("V", 0.8, null, 55, [ref("ti-lm70880-datasheet", "Section 5.3 Recommended Operating Conditions, VOUT 0.8 V to 55 V, physical PDF page 5")]),
        maximumOutputCurrent: knownNumeric("A", null, null, 8, [ref("ti-lm70880-datasheet", "Section 3 Description and Section 5.3 Recommended Operating Conditions, LM70880 up to 8 A and IOUT range 0 A to 8 A with 5 milliohm sense resistor, physical PDF pages 1 and 5")], "Single-device capability only. The 16 A headline requires two interleaved converters with paralleled outputs and is not promoted."),
        feedbackReference: knownNumeric("V", 0.794, 0.8, 0.806, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Reference Voltage (FB), regulated FB voltage minimum 794 mV, typical 800 mV, and maximum 806 mV; limits apply over TJ = -40 deg C to 150 deg C, typical is at TJ = 25 deg C, and all values are at VIN = 12 V unless otherwise noted, physical PDF page 7")], "At VIN = 12 V: minimum and maximum apply over TJ = -40 deg C to 150 deg C; typical applies at TJ = 25 deg C."),
        currentLimit: unknownNumeric("A", "The source publishes a 50 mV / 56 mV / 62 mV current-sense threshold and an external 5 milliohm sense resistor. Their quotient is calculated electrical evidence and is not promoted to an ampere current limit."),
        currentSenseThreshold: knownNumeric("V", 0.05, 0.056, 0.062, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Overcurrent Protection, VCS-TH measured from ISNS+ to VOUT is 50 mV minimum, 56 mV typical, and 62 mV maximum; limits apply over TJ = -40 deg C to 150 deg C, typical is at TJ = 25 deg C, and all values are at VIN = 12 V unless otherwise noted, physical PDF pages 7-8")], "Protection threshold across the external sense resistor, not output-current capability. At VIN = 12 V, minimum and maximum apply over TJ = -40 deg C to 150 deg C and typical applies at TJ = 25 deg C."),
        currentSenseMechanism: knownText("external_sense_resistor", [ref("ti-lm70880-datasheet", "Section 5.3 Recommended Operating Conditions and section 5.5 Overcurrent Protection: LM70880 uses a 5 milliohm external sense resistor and measures ISNS+ to VOUT, physical PDF pages 5 and 8")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", null, 440_000, null, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Switching Frequency, fSW2 typical 440 kHz at RRT = 49.9 kohm to AGND, TJ = 25 deg C, and VIN = 12 V, physical PDF page 7; section 6.3.5 Switching Frequency (RT), physical PDF page 15")], "Resistor-programmed typical observation at RRT = 49.9 kohm, TJ = 25 deg C, and VIN = 12 V only. The 200 kHz-to-2.2 MHz headline is not a configuration-independent guaranteed range."),
        minimumOnTime: knownNumeric("s", null, 25e-9, null, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Switching Frequency, minimum on-time typical 25 ns at TJ = 25 deg C and VIN = 12 V, physical PDF page 7; note 1 states specified by design and not production tested, physical PDF page 8")], "Typical at TJ = 25 deg C and VIN = 12 V; specified by design and not production tested."),
        minimumOffTime: knownNumeric("s", null, 88e-9, 126e-9, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Switching Frequency, minimum off-time typical 88 ns and maximum 126 ns; maximum applies over TJ = -40 deg C to 150 deg C, typical is at TJ = 25 deg C, and both are at VIN = 12 V, physical PDF page 7")], "At VIN = 12 V: the 126 ns maximum applies over TJ = -40 deg C to 150 deg C; the 88 ns typical applies at TJ = 25 deg C."),
        softStartTime: knownNumeric("s", 1.9e-3, 2.8e-3, 4.4e-3, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Startup, internal fixed soft-start time 1.9 ms minimum, 2.8 ms typical, and 4.4 ms maximum; limits apply over TJ = -40 deg C to 150 deg C, typical is at TJ = 25 deg C, and all values are at VIN = 12 V unless otherwise noted, physical PDF pages 7-8")], "At VIN = 12 V, minimum and maximum apply over TJ = -40 deg C to 150 deg C and typical applies at TJ = 25 deg C."),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 150, [ref("ti-lm70880-datasheet", "Section 5.3 Recommended Operating Conditions, TJ -40 deg C to 150 deg C, physical PDF pages 5-6")]),
        maximumJunctionTemperature: knownNumeric("K", null, null, 423.15, [ref("ti-lm70880-datasheet", "Section 5.1 Absolute Maximum Ratings, operating junction temperature maximum 150 deg C, physical PDF page 5")], "Absolute maximum rating converted to 423.15 K; not a recommended thermal design target."),
        thermalShutdownTemperature: knownNumeric("degC", null, 175, null, [ref("ti-lm70880-datasheet", "Section 5.5 Electrical Characteristics heading and Thermal Shutdown, rising threshold typical 175 deg C at TJ = 25 deg C and VIN = 12 V; specified by design and not production tested, physical PDF pages 7-8")], "Typical protection threshold at TJ = 25 deg C and VIN = 12 V; specified by design and not production tested."),
      },
      control: {
        mode: knownText("peak_current_mode", [ref("ti-lm70880-datasheet", "Section 3 Description, peak current-mode control architecture, physical PDF page 1")]),
        compensation: knownText("application_dependent", [ref("ti-lm70880-datasheet", "Features and section 6.3.10 Error Amplifier and PWM Comparator (FB, EXTCOMP): EXTCOMP impedance selects internal or external compensation, physical PDF pages 1 and 17")], "The selected compensation network is application-dependent and is absent from the installed fixed-oscillator recipe."),
        ...unknownLoopFacts(),
      },
    },
    integratedPowerStage: {
      highSideOnResistance: unknownNumeric("ohm", "No numeric high-side MOSFET on-resistance specification was located in the pinned source."),
      lowSideOnResistance: unknownNumeric("ohm", "No numeric low-side MOSFET on-resistance specification was located in the pinned source."),
    },
  },
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.analog-devices.lt8640siv-pbf",
    partClass: "power.integrated-synchronous-buck-regulator",
    displayName: "LT8640S 42 V, 6 A synchronous buck regulator",
    identity: {
      part: { manufacturerId: "analog-devices", manufacturerPartNumber: "LT8640SIV#PBF" },
      manufacturerDisplayName: "Analog Devices",
      sourceRefs: [ref("adi-lt8640s-product", "Part Models table, LT8640SIV#PBF production model row")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [lt8640sProduct, lt8640sDatasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 3.4, null, 42, [ref("adi-lt8640s-datasheet", "Features, Wide Input Voltage Range, page 1")]),
        outputVoltage: knownNumeric("V", 0.97, null, 10, [ref("adi-lt8640s-datasheet", "Features, Output Voltage Range for LT8640S/LT8643S, page 1")]),
        maximumOutputCurrent: knownNumeric("A", null, null, 6, [ref("adi-lt8640s-datasheet", "Features, 6 A Maximum Continuous Output, page 1")]),
        feedbackReference: knownNumeric("V", null, 0.97, null, [ref("adi-lt8640s-datasheet", "Pin Functions, TR/SS and FB reference behavior, page 13")]),
        currentLimit: knownNumeric("A", 7.5, 10, 12.5, [ref("adi-lt8640s-datasheet", "Electrical Characteristics, Top Power NMOS Current Limit, page 3")], "Top-switch current limit."),
        currentSenseThreshold: unknownNumeric("V", "The current limit is specified at the integrated top switch; no external current-sense threshold is exposed."),
        currentSenseMechanism: knownText("integrated_switch_current", [ref("adi-lt8640s-datasheet", "Electrical Characteristics, Top Power NMOS Current Limit, page 3")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", 200_000, null, 3_000_000, [ref("adi-lt8640s-datasheet", "Features and Setting the Switching Frequency, pages 1 and 19")]),
        minimumOnTime: knownNumeric("s", null, 30e-9, 50e-9, [ref("adi-lt8640s-datasheet", "Electrical Characteristics, Minimum On-Time at ILOAD = 1.5 A, page 3")], "Maximum shown for SYNC = 0 V; typical is 30 ns."),
        minimumOffTime: knownNumeric("s", 80e-9, null, 110e-9, [ref("adi-lt8640s-datasheet", "Electrical Characteristics, Minimum Off-Time, page 3")]),
        softStartTime: unknownNumeric("s", "The TR/SS capacitor programs the ramp; no fixed soft-start time exists without an application-specific capacitor."),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 125, [ref("adi-lt8640s-datasheet", "Absolute Maximum Ratings, LT8640SI operating junction temperature range, page 3")]),
        maximumJunctionTemperature: unknownNumeric("K", "No absolute-maximum junction-temperature claim has been extracted for facts-V2 authoring."),
        thermalShutdownTemperature: unknownNumeric("degC", "Overtemperature protection is documented, but no activation threshold is specified in the reviewed primary source."),
      },
      control: {
        mode: knownText("peak_current_mode", [ref("adi-lt8640s-datasheet", "Description, peak current mode control, page 1")]),
        compensation: knownText("internal", [ref("adi-lt8640s-datasheet", "Typical Performance Characteristics, Transient Response; Internal Compensation (LT8640S/LT8640SA), page 9")]),
        ...unknownLoopFacts(),
      },
    },
    integratedPowerStage: {
      highSideOnResistance: knownNumeric("ohm", null, 0.066, null, [ref("adi-lt8640s-datasheet", "Electrical Characteristics, Top Power NMOS On-Resistance at ISW = 1 A, page 3")]),
      lowSideOnResistance: knownNumeric("ohm", null, 0.027, null, [ref("adi-lt8640s-datasheet", "Electrical Characteristics, Bottom Power NMOS On-Resistance at ISW = 1 A, page 3")]),
    },
  },
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.onsemi.ncp1599mntwg",
    partClass: "power.integrated-synchronous-buck-regulator",
    displayName: "NCP1599 5.5 V, 3 A synchronous buck regulator",
    identity: {
      part: { manufacturerId: "onsemi", manufacturerPartNumber: "NCP1599MNTWG" },
      manufacturerDisplayName: "onsemi",
      sourceRefs: [ref("onsemi-ncp1599-datasheet", "Ordering Information, NCP1599MNTWG DFN6 tape-and-reel row, page 1")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [ncp1599Datasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 3, null, 5.5, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, VIN Input Voltage Range, page 5")]),
        outputVoltage: knownNumeric("V", 0.8, null, null, [ref("onsemi-ncp1599-datasheet", "Features, Adjustable Output Voltage Down to 0.8 V, page 1")], "Only the guaranteed lower bound is stated; the upper operating bound remains unknown."),
        maximumOutputCurrent: knownNumeric("A", null, null, 3, [ref("onsemi-ncp1599-datasheet", "Title, Features, and Output MOSFETs description, pages 1 and 10")]),
        feedbackReference: knownNumeric("V", 0.788, 0.8, 0.812, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, Reference Voltage VFB at VFB = VCOMP; limits apply over TJ = -40 C to 125 C and the typical value is at TJ = 25 C, page 5")]),
        currentLimit: knownNumeric("A", 3.83, 4.18, 4.54, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, Pulse-by-Pulse Current Limit ILIM at VIN = 4.0 V to 5.5 V, VOUT = 1.2 V, TJ = 25 C, normal operation, page 5")], "Current-limit operation is not guaranteed below VIN = 4.0 V."),
        currentSenseThreshold: unknownNumeric("V", "The datasheet specifies the integrated high-side switch current limit in amperes and does not expose a sense threshold voltage."),
        currentSenseMechanism: knownText("integrated_switch_current", [ref("onsemi-ncp1599-datasheet", "Protections, Overcurrent Protection, page 11")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", 870_000, 1_000_000, 1_130_000, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, Oscillator Frequency FSW, page 5")]),
        minimumOnTime: knownNumeric("s", null, null, 50e-9, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, PWM Minimum Controllable ON Time at VIN = 3.0 V to 5.5 V, VOUT = 1.2 V, TJ = 25 C, page 5")], "Guaranteed maximum by design."),
        minimumOffTime: unknownNumeric("s", "No minimum controllable off-time specification was located in the reviewed primary source."),
        softStartTime: knownNumeric("s", null, 1e-3, null, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, Soft-Start Ramp Time tSS, page 5")], "Guaranteed by design."),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 125, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics heading, min/max specification junction-temperature range, page 5")]),
        maximumJunctionTemperature: knownNumeric("K", null, null, 423.15, [ref("onsemi-ncp1599-datasheet", "Absolute Maximum Ratings, Junction Temperature TJ maximum 150 C, page 3")], "Absolute maximum rating; not a recommended operating-junction limit."),
        thermalShutdownTemperature: knownNumeric("degC", null, 170, null, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, Thermal Shutdown Threshold, page 5")]),
      },
      control: {
        mode: knownText("current_mode", [ref("onsemi-ncp1599-datasheet", "Detailed Description, Overview, current mode control, page 10")]),
        compensation: knownText("external", [ref("onsemi-ncp1599-datasheet", "Pin Descriptions, COMP pin series R-C network, page 2; Compensation Design, pages 12-13")]),
        ...unknownLoopFacts(),
      },
    },
    integratedPowerStage: {
      highSideOnResistance: knownNumeric("ohm", null, 0.14, 0.175, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, High Side MOSFET ON Resistance at IDS = 100 mA and VGS = 5 V; limits apply over TJ = -40 C to 125 C, page 5")], "At IDS = 100 mA and VGS = 5 V."),
      lowSideOnResistance: knownNumeric("ohm", null, 0.09, 0.1, [ref("onsemi-ncp1599-datasheet", "Electrical Characteristics, Low Side MOSFET ON Resistance at IDS = 100 mA and VGS = 5 V; limits apply over TJ = -40 C to 125 C, page 5")], "At IDS = 100 mA and VGS = 5 V."),
    },
  },
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.texas-instruments.lm5145rgyr",
    partClass: "power.external-fet-synchronous-buck-controller",
    displayName: "LM5145 75 V synchronous buck controller",
    identity: {
      part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "LM5145RGYR" },
      manufacturerDisplayName: "Texas Instruments",
      sourceRefs: [ref("ti-lm5145rgyr-product", "Page title and active orderable-part heading: LM5145RGYR")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [lm5145Part, lm5145Datasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 6, null, 75, [ref("ti-lm5145-datasheet", "Section 7.3 Recommended Operating Conditions and Section 7.5 Electrical Characteristics, VIN, pages 7-8")]),
        outputVoltage: knownNumeric("V", 0.8, null, 60, [ref("ti-lm5145rgyr-product", "Features, adjustable output voltage from 0.8 V to 60 V")]),
        maximumOutputCurrent: unknownNumeric("A", "Controller output current depends on the selected external MOSFETs, inductor, current-sense element, cooling, and programmed limit."),
        feedbackReference: knownNumeric("V", 0.792, 0.8, 0.808, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, Error Amplifier, VREF, page 8")]),
        currentLimit: unknownNumeric("A", "The application current limit is programmed by RILIM and the selected low-side MOSFET or shunt; no universal ampere limit exists."),
        currentSenseThreshold: unknownNumeric("V", "The ILIM comparator is resistor-programmed from an internal current source; the comparator offset alone is not an application current-sense threshold."),
        currentSenseMechanism: knownText("low_side_rds_on_or_shunt", [ref("ti-lm5145-datasheet", "Section 8.3.9 Current Sensing and Current Limit, low-side FET RDS(on) or current-sense resistor, pages 23-24")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", 100_000, null, 1_000_000, [ref("ti-lm5145-datasheet", "Section 8.3.1 Overview and Section 8.3.5 Switching Frequency Programming, pages 16 and 19")]),
        minimumOnTime: knownNumeric("s", 40e-9, null, 60e-9, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, PWM Control, tON(MIN), page 9")]),
        minimumOffTime: knownNumeric("s", 140e-9, null, 200e-9, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, PWM Control, tOFF(MIN), page 9")]),
        softStartTime: unknownNumeric("s", "Soft-start time depends on the capacitor selected at SS/TRK; no application capacitor is part of this controller-only profile."),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 125, [ref("ti-lm5145-datasheet", "Section 7.3 Recommended Operating Conditions, TJ, page 7")]),
        maximumJunctionTemperature: unknownNumeric("K", "No absolute-maximum junction-temperature claim has been extracted for facts-V2 authoring."),
        thermalShutdownTemperature: knownNumeric("degC", null, 175, null, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, Thermal Shutdown, TSD, page 10")]),
      },
      control: {
        mode: knownText("voltage_mode", [ref("ti-lm5145rgyr-product", "Features, voltage-mode control with line feedforward")]),
        compensation: knownText("external", [ref("ti-lm5145-datasheet", "Section 8.3.1 Functional Block Diagram and COMP pin; Section 9.1.5 Control Loop Compensation, pages 16 and 31")]),
        ...unknownLoopFacts(),
      },
    },
    externalGateDrive: {
      voltage: knownNumeric("V", 7.3, 7.5, 7.7, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, VCC Regulator, VVCC, page 8")]),
      sourceCurrent: knownNumeric("A", null, 2.3, null, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, Gate Drivers, HO/LO source current, page 10")]),
      sinkCurrent: knownNumeric("A", null, 3.5, null, [ref("ti-lm5145-datasheet", "Section 7.5 Electrical Characteristics, Gate Drivers, HO/LO sink current, page 10")]),
      deadTime: knownNumeric("s", null, 14e-9, null, [ref("ti-lm5145-datasheet", "Section 7.6 Switching Characteristics, HO and LO turn-on dead time, page 10")]),
    },
  },
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.analog-devices.ltc3891efe-pbf",
    partClass: "power.external-fet-synchronous-buck-controller",
    displayName: "LTC3891 60 V synchronous buck controller",
    identity: {
      part: { manufacturerId: "analog-devices", manufacturerPartNumber: "LTC3891EFE#PBF" },
      manufacturerDisplayName: "Analog Devices",
      sourceRefs: [ref("adi-ltc3891-product", "Part Models table, LTC3891EFE#PBF row")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [ltc3891Product, ltc3891Datasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 4, null, 60, [ref("adi-ltc3891-datasheet", "Features and Electrical Characteristics, VIN input operating range, pages 1 and 3")]),
        outputVoltage: knownNumeric("V", 0.8, null, 24, [ref("adi-ltc3891-datasheet", "Features, Wide Output Voltage Range, page 1")]),
        maximumOutputCurrent: unknownNumeric("A", "Controller output current depends on the selected external MOSFETs, inductor, sense element, cooling, and programmed limit."),
        feedbackReference: knownNumeric("V", 0.792, 0.8, 0.808, [ref("adi-ltc3891-datasheet", "Electrical Characteristics, regulated feedback voltage for LTC3891E, page 3")]),
        currentLimit: unknownNumeric("A", "The ampere limit depends on the external RSENSE or inductor DCR network and ILIM selection."),
        currentSenseThreshold: knownNumeric("V", 0.022, null, 0.085, [ref("adi-ltc3891-datasheet", "Electrical Characteristics, VSENSE(MAX) for the three ILIM states, page 3")], "Envelope across the three selectable ILIM configurations; the discrete settings remain application choices."),
        currentSenseMechanism: knownText("rsense_or_inductor_dcr", [ref("adi-ltc3891-datasheet", "Features and Applications Information, RSENSE or DCR current sensing, pages 1 and 15")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", 50_000, null, 900_000, [ref("adi-ltc3891-datasheet", "Features, Programmable Fixed Frequency, page 1")]),
        minimumOnTime: knownNumeric("s", null, 95e-9, null, [ref("adi-ltc3891-datasheet", "Electrical Characteristics, tON(MIN), page 4; Minimum On-Time Considerations, page 23")], "Approximately 95 ns and dependent on ripple/current-sense conditions."),
        minimumOffTime: unknownNumeric("s", "No minimum controllable off-time specification was located in the reviewed primary sources."),
        softStartTime: unknownNumeric("s", "TRACK/SS uses an external capacitor charged by an internal current source; no application capacitor is selected."),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 125, [ref("adi-ltc3891-datasheet", "Operating Junction Temperature Range for LTC3891E and order information for LTC3891EFE#PBF, pages 2-3")]),
        maximumJunctionTemperature: unknownNumeric("K", "No absolute-maximum junction-temperature claim has been extracted for facts-V2 authoring."),
        thermalShutdownTemperature: unknownNumeric("degC", "No thermal-shutdown activation threshold was located in the reviewed primary sources."),
      },
      control: {
        mode: knownText("current_mode", [ref("adi-ltc3891-datasheet", "Description, constant-frequency current-mode architecture, page 1")]),
        compensation: knownText("external", [ref("adi-ltc3891-datasheet", "Description and Applications Information, OPTI-LOOP/ITH compensation and Checking Transient Response, pages 1 and 24")]),
        ...unknownLoopFacts(),
      },
    },
    externalGateDrive: {
      voltage: knownNumeric("V", 4.85, 5.1, 5.35, [ref("adi-ltc3891-datasheet", "Electrical Characteristics, INTVCC Linear Regulator, VINTVCCVIN, page 4")]),
      sourceCurrent: unknownNumeric("A", "The datasheet specifies driver pull-up resistance and transition time, not a source-current rating."),
      sinkCurrent: unknownNumeric("A", "The datasheet specifies driver pull-down resistance and transition time, not a sink-current rating."),
      deadTime: knownNumeric("s", null, 30e-9, null, [ref("adi-ltc3891-datasheet", "Electrical Characteristics, top-gate/bottom-gate switch-on delay times, page 4")], "Typical with 3300 pF load."),
    },
  },
  {
    schemaVersion: "1.0.0",
    profileKind: "real_primary_part_evidence",
    profileId: "real.analog-devices.ltc3895efe-pbf",
    partClass: "power.external-fet-synchronous-buck-controller",
    displayName: "LTC3895 140 V synchronous buck controller",
    identity: {
      part: { manufacturerId: "analog-devices", manufacturerPartNumber: "LTC3895EFE#PBF" },
      manufacturerDisplayName: "Analog Devices",
      sourceRefs: [ref("adi-ltc3895-product", "Part Models table, LTC3895EFE#PBF production model row")],
    },
    evidenceReviewState: "authored_primary_source_extraction",
    manifestReviewState: "authored",
    admissionState: "blocked_facts_v2_authoring_review_and_admission",
    sources: [ltc3895Product, ltc3895Datasheet],
    facts: {
      electrical: {
        inputVoltage: knownNumeric("V", 4, null, 140, [ref("adi-ltc3895-datasheet", "Electrical Characteristics, VIN operating voltage range, page 3")]),
        outputVoltage: knownNumeric("V", 0.8, null, 60, [ref("adi-ltc3895-datasheet", "Electrical Characteristics, VOUT regulated set point, page 3")]),
        maximumOutputCurrent: unknownNumeric("A", "Controller output current depends on the selected external MOSFETs, inductor, sense element, cooling, and programmed limit."),
        feedbackReference: knownNumeric("V", 0.788, 0.8, 0.812, [ref("adi-ltc3895-datasheet", "Electrical Characteristics, regulated feedback voltage for LTC3895E, page 3")]),
        currentLimit: unknownNumeric("A", "The ampere limit depends on the external RSENSE or inductor DCR network and ILIM selection."),
        currentSenseThreshold: knownNumeric("V", 0.043, null, 0.109, [ref("adi-ltc3895-datasheet", "Electrical Characteristics, VSENSE(MAX) for the three ILIM states, page 3")], "Envelope across the three selectable ILIM configurations; the discrete settings remain application choices."),
        currentSenseMechanism: knownText("rsense_or_inductor_dcr", [ref("adi-ltc3895-datasheet", "Applications Information, current-sense selection and RSENSE/DCR sensing, pages 17-19")]),
      },
      timing: {
        switchingFrequency: knownNumeric("Hz", 50_000, null, 900_000, [ref("adi-ltc3895-datasheet", "Features, Programmable Fixed Frequency, page 1")]),
        minimumOnTime: knownNumeric("s", null, 80e-9, null, [ref("adi-ltc3895-datasheet", "Electrical Characteristics, tON(MIN), page 4; Minimum On-Time Considerations, page 27")], "Approximately 80 ns and dependent on peak sense voltage."),
        minimumOffTime: unknownNumeric("s", "No minimum controllable off-time specification was located in the reviewed primary sources."),
        softStartTime: unknownNumeric("s", "The SS capacitor programs soft start; no application capacitor is selected."),
      },
      thermal: {
        operatingJunctionTemperature: knownNumeric("degC", -40, null, 125, [ref("adi-ltc3895-datasheet", "Operating Junction Temperature Range for LTC3895E and order information for LTC3895EFE#PBF, page 2")]),
        maximumJunctionTemperature: unknownNumeric("K", "No absolute-maximum junction-temperature claim has been extracted for facts-V2 authoring."),
        thermalShutdownTemperature: unknownNumeric("degC", "Overtemperature protection is documented without a numeric activation threshold in the reviewed primary source."),
      },
      control: {
        mode: knownText("current_mode", [ref("adi-ltc3895-datasheet", "Description, constant-frequency current-mode architecture, page 1")]),
        compensation: knownText("external", [ref("adi-ltc3895-datasheet", "Description and Applications Information, OPTI-LOOP/ITH compensation, pages 1 and 30")]),
        ...unknownLoopFacts(),
      },
    },
    externalGateDrive: {
      voltage: knownNumeric("V", 5, null, 10, [ref("adi-ltc3895-datasheet", "Features and Table 1a, adjustable DRVCC gate-drive level, pages 1 and 23")]),
      sourceCurrent: unknownNumeric("A", "The datasheet specifies driver pull-up resistance and transition time, not a source-current rating."),
      sinkCurrent: unknownNumeric("A", "The datasheet specifies driver pull-down resistance and transition time, not a sink-current rating."),
      deadTime: knownNumeric("s", 50e-9, null, 55e-9, [ref("adi-ltc3895-datasheet", "Electrical Characteristics, bottom-gate/top-gate switch-on delay times, page 4")], "Directional delays with 3300 pF at each driver."),
    },
  },
];

export const REAL_PRIMARY_PART_CATALOG = deepFreeze({
  schemaVersion: "1.0.0",
  catalogKind: "real_primary_part_evidence_tranche",
  version: "2026-08-26.1",
  authoredAt: "2026-08-26",
  manufacturers,
  profiles,
} satisfies RealPrimaryPartCatalog);
