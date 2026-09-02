# scheMAGIC Model Factory

The factory turns public datasheet facts into original generated SPICE models. It never downloads vendor `.lib` or `.cir` files, and datasheet PDFs remain only under the ignored `tmp/` directory.

Newly generated model headers and attribution use the scheMAGIC brand. Existing
reviewed packages retain their admitted bytes, historical licence attribution,
content hashes, and `opencircuit-*` provenance identifiers. The internal
`@opencircuit/model-factory` package and `opencircuit-model-factory` CLI names
also remain stable compatibility identifiers.

## Environment

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Native ngspice is resolved in this order: `NGSPICE_BIN`, then `ngspice` on `PATH`, then
`/opt/homebrew/bin/ngspice`. Nothing is guessed: if none of the three yields an
executable, the fitter fails with the full search order, because a different ngspice
build would change every fitted number without changing any recorded provenance.

## Tests

```sh
npm test                # node suite, which also runs the python suite
npm run test:python     # python suite on its own
npm run bench:fit       # batched-versus-unbatched fitting benchmark and equivalence check
```

## Fitting performance

The BJT and MOSFET F2 fitters used to spawn one ngspice process per residual evaluation,
so an n-parameter fit paid n + 1 process launches per iteration for the finite-difference
Jacobian alone. `python/batched_jacobian.py` now evaluates a parameter vector together
with the neighbours scipy is about to ask for, and `native_ngspice.run_ngspice_batch`
runs them in one ngspice process.

The decks are **not** merged. Each keeps its own netlist and a control-block driver
sources, runs and writes them one after another, so every deck still gets its own circuit
and its own matrix and the numbers are bit-identical to separate processes. Merging them
into a single netlist was tried and rejected: independent blocks then share one global
convergence test, which moved sub-threshold drain currents by up to 4e-5 relative and
steered the MOSFET fit to visibly different parameters.

A long-lived interactive ngspice was tried first. On the ngspice-46 builds this factory
runs against, both `ngspice -p` and `ngspice -i` abort with "no graphics interface"
before reading a command, and `-p` segfaults.

Iteration caps are named and configurable: `OC_FIT_DIODE_MAX_NFEV` (default 3000),
`OC_FIT_BJT_MAX_NFEV` (400), `OC_FIT_MOSFET_MAX_NFEV` (3000). Set
`OC_FIT_BATCHED_JACOBIAN=0` to take the unbatched path.

## Archetype dispatch

Every registry archetype maps to exactly one fitter script, and an unmapped archetype
raises `UnmappedArchetypeError` by name. There is no default fitter: the dispatch used to
end in `?? "fit_diode.py"`, which meant the registry's only JFET would have been handed
the diode fitter. Archetypes that are deliberately not fittable are listed in
`UNFITTABLE_PIPELINES` with the reason.

## Pipeline

```sh
node factory.mjs resolve --mpn 1N4148
node factory.mjs acquire --mpn 1N4148
node factory.mjs extract --mpn 1N4148
node factory.mjs fit --mpn 1N4148
node factory.mjs generate --mpn 1N4148
node factory.mjs testgen --mpn 1N4148
node factory.mjs validate --mpn 1N4148
node factory.mjs card --mpn 1N4148
node factory.mjs all --mpn 1N4148
```

Each stage overwrites its deterministic outputs and can be rerun. `validate` runs package validation, every test bench through native ngspice and the WebAssembly engine, and all cited expectation checks. The final independent reviewer remains `pending-review`.

## CONVEYOR bulk adapter

The existing registry-backed `--mpn` stages above remain unchanged. CONVEYOR adds a separate bulk entry point:

```sh
node tools/model-factory/factory.mjs bulk --manifest /absolute/path/to/batch.json --staging-root /absolute/path/to/local-staging
```

The manifest contract is:

```json
{
  "schema_version": "1.0.0",
  "kind": "opencircuit-conveyor-batch",
  "parts": [
    {
      "mpn": "EXAMPLE",
      "manufacturer": "Example Semiconductor",
      "conveyor_family": "diode",
      "datasheet_path": "/absolute/path/to/datasheet.pdf",
      "datasheet_url": "https://example.test/datasheet.pdf",
      "extraction_path": "/absolute/path/to/extraction.json",
      "seed_hints": [],
      "allow_f1_demotion": true,
      "force_f1": false,
      "demotion_reason": null
    }
  ]
}
```

### Evidence contract

The contract is incremental. Each rule reports independently and a package is staged at
the highest fidelity tier its evidence supports, with every rule that did not pass written
into the package's own `known_omissions` and therefore into its model card.

The line the contract turns on is **absent versus contradicted**:

- Evidence that is missing or too thin for a tier raises `InsufficientEvidence` and
  demotes the package. A missing transfer curve is not a wrong claim, it is a smaller
  claim.
- Evidence that contradicts the extraction (axes, units, bias, temperature, citation,
  test mode, polarity) still rejects the whole part. Quietly dropping a contradicted curve
  would hide a contradiction in the source.

Condition identity is built from typed facts only. Disclosure prose is recorded verbatim
as a free-text `notes` field beside the identity and never enters it, so how a footnote
was worded cannot split or merge two measurements. A test mode may be supplied as a typed
`test_mode` field, spelled in prose through a synonym table, or left `not_stated` for the
static characteristics; pulsed evidence must still state its pulse width and still cannot
enter a static DC fit. An unstated temperature is a typed fact that demotes to F1 with a
recorded reason; F2 still requires a stated temperature.

`docs/model-review-rubric-v1.md` is the checklist a second lane runs before promotion.

The adapter supports diode, BJT, and MOSFET families. It attempts an F2 fit unless `force_f1` is set, runs an ngspice syntax gate, and can demote a failed F2 attempt to F1. SI-prefixed catalog seed hints are normalized before F1 fallback use. Pre-demoted parts retain their extraction JSON and its omissions rather than discarding the datasheet evidence.

Bulk output is always unreviewed and is written only below `<staging-root>/packages/`. Each package includes `component.json`, `facts.json`, `fitted.json`, `sources.json`, `model.cir`, `MODEL_CARD.md`, `LICENSE`, and `tests/expectations.json`. Reviewer metadata remains `pending-review`, and F1 demotion reasons appear in both `component.json` known omissions and `MODEL_CARD.md`.

The adapter rejects a staging destination inside `packages/model-library`. It never promotes or overwrites reviewed packages. Promotion remains a separate independent review action.
