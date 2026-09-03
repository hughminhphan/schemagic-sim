# Documentation index

What lives in `docs/` after the campaign records moved to [`campaigns/`](campaigns/README.md) on 2026-09-02.

## Execution status (2026-09-04)

Wave 1 and nine Wave 2 PRs ([#26](https://github.com/hughminhphan/schemagic-sim/pull/26) through [#34](https://github.com/hughminhphan/schemagic-sim/pull/34)) are merged. The pre-launch integration in [PR #35](https://github.com/hughminhphan/schemagic-sim/pull/35) completes tasks 0.5, F.1 through F.4, and 1.1 through 1.3: Robonyx Simulator now has 19 built-in teaching circuits, the expanded switch/source/isolation/timing/protection families, and 771 reviewed manufacturer packages that are all placeable. Across Phase 0, 1, 2, and D, 28 tasks are done, 3 are partial, and 24 are open; the separate follow-up queue is 4/4 done. Tasks 2.5 and 2.17 remain partial because 470 campaign-cited PDFs remain absent but restorable, the 5.3 GB catalog has not moved externally, and noise replay is unsupported. D.2 also remains partial: the buck calculators are bound-aware, but loop stability remains unknown and the installed strict policy still returns no eligible buck candidate. Current task-level status is in [BACKLOG.md](BACKLOG.md).

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
