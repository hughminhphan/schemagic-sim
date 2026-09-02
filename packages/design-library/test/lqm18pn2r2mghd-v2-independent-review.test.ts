import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/power.power-inductor/murata-manufacturing/LQM18PN2R2MGHD.json";
import manufacturers from "../manufacturers.json";
import {
  calculateBoardAreaV2,
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type BoardAreaDimensionTermV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const sourceHash = "sha256:45772af46c96008eb257628096f3210548bc0642c7157e5ca782a024d849c5f0";
const sourceUrl = "https://pim.murata.com/asset/pim4/inductor/JELF243B-0047_PDF_INDUCTOR?lastModifiedDatetime=20260706104530";
const schemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v2.schema.json";
const profile = profileJson as DesignProfileWithFactsV2<PartClassId, object>;
const registry = manufacturers as ManufacturerRegistryV1;

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function evidenceReferences(value: unknown): Array<Record<string, unknown>> {
  const references: Array<Record<string, unknown>> = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry !== "object" || entry === null) return;
    const record = entry as Record<string, unknown>;
    if (typeof record.sourceId === "string" && typeof record.locator === "string") {
      references.push(record);
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return references;
}

describe("independent Murata LQM18PN2R2MGHD facts-V2 evidence review", () => {
  it("passes the runtime and admission boundaries with a pinned canonical hash", () => {
    expect(profile.partClass).toBe("power.power-inductor");
    expect(profile.factsSchemaVersion).toBe("2.0.0");
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe(
      "sha256:28e212b3ba3490cf79cf48d3f1a4dd188c6dafdb495051cc9f84a932704a298b",
    );
  });

  it("satisfies the checked-in facts-V2 JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const schemaRoot = new URL("../schema/", import.meta.url);
    for (const path of schemaFiles(schemaRoot.pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validate = ajv.getSchema(schemaId);
    if (validate === undefined) throw new Error(`Missing AJV schema ${schemaId}`);

    expect(validate(profileJson), JSON.stringify(validate.errors)).toBe(true);
  });

  it("pins every factual claim to the exact official H-revision source bytes", () => {
    const references = evidenceReferences(profileJson);
    expect(references.length).toBe(16);
    for (const reference of references) {
      expect(reference).toMatchObject({
        sourceId: "murata-lqm18pn-jelf243b-0047h",
        url: sourceUrl,
        contentHash: sourceHash,
        revision: "JELF243B_0047H-01; official PIM asset last modified 2026-07-06",
        kind: "manufacturer_datasheet",
        publicationBasis: "public_facts",
      });
    }
  });

  it("matches the exact-MPN source row and does not promote typical values", () => {
    expect(profileJson.part.manufacturerId).toBe("murata-manufacturing");
    expect(profileJson.part.manufacturerPartNumber).toBe("LQM18PN2R2MGHD");
    expect(profileJson.commonFacts.packageName.value).toBe(
      "LQM18PN, 1.6 mm × 0.8 mm × 0.9 mm nominal, D paper-tape packaging",
    );
    expect(profileJson.commonFacts.packageName.evidence[0]?.locator).toContain(
      "section 2 part numbering maps D to taping",
    );
    expect(profileJson.commonFacts.packageName.evidence[0]?.locator).toContain(
      "section 5 gives 1.6 ±0.2 mm length, 0.8 ±0.2 mm width, and 0.9 ±0.1 mm height",
    );
    expect(profileJson.commonFacts.packageName.evidence[0]?.locator).toContain(
      "section 10 identifies 8 mm paper tape",
    );

    expect(profileJson.facts.inductance.value.value).toBe(2.2e-6);
    expect(profileJson.facts.inductance.evidence[0]?.locator).toContain("nominal inductance 2.2 µH ±20%");
    expect(profileJson.facts.inductance.validFor).toMatchObject([
      {
        parameterId: "switchingFrequency",
        minimum: { value: 1_000_000, unit: "Hz" },
        maximum: { value: 1_000_000, unit: "Hz" },
      },
      {
        parameterId: "testCurrent",
        minimum: { value: 0.001, unit: "A" },
        maximum: { value: 0.001, unit: "A" },
      },
    ]);
    expect(profileJson.facts.inductance.explanation).toContain("±20% tolerance");
    expect(profileJson.facts.inductance.explanation).toContain("1 MHz and 1 mA");

    expect(profileJson.facts.saturationCurrent.value.value).toBe(0.25);
    expect(profileJson.facts.rmsCurrent.value.value).toBe(1.05);
    expect(profileJson.facts.dcResistance.value.value).toBe(0.25);
    expect(profileJson.facts.saturationCurrent.evidence[0]?.locator).toContain(
      "inductance change within ±30% of initial value",
    );
    expect(profileJson.facts.rmsCurrent.evidence[0]?.locator).toContain(
      "self-heating temperature rise limited to 40 °C maximum",
    );
    expect(profileJson.facts.dcResistance.evidence[0]?.locator).toContain(
      "DC resistance 200 mΩ typical, 250 mΩ maximum",
    );
    expect(profileJson.facts.saturationCurrent.explanation).toContain("0.35 A typical");
    expect(profileJson.facts.rmsCurrent.explanation).toContain("1.15 A typical");

    for (const fact of [profileJson.facts.saturationCurrent, profileJson.facts.rmsCurrent, profileJson.facts.dcResistance]) {
      expect(fact.validFor).toMatchObject([{
        parameterId: "ambientTemperature",
        minimum: { value: 288.15, unit: "K" },
        maximum: { value: 308.15, unit: "K" },
      }]);
    }

    expect(profileJson.facts.maximumOperatingTemperature.value).toEqual({
      value: 398.15,
      unit: "K",
      displayUnit: "125 °C",
    });
    expect(profileJson.facts.maximumOperatingTemperature.evidence[0]?.locator).toContain(
      "ambient temperature plus self-generation of heat",
    );
    expect(profileJson.facts.maximumOperatingTemperature.explanation).toContain(
      "remain below 125 °C",
    );
  });

  it("selects the conservative land pattern and preserves unknown core loss", () => {
    const geometry = profileJson.facts.mountedGeometry;
    const [totalWidth, patternHeight] = geometry.boardArea.value.sourceDimensions;
    expect(geometry.boardArea).toMatchObject({
      state: "calculated",
      value: {
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        area: { value: 0.0000024, unit: "m2", displayUnit: "2.40 mm²" },
      },
    });
    expect(totalWidth?.dimensionId).toBe("recommended-pattern-total-width-b");
    expect(totalWidth?.maximum.value).toBe(0.002);
    expect(totalWidth?.evidence[0]?.locator).toContain("0.7 A to 1.15 A row specifies b = 2.0 mm");
    expect(patternHeight?.dimensionId).toBe("recommended-pattern-height-d");
    expect(patternHeight?.maximum.value).toBe(0.0012);
    expect(patternHeight?.evidence[0]?.locator).toContain(
      "0.7 A to 1.15 A row gives 1.2 mm for 18 µm copper and 0.7 mm for 35 µm or 70 µm copper",
    );
    expect(calculateBoardAreaV2(
      geometry.boardArea.value.sourceDimensions as readonly BoardAreaDimensionTermV2[],
    )).toBe(0.0000024);
    expect(geometry.maximumHeight.value.height.value).toBe(0.001);
    expect(geometry.maximumHeight.value.height.displayUnit).toBe("1.00 mm");
    expect(geometry.maximumHeight.evidence[0]?.locator).toContain(
      "mounted height 0.9 ±0.1 mm, giving a 1.0 mm maximum",
    );
    expect(profileJson.facts.coreLoss).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profileJson.facts.coreLossTestFrequency).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
  });
});
