# DSK220 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186779961253888
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `20da722d7ee5a1a0b66b37f2e138cff5e24c108e6dfe6c03b89f75fe57109826`
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
| IS | 1.74592843e-5 | fitted or derived |
| N | 2.33775689e+0 | fitted or derived |
| RS | 1.48171037e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.102011 A | 5.413100e-1 | 5.259403e-1 | V | 2.839% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 0.322843 A | 5.802900e-1 | 5.988672e-1 | V | 3.201% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 0.608843 A | 6.194300e-1 | 6.414626e-1 | V | 3.557% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 1.55706 A | 6.967200e-1 | 7.122886e-1 | V | 2.235% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 4.13431 A | 8.157700e-1 | 8.095215e-1 | V | 0.766% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 9.74291 A | 9.673300e-1 | 9.444573e-1 | V | 2.365% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 18.428 A | 1.124210e+0 | 1.111681e+0 | V | 1.114% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 26.3269 A | 1.246930e+0 | 1.250290e+0 | V | 0.269% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 35.441 A | 1.383780e+0 | 1.403310e+0 | V | 1.411% | p. 2 Fig. 3, DSK220 curve |
| forward voltage at 44.9577 A | 1.534750e+0 | 1.558702e+0 | V | 1.561% | p. 2 Fig. 3, DSK220 curve |

Worst fitting error: 3.557% for forward voltage at 0.608843 A.

Native and WASM agreement: all 21 benches passed. Worst reported relative delta was 1.403e-14 and worst absolute delta was 7.438e-15.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
