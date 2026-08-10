# SS210 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603080187785728000
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `dd6685a75cdccbe3a6a290f916cb29ad27e9252703862dc167c4967c2ff12bf4`
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
| IS | 4.15861895e-4 | fitted or derived |
| N | 3.24002677e+0 | fitted or derived |
| RS | 1.31177953e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.08 A | 4.500000e-1 | 4.422400e-1 | V | 1.724% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 0.36 A | 5.500000e-1 | 5.716214e-1 | V | 3.931% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 1 A | 6.500000e-1 | 6.655724e-1 | V | 2.396% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 1.6 A | 7.000000e-1 | 7.128177e-1 | V | 1.831% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 2.4 A | 7.500000e-1 | 7.572839e-1 | V | 0.971% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 4.6 A | 8.500000e-1 | 8.406573e-1 | V | 1.099% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 6.2 A | 9.000000e-1 | 8.866584e-1 | V | 1.482% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 8.4 A | 9.500000e-1 | 9.409656e-1 | V | 0.951% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 16 A | 1.100000e+0 | 1.094658e+0 | V | 0.486% | p. 2 Fig. 3, dotted SS28-SS210 curve |
| forward voltage at 30 A | 1.300000e+0 | 1.330985e+0 | V | 2.383% | p. 2 Fig. 3, dotted SS28-SS210 curve |

Worst fitting error: 3.931% for forward voltage at 0.36 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 4.435e-15 and worst absolute delta was 2.554e-15.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-recovery-time or breakdown-voltage/current specification is published; no capacitance-versus-reverse-bias curve is provided, only one tabulated capacitance point.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
