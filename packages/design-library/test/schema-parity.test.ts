import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  planDesignProfileFactsV1ToV2,
  validateDesignProfile,
  validateDesignProfileAdmission,
  validateDesignProfileEnvelope,
  validateManufacturerRegistry,
  type DesignProfileEnvelope,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "../src/fixtures";

const schemaRoot = new URL("../schema/", import.meta.url);

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function ajvProfileValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const path of schemaFiles(schemaRoot.pathname)) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
  return ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.v1.schema.json")!;
}

function v2SwitchingDiodeProfile(): DesignProfileEnvelope {
  const source = createSyntheticReviewedProfile("shared.switching-diode");
  const evidence = structuredClone(source.commonFacts.packageName.evidence);
  const plan = planDesignProfileFactsV1ToV2(source, {
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
        explanation: "Canonical manufacturer land-pattern rectangle.",
      },
      maximumHeight: {
        value: { height: { value: 5e-4, unit: "m", displayUnit: "mm" }, basis: "manufacturer_package_maximum_in_surface_mount_orientation" },
        state: "reviewed",
        evidence: structuredClone(evidence),
        validFor: [],
        explanation: "Reviewed maximum package height in mounting orientation.",
      },
    },
    powerClaims: null,
  }, SYNTHETIC_MANUFACTURER_REGISTRY);
  if (!plan.draft) throw new Error("Expected complete synthetic facts-V2 draft");
  return plan.draft;
}

describe("AJV 2020 runtime parity", () => {
  it("resolves every checked-in schema ID and all profile references", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const schemas = schemaFiles(schemaRoot.pathname).map((path) => JSON.parse(readFileSync(path, "utf8")));
    for (const schema of schemas) ajv.addSchema(schema);
    for (const schema of schemas) expect(ajv.getSchema(schema.$id), schema.$id).toBeTypeOf("function");
    expect(() => ajv.compile({ $ref: "https://schemas.schemagic.design/design-library/v1/profile.v1.schema.json" })).not.toThrow();
  }, 20_000);

  it("matches runtime rejection for state/value/evidence, vocabularies, numeric domains, and ranges", () => {
    const validateSchema = ajvProfileValidator();
    const cases: Array<{ label: string; profile: any; valid: boolean }> = [];
    const valid = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
    cases.push({ label: "valid", profile: valid, valid: true });

    const unknownWithClaims = structuredClone(valid);
    unknownWithClaims.facts.onResistance.state = "unknown";
    cases.push({ label: "unknown with value/evidence/ranges", profile: unknownWithClaims, valid: false });

    const knownWithoutEvidence = structuredClone(valid);
    knownWithoutEvidence.facts.onResistance.evidence = [];
    cases.push({ label: "known without evidence", profile: knownWithoutEvidence, valid: false });

    const invalidRatio = createSyntheticReviewedProfile("shared.mlcc-capacitor");
    invalidRatio.facts.biasDeratingRatio.value!.value = 1.01;
    cases.push({ label: "ratio above one", profile: invalidRatio, valid: false });

    const zeroRating = structuredClone(valid);
    zeroRating.facts.drainSourceVoltage.value!.value = 0;
    cases.push({ label: "non-positive rating", profile: zeroRating, valid: false });

    const invalidRangeUnit = structuredClone(valid);
    invalidRangeUnit.facts.onResistance.validFor[0]!.minimum!.unit = "A";
    cases.push({ label: "range unit mismatch", profile: invalidRangeUnit, valid: false });

    const missingRequiredRange = structuredClone(valid);
    missingRequiredRange.facts.onResistance.validFor = missingRequiredRange.facts.onResistance.validFor.filter((entry) => entry.parameterId !== "drainCurrent");
    cases.push({ label: "missing reviewed RDSon test current", profile: missingRequiredRange, valid: false });

    const invalidRangeDomain = structuredClone(valid);
    const duty = invalidRangeDomain.facts.pulsedDrainCurrent.validFor.find((entry: any) => entry.parameterId === "dutyCycle")!;
    duty.maximum!.value = 1.2;
    duty.minimum!.value = 1.2;
    cases.push({ label: "range ratio above one", profile: invalidRangeDomain, valid: false });

    const emptyRange = structuredClone(valid);
    emptyRange.facts.onResistance.validFor[0]!.minimum = null;
    emptyRange.facts.onResistance.validFor[0]!.maximum = null;
    cases.push({ label: "empty operating range", profile: emptyRange, valid: false });

    const invalidEnum = createSyntheticReviewedProfile("motor.integrated-h-bridge");
    invalidEnum.facts.bridgeTopology.value = "half_bridge" as never;
    cases.push({ label: "closed text vocabulary", profile: invalidEnum, valid: false });

    const invalidUrl = structuredClone(valid);
    invalidUrl.facts.onResistance.evidence[0]!.url = "https://#";
    cases.push({ label: "invalid absolute HTTPS URL", profile: invalidUrl, valid: false });

    for (const invalidTimestamp of ["2025-13-01T00:00:00Z", "2025-01-01T25:00:00Z", "2025-01-01T23:59:60Z"]) {
      const invalidDate = structuredClone(valid);
      invalidDate.facts.onResistance.evidence[0]!.retrievedAt = invalidTimestamp;
      cases.push({ label: `invalid timestamp ${invalidTimestamp}`, profile: invalidDate, valid: false });
    }

    const launderedPublication = structuredClone(valid);
    launderedPublication.facts.onResistance.evidence[0]!.kind = "independent_measurement";
    launderedPublication.facts.onResistance.evidence[0]!.publicationBasis = "public_facts";
    cases.push({ label: "independent evidence labeled public facts", profile: launderedPublication, valid: false });

    const signedTcr = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    signedTcr.facts.temperatureCoefficient.value!.value = -0.0002;
    cases.push({ label: "signed TCR", profile: signedTcr, valid: true });

    for (const testCase of cases) {
      const runtimeValid = validateDesignProfile(testCase.profile, SYNTHETIC_MANUFACTURER_REGISTRY).length === 0;
      const schemaValid = validateSchema(testCase.profile) as boolean;
      expect(runtimeValid, `${testCase.label}: runtime`).toBe(testCase.valid);
      expect(schemaValid, `${testCase.label}: ${JSON.stringify(validateSchema.errors)}`).toBe(testCase.valid);
    }
  });

  it("matches runtime structural rejection for the additive facts-V2 envelope", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(schemaRoot.pathname)) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v2.schema.json")!;
    const valid = v2SwitchingDiodeProfile();
    const cases: Array<{ label: string; profile: any; valid: boolean }> = [{ label: "valid", profile: valid, valid: true }];
    const missingGeometry: any = structuredClone(valid); delete missingGeometry.facts.mountedGeometry;
    cases.push({ label: "missing mounted geometry", profile: missingGeometry, valid: false });
    const legacyGeometry: any = structuredClone(valid); legacyGeometry.commonFacts.boardArea.state = "reviewed";
    cases.push({ label: "legacy scalar geometry not unknown", profile: legacyGeometry, valid: false });
    const wrongUnit: any = structuredClone(valid); wrongUnit.facts.mountedGeometry.boardArea.value.area.unit = "m";
    cases.push({ label: "wrong mounted-area unit", profile: wrongUnit, valid: false });
    const extra: any = structuredClone(valid); extra.facts.apiResponse = { secret: true };
    cases.push({ label: "extra/provider-shaped facts key", profile: extra, valid: false });
    for (const testCase of cases) {
      const runtimeValid = validateDesignProfileEnvelope(testCase.profile, SYNTHETIC_MANUFACTURER_REGISTRY).length === 0;
      const schemaValid = validateSchema(testCase.profile) as boolean;
      expect(runtimeValid, `${testCase.label}: runtime`).toBe(testCase.valid);
      expect(schemaValid, `${testCase.label}: ${JSON.stringify(validateSchema.errors)}`).toBe(testCase.valid);
      expect(runtimeValid, `${testCase.label}: bidirectional parity`).toBe(schemaValid);
    }
  }, 20_000);

  it("matches runtime bidirectionally for exact hostnames and raw canonical HTTPS URLs", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(schemaRoot.pathname)) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    const validateRegistrySchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/manufacturer-registry.v1.schema.json")!;
    const validateProfileSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.v1.schema.json")!;

    for (const { host, valid } of [
      { host: "a-b.example.com", valid: true },
      { host: "a..b", valid: false },
      { host: "-a.com", valid: false },
      { host: ".a.com", valid: false },
    ]) {
      const registry = structuredClone(SYNTHETIC_MANUFACTURER_REGISTRY);
      registry.manufacturers[0]!.primaryEvidenceHosts = [host];
      const runtimeValid = validateManufacturerRegistry(registry).length === 0;
      const schemaValid = validateRegistrySchema(registry) as boolean;
      expect(runtimeValid, `${host}: runtime`).toBe(valid);
      expect(schemaValid, `${host}: ${JSON.stringify(validateRegistrySchema.errors)}`).toBe(valid);
      expect(runtimeValid, `${host}: bidirectional parity`).toBe(schemaValid);
    }

    const officialHost = SYNTHETIC_MANUFACTURER_REGISTRY.manufacturers[0]!.primaryEvidenceHosts[0]!;
    for (const { url, valid } of [
      { url: `https://${officialHost}/document`, valid: true },
      { url: `https://${officialHost}/data%20sheet/rev%2Ftwo`, valid: true },
      { url: `https://${officialHost}/data%2fsheet?section=input%20range&rev=1#page-7/figure?x`, valid: true },
      { url: `https://${officialHost}?part=ABC%2F123#electrical`, valid: true },
      { url: "https://a..b/document", valid: false },
      { url: "https://-a.com/document", valid: false },
      { url: "https://.a.com/document", valid: false },
      { url: `HTTPS://${officialHost}/document`, valid: false },
      { url: `https://${officialHost}/document\n`, valid: false },
      { url: `https://${officialHost}/\\evil`, valid: false },
      { url: `https://${officialHost}/%zz`, valid: false },
      { url: `https://${officialHost}/{bad}`, valid: false },
      { url: `https://${officialHost}/|bad`, valid: false },
      { url: `https://${officialHost}/^bad`, valid: false },
      { url: `https://${officialHost}/\`bad`, valid: false },
      { url: `https://${officialHost}/[bad]`, valid: false },
    ]) {
      const profile = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
      profile.facts.onResistance.evidence[0]!.url = url;
      const runtimeValid = validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY).length === 0;
      const schemaValid = validateProfileSchema(profile) as boolean;
      expect(runtimeValid, `${JSON.stringify(url)}: runtime`).toBe(valid);
      expect(schemaValid, `${JSON.stringify(url)}: ${JSON.stringify(validateProfileSchema.errors)}`).toBe(valid);
      expect(runtimeValid, `${JSON.stringify(url)}: bidirectional parity`).toBe(schemaValid);
    }
  });

  it("matches admission-state and exact-check rejection", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(schemaRoot.pathname)) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/admission.v1.schema.json")!;
    const valid = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]).admission as any;
    const cases: Array<{ label: string; admission: any; valid: boolean }> = [{ label: "valid", admission: valid, valid: true }];
    const missing = structuredClone(valid); missing.entries[0].checks.pop();
    cases.push({ label: "missing check", admission: missing, valid: false });
    const stale = structuredClone(valid); stale.entries[0].checks[0].status = "not_run";
    cases.push({ label: "reviewed check not passed", admission: stale, valid: false });
    const incomplete = structuredClone(valid); incomplete.entries[0].reviewedAt = null;
    cases.push({ label: "incomplete reviewed state", admission: incomplete, valid: false });
    const nonIndependent = structuredClone(valid); nonIndependent.entries[0].reviewerTrack = nonIndependent.entries[0].ownerTrack;
    cases.push({ label: "same ownership track", admission: nonIndependent, valid: false });
    for (const testCase of cases) {
      expect(validateDesignProfileAdmission(testCase.admission).length === 0, `${testCase.label}: runtime`).toBe(testCase.valid);
      expect(validateSchema(testCase.admission), `${testCase.label}: ${JSON.stringify(validateSchema.errors)}`).toBe(testCase.valid);
    }
  });
});
