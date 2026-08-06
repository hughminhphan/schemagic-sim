# IRLB8721PBF model card

## Identity

- Manufacturer: Infineon Technologies
- Description: 30 V logic-level N-channel power MOSFET
- Electrical family: nmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.infineon.com/assets/row/public/documents/24/49/infineon-irlb8721-datasheet-en.pdf
- Revision: PD-97390, 22-Apr-2009; public asset modified 29-Apr-2021
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `8a313aecdd1e772533d581fe824a668b069daec97777f32517059eafed05dc39`
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
| VTO | 2.35000000e+00 | fitted |
| KP | 5.43802455e+01 | fitted |
| THETA | 9.22935292e-02 | fitted |
| LAMBDA | 2.16102995e-13 | fitted |
| RD | 1.07251935e-03 | fitted |
| RS | 1.30000000e-03 | derived or transcribed |
| RG | 2.30000000e+00 | derived or transcribed |
| CGS | 9.67000000e-10 | derived or transcribed |
| CGDMAX | 1.80000000e-10 | derived or transcribed |
| CGDMIN | 9.00000000e-11 | derived or transcribed |
| A | 8.59642018e-02 | fitted |
| CJO | 1.11102430e-09 | derived or transcribed |
| IS | 1.53296814e-08 | derived or transcribed |
| N | 1.50000000e+00 | held at default |
| RB | 1.30000000e-03 | derived or transcribed |
| TT | 0.00000000e+00 | held at default |
| BV | 3.00000000e+01 | derived or transcribed |
| IBV | 2.50000000e-04 | derived or transcribed |
| RTHJC | 2.30000000e+00 | derived or transcribed |
| RTHCA | 5.97000000e+01 | derived or transcribed |

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
| transfer current | 4.000000e+00 | 1.050972e+01 | A | 162.743% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 1.100000e+01 | 1.944484e+01 | A | 76.771% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 2.000000e+01 | 3.069902e+01 | A | 53.495% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 4.200000e+01 | 5.933125e+01 | A | 41.265% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 6.800000e+01 | 9.501443e+01 | A | 39.727% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 8.800000e+01 | 1.366822e+02 | A | 55.321% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 1.250000e+02 | 2.347806e+02 | A | 87.824% | p. 3 Fig. 3, 25 degC curve, digitized |
| transfer current | 1.550000e+02 | 3.486657e+02 | A | 124.946% | p. 3 Fig. 3, 25 degC curve, digitized |
| RDS(on) | 6.500000e-03 | 6.479542e-03 | ohm | 0.315% | p. 2 Static table, RDS(on), TYP column |
| RDS(on) | 1.310000e-02 | 1.336355e-02 | ohm | 2.012% | p. 2 Static table, RDS(on), TYP column |
| output current | 4.000000e+00 | 1.050972e+01 | A | 162.743% | p. 3 Fig. 1, digitized |
| output current | 1.700000e+01 | 3.069902e+01 | A | 80.582% | p. 3 Fig. 1, digitized |
| output current | 4.300000e+01 | 5.933125e+01 | A | 37.980% | p. 3 Fig. 1, digitized |
| output current | 7.000000e+01 | 9.501443e+01 | A | 35.735% | p. 3 Fig. 1, digitized |
| output current | 1.300000e+02 | 1.834954e+02 | A | 41.150% | p. 3 Fig. 1, digitized |
| Crss at 1 V | 1.800000e-10 | 1.419528e-10 | F | 21.137% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 2 V | 1.650000e-10 | 1.389952e-10 | F | 15.761% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 5 V | 1.450000e-10 | 1.307468e-10 | F | 9.830% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 10 V | 1.250000e-10 | 1.201033e-10 | F | 3.917% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 15 V | 1.100000e-10 | 1.130653e-10 | F | 2.787% | p. 4 Fig. 5 Crss trace, digitized |
| Crss at 30 V | 9.000000e-11 | 1.029254e-10 | F | 14.362% | p. 4 Fig. 5 Crss trace, digitized |

Worst fitting error: 162.743% for transfer current.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 4.090e-05 and worst absolute delta was 1.494e-12.

## Known omissions

- Avalanche and unclamped inductive switching (UIS/EAS) are not modelled. The model conducts through BV as ordinary diode breakdown and does not fail.
- Safe operating area is not enforced. Absolute maximum ratings are metadata and are not failure limits.
- No self-heating in the default three-terminal instance; junction temperature is fixed at TNOM.
- Package and lead inductance are not modelled, so measured switching ringing will not reproduce.
- Threshold-voltage spread and gate oxide breakdown are not modelled.
- RTHJC and RTHCA are transcribed from the thermal table, but the five-terminal electrothermal form is not validated against datasheet data.
- F1 downgrade: the native VDMOS form could not simultaneously meet the archetype F2 transfer-curve and both typical RDS(on) thresholds. RDS(on) is prioritized; transfer and output current above the tabulated bias points are approximate.
- RDS is held at default as a 1 Gohm leakage shunt; off-state leakage is bounded by a datasheet check.
- VJ = 0.8 V, M = 0.5, FC = 0.5, and NBV = 1 are held at default because the published data does not separate them.
- Body-diode N = 1.5 is held at default because only one 25 degC curve point is used.
- TT is held at default because the datasheet does not publish the reverse-current term required to map trr mechanically.
- MU, TEXP0, and TCVTH are held at default; only 25 degC behavior is fitted.
- CTHJ is held at default because transient thermal capacitance is not published.
- KF and AF are held at default; flicker noise is not modelled.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
