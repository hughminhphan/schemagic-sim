import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, strToU8 } from "fflate";
import { canonicalizeCircuit } from "../../packages/circuit-schema/dist/src/canonical.js";
import { demoCircuit } from "../../apps/web/src/demo.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const encodeCircuit = (document) => {
  const bytes = deflateSync(strToU8(canonicalizeCircuit(document)), { level: 9 });
  return Buffer.from(bytes).toString("base64url");
};
const component = (id, type, pos, options = {}) => ({ id, type, pos, rot: 0, mirror: false, ...options });
const wire = (id, points) => ({ id, points });
const ground = (id, pos) => component(id, "ground", pos);
const base = (title, description, components, wires, probes, mode, sim = {}) => ({
  format: "opencircuit-circuit",
  version: 1,
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
  "A 1 kΩ and 100 nF low-pass filter shows its 1.59 kHz corner in AC analysis.",
  [
    component("c1", "vsource_sine", [8, 20], { value: 1, params: { offset: 0, frequency: "1k", ac: 1 }, label: { text: "VIN", offset: [-5, 0] } }),
    component("c2", "resistor", [18, 18], { value: "1k", label: { text: "R1", offset: [0, -3] } }),
    component("c3", "capacitor", [26, 20], { value: "100n", rot: 90, label: { text: "C1", offset: [4, 0] } }),
    ground("c4", [8, 22]), ground("c5", [26, 22]),
  ],
  [wire("w1", [[8, 18], [16, 18]]), wire("w2", [[20, 18], [26, 18]]), wire("w3", [[8, 22], [8, 22]]), wire("w4", [[26, 22], [26, 22]])],
  [
    { id: "p1", kind: "voltage", target: { wire: "w1" }, color: "#3987e5" },
    { id: "p2", kind: "voltage", target: { wire: "w2" }, color: "#d95926" },
  ],
  "ac",
  { ac: { fstart: 10, fstop: 1_000_000, pointsPerDecade: 40, sweep: "dec" } },
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
    wire("w7", [[40, 14], [40, 18]]), wire("w8", [[40, 26], [40, 28]]),
    wire("w9", [[40, 18], [46, 18]]), wire("w10", [[50, 18], [54, 18], [54, 22]]),
    wire("w11", [[12, 18], [12, 18]]), wire("w12", [[8, 30], [8, 30]]), wire("w13", [[24, 28], [24, 28]]), wire("w14", [[40, 32], [40, 32]]), wire("w15", [[54, 26], [54, 26]]),
  ],
  [
    { id: "p1", kind: "voltage", target: { wire: "w2" }, color: "#3987e5" },
    { id: "p2", kind: "voltage", target: { wire: "w10" }, color: "#d95926" },
  ],
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
    component("c6", "led", [52, 12], { mpn: "WP7113ID", params: { catalogPartId: "kingbright/WP7113ID" }, label: { text: "LED1", offset: [5, 0] } }),
    component("c7", "led", [52, 16], { mpn: "WP7113ID", params: { catalogPartId: "kingbright/WP7113ID" }, label: { text: "LED2", offset: [5, 0] } }),
    component("c8", "led", [52, 20], { mpn: "WP7113ID", params: { catalogPartId: "kingbright/WP7113ID" }, label: { text: "LED3", offset: [5, 0] } }),
    component("c9", "nmos", [50, 26], { mpn: "IRLZ44N", params: { catalogPartId: "infineon/IRLZ44N" }, label: { text: "Q1", offset: [5, 0] } }),
    ground("c10", [10, 16]), ground("c11", [12, 28]), ground("c12", [44, 32]), ground("c13", [52, 30]),
  ],
  [
    wire("w1", [[10, 12], [10, 6], [52, 6]]), wire("w2", [[12, 24], [32, 24]]),
    wire("w3", [[36, 24], [44, 24], [44, 26], [48, 26]]), wire("w4", [[44, 28], [44, 26]]),
    wire("w5", [[52, 10], [52, 10]]), wire("w6", [[52, 14], [52, 14]]), wire("w7", [[52, 18], [52, 18]]), wire("w8", [[52, 22], [52, 22]]),
    wire("w9", [[10, 16], [10, 16]]), wire("w10", [[12, 28], [12, 28]]), wire("w11", [[44, 32], [44, 32]]), wire("w12", [[52, 30], [52, 30]]),
  ],
  [
    { id: "p1", kind: "voltage", target: { wire: "w3" }, color: "#3987e5" },
    { id: "p2", kind: "voltage", target: { wire: "w8" }, color: "#d95926" },
  ],
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
    wire("w2", [[36, 22], [34, 22], [34, 32]]), wire("w3", [[34, 28], [38, 28]]),
    wire("w4", [[42, 28], [48, 28], [48, 20], [44, 20]]), wire("w5", [[44, 20], [50, 20], [50, 22]]),
    wire("w6", [[10, 14], [10, 14]]), wire("w7", [[10, 26], [10, 26]]), wire("w8", [[10, 36], [10, 36]]), wire("w9", [[34, 36], [34, 36]]), wire("w10", [[50, 26], [50, 26]]),
  ],
  [
    { id: "p1", kind: "voltage", target: { wire: "w1" }, color: "#3987e5" },
    { id: "p2", kind: "voltage", target: { wire: "w5" }, color: "#d95926" },
  ],
  "tran",
  { tran: { tstop: 0.0005, tstep: 0.0000001, maxstep: 0.0000005 }, ac: { fstart: 10, fstop: 10_000_000, pointsPerDecade: 40, sweep: "dec" } },
));

for (const [id, document] of examples) {
  await writeFile(resolve(root, `${id}.json`), `${canonicalizeCircuit(document)}\n`);
}

const urls = ["# Example share URLs", "", "These URLs use the simulator's deterministic compressed project payload.", ""];
for (const [id, document] of examples) urls.push(`- ${id}: http://127.0.0.1:4173/#c=${encodeCircuit(document)}`);
await writeFile(resolve(root, "URLS.md"), `${urls.join("\n")}\n`);
console.log(`Wrote ${examples.size} canonical examples and URLS.md`);
