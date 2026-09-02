"""The batched ngspice evaluation path must be exact, not merely fast.

Two properties are load-bearing:
  1. Separate decks run inside one ngspice process give bit-identical results to
     the same decks run in separate processes.
  2. The batched Jacobian is scipy's own Jacobian, so the optimiser follows the
     same trajectory and lands on the same parameters.

Property 1 is the reason the decks are NOT merged into a single netlist. A merged
netlist shares one convergence test across unrelated blocks and moves
sub-threshold currents by ~1e-5 relative, which is enough to steer a fit.
"""
import os
import shutil
import sys
import unittest
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "python"))

import batched_jacobian  # noqa: E402
import native_ngspice  # noqa: E402

HAVE_NGSPICE = shutil.which("ngspice") is not None or os.access(native_ngspice.HOMEBREW_NGSPICE, os.X_OK)

DECK = """Batch identity probe
.options reltol=1e-6 abstol=1e-15 vntol=1e-9 itl1=500
.model DFIT D(IS={saturation:.12e} N=1.8 RS=0.5)
.temp 25
D1 a1 0 DFIT
I1 0 a1 DC 0.001
RL1 a1 0 1G
.op
.end
"""


class BatchIdentityTest(unittest.TestCase):
    @unittest.skipUnless(HAVE_NGSPICE, "requires native ngspice")
    def test_one_process_gives_the_same_bits_as_many_processes(self):
        netlists = [DECK.format(saturation=1e-12 * (1 + index * 1e-3)) for index in range(6)]
        batched = native_ngspice.run_ngspice_batch(netlists)
        self.assertEqual(len(batched), len(netlists))
        for netlist, together in zip(netlists, batched):
            self.assertIsNotNone(together)
            alone = native_ngspice.run_ngspice(netlist)
            for name, values in alone["values"].items():
                self.assertEqual(values, together["values"][name], f"vector {name} moved when batched")

    @unittest.skipUnless(HAVE_NGSPICE, "requires native ngspice")
    def test_a_deck_that_produces_no_rawfile_comes_back_as_none(self):
        broken = "Broken deck\nNOT_A_CARD\n.op\n.end\n"
        results = native_ngspice.run_ngspice_batch([DECK.format(saturation=1e-12), broken])
        self.assertIsNotNone(results[0])
        self.assertIsNone(results[1])

    def test_a_single_netlist_takes_the_ordinary_path(self):
        if not HAVE_NGSPICE:
            self.skipTest("requires native ngspice")
        results = native_ngspice.run_ngspice_batch([DECK.format(saturation=1e-12)])
        self.assertEqual(len(results), 1)
        self.assertIsNotNone(results[0])

    def test_an_empty_batch_is_an_empty_result(self):
        self.assertEqual(native_ngspice.run_ngspice_batch([]), [])


class BatchedJacobianTest(unittest.TestCase):
    """A deliberately non-trivial bounded problem, fitted both ways."""

    LOWER = np.array([0.1, -3.0, 0.0])
    UPPER = np.array([5.0, 3.0, 2.0])
    TRUE = np.array([2.0, 1.25, 0.4])
    GRID = np.linspace(0.1, 4.0, 25)

    @classmethod
    def model(cls, p, x):
        return p[0] * np.exp(-p[1] * x) + p[2] * x ** 2

    @classmethod
    def target(cls):
        return cls.model(cls.TRUE, cls.GRID)

    def residual(self, p):
        return self.model(p, self.GRID) - self.target()

    def batch(self, points):
        return [self.residual(np.asarray(point, dtype=float)) for point in points]

    def test_the_batched_run_lands_on_the_same_parameters(self):
        x0 = np.array([1.0, 0.2, 1.0])
        options = dict(method="trf", x_scale="jac", diff_step=1e-3, ftol=1e-12, xtol=1e-12, max_nfev=500)
        reference = least_squares(self.residual, x0=x0, bounds=(self.LOWER, self.UPPER), **options)
        batched, stats = batched_jacobian.least_squares_batched(
            self.residual, self.batch, x0=x0, bounds=(self.LOWER, self.UPPER), **options)
        self.assertTrue(stats["batched"])
        # Bit-identical, not close: the batched path uses scipy's own approx_derivative
        # over cached values, so the two runs are the same computation.
        np.testing.assert_array_equal(reference.x, batched.x)
        # And it got there with strictly fewer simulator invocations than evaluations.
        self.assertLess(stats["batches"], stats["evaluations"])

    def test_batching_predicts_every_point_the_jacobian_needs(self):
        x0 = np.array([1.0, 0.2, 1.0])
        _, stats = batched_jacobian.least_squares_batched(
            self.residual, self.batch, x0=x0, bounds=(self.LOWER, self.UPPER),
            method="trf", x_scale="jac", diff_step=1e-3, ftol=1e-12, xtol=1e-12, max_nfev=500)
        # Every Jacobian column must have been served from the speculative batch. A miss
        # is still correct, but it means the step prediction has drifted from scipy's.
        self.assertEqual(stats["cache_misses_in_jacobian"], 0)
        self.assertGreater(stats["evaluations"], stats["batches"])

    def test_a_starting_point_on_a_bound_still_predicts_correctly(self):
        # On a bound scipy flips to a backward difference; the prediction must follow.
        x0 = np.array([0.1, -3.0, 2.0])
        _, stats = batched_jacobian.least_squares_batched(
            self.residual, self.batch, x0=x0, bounds=(self.LOWER, self.UPPER),
            method="trf", x_scale="jac", diff_step=1e-3, ftol=1e-12, xtol=1e-12, max_nfev=500)
        self.assertEqual(stats["cache_misses_in_jacobian"], 0)

    def test_disabling_batching_takes_the_reference_path(self):
        previous = os.environ.get("OC_FIT_BATCHED_JACOBIAN")
        os.environ["OC_FIT_BATCHED_JACOBIAN"] = "0"
        try:
            _, stats = batched_jacobian.least_squares_batched(
                self.residual, self.batch, x0=np.array([1.0, 0.2, 1.0]),
                bounds=(self.LOWER, self.UPPER), method="trf", x_scale="jac",
                diff_step=1e-3, ftol=1e-12, xtol=1e-12, max_nfev=500)
        finally:
            if previous is None:
                del os.environ["OC_FIT_BATCHED_JACOBIAN"]
            else:
                os.environ["OC_FIT_BATCHED_JACOBIAN"] = previous
        self.assertFalse(stats["batched"])


class IterationCapTest(unittest.TestCase):
    def test_the_compiled_default_is_used_when_nothing_is_set(self):
        os.environ.pop("OC_TEST_CAP", None)
        self.assertEqual(batched_jacobian.resolve_cap("OC_TEST_CAP", 400), 400)

    def test_an_environment_override_is_honoured(self):
        os.environ["OC_TEST_CAP"] = "17"
        try:
            self.assertEqual(batched_jacobian.resolve_cap("OC_TEST_CAP", 400), 17)
        finally:
            del os.environ["OC_TEST_CAP"]

    def test_a_nonsense_cap_is_refused_rather_than_ignored(self):
        for bad in ["zero", "0", "-5"]:
            os.environ["OC_TEST_CAP"] = bad
            try:
                with self.assertRaises(ValueError):
                    batched_jacobian.resolve_cap("OC_TEST_CAP", 400)
            finally:
                del os.environ["OC_TEST_CAP"]


class ConveyorCapTest(unittest.TestCase):
    def test_the_diode_cap_is_defensible_and_configurable(self):
        import fit_conveyor
        # scipy's own default for a three-parameter problem is 100 * n = 300. The old
        # cap was 100000, which no observed run came within two orders of magnitude of.
        self.assertEqual(fit_conveyor.DIODE_MAX_NFEV, 3000)
        self.assertGreater(fit_conveyor.DIODE_MAX_NFEV, 300)
        self.assertEqual(fit_conveyor.BJT_MAX_NFEV, 400)
        self.assertEqual(fit_conveyor.MOSFET_MAX_NFEV, 3000)


if __name__ == "__main__":
    unittest.main()


class EndToEndEquivalenceTest(unittest.TestCase):
    """The whole fitter, both ways, on a real fixture.

    The unit tests above prove the two mechanisms separately. This proves the thing
    that actually matters: fitted.json does not depend on how the simulator calls
    were scheduled.
    """

    FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "bench"
    FITTER = Path(__file__).resolve().parents[2] / "python" / "fit_conveyor.py"

    def _fit(self, fixture, batched):
        import json
        import subprocess
        import tempfile

        environment = dict(os.environ)
        environment["OC_FIT_BATCHED_JACOBIAN"] = "1" if batched else "0"
        with tempfile.TemporaryDirectory(prefix="equiv-fit-") as directory:
            output = Path(directory) / "fitted.json"
            completed = subprocess.run(
                [sys.executable, str(self.FITTER), str(self.FIXTURES / fixture), str(output)],
                cwd=str(self.FITTER.parent), env=environment,
                capture_output=True, text=True, timeout=900,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            text = output.read_text()
        document = json.loads(text)
        self.assertIsNotNone(document.get("parameters"), document.get("demotion_reason"))
        self.assertTrue(document.get("residuals"))
        return text

    @unittest.skipUnless(HAVE_NGSPICE, "requires native ngspice")
    def test_the_bjt_fit_is_byte_identical_both_ways(self):
        self.assertEqual(self._fit("bjt-payload.json", batched=False),
                         self._fit("bjt-payload.json", batched=True))

    @unittest.skipUnless(HAVE_NGSPICE, "requires native ngspice")
    def test_the_mosfet_fit_is_byte_identical_both_ways(self):
        self.assertEqual(self._fit("mosfet-payload.json", batched=False),
                         self._fit("mosfet-payload.json", batched=True))
