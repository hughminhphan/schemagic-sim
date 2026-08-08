# OpenCircuit model factory

The factory turns public datasheet facts into original generated SPICE models. It never downloads vendor `.lib` or `.cir` files, and datasheet PDFs remain only under the ignored `tmp/` directory.

## Environment

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

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

The adapter supports diode, BJT, and MOSFET families. It attempts an F2 fit unless `force_f1` is set, runs an ngspice syntax gate, and can demote a failed F2 attempt to F1. SI-prefixed catalog seed hints are normalized before F1 fallback use. Pre-demoted parts retain their extraction JSON and its omissions rather than discarding the datasheet evidence.

Bulk output is always unreviewed and is written only below `<staging-root>/packages/`. Each package includes `component.json`, `facts.json`, `fitted.json`, `sources.json`, `model.cir`, `MODEL_CARD.md`, `LICENSE`, and `tests/expectations.json`. Reviewer metadata remains `pending-review`, and F1 demotion reasons appear in both `component.json` known omissions and `MODEL_CARD.md`.

The adapter rejects a staging destination inside `packages/model-library`. It never promotes or overwrites reviewed packages. Promotion remains a separate independent review action.
