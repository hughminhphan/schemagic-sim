# LL4148 model card

## Identity

- Manufacturer: Vishay Intertechnology
- Description: Small-signal fast switching silicon diode in SOD-80 package; electrical die source is official Vishay 1N4148 family data
- Electrical family: diode
- Fidelity tier: F1, alias-family electrical fit
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.vishay.com/docs/81857/1n4148.pdf
- Revision: Rev. 1.6, 07-Nov-2024
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `aefe85400a427ed886a4e1c88205ceabb9f9b38044b29c6acee4bb00146a44b7`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| Forward voltage at 10 uA | 0.4 | 0.397865 | V | 0.534% | p. 2 fig. 2, 25 degC curve |
| Forward voltage at 100 uA | 0.49 | 0.494390 | V | 0.896% | p. 2 fig. 2, 25 degC curve |
| Forward voltage at 1 mA | 0.59 | 0.591541 | V | 0.261% | p. 2 fig. 2, 25 degC curve |
| Forward voltage at 10 mA | 0.70 | 0.694932 | V | 0.724% | p. 2 fig. 2, 25 degC curve |
| Forward voltage at 100 mA | 0.86 | 0.860720 | V | 0.084% | p. 2 fig. 2, 25 degC curve |

## Validation

- Benches passed: 9/9 checks.
- Native and WASM agreement: all 9 benches passed.
- Worst native/WASM relative delta: 7.333e-14.
- Boundary bench: `boundary_forward.cir` at the maximum claimed 100 mA forward-current edge.

## Known omissions

- LL4148 package-specific source was unavailable; the official Vishay 1N4148 family datasheet is used as the electrical die source and fidelity is capped at F1.
- SMD package parasitics are not modeled.
- ISR held at ngspice diode default because the independent reverse-leakage target is a maximum and forward-fit parameters were consumed.
- NR held at ngspice diode default because the independent reverse-leakage target is a maximum and forward-fit parameters were consumed.
- IKF held at ngspice diode default: no high-injection roll-off target was available.
- VJ held at physical default 1.0 V because only one capacitance point is published.
- M held at physical default 0.5 because only one capacitance point is published.
- FC held at physical default 0.5.
- TNOM held at ngspice diode default 27 degC; only 25 degC data was fitted.
- EG held at ngspice diode default; no temperature sweep was fitted.
- XTI held at ngspice diode default; no temperature sweep was fitted.
- BV, IBV, and NBV held at ngspice diode defaults; reverse breakdown is not modeled.
- TT is a first-order charge-storage approximation derived from one published maximum trr.
- No self-heating: junction temperature is fixed at TNOM.
- Package lead inductance and package capacitance are not modeled.
- Flicker noise is not modeled: KF and AF are at defaults (no noise data published).
