# Conveyor scheduler cycle 2 review

Date: 2026-08-13

## Authorization

The scheduler upgrade was authorized by `docs/campaigns/mosfet-hardening-cycle-2-authorization.md` with one implementation, one bounded remediation, and one independent re-review. Concurrency above four remained disabled until approval.

## Initial implementation

- Commit: `8550163`
- Verdict: **BLOCK**
- Preserved branch: `scheduler-blocked-8550163`
- Reverted from the integration branch by `2c5eead`

The first independent failure-injection review found that the coordinator was not wired into the real CLI path, legacy ingestion bypassed reservations and publication controls, zero-byte destination claiming was not crash safe, leases had no heartbeat, stale attempts could publish before ownership rejection, emitted job hashes did not round-trip, retry results could disagree with persisted state, and producer overlap was not implemented.

## Bounded remediation and re-review

- Remediation commit: `bcb0c1b`
- Author validation: 40 conveyor tests and Python typecheck passed
- Independent re-review verdict: **BLOCK**
- Preserved branch: `scheduler-second-block-bcb0c1b`
- Reverted from the integration branch by `210cd28`

The re-review found four remaining blockers:

1. The `extract` command copied an already-existing response file. It did not dispatch Luna extraction or incrementally overlap PDF acquisition, topology preflight, extraction, and ingestion.
2. A worker stopped its lease heartbeat before placing completion onto the bounded queue. Under queue or publication delay, the lease could expire and the same target could be reserved again while its original completion was pending.
3. A supplied immutable `job_hash` was excluded and silently recomputed instead of being checked for exact equality. A modified immutable field paired with a stale supplied hash therefore did not hard-stop registration.
4. CLI exit status was derived from intermediate retry events. A job could persist terminal `completed` state but still return a retry exit code.

The reviewer reproduced the heartbeat duplicate-attempt condition and the supplied-hash mismatch with additional read-only failure injection. Existing author tests remained green but did not cover those counterexamples.

## Terminal decision

The authorized remediation and re-review allowance is exhausted. The eight-lane scheduler upgrade is **not approved** and is removed from the integration branch. The production extraction cap remains four. No scheduler code from either blocked implementation may be activated without a new explicit authorization cycle.

This decision does not relax or alter any MOSFET evidence, fit, provenance, collision, package, or review gate. Candidate fitting remains separately blocked pending approval of the integrated MOSFET evidence-admission implementation.
