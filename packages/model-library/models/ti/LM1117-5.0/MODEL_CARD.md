# LM1117-5.0 model card

## Identity

- Manufacturer: Texas Instruments
- Description: 5 V, 800 mA low-dropout linear regulator
- Electrical family: vreg_linear
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm1117.pdf
- Revision: SNOS412Q, February 2000, revised January 2023
- Accessed: 2026-08-07
- Referenced pages: p. 3 Table 6-1, p. 5 Section 7.5, p. 6 Section 7.5
- SHA-256: `957ae45275a5dfa76c1ac0d7a45116871cccb0d8e6726ddc203968f98cac3c2c`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VREF | 5.00000000e+0 | datasheet_typical_or_derived |
| VDROP | 1.20000000e+0 | datasheet_typical_or_derived |
| ILIM | 1.20000000e+0 | datasheet_typical_or_derived |
| LOADREG | 1.00000000e-3 | datasheet_typical_or_derived |
| DILOAD | 8.00000000e-1 | datasheet_typical_or_derived |
| LINEREG | 1.00000000e-3 | datasheet_typical_or_derived |
| DVLINE | 8.50000000e+0 | datasheet_typical_or_derived |
| VNOM | 7.00000000e+0 | datasheet_typical_or_derived |
| IQ | 5.00000000e-3 | datasheet_typical_or_derived |
| RNEG | 1.00000000e+0 | held_default |
| EPS | 1.00000000e-8 | held_default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RNEG | 1.00000000e+0 | ohm | archetype fixed constant |
| EPS | 1.00000000e-8 | V^2 | archetype fixed smoothing constant |
| RSER | 1.00000000e+7 | ohm | archetype fixed output shunt |
| RER | 1.00000000e+6 | ohm | archetype fixed error-node shunt |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |


Worst fitting error: 0.000% for pending native measurement.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 9.055e-11 and worst absolute delta was 4.529e-10.

## Known omissions

- Thermal shutdown is not modelled. The regulator does not shut down or fold back when it overheats; it will dissipate arbitrary power indefinitely.
- Safe-operating-area foldback is not modelled. The current limit is a constant, whereas a real regulator reduces it at high input-to-output differential.
- No self-heating and no temperature coefficients. Output voltage drift, dropout increase, and quiescent-current change with temperature are not modelled.
- Reverse current from OUT to IN is not modelled beyond a protective clamp. Discharging the output through the regulator does not reproduce the real part behavior.
- AC behaviour is not modelled: there is no control-loop pole, no output impedance versus frequency, and no ripple rejection. PSRR and transient load-step response are absent.
- Loop stability is not modelled. This model regulates with any output capacitor or none, whereas a real LDO oscillates outside its specified ESR window.
- Start-up behaviour, soft-start and inrush are not modelled.
- Noise is not modelled.
- Output voltage is set to the datasheet nominal; a real part may sit anywhere inside the published tolerance band.
- RNEG is held at default 1 ohm.
- EPS is held at default 1e-8.
- RSER is held at default 1e7 ohm.
- RER is held at default 1 megohm.
- Dropout is a single constant taken at the rated current. Real LDO dropout rises with load current; this model does not.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
