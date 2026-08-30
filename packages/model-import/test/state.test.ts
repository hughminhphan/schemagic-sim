import { importedModelPartId, type ImportedModelPart } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import {
  ImportedModelStateError,
  deriveImportedAnalysisValidity,
  importedPartFromModel,
  importedPartFromSubckt,
  materializeImportedModelPart,
  parseSpiceLibrary,
} from "../src";

describe("persisted imported-model state", () => {
  it("reparses and deterministically re-emits a primitive model", () => {
    const sourceText = ".model SAFE_D D(Is=1e-14)";
    const model = parseSpiceLibrary(sourceText, { filename: "safe.lib" }).models[0]!;
    const record = importedPartFromModel(model, { sourceName: "safe.lib", sourceText, baseType: "diode" });
    const first = materializeImportedModelPart(record);
    const second = materializeImportedModelPart(structuredClone(record));

    expect(record.id).toBe(importedModelPartId(record));
    expect(first).toEqual(second);
    expect(first.namespace).toMatch(/^ocimp_[0-9a-f]{16}$/);
    expect(first.emittedText).toContain(`.model ${first.emittedName} D`);
    expect(record.analysisValidity).toEqual({
      version: 1,
      supportedModes: ["live", "op", "dc-sweep", "tran", "ac", "noise"],
    });
  });

  it("does not trust persisted emitted fields and detects source tampering", () => {
    const sourceText = ".model SAFE_D D(Is=1e-14)";
    const model = parseSpiceLibrary(sourceText).models[0]!;
    const record = importedPartFromModel(model, { sourceName: "safe.lib", sourceText, baseType: "diode" });
    const tampered = { ...record, sourceText: ".model SAFE_D D(Is=1e-3)", emittedText: ".shell touch /tmp/no" } as ImportedModelPart;

    expect(() => materializeImportedModelPart(tampered)).toThrowError(
      expect.objectContaining<Partial<ImportedModelStateError>>({ code: "IDENTITY" }),
    );
  });

  it("fails when the selected definition is missing even with a recomputed content id", () => {
    const withoutId: Omit<ImportedModelPart, "id"> = {
      sourceName: "safe.lib",
      sourceText: ".model OTHER_D D(Is=1e-14)",
      definition: { kind: "model", name: "SAFE_D", scopePath: [] },
      baseType: "diode",
      pinMapping: [],
      analysisValidity: { version: 1, supportedModes: ["live", "op"] },
    };
    const record = { id: importedModelPartId(withoutId), ...withoutId };
    expect(() => materializeImportedModelPart(record)).toThrowError(
      expect.objectContaining<Partial<ImportedModelStateError>>({ code: "DEFINITION" }),
    );
  });

  it("enforces a complete bijective subcircuit pin map", () => {
    const sourceText = ".subckt SAFE_NPN C B E\nQ1 C B E CORE\n.model CORE NPN\n.ends SAFE_NPN";
    const subckt = parseSpiceLibrary(sourceText).subckts[0]!;
    const good = importedPartFromSubckt(subckt, {
      sourceName: "safe.sub",
      sourceText,
      baseType: "bjt_npn",
      pinMapping: [
        { symbolPinIndex: 0, modelPinIndex: 2 },
        { symbolPinIndex: 1, modelPinIndex: 1 },
        { symbolPinIndex: 2, modelPinIndex: 0 },
      ],
    });
    expect(materializeImportedModelPart(good).modelPins).toEqual(["C", "B", "E"]);

    const withoutId = { ...good, pinMapping: [
      { symbolPinIndex: 0, modelPinIndex: 0 },
      { symbolPinIndex: 1, modelPinIndex: 0 },
      { symbolPinIndex: 2, modelPinIndex: 2 },
    ] };
    const bad = { ...withoutId, id: importedModelPartId(withoutId) };
    expect(() => materializeImportedModelPart(bad)).toThrowError(
      expect.objectContaining<Partial<ImportedModelStateError>>({ code: "PIN_MAPPING" }),
    );
  });

  it("derives conservative, actionable subcircuit analysis domains from parsed truth", () => {
    const ordinary = parseSpiceLibrary(".subckt FILTER IN OUT\nR1 IN OUT 1k\n.ends FILTER").subckts[0]!;
    expect(deriveImportedAnalysisValidity(ordinary)).toEqual({
      version: 1,
      supportedModes: ["live", "op", "dc-sweep", "tran", "ac", "noise"],
    });

    const timeOnly = parseSpiceLibrary(".subckt TIMER IN OUT\nB1 OUT 0 V=IF(TIME>1m,V(IN),0)\n.ends TIMER").subckts[0]!;
    const validity = deriveImportedAnalysisValidity(timeOnly);
    expect(validity.supportedModes).toEqual(["live", "op", "dc-sweep", "tran"]);
    expect(validity.limitations?.[0]?.modes).toEqual(["ac", "noise"]);
    expect(validity.limitations?.[0]?.message).toMatch(/use transient|AC\/noise-capable/i);
  });

  it("rejects malformed persisted analysis-validity contracts during admission", () => {
    const sourceText = ".model SAFE_D D";
    const model = parseSpiceLibrary(sourceText).models[0]!;
    const record = importedPartFromModel(model, { sourceName: "safe.lib", sourceText, baseType: "diode" });
    const invalid = {
      ...record,
      analysisValidity: { version: 2, supportedModes: ["op"] },
    } as unknown as ImportedModelPart;

    expect(() => materializeImportedModelPart(invalid)).toThrowError(
      expect.objectContaining<Partial<ImportedModelStateError>>({ code: "ANALYSIS_VALIDITY" }),
    );

    const timeSource = ".subckt TIMER IN OUT\nB1 OUT 0 V=IF(TIME>1m,V(IN),0)\n.ends TIMER";
    const timeSubckt = parseSpiceLibrary(timeSource).subckts[0]!;
    const timeRecord = importedPartFromSubckt(timeSubckt, {
      sourceName: "timer.sub",
      sourceText: timeSource,
      baseType: "diode",
    });
    const overclaimed = {
      ...timeRecord,
      analysisValidity: { ...timeRecord.analysisValidity, supportedModes: [...timeRecord.analysisValidity.supportedModes, "ac"] },
    } as ImportedModelPart;
    expect(() => materializeImportedModelPart(overclaimed)).toThrowError(
      expect.objectContaining<Partial<ImportedModelStateError>>({ code: "ANALYSIS_VALIDITY", message: expect.stringMatching(/declares ac support.*cannot be derived/i) }),
    );
  });
});
