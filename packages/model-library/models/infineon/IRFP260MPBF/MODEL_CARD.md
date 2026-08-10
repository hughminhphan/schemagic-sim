# IRFP260MPBF model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+175℃ 1 N-channel 200V 234nC@10V 300W 4.057nF 4.057nF 40mΩ@10V 4V 50A 603pF N-Channel TO-247AC MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588887162099654656
- Revision: PD-96293; 03/01/10
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `dd921441b9a9c633874eeb7642180ec077cb574988a0ab6f1e2c9d8039a58583`
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
| VTO | 4.00000000e+0 | fitted or derived |
| KP | 5.55555556e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.98000000e-2 | fitted or derived |
| RS | 7.20000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.89600000e-9 | fitted or derived |
| CGDMAX | 1.61000000e-10 | fitted or derived |
| CGDMIN | 1.61000000e-10 | fitted or derived |
| CJO | 4.42000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 7.20000000e-3 | fitted or derived |

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
- F2 evidence did not qualify; staged as F1: cross-validation failed after one retry: vdmos.coss: catalog '4.057nF' disagrees with extracted [6.03e-10]; closest ratio 6.73x; vdmos.crss: catalog '603pF' disagrees with extracted [1.61e-10]; closest ratio 3.75x
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
