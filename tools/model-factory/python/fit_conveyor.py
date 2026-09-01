#!/usr/bin/env python3
"""Conveyor bulk F2 fitter.

Replaces the ad-hoc regressions that lived in lib/bulk-adapter.mjs. Those selected
curves by name substring, ignored declared axis units and test conditions, omitted
parameters the archetypes require, and in two of three families had no reachable F2
path at all. See tools/conveyor/DIAGNOSIS.md.

Contract:
  stdin/argv[1]  JSON  {family, extraction, seed_hints, mpn, manufacturer, description}
  argv[2]        path  JSON result

Result:
  {fidelity, parameters, residuals[], worst, rms, gate, curves_used[],
   curves_rejected[], demotion_reason}

Every reported residual is measured by evaluating the emitted model in native
ngspice-46, never by re-evaluating the fitter's own algebra.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector

GATES = json.loads((Path(__file__).resolve().parents[1] / "lib" / "fit-gates.json").read_text())
VT = 1.380649e-23 * 298.15 / 1.602176634e-19

SI = {"y": 1e-24, "z": 1e-21, "a": 1e-18, "f": 1e-15, "p": 1e-12, "n": 1e-9,
      "u": 1e-6, "µ": 1e-6, "μ": 1e-6, "m": 1e-3, "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9}


class Unfittable(Exception):
    """The extraction cannot support an F2 fit. Carries the honest reason."""


IDENTITY_VERSION = "1.0.0"
HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
PLACEHOLDER_CITATION = re.compile(r"(?:pending|placeholder|unknown|tbd|todo|n/?a|not\s+available)", re.I)
ALLOWED_CHARACTERISTICS = {"gate_threshold", "rds_on", "transfer_current", "output_current"}
ALLOWED_EVIDENCE_ROLES = {"minimum", "typical", "maximum", "digitized_typical_curve", "seed_only"}
ALLOWED_RESIDUAL_QUALIFIERS = {"typical", "digitized_typical_curve", "maximum"}


def canonical_number(value):
    """ECMAScript JSON number spelling used by the JavaScript package-ID producer."""
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("identity material numbers must be finite")
    if number == 0:
        return "0"
    magnitude = abs(number)
    shortest = repr(number).lower()
    if "e" in shortest:
        mantissa, exponent = shortest.split("e")
        exponent_value = int(exponent)
        if magnitude >= 1e21 or magnitude < 1e-6:
            return f"{mantissa}e{'+' if exponent_value >= 0 else '-'}{abs(exponent_value)}"
        digits = mantissa.replace("-", "").replace(".", "")
        sign = "-" if number < 0 else ""
        decimal_position = 1 + exponent_value
        return sign + "0." + "0" * (-decimal_position) + digits if decimal_position <= 0 \
            else sign + digits[:decimal_position] + "0" * max(decimal_position - len(digits), 0) \
            + ("." + digits[decimal_position:] if decimal_position < len(digits) else "")
    return str(int(number)) if number.is_integer() else shortest


def canonical_json(value):
    """Cross-language canonical JSON matching JavaScript JSON.stringify for contract numbers.

    Python independently recomputes every supplied condition, citation, cohort, curve,
    and evidence ID before fitting, so exponent spelling is part of package acceptance.
    """
    def encode(item):
        if item is None:
            return "null"
        if isinstance(item, bool):
            return "true" if item else "false"
        if isinstance(item, str):
            return json.dumps(item, ensure_ascii=False, separators=(",", ":"))
        if isinstance(item, (int, float)):
            return canonical_number(item)
        if isinstance(item, list):
            return "[" + ",".join(encode(child) for child in item) + "]"
        if isinstance(item, dict):
            return "{" + ",".join(f"{json.dumps(key, ensure_ascii=False)}:{encode(item[key])}" for key in sorted(item)) + "}"
        raise TypeError(f"identity material contains non-JSON value: {type(item).__name__}")
    return encode(value)


def canonical_hash(value, excluded=()):
    material = {key: item for key, item in value.items() if key not in set(excluded)}
    return "sha256:" + hashlib.sha256(canonical_json(material).encode("utf-8")).hexdigest()


def require_exact_keys(value, required, optional, label):
    if not isinstance(value, dict):
        raise Unfittable(f"{label} must be an object")
    keys = set(value)
    missing = set(required) - keys
    unknown = keys - set(required) - set(optional)
    if missing:
        raise Unfittable(f"{label} is incomplete; missing {', '.join(sorted(missing))}")
    if unknown:
        raise Unfittable(f"{label} contains unknown fields {', '.join(sorted(unknown))}")
    if any(item is None for item in value.values()):
        raise Unfittable(f"{label} must omit absent optional fields instead of using null")


def finite_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise Unfittable(f"{label} must be a finite number")
    return float(value)


def validate_voltage_shape(value, label):
    require_exact_keys(value, {"kind"}, {"value_v", "relation", "lower_v", "upper_v"}, label)
    kind = value["kind"]
    if kind == "fixed":
        if set(value) != {"kind", "value_v"}:
            raise Unfittable(f"{label} fixed voltage requires only value_v")
        finite_number(value["value_v"], f"{label}.value_v")
    elif kind == "relation":
        if set(value) != {"kind", "relation"} or not isinstance(value["relation"], str) or not value["relation"].strip():
            raise Unfittable(f"{label} relation voltage requires only a non-empty relation")
    elif kind == "range":
        if set(value) != {"kind", "lower_v", "upper_v"}:
            raise Unfittable(f"{label} range voltage requires lower_v and upper_v")
        low = finite_number(value["lower_v"], f"{label}.lower_v")
        high = finite_number(value["upper_v"], f"{label}.upper_v")
        if not low < high:
            raise Unfittable(f"{label} voltage range must be increasing")
    else:
        raise Unfittable(f"{label}.kind is unknown: {kind!r}")


def validate_current_shape(value, label):
    require_exact_keys(value, {"kind"}, {"value_a", "lower_a", "upper_a"}, label)
    kind = value["kind"]
    if kind == "fixed":
        if set(value) != {"kind", "value_a"}:
            raise Unfittable(f"{label} fixed current requires only value_a")
        finite_number(value["value_a"], f"{label}.value_a")
    elif kind == "range":
        if set(value) != {"kind", "lower_a", "upper_a"}:
            raise Unfittable(f"{label} current range requires lower_a and upper_a")
        low = finite_number(value["lower_a"], f"{label}.lower_a")
        high = finite_number(value["upper_a"], f"{label}.upper_a")
        if not low < high:
            raise Unfittable(f"{label} current range must be increasing")
    else:
        raise Unfittable(f"{label}.kind is unknown: {kind!r}")


def validate_condition_identity(identity, characteristic=None, label="condition_identity", dc_only=False):
    require_exact_keys(identity,
                       {"schema_version", "characteristic", "polarity", "magnitude_convention", "temperature",
                        "electrical", "test_mode", "qualifiers", "condition_id"}, set(), label)
    if identity["schema_version"] != IDENTITY_VERSION:
        raise Unfittable(f"{label}.schema_version must be {IDENTITY_VERSION}")
    if identity["characteristic"] not in ALLOWED_CHARACTERISTICS or (characteristic and identity["characteristic"] != characteristic):
        raise Unfittable(f"{label}.characteristic does not match {characteristic!r}")
    if identity["polarity"] not in {"n", "p"} or identity["magnitude_convention"] not in {"signed", "absolute"}:
        raise Unfittable(f"{label} has invalid polarity or magnitude convention")
    temperature = identity["temperature"]
    require_exact_keys(temperature, {"kind", "value_c"}, set(), f"{label}.temperature")
    if temperature["kind"] not in {"junction", "ambient", "case"}:
        raise Unfittable(f"{label}.temperature.kind is unknown")
    finite_number(temperature["value_c"], f"{label}.temperature.value_c")
    electrical = identity["electrical"]
    require_exact_keys(electrical, {"vgs", "vds", "id"}, set(), f"{label}.electrical")
    validate_voltage_shape(electrical["vgs"], f"{label}.electrical.vgs")
    validate_voltage_shape(electrical["vds"], f"{label}.electrical.vds")
    validate_current_shape(electrical["id"], f"{label}.electrical.id")
    mode = identity["test_mode"]
    require_exact_keys(mode, {"kind"}, {"pulse_width_s", "duty_cycle", "repetition_period_s", "repetition_frequency_hz"}, f"{label}.test_mode")
    if mode["kind"] not in {"dc", "continuous", "pulsed", "single_pulse"}:
        raise Unfittable(f"{label}.test_mode.kind is unknown")
    for key in set(mode) - {"kind"}:
        number = finite_number(mode[key], f"{label}.test_mode.{key}")
        if number <= 0 or (key == "duty_cycle" and number > 1):
            raise Unfittable(f"{label}.test_mode.{key} is outside its physical range")
    if mode["kind"] in {"dc", "continuous"} and len(mode) != 1:
        raise Unfittable(f"{label} continuous/DC mode cannot carry pulse qualifiers")
    if mode["kind"] in {"pulsed", "single_pulse"} and "pulse_width_s" not in mode:
        raise Unfittable(f"{label} pulsed mode requires pulse_width_s")
    if dc_only and mode["kind"] not in {"dc", "continuous"}:
        raise Unfittable(f"{label} is pulsed evidence and cannot enter a static DC MOSFET fit")
    qualifiers = identity["qualifiers"]
    if not isinstance(qualifiers, list):
        raise Unfittable(f"{label}.qualifiers must be an array")
    normalized = []
    for index, qualifier in enumerate(qualifiers):
        require_exact_keys(qualifier, {"key", "value"}, set(), f"{label}.qualifiers[{index}]")
        if not all(isinstance(qualifier[key], str) and qualifier[key].strip() for key in ("key", "value")):
            raise Unfittable(f"{label}.qualifiers[{index}] must contain non-empty strings")
        normalized.append((qualifier["key"], qualifier["value"]))
    if normalized != sorted(normalized) or len(normalized) != len(set(normalized)):
        raise Unfittable(f"{label}.qualifiers must be unique and sorted by key then value")
    qualifier_map = dict(normalized)
    semantic_adjudication = qualifier_map.get("semantic_adjudication")
    source_mode = qualifier_map.get("source_test_mode")
    temperature_provenance = qualifier_map.get("temperature_provenance")
    static_policy = qualifier_map.get("static_characteristic_policy")
    adjudication_fields = {key for key in qualifier_map if key in {
        "semantic_adjudication", "source_test_mode", "temperature_provenance", "static_characteristic_policy"
    }}
    if adjudication_fields:
        if semantic_adjudication != "content_addressed":
            raise Unfittable(f"{label} semantic adjudication must be content-addressed")
        if source_mode not in {"dc", "continuous", "pulsed", "single_pulse", "not_stated"}:
            raise Unfittable(f"{label} has an unknown adjudicated source test mode")
        if temperature_provenance not in {"inline_condition", "table_heading", "figure_label", "footnote", "section_scope"}:
            raise Unfittable(f"{label} has unknown adjudicated temperature provenance")
        if source_mode == "not_stated":
            if identity["characteristic"] not in {"gate_threshold", "transfer_current", "output_current"}:
                raise Unfittable(f"{label} does not admit not_stated source mode for this characteristic")
            if mode["kind"] != "dc" or static_policy != identity["characteristic"]:
                raise Unfittable(f"{label} not_stated source mode lacks the exact static-characteristic policy")
        elif static_policy is not None:
            raise Unfittable(f"{label} static-characteristic policy is only valid for not_stated source mode")
        elif mode["kind"] != source_mode:
            raise Unfittable(f"{label} source and canonical test modes disagree")
        if dc_only and source_mode in {"pulsed", "single_pulse"}:
            raise Unfittable(f"{label} is pulsed source evidence and cannot enter a static DC MOSFET fit")
    if not HASH_PATTERN.fullmatch(str(identity["condition_id"])) or identity["condition_id"] != canonical_hash(identity, {"condition_id"}):
        raise Unfittable(f"{label}.condition_id does not match canonical content")
    return identity


def validate_citation_identity(identity, label="citation_identity"):
    require_exact_keys(identity, {"source_sha256", "page", "citation_id"},
                       {"source_revision", "section", "table", "row", "column", "figure", "curve", "trace"}, label)
    source_hash = identity["source_sha256"]
    if not isinstance(source_hash, str) or not re.fullmatch(r"(?:sha256:)?[0-9a-f]{64}", source_hash):
        raise Unfittable(f"{label}.source_sha256 must be a real SHA-256 digest")
    if isinstance(identity["page"], bool) or not isinstance(identity["page"], int) or identity["page"] <= 0:
        raise Unfittable(f"{label}.page must be a positive integer")
    for key in set(identity) - {"source_sha256", "page", "citation_id"}:
        if not isinstance(identity[key], str) or not identity[key].strip() or PLACEHOLDER_CITATION.search(identity[key]):
            raise Unfittable(f"{label}.{key} is missing or placeholder citation context")
    table_locator = all(key in identity for key in ("table", "row"))
    figure_locator = "figure" in identity and ("curve" in identity or "trace" in identity)
    if table_locator == figure_locator:
        raise Unfittable(f"{label} must identify exactly one table+row or figure+curve/trace locator")
    if not HASH_PATTERN.fullmatch(str(identity["citation_id"])) or identity["citation_id"] != canonical_hash(identity, {"citation_id"}):
        raise Unfittable(f"{label}.citation_id does not match canonical content")
    return identity


def citation_cohort_material(characteristic, condition_id, citation):
    locator = {key: citation[key] for key in ("source_sha256", "page", "table", "row", "figure", "curve", "trace") if key in citation}
    return {"characteristic": characteristic, "condition_id": condition_id, **locator}


def evidence_value_material(characteristic, role, quantity, value_si, unit_si, condition_id, citation_id):
    return {"characteristic": characteristic, "role": role, "quantity": quantity, "value_si": value_si,
            "unit_si": unit_si, "condition_id": condition_id, "citation_id": citation_id}


def validate_evidence_bundle(datum, characteristic, quantity, unit_si, roles, label, dc_only=False):
    if not isinstance(datum, dict):
        raise Unfittable(f"{label} must be an object")
    condition = validate_condition_identity(datum.get("condition_identity"), characteristic, f"{label}.condition_identity", dc_only=dc_only)
    citation = validate_citation_identity(datum.get("citation_identity"), f"{label}.citation_identity")
    evidence = datum.get("evidence_identity")
    require_exact_keys(evidence, {"evidence_id", "cohort_id", "role", "condition_id", "citation_id"}, set(), f"{label}.evidence_identity")
    if evidence["role"] not in roles or evidence["role"] not in ALLOWED_EVIDENCE_ROLES:
        raise Unfittable(f"{label}.evidence_identity.role is not allowed for {quantity}")
    if evidence["condition_id"] != condition["condition_id"] or evidence["citation_id"] != citation["citation_id"]:
        raise Unfittable(f"{label} identity references do not match their full objects")
    expected_cohort = canonical_hash(citation_cohort_material(characteristic, condition["condition_id"], citation))
    if evidence["cohort_id"] != expected_cohort:
        raise Unfittable(f"{label}.evidence_identity.cohort_id does not match condition and citation cohort")
    value = finite_number(datum.get("value"), f"{label}.value")
    if datum.get("unit") != unit_si:
        raise Unfittable(f"{label}.unit must be {unit_si}")
    expected_evidence = canonical_hash(evidence_value_material(characteristic, evidence["role"], quantity, value, unit_si,
                                                               condition["condition_id"], citation["citation_id"]))
    if evidence["evidence_id"] != expected_evidence:
        raise Unfittable(f"{label}.evidence_identity.evidence_id does not match value and identities")
    return {"condition_identity": condition, "citation_identity": citation, "evidence_identity": evidence,
            "value": value, "unit": unit_si}


def identities_equal(rows, label):
    if not rows:
        return
    condition_ids = {row["condition_identity"]["condition_id"] for row in rows}
    cohort_ids = {row["evidence_identity"]["cohort_id"] for row in rows}
    if len(condition_ids) != 1 or len(cohort_ids) != 1:
        raise Unfittable(f"{label} fields are a hybrid of incompatible conditions or citation cohorts")


def curve_cohort_id(characteristic, condition_id, citation_id, curve_id):
    return canonical_hash({"characteristic": characteristic, "condition_id": condition_id,
                           "citation_id": citation_id, "curve_id": curve_id})


def validate_curve_identity(curve, characteristic, x_unit, y_unit, label):
    condition = validate_condition_identity(curve.get("condition_identity"), characteristic,
                                            f"{label}.condition_identity", dc_only=True)
    citation = validate_citation_identity(curve.get("citation_identity"), f"{label}.citation_identity")
    if "figure" not in citation:
        raise Unfittable(f"{label}.citation_identity must use a figure+curve/trace locator")
    x_axis = curve.get("x_axis")
    y_axis = curve.get("y_axis")
    if not isinstance(x_axis, dict) or not isinstance(y_axis, dict):
        raise Unfittable(f"{label} must carry explicit x_axis and y_axis objects")
    if x_axis.get("unit") != x_unit or y_axis.get("unit") != y_unit:
        raise Unfittable(f"{label} axes must use SI units {x_unit} and {y_unit}")
    points = curve.get("points")
    if not isinstance(points, list) or not points:
        raise Unfittable(f"{label} must carry digitized points")
    curve_points = []
    for index, point in enumerate(points):
        require_exact_keys(point, {"point_index", "x_si", "y_si", "evidence_identity"}, set(), f"{label}.points[{index}]")
        if point["point_index"] != index:
            raise Unfittable(f"{label}.points[{index}].point_index must preserve ordered zero-based indexing")
        curve_points.append({"point_index": index,
                             "x_si": finite_number(point["x_si"], f"{label}.points[{index}].x_si"),
                             "y_si": finite_number(point["y_si"], f"{label}.points[{index}].y_si")})
    material = {"schema_version": IDENTITY_VERSION, "characteristic": characteristic,
                "x_axis": x_axis, "y_axis": y_axis, "condition_id": condition["condition_id"],
                "citation_id": citation["citation_id"], "points": curve_points}
    curve_id = curve.get("curve_id")
    if not HASH_PATTERN.fullmatch(str(curve_id)) or curve_id != canonical_hash(material):
        raise Unfittable(f"{label}.curve_id does not match canonical axes, identities, and ordered points")
    cohort_id = curve_cohort_id(characteristic, condition["condition_id"], citation["citation_id"], curve_id)
    for index, (raw_point, point) in enumerate(zip(points, curve_points)):
        evidence = raw_point["evidence_identity"]
        require_exact_keys(evidence, {"evidence_id", "cohort_id", "role", "condition_id", "citation_id", "curve_id", "point_index"},
                           set(), f"{label}.points[{index}].evidence_identity")
        if evidence["role"] != "digitized_typical_curve" or evidence["condition_id"] != condition["condition_id"] \
                or evidence["citation_id"] != citation["citation_id"] or evidence["cohort_id"] != cohort_id:
            raise Unfittable(f"{label}.points[{index}] identity references do not match the shared curve identity")
        if evidence["curve_id"] != curve_id or evidence["point_index"] != point["point_index"]:
            raise Unfittable(f"{label}.points[{index}] nested curve and point identity does not match the point")
        point_material = {"characteristic": characteristic, "role": "digitized_typical_curve", **point,
                          "condition_id": condition["condition_id"], "citation_id": citation["citation_id"],
                          "cohort_id": cohort_id, "curve_id": curve_id}
        if evidence["evidence_id"] != canonical_hash(point_material):
            raise Unfittable(f"{label}.points[{index}].evidence_id does not match the canonical point")
    return {"condition_identity": condition, "citation_identity": citation, "curve_id": curve_id,
            "cohort_id": cohort_id, "points": curve_points}


def real_citation(citation):
    locator = f"table {citation['table']}, row {citation['row']}" if "table" in citation else f"figure {citation['figure']}, {('curve ' + citation['curve']) if 'curve' in citation else ('trace ' + citation['trace'])}"
    return f"source {citation['source_sha256']}, page {citation['page']}, {locator}"


# --------------------------------------------------------------------------- units


def unit_scale(unit, base):
    """Multiplier converting a declared `unit` string into SI `base` ('A', 'V', 'F', ...).

    The old fitter read point.y as a bare number, so a curve declaring mA was read as A.
    """
    if unit is None:
        return 1.0
    u = str(unit).strip().replace("Ohm", "ohm").replace("Ω", "ohm")
    b = base.replace("Ω", "ohm")
    if u == b or u in ("1", ""):
        return 1.0
    if u.endswith(b) and len(u) == len(b) + 1:
        prefix = u[0]
        if prefix in SI:
            return SI[prefix]
    raise Unfittable(f"unrecognised unit {unit!r} for a quantity expected in {base}")


def axis(curve, which):
    a = curve.get(f"{which}_axis") or {}
    return (a.get("quantity") or "").lower(), (a.get("unit") or ""), (a.get("scale") or "").lower()


def context(curve):
    return " ".join([str(curve.get("name") or ""), str(curve.get("test_conditions") or "")]).lower()


def temperature_of(curve):
    """Ambient/junction temperature in degC stated for this curve, or None."""
    text = context(curve)
    m = re.search(r"(?:t[ajc]?\s*(?:amb|j|a|c)?\s*[= ]\s*)([+-]?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c|c\b)", text)
    if m:
        return float(m.group(1))
    m = re.search(r"([+-]?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c)", text)
    return float(m.group(1)) if m else None


def bias_of(curve, symbol):
    """A stated bias such as VGS or VCE, in volts, or None."""
    text = context(curve).replace("_", "")
    m = re.search(rf"{symbol}\s*(?:magnitude)?\s*[= ]\s*(-?\d+(?:\.\d+)?)\s*v", text)
    return abs(float(m.group(1))) if m else None


def points_of(curve, x_base, y_base):
    sx = unit_scale(axis(curve, "x")[1], x_base)
    sy = unit_scale(axis(curve, "y")[1], y_base)
    out = []
    for p in curve.get("points") or []:
        try:
            x, y = float(p["x"]) * sx, float(p["y"]) * sy
        except (TypeError, ValueError, KeyError):
            continue
        if math.isfinite(x) and math.isfinite(y):
            out.append((x, y))
    out.sort(key=lambda pair: pair[0])
    return out


# ---------------------------------------------------------------- curve validation


def reject_non_monotonic(points, mode, label, rejected):
    """Drop a trace whose shape violates device physics.

    mode 'increasing'    : y must strictly rise with x (diode forward I-V)
    mode 'nondecreasing' : y must never fall as x rises (MOSFET output ID vs VDS)
    """
    if len(points) < 2:
        return points
    ys = [y for _, y in points]
    if mode == "increasing":
        bad = any(ys[i] <= ys[i - 1] for i in range(1, len(ys)))
    else:
        # allow digitisation noise up to 2% of the local value before calling it a fall
        bad = any(ys[i] < ys[i - 1] * 0.98 for i in range(1, len(ys)))
    if bad:
        rejected.append(f"{label}: non-monotonic digitised trace (y must be {mode} in x); excluded from fitting")
        return []
    return points


# ------------------------------------------------------------------ curve selection


def select_forward_iv(extraction, rejected):
    """The 25 degC forward I-V curve, chosen by axis SEMANTICS, not by name."""
    best = None
    for curve in extraction.get("curves") or []:
        xq, xu, _ = axis(curve, "x")
        yq, yu, _ = axis(curve, "y")
        text = context(curve)
        label = curve.get("name") or "unnamed curve"

        if "revers" in xq or "revers" in yq or "capacit" in yq:
            continue
        if "temperat" in xq or "duration" in xq or "cycle" in xq:
            rejected.append(f"{label}: abscissa is {xq!r}, not a forward voltage; not an I-V curve")
            continue
        if "average" in yq or "rectified" in yq or "surge" in yq or "derat" in text:
            rejected.append(f"{label}: ordinate is {yq!r} (a rating/derating curve), not an instantaneous forward current")
            continue
        if "volt" not in xq or "current" not in yq:
            continue
        try:
            pts = points_of(curve, "V", "A")
        except Unfittable as exc:
            rejected.append(f"{label}: {exc}")
            continue

        temp = temperature_of(curve)
        if temp is not None and abs(temp - 25) > 5:
            continue  # a hot/cold trace; the archetype fits at one stated temperature
        pts = [(v, i) for v, i in pts if v > 0 and i > 0]
        score = (1 if temp is not None else 0, len(pts))
        if len(pts) >= 3 and (best is None or score > best[0]):
            best = (score, curve, pts)
    if best is None:
        raise Unfittable("no 25 degC forward I-V curve with a forward-voltage abscissa and a forward-current ordinate")
    _, curve, pts = best
    label = curve.get("name") or "unnamed curve"
    pts = reject_non_monotonic(pts, "increasing", label, rejected)
    if len(pts) < GATES["families"]["diode"]["minimum_points"]:
        raise Unfittable(f"forward I-V curve {label!r} has {len(pts)} usable points after validation; "
                         f"{GATES['families']['diode']['minimum_points']} required")
    return curve, pts


def select_gain_curve(extraction, rejected):
    """The digitised typical hFE-versus-IC curve at one stated VCE."""
    best = None
    for curve in extraction.get("curves") or []:
        xq, _, _ = axis(curve, "x")
        yq, _, _ = axis(curve, "y")
        label = curve.get("name") or "unnamed curve"
        if "collector current" not in xq:
            continue
        if "gain" not in yq and "hfe" not in yq:
            continue
        if "bandwidth" in yq or "product" in yq:
            continue
        temp = temperature_of(curve)
        if temp is not None and abs(temp - 25) > 5:
            continue
        try:
            pts = points_of(curve, "A", "1")
        except Unfittable as exc:
            rejected.append(f"{label}: {exc}")
            continue
        # Datasheet plots often preserve PNP polarity as negative IC values even though
        # the device polarity is carried separately in specs.polarity. Fit magnitudes so
        # an otherwise valid signed PNP gain curve is not discarded.
        pts = sorted((abs(ic), abs(h)) for ic, h in pts if ic != 0 and h != 0)
        vce = bias_of(curve, "vce")
        if len(pts) >= GATES["families"]["bjt"]["minimum_points"] and vce and (best is None or len(pts) > len(best[2])):
            best = (curve, vce, pts)
    if best is None:
        raise Unfittable("no digitised typical hFE-versus-collector-current curve at a stated VCE and 25 degC")
    return best


def select_mosfet_curves(extraction, rejected):
    """Select only canonical, independently identified static transfer/output curves."""
    transfer = None
    outputs = []
    for curve in extraction.get("curves") or []:
        xq, _, _ = axis(curve, "x")
        yq, _, _ = axis(curve, "y")
        label = curve.get("name") or "unnamed curve"
        is_drain_current = ("current" in yq or "drain" in yq or re.search(r"\bid\b", yq))
        if not is_drain_current or "capacit" in yq or "resist" in yq or "normal" in yq or "gate" in yq:
            continue
        blob = f"{xq} {yq} {context(curve)}"
        if "body" in blob or "source-drain" in blob or "source drain" in blob or "diode" in blob:
            rejected.append(f"{label}: body/source-drain diode characteristic, not a channel output curve; excluded")
            continue
        characteristic = "transfer_current" if ("vgs" in xq or "gate" in xq) else "output_current" if ("vds" in xq or "drain" in xq) else None
        if characteristic is None:
            continue
        try:
            identity = validate_curve_identity(curve, characteristic, "V", "A", label)
        except Unfittable as exc:
            rejected.append(f"{label}: {exc}")
            continue
        condition = identity["condition_identity"]
        electrical = condition["electrical"]
        pts = [(abs(point["x_si"]), abs(point["y_si"])) for point in identity["points"]
               if point["x_si"] != 0 and point["y_si"] != 0]
        if characteristic == "transfer_current":
            vds_shape = electrical["vds"]
            if vds_shape["kind"] != "fixed":
                rejected.append(f"{label}: transfer residual requires an exact cited VDS; ranges and relations cannot be replaced by a probe default")
                continue
            vds = abs(float(vds_shape["value_v"]))
            pts = reject_non_monotonic(pts, "increasing", label, rejected)
            if len(pts) >= 3 and (transfer is None or len(pts) > len(transfer[1])):
                transfer = (curve, pts, vds, identity)
        else:
            vgs_shape = electrical["vgs"]
            if vgs_shape["kind"] != "fixed":
                rejected.append(f"{label}: output residual requires an exact cited VGS")
                continue
            vgs = abs(float(vgs_shape["value_v"]))
            pts = reject_non_monotonic(pts, "nondecreasing", label, rejected)
            if len(pts) >= 2:
                outputs.append((curve, pts, vgs, identity))
    if transfer is None:
        raise Unfittable("no usable canonical static transfer curve with exact temperature, VDS, citation, and point identities")
    return transfer, outputs


# ------------------------------------------------------------------- ngspice benches

# ngspice defaults to reltol=1e-3. A finite-difference Jacobian taken with a 1e-4
# relative parameter step is then pure solver noise, and least_squares terminates on
# ftol after a handful of evaluations without having moved (observed: nfev=10 with a
# 40% transfer residual still on the table). Every probe therefore asks for a solution
# far tighter than the differences the optimizer needs to see.
PROBE_OPTIONS = ".options reltol=1e-6 abstol=1e-15 vntol=1e-9 itl1=500"
NOMINAL_TEMPERATURE = ".temp 25"


def diode_bench(params, currents):
    card = ".model DFIT D(IS={IS:.12e} N={N:.12g} RS={RS:.12g})".format(**params)
    lines = ["Conveyor diode DC probe", PROBE_OPTIONS, card, NOMINAL_TEMPERATURE]
    for i, current in enumerate(currents, 1):
        # The 1G bleed gives the anode a DC path so the matrix stays non-singular when
        # the fit lands on RS = 0; at 1 V it leaks 1 nA against currents of 1e-4 A and up.
        lines += [f"D{i} a{i} 0 DFIT", f"I{i} 0 a{i} DC {current:.12g}", f"RL{i} a{i} 0 1G"]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    return [float(vector(result, f"v(a{i})", f"a{i}")[0]) for i in range(1, len(currents) + 1)]


def bjt_bench(params, targets, vce, polarity):
    """targets: [(ic_target, hfe_target)]. Force IB = IC/hFE, hold VCE, measure IC.

    Extractions record p-type quantities as magnitudes, so a PNP bench must negate the
    collector supply and reverse the base drive; otherwise every device sits cut off and
    the residual saturates near 1.0 regardless of the parameters.
    """
    pnp = polarity == "p"
    kind = "PNP" if pnp else "NPN"
    card = (".model QFIT {kind}(IS={IS:.12e} BF={BF:.12g} NF=1 VAF={VAF:.12g} "
            "IKF={IKF:.12e} ISE={ISE:.12e} NE=1.5 RB={RB:.12g} RC={RC:.12g} RE={RE:.12g})"
            ).format(kind=kind, **params)
    lines = ["Conveyor BJT DC probe", PROBE_OPTIONS, card, NOMINAL_TEMPERATURE]
    supply = -vce if pnp else vce
    for i, (ic, hfe) in enumerate(targets, 1):
        ib = ic / hfe
        drive = f"IB{i} b{i} 0 DC {ib:.12e}" if pnp else f"IB{i} 0 b{i} DC {ib:.12e}"
        lines += [f"Q{i} c{i} b{i} 0 QFIT", f"VC{i} c{i} 0 DC {supply:.12g}", drive]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    return [abs(float(vector(result, f"vc{i}#branch", f"i(vc{i})")[0])) for i in range(1, len(targets) + 1)]


def vdmos_bench(dc, fixed, transfer, outputs, rdson, polarity="n"):
    """Probe each evidence row at its exact validated temperature and bias."""
    vto, kp, theta, lam, rd = dc
    p_channel = polarity == "p"
    channel = "pchan " if p_channel else ""
    emitted_vto = -abs(vto) if p_channel else abs(vto)
    card = (f".model MFIT VDMOS({channel}VTO={emitted_vto:.12g} KP={kp:.12g} THETA={theta:.12g} LAMBDA={lam:.12g} "
            f"RD={rd:.12g} RS={fixed['RS']:.12g} RG=1e-4 RDS=1e9 "
            f"CGS={fixed['CGS']:.12e} CGDMAX={fixed['CGDMAX']:.12e} CGDMIN={fixed['CGDMIN']:.12e} "
            f"CJO={fixed['CJO']:.12e} IS=1e-12 N=1.5 RB={fixed['RB']:.12g} TNOM=27)")
    values = {"transfer": [None] * len(transfer), "output": [None] * len(outputs), "rdson": [None] * len(rdson)}
    grouped = {}
    for group, rows in (("transfer", transfer), ("output", outputs), ("rdson", rdson)):
        for index, row in enumerate(rows):
            grouped.setdefault(float(row[-1]), []).append((group, index, row))
    for temperature, rows in grouped.items():
        lines = ["Conveyor VDMOS DC probe", PROBE_OPTIONS, card, f".temp {temperature:.12g}"]
        names = []
        for probe_index, (group, row_index, row) in enumerate(rows, 1):
            names.append((group, row_index, probe_index, row))
            sign = -1 if p_channel else 1
            if group == "transfer":
                vgs, vds, _, _ = row
                lines += [f"MT{probe_index} d{probe_index} g{probe_index} 0 MFIT",
                          f"VD{probe_index} d{probe_index} 0 DC {sign * vds:.12g}",
                          f"VG{probe_index} g{probe_index} 0 DC {sign * vgs:.12g}"]
            elif group == "output":
                vgs, vds, _, _ = row
                lines += [f"MO{probe_index} d{probe_index} g{probe_index} 0 MFIT",
                          f"VD{probe_index} d{probe_index} 0 DC {sign * vds:.12g}",
                          f"VG{probe_index} g{probe_index} 0 DC {sign * vgs:.12g}"]
            else:
                vgs, current, _, _, _, _ = row
                current_drive = f"ID{probe_index} d{probe_index} 0 DC {current:.12g}" if p_channel else f"ID{probe_index} 0 d{probe_index} DC {current:.12g}"
                lines += [f"MR{probe_index} d{probe_index} g{probe_index} 0 MFIT",
                          current_drive,
                          f"VG{probe_index} g{probe_index} 0 DC {sign * vgs:.12g}"]
        lines += [".op", ".end"]
        result = run_ngspice("\n".join(lines) + "\n")
        for group, row_index, probe_index, row in names:
            if group in {"transfer", "output"}:
                value = abs(float(vector(result, f"vd{probe_index}#branch", f"i(vd{probe_index})")[0]))
            else:
                value = abs(float(vector(result, f"v(d{probe_index})", f"d{probe_index}")[0])) / row[1]
            values[group][row_index] = value
    return values["transfer"], values["output"], values["rdson"]


# ------------------------------------------------------------------------ gate logic


def bound_saturated(value, lower, upper):
    tol = GATES["parameter_physicality"]["bound_saturation_tolerance"]
    span = max(abs(upper - lower), 1e-30)
    return (value - lower) / span < tol or (upper - value) / span < tol


RELATIVE_ERROR_FLOOR = 1e-12


def relative_error(actual, target, maximum=False):
    denominator = max(abs(float(target)), RELATIVE_ERROR_FLOOR)
    difference = max(float(actual) - float(target), 0.0) if maximum else abs(float(actual) - float(target))
    return difference / denominator


def apply_gate(family, residuals, parameter_notes):
    """Return (passed, reason). Residual rows carry a 'gate_quantity' key."""
    limits = GATES["families"][family]["quantities"]
    worst_row = max(residuals, key=lambda row: row["relative_error"])
    failures = list(parameter_notes)
    for key, limit in limits.items():
        rows = [row for row in residuals if row["gate_quantity"] == key]
        if not rows:
            continue
        worst = max(row["relative_error"] for row in rows)
        rms = math.sqrt(sum(row["relative_error"] ** 2 for row in rows) / len(rows))
        if worst > limit["worst"]:
            failures.append(f"{key} worst relative error {worst:.4f} exceeds gate {limit['worst']}")
        if rms > limit["rms"]:
            failures.append(f"{key} RMS relative error {rms:.4f} exceeds gate {limit['rms']}")
    return (not failures), ("; ".join(failures) if failures else None), worst_row


# --------------------------------------------------------------------------- fitters


def fit_diode(payload, rejected):
    extraction = payload["extraction"]
    curve, pts = select_forward_iv(extraction, rejected)
    used = [f"{curve.get('name')} ({curve.get('page_reference')})"]
    V = np.array([v for v, _ in pts])
    I = np.array([i for _, i in pts])

    bounds = GATES["families"]["diode"]["parameters"]
    lo = np.array([math.log(bounds["IS"]["minimum"]), bounds["N"]["minimum"], bounds["RS"]["minimum"]])
    hi = np.array([math.log(bounds["IS"]["maximum"]), bounds["N"]["maximum"], bounds["RS"]["maximum"]])

    def model(p):
        return p[1] * VT * np.log1p(I / math.exp(p[0])) + I * p[2]

    def residual(p):
        return (model(p) - V) / np.maximum(V, 0.1)

    x0 = np.clip(np.array([math.log(1e-12), 1.8, 0.5]), lo, hi)
    fit = least_squares(residual, x0=x0, bounds=(lo, hi), method="trf", x_scale="jac",
                        ftol=1e-14, xtol=1e-14, gtol=1e-14, max_nfev=100000)
    # ngspice gives a diode with RS > 0 an internal series node whose conductance is
    # 1/RS. A fitted RS of 1e-25 ohm therefore stamps ~1e25 S into the matrix and the
    # operating point goes singular. Sub-micro-ohm bulk resistance is unmeasurable
    # anyway, so snap it to the exact zero that ngspice handles by omitting the node.
    rs = float(fit.x[2])
    params = {"IS": math.exp(float(fit.x[0])), "N": float(fit.x[1]), "RS": 0.0 if rs < 1e-6 else rs}

    notes = []
    held = []
    for index, name in enumerate(["IS", "N", "RS"]):
        value = float(fit.x[index])
        if not bound_saturated(value, lo[index], hi[index]):
            continue
        at_lower = (value - lo[index]) < (hi[index] - value)
        if name == "RS" and at_lower:
            # Zero series resistance is the physically meaningful "the digitised range
            # never reaches the resistive knee" answer, not an optimiser artefact. A
            # fit pinned at the RS *ceiling* still means the true optimum is unphysical.
            held.append({"parameter": "RS", "value": params["RS"],
                         "reason": "no series resistance is resolvable from the digitised forward range"})
        else:
            notes.append(f"{name} saturated its physical bound at {params[name]:.6g}; "
                         f"the true optimum lies outside the physical range, so the residual is a constraint artefact")

    measured = diode_bench(params, list(I))
    residuals = [{
        "quantity": f"forward voltage at {current:.6g} A",
        "gate_quantity": "forward_voltage",
        "datasheet_value": float(target), "fitted_value": float(actual), "unit": "V",
        "relative_error": relative_error(actual, target),
        "citation": curve.get("page_reference") or "pending review",
    } for current, target, actual in zip(I, V, measured)]
    return params, residuals, used, notes, {"optimizer_nfev": int(fit.nfev), "optimizer_status": int(fit.status),
                                            "held_defaults": held}


def select_vbe_on(extraction):
    """The nominal-temperature base-emitter turn-on curve used to pin IS. Optional."""
    candidates = []
    for curve in extraction.get("curves") or []:
        xq, _, _ = axis(curve, "x")
        yq, _, _ = axis(curve, "y")
        if "collector current" not in xq or "base-emitter" not in yq:
            continue
        if "satur" in yq:
            continue
        temperature = temperature_of(curve)
        if temperature is not None and abs(temperature - 25) > 5:
            continue
        try:
            pts = sorted((abs(ic), abs(v)) for ic, v in points_of(curve, "A", "V") if ic != 0 and v != 0)
        except Unfittable:
            continue
        if len(pts) >= 3:
            candidates.append((0 if temperature is not None else 1, -len(pts), curve, pts))
    if candidates:
        _, _, curve, pts = min(candidates, key=lambda item: item[:2])
        return curve, pts
    return None, []


def fit_bjt(payload, rejected):
    extraction = payload["extraction"]
    curve, vce, pts = select_gain_curve(extraction, rejected)
    used = [f"{curve.get('name')} ({curve.get('page_reference')})"]
    polarity = payload.get("polarity", "n")
    ic = np.array([p[0] for p in pts])
    hfe = np.array([p[1] for p in pts])
    peak = float(hfe.max())
    targets = list(zip(ic.tolist(), hfe.tolist()))

    held = []
    # IS is not identifiable from hFE at forced base current: at fixed IB the collector
    # current is set by the current gain, not by the saturation current. Pin it from a
    # cited VBE(on) point where one exists, otherwise hold a physical default, and
    # declare it either way rather than handing it to the optimizer to park on a bound.
    vbe_curve, vbe_pts = select_vbe_on(extraction)
    if vbe_pts:
        mid_ic, mid_vbe = vbe_pts[len(vbe_pts) // 2]
        is_value = min(max(mid_ic / math.exp(mid_vbe / VT), 1e-18), 1e-10)
        held.append({"parameter": "IS", "value": is_value,
                     "reason": f"derived from the cited VBE(on) curve at IC = {mid_ic:.4g} A, "
                               f"VBE = {mid_vbe:.4g} V; hFE at forced base current does not constrain IS"})
        used.append(f"{vbe_curve.get('name')} ({vbe_curve.get('page_reference')})")
    else:
        is_value = 1e-14
        held.append({"parameter": "IS", "value": is_value,
                     "reason": "held physical default; the source supplies no VBE(on) curve and hFE at "
                               "forced base current does not constrain IS"})

    fixed = {"IS": is_value, "VAF": 100.0, "RB": 10.0, "RC": 0.1, "RE": 0.05}
    # BF sets the plateau, ISE the low-current roll-off, IKF the high-injection roll-off.
    ranges = {
        "BF": (math.log(peak * 0.9), math.log(peak * 6)),
        "ISE": (math.log(1e-18), math.log(1e-9)),
        # The high-injection knee must sit above the low-current end of the digitised
        # range but may fall well below its top: a small-signal BJT whose hFE peaks a
        # decade below the highest plotted IC has an IKF near that peak, not near IC(max).
        "IKF": (math.log(max(float(ic.min()), float(ic.max()) * 0.005)), math.log(ic.max() * 500)),
    }
    seeds = {"BF": math.log(peak * 1.1), "ISE": math.log(1e-13), "IKF": math.log(ic.max() * 3)}
    # A roll-off term the digitised range never exercises is disabled, not optimised.
    inactive = {"ISE": (0.0, "lower", "no low-current roll-off is resolvable within the digitised range"),
                "IKF": (1e3, "upper", "no high-injection roll-off is resolvable within the digitised range")}
    active = ["BF", "ISE", "IKF"]
    disabled = {}
    notes = []

    def build(values):
        params = dict(fixed)
        for name in ["BF", "ISE", "IKF"]:
            params[name] = disabled[name] if name in disabled else math.exp(values[active.index(name)])
        return params

    for _ in range(3):
        lo = np.array([ranges[name][0] for name in active])
        hi = np.array([ranges[name][1] for name in active])
        x0 = np.clip(np.array([seeds[name] for name in active]), lo, hi)

        def residual(p, _active=tuple(active)):
            try:
                measured = bjt_bench(build(p), targets, vce, polarity)
            except Exception:
                return np.full(len(targets), 1e3)
            return np.array([math.log(max(a, 1e-15)) - math.log(t) for (t, _), a in zip(targets, measured)])

        fit = least_squares(residual, x0=x0, bounds=(lo, hi), method="trf", x_scale="jac",
                            diff_step=1e-3, ftol=1e-10, xtol=1e-10, max_nfev=400)
        retire = None
        for index, name in enumerate(active):
            if name == "BF" or not bound_saturated(float(fit.x[index]), lo[index], hi[index]):
                continue
            value, edge, why = inactive[name]
            at_lower = (float(fit.x[index]) - lo[index]) < (hi[index] - float(fit.x[index]))
            if (edge == "lower") == at_lower:
                retire = name
                disabled[name] = value
                held.append({"parameter": name, "value": value, "reason": why})
                break
        if retire is None:
            break
        active = [name for name in active if name != retire]

    params = build(fit.x)
    for index, name in enumerate(active):
        lo_v, hi_v = ranges[name]
        if bound_saturated(float(fit.x[index]), lo_v, hi_v):
            notes.append(f"{name} saturated its bound at {params[name]:.6g}; the residual is a constraint artefact")

    measured = bjt_bench(params, targets, vce, polarity)
    residuals = [{
        "quantity": f"collector current at IB for hFE {h:.6g} and IC {t:.6g} A",
        "gate_quantity": "dc_current_gain",
        "datasheet_value": float(t), "fitted_value": float(a), "unit": "A",
        "relative_error": relative_error(a, t),
        "citation": curve.get("page_reference") or "pending review",
    } for (t, h), a in zip(targets, measured)]
    return params, residuals, used, notes, {"optimizer_nfev": int(fit.nfev), "optimizer_status": int(fit.status),
                                            "vce": vce, "held_defaults": held}


def fit_mosfet(payload, rejected):
    if payload.get("evidence_contract_version") != IDENTITY_VERSION:
        raise Unfittable(f"MOSFET fit requires evidence_contract_version {IDENTITY_VERSION}")
    extraction = payload["extraction"]
    specs = extraction.get("specs") or {}
    (tcurve, tpts, tvds, transfer_identity), outputs = select_mosfet_curves(extraction, rejected)
    used = [f"{tcurve.get('name')} ({real_citation(transfer_identity['citation_identity'])})"]
    transfer_temperature = transfer_identity["condition_identity"]["temperature"]["value_c"]
    transfer = [(vgs, tvds, current, transfer_temperature) for vgs, current in tpts]
    out_points = []
    output_provenance = []
    for curve, pts, vgs, identity in outputs:
        used.append(f"{curve.get('name')} ({real_citation(identity['citation_identity'])})")
        temperature = identity["condition_identity"]["temperature"]["value_c"]
        for point, (vds, current) in zip(curve["points"], pts):
            out_points.append((vgs, vds, current, temperature))
            output_provenance.append({"condition_identity": identity["condition_identity"],
                                      "citation_identity": identity["citation_identity"],
                                      "evidence_identity": point["evidence_identity"],
                                      "curve_id": identity["curve_id"]})

    threshold = {}
    for key, quantity, role in (("threshold_min", "threshold_minimum", "minimum"),
                                ("threshold_typ", "threshold_typical", "typical"),
                                ("threshold_max", "threshold_maximum", "maximum")):
        raw = specs.get(key)
        if raw is None:
            continue
        threshold[key] = validate_evidence_bundle(raw, "gate_threshold", quantity, "V", {role}, key, dc_only=True)
    if threshold:
        identities_equal(list(threshold.values()), "published threshold cohort")
    rdson = []
    for index, point in enumerate(specs.get("rdson_points") or []):
        label = f"rdson_points[{index}]"
        if not isinstance(point, dict):
            raise Unfittable(f"{label} must be an object")
        raw_resistance = point.get("resistance") or {}
        raw_resistance_identity = raw_resistance.get("evidence_identity") or {}
        resistance_role = raw_resistance_identity.get("role")
        if resistance_role not in {"typical", "maximum"}:
            raise Unfittable(f"{label}.resistance has unknown residual qualifier {resistance_role!r}")
        components = [
            validate_evidence_bundle(point.get("vgs"), "rds_on", "vgs", "V", {resistance_role}, f"{label}.vgs", dc_only=True),
            validate_evidence_bundle(point.get("current"), "rds_on", "drain_current", "A", {resistance_role}, f"{label}.current", dc_only=True),
            validate_evidence_bundle(raw_resistance, "rds_on", f"rds_on_{resistance_role}", "ohm", {resistance_role}, f"{label}.resistance", dc_only=True),
        ]
        identities_equal(components, label)
        roles = {component["evidence_identity"]["role"] for component in components}
        if len(roles) != 1 or next(iter(roles)) not in ALLOWED_RESIDUAL_QUALIFIERS:
            raise Unfittable(f"{label} has hybrid or unknown residual qualifiers")
        role = next(iter(roles))
        condition = components[0]["condition_identity"]
        electrical = condition["electrical"]
        if electrical["vgs"]["kind"] != "fixed" or electrical["id"]["kind"] != "fixed":
            raise Unfittable(f"{label} condition identity requires exact VGS and ID")
        vgs, current, resistance = (abs(component["value"]) for component in components)
        if abs(vgs - abs(electrical["vgs"]["value_v"])) > max(1e-15, vgs * 1e-12) \
                or abs(current - abs(electrical["id"]["value_a"])) > max(1e-15, current * 1e-12):
            raise Unfittable(f"{label} values do not match its condition identity")
        rdson.append((vgs, current, resistance, role, components,
                      condition["temperature"]["value_c"]))

    total = len(transfer) + len(out_points)
    if total < GATES["families"]["mosfet"]["minimum_points"]:
        raise Unfittable(f"only {total} usable transfer/output points after validation; "
                         f"{GATES['families']['mosfet']['minimum_points']} required")

    vth_min = abs(threshold["threshold_min"]["value"]) if "threshold_min" in threshold else None
    vth_typ = abs(threshold["threshold_typ"]["value"]) if "threshold_typ" in threshold else None
    vth_max = abs(threshold["threshold_max"]["value"]) if "threshold_max" in threshold else None
    independently_complete_thresholds = [value for value in (vth_typ, vth_max, vth_min) if value is not None and value > 0]
    if not independently_complete_thresholds:
        raise Unfittable("no independently complete validated threshold identity for VTO seed and bounds")
    seed_vth = vth_typ if vth_typ is not None else vth_max if vth_max is not None else vth_min
    lo_vth = vth_min if vth_min is not None else 0.3 * seed_vth
    hi_vth = vth_max if vth_max is not None else 3.0 * seed_vth
    if not (lo_vth < hi_vth):
        raise Unfittable(f"published threshold interval is degenerate or reversed: {lo_vth} to {hi_vth} V")

    typical_rdson = [row for row in rdson if row[3] == "typical"]
    maximum_rdson = [row for row in rdson if row[3] == "maximum"]
    if typical_rdson:
        rd_seed = max(typical_rdson[0][2], 1e-4)
        rd_seed_provenance = typical_rdson[0][4][2]
    elif maximum_rdson:
        rd_seed = max(min(row[2] for row in maximum_rdson), 1e-4)
        rd_seed_provenance = min(maximum_rdson, key=lambda row: row[2])[4][2]
    else:
        raise Unfittable("no complete exact RDS(on) identity for a resistance seed or constraint")

    held = []
    def optional_capacitance(name):
        raw = specs.get(name)
        if raw is None:
            return None
        value = raw.get("value") if isinstance(raw, dict) else None
        unit = raw.get("unit") if isinstance(raw, dict) else None
        if not isinstance(value, (int, float)) or not math.isfinite(float(value)) or float(value) <= 0 or unit != "F":
            raise Unfittable(f"published {name} is incomplete; a critical published point cannot be silently dropped")
        return float(value)

    ciss, coss, crss = (optional_capacitance(name) for name in ("ciss", "coss", "crss"))
    if crss is None:
        crss = 5e-11
        held.append({"parameter": "CGDMAX/CGDMIN", "value": crss, "unit": "F",
                     "reason": "explicit non-critical physical default; no published Crss supplied"})
    if ciss is None:
        ciss = 1e-9
        held.append({"parameter": "CISS", "value": ciss, "unit": "F",
                     "reason": "explicit non-critical physical default; no published Ciss supplied"})
    if coss is None:
        coss = 2e-10
        held.append({"parameter": "COSS", "value": coss, "unit": "F",
                     "reason": "explicit non-critical physical default; no published Coss supplied"})
    fixed = {"RS": max(0.20 * rd_seed, 1e-5), "RB": max(0.2 * rd_seed, 1e-4),
             "CGS": max(ciss - crss, 1e-15), "CGDMAX": max(crss, 1e-15),
             "CGDMIN": max(crss, 1e-15), "CJO": max(coss - crss, 1e-15)}

    hi_pt = max(transfer, key=lambda row: row[0])
    kp0 = 2 * hi_pt[2] / max((hi_pt[0] - min(seed_vth, 0.9 * hi_pt[0])) ** 2, 1e-9)
    lo = np.array([lo_vth, 1e-3, 0.0, 0.0, 1e-6])
    hi = np.array([hi_vth, 1e3, 1.0, 0.2, max(3.0 * rd_seed, 1e-3)])
    x0 = np.clip(np.array([seed_vth, kp0, 0.05, 0.003, 0.55 * rd_seed]), lo, hi)

    def residual(p):
        try:
            t, o, d = vdmos_bench(p, fixed, transfer, out_points, rdson, payload.get("polarity", "n"))
        except Exception:
            return np.full(len(transfer) + len(out_points) + len(rdson), 1e3)
        rows = []
        for (_, _, target, _), actual in zip(transfer, t):
            rows.append(math.log(max(actual, 1e-12)) - math.log(target))
        for (_, _, target, _), actual in zip(out_points, o):
            rows.append(math.log(max(actual, 1e-12)) - math.log(target))
        for (_, _, target, kind, _, _), actual in zip(rdson, d):
            norm = (actual - target) / target
            # A typical-curve fit may legitimately sit below a MAXIMUM spec.
            rows.append(20.0 * max(norm, 0.0) + 0.05 * min(norm, 0.0) if kind == "maximum" else norm)
        return np.asarray(rows)

    fit = least_squares(residual, x0=x0, bounds=(lo, hi), method="trf", x_scale="jac",
                        diff_step=1e-3, ftol=1e-12, xtol=1e-12, max_nfev=3000)
    vto, kp, theta, lam, rd = [float(v) for v in fit.x]
    params = {"VTO": vto, "KP": kp, "THETA": theta, "LAMBDA": lam, "RD": rd,
              "RS": fixed["RS"], "RG": 1e-4, "CGS": fixed["CGS"], "CGDMAX": fixed["CGDMAX"],
              "CGDMIN": fixed["CGDMIN"], "CJO": fixed["CJO"], "IS": 1e-12, "N": 1.5, "RB": fixed["RB"]}

    held.extend([
        {"parameter": "RG", "value": 1e-4, "unit": "ohm", "reason": "explicit non-critical gate resistance default"},
        {"parameter": "IS", "value": 1e-12, "unit": "A", "reason": "explicit non-critical body-diode saturation-current default for DC channel fitting"},
        {"parameter": "N", "value": 1.5, "unit": "1", "reason": "explicit non-critical body-diode emission-coefficient default for DC channel fitting"},
    ])
    notes = []
    # THETA and LAMBDA describe second-order effects. Their lower bound is zero, which is
    # the physically meaningful "effect not resolvable from these curves" value, so
    # resting there is a held default to declare, not an optimiser artefact. Resting on an
    # UPPER bound still means the true optimum is outside the physical range.
    floor_is_held = {
        "THETA": ("1", "no mobility degradation is resolvable from the digitised transfer range"),
        "LAMBDA": ("1/V", "no channel-length modulation is resolvable from the digitised output range"),
        "RD": ("ohm", "no drain resistance separable from the source resistance at these bias points"),
    }
    for index, name in enumerate(["VTO", "KP", "THETA", "LAMBDA", "RD"]):
        # VTO resting on a published threshold min/max is the archetype's intent, not saturation.
        if name == "VTO":
            continue
        value = float(fit.x[index])
        if not bound_saturated(value, lo[index], hi[index]):
            continue
        at_lower = (value - lo[index]) < (hi[index] - value)
        if at_lower and name in floor_is_held:
            unit, reason = floor_is_held[name]
            held.append({"parameter": name, "value": value, "unit": unit, "reason": reason})
        else:
            notes.append(f"{name} saturated its bound at {value:.6g}; the residual is a constraint artefact")

    t, o, d = vdmos_bench(fit.x, fixed, transfer, out_points, rdson, payload.get("polarity", "n"))
    residuals = []
    transfer_citation = transfer_identity["citation_identity"]
    for point, (vgs, vds, target, temperature), actual in zip(tcurve["points"], transfer, t):
        residuals.append({"quantity": f"transfer current at VGS {vgs:.6g} V", "gate_quantity": "drain_current",
                          "datasheet_value": target, "fitted_value": actual, "unit": "A",
                          "relative_error": relative_error(actual, target),
                          "citation": real_citation(transfer_citation), "condition_identity": transfer_identity["condition_identity"],
                          "citation_identity": transfer_citation, "evidence_identity": point["evidence_identity"],
                          "curve_id": transfer_identity["curve_id"], "temperature_c": temperature,
                          "evidence_role": "typical_observation"})
    for (vgs, vds, target, temperature), actual, provenance in zip(out_points, o, output_provenance):
        residuals.append({"quantity": f"output current at VGS {vgs:.6g} V, VDS {vds:.6g} V", "gate_quantity": "drain_current",
                          "datasheet_value": target, "fitted_value": actual, "unit": "A",
                          "relative_error": relative_error(actual, target),
                          "citation": real_citation(provenance["citation_identity"]), **provenance,
                          "temperature_c": temperature, "evidence_role": "typical_observation"})
    for (vgs, current, target, kind, components, temperature), actual in zip(rdson, d):
        error = relative_error(actual, target, maximum=kind == "maximum")
        resistance_evidence = components[2]
        residuals.append({"quantity": f"RDS(on) at VGS {vgs:.6g} V", "gate_quantity": "rds_on",
                          "datasheet_value": target, "fitted_value": actual, "unit": "ohm",
                          "relative_error": error, "citation": real_citation(resistance_evidence["citation_identity"]),
                          "condition_identity": resistance_evidence["condition_identity"],
                          "citation_identity": resistance_evidence["citation_identity"],
                          "evidence_identity": resistance_evidence["evidence_identity"],
                          "evidence": [{"quantity": quantity, "value_si": component["value"], "unit_si": component["unit"],
                                        "condition_identity": component["condition_identity"], "citation_identity": component["citation_identity"],
                                        "evidence_identity": component["evidence_identity"]}
                                       for quantity, component in zip(("vgs", "drain_current", f"rds_on_{kind}"), components)],
                          "component_evidence": [component["evidence_identity"] for component in components],
                          "temperature_c": temperature,
                          "evidence_role": "inequality_constraint" if kind == "maximum" else "typical_observation",
                          **({"maximum": target, "inclusive": True} if kind == "maximum" else {})})
    threshold_provenance = [{"quantity": key, **row} for key, row in threshold.items()]
    seed_provenance = {
        "VTO": next((row for key, row in threshold.items() if abs(row["value"]) == seed_vth), None),
        "rdson": rd_seed_provenance,
    }
    return params, residuals, used, notes, {"optimizer_nfev": int(fit.nfev), "optimizer_status": int(fit.status),
                                            "held_defaults": held, "threshold_evidence": threshold_provenance,
                                            "seed_provenance": seed_provenance}


FITTERS = {"diode": fit_diode, "bjt": fit_bjt, "mosfet": fit_mosfet}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("payload")
    parser.add_argument("output")
    args = parser.parse_args()
    payload = json.loads(Path(args.payload).read_text())
    family = payload["family"]
    rejected = []

    result = {"schema_version": "1.0.0", "family": family, "curves_rejected": rejected,
              "gate_calibration": GATES["schema_version"]}
    try:
        if family not in FITTERS:
            raise Unfittable(f"unsupported conveyor family {family!r}")
        extraction = payload.get("extraction")
        if not extraction or not extraction.get("usable_curves"):
            raise Unfittable(extraction.get("omission_reason") if extraction else "no extraction available")
        params, residuals, used, notes, meta = FITTERS[family](payload, rejected)
        passed, reason, worst_row = apply_gate(family, residuals, notes)
        rms = math.sqrt(sum(r["relative_error"] ** 2 for r in residuals) / len(residuals))
        result.update({
            "fidelity": "F2" if passed else "F1",
            **({"evidence_contract_version": IDENTITY_VERSION} if family == "mosfet" else {}),
            "parameters": params, "residuals": residuals, "curves_used": used,
            "worst": {"value": worst_row["relative_error"], "quantity": worst_row["quantity"]},
            "rms": rms, "gate_pass": passed,
            "fitter": "scipy.optimize.least_squares with native ngspice-46 evaluations",
            "optimizer": meta,
            "demotion_reason": None if passed else f"{family} F2 gate failed: {reason}",
        })
    except Unfittable as exc:
        result.update({"fidelity": "F1", "parameters": None, "residuals": [], "curves_used": [],
                       "worst": None, "rms": None,
                       "demotion_reason": f"{family} extraction cannot support an F2 fit: {exc}"})
    except Exception as exc:  # noqa: BLE001 - report, never crash the tranche
        result.update({"fidelity": "F1", "parameters": None, "residuals": [], "curves_used": [],
                       "worst": None, "rms": None,
                       "demotion_reason": f"{family} F2 fit failed: {type(exc).__name__}: {exc}"})
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
