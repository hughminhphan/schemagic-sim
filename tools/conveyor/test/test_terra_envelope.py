import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import terra_envelope


class TerraEnvelopeOrchestrationTest(unittest.TestCase):
    def test_jobs_bind_one_pdf_and_exclude_topology_parks(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data = root / "data"
            staging = data / "staging" / "tranche"
            datasheets = staging / "datasheets"
            datasheets.mkdir(parents=True)
            pdf = datasheets / "C1__M1.pdf"
            pdf.write_bytes(b"%PDF-1.4\nfixture\n")
            digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
            manifest = root / "tranche.json"
            manifest.write_text(json.dumps({"parts": [
                {"lcsc_id": "C1", "mpn": "M1", "manufacturer": "Fixture", "conveyor_family": "mosfet", "frozen_campaign_order": 1},
                {"lcsc_id": "C2", "mpn": "M2", "manufacturer": "Fixture", "conveyor_family": "mosfet", "frozen_campaign_order": 2},
            ]}))
            topology = root / "topology.json"
            topology.write_text(json.dumps({
                "denominator": 2, "eligible_for_terra_envelope": 1,
                "dispositions": [
                    {"lcsc_id": "C1", "disposition": "eligible_for_terra_envelope", "datasheet_path": "datasheets/C1__M1.pdf", "source_sha256": digest},
                    {"lcsc_id": "C2", "disposition": "topology_parked", "datasheet_path": "datasheets/C2__M2.pdf", "source_sha256": "0" * 64},
                ],
            }))
            args = type("Args", (), {"manifest": manifest, "topology": topology, "data_dir": data})
            self.assertEqual(terra_envelope.jobs_command(args), 0)
            index = json.loads((staging / "terra-envelope-jobs.json").read_text())
            self.assertEqual(index["job_count"], 1)
            self.assertEqual(index["jobs"][0]["part"]["lcsc_id"], "C1")
            job = json.loads(Path(index["jobs"][0]["job_path"]).read_text())
            self.assertEqual(job["datasheet_sha256"], digest)
            self.assertIn(str(pdf.resolve()), job["prompt"])

    def test_dispatch_is_append_only_and_single_use(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            job_path = root / "job.json"
            job_path.write_text(json.dumps({
                "kind": "opencircuit-terra-mosfet-envelope-job", "mode": "initial", "attempt": 1,
                "part": {"lcsc_id": "C1", "mpn": "M1"}, "datasheet_sha256": "a" * 64, "prompt": "one PDF",
            }))
            ledger = root / "ledger.jsonl"
            args = type("Args", (), {"job": job_path, "ledger": ledger})
            self.assertEqual(terra_envelope.dispatch_command(args), 0)
            first = ledger.read_bytes()
            with self.assertRaisesRegex(terra_envelope.ConveyorError, "already consumed"):
                terra_envelope.dispatch_command(args)
            self.assertEqual(ledger.read_bytes(), first)

    def test_missing_response_is_terminal_and_cannot_hide_a_response(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            response = root / "response.json"
            verdict = root / "verdict.json"
            job_path = root / "job.json"
            job_path.write_text(json.dumps({
                "kind": "opencircuit-terra-mosfet-envelope-job", "mode": "initial", "attempt": 1,
                "part": {"lcsc_id": "C1", "mpn": "M1"}, "datasheet_sha256": "a" * 64,
                "response_path": str(response), "verdict_path": str(verdict), "prompt": "one PDF",
            }))
            ledger = root / "ledger.jsonl"
            dispatch_args = type("Args", (), {"job": job_path, "ledger": ledger})
            terra_envelope.dispatch_command(dispatch_args)
            missing_args = type("Args", (), {"job": job_path, "ledger": ledger, "reason": "worker ended without output"})
            self.assertEqual(terra_envelope.missing_command(missing_args), 0)
            rows = terra_envelope.read_ledger(ledger)
            self.assertEqual(rows[-1]["status"], "rejected")
            with self.assertRaisesRegex(terra_envelope.ConveyorError, "terminal adjudication"):
                terra_envelope.missing_command(missing_args)


if __name__ == "__main__":
    unittest.main()
