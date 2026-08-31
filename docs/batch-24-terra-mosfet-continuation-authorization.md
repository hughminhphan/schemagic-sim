# Batch 24 Terra MOSFET continuation authorization

Date: 2026-09-01.

## Continuation basis

Hugh explicitly directed the reviewed part-library campaign to keep running overnight until a verified reviewed local tranche is ready or a genuine campaign-level blocker is reached. This record continues the campaign after the sealed Batch 23 terminal record at commit `ec8bd1ce45d3dd27408c45613cd2cbdee399445e`.

Batch 23's fixed denominator of 40 terminated before fitting when the unchanged 20-of-40 evidence-preflight gate became mathematically unreachable. Its final state is immutable: 14 accepted, all 14 strong; 15 rejected; seven topology parks; four deliberately uncalled; zero fits, retries, substitutions, staging, promotions, pushes, or deployments. The tracked terminal record is `docs/batch-23-terra-mosfet-prefit-execution.json`, SHA-256 `4065150e91f7c37fa0c16d9a5ae25102c905a74a34da9827276a0b76836363c1` at the sealed commit.

## Batch 24 fixed tranche

Batch 24 is the exact contiguous frozen MOSFET range 1080 through 1119, fixed denominator 40, zero substitutions. Its source is the frozen `tools/part-feeder/data/manifests/scale-2k.json`, SHA-256 `c003a37a26c5ce343ed884a38801d9a5acdbac17412d409dc2fd9c1b5ddf790e`. The canonical compact JSON identity vector containing, in order, only `{lcsc_id, mpn, conveyor_family, family_rank, frozen_campaign_order}` has SHA-256 `6415de02707f2eb0822e7ca52dc8960b3077beb022d4127cdc5581f8dad974c6`.

Use the fresh ignored root `tools/conveyor/data/batch-24-terra-mosfet-scale/`. Do not reuse Batch 23 jobs, responses, translated extractions, ledgers, verdicts, or staging. Slice the frozen source directly; do not query, rebalance, substitute, or family-park a candidate. Acquire and hash every canonical PDF, then complete topology preflight before any model call. Unsupported topology stays in the denominator and receives zero calls.

Generate every eligible Terra job with this Batch 24 authority passed explicitly to `tools/conveyor/terra_envelope.py jobs --authority`; the job and index must bind the resolved authority path and its content hash. The evidence-envelope schema, strict translator, factory adapter, and preflight bindings remain unchanged and content-addressed. Terra inspects exactly one PDF per visible task. Each eligible target may receive one initial extraction and, only when a concrete correctable discrepancy warrants it, one focused repair. No completed call may be repeated.

Exact source facts remain mandatory: two-sided threshold evidence with `VDS = VGS` or an admissible cited typical, and RDS(on) typical or inclusive maximum with stated temperature, VGS, ID, source role, locator, magnitude convention, and source test mode. Missing or unsupported facts fail closed. Deterministic code normalizes and validates; it must not replace semantic source review.

Run no fit unless at least 20 of the fixed 40 pass factory evidence preflight and at least ten are strong routes (`curve-fitted`, `typ-point`, or genuine `interval-constrained`). If either gate becomes mathematically unreachable, seal Batch 24 without more model calls or fit and continue only with a fresh tracked successor authorization over the next untouched frozen tranche.

If both prefit gates pass, run exactly one isolated fit pass with zero fit retries or substitutions. Final PASS requires at least 14 complete staged packages, including at least ten strong, followed by independent package review, primary-source provenance audit, package/schema validation, identity/alias/vector collision checks, regression tests, and native ngspice/WASM parity before any local promotion. Only approved packages may enter the reviewed library.

This authorization permits local campaign evidence, fitting, staging, independent review, and deterministic local promotion on `codex/library-overnight`. It does not authorize a push, deploy, publication, provider activation, protected release-contract change, or merge into another worktree.
