import { describe, expect, it } from "vitest";
import {
  defaultComponentParamsV3,
  generateNetlist,
  partByType,
  validateCircuit,
  type BehavioralExpressionV3,
  type CircuitComponent,
  type CircuitDocument,
  type ComponentType,
} from "../src";

const typedTypes = [
  "isource_pulse",
  "switch_spdt", "switch_dpdt", "switch_pushbutton", "switch_toggle", "switch_vcontrolled",
  "vcvs", "vccs", "cccs", "ccvs", "behavioral_source",
  "transformer", "crystal", "transmission_line", "fuse",
] as const satisfies readonly ComponentType[];

function documentWith(
  type: ComponentType,
  overrides: Partial<CircuitComponent> = {},
): CircuitDocument {
  const first = partByType(type).pins[0] ?? [0, 0];
  const defaultParams = defaultComponentParamsV3(type);
  const component: CircuitComponent = {
    id: "c1",
    type,
    pos: [10, 10],
    rot: 0,
    mirror: false,
    ...(defaultParams ? { params: defaultParams } : {}),
  };
  Object.assign(component, overrides);
  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: `${type} bench` },
    components: [
      component,
      { id: "g1", type: "ground", pos: [10 + first[0], 10 + first[1]], rot: 0, mirror: false },
    ],
    wires: [],
    probes: [],
    sim: type === "isource_pulse"
      ? { mode: "tran", tran: { tstop: 0.02, tstep: 0.00002, maxstep: 0.00005 } }
      : { mode: "op" },
  };
}

describe("Simulator V3 component contract", () => {
  it("gives every structured palette part a complete valid default", () => {
    for (const type of typedTypes) {
      const document = documentWith(type);
      expect(validateCircuit(document), type).toEqual([]);
      expect(() => generateNetlist(document), type).not.toThrow();
    }
  });

  it("emits binary, changeover, and voltage-controlled switch topology", () => {
    expect(generateNetlist(documentWith("switch_pushbutton", { params: { closed: true } })).netlist)
      .toMatch(/^R_SW_c1 \S+ \S+ 1m \$ component:c1$/m);
    expect(generateNetlist(documentWith("switch_toggle", { params: { closed: false } })).netlist)
      .toMatch(/^R_SW_c1 \S+ \S+ 1G \$ component:c1$/m);

    const spdt = generateNetlist(documentWith("switch_spdt", { params: { throw: "b" } })).netlist;
    expect(spdt).toMatch(/^R_SW_c1_A \S+ \S+ 1G \$ component:c1$/m);
    expect(spdt).toMatch(/^R_SW_c1_B \S+ \S+ 1m \$ component:c1$/m);

    const dpdt = generateNetlist(documentWith("switch_dpdt", { params: { throw: "a" } })).netlist;
    expect(dpdt).toMatch(/^R_SW_c1_A1 \S+ \S+ 1m \$ component:c1$/m);
    expect(dpdt).toMatch(/^R_SW_c1_B1 \S+ \S+ 1G \$ component:c1$/m);
    expect(dpdt).toMatch(/^R_SW_c1_A2 \S+ \S+ 1m \$ component:c1$/m);
    expect(dpdt).toMatch(/^R_SW_c1_B2 \S+ \S+ 1G \$ component:c1$/m);

    const controlled = generateNetlist(documentWith("switch_vcontrolled", {
      params: { ron: "2m", roff: "2G", threshold: 1.8, hysteresis: 0.1 },
    })).netlist;
    expect(controlled).toMatch(/^S1 \S+ \S+ \S+ \S+ OC_SW_[A-Za-z0-9_]+ \$ component:c1$/m);
    expect(controlled).toMatch(/^\.model OC_SW_[A-Za-z0-9_]+ SW\(Ron=2m Roff=2g Vt=1\.8 Vh=0\.1\)$/m);
  });

  it("emits current pulse and each dependent source without raw text", () => {
    const pulse = generateNetlist(documentWith("isource_pulse", {
      params: { i1: "1m", i2: "5m", delay: "2u", rise: "1u", fall: "1u", width: "5u", period: "10u" },
    }));
    expect(pulse.netlist).toMatch(/^I1 \S+ oc_ac_c1 PULSE\(1m 5m 2u 1u 1u 5u 10u\) \$ component:c1$/m);
    expect(pulse.netlist).toMatch(/^VOCS_c1 oc_ac_c1 \S+ 0 \$ component:c1$/m);
    expect(pulse.netlist).toContain("vocs_c1#branch");
    expect(pulse.netlist).not.toContain("@i1[i]");
    expect(pulse.componentCurrents.c1).toBe("vocs_c1#branch");
    expect(generateNetlist(documentWith("vcvs", { params: { gain: 4 } })).netlist).toMatch(/^E1 \S+ \S+ \S+ \S+ 4 /m);
    expect(generateNetlist(documentWith("vccs", { params: { gain: "2m" } })).netlist).toMatch(/^G1 \S+ \S+ \S+ \S+ 2m /m);
    expect(generateNetlist(documentWith("cccs", { params: { gain: 3 } })).netlist).toMatch(/^VCS_c1 \S+ \S+ 0 /m);
    expect(generateNetlist(documentWith("cccs", { params: { gain: 3 } })).netlist).toMatch(/^F1 \S+ \S+ VCS_c1 3 /m);
    expect(generateNetlist(documentWith("ccvs", { params: { gain: 6 } })).netlist).toMatch(/^H1 \S+ \S+ VCS_c1 6 /m);

    const expression: BehavioralExpressionV3 = {
      kind: "binary",
      operator: "*",
      left: { kind: "constant", value: 2 },
      right: { kind: "function", name: "abs", arguments: [{ kind: "constant", value: -3 }] },
    };
    expect(generateNetlist(documentWith("behavioral_source", {
      params: { output: "voltage", expression },
    })).netlist).toMatch(/^B1 \S+ \S+ V=\(2\*abs\(-3\)\) /m);
  });

  it("emits transformer, crystal, lossless line, battery, fuse, and catalog-backed zener", () => {
    const transformer = generateNetlist(documentWith("transformer")).netlist;
    expect(transformer).toMatch(/^L_XFMR_c1_P \S+ \S+ 10m /m);
    expect(transformer).toMatch(/^L_XFMR_c1_S \S+ \S+ 10m /m);
    expect(transformer).toMatch(/^K_XFMR_c1 L_XFMR_c1_P L_XFMR_c1_S 0\.999 /m);

    const crystal = generateNetlist(documentWith("crystal")).netlist;
    expect(crystal).toMatch(/^C_XTAL_c1_P \S+ \S+ 3p /m);
    expect(crystal).toMatch(/^R_XTAL_c1_S \S+ \S+ 30 /m);
    expect(crystal).toMatch(/^L_XTAL_c1_S \S+ \S+ 10m /m);
    expect(crystal).toMatch(/^C_XTAL_c1_S \S+ \S+ 20f /m);

    expect(generateNetlist(documentWith("transmission_line")).netlist)
      .toMatch(/^T1 \S+ \S+ \S+ \S+ Z0=50 TD=1n /m);
    expect(generateNetlist(documentWith("battery", { value: 12 })).netlist)
      .toMatch(/^V1 \S+ \S+ DC 12 /m);
    expect(generateNetlist(documentWith("fuse", { value: "20m", params: { blown: true, blownResistance: "2G" } })).netlist)
      .toMatch(/^R_FUSE_c1 \S+ \S+ 2g /m);
    expect(generateNetlist(documentWith("zener", { params: { catalogPartId: "nexperia/BZX84-C2V7-215" } })).netlist)
      .toContain("* catalog-only zener 1 awaiting its catalog package model");
  });

  it("allocates private sensor and crystal nodes without colliding with user net labels", () => {
    const pulseDocument = documentWith("isource_pulse");
    pulseDocument.wires = [{ id: "w1", netLabel: "oc_ac_c1", points: [[100, 100], [102, 100]] }];
    const pulse = generateNetlist(pulseDocument);
    expect(pulse.wireNodes.w1).toBe("oc_ac_c1");
    expect(pulse.netlist).toMatch(/^I1 \S+ oc_ac_c1_2 PULSE\(/m);
    expect(pulse.netlist).toMatch(/^VOCS_c1 oc_ac_c1_2 \S+ 0 /m);

    const crystalDocument = documentWith("crystal");
    crystalDocument.wires = [
      { id: "w1", netLabel: "oc_y1_a", points: [[100, 100], [102, 100]] },
      { id: "w2", netLabel: "oc_y1_b", points: [[100, 104], [102, 104]] },
    ];
    const crystal = generateNetlist(crystalDocument);
    expect(crystal.wireNodes).toMatchObject({ w1: "oc_y1_a", w2: "oc_y1_b" });
    expect(crystal.netlist).toMatch(/^R_XTAL_c1_S \S+ oc_y1_a_2 30 /m);
    expect(crystal.netlist).toMatch(/^L_XTAL_c1_S oc_y1_a_2 oc_y1_b_2 10m /m);
    expect(crystal.netlist).toMatch(/^C_XTAL_c1_S oc_y1_b_2 \S+ 20f /m);
  });

  it("allocates support-device names without colliding with user component names", () => {
    const sensedDocument = documentWith("isource_pulse");
    sensedDocument.components[0]!.id = "foo";
    sensedDocument.components.push(
      { id: "OCSfoo", type: "vsource", value: 0, pos: [50, 50], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [50, 52], rot: 0, mirror: false },
    );
    const sensed = generateNetlist(sensedDocument);
    expect(sensed.netlist).toMatch(/^VOCSfoo \S+ \S+ DC 0 /m);
    expect(sensed.netlist).toMatch(/^VOCS_foo oc_ac_foo \S+ 0 /m);
    expect(sensed.componentCurrents.foo).toBe("vocs_foo#branch");

    const transformerDocument = documentWith("transformer");
    transformerDocument.components[0]!.id = "foo";
    transformerDocument.components.push(
      { id: "fooP", type: "inductor", value: "1m", pos: [50, 50], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [48, 50], rot: 0, mirror: false },
    );
    const transformer = generateNetlist(transformerDocument);
    expect(transformer.netlist).toMatch(/^LfooP \S+ \S+ 1m /m);
    expect(transformer.netlist).toMatch(/^L_XFMR_foo_P \S+ \S+ 10m /m);
    expect(transformer.netlist).toMatch(/^K_XFMR_foo L_XFMR_foo_P L_XFMR_foo_S 0\.999 /m);
    expect(transformer.componentCurrents.foo).toBe("@l_xfmr_foo_p[i]");
  });

  it("rejects behavioural-source directive injection and invalid topology references", () => {
    const raw = documentWith("behavioral_source", {
      params: { output: "voltage", expression: "0\n.end\n.control" },
    });
    expect(validateCircuit(raw).map((issue) => issue.message).join(" ")).toMatch(/typed expression contract.*raw SPICE text/i);
    expect(() => generateNetlist(raw)).toThrow(/typed expression contract/i);

    const injectedConstant = documentWith("behavioral_source", {
      params: { output: "current", expression: { kind: "constant", value: "0\n.end" } },
    });
    expect(validateCircuit(injectedConstant).map((issue) => issue.path))
      .toContain("components.c1.params.expression.value");
    expect(() => generateNetlist(injectedConstant)).toThrow(/finite engineering value/i);

    const missingReference = documentWith("behavioral_source", {
      params: {
        output: "voltage",
        expression: { kind: "voltage", positive: { kind: "wire", wireId: "missing" } },
      },
    });
    expect(validateCircuit(missingReference).map((issue) => issue.path))
      .toContain("components.c1.params.expression.positive.wireId");
  });

  it("rejects invalid switch, transformer, line, and pulse limits", () => {
    expect(validateCircuit(documentWith("switch_vcontrolled", {
      params: { ron: 10, roff: 1, threshold: 2.5, hysteresis: -1 },
    })).map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "components.c1.params.roff",
      "components.c1.params.hysteresis",
    ]));
    expect(validateCircuit(documentWith("transformer", {
      params: { primaryInductance: "10m", secondaryInductance: "10m", coupling: 1.1 },
    })).map((issue) => issue.path)).toContain("components.c1.params.coupling");
    expect(validateCircuit(documentWith("transmission_line", {
      params: { impedance: 0, delay: -1 },
    })).map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "components.c1.params.impedance",
      "components.c1.params.delay",
    ]));
    expect(validateCircuit(documentWith("isource_pulse", {
      params: { i1: 0, i2: 1, delay: 0, rise: 0.2, fall: 0.2, width: 0.7, period: 1 },
    })).map((issue) => issue.path)).toContain("components.c1.params");

    const wrongMode = documentWith("isource_pulse");
    wrongMode.sim = { mode: "op" };
    expect(validateCircuit(wrongMode).map((issue) => issue.path)).toContain("sim.mode");

    const shortRun = documentWith("isource_pulse", {
      params: { i1: 0, i2: 1, delay: "2m", rise: "1u", fall: "1u", width: "1m", period: "4m" },
    });
    shortRun.sim = { mode: "tran", tran: { tstop: 0.002, tstep: 0.00001, maxstep: 0.00002 } };
    expect(validateCircuit(shortRun).map((issue) => issue.path)).toContain("sim.tran.tstop");
  });
});
