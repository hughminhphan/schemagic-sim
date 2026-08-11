# SS34-MS model card

## Identity

- Manufacturer: MSKSEMI
- Description: -50℃~+125℃ 1 Independent 100A 3A 40V 500uA@40V 550mV@3A SMA(DO-214AC) Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588907327055806464
- Revision: Not stated in supplied PDF
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `97df496df6e26e863de86e318c69fff1545cd8fd7d875e2e6a8a9bacb2eb7cdf`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 1.82401102e-8 | fitted or derived |
| N | 1.10000000e+0 | fitted or derived |
| RS | 1.00000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 9.638e-15 and worst absolute delta was 5.218e-15.218e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: diode extraction cannot support an F2 fit: forward I-V curve 'typical instantaneous forward characteristics, SS32-SS34 curve' has 3 usable points after validation; 4 required
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
