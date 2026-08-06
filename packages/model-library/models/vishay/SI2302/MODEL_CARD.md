# SI2302 model card

## Identity

- Manufacturer: Vishay Siliconix
- Description: 20 V logic-level N-channel MOSFET
- Electrical family: nmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.vishay.com/docs/63653/si2302dds.pdf
- Revision: S11-2528-Rev. A, 26-Dec-2011
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `ba5477984d164630c519be83b6e7839d7992d26df482e65b081286c5a083a568`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | approx |
| noise | none |
| thermal | approx |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | 8.44892375e-1 | fitted |
| KP | 2.03814386e+1 | fitted |
| THETA | 1.54159066e-3 | fitted |
| LAMBDA | 3.00000000e-3 | derived or held |
| RD | 1.61771735e-2 | fitted |
| RS | 9.00000000e-3 | derived or held |
| RG | 4.00000000e+0 | derived or held |
| CGS | 3.00000000e-10 | derived or held |
| CGDMAX | 3.50000000e-11 | derived or held |
| CGDMIN | 1.00000000e-11 | derived or held |
| A | 2.50000000e-1 | derived or held |
| CJO | 1.60000000e-10 | derived or held |
| IS | 1.69000000e-8 | derived or held |
| N | 1.50000000e+0 | derived or held |
| RB | 9.00000000e-3 | derived or held |
| TT | 1.22629000e-8 | derived or held |
| BV | 2.00000000e+1 | derived or held |
| IBV | 2.50000000e-4 | derived or held |
| RTHJC | 6.20000000e+1 | derived or held |
| RTHCA | 7.80000000e+1 | derived or held |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 3.00000000e-3 | 1 | held at default |
| RS | 9.00000000e-3 | ohm | held at default |
| VJ | 8.00000000e-1 | V | held at default |
| M | 5.00000000e-1 | 1 | held at default |
| FC | 5.00000000e-1 | 1 | held at default |
| N | 1.50000000e+0 | 1 | held at default |
| NBV | 1.00000000e+0 | 1 | held at default |
| TNOM | 2.70000000e+1 | degC | held at default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| RDS(on) | 0.045 | 0.04500000152801322 | ohm | 0.000% | p. 2 specifications, TYP column |
| RDS(on) | 0.056 | 0.055999998771450794 | ohm | 0.000% | p. 2 specifications, TYP column |

Worst recorded fitting error: 0.000% for RDS(on). Guaranteed minima and maxima are checked as bounds and are not reported as typical fit residuals.

Native and WASM agreement: all 3 benches passed engine comparison. Worst relative delta 1.509e-14; worst absolute delta 7.772e-16. Datasheet expectations: 4/4 passed. Every bench sets .temp 25 explicitly.

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
- F1: DC behavior is fitted to the two tabulated 25 degC typical RDS(on) rows; transfer and output curve families are not fitted.
- VTO, KP, THETA, and RD are fitted through native ngspice; LAMBDA is held at default 0.003 because output curves are not fitted.
- RS = 9 mOhm is held at default from the archetype 20% split.
- The datasheet has capacitance plots but no tabulated Ciss/Coss/Crss values. CGS, CGDMAX, CGDMIN, A, and CJO are held at approximate defaults and AC analysis is not claimed.
- VJ = 0.8, M = 0.5, FC = 0.5, N = 1.5, NBV = 1, and TNOM = 27 degC are held at default.
- Body-diode IS uses the single typical VSD row with N held at default; reverse recovery is first-order.
- Thermal resistances are transcribed/derived but electrothermal operation is not validated.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
