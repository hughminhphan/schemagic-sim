# Roadmap

Everything on this page is subject to change. Priorities may move as numerical issues, contributor needs, browser constraints, and model-review findings emerge.

If a roadmap item matters to your work, or if a missing item should be considered, please open a GitHub issue with the circuit, use case, and evidence behind the request.

## Near

- **Grow the reviewed model library.** Expand the manufacturer-part catalog beyond the v0.1 inventory while preserving provenance, fidelity labels, native-versus-WebAssembly gates, and independent review.
- **Noise analysis.** Add an ngspice noise-analysis path, result schema, worker protocol support, and a viewer that makes input and output noise assumptions explicit.
- **DC sweep UI.** Add a focused interface for sweeping sources or parameters without requiring users to edit a netlist.
- **Documentation internationalization.** Establish an i18n structure for user and contributor documentation, then translate high-value getting-started and model-contribution pages.

## Mid

- **User subcircuit libraries.** Let users organize, validate, and reuse their own namespaced `.model` and `.subckt` collections while keeping imported content visibly separate from reviewed project models.
- **Bench-calibrated F4 program.** Define the sampling, instrumentation, calibration, uncertainty, raw-data, and reproducibility contract required for measurement-calibrated F4 models.
- **WebGPU-accelerated rendering.** Investigate WebGPU for large-schematic rendering and waveform display. This would accelerate visualization, not replace ngspice as the numerical solver.

## Far

- **Collaborative sharing without accounts.** Explore a collaboration model that preserves the project's no-account principle and does not make a hosted database mandatory for ordinary simulation or durable single-user share links.
- **MCU peripheral boundary.** Detailed MCU peripherals, firmware execution, instruction-set emulation, and full embedded-system simulation remain out of scope. Behavioral-analog blocks may represent selected interfaces when their approximations and limits are explicit.

## How priorities are chosen

Roadmap decisions will favor reproducible numerical evidence, clear educational or engineering value, maintainable browser architecture, and features that preserve honest model labeling. An issue or pull request is welcome, but inclusion and timing remain subject to change.
