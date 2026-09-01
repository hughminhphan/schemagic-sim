import type {
  EngineeringFunction,
  ParseSignalResult,
  SerializedComponentReference,
  SerializedNodeReference,
  SerializedSignalExpression,
  SerializedTerminalReference,
  SignalDiagnostic,
} from "./types";
import { canonicalNumber, parseEngineeringLiteral } from "./units";

export const MAX_EXPRESSION_SOURCE_LENGTH = 4096;
export const MAX_EXPRESSION_TOKENS = 256;
export const MAX_EXPRESSION_DEPTH = 32;

type TokenKind = "number" | "identifier" | "operator" | "left" | "right" | "comma" | "eof";
interface Token { kind: TokenKind; text: string; start: number; end: number }

class ParseFailure extends Error {
  constructor(readonly diagnostic: SignalDiagnostic) {
    super(diagnostic.message);
  }
}

function failure(code: string, message: string, start: number, end: number): never {
  throw new ParseFailure({ code, message, start, end });
}

function tokenize(source: string): Token[] {
  if (source.length > MAX_EXPRESSION_SOURCE_LENGTH) {
    failure("SOURCE_LIMIT", `Signal expression exceeds ${MAX_EXPRESSION_SOURCE_LENGTH} characters`, 0, source.length);
  }
  const tokens: Token[] = [];
  let index = 0;
  const push = (kind: TokenKind, start: number, end: number): void => {
    tokens.push({ kind, text: source.slice(start, end), start, end });
    if (tokens.length > MAX_EXPRESSION_TOKENS) failure("TOKEN_LIMIT", `Signal expression exceeds ${MAX_EXPRESSION_TOKENS} tokens`, start, end);
  };
  while (index < source.length) {
    const code = source[index]!;
    if (/\s/u.test(code)) { index += 1; continue; }
    const start = index;
    if (code === "(" || code === ")" || code === ",") {
      index += 1;
      push(code === "(" ? "left" : code === ")" ? "right" : "comma", start, index);
      continue;
    }
    if ("+-*/^".includes(code)) { index += 1; push("operator", start, index); continue; }
    if (/\d|\./u.test(code)) {
      const matched = source.slice(index).match(/^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?:[fpnuµmkMGT]?(?:V|A|W|s|Hz|Ohm|ohm|Ω|rad|deg|dB)?)?/u);
      const text = matched?.[0] ?? "";
      if (!text || text === ".") failure("INVALID_NUMBER", "Invalid numeric literal", start, start + 1);
      index += text.length;
      push("number", start, index);
      continue;
    }
    if (/[A-Za-z_]/u.test(code)) {
      index += 1;
      while (index < source.length && /[A-Za-z0-9_.:#-]/u.test(source[index]!)) index += 1;
      push("identifier", start, index);
      continue;
    }
    failure("INVALID_CHARACTER", `Invalid character ${JSON.stringify(code)}`, start, start + 1);
  }
  tokens.push({ kind: "eof", text: "", start: source.length, end: source.length });
  return tokens;
}

const FUNCTIONS = new Set<EngineeringFunction>(["real", "imag", "mag", "phase", "abs", "sqrt", "log", "ln", "exp", "db20", "min", "max"]);
const PRECEDENCE: Readonly<Record<string, number>> = { "+": 10, "-": 10, "*": 20, "/": 20, "^": 30 };

class Parser {
  private cursor = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): SerializedSignalExpression {
    const expression = this.expression(0);
    const trailing = this.peek();
    if (trailing.kind !== "eof") failure("TRAILING_TOKEN", `Unexpected token ${trailing.text}`, trailing.start, trailing.end);
    return expression;
  }

  private expression(minimumPrecedence: number): SerializedSignalExpression {
    this.depth += 1;
    if (this.depth > MAX_EXPRESSION_DEPTH) {
      const token = this.peek();
      failure("DEPTH_LIMIT", `Signal expression exceeds depth ${MAX_EXPRESSION_DEPTH}`, token.start, token.end);
    }
    let left = this.primary();
    while (true) {
      const operator = this.peek();
      if (operator.kind !== "operator") break;
      const precedence = PRECEDENCE[operator.text];
      if (precedence === undefined || precedence < minimumPrecedence) break;
      this.take();
      const right = this.expression(operator.text === "^" ? precedence : precedence + 1);
      left = { kind: "binary", operator: operator.text as "+" | "-" | "*" | "/" | "^", left, right };
    }
    this.depth -= 1;
    return left;
  }

  private primary(): SerializedSignalExpression {
    const token = this.take();
    if (token.kind === "operator" && (token.text === "+" || token.text === "-")) {
      return { kind: "unary", operator: token.text, operand: this.expression(40) };
    }
    if (token.kind === "number") {
      const parsed = parseEngineeringLiteral(token.text);
      if (!parsed) failure("INVALID_NUMBER", `Invalid engineering literal ${token.text}`, token.start, token.end);
      return { kind: "constant", value: parsed.value, unit: parsed.unit };
    }
    if (token.kind === "left") {
      const nested = this.expression(0);
      this.expect("right", "Expected )");
      return nested;
    }
    if (token.kind !== "identifier") failure("EXPECTED_EXPRESSION", "Expected a signal, number, function, or parenthesized expression", token.start, token.end);
    this.expect("left", `Expected ( after ${token.text}`);
    if (token.text === "V") return this.voltage();
    if (token.text === "I") return this.current();
    if (token.text === "P") return this.power();
    if (!FUNCTIONS.has(token.text as EngineeringFunction)) failure("UNKNOWN_FUNCTION", `Unknown engineering function ${token.text}`, token.start, token.end);
    const args = this.argumentExpressions();
    const name = token.text as EngineeringFunction;
    const expected = name === "min" || name === "max" ? { minimum: 2, maximum: 16 } : { minimum: 1, maximum: 1 };
    if (args.length < expected.minimum || args.length > expected.maximum) {
      failure("ARITY", `${name} expects ${expected.minimum === expected.maximum ? expected.minimum : `${expected.minimum} to ${expected.maximum}`} argument(s)`, token.start, token.end);
    }
    return { kind: "call", function: name, arguments: args };
  }

  private voltage(): SerializedSignalExpression {
    const positive = this.nodeReference();
    let negative: SerializedNodeReference = { kind: "runtime-node", name: "0" };
    if (this.peek().kind === "comma") { this.take(); negative = this.nodeReference(); }
    this.expect("right", "Expected ) after voltage reference");
    return { kind: "voltage", positive, negative };
  }

  private current(): SerializedSignalExpression {
    const component = this.componentReference();
    let terminal: SerializedTerminalReference | undefined;
    if (this.peek().kind === "comma") { this.take(); terminal = this.terminalReference(); }
    this.expect("right", "Expected ) after current reference");
    return { kind: "current", component, ...(terminal !== undefined ? { terminal } : {}) };
  }

  private power(): SerializedSignalExpression {
    const component = this.componentReference();
    this.expect("right", "Expected ) after power reference");
    return { kind: "power", component };
  }

  private nodeReference(): SerializedNodeReference {
    const token = this.takeReference("node");
    if (token.text.startsWith("wire:")) {
      const wireId = token.text.slice(5);
      if (!wireId) failure("INVALID_REFERENCE", "Wire reference needs an id", token.start, token.end);
      return { kind: "schematic-wire", wireId };
    }
    if (token.text.startsWith("pin:")) {
      const matched = token.text.match(/^pin:([^:]+):(\d+)$/);
      if (!matched) failure("INVALID_REFERENCE", "Pin reference must be pin:<component-id>:<zero-based-index>", token.start, token.end);
      return { kind: "schematic-pin", componentId: matched[1]!, pin: Number(matched[2]) };
    }
    return { kind: "runtime-node", name: token.text };
  }

  private componentReference(): SerializedComponentReference {
    const token = this.takeReference("device");
    if (token.text.startsWith("component:")) {
      const componentId = token.text.slice(10);
      if (!componentId) failure("INVALID_REFERENCE", "Component reference needs an id", token.start, token.end);
      return { kind: "schematic-component", componentId };
    }
    return { kind: "runtime-device", name: token.text };
  }

  private terminalReference(): SerializedTerminalReference {
    const token = this.takeReference("terminal");
    if (token.kind === "number") {
      if (!/^\d+$/.test(token.text)) failure("INVALID_TERMINAL", "Numeric terminal references must be non-negative integers", token.start, token.end);
      return Number(token.text);
    }
    return token.text;
  }

  private takeReference(label: string): Token {
    const token = this.take();
    if (token.kind !== "identifier" && token.kind !== "number") failure("EXPECTED_REFERENCE", `Expected ${label} reference`, token.start, token.end);
    return token;
  }

  private argumentExpressions(): SerializedSignalExpression[] {
    const args: SerializedSignalExpression[] = [];
    if (this.peek().kind === "right") { this.take(); return args; }
    while (true) {
      args.push(this.expression(0));
      const separator = this.take();
      if (separator.kind === "right") break;
      if (separator.kind !== "comma") failure("EXPECTED_SEPARATOR", "Expected , or )", separator.start, separator.end);
    }
    return args;
  }

  private expect(kind: TokenKind, message: string): Token {
    const token = this.take();
    if (token.kind !== kind) failure("EXPECTED_TOKEN", message, token.start, token.end);
    return token;
  }

  private peek(): Token { return this.tokens[this.cursor] ?? this.tokens.at(-1)!; }
  private take(): Token { const token = this.peek(); this.cursor += 1; return token; }
}

export function parseSignalExpression(source: string): ParseSignalResult {
  try {
    const expression = new Parser(tokenize(source)).parse();
    return { ok: true, expression, canonical: serializeSignalExpression(expression) };
  } catch (caught) {
    if (caught instanceof ParseFailure) return { ok: false, diagnostics: [caught.diagnostic] };
    return { ok: false, diagnostics: [{ code: "PARSE", message: caught instanceof Error ? caught.message : String(caught) }] };
  }
}

function serializeNode(reference: SerializedNodeReference): string {
  if (reference.kind === "runtime-node") return reference.name;
  if (reference.kind === "schematic-wire") return `wire:${reference.wireId}`;
  return `pin:${reference.componentId}:${reference.pin}`;
}

function serializeComponent(reference: SerializedComponentReference): string {
  return reference.kind === "runtime-device" ? reference.name : `component:${reference.componentId}`;
}

export function serializeSignalExpression(expression: SerializedSignalExpression): string {
  switch (expression.kind) {
    case "constant": return `${canonicalNumber(expression.value)}${expression.unit === "1" ? "" : expression.unit}`;
    case "voltage": return expression.negative.kind === "runtime-node" && expression.negative.name === "0"
      ? `V(${serializeNode(expression.positive)})`
      : `V(${serializeNode(expression.positive)},${serializeNode(expression.negative)})`;
    case "current": return `I(${serializeComponent(expression.component)}${expression.terminal === undefined ? "" : `,${String(expression.terminal)}`})`;
    case "power": return `P(${serializeComponent(expression.component)})`;
    case "unary": return `(${expression.operator}${serializeSignalExpression(expression.operand)})`;
    case "binary": return `(${serializeSignalExpression(expression.left)}${expression.operator}${serializeSignalExpression(expression.right)})`;
    case "call": return `${expression.function}(${expression.arguments.map(serializeSignalExpression).join(",")})`;
  }
}
