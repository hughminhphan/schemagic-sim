import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.full-bridge-gate-driver/microchip-technology/MIC4606-2YML-T5.json";
import {
  designProfileContentHashV31,
  validateDesignProfileV31,
  validateProfileAdmissionRulesV31,
  type DesignProfileV31,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profile = profileJson as unknown as DesignProfileV31<"motor.full-bridge-gate-driver">;
const source = {
  sourceId: "microchip-mic4606-ds20005604d",
  contentHash: "sha256:7dcc8f38545bd09168bbbd460ca0b4b5e662647d000ea708ad307b91e2c6aa8e",
  url: "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-Data-Sheet-DS20005604D.pdf",
  revision: "DS20005604D, 2017-2019",
} as const;
const registry = {
  format: "schemagic-manufacturer-registry",
  schemaVersion: "1.0.0",
  manufacturers: [{
    manufacturerId: "microchip-technology",
    displayName: "Microchip Technology Inc.",
    primaryEvidenceHosts: ["ww1.microchip.com"],
  }],
} as ManufacturerRegistryV1;

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (record.kind === "manufacturer_datasheet" && typeof record.sourceId === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

describe("exact Microchip MIC4606-2YML-T5 facts 3.1.0 profile", () => {
  it("admits only the source-bounded full-bridge driver facts and exact package geometry", () => {
    expect(validateDesignProfileV31(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV31(profile)).toEqual([]);

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(new URL("../schema/", import.meta.url).pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3-1.schema.json");
    expect(validateSchema, "facts 3.1.0 profile schema must exist").toBeDefined();
    expect(validateSchema!(profile), JSON.stringify(validateSchema!.errors)).toBe(true);

    expect(profile.part).toEqual({
      manufacturerId: "microchip-technology",
      manufacturerPartNumber: "MIC4606-2YML-T5",
    });
    expect(profile.factsSchemaVersion).toBe("3.1.0");
    expect(designProfileContentHashV31(profile)).toBe("sha256:1fd9a7097dd7359f39cfd1fa285671d830ba9e544d16e37a34d28854efbb2f47");

    expect(profile.facts.bridgeTopology.value).toBe("full_bridge");
    expect(profile.facts.powerStage.value).toBe("external_n_channel_mosfet");
    expect(profile.facts.bridgeVoltageInterface.value).toBe("switch_node_only");
    expect(profile.facts.bridgeVoltageOperatingMaximum.value).toMatchObject({ value: 85, unit: "V" });
    expect(profile.facts.bridgeVoltageAbsoluteMaximum.value).toMatchObject({ value: 90, unit: "V" });
    expect(profile.facts.driverBiasSource.value).toBe("external_supply");
    expect(profile.facts.driverBiasInputMinimum.value).toMatchObject({ value: 5.5, unit: "V" });
    expect(profile.facts.driverBiasInputMaximum.value).toMatchObject({ value: 16, unit: "V" });
    expect(profile.facts.logicHighThresholdMaximum.value).toMatchObject({ value: 2.2, unit: "V" });
    expect(profile.facts.minimumPulseWidth.value).toMatchObject({ value: 5e-8, unit: "s" });
    expect(profile.facts.minimumPulseWidthRole.value).toBe("typical_observation");
    expect(profile.facts.sourceCurrent.value).toMatchObject({ value: 1, unit: "A" });
    expect(profile.facts.sinkCurrent.value).toMatchObject({ value: 1, unit: "A" });
    expect(profile.facts.deadTimeControl.value).toBe("adaptive");
    expect(profile.facts.highSideSupply.value).toBe("bootstrap");
    expect(profile.facts.continuousHighSideOnSupported.value).toBe(false);
    expect(profile.facts.highSideBiasCurrentMaximum.value).toMatchObject({ value: 0.0004, unit: "A" });
    expect(profile.facts.quiescentCurrent.value).toMatchObject({ value: 0.000235, unit: "A" });
    expect(profile.facts.junctionToAmbientThermalResistance.value).toMatchObject({ value: 51, unit: "K/W" });
    expect(profile.facts.maximumJunctionTemperature.value).toMatchObject({ value: 398.15, unit: "K" });
    expect(profile.facts.currentSenseInterface.value).toBe("none");

    for (const fact of [
      profile.facts.driverBiasOutputMinimum,
      profile.facts.driverBiasOutputMaximum,
      profile.facts.pwmMaximum,
      profile.facts.pwmMaximumRole,
      profile.facts.gatePullupResistance,
      profile.facts.gatePulldownResistance,
      profile.facts.deadTime,
      profile.facts.bootstrapMaximumDutyCycle,
      profile.facts.senseMaximumVoltage,
      profile.facts.localDecouplingMinimum,
    ]) {
      expect(fact).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    }

    expect(profile.facts.minimumPulseWidth.explanation).toContain("typical");
    expect(profile.facts.sourceCurrent.explanation).toContain("not a guaranteed minimum");
    expect(profile.facts.sinkCurrent.explanation).toContain("not a guaranteed minimum");
    expect(profile.facts.localDecouplingMinimum.explanation).toContain("strict open bound");
    expect(profile.facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.0000180625, unit: "m2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", maximum: { value: 0.00425, unit: "m" } },
        { axis: "y", maximum: { value: 0.00425, unit: "m" } },
      ],
    });
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0009, unit: "m", displayUnit: "0.850 +/- 0.050 mm maximum = 0.900 mm" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });

    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref).toMatchObject(source);
  });
});
