import { generateNetlist, type AnalysisMode, type CircuitComponent, type CircuitDocument, type GeneratedNetlist, type NetlistLine } from "@opencircuit/circuit-schema";

export interface CatalogModelManifest {
  canonical_mpn: string;
  manufacturer: string;
  electrical_family: string;
  model_type: "dot_model" | "subckt" | string;
  spice_pin_mapping?: Array<{ symbol_pin_number: string; subckt_node: string; order: number }>;
}

export interface CatalogRuntimePart {
  id: string;
  manifest: CatalogModelManifest;
  modelSource: string;
  modelName: string;
}

function safeSuffix(id: string): string {
  return id.replace(/\D/g, "") || id.replace(/[^a-z0-9]/gi, "");
}

function bindingNode(
  component: CircuitComponent,
  role: "vcc" | "vee",
  generated: GeneratedNetlist,
): string | undefined {
  const bindings = component.params?.catalogSupplyBindings as Record<string, [string, number]> | undefined;
  const binding = bindings?.[role];
  return binding ? generated.componentNodes[binding[0]]?.[binding[1]] : undefined;
}

function catalogLine(
  component: CircuitComponent,
  part: CatalogRuntimePart,
  generated: GeneratedNetlist,
): { line: string; supportLines: string[] } | undefined {
  const nodes = generated.componentNodes[component.id] ?? [];
  const suffix = safeSuffix(component.id);
  const name = part.modelName;
  switch (component.type) {
    case "diode":
    case "led":
      return { line: `D${suffix} ${nodes[0]} ${nodes[1]} ${name} $ component:${component.id}`, supportLines: [] };
    case "bjt_npn":
    case "bjt_pnp":
      return { line: `Q${suffix} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${name} $ component:${component.id}`, supportLines: [] };
    case "nmos":
    case "pmos":
      return { line: `M${suffix} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} ${name} $ component:${component.id}`, supportLines: [] };
    case "opamp_ideal": {
      const vcc = bindingNode(component, "vcc", generated) ?? `oc_${suffix}_vcc`;
      const vee = bindingNode(component, "vee", generated) ?? `oc_${suffix}_vee`;
      const supportLines: string[] = [];
      if (!bindingNode(component, "vcc", generated)) supportLines.push(`VOC${suffix}P ${vcc} 0 15 $ component:${component.id}`);
      if (!bindingNode(component, "vee", generated)) supportLines.push(`VOC${suffix}N ${vee} 0 -15 $ component:${component.id}`);
      return { line: `X${suffix} ${nodes[0]} ${nodes[1]} ${vcc} ${vee} ${nodes[2]} ${name} $ component:${component.id}`, supportLines };
    }
    default:
      return undefined;
  }
}

export function applyCatalogModels(
  document: CircuitDocument,
  generatedInput: GeneratedNetlist,
  parts: readonly CatalogRuntimePart[],
): GeneratedNetlist {
  const generated = generatedInput.netlist.includes("\n.ac ")
    ? { ...generatedInput, netlist: generatedInput.netlist.replace(/^\.save all.*$/m, ".save all") }
    : generatedInput;
  const byId = new Map(parts.map((part) => [part.id, part]));
  const byMpn = new Map(parts.map((part) => [part.manifest.canonical_mpn, part]));
  const components = new Map(document.components.map((component) => [component.id, component]));
  const lines = generated.netlist.trimEnd().split("\n");
  const used = new Map<string, CatalogRuntimePart>();
  const supportLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const componentId = lines[index]?.match(/\$ component:([^\s]+)/)?.[1];
    const component = componentId ? components.get(componentId) : undefined;
    const catalogId = component?.params?.catalogPartId;
    const part = typeof catalogId === "string" ? byId.get(catalogId) : byMpn.get(component?.mpn ?? "");
    const replacement = component && part ? catalogLine(component, part, generated) : undefined;
    if (!replacement || !part) continue;
    lines[index] = replacement.line;
    supportLines.push(...replacement.supportLines);
    used.set(part.id, part);
  }

  if (used.size === 0) return generated;
  const libraryLines = [...used.values()].sort((a, b) => a.id.localeCompare(b.id)).flatMap((part) => [
    `* catalog model: ${part.manifest.manufacturer} ${part.manifest.canonical_mpn}`,
    ...part.modelSource.trimEnd().split("\n"),
  ]);
  const inserted = [...libraryLines, ...supportLines];
  lines.splice(2, 0, ...inserted);
  const insertedMap: NetlistLine[] = inserted.map((_, index) => ({ line: index + 3, stage: "model" }));
  const lineMap = [...generated.lineMap.slice(0, 2), ...insertedMap, ...generated.lineMap.slice(2)]
    .map((entry, index) => ({ ...entry, line: index + 1 }));
  return { ...generated, netlist: `${lines.join("\n")}\n`, lineMap };
}

export function generateNetlistWithCatalog(
  document: CircuitDocument,
  mode: AnalysisMode | undefined,
  parts: readonly CatalogRuntimePart[],
): GeneratedNetlist {
  return applyCatalogModels(document, generateNetlist(document, mode), parts);
}
