# Shared architecture contracts (DRAFT until P0 gate; frozen after)

Status: DRAFT v0.3 — sections marked [PENDING-SPIKE] finalize when spike reports land.
Owner: orchestrator. Implementation agents adapt to this file; they do not edit it.

## 1. Repository layout

apps/web/                 Vite + TypeScript single-page app (the product; also the landing page)
packages/circuit-schema/  Circuit document types, validation, (de)serialization, migrations
packages/schematic-editor/ Canvas editor (SVG-based), interaction, undo/redo
packages/sim-engine/      Worker host + ngspice-WASM wrapper + netlist generation + raw parsing
packages/waveform-viewer/ Scope, Bode, cursors, CSV export
packages/component-schema/ component.json / sources.json / expectations.json schemas + validators
packages/model-library/   Shipped component model packages (models/<manufacturer>/<mpn>/)
packages/model-validation/ Test-bench runner: native vs WASM vs expectations
tools/model-factory/      Datasheet-facts extraction + fitting (Python) + generation pipeline
tools/native-ngspice-reference/  Pinned native runner + comparison harness
tools/screenshot-tests/   Playwright visual checkpoints
examples/                 Example circuit JSON files (the 5+ polished demos)
docs/                     Architecture, contributing-adjacent docs
public/                   Static assets (self-hosted fonts, icons, social preview)

Monorepo: npm workspaces (no pnpm on this machine). TypeScript strict. Vite build; fully static output.

## 2. Circuit document (deterministic serialization)

Top-level JSON, version-stamped:

{
  "format": "opencircuit-circuit",
  "version": 1,
  "meta": { "title": string, "description"?: string },
  "components": [Component...],   // sorted by id
  "wires": [Wire...],             // sorted by id
  "probes": [Probe...],           // sorted by id
  "sim": SimConfig,
  "view"?: { "pan": [x,y], "zoom": number }   // excluded from share-URL hash equality
}

- IDs: monotonically assigned strings "c1","c2"... "w1"... "p1"...; never reused within a document; renumbering only via explicit normalize step.
- Grid: integer coordinate lattice, 1 unit = 8 css px at zoom 1. All pins and wire vertices lie on lattice points. Rotation ∈ {0,90,180,270}; mirror ∈ {false,true}.
- Component: { id, type, mpn?: string, value?: number|string, params?: object (sorted keys), pos: [x,y], rot, mirror, label?: {text, offset} }.
  - type is the GENERIC electrical type (resistor, capacitor, vsource, ground, led, bjt_npn, ...). mpn present => a real part from model-library; absent => parametric generic.
- Wire: { id, points: [[x,y],...] } orthogonal polyline; junction dots derived, not stored.
- Probe: { id, kind: "voltage"|"current"|"diff", target: {node|componentPin|wire}, color?: paletteToken }.
- SimConfig: { mode: "live"|"op"|"tran"|"ac", tran?: {tstop, tstep?, maxstep?}, ac?: {fstart, fstop, pointsPerDecade, sweep:"dec"} }.
- Serialization: JSON.stringify with sorted object keys everywhere, arrays in id order, no floating noise (numbers round-tripped via canonical formatter, ≤ 12 significant digits). Same document => byte-identical string. This string is the undo/redo snapshot unit and the share-URL payload.

## 3. Electrical graph and netlist generation

- Node identification: union-find over wire endpoints + component pins at identical lattice points. Ground symbol pins join node 0. Exactly one net may be node 0; a circuit with no ground gets an actionable error (not silent).
- Net names: "n<k>" assigned by deterministic traversal (sorted by lowest connected component id, then pin index). Same circuit => same netlist bytes.
- Netlist header comment carries document hash. Generic components map to SPICE primitives; mpn components emit `.include`-equivalent inline subckt from model-library (subckt names namespaced OC_<MANUFACTURER>_<MPN>).
- Potentiometer: two resistors from one wiper parameter t ∈ [0.005, 0.995] (clamped; never 0/1 to avoid singular matrices).
- Switch: ideal on = 1 mΩ resistor, off = 1 GΩ (documented honesty note in UI).
- Every generated netlist ends with explicit analysis + output commands; no interactive .control loops in v1 [PENDING-SPIKE: exact output capture mechanism].

## 4. Simulation worker protocol [PENDING-SPIKE: engine API]

- sim-engine runs entirely in a dedicated Web Worker (module worker). Main thread posts { runId, netlist, analysis, limits }, worker replies streaming { runId, status } then { runId, result } with Float64Array transferables (vectors: time/freq + per-variable arrays).
- Cancellation: bumping runId invalidates in-flight runs; if the engine cannot abort cooperatively within 250 ms the worker is terminated and re-instantiated (pre-warmed spare instance to hide latency).
- Limits (hard): wall-clock 10 s per run (live mode 0.5 s), output points ≤ 200k per variable, WASM memory cap per instantiation. Exceeding => structured error, never a hung UI.
- Errors: worker parses ngspice stderr into { stage, message, netLine?, componentId? } using the netlist line map emitted at generation time. Every user-visible sim error links to a component or the sim settings.
- Untrusted model input: imported .model/.subckt/.lib/.cir are parsed and sanitized before inclusion; command cards (.control, .shell, .load, file I/O, .include of absolute paths) are stripped/rejected with a visible notice. The WASM sandbox has no host FS access beyond its MEMFS.

## 5. Live visualization semantics

- Re-simulate on topology/value/control change (debounced ~30 ms), never per animation frame. Animation replays the latest result.
- Live mode = repeated op-point solves on parameter drag (target ≤ 50 ms per solve for the vertical-slice circuit).
- Wire colour = node voltage via the design-pass ramp [PENDING-SPIKE: exact ramp]; current pulses: density ∝ log-clamped |I|, direction = conventional current; below 1 µA no pulses, above clamp ceiling saturate speed, both thresholds visible in a legend. prefers-reduced-motion => static arrows + magnitude labels instead of motion.
- Precision honesty: displayed values round to 3 significant digits by default; hover shows more; never render more digits than the engine tolerance justifies.

## 6. Share URLs and persistence

- Share URL: #c=<base64url(deflate-raw(canonical JSON))>. No database. If > ~8 kB compressed, UI offers file export instead (URL still works, just long).
- Autosave: IndexedDB, keyed workspace, most-recent-first list; also "download project JSON" and "load JSON".
- The app is a PWA-lite: service worker precaches app shell + WASM for offline after first load; no push, no background sync.

## 7. Agent working rules (repeat of ORCHESTRATION.md)

- One package = one owner at a time. The integration agent (orchestrator-directed) is the only one who edits shared contracts or merges cross-package changes.
- All copy: no em dashes. All model packages: schema-valid, no PDFs, no restricted vendor models, reviewer ≠ author.
