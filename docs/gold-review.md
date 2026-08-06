# Gold model independent review

Reviewer: claude-opus-5 adversarial reviewer (Opus lane). Author lane: GPT-5.6 Sol model factory.
Date: 2026-08-06. Engines: native ngspice-46 (/opt/homebrew/bin/ngspice) and the pinned WASM build
via `tools/ngspice-wasm-build/dist-loader/index.mjs`. Every number below was re-measured by the
reviewer from the shipped netlists. `validation-results.json` was not trusted as evidence.

## Verdicts

| Package | Verdict | Decisive number |
| --- | --- | --- |
| vishay/1N4148 | PASS | worst forward-voltage error 1.573% at 100 uA (published 0.896%) |
| kingbright/WP7113ID | PASS | worst forward-voltage error 1.316% at 8 mA (published 0.758% at 10 mA) |
| onsemi/2N3904 | PASS | VCE(sat) at 10 mA off by 18.451%, which is 16.6 mV against a 200 mV datasheet maximum |
| infineon/IRLZ44N | PASS | RDS(on) 22.33 mOhm vs 22 mOhm spec; Crss at the only tabulated condition off by 0.18% |
| ti/TL072 | **FAIL** | output swing +/-9.877 V vs +/-13.5 V typical, and 0 V output at +/-5 V rails |

Schema validation passes on all five packages. No PDF or vendor SPICE text anywhere in any package.
All five LICENSE files are byte-identical MIT. Native versus WASM: 16 of 16 benches agree, worst
relative delta 7.4e-6.

## Provenance

Datasheet SHA-256 re-fetched and byte-matched for Vishay, Kingbright, Infineon and TI. The onsemi
host blocks automated fetch (410-byte Akamai "Access Denied"), so its recorded hash could not be
confirmed; content was verified against a Wayback mirror instead, which does confirm "Rev. 9".

Material facts spot-checked and correct: 1N4148 VR 75 V, CD 4 pF, trr 4 ns with full conditions.
WP7113ID VF 1.9 V typ / 2.3 V max, IR 10 uA at 5 V, 627/617 nm. IRLZ44N RDS(on) 0.022/0.025/0.035,
Coss 400 pF, Crss 150 pF, VSD 1.3 V. TL072 AOL 200 V/mV, GBW 5.25 MHz (P package), SR 20 V/us,
eN 37 nV/rtHz, IB 65 pA, ZO 125 Ohm, all present on p. 15 and p. 16 as cited.

## Falsification attempts

| Probe | Outcome |
| --- | --- |
| 1N4148 at 3 uA to 50 mA, between fitted decades | Pass. Smooth, monotonic, about 97 mV/decade. |
| WP7113ID at 0.1 to 5 mA, at and below the 2 mA floor | Pass. Monotonic, no pathology below the claimed floor. |
| 2N3904 hFE at nine currents from 3.4 uA to 80 mA | Pass. Peaks near 196 at 6 mA. All five datasheet minimums met. |
| 2N3904 saturation edge, IB = 100 uA VCE sweep | Pass. Knee near 0.25 V, extracted Early voltage 99.7 V, matching the declared VAF = 100. |
| IRLZ44N transfer at VGS between fitted points | Pass. 11.29 A at 2.75 V through 123.96 A at 5.5 V, smooth. |
| IRLZ44N near threshold and body diode | Pass. 1.308 V at 25 A against a 1.3 V maximum. |
| IRLZ44N RDS(on) at 1, 10 and 25 A | Pass. Flat at 22.19 to 22.33 mOhm. |
| TL072 output swing at +/-15 V, RL = 10 k | **FAIL. Clips at +/-9.877 V. Typical is +/-13.5 V, guaranteed minimum +/-12 V.** |
| TL072 across its claimed 4.5 to 40 V supply envelope | **FAIL. Non-functional below about 20 V total.** |
| TL072 unity-gain follower step | Marginal. 30.9% overshoot implies roughly 37 degrees of phase margin against a published 56. |

## TL072 failure detail

`VDRP_H` and `VDRP_L` are both exactly 5.0 V and were never fitted: `fitted.json`
`calibration_iterations` only ever adjusts GBW and SR. The output clamp is
`min(max(v(p2), v(VEE)+5), v(VCC)-5)`, so usable swing is the supply minus 5 V on each rail.

Measured maximum output voltage against total supply, follower, RL = 10 k:

| Total supply | 4.5 V | 6 V | 9 V | 12 V | 18 V | 24 V | 30 V |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Max Vout | -2.716 V | -1.975 V | -0.494 V | +0.988 V | +3.951 V | +6.914 V | +9.877 V |

At or below 10 V total the clamp window collapses and inverts, pinning the output to a value that
does not track the input at all. A follower on +/-5 V rails returns 7.7e-9 V for every input from
-3 V to +3 V. `supported_operating_region` claims 4.5 V to 40 V, so the part is dead across the
entire lower half of its own declared envelope.

Root cause of the bad target: `fitted.json` records `positive output swing, datasheet_value 10,
citation p. 15`. The +/-10 V on p. 15 is the full-temperature-range guaranteed **minimum** for
RL >= 2 kOhm. The 25 degC **typical** is +/-13.5 V at RL = 10 kOhm. A guaranteed minimum was used
as a fitting target for typical behaviour. Against the correct typical the swing error is 30.2%,
which is the true worst error for this package, not the recorded 5.882% for open-loop gain.
Nothing in `known_omissions` discloses reduced output headroom.

## Required follow-ups for the author lane

1. TL072 blocker. Fit `VDRP_H` and `VDRP_L` to the 25 degC typical (about 1.5 V each), make the
   clamp degrade gracefully rather than invert when the supply is small, and correct the
   `positive/negative output swing` targets and the recorded worst fitting error.
2. TL072 secondary. Either widen the second-pole spacing to land near the published 56 degrees of
   phase margin, or state the phase margin in `known_omissions`.
3. IRLZ44N gate charge. `gate_charge.cir` states VDS = 44 V but the drain sits at 55.42 V because
   an ideal 25 A source into a floating drain drives the device into avalanche at BV = 55. The
   inflated drain swing inflates the Miller charge, and that artifact is the only reason the check
   passes: Qg at VGS = 5 V measures 19.84 nC against a 28 nC target, which is -29.1% inside a 30%
   tolerance. At the correct 44 V the value falls to roughly 17.5 nC and the check fails.
4. IRLZ44N documentation. Add the low-VDS Crss limitation to `known_omissions`. The two-segment
   CGD model misses the 1 V point by 39.436% while hitting the only tabulated condition, 25 V,
   to within 0.18%.
5. 2N3904 citations. Figures 15 and 17 are on p. 6, not p. 7. `sources.json` lists p. 7, which is
   the TO-92 case outline and was not used, and omits p. 6, which was.
6. 2N3904 source type. Figure 15 is explicitly "hFE, DC CURRENT GAIN (NORMALIZED)". The absolute
   targets 90/140/200/110/54 cannot be read from it without an unstated absolute-scale assumption.
   Record that inference. The values themselves are sound and meet every guaranteed minimum.
7. All packages. `MODEL_CARD.md` hardcodes "Independent reviewer: pending-review" and does not
   track `component.json`. Regenerate the cards.

## Systemic factory weaknesses for the P4 fan-out

1. **MIN/TYP/MAX column semantics are not tracked.** The TL072 failure is entirely this: a
   guaranteed minimum was consumed as a typical. Every fit target must record which column it came
   from, and fitted behaviour must target typicals.
2. **Expectations are self-consistent with the model.** `expectations.json` values were written
   from model output, so a bench can pass at 100% while sitting 27% from the datasheet. Expected
   values must be derived from the datasheet independently of the fit.
3. **Held defaults are presented as fitted.** VDRP_H/VDRP_L = 5, VTO = 2.0, VAF = 100, N = 1.5 and
   RS = 0.0044 all appear in "Fitted parameters" with no marker. Only VAF is disclosed. Held
   constants need an explicit flag in `fitted.json` and the model card.
4. **Fit metrics are computed off-engine for the diode archetype.** `fitted.json` carries
   `temperature_c: 25.0` and analytic residuals, but the shipped benches run at the ngspice default
   of 27 degC. Published worst errors understate the shipped ones: 1N4148 0.896% versus 1.573%
   measured, WP7113ID 0.758% versus 1.316% measured, and the point WP7113ID labels as worst is in
   fact its best-fitting point. Fitting metrics must be measured through the same engine and
   temperature the benches use.
5. **No supported-region boundary sweep.** Nothing exercised the declared operating envelope, which
   is why an op-amp that is dead across half its claimed supply range passed 10 of 10 benches. Every
   `numeric_bounds` entry needs a sweep to its limits.
6. **Bench bias conditions are not asserted.** The IRLZ44N gate-charge deck silently operates at
   55.4 V instead of its stated 44 V. Decks must assert the operating point they claim to establish.
7. **Page and figure citations are unverified.** The 2N3904 references are off by one page and point
   at a mechanical drawing.

## Addendum 2026-08-06: ti/TL072 re-review

Scope: `packages/model-library/models/ti/TL072/` only, after the author lane's refit in `a717e3b`.
All numbers below were re-measured by the reviewer against the refitted package.

**Verdict: PASS.** The reviewer field is now stamped.

The blocker is fixed at the root. `VDRP_H`/`VDRP_L` are now fitted values (1.33119 V per rail)
targeting the 25 degC typical, and the clamp is supply-aware:
`min(max(v(p2), v(VEE)+min(VDRP_L, 0.49*v(VCC,VEE))), v(VCC)-min(VDRP_H, 0.49*v(VCC,VEE)))`.
The 0.49 term makes the usable window at least 2% of the total supply, so the clamp can no longer
collapse or invert at any supply.

| Check | Before | Now |
| --- | --- | --- |
| Swing at +/-15 V, RL = 10 k (typ +/-13.5 V) | +/-9.877 V, -26.8% | **+/-13.500 V, 0.00%** |
| Follower at +/-5 V rails, Vin -3 to +3 V | 7.7e-9 V for every input | tracks with a constant +2.8 mV offset |
| Max output at 4.5 V total supply | -2.716 V, clamp inverted | +0.908 V, monotonic |
| Worst recorded fitting error | 5.882%, masking a 30.2% swing miss | 5.882% open-loop gain, now genuinely worst |

Supply sweep, follower, RL = 10 k, max output: 0.908 V at 4.5 V total, 1.648 at 6, 3.130 at 9,
4.611 at 12, 7.574 at 18, 10.537 at 24, 13.500 at 30, 16.463 at 36. Monotonic throughout, and the
18 V and 24 V points land where a real TL072 sits.

All 7 benches and 13 of 13 checks reproduce: swing +/-13.500 V; minimum-supply follower -0.247256,
+0.002745, +0.252746 against targets -0.247, 0.003, 0.253; slew 20.00 V/us measured 2 V to 7 V;
open-loop gain 105.494 dB inside the 0.6 dB window; short circuit 39.66 mA; common-mode gain 1.882.
`validate-package` passes and 5 of 5 native-versus-WASM comparisons agree.

Disclosures verified as added: the rail drop is documented as fitted to the 25 degC typical with an
explicit note that the datasheet publishes only a minimum at RL >= 2 kOhm; `fitted.json` gained
`held_defaults`, `parameter_metadata` and `rail_drop_fit`; expectations now name the MIN and TYP
columns; `.temp 25` is set in every deck. The p. 11 citation was checked against the datasheet: for
the P package the VS row reads 4.5 to 40 V under "All other devices", consistent with the same row
selection used for GBW, SR and eN, so the claimed envelope and the new bench are both correct.

Two non-blocking items remain for the author lane:

1. Closed-loop overshoot is unchanged at 30.9% for a 100 mV follower step, implying roughly 37
   degrees of phase margin against the published 56. This is now disclosed in `known_omissions`,
   which is why it does not block, but fitting FP2 to the measured overshoot would close it.
2. `minimum_supply_follower.cir` drives -0.25 to +0.25 V at +/-2.25 V rails. Page 11 gives the
   recommended input voltage at that supply as (VCC-) + 4, which is +1.75 V, so those inputs sit
   below a real part's usable common-mode window. The bench correctly proves the clamp no longer
   collapses, but it is a clamp test rather than a physically realisable operating point, and it
   passes only because common-mode limits are deliberately not modelled. Worth a note in the deck.
