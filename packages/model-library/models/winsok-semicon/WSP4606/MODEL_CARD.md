# WSP4606 model card

## Identity

- Manufacturer: Winsok Semicon
- Description: -55℃~+150℃ 1 N-Channel + 1 P-Channel 1.5V 18mΩ@10V 2.08W、2.5W 30V 550pF 55pF 68pF、272pF 6A、7A 7.2nC@4.5V N-Channel + P-Channel SOP-8 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586176989716238336
- Revision: Dec.2014
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `5e88037c1fac0b17dae1e5460e1da720aa61381df7ff4d2b6d6796a54f382f8e`
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
| VTO | 1.50000000e+0 | fitted or derived |
| KP | 1.11111111e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 9.90000000e-3 | fitted or derived |
| RS | 3.60000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.95000000e-10 | fitted or derived |
| CGDMAX | 5.50000000e-11 | fitted or derived |
| CGDMIN | 5.50000000e-11 | fitted or derived |
| CJO | 1.30000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.60000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 3.944e-22 and worst absolute delta was 3.944e-31.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- The datasheet publishes no transfer ID-versus-VGS curve and no body-diode reverse-recovery time. The part contains both N-channel and P-channel devices, while this schema provides only one polarity slot; P-channel values are retained in extraction_notes.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
