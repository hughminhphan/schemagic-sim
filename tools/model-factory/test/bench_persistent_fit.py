#!/usr/bin/env python3
"""Benchmark and equivalence check for the batched ngspice evaluation path.

Fits one diode, one BJT and one MOSFET from the fixtures in test/fixtures/bench,
twice: once with OC_FIT_BATCHED_JACOBIAN=0 (the historical path, one ngspice
process per residual evaluation) and once with the batched Jacobian.

The run FAILS unless, for every family, the two paths agree on:
  - every fitted parameter, to 1e-9 relative, and
  - the emitted fitted.json byte-for-byte.

The second check is the stronger one and is the property that matters: a package's
recorded provenance must not depend on how the machine that fitted it chose to
schedule its simulator calls.

    tools/model-factory/.venv/bin/python test/bench_persistent_fit.py
    tools/model-factory/.venv/bin/python test/bench_persistent_fit.py --json out.json
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
FACTORY = HERE.parent
FITTER = FACTORY / "python" / "fit_conveyor.py"
FIXTURES = HERE / "fixtures" / "bench"
PYTHON = sys.executable

FAMILIES = [
    ("diode", "diode-payload.json"),
    ("bjt", "bjt-payload.json"),
    ("mosfet", "mosfet-payload.json"),
]

RELATIVE_TOLERANCE = 1e-9


def run_once(payload_path, batched):
    environment = dict(os.environ)
    environment["OC_FIT_BATCHED_JACOBIAN"] = "1" if batched else "0"
    with tempfile.TemporaryDirectory(prefix="bench-fit-") as directory:
        output = Path(directory) / "fitted.json"
        started = time.perf_counter()
        completed = subprocess.run(
            [PYTHON, str(FITTER), str(payload_path), str(output)],
            cwd=str(FACTORY / "python"), env=environment,
            capture_output=True, text=True, timeout=1800,
        )
        elapsed = time.perf_counter() - started
        if completed.returncode != 0:
            raise SystemExit(f"fit_conveyor.py failed:\n{completed.stdout}\n{completed.stderr}")
        return elapsed, output.read_text(), completed.stderr.strip()


def parameter_disagreements(old, new):
    old_parameters = (json.loads(old).get("parameters") or {})
    new_parameters = (json.loads(new).get("parameters") or {})
    problems = []
    if set(old_parameters) != set(new_parameters):
        problems.append(f"parameter sets differ: {sorted(set(old_parameters) ^ set(new_parameters))}")
    for name in sorted(set(old_parameters) & set(new_parameters)):
        before, after = float(old_parameters[name]), float(new_parameters[name])
        scale = max(abs(before), 1e-300)
        relative = abs(after - before) / scale
        if relative > RELATIVE_TOLERANCE:
            problems.append(f"{name}: {before!r} -> {after!r} (relative {relative:.3e})")
    return problems, len(old_parameters)


INVOCATIONS = re.compile(r"\] (?:un)?batched: (\d+) ngspice invocations")
EVALUATIONS = re.compile(r"for (\d+) residual evaluations")


def invocations(stderr):
    """(ngspice process launches, residual evaluations) as reported by the fitter."""
    launches = None
    evaluations = None
    for line in stderr.splitlines():
        found = INVOCATIONS.search(line)
        if found:
            launches = int(found.group(1))
        found = EVALUATIONS.search(line)
        if found:
            evaluations = int(found.group(1))
    if launches is None:
        return None, None
    return launches, evaluations if evaluations is not None else launches


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", dest="json_out", default=None, help="write the report as JSON")
    parser.add_argument("--repeats", type=int, default=1, help="time each path this many times, keep the fastest")
    arguments = parser.parse_args()

    rows = []
    failures = []
    for family, fixture in FAMILIES:
        payload = FIXTURES / fixture
        if not payload.exists():
            raise SystemExit(f"missing benchmark fixture {payload}")
        old_time, old_json, old_note = min(
            (run_once(payload, batched=False) for _ in range(arguments.repeats)), key=lambda item: item[0])
        new_time, new_json, new_note = min(
            (run_once(payload, batched=True) for _ in range(arguments.repeats)), key=lambda item: item[0])

        # An equivalence check that passes because BOTH paths failed identically is
        # worse than useless. Require that the optimiser actually ran and measured
        # residuals through ngspice. A gate demotion is a legitimate outcome for a
        # synthetic fixture and is reported, not failed; an absent parameter set is not.
        fidelities = []
        for label, produced in (("unbatched", old_json), ("batched", new_json)):
            document = json.loads(produced)
            fidelities.append(document.get("fidelity"))
            if not document.get("parameters") or not document.get("residuals"):
                failures.append(f"{family}: the {label} path produced no fit at all "
                                f"({document.get('demotion_reason') or 'no reason recorded'})")
        problems, parameter_count = parameter_disagreements(old_json, new_json)
        identical = old_json == new_json
        if problems:
            failures.append(f"{family}: fitted parameters disagree beyond {RELATIVE_TOLERANCE:g} relative: "
                            + "; ".join(problems))
        elif not identical:
            failures.append(f"{family}: parameters agree but fitted.json is not byte-identical; "
                            "a recorded artefact must not depend on the evaluation path")
        old_launches, old_evaluations = invocations(old_note)
        new_launches, new_evaluations = invocations(new_note)
        rows.append({
            "family": family,
            "fidelity": fidelities[0],
            "parameters": parameter_count,
            "unbatched_seconds": round(old_time, 3),
            "batched_seconds": round(new_time, 3),
            "speedup": round(old_time / new_time, 2) if new_time > 0 else None,
            "byte_identical_fitted_json": identical,
            "unbatched_ngspice_launches": old_launches,
            "batched_ngspice_launches": new_launches,
            "residual_evaluations": new_evaluations,
            "launch_reduction": (round(new_evaluations / new_launches, 2)
                                 if new_launches else None),
        })

    width = max(len(row["family"]) for row in rows)
    header = (f"{'family'.ljust(width)}  {'tier':>4}  {'unbatched':>10}  {'batched':>10}  {'speedup':>8}  "
              f"{'identical':>9}  {'evals':>6}  {'launches':>8}  {'per launch':>10}")
    print(header)
    for row in rows:
        launches = row["batched_ngspice_launches"]
        print(f"{row['family'].ljust(width)}  {str(row['fidelity']):>4}  {row['unbatched_seconds']:>9.3f}s  {row['batched_seconds']:>9.3f}s  "
              f"{(row['speedup'] or 0):>7.2f}x  {str(row['byte_identical_fitted_json']):>9}  "
              f"{(row['residual_evaluations'] if launches else 0):>6}  {(launches or 0):>8}  "
              f"{(row['launch_reduction'] or 0):>9.2f}x")
    print("\nThe diode F2 residual is closed-form: no ngspice runs inside its optimiser loop,")
    print("so its 'speedup' is process noise and its launch count is not reported.")

    if arguments.json_out:
        Path(arguments.json_out).write_text(json.dumps({"tolerance": RELATIVE_TOLERANCE, "results": rows}, indent=2) + "\n")

    if failures:
        print("\nFAIL")
        for failure in failures:
            print(f"  {failure}")
        return 1
    print("\nPASS: both paths produce byte-identical fitted.json for every family")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
