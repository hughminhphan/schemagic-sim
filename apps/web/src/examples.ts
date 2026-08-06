import { migrateCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";

export interface CircuitExample { id: string; title: string; description: string; document: CircuitDocument }

const files = import.meta.glob("../../../examples/*.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

export const EXAMPLES: readonly CircuitExample[] = Object.entries(files).map(([path, source]) => {
  const id = path.split("/").at(-1)!.replace(/\.json$/, "");
  const document = migrateCircuit(JSON.parse(source));
  return { id, title: document.meta.title, description: document.meta.description ?? "", document };
}).sort((a, b) => {
  const order = ["transistor-led-bench", "rc-filter-bode", "common-emitter-amp", "mosfet-led-switch", "opamp-noninverting"];
  return order.indexOf(a.id) - order.indexOf(b.id);
});

export function exampleById(id: string | null | undefined): CircuitExample | undefined {
  return id ? EXAMPLES.find((example) => example.id === id) : undefined;
}

export function exampleFromHash(hash: string): CircuitExample | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return exampleById(params.get("example"));
}

export function exampleHash(id: string): string { return `#example=${encodeURIComponent(id)}`; }
