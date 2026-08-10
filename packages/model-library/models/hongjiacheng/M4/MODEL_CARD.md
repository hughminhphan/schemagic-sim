# M4 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603080454782132224
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `03f2b9959f3611e4c90bdf6b79de906aebb1c9c6d573ad2d462d7456f381deb7`
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
| IS | 7.68774839e-6 | fitted or derived |
| N | 3.12657336e+0 | fitted or derived |
| RS | 3.17121745e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.036644 A | 7.000000e-1 | 6.860852e-1 | V | 1.988% | p. 2 Fig. 3 |
| forward voltage at 0.0897132 A | 7.500000e-1 | 7.601654e-1 | V | 1.355% | p. 2 Fig. 3 |
| forward voltage at 0.189584 A | 8.000000e-1 | 8.238357e-1 | V | 2.979% | p. 2 Fig. 3 |
| forward voltage at 0.334787 A | 8.500000e-1 | 8.744260e-1 | V | 2.874% | p. 2 Fig. 3 |
| forward voltage at 0.528142 A | 9.000000e-1 | 9.174228e-1 | V | 1.936% | p. 2 Fig. 3 |
| forward voltage at 0.791774 A | 9.500000e-1 | 9.585272e-1 | V | 0.898% | p. 2 Fig. 3 |
| forward voltage at 1.14824 A | 1.000000e+0 | 9.998912e-1 | V | 0.011% | p. 2 Fig. 3 |
| forward voltage at 1.62319 A | 1.050000e+0 | 1.042946e+0 | V | 0.672% | p. 2 Fig. 3 |
| forward voltage at 2.24488 A | 1.100000e+0 | 1.088884e+0 | V | 1.011% | p. 2 Fig. 3 |
| forward voltage at 3.042 A | 1.150000e+0 | 1.138735e+0 | V | 0.980% | p. 2 Fig. 3 |
| forward voltage at 4.03875 A | 1.200000e+0 | 1.193264e+0 | V | 0.561% | p. 2 Fig. 3 |
| forward voltage at 5.2454 A | 1.250000e+0 | 1.252670e+0 | V | 0.214% | p. 2 Fig. 3 |
| forward voltage at 6.6406 A | 1.300000e+0 | 1.315987e+0 | V | 1.230% | p. 2 Fig. 3 |
| forward voltage at 8.13669 A | 1.350000e+0 | 1.379863e+0 | V | 2.212% | p. 2 Fig. 3 |

Worst fitting error: 2.979% for forward voltage at 0.189584 A.

Native and WASM agreement: all 22 benches passed. Worst reported relative delta was 1.047e-14 and worst absolute delta was 7.216e-15.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
