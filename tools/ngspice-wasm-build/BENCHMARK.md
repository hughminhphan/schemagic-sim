# ngspice-46 WebAssembly validation

Measured on Node.js v26.7.0 after a clean pinned Emscripten 5.0.7 build. Times are wall-clock measurements from one local run and are intended as integration guidance, not cross-machine guarantees.

## Artifact sizes

| Artifact | Bytes | MiB |
| --- | ---: | ---: |
| `dist/ngspice.wasm` raw | 6,244,155 | 5.955 |
| `dist/ngspice.wasm` gzip level 9 | 2,044,559 | 1.950 |
| `dist/ngspice.wasm` Brotli | 1,328,348 | 1.267 |
| `dist/ngspice.mjs` | 81,852 | 0.078 |
| `dist-loader/index.mjs` | 6,064 | 0.006 |

The ESM references the separate `ngspice.wasm` file. It contains no base64 WebAssembly payload.

## Initialization and repeated operating-point solves

The comparison target is `eecircuit-engine@1.7.0`. Each engine received five warm-up solves followed by 100 sequential solves of `op-diode-divider.cir`.

| Measurement | ngspice-46 artifact | eecircuit-engine 1.7.0 |
| --- | ---: | ---: |
| Node initialization | 89.674 ms | 802.421 ms |
| Mean solve | 1.036 ms | 1.337 ms |
| Median solve | 0.183 ms | 0.235 ms |
| p95 solve | 1.318 ms | 4.206 ms |
| Minimum solve | 0.129 ms | 0.184 ms |
| Maximum solve | 43.198 ms | 70.727 ms |

The ngspice-46 artifact completed all 100 solves on one initialized WebAssembly instance. Its WebAssembly heap remained exactly 67,108,864 bytes before and after the measured run, with no heap growth.

Process memory around the 100-run ngspice measurement was:

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| RSS | 153,780,224 | 309,231,616 | 155,451,392 bytes |
| V8 heap used | 9,028,080 | 9,111,184 | 83,104 bytes |
| External | 35,010,509 | 28,786,250 | -6,224,259 bytes |
| Array buffers | 6,385,390 | 6,410,326 | 24,936 bytes |

RSS includes Node, JIT-compiled WebAssembly code, and runtime allocations outside the fixed WebAssembly heap. The unchanged WebAssembly heap is the relevant bound for repeated ngspice allocations in this test.

## Native-reference suite

The artifact passed all six existing native-reference fixtures at their existing tolerances:

| Circuit | Analysis | Maximum relative error | Result |
| --- | --- | ---: | --- |
| `bjt-common-emitter.cir` | operating point | 5.724e-12 | PASS |
| `led-forward-drop.cir` | operating point | 4.149e-16 | PASS |
| `op-diode-divider.cir` | operating point | 0.000e+0 | PASS |
| `rc-ac.cir` | AC | 1.665e-16 | PASS |
| `rc-transient.cir` | transient | 2.146e-15 | PASS |
| `rlc-resonant-transient.cir` | transient | 3.554e-15 | PASS |

AC phase error was 0.0000 degrees. The default native harness path using `eecircuit-engine@1.7.0` also remained 6/6 after the optional engine override was added.

Reproduce the measurements with:

```sh
node --expose-gc scripts/benchmark.mjs
```
