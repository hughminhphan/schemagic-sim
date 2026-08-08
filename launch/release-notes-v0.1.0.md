# scheMAGIC Simulator v0.1.0

Draft release notes. Model counts remain placeholders until the release inventory is finalized.

## Features

- Real ngspice-46 compiled to WebAssembly and executed locally in a dedicated browser Worker.
- Living schematic feedback with voltage-hued wires, animated current, and interactive potentiometer, switch, and LED behavior.
- Operating-point, transient, and AC analysis with scope and Bode views.
- Manufacturer-part library with 102 MPNs, including 25 models at F2 or above.
- A provenance record, fidelity tier, model card, cited tests, known omissions, and independent review status for every shipped model package.
- Native ngspice-46 versus WebAssembly comparison gates for included model benches.
- Local browser workspaces, JSON import and export, SPICE netlist export, and share-by-URL circuits.
- Offline use after the application shell and engine have been cached.
- Sanitized import of supported SPICE model and subcircuit text, clearly marked as unverified.
- No account and no server-side simulation dependency for normal use.

## Measured engine numbers

These measurements come from the release reference environment and are not cross-machine guarantees.

- Reference-suite native versus WebAssembly agreement: within floating-point noise.
- Warm operating-point solve: about 1 ms.
- Engine initialization: about 90 ms in Node and 2.2 seconds in the measured browser build.
- WebAssembly transfer: about 1.6 MB with Brotli in the measured production preview.
- Five initial gold models independently reviewed. One initially failed, was refit, and passed re-review.

## Known limitations

- Fidelity tiers are engineering estimates of tested coverage, not certifications or guarantees for every physical unit.
- Analyses are limited to operating point, transient, and AC.
- There is no PCB layout, routing, manufacturing, or mechanical workflow.
- Digital components use behavioral-analog approximations.
- Firmware and detailed MCU peripheral simulation are out of scope.
- Noise, temperature, process, breakdown, thermal, and transient fidelity vary by model and are only claimed when the model card and tests say so.
- Imported models are sanitized and marked unverified, but the user remains responsible for their accuracy and licence terms.
- Browser startup time depends on device, browser, cache state, and network conditions.

## Upstream thanks

Thank you to the [ngspice](https://ngspice.sourceforge.io/) project and its contributors for the simulation engine, device models, and decades of engineering work that make this project possible.

Thank you to the [Emscripten](https://emscripten.org/) project and its contributors for the compiler and runtime tooling used to build ngspice for WebAssembly.

The engine also includes upstream SPARSE, KLU and SuiteSparse, and numparam components under their respective terms. See `THIRD_PARTY_NOTICES.md` and `tools/ngspice-wasm-build/notices/` for notices, licence texts, corresponding-source information, and rebuild instructions.
