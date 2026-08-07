# TLV9062 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual 10 MHz rail-to-rail input and output CMOS operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, bounded / approximate
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tlv9062.pdf
- Revision: SBOS839N, March 2017, revised July 2026
- Accessed: 2026-08-07
- Referenced pages: p. 10, p. 13, p. 14
- SHA-256: `c37698e10c1c9c3f12af82dc8439a0f273fe205898bac9b31662e0a394180786`
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
| AOL | 3.16227766e+06 | direct typical transcription |
| GBW | 1.48291202e+07 | native calibrated |
| SR | 7.05344145e+06 | native calibrated |
| IBIAS | 5.00000000e-13 | direct typical transcription |
| IOS | 5.00000000e-14 | direct typical transcription |
| VOS | 3.00000000e-04 | direct typical transcription |
| ROUT | 1.00000000e+02 | direct typical transcription |
| ILIM | 1.09347793e-01 | native calibrated to typical short-circuit current |
| VDRP_H | 1.00000000e-01 | held at default |
| VDRP_L | 1.00000000e-01 | held at default |
| CMRR | 1.41253754e+05 | direct typical transcription |
| PSRR | 1.42857143e+05 | direct typical transcription |
| VSUP_NOM | 5.50000000e+00 | derived from datasheet test supply |
| IQ | 5.38000000e-04 | direct typical transcription |
| EN | 1.60000000e-08 | direct typical transcription |
| FP2 | 1.03834618e+07 | derived from phase margin and calibrated GBW |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 3.162278e+06 | 3.011696e+06 | V/V | 4.762% | p. 13, Section 6.10 Electrical Characteristics, AOL row, RL = 2 kohm, TYP column |
| unity-gain bandwidth | 1.000000e+07 | 1.000000e+07 | Hz | 0.000% | p. 13, Section 6.10 Electrical Characteristics, GBP row, TYP column |
| slew rate | 6.500000e+06 | 6.500000e+06 | V/s | 0.000% | p. 13, Section 6.10 Electrical Characteristics, SR row, TYP column |
| short-circuit current | 5.000000e-02 | 5.000000e-02 | A | 0.000% | p. 14, Section 6.10 Electrical Characteristics, ISC row, TYP column |

Worst fitting error: 4.762% for open-loop gain.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.498e-10 and worst absolute delta was 1.346e-09.

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
- VDRP_H is held at physical default because only a MAX rail-headroom value is published; value 0.1 V.
- VDRP_L is held at physical default because only a MAX rail-headroom value is published; value 0.1 V.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and noise reference temperature = 300.15 K are each held at default archetype values.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
