# Robonyx Component Schema

This workspace package promotes the component model package contract from `spikes/component-schema/` without changing the historical spike.

## Commands

```sh
node validate.mjs path/to/component.json
node validate-package.mjs path/to/models/manufacturer/mpn
node validate-package.mjs --require-evidence-contract path/to/generated/mosfet/package
npm test
```

`validate-package` checks all required files, JSON schemas, pin mapping invariants, cited F2 tests, source hashes, prohibited vendor model URLs, generated-model header provenance, test netlist references, and an ngspice batch syntax parse of `model.cir`. Factory callers use `--require-evidence-contract` for new MOSFET packages. Reviewed-library admission selects the same strict mode from `packages/model-library/admission-policy.json`, a repository-controlled registry outside candidate package contents, so package-local marker removal cannot disable the contract. New reviewed packages must be registered there as strict evidence-contract packages; the frozen historical inventory remains legacy-compatible.
