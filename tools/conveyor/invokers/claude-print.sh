#!/bin/sh
# Conveyor extraction invoker: Claude Code in print mode, on the subscription session.
#
# Contract (see invokers/README.md):
#   stdin  = the extraction prompt for exactly one part
#   stdout = the extraction JSON, then one trailing line of JSON usage metadata
#
# Read-only by construction: print mode with an explicit Read/Glob/Grep tool allowlist, so
# the session can open the datasheet, context pack, archetype and schema and nothing else.
# No API key is read or forwarded; both key variables are cleared so the CLI uses the
# logged-in subscription session and a stray key cannot silently start billing.
set -eu

MODEL="${CONVEYOR_MODEL:-opus}"
CLAUDE_BIN="${CONVEYOR_CLAUDE_BIN:-claude}"
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

unset ANTHROPIC_API_KEY || true
unset ANTHROPIC_AUTH_TOKEN || true

"$CLAUDE_BIN" -p \
  --model "$MODEL" \
  --output-format json \
  --allowed-tools "Read Glob Grep" \
  | python3 "$HERE/emit.py" --format claude-json
