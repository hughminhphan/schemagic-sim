# Diode archetype

## Model form

Use an original ngspice `.model D` card. Fit `IS`, `N`, and `RS` to at least three forward current and voltage points at a stated temperature. Set `CJO` from stated zero-bias capacitance and `TT` from stated reverse-recovery time when available. Do not infer breakdown behavior from a maximum reverse-voltage rating.

## Variants

`facts.diode_variant` selects the parameter bounds. It is optional; omitting it selects `standard`, so every package fitted before variants existed refits to the identical card.

| variant | IS | N | RS |
| --- | --- | --- | --- |
| `standard` | 1e-30 to 1e-3 A | 0.8 to 6.0 | 0 to 500 ohm |
| `zener` | as standard | as standard | as standard |
| `schottky` | 1e-9 to 1e-2 A | 1.0 to 2.0 | 0 to 50 ohm |

A Schottky barrier conducts by majority-carrier thermionic emission, so its ideality factor is physically at least 1 and in practice 1.0 to 1.3, and its saturation current is orders of magnitude larger than a p-n junction's because the barrier is lower. The `standard` lower bound of 0.8 on `N` is below anything physical: a Schottky fitted under it can park there and report a converged fit where the honest answer is that the curve is not the shape a Schottky makes.

Any parameter that comes to rest on a bound is listed in `fitted.json` under `bound_saturation`. A bound is a constraint, not a measurement, and a value set by one is not a measurement of the part.

## Zener breakdown

In reverse breakdown the ngspice diode satisfies

```
V = BV + NBV * Vt * ln(I / IBV) + I * RS
```

verified directly against ngspice-46: with `BV=5.1`, `IBV=5m`, `NBV=11.6`, `RS=0.1` the model gives 5.1005 V at 5 mA and 5.3076 V at 10 mA.

Supply the calibration point as `facts.zener_calibration`:

```json
"zener_calibration": {
  "vz":  { "value": 5.1,   "unit": "V",   "conditions": "IZT = 5 mA", "page_reference": "...", "source_kind": "typical" },
  "izt": { "value": 0.005, "unit": "A",   "conditions": "Zener test current", "page_reference": "...", "source_kind": "typical" },
  "zzt": { "value": 60,    "unit": "ohm", "conditions": "IZT = 5 mA", "page_reference": "...", "source_kind": "typical" }
}
```

which inverts to

```
IBV = IZT
BV  = VZ - IZT * RS
NBV = (ZZT - RS) * IZT / Vt
```

`RS` comes from the forward fit, so the two halves of the model are held to one series resistance. Three ways for the evidence to contradict itself are refused rather than papered over:

- `ZZT <= RS`: the forward curve already accounts for more series resistance than the whole cited breakdown impedance.
- `VZ <= IZT * RS`: the series drop accounts for the entire cited Zener voltage.
- `NBV > 100`: the implied knee is a resistor, not a breakdown characteristic.

`zzt` is optional. Without it, `NBV` is held at 1 and recorded as a held default: the card then makes a Zener-voltage claim only, and its dynamic impedance is `Vt / IZT`, which is stiffer than any real device.

## Checks recorded in `fitted.json`

- `zener_window_checks`: for each `facts.zener_points` row, the modelled reverse voltage at that cited `IZT` against the published `VZ` MIN and MAX. A Zener whose model sits outside its own published window is not a weaker model, it is a false claim about the part.
- `reverse_leakage_checks`: the model's pre-breakdown reverse current (which is `IS`) against each published `electrical_limits.reverse_current_*` maximum. Claiming more leakage than the datasheet's maximum misstates the part in the direction that matters for a high-impedance bias network. A cited reverse-bias point at or beyond the modelled breakdown voltage is annotated as not describing pre-breakdown leakage rather than being silently scored against it.

Both blocks appear only when the evidence exists, so they are additive to any package fitted before them.

## Bench set

1. Fixed-current operating points across the fitted forward-current range.
2. Reverse leakage at a cited voltage.
3. Small-signal zero-bias capacitance at the cited frequency.
4. Reverse-recovery transient when the datasheet states a usable fixture and recovery criterion.
5. For a Zener, a fixed reverse-current operating point at each cited `IZT`, checked against the published `VZ` window.

## Fidelity limits

F2 covers electrical behavior only within the cited current, voltage, and ambient-temperature region. Package self-heating, statistical spread, detailed charge distribution, and noise require separate evidence. Breakdown is covered only where a Zener calibration point is cited; a maximum reverse-voltage rating alone never produces a breakdown block. Temperature coefficients of `VZ` are not modelled, so a Zener card is a 25 degC claim.
