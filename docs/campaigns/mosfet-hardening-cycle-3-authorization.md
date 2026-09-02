# MOSFET hardening cycle 3 authorization

Date: 2026-08-13. Base: approved main plus preserved cycle 2 remediation.

Hugh explicitly authorized continuation after the terminal cycle 2 report by saying “yes go”. This opens one narrow cycle to fix the remaining content-addressed provenance defect. It does not reopen the blocked scheduler upgrade or authorize broader schema expansion.

## Scope

The only implementation objective is to make evidence-contract `1.0.0` package validation recompute and verify every claimed content-addressed identity from its canonical content before resolving references across facts, fitted metadata, expectations, and operating-region bounds.

The implementation must cover the dependency order without introducing a cryptographic cycle:

1. condition identity
2. citation identity
3. cohort identity
4. curve identity from ordered raw points
5. point and scalar evidence identities
6. operating-region bound identity

A mutation to canonical content with a stale claimed hash must fail validation. This includes at least citation locators, electrical conditions, test mode, qualifiers, evidence roles, curve axes and points, cohort membership, and supported-region bound content.

## Trust boundary

Luna remains the semantic datasheet extractor. Luna chooses and groups the evidence, resolves footnotes, and reports ambiguity. Deterministic code derives and verifies hashes, normalizes units, enforces published hard bounds, and runs native simulation.

No new evidence fields or representational duplication may be added unless required to recompute an already-declared identity. This cycle must not hard-code manufacturer-specific semantic interpretation.

## Preserved cycle 2 behavior

The cycle 2 bounded remediation remains required:

- exact inclusive F2 VGS(th) bounds
- no critical VTO held-default escape
- honest exclusion of pulse-only evidence from static DC claims
- versioned package-chain requirements with all 710 legacy packages backward-compatible
- compact evidence-linked supported operating regions
- unchanged F2 residual gates of 0.20 worst and 0.12 RMS

## Review gate

One implementation and one independent read-only adversarial review are authorized. A `BLOCK` stops this cycle. There is no in-cycle remediation allowance.

Review must mutate canonical package content while retaining stale hashes and verify fail-closed behavior, then rerun model-factory, component-schema, all 710 reviewed-package validation, workspace tests and typechecks, and native ngspice versus WASM parity.

## Candidate barrier

No reviewer or writer may open the ignored Batch 15 evidence root. Batch 15 fitting remains blocked until cycle 3 receives `APPROVE` and all integrated tests pass. Batch 16 remains prohibited until Batch 15 proving passes.

The extraction cap remains four. The scheduler cycle is closed and is not part of this authorization.
