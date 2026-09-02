# Show HN draft

Draft only. Do not post without Hugh's approval.

## Title candidates

1. **Show HN: Robonyx, ngspice-46 in your browser with living schematics**
2. **Show HN: I compiled ngspice-46 to WASM for a local-first circuit simulator**
3. **Show HN: Robonyx, an open-source browser circuit simulator with reviewed part models**

## First comment

Hi HN, I built Robonyx because I wanted a browser circuit simulator that felt immediate without hiding the actual simulation engine or the limits of its component models.

It is a free, open-source schematic editor and simulator. ngspice-46 runs locally in a Web Worker as WebAssembly. The schematic is also the primary result view: wires change colour with node voltage, current is animated, and controls such as a potentiometer update the circuit and LED brightness as new operating-point solves complete. There is no account, normal simulation does not call a server, the app works offline after its assets are cached, and circuits can be shared in the URL.

The engine build is pinned to ngspice-46 and Emscripten 5.0.7. I used a small Asyncify patch at ngspice's frontend command boundary, kept KLU and numparam, and excluded XSPICE, OSDI, CIDER, Tcl, and GUI-related code from the first build. A dedicated Worker initializes one engine instance, reuses it for sequential solves, writes a binary rawfile in MEMFS, parses the vectors in the Worker, and transfers `Float64` buffers back to the UI. Cancellation and timeouts terminate that Worker and swap in a warm spare.

On the reference suite, the WebAssembly and native ngspice-46 results agree down to floating-point noise. A warm operating-point solve is about 1 ms on the measured machine. Initialization was about 90 ms in Node and 2.2 seconds in the measured browser build. The WASM response transferred about 1.6 MB with Brotli. These are local measurements, not cross-machine performance promises.

The other part of the project is the model library. I am building it from public datasheet facts rather than redistributing vendor model files. Each package carries source provenance, page-level citations, a fidelity tier, benches, explicit omissions, native-versus-WASM comparisons, and an independent reviewer. The factory keeps fitting targets separate from test expectations, because a model agreeing with its own output proves very little.

That review process has already paid for itself. One of the five initial gold models, the TL072, originally clipped at about +/-9.9 V on +/-15 V rails and stopped behaving across much of its declared low-supply range. The factory had treated a guaranteed minimum output-swing figure as the typical fitting target and left a 5 V rail-drop constant unfitted. The independent review failed it, the model was refit to the correct 25 C typical, the clamp was made supply-aware, and the re-review passed. I would rather publish that correction trail than imply that a generated model is trustworthy because it has many parameters.

The v0.1 model library is still being finalized. The launch count will be 102 manufacturer part numbers, including 25 at F2 or above. F2 means multiple cited typical targets and applicable hard bounds are tested, with native and WebAssembly agreement for every included bench. It is still an engineering estimate, not a certification.

What is not modeled: PCB layout or parasitics, physical manufacturing variation beyond a model's stated coverage, full temperature and noise behavior unless a specific model says so, firmware execution, or detailed MCU peripherals. The first release supports operating point, transient, and AC analyses. Digital parts use behavioral-analog models.

I would especially value feedback on three things:

1. Circuits where the Worker protocol, limits, or ngspice integration behaves badly.
2. Numerical discrepancies with a reproducible netlist and expected result.
3. Which manufacturer parts deserve careful, cited models next.

Live: https://sim.schemagic.design

Source: https://github.com/hughminhphan/schemagic-sim
