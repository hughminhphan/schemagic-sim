# BZX79C5V1 model card

## Identity

- Manufacturer: Nexperia
- Description: 5.1 V low-power silicon zener diode
- Electrical family: diode, zener variant
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Source: https://assets.nexperia.com/documents/data-sheet/BZX79.pdf
- Kind: datasheet
- Revision: M3D176, 2002 Feb 27
- Accessed: 2026-08-07
- Referenced locations: p. 2, p. 4, p. 3
- SHA-256: `23a41d5236b2cfb77d833e4950734c2edb3a26d716b1f2daa358f2615b91aee1`
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 1e-14 | held at physical default |
| N | 1.6 | held at physical default |
| RS | 0.0001 | derived from zener impedance with 1e-4 floor |
| BV | 5.1 | paired with IBV at IZT |
| IBV | 0.005 | paired with BV at IZT |
| NBV | 1 | held at physical default 1.0; no independent knee curve fit |

## Fitted versus datasheet

| Quantity | Datasheet-derived target | Model | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| zener voltage at 0.001 A | 5.0583929 | 5.0586495 | V | 0.0051% | p. 4, zener voltage and differential resistance rows |
| zener voltage at 0.005 A | 5.1 | 5.1000005 | V | 0.0000% | p. 4, zener voltage row at IZT |

Worst reported fitting error: 0.0051% (zener voltage at 0.001 A).

## Validation

- Native ngspice-46 and WASM agreement: 3/3 benches.
- Expectation checks: 3/3 passed.
- Worst native/WASM relative delta: 0.000e+00.
- Worst native/WASM absolute delta: 0.000e+00.
- Every bench explicitly sets `.temp 25`.

## Known omissions

- IS held at physical default 1e-14 A; no typical forward-IV data was available.
- N held at physical default 1.6; no typical forward-IV data was available.
- RS held at the physical floor 1e-4 ohm after the zener impedance subtraction.
- ISR held at default; forward recombination was not fitted.
- NR held at default; forward recombination was not fitted.
- IKF held at default; high-injection roll-off was not fitted.
- CJO held at default/omitted; no usable typical capacitance curve was fitted.
- VJ held at default; no capacitance curve was fitted.
- M held at default; no capacitance curve was fitted.
- FC held at default 0.5.
- TT held at default 0 s; reverse recovery is not modelled.
- EG held at default; no temperature sweep was fitted.
- XTI held at default; no temperature sweep was fitted.
- TNOM held at ngspice default 27 degC; benches explicitly set .temp 25.
- NBV held at physical default 1.0 because the published knee impedance and reverse-leakage bound could not be represented simultaneously by one ngspice breakdown branch.
- No self-heating: junction temperature is fixed at TNOM. Thermal derating from the datasheet is not modelled.
- Package parasitics (lead inductance, package capacitance) are not modelled.
- Flicker noise is not modelled: KF and AF are at defaults (no noise data published).

## Licence

MIT. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
