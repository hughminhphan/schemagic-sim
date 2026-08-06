# ngspice-46 WASM integration

Import `createNgspiceEngine` from `dist-loader/index.mjs` inside the simulator Worker. The loader imports `dist/ngspice.mjs`; Emscripten locates the separate `dist/ngspice.wasm` file relative to the loader.

```js
import { createNgspiceEngine } from "./dist-loader/index.mjs";

const engine = await createNgspiceEngine();
const { rawfile, stdout, stderr, timingMs } = await engine.runNetlist(netlist);
// rawfile is a fresh Uint8Array copied from MEMFS and can be transferred.
```

## Lifecycle

- Call `createNgspiceEngine()` once per Worker. It initializes one 64 MiB heap and keeps that WebAssembly instance alive.
- Call `runNetlist(netlist)` or its alias `run(netlist)` for each batch solve. Calls must not overlap.
- Each solve replaces `/input.cir`, destroys old plots, runs the analysis, writes binary `/out.raw`, and returns a copied `Uint8Array`.
- `reset()` destroys plots and removes input and raw files. Normal sequential `runNetlist` calls already replace input and output files, so a reset is not required between successful solves.
- Terminate the Worker to dispose of the engine. The loader intentionally has no in-process WebAssembly unload operation.

## Mechanical swap from eecircuit-engine 1.7.0

| Interim call | OpenCircuit call | Delta |
| --- | --- | --- |
| `const sim = new Simulation()` then `await sim.start()` | `const engine = await createNgspiceEngine()` | Construction and initialization are one awaited factory call. |
| `sim.setNetList(netlist); await sim.runSim()` | `await engine.runNetlist(netlist)` | Netlist is passed directly. Concurrent calls are rejected. |
| `sim.__getSpiceModuleForTests().FS.readFile("out.raw")` | `result.rawfile` | Raw bytes are a supported result, not a test-only module escape hatch. |
| `sim.getError()` | `result.stderr` | Errors and warnings are returned per run as text. |
| `sim.getInitInfo()` | `engine.getInitInfo()` | Same diagnostic purpose. |
| Parsed EEcircuit result object | None | The loader returns binary ngspice rawfile bytes. Keep the sim-engine rawfile parser as the single parser. |

Observable behavior retained from the interim engine:

- one initialized module is reused for repeated interactive runs;
- batch `.op`, `.tran`, and `.ac` netlists produce binary rawfiles in MEMFS;
- stdout and stderr are captured rather than written directly by the Worker;
- the command loop yields through Asyncify at the frontend input boundary;
- no Node filesystem is mounted into the module.

The engine has `INITIAL_MEMORY=64 MiB`, `MAXIMUM_MEMORY=256 MiB`, and memory growth enabled. The Worker supervisor still needs its own rawfile byte limit and timeout because those are product limits outside this loader.
