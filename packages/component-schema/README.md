# OpenCircuit component schema

This workspace package promotes the component model package contract from `spikes/component-schema/` without changing the historical spike.

## Commands

```sh
node validate.mjs path/to/component.json
node validate-package.mjs path/to/models/manufacturer/mpn
node validate-package.mjs --require-evidence-contract path/to/generated/mosfet/package
npm test
```

`validate-package` checks all required files, JSON schemas, pin mapping invariants, cited F2 tests, source hashes, prohibited vendor model URLs, generated-model header provenance, test netlist references, and an ngspice batch syntax parse of `model.cir`. Factory and admission callers use `--require-evidence-contract` for new MOSFET packages, so package-local marker removal cannot disable the strict contract.
