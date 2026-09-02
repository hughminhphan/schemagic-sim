# Extraction invokers

`conveyor extract --invoke-cmd "<cmd>"` runs one process per part. The contract is small on
purpose, so any CLI, wrapper, or fake can satisfy it.

## Contract

| Channel | Content |
| --- | --- |
| stdin | the extraction prompt for exactly one part, byte for byte |
| stdout | the extraction JSON object, optionally followed by ONE final line of JSON usage metadata |
| exit code | `0` on success; anything else records `failed_extracted` with the captured stderr |

The usage line is optional. It is consumed only when JSON still remains after removing it,
so a single-line extraction is never mistaken for accounting. Recognised keys:

```json
{"tokens_in": 12345, "tokens_out": 6789, "model": "opus", "wall_seconds": 41.2}
```

`input_tokens`/`output_tokens`, `prompt_tokens`/`completion_tokens`, a nested `usage`
object, and `duration_ms` are all accepted. Anything absent is recorded as zero; wall time
is measured by the conveyor regardless, so a template that reports no tokens still produces
a usable cost report.

Each process is started with the job in its environment:

```text
CONVEYOR_LCSC_ID  CONVEYOR_MPN  CONVEYOR_FAMILY
CONVEYOR_DATASHEET  CONVEYOR_PROMPT_FILE  CONVEYOR_RESPONSE_FILE  CONVEYOR_MODEL
```

`--invoke-cmd` is run through the shell, so a template can be a script path, a wrapper with
flags, or a pipeline.

## Shipped templates

Both templates run a **subscription** session in print/exec mode. Neither reads an API key,
and both clear the provider key variable so a stray export cannot silently start billing.
Both are read-only: they can open the datasheet, context pack, archetype spec and schema,
and they can write nothing.

```sh
tools/conveyor/conveyor extract data/tranches/<tranche>.json \
  --worker night-1 --concurrency 4 \
  --invoke-cmd "tools/conveyor/invokers/claude-print.sh" --model opus

tools/conveyor/conveyor extract data/tranches/<tranche>.json \
  --worker night-2 --concurrency 4 \
  --invoke-cmd "tools/conveyor/invokers/codex-exec.sh" --model gpt-5.6-codex
```

| Template | CLI | Model selection |
| --- | --- | --- |
| `claude-print.sh` | `claude -p --output-format json --allowed-tools "Read Glob Grep"` | `--model` on `extract`, or `CONVEYOR_MODEL`; default `opus` |
| `codex-exec.sh` | `codex exec --sandbox read-only --skip-git-repo-check --json -` | `--model` on `extract`, or `CONVEYOR_MODEL`; default `gpt-5.6-codex` |

Override the binary with `CONVEYOR_CLAUDE_BIN` or `CONVEYOR_CODEX_BIN`.

`emit.py` turns each CLI's envelope into the contract above: it prints the result text and
one usage line. Flag spellings drift between CLI releases (`--allowed-tools` versus
`--allowedTools`, `codex exec -` versus a positional prompt). Check the templates against
`claude --help` and `codex exec --help` on the machine that will run the nightly loop, and
prove the wiring with a dry run before the first real night:

```sh
tools/conveyor/conveyor extract data/tranches/<tranche>.json --worker night-1 \
  --invoke-cmd "tools/conveyor/invokers/claude-print.sh" --dry-run
```

The dry run writes every prompt file, `extraction-dispatch.json`, and
`extraction-dry-run.sh` containing the exact command lines, and invokes nothing.

## Writing your own

Anything satisfying the contract works. The test suite uses a fake invoker
(`test/fixtures/fake-invoker.py`) that echoes a fixture and a usage line, which is also the
shortest example of a valid template. Real CLIs are never executed by the tests.
