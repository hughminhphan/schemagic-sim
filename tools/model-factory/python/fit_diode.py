#!/usr/bin/env python3
"""Diode archetype fitter.

Fits IS, N and RS to cited forward points, and, for parts whose facts declare it,
derives the ngspice reverse-breakdown block (BV, IBV, NBV) from published Zener
data and checks the result against the published Zener window and reverse-leakage
maximum.

Variants
--------
facts["diode_variant"] selects the parameter bounds:

  "standard"  the historical bounds. Used when the key is absent, so every part
              fitted before variants existed refits to the identical card.
  "schottky"  a Schottky barrier conducts by majority-carrier thermionic emission,
              so its ideality factor is physically at least 1 and in practice
              1.0 to 1.3. The standard lower bound of 0.8 is below anything
              physical: it lets the optimiser park there and report a converged
              fit where the honest answer is that the curve is not the shape a
              Schottky makes. Its saturation current is also orders of magnitude
              larger than a p-n junction's because the barrier is lower.
  "zener"     forward bounds as standard; the breakdown block below applies.

Breakdown derivation
--------------------
In reverse breakdown the ngspice diode satisfies

    V = BV + NBV * Vt * ln(I / IBV) + I * RS

(verified directly against ngspice-46: with BV=5.1, IBV=5 mA, NBV=11.6, RS=0.1
the model gives 5.1005 V at 5 mA and 5.3076 V at 10 mA). A datasheet states the
Zener voltage Vz at a test current Izt and the dynamic impedance Zzt at that same
current, which inverts to

    IBV = Izt
    BV  = Vz - Izt * RS
    NBV = (Zzt - RS) * Izt / Vt

NBV is the only parameter that carries the slope of the breakdown knee. Holding it
at the ngspice default of 1 forces a dynamic impedance of Vt/Izt, which for a
5 mA test current is about 5 ohm: an order of magnitude stiffer than a real
low-voltage Zener. A model with NBV held at 1 is a Zener-voltage claim only, and
says so in its parameter metadata.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from batched_jacobian import resolve_cap

K_BOLTZMANN = 1.380649e-23
Q_ELECTRON = 1.602176634e-19

# The residual below is closed-form in three parameters. scipy's own default cap is
# 100 * n = 300, and every shipped diode converges on ftol in well under a hundred
# evaluations. The historical 100000 was three orders of magnitude above anything ever
# reached, so it could not bound a pathological fit any sooner than a wall clock could.
MAX_NFEV = resolve_cap("OC_FIT_DIODE_MAX_NFEV", 3000)

# (IS lower, IS upper, N lower, N upper, RS lower, RS upper)
VARIANT_BOUNDS = {
    "standard": (1e-30, 1e-3, 0.8, 6.0, 0.0, 500.0),
    "zener": (1e-30, 1e-3, 0.8, 6.0, 0.0, 500.0),
    "schottky": (1e-9, 1e-2, 1.0, 2.0, 0.0, 50.0),
}

# An emission coefficient in the breakdown knee above this is not a diode any more,
# it is a resistor wearing a diode's card. Refuse rather than emit it.
NBV_MAXIMUM = 100.0


def thermal_voltage(temperature_c):
    return K_BOLTZMANN * (temperature_c + 273.15) / Q_ELECTRON


def diode_voltage(current, log_is, ideality, resistance, temperature_c):
    saturation_current = math.exp(log_is)
    return ideality * thermal_voltage(temperature_c) * np.log1p(current / saturation_current) + current * resistance


def variant_of(facts):
    variant = facts.get("diode_variant", "standard")
    if variant not in VARIANT_BOUNDS:
        raise SystemExit(f"unknown diode_variant {variant!r}; expected one of {sorted(VARIANT_BOUNDS)}")
    return variant


def quantity(container, name):
    value = container.get(name) if isinstance(container, dict) else None
    if not isinstance(value, dict) or not isinstance(value.get("value"), (int, float)):
        return None
    return value


def breakdown_from_zener_calibration(facts, resistance, temperature_c):
    """Derive (parameters, metadata, held_defaults) from a cited Vz, Izt and Zzt.

    Returns None when the part carries no Zener calibration block, so a part fitted
    before this existed refits to the identical card.
    """
    calibration = facts.get("zener_calibration")
    if not isinstance(calibration, dict):
        return None
    vz = quantity(calibration, "vz")
    izt = quantity(calibration, "izt")
    if vz is None or izt is None:
        raise SystemExit("zener_calibration must cite both vz and izt")
    if vz.get("unit") != "V" or izt.get("unit") != "A":
        raise SystemExit("zener_calibration vz must be in V and izt in A")
    zener_voltage = float(vz["value"])
    test_current = float(izt["value"])
    if not (zener_voltage > 0) or not (test_current > 0):
        raise SystemExit("zener_calibration vz and izt must both be positive magnitudes")

    breakdown_voltage = zener_voltage - test_current * resistance
    if not (breakdown_voltage > 0):
        raise SystemExit(
            f"the fitted series resistance {resistance:.6g} ohm accounts for the whole cited "
            f"Zener voltage {zener_voltage:.6g} V at {test_current:.6g} A; the forward fit and the "
            "breakdown evidence cannot both be right")

    zzt = quantity(calibration, "zzt")
    held = []
    if zzt is None:
        emission = 1.0
        nbv_status = "held_default_no_cited_dynamic_impedance"
        held.append({
            "parameter": "NBV", "value": 1.0, "unit": "1",
            "reason": "The source states no Zener dynamic impedance, so the breakdown knee slope is "
                      "not evidenced. NBV = 1 makes the card a Zener-voltage claim only: its dynamic "
                      "impedance is Vt/IZT, which is stiffer than any real device.",
        })
    else:
        if zzt.get("unit") not in {"ohm", "Ohm", "R"}:
            raise SystemExit("zener_calibration zzt must be in ohm")
        impedance = float(zzt["value"])
        if not (impedance > 0):
            raise SystemExit("zener_calibration zzt must be positive")
        junction_impedance = impedance - resistance
        if not (junction_impedance > 0):
            raise SystemExit(
                f"the fitted series resistance {resistance:.6g} ohm already exceeds the cited Zener "
                f"dynamic impedance {impedance:.6g} ohm; the forward and breakdown evidence disagree")
        emission = junction_impedance * test_current / thermal_voltage(temperature_c)
        if emission < 1.0:
            raise SystemExit(
                f"the cited dynamic impedance implies NBV = {emission:.6g}, below the physical floor of 1")
        if emission > NBV_MAXIMUM:
            raise SystemExit(
                f"the cited dynamic impedance implies NBV = {emission:.6g}, above the {NBV_MAXIMUM:g} "
                "ceiling; that knee is a resistor, not a breakdown characteristic")
        nbv_status = "derived_from_cited_dynamic_impedance"

    parameters = {"BV": breakdown_voltage, "IBV": test_current, "NBV": emission}
    metadata = {
        "BV": {"status": "derived_from_cited_zener_voltage",
               "citation": vz.get("page_reference"),
               "policy": "BV = VZ - IZT * RS, because ngspice adds the series drop on top of BV"},
        "IBV": {"status": "cited_zener_test_current", "citation": izt.get("page_reference")},
        "NBV": {"status": nbv_status,
                "citation": (zzt or {}).get("page_reference"),
                "policy": "NBV = (ZZT - RS) * IZT / Vt, from V = BV + NBV*Vt*ln(I/IBV) + I*RS"},
    }
    return parameters, metadata, held


def breakdown_voltage_at(current, parameters, resistance, temperature_c):
    """The model's reverse terminal voltage magnitude at a reverse current."""
    return (parameters["BV"]
            + parameters["NBV"] * thermal_voltage(temperature_c) * math.log(current / parameters["IBV"])
            + current * resistance)


def zener_window_checks(facts, parameters, resistance, temperature_c):
    """Every cited VZ MIN/MAX window the emitted card must land inside.

    A Zener whose model sits outside its own published window is not a weaker model,
    it is a false claim about the part, so each row records its own verdict.
    """
    rows = []
    for index, point in enumerate(facts.get("zener_points") or []):
        current = quantity(point, "current")
        lower = quantity(point, "voltage_minimum")
        upper = quantity(point, "voltage_maximum")
        if current is None or lower is None or upper is None:
            continue
        test_current = float(current["value"])
        if not (test_current > 0):
            continue
        modelled = breakdown_voltage_at(test_current, parameters, resistance, temperature_c)
        rows.append({
            "index": index,
            "current_a": test_current,
            "published_minimum_v": float(lower["value"]),
            "published_maximum_v": float(upper["value"]),
            "modelled_v": modelled,
            "inside_published_window": float(lower["value"]) <= modelled <= float(upper["value"]),
            "citations": [lower.get("page_reference"), upper.get("page_reference")],
        })
    return rows


def reverse_leakage_check(facts, saturation_current, parameters, temperature_c):
    """The model's pre-breakdown reverse current against the published maximum.

    An ngspice diode held below breakdown draws IS. Claiming MORE leakage than the
    datasheet's maximum is a wrong claim about the part in the direction that matters
    for a bias network, so it is recorded rather than left to inspection.
    """
    limits = facts.get("electrical_limits") or {}
    rows = []
    for name, entry in limits.items():
        if not name.startswith("reverse_current"):
            continue
        leakage = quantity(limits, name)
        if leakage is None or leakage.get("unit") != "A":
            continue
        published = float(leakage["value"])
        conditions = str(leakage.get("conditions") or "")
        reverse_voltage = None
        for token in conditions.replace("=", " ").split():
            try:
                reverse_voltage = float(token)
            except ValueError:
                continue
            else:
                break
        beyond_breakdown = (
            parameters is not None and reverse_voltage is not None
            and reverse_voltage >= parameters["BV"]
        )
        rows.append({
            "field": name,
            "published_maximum_a": published,
            "conditions": conditions,
            "citation": leakage.get("page_reference"),
            "model_reverse_current_a": saturation_current,
            "within_published_maximum": saturation_current <= published,
            **({"note": "The cited reverse-bias point sits at or beyond the modelled breakdown "
                        "voltage, so the model's current there is breakdown conduction and this "
                        "bound does not describe it."} if beyond_breakdown else {}),
        })
    return rows


def bound_notes(values, lower, upper, names):
    """Parameters resting on a bound. A bound is a constraint, not a measurement."""
    notes = []
    span = [max(abs(hi - lo), 1e-30) for lo, hi in zip(lower, upper)]
    for index, name in enumerate(names):
        value = float(values[index])
        at_lower = (value - lower[index]) / span[index] < 1e-9
        at_upper = (upper[index] - value) / span[index] < 1e-9
        if at_lower or at_upper:
            notes.append({
                "parameter": name,
                "value": math.exp(value) if name == "IS" else value,
                "bound": "lower" if at_lower else "upper",
                "reason": f"{name} rests on its {'lower' if at_lower else 'upper'} bound. The value is "
                          "set by the bound, not by the cited curve, so it is not a measurement of "
                          "this part.",
            })
    return notes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()

    facts = json.loads(Path(args.facts).read_text())
    points = facts["fit_points"]
    currents = np.array([point["current"]["value"] for point in points], dtype=float)
    voltages = np.array([point["voltage"]["value"] for point in points], dtype=float)
    temperature_c = float(facts["fit_conditions"]["temperature"]["value"])
    variant = variant_of(facts)
    is_low, is_high, n_low, n_high, rs_low, rs_high = VARIANT_BOUNDS[variant]

    held_defaults = []
    saturation_notes = []
    if len(points) == 1:
        derived = facts.get("derived_model_inputs", {})
        ideality = float(derived.get("N", {}).get("value", 1.2))
        resistance = float(derived.get("RS", {}).get("value", 0.0))
        exponent = max((float(voltages[0]) - float(currents[0]) * resistance) / (ideality * thermal_voltage(temperature_c)), 1e-9)
        saturation_current = float(currents[0]) / math.expm1(exponent)
        log_is = math.log(max(saturation_current, 1e-30))
        held_defaults = [
            {"parameter": "N", "value": ideality, "unit": "1", "reason": "Held physical default because the source supplies only one forward-voltage bound."},
            {"parameter": "RS", "value": resistance, "unit": "ohm", "reason": "Held physical default because the source supplies only one forward-voltage bound."},
        ]
    else:
        def residual(parameters):
            predicted = diode_voltage(currents, *parameters, temperature_c)
            return (predicted - voltages) / np.maximum(voltages, 0.1)

        lower = np.array([math.log(is_low), n_low, rs_low])
        upper = np.array([math.log(is_high), n_high, rs_high])
        result = least_squares(
            residual,
            x0=np.clip(np.array([math.log(1e-12), 1.8, 2.0]), lower, upper),
            bounds=(lower, upper),
            xtol=1e-14,
            ftol=1e-14,
            gtol=1e-14,
            max_nfev=MAX_NFEV,
        )
        if not result.success:
            raise SystemExit(f"fit failed: {result.message}")
        saturation_notes = bound_notes(result.x, lower, upper, ["IS", "N", "RS"])
        log_is, ideality, resistance = [float(value) for value in result.x]
        maximum_mask = np.array(["maximum" in point["voltage"]["source_kind"] for point in points], dtype=bool)
        if np.any(maximum_mask):
            predicted_bounds = diode_voltage(currents, log_is, ideality, resistance, temperature_c)
            overshoot = float(np.max(predicted_bounds[maximum_mask] - voltages[maximum_mask]))
            if overshoot > 0:
                log_is += overshoot / (ideality * thermal_voltage(temperature_c))
    predicted = diode_voltage(currents, log_is, ideality, resistance, temperature_c)
    rows = []
    for point, measured, fitted in zip(points, voltages, predicted):
        relative_error = abs(float(fitted - measured)) / abs(float(measured))
        rows.append({
            "current_a": point["current"]["value"],
            "datasheet_voltage_v": float(measured),
            "fitted_voltage_v": float(fitted),
            "relative_error": relative_error,
            "citation": point["voltage"]["page_reference"],
        })

    worst = max(rows, key=lambda row: row["relative_error"])
    derived = facts.get("derived_model_inputs", {})
    saturation_current = math.exp(log_is)
    parameters = {
        "IS": saturation_current,
        "N": ideality,
        "RS": resistance,
    }
    breakdown_metadata = {}
    calibrated = breakdown_from_zener_calibration(facts, resistance, temperature_c)
    for name in ["CJO", "TT", "BV", "IBV", "NBV"]:
        if name in derived and derived[name]["value"] > 0:
            parameters[name] = derived[name]["value"]
    if calibrated is not None:
        breakdown_parameters, breakdown_metadata, breakdown_held = calibrated
        parameters.update(breakdown_parameters)
        held_defaults = [*held_defaults, *breakdown_held]

    breakdown = {"BV": parameters["BV"], "IBV": parameters["IBV"], "NBV": parameters["NBV"]} \
        if {"BV", "IBV", "NBV"} <= parameters.keys() else None
    window_rows = zener_window_checks(facts, breakdown, resistance, temperature_c) if breakdown else []
    leakage_rows = reverse_leakage_check(facts, saturation_current, breakdown, temperature_c)

    output = {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares" if len(points) > 1 else "analytic_single_bound_with_held_defaults",
        "deterministic": True,
        "temperature_c": temperature_c,
        "parameters": parameters,
        "parameter_metadata": {
            "IS": {"status": "fitted" if len(points) > 1 else "derived_from_single_bound"},
            "N": {"status": "fitted" if len(points) > 1 else "held_default"},
            "RS": {"status": "fitted" if len(points) > 1 else "held_default"},
            "CJO": {"status": "derived_or_held_default"},
            "TT": {"status": "derived_or_held_default"},
            **{name: {"status": "datasheet_table"} for name in ["BV", "IBV", "NBV"] if name in parameters},
            **breakdown_metadata,
        },
        "held_defaults": held_defaults,
        "residuals": rows,
        "rms_relative_error": float(math.sqrt(np.mean(np.square([row["relative_error"] for row in rows])))),
        "worst_relative_error": {
            "value": worst["relative_error"],
            "quantity": f"forward voltage at {worst['current_a']:.6g} A",
        },
    }
    # Additive and only when the evidence exists, so a part fitted before variants and
    # breakdown checks existed refits to the identical document.
    if variant != "standard":
        output["diode_variant"] = variant
        output["variant_bounds"] = {
            "IS": [is_low, is_high], "N": [n_low, n_high], "RS": [rs_low, rs_high],
        }
    if saturation_notes:
        output["bound_saturation"] = saturation_notes
    if window_rows:
        output["zener_window_checks"] = window_rows
    if leakage_rows:
        output["reverse_leakage_checks"] = leakage_rows
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
