# scheMAGIC scale-2k campaign authorization (Batches 15 and onward)

Schema version 1.0.0. Date 2026-08-12.

Authorized by Hugh's instruction: "okay just keep driving unti u hit the goal". Issued by the Fable release-control judge after reviewing tracked main at `6c03fd5`, the Batch 11 through 14 records, `docs/campaigns/scale-2k-freeze.json`, `docs/mosfet-f1-constraint-semantics.md`, and the current conveyor and model-factory trees.

## 1. Campaign goal and terminals

- Continue from 710 reviewed packages toward at least 1,000 reviewed packages in `packages/model-library/models`.
- The campaign ends cleanly at whichever comes first: reviewed count at least 1,000, or exhaustion of frozen MOSFET orders through 1305 plus the conditional reclaim in section 3.
- Exhaustion short of 1,000 is a valid campaign terminal. It closes with a final Fable campaign audit and report to Hugh.
- The frozen scale-2k manifest, SHA-256 `c003a37a26c5ce343ed884a38801d9a5acdbac17412d409dc2fd9c1b5ddf790e`, is the sole candidate source. No catalog refresh, substitutions, or out-of-manifest parts.
- Deferred diode orders 690 through 879 remain out of scope. Reopening them requires a new authorization.

## 2. Evidence isolation

Batch 14's rule that treated path-name visibility as access is retired.

Always permitted and never a breach:

- `git status`, `git diff`, `git log`, `git ls-files`, `git show` on tracked content, `git rev-parse`, and branch or remote verification.
- Seeing, listing, or stating names and top-level metadata such as existence, size, or modification time for pre-existing untracked or ignored roots.
- Verifying by name that a required fresh root is absent before a batch starts.

Forbidden for `.claude/`, `tools/conveyor/data.pre-hardening/`, and every ignored Batch 10 through 14 artifact root:

- Opening or reading file content inside them.
- Traversing or recursively listing inside them.
- Hashing their contents.
- Copying, moving, modifying, or deleting them.
- Glob searching or grepping within them.
- Using any electrical evidence, model parameters, responses, jobs, ledgers, quarantine, staging structure, filenames, or process shortcuts from them.

A breach is defined by content access or use, not by path-name visibility. Batch 13's structural content read remains a breach. Batch 14's harmless `git status` path-name visibility would not be a breach under this authorization.

## 3. Retired and available order ranges

- Orders 880 through 919, Batch 11: permanently retired.
- Orders 920 through 959, Batch 12: permanently retired.
- Orders 960 through 969, Batch 13: permanently retired.
- Orders 970 through 979, Batch 14: retired for now. They may be reclaimed as one final fresh tranche only after order 1305 is exhausted, only if the campaign remains below 1,000, and only after verifying that `tools/conveyor/data/batch-14-proving` never existed.
- Orders 980 through 1305: available and processed in contiguous ascending ranges.

## 4. Batch 15 proving tranche

- Exact frozen orders: 980 through 989.
- Fixed denominator: 10.
- Substitutions: zero.
- Fresh ignored root: `tools/conveyor/data/batch-15-proving/`, required absent before start.
- Fit is blocked until an independent code review approves the constrained MOSFET F1 implementation and records its verdict in `docs/mosfet-f1-constraint-review.md`.
- Selection, fresh datasheet download, topology preflight, and extraction may run in parallel with code review.
- If code review finds defects, one bounded remediation and re-review cycle is allowed. A second failed review escalates to Hugh.
- Exactly one fit pass is allowed after code approval.
- Proving PASS requires at least 6 provenance-clean staged packages of 10 and at least 3 staged packages in `interval-constrained` mode.
- Proving FAIL stops the campaign for escalation. No constraint or gate may be relaxed.

## 5. Scale batches after proving PASS

- Batch 16 begins at order 990.
- Process contiguous ascending ranges of 40 orders: 990 through 1029, 1030 through 1069, and onward.
- The final normal range is 1270 through 1305 with 36 rows.
- If the reviewed count is still below 1,000 after order 1305, conditionally reclaim orders 970 through 979 under section 3.
- Each 40-row scale batch must produce at least 14 final staged packages and at least 10 provenance-clean packages.
- A scale-batch gate failure stops the campaign for escalation. Thresholds are never relaxed.

## 6. Per-batch mechanics

1. Verify local HEAD equals `origin/main` and the recorded required base. Verify reviewed count and frozen-manifest hash.
2. Create one fresh ignored root. Never reuse roots between batches.
3. Complete topology preflight from each canonical PDF before extraction. Park gate-protected, complementary-pair, multi-die, integrated-network, depletion-mode, and other unsupported topologies before fitting. Parked rows receive no Luna call and remain in the denominator.
4. Create one immutable job per row named `job-<four-digit-order>__<LCSC>.json`. Record SHA-256 before calls, make jobs read-only, and reverify hashes after calls.
5. Maintain a coordinator-only append-only `completion-ledger.jsonl`. Never repeat a completed call.
6. Run at most four concurrent Luna extraction lanes. Every lane prompt begins: "Do not invoke any Skill at any point in this task." Validate response identity against the immutable job before ingest.
7. Permit at most one focused discrepancy retry per target and at most one coordinator missing-only replacement for an infrastructure zero-response.
8. Run exactly one fit pass. No fit or gate retries. No vendor SPICE. No part-specific bypasses.
9. Keep schemas, gates, hard bounds, collision rules, provenance rules, model parameters, evidence modes, and F2 thresholds unchanged. F2 worst relative error remains 0.20 and RMS remains 0.12.
10. Keep observations, constraints, and seeds separate. Bound-derived equality F1 calibration remains quarantined. `interval-constrained` is valid only under `docs/mosfet-f1-constraint-semantics.md`.
11. Run conveyor, model-factory, part-feeder, component-schema, workspace, full-library, per-package, native-ngspice, and native/WASM parity validations.
12. Keep tracked outputs limited to batch records, reviews, promotion manifests, approved package additions, and this authorization. PDFs, SQLite databases, extraction responses, jobs, ledgers, and staging remain ignored.

## 7. Review, promotion, release, and deploy

- Every batch receives an independent package review by a lane independent of the coordinator.
- Package rejection is normal attrition and does not stop the campaign unless the reviewer identifies a systemic defect.
- Promote only reviewer-approved packages, exactly as reviewed.
- Audit identity, aliases, and complete fitted-vector collisions against the current reviewed library before promotion.
- Record deterministic promotion in a tracked manifest.
- Run a final Fable release audit before any push that mutates the library.
- Deploy `schemagic.pages.dev` only after an approved library mutation is committed and pushed with green tests.
- Launch posts, Product Hunt, Reddit, Show HN, and community publishing remain blocked without Hugh's explicit per-channel approval.

## 8. Tracked documents and commit authority

- Campaign authorization: `docs/campaigns/scale-2k-campaign-authorization.md`.
- Batch 15: `docs/campaigns/batch-15-proving-selection.json`, `docs/campaigns/batch-15-proving-execution.json`, and `docs/mosfet-f1-constraint-review.md`.
- Scale batch N: `docs/batch-N-selection.json`, `docs/batch-N-execution.json`, `docs/batch-N-review-log.md`, and `docs/batch-N-promotion-manifest.json`.
- Coordinators may commit and push approved tracked records and deterministic promotions to main.
- Commits include `Co-Authored-By: Claude <noreply@anthropic.com>`.
- No history rewrites.
- No tracked code changes are authorized except the single bounded constrained-F1 remediation in section 4.

## 9. Autonomous loop protocol

After each batch:

1. Verify the intended diff and tests.
2. Commit and push tracked records and approved promotions.
3. Verify local HEAD equals `origin/main`.
4. Immediately begin the next contiguous authorized range.
5. Report reviewed count, staged count, promoted count, and next range to Hugh without waiting for approval.

No new user prompt is required between successful batches.

## 10. Substantive stop conditions

Stop and escalate only for:

- Content-level access or use of a prohibited artifact root.
- A repeated completed extraction call.
- Unauthorized changes to schemas, gates, hard bounds, model parameters, collision rules, provenance rules, or evidence semantics.
- A proving or scale-batch gate failure.
- A systemic defect found by independent review.
- Test-suite, parity, package-validation, or full-library failure.
- Base or frozen-manifest drift.
- Evidence of data loss in preserved ignored roots.
- A second failed constrained-F1 code review after the one bounded remediation cycle.

Path-name visibility and normal repository-state inspection are explicitly not stop conditions.

## First range

Batch 15 processes frozen campaign orders 980 through 989 on a fresh `tools/conveyor/data/batch-15-proving/` root. Fit remains blocked until the independent constrained-F1 code review approves.
