# Diode archetype

## Model form

Use an original ngspice `.model D` card. Fit `IS`, `N`, and `RS` to at least three forward current and voltage points at a stated temperature. Set `CJO` from stated zero-bias capacitance and `TT` from stated reverse-recovery time when available. Do not infer breakdown behavior from a maximum reverse-voltage rating.

## Bench set

1. Fixed-current operating points across the fitted forward-current range.
2. Reverse leakage at a cited voltage.
3. Small-signal zero-bias capacitance at the cited frequency.
4. Reverse-recovery transient when the datasheet states a usable fixture and recovery criterion.

## Fidelity limits

F2 covers electrical behavior only within the cited current, voltage, and ambient-temperature region. Package self-heating, statistical spread, breakdown avalanche, detailed charge distribution, and noise require separate evidence.
