#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector

VT = 1.380649e-23 * 298.15 / 1.602176634e-19
BOUND_TOLERANCE = 1e-6


def fit_target(quantity):
    if quantity.get("source_kind") == "minimum":
        return 1.1 * quantity["value"]
    if quantity.get("source_kind") == "maximum":
        return 0.8 * quantity["value"]
    return quantity["value"]


def normalized_residual(actual, quantity, scale):
    kind = quantity.get("source_kind")
    target = quantity["value"]
    if kind == "minimum":
        return min(actual - target, 0.0) / scale
    if kind == "maximum":
        return max(actual - target, 0.0) / scale
    return (actual - target) / scale


def gain_log_residual(actual, quantity):
    ratio = max(actual, 1e-12) / max(quantity["value"], 1e-12)
    value = math.log(ratio)
    if quantity.get("source_kind") == "minimum":
        return min(value, 0.0)
    if quantity.get("source_kind") == "maximum":
        return max(value, 0.0)
    return value


def bound_saturated(value, lower, upper):
    span = max(abs(upper - lower), 1e-30)
    return (value - lower) / span < BOUND_TOLERANCE or (upper - value) / span < BOUND_TOLERANCE


def voltage_deembedded_capacitances(facts):
    capacitances = facts.get("capacitances") or {}
    held = []
    metadata = {}
    cobo = capacitances.get("cobo")
    cobo_vcb = capacitances.get("cobo_vcb")
    if cobo and cobo_vcb:
        cjc = cobo["value"] * (1 + abs(cobo_vcb["value"]) / 0.75) ** 0.33
        metadata["CJC"] = {
            "status": "voltage-de-embedded from cited Cobo at its cited VCB using VJC=0.75 V and MJC=0.33"
        }
    else:
        cjc = 1e-15
        metadata["CJC"] = {"status": "held at numerical floor; cited Cobo and VCB are both required"}
        held.append({
            "parameter": "CJC", "value": cjc,
            "reason": "held numerical floor; cited Cobo and its reverse-bias condition are unavailable",
        })
    cibo = capacitances.get("cibo")
    cibo_veb = capacitances.get("cibo_veb")
    if cibo and cibo_veb:
        cje = cibo["value"] * (1 + abs(cibo_veb["value"]) / 0.75) ** 0.33
        metadata["CJE"] = {
            "status": "voltage-de-embedded from cited Cibo at its cited VEB using VJE=0.75 V and MJE=0.33"
        }
    else:
        cje = 1e-15
        metadata["CJE"] = {"status": "held at numerical floor; cited Cibo and VEB are both required"}
        held.append({
            "parameter": "CJE", "value": cje,
            "reason": "held numerical floor; cited Cibo and its reverse-bias condition are unavailable",
        })
    return cje, cjc, metadata, held


def saturation_resistance_seeds(facts):
    points = [point for point in facts.get("saturation_points") or []
              if point.get("vce_sat") and point.get("vbe_sat")
              and point.get("collector_current") and point.get("base_current")]
    defaults = {"RE": 0.05, "RC": 0.1, "RB": 10.0}
    if len(points) < 2:
        return defaults, False
    ordered = sorted(points, key=lambda item: abs(item["collector_current"]["value"]))
    first, last = ordered[0], ordered[-1]
    delta_ic = abs(last["collector_current"]["value"]) - abs(first["collector_current"]["value"])
    delta_ib = abs(last["base_current"]["value"]) - abs(first["base_current"]["value"])
    if abs(delta_ic) <= 1e-15 or abs(delta_ib) <= 1e-15:
        return defaults, False
    slope = (last["vce_sat"]["value"] - first["vce_sat"]["value"]) / delta_ic
    resistance = max(slope, 2e-4)
    re0 = (0.15 if facts.get("device_class") == "power" else 0.25) * resistance
    rc0 = max(resistance - re0, 1e-4)
    rb0 = max((last["vbe_sat"]["value"] - first["vbe_sat"]["value"]) / delta_ib, 1e-4)
    return {"RE": re0, "RC": rc0, "RB": rb0}, True


def delay_corrected_tf(frequency_response, cje, cjc, rc, re):
    if not frequency_response:
        return 1e-12, "held at numerical floor; cited fT, IC, and VCE are required", True
    ft = frequency_response["ft"]["value"]
    ic_ft = abs(frequency_response["ic"]["value"])
    tau = 1 / (2 * math.pi * ft)
    gm = ic_ft / VT
    capacitance_delay = (cje + cjc) / gm
    resistance_delay = cjc * (rc + re)
    raw_tf = tau - capacitance_delay - resistance_delay
    tf = max(raw_tf, 1e-12)
    status = (
        "delay-corrected from cited fT after subtracting junction-capacitance and collector/emitter resistance delay"
        if raw_tf >= 1e-12
        else "delay-corrected cited fT reached the numerical floor because capacitance and resistance delay consume the published total delay"
    )
    return tf, status, raw_tf < 1e-12


def card(parameters, fixed, polarity, device_class):
    log_is, bf, log_ikf, log_ise, ne, re, rc, rb = parameters
    return (
        f".model QFIT {polarity}("
        f"IS={10**log_is:.12e} NF=1 BF={bf:.12g} IKF={10**log_ikf:.12e} "
        f"ISE={10**log_ise:.12e} NE={ne:.12g} VAF={fixed['VAF']:.12g} "
        f"BR={2 if device_class == 'power' else 4} NR=1 RB={rb:.12g} RE={re:.12g} RC={rc:.12g} "
        f"CJE={fixed['CJE']:.12e} VJE=0.75 MJE=0.33 CJC={fixed['CJC']:.12e} "
        "VJC=0.75 MJC=0.33 XCJC=1 FC=0.5 EG=1.11 XTI=3 TNOM=27)"
    )


def evaluate(parameters, fixed, facts):
    canonical_mpn = facts.get("identity", {}).get("canonical_mpn", "").upper()
    polarity = facts.get("model_polarity", "PNP" if canonical_mpn in {"MMBT3906", "2N3906", "TIP32C"} else "NPN")
    sign = -1 if polarity == "PNP" else 1
    lines = ["BJT native fit probe", card(parameters, fixed, polarity, facts.get("device_class")), ".temp 25"]
    for index, target in enumerate(facts["gain_points"], 1):
        base_current = abs(target["collector_current"]["value"]) / target["hfe"]["value"]
        lines += [
            f"VCG{index} cg{index} 0 DC {sign * abs(target['vce']['value'])}",
            f"IBG{index} 0 bg{index} DC {sign * base_current}",
            f"QG{index} cg{index} bg{index} 0 QFIT",
        ]
    for index, target in enumerate(facts.get("saturation_points") or [], 1):
        lines += [
            f"ICS{index} 0 cs{index} DC {sign * abs(target['collector_current']['value'])}",
            f"IBS{index} 0 bs{index} DC {sign * abs(target['base_current']['value'])}",
            f"QS{index} cs{index} bs{index} 0 QFIT",
        ]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    measured = {"gain": [], "saturation": []}
    for index, target in enumerate(facts["gain_points"], 1):
        base_current = abs(target["collector_current"]["value"]) / target["hfe"]["value"]
        collector = abs(vector(result, f"vcg{index}#branch", f"i(vcg{index})")[0])
        measured["gain"].append({
            "hfe": collector / base_current,
            "vbe": abs(float(vector(result, f"v(bg{index})", f"bg{index}")[0])),
        })
    for index, _ in enumerate(facts.get("saturation_points") or [], 1):
        measured["saturation"].append({
            "vce": abs(float(vector(result, f"v(cs{index})", f"cs{index}")[0])),
            "vbe": abs(float(vector(result, f"v(bs{index})", f"bs{index}")[0])),
        })
    return measured


def residual(parameters, fixed, facts):
    try:
        measured = evaluate(parameters, fixed, facts)
    except Exception:
        count = len(facts["gain_points"]) + sum("vbe" in point for point in facts["gain_points"]) + 2 * len(facts.get("saturation_points") or [])
        return np.full(count, 1e3)
    output = []
    for target, actual in zip(facts["gain_points"], measured["gain"]):
        output.append(5.0 * gain_log_residual(actual["hfe"], target["hfe"]))
        if "vbe" in target:
            output.append(normalized_residual(actual["vbe"], target["vbe"], 0.010))
    for target, actual in zip(facts.get("saturation_points") or [], measured["saturation"]):
        output.append(normalized_residual(actual["vce"], target["vce_sat"], 0.020))
        output.append(normalized_residual(actual["vbe"], target["vbe_sat"], 0.020))
    return np.asarray(output)


def gain_seed_residual(parameters, fixed, facts, log_is, re, rc, rb):
    bf, log_ikf, log_ise, ne = parameters
    expanded = np.array([log_is, bf, log_ikf, log_ise, ne, re, rc, rb])
    try:
        measured = evaluate(expanded, fixed, facts)
    except Exception:
        return np.full(len(facts["gain_points"]), 1e3)
    return np.asarray([
        gain_log_residual(actual["hfe"], target["hfe"])
        for target, actual in zip(facts["gain_points"], measured["gain"])
    ])


def conveyor_f1_gain_residual(parameters, fixed, facts, log_is, re, rc, rb):
    bf, log_ikf = parameters
    expanded = np.array([log_is, bf, log_ikf, -18.0, 1.5, re, rc, rb])
    try:
        measured = evaluate(expanded, fixed, facts)
    except Exception:
        return np.full(len(facts["gain_points"]), 1e3)
    return np.asarray([
        gain_log_residual(actual["hfe"], target["hfe"])
        for target, actual in zip(facts["gain_points"], measured["gain"])
    ])


def voltage_residual(parameters, fixed, facts, gain_parameters):
    log_is, re, rc, rb = parameters
    bf, log_ikf, log_ise, ne = gain_parameters
    expanded = np.array([log_is, bf, log_ikf, log_ise, ne, re, rc, rb])
    try:
        measured = evaluate(expanded, fixed, facts)
    except Exception:
        return np.full(sum("vbe" in point for point in facts["gain_points"]) + 2 * len(facts.get("saturation_points") or []), 1e3)
    output = []
    for target, actual in zip(facts["gain_points"], measured["gain"]):
        if "vbe" in target:
            output.append((actual["vbe"] - fit_target(target["vbe"])) / 0.010)
    for target, actual in zip(facts.get("saturation_points") or [], measured["saturation"]):
        output.append((actual["vce"] - fit_target(target["vce_sat"])) / 0.020)
        output.append((actual["vbe"] - fit_target(target["vbe_sat"])) / 0.020)
    return np.asarray(output)


def fit_facts(facts):
    gain_points = facts.get("gain_points") or []
    if not gain_points:
        raise ValueError("insufficient-extracted-targets: BJT requires at least one cited gain point")
    cje, cjc, capacitance_metadata, held = voltage_deembedded_capacitances(facts)
    resistance_seed, resistance_fit_supported = saturation_resistance_seeds(facts)
    conveyor_f1 = facts.get("fit_mode") == "conveyor_f1"
    if conveyor_f1:
        typical_points = [point for point in gain_points
                          if point["hfe"].get("source_kind") not in {"minimum", "maximum"}]
        minimum_points = [point for point in gain_points
                          if point["hfe"].get("source_kind") == "minimum"]
        maximum_points = [point for point in gain_points
                          if point["hfe"].get("source_kind") == "maximum"]
        if typical_points:
            peak = max(typical_points, key=lambda item: item["hfe"]["value"])
            bf0 = peak["hfe"]["value"]
        elif minimum_points:
            peak = max(minimum_points, key=lambda item: item["hfe"]["value"])
            bf0 = peak["hfe"]["value"]
        else:
            peak = min(maximum_points, key=lambda item: item["hfe"]["value"])
            bf0 = 0.7 * peak["hfe"]["value"]
    else:
        peak = max(gain_points, key=lambda item: item["hfe"]["value"])
        bf0 = peak["hfe"]["value"]
    ikf0 = abs(peak["collector_current"]["value"]) * 3
    vbe_candidates = [point for point in gain_points if "vbe" in point]
    if vbe_candidates:
        vbe_seed = min(vbe_candidates, key=lambda item: abs(abs(item["collector_current"]["value"]) - 0.01))
        seed_voltage = vbe_seed["vbe"]["value"]
        is_status = "native fitted from cited voltage evidence" if resistance_fit_supported else "derived from cited VBE evidence"
    else:
        vbe_seed = min(gain_points, key=lambda item: abs(abs(item["collector_current"]["value"]) - 0.01))
        seed_voltage = 0.70
        is_status = "held physical default; no cited VBE evidence identifies IS"
    re0, rc0, rb0 = resistance_seed["RE"], resistance_seed["RC"], resistance_seed["RB"]
    is0 = abs(vbe_seed["collector_current"]["value"]) * math.exp(-(seed_voltage - abs(vbe_seed["collector_current"]["value"]) * re0) / VT)
    if not vbe_candidates:
        is0 = 1e-14
        held.append({"parameter": "IS", "value": is0, "reason": is_status})
    log_is0 = min(max(math.log10(max(is0, 1e-18)), -18), -10)
    fixed = {"CJE": max(cje, 1e-15), "CJC": max(cjc, 1e-15), "VAF": 60.0 if facts.get("device_class") == "power" else 100.0}
    if conveyor_f1:
        gain_lo = np.array([1, -4])
        gain_hi = np.array([5000, 2])
        seed_fit = least_squares(
            conveyor_f1_gain_residual,
            x0=np.array([max(bf0 * 1.1, 2), min(max(math.log10(max(ikf0, 1e-4)), -4), 2)]),
            bounds=(gain_lo, gain_hi),
            args=(fixed, facts, log_is0, re0, rc0, rb0),
            method="trf", x_scale="jac", diff_step=1e-4,
            ftol=1e-10, xtol=1e-10, max_nfev=5000,
        )
        bf, log_ikf = [float(value) for value in seed_fit.x]
        log_ise, ne = -18.0, 1.5
        held.extend([
            {"parameter": "ISE", "value": 1e-18, "reason": "held numerical floor; scalar hFE rows do not identify low-current recombination"},
            {"parameter": "NE", "value": ne, "reason": "held archetype default; scalar hFE rows do not identify the recombination ideality"},
        ])
    else:
        gain_lo = np.array([1, -4, -18, 1.2])
        gain_hi = np.array([5000, 2, -6, 4.0])
        seed_fit = least_squares(
            gain_seed_residual,
            x0=np.array([max(bf0 * 1.1, 2), min(max(math.log10(max(ikf0, 1e-4)), -4), 2), -12.5, 1.5]),
            bounds=(gain_lo, gain_hi),
            args=(fixed, facts, log_is0, re0, rc0, rb0),
            method="trf", x_scale="jac", diff_step=1e-4,
            ftol=1e-10, xtol=1e-10, max_nfev=5000,
        )
        bf, log_ikf, log_ise, ne = [float(value) for value in seed_fit.x]
    if seed_fit.status <= 0:
        raise RuntimeError("BJT native gain fit failed")
    voltage_nfev = 0
    joint_nfev = 0
    joint_status = int(seed_fit.status)
    fitted_vector = np.array([log_is0, bf, log_ikf, log_ise, ne, re0, rc0, rb0])
    if resistance_fit_supported:
        voltage_lo = np.array([-18, 1e-4, 1e-4, 1e-4])
        voltage_hi = np.array([-10, 20, 100, 1000])
        gain_parameters = np.array([bf, log_ikf, log_ise, ne])
        voltage_fit = least_squares(
            voltage_residual,
            x0=np.array([log_is0, re0, rc0, rb0]),
            bounds=(voltage_lo, voltage_hi),
            args=(fixed, facts, gain_parameters),
            method="trf", x_scale="jac", diff_step=1e-4,
            ftol=1e-10, xtol=1e-10, max_nfev=5000,
        )
        if voltage_fit.status <= 0:
            raise RuntimeError("BJT staged native voltage fit failed")
        voltage_nfev = int(voltage_fit.nfev)
        staged_vector = np.array([float(voltage_fit.x[0]), bf, log_ikf, log_ise, ne,
                                  float(voltage_fit.x[1]), float(voltage_fit.x[2]), float(voltage_fit.x[3])])
        if conveyor_f1:
            fitted_vector = staged_vector
            joint_status = int(voltage_fit.status)
        else:
            joint_lo = np.array([-18, 1, -4, -18, 1.2, 1e-4, 1e-4, 1e-4])
            joint_hi = np.array([-10, 5000, 2, -6, 4.0, 20, 100, 1000])
            joint_fit = least_squares(
                residual, x0=staged_vector, bounds=(joint_lo, joint_hi), args=(fixed, facts),
                method="trf", x_scale="jac", diff_step=1e-4,
                ftol=1e-10, xtol=1e-10, max_nfev=5000,
            )
            if joint_fit.status <= 0:
                raise RuntimeError("BJT joint native fit failed")
            fitted_vector = joint_fit.x
            joint_nfev = int(joint_fit.nfev)
            joint_status = int(joint_fit.status)
    else:
        held.extend([
            {"parameter": "RB", "value": rb0, "reason": "held archetype default; at least two independent cited saturation conditions are required to fit RB"},
            {"parameter": "RC", "value": rc0, "reason": "held archetype default; at least two independent cited saturation conditions are required to fit RC"},
            {"parameter": "RE", "value": re0, "reason": "held archetype default; at least two independent cited saturation conditions are required to fit RE"},
        ])
    log_is, bf, log_ikf, log_ise, ne, re_value, rc_value, rb_value = [float(value) for value in fitted_vector]
    measured = evaluate(fitted_vector, fixed, facts)
    frequency_response = facts.get("frequency_response")
    tf, tf_status, tf_at_floor = delay_corrected_tf(frequency_response, cje, cjc, rc_value, re_value)
    if not frequency_response:
        held.append({"parameter": "TF", "value": tf, "reason": tf_status})
    storage = frequency_response.get("storage_time") if frequency_response else None
    tr = storage["value"] / math.log(2) if storage else 0.0
    if not storage:
        held.append({"parameter": "TR", "value": tr, "reason": "held at zero; no cited storage time"})
    rows = []
    for target, actual in zip(gain_points, measured["gain"]):
        quantities = [("hFE", "hfe", "1")]
        if "vbe" in target:
            quantities.append(("VBE", "vbe", "V"))
        for quantity_name, target_key, unit in quantities:
            target_value = target[target_key]["value"]
            actual_value = actual[target_key]
            rows.append({
                "quantity": f"{quantity_name} at IC={abs(target['collector_current']['value']):.6g} A, VCE={abs(target['vce']['value']):.6g} V",
                "datasheet_value": target_value, "fitted_value": actual_value, "unit": unit,
                "source_kind": target[target_key].get("source_kind"),
                "relative_error": abs(actual_value - target_value) / abs(target_value),
                "citation": target[target_key]["page_reference"],
            })
    for target, actual in zip(facts.get("saturation_points") or [], measured["saturation"]):
        for quantity_name, target_key, actual_key in [("VCE(sat)", "vce_sat", "vce"), ("VBE(sat)", "vbe_sat", "vbe")]:
            target_value = target[target_key]["value"]
            actual_value = actual[actual_key]
            rows.append({
                "quantity": f"{quantity_name} at IC={abs(target['collector_current']['value']):.6g} A",
                "datasheet_value": target_value, "fitted_value": actual_value, "unit": "V",
                "source_kind": target[target_key].get("source_kind"),
                "relative_error": abs(actual_value - target_value) / abs(target_value),
                "citation": target[target_key]["page_reference"],
            })
    worst = max(rows, key=lambda row: row["relative_error"])
    bound_hits = []
    for name, value, lower, upper in zip(["BF", "log10(IKF)", "log10(ISE)", "NE"], seed_fit.x, gain_lo, gain_hi):
        if bound_saturated(float(value), float(lower), float(upper)):
            bound_hits.append(name)
    if resistance_fit_supported:
        for name, value, lower, upper in zip(["log10(IS)", "RE", "RC", "RB"],
                                             [log_is, re_value, rc_value, rb_value],
                                             [-18, 1e-4, 1e-4, 1e-4], [-10, 20, 100, 1000]):
            if bound_saturated(value, lower, upper):
                bound_hits.append(name)
    output = {
        "schema_version": "1.0.0",
        "fidelity": "F1",
        "fitter": "canonical fit_bjt scipy.optimize.least_squares with native ngspice-46 evaluations",
        "deterministic": True,
        "parameters": {
            "IS": 10**log_is, "NF": 1.0, "BF": bf, "IKF": 10**log_ikf,
            "ISE": 10**log_ise, "NE": ne, "VAF": fixed["VAF"],
            "BR": 2.0 if facts.get("device_class") == "power" else 4.0,
            "RB": rb_value, "RE": re_value, "RC": rc_value,
            "CJE": cje, "VJE": 0.75, "MJE": 0.33,
            "CJC": cjc, "VJC": 0.75, "MJC": 0.33, "XCJC": 1.0,
            "TF": tf, "TR": tr,
        },
        "parameter_metadata": {
            "IS": {"status": is_status}, "BF": {"status": "native fitted against every condition-specific cited hFE point"},
            "IKF": {"status": "native fitted"},
            "ISE": {"status": "held default" if conveyor_f1 else "native fitted"},
            "NE": {"status": "held default" if conveyor_f1 else "native fitted"},
            "RB": {"status": "native fitted; cited saturation slopes were optimizer seeds only" if resistance_fit_supported else "held default"},
            "RE": {"status": "native fitted; cited saturation slopes were optimizer seeds only" if resistance_fit_supported else "held default"},
            "RC": {"status": "native fitted; cited saturation slopes were optimizer seeds only" if resistance_fit_supported else "held default"},
            **capacitance_metadata,
            "TF": {"status": tf_status},
            "TR": {"status": "derived from cited storage time" if storage else "held default"},
            "VAF": {"status": "held at archetype default; no fitted output-curve family"},
            "NF": {"status": "held default"}, "BR": {"status": "held default"},
            "VJE": {"status": "held default"}, "MJE": {"status": "held default"},
            "VJC": {"status": "held default"}, "MJC": {"status": "held default"}, "XCJC": {"status": "held default"},
        },
        "held_defaults": held,
        "optimizer": {
            "status": joint_status, "gain_nfev": int(seed_fit.nfev),
            "voltage_nfev": voltage_nfev, "joint_nfev": joint_nfev,
            "diff_step": 1e-4, "resistance_seed_only": True,
            "resistance_fit_supported": resistance_fit_supported,
            "bound_saturated_parameters": bound_hits,
            "tf_at_numerical_floor": tf_at_floor,
        },
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    output = fit_facts(facts)
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
