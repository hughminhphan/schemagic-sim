#!/usr/bin/env python3
"""Batched residual evaluation for scipy.optimize.least_squares.

Why not a long-lived ngspice process
------------------------------------
The obvious fix for "one ngspice subprocess per residual evaluation" is a single
interactive ngspice that sources deck after deck. That is not available on the
ngspice-46 builds this factory runs against. Both interactive entry points fail
before reading a single command:

    $ printf 'source deck.cir\\nquit\\n' | ngspice -p
    ERROR: (external)  no graphics interface; ...
    Segmentation fault: 11
    $ printf 'source deck.cir\\nquit\\n' | ngspice -i
    ERROR: (external)  no graphics interface; ...

The Homebrew ngspice-46 binary is built without a display interface, and both -p
and -i initialise one unconditionally. Driving that would mean depending on a
different ngspice build than the one the packages were validated against, which
is exactly the substitution the binary resolution in native_ngspice refuses to
make silently. So this module takes the other route the design allows: batched
multi-point decks.

What is batched
---------------
The residual functions already put every evidence row of one parameter vector in
a single deck. What was still one process per call is the finite-difference
Jacobian: with n fitted parameters, scipy's '2-point' scheme evaluates the
residual at n additional points per iteration, each in its own ngspice process.

This module evaluates a parameter vector together with the n neighbours scipy is
about to ask for, in ONE ngspice process, and serves the neighbours from a cache.
Per iteration that is one process instead of n + 1.

The decks themselves are NOT merged. native_ngspice.run_ngspice_batch writes each
deck unchanged and has a control-block driver source, run and write them one after
another, so every deck still gets its own circuit and its own matrix. Merging the
parameter sets into a single netlist was tried first and rejected: independent
blocks then share one global convergence test, which moved sub-threshold currents
by up to 4e-5 relative and steered the MOSFET fit to visibly different parameters.
Separate decks in a shared process are bit-identical to separate processes.

Why the result is identical, not merely close
---------------------------------------------
The Jacobian is not reimplemented. `jac` calls scipy's own `approx_derivative`
with the same `rel_step`, `f0` and `bounds` that `least_squares` would have used,
over a cached residual. Every value approx_derivative sees is the value the
unbatched run would have computed, so the returned Jacobian is bit-identical and
the optimiser follows the same trajectory. The speculative neighbour prediction
uses scipy's own `_compute_absolute_step` and `_adjust_scheme_to_bounds`; if a
prediction ever misses, the cache falls through to a single-point evaluation and
the answer is still exact, just slower.

Set OC_FIT_BATCHED_JACOBIAN=0 to take the unbatched path (used by the benchmark
to prove the two agree).
"""
import os

import numpy as np
from scipy.optimize import least_squares

try:
    from scipy.optimize._numdiff import (
        _adjust_scheme_to_bounds,
        _compute_absolute_step,
        approx_derivative,
    )
    _SCIPY_INTERNALS = True
except ImportError:  # pragma: no cover - only on an unpinned scipy
    _SCIPY_INTERNALS = False

# Bounded so a long fit cannot grow without limit. The entries jac needs are always
# the newest, because least_squares evaluates fun(x) immediately before jac(x).
_CACHE_LIMIT = 20000
_CACHE_KEEP = 5000


def batching_enabled():
    return _SCIPY_INTERNALS and os.environ.get("OC_FIT_BATCHED_JACOBIAN", "1") != "0"


def _key(x):
    return np.asarray(x, dtype=float).tobytes()


class BatchedEvaluator:
    """Cache-backed residual/Jacobian pair over a batch-capable evaluation function.

    batch_fun(list_of_parameter_vectors) -> list of residual vectors, all evaluated
    in one simulator invocation.
    """

    def __init__(self, batch_fun, bounds, diff_step):
        self.batch_fun = batch_fun
        self.lower = np.asarray(bounds[0], dtype=float)
        self.upper = np.asarray(bounds[1], dtype=float)
        self.diff_step = diff_step
        self._cache = {}
        self.batches = 0
        self.evaluations = 0
        self.cache_misses_in_jacobian = 0

    def _store(self, points, values):
        for point, value in zip(points, values):
            self._cache[_key(point)] = np.asarray(value, dtype=float)
        if len(self._cache) > _CACHE_LIMIT:
            newest = list(self._cache.items())[-_CACHE_KEEP:]
            self._cache = dict(newest)

    def _evaluate(self, points):
        if not points:
            return
        self.batches += 1
        self.evaluations += len(points)
        self._store(points, self.batch_fun(points))

    def _neighbours(self, x):
        """The points scipy's 2-point scheme will ask for at x, in its own order."""
        step = _compute_absolute_step(self.diff_step, x, np.zeros(1, dtype=float), "2-point")
        step, _ = _adjust_scheme_to_bounds(x, step, 1, "1-sided", self.lower, self.upper)
        vectors = np.diag(step)
        return [x + vectors[index] for index in range(step.size)]

    def fun(self, x):
        x = np.asarray(x, dtype=float)
        key = _key(x)
        if key in self._cache:
            return self._cache[key]
        wanted = [x]
        seen = {key}
        for neighbour in self._neighbours(x):
            neighbour_key = _key(neighbour)
            if neighbour_key in seen or neighbour_key in self._cache:
                continue
            seen.add(neighbour_key)
            wanted.append(neighbour)
        self._evaluate(wanted)
        return self._cache[key]

    def _cached_only(self, x):
        key = _key(x)
        if key not in self._cache:
            # A prediction miss costs one extra simulator call and nothing else:
            # the value is still the exact residual at this point.
            self.cache_misses_in_jacobian += 1
            self._evaluate([np.asarray(x, dtype=float)])
        return self._cache[key]

    def jac(self, x):
        x = np.asarray(x, dtype=float)
        f0 = self.fun(x)
        return approx_derivative(
            self._cached_only, x, method="2-point", rel_step=self.diff_step,
            f0=f0, bounds=(self.lower, self.upper),
        )


def least_squares_batched(residual, batch_residual, x0, bounds, diff_step=None, **kwargs):
    """least_squares with a batched Jacobian when one is available.

    residual(x)             -> residual vector, the unbatched reference path
    batch_residual(points)  -> list of residual vectors evaluated in one deck

    Returns (result, statistics). The result is the ordinary OptimizeResult, and
    statistics record how much simulator work the batching actually saved.
    """
    if not batching_enabled() or batch_residual is None:
        result = least_squares(residual, x0=x0, bounds=bounds, diff_step=diff_step, **kwargs)
        return result, {"batched": False, "batches": None, "evaluations": int(result.nfev)}
    evaluator = BatchedEvaluator(batch_residual, bounds, diff_step)
    result = least_squares(
        evaluator.fun, x0=x0, bounds=bounds, jac=evaluator.jac, diff_step=diff_step, **kwargs
    )
    return result, {
        "batched": True,
        "batches": evaluator.batches,
        "evaluations": evaluator.evaluations,
        "cache_misses_in_jacobian": evaluator.cache_misses_in_jacobian,
    }


def resolve_cap(name, default):
    """Read an iteration cap from the environment, keeping the compiled default.

    Caps are configurable so a stubborn part can be given more room without
    editing the fitter, but the default is the number the packages were fitted
    with and is what any unattended run uses.
    """
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer, got {raw!r}") from error
    if value < 1:
        raise ValueError(f"{name} must be at least 1, got {value}")
    return value
