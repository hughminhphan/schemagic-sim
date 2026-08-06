# FQP30N06L model card

## Identity

- Manufacturer: onsemi
- Description: 60 V logic-level N-channel QFET power MOSFET
- Electrical family: nmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.cn/download/data-sheet/pdf/fqp30n06l-d.pdf
- Revision: FQP30N06L Rev. C1, November 2013
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `f9e48dc14d2ac5dcaa550bee8f663e421cafbf3a17d8f9565d66d7f66592f21d`
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
| VTO | 1.00000000e+00 | fitted |
| KP | 1.74039568e+01 | fitted |
| THETA | 0.00000000e+00 | held at default |
| LAMBDA | 3.00000000e-03 | held at default |
| RS | 5.40000000e-03 | derived or transcribed |
| RD | 1.48500000e-02 | derived or transcribed |
| RG | 1.00000000e-04 | derived or transcribed |
| CGS | 7.50000000e-10 | derived or transcribed |
| CGDMAX | 9.50000000e-10 | derived or transcribed |
| CGDMIN | 2.00000000e-11 | derived or transcribed |
| A | 4.40658282e-01 | fitted |
| CJO | 1.24935984e-09 | derived or transcribed |
| IS | 4.16853877e-09 | derived or transcribed |
| N | 1.50000000e+00 | held at default |
| RB | 5.40000000e-03 | derived or transcribed |
| TT | 0.00000000e+00 | held at default |
| BV | 6.00000000e+01 | derived or transcribed |
| IBV | 2.50000000e-04 | derived or transcribed |
| RTHJC | 1.90000000e+00 | derived or transcribed |
| RTHCA | 6.06000000e+01 | derived or transcribed |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RDS | 1.00000000e+09 | ohm | held at default; supported off-state is not extended to breakdown |
| VJ | 8.00000000e-01 | V | held at default; one capacitance condition cannot separate VJ and M |
| M | 5.00000000e-01 | 1 | held at default; one capacitance condition cannot separate VJ and M |
| FC | 5.00000000e-01 | 1 | held at default |
| NBV | 1.00000000e+00 | 1 | held at default; one breakdown row cannot fit breakdown shape |
| N | 1.50000000e+00 | 1 | held at default; only one 25 degC body-diode curve point is used |
| TT | 0.00000000e+00 | s | held at default; trr is published without the reverse-current term required by the archetype mapping |
| THETA | 0.00000000e+00 | 1 | held at default; F1 DC fit uses tabulated RDS(on) rows only |
| LAMBDA | 3.00000000e-03 | 1/V | held at default; output-curve slope is not fitted |
| MU | 0.00000000e+00 | 1 | held at default; temperature behavior is not fitted |
| TEXP0 | 0.00000000e+00 | 1 | held at default; temperature behavior is not fitted |
| TCVTH | 0.00000000e+00 | V/K | held at default; threshold temperature behavior is not fitted |
| CTHJ | 0.00000000e+00 | J/K | held at default; transient thermal capacitance is not published |
| KF | 0.00000000e+00 | 1 | held at default; flicker noise is not modelled |
| AF | 1.00000000e+00 | 1 | held at default; flicker noise is not modelled |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| RDS(on) | 2.700000e-02 | 2.666680e-02 | ohm | 1.234% | p. 2 Electrical Characteristics, RDS(on), TYP and MAX columns |
| RDS(on) | 3.500000e-02 | 3.523366e-02 | ohm | 0.668% | p. 2 Electrical Characteristics, RDS(on), TYP and MAX columns |
| Crss at 0.1 V | 9.500000e-10 | 5.723136e-10 | F | 39.756% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 0.2 V | 8.200000e-10 | 5.564444e-10 | F | 32.141% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 0.5 V | 6.500000e-10 | 5.097925e-10 | F | 21.570% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 1 V | 5.200000e-10 | 4.380947e-10 | F | 15.751% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 2 V | 4.000000e-10 | 3.269135e-10 | F | 18.272% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 5 V | 2.500000e-10 | 1.741313e-10 | F | 30.347% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 10 V | 1.500000e-10 | 1.007271e-10 | F | 32.849% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 25 V | 5.000000e-11 | 5.274800e-11 | F | 5.496% | p. 3 Fig. 5, Crss trace, digitized |
| Crss at 60 V | 2.000000e-11 | 3.367588e-11 | F | 68.379% | p. 3 Fig. 5, Crss trace, digitized |

Worst fitting error: 68.379% for Crss at 60 V.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 4.671e-15 and worst absolute delta was 8.882e-16.

## Known omissions

- Avalanche and unclamped inductive switching (UIS/EAS) are not modelled. The model conducts through BV as ordinary diode breakdown and does not fail.
- Safe operating area is not enforced. Absolute maximum ratings are metadata and are not failure limits.
- No self-heating in the default three-terminal instance; junction temperature is fixed at TNOM.
- Package and lead inductance are not modelled, so measured switching ringing will not reproduce.
- Threshold-voltage spread and gate oxide breakdown are not modelled.
- RTHJC and RTHCA are transcribed from the thermal table, but the five-terminal electrothermal form is not validated against datasheet data.
- F1 scope: DC channel fitting uses the tabulated RDS(on) conditions only. Transfer and output curve families are not fitted, so saturation-region current is approximate.
- RDS is held at default as a 1 Gohm leakage shunt. The supported region is limited to the fitted on-state conditions rather than the full breakdown rating.
- VJ = 0.8 V, M = 0.5, FC = 0.5, and NBV = 1 are held at default because the published data does not separate them.
- Body-diode N = 1.5 is held at default because only one 25 degC curve point is used.
- TT is held at default because the datasheet does not publish the reverse-current term required to map trr mechanically.
- THETA = 0 and LAMBDA = 0.003 are held at default because transfer and output curve families are not fitted.
- MU, TEXP0, and TCVTH are held at default; only 25 degC behavior is fitted.
- CTHJ is held at default because transient thermal capacitance is not published.
- KF and AF are held at default; flicker noise is not modelled.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
