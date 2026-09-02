# Batch 10 salvage independent review log

Date: 2026-08-11

Reviewer: `gpt-5.6-sol independent reviewer`

## Review contract and outcome

1. Verified the repository tripwire at `/Users/hughp/Documents/opencircuit`, on `main`, with starting HEAD `7a7ecdc9abab5b879dfe6c5b7679de577b049fc2`.
2. Confirmed the shipping model library baseline was exactly 703 packages.
3. Reviewed exactly the nine complete packages named by `docs/campaigns/batch-10-salvage-selection.json`, `docs/campaigns/batch-10-salvage-execution.json`, and the final staging package tree.
4. Promoted zero packages and rejected all nine. The shipping library remains exactly 703 packages.
5. Promotion is blocked because correction commit `ca9b70cd5b2536f0949b8525a7f2f77d6b840548` contains material reusable F1 BJT parameter-derivation defects. No code was changed in this review lane.
6. Staging, model parameters, fitted vectors, gates, bounds, and the existing 703 package trees were not modified.

| Set | BJT NPN | BJT PNP | F1 | F2 | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reviewed | 6 | 3 | 8 | 1 | 9 |
| Promoted | 0 | 0 | 0 | 0 | 0 |
| Rejected | 6 | 3 | 8 | 1 | 9 |

Rejection classes: five require source-correct refitting, one has an unsupported F2 claim, and three otherwise viable F1 packages are withheld by the reusable-code block.

## Correction commit adjudication

Commit reviewed: `ca9b70cd5b2536f0949b8525a7f2f77d6b840548`, `fix(factory): enforce evidence-backed bulk contracts`.

Verdict: **BLOCK**.

### Material findings

#### 1. F1 BJT capacitance and fT formulas conflict with the existing archetype

`tools/model-factory/lib/bulk-adapter.mjs:202-208` assigns:

- `CJC` directly from cited Cobo measured at a nonzero reverse bias.
- `CJE` as cited Cibo minus cited Cobo.
- `TF` as `1/(2*pi*fT)`.

The existing BJT archetype at `tools/model-factory/python/fit_bjt.py:145-149,229-235` instead:

- Voltage-de-embeds Cobo and Cibo to zero-bias junction capacitances.
- Treats the cited input and output capacitances as separately biased measurements rather than subtracting Cobo from Cibo.
- Computes the total published fT delay, then subtracts capacitance and collector/emitter resistance delay before assigning TF.

The correction therefore does not produce the archetype-backed `CJC`, `CJE`, or `TF` values it claims to derive. This is material because AC parameters and cited fT or capacitance benches are affected.

#### 2. Gain bounds lose their bias conditions

`tools/model-factory/lib/bulk-adapter.mjs:191-199` collapses all hFE minimum rows into one global maximum-minimum and all maximum rows into one global minimum-maximum. It then compares and caps them as if they were measured at the same collector current and VCE.

BJT gain is current-dependent. A minimum at one current and a maximum at another are not a single scalar interval. The implementation can:

- Falsely reject valid current-dependent tables as inconsistent.
- Cap BF using a maximum measured at a different bias point.
- Hide which source row actually controls the selected parameter.

The sampled D882 record demonstrates this failure mode: source rows at different conditions were reduced to a global minimum of 200 and maximum of 120, then declared inconsistent.

#### 3. Saturation-derived parasitics are final parameters rather than archetype seeds

`tools/model-factory/lib/bulk-adapter.mjs:163-179,209-214` converts cited VCE(sat) and VBE(sat) rows directly into final `RC`, `RE`, and `RB` values.

The existing BJT archetype uses comparable slope calculations only as optimizer seeds. Native-ngspice fitting then determines the final parameters. The F1 path instead treats independent published maximum limits as exact observed slope points and performs no electrical fit. This is not equivalent to the existing archetype and contributed to repeated saturation-bound failures.

#### 4. Regression coverage locks in the conflicting formulas

`tools/model-factory/test/bulk-adapter.test.mjs:479-502` explicitly asserts:

- `TF = 1/(2*pi*fT)`.
- `CJC = Cobo`.
- `CJE = Cibo - Cobo`.
- Direct RC, RE, and RB slope values.

The test also mocks the ngspice runner. It verifies the implementation against its own formulas rather than checking archetype equivalence or measured source conditions. The suite passes while the material defect remains.

### Correction behavior that passed review

- Empty BJT `gain_points` are parked before fitting.
- The extraction path permits only one bounded retry for retryable contract failures.
- Polarity disagreement is rejected and never silently flips a model.
- Detected dual-BJT packages are parked under an unsupported package contract.
- Model comment text removes control bytes and unsafe OCR text without mutating factual source JSON.
- Diode `CJO` and `TT` transcription follows the diode archetype when cited evidence is present.
- Zener `BV` and `IBV` require VZ and IZT semantics and are not inferred from a maximum reverse-voltage rating.
- Inclusive hard bounds remain `value >= minimum` and `value <= maximum`.
- The correction commit changed no file beneath `packages/model-library/models`.
- No gate, source requirement, collision rule, or hard bound was weakened.

## Exact remediation requirements

Promotion must remain blocked until a separate code-fix lane does all of the following:

1. Make F1 BJT `CJC`, `CJE`, and `TF` derivation follow the existing archetype's bias de-embedding and delay accounting, or explicitly define and approve a different archetype contract with equivalent source benches.
2. Preserve collector-current, VCE, temperature, and source-kind conditions when evaluating hFE minima and maxima. Never compare or cap condition-specific rows as one global interval unless their conditions are identical.
3. Stop presenting saturation-limit slope seeds as independently derived final `RB`, `RC`, and `RE`. Either fit them through native ngspice under the existing archetype or retain disclosed defaults and narrow the supported claim.
4. Replace the mocked formula-only regression at `tools/model-factory/test/bulk-adapter.test.mjs:479-502` with source-condition fixtures that verify native-ngspice hFE, fT, Cobo, Cibo, VCE(sat), and VBE(sat) behavior at explicit 25 C.
5. Add regressions for gain minima and maxima at different collector currents so valid current-dependent tables are not falsely declared inconsistent.
6. Re-run the 82 Batch 10 inclusive-hard-bound failures after the fix without weakening bounds. Confirm the systematic near-minimum fT and capacitance misses are removed or honestly rejected.
7. Re-stage affected candidates through the corrected reusable path and conduct a new independent promotion review. Do not transplant or edit the current staged electrical vectors.

## Source and package audit

- Reproduced nine of nine cached primary PDF SHA-256 values.
- Verified all nine PDF page counts.
- Found zero source-hash mismatches.
- Cross-checked canonical identity, manufacturer, polarity, pin topology, signs, SI units, source-kind semantics, source conditions, package scope, and fitted-vector provenance.
- Scratch-copy package validators passed for all nine packages.
- Native ngspice and pinned WASM parity passed for all 39 staged benches.
- All 60 staged expectation checks passed, including 44 encoded hard bounds.
- All 39 benches contain explicit `.temp 25`.
- Worst native/WASM relative delta was `1.078588051750227e-6`; worst absolute delta was `6.635181727387973e-7`.

| Package | PDF pages | SHA-256 |
| --- | ---: | --- |
| `lrc/L2SC1623RLT1G` | 5 | `317064f993da5c37da13ec3db7886259108497fb3a5c1a88d2e7a8d618e6d185` |
| `lrc/LBC846BLT1G` | 13 | `5d5223eb912f5722058eaedea4ed8b654231d37b125ca22a2d2eca5044d9dcdb` |
| `foshan-blue-rocket-elec/MPSA94` | 6 | `5c440fc65566b507911b2051657f698c4875976532f4dcdd042a2d1722eed9a4` |
| `nexperia/PMST3906-115` | 11 | `6c77885c159f9b2f6c545126d4f37ee8a45cf4427d7adaabfff83df6427900c1` |
| `hxy-mosfet/BCX56` | 5 | `60e544c8d70e3cf909786648bec9667e2dba4f6eede2c8ec043157e1eda0adc9` |
| `jiangsu-changjing-electronics-co-ltd/FMMT619` | 4 | `e514be17c1481e25b553ff2e2f747bca5723dbec2549eaf7b4bd656d6fb23ced` |
| `onsemi/SMMBT5551LT1G` | 6 | `9f5d518b3ce13e1ff70bd429f524f7b7998b0fa39d2bced1d0c989782544ed1a` |
| `shikues/FCX591` | 2 | `35a83ead7b85ab11719810f5fd04e38c963896f3012bec6470edfb47514fd5af` |
| `pjsemi/FMMT617` | 4 | `61f21b80f9a7e2c9d169635bf178cf44174a414c2f67b390fd37f18348d1292e` |

### Identity and collision audit

Against all 703 reviewed packages and all nine candidates:

- Canonical identity or alias collisions: zero.
- Complete family-aware fitted-vector collisions: zero.
- Candidate-to-candidate identity or alias collisions: zero.
- Candidate-to-candidate complete-vector collisions: zero.
- Shared-die exceptions: zero.

## F2 claim adjudication

The only F2 package is `lrc/LBC846BLT1G`.

Unchanged gates:

- RMS relative current error at most `0.12`.
- Worst relative current error at most `0.20`.
- Optimizer-bound saturation tolerance `1e-6`.
- Explicit model evaluation temperature 25 C.

Fresh deterministic recomputation against the staged point set produced:

- RMS relative error: `0.03408208221364545`.
- Worst relative error: `0.04828351492424193`.
- Optimizer evaluations: 10.
- Optimizer status: 2.
- Optimizer-bound saturation: none.

The numerical gates pass only against the staged points:

- hFE 350 at 1 mA.
- hFE 330 at 10 mA.
- hFE 310 at 100 mA.
- hFE 270 at 1 A.

The citation is PDF p. 6 Figure 9, LBC846B at 25 C and VCE = 1 V. The plotted source curve rolls off sharply and does not support the staged 100 mA and 1 A values. The model was fitted to a materially misread point set. A source-correct F2 claim requires an electrical refit, so the package is rejected without changing the gates.

## Exact 25 C source-bound probes for otherwise viable F1 packages

Nine independent native-ngspice solves hit the source collector currents and passed the inclusive source hFE bounds.

| Package | IC | VCE | Fresh hFE | Inclusive bounds | Verdict |
| --- | ---: | ---: | ---: | --- | --- |
| `foshan-blue-rocket-elec/MPSA94` | 0.001 A | -10 V | 88.3476205 | minimum 70 | PASS |
| `foshan-blue-rocket-elec/MPSA94` | 0.01 A | -10 V | 88.2807788 | 80 through 300 | PASS |
| `foshan-blue-rocket-elec/MPSA94` | 0.1 A | -10 V | 88.0433279 | minimum 40 | PASS |
| `hxy-mosfet/BCX56` | 0.005 A | 2 V | 64.4538795 | minimum 40 | PASS |
| `hxy-mosfet/BCX56` | 0.15 A | 2 V | 64.2964149 | 63 through 250 | PASS |
| `hxy-mosfet/BCX56` | 0.5 A | 2 V | 64.0308064 | minimum 25 | PASS |
| `onsemi/SMMBT5551LT1G` | 0.001 A | 5 V | 84.3076143 | minimum 80 | PASS |
| `onsemi/SMMBT5551LT1G` | 0.01 A | 5 V | 84.2499311 | 80 through 250 | PASS |
| `onsemi/SMMBT5551LT1G` | 0.05 A | 5 V | 84.1727469 | minimum 30 | PASS |

These passes do not override the reusable-code block. `MPSA94` and `BCX56` would also require evidence-backed metadata, scope, and expectation corrections. `SMMBT5551LT1G` is otherwise source-consistent.

## Inclusive hard-bound failure sample

The execution record contains 82 packages classified as inclusive hard-bound failures. A nine-package representative sample covered saturation, gain, fT, capacitance, and operating-bound failures.

Across the 82 records, with categories overlapping:

- 41 mention a minimum-fT failure.
- 15 mention a Cobo expectation failure.
- 59 mention VCE(sat).
- 49 mention VBE(sat).
- 13 mention an hFE bound.
- 8 mention an upper-current boundary.

| Order | MPN | Evidence | Adjudication |
| ---: | --- | --- | --- |
| 373 | `2SC1815` | VCE(sat) 0.3215800924 V exceeded maximum 0.25 V. | Honest model failure. |
| 374 | `SS8550(RANGE:120-200)` | F1 VBE(sat) 1.6788752630 V exceeded 1.2 V; fT 99.7127766 MHz missed 100 MHz. | Honest saturation failure plus systematic TF under-target. |
| 375 | `S9015` | F1 fT 149.8630918 MHz missed 150 MHz. | Systematic TF under-target. |
| 379 | `FMMT491(RANGE:100-300)` | F2 hFE 99.1153396 missed 100 and VBE(sat) 1.9186815 V exceeded 1.1 V; F1 also missed saturation and fT. | Honest DC failures plus systematic TF under-target. |
| 380 | `BC847QASZ` | F1 VCE(sat) 0.1047709599 V and 0.3072899668 V exceeded 0.1 V and 0.3 V; fT 98.8029337 MHz missed 100 MHz. | Honest saturation failures plus systematic TF under-target. |
| 381 | `BCW71,215` | fT 99.4735713 MHz missed 100 MHz and Cobo 1.0379633923 pF exceeded its allowed typical error. | Systematic TF and biased-capacitance derivation defects. |
| 385 | `D882` | F2 missed three 1 A hFE minima and VBE(sat); F1 declared global minimum 200 inconsistent with global maximum 120. | Honest F2 failure plus condition-discarding aggregation defect. |
| 401 | `MMBT3906T(RANGE:100-300)` | F1 fT 241.8116454 MHz missed 250 MHz and Cobo 2.2966174857 pF exceeded its allowed typical error. | Systematic TF and biased-capacitance derivation defects. |
| 465 | `2SA1013` | hFE 331.400498 exceeded 320; VCE(sat) 1.6023596280 V exceeded 1.5 V; VBE(sat) 1.7355505189 V exceeded 0.75 V. | Honest inclusive-bound failures. |

Conclusion: the inclusive comparison is correct and must remain unchanged. Many failures are honest consequences of coarse models. The sample also demonstrates systemic derivation defects that explain repeated near-minimum fT and capacitance failures. The correct response is to fix the parameter semantics and rerun the bounded campaign, not loosen any bound.

## Package dispositions

| Order | Staged package | Tier | Family | Verdict | Reason |
| ---: | --- | --- | --- | --- | --- |
| 408 | `lrc/L2SC1623RLT1G` | F1 | bjt_npn | rejected | The R ordering rank is hFE 180 through 390. The staged extraction and BF 121.2 represent the generic 120 through 560 family range. Refit required. |
| 440 | `lrc/LBC846BLT1G` | F2 | bjt_npn | rejected | Fresh residuals pass only against staged points that do not match the cited 25 C source curve. Source-correct F2 fitting is required. |
| 442 | `foshan-blue-rocket-elec/MPSA94` | F1 | bjt_pnp | rejected | The model passes corrected source hFE bounds, but staged facts shift the first three currents by a factor of ten, cite nonexistent PDF page 7, and retain an unsupported curve claim. Metadata-only corrections are possible, but promotion is blocked by reusable code. |
| 464 | `nexperia/PMST3906-115` | F1 | bjt_pnp | rejected | The source supplies additional hFE minima, a 10 mA range, fT, and capacitance evidence. The staged package retains only the 0.1 mA minimum and BF 60.6. Refit required. |
| 486 | `hxy-mosfet/BCX56` | F1 | bjt_npn | rejected | The model passes the source-correct hFE conditions. Staged saturation source semantics need metadata correction, but promotion is blocked by reusable code. |
| 493 | `jiangsu-changjing-electronics-co-ltd/FMMT619` | F1 | bjt_npn | rejected | The source has multiple hFE minima, a 6 A typical point, minimum fT, maximum Cob, and saturation limits. Staged gain evidence is malformed, revision metadata is OCR noise, and source-correct fitting is required. |
| 505 | `onsemi/SMMBT5551LT1G` | F1 | bjt_npn | rejected | Source evidence and exact gain bounds pass. The package is otherwise viable but withheld by the reusable-code block. |
| 512 | `shikues/FCX591` | F1 | bjt_pnp | rejected | The source hFE range is 100 through 300 at 500 mA. Staged facts treat maximum 300 as typical at 0.1 uA and derive BF from the published maximum. Refit required. |
| 523 | `pjsemi/FMMT617` | F1 | bjt_npn | rejected | The source specifies minimum fT 150 MHz at 50 mA and VCE 10 V. Staging records 100 MHz at malformed conditions and derives TF from 100 MHz. Refit required. |

## Tests and typechecks

- `npm test --workspace=@opencircuit/model-library`: PASS, component-schema validated all 703 packages.
- `npm test --prefix tools/model-factory`: PASS, 52 tests.
- `npm test --prefix tools/conveyor`: PASS, 20 tests.
- `npm run typecheck --prefix tools/conveyor`: PASS.
- `npm test --prefix tools/part-feeder`: PASS, 9 discovered, 5 active passed, 4 skipped.
- `npm run typecheck --prefix tools/part-feeder`: PASS.
- `npm test`: PASS, 99 workspace tests.
- `npm run typecheck`: PASS, all six TypeScript workspace typechecks.
- Scratch-copy staged package validation: PASS, 9 packages, 39 native/WASM benches, 60 expectation checks, and 44 hard bounds.

The four part-feeder skips are expected: one live smoke test is opt-in and three freeze tests require ignored scale-2k inputs absent from this checkout.

## Reproducibility and repository audits

- Final staged package trees: 120 files, 285,693 bytes, aggregate SHA-256 `fbe8d3d71a6b5d46b930557fd90de932fb9d48645638e3abcce392856b202375`.
- Whole Batch 10 salvage staging tree: 1,741 files, 146,146,484 bytes, aggregate SHA-256 `317c9951e04f98c6055b0c15a7fa52efd4936e89652a30f0953af78b4db2f9ec`.
- No package was copied into `packages/model-library/models`.
- No promoted package, parameter file, fitted vector, expectation, or model card exists because the promoted set is empty.
- No staging file changed.
- No existing reviewed package changed.
- No gate, bound, collision implementation, conveyor implementation, model-factory implementation, feeder implementation, or freeze record changed.
- No push, deploy, publication, GitHub comment, later-order selection, or Vault update was performed.

## Deviations

- Promoted-package validation and promoted-copy byte-identity checks are vacuous because promotion was blocked before any copy operation.
- No electrical or metadata correction was applied to any staged package.
- The shipping library remains at its verified 703-package baseline.
