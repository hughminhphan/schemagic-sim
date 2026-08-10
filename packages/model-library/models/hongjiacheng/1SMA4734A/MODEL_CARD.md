# 1SMA4734A model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879671273164800
- Revision: Rev1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `a66d0e20d37b19b6776d33e5d234d792d89e30813774a7dde79429c97d6773dd`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 4.12354224e-15 | fitted or derived |
| N | 1.80000000e+0 | fitted or derived |
| RS | 1.00000000e-4 | fitted or derived |
| BV | 5.60000000e+0 | fitted or derived |
| IBV | 4.50000000e-2 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 5.382e-13 and worst absolute delta was 7.874e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for 1SMA4734A. See validation-results.json; failed package checks: reverse_leakage_maximum observed 0.000013334911774124075 (maximum 0.00001)
- No capacitance or reverse-recovery data were published. The generic reverse zener-impedance plot contains curves only for VZ = 25 V, 30 V, 65 V, and 91 V, not the 5.6 V 1SMA4734A trace.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
