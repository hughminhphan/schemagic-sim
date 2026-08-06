# TL074 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Quadruple low-noise JFET-input operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, datasheet-anchored partial characterization
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tl074.pdf
- Revision: SLOS080W, September 1978, revised July 2025
- Accessed: 2026-08-06
- Referenced pages: p. 11, p. 15, p. 16, p. 23
- SHA-256: `3d22c5cf1cfafae082763406bba57521f6ba0fc362a8ba90d1c6c88eef776f03`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | fitted |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| AOL | 2.00000000e+5 | direct typical transcription |
| GBW | 7.94052779e+6 | native calibrated |
| SR | 2.19928870e+7 | native calibrated |
| IBIAS | 6.50000000e-11 | direct typical transcription |
| IOS | 5.00000000e-12 | direct typical transcription |
| VOS | 3.00000000e-3 | direct typical transcription |
| ROUT | 1.25000000e+2 | direct typical transcription |
| ILIM | 4.00000000e-2 | direct digitized typical transcription |
| VDRP_H | 1.33118593e+0 | native fitted to 25 degC typical output swing |
| VDRP_L | 1.33118591e+0 | native fitted to 25 degC typical output swing |
| FP2 | 5.35595362e+6 | derived from phase margin and calibrated GBW |
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
| open-loop gain | 2.000000e+5 | 1.882362e+5 | V/V | 5.882% | p. 15 electrical characteristics, TYP column |
| unity-gain bandwidth | 5.250000e+6 | 5.250000e+6 | Hz | 0.000% | p. 15 electrical characteristics, TYP column |
| slew rate | 2.000000e+7 | 2.000000e+7 | V/s | 0.000% | p. 16 electrical characteristics, TYP column |
| positive output swing | 1.350000e+1 | 1.350000e+1 | V | 0.000% | p. 15 electrical characteristics, TYP column |
| negative output swing | -1.350000e+1 | -1.350000e+1 | V | 0.000% | p. 15 electrical characteristics, TYP column |

Worst fitting error: 5.882% for open-loop gain.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 4.370e-11 and worst absolute delta was 3.044e-8.

## Known omissions

- Output-stage distortion is not modelled. THD, crossover distortion and slew-induced distortion do not appear; a sine through this model comes out a sine.
- Input common-mode range is not enforced. The model does not phase-invert, latch, or lose gain when an input is driven outside VICR. VICR is recorded in supported_operating_region as metadata only.
- PSRR is a single frequency-independent constant taken from the datasheet's DC row. Real supply rejection degrades with frequency; this model's does not.
- CMRR is a single frequency-independent constant. Real common-mode rejection degrades with frequency; this model's does not.
- The frequency response is a two-pole approximation (dominant pole plus one pole placed from the phase margin). Higher-order poles and zeros are not modelled, so gain and phase above the unity-gain frequency are not trustworthy.
- Only broadband input voltage noise is modelled. Flicker (1/f) noise and input current noise are not.
- No self-heating and no temperature coefficients: offset drift, bias-current doubling with temperature, and thermal feedback are not modelled.
- Quiescent current is a constant. It does not vary with supply, temperature, or output loading.
- Input offset voltage is set to the datasheet typical. A real part may sit anywhere inside the published maximum, and the sign is arbitrary.
- Input protection diodes and ESD structures are not modelled. Inputs driven beyond the supplies do not clamp.
- Settling time and overload recovery are consequences of the two-pole model, not fitted quantities.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and the 300.15 K noise normalization are held at default internal archetype values.
- Output rail drop is fitted to the 25 degC typical swing at RL = 10 kohm; guaranteed minimum rows are retained as limits and are not used as typical targets.
- Fidelity is intentionally capped at F1 for this batch target; the model remains datasheet-anchored but is not claimed as an F2 characterization of every channel in the TL074 package.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
