# ICM7555 model card

## Identity

- Manufacturer: Renesas Electronics
- Description: Low-power CMOS general-purpose timer
- Electrical family: timer
- Fidelity tier: F1, bounded / approximate
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.renesas.com/en/document/dst/icm7555-icm7556-datasheet
- Revision: FN2867 Rev.10.01, March 5, 2020
- Accessed: 2026-08-07
- Referenced pages: p. 3, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `9f14724a227a474a44f1ea9069aa3313878851d044af364dc4bd4778f1f83024`
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
| RDIV | 1.00000000e+05 | fitted or datasheet-derived |
| VDRP_H | 6.55000000e-01 | fitted or datasheet-derived |
| VDRP_L | 2.00000000e-02 | fitted or datasheet-derived |
| RDIS | 1.33333333e+01 | fitted or datasheet-derived |
| ROUT | 5.62500000e+01 | fitted or datasheet-derived |
| IQ | 2.33333333e-05 | fitted or datasheet-derived |
| AGAIN | 2.00000000e+03 | held at default |
| TAU | 2.00000000e-08 | held at default |
| RDOFF | 1.00000000e+09 | held at default |
| KSW | 2.00000000e+01 | held at default |
| VSKEW | 5.00000000e-02 | held at default |
| VRESET | 7.00000000e-01 | direct typical transcription |
| KREG | 2.50000000e+01 | fixed regenerative latch gain |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output high voltage | 4.300000e+00 | 4.300000e+00 | V | 0.000% | p. 4 electrical specifications, TYP column |
| output low voltage | 2.000000e-01 | 2.000000e-01 | V | 0.000% | p. 4 electrical specifications, TYP column |
| discharge on resistance | 1.333333e+01 | 1.333333e+01 | ohm | 0.000% | p. 4 electrical specifications, TYP column |
| reset threshold voltage | 7.000000e-01 | 7.000000e-01 | V | 0.000% | p. 3 VRST row and p. 6 RESET section |

Worst fitting error: 0.000% for discharge on resistance.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 1.097e-13 and worst absolute delta was 5.231e-13.

## Known omissions

- The comparators, latch and output stage are analog behavioral approximations of the datasheet block diagram, not transistor-level circuits. Internal node voltages are not physical.
- Trigger and threshold input currents are not modelled, so the maximum usable timing resistance is not enforced. A circuit using a 10 Meg timing resistor will work in simulation and may not work on a bench.
- Timing accuracy, initial accuracy and drift with temperature and supply are not modelled. The model reproduces the ideal formulas far more precisely than any real device does.
- Output rise and fall times are consequences of the output resistance and the external load, not fitted datasheet quantities.
- Supply-current spikes during output transitions are not modelled. Quiescent current is a constant.
- No self-heating and no temperature coefficients.
- The discharge switch is a resistance to ground, not a saturating transistor. Its behaviour at currents far above the datasheet test point is a linear extrapolation.
- Discharge-switch off-state leakage is fixed at a numerically safe 1e9 ohm rather than the datasheet leakage maximum.
- Power-up state is deterministic because a fixed asymmetry is built into the latch to give the operating point a definite solution. Real devices power up in an indeterminate state.
- An astable configuration has no DC operating point, so an .op analysis on such a circuit can report solver warnings before the transient runs correctly. This is inherent to oscillators.
- Noise is not modelled, so period jitter is absent.
- AGAIN = 2000, KREG = 25, KSW = 20, TAU = 20 ns, VSKEW = 0.05, RDOFF = 1 Gohm, latch capacitors = 1 pF, and comparator load resistors = 1 Mohm are held at default archetype values.
- CMOS variant: fitted from its own datasheet. Output drive, supply current and discharge resistance differ substantially from the bipolar NE555 and the two are not interchangeable models.
- IQ is derived as the published 5 V typical supply current minus the current drawn by the explicitly published three 100 kohm divider resistors.
- Low-supply astable behavior is unclaimed. The 2 V free-running bench remains numerically stiff in native ngspice and was removed rather than presenting an unvalidated boundary claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
