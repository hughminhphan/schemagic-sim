# Robonyx Designer exports

Deterministic, application-neutral exports for frozen `DesignResult` and
`DesignCandidate` contracts.

- `serializeDesignResult` and its byte-identical `serializeDesignResultV1`
  alias retain the V1 JSON contract. `parseDesignResultV2` and
  `serializeDesignResultV2` are strict electrical-only V2 paths.
- `exportCandidateBomCsv` emits one stable, RFC 4180-compatible BOM row per
  selected component, including sourcing observations when present.
- `exportCandidateSpiceNetlist` validates a selected candidate circuit, rejects
  unsafe SPICE scalar text, and delegates netlist generation to the public
  `@opencircuit/sim-engine` interface. It returns deterministic `.cir` text or a
  `CandidateSpiceExportError` with an `invalid_circuit`, `unsupported_circuit`,
  `unsafe_spice_scalar`, or `generation_failed` code.
- `exportElectricalBomCsvV2` and `exportDesignResultScenarioSpiceV2` require an
  exact, engine-verified V2 result context. Incomplete unavailable scenarios
  additionally require an explicit opt-in and carry visible omission comments.
  The production artifact surface exposes Scenario SPICE only for an authored
  `behavioral` scenario whose exact engineering and execution contexts verify
  and whose generated deck has zero omissions. That deck is a generic,
  request/passive-derived projection: selected BOM identity does not make it a
  selected-part model, and the export cannot affect BOM selection, constraints,
  ranking, evidence, receipts, or V3 eligibility.
- `planDesignResultScenarioExportsV2` is a context-free structural inspection
  helper. It reports the exact remaining SPICE gate for each persisted coverage
  record without generating bytes, validating execution, or promoting trust.
- `exportDesignResultCircuitSvgV2` renders one exact persisted V2 circuit graph
  after engine regeneration verifies its engineering context. The SVG visibly
  labels structural-only fidelity, coverage limitations, and the absence of
  simulation data. Canonical embedded metadata makes the complete graph,
  referenced design blocks, scenario coverage, result hash, and candidate ID
  machine-readable; `parseDesignResultCircuitSvgV2` verifies both the metadata
  and full deterministic SVG bytes against the source result.
- `exportProductionDesignArtifactV2` has a closed observation-aware variant for
  electrical BOM CSV and structural SVG only. An application leaf first
  reasserts the supplied V3 decision against its installed context and policy;
  the exporter then binds that parsed decision to the exact result, complete
  candidate set, selected candidate, recipe ID, and recipe content hash. The
  CSV repeats a canonical metadata record on every preserved BOM row, with the
  exact decision/policy hashes, eligibility, blocked-failure and
  blocked-unknown counts, and blocked rule IDs. The SVG embeds the same closed
  canonical metadata and repeats `OBSERVATION ONLY`, eligibility, blocked
  counts, and rule IDs in visible and accessible text. Its verifier regenerates
  exact bytes and rejects source, candidate, recipe, metadata, or visible-text
  drift. Supplying no decision uses the ordinary V2 CSV/SVG renderers unchanged.
- Customized-target artifact rendering is a separate internal inspection
  capability for an exact `PrimaryPartCustomizedResultSidecarV1`, invoked by a
  trusted application leaf only after it authorizes the exact source/result
  object pair. The public customized-artifact subpath exposes types only, and
  neither raw renderer is in the package export map. Two portable renderers
  emit `customized_target_electrical_bom_csv` and
  `customized_target_structural_svg`; three installed-context renderers emit
  `customized_target_engineering_report_html`,
  `customized_target_structural_kicad`, and the exact default authored
  `customized_target_behavioral_scenario_spice` only when its behavioral
  coverage and zero-omission netlist gate pass. A single lazy web-owned wrapper
  statically owns both raw renderer tiers and the receipt replay code. It
  accepts only a private, one-shot token minted by the installed application
  boundary; direct module import can verify a portable receipt but cannot
  register a sidecar or render artifact bytes. The emitted wrapper exports only
  that guarded file operation and receipt verification, never the raw render or
  verify functions. All five formats embed canonical provenance, the exact
  evaluated policy state and blocked rules, and fixed boundaries:
  inspection-only, not ordinary-result/eligibility/ranking evidence, no
  selected-part model or samples, no physical-fidelity, commercial, KiCad
  attestation, or release authority. The CSV remains rectangular RFC 4180;
  every byte verifier rerenders against the already-authorized sidecar and
  cannot replace the installed application leaf's context assertion.
- The customized-target inspection receipt is a separate internal portable
  envelope. It embeds the exact customized-result sidecar and fixed-order,
  exact UTF-8 byte length/SHA-256/kind/filename/MIME descriptors for both
  customized inspection artifacts. Parsing and the canonical self-hash prove
  integrity only; exact artifact replay remains required and confers no
  installed-context, ordinary-result, eligibility, ranking, selected-model,
  simulation, commercial, or attestation authority. Its runtime functions are
  absent from the package root and export map.
- `exportDesignResultKicadSchematicV2` emits deterministic KiCad 8-era
  [documented `.kicad_sch` S-expressions](https://dev-docs.kicad.org/en/file-formats/sexpr-schematic/)
  for one selected V2 candidate circuit after both
  its engineering and execution contexts verify. Embedded symbols and geometry
  are authored by this project: exact point-union connectivity is encoded with
  local labels and persisted wire paths are visible graphical polylines. The
  required KiCad `Footprint` fields remain explicitly empty because the V2
  contract does not contain reviewed KiCad footprint identifiers. Visible text
  carries structural/simulation/footprint/omission boundaries and exact result,
  candidate, and context references. `parseDesignResultKicadSchematicV2`
  strictly parses the S-expression, regenerates all metadata and bytes, and
  rejects reference, value, connectivity, footprint, graph, or provenance
  drift. The ordinary test suite remains internal-only and does not treat that
  parser as external evidence. An opt-in external CLI harness is available,
  but no local `kicad-cli` result is currently attached to these artifacts.
- `createPowerPhysicalImplementationHandoffV1` is a separately
  content-addressed, exact-context handoff for the frozen Power 3.4.4
  quantity-one predecessor observation. It binds the result, candidate, recipe,
  structural circuit,
  all seven selected profile/admission identities, physical source locators and
  hashes, deterministic refdes, project-authored structural-symbol hashes, and
  structural pin-to-net assignments. The reviewed profile evidence genuinely
  establishes exact package names and conservative package/land-pattern
  envelopes, so those facts are retained with their source paths. It does not
  establish an exact KiCad footprint identity or a complete package-pin map.
  In particular, the persisted TPS54302DDCR symbol has five functional ports
  for a reviewed six-pin package. Every line therefore carries deterministic
  `physical_pin_mapping_unavailable` and
  `kicad_footprint_identity_unavailable` diagnostics; the regulator also
  carries `structural_symbol_not_package_complete`.
  `exportFootprintAssignedPowerKicadSchematicV1` consequently fails closed and
  emits no bytes. Placement is `not_emitted`, routing is `unrouted`, physical
  verification is `unverified`, and the contract fixes `attestation`, physical
  fidelity, eligibility authority, simulation fidelity, and manufacturing
  output claims to `none`. The strict parser checks the closed envelope and
  canonical self-hash; `verifyPowerPhysicalImplementationHandoffV1` additionally
  recreates the handoff from the exact result and engineering context, rejecting
  even validly rehashed source or semantic drift. Existing electrical,
  behavioral, SVG, report, and empty-footprint structural KiCad artifacts remain
  unchanged.
- `createPowerPhysicalImplementationHandoffV2` is the additive physical-handoff
  envelope for the immutable Power 3.4.5/3.4.6 exact-reference-passive successors. It
  preserves one Murata `GRM32ER71E226KE15L` BOM line at quantity two while
  binding two distinct assembly instances and refdes (`output-capacitor-1` / C3
  and `output-capacitor-2` / C4); it never substitutes one artificial 44 uF
  component. The handoff separately content-addresses the exact selected BOM,
  every BOM line, catalog-release reference, complete reviewed-admission entry,
  physical-source reference, structural symbol, circuit, recipe, candidate,
  request, result, library, and engineering context. It also binds the exact Bel
  `F1F2-0804-100M` 10 uH profile. Both capacitor instances and every other
  physical instance retain unavailable footprint identities and physical-pin
  mappings. As in V1, attestation, physical fidelity, candidate-eligibility
  authority, simulation fidelity, and manufacturing-output authority are all
  `none`; placement is not emitted, routing is unrouted, and verification is
  unverified. `exportFootprintAssignedPowerKicadSchematicV2` therefore fails
  closed and emits no bytes. V1 remains the unchanged quantity-one predecessor.
- `exportDesignResultPrintableReportV2` emits deterministic, self-contained
  print-ready HTML for one exact candidate only after its V2 engineering
  context regenerates byte-identically. It includes the complete electrical
  request, result/library/manifest/candidate provenance, BOM and circuit/BOM
  representation boundaries, derived values, constraint actual/limit/margin
  and evidence-reference state, metrics, warnings, and every persisted
  scenario/coverage limitation. Visible notices explicitly exclude commercial
  data and simulation samples/attestation, limit circuit fidelity to the
  structural projection, and make no PCB, footprint, thermal, physical, or
  independent-review claim. The HTML has no remote assets or executable
  scripts. `parseDesignResultPrintableReportV2` resource-bounds the document,
  canonical-parses its embedded metadata, regenerates every semantic field and
  exact HTML byte, and rejects visible or metadata drift.
- `createDesignScenarioSimulationProvenanceV2` accepts only a behavioral
  scenario whose exact V2 engineering/execution contexts validate, whose
  regenerated netlist hash matches the local-worker execution receipt, and
  whose finite sample/vector hash recomputes exactly. It records the exact
  engineering-context manifest hash; the receipt pins the ngspice/WASM build
  identity but explicitly records `attestation: none`;
  integrity is verifiable, while independent execution attestation is not
  claimed. `exportDesignResultScenarioSimulationCsvV2` emits those bound
  samples with canonical metadata, and
  `parseDesignResultScenarioSimulationCsvV2` re-runs every context, netlist,
  analysis, receipt, sample, and byte check. The artifact remains behavioral
  waveform evidence only and cannot enter candidate ranking or V2 metrics.
  Production Simulation CSV and Simulator handoff remain disabled until actual
  pinned-engine samples and an exact matching receipt exist; availability of a
  Scenario SPICE deck alone supplies neither.
- Authorized snapshot, commercial overlay, bundle, and commercial BOM V2
  exports require the exact provider-approved operation and persistence target.
  User-local commercial data cannot enter transferable bytes.

## Opt-in external KiCad QA

Run the external check only on a machine or CI runner with KiCad 8, 9, or 10:

```sh
npm run qa:kicad-external --prefix packages/design-export
```

Set `KICAD_CLI` to an absolute executable path when `kicad-cli` is not on
`PATH`. The command regenerates one synthetic Motor and one synthetic Power V2
schematic from exact fixture catalog, recipe, ranking, compiler, engineering,
and execution contexts. It writes each exact input into a new operating-system
temporary directory, reads the bytes back, and invokes the documented
`kicad-cli sch export pdf --output OUTPUT INPUT` path. A zero exit status and a
new non-empty PDF are required for both fixtures.

The planner and report parser live at the explicit Node-only
`@opencircuit/design-export/external-kicad-qa` subpath; they are not re-exported
from the browser-facing package root.

On success, `report.json` in the printed temporary directory binds the KiCad
version, every command, the exact input and PDF output hashes, both result and
engineering-context hashes, and the report hash. The report records the
harness's assertion that a locally invoked CLI process returned success and
produced PDF bytes for those exact structural schematics. The report alone does
not prove that execution occurred, authenticate the machine or execution
context, or provide the reported PDF bytes for independent verification. It
carries `attestation: none`; its schema, self-hash, and recorded identities are
checkable, but execution remains self-reported. It does not prove an interactive
GUI open/save without repair, visual quality, footprint mapping,
production-profile admission, physical correctness, or simulation fidelity.
The checked-in fake-executable tests exercise planning, fail-closed behavior,
and report parsing only; they do not persist or qualify as external evidence.

If KiCad is missing or unsupported, the command exits nonzero and emits no
passing report. This external invocation is intentionally absent from ordinary
workspace tests.
