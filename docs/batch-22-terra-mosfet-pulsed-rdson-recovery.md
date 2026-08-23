# Batch 22 pulse-tested RDS(on) recovery

Date: 2026-08-23.

## Trigger

The first schema-valid evidence-envelope probe, frozen order 1019 / C23708 / IRF640NSTRLPBF, translated deterministically into the strict MOSFET extraction contract. Its immutable extraction contains a genuine two-sided threshold interval and a cited RDS(on) maximum at VGS = 10 V, ID = 11 A, TJ = 25 °C. The datasheet states a 400 µs maximum pulse width and 2% maximum duty cycle for that RDS(on) measurement.

The pure factory validator rejected the scalar table value as pulsed evidence. This exposed an implementation rule broader than `docs/scale-2k-terra-recovery-authorization.md`, which excludes pulsed and single-pulse **curves** from static F2 fitting but does not exclude pulse-tested scalar RDS(on) table evidence.

## Narrow correction

The model factory may admit a typed, cited scalar RDS(on) typical or maximum whose source mode is `pulsed` or `single_pulse` when the existing typed-mode validator has accepted its pulse metadata. It treats the datum only as an instantaneous/quasi-static RDS(on) snapshot at the stated gate bias, drain current, temperature, pulse width, and duty cycle.

The correction must:

- preserve the exact pulsed or single-pulse source mode and timing in the condition identity;
- add `calibration_interpretation = quasi_static_rds_snapshot` to that identity;
- retain all existing locator, temperature, electrical, magnitude, cross-field, and source-text contradiction gates; and
- keep pulsed threshold evidence and every pulsed or single-pulse curve excluded from static fitting.

No evidence value, calibration bound, fitting threshold, batch denominator, strong-evidence definition, fit count, promotion gate, or release gate changes. The immutable order-1019 envelope and extraction must be revalidated without another model call after focused tests and independent review pass.
