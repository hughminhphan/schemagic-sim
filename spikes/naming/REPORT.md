# Naming report (P0 spike)

Evidence gathered by the luna research lane 2026-08-06; persisted and annotated by the orchestrator.

## Verdict on "OpenCircuit": NOT USABLE

Direct collisions, all live:
- github.com/OpenCircuits/OpenCircuits (398 stars, 87 forks, browser digital logic designer, live at opencircuits.io)
- github.com/il8677/OpenCircuit (transistor-level simulator)
- opencircuits.net (digital/analog education simulator)
- opencircuits.com (electronics wiki)
- opencircuitdesign.com (open-source EDA suite, Tim Edwards' Magic et al)
- opencircuit.shop (Dutch electronics retailer and house brand)
- Apple App Store: unrelated OpenCircuit social/geocaching app (id6502294022)

Also semantically wrong: an "open circuit" is a broken path with zero current. A product whose signature is visible flowing current should not be named after the no-current fault state.

npm/PyPI/crates "opencircuit"/"opencircuits" are free (404s), but the ecosystem collisions above decide it.

## Candidate evidence (all: npm/PyPI/crates 404, .dev/.app/.io DNS unanswered, GitHub exact-repo search 0 unless noted)

| Candidate | Collisions found | Notes |
|---|---|---|
| Ohmtrace | similar OHM-root marks (e.g. OHM Racing) | Lane's top pick. ORCHESTRATOR FLAG: "Trace" is the name of one of Hugh's own clients; avoid the association. |
| Electrowisp | ElectroWise (electrowisehsv.com), ELECTROWIRE mark | phonetic near-misses |
| Voltweave | only a WoW item "Voltweave Fez" | clean but abstract |
| Currentweave | Canadian CURRENTWARE software mark | near-miss |
| Watttrace | WATTCORE owner marks | triple consonant, plus the Trace conflict above |
| Voltwisp | none found | weak/whimsical |
| Circuitwisp | Circuitwise (circuitwise.com.au) phonetic | |
| Currentloom | none found | |
| Wattloom | none found | |
| Voltspindle | industrial spindle noise | |

Trademark caveat: web-level search only. Formal USPTO (uspto.gov/trademarks/search) and EUIPO clearance still required before committing publicly.

## Status: RESOLVED 2026-08-06: Hugh chose scheMAGIC Simulator (short: scheMAGIC Sim), his existing brand, served at sim.schemagic.design. Candidate research retained below in case the name revisits before launch.

## Superseded: was OPEN, Hugh decides

The lane recommended Ohmtrace; the orchestrator vetoes the -trace family for the client-name conflict and finds the remaining candidates serviceable but not yet great. Action before Phase 5: a second, judgment-led naming round (orchestrator-generated candidates, luna verifies availability with the same evidence standard), then the shortlist goes to Hugh, who picks the final name. Local working codename remains "opencircuit" (directory name only, never public).

## Appendix: second-round candidate verification (2026-08-06, archived; name already resolved to scheMAGIC Simulator)

| Candidate | GitHub collisions | npm | PyPI | crates | .dev/.app/.io DNS | Trademark risk | Grade |
|---|---|---|---|---|---|---|---|
| Voltweave | none | free | free | free | all unanswered | low, nothing exact or adjacent | A |
| Biaspoint | minor (empty dormant BPSpice-Project/BiasPoint) | free | free | free | all unanswered | low; generic electronics phrase; biaspoint.de is a music act | B |
| Milliamp | minor (user handle, no exact repo) | free | free | free | all unanswered | medium: cancelled MILLIAMP.COM repair mark; active Milliamp Technologies UK electronics firm | B |
| Mho | minor (ef4/mho build tool 78 stars) | taken | free | free | .app resolves | medium: MHO Networks telecom, MHO+ALL mark; pronunciation trap | C |
| Cathode | major (many exact repos; npm/PyPI/crates all taken) | taken | taken | taken | all resolve | medium | F |
| Ohmic | major (exact electronics repos; Ohmic Labs battery SaaS live) | taken | taken | free | .app/.io resolve | high | F |

If the name ever needs to go collision-free standalone: Voltweave first, Biaspoint second, Milliamp third (subject to formal USPTO/EUIPO clearance).
