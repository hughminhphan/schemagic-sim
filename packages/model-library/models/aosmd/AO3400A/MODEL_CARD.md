# AO3400A model card

## Identity

- Manufacturer: Alpha and Omega Semiconductor
- Description: 30 V logic-level N-channel MOSFET
- Electrical family: nmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.aosmd.com/sites/default/files/res/data_sheets/AO3400A.pdf
- Revision: Rev. 3.1, July 2023
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `9c60d0b6c1ddc7609a4b788a91181468d8ffe6c3e9ba425c3d8ffc5ba88c5033`
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
| VTO | 1.45000000e+0 | fitted |
| KP | 1.41069645e+2 | fitted |
| THETA | 5.35135858e-1 | fitted |
| LAMBDA | 3.00000000e-3 | derived or held |
| RD | 9.60705232e-3 | fitted |
| RS | 3.60000000e-3 | derived or held |
| RG | 3.00000000e+0 | derived or held |
| CGS | 5.80000000e-10 | derived or held |
| CGDMAX | 1.40000000e-10 | derived or held |
| CGDMIN | 3.60000000e-11 | derived or held |
| A | 1.73313164e-1 | derived or held |
| CJO | 1.11102430e-10 | derived or held |
| IS | 1.41993652e-8 | derived or held |
| N | 1.50000000e+0 | derived or held |
| RB | 3.60000000e-3 | derived or held |
| TT | 1.22629078e-8 | derived or held |
| BV | 3.00000000e+1 | derived or held |
| IBV | 2.50000000e-4 | derived or held |
| RTHJC | 6.30000000e+1 | derived or held |
| RTHCA | 3.70000000e+1 | derived or held |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 3.00000000e-3 | 1 | held at default |
| RS | 3.60000000e-3 | ohm | held at default |
| VJ | 8.00000000e-1 | V | held at default |
| M | 5.00000000e-1 | 1 | held at default |
| FC | 5.00000000e-1 | 1 | held at default |
| N | 1.50000000e+0 | 1 | held at default |
| NBV | 1.00000000e+0 | 1 | held at default |
| TNOM | 2.70000000e+1 | degC | held at default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| RDS(on) | 0.018 | 0.017792070941143556 | ohm | 1.155% | p. 2 static parameters, TYP column |
| RDS(on) | 0.019 | 0.019307377167113386 | ohm | 1.618% | p. 2 static parameters, TYP column |
| RDS(on) | 0.024 | 0.023879210526814052 | ohm | 0.503% | p. 2 static parameters, TYP column |

Worst recorded fitting error: 1.618% for RDS(on). Guaranteed minima and maxima are checked as bounds and are not reported as typical fit residuals.

Native and WASM agreement: all 4 benches passed engine comparison. Worst relative delta 1.110e-7; worst absolute delta 7.772e-16. Datasheet expectations: 7/7 passed. Every bench sets .temp 25 explicitly.

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
- F1 downgrade: the factory Python raw parser and the validated native reader disagreed materially on the same F2 probe, so an F2 claim would be unsafe. The shipped DC model is refitted to the three 25 degC typical RDS(on) rows through the validated reader only.
- Transfer and output characteristics are not claimed fitted; saturation-region drain current is approximate even though typical plots are published.
- LAMBDA is held at default 0.003 because the F1 table-only fit does not identify channel-length modulation.
- RS = 3.6 mOhm is held at default from the archetype 20% split; RD, VTO, KP, and THETA are fitted through native ngspice and the validated raw reader to typical RDS(on) rows.
- VJ = 0.8, M = 0.5, FC = 0.5, N = 1.5, NBV = 1, and TNOM = 27 degC are held at default.
- CJO is derived from the single typical Coss row with VJ and M held at default; the capacitance curve is used only for the CGD shape.
- RTHJC uses the typical junction-to-lead value as the available package conduction path and RTHCA is derived from typical steady-state RthetaJA; the electrothermal instance is not validated.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
