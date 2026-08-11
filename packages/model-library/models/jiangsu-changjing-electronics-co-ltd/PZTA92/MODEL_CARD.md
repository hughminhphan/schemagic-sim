# PZTA92 model card

## Identity

- Manufacturer: Jiangsu Changjing Electronics Technology Co Ltd
- Description: -55℃~+150℃ 1 PNP 1W 200mA 25 250nA 300V 500mV 50MHz 5V PNP SOT-223 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589040017683046400
- Revision: Rev. 2.0
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `fdb81aa89d776d1c61ff744aecdf248c7be1241ac04fdf389f712e4a375dd657`
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
| BF | 4.00000000e+1 | fitted or derived |
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

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 9.342e-8 and worst absolute delta was 4.243e-8.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: No defensible numeric curve points could be extracted from the supplied PDF plots without inventing or interpolating data.
- No defensible numeric curve points could be extracted from the supplied PDF plots without inventing or interpolating data.

- F1 gain support is limited to the three cited 25 degC hFE table points at |VCE| = 10 V.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
