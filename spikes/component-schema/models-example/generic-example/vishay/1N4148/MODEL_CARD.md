# Vishay-style 1N4148 model card

## Status

Schema-complete F1 example. Model fitting and test execution are pending Phase 3. Every numeric model parameter, operating bound, and expected value is a PLACEHOLDER.

## Interface

- Electrical family: `diode`
- Model type: `.model` primitive
- SPICE order: anode, cathode
- Package represented: DO-35

## Intended coverage

DC, AC, and transient behavior are functional approximations. Reverse recovery is first-order only. Breakdown, noise, thermal behavior, and self-heating are not supported.

## Provenance

The model text is original work derived from public datasheet facts. The source package stores only the datasheet URL, revision, access date, referenced pages, and fetched-document hash. The example hash is all zeroes and marked as a placeholder.

## Validation

No validation result is claimed. `component.json` therefore records pending status, zero test counts, no fitting error, and a null validation date.
