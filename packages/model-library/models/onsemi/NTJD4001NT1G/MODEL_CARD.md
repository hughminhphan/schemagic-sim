# NTJD4001NT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1.3nC@5V 1.5V 12pF 2 N-Channel 2.5Ω@2.5V 250mA 272mW 30V 32pF 88pF N-Channel SOT-363 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586204812145012736
- Revision: Publication Order Number NTJD4001N/D, May 2019 Rev. 7
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `74a68128b1d28ab72e505fbdac3699bcc1b81879d58fbcd425556ef8c7b3efce`
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
| VTO | 1.20000000e+0 | fitted or derived |
| KP | 2.00000000e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 5.50000000e-1 | fitted or derived |
| RS | 2.00000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.27500000e-11 | fitted or derived |
| CGDMAX | 7.25000000e-12 | fitted or derived |
| CGDMIN | 7.25000000e-12 | fitted or derived |
| CJO | 1.17500000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.00000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 0.000e+00 and worst absolute delta was 0.000e+00.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 1.5901 exceeds gate 0.2; drain_current RMS relative error 0.4807 exceeds gate 0.12; rds_on worst relative error 1.2348 exceeds gate 0.2; rds_on RMS relative error 0.9905 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
