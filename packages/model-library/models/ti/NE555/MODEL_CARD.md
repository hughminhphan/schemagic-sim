# NE555 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Precision bipolar timer
- Electrical family: timer
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/ne555.pdf
- Revision: SLFS022K, September 1973, revised March 2026
- Accessed: 2026-08-07
- Referenced pages: p. 4, p. 5, p. 6, p. 7, p. 10, p. 11, p. 12
- SHA-256: `9800ba0d037333a442e18704e5df765a7a202c4b661f4135d6385eea7c073c1c`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | validated |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| RDIV | 5.00000000e+03 | held at default |
| VDRP_H | 3.33333333e-02 | fitted or datasheet-derived |
| VDRP_L | 1.66666667e-02 | fitted or datasheet-derived |
| RDIS | 1.87500000e+01 | fitted or datasheet-derived |
| ROUT | 1.66666667e+01 | fitted or datasheet-derived |
| IQ | 3.00000000e-03 | fitted or datasheet-derived |
| AGAIN | 2.00000000e+03 | held at default |
| KREG | 2.50000000e+01 | held at default |
| TAU | 2.00000000e-08 | held at default |
| RDOFF | 1.00000000e+09 | held at default |
| KSW | 2.00000000e+01 | held at default |
| VSKEW | 5.00000000e-02 | held at default |
| VRESET | 7.00000000e-01 | direct typical transcription |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output high voltage | 3.300000e+00 | 3.300000e+00 | V | 0.000% | p. 6 electrical characteristics, TYP column |
| output low voltage | 1.500000e-01 | 1.500000e-01 | V | 0.000% | p. 6 electrical characteristics, TYP column |
| discharge on resistance | 1.875000e+01 | 1.875000e+01 | ohm | 0.000% | p. 5 electrical characteristics, TYP column |
| reset threshold voltage | 7.000000e-01 | 7.000000e-01 | V | 0.000% | p. 5 electrical characteristics, TYP column |

Worst fitting error: 0.000% for output high voltage.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.506e-14 and worst absolute delta was 5.018e-14.

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
- RDIV is held at the physical archetype default because the datasheet does not isolate divider current from total supply current.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
