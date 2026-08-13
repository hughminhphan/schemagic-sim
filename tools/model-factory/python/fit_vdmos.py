#!/usr/bin/env python3
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector
from fit_conveyor import (IDENTITY_VERSION, Unfittable, identities_equal, real_citation,
                           validate_condition_identity, validate_curve_identity, validate_evidence_bundle)

VT = 1.380649e-23 * 298.15 / 1.602176634e-19


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


def prepare_dc_facts(facts):
    """Validate canonical identities once and flatten only fully identified static evidence."""
    if facts.get("evidence_contract_version") != IDENTITY_VERSION:
        raise Unfittable(f"curated VDMOS fit requires evidence_contract_version {IDENTITY_VERSION}")
    if "transfer_points" in facts or "output_points" in facts:
        raise Unfittable("canonical VDMOS facts must use transfer_curves/output_curves; flat curve points are not admissible")
    prepared = {"_prepared": True, "transfer_points": [], "rdson_points": [], "output_points": []}
    for index, curve in enumerate(facts.get("transfer_curves") or []):
        identity = validate_curve_identity(curve, "transfer_current", "V", "A", f"transfer_curves[{index}]")
        electrical = identity["condition_identity"]["electrical"]
        if electrical["vds"]["kind"] != "fixed":
            raise Unfittable(f"transfer_curves[{index}] requires an exact cited VDS")
        temperature = identity["condition_identity"]["temperature"]["value_c"]
        vds = abs(float(electrical["vds"]["value_v"]))
        for raw_point, point in zip(curve["points"], identity["points"]):
            prepared["transfer_points"].append({"vgs": abs(point["x_si"]), "current": abs(point["y_si"]),
                                                "vds": vds, "temperature_c": temperature,
                                                "condition_identity": identity["condition_identity"],
                                                "citation_identity": identity["citation_identity"],
                                                "evidence_identity": raw_point["evidence_identity"],
                                                "curve_id": identity["curve_id"]})
    for index, curve in enumerate(facts.get("output_curves") or []):
        identity = validate_curve_identity(curve, "output_current", "V", "A", f"output_curves[{index}]")
        electrical = identity["condition_identity"]["electrical"]
        if electrical["vgs"]["kind"] != "fixed":
            raise Unfittable(f"output_curves[{index}] requires an exact cited VGS")
        temperature = identity["condition_identity"]["temperature"]["value_c"]
        vgs = abs(float(electrical["vgs"]["value_v"]))
        for raw_point, point in zip(curve["points"], identity["points"]):
            prepared["output_points"].append({"vds": abs(point["x_si"]), "current": abs(point["y_si"]),
                                              "vgs": vgs, "temperature_c": temperature,
                                              "condition_identity": identity["condition_identity"],
                                              "citation_identity": identity["citation_identity"],
                                              "evidence_identity": raw_point["evidence_identity"],
                                              "curve_id": identity["curve_id"]})
    for index, point in enumerate(facts.get("rdson_points") or []):
        label = f"rdson_points[{index}]"
        raw_resistance = point.get("resistance") or {}
        role = (raw_resistance.get("evidence_identity") or {}).get("role")
        if role not in {"typical", "maximum"}:
            raise Unfittable(f"{label}.resistance has unknown residual qualifier {role!r}")
        rows = [
            validate_evidence_bundle(point.get("vgs"), "rds_on", "vgs", "V", {role}, f"{label}.vgs", dc_only=True),
            validate_evidence_bundle(point.get("current"), "rds_on", "drain_current", "A", {role}, f"{label}.current", dc_only=True),
            validate_evidence_bundle(raw_resistance, "rds_on", f"rds_on_{role}", "ohm", {role}, f"{label}.resistance", dc_only=True),
        ]
        identities_equal(rows, label)
        roles = {row["evidence_identity"]["role"] for row in rows}
        if len(roles) != 1:
            raise Unfittable(f"{label} mixes typical and maximum evidence")
        condition = rows[0]["condition_identity"]
        electrical = condition["electrical"]
        if electrical["vgs"]["kind"] != "fixed" or electrical["id"]["kind"] != "fixed":
            raise Unfittable(f"{label} requires exact VGS and ID")
        prepared["rdson_points"].append({"vgs": abs(rows[0]["value"]), "current": abs(rows[1]["value"]),
                                         "resistance": rows[2]["value"], "source_kind": next(iter(roles)),
                                         "temperature_c": condition["temperature"]["value_c"],
                                         "condition_identity": condition, "citation_identity": rows[2]["citation_identity"],
                                         "evidence_identity": rows[2]["evidence_identity"],
                                         "component_evidence": [row["evidence_identity"] for row in rows]})
    if not prepared["transfer_points"]:
        raise Unfittable("curated VDMOS F2 requires at least one complete canonical transfer curve")
    if not prepared["rdson_points"]:
        raise Unfittable("curated VDMOS F2 requires at least one complete exact RDS(on) identity")
    return prepared


def evaluate_dc(parameters, fixed, facts):
    prepared = facts if facts.get("_prepared") else prepare_dc_facts(facts)
    grouped = defaultdict(list)
    for group in ("transfer_points", "rdson_points", "output_points"):
        for index, point in enumerate(prepared[group]):
            grouped[float(point["temperature_c"])].append((group, index, point))
    measured = {"transfer": [None] * len(prepared["transfer_points"]),
                "rdson": [None] * len(prepared["rdson_points"]),
                "output": [None] * len(prepared["output_points"])}
    name_map = {"transfer_points": "transfer", "rdson_points": "rdson", "output_points": "output"}
    for temperature, rows in grouped.items():
        lines = ["VDMOS native DC fit probe", model_card(parameters, fixed), f".temp {temperature:.12g}"]
        probes = []
        for probe_index, (group, row_index, point) in enumerate(rows, 1):
            probes.append((group, row_index, probe_index, point))
            if group == "transfer_points":
                lines += [f"MT{probe_index} d{probe_index} g{probe_index} 0 MFIT",
                          f"VD{probe_index} d{probe_index} 0 DC {point['vds']:.12g}",
                          f"VG{probe_index} g{probe_index} 0 DC {point['vgs']:.12g}"]
            elif group == "rdson_points":
                lines += [f"MR{probe_index} d{probe_index} g{probe_index} 0 MFIT",
                          f"ID{probe_index} 0 d{probe_index} DC {point['current']:.12g}",
                          f"VG{probe_index} g{probe_index} 0 DC {point['vgs']:.12g}"]
            else:
                lines += [f"MO{probe_index} d{probe_index} g{probe_index} 0 MFIT",
                          f"VD{probe_index} d{probe_index} 0 DC {point['vds']:.12g}",
                          f"VG{probe_index} g{probe_index} 0 DC {point['vgs']:.12g}"]
        lines += [".op", ".end"]
        result = run_ngspice("\n".join(lines) + "\n")
        for group, row_index, probe_index, point in probes:
            if group == "rdson_points":
                value = float(vector(result, f"v(d{probe_index})", f"d{probe_index}")[0]) / point["current"]
            else:
                value = abs(vector(result, f"vd{probe_index}#branch", f"i(vd{probe_index})")[0])
            measured[name_map[group]][row_index] = value
    return measured


def dc_residual(parameters, fixed, facts):
    try:
        measured = evaluate_dc(parameters, fixed, facts)
    except Exception:
        return np.full(len(facts["transfer_points"]) + len(facts["rdson_points"]) + len(facts["output_points"]), 1e3)
    output = []
    for target, actual in zip(facts["transfer_points"], measured["transfer"]):
        output.append(math.log(max(actual, 1e-12)) - math.log(target["current"]))
    for target, actual in zip(facts["rdson_points"], measured["rdson"]):
        desired = target["resistance"]
        normalized = (actual - desired) / desired
        if target["source_kind"] == "maximum":
            output.append(20.0 * max(normalized, 0.0) + 0.05 * min(normalized, 0.0))
        else:
            output.append(normalized)
    for target, actual in zip(facts["output_points"], measured["output"]):
        output.append(math.log(max(actual, 1e-12)) - math.log(target["current"]))
    return np.asarray(output)


def evaluate_capacitance(a_value, dc, fixed, facts):
    capacitance_temperature = facts.get("capacitance_temperature_c")
    if not isinstance(capacitance_temperature, (int, float)) or not math.isfinite(float(capacitance_temperature)):
        raise Unfittable("capacitance evidence requires an explicit validated temperature")
    lines = ["VDMOS native capacitance fit probe", model_card(dc, fixed, a_value), f".temp {float(capacitance_temperature):.12g}"]
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


def validated_capacitance_temperature(facts):
    """All published capacitance inputs must state one exact compatible temperature."""
    entries = []
    caps = facts.get("capacitances") or {}
    for key in ("ciss", "coss", "crss", "vds_test"):
        value = caps.get(key)
        if isinstance(value, dict) and value.get("condition_identity") is not None:
            entries.append(validate_condition_identity(value["condition_identity"], None,
                                                       f"capacitances.{key}.condition_identity"))
    for index, point in enumerate(caps.get("crss_curve") or []):
        identity = point.get("condition_identity") if isinstance(point, dict) else None
        if identity is not None:
            entries.append(validate_condition_identity(identity, None,
                                                       f"capacitances.crss_curve[{index}].condition_identity"))
    if not entries:
        raise Unfittable("capacitance evidence requires canonical condition identities; temperature cannot default to 25 C")
    temperatures = {entry["temperature"]["value_c"] for entry in entries}
    modes = {entry["test_mode"]["kind"] for entry in entries}
    if len(temperatures) != 1 or modes - {"dc", "continuous"}:
        raise Unfittable("capacitance evidence mixes temperature or pulsed test modes")
    return float(next(iter(temperatures)))


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
    prepared = prepare_dc_facts(facts)
    caps = facts["capacitances"]
    facts["capacitance_temperature_c"] = validated_capacitance_temperature(facts)
    typical_rdson = [point for point in prepared["rdson_points"] if point["source_kind"] == "typical"]
    maximum_rdson = [point for point in prepared["rdson_points"] if point["source_kind"] == "maximum"]
    rdson_seed = (typical_rdson[0]["resistance"] if typical_rdson else min(point["resistance"] for point in maximum_rdson))
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
    threshold_rows = {}
    for key, quantity, role in (("minimum", "threshold_minimum", "minimum"),
                                ("typical", "threshold_typical", "typical"),
                                ("maximum", "threshold_maximum", "maximum")):
        raw = (facts.get("threshold") or {}).get(key)
        if raw is not None:
            threshold_rows[key] = validate_evidence_bundle(raw, "gate_threshold", quantity, "V", {role},
                                                            f"threshold.{key}", dc_only=True)
    if threshold_rows:
        identities_equal(list(threshold_rows.values()), "threshold")
    if not threshold_rows:
        raise Unfittable("curated VDMOS fit requires independently complete threshold evidence")
    vto0 = abs(threshold_rows["typical"]["value"]) if "typical" in threshold_rows else 0.5 * (
        abs(threshold_rows["minimum"]["value"]) + abs(threshold_rows["maximum"]["value"]))
    hi = max(prepared["transfer_points"], key=lambda point: point["vgs"])
    kp0 = 2 * hi["current"] / (hi["vgs"] - vto0) ** 2
    x0 = np.array([vto0, kp0, 0.05, 0.003, rd_seed])
    lower_vto = abs(threshold_rows["minimum"]["value"]) if "minimum" in threshold_rows else 0.3 * vto0
    upper_vto = abs(threshold_rows["maximum"]["value"]) if "maximum" in threshold_rows else 3.0 * vto0
    lower = np.array([lower_vto, 1e-3, 0, 0, 1e-6])
    upper = np.array([upper_vto, 1e3, 1.0, 0.2, 1.5 * rd_seed])
    fit = least_squares(dc_residual, x0=x0, bounds=(lower, upper), args=(fixed, prepared), method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-10, xtol=1e-10, max_nfev=5000)
    if fit.status <= 0:
        raise SystemExit(f"VDMOS DC fit failed: {fit.message}")
    for _ in range(10):
        measured_bounds = evaluate_dc(fit.x, fixed, prepared)["rdson"]
        overshoots = [
            actual - target["resistance"]
            for target, actual in zip(prepared["rdson_points"], measured_bounds)
            if target["source_kind"] == "maximum"
        ]
        worst_overshoot = max(overshoots, default=0.0)
        if worst_overshoot <= 0:
            break
        fit.x[4] = max(float(fit.x[4]) - 2.0 * worst_overshoot, 1e-6)
    cap_fit = least_squares(cap_residual, x0=np.array([1.0]), bounds=(np.array([0.01]), np.array([10.0])), args=(fit.x, fixed, facts), method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-10, xtol=1e-10, max_nfev=5000)
    if cap_fit.status <= 0:
        raise SystemExit(f"VDMOS capacitance fit failed: {cap_fit.message}")
    fixed["A"] = float(cap_fit.x[0])
    measured = evaluate_dc(fit.x, fixed, prepared)
    measured_caps = evaluate_capacitance(fixed["A"], fit.x, fixed, facts)
    rows = []
    for group, targets, actuals, key, unit in [
        ("transfer current", prepared["transfer_points"], measured["transfer"], "current", "A"),
        ("RDS(on)", prepared["rdson_points"], measured["rdson"], "resistance", "ohm"),
        ("output current", prepared["output_points"], measured["output"], "current", "A"),
    ]:
        for target, actual in zip(targets, actuals):
            desired = target[key]
            relative_error = abs(actual - desired) / abs(desired)
            evidence_role = "typical_observation"
            if group == "RDS(on)" and target["source_kind"] == "maximum":
                relative_error = max(actual - desired, 0.0) / abs(desired)
                evidence_role = "inequality_constraint"
            rows.append({"quantity": group, "datasheet_value": desired, "fitted_value": actual, "unit": unit,
                         "relative_error": relative_error, "citation": real_citation(target["citation_identity"]),
                         "condition_identity": target["condition_identity"], "citation_identity": target["citation_identity"],
                         "evidence_identity": target["evidence_identity"], "temperature_c": target["temperature_c"],
                         "evidence_role": evidence_role,
                         **({"curve_id": target["curve_id"]} if "curve_id" in target else {}),
                         **({"component_evidence": target["component_evidence"]} if "component_evidence" in target else {}),
                         **({"maximum": desired, "inclusive": True} if evidence_role == "inequality_constraint" else {})})
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
        "optimizer": {"status": int(fit.status), "nfev": int(fit.nfev), "capacitance_nfev": int(cap_fit.nfev), "diff_step": 1e-4,
                      "threshold_evidence": threshold_rows,
                      "seed_provenance": {"VTO": threshold_rows.get("typical") or {"interval_endpoints": [threshold_rows.get("minimum"), threshold_rows.get("maximum")]},
                                          "rdson": (typical_rdson[0] if typical_rdson else min(maximum_rdson, key=lambda point: point["resistance"]))}},
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
