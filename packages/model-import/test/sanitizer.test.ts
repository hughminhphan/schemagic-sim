import { describe, expect, it } from "vitest";
import { parseSpiceLibrary, sanitize } from "../src";

function clean(text: string, virtualFiles?: Record<string, string>) {
  return sanitize(parseSpiceLibrary(text, virtualFiles ? { virtualFiles } : {}));
}

describe("untrusted model sanitizer", () => {
  it("keeps only model library content from a .cir deck", () => {
    const result = clean("V1 IN 0 5\n.model SAFE D(IS=1p)\n.tran 1n 1u\n.end");
    expect(result.cleanText).toBe(".model SAFE D(IS=1p)\n");
    expect(result.removed.map((item) => item.category)).toContain("top-level-circuit");
  });

  it("removes a control block embedded inside a subcircuit", () => {
    const result = clean(".subckt SAFE A B\nR1 A B 1k\n.control\nshell touch /owned\n.endc\nC1 A B 1n\n.ends SAFE");
    expect(result.cleanText).toContain("R1 A B 1k");
    expect(result.cleanText).toContain("C1 A B 1n");
    expect(result.cleanText).not.toContain("touch");
    expect(result.blockedReasons.every((reason) => reason.code === "CONTROL_BLOCK")).toBe(true);
  });

  it.each([".shell rm -rf /", ".load plugin.so", ".codemodel evil.cm", ".csparam x=writefile('x')"])(
    "blocks dangerous directive %s",
    (line) => {
      const result = clean(`${line}\n.model SAFE D`);
      expect(result.cleanText).toBe(".model SAFE D\n");
      expect(result.blockedReasons).toHaveLength(1);
    },
  );

  it("blocks echo and print redirection", () => {
    const result = clean(".echo secret > /host/out\n.print tran v(out) >> result.txt\n.model SAFE D");
    expect(result.blockedReasons.map((reason) => reason.code)).toEqual(["FILE_IO", "FILE_IO"]);
  });

  it("blocks network references and process functions", () => {
    const result = clean(".param A=readfile('file:///etc/passwd')\n.param B=system('id')\n.model SAFE D");
    expect(result.cleanText).toBe(".model SAFE D\n");
    expect(result.blockedReasons.map((reason) => reason.code)).toEqual(["NETWORK_ACCESS", "FILE_IO"]);
  });

  it("blocks device-level file loading and command file sourcing", () => {
    const result = clean(".subckt BAD A B\nV1 A B PWL FILE=/host/wave.txt\n.ends BAD\n.source commands.sp\n.model SAFE D");
    expect(result.cleanText).not.toContain("PWL");
    expect(result.blockedReasons.map((reason) => reason.code)).toEqual(["FILE_IO", "FILE_IO"]);
  });

  it.each(["/etc/passwd", "../secret.lib", "C:\\Windows\\system32\\x.lib", "~/private.lib"])(
    "blocks host include path %s",
    (path) => {
      const result = clean(`.include "${path}"\n.model SAFE D`);
      expect(result.cleanText).toBe(".model SAFE D\n");
      expect(result.blockedReasons[0]?.code).toBe("HOST_PATH");
    },
  );

  it("blocks unresolved relative includes", () => {
    const result = clean(".include models/missing.lib\n.model SAFE D");
    expect(result.blockedReasons[0]?.code).toBe("INCLUDE_UNRESOLVED");
  });

  it("allows only virtual include resolution and flattens it", () => {
    const result = clean(".include models/safe.lib", { "models/safe.lib": ".model VIRTUAL D(IS=1p)" });
    expect(result.cleanText).toBe(".model VIRTUAL D(IS=1p)\n");
    expect(result.blockedReasons).toHaveLength(0);
    expect(result.removed[0]?.category).toBe("metadata");
  });

  it("blocks XSPICE A devices inside otherwise valid subcircuits", () => {
    const result = clean(".subckt X A B\nA1 A B CODE\nR1 A B 1k\n.ends X");
    expect(result.cleanText).not.toContain("A1");
    expect(result.blockedReasons[0]?.code).toBe("XSPICE_CODEMODEL");
  });

  it("removes non-whitelisted simulator directives", () => {
    const result = clean(".option numdgt=15\n.save all\n.measure tran X max v(out)\n.model SAFE D");
    expect(result.cleanText).toBe(".model SAFE D\n");
    expect(result.removed).toHaveLength(3);
  });
});
