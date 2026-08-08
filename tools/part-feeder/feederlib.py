"""Local-only LCSC catalog feeder for the OpenCircuit model factory."""

from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import mmap
import os
import re
import shutil
import sqlite3
import struct
import time
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

DATA_URL = "https://yaqwsx.github.io/jlcparts/data"
SCHEMA_VERSION = "1.0.0"
USER_AGENT = "OpenCircuit-part-feeder/1.0 (+https://github.com/yaqwsx/jlcparts)"
REQUIRED_TABLES = {"jlc_components", "lcsc_components", "meta"}


class FeederError(RuntimeError):
    """A user-actionable feeder failure."""


def utc_date_from_http(value: str | None) -> str:
    if not value:
        return dt.datetime.now(dt.UTC).date().isoformat()
    parsed = dt.datetime.strptime(value, "%a, %d %b %Y %H:%M:%S %Z")
    return parsed.date().isoformat()


def json_dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def sha256_file(path: Path, block_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(block_size):
            digest.update(block)
    return digest.hexdigest()


@dataclass(frozen=True)
class RemoteFile:
    name: str
    url: str
    size: int
    etag: str
    last_modified: str


class HttpClient:
    def __init__(self, timeout: float = 60.0) -> None:
        self.timeout = timeout

    def _request(self, url: str, method: str = "GET"):
        request = urllib.request.Request(
            url,
            method=method,
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
        )
        return urllib.request.urlopen(request, timeout=self.timeout)

    def head(self, url: str) -> Mapping[str, str]:
        with self._request(url, "HEAD") as response:
            return dict(response.headers.items())

    def download(self, url: str, destination: Path) -> Mapping[str, str]:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".part")
        with self._request(url) as response, temporary.open("wb") as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
            headers = dict(response.headers.items())
        temporary.replace(destination)
        return headers


def retry(operation: Callable[[], Any], attempts: int, base_delay: float, sleeper: Callable[[float], None] = time.sleep) -> Any:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return operation()
        except (OSError, urllib.error.URLError, urllib.error.HTTPError) as error:
            last_error = error
            if attempt + 1 < attempts:
                sleeper(base_delay * (2**attempt))
    assert last_error is not None
    raise last_error


def discover_archive(client: HttpClient, base_url: str = DATA_URL) -> list[RemoteFile]:
    files: list[RemoteFile] = []
    for number in range(1, 1000):
        name = f"cache.z{number:02d}" if number <= 99 else f"cache.z{number}"
        url = f"{base_url}/{name}"
        try:
            headers = client.head(url)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                break
            raise
        files.append(_remote_file(name, url, headers))
    final_name = "cache.zip"
    final_url = f"{base_url}/{final_name}"
    files.append(_remote_file(final_name, final_url, client.head(final_url)))
    if len(files) == 1:
        raise FeederError("Published jlcparts archive has no split chunks")
    return files


def _remote_file(name: str, url: str, headers: Mapping[str, str]) -> RemoteFile:
    lowered = {key.lower(): value for key, value in headers.items()}
    try:
        size = int(lowered["content-length"])
    except (KeyError, ValueError) as error:
        raise FeederError(f"Remote file {name} has no valid Content-Length") from error
    return RemoteFile(
        name=name,
        url=url,
        size=size,
        etag=lowered.get("etag", ""),
        last_modified=lowered.get("last-modified", ""),
    )


def remote_archive_id(files: Sequence[RemoteFile]) -> str:
    # GitHub Pages can report one-second Last-Modified differences for identical
    # split chunks from different edges. The terminal cache.zip metadata identifies
    # the deployment; all segment names and sizes guard its expected archive shape.
    terminal = files[-1]
    shape = "\n".join(f"{item.name}:{item.size}" for item in files)
    material = f"{shape}\nterminal:{terminal.etag}:{terminal.last_modified}"
    return hashlib.sha256(material.encode()).hexdigest()


def download_archive(
    files: Sequence[RemoteFile],
    directory: Path,
    client: HttpClient,
    retries: int = 4,
    force: bool = False,
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    expected = {item.name for item in files}
    for stale in directory.glob("cache.z*"):
        if stale.name not in expected:
            stale.unlink()
    for item in files:
        destination = directory / item.name
        if not force and destination.exists() and destination.stat().st_size == item.size:
            continue
        retry(lambda item=item, destination=destination: client.download(item.url, destination), retries, 1.0)
        if destination.stat().st_size != item.size:
            destination.unlink(missing_ok=True)
            raise FeederError(f"Downloaded size mismatch for {item.name}")


def reassemble_split_zip(last_segment: Path, output_zip: Path) -> None:
    """Convert an Info-ZIP split archive into one ordinary ZIP file.

    The published jlcparts cache uses classic, non-ZIP64 split archives. Joining
    the bytes is not sufficient because central-directory offsets are relative
    to each segment. This patches those offsets and all disk numbers to disk 0.
    """
    prefix = last_segment.with_suffix("").name
    numbered = []
    for candidate in last_segment.parent.iterdir():
        match = re.fullmatch(re.escape(prefix) + r"\.z(\d+)", candidate.name)
        if match:
            numbered.append((int(match.group(1)), candidate))
    segments = [path for _, path in sorted(numbered)] + [last_segment]
    if len(segments) < 2 or not last_segment.is_file():
        raise FeederError("Split archive segments are incomplete")

    starts: list[int] = []
    offset = 0
    temporary = output_zip.with_suffix(output_zip.suffix + ".tmp")
    temporary.unlink(missing_ok=True)
    with temporary.open("wb") as output:
        for segment in segments:
            starts.append(offset)
            with segment.open("rb") as source:
                while block := source.read(1024 * 1024):
                    output.write(block)
                    offset += len(block)

    try:
        with temporary.open("r+b") as handle, mmap.mmap(handle.fileno(), 0) as data:
            eocd = data.rfind(b"PK\x05\x06")
            if eocd < 0 or len(data) - eocd < 22:
                raise FeederError("Split archive has no classic ZIP end record")
            _, disk, directory_disk, _, entry_count, _, directory_offset, comment_length = struct.unpack_from(
                "<4s4H2LH", data, eocd
            )
            if eocd + 22 + comment_length != len(data):
                raise FeederError("Split archive has trailing data")
            if disk >= len(starts) or directory_disk >= len(starts):
                raise FeederError("Split archive references a missing disk")

            zip64_locator = eocd - 20
            if data[zip64_locator:zip64_locator + 4] == b"PK\x06\x07":
                zip64_disk, zip64_offset, _ = struct.unpack_from("<LQL", data, zip64_locator + 4)
                if zip64_disk >= len(starts):
                    raise FeederError("ZIP64 end record references a missing disk")
                zip64_eocd = starts[zip64_disk] + zip64_offset
                if data[zip64_eocd:zip64_eocd + 4] != b"PK\x06\x06":
                    raise FeederError("ZIP64 end record is invalid")
                zip64_values = struct.unpack_from("<2H2L4Q", data, zip64_eocd + 12)
                _, _, zip64_current_disk, zip64_directory_disk, _, zip64_entries, _, zip64_directory_offset = zip64_values
                if zip64_current_disk >= len(starts) or zip64_directory_disk >= len(starts):
                    raise FeederError("ZIP64 directory references a missing disk")
                entry_count = zip64_entries
                global_directory = starts[zip64_directory_disk] + zip64_directory_offset
                struct.pack_into("<LLQQQQ", data, zip64_eocd + 16, 0, 0, entry_count, entry_count,
                                 struct.unpack_from("<Q", data, zip64_eocd + 40)[0], global_directory)
                struct.pack_into("<LQL", data, zip64_locator + 4, 0, zip64_eocd, 1)
            else:
                global_directory = starts[directory_disk] + directory_offset
            cursor = global_directory
            for _ in range(entry_count):
                if data[cursor:cursor + 4] != b"PK\x01\x02":
                    raise FeederError("Invalid central directory in split archive")
                start_disk = struct.unpack_from("<H", data, cursor + 34)[0]
                local_offset = struct.unpack_from("<L", data, cursor + 42)[0]
                if start_disk >= len(starts):
                    raise FeederError("Split archive entry references a missing disk")
                struct.pack_into("<H", data, cursor + 34, 0)
                struct.pack_into("<L", data, cursor + 42, starts[start_disk] + local_offset)
                name_length, extra_length, entry_comment_length = struct.unpack_from("<HHH", data, cursor + 28)
                cursor += 46 + name_length + extra_length + entry_comment_length
            struct.pack_into("<HHHH", data, eocd + 4, 0, 0, entry_count, entry_count)
            struct.pack_into("<L", data, eocd + 16, global_directory)
            data.flush()
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    temporary.replace(output_zip)


def extract_database(archive: Path, destination: Path) -> None:
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.unlink(missing_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        candidates = [name for name in bundle.namelist() if Path(name).name == "cache.sqlite3"]
        if len(candidates) != 1:
            raise FeederError("Archive must contain exactly one cache.sqlite3")
        with bundle.open(candidates[0]) as source, temporary.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
    validate_database(temporary)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary.replace(destination)


def validate_database(path: Path, quick_check: bool = True) -> None:
    if not path.is_file():
        raise FeederError(f"Database not found: {path}")
    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        missing = REQUIRED_TABLES - tables
        if missing:
            raise FeederError(f"Database is missing required tables: {', '.join(sorted(missing))}")
        if quick_check:
            result = connection.execute("PRAGMA quick_check").fetchone()[0]
            if result != "ok":
                raise FeederError(f"SQLite quick_check failed: {result}")


def fetch_database(data_dir: Path, refresh: bool = False, client: HttpClient | None = None) -> dict[str, Any]:
    client = client or HttpClient()
    db_path = data_dir / "jlcparts.sqlite3"
    state_path = data_dir / "dump.json"
    files = discover_archive(client)
    archive_id = remote_archive_id(files)
    existing: dict[str, Any] = {}
    if state_path.exists():
        with contextlib.suppress(json.JSONDecodeError):
            existing = json.loads(state_path.read_text(encoding="utf-8"))
    if not refresh and existing.get("archive_id") == archive_id and db_path.exists():
        validate_database(db_path, quick_check=False)
        return {**existing, "status": "current"}

    downloads = data_dir / "downloads"
    # A new publication can retain the 50 MB size of every numbered segment.
    # Redownload the complete set after an identity change to avoid mixing dumps.
    download_archive(files, downloads, client, force=True)
    joined = downloads / "cache.full.zip"
    reassemble_split_zip(downloads / "cache.zip", joined)
    extract_database(joined, db_path)
    joined.unlink(missing_ok=True)

    newest = files[-1]
    state = {
        "schema_version": SCHEMA_VERSION,
        "archive_id": archive_id,
        "dump_date": utc_date_from_http(newest.last_modified),
        "last_modified": newest.last_modified,
        "source_url": DATA_URL,
        "files": [{"name": item.name, "size": item.size, "etag": item.etag} for item in files],
        "compressed_bytes": sum(item.size for item in files),
        "database_bytes": db_path.stat().st_size,
        "database_sha256": sha256_file(db_path),
        "fetched_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
    }
    json_dump(state_path, state)
    return {**state, "status": "refreshed"}


def reviewed_mpns(library_root: Path) -> set[str]:
    result: set[str] = set()
    if not library_root.exists():
        return result
    for component_path in library_root.glob("*/*/component.json"):
        try:
            component = json.loads(component_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        mpn = component.get("canonical_mpn")
        if isinstance(mpn, str) and mpn.strip():
            result.add(mpn.casefold())
        for alias in component.get("ordering_code_aliases", []):
            if isinstance(alias, str) and alias.strip():
                result.add(alias.casefold())
    return result


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _row_value(row: sqlite3.Row, *names: str, default: Any = None) -> Any:
    keys = {key.casefold(): key for key in row.keys()}
    for name in names:
        if name.casefold() in keys:
            return row[keys[name.casefold()]]
    return default


def normalize_part(row: sqlite3.Row) -> dict[str, Any]:
    raw_lcsc = _row_value(row, "lcsc_id", "lcsc", "component_code")
    if raw_lcsc is None:
        raise FeederError("Query rows must include lcsc or lcsc_id")
    lcsc_id = str(raw_lcsc)
    if lcsc_id.isdigit():
        lcsc_id = f"C{lcsc_id}"
    mpn = str(_row_value(row, "mpn", "mfr", "manufacturer_part_number", default="")).strip()
    if not mpn:
        raise FeederError(f"Query row {lcsc_id} has no MPN (expected mpn or mfr column)")
    manufacturer = str(
        _row_value(row, "manufacturer", "lcsc_manufacturer", "brand", default="") or ""
    ).strip()
    category = str(_row_value(row, "category", default="") or "").strip()
    subcategory = str(_row_value(row, "subcategory", default="") or "").strip()
    attributes = _json_object(_row_value(row, "attributes", "jlc_attributes", default={}))
    attributes.update(_json_object(_row_value(row, "lcsc_attributes", "extra_attributes", default={})))
    package = str(_row_value(row, "package", "package_name", default="") or "").strip()
    if package and not any(key.casefold() == "package" for key in attributes):
        attributes["Package"] = package
    datasheet = str(_row_value(row, "datasheet_url", "datasheet", default="") or "").strip()
    return {
        "mpn": mpn,
        "manufacturer": manufacturer,
        "lcsc_id": lcsc_id,
        "category": category,
        "subcategory": subcategory,
        "package": package,
        "stock": int(_row_value(row, "stock", default=0) or 0),
        "popularity": int(_row_value(row, "popularity", "preferred", default=0) or 0),
        "description": str(_row_value(row, "description", default="") or ""),
        "attributes": dict(sorted(attributes.items(), key=lambda item: item[0].casefold())),
        "datasheet_url": datasheet,
    }


CANNED_QUERIES = {
    "jellybean-discretes": """
        SELECT j.lcsc, j.mfr, COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer) AS manufacturer,
               j.category, j.subcategory, j.package, j.stock, j.preferred AS popularity,
               j.description, j.datasheet, j.attributes, l.attributes AS lcsc_attributes
        FROM jlc_components AS j
        LEFT JOIN lcsc_components AS l ON l.lcsc = j.lcsc
        WHERE j.present = 1
          AND j.stock >= :stock_min
          AND j.datasheet <> ''
          AND (
            lower(j.category) LIKE '%diode%' OR lower(j.subcategory) LIKE '%diode%'
            OR lower(j.category) LIKE '%transistor%' OR lower(j.subcategory) LIKE '%transistor%'
            OR lower(j.category) LIKE '%opto%' OR lower(j.subcategory) LIKE '%led%'
          )
          AND (:category = '' OR lower(j.category) LIKE '%' || lower(:category) || '%'
               OR lower(j.subcategory) LIKE '%' || lower(:category) || '%')
          AND (:package = '' OR lower(j.package) LIKE '%' || lower(:package) || '%')
        ORDER BY j.preferred DESC, j.stock DESC, j.lcsc ASC
    """,
    "stocked-by-category": """
        SELECT j.lcsc, j.mfr, COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer) AS manufacturer,
               j.category, j.subcategory, j.package, j.stock, j.preferred AS popularity,
               j.description, j.datasheet, j.attributes, l.attributes AS lcsc_attributes
        FROM jlc_components AS j
        LEFT JOIN lcsc_components AS l ON l.lcsc = j.lcsc
        WHERE j.present = 1
          AND j.stock >= :stock_min
          AND j.datasheet <> ''
          AND (:category = '' OR lower(j.category) LIKE '%' || lower(:category) || '%'
               OR lower(j.subcategory) LIKE '%' || lower(:category) || '%')
          AND (:package = '' OR lower(j.package) LIKE '%' || lower(:package) || '%')
        ORDER BY j.preferred DESC, j.stock DESC, j.lcsc ASC
    """,
}


def ensure_select_only(sql: str) -> None:
    stripped = re.sub(r"--[^\n]*", "", sql).strip()
    if not re.match(r"^(SELECT|WITH)\b", stripped, flags=re.IGNORECASE):
        raise FeederError("Arbitrary SQL must be a SELECT or WITH query")
    if ";" in stripped.rstrip(";"):
        raise FeederError("Only one SQL statement is allowed")


def query_manifest(
    db_path: Path,
    sql: str,
    parameters: Mapping[str, Any],
    source_state: Mapping[str, Any],
    library_root: Path,
    query_name: str,
    limit: int | None = None,
    exclude_reviewed: bool = True,
) -> dict[str, Any]:
    ensure_select_only(sql)
    exclusions = reviewed_mpns(library_root) if exclude_reviewed else set()
    parts: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        for row in connection.execute(sql, dict(parameters)):
            part = normalize_part(row)
            if part["mpn"].casefold() in exclusions:
                continue
            identity = (part["mpn"].casefold(), part["lcsc_id"].casefold())
            if identity in seen:
                continue
            seen.add(identity)
            part["seed_hints"] = parametric_seed_hints(part["attributes"])
            parts.append(part)
            if limit is not None and len(parts) >= limit:
                break
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": "opencircuit-part-tranche",
        "created_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "source": {
            "provider": "jlcparts",
            "url": source_state.get("source_url", DATA_URL),
            "dump_date": source_state.get("dump_date"),
            "archive_id": source_state.get("archive_id"),
            "local_only": True,
        },
        "query": {
            "name": query_name,
            "sql": sql.strip(),
            "parameters": dict(parameters),
            "exclude_reviewed": exclude_reviewed,
            "reviewed_mpn_count": len(exclusions),
            "limit": limit,
        },
        "part_count": len(parts),
        "parts": parts,
    }


_SEED_FIELDS = {
    "vf": ("diode.forward_voltage", ("forward voltage", "vf")),
    "hfe": ("bjt.dc_current_gain", ("dc current gain", "hfe", "current gain")),
    "rdson": ("vdmos.rds_on", ("rds(on)", "rds on", "drain-source on resistance")),
    "ciss": ("vdmos.ciss", ("input capacitance", "ciss")),
    "coss": ("vdmos.coss", ("output capacitance", "coss")),
    "crss": ("vdmos.crss", ("reverse transfer capacitance", "crss")),
    "vth": ("vdmos.threshold", ("gate threshold voltage", "vgs(th)", "threshold voltage")),
}


def parametric_seed_hints(attributes: Mapping[str, Any]) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    for attribute, value in attributes.items():
        normalized = re.sub(r"[^a-z0-9]+", " ", attribute.casefold()).strip()
        for _, (target, aliases) in _SEED_FIELDS.items():
            if any(re.sub(r"[^a-z0-9]+", " ", alias.casefold()).strip() in normalized for alias in aliases):
                hints.append({
                    "factory_target": target,
                    "attribute": attribute,
                    "raw_value": value,
                    "role": "initial_guess_only",
                    "evidence": "catalog_parametric_not_datasheet_citation",
                })
                break
    return hints


def safe_stem(value: str) -> str:
    compact = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip(".-")
    return compact or "part"


class RateLimiter:
    def __init__(
        self,
        requests_per_second: float,
        clock: Callable[[], float] = time.monotonic,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        if requests_per_second <= 0:
            raise ValueError("requests_per_second must be positive")
        self.interval = 1.0 / requests_per_second
        self.clock = clock
        self.sleeper = sleeper
        self.next_allowed: float | None = None

    def wait(self) -> None:
        now = self.clock()
        if self.next_allowed is not None and now < self.next_allowed:
            self.sleeper(self.next_allowed - now)
            now = self.clock()
        self.next_allowed = now + self.interval


def validate_pdf(path: Path, content_type: str = "") -> None:
    if content_type and "pdf" not in content_type.casefold() and "octet-stream" not in content_type.casefold():
        path.unlink(missing_ok=True)
        raise FeederError(f"Unexpected datasheet Content-Type: {content_type}")
    with path.open("rb") as handle:
        signature = handle.read(5)
    if signature != b"%PDF-":
        path.unlink(missing_ok=True)
        raise FeederError("Downloaded datasheet does not have a PDF signature")


def _download_pdf(client: HttpClient, url: str, destination: Path) -> None:
    headers = client.download(url, destination)
    content_type = next((value for key, value in headers.items() if key.casefold() == "content-type"), "")
    validate_pdf(destination, content_type)


def download_datasheets(
    manifest_path: Path,
    data_dir: Path,
    requests_per_second: float = 0.5,
    retries: int = 4,
    client: HttpClient | None = None,
    limiter: RateLimiter | None = None,
    sleeper: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_manifest(manifest)
    tranche = safe_stem(manifest_path.stem)
    staging = data_dir / "staging" / tranche
    datasheet_dir = staging / "datasheets"
    datasheet_dir.mkdir(parents=True, exist_ok=True)
    client = client or HttpClient(timeout=120)
    limiter = limiter or RateLimiter(requests_per_second)
    failures: list[dict[str, str]] = []
    completed = 0
    skipped = 0
    records: list[dict[str, Any]] = []

    for part in manifest["parts"]:
        filename = f"{safe_stem(part['lcsc_id'])}__{safe_stem(part['mpn'])}.pdf"
        destination = datasheet_dir / filename
        record = {"mpn": part["mpn"], "lcsc_id": part["lcsc_id"], "path": str(destination.relative_to(staging))}
        if destination.exists():
            try:
                validate_pdf(destination)
                record.update({"status": "cached", "sha256": sha256_file(destination), "bytes": destination.stat().st_size})
                records.append(record)
                skipped += 1
                continue
            except FeederError:
                destination.unlink(missing_ok=True)
        url = part["datasheet_url"]
        if not url.lower().startswith(("https://", "http://")) or re.search(r"\.(?:lib|cir)(?:$|[?#])", url, re.IGNORECASE):
            failures.append({"mpn": part["mpn"], "lcsc_id": part["lcsc_id"], "url": url, "error": "missing or prohibited datasheet URL"})
            record["status"] = "failed"
            records.append(record)
            continue
        error_text = ""
        for attempt in range(retries):
            limiter.wait()
            try:
                _download_pdf(client, url, destination)
                record.update({"status": "downloaded", "sha256": sha256_file(destination), "bytes": destination.stat().st_size})
                records.append(record)
                completed += 1
                break
            except (OSError, urllib.error.URLError, urllib.error.HTTPError, FeederError) as error:
                destination.unlink(missing_ok=True)
                error_text = str(error)
                if attempt + 1 < retries:
                    sleeper(2**attempt)
        else:
            failures.append({"mpn": part["mpn"], "lcsc_id": part["lcsc_id"], "url": url, "error": error_text})
            record["status"] = "failed"
            records.append(record)

    staged_manifest = {**manifest, "datasheets": records, "staging_status": "unreviewed"}
    json_dump(staging / "manifest.json", staged_manifest)
    json_dump(staging / "seed-hints.json", {
        "schema_version": SCHEMA_VERSION,
        "warning": "Catalog parametrics are initial guesses only. Factory facts and review require datasheet citations.",
        "parts": [{"mpn": part["mpn"], "lcsc_id": part["lcsc_id"], "seed_hints": part.get("seed_hints", [])} for part in manifest["parts"]],
    })
    report = {
        "schema_version": SCHEMA_VERSION,
        "manifest": str(manifest_path),
        "staging_directory": str(staging),
        "downloaded": completed,
        "cached": skipped,
        "failed": len(failures),
        "failures": failures,
    }
    json_dump(staging / "failures.json", report)
    return report


def validate_manifest(manifest: Mapping[str, Any]) -> None:
    if manifest.get("schema_version") != SCHEMA_VERSION or manifest.get("kind") != "opencircuit-part-tranche":
        raise FeederError("Unsupported tranche manifest schema")
    parts = manifest.get("parts")
    if not isinstance(parts, list) or manifest.get("part_count") != len(parts):
        raise FeederError("Manifest part_count does not match parts")
    required = {"mpn", "manufacturer", "lcsc_id", "category", "attributes", "datasheet_url"}
    for index, part in enumerate(parts):
        if not isinstance(part, dict) or not required.issubset(part):
            raise FeederError(f"Manifest part {index} is missing required fields")
        if not isinstance(part["attributes"], dict):
            raise FeederError(f"Manifest part {index} attributes must be an object")
