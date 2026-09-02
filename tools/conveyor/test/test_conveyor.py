from __future__ import annotations

import datetime as dt
import json
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from conveyorlib import (STATE_SCHEMA_VERSION, ConveyorError, StateStore, build_subprocess_invoker,
                         cross_check, dry_run_command_lines, export_extractions,
                         filter_library_collisions, load_and_translate_mosfet_evidence_envelope,
                         load_and_validate_extraction, match_relevance_entries,
                         normalize_extraction_payload, parse_invoker_output, parse_relevance_list,
                         run_extraction_batch, should_park_family, validate_schema)

FAKE_INVOKER = Path(__file__).resolve().parent / "fixtures" / "fake-invoker.py"


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

    def test_flat_evidence_envelope_expands_to_the_strict_production_contract(self):
        envelope = {
            "schema_version": "1.0.0",
            "mpn": "M1",
            "manufacturer": "Fixture",
            "family": "mosfet",
            "datasheet_identity": {"title": "M1 datasheet", "revision": "A", "pages_examined": ["p. 2"]},
            "polarity": "n",
            "threshold": {
                "minimum_v": 1.0,
                "typical_v": 1.5,
                "maximum_v": 2.0,
                "conditions": "VDS = VGS, ID = 250 uA, TJ = 25 C",
                "page_reference": "p. 2, Electrical Characteristics, Gate threshold voltage row",
                "locator": {"page": 2, "table": "Electrical Characteristics", "row": "Gate threshold voltage"},
                "magnitude_convention": "absolute",
                "temperature": {"kind": "junction", "value_c": 25, "provenance": "table_heading"},
                "id_a": 0.00025,
                "test_mode": {"kind": "not_stated"},
            },
            "rdson_points": [{
                "vgs_v": 4.5,
                "id_a": 5.0,
                "typical_ohm": 0.0215,
                "maximum_ohm": 0.03,
                "conditions": "VGS = 4.5 V, ID = 5 A, TJ = 25 C; test mode = DC",
                "page_reference": "p. 2, Electrical Characteristics, RDS(on) row",
                "locator": {"page": 2, "table": "Electrical Characteristics", "row": "RDS(on), VGS = 4.5 V"},
                "magnitude_convention": "absolute",
                "temperature": {"kind": "junction", "value_c": 25, "provenance": "table_heading"},
                "test_mode": {"kind": "dc"},
            }],
            "extraction_notes": ["Direct table evidence only."],
            "omission_reason": "No curve coordinates extracted.",
        }
        with tempfile.TemporaryDirectory() as temporary:
            envelope_path = Path(temporary) / "envelope.json"
            envelope_path.write_text(json.dumps(envelope), encoding="utf-8")
            payload = load_and_translate_mosfet_evidence_envelope(
                envelope_path,
                HERE / "schemas/mosfet-evidence-envelope.schema.json",
                HERE / "schemas/mosfet.schema.json",
            )
            self.assertEqual(payload["specs"]["threshold_min"]["source_kind"], "minimum")
            self.assertEqual(payload["specs"]["threshold_typ"]["value"], 1.5)
            self.assertEqual(payload["specs"]["threshold_max"]["source_kind"], "maximum")
            self.assertEqual([point["resistance"]["source_kind"] for point in payload["specs"]["rdson_points"]], ["typical", "maximum"])
            strict_path = Path(temporary) / "strict.json"
            strict_path.write_text(json.dumps(payload), encoding="utf-8")
            validated = load_and_validate_extraction(
                strict_path,
                HERE / "schemas/mosfet.schema.json",
                {"mpn": "M1", "manufacturer": "Fixture", "family": "mosfet"},
            )
            self.assertEqual(validated["specs"]["threshold_min"]["condition"]["electrical"]["vds"]["relation"], "vds_equals_vgs")

            envelope["threshold"]["minimum_v"] = None
            envelope["threshold"]["typical_v"] = None
            envelope["threshold"]["maximum_v"] = None
            envelope_path.write_text(json.dumps(envelope), encoding="utf-8")
            with self.assertRaisesRegex(ConveyorError, "at least one source value"):
                load_and_translate_mosfet_evidence_envelope(
                    envelope_path,
                    HERE / "schemas/mosfet-evidence-envelope.schema.json",
                    HERE / "schemas/mosfet.schema.json",
                )

            envelope["threshold"] = None
            envelope_path.write_text(json.dumps(envelope), encoding="utf-8")
            with self.assertRaisesRegex(ConveyorError, r"threshold.*must be an object"):
                load_and_translate_mosfet_evidence_envelope(
                    envelope_path,
                    HERE / "schemas/mosfet-evidence-envelope.schema.json",
                    HERE / "schemas/mosfet.schema.json",
                )

    def test_flat_evidence_envelope_preserves_signed_p_channel_source_values(self):
        envelope = {
            "schema_version": "1.0.0",
            "mpn": "P1",
            "manufacturer": "Fixture",
            "family": "mosfet",
            "datasheet_identity": {"title": "P1 datasheet", "revision": "A", "pages_examined": ["p. 2"]},
            "polarity": "p",
            "threshold": {
                "minimum_v": -1.0,
                "typical_v": -1.5,
                "maximum_v": -2.0,
                "conditions": "VDS = VGS, ID = -250 uA, TJ = 25 C",
                "page_reference": "p. 2, Electrical Characteristics, Gate threshold voltage row",
                "locator": {"page": 2, "table": "Electrical Characteristics", "row": "Gate threshold voltage"},
                "magnitude_convention": "signed",
                "temperature": {"kind": "junction", "value_c": 25, "provenance": "table_heading"},
                "id_a": -0.00025,
                "test_mode": {"kind": "not_stated"},
            },
            "rdson_points": [{
                "vgs_v": -4.5,
                "id_a": -5.0,
                "typical_ohm": 0.0215,
                "maximum_ohm": 0.03,
                "conditions": "VGS = -4.5 V, ID = -5 A, TJ = 25 C; test mode = DC",
                "page_reference": "p. 2, Electrical Characteristics, RDS(on) row",
                "locator": {"page": 2, "table": "Electrical Characteristics", "row": "RDS(on), VGS = -4.5 V"},
                "magnitude_convention": "signed",
                "temperature": {"kind": "junction", "value_c": 25, "provenance": "table_heading"},
                "test_mode": {"kind": "dc"},
            }],
            "extraction_notes": ["Signed direct table evidence only."],
            "omission_reason": "No curve coordinates extracted.",
        }
        with tempfile.TemporaryDirectory() as temporary:
            envelope_path = Path(temporary) / "envelope.json"
            envelope_path.write_text(json.dumps(envelope), encoding="utf-8")
            payload = load_and_translate_mosfet_evidence_envelope(
                envelope_path,
                HERE / "schemas/mosfet-evidence-envelope.schema.json",
                HERE / "schemas/mosfet.schema.json",
            )
            self.assertEqual(payload["specs"]["threshold_min"]["value"], -1.0)
            self.assertEqual(payload["specs"]["threshold_min"]["condition"]["electrical"]["id"]["value_a"], 0.00025)
            self.assertEqual(payload["specs"]["rdson_points"][0]["vgs"]["value"], -4.5)
            self.assertEqual(payload["specs"]["rdson_points"][0]["vgs"]["condition"]["electrical"]["vgs"]["value_v"], 4.5)

            envelope["rdson_points"] = []
            envelope_path.write_text(json.dumps(envelope), encoding="utf-8")
            with self.assertRaisesRegex(ConveyorError, r"rdson_points.*too few items"):
                load_and_translate_mosfet_evidence_envelope(
                    envelope_path,
                    HERE / "schemas/mosfet-evidence-envelope.schema.json",
                    HERE / "schemas/mosfet.schema.json",
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


def seed_store(temporary, count=3, tranche="t"):
    store = StateStore(Path(temporary) / "state.sqlite3")
    parts = [
        {"lcsc_id": f"C{index}", "mpn": f"D{index}", "manufacturer": "Fixture", "conveyor_family": "diode"}
        for index in range(1, count + 1)
    ]
    store.seed(tranche, parts)
    return store


class SchemaMigrationTest(unittest.TestCase):
    def test_migrates_a_1_0_0_database_without_losing_rows(self):
        """Batches 1 to 9 ran on the 1.0.0 shape. The migration must be purely additive."""
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "state.sqlite3"
            legacy = sqlite3.connect(path)
            legacy.executescript("""
                CREATE TABLE parts (
                  tranche TEXT NOT NULL, lcsc_id TEXT NOT NULL, mpn TEXT NOT NULL,
                  manufacturer TEXT NOT NULL, family TEXT NOT NULL, state TEXT NOT NULL,
                  fidelity TEXT, reason TEXT, attempts INTEGER NOT NULL DEFAULT 0,
                  datasheet_path TEXT, extraction_path TEXT, package_path TEXT,
                  updated_at TEXT NOT NULL, PRIMARY KEY (tranche, lcsc_id));
                CREATE TABLE transitions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, tranche TEXT NOT NULL, lcsc_id TEXT NOT NULL,
                  from_state TEXT, to_state TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL);
                INSERT INTO parts VALUES ('t','C1','D1','Fixture','diode','staged','F2',NULL,1,
                  'datasheets/D1.pdf','extractions/D1.json','packages/fixture/D1','2026-01-01T00:00:00+00:00');
                INSERT INTO transitions (tranche, lcsc_id, from_state, to_state, created_at)
                  VALUES ('t','C1',NULL,'selected','2026-01-01T00:00:00+00:00');
            """)
            legacy.commit()
            legacy.close()

            store = StateStore(path)
            self.assertEqual(store.migration["schema_version"], STATE_SCHEMA_VERSION)
            self.assertIsNone(store.migration["previous_schema_version"])
            self.assertIn("claimed_by", store.migration["columns_added"])
            self.assertIn("wall_seconds", store.migration["columns_added"])
            row = store.get("t", "C1")
            self.assertEqual(row["state"], "staged")
            self.assertEqual(row["fidelity"], "F2")
            self.assertEqual(row["attempts"], 1)
            self.assertEqual(row["tokens_in"], 0)
            self.assertIsNone(row["claimed_by"])
            self.assertEqual(
                store.connection.execute("SELECT count(*) FROM transitions").fetchone()[0], 1
            )
            store.close()

            # Reopening is a no-op: a migration must never run twice or reset the version.
            again = StateStore(path)
            self.assertEqual(again.migration["columns_added"], [])
            self.assertEqual(again.migration["previous_schema_version"], STATE_SCHEMA_VERSION)
            again.close()


class ClaimTest(unittest.TestCase):
    def test_two_workers_cannot_hold_the_same_part(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary, count=3)
            first = store.claim("t", "worker-a", 2, 60)
            second = store.claim("t", "worker-b", 3, 60)
            self.assertEqual([row["lcsc_id"] for row in first], ["C1", "C2"])
            self.assertEqual([row["lcsc_id"] for row in second], ["C3"])
            self.assertEqual(store.claim("t", "worker-b", 3, 60), [])
            self.assertEqual(store.claim_summary("t")["active"], {"worker-a": 2, "worker-b": 1})
            store.close()

    def test_an_expired_lease_is_reclaimable_and_a_released_one_is_free(self):
        """A killed nightly session must not strand its parts until a human notices."""
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary, count=2)
            past = dt.datetime.now(dt.UTC) - dt.timedelta(hours=2)
            store.claim("t", "dead-worker", 2, 60, now=past)
            self.assertEqual(store.claim_summary("t")["expired"], 2)
            self.assertEqual(store.claim("t", "dead-worker", 2, 60, now=past), [])
            reclaimed = store.claim("t", "night-2", 2, 60)
            self.assertEqual([row["lcsc_id"] for row in reclaimed], ["C1", "C2"])
            self.assertEqual(store.claim_summary("t")["active"], {"night-2": 2})
            store.release("t", "C1")
            self.assertEqual(store.claim_summary("t")["active"], {"night-2": 1})
            self.assertEqual(store.release_worker("t", "night-2"), 1)
            self.assertEqual(store.claim_summary("t")["active"], {})
            store.close()

    def test_skipped_and_exhausted_parts_are_never_leased_again(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary, count=3)
            store.transition("t", "C1", "failed_datasheet_fetched",
                             reason="skipped: HTTP 403; no manual datasheet drop at tmp/manual-d/D1.pdf")
            for _ in range(3):
                store.transition("t", "C2", "failed_datasheet_fetched", reason="HTTP 500")
            claimed = store.claim("t", "worker", 10, 60)
            self.assertEqual([row["lcsc_id"] for row in claimed], ["C3"])
            store.close()

    def test_held_returns_only_this_worker_s_live_leases(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary, count=2)
            store.claim("t", "worker-a", 1, 60)
            store.claim("t", "worker-b", 1, 60)
            self.assertEqual([row["lcsc_id"] for row in store.held("t", "worker-a")], ["C1"])
            future = dt.datetime.now(dt.UTC) + dt.timedelta(hours=1)
            self.assertEqual(store.held("t", "worker-a", now=future), [])
            store.close()

    def test_rejects_nonsense_leases(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary)
            for arguments in ((" ", 1, 60), ("w", 0, 60), ("w", 1, 0)):
                with self.assertRaises(ConveyorError):
                    store.claim("t", *arguments)
            with self.assertRaises(ConveyorError):
                store.claim("t", "w", 1, 60, states=("banana",))
            store.close()


class CostAccountingTest(unittest.TestCase):
    def test_reports_tokens_and_wall_time_per_stage_and_per_staged_part(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary, count=2)
            store.transition("t", "C1", "datasheet_fetched", datasheet_path="datasheets/D1.pdf")
            store.record_cost("t", "C1", "extracted", tokens_in=1000, tokens_out=200,
                              wall_seconds=30.0, llm_model="opus", worker_id="night-1")
            store.record_cost("t", "C1", "extracted", tokens_in=500, tokens_out=100,
                              wall_seconds=10.0, llm_model="opus", worker_id="night-1")
            store.transition("t", "C1", "extracted", extraction_path="extractions/D1.json")
            store.transition("t", "C1", "fitted", fidelity="F2", package_path="packages/fixture/D1")
            store.record_cost("t", "C1", "fitted", wall_seconds=4.5)
            store.transition("t", "C1", "staged", fidelity="F2", package_path="packages/fixture/D1")
            store.record_cost("t", "C2", "extracted", tokens_in=900, tokens_out=50, wall_seconds=20.0)

            summary = store.cost_summary("t")
            self.assertEqual(summary["per_stage"]["extracted"]["events"], 3)
            self.assertEqual(summary["per_stage"]["extracted"]["parts"], 2)
            self.assertEqual(summary["per_stage"]["extracted"]["tokens_in"], 2400)
            self.assertEqual(summary["per_stage"]["fitted"]["wall_seconds"], 4.5)
            self.assertEqual(summary["totals"]["tokens_total"], 2750)
            self.assertEqual(summary["totals"]["parts_staged"], 1)
            # One staged part carried the whole run's cost, which is the number that decides
            # whether a night was worth its tokens.
            self.assertEqual(summary["totals"]["tokens_per_staged_part"], 2750.0)
            self.assertEqual([row["lcsc_id"] for row in summary["per_staged_part"]], ["C1"])
            self.assertEqual(summary["per_staged_part"][0]["llm_model"], "opus")
            self.assertEqual(summary["per_staged_part"][0]["wall_seconds"], 44.5)
            store.close()

    def test_rejects_a_cost_event_for_an_unknown_stage(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = seed_store(temporary, count=1)
            with self.assertRaises(ConveyorError):
                store.record_cost("t", "C1", "selected", tokens_in=1)
            store.close()


class InvokerOutputTest(unittest.TestCase):
    def test_reads_the_optional_trailing_usage_line(self):
        payload, usage = parse_invoker_output('{"mpn": "D1"}\n{"tokens_in": 10, "tokens_out": 4, "model": "opus"}\n')
        self.assertEqual(payload, {"mpn": "D1"})
        self.assertEqual((usage["tokens_in"], usage["tokens_out"], usage["llm_model"]), (10, 4, "opus"))

    def test_accepts_alternate_usage_key_spellings_and_nesting(self):
        _, usage = parse_invoker_output(
            '{"mpn": "D1"}\n{"usage": {"input_tokens": 7, "output_tokens": 3}, "duration_ms": 2500}\n'
        )
        self.assertEqual((usage["tokens_in"], usage["tokens_out"], usage["wall_seconds"]), (7, 3, 2.5))

    def test_a_single_line_extraction_is_never_eaten_as_usage(self):
        """Removing the last line must leave JSON behind, or it was the payload."""
        payload, usage = parse_invoker_output('{"model": "D1"}\n')
        self.assertEqual(payload, {"model": "D1"})
        self.assertEqual(usage["tokens_in"], 0)

    def test_strips_a_markdown_fence_and_reports_unusable_output(self):
        payload, _ = parse_invoker_output('```json\n{"mpn": "D1"}\n```\n')
        self.assertEqual(payload, {"mpn": "D1"})
        for bad in ("", "   ", "not json", "[1, 2]"):
            with self.assertRaises(ConveyorError):
                parse_invoker_output(bad)


class SubprocessInvokerTest(unittest.TestCase):
    """The real CLIs are never executed here; a fake script satisfies the same contract."""

    def _job(self, temporary, name="C1"):
        prompt_path = Path(temporary) / f"{name}.txt"
        prompt_path.write_text("extract this part\n", encoding="utf-8")
        datasheet = Path(temporary) / f"{name}.pdf"
        datasheet.write_bytes(b"%PDF-1.4 fixture")
        return {
            "lcsc_id": name, "mpn": "D1", "family": "diode",
            "datasheet_path": str(datasheet),
            "prompt_path": str(prompt_path),
            "response_path": str(Path(temporary) / f"{name}.json"),
        }

    def test_pipes_the_prompt_and_records_hashes_and_tokens(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = self._job(temporary)
            invoke = build_subprocess_invoker(f"python3 {FAKE_INVOKER}", model="fallback-model")
            result = invoke(job)
            self.assertEqual(result["status"], "invoked")
            self.assertEqual(result["returncode"], 0)
            self.assertEqual((result["tokens_in"], result["tokens_out"]), (1200, 340))
            self.assertEqual(result["llm_model"], "fake-model")
            self.assertEqual(len(result["prompt_sha256"]), 64)
            self.assertEqual(len(result["datasheet_sha256"]), 64)
            self.assertEqual(len(result["response_sha256"]), 64)
            written = json.loads(Path(job["response_path"]).read_text(encoding="utf-8"))
            self.assertEqual(written["lcsc_id"], "C1")
            self.assertEqual(written["prompt_bytes"], len("extract this part\n"))
            self.assertTrue(written["saw_datasheet"])

    def test_records_a_failure_instead_of_raising(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = self._job(temporary)
            invoke = build_subprocess_invoker(f"FAKE_INVOKER_MODE=fail python3 {FAKE_INVOKER}")
            result = invoke(job)
            self.assertEqual(result["status"], "invoke_failed")
            self.assertEqual(result["returncode"], 3)
            self.assertIn("refused", result["error"])
            self.assertFalse(Path(job["response_path"]).exists())

    def test_unparseable_output_is_a_recorded_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = self._job(temporary)
            invoke = build_subprocess_invoker(f"FAKE_INVOKER_MODE=bad-json python3 {FAKE_INVOKER}")
            result = invoke(job)
            self.assertEqual(result["status"], "invoke_failed")
            self.assertIn("not JSON", result["error"])

    def test_a_template_that_reports_no_tokens_still_yields_wall_time(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = self._job(temporary)
            invoke = build_subprocess_invoker(f"FAKE_INVOKER_MODE=no-usage python3 {FAKE_INVOKER}", model="opus")
            result = invoke(job)
            self.assertEqual(result["status"], "invoked")
            self.assertEqual((result["tokens_in"], result["tokens_out"]), (0, 0))
            self.assertEqual(result["llm_model"], "opus")
            self.assertGreater(result["wall_seconds"], 0)

    def test_runs_a_batch_under_the_concurrency_ceiling(self):
        with tempfile.TemporaryDirectory() as temporary:
            jobs = [self._job(temporary, f"C{index}") for index in range(6)]
            invoke = build_subprocess_invoker(f"python3 {FAKE_INVOKER}")
            results = run_extraction_batch(jobs, invoke, max_concurrency=4)
            self.assertEqual([item["status"] for item in results], ["invoked"] * 6)
            self.assertEqual([item["lcsc_id"] for item in results], [job["lcsc_id"] for job in jobs])

    def test_rejects_an_empty_command(self):
        with self.assertRaises(ConveyorError):
            build_subprocess_invoker("   ")

    def test_dry_run_lines_carry_the_job_environment(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = self._job(temporary)
            lines = dry_run_command_lines("invoker.sh", [job], model="opus")
            self.assertEqual(len(lines), 1)
            self.assertIn("CONVEYOR_LCSC_ID=C1", lines[0])
            self.assertIn("CONVEYOR_MODEL=opus", lines[0])
            self.assertIn(f"< {job['prompt_path']}", lines[0])


class RelevanceListTest(unittest.TestCase):
    def test_parses_optional_fields_comments_and_duplicates(self):
        entries = parse_relevance_list(
            "# header\n"
            "\n"
            "1N4148 | Diodes Incorporated | 1 | diode\n"
            "2N3904 |  | 2 | bjt  # in library\n"
            "IRF540N\n"
            "1n4148 | Someone Else | 3 | diode\n"
        )
        self.assertEqual([entry["mpn"] for entry in entries], ["1N4148", "2N3904", "IRF540N"])
        self.assertEqual(entries[0]["manufacturer"], "Diodes Incorporated")
        self.assertEqual(entries[1]["family"], "bjt")
        self.assertIsNone(entries[2]["manufacturer"])
        self.assertEqual(entries[2]["priority"], 100)

    def test_rejects_malformed_lines(self):
        for text in ("", "# only comments\n", "D1 | m | high | diode\n", "D1 | m | 1 | opamp\n",
                     "D1 | m | 1 | diode | extra\n"):
            with self.assertRaises(ConveyorError):
                parse_relevance_list(text)

    def test_the_shipped_draft_parses_and_stays_within_the_supported_families(self):
        draft = HERE / "relevance" / "top-300-draft.txt"
        entries = parse_relevance_list(draft.read_text(encoding="utf-8"))
        self.assertGreater(len(entries), 200)
        self.assertEqual({entry["family"] for entry in entries}, {"diode", "bjt", "mosfet"})
        self.assertTrue(all(1 <= entry["priority"] <= 3 for entry in entries))

    def test_matches_the_best_catalog_row_and_reports_what_the_catalog_cannot_supply(self):
        catalog = [
            {"mpn": "1N4148", "manufacturer": "Vendor A", "lcsc_id": "C1", "category": "Diodes",
             "subcategory": "Switching Diode", "description": "diode", "stock": 100, "popularity": 0,
             "datasheet_url": "https://example.invalid/a.pdf", "attributes": {}},
            {"mpn": "1N4148", "manufacturer": "Vendor B", "lcsc_id": "C2", "category": "Diodes",
             "subcategory": "Switching Diode", "description": "diode", "stock": 900, "popularity": 0,
             "datasheet_url": "https://example.invalid/b.pdf", "attributes": {}},
            {"mpn": "NOPDF", "manufacturer": "Vendor C", "lcsc_id": "C3", "category": "Diodes",
             "subcategory": "Switching Diode", "description": "diode", "stock": 900, "popularity": 9,
             "datasheet_url": "", "attributes": {}},
        ]
        entries = parse_relevance_list("NOPDF | | 1 | diode\nGHOST | | 1 | diode\n1N4148 | | 2 | diode\n")
        selected, skips = match_relevance_entries(entries, catalog)
        self.assertEqual([part["lcsc_id"] for part in selected], ["C2"])
        self.assertEqual(selected[0]["conveyor_family"], "diode")
        self.assertEqual(selected[0]["relevance"]["priority"], 2)
        self.assertEqual({skip["mpn"] for skip in skips}, {"NOPDF", "GHOST"})

    def test_priority_orders_selection_and_a_manufacturer_narrows_it(self):
        catalog = [
            {"mpn": "D1", "manufacturer": "Vendor A", "lcsc_id": "C1", "category": "Diodes",
             "description": "diode", "stock": 10, "popularity": 0,
             "datasheet_url": "https://example.invalid/a.pdf", "attributes": {}},
            {"mpn": "D1", "manufacturer": "Vendor B", "lcsc_id": "C2", "category": "Diodes",
             "description": "diode", "stock": 900, "popularity": 0,
             "datasheet_url": "https://example.invalid/b.pdf", "attributes": {}},
            {"mpn": "D2", "manufacturer": "Vendor A", "lcsc_id": "C3", "category": "Diodes",
             "description": "diode", "stock": 10, "popularity": 0,
             "datasheet_url": "https://example.invalid/c.pdf", "attributes": {}},
        ]
        entries = parse_relevance_list("D2 | | 5 | diode\nD1 | Vendor A | 1 | diode\n")
        selected, _ = match_relevance_entries(entries, catalog)
        self.assertEqual([part["lcsc_id"] for part in selected], ["C1", "C3"])


class ExtractionExportTest(unittest.TestCase):
    def test_copies_every_extraction_with_a_hashed_manifest_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temporary:
            data_dir = Path(temporary) / "data"
            for tranche in ("batch-1", "batch-2"):
                target = data_dir / "staging" / tranche / "extractions"
                target.mkdir(parents=True)
                (target / "C1__D1.json").write_text('{"mpn": "D1"}\n', encoding="utf-8")
            (data_dir / "staging" / "batch-1" / "datasheets").mkdir(parents=True)
            (data_dir / "staging" / "batch-1" / "datasheets" / "C1__D1.pdf").write_bytes(b"%PDF-")
            destination = Path(temporary) / "export"

            report = export_extractions(data_dir, destination)
            self.assertEqual((report["file_count"], report["copied"]), (2, 2))
            manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["file_count"], 2)
            self.assertEqual(len(manifest["files"][0]["sha256"]), 64)
            # Relative paths are preserved, so two tranches cannot collide on a file name.
            self.assertTrue((destination / "staging" / "batch-2" / "extractions" / "C1__D1.json").is_file())
            self.assertFalse((destination / "staging" / "batch-1" / "datasheets" / "C1__D1.pdf").exists())

            again = export_extractions(data_dir, destination)
            self.assertEqual((again["file_count"], again["copied"]), (2, 0))

    def test_refuses_a_missing_data_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ConveyorError):
                export_extractions(Path(temporary) / "absent", Path(temporary) / "export")


if __name__ == "__main__":
    unittest.main()
