#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

K_BOLTZMANN = 1.380649e-23
Q_ELECTRON = 1.602176634e-19


def diode_voltage(current, log_is, ideality, resistance, temperature_c):
    thermal_voltage = K_BOLTZMANN * (temperature_c + 273.15) / Q_ELECTRON
    saturation_current = math.exp(log_is)
    return ideality * thermal_voltage * np.log1p(current / saturation_current) + current * resistance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()

    facts = json.loads(Path(args.facts).read_text())
    points = facts["fit_points"]
    currents = np.array([point["current"]["value"] for point in points], dtype=float)
    voltages = np.array([point["voltage"]["value"] for point in points], dtype=float)
    temperature_c = float(facts["fit_conditions"]["temperature"]["value"])

    def residual(parameters):
        predicted = diode_voltage(currents, *parameters, temperature_c)
        return (predicted - voltages) / np.maximum(voltages, 0.1)

    result = least_squares(
        residual,
        x0=np.array([math.log(1e-12), 1.8, 2.0]),
        bounds=(np.array([math.log(1e-30), 0.8, 0.0]), np.array([math.log(1e-3), 6.0, 500.0])),
        xtol=1e-14,
        ftol=1e-14,
        gtol=1e-14,
        max_nfev=100000,
    )
    if not result.success:
        raise SystemExit(f"fit failed: {result.message}")

    log_is, ideality, resistance = [float(value) for value in result.x]
    predicted = diode_voltage(currents, log_is, ideality, resistance, temperature_c)
    rows = []
    for point, measured, fitted in zip(points, voltages, predicted):
        relative_error = abs(float(fitted - measured)) / abs(float(measured))
        rows.append({
            "current_a": point["current"]["value"],
            "datasheet_voltage_v": float(measured),
            "fitted_voltage_v": float(fitted),
            "relative_error": relative_error,
            "citation": point["voltage"]["page_reference"],
        })

    worst = max(rows, key=lambda row: row["relative_error"])
    output = {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares",
        "deterministic": True,
        "temperature_c": temperature_c,
        "parameters": {
            "IS": math.exp(log_is),
            "N": ideality,
            "RS": resistance,
            "CJO": facts.get("derived_model_inputs", {}).get("CJO", {}).get("value", 0.0),
            "TT": facts.get("derived_model_inputs", {}).get("TT", {}).get("value", 0.0),
        },
        "residuals": rows,
        "rms_relative_error": float(math.sqrt(np.mean(np.square([row["relative_error"] for row in rows])))),
        "worst_relative_error": {
            "value": worst["relative_error"],
            "quantity": f"forward voltage at {worst['current_a']:.6g} A",
        },
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
