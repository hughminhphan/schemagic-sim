# Batch 9 independent review log

Date: 2026-08-11

Reviewer: `gpt-5.6-sol independent reviewer`

## Review contract and outcome

1. Verified the repository tripwire at `/Users/hughp/Documents/opencircuit`, on `main`, with starting HEAD `321d13a2cc1c1a02c06242da97337c84d4d9e0fb`.
2. Confirmed the shipping library baseline was exactly 692 packages and reviewed exactly the 30 complete final package trees named by the Batch 9 execution record and staging manifest.
3. Promoted 11 evidence-supported packages and rejected 19. The shipping library now contains exactly 703 packages.
4. Preserved every promoted `model.cir` and `fitted.json` byte-for-byte. Only promoted-copy evidence metadata, source wording, supported scope, reviewer state, and expectation benches were corrected.

| Set | BJT NPN | BJT PNP | F1 | F2 | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reviewed | 21 | 9 | 24 | 6 | 30 |
| Promoted | 8 | 3 | 7 | 4 | 11 |
| Rejected | 13 | 6 | 17 | 2 | 19 |

Rejection classes: 11 refit required, 4 unsupported physical package contracts, 2 polarity or electrical changes required, and 2 unsupported F2 claims.

## Scale-2k freeze adjudication

Verdict: **PASS**.

- Rebuilt all 936 frozen rows from the read-only 5,656,805,376-byte catalog database. The regenerated manifest SHA-256 is `c003a37a26c5ce343ed884a38801d9a5acdbac17412d409dc2fd9c1b5ddf790e`, an exact byte-for-byte match to the frozen record.
- The tracked SQL SHA-256 is `c1bd13f4b5b2ef94b69977ceaa842682f2e488670ac6f9f94107640e6165886b`; the database SHA-256 is `08b59bec3b8a35b1da52b0e9a6000ba190c1e1197c92d350b529a6b75fbe51c9`.
- Deterministic output is 161 BJT, 349 diode, and 426 MOSFET rows, with contiguous frozen orders 370 through 1305.
- Sequential exclusions reproduced exactly: 990 scale-1k LCSC IDs, 634 reviewed canonical identities or aliases, 16 quarantined LCSC IDs, and 174 normalized-MPN duplicates.
- Batch 9 is exactly the contiguous 160-row order interval 370 through 529. The fresh freeze sequence matches the selection record, staging manifest, and execution outcomes. It contains 160 unique orders, 160 unique LCSC IDs, no digital-transistor row, and no bridge row.
- Reviewed canonical and alias exclusion, normalized-MPN deduplication, digital-transistor exclusion, and bridge exclusion all passed.

## Execution yield and collision evidence

- 160 targets produced 30 final staged packages and 130 failures or skips.
- Failure categories: 71 complete-vector collisions, 38 factory or validation failures, 10 inclusive hard-bound failures, 6 source-evidence failures, 4 package-schema or evidence failures, and 1 datasheet acquisition failure.
- The 71 vector collisions are 44.375% of all targets. Eleven collapsed onto `lrc/LMBT3904DW1T1G`, eight onto `diodes-inc/MMBT3904-7-F`, six onto `mcc-micro-commercial-components/MMSS8050-H-TP`, and five each onto `hongjiacheng/MMBT4401` and `nexperia/PMBT2907A`.
- This concentration is process evidence that sparse BJT tables plus shared F1 defaults often produce identical complete vectors for unrelated catalog identities. It is not evidence that the collision rule is too strict. The rule prevented duplicated electrical behavior from being presented as catalog breadth and remains unchanged.

## Source and staged-package audit

- Reproduced 30 of 30 cached primary PDF SHA-256 values. Every source record matched its facts record, all cited page numbers were within the cached PDF page count, and each extraction record matched the staged `facts.json` before promoted-copy corrections.
- Verified canonical identity, ordering suffix semantics, manufacturer, package contract, pin roles, polarity, signs, SI units, min/typ/max semantics, source conditions, and supported region against the primary PDFs.
- Package validators: 30 of 30 passed.
- Native ngspice-46 and pinned WASM benches: 95 of 95 passed.
- Staged expectations: 121 of 121 passed, including 74 of 74 encoded hard bounds.
- Explicit `.temp 25`: 95 of 95 benches.
- Worst native/WASM relative delta: `6.004309290589692e-7`; worst absolute delta: `2.67321759062078e-7`.
- A separate source-derived hard-bound pass generated 68 probes across 18 applicable staged packages; all 18 scratch package validations passed. Passing a staged extraction did not override primary-source defects.

## F2 claim adjudication

Unchanged BJT F2 gates are RMS relative current error <= 0.12 and worst relative current error <= 0.20. Optimizer-space bound saturation tolerance remains `1e-6`. No F2 candidate saturated an optimizer bound.

| Package | Exact source curve and bias | Points | Fresh RMS | Fresh worst | Source verdict | Disposition |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `hxy-mosfet/S9014` | PDF p. 2 hFE versus IC, Ta = 25 C, VCE = 5 V, 0.0001 to 0.1 A | 5 | 0.049127669 | 0.080765883 | supported | promoted-f2 |
| `infineon/BFP420H6327` | p. 8 Figure 6, Ta = 25 C, VCE = 3 V, 0.0001 to 0.05 A | 4 | 0.011105972 | 0.016829767 | supported | promoted-f2 |
| `lrc/L8050QLT1G` | PDF p. 3 Figure 1, Ta = 25 C, VCE = 1 V, 0.00001 to 0.8 A | 6 | 0.021373653 | 0.037326929 | supported | promoted-f2 |
| `lrc/LBC847BLT1G` | Staged citation p. 6 Figure 9 is LBC846B; correct LBC847B group is p. 8 Figure 17 | 4 | 0.034082022 | 0.048283515 | unsupported | rejected-unsupported-f2 |
| `lrc/LMBT5401LT1G` | p. 3 Figure 1, Ta = 25 C dashed trace, VCE = -5 V, |IC| 0.001 to 0.1 A | 5 | 0.073817884 | 0.091725581 | supported | promoted-f2 |
| `nexperia/BCP68-115` | p. 7 Figure 15 trace 2 at 25 C; staged hFE values do not match the plotted curve | 5 | 0.013884522 | 0.022908398 | unsupported | rejected-unsupported-f2 |

`lrc/LBC847BLT1G` and `nexperia/BCP68-115` pass numerical residual gates only against unsupported staged point sets. Primary-source curve identity, axes, units, bias, and sampled values control disposition, so both are rejected without weakening the gates.

## Exact 25 C gain hard bounds for survivors

All 19 independently solved native probes hit the cited collector-current target and passed inclusive source bounds. The same reviewer benches also passed pinned WASM parity after promotion.

| Package | IC | VCE | Fresh hFE | Inclusive bounds | Verdict |
| --- | ---: | ---: | ---: | --- | --- |
| `diodes/FMMT624TA` | 0.01 A | 10 V | 491.769009480 | 200 | PASS |
| `diodes/FMMT624TA` | 0.2 A | 10 V | 491.208503143 | 300 | PASS |
| `diodes/FMMT624TA` | 1 A | 10 V | 490.122192639 | 100 | PASS |
| `hongjiacheng/MMST5551` | 0.001 A | 5 V | 84.308505822 | 80 | PASS |
| `hongjiacheng/MMST5551` | 0.01 A | 5 V | 84.258846512 | 80 to 300 | PASS |
| `hongjiacheng/MMST5551` | 0.05 A | 5 V | 84.217323921 | 30 | PASS |
| `hongjiacheng/S9018` | 0.001 A | 5 V | 73.769939664 | 70 to 200 | PASS |
| `hxy-mosfet/S9014` | 0.001 A | 5 V | 281.786277386 | 200 to 1000 | PASS |
| `infineon/BFP420H6327` | 0.02 A | 4 V | 85.793534577 | 60 to 130 | PASS |
| `jiangsu-changjing-electronics-co-ltd/PZTA92` | 0.001 A | -10 V | 43.737370119 | 25 | PASS |
| `jiangsu-changjing-electronics-co-ltd/PZTA92` | 0.01 A | -10 V | 43.712780016 | 40 | PASS |
| `jiangsu-changjing-electronics-co-ltd/PZTA92` | 0.03 A | -10 V | 43.699476080 | 25 | PASS |
| `lrc/L8050QLT1G` | 0.1 A | 1 V | 173.480447809 | 150 to 300 | PASS |
| `lrc/LMBT5401LT1G` | 0.001 A | -5 V | 59.576603599 | 50 | PASS |
| `lrc/LMBT5401LT1G` | 0.01 A | -5 V | 97.238193307 | 60 | PASS |
| `lrc/LMBT5401LT1G` | 0.05 A | -5 V | 95.235341152 | 50 | PASS |
| `onsemi/MMBTH81` | 0.005 A | -10 V | 65.580617930 | 60 | PASS |
| `rohm-semicon/2SC4617TLR` | 0.001 A | 6 V | 191.512697596 | 180 to 390 | PASS |
| `umw-youtai-co-ltd/MMBTH10` | 0.004 A | 10 V | 65.584210406 | 60 | PASS |

## Identity, alias, and vector collisions

- Against the 692-package baseline, the 30 candidates introduced zero normalized canonical or alias collisions and zero complete family-aware fitted-vector collisions.
- Candidate-to-candidate comparison found zero normalized identity groups and zero complete fitted-vector groups.
- The final 703-package library has zero identity groups and zero fitted-vector groups involving a Batch 9 promotion. Seven complete-vector groups are pre-existing baseline groups and are unchanged.
- No shared-die exception was needed.

## Package dispositions

| Order | Staged package | Tier | Electrical family | Verdict | Corrections or rejection |
| ---: | --- | --- | --- | --- | --- |
| 371 | `lrc/L8050QLT1G` | F2 | bjt_npn | promoted | Narrowed F2 scope to the exact 25 C, VCE = 1 V curve and sampled current range; Added an exact inclusive Q-rank hFE probe, 150 through 300 at 100 mA. |
| 372 | `lrc/LMBT3904DW1T1G` | F1 | bjt_npn | rejected | The source device is a dual NPN transistor, while the staged package represents one three-pin NPN transistor. |
| 414 | `hxy-mosfet/S9014` | F2 | bjt_npn | promoted | Corrected the hFE curve citation from PDF p. 3 to PDF p. 2 in promoted source metadata, expectations, and model card; Narrowed F2 scope to the exact 25 C, VCE = 5 V curve and sampled collector-current range; Added an exact table hFE range probe. |
| 415 | `lrc/LMBT5401LT1G` | F2 | bjt_pnp | promoted | Narrowed F2 scope to the exact 25 C dashed trace at VCE = -5 V and sampled current range; Added exact gain-minimum reviewer probes at all three cited table currents. |
| 422 | `nexperia/BCP68-115` | F2 | bjt_npn | rejected | Numerical residuals pass only against staged points that do not match the cited 25 C source curve. The source low-current plateau is about 260, not the staged 70 to 100 values. |
| 424 | `diodes/FMMT624TA` | F1 | bjt_npn | promoted | Finalized reviewer metadata; Added exact 25 C gain-minimum reviewer probes at all three cited collector currents. |
| 426 | `fuxinsemi/BC857BS` | F1 | bjt_pnp | rejected | The source device is a dual PNP transistor, while the staged package represents one three-pin transistor. |
| 430 | `hongjiacheng/S9018` | F1 | bjt_npn | promoted | Finalized reviewer metadata; Added an exact 25 C inclusive hFE range probe at 1 mA. |
| 434 | `hongjiacheng/MMST5551` | F1 | bjt_npn | promoted | Finalized reviewer metadata; Added exact 25 C gain minimum and maximum reviewer probes, including the inclusive hFE maximum at 10 mA. |
| 436 | `lrc/LBC847BLT1G` | F2 | bjt_npn | rejected | Numerical residuals pass, but the staged F2 points cite the LBC846B curve instead of the LBC847B group curve and contain severe axis, unit, and range mismatches. |
| 439 | `infineon/BFP420H6327` | F2 | bjt_npn | promoted | Narrowed F2 scope to Figure 6 at 25 C, VCE = 3 V, and the sampled current range; Added an exact Table 3 hFE range probe at VCE = 4 V. |
| 452 | `rohm-semicon/2SC2411KT146R` | F1 | bjt_npn | rejected | T146 is the taping code and final R is the 180 through 390 gain rank. The staged package uses generic minimum 82 and BF = 82.82. |
| 456 | `st-semtech/MMBT8550D-2TY` | F1 | bjt_npn | rejected | Primary source is PNP, while the staged contract and model are NPN. Promotion would require polarity and electrical-model changes. |
| 458 | `nexperia/PMBTA42-215` | F1 | bjt_npn | rejected | Source minimum hFE is 25 at 1 mA and 40 at 10 mA and 30 mA. The staged package captures only 25 and uses BF = 25.25, so it fails the omitted 40 minimum claims without refitting. |
| 459 | `onsemi/BC857BDW1T1G` | F1 | bjt_pnp | rejected | The source device is a dual PNP transistor, while the staged package represents one three-pin PNP transistor. |
| 460 | `lrc/LMBT2907ALT1G` | F1 | bjt_npn | rejected | Primary source is PNP, while the staged contract and model are NPN. Promotion would require polarity and electrical-model changes. |
| 463 | `rohm-semicon/2SC4617TLR` | F1 | bjt_npn | promoted | Confirmed TL is the taping code and R is the 180 through 390 gain rank; Added an exact inclusive R-rank probe at 1 mA and VCE = 6 V. |
| 467 | `onsemi/BC847BPDW1T1G` | F1 | bjt_npn | rejected | The source device is a complementary NPN and PNP dual, while the staged package represents one three-pin NPN transistor. |
| 492 | `jiangsu-changjing-electronics-co-ltd/2SD1898-RANGE-180-390` | F1 | bjt_npn | rejected | The ordering suffix is a 180 through 390 gain rank at IC = 500 mA, VCE = 3 V. The staged package treats 390 as typical at 1 uA and requires refitting. |
| 494 | `nexperia/BC850C-215` | F1 | bjt_npn | rejected | Source hFE is 450 typical at 10 uA and 420 minimum, 520 typical, 800 maximum at 2 mA. The staged extraction and BF = 5 are unsupported. |
| 502 | `twgmc/2SC4617` | F1 | bjt_npn | rejected | Source hFE is 120 minimum and 560 maximum at IC = 1 mA, VCE = 6 V. The staged extraction treats 560 as typical at 0.1 uA and uses the published maximum as BF. |
| 509 | `diodes/ZXTN25012EFLTA` | F1 | bjt_npn | rejected | The source provides representative typical gain values, including about 800 at IC = 10 mA. The staged BF = 500 derives from a materially incorrect, mislabeled point. |
| 510 | `jiangsu-changjing-electronics-co-ltd/2SA812-RANGE-300-400` | F1 | bjt_pnp | rejected | The ordering suffix is a 300 through 400 gain rank. The staged extraction records hFE = 1 and treats the generic 600 maximum as typical, producing unsupported BF = 600. |
| 511 | `shikues/BCX51-16` | F1 | bjt_pnp | rejected | Suffix -16 specifies minimum hFE 100 at IC = 150 mA. The staged model uses BF = 25 from a generic lower-current minimum. |
| 513 | `onsemi/MMBTH81` | F1 | bjt_pnp | promoted | Corrected source title and revision wording; Corrected hFE minimum semantics and source conditions, plus fT, Ccb, and VCEO metadata; Replaced the unsupported staged scalar expectation with an exact inclusive minimum probe at 5 mA; Narrowed F1 scope to the cited 25 C point at |VCE| = 10 V. |
| 514 | `jiangsu-changjing-electronics-co-ltd/PZTA92` | F1 | bjt_pnp | promoted | Corrected source title and revision wording; Corrected three hFE table currents, minimum semantics, units, source conditions, fT, Cob, and VCEO metadata; Replaced the unsupported staged scalar expectation with exact inclusive minimum probes at 1, 10, and 30 mA; Narrowed F1 scope to those three 25 C points at |VCE| = 10 V. |
| 518 | `foshan-blue-rocket-elec/9014` | F1 | bjt_npn | rejected | Source hFE is 60 minimum and 1000 maximum at IC = 1 mA, VCE = 5 V. The staged package treats 1000 as typical at 50 nA and uses the published maximum as BF. |
| 520 | `jiangsu-changjing-electronics-co-ltd/MJD32C` | F1 | bjt_pnp | rejected | Source gives minimum hFE 25 at 1 A and minimum 15, maximum 75 at 3 A. The staged extraction marks minima and maxima as typical at wrong currents and sets BF = 75. |
| 525 | `umw-youtai-co-ltd/MMBTH10` | F1 | bjt_npn | promoted | Corrected source title and revision wording; Corrected the hFE test current from 0.1 uA to 4 mA, minimum semantics, fT, Cob, and VCEO metadata; Replaced the unsupported staged scalar expectation with an exact inclusive minimum probe at 4 mA; Narrowed F1 scope to the cited 25 C point at VCE = 10 V. |
| 529 | `onsemi/2N5401YBU` | F1 | bjt_pnp | rejected | The Y gain class is 120 through 240 at IC = 10 mA. The staged extraction and BF = 2 do not represent the documented suffix rank. |

## Promoted-package validation

- Package validators: 11 of 11 passed.
- Native ngspice-46 and pinned WASM benches: 47 of 47 passed.
- Promoted expectations: 75 of 75 passed, including 53 of 53 hard bounds.
- Explicit `.temp 25`: 47 of 47 benches.
- Worst native/WASM relative delta: `6.004309290589692e-7`; worst absolute delta: `2.67321759062078e-7`.
- All 11 promoted `model.cir` files and all 11 promoted `fitted.json` files are byte-identical to staging.

## Test and typecheck evidence

- `npm test --workspace=@opencircuit/model-library`: PASS, component-schema validated all 703 packages.
- `npm test --prefix tools/model-factory`: PASS, 46 tests.
- `npm test --prefix tools/conveyor`: PASS, 16 tests.
- `npm run typecheck --prefix tools/conveyor`: PASS.
- `npm test`: PASS, 99 workspace tests: 4 web, 21 circuit-schema, 4 component-schema, 38 model-import, 1 model-library, 10 sim-engine, and 21 waveform-viewer.
- `npm run typecheck`: PASS, all 6 TypeScript workspace typechecks.
- Part-feeder standard suite: PASS, 9 discovered, 5 active passed, 4 skipped. One skip is the opt-in live smoke test; three are freeze tests gated on the ignored manifest absent from this checkout.
- Part-feeder freezer bodies: PASS, 3 of 3 against the byte-reproduced manifest and absolute frozen inputs at the 692-package baseline. Part-feeder Python typecheck also passed.

## Reproducibility and repository audits

- Whole Batch 9 staging tree: 1,257 files, 163,724,542 bytes, aggregate SHA-256 `589d8d7c35555cd3db3117ea5e6eeda849466cdb3ed9c9a73ec5d68cb6b5bf05`.
- Final staged package trees: 365 files, 705,564 bytes, aggregate SHA-256 `b80a51e936a55df363fbb952238abcd7061c42a54596e8fe67147eb7d0324df0`.
- Staging aggregates are unchanged from pre-promotion measurements.
- No promoted package contains a pending-review marker, cached PDF, archive, SQLite database, extraction response, absolute staging path, scratch path, or positive claim that a vendor SPICE model was used.
- No electrical parameter, fitter, gate, conveyor implementation, feeder implementation, or freeze record changed.

## Process deviations

- The initial isolated 370 through 409 lane made zero shared-state calls because its path was inaccessible.
- The initial isolated 410 through 449 lane was killed after zero shared-state calls. Its non-isolated replacement processed 410 through 413 and stopped before 414. Bounded 414 through 449 partitions completed the remaining work.
- Two isolated invocations performed zero work, two lane invocations were interrupted or killed, and 79 missing unique calls were resumed. Maximum live lanes stayed at four.
- Extraction recorded 159 initial unique target calls, 11 bounded discrepancy retries, 170 logical calls, zero transport retries, and exactly zero repeated completed extraction calls.
- The ignored scale-2k manifest is absent from the checkout. The freeze tests were therefore run against the exact scratch reproduction without writing a freeze record or changing test code.
- No prior review rejection was revisited. No push, deploy, publish, GitHub comment, or Vault update was performed.
