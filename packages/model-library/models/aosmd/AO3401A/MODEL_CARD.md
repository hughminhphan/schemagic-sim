# AO3401A model card

## Identity

- Manufacturer: Alpha and Omega Semiconductor
- Description: 30 V logic-level P-channel MOSFET
- Electrical family: pmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.aosmd.com/sites/default/files/res/data_sheets/AO3401A.pdf
- Revision: Rev. 3.1, December 2023
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `0d8e3261ae280e007b5837fff60c55142f2d92af71edc4d02aee6f7a760a785c`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | approx |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -9.22979946e-1 | fitted |
| KP | 2.91983777e+1 | fitted |
| THETA | 3.85766882e-1 | fitted |
| LAMBDA | 3.00000000e-3 | derived or held |
| RD | 1.59112462e-2 | fitted |
| RS | 8.20000000e-3 | derived or held |
| RG | 7.80000000e+0 | derived or held |
| CGS | 5.90000000e-10 | derived or held |
| CGDMAX | 1.50000000e-10 | derived or held |
| CGDMIN | 4.00000000e-11 | derived or held |
| A | 2.00000000e-1 | derived or held |
| CJO | 1.11102430e-10 | derived or held |
| IS | 1.60300000e-8 | derived or held |
| N | 1.50000000e+0 | derived or held |
| RB | 8.20000000e-3 | derived or held |
| TT | 1.58690000e-8 | derived or held |
| BV | 3.00000000e+1 | derived or held |
| IBV | 2.50000000e-4 | derived or held |
| RTHJC | 6.30000000e+1 | derived or held |
| RTHCA | 3.70000000e+1 | derived or held |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 3.00000000e-3 | 1 | held at default |
| RS | 8.20000000e-3 | ohm | held at default |
| VJ | 8.00000000e-1 | V | held at default |
| M | 5.00000000e-1 | 1 | held at default |
| FC | 5.00000000e-1 | 1 | held at default |
| N | 1.50000000e+0 | 1 | held at default |
| NBV | 1.00000000e+0 | 1 | held at default |
| TNOM | 2.70000000e+1 | degC | held at default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| RDS(on) | 0.041 | 0.04100000114960387 | ohm | 0.000% | p. 2 static parameters, TYP column |
| RDS(on) | 0.047 | 0.046999998198336834 | ohm | 0.000% | p. 2 static parameters, TYP column |
| RDS(on) | 0.06 | 0.06000000067085951 | ohm | 0.000% | p. 2 static parameters, TYP column |

Worst recorded fitting error: 0.000% for RDS(on). Guaranteed minima and maxima are checked as bounds and are not reported as typical fit residuals.

Native and WASM agreement: all 4 benches passed engine comparison. Worst relative delta 8.477e-16; worst absolute delta 2.220e-16. Datasheet expectations: 7/7 passed. Every bench sets .temp 25 explicitly.

## Known omissions

- Avalanche and unclamped inductive switching (UIS/EAS) are not modelled. The model conducts through BV as an ordinary diode breakdown; it does not fail.
- Safe operating area is not enforced. Absolute maximum ratings are metadata; the model will happily dissipate excessive power.
- No self-heating in the default three-terminal instance: junction temperature is fixed at TNOM. RDS(on) does not rise with dissipation.
- Package and lead inductance are not modelled, so measured switching ringing will not reproduce.
- Threshold-voltage spread is not modelled.
- Gate oxide breakdown beyond the rated VGS maximum is not modelled.
- RDS is held at default 1e9 ohm as the off-state shunt.
- MU, TEXP0, and TCVTH are held at default; only 25 degC behavior is fitted.
- CTHJ is held at default because junction thermal capacitance is unpublished; electrothermal transients are not claimed.
- Flicker noise is not modelled: KF and AF are held at default.
- F1: DC behavior is fitted to tabulated 25 degC typical RDS(on) rows; transfer and output curve families are not fitted.
- The signed ngspice p-channel VTO is fitted to -0.923 V, within the published 0.5 V to 1.3 V threshold-magnitude window; KP, RD, and THETA are fitted through the validated native reader.
- THETA is held at default 0 after the table fit converged at its physical lower bound; LAMBDA is held at default 0.003 because output curves are not fitted.
- RS = 8.2 mOhm is held at default from the archetype 20% split.
- CGDMAX, CGDMIN, and A are approximate digitizations of Figure 8 rather than an F2 capacitance-curve fit.
- VJ = 0.8, M = 0.5, FC = 0.5, N = 1.5, NBV = 1, and TNOM = 27 degC are held at default.
- CJO is derived from one Coss row; body-diode IS uses one typical VSD row with N held at default.
- Thermal resistances are transcribed/derived but electrothermal operation is not validated.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
