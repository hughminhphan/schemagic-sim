# BAT85 model card

## Identity

- Manufacturer: Vishay Semiconductors
- Description: Small-signal Schottky diode
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://datasheet.octopart.com/BAT85-Vishay-datasheet-28185.pdf
- Revision: BAT85 Rev. 1.3, 31-Mar-2004; archived Vishay PDF mirror
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2
- SHA-256: `28c78e0c7afbb6e9501eafdeb49d96a23e9862a6f6c863e0804029eb9dd8e800`
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
| IS | 1.72375093e-8 | fitted |
| N | 1.06730768e+0 | fitted |
| RS | 3.60838827e+0 | fitted |
| CJO | 1.00000000e-11 | derived_or_held_default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1.000e-4 A | 2.400000e-1 | 2.379992e-1 | V | 0.834% | p. 2 forward-voltage table |
| forward voltage at 1.000e-3 A | 3.200000e-1 | 3.043837e-1 | V | 4.880% | p. 2 forward-voltage table |
| forward voltage at 1.000e-2 A | 4.000000e-1 | 4.000000e-1 | V | 0.000% | p. 2 forward-voltage table |
| forward voltage at 3.000e-2 A | 5.000000e-1 | 5.022938e-1 | V | 0.459% | p. 2 forward-voltage table |
| forward voltage at 1.000e-1 A | 8.000000e-1 | 7.878961e-1 | V | 1.513% | p. 2 forward-voltage table |

Worst fitting error: 4.880% for forward voltage at 0.001 A.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 1.234e-14 and worst absolute delta was 2.859e-15.

## Known omissions

- Only the 30 mA forward-voltage row is typical; the other fitted rows are maxima and remain hard bounds, so fidelity is capped at F1.
- CJO uses a single maximum specification; C-V shape is not fitted. The 5 ns reverse-recovery maximum is retained as metadata but not mapped to TT because the generic charge-storage bench does not represent Schottky recovery.
- Reverse breakdown is not modelled from the 30 V minimum rating.
- Self-heating, process spread, package parasitics, ageing, and failure outside ratings are not modelled.
- P5 independent review passed F1: mixed typical and maximum table data, an independent forward probe, and all seven native and WASM benches were verified.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
