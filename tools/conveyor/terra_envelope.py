#!/usr/bin/env python3
"""Content-addressed one-PDF Terra MOSFET evidence-envelope orchestration."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from conveyorlib import (  # noqa: E402
    ConveyorError,
    json_dump,
    load_and_translate_mosfet_evidence_envelope,
    load_and_validate_extraction,
    safe_stem,
)

ENVELOPE_SCHEMA = HERE / "schemas" / "mosfet-evidence-envelope.schema.json"
MOSFET_SCHEMA = HERE / "schemas" / "mosfet.schema.json"
CONTEXT_PACK = HERE / "context-packs" / "mosfet.json"
TRANSLATOR = HERE / "conveyorlib.py"
ADAPTER = REPO_ROOT / "tools" / "model-factory" / "lib" / "bulk-adapter.mjs"
PREFLIGHT = REPO_ROOT / "tools" / "model-factory" / "preflight-candidate.mjs"
AUTHORITY = REPO_ROOT / "docs" / "batch-23-terra-mosfet-continuation-authorization.md"
ENVELOPE_AUTHORITY = REPO_ROOT / "docs" / "batch-22-terra-mosfet-evidence-envelope-recovery.md"


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConveyorError(f"Invalid JSON {path}: {error}") from error
    if not isinstance(value, dict):
        raise ConveyorError(f"Invalid JSON {path}: root must be an object")
    return value


def binding_hashes() -> dict[str, str]:
    paths = {
        "envelope_schema": ENVELOPE_SCHEMA,
        "output_schema": MOSFET_SCHEMA,
        "context_pack": CONTEXT_PACK,
        "translator": TRANSLATOR,
        "factory_adapter": ADAPTER,
        "factory_preflight": PREFLIGHT,
        "batch_authority": AUTHORITY,
        "envelope_authority": ENVELOPE_AUTHORITY,
    }
    missing = [str(path) for path in paths.values() if not path.is_file()]
    if missing:
        raise ConveyorError("Missing tracked job bindings: " + ", ".join(missing))
    return {name: sha256_file(path) for name, path in paths.items()}


def prompt_for(job: dict) -> str:
    return f"""Do not invoke any Skill at any point in this task.

You are performing one bounded source-review turn for exactly one MOSFET and exactly one PDF. Do not inspect another candidate, use catalog values as evidence, fetch a replacement source, fit a model, or modify any file except the response path below.

Expected identity:
- MPN: {job['part']['mpn']}
- Manufacturer: {job['part']['manufacturer']}
- LCSC ID: {job['part']['lcsc_id']}
- Frozen order: {job['part']['frozen_campaign_order']}

Bound inputs:
- Canonical PDF: {job['datasheet_path']}
- PDF SHA-256: {job['datasheet_sha256']}
- Evidence-envelope schema: {job['schema_path']}
- MOSFET context pack: {job['context_path']}
- Output response: {job['response_path']}

Inspect the PDF directly with pdftotext -layout. Render the relevant pages when table, footnote, sign, or schematic semantics are ambiguous. Extract only source-supported table evidence into one flat envelope conforming exactly to the bound schema. Threshold evidence must state a minimum/typical/maximum actually printed by the source and must use the source condition VDS = VGS; never manufacture a missing endpoint. Every RDS(on) record must preserve the printed typical/maximum role, signed values for P-channel sources, VGS, ID, exact temperature, page/table/row locator, magnitude convention, and typed test mode including pulse timing/duty when stated. The table/section temperature scope is admissible only when the PDF explicitly applies it to the row. Do not infer DC when the source omits its test mode. Do not extract curves in this envelope path.

Use apply_patch to create only {job['response_path']}. Return after the file is valid JSON. If the source cannot support both threshold and RDS(on) under this contract, do not invent evidence: write a small JSON failure object with the expected identity and a precise source-based reason to the same response path; deterministic adjudication will reject it honestly.
"""


def jobs_command(args: argparse.Namespace) -> int:
    manifest_path = args.manifest.resolve()
    topology_path = args.topology.resolve()
    manifest = load_json(manifest_path)
    topology = load_json(topology_path)
    parts = {part["lcsc_id"]: part for part in manifest.get("parts", [])}
    dispositions = topology.get("dispositions", [])
    if len(parts) != topology.get("denominator"):
        raise ConveyorError("Manifest/topology denominator mismatch")
    if sum(item.get("disposition") == "eligible_for_terra_envelope" for item in dispositions) != topology.get("eligible_for_terra_envelope"):
        raise ConveyorError("Topology eligible count is not self-consistent")

    data_dir = args.data_dir.resolve()
    tranche = safe_stem(manifest_path.stem)
    staging = data_dir / "staging" / tranche
    jobs_dir = staging / "terra-envelope-jobs"
    responses = staging / "terra-envelope-responses"
    translated = staging / "translated-extractions"
    part_inputs = staging / "preflight-parts"
    verdicts = staging / "preflight-verdicts"
    bindings = binding_hashes()
    topology_hash = sha256_file(topology_path)
    jobs = []
    for disposition in dispositions:
        if disposition.get("disposition") != "eligible_for_terra_envelope":
            continue
        lcsc_id = disposition["lcsc_id"]
        part = parts.get(lcsc_id)
        if part is None:
            raise ConveyorError(f"Topology row missing from manifest: {lcsc_id}")
        datasheet = staging / disposition["datasheet_path"]
        if not datasheet.is_file() or sha256_file(datasheet) != disposition["source_sha256"]:
            raise ConveyorError(f"Canonical PDF hash mismatch: {lcsc_id}")
        stem = f"{safe_stem(lcsc_id)}__{safe_stem(part['mpn'])}"
        part_path = part_inputs / f"{stem}.json"
        response_path = responses / f"{stem}.initial.json"
        translated_path = translated / f"{stem}.initial.json"
        verdict_path = verdicts / f"{stem}.initial.json"
        job = {
            "schema_version": "1.0.0",
            "kind": "opencircuit-terra-mosfet-envelope-job",
            "mode": "initial",
            "attempt": 1,
            "part": part,
            "datasheet_path": str(datasheet.resolve()),
            "datasheet_sha256": disposition["source_sha256"],
            "schema_path": str(ENVELOPE_SCHEMA.resolve()),
            "context_path": str(CONTEXT_PACK.resolve()),
            "response_path": str(response_path.resolve()),
            "translated_path": str(translated_path.resolve()),
            "part_path": str(part_path.resolve()),
            "verdict_path": str(verdict_path.resolve()),
            "topology_record": str(topology_path),
            "topology_record_sha256": topology_hash,
            "bindings": bindings,
        }
        job["prompt"] = prompt_for(job)
        job_path = jobs_dir / f"{stem}.initial.json"
        json_dump(part_path, part)
        json_dump(job_path, job)
        job["job_path"] = str(job_path.resolve())
        job["job_sha256"] = sha256_file(job_path)
        jobs.append(job)
    index = staging / "terra-envelope-jobs.json"
    json_dump(index, {
        "schema_version": "1.0.0",
        "kind": "opencircuit-terra-mosfet-envelope-job-index",
        "manifest": str(manifest_path),
        "topology": str(topology_path),
        "job_count": len(jobs),
        "one_pdf_per_turn": True,
        "max_concurrency": 3,
        "jobs": [{key: job[key] for key in ("part", "job_path", "job_sha256", "response_path")} for job in jobs],
    })
    print(json.dumps({"index": str(index), "job_count": len(jobs)}, indent=2))
    return 0


def read_ledger(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise ConveyorError(f"Invalid append-only ledger line {line_number}: {error}") from error
        if not isinstance(row, dict):
            raise ConveyorError(f"Invalid append-only ledger line {line_number}: not an object")
        rows.append(row)
    return rows


def append_ledger(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n")


def dispatch_command(args: argparse.Namespace) -> int:
    job_path = args.job.resolve()
    job = load_json(job_path)
    if job.get("kind") != "opencircuit-terra-mosfet-envelope-job":
        raise ConveyorError("Not a Terra envelope job")
    job_hash = sha256_file(job_path)
    ledger = args.ledger.resolve()
    rows = read_ledger(ledger)
    identity = job["part"]["lcsc_id"]
    mode = job["mode"]
    if any(row.get("lcsc_id") == identity and row.get("mode") == mode for row in rows if row.get("kind") == "dispatch"):
        raise ConveyorError(f"Dispatch already consumed for {identity}/{mode}")
    calls = [row for row in rows if row.get("kind") == "dispatch" and row.get("lcsc_id") == identity]
    if len(calls) >= 2:
        raise ConveyorError(f"Call ceiling already reached for {identity}")
    if mode == "focused_repair" and not any(row.get("mode") == "initial" for row in calls):
        raise ConveyorError(f"Focused repair cannot precede initial call for {identity}")
    append_ledger(ledger, {
        "schema_version": "1.0.0", "kind": "dispatch", "dispatched_at": utc_now(),
        "lcsc_id": identity, "mpn": job["part"]["mpn"], "mode": mode,
        "attempt": job["attempt"], "job_path": str(job_path), "job_sha256": job_hash,
        "datasheet_sha256": job["datasheet_sha256"],
    })
    print(job["prompt"])
    return 0


def adjudicate_command(args: argparse.Namespace) -> int:
    job_path = args.job.resolve()
    job = load_json(job_path)
    response = Path(job["response_path"])
    translated = Path(job["translated_path"])
    verdict_path = Path(job["verdict_path"])
    ledger = args.ledger.resolve()
    dispatches = [row for row in read_ledger(ledger) if row.get("kind") == "dispatch" and row.get("job_sha256") == sha256_file(job_path)]
    if len(dispatches) != 1:
        raise ConveyorError("Job must have exactly one recorded dispatch before adjudication")
    if not response.is_file():
        raise ConveyorError(f"Response is missing: {response}")
    response_hash = sha256_file(response)
    if any(row.get("kind") == "adjudication" and row.get("response_sha256") == response_hash for row in read_ledger(ledger)):
        raise ConveyorError("Response already adjudicated")
    verdict = {
        "schema_version": "1.0.0", "kind": "opencircuit-terra-mosfet-envelope-verdict",
        "lcsc_id": job["part"]["lcsc_id"], "mpn": job["part"]["mpn"],
        "mode": job["mode"], "response_path": str(response), "response_sha256": response_hash,
        "datasheet_sha256": job["datasheet_sha256"],
    }
    exit_code = 0
    try:
        payload = load_and_translate_mosfet_evidence_envelope(response, ENVELOPE_SCHEMA, MOSFET_SCHEMA)
        expected = {"mpn": job["part"]["mpn"], "manufacturer": job["part"]["manufacturer"], "family": "mosfet"}
        json_dump(translated, payload)
        load_and_validate_extraction(translated, MOSFET_SCHEMA, expected)
        command = [
            "node", str(PREFLIGHT), "--part", job["part_path"], "--extraction", str(translated),
            "--datasheet", job["datasheet_path"],
        ]
        run = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)
        try:
            preflight = json.loads(run.stdout)
        except json.JSONDecodeError as error:
            raise ConveyorError(f"Factory preflight returned invalid JSON: {error}; stderr={run.stderr.strip()}") from error
        if run.returncode != 0 or preflight.get("status") != "accepted":
            raise ConveyorError(preflight.get("reason") or run.stderr.strip() or "factory preflight rejected")
        verdict.update({
            "status": "accepted", "route": preflight["route"],
            "translated_path": str(translated), "translated_sha256": sha256_file(translated),
        })
    except (ConveyorError, OSError, subprocess.SubprocessError) as error:
        verdict.update({"status": "rejected", "reason": str(error)})
        exit_code = 2
    json_dump(verdict_path, verdict)
    append_ledger(ledger, {**verdict, "kind": "adjudication", "adjudicated_at": utc_now(), "verdict_path": str(verdict_path), "verdict_sha256": sha256_file(verdict_path)})
    print(json.dumps(verdict, indent=2))
    return exit_code


def missing_command(args: argparse.Namespace) -> int:
    job_path = args.job.resolve()
    job = load_json(job_path)
    ledger = args.ledger.resolve()
    rows = read_ledger(ledger)
    job_hash = sha256_file(job_path)
    dispatches = [row for row in rows if row.get("kind") == "dispatch" and row.get("job_sha256") == job_hash]
    if len(dispatches) != 1:
        raise ConveyorError("Job must have exactly one recorded dispatch before a missing-response disposition")
    if any(row.get("kind") == "adjudication" and row.get("job_sha256") == job_hash for row in rows):
        raise ConveyorError("Job already has a terminal adjudication")
    response = Path(job["response_path"])
    if response.exists():
        raise ConveyorError("A response exists and must be adjudicated normally")
    verdict = {
        "schema_version": "1.0.0", "kind": "adjudication", "adjudicated_at": utc_now(),
        "lcsc_id": job["part"]["lcsc_id"], "mpn": job["part"]["mpn"],
        "mode": job["mode"], "job_path": str(job_path), "job_sha256": job_hash,
        "datasheet_sha256": job["datasheet_sha256"], "status": "rejected",
        "reason": args.reason, "response_path": str(response), "response_sha256": None,
    }
    json_dump(Path(job["verdict_path"]), verdict)
    append_ledger(ledger, {**verdict, "verdict_path": job["verdict_path"], "verdict_sha256": sha256_file(Path(job["verdict_path"]))})
    print(json.dumps(verdict, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    jobs = commands.add_parser("jobs")
    jobs.add_argument("--manifest", type=Path, required=True)
    jobs.add_argument("--topology", type=Path, required=True)
    jobs.add_argument("--data-dir", type=Path, required=True)
    dispatch = commands.add_parser("dispatch")
    dispatch.add_argument("--job", type=Path, required=True)
    dispatch.add_argument("--ledger", type=Path, required=True)
    adjudicate = commands.add_parser("adjudicate")
    adjudicate.add_argument("--job", type=Path, required=True)
    adjudicate.add_argument("--ledger", type=Path, required=True)
    missing = commands.add_parser("missing")
    missing.add_argument("--job", type=Path, required=True)
    missing.add_argument("--ledger", type=Path, required=True)
    missing.add_argument("--reason", required=True)
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "jobs":
            return jobs_command(args)
        if args.command == "dispatch":
            return dispatch_command(args)
        if args.command == "missing":
            return missing_command(args)
        return adjudicate_command(args)
    except ConveyorError as error:
        print(json.dumps({"status": "error", "reason": str(error)}, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
