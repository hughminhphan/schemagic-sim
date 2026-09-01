const ROOT_OPEN_PATTERN = /<svg\b[^>]*>/u;
const WIDTH_PATTERN = /\bwidth="([0-9]+(?:\.[0-9]+)?)"/u;
const HEIGHT_PATTERN = /\bheight="([0-9]+(?:\.[0-9]+)?)"/u;
const VIEW_BOX_PATTERN = /\bviewBox="0 0 ([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?)"/u;
const HEADER_RULE_PATTERN = /<path class="header-rule" d="M0 ([0-9]+(?:\.[0-9]+)?)H([0-9]+(?:\.[0-9]+)?)"\/>/gu;

function finitePositive(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`Structural SVG ${label} is invalid`);
  }
  return parsed;
}

/**
 * Create a screen-only circuit crop of the exact generated structural SVG.
 *
 * The downloadable artifact is deliberately left untouched. Only the root
 * viewport changes: metadata, component coordinates, wires, labels and the
 * provenance header all remain byte-for-byte present in the preview source.
 * The header lies outside the visible viewBox so the circuit is useful at the
 * scale of the Designer workspace instead of opening on a wall of audit text.
 */
export function circuitOnlyStructuralSvgPreview(source: string): string {
  const rootMatch = source.match(ROOT_OPEN_PATTERN);
  if (rootMatch?.index === undefined) throw new TypeError("Structural SVG root is missing");
  const root = rootMatch[0];
  const width = finitePositive(root.match(WIDTH_PATTERN)?.[1], "width");
  const height = finitePositive(root.match(HEIGHT_PATTERN)?.[1], "height");
  const viewBox = root.match(VIEW_BOX_PATTERN);
  if (viewBox === null
    || finitePositive(viewBox[1], "viewBox width") !== width
    || finitePositive(viewBox[2], "viewBox height") !== height) {
    throw new TypeError("Structural SVG viewBox does not match its exact coordinate space");
  }
  const headerRules = [...source.matchAll(HEADER_RULE_PATTERN)];
  if (headerRules.length !== 1) throw new TypeError("Structural SVG header boundary is ambiguous");
  const cropY = finitePositive(headerRules[0]?.[1], "header boundary");
  const ruleWidth = finitePositive(headerRules[0]?.[2], "header rule width");
  if (ruleWidth !== width || cropY >= height - 1) {
    throw new TypeError("Structural SVG header boundary is outside the exact coordinate space");
  }
  const croppedHeight = height - cropY;
  const nextRoot = root
    .replace(HEIGHT_PATTERN, `height="${croppedHeight}"`)
    .replace(VIEW_BOX_PATTERN, `viewBox="0 ${cropY} ${width} ${croppedHeight}"`)
    .replace(/>$/u, ' data-designer-circuit-crop="true">');
  return `${source.slice(0, rootMatch.index)}${nextRoot}${source.slice(rootMatch.index + root.length)}`;
}
