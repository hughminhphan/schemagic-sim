import { describe, expect, it } from "vitest";
import { circuitOnlyStructuralSvgPreview } from "./SchematicPreview";

const SVG = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640" role="img"><metadata id="schemagic-circuit-metadata-v2">exact</metadata><rect width="900" height="640"/><text data-header-kind="title">Audit header</text><path class="header-rule" d="M0 220H900"/><g class="world" transform="translate(0 240) scale(24)"><path data-component-id="r1"/></g></svg>`;

describe("circuitOnlyStructuralSvgPreview", () => {
  it("crops only the root viewport while retaining exact metadata and graph bytes", () => {
    const preview = circuitOnlyStructuralSvgPreview(SVG);

    expect(preview).toContain('height="420"');
    expect(preview).toContain('viewBox="0 220 900 420"');
    expect(preview).toContain('data-designer-circuit-crop="true"');
    expect(preview).toContain('<metadata id="schemagic-circuit-metadata-v2">exact</metadata>');
    expect(preview).toContain('<text data-header-kind="title">Audit header</text>');
    expect(preview).toContain('<g class="world" transform="translate(0 240) scale(24)"><path data-component-id="r1"/></g>');
  });

  it("fails closed when the generated header boundary is absent or ambiguous", () => {
    expect(() => circuitOnlyStructuralSvgPreview(SVG.replace(/<path class="header-rule"[^>]+\/>/u, "")))
      .toThrow("header boundary is ambiguous");
    expect(() => circuitOnlyStructuralSvgPreview(SVG.replace("</svg>", '<path class="header-rule" d="M0 220H900"/></svg>')))
      .toThrow("header boundary is ambiguous");
  });

  it("rejects a boundary that does not bind the exact SVG width", () => {
    expect(() => circuitOnlyStructuralSvgPreview(SVG.replace("M0 220H900", "M0 220H899")))
      .toThrow("outside the exact coordinate space");
  });
});
