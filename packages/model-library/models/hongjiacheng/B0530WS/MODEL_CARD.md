# B0530WS model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602990819196751872
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e820f20f3c2a9ea5e6f5e6e778f4247ede3eef5cd48350c6efc41f5a1211f78f`
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
| IS | 4.42033073e-6 | fitted or derived |
| N | 1.09555228e+0 | fitted or derived |
| RS | 8.81352331e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.021 A | 2.410000e-1 | 2.417543e-1 | V | 0.313% | p. 2, Fig. 1 |
| forward voltage at 0.027 A | 2.470000e-1 | 2.494031e-1 | V | 0.973% | p. 2, Fig. 1 |
| forward voltage at 0.037 A | 2.570000e-1 | 2.592115e-1 | V | 0.860% | p. 2, Fig. 1 |
| forward voltage at 0.047 A | 2.650000e-1 | 2.668710e-1 | V | 0.706% | p. 2, Fig. 1 |
| forward voltage at 0.062 A | 2.740000e-1 | 2.760412e-1 | V | 0.745% | p. 2, Fig. 1 |
| forward voltage at 0.083 A | 2.850000e-1 | 2.861574e-1 | V | 0.406% | p. 2, Fig. 1 |
| forward voltage at 0.13 A | 3.020000e-1 | 3.030136e-1 | V | 0.336% | p. 2, Fig. 1 |
| forward voltage at 0.23 A | 3.240000e-1 | 3.279938e-1 | V | 1.233% | p. 2, Fig. 1 |
| forward voltage at 0.37 A | 3.540000e-1 | 3.538044e-1 | V | 0.055% | p. 2, Fig. 1 |
| forward voltage at 0.55 A | 3.780000e-1 | 3.809016e-1 | V | 0.768% | p. 2, Fig. 1 |
| forward voltage at 0.75 A | 4.030000e-1 | 4.073172e-1 | V | 1.071% | p. 2, Fig. 1 |
| forward voltage at 0.9 A | 4.250000e-1 | 4.257038e-1 | V | 0.166% | p. 2, Fig. 1 |

Worst fitting error: 1.233% for forward voltage at 0.23 A.

Native and WASM agreement: all 15 benches passed. Worst reported relative delta was 1.737e-15 and worst absolute delta was 4.441e-16.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
