# OPA2134 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual high-performance SoundPlus audio operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-fitted
- Target tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/opa2134.pdf
- Revision: SBOS058B, December 1997, revised November 2024
- Accessed: 2026-08-07
- Referenced pages: p. 5, p. 7, p. 8
- SHA-256: `30703874b3eff89b06201e23a7f77178c9dcacd94e3dcd1fc2b67e418bc3cdbd`
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
| AOL | 1.00000000e+06 | direct typical transcription |
| GBW | 8.66758939e+06 | native calibrated |
| SR | 2.07513852e+07 | native calibrated |
| IBIAS | 5.00000000e-12 | direct typical transcription |
| IOS | 2.00000000e-12 | direct typical transcription |
| VOS | 1.00000000e-03 | direct typical transcription |
| ROUT | 1.00000000e+01 | direct typical transcription |
| ILIM | 3.00000000e-02 | direct typical transcription |
| VDRP_H | 2.00000000e+00 | held at default |
| VDRP_L | 2.00000000e+00 | held at default |
| CMRR | 1.00000000e+05 | direct typical transcription |
| PSRR | 1.99526231e+05 | direct typical transcription |
| VSUP_NOM | 3.00000000e+01 | derived from datasheet test supply |
| IQ | 4.00000000e-03 | direct typical transcription |
| EN | 8.00000000e-09 | direct typical transcription |
| FP2 | 2.60027682e+07 | held at default three-times-GBW rule |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+06 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+06 | ohm | held at default clamp-node DC path |
| noise_reference_temperature | 3.00150000e+02 | K | held at default archetype noise normalization |
| VDRP_H | 2.00000000e+00 | V | held at default because no TYP output swing is published |
| VDRP_L | 2.00000000e+00 | V | held at default because no TYP output swing is published |
| FP2_rule | 3.00000000e+00 | x GBW | held at default because no numeric phase margin is published |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 1.000000e+06 | 9.950291e+05 | V/V | 0.497% | p. 7, Section 5.7 Electrical Characteristics, AOL row, RL = 2 kohm, TYP column |
| unity-gain bandwidth | 8.000000e+06 | 7.999999e+06 | Hz | 0.000% | p. 7, Section 5.7 Electrical Characteristics, GBW row, TYP column |
| slew rate | 2.000000e+07 | 2.000044e+07 | V/s | 0.002% | p. 7, Section 5.7 Electrical Characteristics, SR row, TYP column |

Worst fitting error: 0.497% for open-loop gain.

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
- VDRP_H is held at default because no TYP output swing is published; value 2 V.
- VDRP_L is held at default because no TYP output swing is published; value 2 V.
- FP2_rule is held at default because no numeric phase margin is published; value 3 x GBW.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and noise reference temperature = 300.15 K are each held at default archetype values.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
