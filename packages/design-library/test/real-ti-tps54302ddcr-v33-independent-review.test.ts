import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manufacturersJson from "../manufacturers.json";
import profileJson from "../parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json";
import {
  calculateBoardAreaV2,
  canonicalProfileNumberV2,
  designProfileContentHashV33,
  requiredAdmissionCheckIds,
  validateCommercialDataBoundary,
  validateDesignProfileV33,
  validateManufacturerRegistry,
  validateProfileAdmissionRulesV33,
  type DesignProfileV33,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV33<"power.integrated-synchronous-buck-regulator">;
const registry = manufacturersJson as ManufacturerRegistryV1;
const sources = {
  "ti-tps54302-datasheet": {
    sourceId: "ti-tps54302-datasheet",
    contentHash: "sha256:1632b388d1ba3a46c8e8f090ddfec2114c0f538cfb8364ddcda583fee3fdbdc5",
    url: "https://www.ti.com/lit/ds/symlink/tps54302.pdf",
    revision: "SLVSDG6C, May 2016 – revised March 2026",
    retrievedAt: "2026-08-24T02:16:17+10:00",
    kind: "manufacturer_datasheet",
  },
  "ti-tps54302-product": {
    sourceId: "ti-tps54302-product",
    contentHash: "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0",
    url: "https://www.ti.com/product/TPS54302",
    revision: "retrieved product page, 2026-08-24",
    retrievedAt: "2026-08-24T11:13:12+10:00",
    kind: "manufacturer_product_page",
  },
  "ti-tps54302-webench-bxl": {
    sourceId: "ti-tps54302-webench-bxl",
    contentHash: "sha256:d877128565f6d15699b3079795906ec814f5722ccc3a9a5515bd5ee2919d8f1c",
    url: "https://webench.ti.com/cad/TI_BXL/TPS54302_DDC_6.bxl",
    revision: "TI WEBENCH exact-part BXL, 48946 bytes; decoded footprint DDC0006A_M (Most)",
    retrievedAt: "2026-08-26T08:17:22+10:00",
    kind: "manufacturer_product_page",
  },
} as const;
const bxlReview = {
  sourceBytes: 48_946,
  sourceContentHash: "sha256:d877128565f6d15699b3079795906ec814f5722ccc3a9a5515bd5ee2919d8f1c",
  decodedContentHash: "sha256:072b2af4ba077e8e83d70e38ec97a37ba442ab65c1d64d96a6edcf087621929f",
  component: "TPS54302DDCR",
  mostPattern: "DDC0006A_M",
  topCopperPadStack: "R10260470000200A",
  padWidthMil: 25.5906,
  padHeightMil: 47.2441,
  rotationDegrees: 90,
  xCentersMil: [-58.0709, 58.0708],
  yCentersMil: [-37.4015, 37.4016],
} as const;
const independentReview = {
  decision: "approve",
  reviewerTrack: "integration-data-review",
  reviewedBy: "codex-ti-tps54302ddcr-v33-independent-reviewer",
  reviewedAt: "2026-08-25T22:48:02Z",
  profileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
  checks: requiredAdmissionCheckIds("power.integrated-synchronous-buck-regulator")
    .map((checkId) => ({ checkId, status: "pass" as const })),
} as const;

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId === "string" && typeof record.locator === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

function factValue(fact: { value: unknown }): unknown {
  const value = fact.value;
  if (typeof value === "object" && value !== null && "value" in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function conditionSignature(fact: {
  validFor: readonly {
    parameterId: string;
    minimum?: { value: number; unit: string } | null;
    maximum?: { value: number; unit: string } | null;
  }[];
}): Array<[string, number | null, number | null, string | null]> {
  return fact.validFor.map((condition) => [
    condition.parameterId,
    condition.minimum?.value ?? null,
    condition.maximum?.value ?? null,
    condition.minimum?.unit ?? condition.maximum?.unit ?? null,
  ]);
}

describe("independent TI TPS54302DDCR facts 3.3.0 review", () => {
  it("pins the exact authored bytes, canonical identity, registry, and closed contracts", () => {
    expect(createHash("sha256").update(readFileSync(profilePath)).digest("hex"))
      .toBe("95adfb2814ab3786b6329ae6ac68c1463a5e9acd886b245d9a34f96793aa866d");
    expect(designProfileContentHashV33(profile)).toBe(independentReview.profileContentHash);
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    expect(validateDesignProfileV33(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV33(profile)).toEqual([]);
    expect(validateCommercialDataBoundary(profile)).toEqual([]);
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual(profile);

    expect(profile).toMatchObject({
      format: "schemagic-design-profile",
      schemaVersion: "1.0.0",
      partClass: "power.integrated-synchronous-buck-regulator",
      part: {
        manufacturerId: "texas-instruments",
        manufacturerPartNumber: "TPS54302DDCR",
      },
      factsSchemaVersion: "3.3.0",
    });
  });

  it("binds every reviewed fact, condition, and geometry term to the three captured TI primary sources", () => {
    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs.map((ref) => ref.sourceId))).toEqual(new Set(Object.keys(sources)));
    const tiManufacturer = registry.manufacturers.find((entry) => entry.manufacturerId === "texas-instruments");
    expect(tiManufacturer?.primaryEvidenceHosts).toContain("webench.ti.com");
    expect(sources["ti-tps54302-webench-bxl"].kind).toBe("manufacturer_product_page");
    expect(new URL(sources["ti-tps54302-webench-bxl"].url).hostname).toBe("webench.ti.com");
    for (const ref of refs) {
      expect(ref).toMatchObject(sources[ref.sourceId as keyof typeof sources]);
      expect(["webench.ti.com", "www.ti.com"]).toContain(new URL(ref.url!).hostname);
      expect(ref.publicationBasis).toBe("public_facts");
      expect(ref.licenseNote).toMatch(/(?:No .* is|is not) redistributed/);
    }

    expect([...new Set(refs.map((ref) => ref.locator))].sort()).toEqual([
      "captured TI TPS54302 product-page parametric table: Vout (max) = 26 V",
      "captured TI TPS54302 product-page parametric table: Vout (min) = 0.6 V",
      "decoded exact-part Component TPS54302DDCR, Most Pattern DDC0006A_M, TOP-copper x envelope: extreme R10260470000200A pad centers -58.0709 mil and +58.0708 mil plus rotated x half-extent 23.62205 mil give bounds -81.69295 mil to +81.69285 mil and span 163.38580 mil = 4.149999320 mm",
      "decoded exact-part Component TPS54302DDCR, Most Pattern DDC0006A_M, TOP-copper y envelope: extreme R10260470000200A pad centers -37.4015 mil and +37.4016 mil plus y half-extent 12.7953 mil give bounds -50.1968 mil to +50.1969 mil and span 100.3937 mil = 2.549999980 mm",
      "physical PDF page 12, section 6.3.10 Bootstrap Voltage, and physical PDF page 15, section 7.2.3.2 Bootstrap Capacitor Selection: a 0.1 uF ceramic capacitor must be connected between BOOT and SW",
      "physical PDF page 25, Package Option Addendum: exact active-production TPS54302DDCR row uses SOT-23-THIN package code DDC with 6 pins; physical PDF page 29, DDC0006A package outline",
      "physical PDF page 29, DDC0006A Package Outline: SOT-23 package maximum height 1.1 mm",
      "physical PDF page 4, section 5.1 Absolute Maximum Ratings: VIN maximum 30 V; note states absolute ratings do not imply functional operation",
      "physical PDF page 4, section 5.1 Absolute Maximum Ratings: operating-junction-temperature maximum 150 deg C",
      "physical PDF page 4, section 5.3 Recommended Operating Conditions: VIN input-voltage maximum 28 V",
      "physical PDF page 4, section 5.3 Recommended Operating Conditions: VIN input-voltage minimum 4.5 V",
      "physical PDF page 4, section 5.4 Thermal Information: DDC 6-pin RthetaJA junction-to-ambient thermal resistance 118.9 deg C/W",
      "physical PDF page 5, section 5.5 Current Limit: high-side maximum-inductor-peak-current limit I(LIM_HS) minimum 4 A, typical 5 A, and maximum 6 A",
      "physical PDF page 5, section 5.5 Electrical Characteristics table-wide condition: TJ = -40 deg C to 125 deg C",
      "physical PDF page 5, section 5.5 Electrical Characteristics table-wide condition: VIN = 4.5 V to 28 V",
      "physical PDF page 5, section 5.5 Feedback and Error Amplifier: VFB minimum 0.581 V, typical 0.596 V, and maximum 0.611 V at VIN = 12 V",
      "physical PDF page 5, section 5.5 Feedback and Error Amplifier: VFB production spread is specified at VIN = 12 V",
      "physical PDF page 5, section 5.5 Input Supply: IQ non-switching quiescent current typical 45 uA with EN = 5 V and VFB = 1 V",
      "physical PDF page 5, section 5.5 Oscillator: center switching-frequency minimum 290 kHz, typical 400 kHz, and maximum 510 kHz",
      "physical PDF page 5, section 5.5 Power Stage: R(HSD) test condition TA = 25 deg C",
      "physical PDF page 5, section 5.5 Power Stage: R(HSD) test condition VBST - VSW = 5 V",
      "physical PDF page 5, section 5.5 Power Stage: R(HSD) typical 85 milliohm at TA = 25 deg C and VBST - VSW = 5 V",
      "physical PDF page 5, section 5.5 Power Stage: R(LSD) test condition TA = 25 deg C",
      "physical PDF page 5, section 5.5 Power Stage: R(LSD) test condition VIN = 12 V",
      "physical PDF page 5, section 5.5 Power Stage: R(LSD) typical 40 milliohm at TA = 25 deg C and VIN = 12 V",
      "physical PDF page 5, section 5.6 Timing Requirements: tMIN_ON is measured at 90%-to-90% with 1 A loading",
      "physical PDF page 5, section 5.6 Timing Requirements: tMIN_ON nominal 110 ns, measured at 90%-to-90% with 1 A loading; footnote states not production tested",
      "physical PDF pages 1 and 8, Description and section 6.1 Overview: TPS54302 is a synchronous step-down buck converter",
      "physical PDF pages 1 and 8, Description and section 6.1 Overview: two integrated switching N-channel FETs",
      "physical PDF pages 1 and 8, sections 1 Features, 3 Description, and 6.1 Overview: integrated MOSFETs support continuous output currents up to 3 A",
      "physical PDF pages 1, 8, and 10, Features, section 6.1 Overview, and section 6.3.3 Error Amplifier: optimized internal compensation network",
      "physical PDF pages 1, 8, and 9, Features, section 6.1 Overview, and section 6.3.1 Fixed-Frequency PWM Control: fixed 400 kHz center switching frequency",
    ].sort());
    expect(JSON.stringify(profile)).not.toContain("physical PDF page 11, section 6.3.10");
  });

  it("locks every electrical value and its evidence role without promoting observations into guarantees", () => {
    const values = Object.fromEntries(Object.entries(profile.facts)
      .filter(([factId]) => factId !== "mountedGeometry")
      .map(([factId, fact]) => [factId, factValue(fact)]));
    expect(values).toEqual({
      converterTopology: "synchronous_buck",
      powerStage: "integrated_fet",
      compensationArchitecture: "internal",
      inputVoltageOperatingMinimum: 4.5,
      inputVoltageOperatingMaximum: 28,
      inputVoltageAbsoluteMaximum: 30,
      outputVoltageOperatingMinimum: 0.6,
      outputVoltageOperatingMaximum: 26,
      outputCurrent: 3,
      outputCurrentRole: "continuous_capability_statement",
      switchingFrequencyArchitecture: "fixed_oscillator",
      switchingFrequencyMinimum: 290_000,
      switchingFrequencyNominal: 400_000,
      switchingFrequencyMaximum: 510_000,
      switchingFrequencyRole: "production_spread",
      feedbackReferenceMinimum: 0.581,
      feedbackReferenceTypical: 0.596,
      feedbackReferenceMaximum: 0.611,
      feedbackReferenceRole: "production_spread",
      currentLimitMinimum: 4,
      currentLimitTypical: 5,
      currentLimitMaximum: 6,
      currentLimitRole: "protection_threshold",
      minimumOnTime: 1.1e-7,
      minimumOnTimeRole: "typical_observation",
      minimumOffTime: null,
      minimumOffTimeRole: null,
      highSideOnResistance: 0.085,
      highSideOnResistanceRole: "typical_observation",
      lowSideOnResistance: 0.04,
      lowSideOnResistanceRole: "typical_observation",
      nonSwitchingSupplyCurrent: 0.000_045,
      nonSwitchingSupplyCurrentRole: "typical_observation",
      junctionToAmbientThermalResistance: 118.9,
      junctionToAmbientThermalResistanceRole: "test_characteristic",
      maximumJunctionTemperature: 423.15,
      bootstrapCapacitance: 1e-7,
      bootstrapCapacitanceRequirement: "required_nominal_value",
    });

    expect(profile.facts.compensationArchitecture.explanation).toContain("does not establish loop crossover");
    expect(profile.facts.outputVoltageOperatingMaximum.explanation).toContain("does not prove regulation");
    expect(profile.facts.outputCurrent.explanation).toContain("does not prove");
    expect(profile.facts.switchingFrequencyNominal.explanation).toContain("not a configurable recommendation");
    expect(profile.facts.currentLimitRole.explanation).toContain("not normal output-current capability");
    expect(profile.facts.minimumOnTime.explanation).toContain("not a guaranteed duty-cycle bound");
    expect(profile.facts.highSideOnResistance.explanation).toContain("not a guaranteed maximum");
    expect(profile.facts.nonSwitchingSupplyCurrent.explanation).toContain("not a switching or full-load loss model");
    expect(profile.facts.junctionToAmbientThermalResistance.explanation).toContain("does not predict junction temperature");
    expect(profile.facts.maximumJunctionTemperature.explanation).toContain("does not prove actual junction temperature");
    expect(profile.facts.bootstrapCapacitance.explanation).toContain("not a minimum effective-capacitance guarantee");

    expect(profile.facts.minimumOffTime).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(profile.facts.minimumOffTimeRole).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
  });

  it("retains the exact table-wide ranges, point conditions, and quantity-role pairings", () => {
    const facts = profile.facts;
    const conditioned = Object.fromEntries(Object.entries(facts)
      .filter(([factId, fact]) => factId !== "mountedGeometry" && "validFor" in fact && fact.validFor.length > 0)
      .map(([factId, fact]) => [factId, conditionSignature(fact)]));
    const tableRange = [
      ["junctionTemperature", 233.15, 398.15, "K"],
      ["supplyVoltage", 4.5, 28, "V"],
    ];
    const feedbackRange = [
      ["junctionTemperature", 233.15, 398.15, "K"],
      ["supplyVoltage", 12, 12, "V"],
    ];
    expect(conditioned).toEqual({
      switchingFrequencyMinimum: tableRange,
      switchingFrequencyNominal: tableRange,
      switchingFrequencyMaximum: tableRange,
      switchingFrequencyRole: tableRange,
      feedbackReferenceMinimum: feedbackRange,
      feedbackReferenceTypical: feedbackRange,
      feedbackReferenceMaximum: feedbackRange,
      feedbackReferenceRole: feedbackRange,
      currentLimitMinimum: tableRange,
      currentLimitTypical: tableRange,
      currentLimitMaximum: tableRange,
      currentLimitRole: tableRange,
      minimumOnTime: [["testCurrent", 1, 1, "A"]],
      minimumOnTimeRole: [["testCurrent", 1, 1, "A"]],
      highSideOnResistance: [
        ["ambientTemperature", 298.15, 298.15, "K"],
        ["testVoltage", 5, 5, "V"],
      ],
      highSideOnResistanceRole: [
        ["ambientTemperature", 298.15, 298.15, "K"],
        ["testVoltage", 5, 5, "V"],
      ],
      lowSideOnResistance: [
        ["ambientTemperature", 298.15, 298.15, "K"],
        ["supplyVoltage", 12, 12, "V"],
      ],
      lowSideOnResistanceRole: [
        ["ambientTemperature", 298.15, 298.15, "K"],
        ["supplyVoltage", 12, 12, "V"],
      ],
      nonSwitchingSupplyCurrent: tableRange,
      nonSwitchingSupplyCurrentRole: tableRange,
    });

    for (const [quantity, role] of [
      [facts.outputCurrent, facts.outputCurrentRole],
      [facts.switchingFrequencyMinimum, facts.switchingFrequencyRole],
      [facts.switchingFrequencyNominal, facts.switchingFrequencyRole],
      [facts.switchingFrequencyMaximum, facts.switchingFrequencyRole],
      [facts.feedbackReferenceMinimum, facts.feedbackReferenceRole],
      [facts.feedbackReferenceTypical, facts.feedbackReferenceRole],
      [facts.feedbackReferenceMaximum, facts.feedbackReferenceRole],
      [facts.currentLimitMinimum, facts.currentLimitRole],
      [facts.currentLimitTypical, facts.currentLimitRole],
      [facts.currentLimitMaximum, facts.currentLimitRole],
      [facts.minimumOnTime, facts.minimumOnTimeRole],
      [facts.highSideOnResistance, facts.highSideOnResistanceRole],
      [facts.lowSideOnResistance, facts.lowSideOnResistanceRole],
      [facts.nonSwitchingSupplyCurrent, facts.nonSwitchingSupplyCurrentRole],
      [facts.junctionToAmbientThermalResistance, facts.junctionToAmbientThermalResistanceRole],
      [facts.bootstrapCapacitance, facts.bootstrapCapacitanceRequirement],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("recomputes only the manufacturer land-pattern ranking proxy and package maximum height", () => {
    expect(profile.commonFacts).toMatchObject({
      packageName: { state: "reviewed", value: "SOT-23-THIN (DDC), 6-pin" },
      boardArea: { state: "unknown", value: null, evidence: [], validFor: [] },
      maximumHeight: { state: "unknown", value: null, evidence: [], validFor: [] },
    });

    const area = profile.facts.mountedGeometry.boardArea.value;
    expect(area?.sourceDimensions.map((dimension) => [
      dimension.axis,
      dimension.dimensionId,
      dimension.multiplier,
      dimension.maximum.value,
    ])).toEqual([
      ["x", "ddc0006a-m-top-copper-x-span", 1, 0.00414999932],
      ["y", "ddc0006a-m-top-copper-y-span", 1, 0.00254999998],
    ]);
    expect(area?.basis).toBe("manufacturer_recommended_land_pattern_bounding_box");
    expect(sources["ti-tps54302-webench-bxl"].contentHash).toBe(bxlReview.sourceContentHash);
    expect(sources["ti-tps54302-webench-bxl"].revision).toContain(`${bxlReview.sourceBytes} bytes`);
    expect(bxlReview).toMatchObject({
      decodedContentHash: "sha256:072b2af4ba077e8e83d70e38ec97a37ba442ab65c1d64d96a6edcf087621929f",
      component: "TPS54302DDCR",
      mostPattern: "DDC0006A_M",
      topCopperPadStack: "R10260470000200A",
      rotationDegrees: 90,
    });
    const milToMeters = 0.000_025_4;
    const decodedXSpan = canonicalProfileNumberV2(
      (bxlReview.xCentersMil[1] - bxlReview.xCentersMil[0] + bxlReview.padHeightMil) * milToMeters,
    );
    const decodedYSpan = canonicalProfileNumberV2(
      (bxlReview.yCentersMil[1] - bxlReview.yCentersMil[0] + bxlReview.padWidthMil) * milToMeters,
    );
    expect(decodedXSpan).toBe(0.00414999932);
    expect(decodedYSpan).toBe(0.00254999998);
    expect(canonicalProfileNumberV2(decodedXSpan * decodedYSpan)).toBe(0.000_010_582_498_183);
    expect(area?.area.value).toBe(0.000_010_582_498_183);
    expect(area && calculateBoardAreaV2(area.sourceDimensions)).toBe(area?.area.value);
    const areaRefs = evidenceRefs(profile.facts.mountedGeometry.boardArea);
    expect(new Set(areaRefs.map((ref) => ref.sourceId))).toEqual(new Set(["ti-tps54302-webench-bxl"]));
    expect(areaRefs.every((ref) => ref.url === sources["ti-tps54302-webench-bxl"].url)).toBe(true);
    expect(JSON.stringify(profile.facts.mountedGeometry.boardArea)).not.toContain("Example Board Layout");
    expect(JSON.stringify(profile.facts.mountedGeometry.boardArea)).not.toContain("physical PDF page 30");
    expect(profile.facts.mountedGeometry.boardArea.explanation).toContain("ranking proxy, not a placement or routing proof");
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0011, unit: "m", displayUnit: "1.1 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });
  });

  it("records an independent approval with every deterministic admission check passing", () => {
    expect(independentReview).toEqual({
      decision: "approve",
      reviewerTrack: "integration-data-review",
      reviewedBy: "codex-ti-tps54302ddcr-v33-independent-reviewer",
      reviewedAt: "2026-08-25T22:48:02Z",
      profileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
      checks: [
        { checkId: "class.power.integrated-synchronous-buck-regulator.facts_semantics", status: "pass" },
        { checkId: "contract.closed_profile", status: "pass" },
        { checkId: "contract.commercial_boundary", status: "pass" },
        { checkId: "contract.identity_path", status: "pass" },
        { checkId: "contract.profile_content_hash", status: "pass" },
        { checkId: "evidence.primary", status: "pass" },
        { checkId: "facts.reviewed_and_conditioned", status: "pass" },
        { checkId: "review.independent", status: "pass" },
      ],
    });
  });
});
