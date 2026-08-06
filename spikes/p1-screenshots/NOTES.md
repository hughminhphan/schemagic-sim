# Phase 1 browser proof

Measured in Playwright Chromium 140 at 1440 x 900 on 2026-08-06 using the production Vite build and preview server.

- Worker-hosted engine: eecircuit-engine 1.7.0, ngspice 45.2+ WebAssembly
- Engine initialization: 420.5 ms
- Warm operating-point solves: median 1.60 ms, range 0.80 to 2.30 ms across 7 measured solves
- WASM proof bundle transfer: 5,746,871 bytes compressed over HTTP. The Vite worker asset is 20,267,840 bytes uncompressed and contains the embedded WebAssembly payload.
- Largest rawfile observed in the tested op, transient, and AC sequence: 29,473 bytes
- Main-thread long tasks during the measured live pot interaction: 0 where Chromium exposed PerformanceObserver `longtask` entries
- Cross-origin isolation required: no. The interim Asyncify engine does not use SharedArrayBuffer or WebAssembly threads.

Static hosting requirements:

1. Serve JavaScript worker assets with a JavaScript MIME type and WOFF2 files with `font/woff2`.
2. Serve `sw.js` from the site root over HTTPS in production so its scope covers the application.
3. Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers are not required for Phase 1. If a future threaded engine uses SharedArrayBuffer, both headers will become required and must be documented at that point.

Screenshots:

- `default-view.png`: live operating point with the real worker result driving voltage hue, current motion, LED output, and measurements.
- `tran-scope-open.png`: driven wiper transient with the collector trace in the bottom scope.
- `reduced-motion.png`: motion disabled, with quantised wire widths and static direction chevrons.
