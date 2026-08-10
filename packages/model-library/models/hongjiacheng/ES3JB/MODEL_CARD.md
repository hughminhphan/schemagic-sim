# ES3JB model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925369725378560
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `0cc0de327cc0967d325949c66d91824a2738577fcec2e28b0b72b102fac2c252`
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
| IS | 3.47249239e-9 | fitted or derived |
| N | 2.66860407e+0 | fitted or derived |
| RS | 1.54178705e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.028835 A | 1.100000e+0 | 1.100138e+0 | V | 0.013% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 0.154146 A | 1.200000e+0 | 1.217775e+0 | V | 1.481% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 0.587938 A | 1.300000e+0 | 1.316866e+0 | V | 1.297% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 1.70731 A | 1.400000e+0 | 1.407706e+0 | V | 0.550% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 3.96396 A | 1.500000e+0 | 1.500639e+0 | V | 0.043% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 7.62457 A | 1.600000e+0 | 1.602228e+0 | V | 0.139% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 12.4762 A | 1.700000e+0 | 1.711021e+0 | V | 0.648% | p. 2 Fig. 3, ES3JB curve |
| forward voltage at 17.7251 A | 1.800000e+0 | 1.816186e+0 | V | 0.899% | p. 2 Fig. 3, ES3JB curve |

Worst fitting error: 1.481% for forward voltage at 0.154146 A.

Native and WASM agreement: all 17 benches passed. Worst reported relative delta was 3.671e-14 and worst absolute delta was 4.041e-14.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
