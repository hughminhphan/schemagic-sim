# MOSFET typed evidence-interface review

Date: 2026-08-14

## Scope and authority

Hugh's direction, "pull in a fable advisor to make a better plan then keep going", is recorded in `docs/batch-15-recovery-authorization.md`. It authorized one bounded typed evidence-interface correction, one independent review, and at most one remediation. A second `BLOCK` ends the recovery.

The correction was limited to:

- `tools/model-factory/lib/bulk-adapter.mjs`
- `tools/model-factory/python/fit_conveyor.py`
- directly related model-factory tests
- `docs/mosfet-f1-constraint-semantics.md`

No Batch 15 ignored artifact root was opened during the code phase. No extraction, fit, staging, package review, promotion, reviewed-library mutation, deployment, or publication occurred.

## Intended correction

The implementation added content-addressed condition-adjudication supplements that preserve the original extraction while carrying typed condition semantics for fitting. It separated typed temperature, source test mode, polarity, magnitude convention, and electrical coordinates from free-text disclosures. It kept temperature `not_stated` fail-closed, excluded pulsed evidence from static DC fitting, allowed source mode `not_stated` only under the fixed characteristic policy, and preserved source mode and provenance in canonical qualifiers independently checked by Python.

F2 error gates, inclusive published bounds, complete two-sided threshold requirements, citation and evidence identities, collision checks, package validation, and reviewed-library admission were not changed.

## First independent review

The initial independent read-only review returned:

**BLOCK**

It reproduced three concrete defects:

1. Raw extractions could embed syntactically valid `condition_semantics` without a validated supplement and still receive the `content_addressed` qualifier.
2. Supplement source binding trusted an extraction-declared digest rather than requiring agreement with the actual canonical datasheet bytes before direct fitting.
3. Signed curve coordinates were converted to magnitudes before the contradiction check, so typed `absolute` semantics could not reject signed source coordinates.

The review's focused suites passed 27 bulk-adapter tests and 23 fitter tests, but did not cover those adversarial paths.

## One bounded remediation

The single authorized remediation:

- introduced module-private trust markers populated only by `applyConditionAdjudicationSupplement`;
- rejected raw embedded semantics without validated supplement provenance;
- hashed the actual canonical datasheet file and required the extraction and supplement source digests to match it;
- detected signed curve coordinates before magnitude normalization;
- kept trusted adjudicated objects intact through fit and package-fact reconstruction;
- retained the immutable original extraction in package facts;
- added direct adversarial and end-to-end staging regression tests.

The post-remediation gate matrix passed:

| Gate | Result |
| --- | --- |
| Model factory | PASS, 99/99 |
| Conveyor | PASS, 16/16 |
| Conveyor Python compilation | PASS |
| Component schema | PASS, 43/43 |
| Model library | PASS, 7/7 including all 710 reviewed packages |
| Standalone library validator | PASS, 710 registered packages |
| Workspace tests | PASS |
| Workspace typechecks | PASS |
| Workspace production build | PASS |
| Native ngspice versus pinned WASM | PASS, 6/6 |
| `git diff --check` | PASS |
| Protected-file scope check | PASS, no fit-gate, package-schema, admission-policy, reviewed-library, CI, or UI file changed |

The production build retained only its existing non-blocking Vite chunk-size warning.

## Independent re-review

The same independent reviewer resumed its original transcript and performed the one permitted re-review. It returned:

**BLOCK**

The reviewer reproduced one remaining content-addressing failure:

- `applyConditionAdjudicationSupplement` validates hashes once, then returns a mutable extraction whose trusted status is represented only by object identity. Later consumers check the private trust marker but do not revalidate or freeze the targeted subtree and typed semantics. A caller can therefore mutate trusted scalar evidence, conditions, or attached semantics after validation while retaining the `content_addressed` qualifier. The reviewer changed a validated threshold interval from `0.5..1.5 V` to `0.05..0.15 V`; `fitBulkPart` accepted the altered values and emitted the altered inclusive constraint.

The reviewer confirmed that the three first-review defects and trusted fact reconstruction were otherwise fixed. Its focused suites passed 31/31 bulk-adapter tests and 23/23 fitter tests.

## Verdict and stop condition

**BLOCK**

This is the second independent code-review `BLOCK`. The bounded remediation allowance is consumed. Under `docs/batch-15-recovery-authorization.md`, the Batch 15R recovery stops immediately.

Consequences:

- The blocked typed evidence-interface implementation is not approved for candidate use.
- Batch 15's preserved ignored evidence root remains sealed and was not opened during this recovery.
- No semantic adjudication jobs or Luna calls may run.
- No Batch 15R fit pass may run.
- No package review, collision audit, promotion, reviewed-library mutation, Batch 16 execution, deployment, repository push, or publication is authorized by this recovery.
- The reviewed library remains 710 packages.

Further work requires a new direct user instruction that explicitly authorizes another correction cycle or a different campaign direction.
