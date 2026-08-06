# BJT factory archetype

- Use a Gummel-Poon NPN or PNP dot model with node order collector, base, emitter.
- Derive zero-bias junction capacitances from the cited Cobo and Cibo rows.
- Seed parasitic resistances from two saturation points.
- Fit DC transport by running native ngspice once per SciPy residual evaluation. Do not use a Python transistor implementation.
- Use `least_squares` with `method="trf"`, `x_scale="jac"`, `diff_step=1e-4`, `ftol=1e-10`, `xtol=1e-10`, and `max_nfev=5000`.
- Compute TF from the published fT after the DC fit.
- Freeze VAF at 100 V for a small-signal part when no usable output-characteristics family exists, and disclose the omission.
- Require DC gain, saturation, output, fT, and capacitance benches.
