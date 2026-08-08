# LM393 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual differential comparator with open-collector outputs
- Electrical family: comparator
- Fidelity tier: F2
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm393.pdf
- Revision: SLCS005AH, October 1979, revised April 2025
- Accessed: 2026-08-07
- Referenced pages: p. 4 recommended operating conditions, p. 8 section 5.8 electrical characteristics, p. 10 section 5.11 switching characteristics
- SHA-256: `ae2b7355313f1e7ddf07b2c3db74610069f4f66556963bec02a5689dbcb56f88`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit

Direct transcription at 25 degC plus exactly three native ngspice-46 fixed-point calibration iterations for propagation delay. Worst individual fitted expectation error is 14.784% (propagation_delay_low_to_high).

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Validation

Package validation passed. Native ngspice-46 and WASM agreed on all 5 benches. 13/13 datasheet-anchored checks passed. Worst native-WASM relative delta was 4.574e-14; worst absolute delta was 2.287e-13. Reviewer remains pending-review.

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
- No input hysteresis: the datasheet specifies none. This model will chatter on a slow or noisy input where a real part's small unspecified hysteresis might not.
- Open-collector output: this model can only sink. A circuit without an external pull-up will float the output node.
- Output leakage in the off state is fixed at a numerically safe 1e9 ohm rather than the datasheet leakage maximum.
- ROFF = 1e9 ohm is held at default for numerical safety.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
