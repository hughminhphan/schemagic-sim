# Robonyx Designer status and policy boundaries

This file records the exact installed state of Robonyx Designer, Robonyx Motor Designer, Robonyx Power Designer, Sourcing, exports, and the Robonyx Component Library at release `v0.2.0-rc.1`: the installed recipe identifiers, their content hashes, the constraint policies applied to them, and what each one does not prove.

It exists so the README can stay readable. Nothing here is marketing copy. Every claim is a boundary, and the absence of a claim is deliberate.

For the licensing layers see [LICENSING.md](LICENSING.md). For the release contract see [releases/v0.2.0-rc.1.md](releases/v0.2.0-rc.1.md).

## Robonyx Designer

Deterministic requirements-to-candidate workflow.

Native Motor and Power generation contexts use the 24 independently reviewed profiles in catalog release `2026-08-27.2`. Canonical V2 requirements and same-class customization instructions remain untrusted input until explicit installed regeneration. Exact authorized observations can emit the five separately named structural/engineering inspection artifacts, the Power physical-handoff JSON, and a provider-neutral sourcing-request packet, but none grants ordinary-result mutation, selected-part model or samples, physical fidelity, ranking, provider/commercial, KiCad-attestation, eligibility, or release authority. The retained integrated Motor, direct-gate external Motor, and Power observations all remain ineligible. The narrow native/WASM external-Motor golden is only an ideal reviewed-RDS projection, and the Power golden is only a three-binding ideal nominal passive projection; neither is a selected-part or full-BOM model. Explicit inspection renders transient, adapter-authorized V3 truth/criticality/disposition beside exact V2 structural observations.

## Robonyx Motor Designer

Brushed-DC motor and H-bridge selection.

The installed integrated recipe `motor.native.integrated-h-bridge.facts-v3-2@3.2.6` (`sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07`) preserves the source-bound DRV8876 coast/reverse/forward/brake logic map when PMODE is sampled high at device power-up and passes `motor.integrated.local-capacitance-nominal` only for the exact DRV8876PWPR/C1608X7R1H104K080AA 100 nF nameplate match. It exact-rejects the admitted DRV8262 profile in match before component materialization or customization-witness creation because the one-local-capacitor structure cannot represent its two distinct VM bypass positions plus separate charge-pump/regulator networks. The installed path still retains one ineligible STSPIN840 analytical observation with an unchanged connected exact-BOM structural schematic and a separate request-derived averaged operating-point scenario.

The installed external recipe `motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified@3.1.7` (`sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947`) preserves the source-guided direct xHO/xLO structure with no series-gate resistor, separate bootstrap/VDD-local capacitor roles, and the exact reviewed Diodes `3.0SMCJ33CAQ` TVS. Under Motor policy `sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0`, strict external generation rejects all 54 checked combinations on unresolved hard evidence; explicit inspection materializes 54, Pareto-retains two structural observations, and marks both ineligible at 9 satisfied and 21 blocked required rules each.

Effective capacitance, bootstrap charge/refresh/leakage, local bias and placement, bulk transient energy, `motor.external.gate-network`, switching behavior, full TVS coordination, and selected-part simulation fidelity remain unknown.

## Robonyx Power Designer

Non-isolated synchronous-buck selection.

The installed qualified recipe `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6` (`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`) binds TPS54302DDCR to one reviewed Bel Fuse `F1F2-0804-100M` 10 µH inductor and one Murata `GRM32ER71E226KE15L` 22 µF BOM line at quantity two. Strict generation excludes the option with one `unknown_constraint_disallowed` rejection; explicit inspection retains one structural observation, but policy `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6` keeps it ineligible at 9 pass, 13 unknown, 0 fail.

Four ideal-equation passive-current observations are emitted only as estimates; they do not change constraints or eligibility and do not prove effective inductance, control mode, current sharing, ripple rating, loss, or thermal suitability. The `TPS54302EVM-716` panel remains observation-only reference metadata: its Würth 10 µH and the installed Bel 10 µH share nominal inductance but differ in exact MPN/BOM identity, and it closes 0 strict rules.

The connected schematic, physical-handoff V2, and native/WASM passive golden preserve two explicit capacitor instances but grant no placement/routing, switching, effective-capacitance, ESR/ripple-current, loss, selected-semiconductor/full-BOM, physical-fidelity, eligibility, provider, sourcing, safety, or release authority. The isolated external-FET V3 recipe remains non-release-eligible with no reviewed external-controller profile, V3 policy scope, scenario, or executable selected-part model.

## Sourcing

Provider-neutral BOM policy and dated offer evaluation.

V2 lookup, authorization issuance, and trusted verification share one fail-closed operation-permission validator. Invalid execution modes or approval references fail before cache or adapter access; legacy V1 lookup is audit-only, and raw provider factories are not public package subpaths. DigiKey and Mouser remain disabled pending credentials, written approval, and terms; no live provider access is enabled.

## Exports

Design JSON, BOM CSV, scenario plans, structural SVG/KiCad, printable HTML, SPICE, and behavioral simulation CSV contracts.

Exact-regenerated production observations expose JSON, BOM, structural SVG/KiCad, printable HTML, and zero-omission Scenario SPICE for the separate generic behavioral scenarios. Customized-target inspection receipts contain the sidecar and exact BOM/SVG descriptors, not the artifact payloads; replay is mandatory and conveys no installed-context or production authority. Simulation CSV and Simulator handoff remain disabled without pinned-engine samples and an exact matching simulation receipt.

## Robonyx Component Library and model tools

Reviewed manufacturer models, ingestion, fitting, and native/WASM verification.

771 evidence-bearing model packages are validated; 47 independently reviewed single-subcircuit assets are admitted to the browser-safe execution registry, while other assets remain unavailable until their exact execution gate passes.

## Catalog release `2026-08-27.2`

Catalog `2026-08-27.2` (`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`) contains 24 independently reviewed profiles, including the admitted TI `DRV8262DDVR`, Diodes `3.0SMCJ33CAQ` TVS, Bel Fuse `F1F2-0804-100M` inductor, and Murata `GRM32ER71E226KE15L` MLCC. It preserves corrected geometry exactly: DRV8262 Most/Density-A TOP-copper bounds are `129.123381013 mm²`, DRV8876 copper bounds are `38.500010211 mm²`, TPS54302 copper bounds are `10.582498183 mm²`, and the CSD18540 direct land pattern is `31.24224 mm²`. DRV8262 admission grants no generation feasibility and the installed recipe rejects it before materialization; LM70880 remains researching after its attempted profile was withdrawn. Catalog admission alone grants no candidate eligibility, selected-part simulation, provider, sourcing, or release authority.
