import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync, strToU8 } from "fflate";
import { canonicalizeCircuit, generateNetlist, migrateCircuit } from "@opencircuit/circuit-schema";
import { demoCircuit } from "../../apps/web/src/demo.ts";

// This module is bundled into a temporary directory before it runs, so every
// output path is resolved from the workspace root the launcher runs it in.
const projectRoot = process.cwd();
const root = resolve(projectRoot, "examples");
const appFixtures = resolve(projectRoot, "apps/web/src/fixtures");
const encodeCircuit = (document) => {
  const bytes = deflateSync(strToU8(canonicalizeCircuit(document)), { level: 9 });
  return Buffer.from(bytes).toString("base64url");
};
const component = (id, type, pos, options = {}) => ({ id, type, pos, rot: 0, mirror: false, ...options });
const wire = (id, points, netLabel) => (netLabel ? { id, points, netLabel } : { id, points });
const ground = (id, pos) => component(id, "ground", pos);
const probe = (id, wireId, color) => ({ id, kind: "voltage", target: { wire: wireId }, color });
const TRACE_A = "#3987e5";
const TRACE_B = "#d95926";
const base = (title, description, components, wires, probes, mode, sim = {}) => ({
  format: "opencircuit-circuit",
  version: 2,
  meta: { title, description },
  components,
  wires,
  probes,
  sim: {
    mode,
    tran: { tstop: 0.01, tstep: 0.00002, maxstep: 0.00005 },
    ac: { fstart: 10, fstop: 1_000_000, pointsPerDecade: 30, sweep: "dec" },
    ...sim,
  },
  view: { pan: [0, 0], zoom: 1 },
});

const examples = new Map();
examples.set("transistor-led-bench", structuredClone(demoCircuit));
examples.set("rc-filter-bode", base(
  "RC low-pass Bode plot",
  "A 1 kΩ and 100 nF low-pass filter shows its 1.59 kHz corner in AC analysis and step response in transient analysis.",
  [
    component("c1", "vsource_pulse", [8, 20], { value: 1, params: { v1: 0, v2: 1, delay: "1m", rise: "1u", fall: "1u", width: "50m", period: "100m", ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c2", "resistor", [18, 18], { value: "1k", label: { text: "R1", offset: [0, -3] } }),
    component("c3", "capacitor", [26, 20], { value: "100n", rot: 90, label: { text: "C1", offset: [4, 0] } }),
    ground("c4", [8, 22]), ground("c5", [26, 22]),
  ],
  [wire("w1", [[8, 18], [16, 18]], "in"), wire("w2", [[20, 18], [26, 18]], "out"), wire("w3", [[8, 22], [8, 22]]), wire("w4", [[26, 22], [26, 22]])],
  [probe("p1", "w1", TRACE_A), probe("p2", "w2", TRACE_B)],
  "ac",
  { tran: { tstop: 0.01, tstep: 0.000005, maxstep: 0.000005 }, ac: { fstart: 10, fstop: 1_000_000, pointsPerDecade: 40, sweep: "dec" } },
));
examples.set("resistive-divider", base(
  "Resistive divider",
  "Two 10 kΩ resistors halve the supply, so a DC sweep of V1 draws the straight-line transfer curve every divider follows.",
  [
    component("c1", "vsource", [10, 20], { value: 5, label: { text: "V1", offset: [-5, 0] } }),
    component("c2", "resistor", [24, 14], { value: "10k", rot: 90, label: { text: "R1", offset: [4, 0] } }),
    component("c3", "resistor", [24, 22], { value: "10k", rot: 90, label: { text: "R2", offset: [4, 0] } }),
    ground("c4", [10, 26]), ground("c5", [24, 28]),
  ],
  [
    wire("w1", [[10, 18], [10, 10], [24, 10], [24, 12]], "vin"),
    wire("w2", [[24, 16], [24, 20]], "vout"),
    wire("w3", [[24, 24], [24, 28]]),
    wire("w4", [[10, 22], [10, 26]]),
  ],
  [probe("p1", "w2", TRACE_A), probe("p2", "w1", TRACE_B)],
  "dc-sweep",
  { dcSweep: { sourceId: "c1", start: 0, stop: 5, step: 0.05 } },
));
examples.set("led-current-limit", base(
  "LED current limit",
  "A 220 Ω series resistor sets the LED current from a 5 V rail, and sweeping V1 shows the forward knee that clamps the anode.",
  [
    component("c1", "vsource", [10, 20], { value: 5, label: { text: "V1", offset: [-5, 0] } }),
    component("c2", "resistor", [24, 14], { value: 220, rot: 90, label: { text: "R1", offset: [4, 0] } }),
    component("c3", "led", [24, 22], { label: { text: "D1", offset: [4, 0] } }),
    ground("c4", [10, 26]), ground("c5", [24, 28]),
  ],
  [
    wire("w1", [[10, 18], [10, 10], [24, 10], [24, 12]], "vsupply"),
    wire("w2", [[24, 16], [24, 20]], "anode"),
    wire("w3", [[24, 24], [24, 28]]),
    wire("w4", [[10, 22], [10, 26]]),
  ],
  [probe("p1", "w2", TRACE_A), probe("p2", "w1", TRACE_B)],
  "dc-sweep",
  { dcSweep: { sourceId: "c1", start: 0, stop: 5, step: 0.02 } },
));
examples.set("rlc-resonance", base(
  "Series RLC resonance",
  "A 100 Ω, 10 mH and 100 nF series loop resonates near 5 kHz, so the AC sweep shows the peak that appears across the capacitor.",
  [
    component("c1", "vsource_sine", [8, 20], { value: 1, params: { offset: 0, frequency: "5k", ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c2", "resistor", [16, 18], { value: 100, label: { text: "R1", offset: [0, -3] } }),
    component("c3", "inductor", [26, 18], { value: "10m", label: { text: "L1", offset: [0, -3] } }),
    component("c4", "capacitor", [34, 20], { value: "100n", rot: 90, label: { text: "C1", offset: [4, 0] } }),
    ground("c5", [8, 26]), ground("c6", [34, 26]),
  ],
  [
    wire("w1", [[8, 18], [14, 18]], "vin"),
    wire("w2", [[18, 18], [24, 18]], "rl"),
    wire("w3", [[28, 18], [34, 18]], "vout"),
    wire("w4", [[34, 22], [34, 26]]),
    wire("w5", [[8, 22], [8, 26]]),
  ],
  [probe("p1", "w3", TRACE_A), probe("p2", "w1", TRACE_B)],
  "ac",
  { ac: { fstart: 100, fstop: 1_000_000, pointsPerDecade: 40, sweep: "dec" } },
));
examples.set("halfwave-rectifier", base(
  "Half-wave rectifier",
  "One diode passes only the positive half of a 10 V, 50 Hz sine into a 1 kΩ load, so the transient run shows one hump per cycle minus the forward drop.",
  [
    component("c1", "vsource_sine", [8, 20], { value: 10, params: { offset: 0, frequency: 50, ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c2", "diode", [18, 18], { rot: 270, label: { text: "D1", offset: [0, -3] } }),
    component("c3", "resistor", [28, 20], { value: "1k", rot: 90, label: { text: "RL", offset: [4, 0] } }),
    ground("c4", [8, 26]), ground("c5", [28, 26]),
  ],
  [
    wire("w1", [[8, 18], [16, 18]], "vin"),
    wire("w2", [[20, 18], [28, 18]], "vout"),
    wire("w3", [[28, 22], [28, 26]]),
    wire("w4", [[8, 22], [8, 26]]),
  ],
  [probe("p1", "w2", TRACE_A), probe("p2", "w1", TRACE_B)],
  "tran",
  { tran: { tstop: 0.06, tstep: 0.00002, maxstep: 0.00005 } },
));
examples.set("bridge-rectifier", base(
  "Full-wave bridge rectifier",
  "Four diodes rectify both halves of a floating 12 V, 50 Hz supply into a 1 kΩ load, so the transient run shows two humps per input cycle.",
  [
    component("c1", "vsource_sine", [34, 20], { value: 12, rot: 90, params: { offset: 0, frequency: 50, ac: 1 }, label: { text: "VAC", offset: [0, -4] } }),
    component("c2", "diode", [24, 12], { rot: 180, label: { text: "D1", offset: [-4, 0] } }),
    component("c3", "diode", [44, 12], { rot: 180, label: { text: "D2", offset: [4, 0] } }),
    component("c4", "diode", [24, 28], { rot: 180, label: { text: "D3", offset: [-4, 0] } }),
    component("c5", "diode", [44, 28], { rot: 180, label: { text: "D4", offset: [4, 0] } }),
    component("c6", "resistor", [56, 20], { value: "1k", rot: 90, label: { text: "RL", offset: [4, 0] } }),
    ground("c7", [34, 34]),
  ],
  [
    wire("w1", [[24, 14], [24, 20], [24, 26]], "a"),
    wire("w2", [[44, 14], [44, 20], [44, 26]], "b"),
    wire("w3", [[24, 10], [44, 10], [56, 10], [56, 18]], "vout"),
    wire("w4", [[24, 30], [34, 30], [44, 30], [56, 30], [56, 22]]),
    wire("w5", [[32, 20], [24, 20]]),
    wire("w6", [[36, 20], [44, 20]]),
    wire("w7", [[34, 30], [34, 34]]),
  ],
  [probe("p1", "w3", TRACE_A), probe("p2", "w1", TRACE_B)],
  "tran",
  { tran: { tstop: 0.06, tstep: 0.00002, maxstep: 0.00005 } },
));
examples.set("inverting-opamp", base(
  "Inverting op-amp",
  "A 10 kΩ input and 100 kΩ feedback resistor set a gain of -10, so the transient run shows the output inverted and ten times larger than the input.",
  [
    component("c1", "vsource_sine", [8, 24], { value: "500m", params: { offset: 0, frequency: "1k", ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c2", "resistor", [18, 22], { value: "10k", label: { text: "RIN", offset: [0, -3] } }),
    component("c3", "resistor", [34, 30], { value: "100k", label: { text: "RF", offset: [0, -3] } }),
    component("c4", "opamp_ideal", [34, 20], { label: { text: "U1", offset: [0, -4] } }),
    component("c5", "resistor", [48, 24], { value: "10k", rot: 90, label: { text: "RL", offset: [4, 0] } }),
    ground("c6", [8, 30]), ground("c7", [30, 12]), ground("c8", [48, 30]),
  ],
  [
    wire("w1", [[8, 22], [16, 22]], "vin"),
    wire("w2", [[20, 22], [26, 22], [30, 22]], "inv"),
    wire("w3", [[26, 22], [26, 30], [32, 30]]),
    wire("w4", [[38, 20], [42, 20], [42, 30], [36, 30]], "vout"),
    wire("w5", [[42, 20], [48, 20], [48, 22]]),
    wire("w6", [[48, 26], [48, 30]]),
    wire("w7", [[30, 18], [30, 12]]),
    wire("w8", [[8, 26], [8, 30]]),
  ],
  [probe("p1", "w4", TRACE_A), probe("p2", "w1", TRACE_B)],
  "tran",
  { tran: { tstop: 0.005, tstep: 0.000002, maxstep: 0.000005 } },
));
examples.set("common-emitter-amp", base(
  "2N3904 common-emitter amplifier",
  "A biased 2N3904 stage provides inverting small-signal gain and clips under the configured 350 mV transient drive.",
  [
    component("c1", "vsource", [12, 16], { value: 5, label: { text: "VCC", offset: [-5, 0] } }),
    component("c2", "vsource_sine", [8, 28], { value: "350m", params: { offset: 0, frequency: "1k", ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c3", "capacitor", [16, 26], { value: "1u", label: { text: "CIN", offset: [0, -3] } }),
    component("c4", "resistor", [24, 18], { value: "56k", rot: 90, label: { text: "R1", offset: [4, 0] } }),
    component("c5", "resistor", [24, 26], { value: "12k", rot: 90, label: { text: "R2", offset: [4, 0] } }),
    component("c6", "resistor", [40, 12], { value: "10k", rot: 90, label: { text: "RC", offset: [4, 0] } }),
    component("c7", "bjt_npn", [38, 22], { mpn: "2N3904", params: { catalogPartId: "onsemi/2N3904" }, label: { text: "Q1", offset: [5, 0] } }),
    component("c8", "resistor", [40, 30], { value: "1k", rot: 90, label: { text: "RE", offset: [4, 0] } }),
    component("c9", "capacitor", [48, 18], { value: "1u", label: { text: "COUT", offset: [0, -3] } }),
    component("c10", "resistor", [54, 24], { value: "100k", rot: 90, label: { text: "RL", offset: [4, 0] } }),
    ground("c11", [12, 18]), ground("c12", [8, 30]), ground("c13", [24, 28]), ground("c14", [40, 32]), ground("c15", [54, 26]),
  ],
  [
    wire("w1", [[12, 14], [12, 10], [24, 10], [40, 10]]),
    wire("w2", [[8, 26], [14, 26]]), wire("w3", [[18, 26], [22, 26], [22, 22], [36, 22]]),
    wire("w4", [[24, 16], [24, 10]]), wire("w5", [[24, 20], [24, 22]]), wire("w6", [[24, 24], [24, 22]]),
    wire("w7", [[40, 14], [40, 18]]), wire("w8", [[40, 25], [40, 28]]),
    wire("w9", [[40, 18], [46, 18]]), wire("w10", [[50, 18], [54, 18], [54, 22]]),
    wire("migration-v1-v2-1", [[40, 19], [40, 18]]),
    wire("w11", [[12, 18], [12, 18]]), wire("w12", [[8, 30], [8, 30]]), wire("w13", [[24, 28], [24, 28]]), wire("w14", [[40, 32], [40, 32]]), wire("w15", [[54, 26], [54, 26]]),
  ],
  [probe("p1", "w2", TRACE_A), probe("p2", "w10", TRACE_B)],
  "ac",
  { tran: { tstop: 0.006, tstep: 0.000002, maxstep: 0.00001 }, ac: { fstart: 10, fstop: 10_000_000, pointsPerDecade: 35, sweep: "dec" } },
));
examples.set("mosfet-led-switch", base(
  "IRLZ44N logic-level LED switch",
  "A 3.3 V pulse drives an IRLZ44N low-side switch through its threshold while a three-LED strip load reveals the switching transient.",
  [
    component("c1", "vsource", [10, 14], { value: 12, label: { text: "12 V", offset: [-5, 0] } }),
    component("c2", "vsource_pulse", [12, 26], { value: 3.3, params: { v1: 0, v2: 3.3, delay: "500u", rise: "10u", fall: "10u", width: "2m", period: "4m" }, label: { text: "GPIO", offset: [-5, 0] } }),
    component("c3", "resistor", [34, 24], { value: 100, label: { text: "RG", offset: [0, -3] } }),
    component("c4", "resistor", [44, 30], { value: "100k", rot: 90, label: { text: "RPD", offset: [4, 0] } }),
    component("c5", "resistor", [52, 8], { value: 330, rot: 90, label: { text: "RSTRIP", offset: [5, 0] } }),
    component("c6", "led", [52, 12], { label: { text: "LED1", offset: [5, 0] } }),
    component("c7", "led", [52, 16], { label: { text: "LED2", offset: [5, 0] } }),
    component("c8", "led", [52, 20], { label: { text: "LED3", offset: [5, 0] } }),
    component("c9", "nmos", [50, 26], { mpn: "IRLZ44N", params: { catalogPartId: "infineon/IRLZ44N" }, label: { text: "Q1", offset: [5, 0] } }),
    ground("c10", [10, 16]), ground("c11", [12, 28]), ground("c12", [44, 32]), ground("c13", [52, 30]),
  ],
  [
    wire("w1", [[10, 12], [10, 6], [52, 6]]), wire("w2", [[12, 24], [32, 24]]),
    wire("w3", [[36, 24], [44, 24], [44, 26], [48, 26]]), wire("w4", [[44, 28], [44, 26]]),
    wire("w5", [[52, 10], [52, 10]]), wire("w6", [[52, 14], [52, 14]]), wire("w7", [[52, 18], [52, 18]]), wire("w8", [[52, 22], [52, 22]]),
    wire("w9", [[10, 16], [10, 16]]), wire("w10", [[12, 28], [12, 28]]), wire("w11", [[44, 32], [44, 32]]), wire("w12", [[52, 30], [52, 30]]),
    wire("migration-v1-v2-1", [[52, 23], [52, 22]]), wire("migration-v1-v2-2", [[52, 29], [52, 30]]),
  ],
  [probe("p1", "w3", TRACE_A), probe("p2", "w8", TRACE_B)],
  "tran",
  { tran: { tstop: 0.008, tstep: 0.000002, maxstep: 0.00001 }, ac: { fstart: 10, fstop: 1_000_000, pointsPerDecade: 30, sweep: "dec" } },
));
examples.set("opamp-noninverting", base(
  "TL072 non-inverting amplifier",
  "A TL072 on ±15 V rails amplifies the sine input by eleven in both transient and AC analysis.",
  [
    component("c1", "vsource", [10, 12], { value: 15, label: { text: "+15 V", offset: [-5, 0] } }),
    component("c2", "vsource", [10, 24], { value: -15, label: { text: "-15 V", offset: [-5, 0] } }),
    component("c3", "vsource_sine", [10, 34], { value: 1, params: { offset: 0, frequency: "10k", ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c4", "opamp_ideal", [40, 20], { mpn: "TL072", params: { catalogPartId: "ti/TL072", catalogSupplyBindings: { vcc: ["c1", 0], vee: ["c2", 0] } }, label: { text: "U1A", offset: [0, -4] } }),
    component("c5", "resistor", [40, 28], { value: "100k", label: { text: "RF", offset: [0, -3] } }),
    component("c6", "resistor", [34, 34], { value: "10k", rot: 90, label: { text: "RG", offset: [4, 0] } }),
    component("c7", "resistor", [50, 24], { value: "10k", rot: 90, label: { text: "RL", offset: [4, 0] } }),
    ground("c8", [10, 14]), ground("c9", [10, 26]), ground("c10", [10, 36]), ground("c11", [34, 36]), ground("c12", [50, 26]),
  ],
  [
    wire("w1", [[10, 32], [30, 32], [30, 18], [36, 18]]),
    wire("w2", [[36, 22], [34, 22], [34, 28], [34, 32]]), wire("w3", [[34, 28], [38, 28]]),
    wire("w4", [[42, 28], [48, 28], [48, 20], [44, 20]]), wire("w5", [[44, 20], [50, 20], [50, 22]]),
    wire("w6", [[10, 14], [10, 14]]), wire("w7", [[10, 26], [10, 26]]), wire("w8", [[10, 36], [10, 36]]), wire("w9", [[34, 36], [34, 36]]), wire("w10", [[50, 26], [50, 26]]),
  ],
  [probe("p1", "w1", TRACE_A), probe("p2", "w5", TRACE_B)],
  "tran",
  { tran: { tstop: 0.0005, tstep: 0.0000001, maxstep: 0.0000005 }, ac: { fstart: 10, fstop: 10_000_000, pointsPerDecade: 40, sweep: "dec" } },
));

/**
 * Goldens for the shipped bench and for every example authored in this
 * repository live beside the app. The `packages/circuit-schema` fixtures stay
 * pinned to their v1 migration inputs and are never rewritten from here.
 */
const APP_OWNED_GOLDENS = new Set([
  "transistor-led-bench", "rc-filter-bode", "mosfet-led-switch", "opamp-noninverting",
  "resistive-divider", "led-current-limit", "rlc-resonance", "halfwave-rectifier",
  "bridge-rectifier", "inverting-opamp",
]);

await mkdir(appFixtures, { recursive: true });
for (const [id, document] of examples) {
  await writeFile(resolve(root, `${id}.json`), `${canonicalizeCircuit(document)}\n`);
  if (!APP_OWNED_GOLDENS.has(id)) continue;
  const migrated = migrateCircuit(structuredClone(document));
  await writeFile(resolve(appFixtures, `example-${id}.netlist`), generateNetlist(migrated).netlist);
}
await writeFile(resolve(appFixtures, "demo.netlist"), generateNetlist(structuredClone(demoCircuit)).netlist);

const urls = ["# Example share URLs", "", "These URLs use the simulator's deterministic compressed project payload.", ""];
for (const [id, document] of examples) urls.push(`- ${id}: http://127.0.0.1:4173/#c=${encodeCircuit(document)}`);
await writeFile(resolve(root, "URLS.md"), `${urls.join("\n")}\n`);
console.log(`Wrote ${examples.size} canonical examples, ${APP_OWNED_GOLDENS.size + 1} golden netlists and URLS.md`);
