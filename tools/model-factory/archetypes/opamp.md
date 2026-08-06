# Opamp factory archetype

- Use the behavioral Boyle-class subcircuit with node order INP, INN, VCC, VEE, OUT.
- Transcribe AOL, VOS, IBIAS, IOS, ILIM, CMRR, PSRR, IQ, EN, output resistance, rail drops, and phase margin from cited facts.
- Calibrate GBW and slew rate with exactly three fixed-point native ngspice iterations.
- Measure open-loop AC only through the 1 GH and 1 GF DC-servo bench. Never measure with the output near a rail.
- Clamp rails with `min(max(x, lo), hi)`. The ngspice-46 `limit()` function is banned.
- Use differentiable tanh current limiting.
- Behavioral switches, when needed, must blend conductance rather than resistance.
- Keep the noise resistor on a DC-free internal node.
- Require open-loop, offset and bias, slew and swing, short-circuit current, and CMRR benches. Noise is included in the model but awaits reference-harness support for `.noise` comparisons.
