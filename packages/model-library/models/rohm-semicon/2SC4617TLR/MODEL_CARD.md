# 2SC4617TLR model card

## Identity

- Manufacturer: ROHM Semicon
- Description: 1 NPN 100nA 150mA 150mW 180 180MHz 400mV 50V 7V NPN SC-75(SOT-523) Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586202894110900224
- Revision: Rev. 003
- Accessed: 2026-08-11
- Referenced pages: PDF pages 1-13
- SHA-256: `03e4158d54f612930dd4f294f7de8f33172be70542b6e2f8e621c45a5fe2ff93`
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
| IS | 1.00000000e-14 | fitted or derived |
| BF | 1.81800000e+2 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| IKF | 1.00000000e+3 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| CJE | 1.00000000e-12 | fitted or derived |
| CJC | 1.00000000e-12 | fitted or derived |
| TF | 1.00000000e-9 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 2.996e-11 and worst absolute delta was 7.952e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Characteristic plots are present, but the supplied PDF rendering does not expose a sufficiently legible set of exact plotted coordinates for strict non-interpolated digitization.
- Characteristic plots are present, but the supplied PDF rendering does not expose a sufficiently legible set of exact plotted coordinates for strict non-interpolated digitization.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
