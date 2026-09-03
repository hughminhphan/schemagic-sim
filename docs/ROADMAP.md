# Roadmap

Everything on this page is subject to change. Priorities may move as numerical issues, contributor needs, browser constraints, and model-review findings emerge.

If a roadmap item matters to your work, or if a missing item should be considered, please open a GitHub issue with the circuit, use case, and evidence behind the request.

## Execution status (2026-09-03)

Wave 1 and nine Wave 2 PRs ([#26](https://github.com/hughminhphan/schemagic-sim/pull/26) through [#34](https://github.com/hughminhphan/schemagic-sim/pull/34)) are merged. The Simulator gained twelve teaching circuits, compact backward-compatible sharing, read-only embeds, group clipboard editing, and a Falstad/CircuitJS share importer. The model tools gained real JFET fitting, a small-signal MOSFET F2-DC policy, guarded storage pruning and restoration, and bounded fresh bench replay. D.2 remains partial: bound-aware buck calculators landed, but the installed strict policy still returns no eligible buck candidate. Task 2.5 also remains partial until the 5.3 GB catalog is moved to external storage. Current task-level status is in [BACKLOG.md](BACKLOG.md).

## v0.2.0 release-candidate baseline

The Simulator now includes focused DC-sweep and noise interfaces, a Measurement Workbench, KiCad-derived editor interactions, typed probes, cancellable run provenance, and validated namespaced user `.model`/`.subckt` imports kept separate from reviewed project models. The same web release also exposes the Motor/Power Designer and validates 771 evidence-bearing model packages. The remaining work below starts from that integrated baseline.

## Near

- **Close the release-evidence loop.** Add authenticated runtime/KiCad attachments plus recorded manual assistive-technology checks without weakening fail-closed audit gates. Production offline/cache behavior is verified for this RC; the remaining evidence is tracked in [#12](https://github.com/hughminhphan/schemagic-sim/issues/12).
- **Complete fresh replay coverage.** The bounded release command now enumerates the reviewed package benches and reports every pass, failure, skip, and budget stop. Noise replay remains unsupported, and the scheduled run is advisory until it can complete without skipped benches.
- **Grow the reviewed model library.** Continue beyond the 771-package v0.2 release-candidate inventory in [#18](https://github.com/hughminhphan/schemagic-sim/issues/18) while preserving provenance, fidelity labels, native-versus-WebAssembly gates, and independent review.
- **Documentation internationalization.** Establish an i18n structure for user and contributor documentation, then translate high-value getting-started and model-contribution pages.

## Mid

- **Bench-calibrated F4 program.** Define the sampling, instrumentation, calibration, uncertainty, raw-data, and reproducibility contract required for measurement-calibrated F4 models.
- **WebGPU-accelerated rendering.** Investigate WebGPU for large-schematic rendering and waveform display. This would accelerate visualization, not replace ngspice as the numerical solver.

## Far

- **Collaborative sharing without accounts.** Explore a collaboration model that preserves the project's no-account principle and does not make a hosted database mandatory for ordinary simulation or durable single-user share links.
- **MCU peripheral boundary.** Detailed MCU peripherals, firmware execution, instruction-set emulation, and full embedded-system simulation remain out of scope. Behavioral-analog blocks may represent selected interfaces when their approximations and limits are explicit.

## How priorities are chosen

Roadmap decisions will favor reproducible numerical evidence, clear educational or engineering value, maintainable browser architecture, and features that preserve honest model labeling. An issue or pull request is welcome, but inclusion and timing remain subject to change.
