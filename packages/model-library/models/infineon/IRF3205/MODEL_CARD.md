# IRF3205 model card

## Identity

- Manufacturer: Infineon Technologies (International Rectifier legacy)
- Description: 55 V N-channel HEXFET power MOSFET
- Electrical family: nmos
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.infineon.com/assets/row/public/documents/24/49/infineon-irf3205-datasheet-en.pdf
- Revision: IRF3205PbF, 23-Jul-2010
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `8658a274d7d8f377d0ed88be5374b435543acf4583b2959890caa6f524e78c8f`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | approx |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | 3.10417188e+0 | fitted or derived |
| KP | 3.10134587e+1 | fitted or derived |
| THETA | 5.85840390e-2 | fitted or derived |
| LAMBDA | 2.99830189e-10 | fitted or derived |
| RD | 3.89638947e-4 | fitted or derived |
| RS | 8.00000000e-4 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.03600000e-9 | fitted or derived |
| CGDMAX | 1.60000000e-9 | fitted or derived |
| CGDMIN | 1.50000000e-10 | fitted or derived |
| A | 1.69418182e-1 | fitted or derived |
| CJO | 3.23697776e-9 | fitted or derived |
| IS | 1.82212179e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.60000000e-3 | fitted or derived |
| TT | 9.95459578e-8 | fitted or derived |
| BV | 5.50000000e+1 | fitted or derived |
| IBV | 2.50000000e-4 | fitted or derived |
| RTHJC | 7.50000000e-1 | fitted or derived |
| RTHCA | 6.12500000e+1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current | 2.500000e+1 | 2.709952e+1 | A | 8.398% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 5.500000e+1 | 4.823917e+1 | A | 12.292% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 1.100000e+2 | 1.052485e+2 | A | 4.320% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 1.750000e+2 | 1.790131e+2 | A | 2.293% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 2.400000e+2 | 2.667960e+2 | A | 11.165% | p. 3 fig. 3, manually digitized 25 degC curve |
| RDS(on) | 8.000000e-3 | 7.998293e-3 | ohm | 0.021% | p. 2 RDS(on) MAX |
| output current | 2.500000e+1 | 2.709952e+1 | A | 8.398% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 5.500000e+1 | 4.823917e+1 | A | 12.292% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 1.100000e+2 | 1.052485e+2 | A | 4.320% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 1.750000e+2 | 1.790131e+2 | A | 2.293% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 2.400000e+2 | 2.667960e+2 | A | 11.165% | p. 3 fig. 1, manually digitized 25 degC curve |
| Crss at 1 V | 1.600000e-9 | 9.413147e-10 | F | 41.168% | p. 4 fig. 5, manually digitized |
| Crss at 2 V | 1.300000e-9 | 8.517074e-10 | F | 34.484% | p. 4 fig. 5, manually digitized |
| Crss at 5 V | 8.500000e-10 | 6.395723e-10 | F | 24.756% | p. 4 fig. 5, manually digitized |
| Crss at 10 V | 5.200000e-10 | 4.507528e-10 | F | 13.317% | p. 4 fig. 5, manually digitized |
| Crss at 20 V | 3.000000e-10 | 3.118651e-10 | F | 3.955% | p. 4 fig. 5, manually digitized |
| Crss at 50 V | 1.500000e-10 | 2.162773e-10 | F | 44.185% | p. 4 fig. 5, manually digitized |

Worst fitting error: 44.185% for Crss at 50 V.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.972e-5 and worst absolute delta was 1.971e-4.

## Known omissions

- The RDS(on), body-diode voltage, and total gate-charge rows are guaranteed maxima; they are retained with source semantics and are not described as typical device values.
- Gate charge is not an optimizer residual. It is checked independently with a broad 75 percent tolerance because the compact VDMOS capacitance law does not reproduce the cited Miller plateau closely; transient coverage is approximate.
- Avalanche, UIS, safe-operating-area failure, temperature-dependent transfer, self-heating in the default three-terminal instance, package inductance, gate-oxide failure, process spread, and noise are not modelled.
- RG is held at the factory numerical floor because the datasheet does not publish intrinsic gate resistance.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
