# ADR-0013: Separate Simulator V3 and Designer V4 circuit formats

- Status: Accepted for v0.2.0-rc.1
- Date: 2026-08-30
- Supersedes: the circuit-version assignment in ADR-0002 and circuit-version references in ADR-0005

## Context

Two feature branches independently assigned `opencircuit-circuit` version 2 to incompatible documents. The Simulator branch used V2 for a flat legacy editor document on its migration path to current V3. The Designer branch used V2 for a multi-circuit document containing design blocks and scenarios. A parser could not select between those contracts from the version alone without guessing from shape.

## Decision

- Preserve the Simulator compatibility chain: flat V1 and V2 documents migrate to current V3.
- Assign the Designer multi-circuit/scenario document version 4.
- Dispatch by explicit version and validate the expected shape. Reject a Designer shape marked V2 and a Simulator shape marked V4.
- Keep Designer V4 pin geometry explicit and separate from the Simulator V3 editor's KiCad-derived symbol geometry. UI geometry changes must not silently alter a hashed Designer topology.
- Regenerate every circuit-dependent result, constraint-decision, golden and release-audit pin atomically.

## Consequences

The release has an unambiguous persisted-format contract and retains the old Simulator migration path. Draft Designer V2 documents from unpublished branches must be regenerated as V4; they are not accepted through an ambiguous compatibility alias. Designer API packages may retain their own V2 request/result naming where that denotes the application protocol rather than the circuit-document version.

ADR-0002 and ADR-0005 remain as historical design context for the multi-circuit and Designer protocol decisions.
