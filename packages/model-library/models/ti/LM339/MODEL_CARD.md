# LM339 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Quad differential comparator with open-collector outputs
- Electrical family: comparator
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm339.pdf
- Revision: SLCS006Z, October 1979, revised May 2025
- Accessed: 2026-08-07
- Referenced pages: p. 6 section 6.5 recommended operating conditions, p. 10 section 6.10 electrical characteristics, p. 12 section 6.14 switching characteristics
- SHA-256: `0dc304db92279f59bfe8dab42d5e0f277a41f0de7857d2b483f407fa98d32d0e`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| AOL | 2.00000000e+5 | fitted or derived |
| VOS | -2.00000000e-3 | fitted or derived |
| IBIAS | 2.50000000e-8 | fitted or derived |
| IOS | 5.00000000e-9 | fitted or derived |
| TPD | 1.27379690e-6 | fitted or derived |
| VHYST | 0.00000000e+0 | fitted or derived |
| IQ | 2.00000000e-4 | fitted or derived |
| VCLAMP | 1.00000000e+0 | held at default |
| KSW | 2.00000000e+1 | held at default |
| CD | 1.00000000e-11 | held at default |
| CDIF | 1.00000000e-12 | held at default |
| ROL | 3.75000000e+1 | fitted or derived |
| ROFF | 1.00000000e+9 | held at default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| VCLAMP | 1.00000000e+0 | V | held at default internal bounded-gain scale |
| KSW | 2.00000000e+1 | 1 | held at default smoothing sharpness |
| CD | 1.00000000e-11 | F | held at default internal delay scale |
| CDIF | 1.00000000e-12 | F | held at default floating-input convergence capacitance |
| ROFF | 1.00000000e+9 | ohm | held at default numerically safe off-state resistance |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| large-signal gain | 2.000000e+5 | 2.000000e+5 | V/V | 0.000% | p. 10 section 6.10 electrical characteristics |
| input offset magnitude | 2.000000e-3 | 2.000000e-3 | V | 0.000% | p. 10 section 6.10 electrical characteristics |
| input bias current | 2.500000e-8 | 2.500000e-8 | A | 0.000% | p. 10 section 6.10 electrical characteristics |
| input offset current | 5.000000e-9 | 5.000000e-9 | A | 0.000% | p. 10 section 6.10 electrical characteristics |
| supply current per comparator | 2.000000e-4 | 2.000000e-4 | A | 0.000% | p. 10 section 6.10 electrical characteristics |
| propagation delay average | 1.300000e-6 | 1.300005e-6 | s | 0.000% | p. 12 section 6.14 switching characteristics |
| low-level output voltage at specified sink current | 1.500000e-1 | 1.500000e-1 | V | 0.000% | p. 10 section 6.10 electrical characteristics |

Worst fitting error: 14.270% for propagation_delay_low_to_high.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 2.833e-14 and worst absolute delta was 1.417e-13.

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
