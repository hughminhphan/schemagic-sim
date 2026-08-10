# BSS83P model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+150℃ 1 P-Channel 24pF 2V 3.57nC@10V 330mA 360mW 3Ω@4.5V 60V 78pF 9pF P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588954671637938176
- Revision: Rev. 1.6, 2014-07-07
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5, 6, 7, 8
- SHA-256: `96d66c574916a32d12106311d7546b18037eddbe6cf4220c161ad6274a149b15`
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
| VTO | 1.82780342e+0 | fitted or derived |
| KP | 5.28820150e-1 | fitted or derived |
| THETA | 7.52659269e-2 | fitted or derived |
| LAMBDA | 1.51716127e-12 | fitted or derived |
| RD | 3.79677824e-1 | fitted or derived |
| RS | 4.00000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 5.50000000e-11 | fitted or derived |
| CGDMAX | 7.00000000e-12 | fitted or derived |
| CGDMIN | 7.00000000e-12 | fitted or derived |
| CJO | 1.20000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 4.00000000e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 1.51716127e-12 | undefined | no channel-length modulation is resolvable from the digitised output range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transfer current at VGS 2 V | 1.000000e-2 | 8.993660e-3 | A | 10.063% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 2.5 V | 9.000000e-2 | 1.008312e-1 | A | 12.035% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 2.75 V | 1.700000e-1 | 1.796895e-1 | A | 5.700% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 3 V | 2.850000e-1 | 2.760334e-1 | A | 3.146% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 3.25 V | 3.900000e-1 | 3.875947e-1 | A | 0.617% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 3.5 V | 5.200000e-1 | 5.125649e-1 | A | 1.430% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 3.75 V | 6.600000e-1 | 6.494637e-1 | A | 1.596% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 4 V | 8.000000e-1 | 7.970596e-1 | A | 0.368% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| transfer current at VGS 4.4 V | 1.020000e+0 | 1.052932e+0 | A | 3.229% | p. 6, 'Typ. transfer characteristics ID = f(VGS)' |
| output current at VGS 2.5 V, VDS 0.5 V | 8.500000e-2 | 9.121862e-2 | A | 7.316% | output characteristics |
| output current at VGS 2.5 V, VDS 1 V | 9.200000e-2 | 1.008312e-1 | A | 9.599% | output characteristics |
| output current at VGS 2.5 V, VDS 2 V | 9.300000e-2 | 1.008312e-1 | A | 8.421% | output characteristics |
| output current at VGS 2.5 V, VDS 3.5 V | 9.300000e-2 | 1.008312e-1 | A | 8.421% | output characteristics |
| output current at VGS 3 V, VDS 0.5 V | 1.900000e-1 | 1.663930e-1 | A | 12.425% | output characteristics |
| output current at VGS 3 V, VDS 1 V | 2.450000e-1 | 2.610309e-1 | A | 6.543% | output characteristics |
| output current at VGS 3 V, VDS 1.5 V | 2.720000e-1 | 2.760334e-1 | A | 1.483% | output characteristics |
| output current at VGS 3 V, VDS 2.5 V | 2.760000e-1 | 2.760334e-1 | A | 0.012% | output characteristics |
| output current at VGS 3 V, VDS 4 V | 2.770000e-1 | 2.760334e-1 | A | 0.349% | output characteristics |
| output current at VGS 3.5 V, VDS 0.5 V | 2.600000e-1 | 2.202460e-1 | A | 15.290% | output characteristics |
| output current at VGS 3.5 V, VDS 1 V | 4.000000e-1 | 3.871200e-1 | A | 3.220% | output characteristics |
| output current at VGS 3.5 V, VDS 1.5 V | 4.900000e-1 | 4.885244e-1 | A | 0.301% | output characteristics |
| output current at VGS 3.5 V, VDS 2 V | 5.250000e-1 | 5.125649e-1 | A | 2.369% | output characteristics |
| output current at VGS 3.5 V, VDS 3 V | 5.300000e-1 | 5.125649e-1 | A | 3.290% | output characteristics |
| output current at VGS 3.5 V, VDS 4 V | 5.300000e-1 | 5.125649e-1 | A | 3.290% | output characteristics |
| output current at VGS 4 V, VDS 0.4 V | 2.150000e-1 | 2.115985e-1 | A | 1.582% | output characteristics |
| output current at VGS 4 V, VDS 0.8 V | 4.300000e-1 | 3.977726e-1 | A | 7.495% | output characteristics |
| output current at VGS 4 V, VDS 1.27 V | 6.900000e-1 | 5.786017e-1 | A | 16.145% | output characteristics |
| RDS(on) at VGS 4.5 V | 2.000000e+0 | 1.704499e+0 | ohm | 14.775% | electrical characteristics table |
| RDS(on) at VGS 4.5 V | 3.000000e+0 | 1.704499e+0 | ohm | 0.000% | electrical characteristics table |
| RDS(on) at VGS 10 V | 1.400000e+0 | 1.160170e+0 | ohm | 17.131% | electrical characteristics table |
| RDS(on) at VGS 10 V | 2.000000e+0 | 1.160170e+0 | ohm | 0.000% | electrical characteristics table |

Worst fitting error: 17.131% for RDS(on) at VGS 10 V.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.404e-10 and worst absolute delta was 2.332e-10.


F2 curve-fit fidelity is supported only for the selected 25 degC DC transfer and output curves over their exact sampled VGS, VDS, and ID spans: transfer_characteristics_typ_25C (p. 6, 'Typ. transfer characteristics ID = f(VGS)'); output_characteristics_vgs_2p5_typ_25C (p. 6, 'Typ. output characteristic ID = f(VDS)', curve a); output_characteristics_vgs_3p0_typ_25C (p. 6, 'Typ. output characteristic ID = f(VDS)', curve b); output_characteristics_vgs_3p5_typ_25C (p. 6, 'Typ. output characteristic ID = f(VDS)', curve c); output_characteristics_vgs_4p0_triode_typ_25C (p. 6, 'Typ. output characteristic ID = f(VDS)', curve d). The source curves are pulsed and do not establish continuous-current fidelity. Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Threshold, body-diode, capacitance, switching, thermal, SOA, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
