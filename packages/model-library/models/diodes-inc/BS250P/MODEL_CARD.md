# BS250P model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: 45 V P-channel enhancement-mode vertical DMOS FET
- Electrical family: pmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.diodes.com/datasheet/download/BS250P.pdf
- Revision: DS33014 Rev. 3-2, October 2019
- Accessed: 2026-08-07
- Referenced pages: p. 1
- SHA-256: `a03a99a17a288c81961809446c5a84b7a5197d816421242dc7d5df63e5460a2f`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -2.25000000e+0 | derived or held |
| KP | 1.00000000e-1 | derived or held |
| THETA | 0.00000000e+0 | derived or held |
| LAMBDA | 3.00000000e-3 | derived or held |
| RD | 7.70000000e+0 | derived or held |
| RS | 2.80000000e+0 | derived or held |
| RG | 1.00000000e-4 | derived or held |
| CGS | 5.90000000e-11 | derived or held |
| CGDMAX | 1.00000000e-12 | derived or held |
| CGDMIN | 1.00000000e-12 | derived or held |
| A | 1.00000000e+0 | derived or held |
| CJO | 1.00000000e-12 | derived or held |
| IS | 1.00000000e-14 | derived or held |
| N | 1.50000000e+0 | derived or held |
| RB | 2.80000000e+0 | derived or held |
| TT | 0.00000000e+0 | derived or held |
| BV | 4.50000000e+1 | derived or held |
| IBV | 1.00000000e-4 | derived or held |
| RTHJC | 0.00000000e+0 | derived or held |
| RTHCA | 0.00000000e+0 | derived or held |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 3.00000000e-3 | 1 | held at default |
| RS | 2.80000000e+0 | ohm | held at default |
| VJ | 8.00000000e-1 | V | held at default |
| M | 5.00000000e-1 | 1 | held at default |
| FC | 5.00000000e-1 | 1 | held at default |
| N | 1.50000000e+0 | 1 | held at default |
| NBV | 1.00000000e+0 | 1 | held at default |
| TNOM | 2.70000000e+1 | degC | held at default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| Guaranteed-limit-only model | n/a | n/a | n/a | n/a | See held defaults and cited hard-bound benches |

Worst recorded fitting error: 0.000% for guaranteed-bound-only model. Guaranteed minima and maxima are checked as bounds and are not reported as typical fit residuals.

Native and WASM agreement: all 4 benches passed engine comparison. Worst relative delta 6.655e-9; worst absolute delta 1.665e-16. Datasheet expectations: 4/4 passed. Every bench sets .temp 25 explicitly.

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
- F1: fitted from tabulated rows only. The BS250P sheet publishes no transfer, output, capacitance-versus-VDS, body-diode, gate-charge, or reverse-recovery curve family and refers readers to a different part for graphs.
- VTO is held at default -2.25 V in the signed ngspice p-channel card, corresponding to the 2.25 V magnitude midpoint of the published threshold window.
- KP is held at default 0.1 A/V^2; it is selected conservatively to stay below the published RDS(on) maximum, not fitted to that maximum as though it were typical.
- THETA is held at default 0 and LAMBDA is held at default 0.003 because no typical transfer or output family is published.
- RD = 7.7 ohm and RS = 2.8 ohm are held at default from the archetype 55/20 split of the RDS(on) maximum.
- RG is held at default 1e-4 ohm because gate resistance is unpublished.
- CGS = 60 pF uses the typical Ciss row; CGDMAX = CGDMIN = 1 pF, CJO = 1 pF, and A = 1 are held at default because Coss, Crss, and capacitance curves are unpublished.
- VJ = 0.8, M = 0.5, FC = 0.5, IS = 1e-14 A, N = 1.5, RB = 2.8 ohm, NBV = 1, and TNOM = 27 degC are held at default because no body-diode forward data is published.
- TT is held at default 0 because reverse recovery is unpublished.
- RTHJC and RTHCA are held at default 0 because no thermal-resistance table is published.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
