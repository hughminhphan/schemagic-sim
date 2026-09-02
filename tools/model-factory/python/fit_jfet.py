#!/usr/bin/env python3
"""Fit ngspice level-1 JFET cards from admitted datasheet evidence.

The fitter deliberately distinguishes a curve-backed F2 fit from a bound-centred F1
projection. BF256B currently has only bin limits and two capacitance table rows, so it
must remain F1 until a transfer characteristic, output family, and gfs row are admitted.
"""
import argparse
import json
import math
import re
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector


def qvalue(value, default=None):
    if isinstance(value, dict):
        value = value.get("value")
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def condition_voltage(quantity, name):
    text = str((quantity or {}).get("conditions", ""))
    match = re.search(rf"\b{name}\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*V\b", text, re.I)
    return float(match.group(1)) if match else None


def condition_current(quantity, name):
    text = str((quantity or {}).get("conditions", ""))
    match = re.search(rf"\b{name}\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([pnumkµμ]?)A\b", text, re.I)
    if not match:
        return None
    scale = {"": 1.0, "p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "μ": 1e-6, "m": 1e-3, "k": 1e3}[match.group(2).lower()]
    return float(match.group(1)) * scale


def point_value(point, name):
    return qvalue((point or {}).get(name))


def admitted_points(facts, key):
    rows = []
    for index, point in enumerate(facts.get(key) or []):
        vgs = point_value(point, "vgs")
        vds = point_value(point, "vds")
        current = point_value(point, "current")
        if not all(value is not None for value in (vgs, vds, current)) or current <= 0:
            raise ValueError(f"{key}[{index}] requires finite vgs, vds, and positive current")
        rows.append({"vgs": vgs, "vds": vds, "current": current,
                     "citation": (point.get("current") or {}).get("page_reference", key)})
    return rows


def model_card(parameters):
    return (
        ".model JFIT NJF("
        f"VTO={parameters['VTO']:.12g} BETA={parameters['BETA']:.12e} "
        f"LAMBDA={parameters['LAMBDA']:.12g} B={parameters['B']:.12g} "
        f"RD={parameters['RD']:.12g} RS={parameters['RS']:.12g} "
        f"CGS={parameters['CGS']:.12e} CGD={parameters['CGD']:.12e} "
        f"PB={parameters['PB']:.12g} M={parameters['M']:.12g} "
        f"IS={parameters['IS']:.12e} N=1 FC=0.5 TNOM=27)"
    )


def evaluate_dc(parameters, points, include_gm=False, idss_vds=None):
    lines = ["JFET native DC fit probe", ".options reltol=1e-7 abstol=1e-15", model_card(parameters), ".temp 25"]
    for index, point in enumerate(points, 1):
        lines += [f"J{index} d{index} g{index} 0 JFIT",
                  f"VD{index} d{index} 0 DC {point['vds']:.12g}",
                  f"VG{index} g{index} 0 DC {point['vgs']:.12g}"]
    if idss_vds is not None:
        lines += ["JID did 0 0 JFIT", f"VID did 0 DC {idss_vds:.12g}"]
    if include_gm and idss_vds is not None:
        lines.append(".save @jid[gm]")
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    currents = [abs(float(vector(result, f"vd{index}#branch", f"i(vd{index})")[0]))
                for index in range(1, len(points) + 1)]
    idss = None if idss_vds is None else abs(float(vector(result, "vid#branch", "i(vid)")[0]))
    gm = None
    if include_gm and idss_vds is not None:
        gm = abs(float(vector(result, "@jid[gm]")[0]))
    return currents, idss, gm


def evaluate_caps_and_bounds(parameters, idss_vds, far_vgsoff):
    dc = run_ngspice("\n".join([
        "JFET native bounds probe", ".options reltol=1e-7 abstol=1e-15", model_card(parameters), ".temp 25",
        "JID did 0 0 JFIT", f"VID did 0 DC {idss_vds:.12g}",
        "JCUT dcut gcut 0 JFIT", f"VDCUT dcut 0 DC {idss_vds:.12g}", f"VGCUT gcut 0 DC {far_vgsoff:.12g}",
        ".op", ".end", ""
    ]))
    ac = run_ngspice("\n".join([
        "JFET native capacitance probe", model_card(parameters), ".temp 25",
        "JIN din gin 0 JFIT", f"VDIN din 0 DC {idss_vds:.12g}", "VGIN gin 0 DC 0 AC 1",
        "JREV drev 0 0 JFIT", f"VDREV drev 0 DC {idss_vds:.12g} AC 1",
        ".ac lin 1 1Meg 1Meg", ".end", ""
    ]))
    frequency = 1e6
    return {
        "idss": abs(float(vector(dc, "vid#branch", "i(vid)")[0])),
        "cutoff_current_far": abs(float(vector(dc, "vdcut#branch", "i(vdcut)")[0])),
        "ciss": abs(vector(ac, "vgin#branch", "i(vgin)")[0].imag) / (2 * math.pi * frequency),
        "crss": abs(vector(ac, "vdrev#branch", "i(vdrev)")[0].imag) / (2 * math.pi * frequency),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    electrical = facts.get("electrical") or {}

    idss_min = qvalue(electrical.get("idss_min"))
    idss_max = qvalue(electrical.get("idss_max"))
    idss_typ = qvalue(electrical.get("idss_typ"))
    if idss_typ is None and idss_min is not None and idss_max is not None:
        idss_target = 0.5 * (idss_min + idss_max)
    elif idss_typ is not None:
        idss_target = idss_typ
    else:
        raise SystemExit("JFET fit requires IDSS typical or a cited IDSS minimum/maximum bin")

    near = qvalue(electrical.get("vgsoff_near"))
    far = qvalue(electrical.get("vgsoff_far"))
    if near is None or far is None or near >= 0 or far >= 0:
        raise SystemExit("NJF fit requires negative cited VGS(off) near/far bin limits")
    vto_lower = -1.05 * max(abs(near), abs(far))
    vto_upper = -0.95 * min(abs(near), abs(far))
    vto_seed = -0.5 * (abs(near) + abs(far))

    declared_assumptions = []
    idss_vds = next((value for value in (
        condition_voltage(electrical.get("idss_typ"), "VDS"),
        condition_voltage(electrical.get("idss_min"), "VDS"),
        condition_voltage(electrical.get("idss_max"), "VDS"),
        condition_voltage(electrical.get("vgsoff_near"), "VDS"),
        condition_voltage(electrical.get("vgsoff_far"), "VDS"),
    ) if value is not None), None)
    if idss_vds is None:
        idss_vds = 15.0
        declared_assumptions.append({"parameter": "IDSS_VDS", "value": idss_vds, "unit": "V",
                                     "reason": "Declared bench assumption: no admitted IDSS or VGS(off) condition states VDS"})

    cutoff_current_limit = qvalue(electrical.get("vgsoff_test_current"))
    if cutoff_current_limit is None:
        cutoff_current_limit = next((value for value in (
            condition_current(electrical.get("vgsoff_near"), "ID"),
            condition_current(electrical.get("vgsoff_far"), "ID"),
        ) if value is not None), None)
    if cutoff_current_limit is None:
        cutoff_current_limit = 1e-5
        declared_assumptions.append({"parameter": "VGS_OFF_TEST_CURRENT", "value": cutoff_current_limit, "unit": "A",
                                     "reason": "Declared bench assumption: no admitted VGS(off) condition states cutoff current"})

    transfer = admitted_points(facts, "transfer_points")
    output = admitted_points(facts, "output_points")
    curve_points = transfer + output
    has_output = len(output) >= 2
    gfs_target = qvalue(electrical.get("gfs") or electrical.get("yfs"))

    rds_on = qvalue(electrical.get("rds_on"))
    rd = rs = max(0.5 * rds_on, 1e-4) if rds_on is not None else 1e-4
    lam_seed = 0.005
    beta_seed = max(idss_target / (vto_seed * vto_seed * (1 + lam_seed * idss_vds)), 1e-6)

    ciss = qvalue(electrical.get("ciss"))
    crss = qvalue(electrical.get("crss"))
    pb = 1.0
    m = 0.5
    cgd = max((crss or 1e-15) * math.sqrt(1 + idss_vds / pb), 1e-15)
    cgs = max((ciss - crss) if ciss is not None and crss is not None else 1e-15, 1e-15)
    igss = abs(qvalue(electrical.get("igss_max"), 1e-20))

    parameters = {
        "VTO": vto_seed, "BETA": beta_seed, "LAMBDA": lam_seed, "B": 1.0,
        "RD": rd, "RS": rs, "CGS": cgs, "CGD": cgd, "PB": pb, "M": m,
        "IS": max(igss, 1e-20), "N": 1.0, "FC": 0.5, "TNOM": 27.0,
    }

    optimizer = None
    if curve_points:
        free_lambda = has_output
        x0 = np.array([parameters["VTO"], math.log(parameters["BETA"])] + ([parameters["LAMBDA"]] if free_lambda else []))
        lower = np.array([vto_lower, math.log(1e-6)] + ([0.0] if free_lambda else []))
        upper = np.array([vto_upper, math.log(1e-1)] + ([0.1] if free_lambda else []))

        def unpack(values):
            candidate = dict(parameters)
            candidate["VTO"] = float(values[0])
            candidate["BETA"] = math.exp(float(values[1]))
            if free_lambda:
                candidate["LAMBDA"] = float(values[2])
            return candidate

        def residual(values):
            candidate = unpack(values)
            try:
                measured, idss, gm = evaluate_dc(candidate, curve_points, gfs_target is not None, idss_vds)
            except Exception:
                return np.full(len(curve_points) + 1 + (1 if gfs_target is not None else 0), 1e3)
            rows = [math.log(max(actual, 1e-15)) - math.log(target["current"])
                    for target, actual in zip(curve_points, measured)]
            rows.append((idss - idss_target) / idss_target)
            if gfs_target is not None:
                rows.append((gm - gfs_target) / gfs_target)
            return np.asarray(rows)

        fit = least_squares(residual, x0=x0, bounds=(lower, upper), method="trf", x_scale="jac",
                            diff_step=1e-4, ftol=1e-12, xtol=1e-12, max_nfev=5000)
        if fit.status <= 0:
            raise SystemExit(f"JFET fit failed: {fit.message}")
        parameters = unpack(fit.x)
        optimizer = {"status": int(fit.status), "nfev": int(fit.nfev), "cost": float(fit.cost)}

    measured_points, _, _ = evaluate_dc(parameters, curve_points, False, idss_vds)
    residuals = [{
        "quantity": f"JFET current at VGS={point['vgs']:.6g} V, VDS={point['vds']:.6g} V",
        "datasheet_value": point["current"], "fitted_value": actual, "unit": "A",
        "relative_error": abs(actual - point["current"]) / point["current"], "citation": point["citation"],
    } for point, actual in zip(curve_points, measured_points)]

    observed = evaluate_caps_and_bounds(parameters, idss_vds, far)
    if ciss is not None:
        residuals.append({"quantity": "Ciss at 1 MHz", "datasheet_value": ciss, "fitted_value": observed["ciss"], "unit": "F",
                          "relative_error": abs(observed["ciss"] - ciss) / ciss,
                          "citation": electrical["ciss"].get("page_reference", "Ciss table row")})
    if crss is not None:
        residuals.append({"quantity": "Crss at 1 MHz", "datasheet_value": crss, "fitted_value": observed["crss"], "unit": "F",
                          "relative_error": abs(observed["crss"] - crss) / crss,
                          "citation": electrical["crss"].get("page_reference", "Crss table row")})

    omissions = [item["reason"] + f"; using {item['value']:.6g} {item['unit']}." for item in declared_assumptions]
    if not transfer:
        omissions.append("F1: no transfer-characteristic curve is admitted, so VTO and BETA are a bound-centred bin projection rather than a typical-device curve fit.")
    if not output:
        omissions.append("LAMBDA held at 0.005: no output-characteristics curve is admitted, so channel-length modulation and drain output resistance are approximate.")
    if gfs_target is None:
        omissions.append("Forward transfer admittance gfs is not fitted because no admitted gfs row is available.")
    omissions.append("Gate leakage IS is set from the tabulated IGSS maximum; no forward gate curve is fitted.")
    if rds_on is None:
        omissions.append("Channel series resistance is not fitted because the evidence publishes no RDS(on); RD and RS remain at the numerical floor.")

    worst = max(residuals, key=lambda row: row["relative_error"]) if residuals else None
    metadata = {name: {"status": "fitted" if curve_points and name in {"VTO", "BETA"} else "derived or held from cited evidence"}
                for name in parameters}
    metadata["LAMBDA"] = {"status": "fitted from output curves" if has_output else "held at family default; no output curve"}
    metadata["IS"] = {"status": "set from cited IGSS maximum; not curve-fitted"}

    held_defaults = list(declared_assumptions)
    if not has_output:
        held_defaults.append({"parameter": "LAMBDA", "value": parameters["LAMBDA"], "unit": "1/V",
                              "reason": "Held at the family default because no output-characteristics curve is admitted"})
    held_defaults.extend([
        {"parameter": "B", "value": parameters["B"], "unit": "1", "reason": "Held at the level-1 square-law value; B is not fitted by this fitter"},
        {"parameter": "PB", "value": parameters["PB"], "unit": "V", "reason": "Held at the junction-potential default because no capacitance-versus-bias curve is admitted"},
        {"parameter": "M", "value": parameters["M"], "unit": "1", "reason": "Held at the junction grading default because no capacitance-versus-bias curve is admitted"},
        {"parameter": "N", "value": parameters["N"], "unit": "1", "reason": "Held at the ideal gate-junction value because no forward gate curve is admitted"},
        {"parameter": "FC", "value": parameters["FC"], "unit": "1", "reason": "Held at the gate-junction depletion-capacitance default"},
        {"parameter": "RD", "value": parameters["RD"], "unit": "ohm", "reason": "Not fitted; derived from admitted RDS(on) or held at the numerical floor when absent"},
        {"parameter": "RS", "value": parameters["RS"], "unit": "ohm", "reason": "Not fitted; derived from admitted RDS(on) or held at the numerical floor when absent"},
    ])

    output_document = {
        "schema_version": "1.0.0",
        "fidelity_tier": "F2" if len(transfer) >= 5 else "F1",
        "fitter": "native-ngspice level-1 NJF fitter" if curve_points else "native-ngspice verified F1 bound-centred NJF projection",
        "deterministic": True,
        "parameters": parameters,
        "parameter_metadata": metadata,
        "optimizer": optimizer,
        "held_defaults": held_defaults,
        "residuals": residuals,
        "worst_relative_error": None if worst is None else {"value": worst["relative_error"], "quantity": worst["quantity"]},
        "native_verification": {
            "idss_a": observed["idss"], "idss_bounds_a": [idss_min, idss_max],
            "cutoff_current_at_far_vgsoff_a": observed["cutoff_current_far"],
            "cutoff_current_limit_a": cutoff_current_limit,
            "ciss_f": observed["ciss"], "crss_f": observed["crss"],
        },
        "evidence_support": {"transfer_characteristic": bool(transfer), "output_characteristics": bool(output), "gfs": gfs_target is not None},
        "known_omissions": omissions,
    }
    Path(args.output).write_text(json.dumps(output_document, indent=2) + "\n")


if __name__ == "__main__":
    main()
