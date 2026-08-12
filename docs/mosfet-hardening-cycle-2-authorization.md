# MOSFET hardening cycle 2 authorization

Date: 2026-08-13. Base: `afd5167`.

Hugh directly authorized a broader MOSFET hardening cycle and increased parallelism. This document amends only the exhausted remediation limit in `docs/scale-2k-campaign-authorization.md`. All electrical gates, evidence rules, collision rules, review gates, and publishing restrictions remain in force.

## Required evidence contract

A MOSFET critical datum is admissible only with one complete canonical condition identity:

- exact temperature in degrees Celsius
- VGS
- ID
- VDS relationship, either `VDS = VGS` or an explicit cited VDS
- normalized qualifier tokens, including pulse width, duty cycle, and test mode
- a primary datasheet citation naming page and table or figure
- evidence role, such as typical observation, inclusive minimum or maximum, or curve point

Every field in a threshold or RDS(on) group must independently resolve to the same condition identity. Unknown, unmatched, or conflicting qualifier tokens fail closed.

Threshold values may influence F2 seeds or optimization bounds only after complete validation. RDS(on) typical values may enter residual observations only after complete validation. RDS(on) maxima may enter inclusive constraints only after complete validation. Real citations propagate into fitted metadata. Placeholder citations are prohibited.

Critical current, temperature, bias, condition, and citation defaults are prohibited in conveyor candidate paths. Non-critical physical constants may remain only as explicit `held_defaults` in fitted metadata.

The Python fit boundary independently rejects threshold and RDS(on) rows without a complete condition identity, even if JavaScript validation regresses.

## Parallel implementation graph

Four disjoint writer lanes are authorized:

1. Bulk admission lane: `tools/model-factory/lib/bulk-adapter.mjs`, its tests, and existing MOSFET fixtures.
2. Factory lane: `tools/model-factory/factory.mjs` and `test/factory.test.mjs`.
3. Python fit lane: `tools/model-factory/python/fit_conveyor.py`, pass-through changes only in `fit_mosfet_f1_constraints.py`, fit-conveyor tests, and new fixture filenames.
4. Scheduler lane: `tools/conveyor/conveyorlib.py`, `tools/conveyor/conveyor`, conveyor tests, and conveyor README.

Only one lane may write each production path. Read-only adversarial and regression lanes may run concurrently. A single integrator merges the lanes and runs the full suite.

## Scheduler upgrade

Raise Luna extraction concurrency from 4 to 8 only after these controls land and pass tests:

- immutable job records and hashes
- coordinator-owned SQLite atomic reservations
- a unique completed-target key
- one completion consumer for all out-of-order lane results
- attempt-specific temporary response files and atomic rename after validation
- no overwrite of canonical responses
- explicit bounded retry and missing-only replacement queues
- lease recovery after coordinator interruption
- completion-queue backpressure at twice the lane cap
- overlap of PDF acquisition, topology preflight, extraction, and ingestion

Concurrency above 8 is not authorized. Eight limits a systemic prompt defect to eight in-flight calls and is expected to reduce extraction wall time about 40 to 50 percent versus four lanes.

## Review and remediation gate

An independent read-only code re-review is required before any candidate fit. One bounded remediation and one re-review are authorized inside this cycle. A second BLOCK stops and escalates.

## Batch 15 evidence and fit

The preserved `batch-15-proving` root is the current batch's own compliant fresh evidence and may be used after code approval. Hardening writers and reviewers must remain evidence-blind and may not open it before the approving verdict.

After approval, the coordinator must reverify all immutable job hashes and exactly eight unique completion-ledger keys. Orders 980 and 988 remain parked. Denominator remains 10. Exactly one fit pass is authorized.

Batch 15 PASS requires:

- at least 6 provenance-clean staged packages of 10
- at least 3 staged packages in `interval-constrained` mode

FAIL stops the campaign without relaxing gates.

## Campaign overlap

Batch 16 orders 990 through 1029 may complete selection, fresh PDF download, topology preflight, and extraction in parallel with hardening and Batch 15 fitting. It uses concurrency 4 until the scheduler upgrade is merged and independently verified, then concurrency 8. Batch 16 fitting remains blocked until Batch 15 proving passes.

## Release gates

Independent package review gates promotion. Fable release audit gates any push that mutates the reviewed library. Green tests gate deployment. Launch and community posts remain blocked without Hugh's explicit per-channel approval.
