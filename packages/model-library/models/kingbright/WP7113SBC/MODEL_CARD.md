# WP7113SBC model card

## Identity

- Manufacturer: Kingbrightusa
- Description: 5 mm blue clear through-hole LED
- Electrical family: led
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.kingbrightusa.com/searchswitch.asp
- Revision: Official Kingbright part-number search; requested MPN returned no current product record after HTTPS attempts
- Accessed: 2026-08-07
- Referenced pages: official product search result
- SHA-256: `0000000000000000000000000000000000000000000000000000000000000000`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 8.30086628e-32 | fitted |
| N | 2.00000000e+0 | fitted |
| RS | 1.00000000e-1 | fitted |
| EG | 2.63796155e+0 | derived from datasheet wavelength |
| TNOM | 2.50000000e+1 | fit reference temperature, explicit in model card |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| ISR | 1.00000000e-14 | A | held at physical default because no independent reverse leakage fit was permitted |
| NR | 1.00000000e+0 | 1 | held at physical default because no independent reverse leakage fit was permitted |
| IKF | 0.00000000e+0 | A | held at physical default because no high-injection roll-off was available |
| VJ | 7.00000000e-1 | V | held at physical default because no C-V curve was available |
| M | 5.00000000e-1 | 1 | held at physical default because no C-V curve was available |
| TT | 0.00000000e+0 | s | held at physical default because no reverse-recovery specification was available |
| BV | 0.00000000e+0 | V | held at physical default because reverse breakdown is not modelled |
| IBV | 0.00000000e+0 | A | held at physical default because reverse breakdown is not modelled |
| NBV | 1.00000000e+0 | 1 | held at physical default because reverse breakdown is not modelled |
| XTI | 3.00000000e+0 | 1 | held at physical default because no temperature sweep was fitted |
| TNOM | 2.50000000e+1 | degC | explicit fit reference temperature used by all .temp 25 benches |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 2.000e-2 A | 3.500000e+0 | 3.500000e+0 | V | 0.000% | official Kingbright source unavailable |

Worst fitting error: 0.000% for forward voltage at 0.02 A.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.560e-15 and worst absolute delta was 4.885e-15.

## Known omissions

- Optical output is not simulated. Luminous intensity, wavelength, viewing angle, bin spread, and ageing are metadata only.
- No self-heating: junction temperature is fixed at TNOM. Thermal derating from the datasheet is not modelled.
- Package parasitics (lead inductance and package capacitance) are not modelled.
- Flicker noise is not modelled: KF and AF are held at defaults.
- Reverse recovery is not modelled: TT is absent, so switching transients recover instantaneously.
- Reverse breakdown is not modelled: BV, IBV, and NBV are held at defaults.
- Official Kingbright search returned no current record for this requested MPN and the PDF URL returned 404. No unverified forward-voltage value is used as a claimed fit target.
- Forward model is a conservative one-point physical default for compatibility only and is not datasheet-fitted.
- XTI is held at the ngspice default; EG is derived from the datasheet peak wavelength, with no temperature sweep fitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
