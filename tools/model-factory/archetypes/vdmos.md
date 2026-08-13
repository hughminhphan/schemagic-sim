# VDMOS factory archetype

- Use native ngspice VDMOS with node order drain, gate, source. Never use a lateral level 1, 2, or 3 MOS model.
- Map terminal capacitances as Cgd = Crss, Cgs = Ciss - Crss, and Cds = Coss - Crss.
- Fit A against the cited Crss versus VDS curve through native ngspice.
- Split the strongest RDS(on) row with RS = 0.20 times RDS(on) and RD seed = 0.55 times RDS(on).
- Fit VTO, KP, THETA, LAMBDA, and tightly bounded RD through native ngspice in every residual evaluation.
- Use `least_squares` with `method="trf"`, `x_scale="jac"`, `diff_step=1e-4`, `ftol=1e-10`, `xtol=1e-10`, and `max_nfev=5000`.
- Keep VTO inside the published threshold minimum and maximum.
- Require RDS(on), transfer, output, gate-charge, capacitance, and body-diode benches.
- Reject parameters not in the verified ngspice-46 VDMOS parameter list.
