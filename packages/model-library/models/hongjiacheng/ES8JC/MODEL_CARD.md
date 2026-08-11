# ES8JC model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925648763494400
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `f070663f640e778703b2ff792b7984f48fa7d8fd155488386a3663f350728058`
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
| IS | 4.63154755e-11 | fitted or derived |
| N | 1.70646182e+0 | fitted or derived |
| RS | 1.19271026e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 8.500000e-1 | 8.471343e-1 | V | 0.337% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 9.200000e-1 | 9.498381e-1 | V | 3.243% | p. 2, Fig. 3 |
| forward voltage at 1 A | 1.080000e+0 | 1.062203e+0 | V | 1.648% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.250000e+0 | 1.271177e+0 | V | 1.694% | p. 2, Fig. 3 |
| forward voltage at 20 A | 1.420000e+0 | 1.421042e+0 | V | 0.073% | p. 2, Fig. 3 |

Worst fitting error: 3.243% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 6.078e-14 and worst absolute delta was 5.163e-14.163e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
