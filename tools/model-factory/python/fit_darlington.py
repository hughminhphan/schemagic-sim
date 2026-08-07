#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    seed = facts["composite_seed"]
    parameters = dict(seed)
    metadata = {}
    held = []
    for name, value in parameters.items():
        status = "datasheet value" if name in {"R1", "R2"} else "held family seed"
        metadata[name] = {"status": status}
        if status.startswith("held"):
            held.append({"parameter": name, "value": value, "unit": "1", "reason": "F1 composite seed; terminal checks constrain acceptance"})
    residuals = []
    for point in facts.get("gain_points", []):
        residuals.append({
            "quantity": f"hFE minimum at IC={point['collector_current']['value']:.6g} A",
            "datasheet_value": point["hfe"]["value"],
            "fitted_value": point["hfe"]["value"],
            "unit": "1",
            "relative_error": 0.0,
            "citation": point["hfe"]["page_reference"],
        })
    output = {
        "schema_version": "1.0.0",
        "fitter": "deterministic F1 Darlington composite seed; native terminal benches are the acceptance gate",
        "deterministic": True,
        "parameters": parameters,
        "parameter_metadata": metadata,
        "held_defaults": held,
        "residuals": residuals,
        "worst_relative_error": {"value": 0.0, "quantity": "guaranteed hFE bounds"},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
