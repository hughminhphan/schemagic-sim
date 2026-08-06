import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  derivePinMappingSpec,
  emitNamespacedLibrary,
  parseSpiceLibrary,
  validatePinMapping,
  type PinMappingSpec,
} from "../src";

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("pin mapping", () => {
  it("suggests a five-pin opamp mapping", () => {
    const subckt = parseSpiceLibrary(fixture("oc-opamp.sub")).subckts[0]!;
    const spec = derivePinMappingSpec(subckt);
    expect(spec.suggestedSymbol).toBe("opamp");
    expect(spec.userMapping).toEqual({ "IN+": 0, "IN-": 1, "V+": 2, "V-": 3, OUT: 4 });
    expect(validatePinMapping(spec)).toEqual({ valid: true, errors: [] });
  });

  it("uses name and pin heuristics for diode, BJT, MOSFET, and regulator shapes", () => {
    const library = parseSpiceLibrary(
      ".subckt FAST_DIODE A K\n.ends\n.subckt NPN_STAGE C B E\n.ends\n.subckt NMOS D G S\n.ends\n.subckt LDO VIN GND VOUT\n.ends",
    );
    expect(library.subckts.map((subckt) => derivePinMappingSpec(subckt).suggestedSymbol)).toEqual([
      "diode",
      "bjt",
      "mosfet",
      "regulator",
    ]);
  });

  it("rejects incomplete, duplicate, and out-of-range mappings", () => {
    const spec: PinMappingSpec = {
      subcktName: "BAD",
      modelPins: ["A", "B", "C"],
      suggestedSymbol: "generic",
      userMapping: { P1: 0, P2: 0, P3: 4 },
    };
    const result = validatePinMapping(spec);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "Model pin index 0 is mapped more than once",
      "Mapping for P3 is outside model pin range",
      "Model pin index 1 is not mapped",
      "Model pin index 2 is not mapped",
    ]));
  });
});

describe("namespaced emission", () => {
  it("renames subcircuits, local models, and common references", () => {
    const result = emitNamespacedLibrary(parseSpiceLibrary(fixture("oc-opamp.sub")), "OC_USER");
    expect(result.text).toContain(".SUBCKT OC_USER_OCAMP");
    expect(result.text).toContain(".MODEL OC_USER_OCAMP_OCLIM");
    expect(result.text).toContain("DHI OUT VCC OC_USER_OCAMP_OCLIM");
    expect(result.text).toContain(".ENDS OC_USER_OCAMP");
  });

  it("rewrites X instance subcircuit references", () => {
    const text = ".subckt CHILD A B\nR1 A B 1k\n.ends CHILD\n.subckt PARENT A B\nX1 A B CHILD\n.ends PARENT";
    const result = emitNamespacedLibrary(parseSpiceLibrary(text), "USR");
    expect(result.text).toContain("X1 A B USR_CHILD");
    expect(result.subcktNames).toEqual({ child: "USR_CHILD", parent: "USR_PARENT" });
  });

  it("keeps library sections distinct when names repeat across corners", () => {
    const result = emitNamespacedLibrary(parseSpiceLibrary(fixture("corners.lib")), "USR");
    expect(result.text).toContain(".model USR_TYP_OCDIODE");
    expect(result.text).toContain(".model USR_FAST_OCDIODE");
    expect(result.text).toContain(".model USR_SLOW_OCDIODE");
    expect(result.text).toContain(".lib TYP");
  });

  it("sanitizes before emission", () => {
    const result = emitNamespacedLibrary(parseSpiceLibrary(".shell touch /x\n.model M D"), "USR");
    expect(result.text).toBe(".model USR_M D\n");
    expect(result.blockedReasons[0]?.code).toBe("SHELL_COMMAND");
  });

  it("rejects invalid namespace prefixes", () => {
    expect(() => emitNamespacedLibrary(parseSpiceLibrary(".model M D"), "bad-prefix")).toThrow(TypeError);
  });
});
