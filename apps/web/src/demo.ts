import type { CircuitDocument } from "@opencircuit/circuit-schema";

export const demoCircuit: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 2,
  meta: {
    title: "NPN LED bench",
    description: "A 2N3904 low-side LED driver controlled by a potentiometer.",
  },
  components: [
    { id: "c1", type: "vsource", value: 5, pos: [8, 24], rot: 0, mirror: false, label: { text: "V1", offset: [-4, 0] } },
    { id: "c2", type: "potentiometer", value: 10_000, params: { t: 0.5 }, pos: [18, 22], rot: 0, mirror: false, label: { text: "P1", offset: [-5, 0] } },
    { id: "c3", type: "resistor", value: 10_000, pos: [32, 22], rot: 0, mirror: false, label: { text: "RB", offset: [0, -3] } },
    { id: "c4", type: "bjt_npn", mpn: "2N3904", pos: [44, 22], rot: 0, mirror: false, label: { text: "Q1", offset: [5, 0] } },
    { id: "c5", type: "resistor", value: 330, pos: [58, 13], rot: 90, mirror: false, label: { text: "RL", offset: [4, 0] } },
    { id: "c6", type: "led", mpn: "OC_LED_RED", pos: [58, 19], rot: 0, mirror: false, label: { text: "D1", offset: [4, 0] } },
    { id: "c7", type: "ground", pos: [8, 30], rot: 0, mirror: false },
    { id: "c8", type: "ground", pos: [18, 30], rot: 0, mirror: false },
    { id: "c9", type: "ground", pos: [46, 30], rot: 0, mirror: false },
  ],
  wires: [
    { id: "migration-v1-v2-1", points: [[46, 19], [46, 18]] },
    { id: "w1", points: [[8, 22], [8, 11], [18, 11], [58, 11]] },
    { id: "w2", points: [[18, 20], [18, 11]] },
    { id: "w3", points: [[8, 26], [8, 30]] },
    { id: "w4", points: [[18, 24], [18, 30]] },
    { id: "w5", points: [[20, 22], [30, 22]] },
    { id: "w6", points: [[34, 22], [42, 22]] },
    { id: "w7", points: [[46, 25], [46, 30]] },
    { id: "w8", points: [[58, 15], [58, 17]] },
    { id: "w9", points: [[58, 21], [52, 21], [52, 18], [46, 18]] },
  ],
  probes: [
    { id: "p1", kind: "voltage", target: { componentPin: ["c4", 0] }, color: "#2E86C8" },
  ],
  sim: {
    mode: "live",
    tran: { tstop: 0.01, tstep: 0.00002, maxstep: 0.00005 },
    ac: { fstart: 10, fstop: 1_000_000, pointsPerDecade: 30, sweep: "dec" },
  },
  view: { pan: [0, 0], zoom: 1 },
};
