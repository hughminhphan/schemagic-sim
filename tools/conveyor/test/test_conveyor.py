from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from conveyorlib import ConveyorError, StateStore, cross_check, load_and_validate_extraction


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
            store.transition("t", "C1", "extracted", extraction_path="extractions/D1.json")
            self.assertEqual(store.get("t", "C1")["state"], "extracted")
            self.assertEqual(store.get("t", "C1")["attempts"], 1)
            with self.assertRaises(ConveyorError):
                store.transition("t", "C1", "staged")
            transitions = store.connection.execute("SELECT count(*) FROM transitions").fetchone()[0]
            self.assertEqual(transitions, 4)
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


if __name__ == "__main__":
    unittest.main()
