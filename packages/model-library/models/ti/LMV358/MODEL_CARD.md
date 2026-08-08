# LMV358 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual low-voltage rail-to-rail-output operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-fitted
- Target tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lmv358.pdf
- Revision: SLOS263Y, August 1999, revised August 2023
- Accessed: 2026-08-07
- Referenced pages: p. 5, p. 6, p. 7
- SHA-256: `1048f4ec44029649315ee61cf5e34d203fc304a5c9f3653deaa0f8a559b2c0df`
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
| GBW | 1.53182374e+06 | native calibrated |
| SR | 1.03803437e+06 | native calibrated |
| IBIAS | 1.50000000e-08 | direct typical transcription |
| IOS | 5.00000000e-09 | direct typical transcription |
| VOS | 1.70000000e-03 | direct typical transcription |
| ROUT | 1.00000000e+00 | direct typical transcription |
| ILIM | 4.00000000e-02 | direct typical transcription |
| VDRP_H | 3.87897195e-02 | native fitted to 25 degC typical output swing |
| VDRP_L | 1.18789620e-01 | native fitted to 25 degC typical output swing |
| CMRR | 1.77827941e+03 | direct typical transcription |
| PSRR | 1.00000000e+03 | direct typical transcription |
| VSUP_NOM | 5.00000000e+00 | derived from datasheet test supply |
| IQ | 1.05000000e-04 | direct typical transcription |
| EN | 3.90000000e-08 | direct typical transcription |
| FP2 | 8.84398846e+05 | derived from phase margin and calibrated GBW |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+06 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+06 | ohm | held at default clamp-node DC path |
| noise_reference_temperature | 3.00150000e+02 | K | held at default archetype noise normalization |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 1.000000e+05 | 9.997810e+04 | V/V | 0.022% | p. 7, Section 6.8 Electrical Characteristics, AVD row, TYP column |
| unity-gain bandwidth | 1.000000e+06 | 9.999997e+05 | Hz | 0.000% | p. 7, Section 6.8 Electrical Characteristics, B1 row, TYP column |
| slew rate | 1.000000e+06 | 1.000001e+06 | V/s | 0.000% | p. 7, Section 6.8 Electrical Characteristics, SR row, TYP column |
| positive output swing | 4.960000e+00 | 4.960000e+00 | V | 0.000% | p. 7, Section 6.8 Electrical Characteristics, VO high-level row, TYP column |
| negative output swing | 1.200000e-01 | 1.200000e-01 | V | 0.000% | p. 7, Section 6.8 Electrical Characteristics, VO low-level row, TYP column |

Worst fitting error: 0.022% for open-loop gain.

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
- Input common-mode range includes the negative supply on this part. The model does not reproduce gain loss or offset shift as an input approaches either supply.
- ROUT derived from typical high-side output headroom and typical short-circuit current because no open-loop output impedance is published.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and noise reference temperature = 300.15 K are each held at default archetype values.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
