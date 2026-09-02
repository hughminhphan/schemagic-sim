# Batch 22 Terra MOSFET contract recovery

Date: 2026-08-23

## Authority and scope

This record applies the producer/consumer evidence-boundary repair already authorized by `docs/campaigns/scale-2k-terra-recovery-authorization.md` to Batch 22. It does not change the frozen denominator, topology decisions, evidence standards, prefit thresholds, physics rules, one-repair ceiling, or single-pass fit rule.

## Observed stop

Batch 22 was paused after exactly eight initial Terra calls and before any focused repair or fit:

- lane A: orders 1000, 1002, 1003, and 1004;
- lane B: orders 1023, 1024, 1025, and 1027;
- eight immutable response drafts and eight unique initial-call audit rows are preserved;
- the other 23 topology-eligible jobs are untouched;
- all nine topology parks remain zero-call denominator members.

The stop exposed two deterministic orchestration defects:

1. The checked-in MOSFET extraction schema described direct scalar `condition` and scalar `locator` values as unconstrained objects even though the producer runtime required exact typed structures. Terra therefore received weaker instructions than the runtime contract and emitted schema-valid but runtime-invalid legacy-shaped conditions.
2. The lane's pure factory preflight passed the frozen manifest part without the job's local `datasheet.path`. The factory correctly refused to construct provenance without the real PDF bytes. The source SHA-256 is an orchestrator-computed fact and must never be requested from, or asserted by, the extraction model.

## Authorized correction

- Publish the existing exact runtime direct-condition and scalar-locator structures in `tools/conveyor/schemas/mosfet.schema.json`.
- Extend the conveyor's deliberately small schema validator only enough to resolve checked-in local JSON Pointer references and enforce the integer/minimum vocabulary used by those structures.
- Add production-shaped regressions proving the shared valid fixture passes and the observed legacy-shaped condition fails at schema validation.
- Pass `{...part, datasheet_path: job.datasheet.path}` to pure factory preflight, exactly matching `conveyor fit`; hash the referenced PDF bytes locally.
- Preserve the eight initial calls. Re-preflight their responses under the corrected orchestration. A failed target may receive no more than its one already-authorized focused repair, and only for a concrete source-supported defect.
- Before calling any of the 23 untouched targets, bind replacement immutable jobs to the exact schema, context-pack, adapter, and recovery-record hashes. Preserve their original zero-call jobs as superseded audit inputs rather than rewriting them.

No source hash, semantic fact, or missing datasheet statement may be invented to obtain acceptance. A response that remains evidence-insufficient after its sole focused repair is retained as a failure. Fitting remains prohibited until both Batch 22 prefit gates pass.

## Verification required before resumption

- focused and discovery conveyor suites pass;
- focused model-factory suite passes;
- JSON parse and diff checks pass;
- an independent read-only review approves the producer/consumer correction;
- the eight preserved calls are re-preflighted with the real immutable PDF path before any further extraction call.
