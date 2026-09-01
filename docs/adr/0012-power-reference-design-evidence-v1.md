# ADR-0012: TPS54302EVM-716 published-reference-design evidence lane

## Status

Accepted on 2026-08-26 as an additive, observation-only evidence lane. It is not installed for generation and has no candidate-eligibility authority.

## Decision

The design library now publishes immutable Power reference-design evidence V1 for Texas Instruments `TPS54302EVM-716`, assembly `PWR716-003`:

- evidence `tps54302evm-716.slvuap9b.1` — `sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb`;
- official source [SLVUAP9B Rev. B](https://www.ti.com/lit/ug/slvuap9b/slvuap9b.pdf) — retrieved bytes `sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e`;
- published BOM — `sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22`;
- published layout-reference locator set — `sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a`;
- non-installed evidence recipe `power.reference-evidence.tps54302evm-716@1.0.0` — `sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2`.

The artifact records the guide's 19-row Table 4-1 BOM, including the zero-quantity `C7` DNP row and 25 populated components. It also records only the guide's explicit 25 °C EVM observations: the reported 8 V to 28 V / 0 A to 3 A tested range at a 5 V set point, 400 kHz center frequency at the Table 1-2 default 24 V input, 95.57% efficiency at 12 V / 1 A, load and line regulation observations, the less-than-30 mV peak-to-peak output-ripple observation at 24 V / 3 A, and the stated load-transient voltage/recovery observations. Exact numeric values cite their Table 1-2 rows; figures remain setup, sweep, or waveform context.

Every observation has `strictConstraintAuthority:false`. A caller may assert the public reference-design ID, assembly ID, evidence hash, published-BOM hash, and published-layout-reference hash. A matching assertion is labeled only `asserted_reference_identity_unattested`; it does not prove a physical assembly, BOM population, PCB/layout identity, measurement run, or qualification. The assessment reports only reference observations whose published conditions overlap the request, with `attestation:none`, physical-assembly qualification false, application authority false, and zero strict closures. The evidence recipe maps all 13 unresolved Power rules to relevant reference observations while keeping all 13 blocked.

## Identity boundary

The guide's BOM does not identify the installed production candidate:

- EVM `U1` is listed as `TPS54302DDC`, not the exact orderable `TPS54302DDCR` profile identity.
- EVM `L1` is Würth Elektronik `7447714100`, 10 µH, not installed Bel Fuse `F1F2-0804-100M`, 10 µH. The nominal inductance matches; the exact MPN and BOM identity do not.
- The EVM input/output/bootstrap capacitors, divider, UVLO network, feed-forward capacitor, PCB, and layout also differ from the installed structural observation.

No orderable-suffix equivalence, passive substitution, layout equivalence, measurement interpolation, production spread, or model fidelity is inferred.

## Consequences

The current installed recipe is `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6` (`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`). It selects the exact Bel 10 µH identity and a quantity-two Murata `GRM32ER71E226KE15L` 22 µF output-capacitor line. Its browser observation remains 9 pass, 13 unknown, 0 fail; strict generation remains zero-candidate; and policy `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6` keeps the observation ineligible. Its four ideal-equation passive-current estimates do not grant strict constraint authority. The reference lane itself grants no identity, constraint, physical-assembly, eligibility, provider, sourcing, or simulation authority. Catalog successor `2026-08-27.2` (`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`) deterministically repins the Power context, request, result, candidate, decision, and golden identities without changing those outcomes.

The lane closes source-byte binding, published reference/BOM/layout-locator traceability, and bounded reference-observation availability only. It does not identify or qualify a caller's physical assembly and does not close regulator output-current authority, inductor corners, protection coordination, loop margin, effective capacitance, bootstrap adequacy, minimum timing, the browser ripple requirement, bounded losses, junction temperature, selected-part simulation, provider, sourcing, or release readiness. Those rules still require condition-covering primary guarantees, a validated selected-part/corner model, and/or bounded physical qualification.
