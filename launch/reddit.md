# Reddit launch drafts

Drafts only. Do not post without Hugh's approval.

Reddit rules and moderator practices change. Check each community's current self-promotion, link, title, flair, participation, and frequency rules immediately before posting. Use a text-first post where allowed, disclose that Hugh built the project, and stay in the thread to answer technical questions.

## r/electronics

**Preflight:** Check the current self-promotion and project-showcase rules. A mod message is advisable before posting because this is the builder linking a newly launched project.

**Suggested title:**

> I built an open-source browser circuit simulator with local ngspice and a living schematic

**Draft:**

I built scheMAGIC Sim, a free open-source circuit simulator that runs ngspice-46 locally in a browser Worker.

The part I wanted was a schematic that responds directly to the solve. Wires change colour with node voltage, current is animated, and dragging a potentiometer updates the LED brightness and measured values. It supports operating point, transient, and AC views, works offline after caching, and shares circuits in the URL without an account.

I have also been working on manufacturer-part models with source provenance, cited tests, fidelity labels, and independent review. One of the first five gold models failed review: the TL072 model clipped too early because a guaranteed minimum output-swing value had been treated as a typical fitting target. I refit it and the re-review passed. I am keeping that failure and correction visible because model limits matter more than a long parts list.

The v0.1 library count is still being finalized: {{MPN_COUNT}} MPNs, with {{F2_COUNT}} at F2 or above. F2 means multiple cited typical targets and applicable hard bounds are tested, plus native and WebAssembly ngspice agree for each included bench. It is not a certification.

I would be interested in feedback on the interaction, circuits that expose bad visual assumptions, and parts that would be useful to validate next.

Live: https://sim.schemagic.design

Source: https://github.com/hughminhphan/schemagic-sim

## r/ElectricalEngineering

**Preflight:** Check whether project links are permitted and whether an educational, technical, or discussion framing is required. A mod message is advisable because the post links a project built by the submitter.

**Suggested title:**

> Technical feedback wanted: ngspice-46 compiled to WASM with native comparison gates

**Draft:**

I have been building scheMAGIC Sim, an Apache-2.0 browser circuit editor around a pinned ngspice-46 WebAssembly engine. The normal solve path is entirely local and runs in a dedicated Worker.

The engine uses a small Asyncify patch at the frontend command boundary, KLU, a 64 MiB initial heap with a 256 MiB maximum, and binary rawfiles in MEMFS. Real vectors and interleaved complex vectors are parsed in the Worker and transferred as `Float64` buffers. Cancellation terminates the Worker and replaces it with a warm spare.

On the reference suite, native ngspice-46 and the WASM build agree to floating-point noise. The measured warm operating-point solve is about 1 ms. Initialization was about 90 ms in Node and 2.2 seconds in the measured browser build. The Brotli WASM response was about 1.6 MB. These are measurements from one reference environment, not general performance claims.

The manufacturer-part library has a separate validation pipeline. Public datasheet facts become fitting targets and independently derived expectations. Every included bench must pass its cited bounds and agree between native and WASM ngspice. Each package also carries provenance, operating-region claims, known omissions, a fidelity tier, and an independent reviewer.

The first independent review caught a useful failure in the TL072 gold model. A minimum output-swing specification had been consumed as a typical target, and an unfitted 5 V rail-drop constant made the model clip at about +/-9.9 V on +/-15 V rails. It also broke across much of its declared low-supply range. The model was refit against the 25 C typical, the clamp was made supply-aware, and re-review passed.

I would value scrutiny of the worker protocol, rawfile handling, numerical comparison method, fidelity definitions, and model test conditions. Reproducible discrepancy reports are especially useful.

Technical architecture: https://github.com/hughminhphan/schemagic-sim/blob/main/docs/ARCHITECTURE.md

Live simulator: https://sim.schemagic.design

## r/AskElectronics

**Preflight:** Do not make a self-post just to announce the project. Only use this as a comment when it directly answers a question asking for a free browser simulator, a Falstad alternative with SPICE, a no-account tool, or a way to inspect a simple circuit. Check current link and self-promotion rules. If linking your own project in an answer is unclear, message the moderators first. Keep the disclosure in the comment.

**Comment-style answer draft:**

If you want a browser option, Falstad is still useful for quick visual intuition. Another option is scheMAGIC Sim, which I built, so treat this as a disclosed self-reference rather than an independent recommendation.

It runs ngspice-46 locally in a browser Worker and supports operating point, transient, and AC analysis. The schematic shows voltage by wire colour and current by motion, and interactive controls such as a potentiometer trigger new solves. It does not require an account, works offline after its assets are cached, and can share a circuit in the URL.

The limitations matter: there is no PCB workflow, firmware execution, or detailed MCU peripheral model. Digital parts are behavioral-analog. Manufacturer-part fidelity varies, and each shipped model has a model card and explicit omissions rather than a blanket accuracy claim.

Live: https://sim.schemagic.design

Source and model evidence: https://github.com/hughminhphan/schemagic-sim

For a design decision, I would still prototype the circuit and check the specific model card, operating region, and component datasheet.

## r/opensource

**Preflight:** Check current project-promotion, title, flair, and participation rules. A mod message is advisable if recent project posts are restricted or require prior community participation.

**Suggested title:**

> scheMAGIC Sim: Apache-2.0 browser circuit simulator with a reproducible ngspice-46 WASM build

**Draft:**

I am releasing scheMAGIC Simulator, a free open-source browser circuit simulator.

The application code and documentation are Apache-2.0. Original generated component model packages carry MIT licences. The ngspice-46 WebAssembly engine is handled as a separate distribution layer with its upstream modified BSD and LGPL obligations, plus Emscripten terms. The repository includes source pins, patches, build scripts, licence texts, corresponding-source information, and rebuild and relink instructions.

The normal simulation path runs locally in a dedicated Worker. There is no account or server-side solve API. Workspaces stay in the browser, the app works offline after caching, and circuits can be shared in the URL.

The model contribution contract is evidence-focused. Each manufacturer-part package includes source provenance, an original generated SPICE model, cited expectations, native ngspice benches, native-versus-WASM comparisons, a model card, known omissions, a fidelity tier, and an independent reviewer. Datasheet PDFs and vendor model files are not committed through the normal contribution path.

Contributions are welcome in code, docs, tests, numerical discrepancy reports, and component model packages. The repository uses DCO sign-off for external contributions.

Source: https://github.com/hughminhphan/schemagic-sim

Live: https://sim.schemagic.design

Contributing: https://github.com/hughminhphan/schemagic-sim/blob/main/CONTRIBUTING.md
