# AMS1117-3.3 model card

## Identity

- Manufacturer: Advanced Monolithic Systems, Inc.
- Description: 3.3 V, 1 A low-dropout linear regulator
- Electrical family: vreg_linear
- Fidelity tier: F2
- Independent reviewer: pending-review

## Provenance

- Datasheet: http://www.advanced-monolithic.com/pdf/ds1117.pdf
- Revision: Undated DS1117, PDF metadata created 2009-08-28
- Accessed: 2026-08-07
- Referenced pages: p. 1 features, ordering and pin connections, p. 2 absolute maximum ratings and electrical characteristics, p. 3 electrical characteristics and notes
- SHA-256: `189a2651878a87d590b768eaa9b44217a3fdf460352ce6ecaff127221282a3f0`
- Basis: original model generated only from public factual specifications
- Vendor SPICE models used: none

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VREF | 3.3 | datasheet_typical_or_derived |
| VDROP | 1.1 | datasheet_typical_or_derived |
| ILIM | 1.1 | datasheet_typical_or_derived |
| LOADREG | 0.0021166444 | datasheet_typical_or_derived |
| DILOAD | 0.8 | datasheet_typical_or_derived |
| LINEREG | 0.00050000267 | datasheet_typical_or_derived |
| DVLINE | 10.5 | datasheet_typical_or_derived |
| VNOM | 4.8 | datasheet_typical_or_derived |
| IQ | 0.005 | datasheet_typical_or_derived |
| RNEG | 1 | held_default |
| EPS | 1e-08 | held_default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output voltage | 3.3 | 3.3001424 | V | 0.004% | p. 2 Output Voltage TYP column |
| load regulation | 0.003 | 0.0030015136 | V | 0.050% | p. 3 Load Regulation TYP column |
| line regulation | 0.0005 | 0.00050000397 | V | 0.001% | p. 2 Line Regulation TYP column |
| dropout voltage | 1.1 | 1.1026852 | V | 0.244% | p. 3 Dropout Voltage TYP column and note 4 |
| current limit | 1.1 | 1.1 | A | 0.000% | p. 3 Current Limit TYP column |

Worst fitting error: 0.244% for dropout voltage.

Native and WASM agreement: all 7 benches passed. Worst relative engine delta was 1.084e-10; worst absolute delta was 3.577e-10.

## Known omissions

- Thermal shutdown is not modelled. The regulator does not shut down or fold back when it overheats; it will dissipate arbitrary power indefinitely.
- Safe-operating-area foldback is not modelled. The current limit is a constant, whereas a real regulator reduces it at high input-to-output differential.
- No self-heating and no temperature coefficients. Output voltage drift, dropout increase, and quiescent-current change with temperature are not modelled.
- Reverse current from OUT to IN is not modelled beyond a protective clamp. Discharging the output through the regulator does not reproduce the real part behavior.
- AC behaviour is not modelled: there is no control-loop pole, no output impedance versus frequency, and no ripple rejection. PSRR and transient load-step response are absent.
- Loop stability is not modelled. This model regulates with any output capacitor or none, whereas a real LDO can oscillate outside its specified capacitor and ESR window.
- Start-up behaviour, soft-start and inrush are not modelled.
- Noise is not modelled.
- Output voltage is set to the datasheet nominal; a real part may sit anywhere inside the published tolerance band.
- RNEG = 1 ohm, EPS = 1e-8 V^2, RSER = 1e7 ohm, and RER = 1 megohm are held archetype defaults, not fitted facts.
- Dropout is a single constant taken at rated current. Real LDO dropout rises with load current; this model does not.

## Licence

MIT. See `LICENSE`. Reviewer remains pending-review.
