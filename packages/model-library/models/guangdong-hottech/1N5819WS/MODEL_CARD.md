# 1N5819WS model card

## Identity

- Manufacturer: Guangdong Hottech
- Description: 1 Independent 1A 25A 40V 500uA@40V 600mV@1A SOD-323 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8550723919347523584
- Revision: Rev. not stated
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `609a5bc2fcd5bbb36f47f802b11102f1e140eae519c74b067cb615b4d52d0a4f`
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
| IS | 9.13597737e-5 | fitted or derived |
| N | 1.83755412e+0 | fitted or derived |
| RS | 4.83139628e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 2.200000e-1 | 2.240856e-1 | V | 1.857% | p. 2 Typical Characteristics |
| forward voltage at 0.03 A | 2.800000e-1 | 2.769792e-1 | V | 1.079% | p. 2 Typical Characteristics |
| forward voltage at 0.1 A | 3.400000e-1 | 3.374827e-1 | V | 0.740% | p. 2 Typical Characteristics |
| forward voltage at 0.3 A | 3.900000e-1 | 3.993317e-1 | V | 2.393% | p. 2 Typical Characteristics |
| forward voltage at 0.6 A | 4.400000e-1 | 4.467626e-1 | V | 1.537% | p. 2 Typical Characteristics |
| forward voltage at 1 A | 4.900000e-1 | 4.903639e-1 | V | 0.074% | p. 2 Typical Characteristics |
| forward voltage at 2 A | 5.700000e-1 | 5.716198e-1 | V | 0.284% | p. 2 Typical Characteristics |

Worst fitting error: 2.393% for forward voltage at 0.3 A.

Native and WASM agreement: all 13 benches passed. Worst reported relative delta was 6.472e-15 and worst absolute delta was 1.832e-15.832e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
