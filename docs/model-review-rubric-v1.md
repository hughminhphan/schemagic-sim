# Model review rubric v1

**Status: v1 draft, needs Hugh's freeze.** Nothing here is binding until it is frozen. Until then, treat a disagreement between this document and the code as a question for the reviewer, not as a defect in either.

## What this is

A versioned, machine-checkable checklist a second model lane runs over a candidate package **before** it is promoted from staging into `packages/model-library/models`. It is deliberately mechanical: every item names the command or check that decides it, and one of three dispositions.

Dispositions:

| disposition | meaning |
| --- | --- |
| **approve** | the item holds; it contributes nothing to the promotion decision |
| **demote with reason** | the package may still be promoted, at a lower fidelity tier, with the reason written into `component.json` `known_omissions` and therefore into `MODEL_CARD.md` |
| **reject** | the package is not promoted at all, and the reason goes back to the lane that produced it |

The line between demote and reject is the same one the evidence contract draws in code: **absent evidence demotes, contradicted evidence rejects.** A package that claims less than it could is honest. A package built on evidence that disagrees with itself is a wrong claim about a real part, and no tier makes that acceptable.

## How to run it

From the repository root, with the model-factory virtualenv present:

```sh
PKG=packages/model-library/models/<manufacturer>/<mpn>

node packages/component-schema/validate-package.mjs "$PKG"            # schema + internal consistency
node packages/model-library/validate-library.mjs                       # the whole library still validates
node --test tools/model-factory/test/*.test.mjs                        # factory suite, node and python
tools/model-factory/.venv/bin/python tools/model-factory/test/bench_persistent_fit.py
```

For a MOSFET package carrying the strict evidence contract, add `--require-evidence-contract` to the package validation.

---

## R1. Hard bounds versus published maxima

**Claim at risk:** a model that exceeds a published maximum asserts the part does something the manufacturer says it does not.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R1.1 | Every `numeric_bounds` entry in `component.json` lies inside the datasheet's absolute maximum ratings for the same quantity. | read `component.json` `numeric_bounds` against the cited `sources.json` pages | reject |
| R1.2 | No fitted parameter exceeds a published maximum for the same quantity (a Zener BV against VZ MAX, a MOSFET VTO against VGS(th) MAX, a BJT BF against hFE MAX). | `fitted.json` `parameters` against the cited table rows; the MOSFET case is enforced in code and covered by `MOSFET F2 VTO never exceeds a complete published threshold maximum` | reject |
| R1.3 | A published **maximum** was used as an inclusive bound and never as a fitted target. | `fitted.json` `calibration.constraints` must carry the maximum rows; `calibration.observations` must not | reject |
| R1.4 | A published **minimum** is satisfied inclusively, with any headroom declared. | `fitted.json` residual rows for minimum-role evidence | demote with reason |
| R1.5 | For a diode with breakdown, the modelled reverse voltage at each cited IZT lies inside the published VZ window. | `fitted.json` `zener_window_checks[].inside_published_window` | reject |
| R1.6 | The model's pre-breakdown reverse current does not exceed the published leakage maximum. | `fitted.json` `reverse_leakage_checks[].within_published_maximum` | demote with reason |

## R2. Curve identity

**Claim at risk:** a curve taken from another figure, another trace, another bias or another device, fitted as if it described this part at this condition.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R2.1 | Every fitted curve carries a complete `citation_identity`: source hash, integer page, and figure plus trace (or table plus row). | `fitted.json` residual rows; enforced by `citationIdentity` | reject |
| R2.2 | The curve's abscissa and ordinate are the quantities the characteristic requires, not a name that merely reads similar. | covered by `production MOSFET curve fields fail closed ...`; a derating curve fitted as an I-V curve is the precedent this exists for | reject |
| R2.3 | Each residual row resolves to exactly one point of exactly one fitter-used curve. | enforced for diodes by `Diode F2 residual ... does not resolve exactly once` | reject |
| R2.4 | The fixed bias of the curve (VDS for a transfer family, VGS for an output family) is stated and matches the typed field. | `structured electrical bias disagrees with test_conditions` | reject |
| R2.5 | Curves the fitter rejected are listed with the reason. | `fitted.json` `curves_rejected` | demote with reason |
| R2.6 | No curve is admitted at all where the archetype requires one. | `evidence_contract.rules` | demote with reason |

## R3. Temperature convention

**Claim at risk:** presenting a measurement at a temperature the source never gave, or merging two temperatures into one condition and thereby claiming a temperature coefficient of zero.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R3.1 | No single condition mixes two temperatures. | `evidence mixes temperatures` / `must state exactly one temperature` | reject |
| R3.2 | The temperature **kind** is junction, ambient or case, and is carried into the condition identity rather than assumed. | `condition_identity.temperature.kind` | reject |
| R3.3 | Each bench runs at the exact temperature its evidence cites, not at a nominal 25 degC. | `tests/*.cir` `.temp` line against the row's cited temperature | reject |
| R3.4 | An F2 package states a temperature for every admitted condition. | `evidence_contract.rules` entry `stated_temperature` | demote with reason |
| R3.5 | The package's omissions say that temperature dependence and self-heating are not modelled. | `component.json` `known_omissions` | demote with reason |

## R4. Units

**Claim at risk:** a 1000x error. A milliamp ordinate read as amps makes the part look a thousand times stronger than it is, and every current in every circuit built from it is wrong.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R4.1 | Every axis and every scalar declares a unit the SI normaliser recognises; an unrecognised unit is refused, never assumed SI. | `requires voltage and current axes with recognized SI units` | reject |
| R4.2 | The declared unit is applied. A curve declared in mA produces SI points 1000x smaller than the same curve declared in A. | `gate: a curve's declared axis units are still applied ...` | reject |
| R4.3 | SI prefixes on catalog seed hints are normalised before use, and the normalised value is still labelled a seed. | `hintNumber`; `fitted.json` `calibration.seeds[].evidence_role` | reject |
| R4.4 | Emitted card values agree with `fitted.json` to within 5e-10 relative. | `assertEmittedParametersMatchFitted` | reject |

## R5. Identity and alias collisions

**Claim at risk:** two packages under different part numbers asserting that two distinct parts were independently measured, when one fit was copied; or a dual-die part modelled as a single device.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R5.1 | The canonical MPN and every ordering-code alias are absent from the reviewed library. | `libraryCollisionReason` | reject |
| R5.2 | The fitted die vector does not duplicate a reviewed package's, and does not duplicate another candidate in the same batch. | `libraryDuplicateDieReason`; `gate: the collision and duplicate-die guards ...` | reject unless documented shared-die evidence is supplied, in which case demote with reason |
| R5.3 | A documented die sibling declares `inheritance.kind = documented_die_sibling` and keeps its own package metadata and provenance. | `fitted.json` `inheritance` | reject |
| R5.4 | A part with more than one die inside the package is not presented as one device. | `component.json` `symbol_pins` and `package_variants` against the datasheet's internal diagram | reject |
| R5.5 | Package pin maps cover every package pin exactly once, with no ambiguous mapping. | `normalizePackageVariants` | reject |

## R6. Native versus WASM parity

**Claim at risk:** a card that behaves one way in the reference simulator and another in the browser engine is two different models wearing one name.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R6.1 | Every bench runs through both native ngspice and the WASM engine. | `node tools/native-ngspice-reference/compare.mjs <bench>.cir --analysis op --json <out>` | reject |
| R6.2 | Both engines are recorded independently in `tests/expectations.json`, and neither is inferred from the other. | `strict expectation evaluation records native and browser-WASM independently and fails closed` | reject |
| R6.3 | Every cited expectation passes in both engines within its declared tolerance. | `node tools/model-factory/factory.mjs validate --mpn <MPN>` | reject |
| R6.4 | The native ngspice binary used is recorded, and it is the one the package will be revalidated against. | `NGSPICE_BIN` or the resolved path; `ngspice --version` | demote with reason |

## R7. Model-card omissions

**Claim at risk:** a reader assuming a package covers behaviour it never modelled. What a package does **not** claim has to be readable, not inferable from an absent file.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R7.1 | Every evidence rule that did not pass appears in `component.json` `known_omissions` and in `MODEL_CARD.md`. | `evidence_contract.rules` against `known_omissions` | reject |
| R7.2 | Every held default is listed with the reason it is held, not merely that it is. | `fitted.json` `held_defaults[].reason` | reject |
| R7.3 | Every parameter resting on a bound is declared as such rather than presented as fitted. | `fitted.json` `bound_saturation`; `optimizer.notes` | reject |
| R7.4 | The domains the package does not cover (AC, transient, noise, thermal, package parasitics, statistical spread) are named. | `component.json` `domain_coverage` and `known_omissions` | demote with reason |
| R7.5 | An F1 demotion states which F2 evidence did not qualify. | `known_omissions` demotion line | demote with reason |
| R7.6 | `reviewer` is not left at `pending-review` once promoted. | `component.json` `reviewer` | reject |

## R8. Provenance hashes

**Claim at risk:** a package whose recorded source is not the document it was actually built from cannot be re-derived, and its citations cannot be checked by anyone.

| # | check | command or inspection | disposition if it fails |
| --- | --- | --- | --- |
| R8.1 | `sources.json` carries a `sha256` of the exact datasheet bytes, a revision string and an access date, and `placeholder` is false. | `shasum -a 256 <datasheet.pdf>` against `sources.json` | reject |
| R8.2 | Every citation identity's `source_sha256` equals that hash. | `fitted.json` residual rows | reject |
| R8.3 | No citation is a placeholder (`pending`, `TBD`, `n/a`, `unknown`). | `PLACEHOLDER_CITATION` in `fit_conveyor.py` | reject |
| R8.4 | An adjudication supplement's `supplement_id` is the hash of its own content, and each target hash matches the immutable extraction subtree. | `applyConditionAdjudicationSupplement` | reject |
| R8.5 | No vendor `.lib` or `.cir` bytes are present, and no datasheet PDF is tracked. | `assertNoTrackedPdfs`; `git ls-files` | reject |
| R8.6 | Refitting the package from its own `facts.json` reproduces its shipped parameters. | family fitter against `facts.json`, diff `parameters` | reject |

---

## Reviewer output

A review run produces one row per item:

```json
{
  "rubric_version": "v1-draft",
  "package": "packages/model-library/models/<manufacturer>/<mpn>",
  "items": [{ "id": "R1.1", "disposition": "approve", "evidence": "<command output or file path>" }],
  "decision": "approve | promote-at-F1 | reject",
  "reasons": ["..."]
}
```

`decision` is the worst disposition across all items: any **reject** rejects; otherwise any **demote with reason** promotes at the lower tier with those reasons written into the model card; otherwise **approve**.

## Open questions for the freeze

1. Should R5.2 (duplicate die vector) ever be a demote rather than a reject when the two parts are documented siblings, or should the sibling-alias pipeline always be used instead?
2. R6.4 records the ngspice build but does not pin it. Should a package record the exact `ngspice --version` string it was validated against, so a later revalidation on a different build is visibly a different run?
3. R3.4 demotes an unstated temperature to F1. Is F1 the right floor, or should an unstated temperature cap the package below F1 entirely?
4. R1.4 treats headroom above a published minimum as a demotion. How much headroom is acceptable before it becomes a reject?
5. Should this rubric be executable (a `review-package.mjs` that emits the JSON above) before it is frozen, or frozen first and automated second?
