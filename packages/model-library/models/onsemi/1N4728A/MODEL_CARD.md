# 1N4728A model card

## Identity

- Manufacturer: onsemi
- Description: 3.3 V silicon zener diode
- Electrical family: diode, zener variant
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Source: https://www.onsemi.com/products/discrete-power-modules/zener-diodes/1N4728A
- Kind: spec_page
- Revision: official product specification fallback; PDF and product page access blocked
- Accessed: 2026-08-07
- Referenced locations: official product page, electrical characteristics, official product page, zener voltage table, official product page, reverse leakage table
- SHA-256: `a90af613814d21f057901bccdee7df056c04ec10c534193ce9072f3efb8bc204`
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
| BV | 3.3 | paired with IBV at IZT |
| IBV | 0.076 | paired with BV at IZT |
| NBV | 1 | held at physical default 1.0; no independent knee curve fit |

## Fitted versus datasheet

| Quantity | Datasheet-derived target | Model | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| zener voltage at 0.001 A | 3.188042 | 3.1887324 | V | 0.0217% | official product page, zener voltage table, zener voltage and differential resistance rows |
| zener voltage at 0.076 A | 3.3 | 3.3000076 | V | 0.0002% | official product page, zener voltage table, zener voltage row at IZT |

Worst reported fitting error: 0.0217% (zener voltage at 0.001 A).

## Validation

- Native ngspice-46 and WASM agreement: 3/3 benches.
- Expectation checks: 3/3 passed.
- Worst native/WASM relative delta: 1.346e-16.
- Worst native/WASM absolute delta: 4.441e-16.
- Every bench explicitly sets `.temp 25`.

## Known omissions

- Official onsemi PDF and HTML product page were unreachable after repeated HTTPS attempts; manufacturer fallback was not usable as a fetched factual table, so this package is capped at F1.
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
