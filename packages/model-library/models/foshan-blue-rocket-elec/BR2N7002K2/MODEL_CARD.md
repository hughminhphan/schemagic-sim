# BR2N7002K2 model card

## Identity

- Manufacturer: Foshan Blue Rocket Elec
- Description: 1 N-channel 2.5V 2.7Ω@5V 300mA 350mW 50pF 5pF 60V N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588884459952857088
- Revision: Rev.C Aug.-2018
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5, 6
- SHA-256: `21431124e76e6b878f5dc42721de4a03f753661e234f247582e3d5dbda044f04`
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
| KP | 1.17647059e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 9.35000000e-1 | fitted or derived |
| RS | 3.40000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.50000000e-11 | fitted or derived |
| CGDMAX | 5.00000000e-12 | fitted or derived |
| CGDMIN | 5.00000000e-12 | fitted or derived |
| CJO | 2.00000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.40000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 3.224e-16 and worst absolute delta was 2.220e-16.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
