# LP2305DSLT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 P-Channel 1.1W 1.245nF 12V 210pF 375pF 4A 68mΩ@4.5V 800mV P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586189462162313216
- Revision: Rev. A
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `4685ffcba743976a5f1b2dc2c008d7bd19949710e2d35e7e4dad8bdb3adad4db`
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
| VTO | 9.05008831e-1 | fitted or derived |
| KP | 3.82309448e+1 | fitted or derived |
| THETA | 8.09375578e-11 | fitted or derived |
| LAMBDA | 9.67869216e-13 | fitted or derived |
| RD | 4.69684959e-2 | fitted or derived |
| RS | 1.36000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.03500000e-9 | fitted or derived |
| CGDMAX | 2.10000000e-10 | fitted or derived |
| CGDMIN | 2.10000000e-10 | fitted or derived |
| CJO | 1.65000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.36000000e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| VTO | 9.05008831e-1 | undefined | strong-inversion extrapolated threshold sits 0.105 V above the published VGS(th) maximum of 0.8 V, within the 0.24 V extrapolation margin; VGS(th) is measured at a small drain current and is not the square-law VTO |
| THETA | 8.09375578e-11 | undefined | no mobility degradation is resolvable from the digitised transfer range |
| LAMBDA | 9.67869216e-13 | undefined | no channel-length modulation is resolvable from the digitised output range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current at VGS 1 V | 3.000000e-1 | 2.976609e-1 | A | 0.780% | p. 3, Fig. 1 Transfer Characteristics |
| transfer current at VGS 1.2 V | 1.500000e+0 | 1.506475e+0 | A | 0.432% | p. 3, Fig. 1 Transfer Characteristics |
| transfer current at VGS 1.5 V | 5.000000e+0 | 5.250860e+0 | A | 5.017% | p. 3, Fig. 1 Transfer Characteristics |
| transfer current at VGS 1.8 V | 1.100000e+1 | 1.072799e+1 | A | 2.473% | p. 3, Fig. 1 Transfer Characteristics |
| transfer current at VGS 2 V | 1.550000e+1 | 1.512002e+1 | A | 2.451% | p. 3, Fig. 1 Transfer Characteristics |
| RDS(on) at VGS 4.5 V | 6.800000e-2 | 6.796905e-2 | ohm | 0.000% | electrical characteristics table |
| RDS(on) at VGS 2.5 V | 8.100000e-2 | 7.768098e-2 | ohm | 0.000% | electrical characteristics table |
| RDS(on) at VGS 1.8 V | 1.180000e-1 | 9.183635e-2 | ohm | 0.000% | electrical characteristics table |

Worst fitting error: 5.017% for transfer current at VGS 1.5 V.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 4.441e-04 and worst absolute delta was 7.418e-11.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
