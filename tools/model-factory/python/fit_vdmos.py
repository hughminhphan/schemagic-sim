#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector

VT = 1.380649e-23 * 298.15 / 1.602176634e-19
NOMINAL_TEMPERATURE = ".temp 25"


def model_card(dc, fixed, a_value=None):
    vto, kp, theta, lam, rd = dc
    a = fixed["A"] if a_value is None else a_value
    return (
        ".model MFIT VDMOS("
        f"VTO={vto:.12g} KP={kp:.12g} THETA={theta:.12g} LAMBDA={lam:.12g} "
        f"RD={rd:.12g} RS={fixed['RS']:.12g} RG={fixed['RG']:.12g} RDS=1e9 "
        f"CGS={fixed['CGS']:.12e} CGDMAX={fixed['CGDMAX']:.12e} "
        f"CGDMIN={fixed['CGDMIN']:.12e} A={a:.12g} CJO={fixed['CJO']:.12e} "
        f"VJ=0.8 M=0.5 FC=0.5 IS={fixed['IS']:.12e} N=1.5 RB={fixed['RB']:.12g} "
        f"TT={fixed['TT']:.12e} BV={fixed['BV']:.12g} IBV={fixed['IBV']:.12e} NBV=1 "
        f"RTHJC={fixed['RTHJC']:.12g} RTHCA={fixed['RTHCA']:.12g} TNOM=27)"
    )


def evaluate_dc(parameters, fixed, facts):
    lines = ["VDMOS native DC fit probe", model_card(parameters, fixed), NOMINAL_TEMPERATURE]
    for index, point in enumerate(facts["transfer_points"], 1):
        lines += [f"MT{index} dt{index} gt{index} 0 MFIT", f"VDT{index} dt{index} 0 DC 25", f"VGT{index} gt{index} 0 DC {point['vgs']['value']}"]
    for index, point in enumerate(facts["rdson_points"], 1):
        lines += [f"MR{index} dr{index} gr{index} 0 MFIT", f"IDR{index} 0 dr{index} DC {point['current']['value']}", f"VGR{index} gr{index} 0 DC {point['vgs']['value']}"]
    for index, point in enumerate(facts["output_points"], 1):
        lines += [f"MO{index} do{index} go{index} 0 MFIT", f"VDO{index} do{index} 0 DC {point['vds']['value']}", f"VGO{index} go{index} 0 DC {point['vgs']['value']}"]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    measured = {"transfer": [], "rdson": [], "output": []}
    for index, _ in enumerate(facts["transfer_points"], 1):
        measured["transfer"].append(abs(vector(result, f"vdt{index}#branch", f"i(vdt{index})")[0]))
    for index, point in enumerate(facts["rdson_points"], 1):
        measured["rdson"].append(float(vector(result, f"v(dr{index})", f"dr{index}")[0]) / point["current"]["value"])
    for index, _ in enumerate(facts["output_points"], 1):
        measured["output"].append(abs(vector(result, f"vdo{index}#branch", f"i(vdo{index})")[0]))
    return measured


def dc_residual(parameters, fixed, facts):
    try:
        measured = evaluate_dc(parameters, fixed, facts)
    except Exception:
        return np.full(len(facts["transfer_points"]) + len(facts["rdson_points"]) + len(facts["output_points"]), 1e3)
    output = []
    for target, actual in zip(facts["transfer_points"], measured["transfer"]):
        output.append(math.log(max(actual, 1e-12)) - math.log(target["current"]["value"]))
    for target, actual in zip(facts["rdson_points"], measured["rdson"]):
        desired = target["resistance"]["value"]
        normalized = (actual - desired) / desired
        if target["resistance"].get("source_kind") == "maximum":
            output.append(20.0 * max(normalized, 0.0) + 0.05 * min(normalized, 0.0))
        else:
            output.append(normalized)
    for target, actual in zip(facts["output_points"], measured["output"]):
        output.append(math.log(max(actual, 1e-12)) - math.log(target["current"]["value"]))
    return np.asarray(output)


def evaluate_capacitance(a_value, dc, fixed, facts):
    lines = ["VDMOS native capacitance fit probe", model_card(dc, fixed, a_value), NOMINAL_TEMPERATURE]
    for index, point in enumerate(facts["capacitances"]["crss_curve"], 1):
        lines += [f"MC{index} dc{index} gc{index} 0 MFIT", f"VDC{index} dc{index} 0 DC {point['vds']['value']} AC 1", f"VGC{index} gc{index} 0 DC 0"]
    lines += [".ac lin 1 1Meg 1Meg", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    frequency = 1e6
    values = []
    for index, _ in enumerate(facts["capacitances"]["crss_curve"], 1):
        gate_current = vector(result, f"vgc{index}#branch", f"i(vgc{index})")[0]
        values.append(abs(gate_current.imag) / (2 * math.pi * frequency))
    return values


def cap_residual(parameters, dc, fixed, facts):
    try:
        measured = evaluate_capacitance(float(parameters[0]), dc, fixed, facts)
    except Exception:
        return np.full(len(facts["capacitances"]["crss_curve"]), 1e3)
    return np.asarray([(actual - point["crss"]["value"]) / point["crss"]["value"] for point, actual in zip(facts["capacitances"]["crss_curve"], measured)])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    caps = facts["capacitances"]
    rdson_seed = facts["rdson_points"][0]["resistance"]["value"]
    rs = max(0.10 * rdson_seed, 1e-4)
    rd_seed = max(0.55 * rdson_seed, 1e-4)
    cgs = max(caps["ciss"]["value"] - caps["crss"]["value"], 1e-15)
    cds = max(caps["coss"]["value"] - caps["crss"]["value"], 1e-15)
    cjo = cds * math.sqrt(1 + caps["vds_test"]["value"] / 0.8)
    cgmax = caps["crss_curve"][0]["crss"]["value"]
    cgmin = caps["crss_curve"][-1]["crss"]["value"]
    body = facts["body_diode"]
    rb = max(0.2 * rdson_seed, 1e-4)
    diode_is = body["current"]["value"] * math.exp(-(body["vsd"]["value"] - body["current"]["value"] * rb) / (1.5 * VT))
    fixed = {
        "RS": rs, "RG": 1e-4, "CGS": cgs, "CGDMAX": cgmax, "CGDMIN": cgmin,
        "A": 1.0, "CJO": cjo, "IS": diode_is, "N": 1.5, "RB": rb, "TT": body["trr"]["value"] / math.log(2),
        "BV": facts["breakdown"]["voltage"]["value"], "IBV": facts["breakdown"]["current"]["value"],
        "RTHJC": facts["thermal"]["rthjc"]["value"], "RTHCA": facts["thermal"]["rthja"]["value"] - facts["thermal"]["rthjc"]["value"],
    }
    vto0 = 0.5 * (facts["threshold"]["minimum"]["value"] + facts["threshold"]["maximum"]["value"])
    hi = facts["transfer_points"][-1]
    kp0 = 2 * hi["current"]["value"] / (hi["vgs"]["value"] - vto0) ** 2
    x0 = np.array([vto0, kp0, 0.05, 0.003, rd_seed])
    lower = np.array([facts["threshold"]["minimum"]["value"], 1e-3, 0, 0, 1e-6])
    upper = np.array([facts["threshold"]["maximum"]["value"], 1e3, 1.0, 0.2, 1.5 * rd_seed])
    fit = least_squares(dc_residual, x0=x0, bounds=(lower, upper), args=(fixed, facts), method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-10, xtol=1e-10, max_nfev=5000)
    if fit.status <= 0:
        raise SystemExit(f"VDMOS DC fit failed: {fit.message}")
    for _ in range(10):
        measured_bounds = evaluate_dc(fit.x, fixed, facts)["rdson"]
        overshoots = [
            actual - target["resistance"]["value"]
            for target, actual in zip(facts["rdson_points"], measured_bounds)
            if target["resistance"].get("source_kind") == "maximum"
        ]
        worst_overshoot = max(overshoots, default=0.0)
        if worst_overshoot <= 0:
            break
        fit.x[4] = max(float(fit.x[4]) - 2.0 * worst_overshoot, 1e-6)
    cap_fit = least_squares(cap_residual, x0=np.array([1.0]), bounds=(np.array([0.01]), np.array([10.0])), args=(fit.x, fixed, facts), method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-10, xtol=1e-10, max_nfev=5000)
    if cap_fit.status <= 0:
        raise SystemExit(f"VDMOS capacitance fit failed: {cap_fit.message}")
    fixed["A"] = float(cap_fit.x[0])
    measured = evaluate_dc(fit.x, fixed, facts)
    measured_caps = evaluate_capacitance(fixed["A"], fit.x, fixed, facts)
    rows = []
    for group, targets, actuals, key, unit in [
        ("transfer current", facts["transfer_points"], measured["transfer"], "current", "A"),
        ("RDS(on)", facts["rdson_points"], measured["rdson"], "resistance", "ohm"),
        ("output current", facts["output_points"], measured["output"], "current", "A"),
    ]:
        for target, actual in zip(targets, actuals):
            desired = target[key]["value"]
            rows.append({"quantity": group, "datasheet_value": desired, "fitted_value": actual, "unit": unit, "relative_error": abs(actual - desired) / abs(desired), "citation": target[key]["page_reference"]})
    for target, actual in zip(caps["crss_curve"], measured_caps):
        desired = target["crss"]["value"]
        rows.append({"quantity": f"Crss at {target['vds']['value']} V", "datasheet_value": desired, "fitted_value": actual, "unit": "F", "relative_error": abs(actual - desired) / desired, "citation": target["crss"]["page_reference"]})
    worst = max(rows, key=lambda row: row["relative_error"])
    names = ["VTO", "KP", "THETA", "LAMBDA", "RD"]
    parameters = dict(zip(names, [float(value) for value in fit.x]))
    parameters.update(fixed)
    output = {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares with native ngspice-46 evaluations",
        "deterministic": True,
        "parameters": parameters,
        "optimizer": {"status": int(fit.status), "nfev": int(fit.nfev), "capacitance_nfev": int(cap_fit.nfev), "diff_step": 1e-4},
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
