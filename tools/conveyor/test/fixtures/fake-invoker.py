#!/usr/bin/env python3
"""A fake extraction invoker for the test suite.

Satisfies the invoker contract without any network or CLI: reads the prompt on stdin,
prints a JSON object on stdout, then one trailing usage line. FAKE_INVOKER_MODE selects the
behaviour under test: ok, no-usage, fenced, bad-json, empty, or fail.
"""
from __future__ import annotations

import json
import os
import sys


def main() -> int:
    prompt = sys.stdin.read()
    mode = os.environ.get("FAKE_INVOKER_MODE", "ok")
    if mode == "fail":
        sys.stderr.write("fake invoker refused\n")
        return 3
    if mode == "empty":
        return 0
    payload = {
        "lcsc_id": os.environ.get("CONVEYOR_LCSC_ID", ""),
        "mpn": os.environ.get("CONVEYOR_MPN", ""),
        "family": os.environ.get("CONVEYOR_FAMILY", ""),
        "prompt_bytes": len(prompt),
        "saw_datasheet": bool(os.environ.get("CONVEYOR_DATASHEET")),
    }
    if mode == "bad-json":
        sys.stdout.write("this is not json\n")
        return 0
    body = json.dumps(payload, indent=2, sort_keys=True)
    if mode == "fenced":
        body = f"```json\n{body}\n```"
    sys.stdout.write(body + "\n")
    if mode != "no-usage":
        sys.stdout.write(json.dumps({"tokens_in": 1200, "tokens_out": 340, "model": "fake-model"}) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
