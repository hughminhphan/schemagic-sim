import {
  IMPORTED_ANALYSIS_MODES,
  IMPORTED_ANALYSIS_VALIDITY_VERSION,
  importedModelPartId,
  inspectImportedAnalysisValidity,
  normalizedImportedModelLibrary,
  normalizedImportedModelPart,
  partByType,
  type AnalysisMode,
  type ComponentType,
  type ImportedAnalysisValidity,
  type ImportedDefinitionSelector,
  type ImportedModelLibrary,
  type ImportedModelPart,
  type ImportedPinMapping,
} from "@opencircuit/circuit-schema";
import { emitNamespacedLibrary } from "./emitter";
import { parseSpiceLibrary } from "./parser";
import { derivePinMappingSpec } from "./pin-mapping";
import { sanitize } from "./sanitizer";
import type { ImportedLibrary, ImportedModel, ImportedSubckt, SuggestedSymbol } from "./types";

export class ImportedModelStateError extends Error {
  constructor(readonly code: "IDENTITY" | "BLOCKED" | "DEFINITION" | "SYMBOL" | "PIN_MAPPING" | "ANALYSIS_VALIDITY", message: string) {
    super(message);
    this.name = "ImportedModelStateError";
  }
}

export interface MaterializedImportedModelPart {
  record: ImportedModelPart;
  namespace: string;
  emittedText: string;
  emittedName: string;
  suggestedSymbol: SuggestedSymbol;
  modelPins: string[];
  warnings: string[];
  removedItems: string[];
}

export interface CreateImportedPartOptions {
  sourceName: string;
  sourceText: string;
  baseType: ComponentType;
  pinMapping?: ImportedPinMapping[];
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment.toLowerCase() === right[index]?.toLowerCase());
}

function sameSection(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").toLowerCase() === (right ?? "").toLowerCase();
}

function selectorForModel(model: ImportedModel): ImportedDefinitionSelector {
  return {
    kind: "model",
    name: model.name,
    scopePath: [...model.scopePath],
    ...(model.librarySection === undefined ? {} : { librarySection: model.librarySection }),
  };
}

function selectorForSubckt(subckt: ImportedSubckt): ImportedDefinitionSelector {
  return {
    kind: "subckt",
    name: subckt.name,
    scopePath: subckt.scopePath.slice(0, -1),
    ...(subckt.librarySection === undefined ? {} : { librarySection: subckt.librarySection }),
  };
}

function findModel(library: ImportedLibrary, selector: ImportedDefinitionSelector): ImportedModel | undefined {
  return library.models.find((model) => model.name.toLowerCase() === selector.name.toLowerCase()
    && samePath(model.scopePath, selector.scopePath)
    && sameSection(model.librarySection, selector.librarySection));
}

function findSubckt(library: ImportedLibrary, selector: ImportedDefinitionSelector): ImportedSubckt | undefined {
  return library.subckts.find((subckt) => subckt.name.toLowerCase() === selector.name.toLowerCase()
    && samePath(subckt.scopePath.slice(0, -1), selector.scopePath)
    && sameSection(subckt.librarySection, selector.librarySection));
}

function suggestedModelSymbol(model: ImportedModel): SuggestedSymbol {
  const type = model.type.toLowerCase();
  if (type === "d") return "diode";
  if (type.includes("npn") || type.includes("pnp")) return "bjt";
  if (type.includes("mos")) return "mosfet";
  return "generic";
}

const staticAnalysisModes: AnalysisMode[] = ["live", "op", "dc-sweep"];

export function deriveImportedAnalysisValidity(definition: ImportedModel | ImportedSubckt): ImportedAnalysisValidity {
  if ("card" in definition) {
    if (/^(?:d|npn|pnp|nmos|pmos)$/i.test(definition.type)) {
      return { version: IMPORTED_ANALYSIS_VALIDITY_VERSION, supportedModes: [...IMPORTED_ANALYSIS_MODES] };
    }
    return {
      version: IMPORTED_ANALYSIS_VALIDITY_VERSION,
      supportedModes: [...staticAnalysisModes],
      limitations: [{
        modes: ["tran", "ac", "noise"],
        message: `SPICE model type ${definition.type} has no derived dynamic-analysis contract. Import a supported diode, BJT, or MOS primitive, or use an operating-point/DC analysis.`,
      }],
    };
  }

  const body = definition.body.join("\n");
  const hasTimeDomainOnlyBehavior = /\btime\b|\b(?:ddt|idt|delay|pwl|pulse|sffm|am)\s*\(/i.test(body);
  const hasExplicitNoiseSource = /(?:^|\n)\s*[rdjmq][^\s]*\s+/i.test(body);
  const supportedModes: AnalysisMode[] = [...staticAnalysisModes, "tran"];
  const limitations = [] as NonNullable<ImportedAnalysisValidity["limitations"]>;
  if (!hasTimeDomainOnlyBehavior) supportedModes.push("ac");
  else limitations.push({
    modes: ["ac", "noise"],
    message: `${definition.name} contains time-domain-only expressions, so small-signal AC and noise behavior are not declared. Use transient analysis or import an AC/noise-capable equivalent.`,
  });
  if (!hasTimeDomainOnlyBehavior && hasExplicitNoiseSource) supportedModes.push("noise");
  else if (!hasTimeDomainOnlyBehavior) limitations.push({
    modes: ["noise"],
    message: `${definition.name} has no explicit resistor or semiconductor noise source. Add a noise-capable primitive/model or use another analysis.`,
  });
  return {
    version: IMPORTED_ANALYSIS_VALIDITY_VERSION,
    supportedModes,
    ...(limitations.length === 0 ? {} : { limitations }),
  };
}

export function importedBaseType(symbol: SuggestedSymbol, model?: ImportedModel): ComponentType {
  if (symbol === "diode" || symbol === "two-terminal") return "diode";
  if (symbol === "bjt") return model?.type.toLowerCase().includes("pnp") ? "bjt_pnp" : "bjt_npn";
  if (symbol === "mosfet") return model?.type.toLowerCase().includes("pmos") ? "pmos" : "nmos";
  if (symbol === "opamp") return "opamp_ideal";
  if (symbol === "regulator" || symbol === "three-terminal") return "bjt_npn";
  return "resistor";
}

function emittedDefinitionName(values: Record<string, string>, selector: ImportedDefinitionSelector): string | undefined {
  const suffix = [...selector.scopePath, selector.name].map((value) => value.toLowerCase()).join("/");
  const section = selector.librarySection?.toLowerCase();
  return Object.entries(values).find(([key]) => {
    const [keySection, keyPath] = key.includes(":") ? key.split(/:(.*)/s, 2) : [undefined, key];
    return keyPath?.toLowerCase() === suffix && (section ?? "") === (keySection ?? "").toLowerCase();
  })?.[1];
}

function assertPinMapping(record: ImportedModelPart, modelPins: readonly string[]): void {
  if (record.definition.kind === "model") {
    if (record.pinMapping.length !== 0) throw new ImportedModelStateError("PIN_MAPPING", "Primitive .model imports must not carry a subcircuit pin map");
    return;
  }
  const symbolPinCount = partByType(record.baseType).pins.length;
  if (record.pinMapping.length !== symbolPinCount || modelPins.length !== symbolPinCount) {
    throw new ImportedModelStateError("PIN_MAPPING", `${record.definition.name} exposes ${modelPins.length} model pins but ${record.baseType} has ${symbolPinCount} symbol pins`);
  }
  const symbolIndices = new Set<number>();
  const modelIndices = new Set<number>();
  for (const mapping of record.pinMapping) {
    if (!Number.isInteger(mapping.symbolPinIndex) || mapping.symbolPinIndex < 0 || mapping.symbolPinIndex >= symbolPinCount) throw new ImportedModelStateError("PIN_MAPPING", `Symbol pin index ${mapping.symbolPinIndex} is outside ${record.baseType}`);
    if (!Number.isInteger(mapping.modelPinIndex) || mapping.modelPinIndex < 0 || mapping.modelPinIndex >= modelPins.length) throw new ImportedModelStateError("PIN_MAPPING", `Model pin index ${mapping.modelPinIndex} is outside ${record.definition.name}`);
    if (symbolIndices.has(mapping.symbolPinIndex)) throw new ImportedModelStateError("PIN_MAPPING", `Symbol pin index ${mapping.symbolPinIndex} is mapped more than once`);
    if (modelIndices.has(mapping.modelPinIndex)) throw new ImportedModelStateError("PIN_MAPPING", `Model pin index ${mapping.modelPinIndex} is mapped more than once`);
    symbolIndices.add(mapping.symbolPinIndex);
    modelIndices.add(mapping.modelPinIndex);
  }
}

export function materializeImportedModelPart(recordInput: ImportedModelPart): MaterializedImportedModelPart {
  const rawRecord = structuredClone(recordInput);
  if (rawRecord.id !== importedModelPartId(rawRecord)) throw new ImportedModelStateError("IDENTITY", `Imported part ${rawRecord.definition.name} has a stale or tampered content id`);
  const library = parseSpiceLibrary(rawRecord.sourceText, { filename: rawRecord.sourceName });
  const sanitized = sanitize(library);
  if (sanitized.blockedReasons.length > 0) {
    const first = sanitized.blockedReasons[0]!;
    throw new ImportedModelStateError("BLOCKED", `${first.file}:${first.line} ${first.message}`);
  }
  const namespace = `ocimp_${rawRecord.id.slice("imp_".length)}`;
  const emitted = emitNamespacedLibrary(library, namespace);
  const model = rawRecord.definition.kind === "model" ? findModel(library, rawRecord.definition) : undefined;
  const subckt = rawRecord.definition.kind === "subckt" ? findSubckt(library, rawRecord.definition) : undefined;
  const definition = model ?? subckt;
  if (!definition) throw new ImportedModelStateError("DEFINITION", `Imported source no longer contains selected ${rawRecord.definition.kind} ${rawRecord.definition.name}`);
  const record = normalizedImportedModelPart({
    ...rawRecord,
    analysisValidity: (rawRecord as ImportedModelPart & { analysisValidity?: ImportedAnalysisValidity }).analysisValidity
      ?? deriveImportedAnalysisValidity(definition),
  });
  const validityIssue = inspectImportedAnalysisValidity(record.analysisValidity)[0];
  if (validityIssue) throw new ImportedModelStateError("ANALYSIS_VALIDITY", validityIssue.message);
  const derivedValidity = deriveImportedAnalysisValidity(definition);
  const overclaimedMode = record.analysisValidity.supportedModes.find((mode) => !derivedValidity.supportedModes.includes(mode));
  if (overclaimedMode) {
    throw new ImportedModelStateError(
      "ANALYSIS_VALIDITY",
      `${record.definition.name} declares ${overclaimedMode} support that cannot be derived from the selected parsed definition`,
    );
  }
  const suggestedSymbol = model ? suggestedModelSymbol(model) : derivePinMappingSpec(subckt!).suggestedSymbol;
  const expectedBaseType = importedBaseType(suggestedSymbol, model);
  if (expectedBaseType !== record.baseType) throw new ImportedModelStateError("SYMBOL", `${record.definition.name} requires a ${expectedBaseType} symbol, not ${record.baseType}`);
  const modelPins = subckt ? [...subckt.pins] : [];
  assertPinMapping(record, modelPins);
  const names = model ? emitted.modelNames : emitted.subcktNames;
  const emittedName = emittedDefinitionName(names, record.definition);
  if (!emittedName) throw new ImportedModelStateError("DEFINITION", `Could not resolve emitted name for ${record.definition.name}`);
  return {
    record,
    namespace,
    emittedText: emitted.text,
    emittedName,
    suggestedSymbol,
    modelPins,
    warnings: library.warnings.map((warning) => `${warning.file}:${warning.line} ${warning.message}`),
    removedItems: sanitized.removed.map((item) => `${item.file}:${item.line} ${item.reason}`),
  };
}

export function materializeImportedModelLibrary(library: ImportedModelLibrary | undefined): MaterializedImportedModelPart[] {
  if (!library) return [];
  if (library.format !== "opencircuit-imported-models" || library.version !== 1) throw new ImportedModelStateError("IDENTITY", "Unsupported imported-model library version");
  return normalizedImportedModelLibrary(library).parts.map(materializeImportedModelPart);
}

export function importedPartFromModel(model: ImportedModel, options: CreateImportedPartOptions): ImportedModelPart {
  const withoutId: Omit<ImportedModelPart, "id"> = {
    sourceName: options.sourceName,
    sourceText: options.sourceText,
    definition: selectorForModel(model),
    baseType: options.baseType,
    pinMapping: [],
    analysisValidity: deriveImportedAnalysisValidity(model),
  };
  const record = { id: importedModelPartId(withoutId), ...withoutId };
  materializeImportedModelPart(record);
  return record;
}

export function importedPartFromSubckt(subckt: ImportedSubckt, options: CreateImportedPartOptions): ImportedModelPart {
  const defaultMapping = derivePinMappingSpec(subckt).modelPins.map((_, index) => ({ symbolPinIndex: index, modelPinIndex: index }));
  const withoutId: Omit<ImportedModelPart, "id"> = {
    sourceName: options.sourceName,
    sourceText: options.sourceText,
    definition: selectorForSubckt(subckt),
    baseType: options.baseType,
    pinMapping: options.pinMapping?.map((mapping) => ({ ...mapping })) ?? defaultMapping,
    analysisValidity: deriveImportedAnalysisValidity(subckt),
  };
  const record = { id: importedModelPartId(withoutId), ...withoutId };
  materializeImportedModelPart(record);
  return record;
}
