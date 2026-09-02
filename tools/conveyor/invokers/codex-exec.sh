#!/bin/sh
# Conveyor extraction invoker: Codex CLI non-interactive exec, on the subscription session.
#
# Contract (see invokers/README.md):
#   stdin  = the extraction prompt for exactly one part
#   stdout = the extraction JSON, then one trailing line of JSON usage metadata
#
# Read-only by construction: `exec` with a read-only sandbox and no approvals, so the run
# can open the datasheet, context pack, archetype and schema and write nothing. No API key
# is read or forwarded; OPENAI_API_KEY is cleared so the CLI uses the logged-in
# subscription session and a stray key cannot silently start billing.
set -eu

MODEL="${CONVEYOR_MODEL:-gpt-5.6-codex}"
CODEX_BIN="${CONVEYOR_CODEX_BIN:-codex}"
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

unset OPENAI_API_KEY || true

"$CODEX_BIN" exec \
  --model "$MODEL" \
  --sandbox read-only \
  --skip-git-repo-check \
  --json \
  - \
  | python3 "$HERE/emit.py" --format codex-jsonl
