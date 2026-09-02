import { migrateCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";

export interface CircuitExample { id: string; title: string; description: string; document: CircuitDocument }

/** Gallery order: the shipped bench first, then teaching circuits by rising difficulty. */
const GALLERY_ORDER = [
  "transistor-led-bench",
  "resistive-divider",
  "led-current-limit",
  "rc-filter-bode",
  "rlc-resonance",
  "halfwave-rectifier",
  "bridge-rectifier",
  "inverting-opamp",
  "opamp-noninverting",
  "common-emitter-amp",
  "mosfet-led-switch",
];

const files = import.meta.glob("../../../examples/*.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

export const EXAMPLES: readonly CircuitExample[] = Object.entries(files).map(([path, source]) => {
  const id = path.split("/").at(-1)!.replace(/\.json$/, "");
  const document = migrateCircuit(JSON.parse(source));
  return { id, title: document.meta.title, description: document.meta.description ?? "", document };
}).sort((a, b) => {
  const rank = (id: string) => {
    const index = GALLERY_ORDER.indexOf(id);
    return index < 0 ? GALLERY_ORDER.length : index;
  };
  return rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);
});

export function exampleById(id: string | null | undefined): CircuitExample | undefined {
  return id ? EXAMPLES.find((example) => example.id === id) : undefined;
}

export function exampleFromHash(hash: string): CircuitExample | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return exampleById(params.get("example"));
}

export function exampleHash(id: string): string { return `#example=${encodeURIComponent(id)}`; }
