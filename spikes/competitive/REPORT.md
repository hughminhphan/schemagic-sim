# Competitive research report (P0 spike)

Synthesized by the orchestrator from the luna research lane's findings, 2026-08-06. Research only; no assets or wording copied from any product.

## Feature matrix

| Capability | Falstad | CircuitSim | EveryCircuit | Multisim Live | PartSim | Us (planned) |
|---|---|---|---|---|---|---|
| Live animated V/I visualization | yes | partial | yes | no | no | yes |
| Real SPICE-class engine | no (custom MNA) | yes (browser SPICE) | no | yes (cloud) | yes (cloud ngspice) | yes (ngspice WASM, local) |
| Real MPN components | no | yes | no | yes | yes | yes |
| Model provenance shown | no | no | no | no | no | yes (cards + fidelity tiers) |
| Custom model import | limited | yes (rich) | no | no | limited | yes (.model/.subckt/.lib/.cir) |
| No account required | yes | account for saving | app-based | account required | account | yes, always |
| Free without component limits | yes | no (5/5/5 free tier) | no (5 components) | 78 free parts | was free | yes |
| Open source | GPLv2+ | no | no | no | no | yes (permissive) |
| Offline after first load | standalone only | no (internet each session) | app | no | no | yes (PWA cache) |
| Shareable URLs, no DB | yes | public sharing | gallery | link | link | yes (compressed hash) |
| Status | active | active | active | SHUTS DOWN 2026-09-15 | dead since 2023 | launching |

## What makes Falstad feel alive (own-words mechanics, for our independent design)
- Current shown as dots along wires at fixed spacing (~16 px), advanced per frame proportionally to instantaneous current; a user speed-gain control scales the mapping; no minimum-current cutoff.
- Voltage mapped to a stepped color scale (~32 steps) applied to wires/component bodies.
- ~16 ms render loop; any parameter edit triggers reanalysis plus at least one solver iteration immediately, so the picture never lags the knob.
- Lesson: the magic is zero-latency parameter-to-picture coupling plus continuous motion, not visual complexity. We reproduce the feel with our own mapping (log-clamped density/speed, semantic ramp, honesty thresholds) per CONTRACTS.md section 5.

## CircuitSim teardown
- Pricing: Basic $0 = 5 circuits, 5 custom components, 5 components per circuit, public sharing only. Standard $30/yr = 10/10/15 + DC sweep + private. Premium $90/yr = unlimited/all/private.
- Custom import is genuinely strong: .model, .subckt, B-sources, transmission lines, XSPICE, raw netlists, PSpice/LTspice/HSPICE compatibility modes, KiCad .kicad_sym import, .cscomp export.
- Weaknesses our wedge exploits: proprietary; needs internet every session; restrictive free caps (5 components per circuit is below a useful teaching circuit); text-centric model workflow; library size claims inconsistent across pages (1,200+ / 3,000+ / 3,900+); no provenance or fidelity honesty.

## Engine and licensing facts
- Falstad/CircuitJS1 is GPLv2+: reference for research only, no code reuse in a permissive repo.
- wokwi/ngspice-wasm: MIT wrapper, but an early single-commit snapshot, Docker/Linux build, no JS API or prebuilt release. Not a turnkey path (engine spike owns the final call).
- ngspice: analog + event-driven digital + mixed signal, command/file netlists.

## KiCad symbol verdict
KiCad libraries are CC-BY-SA 4.0 with an exception covering designs/generated outputs, NOT redistributed symbol collections. Shipping KiCad-derived symbols in our repo keeps CC-BY-SA share-alike + attribution obligations on that collection. Decision: draw our own original IEEE/IEC-style symbol set (symbols are simple geometry; cleanroom is cheap) and keep the whole repo permissive.

## Adjacent products (one-liners)
- EveryCircuit: animated, proprietary, mobile-first; free tier 5 components; $15 one-time or $5/mo.
- iCircuit: paid one-time, local, offline, no account; no real MPNs.
- Multisim Live: account-walled, 78 free vs 5,428 premium parts, online-only, announced shutdown 2026-09-15. Its users need a home; our launch should say so factually without dunking.
- TINACloud: proprietary subscription, broad mixed-mode/MCU/HDL, online-only.
- PartSim: free cloud ngspice with Digi-Key links, shut down 2023-01-01 (cloud-dependent tools die; our static/offline architecture is the counter-argument).
- EasyEDA: browser ngspice inside an EDA suite; registration required to save.
- LTspice: free, deep, desktop-only, no browser, no visualization layer.

## README comparison-table draft (only substantiable claims)

| | Falstad | CircuitSim | Us |
|---|---|---|---|
| Engine | custom linear solver | SPICE (browser) | ngspice (WASM, runs locally) |
| Live current/voltage animation | yes | limited | yes |
| Real part numbers with provenance | no | parts, no provenance | yes, every model has a card + tests |
| Free limits | none | 5 circuits / 5 parts each | none |
| Account | none | required to save | none |
| Works offline after load | standalone app | no | yes |
| Open source | GPLv2+ | no | yes |
| Import your own SPICE models | limited | yes | yes |

## Wedge validation (conclusion)
Open-source local ngspice-WASM + Falstad-grade liveness + transparent MPN provenance + no account + offline + durable URL sharing is an unoccupied intersection. Bonus wedge: CircuitJS URL import (Falstad share links) as a migration path, and Multisim Live's September shutdown as timing.
