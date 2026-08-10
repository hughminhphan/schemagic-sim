# NTMFS5C430NLT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+175℃ 1 N-channel 1.4mΩ@10V 110W 144pF 200A 2V 4.942nF 40V 82nC@10V DFN5(5x6) MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588886809937907712
- Revision: May 2019 - Rev. 3, Publication Order Number NTMFS5C430NL/D
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `3b4d0a58f6a663b97d4da10e392110f3e8b280b51391ffba912242edfba24959`
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
| VTO | 2.00000000e+0 | fitted or derived |
| KP | 1.66666667e+3 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 6.60000000e-4 | fitted or derived |
| RS | 2.40000000e-4 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.22800000e-9 | fitted or derived |
| CGDMAX | 7.20000000e-11 | fitted or derived |
| CGDMIN | 7.20000000e-11 | fitted or derived |
| CJO | 1.82800000e-9 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.40000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 2.465e-23 and worst absolute delta was 2.465e-32.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: KP saturated its bound at 1000; the residual is a constraint artefact; drain_current worst relative error 0.4698 exceeds gate 0.2; drain_current RMS relative error 0.2155 exceeds gate 0.12
- The strict schema does not represent gate charge, switching, reverse-recovery, thermal, leakage, or safe-operating-area fields. Published output, transfer, and capacitance curves were available and recorded.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
