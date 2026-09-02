# MOSFET hardening cycle 2 review

Date: 2026-08-13

## Authorization and scope

`docs/campaigns/mosfet-hardening-cycle-2-authorization.md` authorized one integrated implementation, one bounded remediation, and one independent re-review before any Batch 15 fit. A second `BLOCK` stops the cycle and escalates without relaxing evidence, electrical, provenance, fit, collision, or package gates.

The cycle deliberately separates responsibilities:

- Luna performs semantic datasheet interpretation, including row and curve selection, footnote resolution, condition grouping, and ambiguity reporting.
- Deterministic code normalizes units, derives content-addressed identities, enforces published electrical bounds, runs ngspice, and preserves compact reproducible provenance.
- Representation requirements are justified only by a concrete wrong electrical claim or broken provenance outcome.

No reviewer or writer opened the preserved Batch 15 evidence root. No Batch 15 fit ran. Batch 16 remained untouched.

## Initial integrated review

- Integrated implementation: `3e0a5e7`
- Preserved branch: `mosfet-cycle2-blocked-integration`
- Verdict: **BLOCK**

The integrated tree passed its conventional suites, but two independent read-only reviews reproduced concrete end-to-end defects:

1. F2 could fit `VTO` above a complete published VGS(th) maximum. A synthetic canonical part with a published maximum of `2.5 V` was accepted at approximately `2.75 V` with a low residual.
2. Curated `IRLZ44N`, `IRFZ44N`, and `IRF3205` facts advertised evidence contract `1.0.0` but used an identity shape rejected by the real Python boundary. Their pulse-qualified evidence also had no equivalent pulse bench and was inadmissible for a static DC claim.
3. A contract package could pass public package validation without its central `facts.json` and `fitted.json` provenance artifacts.
4. Expectation projection collapsed distinct `pulsed` and `single_pulse` semantics.
5. Emitted supported-operating-region bounds discarded their evidence and derivation linkage while validation inspected a richer in-memory object instead of the emitted package.

These were consequence-bearing electrical or provenance failures, not additional datasheet-extraction work for Luna.

## Bounded remediation

- Remediation commit: `9d70043`
- Preserved branch: `mosfet-cycle2-bounded-remediation`

The bounded remediation used the narrower consequence-driven policy:

- Enforced the exact inclusive published VGS(th) interval in F2.
- Removed the critical VTO extrapolation exception.
- Added a deterministic curated-facts adapter and stopped pulse-only curated data from claiming the static DC evidence contract.
- Required facts and fitted artifacts only for versioned new-contract packages, preserving all 710 legacy packages.
- Failed unsupported pulse-qualified new-contract claims closed instead of creating an unused pulse subsystem.
- Preserved compact supported-region evidence references in emitted package data and re-read the emitted component for validation.

Author and integration validation passed:

- Model-factory: 85 tests passed.
- Component schema: 14 tests passed.
- Conveyor four-lane baseline: 16 tests passed and Python typecheck passed.
- All 710 reviewed packages validated unchanged.
- Workspace tests, typechecks, and build passed.
- Native ngspice versus WebAssembly parity passed for all six reference circuits.
- F2 gates remained `0.20` worst relative error and `0.12` RMS relative error.

## Independent re-review

- Target: `9d70043`
- Verdict: **BLOCK**

The reviewer reproduced one remaining provenance-integrity failure outside the repository:

1. A valid synthetic evidence-contract `1.0.0` MOSFET package passed validation.
2. The primary citation page in `facts.json` was changed from `2` to `99`.
3. Its claimed content-addressed `citation_id` and dependent `evidence_id` were left unchanged.
4. Package validation still returned no errors because it compared supplied IDs across documents but did not recompute those IDs from canonical content.

This allows cited source content to change while stale SHA-256 identities continue to make expectations, fitted evidence, and operating-region references appear linked. Recomputing a declared content-addressed identity is a compact deterministic integrity check, not a new semantic extraction requirement for Luna.

## Terminal decision

The authorized remediation and re-review allowance is exhausted. MOSFET hardening cycle 2 is **not approved**. The implementation and bounded remediation remain preserved on diagnostic branches, but neither is active on `main`.

Therefore:

- Batch 15 candidate fitting is not authorized.
- Batch 16 work is not authorized.
- The reviewed library remains 710.
- The four-lane extraction cap remains active.
- No fit, evidence, hard-bound, residual, collision, provenance, or package gate is relaxed.
- A further implementation cycle requires new explicit authorization.
