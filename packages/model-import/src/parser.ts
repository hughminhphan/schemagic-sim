import { toLogicalLines, tokenizeSpiceLine, unquoteSpiceToken } from "./tokenizer";
import {
  ModelImportLimitError,
  type ImportedLibrary,
  type ImportedModel,
  type ImportedStatement,
  type ImportedSubckt,
  type ImportWarning,
  type ParseOptions,
  type VirtualFileMap,
} from "./types";

const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_MAX_INCLUDE_DEPTH = 16;
const DEFAULT_MAX_SUBCKT_DEPTH = 32;
const textEncoder = new TextEncoder();

interface ParseContext {
  maxBytes: number;
  maxIncludeDepth: number;
  maxSubcktDepth: number;
  virtualFiles: Map<string, string>;
  models: ImportedModel[];
  subckts: ImportedSubckt[];
  warnings: ImportWarning[];
  statements: ImportedStatement[];
  sourceFiles: Set<string>;
  includeStack: string[];
  totalBytes: number;
  definitions: Set<string>;
}

interface SubcktFrame {
  subckt: ImportedSubckt;
}

function normalizeVirtualPath(input: string): string | undefined {
  const unquoted = unquoteSpiceToken(input.trim()).replace(/\\/g, "/");
  if (!unquoted || unquoted.startsWith("/") || /^[a-zA-Z]:\//.test(unquoted) || unquoted.startsWith("~")) return undefined;
  const parts: string[] = [];
  for (const part of unquoted.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return undefined;
    parts.push(part);
  }
  return parts.join("/");
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function resolveVirtualPath(currentFile: string, target: string): string | undefined {
  const normalizedTarget = normalizeVirtualPath(target);
  if (normalizedTarget === undefined) return undefined;
  const base = dirname(currentFile);
  return normalizeVirtualPath(base ? `${base}/${normalizedTarget}` : normalizedTarget);
}

function directiveName(text: string): string | undefined {
  if (!text.startsWith(".")) return undefined;
  return /^\.([^\s]+)/.exec(text)?.[1]?.toLowerCase();
}

function parseAssignments(input: string): Record<string, string> {
  const normalized = input.replace(/\s*=\s*/g, "=").trim();
  const params: Record<string, string> = {};
  for (const token of tokenizeSpiceLine(normalized)) {
    const equals = token.indexOf("=");
    if (equals <= 0) continue;
    const key = token.slice(0, equals).replace(/^params?:/i, "").trim();
    const value = token.slice(equals + 1).trim();
    if (key && value) params[key] = value;
  }
  return params;
}

function parseModel(text: string, location: ImportedStatement, scopePath: string[]): ImportedModel | undefined {
  const match = /^\.model\s+(\S+)\s+([^\s(]+)\s*(.*)$/i.exec(text);
  if (!match) return undefined;
  const name = match[1]!;
  const type = match[2]!;
  let paramText = match[3]!.trim();
  if (paramText.startsWith("(") && paramText.endsWith(")")) paramText = paramText.slice(1, -1);
  const parentSubckt = scopePath.at(-1);
  return {
    name,
    type,
    params: parseAssignments(paramText),
    card: text,
    ...(parentSubckt ? { parentSubckt } : {}),
    ...(location.librarySection ? { librarySection: location.librarySection } : {}),
    scopePath: [...scopePath],
    file: location.file,
    line: location.line,
    endLine: location.endLine,
  };
}

function parseSubcktHeader(text: string, location: ImportedStatement, scopePath: string[]): ImportedSubckt | undefined {
  const remainder = text.replace(/^\.subckt\s+/i, "");
  const tokens = tokenizeSpiceLine(remainder);
  const name = tokens.shift();
  if (!name) return undefined;
  const pins: string[] = [];
  const paramTokens: string[] = [];
  let parsingParams = false;
  for (const token of tokens) {
    if (/^params?:?$/i.test(token)) {
      parsingParams = true;
      continue;
    }
    if (/^params?:/i.test(token) || token.includes("=")) parsingParams = true;
    if (parsingParams) paramTokens.push(token.replace(/^params?:/i, ""));
    else pins.push(token);
  }
  const parentSubckt = scopePath.at(-1);
  return {
    name,
    pins,
    params: parseAssignments(paramTokens.join(" ")),
    body: [],
    ...(parentSubckt ? { parentSubckt } : {}),
    ...(location.librarySection ? { librarySection: location.librarySection } : {}),
    depth: scopePath.length + 1,
    scopePath: [...scopePath, name],
    file: location.file,
    line: location.line,
    endLine: location.endLine,
  };
}

function looksLikeLibraryPath(token: string, tokenCount: number): boolean {
  if (tokenCount > 2) return true;
  const value = unquoteSpiceToken(token).toLowerCase();
  return value.includes("/") || value.includes("\\") || /\.(?:cir|inc|lib|mod|model|sp|spice|sub)$/i.test(value);
}

function selectLibrarySection(text: string, file: string, section: string): string | undefined {
  const wanted = section.toLowerCase();
  const selected: string[] = [];
  let active = false;
  let found = false;
  for (const line of toLogicalLines(text, file)) {
    const tokens = tokenizeSpiceLine(line.text);
    const directive = directiveName(line.text);
    if (directive === "lib" && tokens.length === 2 && !looksLikeLibraryPath(tokens[1] ?? "", tokens.length)) {
      active = (tokens[1] ?? "").toLowerCase() === wanted;
      found ||= active;
      continue;
    }
    if (directive === "endl") {
      if (active) active = false;
      continue;
    }
    if (active) selected.push(line.raw);
  }
  return found ? selected.join("\n") : undefined;
}

function addWarning(context: ParseContext, warning: ImportWarning): void {
  context.warnings.push(warning);
}

function addDefinition(context: ParseContext, kind: "model" | "subckt", name: string, scopePath: string[], statement: ImportedStatement): void {
  const section = statement.librarySection?.toLowerCase() ?? "";
  const key = `${kind}:${section}:${scopePath.map((part) => part.toLowerCase()).join("/")}:${name.toLowerCase()}`;
  if (context.definitions.has(key)) {
    addWarning(context, {
      code: "DUPLICATE_DEFINITION",
      message: `Duplicate ${kind} definition ${name} in the same scope`,
      file: statement.file,
      line: statement.line,
      endLine: statement.endLine,
    });
  }
  context.definitions.add(key);
}

function appendToFrames(frames: SubcktFrame[], lines: string[]): void {
  for (const frame of frames) frame.subckt.body.push(...lines);
}

function parseFile(
  context: ParseContext,
  textInput: string,
  file: string,
  includeDepth: number,
  baseScope: string[] = [],
  requestedSection?: string,
  inheritedLibrarySection?: string,
): ImportedStatement[] {
  if (includeDepth > context.maxIncludeDepth) {
    throw new ModelImportLimitError("INCLUDE_DEPTH_EXCEEDED", `Virtual include depth exceeds ${context.maxIncludeDepth}`);
  }
  const bytes = textEncoder.encode(textInput).byteLength;
  context.totalBytes += bytes;
  if (context.totalBytes > context.maxBytes) {
    throw new ModelImportLimitError("INPUT_TOO_LARGE", `Imported model input exceeds ${context.maxBytes} bytes`);
  }
  context.sourceFiles.add(file);

  let text = textInput;
  if (text.includes("\0")) {
    text = text.replaceAll("\0", "");
    addWarning(context, {
      code: "MALFORMED_CARD",
      message: "NUL bytes were removed from model input",
      file,
      line: 1,
      endLine: 1,
    });
  }
  if (requestedSection) {
    const selected = selectLibrarySection(text, file, requestedSection);
    if (selected === undefined) {
      addWarning(context, {
        code: "MISSING_INCLUDE",
        message: `Library section ${requestedSection} was not found in ${file}`,
        file,
        line: 1,
        endLine: 1,
      });
      return [];
    }
    text = selected;
  }

  const emitted: ImportedStatement[] = [];
  const frames: SubcktFrame[] = [];
  let currentLibrarySection = requestedSection ?? inheritedLibrarySection;
  const currentScope = (): string[] => [...baseScope, ...frames.map((frame) => frame.subckt.name)];

  for (const line of toLogicalLines(text, file)) {
    const trimmed = line.text.trim();
    const directive = directiveName(trimmed);
    const scopePath = currentScope();
    const statement: ImportedStatement = {
      kind: trimmed.length === 0 ? "blank" : trimmed.startsWith("*") ? "comment" : directive ? "directive" : "element",
      text: trimmed,
      ...(directive ? { directive } : {}),
      ...(currentLibrarySection ? { librarySection: currentLibrarySection } : {}),
      scopePath,
      file: line.file,
      line: line.line,
      endLine: line.endLine,
    };

    if (directive === "include" || directive === "inc" || directive === "lib") {
      const tokens = tokenizeSpiceLine(trimmed);
      const targetToken = tokens[1];
      const isLibSection = directive === "lib" && targetToken !== undefined && !looksLikeLibraryPath(targetToken, tokens.length);
      if (isLibSection) {
        const sectionName = unquoteSpiceToken(targetToken!);
        statement.kind = "lib-section-start";
        statement.librarySection = sectionName;
        currentLibrarySection = sectionName;
        emitted.push(statement);
        context.statements.push(statement);
        continue;
      }
      if (directive === "lib" && targetToken === undefined) {
        addWarning(context, {
          code: "MALFORMED_CARD",
          message: "Malformed .lib card without a path or section",
          file,
          line: line.line,
          endLine: line.endLine,
        });
      }
      statement.kind = "include";
      statement.includeTarget = targetToken ? unquoteSpiceToken(targetToken) : "";
      const includeSection = directive === "lib" ? tokens[2] : undefined;
      if (includeSection) statement.includeSection = includeSection;
      const resolved = targetToken ? resolveVirtualPath(file, targetToken) : undefined;
      statement.includeResolved = resolved !== undefined && context.virtualFiles.has(resolved);
      emitted.push(statement);
      context.statements.push(statement);
      appendToFrames(frames, [trimmed]);

      if (resolved === undefined) {
        addWarning(context, {
          code: "INVALID_INCLUDE",
          message: `Rejected non-virtual or traversing include path ${targetToken ?? "<missing>"}`,
          file,
          line: line.line,
          endLine: line.endLine,
        });
        continue;
      }
      const includedText = context.virtualFiles.get(resolved);
      if (includedText === undefined) {
        addWarning(context, {
          code: "MISSING_INCLUDE",
          message: `Virtual include ${resolved} was not supplied by the caller`,
          file,
          line: line.line,
          endLine: line.endLine,
        });
        continue;
      }
      if (context.includeStack.includes(resolved)) {
        addWarning(context, {
          code: "INCLUDE_CYCLE",
          message: `Virtual include cycle blocked at ${resolved}`,
          file,
          line: line.line,
          endLine: line.endLine,
        });
        continue;
      }
      context.includeStack.push(resolved);
      const includedStatements = parseFile(
        context,
        includedText,
        resolved,
        includeDepth + 1,
        scopePath,
        statement.includeSection,
        currentLibrarySection,
      );
      context.includeStack.pop();
      emitted.push(...includedStatements);
      appendToFrames(frames, includedStatements.map((item) => item.text).filter(Boolean));
      continue;
    }

    if (directive === "endl") statement.kind = "lib-section-end";

    if (directive === "subckt") {
      appendToFrames(frames, [trimmed]);
      const subckt = parseSubcktHeader(trimmed, statement, scopePath);
      if (!subckt) {
        addWarning(context, {
          code: "MALFORMED_CARD",
          message: "Malformed .subckt header",
          file,
          line: line.line,
          endLine: line.endLine,
        });
      } else {
        if (subckt.depth > context.maxSubcktDepth) {
          throw new ModelImportLimitError("SUBCKT_DEPTH_EXCEEDED", `Subcircuit nesting exceeds ${context.maxSubcktDepth}`);
        }
        addDefinition(context, "subckt", subckt.name, scopePath, statement);
        context.subckts.push(subckt);
        frames.push({ subckt });
      }
    } else if (directive === "ends") {
      const frame = frames.pop();
      if (!frame) {
        addWarning(context, {
          code: "UNBALANCED_SUBCKT",
          message: "Unmatched .ends card",
          file,
          line: line.line,
          endLine: line.endLine,
        });
      } else {
        frame.subckt.endLine = line.endLine;
      }
      appendToFrames(frames, [trimmed]);
    } else {
      appendToFrames(frames, trimmed ? [trimmed] : []);
      if (directive === "model") {
        const model = parseModel(trimmed, statement, scopePath);
        if (!model) {
          addWarning(context, {
            code: "MALFORMED_CARD",
            message: "Malformed .model card",
            file,
            line: line.line,
            endLine: line.endLine,
          });
        } else {
          addDefinition(context, "model", model.name, scopePath, statement);
          context.models.push(model);
        }
      }
    }

    emitted.push(statement);
    context.statements.push(statement);
    if (directive === "endl") currentLibrarySection = inheritedLibrarySection;
  }

  for (const frame of frames) {
    addWarning(context, {
      code: "UNBALANCED_SUBCKT",
      message: `Subcircuit ${frame.subckt.name} has no matching .ends`,
      file: frame.subckt.file,
      line: frame.subckt.line,
      endLine: frame.subckt.endLine,
    });
  }
  return emitted;
}

export function parseSpiceLibrary(text: string, options: ParseOptions = {}): ImportedLibrary {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_BYTES;
  const maxIncludeDepth = options.maxIncludeDepth ?? DEFAULT_MAX_INCLUDE_DEPTH;
  const maxSubcktDepth = options.maxSubcktDepth ?? DEFAULT_MAX_SUBCKT_DEPTH;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError("maxInputBytes must be a positive integer");
  if (!Number.isSafeInteger(maxIncludeDepth) || maxIncludeDepth < 0) throw new TypeError("maxIncludeDepth must be a non-negative integer");
  if (!Number.isSafeInteger(maxSubcktDepth) || maxSubcktDepth <= 0) throw new TypeError("maxSubcktDepth must be a positive integer");

  const virtualFiles = new Map<string, string>();
  for (const [path, contents] of Object.entries(options.virtualFiles ?? {} satisfies VirtualFileMap)) {
    const normalized = normalizeVirtualPath(path);
    if (normalized !== undefined) virtualFiles.set(normalized, contents);
  }
  const filename = normalizeVirtualPath(options.filename ?? "imported.cir") ?? "imported.cir";
  const context: ParseContext = {
    maxBytes,
    maxIncludeDepth,
    maxSubcktDepth,
    virtualFiles,
    models: [],
    subckts: [],
    warnings: [],
    statements: [],
    sourceFiles: new Set<string>(),
    includeStack: [filename],
    totalBytes: 0,
    definitions: new Set<string>(),
  };
  parseFile(context, text, filename, 0);
  return {
    models: context.models,
    subckts: context.subckts,
    warnings: context.warnings,
    statements: context.statements,
    sourceFiles: [...context.sourceFiles],
    totalBytes: context.totalBytes,
  };
}
