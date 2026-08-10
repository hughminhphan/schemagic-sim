# SS320F model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602885746160386048
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `6e25dd5f1ade6ca07c36871eb9e57aac7496349766c2edec3ac53f8ba13c027b`
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
| IS | 2.05103291e-5 | fitted or derived |
| N | 2.70064768e+0 | fitted or derived |
| RS | 1.18593481e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 6.000000e-1 | 5.943835e-1 | V | 0.936% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 0.58 A | 7.000000e-1 | 7.228540e-1 | V | 3.265% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 1.8 A | 8.000000e-1 | 8.164292e-1 | V | 2.054% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 4.3 A | 9.000000e-1 | 9.069062e-1 | V | 0.767% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 7.5 A | 1.000000e+0 | 9.837138e-1 | V | 1.629% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 13 A | 1.100000e+0 | 1.087362e+0 | V | 1.149% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 20 A | 1.200000e+0 | 1.200468e+0 | V | 0.039% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 28 A | 1.300000e+0 | 1.318846e+0 | V | 1.450% | p. 2, Fig. 3, SS315F-SS320F curve |
| forward voltage at 35 A | 1.400000e+0 | 1.417449e+0 | V | 1.246% | p. 2, Fig. 3, SS315F-SS320F curve |

Worst fitting error: 3.265% for forward voltage at 0.58 A.

Native and WASM agreement: all 19 benches passed. Worst reported relative delta was 8.535e-15 and worst absolute delta was 5.107e-15.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
