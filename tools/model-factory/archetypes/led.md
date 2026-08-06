# LED archetype

## Model form

Use an original ngspice `.model D` card. Fit `IS`, `N`, and `RS` to at least three typical forward current and voltage points at the stated ambient temperature. A maximum reverse-current row is a hard bound, not a typical fitting target. Do not add optical behavior to the electrical SPICE model.

## Bench set

1. Fixed-current operating points across the fitted forward-current range.
2. Reverse leakage at the rated reverse voltage.

## UI optical contract

Brightness is a UI-level mapping from simulated forward current. Wavelength, intensity, viewing angle, ageing, bin spread, and thermal colour shift are metadata or rendering concerns, not electrical model outputs.

## Fidelity limits

F2 validates typical DC electrical behavior only. Capacitance, switching, optical conversion, self-heating, production spread, and degradation are omitted unless separately sourced and fitted.
