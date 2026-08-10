# CJ3139K model card

## Identity

- Manufacturer: Jiangsu Changjing Electronics Technology Co Ltd
- Description: -55℃~+150℃ 1 P-Channel 150mW 15pF 170pF 20V 350mV 520mΩ@4.5V 660mA SOT-723 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586202711444901888
- Revision: H, Aug 2015
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `857efdd0157336e9f6d414702e11a656f33f84396721129aa6e1b28722c6ac1e`
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
| VTO | 5.97650059e-1 | fitted or derived |
| KP | 2.04943959e+0 | fitted or derived |
| THETA | 4.70651775e-1 | fitted or derived |
| LAMBDA | 2.05377729e-2 | fitted or derived |
| RD | 1.00267082e-6 | fitted or derived |
| RS | 8.60000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.04000000e-10 | fitted or derived |
| CGDMAX | 9.00000000e-12 | fitted or derived |
| CGDMIN | 9.00000000e-12 | fitted or derived |
| CJO | 6.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 8.60000000e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RD | 1.00267082e-6 | undefined | no drain resistance separable from the source resistance at these bias points |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current at VGS 0.8 V | 5.000000e-2 | 5.027832e-2 | A | 0.557% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| transfer current at VGS 1 V | 1.500000e-1 | 1.593348e-1 | A | 6.223% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| transfer current at VGS 1.2 V | 3.500000e-1 | 3.213221e-1 | A | 8.194% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| transfer current at VGS 1.5 V | 7.000000e-1 | 6.340563e-1 | A | 9.421% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| transfer current at VGS 2 V | 1.300000e+0 | 1.280174e+0 | A | 1.525% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| transfer current at VGS 2.5 V | 2.000000e+0 | 2.027864e+0 | A | 1.393% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| transfer current at VGS 3 V | 2.500000e+0 | 2.841762e+0 | A | 13.670% | p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace |
| RDS(on) at VGS 4.5 V | 4.300000e-1 | 4.590162e-1 | ohm | 6.748% | electrical characteristics table |
| RDS(on) at VGS 2.5 V | 6.240000e-1 | 6.455552e-1 | ohm | 3.454% | electrical characteristics table |
| RDS(on) at VGS 1.8 V | 9.500000e-1 | 8.608554e-1 | ohm | 9.384% | electrical characteristics table |

Worst fitting error: 13.670% for transfer current at VGS 3 V.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 4.441e-04 and worst absolute delta was 3.100e-09.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
