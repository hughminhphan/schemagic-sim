# FMMT624TA model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 NPN 100 100nA 125V 155MHz 160mV 1A 625mW 7V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588880655975387136
- Revision: DS33110 Rev. 5 - 2, December 2012
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `120c9e0efcb20afce395108936f472a97b76cd3fc483c50cf89275ca54fff317`
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
| BF | 4.50000000e+2 | fitted or derived |
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

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 3.681e-12 and worst absolute delta was 1.787e-11.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Typical plots are present but do not provide defensible exact point coordinates at the strict clean-room extraction threshold; table values were transcribed without inventing curve points.
- Typical plots are present but do not provide defensible exact point coordinates at the strict clean-room extraction threshold; table values were transcribed without inventing curve points.
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
