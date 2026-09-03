# 1N5822 model card

## Identity

- Manufacturer: onsemi
- Description: 3 A, 40 V axial Schottky rectifier
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol model-quality reviewer (F.4)

## Provenance

- Datasheet: https://www.onsemi.com/download/data-sheet/pdf/1n5820-d.pdf
- Revision: 1N5820/D Rev. 11, November 2023
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 5, p. 6
- SHA-256: `6868f7cafcc9eb4e3adb4e38dabc8b66b2cca4da5930f783b0a44e5e9910caa9`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 4.14414118e-6 | fitted |
| N | 1.00000000e+0 | fitted |
| RS | 5.94482398e-2 | fitted |
| CJO | 7.00000000e-10 | derived_or_held_default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1.000e+0 A | 3.900000e-1 | 3.778774e-1 | V | 3.108% | p. 2 maximum instantaneous forward voltage, 1N5822 column |
| forward voltage at 3.000e+0 A | 5.250000e-1 | 5.250000e-1 | V | 0.000% | p. 2 maximum instantaneous forward voltage, 1N5822 column |
| forward voltage at 9.400e+0 A | 9.500000e-1 | 9.348121e-1 | V | 1.599% | p. 2 maximum instantaneous forward voltage, 1N5822 column |

Worst fitting error: 3.108% for forward voltage at 1 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 1.492e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- The fitted forward points are guaranteed maxima rather than a typical curve, so validation treats them as upper bounds and fidelity is capped at F1.
- The Schottky-constrained fit rests at the physical N = 1 lower bound. N is set by that bound, not measured from the published maximum-only points.
- Reverse breakdown, leakage temperature scaling, surge heating, and distributed junction capacitance are omitted.
- Self-heating, process spread, package parasitics, ageing, and failure outside ratings are not modelled.
- F.4 independent model-quality review passed F1 after the Schottky-bound refit: N's lower-bound status is disclosed, all five native and WASM benches agree, and all five datasheet-anchored checks pass.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
