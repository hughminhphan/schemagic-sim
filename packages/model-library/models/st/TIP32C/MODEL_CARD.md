# TIP32C model card

## Identity

- Manufacturer: STMicroelectronics
- Description: PNP power transistor
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.st.com/en/power-transistors/tip32c.html
- Revision: Rev. 2, November 2006; official ST product/specification page fallback
- Accessed: 2026-08-07
- Referenced pages: official spec table, safe operating area figure
- SHA-256: `060d203599e4d254b9f5d6b77f7b0447ad5d81bc87d865b282f7c6b57d694ea4`
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
| IS | 2.00000000e-12 | table-constrained |
| NF | 1.00000000e+0 | held family default |
| BF | 8.50000000e+1 | table-constrained |
| IKF | 1.20000000e+0 | table-constrained |
| ISE | 2.00000000e-10 | table-constrained |
| NE | 1.50000000e+0 | held family default |
| VAF | 6.00000000e+1 | held family default |
| BR | 2.00000000e+0 | held family default |
| RB | 1.00000000e+0 | table-constrained |
| RE | 2.00000000e-2 | table-constrained |
| RC | 6.00000000e-2 | table-constrained |
| CJE | 1.00000000e-9 | held family default |
| VJE | 7.50000000e-1 | held family default |
| MJE | 3.30000000e-1 | held family default |
| CJC | 3.00000000e-10 | held family default |
| VJC | 7.50000000e-1 | held family default |
| MJC | 3.30000000e-1 | held family default |
| XCJC | 1.00000000e+0 | held family default |
| TF | 5.00000000e-8 | held family default |
| TR | 5.00000000e-7 | held family default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| NF | 1.00000000e+0 | 1 | No independent published typical curve value in accessible source |
| NE | 1.50000000e+0 | 1 | No independent published typical curve value in accessible source |
| VAF | 6.00000000e+1 | 1 | No independent published typical curve value in accessible source |
| BR | 2.00000000e+0 | 1 | No independent published typical curve value in accessible source |
| CJE | 1.00000000e-9 | 1 | No independent published typical curve value in accessible source |
| VJE | 7.50000000e-1 | 1 | No independent published typical curve value in accessible source |
| MJE | 3.30000000e-1 | 1 | No independent published typical curve value in accessible source |
| CJC | 3.00000000e-10 | 1 | No independent published typical curve value in accessible source |
| VJC | 7.50000000e-1 | 1 | No independent published typical curve value in accessible source |
| MJC | 3.30000000e-1 | 1 | No independent published typical curve value in accessible source |
| XCJC | 1.00000000e+0 | 1 | No independent published typical curve value in accessible source |
| TF | 5.00000000e-8 | 1 | No independent published typical curve value in accessible source |
| TR | 5.00000000e-7 | 1 | No independent published typical curve value in accessible source |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE minimum at IC=1 A | 2.500000e+1 | 2.500000e+1 | 1 | 0.000% | official spec table MIN column |
| hFE minimum at IC=3 A | 1.000000e+1 | 1.000000e+1 | 1 | 0.000% | official spec table MIN column |

Worst fitting error: 0.000% for guaranteed hFE bounds.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.423e-12 and worst absolute delta was 9.474e-14.

## Known omissions

- Official ST PDF fetch timed out after browser-header retries; the official ST HTML product/specification page is the source and fidelity is capped at F1.
- Guaranteed MIN/MAX rows remain hard bounds and are not presented as typical targets.
- No self-heating, safe-operating-area failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
