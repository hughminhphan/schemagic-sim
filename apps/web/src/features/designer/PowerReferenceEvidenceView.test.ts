import { describe, expect, it } from "vitest";
import { parseElectricalDesignRequestV2 } from "@opencircuit/design-schema";
import { assessPowerTps54302Evm716ReferenceEvidenceV1 } from "@opencircuit/power-designer/reference-evidence";
import { renderPowerReferenceEvidence } from "./PowerReferenceEvidenceView";

function exactBrowserEvidence() {
  const request = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: 12, unit: "V", displayUnit: "V" },
        nominal: { value: 12, unit: "V", displayUnit: "V" },
        maximum: { value: 12, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
      dcOutputVoltageRegulation: {
        minimum: { value: 4.7, unit: "V", displayUnit: "V" },
        maximum: { value: 5.3, unit: "V", displayUnit: "V" },
      },
      maximumOutputCurrent: { value: 0.2, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: 298.15, unit: "K", displayUnit: "°C" },
      switchingFrequency: {
        selection: "automatic",
        minimum: { value: 250_000, unit: "Hz", displayUnit: "kHz" },
        preferred: null,
        maximum: { value: 600_000, unit: "Hz", displayUnit: "kHz" },
      },
      maximumOutputRipple: { value: 0.03, unit: "V", displayUnit: "mV" },
      loadTransientTarget: null,
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
      maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: false,
    },
    assumptions: [{
      id: "reference-view-test.conditions",
      description: "The fixture fixes the exact browser point used by the reference-evidence view test.",
      source: "fixture",
      affects: ["referenceDesignEvidence"],
    }],
    libraryVersion: "reference-view-test",
  });
  if (request.application !== "power.buck") throw new Error("Expected a Power request");
  return assessPowerTps54302Evm716ReferenceEvidenceV1(request);
}

describe("Power reference-evidence view", () => {
  it("shows only the exact unattested reference lane and explicit BOM mismatch", () => {
    const html = renderPowerReferenceEvidence(exactBrowserEvidence());

    expect(html).toContain("data-power-reference-evidence");
    expect(html).toContain("REFERENCE ONLY · NOT CANDIDATE EVIDENCE");
    expect(html).toContain("TPS54302EVM-716 reference observations");
    expect(html).toContain("PWR716-003 · SLVUAP9B Rev. B");
    expect(html).toContain("Identity asserted but unattested");
    expect(html).toContain("Request-relevant observations</dt><dd>2");
    expect(html).toContain("Strict rules closed</dt><dd>0");
    expect(html).toContain("Strict rules still blocked</dt><dd>13");
    expect(html).toContain("power.reference.tps54302evm716.tested-operating-envelope");
    expect(html).toContain("power.reference.tps54302evm716.load-regulation");
    expect(html).toContain("TPS54302DDC");
    expect(html).toContain("7447714100 · 10uH");
    expect(html).toContain("TPS54302DDCR");
    expect(html).toContain("F1F2-0804-100M · 10uH");
    expect(html).toContain("Exact MPN / BOM mismatch");
    expect(html).toContain("Both inductors are nominally 10uH; the mismatch is exact MPN and BOM identity, not nominal inductance.");
    expect(html).toContain("No eligibility, strict-rule, selected-part model, provider, sourcing, or commercial effect");
    expect(html).not.toMatch(/<a\b|href=|https?:\/\//u);
  });

  it.each([
    ["unknown authority field", (value: Record<string, any>) => { value.strictConstraintAuthority = true; }],
    ["authority escalation", (value: Record<string, any>) => { value.boundaries.candidateEligibilityAuthority = true; }],
    ["candidate identity assertion", (value: Record<string, any>) => { value.candidateAssessment.identityState = "asserted_reference_identity_unattested"; }],
    ["candidate observation injection", (value: Record<string, any>) => { value.candidateAssessment.referenceObservationIdsAtRequestedConditions = ["power.reference.tps54302evm716.load-regulation"]; }],
    ["strict closure injection", (value: Record<string, any>) => { value.requestAssessment.strictClosedRuleIds = ["power.regulator.output-current"]; }],
    ["BOM match escalation", (value: Record<string, any>) => { value.bomComparison.matchesInstalledCandidate = true; }],
  ])("withholds observations for %s", (_label, mutate) => {
    const unsafe = structuredClone(exactBrowserEvidence()) as unknown as Record<string, any>;
    mutate(unsafe);
    const html = renderPowerReferenceEvidence(unsafe);

    expect(html).toContain("data-power-reference-evidence-invalid");
    expect(html).toContain("Reference evidence withheld");
    expect(html).not.toContain("power.reference.tps54302evm716.load-regulation");
    expect(html).not.toContain("TPS54302DDCR");
  });

  it("renders no lane when no transient auxiliary evidence exists", () => {
    expect(renderPowerReferenceEvidence(undefined)).toBe("");
  });
});
