import type { CircuitDocument } from "@opencircuit/circuit-schema";

export type FalstadSourceKind = "cct" | "ctz" | "text";

export interface FalstadImportIssue {
  lineNumber: number;
  elementLine: string;
  elementType: string;
  reason: string;
  mapping: "unsupported" | "partial";
}

export interface FalstadImportWarning {
  lineNumber?: number;
  message: string;
}

export interface FalstadImportReport {
  sourceKind: FalstadSourceKind;
  importedElements: number;
  unsupported: FalstadImportIssue[];
  warnings: FalstadImportWarning[];
}

export interface FalstadImportResult {
  document: CircuitDocument;
  report: FalstadImportReport;
  sourceText: string;
}

export interface FalstadImportOptions {
  title?: string;
  gridPixels?: number;
}
