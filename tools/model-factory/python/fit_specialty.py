#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

from native_ngspice import run_ngspice, vector


def interpolate_log(x_values, y_values, target):
    xs = np.asarray(x_values, dtype=float)
    ys = np.asarray(y_values, dtype=float)
    if target <= xs[0]:
        return float(ys[0])
    if target >= xs[-1]:
        return float(ys[-1])
    index = int(np.searchsorted(xs, target))
    fraction = math.log(target / xs[index - 1]) / math.log(xs[index] / xs[index - 1])
    return float(ys[index - 1] + fraction * (ys[index] - ys[index - 1]))


def lm386_subcircuit(parameters):
    return f""".subckt OCFIT GAIN1 INN INP GND OUT VS BYPASS GAIN8 params: GAIN_CL={parameters['GAIN_OPEN']:.12g}
.param GAIN_OPEN={parameters['GAIN_OPEN']:.12g} BW={parameters['BW']:.12g} VDROP={parameters['VDROP']:.12g} ILIM={parameters['ILIM']:.12g}
.param ROUT={parameters['ROUT']:.12g} IQ={parameters['IQ']:.12g} IBIAS={parameters['IBIAS']:.12g} RIN={parameters['RIN']:.12g} RBYP={parameters['RBYP']:.12g} RGAIN={parameters['RGAIN']:.12g}
RINPUT INP INN {{RIN}}
IBP GND INP DC {{IBIAS}}
IBN GND INN DC {{IBIAS}}
RBP1 VS BYPASS {{RBYP}}
RBP2 BYPASS GND {{RBYP}}
RG12 GAIN1 GAIN8 {{RGAIN}}
RG1DC GAIN1 GND 1G
RG8DC GAIN8 GND 1G
BIDEAL pre GND V={{v(GND)+0.5*v(VS,GND)+GAIN_CL*v(INP,INN)}}
RLP pre filt 1k
CLP filt GND {{1/(6.283185307*BW*1k)}}
BCLAMP q GND V={{min(max(v(filt),v(GND)+VDROP),v(VS)-VDROP)}}
RQ q GND 1G
BOUT GND OUT I={{ILIM*tanh((v(q)-v(OUT))/(ROUT*ILIM))}}
IQDRAW VS GND DC {{IQ}}
.ends OCFIT
"""


def lm386_measure(parameters, facts):
    model = lm386_subcircuit(parameters)
    ac_circuit = f"""LM386 native frequency-response fit
{model}
VS vs 0 DC 6
VIN inp 0 DC 0 AC 1
X1 g1 0 inp 0 out vs bypass g8 OCFIT
RLOAD out 0 10k
.ac dec 40 100 3Meg
.end
"""
    ac = run_ngspice(ac_circuit)
    frequencies = [float(value.real if hasattr(value, "real") else value) for value in vector(ac, "frequency")]
    output = [abs(value) for value in vector(ac, "v(out)", "out")]
    gains = [interpolate_log(frequencies, output, point["frequency"]["value"]) for point in facts["gain_frequency_points"]]

    lines = ["LM386 native output-swing fit", model]
    for index, point in enumerate(facts["output_swing_curve"], 1):
        supply = point["supply_voltage"]["value"]
        load = point["load_resistance"]["value"]
        lines += [
            f"VS{index} vs{index} 0 DC {supply}",
            f"VM{index} mid{index} 0 DC {supply / 2}",
            f"VIN{index} inp{index} 0 DC 1",
            f"X{index} g1_{index} 0 inp{index} 0 out{index} vs{index} byp{index} g8_{index} OCFIT",
            f"RL{index} out{index} mid{index} {load}",
        ]
    lines += [".op", ".end"]
    dc = run_ngspice("\n".join(lines) + "\n")
    swings = []
    for index, point in enumerate(facts["output_swing_curve"], 1):
        supply = point["supply_voltage"]["value"]
        out = float(vector(dc, f"v(out{index})", f"out{index}")[-1])
        swings.append(2 * (out - supply / 2))
    return gains, swings


def fit_lm386(facts):
    direct = facts["parameters"]
    base = {
        "GAIN_OPEN": direct["gain_open"]["value"],
        "BW": direct["bandwidth"]["value"],
        "VDROP": 0.8,
        "ILIM": 0.5,
        "ROUT": 0.5,
        "IQ": direct["quiescent_current"]["typical"]["value"],
        "IBIAS": direct["input_bias_current"]["value"],
        "RIN": direct["input_resistance"]["value"],
        "RBYP": 15e3,
        "RGAIN": 1.5e3,
    }

    def residual(values):
        parameters = dict(base)
        parameters.update({"GAIN_OPEN": float(values[0]), "BW": float(values[1]), "VDROP": float(values[2]), "ILIM": float(values[3])})
        try:
            gains, swings = lm386_measure(parameters, facts)
        except Exception:
            return np.full(len(facts["gain_frequency_points"]) + len(facts["output_swing_curve"]), 1e3)
        output = []
        for point, actual in zip(facts["gain_frequency_points"], gains):
            output.append(math.log(max(actual, 1e-12)) - math.log(point["gain"]["value"]))
        for point, actual in zip(facts["output_swing_curve"], swings):
            target = point["output_voltage_pp"]["value"]
            output.append((actual - target) / target)
        return np.asarray(output)

    fit = least_squares(
        residual,
        x0=np.array([base["GAIN_OPEN"], base["BW"], base["VDROP"], base["ILIM"]]),
        bounds=(np.array([15.0, 50e3, 0.1, 0.1]), np.array([30.0, 1.5e6, 2.0, 1.0])),
        method="trf",
        x_scale="jac",
        diff_step=1e-4,
        ftol=1e-9,
        xtol=1e-9,
        max_nfev=1000,
    )
    if fit.status <= 0:
        raise SystemExit(f"LM386 fit failed: {fit.message}")
    parameters = dict(base)
    parameters.update({"GAIN_OPEN": float(fit.x[0]), "BW": float(fit.x[1]), "VDROP": float(fit.x[2]), "ILIM": float(fit.x[3])})
    gains, swings = lm386_measure(parameters, facts)
    rows = []
    for point, actual in zip(facts["gain_frequency_points"], gains):
        target = point["gain"]["value"]
        rows.append({"quantity": f"closed-loop gain at {point['frequency']['value']} Hz", "datasheet_value": target, "fitted_value": actual, "unit": "V/V", "relative_error": abs(actual - target) / target, "citation": point["gain"]["page_reference"]})
    for point, actual in zip(facts["output_swing_curve"], swings):
        target = point["output_voltage_pp"]["value"]
        rows.append({"quantity": f"8 ohm output swing at {point['supply_voltage']['value']} V supply", "datasheet_value": target, "fitted_value": actual, "unit": "Vpp", "relative_error": abs(actual - target) / target, "citation": point["output_voltage_pp"]["page_reference"]})
    worst = max(rows, key=lambda row: row["relative_error"])
    return {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares with native ngspice-46 AC and operating-point evaluations",
        "deterministic": True,
        "parameters": parameters,
        "parameter_metadata": {
            "GAIN_OPEN": {"status": "native fitted to manually digitized Figure 6-4 typical curve"},
            "BW": {"status": "native fitted to manually digitized Figure 6-4 typical curve"},
            "VDROP": {"status": "native fitted to manually digitized Figure 6-3 typical curve"},
            "ILIM": {"status": "native fitted to manually digitized Figure 6-3 typical curve"},
            "ROUT": {"status": "held compact output-stage default"},
            "IQ": {"status": "direct typical transcription"},
            "IBIAS": {"status": "direct typical transcription"},
            "RIN": {"status": "direct typical transcription"},
            "RBYP": {"status": "derived from the published internal schematic"},
            "RGAIN": {"status": "derived from the published 150 ohm plus 1.35 kohm gain path"},
        },
        "held_defaults": [{"parameter": "ROUT", "value": base["ROUT"], "unit": "ohm", "reason": "held compact output-stage stabilization resistance"}],
        "optimizer": {"status": int(fit.status), "nfev": int(fit.nfev), "diff_step": 1e-4},
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }


def ota_subcircuit(parameters):
    return f""".subckt OCFIT IABC1 DIODE1 INP1 INN1 OUT1 VEE BUFIN1 BUFOUT1 BUFOUT2 BUFIN2 VCC OUT2 INN2 INP2 DIODE2 IABC2
.param GM_SCALE={parameters['GM_SCALE']:.12g} VT={parameters['VT']:.12g} POLE_HZ={parameters['POLE_HZ']:.12g} VBIAS0={parameters['VBIAS0']:.12g} RABC={parameters['RABC']:.12g}
.param RIN={parameters['RIN']:.12g} ROUT={parameters['ROUT']:.12g} IQ={parameters['IQ']:.12g} VBUF_DROP={parameters['VBUF_DROP']:.12g} RBUF={parameters['RBUF']:.12g} ILIM_BUF={parameters['ILIM_BUF']:.12g} IBUF={parameters['IBUF']:.12g}
VB1 IABC1 NABC1 DC {{VBIAS0}}
RABC1 NABC1 VEE {{RABC}}
VB2 IABC2 NABC2 DC {{VBIAS0}}
RABC2 NABC2 VEE {{RABC}}
RIN1 INP1 INN1 {{RIN}}
RIN2 INP2 INN2 {{RIN}}
RIP1 INP1 0 1G
RIN1DC INN1 0 1G
RIP2 INP2 0 1G
RIN2DC INN2 0 1G
RD1DC DIODE1 0 1G
RD2DC DIODE2 0 1G
RBI1DC BUFIN1 0 1G
RBO1DC BUFOUT1 0 1G
RBI2DC BUFIN2 0 1G
RBO2DC BUFOUT2 0 1G
BGM1 VEE NGM1 I={{GM_SCALE*max((v(IABC1,VEE)-VBIAS0)/RABC,0)*tanh(v(INP1,INN1)/(2*VT))}}
RPOLE1 NGM1 VEE 1
CPOLE1 NGM1 VEE {{1/(6.283185307*POLE_HZ)}}
BOUT1 VEE OUT1 I={{v(NGM1,VEE)}}
ROUT1 OUT1 0 {{ROUT}}
BGM2 VEE NGM2 I={{GM_SCALE*max((v(IABC2,VEE)-VBIAS0)/RABC,0)*tanh(v(INP2,INN2)/(2*VT))}}
RPOLE2 NGM2 VEE 1
CPOLE2 NGM2 VEE {{1/(6.283185307*POLE_HZ)}}
BOUT2 VEE OUT2 I={{v(NGM2,VEE)}}
ROUT2 OUT2 0 {{ROUT}}
DLI1P DIODE1 INP1 DLIN
DLI1N DIODE1 INN1 DLIN
DLI2P DIODE2 INP2 DLIN
DLI2N DIODE2 INN2 DLIN
.model DLIN D(IS=1e-14 N=1)
IBUF1 BUFIN1 VEE DC {{IBUF}}
BBUF1 NBF1 0 V={{min(max(v(BUFIN1)-VBUF_DROP,v(VEE)+VBUF_DROP),v(VCC)-VBUF_DROP)}}
BBO1 VEE BUFOUT1 I={{ILIM_BUF*tanh((v(NBF1)-v(BUFOUT1))/(RBUF*ILIM_BUF))}}
IBUF2 BUFIN2 VEE DC {{IBUF}}
BBUF2 NBF2 0 V={{min(max(v(BUFIN2)-VBUF_DROP,v(VEE)+VBUF_DROP),v(VCC)-VBUF_DROP)}}
BBO2 VEE BUFOUT2 I={{ILIM_BUF*tanh((v(NBF2)-v(BUFOUT2))/(RBUF*ILIM_BUF))}}
IQDRAW VCC VEE DC {{IQ}}
.ends OCFIT
"""


def ota_measure(parameters, facts):
    model = ota_subcircuit(parameters)
    lines = ["LM13700 native transconductance and bias-voltage fit", model, "VCC vcc 0 DC 15", "VEE vee 0 DC -15"]
    for index, point in enumerate(facts["transconductance_curve"], 1):
        current = point["amplifier_bias_current"]["value"]
        lines += [
            f"IABC{index} vcc abc{index} DC {current}",
            f"VIN{index} inp{index} 0 DC 0 AC 1m",
            f"VNN{index} inn{index} 0 DC 0",
            f"VOUT{index} out{index} 0 DC 0",
            f"X{index} abc{index} d1_{index} inp{index} inn{index} out{index} vee bi1_{index} bo1_{index} bo2_{index} bi2_{index} vcc o2_{index} n2_{index} p2_{index} d2_{index} a2_{index} OCFIT",
        ]
    lines += [".ac lin 1 10 10", ".end"]
    result = run_ngspice("\n".join(lines) + "\n")
    gm_values = []
    for index, _ in enumerate(facts["transconductance_curve"], 1):
        gm_values.append(abs(vector(result, f"vout{index}#branch", f"i(vout{index})")[-1]) / 1e-3)

    bias_lines = ["LM13700 native amplifier-bias voltage fit", model, "VCC vcc 0 DC 15", "VEE vee 0 DC -15"]
    for index, point in enumerate(facts["transconductance_curve"], 1):
        current = point["amplifier_bias_current"]["value"]
        bias_lines += [
            f"IABC{index} vcc abc{index} DC {current}",
            f"X{index} abc{index} d1_{index} p1_{index} n1_{index} o1_{index} vee bi1_{index} bo1_{index} bo2_{index} bi2_{index} vcc o2_{index} n2_{index} p2_{index} d2_{index} a2_{index} OCFIT",
        ]
    bias_lines += [".op", ".end"]
    bias_result = run_ngspice("\n".join(bias_lines) + "\n")
    bias_values = [float(vector(bias_result, f"v(abc{index})", f"abc{index}")[-1]) + 15.0 for index, _ in enumerate(facts["transconductance_curve"], 1)]
    return gm_values, bias_values


def fit_ota(facts):
    direct = facts["parameters"]
    base = {
        "GM_SCALE": 1.0,
        "VT": 0.026,
        "POLE_HZ": direct["open_loop_bandwidth"]["value"],
        "VBIAS0": 1.2,
        "RABC": 300.0,
        "RIN": direct["input_resistance"]["typical"]["value"],
        "ROUT": 2e6,
        "IQ": direct["supply_current"]["value"],
        "VBUF_DROP": 1.2,
        "RBUF": 25.0,
        "ILIM_BUF": direct["buffer_output_current_maximum"]["value"],
        "IBUF": direct["buffer_input_current"]["typical"]["value"],
    }

    def residual(values):
        parameters = dict(base)
        parameters.update({"GM_SCALE": float(values[0]), "VBIAS0": float(values[1]), "RABC": float(values[2])})
        try:
            gm_values, bias_values = ota_measure(parameters, facts)
        except Exception:
            return np.full(2 * len(facts["transconductance_curve"]), 1e3)
        output = []
        for point, actual in zip(facts["transconductance_curve"], gm_values):
            output.append(math.log(max(actual, 1e-12)) - math.log(point["transconductance"]["value"]))
        for point, actual in zip(facts["transconductance_curve"], bias_values):
            target = point["bias_pin_voltage"]["value"]
            output.append((actual - target) / target)
        return np.asarray(output)

    fit = least_squares(
        residual,
        x0=np.array([base["GM_SCALE"], base["VBIAS0"], base["RABC"]]),
        bounds=(np.array([0.5, 0.8, 10.0]), np.array([1.5, 1.6, 2000.0])),
        method="trf",
        x_scale="jac",
        diff_step=1e-4,
        ftol=1e-10,
        xtol=1e-10,
        max_nfev=1000,
    )
    if fit.status <= 0:
        raise SystemExit(f"LM13700 fit failed: {fit.message}")
    parameters = dict(base)
    parameters.update({"GM_SCALE": float(fit.x[0]), "VBIAS0": float(fit.x[1]), "RABC": float(fit.x[2])})
    gm_values, bias_values = ota_measure(parameters, facts)
    rows = []
    for point, actual in zip(facts["transconductance_curve"], gm_values):
        target = point["transconductance"]["value"]
        rows.append({"quantity": f"transconductance at {point['amplifier_bias_current']['value']} A IABC", "datasheet_value": target, "fitted_value": actual, "unit": "S", "relative_error": abs(actual - target) / target, "citation": point["transconductance"]["page_reference"]})
    for point, actual in zip(facts["transconductance_curve"], bias_values):
        target = point["bias_pin_voltage"]["value"]
        rows.append({"quantity": f"amplifier-bias pin voltage at {point['amplifier_bias_current']['value']} A", "datasheet_value": target, "fitted_value": actual, "unit": "V", "relative_error": abs(actual - target) / target, "citation": point["bias_pin_voltage"]["page_reference"]})
    worst = max(rows, key=lambda row: row["relative_error"])
    return {
        "schema_version": "1.0.0",
        "fitter": "scipy.optimize.least_squares with native ngspice-46 evaluations of cited typical curves",
        "deterministic": True,
        "parameters": parameters,
        "parameter_metadata": {
            "GM_SCALE": {"status": "native fitted to manually digitized Figure 8 transconductance curve"},
            "VT": {"status": "direct equation constant from datasheet section 7.3.1 at 25 degC"},
            "POLE_HZ": {"status": "direct typical transcription"},
            "VBIAS0": {"status": "native fitted to manually digitized Figure 10 amplifier-bias voltage curve"},
            "RABC": {"status": "native fitted to manually digitized Figure 10 amplifier-bias voltage curve"},
            "RIN": {"status": "direct typical transcription"},
            "ROUT": {"status": "held compact output-resistance approximation"},
            "IQ": {"status": "direct typical transcription"},
            "VBUF_DROP": {"status": "derived Darlington buffer drop approximation"},
            "RBUF": {"status": "held compact buffer output resistance"},
            "ILIM_BUF": {"status": "direct absolute-maximum transcription"},
            "IBUF": {"status": "direct typical transcription"},
        },
        "held_defaults": [
            {"parameter": "ROUT", "value": base["ROUT"], "unit": "ohm", "reason": "held compact OTA output-resistance approximation"},
            {"parameter": "RBUF", "value": base["RBUF"], "unit": "ohm", "reason": "held compact Darlington-buffer resistance"},
        ],
        "optimizer": {"status": int(fit.status), "nfev": int(fit.nfev), "diff_step": 1e-4},
        "residuals": rows,
        "worst_relative_error": {"value": worst["relative_error"], "quantity": worst["quantity"]},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("facts")
    parser.add_argument("output")
    args = parser.parse_args()
    facts = json.loads(Path(args.facts).read_text())
    variant = facts["specialty_variant"]
    if variant == "lm386_audio_power_amp":
        output = fit_lm386(facts)
    elif variant == "lm13700_dual_ota":
        output = fit_ota(facts)
    else:
        raise SystemExit(f"Unsupported specialty variant: {variant}")
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
