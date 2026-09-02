# Robonyx Designer V1 — Product Scope and Implementation Handoff

**Status:** implementation in progress; reviewed Motor and Power generation available, broader release gates pending
**Prepared:** 2026-08-26
**Repository:** `/Users/hughp/Documents/opencircuit`
**Product direction:** an open-source, vendor-neutral WEBENCH-style circuit design system, beginning with motor drivers

## 1. Decision summary

Build one deterministic design platform with two parallel V1 application modules:

1. **Motor Driver Designer** — the launch wedge, limited to one brushed-DC motor and one H-bridge.
2. **Power Designer** — the first direct WEBENCH-competitor slice, limited to non-isolated buck converters.

Both modules must use the same compiler, evidence model, candidate ranking, circuit generation, simulation, comparison UI, and export pipeline. Do not build them as separate applications.

The primary open-source advantage is the component catalog: any manufacturer's part is eligible under the same public schema, evidence rules, tests, and ranking algorithm. Proprietary vendor tools have a structural reason to keep users inside their own portfolios; Robonyx must have no preferred manufacturer and no paid path to better ranking or competitor exclusion.

Motor drivers are the clearest product differentiation: TI deprecated the old WEBENCH motor-driver flow, while the surviving motor tools are closed and vendor-specific. Buck converters are the smallest credible test of direct WEBENCH parity. These are parallel product tracks, not a sequence: after a short shared schema/compiler contract is frozen, neither track waits for the other.

V1 competes with WEBENCH on the workflow—requirements in, multiple complete and explainable designs out—not on topology count. A claim such as “open-source WEBENCH alternative for brushed-DC motor drivers and buck converters” is supportable. “Full WEBENCH replacement” is not supportable until later releases add boost, buck-boost, isolated topologies, magnetics, and broader device coverage.

The central product rule is:

> Every generated circuit must be reproducible, traceable to versioned equations and component facts, and explicit about what was calculated, simulated, estimated, or unavailable.

No LLM belongs in the electrical decision path.

### Robonyx product umbrella

Use these public names consistently:

- **Robonyx Simulator** — the existing editor, ngspice engine and waveform experience.
- **Robonyx Designer** — the requirements-to-circuit platform and shared workflow.
- **Robonyx Motor Designer** — the motor-driver application module.
- **Robonyx Power Designer** — the power-converter application module.
- **Robonyx Sourcing** — distributor policies, offers and buildability analysis.
- **Robonyx Component Library** — reviewed multi-manufacturer engineering profiles and simulation models.

Neither `OpenCircuit` nor `scheMAGIC` is a public product name any more. Existing `@opencircuit/*` npm scopes, `opencircuit-circuit` document identifiers, `opencircuit.dev` schema IDs and `schemagic-*` format, storage and filename identifiers are compatibility identifiers until a separate versioned migration is designed. New user-facing titles, descriptions, reports and documentation use Robonyx; do not silently change stable identifiers or break old saved circuits merely for branding. See the naming section in the [root README](../README.md) for the single explanation of this split.

## Current implementation state — 2026-08-26

The repository now contains a working deterministic vertical slice, not the release described by every later V1 acceptance gate.

Implemented and verified:

- Frozen closed V1 contracts plus additive, strict V2 request/result, evidence, quantity, context, sourcing-policy, offer-snapshot and sourcing-metric contracts, with M1/M2/P1/P2 synthetic test seams. An additive V3 request and decision sidecar leaves every V2 type, serializer, hash and generator unchanged. A separate additive, closed sourcing-request-packet V1 contract canonicalizes a local provider-neutral transfer without changing any frozen design-result contract.
- Application-neutral deterministic compiler with stable hashes/order, inspectable rejections, hard-failure exclusion, Pareto pruning and optional post-electrical sourcing evaluation.
- Engine-owned Motor and Power recipe contracts with exact mixed facts-V2/V3 release paths and isolated synthetic fixture adapters. Production readiness is evaluated from exact installed recipes and the bundled reviewed catalog rather than fixture catalogs. Installed Motor successors are `motor.native.integrated-h-bridge.facts-v3-2@3.2.6` (`sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07`) and `motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified@3.1.7` (`sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947`); `3.2.5` and all earlier exported predecessors remain frozen and directly testable. The installed Power integrated successor is `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6` (`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`). External lanes remain class-isolated and non-release-eligible.
- Current catalog release `2026-08-27.2` (`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`) contains 24 independently reviewed profiles. It admits DRV8262 (`sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a`) and preserves exact TI WEBENCH Most/Density-A TOP-copper geometry at `129.123381013 mm²`, alongside the corrected DRV8876, TPS54302, and CSD18540 geometry. DRV8262 catalog admission is not generation feasibility: the installed one-local-capacitor recipe rejects it before materialization because its two VM bypass positions plus charge-pump/regulator networks are unrepresentable. LM70880 remains researching after its attempted profile was withdrawn.
- The content-addressed production catalog now contains 24 independently reviewed profiles: the thirteen shared facts-V2 profiles Bourns `CRA2512-FZ-R020ELF` and `CR0603-FX-1003ELF`, Panasonic `ERJ3EKF1003V`, Vishay `CRCW0603100KFKEA` and `CRCW0603732KFKEA`, Murata `GRM31CR61H106KA12L`, Samsung Electro-Mechanics `CL31A106KBHNNNE`, TDK `C1608X7R1H104K080AA` and `C3216X7R1H106K160AC`, Nichicon `UCM1V331MNS1GS`, Panasonic `EEHZS1V331V`, and Diodes Incorporated `1N4148W-7-F`; the facts-V2 Murata `LQM18PN2R2MGHD` and facts-V3.4 Bel Fuse `F1F2-0804-2R2M` and `F1F2-0804-100M` power inductors, plus the facts-V2 Murata `GRM32ER71E226KE15L` MLCC; the selected-class facts-V3 Bourns `PTVS10-058C-SH` and Diodes `3.0SMCJ33CAQ` TVSes plus the Texas Instruments `CSD18540Q5B` MOSFET; the facts-V3.1 Microchip `MIC4606-2YML-T5` full-bridge gate driver; the facts-V3.2 Texas Instruments `DRV8262DDVR` and `DRV8876PWPR` plus STMicroelectronics `STSPIN840` integrated H-bridges; and the facts-V3.3 Texas Instruments `TPS54302DDCR` integrated synchronous buck regulator. All bind exact official source bytes, exact MPN identity, conservative manufacturer geometry, and independent review metadata. The MLCCs deliberately leave unsupported effective-capacitance, DC-bias, ESR, and ripple-current values as explicit unknowns; general-resistor pulse power remains unknown where unsupported; the Bourns current-sense overload remains qualification-only; the switching diode's optional reverse-recovery time remains estimated; Panasonic bulk's 4000 h value remains an exact conditioned endurance test, not field-life prediction; Nichicon impedance is used only as a conservative ESR upper bound at its exact source conditions; the Murata inductor uses only hard maximum inductance-change, temperature-rise, and DCR ratings while leaving core loss unknown; the Bel inductor retains conservative 12 A minimum saturation-current and 10 A minimum temperature-rise-current endpoints only at the manufacturer's 25 °C reference while its nominal inductance remains tied to the published 100 kHz/0.25 V RMS test point; TVS pulse energy is explicit unknown rather than a synthesized joule rating; the MOSFET omits optional timing/recovery values whose complete conditions cannot be represented; and the MIC4606 50 ns minimum pulse remains a typical observation that cannot produce a hard timing pass. The Diodes TVS binds 33 V stand-off and 53.3 V maximum clamp only to their exact source conditions and leaves application waveform, pulse energy, overshoot, thermal, SOA, and full coordination unproved. DRV8876 continuous current, minimum input pulse width, and bulk capacitance remain explicit unknowns; its 3.5 A peak operating limit is not a continuous- or stall-current guarantee, its 0.1 uF local capacitor remains a recommendation, and its current-mirror interface does not assert a configured current limit. TPS54302 output-current capability, a direct device-level DC-regulation guarantee, minimum off-time, loop stability, passive effective values, loss, thermal behavior, and selected-part simulation fidelity remain unknown where the reviewed evidence cannot prove them. The current Power closure is instead limited to comparing calculated VFB/resistor corners against an explicit request envelope. Catalog admission and profile evidence do not by themselves prove generation feasibility or selected-part simulation fidelity. Coilcraft `XAL7030-472MEC` remains hash-bound and authored but excluded because its current figures are not hard limits.
- Isolated real-part evidence ledgers for Motor and Power remain outside admission except where an exact staged identity already has a separately normalized, hash-validated reviewed release profile. The Motor report now reconciles `DRV8876PWPR` and `STSPIN840` to their exact facts `3.2.0` profile IDs/content hashes and the recognized installed ready integrated-H-bridge recipe, so it truthfully reports two catalog-admitted and two enumeration-only generator-eligible identities; that scope does not mean strict candidate eligibility, and the other five staged Motor identities remain excluded. `DRV8262DDVR` is independently reviewed and admitted at facts `3.2.0`, but the installed `3.2.6` recipe rejects its exact hash-bound identity before materialization or customization because the one-local-capacitor structure cannot represent its two VM bypass positions plus separate charge-pump and regulator networks. Its shared-profile report derives exact reviewed-release/admission/fact/recipe coverage for `CRA2512-FZ-R020ELF`, retiring the current-shunt gap. The role-qualified external recipe separately authorizes exactly three reviewed 100 kΩ profiles—`CR0603-FX-1003ELF`, `ERJ3EKF1003V`, and `CRCW0603100KFKEA`—for the physical gate-source pull-down role and excludes the 732 kΩ profile. Exact supplemental MIC4606-2 guidance makes a series-gate resistor not required for the selected direct xHO/xLO structure; no resistor value or driver/MOSFET application-compatibility claim is inferred. External N-MOSF, supply-TVS, and nominal bootstrap/VDD-local role coverage are satisfied, leaving exactly one shared-profile gap: capacitor application evidence for effective bootstrap and VDD-local behavior plus bulk transient-energy adequacy. All seven staged Power facts-V2 assessments remain recorded. The exact TPS54302 staged identity is separately reconciled to its independently reviewed facts `3.3.0` release profile, and the exact Bel Fuse inductor is admitted at facts `3.4.0`; installed ready recipe `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6` binds TPS54302DDCR to the reviewed Bel `F1F2-0804-100M` 10 µH profile and a quantity-two Murata `GRM32ER71E226KE15L` 22 µF output-capacitor line, so the staged TPS54302 identity is not counted as a release-admission blocker. The other six staged Power primary profiles remain blocked. `LM70880RRXR` contributes exact 4.5 V to 80 V recommended-operating and 8 A single-device evidence, so the staged input envelope is covered while the 10 A output-current target remains open. Its attempted facts-V3.3 materialization was withdrawn fail-closed because TI's parenthesized example-layout coordinates are reference-only and cannot prove the maximum geometry required by the current contract; only the exact 1.0 mm maximum height remains source-bound. Its reservation is `researching`, it is non-generating, and the installed fixed-oscillator recipe cannot represent its sense resistor, RT, compensation, supply-capacitor, and conditional bootstrap-resistor network. A fail-closed assessment selects NCP1599, and the design library now materializes its hash-bound, schema-valid `partial_non_admitted` profile containing only source-backed VIN, current-limit, minimum-on-time, junction-temperature and geometry facts; 19 paths remain explicit unknowns and 23 admission rules remain unsatisfied. Its 15 authoring blockers are one missing-profile-evidence, four missing-source, two semantic-mismatch, five schema-unrepresentable-condition and three condition-authoring blockers. Independent review remains pending, the authored profile is excluded from the reviewed catalog, and the current [official NCP1599 product page](https://www.onsemi.com/products/power-management/dc-dc-power-conversion/converters/ncp1599) lifecycle warning is not promoted into an electrical fact. The complete Motor facts-V2 assessment ranks DRV8701ERGER strongest but retains `no_honest_draft`, `draft:null`, six draft blockers and 20 additional review gaps. Exact source corrections add the DRV8701 9.5 mA maximum active VM current and a conservative HIP4081A 50 ns input-pulse minimum without changing isolation or admission.
- Deterministic connected structural `CircuitDocument` materialization for retained integrated Motor, external Motor, and Power production inspection candidates. The role-qualified external Motor recipe emits a direct-gate exact BOM and structural assembly with no series-gate resistor and an explicit `gate-drive-direct-to-bridge` connection. Each exact selected BOM remains represented in its unchanged default `assembly`; primary semiconductor and protection parts use content-addressed `schematic_only` design blocks and wiring is non-empty. Separate behavioral graphs are explicit generic projections: Motor adds the request-derived averaged `pwm_loaded_steady_state` graph, while the qualified Power facts-V3.4 recipe defines an ideal-PWM nominal LC-output transient using the selected Bel 10 µH inductor and two explicit Murata 22 µF capacitor instances at per-part nominal value. These instance classifications and BOM nonrepresentations prevent any graph from becoming an exact-BOM model, selected-part silicon model, or physical-fidelity claim. They do not alter constraints, ranking, evidence, receipts, or V3 eligibility. Additive physical-handoff V2 `sha256:8ec85a29ebe3578e70d31e1123b34f9b6a65a269c5c1b5db84568b377c6496be` binds the quantity-two capacitor line to `output-capacitor-1`/`C3` and `output-capacitor-2`/`C4`, while preserving immutable V1 predecessor `sha256:dc8671f69b6588e6d11fd65fa9b954951ccc0dc28d208a6e3c877e8cbf24e068`. Both versions fail closed without footprint identity or physical pin mapping and grant no placement, routing, manufacturing-output, physical-fidelity, eligibility, simulation, or attestation authority.
- A content-addressed `production_strict_v1` V3 constraint-decision sidecar evaluates exact V2 results against exact recipe-ID/content-hash policy scopes. It records source truth, policy criticality, and disposition separately; rejects undeclared or missing required rules, V2 warning statuses, source warning strings, context drift, and policy drift; and projects V3 requests to permissive V2 only as a named design observation. The installed Motor policy is `sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0`; Power is `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6`. The Power policy is scoped only to `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified`; the external-FET recipe has no policy scope. Both production catalogs use only `safety` or `requirement` criticality—never `engineering_gap`—so the retained integrated Motor, external Motor, and Power observations are ineligible. Solve/match and missing-profile fallbacks occur before candidate retention and remain explicitly outside the sidecar rather than being silently reclassified. Motor and Power policy leaves are separate lazy browser capabilities; neither closure imports the combined or opposite application policy.
- The reviewed generation contexts are installed, but context readiness is not candidate readiness. All three current browser starting points retain zero verified candidates under strict unknown-constraint exclusion. Explicit unknown-evidence inspection exposes one integrated-Motor, two direct-gate external-Motor, and one integrated-Power V2 structural observation under their installed V3 policies; all are visibly ineligible. External strict generation records 54 `unknown_constraint_disallowed` rejections; opt-in inspection materializes all 54 combinations, records 52 Pareto-dominated rejections, and retains two observations. For the Power preset, strict generation records one `unknown_constraint_disallowed` rejection and retains zero candidates; opt-in inspection records zero rejections and materializes one exact-BOM observation. The exact 25 °C divider-resistor power/voltage rule passes; the calculated VFB/resistor corners fit the explicit 4.7 V to 5.3 V request envelope; and a null load-transient target emits no rule. Thirteen protection-coordination, inductor operating-point, stability, passive effective-value, ripple, loss, and thermal constraints remain unknown. These counts are inspection or rejection outcomes rather than feasibility, release, provider, sourcing, or selected-part-fidelity claims.
- Shared Designer route with reviewed Motor and Power production generation, strict-by-default unknown-constraint exclusion, explicit unknown-evidence inspection opt-in, exact-context result trust, deterministic canonical-result downloads, and byte-exact share regeneration. The transient V3 policy surface shows truth, criticality, disposition, policy rationale, zero eligibility, and the installed policy hash beside exact V2 observations. An adapter-owned capability and complete generation fingerprint bind result, execution, context, and decision bytes; structurally valid cloned or rehashed decisions cannot acquire production trust. File imports reject decision fields/envelopes, JSON/share serialization remains result-only, and a share regains V3 state only after explicit exact installed regeneration. The production decision explorer exposes the primary manufacturer/MPN, pins up to three inspectable observations into an exact comparison matrix, and keeps the exact V2 observation execution report available without treating Pareto survival as policy eligibility. Its five causal classes distinguish recipe feasibility, electrical hard failure, evidence-policy exclusion, deduplication, and objective-relative Pareto domination; kept/dominator references link back to retained rows where possible. A production-only selected-part dossier groups each exact BOM line's already-persisted source ID, locator, content hash, retrieval time and license note, with deterministic ordering/deduplication and explicit missing-reference states; it is traceability only and creates no new review, admission, model, commercial or simulation authority. Exact production BOM lines also expose user-initiated LCSC searches for the encoded exact MPN, explicitly without querying, importing, ranking, or attesting stock, price, lifecycle, lead time, packaging, or orderability. Ordinary imports and demonstrations never receive production trust, policy state, exports, previews, controls, dossiers, link-outs, or execution authority. The direct-gate external-NMOS path now exposes exact candidate-bound inspection exports and traceability for its two retained structural observations. Its same-class customization surface has no compatible admitted primary alternate, and no selected-part device model or physical-fidelity golden is attached. A separate unattested ideal reviewed-RDS(on) projection binds the first ineligible external observation to four ideal 2.2 mOhm resistors at the exact reviewed table point; it is execution evidence only for that bounded `V = I R` relation, not a transistor model or selected-part fidelity. The exact-regenerated retained integrated Motor, direct-gate external Motor, and Power V2 observations can download electrical BOM CSV and structural SVG variants that inseparably record the exact installed V3 decision/policy hashes, eligibility, blocked counts, and blocked rule IDs; the SVG repeats the boundary in visible and accessible text. An exact WeakMap-authorized customized target can additionally emit separately named engineering-report HTML, structural KiCad, and the exact default behavioral Scenario SPICE deck, alongside its BOM CSV and structural SVG. Every customized-target artifact binds the source result and execution, instruction and customized result, target result/candidate/profile, installed context/recipe/policy/decision/eligibility, and—where relevant—the scenario identity. The Scenario SPICE path is enabled only for exactly one authored `behavioral` coverage at the target's exact `defaultScenarioId` after netlist generation reports zero omissions; no caller- or DOM-selected scenario can expand that authority. All five remain target-only projections with no ordinary-result promotion, ranking recomputation, selected-part model, simulation samples, physical-fidelity claim, commercial authority, external KiCad open/save attestation, or release authority. A separate portable customized-target inspection receipt deliberately remains limited to the exact customized-result sidecar plus fixed-order BOM/SVG descriptors by kind, filename, MIME type, UTF-8 byte length, and SHA-256. It does not include either artifact payload; parsing and self-hash are integrity-only, exact replay remains required, and the receipt confers no installed-context, ordinary-result, eligibility, ranking, selected-part model, simulation, commercial, or attestation authority. The selected detail, preview, and BOM also repeat the candidate-local observation/ineligibility summary so clipping cannot conceal it. Ordinary engineering HTML, structural KiCad, and Scenario SPICE remain V2/generic projections without a V3 eligibility decision; their customized-target counterparts carry the exact decision only as provenance, never as independent eligibility evidence. Scenario selection never executes a model. The preview uses a revocable local object URL, guards against stale candidate/result/decision completions, and never appears for ordinary imports or demonstrations. The behavioral deck is a generic request/passive projection—not a selected-part model—and cannot alter BOM, constraints, ranking, evidence, receipts, or V3 eligibility. Structural KiCad intentionally has empty footprints, no simulation samples, and no external-open attestation. Simulation CSV and Simulator handoff remain disabled without actual pinned-engine samples and an exact matching receipt; commercial export remains disabled without an authorized snapshot. Strict local V1/V2 result inspection, a hash-bound context-free scenario-gate-plan download, and a four-lane M1/M2/P1/P2 demonstration gallery remain separate trust surfaces. The gallery performs no fetch before an explicit user action, verifies exact manifest/artifact bytes and request/result/library/recipe/candidate identities, rejects sourcing data, and enters the existing strict V1 audit-only import path. It does not import fixture generation, reconstruct absent engineering/execution/commercial context, or claim that a demonstration context is executable production evidence.
- Exact authorized production generations with a selected candidate can download a canonical provider-neutral sourcing-request packet binding the exact result/candidate references, selected BOM, build quantity, region, currency, and visible policy. The installed adapter and Designer route independently regenerate and verify that exact input before download; cloned generations, changed candidate/BOM data, content/presentation splits, and stale async completions fail closed. The packet contains no offers, provider URLs or selection, credentials, commercial observations, provider/network authority, snapshot persistence, ranking evidence, or eligibility authority. Ordinary imports and demonstrations never receive this surface. The exact retained integrated Motor, direct-gate external Motor, and Power observations can each bind a local packet; this is a transfer surface, not sourcing/provider authority.
- Deterministic V2 design JSON, electrical BOM CSV, scenario SPICE, structural SVG, structural KiCad, self-contained printable HTML report and behavioral simulation CSV contracts. Production observation CSV/SVG variants are exact-decision-bound and byte-verifiable; ordinary strict V2 CSV/SVG bytes remain unchanged when no decision is supplied. The production artifact boundary reaches Scenario SPICE only for the separate zero-omission generic behavioral scenarios under exact installed contexts. The printable report requires an exact regenerated engineering context and is parser/byte verified; Simulation CSV remains production-disabled and, when its full contract is used elsewhere, binds exact samples and netlist bytes to an unsigned local ngspice-46/KLU receipt as waveform-only evidence.
- Bounded synthetic application-golden contracts for all four V1 topology fixtures: integrated Motor M1 and external-NMOS Motor M2 operating points, plus integrated Power P1 and external-FET Power P2 startup circuits. All four execute exact generated netlist bytes with native ngspice-46 and the shipped ngspice-46 browser-WASM build, verify repeatable `attestation:none` receipts and declared selected-observation windows, and require a narrow analytic relation: exact represented DC-loop current closure for Motor, and positive feedback/load slopes over a non-zero startup span for Power. These relations remain explicitly behavioral and outside ranking, broad analytic-estimate correctness or production-profile evidence. The P2 result is explicitly far below requested 12 V regulation.
- A current-production selected-passive schema-V2 application-golden contract binds Power context `sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3`, catalog `sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890`, and source release `sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`. Strict request `sha256:30b8c0fac110f71ce3e71c9347afe725f2a1ad29aa4fdb6bfde8bc87cc73771c` produces result `sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2`, rejects `candidate:v2:sha256:88b7d52b012cd7edfda6ba8f5ef0611c7d2ffeff870614ccf9d0dea6f1ca679d` as `unknown_constraint_disallowed`, and retains zero candidates. Permissive request `sha256:f21a643aba1a3c8cb75d42ff2e69b4f12a25168becdb68fbf54f720649821cd4` produces result `sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a`, candidate `candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a`, and ineligible decision `sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37`. Recipe `3.4.6` is `sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`; policy is `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6`. The 10,620-byte contract `sha256:5088a3a938bdbc0b8a2a4ea21f9dfba0b3e7e45d61fbca48f94d5ab4e28365ff` requires three ordered bindings: Murata `GRM32ER71E226KE15L` capacitor instances 1 and 2 from the quantity-two 22 µF BOM line, then Bel `F1F2-0804-100M` 10 µH. Netlist `sha256:7d0a83af5d553344adaedbd6ab9d2ad86a70630313ab56045e46304c9eaeac97` and the 11,674-byte report `sha256:556176f71e09dc5dfdd24ae62ec446bc17cccc6060ed51fcf9a0dd1b292e493c` validate both capacitor-current vectors and `Iinductor=Icapacitor1+Icapacitor2+Iload` with `Iload=Voutput/Rload` on native ngspice-46 and browser-WASM. This remains unattested and ineligible; switching, effective-capacitance, capacitor-ESR/ripple-current, passive-current/loss, physical-passive, full-BOM, selected-semiconductor, eligibility, ranking, and safety authority are explicitly unavailable.
- Content-addressed, byte-reproducible M1/M2/P1/P2 request/result example artifacts with exact generator, library, recipe, candidate and artifact identities. They are emitted as five detached static JSON assets rather than JavaScript/source-map payloads and loaded only on an explicit gallery action. Production build checks require byte-identical copies and forbid fixture generators, synthetic catalog contents, MPNs and evidence from entering browser code. The artifacts remain synthetic test/UI examples with zero production profiles, provider access, commercial data or simulation-fidelity claim.
- Opt-in external KiCad CLI QA contract for one exact-context synthetic Motor and Power V2 schematic. It writes and reads back exact fresh input bytes, invokes KiCad 8/9/10 `sch export pdf`, and binds the CLI version, commands, result/context/input/output hashes and report hash with `attestation:none`. The injected test runner proves fail-closed contract behavior. A fresh local KiCad 10.0.5 run against the current fixtures passed CLI parse and PDF export for both schematics, producing canonical report `sha256:33cbc8460488ccc231e70a075898fc7a9aadaeb96ddde59a254d25fbdd7c7a2d` (raw report file `sha256:68d071847fb327406ee270791e33fc06f1381a80a9f774e631d0de77f89b72cf`). The report remains self-reported and unattested; interactive GUI open/save without repair remains explicitly unverified.
- Provider-neutral sourcing evaluation, disabled-by-default hash-pinned DigiKey/Mouser policies, and a native V2 server-only sourcing-service boundary with closed exact-MPN requests, authorization, execution-mode, rate, cache/deletion, lineage, stale-fallback and export/persistence enforcement. V2 lookup, authorization issuance, and trusted verification share one fail-closed operation-permission validator. Invalid execution modes and approval references fail before cache or adapter access; legacy V1 lookup is audit-only; raw provider factories are absent from public package subpaths. This proves code-path isolation only, not provider approval, credentials, terms, live lookup, commercial observations, or export authority.
- Deterministic release-readiness audit covering manifest/catalog admission, Motor/Power evidence and production status, sourcing policies, export coverage, simulation integrity and unverified external release checks. Dedicated `sourcing.native-v2-contract`, `sourcing.request-packet-v1`, `power.external-fet-readiness-contract`, `simulation.production-selected-passive-nominal-projection-golden-contract`, and `simulation.selected-semiconductor-ideal-rdson-projection-golden` gates keep provider activation, packet transfer, external-Power readiness, nominal-passive execution evidence, and the bounded ideal-RDS execution projection independent. The simulation audit recognizes both canonical current-production projection artifacts as deterministic, unattested, policy-ineligible evidence; it remains unverified on passive operating-condition coverage and full-BOM selected-part coverage. The selected CSD18540Q5B device-model package and physical-fidelity golden contract remain absent and unapproved, so the dedicated production selected-semiconductor gate stays blocked.
- Content-addressed repository release scanning over Git-tracked and unignored untracked files, with fail-closed credential and local vendor/source-archive detection. Ignored working datasets remain excluded from the release set; the scan grants neither publication rights nor provider approval.
- Coordinated workspace install, workspace typecheck/build/tests, reviewed model-package validation, production-bundle capability scanning with a 256 KiB Designer route ceiling, and cross-browser Designer artifact-inspection QA. In the fresh production build, the Simulator and Designer route chunks are 136,266 and 151,524 bytes respectively. The lazy Motor V2/V3 roots are 122,172/11,982 bytes with isolated closures of 984,891/998,717 bytes; Power V2/V3 are 87,363/7,077 bytes with closures of 950,082/959,003 bytes. The ordinary production-export root is 8,303 bytes with a 398,530-byte closure. One lazy web-owned customized-target artifact wrapper is 20,345 bytes with a 448,435-byte private closure. It statically owns the BOM/SVG, installed HTML/KiCad/SPICE, and two-kind receipt replay sources; exposes exactly the guarded file operation and receipt verification; accepts only the application's private one-shot authorization token for rendering; has the installed application boundary as its sole dynamic importer; and emits no standalone raw renderer or raw runtime export. The bundle audit separately scans the wrapper root and its closure excluding the already-audited applications owner for network, provider, source, fixture, commercial, and simulation-execution capability. The provider-neutral request-packet root and complete closure are both 9,171 bytes; the closure contains exactly its canonical serializer and packet contract, has no dynamic imports or network primitive, and is imported only by the installed application boundary and Designer route. Detached example JSON is excluded from those budgets. The freshly built static inventory contains 73 production artifacts across 24 JavaScript assets and 803 inventoried external-navigation URLs, with artifact-set hash `sha256:72183a6f127982cea4c823c8ea24264b92a412c049a3664f5768427f8f64e370`; its aggregate and exact TVS pins are current, and two consecutive production builds reproduced the exact inventory hash. The source-mapped audit still checks browser network primitives, service-worker guards, local worker/WASM targets, bounded gallery fetches, active HTML/CSS endpoints and user-initiated external navigation. The exact MIC4606 Rev-H URL is inert and bound to its source/profile/release/predecessor hashes, direct-gate contract, and exact capacitor-role bindings; changed placement or identity, a second bundle occurrence, fetch, or automatic navigation fails the audit. The production-only LCSC handoff is source-scoped to the exact search prefix and safe-tab attributes; alternate paths/origins, other sources/chunks, automatic navigation and embedded-resource sinks, and active provider-style access remain blocked. The complete Chromium/Firefox/WebKit matrix now accounts for 91 executed passes and 20 intentional engine/platform skips. Coverage includes automated serious/critical axe A/AA checks, exact Motor/Power requirements file/share restoration without auto-generation or trust transfer, explicit installed-context result/customization regeneration, exact external-Motor direct-gate JSON/BOM inspection with zero provider requests, all five bounded customized-target downloads, exact two-kind receipt download/replay with oversize, stale-read, and instruction-mismatch guards, direct-import rejection by the guarded wrapper, exact packet generation and stale-completion invalidation, click-only exact example loading with keyboard focus/fail-closed behavior, narrow-screen/reduced-motion behavior, same-origin offline reopen, and the import-versus-explicit-regeneration V3 trust contrast.
- Canonical Motor and Power V2 electrical requirements can be downloaded, imported, and shared through a hash-bound `#r` URL. The transfer is strict untrusted input only: exact request bytes, `libraryVersion`, and display units are preserved, while result, execution, V3 decision, verified context, candidate/scenario, provider/commercial, simulation, component-override, and MPN-override state are not representable. File or URL load never generates or installs trust; the user must explicitly invoke the normal installed application generator, and stale library versions fail without silent upgrade. A separate canonical primary-part instruction binds an exact request/source result/source candidate/context and same-class source/target profile hashes. The browser can discover admitted same-class targets, download/load the strict instruction, or carry it beside exact requirements in a strict `#r+c` URL. Applying or restoring an instruction is inert until an explicit user action exact-regenerates the source through the installed application adapter, recovers one freshly checked/materialized same-recipe pre-Pareto target with every non-primary component byte-identical, and evaluates that target under the installed V3 policy. The target-only observation is separately authorized, cannot mutate the ordinary result or ranking, and has no ordinary-result, ranking, selected-part model/simulation, commercial, or broader production authority. Only the exact authorized in-process source/target pair can emit the five separately named, content-addressed inspection downloads: electrical-BOM CSV, structural SVG, engineering-report HTML, structural KiCad, and the exact default authored behavioral Scenario SPICE deck when its zero-omission gate passes. Those bytes bind the recorded eligibility decision but remain inspection-only and are not eligibility, ranking, simulation, commercial, attested, or production-readiness evidence. A canonical inspection receipt can port the exact customized sidecar and only the BOM/SVG descriptors, but not the artifact payloads; verification must reproduce the exact BOM/SVG bytes and does not transfer installed-context or production authority. The substitution action path remains reachable only where an exact same-class admitted target exists; the direct-gate external-NMOS observations have no compatible admitted primary alternate. They do expose ordinary exact-context inspection artifacts and a provider-neutral sourcing-request packet, but no selected-part device model or physical-fidelity golden. The separate ideal reviewed-RDS(on) projection remains outside browser artifact, customization, sourcing, and production authority.
- A separate content-addressed runtime contract (`2026-08-30.1`, `sha256:201eac547ff0617270a8540ed5aa5b1de3c1d9f3b3df4eebba0fd15dada14779`) exercises exact production Motor and Power presets in a fixed headless Chromium lane. Each workload completes only after its exact retained result, decoded structural-SVG preview, and primary-part customization target discovery have settled with `aria-busy=false`. Motor requires the settled enabled selector to contain two options and binds request, result, candidate, and preview identities. Power requires a settled disabled selector with its zero-compatible/no-alternate state; it additionally binds the exact installed constraint-decision hash and literal `candidateEligible:false`, without converting the retained observation into eligibility, simulation, provider, or sourcing authority. The contract does not run the external-NMOS preset and supplies no external observation, evaluated customized result, artifact, sourcing, selected-semiconductor, or performance evidence. Timing, long-task and post-GC Chromium heap budgets apply to both workloads. The generation-and-preview p95 ceiling is 10 seconds so the cold shared Linux runner remains a stable gate; the exact report continues to record the actual host and browser. No report for this contract version is checked in or attached, so no performance measurements are claimed for it. A 2026-08-30 local diagnostic run nevertheless passed the contract with report hash `sha256:c1a0c94b5f57a7d852ef85b325b247c15506124de1bad1f6fc3797dc8d38ad6f`: Motor p95 4.1998 s with 610,044 bytes retained heap growth, and Power p95 1.3380 s with 794,840 bytes retained heap growth. Those console-only observations are unattached diagnostics and do not promote the release gate. The contract remains CI-wired, and the workflow-dispatch lane can emit strict content-addressed report, receipt and readiness artifacts. A receipt remains `attestation:none`: it does not authenticate that the described run occurred and can only replace the `unattached` blocker with `artifact_attestation_unverified`. The workflow asks GitHub to attest those files, but this audit does not yet ingest or verify that provenance. All broader deployed, cross-browser, whole-process-memory, provider and simulation-fidelity claims remain `not_claimed`; no authenticated post-commit workflow artifact is attached yet.

- The current browser Motor context is `sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38` under catalog release `2026-08-27.2` and unchanged policy `sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0`. For the external lane, strict request `sha256:2fd2159070a51d75077ea7e2d7aa968af94728cc3d869aaf42f9dfc0be13d563` produces result `sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435`, with 54 unknown-policy rejections and no retained candidate. Explicit-inspection request `sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f` produces result `sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176`, retained observations `candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed` and `candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70`, and decision `sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e`, which marks both ineligible with 9 satisfied and 21 blocked required rules each. The ideal reviewed-RDS(on) projection for the first observation is contract `sha256:cfa78576f707a62126c38648428c75e7e3b6ec3d78d516e13818a56449dca7ae` with 6,743-byte report `sha256:789996602667d3d28bdfbec0ecfad25e48ba80ea32f4087390aa59c7a920b3f2`; it proves only four independent ideal 2.2 mOhm `V = I R` drops at the reviewed table point, not a selected-semiconductor model, switching, thermal, physical, eligibility, ranking, provider, commercial, safety, or release claim. The retained integrated Motor observation is likewise structural and policy-ineligible.

Deliberately not implemented or not yet release-grade:

- The production catalog contains 24 admitted profiles and now satisfies the exact installed-context prerequisites for the native Motor recipes and the qualified integrated-Power recipe, but remains far short of complete topology coverage and per-class profile targets. Synthetic fixture catalogs remain test-only; other staged real Motor and Power primary-source profiles remain outside generation until normalization, independent review and admission are complete. The role-qualified external Motor recipe is structurally candidate-ready only under explicit unknown-evidence inspection; its retained observations remain policy-ineligible because gate-network, capacitor, switching, loss, thermal, protection, and other application evidence is unresolved.
- Selected-class facts-V3 now resolves the observed MOSFET and TVS evidence failures without changing frozen V1/V2 behavior: MOSFET current and on-resistance retain their published ambient/case/junction temperature basis, pulse ratings require duration and duty cycle, TVS clamp/current/waveform facts share exact test conditions, pulse energy may remain explicit unknown, and snapback behavior is distinguished from avalanche ordering. Mixed-version Motor and Power recipes consume exact V2 primary/passive/shunt bytes and exact V3 TVS/MOSF bytes without projection. This is deliberately limited to `shared.n-channel-power-mosfet` and `motor.supply-tvs-diode`; it does not make the incomplete recipes ready or imply selected-part simulation fidelity. [ADR-0007](adr/0007-selected-class-facts-v3-condition-preservation.md) records the compatibility boundary and frozen schema hashes.
- Facts `3.1.0` is a separate, gate-driver-only contract for `motor.full-bridge-gate-driver`. It preserves bridge-voltage interface, external-versus-internal bias, timing/current-versus-resistance alternatives, dead-time control, high-side refresh, and optional current-sense semantics while every earlier schema and recipe identity remains unchanged. Catalog release `2026-08-25.16` includes the independently reviewed MIC4606 profile, and the additive mixed-version external-NMOS Motor recipe consumes it while keeping published typical timing and current observations non-guaranteeing. [ADR-0008](adr/0008-motor-gate-driver-facts-v3-1.md) records the architecture and admission boundary. Installed role-qualified successor `motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified@3.1.7` (`sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947`) preserves the exact direct xHO/xLO structure with no series-gate BOM line and separate exact bootstrap/VDD-local bindings over three reviewed 10 µF MLCC profiles. It replaces the three legacy supply projections only for `switch_node_only` drivers with interface-specific xHS bounds over the nominal 0 V-to-requested-bus excursion; all three pass for MIC4606, without proving recirculation undershoot, wiring overshoot, or parasitics. The successor also consumes the Diodes `3.0SMCJ33CAQ` TVS only at its exact source conditions: the 33 V stand-off observation passes at 25 °C but becomes unknown at the 40 °C browser and 50 °C M2 ambients, while the 53.3 V clamp observations remain source-conditioned static comparisons at 25 °C, 56.3 A, non-repetitive 10×1000 µs. Full application waveform, energy, overshoot, thermal, SOA, and TVS coordination remain unknown. The candidate still implements no VDD driver-bias rail, so the existing bias-source rule remains unknown and requires a real source inside the reviewed VDD range. Its nominal capacitor floors pass while effective/application capacitance, bootstrap equations and refresh, placement, bulk transient energy, gate-network behavior, switching, and simulation fidelity remain unknown. Its `3.1.6`, `3.1.5`, `3.1.4`, `3.1.3`, and `3.1.2` predecessors remain byte-frozen. Motor policy `sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0` keeps both browser explicit-inspection observations ineligible at 9 satisfied and 21 blocked required rules each.
- Facts `3.2.0` is an additive, integrated-H-bridge-only contract for `motor.integrated-h-bridge`. It preserves source roles for guaranteed, typical, board-specific, absolute-rating and protection-threshold current claims; separately couples timing and capacitance quantities to their evidence roles and applicability; and describes the current-regulation interface without inventing a configured current-limit equation. Current catalog release `2026-08-27.2` admits the independently reviewed DRV8262, DRV8876, and STSPIN840 profiles. Installed `motor.native.integrated-h-bridge.facts-v3-2@3.2.6` (`sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07`) preserves its frozen `3.2.5`, `3.2.4` (`sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84`), and `3.2.3` predecessors, retains the exact-profile DRV8876 logical mode result when PMODE is sampled high at device power-up, inherits the `motor.integrated.local-capacitance-nominal` pass for the exact DRV8876PWPR/C1608X7R1H104K080AA 100 nF nameplate match, and rejects all ten exact DRV8262 combinations during matching, before component materialization, Pareto ranking, or customization witness generation, because the recipe cannot represent its two distinct VM bypass positions plus separate charge-pump and regulator companion networks. The current retained browser observation is still STSPIN840 and ineligible. Admission/profile evidence, the logical mode map, nominal recommendation conformance, and the DRV8262 exact gate do not prove effective capacitance, derating, voltage suitability, placement, pin wiring, braking energy, current-regulation interaction, physical switching, selected-part simulation fidelity, or provider activation. [ADR-0009](adr/0009-motor-integrated-h-bridge-facts-v3-2.md) records the evidence-schema boundary and current installation consequence.
- Facts `3.3.0` is the additive integrated-synchronous-buck evidence contract for `power.integrated-synchronous-buck-regulator`. Catalog release `2026-08-24.14` admits the independently reviewed TPS54302 profile. Installed successor `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6` preserves the exact V3.3 structural materializer, selects one reviewed Bel `F1F2-0804-100M` 10 µH inductor and one quantity-two Murata `GRM32ER71E226KE15L` 22 µF output-capacitor line, and defines a separate ideal-PWM nominal LC-output behavioral scenario with two explicit capacitor instances. The browser preset remains low-current and exact-input with a 4.7 V to 5.3 V DC-regulation envelope. Strict generation excludes the one option; explicit inspection retains one observation at 9 pass, 13 unknown, 0 fail, but installed policy keeps it ineligible. Divider-resistor and request-envelope comparisons pass; the null load-transient target emits no rule. No broader regulator, passive physical, transient, selected-part/full-BOM simulation, provider, sourcing, eligibility, or commercial authority follows. [ADR-0010](adr/0010-power-integrated-buck-facts-v3-3.md) records the evidence boundary.
- Facts `3.4.0` is an additive power-inductor-only evidence contract. It preserves facts-V2 fields, admission requiredness, mounted geometry, and older schema bytes while allowing reviewed inductance characterized at switching frequency by test current, test voltage, or both. Catalog release `2026-08-25.15` admitted the independently reviewed Bel `F1F2-0804-2R2M` predecessor; current release `2026-08-27.2` also admits `F1F2-0804-100M`, and installed recipe 3.4.6 selects the latter at 10 µH. Its 12 A minimum saturation-current and 10 A minimum temperature-rise-current endpoints remain conditioned to 25 °C; nominal inductance is characterized only at 100 kHz / 0.25 V RMS and does not cover the 290 kHz production minimum or 400 kHz scenario. The quantity-two Murata capacitor line separately remains outside reviewed effective-capacitance, DC-bias, ESR, ripple-current, loss, current-sharing, and physical-model authority. The retained observation remains policy-ineligible and the behavioral golden proves no passive physical fidelity. [ADR-0011](adr/0011-power-inductor-facts-v3-4.md) records the compatibility and admission boundary.
- Additive Power reference-design evidence V1 binds the official TI `TPS54302EVM-716` guide and its published `PWR716-003` BOM/layout references as observation-only data (`sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb`). Its non-installed mapping recipe `power.reference-evidence.tps54302evm-716@1.0.0` (`sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2`) records relevant reference evidence against all 13 blocked rules but has `strictConstraintAuthority:false`. Matching public identity/BOM/layout-reference tokens yields only `asserted_reference_identity_unattested`, never physical-assembly qualification or application authority. The Table 1-2 400 kHz observation is condition-relevant only at 24 V. The EVM BOM's `TPS54302DDC` and Würth `7447714100` 10 µH identities differ from the installed `TPS54302DDCR` and Bel `F1F2-0804-100M` 10 µH candidate; nominal inductance matches but exact MPN/BOM identity does not, so the current recipe, policy/context/result identities, 9 pass / 13 unknown / 0 fail observation, and strict zero-candidate outcome are unchanged. The shared browser exposes this lane only from an exact authorized Power generation as fingerprint-bound transient metadata, outside canonical result/share/import bytes, candidate constraints, and the V3 decision; malformed or authority-expanding data is withheld. [ADR-0012](adr/0012-power-reference-design-evidence-v1.md) records the boundary.
- Installed recipe `power.native.external-fet-synchronous-buck.facts-v3@3.0.0` is external-primary-only and materializes an exact nine-line structural BOM with two schematic-only blocks, complete wiring, zero BOM nonrepresentations, no scenario, and `modelTier: unavailable`. It remains `releaseEligible:false` and `ready:false` because the reviewed external-controller count is zero and no V3 policy covers it. Its isolation is a readiness result, not a production-candidate, selected-part model, or simulation claim.
- DigiKey and Mouser execution remains disabled until credentials, issued rate limits and written display/cache/persistence/export/public-hosting terms are recorded. The shared V2 operation-permission validator and audit-only V1 boundary prevent accidental execution through the implemented service paths, but do not satisfy those external approval requirements. LCSC remains deferred until traction and a partnership application.
- Motor simulation is an averaged static operating-point bridge only. Synthetic integrated and external-NMOS native/WASM goldens now check their declared current windows and exact represented DC-loop closure, but startup, stall/current-limit and braking remain unavailable and no selected-part fidelity claim is made.
- Power steady-state and startup use a behavioral switching stage. Synthetic integrated and external-FET native/WASM goldens check pre-enable quiescence, non-vacuous output rise and exact passive feedback/load slopes, while P2 explicitly remains far below requested 12 V regulation. The current-production selected-passive golden binds the exact retained Bel observation and verifies deterministic native/WASM ideal-nominal primitive relations, but the profile's exact 100 kHz / 0.25 V RMS inductance characterization does not cover the 290 kHz production minimum or 400 kHz scenario. It therefore proves no passive physical fidelity, safe operating condition, regulation, control-loop, eligibility, ranking, or release claim. Load-step and line-step remain unavailable; no selected regulator/controller IC, full-BOM selected-part model, or full-waveform parity claim is made.
- A non-retained compatibility probe of TI's public, unencrypted [TPS54302 PSpice transient model](https://www.ti.com/lit/zip/slvmbl9) (`sha256:d06e58535f99c35ee5da259e68c09c471b819d00c2fe98d4d5d1da49ea730f77`) did not establish a shippable selected-part path. TI's fallback licence permits internal evaluation but not redistribution in this Apache-2.0 repository; native ngspice rejected the vendor `IF` syntax by default, PSpice-compatibility parsing still failed two bounded convergence probes, and the browser/WASM path has no equivalent compatibility configuration. No vendor model bytes are retained, and no compatibility, regulation or selected-part-fidelity claim is made.
- Local simulation receipts prove byte consistency, not independent execution attestation or physical-model fidelity; `attestation` remains `none` and simulation data cannot enter ranking.
- Bounded customized-target five-artifact authority is implemented after explicit installed regeneration for only the exact WeakMap-authorized source/target pair. It emits separately named, content-addressed electrical-BOM CSV, structural SVG, engineering-report HTML, structural KiCad, and behavioral Scenario SPICE; the last is available only for the exact default authored behavioral scenario when its existing netlist gate reports zero omissions. All five bind the exact source/target/context/policy-decision identities and exclusions, while ordinary exporters still reject the target-only projection as engineering-context unverified. They do not add ordinary-result, ranking, selected-part model, simulation-sample, physical-fidelity, commercial, external-KiCad-attestation, or release authority. The portable receipt intentionally remains a two-artifact BOM/SVG integrity envelope: it embeds the exact customized-result sidecar and fixed descriptors—kind, filename, MIME type, UTF-8 byte length, and SHA-256—but no payload, report, KiCad, or SPICE descriptor. Parse/self-hash is integrity-only, artifact replay is mandatory, and receipt verification cannot confer installed-context or production authority. Authenticated external KiCad execution attestation plus interactive open/save verification, selected-part physical-fidelity native/WASM coverage, broader analytic-estimate-to-simulation validation beyond the bounded behavioral circuit relations, manual assistive-technology/zoom/forced-colors review, an externally verified post-commit runtime artifact attestation, deployed offline/network behavior, and clean-checkout release verification remain open work. The static production-build audit does not execute the service worker or prove cache population/fallback, storage eviction, deployed routes/headers/CDN, browser-specific production behavior, DOM mutation, extensions, origin compromise or unshipped code. The environment-bound Chromium runtime contract does not replace deployed or cross-browser performance evidence. Canonical Motor and Power V2 requirements can already download, import, share, and restore strictly as untrusted input without generated or trusted state; strictly parsed electrical-result artifacts can download, share and restore without commercial data or trust promotion; V2 candidates can additionally download a hash-bound structural scenario-gate plan that contains no circuit graph, netlist, samples or absent trust context. The exact-regenerated retained integrated Motor and Power production observations add the context-bound browser downloads described above without enabling in-browser execution, Simulation CSV, Simulator handoff, selected-part fidelity, provider access, or commercial authority. Ordinary no-decision V2 engineering HTML, KiCad, Scenario SPICE, JSON, and share transfer do not record the V3 eligibility boundary; each customized-target artifact records the exact decision only as bound provenance, not independent eligibility evidence. Structural KiCad export is deterministic and parser-verified, and the fresh exact-byte external CLI QA passed both current fixtures under KiCad 10.0.5, but footprint mapping is intentionally unavailable, the report is self-reported and unattested rather than an authenticated persisted release artifact, and no interactive open/save-without-repair claim is made. The printable-report contract is deterministic, parser/byte verified and explicitly excludes commercial, simulation-attestation and physical-verification claims; no external PDF-rendering claim is made. External strict generation retains zero candidates; explicit inspection retains two deterministic but ineligible external-Motor observations, which support structural inspection and the bounded ideal-RDS(on) projection but confer no model, fidelity, eligibility, ranking, provider, commercial, or release authority.

Recommended next-session order:

1. Continue normalizing, independently reviewing and admitting the real-part dataset assigned by `docs/designer-v1-data-manifest.json`; preserve multi-manufacturer neutrality and evidence/license gates.
2. Complete the missing production topology/profile coverage reported by the deterministic readiness audit without routing fixture recipes into production.
3. Extend the bounded native-ngspice/browser-WASM evidence from the completed synthetic relations and current-production reviewed-nominal passive projection to a redistributable reviewed selected-semiconductor model, then justify the retained passives at their production operating conditions and complete full-BOM model coverage. Do not promote receipt integrity or nominal primitive parity into a physical-fidelity claim.
4. Complete provider authorization/terms work and only then enable bounded DigiKey/Mouser adapters through the existing hash-pinned policies. Keep LCSC as a post-traction partnership track.
5. Close external KiCad open/save; manual accessibility; authenticated post-commit workflow artifact attestation; deployed offline/network behavior; and reproducible clean-checkout gates before a release claim.

## 2. What WEBENCH actually is

WEBENCH is not primarily a schematic editor or generic SPICE frontend. It is a constrained design compiler:

1. Accept an application-specific requirement set.
2. Enumerate compatible devices and topology recipes.
3. Solve component values using equations and device constraints.
4. Match those values to a finite component database.
5. Reject invalid combinations and expose warnings/margins.
6. Rank multiple complete designs by efficiency, cost, size, and related objectives.
7. Let the user customize a candidate and recalculate it.
8. Run electrical/thermal simulation on the selected design.
9. Export the schematic, BOM, report, simulation data, and CAD artifacts.

TI's own material describes the sequence as **choose a part → create a design → analyze/optimize → simulate → export**, with BOM generation, operating values, charts, thermal and electrical simulation, and CAD/PDF output. It supports a broad set of power topologies, including buck, boost, SEPIC, flyback, LLC, PFC, and phase-shifted full bridge. The current [WEBENCH Power Designer](https://webench.ti.com/power-designer/switching-regulator?powerSupply=0&update=1), [official overview](https://webench.ti.com/help/PowerDesigner/Overview.htm), and [TI deep-dive guide](https://www.ti.com/lit/pdf/slyp708) are the baseline references.

TI has also publicly explained that WEBENCH's back end solves design equations and matches the calculated requirements to a finite component database. It is deterministic engineering software, not AI. See the [TI engineer explanation](https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/699849/webench-tools-ucc28c42-custom-part-numbers).

This distinction matters: putting a chatbot in front of ngspice would not be a WEBENCH competitor. The defensible open-source contribution is the audited compiler, recipes, component facts, constraint explanations, and reproducible ranking.

## 3. Market and open-source research

Research was checked against current public product pages on 2026-08-23.

### Closed tools

| Product | What it covers | Why it does not solve this goal |
| --- | --- | --- |
| [TI WEBENCH](https://www.ti.com/tool/WEBENCH-CIRCUIT-DESIGNER) | Broad power-supply synthesis, optimization, simulation, BOM, reports, and CAD output | Closed and TI-centered; TI's HTML transition explicitly deprecated Motor Drivers in the [support record](https://e2e.ti.com/support/tools/simulation-hardware-system-design-tools-group/sim-hw-system-design/f/simulation-hardware-system-design-tools-forum?keymatch=TINA-TI&pifragment-322359=618&serp=4&tisearch=e2e-sitesearch) |
| [onsemi WebDesigner+](https://www.onsemi.com/design-tools/) | Requirement-driven power designs, topology comparison, schematic, operating values, charts, BOM, footprint/price data, PDF/share | Closed and vendor-specific |
| [ADI Power Studio Designer](https://www.analog.com/en/resources/evaluation-hardware-and-software/embedded-development-software/power-studio-designer.html) | Guided device-level designs, optimized passives/FETs, real-time loss/thermal/loop calculations, BOM, LTspice/SIMPLIS handoff | Closed, account-gated, and ADI-specific |
| [MPS DC/DC Designer](https://www.monolithicpower.com/en/design-tools/design-tools.html) | Passive sizing, efficiency/ripple, BOM/area, transient and frequency-domain analysis | Closed and MPS-specific |
| [Power Integrations PI Expert](https://www.power.com/design-support/pi-expert) | Automatic power-conversion designs, especially isolated supplies; transformer and winding reports, BOM, layout advice | Closed and vendor-specific |
| [Renesas PowerCompass](https://www.renesas.com/en/software-tool/powercompass-multi-rail-design-tool) | Multi-rail architecture, part suggestions, cost/efficiency/temperature estimates, schematic and BOM | Closed and limited to supported vendor parts |
| [PowerEsim](https://www.poweresim.com/manual/Help/HTML/V1/EN/Introduction.jsp) | Broad web SMPS synthesis, magnetics, loss/thermal, waveforms, BOM, DVT and optimization | Free basic access but closed source; its [FAQ](https://www.poweresim.com/about/faq.jsp) describes a sponsorship model and sponsor-specific component visibility |
| [Toshiba Online Circuit Simulator](https://toshiba.semicon-storage.com/us/semiconductor/design-development/online-circuit-simulator-introduction.html) | Fixed H-bridge brushed-motor and three-phase SPMSM simulations with motor parameters and MOSFET comparison | The closest current motor-specific browser tool found, but login-gated, fixed-topology, and Toshiba-specific |

### Open-source projects

No mature open-source project was found that combines requirement capture, topology/device enumeration, component sizing, constraint checking, ranked complete circuits, browser simulation, BOM, evidence, and EDA export.

The useful projects are pieces of that system:

| Project | Useful contribution | Missing layer |
| --- | --- | --- |
| [OpenMagnetics](https://github.com/OpenMagnetics) / [PyOpenMagnetics](https://github.com/OpenMagnetics/PyOpenMagnetics) | Strong MIT-licensed magnetic component modeling, losses, thermal/parasitics, core/material/wire databases, converter APIs, and SPICE generation | Not a complete browser circuit-design product; assess as a later isolated-topology dependency, not a V1 dependency |
| [PEA](https://github.com/FulongLi/AIPE-Power-Electronics-Design-Agent) | MIT-licensed converter calculators and Pareto optimization | Early research-scale project; no production schematic/BOM/evidence workflow and no motor-driver module |
| [CircuitSynth](https://github.com/circuit-synth/circuit-synth) | MIT-licensed code-defined circuit generation, KiCad-oriented workflows, lookup and analysis tooling | General circuit authoring, not an application-specific design compiler |
| [eSim](https://github.com/FOSSEE/eSim) | Open KiCad/ngspice EDA environment | Manual design and simulation, not requirements-to-candidates synthesis |
| [motulator](https://github.com/Aalto-Electric-Drives/motulator) | MIT-licensed motor-drive and control-system simulation | System/control simulation rather than driver-circuit synthesis and BOM generation |
| [ARCS](https://github.com/tusharpathaknyu/ARCS) | Research prototype for topology/value generation and SPICE validation | Immature, sparse adoption, and no clear production-ready licensing/data/evidence contract |

### Market conclusion

The gap is real, but it is narrower than “no engineering calculators exist.” The missing product is an **open, vendor-neutral, evidence-backed design compiler connected to a real circuit simulator and EDA exports**. onsemi's own description says its tool selects the optimum [onsemi products](https://www.onsemi.com/PowerSolutions/content.do?id=20248), while PowerEsim's [FAQ](https://www.poweresim.com/about/faq.jsp) says sponsors can exclude competitor parts. Open source makes a different governance model possible: universal eligibility, public evidence, and inspectable ranking. Robonyx already supplies the simulator, typed circuit document, reviewed model-package pattern, waveform viewer, URL sharing, and local-first browser application. The new work is the design-automation layer and its open catalog.

## 4. Product V1 definition

### V1 user promise

A user opens the website without a Robonyx account, chooses **Motor Driver** or **Buck Converter**, enters electrical and sourcing requirements, and receives multiple complete circuit candidates. They can constrain the BOM to supported live distributors, reject obsolete/out-of-stock/long-lead-time parts, see why each candidate passed, compare tradeoffs, customize compatible parts, simulate named operating scenarios, and export the result. V1 targets DigiKey and Mouser for live sourcing and provides LCSC MPN search links; live LCSC sourcing is deferred until the product has traction and can apply for a partnership with evidence.

### V1 common workflow

1. **Requirements** — application-specific form with units, validation, presets, and advanced fields.
2. **Sourcing policy** — build quantity, region/currency, permitted distributors, single-distributor or mixed sourcing, lifecycle policy, minimum stock, maximum lead time, packaging, and snapshot freshness.
3. **Generate** — deterministic electrical enumeration and analytic evaluation; live sourcing is optional, and the electrical engine still works without a network call.
4. **Source** — enrich electrically valid parts with current distributor offers, apply hard sourcing constraints, and regenerate with valid alternatives where required.
5. **Compare** — Pareto-oriented candidate table plus named recommendations such as Highest Efficiency, Lowest Cost, Smallest, Coolest, Lowest BOM Cost, and Most Buildable.
6. **Inspect** — schematic, BOM, operating values, loss breakdown, constraint margins, warnings, assumptions, source evidence, stock, lifecycle, lead time, price breaks, and retrieval time.
7. **Customize** — replace only components proven electrically and commercially compatible under the active policy, then recalculate.
8. **Simulate** — run named ngspice scenarios on the selected design in the existing Web Worker/WASM engine.
9. **Export/share** — Robonyx design JSON and URL, BOM CSV, SPICE netlist, simulation CSV, SVG schematic, printable report, and KiCad schematic.

### Explicit V1 non-goals

- BLDC, PMSM, induction motors, FOC, commutation firmware, encoder/control-loop design, or inverter PCB layout.
- Stepper motor drivers.
- Boost, buck-boost, SEPIC, flyback, LLC, PFC, multi-rail supplies, or isolated magnetics.
- Automated PCB routing or guaranteed EMC/functional-safety compliance.
- Checkout, order placement, Robonyx accounts, cloud projects, or collaboration. The deterministic electrical engine remains local; live sourcing uses an optional open-source service because distributor credentials cannot be shipped to the browser.
- Scraping vendor/distributor websites.
- Redistributing vendor PDFs, vendor-owned SPICE models, or copied CAD assets without compatible permission.
- AI-generated formulas, constraints, component facts, or circuit approvals.

## 5. Module A — Motor Driver Designer

### Supported application

One brushed-DC motor driven bidirectionally by one full H-bridge.

Validated V1 design envelope:

- Motor supply: 4.5 V to 60 V maximum input.
- Continuous motor current: 0.1 A to 10 A.
- Stall/peak current: up to 30 A.
- Logic interface: 3.3 V or 5 V.
- PWM: 1 kHz to 100 kHz, further limited by each candidate device.
- Ambient temperature: -20 °C to 85 °C.

Do not silently extrapolate beyond this envelope. The UI may preserve out-of-range inputs, but generation must stop with a clear unsupported-range result.

### Topology recipes

V1 supports exactly two topology families:

1. **Integrated H-bridge** — driver IC with integrated power FETs.
2. **External-FET H-bridge** — full-bridge gate-driver IC plus four N-channel MOSFETs.

The initial reviewed design library must contain enough data to make both families useful:

- At least 8 integrated H-bridge profiles across at least 3 manufacturers.
- At least 6 full-bridge gate-driver profiles across at least 3 manufacturers.
- At least 15 suitable power-MOSFET profiles across at least 3 manufacturers and the required voltage/current classes.
- Reviewed passive families for shunts, gate resistors, bootstrap parts, decoupling, bulk capacitance, and protection.

These are **design profiles**, not necessarily redistributed vendor SPICE models. A profile holds only the sourced facts and equations needed for constraint checking and analytic estimates. Simulation may use an independently authored behavioral macro-model, an already admitted Robonyx model, or an explicitly imported local vendor model.

### Required inputs

Basic form:

- Supply minimum, nominal, and maximum voltage.
- Continuous/rated motor current.
- Stall/peak motor current.
- PWM frequency.
- Logic voltage.
- Ambient temperature.
- Operating mode: forward/reverse, coast, brake.
- Optimization preference: balanced, efficiency, cost, size, or temperature.

Advanced form:

- Motor winding resistance and inductance.
- Back-EMF constant or speed constant and target speed.
- Required loss operating point: duty cycle, load current, whether that current is the continuous rating or user-provided, and the load-profile kind. V1 supports a declared steady-state point; it does not invent a representative duty or load.
- Current-limit target.
- Maximum allowed junction temperature.
- Allowed package/assembly constraints.
- Cost quantity and currency for comparing stored price snapshots.

If winding resistance is absent, it may be estimated as nominal voltage divided by stall current, but the result must be labeled **estimated**. Inductance and back-EMF must never be invented invisibly: require them for applicable transient scenarios or use a visible, user-selectable generic motor preset.

### Generated circuit contents

Every motor candidate must generate a connected, editable circuit containing:

- H-bridge driver and four external MOSFETs where applicable.
- Local ceramic and bulk supply capacitance.
- Bootstrap components where required.
- Gate resistors and gate-source pull-downs where required.
- Current shunt and sense filtering when the chosen driver/requirement uses current sensing.
- Supply clamp/TVS recommendation when the evidence profile supports one.
- Motor behavioral load with parameters and provenance/estimate status.
- Logic/PWM input sources suitable for simulation.
- Named measurement probes for supply current, motor current, motor voltage, FET losses, and relevant junction-temperature estimates.

### Analytic checks and metrics

Hard constraints must cover, where applicable:

- Supply operating range and absolute-maximum voltage margin.
- Continuous, peak, and current-limit capability.
- Logic-high/low compatibility.
- PWM-frequency and minimum pulse-width limits.
- Gate-driver source/sink current, gate charge, transition time, and switching-loss bounds.
- Bootstrap voltage/capacitance and high-side on-time constraints.
- MOSFET VDS, pulsed current, RDS(on) at the actual gate voltage, and package thermal limits.
- Driver and MOSFET junction temperature using an explicit board/thermal assumption.
- Shunt dissipation and sense-amplifier range.
- Decoupling and bulk-capacitance minimums from named rules.
- Dead-time/shoot-through constraints when supported by the driver.

Report, but do not falsely certify, unsupported checks such as avalanche robustness, complete SOA, EMC, transient supply overshoot, and functional safety. Missing evidence must produce an `unknown` result, not a pass.

Candidate metrics must include:

- Predicted efficiency and total loss at the stated operating point.
- Driver, conduction, switching, shunt, and passive loss breakdown.
- Estimated junction temperatures and thermal margins.
- Voltage, current, PWM, and logic margins.
- BOM line count and component count.
- Board-area proxy from package/courtyard data when available.
- Cost at the selected quantity only when a dated source snapshot exists.
- Count of warnings, estimates, and unknown checks.

### Motor simulation scenarios

Generate named simulations instead of exposing a blank SPICE panel:

1. `pwm_loaded_steady_state` — current ripple, motor voltage, supply current, switching behavior.
2. `startup` — only when motor R/L/back-EMF parameters are available.
3. `stall_or_current_limit` — peak current and protection behavior using a bounded simulation interval.
4. `fast_decay_brake` — braking current transient where the selected driver supports it.

Analytic generation must work even if a simulation model is unavailable. The candidate must disclose simulation coverage as `reviewed`, `behavioral`, `user_imported`, or `unavailable`.

## 6. Module B — Power Designer: first direct WEBENCH slice

### Supported application

One non-isolated, single-output step-down DC/DC converter.

Validated V1 design envelope:

- Input: 5 V to 60 V, with minimum/nominal/maximum values.
- Output: 0.8 V to 24 V and strictly below minimum input.
- Output current: 0.1 A to 10 A.
- Ambient: -20 °C to 85 °C.

### Topology recipes

V1 supports exactly:

1. **Integrated-FET synchronous buck regulator.**
2. **Synchronous buck controller with external N-channel MOSFETs.**

The first reviewed library must include:

- At least 12 integrated buck-regulator profiles across at least 3 manufacturers.
- At least 6 external-FET buck-controller profiles across at least 3 manufacturers.
- Inductor, capacitor, resistor, and suitable power-MOSFET design profiles with sourced operating data.

This makes the product vendor-neutral and demonstrates the direct WEBENCH workflow without pretending to cover all of WEBENCH's topologies.

### Required inputs

- Input minimum, nominal, and maximum voltage.
- Output voltage and maximum current.
- Ambient temperature.
- Preferred switching-frequency range or automatic selection.
- Maximum output ripple and optional transient target.
- Optimization preference.
- Advanced thermal, package, height, area, and cost constraints.

### Generated circuit contents

- Regulator/controller and power FETs where applicable.
- Inductor.
- Input and output capacitor banks using effective capacitance at bias when the profile has that evidence.
- Feedback divider.
- Compensation network for externally compensated devices.
- Bootstrap, UVLO, soft-start, current-sense, and snubber parts only when required by the recipe/device.
- Named sources, loads, probes, and simulation commands.

### Analytic checks and metrics

- Input/output range, duty-cycle, on/off-time, and switching-frequency limits.
- Peak/valley inductor current, saturation margin, RMS current, ripple, copper/core loss where evidence exists.
- Input/output capacitor ripple current, ESR, effective capacitance, and voltage margin.
- FET conduction, switching, and gate-drive losses.
- IC/package loss and junction-temperature estimate.
- Current-limit and startup/headroom checks.
- Feedback accuracy and resistor dissipation.
- Loop crossover/phase margin only for recipes with sufficient control-model evidence; otherwise mark unavailable.
- Predicted efficiency, loss breakdown, ripple, thermal margins, BOM count, area proxy, and dated price snapshot.

### Power simulation scenarios

1. `steady_state` — ripple, switching nodes, currents, and efficiency comparison.
2. `startup` — output ramp and current-limit behavior where the model supports it.
3. `load_step` — transient response for devices with adequate behavioral/switching models.
4. `line_step` — optional when the selected model and recipe support it.

## 7. Shared architecture

Preserve the current browser architecture and isolate volatile sourcing data from stable engineering facts:

```text
requirements + SourcingPolicy
          │
          ├──────── sourcing-service ───── enabled provider APIs
          │                 │
          │          OfferSnapshot[]
          │                 │
          ▼                 ▼
design-schema ─────── sourcing-schema
          │                 │
          ▼                 ▼
design-engine ◄──── sourcing-engine filters/metrics
          │
          ├── design-library (stable recipes + engineering facts)
          ▼
ranked, buildable DesignCandidate[]
          │
          ├── design-export (BOM/report/KiCad/SPICE)
          └── circuit-schema → existing sim-engine Worker → ngspice WASM
```

The design engine consumes a normalized, immutable `OfferSnapshot`; it never calls a distributor directly. Without a snapshot it produces electrically valid candidates with sourcing status `unavailable`. Stock, price, and lead time never become permanent fields in the engineering component profile.

### New packages

Create these packages; do not put the compiler into `apps/web/src/main.ts`:

```text
packages/design-schema/
  src/request.ts
  src/candidate.ts
  src/evidence.ts
  src/index.ts
  test/

packages/design-engine/
  src/generate.ts
  src/enumerate.ts
  src/solve.ts
  src/match.ts
  src/check.ts
  src/score.ts
  src/hash.ts
  test/fixtures/

packages/design-library/
  schema/
  recipes/motor/brushed-dc/
  recipes/power/buck/
  parts/drivers/
  parts/regulators/
  parts/controllers/
  parts/mosfets/
  parts/passives/
  sources/
  validate-library.mjs

packages/design-export/
  src/bom-csv.ts
  src/report.ts
  src/kicad.ts
  src/spice.ts
  test/fixtures/

packages/sourcing-schema/
  src/policy.ts
  src/offer.ts
  src/snapshot.ts
  src/index.ts
  test/

packages/sourcing-engine/
  src/filter.ts
  src/normalize.ts
  src/bom-metrics.ts
  src/index.ts
  test/fixtures/

apps/sourcing-service/
  src/providers/digikey.ts
  src/providers/mouser.ts
  src/cache-policy.ts
  src/index.ts
  test/

apps/web/src/features/designer/
  DesignerRoute.ts
  RequirementsForm.ts
  CandidateTable.ts
  CandidateDetail.ts
  ConstraintPanel.ts
  CustomizePanel.ts
  SimulationScenarios.ts
  sourcing/SourcingPolicyForm.ts
  sourcing/OfferTable.ts
  sourcing/BomAvailability.ts
```

Use the repo's existing conventions and test runner. If the current application cannot support route-level code cleanly, introduce only the minimum route/state seam needed to mount `DesignerRoute`; do not refactor unrelated simulator UI.

### Core documents

The Milestone 0 packages are the source of truth for exact serialized fields. The sketch below summarizes the frozen separation; incompatible changes require a schema-version decision and migration:

```ts
type DesignRequest = {
  schemaVersion: number;
  application: "motor.brushed-dc" | "power.buck";
  requirements: MotorRequirements | BuckRequirements;
  objective: "balanced" | "efficiency" | "bom_cost" | "area" | "temperature" | "availability" | "lead_time";
  constraints: UserConstraints;
  sourcing?: SourcingPolicy;
  libraryVersion: string;
};

type DistributorId = string; // stable ID validated against the provider registry
type ManufacturerId = string; // stable normalized manufacturer registry key

type ManufacturerPartIdentity = {
  manufacturerId: ManufacturerId;
  manufacturerPartNumber: string; // exact orderable MPN; not globally unique without manufacturerId
};

type SourcingPolicy = {
  schemaVersion: 1;
  distributors: DistributorId[];
  mode: "any_selected" | "single_distributor";
  buildQuantity: number;
  region: string;
  currency: string;
  allowedLifecycle: Array<"active" | "nrnd" | "last_time_buy" | "unknown">;
  minimumStock?: number;
  maximumLeadTimeDays?: number;
  allowBackorder: boolean;
  allowMarketplace: boolean;
  packaging?: Array<"cut_tape" | "reel" | "tray" | "tube" | "bulk">;
  maximumSnapshotAgeSeconds: number;
};

type DistributorOffer = {
  distributor: DistributorId;
  distributorSku: string;
  part: ManufacturerPartIdentity;
  region: string;
  currency: string;
  packaging: string;
  marketplace: boolean;
  backorderAvailable: boolean;
  stockQuantity?: number;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  leadTimeDays?: number;
  leadTimeKind?: "manufacturer" | "estimated_ship" | "factory" | "unknown";
  lifecycle: "active" | "nrnd" | "last_time_buy" | "obsolete" | "unknown";
  lifecycleSource: "manufacturer" | "distributor" | "unknown";
  lastTimeBuyAt?: string;
  priceBreaks: Array<{ quantity: number; unitPrice: number }>;
  productUrl: string;
  retrievedAt: string;
};

type ProviderError = {
  code: "timeout" | "rate_limited" | "authentication" | "upstream" | "invalid_response" | "unknown";
  message: string;
  retryable: boolean;
};

type OfferSnapshot = {
  schemaVersion: number;
  id: string;
  provider: DistributorOffer["distributor"];
  requestedParts: ManufacturerPartIdentity[];
  retrievedAt: string;
  expiresAt: string;
  persistence: "ephemeral" | "user_local" | "exportable";
  status: "complete" | "partial" | "provider_error";
  errors: ProviderError[];
  offers: DistributorOffer[];
  contentHash: string; // recomputed SHA-256 of the documented canonical payload
};

type EvidenceRef = {
  sourceId: string;
  locator: string;          // table, page, equation, or authored-rule identifier
  retrievedAt?: string;
  contentHash?: string;
  licenseNote: string;
};

type ConstraintResult = {
  ruleId: string;
  status: "pass" | "fail" | "warning" | "unknown";
  actual?: Quantity;
  limit?: Quantity;
  margin?: Quantity;
  explanation: string;
  evidence: EvidenceRef[];
};

type DesignCandidate = {
  schemaVersion: number;
  id: string;               // stable content-derived ID
  requestHash: string;
  recipeId: string;
  libraryVersion: string;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetrics;
  sourcing?: CandidateSourcingMetrics;
  simulationCoverage: SimulationCoverage[];
  circuit: CircuitDocument;
  warnings: string[];
};
```

All physical values must be stored in canonical SI units with display units kept separately. Floating-point comparisons must use named tolerances. Do not use formatted strings as source-of-truth values.

Every persisted Designer and Sourcing object is recursively closed: runtime validators reject undeclared fields rather than preserving them. Adding a persisted field requires an explicit schema-version decision and migration where prior documents exist. Credentials, raw provider responses, offer snapshots and electrical engineering facts cannot cross a contract boundary as extra properties. Every component/sourcing join uses `ManufacturerPartIdentity`; an MPN string by itself is not a valid global identity. Snapshot timestamps require RFC 3339 with an explicit timezone, and snapshot validation recomputes `contentHash` from the canonical payload.

### Recipe contract

Each recipe must provide:

- Supported application and validated envelope.
- Required and optional requirement fields.
- Candidate device predicate.
- Named equations for component sizing and derived operating points.
- Hard constraints, warnings, and unknown-evidence policy.
- Component requirements and matching tolerances.
- Circuit-template builder.
- Supported simulation scenarios.
- Scoring inputs, never an opaque final score.
- References and review state.
- Version and content hash.

Recipes are code plus data, not arbitrary executable content downloaded at runtime.

## 8. Compiler behavior

Implement generation as a stable pipeline:

1. **Normalize** units and derive only explicitly permitted values.
2. **Enumerate** compatible recipe/device combinations.
3. **Solve** ideal component values and operating points.
4. **Match** to real component profiles using voltage/current/thermal/value tolerances.
5. **Check** all hard constraints; keep rejection reasons for diagnostics.
6. **Estimate** losses, temperature, ripple, cost, and area with evidence status.
7. **Deduplicate** electrically equivalent BOMs.
8. **Pareto-prune** candidates that are worse on every available objective.
9. **Rank** remaining candidates with a documented objective profile and stable tie-breakers.
10. **Materialize** full `CircuitDocument`s only for the surviving candidates.
11. **Simulate on demand** for the selected candidate; optional batch verification may simulate the top few designs in tests.

Rules:

- The same request and library version must produce byte-stable normalized results and the same ordering.
- A missing fact can never become a pass by default.
- Hard failures are never hidden by a high score.
- Metrics with unknown data are never replaced by zero and cannot improve a candidate's rank; show the candidate as incomparable on that objective or apply a documented evidence-confidence rule.
- The UI must expose rejected-device reasons for debugging and trust.
- Ranking must show raw metrics and the active weighting; provide the Pareto set before a single “best” answer.
- SPICE is a validation layer, not a replacement for design equations and constraint checks.

## 9. Data, evidence, licensing, and pricing

### Open component catalog neutrality contract

The catalog is the central strategic asset. The promise is **open to every manufacturer**, not the premature claim that the first release already contains every manufacturer.

Enforce these rules in code and project governance:

- Any component is eligible if its profile passes the same public schema, evidence, licensing, and validation requirements.
- Manufacturer identity is display/filter metadata. It is never a positive or negative scoring input.
- Electrical performance, verified operating limits, thermal behavior, cost snapshot, package/area, availability snapshot, evidence coverage, and user constraints are the only permitted ranking inputs.
- A missing fact cannot make a part look better than a fully characterized competitor.
- Manufacturer, distributor, community, and maintainer submissions all use the same pull-request/review path.
- Vendor-submitted facts are labeled by source and independently reviewed to the same standard as maintainer-authored profiles.
- Sponsorship or funding cannot purchase inclusion, exclusion, ranking weight, default selection, or faster evidence approval. Funding relationships must be disclosed publicly.
- Users may allow, prefer, or exclude manufacturers explicitly, but the default is all eligible manufacturers with no preferred brand.
- Rejected parts retain machine-readable reasons so users and manufacturers can correct missing evidence or real constraint failures.
- Catalog releases are content-addressed and versioned independently from application releases; old designs pin the exact catalog version.

Publish a generated coverage report for every catalog release:

- Eligible and reviewed part counts by component class and manufacturer.
- Coverage across voltage, current, power, package, temperature, and application ranges.
- Evidence and simulation tier counts.
- Missing-fact and stale-price counts.
- Manufacturers present in source data but not yet eligible, with non-promotional exclusion reasons.

Do not advertise “all manufacturers” until the report supports it. Advertise “vendor-neutral and open to all manufacturers,” then show the actual coverage.

Neutrality must have automated regression tests:

- Anonymizing manufacturer display names while keeping component facts unchanged leaves filtering, Pareto membership, scores, and ordering unchanged.
- Two electrically/commercially identical profiles tie through a documented stable component-ID rule, not a vendor preference.
- Adding a new manufacturer profile can affect results only through its facts, evidence status, or explicit user filter.
- Missing metrics never produce a better objective score than a known valid value.
- Default generation searches every eligible manufacturer in the pinned catalog.

Follow the repository's existing safe publication model:

- Application code and authored documentation remain Apache-2.0.
- Authored design-data packages use a permissive license consistent with the current model packages.
- Store public electrical facts, normalized derived values, source URLs, locators, retrieval dates, hashes, and review status.
- Do not commit vendor PDFs or proprietary vendor SPICE models.
- A source URL is evidence; it is not permission to redistribute the source artifact.
- Independently authored behavioral models must say what they approximate and which tests bound them.
- User-imported models remain local to the browser unless the user deliberately exports them.

For KiCad export, generate the documented text-based `.kicad_sch` format using the [official KiCad file-format documentation](https://dev-docs.kicad.org/en/file-formats/index.html). Do not copy KiCad's official symbols into the repository without handling their [CC BY-SA 4.0 license](https://gitlab.com/kicad/libraries/kicad-symbols/-/blob/master/LICENSE.md). Prefer small project-authored symbols in the generated schematic and standard footprint identifiers.

### Live distributor sourcing

Live sourcing is a V1 feature, but the electrical engine cannot depend on it. The first live targets are DigiKey and Mouser:

- DigiKey's [Product Information V4](https://developer.digikey.com/products/product-information-v4/productsearch/productdetails?prod=true) exposes quantity, product status, discontinued/EOL flags, last-buy date, manufacturer lead weeks, packaging and pricing. It requires OAuth and application credentials.
- Mouser's [Search API](https://www.mouser.com/en/api-search/) exposes availability, lifecycle, MOQ/order multiples, lead time, suggested replacements and price breaks. It requires an issued API key and is rate limited.

Therefore:

- Never embed provider credentials in the browser or repository.
- Ship `apps/sourcing-service` as open-source optional infrastructure with server-side credentials, provider-specific rate limiting and an auditable cache policy.
- The hosted Robonyx deployment enables a provider only after obtaining credentials and confirming that the intended display, caching and user access comply with that provider's terms.
- Do not scrape distributor sites or build repository catalog dumps from these APIs.
- Normalize only the fields needed for the active design/BOM request and retain them only for the provider-permitted lifetime.
- Provider rules live in a versioned policy manifest: authentication mode, rate limit, cache TTL, display attribution, persistence, share/export permission and deletion behavior.

Support three data modes:

1. **Offline:** electrical generation works from the reviewed component catalog; sourcing metrics are unavailable.
2. **Live:** the sourcing service requests current offers for the eligible MPN set and returns short-lived normalized snapshots.
3. **Pinned local:** where provider terms permit, the user's browser stores the snapshot ID/hash and normalized offer data with the design for reproducibility. Restricted provider data is re-fetched rather than embedded in a public share URL.

Sourcing is evaluated after electrical hard constraints but before final ranking. If a required component fails the sourcing policy, the engine tries the next electrically valid component combination. It must never replace a component in the BOM without rerunning the electrical checks.

Candidate-level sourcing metrics:

- `buildableQuantity`: complete assemblies possible from the selected offers, using quantity per BOM line and order multiples.
- `extendedBomCost`: actual purchase quantity after MOQ/order-multiple rounding and applicable price breaks.
- `bottleneckPart`: the line limiting buildable quantity or lead time.
- `maximumLeadTimeDays` and its exact source/meaning; manufacturer lead time is not presented as a guaranteed delivery date.
- Counts of active, NRND, last-time-buy, obsolete and unknown lifecycle lines.
- Distributor split count and whether one selected distributor can supply the complete BOM.
- Snapshot age, expiration and stale/partial/provider-error status.

`obsolete` is excluded by default. `unknown` remains visibly unknown and is never silently treated as active. If distributors disagree about lifecycle or stock, retain each observation and show the conflict rather than collapsing it to a false consensus.

### Deferred LCSC partnership

LCSC is strategically important, but do not apply for access or implement a speculative adapter in V1. Its [API](https://www.lcsc.com/docs/openapi/index.html) provides real-time item search, stock filtering and pricing, while the published [application process and terms](https://www.lcsc.com/docs/) require partner review and restrict bulk capture/re-hosting.

V1 behavior:

- Show a clearly labeled LCSC search link for each exact MPN; do not claim stock, price, lifecycle or lead-time knowledge.
- Do not scrape LCSC, commit LCSC responses, share one unofficial key, or ship a dormant adapter that has never been authorized.
- Keep the provider registry, offer schema and sourcing engine generic so an approved LCSC adapter can be added without changing application recipes or saved-design schemas.
- Measure only privacy-respecting traction signals needed for a later application: public site usage, completed design generations, sourcing-feature use and outbound LCSC MPN-link clicks. Do not collect circuit inputs or BOM contents without explicit consent.

Apply for an LCSC partnership after the public tool can present:

- A working product and public repository.
- 30/90-day usage and completed-design trends.
- Evidence of LCSC-directed user demand, such as aggregate outbound MPN-search clicks.
- A precise query-on-demand architecture: electrically pre-filter locally, query only a bounded exact-MPN set, short retention, attribution and no bulk mirror.
- Estimated request/order-referral volume and a proposed cart/deep-link cooperation model.
- The exact display, cache, export and public-user permissions requested in writing.

Once LCSC approves the intended use, implement and release its adapter as a normal provider-registry addition with the same sourcing contract tests.

## 10. UI requirements

### Entry screen

- Two application cards: Brushed-DC Motor Driver and Buck Converter.
- Short statement: local-first, no account, deterministic engineering estimates.
- Example presets that fill the form but remain editable.

### Requirements screen

- Basic inputs first; advanced assumptions collapsed.
- Unit selectors with canonical conversion.
- Immediate validation of impossible combinations.
- A visible “What we will assume” panel before generation.
- Sourcing mode: Offline, Any Selected Distributor, or One Distributor for Entire BOM.
- Distributor selectors for enabled live providers, initially DigiKey and Mouser, with connection/availability state; LCSC appears only as an MPN search link until partnership approval.
- Build quantity, region/currency, lifecycle policy, minimum stock, maximum lead time, packaging, marketplace and backorder controls.
- A clear warning that stock, lead time and pricing are observations at the displayed retrieval time, not guarantees.

### Results screen

Default to a comparison table, not a single magic answer. Columns:

- Candidate/topology.
- Primary IC/controller.
- Efficiency.
- Total loss and hottest estimated junction.
- Cost snapshot and date.
- Area proxy.
- Component count.
- Warning/unknown count.
- Buildable quantity for the requested BOM and the bottleneck part.
- Distributor coverage/split count, lifecycle risk and maximum observed lead time.

Add named badges only after calculation: Highest Efficiency, Lowest BOM Cost, Most Buildable, Shortest Lead Time, Smallest, Coolest, Balanced. Let users pin up to three candidates for comparison.

### Candidate detail

Tabs or equivalent views:

- Schematic.
- Operating values and loss breakdown.
- BOM.
- Constraints/margins.
- Simulation scenarios and waveforms.
- Sourcing offers, price breaks, stock, lifecycle, lead time, attribution and retrieval time per BOM line.
- Sources, assumptions, model coverage, and export.

Each failed/warning/unknown check must explain the rule in plain language and show the values involved.

### Customization

Only offer replacements that pass the current electrical and sourcing hard filters. Recalculate and rerun sourcing metrics immediately after a change. Preserve a reset-to-generated action and show whether the customized result remains inside the reviewed recipe envelope. A Refresh Offers action updates only the sourcing snapshot and then reranks; it never changes electrical facts or silently edits the selected circuit.

## 11. Implementation sequence and acceptance gates

The Motor and Power modules should be developed in parallel. They share a short foundation phase, then proceed through separate directories, fixtures, data manifests, recipes, circuit builders, and UI adapters. V1 ships only when both tracks and the shared integration gates pass.

Do not polish the UI before golden fixtures make the engine deterministic.

```text
Milestone 0: contracts/fixtures
              │
Milestone 1: generic compiler
              │
      ┌───────┼────────┬───────────┐
      ▼       ▼        ▼           ▼
 Motor A1  Power B1  Shared C1  Sourcing D1
      │       │       UI/exports      │
 Motor A2  Power B2     │         Sourcing D2
      │       │         │             │
 Motor A3  Power B3     │             │
      └───────┼─────────┴─────────────┘
              ▼
Milestone 2: integration
              │
Milestone 3: V1 release audit
```

### Parallel ownership model

Use separate worktrees or branches for the parallel tracks. Assign ownership before implementation begins:

| Track | Owns | Must not change unilaterally |
| --- | --- | --- |
| **Foundation** | `packages/design-schema`, generic `packages/design-engine`, design-library schemas/validator, generic `packages/design-export`, shared candidate UI contract | Application equations or application-specific part facts |
| **Motor** | `recipes/motor/**`, motor-driver profiles, motor fixtures/tests, motor circuit builders, `features/designer/motor/**` | Buck recipes/data or shared type signatures |
| **Power** | `recipes/power/**`, regulator/controller/inductor profiles, buck fixtures/tests, buck circuit builders, `features/designer/power/**` | Motor recipes/data or shared type signatures |
| **Integration/data review** | Shared MOSFET/passive profiles, one-MPN-per-file ownership map, shared UI implementation, exports, cross-module regression and release audit | Electrical facts without the required evidence/review state |
| **Sourcing** | `packages/sourcing-*`, `apps/sourcing-service`, provider adapters, synthetic offer fixtures and sourcing UI components | Engineering component facts, application equations, or provider data outside the policy manifest |

The checked-in data manifest assigns every shared MPN to one track or reviewer so two tracks never edit the same part profile. A change to a shared schema or compiler interface requires a version bump, migration where applicable, and contract tests for both Motor and Power fixtures. Do not resolve parallel-track pressure by adding application-specific branches to the generic engine.

### Milestone 0 — Product contract and fixtures

Deliver:

- Add `design-schema` with request, candidate, evidence, quantity, result, and migration types.
- Add `sourcing-schema` with policy, offer, snapshot, lifecycle and candidate-BOM metric types.
- Define two motor reference requests and two buck reference requests.
- Add synthetic—not copied live—offer snapshots covering the four reference requests and every sourcing-policy state.
- Add architecture decision record covering deterministic generation, evidence states, ranking, local electrical operation and the optional credentialed sourcing service.
- Add a checked-in V1 data manifest listing every required part class and its review state.

Gate:

- Schemas validate valid fixtures and reject invalid units/ranges.
- Every fixture declares all assumptions; no hidden defaults.
- A versioned request round-trips without data loss.
- Sourcing policies and synthetic snapshots round-trip without mixing volatile offers into engineering component facts.

### Milestone 1 — Shared compiler skeleton

Deliver:

- Implement normalize → enumerate → solve → match → check → Pareto/rank pipeline.
- Add stable content hashing and deterministic ordering.
- Build an in-memory toy recipe/library used only for engine tests.
- Record rejection reasons and unknown evidence.

Gate:

- Repeated runs are byte-stable.
- Unit, property, and golden tests cover boundary values and tie-breaking.
- A deliberately missing fact produces `unknown`, never `pass`.
- Hard-failed candidates cannot reach the ranked result.

When this gate passes, launch Tracks A, B, C, and D concurrently. Part-source research, DigiKey/Mouser access work and evidence capture may begin during Milestones 0–1, but profiles do not merge until their schema and validator are stable. LCSC partnership work waits for the post-traction gate defined above.

### Track A1 — Brushed-DC motor recipes and data

Deliver:

- Integrated and external-FET H-bridge recipes.
- Reviewed initial driver, MOSFET, and passive profiles.
- Motor R/L/back-EMF behavioral load.
- Analytic loss, current, voltage, logic, bootstrap, switching, shunt, and thermal rules.
- Library validator for source/evidence completeness and range consistency.

Reference fixtures:

- **M1 compact:** 9–16 V supply, 12 V nominal motor, 1.5 A continuous, 5 A stall, 20 kHz PWM, 3.3 V logic, 40 °C ambient. Must return at least two valid integrated-driver designs from at least two manufacturers.
- **M2 power:** 18–30 V supply, 24 V nominal motor, 5 A continuous, 20 A stall, 20 kHz PWM, 3.3 V logic, 50 °C ambient. Must return at least two valid external-FET designs, with at least two gate-driver manufacturers represented across the Pareto set.

Gate:

- All returned candidates have zero hard failures.
- All sizing equations have IDs, tests, and evidence references.
- Loss totals equal their reported components within tolerance.
- Each rejected reference device has an inspectable reason.
- Independent hand calculations for M1 and M2 agree within the declared model tolerance.

### Track A2 — Motor circuit materialization and simulation

Deliver:

- Convert every valid motor candidate into the existing `CircuitDocument`.
- Implement named motor simulation scenarios.
- Add native ngspice and WASM test benches for at least one candidate in each topology family.
- Annotate simulation coverage and behavioral-model limitations.

Gate:

- Generated documents pass `circuit-schema` validation and deterministic netlist generation.
- Native and browser/WASM simulations both converge for the golden candidates.
- Key measurements agree across native and WASM within existing tolerance policy.
- Simulated current/loss trends are directionally consistent with analytic estimates; discrepancies are bounded and documented.

### Track A3 — Motor workflow adapter and end-to-end gate

Deliver:

- Motor requirements form and application-specific result/detail adapters mounted into the shared UI from Track C.
- Motor customization rules and named simulation scenario controls.
- Motor share/export integration using the generic serializers and exporters.

Gate:

- End-to-end browser tests complete the **M1 compact fixture** from blank page to generated comparison, simulation, share URL, and each export.
- Reloading a share URL restores the same request, library version, candidates, selected design, and customization.
- KiCad opens each golden exported schematic without repair prompts; references, values, pin connections, and footprint fields match the candidate BOM.
- Existing manual simulator flows remain green.

### Track B1 — Buck recipes and data

Deliver:

- Integrated synchronous-buck and external-FET controller recipes.
- Reviewed multi-vendor regulator/controller, FET, inductor, capacitor, and resistor profiles.
- Analytic sizing, operating-limit, ripple, loss, thermal, and compensation checks.

Reference fixtures:

- **P1 compact:** 9–16 V input, 5 V at 3 A, 30 mV maximum ripple, 40 °C ambient. Must return at least three integrated-regulator candidates across at least three manufacturers.
- **P2 high voltage:** 36–52 V input, 12 V at 5 A, 100 mV maximum ripple, 50 °C ambient. Must return at least two valid external-FET controller designs across at least two manufacturers.

Gate:

- Same deterministic, evidence, hard-constraint, hand-calculation, and rejection-explanation gates as the Motor module.
- Capacitor results use effective capacitance at bias when evidence exists and visibly warn when only nominal capacitance is known.
- A recipe cannot claim loop stability without sufficient control-model evidence.

### Track B2 — Buck circuit materialization and simulation

Deliver:

- Buck candidate-to-circuit builders and named scenarios.
- Native/WASM golden benches.

Gate:

- Generated documents pass `circuit-schema` validation and deterministic netlist generation.
- Native and browser/WASM simulations both converge for the golden candidates.
- Key measurements agree across native and WASM within the existing tolerance policy.
- Simulated ripple/loss trends are consistent with analytic estimates; discrepancies are bounded and documented.

### Track B3 — Buck workflow adapter and end-to-end gate

Deliver:

- Buck requirements form and application-specific result/detail adapters mounted into the shared UI from Track C.
- Buck customization rules and named simulation scenario controls.
- Buck share/export integration using the generic serializers and exporters.

Gate:

- P1 completes end-to-end from a blank page through generation, comparison, steady-state and load-step simulation, sharing, and export.
- P2 completes end-to-end through every scenario supported by its selected model.
- Golden exports open correctly in KiCad and reproduce the BOM.
- Reloading a share URL restores the same request, library version, candidates, selected design, and customization.

### Track C1 — Shared UI, sharing, and export framework

This track starts after Milestone 1 and runs in parallel with A1/B1/D1. It develops against the four pinned fixture result documents and synthetic offer snapshots rather than waiting for live application engines or providers.

Deliver:

- Generic requirements-workflow shell and application adapter interface.
- Comparison, candidate-detail, customization, constraint/evidence, and scenario surfaces.
- Versioned compressed design/request sharing.
- BOM CSV, SPICE, simulation CSV, SVG, printable report, and KiCad schematic exporters.
- Contract tests proving both Motor and Power fixture documents render without application-specific conditionals in shared components.

Gate:

- Both fixture families render, compare, share, restore, and export using adapters.
- Shared UI and exporters import no motor or buck recipe modules.
- KiCad opens one generated golden schematic from each application family without repair prompts.
- Existing manual simulator flows remain green.

### Track D1 — Sourcing contracts, service and provider adapters

Start DigiKey and Mouser provider-access work during Milestone 0; it can take longer than the code. Implement against synthetic fixtures and official sandboxes where available. Do not apply for or implement LCSC live access in this track.

Deliver:

- Provider-neutral `DistributorOffer`, `OfferSnapshot`, `SourcingPolicy` and candidate-BOM metric implementation.
- Open-source sourcing service with server-side credential handling, request validation, timeouts, rate limiting and provider-specific cache/persistence rules.
- DigiKey and Mouser adapters that normalize only supported fields and retain provider attribution.
- Versioned provider policy manifest documenting authentication, rate limits, cache TTL, display terms, persistence/export rules and public/self-host availability.
- Deterministic mock adapters and synthetic snapshots for CI; never put production credentials or copied live responses in fixtures.

Gate:

- No provider credential or refresh token reaches browser code, logs, exported designs or the repository.
- Adapter failure, timeout or rate limit produces a partial/stale/unavailable sourcing state without breaking electrical generation.
- Every normalized field retains provider, retrieval time and semantic meaning; unknown data stays unknown.
- No adapter performs bulk capture or exceeds its declared rate/cache policy.
- No LCSC API adapter, response fixture or implied live-LCSC UI is present in V1; exact-MPN link-outs are tested separately.

### Track D2 — Sourcing filters, metrics and UX integration

Deliver:

- Apply sourcing policy after electrical feasibility and regenerate with alternative electrically valid parts when a BOM line fails sourcing constraints.
- Complete-BOM metrics for build quantity, MOQ/order-multiple-aware cost, bottleneck part, lifecycle risk, maximum lead time and distributor split.
- Single-distributor mode and any-selected-distributor mode.
- Sourcing policy form, per-line offer table, BOM availability summary, refresh behavior and stale/conflict/provider-error states.
- Share/export handling that embeds, references or omits offer data according to the provider policy manifest.

Gate:

- A synthetic “DigiKey only, active, in stock, build 100” request returns only designs whose complete BOM is buildable under that snapshot.
- A single-distributor request never constructs a BOM by silently mixing providers.
- Obsolete parts are rejected by default; NRND, last-time-buy and unknown follow the explicit user policy.
- Refreshing offers can change sourcing rank/eligibility but cannot change engineering facts or bypass electrical revalidation.
- BOM cost includes quantity per assembly, requested build count, MOQ, order multiples and the applicable price break.
- At least one authorized live/sandbox smoke test per enabled provider verifies the adapter contract outside the deterministic CI fixtures.

### Milestone 2 — Parallel-track integration

Begin only after A1/A2, B1/B2, C1, and D1/D2 pass independently. A3 and B3 may be completed during this integration window.

Deliver:

- Merge through the versioned shared interfaces; do not combine application recipe code.
- Run the complete four-fixture generation/simulation/export matrix.
- Reconcile shared component profiles through the ownership manifest.
- Measure browser generation time, bundle impact, simulation memory and sourcing-service request volume for both modules.

Gate:

- Motor and Power results are unchanged for identical request/library hashes before and after integration.
- No application-specific branch exists in the generic compiler, shared candidate UI, or generic exporters.
- Both modules work in the same static/offline build without route, state, or share-format collisions.
- The same modules can opt into live sourcing without changing their application recipes or stable electrical component profiles.
- Provider outages degrade to a clearly labeled offline/partial sourcing state.
- The entire existing simulator regression suite remains green.

### Milestone 3 — V1 release audit

Deliver:

- Public methodology pages for equations, ranking, evidence states, pricing snapshots, simulation tiers, and limitations.
- Reproducible design-library build and validation report.
- Third-party/license notices and source manifests.
- Performance pass and static/offline deployment verification.
- V1 example gallery generated from the four reference fixtures.

Release gate:

- All unit, property, golden, native, WASM, export, accessibility, and browser E2E tests pass from a clean checkout.
- No required network request occurs after the static application loads.
- No secret or proprietary source artifact is present in the built site or repository.
- No provider credential is present in the browser bundle; each enabled live provider passes its policy/authorization review.
- Every example can be regenerated from its request and pinned library version.
- The sourcing UI displays distributor, stock, lifecycle, lead-time semantics, pricing quantity/currency, retrieval time and stale/conflict state for every offer.
- DigiKey and Mouser support is described accurately as public-live, self-host/BYOK, or unavailable. LCSC is described only as exact-MPN link-out and planned partnership work; never imply live coverage.
- Each V1 application satisfies its stated multi-manufacturer coverage target and publishes the generated catalog coverage report.
- Catalog-neutrality regression tests pass, and default ranking contains no manufacturer-specific weight or preference.
- Every page says these are engineering starting points requiring datasheet review and bench validation, not certified production designs.

## 12. Test strategy

Use multiple layers; passing SPICE alone is insufficient.

- **Equation unit tests:** known hand calculations and manufacturer reference examples, expressed without copying copyrighted prose/artwork.
- **Boundary/property tests:** higher supply voltage cannot improve voltage margin; higher current cannot reduce conduction loss; larger RDS(on) cannot improve FET conduction loss; missing facts cannot improve confidence.
- **Golden generation tests:** pinned request + pinned library → expected recipe set, component choices, derived values, rejection reasons, metrics, and ordering.
- **Library validation:** units, ranges, source locators, hashes, licenses, duplicate MPNs, impossible min/typ/max relationships, stale-price flags.
- **Catalog-neutrality tests:** manufacturer-name anonymization, equal-profile tie behavior, all-eligible-manufacturer enumeration, missing-data non-advantage, and explicit user filters.
- **Sourcing contract tests:** provider normalization, policy filtering, complete-BOM build quantity, MOQ/order multiples, lifecycle conflicts, snapshot expiry, partial failure and provider policy enforcement.
- **Electrical benches:** native ngspice for speed plus the existing WASM runner for browser parity.
- **Export snapshots and semantic tests:** parse exported CSV/JSON/KiCad; do not rely only on text snapshots.
- **Browser E2E:** both workflows, compare, customize, simulate, share, reload, export, offline reopen.
- **Regression:** the existing schematic editor, simulator, model import, model library, waveform viewer, and sharing tests stay required.

Every numerical model must state its valid range and expected tolerance. A test that only asserts “simulation converged” is not an electrical validation.

## 13. Principal risks and controls

| Risk | Control |
| --- | --- |
| Datasheet extraction errors become authoritative facts | Two-stage source/review state, schema range checks, hash/locator evidence, hand-audited V1 profiles |
| Candidate explosion makes the browser slow | Analytic hard filters first, bounded component alternatives, Pareto pruning, materialize/simulate only survivors |
| Rankings imply false precision | Show raw metrics, snapshot dates, unknowns, Pareto set, and named objective profile |
| Thermal predictions are misleading | State PCB copper/airflow assumptions; show estimate tier; never call them certification |
| Vendor models cannot be redistributed | Independent behavioral models, existing reviewed models, or local user imports; never bundle without permission |
| Live sourcing requires secrets, rate limits change, or offers become stale | Isolate an optional server service, keep the electrical engine offline-capable, use provider policy manifests, short-lived snapshots, timestamps and explicit stale/partial states |
| Distributor terms prohibit the desired hosted experience | Obtain approval before enabling the provider publicly; otherwise ship the adapter for self-host/BYOK use and state the limitation accurately |
| KiCad export creates licensing/compatibility problems | Project-authored symbols, documented format, versioned golden files opened by real KiCad in CI/release QA |
| Feature breadth prevents shipping | Freeze V1 to two motor recipes and two buck recipes; all other applications wait |
| Parallel tracks drift or repeatedly conflict | Freeze versioned contracts first, assign directory/MPN ownership, use fixture-based contract tests, and require migrations for shared changes |
| The catalog becomes pay-to-play or quietly favors a vendor | Make brand identity unavailable to scoring, publish the algorithm and coverage report, use one admission process, disclose funding, and enforce neutrality regressions |
| The existing web entry file becomes less maintainable | Keep designer state/UI in a feature boundary and add only a thin mount/route in the composition layer |
| Simulation is mistaken for validation | Equations and constraints are primary; model tier and bench-validation disclaimer remain visible |

## 14. After V1

Prioritize additions by how much of the shared compiler they reuse:

1. Assemble the LCSC partnership evidence pack after traction, apply, and implement the approved live adapter.
2. Stepper motor driver module.
3. Three-phase BLDC power-stage selection and six-FET inverter generation; control/FOC remains separate.
4. Boost and inverting buck-boost.
5. SEPIC and flyback, including an explicit OpenMagnetics integration evaluation.
6. Multi-rail architecture and rail sequencing.
7. Optional distributor cart handoff/order automation after the read-only sourcing experience and provider agreements are proven.
8. PCB placement/layout assistance after schematic generation is trustworthy.

Do not begin these until V1 release gates pass.

## 15. Instructions for the implementation session

Start by reading:

- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/LICENSING.md`
- this document
- the existing schemas and package test conventions

Then inspect the current worktree and preserve all unrelated changes. Implement **Milestone 0 only**, verify its gates, and report the exact files/tests before proceeding. DigiKey/Mouser access work may start during Milestone 0, but do not commit credentials or live responses and do not begin an LCSC application before the traction gate. After Milestone 1 passes, the Motor, Power, shared UI/export and Sourcing tracks may be dispatched in parallel using the ownership table above. Do not resume or alter the separate MOSFET model-harvesting campaign unless explicitly instructed; the design-library work here is a small hand-reviewed V1 dataset with a different acceptance contract.

The first implementation PR/change set should contain only:

- `packages/design-schema`
- `packages/sourcing-schema`
- four reference request fixtures
- synthetic sourcing policy/offer fixtures
- the architecture decision record
- the V1 data manifest
- package wiring and tests required for those artifacts

It should not contain UI, part scraping, simulations, or speculative topology abstractions.
