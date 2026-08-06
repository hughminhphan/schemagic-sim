import { parseSpiceLibrary } from "./parser";
import { sanitize } from "./sanitizer";
import { tokenizeSpiceLine } from "./tokenizer";
import type { ImportedLibrary, NamespacedEmitResult } from "./types";

function key(parts: string[], librarySection?: string): string {
  const scope = parts.map((part) => part.toLowerCase()).join("/");
  return librarySection ? `${librarySection.toLowerCase()}:${scope}` : scope;
}

function safeNamePart(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, "_");
}

function resolveVisible(
  names: Map<string, string>,
  scopePath: string[],
  originalName: string,
  librarySection?: string,
): string | undefined {
  for (let depth = scopePath.length; depth >= 0; depth -= 1) {
    const candidate = names.get(key([...scopePath.slice(0, depth), originalName], librarySection));
    if (candidate) return candidate;
  }
  return undefined;
}

function rewriteElement(
  text: string,
  scopePath: string[],
  modelNames: Map<string, string>,
  subcktNames: Map<string, string>,
  librarySection?: string,
): string {
  const tokens = tokenizeSpiceLine(text);
  const initial = tokens[0]?.[0]?.toLowerCase();
  if (!initial) return text;

  const replaceLastVisible = (startIndex: number, names: Map<string, string>): void => {
    for (let index = tokens.length - 1; index >= startIndex; index -= 1) {
      const token = tokens[index]!;
      if (token.includes("=")) continue;
      const replacement = resolveVisible(names, scopePath, token, librarySection);
      if (replacement) {
        tokens[index] = replacement;
        return;
      }
    }
  };

  if (initial === "x") replaceLastVisible(1, subcktNames);
  else if (["d", "j", "m", "q", "s", "w"].includes(initial)) replaceLastVisible(initial === "d" ? 3 : 2, modelNames);
  return tokens.join(" ");
}

export function emitNamespacedLibrary(library: ImportedLibrary, prefix: string): NamespacedEmitResult {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(prefix)) {
    throw new TypeError("Namespace prefix must start with a letter or underscore and contain only letters, digits, and underscores");
  }
  const sanitized = sanitize(library);
  const reparsed = parseSpiceLibrary(sanitized.cleanText, { filename: "sanitized.lib" });
  const modelMap = new Map<string, string>();
  const subcktMap = new Map<string, string>();
  const used = new Set<string>();

  const uniqueName = (parts: string[]): string => {
    const base = [prefix, ...parts].map(safeNamePart).join("_");
    let result = base;
    let suffix = 2;
    while (used.has(result.toLowerCase())) result = `${base}_${suffix++}`;
    used.add(result.toLowerCase());
    return result;
  };

  for (const subckt of reparsed.subckts) {
    const nameParts = subckt.librarySection ? [subckt.librarySection, ...subckt.scopePath] : subckt.scopePath;
    subcktMap.set(key(subckt.scopePath, subckt.librarySection), uniqueName(nameParts));
  }
  for (const model of reparsed.models) {
    const scope = [...model.scopePath, model.name];
    const nameParts = model.librarySection ? [model.librarySection, ...scope] : scope;
    modelMap.set(key(scope, model.librarySection), uniqueName(nameParts));
  }

  const output: string[] = [];
  for (const statement of reparsed.statements) {
    const directive = statement.directive?.toLowerCase();
    if (statement.kind === "blank" || statement.kind === "comment") continue;
    if (directive === "subckt") {
      const tokens = tokenizeSpiceLine(statement.text);
      const original = tokens[1];
      if (original) {
        const replacement = subcktMap.get(key([...statement.scopePath, original], statement.librarySection));
        if (replacement) tokens[1] = replacement;
      }
      output.push(tokens.join(" "));
      continue;
    }
    if (directive === "ends") {
      const tokens = tokenizeSpiceLine(statement.text);
      const replacement = subcktMap.get(key(statement.scopePath, statement.librarySection));
      if (replacement && tokens.length > 1) tokens[1] = replacement;
      output.push(tokens.join(" "));
      continue;
    }
    if (directive === "model") {
      const tokens = tokenizeSpiceLine(statement.text);
      const original = tokens[1];
      if (original) {
        const replacement = modelMap.get(key([...statement.scopePath, original], statement.librarySection));
        if (replacement) tokens[1] = replacement;
      }
      output.push(tokens.join(" "));
      continue;
    }
    if (!directive) {
      output.push(rewriteElement(statement.text, statement.scopePath, modelMap, subcktMap, statement.librarySection));
      continue;
    }
    output.push(statement.text);
  }

  return {
    text: output.length > 0 ? `${output.join("\n")}\n` : "",
    modelNames: Object.fromEntries(modelMap),
    subcktNames: Object.fromEntries(subcktMap),
    removed: sanitized.removed,
    blockedReasons: sanitized.blockedReasons,
  };
}
