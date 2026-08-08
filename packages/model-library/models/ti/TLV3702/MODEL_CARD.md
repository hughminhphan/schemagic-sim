# TLV3702 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual nanopower comparator with push-pull outputs
- Electrical family: comparator
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tlv3702.pdf
- Revision: SLCS137E, November 2000, revised December 2025
- Accessed: 2026-08-07
- Referenced pages: p. 6 section 6.3 recommended operating conditions, p. 8 section 6.7 electrical characteristics, p. 9 section 6.8 switching characteristics
- SHA-256: `8a57a72ecaa061d8818c56b6a0c0164759e71d131c62ab09b5f5629c96086a2f`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit

Direct transcription at 25 degC plus exactly three native ngspice-46 fixed-point calibration iterations for propagation delay. Worst individual fitted expectation error is 13.144% (input_hysteresis_window).

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Validation

Package validation passed. Native ngspice-46 and WASM agreed on all 6 benches. 14/14 datasheet-anchored checks passed. Worst native-WASM relative delta was 7.871e-14; worst absolute delta was 3.872e-13. Reviewer remains pending-review.

## Known omissions

- Propagation delay is a single fitted constant taken at the largest published overdrive. The strong overdrive dependence that real comparators show is not modelled.
- Input common-mode range is not enforced. The model does not phase-invert or lose gain when an input approaches a supply rail. VICR is metadata only.
- No self-heating and no temperature coefficients: offset drift and delay drift are not modelled.
- Quiescent current is a constant and does not vary with supply, temperature, or output state.
- Input protection diodes and ESD structures are not modelled.
- Noise is not modelled, so the model will not reproduce output chatter caused by input noise near the trip point.
- Input offset voltage is set to the datasheet typical; a real part may sit anywhere inside the published maximum and the sign is arbitrary.
- VCLAMP = 1 V is held at default as the internal bounded-gain scale.
- KSW = 20 is held at default as the smoothing sharpness.
- CD = 10 pF and CDIF = 1 pF are held at default as internal scale and convergence values.
- RQ = 1 Mohm is held at default as the push-pull internal-node convergence resistance.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
