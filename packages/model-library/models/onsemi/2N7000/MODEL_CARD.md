# 2N7000 model card

## Identity

- Manufacturer: onsemi
- Description: 60 V N-channel small-signal MOSFET
- Electrical family: nmos
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.cn/download/data-sheet/pdf/2n7000-d.pdf
- Revision: Rev. 8, April 2011
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `b9cfecc7be11b19ac817e3160d6c862494f28cae0bdc3e826ab83ab15749c228`
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
| VTO | 1.90000000e+0 | derived or held |
| KP | 2.00000000e-1 | derived or held |
| THETA | 0.00000000e+0 | derived or held |
| LAMBDA | 3.00000000e-3 | derived or held |
| RD | 2.75000000e+0 | derived or held |
| RS | 1.00000000e+0 | derived or held |
| RG | 1.00000000e-4 | derived or held |
| CGS | 5.50000000e-11 | derived or held |
| CGDMAX | 5.00000000e-12 | derived or held |
| CGDMIN | 5.00000000e-12 | derived or held |
| A | 1.00000000e+0 | derived or held |
| CJO | 1.13370000e-10 | derived or held |
| IS | 1.00000000e-14 | derived or held |
| N | 1.50000000e+0 | derived or held |
| RB | 1.00000000e+0 | derived or held |
| TT | 0.00000000e+0 | derived or held |
| BV | 6.00000000e+1 | derived or held |
| IBV | 1.00000000e-2 | derived or held |
| RTHJC | 0.00000000e+0 | derived or held |
| RTHCA | 3.57000000e+2 | derived or held |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 3.00000000e-3 | 1 | held at default |
| RS | 1.00000000e+0 | ohm | held at default |
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

Native and WASM agreement: all 4 benches passed engine comparison. Worst relative delta 3.697e-8; worst absolute delta 1.776e-15. Datasheet expectations: 6/6 passed. Every bench sets .temp 25 explicitly.

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
- F1: the datasheet publishes typical transfer and output plots, but no typical RDS(on) row, body-diode row, or gate-charge data. An F2 archetype fit cannot be completed without treating guaranteed limits as typical targets.
- VTO is held at default 1.9 V, the midpoint of the published 0.8 V minimum and 3.0 V maximum threshold window.
- KP is held at default 0.2 A/V^2; it is selected conservatively so both published maximum RDS(on) limits pass, not fitted to a typical table value.
- THETA is held at default 0 and LAMBDA is held at default 0.003 because a full typical DC curve-family fit is not claimed.
- RD = 2.75 ohm and RS = 1 ohm are held at default from the archetype 55/20 split of the strongest published RDS(on) maximum; this does not convert that maximum into a typical target.
- RG is held at default 1e-4 ohm because gate resistance is unpublished.
- CGDMAX = CGDMIN = 5 pF and A = 1 are held at default because no capacitance-versus-VDS curve is published; terminal capacitances use the published maxima.
- VJ = 0.8, M = 0.5, FC = 0.5, N = 1.5, NBV = 1, TNOM = 27 degC, IS = 1e-14 A, and RB = 1 ohm are held at default; no body-diode forward row is published.
- TT is held at default 0 because body-diode reverse recovery is unpublished.
- RTHCA = 357 K/W is transcribed from RthetaJA; RTHJC is held at default 0 because junction-to-case resistance is unpublished and electrothermal operation is not claimed.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
