# scheMAGIC Simulator

[![CI](https://github.com/hughminhphan/schemagic-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/hughminhphan/schemagic-sim/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/live-sim.schemagic.design-1B9350)](https://sim.schemagic.design)

scheMAGIC Simulator is a free, open-source circuit simulator that runs real ngspice locally in your browser and makes the schematic itself show what the circuit is doing.

<!--
DEMO GIF SHOT LIST, RECORD IN THIS EXACT ORDER:
1. Load the default NPN LED bench and wait until ENGINE READY is visible.
2. Select the potentiometer and drag its wiper from low to high.
3. Hold long enough to show the LED brightening, voltage-hued wires changing, and current motion responding.
4. Open the scope and show the active trace.
5. Switch to AC, run the configured sweep, and end on the Bode view.
Keep the pointer visible, avoid cuts during the pot drag, and return the final GIF to the default 1280 x 720 capture framing specified in launch/social-preview-spec.md.
-->

> **Demo GIF placeholder:** `launch/assets/demo.gif`

| Try it live | Run locally |
| --- | --- |
| Open [sim.schemagic.design](https://sim.schemagic.design). No account or installation is required. | `git clone https://github.com/hughminhphan/schemagic-sim.git`<br>`cd schemagic-sim`<br>`npm install`<br>`npm run dev` |

## Open an example circuit

[Open the interactive NPN LED bench]({{EXAMPLE_URL}}). The circuit is encoded in the URL and opens immediately without a database or account.

## Comparison

The projects below make different tradeoffs. This table covers claims that can be checked from public product behavior, documentation, licensing, and this repository.

| Capability | Falstad / CircuitJS1 | CircuitSim | scheMAGIC Simulator |
| --- | --- | --- | --- |
| Simulation engine | Custom modified nodal analysis solver | Browser SPICE | ngspice-46 compiled to WebAssembly, running locally |
| Live voltage and current visualization | Yes | Partial | Yes |
| Manufacturer part numbers | No | Yes | Yes |
| Model provenance and test evidence | No per-part provenance cards | Parts, without per-part provenance cards | Every shipped model has sources, tests, a fidelity tier, and a model card |
| Free circuit size limit | None | Basic plan limits circuits to 5 components | None |
| Account required | No | Required for saving | No |
| Offline use | Standalone version available | Requires an internet session | Works after the application and engine have been cached |
| Open source | GPLv2+ | No | Yes, application code under Apache-2.0 |
| Import SPICE models | Limited | Yes | Yes, with sanitization and an unverified label |

Falstad is an established open-source teaching tool. CircuitSim provides a broad browser SPICE workflow. scheMAGIC Sim focuses on local ngspice execution, living schematic feedback, and explicit evidence for manufacturer-part models.

## 30-second quickstart

1. Open the [example circuit]({{EXAMPLE_URL}}) and wait for `ENGINE READY`.
2. Select `P1`, then drag **Wiper position** in the inspector.
3. Watch the LED brightness, wire voltage colours, and current animation update with each solve.
4. Click a wire to add a scope trace, then open the scope.
5. Choose **TRAN** for a time-domain plot or **AC** for a Bode plot.
6. Click **Share URL** to copy the circuit as a link.

## Add a component model

Contributions of manufacturer-part models are welcome. A model package lives at `packages/model-library/models/<manufacturer>/<MPN>/` and includes:

- `component.json` for identity, pins, fidelity, supported regions, omissions, generator, reviewer, and validation metadata;
- an original generated `model.cir`;
- `sources.json` with public source provenance and page-level citations;
- `tests/expectations.json` plus native ngspice benches;
- `MODEL_CARD.md` with readable coverage, errors, and omissions;
- a package `LICENSE`.

Models must keep datasheet expectations separate from simulator output, pass the package validator, agree between pinned native ngspice-46 and WebAssembly for every bench, and receive review independent from their author. See [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-component-model) for the full contract and local commands.

## Architecture

```text
Browser main thread
  editor + circuit document + waveform viewer
                    |
                    | typed request, generated netlist
                    v
              Web Worker
                    |
                    v
        ngspice-46 WebAssembly
          KLU + binary rawfile
                    |
                    | transferred Float64 buffers
                    v
       living schematic + scope

Public facts and cited test targets
                    |
                    v
        deterministic model factory
          |                    |
          v                    v
 native ngspice-46       pinned WASM engine
          |                    |
          +------ comparison --+
                    |
                    v
       reviewed model package library
```

Simulation stays inside a dedicated Worker so synchronous solver work does not block the editor. The engine is initialized once and reused, while cancellation and timeouts replace the Worker. The separate validation factory generates model packages and gates their test benches against both native and WebAssembly ngspice. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the protocol, trust boundaries, persistence format, and build layout.

## Limitations

- Fidelity tiers are engineering estimates of model coverage and validation depth. They are not certifications or guarantees that every physical unit will match a simulation.
- There is no PCB layout, routing, manufacturing, or mechanical workflow.
- v0.1 analyses are limited to operating point, transient, and AC.
- Digital components are behavioral-analog approximations. scheMAGIC Sim does not execute firmware or model MCU peripherals.
- Imported third-party SPICE models are sanitized and visibly marked unverified. Their electrical accuracy and redistribution rights remain the user's responsibility.
- Simulation is not a substitute for prototyping, component qualification, or safety review.

## Licence

The repository has three licensing layers:

- Original application code and documentation: [Apache-2.0](LICENSE).
- Original generated component model packages: MIT, with a `LICENSE` inside each package.
- The ngspice-46 WebAssembly engine: upstream modified BSD, LGPL, and Emscripten terms as applicable.

See [docs/LICENSING.md](docs/LICENSING.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the engine notice bundle under `tools/ngspice-wasm-build/notices/` for the complete obligations, corresponding-source path, and rebuild information.
