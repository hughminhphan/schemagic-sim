# Batch 15 recovery authorization

Date: 2026-08-14

## User direction

After Batch 15 failed its original proving gate, Hugh directed: "pull in a fable advisor to make a better plan then keep going".

A Fable 5 advisor independently reviewed the tracked campaign records, approved evidence-admission implementation, and Batch 15's own preserved evidence. The advisor found that the zero-yield result was dominated by a deterministic interface inversion: Luna supplied electrically complete evidence plus honest disclosure prose, while deterministic code attempted to infer semantic condition identity from exact free-text phrases. The recovery therefore corrects the typed evidence interface without weakening any electrical or provenance gate.

This instruction supersedes only these prior stop clauses:

1. `STOP_CAMPAIGN_GATE_FAIL` and the no-remediation/no-candidate-execution flags in `docs/campaigns/batch-15-proving-execution.json`.
2. The proving-gate terminal in section 10 of `docs/campaigns/scale-2k-campaign-authorization.md`, contingent on the bounded recovery below.
3. The prior tracked-code-change limit, extended to one bounded typed evidence-interface correction cycle.

It does not supersede the frozen manifest, fixed proving thresholds, F2 residual gates, published hard bounds, evidence completeness, content-addressed provenance, collision checks, package checks, independent review, reviewed-library admission policy, artifact isolation, or publishing and deployment gates.

## Failure taxonomy

The original eight fit failures divide into three consequence classes:

1. **Exact-phrase test-mode ceremony.** Seven candidates were blocked because evidence or curve conditions did not contain a literal `dc`, `continuous`, or `pulse` phrase even when the datasheet did not state one and the electrical bias, temperature, current, and citation were otherwise complete.
2. **Disclosure-whitelist fragility.** Honest annotations such as a P-channel magnitude convention or a figure label were treated as unknown condition qualifiers. A signed positive temperature token such as `+25 degC` also failed the existing parser.
3. **Real semantic uncertainty.** A minority of candidates lacked an exact figure temperature or a complete two-sided threshold interval. These must still fail closed unless a semantic adjudication grounded in the canonical PDF resolves them.

Luna remains the authority for datasheet semantics, condition grouping, footnotes, magnitude conventions, and ambiguity disclosure. Deterministic code remains the authority for numeric units, citation identity, typed condition equality, published bounds, native simulation, collision checks, package validation, and content-addressed provenance.

## Authorized recovery

### Phase 1: typed evidence-interface correction

One bounded correction cycle may modify only:

- `tools/model-factory/lib/bulk-adapter.mjs`
- `tools/model-factory/python/fit_conveyor.py`
- directly related model-factory tests and synthetic fixtures
- `docs/mosfet-f1-constraint-semantics.md`

The correction must:

- separate typed condition fields from free-text disclosures;
- represent test mode explicitly as `dc`, `continuous`, `pulsed`, `single_pulse`, or `not_stated`;
- record `not_stated` rather than silently fabricating `dc`;
- admit `not_stated` only under a fixed characteristic policy;
- keep pulse-qualified evidence excluded from static DC residual observations unless an equivalent supported pulse path exists;
- represent temperature provenance explicitly and keep `not_stated` temperature fail-closed;
- represent P-channel magnitude convention as typed data rather than phrase matching;
- fix signed positive temperature parsing;
- keep value, unit, condition, citation, evidence-identity, bound, fit, collision, package, and reviewed-library gates unchanged.

The correction receives one independent code review and at most one bounded remediation. A second `BLOCK` stops the recovery.

### Phase 2: semantic adjudication supplements

After code approval only, the coordinator may run at most four Luna lanes over Batch 15's eight accepted extractions and their own canonical PDFs. Every prompt must begin: `Do not invoke any Skill at any point in this task.`

Each lane emits a new content-addressed supplement containing typed temperature provenance, test-mode status, magnitude convention, and disclosures. Original extractions and responses remain immutable. Every numeric value, unit, and citation in a supplement must equal the original hashed extraction exactly. Any drift fails that candidate closed.

At most one focused adjudication retry per target is allowed. Immutable adjudication jobs and an append-only adjudication ledger are required.

### Phase 3: Batch 15R proving

After supplement integrity checks, reverify all ten original job hashes, exactly eight original completion-ledger keys, all eight response hashes, and the new adjudication records. Orders 980 and 988 remain parked.

Exactly one new fit pass is authorized. The denominator remains ten. PASS still requires:

- at least 6 provenance-clean staged packages;
- at least 3 staged packages in `interval-constrained` mode.

No fit or gate retry is allowed.

## Outcomes

If Batch 15R passes, candidates receive independent package review, collision audit, deterministic promotion, and final Fable release audit before any reviewed-library mutation or repository push. Batch 16 may then begin at order 990 on a fresh `tools/conveyor/data/batch-16-scale/` root verified absent by name.

If Batch 15R fails, the campaign stops again. Orders 980 through 989 retire, no third fit pass is authorized, and only a new direct user instruction may redirect the campaign.

## Isolation and stop conditions

No content access is allowed under Batch 10 through 14 roots, `.claude/`, `tools/conveyor/data.pre-hardening/`, or `tools/conveyor/data/batch-16-prefit/`. The pre-existing `batch-16-prefit` root remains preserved and unused.

Stop immediately for:

- any prohibited-root content access;
- any value, unit, or citation drift between an adjudication supplement and its original extraction;
- any change to fit thresholds, hard bounds, collision rules, package rules, admission policy, or reviewed-library contents during the interface correction;
- a second independent code-review `BLOCK`;
- any required test, parity, or 710-package validation failure;
- Batch 15R proving-gate failure.

This authorization grants no deployment, package promotion, reviewed-library mutation, launch post, or community publication approval.
