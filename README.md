# scheMAGIC

[![CI](https://github.com/hughminhphan/schemagic-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/hughminhphan/schemagic-sim/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/live-schemagic.pages.dev-1B9350)](https://schemagic.pages.dev)

scheMAGIC is a free, open-source electronics design suite for turning declared requirements into inspectable circuits, checking them with evidence-backed models, and simulating them locally in the browser.

Everything in this repository belongs to the scheMAGIC product family: Designer, Motor Designer, Power Designer, Simulator, Sourcing, design exports, the Component Library, and the model-authoring toolchain. The historical `@opencircuit/*` workspace namespace remains only as a stable internal compatibility API for imports and persisted formats; it is not a separate product or public brand.

## Release status

`v0.2.0-rc.1` brings the Simulator, Measurement Workbench, Motor/Power Designer and 771-package component-model library into one versioned release candidate. Open the [Simulator](https://schemagic.pages.dev/) or [Designer](https://schemagic.pages.dev/designer). See the [changelog](CHANGELOG.md) and [release contract](docs/releases/v0.2.0-rc.1.md) for compatibility, verification and known limitations.

## Product family

| scheMAGIC tool | Role | Current boundary |
| --- | --- | --- |
| Designer | Deterministic requirements-to-candidate workflow | Native Motor and Power generation contexts use the 24 independently reviewed profiles in catalog release `2026-08-27.2`. Canonical V2 requirements and same-class customization instructions remain untrusted input until explicit installed regeneration. Exact authorized observations can emit the five separately named structural/engineering inspection artifacts, the Power physical-handoff JSON, and a provider-neutral sourcing-request packet, but none grants ordinary-result mutation, selected-part model or samples, physical fidelity, ranking, provider/commercial, KiCad-attestation, eligibility, or release authority. The retained integrated Motor, direct-gate external Motor, and Power observations all remain ineligible. The narrow native/WASM external-Motor golden is only an ideal reviewed-RDS projection, and the Power golden is only a three-binding ideal nominal passive projection; neither is a selected-part or full-BOM model. Explicit inspection renders transient, adapter-authorized V3 truth/criticality/disposition beside exact V2 structural observations |
| Motor Designer | Brushed-DC motor and H-bridge selection | The installed integrated recipe `motor.native.integrated-h-bridge.facts-v3-2@3.2.6` (`sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07`) preserves the source-bound DRV8876 coast/reverse/forward/brake logic map when PMODE is sampled high at device power-up and passes `motor.integrated.local-capacitance-nominal` only for the exact DRV8876PWPR/C1608X7R1H104K080AA 100 nF nameplate match. It exact-rejects the admitted DRV8262 profile in match before component materialization or customization-witness creation because the one-local-capacitor structure cannot represent its two distinct VM bypass positions plus separate charge-pump/regulator networks. The installed path still retains one ineligible STSPIN840 analytical observation with an unchanged connected exact-BOM structural schematic and a separate request-derived averaged operating-point scenario. The installed external recipe `motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified@3.1.7` (`sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947`) preserves the source-guided direct xHO/xLO structure with no series-gate resistor, separate bootstrap/VDD-local capacitor roles, and the exact reviewed Diodes `3.0SMCJ33CAQ` TVS. Under Motor policy `sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0`, strict external generation rejects all 54 checked combinations on unresolved hard evidence; explicit inspection materializes 54, Pareto-retains two structural observations, and marks both ineligible at 9 satisfied and 21 blocked required rules each. Effective capacitance, bootstrap charge/refresh/leakage, local bias and placement, bulk transient energy, `motor.external.gate-network`, switching behavior, full TVS coordination, and selected-part simulation fidelity remain unknown |
| Power Designer | Non-isolated synchronous-buck selection | The installed qualified recipe `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6` (`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`) binds TPS54302DDCR to one reviewed Bel Fuse `F1F2-0804-100M` 10 µH inductor and one Murata `GRM32ER71E226KE15L` 22 µF BOM line at quantity two. Strict generation excludes the option with one `unknown_constraint_disallowed` rejection; explicit inspection retains one structural observation, but policy `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6` keeps it ineligible at 9 pass, 13 unknown, 0 fail. Four ideal-equation passive-current observations are emitted only as estimates; they do not change constraints or eligibility and do not prove effective inductance, control mode, current sharing, ripple rating, loss, or thermal suitability. The `TPS54302EVM-716` panel remains observation-only reference metadata: its Würth 10 µH and the installed Bel 10 µH share nominal inductance but differ in exact MPN/BOM identity, and it closes 0 strict rules. The connected schematic, physical-handoff V2, and native/WASM passive golden preserve two explicit capacitor instances but grant no placement/routing, switching, effective-capacitance, ESR/ripple-current, loss, selected-semiconductor/full-BOM, physical-fidelity, eligibility, provider, sourcing, safety, or release authority. The isolated external-FET V3 recipe remains non-release-eligible with no reviewed external-controller profile, V3 policy scope, scenario, or executable selected-part model |
| Simulator | Local ngspice-46 WebAssembly circuit bench | Operating point, DC sweep, transient, AC, and noise analyses |
| Sourcing | Provider-neutral BOM policy and dated offer evaluation | V2 lookup, authorization issuance, and trusted verification share one fail-closed operation-permission validator. Invalid execution modes or approval references fail before cache or adapter access; legacy V1 lookup is audit-only, and raw provider factories are not public package subpaths. DigiKey and Mouser remain disabled pending credentials, written approval, and terms; no live provider access is enabled |
| Exports | Design JSON, BOM CSV, scenario plans, structural SVG/KiCad, printable HTML, SPICE, and behavioral simulation CSV contracts | Exact-regenerated production observations expose JSON, BOM, structural SVG/KiCad, printable HTML, and zero-omission Scenario SPICE for the separate generic behavioral scenarios. Customized-target inspection receipts contain the sidecar and exact BOM/SVG descriptors, not the artifact payloads; replay is mandatory and conveys no installed-context or production authority. Simulation CSV and Simulator handoff remain disabled without pinned-engine samples and an exact matching simulation receipt |
| Component Library and model tools | Reviewed manufacturer models, ingestion, fitting, and native/WASM verification | 771 evidence-bearing model packages are validated; 47 independently reviewed single-subcircuit assets are admitted to the browser-safe execution registry, while other assets remain unavailable until their exact execution gate passes |

Catalog `2026-08-27.2` (`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`) contains 24 independently reviewed profiles, including the admitted TI `DRV8262DDVR`, Diodes `3.0SMCJ33CAQ` TVS, Bel Fuse `F1F2-0804-100M` inductor, and Murata `GRM32ER71E226KE15L` MLCC. It preserves corrected geometry exactly: DRV8262 Most/Density-A TOP-copper bounds are `129.123381013 mm²`, DRV8876 copper bounds are `38.500010211 mm²`, TPS54302 copper bounds are `10.582498183 mm²`, and the CSD18540 direct land pattern is `31.24224 mm²`. DRV8262 admission grants no generation feasibility and the installed recipe rejects it before materialization; LM70880 remains researching after its attempted profile was withdrawn. Catalog admission alone grants no candidate eligibility, selected-part simulation, provider, sourcing, or release authority.

## scheMAGIC Simulator

scheMAGIC Simulator runs real ngspice locally in your browser and makes the schematic itself show what the circuit is doing.

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
| Open [schemagic.pages.dev](https://schemagic.pages.dev). No account or installation is required. | `git clone https://github.com/hughminhphan/schemagic-sim.git`<br>`cd schemagic-sim`<br>`npm ci`<br>`npm run dev` |

## Features

- Local ngspice-46 WebAssembly simulation in an isolated browser Worker.
- Living schematic feedback for wire voltage, current direction, and interactive controls.
- Operating point, source-based DC sweep, transient, AC, and operating-point noise analyses without netlist editing.
- Optional two-source DC sweeps rendered as stepped curve families with legends and cursors.
- Output and input-referred noise spectral density with explicit source, temperature, and integrated RMS assumptions.
- Wire probes, multi-trace scope views, CSV and PNG export, share URLs, and browser autosave.
- Reviewed manufacturer models plus sanitized, visibly unverified SPICE model imports.

## Open an example circuit

[Open the interactive NPN LED bench](https://schemagic.pages.dev/#c=jVTBctowEP0Vj3o1Gcs2CXBrS26ZlHLohWEYYQRVa1seSUBShn_vW5ti0dhpc4iQ9fTe7tPunlimi0qXsnSWTRYnpjZswjLOQpaLtczZ5MT0dmulw-kgDaNlyJx8wY594-wcskIZow2bbEVuZcgqTTSjME4BNBq4CBdeK4kLB6v3JpOgPoh8jy_Dc_hHMO4WHPqCs05BYUQBzRMjrTtQXmLgCCJ-G0SlHXJVupBOmjYUHuGvDSfpDCcKB0kbzvxTb_5J3KltpFXWAd0nm3bK3pjwtcuEoipxFD8n44gomiDStDOI9Q-3KoFvVYedqjdvPX_qzXU4Cjm5UsuM30s2SbxU7_8tOu1P9cvn1dPjdDV_nF7TpTjGb9PN5cZL9QHwnopNSPmvyzuj96V_f9R3H9X2XwTjPoL0_l0CnGy1KQT5oitZZspke-UGl5VYpRPk5UbazKgKJU5GfQyaqghyfRxYtZEBfAs2Rh2kCTJdOqNzWBSsXwMR3PTGHTidcjlF8Tx7ru-tIfydHqUyei2bgZHpnJJhH5Lx6EFSLdWZVjRCfirEjsbXuRM7anwnzI4e2hs7M4U4F3XtR8szJWpVQQiR0f-txR3c4PAEv3V1aZoI-0orjK2ZNFOZiQ1VGD7ao5QAwYesLh9NByxHwqRvBNROrBAv1hEsuiOqIU78fVzvSQt7fgYN7LK1oxy_lTwSSUVcGAr0bL-0RtAcyKNC5bej9Eg-NIHiI01G9CQWzrGgauqVapcvl9cyOdI4bC8R7P4K92A0pm64CVVXogdqJoLHFY8arlsYvVwLi5sJtoCjWD0Y9W0LS5oZs0hruAejRmthKO46tKbIPRj1UwsjG4YXOx58GHXNDSyuXYPoZeWUEtixLs_L828). The circuit is encoded in the URL and opens immediately without a database or account.

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

Falstad is an established open-source teaching tool. CircuitSim provides a broad browser SPICE workflow. scheMAGIC Simulator focuses on local ngspice execution, living schematic feedback, and explicit evidence for manufacturer-part models.

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
- Digital components are behavioral-analog approximations. scheMAGIC Simulator does not execute firmware or model MCU peripherals.
- Imported third-party SPICE models are sanitized and visibly marked unverified. Their electrical accuracy and redistribution rights remain the user's responsibility.
- Simulation is not a substitute for prototyping, component qualification, or safety review.

## Roadmap

The feature roadmap lives in [docs/ROADMAP.md](docs/ROADMAP.md), and each item is tracked as a [`roadmap` issue](https://github.com/hughminhphan/schemagic-sim/issues?q=is%3Aissue+label%3Aroadmap). Near-term work is grouped under the [v0.2 milestone](https://github.com/hughminhphan/schemagic-sim/milestone/1). If a roadmap item matters to your work, comment on its issue with the circuit, use case, and evidence behind the request.

## Licence

The repository has three licensing layers:

- Original application code and documentation: [Apache-2.0](LICENSE).
- Original generated component model packages: MIT, with a `LICENSE` inside each package.
- The ngspice-46 WebAssembly engine: upstream modified BSD, LGPL, and Emscripten terms as applicable.

See [docs/LICENSING.md](docs/LICENSING.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the engine notice bundle under `tools/ngspice-wasm-build/notices/` for the complete obligations, corresponding-source path, and rebuild information.
