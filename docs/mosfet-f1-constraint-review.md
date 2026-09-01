# MOSFET constrained-F1 code gate review

## Initial review

- Date: 2026-08-12
- Target commit: `6c03fd5260b697e71066504eb99021891e53f006`
- Code equivalence at current docs-only head `ec7a8b7`: confirmed
- Reviewer: independent GPT-5.6 Sol read-only gate lane
- Verdict: **BLOCK**

This verdict grants no candidate fitting, staging, promotion, publication, or deployment approval.

### Blocking finding 1: incomplete critical typical evidence fails open

`tools/model-factory/lib/bulk-adapter.mjs` recognizes MOSFET threshold and RDS(on) typical observations from values and units without requiring the complete evidence contract:

- threshold current and VDS relationship
- RDS(on) VGS and ID
- exact temperature
- datasheet citation
- compatible condition strings

An adversarial payload containing only `threshold_typ = 1.5 V` and `RDS(on)_typ = 0.08 ohm` was accepted as `typ-point` and produced `VTO=1.5`, `KP=25`.

Silent `250 µA` threshold-current fallbacks remain in `bulk-adapter.mjs` and `factory.mjs`. Critical operating conditions must be validated and propagated rather than defaulted.

### Blocking finding 2: incompatible bound conditions form hybrid constraints

Threshold endpoint validation can succeed when only one endpoint states the supported `VDS = VGS` relationship. An adversarial interval with its minimum at `VDS = 0 V` and maximum at `VDS = VGS` was accepted as `interval-constrained`.

RDS(on) construction does not prove that the extracted VGS and ID fields match the resistance field's cited conditions. An adversarial resistance cited at `VGS=4.5 V, ID=2 A` was accepted and probed at `VGS=10 V, ID=1 A` while retaining the original citation metadata.

These paths violate the exact-condition, condition-compatibility, and fail-before-optimization requirements in `docs/mosfet-f1-constraint-semantics.md`.

### Test evidence

| Command or probe | Result |
| --- | --- |
| `npm test --prefix tools/model-factory` | PASS, 61/61 |
| `npm test --workspace=@opencircuit/component-schema` | PASS, 4/4 |
| `npm test --workspace=@opencircuit/model-library` | PASS, all 710 reviewed packages |
| Incompatible threshold endpoint probe | BLOCK reproduced |
| Mismatched RDS(on) condition probe | BLOCK reproduced |
| Incomplete typical-point probe | BLOCK reproduced |

### Verified non-blocking behavior

- Inclusive threshold and RDS(on) comparisons
- Separate seeds, observations, and constraints
- Zero constrained-F1 residual targets
- Native ngspice final constraint verification
- Fail-closed empty feasible sets
- Exact cited `.temp` directives in native probes
- N-channel and P-channel handling
- Multiple independent RDS(on) maximum constraints
- Truthful tested seed displacement metadata
- Unchanged Batch 12 typical-point parameter vectors
- Unchanged F2 gates: worst `0.20`, RMS `0.12`
- All 710 reviewed packages remain schema-valid

## Remediation re-review

- Date: 2026-08-12
- Remediation commit: `46f64c395091ab48b35bb03b46e14dd6e1c613d6`
- Reviewer: independent GPT-5.6 Sol read-only gate lane
- Verdict: **BLOCK**

The remediation closed the originally demonstrated F1 exploits, preserved valid AO7400, FSS2301S, and NCE3401AY vectors, kept F2 gates at worst `0.20` and RMS `0.12`, and passed 68 model-factory tests, 4 component-schema tests, all 710 reviewed packages, 16 conveyor tests, and workspace tests and typechecks.

The independent re-review found remaining fail-open candidate paths:

1. `fit_conveyor.py` still admitted F2 RDS(on) typical and maximum evidence without requiring exact temperature, conditions, field citations, compatible page/table context, or one shared condition identity. Incomplete and hybrid points entered F2 residual observations and inequality constraints.
2. F2 threshold minimum, typical, and maximum values still influenced VTO seeds and optimization bounds without independently validated VDS relationship, ID, temperature, and citation.
3. F1 RDS(on) validation compared parsed VGS, ID, temperature, and citation context but did not reject incompatible additional qualifiers such as different pulse durations.
4. MOSFET operating-region metadata retained a silent `25 °C` fallback in a conveyor candidate path.

The second BLOCK exhausted the original one-remediation cycle authorized by `docs/scale-2k-campaign-authorization.md`. The blocked remediation was preserved on branch `batch-15-blocked-remediation`; approved main was restored to `6f526f8`. No reviewed package or production code was changed.

## Superseding integrated review under standing authorization

- Date: 2026-08-14
- Standing authorization: `docs/mosfet-hardening-standing-authorization.md`
- Cumulative correction range: `4814648..1b68647`
- Approval record: `docs/mosfet-hardening-cycle-4-review.md`
- Reviewer: fresh independent read-only cumulative gate lane, after separate policy and bench-grammar approvals
- Verdict: **APPROVE**

The later standing authorization permitted narrow consequence-driven correction cycles after the original bounded Batch 15 remediation stopped. Those cycles closed the complete F1 and F2 evidence identity, package-chain, residual, admission-lifecycle, and generated-bench mutation gaps without relaxing electrical, evidence, provenance, collision, or fit gates.

Exact-commit validation passed: model-factory 88/88, component-schema 43/43, model-library 7/7 including all 710 reviewed packages, standalone policy-aware library validation, conveyor 16/16 plus Python compilation, workspace tests/typechecks/build, native versus WASM 6/6, and `git diff --check`.

This superseding APPROVE satisfied the Batch 15 code barrier. It authorized only immutable-job and ledger reverification followed by the one already-authorized fit pass. It granted no package promotion, reviewed-library mutation, deployment, or publication approval.
