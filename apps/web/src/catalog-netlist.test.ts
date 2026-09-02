import { generateNetlist, type CircuitDocument } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import {
  CatalogRuntimeError,
  applyCatalogModels,
  catalogVirtualConnections,
  inspectCatalogModels,
  type CatalogRuntimePart,
} from "./catalog-netlist";

const opampPart: CatalogRuntimePart = {
  id: "vendor/CAT-OP",
  manifest: {
    canonical_mpn: "CAT-OP",
    manufacturer: "Catalog Vendor",
    electrical_family: "opamp",
    model_type: "subckt",
    supported_analyses: ["operating_point", "transient", "ac_small_signal"],
    symbol_pins: [
      { number: "1", role: "noninverting_input" },
      { number: "2", role: "inverting_input" },
      { number: "3", role: "output" },
      { number: "4", role: "positive_supply" },
      { number: "5", role: "negative_supply" },
    ],
    spice_pin_mapping: [
      { symbol_pin_number: "1", subckt_node: "inp", order: 1 },
      { symbol_pin_number: "2", subckt_node: "inn", order: 2 },
      { symbol_pin_number: "4", subckt_node: "vcc", order: 3 },
      { symbol_pin_number: "5", subckt_node: "vee", order: 4 },
      { symbol_pin_number: "3", subckt_node: "out", order: 5 },
    ],
  },
  modelSource: ".subckt CAT_OP INP INN VCC VEE OUT\nEGAIN OUT 0 INP INN 100000\n.ends CAT_OP",
  modelName: "CAT_OP",
  baseType: "opamp_ideal",
  manifestValid: true,
  reviewed: true,
  placeable: true,
  detailState: "loaded",
};

function circuit(bindings: unknown, catalogPartId: unknown = opampPart.id): CircuitDocument {
  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: "Catalog supply binding test" },
    components: [
      { id: "vp", type: "vsource", value: 15, pos: [0, 4], rot: 0, mirror: false },
      { id: "vn", type: "vsource", value: -15, pos: [8, 4], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 6], rot: 0, mirror: false },
      {
        id: "u1",
        type: "opamp_ideal",
        mpn: opampPart.manifest.canonical_mpn,
        params: { catalogPartId, catalogSupplyBindings: bindings },
        pos: [20, 10],
        rot: 0,
        mirror: false,
      },
    ],
    wires: [],
    probes: [],
    sim: { mode: "op" },
  };
}

function modeled(document: CircuitDocument, parts: readonly CatalogRuntimePart[] = [opampPart]) {
  return applyCatalogModels(document, generateNetlist(document, "op"), parts);
}

describe("catalog truth and package pin mapping", () => {
  it("derives opamp SPICE order from symbol roles and preserves explicit rail bindings", () => {
    const document = circuit({ vcc: ["vp", 0], vee: ["vn", 0] });
    const generated = modeled(document);

    expect(catalogVirtualConnections(document, [opampPart])).toEqual([
      { componentId: "vp", pinIndex: 0, role: "vcc" },
      { componentId: "vn", pinIndex: 0, role: "vee" },
    ]);
    expect(generated.netlist).toContain(
      `X1 ${generated.componentNodes.u1![0]} ${generated.componentNodes.u1![1]} ${generated.componentNodes.vp![0]} ${generated.componentNodes.vn![0]} ${generated.componentNodes.u1![2]} CAT_OP $ component:u1`,
    );
    expect(generated.netlist).not.toContain("VOC1P");
    expect(generated.netlist).not.toContain("VOC1N");
  });

  it("resolves a package by MPN when no explicit catalog id is present", () => {
    const document = circuit({ vcc: ["vp", 0], vee: ["vn", 0] }, undefined);
    delete document.components.find((component) => component.id === "u1")!.params!.catalogPartId;
    expect(modeled(document).netlist).toContain("CAT_OP $ component:u1");
  });

  it.each([7, null, false, { id: opampPart.id }])("fails closed for malformed explicit catalog id %j", (catalogPartId) => {
    const document = circuit({ vcc: ["vp", 0], vee: ["vn", 0] }, catalogPartId);
    expect(catalogVirtualConnections(document, [opampPart])).toEqual([]);
    expect(() => modeled(document)).toThrowError(CatalogRuntimeError);
  });

  it("keeps a valid rail and independently supplies an invalid rail", () => {
    const document = circuit({ vcc: ["vp", 0], vee: ["missing", 0] });
    const generated = modeled(document);
    expect(catalogVirtualConnections(document, [opampPart])).toEqual([{ componentId: "vp", pinIndex: 0, role: "vcc" }]);
    expect(generated.netlist).not.toContain("VOC1P");
    expect(generated.netlist).toContain("VOC1N oc_1_vee 0 -15 $ component:u1");
  });

  it("fails closed for unresolved ids, family mismatches, and missing maps", () => {
    const missing = circuit({}, "missing/CAT-OP");
    expect(() => modeled(missing)).toThrow(/not bundled/i);

    const wrongFamily: CatalogRuntimePart = { ...opampPart, baseType: "diode", manifest: { ...opampPart.manifest, electrical_family: "diode" } };
    expect(() => modeled(circuit({}), [wrongFamily])).toThrow(/cannot drive/i);

    const { spice_pin_mapping: _mapping, ...manifestWithoutMap } = opampPart.manifest;
    const missingMap: CatalogRuntimePart = { ...opampPart, manifest: manifestWithoutMap };
    expect(() => modeled(circuit({}), [missingMap])).toThrow(/spice_pin_mapping/i);
  });

  it("maps MOS D/G/S by declared role and ties bulk to mapped source", () => {
    const document = circuit({});
    const mos = document.components.find((component) => component.id === "u1")!;
    mos.type = "nmos";
    mos.mpn = "CAT-MOS";
    mos.params = { catalogPartId: "vendor/CAT-MOS" };
    const part: CatalogRuntimePart = {
      id: "vendor/CAT-MOS",
      manifest: {
        canonical_mpn: "CAT-MOS", manufacturer: "Catalog Vendor", electrical_family: "nmos", model_type: "dot_model",
        supported_analyses: ["operating_point"],
        symbol_pins: [
          { number: "1", role: "gate" }, { number: "2", role: "drain" }, { number: "3", role: "source" },
        ],
        spice_pin_mapping: [
          { symbol_pin_number: "2", subckt_node: "drain", order: 1 },
          { symbol_pin_number: "1", subckt_node: "gate", order: 2 },
          { symbol_pin_number: "3", subckt_node: "source", order: 3 },
        ],
      },
      modelSource: ".model CAT_MOS NMOS(VTO=1)", modelName: "CAT_MOS", baseType: "nmos",
      manifestValid: true, reviewed: true, placeable: true, detailState: "loaded",
    };
    const generated = modeled(document, [part]);
    const nodes = generated.componentNodes.u1!;
    expect(generated.netlist).toContain(`M1 ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} CAT_MOS $ component:u1`);
  });

  it("maps UI modes to declared package analysis names and blocks unsupported modes", () => {
    const document = circuit({});
    expect(inspectCatalogModels(document, "op", [opampPart])).toEqual([]);
    expect(inspectCatalogModels(document, "live", [opampPart])).toEqual([]);
    expect(inspectCatalogModels(document, "dc-sweep", [opampPart])[0]).toMatchObject({
      code: "UNSUPPORTED_ANALYSIS",
      componentId: "u1",
    });
    expect(inspectCatalogModels(document, "noise", [opampPart])[0]?.message).toContain("noise");
  });

  it("requires lazy model details to be preloaded before simulation", () => {
    const { modelSource: _source, modelName: _name, ...summary } = opampPart;
    const unloaded: CatalogRuntimePart = { ...summary, detailState: "unloaded" };
    expect(inspectCatalogModels(circuit({}), "op", [unloaded])[0]).toMatchObject({ code: "DETAILS_NOT_LOADED", componentId: "u1" });
  });
});
