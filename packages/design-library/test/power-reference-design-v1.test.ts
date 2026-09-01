import { describe, expect, it } from "vitest";
import {
  TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1,
  calculatePowerReferenceDesignEvidenceContentHashV1,
} from "../src/power-reference-design-v1";

describe("Power reference-design evidence V1", () => {
  it("binds the official TPS54302EVM-716 published reference, BOM, layout locators, and observations", () => {
    const evidence = TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1;
    const { contentHash: _contentHash, ...payload } = evidence;

    expect(evidence.contentHash).toBe(calculatePowerReferenceDesignEvidenceContentHashV1(payload));
    expect(evidence.contentHash).toBe("sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb");
    expect(evidence.source).toMatchObject({
      documentId: "SLVUAP9B",
      revision: "Rev. B",
      contentHash: "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e",
    });
    expect(evidence.identity).toEqual({
      manufacturerId: "texas-instruments",
      referenceDesignId: "TPS54302EVM-716",
      assemblyId: "PWR716-003",
    });
    expect(evidence.bom).toHaveLength(19);
    expect(evidence.bom.reduce((sum, line) => sum + (line.populated ? line.quantity : 0), 0)).toBe(25);
    expect(evidence.bom.find((line) => line.designators.includes("U1"))).toMatchObject({
      populated: true,
      manufacturerPartNumber: "TPS54302DDC",
    });
    expect(evidence.bom.find((line) => line.designators.includes("L1"))).toMatchObject({
      nominalValue: "10uH",
      manufacturerPartNumber: "7447714100",
    });
    expect(evidence.bom.find((line) => line.designators.includes("C7"))).toMatchObject({
      quantity: 0,
      populated: false,
    });
    expect(evidence.observations).toHaveLength(10);
    expect(evidence.observations.every((observation) => observation.strictConstraintAuthority === false)).toBe(true);
    expect(evidence.scope).toEqual({
      identityAssertionAttestation: "none",
      physicalAssemblyQualificationAuthority: false,
      applicationAuthority: false,
      bomAndLayoutIdentityAuthority: "published_reference_only",
      layoutReference: {
        sourceContentHash: "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e",
        sourceLocators: [
          "SLVUAP9B, section 3.1 and Figure 3-1, pages 13-14",
          "SLVUAP9B, Figure 3-2, page 15",
          "SLVUAP9B, section 4.1 and Figure 4-1, page 16",
        ],
        evidenceRole: "published_layout_reference_only",
        attestation: "none",
      },
      productionPopulationCoverage: "not_claimed",
      selectedPartModelCoverage: "not_claimed",
      candidateEligibilityAuthority: false,
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.bom[0])).toBe(true);
    expect(Object.isFrozen(evidence.observations[0]?.conditions[0])).toBe(true);
  });

  it("keeps BOM designators and observation identities unique and source mappings explicit", () => {
    const evidence = TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1;
    const designators = evidence.bom.flatMap((line) => line.designators);
    const observationIds = evidence.observations.map((observation) => observation.id);

    expect(designators).toHaveLength(26);
    expect(new Set(designators).size).toBe(designators.length);
    expect(new Set(observationIds).size).toBe(observationIds.length);
    for (const line of evidence.bom) {
      expect(line.designators.length).toBeGreaterThan(0);
      expect(line.populated ? line.quantity : 0).toBe(line.populated ? line.designators.length : line.quantity);
    }
    expect(evidence.observations.every((observation) => observation.sourceLocator.startsWith("SLVUAP9B,"))).toBe(true);

    const centerFrequency = evidence.observations.find((observation) => (
      observation.id === "power.reference.tps54302evm716.center-switching-frequency"
    ));
    expect(centerFrequency?.conditions).toContainEqual({
      parameterId: "inputVoltage",
      range: {
        minimum: { value: 24, unit: "V" },
        maximum: { value: 24, unit: "V" },
      },
    });
    expect(centerFrequency?.sourceLocator).toContain("Table 1-2");
    expect(evidence.observations.find((observation) => observation.measurand === "efficiency")?.sourceLocator).toContain("95.57%");
    expect(evidence.observations.find((observation) => observation.measurand === "loadRegulation")?.sourceLocator).toContain("+/-0.5%");
    expect(evidence.observations.find((observation) => observation.measurand === "lineRegulation")?.sourceLocator).toContain("+/-0.5%");
    expect(evidence.observations.find((observation) => observation.measurand === "loadTransientVoltage")?.sourceLocator).toContain("150 mV magnitude and 150 us recovery");
  });
});
