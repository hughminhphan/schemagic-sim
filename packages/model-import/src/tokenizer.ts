import type { SourceLocation } from "./types";

export interface LogicalLine extends SourceLocation {
  text: string;
  raw: string;
}

function stripInlineComment(input: string): string {
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    const next = input[index + 1];
    if (quote) {
      if (character === quote && input[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ";") return input.slice(0, index).trimEnd();
    if (character === "/" && next === "/") {
      return input.slice(0, index).trimEnd();
    }
  }
  return input.trimEnd();
}

export function toLogicalLines(text: string, file = "imported.cir"): LogicalLine[] {
  const physicalLines = text.replace(/\r\n?/g, "\n").split("\n");
  const logical: LogicalLine[] = [];

  physicalLines.forEach((raw, zeroBasedLine) => {
    const lineNumber = zeroBasedLine + 1;
    const trimmedStart = raw.trimStart();
    if (trimmedStart.startsWith("*")) {
      logical.push({ file, line: lineNumber, endLine: lineNumber, text: trimmedStart, raw });
      return;
    }

    const withoutComment = stripInlineComment(raw);
    const continuation = withoutComment.trimStart().startsWith("+");
    if (continuation && logical.length > 0) {
      const previous = logical[logical.length - 1]!;
      const addition = withoutComment.trimStart().slice(1).trim();
      previous.text = `${previous.text.trimEnd()} ${addition}`.trimEnd();
      previous.raw = `${previous.raw}\n${raw}`;
      previous.endLine = lineNumber;
      return;
    }

    logical.push({
      file,
      line: lineNumber,
      endLine: lineNumber,
      text: withoutComment.trim(),
      raw,
    });
  });

  return logical;
}

export function tokenizeSpiceLine(input: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | undefined;
  let braceDepth = 0;
  let parenDepth = 0;

  const flush = (): void => {
    if (token.length > 0) tokens.push(token);
    token = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quote) {
      token += character;
      if (character === quote && input[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      token += character;
      continue;
    }
    if (character === "{") braceDepth += 1;
    else if (character === "}" && braceDepth > 0) braceDepth -= 1;
    else if (character === "(") parenDepth += 1;
    else if (character === ")" && parenDepth > 0) parenDepth -= 1;

    if (braceDepth === 0 && parenDepth === 0 && (character === " " || character === "\t" || character === ",")) {
      flush();
    } else {
      token += character;
    }
  }
  flush();
  return tokens;
}

export function unquoteSpiceToken(token: string): string {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return token.slice(1, -1);
  }
  return token;
}
