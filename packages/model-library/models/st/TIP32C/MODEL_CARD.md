# TIP32C model card

## Identity

- Manufacturer: STMicroelectronics
- Electrical family: PNP power BJT
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Specification page: https://www.st.com/en/power-transistors/tip32c.html
- Revision: Rev. 2, November 2006; official ST product/specification page fallback
- Accessed: 2026-08-07
- Source SHA-256: `060d203599e4d254b9f5d6b77f7b0447ad5d81bc87d865b282f7c6b57d694ea4`
- Vendor SPICE models used: none

## Fit and semantics

The model preserves the published hFE minima, VCE(sat) maximum, and VBE(on) maximum as hard bounds at 25 degC. It does not present any MIN or MAX value as a typical target. Parameters without accessible typical curve anchors are disclosed held defaults.

## Validation

Factory validation passed: 3 benches, 6 of 6 checks, native/WASM agreement green. Worst engine relative delta: 1.423e-12. No typical fit error is claimed because accessible electrical rows are guaranteed bounds.

## Known omissions

- Official ST PDF and HTML fetches timed out after browser-header retries; official ST specification content fallback is used and fidelity is capped at F1.
- Guaranteed MIN/MAX rows are hard bounds, not typical fit targets.
- VAF, capacitances, transit times, reverse operation, temperature coefficients, package parasitics, noise, self-heating, safe-operating-area failure, thermal runaway, and breakdown are not fitted.
- Absolute maximum ratings are metadata only and are not enforced by the model.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`.
