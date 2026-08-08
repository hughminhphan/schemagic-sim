# LM386 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Low-voltage audio power amplifier
- Electrical family: other
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm386.pdf
- Revision: SNAS545D, May 2004, revised August 2023
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 3, p. 4, p. 5, p. 6, p. 10
- SHA-256: `4fb8c1973f5a087b94493589b9154e0109f4f6edb1454d28c5a49c289df7b3d0`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| GAIN_OPEN | 1.98791835e+1 | native fitted to manually digitized Figure 6-4 typical curve |
| BW | 3.00325456e+5 | native fitted to manually digitized Figure 6-4 typical curve |
| VDROP | 9.14803295e-1 | native fitted to manually digitized Figure 6-3 typical curve |
| ILIM | 5.17094210e-1 | native fitted to manually digitized Figure 6-3 typical curve |
| ROUT | 5.00000000e-1 | held compact output-stage default |
| IQ | 4.00000000e-3 | direct typical transcription |
| IBIAS | 2.50000000e-7 | direct typical transcription |
| RIN | 5.00000000e+4 | direct typical transcription |
| RBYP | 1.50000000e+4 | derived from the published internal schematic |
| RGAIN | 1.50000000e+3 | derived from the published 150 ohm plus 1.35 kohm gain path |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| ROUT | 5.00000000e-1 | ohm | held compact output-stage stabilization resistance |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| closed-loop gain at 1000 Hz | 2.000000e+1 | 1.987808e+1 | V/V | 0.610% | p. 6 fig. 6-4 |
| closed-loop gain at 10000 Hz | 2.000000e+1 | 1.986718e+1 | V/V | 0.664% | p. 6 fig. 6-4 |
| closed-loop gain at 100000 Hz | 1.850000e+1 | 1.885987e+1 | V/V | 1.945% | p. 6 fig. 6-4 |
| closed-loop gain at 300000 Hz | 1.420000e+1 | 1.406352e+1 | V/V | 0.961% | p. 6 fig. 6-4 |
| closed-loop gain at 1000000 Hz | 5.700000e+0 | 5.718099e+0 | V/V | 0.318% | p. 6 fig. 6-4 |
| 8 ohm output swing at 4 V supply | 2.000000e+0 | 2.040198e+0 | Vpp | 2.010% | p. 6 fig. 6-3 |
| 8 ohm output swing at 6 V supply | 4.100000e+0 | 3.905294e+0 | Vpp | 4.749% | p. 6 fig. 6-3 |
| 8 ohm output swing at 8 V supply | 5.800000e+0 | 5.729440e+0 | Vpp | 1.217% | p. 6 fig. 6-3 |
| 8 ohm output swing at 10 V supply | 7.200000e+0 | 7.418177e+0 | Vpp | 3.030% | p. 6 fig. 6-3 |
| 8 ohm output swing at 12 V supply | 8.300000e+0 | 8.263161e+0 | Vpp | 0.444% | p. 6 fig. 6-3 |

Worst fitting error: 4.749% for 8 ohm output swing at 6 V supply.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.344e-9 and worst absolute delta was 2.487e-14.

## Known omissions

- GAIN_CL is an explicit subcircuit parameter. Pins 1 and 8 retain the published 1.5-kohm internal path, but the model does not infer gain from an externally connected capacitor or resistor; callers select gain explicitly from 20 to 200.
- The manually digitized Figure 6-3 and Figure 6-4 typical curves establish F2 only for closed-loop gain, bandwidth, output swing, and current limiting at 25 degC. Guaranteed output-power rows remain separately typed and are not treated as typical fit targets.
- The bypass pin is a first-order divider node. PSRR versus bypass capacitance, distortion, crossover behavior, clipping harmonics, speaker back-EMF, thermal limiting, short-circuit heating, package parasitics, noise, temperature behavior, and production spread are omitted.
- The output stage is a smooth compact current limiter with one dominant pole; it is not a transistor-level reproduction. Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
