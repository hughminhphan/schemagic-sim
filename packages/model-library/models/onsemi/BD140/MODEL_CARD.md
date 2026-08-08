# BD140 model card

## Identity

- Manufacturer: onsemi
- Description: PNP power transistor
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/bd139-d.pdf
- Revision: BD139/D Rev. 3, April 2026
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2
- SHA-256: `644c775c026b2c714a7a15ff1a458e9c380ce96ee7ca8dc7ce1cca958bcb2a6c`
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
| IS | 1.50533652e-12 | native fitted |
| NF | 1.00000000e+0 | held default |
| BF | 2.35988838e+2 | native fitted |
| IKF | 1.45459122e-1 | native fitted |
| ISE | 1.25052137e-12 | native fitted |
| NE | 1.68581838e+0 | native fitted |
| VAF | 6.00000000e+1 | held at archetype default; no fitted output-curve family |
| BR | 2.00000000e+0 | held default |
| RB | 8.56987987e-1 | native fitted |
| RE | 4.39161882e-2 | native fitted |
| RC | 5.68530172e-1 | native fitted |
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
| hFE at IC=0.005 A | 2.500000e+1 | 1.963433e+2 | 1 | 685.373% | official spec table MIN column |
| hFE at IC=0.15 A | 4.000000e+1 | 8.212055e+1 | 1 | 105.301% | official spec table MIN column |
| hFE at IC=0.5 A | 2.500000e+1 | 3.966626e+1 | 1 | 58.665% | official spec table MIN column |
| VBE at IC=0.5 A | 1.000000e+0 | 8.000000e-1 | V | 20.000% | official spec table MAX column |
| VCE(sat) at IC=0.5 A | 5.000000e-1 | 4.000000e-1 | V | 20.000% | official spec table MAX column |
| VBE(sat) at IC=0.5 A | 1.000000e+0 | 8.000000e-1 | V | 20.000% | official spec table MAX column |

Worst fitting error: 685.373% for hFE at IC=0.005 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 6.362e-12 and worst absolute delta was 1.579e-13.

## Known omissions

- The manufacturer source provides guaranteed MIN/MAX rows but not enough independent typical curves for F2; fidelity is capped at F1.
- Guaranteed MIN/MAX rows remain hard bounds and are not presented as typical targets.
- No self-heating, safe-operating-area failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.

- P5 independent review passed F1: guaranteed gain and saturation bounds, an independent in-region gain probe, and all four native and WASM benches passed.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
