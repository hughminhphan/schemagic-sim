import { containsUnsafeDesignDisplayCharactersV2 } from "@opencircuit/design-schema";
import { canonicalJson, canonicalProfileNumberV2, compareAscii } from "./canonical";
import type { ProfileEvidenceRef, ProfileQuantity } from "./types";
import type { BoardAreaDimensionTermV2, BoardAreaProjectionV2, MountedGeometryFactsV2 } from "./v2-types";

const DIMENSION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function compareTerm(
  left: Pick<BoardAreaDimensionTermV2, "axis" | "dimensionId">,
  right: Pick<BoardAreaDimensionTermV2, "axis" | "dimensionId">,
): number {
  if (left.axis !== right.axis) return left.axis === "x" ? -1 : 1;
  return compareAscii(left.dimensionId, right.dimensionId);
}

function assertQuantity<Unit extends "m" | "m2">(quantity: ProfileQuantity<Unit>, unit: Unit, label: string): void {
  if (quantity.unit !== unit || !Number.isFinite(quantity.value) || quantity.value <= 0) throw new Error(`${label} must be a positive finite quantity in ${unit}`);
  if (typeof quantity.displayUnit !== "string" || quantity.displayUnit.trim() === "" || containsUnsafeDesignDisplayCharactersV2(quantity.displayUnit)) {
    throw new Error(`${label} requires a nonblank control-free display unit`);
  }
}

function evidenceBytes(evidence: ProfileEvidenceRef): string {
  return canonicalJson(evidence);
}

function expectedEvidenceUnion(sourceDimensions: readonly BoardAreaDimensionTermV2[]): string[] {
  const bytes = sourceDimensions.flatMap((term) => {
    if (term.evidence.length === 0) throw new Error("Every V2 board-area dimension requires evidence");
    return term.evidence.map(evidenceBytes);
  }).sort(compareAscii);
  for (let index = 1; index < bytes.length; index += 1) {
    if (bytes[index - 1] === bytes[index]) bytes.splice(index--, 1);
  }
  return bytes;
}

/** Calculates the V2 conservative bounding rectangle and rejects non-canonical terms. */
export function calculateBoardAreaV2(sourceDimensions: readonly BoardAreaDimensionTermV2[]): number {
  if (sourceDimensions.length === 0) throw new Error("V2 board-area calculation requires source dimensions");
  let prior: BoardAreaDimensionTermV2 | undefined;
  let xSpan = 0;
  let ySpan = 0;
  let hasX = false;
  let hasY = false;
  for (const term of sourceDimensions) {
    if (term.axis !== "x" && term.axis !== "y") throw new Error("V2 board-area term axis must be x or y");
    if (!DIMENSION_ID.test(term.dimensionId)) throw new Error("V2 board-area dimensionId is outside the closed token grammar");
    if (!Number.isSafeInteger(term.multiplier) || term.multiplier <= 0) throw new Error("V2 board-area multiplier must be a positive safe integer");
    assertQuantity(term.maximum, "m", "V2 board-area maximum");
    if (prior && compareTerm(prior, term) >= 0) throw new Error("V2 board-area terms must be unique and strictly sorted by axis and dimensionId");
    const contribution = canonicalProfileNumberV2(term.multiplier * term.maximum.value);
    if (term.axis === "x") {
      hasX = true;
      xSpan = canonicalProfileNumberV2(xSpan + contribution);
    } else {
      hasY = true;
      ySpan = canonicalProfileNumberV2(ySpan + contribution);
    }
    prior = term;
  }
  if (!hasX || !hasY) throw new Error("V2 board-area calculation requires at least one term on each axis");
  return canonicalProfileNumberV2(xSpan * ySpan);
}

export function assertBoardAreaProjectionArithmeticV2(projection: BoardAreaProjectionV2): void {
  assertQuantity(projection.area, "m2", "V2 board area");
  if (projection.calculation !== "maximum_x_span_times_maximum_y_span") throw new Error("V2 board area uses an unknown calculation");
  if (projection.basis !== "manufacturer_recommended_land_pattern_bounding_box" && projection.basis !== "reviewed_assembly_footprint_bounding_box") throw new Error("V2 board area uses an unknown basis");
  if (calculateBoardAreaV2(projection.sourceDimensions) !== projection.area.value) throw new Error("V2 board area does not equal its canonical source-dimension calculation");
}

export function assertMountedGeometryFactsV2(geometry: MountedGeometryFactsV2["mountedGeometry"]): void {
  const boardArea = geometry.boardArea;
  if (boardArea.state !== "calculated" || boardArea.value === null || boardArea.validFor.length !== 0) {
    throw new Error("V2 mounted board area must be a calculated condition-free fact");
  }
  assertBoardAreaProjectionArithmeticV2(boardArea.value);
  const expected = expectedEvidenceUnion(boardArea.value.sourceDimensions);
  const actual = boardArea.evidence.map(evidenceBytes);
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) {
    throw new Error("V2 mounted board-area evidence must equal the sorted unique dimension-evidence union");
  }

  const maximumHeight = geometry.maximumHeight;
  if (maximumHeight.state !== "reviewed" || maximumHeight.value === null || maximumHeight.validFor.length !== 0 || maximumHeight.evidence.length === 0) {
    throw new Error("V2 maximum height must be a reviewed condition-free evidence-backed fact");
  }
  if (
    maximumHeight.value.basis !== "manufacturer_package_maximum_in_surface_mount_orientation"
    && maximumHeight.value.basis !== "reviewed_assembly_envelope_maximum"
  ) {
    throw new Error("V2 maximum height uses an unknown basis");
  }
  assertQuantity(maximumHeight.value.height, "m", "V2 maximum height");
}
