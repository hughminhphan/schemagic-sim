# TL084 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Quad JFET-input operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tl084.pdf
- Revision: SLOS081O, February 1977, revised September 2025
- Accessed: 2026-08-09
- Referenced pages: p. 14, p. 16, p. 8
- SHA-256: `c162e1f4da0f1f4d7cc258c43c385b8bc4fedaf4e70b549ebde80e48c79020f5`
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
| AOL | 2.00000000e+5 | direct typical transcription |
| GBW | 7.84659122e+6 | native calibrated |
| SR | 2.19894405e+7 | native calibrated |
| IBIAS | 6.50000000e-11 | direct typical transcription |
| IOS | 5.00000000e-12 | direct typical transcription |
| VOS | 3.00000000e-3 | direct typical transcription |
| ROUT | 1.25000000e+2 | direct typical transcription |
| ILIM | 4.00000000e-2 | direct digitized typical transcription |
| VDRP_H | 1.33118593e+0 | native fitted to 25 degC typical output swing |
| VDRP_L | 1.33118591e+0 | native fitted to 25 degC typical output swing |
| FP2 | 5.49424232e+6 | derived from phase margin and calibrated GBW |
| CMRR | 1.00000000e+5 | derived from direct typical dB value |
| PSRR | 1.00000000e+5 | derived from direct typical dB value |
| VSUP_NOM | 3.00000000e+1 | derived from datasheet test supply |
| IQ | 1.40000000e-3 | direct typical transcription |
| EN | 3.70000000e-8 | direct typical transcription |

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
| open-loop gain | 2.000000e+5 | 1.882362e+5 | V/V | 5.882% | p. 14 open-loop gain TYP |
| unity-gain bandwidth | 5.250000e+6 | 5.250000e+6 | Hz | 0.000% | p. 16 AC characteristics |
| slew rate | 2.000000e+7 | 2.000000e+7 | V/s | 0.000% | p. 16 slew-rate TYP |
| positive output swing | 1.350000e+1 | 1.350000e+1 | V | 0.000% | p. 14 output swing TYP |
| negative output swing | -1.350000e+1 | -1.350000e+1 | V | 0.000% | p. 14 output swing TYP |

Worst fitting error: 5.882% for open-loop gain.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 9.102e-12 and worst absolute delta was 3.219e-8.

## Known omissions

- The source values are principally TYP and guaranteed table rows rather than complete digitized transfer families, so fidelity is capped at F1.
- The package is represented as one reusable amplifier unit; inter-channel crosstalk, shared-supply interactions, unused channels, compensation/offset-null pins, and package parasitics are not modelled.
- PSRR and CMRR are frequency-independent; distortion, overload recovery, common-mode failure, protection behavior, current-noise density, flicker noise, self-heating, temperature coefficients, and production spread are omitted.
- The two-pole frequency response and slew limiter are compact approximations. Internal compensation capacitors and numerical resistors are held archetype defaults.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
