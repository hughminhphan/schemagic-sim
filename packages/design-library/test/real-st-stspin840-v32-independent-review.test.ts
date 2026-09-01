import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manufacturersJson from "../manufacturers.json";
import profileJson from "../parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV32,
  validateCommercialDataBoundary,
  validateDesignProfileV32,
  validateManufacturerRegistry,
  validateProfileAdmissionRulesV32,
  type DesignProfileV32,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV32<"motor.integrated-h-bridge">;
const registry = manufacturersJson as ManufacturerRegistryV1;
const source = {
  sourceId: "st-stspin840-docid031835-rev1",
  contentHash: "sha256:d2e0f820b7faf997987de18df0fe89bf83b7dc8c35a6a18856a961f8682e06ef",
  url: "https://st.com/resource/en/datasheet/stspin840.pdf",
  revision: "DocID031835 Rev 1, May 2018",
  retrievedAt: "2026-08-24T02:35:30.683Z",
  kind: "manufacturer_datasheet",
  publicationBasis: "public_facts",
  licenseNote: "Manufacturer-published factual data referenced by URL; the source document is not redistributed.",
} as const;
const independentReview = {
  decision: "approve",
  reviewerTrack: "integration-data-review",
  reviewedBy: "codex-st-stspin840-v32-independent-reviewer",
  reviewedAt: "2026-08-24T11:51:57Z",
  profileContentHash: "sha256:ff26581027998c75964057ab16342ad331c1c001d177a95a4e99aae7509387c2",
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

describe("independent STMicroelectronics STSPIN840 facts 3.2.0 review", () => {
  it("pins the admission identity, exact official source revision, and corrected canonical hash", () => {
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    expect(validateDesignProfileV32(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV32(profile)).toEqual([]);
    expect(validateCommercialDataBoundary(profile)).toEqual([]);
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual(profile);

    expect(profile).toMatchObject({
      format: "schemagic-design-profile",
      schemaVersion: "1.0.0",
      partClass: "motor.integrated-h-bridge",
      part: {
        manufacturerId: "stmicroelectronics",
        manufacturerPartNumber: "STSPIN840",
      },
      factsSchemaVersion: "3.2.0",
    });
    expect(profile.commonFacts.packageName.value).toBe("TFQFPN 4 x 4 x 1.05 - 24 L");
    expect(designProfileContentHashV32(profile)).toBe(independentReview.profileContentHash);
    expect(independentReview).toEqual({
      decision: "approve",
      reviewerTrack: "integration-data-review",
      reviewedBy: "codex-st-stspin840-v32-independent-reviewer",
      reviewedAt: "2026-08-24T11:51:57Z",
      profileContentHash: "sha256:ff26581027998c75964057ab16342ad331c1c001d177a95a4e99aae7509387c2",
    });
  });

  it("binds every reviewed fact, role, condition, and geometry term to the captured ST datasheet", () => {
    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatchObject(source);
      expect(new URL(ref.url!).hostname).toBe("st.com");
      expect(ref.locator).toMatch(/^physical PDF page(?:s)? /);
    }

    expect([...new Set(refs.map((ref) => ref.locator))].sort()).toEqual([
      "physical PDF page 1, Features and Description: dual full-bridge motor driver; PARALLEL mode drives a brushed DC motor by operating the two bridges in parallel",
      "physical PDF page 24, section 7 Layout recommendations: VS ceramic bypass capacitor is typically 330 nF and must be placed on the same side close to VS",
      "physical PDF page 24, section 7 Layout recommendations: a bulk capacitor could also be required, typically 33 uF",
      "physical PDF page 26, Figure 17 TFQFPN 4 x 4 x 1.05 - 24 L suggested footprint: overall horizontal and vertical land-pattern spans are each 4.65 mm",
      "physical PDF page 26, Table 10 TFQFPN package mechanical data: package height A maximum 1.10 mm",
      "physical PDF page 27, Table 11 Device summary: exact order code STSPIN840 uses package TFQFPN 4 x 4 x 1.05 - 24 L",
      "physical PDF page 5, Figure 1 block diagram: each bridge shows integrated P-channel high-side MOSFETs driven directly by the internal control logic and N-channel low-side MOSFETs, with no bootstrap or charge-pump block",
      "physical PDF page 6, Table 1 Absolute maximum ratings: IOUT,RMS continuous power-stage output current for each full bridge is 1.5 Arms",
      "physical PDF page 6, Table 1 Absolute maximum ratings: VS supply-voltage maximum 48 V",
      "physical PDF page 6, Table 1 Absolute maximum ratings: junction-temperature maximum 150 deg C",
      "physical PDF page 6, Table 2 Recommended operating conditions: VS supply-voltage maximum 45 V",
      "physical PDF page 6, Table 2 Recommended operating conditions: VS supply-voltage minimum 7 V",
      "physical PDF page 7, Table 3 Thermal data and note 1: RthJA 36.5 deg C/W in natural convection per JESD51-2a, simulated on a 76.2 x 114.3 x 1.6 mm 2s2p JEDEC board with vias underneath",
      "physical PDF page 8, Table 5 General: VS supply current maximum 3 mA with no commutations, ENx = '1', and RTOFF = 10 kohm",
      "physical PDF page 8, Table 5 Logic IO: VIH high logic level input voltage minimum 2 V under the table-wide VS = 36 V and Tj = 25 deg C conditions",
      "physical PDF page 8, Table 5 Power stage: total HS + LS on-resistance maximum 1.6 ohm at VS = 21 V, IOUT = 1 A, Tj = 150 deg C",
      "physical PDF page 8, Table 5 RDSon HS+LS maximum row: IOUT = 1 A",
      "physical PDF page 8, Table 5 RDSon HS+LS maximum row: Tj = 150 deg C",
      "physical PDF page 8, Table 5 RDSon HS+LS maximum row: VS = 21 V",
      "physical PDF page 8, section 3 Electrical characteristics: table-wide testing condition Tj = 25 deg C unless otherwise specified",
      "physical PDF page 8, section 3 Electrical characteristics: table-wide testing condition VS = 36 V unless otherwise specified",
      "physical PDF pages 1 and 14-15, Features and section 5.2 PARALLEL mode: two full bridges can be connected and operated in parallel",
      "physical PDF pages 1 and 5, Description and Figure 1 block diagram: dual full-bridge power MOSFET stage is integrated",
      "physical PDF pages 15-16, section 5.3 PWM current control: external sense resistor develops VSNSX and external VREFX sets the target using VREF = RSENSE x ILOAD,peak",
    ].sort());
  });

  it("locks the exact electrical value, evidence-role, and operating-condition matrix", () => {
    const facts = profile.facts;
    expect({
      bridgeTopology: facts.bridgeTopology.value,
      powerStage: facts.powerStage.value,
      bridgeOutputArchitecture: facts.bridgeOutputArchitecture.value,
      highSideDriveArchitecture: facts.highSideDriveArchitecture.value,
      supplyVoltageOperatingMinimum: facts.supplyVoltageOperatingMinimum.value?.value,
      supplyVoltageOperatingMaximum: facts.supplyVoltageOperatingMaximum.value?.value,
      supplyVoltageAbsoluteMaximum: facts.supplyVoltageAbsoluteMaximum.value?.value,
      logicHighThresholdMaximum: facts.logicHighThresholdMaximum.value?.value,
      continuousOutputCurrent: facts.continuousOutputCurrent.value?.value,
      continuousOutputCurrentRole: facts.continuousOutputCurrentRole.value,
      currentRegulationInterface: facts.currentRegulationInterface.value,
      pathResistance: facts.pathResistance.value?.value,
      pathResistanceRole: facts.pathResistanceRole.value,
      activeSupplyCurrent: facts.activeSupplyCurrent.value?.value,
      activeSupplyCurrentRole: facts.activeSupplyCurrentRole.value,
      junctionToAmbientThermalResistance: facts.junctionToAmbientThermalResistance.value?.value,
      maximumJunctionTemperature: facts.maximumJunctionTemperature.value?.value,
      localSupplyDecouplingCapacitance: facts.localSupplyDecouplingCapacitance.value?.value,
      localSupplyDecouplingRequirement: facts.localSupplyDecouplingRequirement.value,
      bulkCapacitance: facts.bulkCapacitance.value?.value,
      bulkCapacitanceRequirement: facts.bulkCapacitanceRequirement.value,
    }).toEqual({
      bridgeTopology: "full_bridge",
      powerStage: "integrated_fet",
      bridgeOutputArchitecture: "dual_full_bridge_parallel_capable",
      highSideDriveArchitecture: "p_channel_direct",
      supplyVoltageOperatingMinimum: 7,
      supplyVoltageOperatingMaximum: 45,
      supplyVoltageAbsoluteMaximum: 48,
      logicHighThresholdMaximum: 2,
      continuousOutputCurrent: 1.5,
      continuousOutputCurrentRole: "absolute_rating",
      currentRegulationInterface: "external_reference_and_sense",
      pathResistance: 1.6,
      pathResistanceRole: "guaranteed_maximum",
      activeSupplyCurrent: 0.003,
      activeSupplyCurrentRole: "guaranteed_maximum",
      junctionToAmbientThermalResistance: 36.5,
      maximumJunctionTemperature: 423.15,
      localSupplyDecouplingCapacitance: 3.3e-7,
      localSupplyDecouplingRequirement: "typical_observation",
      bulkCapacitance: 3.3e-5,
      bulkCapacitanceRequirement: "typical_observation",
    });

    expect(conditionSignature(facts.logicHighThresholdMaximum)).toEqual([
      ["junctionTemperature", 298.15, 298.15, "K"],
      ["supplyVoltage", 36, 36, "V"],
    ]);
    expect(conditionSignature(facts.pathResistance)).toEqual([
      ["junctionTemperature", 423.15, 423.15, "K"],
      ["supplyVoltage", 21, 21, "V"],
      ["testCurrent", 1, 1, "A"],
    ]);
    expect(conditionSignature(facts.activeSupplyCurrent)).toEqual([
      ["junctionTemperature", 298.15, 298.15, "K"],
      ["supplyVoltage", 36, 36, "V"],
    ]);

    for (const [quantity, role] of [
      [facts.continuousOutputCurrent, facts.continuousOutputCurrentRole],
      [facts.pathResistance, facts.pathResistanceRole],
      [facts.activeSupplyCurrent, facts.activeSupplyCurrentRole],
      [facts.localSupplyDecouplingCapacitance, facts.localSupplyDecouplingRequirement],
      [facts.bulkCapacitance, facts.bulkCapacitanceRequirement],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("keeps unsupported capabilities exact unknown and excludes all commercial/provider state", () => {
    const factRecords = profile.facts as unknown as Record<string, {
      state?: string;
      value?: unknown;
      evidence?: readonly unknown[];
      validFor?: readonly unknown[];
      explanation?: string;
    }>;
    const unknownFactIds = Object.entries(factRecords)
      .filter(([, fact]) => fact.state === "unknown")
      .map(([factId]) => factId)
      .sort();
    expect(unknownFactIds).toEqual([
      "continuousHighSideOnSupported",
      "minimumInputPulseWidth",
      "minimumInputPulseWidthRole",
      "peakOutputCurrent",
      "peakOutputCurrentRole",
      "pwmMaximum",
      "pwmMaximumRole",
      "switchingTransitionTime",
      "switchingTransitionTimeRole",
    ]);
    for (const factId of unknownFactIds) {
      expect(factRecords[factId]).toMatchObject({
        state: "unknown",
        value: null,
        evidence: [],
        validFor: [],
        explanation: expect.any(String),
      });
    }
    expect(profile.commonFacts.boardArea).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(profile.commonFacts.maximumHeight).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(validateCommercialDataBoundary(profile)).toEqual([]);
  });

  it("recomputes the exact TFQFPN footprint envelope and package-height maximum", () => {
    const mounted = profile.facts.mountedGeometry;
    const area = mounted.boardArea.value;
    expect(area).toMatchObject({
      area: { value: 0.0000216225, unit: "m2", displayUnit: "21.6225 mm2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", multiplier: 1, maximum: { value: 0.00465, unit: "m" } },
        { axis: "y", multiplier: 1, maximum: { value: 0.00465, unit: "m" } },
      ],
    });
    expect(area && calculateBoardAreaV2(area.sourceDimensions)).toBe(area?.area.value);
    expect(mounted.maximumHeight.value).toEqual({
      height: { value: 0.0011, unit: "m", displayUnit: "1.10 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });
  });
});
