import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PARTS } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { EDITOR_SYMBOLS } from "./symbols.generated";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function countClass(markup: string, className: string): number {
  return [...markup.matchAll(/class="([^"]+)"/g)]
    .filter((match) => match[1]?.split(/\s+/).includes(className))
    .length;
}

describe("generated KiCad editor symbols", () => {
  for (const part of PARTS) {
    it(`${part.type} matches the editor contract`, () => {
      const symbol = EDITOR_SYMBOLS[part.type];
      expect(symbol.type).toBe(part.type);
      expect(symbol.pins).toEqual(part.pins);

      const [minX, minY, maxX, maxY] = symbol.bbox;
      expect(symbol.bbox.every(Number.isFinite)).toBe(true);
      expect(maxX).toBeGreaterThan(minX);
      expect(maxY).toBeGreaterThan(minY);
      for (const [x, y] of symbol.pins) {
        expect(x).toBeGreaterThanOrEqual(minX);
        expect(x).toBeLessThanOrEqual(maxX);
        expect(y).toBeGreaterThanOrEqual(minY);
        expect(y).toBeLessThanOrEqual(maxY);
      }

      expect(symbol.markup.length).toBeGreaterThan(0);
      const allMarkup = [symbol.markup, symbol.wiper, symbol.lever].filter((value): value is string => value !== undefined).join("");
      expect(allMarkup).not.toMatch(/\b(?:stroke|fill|style)=/);
      expect(allMarkup).not.toMatch(/<text\b/i);
      for (const classAttribute of allMarkup.matchAll(/class="([^"]+)"/g)) {
        for (const className of classAttribute[1]!.split(/\s+/)) {
          expect(["sym-bg", "sym-solid", "sym-bold", "pin-lead"]).toContain(className);
        }
      }
    });
  }

  it("isolates the potentiometer wiper", () => {
    expect(EDITOR_SYMBOLS.potentiometer.wiper).toBeTruthy();
    expect(countClass(EDITOR_SYMBOLS.potentiometer.wiper!, "pin-lead")).toBe(1);
  });

  it("isolates the open switch lever and pivot", () => {
    expect(EDITOR_SYMBOLS.switch_spst.lever).toBeTruthy();
    expect(EDITOR_SYMBOLS.switch_spst.leverPivot).toEqual([-0.8, 0]);
  });

  it("keeps the two LED emission arrows", () => {
    expect(EDITOR_SYMBOLS.led.markup).toContain("M0.4 1.6");
    expect(EDITOR_SYMBOLS.led.markup).toContain("M0.4 0.9333");
  });

  it("drops opamp rail pins and keeps exactly three electrical leads", () => {
    expect(countClass(EDITOR_SYMBOLS.opamp_ideal.markup, "pin-lead")).toBe(3);
  });

  it("regenerates byte-identically", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "opencircuit-symbols-"));
    const outputPath = join(outputDir, "symbols.generated.ts");
    execFileSync(process.execPath, [join(packageRoot, "scripts", "generate-symbols.mjs"), "--output", outputPath], {
      cwd: packageRoot,
      stdio: "pipe",
    });
    expect(readFileSync(outputPath)).toEqual(readFileSync(join(packageRoot, "src", "symbols.generated.ts")));
  });
});
