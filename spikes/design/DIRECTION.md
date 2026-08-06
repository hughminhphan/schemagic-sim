# OpenCircuit Design Direction

Owner: design spike (Opus 5). Scope: `spikes/design/` only.
Status: two-pass. Pass One is the proposal. Pass Two (CRITIQUE + FINAL DIRECTION) overrides it where they disagree.
Implementers follow **FINAL DIRECTION** verbatim. Read that section last and treat it as the contract.

Product premise this serves: the first screen is a running transistor plus LED circuit, not a marketing hero. Character target is precision instrument. Calm workspace, vivid electrical behaviour, unmistakably an electronics tool.

---

# PASS ONE

## 1. Palette

Six named colours plus one neutral ramp. Every semantic hue is pinned to a narrow lightness band so a single token works on both canvases. That constraint is the whole trick and it is stated first because everything else depends on it.

### The dual-canvas lightness rule

The app has two surfaces: a light schematic canvas (paper) and a dark scope well (instrument). A wire hue must be legible on both without becoming two different tokens, because voltage colour is semantic and semantic colour that changes meaning per surface is a lie.

Solution: every semantic hue sits at CIE L\* 48 to 58 (OKLCH L 0.55 to 0.63). That band clears 3:1 against Vellum (Y 0.857) and against Graphite 900 (Y 0.0089) simultaneously. WCAG 1.4.11 requires 3:1 for non-text graphical objects, and wires are graphical objects. Semantic hues are therefore **never used as text colour**; text is always from the neutral ramp.

### Named colours

| Name | Hex | OKLCH (canonical) | Role | vs Vellum | vs Graphite 900 |
|---|---|---|---|---|---|
| **Vellum** | `#F1EEE8` | 0.949 0.005 85 | Schematic canvas. Datasheet stock, not white. | - | 15.4:1 |
| **Graphite 900** | `#15181B` | 0.201 0.006 240 | Primary ink on Vellum; scope well and instrument dock fill. | 15.4:1 | - |
| **Probe Blue** | `#2E86C8` | 0.617 0.121 245 | Negative voltage pole. Blue probe lead, blue soldermask. | 3.37:1 | 4.57:1 |
| **Rail Amber** | `#BE7318` | 0.606 0.117 62 | Positive voltage pole. Panel lamp amber, resistor band orange, hot rail. | 3.26:1 | 4.72:1 |
| **Phosphor Green** | `#1B9350` | 0.588 0.135 152 | Instrument colour, not a voltage. Scope traces, probe attach, run state, converged solve. P31 CRT phosphor. | 3.40:1 | 4.53:1 |
| **Fault Red** | `#C44A32` | 0.567 0.155 35 | Fault, out of SOA, over absolute max, non-convergence. Never a fill; see §1.4. | 4.20:1 | 3.67:1 |

### Neutral ramp (Graphite family)

| Token | Hex | Use |
|---|---|---|
| Graphite 900 | `#15181B` | ink, dark surface fill |
| Graphite 700 | `#2A2F34` | secondary text on Vellum (11.5:1), dividers on Vellum |
| Graphite 500 | `#6E7378` | **0 V wire colour**, non-text UI strokes, disabled. Not for text under 18.66 px. |
| Graphite 300 | `#A9AEB3` | grid dots on Graphite, tertiary on dark |
| Graphite 100 | `#D9D6CF` | hairline rules on Vellum (warm-tinted to sit on paper) |

Neutral Slate is Graphite 500. It is the zero-voltage colour and it is deliberately the same colour as the passive UI, because zero volts should read as furniture, not as data.

### Hot variants (Graphite surfaces only)

Real instruments glow. One brightened variant per semantic hue is permitted, used **only** for scope trace strokes and pulse cores drawn on a Graphite surface. Not for wires on Vellum, not for UI, not for hover states.

`--probe-blue-hot #5FB0E8` · `--rail-amber-hot #E8A244` · `--phosphor-hot #3FD983` · `--fault-hot #E8735A`

### 1.4 Voltage colour ramp (semantic, app-wide, immutable)

Diverging, symmetric about 0 V, **isoluminant**. Lightness is fixed at OKLCH L 0.62 across the entire ramp. Sign is carried by hue, magnitude by chroma. Lightness carries nothing, which is what lets one ramp survive both canvases.

Normalisation: `t = clamp(v / Vref, -1, +1)` where `Vref` is the larger of `|Vmin|` and `|Vmax|` observed in the circuit, snapped up to the nearest 1-2-5 value and displayed in the canvas legend. Chroma follows `C = Cmax * |t|^1.6`. The gamma of 1.6 is the anti-confetti term: mid voltages stay muted, only the rails carry real colour, and a mostly-grounded schematic reads mostly slate.

Interpolate in OKLCH. Never in sRGB (sRGB interpolation through the neutral goes muddy purple-grey, which is both ugly and a false reading).

| v (at Vref = 5 V) | t | OKLCH | sRGB approx | Stroke pattern (secondary encoding) |
|---|---|---|---|---|
| -5.0 V | -1.00 | 0.62 0.121 245 | `#2E86C8` | dashed 8-4 |
| -2.5 V | -0.50 | 0.62 0.040 245 | `#4E7DA0` | dashed 8-4 |
| 0.0 V | 0.00 | 0.62 0.006 245 | `#6E7378` | solid hairline + ground glyph |
| +2.5 V | +0.50 | 0.62 0.039 62 | `#9B7750` | solid |
| +5.0 V | +1.00 | 0.62 0.117 62 | `#BE7318` | solid |

Beyond `±Vref` the ramp **clamps**. It does not keep hue-rotating. An out-of-range net gets the clamp colour plus a 45 degree Fault Red hatch overlay, so "off the scale" is visibly different from "at the scale".

### Colourblind readability

The blue to amber axis is the safest diverging pair for protanopia and deuteranopia, which is why it beats the reflexive red to blue. It is the *worst* pair for tritanopia, so colour is never the only channel:

1. **Sign is redundantly encoded in the stroke pattern**, always on, not a preference toggle. Negative nets are dashed 8-4, positive nets are solid, nets within ±50 mV of ground are a solid hairline carrying the ground symbol. This survives full achromatopsia.
2. **Magnitude is redundantly encoded numerically.** Every net has an annotation anchor. Hovered, selected and probed nets always show `+4.98 V` in tabular figures. Ambient annotation density is user-set, and the default shows rails and any net the user has touched.
3. The legend ramp is itself numerically labelled at five stops, so the mapping is never guessed.

### Derivation

Probe Blue and Rail Amber are the two lead colours of every bench: cold return and hot rail. Rail Amber is also the orange resistor band and the amber of a panel indicator. Phosphor Green is P31, the CRT green of a Tektronix 465, kept for instrument function rather than for atmosphere. Vellum is datasheet stock, warm because printed paper is warm, with OKLCH chroma capped at 0.006 so it never becomes sepia. Graphite is datasheet ink and the anodised black of an instrument chassis. There is no purple in the system at all.

## 2. Typography

Three families, self-hosted woff2, subset. Rationale per role.

### (a) Display and brand: **Archivo Expanded, weight 600**

Omnibus-Type, SIL OFL, variable. Used for the wordmark and the version string only. The expanded cut has the wide, evenly weighted, low-contrast letterforms of front-panel silkscreen and PCB legend layers, which is exactly the lettering an engineer associates with a piece of equipment rather than with a website. Set at 14 px, letter-spacing `0.06em`, uppercase for the wordmark only.

### (b) UI: **IBM Plex Sans, weights 400 / 500 / 600**

Bold Monday for IBM, SIL OFL. Chosen over Inter deliberately. Inter is the correct-by-default choice and therefore the invisible-AI choice; Plex has the actual heritage, being drawn for a company whose typographic output was engineering documentation, and its skeleton is mechanical in the right way: flat-sided bowls, a squared-off terminal logic, a slightly compressed lowercase that packs an inspector without feeling cramped. It also pairs by construction with Plex Mono, which removes a whole class of mismatch problems at the value-plus-unit boundary.

- 400 at 13 px / 1.45: body, help text, part descriptions
- 500 at 11 px / 1.3, letter-spacing `0.02em`: field labels, panel headers, axis labels
- 600 at 13 px: section heads, active tab

`font-feature-settings: "tnum" 1` is set globally on any container that can hold a number.

### (c) Numerical and measurement data: **IBM Plex Mono, weights 400 / 500 / 600, tabular by construction**

Monospaced is not decorative here, it is functional: a fixed digit advance means a live value changes in place without the row reflowing, which is the real behavioural inheritance from a segment display. Plex Mono is drawn on the same skeleton as Plex Sans, so a value and its unit do not look like they came from different instruments.

Value-and-unit composition rule (this is the "typographic hierarchy for values and units"):

```
   4.98 V        <- value: Plex Mono 500, tnum, 1em, Graphite 900
        ^unit: Plex Sans 500, 0.68em, +0.02em tracking, Graphite 700,
               baseline-aligned, 0.15em gap, never italic
```

- Engineering notation only, in steps of 3. `4.70 kΩ`, never `4.7e3 Ω`, never `4700 Ω` in a readout.
- Real glyphs: `µ` not `u`, `Ω` not `ohm`, `°C` not `degC`.
- Three significant figures in readouts by default, full precision in the inspector on focus.
- A **sign column is always reserved** so a value does not shift horizontally when it crosses zero.
- Leading zeros suppressed to one (`0.47 V`, not `00.47 V`).
- Value cells right-align on the decimal; unit cells are a separate left-aligned column so a stacked list of measurements forms a true column.

Segment-display ancestry is honoured through the fixed digit cell, the reserved sign column and the leading-zero suppression. It is **not** honoured with a seven-segment face. DSEG and its relatives are banned; they are costume, and they are unreadable at inspector sizes.

Implementation check before P1 sign-off: verify at 11 px that `0` is unambiguous against `O` and `1` against `l` in the shipped Plex Mono cut at the target rendering. If not, enable the family's `zero` or `ss02` feature if present, otherwise ship a slashed-zero build. Do not assume.

## 3. Two wireframe directions

Both are single-screen. Both assume a 1440 x 900 laptop as the design target and degrade to 1280 x 720.

### Direction A: "Bench"

The scope lives under the schematic because on a real bench it lives under the schematic.

```
┌────────────────────────────────────────────────────────────────────────┐
│ OPENCIRCUIT 0.1  npn-led-driver           DC  TRAN  AC  SWEEP   Export │ 32px chrome
├──┬─────────────────────────────────────────────────────────┬───────────┤
│  │                                                         │ INSPECTOR │
│S │                                                         │           │
│Y │        ┌──[R1 1k0]──┬────────────────┐                  │ R1        │
│M │   +5V ─┤            │              [LED1]               │ 1.00 kΩ   │
│B │        │         ┌──┴──┐              │                 │ ±1% 0805  │
│O │      [POT]──────►│ Q1  │              │                 │ RC0805FR- │
│L │  10k0  │         └──┬──┘              │                 │ 071KL     │
│  │        │            │                 │                 │ ───────── │
│R │       GND          GND               GND                │ V  4.98 V │
│A │                                                         │ I  4.31mA │
│I │                    Vref 5 V  [-5 ▓▒░│░▒▓ +5]            │ P 21.5 mW │
│L │                                                         │ ───────── │
│56│                                                         │ MODEL  F2 │
├──┴─────────────────────────────────────────────────────────┴───────────┤
│ TRANSIENT   Ch1 V(led_a)  Ch2 I(R1)      2.00 V/div  1.00 ms/div  ⟳ RUN │ 24px
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │        ╱‾‾‾‾‾‾‾‾‾╲          ╱‾‾‾‾‾‾‾‾‾╲                             │ │ 240px
│ │   ────╱───────────╲────────╱───────────╲────────                   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ Cursor A 1.24 ms  Cursor B 3.71 ms  Δ 2.47 ms  1/Δ 405 Hz              │ 20px
└────────────────────────────────────────────────────────────────────────┘
```

- Left rail 56 px: component palette rendered as **IEC 60617 symbols at UI stroke weight**, not icons. Hover expands to a 240 px flyout with real part numbers.
- Right inspector 300 px: a continuous list with hairline rules. Selected part, real MPN, model fidelity badge (F0 to F3), live per-pin V / I / P.
- Analysis mode switcher in the top chrome. Mode is global state, so it lives in global chrome.
- Scope dock pinned to the bottom, drag-resizable 0 to 480 px, collapses to a 24 px measurement strip that still shows cursors.
- Export at top right, as a word.

**Optimizes for:** spatial stability and simultaneous visibility. Circuit and scope are both always on screen, so cause and effect are visible in one glance, which is the whole product. Nothing overlaps the circuit, ever. Best for the first-screen moment and for students.

**Risk:** vertical budget. At 900 px, chrome 32 + scope 284 leaves 584 px of canvas; at 720 px it leaves 404 px, which is tight for a six-part circuit. Bottom-docked panels are also the arrangement most likely to drift into a card grid if unsupervised.

### Direction B: "Instrument Face"

The window is a Graphite chassis; the schematic is a Vellum inset; the scope is a movable instrument you wheel over the bench.

```
┌────────────────────────────────────────────────────────────────────────┐
│▓▓ OPENCIRCUIT ▓▓  DC TRAN AC SWEEP ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Export ▓▓│ chassis
│▓┌──────────────────────────────────────────────────────┐┌────────────┐▓│
│▓│                                                      ││ INSPECTOR  │▓│
│▓│    ┌──[R1]──┬──────────┐                             ││            │▓│
│▓│ +5─┤        │        [LED1]      ┌────────────────┐  ││ R1 1.00 kΩ │▓│
│▓│    │     ┌──┴──┐       │         │▓ SCOPE      ⌐×│  ││ 0805 ±1%   │▓│
│▓│  [POT]──►│ Q1  │       │         │▓ ╱‾╲   ╱‾╲    │  ││ ────────── │▓│
│▓│    │     └──┬──┘       │         │▓╱───╲─╱───╲   │  ││ V  4.98 V  │▓│
│▓│   GND      GND        GND        │▓ 2V/div 1ms  │  ││ I  4.31 mA │▓│
│▓│                                  └────────────────┘  ││ MODEL   F2 │▓│
│▓│  / insert…                                           ││            │▓│
│▓└──────────────────────────────────────────────────────┘└────────────┘▓│
└────────────────────────────────────────────────────────────────────────┘
```

- No permanent palette rail. Insert is command-driven: press `/`, type `2n3904`, arrow, enter. A 5-slot recents strip sits at the canvas foot.
- Scope is a floating instrument window, draggable, snappable to any edge, closable.
- Inspector fixed right, 260 px.

**Optimizes for:** canvas area and expert speed. Strongest instrument character: a lit bench inside a dark chassis. The overlay scope mirrors what people actually do with a scope, which is put it where they need it.

**Risk:** two serious ones. Floating windows are a discoverability failure for the student half of the audience, and a hidden-until-summoned palette is a wall for anyone who does not already know a part's name. The scope also occludes the circuit it is measuring, which is exactly wrong for a product whose thesis is "watch the circuit respond". The chassis frame is also decorative surface area that does no work, and a hard dark-around-light edge is fatiguing over a long session.

## 4. Signature interaction: the living schematic

Not a hero animation. The schematic itself is the signature, and it is signature because the encoding is precise enough to be *read* rather than merely watched.

### 4.1 Current to motion (the pulse law)

Current is deliberately **not** given a hue. Hues are spent on voltage. Current is behaviour, which is also how current actually differs from voltage: it is a flow, not a level. This makes current encoding automatically colourblind-safe.

Perceptual clamping is logarithmic, because branch currents in one circuit routinely span five decades and a linear mapping renders everything except the supply branch as motionless.

```
i_floor = 1 µA                                  (below this: nothing moves)
i_ref   = 90th percentile of |i| over all branches, snapped up to 1-2-5
          (default 10 mA before first solve)
u       = clamp( log10(|i| / i_floor) / log10(i_ref / i_floor), 0, 1 )
```

`u` drives three coupled parameters. Coupling them is what makes it read as flow rate rather than as three unrelated effects:

| Parameter | Mapping | Range |
|---|---|---|
| Pulse velocity along path | `12 + 96·u` px/s | 12 to 108 px/s |
| Pulse spacing along path | `34 - 16·u` px | 34 down to 18 px |
| Pulse core alpha | `0.25 + 0.45·u` | 0.25 to 0.70 |
| Pulse length | fixed | 6 px core, 3 px falloff each side |

Velocity is hard-capped at 110 px/s: above that the 18 px period aliases against 60 Hz and reads as strobe rather than flow. Length is deliberately fixed; scaling all four parameters turns dense branches into mush.

Pulse colour is the wire's own voltage hue at OKLCH L +0.18, never white. White pulses are decorative shimmer and read as SaaS.

Direction is the direction of conventional current, and it reverses when the current reverses. No arrowheads on the wire; arrowheads appear only on a branch measurement badge to declare the reference direction of a displayed value.

**Below `i_floor`, nothing moves at all.** The absence of motion is information: that net is not conducting. This is load-bearing and must not be softened into a slow idle drift.

### 4.2 Voltage to wire colour: steady state versus hover

**Steady state.** Wire hue is the ramp value of the net's instantaneous voltage, smoothed with an exponential moving average, tau = 120 ms. The smoothing exists because a 1 kHz oscillator would otherwise strobe the entire canvas at 1 kHz, which is both unreadable and a photosensitivity hazard.

Above 8 Hz of node activity the wire switches to a **RMS presentation**: it renders at the hue for `|v_rms|`, carries a fine longitudinal shimmer of ±0.04 L at 1.5 Hz (enough to say "this net is swinging", far below any flash threshold), and its annotation changes from `4.98 V` to `2.50 Vrms 1.00 kHz`. The visual says "AC here"; the number says how much.

**Hover a net.** The entire electrically connected net lights to full chroma and every other net drops to 35 percent chroma. Desaturation, not opacity: layout stays fully legible, colour recedes. Every member of the hovered net pins its numeric annotation on. This is net-highlight, and it is the oldest useful interaction in any EDA tool.

**Hover a component.** A 1 px Graphite outline appears on the package silhouette and per-pin V and I appear in tabular figures next to each pin. The component does not scale, lift, shadow, or translate. Parts on a board do not jump when you look at them.

**Select.** Outline persists, inspector binds, scope gains a one-click "probe this net" affordance.

### 4.3 The instant a user drags the potentiometer

This is the moment the product is judged on, so it is specified frame by frame.

1. **Pointer down, same frame, before any solve.** The wiper tracks the pointer immediately and the pot's inspector value becomes a live inline field reading `10.0 kΩ  ·  wiper 0.52`. Nothing waits on the solver. Input latency and solve latency are decoupled.
2. **Continuation solve.** Each drag sample seeds Newton-Raphson with the previous operating point, so it converges in 2 to 4 iterations. Budget: 8 ms, so the result lands inside one frame even at 120 Hz.
3. **Wire hues re-interpolate at tau = 40 ms during the drag**, not the steady 120 ms. Faster during direct manipulation so the response feels attached to the hand, slower at rest so the canvas is calm.
4. **LED response is photometric, not linear.** Halo radius and intensity derive from luminous flux estimated from `I_F` through the model's efficacy curve. Visible threshold at `I_F` >= 200 µA, saturating at rated `I_F`. Above absolute maximum the halo turns Fault Red and the branch gains a hatched over-current band. A simulator that shows a linearly brightening LED is teaching a false intuition; this one does not.
5. **Trace-hold.** While the pot is being dragged, any open scope stops clearing and instead overlays every swept operating point as a faint locus. This is a hand-driven DC sweep, and it is the single best idea in this document: a drag becomes a measurement. On release, the locus is offered as a keepable scope annotation with its own cursors.
6. **Non-convergence is shown, never faked.** If a sample fails to converge, hues freeze at last-good and a one-line strip appears at the canvas foot: `no convergence at wiper 0.31`. No interpolation across the gap, no silent hold.

### 4.4 prefers-reduced-motion

Motion stops completely. Nothing drifts, nothing pulses, nothing eases. The same information moves into static channels:

| Channel | Animated | Reduced-motion / static |
|---|---|---|
| Current magnitude | pulse density and speed | stroke width on a quantised 4-step ladder: 0.9 / 1.4 / 2.0 / 2.8 px at 1x, from the same `u` |
| Current direction | pulse travel direction | static chevron glyphs stroked along the path, pointing with conventional current |
| Current interval | pulse spacing | chevron spacing, same `P = 34 - 16·u` |
| Zero current | no pulses | no chevrons, hairline stroke |
| AC node | ±0.04 L shimmer | static longitudinal tick pattern plus the `Vrms` annotation |

The static encoding is **identical to the SVG and PNG export encoding**. That is deliberate: the exported artefact is not a degraded screenshot of the animated thing, it is the same diagram in the same language. It also means the reduced-motion path gets exercised by every export and cannot rot.

The same static path engages automatically when: the tab is hidden; more than 240 branches would animate; or the frame budget exceeds 12 ms for 30 consecutive frames. Degradation is a documented mode, not a stutter.

## 5. Provenance

This direction is derived from instruments, not from software. The isoluminant blue-to-amber voltage ramp comes from probe lead colour coding and from the amber of a panel indicator, and it is isoluminant because an instrument face has to stay readable under any lighting rather than relying on a screen's black point. The decision to spend hue on voltage and motion on current comes from schematic notation itself, where a node is a labelled level and a branch is a directed flow, and the two have never shared a visual channel on paper. Phosphor Green is reserved for instrument function because on a scope, green means the beam is on, not that a value is good. The typographic rules for values, engineering notation in steps of three, a reserved sign column, a fixed digit advance, a smaller tracked unit, come from digital multimeter and counter readouts, where those conventions exist so a technician can read a changing number without re-fixating. Vellum and Graphite are datasheet stock and datasheet ink, and the component palette uses IEC 60617 symbols rather than an icon set because the symbol is the industry's own vocabulary and substituting a friendlier picture would be a downgrade in a tool whose users already read schematics. The layout has no cards, no hero and no marketing surface because a bench does not have any: it has a work surface, an instrument, and the part in your hand.

---

# PASS TWO: CRITIQUE

Written adversarially against Pass One. Each item is a defect I actually put there or nearly did, then the fix.

**D1. The LED halo is a bloom, and bloom is the oldest decorative crutch there is.**
Fix: the halo is permitted **only** on a component whose model declares itself light-emitting, it is a physically shaped radial falloff sized from luminous flux, and it is drawn as a data layer. `box-shadow` is banned globally, including here. If it cannot be justified by a photometric quantity, it does not render.

**D2. Direction B's chassis frame is glassmorphism's structural cousin.** A dark decorative frame around a light content inset is surface area that does no work, and it invites bevels, insets and translucency next. It is also a hard contrast edge in peripheral vision for hours at a time.
Fix: kill the chassis. The Vellum canvas goes edge to edge. Instrument surfaces are Graphite only where there is an actual instrument.

**D3. Three typefaces for a tool is an indulgence, and Archivo exists for one string.**
Fix: keep it, but budget it. Archivo Expanded 600 is subset to the exact glyph set of the wordmark and version string, roughly 30 glyphs, under 6 KB woff2, loaded with `font-display: block` on a 14 px element where a swap would be invisible anyway. If the subset exceeds 8 KB it is cut and the wordmark is set in Plex Sans 600 with `0.08em` tracking.

**D4. Net value annotations were one careless step from becoming chips.** A value on a wire wants a background so it stays readable, and a background with a radius is a pill.
Fix: annotations knock out the canvas colour behind the glyphs only, using a `paint-order: stroke fill` outline in the canvas colour at 3 px. No rect, no fill, no border, no radius, no shadow.

**D5. The inspector was heading for stacked cards.** A right column with grouped information is the natural habitat of the shadowed card.
Fix: the inspector is one continuous scroll with 1 px Graphite 100 rules between groups. Zero elevation anywhere in the application. `box-shadow` and `filter: drop-shadow` are banned outright.

**D6. Rounded-everything.**
Fix: explicit radius scale. `0` for canvas, dock, inspector, panels, buttons, the scope well and the palette rail. `2px` and only 2 px for text inputs and the pot knob, because both are things a hand grabs. Component bodies use their real package silhouette (0805 chip, TO-92 D-shape, 5 mm dome) and never a rounded rect.

**D7. The isoluminant ramp is weakest exactly where I claimed strength: tritanopia collapses the blue-amber axis.** Pass One handled this but framed the redundant encoding as a supporting feature, which is how such things get value-engineered out in week three.
Fix: promote it to a hard invariant. **Stroke pattern is always on and is not user-toggleable.** Solid means positive, dashed 8-4 means negative, solid hairline with ground glyph means within ±50 mV of ground. No setting removes it. Any implementation that makes it optional is a regression.

**D8. Semantic hues at 3.2 to 3.4:1 will get used as text the first time someone labels a rail.**
Fix: written rule. Semantic hues may colour strokes, fills and glyph outlines. They may never be `color` on text. Rail labels are Graphite 700 text adjacent to a hue swatch, not coloured text.

**D9. Fault Red and Rail Amber sit close on the protanopia axis**, and I put both on the canvas at once.
Fix: Fault is never a hue on a wire. Fault renders as a 45 degree hatch overlay plus a triangle glyph plus text. It is a texture, not a colour, so the voltage axis stays clean and fault survives any CVD.

**D10. Animating 200 branches at 60 fps will melt a laptop, and I specified a per-wire effect without a budget.**
Fix: all pulses render in one instanced layer, not per-element. Hard cap 240 animated branches. Automatic fallback to the static encoding on hidden tab, over-cap, or 30 consecutive frames over 12 ms. Fallback is announced in the status strip, not silent.

**D11. "Warm paper" is one texture overlay away from skeuomorphic sepia.**
Fix: Vellum chroma capped at OKLCH 0.006. No paper texture, no grain, no noise, no vignette, no background image of any kind.

**D12. A "blueprint grid" of blue lines was the obvious next move and it is a costume.**
Fix: the grid is a real 2.54 mm-equivalent pitch lattice, one dot per pitch, Graphite 500 at 22 percent on Vellum and Graphite 300 at 16 percent on Graphite. Dots, not lines. Snap targets are the actual pitch.

**D13. Generic icon sets.** A Lucide resistor is worse than a resistor.
Fix: anything with a standard schematic symbol uses IEC 60617 at UI stroke weight. UI-only affordances (close, resize, run) may use a minimal geometric set drawn at the same stroke weight, with square caps and square joins. No rounded caps, no two-tone icons.

**D14. Dashboard vocabulary.** "Metrics", "series", "widgets", "insights".
Fix: instrument vocabulary throughout. `Ch1`, `V/div`, `s/div`, `Cursor A`, `Δ`, `Run`, `Single`, `Probe`, `Net`, `Branch`, `Operating point`. If a real scope or a real schematic has a word for it, that is the word.

**D15. A hero, an onboarding modal and entrance animations were all latent risks in "first screen".**
Fix: no hero, no modal, no entrance animation of any kind. The simulation is already running at t = 0 and nothing fades in. Guidance is one dismissible line in the dock: `Drag the pot.` Four words, set in the UI face, no illustration, no arrow, no spotlight overlay.

**D16. Direction A's vertical budget genuinely fails at 720 px.**
Fix: the dock's default height is `min(240px, 32% of viewport height)` and it collapses to a 24 px measurement strip that still shows cursor readouts. Below 760 px viewport height the dock starts collapsed and the circuit is the only thing on screen, which is the correct emphasis anyway.

**D17. Direction B's command-only insert excludes exactly half the audience.**
Fix: the visible symbol rail is permanent. The `/` command insert is an accelerator layered on top of it, never a replacement, and it is discoverable from a `/` hint in the rail's footer.

**D18. Trace-hold could accumulate unbounded loci and turn the scope into scribble.**
Fix: the hold buffer keeps the most recent 400 operating points, decimated to 200 on release. One locus at a time; starting a new drag replaces the uncommitted locus. Committing promotes it to a named annotation.

## FINAL DIRECTION

This is the contract. Where it conflicts with Pass One, this wins.

### Palette (confirmed, immutable semantics)

| Token | Name | Hex |
|---|---|---|
| `--vellum` | Vellum | `#F1EEE8` |
| `--graphite-900` | Graphite 900 | `#15181B` |
| `--graphite-700` | Graphite 700 | `#2A2F34` |
| `--graphite-500` | Graphite 500 (Neutral Slate, 0 V) | `#6E7378` |
| `--graphite-300` | Graphite 300 | `#A9AEB3` |
| `--graphite-100` | Graphite 100 | `#D9D6CF` |
| `--probe-blue` | Probe Blue (negative pole) | `#2E86C8` |
| `--rail-amber` | Rail Amber (positive pole) | `#BE7318` |
| `--phosphor` | Phosphor Green (instrument) | `#1B9350` |
| `--fault` | Fault Red (hatch and glyph only) | `#C44A32` |

Hot variants, Graphite surfaces only, scope traces and pulse cores only:
`--probe-blue-hot #5FB0E8` · `--rail-amber-hot #E8A244` · `--phosphor-hot #3FD983` · `--fault-hot #E8735A`

Voltage ramp: isoluminant OKLCH L 0.62, hue 245 for negative and 62 for positive, `C = 0.121 · |t|^1.6` on the blue side and `0.117 · |t|^1.6` on the amber side, `t = clamp(v/Vref, -1, 1)`, interpolated in OKLCH, clamped at the rails with a Fault hatch beyond. Sign is always redundantly encoded in the stroke pattern: solid positive, dashed 8-4 negative, hairline plus ground glyph at zero. Not toggleable.

### Typography (confirmed)

- Display: **Archivo Expanded 600**, wordmark and version string only, subset under 8 KB, else cut to Plex Sans 600 at `0.08em`.
- UI: **IBM Plex Sans** 400 / 500 / 600. Body 13/1.45, labels 11/1.3 at `0.02em`, heads 13 at 600. `tnum` on globally.
- Data: **IBM Plex Mono** 400 / 500 / 600, tabular. Value Plex Mono 500 at 1em; unit Plex Sans 500 at 0.68em, `0.02em` tracking, Graphite 700, 0.15em gap. Engineering notation in steps of 3, real `µ` and `Ω`, three significant figures in readouts, reserved sign column, one leading zero.
- All three self-hosted woff2, subset, in-repo. No CDN font links in the application.

### Wireframe: Direction A ("Bench"), hybridised

**A wins.** The product's entire claim is that you can see cause and effect at once, and A is the only layout where the circuit and the instrument are both permanently visible and never overlap. B's floating scope occludes the exact thing the user is measuring, and its command-only palette locks out the student half of the audience. What survives from B is its instrument character, which is achieved with materials and vocabulary rather than with a decorative chassis.

Confirmed layout:

- **Chrome strip, 32 px, Graphite 900.** Wordmark left, document name, analysis mode switcher (`DC` `TRAN` `AC` `SWEEP`) centre as text tabs with a 2 px Phosphor Green underline on the active one, `Export` right as a word.
- **Canvas, Vellum, edge to edge.** No frame, no inset, no chassis. 2.54 mm-pitch dot lattice, Graphite 500 at 22 percent. Vref legend bottom centre with the labelled ramp.
- **Symbol rail, left, 56 px, Vellum with a 1 px Graphite 100 right rule.** IEC 60617 symbols. Hover opens a 240 px flyout with real MPNs and fidelity grades. `/` hint in the footer opens command insert; the rail never disappears.
- **Inspector, right, 300 px, Vellum with a 1 px Graphite 100 left rule.** One continuous scroll, hairline group rules, no cards, no elevation. Part, MPN, fidelity badge F0 to F3, per-pin V / I / P in the value-plus-unit composition.
- **Instrument dock, bottom, Graphite 900, height `min(240px, 32vh)`,** drag-resizable, collapsing to a 24 px cursor strip. Starts collapsed under 760 px viewport height. Contains the scope well, channel assignments, V/div and s/div, cursors with Δ and 1/Δ, and the single guidance line.
- **Radius:** 0 everywhere except 2 px on text inputs and the pot knob.
- **Export:** URL with deflate + base64url netlist, `.cir` SPICE netlist, and static SVG in the reduced-motion encoding.

### Signature interaction (confirmed)

The living schematic, as specified in §4 with the Pass Two fixes: hue encodes voltage on the isoluminant ramp with always-on stroke-pattern sign redundancy; motion encodes current through the logarithmic pulse law (`u` from four decades, velocity 12 to 108 px/s, spacing 34 to 18 px, alpha 0.25 to 0.70, fixed 6 px core, nothing below 1 µA); net-highlight on hover by desaturating everything else to 35 percent chroma; and the pot drag runs a continuation solve at 40 ms hue tau with trace-hold turning the drag into a hand-driven DC sweep. `prefers-reduced-motion` swaps motion for the quantised stroke-width ladder plus static chevrons, which is byte-for-byte the export encoding.

### Hard bans (implementers)

1. **No glow, gradient, shadow or blur that is not data.** The only three permitted gradients in the entire application are the voltage ramp, the LED photometric falloff and scope trace persistence grading. `box-shadow`, `filter: drop-shadow`, `backdrop-filter` and every form of translucent panel are banned outright. Zero elevation.
2. **No pills, chips, cards, badges-as-lozenges or rounded rectangles.** Radius 0 everywhere except 2 px on text inputs and the pot knob. Net values sit directly on the wire with a `paint-order` knockout, never on a background shape. The inspector is a ruled list, never a card stack.
3. **No semantic hue as text colour, ever.** Text is Graphite ramp on Vellum or Vellum on Graphite. Hues colour strokes and fills only.
4. No purple, no violet, no indigo anywhere in the product.
5. No hero, no marketing copy above the canvas, no onboarding modal, no entrance or load animation. The simulation is running at t = 0.
6. No blueprint grid, no paper texture, no grain, no noise, no vignette, no background image.
7. No generic icon for anything that has an IEC 60617 symbol. No rounded caps or joins on any icon or symbol stroke.
8. No seven-segment or LCD-mimic typeface. No font loaded from a CDN in the application.
9. No dashboard vocabulary. Instrument words only: Ch, V/div, s/div, Cursor, Δ, Run, Single, Probe, Net, Branch, Operating point.
10. No fabricated values. Non-convergence freezes at last-good and says so; it never interpolates, never silently holds.
11. No em dashes in any UI copy, docs, commit messages or launch copy.
12. No hover-lift, hover-scale or hover-translate on any component. Parts do not move when you look at them.

### Open items for the next agent

- Verify Plex Mono `0` versus `O` at 11 px in the target rendering before P1 sign-off; enable `zero` or `ss02`, or ship a slashed-zero build.
- Confirm the Archivo Expanded subset lands under 8 KB, else cut to Plex Sans per D3.
- Measure the continuation solve against the 8 ms budget on the vertical-slice circuit; if it misses, the fix is decoupling the hue interpolator from the solver tick, not lengthening the drag tau.


## Amendment 2026-08-07 (orchestrator, from docs/design-critique.md)

1. Voltage ramp: Cmax raised to 0.140 (amber, hue 62) and 0.152 (blue, hue 245); perceptual gamma cut from 1.6 to 1.25. L 0.62 and hues unchanged. Verified: every stop 3.10 to 3.29:1 on Vellum and 4.68 to 4.97:1 on Graphite 900; stroke-pattern sign redundancy unchanged.
2. Pulse core lightness signs by surface, not a fixed offset: L 0.44 on the Vellum canvas, L 0.80 on Graphite scope surfaces. The original "L +0.18" spec measured 1.60 to 1.66:1 on Vellum and is void.
