# OpenCircuit model conveyor

CONVEYOR turns a SQL-selected tranche of catalog parts into unreviewed, local model packages. It reuses `tools/part-feeder` for manifest generation and datasheet acquisition, then hands validated extraction JSON to the bulk adapter in `tools/model-factory`.

CONVEYOR never promotes output into `packages/model-library`. Every generated PDF, extraction response, state database, fit batch, and package remains under the gitignored `tools/conveyor/data/` tree until an independent review process promotes it.

## CLI

Run commands from the repository root:

```sh
tools/conveyor/conveyor select --name proving-50
tools/conveyor/conveyor fetch tools/conveyor/data/tranches/proving-50.json
tools/conveyor/conveyor jobs tools/conveyor/data/tranches/proving-50.json
tools/conveyor/conveyor ingest tools/conveyor/data/tranches/proving-50.json --lcsc-id C123 --response /absolute/path/to/response.json
tools/conveyor/conveyor fit tools/conveyor/data/tranches/proving-50.json
tools/conveyor/conveyor status tools/conveyor/data/tranches/proving-50.json
```

Global options:

- `--data-dir PATH` changes the ignored local state and staging root.
- `--catalog-data PATH` changes the external jlcparts dump location. The default is `/Users/hughp/Documents/opencircuit/tools/part-feeder/data`.

`select` opens `jlcparts.sqlite3` through the feeder's read-only query path. It uses `queries/proving-50.sql`, excludes MPNs already represented by reviewed packages, orders toward high stock and major manufacturers, and fills a balanced quota of 18 diodes, 16 BJTs, and 16 MOSFETs.

`fetch` uses the feeder's resumable, rate-limited PDF downloader. `--rate` defaults to 0.5 requests per second and `--retries` defaults to 4.

## SQLite lifecycle

The local `data/conveyor-state.sqlite3` database stores one row per tranche and LCSC ID, plus an append-only transition audit table.

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

## Luna extraction handoff

`jobs` writes `data/staging/<tranche>/extraction-jobs.json`. Each job contains exactly one datasheet path, one family context pack, an output path, and a strict prompt. Every prompt begins exactly:

```text
Do not invoke any Skill at any point in this task.
```

Extraction calls use `subagent_type: "luna"`. Dispatch batches are capped at four concurrent calls. The checked-in `run_extraction_batch` helper also enforces a hard maximum of four for injected or mocked callers.

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

Catalog test-condition numbers after `@` are excluded from value comparison, and SI prefixes are normalized. A discrepant or invalid extraction receives one retry at the extraction stage. The retry brief quotes the discrepancy. A second catalog discrepancy is accepted only as an F1 candidate with the reason preserved in state. A datasheet without usable curves is also accepted only as F1.

## Fitting and family parking

`fit` creates a one-part bulk manifest for each extracted row and invokes:

```sh
node tools/model-factory/factory.mjs bulk --manifest <batch.json> --staging-root <local-staging>
```

Every eligible part attempts F2 first. If the F2 gate fails, the adapter generates an honest F1 fallback and records the demotion reason in:

- the SQLite state row and transition log
- `factory-results.json`
- the staged `component.json` known omissions
- the staged `MODEL_CARD.md`

After two F2 fit-gate failures in one family, the family is parked. Later parts in that family retain their extraction evidence but are staged directly at F1 with the family parking reason. `family-parked.json` persists both parked families and failure counts so a resumed fit does not forget the gate history.

## Local output

A tranche uses this ignored layout:

```text
data/
  conveyor-state.sqlite3
  tranches/<name>.json
  staging/<name>/
    datasheets/
    extractions/
    extraction-jobs.json
    factory-batches/
    family-parked.json
    factory-results.json
    packages/<manufacturer>/<mpn>/
```

All packages remain marked `pending-review`. A staged package is not a reviewed model and must not be copied into `packages/model-library` without the separate source, fit, native and WASM, operating-bound, omission, and package review process.

## Tests

```sh
npm --prefix tools/conveyor test
npm --prefix tools/conveyor run typecheck
npm --prefix tools/model-factory test
```

The conveyor suite covers state transitions and resumption, strict schema validation, catalog cross-checking, stage-specific retries, and a mocked Luna dispatcher with the four-call concurrency ceiling. The model-factory suite covers the bulk adapter while retaining the existing registry-backed one-MPN tests.
