# Changelog

All notable scheMAGIC releases are documented here. The project uses semantic versioning; pre-1.0 release candidates may still change persisted or package-level contracts.

## [0.2.0-rc.1] - 2026-08-30

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

### Known limitations

- This is a release candidate. Manual assistive-technology review, exact-deployment offline/network review, authenticated runtime evidence and KiCad GUI open/save/reopen evidence remain external release gates.
- Three inherited TI comparator packages (`LM311`, `LM393`, and `TLV3702`) retain recorded native/WebAssembly `supply_current` parity failures. The 61 newly promoted packages pass all 147 recorded parity benches and expectations.
- DigiKey and Mouser adapters remain disabled pending credentials, written approval and terms review.
- Motor and Power outputs are inspectable engineering candidates, not PCB-ready, safety-certified or selected-part/full-BOM simulation proof.

Full release and recovery details are in [`docs/releases/v0.2.0-rc.1.md`](docs/releases/v0.2.0-rc.1.md).

## [0.1.0] - 2026-08-14

- First public scheMAGIC Simulator release with a 710-package component-model library.

[0.2.0-rc.1]: https://github.com/hughminhphan/schemagic-sim/compare/v0.1.0...v0.2.0-rc.1
[0.1.0]: https://github.com/hughminhphan/schemagic-sim/releases/tag/v0.1.0
