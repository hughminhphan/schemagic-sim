# Roadmap

Everything on this page is subject to change. Priorities may move as numerical issues, contributor needs, browser constraints, and model-review findings emerge.

If a roadmap item matters to your work, or if a missing item should be considered, please open a GitHub issue with the circuit, use case, and evidence behind the request.

## Execution status (2026-09-04)

Wave 1 and nine Wave 2 PRs ([#26](https://github.com/hughminhphan/schemagic-sim/pull/26) through [#34](https://github.com/hughminhphan/schemagic-sim/pull/34)) are merged. The pre-launch integration in [PR #35](https://github.com/hughminhphan/schemagic-sim/pull/35) completes the honest Designer empty state, authored-symbol pin names, comparator admission, Motor timing stabilization, the 1N5822 review, and Simulator tasks 1.1 through 1.3. The Simulator now has 19 built-in teaching circuits and the expanded switch, source, isolation, timing, and protection families; all 771 reviewed manufacturer packages are placeable. Across Phase 0, 1, 2, and D, 28 tasks are done, 3 are partial, and 24 are open; the separate follow-up queue is 4/4 done. Tasks 2.5 and 2.17 remain partial because 470 campaign-cited PDFs are absent but restorable, the 5.3 GB catalog has not moved externally, and noise replay is unsupported. D.2 also remains partial: bound-aware buck calculators landed, but loop stability remains unknown and the installed strict policy still returns no eligible buck candidate. Current task-level status is in [BACKLOG.md](BACKLOG.md).

## v0.2.0 release-candidate baseline

The Simulator now includes focused DC-sweep and noise interfaces, a Measurement Workbench, KiCad-derived editor interactions, typed probes, cancellable run provenance, and validated namespaced user `.model`/`.subckt` imports kept separate from reviewed project models. It also includes typed switches, dependent and behavioural sources, transformers, crystals, transmission lines, Zener diodes, batteries, fuses, and pulsed current sources. The same web release exposes the Motor/Power Designer and validates 771 evidence-bearing, placeable model packages. The remaining work below starts from that integrated baseline.

## Near

- **Close the launch administration gate.** Task 0.8 is the only open Phase 0 task: protect `main`, require a pull request, and require the four named CI checks.
- **Finish Phase 1.** The remaining Simulator work is `.step` parametric sweep (1.4), mobile canvas and layout (1.7), dependency-cycle cleanup (1.10), coverage floors (1.11), Designer-to-Simulator handoff (1.12), privacy-respecting usage counts (1.13), and solved-transient live animation (1.14).

## Mid

- **Bench-calibrated F4 program.** Define the sampling, instrumentation, calibration, uncertainty, raw-data, and reproducibility contract required for measurement-calibrated F4 models.
- **WebGPU-accelerated rendering.** Investigate WebGPU for large-schematic rendering and waveform display. This would accelerate visualization, not replace ngspice as the numerical solver.

## Far

- **Collaborative sharing without accounts.** Explore a collaboration model that preserves the project's no-account principle and does not make a hosted database mandatory for ordinary simulation or durable single-user share links.
- **MCU peripheral boundary.** Detailed MCU peripherals, firmware execution, instruction-set emulation, and full embedded-system simulation remain out of scope. Behavioral-analog blocks may represent selected interfaces when their approximations and limits are explicit.

## How priorities are chosen

Roadmap decisions will favor reproducible numerical evidence, clear educational or engineering value, maintainable browser architecture, and features that preserve honest model labeling. An issue or pull request is welcome, but inclusion and timing remain subject to change.
