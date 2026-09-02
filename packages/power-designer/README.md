# Robonyx Power Designer

This package contains deterministic, non-isolated synchronous-buck recipes for the
Robonyx Designer compiler. The production V2 entry uses only the hash-bound
reviewed catalog and the installed release-eligible recipe. Separate legacy P1/P2
fixtures retain synthetic manufacturer IDs and part numbers for tests and UI
demonstrations; those identities never enter the production generator.

The `@opencircuit/power-designer/v3` subpath exposes a named production constraint observation. It projects the V3 request to permissive V2 structural inspection, then evaluates the exact result and context with the installed content-addressed production policy. That policy is scoped only to `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6`; it does not authorize the external-FET recipe. This is not a verification or release claim: the current integrated-buck observation remains ineligible because unknown safety and requirement evidence stays blocking.

The browser authorizes only the exact in-process generation object issued by its installed Power adapter and fingerprints the complete V2 result, execution report, context hash, and V3 decision before rendering production policy state. Electrical JSON and share payloads remain canonical V2 result bytes only; a share gains V3 policy UI only after explicit exact installed regeneration, while file imports and demonstrations remain structural-only.

The legacy fixture path materializes a connected editable behavioral synchronous-buck power stage
using only the frozen `CircuitDocument` v1 vocabulary. The selected regulator or
controller is not falsely encoded as another component type: labeled complementary
gate-drive sources represent its bounded behavior, and integrated power FETs are
shown as internal behavioral switch decomposition. `steady_state` and `startup` are
behavioral; `load_step` and `line_step` remain unavailable because the frozen circuit
contract has no pulsed load or per-scenario document/config reference.

An isolated real-catalog subpath adds a first tranche of primary-part evidence at
`@opencircuit/power-designer/real-catalog`. It is not used by the P1/P2 generator.
The seven profiles retain official manufacturer URLs, precise fact locators, retrieval
metadata, and link-only publication-rights notes; no datasheet or model is
redistributed. They are authored primary-source extractions, not independently
reviewed profiles. All thirteen source records are exact-byte SHA-256-bound. Catalog
admission stays blocked until facts-V2 profile authoring, independent review, and
admission are completed. The exported admission-gap report makes the remaining
authoring, review, admission, and coverage gaps explicit. It also includes a
deterministic facts-V2 readiness projection for every staged real primary part.
That projection preserves source
values and exact target claim semantics while reporting missing conditions,
semantic mismatches, mounted geometry, package identity, and independent-review
work. For all seven source-hash-complete parts, the real-catalog subpath also
exports deterministic candidate-profile plans. They
name the source-bound claim count and a machine-readable exact-byte evidence map
for every mandatory package, control, geometry, and configured-option path. The
seven mapped datasheets directly bind authored package-name candidates,
manufacturer land-pattern calculations, and maximum-height candidates. Those
values remain pending independent review and are not emitted as reviewed facts.
The Analog Devices maps bind mandatory evidence only to the byte-stable
datasheets, not to mutable product-page HTML. LT8640S retains its exact LQFN
mapping and conservative suggested-PCB-layout bounds. LTC3891 and LTC3895 retain
their complete ILIM voltage-spread observations without converting them into
universal current limits; the RSENSE or inductor-DCR network remains an
application choice. Their gate-drive observations preserve every stated VIN,
EXTVCC, RUN, DRVSET/RDRVSET, supply-path, temperature, and other applicability
condition. Unrepresentable conditions keep those options blocked, and LTC3895
50 kohm/90 kohm typical-only rows are not promoted to production spreads.
For LM5145, the map also retains the exact 7.3 V / 7.5 V / 7.7 V internal-VCC
spread, while refusing to emit it as a configured gate-drive option because the
published VCC-load and SS/TRK applicability conditions are absent from the
closed facts-V2 condition vocabulary. Its current-sense threshold remains
application-configured by the external RILIM and selected RDS(on) or shunt, so
no controller-only voltage option is invented. Control-mode and compensation
prose are likewise not relabeled as a bounded control or stability model.
LM70880RRXR remains a seventh exact staged identity. Its attempted facts-V3.3
profile was withdrawn before review because the source does not establish the
maximum mounted geometry required by ADR-0006. Its official TI PDF is pinned at 2,152,558 bytes
with SHA-256
`f6115dacb305ac44d58d1985647095d05406861532e22d8d8643cb215561f3dc`.
The profile uses the 4.5 V to 80 V Recommended Operating Conditions, keeps the
87.5 V VIN value absolute-only, and retains 8 A as the single-device continuous
capability statement. The advertised 16 A requires two interleaved devices with
paralleled outputs and is not promoted. The published 50 mV / 56 mV / 62 mV
current-sense spread remains voltage evidence; dividing it by the external 5
milliohm shunt is calculated electrical evidence, so ampere current limit stays
unknown. Frequency is limited to the 440 kHz typical observation at RRT = 49.9
kohm, rather than relabeling the 200 kHz-to-2.2 MHz marketing range as a universal
guaranteed range. The VQFN RRX package height is 1.0 mm maximum, but no board-area
candidate is emitted: RRX0029B note 1 on physical page 52 marks parenthesized
dimensions reference-only, and the physical-page-53 example-layout coordinates
are parenthesized and asymmetric at 3.2 mm and 2.9 mm. They do not provide
manufacturer maximum geometry.

LM70880RRXR now has only a `researching` design-library reservation with null
author, reviewer, review timestamp, and profile hash; every lifecycle check is
`not_run`. It is absent from both bundled surfaces, excluded from the reviewed
release, and grants no generator eligibility. The exact staged real-catalog
profile and its facts-V2 candidate assessment remain isolated, with board area
explicitly `blocked_missing_profile_evidence`. The
installed fixed-oscillator recipe cannot materialize the LM70880 network: the 5
milliohm sense resistor, RT resistor, internal/external compensation selection,
VDDA 0.1 uF capacitor, VCC 4.7 uF capacitor, and conditional 1 ohm bootstrap
series resistor remain outside that recipe. In the staged `power.primary-evidence`
audit, the 80 V operating evidence removes the 60 V input-envelope blocker while
the still-unreviewed staged identity contributes one authoring/admission blocker,
so LM70880's own contribution is net-neutral. A separate TPS54302 output-envelope
correction removes one more blocker, making the observable total 12 to 11. The
current gap remains at 8 A versus 10 A; integrated coverage is 4 authored of 12,
so 8 remain.
For NCP1599 specifically, the source-bound authoring map now preserves the
50 ns minimum-controllable-on-time value as a guaranteed maximum at VIN 3.0 V
to 5.5 V, VOUT 1.2 V, and TJ 298.15 K; preserves the 3.83 A / 4.18 A / 4.54 A
current-limit spread at VIN 4.0 V to 5.5 V, VOUT 1.2 V, TJ 298.15 K, and normal
regulation; and maps the 423.15 K maximum junction temperature only as an
absolute rating. These are exact-source-bound authored candidates pending
independent review, not reviewed operating guarantees. The NCP1599 authoring
assessment therefore has 15 remaining blockers (down from 20). It now emits, and
the design library materializes as authored-only, one schema-valid
`partial_non_admitted` facts-V2 profile containing only the
exact-source-bound VIN minimum/maximum, current-limit minimum/typical/maximum,
minimum-on-time maximum, absolute-maximum junction temperature, package, and
mounted-geometry facts. Every other claim is an explicit unknown; in particular,
it does not manufacture a recommended switching frequency, guaranteed output
current, bounded control/stability model, junction-to-ambient thermal maximum, or
unconditioned switch resistance. Complete `VFB = VCOMP` and `VGS = 5 V` source
applicability is retained as unrepresentable in the current closed condition
grammar, separately from ordinary unauthored conditions. Blockers retain sorted
atomic claim-group membership, and the profile is content-hash-bound with an exact
sorted unknown-path set. Independent review remains pending, the profile stays
excluded from the reviewed catalog, and the partial profile cannot make a staged extraction admission
eligible. The admission report therefore has six unreconciled
profile/review/admission blockers alongside the one exact TPS54302 reviewed-release
reconciliation; exact-byte closure, an authored lifecycle entry, and candidate-map
discoveries do not imply independent review, admission, or generator eligibility.

The six official Analog Devices sources can be captured without placing vendor
bytes in the repository. From this package, run
`npm run evidence:capture -- capture /absolute/path/to/new-directory`, then
replay the resulting receipt with
`npm run evidence:capture -- verify /absolute/path/to/new-directory/power-adi-evidence-capture.json`.
The capture requires all six existing official product-page/datasheet URLs,
checks exact final host and path, media structure and part identity, writes a
deterministic SHA-256 receipt only after the complete set passes, and refuses
repository-local output including symlink aliases. Verification recomputes every
hash from the saved bytes. This utility does not edit the staged catalog,
facts-V2 profiles, admission ledger, or production release.

The production V2 wrapper publishes a deterministic hash-bound manifest, recomputes
profile coverage at runtime, and issues production trust only after the result binds
to the exact request and context. Its browser status import remains data-only.
Catalog release `2026-08-25.15` originally activated the now-frozen
`power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.2`
predecessor (`sha256:86d679c665cd46d355eddfdaa3bda2f80e8f6c7d97b31f7f6e6ce88dc619968a`).
Catalog release `2026-08-25.16` installed its immutable `3.4.3` successor
(`sha256:b39032f3fe4ab1b40a12ac7128bf09db18c31e369a96ead925dd3e1b06710a84`)
with the independently reviewed Texas Instruments `TPS54302DDCR` facts-V3.3 profile,
the exact Bel Fuse `F1F2-0804-2R2M` facts-V3.4 inductor profile, and reviewed facts-V2
MLCC and general-purpose-resistor profiles. Those predecessor bytes remain frozen.
Current catalog release `2026-08-27.2`
(`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`)
contains 24 reviewed profiles and preserves the earlier Bel 2.2 µH path while
adding the independently reviewed Bel `F1F2-0804-100M` 10 µH profile and Murata
`GRM32ER71E226KE15L` 22 µF MLCC used by the installed successor. The runtime
installs immutable `3.4.6`
(`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`),
which selects the 10 µH inductor and a quantity-two output-capacitor line while
preserving the VFB/resistor-envelope behavior and every conservative unknown.
It additionally surfaces four estimated ideal-equation observations: inductor
peak-to-peak ripple, peak current, RMS current, and total output-capacitor-bank
RMS current. They retain the nominal/condition-mismatched-inductance and
selected-regulator-control caveats and cannot change constraints or eligibility.
The exact installed recipe
set is `power.native.integrated-synchronous-buck@1.0.0`,
`power.native.facts-v2@2.0.0`,
`power.native.external-fet-synchronous-buck.facts-v3@3.0.0`, and
`power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.6`; only
the last is release-eligible and ready as a recipe contract. For the exact browser
preset, strict generation has one `unknown_constraint_disallowed` rejection and no
retained candidate; explicit unknown-evidence inspection has zero rejections and
retains one materialized exact-BOM structural observation. The installed policy
(`sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6`)
marks that observation ineligible. There is no hard-failure disposition. The
structural observation remains exactly 9 bounded passes, 13 unknown capabilities,
and 0 hard failures. The Bel profile's conservative 12 A minimum saturation-current
and 10 A minimum
temperature-rise-current endpoints remain conditioned to the manufacturer's 25 °C
reference, while its nominal inductance measurement conditions do not cover the
calculated converter point; the recipe therefore does not manufacture an inductor or
protection-coordination pass. At the exact 25 °C browser point, the reviewed
divider-resistor power and working-voltage evidence produces one bounded pass. The
calculated 4.74970376238 V to 5.17387393939 V VFB/resistor corners also fit the
browser request's explicit 4.7 V to 5.3 V DC regulation envelope; that request-bound
comparison is the only newly closed rule.
Because the request declares no load-transient target, `power.request.load-transient`
is omitted rather than manufactured as an unknown or pass. Output-current capability,
loop stability, effective capacitance, capacitor ESR/ripple current, passive
current sharing, timing, loss, thermal behavior, and selected-part simulation fidelity remain unknown where the
reviewed evidence does not prove them. The observation grants no eligibility,
selected-part simulation, provider, sourcing, or commercial authority.

An additive observation-only reference-design lane now binds the official Texas
Instruments `TPS54302EVM-716` guide `SLVUAP9B` and its published `PWR716-003` BOM.
Evidence `sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb`
records only the guide's explicit 25 °C tested range and measurement points; its
400 kHz Table 1-2 observation is condition-relevant only at the table's default
24 V input. Matching reference-design, assembly, evidence, published-BOM, and
published-layout-reference hashes produces only
`asserted_reference_identity_unattested`: there is no physical-assembly or
measurement attestation and no application authority. The non-installed mapping recipe
`power.reference-evidence.tps54302evm-716@1.0.0`
(`sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2`)
has zero strict-constraint authority. The EVM BOM lists `TPS54302DDC` and Würth
`7447714100` at 10 µH, not the installed `TPS54302DDCR` plus Bel
`F1F2-0804-100M` 10 µH path. The nominal inductance matches, but the exact MPN
and BOM identity do not, so none of its observations applies to or changes the
current candidate. All 13
strict unknowns, zero-candidate strict behavior, and installed recipe/policy
semantics remain unchanged; the unrelated shared catalog successor repins the
content-addressed context chain below. The browser exposes the condition-filtered
assessment only as a Power-specific, fingerprint-bound transient sidecar on the
exact authorized in-process generation. It is absent from canonical electrical
result bytes, shares, imports, candidate constraints, and the V3 eligibility
decision; malformed or authority-expanding sidecars are withheld rather than
rendered. [ADR-0012](../../docs/adr/0012-power-reference-design-evidence-v1.md)
records the exact scope.

The canonical package-level strict V2 compatibility request binds request
`sha256:ebaaa77210a40c2192dd8414dc05edb429d6ef5b45c1370f8a0e5d26e680050e`,
result `sha256:8a79cbbbe0cae67c05808b352bf910d96ac521659c4847eaf5d9c9586ba10245`,
and rejected pre-materialization identity
`candidate:v2:sha256:62dd4ac80d3ea6139640eb4dafc064f40ee99e778849b3c13ba95b50f8b2a697`.
The package-level permissive V3 observation has request
`sha256:3702fc5b906a3bfc2caeccc547b222b44fe0827b4a4972b1d4890ef35e100400`,
result `sha256:6530aafac0a6060283fb17dabfd8121bfe4b3051634dcbe43a88ed8ea21b498f`,
candidate `candidate:v2:sha256:1fc0e2f47f13060b4606b7cda6e54fae2b297ffbf7873bfe089c37114c444173`,
and ineligible decision
`sha256:95231bcb28308d796619e24ea92d936639bc4e426ea17fed9f9f4c8a88a168cd`.
The browser preset has separate canonical request bytes. Its strict request
`sha256:30b8c0fac110f71ce3e71c9347afe725f2a1ad29aa4fdb6bfde8bc87cc73771c`
produces result `sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2`
with rejected identity
`candidate:v2:sha256:88b7d52b012cd7edfda6ba8f5ef0611c7d2ffeff870614ccf9d0dea6f1ca679d`.
Its explicit-inspection request
`sha256:f21a643aba1a3c8cb75d42ff2e69b4f12a25168becdb68fbf54f720649821cd4`
produces result `sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a`,
candidate `candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a`,
and decision `sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37`.
All current paths bind context
`sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3`,
catalog `sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890`,
and reviewed source release
`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`.

The external-FET recipe is external-primary-only across parsing, preflight,
enumeration, solving, matching, checks, estimates, and materialization. It emits
an exact nine-line structural BOM with two schematic-only blocks, complete
wiring, zero BOM nonrepresentations, no scenario, and `modelTier: unavailable`.
It remains `releaseEligible:false` and `ready:false` because the reviewed
external-controller count is zero and no installed V3 policy covers it. Its
recipe hash is
`sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538`;
the installed qualified integrated V3.4 recipe is
`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`;
and the Power context manifest is
`sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3`.

The qualified facts-V3.4 successor preserves the exact seven-line structural `assembly` and its
schematic-only TPS54302 block as the default circuit graph. It adds a separate
`ideal_pwm_output_stage_transient` scenario containing a generic request-derived
ideal PWM source, the selected inductor and two explicit output-capacitor
instances at per-part nominal values,
and a request-derived load. The source is not a TPS54302 model; feedback,
regulation, current limit, stability, loss, thermal behavior, passive tolerance,
bias, ESR/DCR, parasitics, and temperature effects remain outside the graph.
Nonrepresented BOM lines are explicit, and this behavioral projection cannot
change the BOM, constraints, ranking, persisted evidence, receipts, or V3
eligibility. Exact installed browser contexts can download its zero-omission
Scenario SPICE deck, while Simulation CSV and Simulator handoff remain disabled
without actual pinned-engine samples and a matching receipt.

The current-production selected-passive schema-V2 golden binds the exact retained
browser observation to this generated ideal-nominal scenario. Its ordered bindings
are Murata capacitor instance 1, Murata capacitor instance 2, and the Bel inductor;
each capacitor represents one physical part from the quantity-two BOM line. Native
ngspice-46 and the shipped browser-WASM build regenerate both capacitor-current
vectors and the exact relation `Iinductor=Icapacitor1+Icapacitor2+Iload` with
`Iload=Voutput/Rload`. The contract remains `attestation:none` and
production-constraint-ineligible. The exact 100 kHz / 0.25 V RMS Bel inductance
characterization and 96–144 Hz / 0.4–0.6 V RMS Murata nameplate-capacitance
conditions do not cover the 290 kHz production minimum, 400 kHz behavioral
scenario, DC bias, ESR, ripple current, loss, or current sharing. Switching,
effective-capacitance, passive-current/loss, physical-passive, full-BOM,
selected-semiconductor, eligibility, ranking, and safety authority are all
`unavailable`. The 10,620-byte contract is
`sha256:ca36a18844394048029336641f9abd3c6b5c2f80616ea2f411ee6e1b0098f2eb`;
the 11,674-byte persisted report is
`sha256:c3b78f1d13f500a0bb22fd1387ce350ec38bc25ea462455255200f4df5a41900`.

The additive Power physical-handoff V2 contract
`sha256:8ec85a29ebe3578e70d31e1123b34f9b6a65a269c5c1b5db84568b377c6496be`
binds the quantity-two capacitor line to `output-capacitor-1`/`C3` and
`output-capacitor-2`/`C4` plus the 10 µH inductor. It preserves immutable V1
predecessor `sha256:dc8671f69b6588e6d11fd65fa9b954951ccc0dc28d208a6e3c877e8cbf24e068`.
Both versions fail closed without footprint identity or physical pin mapping and
grant no placement, routing, manufacturing-output, physical-fidelity,
eligibility, simulation, or attestation authority.
