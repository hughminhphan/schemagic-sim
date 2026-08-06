# 4N35 model card

## Identity

- Manufacturer: Vishay Semiconductors
- Description: 6-pin phototrans coupler input LED diode model; phototransistor output omitted
- Electrical family: other
- Fidelity tier: F1, one-point input-LED calibration
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.vishay.com/docs/81181/4n35.pdf
- Revision: Rev. 1.2, 07-Jan-10
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `36e7fc654f6098e7d1bd7a53880f62e58454cd2d1d6baeac05852ee379e46bb2`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| Forward voltage at 10 mA | 1.3 | 1.3 | V | 0% | p. 2 electrical characteristics, Forward voltage row |
| Junction capacitance at 0 V | 50 | 50 | pF | 0% | p. 2 electrical characteristics, Junction capacitance row |

## Validation

- Benches passed: 4/4 checks.
- Native and WASM agreement: all 4 benches passed.
- Worst native/WASM relative delta: 5.531e-12.
- Boundary bench: `boundary_forward.cir` at the maximum claimed 10 mA forward-current edge.

## Known omissions

- Phototransistor output, CTR, isolation, and switching behavior are not modeled; this dot model represents only the input LED.
- N held at physical default 1.6 because only one forward-voltage point is published.
- RS held at physical default floor 1e-4 ohm because only one forward-voltage point is published.
- VJ held at ngspice diode default because capacitance has one zero-bias point only.
- M held at ngspice diode default because capacitance has one zero-bias point only.
- FC held at ngspice diode default.
- TNOM held at ngspice diode default 27 degC; only 25 degC data was fitted.
- EG held at ngspice diode default; no temperature sweep was fitted.
- XTI held at ngspice diode default; no temperature sweep was fitted.
- ISR, NR, and IKF held at ngspice diode defaults; no low-current recombination or high-injection data was published.
- TT held at default zero: the datasheet publishes optocoupler response times, not diode reverse recovery.
- BV, IBV, and NBV held at ngspice diode defaults; reverse breakdown is not modeled.
- No self-heating: junction temperature is fixed at the test temperature.
- Package parasitics are not modeled.
- Flicker noise is not modeled: KF and AF are at defaults (no noise data published).
