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
