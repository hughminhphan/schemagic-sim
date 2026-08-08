# GL5528 model card

## Identity

- Manufacturer: Nanyang Senba Optical & Electronic Co., Ltd.
- Description: GL55-series cadmium-sulfide light-dependent resistor
- Electrical family: other
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://cdn.sparkfun.com/datasheets/Sensors/LightImaging/SEN-09088.pdf
- Revision: GL5528.xls source sheet, created 25-Apr-2007; reputable SparkFun mirror
- Accessed: 2026-08-09
- Referenced pages: p. 1
- SHA-256: `568ea23f647b2c7b14daee99984244c5134cbc0d0ed63f4f424615c96d90384d`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| R10 | 2.00000000e+4 | published maximum selected as conservative F1 bound |
| GAMMA | 7.00000000e-1 | direct typical transcription |
| LUX_FLOOR | 1.00000000e+1 | lowest cited illuminance in supported region |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| conservative resistance at 10 lux | 2.000000e+4 | 2.000000e+4 | ohm | 0.000% | p. 1 light resistance at 10 lux |
| conservative resistance at 100 lux | 3.990525e+3 | 3.990525e+3 | ohm | 0.000% | p. 1 gamma definition and 10 lux maximum |

Worst fitting error: 0.000% for conservative resistance at 10 lux.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- The source sheet is image-only and is accessed through a reputable SparkFun mirror; manufacturer provenance is retained but fidelity is capped at F1.
- The published 8 kohm to 20 kohm range at 10 lux is a production bound, not a typical value. The model selects the 20 kohm maximum conservatively and claims no typical unit.
- LUX is caller supplied. Optical geometry, source spectrum, spectral response, hysteresis, memory, rise/fall dynamics, temperature coefficient, and ageing are not modelled.
- Dark resistance is a minimum bound and is not used as a continuous-curve target outside the published 10-to-100 lux gamma interval.
- P5 independent review passed F1 after correcting LUX_FLOOR to the lowest cited supported illuminance of 10 lux; both native and WASM benches and an independent 30 lux probe passed, with no typical-unit claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
