# DSK38 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186980939583488
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e39eda5ed17f31ea54b97ae7a6626b4269b0cdab5fbf29cece112017a075e41b`
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
| IS | 1.43761050e-5 | fitted or derived |
| N | 2.00981181e+0 | fitted or derived |
| RS | 3.19054808e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.924 A | 6.000000e-1 | 6.049869e-1 | V | 0.831% | p. 2, Fig. 3 |
| forward voltage at 4.4 A | 8.000000e-1 | 7.970178e-1 | V | 0.373% | p. 2, Fig. 3 |
| forward voltage at 9.81 A | 1.000000e+0 | 1.011307e+0 | V | 1.131% | p. 2, Fig. 3 |
| forward voltage at 15.6 A | 1.200000e+0 | 1.220153e+0 | V | 1.679% | p. 2, Fig. 3 |
| forward voltage at 20.4 A | 1.400000e+0 | 1.387245e+0 | V | 0.911% | p. 2, Fig. 3 |

Worst fitting error: 1.679% for forward voltage at 15.6 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 2.774e-16 and worst absolute delta was 2.220e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-recovery specification or breakdown characterization is provided. The 80 V VRRM/VDC ratings are maximum reverse-voltage limits, not breakdown data, so breakdown voltage and breakdown current are omitted.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
