import os
import struct
import subprocess
import tempfile
from pathlib import Path

NGSPICE = "/opt/homebrew/bin/ngspice"
FACTORY_TMP = Path(__file__).resolve().parents[1] / "tmp" / "fit-native"


def _parse_raw(path):
    data = Path(path).read_bytes()
    marker = b"Binary:"
    at = data.index(marker)
    header = data[:at].decode("utf-8", errors="replace")
    offset = at + len(marker)
    while data[offset] in (9, 32):
        offset += 1
    if data[offset:offset + 2] == b"\r\n":
        offset += 2
    elif data[offset:offset + 1] == b"\n":
        offset += 1
    fields = {}
    lines = header.splitlines()
    variables_at = None
    for index, line in enumerate(lines):
        if line.strip().lower() == "variables:":
            variables_at = index
        elif ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip().lower()] = value.strip()
    count = int(fields["no. variables"])
    points = int(fields["no. points"])
    complex_data = "complex" in fields["flags"].lower().split()
    variables = []
    for line in lines[variables_at + 1:variables_at + 1 + count]:
        columns = line.strip().split()
        variables.append((columns[1].lower(), columns[2].lower()))
    values = {name: [] for name, _ in variables}
    cursor = offset
    for _ in range(points):
        for name, _ in variables:
            if complex_data:
                real, imag = struct.unpack_from("<dd", data, cursor)
                cursor += 16
                values[name].append(complex(real, imag))
            else:
                value = struct.unpack_from("<d", data, cursor)[0]
                cursor += 8
                values[name].append(value)
    return {
        "plot_name": fields["plotname"],
        "variables": variables,
        "values": values,
    }


def run_ngspice(netlist, timeout=30):
    FACTORY_TMP.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="eval-", dir=FACTORY_TMP) as directory:
        circuit = Path(directory) / "fit.cir"
        raw = Path(directory) / "out.raw"
        circuit.write_text(netlist)
        result = subprocess.run(
            [NGSPICE, "-b", "-r", str(raw), str(circuit)],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0 or not raw.exists():
            raise RuntimeError(f"ngspice failed: {result.stdout}\n{result.stderr}")
        return _parse_raw(raw)


def vector(result, *names):
    for name in names:
        key = name.lower()
        if key in result["values"]:
            return result["values"][key]
    available = ", ".join(result["values"].keys())
    raise KeyError(f"vectors {names} not found; available: {available}")


def crossing_frequency(frequencies, values, target=1.0):
    magnitudes = [abs(value) for value in values]
    for index in range(1, len(magnitudes)):
        if magnitudes[index - 1] >= target and magnitudes[index] <= target:
            f1, f2 = frequencies[index - 1], frequencies[index]
            m1, m2 = magnitudes[index - 1], magnitudes[index]
            if m1 == m2:
                return float(f2)
            fraction = (target - m1) / (m2 - m1)
            return float(f1 * (f2 / f1) ** fraction)
    raise RuntimeError("magnitude crossing not found")


def crossing_time(times, values, target, rising=True, after=0.0):
    for index in range(1, len(values)):
        if times[index] < after:
            continue
        a, b = float(values[index - 1]), float(values[index])
        crossed = a <= target <= b if rising else a >= target >= b
        if crossed:
            if b == a:
                return float(times[index])
            return float(times[index - 1] + (target - a) * (times[index] - times[index - 1]) / (b - a))
    raise RuntimeError(f"crossing not found for target {target}")
