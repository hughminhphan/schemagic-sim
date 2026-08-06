# Orchestration state (living doc — Fable orchestrator owns this file)

Public name: scheMAGIC (Hugh's decision 2026-08-06, "for now"; his/Trace-associated brand, so collision checks moot). Deploy: Cloudflare Pages project `schemagic` (reserved; schemagic.pages.dev) -> custom domain sim.schemagic.design (Hugh adds CNAME at Namecheap; root stays on the Trace landing page). Public GitHub repo: `schemagic-sim` planned (bare `schemagic` is Hugh's existing private app-era repo). Local dir name stays opencircuit.
Local repo: ~/Documents/opencircuit. Public repo + live deploy authorized; launch posts are NOT (Hugh approves the launch pack).

## Model lanes (verified 2026-08-06)
- Fable 5: inline orchestrator, contracts, synthesis, gates.
- Opus 5 (`model: opus`): architecture/design direction/adversarial review/licence synthesis.
- GPT-5.6 Sol (`subagent_type: sol`): engine integration, editor, parsers, tests, CI, deploy.
- GPT-5.6 Luna (`subagent_type: luna`): extraction, normalization, model drafting, docs, batches.

## Phase status
- [x] P-1 Lane verification (sol + luna wire-verified in splitter log)
- [x] P0 Recon (all 5 spike reports in spikes/, committed)
- [x] P0 gate PASSED 2026-08-06: WASM/native agreement verified by orchestrator rerun; licence path in spikes/engine/REPORT.md; docs/CONTRACTS.md FROZEN v1.0 (browser Worker proof rolls into P1 gate)
- [ ] P1 Vertical slice — IN PROGRESS (source + R + real LED + real BJT + pot + ground + scope, live editing)
- [ ] P2 Editor + analyses (package fan-out)
- [ ] P3 Model factory + 5 gold components
- [ ] P4 Component fan-out (≥100 MPNs, ≥25 F2+)
- [ ] P5 OSS packaging (licences, CI, templates, docs)
- [ ] P6 Launch pack (README, examples, drafts — Hugh gate before any posting)
- [ ] P7 Deploy + live verification, v0.1.0 tag

## P0 spike ownership (non-overlapping paths)
| Spike | Lane | Owns | Deliverable |
|---|---|---|---|
| engine | sol | spikes/engine/ | ngspice-WASM running in Node, native-vs-WASM numbers, licence audit, REPORT.md |
| naming | luna | spikes/naming/ | collision evidence + candidate names, REPORT.md |
| competitive | luna | spikes/competitive/ | feature matrix + wedge validation, REPORT.md |
| schema | sol | spikes/component-schema/ | component.schema.json + example + README |
| design | opus | spikes/design/ | two-pass DIRECTION.md |

## Environment facts
- Native ngspice-46 (KLU) at /opt/homebrew/bin/ngspice — pinned native reference.
- node v26.0.0, npm 11.12.1, python 3.14.6 (scipy fitting), wrangler 4.107.0 (Cloudflare Pages), gh authed as hughminhphan. No emscripten yet (brew install if compiling from source).

## Standing rules for all agents
- Own your paths only; never touch another spike's directory or this file.
- No em dashes in any public-facing copy.
- No datasheet PDFs or restricted vendor models in git, ever (spikes/**/datasheets/ and *.pdf are gitignored).
- Return summaries, not dumps.
