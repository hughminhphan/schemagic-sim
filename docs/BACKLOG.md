# Agent backlog

The task queue. Every entry is sized so one agent can implement and self-verify it on one branch without waiting on a human, except where the entry says a human decision is required.

Source: the 2026-09-02 audit and roadmap (Phase 0, Phase 1, Phase 2, Phase D). The public feature roadmap is [ROADMAP.md](ROADMAP.md); this file is the queue that implements it.

## How to take a task

1. Pick a task labelled `agent-ready` that is not marked in progress.
2. Branch from `main`. One task, one branch, one PR.
3. Write only the paths under **Files owned**. If a change appears to need a file outside them, stop and say so in the PR instead of widening the diff.
4. Run the task's **Verify** command. It must pass locally before the PR opens.
5. Open the PR with the task id in the title.

## The task contract

Every task below has exactly these six fields.

| Field | Meaning |
| --- | --- |
| **Goal** | One sentence describing an observable end state. Not a plan. |
| **Lane** | A Simulator core, B Designer, C model content and tools, D docs, CI, hygiene. |
| **Files owned** | The path globs this task may write. Nothing else. |
| **Verify** | The exact command that proves the task is done. |
| **Out of scope** | The frozen contracts and shared files this task must not touch. |
| **Done when** | The acceptance test, on top of the standing definition below. |

**Standing definition of done**, implied by every task: `npm run verify` passes, CI is green on all four required checks, no file outside **Files owned** is changed, and no commit carries an AI attribution trailer.

`npm run verify` runs, in order and failing fast: typecheck, workspace tests, model-library validation, build. It requires a native ngspice binary. Set `NGSPICE_BIN`, or install one at `/opt/homebrew/bin/ngspice` (`brew install ngspice`, or `sudo apt-get install -y ngspice`). There is no skip path.

## Lanes and ownership

Two agents are never writers on the same file. The lane map is enforced socially here and recorded machine-readably in [../.github/CODEOWNERS](../.github/CODEOWNERS).

| Lane | Owns | Paths |
| --- | --- | --- |
| **A** Simulator core | The schematic editor, circuit schema, simulation engine, waveform and signal surfaces, examples | `packages/circuit-schema/**`, `packages/schematic-editor/**`, `packages/sim-engine/**`, `packages/waveform-viewer/**`, `packages/signal-workbench/**`, `packages/model-import/**`, `apps/web/src/**` (simulator surface), `examples/**` |
| **B** Designer | Every design and sourcing package and the Designer web feature | `packages/design-*/**`, `packages/designer-*/**`, `packages/motor-designer/**`, `packages/power-designer/**`, `packages/sourcing-*/**`, `apps/web/src/features/designer/**`, `apps/web/designer-runtime-contract.json` |
| **C** Model content and tools | The model library, the component schema, the conveyor, factory and feeder | `packages/model-library/**`, `packages/component-schema/**`, `tools/**`, `spikes/**`, `docs/model-archetypes/**` |
| **D** Docs, CI, hygiene | Documentation, workflows, scripts, root configuration | `docs/**`, `.github/**`, `scripts/**`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `package.json`, `tsconfig.base.json` |

**Single-owner shared files.** These have no lane. Exactly one task at a time may edit each, and that task must name it in **Files owned**: `packages/circuit-schema/**`, `apps/web/src/main.ts`, `apps/web/src/entry.ts`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`.

## Frozen contracts

Never edited by an agent without an explicit human instruction, and never edited as a side effect of another task. If a task appears to require one of these, the task is wrong: stop and report it.

1. **PARTS pin geometry** and the copper-bound placement it implies.
2. **The editor DOM contract**: element ids, `data-testid` attributes and the `data-*` state attributes the browser suites assert against.
3. **The simulation worker protocol**: the message shapes between the app and the ngspice worker.
4. **Package schemas**: the component and model package schemas, and the evidence contract version.
5. **`dist/ngspice.wasm`** and its loader.
6. **Catalog release hashes**, currently release `2026-08-27.2`.
7. **V2 design-schema types** and their canonical hashes.
8. **Golden fixtures**: the recorded native and WASM golden artifacts and the designer golden fixtures.

## Labels

| Label | Meaning |
| --- | --- |
| `agent-ready` | Fully specified. An agent can start without asking a question. |
| `needs-human` | Blocked on a decision, a copy approval, an admin click or a signature. |
| `size:S` | Under a day of agent time. |
| `size:M` | A few days. |
| `size:L` | A week or more. |
| `lane:A` `lane:B` `lane:C` `lane:D` | The owning lane. |

## In flight

These tasks already have a branch. Do not start a second branch for them.

| Branch | Tasks |
| --- | --- |
| `roadmap/rename` | 0.6 |
| `roadmap/sim-parts` | 0.1 |
| `roadmap/sim-ux` | 0.2, 0.3, 0.4, 0.5 |
| `roadmap/ci-hygiene` | 0.7, 0.9, 0.10 |
| `roadmap/designer-depin` | D.0 |
| `roadmap/conveyor` | 2.1 |
| `roadmap/factory` | 2.2, 2.4 (mapping inferred from the branch name; confirm before starting either) |

---

# Phase 0: Launch window

Target 2026-09-15. Everything here is small. Tasks 0.1 through 0.8 gate the launch sequence.

### 0.1 Map the six orphan symbol families — IN PROGRESS (`roadmap/sim-parts`)

- **Goal** The timer, `logic_74hc`, `vreg_linear`, comparator, `jfet_n` and optocoupler families each resolve to a schematic symbol with a complete pin bijection, so 43 reviewed parts including NE555, the 74HC gates, LM317, LM393 and 4N35 become placeable.
- **Lane** A
- **Files owned** `packages/schematic-editor/**`, `packages/circuit-schema/src/symbols/**`, `apps/web/src/catalog.ts`, `apps/web/src/catalog-netlist.ts`
- **Verify** `npm run verify && npm run test:e2e --workspace=@opencircuit/web -- --project=chromium`
- **Out of scope** PARTS pin geometry, the editor DOM contract, model package contents under `packages/model-library/models/**`, the component schema.
- **Done when** Every one of the 43 parts places on the canvas, its pins map one-to-one to the model's port order, and a placement test covers one part per family.
- **Labels** `agent-ready` `size:M` `lane:A`

### 0.2 One coach mark instead of the welcome modal

- **Goal** First-time visitors see a single non-blocking coach mark on the potentiometer instead of the eight-step welcome modal, and reach a live circuit without dismissing anything.
- **Lane** A
- **Files owned** `apps/web/src/onboarding.ts`, `apps/web/src/style.css`, `apps/web/e2e/onboarding.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/onboarding.spec.ts --project=chromium`
- **Out of scope** The editor DOM contract, the persisted onboarding storage key `schemagic.onboarding.v1.completed` (the browser suites seed it), `apps/web/src/main.ts`.
- **Done when** The modal is gone, the coach mark dismisses on first interaction and never returns, and the onboarding spec asserts the new behaviour.
- **Labels** `needs-human` (copy) `size:S` `lane:A`

### 0.3 Catalog search relevance and filter chips

- **Goal** Catalog search ranks exact MPN first, then prefix, then substring, and offers filter chips for placeable, fidelity tier and supported analyses.
- **Lane** A
- **Files owned** `apps/web/src/catalog.ts`, `apps/web/src/catalog.test.ts`, `apps/web/src/style.css`, `apps/web/e2e/simulator-surface.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/simulator-surface.spec.ts --project=chromium`
- **Out of scope** The catalog release hashes, model package contents, the editor DOM contract.
- **Done when** A unit test pins the three-tier ranking on a fixture, and each chip demonstrably narrows the result set in the browser suite.
- **Labels** `agent-ready` `size:M` `lane:A`

### 0.4 Default scope trace shows something interesting

- **Goal** The default scope trace is named by net or label rather than by index, and the shipped default circuit opens showing the LED current.
- **Lane** A
- **Files owned** `apps/web/src/scope.ts`, `apps/web/src/demo.ts`, `apps/web/src/demo.test.ts`, `packages/waveform-viewer/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/vertical-slice.spec.ts --project=chromium`
- **Out of scope** The worker protocol, the editor DOM contract, `apps/web/src/main.ts`.
- **Done when** The default trace label reads as a net or label name in the browser suite, and the first frame after engine-ready shows a non-zero LED current.
- **Labels** `agent-ready` `size:S` `lane:A`

### 0.5 Honest Designer empty state

- **Goal** `/designer` stays live but its empty state is one honest line about strict results being in progress, with the inspection path one click away.
- **Lane** B
- **Files owned** `apps/web/src/features/designer/**`, `apps/web/e2e/designer.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/designer.spec.ts --project=chromium`
- **Out of scope** V2 design-schema types and canonical hashes, the golden fixtures, `apps/web/designer-runtime-contract.json`.
- **Done when** The empty state renders the approved single line plus one inspection link, and the designer spec asserts both.
- **Labels** `needs-human` (copy) `size:S` `lane:B`

### 0.6 README rewrite and rename cleanup — IN PROGRESS (`roadmap/rename`)

- **Goal** The README leads with the product claim in plain language, hashes move into `docs/`, `ORCHESTRATION.md` is untracked, and no `opencircuit` naming leak remains in public documentation.
- **Lane** D
- **Files owned** `README.md`, `docs/**`, `ORCHESTRATION.md`, `.gitignore`, `launch/**`
- **Verify** `npm run verify && node scripts/check-doc-links.mjs`
- **Out of scope** Package names in `package.json` files, import specifiers, the catalog release hashes, anything under `packages/**` or `tools/**`.
- **Done when** `git grep -in opencircuit -- README.md docs CONTRIBUTING.md` returns only deliberate historical references, `ORCHESTRATION.md` is untracked, and the link checker passes.
- **Labels** `needs-human` (copy) `size:S` `lane:D`

### 0.7 Root verify command and CI modernisation — IN PROGRESS (`roadmap/ci-hygiene`)

- **Goal** `npm run verify` runs typecheck, tests, model-library validation and build in that order and fails fast, native ngspice is a documented hard prerequisite, browser specs retry twice on CI, and the wall-clock and heap budget suites run in a scheduled non-blocking workflow.
- **Lane** D
- **Files owned** `package.json`, `.github/workflows/**`, `apps/web/playwright*.config.ts`, `scripts/**`, `packages/component-schema/lib.mjs` (ngspice resolution only)
- **Verify** `npm run verify`
- **Out of scope** Test assertions, the designer runtime contract budgets, package schemas, anything under `packages/model-library/**`.
- **Done when** The four required check names are unchanged, no budget suite runs on `pull_request`, and a missing ngspice binary fails with one message naming `NGSPICE_BIN` and the brew formula.
- **Labels** `agent-ready` `size:S` `lane:D`

### 0.8 Protect main and require the four checks

- **Goal** `main` is protected, requires a pull request, and requires exactly the four CI check names documented at the top of `.github/workflows/ci.yml`.
- **Lane** D
- **Files owned** `.github/**`, `docs/**`
- **Verify** `gh api repos/hughminhphan/schemagic-sim/branches/main/protection --jq '.required_status_checks.contexts'`
- **Out of scope** Everything else. This is a settings change with a documentation change, not a code change.
- **Done when** The four contexts are listed, a direct push to `main` is rejected, and the protection settings are written down in `CONTRIBUTING.md`.
- **Labels** `needs-human` (admin) `size:S` `lane:D`

### 0.9 Agent backlog and labels — IN PROGRESS (`roadmap/ci-hygiene`)

- **Goal** `docs/BACKLOG.md` holds every Phase 0, 1, 2 and D task in the six-field contract, with a lane map, the frozen-contract list, and the nine labels created in GitHub.
- **Lane** D
- **Files owned** `docs/BACKLOG.md`, `docs/README.md`, `.github/**`
- **Verify** `gh label list --limit 100 && node scripts/check-doc-links.mjs`
- **Out of scope** `docs/ROADMAP.md` content, any code path.
- **Done when** All nine labels exist, every task has all six fields, and no task's **Files owned** overlaps another lane's paths.
- **Labels** `agent-ready` `size:M` `lane:D`

### 0.10 Move campaign logs and index them — IN PROGRESS (`roadmap/ci-hygiene`)

- **Goal** The 88 batch records plus the scale-2k, MOSFET hardening, scheduler, P4 to P6 review logs and promotion manifests live under `docs/campaigns/` with a one-line-per-file index, and `docs/` indexes what remains.
- **Lane** D
- **Files owned** `docs/campaigns/**`, `docs/README.md`, `.github/CODEOWNERS`, `scripts/**`
- **Verify** `node scripts/check-doc-links.mjs`
- **Out of scope** The content of any moved record. These are immutable historical evidence: paths may be repointed after a move, findings may not be edited.
- **Done when** `docs/` lists no `batch-*` file, every moved file is in the index with a date, batch and outcome, and the link checker reports no unresolved reference inside `docs/campaigns/`.
- **Labels** `agent-ready` `size:S` `lane:D`

### 0.11 Multisim Live alternative section

- **Goal** A "Multisim Live alternative" section states what carries over, what does not, and the Chromebook result.
- **Lane** D
- **Files owned** `README.md`, `docs/**`
- **Verify** `node scripts/check-doc-links.mjs`
- **Out of scope** Any code path, any claim not verified against the running application.
- **Done when** Each carry-over and each gap is a checked claim, not a marketing line, and the Chromebook note records an actual test.
- **Labels** `needs-human` (copy) `size:S` `lane:D`

### 0.12 Twelve classic teaching circuits as share URLs

- **Goal** Twelve teaching circuits (RC filter, voltage divider, 555 astable, H-bridge, common-emitter amp, inverting and non-inverting op-amp, half and full-wave rectifier, zener regulator, LED current limit, RLC resonance) open from share URLs and solve.
- **Lane** A
- **Files owned** `examples/**`, `apps/web/src/examples.ts`, `apps/web/src/examples.test.ts`, `apps/web/e2e/p6-examples-catalog.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/p6-examples-catalog.spec.ts --project=chromium`
- **Out of scope** The share URL encoding format (task 1.9 owns it), PARTS pin geometry, model package contents.
- **Done when** Each of the twelve opens from its share URL, reaches engine-ready and produces a non-trivial trace, asserted in the catalog spec.
- **Labels** `agent-ready` (list needs Hugh's sign-off) `size:M` `lane:A`

---

# Phase 1: Lovable Simulator

September to October. Lane A unless stated.

### 1.1 Switch family

- **Goal** SPDT, DPDT, pushbutton, toggle and voltage-controlled switches place, wire and solve.
- **Lane** A
- **Files owned** `packages/circuit-schema/src/elements/**`, `packages/schematic-editor/**`, `packages/sim-engine/src/netlist/**`, `apps/web/e2e/editor.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/editor.spec.ts --project=chromium`
- **Out of scope** The worker protocol, PARTS pin geometry, the editor DOM contract, existing golden netlist fixtures.
- **Done when** Each switch type has a netlist unit test and one browser placement test, and toggling one changes the solved result.
- **Labels** `agent-ready` `size:S` `lane:A`

### 1.2 Dependent and behavioural sources

- **Goal** E, G, F and H dependent sources and the B behavioural source place and emit correct ngspice cards.
- **Lane** A
- **Files owned** `packages/circuit-schema/src/elements/**`, `packages/sim-engine/src/netlist/**`, `packages/schematic-editor/**`
- **Verify** `npm run verify`
- **Out of scope** The worker protocol, the ngspice WASM binary and loader, golden fixtures.
- **Done when** Each source type has a netlist unit test, and one circuit per type is verified against native ngspice.
- **Labels** `agent-ready` `size:S` `lane:A`

### 1.3 Transformer, crystal, transmission line, zener, battery, fuse, current pulse

- **Goal** Coupled inductors, crystal, transmission line, the zener symbol, battery, fuse and the current pulse source are placeable and solve.
- **Lane** A
- **Files owned** `packages/circuit-schema/src/elements/**`, `packages/schematic-editor/**`, `packages/sim-engine/src/netlist/**`
- **Verify** `npm run verify`
- **Out of scope** The worker protocol, PARTS pin geometry, model package contents. The current pulse source already exists in the schema: extend it, do not redefine it.
- **Done when** Each element has a netlist test and a solved example, and coupled inductors reproduce a native ngspice transformer result.
- **Labels** `agent-ready` `size:M` `lane:A`

### 1.4 `.step` parametric sweep

- **Goal** A `.step` sweep over a component value plots as a trace family and matches native ngspice.
- **Lane** A
- **Files owned** `packages/sim-engine/**`, `packages/waveform-viewer/**`, `apps/web/src/scope.ts`, `tools/native-ngspice-reference/test/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/sim-engine -- vitest run`
- **Out of scope** The worker protocol message shapes, the ngspice WASM binary, existing golden artifacts.
- **Done when** A stepped sweep renders one trace per step and the values agree with the native reference inside the recorded tolerance.
- **Labels** `agent-ready` `size:L` `lane:A`

### 1.5 Embed mode

- **Goal** `?embed=1` renders a read-only iframe-safe view with an "open in Robonyx" link.
- **Lane** A
- **Files owned** `apps/web/src/share.ts`, `apps/web/src/entry.ts`, `apps/web/src/style.css`, `apps/web/e2e/vertical-slice.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/vertical-slice.spec.ts --project=chromium`
- **Out of scope** The share URL encoding format (task 1.9), the editor DOM contract.
- **Done when** An embedded page solves, refuses edits, exposes the open link, and is asserted in the browser suite.
- **Labels** `agent-ready` `size:M` `lane:A`

### 1.6 Falstad and CircuitJS URL importer

- **Goal** A Falstad or CircuitJS share URL imports into an equivalent circuit, with round-trip tests.
- **Lane** A
- **Files owned** `packages/model-import/**`, `apps/web/src/model-import.ts`, `apps/web/src/model-import.test.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/model-import -- vitest run`
- **Out of scope** `packages/circuit-schema` element definitions, PARTS pin geometry.
- **Done when** A fixture set of Falstad URLs imports, round-trips and solves, with unsupported elements reported rather than silently dropped.
- **Labels** `agent-ready` `size:M` `lane:A`

### 1.7 Mobile canvas and layout

- **Goal** The canvas sets `touch-action: none`, supports pinch zoom and two-finger pan, and the analysis tabs and scope reflow on a phone viewport.
- **Lane** A
- **Files owned** `packages/schematic-editor/**`, `apps/web/src/style.css`, `apps/web/e2e/editor.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/editor.spec.ts --project=chromium`
- **Out of scope** The editor DOM contract, desktop layout regressions.
- **Done when** A mobile-viewport browser test places a component, pinch-zooms and pans, and the desktop suite is unchanged.
- **Labels** `needs-human` (layout) `size:M` `lane:A`

### 1.8 Copy, paste, duplicate and multi-select move

- **Goal** Multi-select, copy, paste and duplicate move components together with their wires.
- **Lane** A
- **Files owned** `packages/schematic-editor/**`, `apps/web/e2e/kicad-parity-interactions.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/kicad-parity-interactions.spec.ts --project=chromium`
- **Out of scope** The editor DOM contract, the circuit schema element definitions, PARTS pin geometry.
- **Done when** A selection of three connected components copies, pastes and moves with wires intact, asserted in the parity spec.
- **Labels** `agent-ready` `size:M` `lane:A`

### 1.9 Share URL compaction

- **Goal** Share URLs binary-encode and compress so a circuit with imported models stays inside platform URL limits.
- **Lane** A
- **Files owned** `apps/web/src/share.ts`, `apps/web/src/share.test.ts`, `apps/web/src/persistence.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- vitest run src/share.test.ts`
- **Out of scope** The circuit schema itself. Existing share URLs must keep opening: the old format stays readable.
- **Done when** A property test round-trips every fixture circuit, the largest fixture fits inside the limit, and every previously recorded share URL still opens.
- **Labels** `agent-ready` `size:S` `lane:A`

### 1.10 Break the circuit-schema and model-import cycle

- **Goal** `circuit-schema` no longer depends on `model-import`, and the dense core files are Prettier-formatted with determinism tests as the safety net.
- **Lane** A
- **Files owned** `packages/circuit-schema/**`, `packages/model-import/**`, `.prettierrc`, `package.json`
- **Verify** `npm run verify`
- **Out of scope** Any behaviour change. This is a structural and formatting task: the golden fixtures and solved results must be byte-identical before and after.
- **Done when** The dependency graph is acyclic, the formatter runs clean, and every golden artifact is unchanged.
- **Labels** `agent-ready` `size:M` `lane:A`

### 1.11 Coverage floor on schematic-editor and circuit-schema

- **Goal** `schematic-editor` and `circuit-schema` have a measured coverage floor enforced in CI, so concurrent agent edits cannot silently delete behaviour.
- **Lane** A
- **Files owned** `packages/schematic-editor/**`, `packages/circuit-schema/**`, `vitest.config.*`, `.github/workflows/ci.yml`
- **Verify** `npm run verify`
- **Out of scope** The four required check names, the editor DOM contract, unrelated packages.
- **Done when** Coverage is reported for both packages, a floor is enforced, and lowering the floor requires editing the config in the same PR.
- **Labels** `agent-ready` `size:M` `lane:A`

### 1.12 Designer to Simulator handoff

- **Goal** A selected Designer candidate opens in the Simulator carrying its receipt and model cards.
- **Lane** B
- **Files owned** `apps/web/src/features/designer/**`, `packages/design-export/**`, `apps/web/e2e/designer-simulation.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/designer-simulation.spec.ts --project=chromium`
- **Out of scope** V2 design-schema types and canonical hashes, the worker protocol, `apps/web/src/main.ts`.
- **Done when** The handoff carries the receipt intact, the Simulator solves the handed-off circuit, and the browser suite asserts both.
- **Labels** `agent-ready` `size:M` `lane:B`

### 1.13 Privacy-respecting usage counter

- **Goal** Cookie-free analytics report share URLs created, examples opened and the engine-ready rate.
- **Lane** D
- **Files owned** `apps/web/index.html`, `apps/web/src/entry.ts`, `docs/**`
- **Verify** `npm run verify && npm run audit:static-offline --workspace=@opencircuit/web`
- **Out of scope** Any cookie, any personal identifier, any third-party script outside the documented analytics endpoint. The offline build must stay offline.
- **Done when** The three counters report, the static offline audit still passes, and what is collected is documented.
- **Labels** `agent-ready` `size:S` `lane:D`

### 1.14 Transient with live animation

- **Goal** A solved transient replays through the living schematic as animated node voltages and branch currents.
- **Lane** A
- **Files owned** `packages/schematic-editor/**`, `packages/waveform-viewer/**`, `apps/web/src/scope.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/vertical-slice.spec.ts --project=chromium`
- **Out of scope** The worker protocol, the editor DOM contract, the solver itself. Replay reads the solved result; it never re-solves per frame.
- **Done when** A transient replays at a stable frame rate on the reference circuit and the animation is driven by the solved dataset.
- **Labels** `agent-ready` `size:L` `lane:A`

---

# Phase 2: Library engine v2

The nightly token sink. Lane C throughout. Order matters: 2.1 through 2.6 are prerequisites and nothing scales before them.

### 2.1 Real conveyor `extract` command — IN PROGRESS (`roadmap/conveyor`)

- **Goal** `conveyor extract` dispatches work to the existing batch runner, closing the missing dispatcher.
- **Lane** C
- **Files owned** `tools/conveyor/**`
- **Verify** `npm run verify && npm test --prefix tools/conveyor && npm run typecheck --prefix tools/conveyor`
- **Out of scope** `tools/*/data` (never read by a product lane, never committed), package schemas, the evidence contract version, the model library.
- **Done when** The command runs a batch end to end against a fixture, and the state machine transitions are covered by tests.
- **Labels** `agent-ready` `size:M` `lane:C`

### 2.2 Persistent ngspice process — IN PROGRESS (`roadmap/factory`, mapping unconfirmed)

- **Goal** Residual evaluation uses a persistent ngspice process or batched decks instead of one subprocess per residual, under a declared evaluation cap.
- **Lane** C
- **Files owned** `tools/model-factory/**`, `tools/native-ngspice-reference/lib/**`
- **Verify** `npm run verify && npm test --prefix tools/model-factory`
- **Out of scope** Fitted numerical results. The fitter must produce identical output before and after; this is a throughput change only.
- **Done when** A fixture fit produces byte-identical results at materially lower wall-clock cost, and the evaluation cap is enforced and logged.
- **Labels** `agent-ready` `size:M` `lane:C`

### 2.3 Lease and cost columns on the parts table

- **Goal** The parts table carries `claimed_by` and `lease_expires` plus token and cost columns, and tokens-per-promoted-part is a reported metric.
- **Lane** C
- **Files owned** `tools/part-feeder/**`, `tools/conveyor/**`
- **Verify** `npm run verify && npm test --prefix tools/conveyor`
- **Out of scope** `tools/*/data` contents, the catalog release hashes, model packages.
- **Done when** Two concurrent runners cannot claim the same part, an expired lease is reclaimed, and the metric is emitted at the end of a run.
- **Labels** `agent-ready` `size:S` `lane:C`

### 2.4 Env-configurable catalog dir and ngspice binary — IN PROGRESS (`roadmap/factory`, mapping unconfirmed)

- **Goal** The catalog directory and the ngspice binary are environment-configurable, and a part needing a manual PDF drop is skipped rather than stalling the run.
- **Lane** C
- **Files owned** `tools/**`, `packages/component-schema/lib.mjs` (ngspice resolution only)
- **Verify** `npm run verify && npm test --prefix tools/model-factory`
- **Out of scope** The `NGSPICE_BIN` resolution order established by task 0.7: honour it, do not redefine it. Package schemas.
- **Done when** A run completes with both paths set by environment variable, and a manual-drop part is recorded as skipped with its reason.
- **Labels** `agent-ready` `size:S` `lane:C`

### 2.5 Storage cleanup

- **Goal** The 15 MB of extractions is committed, the 627 MB of download intermediates is deleted, closed-batch PDFs are pruned, and the 5.3 GB catalog moves to external storage behind the configurable path from 2.4.
- **Lane** C
- **Files owned** `tools/**`, `.gitignore`, `docs/**`
- **Verify** `npm run verify && git status --porcelain`
- **Out of scope** Anything an existing record cites as evidence. A file referenced by a promotion manifest or review log is not an intermediate.
- **Done when** The repository is materially smaller, every retained path is either committed evidence or reachable from the configurable catalog root, and the deletion list is recorded.
- **Labels** `agent-ready` `size:S` `lane:C`

### 2.6 Review rubric v1

- **Goal** A versioned machine-checkable review checklist covering hard bounds, curve identity, temperature convention, units, collisions and native-versus-WASM parity, runnable by a second model lane, replaces the per-batch authorisation prose.
- **Lane** C
- **Files owned** `docs/CONTRACTS.md`, `tools/conveyor/rubric/**`, `packages/component-schema/**`
- **Verify** `npm run verify && node packages/model-library/validate-library.mjs`
- **Out of scope** Promoting or demoting any shipped package. The rubric is authored and tested against fixtures; applying it is task 2.14.
- **Done when** The rubric runs against a fixture batch and reproduces the recorded verdicts of a closed campaign.
- **Labels** `needs-human` (freeze) `size:M` `lane:C`

### 2.7 Relax ceremony, keep rigour

- **Goal** The evidence contract becomes incremental instead of all-or-nothing, exact-phrase test-mode matching and the disclosure whitelist are dropped, a typed not-stated temperature is allowed with an honest F1 demotion, and the evidence-isolation protocol retires in favour of content-addressed provenance.
- **Lane** C
- **Files owned** `packages/component-schema/**`, `tools/model-factory/**`, `docs/CONTRACTS.md`
- **Verify** `npm run verify && node packages/model-library/validate-library.mjs`
- **Out of scope** Every electrical, provenance and simulation gate stays hard. No shipped package changes fidelity tier as a side effect of this task.
- **Done when** All existing packages still validate, the relaxed rules are versioned in the evidence contract, and a fixture exercises each relaxation.
- **Labels** `agent-ready` (decision already recorded 2026-09-02) `size:M` `lane:C`

### 2.8 Curated relevance list

- **Goal** About 300 MPNs ranked by LTspice, KiCad and ngspice library membership, Wokwi, Falstad and Arduino part lists, and distributor popularity, replace `ORDER BY preferred, stock` as the selection order.
- **Lane** C
- **Files owned** `tools/part-feeder/**`, `docs/MPN-TARGETS.md`
- **Verify** `npm run verify && npm test --prefix tools/conveyor`
- **Out of scope** Already-frozen campaign selections. Reordering the future queue never rewrites a sealed selection record.
- **Done when** The list is committed with its per-source provenance and the selector reads it.
- **Labels** `needs-human` (sign-off) `size:S` `lane:C`

### 2.9 Zener and Schottky bounds on the diode fitter

- **Goal** The diode fitter fits reverse breakdown and Schottky forward behaviour, upgrading roughly 90 shipped F1 packages to real reverse and forward behaviour.
- **Lane** C
- **Files owned** `tools/model-factory/**`, `docs/model-archetypes/**`
- **Verify** `npm run verify && npm test --prefix tools/model-factory && node packages/model-library/validate-library.mjs`
- **Out of scope** Promoting the regenerated packages. Fitting and staging only; promotion runs through the rubric.
- **Done when** A fixture zener and a fixture Schottky fit inside tolerance against native ngspice, and the upgrade path over the 90 packages is a repeatable command.
- **Labels** `agent-ready` `size:S` `lane:C`

### 2.10 Small-signal MOSFET policy

- **Goal** Small-signal MOSFETs fit transfer plus RDS(on), declare the output-family omission openly, and ship as honest F2-DC.
- **Lane** C
- **Files owned** `tools/model-factory/**`, `packages/component-schema/**`, `docs/model-archetypes/**`
- **Verify** `npm run verify && npm test --prefix tools/model-factory && node packages/model-library/validate-library.mjs`
- **Out of scope** Silent passes. An omission is declared in the model card or the package does not ship.
- **Done when** A fixture part fits, the omission appears in its model card, and the tier is recorded as F2-DC.
- **Labels** `agent-ready` `size:M` `lane:C`

### 2.11 Fix the JFET fitter fallthrough

- **Goal** The JFET fitter no longer falls through, and BF256B re-verifies.
- **Lane** C
- **Files owned** `tools/model-factory/**`
- **Verify** `npm run verify && npm test --prefix tools/model-factory`
- **Out of scope** Other families' fitters, package schemas.
- **Done when** The fallthrough has a regression test and BF256B fits inside tolerance against native ngspice.
- **Labels** `agent-ready` `size:S` `lane:C`

### 2.12 Comparator and linear-regulator fitters

- **Goal** The conveyor has working comparator and linear-regulator fitters against the already-written specs.
- **Lane** C
- **Files owned** `tools/model-factory/**`, `tools/conveyor/**`, `docs/model-archetypes/**`
- **Verify** `npm run verify && npm test --prefix tools/model-factory && node packages/model-library/validate-library.mjs`
- **Out of scope** Package schemas, the evidence contract version, existing families.
- **Done when** One fixture part per family fits, validates and matches native ngspice inside tolerance.
- **Labels** `agent-ready` `size:L` `lane:C`

### 2.13 555 and optocoupler fitters

- **Goal** 555 and optocoupler fitters exist, and the frozen 74HC and 555 packages regenerate reproducibly from source evidence.
- **Lane** C
- **Files owned** `tools/model-factory/**`, `tools/conveyor/**`, `docs/model-archetypes/**`
- **Verify** `npm run verify && npm test --prefix tools/model-factory && node packages/model-library/validate-library.mjs`
- **Out of scope** Changing what those packages assert. Regeneration must reproduce the shipped behaviour, not replace it.
- **Done when** Regeneration is byte-reproducible from the recorded evidence and the new fitters pass their fixtures.
- **Labels** `agent-ready` `size:L` `lane:C`

### 2.14 F1 to F2 upgrade campaign

- **Goal** The 527 DC-only stubs upgrade to F2 in relevance-list order, run by the nightly loop under the rubric.
- **Lane** C
- **Files owned** `tools/**`, `packages/model-library/models/**`
- **Verify** `npm run verify && node packages/model-library/validate-library.mjs`
- **Out of scope** Bypassing the rubric, promoting without an independent review lane, editing a sealed campaign record.
- **Done when** Each night's batch is promoted only through the rubric, and tokens per promoted part is reported.
- **Labels** `agent-ready` `size:L` `lane:C`

### 2.15 Vendor-model cross-validation oracle

- **Goal** A local-only oracle runs our card and the vendor's on the same bench and reports only the agreement number.
- **Lane** C
- **Files owned** `tools/native-ngspice-reference/**`, `tools/model-factory/**`
- **Verify** `npm run verify && npm test --prefix tools/native-ngspice-reference`
- **Out of scope** Redistributing any vendor model. No vendor netlist, parameter set or derived artifact is ever committed or published.
- **Done when** The oracle runs locally, the agreement number is the only output that leaves the machine, and a test proves no vendor content is written into the repository.
- **Labels** `agent-ready` `size:M` `lane:C`

### 2.16 Nightly one-PR loop

- **Goal** A scheduled run claims, fetches, extracts, fits, stages, gets rubric-reviewed by the other lane, opens one PR and posts a summary with parts promoted, tokens spent and cost per part.
- **Lane** C
- **Files owned** `tools/**`, `.github/workflows/**`, `scripts/**`
- **Verify** `npm run verify && npm test --prefix tools/conveyor`
- **Out of scope** Auto-merge. The loop opens a PR and stops. Reviewer independence means a different model lane from the author, recorded in the review.
- **Done when** One unattended night produces one PR with a complete review record and a posted summary.
- **Labels** `agent-ready` `size:L` `lane:C`

### 2.17 Bounded fresh replay of all benches

- **Goal** A release command replays every bench from source evidence inside a declared bound.
- **Lane** C
- **Files owned** `tools/native-ngspice-reference/**`, `package.json`, `.github/workflows/**`
- **Verify** `npm run verify && npm test --prefix tools/native-ngspice-reference`
- **Out of scope** The recorded golden artifacts. The replay compares against them; it never rewrites them.
- **Done when** The command replays every bench, reports agreement per bench, and fails on any disagreement outside tolerance.
- **Labels** `agent-ready` `size:M` `lane:C`

### 2.18 Request-a-part form and contributor model PR flow

- **Goal** A "request a part" issue form feeds the nightly queue, and a contributor model PR is gated by the rubric as a CI check.
- **Lane** C
- **Files owned** `.github/ISSUE_TEMPLATE/**`, `.github/workflows/**`, `tools/part-feeder/**`
- **Verify** `npm run verify && node scripts/check-doc-links.mjs`
- **Out of scope** The four required check names. A contributor rubric check is a fifth, separate check.
- **Done when** A submitted form appears in the queue, and a fixture contributor PR is blocked by a rubric failure and passes once fixed.
- **Labels** `agent-ready` `size:M` `lane:C`

---

# Phase D: Designer to WEBENCH parity

Lane B throughout. Parity means WEBENCH Power Designer, DC/DC families first, plus the existing Motor Designer. Everything inside lane B is frozen until D.0 lands: the V2 design-schema types and canonical hashes, catalog release `2026-08-27.2`, the PARTS copper-bound geometry, and the golden fixtures.

### D.0 De-pin the release audit — IN PROGRESS (`roadmap/designer-depin`)

- **Goal** The release audit asserts properties (every reviewed profile validates, at least N candidates, no rule regresses from pass to unknown) instead of literal hashes and source substrings, and the runtime contract accepts N workloads.
- **Lane** B
- **Files owned** `packages/designer-release-audit/**`, `apps/web/designer-runtime-contract.json`, `apps/web/e2e/designer-runtime.spec.ts`
- **Verify** `npm run verify && npm run audit:designer-runtime`
- **Out of scope** Weakening a gate. Hashes stay on a small golden fixture; only the broad literal pinning goes.
- **Done when** Adding one throwaway reviewed profile makes the full audit pass with zero file edits.
- **Labels** `agent-ready` `size:M` `lane:B`

### D.1 Facts schema v3.5 bound-typed fields

- **Goal** The facts schema carries `inductanceMinimum`, `coreLossMaximum`, MLCC `effectiveCapacitanceMinimum` and `esrMaximum`, regulator `minimumOnTimeMaximum` and `minimumOffTimeMaximum`, and `thermalResistanceJunctionAmbient` with a board qualifier, and the passive candidate builders no longer hardcode observation semantics.
- **Lane** B
- **Files owned** `packages/design-schema/**`, `packages/design-library/**`, `packages/power-designer/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/design-schema -- vitest run`
- **Out of scope** The V2 design-schema types frozen until D.0 lands. Do not start this before D.0 merges.
- **Done when** Schema, validators and generators land and the existing 24 profiles validate unchanged.
- **Labels** `agent-ready` (after D.0) `size:M` `lane:B`

### D.2 First strictly eligible buck

- **Goal** The installed policy returns at least one eligible buck candidate for the fixture with zero blocked required rules.
- **Lane** B
- **Files owned** `packages/design-engine/**`, `packages/design-library/**`, `packages/power-designer/**`, `packages/design-recipes/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/power-designer -- vitest run`
- **Out of scope** Silently passing a rule that cannot close. An unclosable rule becomes a labelled engineering gap with a written rationale, which is a human decision.
- **Done when** The fixture query returns an eligible candidate, and every rule is either closed by a calculator or labelled as a gap.
- **Labels** `needs-human` (reclassification) `size:L` `lane:B`

### D.3 Motor: integrated first, external FET last

- **Goal** At least one eligible integrated H-bridge design exists, and external-FET rules that cannot close are reclassified in the open.
- **Lane** B
- **Files owned** `packages/motor-designer/**`, `packages/design-library/**`, `packages/design-engine/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/motor-designer -- vitest run`
- **Out of scope** Silent passes. Capacitor placement and driver bias source need a topology change and are honest gap candidates, not quiet approvals.
- **Done when** One integrated design is eligible and every external-FET gap is labelled with its rationale.
- **Labels** `needs-human` (reclassification) `size:L` `lane:B`

### D.4 Profile factory

- **Goal** A nightly profile factory reuses the existing feeder and conveyor state machine and yields at least 10 authored profiles per run with zero human edits.
- **Lane** B
- **Files owned** `packages/design-library/**`, `tools/profile-factory/**`, `.github/workflows/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/design-library -- vitest run`
- **Out of scope** One agent doing both roles. `reviewerTrack` must differ from `ownerTrack`: the author and the reviewer are separate PRs by separate lanes.
- **Done when** A nightly run yields at least 10 authored profiles that validate, each with a distinct reviewer track recorded.
- **Labels** `agent-ready` `size:L` `lane:B`

### D.5 Catalog scale

- **Goal** A 14 to 22 V to 3.3 V at 2 A buck query returns at least 100 eligible candidates.
- **Lane** B
- **Files owned** `packages/design-library/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/design-library -- vitest run`
- **Out of scope** Authoring a profile by hand to hit the number. Profiles come from the factory with evidence.
- **Done when** The manifest minimums are met across all 12 classes and the reference query returns at least 100 eligible candidates.
- **Labels** `agent-ready` `size:L` `lane:B`

### D.6 Topology breadth

- **Goal** Recipes become topology templates bound to part classes and facts-schema versions with no per-MPN hashes in recipe source, and boost, buck-boost and inverting topologies reuse the passive kernel.
- **Lane** B
- **Files owned** `packages/design-recipes/**`, `packages/design-engine/**`, `packages/power-designer/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/design-recipes -- vitest run`
- **Out of scope** Per-MPN hashes in recipe source. That is the pattern this task removes.
- **Done when** Each new topology has a golden fixture and at least one eligible design.
- **Labels** `agent-ready` `size:L` `lane:B`

### D.7 WEBENCH-grade analysis

- **Goal** Efficiency-versus-Iout and duty-versus-Vin curves render from re-solved sweep points rather than request arithmetic, with a filter rail, histograms and a virtualised results table.
- **Lane** B
- **Files owned** `packages/design-engine/**`, `apps/web/src/features/designer/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/designer-workbench.spec.ts --project=chromium`
- **Out of scope** Charting a value that was not re-solved. A curve point is a solved point or it is not plotted.
- **Done when** Both curves render from re-solved points, asserted in the workbench spec.
- **Labels** `agent-ready` `size:L` `lane:B`

### D.8 Simulation stage

- **Goal** Startup, load-step, input-transient and Bode scenarios run through the sim-engine client with margin extraction, and each has a browser test on the first eligible buck.
- **Lane** B
- **Files owned** `packages/design-engine/**`, `apps/web/src/features/designer/**`, `apps/web/e2e/designer-simulation.spec.ts`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/web -- playwright test e2e/designer-simulation.spec.ts --project=chromium`
- **Out of scope** Granting strict authority from simulation. Simulation corroborates a decision; it never makes one eligible.
- **Done when** Each of the four scenarios has a passing browser test and extracts its margin.
- **Labels** `agent-ready` `size:L` `lane:B`

### D.9 Export and sourcing

- **Goal** A full BOM with 1ku pricing renders from a fixture, the simulation CSV export is enabled, share restores results, and provider enablement is a config change only.
- **Lane** B
- **Files owned** `packages/design-export/**`, `packages/sourcing-core/**`, `packages/sourcing-schema/**`, `apps/web/src/features/designer/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/sourcing-core -- vitest run`
- **Out of scope** Contacting a commercial provider. Sourcing stays fixture-backed until distributor terms are signed.
- **Done when** The fixture BOM renders with price breaks and enabling a provider requires no code change.
- **Labels** `needs-human` (provider terms) `size:M` `lane:B`

### D.10 PCB layout preview and export

- **Goal** KiCad opens the exported board with no repair prompt.
- **Lane** B
- **Files owned** `packages/design-export/**`, `apps/web/src/features/designer/**`
- **Verify** `npm run verify && npm exec --workspace=@opencircuit/design-export -- vitest run`
- **Out of scope** PARTS pin and copper-bound geometry. Footprint identity is read from the frozen geometry, never redefined here.
- **Done when** A fixture design exports a board that KiCad opens cleanly, checked by a `kicad-cli` step.
- **Labels** `agent-ready` `size:L` `lane:B`
