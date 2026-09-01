# MOSFET evidence-admission cycle 4 review

Date: 2026-08-14

## Scope and authority

Hugh's standing authorization in `docs/mosfet-hardening-standing-authorization.md` permits narrow consequence-driven corrections until the integrated evidence-admission implementation receives independent approval or reaches a material blocker. The reviewed library must remain unchanged until candidate packages pass their separate independent package review.

This review covers the cumulative correction range `4814648..1b68647` on branch `mosfet-cycle4-finish`.

## Corrected lifecycle guarantees

Commit `1b68647` closes the remaining package-admission and generated-bench lifecycle gaps:

- Repository-controlled `packages/model-library/admission-policy.json` freezes the exact historical 710-package legacy inventory by count and SHA-256.
- New package identities cannot inherit legacy handling. They must be registered under `strict_evidence_contract_packages` or admission fails.
- Strict admission adds caller-authoritative `--require-evidence-contract` independently of candidate package contents.
- Linked VDMOS operating-point benches use an exact generated grammar with one physical title, one authoritative local model card, strict decimal `.temp` and source values, unique and fully consumed sources and MOSFETs, literal `0` ground, one `.op`, and one final `.end`.
- Control blocks, `altermod`, source loading, passive helpers, auxiliary model cards or topology, title-slot smuggling, the ngspice `gnd` alias, continuation syntax, and JavaScript-only numeric tokens fail closed.
- F2 residual completeness, fidelity-tier authority, fitted VTO polarity, content-addressed evidence identity, and finite direct-evidence bounds remain enforced.

No fit threshold, hard bound, evidence requirement, provenance rule, collision check, package check, or independent-review requirement was relaxed.

## Exact-commit validation

All commands ran against exact commit `1b686477432e58ac25293299570b2eb6a669352d`:

| Gate | Result |
| --- | --- |
| Model factory | PASS, 88/88 |
| Component schema | PASS, 43/43 |
| Model library policy and package tests | PASS, 7/7 including all 710 reviewed packages |
| Standalone policy-aware library validator | PASS, 710 registered packages |
| Conveyor | PASS, 16/16 |
| Python compilation | PASS |
| Workspace tests | PASS |
| Workspace typechecks | PASS |
| Workspace production build | PASS |
| Native ngspice versus pinned WASM | PASS, 6/6 |
| `git diff --check 4814648..1b68647` | PASS |

The production build retained only its existing non-blocking Vite chunk-size warning.

## Independent review

Two focused independent read-only reviewers returned `APPROVE` for:

1. reviewed-library admission authority, immutable legacy classification, exact inventory equality, symlink rejection, and policy-aware CI;
2. linked-bench grammar, runtime-mutation rejection, topology closure, decimal-token agreement, and ground-alias agreement.

A fresh cumulative independent read-only review then inspected `4814648..1b68647` and returned:

**APPROVE**

The reviewer found no remaining concrete correctness or data-integrity defect in the cumulative MOSFET evidence-admission correction.

Non-blocking notes were limited to fail-loud CLI hardening, pre-existing strict-mode scope boundaries for unlinked checks, duplicate literal cleanup, documentation drift, and fail-closed portability constraints. None can mis-certify a runnable candidate under the factory path.

## Verdict and barrier release

**APPROVE**

The integrated MOSFET evidence-admission code gate is satisfied. Under the standing authorization, the coordinator may now open only Batch 15's own preserved fresh evidence root to:

1. reverify all ten immutable job hashes;
2. reverify exactly eight unique completion-ledger keys and response hashes;
3. keep orders 980 and 988 parked;
4. run exactly one fit pass over the eight accepted extractions;
5. evaluate the fixed-denominator proving gate without retries or relaxed constraints.

Batch 15 PASS still requires at least 6 provenance-clean staged packages of 10 and at least 3 staged packages in `interval-constrained` mode. Failure stops the campaign. Batch 16 remains blocked until Batch 15 proving passes.

This approval authorizes no candidate promotion, reviewed-library mutation, deployment, launch post, or community publication.
