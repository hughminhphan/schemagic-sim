# NTCLE100E3103JB0 model card

## Identity

- Manufacturer: Vishay BCcomponents
- Description: 10 kohm radial-leaded NTC thermistor, 5 percent R25 tolerance
- Electrical family: other
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5, rejected)

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
| R0 | 9.50000000e+3 | native fitted within R25 tolerance |
| T0_C | 2.50000000e+1 | direct transcription |
| BETA | 3.94717250e+3 | native fitted within published B25/85 tolerance |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| resistance at -40 degC | 3.320940e+5 | 3.807587e+5 | ohm | 14.654% | p. 10 NTCLE100E3103 resistance column |
| resistance at 25 degC | 1.000000e+4 | 9.500000e+3 | ohm | 5.000% | p. 10 NTCLE100E3103 resistance column |
| resistance at 85 degC | 1.070000e+3 | 1.033979e+3 | ohm | 3.366% | p. 10 NTCLE100E3103 resistance column |

Worst fitting error: 14.654% for resistance at -40 degC.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- TEMP_C is caller supplied and self-heating is not simulated.
- A single B-parameter law does not reproduce the full manufacturer polynomial even within the -40 degC to 85 degC interval; the worst table residual is about 15 percent, so the package is capped at F1 and the resistance checks use a documented 16 percent tolerance.
- R25 and B tolerance, dissipation factor, thermal time constant, lead conduction, ageing, and humidity effects are metadata only.
- P5 independent review rejected this package: shipped R0=9.5 kohm and BETA=3947.1725 are fitted values, but the sensor archetype requires direct transcription of the cited 10 kohm R25 and 3977 K B25/85 facts.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
