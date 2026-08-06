#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

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
BCLMP q 0 V = min(max(v(p2), v(VEE)+VDRP_L), v(VCC)-VDRP_H)
RQ q 0 1meg
BOUT 0 OUT I = ILIM*tanh((v(q)-v(OUT))/(ROUT*ILIM))
IQVCC VCC VEE DC {{IQ}}
.ends OCFIT
"""


def measure_ac(parameters):
    circuit = f"""TL072 native DC-servo open-loop calibration
{subcircuit(parameters)}
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
VCC vcc 0 DC 15
VEE vee 0 DC -15
VIN sig 0 PULSE(0 14 1u 1n 1n 1u 4u)
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
    return {"sr": 5 / (t2 - t1), "maximum": max(output), "minimum": -max(output)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    direct = facts["parameters"]
    gbw_target = direct["gbw"]["value"]
    sr_target = direct["sr"]["value"]
    swing = direct["output_swing"]["value"]
    parameters = {
        "AOL": direct["aol"]["value"],
        "GBW": gbw_target,
        "SR": sr_target,
        "IBIAS": direct["ibias"]["value"],
        "IOS": direct["ios"]["value"],
        "VOS": direct["vos"]["value"],
        "ROUT": direct["rout"]["value"],
        "ILIM": direct["ilim"]["value"],
        "VDRP_H": max(direct["supply_positive"]["value"] - swing, 0.01),
        "VDRP_L": max(-swing - direct["supply_negative"]["value"], 0.01),
        "FP2": gbw_target / math.tan(math.radians(direct["phase_margin"]["value"])),
        "CMRR": 10 ** (direct["cmrr_db"]["value"] / 20),
        "PSRR": 10 ** (direct["psrr_db"]["value"] / 20),
        "VSUP_NOM": direct["supply_positive"]["value"] - direct["supply_negative"]["value"],
        "IQ": direct["iq"]["value"],
        "EN": direct["en"]["value"],
    }
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
    if abs(ac["gbw"] - gbw_target) / gbw_target > 0.02 or abs(slew["sr"] - sr_target) / sr_target > 0.02:
        raise SystemExit("Opamp fixed-point calibration missed the 2 percent target")
    rows = [
        {"quantity": "open-loop gain", "datasheet_value": parameters["AOL"], "fitted_value": ac["aol"], "unit": "V/V", "relative_error": abs(ac["aol"] - parameters["AOL"]) / parameters["AOL"], "citation": direct["aol"]["page_reference"]},
        {"quantity": "unity-gain bandwidth", "datasheet_value": gbw_target, "fitted_value": ac["gbw"], "unit": "Hz", "relative_error": abs(ac["gbw"] - gbw_target) / gbw_target, "citation": direct["gbw"]["page_reference"]},
        {"quantity": "slew rate", "datasheet_value": sr_target, "fitted_value": slew["sr"], "unit": "V/s", "relative_error": abs(slew["sr"] - sr_target) / sr_target, "citation": direct["sr"]["page_reference"]},
        {"quantity": "positive output swing", "datasheet_value": swing, "fitted_value": slew["maximum"], "unit": "V", "relative_error": abs(slew["maximum"] - swing) / swing, "citation": direct["output_swing"]["page_reference"]},
        {"quantity": "negative output swing", "datasheet_value": -swing, "fitted_value": slew["minimum"], "unit": "V", "relative_error": abs(slew["minimum"] + swing) / swing, "citation": direct["output_swing"]["page_reference"]},
    ]
    worst = max(rows, key=lambda row: row["relative_error"])
    output = {
        "schema_version": "1.0.0",
        "fitter": "three fixed-point native ngspice-46 calibration iterations",
        "deterministic": True,
        "parameters": parameters,
        "calibration_iterations": iterations,
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
