# Batch 22 Terra MOSFET evidence-envelope recovery

Date: 2026-08-23

## Scope

This record replaces whole-document MOSFET extraction serialization for the remaining Batch 22 opportunities. It does not change source-evidence requirements, the fixed denominator, topology parks, call/repair ceilings, prefit or final thresholds, physics rules, or the one-pass fit limit.

## Reason

The one-PDF probe proved Terra can locate real source evidence but repeatedly failed to serialize the repeated strict extraction structure. A later scaffold repair made no edits. Those immutable calls remain consumed and their target outcomes remain terminal.

The remaining task is mechanical: threshold evidence repeats one typed condition across minimum, typical, and maximum fields; every RDS(on) row repeats the same condition and locator across VGS, current, and resistance. Requiring the extraction model to reproduce that structure adds failure surface without adding source judgment.

## Authorized producer boundary

- Terra emits a flat MOSFET evidence envelope containing exactly one source-reviewed threshold record and one or more source-reviewed RDS(on) records. It preserves source min/typ/max roles, raw signed values, raw conditions, positive page/table/row locators, stated temperature provenance, electrical coordinates, and test mode.
- `load_and_translate_mosfet_evidence_envelope` deterministically expands that envelope into the existing strict MOSFET extraction contract. It may copy and canonicalize structure only; it may not infer or substitute evidence.
- The envelope schema requires threshold evidence and at least one RDS(on) record. The translator rejects an all-null threshold, validates the expanded payload against the full MOSFET schema, and runs the existing critical-provenance validator.
- The orchestrator preserves both the raw envelope and expanded extraction as immutable hashed artifacts, then runs pure factory preflight with the real bound `datasheet_path`.
- Every target remains one PDF per Terra turn. The model must inspect the PDF with `pdftotext -layout` and render relevant pages when text does not resolve table, footnote, or plot semantics.
- First dispatch only the untouched initial call for order 1019 / C23708. Resume the other 20 opportunities only if its translated extraction passes as direct or genuine-interval evidence.
- No target may exceed one initial call and one focused repair. The ten retained empty initial responses may use their sole focused repair; the eleven untouched targets receive one initial opportunity.

The structure-only converter has no authority to invent a missing value, bound, temperature, relation, mode, locator, source role, or source hash. Fitting remains prohibited until the original Batch 22 accepted and strong prefit gates both pass.

## Gate reachability

Nine topology parks and ten terminal evidence targets leave 21 candidate opportunities. At least 20 of those 21 must become validator-accepted and at least 10 must be direct or genuine-interval evidence. This is mathematically reachable but permits only one additional candidate failure; execution must stop before fitting if either maximum becomes unreachable.
