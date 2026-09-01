# scheMAGIC Part Feeder

The part feeder turns the public jlcparts/LCSC catalog into local tranche manifests and a resumable datasheet staging tree. It supplies raw factual material to `tools/model-factory`; it does not create reviewed model-library entries.

New CLI help and outbound User-Agent text use the scheMAGIC brand. The internal
`@opencircuit/part-feeder` package name, existing `opencircuit-*` manifest kinds,
and frozen reviewed-model provenance remain stable compatibility or historical
identifiers.

## Licensing and data boundary

The repository commits only feeder code, tests, documentation, and small test fixtures. The jlcparts SQLite dump, split archives, manifests, caches, staging records, and datasheet PDFs stay under ignored `tools/part-feeder/data/`.

LCSC and jlcparts data is consumed locally as factory input and is not redistributed by this repository. Datasheet copyright remains with each publisher. Generated scheMAGIC models must continue to cite their factual sources as described in [`docs/LICENSING.md`](../../docs/LICENSING.md).

**Vendor SPICE files are prohibited input.** Do not extend this tool to download, parse, convert, or bulk-import `.lib`, `.cir`, vendor model packs, LTspice standard libraries, or equivalent third-party SPICE content. This feeder accepts catalog parametrics and datasheet PDFs only. scheMAGIC fits its own models from public facts.

## Requirements

- Python 3.11 or newer
- network access for `fetch-db` and `datasheets`
- about 7 GB free for the current database plus its compressed chunks

No Python packages, browser install, OAuth credentials, or jlcparts checkout are required.

## CLI

Run commands from the repository root. The optional global `--data-dir` must come before the subcommand.

```sh
tools/part-feeder/feeder fetch-db

tools/part-feeder/feeder query \
  --canned jellybean-discretes \
  --category "Switching Diodes" \
  --package "SOD-123" \
  --stock-min 10000 \
  --limit 20 \
  --output tools/part-feeder/data/tranches/switching-diodes.json

tools/part-feeder/feeder datasheets \
  tools/part-feeder/data/tranches/switching-diodes.json
```

### `fetch-db`

`fetch-db` discovers the split `cache.z01`, `cache.z02`, and later segments plus `cache.zip` published by the current jlcparts GitHub Pages workflow. It downloads missing or changed segments, converts the multi-disk ZIP metadata to a normal local ZIP, extracts `cache.sqlite3`, validates the required tables with SQLite `quick_check`, and atomically installs it as `data/jlcparts.sqlite3`.

`data/dump.json` records the upstream URL, HTTP dump date, terminal archive identity, segment sizes, local database size, SHA-256, and fetch time. A normal rerun compares the current remote archive identity and exits with `status: current` without reassembly. Use `--refresh` only when a forced rebuild is needed.

The upstream workflow currently deploys the split database through its `gh-pages` branch rather than a GitHub Release asset. The feeder follows the publication mechanism in the upstream workflow so a fresh machine can obtain a queryable dump with one command.

### `query`

Two canned queries are provided:

- `jellybean-discretes`: stocked diode, transistor, LED, and optoelectronic candidates, with optional category and package filters
- `stocked-by-category`: any stocked category, with optional category and package filters

Both order candidates by the upstream `preferred` flag, then stock, then LCSC ID. `preferred` is exposed as the manifest's `popularity` field. The default scan excludes canonical MPNs and ordering-code aliases already present under `packages/model-library/models`. Pass `--include-reviewed` only for auditing or regeneration work.

Arbitrary read-only SQL is supported with `--sql` or `--sql-file`:

```sh
tools/part-feeder/feeder query \
  --sql-file tools/part-feeder/queries/my-tranche.sql \
  --output tools/part-feeder/data/tranches/my-tranche.json
```

The output path must remain inside the selected gitignored data directory; the CLI rejects other destinations. The statement must be one `SELECT` or `WITH` query. Each result row must contain:

- `lcsc` or `lcsc_id`
- `mfr` or `mpn`
- `manufacturer`
- `category`
- `datasheet` or `datasheet_url`
- `attributes`, as a JSON object or JSON string

Useful optional aliases are `subcategory`, `package`, `stock`, `preferred` or `popularity`, `description`, and `lcsc_attributes`. The feeder merges `attributes` and `lcsc_attributes`, preserves every parametric key/value, normalizes numeric LCSC IDs to the `C123` form, applies reviewed-library exclusions, and emits a schema-checked JSON manifest.

A manifest part count is the number of emitted catalog rows after exclusions and duplicate row removal. Ordering-code aliases do not become extra reviewed models. Manufacturer-specific parts that share a printed MPN remain separate catalog candidates until review establishes whether they are genuinely distinct packages or aliases. This preserves the honest-count policy in [`docs/MPN-TARGETS.md`](../../docs/MPN-TARGETS.md).

### `datasheets <manifest>`

Datasheet downloads default to 0.5 requests per second, retry four times with exponential backoff, and use atomic `.part` files. Both HTTP Content-Type and the `%PDF-` signature are checked. Existing valid PDFs are hashed and skipped, so a successful rerun performs no network downloads.

Failures are not hidden. `data/staging/<tranche>/failures.json` lists the MPN, LCSC ID, URL, and final error for each part that needs manual retrieval. A non-empty failure list returns exit code 2.

## Local data and staging layout

```text
tools/part-feeder/data/
  dump.json
  jlcparts.sqlite3
  downloads/
    cache.z01 ... cache.zip
  tranches/
    <tranche>.json
  staging/
    <tranche>/
      manifest.json
      seed-hints.json
      failures.json
      datasheets/
        C123__MPN.pdf
```

Everything in this tree is unreviewed local material and remains outside git. The staged `manifest.json` records PDF hashes and statuses. `seed-hints.json` repeats only catalog-derived initialization hints and labels them `catalog_parametric_not_datasheet_citation`.

## Parametric seeding and factory handoff

Catalog attributes can reduce optimizer search time, but they are not sufficient evidence for a model claim. The feeder maps recognized raw keys to initial-guess targets:

| Catalog fact | Seed target | Existing factory use |
| --- | --- | --- |
| forward voltage / Vf | `diode.forward_voltage` | starting scale for diode IV point extraction |
| DC current gain / hFE | `bjt.dc_current_gain` | starting BF region before cited gain points |
| RDS(on) | `vdmos.rds_on` | existing fitter splits the first cited RDS(on) point into RS and RD seeds |
| Ciss, Coss, Crss | `vdmos.ciss`, `vdmos.coss`, `vdmos.crss` | starting capacitance values before cited curve/table fitting |
| VGS(th) | `vdmos.threshold` | initial VTO range before cited transfer fitting |

The current factory registry in `tools/model-factory/lib/parts.mjs` owns identity, cited facts, package metadata, and fit inputs. Its CLI resolves one registered MPN and expects `tools/model-factory/tmp/<slug>/datasheet.pdf`; it does not yet accept an external tranche manifest or staging root. The feeder therefore does not write into the factory or reviewed library.

For each staged part, a factory authoring lane should:

1. Read `staging/<tranche>/manifest.json`, `seed-hints.json`, and the hashed PDF.
2. Confirm the manufacturer identity, exact ordering code, package, revision, and official datasheet provenance.
3. Convert relevant datasheet tables and curves into the factory's structured `facts.json` quantities. Every factual value still needs unit, conditions, page reference, and source kind.
4. Use catalog hints only as optimizer initial guesses. Replace them with cited datasheet values before fit acceptance.
5. Run the factory fit, generation, native ngspice, WebAssembly, expectation, boundary, source, and model-card checks required by that archetype.
6. Write all generated output to an unreviewed working area first. Do not set a reviewer or copy it into `packages/model-library/models` from the bulk lane.

This separation is intentional. The feeder is a selection and acquisition layer, not evidence extraction and not a fit-review shortcut.

## Promotion honesty

The promotion flow is:

```text
SQL-selected manifest
  -> local datasheet staging
  -> bulk factory authoring and validation outside the reviewed library
  -> independent review lanes inspect source identity, citations, fit quality,
     generated model, native/WASM benches, operating bounds, and omissions
  -> approved model package copied into packages/model-library/models
```

A bulk fit with passing automated tests remains unreviewed. It parks under the ignored part-feeder staging tree, or another explicitly ignored factory work directory, with reviewer status pending. Only an independent review lane can promote it into `packages/model-library/models`. The reviewed-model count is the count of real promoted `component.json` packages with datasheet provenance, not SQL rows, aliases, attempted fits, or staged outputs.

## DigiKey enrichment extension point

A future adapter may enrich a selected part after LCSC selection. The interface is intentionally provider-neutral:

```python
class CatalogEnricher(Protocol):
    provider: str

    def enrich(self, part: Mapping[str, object]) -> EnrichmentResult:
        """Return factual attributes, datasheet candidates, and provider IDs."""
```

`EnrichmentResult` should contain `provider`, `provider_part_id`, `attributes`, `datasheet_urls`, `matched_mpn`, and `match_confidence`. Enrichment must preserve source names and raw values instead of silently overwriting jlcparts fields. The DigiKey Product Information API implementation would live behind this interface, operate only on already selected tranche rows, and keep OAuth tokens outside files through the repository's secret-management policy.

This repository intentionally includes no DigiKey OAuth flow, credentials, token cache, or API implementation.

## Tests

```sh
npm --prefix tools/part-feeder test
npm --prefix tools/part-feeder run typecheck
```

The suite covers split archive reassembly, SQL selection and manifest schema, reviewed-MPN exclusion, rate limiting, PDF validation, and resume behavior with mocked network calls. Set `FEEDER_LIVE_SMOKE=1` to enable the small optional HEAD request against the published archive.
