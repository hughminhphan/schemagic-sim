# SS34 model card

## Identity

- Manufacturer: hongjiacheng
- Description: 200uA@40V 3A 40V 550mV@3A Independent SMA(DO-214AC) Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905115182112768
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `6f4e0d4eb66ab3b0f99d80b337bfad75a949c03badc693dac1238d5961458d77`
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
| IS | 1.50144685e-8 | fitted or derived |
| N | 1.10000000e+0 | fitted or derived |
| RS | 1.00000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 4.060e-16 and worst absolute delta was 2.220e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: F2 failed: Validation failed for SS34. See validation-results.json; failed package checks: forward_voltage_maximum_at_2.8499999999999996_a observed 0.5533552950039178 (maximum 0.55); F1 failed: Validation failed for SS34. See validation-results.json; failed package checks: forward_voltage_maximum_at_2.8499999999999996_a observed 0.5533552950039178 (maximum 0.55); family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (diode F2 gate failed: forward_voltage worst relative error 0.0538 exceeds gate 0.05)
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
