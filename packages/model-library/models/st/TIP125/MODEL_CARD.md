# TIP125 model card

## Identity

- Manufacturer: STMicroelectronics
- Electrical family: PNP Darlington power transistor
- Fidelity tier: F1 composite terminal behavior, F1 internal nodes
- Independent reviewer: pending-review

## Provenance

- Specification page: https://www.st.com/en/power-transistors/tip125.html
- Revision: DS0854 Rev. 5, May 2021; official ST product/specification page fallback
- Accessed: 2026-08-07
- Source SHA-256: `f1dceea0c76699f145f648a31dfec09125d60e071ca5166f5e3697b8b8381780`
- Vendor SPICE models used: none

## Composite structure

The shipped subcircuit contains two Gummel-Poon transistors, R1=16000 ohm, R2=60 ohm, and the internal freewheel diode in the datasheet topology. The driver transistor is scaled to one tenth the output current capability. Only composite C-B-E behavior is constrained.

## Validation

Pending factory validation. Benches cover composite gain, forced-current saturation, freewheel-diode connectivity, and a conservative SOA/voltage boundary.

## Known omissions

- Official ST PDF and HTML fetches timed out after browser-header retries; official ST specification content fallback is used and fidelity is capped at F1.
- Darlington modelled as two Gummel-Poon devices plus the datasheet internal bias resistors and freewheel diode. The two dies are not independently characterised; only composite terminal behaviour is constrained. Internal-node behaviour is F1.
- Guaranteed MIN/MAX rows are hard bounds, not typical fit targets.
- No self-heating, SOA failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`.
