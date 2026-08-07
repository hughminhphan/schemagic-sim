# LMC555 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Low-voltage CMOS timer
- Electrical family: timer
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lmc555.pdf
- Revision: SNAS558N, January 2000, revised March 2024
- Accessed: 2026-08-07
- Referenced pages: p. 4, p. 5, p. 7, p. 8, p. 9, p. 10, p. 11
- SHA-256: `c2127fcf0006460b0856ed4003e7cec37be2d78f14f5e59de22ee8cdc590f561`
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
| RDIV | 1.00000000e+5 | held at default |
| VDRP_H | 2.30000000e-1 | fitted or datasheet-derived |
| VDRP_L | 2.00000000e-2 | fitted or datasheet-derived |
| RDIS | 1.50000000e+1 | fitted or datasheet-derived |
| ROUT | 3.50000000e+1 | fitted or datasheet-derived |
| IQ | 1.80000000e-4 | fitted or datasheet-derived |
| AGAIN | 2.00000000e+3 | held at default |
| KREG | 2.50000000e+1 | held at default |
| TAU | 2.00000000e-8 | held at default |
| RDOFF | 1.00000000e+9 | held at default |
| KSW | 2.00000000e+1 | held at default |
| VSKEW | 5.00000000e-2 | held at default |
| VRESET | 7.00000000e-1 | direct typical transcription |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| AGAIN | 2.00000000e+3 | 1/V | held at default: mandatory archetype comparator gain |
| KREG | 2.50000000e+1 | 1 | held at default: regenerative latch constant |
| KSW | 2.00000000e+1 | 1 | held at default: discharge conductance switch steepness |
| TAU | 2.00000000e-8 | s | held at default: mandatory latch resolution time |
| VSKEW | 5.00000000e-2 | V | held at default: deterministic power-up asymmetry |
| RDOFF | 1.00000000e+9 | ohm | held at default: numerically safe discharge off resistance |
| CQA_CQB | 1.00000000e-12 | F | held at default: latch capacitors |
| RCU_RCL_RRS | 1.00000000e+6 | ohm | held at default: behavioral source loads |
| RDIV | 1.00000000e+5 | ohm | held at default: divider resistance not isolated by datasheet |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output high voltage | 4.700000e+0 | 4.700000e+0 | V | 0.000% | p. 5 electrical characteristics, TYP column |
| output low voltage | 3.000000e-1 | 3.000000e-1 | V | 0.000% | p. 5 electrical characteristics, TYP column |
| discharge on resistance | 1.500000e+1 | 1.500000e+1 | ohm | 0.000% | p. 5 electrical characteristics, TYP column |
| reset threshold voltage | 7.000000e-1 | 7.000000e-1 | V | 0.000% | p. 5 electrical characteristics, TYP column |

Worst fitting error: 0.000% for output high voltage.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 4.668e-13 and worst absolute delta was 2.334e-12.

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
- RDIV is held at the physical archetype default because the datasheet does not isolate divider current from total supply current.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
