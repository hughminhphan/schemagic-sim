# S2MB model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603067582161707008
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `fd9c2383610a7578a3aeb04392aa5d60709346a0cbbcb5292d0d6afde927dcf6`
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
| IS | 3.09283798e-4 | fitted or derived |
| N | 3.90812711e+0 | fitted or derived |
| RS | 2.91490680e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.038964 A | 5.000000e-1 | 4.907878e-1 | V | 1.842% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 0.139248 A | 6.000000e-1 | 6.218777e-1 | V | 3.646% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 0.352618 A | 7.000000e-1 | 7.218810e-1 | V | 3.126% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 0.751904 A | 8.000000e-1 | 8.100156e-1 | V | 1.252% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 1.4356 A | 9.000000e-1 | 8.952989e-1 | V | 0.522% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 2.52939 A | 1.000000e+0 | 9.844248e-1 | V | 1.558% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 4.18411 A | 1.100000e+0 | 1.083530e+0 | V | 1.497% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 6.56876 A | 1.200000e+0 | 1.198630e+0 | V | 0.114% | p. 2, Fig. 3, S2AB-S2MB grouped curve |
| forward voltage at 9.8567 A | 1.300000e+0 | 1.335491e+0 | V | 2.730% | p. 2, Fig. 3, S2AB-S2MB grouped curve |

Worst fitting error: 3.646% for forward voltage at 0.139248 A.

Native and WASM agreement: all 19 benches passed. Worst reported relative delta was 1.199e-14 and worst absolute delta was 5.940e-15.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
