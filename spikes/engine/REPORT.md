# OpenCircuit engine spike

Date: 2026-08-06

## Decision

**Choose a pinned OpenCircuit build of ngspice-46 using the EEcircuit Asyncify and MEMFS integration pattern.**

Use `eecircuit-engine@1.7.0` only as the proof artifact and implementation reference. Do not ship that npm package unchanged. It proved browser-compatible WebAssembly, binary rawfile capture, one initialized instance reused for multiple analyses, and exact agreement with the pinned native reference on the test circuits.

The product build should:

1. Pin official ngspice tag `ngspice-46`, commit `ebdaf58ec76a06ffaac7e0f138360dd1cf5ee4b6`.
2. Pin Emscripten 5.0.7 rather than using `latest`.
3. Retain ngspice core, SPARSE, KLU, numparam, and S-parameter analysis.
4. Exclude XSPICE, CIDER, OSDI, tclspice, readline/editline, FFTW, GUI code, OpenMP, and pthreads for the first product engine.
5. Emit separate `.mjs` and `.wasm` artifacts with an explicit 256 MiB maximum memory.
6. Run the module only inside a Web Worker. Cancel or time out work by terminating that worker and creating a fresh one.
7. Write a binary rawfile in MEMFS and parse it directly into transferable `Float64Array` buffers.

This path has a larger compliance burden than a pure BSD build because ngspice's numparam frontend is LGPL and the recommended KLU solver is LGPL. OpenCircuit is open source, so this is manageable if source, build scripts, notices, and relinking materials are published correctly.

## Reproduction

From this directory:

```sh
npm ci
node run-test.mjs
```

Requirements:

- Node 18 or later. Tested with Node 26.
- Native reference at `/opt/homebrew/bin/ngspice`. Tested with ngspice-46 compiled with KLU.

Test netlists:

- `op-diode-divider.cir`: 5 V resistor divider loaded by a diode model, followed by `.op`.
- `rc-transient.cir`: 1 kohm and 1 uF RC lowpass driven by a 0 V to 5 V pulse, followed by `.tran`.
- `rc-ac.cir`: the same RC lowpass driven by an AC 1 V source, followed by a decade `.ac` sweep.

`run-test.mjs` initializes one WASM instance, runs all three analyses, repeats the operating-point run on the same instance, runs the same netlists through native ngspice-46, parses both binary rawfile formats, and applies numeric thresholds.

## Measured result

Proof artifact:

- Package: `eecircuit-engine@1.7.0`
- Runtime banner: `ngspice-45.2+`, KLU
- Native reference: ngspice-46, KLU
- WASM initialization: 333.4 ms in the clean-environment verification run
- Repeated operating-point run: 0.35 ms in the clean-environment verification run
- Repeated-run `v(out)` delta: 0 V

The timing figures are one local run, not a benchmark. Native rows include process startup while WASM reruns reuse an initialized module.

### DC operating point

| Quantity | WASM | Native ngspice-46 | Relative error |
|---|---:|---:|---:|
| `v(in)` | 5.000000000 V | 5.000000000 V | 0 |
| `v(out)` | 0.6907458942 V | 0.6907458942 V | 0 |

Required threshold: relative error below `1e-3`. Result: pass.

### RC transient checkpoints

Values are linearly interpolated onto common times because ngspice uses adaptive internal timesteps.

| Time | WASM `v(out)` | Native `v(out)` | Relative error |
|---:|---:|---:|---:|
| 1.00 ms | 1.965785950 V | 1.965785950 V | `1.130e-16` |
| 2.00 ms | 3.883812240 V | 3.883812240 V | `4.574e-16` |
| 5.00 ms | 4.944433841 V | 4.944433841 V | `1.078e-15` |
| 6.00 ms | 3.016761417 V | 3.016761417 V | `1.766e-15` |
| 9.00 ms | 0.1501806872 V | 0.1501806872 V | `2.403e-15` |
| 15.00 ms | 4.944806502 V | 4.944806502 V | `7.185e-16` |

Maximum recorded full-scale error across all scripted checkpoints was `1.066e-15` relative to the 5 V range. Required qualitative threshold in the script: below `1e-2`. Result: pass.

### RC AC sweep

| Frequency | WASM magnitude | Native magnitude | Magnitude relative error | WASM phase | Native phase |
|---:|---:|---:|---:|---:|---:|
| 10 Hz | 0.9980319045 | 0.9980319045 | 0 | -3.595274 deg | -3.595274 deg |
| 100 Hz | 0.8467330160 | 0.8467330160 | 0 | -32.141908 deg | -32.141908 deg |
| 1 kHz | 0.1571767255 | 0.1571767255 | 0 | -80.956939 deg | -80.956939 deg |
| 10 kHz | 0.0159134790 | 0.0159134790 | 0 | -89.088186 deg | -89.088186 deg |
| 100 kHz | 0.0015915474 | 0.0015915474 | 0 | -89.908811 deg | -89.908811 deg |

Required script thresholds: magnitude relative error below `1e-2` and phase delta below 1 degree. Result: pass.

## Existing ngspice browser efforts

Bundle figures below are uncompressed unless explicitly marked. Dates are repository or npm observations made on 2026-08-06.

| Project | Engine version and artifact | Wrapper and artifact licence | API and reuse | Status | Measured size | Verdict |
|---|---|---|---|---|---:|---|
| [EEcircuit-engine](https://github.com/eelab-dev/EEcircuit-engine), npm `eecircuit-engine` | npm 1.7.0 reports `ngspice-45.2+`, compiled 2026-03-24, KLU | Wrapper MIT. Embedded ngspice is mixed BSD, MIT-compatible sparse, LGPL KLU, and LGPL numparam. npm tarball does not include upstream `COPYING`, so it should not be redistributed unchanged. | `Simulation.start()`, `setNetList()`, `runSim()`. Asyncify command loop. Reuses one module. Writes binary `out.raw` and parses real or complex data. Captures stdout and stderr. | Active through 2026-04 in the checked repository, with weekly prerelease npm builds through 2026-06. | npm unpacked 40.69 MB. ESM file 20.42 MB, 5.75 MB gzip. UMD duplicate 20.26 MB. | Best proven integration pattern. Fork the approach, not the package payload. |
| [z-wasm/ngspice-wasm](https://github.com/z-wasm/ngspice-wasm), npm `@o.z/ngspice-wasm` | Build script pins ngspice-46. Single-file Emscripten bundle. Runtime test selected SPARSE 1.3 even though the README implies KLU. | Wrapper says BSD-3-Clause. Artifact enables CIDER, disables XSPICE and OSDI, and includes BSD core plus LGPL numparam. The repository `LICENSE` is an incomplete placeholder, although the npm tarball includes `COPYING`. | README claims `_malloc` and `_ngSpice_Command`, but both were absent in the tested artifact. `_main` works with stack allocation and writes rawfiles, but a second `_main` call on the same instance exited with status 1. stdout and stderr hooks work. | One commit and one npm release, 2026-05-27. | 7.21 MB single JS, 2.48 MB gzip. | Small and current, but API documentation and repeated-run behavior failed empirical checks. Not selected. |
| [wokwi/ngspice-wasm](https://github.com/wokwi/ngspice-wasm) | Builds SourceForge branch `minimal-ngspice`, which identifies as ngspice-38. No prebuilt release. | Wrapper MIT. Minimal branch retains only a small device subset. XSPICE table code is absent. The final artifact still inherits applicable ngspice component licences. | Asyncify plus patched stdin and callback hooks. Intended for an interactive loop, but there is no supported npm API or prebuilt artifact. | Wrapper last changed 2022-11. The upstream minimal branch last changed 2023-12. | Not measurable without rebuilding. | Useful minimalization reference, but too old and unmaintained. |
| [danchitnis/ngspice](https://github.com/danchitnis/ngspice) | Current repository is build tooling and points WASM users to EEcircuit-engine. | Tooling MIT. Generated artifacts inherit ngspice licences. | No current standalone WASM package API. | Updated 2026-05, but WASM ownership moved to EEcircuit-engine. | No current standalone artifact. | Reference and lineage only. |
| [tscircuit/ngspice](https://github.com/tscircuit/ngspice) | Browser app with checked-in 6.35 MB `spice.wasm`; build clones an unpinned ngspice mirror. | App wrapper MIT. Generated artifact inherits ngspice licences. Build disables XSPICE but does not pin the source revision. | Asyncify stdin callbacks, MEMFS, raw output. App-focused rather than a maintained engine package. | Last checked commit 2024-11. | WASM 6.35 MB, 2.03 MB gzip; glue 156 KB. | Demonstrates a separate WASM asset, but source pinning and maintenance are inadequate. |
| [`@tscircuit/ngspice-spice-engine`](https://www.npmjs.com/package/@tscircuit/ngspice-spice-engine) | npm 0.0.20 is a 41 KB adapter. It fetches an EEcircuit engine bundle from tscircuit's CDN at runtime. | Adapter package metadata does not declare a licence. Loaded EEcircuit payload retains its own MIT wrapper and mixed ngspice obligations. | tscircuit request adapter. It is not a self-contained ngspice artifact and adds a runtime CDN dependency. | Published 2026-07-24. | 41 KB unpacked, excluding the remotely fetched engine. | Not suitable for OpenCircuit's self-contained worker package. |
| [Concord build-ngspice-js](https://github.com/concord-consortium/build-ngspice-js) | ngspice-26 fork, Emscripten JavaScript or asm.js era rather than modern WASM. Device set stripped to basic sources, RLC, diode, BJT, and switch. | Build wrapper MIT. ngspice-26 predates the current consolidated modified-BSD licensing position and requires a separate historical audit. | Patched stdin main loop. No supported callable API. | Archived 2023; code last changed 2015. | About 2.5 MB as reported by its README. | Historical proof only. Do not use. |
| [ngspiceX](https://github.com/shishir-dey/ngspiceX) | Checked-in third-party Dan Chitnis WASM artifact, exact ngspice version not recorded. | No licence field or root licence file was present in the checked checkout. Upstream artifact obligations are not packaged clearly. | React hook reloads the ngspice script for commands. Runs on the main thread. Abort and workers are roadmap items. | Last checked commit 2026-03. | WASM 4.41 MB, 1.49 MB gzip; glue 88 KB. | Useful UI demo, not a reusable or compliant engine distribution. |

## Why the EEcircuit pattern wins

1. **Repeated runs are proven.** One `Simulation` instance ran operating point, transient, AC, then operating point again. The repeated operating point completed in 0.35 ms in the clean-environment verification and returned the same voltage bit for bit.
2. **Raw output is proven.** The wrapper writes a native binary ngspice rawfile into MEMFS. The same structure can be parsed without converting through text or allocating one JavaScript object per complex sample.
3. **Worker compatibility is built in.** Its Emscripten build targets `web,worker`, and the repository has browser regression tests.
4. **Cancellation has a reliable escape hatch.** ngspice is synchronous C code after entry. A Worker can always be terminated if a circuit hangs or exceeds a deadline.
5. **The integration surface is narrow.** OpenCircuit only needs netlist input, a small command sequence, rawfile output, diagnostics, and lifecycle control. It does not need to expose ngspice's whole interactive shell to application code.

## From-source fallback and product build

The npm proof artifact is not the final product build because it is ngspice-45.2+, embeds large PDK model strings, duplicates ESM and UMD payloads, does not cap maximum memory, and does not package all required ngspice notices.

### Pins

```text
ngspice: ngspice-46
commit: ebdaf58ec76a06ffaac7e0f138360dd1cf5ee4b6
source: https://git.code.sf.net/p/ngspice/ngspice
emsdk: 5.0.7
```

### Configure profile

```sh
export CFLAGS="-O3 -DNDEBUG -DEMSCRIPTEN"
export LDFLAGS="-O3"

emconfigure ../configure \
  --host=wasm32-unknown-emscripten \
  --enable-static \
  --disable-shared \
  --disable-debug \
  --disable-openmp \
  --disable-xspice \
  --disable-osdi \
  --disable-cider \
  --disable-pss \
  --without-tcl \
  --with-readline=no \
  --with-editline=no \
  --with-fftw3=no \
  --without-x \
  --enable-klu \
  ac_cv_prog_cc_cross=yes \
  ac_cv_func_malloc_0_nonnull=yes \
  ac_cv_func_realloc_0_nonnull=yes
```

Notes:

- `--enable-klu` is the actual ngspice option. `--with-klu=yes`, seen in one third-party script, is not the declared configure switch.
- CIDER is opt-in and is disabled explicitly for clarity.
- XSPICE is enabled by default and must be disabled explicitly. This also excludes the GPL table code model.
- OSDI is enabled unless disabled and must be disabled explicitly to exclude MPL-2.0 sources.
- tclspice is not built without `--with-tcl`.
- numparam is part of the normal frontend build and has no configure switch. Its LGPL obligations remain even if KLU is disabled.

### Emscripten link profile

Use the EEcircuit command-loop patch or an equivalent small patch that yields at the frontend input boundary. Link the CLI executable with:

```text
-O3
-s ASYNCIFY=1
-s MODULARIZE=1
-s EXPORT_ES6=1
-s ENVIRONMENT=web,worker,node
-s EXPORTED_RUNTIME_METHODS=['FS','Asyncify','callMain']
-s ALLOW_MEMORY_GROWTH=1
-s INITIAL_MEMORY=67108864
-s MAXIMUM_MEMORY=268435456
-s STACK_SIZE=1048576
-s EXIT_RUNTIME=0
-s FILESYSTEM=1
```

Also:

- Emit `ngspice.mjs` and `ngspice.wasm` separately. Do not use `SINGLE_FILE=1`.
- Export only the runtime methods and bridge functions actually used. Do not use `EXPORT_ALL=1`.
- Keep assertions and source maps in a development build, but disable them in release builds.
- Preserve exact source, patches, configuration, Emscripten pin, and link command in the repository and release artefacts.
- Add a build-time smoke test that checks the runtime banner, confirms KLU is selected, runs all three netlists, repeats an operating point without reinstantiation, and verifies that XSPICE, OSDI, CIDER, and tclspice are absent.

The 256 MiB maximum is a product choice, not an Emscripten default. With memory growth enabled, Emscripten otherwise defaults to a 2 GiB maximum. The worker supervisor should also enforce a rawfile byte limit and terminate the worker if it is exceeded.

## Licence audit

This section is an engineering compliance checklist, not legal advice.

### Recommended compiled modules

| Module | Included | Licence in official ngspice-46 `COPYING` | Consequence |
|---|---:|---|---|
| ngspice analog core and device models | Yes | Modified BSD / BSD-3-Clause | Reproduce copyright notice, three conditions, and disclaimer in binary distribution documentation or other materials. Do not imply endorsement. |
| SPARSE 1.3 | Yes | Unnamed MIT-style licence, compatible with New BSD | Retain its copyright and permission/disclaimer notices in source and notices bundle. |
| KLU | Yes | LGPL, with source files identifying LGPL-2.1-or-later portions | Prominent notice, LGPL text, corresponding source and modifications, and a practical way to rebuild or relink a modified KLU-containing engine. |
| numparam | Yes, unavoidable in the normal frontend | LGPLv2-or-later according to `COPYING` and source headers | Same LGPL distribution obligations. |
| S-parameter analysis | Yes | Core ngspice licence | Covered by core notices. |
| CIDER | No | Core modified BSD in current ngspice | No runtime notice beyond what is already in full upstream `COPYING`, but source archive still carries its notices if present. |
| XSPICE | No | Public domain, except `src/xspice/icm/table`, GPLv2-or-later | Excluding all XSPICE avoids the GPL table code model and reduces scope. |
| OSDI | No | MPL-2.0 | No MPL-covered OSDI files in the artifact. |
| tclspice | No | LGPLv2 | Not compiled without Tcl mode. |
| ngspice manual | No | CC-BY-SA-4.0 | Do not bundle the manual in the engine package. Link to upstream documentation instead. |

### Exact redistribution package

Every shipped OpenCircuit engine release should include or link prominently to:

1. `THIRD_PARTY_NOTICES.txt` naming ngspice, its version and commit, the ngspice team and Regents copyright, the modified BSD conditions and disclaimer, SPARSE notices, KLU notices, numparam notices, and Emscripten runtime notices.
2. The complete official ngspice-46 `COPYING` file, unmodified.
3. The full LGPL licence text applicable to KLU and numparam.
4. A source archive or stable source URL containing the exact ngspice-46 source, all OpenCircuit patches, interface definitions, and build scripts used for the distributed WASM.
5. The Emscripten 5.0.7 pin and exact build command.
6. Relinking materials sufficient for a recipient to replace or modify the LGPL parts and regenerate the WASM. The safest route for this open-source project is the complete corresponding source plus reproducible build container and retained intermediate object or bitcode files for the engine release.
7. A prominent UI or About-page notice that the product uses ngspice and that the relevant components are covered by their listed licences.
8. Terms that permit reverse engineering for debugging modifications to LGPL components.

Because the browser application loads the engine as a separate Worker module and communicates by messages, keep application code and the ngspice WASM artifact as separate files. This clean boundary helps show that the application is an independent work using a separately distributed engine. It does not remove obligations for the LGPL code inside the WASM engine itself.

The tested `eecircuit-engine@1.7.0` npm tarball includes only its MIT wrapper licence and omits official ngspice `COPYING`. The `@o.z/ngspice-wasm` repository licence file is an incomplete placeholder. These packaging defects are another reason to build and publish our own fully noticed artifact.

Primary licence sources:

- [Official ngspice-46 COPYING](https://sourceforge.net/p/ngspice/ngspice/ci/ngspice-46/tree/COPYING)
- [Official ngspice-46 configure options](https://sourceforge.net/p/ngspice/ngspice/ci/ngspice-46/tree/configure.ac)
- [Official ngspice FAQ, legal issues and component composition](https://ngspice.sourceforge.io/faq.html)
- [GNU LGPL 2.1](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html)
- [Emscripten licence](https://github.com/emscripten-core/emscripten/blob/main/LICENSE)

## Worker protocol sketch

The public package should expose promise-based methods while the worker transport stays explicit.

```ts
type AnalysisRequest =
  | { id: number; type: "runOpPoint"; netlist: string; limits?: RunLimits }
  | { id: number; type: "runTransient"; netlist: string; limits?: RunLimits }
  | { id: number; type: "runAC"; netlist: string; limits?: RunLimits };

type RunLimits = {
  timeoutMs?: number;
  maxNetlistBytes?: number;
  maxRawBytes?: number;
  maxPoints?: number;
};

type WorkerResponse =
  | { id: number; type: "result"; analysis: "op" | "tran" | "ac"; vectors: VectorMeta[]; buffers: ArrayBuffer[]; diagnostics: Diagnostic[] }
  | { id: number; type: "error"; code: "PARSE" | "CONVERGENCE" | "LIMIT" | "ENGINE" | "CANCELLED"; message: string; diagnostics: Diagnostic[] }
  | { id: number; type: "ready"; engineVersion: string; solver: string };
```

Suggested package facade:

```ts
interface SimEngine {
  runOpPoint(netlist: string, options?: RunOptions): Promise<OpPointResult>;
  runTransient(netlist: string, options?: RunOptions): Promise<TransientResult>;
  runAC(netlist: string, options?: RunOptions): Promise<ACResult>;
  cancel(requestId?: number): void;
  dispose(): void;
}
```

Lifecycle:

1. The supervisor creates one Worker and waits for `ready`.
2. The Worker initializes ngspice once and keeps it alive between requests.
3. One request runs at a time. A new request can replace a queued but not started request.
4. `cancel()` terminates the Worker immediately. The supervisor rejects the active promise as `CANCELLED`, creates a new Worker, and warms a new engine instance.
5. A timeout uses the same termination path.
6. Results are transferred, not cloned. Real vectors use one `Float64Array` each or a packed matrix. Complex AC vectors use interleaved real and imaginary doubles.
7. The Worker deletes the prior netlist, plots, and rawfile before every run and uses `destroy all` to prevent state leakage.

Recommended initial limits:

- Netlist text: 1 MiB.
- Rawfile: 128 MiB.
- Points: 1,000,000 total samples across exported vectors.
- WASM memory maximum: 256 MiB.
- Interactive operating point timeout: 2 seconds after warm-up.
- Transient and AC default timeout: 10 seconds, configurable up to a product maximum.
- Includes: only files explicitly supplied through a controlled virtual include map. No host or network file access.

## Raw output plan

Use ngspice binary rawfiles as the primary output format.

- They preserve `double` values directly.
- Real analyses store one little-endian Float64 per variable per point.
- AC analyses store real and imaginary Float64 pairs.
- Header parsing yields plot name, flags, variable count, point count, variable names, and types.
- Validate counts and expected byte length before allocating views.
- Enforce limits before materializing result buffers.
- Copy or slice into final transferable `ArrayBuffer` objects only once.

`wrdata` is useful for debugging and interoperability, but ASCII conversion is slower, larger, and less precise as the primary browser transport.

## Architecture suitability

| Requirement | Assessment |
|---|---|
| Web Worker | Pass. EEcircuit build targets Worker runtime. Product build should remove main-thread support from normal use. |
| Cancellation | Pass with terminate and reinstantiate. In-process cancellation is not required for the first release. |
| Bounded memory | Conditional pass. The proof package enables growth but does not set a maximum, so the product build must set `MAXIMUM_MEMORY=256 MiB` and enforce rawfile limits. |
| Repeated fast reruns | Pass. Same module reused across four sequential runs; repeated operating point took 0.35 ms in the clean-environment verification. |
| Raw output capture | Pass. Binary `out.raw` was captured from MEMFS and parsed for real and complex analyses. |
| Numeric agreement | Pass. Operating point relative error was 0 and scripted transient and AC checkpoints agreed within floating-point noise. |
| Isolation | Pass. Worker termination clears engine state and releases the WASM heap. |

## Risks

1. **LGPL compliance for a monolithic WASM engine.** KLU and numparam are linked into the ngspice engine. Mitigation: ship full notices, exact source and patches, a reproducible build container, and relinking materials. Keep the app and Worker engine as separate files.
2. **Asyncify maintenance and performance.** The proven repeated-run path patches ngspice's command-input loop and uses Asyncify, which adds code size and can break when upstream control flow changes. Mitigation: pin ngspice and Emscripten, keep the patch small, and gate upgrades with Node and real-browser reuse tests.
3. **Memory and hostile netlists.** Adaptive transient analyses, huge sweeps, behavioral sources, or convergence failures can consume substantial CPU and memory. Mitigation: Worker isolation, a 256 MiB cap, rawfile and point limits, deadlines, controlled includes, and terminate-on-cancel.
4. **Proof artifact is one release behind.** Numeric testing used ngspice-45.2+ WASM against native ngspice-46. The selected product pin is ngspice-46 and must be rebuilt and rerun through this exact harness before release.
5. **Bundle weight.** The proof npm package transfers 5.75 MB gzip because it embeds the engine and large model libraries. Mitigation: emit a separate WASM file, omit bundled PDKs, cache it aggressively, and measure the final custom build rather than assuming a target size.

## Final gate before product integration

The spike proves feasibility and selects the path. Before merging a production `sim-engine` package, build the pinned ngspice-46 artifact and require all of the following:

- The same three tests pass against native ngspice-46.
- Repeated runs use one module and do not grow memory indefinitely.
- The runtime banner identifies ngspice-46 and confirms KLU.
- A real Chromium Worker test passes.
- Terminating a long transient releases the Worker and a new Worker can run an operating point.
- The generated third-party notice bundle is present and reviewed.
- The final `.wasm`, compressed transfer size, initialization time, warm operating-point time, and peak memory are recorded.

## Sources

- [ngspice official site](https://ngspice.sourceforge.io/)
- [ngspice official source and COPYING](https://sourceforge.net/p/ngspice/ngspice/ci/ngspice-46/tree/)
- [EEcircuit-engine](https://github.com/eelab-dev/EEcircuit-engine)
- [wokwi/ngspice-wasm](https://github.com/wokwi/ngspice-wasm)
- [danchitnis/ngspice](https://github.com/danchitnis/ngspice)
- [z-wasm/ngspice-wasm](https://github.com/z-wasm/ngspice-wasm)
- [Concord build-ngspice-js](https://github.com/concord-consortium/build-ngspice-js)
- [tscircuit/ngspice](https://github.com/tscircuit/ngspice)
- [ngspiceX](https://github.com/shishir-dey/ngspiceX)
- [Emscripten settings reference](https://emscripten.org/docs/tools_reference/settings_reference.html)
