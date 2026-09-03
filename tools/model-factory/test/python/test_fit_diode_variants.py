"""Zener and Schottky support in the diode fitter, on synthetic curves.

Synthetic curves are generated FROM the ngspice diode equation, so the fitter has a
known right answer and the tests can say "this parameter is wrong" rather than
"this parameter changed". The Zener cases then close the loop through native
ngspice: the emitted card is simulated and must reproduce the cited Zener voltage
and dynamic impedance it was derived from.
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "python"))

import native_ngspice  # noqa: E402

FACTORY = Path(__file__).resolve().parents[2]
FITTER = FACTORY / "python" / "fit_diode.py"
LIBRARY = FACTORY.parents[1] / "packages" / "model-library" / "models"
HAVE_NGSPICE = shutil.which("ngspice") is not None or os.access(native_ngspice.HOMEBREW_NGSPICE, os.X_OK)

K_BOLTZMANN = 1.380649e-23
Q_ELECTRON = 1.602176634e-19


def thermal_voltage(temperature_c=25.0):
    return K_BOLTZMANN * (temperature_c + 273.15) / Q_ELECTRON


def cite(value, unit, conditions, source_kind="typical", page="synthetic p. 1"):
    return {"value": value, "unit": unit, "conditions": conditions,
            "page_reference": page, "source_kind": source_kind}


def forward_points(saturation, ideality, resistance, currents, temperature_c=25.0):
    """Exact points on the ngspice forward characteristic."""
    points = []
    for current in currents:
        voltage = ideality * thermal_voltage(temperature_c) * math.log1p(current / saturation) + current * resistance
        points.append({
            "current": cite(current, "A", f"IF = {current} A"),
            "voltage": cite(round(voltage, 9), "V", f"IF = {current} A", "digitized_typical_curve"),
        })
    return points


def facts_document(points, **extra):
    document = {
        "schema_version": "1.0.0",
        "extraction_method": "synthetic regression fixture",
        "fit_conditions": {"temperature": cite(25, "degC", "TA = 25 degC")},
        "fit_points": points,
    }
    document.update(extra)
    return document


def run_fitter(document):
    with tempfile.TemporaryDirectory(prefix="diode-variant-") as directory:
        facts = Path(directory) / "facts.json"
        output = Path(directory) / "fitted.json"
        facts.write_text(json.dumps(document))
        completed = subprocess.run(
            [sys.executable, str(FITTER), str(facts), str(output)],
            cwd=str(FITTER.parent), capture_output=True, text=True, timeout=300)
        if completed.returncode != 0:
            raise AssertionError(f"fit_diode.py exited {completed.returncode}:\n{completed.stdout}\n{completed.stderr}")
        return json.loads(output.read_text())


def expect_refusal(document):
    with tempfile.TemporaryDirectory(prefix="diode-variant-") as directory:
        facts = Path(directory) / "facts.json"
        output = Path(directory) / "fitted.json"
        facts.write_text(json.dumps(document))
        completed = subprocess.run(
            [sys.executable, str(FITTER), str(facts), str(output)],
            cwd=str(FITTER.parent), capture_output=True, text=True, timeout=300)
        if completed.returncode == 0:
            raise AssertionError(f"fit_diode.py accepted evidence it should have refused:\n{output.read_text()}")
        return completed.stderr


SILICON = dict(saturation=1e-13, ideality=1.2, resistance=0.1)
SILICON_CURRENTS = [1e-4, 1e-3, 1e-2, 1e-1]
# A Schottky: much larger saturation current, ideality just above 1, low bulk resistance.
SCHOTTKY = dict(saturation=2e-6, ideality=1.05, resistance=0.02)
SCHOTTKY_CURRENTS = [1e-3, 1e-2, 1e-1, 1.0, 3.0]


class ForwardFitTest(unittest.TestCase):
    def test_a_synthetic_silicon_curve_recovers_its_own_parameters(self):
        fitted = run_fitter(facts_document(forward_points(currents=SILICON_CURRENTS, **SILICON)))
        self.assertAlmostEqual(fitted["parameters"]["N"], SILICON["ideality"], places=3)
        self.assertAlmostEqual(fitted["parameters"]["RS"], SILICON["resistance"], places=3)
        self.assertLess(abs(fitted["parameters"]["IS"] / SILICON["saturation"] - 1), 0.05)
        self.assertNotIn("bound_saturation", fitted)
        self.assertNotIn("diode_variant", fitted)


class SchottkyTest(unittest.TestCase):
    def test_a_schottky_curve_fits_inside_the_schottky_window(self):
        fitted = run_fitter(facts_document(
            forward_points(currents=SCHOTTKY_CURRENTS, **SCHOTTKY), diode_variant="schottky"))
        self.assertEqual(fitted["diode_variant"], "schottky")
        self.assertAlmostEqual(fitted["parameters"]["N"], SCHOTTKY["ideality"], places=3)
        self.assertLess(abs(fitted["parameters"]["IS"] / SCHOTTKY["saturation"] - 1), 0.05)
        self.assertNotIn("bound_saturation", fitted)

    def test_the_schottky_floor_is_one_not_the_unphysical_zero_point_eight(self):
        fitted = run_fitter(facts_document(
            forward_points(currents=SCHOTTKY_CURRENTS, **SCHOTTKY), diode_variant="schottky"))
        self.assertEqual(fitted["variant_bounds"]["N"][0], 1.0)
        standard = run_fitter(facts_document(forward_points(currents=SCHOTTKY_CURRENTS, **SCHOTTKY)))
        self.assertNotIn("variant_bounds", standard)

    def test_a_curve_that_is_not_schottky_shaped_reports_its_bounds_instead_of_pretending(self):
        # A p-n junction curve has a saturation current far below anything a Schottky
        # barrier produces. Under Schottky bounds the optimiser parks IS on its floor and
        # pushes N to its ceiling to compensate. Neither number is then a measurement of
        # the part, and a card that presented them as one would misstate the forward drop
        # of every circuit built from it, so both are declared.
        fitted = run_fitter(facts_document(
            forward_points(saturation=1e-13, ideality=1.9, resistance=0.1, currents=SILICON_CURRENTS),
            diode_variant="schottky"))
        saturated = {note["parameter"]: note for note in fitted.get("bound_saturation", [])}
        self.assertIn("IS", saturated)
        self.assertEqual(saturated["IS"]["bound"], "lower")
        self.assertIn("N", saturated)
        self.assertEqual(saturated["N"]["bound"], "upper")
        self.assertAlmostEqual(fitted["parameters"]["N"], 2.0, places=9)
        # The residual is then large, because the model genuinely does not fit the curve.
        self.assertGreater(fitted["worst_relative_error"]["value"], 0.05)

    def test_an_unknown_variant_is_refused(self):
        stderr = expect_refusal(facts_document(
            forward_points(currents=SILICON_CURRENTS, **SILICON), diode_variant="tunnel"))
        self.assertIn("unknown diode_variant", stderr)

    def test_maximum_only_points_are_corrected_deterministically_and_strictly_inside(self):
        points = [
            {"current": cite(current, "A", "TL = 25 degC"),
             "voltage": cite(voltage, "V", "TL = 25 degC", "maximum")}
            for current, voltage in [(1, 0.39), (3, 0.525), (9.4, 0.95)]
        ]
        document = facts_document(points, diode_variant="schottky")
        first = run_fitter(document)
        second = run_fitter(document)
        self.assertEqual(first, second)
        for row in first["residuals"]:
            self.assertLess(row["fitted_voltage_v"], row["datasheet_voltage_v"])
        at_three_amps = next(row for row in first["residuals"] if row["current_a"] == 3)
        self.assertLess(at_three_amps["fitted_voltage_v"], 0.525)

    def test_a_single_maximum_bound_also_lands_strictly_inside(self):
        point = {
            "current": cite(1, "A", "TJ = 25 degC"),
            "voltage": cite(0.47, "V", "TJ = 25 degC", "maximum"),
        }
        fitted = run_fitter(facts_document([point], diode_variant="schottky"))
        self.assertEqual(fitted["fitter"], "analytic_single_bound_with_held_defaults")
        self.assertLess(fitted["residuals"][0]["fitted_voltage_v"], 0.47)


def zener_facts(vz, izt, zzt=None, points=None, **extra):
    calibration = {"vz": cite(vz, "V", f"IZT = {izt} A", page="synthetic p. 2 VZ"),
                   "izt": cite(izt, "A", "Zener test current", page="synthetic p. 2 IZT")}
    if zzt is not None:
        calibration["zzt"] = cite(zzt, "ohm", f"IZT = {izt} A", page="synthetic p. 2 ZZT")
    return facts_document(
        points if points is not None else forward_points(currents=SILICON_CURRENTS, **SILICON),
        diode_variant="zener", zener_calibration=calibration, **extra)


class ZenerDerivationTest(unittest.TestCase):
    VZ = 5.1
    IZT = 5e-3
    ZZT = 60.0

    def test_bv_ibv_and_nbv_come_from_the_cited_vz_izt_and_zzt(self):
        fitted = run_fitter(zener_facts(self.VZ, self.IZT, self.ZZT))
        resistance = fitted["parameters"]["RS"]
        self.assertAlmostEqual(fitted["parameters"]["IBV"], self.IZT, places=12)
        self.assertAlmostEqual(fitted["parameters"]["BV"], self.VZ - self.IZT * resistance, places=9)
        expected_nbv = (self.ZZT - resistance) * self.IZT / thermal_voltage()
        self.assertAlmostEqual(fitted["parameters"]["NBV"], expected_nbv, places=9)
        self.assertEqual(fitted["parameter_metadata"]["NBV"]["status"], "derived_from_cited_dynamic_impedance")
        self.assertEqual(fitted["parameter_metadata"]["BV"]["status"], "derived_from_cited_zener_voltage")

    def test_a_missing_dynamic_impedance_holds_nbv_at_one_and_says_so(self):
        fitted = run_fitter(zener_facts(self.VZ, self.IZT))
        self.assertEqual(fitted["parameters"]["NBV"], 1.0)
        self.assertEqual(fitted["parameter_metadata"]["NBV"]["status"], "held_default_no_cited_dynamic_impedance")
        held = [item for item in fitted["held_defaults"] if item["parameter"] == "NBV"]
        self.assertEqual(len(held), 1)
        self.assertIn("stiffer than any real device", held[0]["reason"])

    def test_a_dynamic_impedance_below_the_fitted_series_resistance_is_refused(self):
        # The forward curve says the bulk resistance alone is 0.1 ohm. A cited breakdown
        # impedance of 0.05 ohm cannot be true at the same time, and an NBV computed
        # from the difference would be negative.
        stderr = expect_refusal(zener_facts(self.VZ, self.IZT, 0.05))
        self.assertIn("disagree", stderr)

    def test_an_impossibly_soft_knee_is_refused_rather_than_emitted(self):
        stderr = expect_refusal(zener_facts(self.VZ, self.IZT, 1e5))
        self.assertIn("ceiling", stderr)

    def test_zener_calibration_without_a_test_current_is_refused(self):
        document = zener_facts(self.VZ, self.IZT, self.ZZT)
        del document["zener_calibration"]["izt"]
        self.assertIn("vz and izt", expect_refusal(document))

    @unittest.skipUnless(HAVE_NGSPICE, "requires native ngspice")
    def test_the_emitted_card_reproduces_the_cited_zener_point_in_ngspice(self):
        """The derivation is only worth anything if ngspice agrees with it."""
        fitted = run_fitter(zener_facts(self.VZ, self.IZT, self.ZZT))
        p = fitted["parameters"]
        probe_currents = [self.IZT, 2 * self.IZT]
        lines = [
            "Zener round trip",
            ".options reltol=1e-9 abstol=1e-18 vntol=1e-12 itl1=500",
            f".model ZFIT D(IS={p['IS']:.12e} N={p['N']:.12g} RS={p['RS']:.12g} "
            f"BV={p['BV']:.12g} IBV={p['IBV']:.12e} NBV={p['NBV']:.12g})",
            ".temp 25",
        ]
        for index, current in enumerate(probe_currents, 1):
            lines += [f"D{index} 0 k{index} ZFIT", f"I{index} 0 k{index} DC {current:.12g}",
                      f"RL{index} k{index} 0 1G"]
        lines += [".op", ".end"]
        result = native_ngspice.run_ngspice("\n".join(lines) + "\n")
        measured = [float(native_ngspice.vector(result, f"v(k{index})", f"k{index}")[0])
                    for index in range(1, len(probe_currents) + 1)]

        # The cited Zener voltage at the cited test current, to a part in a million.
        self.assertLess(abs(measured[0] - self.VZ) / self.VZ, 1e-6,
                        f"card gives {measured[0]} V at IZT, datasheet says {self.VZ} V")
        # And the cited dynamic impedance. ngspice's own thermal voltage differs from the
        # CODATA value used here in the last part in a thousand, so allow one percent.
        impedance = (measured[1] - measured[0]) / (probe_currents[1] - probe_currents[0])
        # A logarithmic knee is not straight, so compare against the model's own secant
        # between the two probe currents rather than the tangent at IZT.
        expected = (p["NBV"] * thermal_voltage() * math.log(2) / (probe_currents[1] - probe_currents[0])
                    + p["RS"])
        self.assertLess(abs(impedance - expected) / expected, 0.01,
                        f"card slope {impedance} ohm, derivation predicts {expected} ohm")


class ZenerWindowTest(unittest.TestCase):
    def _points(self, windows):
        return [{"current": cite(current, "A", "reverse Zener test current"),
                 "voltage_minimum": cite(low, "V", f"IZT = {current} A", "minimum"),
                 "voltage_maximum": cite(high, "V", f"IZT = {current} A", "maximum")}
                for current, low, high in windows]

    def test_a_card_inside_every_published_window_is_recorded_as_inside(self):
        document = zener_facts(5.1, 5e-3, 60.0,
                               zener_points=self._points([(1e-3, 4.2, 5.3), (5e-3, 4.8, 5.4), (2e-2, 5.0, 5.9)]))
        fitted = run_fitter(document)
        self.assertEqual(len(fitted["zener_window_checks"]), 3)
        self.assertTrue(all(row["inside_published_window"] for row in fitted["zener_window_checks"]))

    def test_a_card_outside_a_published_window_is_reported_not_hidden(self):
        # A soft knee (large ZZT) lifts the modelled voltage at 20 mA above the window.
        document = zener_facts(5.1, 5e-3, 60.0,
                               zener_points=self._points([(2e-2, 5.0, 5.15)]))
        fitted = run_fitter(document)
        row = fitted["zener_window_checks"][0]
        self.assertFalse(row["inside_published_window"])
        self.assertGreater(row["modelled_v"], row["published_maximum_v"])
        self.assertEqual(row["citations"], ["synthetic p. 1", "synthetic p. 1"])


class ReverseLeakageTest(unittest.TestCase):
    def test_a_model_within_the_published_leakage_maximum_is_recorded_as_within(self):
        document = facts_document(
            forward_points(currents=SILICON_CURRENTS, **SILICON),
            electrical_limits={"reverse_current_20v": cite(2.5e-8, "A", "VR = 20 V", "maximum")})
        row = run_fitter(document)["reverse_leakage_checks"][0]
        self.assertTrue(row["within_published_maximum"])
        self.assertLess(row["model_reverse_current_a"], row["published_maximum_a"])

    def test_a_model_that_leaks_more_than_the_datasheet_permits_is_reported(self):
        # A Schottky's saturation current is microamps. Held against a signal diode's
        # 25 nA leakage maximum, the card claims a part that leaks a hundred times more
        # than the datasheet allows, which would swamp any high-impedance bias network
        # built from it.
        document = facts_document(
            forward_points(currents=SCHOTTKY_CURRENTS, **SCHOTTKY),
            diode_variant="schottky",
            electrical_limits={"reverse_current_20v": cite(2.5e-8, "A", "VR = 20 V", "maximum")})
        row = run_fitter(document)["reverse_leakage_checks"][0]
        self.assertFalse(row["within_published_maximum"])
        self.assertGreater(row["model_reverse_current_a"], row["published_maximum_a"])

    def test_a_leakage_bound_beyond_the_modelled_breakdown_says_it_does_not_apply(self):
        document = zener_facts(5.1, 5e-3, 60.0,
                               electrical_limits={"reverse_current_10v": cite(1e-6, "A", "VR = 10 V", "maximum")})
        row = run_fitter(document)["reverse_leakage_checks"][0]
        self.assertIn("note", row)
        self.assertIn("breakdown conduction", row["note"])


class ShippedPackageRegressionTest(unittest.TestCase):
    """Every reviewed diode refits reproducibly from its shipped facts.

    Diagnostics may be added, but committed parameters must remain reproducible.

    The comparison is a tight relative tolerance rather than bit equality. The
    optimizer runs through platform math libraries, so the last couple of
    mantissa bits differ between the authoring machine and CI (observed spread
    is about 1e-8 relative). REFIT_RELATIVE_TOLERANCE sits far below any drift
    that would signal a real fitter change and far above that noise, so the
    regression still fails on a moved number.
    """

    REFIT_RELATIVE_TOLERANCE = 1e-6

    SHIPPED = ["vishay/1N4148", "kingbright/WP7113ID", "onsemi/SS14",
               "vishay/BAT85", "onsemi/1N5822", "onsemi/BZX84C5V1"]

    def test_every_reviewed_diode_refits_to_its_shipped_parameters(self):
        for slug in self.SHIPPED:
            package = LIBRARY / slug
            if not package.is_dir():
                self.skipTest(f"reviewed package {slug} is not present")
            with self.subTest(package=slug):
                shipped = json.loads((package / "fitted.json").read_text())
                refit = run_fitter(json.loads((package / "facts.json").read_text()))
                # The shipped WP7113ID records CJO and TT as literal zeroes; the fitter
                # has always omitted non-positive optional parameters. Compare on the
                # parameters that are actually claimed.
                claimed = {name: value for name, value in shipped["parameters"].items() if value}
                self.assertEqual(sorted(claimed), sorted(refit["parameters"]))
                for name, value in claimed.items():
                    self.assertTrue(
                        math.isclose(value, refit["parameters"][name],
                                     rel_tol=self.REFIT_RELATIVE_TOLERANCE),
                        f"{slug} {name} moved: shipped {value!r}, refit "
                        f"{refit['parameters'][name]!r}",
                    )

    @unittest.skipUnless(HAVE_NGSPICE, "requires native ngspice")
    def test_1n5822_three_amp_maximum_runs_at_25c_and_passes_natively(self):
        bench = (LIBRARY / "onsemi/1N5822/tests/forward_02.cir").read_text()
        self.assertRegex(bench, r"(?m)^\.temp 2\.5000000000e1$")
        result = native_ngspice.run_ngspice(bench)
        voltage = float(native_ngspice.vector(result, "v(anode)", "anode")[0])
        self.assertLessEqual(voltage, 0.525)


if __name__ == "__main__":
    unittest.main()
