# Robonyx Designer release audit

This package derives a deterministic, fail-closed V1 release-readiness report
from the checked-in data manifest, admitted catalog, production Motor/Power
status snapshots, external-FET readiness contract, primary-source gap reports,
provider policy manifests, native sourcing-authorization contract, local
sourcing-request transfer, simulation receipt contract, and exporter surface.

The export gate recognizes the deterministic, strict-parser-verified structural
KiCad and self-contained printable-report contracts. It also recognizes the
immutable Power physical-handoff V1 predecessor
`sha256:dc8671f69b6588e6d11fd65fa9b954951ccc0dc28d208a6e3c877e8cbf24e068`
and additive quantity-aware V2 successor
`sha256:1cde50595ebed875cb5f77e8c7a449bd3e1be2355a9dcbc150dbe6e972d28af8`.
V2 binds the quantity-two output-capacitor BOM line to explicit
`output-capacitor-1`/`C3` and `output-capacitor-2`/`C4` structural instances and
the 10 µH inductor. Both versions fail closed without footprint identity or
physical pin mapping and grant no placement, routing, manufacturing-output,
physical-fidelity, eligibility, simulation, or attestation authority. A
`--external-kicad-report` attachment is decoded as strict UTF-8, parsed through
the closed self-hashed report schema, and accepted only when regenerated current
Motor and Power fixture/application/candidate/circuit/result/context identities
and input schematic byte lengths and SHA-256 hashes match exactly. A current
attachment associates that current input identity with the report's
self-reported CLI-success assertion; it does not prove the described execution
occurred. It remains unattested and cannot clear the release gate; interactive
KiCad open/save verification remains separately unverified. The printable-report pass proves exact
V2-context regeneration and byte-verified HTML; it does not claim external PDF
rendering, commercial data, simulation attestation, or physical verification.

The report intentionally distinguishes a code contract that exists from a
release outcome that has been demonstrated. It recognizes pinned automated
Designer contracts for serious/critical axe regressions, shared-result offline
reopen, a static route-byte ceiling, and an environment-bound Chromium runtime
and retained-JS-heap audit. The runtime audit emits a strict content-addressed
report tied to the exact production artifact set and Motor/Power result,
candidate, request, and SVG identities. Its timings and heap values are not
deterministic across machines and remain unattested. A strict release-attachment
receipt can bind the exact report bytes, contract, production artifact set, and
caller-supplied GitHub Actions context, including the source and workflow
revisions. That is a byte association to self-reported context, not proof that
the described run occurred. The receipt remains `attestation:none`; it is not
cryptographic provenance, independent approval, or deployed/cross-browser/
whole-process performance proof. These automated passes do not substitute for
an externally verified post-commit release-run artifact attestation,
a manual assistive-technology
audit, broader offline/deployment verification, clean-checkout evidence, or
native/WASM goldens. An unverified gate can never produce `ready`.

The clean-checkout runner executes the contract's exact ordered tool probes and
eight-command matrix only after verifying a clean, stable repository. It fails
before the matrix unless the strict report parser accepts Node 22, ngspice 46,
and the other pinned tool-version formats; hashes raw command stdout/stderr; and
rechecks repository identity after tool preflight and matrix completion. It requires
an explicit absent output path outside the repository and creates that report
exclusively only after success:

```sh
npm run report:clean-checkout --workspace=@opencircuit/designer-release-audit -- \
  --output /absolute/path/outside-the-checkout/designer-clean-checkout-report.json
```

The report remains `attestation:none`: it records what the local runner
self-reported and does not authenticate the host or prove independent execution.

Motor and Power `production-context` gates mean only that the reviewed catalog
and native recipe identities form an executable, hash-verified context. They do
not claim that strict default requests retain a candidate. The separate browser
workflow gate records the current zero-retained-candidate strict outcomes and the fact
that production CircuitDocuments preserve connected exact-BOM structural
assemblies with schematic-only primary blocks as their default graphs. Separate
generic request/passive-derived behavioral scenarios are explicitly outside the
selected-part model and eligibility boundary. Likewise, the exporter-contract
gate reports which deterministic functions exist separately from which exports
the current production UI can honestly reach: exact installed contexts can
produce zero-omission Scenario SPICE for those behavioral scenarios, while
Simulation CSV and Simulator handoff remain disabled without pinned-engine
samples and an exact matching receipt.

The primary-evidence gates reconcile exact profile paths, computed/released
content hashes, reviewed admission checks, facts-schema versions, and installed
ready recipe identities. The current `2026-08-27.2` catalog admits 24 profiles.
Motor's installed external recipe is now the exact-driver direct-gate,
interface- and exact-TVS-static-voltage-qualified 3.1.7 release at
`sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947`.
Its interface-qualified 3.1.6 predecessor remains frozen at
`sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320`,
the capacitor-role-qualified 3.1.5 predecessor remains frozen at
`sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187`,
and its 3.1.4 predecessor remains frozen at
`sha256:c8145e32480a29e0d9d008ac7e73ff73f9b93cb08aa2f7f0919f199af4955d84`.
Motor's installed integrated recipe is the companion-network-gated 3.2.6
release at
`sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07`.
The newly admitted DRV8262DDVR profile is a reviewed catalog input, but every
exact DRV8262 option is rejected before component materialization because the
required two VM bypass capacitors and charge-pump/regulator companion network
cannot yet be represented by the recipe.
Current-shunt, N-MOSF, supply-TVS, and exact
100 kΩ pull-down roles are satisfied; the three exact reviewed 100 kΩ profiles
are admitted for the pull-down role and the reviewed 732 kΩ profile is excluded.
The exact MIC4606-2 application binding uses the verified Microchip Rev H source
at `sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135`.
It selects no series-gate resistor: that role is `not_required` for this recipe,
while `motor.external.gate-network` remains a required safety unknown. The
exact Diodes `3.0SMCJ33CAQ` TVS profile is bound at
`sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474`
to manufacturer evidence at
`sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24`.
Its published 33 V stand-off and 53.3 V maximum clamp comparisons are static and
source-condition-bound; the production-temperature stand-off comparison and
full transient coordination remain unknown. The
bootstrap and VDD-local roles use separate keys and quantities (two and one)
and admit exactly the Murata, Samsung, and TDK 10 µF profiles at
`sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992`,
`sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99`,
and `sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd`.
Their source-bound nominal 0.1 µF bootstrap and 1 µF VDD-local floor checks
pass; the 100 nF C1608 is excluded from both conservative roles. Strict
generation enumerates and checks 54 exact options and rejects all 54 under the
unknown-evidence policy. Explicit inspection materializes 54, Pareto-rejects 52,
retains two deterministic structural observations, and installed V3 keeps both
ineligible. Each retained candidate has 9 satisfied and 21 blocked required rules:
the three interface-specific MIC4606 xHS bounds pass only for the nominal
0 V-to-requested-bus excursion, while recirculation undershoot, wiring overshoot,
parasitics, and TVS coordination remain outside those comparisons. No VDD
driver-bias rail is implemented, so the existing bias-source rule remains unknown
and requires an actual rail inside the reviewed VDD minimum and maximum. Exactly
one shared capacitor application gap remains: effective
capacitance, bootstrap charge/refresh/leakage, VDD-local voltage and placement,
bulk transient energy, and related operating-condition adequacy are unknown. Power
retains seven staged facts-V2 assessments while counting the exact reviewed
facts-3.3 TPS54302 release as one production-enumerable admission and leaving
the other six as blockers. This additive reconciliation does not rewrite facts
V2 or promote an MPN-only match.

The production selected-passive gate recognizes the schema-V2 canonical contract
at `sha256:759ed0914f8dc8034064c4890329c4edc34b32ee6dd0eb3f03c2a3f2ea6e92f8`
and its 11,674-byte local execution report at
`sha256:70e821f80e7f16ce75992f152fb9bc3cf2aed48e9de4a0acd9aefc9ec4bb984c`.
The native/WASM harness strictly parses it and reruns the exact identity-bound
case in CI. It binds the current TPS54302DDCR observation with one Bel
`F1F2-0804-100M` 10 µH inductor and one Murata `GRM32ER71E226KE15L` 22 µF BOM
line at quantity two. The contract requires three ordered bindings: two explicit
capacitor instances, each representing one physical part, followed by the
inductor. It validates both capacitor-current vectors and the exact relation
`Iinductor=Icapacitor1+Icapacitor2+Iload` with `Iload=Voutput/Rload`. Strict
generation retains zero candidates with one `unknown_constraint_disallowed`
rejection; explicit inspection retains one structural observation that the
installed 3.4.6 recipe at
`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`
and `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6`
policy keep ineligible. The audit requires unfiltered push and
pull-request triggers plus the exact ordered job structure. Canonical artifact
parsing and exact production-identity regeneration run in a distinct hard step
for every native version. The separate native/browser-WASM numerical rerun is
hard only when the detected native reference is ngspice 46; another native major
is informational and soft-failing.
The selected-passive contract records the native solver identity
as `unverified`; only the browser-WASM engine self-reports KLU. The artifact
remains `attestation:none`. The Bel inductance characterization is exactly
100 kHz / 0.25 V RMS, while the Murata nameplate capacitance is reviewed only at
96–144 Hz and 0.4–0.6 V RMS. Those conditions do not cover the 290 kHz production
minimum, 400 kHz behavioral scenario, DC bias, ESR, ripple current, loss, current
sharing, or physical passive behavior. Switching behavior, effective capacitance,
capacitor ESR/ripple current, passive current/loss, physical passive models,
full-BOM and selected-semiconductor models, eligibility, ranking, and safety
authority are explicitly `unavailable`, so the broader simulation gate remains
unverified.

A separate `selected-semiconductor-ideal-rdson-projection-golden` pass binds the
current external-Motor permissive request, result, installed V3 decision, first
ineligible candidate, 3.1.7 recipe, context, catalog, reviewed CSD18540Q5B profile,
and exact manufacturer evidence. Its canonical contract is
`sha256:7ce9e9b453f35e668271b4ce3d00971b669a36de466b57d73dd30b04f73187c9`;
its 6,743-byte unattested execution report is
`sha256:310bc587ab5a54c9f58a725a70201bdb5d9fff7e6ca53e7a4e193ee3b01083b0`.
The fixture uses only four independent ideal 2.2 mOhm resistors and four 28 A DC
injections, so native ngspice-46 and browser-WASM must each produce exactly
61.6 mV per instance. The resistance value is source-bound to the reviewed 25 C,
VGS 10 V, ID 28 A table point. This retires only the broad coverage-level
`reviewed_selected_semiconductor_native_wasm_golden_unverified` blocker. It is
not transistor-equation or physical selected-part fidelity, uses no unapproved
device package, leaves reproducibility and attestation unchanged, and grants no
production-request, switching, thermal, full-BOM, eligibility, ranking, safety,
provider, commercial, or release authority.

The selected-semiconductor gate remains blocked even though current-production
external-Motor structural identities now exist. The installed 3.1.7 lane has two
deterministic direct-gate observations with four selected CSD18540Q5B devices per
assembly and distinct nominal bootstrap/VDD-local roles, but both are
policy-ineligible and contain no admitted selected-part model contract or package.
The audit records that distinction explicitly: a
current structural observation is not selected-semiconductor simulation authority.
A bounded model bench cannot satisfy this gate until an approved model package,
exact contract, and execution artifact are admitted and regenerated against the
current identity.

`power.external-fet-readiness-contract` proves only that the installed
external-FET recipe is class-isolated, deterministically structural, and
independently readiness-assessed. It remains non-release-eligible and has no
installed V3 policy, reviewed external-controller profile, scenario, executable
selected-part model, or production-candidate claim.

The browser workflow also supports canonical Motor and Power V2 requirements
download, import, and `#r` sharing. This artifact is strict untrusted input only:
it preserves the exact request bytes, `libraryVersion`, and display units, but
contains no generated result, execution, V3 decision, verified context,
candidate/scenario, provider/commercial, simulation, component-override, or
MPN-override state. Loading it never generates or installs trust. The user must
explicitly run the normal installed application generator, and a stale library
version fails rather than being silently upgraded. Customization state remains
absent from `#r` alone. A separate content-addressed primary-part instruction can
be downloaded or carried beside the exact request in a strict `#r+c` URL; loading
either form remains inert. Only an explicit installed-application action can
regenerate the exact source and target, after which the adapter authorizes the
exact target-only object and evaluates it under the installed V3 policy. The
ordinary result and ranking remain unchanged. That exact in-process pair can
emit five separately named, content-addressed inspection artifacts carrying the
explicit target eligibility decision: electrical-BOM CSV, structural SVG,
engineering-report HTML, structural KiCad, and the exact default authored
behavioral Scenario SPICE deck when its zero-omission gate passes. They do not
confer ordinary-result, ranking, selected-part model/simulation, commercial,
KiCad attestation, or production-readiness authority. A separate portable
inspection receipt deliberately remains restricted to the exact target sidecar
and the BOM/SVG descriptors by kind, filename, MIME type, UTF-8 byte length, and
SHA-256; no payload bytes or HTML/KiCad/SPICE descriptors are embedded. Parsing
and self-hash validation are integrity only. Restore requires an already
authorized exact source, installed-runtime reassertion, and deterministic replay
of both BOM/SVG artifacts, and authorizes only the fresh asserted object. No
broader customized-target production authority exists.

`sourcing.request-packet-v1` checks a closed, canonical local transfer over the
exact result/candidate references, selected BOM, build quantity, and visible
provider-neutral policy. Its limits are 256 KiB, 256 BOM lines, 256 bytes per
bounded text field, and 1,000,000 for build and per-assembly quantities. A pass
authorizes no provider or network access, includes no offers or commercial
observations, persists no snapshot, and grants no ranking or eligibility
authority. The installed adapter and Designer route independently regenerate
and verify the exact input; changed result/candidate/BOM/policy data,
content/presentation splits, and stale async completions fail closed.

`sourcing.native-v2-contract` proves canonical permission-gate parity across
lookup, authorization issuance, and trusted verification; invalid execution
mode or approval-reference rejection before cache/adapter effects; legacy V1
audit-only behavior; and absence of public raw-provider factory subpaths.
Provider gates remain independently blocked. Passing this contract proves code
isolation only, not provider approval, credentials, terms, live lookup,
commercial observations, or export authority.

The repository-safety gate scans the exact Git-tracked plus unignored untracked
release-candidate set. It is content-addressed and fails on high-confidence
credential material, non-template environment files, or repository-local
vendor/source archives. Git-ignored working datasets remain outside the release
set; passing this scan does not grant publication rights or provider approval.
Run `npm run scan:release --workspace @opencircuit/designer-release-audit` to
inspect the standalone canonical scan report.

Run `npm run report --workspace @opencircuit/designer-release-audit` for the
canonical JSON report. The command reports current state; it does not enable a
provider, admit a profile, turn a behavioral scenario into a selected-part
model, or let Scenario SPICE affect BOM, constraints, ranking, evidence,
receipts, or V3 eligibility.
The manual `Designer runtime release evidence` workflow supplies
`--runtime-report`, `--runtime-receipt`, `--github-context-from-env`, and
`--output` together, then uploads the exact runtime report, receipt, and derived
readiness JSON under one SHA/run-bound artifact name. Supplying only part of
that association fails closed. The workflow also asks GitHub to attest the
three exact files, but the release audit does not yet ingest or verify that
provenance. A valid unsigned receipt therefore replaces the `unattached`
blocker with `artifact_attestation_unverified`; it never clears the runtime
release gate.

`--external-kicad-report <report.json>` may be supplied alone or together with
that complete runtime trio. An absent external report yields
`external_kicad_cli_qa_release_report_unattached`; malformed UTF-8, invalid
schema/self-hash, or any stale regenerated fixture/input identity yields
`external_kicad_cli_qa_release_attachment_invalid`; and a valid current report
yields `external_kicad_cli_qa_release_artifact_attestation_unverified`. The
attachment does not verify reported output/PDF bytes, rerun KiCad, authenticate
the execution host or context, prove visual quality or interactive open/save,
verify footprints, admit production profiles, or establish selected-part
simulation fidelity.
