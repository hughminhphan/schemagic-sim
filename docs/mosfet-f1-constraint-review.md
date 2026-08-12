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

## Remediation status

One bounded remediation and one independent re-review are authorized by `docs/scale-2k-campaign-authorization.md`. Candidate fitting remains blocked until the re-review records an approving verdict below.
