#!/usr/bin/env python3
"""Freeze the deterministic scale-2k tranche from a read-only jlcparts snapshot."""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Mapping

from feederlib import DATA_URL, SCHEMA_VERSION, json_dump, normalize_part, parametric_seed_hints, sha256_file

ORDERING_SUFFIXES = {
    "115", "125", "135", "165", "215", "235", "315",
    "7-f", "13-f", "lt1", "lt1g", "ms", "pbf", "q", "rl", "rlg",
    "t1", "t1g", "t4", "tp", "tr", "trg", "trpbf",
}
FAMILY_CAPS = {"bjt": 650, "diode": 1200, "mosfet": 900}


def normalized_mpn_key(value: str, family: str | None = None) -> str:
    """Normalize catalog ordering and unproven suffix variants deterministically."""
    text = unicodedata.normalize("NFKC", str(value)).strip().casefold()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^(?:g1|l)-(?=[a-z0-9])", "", text)
    text = re.sub(r"\([^)]*\)(?:-[a-z0-9]{1,4})?$", "", text).strip()
    text = re.sub(r",[a-z0-9-]{1,16}$", "", text).strip()
    text = re.sub(r"-(?:rtk/p|ae3-r|[0-9]+-f|tp|tr|ms|pbf)$", "", text).strip()
    text = re.sub(r"-[a-z]{1,4}$", "", text).strip()
    for _ in range(2):
        marked = re.fullmatch(r"(.+?)\s+([a-z0-9.-]{1,12})", text)
        if marked and (len(marked.group(2)) <= 4 or re.fullmatch(r"[0-9.]+-[0-9.]+", marked.group(2))):
            text = marked.group(1).strip()
    text = re.sub(r"(?:lt\d+g?|t\d+g|trpbf|trg|tr|rlg|rl|pbf|ta)$", "", text).strip()
    if family == "bjt":
        text = re.sub(r"-(?:16|25|40)$", "", text)
        text = re.sub(r"(?<=\d)[a-dhklqry]{1,2}$", "", text)
    return re.sub(r"[^a-z0-9]+", "", text)


def reviewed_snapshot(library_root: Path) -> tuple[set[str], dict[str, str], int]:
    exact: set[str] = set()
    normalized: dict[str, str] = {}
    package_count = 0
    for component_path in sorted(library_root.glob("*/*/component.json")):
        component = json.loads(component_path.read_text(encoding="utf-8"))
        package_count += 1
        label = str(component_path.parent.relative_to(library_root))
        electrical_family = str(component.get("electrical_family", ""))
        family = "bjt" if electrical_family.startswith("bjt_") else "mosfet" if electrical_family in {"nmos", "pmos"} else "diode" if electrical_family == "diode" else None
        values = [component.get("canonical_mpn"), *(component.get("ordering_code_aliases") or [])]
        for value in values:
            if not isinstance(value, str) or not value.strip():
                continue
            exact.add(value.strip().casefold())
            normalized.setdefault(normalized_mpn_key(value, family), label)
    return exact, normalized, package_count


def row_fingerprint(rows: Iterable[Mapping[str, Any]]) -> str:
    material = [
        {
            "lcsc_id": row["lcsc_id"],
            "mpn": row["mpn"],
            "conveyor_family": row["conveyor_family"],
            "family_rank": row["family_rank"],
            "frozen_campaign_order": row.get("frozen_campaign_order"),
        }
        for row in rows
    ]
    encoded = json.dumps(material, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _lcsc_ids(manifest: Mapping[str, Any]) -> set[str]:
    return {str(part["lcsc_id"]).casefold() for part in manifest["parts"]}


def freeze_manifest(
    *,
    db_path: Path,
    sql_path: Path,
    dump_state: Mapping[str, Any],
    scale_1k: Mapping[str, Any],
    scale_1k_file_sha256: str,
    library_root: Path,
    quarantine_ids: set[str],
    reviewed_commit: str,
    created_at: str,
    order_start: int = 370,
) -> dict[str, Any]:
    sql_file_text = sql_path.read_text(encoding="utf-8")
    sql = sql_file_text.strip()
    scale_1k_ids = _lcsc_ids(scale_1k)
    quarantine = {value.casefold() for value in quarantine_ids}
    reviewed_exact, reviewed_normalized, reviewed_package_count = reviewed_snapshot(library_root)

    raw_rows: list[dict[str, Any]] = []
    raw_available_by_family: dict[str, int] = {}
    with contextlib.closing(sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        for row in connection.execute(sql):
            part = normalize_part(row)
            part["conveyor_family"] = str(row["conveyor_family"])
            part["family_rank"] = int(row["family_rank"])
            part["raw_family_count"] = int(row["raw_family_count"])
            part["normalized_mpn"] = normalized_mpn_key(part["mpn"], part["conveyor_family"])
            part["seed_hints"] = parametric_seed_hints(part["attributes"])
            raw_rows.append(part)
            raw_available_by_family[part["conveyor_family"]] = part["raw_family_count"]

    raw_by_family = Counter(part["conveyor_family"] for part in raw_rows)
    direct_scale_1k = {part["lcsc_id"].casefold() for part in raw_rows if part["lcsc_id"].casefold() in scale_1k_ids}
    direct_quarantine = {part["lcsc_id"].casefold() for part in raw_rows if part["lcsc_id"].casefold() in quarantine}
    direct_reviewed = {
        part["lcsc_id"].casefold()
        for part in raw_rows
        if part["mpn"].strip().casefold() in reviewed_exact or part["normalized_mpn"] in reviewed_normalized
    }

    kept: list[dict[str, Any]] = []
    seen_normalized: dict[str, str] = {}
    sequential = Counter()
    exclusion_by_family: dict[str, Counter[str]] = {family: Counter() for family in FAMILY_CAPS}
    dedup_examples: list[dict[str, Any]] = []
    reviewed_examples: list[dict[str, Any]] = []
    for part in raw_rows:
        family = part["conveyor_family"]
        lcsc_key = part["lcsc_id"].casefold()
        if lcsc_key in quarantine:
            sequential["quarantine"] += 1
            exclusion_by_family[family]["quarantine"] += 1
            continue
        if lcsc_key in scale_1k_ids:
            sequential["scale_1k_lcsc"] += 1
            exclusion_by_family[family]["scale_1k_lcsc"] += 1
            continue
        exact_key = part["mpn"].strip().casefold()
        reviewed_label = reviewed_normalized.get(part["normalized_mpn"])
        if exact_key in reviewed_exact or reviewed_label is not None:
            sequential["reviewed_identity_or_alias"] += 1
            exclusion_by_family[family]["reviewed_identity_or_alias"] += 1
            if len(reviewed_examples) < 100:
                reviewed_examples.append({
                    "lcsc_id": part["lcsc_id"],
                    "mpn": part["mpn"],
                    "normalized_mpn": part["normalized_mpn"],
                    "reviewed_package": reviewed_label,
                })
            continue
        duplicate_of = seen_normalized.get(part["normalized_mpn"])
        if duplicate_of is not None:
            sequential["normalized_mpn_dedup"] += 1
            exclusion_by_family[family]["normalized_mpn_dedup"] += 1
            if len(dedup_examples) < 100:
                dedup_examples.append({
                    "lcsc_id": part["lcsc_id"],
                    "mpn": part["mpn"],
                    "normalized_mpn": part["normalized_mpn"],
                    "kept_lcsc_id": duplicate_of,
                })
            continue
        seen_normalized[part["normalized_mpn"]] = part["lcsc_id"]
        kept.append(part)

    raw_row_order_hash = row_fingerprint(raw_rows)
    for offset, part in enumerate(kept):
        part["frozen_campaign_order"] = order_start + offset

    final_by_family = Counter(part["conveyor_family"] for part in kept)
    sql_file_sha256 = sha256_file(sql_path)
    embedded_sql_sha256 = hashlib.sha256(sql.encode("utf-8")).hexdigest()
    scale_1k_hash = scale_1k_file_sha256
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": "opencircuit-part-tranche",
        "created_at": created_at,
        "source": {
            "provider": "jlcparts",
            "url": dump_state.get("source_url", DATA_URL),
            "dump_date": dump_state.get("dump_date"),
            "archive_id": dump_state.get("archive_id"),
            "database_sha256": sha256_file(db_path),
            "database_bytes": db_path.stat().st_size,
            "local_only": True,
            "read_only": True,
        },
        "query": {
            "name": "sql-file:scale-2k.sql",
            "sql": sql,
            "sql_file_sha256": sql_file_sha256,
            "embedded_sql_sha256": embedded_sql_sha256,
            "parameters": {},
            "family_caps": FAMILY_CAPS,
            "ranking": "preferred DESC, stock DESC, lcsc ASC per conveyor_family",
            "global_order": "conveyor_family ASC, family_rank ASC after exclusions and normalized-MPN deduplication",
        },
        "freeze": {
            "reviewed_snapshot_commit": reviewed_commit,
            "reviewed_package_count": reviewed_package_count,
            "reviewed_exact_identity_alias_count": len(reviewed_exact),
            "reviewed_normalized_identity_count": len(reviewed_normalized),
            "scale_1k_manifest_sha256": scale_1k_hash,
            "scale_1k_lcsc_count": len(scale_1k_ids),
            "quarantine_lcsc_ids": sorted(value.upper() for value in quarantine),
            "quarantine_count": len(quarantine),
            "order_start": order_start,
            "order_end": order_start + len(kept) - 1 if kept else None,
            "raw_available_by_family_before_caps": dict(sorted(raw_available_by_family.items())),
            "raw_capped_by_family": dict(sorted(raw_by_family.items())),
            "raw_capped_count": len(raw_rows),
            "direct_match_counts": {
                "scale_1k_lcsc": len(direct_scale_1k),
                "quarantine_lcsc": len(direct_quarantine),
                "reviewed_identity_or_alias": len(direct_reviewed),
                "scale_1k_and_quarantine_overlap": len(direct_scale_1k & direct_quarantine),
                "scale_1k_and_reviewed_overlap": len(direct_scale_1k & direct_reviewed),
                "quarantine_and_reviewed_overlap": len(direct_quarantine & direct_reviewed),
            },
            "sequential_exclusion_counts": dict(sorted(sequential.items())),
            "sequential_exclusion_by_family": {
                family: dict(sorted(counts.items())) for family, counts in sorted(exclusion_by_family.items())
            },
            "final_by_family": dict(sorted(final_by_family.items())),
            "final_candidate_count": len(kept),
            "raw_row_order_sha256": raw_row_order_hash,
            "final_row_order_sha256": row_fingerprint(kept),
            "normalized_mpn_algorithm": "NFKC casefold plus punctuation folding, catalog ordering/marking suffix removal, and plain-BJT gain-rank folding; numeric diode and MOSFET electrical value codes are retained",
            "digital_transistors_deferred": True,
            "bridge_categories_excluded": True,
            "post_fit_full_vector_collision_guard_required": True,
            "dedup_examples": dedup_examples,
            "reviewed_collision_examples": reviewed_examples,
        },
        "part_count": len(kept),
        "parts": kept,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--dump-state", type=Path, required=True)
    parser.add_argument("--scale-1k", type=Path, required=True)
    parser.add_argument("--library-root", type=Path, required=True)
    parser.add_argument("--quarantine-document", type=Path, required=True)
    parser.add_argument("--reviewed-commit", required=True)
    parser.add_argument("--sql", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--created-at", default=dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat())
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dump_state = json.loads(args.dump_state.read_text(encoding="utf-8"))
    scale_1k = json.loads(args.scale_1k.read_text(encoding="utf-8"))
    quarantine_document = json.loads(args.quarantine_document.read_text(encoding="utf-8"))
    quarantine_ids = set(quarantine_document["independent_review_rejection_quarantine"]["lcsc_ids"])
    manifest = freeze_manifest(
        db_path=args.db,
        sql_path=args.sql,
        dump_state=dump_state,
        scale_1k=scale_1k,
        scale_1k_file_sha256=sha256_file(args.scale_1k),
        library_root=args.library_root,
        quarantine_ids=quarantine_ids,
        reviewed_commit=args.reviewed_commit,
        created_at=args.created_at,
    )
    json_dump(args.output, manifest)
    print(json.dumps({
        "part_count": manifest["part_count"],
        "order_start": manifest["freeze"]["order_start"],
        "order_end": manifest["freeze"]["order_end"],
        "raw_capped_count": manifest["freeze"]["raw_capped_count"],
        "sequential_exclusion_counts": manifest["freeze"]["sequential_exclusion_counts"],
        "final_by_family": manifest["freeze"]["final_by_family"],
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
