# TIP31C model card

## Identity

- Manufacturer: STMicroelectronics
- Electrical family: NPN power BJT
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Specification page: https://www.st.com/en/power-transistors/tip31c.html
- Revision: Rev. 1, April 2006; official ST product/specification page fallback
- Accessed: 2026-08-07
- Source SHA-256: `ccda9c837d4997baf57faa7ced2a159567a35d0950053e48d20ff0eeadaf81de`
- Vendor SPICE models used: none

## Fit and semantics

The model preserves the published hFE minima, VCE(sat) maximum, and VBE(on) maximum as hard bounds at 25 degC. It does not present any MIN or MAX value as a typical target. Parameters without accessible typical curve anchors are disclosed held defaults.

## Validation

Pending factory validation. Benches cover DC gain, forced-current saturation, and a conservative power-device voltage/SOA boundary.

## Known omissions

- Official ST PDF and HTML fetches timed out after browser-header retries; official ST specification content fallback is used and fidelity is capped at F1.
- Guaranteed MIN/MAX rows are hard bounds, not typical fit targets.
- VAF, capacitances, transit times, reverse operation, temperature coefficients, package parasitics, noise, self-heating, safe-operating-area failure, thermal runaway, and breakdown are not fitted.
- Absolute maximum ratings are metadata only and are not enforced by the model.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`.
