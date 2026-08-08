# IRFZ44N model card

## Identity

- Manufacturer: Infineon Technologies (International Rectifier legacy)
- Description: 55 V N-channel HEXFET power MOSFET
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://www.infineon.com/assets/row/public/documents/24/49/infineon-irfz44n-datasheet-en.pdf
- Revision: IRFZ44NPbF, 21-Sep-2010
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `f2338c22e7bac2b92d07e7abf80f9fb993fc3e16a58a86c74daa9cbc2949d1ab`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | approx |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | 3.96363924e+0 | fitted or derived |
| KP | 7.87474990e+1 | fitted or derived |
| THETA | 1.00000000e+0 | fitted or derived |
| LAMBDA | 4.27834672e-5 | fitted or derived |
| RD | 4.43653435e-4 | fitted or derived |
| RS | 1.75000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.38200000e-9 | fitted or derived |
| CGDMAX | 7.50000000e-10 | fitted or derived |
| CGDMIN | 6.50000000e-11 | fitted or derived |
| A | 2.03760391e-1 | fitted or derived |
| CJO | 1.54466307e-9 | fitted or derived |
| IS | 5.42348483e-13 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.50000000e-3 | fitted or derived |
| TT | 9.08897876e-8 | fitted or derived |
| BV | 5.50000000e+1 | fitted or derived |
| IBV | 2.50000000e-4 | fitted or derived |
| RTHJC | 1.50000000e+0 | fitted or derived |
| RTHCA | 6.05000000e+1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current | 7.000000e+0 | 7.113833e+0 | A | 1.626% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 2.000000e+1 | 1.976069e+1 | A | 1.197% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 5.500000e+1 | 5.072231e+1 | A | 7.778% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 8.500000e+1 | 8.456782e+1 | A | 0.508% | p. 3 fig. 3, manually digitized 25 degC curve |
| transfer current | 1.100000e+2 | 1.195956e+2 | A | 8.723% | p. 3 fig. 3, manually digitized 25 degC curve |
| RDS(on) | 1.750000e-2 | 1.750000e-2 | ohm | 0.000% | p. 2 RDS(on) MAX |
| output current | 7.000000e+0 | 7.109444e+0 | A | 1.563% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 2.000000e+1 | 1.974865e+1 | A | 1.257% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 5.500000e+1 | 5.069166e+1 | A | 7.833% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 8.500000e+1 | 8.451688e+1 | A | 0.568% | p. 3 fig. 1, manually digitized 25 degC curve |
| output current | 1.100000e+2 | 1.195237e+2 | A | 8.658% | p. 3 fig. 1, manually digitized 25 degC curve |
| Crss at 1 V | 7.500000e-10 | 4.299859e-10 | F | 42.669% | p. 4 fig. 5, manually digitized |
| Crss at 2 V | 5.800000e-10 | 3.804350e-10 | F | 34.408% | p. 4 fig. 5, manually digitized |
| Crss at 5 V | 3.400000e-10 | 2.717913e-10 | F | 20.061% | p. 4 fig. 5, manually digitized |
| Crss at 10 V | 2.000000e-10 | 1.865667e-10 | F | 6.717% | p. 4 fig. 5, manually digitized |
| Crss at 20 V | 1.200000e-10 | 1.291174e-10 | F | 7.598% | p. 4 fig. 5, manually digitized |
| Crss at 50 V | 6.500000e-11 | 9.107019e-11 | F | 40.108% | p. 4 fig. 5, manually digitized |

Worst fitting error: 42.669% for Crss at 1 V.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 6.393e-6 and worst absolute delta was 1.175e-4.

## Known omissions

- The RDS(on), body-diode voltage, and total gate-charge rows are guaranteed maxima; they are retained with source semantics and are not described as typical device values.
- Gate charge is not an optimizer residual. It is checked independently with a broad 75 percent tolerance because the compact VDMOS capacitance law does not reproduce the cited Miller plateau closely; transient coverage is approximate.
- Avalanche, UIS, safe-operating-area failure, temperature-dependent transfer, self-heating in the default three-terminal instance, package inductance, gate-oxide failure, process spread, and noise are not modelled.
- RG is held at the factory numerical floor because the datasheet does not publish intrinsic gate resistance.
- P5 independent review demoted this package from F2 to F1: the 5 V gate-charge check is about 69.5 percent low against the archetype 30 percent limit, and cited Crss curve residuals reach 42.7 percent.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
