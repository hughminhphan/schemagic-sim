# Documentation index

What lives in `docs/` after the campaign records moved to [`campaigns/`](campaigns/README.md) on 2026-09-02.

## Execution status (2026-09-03)

Wave 1 and nine Wave 2 PRs ([#26](https://github.com/hughminhphan/schemagic-sim/pull/26) through [#34](https://github.com/hughminhphan/schemagic-sim/pull/34)) are merged. Robonyx Simulator now includes twelve teaching circuits, compact backward-compatible share URLs, read-only embed mode, group clipboard editing, and a Falstad/CircuitJS share importer with explicit unsupported-element reports. The model tools now include real JFET fitting, an honest small-signal MOSFET F2-DC path, guarded storage pruning and restoration, and bounded fresh bench replay. The buck-calculator slice of D.2 is merged, but the current buck observation remains strictly ineligible; storage task 2.5 is also partial because the 5.3 GB catalog has not moved to an external location. Current task-level status is in [BACKLOG.md](BACKLOG.md).

## Plans and queues

| File | What it is |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Public feature roadmap. Phases and themes, not task-level. |
| [BACKLOG.md](BACKLOG.md) | The agent task queue. Every task carries Goal, Lane, Files owned, Verify, Out of scope and Done when. Start here to pick up work. |
| [MPN-TARGETS.md](MPN-TARGETS.md) | The manufacturer part numbers the model library is aiming at. |

## Contracts and architecture

| File | What it is |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the packages fit together: schema, engine, editor, designer. |
| [CONTRACTS.md](CONTRACTS.md) | The model package contribution contract and the evidence rules a package must satisfy. |
| [LICENSING.md](LICENSING.md) | Licence position for the code, the models and the third-party sources. |
| [adr/](adr/) | Architecture decision records. |
| [model-archetypes/](model-archetypes/) | Per-family model archetypes (diode, BJT, MOSFET, sensor and friends) that fitters target. |

## Designer

| File | What it is |
| --- | --- |
| [WEBENCH_DESIGNER_REFERENCE.md](WEBENCH_DESIGNER_REFERENCE.md) | The parity reference the Designer is measured against. |
| [DESIGNER_V1_HANDOFF.md](DESIGNER_V1_HANDOFF.md) | v1 handoff notes for the Designer surface. |
| [designer-v1-data-manifest.json](designer-v1-data-manifest.json) | The data manifest the v1 Designer ships against. |
| [design-critique.md](design-critique.md) | Recorded design critique of the Designer surface. |

## Model review, still current

These are the reviews whose findings still govern how MOSFET evidence is admitted, so they stayed out of `campaigns/`.

| File | What it is |
| --- | --- |
| [mosfet-f1-constraint-semantics.md](mosfet-f1-constraint-semantics.md) | The F1 constraint semantics the fitters implement. |
| [mosfet-f1-constraint-review.md](mosfet-f1-constraint-review.md) | The review that fixed those semantics. |
| [mosfet-evidence-interface-review.md](mosfet-evidence-interface-review.md) | The typed evidence-interface review. |
| [gold-review.md](gold-review.md) | The gold reference review used as the reviewer's worked example. |

## Releases

| Path | What it is |
| --- | --- |
| [releases/](releases/) | Per-release records, including the published `v0.2.0-rc.1` evidence. |

## History

| Path | What it is |
| --- | --- |
| [campaigns/](campaigns/README.md) | 104 immutable conveyor campaign records: selections, executions, review logs, authorizations and promotion manifests, P4 through Batch 23. Indexed by date, batch and outcome. |

## Related, outside `docs/`

- [../README.md](../README.md) is the project front door.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) covers how to propose a change.
- [../CHANGELOG.md](../CHANGELOG.md) is the release history.
- [../.github/workflows/ci.yml](../.github/workflows/ci.yml) documents the four required status checks.
