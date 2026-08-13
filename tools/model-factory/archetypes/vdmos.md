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

- A published threshold minimum and maximum are inclusive physical constraints. VTO may equal either endpoint but must not leave that interval.
- A published threshold typical is an observation and optimizer seed only. It is not a bound, guaranteed value, or permission to widen the published interval.
- Do not extrapolate VTO beyond a valid published threshold interval.
- Only when threshold evidence is absent may the factory use a declared curve-derived held default. Record its derivation, condition identity, and citation, mark it as a held default, and do not claim threshold-bound support.
- Fail closed when threshold evidence is incomplete, conditionally mismatched, or presented as independently combinable fragments.

## Canonical critical-evidence identity

Threshold, RDS(on), transfer, and output data must use shared canonical identities rather than independent free-form condition strings:

- Each datum carries `evidence_id`, `evidence_role`, `condition_id`, and `citation_id`.
- The referenced evidence identity carries the source kind and one role: inclusive lower constraint, inclusive upper constraint, typical observation, or declared held default.
- The referenced condition identity contains a typed temperature (`kind` and numeric quantity), all fixed biases, swept coordinates, and the measurement mode.
- Transfer evidence records the actual VDS. Do not substitute a bench voltage or infer VDS from a separate datum.
- The referenced citation identity contains the page reference plus a table-row or figure locator. Data may share one citation and condition identity only when they are observations from that same published row or curve.
- Critical quantities retain their legacy `conditions`, `page_reference`, and `source_kind` fields for existing consumers, but those strings are renderings of the referenced identities and are not independently combinable evidence.
- IDs are stable within the curated part: `<part>.condition.<name>`, `<part>.citation.<name>`, and `<part>.evidence.<name>`.

## Pulse and DC policy

- Record whether each critical condition is DC, pulse-limited, or transient. For pulse evidence, record the published maximum pulse width and maximum duty cycle when supplied by the datasheet.
- Pulse-limited RDS(on), transfer, or output evidence constrains the compact isothermal fit at its stated junction temperature. It does not establish continuous-current, thermal, or safe-operating-area support.
- Never relabel pulse evidence as DC or combine pulse and DC rows under one condition identity unless the datasheet explicitly establishes equivalence.
- A DC bench may check a pulse-derived static target only as an isothermal compact-model comparison. Its report must preserve the pulse qualifier and must not claim continuous-power validation.
