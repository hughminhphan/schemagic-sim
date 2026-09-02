# Social preview and demo GIF specification

Draft production specification. Do not publish until Hugh approves the launch pack.

## GitHub social image

### Canvas

- Exact size: **1280 x 640 px**.
- Export: PNG, sRGB, 1x, with no transparency.
- Keep all critical text and the circuit focal point at least 64 px from every edge.
- Check readability at 640 x 320 px and 320 x 160 px.

### Composition

Use a 56:44 split.

- **Left 56 percent:** a clean crop of the live default NPN LED bench. Show the potentiometer, 2N3904, resistor, LED, and enough connected wire to make the circuit legible. The schematic must be an actual Robonyx render, not a redrawn approximation.
- **Right 44 percent:** wordmark, thesis, and one small engine label.
- Do not show browser chrome, menus, competitor interfaces, pricing comparisons, badges, or a call-to-action button.

### Schematic state

- Set the potentiometer so the LED is visibly bright but not at maximum bloom.
- Show at least one positive-voltage wire in the product's Rail Amber data hue and one lower or negative node in Probe Blue where electrically truthful.
- Preserve the zero-voltage graphite treatment, sign encoding, junctions, labels, and current-motion marks from the product UI.
- Since PNG cannot show motion, choose a frame where current pulses are clearly separated and direction is readable.
- Keep the scope closed so the schematic remains the focal point.
- Engine status must be ready before capture. Do not include loading or error states.

### Background and typography

- Background: Vellum `#F1EEE8`.
- Main text: Graphite 900 `#15181B`.
- Wordmark: Archivo Expanded 600, rendered exactly as **Robonyx Simulator**.
- Thesis: IBM Plex Sans, medium weight, maximum two lines.
- Engine label: IBM Plex Mono, uppercase or technical sentence case.
- No decorative gradients, shadows, blur, rounded cards, or glass effects. Voltage hues in the circuit are data encoding and may remain.

### Exact copy

Wordmark:

> Robonyx Simulator

One-line thesis:

> Real ngspice in your browser. The schematic shows what the circuit is doing.

Engine label:

> ngspice-46 · local WASM Worker

### Layout measurements

- Outer padding: 64 px.
- Gap between schematic crop and copy block: 48 px.
- Wordmark top: 138 px.
- Wordmark width target: 430 px maximum.
- Thesis starts 34 px below the wordmark and uses a 54 px line height.
- Engine label sits 34 px below the thesis.
- Schematic crop bounding box: x 36 to 706, y 48 to 592.
- Copy bounding box: x 754 to 1216, y 96 to 544.

### Acceptance checks

- The schematic is electrically plausible and captured from the live product.
- Voltage colours correspond to the captured solve, not decorative recolouring.
- The wordmark and thesis remain readable at 320 x 160 px.
- No text is within 64 px of an edge.
- No competitor UI or logo appears.
- The exported file is exactly 1280 x 640 px.

## Demo GIF storyboard

### Capture and export

- Capture viewport: **1280 x 720 px** at device scale factor 1.
- Duration: **14.0 seconds**, then loop.
- Frame rate: capture at 30 fps; export at 20 or 24 fps if needed for size.
- Pointer remains visible throughout.
- Start only after the application has loaded enough to show the default bench. The first shot intentionally includes the final engine-ready transition.
- Target final file: `launch/assets/demo.gif`.
- Prefer a visually lossless MP4/WebM master and derive the GIF from it.

### Timed shot list

| Time | Action | Required visible result |
| --- | --- | --- |
| 0.0 to 2.0 s | Load the default NPN LED bench and hold. | Full bench is fitted in view. `ENGINE READY` becomes visible before the cut. |
| 2.0 to 5.5 s | Select `P1` and drag the wiper from about 15 percent to about 85 percent in one continuous motion. | Inspector wiper percentage changes. The interaction is continuous, without a jump cut. |
| 5.5 to 7.5 s | Hold on the high setting. | LED is brighter, wire voltage hues have updated, and current animation is clearly moving. |
| 7.5 to 10.0 s | Click a connected wire to add a trace, then click **Open scope**. | Probe marker and scope trace are visible. Keep the circuit in frame. |
| 10.0 to 14.0 s | Click **AC** and wait for the configured sweep. | End on a stable Bode magnitude and phase view with the AC tab selected. Hold the final frame for at least 1.5 s. |

### Editing rules

- Use hard cuts only between the five storyboard beats. Do not speed-ramp the potentiometer drag.
- Do not fake solver values, LED response, wire colour, current motion, or scope data.
- Do not crop out the engine-ready status during the first beat.
- Do not show developer tools, notifications, personal browser data, or another product.
- Avoid captions inside the GIF. The README text provides context.
- Loop transition may cut directly from the final Bode view back to the initial bench load.

### GIF acceptance checks

- The action order is exactly: load default bench, drag pot, LED brightens, open scope, switch to AC Bode.
- Total duration is 14.0 seconds within a tolerance of 0.2 seconds.
- Final frame is a readable Bode view.
- Pot movement and visual feedback are legible at the README's rendered width.
- No fabricated or composited simulation result appears.
