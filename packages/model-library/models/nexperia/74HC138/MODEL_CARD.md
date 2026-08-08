# 74HC138 model card

## Identity

- Manufacturer: Nexperia B.V.
- Description: 3-to-8 line decoder and demultiplexer with active-low outputs
- Electrical family: logic_74hc
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://assets.nexperia.com/documents/data-sheet/74HC_HCT138.pdf
- Revision: Rev. 10, 26 February 2024
- Accessed: 2026-08-07
- Referenced pages: p. 3, p. 4, p. 5, p. 7
- SHA-256: `645120bc441507e9c65491c8224cf2dcf6e8b8c73019f33fd18b560b6c9298ce`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit basis

DC output resistance is derived from the 25 degC TYP column at VCC = 4.5 V. Sequential timing uses the 25 degC TYP propagation-delay row. Guaranteed MIN and MAX values remain hard bounds and are not treated as typical targets. Validation results are regenerated from native ngspice-46 and the pinned WASM engine.

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| KIN | 20 | 1 | held at default, fixed archetype input sigmoid constant |
| KREG | 25 | 1 | held at default, fixed archetype regenerative latch constant |
| KSW | 12 | 1 | held at default, fixed archetype output-driver blend constant |
| VSKEW | 0.05 | 1 | held at default, fixed archetype symmetry-breaking constant |
| RIN | 1e+11 | ohm | held at default, mandatory input leakage path |
| CLATCH | 1e-12 | F | held at default, fixed latch capacitance |
| RINT | 1000 | ohm | held at default, fixed internal delay scale |

## Known omissions

- This is an ANALOG BEHAVIORAL model, not a digital one. The simulation engine has no XSPICE and no event-driven digital solver. There are no logic states, no unknown/X value, no high-impedance Z state, and no timing checks. Everything is a continuous voltage.
- Metastability is not modelled. A setup or hold violation produces a smooth intermediate output, not a genuinely indeterminate one, and the model always resolves.
- Setup time, hold time, removal time, recovery time and maximum toggle frequency are not fitted. They are consequences of the internal RC delay, not datasheet-matched quantities.
- Output transition time (tT) is not fitted; it is a consequence of the output resistance and the external load.
- Propagation delay is fitted at VCC = 4.5 V. The delay increase at 2 V and decrease at 6 V are not fitted.
- Quiescent supply current is not modelled. Supply current is dominated by the model's own internal networks and does not correspond to the datasheet ICC.
- Input protection diodes to VCC and GND are not modelled. Inputs driven beyond the supplies do not clamp and do not conduct.
- Input capacitance (CI) is not modelled, so the loading this gate presents to a driving stage is purely resistive.
- Latch-up is not modelled.
- No self-heating and no temperature coefficients.
- Fitted from the VCC = 4.5 V column of the DC and AC characteristics.
- RINT = 1 kohm is held at default where an explicit combinational delay stage is used.
- KIN = 20, KREG = 25, KSW = 12, VSKEW = 0.05, all 1 pF latch capacitors, and all 100 Gohm input leakage resistors are held at default.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.

## Validation

- Native ngspice reference: ngspice-46
- WASM engine: eecircuit-engine 1.7.0, ngspice-45.2+
- Benches passed: 5/5
- Datasheet-anchored checks passed: 11/11
- Worst fitting error: 0.000% for vol_loaded_typ
- Worst native versus WASM relative delta: 1.96723e-08
- Worst native versus WASM absolute delta: 1.09479e-15
- Validation date: 2026-08-07
