export type ImportWarningCode =
  | "BLOCKED_DIRECTIVE"
  | "DUPLICATE_DEFINITION"
  | "INCLUDE_CYCLE"
  | "INCLUDE_DEPTH"
  | "INVALID_INCLUDE"
  | "MALFORMED_CARD"
  | "MISSING_INCLUDE"
  | "NESTING_DEPTH"
  | "UNBALANCED_SUBCKT"
  | "UNSUPPORTED_CARD";

export interface SourceLocation {
  file: string;
  line: number;
  endLine: number;
}

export interface ImportWarning extends SourceLocation {
  code: ImportWarningCode;
  message: string;
}

export interface ImportedModel extends SourceLocation {
  name: string;
  type: string;
  params: Record<string, string>;
  card: string;
  parentSubckt?: string;
  librarySection?: string;
  scopePath: string[];
}

export interface ImportedSubckt extends SourceLocation {
  name: string;
  pins: string[];
  params: Record<string, string>;
  body: string[];
  parentSubckt?: string;
  librarySection?: string;
  depth: number;
  scopePath: string[];
}

export type StatementKind =
  | "blank"
  | "comment"
  | "directive"
  | "element"
  | "include"
  | "lib-section-start"
  | "lib-section-end";

export interface ImportedStatement extends SourceLocation {
  kind: StatementKind;
  text: string;
  directive?: string;
  librarySection?: string;
  scopePath: string[];
  includeTarget?: string;
  includeSection?: string;
  includeResolved?: boolean;
}

export interface ImportedLibrary {
  models: ImportedModel[];
  subckts: ImportedSubckt[];
  warnings: ImportWarning[];
  statements: ImportedStatement[];
  sourceFiles: string[];
  totalBytes: number;
}

export interface VirtualFileMap {
  [virtualPath: string]: string;
}

export interface ParseOptions {
  filename?: string;
  virtualFiles?: VirtualFileMap;
  maxInputBytes?: number;
  maxIncludeDepth?: number;
  maxSubcktDepth?: number;
}

export type ImportLimitCode = "INPUT_TOO_LARGE" | "INCLUDE_DEPTH_EXCEEDED" | "SUBCKT_DEPTH_EXCEEDED";

export class ModelImportLimitError extends Error {
  readonly code: ImportLimitCode;

  constructor(code: ImportLimitCode, message: string) {
    super(message);
    this.name = "ModelImportLimitError";
    this.code = code;
  }
}

export type RemovalCategory = "security" | "unsupported" | "top-level-circuit" | "metadata";

export interface RemovedStatement extends SourceLocation {
  text: string;
  reason: string;
  category: RemovalCategory;
}

export interface BlockedReason extends SourceLocation {
  code:
    | "CONTROL_BLOCK"
    | "FILE_IO"
    | "HOST_PATH"
    | "INCLUDE_UNRESOLVED"
    | "NETWORK_ACCESS"
    | "SHELL_COMMAND"
    | "UNSAFE_EXTENSION"
    | "XSPICE_CODEMODEL";
  message: string;
}

export interface SanitizeOptions {
  preserveComments?: boolean;
}

export interface SanitizeResult {
  cleanText: string;
  removed: RemovedStatement[];
  blockedReasons: BlockedReason[];
}

export type SuggestedSymbol =
  | "diode"
  | "bjt"
  | "mosfet"
  | "opamp"
  | "regulator"
  | "two-terminal"
  | "three-terminal"
  | "generic";

export interface PinMappingSpec {
  subcktName: string;
  modelPins: string[];
  suggestedSymbol: SuggestedSymbol;
  userMapping: Record<string, number>;
}

export interface PinMappingValidation {
  valid: boolean;
  errors: string[];
}

export interface NamespacedEmitResult {
  text: string;
  modelNames: Record<string, string>;
  subcktNames: Record<string, string>;
  removed: RemovedStatement[];
  blockedReasons: BlockedReason[];
}
