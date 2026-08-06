# J113 model card

## Identity

- Manufacturer: onsemi
- Description: N-channel analog switch and chopper JFET
- Electrical family: jfet_n
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.cn/pub/Collateral/MMBFJ113-D.PDF
- Revision: Rev. 5, March 2023
- Accessed: 2026-08-07
- Referenced pages: p.1, p.2, p.3, p.4, p.5, p.6
- SHA-256: `2b60421ab965a832610f81bbde9be05b9c4fb4fd35fb16886655a336ad91ba49`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit

- Run: jfet-J113-20260807-01
- Solver: scipy.optimize.least_squares with native ngspice-46 in the loop, method trf, x_scale jac, diff_step 1e-4
- Worst fitted typical-point relative error: 3.572% (digitized transfer point at VGS=-1.0 V)
- Square-law consistency report: No table TYP values exist for IDSS, VGS(off), or gfs. The fit used only the J113 typical curves; the table MIN/MAX columns are hard bounds. The p.2 VGS(off) definition uses ID=1 mA, so it is not a zero-current threshold.

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -1.92750018e+00 | fitted |
| BETA | 5.49356049e-03 | fitted |
| LAMBDA | 7.49564544e-03 | fitted |
| B | 1.00000000e+00 | fitted |
| RD | 2.50000000e+01 | derived |
| RS | 2.50000000e+01 | derived |
| CGS | 1.00000000e-15 | held at default |
| CGD | 1.00000000e-15 | held at default |
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
- RD and RS are each derived as half of the approximately 50 ohm typical on-resistance digitized from p.4 fig.7; the tabulated 100 ohm maximum is retained only as a hard bound.
- CGS and CGD are held at the 1e-15 F numerical floor because the datasheet does not publish Ciss and Crss typical values. AC and switching capacitance behaviour is not modelled.
- PB and M are held at physical defaults but are not meaningful with capacitances at the numerical floor.
- F1: the table publishes a minimum IDSS and VGS(off) window but no typical IDSS, VGS(off), or gfs values. Typical curves drive the fit and guaranteed rows are hard bounds.

## Validation

Package schema validation passed. All 6 benches passed native ngspice/WASM comparison and all 10 datasheet checks passed. Worst engine relative delta: 1.339285e-14; worst absolute delta: 5.204170e-17. Detailed measured values are recorded in `validation-results.json`.

## Licence

MIT. See `LICENSE`.
