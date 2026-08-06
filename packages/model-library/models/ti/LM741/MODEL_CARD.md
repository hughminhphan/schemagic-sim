# LM741 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Single general-purpose operational amplifier
- Electrical family: opamp
- Fidelity tier: F1, heritage datasheet fit
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm741.pdf
- Revision: SNOSC25D, May 1998, revised October 2015
- Accessed: 2026-08-07
- Referenced pages: p. 4, p. 5
- SHA-256: `e0d1e5a2f2ecf5ce318fadb27a088319fb55e4268c94a1aca4fbbb9caa1ede5e`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| AOL | 2.00000000e+5 | direct or derived datasheet transcription |
| GBW | 1.09839002e+6 | held at physical default; no datasheet bandwidth typical is published |
| SR | 5.27251457e+5 | native calibrated |
| IBIAS | 8.00000000e-8 | direct or derived datasheet transcription |
| IOS | 2.00000000e-8 | direct or derived datasheet transcription |
| VOS | 1.00000000e-3 | direct or derived datasheet transcription |
| ROUT | 4.00000000e+1 | derived from TYP output rail drop divided by TYP short-circuit current |
| ILIM | 2.50000000e-2 | direct or derived datasheet transcription |
| VDRP_H | 9.43944160e-1 | native fitted to derived centered TYP output target |
| VDRP_L | 9.43948146e-1 | native fitted to derived centered TYP output target |
| FP2 | 3.29517005e+6 | held at default placement of three times GBW; no phase margin is published |
| CMRR | 5.62341325e+4 | direct or derived datasheet transcription |
| PSRR | 6.30957344e+4 | direct or derived datasheet transcription |
| VSUP_NOM | 3.00000000e+1 | direct or derived datasheet transcription |
| IQ | 1.70000000e-3 | direct or derived datasheet transcription |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| CC | 3.00000000e-11 | F | held at default internal archetype scale |
| CDIF | 1.00000000e-12 | F | held at default input-capacitance placeholder |
| RE | 1.00000000e+6 | ohm | held at default internal DC path |
| CP2 | 1.00000000e-12 | F | held at default second-pole scale |
| RQ | 1.00000000e+6 | ohm | held at default clamp-node DC path |
| GBW target | 1.00000000e+6 | Hz | held at physical default because the datasheet publishes no bandwidth typical |
| FP2 placement | 3.00000000e+0 | times GBW | held at default because the datasheet publishes no phase margin |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 2.000000e+5 | 1.960798e+5 | V/V | 1.960% | p. 5 electrical characteristics, TYP column |
| slew rate | 5.000000e+5 | 5.000000e+5 | V/s | 0.000% | p. 5 electrical characteristics, TYP column |
| positive output swing | 1.400000e+1 | 1.400000e+1 | V | 0.000% | p. 5 electrical characteristics, TYP column |
| negative output swing | -1.400000e+1 | -1.399918e+1 | V | 0.006% | p. 5 electrical characteristics, TYP column |

Worst fitting error: 1.960% for open-loop gain.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 5.865e-11 and worst absolute delta was 7.469e-9.

## Known omissions

- Output-stage distortion is not modelled. THD, crossover distortion and slew-induced distortion do not appear; a sine through this model comes out a sine.
- Input common-mode range is not enforced. The model does not phase-invert, latch, or lose gain when an input is driven outside VICR. VICR is recorded in supported_operating_region as metadata only.
- PSRR is a single frequency-independent constant taken from the datasheet's DC row. Real supply rejection degrades with frequency; this model's does not.
- CMRR is a single frequency-independent constant. Real common-mode rejection degrades with frequency; this model's does not.
- The frequency response is a two-pole approximation (dominant pole plus one pole placed from the phase margin). Higher-order poles and zeros are not modelled, so gain and phase above the unity-gain frequency are not trustworthy.
- Noise is not modelled because the datasheet publishes no equivalent input noise voltage.
- No self-heating and no temperature coefficients: offset drift, bias-current doubling with temperature, and thermal feedback are not modelled.
- Quiescent current is a constant. It does not vary with supply, temperature, or output loading.
- Input offset voltage is set to the datasheet typical. A real part may sit anywhere inside the published maximum, and the sign is arbitrary.
- Input protection diodes and ESD structures are not modelled. Inputs driven beyond the supplies do not clamp.
- Settling time and overload recovery are consequences of the two-pole model, not fitted quantities.
- CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, and RQ = 1 Mohm are held at default internal archetype values.
- Noise is not modelled: the datasheet publishes no equivalent input noise voltage.
- The second pole is placed at three times the gain-bandwidth product: the datasheet publishes no phase margin. Stability with capacitive loads is indicative only.
- ROUT derived from the output swing and short-circuit current rows: the datasheet publishes no open-loop output impedance.
- Fitted at F1 from a heritage datasheet with incomplete AC characterisation.
- GBW and FP2 are held at physical defaults because the LM741 table publishes no bandwidth or phase-margin typical.
- The noise element is omitted entirely; no noise value is fabricated.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
