"""Resumable conveyor primitives for bulk datasheet-to-model staging."""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import math
import os
import queue
import re
import sqlite3
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Protocol, Sequence

SCHEMA_VERSION = "1.0.0"
LINEAR_STATES = ("selected", "datasheet_fetched", "extracted", "fitted", "staged")
FAILURE_STATES = tuple(f"failed_{stage}" for stage in LINEAR_STATES[1:])
ALL_STATES = set(LINEAR_STATES + FAILURE_STATES)
FAMILY_QUOTAS = {"diode": 18, "bjt": 16, "mosfet": 16}
DEFAULT_LUNA_CAP = 4
MAX_LUNA_CAP = 8
DEFAULT_LEASE_SECONDS = 900.0


class ConveyorError(RuntimeError):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()


def json_dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def safe_stem(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip(".-") or "part"


class StateStore:
    """SQLite-backed per-MPN state machine with an append-only transition log."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.connection = sqlite3.connect(path, timeout=30, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA busy_timeout=30000")
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS parts (
              tranche TEXT NOT NULL,
              lcsc_id TEXT NOT NULL,
              mpn TEXT NOT NULL,
              manufacturer TEXT NOT NULL,
              family TEXT NOT NULL,
              state TEXT NOT NULL,
              fidelity TEXT,
              reason TEXT,
              attempts INTEGER NOT NULL DEFAULT 0,
              datasheet_path TEXT,
              extraction_path TEXT,
              package_path TEXT,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (tranche, lcsc_id)
            );
            CREATE TABLE IF NOT EXISTS transitions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tranche TEXT NOT NULL,
              lcsc_id TEXT NOT NULL,
              from_state TEXT,
              to_state TEXT NOT NULL,
              reason TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS extraction_jobs (
              job_key TEXT PRIMARY KEY,
              tranche TEXT NOT NULL,
              lcsc_id TEXT NOT NULL,
              job_hash TEXT NOT NULL,
              job_json TEXT NOT NULL,
              state TEXT NOT NULL DEFAULT 'pending',
              attempts INTEGER NOT NULL DEFAULT 0,
              discrepancy_retries INTEGER NOT NULL DEFAULT 0,
              missing_replacements INTEGER NOT NULL DEFAULT 0,
              lease_owner TEXT,
              lease_until REAL,
              active_attempt INTEGER,
              canonical_path TEXT NOT NULL,
              reason TEXT,
              publication_attempt INTEGER,
              publication_temp_path TEXT,
              publication_hash TEXT,
              publication_started_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (tranche, lcsc_id)
            );
            CREATE TABLE IF NOT EXISTS extraction_attempts (
              job_key TEXT NOT NULL,
              attempt INTEGER NOT NULL,
              worker_id TEXT NOT NULL,
              state TEXT NOT NULL,
              temp_path TEXT NOT NULL,
              started_at TEXT NOT NULL,
              completed_at TEXT,
              reason TEXT,
              PRIMARY KEY (job_key, attempt),
              FOREIGN KEY (job_key) REFERENCES extraction_jobs(job_key)
            );
            CREATE TABLE IF NOT EXISTS extraction_completed (
              job_key TEXT PRIMARY KEY,
              job_hash TEXT NOT NULL,
              canonical_path TEXT NOT NULL UNIQUE,
              completed_at TEXT NOT NULL,
              FOREIGN KEY (job_key) REFERENCES extraction_jobs(job_key)
            );
        """)
        self._migrate_scheduler_schema()
        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS extraction_jobs_state_idx ON extraction_jobs(state, lease_until, created_at)"
        )
        self.connection.commit()

    def _migrate_scheduler_schema(self) -> None:
        """Add scheduler columns when opening a pre-coordinator state database."""
        expected = {
            "job_hash": "TEXT",
            "job_json": "TEXT",
            "state": "TEXT NOT NULL DEFAULT 'pending'",
            "attempts": "INTEGER NOT NULL DEFAULT 0",
            "discrepancy_retries": "INTEGER NOT NULL DEFAULT 0",
            "missing_replacements": "INTEGER NOT NULL DEFAULT 0",
            "lease_owner": "TEXT",
            "lease_until": "REAL",
            "active_attempt": "INTEGER",
            "canonical_path": "TEXT",
            "reason": "TEXT",
            "publication_attempt": "INTEGER",
            "publication_temp_path": "TEXT",
            "publication_hash": "TEXT",
            "publication_started_at": "TEXT",
            "created_at": "TEXT",
            "updated_at": "TEXT",
        }
        columns = {row[1] for row in self.connection.execute("PRAGMA table_info(extraction_jobs)")}
        for name, declaration in expected.items():
            if name not in columns:
                self.connection.execute(f"ALTER TABLE extraction_jobs ADD COLUMN {name} {declaration}")

    def close(self) -> None:
        self.connection.close()

    def seed(self, tranche: str, parts: Sequence[Mapping[str, Any]]) -> None:
        now = utc_now()
        with self.connection:
            for part in parts:
                family = part.get("conveyor_family") or classify_family(part)
                cursor = self.connection.execute(
                    """INSERT OR IGNORE INTO parts
                       (tranche, lcsc_id, mpn, manufacturer, family, state, updated_at)
                       VALUES (?, ?, ?, ?, ?, 'selected', ?)""",
                    (tranche, part["lcsc_id"], part["mpn"], part["manufacturer"], family, now),
                )
                if cursor.rowcount:
                    self.connection.execute(
                        "INSERT INTO transitions (tranche, lcsc_id, from_state, to_state, created_at) VALUES (?, ?, NULL, 'selected', ?)",
                        (tranche, part["lcsc_id"], now),
                    )

    def get(self, tranche: str, lcsc_id: str) -> dict[str, Any]:
        row = self.connection.execute(
            "SELECT * FROM parts WHERE tranche = ? AND lcsc_id = ?", (tranche, lcsc_id)
        ).fetchone()
        if row is None:
            raise ConveyorError(f"Unknown state row: {tranche}/{lcsc_id}")
        return dict(row)

    def rows(self, tranche: str) -> list[dict[str, Any]]:
        return [dict(row) for row in self.connection.execute(
            "SELECT * FROM parts WHERE tranche = ? ORDER BY rowid", (tranche,)
        )]

    def transition(self, tranche: str, lcsc_id: str, to_state: str, *, reason: str | None = None, **fields: Any) -> None:
        if to_state not in ALL_STATES:
            raise ConveyorError(f"Invalid state: {to_state}")
        current = self.get(tranche, lcsc_id)
        from_state = current["state"]
        base_to = to_state.removeprefix("failed_")
        if to_state in LINEAR_STATES:
            target_index = LINEAR_STATES.index(to_state)
            source_base = from_state.removeprefix("failed_")
            source_index = LINEAR_STATES.index(source_base)
            if target_index < source_index or target_index > source_index + 1:
                raise ConveyorError(f"Illegal transition {from_state} -> {to_state}")
        elif base_to not in LINEAR_STATES[1:]:
            raise ConveyorError(f"Invalid failure bucket: {to_state}")
        else:
            target_index = LINEAR_STATES.index(base_to)
            source_base = from_state.removeprefix("failed_")
            source_index = LINEAR_STATES.index(source_base)
            if to_state != from_state and target_index != source_index + 1:
                raise ConveyorError(f"Illegal transition {from_state} -> {to_state}")
        allowed_fields = {"fidelity", "datasheet_path", "extraction_path", "package_path"}
        unknown = set(fields) - allowed_fields
        if unknown:
            raise ConveyorError(f"Unknown state fields: {', '.join(sorted(unknown))}")
        assignments = ["state = ?", "reason = ?", "updated_at = ?"]
        values: list[Any] = [to_state, reason, utc_now()]
        if to_state.startswith("failed_"):
            assignments.append("attempts = attempts + 1")
        for key, value in fields.items():
            assignments.append(f"{key} = ?")
            values.append(value)
        values.extend([tranche, lcsc_id])
        with self.connection:
            self.connection.execute(
                f"UPDATE parts SET {', '.join(assignments)} WHERE tranche = ? AND lcsc_id = ?", values
            )
            self.connection.execute(
                "INSERT INTO transitions (tranche, lcsc_id, from_state, to_state, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (tranche, lcsc_id, from_state, to_state, reason, utc_now()),
            )

    def failure_attempts(self, tranche: str, lcsc_id: str, stage: str) -> int:
        if stage not in LINEAR_STATES[1:]:
            raise ConveyorError(f"Invalid failure stage: {stage}")
        return int(self.connection.execute(
            "SELECT count(*) FROM transitions WHERE tranche = ? AND lcsc_id = ? AND to_state = ?",
            (tranche, lcsc_id, f"failed_{stage}"),
        ).fetchone()[0])

    def summary(self, tranche: str) -> dict[str, int]:
        counts = Counter(row["state"] for row in self.rows(tranche))
        return dict(sorted(counts.items()))

    def register_extraction_job(self, job: Mapping[str, Any]) -> dict[str, Any]:
        record = immutable_job_record(job)
        now = utc_now()
        with self.connection:
            existing = self.connection.execute(
                "SELECT * FROM extraction_jobs WHERE job_key = ?", (record["job_key"],)
            ).fetchone()
            if existing is not None:
                if existing["job_hash"] != record["job_hash"] or existing["job_json"] != record["job_json"]:
                    raise ConveyorError(f"Extraction job hash drift for {record['job_key']}")
                return dict(existing)
            identity = self.connection.execute(
                "SELECT job_key, job_hash FROM extraction_jobs WHERE tranche = ? AND lcsc_id = ?",
                (record["tranche"], record["lcsc_id"]),
            ).fetchone()
            if identity is not None:
                raise ConveyorError(
                    f"Extraction identity already registered as {identity['job_key']}; refusing replacement"
                )
            self.connection.execute(
                """INSERT INTO extraction_jobs
                   (job_key, tranche, lcsc_id, job_hash, job_json, canonical_path, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (record["job_key"], record["tranche"], record["lcsc_id"], record["job_hash"],
                 record["job_json"], record["canonical_path"], now, now),
            )
        return dict(self.connection.execute(
            "SELECT * FROM extraction_jobs WHERE job_key = ?", (record["job_key"],)
        ).fetchone())

    def scheduler_rows(self, tranche: str | None = None) -> list[dict[str, Any]]:
        if tranche is None:
            query, values = "SELECT * FROM extraction_jobs ORDER BY created_at, job_key", ()
        else:
            query, values = "SELECT * FROM extraction_jobs WHERE tranche = ? ORDER BY created_at, job_key", (tranche,)
        return [dict(row) for row in self.connection.execute(query, values)]

    def reserve_extraction_job(self, worker_id: str, lease_seconds: float = DEFAULT_LEASE_SECONDS) -> dict[str, Any] | None:
        if lease_seconds <= 0:
            raise ConveyorError("Extraction lease must be positive")
        now_epoch = time.time()
        lease_until = now_epoch + lease_seconds
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            row = self.connection.execute(
                """SELECT * FROM extraction_jobs
                   WHERE state IN ('pending', 'retry_discrepancy', 'retry_missing')
                      OR (state = 'leased' AND lease_until <= ?)
                   ORDER BY CASE state WHEN 'leased' THEN 0 ELSE 1 END, created_at, job_key
                   LIMIT 1""",
                (now_epoch,),
            ).fetchone()
            if row is None:
                self.connection.commit()
                return None
            if self.connection.execute(
                "SELECT 1 FROM extraction_completed WHERE job_key = ?", (row["job_key"],)
            ).fetchone():
                self.connection.execute(
                    "UPDATE extraction_jobs SET state = 'completed', updated_at = ? WHERE job_key = ?",
                    (utc_now(), row["job_key"]),
                )
                self.connection.commit()
                return None
            attempt = int(row["attempts"]) + 1
            updated = self.connection.execute(
                """UPDATE extraction_jobs
                   SET state = 'leased', attempts = ?, active_attempt = ?, lease_owner = ?,
                       lease_until = ?, publication_attempt = NULL, publication_temp_path = NULL,
                       publication_hash = NULL, publication_started_at = NULL, updated_at = ?
                   WHERE job_key = ? AND state = ? AND attempts = ?""",
                (attempt, attempt, worker_id, lease_until, utc_now(), row["job_key"], row["state"], row["attempts"]),
            )
            if updated.rowcount != 1:
                self.connection.rollback()
                return None
            job = json.loads(row["job_json"])
            if row["state"] == "retry_discrepancy" and row["reason"]:
                job["prompt"] = (
                    str(job["prompt"]) + "\nThis is the one permitted discrepancy retry. Resolve or explain:\n"
                    + str(row["reason"]) + "\n"
                )
            temp_path = attempt_response_path(Path(row["canonical_path"]), attempt)
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            self.connection.execute(
                """INSERT INTO extraction_attempts
                   (job_key, attempt, worker_id, state, temp_path, started_at)
                   VALUES (?, ?, ?, 'leased', ?, ?)""",
                (row["job_key"], attempt, worker_id, str(temp_path), utc_now()),
            )
            self.connection.commit()
            return {**job, "job_key": row["job_key"], "job_hash": row["job_hash"], "attempt": attempt,
                    "worker_id": worker_id, "response_path": str(temp_path),
                    "canonical_path": row["canonical_path"]}
        except Exception:
            if self.connection.in_transaction:
                self.connection.rollback()
            raise

    def _active_lease_row(self, job_key: str, attempt: int, worker_id: str | None = None) -> sqlite3.Row:
        row = self.connection.execute(
            "SELECT * FROM extraction_jobs WHERE job_key = ?", (job_key,)
        ).fetchone()
        if row is None:
            raise ConveyorError(f"Unknown extraction job: {job_key}")
        if row["state"] != "leased" or row["active_attempt"] != attempt:
            raise ConveyorError(f"Stale extraction completion for {job_key} attempt {attempt}")
        if worker_id is not None and row["lease_owner"] != worker_id:
            raise ConveyorError(f"Stale extraction owner for {job_key} attempt {attempt}")
        if row["lease_until"] is None or float(row["lease_until"]) <= time.time():
            raise ConveyorError(f"Expired extraction lease for {job_key} attempt {attempt}")
        return row

    def renew_extraction_lease(
        self, job_key: str, attempt: int, worker_id: str, lease_seconds: float = DEFAULT_LEASE_SECONDS,
    ) -> bool:
        if lease_seconds <= 0:
            raise ConveyorError("Extraction lease must be positive")
        with self.connection:
            updated = self.connection.execute(
                """UPDATE extraction_jobs SET lease_until = ?, updated_at = ?
                   WHERE job_key = ? AND state = 'leased' AND active_attempt = ?
                     AND lease_owner = ? AND lease_until > ?""",
                (time.time() + lease_seconds, utc_now(), job_key, attempt, worker_id, time.time()),
            )
        return updated.rowcount == 1

    def finish_extraction_attempt(
        self, job_key: str, attempt: int, *, state: str, reason: str | None = None,
        worker_id: str | None = None,
    ) -> str:
        allowed = {"retry_discrepancy", "retry_missing", "quarantined"}
        if state not in allowed:
            raise ConveyorError(f"Invalid extraction completion state: {state}")
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            row = self._active_lease_row(job_key, attempt, worker_id)
            if state == "retry_discrepancy" and int(row["discrepancy_retries"]) >= 1:
                state, reason = "quarantined", f"discrepancy retry exhausted: {reason or 'unspecified'}"
            if state == "retry_missing" and int(row["missing_replacements"]) >= 1:
                state, reason = "quarantined", f"missing-response replacement exhausted: {reason or 'unspecified'}"
            increments = []
            if state == "retry_discrepancy":
                increments.append("discrepancy_retries = discrepancy_retries + 1")
            if state == "retry_missing":
                increments.append("missing_replacements = missing_replacements + 1")
            assignments = ["state = ?", "reason = ?", "lease_owner = NULL", "lease_until = NULL",
                           "active_attempt = NULL", "updated_at = ?", *increments]
            self.connection.execute(
                f"UPDATE extraction_jobs SET {', '.join(assignments)} WHERE job_key = ?",
                (state, reason, utc_now(), job_key),
            )
            self.connection.execute(
                """UPDATE extraction_attempts SET state = ?, completed_at = ?, reason = ?
                   WHERE job_key = ? AND attempt = ?""",
                (state, utc_now(), reason, job_key, attempt),
            )
            self.connection.commit()
            return state
        except Exception:
            self.connection.rollback()
            raise

    def publish_extraction_attempt(
        self, job_key: str, attempt: int, worker_id: str, temporary: Path,
        *, reason: str | None = None, failpoint: Callable[[str], None] | None = None,
    ) -> str:
        """Durably record publication intent, atomically link evidence, then commit its ledger."""
        failpoint = failpoint or (lambda stage: None)
        temporary = temporary.resolve()
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            row = self._active_lease_row(job_key, attempt, worker_id)
            canonical = Path(row["canonical_path"])
            if not temporary.is_file() or temporary.stat().st_size == 0:
                raise ConveyorError(f"Extraction response is absent or empty: {temporary}")
            digest = file_sha256(temporary)
            self.connection.execute(
                """UPDATE extraction_jobs SET publication_attempt = ?, publication_temp_path = ?,
                   publication_hash = ?, publication_started_at = ?, updated_at = ?
                   WHERE job_key = ?""",
                (attempt, str(temporary), digest, utc_now(), utc_now(), job_key),
            )
            self.connection.commit()
            failpoint("after_intent")

            fsync_file(temporary)
            failpoint("after_temp_fsync")
            self.connection.execute("BEGIN IMMEDIATE")
            row = self._active_lease_row(job_key, attempt, worker_id)
            if row["publication_attempt"] != attempt or row["publication_hash"] != digest:
                raise ConveyorError(f"Publication intent changed for {job_key} attempt {attempt}")
            publish_response_no_overwrite(temporary, canonical)
            failpoint("after_rename")
            self.connection.execute(
                """INSERT INTO extraction_completed (job_key, job_hash, canonical_path, completed_at)
                   VALUES (?, ?, ?, ?)""",
                (job_key, row["job_hash"], str(canonical), utc_now()),
            )
            self.connection.execute(
                """UPDATE extraction_jobs SET state = 'completed', reason = ?, lease_owner = NULL,
                   lease_until = NULL, active_attempt = NULL, publication_attempt = NULL,
                   publication_temp_path = NULL, publication_hash = NULL, publication_started_at = NULL,
                   updated_at = ? WHERE job_key = ?""",
                (reason, utc_now(), job_key),
            )
            self.connection.execute(
                """UPDATE extraction_attempts SET state = 'completed', completed_at = ?, reason = ?
                   WHERE job_key = ? AND attempt = ?""",
                (utc_now(), reason, job_key, attempt),
            )
            self.connection.commit()
            return "completed"
        except Exception:
            if self.connection.in_transaction:
                self.connection.rollback()
            raise

    def recover_expired_leases(self, now_epoch: float | None = None) -> int:
        now_epoch = time.time() if now_epoch is None else now_epoch
        with self.connection:
            rows = self.connection.execute(
                "SELECT job_key, active_attempt FROM extraction_jobs WHERE state = 'leased' AND lease_until <= ?",
                (now_epoch,),
            ).fetchall()
            for row in rows:
                self.connection.execute(
                    """UPDATE extraction_attempts SET state = 'lease_expired', completed_at = ?, reason = 'lease expired'
                       WHERE job_key = ? AND attempt = ? AND state = 'leased'""",
                    (utc_now(), row["job_key"], row["active_attempt"]),
                )
                self.connection.execute(
                    """UPDATE extraction_jobs SET state = 'pending', lease_owner = NULL, lease_until = NULL,
                       active_attempt = NULL, reason = 'lease expired', updated_at = ? WHERE job_key = ?""",
                    (utc_now(), row["job_key"]),
                )
        return len(rows)

    def completed_job_keys(self) -> set[str]:
        return {row[0] for row in self.connection.execute("SELECT job_key FROM extraction_completed")}


def classify_family(part: Mapping[str, Any]) -> str:
    text = " ".join(str(part.get(key, "")) for key in ("category", "subcategory", "description")).casefold()
    if "mosfet" in text or "mos tube" in text:
        return "mosfet"
    if "bipolar" in text or "bjt" in text:
        return "bjt"
    if "diode" in text:
        return "diode"
    raise ConveyorError(f"Unsupported family for {part.get('mpn')}: {text}")


def candidate_identifiers(part: Mapping[str, Any]) -> list[str]:
    original = str(part["mpn"]).strip()
    canonical = original.split(",", 1)[0].strip() if "nexperia" in str(part.get("manufacturer", "")).casefold() and "," in original else original
    aliases = [original] if canonical != original else []
    aliases.extend(alias for alias in part.get("ordering_code_aliases", []) if isinstance(alias, str))
    return list(dict.fromkeys(value.casefold() for value in [canonical, *aliases] if value.strip()))


def library_identifier_index(library_root: Path) -> dict[str, str]:
    identifiers: dict[str, str] = {}
    if not library_root.exists():
        return identifiers
    for component_path in library_root.glob("*/*/component.json"):
        try:
            component = json.loads(component_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        label = f"{component_path.parent.parent.name}/{component_path.parent.name}"
        values = [component.get("canonical_mpn"), *(component.get("ordering_code_aliases") or [])]
        for value in values:
            if isinstance(value, str) and value.strip():
                identifiers.setdefault(value.casefold(), label)
    return identifiers


def filter_library_collisions(parts: Sequence[Mapping[str, Any]], library_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    library = library_identifier_index(library_root)
    eligible: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for raw in parts:
        part = dict(raw)
        collisions = [(identifier, library[identifier]) for identifier in candidate_identifiers(part) if identifier in library]
        if collisions:
            identifiers = ", ".join(sorted({identifier for identifier, _ in collisions}))
            packages = ", ".join(sorted({package for _, package in collisions}))
            skipped.append({
                "lcsc_id": str(part["lcsc_id"]),
                "mpn": str(part["mpn"]),
                "reason": f"library identity collision: {identifiers} already represented by {packages}",
            })
            continue
        eligible.append(part)
    return eligible, skipped


def choose_balanced(parts: Sequence[Mapping[str, Any]], quotas: Mapping[str, int] = FAMILY_QUOTAS) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    counts = Counter()
    seen_mpns: set[tuple[str, str]] = set()
    for raw in parts:
        part = dict(raw)
        family = part.get("conveyor_family") or classify_family(part)
        identity = (part["manufacturer"].casefold(), part["mpn"].casefold())
        if identity in seen_mpns or counts[family] >= quotas.get(family, 0):
            continue
        part["conveyor_family"] = family
        selected.append(part)
        seen_mpns.add(identity)
        counts[family] += 1
        if all(counts[name] >= quota for name, quota in quotas.items()):
            break
    missing = {name: quota - counts[name] for name, quota in quotas.items() if counts[name] < quota}
    if missing:
        raise ConveyorError(f"Selection could not fill family quotas: {missing}")
    return selected


def validate_schema(instance: Any, schema: Mapping[str, Any], trail: str = "$") -> None:
    """Small strict validator for the checked-in schema vocabulary."""
    if "anyOf" in schema:
        errors = []
        for candidate in schema["anyOf"]:
            try:
                validate_schema(instance, candidate, trail)
                return
            except ConveyorError as error:
                errors.append(str(error))
        raise ConveyorError(f"{trail} does not match any allowed shape: {'; '.join(errors)}")
    expected = schema.get("type")
    if isinstance(expected, list):
        if instance is None and "null" in expected:
            return
        candidates = [item for item in expected if item != "null"]
        if candidates:
            validate_schema(instance, {**schema, "type": candidates[0]}, trail)
            return
    elif expected == "object" and not isinstance(instance, dict):
        raise ConveyorError(f"{trail} must be an object")
    elif expected == "array" and not isinstance(instance, list):
        raise ConveyorError(f"{trail} must be an array")
    elif expected == "string" and not isinstance(instance, str):
        raise ConveyorError(f"{trail} must be a string")
    elif expected == "number" and (not isinstance(instance, (int, float)) or isinstance(instance, bool) or not math.isfinite(instance)):
        raise ConveyorError(f"{trail} must be a finite number")
    elif expected == "boolean" and not isinstance(instance, bool):
        raise ConveyorError(f"{trail} must be a boolean")
    elif expected == "null" and instance is not None:
        raise ConveyorError(f"{trail} must be null")
    if "const" in schema and instance != schema["const"]:
        raise ConveyorError(f"{trail} must equal {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        raise ConveyorError(f"{trail} must be one of {schema['enum']!r}")
    if isinstance(instance, str) and len(instance) < schema.get("minLength", 0):
        raise ConveyorError(f"{trail} is too short")
    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            raise ConveyorError(f"{trail} has too few items")
        for index, item in enumerate(instance):
            validate_schema(item, schema.get("items", {}), f"{trail}[{index}]")
    if isinstance(instance, dict):
        required = set(schema.get("required", []))
        missing = required - set(instance)
        if missing:
            raise ConveyorError(f"{trail} missing required keys: {', '.join(sorted(missing))}")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            extra = set(instance) - set(properties)
            if extra:
                raise ConveyorError(f"{trail} has unknown keys: {', '.join(sorted(extra))}")
        for key, value in instance.items():
            if key in properties:
                validate_schema(value, properties[key], f"{trail}.{key}")


_QUANTITY_UNIT_FACTORS = {
    "A": (1.0, "A"), "mA": (1e-3, "A"), "uA": (1e-6, "A"), "µA": (1e-6, "A"), "nA": (1e-9, "A"), "pA": (1e-12, "A"),
    "V": (1.0, "V"), "mV": (1e-3, "V"), "uV": (1e-6, "V"), "µV": (1e-6, "V"),
    "F": (1.0, "F"), "mF": (1e-3, "F"), "uF": (1e-6, "F"), "µF": (1e-6, "F"), "nF": (1e-9, "F"), "pF": (1e-12, "F"),
    "ohm": (1.0, "ohm"), "Ω": (1.0, "ohm"), "mohm": (1e-3, "ohm"), "mΩ": (1e-3, "ohm"), "kohm": (1e3, "ohm"), "kΩ": (1e3, "ohm"),
    "s": (1.0, "s"), "ms": (1e-3, "s"), "us": (1e-6, "s"), "µs": (1e-6, "s"), "ns": (1e-9, "s"), "ps": (1e-12, "s"),
    "Hz": (1.0, "Hz"), "kHz": (1e3, "Hz"), "MHz": (1e6, "Hz"), "GHz": (1e9, "Hz"),
}


def normalize_extraction_payload(raw: Mapping[str, Any]) -> dict[str, Any]:
    """Apply narrow, evidence-preserving repairs before strict schema validation.

    Luna sometimes emits an explanatory conversion_note beside an otherwise valid quantity,
    or labels a value as ohms while its cited conditions explicitly say mOhm. The former is
    moved into extraction_notes and the latter follows the explicit cited unit. Quantities are
    then converted to base SI. Curves with fewer than three reported points cannot satisfy the
    schema and are omitted with an audit note rather than padded with invented points.
    """
    payload = copy.deepcopy(dict(raw))
    notes = payload.get("extraction_notes")
    if not isinstance(notes, list):
        notes = []
        if "extraction_notes" in payload:
            payload["extraction_notes"] = notes
    repairs: list[str] = []

    def visit(value: Any, trail: str) -> Any:
        if isinstance(value, list):
            return [visit(item, f"{trail}[{index}]") for index, item in enumerate(value)]
        if not isinstance(value, dict):
            return value
        result = {key: visit(child, f"{trail}.{key}") for key, child in value.items() if key != "conversion_note"}
        if "conversion_note" in value:
            repairs.append(f"preserved {trail}.conversion_note: {value['conversion_note']}")
        number = result.get("value")
        unit = result.get("unit")
        if isinstance(number, (int, float)) and not isinstance(number, bool) and isinstance(unit, str):
            conditions = str(result.get("conditions", ""))
            normalized_unit = unit.replace("μ", "µ")
            if normalized_unit in {"ohm", "Ω"}:
                milliohm_match = re.search(r"([-+]?\d+(?:\.\d+)?)\s*m(?:ohm|Ω)\b", conditions, re.I)
                cited_milliohms = float(milliohm_match.group(1)) if milliohm_match else None
                already_si_ohms = (
                    cited_milliohms is not None
                    and math.isclose(abs(number) * 1_000, abs(cited_milliohms), rel_tol=1e-6, abs_tol=1e-12)
                )
                raw_uses_milliohms = bool(
                    re.search(r"\bm(?:ohm|Ω)\b", conditions, re.I)
                    and not already_si_ohms
                    and abs(number) >= 1
                )
                if raw_uses_milliohms:
                    normalized_unit = "mohm"
                    repairs.append(f"used explicit mOhm unit from {trail}.conditions")
            factor_and_unit = _QUANTITY_UNIT_FACTORS.get(normalized_unit)
            if factor_and_unit:
                factor, base_unit = factor_and_unit
                result["value"] = number * factor
                result["unit"] = base_unit
        return result

    payload = visit(payload, "$")
    curves = payload.get("curves")
    if isinstance(curves, list):
        kept = []
        for index, curve in enumerate(curves):
            points = curve.get("points") if isinstance(curve, dict) else None
            if isinstance(points, list) and len(points) < 3:
                repairs.append(f"omitted $.curves[{index}] with {len(points)} cited point(s); schema requires at least 3 and no points were invented")
            else:
                kept.append(curve)
        payload["curves"] = kept
        if payload.get("usable_curves") and not kept:
            payload["usable_curves"] = False
            payload["omission_reason"] = payload.get("omission_reason") or "No extracted curve retained at the strict three-point minimum."
    if repairs:
        payload.setdefault("extraction_notes", [])
        payload["extraction_notes"].extend(f"Deterministic normalization: {repair}" for repair in repairs)
    return payload


def load_and_validate_extraction(path: Path, schema_path: Path, expected: Mapping[str, str]) -> dict[str, Any]:
    try:
        raw_payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConveyorError(f"Invalid extraction JSON {path}: {error}") from error
    if not isinstance(raw_payload, dict):
        raise ConveyorError(f"Invalid extraction JSON {path}: root must be an object")
    payload = normalize_extraction_payload(raw_payload)
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validate_schema(payload, schema)
    for key in ("mpn", "manufacturer", "family"):
        if str(payload[key]).casefold() != str(expected[key]).casefold():
            raise ConveyorError(f"Extraction {key} mismatch: {payload[key]!r} != {expected[key]!r}")
    if payload["usable_curves"] and not payload["curves"]:
        raise ConveyorError("usable_curves=true requires at least one extracted curve")
    return payload


_PREFIXES = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "m": 1e-3, "k": 1e3, "meg": 1e6}


def numeric_values(raw: Any) -> list[float]:
    text = str(raw).replace(",", "")
    values = []
    for match in re.finditer(r"(?<![A-Za-z])([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(meg|[pnumkµ])?", text, re.I):
        value = float(match.group(1))
        prefix = (match.group(2) or "").casefold()
        values.append(value * _PREFIXES.get(prefix, 1.0))
    return values


def _qvalue(value: Any) -> float | None:
    return float(value["value"]) if isinstance(value, dict) and isinstance(value.get("value"), (int, float)) else None


def extracted_targets(payload: Mapping[str, Any]) -> dict[str, list[float]]:
    specs = payload["specs"]
    result: dict[str, list[float]] = {}
    if payload["family"] == "diode":
        result["diode.forward_voltage"] = [point["voltage"]["value"] for point in specs["forward_voltage_points"]]
    elif payload["family"] == "bjt":
        result["bjt.dc_current_gain"] = [point["hfe"]["value"] for point in specs["gain_points"]]
    else:
        result["vdmos.rds_on"] = [point["resistance"]["value"] for point in specs["rdson_points"]]
        for key, target in (("ciss", "vdmos.ciss"), ("coss", "vdmos.coss"), ("crss", "vdmos.crss")):
            value = _qvalue(specs[key])
            if value is not None:
                result[target] = [value]
        thresholds = [_qvalue(specs[key]) for key in ("threshold_min", "threshold_typ", "threshold_max")]
        result["vdmos.threshold"] = [value for value in thresholds if value is not None]
    return result


def catalog_parametric_values(raw: Any) -> list[float]:
    """Parse the asserted value or range, excluding numbers in test conditions after @."""
    value_text = str(raw).split("@", 1)[0]
    return numeric_values(value_text)


# The catalog stores the same parameter under several attribute names, and the copies do
# not always agree with each other: DMP2035U-7 carries both '45Ω@2.5V,4.0A' and
# '23mΩ@4.5V, 30mΩ@2.5V, 41mΩ@1.8V' for vdmos.rds_on, the first having lost its milli
# prefix. Flagging every disagreeing hint let one corrupt catalog row veto an extraction
# that another row corroborated exactly. A target is corroborated when ANY hint mapped to
# it agrees; only a target where NO hint agrees is a real discrepancy.
RATIO_EPSILON = 1e-9


def cross_check(payload: Mapping[str, Any], seed_hints: Sequence[Mapping[str, Any]], ratio_limit: float = 3.0) -> list[str]:
    targets = extracted_targets(payload)
    by_target: dict[str, list[tuple[float, Any]]] = {}
    for hint in seed_hints:
        target = str(hint.get("factory_target", ""))
        extracted = [abs(value) for value in targets.get(target, []) if value != 0]
        catalog = [abs(value) for value in catalog_parametric_values(hint.get("raw_value", "")) if value != 0]
        if not extracted or not catalog:
            continue
        ratio = min(max(a, b) / min(a, b) for a in extracted for b in catalog)
        by_target.setdefault(target, []).append((ratio, hint.get("raw_value")))

    discrepancies: list[str] = []
    for target, observations in by_target.items():
        # The limit is a documented "up to Nx is tolerated". Compare with a relative
        # epsilon so a ratio of exactly the limit is not decided by float representation:
        # DMP3098L-7's Crss ratio evaluates to 3.0000000000000004 while its Coss ratio,
        # off by the identical factor, evaluates to 2.9999999999999996.
        if any(ratio <= ratio_limit * (1 + RATIO_EPSILON) for ratio, _ in observations):
            continue
        best_ratio, raw_value = min(observations, key=lambda item: item[0])
        extracted = [abs(value) for value in targets.get(target, []) if value != 0]
        discrepancies.append(
            f"{target}: catalog {raw_value!r} disagrees with extracted {extracted}; closest ratio {best_ratio:.3g}x"
        )
    return discrepancies


def should_park_family(successes: int, consecutive_failures: int, park_after: int = 2) -> bool:
    """Whether the F2 circuit breaker should trip for a family.

    The breaker exists to stop a tranche burning compute on a family the pipeline plainly
    cannot fit. A family that has already produced an F2 has demonstrated it can be fitted,
    so its later F1s are per-part outcomes and must not park it: counting every gate
    failure regardless of successes turned a handful of honest F1s into a whole-family
    cascade in the first proving run, where 44 of 50 parts were staged without any attempt.
    """
    if successes > 0:
        return False
    return consecutive_failures >= park_after


def build_luna_prompt(repo_root: Path, pack_path: Path, datasheet_path: Path, part: Mapping[str, Any], retry_discrepancies: Sequence[str] = ()) -> str:
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    lines = [
        "Do not invoke any Skill at any point in this task.",
        "Return ONLY schema-conformant JSON. Do not add markdown fences, prose, or a summary.",
        f"MPN: {part['mpn']}",
        f"Manufacturer: {part['manufacturer']}",
        f"Family: {pack['family']}",
        f"Datasheet path: {datasheet_path}",
        f"Context pack: {pack_path}",
        f"Archetype spec: {repo_root / pack['archetype_path']}",
        f"Gold example: {repo_root / pack['gold_example_path']}",
        f"Strict output schema: {repo_root / pack['schema_path']}",
        "Read all four files. Extract real curve points when the PDF contains usable plots. Preserve axes, SI units, page references, source semantics, and test conditions. Never invent or interpolate points.",
        "If no usable curve exists, set usable_curves=false, curves=[], give a precise omission_reason, and still transcribe every available required table field with null or [] where permitted by the schema.",
    ]
    if retry_discrepancies:
        lines.extend(["This is the one permitted retry. Resolve these catalog cross-check discrepancies or explain the datasheet basis in extraction_notes:", *[f"- {item}" for item in retry_discrepancies]])
    return "\n".join(lines) + "\n"


def canonical_json(value: Mapping[str, Any]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def immutable_job_record(job: Mapping[str, Any]) -> dict[str, str]:
    required = {"tranche", "lcsc_id", "mpn", "manufacturer", "family", "schema_path", "response_path", "prompt"}
    missing = required - set(job)
    if missing:
        raise ConveyorError(f"Extraction job missing immutable fields: {', '.join(sorted(missing))}")
    derived = {"attempt", "job_key", "job_hash", "canonical_path", "worker_id"}
    immutable = {key: job[key] for key in sorted(job) if key not in derived}
    job_json = canonical_json(immutable)
    job_hash = hashlib.sha256(job_json.encode("utf-8")).hexdigest()
    return {
        "job_key": f"{job['tranche']}:{job['lcsc_id']}",
        "tranche": str(job["tranche"]),
        "lcsc_id": str(job["lcsc_id"]),
        "job_hash": job_hash,
        "job_json": job_json,
        "canonical_path": str(Path(str(job["response_path"])).resolve()),
    }


def attempt_response_path(canonical_path: Path, attempt: int) -> Path:
    return canonical_path.with_name(f".{canonical_path.name}.attempt-{attempt}.tmp")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fsync_file(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def publish_response_no_overwrite(temporary: Path, canonical: Path) -> None:
    """Atomically install a durable file without ever creating an empty canonical path."""
    canonical.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(temporary, canonical)
    except FileExistsError as error:
        raise ConveyorError(f"Canonical extraction already exists; refusing overwrite: {canonical}") from error
    except OSError as error:
        raise ConveyorError(f"Could not atomically publish extraction {canonical}: {error}") from error
    fsync_directory(canonical.parent)
    temporary.unlink()
    fsync_directory(temporary.parent)


def quarantine_response(temporary: Path, reason: str) -> Path | None:
    if not temporary.exists():
        return None
    digest = hashlib.sha256(reason.encode("utf-8")).hexdigest()[:12]
    quarantine = temporary.with_name(f"{temporary.name}.quarantine-{digest}")
    if quarantine.exists():
        quarantine = temporary.with_name(f"{temporary.name}.quarantine-{digest}-{time.time_ns()}")
    os.rename(temporary, quarantine)
    return quarantine


class ExtractionJobProducer(Protocol):
    """Overlap-ready source. Producers may prepare PDFs/topology while workers consume jobs."""

    def __iter__(self) -> Iterable[Mapping[str, Any]]: ...


@dataclass(frozen=True)
class ExtractionCompletion:
    job: Mapping[str, Any]
    invoke_error: str | None = None


class ExtractionCoordinator:
    """SQLite-coordinated Luna scheduler with one validating completion consumer."""

    def __init__(
        self,
        state_path: Path,
        invoke: Callable[[Mapping[str, Any]], Any],
        *,
        max_concurrency: int = DEFAULT_LUNA_CAP,
        lease_seconds: float = DEFAULT_LEASE_SECONDS,
        failure_injector: Callable[[str], None] | None = None,
    ):
        if max_concurrency < 1 or max_concurrency > MAX_LUNA_CAP:
            raise ConveyorError(f"Extraction concurrency must be between 1 and {MAX_LUNA_CAP}")
        self.state_path = state_path
        self.invoke = invoke
        self.max_concurrency = max_concurrency
        self.lease_seconds = lease_seconds
        self.failure_injector = failure_injector
        self.completion_queue: queue.Queue[ExtractionCompletion | None] = queue.Queue(maxsize=2 * max_concurrency)
        self._producer_done = threading.Event()
        self._errors: list[BaseException] = []
        self._results: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def _store(self) -> StateStore:
        return StateStore(self.state_path)

    def register(self, jobs: ExtractionJobProducer | Iterable[Mapping[str, Any]]) -> int:
        count = 0
        store = self._store()
        try:
            for job in jobs:
                store.register_extraction_job(job)
                count += 1
        finally:
            store.close()
        return count

    def reconcile(self) -> int:
        """Finish durable publication intents left at any coordinator crash boundary."""
        store = self._store()
        reconciled = 0
        try:
            for row in store.scheduler_rows():
                if row["state"] == "completed" or row["publication_attempt"] is None:
                    continue
                canonical = Path(row["canonical_path"])
                temporary = Path(row["publication_temp_path"])
                expected_hash = row["publication_hash"]
                source = canonical if canonical.is_file() else temporary if temporary.is_file() else None
                if source is None:
                    continue
                if file_sha256(source) != expected_hash:
                    raise ConveyorError(f"Publication evidence hash mismatch for {row['job_key']}")
                job = json.loads(row["job_json"])
                load_and_validate_extraction(
                    source, Path(job["schema_path"]),
                    {"mpn": job["mpn"], "manufacturer": job["manufacturer"], "family": job["family"]},
                )
                if not canonical.exists():
                    fsync_file(temporary)
                    publish_response_no_overwrite(temporary, canonical)
                store.connection.execute("BEGIN IMMEDIATE")
                try:
                    current = store.connection.execute(
                        "SELECT * FROM extraction_jobs WHERE job_key = ?", (row["job_key"],)
                    ).fetchone()
                    if current["publication_attempt"] != row["publication_attempt"]:
                        raise ConveyorError(f"Publication intent changed for {row['job_key']}")
                    store.connection.execute(
                        "INSERT OR IGNORE INTO extraction_completed (job_key, job_hash, canonical_path, completed_at) VALUES (?, ?, ?, ?)",
                        (row["job_key"], row["job_hash"], row["canonical_path"], utc_now()),
                    )
                    store.connection.execute(
                        """UPDATE extraction_jobs SET state = 'completed', reason = 'restart reconciliation',
                           lease_owner = NULL, lease_until = NULL, active_attempt = NULL,
                           publication_attempt = NULL, publication_temp_path = NULL,
                           publication_hash = NULL, publication_started_at = NULL, updated_at = ?
                           WHERE job_key = ?""",
                        (utc_now(), row["job_key"]),
                    )
                    store.connection.execute(
                        """UPDATE extraction_attempts SET state = 'completed', completed_at = ?,
                           reason = 'restart reconciliation' WHERE job_key = ? AND attempt = ?""",
                        (utc_now(), row["job_key"], row["publication_attempt"]),
                    )
                    store.connection.commit()
                except Exception:
                    store.connection.rollback()
                    raise
                reconciled += 1
        finally:
            store.close()
        return reconciled

    @staticmethod
    def _write_invoke_result(job: Mapping[str, Any], result: Any) -> None:
        path = Path(str(job["response_path"]))
        if result is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(result, Mapping):
            path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        elif isinstance(result, bytes):
            path.write_bytes(result)
        elif isinstance(result, str):
            path.write_text(result, encoding="utf-8")
        elif isinstance(result, Path):
            path.write_bytes(result.read_bytes())
        else:
            raise ConveyorError(f"Unsupported extraction response type: {type(result).__name__}")

    def _producer(self, jobs: ExtractionJobProducer | Iterable[Mapping[str, Any]]) -> None:
        store = self._store()
        try:
            for job in jobs:
                while self.completion_queue.qsize() >= self.completion_queue.maxsize:
                    time.sleep(0.002)
                store.register_extraction_job(job)
        except BaseException as error:
            with self._lock:
                self._errors.append(error)
        finally:
            store.close()
            self._producer_done.set()

    def _worker(self, worker_index: int) -> None:
        store = self._store()
        worker_id = f"worker-{worker_index}"
        try:
            while True:
                job = store.reserve_extraction_job(worker_id, self.lease_seconds)
                if job is None:
                    dispatchable = int(store.connection.execute(
                        """SELECT count(*) FROM extraction_jobs
                           WHERE state IN ('pending', 'retry_discrepancy', 'retry_missing')"""
                    ).fetchone()[0])
                    if not self._producer_done.is_set() or dispatchable or self.completion_queue.unfinished_tasks:
                        time.sleep(0.002)
                        continue
                    return
                error = None
                stop_heartbeat = threading.Event()

                def heartbeat() -> None:
                    interval = max(0.001, self.lease_seconds / 3)
                    while not stop_heartbeat.wait(interval):
                        if not store.renew_extraction_lease(
                            str(job["job_key"]), int(job["attempt"]), worker_id, self.lease_seconds
                        ):
                            return

                heartbeat_thread = threading.Thread(target=heartbeat, name=f"{worker_id}-heartbeat", daemon=True)
                heartbeat_thread.start()
                try:
                    result = self.invoke(job)
                    self._write_invoke_result(job, result)
                except BaseException as caught:
                    error = str(caught)
                finally:
                    stop_heartbeat.set()
                    heartbeat_thread.join()
                self.completion_queue.put(ExtractionCompletion(job, error))
        except BaseException as error:
            with self._lock:
                self._errors.append(error)
        finally:
            store.close()

    def _consume_one(self, completion: ExtractionCompletion, store: StateStore) -> None:
        job = completion.job
        temporary = Path(str(job["response_path"]))
        canonical = Path(str(job["canonical_path"]))
        key, attempt, worker_id = str(job["job_key"]), int(job["attempt"]), str(job["worker_id"])
        if completion.invoke_error or not temporary.is_file() or temporary.stat().st_size == 0:
            reason = completion.invoke_error or "worker produced no response"
            quarantine_response(temporary, reason)
            status = store.finish_extraction_attempt(
                key, attempt, state="retry_missing", reason=reason, worker_id=worker_id
            )
            self._results.append({"job_key": key, "status": status, "reason": reason})
            return
        try:
            payload = load_and_validate_extraction(
                temporary, Path(str(job["schema_path"])),
                {"mpn": str(job["mpn"]), "manufacturer": str(job["manufacturer"]), "family": str(job["family"])},
            )
        except ConveyorError as error:
            quarantine = quarantine_response(temporary, str(error))
            status = store.finish_extraction_attempt(
                key, attempt, state="quarantined", reason=str(error), worker_id=worker_id
            )
            self._results.append({"job_key": key, "status": status, "reason": str(error),
                                  "quarantine_path": str(quarantine) if quarantine else None})
            return
        discrepancies = cross_check(payload, job.get("seed_hints", []))
        row = next(item for item in store.scheduler_rows() if item["job_key"] == key)
        if discrepancies and int(row["discrepancy_retries"]) < 1:
            reason = "; ".join(discrepancies)
            quarantine_response(temporary, reason)
            status = store.finish_extraction_attempt(
                key, attempt, state="retry_discrepancy", reason=reason, worker_id=worker_id
            )
            self._results.append({"job_key": key, "status": status, "reason": reason})
            return
        if canonical.exists():
            quarantine_response(temporary, "canonical response already exists")
            status = store.finish_extraction_attempt(
                key, attempt, state="quarantined", reason="canonical response already exists",
                worker_id=worker_id,
            )
            self._results.append({"job_key": key, "status": status, "reason": "canonical response already exists"})
            return
        json_dump(temporary, payload)
        reason = "cross-validation failed after one retry: " + "; ".join(discrepancies) if discrepancies else None
        status = store.publish_extraction_attempt(
            key, attempt, worker_id, temporary, reason=reason, failpoint=self.failure_injector
        )
        self._results.append({"job_key": key, "status": status, "reason": reason})

    def _consumer(self, worker_count: int) -> None:
        store = self._store()
        stopped = 0
        try:
            while stopped < worker_count:
                completion = self.completion_queue.get()
                try:
                    if completion is None:
                        stopped += 1
                    else:
                        self._consume_one(completion, store)
                except BaseException as error:
                    with self._lock:
                        self._errors.append(error)
                finally:
                    self.completion_queue.task_done()
        finally:
            store.close()

    def run(self, jobs: ExtractionJobProducer | Iterable[Mapping[str, Any]] = ()) -> list[dict[str, Any]]:
        self.reconcile()
        store = self._store()
        try:
            store.recover_expired_leases()
        finally:
            store.close()
        consumer = threading.Thread(target=self._consumer, args=(self.max_concurrency,), name="extraction-completion", daemon=True)
        consumer.start()
        producer = threading.Thread(target=self._producer, args=(jobs,), name="extraction-producer", daemon=True)
        producer.start()
        workers = [threading.Thread(target=self._worker, args=(index,), name=f"extraction-{index}", daemon=True)
                   for index in range(self.max_concurrency)]
        for worker in workers:
            worker.start()
        producer.join()
        for worker in workers:
            worker.join()
            self.completion_queue.put(None)
        self.completion_queue.join()
        consumer.join()
        if self._errors:
            raise ConveyorError(f"Extraction coordinator failed: {self._errors[0]}") from self._errors[0]
        return list(self._results)


def run_extraction_batch(
    jobs: Sequence[Mapping[str, Any]],
    invoke: Callable[[Mapping[str, Any]], Any],
    *,
    max_concurrency: int = DEFAULT_LUNA_CAP,
) -> list[Any]:
    """Compatibility helper for injected callers, with the same hard eight-call ceiling."""
    if max_concurrency < 1 or max_concurrency > MAX_LUNA_CAP:
        raise ConveyorError(f"Extraction concurrency must be between 1 and {MAX_LUNA_CAP}")
    with ThreadPoolExecutor(max_workers=max_concurrency) as executor:
        return list(executor.map(invoke, jobs))


def top_failure_reasons(rows: Iterable[Mapping[str, Any]], limit: int = 3) -> list[tuple[str, int]]:
    counter = Counter(row.get("reason") or "unspecified" for row in rows if str(row.get("state", "")).startswith("failed_"))
    return counter.most_common(limit)


def top_recorded_reasons(rows: Iterable[Mapping[str, Any]], limit: int = 3) -> list[tuple[str, int]]:
    counter = Counter(row.get("reason") for row in rows if row.get("reason"))
    return counter.most_common(limit)
