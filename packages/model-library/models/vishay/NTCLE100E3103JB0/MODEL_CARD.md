# NTCLE100E3103JB0 model card

## Identity

- Manufacturer: Vishay BCcomponents
- Description: 10 kohm radial-leaded NTC thermistor, 5 percent R25 tolerance
- Electrical family: other
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.vishay.com/docs/29049/ntcle100.pdf
- Revision: Document 29049, revision 07-May-2025
- Accessed: 2026-08-09
- Referenced pages: p. 2, p. 10
- SHA-256: `7a6b1228e4464d61dd4e2774db871c44cefb5b2353c1b1179330004c4562af69`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| R0 | 1.00000000e+4 | direct transcription of the cited 10 kohm R25 (p. 2 electrical data and ordering information, 10 000 ohm R25 row) |
| T0_C | 2.50000000e+1 | direct transcription of the cited R25 reference temperature (p. 2 electrical data and ordering information, R25 column heading) |
| BETA | 3.97700000e+3 | direct transcription of the cited 3977 K B25/85 (p. 2 electrical data and ordering information, B25/85 column of the 10 000 ohm row) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| resistance at 25 degC | 1.000000e+4 | 1.000000e+4 | ohm | 0.000% | p. 10 NTCLE100E3103 resistance column |
| resistance at 55 degC | 2.989000e+3 | 2.953879e+3 | ohm | 1.175% | p. 10 NTCLE100E3103 resistance column |
| resistance at 85 degC | 1.070000e+3 | 1.070309e+3 | ohm | 0.029% | p. 10 NTCLE100E3103 resistance column |

Worst fitting error: 1.175% for resistance at 55 degC.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- TEMP_C is caller supplied. Heat flow, self-heating, and the surrounding thermal environment are not simulated.
- R0, T0_C, and BETA are transcribed directly from the cited datasheet rows and no parameter is fitted, so the model tracks the manufacturer resistance table only as closely as a single B25/85 law allows.
- A single B-parameter law does not reproduce the full Steinhart-Hart curvature of the manufacturer resistance table outside the cited B25/85 interval. The supported region is therefore 25 degC to 85 degC even though the part is rated -40 degC to +125 degC and the resistance table is published from -40 degC to 150 degC.
- R25 tolerance, B25/85 tolerance, dissipation factor, thermal time constant, response time, lead conduction, mounting stress, ageing, humidity, and manufacturing spread are metadata only; no corner models are provided.
- Behaviour outside the cited environmental and electrical bounds is unsupported even though the behavioural expression returns a finite value.
- P5 independent review rejected the previous revision of this package because its shipped R0 = 9.5 kohm and BETA = 3947.1725 were fitted values, while the sensor archetype requires direct transcription of the cited 10 kohm R25 and 3977 K B25/85 facts.
- Refit 2026-08-09 in response to that rejection: R0 = 10 kohm, T0_C = 25 degC, and BETA = 3977 K are now transcribed verbatim from p. 2, the claimed region is narrowed to the cited B25/85 interval, and the benches are re-derived from the p. 10 resistance table at 25 degC, 55 degC, and 85 degC.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
