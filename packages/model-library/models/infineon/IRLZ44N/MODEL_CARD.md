# IRLZ44N model card

## Identity

- Manufacturer: Infineon Technologies
- Description: 55 V logic-level N-channel power MOSFET
- Electrical family: nmos
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.infineon.com/assets/row/public/documents/24/49/infineon-irlz44n-datasheet-en.pdf
- Revision: PD-94831, 11-Nov-2003; public asset modified 29-Apr-2021
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `b4f1361a4486b8ec84206012a3e4a985111203d140fa6da8d4190b867c9ba077`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | none |
| thermal | approx |
| digital | none |

## Fitted parameters

| Parameter | Value |
| --- | ---: |
| VTO | 2.00000000e+0 |
| KP | 5.70506334e+1 |
| THETA | 3.41471972e-1 |
| LAMBDA | 1.70231722e-9 |
| RD | 9.60898811e-3 |
| RS | 4.40000000e-3 |
| RG | 1.00000000e-4 |
| CGS | 1.55000000e-9 |
| CGDMAX | 7.00000000e-10 |
| CGDMIN | 1.00000000e-10 |
| A | 1.84852823e-1 |
| CJO | 1.41972709e-9 |
| IS | 9.72368570e-13 |
| N | 1.50000000e+0 |
| RB | 4.40000000e-3 |
| TT | 1.15415603e-7 |
| BV | 5.50000000e+1 |
| IBV | 2.50000000e-4 |
| RTHJC | 1.40000000e+0 |
| RTHCA | 6.06000000e+1 |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current | 5.000000e+0 | 5.568628e+0 | A | 11.373% | p. 3 fig. 3, digitized |
| transfer current | 2.000000e+1 | 1.834700e+1 | A | 8.265% | p. 3 fig. 3, digitized |
| transfer current | 4.000000e+1 | 3.534001e+1 | A | 11.650% | p. 3 fig. 3, digitized |
| transfer current | 6.000000e+1 | 5.507269e+1 | A | 8.212% | p. 3 fig. 3, digitized |
| transfer current | 9.500000e+1 | 9.980004e+1 | A | 5.053% | p. 3 fig. 3, digitized |
| transfer current | 1.250000e+2 | 1.489620e+2 | A | 19.170% | p. 3 fig. 3, digitized |
| RDS(on) | 2.200000e-2 | 2.232557e-2 | ohm | 1.480% | p. 2 electrical characteristics |
| RDS(on) | 2.500000e-2 | 2.676314e-2 | ohm | 7.053% | p. 2 electrical characteristics |
| RDS(on) | 3.500000e-2 | 3.072023e-2 | ohm | 12.228% | p. 2 electrical characteristics |
| output current | 5.000000e+0 | 5.568628e+0 | A | 11.373% | p. 3 fig. 1, digitized |
| output current | 2.000000e+1 | 1.834700e+1 | A | 8.265% | p. 3 fig. 1, digitized |
| output current | 6.000000e+1 | 5.507269e+1 | A | 8.212% | p. 3 fig. 1, digitized |
| Crss at 1 V | 7.000000e-10 | 4.239479e-10 | F | 39.436% | p. 4 fig. 5, digitized |
| Crss at 2 V | 4.500000e-10 | 3.839607e-10 | F | 14.675% | p. 4 fig. 5, digitized |
| Crss at 5 V | 3.000000e-10 | 2.924858e-10 | F | 2.505% | p. 4 fig. 5, digitized |
| Crss at 10 V | 2.200000e-10 | 2.157349e-10 | F | 1.939% | p. 4 fig. 5, digitized |
| Crss at 20 V | 1.600000e-10 | 1.616535e-10 | F | 1.033% | p. 4 fig. 5, digitized |
| Crss at 50 V | 1.000000e-10 | 1.251537e-10 | F | 25.154% | p. 4 fig. 5, digitized |

Worst fitting error: 39.436% for Crss at 1 V.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 7.407e-6 and worst absolute delta was 1.040e-4.

## Known omissions

- Avalanche, UIS, safe operating area, and device failure are not modelled.
- No self-heating in the default three-terminal instance. Thermal resistances are transcribed but not validated.
- Package and lead inductance, gate oxide breakdown, threshold spread, and flicker noise are not modelled.
- RG is set to 1e-4 ohm because the datasheet does not publish gate resistance.
- Temperature coefficients are at defaults; only 25 degC data was fitted.
- The tabulated 48 nC total gate charge is inconsistent with the typical gate-charge curve at VGS = 5 V; the independent check uses the cited 28 nC curve read.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
