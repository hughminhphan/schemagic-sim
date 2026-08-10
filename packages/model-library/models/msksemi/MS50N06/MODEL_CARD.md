# MS50N06 model card

## Identity

- Manufacturer: MSKSEMI
- Description: 1 N-channel 1.68nF 1.6V 115pF 12mΩ@10V 28nC@10V 50A 60V 65W 85pF N-Channel TO-252-2 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757890263857537024
- Revision: No revision stated
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `607354428ed9acdbb8e4a75b6a0bf847d0c32f5321d360bf97e14dc8f2f2acea`
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
| VTO | 1.60000000e+0 | fitted or derived |
| KP | 1.38888889e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 7.92000000e-3 | fitted or derived |
| RS | 2.88000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.02000000e-9 | fitted or derived |
| CGDMAX | 8.00000000e-11 | fitted or derived |
| CGDMIN | 8.00000000e-11 | fitted or derived |
| CJO | 8.50000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.88000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 2.088e-16 and worst absolute delta was 2.776e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: No usable transfer, output, or capacitance curves are present in the supplied PDF; only tabulated electrical characteristics and unrelated thermal, gate-charge, switching, and safe-operating-area figures are available.
- No usable transfer, output, or capacitance curves are present in the supplied PDF; only tabulated electrical characteristics and unrelated thermal, gate-charge, switching, and safe-operating-area figures are available.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
