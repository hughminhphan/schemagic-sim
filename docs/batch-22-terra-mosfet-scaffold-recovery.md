# Batch 22 Terra MOSFET scaffold recovery

Date: 2026-08-23

## Scope

This record follows the stopped structural probe in `docs/batch-22-terra-mosfet-structural-validation-recovery.md`. It removes whole-document serialization from the extraction turn by supplying an evidence-empty response scaffold. No evidence, denominator, repair, gate, physics, or fit rule changes.

## Structural probe result

The order 1012 / C501507 Terra turn inspected the source and attempted to construct an extraction by mutating the production fixture with an ad hoc script. That script failed before producing JSON, and its diagnostic text was preserved as the immutable response. Strict producer validation failed at JSON parsing; factory preflight did not run. The untouched initial call is consumed. No other target was dispatched.

## Authorized scaffold probe

- Order 1012 may use its sole focused repair. No other target is released.
- Before dispatch, the orchestrator creates a content-addressed, evidence-empty, schema-valid JSON scaffold at a new response path. It contains only the bound identity, required null/empty fields, and an explicit sentinel note. The scaffold has no evidence role.
- The Terra turn reads one PDF, the bound schema/context, and the structure-only production fixture, then edits only the scaffold response with `apply_patch`. It must not run a generated whole-document rewrite, redirect command output into the response, or modify any prior response.
- The turn must replace the sentinel, add only directly verified evidence, run exact strict producer validation, repair within the same turn until validation passes, and return.
- The orchestrator independently verifies that the sentinel is absent, the original scaffold and prior responses retain their hashes, and pure factory preflight passes using the real `datasheet_path`.
- Use the other existing Terra lane from the failed structural probe. Dispatch exactly one target in the turn.
- Release the remaining 21 opportunities only if this focused repair passes as direct or genuine-interval evidence. Otherwise stop again.

The model may copy object structure from the fixture but no fixture value, condition, locator, identity, or source fact. No missing value, bound, temperature, electrical relation, test mode, locator, curve point, or source hash may be invented.
