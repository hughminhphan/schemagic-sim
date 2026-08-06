# IRF9540N model card

## Identity

- Manufacturer: Infineon Technologies
- Description: 100 V P-channel HEXFET power MOSFET
- Electrical family: pmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.infineon.com/assets/row/public/documents/24/49/infineon-irf9540n-datasheet-en.pdf
- Revision: PD-94790A, 23-Jan-2004
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `1154632fb4e57ba48ec035da6857e01fe348f983b37d3a6b7dcc36751773b541`
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
| VTO | 3.00000000e+00 | held at default |
| KP | 3.46801134e+00 | fitted |
| THETA | 0.00000000e+00 | held at default |
| LAMBDA | 3.00000000e-03 | held at default |
| RS | 1.80000000e-02 | derived or transcribed |
| RD | 4.95000000e-02 | derived or transcribed |
| RG | 1.00000000e-04 | derived or transcribed |
| CGS | 1.06000000e-09 | derived or transcribed |
| CGDMAX | 1.50000000e-09 | derived or transcribed |
| CGDMIN | 1.50000000e-10 | derived or transcribed |
| A | 1.86285000e-01 | fitted |
| CJO | 9.08625335e-10 | derived or transcribed |
| IS | 4.90313920e-09 | fitted with N held at default |
| N | 1.50000000e+00 | held at default |
| RB | 1.80000000e-02 | derived or transcribed |
| TT | 0.00000000e+00 | held at default |
| BV | 1.00000000e+02 | derived or transcribed |
| IBV | 2.50000000e-04 | derived or transcribed |
| RTHJC | 1.10000000e+00 | derived or transcribed |
| RTHCA | 6.09000000e+01 | derived or transcribed |

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
| VTO | 3.00000000e+00 | V | held at default midpoint of the published MIN/MAX threshold window; no TYP threshold is published |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| RDS(on) | 9.000000e-02 | 9.000000e-02 | ohm | 0.000% | p. 3 Fig. 1, VGS = -10 V at ID = -11 A, digitized typical; p. 2 RDS(on) MAX column |
| Crss at 1 V | 1.500000e-09 | 7.743667e-10 | F | 48.376% | p. 4 Fig. 5, Crss trace, digitized |
| Crss at 2 V | 1.150000e-09 | 7.503846e-10 | F | 34.749% | p. 4 Fig. 5, Crss trace, digitized |
| Crss at 5 V | 7.500000e-10 | 6.178808e-10 | F | 17.616% | p. 4 Fig. 5, Crss trace, digitized |
| Crss at 10 V | 5.000000e-10 | 4.242450e-10 | F | 15.151% | p. 4 Fig. 5, Crss trace, digitized |
| Crss at 20 V | 3.000000e-10 | 2.925589e-10 | F | 2.480% | p. 4 Fig. 5, Crss trace, digitized |
| Crss at 25 V | 2.400000e-10 | 2.643752e-10 | F | 10.156% | p. 4 Fig. 5, Crss trace, digitized |
| Crss at 50 V | 1.500000e-10 | 2.072910e-10 | F | 38.194% | p. 4 Fig. 5, Crss trace, digitized |
| body-diode forward voltage | 9.000000e-01 | 9.000000e-01 | V | 0.000% | p. 4 Fig. 7, 25 degC curve at IS = -11 A, digitized |

Worst fitting error: 48.376% for Crss at 1 V.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 9.062e-16 and worst absolute delta was 2.220e-16.

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
- VTO is held at the midpoint of the guaranteed VGS(th) MIN/MAX window because no typical threshold value is published.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
