import { contentHash, deepFreeze, type DeepReadonly } from "./canonical";

export const POWER_REFERENCE_DESIGN_EVIDENCE_FORMAT_V1 =
  "schemagic-power-reference-design-evidence" as const;
export const POWER_REFERENCE_DESIGN_EVIDENCE_SCHEMA_VERSION_V1 = "1.0.0" as const;

export type PowerReferenceDesignUnitV1 = "1" | "A" | "A/s" | "Hz" | "K" | "V" | "s";
export type PowerReferenceDesignObservationRelationV1 =
  | "equals"
  | "less_than"
  | "reported_absolute_magnitude"
  | "reported_range";

export interface PowerReferenceDesignQuantityV1 {
  value: number;
  unit: PowerReferenceDesignUnitV1;
}

export interface PowerReferenceDesignRangeV1 {
  minimum: PowerReferenceDesignQuantityV1;
  maximum: PowerReferenceDesignQuantityV1;
}

export interface PowerReferenceDesignConditionV1 {
  parameterId: string;
  range: PowerReferenceDesignRangeV1;
}

export interface PowerReferenceDesignBomLineV1 {
  designators: readonly string[];
  quantity: number;
  populated: boolean;
  nominalValue: string | null;
  description: string;
  packageReference: string;
  manufacturer: string;
  manufacturerPartNumber: string;
}

export interface PowerReferenceDesignLayoutReferenceV1 {
  sourceContentHash: `sha256:${string}`;
  sourceLocators: readonly string[];
  evidenceRole: "published_layout_reference_only";
  attestation: "none";
}

export interface PowerReferenceDesignObservationV1 {
  id: string;
  measurand: string;
  evidenceRole: "manufacturer_evaluation_module_tested_range" | "manufacturer_evaluation_module_typical_observation";
  relation: PowerReferenceDesignObservationRelationV1;
  value: PowerReferenceDesignQuantityV1 | null;
  range: PowerReferenceDesignRangeV1 | null;
  conditions: readonly PowerReferenceDesignConditionV1[];
  sourceLocator: string;
  strictConstraintAuthority: false;
  explanation: string;
}

export interface PowerReferenceDesignEvidencePayloadV1 {
  format: typeof POWER_REFERENCE_DESIGN_EVIDENCE_FORMAT_V1;
  schemaVersion: typeof POWER_REFERENCE_DESIGN_EVIDENCE_SCHEMA_VERSION_V1;
  version: string;
  identity: {
    manufacturerId: string;
    referenceDesignId: string;
    assemblyId: string;
  };
  source: {
    sourceId: string;
    url: string;
    documentId: string;
    revision: string;
    publicationDate: string;
    retrievedAt: string;
    contentHash: `sha256:${string}`;
    publicationRights: "link_and_factual_extract_only";
    licenseNote: string;
  };
  scope: {
    identityAssertionAttestation: "none";
    physicalAssemblyQualificationAuthority: false;
    applicationAuthority: false;
    bomAndLayoutIdentityAuthority: "published_reference_only";
    layoutReference: PowerReferenceDesignLayoutReferenceV1;
    productionPopulationCoverage: "not_claimed";
    selectedPartModelCoverage: "not_claimed";
    candidateEligibilityAuthority: false;
  };
  bom: readonly PowerReferenceDesignBomLineV1[];
  observations: readonly PowerReferenceDesignObservationV1[];
  limitations: readonly string[];
}

export type PowerReferenceDesignEvidenceV1 = PowerReferenceDesignEvidencePayloadV1 & {
  contentHash: `sha256:${string}`;
};

export function calculatePowerReferenceDesignEvidenceContentHashV1(
  payload: Readonly<PowerReferenceDesignEvidencePayloadV1>,
): `sha256:${string}` {
  return contentHash(payload);
}

function q(value: number, unit: PowerReferenceDesignUnitV1): PowerReferenceDesignQuantityV1 {
  return { value, unit };
}

function range(
  minimum: number,
  maximum: number,
  unit: PowerReferenceDesignUnitV1,
): PowerReferenceDesignRangeV1 {
  return { minimum: q(minimum, unit), maximum: q(maximum, unit) };
}

function condition(
  parameterId: string,
  minimum: number,
  maximum: number,
  unit: PowerReferenceDesignUnitV1,
): PowerReferenceDesignConditionV1 {
  return { parameterId, range: range(minimum, maximum, unit) };
}

const SOURCE_LOCATORS = {
  introduction: "SLVUAP9B, section 1.2, Table 1-2, page 2",
  centerFrequency: "SLVUAP9B, section 1.2, Table 1-2, Center operating frequency row, page 2",
  efficiency: "SLVUAP9B, section 1.2, Table 1-2, Maximum Efficiency row (95.57% at VIN = 12 V and IO = 1 A), page 2; section 2.2 and Figure 2-1, page 5, for curve and setup context",
  loadRegulation: "SLVUAP9B, section 1.2, Table 1-2, Load regulation row (+/-0.5% at VIN = 12 V and IO = 0 A to 3 A), page 2; section 2.3 and Figure 2-3, page 6, for sweep context",
  lineRegulation: "SLVUAP9B, section 1.2, Table 1-2, Line regulation row (+/-0.5% at IO = 1.5 A and VIN = 8 V to 28 V), page 2; section 2.4 and Figure 2-4, page 6, for sweep context",
  transient: "SLVUAP9B, section 1.2, Table 1-2, Load transient response rows (150 mV magnitude and 150 us recovery), page 2; section 2.5 and Figure 2-5, page 7, for step and waveform context",
  ripple: "SLVUAP9B, section 2.6, Figure 2-6, and Table 1-2, pages 2 and 8",
  bom: "SLVUAP9B, section 4.2, Table 4-1, pages 16-17",
} as const;

const payload = {
  format: POWER_REFERENCE_DESIGN_EVIDENCE_FORMAT_V1,
  schemaVersion: POWER_REFERENCE_DESIGN_EVIDENCE_SCHEMA_VERSION_V1,
  version: "tps54302evm-716.slvuap9b.1",
  identity: {
    manufacturerId: "texas-instruments",
    referenceDesignId: "TPS54302EVM-716",
    assemblyId: "PWR716-003",
  },
  source: {
    sourceId: "ti-tps54302evm-716-user-guide",
    url: "https://www.ti.com/lit/ug/slvuap9b/slvuap9b.pdf",
    documentId: "SLVUAP9B",
    revision: "Rev. B",
    publicationDate: "2021-10-11",
    retrievedAt: "2026-08-26T01:22:34Z",
    contentHash: "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e",
    publicationRights: "link_and_factual_extract_only",
    licenseNote: "Texas Instruments public evaluation-module guide used for factual extraction; no source PDF bytes are redistributed.",
  },
  scope: {
    identityAssertionAttestation: "none",
    physicalAssemblyQualificationAuthority: false,
    applicationAuthority: false,
    bomAndLayoutIdentityAuthority: "published_reference_only",
    layoutReference: {
      sourceContentHash: "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e",
      sourceLocators: [
        "SLVUAP9B, section 3.1 and Figure 3-1, pages 13-14",
        "SLVUAP9B, Figure 3-2, page 15",
        "SLVUAP9B, section 4.1 and Figure 4-1, page 16",
      ],
      evidenceRole: "published_layout_reference_only",
      attestation: "none",
    },
    productionPopulationCoverage: "not_claimed",
    selectedPartModelCoverage: "not_claimed",
    candidateEligibilityAuthority: false,
  },
  bom: [
    { designators: ["C1", "C4"], quantity: 2, populated: true, nominalValue: "0.1uF", description: "CAP, CERM, 0.1uF, 25V, +/-10%, X5R, 0603", packageReference: "0603", manufacturer: "Murata", manufacturerPartNumber: "GRM188R61E104KA01D" },
    { designators: ["C2"], quantity: 1, populated: true, nominalValue: "10uF", description: "CAP, CERM, 10 uF, 35 V, +/- 10%, X7R, 1210", packageReference: "1210", manufacturer: "Murata", manufacturerPartNumber: "GRM32ER7YA106KA12L" },
    { designators: ["C5", "C6"], quantity: 2, populated: true, nominalValue: "22uF", description: "CAP, CERM, 22 uF, 25 V, +/- 10%, X7R, 1210", packageReference: "1210", manufacturer: "Murata", manufacturerPartNumber: "GRM32ER71E226KE15L" },
    { designators: ["C8"], quantity: 1, populated: true, nominalValue: "75pF", description: "CAP, CERM, 75 pF, 50 V, +/- 5%, C0G/NP0, 0603", packageReference: "0603", manufacturer: "Murata", manufacturerPartNumber: "GRM1885C1H750JA01D" },
    { designators: ["J1", "J2"], quantity: 2, populated: true, nominalValue: null, description: "Terminal Block, 6A, 3.5mm Pitch, 2-Pos, TH", packageReference: "7.0x8.2x6.5mm", manufacturer: "On-Shore Technology", manufacturerPartNumber: "ED555/2DS" },
    { designators: ["JP1"], quantity: 1, populated: true, nominalValue: null, description: "Header, 100mil, 2x1, Gold, TH", packageReference: "2x1 Header", manufacturer: "Samtec", manufacturerPartNumber: "TSW-102-07-G-S" },
    { designators: ["L1"], quantity: 1, populated: true, nominalValue: "10uH", description: "Inductor, Shielded Drum Core, Ferrite, 10 uH, 4.3 A, 0.023 ohm, SMD", packageReference: "10x5x10mm", manufacturer: "Wurth Elektronik", manufacturerPartNumber: "7447714100" },
    { designators: ["R1"], quantity: 1, populated: true, nominalValue: "49.9", description: "RES, 49.9, 1%, 0.1 W, 0603", packageReference: "0603", manufacturer: "Vishay-Dale", manufacturerPartNumber: "CRCW060349R9FKEA" },
    { designators: ["R2"], quantity: 1, populated: true, nominalValue: "100k", description: "RES, 100 k, 1%, 0.1 W, 0603", packageReference: "0603", manufacturer: "Vishay-Dale", manufacturerPartNumber: "CRCW0603100KFKEA" },
    { designators: ["R3"], quantity: 1, populated: true, nominalValue: "13.3k", description: "RES, 13.3 k, 1%, 0.1 W, 0603", packageReference: "0603", manufacturer: "Vishay-Dale", manufacturerPartNumber: "CRCW060313K3FKEA" },
    { designators: ["R4"], quantity: 1, populated: true, nominalValue: "510k", description: "RES, 510 k, 5%, 0.1 W, 0603", packageReference: "0603", manufacturer: "Vishay-Dale", manufacturerPartNumber: "CRCW0603510KJNEA" },
    { designators: ["R5"], quantity: 1, populated: true, nominalValue: "105k", description: "RES, 105 k, 1%, 0.1 W, 0603", packageReference: "0603", manufacturer: "Vishay-Dale", manufacturerPartNumber: "CRCW0603105KFKEA" },
    { designators: ["R6", "R7"], quantity: 2, populated: true, nominalValue: "0", description: "RES, 0 ohm, 5%, 0.1W, 0603", packageReference: "0603", manufacturer: "Panasonic", manufacturerPartNumber: "ERJ-3GEY0R00V" },
    { designators: ["TP1", "TP6"], quantity: 2, populated: true, nominalValue: "Red", description: "Test Point, Miniature, Red, TH", packageReference: "Red Miniature Testpoint", manufacturer: "Keystone", manufacturerPartNumber: "5000" },
    { designators: ["TP2", "TP3", "TP7"], quantity: 3, populated: true, nominalValue: "Black", description: "Test Point, Miniature, Black, TH", packageReference: "Black Miniature Testpoint", manufacturer: "Keystone", manufacturerPartNumber: "5001" },
    { designators: ["TP4"], quantity: 1, populated: true, nominalValue: "Yellow", description: "Test Point, Miniature, Yellow, TH", packageReference: "Yellow Miniature Testpoint", manufacturer: "Keystone", manufacturerPartNumber: "5004" },
    { designators: ["TP5"], quantity: 1, populated: true, nominalValue: "White", description: "Test Point, Miniature, White, TH", packageReference: "White Miniature Testpoint", manufacturer: "Keystone", manufacturerPartNumber: "5002" },
    { designators: ["U1"], quantity: 1, populated: true, nominalValue: null, description: "4.5-V to 28-V input, 3-A output synchronous step-down converter", packageReference: "DDC0006A", manufacturer: "Texas Instruments", manufacturerPartNumber: "TPS54302DDC" },
    { designators: ["C7"], quantity: 0, populated: false, nominalValue: "22uF", description: "CAP, CERM, 22 uF, 25 V, +/- 10%, X7R, 1210", packageReference: "1210", manufacturer: "Murata", manufacturerPartNumber: "GRM32ER71E226KE15L" },
  ],
  observations: [
    {
      id: "power.reference.tps54302evm716.tested-operating-envelope",
      measurand: "inputVoltage",
      evidenceRole: "manufacturer_evaluation_module_tested_range",
      relation: "reported_range",
      value: null,
      range: range(8, 28, "V"),
      conditions: [
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 0, 3, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.introduction,
      strictConstraintAuthority: false,
      explanation: "TI reports the exact EVM as designed and tested over this input/output range at the stated measurement ambient; this is not a production-population device guarantee.",
    },
    {
      id: "power.reference.tps54302evm716.center-switching-frequency",
      measurand: "switchingFrequency",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "equals",
      value: q(400_000, "Hz"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.centerFrequency,
      strictConstraintAuthority: false,
      explanation: "The guide reports the EVM center operating frequency; it is not a guaranteed production timing bound.",
    },
    {
      id: "power.reference.tps54302evm716.maximum-efficiency",
      measurand: "efficiency",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "equals",
      value: q(0.9557, "1"),
      range: null,
      conditions: [
        condition("inputVoltage", 12, 12, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 1, 1, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.efficiency,
      strictConstraintAuthority: false,
      explanation: "A reported EVM efficiency point, not a bounded loss model or production minimum.",
    },
    {
      id: "power.reference.tps54302evm716.load-regulation",
      measurand: "loadRegulation",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "reported_absolute_magnitude",
      value: q(0.005, "1"),
      range: null,
      conditions: [
        condition("inputVoltage", 12, 12, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 0, 3, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.loadRegulation,
      strictConstraintAuthority: false,
      explanation: "TI reports an EVM load-regulation magnitude over the stated sweep; it is not a guaranteed DC-output envelope for another BOM or board.",
    },
    {
      id: "power.reference.tps54302evm716.line-regulation",
      measurand: "lineRegulation",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "reported_absolute_magnitude",
      value: q(0.005, "1"),
      range: null,
      conditions: [
        condition("inputVoltage", 8, 28, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 1.5, 1.5, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.lineRegulation,
      strictConstraintAuthority: false,
      explanation: "TI reports an EVM line-regulation magnitude at the stated load; it is not a production guarantee.",
    },
    {
      id: "power.reference.tps54302evm716.output-ripple-full-load",
      measurand: "outputRipple",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "less_than",
      value: q(0.03, "V"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 3, 3, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.ripple,
      strictConstraintAuthority: false,
      explanation: "The performance summary reports less than 30 mV peak-to-peak for the exact EVM at full load; it does not bound the browser's 12 V, 0.2 A pulse-skipping point or production spread.",
    },
    {
      id: "power.reference.tps54302evm716.load-transient-rising",
      measurand: "loadTransientVoltage",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "reported_absolute_magnitude",
      value: q(0.15, "V"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 0.75, 0.75, "A"),
        condition("outputCurrentAfter", 2.25, 2.25, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.transient,
      strictConstraintAuthority: false,
      explanation: "The guide reports a 150 mV EVM transient observation for the stated 0.75 A to 2.25 A step.",
    },
    {
      id: "power.reference.tps54302evm716.load-transient-falling",
      measurand: "loadTransientVoltage",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "reported_absolute_magnitude",
      value: q(0.15, "V"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 2.25, 2.25, "A"),
        condition("outputCurrentAfter", 0.75, 0.75, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.transient,
      strictConstraintAuthority: false,
      explanation: "The guide reports a 150 mV EVM transient observation for the stated 2.25 A to 0.75 A step.",
    },
    {
      id: "power.reference.tps54302evm716.load-transient-recovery-rising",
      measurand: "loadTransientRecoveryTime",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "equals",
      value: q(150e-6, "s"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 0.75, 0.75, "A"),
        condition("outputCurrentAfter", 2.25, 2.25, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.transient,
      strictConstraintAuthority: false,
      explanation: "The guide reports a 150 us recovery observation for the stated 0.75 A to 2.25 A step.",
    },
    {
      id: "power.reference.tps54302evm716.load-transient-recovery-falling",
      measurand: "loadTransientRecoveryTime",
      evidenceRole: "manufacturer_evaluation_module_typical_observation",
      relation: "equals",
      value: q(150e-6, "s"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 2.25, 2.25, "A"),
        condition("outputCurrentAfter", 0.75, 0.75, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
      sourceLocator: SOURCE_LOCATORS.transient,
      strictConstraintAuthority: false,
      explanation: "The guide reports a 150 us recovery observation for the stated 2.25 A to 0.75 A step.",
    },
  ],
  limitations: [
    "The source reports evaluation-module ranges and typical measurements, not guaranteed production-population limits.",
    "A caller can assert the published reference-design, assembly, BOM, and layout identity tokens, but no physical-assembly or measurement attestation is present.",
    "Condition-relevant observations remain published-reference comparisons only and have no application authority for a caller's board.",
    "The BOM identifies U1 as TPS54302DDC, not the orderable TPS54302DDCR identity used by the installed production candidate.",
    "The BOM uses Wurth Elektronik 7447714100 at 10 uH, not Bel Fuse F1F2-0804-2R2M at 2.2 uH.",
    "No passive effective-capacitance, DC-bias, ESR, inductor corner, protection-dynamic, loop-margin, loss-corner, or board thermal guarantee is extracted.",
    "No selected-part executable model, candidate eligibility, sourcing, provider, or release authority is granted.",
  ],
} satisfies PowerReferenceDesignEvidencePayloadV1;

export const TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1: DeepReadonly<PowerReferenceDesignEvidenceV1> =
  deepFreeze({
    ...payload,
    contentHash: calculatePowerReferenceDesignEvidenceContentHashV1(payload),
  });
