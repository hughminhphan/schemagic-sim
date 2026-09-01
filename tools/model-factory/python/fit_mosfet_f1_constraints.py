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
from fit_conveyor import (IDENTITY_VERSION, Unfittable, canonical_hash, citation_cohort_material,
                           finite_number, validate_citation_identity, validate_condition_identity)

PROBE_OPTIONS = ".options reltol=1e-6 abstol=1e-15 vntol=1e-9 itl1=500"
BISECTION_STEPS = 48
BOUND_RELATIVE_TOLERANCE = 1e-9
THRESHOLD_BOUND_ABSOLUTE_TOLERANCE = 1e-10
RDSON_BOUND_ABSOLUTE_TOLERANCE = 1e-12
THRESHOLD_INTERIOR_GUARD_ABSOLUTE_V = 1e-7
THRESHOLD_INTERIOR_GUARD_RELATIVE_SPAN = 1e-6
THRESHOLD_INTERIOR_GUARD_MAXIMUM_FRACTION = 0.25


class Infeasible(Exception):
    """No model in the declared F1 search domain satisfies every constraint."""


def inclusive_bound_tolerance(bound, absolute_floor):
    """Absorb only native-probe floating-point noise at an inclusive source bound."""
    return max(absolute_floor, abs(float(bound)) * BOUND_RELATIVE_TOLERANCE)


def threshold_interior_guard(minimum_v, maximum_v):
    """Return a deterministic response-space margin that remains inside cited bounds."""
    span = float(maximum_v) - float(minimum_v)
    if not span > 0:
        raise Infeasible(f"threshold interval is degenerate or reversed: {minimum_v} to {maximum_v} V")
    requested = max(THRESHOLD_INTERIOR_GUARD_ABSOLUTE_V,
                    span * THRESHOLD_INTERIOR_GUARD_RELATIVE_SPAN)
    return min(requested, span * THRESHOLD_INTERIOR_GUARD_MAXIMUM_FRACTION)


def evidence_hash(characteristic, role, quantity, value_si, unit_si, condition_id, citation_id):
    return canonical_hash({"characteristic": characteristic, "role": role, "quantity": quantity,
                           "value_si": value_si, "unit_si": unit_si,
                           "condition_id": condition_id, "citation_id": citation_id})


def validate_constraint_evidence(payload):
    """Pass-through validation only: never infer, merge, or default critical evidence."""
    if payload.get("evidence_contract_version") != IDENTITY_VERSION:
        if payload.get("test_only_allow_legacy_evidence") is True:
            return
        raise ValueError(f"MOSFET F1 constraint payload requires evidence_contract_version {IDENTITY_VERSION}")
    for index, constraint in enumerate(payload.get("constraints") or []):
        label = f"constraints[{index}]"
        kind = constraint.get("kind")
        characteristic = "gate_threshold" if kind == "threshold_interval" else "rds_on" if kind == "rdson_maximum" else None
        if characteristic is None:
            raise ValueError(f"{label} has unsupported kind {kind!r}")
        try:
            condition = validate_condition_identity(constraint.get("condition_identity"), characteristic,
                                                    f"{label}.condition_identity", dc_only=True)
        except Unfittable as exc:
            raise ValueError(str(exc)) from exc
        cohort = constraint.get("citation_cohort")
        required_cohort = {"cohort_id", "source_sha256", "page", "table", "row"}
        if not isinstance(cohort, dict) or set(cohort) != required_cohort:
            raise ValueError(f"{label}.citation_cohort must contain exactly {sorted(required_cohort)}")
        evidence_rows = constraint.get("evidence")
        expected = ([('threshold_minimum', 'V', 'minimum', constraint.get('minimum_v')),
                     ('threshold_maximum', 'V', 'maximum', constraint.get('maximum_v'))]
                    if kind == "threshold_interval" else
                    [('vgs', 'V', None, constraint.get('vgs_v')),
                     ('drain_current', 'A', None, constraint.get('current_a')),
                     ('rds_on_maximum', 'ohm', 'maximum', constraint.get('maximum_ohm'))])
        if not isinstance(evidence_rows, list) or len(evidence_rows) != len(expected):
            raise ValueError(f"{label}.evidence must contain {len(expected)} independently complete rows")
        condition_ids, cohort_ids = set(), set()
        for row_index, (row, (quantity, unit, required_role, top_value)) in enumerate(zip(evidence_rows, expected)):
            row_label = f"{label}.evidence[{row_index}]"
            if not isinstance(row, dict) or set(row) != {"quantity", "value_si", "unit_si", "condition_identity", "citation_identity", "evidence_identity"}:
                raise ValueError(f"{row_label} has incomplete or unknown fields")
            if row["quantity"] != quantity or row["unit_si"] != unit:
                raise ValueError(f"{row_label} quantity or SI unit does not match the constraint contract")
            value = finite_number(row["value_si"], f"{row_label}.value_si")
            if abs(value - float(top_value)) > max(1e-15, abs(value) * 1e-12):
                raise ValueError(f"{row_label} value does not match top-level probe field")
            try:
                row_condition = validate_condition_identity(row["condition_identity"], characteristic,
                                                            f"{row_label}.condition_identity", dc_only=True)
                citation = validate_citation_identity(row["citation_identity"], f"{row_label}.citation_identity")
            except Unfittable as exc:
                raise ValueError(str(exc)) from exc
            if row_condition != condition:
                raise ValueError(f"{row_label} condition identity is not byte-equivalent to the constraint identity")
            identity = row["evidence_identity"]
            if not isinstance(identity, dict) or set(identity) != {"evidence_id", "cohort_id", "role", "condition_id", "citation_id"}:
                raise ValueError(f"{row_label}.evidence_identity has incomplete or unknown fields")
            if required_role and identity["role"] != required_role:
                raise ValueError(f"{row_label} requires evidence role {required_role}")
            if kind == "rdson_maximum" and identity["role"] != "maximum":
                raise ValueError(f"{row_label} RDS maximum components must all use maximum role")
            expected_cohort = canonical_hash(citation_cohort_material(characteristic, condition["condition_id"], citation))
            expected_evidence = evidence_hash(characteristic, identity["role"], quantity, value, unit,
                                              condition["condition_id"], citation["citation_id"])
            if identity["condition_id"] != condition["condition_id"] or identity["citation_id"] != citation["citation_id"] \
                    or identity["cohort_id"] != expected_cohort or identity["evidence_id"] != expected_evidence:
                raise ValueError(f"{row_label} hashes do not match canonical evidence content")
            condition_ids.add(identity["condition_id"])
            cohort_ids.add(identity["cohort_id"])
        if condition_ids != {condition["condition_id"]} or len(cohort_ids) != 1:
            raise ValueError(f"{label} contains hybrid condition or citation cohort fields")
        if cohort["cohort_id"] != next(iter(cohort_ids)):
            raise ValueError(f"{label}.citation_cohort.cohort_id does not match evidence")
        representative = evidence_rows[0]["citation_identity"]
        for key in ("source_sha256", "page", "table", "row"):
            if cohort[key] != representative[key]:
                raise ValueError(f"{label}.citation_cohort.{key} does not match evidence citation")
        electrical = condition["electrical"]
        temperature = condition["temperature"]["value_c"]
        if abs(float(constraint["temperature_c"]) - temperature) > 1e-12:
            raise ValueError(f"{label}.temperature_c does not match condition identity")
        if kind == "threshold_interval":
            if constraint.get("vds_relation") != "vds_equals_vgs" or electrical["vds"] != {"kind": "relation", "relation": "vds_equals_vgs"}:
                raise ValueError(f"{label} threshold VDS relation does not match condition identity")
            if electrical["id"].get("kind") != "fixed" or abs(abs(electrical["id"]["value_a"]) - abs(float(constraint["current_a"]))) > 1e-15:
                raise ValueError(f"{label}.current_a does not match threshold condition identity")
        else:
            if electrical["vgs"].get("kind") != "fixed" or electrical["id"].get("kind") != "fixed":
                raise ValueError(f"{label} RDS condition requires exact VGS and ID")
            if electrical["vds"] != {"kind": "relation", "relation": "vds_not_stated"}:
                raise ValueError(f"{label} RDS condition must preserve that VDS was not stated")
            if abs(abs(electrical["vgs"]["value_v"]) - abs(float(constraint["vgs_v"]))) > 1e-15 \
                    or abs(abs(electrical["id"]["value_a"]) - abs(float(constraint["current_a"]))) > 1e-15:
                raise ValueError(f"{label} probe values do not match RDS condition identity")


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
    tolerance = inclusive_bound_tolerance(target, THRESHOLD_BOUND_ABSOLUTE_TOLERANCE)
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


def threshold_domain(rdson, fixed, threshold_constraints, polarity, bounds, apply_interior_guard=False):
    lower, upper = bounds
    guard_records = []
    for constraint in threshold_constraints:
        def evaluate(candidate):
            params = model_parameters(candidate, rdson, fixed)
            return probe(params, [constraint], polarity)[constraint["id"]]

        guard = threshold_interior_guard(constraint["minimum_v"], constraint["maximum_v"]) if apply_interior_guard else 0.0
        guarded_minimum = constraint["minimum_v"] + guard
        guarded_maximum = constraint["maximum_v"] - guard
        permitted_low = bisect_increasing(guarded_minimum, bounds[0], bounds[1], evaluate)
        permitted_high = bisect_increasing(guarded_maximum, bounds[0], bounds[1], evaluate)
        lower = max(lower, permitted_low)
        upper = min(upper, permitted_high)
        guard_records.append({
            "constraint_id": constraint["id"],
            "source_minimum_v": constraint["minimum_v"],
            "source_maximum_v": constraint["maximum_v"],
            "response_guard_v": guard,
            "guarded_minimum_v": guarded_minimum,
            "guarded_maximum_v": guarded_maximum,
        })
    if lower > upper + 1e-10:
        raise Infeasible(f"threshold intervals have an empty feasible VTO intersection [{lower:.12g}, {upper:.12g}]")
    return lower, upper, guard_records


def rdson_domain(vto, rdson_constraints, fixed, polarity, bounds):
    lower, upper = bounds
    for constraint in rdson_constraints:
        def evaluate(candidate):
            params = model_parameters(vto, candidate, fixed)
            return probe(params, [constraint], polarity)[constraint["id"]]

        low_value = evaluate(bounds[0])
        tolerance = inclusive_bound_tolerance(constraint["maximum_ohm"], RDSON_BOUND_ABSOLUTE_TOLERANCE)
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
            minimum_tolerance = inclusive_bound_tolerance(
                constraint["minimum_v"], THRESHOLD_BOUND_ABSOLUTE_TOLERANCE)
            maximum_tolerance = inclusive_bound_tolerance(
                constraint["maximum_v"], THRESHOLD_BOUND_ABSOLUTE_TOLERANCE)
            satisfied = (constraint["minimum_v"] - minimum_tolerance
                         <= value
                         <= constraint["maximum_v"] + maximum_tolerance)
            bounds = {"minimum": constraint["minimum_v"], "maximum": constraint["maximum_v"], "unit": "V"}
            verification_tolerance = {
                "relative_factor": BOUND_RELATIVE_TOLERANCE,
                "absolute_floor": THRESHOLD_BOUND_ABSOLUTE_TOLERANCE,
                "minimum": minimum_tolerance,
                "maximum": maximum_tolerance,
                "unit": "V",
            }
        else:
            tolerance = inclusive_bound_tolerance(
                constraint["maximum_ohm"], RDSON_BOUND_ABSOLUTE_TOLERANCE)
            satisfied = value <= constraint["maximum_ohm"] + tolerance
            bounds = {"maximum": constraint["maximum_ohm"], "unit": "ohm"}
            verification_tolerance = {
                "relative_factor": BOUND_RELATIVE_TOLERANCE,
                "absolute_floor": RDSON_BOUND_ABSOLUTE_TOLERANCE,
                "maximum": tolerance,
                "unit": "ohm",
            }
        results.append({**constraint, "predicted_value": value, "inclusive": True,
                        "satisfied": satisfied, "verification_tolerance": verification_tolerance, **bounds})
    return results


def fit(payload):
    validate_constraint_evidence(payload)
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
    threshold_guard_records = []
    for _ in range(4):
        old = (vto, rdson)
        if threshold_constraints:
            feasible_low, feasible_high, threshold_guard_records = threshold_domain(
                rdson, fixed, threshold_constraints, polarity, vto_bounds,
                apply_interior_guard=adjust_vto)
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
            "threshold_interior_guard_policy": {
                "applied_to_adjustable_projection": adjust_vto and bool(threshold_constraints),
                "absolute_floor_v": THRESHOLD_INTERIOR_GUARD_ABSOLUTE_V,
                "relative_interval_span_factor": THRESHOLD_INTERIOR_GUARD_RELATIVE_SPAN,
                "maximum_interval_fraction": THRESHOLD_INTERIOR_GUARD_MAXIMUM_FRACTION,
                "constraints": threshold_guard_records,
            },
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
    except (Infeasible, Unfittable, ValueError, KeyError, TypeError) as exc:
        result = {"ok": False, "error": str(exc)}
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
