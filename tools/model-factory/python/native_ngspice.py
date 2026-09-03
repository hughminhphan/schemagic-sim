import os
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

FACTORY_TMP = Path(__file__).resolve().parents[1] / "tmp" / "fit-native"

# The historical hard-coded Homebrew path. It stays as the LAST resort so an
# unconfigured Apple-silicon developer machine keeps working, but it is no longer
# the only place the fitter will look: CI images, Linux builds and Intel Homebrew
# all install ngspice somewhere else.
HOMEBREW_NGSPICE = "/opt/homebrew/bin/ngspice"
NGSPICE_RESOLUTION_ORDER = "NGSPICE_BIN, then ngspice on PATH, then " + HOMEBREW_NGSPICE


def resolve_ngspice(environ=None):
    """Resolve the native ngspice binary.

    Order: explicit NGSPICE_BIN override, then the PATH, then the Homebrew path.
    Raises with the full search order when nothing usable is found, because a
    silent fallback to a different simulator build would change every fitted
    number without changing any recorded provenance.
    """
    environ = os.environ if environ is None else environ
    override = (environ.get("NGSPICE_BIN") or "").strip()
    if override:
        if os.path.isfile(override) and os.access(override, os.X_OK):
            return override
        raise RuntimeError(
            f"NGSPICE_BIN is set to {override!r} but that path is not an executable file. "
            f"Unset it to fall back to the search order ({NGSPICE_RESOLUTION_ORDER})."
        )
    found = shutil.which("ngspice", path=environ.get("PATH"))
    if found:
        return found
    if os.path.isfile(HOMEBREW_NGSPICE) and os.access(HOMEBREW_NGSPICE, os.X_OK):
        return HOMEBREW_NGSPICE
    raise RuntimeError(
        "No native ngspice binary was found. Searched in order: "
        f"{NGSPICE_RESOLUTION_ORDER}. Install ngspice, put it on PATH, "
        "or set NGSPICE_BIN to its absolute path."
    )


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


_RESOLVED_NGSPICE = {}


def cached_ngspice():
    """resolve_ngspice() memoized on the two environment variables that steer it.

    run_ngspice is called once per residual evaluation, so an uncached
    shutil.which would put a PATH walk in the inner optimisation loop.
    """
    key = (os.environ.get("NGSPICE_BIN", ""), os.environ.get("PATH", ""))
    if key not in _RESOLVED_NGSPICE:
        _RESOLVED_NGSPICE[key] = resolve_ngspice()
    return _RESOLVED_NGSPICE[key]


def run_ngspice(netlist, timeout=30):
    FACTORY_TMP.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="eval-", dir=FACTORY_TMP) as directory:
        circuit = Path(directory) / "fit.cir"
        raw = Path(directory) / "out.raw"
        circuit.write_text(netlist)
        result = subprocess.run(
            [cached_ngspice(), "-b", "-r", str(raw), str(circuit)],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0 or not raw.exists():
            raise RuntimeError(f"ngspice failed: {result.stdout}\n{result.stderr}")
        return _parse_raw(raw)


# When a sourced deck fails to parse or to converge, ngspice does not skip the
# following `write`: it writes whatever the current plot is, which after `destroy all`
# is its built-in table of physical constants. A rawfile therefore proves nothing on
# its own, and a constants plot must be reported as a failed deck rather than handed
# to a caller that would then look for a vector that is not there.
def _is_failed_plot(result):
    return result is not None and result.get("plot_name", "").strip().lower() == "constants"


def run_ngspice_batch(netlists, timeout=600):
    """Run several INDEPENDENT decks in one ngspice process.

    Each netlist is written unchanged and sourced by a control-block driver, so every
    deck gets its own circuit and its own matrix. That is the whole point: the numbers
    are bit-identical to running each deck in its own process, because ngspice sees
    exactly the same netlist and solves exactly the same system. Merging the decks into
    one netlist instead would share a convergence test between unrelated blocks and move
    results by ~1e-5 relative, which is enough to steer a fit somewhere else.

    Returns a list the same length as `netlists`; an entry is None when that deck
    produced no rawfile, so the caller can fall back to a single run and get the same
    error the unbatched path would have raised.
    """
    netlists = list(netlists)
    if not netlists:
        return []
    if len(netlists) == 1:
        return [run_ngspice(netlists[0], timeout=timeout)]
    FACTORY_TMP.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="batch-", dir=FACTORY_TMP) as directory:
        root = Path(directory)
        driver = ["* OpenCircuit batched probe driver", ".control"]
        for index, netlist in enumerate(netlists):
            deck = root / f"deck{index}.cir"
            deck.write_text(netlist)
            # ngspice 46 does not parse whitespace-bearing absolute arguments in
            # control commands (and treats quotes literally). The subprocess
            # already runs in this directory, so controlled basenames are both
            # portable and unambiguous.
            driver += [f"source {deck.name}", "run", f"write out{index}.raw", "destroy all"]
        driver += [".endc", ".end"]
        driver_path = root / "driver.cir"
        driver_path.write_text("\n".join(driver) + "\n")
        try:
            subprocess.run(
                [cached_ngspice(), "-b", str(driver_path)],
                cwd=directory, capture_output=True, text=True, timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return [None] * len(netlists)
        results = []
        for index in range(len(netlists)):
            raw = root / f"out{index}.raw"
            results.append(_parse_raw(raw) if raw.exists() else None)
        return [None if _is_failed_plot(result) else result for result in results]


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
            f1 = float(frequencies[index - 1].real if isinstance(frequencies[index - 1], complex) else frequencies[index - 1])
            f2 = float(frequencies[index].real if isinstance(frequencies[index], complex) else frequencies[index])
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
