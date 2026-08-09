from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from conveyorlib import (ConveyorError, StateStore, cross_check, filter_library_collisions,
                         load_and_validate_extraction, run_extraction_batch, should_park_family)


def q(value, unit="V"):
    return {"value": value, "unit": unit, "conditions": "fixture at 25 C", "page_reference": "p. 2", "source_kind": "typical"}


def diode_payload():
    return {
        "schema_version": "1.0.0", "mpn": "D1", "manufacturer": "Fixture", "family": "diode",
        "datasheet_identity": {"title": "D1", "revision": "A", "pages_examined": ["p. 1", "p. 2"]},
        "usable_curves": True,
        "curves": [{"name": "Forward IV", "x_axis": {"quantity": "voltage", "unit": "V", "scale": "linear"}, "y_axis": {"quantity": "current", "unit": "A", "scale": "log"}, "test_conditions": "TA=25 C", "page_reference": "p. 2 fig. 1", "points": [{"x": .5, "y": .001}, {"x": .6, "y": .01}, {"x": .7, "y": .1}]}],
        "specs": {"variant": "signal", "forward_voltage_points": [{"current": q(.01, "A"), "voltage": q(.7)}], "reverse_current": None, "capacitance": None, "reverse_recovery": None, "breakdown_voltage": None, "breakdown_current": None},
        "extraction_notes": [], "omission_reason": None,
    }


class StateMachineTest(unittest.TestCase):
    def test_is_idempotent_resumable_and_audited(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = StateStore(Path(temporary) / "state.sqlite3")
            parts = [{"lcsc_id": "C1", "mpn": "D1", "manufacturer": "Fixture", "conveyor_family": "diode"}]
            store.seed("t", parts)
            store.seed("t", parts)
            self.assertEqual(len(store.rows("t")), 1)
            store.transition("t", "C1", "failed_datasheet_fetched", reason="HTTP 403")
            store.transition("t", "C1", "datasheet_fetched", datasheet_path="datasheets/D1.pdf")
            store.transition("t", "C1", "failed_extracted", reason="bad JSON")
            store.transition("t", "C1", "extracted", extraction_path="extractions/D1.json")
            self.assertEqual(store.get("t", "C1")["state"], "extracted")
            self.assertEqual(store.get("t", "C1")["attempts"], 2)
            self.assertEqual(store.failure_attempts("t", "C1", "datasheet_fetched"), 1)
            self.assertEqual(store.failure_attempts("t", "C1", "extracted"), 1)
            with self.assertRaises(ConveyorError):
                store.transition("t", "C1", "staged")
            transitions = store.connection.execute("SELECT count(*) FROM transitions").fetchone()[0]
            self.assertEqual(transitions, 5)
            store.close()


    def test_failed_fit_can_be_retried_to_staged(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = StateStore(Path(temporary) / "state.sqlite3")
            parts = [{"lcsc_id": "C1", "mpn": "D1", "manufacturer": "Fixture", "conveyor_family": "diode"}]
            store.seed("t", parts)
            store.transition("t", "C1", "datasheet_fetched", datasheet_path="datasheets/D1.pdf")
            store.transition("t", "C1", "extracted", extraction_path="extractions/D1.json")
            store.transition("t", "C1", "failed_fitted", reason="package validation failed")
            store.transition("t", "C1", "staged", fidelity="F1", package_path="packages/fixture/D1")
            row = store.get("t", "C1")
            self.assertEqual(row["state"], "staged")
            self.assertEqual(row["fidelity"], "F1")
            store.close()

    def test_staged_package_can_be_refreshed_without_rewinding_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = StateStore(Path(temporary) / "state.sqlite3")
            parts = [{"lcsc_id": "C1", "mpn": "D1", "manufacturer": "Fixture", "conveyor_family": "diode"}]
            store.seed("t", parts)
            store.transition("t", "C1", "datasheet_fetched", datasheet_path="datasheets/D1.pdf")
            store.transition("t", "C1", "extracted", extraction_path="extractions/D1.json")
            store.transition("t", "C1", "fitted", fidelity="F2", package_path="packages/fixture/D1")
            store.transition("t", "C1", "staged", fidelity="F2", package_path="packages/fixture/D1")
            store.transition("t", "C1", "staged", reason="package contract regenerated", fidelity="F1", package_path="packages/fixture/D1")
            row = store.get("t", "C1")
            self.assertEqual(row["state"], "staged")
            self.assertEqual(row["fidelity"], "F1")
            self.assertEqual(row["reason"], "package contract regenerated")
            self.assertEqual(store.connection.execute("SELECT count(*) FROM transitions WHERE to_state = 'staged'").fetchone()[0], 2)
            store.close()


class SchemaValidationTest(unittest.TestCase):
    def test_accepts_strict_payload_and_rejects_unknown_fields(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "result.json"
            payload = diode_payload()
            path.write_text(json.dumps(payload))
            result = load_and_validate_extraction(path, HERE / "schemas/diode.schema.json", {"mpn": "D1", "manufacturer": "Fixture", "family": "diode"})
            self.assertTrue(result["usable_curves"])
            payload["invented"] = 1
            path.write_text(json.dumps(payload))
            with self.assertRaisesRegex(ConveyorError, "unknown keys"):
                load_and_validate_extraction(path, HERE / "schemas/diode.schema.json", {"mpn": "D1", "manufacturer": "Fixture", "family": "diode"})


class LibraryCollisionTest(unittest.TestCase):
    def test_skips_normalized_canonical_and_alias_collisions_with_reasons(self):
        with tempfile.TemporaryDirectory() as temporary:
            library = Path(temporary) / "models"
            package = library / "onsemi" / "BAV99"
            package.mkdir(parents=True)
            (package / "component.json").write_text(json.dumps({
                "canonical_mpn": "BAV99",
                "ordering_code_aliases": ["BAV99LT1G", "MMBT2222ALT1G"],
            }))
            parts = [
                {"lcsc_id": "C1", "mpn": "BAV99,215", "manufacturer": "Nexperia"},
                {"lcsc_id": "C2", "mpn": "MMBT2222ALT1G", "manufacturer": "onsemi"},
                {"lcsc_id": "C3", "mpn": "BAS316,115", "manufacturer": "Nexperia"},
            ]
            eligible, skipped = filter_library_collisions(parts, library)
            self.assertEqual([part["lcsc_id"] for part in eligible], ["C3"])
            self.assertEqual([item["lcsc_id"] for item in skipped], ["C1", "C2"])
            self.assertTrue(all("onsemi/BAV99" in item["reason"] for item in skipped))


class CrossCheckTest(unittest.TestCase):
    def test_flags_order_of_magnitude_disagreement(self):
        payload = diode_payload()
        matching = [{"factory_target": "diode.forward_voltage", "raw_value": "0.72V@10mA"}]
        bad = [{"factory_target": "diode.forward_voltage", "raw_value": "7.2V@10mA"}]
        self.assertEqual(cross_check(payload, matching), [])
        self.assertRegex(cross_check(payload, bad)[0], "closest ratio")

    def test_ignores_test_condition_numbers_and_honors_si_prefixes(self):
        payload = {
            "family": "mosfet",
            "specs": {
                "rdson_points": [{"resistance": q(0.03, "ohm")}],
                "threshold_min": None, "threshold_typ": None, "threshold_max": None,
                "ciss": q(50e-12, "F"), "coss": None, "crss": None,
            },
        }
        self.assertEqual(cross_check(payload, [{"factory_target": "vdmos.rds_on", "raw_value": "45mΩ@2.5V,4.0A"}]), [])
        discrepancy = cross_check(payload, [{"factory_target": "vdmos.rds_on", "raw_value": "45Ω@2.5V,4.0A"}])[0]
        self.assertIn("1.5e+03x", discrepancy)
        self.assertEqual(cross_check(payload, [{"factory_target": "vdmos.ciss", "raw_value": "50pF@25V"}]), [])


    def test_one_corroborating_hint_clears_a_corrupt_duplicate(self):
        """The catalog holds the same parameter under several attribute names.

        DMP2035U-7 carries both '45Ω@2.5V,4.0A' (which lost its milli prefix) and
        '23mΩ@4.5V, 30mΩ@2.5V, 41mΩ@1.8V' for vdmos.rds_on. The extraction matches the
        second exactly, so the target is corroborated and the corrupt row must not veto it.
        """
        payload = {
            "family": "mosfet",
            "specs": {
                "rdson_points": [{"resistance": q(0.023, "ohm")}, {"resistance": q(0.03, "ohm")}, {"resistance": q(0.041, "ohm")}],
                "threshold_min": None, "threshold_typ": None, "threshold_max": None,
                "ciss": None, "coss": None, "crss": None,
            },
        }
        corrupt = {"factory_target": "vdmos.rds_on", "raw_value": "45Ω@2.5V,4.0A"}
        corroborating = {"factory_target": "vdmos.rds_on", "raw_value": "23mΩ@4.5V, 30mΩ@2.5V, 41mΩ@1.8V"}
        self.assertRegex(cross_check(payload, [corrupt])[0], "closest ratio")
        self.assertEqual(cross_check(payload, [corrupt, corroborating]), [])
        self.assertEqual(cross_check(payload, [corroborating, corrupt]), [])

    def test_a_ratio_exactly_at_the_limit_is_not_decided_by_float_representation(self):
        """DMP3098L-7's Crss ratio evaluates to 3.0000000000000004 and its Coss ratio,
        off by the identical factor, to 2.9999999999999996. The documented limit is 3.0x,
        so neither may be flagged."""
        payload = {
            "family": "mosfet",
            "specs": {
                "rdson_points": [], "threshold_min": None, "threshold_typ": None, "threshold_max": None,
                "ciss": None, "coss": q(7e-11, "F"), "crss": q(4.9e-11, "F"),
            },
        }
        self.assertEqual(1.47e-10 / 4.9e-11 > 3.0, True, "fixture must reproduce the float boundary")
        self.assertEqual(cross_check(payload, [{"factory_target": "vdmos.crss", "raw_value": "147pF"}]), [])
        self.assertEqual(cross_check(payload, [{"factory_target": "vdmos.coss", "raw_value": "210pF"}]), [])
        # A genuine disagreement beyond the limit is still reported.
        self.assertRegex(cross_check(payload, [{"factory_target": "vdmos.crss", "raw_value": "500pF"}])[0], "closest ratio")


class FamilyParkingTest(unittest.TestCase):
    def test_parks_a_family_that_never_produces_an_f2(self):
        self.assertFalse(should_park_family(successes=0, consecutive_failures=1))
        self.assertTrue(should_park_family(successes=0, consecutive_failures=2))
        self.assertTrue(should_park_family(successes=0, consecutive_failures=9))

    def test_never_parks_a_family_that_has_already_produced_an_f2(self):
        """The proving run staged 44 of 50 parts with no fit attempt because two honest
        F1s parked a family the pipeline could in fact fit."""
        for failures in range(0, 20):
            self.assertFalse(should_park_family(successes=1, consecutive_failures=failures))
        self.assertFalse(should_park_family(successes=12, consecutive_failures=6))

    def test_park_threshold_is_configurable(self):
        self.assertFalse(should_park_family(successes=0, consecutive_failures=3, park_after=4))
        self.assertTrue(should_park_family(successes=0, consecutive_failures=4, park_after=4))


class MockedLunaDispatchTest(unittest.TestCase):
    def test_hard_caps_mocked_luna_calls_at_four(self):
        lock = threading.Lock()
        active = 0
        peak = 0

        def invoke(job):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.01)
            with lock:
                active -= 1
            return {"lcsc_id": job["lcsc_id"], "json_only": True}

        jobs = [{"lcsc_id": f"C{index}"} for index in range(12)]
        results = run_extraction_batch(jobs, invoke, max_concurrency=4)
        self.assertEqual([item["lcsc_id"] for item in results], [item["lcsc_id"] for item in jobs])
        self.assertLessEqual(peak, 4)
        with self.assertRaises(ConveyorError):
            run_extraction_batch(jobs, invoke, max_concurrency=5)


if __name__ == "__main__":
    unittest.main()
