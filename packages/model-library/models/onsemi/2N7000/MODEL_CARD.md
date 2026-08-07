# 2N7000 model card

## Identity

- Manufacturer: onsemi
- Electrical family: nmos
- Fidelity tier: F2, 25 degC typical-curve family
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.cn/download/data-sheet/pdf/2n7000-d.pdf
- Revision: Rev. 8, April 2011
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `b9cfecc7be11b19ac817e3160d6c862494f28cae0bdc3e826ab83ab15749c228`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit method

VTO, KP, THETA, and RD were fitted with native ngspice-46 in the residual loop against the 25 degC transfer and output curve families plus two digitized local RDS(on) slopes. RD was constrained to the archetype range around the fixed 55 percent seed. Three seeds converged to the same vector. LAMBDA disagreed in the first seed sweep, so it was dropped and held at the archetype default 0.003. The worst transfer residual is 31.83%, inside the 33% curve-reading threshold.

Ciss, Coss, and Crss are published only as maxima. They are used as conservative AC bounds, not typical fit targets. No body-diode forward or recovery data and no gate-charge row are published, so those domains remain approximate.

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current at VGS=4 V, VDS=10 V | 0.2 | 0.163851 | A | 18.07% | p. 3 Figure 2, 25 degC curve, digitized |
| transfer current at VGS=4.5 V, VDS=10 V | 0.285 | 0.249247 | A | 12.54% | p. 3 Figure 2, 25 degC curve, digitized |
| transfer current at VGS=5 V, VDS=10 V | 0.37 | 0.349316 | A | 5.59% | p. 3 Figure 2, 25 degC curve, digitized |
| transfer current at VGS=6 V, VDS=10 V | 0.55 | 0.588817 | A | 7.06% | p. 3 Figure 2, 25 degC curve, digitized |
| transfer current at VGS=7 V, VDS=10 V | 0.73 | 0.874362 | A | 19.78% | p. 3 Figure 2, 25 degC curve, digitized |
| transfer current at VGS=8 V, VDS=10 V | 0.91 | 1.19964 | A | 31.83% | p. 3 Figure 2, 25 degC curve, digitized |
| output current at VGS=4 V, VDS=1 V | 0.1 | 0.116782 | A | 16.78% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=4 V, VDS=2 V | 0.14 | 0.160246 | A | 14.46% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=4 V, VDS=5 V | 0.15 | 0.161648 | A | 7.77% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=5 V, VDS=1 V | 0.19 | 0.178687 | A | 5.95% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=5 V, VDS=2 V | 0.3 | 0.295165 | A | 1.61% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=5 V, VDS=3 V | 0.36 | 0.342397 | A | 4.89% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=5 V, VDS=5 V | 0.38 | 0.344766 | A | 9.27% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=6 V, VDS=1 V | 0.24 | 0.230594 | A | 3.92% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=6 V, VDS=2 V | 0.42 | 0.407767 | A | 2.91% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=6 V, VDS=3 V | 0.52 | 0.525737 | A | 1.10% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=6 V, VDS=5 V | 0.56 | 0.581359 | A | 3.81% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=8 V, VDS=1 V | 0.32 | 0.312712 | A | 2.28% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=8 V, VDS=2 V | 0.65 | 0.584818 | A | 10.03% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=8 V, VDS=3 V | 0.88 | 0.812307 | A | 7.69% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=8 V, VDS=5 V | 1.04 | 1.11534 | A | 7.24% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=10 V, VDS=1 V | 0.39 | 0.374712 | A | 3.92% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=10 V, VDS=2 V | 0.78 | 0.717523 | A | 8.01% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=10 V, VDS=3 V | 1.12 | 1.02555 | A | 8.43% | p. 3 Figure 1, TA=25 degC, digitized |
| output current at VGS=10 V, VDS=5 V | 1.48 | 1.52433 | A | 3.00% | p. 3 Figure 1, TA=25 degC, digitized |
| RDS(on) at VGS=10 V, ID=0.2 A | 2.5 | 2.61785 | ohm | 4.71% | p. 3 Figure 1, TA=25 degC, digitized slope |
| RDS(on) at VGS=5 V, ID=0.2 A | 6.75 | 5.73963 | ohm | 14.97% | p. 3 Figure 1, TA=25 degC, digitized slope |

## Validation

See `validation-results.json`. Every bench fixes `.temp 25`; `boundary.cir` checks the 500 mA, VGS=10 V edge and `off_state_boundary.cir` checks IDSS at 48 V.

## Known omissions

- Avalanche and unclamped inductive switching are not modelled; BV is an ordinary breakdown branch and does not fail.
- Safe operating area and power limits are metadata only.
- No self-heating in the default three-terminal instance; junction temperature is fixed by .temp.
- Package and lead inductance are not modelled.
- Threshold-voltage production spread is not modelled; VTO is a typical-curve fit inside the 0.8 V to 3.0 V guaranteed window.
- LAMBDA is held at 0.003 because the three-seed sweep showed it underdetermined by the nearly flat saturation curves.
- Gate-drain capacitance is constant because no capacitance-versus-VDS figure is published; Ciss, Coss, and Crss are maximum table rows, so AC and switching results are approximate.
- Body-diode forward voltage and reverse recovery are not fitted because the datasheet publishes neither VSD nor trr; IS, N, and TT remain defaults.
- Gate charge is not validated because the datasheet publishes no Qg row.
- Temperature coefficients are not fitted; only 25 degC curves were used.
- RTHCA is transcribed from RthetaJA, but electrothermal operation is not validated or claimed.
- Flicker noise is not modelled.

## Licence

MIT. See `LICENSE`.
