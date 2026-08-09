# SS24 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 200uA@40V 2A 40V 50A 550mV@2A Independent SMA(DO-214AC) Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905115245568000
- Revision: Rev:1.0
- Accessed: 2026-08-09
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
| IS | 7.49438695e-4 | fitted or derived |
| N | 2.11319298e+0 | fitted or derived |
| RS | 7.76957623e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.179155 A | 3.000000e-1 | 3.009622e-1 | V | 0.321% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 1.11747 A | 4.000000e-1 | 4.081156e-1 | V | 2.029% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 3.91745 A | 5.000000e-1 | 4.984050e-1 | V | 0.319% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 9.98666 A | 6.000000e-1 | 5.967029e-1 | V | 0.550% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 19.1749 A | 7.000000e-1 | 7.037457e-1 | V | 0.535% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 30.5408 A | 8.000000e-1 | 8.174941e-1 | V | 2.187% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 41.2762 A | 9.000000e-1 | 9.173673e-1 | V | 1.930% | p. 2 Fig. 3, SS22-SS24 curve |
| forward voltage at 48.3635 A | 1.000000e+0 | 9.810935e-1 | V | 1.891% | p. 2 Fig. 3, SS22-SS24 curve |

Worst fitting error: 2.187% for forward voltage at 30.5408 A.

Native and WASM agreement: all 17 benches passed. Worst reported relative delta was 1.612e-15 and worst absolute delta was 6.661e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- The F2 current span is pulsed static-characteristic evidence and is not a continuous-current rating or safe-operating-area claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
