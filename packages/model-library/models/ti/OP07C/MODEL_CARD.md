# OP07C model card

## Identity

- Manufacturer: Texas Instruments
- Description: Precision low-offset operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-fitted
- Target tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/op07c.pdf
- Revision: SLOS099H, September 1983, revised March 2023
- Accessed: 2026-08-07
- Referenced pages: p. 4, p. 5, p. 6
- SHA-256: `882fe648876298f90e405589ffaf5c5d9142ee89b4bf988defcf112c1a7c8401`
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
| AOL | 4.00000000e+05 | direct typical transcription |
| GBW | 6.62031242e+05 | native calibrated |
| SR | 3.17764600e+05 | native calibrated |
| IBIAS | 1.80000000e-09 | direct typical transcription |
| IOS | 8.00000000e-10 | direct typical transcription |
| VOS | 6.00000000e-05 | direct typical transcription |
| ROUT | 5.00000000e+01 | direct typical transcription |
| ILIM | 2.00000000e-02 | direct typical transcription |
| VDRP_H | 1.86835297e+00 | native fitted to 25 degC typical output swing |
| VDRP_L | 1.86835281e+00 | native fitted to 25 degC typical output swing |
| CMRR | 1.00000000e+06 | direct typical transcription |
| PSRR | 1.42857143e+05 | direct typical transcription |
| VSUP_NOM | 3.00000000e+01 | derived from datasheet test supply |
| IQ | 2.66666667e-03 | direct typical transcription |
| EN | 9.80000000e-09 | direct typical transcription |
| FP2 | 1.98609373e+06 | held at default three-times-GBW rule |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+06 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+06 | ohm | held at default clamp-node DC path |
| noise_reference_temperature | 3.00150000e+02 | K | held at default archetype noise normalization |
| ILIM | 2.00000000e-02 | A | held at conservative physical default because no numeric short-circuit current is published |
| ROUT | 5.00000000e+01 | ohm | held at default because no output impedance is published |
| FP2_rule | 3.00000000e+00 | x GBW | held at default because no numeric phase margin is published |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 4.000000e+05 | 3.902365e+05 | V/V | 2.441% | p. 5, Section 6.5 Electrical Characteristics, AOL row, TYP column |
| unity-gain bandwidth | 6.000000e+05 | 5.999999e+05 | Hz | 0.000% | p. 6, Section 6.5 Electrical Characteristics, unity-gain-bandwidth row, TYP column |
| slew rate | 3.000000e+05 | 3.000000e+05 | V/s | 0.000% | p. 6, Section 6.5 Electrical Characteristics, SR row, TYP column |
| positive output swing | 1.280000e+01 | 1.280000e+01 | V | 0.000% | p. 6, Section 6.5 Electrical Characteristics, voltage-output-swing row, TYP column |
| negative output swing | -1.280000e+01 | -1.280000e+01 | V | 0.000% | p. 6, Section 6.5 Electrical Characteristics, voltage-output-swing row, TYP column |

Worst fitting error: 2.441% for open-loop gain.

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
- ILIM is held at conservative physical default because no numeric short-circuit current is published; value 0.02 A.
- ROUT is held at default because no output impedance is published; value 50 ohm.
- FP2_rule is held at default because no numeric phase margin is published; value 3 x GBW.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and noise reference temperature = 300.15 K are each held at default archetype values.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
