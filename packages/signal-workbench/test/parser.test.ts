import { describe, expect, it } from "vitest";
import { parseSignalExpression, serializeSignalExpression } from "../src/index";

describe("signal expression parser", () => {
  it("parses runtime and stable schematic references canonically", () => {
    const cases = [
      "V(n1)",
      "V(wire:w1,pin:c2:1)",
      "I(component:c3,collector)",
      "I(R1,0)",
      "P(component:c4)",
    ];
    for (const source of cases) {
      const parsed = parseSignalExpression(source);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(serializeSignalExpression(parsed.expression)).toBe(source);
    }
  });

  it("uses deterministic precedence and case-sensitive engineering prefixes", () => {
    const parsed = parseSignalExpression("1M+2*3mV");
    expect(parsed).toMatchObject({ ok: true, canonical: "(1000000+(2*0.003V))" });
  });

  it("supports the conservative engineering function set", () => {
    for (const source of ["real(V(n1))", "imag(V(n1))", "mag(V(n1))", "phase(V(n1))", "abs(V(n1))", "sqrt(4)", "log(10)", "ln(1)", "exp(0)", "db20(1)", "min(1,2)", "max(1,2)"]) {
      expect(parseSignalExpression(source).ok, source).toBe(true);
    }
  });

  it("returns bounded, located diagnostics without evaluating text", () => {
    expect(parseSignalExpression("evil(1)")).toMatchObject({ ok: false, diagnostics: [{ code: "UNKNOWN_FUNCTION", start: 0 }] });
    expect(parseSignalExpression("V(pin:c1)")).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_REFERENCE" }] });
    expect(parseSignalExpression("1/0").ok).toBe(true);
    expect(parseSignalExpression("(".repeat(40) + "1" + ")".repeat(40))).toMatchObject({ ok: false, diagnostics: [{ code: "DEPTH_LIMIT" }] });
  });
});
