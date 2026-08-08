# BD139 model card

## Identity

- Manufacturer: onsemi
- Description: NPN power transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

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
| IS | 1.50520689e-12 | native fitted |
| NF | 1.00000000e+0 | held default |
| BF | 2.35988499e+2 | native fitted |
| IKF | 1.45459306e-1 | native fitted |
| ISE | 1.25052126e-12 | native fitted |
| NE | 1.68581839e+0 | native fitted |
| VAF | 6.00000000e+1 | held at archetype default; no fitted output-curve family |
| BR | 2.00000000e+0 | held default |
| RB | 8.56968091e-1 | native fitted |
| RE | 4.39140173e-2 | native fitted |
| RC | 5.68532598e-1 | native fitted |
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
| hFE at IC=0.005 A | 2.500000e+1 | 1.963430e+2 | 1 | 685.372% | official spec table MIN column |
| hFE at IC=0.15 A | 4.000000e+1 | 8.212051e+1 | 1 | 105.301% | official spec table MIN column |
| hFE at IC=0.5 A | 2.500000e+1 | 3.966625e+1 | 1 | 58.665% | official spec table MIN column |
| VBE at IC=0.5 A | 1.000000e+0 | 8.000000e-1 | V | 20.000% | official spec table MAX column |
| VCE(sat) at IC=0.5 A | 5.000000e-1 | 4.000000e-1 | V | 20.000% | official spec table MAX column |
| VBE(sat) at IC=0.5 A | 1.000000e+0 | 8.000000e-1 | V | 20.000% | official spec table MAX column |

Worst fitting error: 685.372% for hFE at IC=0.005 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 7.760e-13 and worst absolute delta was 4.385e-14.

## Known omissions

- The manufacturer source provides guaranteed MIN/MAX rows but not enough independent typical curves for F2; fidelity is capped at F1.
- Guaranteed MIN/MAX rows remain hard bounds and are not presented as typical targets.
- No self-heating, safe-operating-area failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
