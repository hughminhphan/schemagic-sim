# @opencircuit/waveform-viewer

Canvas 2D transient, operating-point sweep, and AC Bode viewer with no runtime dependencies.

```ts
import { mount } from "@opencircuit/waveform-viewer";
import "@opencircuit/waveform-viewer/style.css";

const viewer = mount(element, {
  colors: ["#3FD983", "#5FB0E8", "#E8A244"],
  dashes: [[], [6, 3], [2, 3]],
  traces: [
    { source: "V(out)", unit: "V", axisGroup: "voltage" },
    { source: "I(R1)", unit: "A", axisGroup: "current" },
  ],
});

viewer.setData({
  kind: "tran",
  vectors: new Map([
    ["time", timeValues],
    ["V(out)", outputValues],
    ["I(R1)", currentValues],
  ]),
});

viewer.addAnnotation({
  id: "pot-sweep",
  label: "Pot sweep",
  points: [[0, 0.1], [0.5, 2.4], [1, 4.8]],
  style: { axisGroup: "voltage", unit: "V", xMode: "normalized", opacity: 0.4 },
});

const stopListening = viewer.onCursorChange((cursors) => {
  console.log(cursors.a, cursors.b, cursors.deltaX);
});
```

`addAnnotation` upserts by `id`; use `removeAnnotation` or `clearAnnotations` to retire temporary loci. Annotation paths are clipped to the plot and non-finite points break the path rather than joining across a gap.

`vectors` also accepts a record of `Float64Array` values. AC trace vectors must contain interleaved real and imaginary values and must be exactly twice the frequency vector length. AC always uses logarithmic frequency and renders magnitude and phase panels.

Main imperative methods: `setData`, `setTraceVisible`, `addAnnotation`, `removeAnnotation`, `clearAnnotations`, `setYRange`, `setXScale`, `autoscale`, `exportCSV`, `exportPNG`, `onCursorChange`, `onTraceVisibilityChange`, and `destroy`.

Interactions: click sets Cursor A, Shift-click sets Cursor B, drag pans, wheel zooms both axes, Shift-wheel pans X, Alt-wheel zooms Y only, Ctrl-wheel zooms X only, arrow keys pan, `+` and `-` zoom, and `0` resets the view.
