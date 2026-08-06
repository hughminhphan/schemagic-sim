# LM358 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual industry-standard operational amplifier
- Electrical family: opamp
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm358.pdf
- Revision: SLOS068AB, June 1976, revised October 2024
- Accessed: 2026-08-06
- Referenced pages: p. 5, p. 10
- SHA-256: `f78315aaf2d453b0c3cf7c56d968b90e65d8bc93d52c13f8fac2361bfc6ae1ee`
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
| AOL | 1.00000000e+5 | direct or derived datasheet transcription |
| GBW | 7.72175949e+5 | native calibrated |
| SR | 3.18001025e+5 | native calibrated |
| IBIAS | 2.00000000e-8 | direct or derived datasheet transcription |
| IOS | 2.00000000e-9 | direct or derived datasheet transcription |
| VOS | 3.00000000e-3 | direct or derived datasheet transcription |
| ROUT | 5.00000000e+1 | derived from TYP high-side rail drop divided by TYP short-circuit current |
| ILIM | 4.00000000e-2 | direct or derived datasheet transcription |
| VDRP_H | 1.93497805e+0 | native fitted to the 30 V, 10 kohm TYP high-output row |
| VDRP_L | 1.00000000e-2 | held at archetype 10 mV numerical floor; datasheet TYP is 5 mV |
| FP2 | 2.31652785e+6 | held at default placement of three times calibrated GBW; phase margin not published |
| CMRR | 1.00000000e+4 | direct or derived datasheet transcription |
| PSRR | 1.00000000e+5 | direct or derived datasheet transcription |
| VSUP_NOM | 5.00000000e+0 | direct datasheet default test supply |
| IQ | 3.50000000e-4 | direct or derived datasheet transcription |
| EN | 4.00000000e-8 | direct or derived datasheet transcription |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+6 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+6 | ohm | held at default clamp-node DC path |
| noise_reference_temperature | 3.00150000e+2 | K | held at default archetype noise normalization |
| FP2 placement | 3.00000000e+0 | times GBW | held at default because phase margin is not published |
| VDRP_L floor | 1.00000000e-2 | V | held at default numerical floor; datasheet TYP is 0.005 V |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 1.000000e+5 | 9.756577e+4 | V/V | 2.434% | p. 10 electrical characteristics, TYP column |
| unity-gain bandwidth | 7.000000e+5 | 7.000000e+5 | Hz | 0.000% | p. 10 electrical characteristics, TYP column |
| slew rate | 3.000000e+5 | 3.000000e+5 | V/s | 0.000% | p. 10 electrical characteristics, TYP column |
| high output voltage | 2.800000e+1 | 2.800000e+1 | V | 0.000% | p. 10 electrical characteristics, TYP column |
| low output voltage | 5.000000e-3 | 1.000000e-2 | V | 100.000% | p. 10 electrical characteristics, TYP column |

Worst fitting error: 100.000% for low output voltage (5 mV absolute error, inside the archetype 0.1 V swing tolerance).

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 3.149e-11 and worst absolute delta was 7.012e-10.

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
- The second pole is placed at three times the gain-bandwidth product: the datasheet publishes no phase margin. Stability with capacitive loads is indicative only.
- ROUT derived from the output swing and short-circuit current rows: the datasheet publishes no open-loop output impedance.
- Input common-mode range includes the negative supply on this part. The model does not reproduce the gain loss or offset shift that occurs as an input approaches either supply.
- High-side rail drop is fitted to the 30 V, RL >= 10 kohm TYP row; low-side rail drop uses the 5 mV TYP row with the archetype 10 mV numerical floor.
- FP2 is held at the archetype default placement of three times GBW because phase margin is not published.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
