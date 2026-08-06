# MMBFJ201 model card

## Identity

- Manufacturer: onsemi
- Description: N-channel low-current general-purpose amplifier JFET
- Electrical family: jfet_n
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.cn/pdf/datasheet/mmbfj202-d.pdf
- Revision: Rev. 5, April 2026
- Accessed: 2026-08-07
- Referenced pages: p.1, p.2, p.3, p.4, p.5
- SHA-256: `916d0d56d726a90ee55e5ae8cbdc7b774c529e2e2b4281c52f85c471985f6596`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit

- Run: jfet-MMBFJ201-20260807-01
- Solver: scipy.optimize.least_squares with native ngspice-46 in the loop, method trf, x_scale jac, diff_step 1e-4
- Worst fitted typical-point relative error: 18.215% (digitized transfer point at VGS=-0.4 V)
- Square-law consistency report: No table TYP values exist for IDSS, VGS(off), or yFS. The fit used only p.3 typical curves; the MIN/MAX table columns were retained solely as hard bounds.

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -8.06773330e-01 | fitted |
| BETA | 5.41196598e-04 | fitted |
| LAMBDA | 1.84978342e-02 | fitted |
| B | 1.00000000e+00 | held at default |
| RD | 1.00000000e-04 | held at default |
| RS | 1.00000000e-04 | held at default |
| CGS | 4.25000000e-12 | derived |
| CGD | 2.52041663e-12 | derived |
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
- CGS and CGD are derived from single digitized Ciss and Coss curve points with PB and M held at physical defaults; capacitance versus bias is approximate.
- B is held at 1.0 (pure square law): releasing it did not produce an identifiable improvement at F1.
- F1: the electrical table publishes only IDSS and VGS(off) windows and a minimum yFS, so guaranteed limits are hard bounds rather than typical fit targets.

## Validation

Package schema validation passed. All 6 benches passed native ngspice/WASM comparison and all 11 datasheet checks passed. Worst engine relative delta: 1.066192e-07; worst absolute delta: 2.910383e-11. Detailed measured values are recorded in `validation-results.json`.

## Licence

MIT. See `LICENSE`.
