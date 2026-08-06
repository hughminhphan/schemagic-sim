#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector

VT = 1.380649e-23 * 298.15 / 1.602176634e-19


def card(parameters, fixed):
    log_is, bf, log_ikf, log_ise, ne, re, rc, rb = parameters
    return (
        ".model QFIT NPN("
        f"IS={10**log_is:.12e} NF=1 BF={bf:.12g} IKF={10**log_ikf:.12e} "
        f"ISE={10**log_ise:.12e} NE={ne:.12g} VAF={fixed['VAF']:.12g} "
        f"BR=4 NR=1 RB={rb:.12g} RE={re:.12g} RC={rc:.12g} "
        f"CJE={fixed['CJE']:.12e} VJE=0.75 MJE=0.33 CJC={fixed['CJC']:.12e} "
        "VJC=0.75 MJC=0.33 XCJC=1 FC=0.5 EG=1.11 XTI=3 TNOM=27)"
    )


def evaluate(parameters, fixed, facts):
    lines = ["BJT native fit probe", card(parameters, fixed)]
    for index, target in enumerate(facts["gain_points"], 1):
        base_current = target["collector_current"]["value"] / target["hfe"]["value"]
        lines += [
            f"VCG{index} cg{index} 0 DC {target['vce']['value']}",
            f"IBG{index} 0 bg{index} DC {base_current}",
            f"QG{index} cg{index} bg{index} 0 QFIT",
        ]
    for index, target in enumerate(facts["saturation_points"], 1):
        lines += [
            f"ICS{index} 0 cs{index} DC {target['collector_current']['value']}",
            f"IBS{index} 0 bs{index} DC {target['base_current']['value']}",
            f"QS{index} cs{index} bs{index} 0 QFIT",
        ]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    measured = {"gain": [], "saturation": []}
    for index, target in enumerate(facts["gain_points"], 1):
        base_current = target["collector_current"]["value"] / target["hfe"]["value"]
        collector = abs(vector(result, f"vcg{index}#branch", f"i(vcg{index})")[0])
        measured["gain"].append({
            "hfe": collector / base_current,
            "vbe": float(vector(result, f"v(bg{index})", f"bg{index}")[0]),
        })
    for index, _ in enumerate(facts["saturation_points"], 1):
        measured["saturation"].append({
            "vce": float(vector(result, f"v(cs{index})", f"cs{index}")[0]),
            "vbe": float(vector(result, f"v(bs{index})", f"bs{index}")[0]),
        })
    return measured


def residual(parameters, fixed, facts):
    try:
        measured = evaluate(parameters, fixed, facts)
    except Exception:
        count = len(facts["gain_points"]) + sum("vbe" in point for point in facts["gain_points"]) + len(facts["saturation_points"])
        return np.full(count, 1e3)
    output = []
    for target, actual in zip(facts["gain_points"], measured["gain"]):
        output.append(math.log(max(actual["hfe"], 1e-12)) - math.log(target["hfe"]["value"]))
        if "vbe" in target:
            output.append((actual["vbe"] - target["vbe"]["value"]) / 0.010)
    for target, actual in zip(facts["saturation_points"], measured["saturation"]):
        output.append((actual["vce"] - target["vce_sat"]["value"]) / 0.020)
    return np.asarray(output)


def gain_seed_residual(parameters, fixed, facts, log_is, re, rc, rb):
    bf, log_ikf, log_ise, ne = parameters
    expanded = np.array([log_is, bf, log_ikf, log_ise, ne, re, rc, rb])
    try:
        measured = evaluate(expanded, fixed, facts)
    except Exception:
        return np.full(len(facts["gain_points"]), 1e3)
    return np.asarray([
        math.log(max(actual["hfe"], 1e-12)) - math.log(target["hfe"]["value"])
        for target, actual in zip(facts["gain_points"], measured["gain"])
    ])


def voltage_residual(parameters, fixed, facts, gain_parameters):
    log_is, re, rc, rb = parameters
    bf, log_ikf, log_ise, ne = gain_parameters
    expanded = np.array([log_is, bf, log_ikf, log_ise, ne, re, rc, rb])
    try:
        measured = evaluate(expanded, fixed, facts)
    except Exception:
        return np.full(sum("vbe" in point for point in facts["gain_points"]) + len(facts["saturation_points"]), 1e3)
    output = []
    for target, actual in zip(facts["gain_points"], measured["gain"]):
        if "vbe" in target:
            output.append((actual["vbe"] - target["vbe"]["value"]) / 0.010)
    for target, actual in zip(facts["saturation_points"], measured["saturation"]):
        output.append((actual["vce"] - target["vce_sat"]["value"]) / 0.020)
    return np.asarray(output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())

    cjc = facts["capacitances"]["cobo"]["value"] * (1 + facts["capacitances"]["cobo_vcb"]["value"] / 0.75) ** 0.33
    cje = facts["capacitances"]["cibo"]["value"] * (1 + facts["capacitances"]["cibo_veb"]["value"] / 0.75) ** 0.33
    sat1, sat2 = facts["saturation_points"][:2]
    slope = (sat2["vce_sat"]["value"] - sat1["vce_sat"]["value"]) / (sat2["collector_current"]["value"] - sat1["collector_current"]["value"])
    resistance = max(slope, 2e-4)
    re0 = 0.25 * resistance
    rc0 = resistance - re0
    rb0 = max((sat2["vbe_sat"]["value"] - sat1["vbe_sat"]["value"]) / (sat2["base_current"]["value"] - sat1["base_current"]["value"]), 1e-4)
    peak = max(facts["gain_points"], key=lambda item: item["hfe"]["value"])
    bf0 = peak["hfe"]["value"]
    ikf0 = peak["collector_current"]["value"] * 3
    vbe_seed = min(facts["gain_points"], key=lambda item: abs(item["collector_current"]["value"] - 0.01))
    is0 = vbe_seed["collector_current"]["value"] * math.exp(-(vbe_seed["vbe"]["value"] - vbe_seed["collector_current"]["value"] * re0) / VT)
    fixed = {"CJE": max(cje, 1e-15), "CJC": max(cjc, 1e-15), "VAF": 100.0}
    log_is0 = math.log10(is0)
    seed_fit = least_squares(
        gain_seed_residual,
        x0=np.array([max(bf0 * 2, 250), math.log10(ikf0), -12.5, 1.5]),
        bounds=(np.array([1, -4, -18, 1.2]), np.array([2000, 2, -6, 4.0])),
        args=(fixed, facts, log_is0, re0, rc0, rb0),
        method="trf",
        x_scale="jac",
        diff_step=1e-4,
        ftol=1e-10,
        xtol=1e-10,
        max_nfev=5000,
    )
    voltage_fit = least_squares(
        voltage_residual,
        x0=np.array([log_is0, re0, rc0, rb0]),
        bounds=(np.array([-18, 1e-4, 1e-4, 1e-4]), np.array([-10, 20, 100, 1000])),
        args=(fixed, facts, seed_fit.x),
        method="trf",
        x_scale="jac",
        diff_step=1e-4,
        ftol=1e-10,
        xtol=1e-10,
        max_nfev=5000,
    )
    if seed_fit.status <= 0 or voltage_fit.status <= 0:
        raise SystemExit("BJT staged native fit failed")
    bf, log_ikf, log_ise, ne = [float(value) for value in seed_fit.x]
    log_is, re, rc, rb = [float(value) for value in voltage_fit.x]
    fitted_vector = np.array([log_is, bf, log_ikf, log_ise, ne, re, rc, rb])
    measured = evaluate(fitted_vector, fixed, facts)
    ft = facts["frequency_response"]["ft"]["value"]
    ic_ft = facts["frequency_response"]["ic"]["value"]
    tau = 1 / (2 * math.pi * ft)
    gm = ic_ft / VT
    tf = max(tau - (cje + cjc) / gm - cjc * (rc + re), 1e-12)
    storage = facts["frequency_response"].get("storage_time")
    tr = storage["value"] / math.log(2) if storage else 0.0
    rows = []
    for target, actual in zip(facts["gain_points"], measured["gain"]):
        quantities = [("hFE", "hfe", "1")]
        if "vbe" in target:
            quantities.append(("VBE", "vbe", "V"))
        for quantity_name, target_key, unit in quantities:
            target_value = target[target_key]["value"]
            actual_value = actual[target_key]
            rows.append({
                "quantity": f"{quantity_name} at IC={target['collector_current']['value']:.6g} A",
                "datasheet_value": target_value,
                "fitted_value": actual_value,
                "unit": unit,
                "relative_error": abs(actual_value - target_value) / abs(target_value),
                "citation": target[target_key]["page_reference"],
            })
    for target, actual in zip(facts["saturation_points"], measured["saturation"]):
        for quantity_name, target_key, actual_key in [("VCE(sat)", "vce_sat", "vce"), ("VBE(sat)", "vbe_sat", "vbe")]:
            target_value = target[target_key]["value"]
            actual_value = actual[actual_key]
            rows.append({
                "quantity": f"{quantity_name} at IC={target['collector_current']['value']:.6g} A",
                "datasheet_value": target_value,
                "fitted_value": actual_value,
                "unit": "V",
                "relative_error": abs(actual_value - target_value) / abs(target_value),
                "citation": target[target_key]["page_reference"],
            })
    worst = max(rows, key=lambda row: row["relative_error"])
    output = {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares with native ngspice-46 evaluations",
        "deterministic": True,
        "parameters": {
            "IS": 10**log_is, "NF": 1.0, "BF": bf, "IKF": 10**log_ikf,
            "ISE": 10**log_ise, "NE": ne, "VAF": fixed["VAF"], "BR": 4.0,
            "RB": rb, "RE": re, "RC": rc, "CJE": cje, "VJE": 0.75,
            "MJE": 0.33, "CJC": cjc, "VJC": 0.75, "MJC": 0.33,
            "XCJC": 1.0, "TF": tf, "TR": tr,
        },
        "optimizer": {"status": int(voltage_fit.status), "gain_nfev": int(seed_fit.nfev), "voltage_nfev": int(voltage_fit.nfev), "cost": float(seed_fit.cost + voltage_fit.cost), "diff_step": 1e-4},
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
