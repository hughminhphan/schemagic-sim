# Shared architecture contracts (DRAFT until P0 gate; frozen after)

Status: FROZEN v1.0 (P0 gate passed 2026-08-06). Changes require an orchestrator commit.
Owner: orchestrator. Implementation agents adapt to this file; they do not edit it.

## 0. Engine decision (from spikes/engine/REPORT.md, verified)

- Engine: ngspice as WebAssembly, EEcircuit Asyncify+MEMFS integration pattern.
- Interim dependency for Phase 1-2: `eecircuit-engine@1.7.0` (MIT wrapper around ngspice-45.2+). We ship our own THIRD_PARTY_NOTICES covering ngspice BSD, SPARSE, KLU/numparam LGPL, Emscripten, because the upstream tarball omits them.
- Before v0.1.0: build our own pinned ngspice-46 artifact (configure/emcc profile in the spike report), excluding XSPICE, OSDI, CIDER, tclspice; include KLU + numparam with full LGPL corresponding-source and relink materials. Rerun the spike harness against it.
- Measured baseline: op/tran/AC agree with native ngspice-46 to float noise; warm repeated op-point ~1 ms; proof bundle 5.75 MB gzip (custom build will slim this).

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

Top-level JSON, version-stamped. The `format` value below is a frozen persisted identifier from an early working name. It is not the product name, which is Robonyx; see the naming section in the [root README](../README.md).

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
- SimConfig: { mode: "live"|"op"|"dc-sweep"|"tran"|"ac"|"noise", tran?: {tstop, tstep?, maxstep?}, ac?: {fstart, fstop, pointsPerDecade, sweep:"dec"}, dcSweep?: {sourceId, start, stop, step, secondary?: {sourceId, start, stop, step}}, noise?: {outputProbeId, inputSourceId, fstart, fstop, pointsPerDecade, sweep:"dec", temperatureC} }. DC sweep ranges are linear, must have a non-zero span and a step whose sign moves from start toward stop, and are capped at 50,000 total points across both sweep dimensions. Noise analysis requires a voltage output probe, an independent V/I input reference source, positive decade frequency bounds with fstop > fstart, a positive integer resolution, and a temperature above absolute zero.
- Serialization: JSON.stringify with sorted object keys everywhere, arrays in id order, no floating noise (numbers round-tripped via canonical formatter, ≤ 12 significant digits). Same document => byte-identical string. This string is the undo/redo snapshot unit and the share-URL payload.

## 3. Electrical graph and netlist generation

- Node identification: union-find over wire endpoints + component pins at identical lattice points. Ground symbol pins join node 0. Exactly one net may be node 0; a circuit with no ground gets an actionable error (not silent).
- Net names: "n<k>" assigned by deterministic traversal (sorted by lowest connected component id, then pin index). Same circuit => same netlist bytes.
- Netlist header comment carries document hash. Generic components map to SPICE primitives; mpn components emit `.include`-equivalent inline subckt from model-library (subckt names namespaced OC_<MANUFACTURER>_<MPN>).
- Potentiometer: two resistors from one wiper parameter t ∈ [0.005, 0.995] (clamped; never 0/1 to avoid singular matrices).
- Switch: ideal on = 1 mΩ resistor, off = 1 GΩ (documented honesty note in UI).
- Every generated netlist ends with explicit analysis + output commands; no interactive `.control` blocks are accepted from circuit documents. DC sweep generation emits `.dc <primary> <start> <stop> <step> [<secondary> <start> <stop> <step>]` for independent V/I sources selected by circuit component id. Noise generation emits `.temp <temperatureC>` and `.noise V(<output-node>) <input-source> dec <points-per-decade> <fstart> <fstop>`. The chosen input source receives an internal `AC 1` magnitude so users do not need to configure it. Other ideal independent sources remain noiseless.

## 4. Simulation worker protocol (FROZEN, per engine spike)

- sim-engine runs entirely in a dedicated module Web Worker. One request at a time; a new request replaces any queued-not-started one. Engine initializes once and is reused; `destroy all` + rawfile cleanup between runs.
- Request: { id, type: "runOpPoint"|"runDCSweep"|"runTransient"|"runAC"|"runNoise", netlist, limits?, sweep?, noise? }. `runDCSweep` requires `sweep: {primary: DCSweepSourceSpec, secondary?: DCSweepSourceSpec}` where each source spec is `{componentId, name, unit:"V"|"A", start, stop, step}`. `runNoise` requires `noise: {output:{probeId,positiveNode,negativeNode:"0"}, input:{componentId,name,unit:"V"|"A"}, frequency:{sweep:"dec",pointsPerDecade,fstart,fstop}, temperatureC}`. Response: { id, type:"ready"|"result"|"error" }; results carry VectorMeta[] + transferred ArrayBuffers (Float64; AC = interleaved re/im). Errors: code ∈ PARSE|CONVERGENCE|LIMIT|ENGINE|CANCELLED plus component-linked diagnostics.
- DC sweep result: the first raw vector is normalized to `{name:"sweep", kind:"sweep"}` and transferred like every other real Float64 vector. Probe vectors remain flattened in ngspice point order. The result adds `sweep: {axisVector:"sweep", primary, secondary?, segments:[{startIndex,length,secondaryValue?}]}`. A one-source sweep has one segment. A two-source sweep has one segment per secondary value, with each segment selecting the matching primary-axis and per-probe slices. This keeps the sweep axis, per-probe vectors, and stepped-family metadata explicit without duplicating buffers.
- Noise result: the spectral-density plot transfers `{frequency, onoise_spectrum, inoise_spectrum}` as real Float64 vectors. `onoise_spectrum` is output voltage amplitude spectral density in V/√Hz. `inoise_spectrum` is input-referred amplitude spectral density in V/√Hz for a voltage reference source or A/√Hz for a current reference source. The result metadata carries the output probe and source assumptions, analyzed band, points per decade, and temperature. ngspice `onoise_total` and `inoise_total` are integrated RMS amplitudes over the band: output is V, while input-referred is V for a voltage reference or A for a current reference; the schema also carries `meanSquare = rms²` in V² or A².
- Output transport: ngspice BINARY rawfiles are parsed in the worker (validate header counts and byte length before allocating). Noise reads both ngspice plots, `noise1` for density and `noise2` for integrated totals. `wrdata` is only for debugging.
- Cancellation/timeout: terminate the Worker, reject as CANCELLED, spawn and warm a fresh Worker (pre-warmed spare hides latency).
- Hard limits: netlist ≤ 1 MiB; rawfile ≤ 128 MiB; ≤ 1M total samples; WASM MAXIMUM_MEMORY 256 MiB; warm interactive op timeout 2 s; tran/AC default 10 s. Includes resolve only through a controlled virtual include map; no host or network file access. Exceeding => structured error, never a hung UI.
- Errors: worker parses ngspice stderr into { stage, message, netLine?, componentId? } using the netlist line map emitted at generation time. Every user-visible sim error links to a component or the sim settings.
- Untrusted model input: imported .model/.subckt/.lib/.cir are parsed and sanitized before inclusion; command cards (.control, .shell, .load, file I/O, .include of absolute paths) are stripped/rejected with a visible notice. The WASM sandbox has no host FS access beyond its MEMFS.

## 5. Live visualization semantics

- Re-simulate on topology/value/control change (debounced ~30 ms), never per animation frame. Animation replays the latest result.
- Live mode = repeated op-point solves on parameter drag (target ≤ 50 ms per solve for the vertical-slice circuit).
- Wire colour = node voltage via the FROZEN design ramp (spikes/design/DIRECTION.md): isoluminant OKLCH L 0.62, hue 245 (Probe Blue, negative) / 62 (Rail Amber, positive), chroma C = Cmax*|t|^1.25 with Cmax 0.140 amber / 0.152 blue (amended 2026-08-07 per docs/design-critique.md; contrast verified >= 3.10:1 on Vellum, >= 4.68:1 on Graphite), Graphite 500 #6E7378 at 0 V; sign redundantly encoded by stroke pattern (solid positive, dashed 8-4 negative, hairline+glyph at 0), always on. Current has NO hue, only motion: log pulse law over 4 decades, velocity 12-108 px/s, spacing 34-18 px, alpha 0.25-0.70, nothing below 1 µA. prefers-reduced-motion => quantised stroke-width ladder + static chevrons (identical to SVG export encoding).
- Palette/type tokens: Vellum #F1EEE8 canvas, Graphite 900 #15181B ink, Phosphor Green #1B9350 run-state only, Fault Red #C44A32 hatch/glyph only. Type: IBM Plex Sans (UI), IBM Plex Mono (all values, tabular), Archivo Expanded 600 (wordmark only), self-hosted. Hard bans: no non-data gradients/shadows/blur, no pills/cards (radius 0, 2 px on inputs only), semantic hues never used as text colour.
- Precision honesty: displayed values round to 3 significant digits by default; hover shows more; never render more digits than the engine tolerance justifies.

## 6. Share URLs and persistence

- Share URL: #c=<base64url(deflate-raw(canonical JSON))>. No database. If > ~8 kB compressed, UI offers file export instead (URL still works, just long).
- Autosave: IndexedDB, keyed workspace, most-recent-first list; also "download project JSON" and "load JSON".
- The app is a PWA-lite: service worker precaches app shell + WASM for offline after first load; no push, no background sync.

## 7. Agent working rules

- One package = one owner at a time. The integration agent (orchestrator-directed) is the only one who edits shared contracts or merges cross-package changes.
- All copy: no em dashes. All model packages: schema-valid, no PDFs, no restricted vendor models, reviewer ≠ author.
