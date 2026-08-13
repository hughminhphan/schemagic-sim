"""Resumable conveyor primitives for bulk datasheet-to-model staging."""
from __future__ import annotations

import copy
import datetime as dt
import json
import math
import re
import sqlite3
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

SCHEMA_VERSION = "1.0.0"
LINEAR_STATES = ("selected", "datasheet_fetched", "extracted", "fitted", "staged")
FAILURE_STATES = tuple(f"failed_{stage}" for stage in LINEAR_STATES[1:])
ALL_STATES = set(LINEAR_STATES + FAILURE_STATES)
FAMILY_QUOTAS = {"diode": 18, "bjt": 16, "mosfet": 16}


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


def run_extraction_batch(
    jobs: Sequence[Mapping[str, Any]],
    invoke: Callable[[Mapping[str, Any]], Any],
    *,
    max_concurrency: int = 4,
) -> list[Any]:
    """Dispatch extraction jobs through an injected Luna caller with a hard four-call ceiling."""
    if max_concurrency < 1 or max_concurrency > 4:
        raise ConveyorError("Extraction concurrency must be between 1 and 4")
    with ThreadPoolExecutor(max_workers=max_concurrency) as executor:
        return list(executor.map(invoke, jobs))


def top_failure_reasons(rows: Iterable[Mapping[str, Any]], limit: int = 3) -> list[tuple[str, int]]:
    counter = Counter(row.get("reason") or "unspecified" for row in rows if str(row.get("state", "")).startswith("failed_"))
    return counter.most_common(limit)


def top_recorded_reasons(rows: Iterable[Mapping[str, Any]], limit: int = 3) -> list[tuple[str, int]]:
    counter = Counter(row.get("reason") for row in rows if row.get("reason"))
    return counter.most_common(limit)
