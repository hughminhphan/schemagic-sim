import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calculateDesignBlockContentHash,
  canonicalDesignBlockPayload,
  canonicalizeAnyCircuit,
  canonicalizeCircuitV4,
  componentPinPointsV4,
  deserializeAnyCircuit,
  generateScenarioNetlist,
  upgradeCircuitV1ToV4,
  validateCircuitV4,
  type CircuitDocumentV1,
  type CircuitDocumentV4,
  type DesignBlockDefinition,
  type TrustedSubcircuitRef,
} from "../src";
import { assertNoVerifiedAssetCollision } from "../src/v4-netlist";

function definition(
  input: Omit<DesignBlockDefinition, "contentHash">,
): DesignBlockDefinition {
  return { ...input, contentHash: calculateDesignBlockContentHash(input) };
}

function schematicDocument(): CircuitDocumentV4 {
  const block = definition({
    id: "selected-control",
    version: "1",
    title: "Selected control",
    pins: [
      { id: "in", name: "IN", offset: [-2, 0] },
      { id: "out", name: "OUT", offset: [2, 0] },
    ],
    netlist: { kind: "schematic_only", reason: "No reviewed executable model" },
  });
  return {
    format: "opencircuit-circuit",
    version: 4,
    meta: { title: "V4 fixture" },
    designBlocks: [block],
    circuits: [{
      id: "main",
      title: "Main",
      components: [
        { id: "source", type: "vsource", value: 5, pos: [0, 2], rot: 0, mirror: false },
        { id: "ground", type: "ground", pos: [0, 4], rot: 0, mirror: false },
        { id: "u1", type: "design_block", block: { id: block.id, version: block.version, contentHash: block.contentHash }, pos: [8, 0], rot: 0, mirror: false },
      ],
      wires: [],
      probes: [],
    }],
    scenarios: [{ id: "steady", title: "Steady", circuitId: "main", config: { mode: "op" } }],
    defaultCircuitId: "main",
    defaultScenarioId: "steady",
  };
}

function modelHash(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function trustedDocument(models: Array<{ blockId: string; assetId: string; entrypoint: string; text: string }>): {
  document: CircuitDocumentV4;
  assets: Map<string, string>;
} {
  const assets = new Map<string, string>();
  const blocks = models.map(({ blockId, assetId, entrypoint, text }) => {
    const contentHash = modelHash(text);
    assets.set(assetId, text);
    return definition({
      id: blockId,
      version: "1",
      title: blockId,
      pins: [{ id: "a", name: "A", offset: [-2, 0] }, { id: "b", name: "B", offset: [2, 0] }],
      netlist: { kind: "spice_subcircuit", asset: { assetId, contentHash, entrypoint }, pinOrder: ["a", "b"] },
    });
  });
  return {
    assets,
    document: {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Trusted block fixture" },
      designBlocks: blocks,
      circuits: [{
        id: "main",
        title: "Main",
        components: [
          { id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false },
          ...blocks.map((block, index) => ({
            id: `u${index + 1}`,
            type: "design_block" as const,
            block: { id: block.id, version: block.version, contentHash: block.contentHash },
            pos: [6 + index * 6, 0] as [number, number],
            rot: 0 as const,
            mirror: false,
          })),
        ],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    },
  };
}

function registry(assets: Map<string, string>) {
  return {
    resolve(ref: TrustedSubcircuitRef) {
      const canonicalText = assets.get(ref.assetId);
      return canonicalText === undefined ? undefined : { ref: { ...ref }, canonicalText };
    },
  };
}

describe("CircuitDocument v4", () => {
  it("keeps schematic-only blocks honest and byte-stable", () => {
    const document = schematicDocument();
    expect(validateCircuitV4(document)).toEqual([]);
    const first = generateScenarioNetlist(document, "steady");
    const second = generateScenarioNetlist(structuredClone(document), "steady");
    expect(second).toEqual(first);
    expect(first.netlist).toContain(`scheMAGIC Simulator scenario ${first.scenarioHash}`);
    expect(first.netlist).not.toMatch(/^X/m);
    expect(first.omissions).toEqual([expect.objectContaining({ code: "SCHEMATIC_ONLY_BLOCK_OMITTED", componentId: "u1" })]);
    expect(first.componentCurrents.u1).toBeUndefined();
    expect(first.componentPinNodes.u1).toEqual({ in: expect.any(String), out: expect.any(String) });
  });

  it("executes named configs against shared or alternate graphs", () => {
    const document = schematicDocument();
    document.circuits.push({ ...structuredClone(document.circuits[0]!), id: "alternate", title: "Alternate" });
    document.scenarios.push(
      { id: "transient", title: "Transient", circuitId: "main", config: { mode: "tran", tran: { tstop: 0.01, tstep: 0.00002, maxstep: 0.00005 } } },
      { id: "alternate-op", title: "Alternate OP", circuitId: "alternate", config: { mode: "op" } },
    );
    const op = generateScenarioNetlist(document, "steady");
    const transient = generateScenarioNetlist(document, "transient");
    const alternate = generateScenarioNetlist(document, "alternate-op");
    expect(transient.netlist).toContain(".tran 0.00002 0.01 0 0.00005");
    expect(new Set([op.scenarioHash, transient.scenarioHash, alternate.scenarioHash]).size).toBe(3);
    expect(alternate.circuitId).toBe("alternate");
  });

  it("separates saved-document identity from execution identity", () => {
    const original = schematicDocument();
    const edited = structuredClone(original);
    edited.meta.title = "Renamed";
    edited.circuits[0]!.title = "Presentation title";
    edited.circuits[0]!.components[2]!.annotations = { note: "display only" };
    edited.circuits[0]!.view = { pan: [99, 42], zoom: 3 };
    const first = generateScenarioNetlist(original, "steady");
    const second = generateScenarioNetlist(edited, "steady");
    expect(second.scenarioHash).toBe(first.scenarioHash);
    expect(second.netlist).toBe(first.netlist);
    expect(second.serializationHash).not.toBe(first.serializationHash);
    const viewOnly = structuredClone(original);
    viewOnly.circuits[0]!.view = { pan: [9, 9], zoom: 2 };
    expect(generateScenarioNetlist(viewOnly, "steady").serializationHash).toBe(first.serializationHash);
  });

  it("preserves annotation-array order and own __proto__ JSON keys without affecting execution", () => {
    const firstDocument = schematicDocument();
    const secondDocument = schematicDocument();
    firstDocument.circuits[0]!.components[2]!.annotations = JSON.parse('{"components":["b","a"],"__proto__":{"marker":"first"}}') as Record<string, never>;
    secondDocument.circuits[0]!.components[2]!.annotations = JSON.parse('{"components":["a","b"],"__proto__":{"marker":"second"}}') as Record<string, never>;
    const firstCanonical = canonicalizeCircuitV4(firstDocument);
    const secondCanonical = canonicalizeCircuitV4(secondDocument);
    expect(firstCanonical).toContain('"components":["b","a"]');
    expect(firstCanonical).toContain('"__proto__":{"marker":"first"}');
    expect(secondCanonical).toContain('"components":["a","b"]');
    expect(secondCanonical).toContain('"__proto__":{"marker":"second"}');
    expect(secondCanonical).not.toBe(firstCanonical);
    const first = generateScenarioNetlist(firstDocument, "steady");
    const second = generateScenarioNetlist(secondDocument, "steady");
    expect(second.serializationHash).not.toBe(first.serializationHash);
    expect(second.scenarioHash).toBe(first.scenarioHash);
    expect(second.netlist).toBe(first.netlist);
    expect((Object.prototype as Record<string, unknown>).marker).toBeUndefined();
  });

  it("canonicalizes set-like arrays with locale-independent ordering", () => {
    const original = schematicDocument();
    const reordered = structuredClone(original);
    reordered.circuits[0]!.components.reverse();
    reordered.designBlocks.reverse();
    reordered.scenarios.reverse();
    expect(canonicalizeCircuitV4(reordered)).toBe(canonicalizeCircuitV4(original));
    expect(generateScenarioNetlist(reordered, "steady")).toEqual(generateScenarioNetlist(original, "steady"));
  });

  it("matches standard SHA-256 and transforms arbitrary block pins", () => {
    const document = schematicDocument();
    const block = document.designBlocks[0]!;
    expect(block.contentHash).toBe(`sha256:${createHash("sha256").update(canonicalDesignBlockPayload(block), "utf8").digest("hex")}`);
    const component = structuredClone(document.circuits[0]!.components[2]!);
    if (component.type !== "design_block") throw new Error("bad fixture");
    component.rot = 90;
    component.mirror = true;
    expect(componentPinPointsV4(component, document.designBlocks)).toEqual([[8, 2], [8, -2]]);
  });

  it("does not collapse distinct component IDs to the v1 digit suffix", () => {
    const document = schematicDocument();
    document.circuits[0]!.components.splice(2, 1,
      { id: "r1", type: "resistor", value: 1000, pos: [8, 0], rot: 0, mirror: false },
      { id: "foo1", type: "resistor", value: 2000, pos: [14, 0], rot: 0, mirror: false },
    );
    document.designBlocks = [];
    const generated = generateScenarioNetlist(document, "steady");
    expect(generated.netlist).toContain("Roc_7231");
    expect(generated.netlist).toContain("Roc_666f6f31");
  });

  it("emits an exact pulsed current source with injective IDs", () => {
    const document: CircuitDocumentV4 = {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Pulse" },
      designBlocks: [],
      circuits: [{
        id: "pulse",
        title: "Pulse",
        components: [
          { id: "load.step:1", type: "isource_pulse", params: { i1: 0.3, i2: 3, delay: 0.002, rise: 0.000001, fall: 0.000001, width: 0.003, period: 0.008 }, pos: [0, 2], rot: 0, mirror: false },
          { id: "ground", type: "ground", pos: [0, 4], rot: 0, mirror: false },
        ],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "load-step", title: "Load step", circuitId: "pulse", config: { mode: "tran", tran: { tstop: 0.01, tstep: 0.00001, maxstep: 0.00002 } } }],
      defaultCircuitId: "pulse",
      defaultScenarioId: "load-step",
    };
    const generated = generateScenarioNetlist(document, "load-step");
    expect(generated.netlist).toContain("Ioc_6c6f61642e737465703a31 n1 oc_ip_6c6f61642e737465703a31 PULSE(0.3 3 0.002 0.000001 0.000001 0.003 0.008)");
    expect(generated.netlist).toContain("VOCS_IP_6c6f61642e737465703a31 oc_ip_6c6f61642e737465703a31 0 0");
    expect(generated.componentCurrents["load.step:1"]).toBe("vocs_ip_6c6f61642e737465703a31#branch");
    expect(generated.netlist).not.toContain("@ioc_6c6f61642e737465703a31[i]");
    expect(generated.netlist).toContain(".tran 0.00001 0.01 0 0.00002");
  });

  it("normalizes every numeric derivation before scenario hashing and emission", () => {
    const firstDocument = schematicDocument();
    firstDocument.designBlocks = [];
    firstDocument.circuits[0]!.components[2] = {
      id: "pot",
      type: "potentiometer",
      value: 987_654_321.123,
      params: { t: 0.7588364566382466 },
      pos: [8, 0],
      rot: 0,
      mirror: false,
    };
    const secondDocument = structuredClone(firstDocument);
    const secondPot = secondDocument.circuits[0]!.components[2]!;
    if (secondPot.type !== "potentiometer") throw new Error("bad fixture");
    secondPot.params.t = 0.7588364566383224;
    const first = generateScenarioNetlist(firstDocument, "steady");
    const second = generateScenarioNetlist(secondDocument, "steady");
    expect(second.scenarioHash).toBe(first.scenarioHash);
    expect(second.netlist).toBe(first.netlist);

    const nonFiniteLiteral = structuredClone(firstDocument);
    const nonFinitePot = nonFiniteLiteral.circuits[0]!.components[2]!;
    if (nonFinitePot.type !== "potentiometer") throw new Error("bad fixture");
    nonFinitePot.value = "1e999";
    expect(validateCircuitV4(nonFiniteLiteral)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNSAFE_SPICE_TOKEN", path: expect.stringContaining(".value") }),
    ]));
    expect(() => generateScenarioNetlist(nonFiniteLiteral, "steady")).toThrow();

    const roundedBoundary = structuredClone(firstDocument);
    const boundaryPot = roundedBoundary.circuits[0]!.components[2]!;
    if (boundaryPot.type !== "potentiometer") throw new Error("bad fixture");
    boundaryPot.params.t = 0.9999999999996;
    expect(validateCircuitV4(roundedBoundary)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_SIM_CONFIG", path: "circuits.0.components.2.params.t" }),
    ]));
    expect(() => deserializeAnyCircuit(canonicalizeCircuitV4(roundedBoundary))).toThrow(expect.objectContaining({
      issue: expect.objectContaining({ code: "INVALID_SIM_CONFIG", path: "circuits.0.components.1.params.t", componentId: "pot" }),
    }));
  });

  it("rejects unknown fields, hidden transient defaults, and invalid pulses", () => {
    const missingStep = structuredClone(schematicDocument()) as unknown as Record<string, unknown>;
    const scenario = (missingStep.scenarios as Array<Record<string, unknown>>)[0]!;
    scenario.config = { mode: "tran", tran: { tstop: 1, maxstep: 0.1 } };
    expect(validateCircuitV4(missingStep as unknown as CircuitDocumentV4)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_SIM_CONFIG" })]));
    const unknown = structuredClone(schematicDocument()) as unknown as Record<string, unknown>;
    ((unknown.circuits as Array<Record<string, unknown>>)[0]!.components as Array<Record<string, unknown>>)[0]!.rawNetlist = ".shell touch /tmp/x";
    expect(validateCircuitV4(unknown as unknown as CircuitDocumentV4)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNKNOWN_FIELD" })]));
    const invalidPot = schematicDocument();
    invalidPot.designBlocks = [];
    invalidPot.circuits[0]!.components[2] = { id: "pot", type: "potentiometer", value: 10000, params: { t: 1 }, pos: [8, 0], rot: 0, mirror: false };
    expect(validateCircuitV4(invalidPot)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_SIM_CONFIG", path: expect.stringContaining("params.t") })]));
  });

  it("round-trips explicitly union-aware serialization and permits no-scenario documents", () => {
    const document = schematicDocument();
    document.scenarios = [];
    document.defaultScenarioId = null;
    expect(validateCircuitV4(document)).toEqual([]);
    const encoded = canonicalizeAnyCircuit(document);
    expect(canonicalizeAnyCircuit(deserializeAnyCircuit(encoded))).toBe(encoded);
  });

  it("reports recursively malformed runtime objects instead of crashing", () => {
    const malformed = structuredClone(schematicDocument()) as unknown as Record<string, unknown>;
    (malformed.circuits as Array<Record<string, unknown>>)[0]!.components = { not: "an array" };
    expect(() => validateCircuitV4(malformed as unknown as CircuitDocumentV4)).not.toThrow();
    expect(validateCircuitV4(malformed as unknown as CircuitDocumentV4)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNKNOWN_FIELD" })]));
    malformed.scenarios = null;
    expect(() => validateCircuitV4(malformed as unknown as CircuitDocumentV4)).not.toThrow();
  });
});

describe("trusted design-block assets", () => {
  const cleanModel = ".subckt BUF IN OUT\nR1 IN OUT 1k\n.ends BUF\n";

  it("re-verifies, namespaces, orders pins, and deduplicates aliases by content hash", () => {
    const fixture = trustedDocument([
      { blockId: "block-a", assetId: "alias-a", entrypoint: "BUF", text: cleanModel },
      { blockId: "block-b", assetId: "alias-b", entrypoint: "BUF", text: cleanModel },
    ]);
    const generated = generateScenarioNetlist(fixture.document, "op", { registry: registry(fixture.assets) });
    const namespace = `ocblk_${modelHash(cleanModel).slice(7)}_BUF`;
    expect(generated.netlist.match(new RegExp(`\\.subckt ${namespace}`, "g"))).toHaveLength(1);
    expect(generated.netlist).toContain(`Xoc_7531 n1 n2 ${namespace}`);
    expect(generated.netlist).toContain(`Xoc_7532 n3 n4 ${namespace}`);
  });

  it("detaches the caller and snapshots frozen registry refs and getter-backed assets exactly once", () => {
    const fixture = trustedDocument([{ blockId: "block", assetId: "asset", entrypoint: "BUF", text: cleanModel }]);
    const before = structuredClone(fixture.document);
    let passedRef: TrustedSubcircuitRef | undefined;
    const mutatingRegistry = {
      resolve(request: TrustedSubcircuitRef) {
        passedRef = request;
        const values = { ...request };
        const returnedRef = Object.create(null) as TrustedSubcircuitRef;
        for (const key of ["assetId", "contentHash", "entrypoint"] as const) {
          Object.defineProperty(returnedRef, key, {
            enumerable: true,
            get() {
              const result = values[key];
              values[key] = `mutated-${key}` as never;
              return result;
            },
          });
        }
        let text = cleanModel;
        return {
          get ref() { return returnedRef; },
          get canonicalText() {
            const result = text;
            text = ".subckt BUF IN OUT\n.shell injected\n.ends BUF\n";
            return result;
          },
        };
      },
    };
    const first = generateScenarioNetlist(fixture.document, "op", { registry: mutatingRegistry });
    const second = generateScenarioNetlist(fixture.document, "op", { registry: mutatingRegistry });
    expect(second).toEqual(first);
    expect(first.netlist).not.toContain(".shell");
    expect(first.netlist).not.toContain("mutated-");
    expect(passedRef).toBeDefined();
    expect(Object.isFrozen(passedRef)).toBe(true);
    expect(passedRef).not.toBe((fixture.document.designBlocks[0]!.netlist as { asset: TrustedSubcircuitRef }).asset);
    expect(fixture.document).toEqual(before);
  });

  it("wraps registry attempts to mutate the frozen request or throw as typed resolution failures", () => {
    const fixture = trustedDocument([{ blockId: "block", assetId: "asset", entrypoint: "BUF", text: cleanModel }]);
    const before = structuredClone(fixture.document);
    expect(() => generateScenarioNetlist(fixture.document, "op", {
      registry: {
        resolve(request) {
          (request as { assetId: string }).assetId = "mutated";
          return undefined;
        },
      },
    })).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "TRUSTED_MODEL_RESOLUTION_FAILED" }) }));
    expect(fixture.document).toEqual(before);
    expect(() => generateScenarioNetlist(fixture.document, "op", {
      registry: { resolve() { throw new Error("untrusted resolver detail\n.shell injected"); } },
    })).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "TRUSTED_MODEL_RESOLUTION_FAILED" }) }));
  });

  it("fails closed on ref mismatches, noncanonical bytes, unsafe cards, lib sections, and hash mutation", () => {
    const fixture = trustedDocument([{ blockId: "block", assetId: "asset", entrypoint: "BUF", text: cleanModel }]);
    const requested = fixture.document.designBlocks[0]!.netlist;
    if (requested.kind !== "spice_subcircuit") throw new Error("bad fixture");
    const expectCode = (canonicalText: string, ref: TrustedSubcircuitRef, code: string): void => {
      expect(() => generateScenarioNetlist(fixture.document, "op", { registry: { resolve: () => ({ ref, canonicalText }) } })).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code }) }));
    };
    expectCode(cleanModel, { ...requested.asset, assetId: "wrong" }, "TRUSTED_MODEL_REF_MISMATCH");
    expectCode(cleanModel.replaceAll("\n", "\r\n"), requested.asset, "TRUSTED_MODEL_NOT_CANONICAL");
    expectCode(".subckt BUF IN OUT\n.shell touch /tmp/x\n.ends BUF\n", requested.asset, "TRUSTED_MODEL_UNSAFE");
    expectCode(".lib TYP\n.subckt BUF IN OUT\nR1 IN OUT 1k\n.ends BUF\n.endl\n", requested.asset, "TRUSTED_MODEL_UNSAFE");
    expectCode(cleanModel.replace("1k", "2k"), requested.asset, "TRUSTED_MODEL_HASH_MISMATCH");
  });

  it("rejects missing assets and generator-derived entrypoint or pin mismatches", () => {
    const missing = trustedDocument([{ blockId: "block", assetId: "asset", entrypoint: "BUF", text: cleanModel }]);
    expect(() => generateScenarioNetlist(missing.document, "op")).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "TRUSTED_MODEL_NOT_FOUND" }) }));
    const wrongEntrypointText = ".subckt OTHER IN OUT\nR1 IN OUT 1k\n.ends OTHER\n";
    const wrongEntrypoint = trustedDocument([{ blockId: "block", assetId: "asset", entrypoint: "BUF", text: wrongEntrypointText }]);
    expect(() => generateScenarioNetlist(wrongEntrypoint.document, "op", { registry: registry(wrongEntrypoint.assets) })).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "TRUSTED_MODEL_ENTRYPOINT_INVALID" }) }));
    const threePins = ".subckt BUF A B C\nR1 A B 1k\n.ends BUF\n";
    const wrongPins = trustedDocument([{ blockId: "block", assetId: "asset", entrypoint: "BUF", text: threePins }]);
    expect(() => generateScenarioNetlist(wrongPins.document, "op", { registry: registry(wrongPins.assets) })).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "TRUSTED_MODEL_PIN_MISMATCH" }) }));
  });

  it("rechecks pin counts when distinct block definitions share one exact asset ref", () => {
    const fixture = trustedDocument([{ blockId: "two-pin", assetId: "asset", entrypoint: "BUF", text: cleanModel }]);
    const firstBlock = fixture.document.designBlocks[0]!;
    if (firstBlock.netlist.kind !== "spice_subcircuit") throw new Error("bad fixture");
    const threePinBlock = definition({
      id: "three-pin",
      version: "1",
      title: "Three pin alias",
      pins: [
        { id: "a", name: "A", offset: [-2, 0] },
        { id: "b", name: "B", offset: [2, 0] },
        { id: "c", name: "C", offset: [0, 2] },
      ],
      netlist: {
        kind: "spice_subcircuit",
        asset: { ...firstBlock.netlist.asset },
        pinOrder: ["a", "b", "c"],
      },
    });
    fixture.document.designBlocks.push(threePinBlock);
    fixture.document.circuits[0]!.components.push({
      id: "u2",
      type: "design_block",
      block: { id: threePinBlock.id, version: threePinBlock.version, contentHash: threePinBlock.contentHash },
      pos: [12, 0],
      rot: 0,
      mirror: false,
    });
    expect(validateCircuitV4(fixture.document)).toEqual([]);
    expect(() => generateScenarioNetlist(fixture.document, "op", { registry: registry(fixture.assets) })).toThrow(expect.objectContaining({
      issue: expect.objectContaining({
        code: "TRUSTED_MODEL_PIN_MISMATCH",
        componentId: "u2",
        blockId: "three-pin",
      }),
    }));
  });

  it("detects verified-hash collisions before emission", () => {
    expect(() => assertNoVerifiedAssetCollision(
      { canonicalText: cleanModel, derivedEntrypoint: "BUF" },
      { canonicalText: cleanModel.replace("1k", "2k"), derivedEntrypoint: "BUF" },
    )).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "TRUSTED_MODEL_HASH_COLLISION" }) }));
  });

  it("enforces the aggregate 1 MiB generated-netlist limit", () => {
    const large = (name: string, marker: string): string => {
      const rows = Array.from({ length: 40_000 }, (_, index) => `R${marker}${index} A B 1k`).join("\n");
      return `.subckt ${name} A B\n${rows}\n.ends ${name}\n`;
    };
    const fixture = trustedDocument([
      { blockId: "large-a", assetId: "large-a", entrypoint: "BIGA", text: large("BIGA", "A") },
      { blockId: "large-b", assetId: "large-b", entrypoint: "BIGB", text: large("BIGB", "B") },
    ]);
    expect(() => generateScenarioNetlist(fixture.document, "op", { registry: registry(fixture.assets) })).toThrow(expect.objectContaining({ issue: expect.objectContaining({ code: "EXECUTION_LIMIT" }) }));
  }, 20_000);
});

describe("v1 compatibility and explicit upgrade", () => {
  const v1: CircuitDocumentV1 = {
    format: "opencircuit-circuit",
    version: 1,
    meta: { title: "Legacy" },
    components: [
      { id: "v1", type: "vsource_pulse", value: 12, params: { appNote: "display", v1: 0 }, pos: [0, 2], rot: 0, mirror: false },
      { id: "p1", type: "potentiometer", params: { t: "2" }, pos: [8, 6], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
    ],
    wires: [],
    probes: [],
    sim: { mode: "tran", tran: { tstop: 0.01 } },
  };

  it("expands every transient/component default and clamps only during upgrade", () => {
    const upgraded = upgradeCircuitV1ToV4(v1);
    expect(upgraded.scenarios[0]!.config).toEqual({ mode: "tran", tran: { tstop: 0.01, tstep: 0.00002, maxstep: 0.00005 } });
    expect(upgraded.circuits[0]!.components[0]).toEqual(expect.objectContaining({
      type: "vsource_pulse",
      annotations: { appNote: "display" },
      params: { v1: 0, v2: 12, delay: 0.001, rise: 0.00001, fall: 0.00001, width: 0.004, period: 0.01 },
    }));
    expect(upgraded.circuits[0]!.components[1]).toEqual(expect.objectContaining({ type: "potentiometer", value: 10000, params: { t: 0.995 } }));
  });

  it("converts Simulator pulsed-current engineering literals to the finite V4 contract", () => {
    const pulse = structuredClone(v1);
    pulse.components = [
      {
        id: "load.step:1",
        type: "isource_pulse",
        params: { i1: "300m", i2: 3, delay: "2m", rise: "1u", fall: "1u", width: "3m", period: "8m", note: "retained" },
        pos: [0, 2], rot: 0, mirror: false,
      },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
    ];
    pulse.sim = { mode: "tran", tran: { tstop: 0.01, tstep: 0.00001, maxstep: 0.00002 } };
    const upgraded = upgradeCircuitV1ToV4(pulse);
    expect(upgraded.circuits[0]!.components[0]).toEqual(expect.objectContaining({
      type: "isource_pulse",
      annotations: { note: "retained" },
      params: { i1: 0.3, i2: 3, delay: 0.002, rise: 0.000001, fall: 0.000001, width: 0.003, period: 0.008 },
    }));
    expect(generateScenarioNetlist(upgraded, "default").netlist)
      .toContain("PULSE(0.3 3 0.002 0.000001 0.000001 0.003 0.008)");

    const badTiming = structuredClone(pulse);
    badTiming.components[0]!.params!.period = "3m";
    expect(() => upgradeCircuitV1ToV4(badTiming)).toThrow();
    const wrongMode = structuredClone(pulse);
    wrongMode.sim = { mode: "op" };
    expect(() => upgradeCircuitV1ToV4(wrongMode)).toThrow();
    const injected = structuredClone(pulse);
    injected.components[0]!.params!.i2 = "3m\n.end";
    expect(() => upgradeCircuitV1ToV4(injected)).toThrow(/unsafe recognized SPICE value/i);
  });

  it("rejects invalid legacy potentiometer strings and recognized SPICE injection", () => {
    const badPot = structuredClone(v1);
    badPot.components[1]!.params!.t = "1k";
    expect(() => upgradeCircuitV1ToV4(badPot)).toThrow();
    const injected = structuredClone(v1);
    injected.components[0]!.params!.v1 = "0\n.shell touch /tmp/x";
    expect(() => upgradeCircuitV1ToV4(injected)).toThrow(/unsafe recognized SPICE value/i);
    const nonFiniteLiteral = structuredClone(v1);
    nonFiniteLiteral.components[0]!.params!.v1 = "1e999";
    expect(() => upgradeCircuitV1ToV4(nonFiniteLiteral)).toThrow(/unsafe recognized SPICE value/i);
  });

  it("rejects legacy component IDs that could escape generated line comments", () => {
    const injected = structuredClone(v1);
    injected.components[0]!.id = "source\n.end";
    expect(() => upgradeCircuitV1ToV4(injected)).toThrow();
    expect(generateScenarioNetlist(upgradeCircuitV1ToV4(v1), "default").netlist).toContain("$ component:v1");
    const safePunctuation = structuredClone(v1);
    safePunctuation.components[0]!.id = "source.safe:1";
    const first = generateScenarioNetlist(upgradeCircuitV1ToV4(safePunctuation), "default").netlist;
    expect(first).toContain("$ component:source.safe:1");
    expect(generateScenarioNetlist(upgradeCircuitV1ToV4(structuredClone(safePunctuation)), "default").netlist).toBe(first);
  });

  it("preserves own __proto__ annotation keys during legacy upgrade without prototype pollution", () => {
    const withOwnProto = structuredClone(v1);
    withOwnProto.components[0]!.params = JSON.parse('{"v1":0,"__proto__":{"marker":"preserved"}}') as Record<string, never>;
    const upgraded = upgradeCircuitV1ToV4(withOwnProto);
    const component = upgraded.circuits[0]!.components[0]!;
    expect(Object.prototype.hasOwnProperty.call(component.annotations, "__proto__")).toBe(true);
    expect(component.annotations?.["__proto__"]).toEqual({ marker: "preserved" });
    expect(canonicalizeCircuitV4(upgraded)).toContain('"__proto__":{"marker":"preserved"}');
    expect((Object.prototype as Record<string, unknown>).marker).toBeUndefined();
  });
});
