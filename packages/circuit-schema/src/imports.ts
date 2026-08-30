import type {
  AnalysisMode,
  ImportedAnalysisLimitation,
  ImportedAnalysisValidity,
  ImportedModelLibrary,
  ImportedModelPart,
} from "./types";

export const IMPORTED_MODEL_LIBRARY_FORMAT = "opencircuit-imported-models" as const;
export const IMPORTED_MODEL_LIBRARY_VERSION = 1 as const;
export const IMPORTED_ANALYSIS_VALIDITY_VERSION = 1 as const;
export const MAX_IMPORTED_MODEL_PARTS = 128;
export const MAX_IMPORTED_MODEL_SOURCE_BYTES = 1_048_576;
export const MAX_IMPORTED_MODEL_TOTAL_BYTES = 4_194_304;

export const IMPORTED_ANALYSIS_MODES: readonly AnalysisMode[] = Object.freeze([
  "live", "op", "dc-sweep", "tran", "ac", "noise",
]);
const importedAnalysisModeSet = new Set<string>(IMPORTED_ANALYSIS_MODES);
const analysisModeRank = new Map(IMPORTED_ANALYSIS_MODES.map((mode, index) => [mode, index]));

export interface ImportedAnalysisValidityIssue { path: string; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedModes(modes: readonly AnalysisMode[]): AnalysisMode[] {
  return [...modes].sort((left, right) => (analysisModeRank.get(left) ?? 99) - (analysisModeRank.get(right) ?? 99)
    || String(left).localeCompare(String(right)));
}

function normalizedLimitations(limitations: readonly ImportedAnalysisLimitation[] | undefined): ImportedAnalysisLimitation[] | undefined {
  if (!limitations) return undefined;
  return limitations
    .map((limitation) => ({ modes: normalizedModes(limitation.modes), message: limitation.message }))
    .sort((left, right) => left.modes.join(",").localeCompare(right.modes.join(",")) || left.message.localeCompare(right.message));
}

/**
 * Older imported records had no analysis claim. Primitive SPICE models have a
 * deterministic, simulator-defined analysis domain; subcircuits stay on the
 * conservative operating-point/DC domain until they are reparsed by the
 * importer and receive a source-derived claim.
 */
export function legacyImportedAnalysisValidity(part: Pick<ImportedModelPart, "definition" | "sourceText">): ImportedAnalysisValidity {
  if (part.definition.kind === "model" && part.definition.scopePath.length === 0 && part.definition.librarySection === undefined) {
    const escapedName = part.definition.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`^\\s*\\.model\\s+${escapedName}\\s+([^\\s(]+)`, "im").exec(part.sourceText);
    if (match && /^(?:d|npn|pnp|nmos|pmos)$/i.test(match[1]!)) {
      return { version: IMPORTED_ANALYSIS_VALIDITY_VERSION, supportedModes: [...IMPORTED_ANALYSIS_MODES] };
    }
  }
  return {
    version: IMPORTED_ANALYSIS_VALIDITY_VERSION,
    supportedModes: ["live", "op", "dc-sweep"],
    limitations: [{
      modes: ["tran", "ac", "noise"],
      message: "Dynamic behavior was not declared in this legacy import. Re-import the original source to derive transient, AC, and noise support, or use an operating-point/DC analysis.",
    }],
  };
}

export function normalizedImportedAnalysisValidity(
  value: unknown,
  fallback: ImportedAnalysisValidity,
): ImportedAnalysisValidity {
  if (value === undefined) return structuredClone(fallback);
  if (!isRecord(value) || !Array.isArray(value.supportedModes)) return structuredClone(value) as ImportedAnalysisValidity;
  const limitations = Array.isArray(value.limitations)
    && value.limitations.every((limitation) => isRecord(limitation) && Array.isArray(limitation.modes) && typeof limitation.message === "string")
    ? normalizedLimitations(value.limitations as unknown as ImportedAnalysisLimitation[])
    : value.limitations as ImportedAnalysisLimitation[] | undefined;
  return {
    version: value.version as 1,
    supportedModes: normalizedModes(value.supportedModes as AnalysisMode[]),
    ...(limitations === undefined ? {} : { limitations }),
  };
}

export function inspectImportedAnalysisValidity(value: unknown): ImportedAnalysisValidityIssue[] {
  if (!isRecord(value)) return [{ path: "analysisValidity", message: "Imported analysis validity must be a versioned object" }];
  const issues: ImportedAnalysisValidityIssue[] = [];
  if (value.version !== IMPORTED_ANALYSIS_VALIDITY_VERSION) issues.push({ path: "analysisValidity.version", message: `Unsupported imported analysis-validity version ${String(value.version)}` });
  if (!Array.isArray(value.supportedModes) || value.supportedModes.length === 0) {
    issues.push({ path: "analysisValidity.supportedModes", message: "Imported analysis validity must declare at least one supported mode" });
  } else {
    const seen = new Set<string>();
    for (const [index, mode] of value.supportedModes.entries()) {
      if (typeof mode !== "string" || !importedAnalysisModeSet.has(mode)) issues.push({ path: `analysisValidity.supportedModes.${index}`, message: `Unsupported imported analysis mode ${String(mode)}` });
      else if (seen.has(mode)) issues.push({ path: `analysisValidity.supportedModes.${index}`, message: `Imported analysis mode ${mode} is declared more than once` });
      seen.add(String(mode));
    }
    if (seen.has("live") !== seen.has("op")) issues.push({ path: "analysisValidity.supportedModes", message: "Live and operating-point support must be declared together because they use the same solver analysis" });
  }
  if (value.limitations !== undefined) {
    if (!Array.isArray(value.limitations)) {
      issues.push({ path: "analysisValidity.limitations", message: "Imported analysis limitations must be an array" });
    } else {
      for (const [index, limitation] of value.limitations.entries()) {
        const base = `analysisValidity.limitations.${index}`;
        if (!isRecord(limitation)) {
          issues.push({ path: base, message: "Imported analysis limitation must be an object" });
          continue;
        }
        if (!Array.isArray(limitation.modes) || limitation.modes.length === 0) {
          issues.push({ path: `${base}.modes`, message: "Imported analysis limitation must identify at least one mode" });
        } else {
          const seen = new Set<string>();
          for (const [modeIndex, mode] of limitation.modes.entries()) {
            if (typeof mode !== "string" || !importedAnalysisModeSet.has(mode)) issues.push({ path: `${base}.modes.${modeIndex}`, message: `Unsupported imported analysis mode ${String(mode)}` });
            else if (seen.has(mode)) issues.push({ path: `${base}.modes.${modeIndex}`, message: `Imported analysis limitation repeats mode ${mode}` });
            seen.add(String(mode));
          }
        }
        if (typeof limitation.message !== "string" || !limitation.message.trim() || limitation.message.length > 512 || /[\r\n\0]/.test(limitation.message)) {
          issues.push({ path: `${base}.message`, message: "Imported analysis limitation must be an actionable single-line message of at most 512 characters" });
        }
      }
    }
  }
  return issues;
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function normalizedImportedModelPart(part: ImportedModelPart): ImportedModelPart {
  const fallbackValidity = legacyImportedAnalysisValidity(part);
  return {
    id: part.id,
    sourceName: part.sourceName,
    sourceText: part.sourceText,
    definition: {
      kind: part.definition.kind,
      name: part.definition.name,
      scopePath: [...part.definition.scopePath],
      ...(part.definition.librarySection === undefined ? {} : { librarySection: part.definition.librarySection }),
    },
    baseType: part.baseType,
    pinMapping: [...part.pinMapping]
      .map(({ symbolPinIndex, modelPinIndex }) => ({ symbolPinIndex, modelPinIndex }))
      .sort((left, right) => left.symbolPinIndex - right.symbolPinIndex || left.modelPinIndex - right.modelPinIndex),
    analysisValidity: normalizedImportedAnalysisValidity(
      (part as ImportedModelPart & { analysisValidity?: unknown }).analysisValidity,
      fallbackValidity,
    ),
  };
}

export function importedModelPartContentKey(part: Omit<ImportedModelPart, "id"> | ImportedModelPart): string {
  const definition = {
    kind: part.definition.kind,
    name: part.definition.name,
    scopePath: [...part.definition.scopePath],
    ...(part.definition.librarySection === undefined ? {} : { librarySection: part.definition.librarySection }),
  };
  const pinMapping = [...part.pinMapping]
    .map(({ symbolPinIndex, modelPinIndex }) => ({ symbolPinIndex, modelPinIndex }))
    .sort((left, right) => left.symbolPinIndex - right.symbolPinIndex || left.modelPinIndex - right.modelPinIndex);
  return JSON.stringify({
    sourceName: part.sourceName,
    sourceText: part.sourceText,
    definition,
    baseType: part.baseType,
    pinMapping,
  });
}

export function importedModelPartId(part: Omit<ImportedModelPart, "id"> | ImportedModelPart): string {
  return `imp_${fnv1a64(importedModelPartContentKey(part))}`;
}

export function normalizedImportedModelLibrary(library: ImportedModelLibrary): ImportedModelLibrary {
  return {
    format: IMPORTED_MODEL_LIBRARY_FORMAT,
    version: IMPORTED_MODEL_LIBRARY_VERSION,
    parts: library.parts.map(normalizedImportedModelPart).sort((left, right) => left.id.localeCompare(right.id)),
  };
}
