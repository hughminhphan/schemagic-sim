# IRF540N model card

## Identity

- Manufacturer: Infineon Technologies
- Description: 100 V N-channel power MOSFET
- Electrical family: nmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.infineon.com/assets/row/public/documents/24/49/infineon-irf540n-datasheet-en.pdf
- Revision: PD-94812, 03-Nov-2003; public asset modified 29-Apr-2021
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `d80d2e7163f2d59cf8fdf9a2df04dabee0716f0d26e713459d22431af92da36f`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | approx |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | 3.77508223e+00 | fitted |
| KP | 9.01991945e+01 | fitted |
| THETA | 1.00000000e+00 | fitted |
| LAMBDA | 2.70148171e-03 | fitted |
| RD | 1.66129166e-02 | fitted |
| RS | 7.40000000e-03 | derived or transcribed |
| RG | 1.00000000e-04 | derived or transcribed |
| CGS | 1.92000000e-09 | derived or transcribed |
| CGDMAX | 7.50000000e-10 | derived or transcribed |
| CGDMIN | 1.00000000e-11 | derived or transcribed |
| A | 3.94475736e-01 | fitted |
| CJO | 1.19257075e-09 | derived or transcribed |
| IS | 6.80487598e-09 | derived or transcribed |
| N | 1.50000000e+00 | held at default |
| RB | 7.40000000e-03 | derived or transcribed |
| TT | 0.00000000e+00 | held at default |
| BV | 1.00000000e+02 | derived or transcribed |
| IBV | 2.50000000e-04 | derived or transcribed |
| RTHJC | 1.15000000e+00 | derived or transcribed |
| RTHCA | 6.08500000e+01 | derived or transcribed |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RDS | 1.00000000e+09 | ohm | held at default; leakage is checked against the datasheet IDSS maximum |
| VJ | 8.00000000e-01 | V | held at default; one capacitance condition cannot separate VJ and M |
| M | 5.00000000e-01 | 1 | held at default; one capacitance condition cannot separate VJ and M |
| FC | 5.00000000e-01 | 1 | held at default |
| NBV | 1.00000000e+00 | 1 | held at default; one breakdown row cannot fit breakdown shape |
| N | 1.50000000e+00 | 1 | held at default; only one 25 degC body-diode curve point is used |
| TT | 0.00000000e+00 | s | held at default; trr is published without the reverse-current term required by the archetype mapping |
| MU | 0.00000000e+00 | 1 | held at default; RDS(on)-versus-temperature was not digitized |
| TEXP0 | 0.00000000e+00 | 1 | held at default; RDS(on)-versus-temperature was not digitized |
| TCVTH | 0.00000000e+00 | V/K | held at default; threshold temperature behavior was not fitted |
| CTHJ | 0.00000000e+00 | J/K | held at default; transient thermal capacitance is not published |
| KF | 0.00000000e+00 | 1 | held at default; flicker noise is not modelled |
| AF | 1.00000000e+00 | 1 | held at default; flicker noise is not modelled |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current | 1.600000e+01 | 1.529280e+01 | A | 4.420% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 2.900000e+01 | 2.683770e+01 | A | 7.456% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 4.400000e+01 | 4.255277e+01 | A | 3.289% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 5.900000e+01 | 5.907945e+01 | A | 0.135% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 7.400000e+01 | 7.609549e+01 | A | 2.832% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 8.900000e+01 | 9.342766e+01 | A | 4.975% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 1.010000e+02 | 1.109734e+02 | A | 9.875% | p. 3 Fig. 3, 25 degC curve, digitized |
| RDS(on) | 3.700000e-02 | 3.700008e-02 | ohm | 0.000% | p. 3 Fig. 1, 10 V curve at 16 A, digitized typical |
| output current | 1.000000e+01 | 1.164539e+01 | A | 16.454% | p. 3 Fig. 1, digitized |
| output current | 2.700000e+01 | 2.481266e+01 | A | 8.101% | p. 3 Fig. 1, digitized |
| output current | 4.400000e+01 | 3.940208e+01 | A | 10.450% | p. 3 Fig. 1, digitized |
| output current | 5.900000e+01 | 5.475335e+01 | A | 7.198% | p. 3 Fig. 1, digitized |
| output current | 7.800000e+01 | 8.666611e+01 | A | 11.110% | p. 3 Fig. 1, digitized |
| Crss at 1 V | 7.500000e-10 | 3.539967e-10 | F | 52.800% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 2 V | 5.000000e-10 | 2.698779e-10 | F | 46.024% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 5 V | 2.600000e-10 | 1.450682e-10 | F | 44.205% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 10 V | 1.200000e-10 | 8.146445e-11 | F | 32.113% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 20 V | 5.500000e-11 | 4.629143e-11 | F | 15.834% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 25 V | 4.000000e-11 | 3.908854e-11 | F | 2.279% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 50 V | 2.000000e-11 | 2.458149e-11 | F | 22.907% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 100 V | 1.000000e-11 | 1.729543e-11 | F | 72.954% | p. 4 Fig. 5 Crss trace, digitized |

Worst fitting error: 72.954% for Crss at 100 V.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.947e-03 and worst absolute delta was 1.947e-12.

## Known omissions

- Avalanche and unclamped inductive switching (UIS/EAS) are not modelled. The model conducts through BV as ordinary diode breakdown and does not fail.
- Safe operating area is not enforced. Absolute maximum ratings are metadata and are not failure limits.
- No self-heating in the default three-terminal instance; junction temperature is fixed at TNOM.
- Package and lead inductance are not modelled, so measured switching ringing will not reproduce.
- Threshold-voltage spread and gate oxide breakdown are not modelled.
- RTHJC and RTHCA are transcribed from the thermal table, but the five-terminal electrothermal form is not validated against datasheet data.
- F1 downgrade: the independent gate-charge cross-check missed the p. 4 Fig. 6 typical value by more than 30 percent. Capacitances remain anchored to the p. 2 table, but switching charge is not claimed as fitted.
- The supported region is capped at 50 V. Setting BV to the p. 2 guaranteed minimum breakdown pair causes ordinary model breakdown near 100 V, so low IDSS at the full 100 V rating is not claimed.
- RDS is held at default as a 1 Gohm leakage shunt; off-state leakage is bounded by a datasheet check.
- VJ = 0.8 V, M = 0.5, FC = 0.5, and NBV = 1 are held at default because the published data does not separate them.
- Body-diode N = 1.5 is held at default because only one 25 degC curve point is used.
- TT is held at default because the datasheet does not publish the reverse-current term required to map trr mechanically.
- MU, TEXP0, and TCVTH are held at default; only 25 degC behavior is fitted.
- CTHJ is held at default because transient thermal capacitance is not published.
- KF and AF are held at default; flicker noise is not modelled.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
