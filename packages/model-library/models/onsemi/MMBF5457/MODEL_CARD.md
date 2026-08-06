# MMBF5457 model card

## Identity

- Manufacturer: onsemi
- Description: N-channel general-purpose amplifier JFET
- Electrical family: jfet_n
- Fidelity tier: F2
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.cn/pdf/datasheet/mmbf5457-d.pdf
- Revision: Rev. 1, January 2023
- Accessed: 2026-08-07
- Referenced pages: p.1, p.2, p.3, p.4
- SHA-256: `f1f2e1ce3d56dce28ce664c1f2a1f8da149d5321ccbe92eda8cd609e46964713`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit

- Run: jfet-MMBF5457-20260807-01
- Solver: scipy.optimize.least_squares with native ngspice-46 in the loop, method trf, x_scale jac, diff_step 1e-4
- Worst fitted typical-point relative error: 0.034% (digitized transfer point at VGS=-0.5 V)
- Square-law consistency report: The tabulated VGS(off) and gfs rows publish only limits, not typical values. Fitting therefore used the p.3 figure 1 25 C typical curve plus the tabulated 3.0 mA IDSS and 10 uS gos typical values; guaranteed limits were used only as hard bounds.

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -1.79750116e+00 | fitted |
| BETA | 8.97921547e-04 | fitted |
| LAMBDA | 3.50819654e-03 | fitted |
| B | 9.51090850e-01 | fitted |
| RD | 1.00000000e-04 | held at default |
| RS | 1.00000000e-04 | held at default |
| CGS | 3.00000000e-12 | derived |
| CGD | 6.00000000e-12 | derived |
| PB | 1.00000000e+00 | held at default |
| M | 5.00000000e-01 | held at default |
| IS | 1.00000000e-20 | derived |
| N | 1.00000000e+00 | held at default |
| FC | 5.00000000e-01 | held at default |
| TNOM | 2.70000000e+01 | held at default |

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- IDSS and VGS(off) bin spread is not modelled. The fit targets one bin's published typical curve; a real part may sit anywhere inside the published limits.
- Gate leakage is set from the tabulated IGSS maximum, not fitted.
- Flicker and thermal noise are not modelled: KF and AF are held at default. Published single-frequency noise data cannot determine a noise corner.
- Temperature coefficients VTOTC, BETATCE, and XTI are held at default; only 25 C data was fitted.
- Gate-junction forward conduction is a simple diode with IS set from IGSS; forward gate drive is not characterised.
- Package parasitics are not modelled.
- Breakdown V(BR)GSS is not modelled; the model does not break down.
- N is held at default 1.0, FC at default 0.5, PB at default 1.0 V, and M at default 0.5.
- Channel series resistance is not fitted: RD and RS are held at the 1e-4 ohm numerical floor because no rDS(on) row is published.
- CGS and CGD are derived from single tabulated Ciss and Crss points with PB and M held at physical defaults.

## Validation

Package schema validation passed. All 6 benches passed native ngspice/WASM comparison and all 12 datasheet checks passed. Worst engine relative delta: 1.878299e-08; worst absolute delta: 2.910383e-11. Detailed measured values are recorded in `validation-results.json`.

## Licence

MIT. See `LICENSE`.
