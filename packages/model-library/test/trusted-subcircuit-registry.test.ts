import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { build } from "vite";
import {
  calculateDesignBlockContentHash,
  DESIGN_BLOCK_MODEL_VERIFICATION,
  generateScenarioNetlist,
  type CircuitDocumentV4,
  type DesignBlockDefinition,
  type TrustedSubcircuitRef,
} from "@opencircuit/circuit-schema";
import { emitNamespacedLibrary, parseSpiceLibrary } from "@opencircuit/model-import";
import {
  TRUSTED_SUBCIRCUIT_PACKAGE_IDS,
  trustedSubcircuitDescriptor,
  trustedSubcircuitRegistry,
} from "../src";
import {
  TRUSTED_SUBCIRCUIT_PACKAGE_ALLOWLIST,
  generateTrustedSubcircuitSource,
  isCompletedActorIdentity,
} from "../scripts/generate-trusted-subcircuits";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const modelsRoot = join(packageRoot, "models");
const generatedPath = join(packageRoot, "src/generated/trusted-subcircuits.ts");

function inventory(): Array<{ packageId: string; modelType: string }> {
  return readdirSync(modelsRoot, { withFileTypes: true })
    .flatMap((manufacturer) => readdirSync(join(modelsRoot, manufacturer.name), { withFileTypes: true }).map((componentPackage) => {
      const packageId = `${manufacturer.name}/${componentPackage.name}`;
      const component = JSON.parse(readFileSync(join(modelsRoot, manufacturer.name, componentPackage.name, "component.json"), "utf8")) as { model_type: string };
      return { packageId, modelType: component.model_type };
    }))
    .sort((left, right) => left.packageId < right.packageId ? -1 : left.packageId > right.packageId ? 1 : 0);
}

function validationResults(packageId: string): {
  native_wasm_all_pass: boolean;
  expectations_all_pass: boolean;
  expectation_fail_count: number;
  benches: Array<{ native_wasm_pass: boolean | null }>;
} {
  return JSON.parse(readFileSync(join(modelsRoot, ...packageId.split("/"), "validation-results.json"), "utf8"));
}

function executableDocument(packageId: string): CircuitDocumentV4 {
  const descriptor = trustedSubcircuitDescriptor(packageId);
  if (descriptor === undefined) throw new Error(`missing descriptor ${packageId}`);
  const pins = descriptor.symbolPinOrder.map((symbolPin, index) => ({
    id: `p${index + 1}`,
    name: symbolPin,
    offset: [index, 0] as [number, number],
  }));
  const blockPayload: Omit<DesignBlockDefinition, "contentHash"> = {
    id: `model:${packageId.replace("/", ":")}`,
    version: "1",
    title: packageId,
    pins,
    netlist: {
      kind: "spice_subcircuit",
      asset: { ...descriptor.ref },
      pinOrder: pins.map((pin) => pin.id),
    },
  };
  const block = { ...blockPayload, contentHash: calculateDesignBlockContentHash(blockPayload) };
  return {
    format: "opencircuit-circuit",
    version: 4,
    meta: { title: packageId },
    designBlocks: [block],
    circuits: [{
      id: "main",
      title: "Main",
      components: [
        { id: "ground", type: "ground", pos: [-4, 0], rot: 0, mirror: false },
        { id: "u1", type: "design_block", block: { id: block.id, version: block.version, contentHash: block.contentHash }, pos: [0, 0], rot: 0, mirror: false },
      ],
      wires: [],
      probes: [],
    }],
    scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
    defaultCircuitId: "main",
    defaultScenarioId: "op",
  };
}

describe("production trusted subcircuit registry", () => {
  it("rejects every explicit pending actor spelling before trusted admission", () => {
    expect(isCompletedActorIdentity(undefined)).toBe(false);
    expect(isCompletedActorIdentity("")).toBe(false);
    expect(isCompletedActorIdentity("pending")).toBe(false);
    expect(isCompletedActorIdentity("pending-review")).toBe(false);
    expect(isCompletedActorIdentity(" Pending-Independent-Package-Review ")).toBe(false);
    expect(isCompletedActorIdentity("codex independent package reviewer")).toBe(true);
  });

  it("is an exact code-owned 50-package admission list, never automatic discovery", () => {
    const packages = inventory();
    const admitted = [...TRUSTED_SUBCIRCUIT_PACKAGE_ALLOWLIST];
    expect(packages).toHaveLength(771);
    expect(packages.filter((entry) => entry.modelType === "dot_model")).toHaveLength(714);
    expect(packages.filter((entry) => entry.modelType === "subckt")).toHaveLength(57);
    expect(TRUSTED_SUBCIRCUIT_PACKAGE_IDS).toEqual(admitted);
    expect(admitted).toHaveLength(50);

    const unsupported = packages.filter((entry) => !admitted.includes(entry.packageId as never));
    expect(unsupported).toHaveLength(721);
    expect(unsupported.every((entry) => trustedSubcircuitDescriptor(entry.packageId) === undefined)).toBe(true);
    expect(unsupported.filter((entry) => entry.modelType === "subckt").map((entry) => entry.packageId)).toEqual([
      "nexperia/74HC123",
      "nexperia/74HC138",
      "nexperia/74HC164",
      "nexperia/74HC165",
      "nexperia/74HC4017",
      "nexperia/74HC595",
      "nexperia/74HC74",
    ]);
  });

  it("keeps the committed registry byte-identical to validated source packages", () => {
    expect(readFileSync(generatedPath, "utf8")).toBe(generateTrustedSubcircuitSource());
  }, 60_000);

  it("requires stored expectation and native/WASM evidence to be all-pass", () => {
    for (const packageId of TRUSTED_SUBCIRCUIT_PACKAGE_IDS) {
      const validation = validationResults(packageId);
      expect(validation.native_wasm_all_pass, packageId).toBe(true);
      expect(validation.expectations_all_pass, packageId).toBe(true);
      expect(validation.expectation_fail_count, packageId).toBe(0);
      expect(validation.benches.some((bench) => bench.native_wasm_pass === false), packageId).toBe(false);
    }
    for (const packageId of ["ti/LM311", "ti/LM393", "ti/TLV3702"]) {
      expect(validationResults(packageId).native_wasm_all_pass, packageId).toBe(true);
      expect(trustedSubcircuitDescriptor(packageId), packageId).toBeDefined();
    }
  });

  it("satisfies the real Circuit V2 verifier for every admitted asset", () => {
    let canonicalBytes = 0;
    let emittedBytes = 0;
    let maximumCanonicalBytes = 0;
    let maximumEmittedBytes = 0;
    const hashes = new Set<string>();
    for (const packageId of TRUSTED_SUBCIRCUIT_PACKAGE_IDS) {
      const descriptor = trustedSubcircuitDescriptor(packageId)!;
      const asset = trustedSubcircuitRegistry.resolve(descriptor.ref)!;
      const canonicalByteLength = new TextEncoder().encode(asset.canonicalText).byteLength;
      canonicalBytes += canonicalByteLength;
      maximumCanonicalBytes = Math.max(maximumCanonicalBytes, canonicalByteLength);
      expect(canonicalByteLength).toBeLessThanOrEqual(DESIGN_BLOCK_MODEL_VERIFICATION.maxInputBytes);
      hashes.add(asset.ref.contentHash);
      expect(`sha256:${createHash("sha256").update(asset.canonicalText, "utf8").digest("hex")}`).toBe(asset.ref.contentHash);
      const parsed = parseSpiceLibrary(asset.canonicalText, {
        filename: "trusted-model.lib",
        maxInputBytes: DESIGN_BLOCK_MODEL_VERIFICATION.maxInputBytes,
        maxIncludeDepth: DESIGN_BLOCK_MODEL_VERIFICATION.maxIncludeDepth,
        maxSubcktDepth: DESIGN_BLOCK_MODEL_VERIFICATION.maxSubcktDepth,
      });
      const emitted = emitNamespacedLibrary(parsed, `ocblk_${descriptor.ref.contentHash.slice("sha256:".length)}`);
      const emittedByteLength = new TextEncoder().encode(emitted.text).byteLength;
      emittedBytes += emittedByteLength;
      maximumEmittedBytes = Math.max(maximumEmittedBytes, emittedByteLength);
      expect(emittedByteLength).toBeLessThanOrEqual(1_048_576);
      const generated = generateScenarioNetlist(executableDocument(packageId), "op", { registry: trustedSubcircuitRegistry });
      expect(generated.omissions).toEqual([]);
      expect(generated.netlist).toContain(`ocblk_${descriptor.ref.contentHash.slice("sha256:".length)}`);
    }
    expect(canonicalBytes).toBe(36_780);
    expect(maximumCanonicalBytes).toBe(1_631);
    expect(emittedBytes).toBe(46_345);
    expect(maximumEmittedBytes).toBe(2_198);
    expect(emittedBytes).toBeLessThanOrEqual(1_048_576);
    expect(hashes.size).toBe(50);

    const documents = TRUSTED_SUBCIRCUIT_PACKAGE_IDS.map(executableDocument);
    const aggregate: CircuitDocumentV4 = {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "All trusted subcircuits" },
      designBlocks: documents.flatMap((document) => document.designBlocks),
      circuits: [{
        id: "main",
        title: "Main",
        components: [
          { id: "ground", type: "ground", pos: [-4, 0], rot: 0, mirror: false },
          ...documents.map((document, index) => ({
            id: `u${index + 1}`,
            type: "design_block" as const,
            block: {
              id: document.designBlocks[0]!.id,
              version: document.designBlocks[0]!.version,
              contentHash: document.designBlocks[0]!.contentHash,
            },
            pos: [index * 20, 0] as [number, number],
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
    };
    const aggregateNetlist = generateScenarioNetlist(aggregate, "op", { registry: trustedSubcircuitRegistry });
    expect(new TextEncoder().encode(aggregateNetlist.netlist).byteLength).toBeLessThanOrEqual(1_048_576);
    expect(aggregateNetlist.omissions).toEqual([]);
  });

  it("resolves only an exact ref triple and exposes immutable snapshots", () => {
    const descriptor = trustedSubcircuitDescriptor("ti/LM358")!;
    const exact = trustedSubcircuitRegistry.resolve(descriptor.ref)!;
    expect(Object.isFrozen(TRUSTED_SUBCIRCUIT_PACKAGE_IDS)).toBe(true);
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.ref)).toBe(true);
    expect(Object.isFrozen(descriptor.symbolPinOrder)).toBe(true);
    expect(Object.isFrozen(exact)).toBe(true);
    expect(Object.isFrozen(exact.ref)).toBe(true);
    expect(trustedSubcircuitRegistry.resolve({ ...descriptor.ref, assetId: `${descriptor.ref.assetId}:other` })).toBeUndefined();
    expect(trustedSubcircuitRegistry.resolve({ ...descriptor.ref, contentHash: `sha256:${"0".repeat(64)}` })).toBeUndefined();
    expect(trustedSubcircuitRegistry.resolve({ ...descriptor.ref, entrypoint: `${descriptor.ref.entrypoint}_OTHER` })).toBeUndefined();
  });

  it("snapshots hostile ref getters once and fails closed when access throws", () => {
    const descriptor = trustedSubcircuitDescriptor("ti/LM358")!;
    const reads = { assetId: 0, contentHash: 0, entrypoint: 0 };
    const request = Object.create(null) as TrustedSubcircuitRef;
    for (const key of Object.keys(reads) as Array<keyof typeof reads>) {
      Object.defineProperty(request, key, {
        enumerable: true,
        get() {
          reads[key] += 1;
          return descriptor.ref[key];
        },
      });
    }
    expect(trustedSubcircuitRegistry.resolve(request)?.ref).toBe(descriptor.ref);
    expect(reads).toEqual({ assetId: 1, contentHash: 1, entrypoint: 1 });
    const throwing = Object.create(null) as TrustedSubcircuitRef;
    Object.defineProperty(throwing, "assetId", { get() { throw new Error("hostile getter"); } });
    expect(trustedSubcircuitRegistry.resolve(throwing)).toBeUndefined();
  });

  it("keeps the browser runtime static and free of Node, filesystem, or network access", () => {
    const runtime = [
      "src/index.ts",
      "src/trusted-subcircuit-registry.ts",
      "src/generated/trusted-subcircuits.ts",
    ].map((relativePath) => readFileSync(join(packageRoot, relativePath), "utf8")).join("\n");
    expect(runtime).not.toMatch(/from\s+["']node:/);
    expect(runtime).not.toMatch(/\b(?:readFile|writeFile|readdir|fetch|XMLHttpRequest|WebSocket)\s*\(/);
    expect(runtime).not.toMatch(/@opencircuit\/model-import/);
    expect(runtime).not.toMatch(/import\s+(?!type\b)[\s\S]{0,120}@opencircuit\/circuit-schema/);
  });

  it("bundles through a real browser consumer without Node polyfills", async () => {
    const result = await build({
      configFile: false,
      root: resolve(packageRoot, "../.."),
      logLevel: "silent",
      build: {
        write: false,
        target: "es2022",
        lib: { entry: join(packageRoot, "test/browser-consumer.fixture.ts"), formats: ["es"] },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => "output" in entry ? entry.output : []);
    const code = outputs.map((output) => output.type === "chunk" ? output.code : "").join("\n");
    expect(code.length).toBeGreaterThan(36_780);
    expect(code).not.toMatch(/(?:node:fs|node:path|node:crypto|readFileSync|XMLHttpRequest|WebSocket)/);
  });
});
