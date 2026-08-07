# NE5532 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual low-noise high-performance operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-fitted
- Target tier: F2
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/ne5532.pdf
- Revision: SLOS075K, November 1979, revised December 2025
- Accessed: 2026-08-07
- Referenced pages: p. 3, p. 4, p. 5
- SHA-256: `a2f5071accc57bba5d1bdc7ba7833e50ddc2610f76350666b9068d88dc43d264`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | approx |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| AOL | 1.00000000e+05 | direct typical transcription |
| GBW | 1.32400337e+07 | native calibrated |
| SR | 5.29590065e+06 | native calibrated |
| IBIAS | 2.00000000e-07 | direct typical transcription |
| IOS | 1.00000000e-08 | direct typical transcription |
| VOS | 5.00000000e-04 | direct typical transcription |
| ROUT | 5.00000000e+01 | direct typical transcription |
| ILIM | 3.80000000e-02 | direct typical transcription |
| VDRP_H | 2.00000000e+00 | held at default |
| VDRP_L | 2.00000000e+00 | held at default |
| CMRR | 1.00000000e+05 | direct typical transcription |
| PSRR | 1.00000000e+05 | direct typical transcription |
| VSUP_NOM | 3.00000000e+01 | derived from datasheet test supply |
| IQ | 3.00000000e-03 | direct typical transcription |
| EN | 5.00000000e-09 | direct typical transcription |
| FP2 | 3.97201011e+07 | held at default three-times-GBW rule |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+06 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+06 | ohm | held at default clamp-node DC path |
| noise_reference_temperature | 3.00150000e+02 | K | held at default archetype noise normalization |
| VDRP_H | 2.00000000e+00 | V | held at default because revision K publishes no typical output swing |
| VDRP_L | 2.00000000e+00 | V | held at default because revision K publishes no typical output swing |
| ROUT | 5.00000000e+01 | ohm | held at default because no usable typical output impedance is published |
| FP2_rule | 3.00000000e+00 | x GBW | held at default because no phase margin is published |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 1.000000e+05 | 9.756146e+04 | V/V | 2.439% | p. 4, Section 5.5 Electrical Characteristics, AVD row, RL >= 2 kohm, TYP column |
| unity-gain bandwidth | 1.200000e+07 | 1.200000e+07 | Hz | 0.000% | p. 4, Section 5.5 Electrical Characteristics, B1 row, TYP column |
| slew rate | 5.000000e+06 | 5.000000e+06 | V/s | 0.000% | p. 4, Section 5.6 Operating Characteristics, SR row, TYP column |

Worst fitting error: 2.439% for open-loop gain.

Validation results are recorded in `validation-results.json`.

## Known omissions

- Output-stage distortion is not modelled. THD, crossover distortion and slew-induced distortion do not appear; a sine through this model comes out a sine.
- Input common-mode range is not enforced. The model does not phase-invert, latch, or lose gain when an input is driven outside VICR. VICR is recorded in supported_operating_region as metadata only.
- PSRR is a single frequency-independent constant taken from the datasheet's DC row. Real supply rejection degrades with frequency; this model's does not.
- CMRR is a single frequency-independent constant. Real common-mode rejection degrades with frequency; this model's does not.
- The frequency response is a two-pole approximation (dominant pole plus one fitted or default pole). Higher-order poles and zeros are not modelled, so gain and phase above the unity-gain frequency are not trustworthy.
- Only broadband input voltage noise is modelled. Flicker (1/f) noise and input current noise are not.
- No self-heating and no temperature coefficients: offset drift, bias-current variation, and thermal feedback are not modelled.
- Quiescent current is a constant. It does not vary with supply, temperature, or output loading.
- Input offset voltage is set to the datasheet typical. A real part may sit anywhere inside the published maximum, and the sign is arbitrary.
- Input protection diodes and ESD structures are not modelled. Inputs driven beyond the supplies do not clamp.
- Settling time and overload recovery are consequences of the two-pole model, not fitted quantities.
- The second pole is placed at three times the gain-bandwidth product: the datasheet publishes no numeric phase margin. Stability with capacitive loads is indicative only.
- VDRP_H is held at default because revision K publishes no typical output swing; value 2 V.
- VDRP_L is held at default because revision K publishes no typical output swing; value 2 V.
- ROUT is held at default because no usable typical output impedance is published; value 50 ohm.
- FP2_rule is held at default because no phase margin is published; value 3 x GBW.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and noise reference temperature = 300.15 K are each held at default archetype values.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.

## F2 upgrade assessment

The official Revision K datasheet was re-examined through page 5. It publishes useful typical AVD, GBW, slew, offset, bias, rejection, supply-current, and noise values, but it does not publish a usable typical output-voltage-swing row or phase margin. The op-amp archetype requires rail drop to come from a published output-swing row. The current 2 V rail-drop value is therefore a disclosed held default, not enough evidence for F2. The package remains F1 rather than inflating the tier.
