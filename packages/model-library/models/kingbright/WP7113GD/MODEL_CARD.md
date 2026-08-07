# WP7113GD model card

## Identity

- Manufacturer: Kingbrightusa
- Description: 5 mm green diffused GaP through-hole LED
- Electrical family: led
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.kingbrightusa.com/images/catalog/SPEC/WP7113GD.pdf
- Revision: Spec DSAE9335 / 1101005001 Rev V.12B, 04/02/2019
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `55c3ea5f4b7cc7c9f0f058b3cfa8d579993bd19b2afe08339f912df104e2ad45`
- Basis: original model generated from public factual specifications
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
| IS | 1.00000000e-28 | fitted at ngspice minimum accepted saturation current |
| N | 1.22566374e+00 | fitted |
| RS | 1.39490447e+01 | fitted |
| CJO | 1.50000000e-11 | derived from single tabulated capacitance point |
| EG | 0.00000000e+00 | held temperature-neutral because no temperature sweep was fitted |
| XTI | 0.00000000e+00 | held temperature-neutral because no temperature sweep was fitted |
| TNOM | 2.50000000e+01 | fit reference temperature |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 5.000e-04 A | 1.790000e+00 | 1.797884e+00 | V | 0.440% | p. 3 forward current vs. forward voltage curve |
| forward voltage at 1.000e-03 A | 1.835000e+00 | 1.826686e+00 | V | 0.453% | p. 3 forward current vs. forward voltage curve |
| forward voltage at 2.000e-03 A | 1.872000e+00 | 1.862462e+00 | V | 0.509% | p. 3 forward current vs. forward voltage curve |
| forward voltage at 4.000e-03 A | 1.913000e+00 | 1.912188e+00 | V | 0.042% | p. 3 forward current vs. forward voltage curve |
| forward voltage at 8.000e-03 A | 1.992000e+00 | 1.989812e+00 | V | 0.110% | p. 3 forward current vs. forward voltage curve |
| forward voltage at 1.000e-02 A | 2.000000e+00 | 2.024737e+00 | V | 1.237% | p. 2 electrical / optical characteristics |
| forward voltage at 1.600e-02 A | 2.128000e+00 | 2.123232e+00 | V | 0.224% | p. 3 forward current vs. forward voltage curve |
| forward voltage at 2.000e-02 A | 2.194000e+00 | 2.186055e+00 | V | 0.362% | p. 3 forward current vs. forward voltage curve |

Worst fitting error: 1.237% for forward voltage at 0.01 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 6.078e-16 and worst absolute delta was 1.110e-15.

## Known omissions

- Optical output is not simulated. Luminous intensity, wavelength, viewing angle, bin spread, and ageing are metadata only.
- No self-heating: junction temperature is fixed at TNOM. Thermal derating from the datasheet is not modelled.
- Package parasitics (lead inductance and package capacitance) are not modelled.
- Flicker noise is not modelled: KF and AF are held at defaults.
- Reverse recovery is not modelled: TT is absent, so switching transients recover instantaneously.
- Reverse breakdown is not modelled: BV, IBV, and NBV are held at defaults.
- CJO is derived from the single published typical capacitance point at 15 pF; VJ and M are held at defaults.
- Temperature behavior is not fitted: EG and XTI are held at zero so the 25 degC forward fit is not shifted by an unsupported temperature law.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
