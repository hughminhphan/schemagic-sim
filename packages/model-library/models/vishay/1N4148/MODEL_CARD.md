# 1N4148 model card

## Identity

- Manufacturer: Vishay Intertechnology
- Description: Small-signal fast switching silicon diode
- Electrical family: diode
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.vishay.com/docs/81857/1n4148.pdf
- Revision: Rev. 1.6, 07-Nov-2024
- Accessed: 2026-08-06
- SHA-256: `aefe85400a427ed886a4e1c88205ceabb9f9b38044b29c6acee4bb00146a44b7`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Fitted parameters

| Parameter | Value |
| --- | ---: |
| IS | 7.505393e-10 A |
| N | 1.630482 |
| RS | 0.770323 ohm |
| CJO | 4.000000e-12 F |
| TT | 4.000000e-9 s |

## Fitted versus datasheet

| Current (A) | Datasheet VF (V) | Fitted VF (V) | Relative error | Citation |
| ---: | ---: | ---: | ---: | --- |
| 1.000e-5 | 0.4000 | 0.3979 | 0.534% | p. 2 fig. 2, 25 degC curve |
| 1.000e-4 | 0.4900 | 0.4944 | 0.896% | p. 2 fig. 2, 25 degC curve |
| 1.000e-3 | 0.5900 | 0.5915 | 0.261% | p. 2 fig. 2, 25 degC curve |
| 1.000e-2 | 0.7000 | 0.6949 | 0.724% | p. 2 fig. 2, 25 degC curve |
| 1.000e-1 | 0.8600 | 0.8607 | 0.084% | p. 2 fig. 2, 25 degC curve |

Worst fitting error: 0.896% for forward voltage at 0.0001 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 3.535e-13 and worst absolute delta was 1.976e-13.

## Known omissions

- Breakdown and avalanche behavior are not modeled.
- Temperature scaling was not fitted beyond the ngspice diode defaults.
- TT is a first-order charge-storage approximation from one reverse-recovery specification.
- CJO uses the datasheet maximum zero-bias capacitance, not a typical C-V curve.
- Package self-heating, noise, process spread, and ageing are omitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
