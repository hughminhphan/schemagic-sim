# NE5534 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Low-noise high-speed single operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/ne5534.pdf
- Revision: SLOS070D, July 1979, revised November 2014
- Accessed: 2026-08-09
- Referenced pages: p. 5, p. 6, p. 4
- SHA-256: `d2fe815209929acde99a5a156e0b96efd383dd8b56590a80822166cbb9d641fd`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | approx |
| noise | approx |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| AOL | 1.00000000e+5 | direct typical transcription |
| GBW | 1.53171319e+7 | native calibrated |
| SR | 1.34397132e+7 | native calibrated |
| IBIAS | 5.00000000e-7 | direct typical transcription |
| IOS | 2.00000000e-8 | direct typical transcription |
| VOS | 5.00000000e-4 | direct typical transcription |
| ROUT | 3.00000000e-1 | direct typical transcription |
| ILIM | 3.80000000e-2 | direct digitized typical transcription |
| VDRP_H | 1.99961007e+0 | native fitted to 25 degC typical output swing |
| VDRP_L | 1.99960978e+0 | native fitted to 25 degC typical output swing |
| FP2 | 8.84335020e+6 | derived from phase margin and calibrated GBW |
| CMRR | 1.00000000e+5 | derived from direct typical dB value |
| PSRR | 1.00000000e+5 | derived from direct typical dB value |
| VSUP_NOM | 3.00000000e+1 | derived from datasheet test supply |
| IQ | 4.00000000e-3 | direct typical transcription |
| EN | 4.00000000e-9 | direct typical transcription |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+6 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+6 | ohm | held at default clamp-node DC path |
| noise_reference_temperature | 3.00150000e+2 | K | held at default archetype noise normalization |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 1.000000e+5 | 9.998550e+4 | V/V | 0.014% | p. 5 open-loop gain TYP |
| unity-gain bandwidth | 1.000000e+7 | 9.999997e+6 | Hz | 0.000% | p. 6 AC characteristics |
| slew rate | 1.300000e+7 | 1.300000e+7 | V/s | 0.000% | p. 6 slew-rate TYP |
| positive output swing | 1.300000e+1 | 1.300000e+1 | V | 0.000% | p. 5 output swing TYP |
| negative output swing | -1.300000e+1 | -1.300000e+1 | V | 0.000% | p. 5 output swing TYP |

Worst fitting error: 0.014% for open-loop gain.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 1.812e-11 and worst absolute delta was 3.383e-10.

## Known omissions

- The source values are principally TYP and guaranteed table rows rather than complete digitized transfer families, so fidelity is capped at F1.
- The package is represented as one reusable amplifier unit; inter-channel crosstalk, shared-supply interactions, unused channels, compensation/offset-null pins, and package parasitics are not modelled.
- PSRR and CMRR are frequency-independent; distortion, overload recovery, common-mode failure, protection behavior, current-noise density, flicker noise, self-heating, temperature coefficients, and production spread are omitted.
- The two-pole frequency response and slew limiter are compact approximations. Internal compensation capacitors and numerical resistors are held archetype defaults.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
