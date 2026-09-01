import { describe, expect, it } from "vitest";
import {
  FACTS_SCHEMA_VERSION_V31,
  FACTS_SCHEMA_VERSION_V32,
  FACTS_SCHEMA_VERSION_V2,
  admissionContentHash,
  canonicalDesignProfileEnvelope,
  compareAscii,
  contentHash,
  designProfileEnvelopeContentHash,
  designProfileId,
  designProfilePath,
  getDesignProfileCodecForVersion,
  getBundledDesignLibraryDocuments,
  loadReviewedDesignLibrary,
  manufacturerRegistryContentHash,
  parseDesignProfileFor,
  reviewedAdmissionProjection,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileEnvelope,
  type DesignProfileFor,
  type DesignProfileV31,
  type DesignProfileV32,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type ManufacturerRegistryV1,
} from "@opencircuit/design-library";
import { SYNTHETIC_MANUFACTURER_ID, createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "@opencircuit/design-library/fixtures";
import {
  buildReviewedProfileCatalogV2,
  calculateReviewedProfileCatalogV2ContentHash,
  getReviewedProfilesForV2,
  parseReviewedProfileCatalogV2,
  type ReviewedProfileCatalogV2,
} from "../src";

function switchingDiodeV2(
  v1 = createSyntheticReviewedProfile("shared.switching-diode"),
): DesignProfileWithFactsV2<"shared.switching-diode", FactsV2For<"shared.switching-diode">> {
  const evidence = structuredClone(v1.commonFacts.packageName.evidence);
  const unknownGeometry = (label: string) => ({
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation: `${label} is represented only by facts.mountedGeometry in facts schema 2.0.0.`,
  });
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      ...structuredClone(v1.commonFacts),
      boardArea: unknownGeometry("Board area"),
      maximumHeight: unknownGeometry("Maximum height"),
    },
    facts: {
      ...structuredClone(v1.facts),
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions: [
              { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
              { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: { value: 2e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
            ],
          },
          state: "calculated",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Canonical reviewed manufacturer land-pattern rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 5e-4, unit: "m", displayUnit: "mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Reviewed maximum mounted package height.",
        },
      },
    },
  };
}

function gateDriverV31(
  v1 = createSyntheticReviewedProfile("motor.full-bridge-gate-driver"),
): DesignProfileV31<"motor.full-bridge-gate-driver"> {
  const evidence = structuredClone(v1.commonFacts.packageName.evidence);
  const reviewed = <Value>(value: Value, explanation: string) => ({
    value,
    state: "reviewed" as const,
    evidence: structuredClone(evidence),
    validFor: [],
    explanation,
  });
  const unknown = (explanation: string) => ({
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation,
  });
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V31,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknown("Facts 3.1 mounted geometry replaces the ambiguous V1 board-area scalar."),
      maximumHeight: unknown("Facts 3.1 mounted geometry replaces the ambiguous V1 height scalar."),
    },
    facts: {
      bridgeTopology: reviewed("full_bridge", "The driver controls a full bridge."),
      powerStage: reviewed("external_n_channel_mosfet", "The bridge uses external N-channel MOSFETs."),
      bridgeVoltageInterface: reviewed("motor_bus_supply_pin", "The driver exposes the motor-bus supply pin."),
      bridgeVoltageOperatingMinimum: reviewed({ value: 4, unit: "V", displayUnit: "V" }, "Reviewed bridge-voltage operating minimum."),
      bridgeVoltageOperatingMaximum: reviewed({ value: 40, unit: "V", displayUnit: "V" }, "Reviewed bridge-voltage operating maximum."),
      bridgeVoltageAbsoluteMaximum: reviewed({ value: 45, unit: "V", displayUnit: "V" }, "Reviewed absolute bridge-voltage maximum."),
      driverBiasSource: reviewed("external_supply", "The gate-driver bias is supplied externally."),
      driverBiasInputMinimum: reviewed({ value: 6, unit: "V", displayUnit: "V" }, "Reviewed external driver-bias minimum."),
      driverBiasInputMaximum: reviewed({ value: 12, unit: "V", displayUnit: "V" }, "Reviewed external driver-bias maximum."),
      driverBiasOutputMinimum: unknown("An external-bias driver has no internal bias-output minimum."),
      driverBiasOutputMaximum: unknown("An external-bias driver has no internal bias-output maximum."),
      logicHighThresholdMaximum: reviewed({ value: 2, unit: "V", displayUnit: "V" }, "Reviewed logic-high input threshold maximum."),
      pwmMaximum: reviewed({ value: 100_000, unit: "Hz", displayUnit: "kHz" }, "Reviewed PWM-frequency maximum."),
      pwmMaximumRole: reviewed("guaranteed_bound", "The synthetic PWM-frequency maximum is a guaranteed bound."),
      minimumPulseWidth: unknown("No minimum input pulse width is claimed by this synthetic profile."),
      minimumPulseWidthRole: unknown("No minimum pulse-width quantity means there is no evidence role."),
      sourceCurrent: reviewed({ value: 1, unit: "A", displayUnit: "A" }, "Reviewed gate-source current."),
      sinkCurrent: reviewed({ value: 1.5, unit: "A", displayUnit: "A" }, "Reviewed gate-sink current."),
      gatePullupResistance: unknown("No gate pull-up resistance is claimed by this synthetic profile."),
      gatePulldownResistance: unknown("No gate pull-down resistance is claimed by this synthetic profile."),
      deadTimeControl: reviewed("adaptive", "Dead time is controlled adaptively."),
      deadTime: unknown("Adaptive dead-time control has no fixed dead-time claim."),
      highSideSupply: reviewed("bootstrap", "The high-side supply uses a bootstrap circuit."),
      continuousHighSideOnSupported: reviewed(true, "Continuous high-side operation is supported."),
      bootstrapMaximumDutyCycle: unknown("No bootstrap duty-cycle ceiling is claimed by this synthetic profile."),
      highSideBiasCurrentMaximum: unknown("No high-side bias-current maximum is claimed by this synthetic profile."),
      quiescentCurrent: reviewed({ value: 1e-3, unit: "A", displayUnit: "mA" }, "Reviewed quiescent current."),
      junctionToAmbientThermalResistance: reviewed({ value: 40, unit: "K/W", displayUnit: "°C/W" }, "Reviewed junction-to-ambient thermal resistance."),
      maximumJunctionTemperature: reviewed({ value: 423.15, unit: "K", displayUnit: "°C" }, "Reviewed maximum junction temperature."),
      currentSenseInterface: reviewed("none", "The driver has no current-sense interface."),
      senseMaximumVoltage: unknown("A driver without a current-sense interface has no sense-voltage maximum."),
      localDecouplingMinimum: unknown("No local-decoupling minimum is claimed by this synthetic profile."),
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions: [
              { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
              { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: { value: 2e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
            ],
          },
          state: "calculated",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Canonical reviewed manufacturer land-pattern rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 1e-3, unit: "m", displayUnit: "mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Reviewed maximum mounted package height.",
        },
      },
    },
  } as DesignProfileV31<"motor.full-bridge-gate-driver">;
}

function integratedBridgeV32(
  v1 = createSyntheticReviewedProfile("motor.integrated-h-bridge"),
): DesignProfileV32<"motor.integrated-h-bridge"> {
  const evidence = structuredClone(v1.commonFacts.packageName.evidence);
  const reviewed = <Value>(value: Value, explanation: string) => ({
    value,
    state: "reviewed" as const,
    evidence: structuredClone(evidence),
    validFor: [],
    explanation,
  });
  const unknown = (explanation: string) => ({
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation,
  });
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknown("Facts 3.2 mounted geometry replaces the ambiguous V1 board-area scalar."),
      maximumHeight: unknown("Facts 3.2 mounted geometry replaces the ambiguous V1 height scalar."),
    },
    facts: {
      bridgeTopology: reviewed("full_bridge", "The device contains one full bridge."),
      powerStage: reviewed("integrated_fet", "The bridge FETs are integrated."),
      bridgeOutputArchitecture: reviewed("single_full_bridge", "The device exposes one full-bridge output."),
      highSideDriveArchitecture: reviewed("n_channel_charge_pump", "The integrated high side uses an N-channel charge-pump drive."),
      continuousHighSideOnSupported: reviewed(true, "Continuous high-side-on operation is supported."),
      supplyVoltageOperatingMinimum: reviewed({ value: 4.5, unit: "V", displayUnit: "V" }, "Reviewed supply operating minimum."),
      supplyVoltageOperatingMaximum: reviewed({ value: 36, unit: "V", displayUnit: "V" }, "Reviewed supply operating maximum."),
      supplyVoltageAbsoluteMaximum: reviewed({ value: 40, unit: "V", displayUnit: "V" }, "Reviewed absolute supply maximum."),
      logicHighThresholdMaximum: reviewed({ value: 2, unit: "V", displayUnit: "V" }, "Reviewed logic-high threshold maximum."),
      continuousOutputCurrent: reviewed({ value: 2, unit: "A", displayUnit: "A" }, "Reviewed guaranteed continuous-output limit."),
      continuousOutputCurrentRole: reviewed("guaranteed_operating_limit", "The continuous-current quantity is a guaranteed operating limit."),
      peakOutputCurrent: unknown("No separate peak-output-current claim is needed by this fixture."),
      peakOutputCurrentRole: unknown("An unknown peak-output-current quantity has no evidence role."),
      currentRegulationInterface: reviewed("none", "The fixture has no configured-current interface."),
      pwmMaximum: reviewed({ value: 100_000, unit: "Hz", displayUnit: "kHz" }, "Reviewed guaranteed PWM maximum."),
      pwmMaximumRole: reviewed("guaranteed_bound", "The PWM quantity is a guaranteed bound."),
      minimumInputPulseWidth: unknown("No minimum input-pulse-width claim is published by this fixture."),
      minimumInputPulseWidthRole: unknown("An unknown minimum input pulse has no evidence role."),
      pathResistance: reviewed({ value: 0.4, unit: "ohm", displayUnit: "Ω" }, "Reviewed maximum bridge-path resistance."),
      pathResistanceRole: reviewed("guaranteed_maximum", "The path resistance is a guaranteed maximum."),
      switchingTransitionTime: unknown("No switching-transition-time claim is published by this fixture."),
      switchingTransitionTimeRole: unknown("An unknown switching-transition time has no evidence role."),
      activeSupplyCurrent: reviewed({ value: 5e-3, unit: "A", displayUnit: "mA" }, "Reviewed active-supply-current maximum."),
      activeSupplyCurrentRole: reviewed("guaranteed_maximum", "The active supply current is a guaranteed maximum."),
      junctionToAmbientThermalResistance: reviewed({ value: 40, unit: "K/W", displayUnit: "°C/W" }, "Reviewed junction-to-ambient thermal resistance."),
      maximumJunctionTemperature: reviewed({ value: 423.15, unit: "K", displayUnit: "°C" }, "Reviewed maximum junction temperature."),
      localSupplyDecouplingCapacitance: reviewed({ value: 1e-7, unit: "F", displayUnit: "µF" }, "Reviewed local-decoupling minimum."),
      localSupplyDecouplingRequirement: reviewed("required_minimum", "The local-decoupling quantity is a required minimum."),
      bulkCapacitance: unknown("Bulk capacitance depends on the application."),
      bulkCapacitanceRequirement: reviewed("application_dependent", "The manufacturer leaves bulk capacitance application-dependent."),
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions: [
              { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
              { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: { value: 2e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
            ],
          },
          state: "calculated",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Canonical reviewed manufacturer land-pattern rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 1e-3, unit: "m", displayUnit: "mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Reviewed maximum mounted package height.",
        },
      },
    },
  } as DesignProfileV32<"motor.integrated-h-bridge">;
}

function refreshEnvelopeRelease(documents: DesignLibraryDocuments): void {
  const registry = documents.manufacturerRegistry as ManufacturerRegistryV1;
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  const profiles = release.profiles.map((entry) => documents.profiles[entry.profilePath] as DesignProfileEnvelope);
  release.manufacturerRegistryContentHash = manufacturerRegistryContentHash(registry);
  release.admissionContentHash = admissionContentHash(admission);
  release.contentHash = contentHash({
    manufacturerRegistry: registry,
    admission: reviewedAdmissionProjection(admission),
    profiles: [...profiles]
      .sort((left, right) => compareAscii(designProfilePath(left.partClass, left.part), designProfilePath(right.partClass, right.part)))
      .map((profile) => canonicalDesignProfileEnvelope(profile)),
  });
}

function mixedAllVersionsDocuments(): DesignLibraryDocuments {
  const documents = structuredClone(getBundledDesignLibraryDocuments()) as DesignLibraryDocuments;
  const synthetic = createSyntheticReviewedLibraryFixture([
    "motor.integrated-h-bridge",
    "shared.general-purpose-resistor",
  ]);
  const registry = documents.manufacturerRegistry as ManufacturerRegistryV1;
  const syntheticManufacturer = (synthetic.manufacturerRegistry as ManufacturerRegistryV1).manufacturers[0]!;
  if (!registry.manufacturers.some((entry) => entry.manufacturerId === syntheticManufacturer.manufacturerId)) {
    registry.manufacturers.push(structuredClone(syntheticManufacturer));
  }
  registry.manufacturers.sort((left, right) => compareAscii(left.manufacturerId, right.manufacturerId));

  const syntheticProfiles = Object.values(synthetic.profiles) as DesignProfileEnvelope[];
  const additions: DesignProfileEnvelope[] = syntheticProfiles.map((profile) =>
    profile.partClass === "motor.integrated-h-bridge"
      ? integratedBridgeV32(profile as ReturnType<typeof createSyntheticReviewedProfile<"motor.integrated-h-bridge">>)
      : profile
  );
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  for (const profile of additions) {
    const path = designProfilePath(profile.partClass, profile.part);
    const hash = designProfileEnvelopeContentHash(profile);
    (documents.profiles as Record<string, unknown>)[path] = profile;
    const sourceAdmission = (synthetic.admission as DesignProfileAdmissionLedgerV1).entries.find((entry) => entry.partClass === profile.partClass)!;
    admission.entries.push({ ...structuredClone(sourceAdmission), profileContentHash: hash });
    const sourceRelease = (synthetic.catalogRelease as DesignCatalogReleaseV1).profiles.find((entry) => entry.partClass === profile.partClass)!;
    release.profiles.push({ ...structuredClone(sourceRelease), profileContentHash: hash });
  }
  admission.entries.sort((left, right) => compareAscii(left.profilePath, right.profilePath));
  release.profiles.sort((left, right) => compareAscii(left.profileId, right.profileId));
  refreshEnvelopeRelease(documents);
  return documents;
}

function mixedDocuments(): DesignLibraryDocuments {
  const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor", "shared.switching-diode"]);
  const v1 = Object.values(documents.profiles).find((entry) => (entry as DesignProfileEnvelope).partClass === "shared.switching-diode") as ReturnType<typeof createSyntheticReviewedProfile<"shared.switching-diode">>;
  const profile = switchingDiodeV2(v1);
  const path = designProfilePath(profile.partClass, profile.part);
  (documents.profiles as Record<string, unknown>)[path] = profile;
  const hash = designProfileEnvelopeContentHash(profile);
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  admission.entries.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  release.profiles.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
  refreshEnvelopeRelease(documents);
  return documents;
}

function mixedV31Documents(): DesignLibraryDocuments {
  const documents = createSyntheticReviewedLibraryFixture([
    "motor.full-bridge-gate-driver",
    "shared.general-purpose-resistor",
    "shared.switching-diode",
  ]);
  const profiles = Object.values(documents.profiles) as DesignProfileEnvelope[];
  const gateDriverV1 = profiles.find((entry) => entry.partClass === "motor.full-bridge-gate-driver") as ReturnType<typeof createSyntheticReviewedProfile<"motor.full-bridge-gate-driver">>;
  const switchingDiodeV1 = profiles.find((entry) => entry.partClass === "shared.switching-diode") as ReturnType<typeof createSyntheticReviewedProfile<"shared.switching-diode">>;
  const replacements: DesignProfileEnvelope[] = [gateDriverV31(gateDriverV1), switchingDiodeV2(switchingDiodeV1)];
  for (const profile of replacements) {
    const path = designProfilePath(profile.partClass, profile.part);
    (documents.profiles as Record<string, unknown>)[path] = profile;
    const hash = designProfileEnvelopeContentHash(profile);
    const admission = documents.admission as DesignProfileAdmissionLedgerV1;
    admission.entries.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
    const release = documents.catalogRelease as DesignCatalogReleaseV1;
    release.profiles.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
  }
  refreshEnvelopeRelease(documents);
  return documents;
}

describe("versioned reviewed-profile catalog", () => {
  it("builds and parses a mixed V1/V2 catalog through exact versioned codecs", () => {
    const catalog = buildReviewedProfileCatalogV2(mixedDocuments());
    expect(parseReviewedProfileCatalogV2(catalog)).toEqual(catalog);
    expect(catalog.profiles.map((profile) => profile.factsSchemaVersion)).toEqual(["1.0.0", "2.0.0"]);

    const resistorV1: readonly DesignProfileFor<"shared.general-purpose-resistor">[] = getReviewedProfilesForV2(
      catalog,
      getDesignProfileCodecForVersion("shared.general-purpose-resistor", "1.0.0"),
    );
    const diodeV2: readonly DesignProfileWithFactsV2<"shared.switching-diode", FactsV2For<"shared.switching-diode">>[] = getReviewedProfilesForV2(
      catalog,
      getDesignProfileCodecForVersion("shared.switching-diode", "2.0.0"),
    );
    expect(resistorV1).toHaveLength(1);
    expect(diodeV2).toHaveLength(1);
    expect(diodeV2[0]!.facts.mountedGeometry.maximumHeight.state).toBe("reviewed");
    expect(getReviewedProfilesForV2(catalog, getDesignProfileCodecForVersion("shared.switching-diode", "1.0.0"))).toEqual([]);
    expect(getReviewedProfilesForV2(catalog, getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0"))).toEqual([]);
    expect(Object.isFrozen(diodeV2)).toBe(true);
    expect(Object.isFrozen(diodeV2[0])).toBe(true);
  });

  it("keeps facts-V1 loader and parser seams exact", () => {
    const documents = mixedDocuments();
    const profile = Object.values(documents.profiles).find((entry) => (entry as DesignProfileEnvelope).factsSchemaVersion === "2.0.0")!;
    expect(() => loadReviewedDesignLibrary(documents)).toThrow(/invalid_facts_version/);
    expect(() => parseDesignProfileFor(
      getDesignProfileCodecForVersion("shared.switching-diode", "1.0.0"),
      profile,
    )).toThrow(/invalid_facts_version/);
  });

  it("dispatches only the exact facts-3.1 full-bridge gate-driver tuple", () => {
    const catalog = buildReviewedProfileCatalogV2(mixedV31Documents());
    expect(parseReviewedProfileCatalogV2(catalog)).toEqual(catalog);

    const codec = getDesignProfileCodecForVersion("motor.full-bridge-gate-driver", FACTS_SCHEMA_VERSION_V31);
    const profiles: readonly DesignProfileV31<"motor.full-bridge-gate-driver">[] = getReviewedProfilesForV2(catalog, codec);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.factsSchemaVersion).toBe("3.1.0");
    expect(profiles[0]!.facts.bridgeVoltageInterface.value).toBe("motor_bus_supply_pin");
    expect(Object.isFrozen(profiles)).toBe(true);
    expect(Object.isFrozen(profiles[0])).toBe(true);
    expect(getReviewedProfilesForV2(catalog, getDesignProfileCodecForVersion("motor.full-bridge-gate-driver", "1.0.0"))).toEqual([]);
    expect(getReviewedProfilesForV2(catalog, getDesignProfileCodecForVersion("motor.full-bridge-gate-driver", "2.0.0"))).toEqual([]);

    const forgedClassCodec = { ...codec, partClass: "shared.general-purpose-resistor" };
    expect(() => getReviewedProfilesForV2(catalog, forgedClassCodec as never)).toThrow(/unknown_codec_version/);

    const { contentHash: _contentHash, ...payload } = structuredClone(catalog);
    const diode = payload.profiles.find((profile) => profile.partClass === "shared.switching-diode")!;
    (diode as { factsSchemaVersion: string }).factsSchemaVersion = FACTS_SCHEMA_VERSION_V31;
    const wrongClassCatalog = {
      ...payload,
      contentHash: calculateReviewedProfileCatalogV2ContentHash(payload),
    };
    expect(() => parseReviewedProfileCatalogV2(wrongClassCatalog)).toThrow();
  });

  it("dispatches a mixed V1/V2/V3/V3.1/V3.2/V3.3/V3.4 catalog deterministically and deeply freezes V3.2 selection", () => {
    const documents = mixedAllVersionsDocuments();
    const catalog = buildReviewedProfileCatalogV2(documents);
    expect(parseReviewedProfileCatalogV2(catalog)).toEqual(catalog);
    expect(new Set(catalog.profiles.map((profile) => profile.factsSchemaVersion))).toEqual(new Set([
      "1.0.0",
      "2.0.0",
      "3.0.0",
      "3.1.0",
      "3.2.0",
      "3.3.0",
      "3.4.0",
    ]));

    const codec = getDesignProfileCodecForVersion("motor.integrated-h-bridge", FACTS_SCHEMA_VERSION_V32);
    const profiles: readonly DesignProfileV32<"motor.integrated-h-bridge">[] = getReviewedProfilesForV2(catalog, codec);
    expect(profiles).toHaveLength(4);
    expect(profiles.map((profile) => designProfileId(profile.partClass, profile.part))).toEqual(
      profiles.map((profile) => designProfileId(profile.partClass, profile.part)).sort(compareAscii),
    );
    const syntheticProfile = profiles.find((profile) => profile.part.manufacturerId === SYNTHETIC_MANUFACTURER_ID)!;
    const reviewedDrv8262 = profiles.find((profile) => profile.part.manufacturerPartNumber === "DRV8262DDVR")!;
    const reviewedDrv8876 = profiles.find((profile) => profile.part.manufacturerPartNumber === "DRV8876PWPR")!;
    const reviewedStspin840 = profiles.find((profile) => profile.part.manufacturerPartNumber === "STSPIN840")!;
    expect(syntheticProfile.factsSchemaVersion).toBe("3.2.0");
    expect(syntheticProfile.facts.continuousOutputCurrentRole.value).toBe("guaranteed_operating_limit");
    expect(reviewedDrv8262.factsSchemaVersion).toBe("3.2.0");
    expect(reviewedDrv8262.facts.bridgeOutputArchitecture.value).toBe("dual_full_bridge_parallel_capable");
    expect(reviewedDrv8876.factsSchemaVersion).toBe("3.2.0");
    expect(reviewedDrv8876.facts.continuousOutputCurrentRole.value).toBeNull();
    expect(reviewedStspin840.factsSchemaVersion).toBe("3.2.0");
    expect(reviewedStspin840.facts.continuousOutputCurrentRole.value).toBe("absolute_rating");
    expect(Object.isFrozen(profiles)).toBe(true);
    for (const profile of profiles) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.facts)).toBe(true);
      expect(Object.isFrozen(profile.facts.mountedGeometry.boardArea.value)).toBe(true);
    }
    expect(getReviewedProfilesForV2(catalog, getDesignProfileCodecForVersion("motor.integrated-h-bridge", "1.0.0"))).toEqual([]);
    expect(getReviewedProfilesForV2(catalog, getDesignProfileCodecForVersion("motor.integrated-h-bridge", "2.0.0"))).toEqual([]);

    const reorderedDocuments = {
      ...documents,
      profiles: Object.fromEntries(Object.entries(documents.profiles).reverse()),
    };
    expect(buildReviewedProfileCatalogV2(reorderedDocuments)).toEqual(catalog);
  });

  it("rejects every wrong facts-3.2 class/version tuple even after catalog self-rehashing", () => {
    const catalog = buildReviewedProfileCatalogV2(mixedAllVersionsDocuments());
    const rejectReversion = (partClass: string, factsSchemaVersion: string): void => {
      const { contentHash: _contentHash, ...payload } = structuredClone(catalog);
      const profile = payload.profiles.find((entry) => entry.partClass === partClass)!;
      (profile as { factsSchemaVersion: string }).factsSchemaVersion = factsSchemaVersion;
      expect(() => parseReviewedProfileCatalogV2({
        ...payload,
        contentHash: calculateReviewedProfileCatalogV2ContentHash(payload),
      })).toThrow();
    };

    rejectReversion("motor.integrated-h-bridge", FACTS_SCHEMA_VERSION_V31);
    rejectReversion("motor.full-bridge-gate-driver", FACTS_SCHEMA_VERSION_V32);
    rejectReversion("shared.n-channel-power-mosfet", FACTS_SCHEMA_VERSION_V32);
    rejectReversion("motor.supply-tvs-diode", FACTS_SCHEMA_VERSION_V32);

    const codec = getDesignProfileCodecForVersion("motor.integrated-h-bridge", FACTS_SCHEMA_VERSION_V32);
    expect(() => getReviewedProfilesForV2(catalog, { ...codec, partClass: "motor.full-bridge-gate-driver" } as never)).toThrow(/unknown_codec_version/);
    expect(() => getReviewedProfilesForV2(catalog, { ...codec, factsSchemaVersion: FACTS_SCHEMA_VERSION_V31 } as never)).toThrow(/unknown_codec_version/);
  });

  it("rejects unknown embedded and forged codec facts versions", () => {
    const catalog = buildReviewedProfileCatalogV2(mixedDocuments());
    const { contentHash: _contentHash, ...payload } = structuredClone(catalog);
    (payload.profiles[1] as unknown as { factsSchemaVersion: string }).factsSchemaVersion = "3.0.0";
    const forgedCatalog = {
      ...payload,
      contentHash: calculateReviewedProfileCatalogV2ContentHash(payload as Omit<ReviewedProfileCatalogV2, "contentHash">),
    };
    expect(() => parseReviewedProfileCatalogV2(forgedCatalog)).toThrow();

    const forgedCodec = {
      ...getDesignProfileCodecForVersion("shared.general-purpose-resistor", "1.0.0"),
      factsSchemaVersion: "3.0.0",
    };
    expect(() => getReviewedProfilesForV2(catalog, forgedCodec as never)).toThrow(/unknown_codec_version/);
  });

  it("is independent of profile-file order and rejects reordered self-hashed catalogs", () => {
    const documents = mixedDocuments();
    const first = buildReviewedProfileCatalogV2(documents);
    const reorderedDocuments = {
      ...documents,
      profiles: Object.fromEntries(Object.entries(documents.profiles).reverse()),
    };
    const second = buildReviewedProfileCatalogV2(reorderedDocuments);
    expect(second).toEqual(first);
    expect(second.contentHash).toBe(first.contentHash);
    const ids = second.profiles.map((profile) => designProfileId(profile.partClass, profile.part));
    expect(ids).toEqual([...ids].sort(compareAscii));

    const { contentHash: _contentHash, ...payload } = structuredClone(first);
    payload.profiles.reverse();
    const reorderedCatalog = {
      ...payload,
      contentHash: calculateReviewedProfileCatalogV2ContentHash(payload),
    };
    expect(() => parseReviewedProfileCatalogV2(reorderedCatalog)).toThrow();
  });
});
