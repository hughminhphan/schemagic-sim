#!/usr/bin/env python3
"""Normalize a subscription CLI's stdout into the conveyor invoker contract.

The contract is deliberately tiny: print the extraction JSON, then optionally ONE final
line of JSON holding usage metadata. Every CLI reports tokens differently, so this script
owns the CLI-specific reading and the invoker shell scripts stay one command long.

Usage:
    <cli> ... | python3 emit.py --format claude-json
    <cli> ... | python3 emit.py --format codex-jsonl
    <cli> ... | python3 emit.py --format raw
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

_TEXT_KEYS = ("result", "text", "message", "content", "output", "last_agent_message")
_IN_KEYS = ("input_tokens", "prompt_tokens", "tokens_in", "cached_input_tokens")
_OUT_KEYS = ("output_tokens", "completion_tokens", "tokens_out")


def _first_number(source: Any, keys: tuple[str, ...]) -> int | None:
    if not isinstance(source, dict):
        return None
    for key in keys:
        value = source.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return int(value)
    return None


def _text_of(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts = [item.get("text") for item in value if isinstance(item, dict) and isinstance(item.get("text"), str)]
        return "\n".join(parts) if parts else None
    if isinstance(value, dict):
        for key in _TEXT_KEYS:
            found = _text_of(value.get(key))
            if found:
                return found
    return None


def from_claude_json(raw: str) -> tuple[str, dict]:
    envelope = json.loads(raw)
    if not isinstance(envelope, dict):
        raise SystemExit("emit.py: claude --output-format json did not produce an object")
    if envelope.get("is_error"):
        raise SystemExit(f"emit.py: claude reported an error: {envelope.get('result') or envelope}")
    text = _text_of(envelope)
    if not text:
        raise SystemExit("emit.py: claude envelope carried no result text")
    usage = envelope.get("usage") if isinstance(envelope.get("usage"), dict) else {}
    result = {
        "tokens_in": _first_number(usage, _IN_KEYS) or 0,
        "tokens_out": _first_number(usage, _OUT_KEYS) or 0,
    }
    model = envelope.get("model") or envelope.get("modelName")
    if isinstance(model, str) and model.strip():
        result["model"] = model
    if isinstance(envelope.get("duration_ms"), (int, float)):
        result["duration_ms"] = envelope["duration_ms"]
    return text, result


def from_codex_jsonl(raw: str) -> tuple[str, dict]:
    text: str | None = None
    tokens_in = 0
    tokens_out = 0
    model: str | None = None
    plain: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if not stripped.startswith("{"):
            plain.append(line)
            continue
        try:
            event = json.loads(stripped)
        except json.JSONDecodeError:
            plain.append(line)
            continue
        if not isinstance(event, dict):
            continue
        for candidate in (event, event.get("msg"), event.get("payload"), event.get("info")):
            if not isinstance(candidate, dict):
                continue
            usage = candidate.get("usage") if isinstance(candidate.get("usage"), dict) else candidate
            found_in = _first_number(usage, _IN_KEYS)
            found_out = _first_number(usage, _OUT_KEYS)
            if found_in is not None:
                tokens_in = max(tokens_in, found_in)
            if found_out is not None:
                tokens_out = max(tokens_out, found_out)
            if isinstance(candidate.get("model"), str) and candidate["model"].strip():
                model = candidate["model"]
            found_text = _text_of(candidate)
            if found_text:
                text = found_text
    if text is None and plain:
        text = "\n".join(plain)
    if not text:
        raise SystemExit("emit.py: codex output carried no agent message")
    usage_line = {"tokens_in": tokens_in, "tokens_out": tokens_out}
    if model:
        usage_line["model"] = model
    return text, usage_line


def main() -> int:
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--format", required=True, choices=("claude-json", "codex-jsonl", "raw"))
    parsed = arguments.parse_args()
    raw = sys.stdin.read()
    if not raw.strip():
        raise SystemExit("emit.py: the CLI produced no output")
    if parsed.format == "raw":
        sys.stdout.write(raw.strip() + "\n")
        return 0
    text, usage = from_claude_json(raw) if parsed.format == "claude-json" else from_codex_jsonl(raw)
    sys.stdout.write(text.strip() + "\n")
    sys.stdout.write(json.dumps(usage, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
