import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  designProfileId,
  planDesignProfileFactsV1ToV2,
  type MountedGeometryFactsV2,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedProfile } from "../src/fixtures";

function mountedGeometry(): MountedGeometryFactsV2["mountedGeometry"] {
  const evidence = structuredClone(createSyntheticReviewedProfile("shared.switching-diode").commonFacts.packageName.evidence);
  return {
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
      value: {
        height: { value: 5e-4, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      state: "reviewed",
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Reviewed maximum package height in mounting orientation.",
    },
  };
}

describe("facts-V1 to facts-V2 authored migration planning", () => {
  it("copies non-Power facts byte-for-byte and becomes ready only with admissible authored geometry", () => {
    const source = createSyntheticReviewedProfile("shared.switching-diode");
    source.part.manufacturerPartNumber = "EXACT\u0000/\u202eMPN";
    const plan = planDesignProfileFactsV1ToV2(source, {
      mountedGeometry: mountedGeometry(),
      powerClaims: null,
    }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(plan.status).toBe("ready_for_authored_v2");
    expect(plan.unresolvedPaths).toEqual([]);
    expect(plan.sourceProfileId).toBe(designProfileId(source.partClass, source.part));
    expect(plan.draft?.part).toEqual(source.part);
    expect(plan.draft?.factsSchemaVersion).toBe("2.0.0");
    const draftFacts = { ...(plan.draft!.facts as Record<string, unknown>) };
    delete draftFacts.mountedGeometry;
    expect(canonicalJson(draftFacts)).toBe(canonicalJson(source.facts));
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.draft)).toBe(true);
  });

  it("returns exact sorted geometry gaps and no draft when mandatory authored geometry is absent", () => {
    const source = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    const plan = planDesignProfileFactsV1ToV2(source, { mountedGeometry: null, powerClaims: null }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(plan).toMatchObject({
      status: "needs_evidence",
      draft: null,
      unresolvedPaths: [
        "/facts/mountedGeometry/boardArea",
        "/facts/mountedGeometry/maximumHeight",
      ],
    });
  });

  it("reports inadmissible authored geometry instead of throwing or retaining a non-strict draft", () => {
    const source = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    const geometry = mountedGeometry();
    geometry.maximumHeight.state = "estimated";
    const plan = planDesignProfileFactsV1ToV2(source, { mountedGeometry: geometry, powerClaims: null }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(plan).toMatchObject({
      status: "needs_evidence",
      draft: null,
      unresolvedPaths: ["/facts/mountedGeometry/maximumHeight"],
    });
  });

  it("rejects unknown, accessor-bearing, and cross-class overrides before construction", () => {
    const source = createSyntheticReviewedProfile("shared.switching-diode");
    expect(() => planDesignProfileFactsV1ToV2(source, {
      mountedGeometry: mountedGeometry(), powerClaims: null, secret: "forbidden",
    }, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/Exact keys/);
    expect(() => planDesignProfileFactsV1ToV2(source, {
      mountedGeometry: mountedGeometry(), powerClaims: {},
    }, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/cross_class_override/);
    const hostile = { mountedGeometry: null, powerClaims: null };
    Object.defineProperty(hostile, "powerClaims", { enumerable: true, get: () => null });
    expect(() => planDesignProfileFactsV1ToV2(source, hostile, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/Accessors/);
  });

  it("never projects ambiguous Power V1 scalars and exposes exact mandatory authoring groups", () => {
    const integrated = createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator");
    const integratedPlan = planDesignProfileFactsV1ToV2(integrated, { mountedGeometry: mountedGeometry(), powerClaims: null }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(integratedPlan.draft).toBeNull();
    expect(integratedPlan.unresolvedPaths).toContain("/facts/currentLimitMinimum");
    expect(integratedPlan.unresolvedPaths).toContain("/facts/currentLimitTypical");
    expect(integratedPlan.unresolvedPaths).toContain("/facts/currentLimitMaximum");
    expect(integratedPlan.unresolvedPaths).not.toContain("/facts/riseTimeMaximum");
    expect(integratedPlan.unresolvedPaths).not.toContain("/facts/fallTimeMaximum");

    const external = createSyntheticReviewedProfile("power.external-fet-synchronous-buck-controller");
    const externalPlan = planDesignProfileFactsV1ToV2(external, { mountedGeometry: mountedGeometry(), powerClaims: null }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(externalPlan.draft).toBeNull();
    expect(externalPlan.unresolvedPaths).toEqual([...externalPlan.unresolvedPaths].sort());
    expect(externalPlan.unresolvedPaths).toEqual(expect.arrayContaining([
      "/facts/currentSenseThresholdOptions",
      "/facts/gateDriveVoltageOptions",
      "/facts/gateSourceCurrentMinimum",
      "/facts/gatePullupResistanceMaximum",
      "/facts/gateSinkCurrentMinimum",
      "/facts/gatePulldownResistanceMaximum",
    ]));
    expect(externalPlan.unresolvedPaths).not.toContain("/facts/controllerLossMaximum");
  });

  it("keeps missing Power conditions and configured groups in the plan instead of leaking parser errors", () => {
    const integrated = createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator");
    const integratedPlan = planDesignProfileFactsV1ToV2(integrated, {
      mountedGeometry: mountedGeometry(),
      powerClaims: {
        currentLimitMinimum: {
          claimKind: "guaranteed_minimum",
          basis: "production_spread",
          value: { value: 1, unit: "A", displayUnit: "A" },
          state: "estimated",
          evidence: [],
          validFor: [],
          explanation: "Incomplete authored migration fixture.",
        },
      },
    }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(integratedPlan.status).toBe("needs_evidence");
    expect(integratedPlan.draft).toBeNull();
    expect(integratedPlan.unresolvedPaths).toContain("/facts/currentLimitMinimum");
    expect(integratedPlan.unresolvedPaths).not.toContain("/facts/currentLimit");
    expect(integratedPlan.unresolvedPaths).not.toContain("/facts/currentLimitMinimum/state");

    const external = createSyntheticReviewedProfile("power.external-fet-synchronous-buck-controller");
    const externalPlan = planDesignProfileFactsV1ToV2(external, {
      mountedGeometry: mountedGeometry(),
      powerClaims: { currentSenseThresholdOptions: [], gateDriveVoltageOptions: [] },
    }, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(externalPlan.status).toBe("needs_evidence");
    expect(externalPlan.draft).toBeNull();
    expect(externalPlan.unresolvedPaths).toEqual(expect.arrayContaining([
      "/facts/currentSenseThresholdOptions",
      "/facts/gateDriveVoltageOptions",
    ]));
  });
});
