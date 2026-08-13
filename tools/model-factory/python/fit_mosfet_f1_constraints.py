#!/usr/bin/env python3
"""Native-ngspice feasibility projection for evidence-constrained MOSFET F1 models.

Published threshold intervals and RDS(on) maxima are evaluated only as inclusive
inequality constraints. They are never added to a least-squares residual vector.
The objective is lexicographic distance from explicitly supplied seed values:
keep a seed unchanged when it is feasible, otherwise project it to the nearest
feasible boundary. An empty feasible set is an error.
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

from native_ngspice import run_ngspice, vector

PROBE_OPTIONS = ".options reltol=1e-6 abstol=1e-15 vntol=1e-9 itl1=500"
BISECTION_STEPS = 48


class Infeasible(Exception):
    """No model in the declared F1 search domain satisfies every constraint."""


def model_parameters(vto, rdson_seed, fixed):
    rdson = max(float(rdson_seed), 1e-6)
    return {
        "VTO": float(vto),
        "KP": 2.0 / rdson,
        "THETA": 0.0,
        "LAMBDA": 0.003,
        "RD": 0.55 * rdson,
        "RS": 0.20 * rdson,
        "RG": 1e-4,
        "CGS": float(fixed["CGS"]),
        "CGDMAX": float(fixed["CGDMAX"]),
        "CGDMIN": float(fixed["CGDMIN"]),
        "CJO": float(fixed["CJO"]),
        "IS": 1e-12,
        "N": 1.5,
        "RB": 0.20 * rdson,
    }


def model_card(params, polarity):
    pchan = " pchan" if polarity == "p" else ""
    threshold = -abs(params["VTO"]) if polarity == "p" else abs(params["VTO"])
    return (
        f".model MF1 VDMOS({pchan} VTO={threshold:.12g} KP={params['KP']:.12g} "
        f"THETA={params['THETA']:.12g} LAMBDA={params['LAMBDA']:.12g} "
        f"RD={params['RD']:.12g} RS={params['RS']:.12g} RG={params['RG']:.12g} RDS=1e9 "
        f"CGS={params['CGS']:.12e} CGDMAX={params['CGDMAX']:.12e} "
        f"CGDMIN={params['CGDMIN']:.12e} CJO={params['CJO']:.12e} "
        f"IS={params['IS']:.12e} N={params['N']:.12g} RB={params['RB']:.12g} TNOM=27)"
    )


def probe(params, constraints, polarity):
    """Evaluate all constraints in native ngspice at each exact cited temperature."""
    grouped = defaultdict(list)
    for constraint in constraints:
        grouped[float(constraint["temperature_c"])].append(constraint)

    measured = {}
    for temperature, rows in grouped.items():
        lines = ["Constrained MOSFET F1 native probe", PROBE_OPTIONS, model_card(params, polarity), f".temp {temperature:.12g}"]
        names = []
        for index, constraint in enumerate(rows, 1):
            identifier = constraint["id"]
            names.append((identifier, constraint["kind"], index, constraint))
            if constraint["kind"] == "threshold_interval":
                lines.append(f"MT{index} dt{index} dt{index} 0 MF1")
                if polarity == "p":
                    lines.append(f"IT{index} dt{index} 0 DC {constraint['current_a']:.12g}")
                else:
                    lines.append(f"IT{index} 0 dt{index} DC {constraint['current_a']:.12g}")
            elif constraint["kind"] == "rdson_maximum":
                lines.append(f"MR{index} dr{index} gr{index} 0 MF1")
                if polarity == "p":
                    lines.append(f"IR{index} dr{index} 0 DC {constraint['current_a']:.12g}")
                    gate = -abs(constraint["vgs_v"])
                else:
                    lines.append(f"IR{index} 0 dr{index} DC {constraint['current_a']:.12g}")
                    gate = abs(constraint["vgs_v"])
                lines.append(f"VG{index} gr{index} 0 DC {gate:.12g}")
            else:
                raise ValueError(f"unsupported constraint kind {constraint['kind']!r}")
        lines += [".op", ".end"]
        result = run_ngspice("\n".join(lines) + "\n")
        for identifier, kind, index, constraint in names:
            if kind == "threshold_interval":
                value = abs(float(vector(result, f"v(dt{index})", f"dt{index}")[0]))
            else:
                voltage = abs(float(vector(result, f"v(dr{index})", f"dr{index}")[0]))
                value = voltage / constraint["current_a"]
            measured[identifier] = value
    return measured


def bisect_increasing(target, low, high, evaluate):
    low_value = evaluate(low)
    high_value = evaluate(high)
    tolerance = max(1e-10, abs(target) * 1e-9)
    if target < low_value - tolerance or target > high_value + tolerance:
        raise Infeasible(
            f"constraint boundary {target:.12g} lies outside model response "
            f"[{low_value:.12g}, {high_value:.12g}] over search domain [{low:.12g}, {high:.12g}]"
        )
    if abs(target - low_value) <= tolerance:
        return low
    if abs(target - high_value) <= tolerance:
        return high
    for _ in range(BISECTION_STEPS):
        mid = 0.5 * (low + high)
        if evaluate(mid) < target:
            low = mid
        else:
            high = mid
    return 0.5 * (low + high)


def threshold_domain(rdson, fixed, threshold_constraints, polarity, bounds):
    lower, upper = bounds
    for constraint in threshold_constraints:
        def evaluate(candidate):
            params = model_parameters(candidate, rdson, fixed)
            return probe(params, [constraint], polarity)[constraint["id"]]

        permitted_low = bisect_increasing(constraint["minimum_v"], bounds[0], bounds[1], evaluate)
        permitted_high = bisect_increasing(constraint["maximum_v"], bounds[0], bounds[1], evaluate)
        lower = max(lower, permitted_low)
        upper = min(upper, permitted_high)
    if lower > upper + 1e-10:
        raise Infeasible(f"threshold intervals have an empty feasible VTO intersection [{lower:.12g}, {upper:.12g}]")
    return lower, upper


def rdson_domain(vto, rdson_constraints, fixed, polarity, bounds):
    lower, upper = bounds
    for constraint in rdson_constraints:
        def evaluate(candidate):
            params = model_parameters(vto, candidate, fixed)
            return probe(params, [constraint], polarity)[constraint["id"]]

        low_value = evaluate(bounds[0])
        tolerance = max(1e-12, constraint["maximum_ohm"] * 1e-9)
        if low_value > constraint["maximum_ohm"] + tolerance:
            raise Infeasible(
                f"{constraint['id']} remains {low_value:.12g} ohm at the minimum resistance seed, "
                f"above inclusive maximum {constraint['maximum_ohm']:.12g} ohm"
            )
        high_value = evaluate(bounds[1])
        if high_value <= constraint["maximum_ohm"] + tolerance:
            permitted_high = bounds[1]
        else:
            permitted_high = bisect_increasing(constraint["maximum_ohm"], bounds[0], bounds[1], evaluate)
        upper = min(upper, permitted_high)
    if lower > upper + 1e-12:
        raise Infeasible(f"RDS(on) maxima have an empty feasible resistance-seed interval [{lower:.12g}, {upper:.12g}]")
    return lower, upper


def constraint_results(constraints, measured):
    results = []
    for constraint in constraints:
        value = measured[constraint["id"]]
        if constraint["kind"] == "threshold_interval":
            satisfied = constraint["minimum_v"] <= value <= constraint["maximum_v"]
            bounds = {"minimum": constraint["minimum_v"], "maximum": constraint["maximum_v"], "unit": "V"}
        else:
            satisfied = value <= constraint["maximum_ohm"]
            bounds = {"maximum": constraint["maximum_ohm"], "unit": "ohm"}
        results.append({**constraint, "predicted_value": value, "inclusive": True, "satisfied": satisfied, **bounds})
    return results


def fit(payload):
    constraints = payload["constraints"]
    if not constraints:
        raise ValueError("constrained MOSFET F1 fit requires at least one inequality constraint")
    polarity = payload.get("polarity", "n")
    fixed = payload["fixed"]
    seed_vto = float(payload["seed"]["vto"])
    seed_rdson = float(payload["seed"]["rdson"])
    adjust_vto = bool(payload["adjustable"]["vto"])
    adjust_rdson = bool(payload["adjustable"]["rdson"])
    threshold_constraints = [row for row in constraints if row["kind"] == "threshold_interval"]
    rdson_constraints = [row for row in constraints if row["kind"] == "rdson_maximum"]

    max_threshold = max([row["maximum_v"] for row in threshold_constraints] or [seed_vto, 1.0])
    vto_bounds = (max(1e-3, min(seed_vto, max_threshold) * 0.02), max(20.0, seed_vto * 5.0, max_threshold * 5.0))
    max_rdson = max([row["maximum_ohm"] for row in rdson_constraints] or [seed_rdson, 0.1])
    rdson_bounds = (1e-6, max(10.0, seed_rdson * 10.0, max_rdson * 10.0))

    vto, rdson = seed_vto, seed_rdson
    for _ in range(4):
        old = (vto, rdson)
        if threshold_constraints:
            feasible_low, feasible_high = threshold_domain(rdson, fixed, threshold_constraints, polarity, vto_bounds)
            if adjust_vto:
                vto = min(max(seed_vto, feasible_low), feasible_high)
            elif not (feasible_low - 1e-9 <= vto <= feasible_high + 1e-9):
                raise Infeasible(
                    f"fixed typical-point VTO seed {vto:.12g} is outside feasible interval "
                    f"[{feasible_low:.12g}, {feasible_high:.12g}]"
                )
        if rdson_constraints:
            feasible_low, feasible_high = rdson_domain(vto, rdson_constraints, fixed, polarity, rdson_bounds)
            if adjust_rdson:
                rdson = min(max(seed_rdson, feasible_low), feasible_high)
                if rdson >= feasible_high and feasible_high < rdson_bounds[1]:
                    rdson = math.nextafter(feasible_high, feasible_low)
            elif not (feasible_low - 1e-12 <= rdson <= feasible_high + 1e-12):
                raise Infeasible(
                    f"fixed typical-point resistance seed {rdson:.12g} is outside feasible interval "
                    f"[{feasible_low:.12g}, {feasible_high:.12g}]"
                )
        if abs(vto - old[0]) <= 1e-10 * max(1.0, abs(vto)) and abs(rdson - old[1]) <= 1e-10 * max(1.0, abs(rdson)):
            break

    params = model_parameters(vto, rdson, fixed)
    measured = probe(params, constraints, polarity)
    results = constraint_results(constraints, measured)
    failures = [row for row in results if not row["satisfied"]]
    if failures:
        summary = "; ".join(f"{row['id']} predicted {row['predicted_value']:.12g}" for row in failures)
        raise Infeasible(f"projected model failed inclusive constraint verification: {summary}")
    return {
        "parameters": params,
        "constraint_results": results,
        "optimizer": {
            "method": "native-ngspice feasibility projection from explicit seeds; no bound residuals",
            "objective": "minimum lexicographic displacement from VTO and resistance seeds",
            "search_bounds": {"vto": list(vto_bounds), "rdson_seed": list(rdson_bounds)},
            "final_seed_coordinates": {"vto": vto, "rdson": rdson},
            "residual_target_count": 0,
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("payload")
    parser.add_argument("output")
    args = parser.parse_args()
    payload = json.loads(Path(args.payload).read_text())
    try:
        result = {"ok": True, **fit(payload)}
    except (Infeasible, ValueError, KeyError, TypeError) as exc:
        result = {"ok": False, "error": str(exc)}
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
