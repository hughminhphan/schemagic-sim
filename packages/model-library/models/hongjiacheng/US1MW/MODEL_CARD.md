# US1MW model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603080471161024512
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `6ae8bc6313d65420343f4f8cace46b6ab54276ccdce67afda8a038ca5006a523`
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
| IS | 1.04533995e-8 | fitted or derived |
| N | 3.01320546e+0 | fitted or derived |
| RS | 1.93172525e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 1.250000e+0 | 1.254661e+0 | V | 0.373% | p. 2, Fig. 3 |
| forward voltage at 0.5 A | 1.370000e+0 | 1.387821e+0 | V | 1.301% | p. 2, Fig. 3 |
| forward voltage at 1 A | 1.440000e+0 | 1.451501e+0 | V | 0.799% | p. 2, Fig. 3 |
| forward voltage at 2 A | 1.520000e+0 | 1.524840e+0 | V | 0.318% | p. 2, Fig. 3 |
| forward voltage at 5 A | 1.650000e+0 | 1.654204e+0 | V | 0.255% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.790000e+0 | 1.804812e+0 | V | 0.827% | p. 2, Fig. 3 |

Worst fitting error: 1.301% for forward voltage at 0.5 A.

Native and WASM agreement: all 14 benches passed. Worst reported relative delta was 8.675e-15 and worst absolute delta was 1.088e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
