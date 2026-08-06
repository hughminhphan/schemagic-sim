import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ModelImportLimitError, parseSpiceLibrary, toLogicalLines, tokenizeSpiceLine } from "../src";

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("SPICE tokenizer and parser", () => {
  it("joins continuations and removes inline comments", () => {
    const lines = toLogicalLines(".model Q NPN (BF=100 ; note\n+ VAF=50) // tail", "x.lib");
    expect(lines[0]?.text).toBe(".model Q NPN (BF=100 VAF=50)");
    expect(lines[0]?.endLine).toBe(2);
  });

  it("keeps grouped expressions as one token", () => {
    expect(tokenizeSpiceLine("E1 out 0 value={limit(V(in), -1, 1)}")).toEqual([
      "E1",
      "out",
      "0",
      "value={limit(V(in), -1, 1)}",
    ]);
  });

  it("parses a realistic continued NPN model card", () => {
    const library = parseSpiceLibrary(fixture("oc2n4401.model"));
    expect(library.models).toHaveLength(1);
    expect(library.models[0]).toMatchObject({ name: "OC2N4401", type: "NPN" });
    expect(library.models[0]?.params.BF).toBe("220");
  });

  it("parses an opamp subcircuit and local model", () => {
    const library = parseSpiceLibrary(fixture("oc-opamp.sub"));
    expect(library.subckts[0]?.pins).toEqual(["INP", "INN", "VCC", "VEE", "OUT"]);
    expect(library.subckts[0]?.params).toEqual({ GAIN: "200k", GBW: "1Meg" });
    expect(library.models[0]).toMatchObject({ name: "OCLIM", parentSubckt: "OCAMP" });
    expect(library.subckts[0]?.body.some((line) => line.startsWith("EOUT"))).toBe(true);
  });

  it("parses all named sections in a root .lib file", () => {
    const library = parseSpiceLibrary(fixture("corners.lib"), { filename: "corners.lib" });
    expect(library.models).toHaveLength(3);
    expect(library.statements.filter((statement) => statement.kind === "lib-section-start")).toHaveLength(3);
  });

  it("parses nested subcircuits with bounded depth", () => {
    const library = parseSpiceLibrary(".subckt OUT A B\n.subckt INNER X Y\nR1 X Y 1k\n.ends INNER\n.ends OUT");
    expect(library.subckts.map((subckt) => [subckt.name, subckt.depth, subckt.parentSubckt])).toEqual([
      ["OUT", 1, undefined],
      ["INNER", 2, "OUT"],
    ]);
  });

  it("expands chained caller-supplied virtual includes", () => {
    const library = parseSpiceLibrary('.include "models/first.lib"', {
      filename: "root.cir",
      virtualFiles: {
        "models/first.lib": '.include "second.lib"\n.model FIRST D(IS=1p)',
        "models/second.lib": ".model SECOND D(IS=2p)",
      },
    });
    expect(library.models.map((model) => model.name)).toEqual(["SECOND", "FIRST"]);
    expect(library.sourceFiles).toEqual(["root.cir", "models/first.lib", "models/second.lib"]);
  });

  it("selects a named section from a virtual .lib include", () => {
    const library = parseSpiceLibrary(".lib corners.lib FAST", {
      filename: "root.cir",
      virtualFiles: { "corners.lib": fixture("corners.lib") },
    });
    expect(library.models.map((model) => model.params.N)).toEqual(["1.55"]);
  });

  it("warns and does not resolve traversal paths", () => {
    const library = parseSpiceLibrary(".include ../../etc/passwd", {
      virtualFiles: { "etc/passwd": ".model BAD D" },
    });
    expect(library.models).toHaveLength(0);
    expect(library.warnings.some((warning) => warning.code === "INVALID_INCLUDE")).toBe(true);
  });

  it("blocks include cycles", () => {
    const library = parseSpiceLibrary(".include a.lib", {
      filename: "root.cir",
      virtualFiles: { "a.lib": ".include a.lib\n.model A D" },
    });
    expect(library.models.map((model) => model.name)).toEqual(["A"]);
    expect(library.warnings.some((warning) => warning.code === "INCLUDE_CYCLE")).toBe(true);
  });

  it("enforces the aggregate input size cap", () => {
    expect(() => parseSpiceLibrary(`*${"x".repeat(100)}`, { maxInputBytes: 32 })).toThrowError(ModelImportLimitError);
  });

  it("enforces the nested subcircuit cap", () => {
    const nested = ".subckt A 1 2\n.subckt B 1 2\nR1 1 2 1k\n.ends\n.ends";
    expect(() => parseSpiceLibrary(nested, { maxSubcktDepth: 1 })).toThrowError(
      expect.objectContaining({ code: "SUBCKT_DEPTH_EXCEEDED" }),
    );
  });

  it("enforces the virtual include recursion cap", () => {
    expect(() =>
      parseSpiceLibrary(".include a.lib", {
        maxIncludeDepth: 0,
        virtualFiles: { "a.lib": ".model A D" },
      }),
    ).toThrowError(expect.objectContaining({ code: "INCLUDE_DEPTH_EXCEEDED" }));
  });
});
