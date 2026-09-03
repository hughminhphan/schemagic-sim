# Robonyx

[![CI](https://github.com/hughminhphan/schemagic-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/hughminhphan/schemagic-sim/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/live-schemagic.pages.dev-1B9350)](https://schemagic.pages.dev)

Robonyx Simulator runs real ngspice-46 in your browser, one second to a live circuit. No account, works offline, every manufacturer part shows the datasheet evidence behind its model.

| Try it live | Run locally |
| --- | --- |
| Open [schemagic.pages.dev](https://schemagic.pages.dev). No account or installation is required. | `git clone https://github.com/hughminhphan/schemagic-sim.git`<br>`cd schemagic-sim`<br>`npm ci`<br>`npm run dev` |

> The product family was renamed from scheMAGIC to Robonyx. The GitHub repository, the Cloudflare project and the domain still carry the old name and will be renamed separately, so the links above are correct as written.

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

## What is in the family

| Tool | What it does today |
| --- | --- |
| Robonyx Simulator | Runs ngspice-46 locally in a browser Worker and animates the schematic while it solves. |
| Robonyx Designer | Turns declared electrical requirements into inspectable circuit candidates you can compare side by side. |
| Robonyx Motor Designer | Proposes brushed-DC motor driver and H-bridge candidates from reviewed manufacturer parts. |
| Robonyx Power Designer | Proposes non-isolated synchronous buck candidates from reviewed manufacturer parts. |
| Robonyx Component Library | Holds the reviewed manufacturer model packages and engineering profiles the other tools draw on. |
| Sourcing | Evaluates a bill of materials against dated distributor offers without preferring any provider. |
| Exports | Writes design JSON, BOM CSV, structural SVG and KiCad, printable HTML, and SPICE decks. |

The Simulator is launch-ready; parametric sweeps, mobile gestures, and transient replay remain roadmap enhancements. The Designer tools are release candidates: they produce candidates you can inspect, not designs you should build without your own review. Every installed recipe identifier, content hash, constraint policy and unproved claim is recorded in [docs/designer-status.md](docs/designer-status.md).

### A note on the `@opencircuit` namespace

The npm workspace scope is `@opencircuit/*`, the persisted circuit document carries `"format": "opencircuit-circuit"`, and some model headers still say `OpenCircuit Model Factory`. Those are stable internal identifiers kept so old saved circuits and exported files keep loading. `OpenCircuit` is not a product name, and neither is `scheMAGIC` any longer. This is the only place the distinction is explained; other documents point back here.

## Release status

`v0.2.0-rc.1` brings the Simulator, Measurement Workbench, Motor/Power Designer and the component-model library into one versioned release candidate. Open the [Simulator](https://schemagic.pages.dev/) or [Designer](https://schemagic.pages.dev/designer). See the [changelog](CHANGELOG.md) and [release contract](docs/releases/v0.2.0-rc.1.md) for compatibility, verification and known limitations.

## How many models, honestly

The library ships **771 reviewed manufacturer model packages, and all 771 are placeable in the Simulator**. Every one supports an operating point, and 767 support a DC sweep. Far fewer are validated beyond DC:

| Analysis | Packages with validated coverage |
| ---: | --- |
| Operating point | 771 |
| DC sweep | 767 |
| Transient | 113 |
| AC small signal | 64 |
| Noise | 17 |

So the honest summary is that the library is DC-first. If you need a transient or AC result from a specific manufacturer part, check its model card before you rely on it. Parametric generic components are not subject to this limit; the counts above describe manufacturer-part packages only.

## Open an example circuit

[Open the interactive NPN LED bench](https://schemagic.pages.dev/#c=jVTBctowEP0Vj3o1Gcs2CXBrS26ZlHLohWEYYQRVa1seSUBShn_vW5ti0dhpc4iQ9fTe7tPunlimi0qXsnSWTRYnpjZswjLOQpaLtczZ5MT0dmulw-kgDaNlyJx8wY594-wcskIZow2bbEVuZcgqTTSjME4BNBq4CBdeK4kLB6v3JpOgPoh8jy_Dc_hHMO4WHPqCs05BYUQBzRMjrTtQXmLgCCJ-G0SlHXJVupBOmjYUHuGvDSfpDCcKB0kbzvxTb_5J3KltpFXWAd0nm3bK3pjwtcuEoipxFD8n44gomiDStDOI9Q-3KoFvVYedqjdvPX_qzXU4Cjm5UsuM30s2SbxU7_8tOu1P9cvn1dPjdDV_nF7TpTjGb9PN5cZL9QHwnopNSPmvyzuj96V_f9R3H9X2XwTjPoL0_l0CnGy1KQT5oitZZspke-UGl5VYpRPk5UbazKgKJU5GfQyaqghyfRxYtZEBfAs2Rh2kCTJdOqNzWBSsXwMR3PTGHTidcjlF8Tx7ru-tIfydHqUyei2bgZHpnJJhH5Lx6EFSLdWZVjRCfirEjsbXuRM7anwnzI4e2hs7M4U4F3XtR8szJWpVQQiR0f-txR3c4PAEv3V1aZoI-0orjK2ZNFOZiQ1VGD7ao5QAwYesLh9NByxHwqRvBNROrBAv1hEsuiOqIU78fVzvSQt7fgYN7LK1oxy_lTwSSUVcGAr0bL-0RtAcyKNC5bej9Eg-NIHiI01G9CQWzrGgauqVapcvl9cyOdI4bC8R7P4K92A0pm64CVVXogdqJoLHFY8arlsYvVwLi5sJtoCjWD0Y9W0LS5oZs0hruAejRmthKO46tKbIPRj1UwsjG4YXOx58GHXNDSyuXYPoZeWUEtixLs_L828). The circuit is encoded in the URL and opens immediately without a database or account.

## Features

- Local ngspice-46 WebAssembly simulation in an isolated browser Worker.
- Living schematic feedback for wire voltage, current direction, and interactive controls.
- Operating point, source-based DC sweep, transient, AC, and operating-point noise analyses without netlist editing.
- Optional two-source DC sweeps rendered as stepped curve families with legends and cursors.
- Output and input-referred noise spectral density with explicit source, temperature, and integrated RMS assumptions.
- Wire probes, multi-trace scope views, CSV and PNG export, share URLs, and browser autosave.
- Compact share URLs that still read the legacy format, plus a read-only `?embed=1` view with an open-in-Robonyx link.
- Group selection, copy, paste, duplicate, and move while preserving wires between selected components.
- Import of supported components from Falstad and CircuitJS share URLs, with unsupported elements reported instead of silently dropped.
- Typed switches, dependent and behavioural sources, transformers, crystals, transmission lines, Zener diodes, batteries, fuses, and pulsed current sources.
- Nineteen built-in teaching circuits spanning filters, amplifiers, rectifiers, regulators, switches, sources, isolation, protection, a 555 timer, and resonance.
- Reviewed manufacturer models plus sanitized, visibly unverified SPICE model imports.

## Migrating from Multisim Live

Multisim Live retires on 15 September 2026. Robonyx Simulator is not a drop-in replacement, so here is the honest split.

**What carries over:**

- It runs in the browser. There is nothing to install, and it works on a Chromebook or a school-managed laptop.
- No account. You are not asked to sign up, and no circuit is uploaded to a server to be simulated.
- Circuits share as URLs. The whole document is encoded in the link, so a teacher can paste one into a worksheet and a student opens it directly.
- It works offline. Once the application and engine are cached, the simulator keeps running without a network connection.
- Real SPICE. Analyses are operating point, DC sweep, transient, AC, and operating-point noise, solved by ngspice-46 rather than an approximation of it.

**What does not carry over:**

- There is no Multisim file import. You cannot open a `.ms14`, `.msm` or Multisim Live circuit here, and there is no converter. Circuits have to be rebuilt by hand. This is the honest state today and there is no committed date for changing it.
- There is no shared cloud workspace, class roster, or account-bound circuit list. Sharing is by link or by exported project file.
- There is no PCB layout, and no 3D or instrument-panel view.
- The manufacturer-part coverage is different, and it is DC-first. See the counts above.

## Comparison

The projects below make different tradeoffs. This table covers claims that can be checked from public product behavior, documentation, licensing, and this repository.

| Capability | Falstad / CircuitJS1 | CircuitSim | Robonyx Simulator |
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

Falstad is an established open-source teaching tool. CircuitSim provides a broad browser SPICE workflow. Robonyx Simulator focuses on local ngspice execution, living schematic feedback, and explicit evidence for manufacturer-part models.

## 30-second quickstart

1. Open the [example circuit](https://schemagic.pages.dev/#c=jVTBctowEP0Vj3o1Gcs2CXBrS26ZlHLohWEYYQRVa1seSUBShn_vW5ti0dhpc4iQ9fTe7tPunlimi0qXsnSWTRYnpjZswjLOQpaLtczZ5MT0dmulw-kgDaNlyJx8wY594-wcskIZow2bbEVuZcgqTTSjME4BNBq4CBdeK4kLB6v3JpOgPoh8jy_Dc_hHMO4WHPqCs05BYUQBzRMjrTtQXmLgCCJ-G0SlHXJVupBOmjYUHuGvDSfpDCcKB0kbzvxTb_5J3KltpFXWAd0nm3bK3pjwtcuEoipxFD8n44gomiDStDOI9Q-3KoFvVYedqjdvPX_qzXU4Cjm5UsuM30s2SbxU7_8tOu1P9cvn1dPjdDV_nF7TpTjGb9PN5cZL9QHwnopNSPmvyzuj96V_f9R3H9X2XwTjPoL0_l0CnGy1KQT5oitZZspke-UGl5VYpRPk5UbazKgKJU5GfQyaqghyfRxYtZEBfAs2Rh2kCTJdOqNzWBSsXwMR3PTGHTidcjlF8Tx7ru-tIfydHqUyei2bgZHpnJJhH5Lx6EFSLdWZVjRCfirEjsbXuRM7anwnzI4e2hs7M4U4F3XtR8szJWpVQQiR0f-txR3c4PAEv3V1aZoI-0orjK2ZNFOZiQ1VGD7ao5QAwYesLh9NByxHwqRvBNROrBAv1hEsuiOqIU78fVzvSQt7fgYN7LK1oxy_lTwSSUVcGAr0bL-0RtAcyKNC5bej9Eg-NIHiI01G9CQWzrGgauqVapcvl9cyOdI4bC8R7P4K92A0pm64CVVXogdqJoLHFY8arlsYvVwLi5sJtoCjWD0Y9W0LS5oZs0hruAejRmthKO46tKbIPRj1UwsjG4YXOx58GHXNDSyuXYPoZeWUEtixLs_L828) and wait for `ENGINE READY`.
2. Select `P1`, then drag **Wiper position** in the inspector.
3. Watch the LED brightness, wire voltage colours, and current animation update with each solve.
4. Click a wire to add a scope trace, then open the scope.
5. Choose **DC SWEEP** to vary a source, **TRAN** for a time-domain plot, **AC** for a Bode plot, or **NOISE** for output and input-referred spectral density.
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
- Analyses currently cover operating point, linear one-source or two-source DC sweep, transient, decade AC sweep, and operating-point noise analysis.
- Manufacturer-model coverage is DC-first. Transient and AC validation exist for a minority of packages, as counted above.
- Digital components are behavioral-analog approximations. Robonyx Simulator does not execute firmware or model MCU peripherals.
- Imported third-party SPICE models are sanitized and visibly marked unverified. Their electrical accuracy and redistribution rights remain the user's responsibility.
- Designer output is an inspectable engineering candidate, not a PCB-ready or safety-certified design. See [docs/designer-status.md](docs/designer-status.md).
- Simulation is not a substitute for prototyping, component qualification, or safety review.

## Roadmap

The feature roadmap lives in [docs/ROADMAP.md](docs/ROADMAP.md), with exact task status in [docs/BACKLOG.md](docs/BACKLOG.md). Near-term work is the launch-administration gate in task 0.8 and the seven remaining Phase 1 tasks: parametric sweep, mobile layout, dependency cleanup, coverage floors, Designer handoff, privacy-respecting usage counts, and live transient replay. Larger Library Engine and Designer work remains explicitly queued. If a roadmap item matters to your work, open or comment on a [`roadmap` issue](https://github.com/hughminhphan/schemagic-sim/issues?q=is%3Aissue+label%3Aroadmap) with the circuit, use case, and evidence behind the request.

## Licence

The repository has three licensing layers:

- Original application code and documentation: [Apache-2.0](LICENSE).
- Original generated component model packages: MIT, with a `LICENSE` inside each package.
- The ngspice-46 WebAssembly engine: upstream modified BSD, LGPL, and Emscripten terms as applicable.

See [docs/LICENSING.md](docs/LICENSING.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the engine notice bundle under `tools/ngspice-wasm-build/notices/` for the complete obligations, corresponding-source path, and rebuild information.
