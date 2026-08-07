# PC817 model card

## Identity

- Manufacturer: Sharp Corporation
- Description: 4-pin phototrans coupler input IRED diode model; phototransistor output omitted
- Electrical family: other
- Fidelity tier: F1, one-point input-IRED calibration
- Independent reviewer: sol independent reviewer (batch X1-misc)

## Provenance

- Datasheet: https://global.sharp/products/device/lineup/data/pdf/datasheet/PC8171xNSZ1B_e.pdf
- Revision: Sheet No. OP18004EN, DATE Jan.15.2018
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `7cfdb59e0f75bb9c92581f95e55cdb02a377aa6e4a33a45371ae4d3c71935c1f`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| Forward voltage at 5 mA | 1.2 | 1.2 | V | 0% | p. 4 electro-optical characteristics, Forward voltage row |
| Terminal capacitance at 0 V | 30 | 30 | pF | 0% | p. 4 electro-optical characteristics, Terminal capacitance row |

## Validation

- Benches passed: 4/4 checks.
- Native and WASM agreement: all 4 benches passed.
- Worst native/WASM relative delta: 8.831e-12.
- Boundary bench: `boundary_forward.cir` at the maximum claimed 5 mA forward-current edge.

## Known omissions

- Phototransistor output, CTR, isolation, and switching behavior are not modeled; this dot model represents only the input IRED diode.
- N held at physical default 1.6 because only one forward-voltage point is published.
- RS held at physical default floor 1e-4 ohm because only one forward-voltage point is published.
- VJ held at ngspice diode default because capacitance has one zero-bias point only.
- M held at ngspice diode default because capacitance has one zero-bias point only.
- FC held at ngspice diode default.
- TNOM held at ngspice diode default 27 degC; only 25 degC data was fitted.
- EG held at ngspice diode default; no temperature sweep was fitted.
- XTI held at ngspice diode default; no temperature sweep was fitted.
- ISR, NR, and IKF held at ngspice diode defaults; no low-current recombination or high-injection data was published.
- TT held at default zero: the datasheet publishes LED response times, not diode reverse recovery.
- BV, IBV, and NBV held at ngspice diode defaults; reverse breakdown is not modeled.
- No self-heating: junction temperature is fixed at the test temperature.
- Package parasitics are not modeled.
- Flicker noise is not modeled: KF and AF are at defaults (no noise data published).

## F2 upgrade assessment

The official datasheet was re-examined through page 8, including the 25 degC forward-current, CTR, and collector-output curve families. A native ngspice three-seed diode/BJT composite fit was attempted against digitized Figures 7 and 8. Its worst CTR residual was 43.3% at IF = 10 mA, VCE = 5 V, and its worst output-curve residual was 60.2% at IF = 0.5 mA, VCE = 0.2 V. Both exceed the 33% curve threshold. Adding reverse-gain and reverse-knee freedom still left those misses, so the composite is not sufficiently identified by this archetype without adding unsupported behavioral terms. The existing input-IRED model therefore remains F1.
