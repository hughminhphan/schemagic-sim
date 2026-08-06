import type {
  BlockedReason,
  ImportedLibrary,
  ImportedStatement,
  RemovedStatement,
  SanitizeOptions,
  SanitizeResult,
} from "./types";

const SAFE_DIRECTIVES = new Set(["model", "subckt", "ends", "param", "func", "if", "elseif", "else", "endif"]);
const DEVICE_INITIALS = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "o", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]);
const DANGEROUS_DIRECTIVES = new Map<string, { code: BlockedReason["code"]; message: string }>([
  ["shell", { code: "SHELL_COMMAND", message: ".shell commands are forbidden" }],
  ["load", { code: "XSPICE_CODEMODEL", message: ".load extensions are forbidden" }],
  ["codemodel", { code: "XSPICE_CODEMODEL", message: ".codemodel extensions are forbidden" }],
  ["csparam", { code: "FILE_IO", message: ".csparam is forbidden for imported models" }],
  ["write", { code: "FILE_IO", message: "Rawfile writes are forbidden" }],
  ["wrdata", { code: "FILE_IO", message: "Data file writes are forbidden" }],
  ["hardcopy", { code: "FILE_IO", message: "Hardcopy file writes are forbidden" }],
  ["source", { code: "FILE_IO", message: "Loading command files is forbidden" }],
]);

function remove(
  statement: ImportedStatement,
  reason: string,
  category: RemovedStatement["category"],
  removed: RemovedStatement[],
): void {
  removed.push({
    text: statement.text,
    reason,
    category,
    file: statement.file,
    line: statement.line,
    endLine: statement.endLine,
  });
}

function block(
  statement: ImportedStatement,
  code: BlockedReason["code"],
  message: string,
  removed: RemovedStatement[],
  blockedReasons: BlockedReason[],
): void {
  remove(statement, message, "security", removed);
  blockedReasons.push({ code, message, file: statement.file, line: statement.line, endLine: statement.endLine });
}

function hasNetworkAccess(text: string): boolean {
  return /(?:https?|wss?|ftp|file):(?:\/\/)?/i.test(text) || /\b(?:curl|wget|socket|connect)\s*\(/i.test(text);
}

function hasFileOrProcessFunction(text: string): boolean {
  return /\b(?:shell|system|exec|popen|fopen|readfile|writefile)\s*\(/i.test(text)
    || /\b(?:file|filename|wavefile)\s*=/i.test(text)
    || /\bpwl\s*\([^)]*\bfile\b/i.test(text);
}

function hasRedirectingCommand(text: string): boolean {
  return /^\s*\.?(?:echo|print|write|wrdata|hardcopy)\b.*(?:>>?|<)/i.test(text);
}

function isCommandLike(text: string): boolean {
  return /^\s*\.?(?:shell|system|exec|echo|print|write|wrdata|hardcopy|quit|source)\b/i.test(text);
}

function hasShellMetacharacters(text: string): boolean {
  return /(?:&&|\|\||[|`]|\$\(|>>?|<)/.test(text);
}

export function sanitize(library: ImportedLibrary, options: SanitizeOptions = {}): SanitizeResult {
  const output: string[] = [];
  const removed: RemovedStatement[] = [];
  const blockedReasons: BlockedReason[] = [];
  let controlDepth = 0;
  let emittedSubcktDepth = 0;

  for (const statement of library.statements) {
    const text = statement.text.trim();
    const directive = statement.directive?.toLowerCase();

    if (controlDepth > 0) {
      if (directive === "control") controlDepth += 1;
      if (directive === "endc") controlDepth -= 1;
      block(statement, "CONTROL_BLOCK", "Content inside a .control block is forbidden", removed, blockedReasons);
      continue;
    }

    if (directive === "control") {
      controlDepth = 1;
      block(statement, "CONTROL_BLOCK", ".control blocks are forbidden", removed, blockedReasons);
      continue;
    }
    if (directive === "endc") {
      block(statement, "CONTROL_BLOCK", "Unmatched .endc command is forbidden", removed, blockedReasons);
      continue;
    }

    if (statement.kind === "blank") continue;
    if (statement.kind === "comment") {
      if (options.preserveComments) output.push(text);
      continue;
    }
    if (statement.kind === "lib-section-start" || statement.kind === "lib-section-end") {
      output.push(text);
      continue;
    }
    if (statement.kind === "include") {
      if (statement.includeResolved) {
        remove(statement, "Virtual include was expanded inline", "metadata", removed);
      } else {
        block(
          statement,
          statement.includeTarget && /^(?:\/|~|[a-zA-Z]:|\.\.?(?:[\\/]|$))/.test(statement.includeTarget)
            ? "HOST_PATH"
            : "INCLUDE_UNRESOLVED",
          "Includes are allowed only when resolved through the caller virtual file map",
          removed,
          blockedReasons,
        );
      }
      continue;
    }

    if (hasNetworkAccess(text)) {
      block(statement, "NETWORK_ACCESS", "Network references are forbidden", removed, blockedReasons);
      continue;
    }
    if (hasFileOrProcessFunction(text) || hasRedirectingCommand(text)) {
      block(statement, "FILE_IO", "File and process access is forbidden", removed, blockedReasons);
      continue;
    }
    if (isCommandLike(text) && hasShellMetacharacters(text)) {
      block(statement, "SHELL_COMMAND", "Shell command metacharacters are forbidden", removed, blockedReasons);
      continue;
    }

    if (directive) {
      const dangerous = DANGEROUS_DIRECTIVES.get(directive);
      if (dangerous) {
        block(statement, dangerous.code, dangerous.message, removed, blockedReasons);
        continue;
      }
      if (directive === "end") {
        remove(statement, ".end is supplied by the generated netlist", "metadata", removed);
        continue;
      }
      if (!SAFE_DIRECTIVES.has(directive)) {
        remove(statement, `Directive .${directive} is outside the model import whitelist`, "unsupported", removed);
        continue;
      }
      if (directive === "subckt") emittedSubcktDepth += 1;
      if (directive === "ends") {
        if (emittedSubcktDepth === 0) {
          remove(statement, "Unmatched .ends was removed", "unsupported", removed);
          continue;
        }
        emittedSubcktDepth -= 1;
      }
      output.push(text);
      continue;
    }

    if (statement.scopePath.length === 0) {
      remove(statement, "Top-level circuit elements are not imported as model library content", "top-level-circuit", removed);
      continue;
    }
    const initial = text[0]?.toLowerCase();
    if (!initial || !DEVICE_INITIALS.has(initial)) {
      remove(statement, "Subcircuit line is outside the device whitelist", "unsupported", removed);
      continue;
    }
    if (initial === "a") {
      block(statement, "XSPICE_CODEMODEL", "XSPICE A devices are forbidden", removed, blockedReasons);
      continue;
    }
    if (isCommandLike(text)) {
      block(statement, "SHELL_COMMAND", "Command-like text is forbidden inside subcircuits", removed, blockedReasons);
      continue;
    }
    output.push(text);
  }

  while (emittedSubcktDepth > 0) {
    output.push(".ends");
    emittedSubcktDepth -= 1;
  }

  return {
    cleanText: output.length > 0 ? `${output.join("\n")}\n` : "",
    removed,
    blockedReasons,
  };
}
