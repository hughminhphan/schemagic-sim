# LM311 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Single high-speed differential comparator with open-collector output
- Electrical family: comparator
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm311.pdf
- Revision: SLCS007K, September 1973, revised March 2017
- Accessed: 2026-08-07
- Referenced pages: p. 4 section 6.3 recommended operating conditions, p. 6 section 6.6 electrical characteristics, p. 6 section 6.7 switching characteristics
- SHA-256: `fb1e379c722be5d257cec506573863aca3882191307cc151f4257979568e8a32`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit

Direct transcription at 25 degC plus exactly three native ngspice-46 fixed-point calibration iterations for propagation delay. Worst individual fitted expectation error is 33.056% (propagation_delay_low_to_high).

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

Package validation passed. Native ngspice-46 and WASM agreed on all 5 benches. 13/13 datasheet-anchored checks passed. Worst native-WASM relative delta was 3.206e-14; worst absolute delta was 1.603e-13. Reviewer remains pending-review.

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
- The LM311 balance, strobe and separate emitter-ground pins are not modelled. Only the five-terminal core (INP, INN, OUT, VCC, GND) is provided; strobe and offset balancing are unavailable.
- Fitted from a single-supply representation of the published split-supply table. Split-supply operation is untested.
- The five-terminal core accounts only for the published positive-supply quiescent current; negative-supply current is omitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
