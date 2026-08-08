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

from conveyorlib import ConveyorError, StateStore, cross_check, load_and_validate_extraction, run_extraction_batch


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
