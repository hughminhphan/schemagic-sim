import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json";

const sourceHash = "sha256:87b049b09fbd42f87dc3b9bc89243ac3221420d528aa3005bb42333133eb1255";
const sourceUrl = "https://www.bourns.com/docs/product-datasheets/ptvs10-0xxc-sh.pdf";
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

describe("independent Bourns PTVS10-058C-SH facts-V3 review", () => {
  it("validates the real exact-MPN profile against the checked-in facts-V3 JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const schemaRoot = new URL("../schema/", import.meta.url);
    for (const path of schemaFiles(fileURLToPath(schemaRoot))) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validate = ajv.getSchema(schemaId);
    if (validate === undefined) throw new Error(`Missing AJV schema ${schemaId}`);

    expect(validate(profileJson), JSON.stringify(validate.errors)).toBe(true);
  });

  it("pins the reviewed manufacturer source and datasheet-derived footprint arithmetic", () => {
    const references = evidenceReferences(profileJson);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatchObject({
        sourceId: "bourns-ptvs10-0xxc-sh-datasheet",
        url: sourceUrl,
        contentHash: sourceHash,
        revision: "REV. 05/24",
        kind: "manufacturer_datasheet",
        publicationBasis: "public_facts",
      });
    }

    const geometry = profileJson.facts.mountedGeometry;
    const innerGap = geometry.boardArea.value.sourceDimensions[0]!;
    const padWidth = geometry.boardArea.value.sourceDimensions[1]!;
    const padLength = geometry.boardArea.value.sourceDimensions[2]!;
    const xSpan = innerGap.maximum.value * innerGap.multiplier
      + padWidth.maximum.value * padWidth.multiplier;
    const ySpan = padLength.maximum.value * padLength.multiplier;
    expect(geometry.boardArea.value.area.value).toBeCloseTo(xSpan * ySpan, 15);
    expect(xSpan).toBeCloseTo(0.0196, 15);
    expect(ySpan).toBeCloseTo(0.011, 15);
    expect(geometry.maximumHeight.value.height.value).toBe(0.011);

    expect(profileJson.facts.clampingVoltage.validFor)
      .toEqual(profileJson.facts.pulseCurrent.validFor);
    expect(profileJson.facts.pulseEnergy).toMatchObject({
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
    });
  });
});
