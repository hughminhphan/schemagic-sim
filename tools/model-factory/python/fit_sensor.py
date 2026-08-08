#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector


def spice_value(value):
    return f"{float(value):.12g}"


def evaluate_linear(values, facts):
    scale, offset = [float(value) for value in values]
    lines = ["Behavioral linear sensor native fit probe"]
    for index, point in enumerate(facts["transfer_points"], 1):
        lines += [
            f"B{index} out{index} 0 V={{{spice_value(offset)}+{spice_value(scale)}*{spice_value(point['environment']['value'])}}}",
            f"R{index} out{index} 0 1G",
        ]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    return [float(vector(result, f"v(out{index})", f"out{index}")[0]) for index in range(1, len(facts["transfer_points"]) + 1)]


def evaluate_ntc(values, facts):
    r0, beta = [float(value) for value in values]
    t0 = facts["parameters"]["reference_temperature"]["value"]
    lines = ["Behavioral NTC native fit probe"]
    for index, point in enumerate(facts["transfer_points"], 1):
        temp = point["environment"]["value"]
        expression = f"max({spice_value(r0)}*exp({spice_value(beta)}*(1/({spice_value(temp)}+273.15)-1/({spice_value(t0)}+273.15))),1e-4)"
        lines += [f"I{index} 0 n{index} DC 1u", f"R{index} n{index} 0 R={{{expression}}}"]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    return [float(vector(result, f"v(n{index})", f"n{index}")[0]) / 1e-6 for index in range(1, len(facts["transfer_points"]) + 1)]


def evaluate_ldr(values, facts):
    r10, gamma = [float(value) for value in values]
    lines = ["Behavioral LDR native fit probe"]
    for index, point in enumerate(facts["transfer_points"], 1):
        lux = point["environment"]["value"]
        expression = f"max({spice_value(r10)}*pow(max({spice_value(lux)},1m)/10,-{spice_value(gamma)}),1e-4)"
        lines += [f"I{index} 0 n{index} DC 1u", f"R{index} n{index} 0 R={{{expression}}}"]
    lines += [".op", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    return [float(vector(result, f"v(n{index})", f"n{index}")[0]) / 1e-6 for index in range(1, len(facts["transfer_points"]) + 1)]


def residual_linear(values, facts):
    actual = evaluate_linear(values, facts)
    target = [point["electrical"]["value"] for point in facts["transfer_points"]]
    return np.asarray([(a - t) / max(abs(t), 0.01) for a, t in zip(actual, target)])


def residual_ntc(values, facts):
    actual = evaluate_ntc(values, facts)
    target = [point["electrical"]["value"] for point in facts["transfer_points"]]
    return np.asarray([math.log(max(a, 1e-12) / t) for a, t in zip(actual, target)])


def rows(facts, actual, quantity, unit):
    output = []
    for point, fitted in zip(facts["transfer_points"], actual):
        target = point["electrical"]["value"]
        output.append({
            "quantity": f"{quantity} at {point['environment']['value']} {point['environment']['unit']}",
            "datasheet_value": target,
            "fitted_value": fitted,
            "unit": unit,
            "relative_error": abs(fitted - target) / max(abs(target), 1e-12),
            "citation": point["electrical"]["page_reference"],
        })
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    variant = facts["sensor_variant"]

    if variant == "linear_voltage":
        p = facts["parameters"]
        fit = least_squares(
            residual_linear,
            x0=np.array([p["scale"]["value"], p["offset"]["value"]]),
            bounds=(np.array([0.9 * p["scale"]["value"], -0.02]), np.array([1.1 * p["scale"]["value"], 0.02])),
            args=(facts,), method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-12, xtol=1e-12, max_nfev=5000,
        )
        parameters = {
            "SCALE": float(fit.x[0]), "OFFSET": float(fit.x[1]),
            "ROUT": p["output_resistance"]["value"], "IQ": p["quiescent_current"]["value"],
            "VDROP": p["supply_headroom"]["value"],
        }
        measured = evaluate_linear(fit.x, facts)
        residuals = rows(facts, measured, "output voltage", "V")
        metadata = {"SCALE": {"status": "native fitted"}, "OFFSET": {"status": "native fitted"}, "ROUT": {"status": "derived from cited load regulation"}, "IQ": {"status": "direct typical transcription"}, "VDROP": {"status": "derived from cited minimum supply and maximum output"}}
    elif variant == "beta_ntc":
        p = facts["parameters"]
        r0 = p["nominal_resistance"]["value"]
        beta = p["beta"]["value"]
        fit = least_squares(
            residual_ntc,
            x0=np.array([r0, beta]),
            bounds=(np.array([0.95 * r0, 0.9925 * beta]), np.array([1.05 * r0, 1.0075 * beta])),
            args=(facts,), method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-12, xtol=1e-12, max_nfev=5000,
        )
        parameters = {"R0": float(fit.x[0]), "T0_C": p["reference_temperature"]["value"], "BETA": float(fit.x[1])}
        measured = evaluate_ntc(fit.x, facts)
        residuals = rows(facts, measured, "resistance", "ohm")
        metadata = {"R0": {"status": "native fitted within R25 tolerance"}, "T0_C": {"status": "direct transcription"}, "BETA": {"status": "native fitted within published B25/85 tolerance"}}
    elif variant == "power_ldr":
        p = facts["parameters"]
        # The source publishes only an 8 kohm to 20 kohm bound at 10 lux.
        # Select the published maximum as a conservative F1 bound, never as a typical value.
        r10 = p["resistance_10lux_maximum"]["value"]
        gamma = p["gamma"]["value"]
        measured = evaluate_ldr([r10, gamma], facts)
        parameters = {"R10": r10, "GAMMA": gamma, "LUX_FLOOR": p["lux_floor"]["value"]}
        residuals = rows(facts, measured, "conservative resistance", "ohm")
        metadata = {"R10": {"status": "published maximum selected as conservative F1 bound"}, "GAMMA": {"status": "direct typical transcription"}, "LUX_FLOOR": {"status": "supported-region floor"}}
        fit = None
    else:
        raise SystemExit(f"unsupported sensor variant: {variant}")

    worst = max(residuals, key=lambda row: row["relative_error"])
    output = {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares with native ngspice-46 evaluations" if fit is not None else "native ngspice-46 evaluation of published F1 bounds",
        "deterministic": True,
        "parameters": parameters,
        "parameter_metadata": metadata,
        "optimizer": None if fit is None else {"status": int(fit.status), "nfev": int(fit.nfev), "cost": float(fit.cost), "diff_step": 1e-4},
        "residuals": residuals,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
