#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import crossing_frequency, crossing_time, run_ngspice, vector


def subcircuit(parameters):
    return f""".subckt OCFIT INP INN VCC VEE OUT
.param AOL={parameters['AOL']:.12g} GBW={parameters['GBW']:.12g} SR={parameters['SR']:.12g} IBIAS={parameters['IBIAS']:.12e} IOS={parameters['IOS']:.12e} VOS={parameters['VOS']:.12e}
.param ROUT={parameters['ROUT']:.12g} ILIM={parameters['ILIM']:.12e} VDRP_H={parameters['VDRP_H']:.12g} VDRP_L={parameters['VDRP_L']:.12g} CC=30p FP2={parameters['FP2']:.12g}
.param CMRR={parameters['CMRR']:.12g} PSRR={parameters['PSRR']:.12g} VSUP_NOM={parameters['VSUP_NOM']:.12g} IQ={parameters['IQ']:.12e} EN={parameters['EN']:.12e}
IBP 0 INP DC {{IBIAS+IOS/2}}
IBN 0 INN DC {{IBIAS-IOS/2}}
CDIF INP INN 1p
BERR e 0 V = v(INP,INN) + VOS + v(nz) + 0.5*(v(INP)+v(INN))/CMRR + (v(VCC,VEE)-VSUP_NOM)/PSRR
RE e 0 1meg
RNZ nz 0 {{EN*EN/(4*1.380649e-23*300.15)}}
BGM 0 p I = {{SR*CC}}*tanh({{6.283185307*GBW/SR}}*v(e))
CP p 0 {{CC}}
RP p 0 {{AOL/(6.283185307*GBW*CC)}}
RP2 p p2 {{1/(6.283185307*FP2*1p)}}
CP2 p2 0 1p
BCLMP q 0 V = min(max(v(p2), v(VEE)+min(VDRP_L,0.49*v(VCC,VEE))), v(VCC)-min(VDRP_H,0.49*v(VCC,VEE)))
RQ q 0 1meg
BOUT 0 OUT I = ILIM*tanh((v(q)-v(OUT))/(ROUT*ILIM))
IQVCC VCC VEE DC {{IQ}}
.ends OCFIT
"""


def measure_ac(parameters):
    circuit = f"""TL072 native DC-servo open-loop calibration
{subcircuit(parameters)}
.temp 25
VCC vcc 0 DC 15
VEE vee 0 DC -15
VIN sig 0 DC 0 AC 1
X1 sig inn vcc vee out OCFIT
LSERVO out inn 1G
CSERVO inn 0 1G
RL out 0 2k
.ac dec 40 0.01 300Meg
.end
"""
    result = run_ngspice(circuit)
    frequencies = vector(result, "frequency")
    output = vector(result, "v(out)", "out")
    return {
        "aol": abs(output[0]),
        "gbw": crossing_frequency(frequencies, output, 1.0),
    }


def measure_slew(parameters):
    circuit = f"""TL072 native slew calibration
{subcircuit(parameters)}
.temp 25
VCC vcc 0 DC 15
VEE vee 0 DC -15
VIN sig 0 PULSE(0 14 1u 1n 1n 5u 12u)
X1 sig out vcc vee out OCFIT
RL out 0 2k
.tran 5n 20u
.end
"""
    result = run_ngspice(circuit)
    times = vector(result, "time")
    output = vector(result, "v(out)", "out")
    t1 = crossing_time(times, output, 2, rising=True, after=1e-6)
    t2 = crossing_time(times, output, 7, rising=True, after=t1)
    return {"sr": 5 / (t2 - t1)}


def measure_swing(parameters):
    circuit = f"""TL072 native output-swing calibration
{subcircuit(parameters)}
.temp 25
VCC vcc 0 DC 15
VEE vee 0 DC -15
VPOS pos 0 DC 14
XPOS pos outp vcc vee outp OCFIT
RLP outp 0 10k
VNEG neg 0 DC -14
XNEG neg outn vcc vee outn OCFIT
RLN outn 0 10k
.op
.end
"""
    result = run_ngspice(circuit)
    return {
        "positive": float(vector(result, "v(outp)", "outp")[-1]),
        "negative": float(vector(result, "v(outn)", "outn")[-1]),
    }


def rail_drop_residual(values, base_parameters, target):
    parameters = dict(base_parameters)
    parameters["VDRP_H"] = float(values[0])
    parameters["VDRP_L"] = float(values[1])
    measured = measure_swing(parameters)
    return np.array([
        (measured["positive"] - target) / target,
        (measured["negative"] + target) / target,
    ])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    direct = facts["parameters"]
    gbw_target = direct["gbw"]["value"]
    sr_target = direct["sr"]["value"]
    swing_target = direct["output_swing"]["typical_25c"]["value"]
    initial_drop = max(direct["supply_positive"]["value"] - swing_target, 0.01)
    parameters = {
        "AOL": direct["aol"]["value"],
        "GBW": gbw_target,
        "SR": sr_target,
        "IBIAS": direct["ibias"]["value"],
        "IOS": direct["ios"]["value"],
        "VOS": direct["vos"]["value"],
        "ROUT": direct["rout"]["value"],
        "ILIM": direct["ilim"]["value"],
        "VDRP_H": initial_drop,
        "VDRP_L": initial_drop,
        "FP2": gbw_target / math.tan(math.radians(direct["phase_margin"]["value"])),
        "CMRR": 10 ** (direct["cmrr_db"]["value"] / 20),
        "PSRR": 10 ** (direct["psrr_db"]["value"] / 20),
        "VSUP_NOM": direct["supply_positive"]["value"] - direct["supply_negative"]["value"],
        "IQ": direct["iq"]["value"],
        "EN": direct["en"]["value"],
    }

    rail_fit = least_squares(
        rail_drop_residual,
        x0=np.array([initial_drop, initial_drop]),
        bounds=(np.array([0.01, 0.01]), np.array([14.9, 14.9])),
        args=(parameters, swing_target),
        method="trf",
        x_scale="jac",
        diff_step=1e-4,
        ftol=1e-10,
        xtol=1e-10,
        max_nfev=5000,
    )
    parameters["VDRP_H"] = float(rail_fit.x[0])
    parameters["VDRP_L"] = float(rail_fit.x[1])

    iterations = []
    phase_tangent = math.tan(math.radians(direct["phase_margin"]["value"]))
    for index in range(3):
        ac = measure_ac(parameters)
        slew = measure_slew(parameters)
        iterations.append({"iteration": index + 1, "gbw_measured": ac["gbw"], "sr_measured": slew["sr"]})
        parameters["GBW"] *= gbw_target / ac["gbw"]
        parameters["FP2"] = parameters["GBW"] / phase_tangent
        parameters["SR"] *= sr_target / slew["sr"]

    ac = measure_ac(parameters)
    slew = measure_slew(parameters)
    swing = measure_swing(parameters)
    if abs(ac["gbw"] - gbw_target) / gbw_target > 0.02 or abs(slew["sr"] - sr_target) / sr_target > 0.02:
        raise SystemExit("Opamp fixed-point calibration missed the 2 percent target")
    if max(abs(swing["positive"] - swing_target), abs(swing["negative"] + swing_target)) / swing_target > 0.02:
        raise SystemExit("Opamp output-stage fit missed the 2 percent target")

    rows = [
        {"quantity": "open-loop gain", "datasheet_value": parameters["AOL"], "fitted_value": ac["aol"], "unit": "V/V", "relative_error": abs(ac["aol"] - parameters["AOL"]) / parameters["AOL"], "citation": direct["aol"]["page_reference"]},
        {"quantity": "unity-gain bandwidth", "datasheet_value": gbw_target, "fitted_value": ac["gbw"], "unit": "Hz", "relative_error": abs(ac["gbw"] - gbw_target) / gbw_target, "citation": direct["gbw"]["page_reference"]},
        {"quantity": "slew rate", "datasheet_value": sr_target, "fitted_value": slew["sr"], "unit": "V/s", "relative_error": abs(slew["sr"] - sr_target) / sr_target, "citation": direct["sr"]["page_reference"]},
        {"quantity": "positive output swing", "datasheet_value": swing_target, "fitted_value": swing["positive"], "unit": "V", "relative_error": abs(swing["positive"] - swing_target) / swing_target, "citation": direct["output_swing"]["typical_25c"]["page_reference"]},
        {"quantity": "negative output swing", "datasheet_value": -swing_target, "fitted_value": swing["negative"], "unit": "V", "relative_error": abs(swing["negative"] + swing_target) / swing_target, "citation": direct["output_swing"]["typical_25c"]["page_reference"]},
    ]
    worst = max(rows, key=lambda row: row["relative_error"])
    output = {
        "schema_version": "1.0.0",
        "fitter": "native ngspice-46 rail-drop least squares plus three fixed-point GBW and slew calibration iterations",
        "deterministic": True,
        "parameters": parameters,
        "parameter_metadata": {
            "AOL": {"status": "direct typical transcription"},
            "GBW": {"status": "native calibrated"},
            "SR": {"status": "native calibrated"},
            "IBIAS": {"status": "direct typical transcription"},
            "IOS": {"status": "direct typical transcription"},
            "VOS": {"status": "direct typical transcription"},
            "ROUT": {"status": "direct typical transcription"},
            "ILIM": {"status": "direct digitized typical transcription"},
            "VDRP_H": {"status": "native fitted to 25 degC typical output swing"},
            "VDRP_L": {"status": "native fitted to 25 degC typical output swing"},
            "FP2": {"status": "derived from phase margin and calibrated GBW"},
            "CMRR": {"status": "derived from direct typical dB value"},
            "PSRR": {"status": "derived from direct typical dB value"},
            "VSUP_NOM": {"status": "derived from datasheet test supply"},
            "IQ": {"status": "direct typical transcription"},
            "EN": {"status": "direct typical transcription"},
        },
        "held_defaults": [
            {"parameter": "CC", "value": 30e-12, "unit": "F", "reason": "held at default internal archetype scale"},
            {"parameter": "CDIF", "value": 1e-12, "unit": "F", "reason": "held at default input-capacitance placeholder"},
            {"parameter": "RE", "value": 1e6, "unit": "ohm", "reason": "held at default internal DC path"},
            {"parameter": "CP2", "value": 1e-12, "unit": "F", "reason": "held at default second-pole scale"},
            {"parameter": "RQ", "value": 1e6, "unit": "ohm", "reason": "held at default clamp-node DC path"},
            {"parameter": "noise_reference_temperature", "value": 300.15, "unit": "K", "reason": "held at default archetype noise normalization"},
        ],
        "rail_drop_fit": {
            "method": "scipy.optimize.least_squares with native ngspice in every residual",
            "diff_step": 1e-4,
            "target": swing_target,
            "unit": "V",
            "conditions": direct["output_swing"]["typical_25c"]["conditions"],
            "nfev": rail_fit.nfev,
            "cost": rail_fit.cost,
        },
        "calibration_iterations": iterations,
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
