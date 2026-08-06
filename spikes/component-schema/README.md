# OpenCircuit component package contract spike

This directory freezes the proposed metadata, provenance, and test-expectation contract for real component model packages.

## Package layout

```text
models/<manufacturer>/<mpn>/
  component.json
  model.cir
  sources.json
  MODEL_CARD.md
  LICENSE
  tests/*.cir
  tests/expectations.json
```

`model.cir` must be original work unless the package explicitly records licensed redistribution. Never commit a fetched datasheet PDF or other source document. Store its URL, revision, access date, referenced pages, and SHA-256 hash in `sources.json`.

## Schemas

- `component.schema.json`: Draft 2020-12 metadata contract.
- `sources.schema.json`: Provenance record array.
- `expectations.schema.json`: Test netlists, scalar targets, tolerances, citations, and hard bounds.

All objects reject unknown properties. This is intentional. Contract changes require an explicit schema-version decision rather than silently accumulating fields.

## Fidelity tiers

- `F0`: metadata only.
- `F1`: functional approximation.
- `F2`: datasheet-fitted.
- `F3`: licensed manufacturer model.
- `F4`: bench-calibrated.

Coverage is rated independently for DC, AC, transient, noise, thermal, and digital behavior. A high package tier does not imply equal coverage in every domain.

## Pin identity

`symbol_pins[].number` is the stable logical pin identity. `spice_pin_mapping` maps that identity to the model node name and one-based SPICE node order. Each package variant separately maps physical package pins to logical symbol pins. Contributor tooling should additionally enforce uniqueness and complete pin coverage.

## Pending results

A package may be schema-complete before fitting is complete. Pending packages must use zero test counts, null worst fitting error, and null validation date. Example numeric values use `placeholder: true` and visible `PLACEHOLDER` labels. Do not convert those examples into validation claims.

A complete result must supply a non-null worst observed relative fitting error and name its quantity. The error is a ratio, so `0.05` means 5 percent.

## Licence and provenance

`licence.spdx_id` identifies the licence of the distributed model package. `licence.provenance_basis` states how the model may exist:

- `original_from_facts`
- `licensed_redistribution`
- `measured`

The field uses British noun spelling, `licence`, to match this frozen contract. The package file remains named `LICENSE`.

## Independent review

`generator.tool_or_agent` and `reviewer.tool_or_agent` must differ. JSON Schema cannot compare sibling values, so `validate.mjs` enforces this rule.

## F2 and above

F2, F3, and F4 packages require at least one test check with a non-empty `datasheet_citation`. This is enforced across the sibling `tests/expectations.json` file by `validate.mjs`.

`known_omissions` is always non-empty in this contract. This is stricter than the minimum F1/F2 wording and keeps unsupported behavior explicit even for licensed or measured models.

## Validate

From this directory:

```sh
node validate.mjs models-example/onsemi/2N3904/component.json
node validate.mjs models-example/generic-example/vishay/1N4148/component.json
node validate.mjs fixtures/broken-component.json
```

The first two commands must pass. The broken fixture must fail.

Run the complete smoke check with:

```sh
npm test
```

## Example path note

The requested diode example lives at `models-example/generic-example/vishay/1N4148/`. That extra `generic-example` namespace is example-only. Production packages use exactly `models/<manufacturer>/<mpn>/`.
