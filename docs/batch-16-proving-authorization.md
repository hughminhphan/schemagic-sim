# Batch 16 fresh extraction proving authorization

Date: 2026-08-23.

## User direction and effect

After Batch 15R reached its tracked terminal proving failure, Hugh directly instructed: “okay lets keep going then”. This is the new post-failure direction required by `docs/batch-15r-proving-execution.json`.

This authorization supersedes only:

1. the Batch 15R terminal that withheld any new campaign redirect; and
2. the `docs/scale-2k-campaign-authorization.md` requirement that Batch 16 may begin only after Batch 15 proving passes.

It does not relax any electrical, fit, hard-bound, evidence, citation, provenance, collision, package, independent-review, promotion, deployment, or publishing gate.

## Exact base and inventory

- Working branch: `mosfet-cycle4-finish`.
- Required local base before the correction: `2916ac591dc0a9ca4d288e66c406536123638364`.
- Local `origin/main` at authorization time: `e147ecdf4f45f9b54fd467ceedc492ae5bb4d30b`.
- The local branch is ahead of `origin/main`; no equality is claimed.
- Reviewed package count: 710.
- Reviewed inventory SHA-256: `a587d60b946e42f1285f293fba7c5eedbfc5229415e09813de7e85d7fda4c87e`.
- Frozen scale-2k manifest SHA-256: `c003a37a26c5ce343ed884a38801d9a5acdbac17412d409dc2fd9c1b5ddf790e`.

Local correction and proving may proceed on this branch. Repository push, promotion, and deployment remain blocked until the full proving, package-review, and release-audit chain approves the exact resulting tree.

## Narrow producer-validator correction

Batch 15R proved that electrically meaningful Luna output could pass conveyor ingest but fail model-factory admission because the producer and validator used different structural vocabularies. Before any Batch 16 candidate call, one narrow correction may change only:

- `tools/conveyor/conveyorlib.py`;
- `tools/conveyor/context-packs/mosfet.json`;
- `tools/conveyor/schemas/mosfet.schema.json` only if needed to document the enforced producer contract;
- directly related conveyor tests and synthetic fixtures;
- `tools/model-factory/lib/bulk-adapter.mjs`;
- directly related model-factory tests and synthetic fixtures; and
- this authorization and subsequent Batch 16 tracked records.

The correction must:

1. require critical MOSFET scalar citations to resolve to page + table + row, and curve citations to page + figure + curve/trace;
2. reject structurally incomplete critical locators during conveyor ingest so they enter the existing focused discrepancy path before fitting;
3. require exact temperature, electrical bias, and test-mode semantics for every admitted critical curve, while temperature-not-stated remains fail-closed;
4. normalize only standard electrical axis aliases such as `VGS`, `V_GS`, `VDS`, `V_DS`, `ID`, and `I_D` to the existing gate/source, drain/source, and drain/current meanings;
5. keep units, values, curve points, pulse/static distinctions, citations, content hashes, F2 thresholds, hard bounds, and every downstream admission check unchanged; and
6. add regressions for production-style axis tokens and both accepted and rejected citation forms.

No part-specific bypass, fit-threshold change, hard-bound change, fabricated temperature, fabricated test mode, or broad free-text inference is authorized.

The correction receives focused tests, full model-factory and conveyor tests, all 710 reviewed packages, workspace gates, and an independent read-only adversarial review. Concrete review defects trigger narrow remediation and re-review under Hugh’s standing continuation direction.

## Frozen proving tranche

Batch 16 proving uses exact untouched frozen orders 990 through 999, fixed denominator 10, zero substitutions:

| Order | LCSC | MPN |
| ---: | --- | --- |
| 990 | C504071 | CJAB35P03 |
| 991 | C82360 | CJ3401A |
| 992 | C5379814 | TK10A80E,S4X(S |
| 993 | C140583 | NTS2101PT1G |
| 994 | C44209 | CJ2304 |
| 995 | C30170165 | 10N06Q |
| 996 | C5224264 | BSS138L |
| 997 | C148250 | BSC028N06NS |
| 998 | C167139 | WPM3407-3/TR |
| 999 | C5379811 | TPH2R608NH,L1Q(M |

- Frozen identity-vector SHA-256: `d6f8db7b728f445fc77c7ef4466e8fb07005fa29af181169457738098832b8bd`.
- Fresh ignored root: `tools/conveyor/data/batch-16-proving/`, verified absent before creation.
- `tools/conveyor/data/batch-16-prefit/` remains preserved and unread.
- `.claude/`, `tools/conveyor/data.pre-hardening/`, and ignored Batch 10 through 14 content remain prohibited.

## Execution and gate

1. Slice orders 990..999 directly from the frozen manifest; do not re-query or rebalance selection.
2. Download fresh canonical PDFs and finish topology preflight before extraction. Unsupported topologies park in the denominator and receive no model call.
3. Create immutable per-order jobs, hash them before calls, make them read-only, and reverify after calls.
4. Run at most four concurrent Luna lanes. Every prompt begins: `Do not invoke any Skill at any point in this task.`
5. Maintain an append-only completion ledger and never repeat a completed call.
6. Permit at most one focused discrepancy retry per target and one missing-only infrastructure replacement.
7. Run exactly one fit pass after extraction integrity and the approved correction gate. No fit retry.
8. PASS requires at least 6 provenance-clean staged packages of 10 and at least 3 staged packages in `interval-constrained` mode.
9. A proving failure stops candidate execution and records the concrete terminal result; gates are not relaxed.

On PASS only, run an independent package review, collision audit, deterministic promotion, all repository and native/WASM gates, and a final independent release audit before any repository push or deployment. Public launch and community posts remain separately approval-gated.
