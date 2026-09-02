"""Resumable conveyor primitives for bulk datasheet-to-model staging."""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

SCHEMA_VERSION = "1.0.0"
# The on-disk state database carries its own version so a migration can be detected
# independently of the JSON payload contract.
STATE_SCHEMA_VERSION = "1.1.0"
LINEAR_STATES = ("selected", "datasheet_fetched", "extracted", "fitted", "staged")
FAILURE_STATES = tuple(f"failed_{stage}" for stage in LINEAR_STATES[1:])
ALL_STATES = set(LINEAR_STATES + FAILURE_STATES)
FAMILY_QUOTAS = {"diode": 18, "bjt": 16, "mosfet": 16}
SUPPORTED_FAMILIES = ("diode", "bjt", "mosfet")

# A part is claimable while it still has unfinished conveyor work. Terminal buckets
# (staged, and anything whose reason was recorded as a deliberate skip) are excluded so an
# unattended nightly loop can never re-lease work that will never complete.
CLAIMABLE_STATES = (
    "selected",
    "datasheet_fetched",
    "extracted",
    "fitted",
    "failed_datasheet_fetched",
    "failed_extracted",
    "failed_fitted",
)
# Reasons that mark a row as deliberately abandoned rather than retryable. `skipped:` is
# written by fetch when a gated datasheet has no manual drop; `selection skipped:` is the
# factory staging guard rejecting a candidate. Neither is worth another night of tokens.
SKIP_REASON_PREFIXES = ("skipped:", "selection skipped:")
DEFAULT_MAX_ATTEMPTS = 3


def is_skipped_reason(reason: str | None) -> bool:
    return str(reason or "").startswith(SKIP_REASON_PREFIXES)

_PARTS_COLUMNS_V1_1_0 = (
    ("claimed_by", "TEXT"),
    ("claim_expires_at", "TEXT"),
    ("tokens_in", "INTEGER NOT NULL DEFAULT 0"),
    ("tokens_out", "INTEGER NOT NULL DEFAULT 0"),
    ("llm_model", "TEXT"),
    ("wall_seconds", "REAL NOT NULL DEFAULT 0"),
)


class ConveyorError(RuntimeError):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()


def sha256_file(path: Path, block_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while block := handle.read(block_size):
            digest.update(block)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


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
        self.connection = sqlite3.connect(path)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
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
        """)
        self.connection.commit()
        self.migration = self._migrate()

    def _migrate(self) -> dict[str, Any]:
        """Bring an existing database up to STATE_SCHEMA_VERSION in place.

        Every migration is additive. Batches 1 to 9 ran on the 1.0.0 shape, so an old
        database must keep every existing row, transition and retry count while gaining the
        lease and cost columns the unattended nightly loop needs.
        """
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cost_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tranche TEXT NOT NULL,
              lcsc_id TEXT NOT NULL,
              stage TEXT NOT NULL,
              worker_id TEXT,
              llm_model TEXT,
              tokens_in INTEGER NOT NULL DEFAULT 0,
              tokens_out INTEGER NOT NULL DEFAULT 0,
              wall_seconds REAL NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS cost_events_part ON cost_events (tranche, lcsc_id);
        """)
        present = {row["name"] for row in self.connection.execute("PRAGMA table_info(parts)")}
        previous_row = self.connection.execute(
            "SELECT value FROM meta WHERE key = 'schema_version'"
        ).fetchone()
        previous = previous_row["value"] if previous_row else None
        added: list[str] = []
        with self.connection:
            for column, declaration in _PARTS_COLUMNS_V1_1_0:
                if column not in present:
                    self.connection.execute(f"ALTER TABLE parts ADD COLUMN {column} {declaration}")
                    added.append(column)
            self.connection.execute(
                "CREATE INDEX IF NOT EXISTS parts_claim ON parts (tranche, state, claimed_by)"
            )
            self.connection.execute(
                "INSERT INTO meta (key, value) VALUES ('schema_version', ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (STATE_SCHEMA_VERSION,),
            )
            if added or previous is None:
                self.connection.execute(
                    "INSERT INTO meta (key, value) VALUES ('migrated_at', ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (utc_now(),),
                )
        return {
            "schema_version": STATE_SCHEMA_VERSION,
            "previous_schema_version": previous,
            "columns_added": added,
        }

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

    # ----------------------------------------------------------------- leases

    def claim(
        self,
        tranche: str,
        worker_id: str,
        count: int,
        ttl_seconds: int,
        *,
        states: Sequence[str] = CLAIMABLE_STATES,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
        now: dt.datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Atomically lease up to `count` unclaimed parts for one worker.

        The lease is one UPDATE with a bounded subquery, so two workers racing on the same
        tranche cannot both take the same row: SQLite serializes the write and the loser
        sees the rows already claimed. An expired lease is reclaimable, which is what makes
        a killed nightly session recoverable without any human touch.
        """
        if not str(worker_id).strip():
            raise ConveyorError("A claim needs a non-empty worker id")
        if count < 1:
            raise ConveyorError("A claim must request at least one part")
        if ttl_seconds < 1:
            raise ConveyorError("A claim TTL must be at least one second")
        unknown = set(states) - ALL_STATES
        if unknown:
            raise ConveyorError(f"Unknown claimable states: {', '.join(sorted(unknown))}")
        moment = (now or dt.datetime.now(dt.UTC)).replace(microsecond=0)
        stamp = moment.isoformat()
        expiry = (moment + dt.timedelta(seconds=ttl_seconds)).isoformat()
        placeholders = ", ".join("?" for _ in states)
        skip_clause = " ".join("AND COALESCE(reason, '') NOT LIKE ?" for _ in SKIP_REASON_PREFIXES)
        skip_values = [f"{prefix}%" for prefix in SKIP_REASON_PREFIXES]
        # RETURNING (SQLite 3.35+) names exactly the rows this statement changed, which is
        # the only report that stays correct when the same worker claims twice inside one
        # second: a select-back by worker and expiry cannot tell the two calls apart.
        statement = f"""UPDATE parts SET claimed_by = ?, claim_expires_at = ?
                    WHERE rowid IN (
                      SELECT rowid FROM parts
                      WHERE tranche = ?
                        AND state IN ({placeholders})
                        AND attempts < ?
                        {skip_clause}
                        AND (claimed_by IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                      ORDER BY rowid
                      LIMIT ?)"""
        values = (worker_id, expiry, tranche, *states, max_attempts, *skip_values, stamp, count)
        with self.connection:
            claimed = self.connection.execute(f"{statement} RETURNING rowid, *", values).fetchall()
        rows = sorted((dict(row) for row in claimed), key=lambda row: row["rowid"])
        for row in rows:
            row.pop("rowid", None)
        return rows

    def held(self, tranche: str, worker_id: str, *, now: dt.datetime | None = None) -> list[dict[str, Any]]:
        """Rows this worker still holds an unexpired lease on."""
        stamp = (now or dt.datetime.now(dt.UTC)).replace(microsecond=0).isoformat()
        return [dict(row) for row in self.connection.execute(
            "SELECT * FROM parts WHERE tranche = ? AND claimed_by = ? AND claim_expires_at > ? ORDER BY rowid",
            (tranche, worker_id, stamp),
        )]

    def release(self, tranche: str, lcsc_id: str) -> None:
        with self.connection:
            self.connection.execute(
                "UPDATE parts SET claimed_by = NULL, claim_expires_at = NULL WHERE tranche = ? AND lcsc_id = ?",
                (tranche, lcsc_id),
            )

    def release_worker(self, tranche: str, worker_id: str) -> int:
        with self.connection:
            cursor = self.connection.execute(
                "UPDATE parts SET claimed_by = NULL, claim_expires_at = NULL WHERE tranche = ? AND claimed_by = ?",
                (tranche, worker_id),
            )
        return int(cursor.rowcount or 0)

    def claim_summary(self, tranche: str, *, now: dt.datetime | None = None) -> dict[str, Any]:
        stamp = (now or dt.datetime.now(dt.UTC)).replace(microsecond=0).isoformat()
        rows = self.rows(tranche)
        active = Counter()
        expired = 0
        for row in rows:
            if not row.get("claimed_by"):
                continue
            if (row.get("claim_expires_at") or "") > stamp:
                active[row["claimed_by"]] += 1
            else:
                expired += 1
        return {"active": dict(sorted(active.items())), "expired": expired, "now": stamp}

    # ------------------------------------------------------- cost accounting

    def record_cost(
        self,
        tranche: str,
        lcsc_id: str,
        stage: str,
        *,
        tokens_in: int = 0,
        tokens_out: int = 0,
        wall_seconds: float = 0.0,
        llm_model: str | None = None,
        worker_id: str | None = None,
    ) -> None:
        if stage not in LINEAR_STATES[1:]:
            raise ConveyorError(f"Invalid cost stage: {stage}")
        with self.connection:
            self.connection.execute(
                """INSERT INTO cost_events
                   (tranche, lcsc_id, stage, worker_id, llm_model, tokens_in, tokens_out, wall_seconds, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (tranche, lcsc_id, stage, worker_id, llm_model, int(tokens_in), int(tokens_out),
                 float(wall_seconds), utc_now()),
            )
            self.connection.execute(
                """UPDATE parts
                   SET tokens_in = COALESCE(tokens_in, 0) + ?,
                       tokens_out = COALESCE(tokens_out, 0) + ?,
                       wall_seconds = COALESCE(wall_seconds, 0) + ?,
                       llm_model = COALESCE(?, llm_model)
                   WHERE tranche = ? AND lcsc_id = ?""",
                (int(tokens_in), int(tokens_out), float(wall_seconds), llm_model, tranche, lcsc_id),
            )

    def cost_summary(self, tranche: str) -> dict[str, Any]:
        per_stage = {}
        for row in self.connection.execute(
            """SELECT stage, count(*) AS events, count(DISTINCT lcsc_id) AS parts,
                      COALESCE(sum(tokens_in), 0) AS tokens_in,
                      COALESCE(sum(tokens_out), 0) AS tokens_out,
                      COALESCE(sum(wall_seconds), 0) AS wall_seconds
               FROM cost_events WHERE tranche = ? GROUP BY stage ORDER BY stage""",
            (tranche,),
        ):
            per_stage[row["stage"]] = {
                "events": row["events"],
                "parts": row["parts"],
                "tokens_in": row["tokens_in"],
                "tokens_out": row["tokens_out"],
                "wall_seconds": round(row["wall_seconds"], 3),
            }
        parts = [dict(row) for row in self.connection.execute(
            """SELECT lcsc_id, mpn, family, state, fidelity, llm_model,
                      COALESCE(tokens_in, 0) AS tokens_in,
                      COALESCE(tokens_out, 0) AS tokens_out,
                      COALESCE(wall_seconds, 0) AS wall_seconds
               FROM parts WHERE tranche = ? ORDER BY rowid""",
            (tranche,),
        )]
        charged = [row for row in parts if row["tokens_in"] or row["tokens_out"] or row["wall_seconds"]]
        promoted = [row for row in charged if row["state"] == "staged"]
        totals = {
            "tokens_in": sum(row["tokens_in"] for row in charged),
            "tokens_out": sum(row["tokens_out"] for row in charged),
            "wall_seconds": round(sum(row["wall_seconds"] for row in charged), 3),
            "parts_charged": len(charged),
            "parts_staged": len(promoted),
        }
        totals["tokens_total"] = totals["tokens_in"] + totals["tokens_out"]
        if promoted:
            totals["tokens_per_staged_part"] = round(totals["tokens_total"] / len(promoted), 1)
            totals["wall_seconds_per_staged_part"] = round(totals["wall_seconds"] / len(promoted), 1)
        else:
            totals["tokens_per_staged_part"] = None
            totals["wall_seconds_per_staged_part"] = None
        return {
            "per_stage": per_stage,
            "per_staged_part": [
                {
                    "lcsc_id": row["lcsc_id"],
                    "mpn": row["mpn"],
                    "family": row["family"],
                    "fidelity": row["fidelity"],
                    "llm_model": row["llm_model"],
                    "tokens_in": row["tokens_in"],
                    "tokens_out": row["tokens_out"],
                    "wall_seconds": round(row["wall_seconds"], 3),
                }
                for row in promoted
            ],
            "totals": totals,
        }


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


def validate_schema(
    instance: Any,
    schema: Mapping[str, Any],
    trail: str = "$",
    root_schema: Mapping[str, Any] | None = None,
    ref_stack: tuple[str, ...] = (),
) -> None:
    """Small strict validator for the checked-in schema vocabulary."""
    if not isinstance(schema, Mapping):
        raise ConveyorError(f"{trail} uses a non-object schema")
    if root_schema is None:
        root_schema = schema
    if "$ref" in schema:
        reference = schema["$ref"]
        if set(schema) != {"$ref"}:
            raise ConveyorError(f"{trail} uses unsupported sibling keywords beside $ref")
        if not isinstance(reference, str) or not reference.startswith("#/"):
            raise ConveyorError(f"{trail} uses unsupported schema reference {reference!r}")
        if reference in ref_stack:
            raise ConveyorError(f"{trail} uses circular schema reference {reference!r}")
        target: Any = root_schema
        for token in reference[2:].split("/"):
            key = token.replace("~1", "/").replace("~0", "~")
            if not isinstance(target, Mapping) or key not in target:
                raise ConveyorError(f"{trail} uses unresolved schema reference {reference!r}")
            target = target[key]
        if not isinstance(target, Mapping):
            raise ConveyorError(f"{trail} schema reference {reference!r} does not resolve to an object")
        validate_schema(instance, target, trail, root_schema, (*ref_stack, reference))
        return
    if "anyOf" in schema:
        errors = []
        for candidate in schema["anyOf"]:
            try:
                validate_schema(instance, candidate, trail, root_schema, ref_stack)
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
            validate_schema(instance, {**schema, "type": candidates[0]}, trail, root_schema, ref_stack)
            return
    elif expected == "object" and not isinstance(instance, dict):
        raise ConveyorError(f"{trail} must be an object")
    elif expected == "array" and not isinstance(instance, list):
        raise ConveyorError(f"{trail} must be an array")
    elif expected == "string" and not isinstance(instance, str):
        raise ConveyorError(f"{trail} must be a string")
    elif expected == "number" and (not isinstance(instance, (int, float)) or isinstance(instance, bool) or not math.isfinite(instance)):
        raise ConveyorError(f"{trail} must be a finite number")
    elif expected == "integer" and (not isinstance(instance, int) or isinstance(instance, bool)):
        raise ConveyorError(f"{trail} must be an integer")
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
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            raise ConveyorError(f"{trail} must be at least {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            raise ConveyorError(f"{trail} must be at most {schema['maximum']}")
    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            raise ConveyorError(f"{trail} has too few items")
        for index, item in enumerate(instance):
            validate_schema(item, schema.get("items", {}), f"{trail}[{index}]", root_schema, ref_stack)
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
                validate_schema(value, properties[key], f"{trail}.{key}", root_schema, ref_stack)


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


_MOSFET_BIAS_QUANTITIES = {
    "vgs": "vgs", "v_gs": "vgs",
    "vds": "vds", "v_ds": "vds",
    "id": "id", "i_d": "id",
}
_MOSFET_TEMPERATURE_KINDS = {"ambient", "case", "junction"}
_MOSFET_TEMPERATURE_PROVENANCE = {
    "inline_condition", "table_heading", "figure_label", "footnote", "section_scope",
}
_MOSFET_TEST_MODES = {"dc", "continuous", "pulsed", "single_pulse", "not_stated"}
_MOSFET_MAGNITUDE_CONVENTIONS = {"signed", "absolute"}


def _require_exact_keys(value: Any, required: set[str], optional: set[str], trail: str) -> None:
    if not isinstance(value, dict):
        raise ConveyorError(f"{trail} must be an object")
    actual = set(value)
    missing = required - actual
    extra = actual - required - optional
    if missing or extra:
        detail = []
        if missing:
            detail.append(f"missing {', '.join(sorted(missing))}")
        if extra:
            detail.append(f"unknown {', '.join(sorted(extra))}")
        raise ConveyorError(f"{trail} is incomplete: {'; '.join(detail)}")


def _finite_number(value: Any, trail: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ConveyorError(f"{trail} must be a finite number")
    return float(value)


def _validate_voltage_condition(value: Any, trail: str) -> None:
    _require_exact_keys(value, {"kind"}, {"value_v", "relation", "lower_v", "upper_v"}, trail)
    if value["kind"] == "fixed":
        _require_exact_keys(value, {"kind", "value_v"}, set(), trail)
        _finite_number(value["value_v"], f"{trail}.value_v")
    elif value["kind"] == "relation":
        _require_exact_keys(value, {"kind", "relation"}, set(), trail)
        if not isinstance(value["relation"], str) or not value["relation"].strip():
            raise ConveyorError(f"{trail}.relation must be a non-empty string")
    elif value["kind"] == "range":
        _require_exact_keys(value, {"kind", "lower_v", "upper_v"}, set(), trail)
        if not _finite_number(value["lower_v"], f"{trail}.lower_v") < _finite_number(value["upper_v"], f"{trail}.upper_v"):
            raise ConveyorError(f"{trail} range must be increasing")
    else:
        raise ConveyorError(f"{trail}.kind is unknown")


def _validate_current_condition(value: Any, trail: str) -> None:
    _require_exact_keys(value, {"kind"}, {"value_a", "lower_a", "upper_a"}, trail)
    if value["kind"] == "fixed":
        _require_exact_keys(value, {"kind", "value_a"}, set(), trail)
        _finite_number(value["value_a"], f"{trail}.value_a")
    elif value["kind"] == "range":
        _require_exact_keys(value, {"kind", "lower_a", "upper_a"}, set(), trail)
        if not _finite_number(value["lower_a"], f"{trail}.lower_a") < _finite_number(value["upper_a"], f"{trail}.upper_a"):
            raise ConveyorError(f"{trail} range must be increasing")
    else:
        raise ConveyorError(f"{trail}.kind is unknown")


def _validate_typed_test_mode(value: Any, trail: str, *, allow_not_stated: bool) -> None:
    _require_exact_keys(
        value,
        {"kind"},
        {"pulse_width_s", "duty_cycle", "repetition_period_s", "repetition_frequency_hz"},
        trail,
    )
    mode = value["kind"]
    if mode not in _MOSFET_TEST_MODES or (mode == "not_stated" and not allow_not_stated):
        raise ConveyorError(f"{trail}.kind must explicitly state dc, continuous, pulsed, or single_pulse")
    pulse_fields = {"pulse_width_s", "duty_cycle", "repetition_period_s", "repetition_frequency_hz"} & set(value)
    if mode in {"pulsed", "single_pulse"}:
        if _finite_number(value.get("pulse_width_s"), f"{trail}.pulse_width_s") <= 0:
            raise ConveyorError(f"{trail}.pulse_width_s must be a positive finite number for {mode}")
    elif pulse_fields:
        raise ConveyorError(f"{trail} cannot attach pulse timing to {mode} data")
    for field in sorted(pulse_fields - {"pulse_width_s"}):
        numeric = _finite_number(value[field], f"{trail}.{field}")
        if numeric <= 0 or (field == "duty_cycle" and numeric > 1):
            raise ConveyorError(f"{trail}.{field} is outside its physical range")


def _validate_direct_scalar_condition(
    value: Any,
    trail: str,
    *,
    polarity: str,
    characteristic: str,
) -> None:
    _require_exact_keys(value, {"polarity", "magnitude_convention", "temperature", "electrical", "test_mode"}, set(), trail)
    if value["polarity"] != polarity:
        raise ConveyorError(f"{trail}.polarity must match $.specs.polarity")
    if value["magnitude_convention"] not in _MOSFET_MAGNITUDE_CONVENTIONS:
        raise ConveyorError(f"{trail}.magnitude_convention must be signed or absolute")

    temperature = value["temperature"]
    _require_exact_keys(temperature, {"status", "kind", "value_c", "provenance"}, set(), f"{trail}.temperature")
    if temperature["status"] != "stated":
        raise ConveyorError(f"{trail}.temperature.status must be stated")
    if temperature["kind"] not in _MOSFET_TEMPERATURE_KINDS:
        raise ConveyorError(f"{trail}.temperature.kind must state ambient, case, or junction")
    _finite_number(temperature["value_c"], f"{trail}.temperature.value_c")
    if temperature["provenance"] not in _MOSFET_TEMPERATURE_PROVENANCE:
        raise ConveyorError(f"{trail}.temperature.provenance must use a canonical source location")

    electrical = value["electrical"]
    _require_exact_keys(electrical, {"vgs", "vds", "id"}, set(), f"{trail}.electrical")
    _validate_voltage_condition(electrical["vgs"], f"{trail}.electrical.vgs")
    _validate_voltage_condition(electrical["vds"], f"{trail}.electrical.vds")
    _validate_current_condition(electrical["id"], f"{trail}.electrical.id")
    _validate_typed_test_mode(value["test_mode"], f"{trail}.test_mode", allow_not_stated=characteristic == "gate_threshold")

    if characteristic == "gate_threshold":
        for quantity in ("vgs", "vds"):
            coordinate = electrical[quantity]
            if coordinate.get("kind") != "relation" or coordinate.get("relation") != "vds_equals_vgs":
                raise ConveyorError(f"{trail}.electrical.{quantity} must preserve vds_equals_vgs")
        if electrical["id"].get("kind") != "fixed":
            raise ConveyorError(f"{trail}.electrical.id must be fixed for gate threshold evidence")
        if _finite_number(electrical["id"]["value_a"], f"{trail}.electrical.id.value_a") <= 0:
            raise ConveyorError(f"{trail}.electrical.id.value_a must be a positive canonical magnitude")
    else:
        if electrical["vgs"].get("kind") != "fixed" or electrical["id"].get("kind") != "fixed":
            raise ConveyorError(f"{trail}.electrical must use fixed VGS and ID for RDS(on) evidence")
        if electrical["vds"].get("kind") != "relation" or electrical["vds"].get("relation") != "saturation_region":
            raise ConveyorError(f"{trail}.electrical.vds must preserve saturation_region for RDS(on) evidence")
        if _finite_number(electrical["vgs"]["value_v"], f"{trail}.electrical.vgs.value_v") <= 0:
            raise ConveyorError(f"{trail}.electrical.vgs.value_v must be a positive canonical magnitude")
        if _finite_number(electrical["id"]["value_a"], f"{trail}.electrical.id.value_a") <= 0:
            raise ConveyorError(f"{trail}.electrical.id.value_a must be a positive canonical magnitude")


def _mosfet_axis_quantity(value: Any) -> str | None:
    return _MOSFET_BIAS_QUANTITIES.get(str(value).casefold())


def _require_locator(value: Any, fields: set[str], trail: str) -> None:
    if not isinstance(value, dict):
        raise ConveyorError(f"{trail} must be an object")
    if set(value) != fields:
        missing = fields - set(value)
        extra = set(value) - fields
        detail = []
        if missing:
            detail.append(f"missing {', '.join(sorted(missing))}")
        if extra:
            detail.append(f"unknown {', '.join(sorted(extra))}")
        raise ConveyorError(f"{trail} is incomplete: {'; '.join(detail)}")
    page = value["page"]
    if not isinstance(page, int) or isinstance(page, bool) or page < 1:
        raise ConveyorError(f"{trail}.page must be a positive integer")
    for field in sorted(fields - {"page"}):
        if not isinstance(value[field], str) or not value[field].strip():
            raise ConveyorError(f"{trail}.{field} must be a non-empty string")


def _validate_mosfet_critical_provenance(payload: Mapping[str, Any]) -> None:
    """Fail closed on fresh MOSFET evidence before any fitting can begin."""
    scalar_fields = (
        "threshold_min", "threshold_typ", "threshold_max", "ciss", "coss", "crss",
        "breakdown_voltage", "body_diode",
    )
    specs = payload["specs"]
    polarity = specs["polarity"]
    for field in scalar_fields:
        quantity = specs[field]
        if quantity is not None:
            _require_locator(quantity.get("locator"), {"page", "table", "row"}, f"$.specs.{field}.locator")
    for field in ("threshold_min", "threshold_typ", "threshold_max"):
        quantity = specs[field]
        if quantity is not None:
            _validate_direct_scalar_condition(
                quantity.get("condition"),
                f"$.specs.{field}.condition",
                polarity=polarity,
                characteristic="gate_threshold",
            )
            if _finite_number(quantity.get("value"), f"$.specs.{field}.value") < 0 and quantity["condition"]["magnitude_convention"] == "absolute":
                raise ConveyorError(f"$.specs.{field}.value is signed but its direct condition declares absolute magnitude")
    for index, point in enumerate(specs["rdson_points"]):
        direct_conditions = []
        for field in ("vgs", "current", "resistance"):
            _require_locator(
                point[field].get("locator"),
                {"page", "table", "row"},
                f"$.specs.rdson_points[{index}].{field}.locator",
            )
            direct_condition = point[field].get("condition")
            _validate_direct_scalar_condition(
                direct_condition,
                f"$.specs.rdson_points[{index}].{field}.condition",
                polarity=polarity,
                characteristic="rds_on",
            )
            direct_conditions.append(direct_condition)
        if not all(condition == direct_conditions[0] for condition in direct_conditions[1:]):
            raise ConveyorError(f"$.specs.rdson_points[{index}] must carry one identical direct condition for VGS, ID, and resistance")
        condition_electrical = direct_conditions[0]["electrical"]
        raw_vgs = _finite_number(point["vgs"].get("value"), f"$.specs.rdson_points[{index}].vgs.value")
        raw_current = _finite_number(point["current"].get("value"), f"$.specs.rdson_points[{index}].current.value")
        if (raw_vgs < 0 or raw_current < 0) and direct_conditions[0]["magnitude_convention"] == "absolute":
            raise ConveyorError(f"$.specs.rdson_points[{index}] has signed VGS or ID values but its direct condition declares absolute magnitude")
        if not math.isclose(abs(raw_vgs), abs(condition_electrical["vgs"]["value_v"]), rel_tol=1e-9, abs_tol=1e-12):
            raise ConveyorError(f"$.specs.rdson_points[{index}].vgs.value contradicts its direct condition")
        if not math.isclose(abs(raw_current), abs(condition_electrical["id"]["value_a"]), rel_tol=1e-9, abs_tol=1e-12):
            raise ConveyorError(f"$.specs.rdson_points[{index}].current.value contradicts its direct condition")

    for index, curve in enumerate(payload["curves"]):
        trail = f"$.curves[{index}]"
        _require_locator(curve.get("locator"), {"page", "figure", "curve_or_trace"}, f"{trail}.locator")
        if curve.get("magnitude_convention") not in _MOSFET_MAGNITUDE_CONVENTIONS:
            raise ConveyorError(f"{trail}.magnitude_convention must be signed or absolute")

        temperature = curve.get("temperature")
        if not isinstance(temperature, dict):
            raise ConveyorError(f"{trail}.temperature must be an object")
        kind = temperature.get("kind")
        value = temperature.get("value")
        provenance = temperature.get("provenance")
        if kind not in _MOSFET_TEMPERATURE_KINDS:
            raise ConveyorError(f"{trail}.temperature.kind must state ambient, case, or junction")
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
            raise ConveyorError(f"{trail}.temperature.value must be a finite Celsius value")
        if provenance not in _MOSFET_TEMPERATURE_PROVENANCE:
            raise ConveyorError(f"{trail}.temperature.provenance must use a canonical source location")

        electrical_bias = curve.get("electrical_bias")
        if not isinstance(electrical_bias, list) or not electrical_bias:
            raise ConveyorError(f"{trail}.electrical_bias must state at least one fixed electrical bias")
        seen_biases: set[str] = set()
        for bias_index, bias in enumerate(electrical_bias):
            bias_trail = f"{trail}.electrical_bias[{bias_index}]"
            quantity = bias.get("quantity") if isinstance(bias, dict) else None
            canonical = _MOSFET_BIAS_QUANTITIES.get(str(quantity).casefold())
            if canonical is None:
                raise ConveyorError(f"{bias_trail}.quantity must be VGS, V_GS, VDS, V_DS, ID, or I_D")
            if canonical in seen_biases:
                raise ConveyorError(f"{trail}.electrical_bias has duplicate or conflicting {canonical} entries")
            seen_biases.add(canonical)
            bias_value = bias.get("value")
            if not isinstance(bias_value, (int, float)) or isinstance(bias_value, bool) or not math.isfinite(bias_value):
                raise ConveyorError(f"{bias_trail}.value must be a finite number")
            if bias_value == 0:
                raise ConveyorError(f"{bias_trail}.value must be non-zero")
            if bias_value < 0 and curve["magnitude_convention"] == "absolute":
                raise ConveyorError(f"{bias_trail}.value is signed but the curve declares absolute magnitude")
            if not isinstance(bias.get("unit"), str) or not bias["unit"].strip():
                raise ConveyorError(f"{bias_trail}.unit must be a non-empty string")

        x_axis = curve.get("x_axis", {}).get("quantity")
        y_axis = curve.get("y_axis", {}).get("quantity")
        for axis, label in ((x_axis, "x_axis"), (y_axis, "y_axis")):
            if re.fullmatch(r"(?:V_?(?:GS|DS)|I_?D)\s+magnitude", str(axis).strip(), re.I):
                raise ConveyorError(f"{trail}.{label}.quantity must use canonical VGS, VDS, or ID without a magnitude suffix")
            axis_words = str(axis).casefold()
            if (
                all(word in axis_words for word in ("gate", "source", "voltage"))
                or all(word in axis_words for word in ("drain", "source", "voltage"))
                or all(word in axis_words for word in ("drain", "current"))
            ):
                raise ConveyorError(f"{trail}.{label}.quantity must use an exact VGS, V_GS, VDS, V_DS, ID, or I_D alias")
        x_quantity = _mosfet_axis_quantity(x_axis)
        y_quantity = _mosfet_axis_quantity(y_axis)
        required_bias = "vds" if (x_quantity, y_quantity) == ("vgs", "id") else (
            "vgs" if (x_quantity, y_quantity) == ("vds", "id") else None
        )
        if required_bias is None and (x_quantity is not None or y_quantity is not None):
            raise ConveyorError(f"{trail} has an unsupported MOSFET electrical axis pairing")
        if required_bias is not None and seen_biases != {required_bias}:
            raise ConveyorError(f"{trail}.electrical_bias must contain exactly one fixed {required_bias.upper()} record")

        _validate_typed_test_mode(curve.get("test_mode"), f"{trail}.test_mode", allow_not_stated=False)
        if curve["magnitude_convention"] == "absolute" and any(
            point.get(axis, 0) < 0
            for point in curve.get("points", []) if isinstance(point, dict)
            for axis in ("x", "y")
        ):
            raise ConveyorError(f"{trail}.magnitude_convention absolute contradicts signed curve coordinates")


def load_and_translate_mosfet_evidence_envelope(
    path: Path,
    schema_path: Path,
    output_schema_path: Path,
) -> dict[str, Any]:
    """Expand a flat, source-reviewed MOSFET envelope into the strict extraction contract."""
    try:
        envelope = json.loads(path.read_text(encoding="utf-8"))
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        output_schema = json.loads(output_schema_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConveyorError(f"Invalid MOSFET evidence envelope {path}: {error}") from error
    if not isinstance(envelope, dict):
        raise ConveyorError(f"Invalid MOSFET evidence envelope {path}: root must be an object")
    validate_schema(envelope, schema)

    polarity = envelope["polarity"]

    def direct_condition(record: Mapping[str, Any], *, characteristic: str) -> dict[str, Any]:
        temperature = record["temperature"]
        if characteristic == "gate_threshold":
            electrical = {
                "vgs": {"kind": "relation", "relation": "vds_equals_vgs"},
                "vds": {"kind": "relation", "relation": "vds_equals_vgs"},
                "id": {"kind": "fixed", "value_a": abs(record["id_a"])},
            }
        else:
            electrical = {
                "vgs": {"kind": "fixed", "value_v": abs(record["vgs_v"])},
                "vds": {"kind": "relation", "relation": "saturation_region"},
                "id": {"kind": "fixed", "value_a": abs(record["id_a"])},
            }
        return {
            "polarity": polarity,
            "magnitude_convention": record["magnitude_convention"],
            "temperature": {
                "status": "stated",
                "kind": temperature["kind"],
                "value_c": temperature["value_c"],
                "provenance": temperature["provenance"],
            },
            "electrical": electrical,
            "test_mode": dict(record["test_mode"]),
        }

    def scalar_datum(
        record: Mapping[str, Any],
        *,
        value: float,
        unit: str,
        source_kind: str,
        condition: Mapping[str, Any],
    ) -> dict[str, Any]:
        return {
            "value": value,
            "unit": unit,
            "conditions": record["conditions"],
            "page_reference": record["page_reference"],
            "locator": dict(record["locator"]),
            "condition": dict(condition),
            "source_kind": source_kind,
        }

    threshold_fields = {"minimum_v": "minimum", "typical_v": "typical", "maximum_v": "maximum"}
    threshold_output: dict[str, Any] = {
        "threshold_min": None,
        "threshold_typ": None,
        "threshold_max": None,
    }
    threshold = envelope["threshold"]
    if threshold is not None:
        present = [field for field in threshold_fields if threshold[field] is not None]
        if not present:
            raise ConveyorError("MOSFET evidence envelope threshold must contain at least one source value")
        condition = direct_condition(threshold, characteristic="gate_threshold")
        output_names = {"minimum_v": "threshold_min", "typical_v": "threshold_typ", "maximum_v": "threshold_max"}
        for field in present:
            threshold_output[output_names[field]] = scalar_datum(
                threshold,
                value=threshold[field],
                unit="V",
                source_kind=threshold_fields[field],
                condition=condition,
            )

    rdson_output = []
    for index, record in enumerate(envelope["rdson_points"]):
        resistance_fields = {"typical_ohm": "typical", "maximum_ohm": "maximum"}
        present = [field for field in resistance_fields if record[field] is not None]
        if not present:
            raise ConveyorError(f"MOSFET evidence envelope rdson_points[{index}] must contain a typical or maximum resistance")
        condition = direct_condition(record, characteristic="rds_on")
        for field in present:
            source_kind = resistance_fields[field]
            rdson_output.append({
                "vgs": scalar_datum(record, value=record["vgs_v"], unit="V", source_kind=source_kind, condition=condition),
                "current": scalar_datum(record, value=record["id_a"], unit="A", source_kind=source_kind, condition=condition),
                "resistance": scalar_datum(record, value=record[field], unit="ohm", source_kind=source_kind, condition=condition),
            })

    payload = {
        "schema_version": "1.0.0",
        "mpn": envelope["mpn"],
        "manufacturer": envelope["manufacturer"],
        "family": "mosfet",
        "datasheet_identity": dict(envelope["datasheet_identity"]),
        "usable_curves": False,
        "curves": [],
        "specs": {
            "polarity": polarity,
            **threshold_output,
            "rdson_points": rdson_output,
            "ciss": None,
            "coss": None,
            "crss": None,
            "breakdown_voltage": None,
            "body_diode": None,
        },
        "extraction_notes": list(envelope["extraction_notes"]),
        "omission_reason": envelope["omission_reason"],
    }
    validate_schema(payload, output_schema)
    _validate_mosfet_critical_provenance(payload)
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
    if payload.get("family") == "mosfet":
        _validate_mosfet_critical_provenance(payload)
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


def run_extraction_batch(
    jobs: Sequence[Mapping[str, Any]],
    invoke: Callable[[Mapping[str, Any]], Any],
    *,
    max_concurrency: int = 4,
) -> list[Any]:
    """Dispatch extraction jobs through an injected caller with a hard four-call ceiling.

    The injected callable runs on a worker thread and must not touch the SQLite state
    store: subprocess work and file writes happen here, and every state transition is
    applied serially by the caller once the batch returns.
    """
    if max_concurrency < 1 or max_concurrency > 4:
        raise ConveyorError("Extraction concurrency must be between 1 and 4")
    with ThreadPoolExecutor(max_workers=max_concurrency) as executor:
        return list(executor.map(invoke, jobs))


# --------------------------------------------------------------- invoker plumbing

_USAGE_KEYS = {
    "usage", "tokens_in", "tokens_out", "input_tokens", "output_tokens",
    "prompt_tokens", "completion_tokens", "total_tokens",
    "model", "llm_model", "wall_seconds", "cost_usd", "duration_ms",
    "cache_creation_input_tokens", "cache_read_input_tokens",
}
_TOKENS_IN_KEYS = ("tokens_in", "input_tokens", "prompt_tokens")
_TOKENS_OUT_KEYS = ("tokens_out", "output_tokens", "completion_tokens")


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    lines = lines[1:]
    while lines and lines[-1].strip() != "```":
        lines.pop()
    if lines and lines[-1].strip() == "```":
        lines.pop()
    return "\n".join(lines).strip()


def _normalize_usage(raw: Mapping[str, Any]) -> dict[str, Any]:
    source = dict(raw)
    nested = source.get("usage")
    if isinstance(nested, Mapping):
        merged = {key: value for key, value in source.items() if key != "usage"}
        merged.update(nested)
        source = merged
    usage = {"tokens_in": 0, "tokens_out": 0, "llm_model": None, "wall_seconds": None}
    for key in _TOKENS_IN_KEYS:
        if isinstance(source.get(key), (int, float)) and not isinstance(source.get(key), bool):
            usage["tokens_in"] = int(source[key])
            break
    for key in _TOKENS_OUT_KEYS:
        if isinstance(source.get(key), (int, float)) and not isinstance(source.get(key), bool):
            usage["tokens_out"] = int(source[key])
            break
    for key in ("llm_model", "model"):
        if isinstance(source.get(key), str) and source[key].strip():
            usage["llm_model"] = source[key].strip()
            break
    if isinstance(source.get("wall_seconds"), (int, float)) and not isinstance(source.get("wall_seconds"), bool):
        usage["wall_seconds"] = float(source["wall_seconds"])
    elif isinstance(source.get("duration_ms"), (int, float)) and not isinstance(source.get("duration_ms"), bool):
        usage["wall_seconds"] = float(source["duration_ms"]) / 1000.0
    return usage


def parse_invoker_output(text: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Split an invoker's stdout into the extraction payload and an optional usage line.

    Subscription CLIs report token counts out of band, so the invoker contract is: the
    extraction JSON on stdout, optionally followed by ONE final line of JSON whose keys are
    all usage metadata. A usage line is only consumed when JSON remains after removing it,
    so a single-line extraction is never mistaken for accounting.
    """
    if not text or not text.strip():
        raise ConveyorError("Invoker produced no output")
    lines = text.strip().splitlines()
    usage: dict[str, Any] = {"tokens_in": 0, "tokens_out": 0, "llm_model": None, "wall_seconds": None}
    body = lines
    if len(lines) > 1:
        candidate = lines[-1].strip()
        if candidate.startswith("{"):
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, dict) and parsed and set(parsed) <= _USAGE_KEYS:
                usage = _normalize_usage(parsed)
                body = lines[:-1]
    payload_text = _strip_code_fence("\n".join(body))
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as error:
        raise ConveyorError(f"Invoker output is not JSON: {error}") from error
    if not isinstance(payload, dict):
        raise ConveyorError("Invoker output must be a JSON object")
    return payload, usage


def build_subprocess_invoker(
    command: str,
    *,
    cwd: Path | None = None,
    timeout: float = 900.0,
    model: str | None = None,
    runner: Callable[..., Any] = subprocess.run,
) -> Callable[[Mapping[str, Any]], dict[str, Any]]:
    """Return an invoke callable that pipes a job's prompt file into `command`.

    The command receives the prompt on stdin and must print the extraction JSON on stdout.
    Job metadata is exported so an invoker template can name the model, the datasheet, or
    the output file without parsing the prompt. No API key is read or forwarded: the
    templates run subscription CLIs in print mode.
    """
    if not command.strip():
        raise ConveyorError("An extraction invoker needs a non-empty command")

    def invoke(job: Mapping[str, Any]) -> dict[str, Any]:
        prompt_path = Path(job["prompt_path"])
        response_path = Path(job["response_path"])
        prompt = prompt_path.read_text(encoding="utf-8")
        environment = dict(os.environ)
        environment.update({
            "CONVEYOR_LCSC_ID": str(job.get("lcsc_id", "")),
            "CONVEYOR_MPN": str(job.get("mpn", "")),
            "CONVEYOR_FAMILY": str(job.get("family", "")),
            "CONVEYOR_DATASHEET": str(job.get("datasheet_path", "")),
            "CONVEYOR_PROMPT_FILE": str(prompt_path),
            "CONVEYOR_RESPONSE_FILE": str(response_path),
        })
        if model:
            environment["CONVEYOR_MODEL"] = model
        result: dict[str, Any] = {
            "lcsc_id": job.get("lcsc_id"),
            "mpn": job.get("mpn"),
            "family": job.get("family"),
            "prompt_path": str(prompt_path),
            "response_path": str(response_path),
            "prompt_sha256": sha256_text(prompt),
            "datasheet_sha256": None,
            "response_sha256": None,
            "tokens_in": 0,
            "tokens_out": 0,
            "llm_model": model,
            "wall_seconds": 0.0,
            "status": "invoke_failed",
            "returncode": None,
            "error": None,
        }
        datasheet = job.get("datasheet_path")
        if datasheet and Path(datasheet).is_file():
            result["datasheet_sha256"] = sha256_file(Path(datasheet))
        started = time.monotonic()
        try:
            completed = runner(
                command,
                shell=True,
                input=prompt,
                text=True,
                capture_output=True,
                cwd=str(cwd) if cwd else None,
                env=environment,
                timeout=timeout,
            )
        except subprocess.SubprocessError as error:
            result["wall_seconds"] = round(time.monotonic() - started, 3)
            result["error"] = f"invoker failed: {error}"
            return result
        result["wall_seconds"] = round(time.monotonic() - started, 3)
        result["returncode"] = completed.returncode
        if completed.returncode != 0:
            result["error"] = (completed.stderr or completed.stdout or "invoker exited non-zero").strip()[:2000]
            return result
        try:
            payload, usage = parse_invoker_output(completed.stdout)
        except ConveyorError as error:
            result["error"] = str(error)
            return result
        result["tokens_in"] = usage["tokens_in"]
        result["tokens_out"] = usage["tokens_out"]
        result["llm_model"] = usage["llm_model"] or model
        if usage.get("wall_seconds"):
            result["wall_seconds"] = round(float(usage["wall_seconds"]), 3)
        response_path.parent.mkdir(parents=True, exist_ok=True)
        response_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        result["response_sha256"] = sha256_file(response_path)
        result["status"] = "invoked"
        return result

    return invoke


def dry_run_command_lines(command: str, jobs: Sequence[Mapping[str, Any]], *, model: str | None = None) -> list[str]:
    """The exact shell lines `extract` would run, in dispatch order."""
    lines = []
    for job in jobs:
        prefix = [
            f"CONVEYOR_LCSC_ID={job.get('lcsc_id', '')}",
            f"CONVEYOR_MPN={job.get('mpn', '')}",
            f"CONVEYOR_FAMILY={job.get('family', '')}",
            f"CONVEYOR_DATASHEET={job.get('datasheet_path', '')}",
            f"CONVEYOR_PROMPT_FILE={job.get('prompt_path', '')}",
            f"CONVEYOR_RESPONSE_FILE={job.get('response_path', '')}",
        ]
        if model:
            prefix.append(f"CONVEYOR_MODEL={model}")
        lines.append(f"{' '.join(prefix)} {command} < {job.get('prompt_path', '')} > {job.get('response_path', '')}")
    return lines


# ------------------------------------------------------------- relevance lists


def parse_relevance_list(text: str) -> list[dict[str, Any]]:
    """Parse a curated MPN list into ordered selection entries.

    One MPN per line. Optional pipe-separated fields follow it: manufacturer, priority,
    family. Commas are never separators because ordering codes contain them
    (`PMBT2222A,215`). Blank lines and `#` comments are ignored, as is an inline `#`
    comment. Lower priority numbers are selected first; the default is 100 and ties keep
    file order.
    """
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    for number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        fields = [field.strip() for field in line.split("|")]
        mpn = fields[0]
        if not mpn:
            raise ConveyorError(f"Relevance list line {number} has no MPN")
        manufacturer = fields[1] if len(fields) > 1 and fields[1] else None
        priority = 100
        if len(fields) > 2 and fields[2]:
            try:
                priority = int(fields[2])
            except ValueError as error:
                raise ConveyorError(f"Relevance list line {number} has a non-integer priority: {fields[2]!r}") from error
        family = fields[3].casefold() if len(fields) > 3 and fields[3] else None
        if family is not None and family not in SUPPORTED_FAMILIES:
            raise ConveyorError(
                f"Relevance list line {number} names unsupported family {family!r}; "
                f"expected one of {', '.join(SUPPORTED_FAMILIES)}"
            )
        if len(fields) > 4:
            raise ConveyorError(f"Relevance list line {number} has more than four fields")
        key = mpn.casefold()
        if key in seen:
            continue
        seen.add(key)
        entries.append({
            "mpn": mpn,
            "manufacturer": manufacturer,
            "priority": priority,
            "family": family,
            "line": number,
        })
    if not entries:
        raise ConveyorError("Relevance list contains no entries")
    return entries


def match_relevance_entries(
    entries: Sequence[Mapping[str, Any]],
    catalog_rows: Sequence[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Bind curated MPNs to catalog rows, keeping the best stocked row per entry.

    The curated list is the relevance signal; the catalog only supplies the datasheet URL,
    package, and parametric seed hints. An entry the catalog cannot supply is reported as a
    skip with its reason, never silently dropped.
    """
    by_mpn: dict[str, list[Mapping[str, Any]]] = {}
    for row in catalog_rows:
        by_mpn.setdefault(str(row["mpn"]).casefold(), []).append(row)
    selected: list[dict[str, Any]] = []
    skips: list[dict[str, str]] = []
    ordered = sorted(entries, key=lambda entry: (entry.get("priority", 100), entry.get("line", 0)))
    for entry in ordered:
        candidates = list(by_mpn.get(entry["mpn"].casefold(), []))
        if entry.get("manufacturer"):
            wanted = entry["manufacturer"].casefold()
            narrowed = [row for row in candidates if wanted in str(row.get("manufacturer", "")).casefold()]
            candidates = narrowed or candidates
        candidates = [row for row in candidates if str(row.get("datasheet_url", "")).strip()]
        if not candidates:
            skips.append({
                "mpn": entry["mpn"],
                "lcsc_id": "",
                "reason": "relevance entry has no catalog row with a datasheet URL",
            })
            continue
        best = max(candidates, key=lambda row: (int(row.get("popularity", 0) or 0), int(row.get("stock", 0) or 0)))
        part = dict(best)
        family = entry.get("family")
        if family is None:
            try:
                family = classify_family(part)
            except ConveyorError as error:
                skips.append({"mpn": entry["mpn"], "lcsc_id": str(part.get("lcsc_id", "")), "reason": str(error)})
                continue
        part["conveyor_family"] = family
        part["relevance"] = {
            "priority": entry.get("priority", 100),
            "line": entry.get("line"),
            "requested_manufacturer": entry.get("manufacturer"),
        }
        selected.append(part)
    return selected, skips


# ------------------------------------------------------------ extraction export


def export_extractions(data_dir: Path, destination: Path) -> dict[str, Any]:
    """Copy every extraction JSON under `data_dir` into a tracked directory with a manifest.

    Extraction JSON is the only irreplaceable output of the campaign: the datasheets can be
    refetched and the packages regenerated, but the LLM reading of each PDF cannot be
    without spending the tokens again. Relative paths are preserved so two tranches cannot
    collide on a file name, and every copy records its content hash.
    """
    data_dir = Path(data_dir)
    destination = Path(destination)
    if not data_dir.is_dir():
        raise ConveyorError(f"No conveyor data directory at {data_dir}")
    sources = sorted(path for path in data_dir.glob("**/extractions/*.json") if path.is_file())
    destination.mkdir(parents=True, exist_ok=True)
    files: list[dict[str, Any]] = []
    copied = 0
    total_bytes = 0
    for source in sources:
        relative = source.relative_to(data_dir)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = sha256_file(source)
        if not target.is_file() or sha256_file(target) != digest:
            shutil.copy2(source, target)
            copied += 1
        size = target.stat().st_size
        total_bytes += size
        files.append({"path": str(relative), "sha256": digest, "bytes": size})
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "kind": "opencircuit-conveyor-extraction-export",
        "source_data_dir": str(data_dir),
        "exported_at": utc_now(),
        "file_count": len(files),
        "total_bytes": total_bytes,
        "files": files,
    }
    json_dump(destination / "manifest.json", manifest)
    return {
        "destination": str(destination),
        "file_count": len(files),
        "copied": copied,
        "total_bytes": total_bytes,
        "total_megabytes": round(total_bytes / (1024 * 1024), 2),
    }


def top_failure_reasons(rows: Iterable[Mapping[str, Any]], limit: int = 3) -> list[tuple[str, int]]:
    counter = Counter(row.get("reason") or "unspecified" for row in rows if str(row.get("state", "")).startswith("failed_"))
    return counter.most_common(limit)


def top_recorded_reasons(rows: Iterable[Mapping[str, Any]], limit: int = 3) -> list[tuple[str, int]]:
    counter = Counter(row.get("reason") for row in rows if row.get("reason"))
    return counter.most_common(limit)
