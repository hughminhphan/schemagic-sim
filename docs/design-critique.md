# Post-implementation design critique

Owner: visual critique lane. Scope of this document: `docs/design-critique.md` only. Everything else was read-only.
Judged against `spikes/design/DIRECTION.md` (FINAL DIRECTION section, the frozen contract), `docs/CONTRACTS.md` section 5, and the product premise: the first screen must read as alive within five seconds while staying a credible instrument.

## Verdict

**NO-GO for launching the visuals as they stand.**

Not because the design is wrong. The design contract is good and the shell that implements it is close to correct: layout, radius discipline, palette tokens, vocabulary and type stack are all largely as specified. The problem is that the three things that make the product's claim true do not reach the screen at all:

1. Wire voltage colour is computed correctly, then painted onto an element that cannot show it. Every wire renders Graphite 500 grey.
2. Every branch current resolves to `undefined` because of a vector-name mismatch, so no pulse ever animates, the LED never lights, and every current readout shows a placeholder.
3. The potentiometer cannot be swept. The on-canvas knob does not exist and the inspector slider is destroyed mid-drag by a re-render.

The result is a static grey schematic with a black empty box under it. Three of the four blockers are small, mechanical, and independent. This is a half day of work, not a redesign.

## Method and evidence

Built from `apps/web` at commit `3f91d10`, served with `npx vite preview --port 4631`, driven in Playwright Chromium at 1440 x 900 and 1280 x 720, device scale factor 2. Commits landing during the review (`b63e073` through `2a665ce`) touch `packages/model-library` only, so every finding below still applies unchanged at `2a665ce`. Colour arithmetic done in OKLab with a WCAG relative-luminance contrast function, not estimated by eye.

Evidence PNGs referenced below live in the capture directory:
`/private/tmp/claude-501/-Users-hughp/20e0dd4c-4db1-4359-a82d-2955aeb10249/scratchpad/critique/`

| File | What it shows |
| --- | --- |
| `01-first-screen.png` | Default bench, 1440 x 900, engine ready |
| `02-wire-zoom-a.png` | The +5 V rail at 2x, showing grey stroke and non-junction dots |
| `04-hover-net.png` | Canvas with the pointer on the +5 V net, no highlight response |
| `07b-scope-dock.png` | TRAN result, five identical y axis labels, clipped cursor row |
| `09-import-dialog.png` | Import sheet with native file control and default blue focus ring |
| `11-reduced-motion.png` | `prefers-reduced-motion: reduce`, no chevrons, no stroke ladder |
| `12-1280x720.png` | Dock correctly starts collapsed under 760 px height |
| `13-fixed-contract-ramp.png` | Paint bug fixed, contract ramp (Cmax 0.117 / 0.121, gamma 1.6) |
| `14-proposed-ramp.png` | Paint bug fixed, proposed ramp (Cmax 0.140 / 0.152, gamma 1.25) |

These files are in a session scratch directory and will not survive. If the record matters, copy them into `spikes/p3-critique/` as part of the fix commit.

## A. First-screen impact inventory

What a first-time visitor actually gets in the first five seconds, from `01-first-screen.png`.

**Seen, and good:**

- A real schematic, drawn in real IEC 60617 symbols, on warm paper with a proper 2.54 mm dot lattice. No hero, no modal, no entrance animation. The contract's hardest bans are respected by construction.
- A chrome strip that says `LIVE DC TRAN AC` in instrument words with a Phosphor Green underline on the active mode.
- `ENGINE READY - ngspice-46 + KLU - 13.8 ms solve` bottom left. This is the single strongest credibility signal on the screen. It is specific, it names the engine, and it quotes a real measured time.
- Live per-pin voltages in the inspector: `+2.30 V`, `+82.6 mV`. Correct engineering notation, correct real glyphs.

**Seen, and wrong:**

- Every wire is the same grey. The circuit is powered, solved and converged, and it looks exactly like a circuit that is not. This is the failure. Nothing on the canvas distinguishes a running simulator from a PNG of a textbook figure.
- Nothing moves. Not slowly, not subtly. Nothing.
- The LED is drawn dark, in a document whose title is "NPN LED bench".
- `C7`, `C8`, `C9` float next to the three ground symbols. Auto-IDs leaking into the drawing is the classic tell of an unfinished tool.
- The bottom 240 px, 27 percent of the window, is a black rectangle containing two competing pieces of empty-state prose and no graticule. A scope with no graticule is not a scope, it is a div.
- The parts rail is a column of letters: `R C L V VP VS I GND S P D LED Q Q M M U`. Two of them are `Q` and two are `M`. The contract says IEC 60617 symbols, and the code already contains the symbol geometry.
- The largest type on the screen is the canvas reference designators at 23.6 px, larger than the wordmark, larger than the inspector heading, larger than anything in the UI.
- Six text buttons crowd the top right, two of which say `Download JSON` and `Load JSON`.

**Ranked fixes for the first screen** (highest impact per unit of work first):

1. F1 wire paint target. One selector. Turns the whole canvas from grey to a voltage map.
2. F2 current vector names. One helper function. Turns on every pulse, the LED halo, and every branch readout at once.
3. F12 scope graticule and single empty state. Removes the black void.
4. F8 ground labels. One conditional.
5. F5 chroma and gamma. Two constants.
6. F10 symbol rail. Reuse of geometry that already exists.
7. F9 label sizing.

## B. Findings

Severity key: **blocker** stops launch, **high** should ship in the same pass, **polish** can follow.

---

### F1. Wire voltage colour is never painted. The entire ramp is invisible.
**Severity: blocker.** Evidence: `01-first-screen.png`, `02-wire-zoom-a.png`, `13-fixed-contract-ramp.png` (same app with the fix applied at runtime).

`SchematicEditor.setWireStyle()` resolves its target with `this.element.querySelector('[data-wire-id="w1"]')`. Both the wrapping `<g class="editor-wire-group">` and the `<path class="editor-wire">` carry `data-wire-id`, and the group comes first in document order, so the inline style lands on the group. `stroke` and `stroke-width` are then inherited down to the path, where the class rule `.editor-wire { stroke: var(--graphite-500); stroke-width: 1.8 }` wins over inheritance. Measured on the live page: every wire's computed stroke is `rgb(110, 115, 120)` and computed width is `1.8px`, for all nine wires, while the group's inline style holds the correct `oklch(0.62 0.117 62)`.

Note the partial failure that hid this: `stroke-dasharray` is not declared in `.editor-wire`, so the dash does inherit. Measured: setting the group dash to `8 4` yields a computed `8px, 4px` on the path. Sign encoding therefore works while magnitude encoding does not, which is the worst possible combination to have shipped, because a negative net looks correctly dashed and every reviewer assumes the colour path is fine too.

The e2e gate at `apps/web/e2e/editor.spec.ts` asserts `oklch` on `.editor-wire-group` inline style, so it passes on a canvas that is entirely grey.

**Fix.** In `packages/schematic-editor/src/index.ts`, `setWireStyle()`:

```ts
const el = this.element.querySelector<SVGPathElement>(`path.editor-wire[data-wire-id="${id}"]`);
```

Leave `setWireCurrent()` alone; it already queries `.editor-wire-group[data-wire-id=...]`, which is correct for the group-level custom properties.

Then, in `apps/web/e2e/editor.spec.ts`, change the readiness predicate to read the painted value so this cannot regress:

```ts
await page.waitForFunction(() => [...document.querySelectorAll<SVGPathElement>("path.editor-wire")]
  .some((w) => getComputedStyle(w).stroke !== "rgb(110, 115, 120)"));
```

---

### F2. Every branch current is `undefined`. The motion layer, the LED and all current readouts are dead.
**Severity: blocker.** Evidence: `01-first-screen.png` (LED dark, `Branch I  -- A`), `04-hover-net.png`.

`packages/circuit-schema/src/netlist.ts` stores raw ngspice save aliases in `componentCurrents`, for example `@d6[id]`, `@q4[ic]`, `v1#branch`, because `.save all @d6[id] ...` requires exactly that spelling. The rawfile that comes back names those vectors differently. Measured by running the shipped netlist through the shipped worker:

```
v(n1)  i(@d6[id])  i(@q4[ic])  i(@r2t[i])  i(@r3[i])  i(@r5[i])  v(n2) ... i(v1)
```

`apps/web/src/main.ts` looks up the raw alias, so `scalar()` misses on every current. Consequences, all measured on the live page: `current-active` is false on all nine wires, `.editor-current` computes to `display: none`, `animation-name: none`, the LED halo stays at `r=3, opacity=0`, and the inspector prints `--` for `Branch I`. The pulse law, the photometric halo and the current readouts are all switched off by one naming mismatch.

The correct names already exist in the repository, in `apps/web/src/schematic.ts`, which is dead code (see F21).

**Fix.** In `apps/web/src/main.ts`, add next to the other helpers at the top of the file:

```ts
const currentVector = (alias: string) =>
  alias.startsWith("@") ? `i(${alias})`
  : alias.endsWith("#branch") ? `i(${alias.slice(0, -7)})`
  : alias;
```

Use it in both consumers:

- `componentCurrent()`: `return name ? scalar(visualResult, currentVector(name)) : undefined;`
- `updateVisuals()`: `current = scalar(visualResult, currentVector(name)) ?? 0;`

Do not change `componentCurrents` itself. Its values are consumed verbatim by the `.save all` line in `netlist.ts` and must stay in ngspice spelling.

Add a unit assertion in `apps/web/src/` covering the mapping: `currentVector("@d6[id]") === "i(@d6[id]")` and `currentVector("v1#branch") === "i(v1)"`.

---

### F3. Wire to branch attribution is arbitrary.
**Severity: high.** Depends on F2 landing first. No standalone screenshot; visible as soon as F2 is fixed.

`updateVisuals()` assigns a wire the current of the first component in document order whose node list contains that wire's node. On the +5 V rail, three components touch node `n1`, so the rail gets whichever component happens to sort first, and the pulse direction and speed on that wire are not the current in that wire.

**Fix.** In `apps/web/src/main.ts`, replace the inner attribution loop with an endpoint-based rule:

```ts
const endpoints = new Set(wire.points.map((p) => p.join(",")));
const attached = circuit.components
  .filter((c) => c.type !== "ground")
  .filter((c) => componentPinPoints(c).some((p) => endpoints.has(p.join(","))))
  .sort((a, b) => a.id.localeCompare(b.id));
const owner = attached.find((c) => generated!.componentCurrents[c.id]);
let current = owner ? scalar(visualResult, currentVector(generated!.componentCurrents[owner.id]!)) ?? 0 : 0;
if (owner && componentPinPoints(owner)[0] && endpoints.has(componentPinPoints(owner)[0]!.join(","))) current = -current;
```

The sign flip exists because ngspice reports two-terminal device current as flowing into pin 0, and conventional current in the wire attached at pin 0 runs the other way. If a wire touches no current-bearing pin, leave it at 0, which correctly means no pulses.

---

### F4. The potentiometer cannot be swept. The signature interaction does not exist.
**Severity: blocker.** Evidence: `05-pot-selected.png`, plus the instrumented drag log below.

DIRECTION section 4.3 makes the pot drag the moment the product is judged on, and specifies it frame by frame. Shipped state:

- There is no on-canvas knob. `packages/schematic-editor/src/index.ts` draws the potentiometer as a single symbol path with no wiper handle and no hit target. Dragging the pot moves the part.
- The only control is the inspector range input, and it does not survive a drag. Instrumented: pointer down at 50 percent, five pointer moves out to 97 percent, and the wiper stayed at `53 %` / `0.526` for the entire gesture. The cause is that each `input` event calls `editor.edit()`, which triggers a solve, which calls `updateVisuals()`, which calls `renderInspector()`, which replaces `#inspector-content.innerHTML`. The input the user is holding is removed from the document on the first solve and every later pointer move goes nowhere.
- Each `input` event also pushes an undo snapshot, so one intended sweep becomes dozens of undo steps.
- There is no trace-hold, no locus, no 40 ms drag tau, no non-convergence strip.

**Fix, minimum to unblock (this finding).** Two changes in `apps/web/src/main.ts`:

1. Add a live-gesture guard:

```ts
let liveGesture = false;
```

In `bindInspector()`, on the wiper input: `wiper?.addEventListener("pointerdown", () => { liveGesture = true; });` and `window.addEventListener("pointerup", () => { liveGesture = false; renderInspector(); });`

2. In `updateVisuals()`, replace the unconditional `renderInspector()` with:

```ts
if (liveGesture) patchReadings(); else renderInspector();
```

where `patchReadings()` writes only into the existing `.measure-row .reading` cells with `readingMarkup()` output, touching no other DOM.

3. Add gesture-scoped history to `packages/schematic-editor/src/index.ts`:

```ts
beginGesture(): void { this.gestureSnapshot = canonicalizeCircuit(this.doc); }
editLive(mutator: (document: CircuitDocument) => void): void { mutator(this.doc); this.render(); this.emit("edit"); }
endGesture(): void {
  if (this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc)) { this.undoStack.push(this.gestureSnapshot); this.redoStack = []; }
  this.gestureSnapshot = "";
}
```

The wiper handler calls `beginGesture()` on pointerdown, `editLive()` on every `input`, `endGesture()` on pointerup.

The full signature moment, including the on-canvas knob and trace-hold, is specced in section E.

---

### F5. Voltage chroma. Raise Cmax to the gamut edge and cut the gamma.
**Severity: high.** Evidence: `13-fixed-contract-ramp.png` versus `14-proposed-ramp.png`. Full verdict and arithmetic in section C.

**Fix.** Three literal edits, all of the same two constants:

- `apps/web/src/main.ts`, `voltageColor()`: `const c = (t < 0 ? .152 : .140) * Math.abs(t) ** 1.25;`
- `apps/web/src/schematic.ts`, `voltageColor()` and `pulseColor()`: same constants (delete the file instead if F21 is taken).
- `docs/CONTRACTS.md` section 5 and `spikes/design/DIRECTION.md` FINAL DIRECTION: the ramp line becomes `C = 0.152 * |t|^1.25` on the blue side and `0.140 * |t|^1.25` on the amber side. This is a contract change and needs the orchestrator commit that `CONTRACTS.md` requires.

---

### F6. Pulse core colour is wrong on the light canvas, and the implementation ignores the rule anyway.
**Severity: high.** Evidence: `02-wire-zoom-a.png` (no pulse to photograph), source at `apps/web/src/style.css` line 12.

Two separate defects.

First, the implementation: `.editor-current` is stroked `var(--graphite-900)`. The contract says the pulse core is the wire's own voltage hue, never a neutral. Black dashes travelling along a coloured wire read as a dashed line, not as charge.

Second, the contract itself is wrong for Vellum. DIRECTION section 4.1 says the pulse core is the wire hue at OKLCH L +0.18. On the Graphite scope surface that is right. On Vellum it is backwards. Computed: the amber rail hue at L 0.80 is `#FBA95B`, contrast 1.66:1 against Vellum. The blue at L 0.80 is `#80C5FF`, 1.60:1. At the alpha range the pulse law specifies, 0.25 to 0.70, that is invisible. Brightening toward a light background is the same mistake as glow on white.

**Fix.** Sign the L offset by surface. Pulse core lightness is `L_wire - 0.18` on Vellum and `L_wire + 0.18` on Graphite. Concretely, `pulseColor()` becomes:

```ts
function pulseColor(voltage: number, vref: number, surface: "vellum" | "graphite" = "vellum"): string {
  const L = surface === "vellum" ? 0.44 : 0.80;
  if (Math.abs(voltage) < 0.05) return surface === "vellum" ? "#4A4E52" : "#A9AEB3";
  const t = Math.max(-1, Math.min(1, voltage / Math.max(vref, 1e-12)));
  const cap = surface === "vellum" ? (t < 0 ? 0.1109 : 0.1014) : (t < 0 ? 0.1083 : 0.1400);
  const chroma = Math.min(cap, (t < 0 ? 0.152 : 0.140) * Math.abs(t) ** 1.25);
  return `oklch(${L} ${chroma.toFixed(5)} ${t < 0 ? 245 : 62})`;
}
```

The `cap` values are the sRGB gamut limits at those lightnesses and hues, computed, not guessed. Resulting rail pulse cores: `#794300` at 6.93:1 on Vellum, `#00578B` at 6.63:1 on Vellum, against wires that sit at 3.10 to 3.29:1. The core is roughly twice the contrast of the wire it rides, which is exactly the relationship a travelling charge packet should have.

In `apps/web/src/style.css`, delete `stroke: var(--graphite-900)` from `.editor-current` and set `stroke: var(--pulse-color)`, with `setWireCurrent()` writing `--pulse-color` on the group alongside the existing custom properties.

Also amend DIRECTION section 4.1 and the FINAL DIRECTION signature-interaction paragraph, since this changes a frozen rule.

---

### F7. The pulse spacing computed by the code is discarded, and the dash geometry is not the pulse law.
**Severity: high.** Evidence: source, `packages/schematic-editor/src/index.ts` `setWireCurrent()` and `apps/web/src/style.css` `.editor-current`.

`setWireCurrent()` correctly computes `u` over four decades and writes `--pulse-spacing: 34 - 16u` onto the group. No CSS rule reads it. The actual geometry is a hard-coded `stroke-dasharray: .75 2.25` on a `vector-effect: non-scaling-stroke` path, which is a 3 px screen period, against a specified 18 to 34 px. The keyframe travels `stroke-dashoffset: -3` per cycle over `(34 - 16u) / (12 + 96u)` seconds, so the on-screen velocity is 3 px per that interval, not `12 + 96u` px/s. At `u = 1` the specified velocity is 108 px/s and the delivered velocity is about 16 px/s. The core is also 0.75 px long against a specified 6 px core with 3 px falloff.

In other words, even with F2 fixed, what animates is not the pulse law. It is a fine dotted line crawling at one seventh of the specified speed with no falloff and no density coupling.

**Fix.** Do not extend the CSS dash approach. Adopt the canvas renderer that already exists and already implements the law correctly, `PulseRenderer` in `apps/web/src/schematic.ts`: single instanced layer, 240 branch cap, 6 px core with 3 px falloff either side at alpha `flow.alpha * 0.35`, phase from `elapsed * speed * direction`, spacing `34 - 16u`. This also satisfies D10, which requires one instanced layer rather than a per-element effect.

Concretely:

1. Add a `<canvas class="pulse-layer">` sibling to the editor SVG inside `#canvas-wrap`, `position: absolute; inset: 0; pointer-events: none`.
2. Port `PulseRenderer` to take wire polylines in editor world coordinates and the live `pan` / `zoom`, transforming with `ctx.setTransform(GRID * zoom * dpr, 0, 0, GRID * zoom * dpr, pan[0] * dpr, pan[1] * dpr)`. Multiply `speed` and `spacing` by `1 / (GRID * zoom)` so both stay in screen px as specified.
3. Delete `.editor-current`, the `current-pulse` keyframe, and the `.current-active` / `.current-reverse` classes.
4. Keep the 110 px/s hard cap from DIRECTION section 4.1: `speed = Math.min(110, 12 + 96 * u)`.

---

### F8. Ground symbols carry auto-ID labels `C7`, `C8`, `C9`.
**Severity: high.** Evidence: `01-first-screen.png`, `04-hover-net.png`.

`packages/schematic-editor/src/index.ts` renders `${esc(c.label?.text ?? c.id.toUpperCase())}`. The three grounds in `apps/web/src/demo.ts` carry no label, so the raw document ID is drawn on the canvas. Grounds are not labelled on any schematic anywhere, and `C` is the reference prefix for a capacitor, so the drawing states three capacitors that do not exist.

**Fix.** In the component rendering template of `render()`:

```ts
${c.type === "ground" || !c.label?.text ? "" : `<text class="editor-label" ...>${esc(c.label.text)}</text>`}
```

Delete the `c.id.toUpperCase()` fallback entirely. A part with no label draws no label. Separately, in `apps/web/src/main.ts` `detail()`, replace the same fallback with `${partByType(component.type).prefix}${component.id.slice(1)}` so the inspector heading never shows a document ID either.

---

### F9. Canvas labels are the largest type in the application and scale with zoom while wires do not.
**Severity: high.** Evidence: `01-first-screen.png`, measured values below.

Measured on the live page at the default fit: world scale 17.48, `.editor-label` font-size `1.35px`, rendered size **23.6 px**. Inspector body is 13 px, the part reference is 17 px, the wordmark is 14 px. `RB` and `P1` are therefore the loudest typography in an instrument, and they get louder as you zoom in.

The same inconsistency runs through the symbol layer. `.editor-symbol` sets `vector-effect: non-scaling-stroke` on the `<g>`, but `vector-effect` is not an inherited property, so the child `<path>` computes `vector-effect: none` (measured) and draws its `0.22` stroke in world units, that is `0.22 * 17.48 = 3.85 px` at the default fit. Wires, whose `vector-effect` is on the path itself, are pinned at 1.8 px. So symbols are more than twice the weight of the wires and the ratio changes with every zoom step. The data layer is the thinnest thing on the canvas.

**Fix.** Make both scale-invariant, since the design's stroke ladder is specified in px.

1. `apps/web/src/style.css`: change `.editor-symbol` to `.editor-symbol, .editor-symbol path` for the `vector-effect` declaration, and set `stroke-width: 1.5`.
2. `packages/schematic-editor/src/index.ts`, in `render()`, emit the label size in world units that resolve to a constant 11 px on screen:

```ts
const labelSize = (11 / (GRID * this.zoom)).toFixed(4);
```

and add `style="font-size:${labelSize}px"` to each `<text class="editor-label">`. Set `.editor-label` `font-weight: 500` and drop the CSS `font-size` so the inline value governs.
3. Same treatment for the knockout: `stroke-width` on `.editor-label` becomes `${(3 / (GRID * this.zoom)).toFixed(4)}` so the 3 px `paint-order` knockout that D4 mandates stays 3 px.
4. Connection dot radii in `render()` currently use fixed world units `.16` and `.24`; emit `${(2.5 / (GRID * this.zoom))}` and `${(3.5 / (GRID * this.zoom))}` for the same reason.

---

### F10. The parts rail is letters, not IEC 60617 symbols.
**Severity: high.** Evidence: `01-first-screen.png` left edge, `10-rail-flyout.png`.

FINAL DIRECTION: "Symbol rail, left, 56 px, Vellum with a 1 px Graphite 100 right rule. IEC 60617 symbols." Hard ban 7: "No generic icon for anything that has an IEC 60617 symbol." Shipped: `<span class="part-abbr">${part.prefix}</span>`, a Plex Mono letter per part. Two entries render `Q` and two render `M`, so the NPN and PNP, and the NMOS and PMOS, are visually identical.

The geometry is already in the repository. `packages/schematic-editor/src/index.ts` `symbol(c)` returns correct IEC 60617 path data for all seventeen part types.

**Fix.** Export the symbol function from the editor package:

```ts
export function partSymbolMarkup(type: ComponentType): string {
  return `<svg viewBox="-5 -7 10 14" aria-hidden="true">${symbol({ id: "x", type, pos: [0, 0], rot: 0, mirror: false } as CircuitComponent)}</svg>`;
}
```

In `apps/web/src/main.ts`, replace `<span class="part-abbr">${esc(part.prefix)}</span>` with `partSymbolMarkup(part.type)`. The existing `.symbol-tool svg` rule already sets `width: 30px; height: 22px; stroke: var(--graphite-700); fill: none; stroke-width: 1.4; stroke-linecap: square; stroke-linejoin: miter`, which is the specified UI stroke weight with square caps, so no new CSS is needed. Keep the reference prefix as small text under the symbol only if the flyout is not enough; the flyout already names the part.

Also replace the `↖` character in the select tool with a two-path geometric arrow drawn at the same 1.4 stroke weight and square caps.

---

### F11. Scope trace palette is outside the design system and includes a rose.
**Severity: high.** Evidence: `07b-scope-dock.png`, source `apps/web/src/scope.ts` line 4.

`TRACE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"]`. None of these are palette tokens. `#d55181` is a rose that sits next to the violet family the contract bans outright, and `#008300` measures 3.60:1 against Graphite 900, the weakest thing in the dock. DIRECTION reserves the hot variants precisely for scope traces on a Graphite surface, and reserves Fault Red for faults.

**Fix.** Four channels in system, dashes for five and six. Real scopes have four channels, so this is also the more instrument-true answer.

```ts
export const TRACE_COLORS = ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8"] as const;         // phosphor-hot, rail-amber-hot, probe-blue-hot, vellum
export const TRACE_DASHES = [[], [], [], [], [6, 3], [2, 3]] as const;                      // Ch5 and Ch6 reuse Ch1 and Ch2 hue, dashed
export const traceStyle = (i: number) => ({ color: TRACE_COLORS[i % 4]!, dash: TRACE_DASHES[i] ?? [] });
```

Measured contrast on Graphite 900: 9.73, 8.22, 7.52, 15.39. The weakest is more than double the weakest shipped colour. Update the `--oc-series-*` custom properties in `apps/web/src/style.css` to match, and pass `dash` into `viewer.setLineDash` at the stroke site in `packages/waveform-viewer/src/viewer.ts` line 487. Fault Red and its hot variant stay out of the trace palette.

---

### F12. The scope well is a black void at rest, and its axis lies when the signal is flat.
**Severity: high.** Evidence: `01-first-screen.png` bottom third, `07b-scope-dock.png`, `08-scope-empty.png`.

Four separate defects in the dock.

**(a) No graticule until data arrives.** 240 px of unbroken Graphite 900 with the words "No waveform data" and, overlapping it, a second empty state saying "Select a net, then run TRAN or AC." Two empty states in one box, and neither of them looks like an instrument.

Fix: draw the graticule unconditionally. In `packages/waveform-viewer/src/viewer.ts`, hoist the grid pass so it runs before the data check, using the default ranges when `this.data` is undefined: a 10 by 8 division lattice at `rgba(169,174,179,0.18)`, the `#6E7378` frame it already draws, and a `#6E7378` centre baseline at 1 px. Then delete the "No waveform data" string entirely and keep the single `#scope-empty` line, restyled to sit in the top left of the well rather than centred, at `--graphite-300`, 11 px.

**(b) Degenerate autoscale prints the same label five times.** With a flat 80.1 mV trace, `paddedRange()` pads by `(max - min) * 0.06`, which is roughly zero, and all five y ticks format to `80.1 mV`. Visible in `07b-scope-dock.png`.

Fix: in `packages/waveform-viewer/src/viewer.ts`, `paddedRange()`, replace the `min === max` special case with a relative-degeneracy test:

```ts
if (max - min <= Math.abs(max) * 1e-3) {
  const centre = (min + max) / 2;
  const padding = Math.max(Math.abs(centre) * 0.05, 1e-9);
  return { min: centre - padding, max: centre + padding };
}
```

**(c) The cursor readout row is clipped.** `07b-scope-dock.png` shows `Cursor A off, Cursor B off, Δ off` cut in half at the bottom edge. Cause: `packages/waveform-viewer/src/style.css` sets `.oc-waveform-viewer { min-height: 220px; grid-template-rows: auto minmax(160px,1fr) auto }`, and that stylesheet is imported after `apps/web/src/style.css`, so at equal specificity it beats the app's `min-height: 0`. The well is about 202 px.

Fix: in `apps/web/src/style.css` raise the specificity and neutralise the inner minimums:

```css
.scope-well .schemagic-waveform-viewer { min-height: 0; grid-template-rows: auto minmax(0,1fr) auto }
.scope-well .oc-waveform-viewer__canvas-wrap { min-height: 0 }
```

Do not raise the dock height. FINAL DIRECTION fixes it at `min(240px, 32vh)` and the 1280 x 720 behaviour in `12-1280x720.png` is correct as shipped.

**(d) Instrument vocabulary is missing from the dock.** There is no `V/div` and no `s/div` anywhere, which FINAL DIRECTION lists as dock contents and D14 lists as required vocabulary. The dock says `Autoscale`, `Manual range`, `CSV`, `PNG`.

Fix: add a `V/div` and `s/div` readout to the scope toolbar, computed from the current y range and x range divided by the graticule division count, in the value-plus-unit composition. Keep `Autoscale`; rename `Manual range` to `Range`.

---

### F13. Net highlight on hover does not exist.
**Severity: high.** Evidence: `04-hover-net.png`, taken with the pointer resting on the +5 V rail. Nothing changes.

DIRECTION section 4.2 calls net highlight "the oldest useful interaction in any EDA tool" and specifies it exactly: the hovered net goes to full chroma, every other net drops to 35 percent chroma by desaturation rather than opacity, and every member of the hovered net pins its numeric annotation on. `updateSchematicVisuals()` in the dead `apps/web/src/schematic.ts` takes a `hoveredNode` argument and implements the chroma scaling. The shipped editor has no hover handler for wires at all.

**Fix.** In `packages/schematic-editor/src/index.ts`, add to `bindRoot()`:

```ts
this.element.addEventListener("pointermove", (e) => {
  if (this.drag || this.wireStart) return;
  const id = (e.target as Element).closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
  if (id !== this.hoveredWire) { this.hoveredWire = id; this.options.onHoverWire?.(id); }
});
```

Add `onHoverWire?: (wireId: string | undefined) => void` to `SchematicEditorOptions`. In `apps/web/src/main.ts`, hold `hoveredNode` in module state, set it from the callback via `generated.wireNodes[wireId]`, and pass a `chromaScale` of `1` or `0.35` into `voltageColor()` exactly as the dead file already does. Re-run only the style pass, not a solve.

Annotation pinning can follow in a later pass; the desaturation alone delivers most of the value and is three lines.

---

### F14. A junction dot is drawn at every wire endpoint, not only at junctions.
**Severity: high.** Evidence: `02-wire-zoom-a.png`, where two hollow dots interrupt a straight unbranched rail.

`render()` emits a `<circle class="connection-node">` for every point that appears at least once, and only upgrades to `.junction` above two. On a schematic, a dot means electrical connection. Dots at corners and free ends state connections that do not exist, and `CONTRACTS.md` section 2 already says "junction dots are derived, not stored", implying derived from degree.

**Fix.** In `render()`, filter the node map before mapping:

```ts
${[...nodes].filter(([, count]) => count > 2).map(([key]) => { ... }).join("")}
```

Keep the pin-endpoint feedback that the dots were probably providing by styling `.editor-hit:hover` instead, or by drawing endpoint markers only while the wire tool is active.

---

### F15. `prefers-reduced-motion` has no static encoding, and the SVG export encoding does not exist.
**Severity: blocker.** Evidence: `11-reduced-motion.png`, `11b-reduced-motion-canvas.png`, measured `document.querySelectorAll(".static-chevron").length === 0` and no `#chevron-layer` in the document.

DIRECTION section 4.4 requires that when motion stops, the information moves into static channels: a quantised stroke-width ladder at 0.9 / 1.4 / 2.0 / 2.8 px, static chevrons at the same `34 - 16u` spacing pointing with conventional current, and a static tick pattern for AC nodes. It further requires that this encoding be byte-identical to the SVG export, so the reduced-motion path is exercised by every export and cannot rot.

Shipped: `@media (prefers-reduced-motion: reduce)` sets `animation: none` and changes the dash to `.5 1`. That is a stationary dotted line. Current magnitude, direction and interval are all lost. A user with vestibular sensitivity gets a strictly less informative diagram, which is the failure mode the section exists to prevent. The e2e test at `apps/web/e2e/vertical-slice.spec.ts` asserts only `animation-name: none`, so it passes.

There is also no SVG export in the product at all. FINAL DIRECTION lists three export formats and the chrome offers `Netlist`, `Download JSON` and `Share URL`. `SchematicEditor.exportSvg()` exists and is never called; `PulseRenderer.exportStaticSvg()`, which implements the static encoding correctly, is in the dead file.

**Fix.** These are one job, which is the point of the contract.

1. Port `PulseRenderer.staticEncoding()` from `apps/web/src/schematic.ts` to operate on the editor's world coordinates, and render into a `<g id="chevron-layer">` inserted between the wire layer and the component layer in `render()`.
2. Drive it from the same `u` as the pulse renderer. Stroke-width ladder: `[0.9, 1.4, 2.0, 2.8][Math.min(3, Math.floor(u * 4))]`, applied to the wire path, not the group (see F1).
3. Engage it on `matchMedia("(prefers-reduced-motion: reduce)")`, on `document.hidden`, above 240 animated branches, and after 30 consecutive frames over 12 ms, per D10. Announce the fallback in the canvas status strip, since D10 requires it to be announced rather than silent.
4. Add an `SVG` chrome action that calls `editor.exportSvg()` with the chevron layer populated, so the export and the reduced-motion screen are produced by the same code path.
5. Strengthen the e2e assertion: under `reducedMotion: "reduce"`, assert `.static-chevron` count is greater than zero and that at least two distinct `stroke-width` values appear across the wire paths.

---

### F16. The `Vref` legend interpolates in sRGB and labels two stops instead of five.
**Severity: high.** Evidence: `01-first-screen.png` bottom centre, measured `background-image: linear-gradient(90deg, rgb(46,134,200), rgb(110,115,120) 50%, rgb(190,115,24))`.

Three problems in one 150 px element. It interpolates in sRGB, which DIRECTION section 1.4 bans by name because sRGB interpolation through the neutral goes muddy. It uses the named tokens `#2E86C8` and `#BE7318`, which sit at L 0.617 and 0.606, not the ramp's L 0.62, so the legend is not the ramp. And it is linear, so it shows a mapping the canvas does not use: at the midpoint of the swatch the legend shows roughly half chroma while the canvas shows `0.5^1.25 = 42` percent of it. The legend is the one place the mapping is meant to be unguessable, and DIRECTION requires five numeric stops.

**Fix.** In `apps/web/src/style.css`:

```css
.voltage-ramp {
  height: 7px;
  border: 1px solid var(--graphite-700);
  background: linear-gradient(in oklch to right,
    oklch(0.62 0.152 245) 0%,
    oklch(0.62 0.0639 245) 25%,
    #6E7378 50%,
    oklch(0.62 0.0589 62) 75%,
    oklch(0.62 0.140 62) 100%);
}
```

Those four non-neutral stops are the proposed ramp evaluated at `|t| = 0.5` and `1.0`, so the swatch is the function. In `apps/web/src/main.ts`, extend the legend markup to five labelled stops: `-Vref`, `-Vref/2`, `0`, `+Vref/2`, `+Vref`, all in the value-plus-unit composition, all updated from `snapReference()` in `updateVisuals()`.

---

### F17. The guidance line specified by D15 does not exist.
**Severity: high.** Evidence: `01-first-screen.png`, source. `.guidance` is styled in `apps/web/src/style.css` and no element ever carries the class.

D15 permits exactly one piece of guidance in the entire product: "Guidance is one dismissible line in the dock: `Drag the pot.` Four words." Since the pot is currently the only interactive parameter and F4 shows it is undiscoverable, this is not decoration, it is the only pointer to the signature interaction.

**Fix.** In `apps/web/src/main.ts`, in the scope toolbar markup, after the run-state span:

```html
<span class="guidance" id="guidance">Drag the pot.<button id="guidance-dismiss" aria-label="Dismiss">×</button></span>
```

Persist dismissal in `localStorage` under `schemagic.guidance-dismissed`. No arrow, no spotlight, no illustration, per D15. Move the current `Click a net to add a trace, up to 6` string out of the toolbar; it duplicates the scope empty state.

---

### F18. Value and unit are not baseline aligned. The unit reads as a superscript.
**Severity: polish.** Evidence: `01-first-screen.png` inspector, where `+2.30 V` renders with a raised `V`. Measured `align-items: normal` on `.reading`.

DIRECTION's value composition rule is explicit: unit at 0.68em, `0.02em` tracking, Graphite 700, `baseline-aligned`, 0.15em gap. `.reading` is an `inline-grid` with no `align-items`, so the smaller unit cell stretches and its text sits at the top of the row.

**Fix.** `apps/web/src/style.css`, `.reading { align-items: baseline; }`. Everything else in that rule is already correct: `minmax(5.4ch,auto)` gives the reserved sign column, `column-gap: .15em` is the specified gap, `.reading-unit` is 0.68em Plex Sans in Graphite 700. Add the missing `letter-spacing: .02em` to `.reading-unit`.

---

### F19. Missing values print `--`.
**Severity: polish.** Evidence: `01-first-screen.png`, `Branch I   -- A`.

Two hyphens is a placeholder, not a reading, and it sits directly under two real values so it reads as a broken row rather than as absent data. It will mostly disappear once F2 lands, but the no-data path still needs a glyph.

**Fix.** In `apps/web/src/format.ts`, return the en dash `–` (U+2013) in Graphite 500 for an undefined value, and suppress the unit entirely rather than printing a bare `A`. Never an em dash, per hard ban 11.

---

### F20. Chrome action row is six words of application vocabulary.
**Severity: polish.** Evidence: `01-first-screen.png` top right.

FINAL DIRECTION specifies `Export` right, as a word, singular. Shipped: `Import models`, `Share URL`, `Netlist`, `Download JSON`, `Load JSON`, `?`. `Download JSON` and `Load JSON` are file-manager vocabulary and D14 bans dashboard vocabulary in favour of instrument words.

This is getting worse rather than better while the review was in progress. Uncommitted work in the tree adds a parts catalog and an examples browser with further chrome actions, plus `@media (max-width: 900px) { .chrome-actions .chrome-action:nth-last-child(-n+4) { display: none } }`, which hides four unnamed actions at narrow widths. Hiding actions by position is a symptom, not a fix. Whoever lands that work should land it into the collapsed `Export` menu described below rather than extending the row.

**Fix.** Collapse to three: `Models`, `Export`, `?`. `Export` opens a plain non-modal list with radius 0 and hairline rules offering `Share URL`, `SPICE netlist`, `Project JSON`, `SVG` (from F15) and `CSV` (delegating to the scope). `Load JSON` moves next to the workspace name button, where opening a document belongs.

---

### F21. Import sheet uses a native file control and the browser default focus ring.
**Severity: polish.** Evidence: `09-import-dialog.png`.

The `Choose Files` control is the unstyled OS widget: rounded corners, system font, system grey. The textarea shows Chrome's default blue focus ring because `apps/web/src/style.css` scopes the focus rule to `button, input` and never mentions `textarea` or `select`. Both violate the radius-0 rule and the palette, in the one dialog whose entire job is to look trustworthy while ingesting untrusted SPICE.

**Fix.** In `apps/web/src/style.css`:

```css
button, input, textarea, select { font: inherit; color: inherit }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, .schematic-editor:focus-visible {
  outline: 2px solid var(--graphite-900); outline-offset: -2px
}
.import-source input[type="file"] { display: none }
.import-source .file-trigger { padding: 6px 9px; border: 1px solid var(--graphite-500); border-radius: 0; background: var(--vellum) }
```

Add a `<button class="file-trigger">Choose files</button>` that forwards its click to the hidden input, and a Plex Mono span for the chosen filename.

---

### F22. Wordmark case and tracking do not match the contract; Plex Mono 600 is never loaded.
**Severity: polish.** Evidence: `01-first-screen.png`, source.

DIRECTION: Archivo Expanded 600 at 14 px, `0.06em`, uppercase for the wordmark. Shipped: 14 px, `0.035em`, mixed case `scheMAGIC Simulator`. The mixed case is presumably a brand decision made after the design spike, which is fine, but then the contract line should be amended rather than quietly diverged from. The tracking is simply short.

Separately, `apps/web/src/style.css` declares `@font-face` for Plex Mono 400 and 500 only, while `.fidelity`, `.part-abbr` and `.tool-glyph` all request weight 600. Those render as synthetic bold. `ibm-plex-mono-latin-600-normal.woff2` is already in `public/fonts/`.

Two of DIRECTION's three open items are now closed and should be recorded: `archivo-wordmark-subset.woff2` is 6,732 bytes, under the 8 KB budget, so the wordmark keeps Archivo. The Plex Mono `0` versus `O` check at 11 px is still open; the readouts render an unslashed zero.

**Fix.** Set `letter-spacing: .06em` on `.wordmark`. Add the missing `@font-face` block for Plex Mono 600. Dump the shipped subset's feature list and, if `zero` or `ss02` is present, add it to the global `font-feature-settings` alongside `"tnum" 1`; if absent, rebuild the subset from the slashed-zero source. Then strike both closed items from the open list in `DIRECTION.md`.

---

### F23. `apps/web/src/schematic.ts` is dead code that contains the correct implementation of four findings.
**Severity: polish, but read it before fixing anything else.** Verified: no module in the repository imports it.

It holds the correct current vector names (F2), the correct instanced canvas pulse renderer with the real pulse law (F7), the hover chroma scaling (F13), the static chevron encoding (F15) and the static SVG export (F15). It also contains the pot knob, wiper and hit target markup that F4 needs, including `data-testid="pot-wiper"`.

The shipped app went a different route through `packages/schematic-editor` and left this behind. Whoever takes these findings should port from it rather than write new code, then delete it. Two implementations of the voltage ramp with different constants is exactly how F5 gets applied to only one of them.

---

## C. The voltage chroma verdict

**Question:** the isoluminant ramp at Cmax 0.117 / 0.121 reads pale on Vellum in static views. Is liveliness carried adequately by the motion layer, or does the ramp need more chroma?

**Answer: the ramp needs more chroma, and more than that it needs less gamma. Change both.**

Three reasons, in order of weight.

**1. The motion layer cannot be relied on to carry it.** Today it carries nothing at all (F2). Even fully repaired, the pulse core is a 6 px mark at alpha 0.25 to 0.70 travelling on a wire, and it only exists on branches carrying more than 1 microamp. The contract deliberately makes stillness meaningful, so any net that is not conducting has, correctly, no motion whatsoever. On the shipped demo circuit that is a large fraction of the canvas. A design where the only liveliness signal is motion is a design that goes dead the moment the circuit is interesting.

**2. The gamma, not the Cmax, is what makes it pale.** Measured on the live demo circuit, the chroma actually painted on each of the nine wires:

| Wire | net | painted chroma | as a fraction of Cmax |
| --- | --- | --- | --- |
| w1, w2 | +5 V rail | 0.1170 | 100 percent |
| w8 | LED anode | 0.0337 | 29 percent |
| w5 | wiper | 0.0302 | 26 percent |
| w6 | base | 0.0053 | 5 percent |
| w9 | collector | 0.0002 | 0 percent |
| w3, w4, w7 | ground | 0 | 0 percent |

Two of nine wires carry colour. Everything else is grey by construction, because `|t|^1.6` at `t = 0.46` is 0.29. The gamma was introduced as the anti-confetti term and it does that job much too well: it does not merely mute mid voltages, it deletes them. A transistor bias network, which is the entire point of the demo, lives at exactly those mid voltages.

**3. Raising chroma is free in contrast terms.** This is the finding that makes the decision easy. At fixed OKLCH L, WCAG contrast is almost entirely a function of lightness. Computed against both canvases across the whole ramp:

| | vs Vellum `#F1EEE8` | vs Graphite 900 `#15181B` |
| --- | --- | --- |
| Contract ramp, all stops | 3.12 to 3.25 | 4.74 to 4.93 |
| Proposed ramp, all stops | 3.10 to 3.29 | 4.68 to 4.97 |

Going to the sRGB gamut edge costs at most 0.03 of contrast ratio and never approaches the 3:1 floor that WCAG 1.4.11 sets for graphical objects. The isoluminant lightness band is doing all the contrast work, exactly as DIRECTION section 1 claims. So there is no reason to leave 20 percent of the available chroma unused.

### Prescribed values

Computed sRGB gamut limits at L 0.62: hue 62 tops out at C 0.1428, hue 245 at C 0.1561.

```
Cmax(amber, hue 62)  = 0.140     (98.0 percent of the gamut limit)
Cmax(blue,  hue 245) = 0.152     (97.4 percent of the gamut limit)
gamma                = 1.25      (was 1.6)
L                    = 0.62      (unchanged, isoluminance is not negotiable)
hues                 = 62 / 245  (unchanged)
```

Formula: `C = Cmax * |t|^1.25`, `t = clamp(v / Vref, -1, +1)`, interpolated in OKLCH, clamped at the rails with the Fault hatch beyond. Stroke-pattern sign redundancy is untouched and stays non-optional, which is the reason the chroma change is safe: colour is never the only channel, so making it stronger cannot make it load-bearing.

### The five legend stops, verified

| v at Vref 5 V | t | OKLCH | sRGB | vs Vellum | vs Graphite 900 |
| --- | --- | --- | --- | --- | --- |
| -5.00 V | -1.00 | `oklch(0.62 0.1520 245)` | `#108DDB` | 3.10:1 | 4.97:1 |
| -2.50 V | -0.50 | `oklch(0.62 0.0639 245)` | `#658BAB` | 3.11:1 | 4.95:1 |
| 0.00 V | 0.00 | Graphite 500 | `#6E7378` | 4.13:1 | 3.72:1 |
| +2.50 V | +0.50 | `oklch(0.62 0.0589 62)` | `#A07F62` | 3.18:1 | 4.84:1 |
| +5.00 V | +1.00 | `oklch(0.62 0.1400 62)` | `#C06F0A` | 3.29:1 | 4.68:1 |

Every stop clears 3:1 on both canvases. Minimum across the whole ramp is 3.10:1 against Vellum and 4.68:1 against Graphite 900. The contract's dual-canvas guarantee holds.

Half-scale chroma goes from 0.0386 to 0.0589 for amber, a 53 percent increase, and from 0.0399 to 0.0639 for blue, a 60 percent increase. That is the change that makes a bias network legible. Visible in `13-fixed-contract-ramp.png` versus `14-proposed-ramp.png`: the wiper net at 2.3 V moves from indistinguishable-from-grey to a readable warm tan, while the ground nets stay pure Graphite 500 and the canvas stays calm. This is not more colourful in the decorative sense. There is still exactly one saturated thing on the screen, the +5 V rail, which is correct: a mostly grounded schematic still reads mostly slate.

Note that `#C06F0A` at the amber rail is very close to the `--rail-amber` token `#BE7318`, which is reassuring rather than accidental: the token was derived at C 0.117 and L 0.606, so the ramp end and the named colour converge rather than diverge.

### What I am not changing

Lightness stays at 0.62. Hue angles stay at 62 and 245. The gamma stays above 1.0 so the anti-confetti intent survives; 1.25 mutes the middle without erasing it. The zero colour stays Graphite 500 and stays deliberately identical to the passive UI. Fault Red stays a hatch and a glyph, never a wire hue.

## D. Motion layer check

Could not be evaluated as a feel question, because it does not run. Measured on all nine wires of the default bench: `current-active` false, `.editor-current` computed `display: none`, `animation-name: none`, LED halo `opacity: 0`. Cause is F2. The pulse geometry that would run once F2 lands is not the pulse law either, and is wrong by roughly a factor of seven in velocity and a factor of six in spacing (F7).

Pot drag under live mode: no visual response of any kind, because the drag itself does not take (F4). Wire hue tau, the 120 ms steady state and the 40 ms drag value, is not implemented anywhere; wire colours are assigned instantaneously with no smoothing, which will strobe as soon as a transient source is on the canvas. That is a photosensitivity concern the contract calls out by name, and it should be fixed in the same pass as F7.

Reduced motion: fails (F15). No chevrons, no stroke ladder, no announcement.

Frame budget and the 240 branch cap: not implemented in the shipped CSS-animation path, which animates per element and therefore cannot degrade as a unit. Implemented correctly in the dead canvas renderer.

So: the motion layer is not merely invisible, it is unimplemented in the shipped path. F7 is the honest fix and it is a port, not a rewrite.

## E. The signature moment, minimum viable version 1

DIRECTION section 4.3 defines the pot drag as a hand-driven DC sweep with scope trace-hold, and calls it the single best idea in the document. It does not exist. Here is the smallest thing that is recognisably it.

**E1. On-canvas knob.** In `packages/schematic-editor/src/index.ts`, extend the potentiometer branch of `symbol()` to emit, in addition to the existing symbol path, a wiper arm and a grab target:

```
<rect class="pot-knob" x="3.4" y="-0.6" width="1.2" height="1.2"/>
<path class="pot-hit" data-pot-hit="${c.id}" d="M4 -6V6"/>
```

`.pot-knob` is the only element in the application other than a text input permitted a radius, and it is 2 px, per D6. `.pot-hit` is `stroke: transparent; stroke-width: 1.6; cursor: ns-resize`, in world units, with `vector-effect: non-scaling-stroke` so the grab target stays a constant 12 px on screen.

**E2. Immediate tracking, no solver in the loop.** On `pointerdown` on `[data-pot-hit]`, capture the pointer, call `beginGesture()` (F4), and on every `pointermove` map the pointer's world y within the pot body to `t = clamp((yBottom - y) / bodyHeight, 0.005, 0.995)`, write it with `editLive()`, and re-render the wiper arm in the same frame. The solve is scheduled on the existing 30 ms debounce and never gates the visual. This is DIRECTION 4.3 step 1 and it is the whole feel of the thing.

**E3. Inline live value.** While dragging, the pot's inspector value becomes `10.0 kΩ  ·  wiper 0.52` in the value-plus-unit composition, patched in place by `patchReadings()` (F4), never re-rendered.

**E4. Drag tau.** Hue interpolation runs at tau 40 ms during the gesture and 120 ms at rest. Implement as a per-net exponential filter in `updateVisuals()` keyed on `liveGesture`, not as a CSS transition, so the export and reduced-motion paths are unaffected.

**E5. Trace-hold.** This is the part that turns a drag into a measurement, and it is cheap. On `beginGesture()`, clear a hold buffer. On every completed solve while `liveGesture` is true, push `[t, v(probedNode)]`. Cap at 400 points, decimate to 200 on release, per D18. Draw the buffer in the scope well as a locus in `--phosphor` at 40 percent alpha under the live trace. One locus at a time; a new drag replaces an uncommitted one. On release, show a single dock affordance reading `Keep locus`, which promotes it to a named annotation with its own cursors.

Even without the commit step, the visible behaviour is: you grab the knob, the LED comes up, the wire hue slides from slate toward amber, and a curve draws itself in the scope as your hand moves. That is the product's entire thesis in one gesture, and E1 through E5 is a day of work on top of F1, F2 and F4.

**E6. Non-convergence honesty.** If a sample fails, freeze hues at last good and print `no convergence at wiper 0.31` in the canvas status strip. Never interpolate across the gap. `simulate()` already surfaces structured diagnostics, so this is a formatting change plus a hold flag. Required by hard ban 10.

## F. Go or no-go

**No-go.** Not for the design, for the delivery of it.

Blockers, all of which must land before the visuals go out:

- **F1** wire voltage colour never paints
- **F2** every branch current is `undefined`
- **F4** the potentiometer cannot be swept
- **F15** no reduced-motion static encoding and no SVG export

Ship in the same pass, because they are what the first screen is judged on: **F5** chroma and gamma, **F6** and **F7** pulse colour and pulse law, **F8** ground labels, **F9** label and symbol weight, **F10** symbol rail, **F12** scope graticule and axis, **F13** net highlight, **F16** legend, **F17** the guidance line.

What is genuinely good and should not be touched while fixing the above: the layout is Direction A hybridised exactly as specified; radius discipline is clean throughout, including the dialogs; there is no shadow, no gradient outside the three permitted, no card, no pill, no purple, no hero, no entrance animation, no CDN font; the 1280 x 720 collapse behaviour is right; the engine status line is the most credible thing in the product; and the honesty notes on the ideal switch and the generic devices are exactly the tone this tool should have. The instrument character is already there in the materials. It is the electricity that is missing.

Re-review after the blockers land. The single test to apply is the one the product premise states: open the page cold, and inside five seconds, without touching anything, is it obvious that this thing is solving. Today the answer is no. After F1, F2, F5, F7 and F12 the answer should be yes, and the rest is finish.
