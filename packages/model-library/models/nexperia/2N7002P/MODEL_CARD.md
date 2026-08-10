# 2N7002P model card

## Identity

- Manufacturer: Nexperia
- Description: -55℃~+150℃ 1 N-channel 1.6Ω@10V 2.4V 350mW 360mA 50pF 60V 800pC@4.5V SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586176229070684160
- Revision: Rev. 02 - 29 July 2010
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `e46f90824a350be0ec3fcfea619b388a736ddec3c986561a8819fa07b987a767`
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
| VTO | 2.19267893e+0 | fitted or derived |
| KP | 1.23374216e+0 | fitted or derived |
| THETA | 4.89758858e-1 | fitted or derived |
| LAMBDA | 7.54036711e-2 | fitted or derived |
| RD | 2.26904435e-1 | fitted or derived |
| RS | 2.60000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.60000000e-11 | fitted or derived |
| CGDMAX | 4.00000000e-12 | fitted or derived |
| CGDMIN | 4.00000000e-12 | fitted or derived |
| CJO | 3.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.60000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current at VGS 2.5 V | 8.000000e-2 | 8.071112e-2 | A | 0.889% | p. 7 Fig. 10, typical curve, manually digitized grid reads |
| transfer current at VGS 2.75 V | 2.200000e-1 | 2.174862e-1 | A | 1.143% | p. 7 Fig. 10, typical curve, manually digitized grid reads |
| transfer current at VGS 3 V | 4.000000e-1 | 3.959349e-1 | A | 1.016% | p. 7 Fig. 10, typical curve, manually digitized grid reads |
| transfer current at VGS 3.25 V | 6.000000e-1 | 6.016630e-1 | A | 0.277% | p. 7 Fig. 10, typical curve, manually digitized grid reads |
| transfer current at VGS 3.5 V | 8.000000e-1 | 8.266199e-1 | A | 3.327% | p. 7 Fig. 10, typical curve, manually digitized grid reads |
| output current at VGS 3 V, VDS 0.5 V | 1.900000e-1 | 2.056242e-1 | A | 8.223% | output characteristics |
| output current at VGS 3 V, VDS 1 V | 2.600000e-1 | 2.635386e-1 | A | 1.361% | output characteristics |
| output current at VGS 3 V, VDS 2 V | 3.000000e-1 | 2.793300e-1 | A | 6.890% | output characteristics |
| output current at VGS 3 V, VDS 4 V | 3.100000e-1 | 3.100513e-1 | A | 0.017% | output characteristics |
| output current at VGS 3.5 V, VDS 0.5 V | 2.900000e-1 | 2.960502e-1 | A | 2.086% | output characteristics |
| output current at VGS 3.5 V, VDS 1 V | 4.700000e-1 | 5.000310e-1 | A | 6.390% | output characteristics |
| output current at VGS 3.5 V, VDS 2 V | 6.000000e-1 | 5.920799e-1 | A | 1.320% | output characteristics |
| output current at VGS 3.5 V, VDS 4 V | 6.600000e-1 | 6.545510e-1 | A | 0.826% | output characteristics |
| output current at VGS 4 V, VDS 0.25 V | 2.000000e-1 | 1.818431e-1 | A | 9.078% | output characteristics |
| output current at VGS 4 V, VDS 0.5 V | 3.800000e-1 | 3.508482e-1 | A | 7.672% | output characteristics |
| output current at VGS 4 V, VDS 0.75 V | 5.200000e-1 | 5.049129e-1 | A | 2.901% | output characteristics |
| output current at VGS 4 V, VDS 1 V | 6.400000e-1 | 6.415861e-1 | A | 0.248% | output characteristics |
| RDS(on) at VGS 5 V | 1.300000e+0 | 1.176414e+0 | ohm | 9.507% | electrical characteristics table |
| RDS(on) at VGS 10 V | 1.000000e+0 | 9.883137e-1 | ohm | 1.169% | electrical characteristics table |

Worst fitting error: 9.507% for RDS(on) at VGS 5 V.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 9.706e-11 and worst absolute delta was 1.974e-10.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
