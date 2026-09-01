import m1Compact from "../artifacts/m1-compact.json" with { type: "json" };
import m2Power from "../artifacts/m2-power.json" with { type: "json" };
import manifest from "../artifacts/manifest.json" with { type: "json" };
import p1Compact from "../artifacts/p1-compact.json" with { type: "json" };
import p2HighVoltage from "../artifacts/p2-high-voltage.json" with { type: "json" };
import { DESIGNER_EXAMPLE_IDS, type DesignerExampleDocument, type DesignerExampleGalleryManifest, type DesignerExampleId } from "./types";

export type * from "./types";
export { DESIGNER_EXAMPLE_IDS } from "./types";

function freezeDeep<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

const documents = {
  "m1-compact": m1Compact,
  "m2-power": m2Power,
  "p1-compact": p1Compact,
  "p2-high-voltage": p2HighVoltage,
} as unknown as Record<DesignerExampleId, DesignerExampleDocument>;

export const DESIGNER_EXAMPLE_GALLERY_MANIFEST = freezeDeep(
  manifest as unknown as DesignerExampleGalleryManifest,
);

export const DESIGNER_EXAMPLE_GALLERY = freezeDeep(
  DESIGNER_EXAMPLE_IDS.map((id) => documents[id]),
);

export function getDesignerExample(id: DesignerExampleId): Readonly<DesignerExampleDocument> {
  return documents[id];
}
