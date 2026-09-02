# Batch 22 Terra MOSFET structural-validation recovery

Date: 2026-08-23

## Scope

This record narrows the source-inspection recovery in `docs/campaigns/batch-22-terra-mosfet-extraction-quality-recovery.md`. It adds a structural exemplar and same-turn validation requirement. It does not change the frozen denominator, evidence meanings, one-repair ceiling, prefit or final thresholds, physics rules, or fit-pass limit.

## Probe result

The order 1033 / C2647 one-PDF probe succeeded at source inspection: it located and transcribed a real two-sided threshold interval. It failed strict ingestion because it added a prohibited source hash to scalar locators and serialized scalar conditions in the obsolete free-form shape rather than the bound direct-condition schema. The immutable failed response and validation ledger are retained, and order 1033 has consumed its sole repair.

This distinguishes the failure from both source attrition and PDF-reading failure. The remaining defect is schema-conformant serialization.

## Authorized structural probe

- Use `tools/conveyor/test/fixtures/mosfet-critical.json` only as a content-addressed structural exemplar. Its values are not evidence and must never be copied into another part.
- A one-target Terra turn must read the bound schema, context pack, exemplar, and PDF before drafting.
- After writing its distinct response, the same turn must run the conveyor's strict `load_and_validate_extraction` path with the exact expected MPN, manufacturer, and MOSFET family. It must repair schema or runtime-shape errors within that same turn and re-run validation before returning.
- Pure factory evidence preflight remains a separate orchestrator gate using the real bound `datasheet_path`.
- Dispatch only the untouched initial call for order 1012 / C501507 as the structural probe. The PDF must be inspected directly; no value stated by an operator, prompt, catalog, exemplar, or prior response is evidence.
- Release the other 21 opportunities only if order 1012 passes strict ingestion and pure factory preflight as direct or genuine-interval evidence.
- If order 1012 fails schema/runtime shape or returns another empty fallback, stop before dispatching the other 21.

Every later call remains one PDF per Terra agent turn with a distinct immutable response. No missing value, bound, temperature, electrical relation, test mode, locator, curve point, or source hash may be invented.
