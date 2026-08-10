# BAT43WS model card

## Identity

- Manufacturer: hongjiacheng
- Description: 1V@0.2A 200mA 30V 4A 500nA Independent SOD-323 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590908338140508160
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3
- SHA-256: `43a875db6515e55e4ab811ceb70a624e6febdd51a2a05de01e7194d90f4db7cc`
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
| IS | 2.36174464e-16 | fitted or derived |
| N | 1.10000000e+0 | fitted or derived |
| RS | 1.00000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 4.291e-14 and worst absolute delta was 4.197e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for BAT43WS. See validation-results.json; failed package checks: forward_voltage_maximum_at_0.2_a observed 1.428784079604214 (maximum 1), forward_voltage_maximum_at_0.002_a observed 0.3605758645478196 (maximum 0.33), forward_voltage_maximum_at_0.015_a observed 0.4804350021533747 (maximum 0.45)
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
