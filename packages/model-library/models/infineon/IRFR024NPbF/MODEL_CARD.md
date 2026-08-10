# IRFR024NPbF model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+175℃ 1 N-channel 17A 20nC 370pF 45W 4V 55V 65pF 75mΩ@10V N-Channel DPAK(TO-252AA) MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8579710818147094528
- Revision: PD-95066A, 12/14/04
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4
- SHA-256: `798ada4821ec671c98f95a04106573d04c7da34efda67ad6ffe309aecbfd3d2e`
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
| KP | 2.96296296e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.71250000e-2 | fitted or derived |
| RS | 1.35000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.05000000e-10 | fitted or derived |
| CGDMAX | 6.50000000e-11 | fitted or derived |
| CGDMIN | 6.50000000e-11 | fitted or derived |
| CJO | 7.50000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.35000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.970e-16 and worst absolute delta was 1.110e-16.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
