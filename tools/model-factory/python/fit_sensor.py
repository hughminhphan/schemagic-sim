#!/usr/bin/env python3
import argparse
import json
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


# Deliberately no residual_ntc(): the beta_ntc variant transcribes its cited constants
# and must never acquire an optimizer over R25 or B25/85. See the beta_ntc branch below.


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
        fitter_description = "scipy.optimize.least_squares with native ngspice-46 evaluations"
    elif variant == "beta_ntc":
        # Transcription only: never optimise R25 or B25/85.
        #
        # The published R25 and B25/85 tolerances describe a manufacturing spread across
        # the population, not a fitting degree of freedom for one modelled part. Running
        # least_squares inside those bounds let the optimizer trade cited constants away
        # to chase the zero-power resistance table, and because the band is narrow the
        # solution saturated it: the P5-rejected values 9500 ohm and 3947.1725 K are
        # exactly 0.95 * R25 and 0.9925 * B25/85, i.e. the lower bounds, not a fit.
        #
        # The sensor archetype requires the cited facts to be transcribed unchanged. The
        # B-parameter equation is then measured against the table through native ngspice,
        # and whatever error remains is reported honestly rather than optimised away.
        p = facts["parameters"]
        r0 = float(p["nominal_resistance"]["value"])
        beta = float(p["beta"]["value"])
        parameters = {"R0": r0, "T0_C": p["reference_temperature"]["value"], "BETA": beta}
        measured = evaluate_ntc([r0, beta], facts)
        residuals = rows(facts, measured, "resistance", "ohm")
        metadata = {
            "R0": {"status": "direct transcription of cited R25"},
            "T0_C": {"status": "direct transcription of cited reference temperature"},
            "BETA": {"status": "direct transcription of cited B25/85"},
        }
        fitter_description = "direct datasheet transcription evaluated with native ngspice-46"
        fit = None
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
        fitter_description = "native ngspice-46 evaluation of published F1 bounds"
        fit = None
    else:
        raise SystemExit(f"unsupported sensor variant: {variant}")

    worst = max(residuals, key=lambda row: row["relative_error"])
    output = {
        "schema_version": "1.0.0",
        "fitter": fitter_description,
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
