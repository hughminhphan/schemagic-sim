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
                         load_and_validate_extraction, normalize_extraction_payload,
                         run_extraction_batch, should_park_family, validate_schema)


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

    def test_normalizes_quantity_annotations_and_omits_short_curves_without_invention(self):
        payload = diode_payload()
        payload["curves"].append({
            **payload["curves"][0],
            "name": "one cited point only",
            "points": [{"x": 3.6, "y": 5.0}],
        })
        payload["specs"]["capacitance"] = {
            **q(700, "pF"),
            "conversion_note": "700 pF = 7e-10 F",
        }
        normalized = normalize_extraction_payload(payload)
        self.assertEqual(len(normalized["curves"]), 1)
        self.assertEqual(normalized["specs"]["capacitance"]["value"], 700e-12)
        self.assertEqual(normalized["specs"]["capacitance"]["unit"], "F")
        self.assertNotIn("conversion_note", normalized["specs"]["capacitance"])
        self.assertRegex("\n".join(normalized["extraction_notes"]), "no points were invented")

    def test_explicit_milliohm_citation_repairs_a_mislabeled_ohm_quantity(self):
        payload = {
            "extraction_notes": [],
            "specs": {"rdson": {
                "value": 21.5, "unit": "ohm",
                "conditions": "midpoint of 19-24 mOhm range at 25 C",
                "page_reference": "p. 2", "source_kind": "typical",
            }},
        }
        normalized = normalize_extraction_payload(payload)
        self.assertAlmostEqual(normalized["specs"]["rdson"]["value"], 0.0215)
        self.assertEqual(normalized["specs"]["rdson"]["unit"], "ohm")
        self.assertRegex("\n".join(normalized["extraction_notes"]), "explicit mOhm")

    def test_explicit_milliohm_citation_does_not_rescale_an_already_si_quantity(self):
        payload = {
            "extraction_notes": [],
            "specs": {"rdson": {
                "value": 0.052, "unit": "ohm",
                "conditions": "datasheet MIN = 52 mOhm at 25 C",
                "page_reference": "p. 2", "source_kind": "minimum",
            }},
        }
        normalized = normalize_extraction_payload(payload)
        self.assertEqual(normalized["specs"]["rdson"]["value"], 0.052)
        self.assertEqual(normalized["specs"]["rdson"]["unit"], "ohm")
        self.assertNotRegex("\n".join(normalized["extraction_notes"]), "explicit mOhm")


class MosfetCriticalProvenanceTest(unittest.TestCase):
    def load_fixture(self):
        return json.loads((HERE / "test/fixtures/mosfet-critical.json").read_text(encoding="utf-8"))

    def validate(self, payload):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "result.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            return load_and_validate_extraction(
                path,
                HERE / "schemas/mosfet.schema.json",
                {"mpn": "M1", "manufacturer": "Fixture", "family": "mosfet"},
            )

    def test_accepts_complete_scalar_and_curve_locators_with_production_axis_tokens(self):
        result = self.validate(self.load_fixture())
        curve = result["curves"][0]
        self.assertEqual(curve["x_axis"]["quantity"], "VGS")
        self.assertEqual(curve["y_axis"]["quantity"], "ID")
        self.assertEqual(curve["electrical_bias"][0]["quantity"], "V_DS")
        self.assertEqual(curve["locator"]["curve_or_trace"], "VDS = 10 V transfer trace")
        self.assertEqual(result["specs"]["threshold_typ"]["condition"]["test_mode"]["kind"], "not_stated")
        self.assertNotIn("test mode", result["specs"]["threshold_typ"]["conditions"].lower())

    def test_published_schema_requires_the_runtime_direct_condition_and_locator_shapes(self):
        schema = json.loads((HERE / "schemas/mosfet.schema.json").read_text(encoding="utf-8"))
        validate_schema(self.load_fixture(), schema)

        payload = self.load_fixture()
        payload["specs"]["threshold_typ"]["condition"] = {
            "temperature": "TJ=25 C",
            "electrical_bias": "VDS=VGS, ID=25 uA",
            "test_mode": "not stated",
        }
        with self.assertRaisesRegex(ConveyorError, r"condition.*(?:missing required keys|unknown keys)"):
            validate_schema(payload, schema)

        payload = self.load_fixture()
        payload["specs"]["threshold_typ"]["locator"] = {"page": 2}
        with self.assertRaisesRegex(ConveyorError, r"locator.*missing required keys.*(?:row|table)"):
            validate_schema(payload, schema)

    def test_local_schema_references_fail_closed(self):
        with self.assertRaisesRegex(ConveyorError, "circular schema reference"):
            validate_schema(
                {},
                {"$ref": "#/$defs/loop"},
                root_schema={"$defs": {"loop": {"$ref": "#/$defs/loop"}}},
            )
        with self.assertRaisesRegex(ConveyorError, "does not resolve to an object"):
            validate_schema(
                {},
                {"$ref": "#/$defs/value"},
                root_schema={"$defs": {"value": "not-a-schema"}},
            )
        with self.assertRaisesRegex(ConveyorError, "unsupported sibling keywords"):
            validate_schema(
                {},
                {"$ref": "#/$defs/value", "type": "object"},
                root_schema={"$defs": {"value": {"type": "object"}}},
            )

    def test_rejects_missing_or_malformed_direct_scalar_conditions(self):
        payload = self.load_fixture()
        del payload["specs"]["threshold_typ"]["condition"]
        with self.assertRaisesRegex(ConveyorError, r"threshold_typ.*condition"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["specs"]["threshold_typ"]["condition"]["temperature"] = {"status": "not_stated"}
        with self.assertRaisesRegex(ConveyorError, r"temperature.*(?:stated|missing)"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["specs"]["rdson_points"][0]["vgs"]["condition"]["test_mode"] = {"kind": "not_stated"}
        with self.assertRaisesRegex(ConveyorError, r"RDS\(on\).*test_mode|test_mode.kind"):
            self.validate(payload)

    def test_rejects_direct_scalar_condition_contradictions(self):
        payload = self.load_fixture()
        payload["specs"]["rdson_points"][0]["current"]["condition"]["electrical"]["id"]["value_a"] = 4
        with self.assertRaisesRegex(ConveyorError, r"one identical direct condition"):
            self.validate(payload)

        payload = self.load_fixture()
        for field in ("vgs", "current", "resistance"):
            payload["specs"]["rdson_points"][0][field]["condition"]["polarity"] = "p"
        with self.assertRaisesRegex(ConveyorError, r"polarity must match"):
            self.validate(payload)

        payload = self.load_fixture()
        for field in ("vgs", "current", "resistance"):
            payload["specs"]["rdson_points"][0][field]["condition"]["electrical"]["id"]["value_a"] = 4
        with self.assertRaisesRegex(ConveyorError, r"current.value contradicts"):
            self.validate(payload)

    def test_rejects_signed_scalar_values_with_absolute_or_nonpositive_canonical_magnitudes(self):
        payload = self.load_fixture()
        payload["specs"]["threshold_typ"]["value"] = -1.5
        with self.assertRaisesRegex(ConveyorError, r"signed but its direct condition declares absolute"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["specs"]["rdson_points"][0]["vgs"]["value"] = -4.5
        with self.assertRaisesRegex(ConveyorError, r"signed VGS or ID values but its direct condition declares absolute"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["specs"]["threshold_typ"]["condition"]["electrical"]["id"]["value_a"] = 0
        with self.assertRaisesRegex(ConveyorError, r"positive canonical magnitude"):
            self.validate(payload)

        payload = self.load_fixture()
        for field in ("vgs", "current", "resistance"):
            payload["specs"]["rdson_points"][0][field]["condition"]["electrical"]["vgs"]["value_v"] = 0
        with self.assertRaisesRegex(ConveyorError, r"positive canonical magnitude"):
            self.validate(payload)

    def test_rejects_scalar_locator_without_page_table_and_row(self):
        payload = self.load_fixture()
        del payload["specs"]["threshold_typ"]["locator"]["row"]
        with self.assertRaisesRegex(ConveyorError, r"threshold_typ\.locator.*missing (?:required keys: )?row"):
            self.validate(payload)

    def test_rejects_curve_locator_without_page_figure_and_curve_or_trace(self):
        payload = self.load_fixture()
        del payload["curves"][0]["locator"]["curve_or_trace"]
        with self.assertRaisesRegex(ConveyorError, "curve_or_trace"):
            self.validate(payload)

    def test_rejects_non_integer_locator_page(self):
        payload = self.load_fixture()
        payload["curves"][0]["locator"]["page"] = "p. 5"
        with self.assertRaisesRegex(ConveyorError, r"locator\.page must be (?:a positive|an) integer|not of type 'integer'"):
            self.validate(payload)

    def test_rejects_missing_or_not_stated_temperature(self):
        payload = self.load_fixture()
        del payload["curves"][0]["temperature"]
        with self.assertRaisesRegex(ConveyorError, "temperature"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["temperature"]["kind"] = "not_stated"
        with self.assertRaisesRegex(ConveyorError, "temperature.kind"):
            self.validate(payload)

    def test_rejects_missing_unknown_or_duplicate_fixed_bias(self):
        payload = self.load_fixture()
        payload["curves"][0]["electrical_bias"] = []
        with self.assertRaisesRegex(ConveyorError, "electrical_bias"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["electrical_bias"][0]["quantity"] = "VGD"
        with self.assertRaisesRegex(ConveyorError, "electrical_bias"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["electrical_bias"].append(
            {"quantity": "VDS", "value": 10.0, "unit": "V"}
        )
        with self.assertRaisesRegex(ConveyorError, "duplicate or conflicting vds"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["electrical_bias"][0]["quantity"] = "VGS"
        with self.assertRaisesRegex(ConveyorError, "exactly one fixed VDS"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["electrical_bias"][0]["value"] = -10
        with self.assertRaisesRegex(ConveyorError, r"signed.*absolute magnitude"):
            self.validate(payload)

        payload["curves"][0]["magnitude_convention"] = "signed"
        self.assertEqual(self.validate(payload)["curves"][0]["electrical_bias"][0]["value"], -10)

    def test_rejects_noncanonical_temperature_provenance(self):
        payload = self.load_fixture()
        payload["curves"][0]["temperature"]["provenance"] = "TA = 25 C"
        with self.assertRaisesRegex(ConveyorError, "temperature.provenance"):
            self.validate(payload)

    def test_rejects_inverted_standard_electrical_axes(self):
        payload = self.load_fixture()
        payload["curves"][0]["x_axis"]["quantity"] = "ID"
        payload["curves"][0]["y_axis"]["quantity"] = "VGS"
        with self.assertRaisesRegex(ConveyorError, "unsupported MOSFET electrical axis pairing"):
            self.validate(payload)

    def test_rejects_magnitude_axis_suffix_or_signed_absolute_curve(self):
        payload = self.load_fixture()
        payload["curves"][0]["x_axis"]["quantity"] = "VDS magnitude"
        with self.assertRaisesRegex(ConveyorError, r"without a magnitude suffix"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["points"][0]["y"] = -1
        with self.assertRaisesRegex(ConveyorError, r"absolute contradicts signed"):
            self.validate(payload)

    def test_rejects_inverted_or_partial_descriptive_electrical_axes(self):
        payload = self.load_fixture()
        payload["curves"][0]["x_axis"]["quantity"] = "gate-source voltage"
        payload["curves"][0]["y_axis"]["quantity"] = "drain current"
        with self.assertRaisesRegex(ConveyorError, "exact VGS"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["x_axis"]["quantity"] = "drain current"
        payload["curves"][0]["y_axis"]["quantity"] = "gate source voltage"
        with self.assertRaisesRegex(ConveyorError, "exact VGS"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["x_axis"]["quantity"] = "drain current"
        payload["curves"][0]["y_axis"]["quantity"] = "capacitance"
        with self.assertRaisesRegex(ConveyorError, "exact VGS"):
            self.validate(payload)

    def test_rejects_untyped_or_incomplete_test_mode(self):
        payload = self.load_fixture()
        payload["curves"][0]["test_mode"] = "pulsed"
        with self.assertRaisesRegex(ConveyorError, "test_mode"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["test_mode"] = {"kind": "not_stated"}
        with self.assertRaisesRegex(ConveyorError, "test_mode.kind"):
            self.validate(payload)

        payload = self.load_fixture()
        payload["curves"][0]["test_mode"] = {"kind": "pulsed"}
        with self.assertRaisesRegex(ConveyorError, "pulse_width_s"):
            self.validate(payload)

    def test_rejects_pulse_metadata_on_continuous_curve(self):
        payload = self.load_fixture()
        payload["curves"][0]["test_mode"] = {"kind": "continuous", "pulse_width_s": 1e-6}
        with self.assertRaisesRegex(ConveyorError, "cannot attach pulse timing"):
            self.validate(payload)

    def test_accepts_only_the_canonical_repetition_frequency_field(self):
        payload = self.load_fixture()
        payload["curves"][0]["test_mode"] = {
            "kind": "pulsed", "pulse_width_s": 1e-6, "repetition_frequency_hz": 100,
        }
        self.assertEqual(
            self.validate(payload)["curves"][0]["test_mode"]["repetition_frequency_hz"],
            100,
        )

        payload = self.load_fixture()
        payload["curves"][0]["test_mode"] = {
            "kind": "pulsed", "pulse_width_s": 1e-6, "repetition_hz": 100,
        }
        with self.assertRaisesRegex(ConveyorError, "repetition_hz"):
            self.validate(payload)


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
