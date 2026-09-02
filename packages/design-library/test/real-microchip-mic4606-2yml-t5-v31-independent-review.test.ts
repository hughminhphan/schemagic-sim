import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import manufacturersJson from "../manufacturers.json";
import profileJson from "../parts/motor.full-bridge-gate-driver/microchip-technology/MIC4606-2YML-T5.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV31,
  validateDesignProfileV31,
  validateManufacturerRegistry,
  validateProfileAdmissionRulesV31,
  type DesignProfileV31,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profile = profileJson as unknown as DesignProfileV31<"motor.full-bridge-gate-driver">;
const registry = manufacturersJson as ManufacturerRegistryV1;
const source = {
  sourceId: "microchip-mic4606-ds20005604d",
  contentHash: "sha256:7dcc8f38545bd09168bbbd460ca0b4b5e662647d000ea708ad307b91e2c6aa8e",
  url: "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-Data-Sheet-DS20005604D.pdf",
  revision: "DS20005604D, 2017-2019",
  kind: "manufacturer_datasheet",
  publicationBasis: "public_facts",
} as const;

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId === "string" && typeof record.locator === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

describe("independent Microchip MIC4606-2YML-T5 facts 3.1.0 review", () => {
  it("pins the exact source, source-bounded electrical roles, and package geometry", () => {
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    expect(validateDesignProfileV31(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV31(profile)).toEqual([]);

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(new URL("../schema/", import.meta.url).pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3-1.schema.json");
    expect(validateSchema).toBeTypeOf("function");
    expect(validateSchema!(profile), JSON.stringify(validateSchema!.errors)).toBe(true);

    expect(profile.part).toEqual({
      manufacturerId: "microchip-technology",
      manufacturerPartNumber: "MIC4606-2YML-T5",
    });
    expect(profile.partClass).toBe("motor.full-bridge-gate-driver");
    expect(profile.factsSchemaVersion).toBe("3.1.0");
    expect(profile.commonFacts.packageName.value).toBe("16-lead QFN, 4 mm x 4 mm (ML)");
    expect(profile.commonFacts.packageName.evidence[0]?.locator).toContain("ordering-description item f");
    expect(designProfileContentHashV31(profile)).toBe("sha256:1fd9a7097dd7359f39cfd1fa285671d830ba9e544d16e37a34d28854efbb2f47");

    const facts = profile.facts;
    expect(facts.bridgeTopology.value).toBe("full_bridge");
    expect(facts.powerStage.value).toBe("external_n_channel_mosfet");
    expect(facts.bridgeVoltageInterface.value).toBe("switch_node_only");
    expect(facts.bridgeVoltageOperatingMinimum.value?.value).toBe(-0.3);
    expect(facts.bridgeVoltageOperatingMaximum.value?.value).toBe(85);
    expect(facts.bridgeVoltageAbsoluteMaximum.value?.value).toBe(90);
    expect(facts.driverBiasSource.value).toBe("external_supply");
    expect(facts.driverBiasInputMinimum.value?.value).toBe(5.5);
    expect(facts.driverBiasInputMaximum.value?.value).toBe(16);
    expect(facts.driverBiasOutputMinimum).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.driverBiasOutputMaximum).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.logicHighThresholdMaximum.value?.value).toBe(2.2);

    expect(facts.pwmMaximum).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.pwmMaximumRole).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.minimumPulseWidth.value?.value).toBe(50e-9);
    expect(facts.minimumPulseWidthRole.value).toBe("typical_observation");
    expect(facts.minimumPulseWidth.validFor.map((condition) => condition.parameterId)).toEqual([
      "ambientTemperature",
      "bridgeVoltage",
      "driverBiasVoltage",
    ]);
    expect(facts.minimumPulseWidth.explanation).toContain("not promoted to a guaranteed timing bound");

    for (const driveCurrent of [facts.sourceCurrent, facts.sinkCurrent]) {
      expect(driveCurrent.value?.value).toBe(1);
      expect(driveCurrent.validFor.map((condition) => condition.parameterId)).toEqual([
        "ambientTemperature",
        "bridgeVoltage",
        "driverBiasVoltage",
        "testVoltage",
      ]);
      expect(driveCurrent.explanation).toContain("not a guaranteed minimum current");
    }
    expect(facts.sourceCurrent.validFor.at(-1)?.minimum?.value).toBe(12);
    expect(facts.sinkCurrent.validFor.at(-1)?.minimum?.value).toBe(0);
    expect(facts.gatePullupResistance).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.gatePulldownResistance).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });

    expect(facts.deadTimeControl.value).toBe("adaptive");
    expect(facts.deadTime).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.highSideSupply.value).toBe("bootstrap");
    expect(facts.continuousHighSideOnSupported.value).toBe(false);
    expect(facts.bootstrapMaximumDutyCycle).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.highSideBiasCurrentMaximum.value?.value).toBe(400e-6);
    expect(facts.highSideBiasCurrentMaximum.validFor.map((condition) => [
      condition.parameterId,
      condition.minimum?.value,
      condition.maximum?.value,
    ])).toEqual([
      ["bridgeVoltage", 0, 0],
      ["driverBiasVoltage", 12, 12],
      ["junctionTemperature", 233.15, 398.15],
      ["switchingFrequency", 20_000, 20_000],
    ]);

    expect(facts.quiescentCurrent.value?.value).toBe(235e-6);
    expect(facts.quiescentCurrent.explanation).toContain("typical");
    expect(facts.junctionToAmbientThermalResistance.value?.value).toBe(51);
    expect(facts.junctionToAmbientThermalResistance.explanation).toContain("not an application thermal prediction");
    expect(facts.maximumJunctionTemperature.value?.value).toBe(398.15);
    expect(facts.currentSenseInterface.value).toBe("none");
    expect(facts.senseMaximumVoltage).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.localDecouplingMinimum).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.localDecouplingMinimum.explanation).toContain("strict open bound");

    const boardArea = facts.mountedGeometry.boardArea.value;
    expect(boardArea?.basis).toBe("manufacturer_recommended_land_pattern_bounding_box");
    expect(boardArea?.sourceDimensions.map((dimension) => [dimension.axis, dimension.maximum.value])).toEqual([
      ["x", 0.00425],
      ["y", 0.00425],
    ]);
    expect(boardArea?.area.value).toBe(0.0000180625);
    expect(boardArea && calculateBoardAreaV2(boardArea.sourceDimensions)).toBe(boardArea?.area.value);
    expect(facts.mountedGeometry.maximumHeight.value?.height.value).toBe(0.0009);

    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatchObject(source);
      expect(new URL((ref as { url: string }).url).hostname).toBe("ww1.microchip.com");
    }
  });
});
