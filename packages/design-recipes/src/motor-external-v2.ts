import {
  calculateDesignBlockContentHash,
  type CircuitComponentV2,
  type CircuitDocumentV2,
  type DesignBlockDefinition,
} from "@opencircuit/circuit-schema";
import {
  FACTS_SCHEMA_VERSION_V2,
  FACTS_SCHEMA_VERSION_V3,
  FACTS_SCHEMA_VERSION_V31,
  canonicalProfileNumberV2,
  designProfileEnvelopeContentHash,
  designProfileId,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  parseDesignProfileForV3,
  parseDesignProfileForV31,
  type DesignProfileV3,
  type DesignProfileV31,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type PartClassId,
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

const RELEASE_V2 = {
  id: "motor.native.external-nmos-h-bridge.facts-v2",
  version: "2.0.0",
  equations: [
    "motor.external.facts-v2.direct-profile-limits.v1",
    "motor.external.facts-v2.enumeration-preflight.v1",
    "motor.external.facts-v2.mounted-geometry-ranking-proxy.v1",
    "motor.external.facts-v2.static-bom-binding.v1",
  ],
} as const;

const RELEASE_V3 = {
  id: "motor.native.external-nmos-h-bridge.facts-v3",
  version: "3.0.0",
  equations: [
    "motor.external.facts-v3.direct-profile-limits.v1",
    "motor.external.facts-v3.enumeration-preflight.v1",
    "motor.external.facts-v3.mounted-geometry-ranking-proxy.v1",
    "motor.external.facts-v3.static-bom-binding.v1",
  ],
} as const;

const RELEASE_V31 = {
  id: "motor.native.external-nmos-h-bridge.facts-v3-1",
  version: "3.1.1",
  equations: [
    "motor.external.facts-v3-1.architecture-aware-direct-profile-limits.v1",
    "motor.external.facts-v3-1.enumeration-preflight.v1",
    "motor.external.facts-v3-1.guaranteed-timing-role-gate.v2",
    "motor.external.facts-v3-1.mounted-geometry-ranking-proxy.v1",
    "motor.external.facts-v3-1.connected-structural-bom-binding.v1",
    "motor.external.facts-v3-1.request-derived-operating-point-companion.v1",
    "motor.external.facts-v3-1.unknown-feasibility-preservation.v1",
  ],
} as const;

const RELEASE_V31_ROLE_QUALIFIED = {
  id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
  version: "3.1.2",
  equations: [
    "motor.external.facts-v3-1-role-qualified.architecture-aware-direct-profile-limits.v1",
    "motor.external.facts-v3-1-role-qualified.enumeration-preflight.v1",
    "motor.external.facts-v3-1-role-qualified.exact-bom-role-binding.v1",
    "motor.external.facts-v3-1-role-qualified.guaranteed-timing-role-gate.v2",
    "motor.external.facts-v3-1-role-qualified.mounted-geometry-ranking-proxy.v1",
    "motor.external.facts-v3-1-role-qualified.connected-structural-bom-binding.v1",
    "motor.external.facts-v3-1-role-qualified.request-derived-operating-point-companion.v1",
    "motor.external.facts-v3-1-role-qualified.resistor-role-qualification.v1",
    "motor.external.facts-v3-1-role-qualified.unknown-feasibility-preservation.v1",
  ],
  resistorRoleBindings: {
    seriesGate: {
      status: "blocked_no_reviewed_pulse_or_drive_evidence",
      profiles: [],
    },
    pulldown: {
      status: "exact_reviewed_static_role",
      resistanceOhm: 100_000,
      profiles: [
        {
          manufacturerId: "bourns",
          manufacturerPartNumber: "CR0603-FX-1003ELF",
          profileContentHash: "sha256:f8f0024c6aae02286d1c614a44edb107cc33486b18fc02e94574d1777973257e",
        },
        {
          manufacturerId: "panasonic-industry",
          manufacturerPartNumber: "ERJ3EKF1003V",
          profileContentHash: "sha256:56f2022018a349a1bd48bf60804aa6147967fc3173e5ffea78d001a0c162e0a1",
        },
        {
          manufacturerId: "vishay-intertechnology",
          manufacturerPartNumber: "CRCW0603100KFKEA",
          profileContentHash: "sha256:f0320c991d8cf882396657e8d0b23aa3c8253b7d7be16f3aff6a29a15a6b83a0",
        },
      ],
    },
  },
} as const;

const RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED = {
  ...RELEASE_V31_ROLE_QUALIFIED,
  version: "3.1.3",
  resistorRoleBindings: {
    seriesGate: RELEASE_V31_ROLE_QUALIFIED.resistorRoleBindings.seriesGate,
    pulldown: {
      ...RELEASE_V31_ROLE_QUALIFIED.resistorRoleBindings.pulldown,
      profiles: [
        {
          manufacturerId: "bourns",
          manufacturerPartNumber: "CR0603-FX-1003ELF",
          profileContentHash: "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6",
        },
        RELEASE_V31_ROLE_QUALIFIED.resistorRoleBindings.pulldown.profiles[1],
        RELEASE_V31_ROLE_QUALIFIED.resistorRoleBindings.pulldown.profiles[2],
      ],
    },
  },
} as const;

export const MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_PROFILE_CONTENT_HASH =
  "sha256:1fd9a7097dd7359f39cfd1fa285671d830ba9e544d16e37a34d28854efbb2f47" as const;

export const MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH =
  "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135" as const;

export const MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_URL =
  "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-85V-Full-Bridge-MOSFET-Drivers-with-Adaptive-Dead-Time-and-Shoot-Through-Protection-DS20005604.pdf" as const;

const MIC4606_DIRECT_GATE_EVIDENCE: EvidenceRef = {
  sourceId: "microchip-mic4606-ds20005604h",
  locator: "physical PDF page 20, section 7.1 and Figure 7-1: high-side xHO external damping resistor RG is optional and increases MOSFET turn-off delay; physical PDF page 21, section 7.1, MIC4606-2 adaptive dead time: an external resistor between xLO and the MOSFET may affect xLO monitoring performance and is not recommended",
  retrievedAt: "2026-08-26T01:11:06Z",
  contentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
  licenseNote: "Manufacturer-published factual data referenced by URL; the source document is not redistributed.",
};

const MIC4606_CAPACITOR_ROLE_EVIDENCE: EvidenceRef = {
  sourceId: "microchip-mic4606-ds20005604h",
  locator: "physical PDF pages 25-26, section 7.10: ceramic decoupling capacitors are required; each bootstrap capacitor CB must be at least 0.1 uF and the VDD capacitor must be at least 1 uF regardless of MOSFET; X5R capacitance can fall 40-70% at rated voltage; recommended dVHB is below 0.1 V; CB >= QGATE/dVHB and CB >= IHBS*tON/dVHB with the larger result selected; capacitors should be close to the IC with short, wide traces",
  retrievedAt: "2026-08-26T01:11:06Z",
  contentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
  licenseNote: "Manufacturer-published factual data referenced by URL; the source document is not redistributed.",
};

const RELEASE_V31_DIRECT_GATE = {
  ...RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED,
  version: "3.1.4",
  predecessor: {
    id: RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED.id,
    version: RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED.version,
    contentHash: "sha256:8fc5d70793b391cc7d67746f6d7a413a6f08574688c9294fda634858a17d8c1a",
  },
  equations: [
    ...RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED.equations,
    "motor.external.facts-v3-1-role-qualified.exact-driver-direct-gate-structure.v1",
  ],
  resistorRoleBindings: {
    seriesGate: {
      status: "omitted_for_exact_driver_direct_connection",
      profiles: [],
    },
    pulldown: RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED.resistorRoleBindings.pulldown,
  },
  directGateDriverBinding: {
    role: "full-bridge-gate-driver",
    partClass: "motor.full-bridge-gate-driver",
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V31,
    manufacturerId: "microchip-technology",
    manufacturerPartNumber: "MIC4606-2YML-T5",
    profileContentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_PROFILE_CONTENT_HASH,
    source: {
      sourceId: MIC4606_DIRECT_GATE_EVIDENCE.sourceId,
      contentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
      url: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_URL,
      revision: "DS20005604H, 2017-2025",
      retrievedAt: MIC4606_DIRECT_GATE_EVIDENCE.retrievedAt,
      locator: MIC4606_DIRECT_GATE_EVIDENCE.locator,
    },
    structuralConnections: [
      {
        outputRole: "high-side-xHO",
        selectedConnection: "direct",
        externalDampingResistor: "optional_unselected",
        documentedConsequence: "increases_mosfet_turn_off_delay",
      },
      {
        outputRole: "low-side-xLO",
        selectedConnection: "direct",
        externalSeriesResistor: "not_recommended_unselected",
        documentedConsequence: "may_affect_xlo_monitoring_performance",
      },
    ],
    nonclaims: [
      "series_gate_resistor_value",
      "switching_behavior",
      "dv_dt",
      "miller_immunity",
      "shoot_through_prevention",
      "physical_gate_network_feasibility",
      "package_pin_mapping",
      "selected_part_scenario_or_simulation_fidelity",
    ],
  },
} as const;

const RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED = {
  ...RELEASE_V31_DIRECT_GATE,
  version: "3.1.5",
  predecessor: {
    id: RELEASE_V31_DIRECT_GATE.id,
    version: RELEASE_V31_DIRECT_GATE.version,
    contentHash: "sha256:c8145e32480a29e0d9d008ac7e73ff73f9b93cb08aa2f7f0919f199af4955d84",
  },
  equations: [
    ...RELEASE_V31_DIRECT_GATE.equations,
    "motor.external.facts-v3-1-role-qualified.exact-driver-capacitor-role-binding.v1",
  ],
  capacitorRoleBindings: {
    construction: "ceramic_mlcc_by_part_class",
    qualifiedProfiles: [
      {
        manufacturerId: "murata-manufacturing",
        manufacturerPartNumber: "GRM31CR61H106KA12L",
        profileContentHash: "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
      },
      {
        manufacturerId: "samsung-electro-mechanics",
        manufacturerPartNumber: "CL31A106KBHNNNE",
        profileContentHash: "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
      },
      {
        manufacturerId: "tdk-corporation",
        manufacturerPartNumber: "C3216X7R1H106K160AC",
        profileContentHash: "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
      },
    ],
    bootstrap: {
      dataKey: "bootstrapProfileId",
      partClass: "shared.mlcc-capacitor",
      quantityPerAssembly: 2,
      documentedNominalMinimumF: 0.1e-6,
      selectionComparison: "strictly_above_documented_minimum_because_profile_has_no_tolerance_floor",
    },
    local: {
      dataKey: "localProfileId",
      partClass: "shared.mlcc-capacitor",
      quantityPerAssembly: 1,
      documentedNominalMinimumF: 1e-6,
      selectionComparison: "strictly_above_documented_minimum_because_profile_has_no_tolerance_floor",
    },
    source: {
      sourceId: MIC4606_CAPACITOR_ROLE_EVIDENCE.sourceId,
      contentHash: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_CONTENT_HASH,
      url: MOTOR_EXTERNAL_V31_DIRECT_GATE_MIC4606_SOURCE_URL,
      revision: "DS20005604H, March 2025",
      retrievedAt: MIC4606_CAPACITOR_ROLE_EVIDENCE.retrievedAt,
      locator: MIC4606_CAPACITOR_ROLE_EVIDENCE.locator,
    },
    nonclaims: [
      "bootstrap_effective_capacitance",
      "bootstrap_charge_adequacy",
      "bootstrap_bias_temperature_leakage_or_refresh_adequacy",
      "local_effective_capacitance_or_voltage_adequacy",
      "bulk_capacitance_adequacy",
      "capacitor_placement_or_interconnect_feasibility",
      "qgate_or_ihbs_ton_equation_closure",
      "gate_network_or_switching_behavior",
      "selected_part_scenario_or_simulation_fidelity",
    ],
  },
} as const;

const RELEASE_V31_INTERFACE_QUALIFIED = {
  ...RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED,
  version: "3.1.6",
  predecessor: {
    id: RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.id,
    version: RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.version,
    contentHash: "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187",
  },
  equations: [
    ...RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.equations,
    "motor.external.facts-v3-1-role-qualified.interface-qualified-driver-voltage-limits.v1",
  ],
} as const;

export const MOTOR_EXTERNAL_V31_TVS_PROFILE_CONTENT_HASH =
  "sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474" as const;

export const MOTOR_EXTERNAL_V31_TVS_SOURCE_CONTENT_HASH =
  "sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24" as const;

export const MOTOR_EXTERNAL_V31_TVS_SOURCE_URL =
  "https://www.diodes.com/datasheet/download/ds40742.pdf" as const;

const DIODES_3_0SMCJ33CAQ_TVS_BINDING = {
  role: "supply-tvs",
  partClass: "motor.supply-tvs-diode",
  factsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
  manufacturerId: "diodes-incorporated",
  manufacturerPartNumber: "3.0SMCJ33CAQ",
  profileContentHash: MOTOR_EXTERNAL_V31_TVS_PROFILE_CONTENT_HASH,
  source: {
    sourceId: "diodes-incorporated-3-0smcj-automotive-ds40742",
    contentHash: MOTOR_EXTERNAL_V31_TVS_SOURCE_CONTENT_HASH,
    url: MOTOR_EXTERNAL_V31_TVS_SOURCE_URL,
    revision: "DS40742 Rev. 12 - 2, May 2025",
    retrievedAt: "2026-08-26T01:21:37Z",
    locator: "physical PDF page 2, Electrical Characteristics: 3.0SMCJ33(C)AQ VRWM = 33.0 V and maximum VC = 53.3 V at IPP = 56.3 A; note 11 binds VC and IPP to the non-repetitive 10 x 1000 us waveform in Figure 4; electrical characteristics are stated at TA = 25 C",
  },
  staticVoltageEnvelope: {
    standOffVoltageV: 33,
    clampingVoltageMaximumV: 53.3,
    clampingCurrentA: 56.3,
    waveform: "non_repetitive_10x1000_us",
    ambientTemperatureK: 298.15,
  },
  nonclaims: [
    "application_transient_current",
    "application_transient_waveform",
    "pulse_energy",
    "tvs_coordination",
    "mosfet_avalanche_or_soa",
    "wiring_overshoot_or_parasitics",
    "thermal_suitability",
    "selected_part_scenario_or_simulation_fidelity",
    "sourcing_or_orderability",
  ],
} as const;

const RELEASE_V31_TVS_VOLTAGE_QUALIFIED = {
  ...RELEASE_V31_INTERFACE_QUALIFIED,
  version: "3.1.7",
  predecessor: {
    id: RELEASE_V31_INTERFACE_QUALIFIED.id,
    version: RELEASE_V31_INTERFACE_QUALIFIED.version,
    contentHash: "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320",
  },
  equations: [
    ...RELEASE_V31_INTERFACE_QUALIFIED.equations,
    "motor.external.facts-v3-1-role-qualified.exact-supply-tvs-static-voltage-binding.v1",
    "motor.external.facts-v3-1-role-qualified.tvs-stand-off-ambient-condition-gate.v1",
  ],
  supplyTvsBinding: DIODES_3_0SMCJ33CAQ_TVS_BINDING,
} as const;

const REQUIRED_CLASSES = [
  "motor.full-bridge-gate-driver",
  "motor.supply-tvs-diode",
  "shared.bulk-capacitor",
  "shared.current-sense-resistor",
  "shared.general-purpose-resistor",
  "shared.mlcc-capacitor",
  "shared.n-channel-power-mosfet",
] as const;

const METRIC_DECLARATIONS = [
  { id: "motor.native.board-area", unit: "m2" as const },
  { id: "motor.native.component-count", unit: "count" as const },
] as const;

type RequiredClass = typeof REQUIRED_CLASSES[number];
type ProfileV2<ClassId extends PartClassId> = DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>;
type DriverProfileV2 = ProfileV2<"motor.full-bridge-gate-driver">;
type DriverProfile = DriverProfileV2 | DesignProfileV31<"motor.full-bridge-gate-driver">;
type TvsProfile = ProfileV2<"motor.supply-tvs-diode"> | DesignProfileV3<"motor.supply-tvs-diode">;
type BulkProfile = ProfileV2<"shared.bulk-capacitor">;
type SenseProfile = ProfileV2<"shared.current-sense-resistor">;
type ResistorProfile = ProfileV2<"shared.general-purpose-resistor">;
type MlccProfile = ProfileV2<"shared.mlcc-capacitor">;
type MosfetProfile = ProfileV2<"shared.n-channel-power-mosfet"> | DesignProfileV3<"shared.n-channel-power-mosfet">;
type ExternalProfile = DriverProfile | TvsProfile | BulkProfile | SenseProfile | ResistorProfile | MlccProfile | MosfetProfile;

type RequiredProfile<ClassId extends RequiredClass> =
  ClassId extends "motor.full-bridge-gate-driver" ? DriverProfile
    : ClassId extends "motor.supply-tvs-diode" ? TvsProfile
      : ClassId extends "shared.bulk-capacitor" ? BulkProfile
        : ClassId extends "shared.current-sense-resistor" ? SenseProfile
          : ClassId extends "shared.general-purpose-resistor" ? ResistorProfile
            : ClassId extends "shared.mlcc-capacitor" ? MlccProfile
              : MosfetProfile;

type ExternalFactsVersion = typeof FACTS_SCHEMA_VERSION_V2 | typeof FACTS_SCHEMA_VERSION_V3 | typeof FACTS_SCHEMA_VERSION_V31;

interface ExternalRecipeContract {
  release: typeof RELEASE_V2 | typeof RELEASE_V3 | typeof RELEASE_V31 | typeof RELEASE_V31_ROLE_QUALIFIED | typeof RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED | typeof RELEASE_V31_DIRECT_GATE | typeof RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED | typeof RELEASE_V31_INTERFACE_QUALIFIED | typeof RELEASE_V31_TVS_VOLTAGE_QUALIFIED;
  profileVersions: Readonly<Record<RequiredClass, ExternalFactsVersion>>;
  optionNamespace: "motor-external-v2" | "motor-external-v3" | "motor-external-v3-1" | "motor-external-v3-1-role-qualified";
  profileLabel: "facts-V2" | "mixed facts-V2/V3" | "mixed facts-V2/V3/V3.1" | "role-qualified mixed facts-V2/V3/V3.1";
  resistorRoles: "shared_generic_profiles" | "exact_role_qualified_profiles";
  exactResistorRoleBindings: typeof RELEASE_V31_ROLE_QUALIFIED.resistorRoleBindings | typeof RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED.resistorRoleBindings | typeof RELEASE_V31_DIRECT_GATE.resistorRoleBindings | null;
  directGateDriverBinding: typeof RELEASE_V31_DIRECT_GATE.directGateDriverBinding | null;
  capacitorRoleBindings: typeof RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.capacitorRoleBindings | null;
  supplyTvsBinding: typeof DIODES_3_0SMCJ33CAQ_TVS_BINDING | null;
  driverVoltageSemantics: "legacy_supply_projection" | "bridge_interface_qualified";
}

const EXTERNAL_RECIPE_V2: ExternalRecipeContract = {
  release: RELEASE_V2,
  profileVersions: Object.fromEntries(REQUIRED_CLASSES.map((partClass) => [partClass, FACTS_SCHEMA_VERSION_V2])) as Record<RequiredClass, typeof FACTS_SCHEMA_VERSION_V2>,
  optionNamespace: "motor-external-v2",
  profileLabel: "facts-V2",
  resistorRoles: "shared_generic_profiles",
  exactResistorRoleBindings: null,
  directGateDriverBinding: null,
  capacitorRoleBindings: null,
  supplyTvsBinding: null,
  driverVoltageSemantics: "legacy_supply_projection",
};

const EXTERNAL_RECIPE_V3: ExternalRecipeContract = {
  release: RELEASE_V3,
  profileVersions: {
    "motor.full-bridge-gate-driver": FACTS_SCHEMA_VERSION_V2,
    "motor.supply-tvs-diode": FACTS_SCHEMA_VERSION_V3,
    "shared.bulk-capacitor": FACTS_SCHEMA_VERSION_V2,
    "shared.current-sense-resistor": FACTS_SCHEMA_VERSION_V2,
    "shared.general-purpose-resistor": FACTS_SCHEMA_VERSION_V2,
    "shared.mlcc-capacitor": FACTS_SCHEMA_VERSION_V2,
    "shared.n-channel-power-mosfet": FACTS_SCHEMA_VERSION_V3,
  },
  optionNamespace: "motor-external-v3",
  profileLabel: "mixed facts-V2/V3",
  resistorRoles: "shared_generic_profiles",
  exactResistorRoleBindings: null,
  directGateDriverBinding: null,
  capacitorRoleBindings: null,
  supplyTvsBinding: null,
  driverVoltageSemantics: "legacy_supply_projection",
};

const EXTERNAL_RECIPE_V31: ExternalRecipeContract = {
  release: RELEASE_V31,
  profileVersions: {
    "motor.full-bridge-gate-driver": FACTS_SCHEMA_VERSION_V31,
    "motor.supply-tvs-diode": FACTS_SCHEMA_VERSION_V3,
    "shared.bulk-capacitor": FACTS_SCHEMA_VERSION_V2,
    "shared.current-sense-resistor": FACTS_SCHEMA_VERSION_V2,
    "shared.general-purpose-resistor": FACTS_SCHEMA_VERSION_V2,
    "shared.mlcc-capacitor": FACTS_SCHEMA_VERSION_V2,
    "shared.n-channel-power-mosfet": FACTS_SCHEMA_VERSION_V3,
  },
  optionNamespace: "motor-external-v3-1",
  profileLabel: "mixed facts-V2/V3/V3.1",
  resistorRoles: "shared_generic_profiles",
  exactResistorRoleBindings: null,
  directGateDriverBinding: null,
  capacitorRoleBindings: null,
  supplyTvsBinding: null,
  driverVoltageSemantics: "legacy_supply_projection",
};

const EXTERNAL_RECIPE_V31_ROLE_QUALIFIED: ExternalRecipeContract = {
  release: RELEASE_V31_ROLE_QUALIFIED,
  profileVersions: {
    "motor.full-bridge-gate-driver": FACTS_SCHEMA_VERSION_V31,
    "motor.supply-tvs-diode": FACTS_SCHEMA_VERSION_V3,
    "shared.bulk-capacitor": FACTS_SCHEMA_VERSION_V2,
    "shared.current-sense-resistor": FACTS_SCHEMA_VERSION_V2,
    "shared.general-purpose-resistor": FACTS_SCHEMA_VERSION_V2,
    "shared.mlcc-capacitor": FACTS_SCHEMA_VERSION_V2,
    "shared.n-channel-power-mosfet": FACTS_SCHEMA_VERSION_V3,
  },
  optionNamespace: "motor-external-v3-1-role-qualified",
  profileLabel: "role-qualified mixed facts-V2/V3/V3.1",
  resistorRoles: "exact_role_qualified_profiles",
  exactResistorRoleBindings: RELEASE_V31_ROLE_QUALIFIED.resistorRoleBindings,
  directGateDriverBinding: null,
  capacitorRoleBindings: null,
  supplyTvsBinding: null,
  driverVoltageSemantics: "legacy_supply_projection",
};

const EXTERNAL_RECIPE_V31_ROLE_QUALIFIED_BINDING_REFRESHED: ExternalRecipeContract = {
  ...EXTERNAL_RECIPE_V31_ROLE_QUALIFIED,
  release: RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED,
  exactResistorRoleBindings: RELEASE_V31_ROLE_QUALIFIED_BINDING_REFRESHED.resistorRoleBindings,
};

const EXTERNAL_RECIPE_V31_DIRECT_GATE: ExternalRecipeContract = {
  ...EXTERNAL_RECIPE_V31_ROLE_QUALIFIED_BINDING_REFRESHED,
  release: RELEASE_V31_DIRECT_GATE,
  exactResistorRoleBindings: RELEASE_V31_DIRECT_GATE.resistorRoleBindings,
  directGateDriverBinding: RELEASE_V31_DIRECT_GATE.directGateDriverBinding,
};

const EXTERNAL_RECIPE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED: ExternalRecipeContract = {
  ...EXTERNAL_RECIPE_V31_DIRECT_GATE,
  release: RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED,
  capacitorRoleBindings: RELEASE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED.capacitorRoleBindings,
};

const EXTERNAL_RECIPE_V31_INTERFACE_QUALIFIED: ExternalRecipeContract = {
  ...EXTERNAL_RECIPE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED,
  release: RELEASE_V31_INTERFACE_QUALIFIED,
  driverVoltageSemantics: "bridge_interface_qualified",
};

const EXTERNAL_RECIPE_V31_TVS_VOLTAGE_QUALIFIED: ExternalRecipeContract = {
  ...EXTERNAL_RECIPE_V31_INTERFACE_QUALIFIED,
  release: RELEASE_V31_TVS_VOLTAGE_QUALIFIED,
  supplyTvsBinding: RELEASE_V31_TVS_VOLTAGE_QUALIFIED.supplyTvsBinding,
};

function canon(value: number): number {
  const design = canonicalDesignV2Number(value);
  const profile = canonicalProfileNumberV2(value);
  if (design !== profile) throw new Error("Design and profile V2 canonical arithmetic diverged");
  return design;
}

function motorRequest(environment: Readonly<NativeEnvironmentV2>): Readonly<BrushedDcMotorDesignRequestV2> {
  if (environment.request.application !== "motor.brushed-dc") throw new TypeError("External-NMOS facts-V2 recipe requires a motor.brushed-dc request");
  return environment.request;
}

function profilesForContract<ClassId extends RequiredClass>(
  catalog: Readonly<NativeCatalogV2>,
  partClass: ClassId,
  contract: Readonly<ExternalRecipeContract>,
): RequiredProfile<ClassId>[] {
  const factsSchemaVersion = contract.profileVersions[partClass];
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) {
    const codec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V2);
    return catalog.profiles
      .filter((profile) => profile.partClass === partClass && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2)
      .map((profile) => parseDesignProfileForV2(codec, profile))
      .map((profile) => {
        const issue = codec.validateAdmission(profile)[0];
        if (issue) throw new TypeError(`Invalid admitted facts-V2 ${partClass} profile: ${issue.path}: ${issue.message}`);
        return profile;
      })
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part))) as unknown as RequiredProfile<ClassId>[];
  }
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V31) {
    if (partClass !== "motor.full-bridge-gate-driver") {
      throw new TypeError(`Facts-V3.1 is unsupported for ${partClass}`);
    }
    const codec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V31);
    return catalog.profiles
      .filter((profile) => profile.partClass === partClass && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V31)
      .map((profile) => parseDesignProfileForV31(codec, profile))
      .map((profile) => {
        const issue = codec.validateAdmission(profile)[0];
        if (issue) throw new TypeError(`Invalid admitted facts-V3.1 ${partClass} profile: ${issue.path}: ${issue.message}`);
        return profile;
      })
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part))) as RequiredProfile<ClassId>[];
  }
  if (partClass !== "shared.n-channel-power-mosfet" && partClass !== "motor.supply-tvs-diode") {
    throw new TypeError(`Facts-V3 is unsupported for ${partClass}`);
  }
  const codec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V3);
  return catalog.profiles
    .filter((profile) => profile.partClass === partClass && profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V3)
    .map((profile) => parseDesignProfileForV3(codec, profile))
    .map((profile) => {
      const issue = codec.validateAdmission(profile)[0];
      if (issue) throw new TypeError(`Invalid admitted facts-V3 ${partClass} profile: ${issue.path}: ${issue.message}`);
      return profile;
    })
    .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part))) as RequiredProfile<ClassId>[];
}

function supplyTvsProfilesForContract(
  catalog: Readonly<NativeCatalogV2>,
  contract: Readonly<ExternalRecipeContract>,
): TvsProfile[] {
  const profiles = profilesForContract(catalog, "motor.supply-tvs-diode", contract);
  const binding = contract.supplyTvsBinding;
  if (binding === null) return profiles;
  return profiles.filter((profile) => (
    profile.partClass === binding.partClass
    && profile.factsSchemaVersion === binding.factsSchemaVersion
    && profile.part.manufacturerId === binding.manufacturerId
    && profile.part.manufacturerPartNumber === binding.manufacturerPartNumber
    && designProfileEnvelopeContentHash(profile) === binding.profileContentHash
  ));
}

function profileId(profile: ExternalProfile): string {
  return designProfileId(profile.partClass, profile.part);
}

function usesDirectGateConnection(contract: Readonly<ExternalRecipeContract>): boolean {
  return contract.directGateDriverBinding !== null;
}

function profileMatchesDirectGateDriverBinding(
  profile: Readonly<DriverProfile>,
  contract: Readonly<ExternalRecipeContract>,
): boolean {
  const binding = contract.directGateDriverBinding;
  return binding !== null
    && profile.partClass === binding.partClass
    && profile.factsSchemaVersion === binding.factsSchemaVersion
    && profile.part.manufacturerId === binding.manufacturerId
    && profile.part.manufacturerPartNumber === binding.manufacturerPartNumber
    && designProfileEnvelopeContentHash(profile) === binding.profileContentHash;
}

type CapacitorRole = "bootstrap" | "local";

function usesSplitCapacitorRoles(contract: Readonly<ExternalRecipeContract>): boolean {
  return contract.capacitorRoleBindings !== null;
}

function capacitorProfilesForRole(
  catalog: Readonly<NativeCatalogV2>,
  role: CapacitorRole,
  contract: Readonly<ExternalRecipeContract>,
): MlccProfile[] {
  const profiles = profilesForContract(catalog, "shared.mlcc-capacitor", contract);
  const bindings = contract.capacitorRoleBindings;
  if (bindings === null) return profiles;
  const binding = bindings[role];
  return profiles.filter((profile) => (
    profile.partClass === binding.partClass
    && bindings.qualifiedProfiles.some((qualified) => (
      profile.part.manufacturerId === qualified.manufacturerId
      && profile.part.manufacturerPartNumber === qualified.manufacturerPartNumber
      && designProfileEnvelopeContentHash(profile) === qualified.profileContentHash
    ))
    // Facts V2 has no capacitance-tolerance lower-bound field. Requiring
    // nameplate headroom conservatively rejects a nominal part exactly at the
    // manufacturer minimum without pretending to prove effective capacitance.
    && reviewedQuantity(profile.facts.nominalCapacitance, "F") > binding.documentedNominalMinimumF
  ));
}

function profileIsQualifiedForCapacitorRole(
  profile: Readonly<MlccProfile>,
  catalog: Readonly<NativeCatalogV2>,
  role: CapacitorRole,
  contract: Readonly<ExternalRecipeContract>,
): boolean {
  return capacitorProfilesForRole(catalog, role, contract)
    .some((qualified) => profileId(qualified) === profileId(profile));
}

type ResistorRole = "series-gate" | "pulldown";

interface ExactRoleQualifiedResistorBinding {
  manufacturerId: string;
  manufacturerPartNumber: string;
  profileContentHash: `sha256:${string}`;
}

/**
 * Role binding is narrower than electrical feasibility. The pull-down list
 * proves only an exact static BOM role/value identity; gate-network safety
 * remains the required unknown constraint below. In predecessors, the empty
 * series-gate list is intentional until pulse stress and driver compatibility
 * are reviewed. The exact-driver successor omits that BOM role entirely.
 */
function resistorProfilesForRole(
  catalog: Readonly<NativeCatalogV2>,
  role: ResistorRole,
  contract: Readonly<ExternalRecipeContract>,
): ResistorProfile[] {
  const profiles = profilesForContract(catalog, "shared.general-purpose-resistor", contract);
  if (contract.resistorRoles === "shared_generic_profiles") return profiles;
  const roleBindings = contract.exactResistorRoleBindings;
  if (roleBindings === null) throw new TypeError("Exact resistor-role qualification requires an immutable binding set");
  const bindings: readonly ExactRoleQualifiedResistorBinding[] = role === "series-gate"
    ? roleBindings.seriesGate.profiles
    : roleBindings.pulldown.profiles;
  return profiles.filter((profile) => bindings.some((binding) => (
    profile.part.manufacturerId === binding.manufacturerId
    && profile.part.manufacturerPartNumber === binding.manufacturerPartNumber
    && designProfileEnvelopeContentHash(profile) === binding.profileContentHash
    && (role !== "pulldown"
      || reviewedQuantity(profile.facts.resistance, "ohm") === roleBindings.pulldown.resistanceOhm)
  )));
}

function exactText(data: Readonly<Record<string, null | boolean | number | string>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function exactProfile<ClassId extends RequiredClass>(
  data: Readonly<Record<string, null | boolean | number | string>>,
  key: string,
  catalog: Readonly<NativeCatalogV2>,
  partClass: ClassId,
  contract: Readonly<ExternalRecipeContract>,
): RequiredProfile<ClassId> | undefined {
  const id = exactText(data, key);
  const profiles = partClass === "motor.supply-tvs-diode"
    ? supplyTvsProfilesForContract(catalog, contract)
    : profilesForContract(catalog, partClass, contract);
  return id === undefined
    ? undefined
    : profiles.find((profile) => designProfileId(profile.partClass, profile.part) === id) as RequiredProfile<ClassId> | undefined;
}

function quantity(value: number, unit: Quantity["unit"]): Quantity {
  return { value, unit, displayUnit: unit };
}

function reviewedQuantity<Unit extends ProfileUnit>(fact: ProfileFact<ProfileQuantity<Unit>>, unit: Unit): number {
  if (fact.state !== "reviewed" || fact.value === null || fact.value.unit !== unit) throw new TypeError(`Expected a reviewed ${unit} quantity`);
  return fact.value.value;
}

function reviewedText(fact: ProfileFact<string>): string {
  if (fact.state !== "reviewed" || fact.value === null) throw new TypeError("Expected reviewed text");
  return fact.value;
}

function requiresBootstrapCapacitor(fact: DriverProfile["facts"]["highSideSupply"]): boolean {
  if (fact.state !== "reviewed" || fact.value === null) throw new TypeError("Expected reviewed high-side supply classification");
  switch (fact.value) {
    case "bootstrap":
    case "bootstrap_with_charge_pump":
    case "bootstrap_with_top_off_charge_pump":
      return true;
    case "charge_pump":
      return false;
    default: {
      const unsupported: never = fact.value;
      throw new TypeError(`Unsupported high-side supply classification: ${String(unsupported)}`);
    }
  }
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

function isDriverV31(profile: DriverProfile): profile is DesignProfileV31<"motor.full-bridge-gate-driver"> {
  return profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V31;
}

function timingConstraintV31<Unit extends "Hz" | "s">(
  ruleId: string,
  fact: ProfileFact<ProfileQuantity<Unit>>,
  role: ProfileFact<string>,
  unit: Unit,
  actual: Quantity,
  direction: "at_least" | "at_most",
  factIsActual: boolean,
  context: Readonly<Record<string, Readonly<ProfileQuantity>>>,
  explanation: string,
): ConstraintResult {
  const evidence = [...factEvidence(fact), ...factEvidence(role)];
  if (fact.state !== "reviewed" || fact.value === null) {
    return unknownConstraint(ruleId, "No reviewed timing quantity is available for this constraint.", evidence);
  }
  if (role.state !== "reviewed" || role.value !== "guaranteed_bound") {
    return unknownConstraint(ruleId, "The reviewed timing quantity is not a guaranteed bound and cannot establish feasibility.", evidence);
  }
  if (!conditionsCover(fact, context) || !conditionsCover(role, context)) {
    return unknownConstraint(ruleId, "The reviewed timing quantity and its guaranteed-bound role do not both cover the declared operating conditions.", evidence);
  }
  const profileQuantity = quantity(fact.value.value, unit);
  return factIsActual
    ? limitConstraint(ruleId, profileQuantity, actual, direction, evidence, explanation)
    : limitConstraint(ruleId, actual, profileQuantity, direction, evidence, explanation);
}

function conditionsCover(
  fact: ProfileFact<unknown>,
  context: Readonly<Record<string, Readonly<ProfileQuantity>>>,
): boolean {
  return fact.validFor.every((condition) => {
    const actual = context[condition.parameterId];
    if (actual === undefined) return false;
    if (condition.minimum !== null && (condition.minimum.unit !== actual.unit || actual.value < condition.minimum.value)) return false;
    if (condition.maximum !== null && (condition.maximum.unit !== actual.unit || actual.value > condition.maximum.value)) return false;
    return true;
  });
}

function selected(
  id: string,
  role: string,
  profile: ExternalProfile,
  quantityPerAssembly: number,
  valueFact?: ProfileFact<ProfileQuantity>,
): SelectedComponent {
  const value = valueFact === undefined ? undefined : valueFact.value;
  if (valueFact !== undefined && (valueFact.state !== "reviewed" || value === null)) throw new TypeError(`Selected value ${id} must be reviewed`);
  const selectedValue = value === null ? undefined : value;
  return {
    id,
    role,
    profileId: profileId(profile),
    part: { ...profile.part },
    quantityPerAssembly,
    ...(selectedValue === undefined ? {} : { value: quantity(selectedValue.value, selectedValue.unit as Quantity["unit"]) }),
    evidence: projectedEvidence(valueFact?.evidence ?? profile.commonFacts.packageName.evidence),
  };
}

function profileIsQualifiedForResistorRole(
  profile: Readonly<ResistorProfile>,
  catalog: Readonly<NativeCatalogV2>,
  role: ResistorRole,
  contract: Readonly<ExternalRecipeContract>,
): boolean {
  return resistorProfilesForRole(catalog, role, contract)
    .some((qualified) => profileId(qualified) === profileId(profile));
}

function assertExactRoleQualifiedBom(
  components: readonly SelectedComponent[],
  data: Readonly<Record<string, null | boolean | number | string>>,
  catalog: Readonly<NativeCatalogV2>,
  contract: Readonly<ExternalRecipeContract>,
): void {
  if (contract.resistorRoles !== "exact_role_qualified_profiles") return;
  const directGate = usesDirectGateConnection(contract);
  const driver = exactProfile(data, "driverProfileId", catalog, "motor.full-bridge-gate-driver", contract);
  const mosfet = exactProfile(data, "mosfetProfileId", catalog, "shared.n-channel-power-mosfet", contract);
  const sense = exactProfile(data, "senseProfileId", catalog, "shared.current-sense-resistor", contract);
  const gate = directGate ? undefined : exactProfile(data, "gateResistorProfileId", catalog, "shared.general-purpose-resistor", contract);
  const pulldown = exactProfile(data, "pulldownProfileId", catalog, "shared.general-purpose-resistor", contract);
  const local = exactProfile(data, "localProfileId", catalog, "shared.mlcc-capacitor", contract);
  const bootstrap = usesSplitCapacitorRoles(contract)
    ? exactProfile(data, "bootstrapProfileId", catalog, "shared.mlcc-capacitor", contract)
    : local;
  const bulk = exactProfile(data, "bulkProfileId", catalog, "shared.bulk-capacitor", contract);
  const tvs = exactProfile(data, "tvsProfileId", catalog, "motor.supply-tvs-diode", contract);
  if (!driver || !mosfet || !sense || (!directGate && !gate) || !pulldown || !bootstrap || !local || !bulk || !tvs) {
    throw new TypeError("Role-qualified external-NMOS BOM references an absent exact reviewed profile");
  }
  if (directGate && exactText(data, "gateResistorProfileId") !== undefined) {
    throw new TypeError("Exact-driver direct-gate BOM must not contain a series gate-resistor data binding");
  }
  if (directGate && !profileMatchesDirectGateDriverBinding(driver, contract)) {
    throw new TypeError("Exact-driver direct-gate BOM requires the hash-bound MIC4606-2YML-T5 profile");
  }
  if (usesSplitCapacitorRoles(contract)) {
    if (!profileIsQualifiedForCapacitorRole(bootstrap, catalog, "bootstrap", contract)) {
      throw new TypeError("Exact-driver bootstrap capacitor binding is absent, swapped, or below the conservative reviewed nameplate floor");
    }
    if (!profileIsQualifiedForCapacitorRole(local, catalog, "local", contract)) {
      throw new TypeError("Exact-driver VDD-local capacitor binding is absent, swapped, or below the conservative reviewed nameplate floor");
    }
  }
  const bootstrapRequired = requiresBootstrapCapacitor(driver.facts.highSideSupply);
  if (data.bootstrapRequired !== bootstrapRequired) {
    throw new TypeError("Role-qualified external-NMOS BOM bootstrap presence disagrees with the exact driver profile");
  }
  const expected = [
    { id: "bulk-capacitor", role: "supply-bulk-capacitor", profile: bulk, quantityPerAssembly: 1, valueFact: bulk.facts.nominalCapacitance },
    ...(bootstrapRequired ? [{ id: "bootstrap-capacitor", role: "bootstrap-capacitor", profile: bootstrap, quantityPerAssembly: 2, valueFact: bootstrap.facts.nominalCapacitance }] : []),
    { id: "current-sense-resistor", role: "current-sense-resistor", profile: sense, quantityPerAssembly: 1, valueFact: sense.facts.resistance },
    { id: "driver", role: "full-bridge-gate-driver", profile: driver, quantityPerAssembly: 1 },
    ...(directGate ? [] : [{ id: "gate-resistor", role: "mosfet-gate-resistor", profile: gate!, quantityPerAssembly: 4, valueFact: gate!.facts.resistance }]),
    { id: "local-decoupling", role: "driver-local-decoupling-capacitor", profile: local, quantityPerAssembly: 1, valueFact: local.facts.nominalCapacitance },
    { id: "mosfet", role: "bridge-n-channel-power-mosfet", profile: mosfet, quantityPerAssembly: 4 },
    { id: "pulldown-resistor", role: "mosfet-gate-source-pulldown-resistor", profile: pulldown, quantityPerAssembly: 4, valueFact: pulldown.facts.resistance },
    { id: "supply-tvs", role: "motor-supply-tvs-diode", profile: tvs, quantityPerAssembly: 1 },
  ] satisfies Array<{
    id: string;
    role: string;
    profile: ExternalProfile;
    quantityPerAssembly: number;
    valueFact?: ProfileFact<ProfileQuantity>;
  }>;
  if (components.length !== expected.length || new Set(components.map((component) => component.id)).size !== expected.length) {
    throw new TypeError("Role-qualified external-NMOS materialization requires the exact selected BOM IDs");
  }
  for (const binding of expected) {
    const component = components.find((candidate) => candidate.id === binding.id);
    if (
      component === undefined
      || component.role !== binding.role
      || component.profileId !== profileId(binding.profile)
      || component.part.manufacturerId !== binding.profile.part.manufacturerId
      || component.part.manufacturerPartNumber !== binding.profile.part.manufacturerPartNumber
      || component.quantityPerAssembly !== binding.quantityPerAssembly
    ) {
      throw new TypeError(`Role-qualified external-NMOS BOM binding drifted for ${binding.id}`);
    }
    if (binding.valueFact === undefined) {
      if (component.value !== undefined) throw new TypeError(`Role-qualified external-NMOS BOM ${binding.id} must not invent a value`);
      continue;
    }
    const reviewed = binding.valueFact.value;
    if (
      binding.valueFact.state !== "reviewed"
      || reviewed === null
      || component.value === undefined
      || component.value.value !== reviewed.value
      || component.value.unit !== reviewed.unit
      || component.value.displayUnit !== reviewed.unit
    ) {
      throw new TypeError(`Role-qualified external-NMOS BOM value drifted for ${binding.id}`);
    }
  }
  if (!directGate && !profileIsQualifiedForResistorRole(gate!, catalog, "series-gate", contract)) {
    throw new TypeError("No exact reviewed series-gate resistor profile has the pulse and driver evidence required for physical role binding");
  }
  if (!profileIsQualifiedForResistorRole(pulldown, catalog, "pulldown", contract)) {
    throw new TypeError("The physical gate-source pull-down must bind one exact reviewed 100 kΩ role-qualified profile");
  }
}

function optionKey(data: Readonly<Record<string, string>>, contract: Readonly<ExternalRecipeContract>): string {
  return `${contract.optionNamespace}:${designSha256ContentHash(canonicalDesignV2Payload(data))}`;
}

function preflight(
  groups: Readonly<Record<RequiredClass, readonly ExternalProfile[]>>,
  seriesGateProfiles: readonly ResistorProfile[],
  pulldownProfiles: readonly ResistorProfile[],
  bootstrapProfiles: readonly MlccProfile[],
  localProfiles: readonly MlccProfile[],
  contract: Readonly<ExternalRecipeContract>,
): void {
  const work = BigInt(groups["motor.full-bridge-gate-driver"].length)
    * BigInt(groups["motor.supply-tvs-diode"].length)
    * BigInt(groups["shared.bulk-capacitor"].length)
    * BigInt(groups["shared.current-sense-resistor"].length)
    * BigInt(usesDirectGateConnection(contract) ? 1 : seriesGateProfiles.length)
    * BigInt(pulldownProfiles.length)
    * BigInt(usesSplitCapacitorRoles(contract) ? bootstrapProfiles.length : 1)
    * BigInt(localProfiles.length)
    * BigInt(groups["shared.n-channel-power-mosfet"].length);
  if (work > BigInt(DESIGN_V2_MAX_OPTIONS_PER_RECIPE)) {
    throw new RangeError(`${contract.release.id}:enumerate:resource_limit:${work.toString()}>${DESIGN_V2_MAX_OPTIONS_PER_RECIPE}`);
  }
}

function selectedProfiles(
  option: Readonly<NativeMatchedOptionV2>,
  catalog: Readonly<NativeCatalogV2>,
  contract: Readonly<ExternalRecipeContract>,
): ExternalProfile[] {
  const available: ExternalProfile[] = [
    ...profilesForContract(catalog, "motor.full-bridge-gate-driver", contract),
    ...supplyTvsProfilesForContract(catalog, contract),
    ...profilesForContract(catalog, "shared.bulk-capacitor", contract),
    ...profilesForContract(catalog, "shared.current-sense-resistor", contract),
    ...profilesForContract(catalog, "shared.general-purpose-resistor", contract),
    ...profilesForContract(catalog, "shared.mlcc-capacitor", contract),
    ...profilesForContract(catalog, "shared.n-channel-power-mosfet", contract),
  ];
  return option.components.map((component) => {
    const profile = available.find((candidate) => profileId(candidate) === component.profileId);
    if (profile) return profile;
    throw new TypeError(`Missing exact selected ${contract.profileLabel} profile ${component.id}`);
  });
}

function mountedBoardArea(profile: ExternalProfile): number {
  const fact = profile.facts.mountedGeometry.boardArea;
  if (fact.state !== "calculated" || fact.value === null) throw new TypeError("Missing calculated mounted board-area proxy");
  return fact.value.area.value;
}

function mountedHeight(profile: ExternalProfile): number {
  const fact = profile.facts.mountedGeometry.maximumHeight;
  if (fact.state !== "reviewed" || fact.value === null) throw new TypeError("Missing reviewed mounted maximum height");
  return fact.value.height.value;
}

function legacyMaterialize(candidate: Readonly<NativeCandidateV2>, contract: Readonly<ExternalRecipeContract>): NativeMaterializationV2 {
  const nonRepresentedIds = new Set(["driver", "mosfet", "supply-tvs"]);
  const physical = candidate.components.filter((component) => !nonRepresentedIds.has(component.id));
  const components: CircuitComponentV2[] = [
    { id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false },
    ...physical.map((component, index): CircuitComponentV2 => ({
      id: `bom-${String(index + 1).padStart(2, "0")}`,
      type: component.role.includes("capacitor") || component.role.includes("decoupling") ? "capacitor" : "resistor",
      value: component.value?.value ?? 1,
      mpn: component.part.manufacturerPartNumber,
      pos: [80 * (index + 1), 0],
      rot: 0,
      mirror: false,
    })),
  ];
  const circuit: CircuitDocumentV2 = {
    format: "opencircuit-circuit",
    version: 2,
    meta: {
      title: `Catalog-native ${contract.profileLabel} external-NMOS motor bridge`,
      description: "Deterministic static BOM bindings only; no semiconductor behavior or switching dynamics are claimed.",
    },
    designBlocks: [],
    circuits: [{ id: "assembly", title: "External-NMOS H-bridge BOM", components, wires: [], probes: [] }],
    scenarios: [],
    defaultCircuitId: "assembly",
    defaultScenarioId: null,
  };
  return {
    circuit,
    circuitInstanceClassifications: [
      ...physical.map((component, index) => ({
        circuitId: "assembly",
        componentId: `bom-${String(index + 1).padStart(2, "0")}`,
        kind: "physical" as const,
        selectedComponentId: component.id,
        representedQuantityPerAssembly: component.quantityPerAssembly,
      })),
      { circuitId: "assembly", componentId: "ground", kind: "non_bom" as const, reason: "Ground is a schematic reference, not a BOM line." },
    ].sort((left, right) => compareDesignV2Tokens(left.componentId, right.componentId)),
    circuitBomNonRepresentations: candidate.components
      .filter((component) => nonRepresentedIds.has(component.id))
      .map((component) => ({
        circuitId: "assembly",
        selectedComponentId: component.id,
        reason: "No reviewed executable semiconductor or protection model is bundled for this exact manufacturer part.",
      }))
      .sort((left, right) => compareDesignV2Tokens(left.selectedComponentId, right.selectedComponentId)),
  };
}

function materializeV31(
  candidate: Readonly<NativeCandidateV2>,
  contract: Readonly<ExternalRecipeContract>,
  request: Readonly<BrushedDcMotorDesignRequestV2>,
): NativeMaterializationV2 {
  const directGate = usesDirectGateConnection(contract);
  const byId = new Map(candidate.components.map((component) => [component.id, component]));
  const selected = (id: string): SelectedComponent => {
    const component = byId.get(id);
    if (component === undefined) throw new TypeError(`External-NMOS facts-V3.1 materialization requires BOM line ${id}`);
    return component;
  };
  const passive = (id: string): SelectedComponent & { value: Quantity } => {
    const component = selected(id);
    if (component.value === undefined) throw new TypeError(`External-NMOS facts-V3.1 materialization requires an exact value for ${id}`);
    return component as SelectedComponent & { value: Quantity };
  };
  const bulk = passive("bulk-capacitor");
  const sense = passive("current-sense-resistor");
  const driver = selected("driver");
  const gate = directGate ? undefined : passive("gate-resistor");
  const local = passive("local-decoupling");
  const mosfet = selected("mosfet");
  const pulldown = passive("pulldown-resistor");
  const tvs = selected("supply-tvs");
  const bootstrap = byId.has("bootstrap-capacitor") ? passive("bootstrap-capacitor") : undefined;
  if (candidate.components.length !== (bootstrap === undefined ? (directGate ? 7 : 8) : (directGate ? 8 : 9))) {
    throw new TypeError("External-NMOS facts-V3.1 materialization requires the exact selected BOM");
  }

  const definition = (payload: Omit<DesignBlockDefinition, "contentHash">): DesignBlockDefinition => ({
    ...payload,
    contentHash: calculateDesignBlockContentHash(payload),
  });
  const driverBlock = definition({
    id: "motor.full-bridge-gate-driver.exact-part",
    version: "1",
    title: "Exact selected full-bridge gate driver",
    pins: [
      { id: "bias-supply", name: "BIAS SUPPLY", offset: [-8, -6] },
      { id: "ground", name: "GROUND", offset: [-8, 6] },
      { id: "control-bus", name: "CONTROL BUS", offset: [-8, 0] },
      { id: "gate-drive-bus", name: "GATE DRIVE BUS", offset: [8, 0] },
      { id: "bootstrap-bus", name: "BOOTSTRAP BUS", offset: [8, -4] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model is bundled for this exact gate-driver manufacturer part; the block is structural only.",
    },
  });
  const mosfetBlock = definition({
    id: "shared.n-channel-power-mosfet.quad-bridge",
    version: "1",
    title: "Four exact selected N-channel power MOSFETs",
    pins: [
      { id: "motor-supply", name: "MOTOR SUPPLY", offset: [0, -8] },
      { id: "bridge-return", name: "BRIDGE RETURN", offset: [0, 8] },
      { id: "gate-control-bus", name: "GATE CONTROL BUS", offset: [-8, -4] },
      { id: "gate-source-reference-bus", name: "GATE-SOURCE REFERENCE BUS", offset: [-8, 4] },
      { id: "motor-output-bus", name: "MOTOR OUTPUT BUS", offset: [8, 0] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model is bundled for these four exact MOSFET manufacturer parts; the block is structural only.",
    },
  });
  const tvsBlock = definition({
    id: "motor.supply-tvs-diode.exact-part",
    version: "1",
    title: "Exact selected motor-supply TVS diode",
    pins: [
      { id: "supply", name: "MOTOR SUPPLY", offset: [0, -4] },
      { id: "ground", name: "GROUND", offset: [0, 4] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model is bundled for this exact TVS manufacturer part; the block is structural only.",
    },
  });
  const blockRef = (block: DesignBlockDefinition) => ({ id: block.id, version: block.version, contentHash: block.contentHash });
  const components: CircuitComponentV2[] = [
    ...(bootstrap === undefined ? [] : [{ id: "bootstrap-capacitor", type: "capacitor" as const, value: bootstrap.value.value, mpn: bootstrap.part.manufacturerPartNumber, pos: [60, 36] as [number, number], rot: 90 as const, mirror: false }]),
    { id: "bulk-capacitor", type: "capacitor", value: bulk.value.value, mpn: bulk.part.manufacturerPartNumber, pos: [20, 44], rot: 90, mirror: false },
    { id: "current-sense-resistor", type: "resistor", value: sense.value.value, mpn: sense.part.manufacturerPartNumber, pos: [68, 48], rot: 0, mirror: false },
    { id: "driver", type: "design_block", block: blockRef(driverBlock), mpn: driver.part.manufacturerPartNumber, pos: [44, 28], rot: 0, mirror: false },
    ...(gate === undefined ? [] : [{ id: "gate-resistor", type: "resistor" as const, value: gate.value.value, mpn: gate.part.manufacturerPartNumber, pos: [64, 28] as [number, number], rot: 0 as const, mirror: false }]),
    { id: "ground", type: "ground", pos: [8, 56], rot: 0, mirror: false },
    { id: "local-decoupling", type: "capacitor", value: local.value.value, mpn: local.part.manufacturerPartNumber, pos: [28, 28], rot: 90, mirror: false },
    { id: "mosfet", type: "design_block", block: blockRef(mosfetBlock), mpn: mosfet.part.manufacturerPartNumber, pos: [84, 32], rot: 0, mirror: false },
    { id: "pulldown-resistor", type: "resistor", value: pulldown.value.value, mpn: pulldown.part.manufacturerPartNumber, pos: [72, 36], rot: 90, mirror: false },
    { id: "supply-tvs", type: "design_block", block: blockRef(tvsBlock), mpn: tvs.part.manufacturerPartNumber, pos: [28, 44], rot: 0, mirror: false },
  ];
  const structuralCircuit: CircuitDocumentV2 = {
    format: "opencircuit-circuit",
    version: 2,
    meta: {
      title: `Catalog-native ${contract.profileLabel} external-NMOS motor bridge`,
      description: "The exact-BOM assembly remains structural and schematic-only. A separate request-derived averaged operating-point graph contains no selected-part model and makes no package-pin, switching, performance, or fidelity claim.",
    },
    designBlocks: [driverBlock, tvsBlock, mosfetBlock].sort((left, right) => compareDesignV2Tokens(left.id, right.id)),
    circuits: [{
      id: "assembly",
      title: "External-NMOS H-bridge structural assembly",
      components,
      wires: [
        ...(bootstrap === undefined ? [] : [
          { id: "bootstrap-drive", points: [[52, 24], [60, 24], [60, 34]] as [number, number][] },
          { id: "bootstrap-reference", points: [[60, 38], [60, 42], [76, 42], [76, 36]] as [number, number][] },
        ]),
        { id: "control-bus", points: [[36, 28], [12, 28]] },
        { id: "driver-bias", points: [[36, 22], [28, 22], [28, 26], [12, 26]] },
        ...(directGate
          ? [{ id: "gate-drive-direct-to-bridge", points: [[52, 28], [76, 28]] as [number, number][] }]
          : [
              { id: "gate-drive-before-resistor", points: [[52, 28], [62, 28]] as [number, number][] },
              { id: "gate-drive-to-bridge", points: [[66, 28], [76, 28]] as [number, number][] },
            ]),
        { id: "gate-source-pulldown", points: [[72, 28], [72, 34]] },
        { id: "gate-source-reference", points: [[72, 38], [72, 40], [76, 40], [76, 36]] },
        { id: "ground-bulk", points: [[20, 46], [20, 52], [8, 52], [8, 56]] },
        { id: "ground-driver", points: [[36, 34], [36, 52], [20, 52]] },
        { id: "ground-local", points: [[28, 30], [28, 52]] },
        { id: "ground-sense", points: [[66, 48], [66, 52], [36, 52]] },
        { id: "ground-tvs", points: [[28, 48], [28, 52]] },
        { id: "motor-output-bus", points: [[92, 32], [112, 32]] },
        { id: "return-through-sense", points: [[84, 40], [84, 48], [70, 48]] },
        { id: "supply-bulk", points: [[20, 42], [20, 16], [84, 16], [84, 24]] },
        { id: "supply-tvs-connection", points: [[28, 40], [28, 16]] },
      ],
      probes: [],
    }],
    scenarios: [],
    defaultCircuitId: "assembly",
    defaultScenarioId: null,
  };
  const companion = buildMotorOperatingPointCompanionV2(request, candidate.components);
  const circuit: CircuitDocumentV2 = {
    ...structuralCircuit,
    circuits: [...structuralCircuit.circuits, companion.graph],
    scenarios: [companion.scenario],
    defaultScenarioId: companion.scenario.id,
  };
  const assemblyClassifications = components.map((component) => {
    if (component.id === "ground") {
      return { circuitId: "assembly", componentId: "ground", kind: "non_bom" as const, reason: "Ground is a schematic reference, not a BOM line." };
    }
    const bom = selected(component.id);
    return {
      circuitId: "assembly",
      componentId: component.id,
      kind: "physical" as const,
      selectedComponentId: component.id,
      representedQuantityPerAssembly: bom.quantityPerAssembly,
    };
  });
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

function materialize(
  candidate: Readonly<NativeCandidateV2>,
  contract: Readonly<ExternalRecipeContract>,
  request: Readonly<BrushedDcMotorDesignRequestV2>,
  catalog: Readonly<NativeCatalogV2>,
): NativeMaterializationV2 {
  if (contract.resistorRoles === "exact_role_qualified_profiles") {
    if (candidate.recipeId !== contract.release.id) {
      throw new TypeError("Role-qualified external-NMOS materialization requires the exact recipe identity");
    }
    assertExactRoleQualifiedBom(candidate.components, candidate.data, catalog, contract);
  }
  return contract.profileVersions["motor.full-bridge-gate-driver"] === FACTS_SCHEMA_VERSION_V31
    ? materializeV31(candidate, contract, request)
    : legacyMaterialize(candidate, contract);
}

/** Closed-registry external-NMOS recipe. Empty reviewed inputs enumerate no options. */
function createExternalNmosRecipe(contract: Readonly<ExternalRecipeContract>): NativeRecipeV2 {
  return {
  id: contract.release.id,
  version: contract.release.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(contract.release)),
  applications: ["motor.brushed-dc"],
  metricDeclarations: METRIC_DECLARATIONS.map((entry) => ({ ...entry })),
  supports(request) {
    return request.application === "motor.brushed-dc"
      && request.constraints.allowedTopologyFamilies.includes("motor.hbridge.external-nmos");
  },
  enumerate(environment) {
    const request = motorRequest(environment);
    if (!request.constraints.allowedTopologyFamilies.includes("motor.hbridge.external-nmos")) return [];
    const allDrivers = profilesForContract(environment.catalog, "motor.full-bridge-gate-driver", contract);
    const groups = {
      "motor.full-bridge-gate-driver": usesDirectGateConnection(contract)
        ? allDrivers.filter((profile) => profileMatchesDirectGateDriverBinding(profile, contract))
        : allDrivers,
      "motor.supply-tvs-diode": supplyTvsProfilesForContract(environment.catalog, contract),
      "shared.bulk-capacitor": profilesForContract(environment.catalog, "shared.bulk-capacitor", contract),
      "shared.current-sense-resistor": profilesForContract(environment.catalog, "shared.current-sense-resistor", contract),
      "shared.general-purpose-resistor": profilesForContract(environment.catalog, "shared.general-purpose-resistor", contract),
      "shared.mlcc-capacitor": profilesForContract(environment.catalog, "shared.mlcc-capacitor", contract),
      "shared.n-channel-power-mosfet": profilesForContract(environment.catalog, "shared.n-channel-power-mosfet", contract),
    } satisfies Record<RequiredClass, ExternalProfile[]>;
    const seriesGateProfiles = resistorProfilesForRole(environment.catalog, "series-gate", contract);
    const pulldownProfiles = resistorProfilesForRole(environment.catalog, "pulldown", contract);
    const bootstrapProfiles = capacitorProfilesForRole(environment.catalog, "bootstrap", contract);
    const localProfiles = capacitorProfilesForRole(environment.catalog, "local", contract);
    preflight(groups, seriesGateProfiles, pulldownProfiles, bootstrapProfiles, localProfiles, contract);
    const gateChoices: readonly (ResistorProfile | null)[] = usesDirectGateConnection(contract)
      ? [null]
      : seriesGateProfiles;
    const bootstrapChoices: readonly (MlccProfile | null)[] = usesSplitCapacitorRoles(contract)
      ? bootstrapProfiles
      : [null];
    const options: Array<{ optionKey: string; data: Record<string, string> }> = [];
    for (const driver of groups["motor.full-bridge-gate-driver"])
      for (const mosfet of groups["shared.n-channel-power-mosfet"])
        for (const sense of groups["shared.current-sense-resistor"])
          for (const gate of gateChoices)
            for (const pulldown of pulldownProfiles)
              for (const bootstrap of bootstrapChoices)
                for (const local of localProfiles)
                  for (const bulk of groups["shared.bulk-capacitor"])
                    for (const tvs of groups["motor.supply-tvs-diode"]) {
                    const data = {
                      ...(bootstrap === null ? {} : { bootstrapProfileId: profileId(bootstrap) }),
                      bulkProfileId: profileId(bulk),
                      driverProfileId: profileId(driver),
                      ...(gate === null ? {} : { gateResistorProfileId: profileId(gate) }),
                      localProfileId: profileId(local),
                      mosfetProfileId: profileId(mosfet),
                      pulldownProfileId: profileId(pulldown),
                      senseProfileId: profileId(sense),
                      tvsProfileId: profileId(tvs),
                    };
                    options.push({ optionKey: optionKey(data, contract), data });
                    }
    return options.sort((left, right) => compareDesignV2Tokens(left.optionKey, right.optionKey));
  },
  solve(option) {
    return { status: "ok", value: { data: { ...option.data }, derivedValues: [] } };
  },
  match(option, environment) {
    const request = motorRequest(environment);
    const directGate = usesDirectGateConnection(contract);
    if (directGate && exactText(option.data, "gateResistorProfileId") !== undefined) {
      return [{ status: "rejected", reason: "The exact-driver direct-gate structural recipe must not bind a series gate-resistor data key." }];
    }
    const driver = exactProfile(option.data, "driverProfileId", environment.catalog, "motor.full-bridge-gate-driver", contract);
    const mosfet = exactProfile(option.data, "mosfetProfileId", environment.catalog, "shared.n-channel-power-mosfet", contract);
    const sense = exactProfile(option.data, "senseProfileId", environment.catalog, "shared.current-sense-resistor", contract);
    const gate = directGate ? undefined : exactProfile(option.data, "gateResistorProfileId", environment.catalog, "shared.general-purpose-resistor", contract);
    const pulldown = exactProfile(option.data, "pulldownProfileId", environment.catalog, "shared.general-purpose-resistor", contract);
    const local = exactProfile(option.data, "localProfileId", environment.catalog, "shared.mlcc-capacitor", contract);
    const bootstrap = usesSplitCapacitorRoles(contract)
      ? exactProfile(option.data, "bootstrapProfileId", environment.catalog, "shared.mlcc-capacitor", contract)
      : local;
    const bulk = exactProfile(option.data, "bulkProfileId", environment.catalog, "shared.bulk-capacitor", contract);
    const tvs = exactProfile(option.data, "tvsProfileId", environment.catalog, "motor.supply-tvs-diode", contract);
    const profiles = [driver, mosfet, sense, ...(directGate ? [] : [gate]), pulldown, bootstrap, local, bulk, tvs];
    if (profiles.some((profile) => profile === undefined)) {
      return [{ status: "rejected", reason: `At least one exact external-NMOS ${contract.profileLabel} profile is absent from the reviewed catalog.` }];
    }
    if (directGate && !profileMatchesDirectGateDriverBinding(driver!, contract)) {
      return [{
        status: "rejected",
        reason: "The exact-driver direct-gate structural recipe requires the hash-bound MIC4606-2YML-T5 profile.",
        componentProfileIds: [profileId(driver!)],
      }];
    }
    if (contract.resistorRoles === "exact_role_qualified_profiles") {
      const roleFailures = [
        ...(directGate || profileIsQualifiedForResistorRole(gate!, environment.catalog, "series-gate", contract)
          ? []
          : ["No exact reviewed series-gate resistor profile has pulse and driver evidence for this physical role."]),
        ...(profileIsQualifiedForResistorRole(pulldown!, environment.catalog, "pulldown", contract)
          ? []
          : ["The gate-source pull-down is not one of the exact reviewed 100 kΩ role-qualified profiles."]),
      ];
      if (roleFailures.length > 0) {
        return [{
          status: "rejected",
          reason: roleFailures.join(" "),
          componentProfileIds: [...new Set([
            ...(directGate ? [] : [profileId(gate!)]),
            profileId(pulldown!),
          ])].sort(compareDesignV2Tokens),
        }];
      }
    }
    if (usesSplitCapacitorRoles(contract)) {
      const capacitorRoleFailures = [
        ...(profileIsQualifiedForCapacitorRole(bootstrap!, environment.catalog, "bootstrap", contract)
          ? []
          : ["The bootstrap capacitor is not a reviewed ceramic MLCC above the conservative 0.1 uF nameplate floor."]),
        ...(profileIsQualifiedForCapacitorRole(local!, environment.catalog, "local", contract)
          ? []
          : ["The VDD-local capacitor is not a reviewed ceramic MLCC above the conservative 1 uF nameplate floor."]),
      ];
      if (capacitorRoleFailures.length > 0) {
        return [{
          status: "rejected",
          reason: capacitorRoleFailures.join(" "),
          componentProfileIds: [...new Set([profileId(bootstrap!), profileId(local!)])].sort(compareDesignV2Tokens),
        }];
      }
    }
    if (reviewedText(driver!.facts.bridgeTopology) !== "full_bridge" || reviewedText(driver!.facts.powerStage) !== "external_n_channel_mosfet") {
      return [{ status: "rejected", reason: "The selected driver does not declare the exact external N-channel full-bridge topology." }];
    }
    const bootstrapRequired = requiresBootstrapCapacitor(driver!.facts.highSideSupply);
    const components: SelectedComponent[] = [
      selected("bulk-capacitor", "supply-bulk-capacitor", bulk!, 1, bulk!.facts.nominalCapacitance),
      ...(bootstrapRequired ? [selected("bootstrap-capacitor", "bootstrap-capacitor", bootstrap!, 2, bootstrap!.facts.nominalCapacitance)] : []),
      selected("current-sense-resistor", "current-sense-resistor", sense!, 1, sense!.facts.resistance),
      selected("driver", "full-bridge-gate-driver", driver!, 1),
      ...(directGate ? [] : [selected("gate-resistor", "mosfet-gate-resistor", gate!, 4, gate!.facts.resistance)]),
      selected("local-decoupling", "driver-local-decoupling-capacitor", local!, 1, local!.facts.nominalCapacitance),
      selected("mosfet", "bridge-n-channel-power-mosfet", mosfet!, 4),
      selected("pulldown-resistor", "mosfet-gate-source-pulldown-resistor", pulldown!, 4, pulldown!.facts.resistance),
      selected("supply-tvs", "motor-supply-tvs-diode", tvs!, 1),
    ].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
    assertExactRoleQualifiedBom(components, { ...option.data, bootstrapRequired }, environment.catalog, contract);
    return [{ status: "ok", value: {
      data: { ...option.data, bootstrapRequired },
      derivedValues: option.derivedValues,
      components,
      simulationCoverage: contract.profileVersions["motor.full-bridge-gate-driver"] === FACTS_SCHEMA_VERSION_V31
        ? [
            buildMotorOperatingPointCompanionV2(request, components).coverage,
            motorSelectedPartModelUnavailableCoverageV2(
              `No reviewed executable gate-driver, MOSFET, TVS, parasitic, motor, or switching model is bundled for this exact ${contract.profileLabel} BOM.`,
            ),
          ]
        : [{
            scenarioId: "catalog-native-model",
            modelTier: "unavailable",
            limitations: [`No reviewed executable gate-driver, MOSFET, TVS, parasitic, motor, or switching model is bundled for this exact ${contract.profileLabel} BOM.`],
          }],
      warnings: [],
    } }];
  },
  check(option, environment) {
    const request = motorRequest(environment);
    const directGate = usesDirectGateConnection(contract);
    const driver = exactProfile(option.data, "driverProfileId", environment.catalog, "motor.full-bridge-gate-driver", contract);
    const mosfet = exactProfile(option.data, "mosfetProfileId", environment.catalog, "shared.n-channel-power-mosfet", contract);
    const sense = exactProfile(option.data, "senseProfileId", environment.catalog, "shared.current-sense-resistor", contract);
    const gate = directGate ? undefined : exactProfile(option.data, "gateResistorProfileId", environment.catalog, "shared.general-purpose-resistor", contract);
    const pulldown = exactProfile(option.data, "pulldownProfileId", environment.catalog, "shared.general-purpose-resistor", contract);
    const local = exactProfile(option.data, "localProfileId", environment.catalog, "shared.mlcc-capacitor", contract);
    const bootstrap = usesSplitCapacitorRoles(contract)
      ? exactProfile(option.data, "bootstrapProfileId", environment.catalog, "shared.mlcc-capacitor", contract)
      : local;
    const bulk = exactProfile(option.data, "bulkProfileId", environment.catalog, "shared.bulk-capacitor", contract);
    const tvs = exactProfile(option.data, "tvsProfileId", environment.catalog, "motor.supply-tvs-diode", contract);
    if (
      !driver || !mosfet || !sense || (!directGate && !gate) || !pulldown || !bootstrap || !local || !bulk || !tvs
      || (directGate && (
        exactText(option.data, "gateResistorProfileId") !== undefined
        || !profileMatchesDirectGateDriverBinding(driver, contract)
      ))
      || (usesSplitCapacitorRoles(contract) && (
        !profileIsQualifiedForCapacitorRole(bootstrap, environment.catalog, "bootstrap", contract)
        || !profileIsQualifiedForCapacitorRole(local, environment.catalog, "local", contract)
      ))
    ) {
      return [unknownConstraint("motor.external.profile-set", `The exact selected ${contract.profileLabel} external-NMOS profile set is unavailable during constraint evaluation.`)];
    }
    const supplyMaximum = request.requirements.supplyVoltage.maximum.value;
    const duty = request.requirements.operatingPoint.dutyCycle.value;
    const pwm = request.requirements.pwmFrequency.value;
    const onTime = canon(duty / pwm);
    const offTime = canon(canon(1 - duty) / pwm);
    const ambientContext = { ambientTemperature: request.requirements.ambientTemperature };
    const driverV31 = isDriverV31(driver) ? driver : undefined;
    const driverV2 = driverV31 === undefined ? driver as DriverProfileV2 : undefined;
    const timingContext: Record<string, Readonly<ProfileQuantity>> = {
      ambientTemperature: request.requirements.ambientTemperature,
      switchingFrequency: request.requirements.pwmFrequency,
    };
    if (driverV31 && reviewedText(driverV31.facts.bridgeVoltageInterface) === "motor_bus_supply_pin") {
      timingContext.bridgeVoltage = request.requirements.supplyVoltage.maximum;
    }
    const pulseConstraints = driverV31
      ? [
          timingConstraintV31(
            "motor.external.driver-pulse-off-time",
            driverV31.facts.minimumPulseWidth,
            driverV31.facts.minimumPulseWidthRole,
            "s",
            quantity(offTime, "s"),
            "at_least",
            false,
            timingContext,
            "The requested PWM off-time is not shorter than the reviewed guaranteed driver minimum pulse width.",
          ),
          timingConstraintV31(
            "motor.external.driver-pulse-on-time",
            driverV31.facts.minimumPulseWidth,
            driverV31.facts.minimumPulseWidthRole,
            "s",
            quantity(onTime, "s"),
            "at_least",
            false,
            timingContext,
            "The requested PWM on-time is not shorter than the reviewed guaranteed driver minimum pulse width.",
          ),
        ]
      : (() => {
          const minimumPulse = reviewedQuantity(driverV2!.facts.minimumPulseWidth, "s");
          return [
            limitConstraint("motor.external.driver-pulse-off-time", quantity(offTime, "s"), quantity(minimumPulse, "s"), "at_least", factEvidence(driverV2!.facts.minimumPulseWidth), "The requested PWM off-time is not shorter than the reviewed driver minimum pulse width."),
            limitConstraint("motor.external.driver-pulse-on-time", quantity(onTime, "s"), quantity(minimumPulse, "s"), "at_least", factEvidence(driverV2!.facts.minimumPulseWidth), "The requested PWM on-time is not shorter than the reviewed driver minimum pulse width."),
          ];
        })();
    const pwmConstraint = driverV31
      ? timingConstraintV31(
          "motor.external.driver-pwm-frequency",
          driverV31.facts.pwmMaximum,
          driverV31.facts.pwmMaximumRole,
          "Hz",
          request.requirements.pwmFrequency,
          "at_least",
          true,
          timingContext,
          "The reviewed guaranteed driver PWM capability covers the request.",
        )
      : limitConstraint("motor.external.driver-pwm-frequency", quantity(reviewedQuantity(driverV2!.facts.pwmMaximum, "Hz"), "Hz"), request.requirements.pwmFrequency, "at_least", factEvidence(driverV2!.facts.pwmMaximum), "Reviewed driver PWM capability covers the request.");
    const driverLogicThreshold = driverV31 && !conditionsCover(driverV31.facts.logicHighThresholdMaximum, timingContext)
      ? unknownConstraint("motor.external.driver-logic-threshold", "The reviewed driver logic threshold does not cover the declared bridge, bias, and temperature conditions.", factEvidence(driverV31.facts.logicHighThresholdMaximum))
      : limitConstraint("motor.external.driver-logic-threshold", quantity(reviewedQuantity(driver.facts.logicHighThresholdMaximum, "V"), "V"), request.requirements.logicVoltage, "at_most", factEvidence(driver.facts.logicHighThresholdMaximum), "The logic rail reaches the reviewed worst-case high threshold.");
    const interfaceQualifiedSwitchNode = contract.driverVoltageSemantics === "bridge_interface_qualified"
      && driverV31 !== undefined
      && reviewedText(driverV31.facts.bridgeVoltageInterface) === "switch_node_only";
    const nominalSwitchNodeBoundary = "This evaluates only the topology's nominal 0 V-to-requested-bus xHS excursion; recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved elsewhere.";
    const driverVoltageConstraints: ConstraintResult[] = interfaceQualifiedSwitchNode
      ? [
          limitConstraint(
            "motor.external.driver-switch-node-operating-minimum",
            quantity(0, "V"),
            quantity(reviewedQuantity(driverV31.facts.bridgeVoltageOperatingMinimum, "V"), "V"),
            "at_least",
            [...factEvidence(driverV31.facts.bridgeVoltageInterface), ...factEvidence(driverV31.facts.bridgeVoltageOperatingMinimum)],
            `The nominal expected xHS lower bound is not below the reviewed switch-node operating minimum. ${nominalSwitchNodeBoundary}`,
          ),
          limitConstraint(
            "motor.external.driver-switch-node-operating-maximum",
            request.requirements.supplyVoltage.maximum,
            quantity(reviewedQuantity(driverV31.facts.bridgeVoltageOperatingMaximum, "V"), "V"),
            "at_most",
            [...factEvidence(driverV31.facts.bridgeVoltageInterface), ...factEvidence(driverV31.facts.bridgeVoltageOperatingMaximum)],
            `The nominal expected xHS upper bound does not exceed the reviewed switch-node operating maximum. ${nominalSwitchNodeBoundary}`,
          ),
          limitConstraint(
            "motor.external.driver-switch-node-absolute-maximum",
            request.requirements.supplyVoltage.maximum,
            quantity(reviewedQuantity(driverV31.facts.bridgeVoltageAbsoluteMaximum, "V"), "V"),
            "at_most",
            [...factEvidence(driverV31.facts.bridgeVoltageInterface), ...factEvidence(driverV31.facts.bridgeVoltageAbsoluteMaximum)],
            `The nominal expected xHS upper bound does not exceed the reviewed switch-node absolute maximum. ${nominalSwitchNodeBoundary}`,
          ),
        ]
      : [
          driverV31
            ? limitConstraint("motor.external.driver-absolute-maximum", request.requirements.supplyVoltage.maximum, quantity(reviewedQuantity(driverV31.facts.bridgeVoltageAbsoluteMaximum, "V"), "V"), "at_most", factEvidence(driverV31.facts.bridgeVoltageAbsoluteMaximum), "Maximum motor supply does not exceed the reviewed driver switch-node absolute maximum; transient overshoot remains unproved.")
            : limitConstraint("motor.external.driver-absolute-maximum", request.requirements.supplyVoltage.maximum, quantity(reviewedQuantity(driverV2!.facts.absoluteMaximum, "V"), "V"), "at_most", factEvidence(driverV2!.facts.absoluteMaximum), "Maximum motor supply does not exceed the reviewed driver absolute maximum; transient margin remains unproved."),
          driverV31
            ? limitConstraint("motor.external.driver-supply-maximum", request.requirements.supplyVoltage.maximum, quantity(reviewedQuantity(driverV31.facts.bridgeVoltageOperatingMaximum, "V"), "V"), "at_most", factEvidence(driverV31.facts.bridgeVoltageOperatingMaximum), "Maximum motor supply does not exceed the reviewed switch-node operating maximum; transient overshoot remains unproved.")
            : limitConstraint("motor.external.driver-supply-maximum", request.requirements.supplyVoltage.maximum, quantity(reviewedQuantity(driverV2!.facts.supplyMaximum, "V"), "V"), "at_most", factEvidence(driverV2!.facts.supplyMaximum), "Maximum motor supply does not exceed the reviewed driver operating maximum."),
          driverV31 && reviewedText(driverV31.facts.bridgeVoltageInterface) === "switch_node_only"
            ? unknownConstraint("motor.external.driver-supply-minimum", "The driver's reviewed minimum is a switch-node limit, not a motor-bus supply minimum; no bus-minimum feasibility claim is made.", [...factEvidence(driverV31.facts.bridgeVoltageInterface), ...factEvidence(driverV31.facts.bridgeVoltageOperatingMinimum)])
            : driverV31
              ? limitConstraint("motor.external.driver-supply-minimum", request.requirements.supplyVoltage.minimum, quantity(reviewedQuantity(driverV31.facts.bridgeVoltageOperatingMinimum, "V"), "V"), "at_least", factEvidence(driverV31.facts.bridgeVoltageOperatingMinimum), "Minimum motor supply is not below the reviewed driver bus-supply operating minimum.")
              : limitConstraint("motor.external.driver-supply-minimum", request.requirements.supplyVoltage.minimum, quantity(reviewedQuantity(driverV2!.facts.supplyMinimum, "V"), "V"), "at_least", factEvidence(driverV2!.facts.supplyMinimum), "Minimum motor supply is not below the reviewed driver operating minimum."),
        ];
    const highSideDuty = driverV31
      ? driverV31.facts.bootstrapMaximumDutyCycle.state === "reviewed" && driverV31.facts.bootstrapMaximumDutyCycle.value !== null
        ? limitConstraint("motor.external.high-side-duty", quantity(driverV31.facts.bootstrapMaximumDutyCycle.value.value, "1"), request.requirements.operatingPoint.dutyCycle, "at_least", factEvidence(driverV31.facts.bootstrapMaximumDutyCycle), "The reviewed numeric high-side refresh duty limit covers the declared operating point.")
        : unknownConstraint("motor.external.high-side-duty", "No reviewed numeric bootstrap duty-cycle bound proves high-side refresh feasibility.", [...factEvidence(driverV31.facts.continuousHighSideOnSupported), ...factEvidence(driverV31.facts.bootstrapMaximumDutyCycle)])
      : limitConstraint("motor.external.high-side-duty", quantity(reviewedQuantity(driver.facts.bootstrapMaximumDutyCycle, "1"), "1"), request.requirements.operatingPoint.dutyCycle, "at_least", factEvidence(driver.facts.bootstrapMaximumDutyCycle), "The reviewed high-side refresh duty limit covers the declared operating point.");
    const capacitorRoleBindings = contract.capacitorRoleBindings;
    const bootstrapNominalCapacitance = capacitorRoleBindings === null
      ? undefined
      : limitConstraint(
          "motor.external.bootstrap-capacitance-nominal",
          quantity(reviewedQuantity(bootstrap.facts.nominalCapacitance, "F"), "F"),
          quantity(capacitorRoleBindings.bootstrap.documentedNominalMinimumF, "F"),
          "at_least",
          [...factEvidence(bootstrap.facts.nominalCapacitance), { ...MIC4606_CAPACITOR_ROLE_EVIDENCE }],
          "The selected ceramic MLCC's reviewed nameplate capacitance is above the rev-H 0.1 uF bootstrap floor. This is not an effective-capacitance or bootstrap-adequacy claim.",
        );
    const localCapacitance = capacitorRoleBindings !== null
      ? limitConstraint(
          "motor.external.local-capacitance-nominal",
          quantity(reviewedQuantity(local.facts.nominalCapacitance, "F"), "F"),
          quantity(capacitorRoleBindings.local.documentedNominalMinimumF, "F"),
          "at_least",
          [...factEvidence(local.facts.nominalCapacitance), { ...MIC4606_CAPACITOR_ROLE_EVIDENCE }],
          "The selected ceramic MLCC's reviewed nameplate capacitance is above the rev-H 1 uF VDD-local floor. This is not an effective-capacitance or driver-bias-adequacy claim.",
        )
      : driverV31
        ? driverV31.facts.localDecouplingMinimum.state === "reviewed" && driverV31.facts.localDecouplingMinimum.value !== null
          ? limitConstraint("motor.external.local-capacitance-nominal", quantity(reviewedQuantity(local.facts.nominalCapacitance, "F"), "F"), quantity(driverV31.facts.localDecouplingMinimum.value.value, "F"), "at_least", [...factEvidence(local.facts.nominalCapacitance), ...factEvidence(driverV31.facts.localDecouplingMinimum)], "Reviewed nominal local capacitance meets the reviewed driver minimum.")
          : unknownConstraint("motor.external.local-capacitance-nominal", "No reviewed closed numeric local-decoupling minimum proves capacitor adequacy.", [...factEvidence(local.facts.nominalCapacitance), ...factEvidence(driverV31.facts.localDecouplingMinimum)])
        : limitConstraint("motor.external.local-capacitance-nominal", quantity(reviewedQuantity(local.facts.nominalCapacitance, "F"), "F"), quantity(reviewedQuantity(driver.facts.localDecouplingMinimum, "F"), "F"), "at_least", [...factEvidence(local.facts.nominalCapacitance), ...factEvidence(driver.facts.localDecouplingMinimum)], "Reviewed nominal local capacitance meets the driver minimum.");
    const driverBiasEvidence = driverV31
      ? [driverV31.facts.driverBiasInputMinimum, driverV31.facts.driverBiasInputMaximum, driverV31.facts.driverBiasOutputMinimum, driverV31.facts.driverBiasOutputMaximum].flatMap(factEvidence)
      : [...factEvidence(driverV2!.facts.driverBiasMinimum), ...factEvidence(driverV2!.facts.driverBiasMaximum)];
    const localVoltageRating = driverV31
      ? unknownConstraint("motor.external.local-voltage-rating", "The request does not bind an implemented driver-bias voltage, so the local capacitor voltage rating cannot establish bias feasibility.", [...factEvidence(local.facts.ratedVoltage), ...driverBiasEvidence])
      : limitConstraint("motor.external.local-voltage-rating", quantity(reviewedQuantity(local.facts.ratedVoltage, "V"), "V"), quantity(reviewedQuantity(driverV2!.facts.driverBiasMaximum, "V"), "V"), "at_least", factEvidence(local.facts.ratedVoltage), "The local capacitor nameplate voltage covers the reviewed maximum driver bias.");
    const continuousCurrent = conditionsCover(mosfet.facts.continuousDrainCurrent, ambientContext)
      ? limitConstraint("motor.external.mosfet-continuous-current", quantity(reviewedQuantity(mosfet.facts.continuousDrainCurrent, "A"), "A"), request.requirements.continuousCurrent, "at_least", factEvidence(mosfet.facts.continuousDrainCurrent), "The reviewed MOSFET continuous-current rating covers the request at the declared ambient condition.")
      : unknownConstraint("motor.external.mosfet-continuous-current", "The reviewed MOSFET continuous-current conditions do not cover the declared ambient point.", factEvidence(mosfet.facts.continuousDrainCurrent));
    const tvsStandOff = contract.supplyTvsBinding === null
      ? limitConstraint(
          "motor.external.tvs-stand-off",
          quantity(reviewedQuantity(tvs.facts.standOffVoltage, "V"), "V"),
          request.requirements.supplyVoltage.maximum,
          "at_least",
          factEvidence(tvs.facts.standOffVoltage),
          "The reviewed TVS stand-off voltage is not below maximum normal motor supply.",
        )
      : conditionsCover(tvs.facts.standOffVoltage, ambientContext)
        ? limitConstraint(
          "motor.external.tvs-stand-off",
          quantity(reviewedQuantity(tvs.facts.standOffVoltage, "V"), "V"),
          request.requirements.supplyVoltage.maximum,
          "at_least",
          factEvidence(tvs.facts.standOffVoltage),
          "The reviewed TVS stand-off voltage is not below maximum normal motor supply at the declared ambient condition.",
          )
        : unknownConstraint(
            "motor.external.tvs-stand-off",
            "The reviewed TVS stand-off-voltage conditions do not cover the declared ambient point, so normal-bus non-conduction is unproved.",
            factEvidence(tvs.facts.standOffVoltage),
          );
    const sourceConditionedTvsLimits = contract.supplyTvsBinding === null
      ? []
      : [
          limitConstraint(
            "motor.external.tvs-published-clamp-mosfet-limit",
            quantity(reviewedQuantity(tvs.facts.clampingVoltage, "V"), "V"),
            quantity(reviewedQuantity(mosfet.facts.drainSourceVoltage, "V"), "V"),
            "at_most",
            [...factEvidence(tvs.facts.clampingVoltage), ...factEvidence(mosfet.facts.drainSourceVoltage)],
            "The TVS's 53.3 V maximum published clamp at exactly 25 C, 56.3 A, and the non-repetitive 10 x 1000 us source waveform is below the reviewed 60 V MOSFET drain-source rating. This static source-conditioned comparison does not prove the application's transient current, waveform, energy, wiring overshoot, parasitics, avalanche/SOA, or TVS coordination.",
          ),
          limitConstraint(
            "motor.external.tvs-published-clamp-driver-switch-node-limit",
            quantity(reviewedQuantity(tvs.facts.clampingVoltage, "V"), "V"),
            quantity(reviewedQuantity(driverV31!.facts.bridgeVoltageAbsoluteMaximum, "V"), "V"),
            "at_most",
            [...factEvidence(tvs.facts.clampingVoltage), ...factEvidence(driverV31!.facts.bridgeVoltageAbsoluteMaximum)],
            "The TVS's 53.3 V maximum published clamp at exactly 25 C, 56.3 A, and the non-repetitive 10 x 1000 us source waveform is below the reviewed 90 V xHS absolute limit. This static source-conditioned comparison does not prove the application's transient current, waveform, energy, wiring overshoot, parasitics, or TVS coordination.",
          ),
        ];
    const currentLimit = unknownConstraint(
      "motor.external.current-sense-threshold",
      request.requirements.currentLimitTarget === null
        ? "No current-limit target is requested; shunt selection does not prove stall-current protection."
        : driverV31 && reviewedText(driverV31.facts.currentSenseInterface) === "none"
          ? "The selected driver has no integrated current-sense interface, so the requested configured current limit is unproved."
          : "The profile contract exposes a maximum sense-input voltage, not a reviewed configured current-limit threshold, so the requested target cannot be proved.",
      [...factEvidence(sense.facts.resistance), ...(driverV31 ? factEvidence(driverV31.facts.currentSenseInterface) : []), ...factEvidence(driver.facts.senseMaximumVoltage)],
    );
    const gateNetwork = directGate
      ? unknownConstraint(
          "motor.external.gate-network",
          "Microchip rev H is used here only as evidence for this exact driver's selected structural direct gate connection: high-side damping resistance is optional and increases turn-off delay, while low-side series resistance may impair xLO monitoring and is not recommended. This omits a series gate-resistor BOM line but does not prove a resistor value, switching behavior, dv/dt, Miller immunity, shoot-through prevention, package-pin mapping, or physical gate-network feasibility.",
          [
            { ...MIC4606_DIRECT_GATE_EVIDENCE },
            ...factEvidence(pulldown.facts.resistance),
            ...factEvidence(mosfet.facts.totalGateCharge),
          ],
        )
      : unknownConstraint(
          "motor.external.gate-network",
          "No reviewed gate-resistance, pulldown, dv/dt, Miller, or shoot-through calculation proves the selected gate network.",
          [...factEvidence(gate!.facts.resistance), ...factEvidence(pulldown.facts.resistance), ...factEvidence(mosfet.facts.totalGateCharge)],
        );
    const selectedSet = selectedProfiles(option, environment.catalog, contract);
    const constraints: ConstraintResult[] = [
      limitConstraint("motor.external.bulk-voltage-rating", quantity(reviewedQuantity(bulk.facts.ratedVoltage, "V"), "V"), quantity(supplyMaximum, "V"), "at_least", factEvidence(bulk.facts.ratedVoltage), "The reviewed bulk-capacitor nameplate voltage is not below maximum motor supply."),
      driverLogicThreshold,
      ...pulseConstraints,
      pwmConstraint,
      ...driverVoltageConstraints,
      highSideDuty,
      ...(bootstrapNominalCapacitance === undefined ? [] : [bootstrapNominalCapacitance]),
      localCapacitance,
      localVoltageRating,
      limitConstraint("motor.external.mosfet-vds", quantity(reviewedQuantity(mosfet.facts.drainSourceVoltage, "V"), "V"), request.requirements.supplyVoltage.maximum, "at_least", factEvidence(mosfet.facts.drainSourceVoltage), "The reviewed MOSFET drain-source rating is not below maximum motor supply; overshoot margin remains unproved."),
      tvsStandOff,
      ...sourceConditionedTvsLimits,
      continuousCurrent,
      currentLimit,
      unknownConstraint(
        "motor.external.bootstrap-capacitance",
        capacitorRoleBindings === null
          ? driverV31
            ? "No reviewed bootstrap charge-and-ripple model proves effective capacitance across bias, temperature, refresh, and leakage."
            : "Bootstrap overhead charge and ripple facts do not by themselves prove effective bootstrap capacitance across bias, temperature, refresh, and leakage."
          : "The rev-H nameplate floor is not bootstrap adequacy. Its QGATE and IHBS*tON equations are not evaluated because exact gate charge at the implemented bias and the applicable IHBS, tON, effective capacitance, temperature, leakage, and refresh conditions are not jointly bound.",
        capacitorRoleBindings === null
          ? driverV31
            ? [...factEvidence(driverV31.facts.highSideBiasCurrentMaximum), ...factEvidence(driverV31.facts.bootstrapMaximumDutyCycle), ...factEvidence(bootstrap.facts.nominalCapacitance)]
            : [...factEvidence(driverV2!.facts.bootstrapOverheadCharge), ...factEvidence(driverV2!.facts.bootstrapAllowedRipple), ...factEvidence(bootstrap.facts.nominalCapacitance)]
          : [{ ...MIC4606_CAPACITOR_ROLE_EVIDENCE }, ...factEvidence(driverV31!.facts.highSideBiasCurrentMaximum), ...factEvidence(driverV31!.facts.bootstrapMaximumDutyCycle), ...factEvidence(bootstrap.facts.nominalCapacitance), ...factEvidence(mosfet.facts.totalGateCharge)],
      ),
      unknownConstraint("motor.external.bulk-capacitance", "No reviewed request-specific bulk-capacitance or transient-energy minimum is available for this motor and wiring."),
      ...(capacitorRoleBindings === null ? [] : [
        unknownConstraint(
          "motor.external.capacitor-placement",
          "Rev H requires close placement with short, wide connections, but the structural graph does not prove physical capacitor placement or interconnect geometry.",
          [{ ...MIC4606_CAPACITOR_ROLE_EVIDENCE }],
        ),
        unknownConstraint(
          "motor.external.local-capacitance-effective",
          "The reviewed VDD-local nameplate value does not prove effective capacitance under implemented bias and temperature, ripple behavior, or driver-bias support.",
          [{ ...MIC4606_CAPACITOR_ROLE_EVIDENCE }, ...factEvidence(local.facts.nominalCapacitance), ...factEvidence(local.facts.effectiveCapacitance), ...factEvidence(local.facts.biasDeratingRatio)],
        ),
      ]),
      unknownConstraint(
        "motor.external.driver-bias-source",
        contract.driverVoltageSemantics === "bridge_interface_qualified" && driverV31 !== undefined
          ? "The structural candidate does not implement a VDD driver-bias rail and therefore cannot prove that an actual bias source remains inside the reviewed VDD minimum and maximum. Switch-node range coverage is separate and does not establish driver-bias feasibility."
          : "The request does not bind a reviewed driver-bias supply implementation inside the driver's operating range.",
        driverBiasEvidence,
      ),
      gateNetwork,
      unknownConstraint("motor.external.mosfet-pulsed-soa", "Stall-current safety is not proved because pulse duration, duty cycle, transient SOA, and thermal impedance are not fully bound.", factEvidence(mosfet.facts.pulsedDrainCurrent)),
      unknownConstraint("motor.external.passive-derating", "Nameplate passive values do not prove effective capacitance, bias or temperature derating, ripple, leakage, pulse power, temperature rise, or lifetime.", [...factEvidence(bootstrap.facts.nominalCapacitance), ...factEvidence(local.facts.nominalCapacitance), ...factEvidence(bulk.facts.nominalCapacitance), ...factEvidence(sense.facts.continuousPower)]),
      unknownConstraint("motor.external.request.motor-dynamics", "No reviewed winding-inductance, back-EMF, commutation, startup, or braking model is bound to this candidate."),
      unknownConstraint("motor.external.switching-and-loss", "No reviewed gate-drive, switching, reverse-recovery, conduction, dead-time, or parasitic loss calculation proves this operating point.", [...factEvidence(driver.facts.sourceCurrent), ...factEvidence(driver.facts.sinkCurrent), ...factEvidence(mosfet.facts.onResistance), ...factEvidence(mosfet.facts.totalGateCharge)]),
      unknownConstraint("motor.external.thermal", "No reviewed loss, PCB copper, airflow, or transient thermal calculation proves actual junction temperatures.", [...factEvidence(driver.facts.maximumJunctionTemperature), ...factEvidence(mosfet.facts.maximumJunctionTemperature)]),
      unknownConstraint("motor.external.tvs-coordination", "The source-conditioned stand-off and published-clamp voltage comparisons do not bind the application's transient current, waveform, pulse energy, wiring overshoot, parasitics, MOSFET avalanche/SOA, or driver stress to one common envelope; full TVS coordination remains unproved.", [...factEvidence(tvs.facts.clampingVoltage), ...factEvidence(tvs.facts.pulseCurrent), ...factEvidence(tvs.facts.pulseEnergy), ...factEvidence(mosfet.facts.drainSourceVoltage), ...(driverV31 === undefined ? [] : factEvidence(driverV31.facts.bridgeVoltageAbsoluteMaximum))]),
    ];
    if (request.constraints.allowedPackages.length > 0) {
      constraints.push({
        ruleId: "motor.external.assembly.allowed-packages",
        status: selectedSet.every((profile) => profile.commonFacts.packageName.value !== null && request.constraints.allowedPackages.includes(profile.commonFacts.packageName.value)) ? "pass" : "fail",
        explanation: "Every exact selected package name is in the request allowlist.",
        evidence: selectedSet.flatMap((profile) => projectedEvidence(profile.commonFacts.packageName.evidence)),
      });
    }
    if (request.constraints.maximumComponentHeight !== null) {
      constraints.push(limitConstraint(
        "motor.external.assembly.component-height",
        quantity(Math.max(...selectedSet.map(mountedHeight)), "m"),
        request.constraints.maximumComponentHeight,
        "at_most",
        selectedSet.flatMap((profile) => factEvidence(profile.facts.mountedGeometry.maximumHeight)),
        "Every selected part's reviewed mounted maximum height fits the request limit.",
      ));
    }
    if (request.constraints.maximumBoardArea !== null) {
      constraints.push(unknownConstraint(
        "motor.external.assembly.board-area",
        "The sum of mounted land-pattern rectangles is a ranking proxy, not placement, courtyard, routing, or board-outline proof.",
        selectedSet.flatMap((profile) => factEvidence(profile.facts.mountedGeometry.boardArea)),
      ));
    }
    return constraints.sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId));
  },
  estimate(option, _constraints, environment) {
    const profiles = new Map(selectedProfiles(option, environment.catalog, contract).map((profile) => [profileId(profile), profile]));
    const boardArea = option.components.reduce((total, component) => {
      const profile = profiles.get(component.profileId);
      if (!profile) throw new TypeError(`Missing exact selected profile for ${component.id}`);
      return canon(total + canon(mountedBoardArea(profile) * component.quantityPerAssembly));
    }, 0);
    const count = option.components.reduce((total, component) => total + component.quantityPerAssembly, 0);
    return {
      metrics: [
        {
          id: "motor.native.board-area",
          value: quantity(boardArea, "m2"),
          state: "calculated",
          explanation: "Ranking-only canonical sum of reviewed mounted land-pattern proxies multiplied by physical quantity; not a PCB fit proof.",
          evidence: selectedProfiles(option, environment.catalog, contract).flatMap((profile) => factEvidence(profile.facts.mountedGeometry.boardArea)),
        },
        {
          id: "motor.native.component-count",
          value: quantity(count, "count"),
          state: "calculated",
          explanation: "Selected physical component count including repeated bridge and gate-network parts.",
          evidence: [],
        },
      ],
      warnings: [],
    };
  },
  materialize(candidate, environment) {
    return materialize(candidate, contract, motorRequest(environment), environment.catalog);
  },
  };
}

export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2: NativeRecipeV2 = createExternalNmosRecipe(EXTERNAL_RECIPE_V2);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3: NativeRecipeV2 = createExternalNmosRecipe(EXTERNAL_RECIPE_V3);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31: NativeRecipeV2 = createExternalNmosRecipe(EXTERNAL_RECIPE_V31);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED: NativeRecipeV2 = createExternalNmosRecipe(EXTERNAL_RECIPE_V31_ROLE_QUALIFIED);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_ROLE_QUALIFIED_BINDING_REFRESHED: NativeRecipeV2 =
  createExternalNmosRecipe(EXTERNAL_RECIPE_V31_ROLE_QUALIFIED_BINDING_REFRESHED);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE: NativeRecipeV2 =
  createExternalNmosRecipe(EXTERNAL_RECIPE_V31_DIRECT_GATE);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED: NativeRecipeV2 =
  createExternalNmosRecipe(EXTERNAL_RECIPE_V31_DIRECT_GATE_CAPACITOR_ROLE_QUALIFIED);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_INTERFACE_QUALIFIED: NativeRecipeV2 =
  createExternalNmosRecipe(EXTERNAL_RECIPE_V31_INTERFACE_QUALIFIED);
export const MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED: NativeRecipeV2 =
  createExternalNmosRecipe(EXTERNAL_RECIPE_V31_TVS_VOLTAGE_QUALIFIED);
