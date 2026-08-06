# @opencircuit/waveform-viewer

Canvas 2D transient, operating-point sweep, and AC Bode viewer with no runtime dependencies.

```ts
import { mount } from "@opencircuit/waveform-viewer";
import "@opencircuit/waveform-viewer/style.css";

const viewer = mount(element, {
  colors: ["#3FD983", "#5FB0E8", "#E8A244"],
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

const stopListening = viewer.onCursorChange((cursors) => {
  console.log(cursors.a, cursors.b, cursors.deltaX);
});
```

`vectors` also accepts a record of `Float64Array` values. AC trace vectors must contain interleaved real and imaginary values and must be exactly twice the frequency vector length. AC always uses logarithmic frequency and renders magnitude and phase panels.

Main imperative methods: `setData`, `setTraceVisible`, `setYRange`, `setXScale`, `autoscale`, `exportCSV`, `exportPNG`, `onCursorChange`, `onTraceVisibilityChange`, and `destroy`.

Interactions: click sets Cursor A, Shift-click sets Cursor B, drag pans, wheel zooms both axes, Shift-wheel pans X, Alt-wheel zooms Y only, Ctrl-wheel zooms X only, arrow keys pan, `+` and `-` zoom, and `0` resets the view.
