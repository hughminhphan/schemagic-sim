import { describe, expect, it } from "vitest";
import * as browserRuntime from "../src/v2-runtime";
import { contentHash } from "../src/canonical";
import { TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1 } from "../src/power-reference-design-v1";
import {
  TPS54302EVM_716_REFERENCE_DESIGN_IDENTITY_ASSERTION_V1,
  TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1,
} from "../src/power-reference-design-runtime-v1";

function projectObservation(
  observation: typeof TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1.observations[number],
) {
  return {
    id: observation.id,
    measurand: observation.measurand,
    value: observation.value,
    range: observation.range,
    conditions: observation.conditions,
  };
}

describe("Power reference-design browser runtime V1", () => {
  it("exactly projects the canonical evidence identity and all condition-filtering data", () => {
    const evidence = TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1;
    const runtime = TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1;

    expect(runtime.identity).toEqual(evidence.identity);
    expect(runtime.document).toEqual({
      documentId: evidence.source.documentId,
      revision: evidence.source.revision,
      contentHash: evidence.source.contentHash,
    });
    expect(runtime.evidenceContentHash).toBe(evidence.contentHash);
    expect(runtime.bomContentHash).toBe(contentHash(evidence.bom));
    expect(runtime.layoutReferenceContentHash).toBe(contentHash(evidence.scope.layoutReference));
    expect(runtime.referenceParts.regulator).toEqual({
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: evidence.bom.find((line) => line.designators.includes("U1"))?.manufacturerPartNumber,
      nominalValue: null,
    });
    expect(runtime.referenceParts.inductor).toEqual({
      manufacturerId: "wurth-elektronik",
      manufacturerPartNumber: evidence.bom.find((line) => line.designators.includes("L1"))?.manufacturerPartNumber,
      nominalValue: evidence.bom.find((line) => line.designators.includes("L1"))?.nominalValue,
    });
    expect(runtime.observations).toEqual(evidence.observations.map(projectObservation));
    expect(runtime.observations).toHaveLength(10);
    expect(runtime.observations.find((entry) => entry.id.endsWith("output-ripple-full-load"))?.conditions)
      .toContainEqual({
        parameterId: "inputVoltage",
        range: {
          minimum: { value: 24, unit: "V" },
          maximum: { value: 24, unit: "V" },
        },
      });
    expect(runtime.observations.filter((entry) => entry.id.includes("load-transient"))).toHaveLength(4);
  });

  it("retains the exact canonical hashes while omitting the source and licensing artifact", () => {
    const runtimeJson = JSON.stringify(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1);

    expect(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.evidenceContentHash)
      .toBe("sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb");
    expect(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.bomContentHash)
      .toBe("sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22");
    expect(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.layoutReferenceContentHash)
      .toBe("sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a");
    expect(runtimeJson).not.toMatch(/https?:\/\//u);
    expect(runtimeJson).not.toContain("licenseNote");
    expect(runtimeJson).not.toContain("publicationRights");
    expect(runtimeJson).not.toContain("sourceLocator");
    expect(runtimeJson).not.toContain("limitations");
    expect(runtimeJson).not.toContain("designators");
  });

  it("exports only the URL-free projection and assertion through v2-runtime", () => {
    expect(browserRuntime.TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1)
      .toBe(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1);
    expect(browserRuntime.TPS54302EVM_716_REFERENCE_DESIGN_IDENTITY_ASSERTION_V1)
      .toBe(TPS54302EVM_716_REFERENCE_DESIGN_IDENTITY_ASSERTION_V1);
    expect(browserRuntime).not.toHaveProperty("TPS54302EVM_716_REFERENCE_DESIGN_EVIDENCE_V1");
    expect(Object.isFrozen(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1)).toBe(true);
    expect(Object.isFrozen(TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1.observations[0])).toBe(true);
  });
});
