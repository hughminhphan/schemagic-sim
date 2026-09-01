import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { contentHash } from "../src/canonical";
import { createSyntheticReviewedProfile, SYNTHETIC_MANUFACTURER_REGISTRY } from "../src/fixtures";
import type { FactSpec } from "../src/specs";
import type { ProfileEvidenceRef, ProfileFact, ProfileQuantity, ProfileUnit } from "../src/types";
import type { MountedGeometryFactsV2 } from "../src/v2-types";
import { V31_PART_CLASS_SPECS } from "../src/v31-specs";
import { FACTS_SCHEMA_VERSION_V31, type DesignProfileV31 } from "../src/v31-types";
import {
  designProfileContentHashV31,
  parseDesignProfileV31,
  validateDesignProfileV31,
  validateProfileAdmissionRulesV31,
} from "../src/v3-validation";

const schemaRoot = new URL("../schema/", import.meta.url);
const profileSchemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3-1.schema.json";

function quantity<Unit extends ProfileUnit>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function unknown(explanation: string): ProfileFact<never> {
  return { value: null, state: "unknown", evidence: [], validFor: [], explanation };
}

function evidence(): ProfileEvidenceRef[] {
  const sourceId = "synthetic:gate-driver:3.1.0";
  return [{
    kind: "manufacturer_datasheet",
    sourceId,
    locator: "Synthetic gate-driver facts 3.1.0 fixture, table 1",
    licenseNote: "Synthetic fixture carrying no real component claim.",
    retrievedAt: "2026-08-24T00:00:00Z",
    contentHash: contentHash({ sourceId }),
    url: "https://synthetic-components.example.invalid/gate-driver-v3-1.pdf",
    revision: "fixture-v3-1",
    publicationBasis: "public_facts",
  }];
}

function reviewedFact(factId: string, spec: FactSpec, refs: ProfileEvidenceRef[]): ProfileFact<unknown> {
  const value = spec.kind === "quantity"
    ? quantity(factId === "bridgeVoltageOperatingMinimum" ? -0.3 : factId === "bridgeVoltageOperatingMaximum" ? 85 : factId === "bridgeVoltageAbsoluteMaximum" ? 90 : 1, spec.unit)
    : spec.kind === "boolean"
      ? true
      : spec.values?.[0] ?? "synthetic-reviewed-value";
  return {
    value,
    state: "reviewed",
    evidence: structuredClone(refs),
    validFor: [],
    explanation: `Synthetic reviewed ${factId} used only to exercise the closed contract.`,
  };
}

function mountedGeometry(refs: ProfileEvidenceRef[]): MountedGeometryFactsV2["mountedGeometry"] {
  return {
    boardArea: {
      value: {
        area: quantity(4e-6, "m2"),
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: quantity(2e-3, "m"), evidence: structuredClone(refs) },
          { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: quantity(2e-3, "m"), evidence: structuredClone(refs) },
        ],
      },
      state: "calculated",
      evidence: structuredClone(refs),
      validFor: [],
      explanation: "Canonical synthetic land-pattern bounding rectangle.",
    },
    maximumHeight: {
      value: { height: quantity(1e-3, "m"), basis: "manufacturer_package_maximum_in_surface_mount_orientation" },
      state: "reviewed",
      evidence: structuredClone(refs),
      validFor: [],
      explanation: "Synthetic reviewed maximum mounted height.",
    },
  };
}

function profile(): DesignProfileV31 {
  const v1 = createSyntheticReviewedProfile("motor.full-bridge-gate-driver");
  const refs = evidence();
  const facts = Object.fromEntries(Object.entries(V31_PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts)
    .map(([factId, spec]) => [factId, reviewedFact(factId, spec, refs)])) as Record<string, ProfileFact<unknown>>;
  facts.driverBiasSource!.value = "external_supply";
  facts.driverBiasOutputMinimum = unknown("An external-bias driver has no internal regulated bias-output minimum.");
  facts.driverBiasOutputMaximum = unknown("An external-bias driver has no internal regulated bias-output maximum.");
  facts.pwmMaximum = unknown("The synthetic source does not publish an independent PWM ceiling.");
  facts.pwmMaximumRole = unknown("No PWM ceiling means there is no associated evidence role.");
  facts.deadTimeControl!.value = "adaptive";
  facts.deadTime = unknown("Adaptive dead time is not represented as a fixed scalar.");
  facts.currentSenseInterface!.value = "none";
  facts.senseMaximumVoltage = unknown("The driver has no integrated current-sense input.");
  facts.gatePullupResistance = unknown("Source drive is represented by reviewed peak current.");
  facts.gatePulldownResistance = unknown("Sink drive is represented by reviewed peak current.");
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V31,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknown("Board area is represented by facts.mountedGeometry.") as typeof v1.commonFacts.boardArea,
      maximumHeight: unknown("Maximum height is represented by facts.mountedGeometry.") as typeof v1.commonFacts.maximumHeight,
    },
    facts: { ...facts, mountedGeometry: mountedGeometry(refs) },
  } as DesignProfileV31;
}

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function schemaValidator(): (input: unknown) => boolean {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const path of schemaFiles(schemaRoot.pathname)) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
  const validate = ajv.getSchema(profileSchemaId);
  if (!validate) throw new Error(`Missing AJV schema ${profileSchemaId}`);
  return (input: unknown) => Boolean(validate(input));
}

describe("Motor gate-driver facts 3.1.0 contract", () => {
  it("preserves every published V1, V2, and facts 3.0.0 schema lock", () => {
    const expected = {
      "profile-envelope.v1.schema.json": "ce18238edde40da40091c741b7a3ec2caab95c8931fa4f6906c7689f3db55421",
      "profile.v1.schema.json": "9647814a956b565339c5cb20c0b97dc220f7b8cb5e08430940bf1e9edaa552f5",
      "profile-envelope.facts-v2.schema.json": "d5d577bc81da5fe9904a7454845889a6dbc6902dcb2df0d51f8f8d26e058eaa4",
      "profile.facts-v2.schema.json": "374f075a13dc5ad4f3fef0a8191706779fb11d6b01c06a4c720151612c3d604e",
      "profile-envelope.facts-v3.schema.json": "357ca04198194c1bc8435a9f1e51ed404486df2a7d2a88e7aff9f451cc39b830",
      "profile.facts-v3.schema.json": "e98cc6577456d8bbf815446e4a9b5c8be2a530c37962e7c9eecdfb78fff9e9e3",
      "facts/shared.n-channel-power-mosfet.v3.schema.json": "7eb61930d6fa96be5533d8acdc0afd4e5c745ff44d2cae5416f1c34c028e078c",
      "facts/motor.supply-tvs-diode.v3.schema.json": "1c03f24682b2c599e63f030f90134f2b60491270c00e2cfe9296c534e800331d",
    } as const;
    for (const [relative, hash] of Object.entries(expected)) {
      const bytes = readFileSync(new URL(`../schema/${relative}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), relative).toBe(hash);
    }
  });

  it("parses and admits the exact selected class while preserving the outer envelope", () => {
    const input = profile();
    expect(validateDesignProfileV31(input, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV31(input)).toEqual([]);
    expect(schemaValidator()(input)).toBe(true);
    const parsed = parseDesignProfileV31(input, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.factsSchemaVersion).toBe("3.1.0");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileContentHashV31(parsed)).toMatch(/^sha256:[0-9a-f]{64}$/);
  }, 20_000);

  it("enforces exact-unknown inactive bias and sense branches in runtime and JSON Schema", () => {
    const validate = schemaValidator();
    const bias = profile();
    bias.facts.driverBiasOutputMinimum = structuredClone(bias.facts.driverBiasInputMinimum);
    expect(validateDesignProfileV31(bias, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "inactive_branch_must_be_unknown" }));
    expect(validate(bias)).toBe(false);

    const sense = profile();
    sense.facts.senseMaximumVoltage = structuredClone(sense.facts.logicHighThresholdMaximum);
    expect(validateDesignProfileV31(sense, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "inactive_branch_must_be_unknown" }));
    expect(validate(sense)).toBe(false);
  }, 20_000);

  it("requires timing and source/sink capability alternatives without promoting unknowns", () => {
    const timing = profile();
    timing.facts.minimumPulseWidth = unknown("No timing bound is published.");
    timing.facts.minimumPulseWidthRole = unknown("No timing quantity means there is no timing evidence role.");
    expect(validateProfileAdmissionRulesV31(timing)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "facts.pwmMaximum.state", code: "missing_capability_group" }),
      expect.objectContaining({ path: "facts.minimumPulseWidth.state", code: "missing_capability_group" }),
    ]));

    const source = profile();
    source.facts.sourceCurrent = unknown("No source current is published.");
    expect(validateProfileAdmissionRulesV31(source)).toContainEqual(expect.objectContaining({ path: "facts.sourceCurrent.state", code: "missing_capability_group" }));

    const calculated = profile();
    calculated.facts.bootstrapMaximumDutyCycle.state = "calculated";
    expect(validateProfileAdmissionRulesV31(calculated)).toContainEqual(expect.objectContaining({ path: "facts.bootstrapMaximumDutyCycle.state", code: "invalid_optional_state" }));

    const mismatchedRole = profile();
    mismatchedRole.facts.minimumPulseWidthRole = unknown("A reviewed timing observation cannot omit its evidence role.");
    expect(validateDesignProfileV31(mismatchedRole, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "timing_role_mismatch" }));
  });

  it("requires fixed dead time but permits adaptive dead time to remain explicit unknown", () => {
    const fixed = profile();
    fixed.facts.deadTimeControl.value = "fixed";
    expect(validateProfileAdmissionRulesV31(fixed)).toContainEqual(expect.objectContaining({ path: "facts.deadTime.state", code: "not_reviewed" }));

    const adaptive = profile();
    expect(validateProfileAdmissionRulesV31(adaptive)).toEqual([]);
  });

  it("rejects unsupported class/version tuples without changing facts 3.0.0", () => {
    const input = profile();
    expect(validateDesignProfileV31({ ...input, factsSchemaVersion: "3.0.0" }, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "invalid_facts_version" }));
    expect(validateDesignProfileV31({ ...input, partClass: "motor.supply-tvs-diode" }, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "invalid_part_class" }));
  });
});
