import { describe, expect, it } from "vitest";
import { evaluateSignalExpression, parseSignalExpression } from "../src/index";
import { FixtureResolver, complex, real, CURRENT_DIMENSION, POWER_DIMENSION } from "./helpers";

function expression(source: string) {
  const parsed = parseSignalExpression(source);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return parsed.expression;
}

describe("signal expression evaluator", () => {
  it("evaluates voltage, differential voltage, terminal current, and absorbed power", () => {
    const resolver = new FixtureResolver();
    resolver.nodes.set("node:0", real([0, 0, 0]));
    resolver.nodes.set("wire:w1", real([1, 2, 3]));
    resolver.nodes.set("pin:c2:1", real([0.25, 0.5, 0.75]));
    resolver.currents.set("component:c3:collector", real([0.1, 0.2, 0.3], "A", CURRENT_DIMENSION));
    resolver.powers.set("component:c4", real([1, -2, 3], "W", POWER_DIMENSION));
    const voltage = evaluateSignalExpression(expression("V(wire:w1,pin:c2:1)"), resolver);
    const current = evaluateSignalExpression(expression("I(component:c3,collector)"), resolver);
    const power = evaluateSignalExpression(expression("P(component:c4)"), resolver);
    expect(voltage.ok && [...voltage.signal.values]).toEqual([0.75, 1.5, 2.25]);
    expect(current.ok && current.signal.unit).toBe("A");
    expect(power.ok && [...power.signal.values]).toEqual([1, -2, 3]);
  });

  it("performs complex arithmetic and explicit magnitude/phase transforms", () => {
    const resolver = new FixtureResolver();
    resolver.nodes.set("node:0", complex([0, 0, 0, 0]));
    resolver.nodes.set("node:out", complex([0, 1, -1, 0]));
    const magnitude = evaluateSignalExpression(expression("mag(V(out))"), resolver);
    const phase = evaluateSignalExpression(expression("phase(V(out))"), resolver);
    expect(magnitude.ok && [...magnitude.signal.values]).toEqual([1, 1]);
    expect(phase.ok && [...phase.signal.values]).toEqual([90, 180]);
    expect(phase.ok && phase.signal.unit).toBe("deg");
  });

  it("broadcasts constants and validates dimensions and domains", () => {
    const resolver = new FixtureResolver();
    resolver.nodes.set("node:0", real([0, 0]));
    resolver.nodes.set("node:n1", real([1, 2]));
    const scaled = evaluateSignalExpression(expression("V(n1)*2"), resolver);
    expect(scaled.ok && [...scaled.signal.values]).toEqual([2, 4]);
    expect(evaluateSignalExpression(expression("V(n1)+1A"), resolver)).toMatchObject({ ok: false, status: "INVALID", diagnostics: [{ code: "DIMENSION" }] });
    expect(evaluateSignalExpression(expression("log(V(n1))"), resolver)).toMatchObject({ ok: false, diagnostics: [{ code: "DIMENSION" }] });
    expect(evaluateSignalExpression(expression("1/0"), resolver)).toMatchObject({ ok: false, diagnostics: [{ code: "DIVIDE_BY_ZERO" }] });
    expect(evaluateSignalExpression(expression("I(component:c9,gate)"), resolver)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });
});
