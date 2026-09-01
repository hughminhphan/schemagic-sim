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

## Superseded process stop

The second review `BLOCK` initially triggered the one-remediation stop in `docs/batch-15-recovery-authorization.md`. The active branch recorded that stop before any Batch 15 evidence access, adjudication, fit, staging, or reviewed-library mutation.

Hugh then said, "why do you keep stoppig mate". Together with the standing direction to keep driving toward 1,000, this superseded the process-only remediation cap through `docs/batch-15-recovery-continuation.md`. Concrete review findings became inputs to further narrow correction rather than campaign stop commands. Every electrical, provenance, simulation, collision, package, independent-review, promotion, deployment, and publishing gate remained unchanged.

## Continued remediation

Three further adversarial review findings were corrected in sequence:

1. **Mutable trusted fit view.** The reviewer changed a validated threshold interval after supplement validation while retaining trusted object identity. The adapter now recursively freezes the complete repaired fit view, including scalar evidence, conditions, citations, points, and attached typed semantics, before assigning trusted status.
2. **Mutable retained package provenance.** The reviewer changed the separately retained original extraction after fitting, producing package facts that diverged from validated derived facts. The adapter now creates a separate recursively frozen original-extraction snapshot at validation time, binds it to the trusted fit view in a module-private `WeakMap`, always uses that snapshot for package facts, and rejects any separately supplied source extraction whose canonical content differs.
3. **Extraction-byte and object split.** The reviewer supplied exact bytes containing one threshold interval and a separate raw extraction object plus target hashes containing another. The adapter now requires a byte `Buffer`, parses the exact hashed bytes, and requires their canonical content to equal the supplied extraction object before source, target, polarity, snapshot, or fit validation.

Direct regression tests reproduce every mutation and mismatch. The valid manifest path still stages a strict package whose `facts.extraction` equals the untouched original extraction and contains no private `condition_semantics` attachment.

## Final independent re-review

The same independent reviewer resumed the complete review transcript after each correction. The final verdict was:

**APPROVE**

The reviewer confirmed:

- exact extraction bytes are parsed and canonically matched to the supplied extraction before any semantic or fit validation;
- extraction and supplement source hashes resolve to the actual canonical datasheet bytes;
- validated targets, attached semantics, and the repaired fit view are recursively frozen and trusted only through module-private collections;
- a separate frozen original-extraction snapshot is bound to the fit view and is authoritative for package facts;
- staging rejects divergent caller-supplied source extractions;
- signed curve coordinates are detected before magnitude normalization;
- JavaScript and Python enforce the same fixed source-mode policy, including pulse exclusion and rejection of `not_stated` RDS(on);
- no reviewed path weakens evidence, bounds, fitting, package validation, collision checks, or admission policy.

The reviewer's focused verification passed 33/33 bulk-adapter tests and 23/23 fitter tests.

## Final validation

| Gate | Result |
| --- | --- |
| Model factory | PASS, 101/101 |
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
| Protected-file scope check | PASS |

The production build retained only its existing non-blocking Vite chunk-size warning.

## Verdict and barrier release

**APPROVE**

The typed MOSFET evidence-interface code barrier is satisfied. The coordinator may now open only Batch 15's own preserved fresh evidence root, create content-addressed semantic adjudication supplements for the eight accepted extractions, and run exactly one Batch 15R fit pass under the unchanged fixed denominator and proving thresholds.

This approval authorizes no candidate promotion, reviewed-library mutation, deployment, repository push, launch post, or community publication. Those gates remain separate.
