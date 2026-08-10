# BSS138PS model card

## Identity

- Manufacturer: Nexperia
- Description: 1.5V 1.6Ω@10V 2 N-Channel 320mA 420mW 50pF 60V 800pC@4.5V SOT-363(SC-88) MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588884796995489792
- Revision: Rev. 1 - 2 November 2010
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- SHA-256: `8395c7478362da1f4eb37f204c8003bc5deb8f833f6c56a32b6cc28e24081828`
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
| VTO | 1.36748042e+0 | fitted or derived |
| KP | 1.51334080e+0 | fitted or derived |
| THETA | 3.10582766e-1 | fitted or derived |
| LAMBDA | 3.93389167e-2 | fitted or derived |
| RD | 4.41570130e-1 | fitted or derived |
| RS | 2.00000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.40000000e-11 | fitted or derived |
| CGDMAX | 4.00000000e-12 | fitted or derived |
| CGDMIN | 4.00000000e-12 | fitted or derived |
| CJO | 3.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.00000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current at VGS 1.5 V | 2.500000e-2 | 2.353827e-2 | A | 5.847% | 8 |
| transfer current at VGS 1.6 V | 4.900000e-2 | 5.313642e-2 | A | 8.442% | 8 |
| transfer current at VGS 1.7 V | 9.200000e-2 | 9.666639e-2 | A | 5.072% | 8 |
| transfer current at VGS 1.8 V | 1.530000e-1 | 1.524198e-1 | A | 0.379% | 8 |
| transfer current at VGS 1.9 V | 2.230000e-1 | 2.185221e-1 | A | 2.008% | 8 |
| transfer current at VGS 2 V | 3.200000e-1 | 2.934251e-1 | A | 8.305% | 8 |
| transfer current at VGS 2.1 V | 3.880000e-1 | 3.759144e-1 | A | 3.115% | 8 |
| transfer current at VGS 2.27 V | 5.300000e-1 | 5.309229e-1 | A | 0.174% | 8 |
| transfer current at VGS 2.4 V | 6.300000e-1 | 6.601276e-1 | A | 4.782% | 8 |
| transfer current at VGS 2.5 V | 7.200000e-1 | 7.649147e-1 | A | 6.238% | 8 |
| transfer current at VGS 2.6 V | 8.200000e-1 | 8.738705e-1 | A | 6.570% | 8 |
| output current at VGS 2 V, VDS 0.25 V | 1.180000e-1 | 1.169864e-1 | A | 0.859% | output characteristics |
| output current at VGS 2 V, VDS 0.5 V | 1.830000e-1 | 1.969794e-1 | A | 7.639% | output characteristics |
| output current at VGS 2 V, VDS 0.75 V | 2.080000e-1 | 2.261858e-1 | A | 8.743% | output characteristics |
| output current at VGS 2 V, VDS 1 V | 2.180000e-1 | 2.280775e-1 | A | 4.623% | output characteristics |
| output current at VGS 2 V, VDS 1.5 V | 2.290000e-1 | 2.318480e-1 | A | 1.244% | output characteristics |
| output current at VGS 2 V, VDS 2 V | 2.360000e-1 | 2.356013e-1 | A | 0.169% | output characteristics |
| output current at VGS 2 V, VDS 2.5 V | 2.400000e-1 | 2.393375e-1 | A | 0.276% | output characteristics |
| output current at VGS 2 V, VDS 3 V | 2.440000e-1 | 2.430568e-1 | A | 0.387% | output characteristics |
| output current at VGS 2 V, VDS 3.5 V | 2.490000e-1 | 2.467594e-1 | A | 0.900% | output characteristics |
| output current at VGS 2 V, VDS 3.9 V | 2.520000e-1 | 2.497094e-1 | A | 0.909% | output characteristics |
| output current at VGS 2.25 V, VDS 0.5 V | 2.720000e-1 | 2.665731e-1 | A | 1.995% | output characteristics |
| output current at VGS 2.25 V, VDS 0.75 V | 3.480000e-1 | 3.546934e-1 | A | 1.923% | output characteristics |
| output current at VGS 2.25 V, VDS 1 V | 3.860000e-1 | 3.994690e-1 | A | 3.489% | output characteristics |
| output current at VGS 2.25 V, VDS 1.25 V | 4.060000e-1 | 4.045075e-1 | A | 0.368% | output characteristics |
| output current at VGS 2.25 V, VDS 1.5 V | 4.160000e-1 | 4.077167e-1 | A | 1.991% | output characteristics |
| output current at VGS 2.25 V, VDS 2 V | 4.290000e-1 | 4.141086e-1 | A | 3.471% | output characteristics |
| output current at VGS 2.25 V, VDS 2.5 V | 4.370000e-1 | 4.204653e-1 | A | 3.784% | output characteristics |
| output current at VGS 2.25 V, VDS 3 V | 4.430000e-1 | 4.267872e-1 | A | 3.660% | output characteristics |
| output current at VGS 2.25 V, VDS 3.5 V | 4.480000e-1 | 4.330746e-1 | A | 3.332% | output characteristics |
| output current at VGS 2.25 V, VDS 3.9 V | 4.520000e-1 | 4.380799e-1 | A | 3.080% | output characteristics |
| output current at VGS 2.5 V, VDS 0.5 V | 3.290000e-1 | 3.151157e-1 | A | 4.220% | output characteristics |
| output current at VGS 2.5 V, VDS 0.75 V | 4.490000e-1 | 4.407949e-1 | A | 1.827% | output characteristics |
| output current at VGS 2.5 V, VDS 1 V | 5.340000e-1 | 5.378767e-1 | A | 0.726% | output characteristics |
| output current at VGS 2.5 V, VDS 1.25 V | 5.880000e-1 | 5.979260e-1 | A | 1.688% | output characteristics |
| output current at VGS 2.5 V, VDS 1.5 V | 6.190000e-1 | 6.130541e-1 | A | 0.961% | output characteristics |
| output current at VGS 2.5 V, VDS 1.75 V | 6.360000e-1 | 6.177492e-1 | A | 2.870% | output characteristics |
| output current at VGS 2.5 V, VDS 2 V | 6.470000e-1 | 6.224297e-1 | A | 3.798% | output characteristics |
| output current at VGS 2.5 V, VDS 2.5 V | 6.590000e-1 | 6.317470e-1 | A | 4.136% | output characteristics |
| output current at VGS 2.5 V, VDS 3 V | 6.660000e-1 | 6.410067e-1 | A | 3.753% | output characteristics |
| output current at VGS 2.5 V, VDS 3.9 V | 6.740000e-1 | 6.575306e-1 | A | 2.444% | output characteristics |
| output current at VGS 2.75 V, VDS 0.5 V | 3.660000e-1 | 3.509375e-1 | A | 4.115% | output characteristics |
| output current at VGS 2.75 V, VDS 0.75 V | 5.120000e-1 | 5.026315e-1 | A | 1.830% | output characteristics |
| output current at VGS 2.75 V, VDS 1 V | 6.320000e-1 | 6.339511e-1 | A | 0.309% | output characteristics |
| output current at VGS 2.75 V, VDS 1.25 V | 7.240000e-1 | 7.400746e-1 | A | 2.220% | output characteristics |
| output current at VGS 2.75 V, VDS 1.5 V | 7.900000e-1 | 8.143388e-1 | A | 3.081% | output characteristics |
| output current at VGS 2.75 V, VDS 1.75 V | 8.340000e-1 | 8.471474e-1 | A | 1.576% | output characteristics |
| output current at VGS 2.75 V, VDS 2 V | 8.610000e-1 | 8.534617e-1 | A | 0.876% | output characteristics |
| output current at VGS 2.75 V, VDS 2.5 V | 8.870000e-1 | 8.659866e-1 | A | 2.369% | output characteristics |
| output current at VGS 2.75 V, VDS 3 V | 8.980000e-1 | 8.784269e-1 | A | 2.180% | output characteristics |
| output current at VGS 2.75 V, VDS 3.9 V | 9.040000e-1 | 9.006097e-1 | A | 0.375% | output characteristics |
| output current at VGS 3 V, VDS 0.5 V | 3.910000e-1 | 3.784825e-1 | A | 3.201% | output characteristics |
| output current at VGS 3 V, VDS 0.75 V | 5.540000e-1 | 5.492760e-1 | A | 0.853% | output characteristics |
| output current at VGS 3 V, VDS 1 V | 6.930000e-1 | 7.047744e-1 | A | 1.699% | output characteristics |
| output current at VGS 3 V, VDS 1.25 V | 8.080000e-1 | 8.419476e-1 | A | 4.201% | output characteristics |
| output current at VGS 3 V, VDS 1.5 V | 9.030000e-1 | 9.568314e-1 | A | 5.961% | output characteristics |
| output current at VGS 3 V, VDS 1.75 V | 9.760000e-1 | 1.044098e+0 | A | 6.977% | output characteristics |
| output current at VGS 3.5 V, VDS 0.5 V | 4.240000e-1 | 4.180978e-1 | A | 1.392% | output characteristics |
| output current at VGS 3.5 V, VDS 0.75 V | 6.060000e-1 | 6.150765e-1 | A | 1.498% | output characteristics |
| output current at VGS 3.5 V, VDS 1 V | 7.640000e-1 | 8.024851e-1 | A | 5.037% | output characteristics |
| output current at VGS 3.5 V, VDS 1.25 V | 9.010000e-1 | 9.788854e-1 | A | 8.644% | output characteristics |
| RDS(on) at VGS 5 V | 1.000000e+0 | 1.029957e+0 | ohm | 2.996% | electrical characteristics table |
| RDS(on) at VGS 5 V | 2.000000e+0 | 1.029957e+0 | ohm | 0.000% | electrical characteristics table |
| RDS(on) at VGS 10 V | 9.000000e-1 | 9.243425e-1 | ohm | 2.705% | electrical characteristics table |
| RDS(on) at VGS 10 V | 1.600000e+0 | 9.243425e-1 | ohm | 0.000% | electrical characteristics table |
| RDS(on) at VGS 2.5 V | 1.520000e+0 | 1.576089e+0 | ohm | 3.690% | electrical characteristics table |
| RDS(on) at VGS 3 V | 1.280000e+0 | 1.304019e+0 | ohm | 1.876% | electrical characteristics table |

Worst fitting error: 8.743% for output current at VGS 2 V, VDS 0.75 V.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.891e-10 and worst absolute delta was 2.276e-10.


F2 curve-fit fidelity is supported only for the selected 25 degC DC transfer and output curves over their exact sampled VGS, VDS, and ID spans: transfer_characteristics_25C (8); output_characteristics_vgs_2.0V (7); output_characteristics_vgs_2.25V (7); output_characteristics_vgs_2.5V (7); output_characteristics_vgs_2.75V (7); output_characteristics_vgs_3.0V (7); output_characteristics_vgs_3.5V (7). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Threshold, body-diode, capacitance, switching, thermal, SOA, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
