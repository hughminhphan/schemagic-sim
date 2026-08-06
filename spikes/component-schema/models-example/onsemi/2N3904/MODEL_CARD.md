# onsemi 2N3904 model card

## Status

Schema-complete F2 target example. Model fitting and test execution are pending Phase 3. Every numeric model parameter, operating bound, and expected value is a PLACEHOLDER.

## Interface

- Electrical family: `bjt_npn`
- Model type: `.model` primitive
- SPICE order: collector, base, emitter
- Packages represented: TO-92 and SOT-23

## Intended coverage

DC behavior is the F2 fitting target. AC and transient behavior are currently approximate. Noise, thermal behavior, avalanche, reverse base-emitter breakdown, and safe-operating-area behavior are not supported.

## Provenance

The model text is original work derived from public datasheet facts. The source package stores only the datasheet URL, revision, access date, referenced pages, and fetched-document hash. The example hash is all zeroes and marked as a placeholder.

## Validation

No validation result is claimed. `component.json` therefore records pending status, zero test counts, no fitting error, and a null validation date.
