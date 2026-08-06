# WP7113ID model card

## Identity

- Manufacturer: Kingbright
- Description: 5 mm high-efficiency red through-hole LED
- Electrical family: led
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf
- Revision: Spec DSAF0012 / 1101005042 Rev V.14A, 01/08/2026
- Accessed: 2026-08-06
- SHA-256: `b5bb33f69c13fd92ab6d47a8fd71168b6e7ee685139c8f381957aeea9286c9da`
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

## Fitted parameters

| Parameter | Value |
| --- | ---: |
| IS | 3.254194e-10 A |
| N | 4.146540 |
| RS | 4.884206 ohm |
| CJO | 0.000000e+0 F |
| TT | 0.000000e+0 s |

## Fitted versus datasheet

| Current (A) | Datasheet VF (V) | Fitted VF (V) | Relative error | Citation |
| ---: | ---: | ---: | ---: | --- |
| 2.000e-3 | 1.6800 | 1.6751 | 0.294% | p. 3 forward current vs. forward voltage curve |
| 4.000e-3 | 1.7500 | 1.7587 | 0.495% | p. 3 forward current vs. forward voltage curve |
| 8.000e-3 | 1.8400 | 1.8520 | 0.655% | p. 3 forward current vs. forward voltage curve |
| 1.000e-2 | 1.9000 | 1.8856 | 0.758% | p. 2 electrical characteristics |
| 1.200e-2 | 1.9200 | 1.9148 | 0.272% | p. 3 forward current vs. forward voltage curve |
| 1.600e-2 | 1.9700 | 1.9650 | 0.256% | p. 3 forward current vs. forward voltage curve |
| 2.000e-2 | 2.0000 | 2.0083 | 0.414% | p. 3 forward current vs. forward voltage curve |

Worst fitting error: 0.758% for forward voltage at 0.01 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 8.780e-16 and worst absolute delta was 1.554e-15.

## Known omissions

- Optical output is not a SPICE output; the UI maps brightness from simulated forward current.
- Wavelength, luminous intensity, viewing angle, bin spread, and optical ageing are metadata only.
- Junction capacitance and switching behavior are omitted because the datasheet does not specify them.
- Reverse breakdown is not modeled from the 5 V absolute maximum rating.
- Temperature scaling, self-heating, process spread, and degradation are omitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
