import { assertValidCircuit, canonicalizeCircuit, generateNetlist, type CircuitDocument } from "@opencircuit/circuit-schema";
import type { DesignCandidate } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import { generateMotorDesign } from "../src";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "../src/fixtures";

function firstCandidate(request: typeof M1_COMPACT_REQUEST | typeof M2_POWER_REQUEST): DesignCandidate {
  const candidate = generateMotorDesign(structuredClone(request)).candidates[0];
  if (!candidate) throw new Error("Expected a materialized motor candidate");
  return candidate;
}

function component(document: CircuitDocument, id: string) {
  const result = document.components.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing circuit component ${id}`);
  return result;
}

function bom(candidate: DesignCandidate, role: string) {
  const result = candidate.components.find((entry) => entry.role === role);
  if (!result) throw new Error(`Missing BOM role ${role}`);
  return result;
}

function node(generated: ReturnType<typeof generateNetlist>, componentId: string, pin: number): string {
  const value = generated.componentNodes[componentId]?.[pin];
  if (value === undefined) throw new Error(`Missing node for ${componentId}.${pin}`);
  return value;
}

function expectConnectedBridge(candidate: DesignCandidate, external: boolean): void {
  const document = candidate.circuit;
  expect(() => assertValidCircuit(document)).not.toThrow();
  expect(document.meta.title).toMatch(/scheMAGIC Motor Designer behavioral/i);
  expect(document.meta.description).toMatch(/averaged operating-point model/i);
  expect(document.meta.description).toMatch(/does not model PWM edges/i);
  expect(document.sim).toEqual({ mode: "op" });

  const switches = document.components.filter((entry) => entry.type === "switch_spst");
  expect(switches.map((entry) => entry.id).sort()).toEqual([
    "s-high-left",
    "s-high-right",
    "s-low-left",
    "s-low-right",
  ]);
  expect(switches.filter((entry) => entry.params?.closed === true).map((entry) => entry.id).sort())
    .toEqual(["s-high-left", "s-low-right"]);
  expect(switches.filter((entry) => entry.params?.closed === false).map((entry) => entry.id).sort())
    .toEqual(["s-high-right", "s-low-left"]);
  expect(switches.every((entry) => entry.params?.limitation === "Static 1 mΩ/1 GΩ operating-point switch; no gate-controlled PWM behavior"))
    .toBe(true);
  expect(switches.every((entry) => !("driverMpn" in (entry.params ?? {})))).toBe(true);

  const generated = generateNetlist(document);
  const top = node(generated, "v-bridge-average", 0);
  const ground = node(generated, "v-bridge-average", 1);
  const leftOutput = node(generated, "s-high-left", 1);
  const rightOutput = node(generated, "s-high-right", 1);
  const bottom = node(generated, "s-low-right", 1);

  expect(node(generated, "s-high-left", 0)).toBe(top);
  expect(node(generated, "s-high-right", 0)).toBe(top);
  expect(node(generated, "s-low-left", 0)).toBe(leftOutput);
  expect(node(generated, "s-low-right", 0)).toBe(rightOutput);
  expect(node(generated, "r-motor-winding", 0)).toBe(leftOutput);
  expect(node(generated, "v-motor-back-emf", 1)).toBe(rightOutput);
  expect(node(generated, "c-local", 0)).toBe(top);
  expect(node(generated, "c-local", 1)).toBe(bottom);
  expect(node(generated, "c-bulk", 0)).toBe(top);
  expect(node(generated, "c-bulk", 1)).toBe(bottom);

  if (external) {
    expect(component(document, "r-current-shunt")).toEqual(expect.objectContaining({ type: "resistor" }));
    expect(node(generated, "r-current-shunt", 0)).toBe(ground);
    expect(node(generated, "r-current-shunt", 1)).toBe(bottom);
  } else {
    expect(document.components.some((entry) => entry.id === "r-current-shunt")).toBe(false);
    expect(bottom).toBe(ground);
  }

  const terminalCounts = new Map<string, number>();
  for (const circuitComponent of document.components) {
    for (const terminal of generated.componentNodes[circuitComponent.id] ?? []) {
      terminalCounts.set(terminal, (terminalCounts.get(terminal) ?? 0) + 1);
    }
  }
  expect([...terminalCounts.entries()].filter(([, count]) => count < 2)).toEqual([]);
}

describe("connected averaged motor materialization", () => {
  it("materializes the integrated recipe as an editable connected behavioral bridge", () => {
    const candidate = firstCandidate(M1_COMPACT_REQUEST);
    expectConnectedBridge(candidate, false);
    const driver = bom(candidate, "h-bridge-driver");
    expect(candidate.circuit.components.filter((entry) => entry.type === "switch_spst").every((entry) =>
      !("mpn" in entry)
      && entry.params?.switchBindingId === driver.id
      && entry.params?.switchBindingProfileId === driver.profileId
      && entry.params?.driverId === driver.id
      && entry.params?.driverProfileId === driver.profileId)).toBe(true);
    expect(Number(component(candidate.circuit, "v-bridge-average").value)).toBeCloseTo(9.6, 12);
    expect(component(candidate.circuit, "r-motor-winding")).toEqual(expect.objectContaining({ value: 2.4 }));
    expect(Number(component(candidate.circuit, "v-motor-back-emf").value)).toBeCloseTo(6, 12);
  });

  it("materializes the external recipe with exact driver, shunt, and capacitor BOM bindings", () => {
    const candidate = firstCandidate(M2_POWER_REQUEST);
    expectConnectedBridge(candidate, true);
    const driver = bom(candidate, "h-bridge-driver");
    const mosfet = bom(candidate, "bridge-nmos");
    const shunt = bom(candidate, "current-sense-shunt");
    const local = bom(candidate, "local-decoupling");
    const bulk = bom(candidate, "supply-bulk-capacitance");

    const switches = candidate.circuit.components.filter((entry) => entry.type === "switch_spst");
    expect(switches).toHaveLength(mosfet.quantityPerAssembly);
    expect(switches.every((entry) => entry.mpn === mosfet.part.manufacturerPartNumber
      && entry.mpn !== driver.part.manufacturerPartNumber
      && entry.params?.switchBindingId === mosfet.id
      && entry.params?.switchBindingProfileId === mosfet.profileId
      && entry.params?.driverId === driver.id
      && entry.params?.driverProfileId === driver.profileId
      && !("driverMpn" in (entry.params ?? {}))
      && entry.params?.representedQuantityPerAssembly === mosfet.quantityPerAssembly)).toBe(true);
    expect(switches.every((entry) => entry.params?.omittedControlBomRoles instanceof Array
      && entry.params.omittedControlBomRoles.includes("bootstrap-capacitor"))).toBe(true);
    expect(component(candidate.circuit, "r-current-shunt")).toEqual(expect.objectContaining({
      mpn: shunt.part.manufacturerPartNumber,
      params: expect.objectContaining({ designProfileId: shunt.profileId }),
    }));
    expect(component(candidate.circuit, "c-local")).toEqual(expect.objectContaining({
      mpn: local.part.manufacturerPartNumber,
      params: expect.objectContaining({ designProfileId: local.profileId }),
    }));
    expect(component(candidate.circuit, "c-bulk")).toEqual(expect.objectContaining({
      mpn: bulk.part.manufacturerPartNumber,
      params: expect.objectContaining({ designProfileId: bulk.profileId }),
    }));
    expect(Number(component(candidate.circuit, "v-bridge-average").value)).toBeCloseTo(19.2, 12);
    expect(Number(component(candidate.circuit, "v-motor-back-emf").value)).toBeCloseTo(13.2, 12);
  });

  it("generates a byte-stable operating-point netlist independent of document array order", () => {
    for (const candidate of [firstCandidate(M1_COMPACT_REQUEST), firstCandidate(M2_POWER_REQUEST)]) {
      const first = generateNetlist(candidate.circuit);
      const reordered: CircuitDocument = {
        ...structuredClone(candidate.circuit),
        components: [...candidate.circuit.components].reverse(),
        wires: [...candidate.circuit.wires].reverse(),
        probes: [...candidate.circuit.probes].reverse(),
      };
      const second = generateNetlist(reordered);
      expect(first.netlist).toBe(second.netlist);
      expect(first.documentHash).toBe(second.documentHash);
      expect(canonicalizeCircuit(candidate.circuit)).toBe(canonicalizeCircuit(reordered));
      expect(first.netlist).toContain(".op\n.end\n");
      expect(first.netlist).not.toContain(".tran ");
      expect(first.netlist).not.toContain("OC_GENERIC_NMOS");
      expect(Object.keys(first.componentCurrents)).toEqual(expect.arrayContaining([
        "v-bridge-average",
        "r-motor-winding",
        "v-motor-back-emf",
      ]));
    }
  });

  it("materializes provided winding L and back-EMF facts but keeps startup unavailable", () => {
    const dynamicRequest = structuredClone(M1_COMPACT_REQUEST);
    dynamicRequest.requirements.motorModel.windingInductance = { value: 1e-3, unit: "H", displayUnit: "mH" };
    dynamicRequest.requirements.motorModel.backEmfConstant = { value: 0.1, unit: "V_s_per_rad", displayUnit: "V·s/rad" };
    dynamicRequest.requirements.motorModel.targetSpeed = { value: 60, unit: "rad_per_s", displayUnit: "rad/s" };
    const candidate = firstCandidate(dynamicRequest);
    expect(component(candidate.circuit, "l-motor-winding")).toEqual(expect.objectContaining({ type: "inductor", value: 1e-3 }));
    expect(Number(component(candidate.circuit, "v-motor-back-emf").value)).toBeCloseTo(6, 12);
    expect(component(candidate.circuit, "v-motor-back-emf").params).toEqual(expect.objectContaining({
      evidenceState: "calculated",
      equationId: "motor.model.target-back-emf.v1",
    }));
    const startup = candidate.simulationCoverage.find((entry) => entry.scenarioId === "startup");
    expect(startup).toEqual(expect.objectContaining({ modelTier: "unavailable" }));
    expect(startup?.limitations.join(" ")).toMatch(/cannot express speed-coupled back-EMF\/torque dynamics/i);
  });

  it("reports exact behavioral/unavailable scenario tiers without a native/WASM claim", () => {
    for (const candidate of [firstCandidate(M1_COMPACT_REQUEST), firstCandidate(M2_POWER_REQUEST)]) {
      const coverage = Object.fromEntries(candidate.simulationCoverage.map((entry) => [entry.scenarioId, entry]));
      expect(coverage.pwm_loaded_steady_state).toEqual(expect.objectContaining({ modelTier: "behavioral" }));
      expect(coverage.pwm_loaded_steady_state?.limitations.join(" ")).toMatch(/explicitly averaged/i);
      expect(coverage.pwm_loaded_steady_state?.limitations.join(" ")).toMatch(/static ideal 1 mΩ\/1 GΩ switches/i);
      expect(coverage.pwm_loaded_steady_state?.limitations.join(" ")).toMatch(/no native-ngspice\/WASM numerical-validation claim/i);
      expect(coverage.startup).toEqual(expect.objectContaining({ modelTier: "unavailable" }));
      expect(coverage.stall_or_current_limit).toEqual(expect.objectContaining({ modelTier: "unavailable" }));
      expect(coverage.fast_decay_brake).toEqual(expect.objectContaining({ modelTier: "unavailable" }));
      expect(candidate.simulationCoverage.filter((entry) => entry.modelTier === "behavioral").map((entry) => entry.scenarioId))
        .toEqual(["pwm_loaded_steady_state"]);
      expect(candidate.simulationCoverage.some((entry) => entry.modelTier === "reviewed")).toBe(false);
    }
  });
});
