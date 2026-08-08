# TIP41C model card

## Identity

- Manufacturer: onsemi
- Description: NPN power transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/tip41a-d.pdf
- Revision: TIP41A/D Rev. 12, June 2024
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `c4c078fa436e36a41b87ef0a59608c2a8a84f4caf9a9d6ee555e5333caea691e`
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
| IS | 8.87631056e-12 | native fitted |
| NF | 1.00000000e+0 | held default |
| BF | 5.89987508e+2 | native fitted |
| IKF | 4.56186637e-1 | native fitted |
| ISE | 2.84517512e-11 | native fitted |
| NE | 1.40848830e+0 | native fitted |
| VAF | 6.00000000e+1 | held at archetype default; no fitted output-curve family |
| BR | 2.00000000e+0 | held default |
| RB | 1.20347024e+0 | native fitted |
| RE | 1.48637712e-2 | native fitted |
| RC | 1.62790518e-1 | native fitted |
| CJE | 1.00000000e-15 | held at numerical floor; no cited input capacitance |
| VJE | 7.50000000e-1 | held default |
| MJE | 3.30000000e-1 | held default |
| CJC | 1.00000000e-15 | held at numerical floor; no cited output capacitance |
| VJC | 7.50000000e-1 | held default |
| MJC | 3.30000000e-1 | held default |
| XCJC | 1.00000000e+0 | held default |
| TF | 1.00000000e-12 | held at numerical floor; no cited fT |
| TR | 0.00000000e+0 | held at default; no cited storage time |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.3 A | 3.000000e+1 | 1.054470e+2 | 1 | 251.490% | official spec table MIN column |
| hFE at IC=3 A | 1.500000e+1 | 3.187678e+1 | 1 | 112.512% | official spec table MIN column |
| VCE(sat) at IC=6 A | 1.500000e+0 | 1.200000e+0 | V | 20.000% | official spec table MAX column |
| VBE(sat) at IC=6 A | 2.000000e+0 | 1.600000e+0 | V | 20.000% | official spec table MAX column |

Worst fitting error: 251.490% for hFE at IC=0.3 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 6.522e-12 and worst absolute delta was 4.301e-13.

## Known omissions

- The manufacturer source provides guaranteed MIN/MAX rows but not enough independent typical curves for F2; fidelity is capped at F1.
- Guaranteed MIN/MAX rows remain hard bounds and are not presented as typical targets.
- No self-heating, safe-operating-area failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.

- P5 independent review passed F1: guaranteed gain and saturation bounds, an independent in-region gain probe, and all four native and WASM benches passed.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
