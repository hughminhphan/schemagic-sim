import { readFileSync } from "node:fs";
import { validateCircuit } from "@opencircuit/circuit-schema";
import type {
  BuckDesignRequest,
  DesignCandidate,
  DesignResult,
  LegacyDesignGenerationArtifactV1,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  CandidateSpiceExportError,
  exportCandidateBomCsv,
  exportCandidateSpiceNetlist,
  serializeDesignResult,
  serializeDesignResultV1,
} from "../src/index";

const request: BuckDesignRequest = {
  format: "schemagic-design-request",
  schemaVersion: 1,
  application: "power.buck",
  requirements: {
    inputVoltage: {
      minimum: { value: 9, unit: "V", displayUnit: "V" },
      nominal: { value: 12, unit: "V", displayUnit: "V" },
      maximum: { value: 16, unit: "V", displayUnit: "V" },
    },
    outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
    maximumOutputCurrent: { value: 3, unit: "A", displayUnit: "A" },
    ambientTemperature: { value: 313.15, unit: "K", displayUnit: "°C" },
    switchingFrequency: {
      selection: "automatic",
      minimum: { value: 300_000, unit: "Hz", displayUnit: "kHz" },
      preferred: null,
      maximum: { value: 1_500_000, unit: "Hz", displayUnit: "MHz" },
    },
    maximumOutputRipple: { value: 0.03, unit: "V", displayUnit: "mV" },
    loadTransientTarget: null,
  },
  objective: "area",
  constraints: {
    allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
    maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
    allowedPackages: [],
    maximumComponentHeight: null,
    maximumBoardArea: null,
    allowEstimatedValues: true,
    allowUnknownWarnings: true,
    allowUnknownHardConstraints: false,
  },
  assumptions: [],
  libraryVersion: "designer-v1-reference.1",
};

const candidate: DesignCandidate = {
  schemaVersion: 1,
  id: "candidate:csv",
  requestHash: "sha256:request",
  recipeId: "power.synthetic",
  libraryVersion: request.libraryVersion,
  components: [
    {
      id: "z-capacitor",
      role: "output capacitor",
      profileId: "profile:cap",
      part: { manufacturerId: "synthetic", manufacturerPartNumber: "CAP,10\"" },
      quantityPerAssembly: 2,
      value: { value: 0.000_01, unit: "F", displayUnit: "µF" },
      evidence: [
        { sourceId: "source:z", locator: "table 1", licenseNote: "synthetic" },
        { sourceId: "source:a", locator: "table 2", licenseNote: "synthetic" },
      ],
    },
    {
      id: "a-controller",
      role: "controller",
      profileId: "profile:controller",
      part: { manufacturerId: "synthetic", manufacturerPartNumber: "CTRL-A" },
      quantityPerAssembly: 1,
      evidence: [],
    },
  ],
  derivedValues: [],
  constraints: [],
  metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
  sourcing: {
    schemaVersion: 1,
    status: "partial",
    requestedBuildQuantity: 10,
    evaluatedAt: "2026-08-23T00:00:00.000Z",
    snapshotIds: ["snapshot:synthetic"],
    lines: [
      {
        bomLineId: "a-controller",
        part: { manufacturerId: "synthetic", manufacturerPartNumber: "CTRL-A" },
        quantityPerAssembly: 1,
        status: "sourced",
        selectedOffer: { snapshotId: "snapshot:synthetic", distributor: "digikey", distributorSku: "SYN-1" },
        lifecycle: "active",
        stockQuantity: 50,
        purchaseQuantity: 10,
        buildableQuantity: 50,
        extendedCost: { amount: 12.5, currency: "USD" },
        leadTimeDays: 14,
        leadTimeKind: "manufacturer",
        warnings: ["Price is an observation, not a guarantee"],
      },
    ],
    lifecycleCounts: { active: 1, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 1 },
    warnings: ["One line is unavailable"],
  },
  simulationCoverage: [],
  circuit: {
    format: "opencircuit-circuit",
    version: 1,
    meta: { title: "Synthetic candidate" },
    components: [],
    wires: [],
    probes: [],
    sim: { mode: "op" },
  },
  warnings: [],
};

const spiceCandidate: DesignCandidate = {
  ...structuredClone(candidate),
  id: "candidate:golden",
  requestHash: "fnv1a64:golden-request",
  recipeId: "power.synthetic.golden",
  simulationCoverage: [
    { scenarioId: "startup", modelTier: "unavailable", limitations: ["No startup model is attached"] },
    { scenarioId: "steady_state", modelTier: "behavioral", limitations: ["Generic source behavior only"] },
  ],
  circuit: {
    format: "opencircuit-circuit",
    version: 1,
    meta: { title: "Golden candidate" },
    components: [
      { id: "c1", type: "vsource", value: 5, pos: [0, 2], rot: 0, mirror: false },
      { id: "c2", type: "ground", pos: [0, 4], rot: 0, mirror: false },
    ],
    wires: [],
    probes: [],
    sim: { mode: "live" },
  },
  warnings: ["Zulu warning", "Alpha warning"],
};

describe("scheMAGIC design export", () => {
  it("keeps the explicit V1 serializer byte-identical to the frozen unsuffixed API", () => {
    const result: DesignResult = {
      format: "schemagic-design-result",
      schemaVersion: 1,
      request,
      requestHash: "sha256:request",
      libraryVersion: request.libraryVersion,
      libraryContentHash: "sha256:library",
      candidates: [candidate],
      rejectedCandidates: [],
      diagnostics: [],
    };
    expect(serializeDesignResultV1(result)).toBe(serializeDesignResult(result));

    const legacyArtifact: LegacyDesignGenerationArtifactV1 = {
      ...result,
      rejections: [],
      trace: {
        pipeline: ["normalize", "enumerate", "solve", "match", "check", "estimate", "dedupe", "pareto", "rank", "materialize"],
        counts: {
          recipes: 0,
          enumerated: 0,
          solved: 0,
          matched: 0,
          checked: 0,
          estimated: 0,
          sourced: 0,
          deduped: 0,
          pareto: 0,
          materialized: 0,
          rejected: 0,
        },
      },
    };
    expect(serializeDesignResultV1(legacyArtifact)).toBe(serializeDesignResult(legacyArtifact));
  });

  it("serializes design results with stable lexical object keys", () => {
    const result: DesignResult = {
      format: "schemagic-design-result",
      schemaVersion: 1,
      request,
      requestHash: "sha256:request",
      libraryVersion: request.libraryVersion,
      libraryContentHash: "sha256:library",
      candidates: [candidate],
      rejectedCandidates: [],
      diagnostics: [],
    };
    const first = serializeDesignResult(result);
    const second = serializeDesignResult(structuredClone(result));
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(first) as DesignResult;
    expect(parsed).toEqual(result);
    expect(first.indexOf('"candidates"')).toBeLessThan(first.indexOf('"diagnostics"'));
  });

  it("emits deterministic, escaped BOM rows ordered by BOM line ID", () => {
    const csv = exportCandidateBomCsv(candidate);
    const lines = csv.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("a-controller");
    expect(lines[1]).toContain("digikey,SYN-1");
    expect(lines[1]).toContain("Price is an observation");
    expect(lines[2]).toContain("z-capacitor");
    expect(lines[2]).toContain('"CAP,10"""');
    expect(lines[2]).toContain("source:a; source:z");
    expect(exportCandidateBomCsv(structuredClone(candidate))).toBe(csv);
  });

  it("matches the deterministic selected-candidate SPICE golden", () => {
    const golden = readFileSync(new URL("./fixtures/candidate-golden.cir", import.meta.url), "utf8");
    const first = exportCandidateSpiceNetlist(spiceCandidate);
    const second = exportCandidateSpiceNetlist(structuredClone(spiceCandidate));
    expect(first).toBe(golden);
    expect(second).toBe(first);
    expect(first.endsWith(".end\n")).toBe(true);
  });

  it("escapes candidate comments and rejects directive-bearing circuit strings before generation", () => {
    const commentInjection = {
      ...structuredClone(spiceCandidate),
      id: "candidate:\r\n.control\tquit",
      warnings: ["warning\n.end"],
      simulationCoverage: [{ scenarioId: "steady\rstate", modelTier: "behavioral" as const, limitations: ["limit\n.control"] }],
    };
    const escaped = exportCandidateSpiceNetlist(commentInjection);
    expect(escaped).toContain("* candidate-id candidate: .control quit");
    expect(escaped).toContain("* candidate-warning warning .end");
    expect(escaped).not.toMatch(/^\.control/m);
    expect(escaped.match(/^\.end$/gm)).toHaveLength(1);

    const unsafeValue = structuredClone(spiceCandidate);
    unsafeValue.circuit.components[0]!.value = "5\n.control";
    expect(() => exportCandidateSpiceNetlist(unsafeValue)).toThrowError(CandidateSpiceExportError);
    try {
      exportCandidateSpiceNetlist(unsafeValue);
    } catch (error) {
      expect(error).toMatchObject({ code: "unsafe_spice_scalar" });
      expect((error as Error).message).toContain("control characters");
    }

    const unsafeParameter = structuredClone(spiceCandidate);
    unsafeParameter.circuit.components[0] = {
      ...unsafeParameter.circuit.components[0]!,
      type: "vsource_pulse",
      params: { delay: "1u\r.end" },
    };
    expect(() => exportCandidateSpiceNetlist(unsafeParameter)).toThrowError(/control characters/);

    const ignoredValue = structuredClone(spiceCandidate);
    ignoredValue.circuit.components[1] = {
      ...ignoredValue.circuit.components[1]!,
      value: "ignored\n.end",
    } as DesignCandidate["circuit"]["components"][number];
    expect(() => exportCandidateSpiceNetlist(ignoredValue)).toThrowError(/control characters/);
  });

  it("rejects explicit probe nodes outside the conservative SPICE token allowlist", () => {
    for (const node of ["n1)\n.control", "n1)"]) {
      const unsafeNoise = structuredClone(spiceCandidate);
      unsafeNoise.circuit.probes = [{ id: "output", kind: "voltage", target: { node } }];
      unsafeNoise.circuit.sim = {
        mode: "noise",
        noise: {
          outputProbeId: "output",
          inputSourceId: "c1",
          fstart: 10,
          fstop: 1_000_000,
          pointsPerDecade: 30,
          sweep: "dec",
          temperatureC: 27,
        },
      };
      expect(validateCircuit(unsafeNoise.circuit)).not.toEqual([]);
      try {
        exportCandidateSpiceNetlist(unsafeNoise);
        throw new Error("Expected explicit probe node export to fail");
      } catch (error) {
        expect(error).toMatchObject({ code: "unsafe_spice_scalar" });
        expect((error as Error).message).toContain("probes.output.target.node");
        expect((error as Error).message).toContain("allowlisted SPICE node token");
      }
    }
  });

  it("keeps unsafe component comment IDs in the scalar-security error class", () => {
    for (const id of ["source\n.end", "source\u0000comment"]) {
      const unsafeId = structuredClone(spiceCandidate);
      unsafeId.circuit.components[0]!.id = id;
      expect(validateCircuit(unsafeId.circuit)).not.toEqual([]);
      try {
        exportCandidateSpiceNetlist(unsafeId);
        throw new Error("Expected unsafe component ID export to fail");
      } catch (error) {
        expect(error).toMatchObject({ code: "unsafe_spice_scalar" });
        expect((error as Error).message).toContain("component ID");
      }
    }
    const safeId = structuredClone(spiceCandidate);
    safeId.circuit.components[0]!.id = "source $ Ω !";
    const first = exportCandidateSpiceNetlist(safeId);
    expect(first).toContain("$ component:source $ Ω !");
    expect(exportCandidateSpiceNetlist(structuredClone(safeId))).toBe(first);
  });

  it("rejects unsafe transient and AC scalars before public netlist generation", () => {
    const transientCases: ReadonlyArray<readonly ["tstop" | "tstep" | "maxstep", unknown]> = [
      ["tstop", "1m\n.control"],
      ["tstep", "20u"],
      ["maxstep", Number.NaN],
    ];
    for (const [key, value] of transientCases) {
      const invalid = structuredClone(spiceCandidate);
      invalid.circuit.sim = { mode: "tran", tran: { tstop: 0.01, tstep: 0.000_02, maxstep: 0.000_05 } };
      (invalid.circuit.sim.tran as unknown as Record<string, unknown>)[key] = value;
      expect(() => exportCandidateSpiceNetlist(invalid)).toThrowError(`sim.tran.${key}`);
    }

    const acCases: ReadonlyArray<readonly ["fstart" | "fstop" | "pointsPerDecade", unknown]> = [
      ["fstart", "10\n.end"],
      ["fstop", Number.POSITIVE_INFINITY],
      ["pointsPerDecade", 1.5],
      ["pointsPerDecade", "30"],
      ["pointsPerDecade", 0],
    ];
    for (const [key, value] of acCases) {
      const invalid = structuredClone(spiceCandidate);
      invalid.circuit.sim = { mode: "ac", ac: { fstart: 10, fstop: 1_000_000, pointsPerDecade: 30, sweep: "dec" } };
      (invalid.circuit.sim.ac as unknown as Record<string, unknown>)[key] = value;
      expect(() => exportCandidateSpiceNetlist(invalid)).toThrowError(`sim.ac.${key}`);
    }
  });

  it("requires a finite numeric open-interval potentiometer position", () => {
    for (const position of ["0.5", Number.NaN, 0, 1]) {
      const invalid = structuredClone(spiceCandidate);
      invalid.circuit.components[0] = {
        ...invalid.circuit.components[0]!,
        type: "potentiometer",
        value: "10k",
        params: { t: position },
      };
      expect(() => exportCandidateSpiceNetlist(invalid)).toThrowError("components.c1.params.t");
      try {
        exportCandidateSpiceNetlist(invalid);
      } catch (error) {
        expect(error).toMatchObject({ code: "unsafe_spice_scalar" });
      }
    }
  });

  it("returns inspectable errors for invalid and unsupported circuits", () => {
    const invalid = structuredClone(spiceCandidate);
    invalid.circuit.components = invalid.circuit.components.filter((component) => component.type !== "ground");
    try {
      exportCandidateSpiceNetlist(invalid);
      throw new Error("Expected invalid circuit export to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_circuit" });
      expect((error as CandidateSpiceExportError).issues[0]?.path).toBe("components");
      expect((error as Error).message).toContain("Add a ground symbol");
    }

    const unsupported = structuredClone(spiceCandidate);
    unsupported.circuit.sim.mode = "harmonic" as DesignCandidate["circuit"]["sim"]["mode"];
    expect(() => exportCandidateSpiceNetlist(unsupported)).toThrowError(/unsupported simulation mode harmonic/);
    try {
      exportCandidateSpiceNetlist(unsupported);
    } catch (error) {
      expect(error).toMatchObject({ code: "unsupported_circuit" });
    }
  });
});
