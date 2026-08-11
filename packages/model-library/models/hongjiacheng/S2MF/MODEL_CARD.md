# S2MF model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925618086490112
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `235bfc5042bf378f6c8f8e0eabaf84be825d49c13422a3b0d31fee9e33b57950`
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
| IS | 7.68406271e-7 | fitted or derived |
| N | 2.36313389e+0 | fitted or derived |
| RS | 2.25647141e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 5.800000e-1 | 5.792890e-1 | V | 0.123% | p. 2 Fig.3 |
| forward voltage at 0.03 A | 6.400000e-1 | 6.468869e-1 | V | 1.076% | p. 2 Fig.3 |
| forward voltage at 0.1 A | 7.100000e-1 | 7.220548e-1 | V | 1.698% | p. 2 Fig.3 |
| forward voltage at 0.3 A | 7.900000e-1 | 7.937171e-1 | V | 0.471% | p. 2 Fig.3 |
| forward voltage at 1 A | 8.700000e-1 | 8.831019e-1 | V | 1.506% | p. 2 Fig.3 |
| forward voltage at 2 A | 9.500000e-1 | 9.480333e-1 | V | 0.207% | p. 2 Fig.3 |
| forward voltage at 5 A | 1.080000e+0 | 1.071733e+0 | V | 0.765% | p. 2 Fig.3 |
| forward voltage at 10 A | 1.210000e+0 | 1.226923e+0 | V | 1.399% | p. 2 Fig.3 |

Worst fitting error: 1.698% for forward voltage at 0.1 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 6.604e-14 and worst absolute delta was 3.852e-14.852e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
