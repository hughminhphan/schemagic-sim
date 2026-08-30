import { describe, expect, it } from "vitest";
import {
  canonicalizeCircuit,
  componentPinPoints,
  generateNetlist,
  validateCircuit,
  type CircuitComponent,
  type CircuitDocument,
  type Point,
} from "@opencircuit/circuit-schema";
import type { DesignCandidate } from "@opencircuit/design-schema";
import {
  createP1CompactRequest,
  createP2HighVoltageRequest,
  generateP1CompactFixture,
  generateP2HighVoltageFixture,
} from "../src/fixtures";
import { generateBuckDesign } from "../src";

function pointKey([x, y]: Point): string {
  return `${x},${y}`;
}

function component(document: CircuitDocument, id: string): CircuitComponent {
  const found = document.components.find((entry) => entry.id === id);
  if (!found) throw new Error(`Circuit is missing ${id}`);
  return found;
}

function primary(candidate: DesignCandidate): DesignCandidate["components"][number] {
  const found = candidate.components.find((entry) => entry.role === "power.regulator" || entry.role === "power.controller");
  if (!found) throw new Error(`Candidate ${candidate.id} has no primary component`);
  return found;
}

function generations(): ReturnType<typeof generateP1CompactFixture>[] {
  return [generateP1CompactFixture(), generateP2HighVoltageFixture()];
}

describe("scheMAGIC Power Designer Track B2 circuits", () => {
  it("materializes schema-valid connected editable circuits with no orphan component pins", () => {
    for (const generation of generations()) {
      for (const candidate of generation.candidates) {
        const document = candidate.circuit;
        const wirePoints = new Set(document.wires.flatMap((wire) => wire.points.map(pointKey)));

        expect(validateCircuit(document)).toEqual([]);
        expect(document.components.length).toBeGreaterThan(10);
        expect(document.wires.length).toBeGreaterThan(10);
        expect(document.probes.map((probe) => probe.id).sort()).toEqual([
          "feedback-voltage",
          "inductor-current",
          "input-current",
          "output-voltage",
          "switch-node-voltage",
          "vin-voltage",
        ]);
        for (const circuitComponent of document.components) {
          for (const pin of componentPinPoints(circuitComponent)) {
            expect(wirePoints.has(pointKey(pin)), `${candidate.id}/${circuitComponent.id} has an orphan pin at ${pointKey(pin)}`).toBe(true);
          }
        }
      }
    }
  });

  it("generates deterministic transient netlists with the expected buck node connectivity", () => {
    for (const generation of generations()) {
      for (const candidate of generation.candidates) {
        const first = generateNetlist(candidate.circuit);
        const second = generateNetlist(candidate.circuit);

        expect(first.netlist).toBe(second.netlist);
        expect(first.documentHash).toBe(second.documentHash);
        expect(first.netlist).toContain(".model OC_GENERIC_NMOS");
        expect(first.netlist).toContain("PULSE(");
        expect(first.netlist).toContain(".tran ");

        const nodes = first.componentNodes;
        expect(nodes["input-source"]?.[0]).toBe(nodes["high-side-switch"]?.[0]);
        expect(nodes["high-side-switch"]?.[2]).toBe(nodes["low-side-switch"]?.[0]);
        expect(nodes["low-side-switch"]?.[0]).toBe(nodes["power-inductor"]?.[0]);
        expect(nodes["power-inductor"]?.[1]).toBe(nodes["output-capacitor"]?.[0]);
        expect(nodes["power-inductor"]?.[1]).toBe(nodes["behavioral-load"]?.[0]);
        expect(nodes["power-inductor"]?.[1]).toBe(nodes["feedback-upper"]?.[0]);
        expect(nodes["input-source"]?.[1]).toBe("0");
        expect(nodes["low-side-switch"]?.[2]).toBe("0");
        expect(nodes["output-capacitor"]?.[1]).toBe("0");
        expect(nodes["behavioral-load"]?.[1]).toBe("0");
        expect(nodes["feedback-lower"]?.[1]).toBe("0");
      }
    }
  });

  it("keeps circuit and netlist bytes stable across repeated complete generations", () => {
    const cases = [
      [generateP1CompactFixture(), generateBuckDesign(createP1CompactRequest())],
      [generateP2HighVoltageFixture(), generateBuckDesign(createP2HighVoltageRequest())],
    ];
    for (const [first, second] of cases) {
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      const firstCircuits = first?.candidates.map((candidate) => canonicalizeCircuit(candidate.circuit));
      const secondCircuits = second?.candidates.map((candidate) => canonicalizeCircuit(candidate.circuit));
      expect(firstCircuits).toEqual(secondCircuits);
      expect(first?.candidates.map((candidate) => generateNetlist(candidate.circuit).netlist)).toEqual(
        second?.candidates.map((candidate) => generateNetlist(candidate.circuit).netlist),
      );
    }
  });

  it("binds physical passives and external FETs to selected BOM lines", () => {
    const p1 = generateP1CompactFixture();
    const p2 = generateP2HighVoltageFixture();
    for (const candidate of [...p1.candidates, ...p2.candidates]) {
      const expectedBomLines = candidate.components
        .filter((entry) => entry.role !== "power.regulator" && entry.role !== "power.controller")
        .map((entry) => entry.id)
        .sort();
      const boundBomLines = candidate.circuit.components
        .map((entry) => entry.params?.designerBomLineId)
        .filter((entry): entry is string => typeof entry === "string")
        .sort();
      expect(boundBomLines).toEqual(expectedBomLines);
    }

    for (const candidate of p2.candidates) {
      const highSide = component(candidate.circuit, "high-side-switch");
      const lowSide = component(candidate.circuit, "low-side-switch");
      expect(highSide.params?.designerPhysicalBomComponent).toBe(true);
      expect(lowSide.params?.designerPhysicalBomComponent).toBe(true);
      expect(highSide.mpn).toBe(candidate.components.find((entry) => entry.role === "power.high-side-mosfet")?.part.manufacturerPartNumber);
      expect(lowSide.mpn).toBe(candidate.components.find((entry) => entry.role === "power.low-side-mosfet")?.part.manufacturerPartNumber);
    }
  });

  it("labels the behavioral boundary and never masquerades a source or switch as the selected primary IC", () => {
    for (const generation of generations()) {
      for (const candidate of generation.candidates) {
        const selectedPrimary = primary(candidate);
        const highDrive = component(candidate.circuit, "high-side-gate-drive");
        const lowDrive = component(candidate.circuit, "low-side-gate-drive");

        expect(candidate.circuit.meta.description).toContain("behavioral");
        expect(candidate.circuit.meta.description).toContain("not a physical");
        expect(candidate.circuit.components.some((entry) => entry.mpn === selectedPrimary.part.manufacturerPartNumber)).toBe(false);
        expect(highDrive.label?.text).toContain("BEHAVIORAL");
        expect(lowDrive.label?.text).toContain("BEHAVIORAL");
        expect(highDrive.params?.designerPrimaryProfileId).toBe(selectedPrimary.profileId);
        expect(lowDrive.params?.designerPrimaryProfileId).toBe(selectedPrimary.profileId);
        expect(highDrive.params?.designerPhysicalBomComponent).toBe(false);
        expect(lowDrive.params?.designerPhysicalBomComponent).toBe(false);
      }
    }

    for (const candidate of generateP1CompactFixture().candidates) {
      const highSide = component(candidate.circuit, "high-side-switch");
      const lowSide = component(candidate.circuit, "low-side-switch");
      expect(highSide.mpn).toBeUndefined();
      expect(lowSide.mpn).toBeUndefined();
      expect(highSide.label?.text).toContain("INTERNAL HS FET · BEHAVIORAL");
      expect(lowSide.label?.text).toContain("INTERNAL LS FET · BEHAVIORAL");
      expect(highSide.params?.designerPhysicalBomComponent).toBe(false);
      expect(lowSide.params?.designerPhysicalBomComponent).toBe(false);
    }
  });

  it("uses deterministic delayed complementary gate timing for behavioral steady-state/startup coverage", () => {
    for (const generation of generations()) {
      for (const candidate of generation.candidates) {
        const frequency = candidate.derivedValues.find((entry) => entry.id === "buck.switching-frequency")?.value.value;
        if (!frequency) throw new Error(`Candidate ${candidate.id} has no switching frequency`);
        const period = 1 / frequency;
        const highDrive = component(candidate.circuit, "high-side-gate-drive");
        const lowDrive = component(candidate.circuit, "low-side-gate-drive");
        const highDelay = Number(highDrive.params?.delay);
        const lowDelay = Number(lowDrive.params?.delay);
        const highWidth = Number(highDrive.params?.width);
        const lowWidth = Number(lowDrive.params?.width);

        expect(Number(highDrive.params?.period)).toBeCloseTo(period, 14);
        expect(Number(lowDrive.params?.period)).toBeCloseTo(period, 14);
        expect(highDelay).toBeCloseTo(2 * period, 14);
        expect(lowDelay).toBeGreaterThan(highDelay);
        expect(highWidth).toBeGreaterThan(0);
        expect(lowWidth).toBeGreaterThan(0);
        expect(highWidth + lowWidth).toBeLessThan(period);
        expect(candidate.circuit.sim.mode).toBe("tran");
        expect(candidate.circuit.sim.tran?.tstop).toBeGreaterThan(lowDelay + lowWidth);
      }
    }
  });

  it("declares exact honest scenario tiers and contract limitations without native/WASM or stability claims", () => {
    for (const generation of generations()) {
      for (const candidate of generation.candidates) {
        const coverage = Object.fromEntries(candidate.simulationCoverage.map((entry) => [entry.scenarioId, entry]));
        expect(coverage.steady_state?.modelTier).toBe("behavioral");
        expect(coverage.startup?.modelTier).toBe("behavioral");
        expect(coverage.load_step?.modelTier).toBe("unavailable");
        expect(coverage.line_step?.modelTier).toBe("unavailable");
        expect(coverage.load_step?.limitations.join(" ")).toContain("no pulsed current or load-step stimulus");
        expect(coverage.line_step?.limitations.join(" ")).toContain("stores one SimConfig");
        expect(coverage.startup?.limitations.join(" ")).toContain("soft-start");
        expect(candidate.simulationCoverage.flatMap((entry) => entry.limitations).join(" ")).not.toMatch(/native|WASM|phase margin|stable loop/i);
      }
    }
  });
});
