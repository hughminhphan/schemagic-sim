# MCP1700-3302E model card

## Identity

- Manufacturer: Microchip Technology Inc.
- Description: 3.3 V, 250 mA low-quiescent-current low-dropout regulator
- Electrical family: vreg_linear
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MCP1700-Data-Sheet-20001826F.pdf
- Revision: DS20001826F, Revision F, December 2020
- Accessed: 2026-08-07
- Referenced pages: p. 1 features and description, p. 2 DC characteristics, p. 3 DC characteristics continued, p. 11 pin descriptions, p. 24 product identification system, p. 29 revision history
- SHA-256: `44919ee695b5d6ef69aeb81f6b1b50a2d3d7197accd5db08a8a0d83f15d10918`
- Basis: original model generated only from public factual specifications
- Vendor SPICE models used: none

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VREF | 3.3 | datasheet_typical_or_derived |
| VDROP | 0.178 | datasheet_typical_or_derived |
| ILIM | 0.408 | datasheet_typical_or_derived |
| LOADREG | 0.033 | datasheet_typical_or_derived |
| DILOAD | 0.2499 | datasheet_typical_or_derived |
| LINEREG | 0.042075 | datasheet_typical_or_derived |
| DVLINE | 1.7 | datasheet_typical_or_derived |
| VNOM | 4.3 | datasheet_typical_or_derived |
| IQ | 1.6e-06 | datasheet_typical_or_derived |
| RNEG | 1 | held_default |
| EPS | 1e-08 | held_default |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output voltage | 3.3 | 3.300128 | V | 0.004% | p. 2 Output Voltage nominal VR = 3.3 V |
| load regulation | 0.033 | 0.038559117 | V | 16.846% | p. 2 Load Regulation TYP = 1.0% |
| line regulation across 4.3 V to 6 V | 0.042075 | 0.042075033 | V | 0.000% | p. 2 Line Regulation TYP = 0.75%/V |
| dropout voltage | 0.178 | 0.21643117 | V | 21.591% | p. 2 Dropout Voltage TYP column and note 5 |
| short circuit current | 0.408 | 0.408 | A | 0.000% | p. 2 Output Short Circuit Current TYP column |

Worst fitting error: 21.591% for dropout voltage.

Native and WASM agreement: all 7 benches passed. Worst relative engine delta was 6.217e-12; worst absolute delta was 6.661e-15.

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
- Line regulation is represented as a positive linear slope using the published 0.75%/V typical magnitude; the datasheet does not specify direction.
- Load regulation is represented as output droop using the published 1.0% typical magnitude; the datasheet does not specify direction.

## Licence

MIT. See `LICENSE`. Reviewer remains pending-review.
