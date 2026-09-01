import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";

const sourceHash = "sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24";
const sourceUrl = "https://www.diodes.com/datasheet/download/ds40742.pdf";
const schemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3.schema.json";

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

describe("independent Diodes Incorporated 3.0SMCJ33CAQ facts-V3 review", () => {
  it("validates the exact-MPN profile against the checked-in facts-V3 JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const schemaRoot = new URL("../schema/", import.meta.url);
    for (const path of schemaFiles(schemaRoot.pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validate = ajv.getSchema(schemaId);
    if (validate === undefined) throw new Error(`Missing AJV schema ${schemaId}`);

    expect(validate(profileJson), JSON.stringify(validate.errors)).toBe(true);
  }, 20_000);

  it("independently pins the official source, ordering form, matched pulse conditions, and geometry arithmetic", () => {
    const references = evidenceReferences(profileJson);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatchObject({
        sourceId: "diodes-incorporated-3-0smcj-automotive-ds40742",
        url: sourceUrl,
        contentHash: sourceHash,
        revision: "DS40742 Rev. 12 - 2, May 2025",
        kind: "manufacturer_datasheet",
        publicationBasis: "public_facts",
      });
    }

    expect(profileJson.part).toEqual({
      manufacturerId: "diodes-incorporated",
      manufacturerPartNumber: "3.0SMCJ33CAQ",
    });
    expect(profileJson.commonFacts.packageName.evidence[0]?.locator).toMatch(/3\.0SMCJXX\(C\)AQ-13.*tape and reel/);
    expect(profileJson.facts.clampingVoltage.validFor).toEqual(profileJson.facts.pulseCurrent.validFor);
    expect(profileJson.facts.clampingVoltage.explanation).toMatch(/not an application-transient or energy-coordination claim/);
    expect(profileJson.facts.pulseEnergy).toMatchObject({
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
    });

    const geometry = profileJson.facts.mountedGeometry;
    const xSpan = geometry.boardArea.value.sourceDimensions
      .filter((dimension) => dimension.axis === "x")
      .reduce((sum, dimension) => sum + dimension.maximum.value * dimension.multiplier, 0);
    const ySpan = geometry.boardArea.value.sourceDimensions
      .filter((dimension) => dimension.axis === "y")
      .reduce((sum, dimension) => sum + dimension.maximum.value * dimension.multiplier, 0);
    expect(xSpan).toBeCloseTo(0.0094, 15);
    expect(ySpan).toBeCloseTo(0.0033, 15);
    expect(geometry.boardArea.value.area.value).toBeCloseTo(xSpan * ySpan, 15);
    expect(geometry.maximumHeight.value.height.value).toBe(0.00318);
  });
});
