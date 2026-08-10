# BC807DS model card

## Identity

- Manufacturer: Nexperia
- Description: -65℃~+150℃ 100nA 160 2 PNP 45V 500mA 5V 600mW 700mV 80MHz PNP SC-74-6 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588909697415434240
- Revision: v.4, 8 July 2024 (Product data sheet)
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5, 6, 7, 8
- SHA-256: `29d3dc7fcbae276e2db017fda1dae75cb216cb8f83530ccf4e19c8594e4744a9`
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
| BF | 2.74000000e+2 | fitted or derived |
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

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 2.720e-12 and worst absolute delta was 5.103e-12.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: bjt extraction cannot support an F2 fit: no digitised typical hFE-versus-collector-current curve at a stated VCE and 25 degC
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
