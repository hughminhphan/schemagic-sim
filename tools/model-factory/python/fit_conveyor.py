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
    m = re.search(r"(?:t[ajc]?\s*(?:amb|j|a|c)?\s*[= ]\s*)(-?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c|c\b)", text)
    if m:
        return float(m.group(1))
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c)", text)
    return float(m.group(1)) if m else None


def bias_of(curve, symbol):
    """A stated bias such as VGS or VCE, in volts, or None."""
    text = context(curve)
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
    """Transfer curve plus per-VGS output curves, with non-physical traces excluded."""
    transfer = None
    outputs = []
    for curve in extraction.get("curves") or []:
        xq, _, _ = axis(curve, "x")
        yq, _, _ = axis(curve, "y")
        label = curve.get("name") or "unnamed curve"
        # Extractions name this ordinate "drain current", "ID", or "ID magnitude"; match
        # the quantity, not one spelling of it.
        is_drain_current = ("current" in yq or "drain" in yq or re.search(r"\bid\b", yq))
        if not is_drain_current or "capacit" in yq or "resist" in yq or "normal" in yq or "gate" in yq:
            continue
        # The body/source-drain diode conducts through the parasitic junction, not the
        # channel, and its figures are often labelled with a VGS of 0 V. Fitting one as an
        # output curve asks the channel model to carry diode current at zero gate drive,
        # which pins the residual at 1.0 (observed on DMP3098L-7).
        blob = f"{xq} {yq} {context(curve)}"
        if "body" in blob or "source-drain" in blob or "source drain" in blob or "diode" in blob:
            rejected.append(f"{label}: body/source-drain diode characteristic, not a channel output curve; excluded")
            continue
        temp = temperature_of(curve)
        if temp is not None and abs(temp - 25) > 10:
            continue
        try:
            pts = points_of(curve, "V", "A")
        except Unfittable as exc:
            rejected.append(f"{label}: {exc}")
            continue

        if "vgs" in xq or "gate" in xq:
            pts = [(v, i) for v, i in pts if v > 0 and i > 0]
            pts = reject_non_monotonic(pts, "increasing", label, rejected)
            if len(pts) >= 3 and (transfer is None or len(pts) > len(transfer[1])):
                vds = bias_of(curve, "vds") or 10.0
                transfer = (curve, pts, vds)
        elif "vds" in xq or "drain" in xq:
            vgs = bias_of(curve, "vgs")
            if vgs is None:
                continue
            pts = [(v, i) for v, i in pts if v > 0 and i > 0]
            pts = reject_non_monotonic(pts, "nondecreasing", label, rejected)
            if len(pts) >= 2:
                outputs.append((curve, pts, vgs))
    if transfer is None:
        raise Unfittable("no usable 25 degC transfer curve (drain current versus gate-source voltage)")
    return transfer, outputs


# ------------------------------------------------------------------- ngspice benches

# ngspice defaults to reltol=1e-3. A finite-difference Jacobian taken with a 1e-4
# relative parameter step is then pure solver noise, and least_squares terminates on
# ftol after a handful of evaluations without having moved (observed: nfev=10 with a
# 40% transfer residual still on the table). Every probe therefore asks for a solution
# far tighter than the differences the optimizer needs to see.
PROBE_OPTIONS = ".options reltol=1e-6 abstol=1e-15 vntol=1e-9 itl1=500"


def diode_bench(params, currents):
    card = ".model DFIT D(IS={IS:.12e} N={N:.12g} RS={RS:.12g})".format(**params)
    lines = ["Conveyor diode DC probe", PROBE_OPTIONS, card]
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
    lines = ["Conveyor BJT DC probe", PROBE_OPTIONS, card]
    supply = -vce if pnp else vce
    for i, (ic, hfe) in enumerate(targets, 1):
        ib = ic / hfe
        drive = f"IB{i} b{i} 0 DC {ib:.12e}" if pnp else f"IB{i} 0 b{i} DC {ib:.12e}"
        lines += [f"Q{i} c{i} b{i} 0 QFIT", f"VC{i} c{i} 0 DC {supply:.12g}", drive]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    return [abs(float(vector(result, f"vc{i}#branch", f"i(vc{i})")[0])) for i in range(1, len(targets) + 1)]


def vdmos_bench(dc, fixed, transfer, outputs, rdson):
    vto, kp, theta, lam, rd = dc
    card = (f".model MFIT VDMOS(VTO={vto:.12g} KP={kp:.12g} THETA={theta:.12g} LAMBDA={lam:.12g} "
            f"RD={rd:.12g} RS={fixed['RS']:.12g} RG=1e-4 RDS=1e9 "
            f"CGS={fixed['CGS']:.12e} CGDMAX={fixed['CGDMAX']:.12e} CGDMIN={fixed['CGDMIN']:.12e} "
            f"CJO={fixed['CJO']:.12e} IS=1e-12 N=1.5 RB={fixed['RB']:.12g} TNOM=27)")
    lines = ["Conveyor VDMOS DC probe", PROBE_OPTIONS, card]
    n = 0
    for vgs, vds, _ in transfer:
        n += 1
        lines += [f"MT{n} dt{n} gt{n} 0 MFIT", f"VDT{n} dt{n} 0 DC {vds:.12g}", f"VGT{n} gt{n} 0 DC {vgs:.12g}"]
    m = 0
    for vgs, vds, _ in outputs:
        m += 1
        lines += [f"MO{m} do{m} go{m} 0 MFIT", f"VDO{m} do{m} 0 DC {vds:.12g}", f"VGO{m} go{m} 0 DC {vgs:.12g}"]
    r = 0
    for vgs, current, _, _ in rdson:
        r += 1
        lines += [f"MR{r} dr{r} gr{r} 0 MFIT", f"IDR{r} 0 dr{r} DC {current:.12g}", f"VGR{r} gr{r} 0 DC {vgs:.12g}"]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    t = [abs(float(vector(result, f"vdt{i}#branch", f"i(vdt{i})")[0])) for i in range(1, n + 1)]
    o = [abs(float(vector(result, f"vdo{i}#branch", f"i(vdo{i})")[0])) for i in range(1, m + 1)]
    d = [float(vector(result, f"v(dr{i})", f"dr{i}")[0]) / rdson[i - 1][1] for i in range(1, r + 1)]
    return t, o, d


# ------------------------------------------------------------------------ gate logic


def bound_saturated(value, lower, upper):
    tol = GATES["parameter_physicality"]["bound_saturation_tolerance"]
    span = max(abs(upper - lower), 1e-30)
    return (value - lower) / span < tol or (upper - value) / span < tol


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
        "relative_error": abs(actual - target) / abs(target),
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
        "relative_error": abs(a - t) / abs(t),
        "citation": curve.get("page_reference") or "pending review",
    } for (t, h), a in zip(targets, measured)]
    return params, residuals, used, notes, {"optimizer_nfev": int(fit.nfev), "optimizer_status": int(fit.status),
                                            "vce": vce, "held_defaults": held}


def fit_mosfet(payload, rejected):
    extraction = payload["extraction"]
    specs = extraction.get("specs") or {}
    (tcurve, tpts, tvds), outputs = select_mosfet_curves(extraction, rejected)
    used = [f"{tcurve.get('name')} ({tcurve.get('page_reference')})"]

    transfer = [(vgs, tvds, current) for vgs, current in tpts]
    out_points = []
    for curve, pts, vgs in outputs:
        used.append(f"{curve.get('name')} ({curve.get('page_reference')})")
        for vds, current in pts:
            out_points.append((vgs, vds, current))

    rdson = []
    for point in specs.get("rdson_points") or []:
        resistance = ((point or {}).get("resistance") or {}).get("value")
        vgs = ((point or {}).get("vgs") or {}).get("value")
        current = ((point or {}).get("current") or {}).get("value")
        if resistance and vgs and current:
            rdson.append((abs(float(vgs)), abs(float(current)), float(resistance),
                          ((point or {}).get("resistance") or {}).get("source_kind")))

    total = len(transfer) + len(out_points)
    if total < GATES["families"]["mosfet"]["minimum_points"]:
        raise Unfittable(f"only {total} usable transfer/output points after validation; "
                         f"{GATES['families']['mosfet']['minimum_points']} required")

    def q(name):
        value = (specs.get(name) or {}).get("value")
        return abs(float(value)) if isinstance(value, (int, float)) else None

    vth_min, vth_typ, vth_max = q("threshold_min"), q("threshold_typ"), q("threshold_max")
    seed_vth = vth_typ or vth_max or vth_min or 2.0
    lo_vth = vth_min if vth_min else 0.3 * seed_vth
    # A datasheet VGS(th) is measured at a small drain current (250 uA is typical). The
    # VDMOS VTO is instead the threshold obtained by extrapolating the strong-inversion
    # square law back to zero current, and that extrapolated value is systematically
    # HIGHER than the measured VGS(th) because it ignores the sub- and moderate-inversion
    # conduction that the measurement point sits in. Box-constraining VTO to the published
    # VGS(th) band therefore constrains the wrong quantity: for 2N7002,215 the digitised
    # transfer curve wants VTO = 2.65 V against a published maximum of 2.50 V, and forcing
    # 2.50 V inflates the worst transfer residual from 6% to 36%. Allow a bounded
    # extrapolation margin above the published maximum and declare it whenever it is used.
    vth_extrapolation_margin = min(0.5, 0.3 * (vth_max or seed_vth))
    hi_vth = (vth_max + vth_extrapolation_margin) if vth_max else 3.0 * seed_vth
    if not (lo_vth < hi_vth):
        lo_vth, hi_vth = 0.3 * seed_vth, 3.0 * seed_vth

    rd_seed = max(rdson[0][2] if rdson else 0.1, 1e-4)
    ciss, coss, crss = q("ciss") or 1e-9, q("coss") or 2e-10, q("crss") or 5e-11
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
            t, o, d = vdmos_bench(p, fixed, transfer, out_points, rdson)
        except Exception:
            return np.full(len(transfer) + len(out_points) + len(rdson), 1e3)
        rows = []
        for (_, _, target), actual in zip(transfer, t):
            rows.append(math.log(max(actual, 1e-12)) - math.log(target))
        for (_, _, target), actual in zip(out_points, o):
            rows.append(math.log(max(actual, 1e-12)) - math.log(target))
        for (_, _, target, kind), actual in zip(rdson, d):
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

    notes = []
    held = []
    # THETA and LAMBDA describe second-order effects. Their lower bound is zero, which is
    # the physically meaningful "effect not resolvable from these curves" value, so
    # resting there is a held default to declare, not an optimiser artefact. Resting on an
    # UPPER bound still means the true optimum is outside the physical range.
    floor_is_held = {
        "THETA": "no mobility degradation is resolvable from the digitised transfer range",
        "LAMBDA": "no channel-length modulation is resolvable from the digitised output range",
        "RD": "no drain resistance separable from the source resistance at these bias points",
    }
    if vth_max and vto > vth_max:
        held.append({"parameter": "VTO", "value": vto,
                     "reason": f"strong-inversion extrapolated threshold sits {vto - vth_max:.3g} V above the "
                               f"published VGS(th) maximum of {vth_max:.3g} V, within the "
                               f"{vth_extrapolation_margin:.3g} V extrapolation margin; VGS(th) is measured at a "
                               f"small drain current and is not the square-law VTO"})
    for index, name in enumerate(["VTO", "KP", "THETA", "LAMBDA", "RD"]):
        # VTO resting on a published threshold min/max is the archetype's intent, not saturation.
        if name == "VTO":
            continue
        value = float(fit.x[index])
        if not bound_saturated(value, lo[index], hi[index]):
            continue
        at_lower = (value - lo[index]) < (hi[index] - value)
        if at_lower and name in floor_is_held:
            held.append({"parameter": name, "value": value, "reason": floor_is_held[name]})
        else:
            notes.append(f"{name} saturated its bound at {value:.6g}; the residual is a constraint artefact")

    t, o, d = vdmos_bench(fit.x, fixed, transfer, out_points, rdson)
    residuals = []
    for (vgs, vds, target), actual in zip(transfer, t):
        residuals.append({"quantity": f"transfer current at VGS {vgs:.6g} V", "gate_quantity": "drain_current",
                          "datasheet_value": target, "fitted_value": actual, "unit": "A",
                          "relative_error": abs(actual - target) / abs(target),
                          "citation": tcurve.get("page_reference") or "pending review"})
    for (vgs, vds, target), actual in zip(out_points, o):
        residuals.append({"quantity": f"output current at VGS {vgs:.6g} V, VDS {vds:.6g} V", "gate_quantity": "drain_current",
                          "datasheet_value": target, "fitted_value": actual, "unit": "A",
                          "relative_error": abs(actual - target) / abs(target),
                          "citation": "output characteristics"})
    for (vgs, current, target, kind), actual in zip(rdson, d):
        error = abs(actual - target) / abs(target)
        if kind == "maximum":
            error = max(actual - target, 0.0) / abs(target)
        residuals.append({"quantity": f"RDS(on) at VGS {vgs:.6g} V", "gate_quantity": "rds_on",
                          "datasheet_value": target, "fitted_value": actual, "unit": "ohm",
                          "relative_error": error, "citation": "electrical characteristics table"})
    return params, residuals, used, notes, {"optimizer_nfev": int(fit.nfev), "optimizer_status": int(fit.status),
                                            "held_defaults": held}


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
            "parameters": params, "residuals": residuals, "curves_used": used,
            "worst": {"value": worst_row["relative_error"], "quantity": worst_row["quantity"]},
            "rms": rms, "fitter": "scipy.optimize.least_squares with native ngspice-46 evaluations",
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
