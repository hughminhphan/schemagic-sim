# VDMOS factory archetype

## Native model and fit

- Use native ngspice VDMOS with node order drain, gate, source. Never use a lateral level 1, 2, or 3 MOS model.
- Map terminal capacitances as Cgd = Crss, Cgs = Ciss - Crss, and Cds = Coss - Crss.
- Fit A against the cited Crss versus VDS curve through native ngspice.
- Split the strongest RDS(on) row with RS = 0.20 times RDS(on) and RD seed = 0.55 times RDS(on).
- Fit VTO, KP, THETA, LAMBDA, and tightly bounded RD through native ngspice in every residual evaluation.
- Use `least_squares` with `method="trf"`, `x_scale="jac"`, `diff_step=1e-4`, `ftol=1e-10`, `xtol=1e-10`, and `max_nfev=5000`.
- Require RDS(on), transfer, output, gate-charge, capacitance, and body-diode benches.
- Reject parameters not in the verified ngspice-46 VDMOS parameter list.

## Threshold policy

- Published threshold minimum and maximum values are inclusive physical constraints. VTO may equal either endpoint but must not leave the valid published interval.
- A published threshold typical is an observation and seed only. It is not a bound and does not widen the minimum-to-maximum interval.
- Do not extrapolate VTO beyond valid published threshold bounds.
- Only when threshold evidence is absent may a declared curve-derived held default be used. Record its derivation and full identity, and do not claim threshold-bound support.
- Omit an unpublished optional threshold `typical` key. Never encode it as null or manufacture a typical value.
- Incomplete, mismatched, or independently combinable threshold fragments fail closed.

## Evidence contract 1.0.0

- Curated VDMOS facts declare `evidence_contract_version: "1.0.0"`.
- Threshold is one bundle containing its published `minimum`, optional `typical`, and `maximum` QuantityDatum fields.
- RDS(on) remains an array of point bundles containing resistance, VGS, and current QuantityDatum fields.
- Transfer and output evidence use `transfer_curves` and `output_curves`. Each canonical curve contains one full in-band identity and its points. Flat `transfer_points` and `output_points` are not canonical evidence.
- Every critical QuantityDatum carries its own complete identity object. Identity data is not stored in a separate catalog and one datum cannot borrow a condition or citation from another.
- A complete identity contains typed temperature, VGS, ID, a VDS relationship or explicit actual VDS, normalized qualifier tokens, primary page plus table or figure locator, and evidence role.
- Transfer curves record their actual cited VDS. Output curves identify the fixed VGS cohort and sweep VDS and ID.
- Keep legacy QuantityDatum condition strings and page references for existing rendering, but the in-band identity is authoritative.

## Pulse and DC policy

- Determine pulse and DC qualifiers separately from the exact table row, footnote, or figure caption for each datum or curve cohort.
- Never propagate a table footnote to threshold or curves unless the datasheet explicitly marks that evidence.
- Record pulse width and duty cycle only when the cited evidence publishes them. Do not invent a missing duty-cycle limit.
- Pulse evidence constrains an isothermal compact fit at the cited temperature. It does not prove continuous-current, thermal, safe-operating-area, or failure support.
- A DC bench may compare against a pulse-derived static target only while preserving the pulse qualifier and without claiming continuous-power validation.
