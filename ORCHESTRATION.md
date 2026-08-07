# Orchestration state (living doc — Fable orchestrator owns this file)

Public name: scheMAGIC Simulator, short form scheMAGIC Sim (Hugh's decision 2026-08-06; his/Trace-associated brand, so collision checks moot). Wordmark/title uses "scheMAGIC Simulator"; UI and casual copy may use "scheMAGIC Sim". Deploy: Cloudflare Pages project `schemagic` (reserved; schemagic.pages.dev) -> custom domain sim.schemagic.design (Hugh adds CNAME at Namecheap; root stays on the Trace landing page). Public GitHub repo: `schemagic-sim` planned (bare `schemagic` is Hugh's existing private app-era repo). Local dir name stays opencircuit.
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
- [x] P1 Vertical slice GATE PASSED 2026-08-06: orchestrator reran tests+build, reviewed screenshots; browser WASM proof (worker, 0 long tasks, warm op 1.3 ms, init 403 ms, no COI needed). Punch list -> P2: rebrand scheMAGIC Simulator, fidelity chip only on MPN parts, wiper % formatting. P5 sweep: rebrand "OpenCircuit" strings in model-factory generator + model.cir headers + package names decision.
P3 progress: golds 1N4148 + WP7113ID at F2 VERIFIED (worst fit 0.896% / 0.758%, native-WASM deltas ~1e-13); reviewer=pending-review, independent review lane due after all 5 golds.
- [x] P2+P3 wave lanes VERIFIED 2026-08-06 evening: E1 editor (rebrand + 17 part types + persistence; firefox/webkit e2e pending), E2 waveform-viewer (14 tests, Bode verified), E3 model-import (38 tests incl. hostile inputs; merged from branch), E4 pinned ngspice-46 WASM (6/6 vs native rerun by orchestrator; 1.3 MB brotli, 90 ms init; notices bundle complete), A1 archetype specs (10 files, all templates executed on ngspice-46; limit() broken in ngspice-46, min(max()) idiom mandated), F1 factory + golds 1-2 (1N4148, WP7113ID at F2).
- [ ] INTEGRATION lane — IN PROGRESS (owns apps/web + sim-engine): ngspice-46 swap, waveform-viewer scope, model-import UI, fit-on-load + stroke-weight polish, cross-browser e2e, licences dialog.
- [ ] F1 continued — IN PROGRESS: golds 3-5 (2N3904 bjt, IRLZ44N vdmos, TL072 opamp) per docs/model-archetypes.
- [x] Gold adversarial review (Opus) 2026-08-06: 4/5 PASS under falsification (1N4148, WP7113ID, 2N3904, IRLZ44N signed). TL072 FAILED: VDRP hardcoded 5 V/rail from a min-vs-typical misread, dead below 20 V total supply inside claimed envelope. 7 systemic factory weaknesses recorded in docs/gold-review.md and folded into P4 briefs as rules R1-R7.
- [ ] TL072 refit — IN PROGRESS (returned to factory author with evidence; re-review after).
- [ ] P4 fan-out workflow READY (scratchpad/p4-fanout.workflow.js: 17 batches, 97 MPNs, 37 F2 targets, author/reviewer lane independence, R1-R7 embedded); launches when TL072 passes re-review.
- [x] P5 packaging DONE (Apache-2.0 + notices + CI + templates; dependency audit clean). P6 assets DONE except final README counts: examples verified, catalog live, launch pack drafted (launch/), demo.gif+mp4 recorded, social preview in flight. Visual critique: NO-GO found 4 blockers -> all fixed -> re-critique GO (rail fix landed 1977b97). Cross-browser: chromium 8/8, firefox 2/2, webkit 2/2 (rest chromium-only by design).
- [ ] Final model push wf_18240261-daa IN FLIGHT: repair-stale (BJT regens landing), repair-absent (TIP Darlingtons + BF256B), upgrade-f2, then 6-batch review sweep of 61 pending. Target: >=100 pkgs, >=25 F2, zero pending-review.
- [ ] ENDGAME (in order, after workflows quiet): final sweep tally -> README counts+URL -> history rewrite (strip Co-Authored-By, drop empty commits, delete stray branch review-B1-bjt-small) -> npm test -> gh repo create hughminhphan/schemagic-sim --public + push -> CI green -> wrangler pages deploy apps/web/dist --project-name=schemagic -> live verification checklist -> v0.1.0 tag + release -> final report + launch pack to Hugh. NEVER post to communities.
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
