from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
import urllib.request
import zipfile
from pathlib import Path

from feederlib import (
    CANNED_QUERIES,
    FeederError,
    HttpClient,
    RateLimiter,
    download_datasheets,
    query_manifest,
    reassemble_split_zip,
    sha256_file,
    validate_manifest,
    validate_pdf,
)
from freeze_scale_2k import freeze_manifest, normalized_mpn_key, reviewed_snapshot


class SplitArchiveTest(unittest.TestCase):
    @unittest.skipUnless(shutil.which("zip"), "Info-ZIP is required")
    def test_reassembles_published_archive_shape(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            payload = root / "cache.sqlite3"
            payload.write_bytes(os.urandom(200_000))
            result = subprocess.run(
                ["zip", "-q", "-s", "64k", "cache.zip", payload.name],
                cwd=root,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertTrue((root / "cache.z01").exists())
            joined = root / "cache.full.zip"
            reassemble_split_zip(root / "cache.zip", joined)
            with zipfile.ZipFile(joined) as archive:
                self.assertEqual(archive.read("cache.sqlite3"), payload.read_bytes())


class QueryManifestTest(unittest.TestCase):
    def make_db(self, path: Path) -> None:
        with sqlite3.connect(path) as connection:
            connection.executescript("""
                CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE jlc_components (
                    lcsc INTEGER PRIMARY KEY, present INTEGER, mfr TEXT, manufacturer TEXT,
                    category TEXT, subcategory TEXT, package TEXT, stock INTEGER,
                    preferred INTEGER, description TEXT, datasheet TEXT, attributes TEXT
                );
                CREATE TABLE lcsc_components (
                    lcsc INTEGER PRIMARY KEY, manufacturer TEXT, attributes TEXT
                );
            """)
            connection.executemany(
                "INSERT INTO jlc_components VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (101, "NEW-DIODE", "Fixture Semi", "Diodes", "Switching Diodes", "SOD-123", 9000, 1, "fast diode", "https://example.test/new.pdf", json.dumps({"Forward Voltage (Vf)": "1V@10mA"})),
                    (102, "EXISTING", "Fixture Semi", "Diodes", "Switching Diodes", "SOD-123", 8000, 0, "existing diode", "https://example.test/old.pdf", "{}"),
                ],
            )
            connection.execute("INSERT INTO lcsc_components VALUES (101, '', ?)", (json.dumps({"Reverse Voltage": "100V"}),))

    def test_canned_query_emits_valid_manifest_and_excludes_reviewed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            db = root / "fixture.sqlite3"
            self.make_db(db)
            component = root / "library" / "fixture" / "existing" / "component.json"
            component.parent.mkdir(parents=True)
            component.write_text(json.dumps({"canonical_mpn": "EXISTING", "ordering_code_aliases": []}))
            manifest = query_manifest(
                db,
                CANNED_QUERIES["jellybean-discretes"],
                {"stock_min": 100, "category": "", "package": "SOD"},
                {"dump_date": "2026-08-08", "archive_id": "fixture"},
                root / "library",
                "jellybean-discretes",
            )
            validate_manifest(manifest)
            self.assertEqual(manifest["part_count"], 1)
            part = manifest["parts"][0]
            self.assertEqual(part["mpn"], "NEW-DIODE")
            self.assertEqual(part["lcsc_id"], "C101")
            self.assertEqual(part["attributes"]["Reverse Voltage"], "100V")
            self.assertEqual(part["seed_hints"][0]["factory_target"], "diode.forward_voltage")


class Scale2kFreezeTest(unittest.TestCase):
    feeder_root = Path(__file__).resolve().parents[1]
    repo_root = Path(__file__).resolve().parents[3]
    common_git_dir = Path(subprocess.check_output(
        ["git", "rev-parse", "--git-common-dir"], cwd=repo_root, text=True
    ).strip()).resolve()
    catalog_root = common_git_dir.parent / "tools" / "part-feeder" / "data"
    db = catalog_root / "jlcparts.sqlite3"
    dump_state = catalog_root / "dump.json"
    scale_1k = catalog_root / "manifests" / "scale-1k.json"
    manifest_path = feeder_root / "data" / "manifests" / "scale-2k.json"
    sql_path = feeder_root / "queries" / "scale-2k.sql"
    library_root = repo_root / "packages" / "model-library" / "models"
    quarantine_document = repo_root / "docs" / "batch-8-selection.json"

    @unittest.skipUnless(db.is_file() and manifest_path.is_file(), "frozen scale-2k inputs are required")
    def test_frozen_manifest_matches_sql_and_reproduces_against_frozen_database(self) -> None:
        manifest = json.loads(self.manifest_path.read_text())
        sql_text = self.sql_path.read_text()
        self.assertEqual(manifest["query"]["sql"], sql_text.strip())
        self.assertEqual(manifest["query"]["sql_file_sha256"], sha256_file(self.sql_path))
        self.assertEqual(manifest["source"]["database_sha256"], sha256_file(self.db))
        dump_state = json.loads(self.dump_state.read_text())
        scale_1k = json.loads(self.scale_1k.read_text())
        quarantine = json.loads(self.quarantine_document.read_text())[
            "independent_review_rejection_quarantine"
        ]["lcsc_ids"]
        rerun = freeze_manifest(
            db_path=self.db,
            sql_path=self.sql_path,
            dump_state=dump_state,
            scale_1k=scale_1k,
            scale_1k_file_sha256=sha256_file(self.scale_1k),
            library_root=self.library_root,
            quarantine_ids=set(quarantine),
            reviewed_commit=manifest["freeze"]["reviewed_snapshot_commit"],
            created_at=manifest["created_at"],
        )
        self.assertEqual(rerun["freeze"]["raw_row_order_sha256"], manifest["freeze"]["raw_row_order_sha256"])
        self.assertEqual(rerun["freeze"]["final_row_order_sha256"], manifest["freeze"]["final_row_order_sha256"])
        self.assertEqual(
            [(part["lcsc_id"], part["frozen_campaign_order"]) for part in rerun["parts"]],
            [(part["lcsc_id"], part["frozen_campaign_order"]) for part in manifest["parts"]],
        )

    @unittest.skipUnless(manifest_path.is_file(), "frozen scale-2k manifest is required")
    def test_frozen_rows_are_contiguous_unique_and_exclude_handled_identities(self) -> None:
        manifest = json.loads(self.manifest_path.read_text())
        scale_1k = json.loads(self.scale_1k.read_text())
        quarantine = set(json.loads(self.quarantine_document.read_text())[
            "independent_review_rejection_quarantine"
        ]["lcsc_ids"])
        handled = {part["lcsc_id"].casefold() for part in scale_1k["parts"]} | {
            value.casefold() for value in quarantine
        }
        reviewed_exact, reviewed_normalized, package_count = reviewed_snapshot(self.library_root)
        self.assertEqual(package_count, 692)
        orders = [part["frozen_campaign_order"] for part in manifest["parts"]]
        self.assertEqual(orders, list(range(370, 370 + len(orders))))
        normalized = [part["normalized_mpn"] for part in manifest["parts"]]
        self.assertEqual(len(normalized), len(set(normalized)))
        for part in manifest["parts"]:
            self.assertNotIn(part["lcsc_id"].casefold(), handled)
            self.assertNotIn(part["mpn"].strip().casefold(), reviewed_exact)
            self.assertNotIn(normalized_mpn_key(part["mpn"], part["conveyor_family"]), reviewed_normalized)

    @unittest.skipUnless(manifest_path.is_file(), "frozen scale-2k manifest is required")
    def test_frozen_sql_and_rows_exclude_digital_transistors_and_bridges(self) -> None:
        sql = self.sql_path.read_text().casefold()
        self.assertIn("j.present = 1", sql)
        self.assertIn("j.stock >= 5000", sql)
        self.assertIn("j.datasheet <> ''", sql)
        self.assertIn("digital transistor", sql)
        self.assertIn("not like '%bridge%'", sql)
        self.assertIn("order by popularity desc, stock desc, lcsc asc", sql)
        manifest = json.loads(self.manifest_path.read_text())
        self.assertEqual(manifest["query"]["family_caps"], {"bjt": 650, "diode": 1200, "mosfet": 900})
        for part in manifest["parts"]:
            classification = f"{part['category']} {part['subcategory']}".casefold()
            self.assertNotIn("digital transistor", classification)
            self.assertNotIn("bridge", classification)


class RateLimiterTest(unittest.TestCase):
    def test_waits_between_requests(self) -> None:
        now = [10.0]
        sleeps: list[float] = []

        def clock() -> float:
            return now[0]

        def sleep(seconds: float) -> None:
            sleeps.append(seconds)
            now[0] += seconds

        limiter = RateLimiter(2.0, clock=clock, sleeper=sleep)
        limiter.wait()
        limiter.wait()
        limiter.wait()
        self.assertEqual(sleeps, [0.5, 0.5])


class PdfValidationTest(unittest.TestCase):
    def test_rejects_wrong_content_type_even_with_pdf_signature(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "datasheet.pdf"
            path.write_bytes(b"%PDF-1.7\nfixture")
            with self.assertRaises(FeederError):
                validate_pdf(path, "text/html")
            self.assertFalse(path.exists())


class FakePdfClient:
    def __init__(self) -> None:
        self.calls = 0

    def download(self, url: str, destination: Path):
        self.calls += 1
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"%PDF-1.7\nfixture\n%%EOF\n")
        return {"Content-Type": "application/pdf"}


class DatasheetResumeTest(unittest.TestCase):
    def test_download_is_resumable_and_rerun_is_noop(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest_path = root / "tranche.json"
            manifest_path.write_text(json.dumps({
                "schema_version": "1.0.0",
                "kind": "opencircuit-part-tranche",
                "part_count": 1,
                "parts": [{
                    "mpn": "TEST/1",
                    "manufacturer": "Fixture Semi",
                    "lcsc_id": "C123",
                    "category": "Diodes",
                    "attributes": {},
                    "datasheet_url": "https://example.test/test.pdf",
                    "seed_hints": [],
                }],
            }))
            client = FakePdfClient()
            limiter = RateLimiter(1000)
            first = download_datasheets(manifest_path, root / "data", client=client, limiter=limiter, sleeper=lambda _: None)
            second = download_datasheets(manifest_path, root / "data", client=client, limiter=limiter, sleeper=lambda _: None)
            self.assertEqual(first["downloaded"], 1)
            self.assertEqual(second["cached"], 1)
            self.assertEqual(client.calls, 1)
            self.assertEqual(second["failed"], 0)


@unittest.skipUnless(os.environ.get("FEEDER_LIVE_SMOKE") == "1", "set FEEDER_LIVE_SMOKE=1 to enable")
class LiveSmokeTest(unittest.TestCase):
    def test_published_archive_is_reachable(self) -> None:
        request = urllib.request.Request("https://yaqwsx.github.io/jlcparts/data/cache.zip", method="HEAD")
        with urllib.request.urlopen(request, timeout=20) as response:
            self.assertEqual(response.status, 200)
            self.assertGreater(int(response.headers["Content-Length"]), 0)


if __name__ == "__main__":
    unittest.main()
