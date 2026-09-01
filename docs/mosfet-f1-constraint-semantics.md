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

## Typed semantic adjudication

A content-addressed adjudication supplement may provide typed condition semantics without changing the original extraction. The bulk manifest references it with `adjudication_supplement_path`. The adapter hashes the exact original extraction bytes, the canonical datasheet source, every targeted extraction subtree, and the supplement itself before attaching a separate in-memory fit view. The original extraction remains unchanged and is the version retained in package facts.

Each supplement entry binds one condition cohort to independent JSON Pointer targets and contains:

- `characteristic`: `gate_threshold`, `rds_on`, `transfer_current`, or `output_current`
- `condition.polarity`: `n` or `p`
- `condition.magnitude_convention`: `signed` or `absolute`
- typed temperature, electrical coordinates, and source test mode
- free-text `disclosures`

The supplement cannot duplicate the evidence scalar value, evidence unit, citation, digitized points, or any identity hash. Those remain authoritative in the immutable extraction. Typed temperature and electrical coordinates must equal the conditions already present in that extraction. The adapter parses the exact hashed extraction bytes and requires their canonical content to equal the supplied extraction object before it validates any target or creates a fit view. Any extraction-byte, object-content, target-subtree, datasheet-source, or supplement hash mismatch fails before fitting. After validation, the adapter creates a separate recursively frozen snapshot of the original extraction for package facts, then freezes the complete semantic fit view before it receives trusted status. Evidence values, conditions, citations, curve points, typed semantics, and the retained facts extraction therefore cannot change between hash verification, fitting, and staging. Staging rejects any separately supplied source extraction that differs from the validated snapshot.

### Temperature

Typed temperature uses either:

- `status: stated`, with `kind`, finite `value_c`, and one provenance from `inline_condition`, `table_heading`, `figure_label`, `footnote`, or `section_scope`
- `status: not_stated`

`not_stated` temperature always fails before seed creation, optimization, native probing, or package staging. No nominal temperature is fabricated. Legacy signed positive forms such as `TJ = +25 degC` and `TA = +25 °C` parse as exactly 25 degrees Celsius.

### Source test mode

Typed source test mode is one of `dc`, `continuous`, `pulsed`, `single_pulse`, or `not_stated`.

- `pulsed` and `single_pulse` evidence cannot enter a static DC observation, residual, constraint, expectation, or bench.
- `not_stated` is admitted only from a validated content-addressed supplement.
- The fixed `not_stated` policy covers gate-threshold rows and transfer or output curves. It does not cover RDS(on), because its high-current table conditions can depend materially on pulse qualification.
- An admitted `not_stated` source mode is preserved as the canonical qualifier `source_test_mode: not_stated`, together with its exact `static_characteristic_policy`. The canonical bench mode remains `dc`, so existing package and bench schemas are not weakened or reinterpreted.
- Python independently verifies the content-addressed-adjudication marker, source mode, temperature provenance, and fixed characteristic policy.

### Magnitude and disclosures

The typed magnitude convention is authoritative. P-channel quantities recorded as magnitudes do not depend on matching a preferred prose phrase. A signed source value paired with `absolute` fails as contradictory.

Disclosures are preserved verbatim inside the hashed supplement, but they are never phrase-matched, whitelisted, tokenized into condition qualifiers, or used to select electrical semantics. Changing disclosure prose without changing typed facts cannot change condition identity or any fit gate outcome.

### Compatibility

Existing extractions without a supplement continue through the legacy parser. Their explicit DC, continuous, and pulse identities and all existing condition, citation, cohort, curve, and evidence hashes remain unchanged. F2 worst and RMS gates, inclusive bounds, collision checks, package validation, reviewed-library admission, and the complete two-sided threshold requirement are unchanged.
