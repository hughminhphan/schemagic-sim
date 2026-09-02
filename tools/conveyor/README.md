# scheMAGIC Model Conveyor

CONVEYOR turns a SQL-selected tranche of catalog parts into unreviewed, local model packages. It reuses `tools/part-feeder` for manifest generation and datasheet acquisition, then hands validated extraction JSON to the bulk adapter in `tools/model-factory`.

CONVEYOR never promotes output into `packages/model-library`. Every generated PDF, extraction response, state database, fit batch, and package remains under the gitignored `tools/conveyor/data/` tree until an independent review process promotes it.

The campaign this tool serves runs under [`docs/library-campaign-protocol-v2.md`](../../docs/library-campaign-protocol-v2.md): a nightly, unattended loop on subscription LLM sessions, with merging a pull request as the only human step.

## CLI

Run commands from the repository root:

```sh
tools/conveyor/conveyor select --name proving-50
tools/conveyor/conveyor select --name top-300 --relevance-list tools/conveyor/relevance/top-300-draft.txt
tools/conveyor/conveyor fetch tools/conveyor/data/tranches/proving-50.json
tools/conveyor/conveyor claim tools/conveyor/data/tranches/proving-50.json --worker night-1 --n 20 --ttl 3600
tools/conveyor/conveyor extract tools/conveyor/data/tranches/proving-50.json --worker night-1 \
  --concurrency 4 --invoke-cmd "tools/conveyor/invokers/claude-print.sh"
tools/conveyor/conveyor jobs tools/conveyor/data/tranches/proving-50.json
tools/conveyor/conveyor ingest tools/conveyor/data/tranches/proving-50.json --lcsc-id C123 --response /absolute/path/to/response.json
tools/conveyor/conveyor fit tools/conveyor/data/tranches/proving-50.json
tools/conveyor/conveyor status tools/conveyor/data/tranches/proving-50.json --costs
tools/conveyor/conveyor export-extractions --to tools/conveyor/extractions
```

Global options:

- `--data-dir PATH` changes the ignored local state and staging root.
- `--catalog-data PATH` changes the external jlcparts dump location. Without it the value of `ROBONYX_CATALOG_DATA` is used. With neither, the historical path `/Users/hughp/Documents/opencircuit/tools/part-feeder/data` is used and a warning is printed to stderr, because that path exists on exactly one machine.

`select` opens `jlcparts.sqlite3` through the feeder's read-only query path. It uses `queries/proving-50.sql`, excludes MPNs already represented by reviewed packages, orders toward high stock and major manufacturers, and fills a balanced quota of 18 diodes, 16 BJTs, and 16 MOSFETs.

`fetch` uses the feeder's resumable, rate-limited PDF downloader. `--rate` defaults to 0.5 requests per second and `--retries` defaults to 4.

### Relevance-list selection

`select --relevance-list PATH` replaces catalog rank with a curated list. Catalog rank orders by LCSC assembly-house popularity, which stops matching what a person simulates once the head of the ordering is consumed. The list is the relevance signal; the catalog only supplies the datasheet URL, package, and parametric seed hints.

```text
MPN | manufacturer | priority | family
```

One MPN per line; every field after the MPN is optional. Fields are separated by `|` and never by a comma, because ordering codes contain commas (`PMBT2222A,215`). A blank manufacturer lets the best stocked catalog row win. Priority is an integer, lower first, default 100. Family is `diode`, `bjt` or `mosfet` and overrides catalog classification. `#` starts a comment, inline comments included.

Family quotas are not applied to a relevance selection; the list decides the composition and `--limit` caps it. An entry with no catalog row carrying a datasheet URL is reported in `selection_skips` with its reason rather than silently dropped, and an entry already represented in the reviewed library is skipped as an identity collision, so the skip report doubles as a coverage report.

`relevance/top-300-draft.txt` is a **draft** seeded from the reviewed library plus the LTspice, KiCad, ngspice, Arduino and Falstad jellybeans. It is not authorized until Hugh signs it off.

### Gated datasheets never stall

A datasheet the publisher gates behind a click-through can be dropped by hand at `tmp/manual-d/<lcsc>__<mpn>.pdf` (or `<mpn>.pdf`, or `<lcsc>.pdf`; `--manual-drop` moves the directory). `fetch` adopts it, validates the PDF signature, records its hash and source in the staged manifest, and continues.

When no drop is present the part is recorded as `failed_datasheet_fetched` with a reason beginning `skipped:`, and `fetch` exits 0. A skipped reason is never leased again, so an unattended night neither waits for a human nor burns tokens on the same gated PDF twice. `--strict` restores the old exit code 2.

### Leases

`claim` leases parts to one worker so two unattended sessions can share a tranche.

```sh
tools/conveyor/conveyor claim <manifest> --worker night-1 --n 20 --ttl 3600
tools/conveyor/conveyor claim <manifest> --worker night-1 --release
```

The lease is a single `UPDATE ... RETURNING` (SQLite 3.35 or newer), so racing workers cannot both hold a part. An expired lease is reclaimable by anyone, which is what lets a killed session recover without a human. Never claimed: parts at or past `--max-attempts` (default 3) and parts whose reason begins `skipped:` or `selection skipped:`. `--states` narrows the claimable states.

Worker ids must be unique per process.

### Extraction

`extract` is the production dispatcher. It leases what it needs, writes one prompt file per part, runs the invoker command with that prompt on stdin, and applies the same ingest gates a hand-run batch applied.

```sh
tools/conveyor/conveyor extract <manifest> --worker night-1 --concurrency 4 \
  --invoke-cmd "tools/conveyor/invokers/claude-print.sh" --model opus
```

- `--concurrency` is capped at 4, the same ceiling `run_extraction_batch` enforces.
- `--n` caps how many parts one run takes; the default is the whole tranche.
- `--dry-run` writes every prompt, `extraction-dispatch.json`, and `extraction-dry-run.sh` containing the exact command lines, and invokes nothing.
- Resume is idempotent: only `datasheet_fetched` and `failed_extracted` are eligible, so a rerun picks up exactly what is unfinished and stops when the attempt ceiling is reached.

Every job records the SHA-256 of its prompt, datasheet and response, its token counts, wall time, invoker status and ingest outcome in `staging/<tranche>/extraction-ledger.json`, which is merged across runs. The invoker contract and the two shipped subscription-CLI templates are documented in [`invokers/README.md`](invokers/README.md).

### Cost accounting

`status --costs` reports tokens in, tokens out and wall seconds per stage from the append-only `cost_events` table, the same per staged part with the model that produced it, and the campaign's real unit cost as `tokens_per_staged_part` and `wall_seconds_per_staged_part` (charged parts include the failures, staged parts are the yield).

### Preserving extractions

`export-extractions --to tools/conveyor/extractions` copies every `**/extractions/*.json` under the data directory into a tracked directory with a hashed manifest, preserving relative paths so tranches cannot collide. Extraction JSON is the only campaign output that cannot be recreated cheaply: datasheets refetch and packages regenerate, but the LLM reading of each PDF costs the tokens again. Run it before any prune.

## SQLite lifecycle

The local `data/conveyor-state.sqlite3` database stores one row per tranche and LCSC ID, plus an append-only transition audit table and an append-only cost table.

State schema version `1.1.0` added `claimed_by`, `claim_expires_at`, `tokens_in`, `tokens_out`, `llm_model` and `wall_seconds` to `parts`, plus the `cost_events` and `meta` tables. The migration runs automatically on open and is purely additive, so a database from batches 1 to 9 keeps every row, transition and retry count. Reopening is a no-op. `status` prints the version it is running.

The linear states are:

```text
selected -> datasheet_fetched -> extracted -> fitted -> staged
```

Each post-selection stage has a matching failure bucket:

```text
failed_datasheet_fetched
failed_extracted
failed_fitted
failed_staged
```

A failed stage records its reason and can resume into the corresponding successful state. Retry accounting is stage-specific through the transition log, so a datasheet retry does not consume the extraction discrepancy retry. Seeding is idempotent and cannot duplicate a part.

## Extraction handoff

`extract` is the production path. `jobs` remains for a hand-run batch: it writes `data/staging/<tranche>/extraction-jobs.json`, where each job contains exactly one datasheet path, one family context pack, an output path, and a strict prompt. Every prompt begins exactly:

```text
Do not invoke any Skill at any point in this task.
```

Dispatch batches are capped at four concurrent calls. `run_extraction_batch` enforces that hard maximum for every caller, injected, mocked, or the real subprocess invoker.

Family context packs and schemas are checked in under:

```text
context-packs/diode.json
context-packs/bjt.json
context-packs/mosfet.json
schemas/diode.schema.json
schemas/bjt.schema.json
schemas/mosfet.schema.json
```

Responses must contain schema-conformant JSON only. Curves retain axes, units, test conditions, page references, and real points. Table quantities retain value, unit, conditions, page reference, and source semantics. Unusable curves must be represented honestly with `usable_curves: false` and a precise omission reason.

## Validation and retries

`ingest` performs four gates:

1. Parse JSON and apply the strict family schema.
2. Match MPN, manufacturer, and family identity to the selected manifest.
3. Enforce the usable-curve consistency rule.
4. Cross-check extracted targets against jlcparts catalog parametrics.

Catalog test-condition numbers after `@` are excluded from value comparison, and SI prefixes are normalized. The catalog stores the same parameter under several attribute names and the copies do not always agree, so a target is **corroborated when any hint mapped to it agrees** — one corrupt duplicate row cannot veto an extraction another row confirms. The documented ratio limit is compared with a relative epsilon so a ratio landing exactly on the limit is not decided by floating-point representation. A discrepant or invalid extraction receives one retry at the extraction stage. The retry brief quotes the discrepancy. A second catalog discrepancy is accepted only as an F1 candidate with the reason preserved in state. A datasheet without usable curves is also accepted only as F1.

## Fitting and family parking

`fit` creates a one-part bulk manifest for each extracted row and invokes:

```sh
node tools/model-factory/factory.mjs bulk --manifest <batch.json> --staging-root <local-staging>
```

Every eligible part attempts F2 first, through `tools/model-factory/python/fit_conveyor.py`:

- curves are selected by axis quantity, unit and test condition, never by curve name
- declared axis units are applied before fitting
- traces that violate device physics (non-monotonic ohmic traces, body-diode curves offered as channel output curves) are excluded with a recorded reason
- diodes fit `IS`, `N`, `RS`; BJTs fit a Gummel-Poon `BF`/`ISE`/`IKF` against the digitised typical hFE curve; MOSFETs fit `VTO`, `KP`, `THETA`, `LAMBDA`, `RD`
- parameters the data cannot constrain are held at declared defaults rather than optimised onto a bound; a parameter that does park on a bound fails the gate regardless of its residual
- every residual is measured by evaluating the emitted model card in native ngspice-46

A conveyor F2 is a **DC-only** claim. `domain_coverage.ac` stays `none` and terminal capacitances are transcribed from the datasheet table, never fitted.

Per-family tolerances live in `tools/model-factory/lib/fit-gates.json`, each with a written digitisation reading-error budget and the reviewed-library precedent that bounds it. If the F2 gate fails, the adapter generates an honest F1 fallback and records the demotion reason plus the full residual table in:

- the SQLite state row and transition log
- `factory-results.json`
- the staged `component.json` known omissions
- the staged `fitted.json` (`residuals`, `curves_used`, `curves_rejected`)
- the staged `MODEL_CARD.md`

After `--park-after` consecutive F2 gate failures in a family **that has never produced an F2**, the family is parked; later parts retain their extraction evidence but are staged directly at F1 with the parking reason. A single F2 anywhere in the family clears the counter and prevents parking, because a family the pipeline can demonstrably fit must not be parked by its honest per-part F1s. `family-parked.json` persists parked families with both failure and success counts so a resumed fit does not forget the gate history.

Use `fit --no-park` for proving or diagnostic runs so every part records its own fit evidence instead of inheriting a family reason.

## Local output

A tranche uses this ignored layout:

```text
data/
  conveyor-state.sqlite3
  tranches/<name>.json
  staging/<name>/
    datasheets/
    prompts/
    extractions/
    extraction-jobs.json
    extraction-dispatch.json
    extraction-dry-run.sh
    extraction-ledger.json
    factory-batches/
    family-parked.json
    factory-results.json
    packages/<manufacturer>/<mpn>/
```

The one tracked exception is `tools/conveyor/extractions/`, the preserved copy of every extraction JSON written by `export-extractions`.

All packages remain marked `pending-review`. A staged package is not a reviewed model and must not be copied into `packages/model-library` without the separate source, fit, native and WASM, operating-bound, omission, and package review process.

## Tests

```sh
npm --prefix tools/conveyor test
npm --prefix tools/conveyor run typecheck
npm --prefix tools/model-factory test
```

The conveyor suite covers state transitions and resumption, the 1.0.0 to 1.1.0 migration, lease atomicity and expiry, cost accounting per stage and per staged part, invoker output parsing and the subprocess invoker, relevance-list parsing and matching, extraction export, strict schema validation, catalog cross-checking including the corroboration rule and the ratio epsilon, the family parking decision, stage-specific retries, and the four-call concurrency ceiling. Invoker tests run `test/fixtures/fake-invoker.py`; no real CLI is ever executed by the suite. The model-factory suite covers the bulk adapter and the conveyor fitter (curve selection by axis semantics, declared-unit handling, extraction validation, bound-saturation rejection, ngspice-measured residuals, and the gate calibration table) while retaining the existing registry-backed one-MPN tests.

`tools/conveyor/DIAGNOSIS.md` records why the first proving run produced 0 of 50 F2 packages and what the corrected pipeline produces instead.
