# TLC555 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Low-power CMOS timer
- Electrical family: timer
- Fidelity tier: F1, bounded / approximate
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tlc555.pdf
- Revision: SLFS043K, August 1983, revised January 2026
- Accessed: 2026-08-07
- Referenced pages: p. 4, p. 7, p. 8, p. 9, p. 10, p. 13, p. 14, p. 15
- SHA-256: `6914398f4fd6b12a8c7436a95ea76c70ae6f0d74399be74841305f6aa6a5e53a`
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
| RDIV | 1.00000000e+05 | held at default |
| VDRP_H | 1.75000000e-01 | fitted or datasheet-derived |
| VDRP_L | 1.00000000e-02 | fitted or datasheet-derived |
| RDIS | 6.00000000e+00 | fitted or datasheet-derived |
| ROUT | 2.50000000e+01 | fitted or datasheet-derived |
| IQ | 1.80000000e-04 | fitted or datasheet-derived |
| AGAIN | 2.00000000e+03 | held at default |
| KREG | 2.50000000e+01 | held at default |
| TAU | 2.00000000e-08 | held at default |
| RDOFF | 1.00000000e+09 | held at default |
| KSW | 2.00000000e+01 | held at default |
| VSKEW | 5.00000000e-02 | held at default |
| VRESET | 1.10000000e+00 | direct typical transcription |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output high voltage | 4.800000e+00 | 4.800000e+00 | V | 0.000% | p. 7 electrical characteristics, TYP column |
| output low voltage | 2.100000e-01 | 2.100000e-01 | V | 0.000% | p. 7 electrical characteristics, TYP column |
| discharge on resistance | 6.000000e+00 | 6.000000e+00 | ohm | 0.000% | p. 7 electrical characteristics, TYP column |
| reset threshold voltage | 1.100000e+00 | 1.100000e+00 | V | 0.000% | p. 7 electrical characteristics, 25 degC TYP column |

Worst fitting error: 0.000% for output high voltage.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 3.563e-15 and worst absolute delta was 1.243e-14.

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
- Free-running astable and control-voltage oscillator behavior are unclaimed. Native ngspice could not complete the regenerative-latch transient within 180 seconds after both reduced-gain and increased-gain convergence attempts; monostable behavior remains validated.
- Reset-transition timing is unclaimed because its regenerative transient shares the astable convergence limitation. Static reset thresholds remain metadata only.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
