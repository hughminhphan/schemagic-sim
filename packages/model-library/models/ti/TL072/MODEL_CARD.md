# TL072 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual low-noise JFET-input operational amplifier
- Electrical family: opamp
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tl072.pdf
- Revision: SLOS080W, September 1978, revised July 2025
- Accessed: 2026-08-06
- Referenced pages: p. 15, p. 16, p. 21, p. 23
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

## Fitted parameters

| Parameter | Value |
| --- | ---: |
| AOL | 2.00000000e+5 |
| GBW | 7.94052779e+6 |
| SR | 2.19928870e+7 |
| IBIAS | 6.50000000e-11 |
| IOS | 5.00000000e-12 |
| VOS | 3.00000000e-3 |
| ROUT | 1.25000000e+2 |
| ILIM | 4.00000000e-2 |
| VDRP_H | 5.00000000e+0 |
| VDRP_L | 5.00000000e+0 |
| FP2 | 5.35595362e+6 |
| CMRR | 1.00000000e+5 |
| PSRR | 1.00000000e+5 |
| VSUP_NOM | 3.00000000e+1 |
| IQ | 1.40000000e-3 |
| EN | 3.70000000e-8 |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 2.000000e+5 | 1.882362e+5 | V/V | 5.882% | p. 15 electrical characteristics |
| unity-gain bandwidth | 5.250000e+6 | 5.250000e+6 | Hz | 0.000% | p. 15 electrical characteristics |
| slew rate | 2.000000e+7 | 2.000000e+7 | V/s | 0.000% | p. 16 electrical characteristics |
| positive output swing | 1.000000e+1 | 9.428171e+0 | V | 5.718% | p. 15 electrical characteristics |
| negative output swing | -1.000000e+1 | -9.428171e+0 | V | 5.718% | p. 15 electrical characteristics |

Worst fitting error: 5.882% for open-loop gain.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 5.198e-12 and worst absolute delta was 2.530e-10.

## Known omissions

- Output distortion, crossover distortion, input common-mode failure, input protection, and overload recovery are not fitted.
- PSRR and CMRR are frequency-independent constants.
- The frequency response is a two-pole approximation above the unity-gain frequency.
- Only broadband input voltage noise is modelled; flicker and current noise are omitted.
- No self-heating or temperature coefficients are modelled.
- Input offset uses the datasheet typical and does not represent production spread.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
