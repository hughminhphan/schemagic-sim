# MOSFET F1 constraint semantics

This phase adds a constrained F1 calibration path without changing the meaning of F1 or F2.

## Evidence roles

Every evidence-derived MOSFET result records one mode in `fitted.json`:

- `typ-point`: the existing threshold-typical and RDS(on)-typical parameter path. Its numerical formulas are unchanged.
- `interval-constrained`: at least one critical typical value is absent, so native ngspice feasibility constraints are used.
- `curve-fitted`: the existing F2 transfer and output curve path.

`calibration.observations`, `calibration.constraints`, and `calibration.seeds` are separate collections. A threshold interval midpoint or RDS(on) maximum may appear in `seeds` with a seed-only role. It does not appear in `observations` or `residuals`.

## Constraint rules

- Published VGS(th) minimum and maximum values form one inclusive two-sided constraint at the cited ID, VDS relationship, and temperature.
- A missing threshold endpoint, equal endpoints, reversed endpoints, mismatched currents, or an unsupported VDS condition fails before optimization.
- Each published RDS(on) maximum is an independent inclusive one-sided constraint at its cited VGS, ID, and temperature.
- Bounds are not equality observations. The constrained F1 optimizer has no bound residual-target vector.
- Native probes emit exactly one `.temp` directive for the cited temperature.
- A model is accepted only after native ngspice verifies every inclusive constraint.

## Feasibility projection

The constrained path starts from explicit VTO and resistance seeds. Typical values are preferred as seeds. If a typical value is absent, the threshold interval midpoint or RDS(on) maximum may be used as a recorded seed-only value.

The native helper maps each threshold interval into a feasible VTO interval and each RDS(on) maximum into a feasible resistance-seed interval. It chooses the point nearest the explicit seeds, then probes the final model again. This is feasibility projection, not least-squares fitting to bounds.

## Stop rules

The phase stops for the affected part when any of these conditions occurs:

- Critical threshold or RDS(on) evidence is silently defaulted from catalog hints.
- The threshold interval is incomplete, degenerate, reversed, or condition-incompatible.
- Required units, currents, biases, citations, or temperatures cannot be mapped.
- The feasible intersection is empty.
- Native verification fails an inclusive bound.
- Preserving an unchanged typical-point parameter vector conflicts with its published constraints.
- A digitized MOSFET F2 curve lacks validated axes, units, temperature, page and figure or curve identity, transfer bias or explicit saturation range, or monotonicity.

No constraint may be relaxed to continue a phase. No new fidelity tier is introduced. F2 worst and RMS gates remain 0.20 and 0.12. Candidate processing remains blocked until independent code review approves this implementation.

## Canonical condition identity

Every critical MOSFET threshold or RDS(on) datum used by F1 or F2 must resolve to one complete condition identity before it can affect a seed, bound, observation, residual, constraint, expectation, region, or bench.

A complete identity contains:

- exact temperature in degrees Celsius
- VGS
- ID
- VDS relationship, either `VDS = VGS` or an explicit cited VDS
- normalized qualifier tokens, including pulse width, duty cycle, and test mode
- primary datasheet page and table or figure citation
- evidence role, such as typical observation, inclusive minimum or maximum, or curve point

Each field in a threshold or RDS(on) group must independently resolve to the same identity. One field cannot lend its current, voltage, temperature, citation, or qualifier to another. Unknown residual qualifiers, unmatched pulse conditions, incompatible citation context, or missing critical conditions fail the affected part closed.

Validated threshold values may shape F2 VTO seeds and bounds. Unvalidated threshold values must not influence optimization. Validated RDS(on) typical values may enter F2 residual observations. Validated maxima may enter inclusive constraints. Every emitted row carries its real citation and condition identity.

Critical current, voltage, temperature, condition, and citation defaults are prohibited in conveyor candidate paths. A genuinely non-critical physical constant may remain only when recorded explicitly as a `held_default` in fitted metadata. The Python fit boundary independently rejects incomplete critical evidence even when upstream JavaScript validation regresses.
