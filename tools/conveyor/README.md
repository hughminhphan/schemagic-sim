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

The conveyor suite covers state transitions and resumption, strict schema validation, catalog cross-checking including the corroboration rule and the ratio epsilon, the family parking decision, stage-specific retries, and a mocked Luna dispatcher with the four-call concurrency ceiling. The model-factory suite covers the bulk adapter and the conveyor fitter — curve selection by axis semantics, declared-unit handling, extraction validation, bound-saturation rejection, ngspice-measured residuals, and the gate calibration table — while retaining the existing registry-backed one-MPN tests.

`tools/conveyor/DIAGNOSIS.md` records why the first proving run produced 0 of 50 F2 packages and what the corrected pipeline produces instead.
