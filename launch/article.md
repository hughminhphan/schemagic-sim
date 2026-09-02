# Putting ngspice-46 in a Browser Without Hiding the Engineering Tradeoffs

Browser circuit simulators often use a purpose-specific teaching solver or put SPICE behind a hosted service. Both are useful, but I wanted a different combination for Robonyx Simulator: real ngspice running locally, a schematic that visibly responds to each solve, and manufacturer-part models that show their evidence and limitations.

The result is ngspice-46 compiled to WebAssembly, isolated in a Worker, and paired with a model-validation pipeline that treats native-versus-WebAssembly agreement and independent review as release gates.

## Building a bounded ngspice-46 artifact

The engine is pinned to the official ngspice-46 source and Emscripten 5.0.7. The C source, patches, configure choices, compiler, and runtime glue can all affect control flow, output, memory behavior, and compliance files.

The initial build keeps the ngspice analog core, SPARSE, KLU, numparam, and S-parameter analysis. It disables XSPICE, OSDI, CIDER, PSS, Tcl integration, readline and editline, FFTW, X11, OpenMP, and shared-library output. This is not an attempt to call the resulting engine “minimal.” It is a deliberately bounded feature set for operating point, transient, and AC analysis in a browser.

The Emscripten link emits separate `ngspice.mjs` and `ngspice.wasm` files. The module starts with a 64 MiB heap and has an explicit 256 MiB maximum. In the measured production preview, the WASM response transferred about 1.6 MB with Brotli. Node initialization measured about 90 ms, browser initialization about 2.2 seconds, and warm operating-point solves about 1 ms. These are reference-environment measurements, not general promises.

## Why Asyncify is present

ngspice is a command-line program with synchronous C control flow. The integration needs to supply commands and netlists, allow the frontend loop to yield, run multiple analyses on one initialized instance, and collect output without blocking the browser main thread.

The build applies a small patch at the frontend command-input boundary and enables Emscripten Asyncify. Relevant call paths can unwind when the loop needs JavaScript input and rewind when input is available. A solve remains synchronous C work once it starts, but the command loop can be driven repeatedly without reinstantiating the module.

Asyncify has costs. It increases code size, changes generated control flow, and can break when upstream call paths change. That is why the patch is kept small, the toolchain is pinned, and repeated-run tests are mandatory. Cancellation does not depend on graceful in-process interruption. If a solve exceeds a deadline, the application terminates the Worker and replaces it.

## Keeping KLU and handling its licence

KLU is valuable for sparse circuit matrices, so the build enables the actual ngspice `--enable-klu` configure option and verifies that the expected KLU objects were produced. The smoke test also checks the runtime banner and selected solver rather than assuming a configure flag had the intended effect.

Keeping KLU and numparam creates a licensing responsibility that should not be hidden behind the surrounding application's permissive licence. The original Robonyx application code and documentation are Apache-2.0. Original generated model packages use MIT. The engine is a separate distribution layer containing the ngspice core and device models under modified BSD terms, SPARSE under permissive terms, KLU and related SuiteSparse portions under LGPL terms where identified upstream, numparam under LGPL, and Emscripten runtime support under its upstream terms.

The repository therefore carries the complete ngspice `COPYING` file, the applicable LGPL text, third-party notices, exact source and compiler pins, the local patch, build scripts, corresponding-source information, and rebuild and relink instructions. The application loads the engine as a separate Worker asset and communicates through messages. That boundary is useful architecturally and for distribution clarity, but it does not erase obligations for LGPL code inside the engine.

## The Worker is the product boundary

The browser main thread owns the schematic editor, circuit document, controls, persistence, sharing, and waveform presentation. It generates a deterministic SPICE netlist and sends a typed request to a dedicated module Worker.

The first protocol supports three request types: operating point, transient, and AC. Each request carries an ID, netlist text, and optional limits. The Worker initializes ngspice once, accepts one active request at a time, and reuses the same WebAssembly instance for sequential solves.

For each run, the loader replaces the input file in Emscripten's in-memory filesystem, destroys old plots, runs the requested analysis, writes a binary rawfile, and returns its bytes. The Worker validates the rawfile header, variable count, point count, and expected byte length before materializing vectors. Real analyses produce `Float64` data. AC vectors retain real and imaginary values. Final `ArrayBuffer` objects are transferred to the main thread instead of cloned.

Binary rawfiles preserve ngspice's double-precision output without text conversion or an allocation-heavy object model. The parser remains one narrow, testable boundary.

The Worker enforces a 1 MiB netlist limit, while rawfile and sample limits are checked during parsing. The WebAssembly build has a 256 MiB maximum memory. Interactive operating-point runs default to a two-second timeout, and transient or AC runs default to ten seconds. Imported model text is parsed and sanitized before netlist generation, with command cards, uncontrolled includes, host paths, file I/O, and code-model loading rejected.

The client maintains a current Worker and a pre-warmed spare. A newer request can replace one that is queued but has not started. Cancellation or timeout terminates the current Worker, rejects active work as cancelled, promotes the spare, and starts warming another. It is a blunt mechanism, but it gives synchronous native code a reliable browser-level containment boundary.

## Why native-versus-WebAssembly gates matter

A successful WebAssembly build proves that the module loads. It does not prove that it calculates the same circuit as the native reference.

The reference harness runs the same netlists through pinned native ngspice-46 and the pinned WebAssembly engine. It normalizes vector names, compares operating-point values, interpolates adaptive transient results onto common times, and compares AC magnitude and wrapped phase. The reference suite currently agrees within floating-point noise. In the six-fixture engine suite, maximum relative errors range from zero to roughly `5.7e-12`, with zero measured AC phase error.

This gate also catches version drift, missing devices, solver-selection mistakes, parser errors, complex-vector layout errors, and time-base alignment bugs. Every manufacturer-part bench passes through both engines. A model that only works in one path is not ready to ship.

Native-versus-WebAssembly agreement is necessary, but it is not evidence that the model matches a real component. Two engines can agree perfectly on the same bad model. That is where the factory's second set of gates begins.

## A model factory built around evidence

Each manufacturer-part package contains identity and pin metadata, an original generated `.model` or `.subckt`, source provenance, test expectations, minimal benches, a readable model card, known omissions, a fidelity tier, validation results, and an independent reviewer.

The normal path starts with public factual specifications. Datasheet PDFs remain in an ignored workspace and are not redistributed. The package records the public URL, revision, access date, source hash, exact pages, test conditions, and the distinction between minimum, typical, and maximum values.

That last distinction became a hard rule because the first version of the TL072 model got it wrong.

The factory had produced five initial gold models. Independent adversarial review passed four and failed the TL072. On +/-15 V rails with a 10 kohm load, the model clipped at about +/-9.9 V instead of the datasheet's roughly +/-13.5 V typical swing. At lower supplies, the clamp could collapse and the follower stopped tracking its input across a large part of the model's own declared operating envelope.

The root cause was not an obscure numerical issue. A guaranteed minimum output-swing value had been treated as the typical fitting target. At the same time, the positive and negative rail-drop values were fixed at 5 V each and had never been fitted. The existing benches were internally consistent with the generated model, so they passed while the model remained wrong relative to the datasheet.

The correction changed both the model and the process. The TL072 rail drop was fitted against the 25 C typical. The clamp became supply-aware so its window could not invert at low voltage. The package added explicit metadata for held defaults and MIN/TYP semantics. Expectations were tied back to independently derived datasheet values. Re-review measured +/-13.500 V swing at the target condition and passed the model.

The wider lesson is that “minimum,” “typical,” and “maximum” are not interchangeable columns. Typical values and curves are fitting targets. Minimum and maximum values are hard bounds only under their stated conditions. Test expectations must be derived independently from the fit, or the test suite can become a formal proof that the model agrees with itself.

## Fidelity labels as a design principle

A component model cannot be summarized honestly as accurate or inaccurate. Accuracy depends on the behavior domain, operating region, temperature, loading, frequency, process variation, and the question being asked.

Robonyx uses fidelity tiers from F0 to F4. F0 is structural. F1 is nominal and functional. F2 requires multiple cited typical targets and applicable hard bounds, plus native and WebAssembly agreement for every included bench. F3 extends coverage across more domains, conditions, or documented corners. F4 is reserved for measurement-calibrated models with documented samples, conditions, uncertainty, and reproducibility.

The rule is to choose the lowest tier whose complete evidence exists. A long parameter list does not earn a higher label. Neither does passing a test written from the model's own output. Model cards must state operating regions and omissions such as missing noise, temperature, breakdown, thermal, phase-margin, process, or common-mode behavior.

That honesty is part of the interface, not only documentation for specialists. A manufacturer part in the schematic carries its fidelity label. Imported third-party models remain visibly unverified. The simulator should make it difficult to confuse numerical precision with physical certainty.

## What the first release does not claim

The first release supports operating point, transient, and AC analysis. It does not include PCB layout, manufacturing, firmware execution, or detailed MCU peripherals. Digital parts are behavioral-analog approximations. A model only claims noise, temperature, process, breakdown, thermal, or transient fidelity when its card and tests cover those domains.

Simulation results are not a substitute for a prototype, component qualification, or safety review. The goal is narrower: make a capable local SPICE workflow accessible in the browser, make the schematic respond immediately, and make every reviewed part model explain why it deserves the trust it asks for.

That combination is the project: real ngspice, a bounded Worker protocol, reproducible numerical gates, and model labels that are willing to say “not modeled.”
