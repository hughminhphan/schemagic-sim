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
    HttpClient,
    RateLimiter,
    download_datasheets,
    query_manifest,
    reassemble_split_zip,
    validate_manifest,
)


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
