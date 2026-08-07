# IR333A model card

## Identity

- Manufacturer: Everlight
- Description: 5 mm 940 nm infrared through-hole LED
- Electrical family: led
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.everlight.com/
- Revision: DIR-0000930_V5, released 13-Dec-2016; official IR333-A datasheet
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `192c26006dc0fc93c5f6bf7f4756aa01cd667012a4d6ee537bc9f105f26cad78`
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
| IS | 4.06646186e-10 | fitted |
| N | 2.57003693e+0 | fitted |
| RS | 1.16334986e+0 | fitted |
| EG | 1.31898078e+0 | derived from datasheet wavelength |
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
| forward voltage at 2.000e-2 A | 1.200000e+0 | 1.200000e+0 | V | 0.000% | p. 3 electro-optical characteristics |
| forward voltage at 1.000e-1 A | 1.400000e+0 | 1.400000e+0 | V | 0.000% | p. 3 electro-optical characteristics |
| forward voltage at 1.000e+0 A | 2.600000e+0 | 2.600000e+0 | V | 0.000% | p. 3 electro-optical characteristics |

Worst fitting error: 0.000% for forward voltage at 1 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 3.694e-16 and worst absolute delta was 4.441e-16.

## Known omissions

- Optical output is not simulated. Luminous intensity, wavelength, viewing angle, bin spread, and ageing are metadata only.
- No self-heating: junction temperature is fixed at TNOM. Thermal derating from the datasheet is not modelled.
- Package parasitics (lead inductance and package capacitance) are not modelled.
- Flicker noise is not modelled: KF and AF are held at defaults.
- Reverse recovery is not modelled: TT is absent, so switching transients recover instantaneously.
- Reverse breakdown is not modelled: BV, IBV, and NBV are held at defaults.
- The datasheet has no junction-capacitance or reverse-recovery specification, so CJO and TT are omitted.
- The 1 A forward point is a pulse-only typical and is not part of the claimed continuous operating region.
- XTI is held at the ngspice default; EG is derived from the datasheet peak wavelength, with no temperature sweep fitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
