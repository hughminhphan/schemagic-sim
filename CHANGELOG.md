# Changelog

All notable Robonyx releases are documented here. The project uses semantic versioning; pre-1.0 release candidates may still change persisted or package-level contracts.

## [Unreleased]

### Changed

- Renamed the product family to Robonyx (formerly scheMAGIC Simulator). This covers Robonyx Simulator, Robonyx Designer, Robonyx Motor Designer, Robonyx Power Designer, and the Robonyx Component Library. Persisted identifiers are unchanged: the `@opencircuit/*` package scope, the `opencircuit-circuit` document format, `schemagic-*` format and storage identifiers, and existing share URLs all keep working. The GitHub repository, the Cloudflare Pages project and the deployment domain still carry the old name and will be renamed separately.

## [0.2.0-rc.1] - 2026-09-01

### Added

- A unified browser suite with the Simulator and Measurement Workbench at `/` and the Motor/Power Designer at `/designer`.
- Measurement expressions, XY mode, FFT and measurement tooling, run identity, queued execution, cancellation, persisted imports and typed probes.
- Deterministic Motor and Power design generation, reviewed candidate comparison, structural exports, sourcing request boundaries and release-audit tooling.
- A 771-package evidence-bearing component-model library, including 61 strict packages promoted since v0.1.0.
- KiCad-derived editor symbols and interaction parity coverage.

### Changed

- The current Simulator document remains version 3 with V1/V2 migration support; the incompatible multi-circuit Designer document is version 4.
- Simulation results combine Measurement run provenance with Designer execution receipts.
- The web release is versioned and tested as one product instead of separate preview branches.
- The Designer runtime contract is versioned at `2026-08-30.1` with a 10-second cold shared-runner p95 ceiling; local and CI reports remain explicitly environment-bound.
- CI now builds and asserts the pinned official native ngspice-46 + KLU reference and runs model-authoring tests from a locked repository-local Python environment.

### Known limitations

- This is a release candidate. Production offline/cache behavior is verified; manual assistive-technology review, authenticated runtime evidence, external KiCad verification, and KiCad GUI open/save/reopen evidence remain external gates.
- Three inherited TI comparator packages (`LM311`, `LM393`, and `TLV3702`) retain recorded native/WebAssembly `supply_current` parity failures. The 61 newly promoted packages pass all 147 recorded parity benches and expectations.
- DigiKey and Mouser adapters remain disabled pending credentials, written approval and terms review.
- Motor and Power outputs are inspectable engineering candidates, not PCB-ready, safety-certified or selected-part/full-BOM simulation proof.

Full release and recovery details are in [`docs/releases/v0.2.0-rc.1.md`](docs/releases/v0.2.0-rc.1.md).

## [0.1.0] - 2026-08-14

- First public release, published under the former name scheMAGIC Simulator, with a 710-package component-model library.

[0.2.0-rc.1]: https://github.com/hughminhphan/schemagic-sim/compare/v0.1.0...v0.2.0-rc.1
[0.1.0]: https://github.com/hughminhphan/schemagic-sim/releases/tag/v0.1.0
