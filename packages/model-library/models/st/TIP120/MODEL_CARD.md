# TIP120 model card

## Identity

- Manufacturer: STMicroelectronics
- Description: NPN Darlington power transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.st.com/en/power-transistors/tip120.html
- Revision: DS0854 Rev. 5, May 2021; official ST product/specification page fallback
- Accessed: 2026-08-07
- Referenced pages: official spec table, internal schematic, safe operating area figure
- SHA-256: `f1dceea0c76699f145f648a31dfec09125d60e071ca5166f5e3697b8b8381780`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| DRV_IS | 2.00000000e-13 | held composite seed |
| DRV_BF | 1.00000000e+2 | held composite seed |
| DRV_IKF | 1.00000000e+0 | held composite seed |
| DRV_ISE | 1.00000000e-11 | held composite seed |
| DRV_NE | 1.50000000e+0 | held composite seed |
| DRV_VAF | 6.00000000e+1 | held composite seed |
| DRV_RB | 5.00000000e+0 | held composite seed |
| DRV_RE | 8.00000000e-2 | held composite seed |
| DRV_RC | 1.20000000e-1 | held composite seed |
| DRV_CJE | 2.00000000e-10 | held composite seed |
| DRV_CJC | 8.00000000e-11 | held composite seed |
| DRV_TF | 2.00000000e-7 | held composite seed |
| DRV_TR | 5.00000000e-7 | held composite seed |
| OUT_IS | 2.00000000e-12 | held composite seed |
| OUT_BF | 1.00000000e+2 | held composite seed |
| OUT_IKF | 1.00000000e+1 | held composite seed |
| OUT_ISE | 1.00000000e-10 | held composite seed |
| OUT_NE | 1.50000000e+0 | held composite seed |
| OUT_VAF | 6.00000000e+1 | held composite seed |
| OUT_RB | 5.00000000e-1 | held composite seed |
| OUT_RE | 8.00000000e-3 | held composite seed |
| OUT_RC | 1.20000000e-2 | held composite seed |
| OUT_CJE | 2.00000000e-9 | held composite seed |
| OUT_CJC | 8.00000000e-10 | held composite seed |
| OUT_TF | 2.00000000e-7 | held composite seed |
| OUT_TR | 5.00000000e-7 | held composite seed |
| R1 | 7.00000000e+3 | datasheet value |
| R2 | 7.00000000e+1 | datasheet value |
| DIODE_IS | 1.00000000e-12 | held composite seed |
| DIODE_N | 1.50000000e+0 | held composite seed |
| DIODE_RS | 5.00000000e-2 | held composite seed |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| DRV_IS | 2.00000000e-13 | 1 | Internal dies are not independently characterized |
| DRV_BF | 4.50000000e+1 | 1 | Internal dies are not independently characterized |
| DRV_IKF | 3.50000000e-1 | 1 | Internal dies are not independently characterized |
| DRV_ISE | 1.00000000e-11 | 1 | Internal dies are not independently characterized |
| DRV_NE | 1.50000000e+0 | 1 | Internal dies are not independently characterized |
| DRV_VAF | 6.00000000e+1 | 1 | Internal dies are not independently characterized |
| DRV_RB | 5.00000000e+0 | 1 | Internal dies are not independently characterized |
| DRV_RE | 8.00000000e-2 | 1 | Internal dies are not independently characterized |
| DRV_RC | 1.20000000e-1 | 1 | Internal dies are not independently characterized |
| DRV_CJE | 2.00000000e-10 | 1 | Internal dies are not independently characterized |
| DRV_CJC | 8.00000000e-11 | 1 | Internal dies are not independently characterized |
| DRV_TF | 2.00000000e-7 | 1 | Internal dies are not independently characterized |
| DRV_TR | 5.00000000e-7 | 1 | Internal dies are not independently characterized |
| OUT_IS | 2.00000000e-12 | 1 | Internal dies are not independently characterized |
| OUT_BF | 5.50000000e+1 | 1 | Internal dies are not independently characterized |
| OUT_IKF | 3.50000000e+0 | 1 | Internal dies are not independently characterized |
| OUT_ISE | 1.00000000e-10 | 1 | Internal dies are not independently characterized |
| OUT_NE | 1.50000000e+0 | 1 | Internal dies are not independently characterized |
| OUT_VAF | 6.00000000e+1 | 1 | Internal dies are not independently characterized |
| OUT_RB | 5.00000000e-1 | 1 | Internal dies are not independently characterized |
| OUT_RE | 8.00000000e-3 | 1 | Internal dies are not independently characterized |
| OUT_RC | 1.20000000e-2 | 1 | Internal dies are not independently characterized |
| OUT_CJE | 2.00000000e-9 | 1 | Internal dies are not independently characterized |
| OUT_CJC | 8.00000000e-10 | 1 | Internal dies are not independently characterized |
| OUT_TF | 2.00000000e-7 | 1 | Internal dies are not independently characterized |
| OUT_TR | 5.00000000e-7 | 1 | Internal dies are not independently characterized |
| DIODE_IS | 1.00000000e-12 | 1 | Internal dies are not independently characterized |
| DIODE_N | 1.50000000e+0 | 1 | Internal dies are not independently characterized |
| DIODE_RS | 5.00000000e-2 | 1 | Internal dies are not independently characterized |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| composite hFE minimum at IC=.5 A | 1.000000e+3 | 1.000000e+3 | 1 | 0.000% | official spec table MIN column |
| composite hFE minimum at IC=3 A | 1.000000e+3 | 1.000000e+3 | 1 | 0.000% | official spec table MIN column |

Worst fitting error: 0.000% for guaranteed composite terminal bounds.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.754e-11 and worst absolute delta was 3.322e-13.

## Known omissions

- Official ST PDF fetch timed out after browser-header retries; the official ST HTML product/specification page is the source and fidelity is capped at F1.
- Darlington modelled as two Gummel-Poon devices plus the datasheet internal bias resistors and freewheel diode. The two dies are not independently characterised; only composite terminal behaviour is constrained. Internal-node behaviour is F1.
- Guaranteed MIN/MAX rows remain hard bounds and are not presented as typical targets.
- No self-heating, safe-operating-area failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
